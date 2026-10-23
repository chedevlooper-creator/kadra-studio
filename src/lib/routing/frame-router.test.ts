import assert from "node:assert/strict";
import test from "node:test";
import { chooseFrameModel, FRAME_MODELS, framePrice } from "./frame-router";

const prices = new Map([["hy-image-v3.5-preview", 0.024], ["gemini-3.1-flash-lite-image", 0.035], ["seedream-5.0-lite", 0.035], ["gemini-nano-banana-2.1", 0.041]]);

test("each tier gets the cheapest frame model that meets it and takes enough references", () => {
  const pick = (tier: "economy" | "balanced" | "best", references = 2) => {
    const route = chooseFrameModel({ references, tier, override: null }, prices);
    return route.ok ? route.choice.id : route.reason;
  };
  assert.equal(pick("economy"), "hy-image-v3.5-preview");
  assert.equal(pick("balanced"), "seedream-5.0-lite");
  assert.equal(pick("best"), "gemini-nano-banana-2.1");
  assert.equal(pick("economy", 6), "seedream-5.0-lite", "Hunyuan takes at most five references; at the same price the better model wins");
  const pinned = chooseFrameModel({ references: 2, tier: "economy", override: "gemini-nano-banana-2.1" }, prices);
  assert.ok(pinned.ok && pinned.choice.id === "gemini-nano-banana-2.1");
  assert.match(pinned.ok ? pinned.reason : "", /En ucuz seçenek Hunyuan Image 3\.5/);
  assert.equal(chooseFrameModel({ references: 2, tier: "best", override: null }, new Map([["hy-image-v3.5-preview", 0.024]])).ok, false);
});

test("a frame model is only priced while GMI's schema still accepts what Kadra sends", () => {
  const hunyuan = FRAME_MODELS.find((model) => model.id === "hy-image-v3.5-preview")!;
  const info = { model: hunyuan.id, status: "active", price_info: { price: 24_000, unit: "image" }, parameters: [
    { name: "prompt", required: true }, { name: "image" }, { name: "seed" },
    { name: "size", options: ["", "1024x1024", "1920x1080", "1080x1920"].map((value) => ({ value })) },
  ] };
  assert.equal(framePrice(info, hunyuan), 0.024);
  assert.equal(framePrice({ ...info, parameters: info.parameters.map((param) => param.name === "size" ? { name: "size", options: [{ value: "1024x1024" }] } : param) }, hunyuan), null, "a missing size option disables the model");
  assert.equal(framePrice({ ...info, status: "inactive" }, hunyuan), null);
  const nano = FRAME_MODELS.find((model) => model.id === "gemini-nano-banana-2.1")!;
  assert.equal(framePrice({ model: nano.id, status: "active", price_info: { price: 30_000, unit: "image" }, pricing_details: "1K=$0.041" }, nano), 0.041, "the higher of two stated prices wins");
});
