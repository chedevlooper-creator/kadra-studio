import { CAMERA_MOVES, EMOTIONS, GENRES, LOOKS } from "./cinema";
import { effectiveScenePrompt } from "./production/prompts";
import { extractJson, ProviderError } from "./providers/nvidia";
import type { AssistantProjectPatch, AssistantProposal, AssistantScenePatch, Project, ProposedChange, Scene } from "./types";

/** The part of a project the assistant is shown and allowed to reason about. */
export type AssistantContext = Pick<Project, "style" | "aspectRatio" | "genre" | "look" | "brief" | "characters" | "scenes">;

export const ASSISTANT_SCENE_FIELDS = ["title", "description", "prompt", "motionPrompt", "camera", "duration", "narration", "emotions"] as const;

const cut = (value: string, max: number) => value.length > max ? `${value.slice(0, max - 1).trim()}…` : value;

/** The brief sent to the model: the film's state, then the user's request. Nothing in it can spend money. */
export function assistantInstructions(project: AssistantContext, message: string): string {
  const people = project.characters.filter((character) => (character.kind ?? "person") === "person");
  const state = {
    film: { style: project.style, aspectRatio: project.aspectRatio, genre: project.genre, look: project.look, brief: project.brief },
    characters: project.characters.map((character) => ({ id: character.id, name: character.name, kind: character.kind, appearance: cut(character.appearance, 160) })),
    scenes: project.scenes.map((scene) => ({
      id: scene.id, order: scene.order, kind: scene.kind, title: scene.title, description: cut(scene.description, 400), prompt: cut(effectiveScenePrompt(scene), 600),
      motionPrompt: cut(scene.motionPrompt, 200), camera: scene.camera, duration: scene.duration, narration: cut(scene.narration, 300),
      characterIds: scene.characterIds, emotions: scene.emotions ?? {},
    })),
  };
  return `Sen Kadra film stüdyosunun yönetmen asistanısın. Kullanıcı filminin sahnelerini konuşarak değiştirmeni istiyor. Aşağıda filmin güncel durumu ve kullanıcının isteği var.
Kurallar:
- Yalnızca istenen değişikliği yap; değişmesi gerekmeyen sahneyi ve alanı hiç yazma. "3. sahne" demek order değeri 3 olan sahnedir.
- Sahne ekleme, silme, sıra değiştirme ve para harcatan işlemler yapılamaz; böyle bir istek varsa scenes boş olsun ve reply'de kısaca nedenini söyle.
- Alanlar: title (Türkçe, kısa), description (Türkçe, sahnede ne olduğu; yazı kartlarında (kind "title") ekranda görünecek metin), prompt (profesyonel sinematik İngilizce görsel tarif; sahnedeki karakter ve mekân tariflerini aynı kelimelerle koru), motionPrompt (İngilizce kamera/hareket tarifi), camera (yalnızca şunlardan biri: ${CAMERA_MOVES.map((move) => `"${move.label}"`).join(", ")}), duration (2-30 arası tam sayı saniye), narration (Türkçe dış ses metni; boş yazı sesi kaldırır), emotions ({karakter_id: duygu}; yalnızca sahnedeki kişiler; duygu şunlardan biri: ${EMOTIONS.filter((emotion) => emotion.id).map((emotion) => emotion.id).join(", ")}; boş yazı duyguyu kaldırır).
- Kişiler: ${people.length ? people.map((person) => `${person.id}=${person.name}`).join(", ") : "yok"}.
- Bir sahnenin havasını (gergin, neşeli, gece, yağmurlu…) değiştirmek istenirse prompt, description ve uygunsa emotions ile camera'yı birlikte tutarlı biçimde güncelle.
- project alanı yalnızca kullanıcı bütün filmin türünü, rengini ya da üretim notlarını değiştirmek isterse kullanılır: genre (${GENRES.map((genre) => genre.id || '""').join(", ")}), look (${LOOKS.map((look) => look.id).join(", ")}), brief (en fazla 1500 karakter, mevcut notları koruyarak genişlet).
- reply: Türkçe, en fazla iki kısa cümle; ne yaptığını söyle.
Yalnızca şu yapıda geçerli JSON döndür, başka metin yazma:
{"reply":"","scenes":[{"id":"","set":{"title":"","description":"","prompt":"","motionPrompt":"","camera":"","duration":5,"narration":"","emotions":{"c1":"tense"}}}],"project":{"genre":"","look":"","brief":""}}
Kullanılmayan alanları ve kullanılmayan project nesnesini hiç yazma (project için null yaz).

FİLM:
${JSON.stringify(state)}

KULLANICININ İSTEĞİ:
${message.trim()}`;
}

const text = (value: unknown, max: number, allowEmpty = false): string | null => {
  if (typeof value !== "string") return null;
  const trimmed = value.trim();
  return trimmed.length > 0 || allowEmpty ? trimmed.slice(0, max) : null;
};

function currentFields(scene: Scene): Required<AssistantScenePatch> {
  return {
    title: scene.title, description: scene.description, prompt: effectiveScenePrompt(scene), motionPrompt: scene.motionPrompt, camera: scene.camera,
    duration: scene.duration, narration: scene.narration, emotions: scene.emotions ?? {},
  };
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/**
 * Turns the model's answer into a proposal the user can read. Only known shots, allowed fields and valid values survive,
 * and a value equal to what is already there is not a change.
 */
export function parseAssistantReply(content: string, project: AssistantContext): AssistantProposal {
  const raw = extractJson(content) as { reply?: unknown; scenes?: unknown; project?: unknown } | null;
  if (!raw || typeof raw !== "object") throw new ProviderError("Asistanın yanıtı okunamadı.", true);
  const byId = new Map(project.scenes.map((scene) => [scene.id, scene]));
  const changes: ProposedChange[] = [];
  for (const entry of Array.isArray(raw.scenes) ? raw.scenes.slice(0, project.scenes.length) : []) {
    const item = entry as { id?: unknown; set?: Record<string, unknown> };
    const scene = typeof item?.id === "string" ? byId.get(item.id) : undefined;
    if (!scene || !item.set || typeof item.set !== "object" || changes.some((change) => change.sceneId === scene.id)) continue;
    const now = currentFields(scene);
    const set: AssistantScenePatch = {};
    const candidates: AssistantScenePatch = {
      title: text(item.set.title, 160) ?? undefined,
      description: text(item.set.description, 4_000) ?? undefined,
      prompt: scene.kind === "title" ? undefined : text(item.set.prompt, 4_000) ?? undefined,
      motionPrompt: scene.kind === "title" ? undefined : text(item.set.motionPrompt, 1_000, true) ?? undefined,
      camera: text(item.set.camera, 160) ?? undefined,
      duration: Number.isFinite(Number(item.set.duration)) && item.set.duration !== null && item.set.duration !== "" ? Math.min(30, Math.max(2, Math.round(Number(item.set.duration)))) : undefined,
      narration: text(item.set.narration, 1_000, true) ?? undefined,
    };
    for (const field of ["title", "description", "prompt", "motionPrompt", "camera", "duration", "narration"] as const) {
      const value = candidates[field];
      if (value !== undefined && !same(value, now[field])) (set as Record<string, unknown>)[field] = value;
    }
    if (item.set.emotions && typeof item.set.emotions === "object") {
      const next = { ...now.emotions };
      for (const [who, feeling] of Object.entries(item.set.emotions as Record<string, unknown>)) {
        const person = project.characters.find((character) => character.id === who);
        if (!person || (person.kind ?? "person") !== "person" || !scene.characterIds.includes(who) || typeof feeling !== "string") continue;
        if (feeling === "") delete next[who];
        else if (EMOTIONS.some((emotion) => emotion.id === feeling)) next[who] = feeling;
      }
      if (!same(next, now.emotions)) set.emotions = next;
    }
    const keys = Object.keys(set) as (keyof AssistantScenePatch)[];
    if (!keys.length) continue;
    changes.push({ sceneId: scene.id, order: scene.order, title: scene.title, set, before: Object.fromEntries(keys.map((key) => [key, now[key]])) as AssistantScenePatch });
  }

  let projectPatch: AssistantProjectPatch | null = null;
  let projectBefore: AssistantProjectPatch | null = null;
  if (raw.project && typeof raw.project === "object") {
    const incoming = raw.project as Record<string, unknown>;
    const set: AssistantProjectPatch = {};
    if (typeof incoming.genre === "string" && GENRES.some((genre) => genre.id === incoming.genre) && incoming.genre !== project.genre) set.genre = incoming.genre;
    if (typeof incoming.look === "string" && LOOKS.some((look) => look.id === incoming.look) && incoming.look !== project.look) set.look = incoming.look;
    const brief = text(incoming.brief, 1_500, true);
    if (brief !== null && brief !== project.brief.trim()) set.brief = brief;
    const keys = Object.keys(set) as (keyof AssistantProjectPatch)[];
    if (keys.length) { projectPatch = set; projectBefore = Object.fromEntries(keys.map((key) => [key, project[key]])) as AssistantProjectPatch; }
  }

  const reply = text(raw.reply, 600) ?? (changes.length || projectPatch ? "Önerilen değişiklikler aşağıda." : "Bu isteğe uygun bir değişiklik bulamadım.");
  return { reply, changes, project: projectPatch, projectBefore };
}
