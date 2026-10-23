import assert from "node:assert/strict";
import test from "node:test";
import type { Character, Project, Scene } from "../types";
import { compileImagePrompt, compileScenePrompt, compileVideoPrompt } from "./prompts";

const character: Character = {
  id: "c1", kind: "person", name: "Ada", appearance: "kırmızı pelerin", aliases: ["Ada"], style: "", reference: null,
  sheet: { status: "approved", attempts: [], chosen: null, note: "" },
};
const place: Character = {
  id: "m1", kind: "place", name: "Vadi", appearance: "sisli yeşil vadi", aliases: ["Vadi"], style: "", reference: null,
  sheet: { status: "approved", attempts: [], chosen: null, note: "" },
};
const project = { characters: [character, place], style: "Sinematik", genre: "" } as Pick<Project, "characters" | "style"> & { genre?: string };
const scene = {
  id: "s1", order: 1, title: "Sabah", description: "Ada vadiye bakar.", prompt: "Ada looks at the misty valley at dawn", motionPrompt: "",
  duration: 5, camera: "Yavaş yaklaşma", model: "", modelReason: "", kind: "video", status: "draft", image: "/images/mountains.jpg",
  imageSource: "reference", review: null, frameKey: "", frameModel: "", repair: null, characterIds: ["c1", "m1"], narration: "", notes: [],
  motion: "ai", videoModel: null, code: "", group: "", audioNotes: "", screenText: "",
} as Scene;

test("a referenced frame prompt labels each image and keeps the negative tail", () => {
  const compiled = compileScenePrompt(project, scene, [character, place], true, 5_000);
  assert.match(compiled.prompt, /Reference image 1 is the approved character sheet for Ada/);
  assert.match(compiled.prompt, /Reference image 2 is the approved location plate for Vadi/);
  assert.match(compiled.prompt, /Reference image 3 is the previous shot/);
  assert.match(compiled.prompt, /no text, no captions, no watermark$/);
  assert.equal(compiled.truncated, false);
});

test("truncation drops optional sections and preserves the no-text tail", () => {
  const long = { ...scene, prompt: "crowded street ".repeat(400) } as Scene;
  const compiled = compileScenePrompt(project, long, [character], false, 600);
  assert.equal(compiled.truncated, true);
  assert.ok(compiled.prompt.length <= 600, "the prompt fits the model budget");
  assert.ok(compiled.prompt.endsWith("no text, no captions, no watermark"), "the negative tail survives");
});

test("video and text-only frame prompts respect their own budgets", () => {
  const long = { ...scene, prompt: "a very long action description ".repeat(300) } as Scene;
  const video = compileVideoPrompt(project, long, 500);
  assert.equal(video.truncated, true);
  assert.ok(video.prompt.length <= 500);
  assert.ok(video.prompt.endsWith("no text, no subtitles, no watermark"));
  const frame = compileImagePrompt(project, long, 400);
  assert.ok(frame.prompt.length <= 400);
  assert.ok(frame.prompt.endsWith("no text, no captions, no watermark"));
});
