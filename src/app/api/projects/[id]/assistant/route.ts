import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { assistantApplySchema, assistantAskSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };

/** Asks the director assistant for a proposal. Nothing is saved and nothing is paid for. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const body = await readBody(request, assistantAskSchema);
    return json({ proposal: await repository.proposeEdits((await context.params).id, body.revision, body.message) });
  }, true);
}

/** Applies a proposal the user accepted, atomically. */
export async function PUT(request: Request, context: Context) {
  return api(request, async () => {
    const body = await readBody(request, assistantApplySchema);
    return json({ project: await repository.applyEdits((await context.params).id, body.revision, { scenes: body.scenes, project: body.project ?? null }) });
  }, true);
}
