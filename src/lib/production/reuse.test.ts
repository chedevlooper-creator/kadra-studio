import assert from "node:assert/strict";
import test from "node:test";
import { newCharacter, planScenes } from "../planner";
import type { ClipRecord, Project } from "../types";
import { sceneSheetPrompt, sheetPrompt } from "./prompts";
import { aiClipKey, cameraClipKey, continuityFrame, editSize, frameIsCurrent, frameKeys, keptClips, repairRegions, reusableClip } from "./reuse";

function project(): Pick<Project, "characters" | "style" | "aspectRatio" | "scenes" | "clips"> {
  const scenes = planScenes("Sahne 1: Fener sisin içinde yanar.\n\nSahne 2: Fotoğrafçı kıyıda bekler.", "Sinematik", "/images/mountains.jpg");
  return { characters: [newCharacter("c1", "Fotoğrafçı", "denim jacket", ["Fotoğrafçı"], "")], style: "Sinematik", aspectRatio: "16:9", scenes, clips: [] };
}

test("a frame stays current until its prompt, style or characters change", () => {
  const source = project();
  const scene = { ...source.scenes[1], characterIds: ["c1"], imageSource: "generated" as const };
  scene.frameKey = frameKeys(source, scene).flux;
  assert.equal(frameIsCurrent(source, scene), true);
  assert.equal(frameIsCurrent({ ...source, style: "Anime" }, scene), false, "a new project style remakes the frame");
  assert.equal(frameIsCurrent({ ...source, characters: [{ ...source.characters[0], appearance: "red coat" }] }, scene), false, "a changed character remakes the frames it appears in");
  assert.equal(frameIsCurrent(source, { ...scene, prompt: "Another prompt" }), false);
  assert.equal(frameIsCurrent(source, { ...scene, frameKey: "" }), true, "frames from before fingerprints are kept");
  assert.equal(frameIsCurrent(source, { ...scene, imageSource: "reference" }), false);
});

test("clip fingerprints follow the frame and the motion, not the model", () => {
  const source = project();
  const scene = source.scenes[0];
  assert.notEqual(cameraClipKey(source, scene), cameraClipKey(source, { ...scene, camera: "Sola kaydırma" }));
  assert.notEqual(aiClipKey(source, scene), aiClipKey(source, { ...scene, image: "/api/projects/p/media/scene-new.jpg" }));
  assert.notEqual(aiClipKey(source, scene), aiClipKey(source, { ...scene, motionPrompt: "Slow dolly in" }));
  assert.equal(aiClipKey(source, scene), aiClipKey(source, { ...scene, videoModel: "kling-v2-5-turbo" }));
});

test("a paid clip is reused only when it meets the tier and the pinned model", () => {
  const source = project();
  const scene = source.scenes[0];
  const record = (model: string, at: string): ClipRecord => ({ sceneId: scene.id, key: aiClipKey(source, scene), file: `clip-${model}.mp4`, model, modelLabel: model, cost: 0.18, createdAt: at });
  const withClips = { ...source, clips: [record("veo-3.1-lite-generate-001", "2026-01-01T00:00:00.000Z")] };
  assert.equal(reusableClip(withClips, scene, "economy")?.model, "veo-3.1-lite-generate-001");
  assert.equal(reusableClip(withClips, scene, "balanced"), null, "a cheaper model's clip does not satisfy a higher tier");
  assert.equal(reusableClip(withClips, scene, null)?.model, "veo-3.1-lite-generate-001", "a free film takes any existing paid clip");
  assert.equal(reusableClip(withClips, { ...scene, videoModel: "kling-v2-5-turbo" }, "economy"), null, "a pinned model must match");
  const many = { ...withClips, clips: ["a", "b", "c", "d"].map((model, index) => record(model, `2026-01-0${index + 1}T00:00:00.000Z`)) };
  assert.deepEqual(keptClips(many).map((item) => item.model), ["b", "c", "d"], "the newest three per shot are kept");
  assert.deepEqual(keptClips({ ...many, scenes: [] }), [], "clips of deleted shots are dropped");
});

test("only located, local defects are repaired in place", () => {
  const hand = { problem: "Altı parmak", fix: "five fingers", box: [0.1, 0.5, 0.3, 0.9] as [number, number, number, number] };
  assert.equal(repairRegions([hand]).length, 1);
  assert.deepEqual(repairRegions([hand])[0].map((value) => Math.round(value * 100) / 100), [0.06, 0.46, 0.34, 0.94], "the region is padded so the edit blends in");
  assert.deepEqual(repairRegions([hand, { problem: "Stil yanlış", fix: "", box: null }]), [], "an unlocated issue needs a fresh image");
  assert.deepEqual(repairRegions([{ ...hand, box: [0, 0, 0.9, 0.9] }]), [], "a defect covering most of the image needs a fresh image");
  assert.deepEqual(repairRegions([]), []);
});

test("edit sizes are multiples of 16 within the model's pixel limits and keep the shape", () => {
  for (const [width, height] of [[1360, 768], [768, 1360], [1024, 1024], [1376, 768], [640, 360], [1800, 1200], [4000, 3000]]) {
    const size = editSize(width, height);
    assert.equal(size.width % 16, 0); assert.equal(size.height % 16, 0);
    assert.ok(size.width * size.height >= 655_360 && size.width * size.height <= 8_294_400, `${width}x${height} → ${size.width}x${size.height}`);
    assert.ok(Math.abs(size.width / size.height - width / height) < 0.03);
  }
  assert.deepEqual(editSize(1360, 768), { width: 1360, height: 768 }, "FLUX frames are sent as they are");
});

test("the previous shot of the same place is passed on for continuity, and places get their own plate prompts", () => {
  const source = project();
  const harbour = newCharacter("m1", "Liman", "small stone harbour, red fishing boats", ["Liman"], "", "place");
  const [first, second] = source.scenes;
  const linked = { ...source, characters: [...source.characters, harbour], scenes: [{ ...first, characterIds: ["m1"], imageSource: "generated" as const, image: "/api/projects/p/media/scene-a.jpg" }, { ...second, characterIds: ["c1", "m1"] }] };
  assert.equal(continuityFrame(linked, linked.scenes[1]), "/api/projects/p/media/scene-a.jpg");
  assert.equal(continuityFrame({ ...linked, scenes: [{ ...linked.scenes[0], characterIds: [] }, linked.scenes[1]] }, linked.scenes[1]), null, "a different place starts fresh");
  assert.equal(continuityFrame(linked, linked.scenes[0]), null, "the first shot has nothing before it");
  const prompt = sceneSheetPrompt(linked, linked.scenes[1], [source.characters[0], harbour], true);
  assert.match(prompt, /Reference image 1 is the approved character sheet for Fotoğrafçı/);
  assert.match(prompt, /Reference image 2 is the approved location plate for Liman/);
  assert.match(prompt, /Reference image 3 is the previous shot of this scene/);
  assert.match(prompt, /the location's layout, architecture and colours/);
  assert.match(sheetPrompt(source, harbour), /^Location reference plate.*no people/);
});
