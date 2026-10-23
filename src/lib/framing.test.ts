import assert from "node:assert/strict";
import test from "node:test";
import { looksLikeScene, resolveFraming, wantsPhoto } from "./framing";

const entry = (appearance: string, style = "", framing: "auto" | "sheet" | "free" = "auto", kind: "person" | "place" = "person") => ({ kind, framing, style, appearance });

test("a photographic style is recognised in English and Turkish, a cartoon style is not", () => {
  assert.equal(wantsPhoto("Master photographic portrait of a commander, photorealistic rendering, 8k"), true);
  assert.equal(wantsPhoto("Fotogerçekçi anıt dağlar"), true);
  assert.equal(wantsPhoto("Gerçekçi"), true);
  assert.equal(wantsPhoto("Stylized 3D animated caricature, navy suit"), false);
  assert.equal(wantsPhoto("Anime"), false);
});

test("entries that describe monuments, creatures in a landscape or groups are drawn as written; people get a plain sheet", () => {
  // The descriptions below are the ones that came back as single cartoon heads on a grey background.
  assert.equal(resolveFraming(entry("Monumental granite rock sculptures carved into Caucasus mountain peaks, photorealistic weathered granite, snow")), "free");
  assert.equal(resolveFraming(entry("Kafkas dağ zirvesine oyulmuş modern, sakin ve sert bakışlı taş yüz")), "free");
  assert.equal(resolveFraming(entry("Colossal mythical wolf made of glowing spirit light, rising behind mountain ridges")), "free");
  assert.equal(resolveFraming(entry("Gri bıyıklı, siyah astrahan papaklı, kamuflaj üniformalı lider. Dignified commander posture", "Master photographic portrait")), "sheet");
  assert.equal(resolveFraming(entry("Gür sakal, pembe yanaklar, oyuncak ayısına sarılan, kamuflajlı dev balon", "Stylized 3D caricature")), "sheet", "\"dev\" alone does not make a scene");
  assert.equal(looksLikeScene("tiny red fez, suit, golden pump"), false);
});

test("an explicit choice always wins, and a place is always composed as a whole", () => {
  assert.equal(resolveFraming(entry("mountain monument", "", "sheet")), "sheet");
  assert.equal(resolveFraming(entry("a young man in a coat", "", "free")), "free");
  assert.equal(resolveFraming(entry("small harbour", "", "sheet", "place")), "free");
});
