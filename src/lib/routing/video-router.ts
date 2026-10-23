import { CAMERA_MOVES, type CameraMoveId } from "../cinema";
import type { GmiModelInfo } from "../providers/gmi";
import type { AspectRatio, QualityTier } from "../types";

export interface VideoRequest { prompt: string; imageUrl: string; duration: number; aspectRatio: AspectRatio; seed: number; camera?: CameraMoveId }

export interface VideoModelSpec {
  id: string;
  label: string;
  /** Initial, unmeasured quality grade (1–4) used only to filter by tier. */
  quality: number;
  /** Model-side prompt character budget; the compiler keeps the style/negative tail inside it. */
  maxPrompt: number;
  durations: number[];
  aspectRatios: AspectRatio[] | "any";
  priceKey: string;
  payload(request: VideoRequest): Record<string, unknown>;
}

const range = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => from + index);

/** Image-to-video models whose GMI request schema has been read and mapped. Others are never routed to. */
export const VIDEO_MODELS: VideoModelSpec[] = [
  { id: "veo-3.1-lite-generate-001", label: "Veo 3.1 Lite", quality: 2, maxPrompt: 1_900, durations: [4, 6, 8], aspectRatios: ["16:9", "9:16"], priceKey: "720p",
    payload: ({ prompt, imageUrl, duration, aspectRatio, seed }) => ({ prompt, image: imageUrl, durationSeconds: duration, aspectRatio, resolution: "720p", generateAudio: false, personGeneration: "allow_adult", seed }) },
  { id: "Minimax-Hailuo-2.3-Fast", label: "Hailuo 2.3 Fast", quality: 2, maxPrompt: 1_900, durations: [6, 10], aspectRatios: "any", priceKey: "768p",
    // Hailuo reads its own bracketed camera commands at the start of the prompt.
    payload: ({ prompt, imageUrl, duration, camera }) => ({ prompt: camera ? `${CAMERA_MOVES.find((move) => move.id === camera)!.hailuo} ${prompt}` : prompt, first_frame_image: imageUrl, duration, resolution: "768P", prompt_optimizer: true }) },
  { id: "seedance-2-0-fast-260128", label: "Seedance 2.0 Fast", quality: 2, maxPrompt: 1_900, durations: range(4, 12), aspectRatios: ["16:9", "9:16", "1:1"], priceKey: "720p",
    payload: ({ prompt, imageUrl, duration, aspectRatio, seed }) => ({ prompt, first_frame: imageUrl, duration, resolution: "720p", ratio: aspectRatio, generate_audio: false, watermark: false, seed }) },
  { id: "wan2.6-i2v", label: "Wan 2.6", quality: 2, maxPrompt: 1_900, durations: [5, 10, 15], aspectRatios: "any", priceKey: "720p",
    payload: ({ prompt, imageUrl, duration, seed }) => ({ prompt, img_url: imageUrl, resolution: "720P", duration, shot_type: "single", audio: false, watermark: false, seed }) },
  { id: "kling-v2-5-turbo", label: "Kling 2.5 Turbo", quality: 3, maxPrompt: 1_900, durations: [5, 10], aspectRatios: "any", priceKey: "",
    payload: ({ prompt, imageUrl, duration }) => ({ prompt, image: imageUrl, duration: String(duration), mode: "pro" }) },
  { id: "veo-3.1-fast-generate-001", label: "Veo 3.1 Fast", quality: 3, maxPrompt: 1_900, durations: [4, 6, 8], aspectRatios: ["16:9", "9:16"], priceKey: "720p",
    payload: ({ prompt, imageUrl, duration, aspectRatio, seed }) => ({ prompt, image: imageUrl, durationSeconds: duration, aspectRatio, resolution: "720p", generateAudio: false, personGeneration: "allow_adult", seed }) },
  { id: "kling-v3-image-to-video", label: "Kling 3.0", quality: 4, maxPrompt: 1_900, durations: range(3, 15), aspectRatios: "any", priceKey: "",
    payload: ({ prompt, imageUrl, duration }) => ({ prompt, image: imageUrl, duration: String(duration), sound: "off", mode: "std" }) },
];

export const TIER_MIN_QUALITY: Record<QualityTier, number> = { economy: 1, balanced: 3, best: 4 };
export const TIER_LABEL: Record<QualityTier, string> = { economy: "Ekonomik", balanced: "Dengeli", best: "En iyi" };

export interface PriceRule { perSecond: number | null; perRequest: number | null }

/** True when every field and enum value in these payloads exists in GMI's live parameter schema and no required field is missing. */
export function payloadsMatch(info: GmiModelInfo, payloads: Record<string, unknown>[]): boolean {
  if (!info.parameters?.length) return true;
  const params = new Map(info.parameters.map((param) => [param.name, param]));
  for (const payload of payloads) {
    for (const [name, value] of Object.entries(payload)) {
      const spec = params.get(name);
      if (!spec) return false;
      if (spec.options?.length && !spec.options.some((option) => option.value === value)) return false;
    }
    for (const spec of params.values()) if (spec.required && !(spec.name in payload)) return false;
  }
  return true;
}

/**
 * Verifies that every field and enum value Kadra sends for this model matches GMI's live parameter schema.
 * If GMI changes an enum casing (e.g. "720p" -> "720P") or adds a required field, the model is excluded before spending money.
 */
export function schemaMatches(info: GmiModelInfo, model: VideoModelSpec): boolean {
  const ratios: AspectRatio[] = model.aspectRatios === "any" ? ["16:9", "9:16", "1:1"] : model.aspectRatios;
  return payloadsMatch(info, model.durations.flatMap((duration) => ratios.map((aspectRatio) => model.payload({ prompt: "x", imageUrl: "https://example.com/a.jpg", duration, aspectRatio, seed: 1 }))));
}

/**
 * Reads GMI's live price for the resolution Kadra requests. Where GMI's numbers disagree
 * (structured price vs. human-written details), the higher one wins so a budget is never underestimated.
 */
export function priceRule(info: GmiModelInfo, priceKey: string, model?: VideoModelSpec): PriceRule | null {
  if (!info.price_info || (info.status && info.status !== "active") || (model && !schemaMatches(info, model))) return null;
  let rate: number | null = null;
  const chart = info.price_info.price_chart?.rates;
  if (chart) {
    const row = chart[priceKey];
    const value = row?.false ?? row?.true;
    if (typeof value !== "number") return null;
    rate = value / 1_000_000;
  } else if (typeof info.price_info.price === "number") {
    rate = info.price_info.price / 1_000_000;
  }
  if (rate === null || !Number.isFinite(rate) || rate <= 0) return null;
  if (priceKey) {
    const stated = (info.pricing_details ?? "").match(new RegExp(`${priceKey}[^$\\n]*\\$([0-9]+(?:\\.[0-9]+)?)`, "i"));
    if (stated) rate = Math.max(rate, Number(stated[1]));
  }
  return info.price_info.unit === "request" ? { perSecond: null, perRequest: rate } : { perSecond: rate, perRequest: null };
}

export interface Candidate { id: string; label: string; quality: number; billedSeconds: number; estimate: number }

const round = (value: number) => Math.round(value * 10_000) / 10_000;

/** Every model that can make this shot at a known price, cheapest first (ties: higher quality first). */
export function candidatesFor(duration: number, aspectRatio: AspectRatio, prices: ReadonlyMap<string, PriceRule>): Candidate[] {
  return VIDEO_MODELS.flatMap((model) => {
    const price = prices.get(model.id);
    if (!price || (model.aspectRatios !== "any" && !model.aspectRatios.includes(aspectRatio))) return [];
    // The shortest clip that covers the shot; longer shots get the longest clip and hold its last frame.
    const billedSeconds = model.durations.find((value) => value >= duration) ?? model.durations[model.durations.length - 1];
    const estimate = price.perSecond !== null ? price.perSecond * billedSeconds : price.perRequest!;
    return [{ id: model.id, label: model.label, quality: model.quality, billedSeconds, estimate: round(estimate) }];
  }).sort((a, b) => a.estimate - b.estimate || b.quality - a.quality);
}

export type RouteResult =
  | { ok: true; choice: Candidate; reason: string; eligible: Candidate[] }
  | { ok: false; reason: string };

export function chooseVideoModel({ duration, aspectRatio, tier, override }: { duration: number; aspectRatio: AspectRatio; tier: QualityTier; override: string | null }, prices: ReadonlyMap<string, PriceRule>): RouteResult {
  const all = candidatesFor(duration, aspectRatio, prices);
  if (override) {
    const chosen = all.find((candidate) => candidate.id === override);
    if (!chosen) return { ok: false, reason: "Seçtiğin model bu çekim için şu an kullanılamıyor (kadraj oranı, durum veya fiyat bilgisi uygun değil)." };
    const cheapest = all[0];
    const note = cheapest.id === chosen.id ? "Bu çekim için zaten en ucuz model." : `En ucuz seçenek ${cheapest.label} (${cheapest.estimate.toFixed(2)} $) olurdu.`;
    return { ok: true, choice: chosen, reason: `Senin seçimin. ${note}`, eligible: all };
  }
  const eligible = all.filter((candidate) => candidate.quality >= TIER_MIN_QUALITY[tier]);
  if (!eligible.length) return { ok: false, reason: `${TIER_LABEL[tier]} seviyesinde bu çekime uygun, fiyatı bilinen bir model yok.` };
  return { ok: true, choice: eligible[0], reason: `${TIER_LABEL[tier]} seviyesinde ${duration} sn ve ${aspectRatio} için uygun ${eligible.length} model arasında en ucuzu.`, eligible };
}
