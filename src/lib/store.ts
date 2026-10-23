import path from "node:path";
import { createProjectRepository } from "./projects";
import { deepseekConfigured, planWithDeepSeek } from "./providers/deepseek";
import { nvidiaConfigured, planWithNemotron, type PlanRequest } from "./providers/nvidia";
import { providerStatus } from "./providers/status";
import { loadFramePrices, loadReferenceImagePrice, loadRepairPrice, loadVideoPrices, loadVoicePrice } from "./routing/prices";

async function aiPlanner(request: PlanRequest) {
  if (deepseekConfigured()) {
    try { return await planWithDeepSeek(request); }
    catch (error) { if (!nvidiaConfigured()) throw error; }
  }
  return planWithNemotron(request);
}

/** Optional ceiling for all paid spend, in USD; unset or non-positive means no extra ceiling. */
function spendLimit(): number | null {
  const value = Number(process.env.KADRA_MAX_SPEND_USD);
  return Number.isFinite(value) && value > 0 ? value : null;
}

/** Emergency stop, read on every request so it can be flipped without a restart. */
function paymentsDisabled(): boolean {
  const value = process.env.KADRA_KILL_SWITCH?.trim().toLowerCase();
  return value === "on" || value === "1" || value === "true";
}

/** The application's single local store; tests build their own repositories instead. */
export const repository = createProjectRepository(process.env.KADRA_DATA_DIR || path.join(process.cwd(), ".data"), { providers: providerStatus, aiPlanner, videoPrices: loadVideoPrices, referenceImagePrice: loadReferenceImagePrice, repairPrice: loadRepairPrice, framePrices: loadFramePrices, voicePrice: loadVoicePrice, spendLimit, paymentsDisabled });
export const publicDirectory = path.join(process.cwd(), "public");
