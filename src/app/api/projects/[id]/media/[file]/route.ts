import { open, stat, type FileHandle } from "node:fs/promises";
import path from "node:path";
import { api } from "@/lib/http";
import { MEDIA_FILE, MEDIA_TYPES, projectMediaDirectory } from "@/lib/media";
import { repository } from "@/lib/store";
import { AppError, idSchema, parseInput } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; file: string }> };

/**
 * A byte range of a file as a web stream. Players cancel range requests all the time while seeking; this stream
 * stops reading and closes the file when that happens instead of writing into a stream that is already closed.
 */
function fileStream(location: string, start: number, end: number): ReadableStream<Uint8Array> {
  let handle: FileHandle | null = null;
  let position = start;
  let cancelled = false;
  const finish = async () => { const open = handle; handle = null; await open?.close(); };
  return new ReadableStream<Uint8Array>({
    async start() { handle = await open(location, "r"); },
    async pull(controller) {
      const size = Math.min(256 * 1024, end - position + 1);
      if (size <= 0 || !handle) { await finish(); if (!cancelled) controller.close(); return; }
      const buffer = new Uint8Array(size);
      const { bytesRead } = await handle.read(buffer, 0, size, position);
      if (cancelled) return;
      if (bytesRead === 0) { await finish(); controller.close(); return; }
      position += bytesRead;
      controller.enqueue(buffer.subarray(0, bytesRead));
    },
    async cancel() { cancelled = true; await finish(); },
  });
}

/** Serves generated images and films. Video players need byte ranges to seek. */
export async function GET(request: Request, context: Context) {
  return api(request, async () => {
    const { id, file } = await context.params;
    parseInput(idSchema, id);
    if (!MEDIA_FILE.test(file)) throw new AppError(404, "Dosya bulunamadı.");
    const location = path.join(projectMediaDirectory(repository.mediaDirectory, id), file);
    const info = await stat(location).catch(() => null);
    if (!info?.isFile()) throw new AppError(404, "Dosya bulunamadı.");
    const headers: Record<string, string> = { "Content-Type": MEDIA_TYPES[file.split(".").pop()!], "Accept-Ranges": "bytes", "Cache-Control": "private, max-age=31536000, immutable", "X-Content-Type-Options": "nosniff" };
    const range = request.headers.get("range")?.match(/^bytes=(\d*)-(\d*)$/);
    if (range && (range[1] || range[2])) {
      const start = range[1] ? Number(range[1]) : Math.max(0, info.size - Number(range[2]));
      const end = range[1] && range[2] ? Math.min(Number(range[2]), info.size - 1) : info.size - 1;
      if (start > end || start >= info.size) return new Response(null, { status: 416, headers: { "Content-Range": `bytes */${info.size}` } });
      return new Response(fileStream(location, start, end), { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) } });
    }
    return new Response(fileStream(location, 0, info.size - 1), { headers: { ...headers, "Content-Length": String(info.size) } });
  });
}
