import StudioApp from "@/components/studio-app";
import { ensureProductionWorker } from "@/lib/production/runtime";
import { repository } from "@/lib/store";
import { STUDIO_VIEWS, type StudioView } from "@/lib/studio-draft";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ project?: string; view?: string; step?: string }> }) {
  ensureProductionWorker();
  const [bootstrap, params] = await Promise.all([repository.getBootstrap(), searchParams]);
  const view = STUDIO_VIEWS.includes(params.view as StudioView) ? params.view as StudioView : "explore";
  const step = ["story", "cast", "scenes", "film"].includes(params.step ?? "") ? params.step as "story" | "cast" | "scenes" | "film" : undefined;
  return <StudioApp initialData={bootstrap} initialProjectId={params.project ?? null} initialView={view} initialStep={step} />;
}
