import { api, json, readBody } from "@/lib/http";
import { wakeProductionWorker } from "@/lib/production/runtime";
import { repository } from "@/lib/store";
import { idempotencySchema, parseInput, runSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const body = await readBody(request, runSchema); const key = parseInput(idempotencySchema, request.headers.get("idempotency-key"));
    const project = await repository.startRun((await context.params).id, body.revision, key, body.quoteId ?? null, { ...(body.prepareCharacters !== undefined ? { prepareCharacters: body.prepareCharacters } : {}), ...(body.target ? { target: body.target } : {}), ...(body.reuseImages !== undefined ? { reuseImages: body.reuseImages } : {}), ...(body.regenerate ? { regenerate: true } : {}) });
    wakeProductionWorker();
    return json({ project });
  }, true);
}
