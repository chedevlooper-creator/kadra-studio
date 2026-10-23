import { api } from "@/lib/http";
import { repository } from "@/lib/store";
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return api(request, async () => {
    const project = await repository.getProject((await context.params).id);
    const generated = project.scenes.filter((scene) => scene.imageSource === "generated").length;
    const document = { format: "kadra-project-plan", version: 2, exportedAt: new Date().toISOString(), planner: project.planner, generatedImages: generated, film: project.output, realCost: 0, notice: "Bu dosya düzenlenebilir çekim planıdır. Görsel ve film dosyaları uygulamanın yerel medya klasöründe saklanır; bağlantılar yalnızca bu bilgisayarda çalışır.", project };
    return new Response(JSON.stringify(document, null, 2), { headers: { "Content-Type": "application/json; charset=utf-8", "Content-Disposition": `attachment; filename="kadra-${project.id}.json"`, "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
