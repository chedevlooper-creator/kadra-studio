import { randomUUID } from "node:crypto";
import { mkdir, open, rm } from "node:fs/promises";
import path from "node:path";
import { api, json, readBody } from "@/lib/http";
import { projectMediaDirectory } from "@/lib/media";
import { inspectAudio } from "@/lib/production/ffmpeg";
import { changeSoundtrack } from "@/lib/production/soundtrack";
import { repository } from "@/lib/store";
import { AppError, idSchema, parseInput, revisionBodySchema, revisionSchema, soundtrackSettingsSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 120;
type Context = { params: Promise<{ id: string }> };

const MAX_BYTES = 40 * 1024 * 1024;
const EXTENSIONS: Record<string, string> = { "audio/mpeg": "mp3", "audio/mp3": "mp3", "audio/mp4": "m4a", "audio/x-m4a": "m4a", "audio/m4a": "m4a", "audio/wav": "wav", "audio/x-wav": "wav", "audio/wave": "wav", "audio/aac": "aac" };

/** Uploads a music file (raw audio body) and mixes it under the film. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const id = parseInput(idSchema, (await context.params).id);
    const url = new URL(request.url);
    const revision = parseInput(revisionSchema, Number(url.searchParams.get("revision")));
    const name = [...(url.searchParams.get("name") ?? "")].filter((character) => character >= " ").join("").slice(0, 200) || "müzik";
    const extension = EXTENSIONS[request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() ?? ""];
    if (!extension) throw new AppError(415, "MP3, M4A, WAV veya AAC biçiminde bir ses dosyası seçin.");
    const declared = Number(request.headers.get("content-length") ?? 0);
    if (declared > MAX_BYTES) throw new AppError(413, "Ses dosyası en fazla 40 MB olabilir.");
    if (!request.body) throw new AppError(400, "Ses dosyası gönderilmedi.");
    const project = await repository.getProject(id);
    const directory = projectMediaDirectory(repository.mediaDirectory, id);
    await mkdir(directory, { recursive: true });
    const file = `music-${randomUUID().slice(0, 12)}.${extension}`;
    const target = path.join(directory, file);
    const handle = await open(target, "wx", 0o600);
    let size = 0;
    try {
      const reader = request.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (chunk.done) break;
        size += chunk.value.byteLength;
        if (size > MAX_BYTES) { await reader.cancel(); throw new AppError(413, "Ses dosyası en fazla 40 MB olabilir."); }
        await handle.write(chunk.value);
      }
    } catch (error) { await handle.close(); await rm(target, { force: true }); throw error; }
    await handle.close();
    try {
      const duration = await inspectAudio(target).catch(() => { throw new AppError(400, "Dosya okunabilir bir ses içermiyor."); });
      return json({ project: await changeSoundtrack(repository, id, revision, { file, name, duration, volume: project.music?.volume ?? 0.8, offset: 0 }) });
    } catch (error) { await rm(target, { force: true }); throw error; }
  }, true);
}

/** Changes volume or start point and re-mixes the film. */
export async function PATCH(request: Request, context: Context) {
  return api(request, async () => {
    const id = parseInput(idSchema, (await context.params).id);
    const { revision, volume, offset } = await readBody(request, soundtrackSettingsSchema);
    const project = await repository.getProject(id);
    if (!project.music) throw new AppError(404, "Projede müzik yok.");
    if (offset >= project.music.duration) throw new AppError(400, "Başlangıç noktası müziğin süresinden kısa olmalı.");
    return json({ project: await changeSoundtrack(repository, id, revision, { ...project.music, volume, offset }) });
  }, true);
}

/** Removes the music; an existing film gets a silent track again. */
export async function DELETE(request: Request, context: Context) {
  return api(request, async () => {
    const id = parseInput(idSchema, (await context.params).id);
    const { revision } = await readBody(request, revisionBodySchema);
    return json({ project: await changeSoundtrack(repository, id, revision, null) });
  }, true);
}
