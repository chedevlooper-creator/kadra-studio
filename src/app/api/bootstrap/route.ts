import { api, json } from "@/lib/http";
import { repository } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export async function GET(request: Request) { return api(request, async () => json(await repository.getBootstrap())); }
