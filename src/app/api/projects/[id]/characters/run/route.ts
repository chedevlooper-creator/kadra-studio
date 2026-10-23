import { api, json, readBody } from "@/lib/http";
import { wakeProductionWorker } from "@/lib/production/runtime";
import { repository } from "@/lib/store";
import { characterRunSchema, idempotencySchema, parseInput } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
/** { preview: true } only prices the run; otherwise it starts with the price the user approved as its ceiling. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const { id } = await context.params;
    const body = await readBody(request, characterRunSchema);
    const runOptions = { ...(body.engine ? { engine: body.engine } : {}), ...(body.budget !== undefined ? { budget: body.budget } : {}) };
    if (body.preview) return json({ estimate: await repository.estimateCharacterRun(id, body.characterIds, runOptions) });
    const key = parseInput(idempotencySchema, request.headers.get("idempotency-key"));
    const project = await repository.startCharacterRun(id, body.revision, key, body.characterIds, body.maxCost, runOptions);
    wakeProductionWorker();
    return json({ project });
  }, true);
}
