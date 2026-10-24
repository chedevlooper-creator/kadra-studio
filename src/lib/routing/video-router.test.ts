import assert from "node:assert/strict";
import test from "node:test";
import type { AspectRatio, QualityTier } from "../types";
import { repairPriceRule } from "./prices";
import { candidatesFor, chooseVideoModel, priceRule, schemaMatches, TIER_MIN_QUALITY, VIDEO_MODELS, type PriceRule } from "./video-router";

/** Prices as GMI reported them when this router was written (USD per second). */
const samplePrices = new Map<string, PriceRule>([
  ["veo-3.1-lite-generate-001", { perSecond: 0.03, perRequest: null }],
  ["Minimax-Hailuo-2.3-Fast", { perSecond: 0.032, perRequest: null }],
  ["seedance-2-0-fast-260128", { perSecond: 0.12, perRequest: null }],
  ["wan2.6-i2v", { perSecond: 0.15, perRequest: null }],
  ["kling-v2-5-turbo", { perSecond: 0.07, perRequest: null }],
  ["veo-3.1-fast-generate-001", { perSecond: 0.1, perRequest: null }],
  ["kling-v3-image-to-video", { perSecond: 0.168, perRequest: null }],
  ["hf-seedance-2.5-image-to-video", { perSecond: 0.206, perRequest: null }],
]);

test("live price parsing uses the requested tier and never the lower of two conflicting numbers", () => {
  const veo = { model: "veo", status: "active", price_info: { price: 50_000, unit: "second", price_chart: { rates: { "720p": { false: 30_000, true: 50_000 }, "1080p": { false: 50_000, true: 80_000 } } } }, pricing_details: "$0.05 per second" };
  assert.deepEqual(priceRule(veo, "720p"), { perSecond: 0.03, perRequest: null });
  const seedance = { model: "s", status: "active", price_info: { price: 56_000, unit: "second" }, pricing_details: "Per second: 480p=$0.56, 720p=$0.12" };
  assert.equal(priceRule(seedance, "720p")?.perSecond, 0.12);
  assert.equal(priceRule({ ...seedance, status: "inactive" }, "720p"), null, "inactive models are never offered");
  assert.equal(priceRule({ model: "x", status: "active", price_info: { unit: "second" } }, ""), null, "unknown price means not offered");
  assert.equal(priceRule({ model: "x", status: "active", price_info: { price: 20_000, unit: "request" } }, "")?.perRequest, 0.02);
});

test("billing uses the shortest clip that covers the shot and skips unsupported aspect ratios", () => {
  const five = candidatesFor(5, "16:9", samplePrices);
  assert.equal(five[0].id, "veo-3.1-lite-generate-001");
  assert.equal(five[0].billedSeconds, 6);
  assert.equal(five[0].estimate, 0.18);
  const square = candidatesFor(5, "1:1", samplePrices);
  assert.ok(square.every((candidate) => !candidate.id.startsWith("veo")), "Veo has no 1:1 output");
  assert.equal(square[0].id, "Minimax-Hailuo-2.3-Fast");
});

test("each tier picks its cheapest eligible model; a pinned model is honoured and its extra cost is stated", () => {
  const pick = (tier: QualityTier) => chooseVideoModel({ duration: 5, aspectRatio: "16:9", tier, override: null }, samplePrices);
  const economy = pick("economy"); const balanced = pick("balanced"); const best = pick("best");
  assert.ok(economy.ok && economy.choice.id === "veo-3.1-lite-generate-001");
  assert.ok(balanced.ok && balanced.choice.id === "kling-v2-5-turbo" && balanced.choice.estimate === 0.35);
  assert.ok(best.ok && best.choice.id === "kling-v3-image-to-video");
  const pinned = chooseVideoModel({ duration: 5, aspectRatio: "16:9", tier: "economy", override: "wan2.6-i2v" }, samplePrices);
  assert.ok(pinned.ok && pinned.choice.id === "wan2.6-i2v");
  assert.match(pinned.ok ? pinned.reason : "", /Senin seçimin\. En ucuz seçenek Veo 3\.1 Lite/);
  assert.equal(chooseVideoModel({ duration: 5, aspectRatio: "1:1", tier: "economy", override: "veo-3.1-lite-generate-001" }, samplePrices).ok, false);
  assert.equal(chooseVideoModel({ duration: 5, aspectRatio: "16:9", tier: "best", override: null }, new Map([["veo-3.1-lite-generate-001", { perSecond: 0.03, perRequest: null }]])).ok, false);
});

test("the router never pays more than the cheapest model that satisfies the shot and tier", () => {
  const ratios: AspectRatio[] = ["16:9", "9:16", "1:1"];
  const tiers: QualityTier[] = ["economy", "balanced", "best"];
  for (let duration = 2; duration <= 16; duration += 1) for (const aspectRatio of ratios) for (const tier of tiers) {
    const result = chooseVideoModel({ duration, aspectRatio, tier, override: null }, samplePrices);
    const eligible = VIDEO_MODELS.filter((model) => model.quality >= TIER_MIN_QUALITY[tier] && model.durations.some((seconds) => seconds >= duration) && (model.aspectRatios === "any" || model.aspectRatios.includes(aspectRatio)));
    if (!eligible.length) { assert.equal(result.ok, false); continue; }
    const cheapest = Math.min(...eligible.map((model) => {
      const billed = model.durations.find((value) => value >= duration) ?? model.durations[model.durations.length - 1];
      return Math.round(samplePrices.get(model.id)!.perSecond! * billed * 10_000) / 10_000;
    }));
    assert.ok(result.ok, `${duration}s ${aspectRatio} ${tier}`);
    assert.equal(result.choice.estimate, cheapest, `${duration}s ${aspectRatio} ${tier}`);
  }
});

test("a model cannot cover a long shot by silently freezing a shorter output", () => {
  assert.ok(candidatesFor(16, "16:9", samplePrices).every((candidate) => candidate.billedSeconds >= 16));
  const route = chooseVideoModel({ duration: 20, aspectRatio: "16:9", tier: "best", override: "kling-v3-image-to-video" }, samplePrices);
  assert.equal(route.ok, false);
});

test("schemaMatches validates live GMI parameter names and enum casing against our payload adapter", () => {
  const veo = VIDEO_MODELS.find((model) => model.id === "veo-3.1-lite-generate-001")!;
  const baseParams = [
    { name: "image", required: true },
    { name: "prompt", required: true },
    { name: "durationSeconds", options: [{ value: 4 }, { value: 6 }, { value: 8 }] },
    { name: "aspectRatio", options: [{ value: "16:9" }, { value: "9:16" }] },
    { name: "resolution", options: [{ value: "720p" }, { value: "1080p" }] },
    { name: "generateAudio", options: [{ value: false }, { value: true }] },
    { name: "personGeneration", options: [{ value: "allow_adult" }] },
    { name: "seed" },
  ];
  assert.equal(schemaMatches({ model: veo.id, parameters: baseParams }, veo), true);
  assert.equal(schemaMatches({ model: veo.id, parameters: baseParams.map((p) => p.name === "resolution" ? { name: "resolution", options: [{ value: "720P" }] } : p) }, veo), false, "casing mismatch in live enum disables the model before submission");
  assert.equal(schemaMatches({ model: veo.id, parameters: [...baseParams, { name: "newRequiredParam", required: true }] }, veo), false, "unknown required parameter disables the model");
});

test("the repair price is an upper bound built from GMI's pricing parts, never below what GMI pre-charges", () => {
  const info = { model: "gpt-image-2.5-sunburst-edit", status: "active", price_info: { price: 25_538, unit: "image" },
    pricing_details: "Token-based; the pre-charge is the final price. Output at 1024x1024 per image: low $0.0059, medium $0.0132, high $0.0527. Other sizes scale with pixel count. Each reference image adds up to 1536 input tokens ($8/M, i.e. up to $0.0123/image); multiple images add up." };
  const price = repairPriceRule(info);
  for (const charged of [0.020483, 0.025973]) assert.ok(price >= charged, `${price} ≥ GMI's pre-charge ${charged}`);
  assert.ok(price < 0.03);
  assert.equal(repairPriceRule({ model: "x", price_info: { price: 25_538, unit: "image" } }), 0.0255, "without details the listed price is used");
});

test("Hailuo gets its own camera command; other models carry the move in the prompt", () => {
  const hailuo = VIDEO_MODELS.find((model) => model.id === "Minimax-Hailuo-2.3-Fast")!;
  assert.match(String(hailuo.payload({ prompt: "A lighthouse", imageUrl: "https://x/a.jpg", duration: 6, aspectRatio: "16:9", seed: 1, camera: "left" }).prompt), /^\[Pan left\] A lighthouse/);
  assert.equal(hailuo.payload({ prompt: "A lighthouse", imageUrl: "https://x/a.jpg", duration: 6, aspectRatio: "16:9", seed: 1 }).prompt, "A lighthouse");
});
