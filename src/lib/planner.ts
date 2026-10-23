import { randomUUID } from "node:crypto";
import type { AiPlan } from "./providers/nvidia";
import type { Character, ModelProfile, ProviderStatus, Scene } from "./types";
import { AppError } from "./validation";

export const VIDEO_MODEL = "GMI video · yapay zekâ";
export const TITLE_MODEL = "Yazı kartı";
const VIDEO_REASON = "Başlangıç karesi GMI görsel modeliyle onaylı karakter/mekân referansları kullanılarak üretilir; çekim GMI video modeliyle hareketlendirilir. Ücretsiz görsel veya kamera hareketi kullanılmaz.";
const TITLE_REASON = "Yazı kartı doğrudan metin olarak çizilir; yapay zekâ metni değiştirmez, harfler eksiksiz görünür.";

export function modelCatalog(providers: ProviderStatus): ModelProfile[] {
  return [
    { id: "deepseek-bridge", name: "DeepSeek V4.1 Flash + Web Arama", provider: "DeepSeek", type: "planning", description: "Modeller arası köprü: webde karakter ve referans arar (/v1/tools/search), senaryoyu planlar, görselleri denetler ve üretim modellerine görsel/metin girdisi hazırlar.", tags: ["Köprü", "Web arama", "Görsel hakem"], configured: Boolean(providers.deepseek), free: false },
    { id: "nemotron-planner", name: "Nemotron 3 Ultra", provider: "NVIDIA", type: "planning", description: "Senaryoyu karakterleri ve çekimleriyle planlar; her çekim için görsel ve hareket promptu yazar.", tags: ["Sahne planı", "Türkçe", "Ücretsiz katman"], configured: providers.nvidia, free: true },
    { id: "flux2-klein", name: "FLUX.2 Klein", provider: "NVIDIA", type: "image", description: "Her çekimin başlangıç karesini birkaç saniyede üretir. Karakter görünüşü her promptta tekrarlanır.", tags: ["Görsel", "Hızlı", "Ücretsiz katman"], configured: providers.nvidia, free: true },
    { id: "nemotron-vl", name: "Nemotron 3.5 Super VL", provider: "NVIDIA", type: "review", description: "Üretilen kareyi çekim açıklaması ve onaylı karakter sayfalarıyla karşılaştırır; uyumsuz ya da bozuksa işaretler. Görsel üretmez.", tags: ["Kalite kontrolü", "Görsel anlama", "Ücretsiz katman"], configured: providers.nvidia, free: true },
    { id: "gmi-nano-banana", name: "Gemini Nano Banana 2.1", provider: "GMI", type: "image", description: "Tüm karakter ve mekân sayfalarını üretir; referans fotoğraf varsa onu, yoksa tarifi kullanır. Onaylı sayfalar sahne karelerine referans olur.", tags: ["Referans görsel", "Karakter sayfası", "Ücretli"], configured: providers.gmi, free: false },
    { id: "gmi-video", name: "GMI video yönlendirici", provider: "GMI", type: "video", description: "Her çekimi gerçek yapay zekâ videosuna çevirir. Kalite seviyene uyan modeller (Veo 3.1 Lite, Hailuo, Seedance, Wan, Kling, Veo 3.1 Fast) arasından canlı fiyata göre en ucuzunu seçer; teklifi onaylamadan ücret oluşmaz.", tags: ["Video", "Ücretli", "Onaylı teklif"], configured: providers.gmi, free: false },
  ];
}

export function newCharacter(id: string, name: string, appearance: string, aliases: string[] = [name], style = "", kind: Character["kind"] = "person"): Character {
  return { id, kind, name, appearance, aliases: aliases.map((alias) => alias.trim()).filter(Boolean).slice(0, 12), style, reference: null, sheet: { status: "none", attempts: [], chosen: null, note: "" } };
}

/** A shot features a character when one of its aliases appears in the shot's text (Turkish-aware, case-insensitive). */
export function mentionsCharacter(scene: Pick<Scene, "title" | "description" | "prompt">, character: Pick<Character, "aliases">): boolean {
  const haystack = `${scene.title}\n${scene.description}\n${scene.prompt}`.toLocaleLowerCase("tr");
  return character.aliases.some((alias) => alias.length >= 3 && haystack.includes(alias.toLocaleLowerCase("tr")));
}

interface Segment { title: string; content: string }

/** Explicit labels begin a new shot even if their numbers repeat. Never deduplicate script text. */
export function parseScript(script: string): Segment[] {
  const source = script.replace(/\r\n?/g, "\n").trim();
  if (source.length < 10) throw new AppError(400, "Plan hazırlamak için en az 10 karakterlik bir senaryo yazın.");
  if (source.length > 30_000) throw new AppError(400, "Senaryo en fazla 30.000 karakter olabilir.");
  const label = /^\s*(?:#{1,3}\s*)?((?:sahne\s*\d+|\d+\s*[.)-]?\s*sahne|[iİ]lk\s+sahne|g[iİ]r[iİ][şs]|[iİ]ntro|f[iİ]nal|son\s+sahne)(?:\s*[–—-]\s*[^:]+)?)(?:\s*:\s*(.*)|\s*)$/iu;
  const segments: Segment[] = [];
  let current: Segment | null = null;
  let labeled = false;
  for (const line of source.split("\n")) {
    const match = line.match(label);
    if (match) {
      labeled = true;
      if (current) segments.push(current);
      current = { title: match[1].trim(), content: (match[2] || "").trim() };
    } else {
      current ||= { title: "Giriş", content: "" };
      current.content += `${current.content ? "\n" : ""}${line}`;
    }
  }
  if (current) segments.push(current);
  const result = labeled ? segments : source.split(/\n\s*\n+/).map((content, index) => ({ title: `Sahne ${index + 1}`, content }));
  if (result.length > 40) throw new AppError(400, "Bu yerel sürüm bir projede en fazla 40 çekim destekliyor. Senaryoyu bölümlere ayırın.");
  return result.map((segment) => ({ ...segment, content: segment.content.trim() || segment.title }));
}

export { titleCardText } from "./text";

function baseScene(index: number, image: string): Omit<Scene, "title" | "description" | "prompt" | "kind" | "camera" | "duration" | "model" | "modelReason" | "notes"> {
  return { id: randomUUID(), order: index + 1, motionPrompt: "", status: "draft", image, imageSource: "reference", review: null, frameKey: "", frameModel: "", repair: null, characterIds: [], narration: "", motion: "free", videoModel: null, code: "", group: "", audioNotes: "", screenText: "" };
}

/** One shot of an exported storyboard (the Flow prototype's JSON). Unknown fields are ignored. */
export interface StoryboardShot {
  id: string;
  sceneId?: string;
  sceneTitle?: string;
  durationSec: number;
  timeRange?: string;
  visualSummary: string;
  cameraMovement?: string;
  aiPrompt: string;
  audioCues?: string;
  voiceoverOrText?: string;
}

const BLANK = /^[\s—–-]*$/;
const quotedText = (text: string) => [...text.matchAll(/«([^»]+)»/g)].map((match) => match[1].trim()).join(" ");

/** Keeps the storyboard's prompts and timings as written; only a black-screen card becomes a drawn title card. */
export function scenesFromStoryboard(shots: StoryboardShot[], image: string): Scene[] {
  return shots.map((shot, index): Scene => {
    const screenText = BLANK.test(shot.voiceoverOrText ?? "") ? "" : shot.voiceoverOrText!.trim();
    const isTitle = /siyah ekran|black screen|yazı kartı|title card/i.test(shot.visualSummary) || /^pure black screen/i.test(shot.aiPrompt.trim());
    const headline = shot.visualSummary.trim().split(/(?<=[.!?])\s/)[0].slice(0, 70);
    return {
      ...baseScene(index, image),
      code: shot.id.slice(0, 20),
      group: [shot.sceneId, shot.sceneTitle].filter(Boolean).join(" · ").slice(0, 160),
      title: `${shot.id} · ${headline}`.slice(0, 160),
      description: isTitle ? quotedText(screenText) || shot.visualSummary : shot.visualSummary,
      prompt: shot.aiPrompt,
      duration: Math.min(30, Math.max(2, Math.round(shot.durationSec))),
      camera: shot.cameraMovement?.trim() || (isTitle ? "Sabit kadraj" : "Yavaş yaklaşma"),
      model: isTitle ? TITLE_MODEL : VIDEO_MODEL,
      modelReason: isTitle ? TITLE_REASON : VIDEO_REASON,
      kind: isTitle ? "title" : "video",
      audioNotes: shot.audioCues?.trim() ?? "",
      screenText,
      notes: ["Çekim storyboard dosyasından içe aktarıldı; prompt, süre ve kamera notu aynen korundu.", ...(shot.timeRange ? [`Zaman kodu: ${shot.timeRange}`] : [])],
    };
  });
}

/** A readable script for the Script tab; its labels also re-plan cleanly with the rule-based planner. */
export function scriptFromStoryboard(shots: StoryboardShot[]): string {
  return shots.map((shot) => {
    const label = (shot.sceneId ?? "").toLocaleLowerCase("tr").startsWith("fi") ? "Final" : (shot.sceneId ?? "").match(/\d+/) ? `Sahne ${shot.sceneId!.match(/\d+/)![0]}` : "Sahne";
    return `${label} – ${shot.id}: ${shot.visualSummary.trim()}`;
  }).join("\n\n").slice(0, 30_000);
}

export function planScenes(script: string, style: string, image: string): Scene[] {
  return parseScript(script).map((segment, index) => {
    const isTitle = /(?:yazı\s*kartı|ekranda\s*(?:şu\s*)?yazı|başlık\s*kartı|daktilo)/iu.test(segment.content);
    return {
      ...baseScene(index, image),
      title: segment.title.slice(0, 160), description: segment.content,
      prompt: `${style} görsel dili. ${segment.content}`,
      duration: Math.min(12, Math.max(4, Math.ceil(segment.content.split(/\s+/).length / 3))),
      camera: isTitle ? "Sabit kadraj" : "Yavaş yaklaşma",
      model: isTitle ? TITLE_MODEL : VIDEO_MODEL,
      modelReason: isTitle ? TITLE_REASON : VIDEO_REASON,
      kind: isTitle ? "title" : "video",
      notes: ["Plan kural tabanlı ayrıştırıcıyla hazırlandı; dil modeli kullanılmadı.", "Süre ve kamera bir başlangıç önerisidir; düzenlenebilir."],
    };
  });
}

export function scenesFromAiPlan(plan: AiPlan, image: string): { characters: Character[]; scenes: Scene[] } {
  const characters: Character[] = [];
  const idMap = new Map<string, string>();
  plan.characters.forEach((character, index) => {
    const id = `c${index + 1}`;
    if (character.id) idMap.set(character.id, id);
    characters.push(newCharacter(id, character.name.slice(0, 80), character.appearance));
  });
  // Locations share the bank (12 entries in all), so the cast keeps priority.
  plan.locations.slice(0, Math.max(0, 12 - characters.length)).forEach((location, index) => {
    const id = `m${index + 1}`;
    if (location.id) idMap.set(location.id, id);
    characters.push(newCharacter(id, location.name.slice(0, 80), location.appearance, [location.name], "", "place"));
  });
  const scenes = plan.shots.map((shot, index): Scene => {
    const isTitle = shot.kind === "title";
    const description = (isTitle ? shot.on_screen_text || shot.description : shot.description) || shot.title;
    return {
      ...baseScene(index, image),
      title: shot.title, description,
      prompt: shot.image_prompt || description,
      motionPrompt: shot.motion_prompt,
      duration: shot.duration_seconds,
      camera: shot.camera || (isTitle ? "Sabit kadraj" : "Yavaş yaklaşma"),
      model: isTitle ? TITLE_MODEL : VIDEO_MODEL,
      modelReason: isTitle ? TITLE_REASON : VIDEO_REASON,
      kind: isTitle ? "title" : "video",
      characterIds: [...new Set([...shot.character_ids, shot.location_id].map((id) => idMap.get(id)).filter((id): id is string => Boolean(id)))],
      narration: shot.narration,
      notes: ["Plan NVIDIA Nemotron 3 Ultra ile hazırlandı; senaryodaki olaylar korunarak çekimlere ayrıldı.", "Görsel promptu İngilizce yazıldı; karakter görünüşü her çekimde tekrarlanır."],
    };
  });
  return { characters, scenes };
}
