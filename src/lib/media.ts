import path from "node:path";
import { AppError } from "./validation";

export const MEDIA_FILE = /^[a-zA-Z0-9][a-zA-Z0-9_-]{0,120}\.(jpg|png|mp4|mp3|m4a|wav|aac)$/;
export const MEDIA_TYPES: Record<string, string> = { jpg: "image/jpeg", png: "image/png", mp4: "video/mp4", mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", aac: "audio/aac" };

export function mediaUrl(projectId: string, file: string): string {
  return `/api/projects/${projectId}/media/${file}`;
}

export function projectMediaDirectory(mediaDirectory: string, projectId: string): string {
  return path.join(mediaDirectory, projectId);
}

/** Maps a stored image URL (bundled reference or generated media) to a file on disk; anything else is rejected. */
export function resolveImageFile(url: string, roots: { publicDirectory: string; mediaDirectory: string }): string {
  const bundled = url.match(/^\/images\/([a-zA-Z0-9_-]+\.(?:jpg|png))$/);
  if (bundled) return path.join(roots.publicDirectory, "images", bundled[1]);
  const generated = url.match(/^\/api\/projects\/([a-zA-Z0-9][a-zA-Z0-9_-]{0,79})\/media\/([^/]+)$/);
  if (generated && MEDIA_FILE.test(generated[2])) return path.join(roots.mediaDirectory, generated[1], generated[2]);
  throw new AppError(400, "Çekim görseli tanınmayan bir konumda.");
}
