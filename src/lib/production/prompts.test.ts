import assert from "node:assert/strict";
import test from "node:test";
import type { Character, Project, Scene } from "../types";
import { compileImagePrompt, compileScenePrompt, compileVideoPrompt } from "./prompts";

const character: Character = {
  id: "c1", framing: "auto", kind: "person", name: "Ada", appearance: "kırmızı pelerin", aliases: ["Ada"], style: "", reference: null,
  sheet: { status: "approved", attempts: [], chosen: null, note: "" },
};
const place: Character = {
  id: "m1", framing: "auto", kind: "place", name: "Vadi", appearance: "sisli yeşil vadi", aliases: ["Vadi"], style: "", reference: null,
  sheet: { status: "approved", attempts: [], chosen: null, note: "" },
};
const project = { characters: [character, place], style: "Sinematik", genre: "" } as Pick<Project, "characters" | "style"> & { genre?: string };
const scene = {
  id: "s1", order: 1, title: "Sabah", description: "Ada vadiye bakar.", prompt: "Ada looks at the misty valley at dawn", promptEn: "", promptEnSource: "", motionPrompt: "",
  duration: 5, camera: "Yavaş yaklaşma", model: "", modelReason: "", kind: "video", status: "draft", image: "/images/mountains.jpg",
  imageSource: "reference", review: null, frameKey: "", frameModel: "", emotions: {}, repair: null, characterIds: ["c1", "m1"], narration: "", notes: [],
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

test("background-enhanced English prompt (promptEn) is used while synced and invalidated on edit", () => {
  const enhanced: Scene = {
    ...scene,
    prompt: "adam dağa bakıyo sabah sisli falan",
    promptEn: "Wide 35mm cinematic shot of a lone traveller gazing at a mist-shrouded mountain peak at golden dawn, volumetric rim light",
    promptEnSource: "adam dağa bakıyo sabah sisli falan",
  };
  assert.match(compileImagePrompt(project, enhanced).prompt, /Wide 35mm cinematic shot of a lone traveller/);
  assert.doesNotMatch(compileImagePrompt(project, enhanced).prompt, /adam dağa bakıyo/);
  assert.match(compileScenePrompt(project, enhanced, [character]).prompt, /Wide 35mm cinematic shot of a lone traveller/);
  assert.match(compileVideoPrompt(project, enhanced).prompt, /Wide 35mm cinematic shot of a lone traveller/);

  const stale: Scene = { ...enhanced, prompt: "adam akşam ormanda yürüyor" };
  assert.match(compileImagePrompt(project, stale).prompt, /adam akşam ormanda yürüyor/);
});

test("the production brief and each character's emotion reach every prompt, and add nothing when empty", () => {
  const plain = compileImagePrompt(project, scene).prompt;
  const withNotes = { ...project, brief: "Siyah beyaz, yağmurlu sokaklar. Renkli neon yok." };
  const feeling = { ...scene, emotions: { c1: "afraid", m1: "happy", nobody: "angry" } };
  for (const build of [compileImagePrompt, (p: typeof project, s: Scene) => compileScenePrompt(p, s, [character, place]), compileVideoPrompt]) {
    const prompt = build(withNotes, feeling).prompt;
    assert.match(prompt, /Production notes to follow throughout: Siyah beyaz, yağmurlu sokaklar\. Renkli neon yok\./);
    assert.match(prompt, /Ada looks frightened, wide eyes, tense posture/);
    assert.doesNotMatch(prompt, /happy|angry/, "a place has no feelings and an unlinked character is ignored");
    assert.match(prompt, /no text, no captions, no watermark|no text, no subtitles, no watermark/, "the negative tail survives");
  }
  assert.equal(compileImagePrompt({ ...project, brief: "   " }, scene).prompt, plain, "an empty brief leaves prompts (and frame fingerprints) exactly as before");
  assert.equal(compileImagePrompt(project, { ...scene, emotions: { c1: "" } }).prompt, plain);
});

import { sheetPrompt } from "./prompts";
import { sheetCriteria } from "../providers/nvidia";

const withPhoto = { ...character, reference: { source: "upload", title: "x", pageUrl: null, file: "ref-c1-x.jpg", author: "", license: "", licenseUrl: null, addedAt: "2026-01-01T00:00:00.000Z" } } as Character;

test("a character sheet never contradicts the style the user wrote", () => {
  const cartoon = sheetPrompt({ style: "Stylized 3D caricature" }, withPhoto);
  assert.match(cartoon, /draw them clearly as a stylized character, not as a photograph/);
  assert.match(cartoon, /Single character, upper body, front view, neutral light grey background/);
  const photographic = sheetPrompt({ style: "x" }, { ...withPhoto, style: "Master photographic portrait, photorealistic rendering" });
  assert.doesNotMatch(photographic, /not as a photograph|stylized character/, "a photographic style is not told to avoid photographs");
  assert.match(photographic, /Master photographic portrait, photorealistic rendering/);
});

test("a monument, creature or group is drawn as written: no single figure, no grey studio background", () => {
  const monument = { ...withPhoto, appearance: "Three giant stone faces carved into Caucasus mountain peaks, snow, god-rays", style: "Monumental granite sculptures" };
  const prompt = sheetPrompt({ style: "x" }, monument);
  assert.doesNotMatch(prompt, /Single character|front view|grey background|character reference sheet/i);
  assert.match(prompt, /Three giant stone faces carved into Caucasus mountain peaks/);
  assert.match(prompt, /Use the reference photo for the recognisable features/);
  assert.match(prompt, /Compose it exactly as described, with every figure, object and setting that is mentioned/);
  assert.doesNotMatch(sheetPrompt({ style: "x" }, { ...monument, reference: null }), /reference photo/);
  const forced = sheetPrompt({ style: "x" }, { ...withPhoto, appearance: "Three giant stone faces carved into mountain peaks", framing: "sheet" });
  assert.match(forced, /Single character/, "an explicit choice of a plain sheet is honoured");
});

test("a rejected attempt's reason travels with the next one, and the judge scores what was actually asked", () => {
  assert.match(sheetPrompt({ style: "x" }, character, "Tek figür var, üç yüz isteniyordu"), /previous attempt was rejected for this reason, so fix exactly that: Tek figür var, üç yüz isteniyordu/);
  assert.doesNotMatch(sheetPrompt({ style: "x" }, character), /previous attempt/);
  const base = { name: "Anıt", appearance: "üç dev taş yüz", withReference: true };
  const free = sheetCriteria({ ...base, style: "photorealistic granite", framing: "free" });
  assert.match(free, /kaç figür, ölçek, ortam/);
  assert.doesNotMatch(free, /Tek karakter, önden/);
  assert.match(free, /Fotogerçekçi bir görünüm istendi; çizim, illüstrasyon ya da çizgi film gibi görünüyorsa düşük puan ver/);
  assert.match(sheetCriteria({ ...base, style: "3D caricature", framing: "sheet" }), /Fotoğraf gibi görünüyorsa düşük puan ver/);
  assert.match(sheetCriteria({ ...base, style: "3D caricature" }), /ozellikler en çok 2 olsun/, "a missing key element caps the score");
});
