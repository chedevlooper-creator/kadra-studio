import { createReadStream } from "node:fs";
import { stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { api } from "@/lib/http";
import { MEDIA_FILE, MEDIA_TYPES, projectMediaDirectory } from "@/lib/media";
import { repository } from "@/lib/store";
import { AppError, idSchema, parseInput } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string; file: string }> };

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
      const stream = Readable.toWeb(createReadStream(location, { start, end })) as ReadableStream;
      return new Response(stream, { status: 206, headers: { ...headers, "Content-Range": `bytes ${start}-${end}/${info.size}`, "Content-Length": String(end - start + 1) } });
    }
    return new Response(Readable.toWeb(createReadStream(location)) as ReadableStream, { headers: { ...headers, "Content-Length": String(info.size) } });
  });
}
