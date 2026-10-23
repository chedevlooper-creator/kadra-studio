import StudioApp from "@/components/studio-app";
import { ensureProductionWorker } from "@/lib/production/runtime";
import { repository } from "@/lib/store";

export const dynamic = "force-dynamic";

export default async function Home({ searchParams }: { searchParams: Promise<{ project?: string }> }) {
  ensureProductionWorker();
  const [bootstrap, params] = await Promise.all([repository.getBootstrap(), searchParams]);
  return <StudioApp initialData={bootstrap} initialProjectId={params.project ?? null} />;
}
