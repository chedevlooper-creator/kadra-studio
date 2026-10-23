import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { assistantInstructions, parseAssistantReply } from "./assistant";
import { newCharacter, planScenes } from "./planner";
import { createProjectRepository } from "./projects";

function context() {
  const scenes = planScenes("Sahne 1: Fener sisin içinde yanar.\n\nSahne 2: Fotoğrafçı kıyıda bekler.\n\nFinal: Yazı kartı: Yol devam eder.", "Sinematik", "/images/mountains.jpg");
  const ada = newCharacter("c1", "Ada", "kırmızı pelerinli genç kadın", ["Ada"], "");
  const harbour = newCharacter("m1", "Liman", "taş liman", ["Liman"], "", "place");
  scenes[0].characterIds = ["c1", "m1"];
  return { style: "Sinematik", aspectRatio: "16:9" as const, genre: "", look: "none", brief: "", characters: [ada, harbour], scenes };
}

test("the model's answer becomes a proposal of real, valid changes only", () => {
  const project = context();
  const [first, second, card] = project.scenes;
  const answer = JSON.stringify({
    reply: "Birinci sahneyi gerginleştirdim.",
    scenes: [
      { id: first.id, set: { description: "Fener, yoğun sisin içinde titrek bir ışıkla yanar.", prompt: "A lighthouse flickering in thick fog, tense night mood", camera: "Hızlı yaklaşma", duration: 99, emotions: { c1: "afraid", m1: "sad", nobody: "angry" }, model: "hack", characterIds: [] } },
      { id: second.id, set: { title: second.title, duration: second.duration } },
      { id: card.id, set: { prompt: "should be ignored for a title card", description: "Yol sürüyor." } },
      { id: "unknown", set: { title: "x" } },
    ],
    project: { genre: "horror", look: "bogus", brief: "Düşük ışık." },
  });
  const proposal = parseAssistantReply(answer, project);
  assert.equal(proposal.reply, "Birinci sahneyi gerginleştirdim.");
  assert.equal(proposal.changes.length, 2, "an unchanged shot and an unknown shot are not changes");
  const change = proposal.changes[0];
  assert.deepEqual(Object.keys(change.set).sort(), ["camera", "description", "duration", "emotions", "prompt"], "fields outside the allowed set (model, characterIds) are dropped");
  assert.equal(change.set.duration, 30, "a duration is clamped to the 2–30 s the film allows");
  assert.deepEqual(change.set.emotions, { c1: "afraid" }, "a place has no feelings and an unlinked name is ignored");
  assert.equal(change.before.camera, first.camera);
  assert.equal(change.before.duration, first.duration);
  const titleCard = proposal.changes[1];
  assert.deepEqual(Object.keys(titleCard.set), ["description"], "a title card keeps no picture prompt");
  assert.deepEqual(proposal.project, { genre: "horror", brief: "Düşük ışık." }, "an unknown look is dropped");
  assert.deepEqual(proposal.projectBefore, { genre: "", brief: "" });
  assert.equal(parseAssistantReply(JSON.stringify({ reply: "", scenes: [], project: null }), project).reply, "Bu isteğe uygun bir değişiklik bulamadım.");
  assert.throws(() => parseAssistantReply("özür dilerim", project), /JSON bulunamadı/);
});

test("the brief shows the model the film's state and states the limits", () => {
  const prompt = assistantInstructions(context(), "  3. sahneyi daha gergin yap  ");
  assert.match(prompt, /Sahne ekleme, silme, sıra değiştirme ve para harcatan işlemler yapılamaz/);
  assert.match(prompt, /c1=Ada/);
  assert.match(prompt, /"order":3/);
  assert.match(prompt, /KULLANICININ İSTEĞİ:\n3\. sahneyi daha gergin yap$/);
});

test("a proposal is only read until the user applies it; applying is all-or-nothing and re-plans the film for new frames", async (t) => {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-assistant-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  let asked = "";
  let reply = "";
  const repository = createProjectRepository(directory, {
    providers: async () => ({ nvidia: true, gmi: false, ffmpeg: true }),
    assistant: async (prompt) => { asked = prompt; return reply; },
  });
  const created = await repository.createProject({ title: "Asistan", script: "Sahne 1: Fener sisin içinde yanar.\n\nSahne 2: Fotoğrafçı kıyıda bekler.", style: "Sinematik", aspectRatio: "16:9", budget: null });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  const [first, second] = planned.scenes;
  reply = JSON.stringify({ reply: "Gerginleştirdim.", scenes: [{ id: first.id, set: { prompt: "A lighthouse in thick fog, tense", duration: 7, camera: "El kamerası" } }, { id: second.id, set: { narration: "Bekleyiş uzadı." } }], project: { look: "noir" } });

  const proposal = await repository.proposeEdits(planned.id, planned.revision, "Tüm film daha gergin olsun");
  assert.match(asked, /Tüm film daha gergin olsun/);
  assert.equal(proposal.changes.length, 2);
  assert.equal((await repository.getProject(planned.id)).revision, planned.revision, "proposing saves nothing");

  const applied = await repository.applyEdits(planned.id, planned.revision, { scenes: proposal.changes.map((item) => ({ id: item.sceneId, set: item.set })), project: proposal.project });
  const [a, b] = applied.scenes;
  assert.deepEqual([a.prompt, a.promptEn, a.promptEnSource, a.duration, a.camera], ["A lighthouse in thick fog, tense", "A lighthouse in thick fog, tense", "A lighthouse in thick fog, tense", 7, "El kamerası"]);
  assert.equal(b.narration, "Bekleyiş uzadı.");
  assert.equal(applied.look, "noir");
  assert.equal(applied.duration, a.duration + b.duration, "the film's length follows the new durations");
  assert.equal(applied.revision, planned.revision + 1, "one revision for the whole proposal");

  await assert.rejects(repository.applyEdits(applied.id, planned.revision, { scenes: [{ id: first.id, set: { title: "Eski" } }] }), /başka bir işlemde değişti/, "a stale proposal is refused");
  await assert.rejects(repository.applyEdits(applied.id, applied.revision, { scenes: [{ id: first.id, set: { title: "İyi" } }, { id: second.id, set: { characterIds: [] } }] }), /yalnızca başlık/, "a field the assistant may not touch refuses the whole batch");
  assert.equal((await repository.getProject(applied.id)).scenes[0].title, first.title, "nothing from the refused batch was saved");

  const offline = createProjectRepository(await mkdtemp(path.join(os.tmpdir(), "kadra-assistant-off-")), { providers: async () => ({ nvidia: false, gmi: false, ffmpeg: true }) });
  const other = await offline.createProject({ title: "x", script: "Sahne 1: Bir şey olur.", style: "Sinematik", aspectRatio: "16:9", budget: null });
  await assert.rejects(offline.proposeEdits(other.id, other.revision, "Daha gergin yap"), /DeepSeek ya da NVIDIA/);
});
