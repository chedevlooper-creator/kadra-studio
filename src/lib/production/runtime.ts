import {
  deepseekConfigured,
  enhanceCharacterWithDeepSeek,
  enhanceRepairWithDeepSeek,
  enhanceShotsWithDeepSeek,
  judgeSheetWithDeepSeek,
  reviewImageWithDeepSeek,
} from "../providers/deepseek";
import { downloadMedia, getRequest, gmiConfigured, submitRequest, uploadImage } from "../providers/gmi";
import { generateFluxImage, judgeCharacterSheet, nvidiaConfigured, reviewImage } from "../providers/nvidia";
import { publicDirectory, repository } from "../store";
import { createProductionWorker } from "./worker";

type Worker = ReturnType<typeof createProductionWorker>;
const KEY = Symbol.for("kadra.productionWorker");
const PROVIDERS = Symbol.for("kadra.productionProviders");

const providers = {
  deepseekConfigured, enhanceCharacterWithDeepSeek, enhanceRepairWithDeepSeek, enhanceShotsWithDeepSeek, judgeSheetWithDeepSeek, reviewImageWithDeepSeek,
  downloadMedia, getRequest, gmiConfigured, submitRequest, uploadImage,
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
      imageEngine: () => {
        const p = live();
        if (!p.nvidiaConfigured()) return null;
        return {
          generate: (request) => live().generateFluxImage(request),
          review: (input) => { const q = live(); return q.deepseekConfigured() ? q.reviewImageWithDeepSeek(input).catch(() => q.reviewImage(input)) : q.reviewImage(input); },
        };
      },
      videoEngine: () => live().gmiConfigured() ? {
        upload: (image, type) => live().uploadImage(image, type),
        submit: (model, payload) => live().submitRequest(model, payload),
        status: (requestId) => live().getRequest(requestId),
        download: (url) => live().downloadMedia(url),
      } : null,
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
