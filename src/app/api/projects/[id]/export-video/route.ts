import { readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { api, json, readBody } from "@/lib/http";
import { exportFormatOf } from "@/lib/formats";
import { mediaUrl, projectMediaDirectory } from "@/lib/media";
import { exportFilm } from "@/lib/production/ffmpeg";
import { repository } from "@/lib/store";
import { AppError, exportVideoSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

/** Re-frames the finished film for another screen (vertical, square, Full HD). The result is cached beside the film. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const { id } = await context.params;
    const body = await readBody(request, exportVideoSchema);
    const project = await repository.getProject(id);
    if (!project.output) throw new AppError(400, "Önce filmi üret; biçim dönüşümü hazır filmden yapılır.");
    const format = exportFormatOf(body.format)!;
    const directory = projectMediaDirectory(repository.mediaDirectory, id);
    const film = project.output.url.split("/").pop()!;
    const prefix = `export-${film.replace(/\.mp4$/, "")}-`;
    const name = `${prefix}${format.id}-${body.mode}.mp4`;
    // Exports of an earlier film are stale the moment a new film exists.
    for (const file of await readdir(directory).catch(() => [] as string[])) if (file.startsWith("export-") && !file.startsWith(prefix)) await rm(path.join(directory, file), { force: true });
    const target = path.join(directory, name);
    if (!(await stat(target).then((info) => info.size > 0, () => false))) {
      const temporary = path.join(directory, `.tmp-${name}`);
      try { await exportFilm({ input: path.join(directory, film), output: temporary, width: format.width, height: format.height, mode: body.mode }); await rename(temporary, target); }
      finally { await rm(temporary, { force: true }); }
    }
    return json({ url: mediaUrl(id, name), name: `${project.title} - ${format.label}.mp4` });
  }, true);
}
