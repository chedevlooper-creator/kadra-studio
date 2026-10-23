import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { characterReviewSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; cid: string }> };
/** The user's final word on a character sheet. */
export async function POST(request: Request, context: Context) {
  return api(request, async () => { const { id, cid } = await context.params; const { revision, action, attemptId } = await readBody(request, characterReviewSchema); return json({ project: await repository.reviewCharacterSheet(id, revision, cid, action, attemptId ?? null) }); }, true);
}
