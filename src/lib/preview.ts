import { compileImagePrompt, compileScenePrompt, compileVideoPrompt } from "./production/prompts";
import { frameModel } from "./routing/frame-router";
import { VIDEO_MODELS } from "./routing/video-router";
import type { Character, Project, Scene } from "./types";

/**
 * What each paid shot will actually send: the compiled prompt, the ordered reference images and any
 * limits that were hit. Kept free of server-only imports so the quote panel can render it before approval.
 */

export interface PreviewReference { name: string; url: string; kind: Character["kind"] }

export interface ShotPreviewLine {
  sceneId: string;
  title: string;
  frame: { modelLabel: string; prompt: string; truncated: boolean; references: PreviewReference[] } | null;
  video: { modelLabel: string; prompt: string; truncated: boolean } | null;
  warnings: string[];
}

function approvedSheets(project: Project, scene: Scene): { character: Character; url: string }[] {
  return project.characters.flatMap((character) => {
    if (!scene.characterIds.includes(character.id) || character.sheet.status !== "approved" || !character.sheet.chosen) return [];
    const attempt = character.sheet.attempts.find((item) => item.id === character.sheet.chosen);
    return attempt ? [{ character, url: attempt.url }] : [];
  });
}

/** The previous shot's frame when it shows the same place, mirroring the worker's continuity reference. */
function continuityImage(project: Project, scene: Scene): string | null {
  const places = new Set(project.characters.filter((item) => item.kind === "place" && scene.characterIds.includes(item.id)).map((item) => item.id));
  if (!places.size) return null;
  const shots = project.scenes.filter((item) => item.kind === "video").toSorted((a, b) => a.order - b.order);
  const previous = shots[shots.findIndex((item) => item.id === scene.id) - 1];
  return previous && previous.imageSource === "generated" && previous.characterIds.some((id) => places.has(id)) ? previous.image : null;
}

export function buildShotPreview(project: Project): ShotPreviewLine[] {
  const quote = project.quote;
  if (!quote) return [];
  return project.scenes.filter((scene) => scene.kind === "video").map((scene) => {
    const warnings: string[] = [];
    const imageLine = quote.lines.find((line) => line.sceneId === scene.id && line.kind === "image");
    const videoLine = quote.lines.find((line) => line.sceneId === scene.id && (line.kind ?? "video") === "video");

    let frame: ShotPreviewLine["frame"] = null;
    if (imageLine) {
      const spec = frameModel(imageLine.modelId) ?? frameModel("gemini-nano-banana-2.1")!;
      const sheets = approvedSheets(project, scene);
      const previous = continuityImage(project, scene);
      const used = sheets.slice(0, Math.max(0, spec.maxReferences - (previous ? 1 : 0)));
      const compiled = used.length
        ? compileScenePrompt(project, scene, used.map((item) => item.character), Boolean(previous), spec.maxPrompt)
        : compileImagePrompt(project, scene, spec.maxPrompt);
      const references: PreviewReference[] = [
        ...used.map((item) => ({ name: item.character.name, url: item.url, kind: item.character.kind })),
        ...(previous ? [{ name: "Önceki çekim", url: previous, kind: "place" as const }] : []),
      ];
      frame = { modelLabel: imageLine.modelLabel || spec.label, prompt: compiled.prompt, truncated: compiled.truncated, references };
      if (scene.characterIds.length && !sheets.length) warnings.push("Bağlı karakter/mekân var ama onaylı sayfa yok; kare referanssız üretilecek.");
      if (compiled.truncated) warnings.push(`Kare promptu ${spec.maxPrompt} karakter sınırına göre kısaltıldı.`);
      if (sheets.length + (previous ? 1 : 0) > spec.maxReferences) warnings.push(`Referans sayısı model sınırını (${spec.maxReferences}) aşıyor; üretim başlamaz.`);
    }

    let video: ShotPreviewLine["video"] = null;
    if (videoLine) {
      const spec = VIDEO_MODELS.find((model) => model.id === videoLine.modelId);
      if (spec) {
        const compiled = compileVideoPrompt(project, scene, spec.maxPrompt);
        video = { modelLabel: videoLine.modelLabel || spec.label, prompt: compiled.prompt, truncated: compiled.truncated };
        if (compiled.truncated) warnings.push(`Video promptu ${spec.maxPrompt} karakter sınırına göre kısaltıldı.`);
      }
    }

    if (!frame && !video) warnings.push("Bu çekim yeniden kullanılacak; yeni istek gönderilmeyecek.");
    return { sceneId: scene.id, title: scene.title, frame, video, warnings };
  });
}
