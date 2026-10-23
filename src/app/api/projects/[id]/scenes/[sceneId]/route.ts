import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { updateSceneSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; sceneId: string }> };
export async function PATCH(request: Request, context: Context) { return api(request, async () => { const { id, sceneId } = await context.params; const { revision, scene } = await readBody(request, updateSceneSchema); return json({ project: await repository.updateScene(id, sceneId, revision, scene) }); }, true); }
