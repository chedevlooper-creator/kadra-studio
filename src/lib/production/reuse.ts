import { createHash } from "node:crypto";
import { TIER_MIN_QUALITY, VIDEO_MODELS } from "../routing/video-router";
import { titleCardText } from "../text";
import type { Box, Character, ClipRecord, Project, QualityTier, ReviewIssue, Scene, SheetAttempt } from "../types";
import { imagePrompt, sceneSheetPrompt, videoPrompt } from "./prompts";

/**
 * Work that was already done is never paid for or rendered twice: every frame and clip carries a fingerprint
 * of what it was made from, and is only made again when one of those inputs changes.
 */

/** Region repairs use a masked image edit: only the transparent part of the mask may change. */
export const REPAIR_MODEL = "gpt-image-2.5-sunburst-edit";
export const REPAIR_LABEL = "GPT Image 2.5 Edit";

/** Bump when clip rendering changes so clips cached by an older renderer are made again. */
const RENDER_VERSION = 1;
const fingerprint = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex").slice(0, 16);

/** Everything a frame or clip prompt is built from at the project level; the genre is optional for older callers. */
type FrameSource = Pick<Project, "characters" | "style" | "aspectRatio"> & { genre?: string; brief?: string };

/** Approved character sheets linked to a shot so the bridge can supply their images to the frame model. */
export function approvedCharacterSheets(project: Pick<Project, "characters">, scene: Pick<Scene, "characterIds">): { character: Character; attempt: SheetAttempt; file: string }[] {
  return project.characters.flatMap((character) => {
    if (!scene.characterIds.includes(character.id) || character.sheet.status !== "approved" || !character.sheet.chosen) return [];
    const attempt = character.sheet.attempts.find((item) => item.id === character.sheet.chosen);
    const file = attempt?.url.split("/").pop();
    return attempt && file ? [{ character, attempt, file }] : [];
  });
}

/** The previous shot's frame when it shows the same place: an extra reference so lighting and props carry over. */
export function continuityFrame(project: Pick<Project, "scenes" | "characters">, scene: Scene): string | null {
  const places = new Set(project.characters.filter((item) => item.kind === "place" && scene.characterIds.includes(item.id)).map((item) => item.id));
  if (!places.size) return null;
  const shots = project.scenes.filter((item) => item.kind === "video").toSorted((a, b) => a.order - b.order);
  const previous = shots[shots.findIndex((item) => item.id === scene.id) - 1];
  return previous && previous.imageSource === "generated" && previous.characterIds.some((id) => places.has(id)) ? previous.image : null;
}

/** Fingerprints of the two ways a frame is made: free FLUX from the prompt, or paid Nano Banana from approved sheets. */
export function frameKeys(project: FrameSource, scene: Scene): { flux: string; reference: string | null } {
  const sheets = approvedCharacterSheets(project, scene);
  return {
    flux: fingerprint(["flux", imagePrompt(project, scene), project.aspectRatio]),
    reference: sheets.length ? fingerprint(["reference", sceneSheetPrompt(project, scene, sheets.map((item) => item.character)), sheets.map((item) => item.attempt.id), project.aspectRatio]) : null,
  };
}

/** A generated frame stays while nothing it was made from has changed; frames made before fingerprints are kept as they are. */
export function frameIsCurrent(project: FrameSource, scene: Scene): boolean {
  if (scene.imageSource !== "generated") return false;
  if (!scene.frameKey) return true;
  const keys = frameKeys(project, scene);
  return scene.frameKey === keys.flux || scene.frameKey === keys.reference;
}

export function cameraClipKey(project: Pick<Project, "aspectRatio">, scene: Scene): string {
  return fingerprint(["camera", RENDER_VERSION, scene.image, scene.duration, scene.camera, project.aspectRatio]);
}

export function titleClipKey(project: Pick<Project, "aspectRatio">, scene: Scene): string {
  return fingerprint(["title", RENDER_VERSION, titleCardText(scene.description), scene.duration, project.aspectRatio]);
}

/** A paid clip depends on the exact frame it animates and the motion asked for, not on which model made it. */
export function aiClipKey(project: FrameSource, scene: Scene): string {
  return fingerprint(["ai", scene.image, videoPrompt(project, scene), scene.duration, project.aspectRatio]);
}

export const clipFile = (sceneId: string, key: string) => `clip-${sceneId.slice(0, 8)}-${key}.mp4`;

const modelQuality = (model: string) => VIDEO_MODELS.find((item) => item.id === model)?.quality ?? 0;

/**
 * An earlier paid clip of this exact frame and motion. When pricing a paid run (`tier` set) it must also meet the
 * quality tier and the model the user pinned; a free run takes whichever paid clip already exists.
 */
export function reusableClip(project: FrameSource & Pick<Project, "clips">, scene: Scene, tier: QualityTier | null): ClipRecord | null {
  const key = aiClipKey(project, scene);
  return project.clips.filter((record) => record.sceneId === scene.id && record.key === key
    && (!tier || (modelQuality(record.model) >= TIER_MIN_QUALITY[tier] && (!scene.videoModel || record.model === scene.videoModel)))).at(-1) ?? null;
}

/** Paid clips are kept for every shot still in the project, the newest three per shot. */
export function keptClips(project: Pick<Project, "clips" | "scenes">): ClipRecord[] {
  const ids = new Set(project.scenes.map((scene) => scene.id));
  const counts = new Map<string, number>();
  return project.clips.toReversed().filter((record) => {
    if (!ids.has(record.sceneId)) return false;
    const seen = counts.get(record.sceneId) ?? 0;
    counts.set(record.sceneId, seen + 1);
    return seen < 3;
  }).reverse();
}

const clamp = (value: number) => Math.min(1, Math.max(0, value));

/** Grows a box on every side so the redrawn area blends past the defect's edge. */
export function padBox([x0, y0, x1, y1]: Box, pad = 0.04): Box {
  return [clamp(x0 - pad), clamp(y0 - pad), clamp(x1 + pad), clamp(y1 + pad)];
}

export const boxArea = ([x0, y0, x1, y1]: Box) => Math.max(0, x1 - x0) * Math.max(0, y1 - y0);

/**
 * The regions worth redrawing for these issues, padded. Region repair is for local defects: when the issues are not
 * located, or cover most of the image, a fresh image is the better fix and this returns nothing.
 */
export function repairRegions(issues: ReviewIssue[] | undefined): Box[] {
  const boxes = (issues ?? []).flatMap((issue) => issue.box ? [padBox(issue.box)] : []).slice(0, 4);
  if (!boxes.length || boxes.length < (issues ?? []).length) return [];
  return boxes.reduce((sum, box) => sum + boxArea(box), 0) <= 0.5 ? boxes : [];
}

const EDIT_MIN_PIXELS = 655_360;
const EDIT_MAX_PIXELS = 8_294_400;

/** The size sent to the edit model: multiples of 16, within its pixel limits, keeping the image's shape. */
export function editSize(width: number, height: number): { width: number; height: number } {
  const ratio = height / width;
  const snap = (value: number) => Math.max(16, Math.round(value / 16) * 16);
  let w = snap(width);
  let h = snap(w * ratio);
  while (w * h < EDIT_MIN_PIXELS) { w += 16; h = snap(w * ratio); }
  while (w * h > EDIT_MAX_PIXELS || w > 3840 || h > 3840) { w -= 16; h = snap(w * ratio); }
  return { width: w, height: h };
}
