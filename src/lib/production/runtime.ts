import { deepseekConfigured, judgeSheetWithDeepSeek, reviewImageWithDeepSeek } from "../providers/deepseek";
import { downloadMedia, getRequest, gmiConfigured, submitRequest, uploadImage } from "../providers/gmi";
import { generateFluxImage, judgeCharacterSheet, nvidiaConfigured, reviewImage } from "../providers/nvidia";
import { publicDirectory, repository } from "../store";
import { createProductionWorker } from "./worker";

type Worker = ReturnType<typeof createProductionWorker>;
const KEY = Symbol.for("kadra.productionWorker");

/** One background loop per server process; leases in the store keep separate processes from doubling work. */
export function ensureProductionWorker(): Worker | null {
  if (process.env.KADRA_WORKER === "off") return null;
  const registry = globalThis as typeof globalThis & { [KEY]?: Worker };
  if (!registry[KEY]) {
    registry[KEY] = createProductionWorker({
      repository,
      publicDirectory,
      imageEngine: () => {
        if (!nvidiaConfigured()) return null;
        return {
          generate: generateFluxImage,
          review: (input) => deepseekConfigured() ? reviewImageWithDeepSeek(input).catch(() => reviewImage(input)) : reviewImage(input),
        };
      },
      videoEngine: () => gmiConfigured() ? { upload: uploadImage, submit: submitRequest, status: getRequest, download: downloadMedia } : null,
      sheetJudge: () => {
        if (deepseekConfigured()) return (input) => judgeSheetWithDeepSeek(input).catch((error) => { if (nvidiaConfigured()) return judgeCharacterSheet(input); throw error; });
        return nvidiaConfigured() ? judgeCharacterSheet : null;
      },
    });
    registry[KEY].start();
  }
  return registry[KEY];
}

export function wakeProductionWorker() {
  ensureProductionWorker()?.wake();
}
