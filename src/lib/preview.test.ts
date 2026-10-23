import assert from "node:assert/strict";
import test from "node:test";
import type { Character, Project, Scene } from "./types";
import { buildShotPreview } from "./preview";

const scene = {
  id: "s1", order: 1, title: "Sabah", description: "Ada vadiye bakar.", prompt: "Ada looks at the misty valley at dawn", promptEn: "", promptEnSource: "", motionPrompt: "",
  duration: 5, camera: "Yavaş yaklaşma", model: "", modelReason: "", kind: "video", status: "draft", image: "/images/mountains.jpg",
  imageSource: "reference", review: null, frameKey: "", frameModel: "", emotions: {}, repair: null, characterIds: ["c1"], narration: "", notes: [],
  motion: "ai", videoModel: null, code: "", group: "", audioNotes: "", screenText: "",
} as Scene;

const approved: Character = {
  id: "c1", framing: "auto", kind: "person", name: "Ada", appearance: "kırmızı pelerin", aliases: ["Ada"], style: "", reference: null,
  sheet: {
    status: "approved", chosen: "a1", note: "",
    attempts: [{ id: "a1", runId: "r1", url: "/api/projects/p/media/sheet-a1.jpg", at: new Date().toISOString(), engine: "nano-banana", verdict: null, cost: 0 }],
  },
};

function quoted(characters: Character[]): Project {
  return {
    id: "p", title: "T", description: "", script: "", style: "Sinematik", aspectRatio: "16:9", genre: "", brief: "", look: "none", duration: 5,
    budget: 5, status: "planned", cover: "", createdAt: "", updatedAt: "", revision: 1, planner: "heuristic", planNote: "",
    characters, scenes: [scene], run: null, output: null, quality: "economy", ledger: [], music: null,
    narration: { engine: "off", voice: "", speed: 1, volume: 1 }, clips: [], frameModel: null, isExample: false,
    quote: {
      target: "film",
      id: "q", createdAt: "", expiresAt: "", quality: "economy", fingerprint: "", total: 0.16, budget: 5, committed: 0, remaining: 4.84, withinBudget: true,
      errors: [], warnings: [], reused: [],
      lines: [
        { sceneId: "s1", title: "Sabah", kind: "image", modelId: "gemini-nano-banana-2.1", modelLabel: "Nano Banana 2.1", billedSeconds: 0, estimate: 0.04, reason: "", alternative: null, priciest: null },
        { sceneId: "s1", title: "Sabah", kind: "video", modelId: "veo-3.1-lite-generate-001", modelLabel: "Veo 3.1 Lite", billedSeconds: 6, estimate: 0.12, reason: "", alternative: null, priciest: null },
      ],
    },
  } as Project;
}

test("the paid-shot preview shows the exact prompts and ordered references", () => {
  const [line] = buildShotPreview(quoted([approved]));
  assert.equal(line.frame?.modelLabel, "Nano Banana 2.1");
  assert.deepEqual(line.frame?.references.map((reference) => reference.name), ["Ada"]);
  assert.match(line.frame?.prompt ?? "", /Reference image 1 is the approved character sheet for Ada/);
  assert.equal(line.video?.modelLabel, "Veo 3.1 Lite");
  assert.match(line.video?.prompt ?? "", /Ada looks at the misty valley/);
  assert.deepEqual(line.warnings, []);
});

test("a linked character without an approved sheet is flagged before spending", () => {
  const pending = { ...approved, sheet: { status: "none" as const, attempts: [], chosen: null, note: "" } };
  const [line] = buildShotPreview(quoted([pending]));
  assert.deepEqual(line.frame?.references, []);
  assert.ok(line.warnings.some((warning) => /onaylı sayfa yok/.test(warning)));
});
