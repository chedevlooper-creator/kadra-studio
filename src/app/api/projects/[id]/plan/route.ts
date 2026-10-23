import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { planSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const maxDuration = 180;
type Context = { params: Promise<{ id: string }> };
export async function POST(request: Request, context: Context) { return api(request, async () => { const { revision, planner } = await readBody(request, planSchema); return json({ project: await repository.planProject((await context.params).id, revision, planner) }); }, true); }
