/** Resumes unfinished productions as soon as the server starts. */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs" || process.env.NEXT_PHASE === "phase-production-build") return;
  const { ensureProductionWorker } = await import("./lib/production/runtime");
  ensureProductionWorker();
}
