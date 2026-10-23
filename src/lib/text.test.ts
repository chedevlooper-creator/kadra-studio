import assert from "node:assert/strict";
import test from "node:test";
import { cameraMotion, layoutTitle } from "./production/ffmpeg";
import { titleCardText } from "./text";

test("title cards keep only the on-screen text", () => {
  assert.equal(titleCardText("Final: Yazı kartı: Bazı yollar, bizi kendimize götürür."), "Bazı yollar, bizi kendimize götürür.");
  assert.equal(titleCardText("Gökyüzü pembeden mora döner. Ekranda yazı: \"Her son, başka bir başlangıç.\""), "Her son, başka bir başlangıç.");
  assert.equal(titleCardText("Yol devam eder."), "Yol devam eder.");
});

test("camera notes map to Ken Burns moves", () => {
  assert.equal(cameraMotion("Yavaş yaklaşma"), "in");
  assert.equal(cameraMotion("Yavaş uzaklaşma"), "out");
  assert.equal(cameraMotion("Kamera vadinin üzerinden ağır ağır yükselir"), "up");
  assert.equal(cameraMotion("Sağa kaydırma"), "right");
  assert.equal(cameraMotion("SABİT KADRAJ"), "still");
  assert.equal(cameraMotion("geniş açı"), "in");
});

test("hyphenated storyboard camera notes are understood", () => {
  assert.equal(cameraMotion("Tilt-up, ruhu takip eden yavaş vinç hareketi."), "up");
  assert.equal(cameraMotion("Hızlı pull-back → epik geniş plan"), "out");
  assert.equal(cameraMotion("Çok yavaş dolly-out"), "out");
  assert.equal(cameraMotion("crane-up"), "up");
  assert.equal(cameraMotion("zoom-out"), "out");
  assert.equal(cameraMotion("Geniş plan, yavaş dolly-in"), "in");
  assert.equal(cameraMotion("Hızlı yaklaşma"), "crash");
  assert.equal(cameraMotion("crash zoom on the face"), "crash");
  assert.equal(cameraMotion("El kamerası, koşarken"), "handheld");
});

test("long title text wraps and shrinks to fit the frame", () => {
  const short = layoutTitle("Yol devam eder.", 1280, 720);
  assert.deepEqual(short.lines, ["Yol devam eder."]);
  const long = layoutTitle("kelime ".repeat(120), 720, 1280);
  assert.ok(long.lines.length <= 8 && long.fontSize < short.fontSize);
});
