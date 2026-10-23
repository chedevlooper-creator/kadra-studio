import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { characterCreateSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string }> };
/** Adds a character; shots that mention one of its aliases are linked to it. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => { const { revision, ...input } = await readBody(request, characterCreateSchema); return json({ project: await repository.addCharacter((await context.params).id, revision, input) }, 201); }, true);
}
