import { api, json, readBody } from "@/lib/http";
import { repository } from "@/lib/store";
import { createProjectSchema } from "@/lib/validation";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(request, async () => json({ projects: (await repository.getBootstrap()).projects })); }
export async function POST(request: Request) { return api(request, async () => json({ project: await repository.createProject(await readBody(request, createProjectSchema)) }, 201), true); }
