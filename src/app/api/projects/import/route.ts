import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { importStoryboardSchema } from "@/lib/validation";
export const runtime = "nodejs";
/** Creates a project from an exported storyboard (Flow prototype JSON). Nothing is generated. */
export async function POST(request: Request) { return api(request, async () => json({ project: await repository.importStoryboard(await readBody(request, importStoryboardSchema)) }, 201), true); }
