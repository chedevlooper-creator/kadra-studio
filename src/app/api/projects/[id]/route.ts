import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { revisionBodySchema, updateProjectSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) { return api(request, async () => json({ project: await repository.getProject((await context.params).id) })); }
export async function PATCH(request: Request, context: Context) { return api(request, async () => json({ project: await repository.updateProject((await context.params).id, await readBody(request, updateProjectSchema)) }), true); }
export async function DELETE(request: Request, context: Context) {
  return api(request, async () => { const { revision } = await readBody(request, revisionBodySchema); await repository.deleteProject((await context.params).id, revision); return json({ deleted: true }); }, true);
}
