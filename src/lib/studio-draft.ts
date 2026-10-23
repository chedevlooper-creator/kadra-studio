import { CAMERA_MOVES, GENRES, LOOKS, presetOf } from "./cinema";
import type { AspectRatio } from "./types";

export type StudioView = "explore" | "image" | "video" | "cinema" | "effects" | "characters" | "audio" | "editor" | "projects" | "queue" | "library" | "connections" | "settings" | "favorites";
export const STUDIO_VIEWS: StudioView[] = ["explore", "image", "video", "cinema", "effects", "characters", "audio", "editor", "projects", "queue", "library", "connections", "settings", "favorites"];
export type CreationMode = "image" | "video";
export interface StudioLaunch { id: number; presetId?: string; prompt?: string; }
export interface StudioDraft {
  prompt: string;
  mode: CreationMode;
  presetId: string;
  aspectRatio: AspectRatio;
  duration: number;
  camera: string;
  lens: string;
  aperture: string;
  lighting: string;
  genre: string;
  look: string;
  era: string;
  pacing: string;
  frameModel: string;
  videoModel: string;
  multiShot: boolean;
}

export const LENSES = [
  { id: "", label: "Otomatik", prompt: "" },
  { id: "clean", label: "Keskin / Modern", prompt: "clean sharp modern cinema lens" },
  { id: "anamorphic", label: "Anamorfik", prompt: "anamorphic cinema lens, oval bokeh, horizontal lens flares" },
  { id: "vintage", label: "Vintage", prompt: "vintage cinema lens, gentle halation and soft highlight rolloff" },
  { id: "wide", label: "Geniş açı", prompt: "24mm wide angle cinema lens" },
  { id: "portrait", label: "Portre", prompt: "85mm portrait lens, shallow depth of field" },
] as const;
export const LIGHTING = [
  { id: "", label: "Otomatik", prompt: "" },
  { id: "window", label: "Pencere ışığı", prompt: "soft natural window light" },
  { id: "golden", label: "Altın saat", prompt: "warm golden hour sunlight" },
  { id: "silhouette", label: "Silüet", prompt: "dramatic backlit silhouette" },
  { id: "studio", label: "Stüdyo", prompt: "soft professional studio lighting" },
  { id: "neon", label: "Neon", prompt: "cinematic neon practical lighting" },
  { id: "lowkey", label: "Düşük ışık", prompt: "low key dramatic lighting with deep shadows" },
] as const;

export function defaultStudioDraft(mode: CreationMode = "video", launch?: StudioLaunch): StudioDraft {
  const preset = presetOf(launch?.presetId ?? "");
  return { prompt: launch?.prompt ?? preset?.idea ?? "", mode, presetId: preset?.id ?? "cinematic", aspectRatio: "16:9", duration: 5, camera: "in", lens: "", aperture: "", lighting: "", genre: preset?.genre === "general" ? "" : preset?.genre ?? "", look: preset?.look ?? "none", era: "", pacing: "", frameModel: "", videoModel: "", multiShot: false };
}

/** Browser storage is untrusted; restore only known values and bounded text. */
export function restoreStudioDraft(raw: unknown, fallback: StudioDraft): StudioDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const data = raw as Record<string, unknown>;
  const text = (key: string, max: number) => typeof data[key] === "string" ? (data[key] as string).slice(0, max) : fallback[key as keyof StudioDraft];
  const oneOf = <T extends string>(key: keyof StudioDraft, choices: readonly T[], otherwise: T): T => choices.includes(data[key] as T) ? data[key] as T : otherwise;
  return { ...fallback, prompt: text("prompt", 4000) as string, mode: oneOf("mode", ["image", "video"], fallback.mode), aspectRatio: oneOf("aspectRatio", ["16:9", "9:16", "1:1"], fallback.aspectRatio), duration: typeof data.duration === "number" && Number.isInteger(data.duration) && data.duration >= 2 && data.duration <= 15 ? data.duration : fallback.duration, camera: oneOf("camera", CAMERA_MOVES.map((item) => item.id), "in"), lens: oneOf("lens", LENSES.map((item) => item.id), ""), lighting: oneOf("lighting", LIGHTING.map((item) => item.id), ""), genre: oneOf("genre", GENRES.map((item) => item.id), ""), look: oneOf("look", LOOKS.map((item) => item.id), "none"), presetId: presetOf(data.presetId as string)?.id ?? fallback.presetId, aperture: oneOf("aperture", ["", "f/1.4", "f/4", "f/11"], ""), era: oneOf("era", ["", "1960s", "1980s", "1990s", "2020s"], ""), pacing: oneOf("pacing", ["", "calm", "dynamic", "single"], ""), frameModel: text("frameModel", 100) as string, videoModel: text("videoModel", 100) as string, multiShot: data.multiShot === true };
}

/** Cinematic selections are explicit prompt direction; they never impersonate provider hardware parameters. */
export function studioProjectInput(draft: StudioDraft, budget: number | null) {
  const preset = presetOf(draft.presetId);
  const direction = [preset?.brief, LENSES.find((item) => item.id === draft.lens)?.prompt, LIGHTING.find((item) => item.id === draft.lighting)?.prompt, draft.aperture ? `aperture ${draft.aperture}` : "", draft.era ? `visual era: ${draft.era}` : "", draft.pacing ? `pacing: ${draft.pacing}` : ""].filter(Boolean).join(". ").slice(0, 1500);
  const parts = draft.multiShot && draft.mode === "video" ? draft.prompt.trim().split(/\n\s*\n/).filter(Boolean).slice(0, 12) : [draft.prompt.trim()];
  const first = parts[0]?.split(/[.!?\n]/)[0]?.trim() || "Yeni üretim";
  return {
    title: first.length > 64 ? `${first.slice(0, 62)}…` : first,
    style: preset?.style ?? "Sinematik", aspectRatio: draft.aspectRatio, budget,
    genre: GENRES.some((item) => item.id === draft.genre) ? draft.genre : "", look: draft.look, brief: direction,
    shots: parts.map((prompt, index) => ({ id: String(index + 1).padStart(2, "0"), sceneTitle: parts.length > 1 ? `Çekim ${index + 1}` : first.slice(0, 120), durationSec: draft.duration, visualSummary: prompt, cameraMovement: CAMERA_MOVES.find((item) => item.id === draft.camera)?.label ?? "Sabit kadraj", aiPrompt: prompt, audioCues: "", voiceoverOrText: "" })),
  };
}
