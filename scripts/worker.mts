// Optional standalone worker (e.g. with KADRA_WORKER=off on the web server). The web server already runs one by default.
try { process.loadEnvFile(".env.local"); } catch { /* Keys may come from the environment instead. */ }

delete process.env.KADRA_WORKER;
const { ensureProductionWorker } = await import("../src/lib/production/runtime.ts");
const worker = ensureProductionWorker();
if (!worker) {
  console.error("KADRA_WORKER=off olduğu için çalışan başlatılmadı.");
  process.exit(1);
}
console.log("Kadra üretim çalışanı başladı. Ücretsiz NVIDIA ve yerel FFmpeg adımlarını işler.");
const stop = () => { worker.stop(); process.exit(0); };
process.once("SIGINT", stop);
process.once("SIGTERM", stop);
