import type { GmiModelInfo } from "../providers/gmi";
import type { AspectRatio, QualityTier } from "../types";
import { payloadsMatch, TIER_LABEL, TIER_MIN_QUALITY } from "./video-router";

export interface FrameRequest { prompt: string; imageUrls: string[]; aspectRatio: AspectRatio; seed: number }

export interface FrameModelSpec {
  id: string;
  label: string;
  /** Kadra's own 1–5 rating of how well the model keeps faces and sets from its references. */
  quality: number;
  maxReferences: number;
  /** Model-side prompt character budget; the compiler keeps the style/negative tail inside it. */
  maxPrompt: number;
  payload(request: FrameRequest): Record<string, unknown>;
}

const RATIOS: AspectRatio[] = ["16:9", "9:16", "1:1"];

/** Image models that draw a scene frame (with or without reference images: character sheets, location plates, the previous shot). */
export const FRAME_MODELS: FrameModelSpec[] = [
  { id: "hy-image-v3.5-preview", label: "Hunyuan Image 3.5", quality: 2, maxReferences: 5, maxPrompt: 2_000,
    payload: ({ prompt, imageUrls, aspectRatio, seed }) => ({ prompt, ...(imageUrls.length ? { image: imageUrls } : {}), size: { "16:9": "1920x1080", "9:16": "1080x1920", "1:1": "1024x1024" }[aspectRatio], seed: Math.max(1, seed) }) },
  { id: "gemini-3.1-flash-lite-image", label: "Nano Banana 2 Lite", quality: 2, maxReferences: 14, maxPrompt: 2_000,
    payload: ({ prompt, imageUrls, aspectRatio }) => ({ prompt, ...(imageUrls.length ? { image: imageUrls } : {}), aspect_ratio: aspectRatio, image_output_format: "png" }) },
  { id: "seedream-5.0-lite", label: "Seedream 5.0 Lite", quality: 3, maxReferences: 14, maxPrompt: 2_000,
    payload: ({ prompt, imageUrls, aspectRatio }) => ({ prompt, ...(imageUrls.length ? { image: imageUrls } : {}), size: { "16:9": "4096x2304", "9:16": "2304x4096", "1:1": "3072x3072" }[aspectRatio], output_format: "jpeg", watermark: false }) },
  { id: "gemini-nano-banana-2.1", label: "Nano Banana 2.1", quality: 4, maxReferences: 14, maxPrompt: 2_000,
    payload: ({ prompt, imageUrls, aspectRatio }) => ({ prompt, ...(imageUrls.length ? { image: imageUrls } : {}), image_size: "1K", aspect_ratio: aspectRatio, thinking: "medium", image_output_format: "png" }) },
];

export const frameModel = (id: string) => FRAME_MODELS.find((model) => model.id === id) ?? null;

/**
 * GMI's live per-image price for a frame model, or null when it must not be offered: inactive, unpriced, or its
 * schema no longer matches what Kadra sends. A price stated in the details (e.g. "1K=$0.0336") wins when higher.
 */
export function framePrice(info: GmiModelInfo, model: FrameModelSpec): number | null {
  if ((info.status && info.status !== "active") || !info.price_info) return null;
  const payloads = RATIOS.map((aspectRatio) => model.payload({ prompt: "x", imageUrls: ["https://example.com/a.jpg"], aspectRatio, seed: 1 }));
  if (!payloadsMatch(info, payloads)) return null;
  const structured = typeof info.price_info.price === "number" ? info.price_info.price / 1_000_000 : 0;
  const stated = Number((info.pricing_details ?? "").match(/1K\s*=\s*\$([0-9.]+)/i)?.[1] ?? 0);
  const price = Math.max(structured, stated);
  return price > 0 ? Math.round(price * 10_000) / 10_000 : null;
}

export interface FrameCandidate { id: string; label: string; quality: number; estimate: number }
export type FrameRoute = { ok: true; choice: FrameCandidate; reason: string; eligible: FrameCandidate[] } | { ok: false; reason: string };

/** The cheapest frame model that meets the tier and takes this many references; a pinned model is honoured and its extra cost stated. */
export function chooseFrameModel({ references, tier, override }: { references: number; tier: QualityTier; override: string | null }, prices: ReadonlyMap<string, number>): FrameRoute {
  const all = FRAME_MODELS.flatMap((model) => {
    const estimate = prices.get(model.id);
    return estimate && model.maxReferences >= references ? [{ id: model.id, label: model.label, quality: model.quality, estimate }] : [];
  }).sort((a, b) => a.estimate - b.estimate || b.quality - a.quality);
  if (override) {
    const chosen = all.find((candidate) => candidate.id === override);
    if (!chosen) return { ok: false, reason: "Seçtiğin kare modeli şu an kullanılamıyor ya da bu kadar referans görseli almıyor." };
    const cheapest = all[0];
    return { ok: true, choice: chosen, reason: `Senin seçimin. ${cheapest.id === chosen.id ? "Zaten en ucuz model." : `En ucuz seçenek ${cheapest.label} (${cheapest.estimate.toFixed(3)} $) olurdu.`}`, eligible: all };
  }
  const eligible = all.filter((candidate) => candidate.quality >= TIER_MIN_QUALITY[tier]);
  if (!eligible.length) return { ok: false, reason: references > 0 ? `${TIER_LABEL[tier]} seviyesinde ${references} referans görseli alan, fiyatı bilinen bir kare modeli yok.` : `${TIER_LABEL[tier]} seviyesinde fiyatı bilinen bir kare modeli yok.` };
  return { ok: true, choice: eligible[0], reason: references > 0 ? `${TIER_LABEL[tier]} seviyesinde ${references} referans görseli alan ${eligible.length} model arasında en ucuzu.` : `${TIER_LABEL[tier]} seviyesinde uygun ${eligible.length} kare modeli arasında en ucuzu.`, eligible };
}
