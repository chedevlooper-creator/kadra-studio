import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, readdir, rm, utimes, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { createProjectRepository, estimateCharacters, type RepositoryOptions } from "./projects";
import type { AiPlan } from "./providers/nvidia";
import type { CreateProjectInput } from "./types";

const input: CreateProjectInput = { title: "Deneme", script: "Sahne 1: Dağların üzerinde sabah ışığı görünür.\nFinal: Yazı kartı: Yol devam eder.", style: "Sinematik", aspectRatio: "16:9", budget: 0 };
const offline: RepositoryOptions = { providers: async () => ({ nvidia: false, gmi: false, ffmpeg: true }) };
async function fixture(t: { after: (callback: () => Promise<void>) => void }, options: RepositoryOptions = offline) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-store-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return { directory, repository: createProjectRepository(directory, options) };
}
const workerA = `${process.pid}:a`;
const workerB = `${process.pid}:b`;
const strip = (value: Record<string, unknown>, keys: string[]) => Object.fromEntries(Object.entries(value).filter(([key]) => !keys.includes(key)));
async function plannedProject(repository: ReturnType<typeof createProjectRepository>) {
  const project = await repository.createProject(input);
  return repository.planProject(project.id, project.revision);
}

test("initial references and projects survive repository recreation", async (t) => {
  const { directory, repository } = await fixture(t);
  const bootstrap = await repository.getBootstrap();
  assert.equal(bootstrap.projects.length, 3);
  assert.deepEqual(new Set(bootstrap.projects.map((project) => project.title)), new Set(["Dağın Hafızası", "Son Işık", "Başka Bir Dünya"]));
  assert.ok(bootstrap.projects.every((project) => project.isExample && project.scenes.length > 0 && project.output === null));
  assert.ok(bootstrap.models.filter((model) => model.provider === "NVIDIA").every((model) => !model.configured));
  assert.equal(bootstrap.providers.nvidia, false);
  const project = await repository.createProject(input);
  assert.equal((await createProjectRepository(directory).getProject(project.id)).title, "Deneme");
  assert.equal((await repository.getBootstrap()).projects.length, 4);
});

test("revision checks prevent stale writes and reorder validates exact set", async (t) => {
  const { repository } = await fixture(t);
  const project = await repository.createProject(input);
  const planned = await repository.planProject(project.id, project.revision);
  await assert.rejects(repository.updateProject(project.id, { revision: project.revision, title: "Eski" }), (error: unknown) => (error as { status: number }).status === 409);
  await assert.rejects(repository.updateProject(project.id, { revision: planned.revision, sceneOrder: [planned.scenes[0].id, planned.scenes[0].id] }), /tam bir kez/);
  const reordered = await repository.updateProject(project.id, { revision: planned.revision, sceneOrder: planned.scenes.map((scene) => scene.id).reverse() });
  assert.equal(reordered.scenes[0].id, planned.scenes[1].id);
  assert.deepEqual(reordered.scenes.map((scene) => scene.order), [1, 2]);
  const replanned = await repository.updateProject(project.id, { revision: reordered.revision, script: "Değiştirilen senaryo yeni bir çekim gerektiriyor." });
  assert.equal(replanned.scenes.length, 0);
  assert.equal(replanned.status, "draft");
});

test("idempotent run submissions never create a second run and lock edits while producing", async (t) => {
  const { directory, repository } = await fixture(t);
  const planned = await plannedProject(repository);
  const run = await repository.startRun(planned.id, planned.revision, "test-operation-001");
  assert.deepEqual(run.run?.steps.map((step) => step.kind), ["image", "clip", "title", "montage"]);
  assert.equal(run.status, "producing");
  const replay = await createProjectRepository(directory, offline).startRun(planned.id, planned.revision, "test-operation-001");
  assert.equal(replay.run?.id, run.run?.id);
  assert.equal(replay.run?.cost, 0);
  await assert.rejects(repository.startRun(planned.id, run.revision, "test-operation-001"), /anahtarı/);
  await assert.rejects(repository.startRun(planned.id, run.revision, "test-operation-002"), /durdurun/);
  await assert.rejects(repository.updateScene(planned.id, run.scenes[0].id, run.revision, { duration: 7 }), /durdurun/);
  assert.ok(run.run?.steps.every((step) => !("owner" in step)));
});

test("a run cannot start without FFmpeg", async (t) => {
  const { repository } = await fixture(t, { providers: async () => ({ nvidia: false, gmi: false, ffmpeg: false }) });
  const planned = await plannedProject(repository);
  await assert.rejects(repository.startRun(planned.id, planned.revision, "no-ffmpeg-0001"), /FFmpeg/);
});

test("steps are claimed in order, completed, and finish with a film", async (t) => {
  const { repository } = await fixture(t);
  const planned = await plannedProject(repository);
  const started = await repository.startRun(planned.id, planned.revision, "complete-run-0001");
  const runId = started.run!.id;
  const image = await repository.claimStep(workerA, 60_000);
  assert.equal(image?.step.kind, "image");
  assert.equal(await repository.claimStep(workerB, 60_000), null, "a step leased by a live owner is not handed out twice");
  assert.equal(await repository.completeStep(planned.id, "wrong-run-id", image!.step.id, { kind: "clip", note: "" }), false);
  const generatedUrl = `/api/projects/${planned.id}/media/scene-test.jpg`;
  assert.ok(await repository.completeStep(planned.id, runId, image!.step.id, { kind: "image", url: generatedUrl, source: "generated", review: { ok: true, note: "Uyumlu." }, note: "" }));
  for (const kind of ["clip", "title"] as const) {
    const claim = await repository.claimStep(workerA, 60_000);
    assert.equal(claim?.step.kind, kind);
    assert.ok(await repository.completeStep(planned.id, runId, claim!.step.id, { kind, note: "" }));
  }
  const montage = await repository.claimStep(workerA, 60_000);
  assert.equal(montage?.step.kind, "montage");
  assert.ok(await repository.completeStep(planned.id, runId, montage!.step.id, { kind: "montage", url: `/api/projects/${planned.id}/media/film-test.mp4`, duration: 11, note: "" }));
  const finished = await repository.getProject(planned.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(finished.run?.progress, 100);
  assert.equal(finished.status, "ready");
  assert.equal(finished.output?.duration, 11);
  assert.equal(finished.cover, generatedUrl);
  assert.equal(finished.scenes[0].imageSource, "generated");
  assert.equal(finished.revision, started.revision, "worker progress does not invalidate the editor's revision");
  assert.equal(await repository.claimStep(workerA, 60_000), null);
});

test("an orphaned lease is taken over, and repeated crashes stop the run", async (t) => {
  const { repository } = await fixture(t);
  const planned = await plannedProject(repository);
  await repository.startRun(planned.id, planned.revision, "orphan-run-0001");
  // These owners name a process that does not exist, as after a server crash.
  const first = await repository.claimStep("2147483647:a", 600_000);
  const second = await repository.claimStep("2147483647:b", 600_000);
  assert.equal(second?.step.id, first?.step.id);
  assert.equal(second?.step.attempts, 2);
  assert.match((await repository.getProject(planned.id)).run!.events.at(-1)!.message, /yeniden başlatılıyor/);
  assert.equal((await repository.claimStep("2147483647:c", 600_000))?.step.attempts, 3);
  assert.equal(await repository.claimStep("2147483647:d", 600_000), null);
  const stopped = await repository.getProject(planned.id);
  assert.equal(stopped.run?.status, "failed");
  assert.equal(stopped.status, "planned");
});

test("retryable failures requeue and permanent failures stop the run", async (t) => {
  const { repository } = await fixture(t);
  const planned = await plannedProject(repository);
  const runId = (await repository.startRun(planned.id, planned.revision, "failure-run-0001")).run!.id;
  const claim = await repository.claimStep(workerA, 60_000);
  assert.ok(await repository.failStep(planned.id, runId, claim!.step.id, "NVIDIA yanıt vermedi.", true));
  const retry = await repository.claimStep(workerA, 60_000);
  assert.equal(retry?.step.id, claim?.step.id);
  assert.ok(await repository.failStep(planned.id, runId, retry!.step.id, "İçerik filtresi.", false));
  const failed = await repository.getProject(planned.id);
  assert.equal(failed.run?.status, "failed");
  assert.equal(failed.scenes[0].status, "failed");
  assert.ok(failed.run?.steps.slice(1).every((step) => step.status === "skipped"));
  const restarted = await repository.startRun(planned.id, failed.revision, "failure-run-0002");
  assert.equal(restarted.run?.status, "running");
});

test("cancel persists across restart and workers stop receiving its steps", async (t) => {
  const { directory, repository } = await fixture(t);
  const planned = await plannedProject(repository);
  const started = await repository.startRun(planned.id, planned.revision, "cancel-operation-001");
  const claim = await repository.claimStep(workerA, 60_000);
  const cancelled = await repository.cancelRun(planned.id, started.revision);
  assert.equal(cancelled.run?.status, "cancelled");
  assert.equal(await repository.completeStep(planned.id, started.run!.id, claim!.step.id, { kind: "clip", note: "" }), false);
  assert.equal(await repository.claimStep(workerA, 60_000), null);
  assert.equal((await createProjectRepository(directory).getProject(planned.id)).run?.status, "cancelled");
  await assert.rejects(repository.cancelRun(planned.id, cancelled.revision), /Durdurulacak/);
});

test("version 1 data with simulated demo runs migrates without losing projects", async (t) => {
  const { directory, repository } = await fixture(t);
  const planned = await plannedProject(repository);
  const file = path.join(directory, "projects.json");
  const current = JSON.parse(await readFile(file, "utf8"));
  const legacy = {
    version: 1, receipts: [{ projectId: planned.id, key: "old-demo-key-01", fingerprint: "{}", runId: planned.id }],
    projects: current.projects.map((project: Record<string, unknown>) => ({
      ...strip(project, ["planner", "planNote", "characters", "output"]), status: "ready",
      run: { id: "demo-run", mode: "demo", status: "completed", startedAt: new Date().toISOString(), completedAt: null, progress: 100, cost: 0, events: [] },
      scenes: (project.scenes as Record<string, unknown>[]).map((scene) => ({ ...strip(scene, ["motionPrompt", "imageSource", "review", "characterIds"]), status: "ready", model: "Runway · Video" })),
    })),
  };
  await writeFile(file, JSON.stringify(legacy));
  const migrated = await createProjectRepository(directory).getProject(planned.id);
  assert.equal(migrated.run, null);
  assert.equal(migrated.status, "planned");
  assert.equal(migrated.scenes[1].model, "Yazı kartı");
  assert.ok(migrated.scenes.every((scene) => scene.imageSource === "reference" && scene.status === "draft"));
  const stored = JSON.parse(await readFile(file, "utf8"));
  assert.equal(stored.version, 2);
  assert.equal(stored.receipts.length, 0);
  const pre = JSON.parse(await readFile(path.join(directory, "projects.pre-v1.json"), "utf8"));
  assert.equal(pre.version, 1, "the original file is kept before the schema migration");
});

const aiPlan: AiPlan = {
  characters: [{ id: "hero", name: "Ada", appearance: "short red hair, green raincoat" }],
  locations: [{ id: "valley", name: "Vadi", appearance: "misty green valley under a pale sky" }],
  shots: [
    { title: "Sabah", kind: "video", duration_seconds: 5, camera: "Yavaş yaklaşma", character_ids: ["hero", "ghost"], location_id: "valley", description: "Ada dağa bakar.", on_screen_text: "", image_prompt: "Ada looks at the mountain", motion_prompt: "slow push in", narration: "Her şey burada başladı." },
    { title: "Son", kind: "title", duration_seconds: 4, camera: "", character_ids: [], location_id: "", description: "", on_screen_text: "Yol devam eder.", image_prompt: "", motion_prompt: "", narration: "" },
  ],
};

test("AI plans map characters and title text; failures fall back to the heuristic plan", async (t) => {
  const online = { providers: async () => ({ nvidia: true, gmi: false, ffmpeg: true }) };
  const { repository } = await fixture(t, { ...online, aiPlanner: async () => aiPlan });
  const project = await repository.createProject(input);
  const planned = await repository.planProject(project.id, project.revision);
  assert.equal(planned.planner, "nemotron");
  assert.deepEqual(planned.characters.map(({ id, kind, name, appearance, aliases, reference }) => ({ id, kind, name, appearance, aliases, reference })), [
    { id: "c1", kind: "person", name: "Ada", appearance: "short red hair, green raincoat", aliases: ["Ada"], reference: null },
    { id: "m1", kind: "place", name: "Vadi", appearance: "misty green valley under a pale sky", aliases: ["Vadi"], reference: null },
  ]);
  assert.equal(planned.characters[0].sheet.status, "none");
  assert.deepEqual(planned.scenes[0].characterIds, ["c1", "m1"], "a shot links its cast and its location");
  assert.equal(planned.scenes[1].kind, "title");
  assert.equal(planned.scenes[1].description, "Yol devam eder.");
  assert.equal(planned.duration, 9);
  const heuristic = await repository.planProject(project.id, planned.revision, "heuristic");
  assert.equal(heuristic.planner, "heuristic");

  const broken = await fixture(t, { ...online, aiPlanner: async () => { throw new Error("NVIDIA yanıt vermedi (zaman aşımı)."); } });
  const other = await broken.repository.createProject(input);
  const fallback = await broken.repository.planProject(other.id, other.revision);
  assert.equal(fallback.planner, "heuristic");
  assert.match(fallback.planNote, /zaman aşımı/);
  assert.equal(fallback.scenes.length, 2);
});

test("an AI plan is discarded if the project changed while it was being prepared", async (t) => {
  let release!: () => void;
  const gate = new Promise<void>((resolve) => { release = resolve; });
  const { repository } = await fixture(t, { providers: async () => ({ nvidia: true, gmi: false, ffmpeg: true }), aiPlanner: async () => { await gate; return aiPlan; } });
  const project = await repository.createProject(input);
  const planning = repository.planProject(project.id, project.revision);
  await new Promise((resolve) => setTimeout(resolve, 50));
  await repository.updateProject(project.id, { revision: project.revision, title: "Yeni ad" });
  release();
  await assert.rejects(planning, /başka bir işlemde/);
});

test("scene bounds and budget validation preserve previous data on invalid input", async (t) => {
  const { repository } = await fixture(t);
  await assert.rejects(repository.createProject({ ...input, budget: -1 }), /negatif/);
  const planned = await plannedProject(repository);
  await assert.rejects(repository.updateScene(planned.id, planned.scenes[0].id, planned.revision, { duration: 31 }));
  assert.equal((await repository.getProject(planned.id)).revision, planned.revision);
  const edited = await repository.updateScene(planned.id, planned.scenes[0].id, planned.revision, { duration: 9, narration: "Sabah yola çıkıyoruz." });
  assert.equal(edited.duration, edited.scenes.reduce((sum, scene) => sum + scene.duration, 0));
  await repository.deleteProject(planned.id, edited.revision);
  await assert.rejects(repository.getProject(planned.id), /bulunamadı/);
});

test("corrupt storage is never overwritten or re-seeded", async (t) => {
  const { directory, repository } = await fixture(t);
  await repository.getBootstrap();
  const file = path.join(directory, "projects.json");
  const corrupted = '{"version":2,"projects": [BROKEN';
  await writeFile(file, corrupted);
  await assert.rejects(repository.createProject(input), /bozuk/);
  assert.equal(await readFile(file, "utf8"), corrupted);
});

test("stale lock from dead process recovers safely", async (t) => {
  const { directory, repository } = await fixture(t);
  const lock = path.join(directory, "projects.lock");
  await writeFile(lock, JSON.stringify({ token: "orphan", pid: 2_147_483_647 }));
  const old = new Date(Date.now() - 60_000); await utimes(lock, old, old);
  assert.equal((await repository.getBootstrap()).projects.length, 3);
});

test("independent processes serialize writes without losing projects", { timeout: 20_000 }, async (t) => {
  const { directory, repository } = await fixture(t);
  await repository.getBootstrap();
  const modulePath = fileURLToPath(new URL("./projects.ts", import.meta.url));
  const runChild = (label: string) => new Promise<void>((resolve, reject) => {
    const source = `import {createProjectRepository} from ${JSON.stringify(modulePath)}; const repository=createProjectRepository(${JSON.stringify(directory)}); for(let i=0;i<8;i++) await repository.createProject({...${JSON.stringify(input)},title:${JSON.stringify(label)}+i});`;
    const child = spawn(process.execPath, ["--import", "tsx", "--input-type=module", "-e", source], { cwd: process.cwd(), stdio: ["ignore", "ignore", "pipe"] });
    let error = ""; child.stderr.on("data", (chunk) => { error += chunk.toString(); });
    child.on("error", reject); child.on("exit", (code) => code === 0 ? resolve() : reject(new Error(error || `Child exited ${code}`)));
  });
  await Promise.all([runChild("Birinci "), runChild("İkinci ")]);
  assert.equal((await repository.getBootstrap()).projects.length, 19);
});

const paidPrices = new Map([
  ["veo-3.1-lite-generate-001", { perSecond: 0.03, perRequest: null }],
  ["kling-v2-5-turbo", { perSecond: 0.07, perRequest: null }],
]);
const paidOptions: RepositoryOptions = { providers: async () => ({ nvidia: true, gmi: true, ffmpeg: true }), videoPrices: async () => paidPrices };

async function quotedProject(repository: ReturnType<typeof createProjectRepository>, budget: number | null = 2) {
  const planned = await plannedProject(repository);
  const videoScene = planned.scenes.find((scene) => scene.kind === "video")!;
  const quoted = await repository.prepareQuote(planned.id, { revision: planned.revision, quality: "economy", budget, selections: [{ sceneId: videoScene.id, motion: "ai", videoModel: null }] });
  return { quoted, videoScene };
}

/** A project whose first character already has an approved (free, FLUX) sheet. */
async function approvedCharacter(repository: ReturnType<typeof createProjectRepository>) {
  const planned = await plannedProject(repository);
  const added = await repository.addCharacter(planned.id, planned.revision, { name: "Yolcu", appearance: "mavi pelerin", aliases: ["dağların"], style: "" });
  const charRun = await repository.startCharacterRun(planned.id, added.revision, "char-free-quote", ["c1"], 0);
  const step = await repository.claimStep(workerA, 60_000);
  await repository.recordSheetAttempt(planned.id, charRun.run!.id, step!.step.id, { id: "a1", url: `/api/projects/${planned.id}/media/sheet-c1-1.jpg`, at: new Date().toISOString(), engine: "flux", verdict: { ok: true, scores: { style: 5, traits: 5, pose: 5, clean: 5 }, note: "uygun" }, cost: 0 });
  await repository.completeStep(planned.id, charRun.run!.id, step!.step.id, { kind: "character", note: "", uncertain: false, failedSubmissions: 0 });
  return repository.reviewCharacterSheet(planned.id, (await repository.getProject(planned.id)).revision, "c1", "approve", "a1");
}

test("a quote prices only the chosen shots with the cheapest eligible model and stores the settings", async (t) => {
  const { repository } = await fixture(t, paidOptions);
  const { quoted, videoScene } = await quotedProject(repository);
  assert.equal(quoted.quality, "economy");
  assert.equal(quoted.budget, 2);
  assert.equal(quoted.scenes.find((scene) => scene.id === videoScene.id)?.motion, "ai");
  const quote = quoted.quote!;
  assert.equal(quote.lines.length, 1);
  assert.equal(quote.lines[0].modelLabel, "Veo 3.1 Lite");
  assert.equal(quote.lines[0].alternative?.label, "Kling 2.5 Turbo");
  assert.equal(quote.total, quote.lines[0].estimate);
  assert.ok(quote.withinBudget);
  const offline = await fixture(t);
  const other = await plannedProject(offline.repository);
  await assert.rejects(offline.repository.prepareQuote(other.id, { revision: other.revision, quality: "economy", budget: 2, selections: [] }), /GMI anahtarı/);
  const unpriced = await fixture(t, { ...paidOptions, videoPrices: async () => { throw new Error("ağ hatası"); } });
  const third = await plannedProject(unpriced.repository);
  await assert.rejects(unpriced.repository.prepareQuote(third.id, { revision: third.revision, quality: "economy", budget: 2, selections: [] }), /fiyatlar alınamadı/);
});

test("a paid run needs a fresh, unchanged quote within budget and reserves its cost up front", async (t) => {
  const { repository } = await fixture(t, paidOptions);
  const poor = await quotedProject(repository, 0.05);
  assert.equal(poor.quoted.quote?.withinBudget, false);
  await assert.rejects(repository.startRun(poor.quoted.id, poor.quoted.revision, "paid-over-budget", poor.quoted.quote!.id), /bütçeyi/);

  const { quoted, videoScene } = await quotedProject(repository);
  await assert.rejects(repository.startRun(quoted.id, quoted.revision, "paid-wrong-quote", "f".repeat(32)), /artık geçerli değil/);
  const started = await repository.startRun(quoted.id, quoted.revision, "paid-run-000001", quoted.quote!.id);
  assert.equal(started.run?.mode, "paid");
  assert.equal(started.run?.regenerateImages, false);
  assert.equal(started.quote, null, "a quote is used once");
  assert.deepEqual(started.run?.steps.map((step) => step.kind), ["image", "video", "title", "montage"]);
  const reserved = started.ledger.filter((entry) => entry.status === "reserved");
  assert.equal(reserved.length, 1);
  assert.equal(reserved[0].sceneId, videoScene.id);
  assert.equal(started.run?.steps[1].paid?.ledgerId, reserved[0].id);

  const cancelled = await repository.cancelRun(quoted.id, started.revision);
  assert.equal(cancelled.ledger[0].status, "released", "money for unsent requests goes back to the budget");
});

test("editing a shot after quoting invalidates the quote", async (t) => {
  const { repository } = await fixture(t, paidOptions);
  const { quoted, videoScene } = await quotedProject(repository);
  const edited = await repository.updateScene(quoted.id, videoScene.id, quoted.revision, { duration: 8 });
  await assert.rejects(repository.startRun(quoted.id, edited.revision, "paid-stale-quote", quoted.quote!.id), /değişti/);
});

test("a change to the character bank invalidates an approved quote", async (t) => {
  const { repository } = await fixture(t, { ...paidOptions, referenceImagePrice: async () => 0.041 });
  const approved = await approvedCharacter(repository);
  const quoted = await repository.prepareQuote(approved.id, { revision: approved.revision, quality: "economy", budget: 1, referenceFrames: true, selections: [] });
  assert.ok(quoted.quote);
  assert.equal(quoted.quote.lines[0].kind, "image");
  const rejected = await repository.reviewCharacterSheet(approved.id, quoted.revision, "c1", "reject", null);
  assert.equal(rejected.quote, null, "a character change drops the quote");
  await assert.rejects(repository.startRun(approved.id, rejected.revision, "stale-character-quote", quoted.quote!.id), /artık geçerli değil/);
});

test("a global spend ceiling and the kill switch refuse paid work", async (t) => {
  const capped = await fixture(t, { ...paidOptions, spendLimit: () => 0.05 });
  const over = await quotedProject(capped.repository);
  assert.ok(over.quoted.quote!.total > 0.05);
  await assert.rejects(capped.repository.startRun(over.quoted.id, over.quoted.revision, "over-spend-cap-01", over.quoted.quote!.id), /harcama tavanı/);

  let stopped = true;
  const halted = await fixture(t, { ...paidOptions, paymentsDisabled: () => stopped });
  const blocked = await quotedProject(halted.repository);
  await assert.rejects(halted.repository.startRun(blocked.quoted.id, blocked.quoted.revision, "kill-switch-0001", blocked.quoted.quote!.id), /durdurma anahtarı/);

  stopped = false;
  const started = await halted.repository.startRun(blocked.quoted.id, blocked.quoted.revision, "kill-switch-0002", blocked.quoted.quote!.id);
  const runId = started.run!.id;
  const image = await halted.repository.claimStep(workerA, 60_000);
  await halted.repository.completeStep(blocked.quoted.id, runId, image!.step.id, { kind: "image", url: "/images/mountains.jpg", source: "reference", review: null, note: "" });
  const video = await halted.repository.claimStep(workerA, 60_000);
  stopped = true;
  assert.equal(await halted.repository.markSubmitting(blocked.quoted.id, runId, video!.step.id), false, "the emergency stop blocks a prepared submission");
});

test("the store keeps one daily backup of the state before a write", async (t) => {
  const { directory, repository } = await fixture(t);
  const project = await repository.createProject(input);
  await repository.updateProject(project.id, { revision: project.revision, title: "Yedeklenen" });
  const backups = await readdir(path.join(directory, "backups"));
  assert.equal(backups.length, 1);
  assert.match(backups[0], /^projects-\d{4}-\d{2}-\d{2}\.json$/);
  const snapshot = JSON.parse(await readFile(path.join(directory, "backups", backups[0]), "utf8"));
  assert.ok(snapshot.projects.some((item: { title: string }) => item.title === "Deneme"), "the snapshot holds the state before the write");
  assert.ok(!snapshot.projects.some((item: { title: string }) => item.title === "Yedeklenen"));
});

test("a paid request that was sent but never acknowledged is never sent again", async (t) => {
  const { repository } = await fixture(t, paidOptions);
  const { quoted } = await quotedProject(repository);
  const runId = (await repository.startRun(quoted.id, quoted.revision, "paid-uncertain-01", quoted.quote!.id)).run!.id;
  const image = await repository.claimStep(workerA, 60_000);
  await repository.completeStep(quoted.id, runId, image!.step.id, { kind: "image", url: "/images/mountains.jpg", source: "reference", review: null, note: "" });
  const video = await repository.claimStep(workerA, 60_000);
  assert.equal(video?.step.kind, "video");
  assert.ok(await repository.markSubmitting(quoted.id, runId, video!.step.id));
  assert.equal(await repository.markSubmitting(quoted.id, runId, video!.step.id), false, "submission is marked once");
  assert.equal((await repository.getProject(quoted.id)).ledger[0].status, "submitted");
  await repository.failStep(quoted.id, runId, video!.step.id, "Bağlantı koptu.", true);
  const after = await repository.getProject(quoted.id);
  assert.equal(after.run?.status, "failed", "an uncertain submission is not retried automatically");
  assert.equal(after.ledger[0].status, "submitted", "its possible cost still counts against the budget");
});

test("a submitted request with a known id resumes by polling and its cost is recorded", async (t) => {
  const { repository } = await fixture(t, paidOptions);
  const { quoted } = await quotedProject(repository);
  const runId = (await repository.startRun(quoted.id, quoted.revision, "paid-resume-0001", quoted.quote!.id)).run!.id;
  const image = await repository.claimStep(workerA, 60_000);
  await repository.completeStep(quoted.id, runId, image!.step.id, { kind: "image", url: "/images/mountains.jpg", source: "reference", review: null, note: "" });
  const video = await repository.claimStep(workerA, 60_000);
  await repository.markSubmitting(quoted.id, runId, video!.step.id);
  await repository.recordRequest(quoted.id, runId, video!.step.id, "gmi-request-1");
  await repository.failStep(quoted.id, runId, video!.step.id, "İndirme yarıda kaldı.", true);
  const retry = await repository.claimStep(workerA, 60_000);
  assert.equal(retry?.step.id, video?.step.id);
  assert.equal(retry?.step.paid?.requestId, "gmi-request-1");
  assert.ok(await repository.completeStep(quoted.id, runId, retry!.step.id, { kind: "video", note: "", ledger: { status: "charged", note: "Tamamlandı." } }));
  const done = await repository.getProject(quoted.id);
  assert.equal(done.ledger[0].status, "charged");
  assert.equal(done.ledger[0].requestId, "gmi-request-1");
});

test("a storyboard file becomes a planned project without any generation", async (t) => {
  const { repository } = await fixture(t);
  const shots = [
    { id: "1A", sceneId: "SAHNE 1", sceneTitle: "POMPA", durationSec: 5, visualSummary: "Altın yığınları.", cameraMovement: "Yavaş dolly", aiPrompt: "Gold piles. Style: 3D." },
    { id: "F3", sceneId: "FİNAL", durationSec: 3, visualSummary: "Siyah ekran.", aiPrompt: "Pure black screen.", voiceoverOrText: "«Son.»" },
  ];
  const imported = await repository.importStoryboard({ title: "Balonlar", style: "Sinematik", aspectRatio: "16:9", budget: null, shots });
  assert.equal(imported.status, "planned");
  assert.equal(imported.planner, "import");
  assert.equal(imported.duration, 8);
  assert.deepEqual(imported.scenes.map((scene) => scene.code), ["1A", "F3"]);
  assert.equal(imported.scenes[1].kind, "title");
  assert.match(imported.script, /Final – F3: Siyah ekran\./);
  assert.equal(imported.music, null);
});

const characterOptions: RepositoryOptions = { providers: async () => ({ nvidia: true, gmi: true, ffmpeg: true }), referenceImagePrice: async () => 0.041 };
const photo = { source: "wikimedia" as const, title: "File:Test.jpg", pageUrl: "https://commons.wikimedia.org/wiki/File:Test.jpg", file: "ref-c1-test.jpg", author: "Yazar", license: "CC BY-SA 4.0", licenseUrl: null, addedAt: new Date().toISOString() };

test("characters link to the shots that mention them and leave cleanly", async (t) => {
  const { repository } = await fixture(t, characterOptions);
  const planned = await plannedProject(repository);
  const added = await repository.addCharacter(planned.id, planned.revision, { name: "Yolcu", appearance: "Kırmızı atkılı genç kadın", aliases: ["dağların", "Yolcu"], style: "" });
  const character = added.characters[0];
  assert.equal(character.id, "c1");
  assert.deepEqual(added.scenes.map((scene) => scene.characterIds), [["c1"], []], "only the shot mentioning an alias is linked");
  const withPhoto = (await repository.setCharacterReference(planned.id, added.revision, "c1", photo)).project;
  const removed = await repository.deleteCharacter(planned.id, withPhoto.revision, "c1");
  assert.deepEqual(removed.files, ["ref-c1-test.jpg"]);
  assert.ok(removed.project.scenes.every((scene) => scene.characterIds.length === 0));
});

test("character estimates price photo-based sheets and keep description-based ones free", () => {
  const sheet = { status: "none" as const, attempts: [], chosen: null, note: "" };
  const project = { budget: 0.2, ledger: [], characters: [
    { id: "c1", kind: "person" as const, name: "A", appearance: "", aliases: [], style: "", reference: photo, sheet },
    { id: "c2", kind: "person" as const, name: "B", appearance: "", aliases: [], style: "", reference: null, sheet },
  ] };
  const estimate = estimateCharacters(project, ["c1", "c2"], { nvidia: true, gmi: true, ffmpeg: true }, 0.041);
  assert.deepEqual(estimate.lines.map((line) => [line.engine, line.maxCost]), [["nano-banana", 0.123], ["flux", 0]]);
  assert.ok(estimate.withinBudget);
  assert.match(estimateCharacters({ ...project, budget: 0.1 }, ["c1"], { nvidia: true, gmi: true, ffmpeg: true }, 0.041).problems.join(), /aşıyor/);
  assert.match(estimateCharacters({ ...project, budget: null }, ["c1"], { nvidia: true, gmi: true, ffmpeg: true }, 0.041).problems.join(), /bütçesi belirleyin/);
  assert.ok(estimateCharacters({ ...project, budget: null }, ["c2"], { nvidia: true, gmi: false, ffmpeg: true }, null).withinBudget, "free sheets need no budget");
});

test("a character run reserves the maximum, records attempts, returns the unused part and waits for approval", async (t) => {
  const { repository } = await fixture(t, characterOptions);
  const planned = await plannedProject(repository);
  const added = await repository.addCharacter(planned.id, (await repository.updateProject(planned.id, { revision: planned.revision, budget: 1 })).revision, { name: "Lider", appearance: "kasket, bıyık", aliases: [], style: "" });
  const withPhoto = (await repository.setCharacterReference(planned.id, added.revision, "c1", photo)).project;
  await assert.rejects(repository.startCharacterRun(planned.id, withPhoto.revision, "char-run-cheap1", ["c1"], 0.05), /Fiyat değişti/);
  const started = await repository.startCharacterRun(planned.id, withPhoto.revision, "char-run-000001", ["c1"], 0.123);
  assert.equal(started.run?.mode, "characters");
  assert.equal(started.ledger[0].status, "reserved");
  assert.equal(started.ledger[0].estimate, 0.123);
  assert.equal(started.characters[0].sheet.status, "producing");
  const claim = await repository.claimStep(workerA, 60_000);
  assert.equal(claim?.step.kind, "character");
  const runId = started.run!.id;
  await repository.markSubmitting(planned.id, runId, claim!.step.id);
  assert.ok(await repository.recordSheetAttempt(planned.id, runId, claim!.step.id, { id: "a1", url: "/api/x/media/sheet-1.png", at: new Date().toISOString(), engine: "nano-banana", verdict: { ok: false, scores: { style: 4, traits: 2, pose: 4, clean: 4 }, note: "bıyık yok" }, cost: 0.041 }));
  assert.ok(await repository.markSubmitting(planned.id, runId, claim!.step.id), "the next attempt may be sent once the previous one is recorded");
  await repository.recordSheetAttempt(planned.id, runId, claim!.step.id, { id: "a2", url: "/api/x/media/sheet-2.png", at: new Date().toISOString(), engine: "nano-banana", verdict: { ok: true, scores: { style: 4, traits: 4, pose: 4, clean: 4 }, note: "uygun" }, cost: 0.041 });
  assert.ok(await repository.completeStep(planned.id, runId, claim!.step.id, { kind: "character", note: "", uncertain: false, failedSubmissions: 0 }));
  const done = await repository.getProject(planned.id);
  assert.equal(done.run?.status, "completed");
  assert.equal(done.status, "planned");
  assert.equal(done.characters[0].sheet.status, "review", "the judge never approves on the user's behalf");
  assert.equal(done.characters[0].sheet.chosen, "a2");
  assert.equal(done.ledger[0].status, "charged");
  assert.equal(done.ledger[0].actual, 0.082, "two attempts were used; the third attempt's reservation is returned");
  const approved = await repository.reviewCharacterSheet(planned.id, done.revision, "c1", "approve", null);
  assert.equal(approved.characters[0].sheet.status, "approved");
});

test("cancelling a character run returns every unsent reservation", async (t) => {
  const { repository } = await fixture(t, characterOptions);
  const planned = await plannedProject(repository);
  const added = await repository.addCharacter(planned.id, (await repository.updateProject(planned.id, { revision: planned.revision, budget: 1 })).revision, { name: "Lider", appearance: "", aliases: [], style: "" });
  const withPhoto = (await repository.setCharacterReference(planned.id, added.revision, "c1", photo)).project;
  const started = await repository.startCharacterRun(planned.id, withPhoto.revision, "char-cancel-0001", ["c1"], 0.123);
  const cancelled = await repository.cancelRun(planned.id, started.revision);
  assert.equal(cancelled.ledger[0].status, "released");
  assert.equal(cancelled.characters[0].sheet.status, "none");
});

test("referenceFrames quotes and reserves Nano Banana 2.1 for shots with approved character sheets", async (t) => {
  const { repository } = await fixture(t, { ...paidOptions, referenceImagePrice: async () => 0.041 });
  const planned = await plannedProject(repository);
  const added = await repository.addCharacter(planned.id, planned.revision, { name: "Yolcu", appearance: "mavi pelerin", aliases: ["dağların"], style: "" });
  const charRun = await repository.startCharacterRun(planned.id, added.revision, "char-free-00001", ["c1"], 0);
  const charStep = await repository.claimStep(workerA, 60_000);
  await repository.recordSheetAttempt(planned.id, charRun.run!.id, charStep!.step.id, { id: "a1", url: `/api/projects/${planned.id}/media/sheet-c1-1.jpg`, at: new Date().toISOString(), engine: "flux", verdict: { ok: true, scores: { style: 5, traits: 5, pose: 5, clean: 5 }, note: "uygun" }, cost: 0 });
  await repository.completeStep(planned.id, charRun.run!.id, charStep!.step.id, { kind: "character", note: "", uncertain: false, failedSubmissions: 0 });
  const approved = await repository.reviewCharacterSheet(planned.id, (await repository.getProject(planned.id)).revision, "c1", "approve", "a1");

  const quoted = await repository.prepareQuote(planned.id, {
    revision: approved.revision,
    quality: "economy",
    budget: 1,
    referenceFrames: true,
    selections: [],
  });
  assert.ok(quoted.quote);
  assert.equal(quoted.quote.lines.length, 1);
  assert.equal(quoted.quote.lines[0].kind, "image");
  assert.equal(quoted.quote.lines[0].modelId, "gemini-nano-banana-2.1");
  assert.equal(quoted.quote.lines[0].estimate, 0.041);

  const started = await repository.startRun(planned.id, quoted.revision, "ref-frame-run-01", quoted.quote.id);
  const imageStep = started.run!.steps.find((step) => step.kind === "image")!;
  assert.ok(imageStep.paid);
  assert.equal(imageStep.paid.model, "gemini-nano-banana-2.1");
  assert.equal(started.ledger.length, 1);
  assert.equal(started.ledger[0].kind, "image");
  assert.equal(started.ledger[0].status, "reserved");
});
