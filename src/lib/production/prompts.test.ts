import assert from "node:assert/strict";
import test from "node:test";
import type { Character, Project, Scene } from "../types";
import { compileImagePrompt, compileScenePrompt, compileVideoPrompt } from "./prompts";
import { parseEnhancedShots } from "../providers/deepseek";

test("enhancement results cannot replace another shot or overwrite an id twice", () => {
  const shots = parseEnhancedShots(JSON.stringify({ shots: [
    { id: "wrong-id", image_prompt: "Wrong scene" },
    { id: "s1", image_prompt: "Correct scene" },
    { id: "s1", image_prompt: "Duplicate scene" },
  ] }), ["s1"]);
  assert.deepEqual(shots, [{ id: "s1", imagePrompt: "Correct scene", motionPrompt: "" }]);
});

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
  assert.match(compiled.prompt, /crowded street/, "the scene description itself is truncated to fit rather than skipped");
  assert.ok(compiled.prompt.endsWith("no text, no captions, no watermark"), "the negative tail survives");
});

test("multi-character reference sheets compact their notes so the scene prompt is never starved", () => {
  const verboseCast: Character[] = [1, 2, 3, 4].map((index) => ({
    ...character,
    id: `c${index}`,
    name: `Hero ${index}`,
    appearance: "photorealistic granite mountain peak with detailed carved historical features, snow-swept cliffs, dramatic storm clouds, and a billowing banner on the summit ".repeat(2).trim(),
  }));
  const multiScene: Scene = {
    ...scene,
    characterIds: ["c1", "c2", "c3", "c4"],
    prompt: "Style: Epic photorealistic landscape. Four monumental mountain peaks stand above the valley as a stone hand catches the floating balloon.",
  };
  const compiled = compileScenePrompt({ ...project, characters: verboseCast }, multiScene, verboseCast, false, 1_800);
  assert.equal(compiled.truncated, false);
  assert.match(compiled.prompt, /Four monumental mountain peaks stand above the valley as a stone hand catches the floating balloon/);
  assert.match(compiled.prompt, /Reference image 4 is the approved character sheet for Hero 4/);
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

test("long motion and reference descriptions cannot erase the action or standing directions", () => {
  const source = { ...project, brief: "Keep the red umbrella closed" };
  const directed = { ...scene, prompt: "Ada puts the red umbrella on the bench", motionPrompt: "Raindrops fall along the windows. ".repeat(120) };
  const video = compileVideoPrompt(source, directed, 800);
  assert.match(video.prompt, /Ada puts the red umbrella on the bench/);
  assert.match(video.prompt, /Keep the red umbrella closed/);
  assert.ok(video.truncated && video.prompt.length <= 800);
  const frame = compileScenePrompt(source, directed, [{ ...character, appearance: "ornate details ".repeat(200) }], true, 800);
  assert.match(frame.prompt, /Ada puts the red umbrella on the bench/);
  assert.match(frame.prompt, /Reference image 1/);
  assert.match(frame.prompt, /Reference image 2/);
  assert.ok(frame.prompt.length <= 800);
});

test("selected camera wins over an old directive without forcing smooth motion on handheld shots", () => {
  const directed = { ...scene, camera: "El kamerası", motionPrompt: "Camera: smooth pan to the left. Ada raises her hand" };
  const compiled = compileVideoPrompt(project, directed);
  assert.match(compiled.prompt, /^Camera: handheld camera with subtle natural shake/);
  assert.match(compiled.prompt, /Ada raises her hand/);
  assert.doesNotMatch(compiled.prompt, /pan to the left|Smooth cinematic motion/);
  const up = compileVideoPrompt(project, { ...scene, camera: "Yukarı kaydırma", motionPrompt: "The camera observes Ada running" });
  assert.match(up.prompt, /camera tilts and rises upward/);
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

  const stale: Scene = { ...enhanced, prompt: "adam akşam ormanda yürüyor", motionPrompt: "Old dolly movement from previous prompt" };
  assert.match(compileImagePrompt(project, stale).prompt, /adam akşam ormanda yürüyor/);
  assert.doesNotMatch(compileVideoPrompt(project, stale).prompt, /Old dolly movement from previous prompt/, "stale motionPrompt is invalidated when scene.prompt changes");
  assert.match(compileVideoPrompt(project, { ...enhanced, camera: "Yukarı kaydırma", motionPrompt: "Ada walks forward through the mist" }).prompt, /camera tilts and rises upward/, "user camera selection is included even when motionPrompt is set");
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
