import assert from "node:assert/strict";
import test from "node:test";
import { imageSizeFor, nvidiaConfigured, parseAiPlan, parseReview, parseSheetVerdict } from "./nvidia";

test("AI plan parsing tolerates prose and code fences and normalizes fields", () => {
  const plan = parseAiPlan("Plan:\n```json\n{\"characters\":[{\"id\":\"c1\",\"name\":\"Ada\",\"appearance\":\"red hair\"}],\"shots\":[{\"title\":\"Açılış\",\"kind\":\"VIDEO\",\"duration_seconds\":\"30\",\"image_prompt\":\"a valley\"},{\"title\":\"Son\",\"kind\":\"title\",\"on_screen_text\":\"Bitti.\"},{\"title\":\"Kısa\",\"kind\":\"video|title\",\"duration_seconds\":1}]}\n```");
  assert.equal(plan.characters[0].name, "Ada");
  assert.deepEqual(plan.shots.map((shot) => shot.kind), ["video", "title", "video"]);
  assert.deepEqual(plan.shots.map((shot) => shot.duration_seconds), [12, 5, 3]);
  assert.equal(plan.shots[1].on_screen_text, "Bitti.");
  assert.equal(plan.shots[0].narration, "");
});

test("AI plan parsing rejects answers without shots", () => {
  assert.throws(() => parseAiPlan("Üzgünüm, yardımcı olamam."), /JSON bulunamadı/);
  assert.throws(() => parseAiPlan("{\"characters\":[],\"shots\":[]}"), /beklenen yapıda/);
});

test("review parsing defaults to accepting unreadable answers", () => {
  assert.deepEqual(parseReview("{\"uygun\": false, \"not\": \"Fener yok.\"}"), { ok: false, note: "Fener yok.", issues: [] });
  assert.equal(parseReview("evet uygun").ok, true);
});

test("located issues are read as 0–1 boxes; unusable boxes become unlocated", () => {
  const review = parseReview(JSON.stringify({ uygun: false, not: "El bozuk.", sorunlar: [
    { sorun: "Sol elde altı parmak", duzeltme: "Redraw the left hand with five fingers", kutu: [100, 500, 300, 900] },
    { sorun: "Stil fotoğraf gibi", duzeltme: "", kutu: null },
    { sorun: "Ters kutu", duzeltme: "x", kutu: [800, 800, 200, 200] },
    { sorun: "Kesirli kutu", duzeltme: "y", kutu: [0.5, 0.1, 0.7, 0.3] },
    { kutu: [0, 0, 10, 10] },
  ] }));
  assert.equal(review.ok, false);
  assert.deepEqual(review.issues, [
    { problem: "Sol elde altı parmak", fix: "Redraw the left hand with five fingers", box: [0.1, 0.5, 0.3, 0.9] },
    { problem: "Stil fotoğraf gibi", fix: "", box: null },
    { problem: "Ters kutu", fix: "x", box: null },
    { problem: "Kesirli kutu", fix: "y", box: [0.5, 0.1, 0.7, 0.3] },
  ]);
  assert.deepEqual(parseReview(JSON.stringify({ uygun: true, not: "", sorunlar: [{ sorun: "küçük yazı", kutu: [0, 0, 100, 100] }] })).issues, [{ problem: "küçük yazı", fix: "", box: [0, 0, 0.1, 0.1] }], "a passing frame keeps noted issues as repair suggestions");
  const verdict = parseSheetVerdict(JSON.stringify({ stil: 4, ozellikler: 4, poz: 4, temizlik: 2, not: "parmak", sorunlar: [{ sorun: "parmak", duzeltme: "fix the fingers", kutu: [600, 600, 800, 900] }] }));
  assert.equal(verdict.ok, false);
  assert.deepEqual(verdict.issues?.[0].box, [0.6, 0.6, 0.8, 0.9]);
});

test("keys and image sizes follow the provider's rules", () => {
  assert.equal(nvidiaConfigured({ NVIDIA_API_KEY: "nvapi-abcdefghijklmnopqrstuvwxyz" }), true);
  assert.equal(nvidiaConfigured({ NVIDIA_API_KEY: "" }), false);
  assert.equal(nvidiaConfigured({ NVIDIA_API_KEY: "sk-wrong-provider-key-123456" }), false);
  for (const ratio of ["16:9", "9:16", "1:1"] as const) {
    const { width, height } = imageSizeFor(ratio);
    for (const side of [width, height]) assert.ok(side >= 512 && side <= 1568 && side % 16 === 0);
  }
});
