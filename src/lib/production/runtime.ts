import {
  deepseekConfigured,
  enhanceCharacterWithDeepSeek,
  enhanceRepairWithDeepSeek,
  enhanceShotsWithDeepSeek,
  judgeSheetWithDeepSeek,
  reviewImageWithDeepSeek,
} from "../providers/deepseek";
import { downloadMedia, getRequest, gmiConfigured, submitRequest, uploadImage } from "../providers/gmi";
import { downloadMedia as downloadHiggsfieldMedia, getRequest as getHiggsfieldRequest, higgsfieldConfigured, submitRequest as submitHiggsfieldRequest, uploadImage as uploadHiggsfieldImage } from "../providers/higgsfield";
import { generateFluxImage, judgeCharacterSheet, nvidiaConfigured, reviewImage } from "../providers/nvidia";
import { VIDEO_MODELS } from "../routing/video-router";
import { publicDirectory, repository } from "../store";
import { createProductionWorker } from "./worker";

type Worker = ReturnType<typeof createProductionWorker>;
const KEY = Symbol.for("kadra.productionWorker");
const PROVIDERS = Symbol.for("kadra.productionProviders");

const providers = {
  deepseekConfigured, enhanceCharacterWithDeepSeek, enhanceRepairWithDeepSeek, enhanceShotsWithDeepSeek, judgeSheetWithDeepSeek, reviewImageWithDeepSeek,
  downloadMedia, getRequest, gmiConfigured, submitRequest, uploadImage,
  downloadHiggsfieldMedia, getHiggsfieldRequest, higgsfieldConfigured, submitHiggsfieldRequest, uploadHiggsfieldImage,
  generateFluxImage, judgeCharacterSheet, nvidiaConfigured, reviewImage,
};
const BUILT_BY = Symbol.for("kadra.productionWorker.builtBy");
const registry = globalThis as typeof globalThis & { [KEY]?: Worker; [PROVIDERS]?: typeof providers; [BUILT_BY]?: object };
// Identifies this evaluation of the module; a worker built by an older evaluation holds an older repository and schema.
const generation = {};
// The worker outlives code reloads in the dev server. Every evaluation of this module installs the current provider
// code, and the worker looks it up at each call, so a provider fix (e.g. an upload header) applies without a restart.
registry[PROVIDERS] = providers;
const live = () => registry[PROVIDERS] ?? providers;

let uploadChain: Promise<unknown> = Promise.resolve();
async function pacedUpload(image: Buffer, type: "jpg" | "png"): Promise<string> {
  const run = uploadChain.then(async () => {
    for (let attempt = 0; attempt < 5; attempt += 1) {
      if (attempt > 0) await new Promise((resolve) => setTimeout(resolve, 1_200 * attempt));
      try {
        const url = await live().uploadImage(image, type);
        await new Promise((resolve) => setTimeout(resolve, 650));
        return url;
      } catch (error) {
        if (attempt === 4 || !(error instanceof Error) || !/429|SlowDown|hız sınırı|yüklenemedi/i.test(error.message)) throw error;
      }
    }
    throw new Error("GMI yüklemesi tamamlanamadı.");
  });
  uploadChain = run.catch(() => undefined);
  return run;
}

/** One background loop per server process; leases in the store keep separate processes from doubling work. */
export function ensureProductionWorker(): Worker | null {
  if (process.env.KADRA_WORKER === "off") return null;
  if (registry[KEY] && registry[BUILT_BY] !== generation) { registry[KEY].stop(); registry[KEY] = undefined; }
  if (!registry[KEY]) {
    registry[BUILT_BY] = generation;
    registry[KEY] = createProductionWorker({
      repository,
      publicDirectory,
      paidOnly: true,
      concurrency: 12,
      pollIntervalMs: 2_500,
      imageEngine: () => {
        const p = live();
        if (!p.nvidiaConfigured()) return null;
        return {
          generate: (request) => live().generateFluxImage(request),
          review: (input) => { const q = live(); return q.deepseekConfigured() ? q.reviewImageWithDeepSeek(input).catch(() => q.reviewImage(input)) : q.reviewImage(input); },
        };
      },
      videoEngine: (model) => {
        const p = live();
        const spec = VIDEO_MODELS.find((item) => item.id === model);
        if (spec?.provider === "Higgsfield") return p.higgsfieldConfigured() ? {
          upload: (image, type) => p.uploadHiggsfieldImage(image, type),
          submit: (id, payload) => p.submitHiggsfieldRequest(id, payload),
          status: (requestId) => p.getHiggsfieldRequest(requestId),
          download: (url) => p.downloadHiggsfieldMedia(url),
        } : null;
        return p.gmiConfigured() ? {
          upload: (image, type) => pacedUpload(image, type),
          submit: (id, payload) => p.submitRequest(id, payload),
          status: (requestId) => p.getRequest(requestId),
          download: (url) => p.downloadMedia(url),
        } : null;
      },
      sheetJudge: () => {
        const p = live();
        if (p.deepseekConfigured()) return (input) => p.judgeSheetWithDeepSeek(input).catch((error) => { if (p.nvidiaConfigured()) return p.judgeCharacterSheet(input); throw error; });
        return p.nvidiaConfigured() ? (input) => live().judgeCharacterSheet(input) : null;
      },
      promptEnhancer: () => live().deepseekConfigured()
        ? {
          enhanceScene: (...args: Parameters<typeof enhanceShotsWithDeepSeek>) => live().enhanceShotsWithDeepSeek(...args),
          enhanceCharacter: (...args: Parameters<typeof enhanceCharacterWithDeepSeek>) => live().enhanceCharacterWithDeepSeek(...args),
          enhanceRepair: (...args: Parameters<typeof enhanceRepairWithDeepSeek>) => live().enhanceRepairWithDeepSeek(...args),
        }
        : null,
    });
    registry[KEY].start();
  }
  return registry[KEY];
}

export function wakeProductionWorker() {
  ensureProductionWorker()?.wake();
}
