import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { revisionBodySchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { return api(request, async () => { const { revision } = await readBody(request, revisionBodySchema); return json({ project: await repository.cancelRun((await context.params).id, revision) }); }, true); }
