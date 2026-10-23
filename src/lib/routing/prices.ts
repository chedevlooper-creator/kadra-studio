import { REPAIR_MODEL } from "../production/reuse";
import { getModelInfo, type GmiModelInfo } from "../providers/gmi";
import { ProviderError } from "../providers/nvidia";
import { GMI_VOICES, VOICE_MODEL } from "../voices";
import { FRAME_MODELS, framePrice } from "./frame-router";
import { priceRule, VIDEO_MODELS, type PriceRule } from "./video-router";

const TTL_MS = 10 * 60_000;
let cache: { at: number; prices: Map<string, PriceRule> } | null = null;

/** Live GMI prices for every routable model; a model whose price cannot be read is simply not offered. */
export async function loadVideoPrices(): Promise<ReadonlyMap<string, PriceRule>> {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.prices;
  const entries = await Promise.all(VIDEO_MODELS.map(async (model) => {
    try {
      const rule = priceRule(await getModelInfo(model.id), model.priceKey, model);
      return rule ? [model.id, rule] as const : null;
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) throw error;
      return null;
    }
  }));
  const prices = new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  if (!prices.size) throw new ProviderError("Hiçbir video modelinin fiyatı okunamadı.", true);
  cache = { at: Date.now(), prices };
  return prices;
}

let referenceCache: { at: number; price: number } | null = null;

/** Live price of one 1K reference-guided image on Nano Banana 2.1; the higher of GMI's two published figures. */
export async function loadReferenceImagePrice(): Promise<number> {
  if (referenceCache && Date.now() - referenceCache.at < TTL_MS) return referenceCache.price;
  const info = await getModelInfo("gemini-nano-banana-2.1");
  if (info.status && info.status !== "active") throw new ProviderError("Nano Banana 2.1 şu an GMI'da kapalı.", true);
  const structured = typeof info.price_info?.price === "number" ? info.price_info.price / 1_000_000 : 0;
  const stated = Number((info.pricing_details ?? "").match(/1K\s*=\s*\$([0-9.]+)/i)?.[1] ?? 0);
  const price = Math.max(structured, stated);
  if (!(price > 0)) throw new ProviderError("Nano Banana 2.1 fiyatı okunamadı.", true);
  referenceCache = { at: Date.now(), price };
  return price;
}

let repairCache: { at: number; price: number } | null = null;

/**
 * Live price of one region repair, as an upper bound. GMI pre-charges the medium-quality output by pixel count, the
 * input image, and the prompt; Kadra sends about one megapixel (at most ~1.06 MP), so the per-1024² medium price gets
 * a 5% margin, plus one input image and a prompt allowance. GMI's own estimates were 0.0205 $ (1360×768) and
 * 0.0260 $ (1024×1024) — the latter above the listed base price, which is why the listed price alone is not trusted.
 */
export function repairPriceRule(info: GmiModelInfo): number {
  const details = info.pricing_details ?? "";
  const medium = Number(details.match(/medium\s*\$([0-9.]+)/i)?.[1] ?? 0);
  const perImage = Number(details.match(/up to \$([0-9.]+)\s*\/\s*image/i)?.[1] ?? 0);
  const listed = typeof info.price_info?.price === "number" ? info.price_info.price / 1_000_000 : 0;
  const computed = medium > 0 ? medium * 1.05 + perImage + 0.001 : 0;
  return Math.round(Math.max(listed, computed) * 10_000) / 10_000;
}

export async function loadRepairPrice(): Promise<number> {
  if (repairCache && Date.now() - repairCache.at < TTL_MS) return repairCache.price;
  const info = await getModelInfo(REPAIR_MODEL);
  if (info.status && info.status !== "active") throw new ProviderError("Bölgesel onarım modeli şu an GMI'da kapalı.", true);
  if (info.parameters?.length && !info.parameters.some((parameter) => parameter.name === "mask")) throw new ProviderError("Onarım modeli artık maske kabul etmiyor; onarım kapatıldı.", false);
  const price = repairPriceRule(info);
  if (!(price > 0)) throw new ProviderError("Onarım fiyatı okunamadı.", true);
  repairCache = { at: Date.now(), price };
  return price;
}

let frameCache: { at: number; prices: Map<string, number> } | null = null;

/** Live per-image prices of the frame models; a model whose price or schema cannot be confirmed is simply not offered. */
export async function loadFramePrices(): Promise<ReadonlyMap<string, number>> {
  if (frameCache && Date.now() - frameCache.at < TTL_MS) return frameCache.prices;
  const entries = await Promise.all(FRAME_MODELS.map(async (model) => {
    try {
      const price = framePrice(await getModelInfo(model.id), model);
      return price === null ? null : [model.id, price] as const;
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) throw error;
      return null;
    }
  }));
  const prices = new Map(entries.filter((entry): entry is NonNullable<typeof entry> => entry !== null));
  if (!prices.size) throw new ProviderError("Hiçbir kare modelinin fiyatı okunamadı.", true);
  frameCache = { at: Date.now(), prices };
  return prices;
}

let voiceCache: { at: number; price: number } | null = null;

/** Live price of paid narration in USD per 1,000 characters; refused when the Turkish voices Kadra offers are gone. */
export async function loadVoicePrice(): Promise<number> {
  if (voiceCache && Date.now() - voiceCache.at < TTL_MS) return voiceCache.price;
  const info = await getModelInfo(VOICE_MODEL);
  if (info.status && info.status !== "active") throw new ProviderError("Dış ses modeli şu an GMI'da kapalı.", true);
  const voices = info.parameters?.find((parameter) => parameter.name === "voice_id")?.options?.map((option) => option.value);
  if (voices && !GMI_VOICES.every((voice) => voices.includes(voice.id))) throw new ProviderError("GMI'daki Türkçe sesler değişmiş; dış ses kapatıldı.", false);
  const price = typeof info.price_info?.price === "number" ? info.price_info.price / 1_000_000 : 0;
  if (!(price > 0)) throw new ProviderError("Dış ses fiyatı okunamadı.", true);
  voiceCache = { at: Date.now(), price };
  return price;
}
