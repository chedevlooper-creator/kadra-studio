import { api, json, readBody } from "@/lib/http";
import { wakeProductionWorker } from "@/lib/production/runtime";
import { repository } from "@/lib/store";
import { idempotencySchema, parseInput, repairRevertSchema, repairSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
/** The live price of one region repair, for the user to approve before anything is sent. */
export async function GET(request: Request, context: Context) {
  return api(request, async () => json({ estimate: await repository.estimateRepair((await context.params).id) }));
}
/** Starts a paid repair of one marked region; the approved price is its ceiling. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const body = await readBody(request, repairSchema);
    const key = parseInput(idempotencySchema, request.headers.get("idempotency-key"));
    const { revision, ...input } = body;
    const project = await repository.startRepair((await context.params).id, revision, key, input);
    wakeProductionWorker();
    return json({ project });
  }, true);
}
/** Undoes a frame's last repair. */
export async function DELETE(request: Request, context: Context) {
  return api(request, async () => {
    const body = await readBody(request, repairRevertSchema);
    return json({ project: await repository.revertRepair((await context.params).id, body.revision, body.sceneId) });
  }, true);
}
