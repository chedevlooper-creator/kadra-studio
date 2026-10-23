import { rm } from "node:fs/promises";
import path from "node:path";
import { api, json, readBody } from "@/lib/http";
import { projectMediaDirectory } from "@/lib/media";
import { repository } from "@/lib/store";
import { characterUpdateSchema, revisionBodySchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; cid: string }> };
export async function PATCH(request: Request, context: Context) {
  return api(request, async () => { const { id, cid } = await context.params; const { revision, ...input } = await readBody(request, characterUpdateSchema); return json({ project: await repository.updateCharacter(id, revision, cid, input) }); }, true);
}
export async function DELETE(request: Request, context: Context) {
  return api(request, async () => {
    const { id, cid } = await context.params;
    const { revision } = await readBody(request, revisionBodySchema);
    const { project, files } = await repository.deleteCharacter(id, revision, cid);
    const directory = projectMediaDirectory(repository.mediaDirectory, id);
    await Promise.all(files.map((file) => rm(path.join(directory, path.basename(file)), { force: true })));
    return json({ project });
  }, true);
}
