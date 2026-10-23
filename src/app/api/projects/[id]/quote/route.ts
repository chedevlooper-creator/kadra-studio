import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { quoteSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
/** Prices the shots chosen for paid motion with live rates. Nothing is generated or charged here. */
export async function POST(request: Request, context: Context) { return api(request, async () => json({ project: await repository.prepareQuote((await context.params).id, await readBody(request, quoteSchema)) }), true); }
