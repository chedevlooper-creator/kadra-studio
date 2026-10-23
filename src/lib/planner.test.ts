import assert from "node:assert/strict";
import test from "node:test";
import { parseScript, planScenes, scenesFromStoryboard, scriptFromStoryboard } from "./planner";

test("Turkish, intro, final and repeated numbered labels preserve every shot", () => {
  const script = "Intro: Gökyüzü açılır.\n\nİlk sahne: Yolcu ilerler.\nSahne 1: Çocuk durur.\nSahne 1: Kapı açılır.\n1. Sahne: Rüzgâr eser.\nFİNAL: Ufuk aydınlanır.\nSahne 2: Sonraki güne geçilir.";
  const segments = parseScript(script);
  assert.equal(segments.length, 7);
  assert.deepEqual(segments.map((segment) => segment.content), ["Gökyüzü açılır.", "Yolcu ilerler.", "Çocuk durur.", "Kapı açılır.", "Rüzgâr eser.", "Ufuk aydınlanır.", "Sonraki güne geçilir."]);
  assert.equal(segments[1].title, "İlk sahne");
});

test("unlabeled paragraphs become scenes without sentence truncation", () => {
  const description = "Güneş kaybolur. " + "Ayrıntı korunur. ".repeat(100);
  const segments = parseScript(`${description}\n\nBir yolcu patikaya adım atar.\nSis yavaşça dağılır.`);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].content, description.trim());
  assert.match(segments[1].content, /Sis yavaşça dağılır/);
});

test("preamble and blank label content remain in the plan", () => {
  const segments = parseScript("Filmin bütününde yumuşak ışık kullan.\nİlk sahne:\nDağ görünür.\nFinal:");
  assert.equal(segments.length, 3);
  assert.equal(segments[0].content, "Filmin bütününde yumuşak ışık kullan.");
  assert.equal(segments[2].content, "Final");
});

test("heuristic planner marks reference images and picks the paid production method", () => {
  const scenes = planScenes("Sahne 1: Yolcu patikada ilerler.\nFinal: Yazı kartı: Yol devam eder.", "Sinematik", "/images/mountains.jpg");
  assert.equal(scenes[0].kind, "video");
  assert.equal(scenes[1].kind, "title");
  assert.equal(scenes[0].image, "/images/mountains.jpg");
  assert.ok(scenes.every((scene) => scene.status === "draft" && scene.imageSource === "reference" && scene.notes.some((note) => note.includes("dil modeli kullanılmadı"))));
  assert.equal(scenes[0].model, "GMI video · yapay zekâ");
  assert.equal(scenes[1].model, "Yazı kartı");
  assert.match(scenes[1].modelReason, /eksiksiz/);
});

test("parser rejects bounds rather than silently dropping shots", () => {
  assert.throws(() => parseScript("kısa"), /en az 10/);
  assert.throws(() => parseScript("x".repeat(30_001)), /30.000/);
  assert.throws(() => parseScript(Array.from({ length: 41 }, (_, index) => `Sahne ${index + 1}: Ufuk görünür.`).join("\n")), /en fazla 40/);
});

const storyboard = [
  { id: "0A", sceneId: "SAHNE 0", sceneTitle: "AÇILIŞ", durationSec: 6, timeRange: "0:00–0:06", visualSummary: "Gece, karlı bozkır yolu. Bir cip durur.", cameraMovement: "Geniş plan, yavaş dolly-in", aiPrompt: "Night road. Style: stylized 3D animation, 16:9.", audioCues: "Rüzgâr.", voiceoverOrText: "Alt köşe, daktilo: «Gehi-Çu, 1996»" },
  { id: "F2", sceneId: "FİNAL", sceneTitle: "KAPANIŞ", durationSec: 16, visualSummary: "Sisli dağlar.", aiPrompt: "Misty mountains.", voiceoverOrText: "—" },
  { id: "F3", sceneId: "FİNAL", sceneTitle: "KAPANIŞ", durationSec: 3, visualSummary: "Siyah ekran, kanal logosu ve yasal hiciv uyarısı.", cameraMovement: "Sabit grafik kadrajı.", aiPrompt: "Pure black screen with typography.", voiceoverOrText: "«Hiciv eseridir; kişilerin kamuya açık eylem ve tutumlarını eleştirir.»" },
];

test("storyboard shots keep their prompts, timings and notes; black-screen cards become drawn title cards", () => {
  const scenes = scenesFromStoryboard(storyboard, "/images/mountains.jpg");
  assert.deepEqual(scenes.map((scene) => [scene.code, scene.kind, scene.duration]), [["0A", "video", 6], ["F2", "video", 16], ["F3", "title", 3]]);
  assert.equal(scenes[0].title, "0A · Gece, karlı bozkır yolu.");
  assert.equal(scenes[0].group, "SAHNE 0 · AÇILIŞ");
  assert.equal(scenes[0].prompt, storyboard[0].aiPrompt);
  assert.equal(scenes[0].screenText, "Alt köşe, daktilo: «Gehi-Çu, 1996»");
  assert.equal(scenes[0].audioNotes, "Rüzgâr.");
  assert.equal(scenes[1].screenText, "", "a dash means no text");
  assert.equal(scenes[1].camera, "Yavaş yaklaşma");
  assert.equal(scenes[2].description, "Hiciv eseridir; kişilerin kamuya açık eylem ve tutumlarını eleştirir.");
  const script = scriptFromStoryboard(storyboard);
  assert.match(script, /^Sahne 0 – 0A: Gece/);
  assert.equal(parseScript(script).length, 3, "the generated script re-plans into the same number of shots");
});
