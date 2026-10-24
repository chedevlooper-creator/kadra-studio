import { cameraMove } from "../cinema";
import type { VideoModelSpec } from "../routing/video-router";
import type { Project, Scene } from "../types";
import { compileVideoPrompt } from "./prompts";

type Source = Pick<Project, "characters" | "style" | "aspectRatio"> & { genre?: string; brief?: string };

/** Stable in the browser and worker; it controls variation only on models which accept seed. */
export function productionSeed(material: string): number {
  let hash = 2166136261;
  for (let index = 0; index < material.length; index++) hash = Math.imul(hash ^ material.charCodeAt(index), 16777619);
  return (hash >>> 0) % 2_147_483_646 + 1;
}

/** The preview and worker use the same model adapter, including native camera commands. */
export function buildVideoRequest(project: Source, scene: Scene, model: VideoModelSpec, imageUrl = "https://kadra.invalid/reference.png") {
  const duration = model.durations.find((value) => value >= scene.duration);
  if (duration === undefined) throw new Error(`${model.label}, ${scene.duration} saniyelik çekimi desteklemiyor. Çekimi kısaltın veya başka model seçin.`);
  const compiled = compileVideoPrompt(project, scene, model.maxPrompt);
  const seed = productionSeed(JSON.stringify([model.id, scene.id, compiled.prompt, duration, project.aspectRatio]));
  const payload = model.payload({ prompt: compiled.prompt, imageUrl, duration, aspectRatio: project.aspectRatio, seed, camera: cameraMove(scene.camera).id });
  return {
    payload,
    prompt: String(payload.prompt),
    truncated: compiled.truncated,
    provider: model.provider,
    settings: Object.fromEntries(Object.entries(payload).filter(([key, value]) => key !== "prompt" && value !== imageUrl)),
  };
}
