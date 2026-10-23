import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { access, mkdir, mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { createProjectRepository, type RepositoryOptions } from "../projects";
import type { ImageReview, SheetVerdict } from "../types";
import { findFfmpeg, renderImageClip } from "./ffmpeg";
import { changeSoundtrack } from "./soundtrack";
import { createProductionWorker, type ImageEngine, type VideoEngine } from "./worker";

const publicDirectory = path.join(process.cwd(), "public");
const script = "Sahne 1: Sisli dağların arasında sabahın ilk ışığı görünür.\n\nFinal: Yazı kartı: Yol, \"ışığa\" doğru %100 devam eder.";

async function setup(t: { after: (callback: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-worker-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: true, gmi: false, ffmpeg: true }) });
  const created = await repository.createProject({ title: "Film", script, style: "Sinematik", aspectRatio: "16:9", budget: 0 });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  await repository.startRun(planned.id, planned.revision, "worker-test-0001");
  return { repository, project: planned };
}

async function drain(worker: ReturnType<typeof createProductionWorker>) {
  for (let step = 0; step < 20 && await worker.runNext(); step += 1) { /* Run the queue to the end. */ }
}

test("the free pipeline turns a plan into a playable film", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project } = await setup(t);
  const reference = await readFile(path.join(publicDirectory, "images/mountains.jpg"));
  const reviews: ImageReview[] = [{ ok: false, note: "Dağ görünmüyor." }, { ok: true, note: "Uyumlu." }];
  const prompts: string[] = [];
  const engine: ImageEngine = {
    generate: async ({ prompt }) => { prompts.push(prompt); return reference; },
    review: async () => reviews.shift()!,
  };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => engine, log: () => {} });
  await drain(worker);

  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed", finished.run?.events.map((event) => event.message).join("\n"));
  assert.equal(prompts.length, 2, "a rejected frame is regenerated once");
  assert.match(prompts[0], /Visual style: Sinematik/);
  assert.equal(finished.scenes[0].imageSource, "generated");
  assert.deepEqual(finished.scenes[0].review, { ok: true, note: "Uyumlu.", issues: [] });
  assert.match(finished.run!.events.map((event) => event.message).join("\n"), /yeniden üretildi/);
  const output = finished.output!;
  const expected = finished.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  assert.ok(Math.abs(output.duration - expected) < 0.5, `${output.duration} ≈ ${expected}`);
  const media = path.join(repository.mediaDirectory, project.id);
  await access(path.join(media, output.url.split("/").pop()!));
  await access(path.join(media, finished.scenes[0].image.split("/").pop()!));
  assert.deepEqual((await readdir(media)).filter((name) => name === "runs"), [], "intermediate files are removed");

  // A second film keeps the unchanged frame and clips, replaces the first film and leaves no unused files behind.
  const again = await repository.startRun(project.id, finished.revision, "worker-test-0002");
  assert.equal(again.run?.status, "running");
  await drain(worker);
  const second = await repository.getProject(project.id);
  const log = second.run!.events.map((event) => event.message).join("\n");
  assert.equal(prompts.length, 2, "an unchanged frame is not generated (or reviewed) again");
  assert.equal(second.scenes[0].image, finished.scenes[0].image);
  assert.match(log, /Kare değişmediği için yeniden üretilmedi/);
  assert.match(log, /önceki klip kullanıldı/);
  assert.match(log, /önceki kart kullanıldı/);
  assert.notEqual(second.output?.url, output.url);
  assert.deepEqual((await readdir(media)).sort(), ["clips", second.output!.url.split("/").pop()!, second.scenes[0].image.split("/").pop()!].sort());
  assert.equal((await readdir(path.join(media, "clips"))).length, second.scenes.length, "one cached clip per shot");

  // Changing one shot remakes only that shot's frame and clip.
  const edited = await repository.updateScene(project.id, second.scenes[0].id, second.revision, { prompt: "Misty mountains at dawn, wide shot" });
  await repository.startRun(project.id, edited.revision, "worker-test-0003");
  reviews.push({ ok: true, note: "" });
  await drain(worker);
  const third = await repository.getProject(project.id);
  assert.equal(prompts.length, 3);
  assert.match(prompts[2], /Misty mountains at dawn/);
  assert.notEqual(third.scenes[0].image, second.scenes[0].image);
  assert.match(third.run!.events.map((event) => event.message).join("\n"), /önceki kart kullanıldı/, "the untouched title card is reused");
  assert.equal((await readdir(path.join(media, "clips"))).length, third.scenes.length, "the old clip of the changed shot is removed");
});

test("a frame flagged by the reviewer is made again on the next frames run unless the user keeps the frames", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project } = await setup(t);
  const reference = await readFile(path.join(publicDirectory, "images/mountains.jpg"));
  let generated = 0;
  const flagged: ImageReview = { ok: false, note: "El bozuk.", issues: [{ problem: "Altı parmak", fix: "Five fingers", box: [0.1, 0.5, 0.3, 0.9] }] };
  const engine: ImageEngine = { generate: async () => { generated += 1; return reference; }, review: async () => flagged };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => engine, log: () => {} });
  await drain(worker);
  const first = await repository.getProject(project.id);
  assert.equal(generated, 2, "a flagged free frame gets one fresh attempt");
  assert.match(first.run!.steps[0].note, /yalnızca o bölge onarılarak/);
  await repository.startRun(project.id, first.revision, "flagged-keep-0001", null, { reuseImages: true });
  await drain(worker);
  assert.equal(generated, 2, "\"film from existing frames\" keeps a flagged frame");
  await repository.startRun(project.id, (await repository.getProject(project.id)).revision, "flagged-redo-0001", null, { target: "frames" });
  await drain(worker);
  assert.equal(generated, 4, "a frames run remakes the flagged frame");
});

test("without an image engine the run uses the reference image", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project } = await setup(t);
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, log: () => {} });
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(finished.scenes[0].image, "/images/mountains.jpg");
  assert.equal(finished.scenes[0].imageSource, "reference");
  assert.ok(finished.output);
});

test("a provider error that cannot succeed stops the run with its message", async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project } = await setup(t);
  const { ProviderError } = await import("../providers/nvidia");
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => ({ generate: async () => { throw new ProviderError("Görsel, sağlayıcının içerik filtresine takıldı.", false); } }), log: () => {} });
  await drain(worker);
  const failed = await repository.getProject(project.id);
  assert.equal(failed.run?.status, "failed");
  assert.match(failed.run!.events.at(-1)!.message, /içerik filtresine/);
  assert.equal(failed.output, null);
});

const prices = new Map([["veo-3.1-lite-generate-001", { perSecond: 0.03, perRequest: null }]]);

async function paidSetup(t: { after: (callback: () => Promise<void>) => void }) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-paid-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: false, gmi: true, ffmpeg: true }), videoPrices: async () => prices });
  const created = await repository.createProject({ title: "Film", script, style: "Sinematik", aspectRatio: "16:9", budget: null });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  const scene = planned.scenes.find((item) => item.kind === "video")!;
  const quoted = await repository.prepareQuote(planned.id, { revision: planned.revision, quality: "economy", budget: 1, selections: [{ sceneId: scene.id, motion: "ai", videoModel: null }] });
  await repository.startRun(quoted.id, quoted.revision, "paid-worker-0001", quoted.quote!.id);
  // A short real clip stands in for the provider's video.
  const providerClip = path.join(directory, "provider.mp4");
  await renderImageClip({ image: path.join(publicDirectory, "images/desert.jpg"), output: providerClip, duration: 3, aspectRatio: "16:9", camera: "Sabit kadraj" });
  return { repository, project: quoted, providerClip: await readFile(providerClip) };
}

function fakeVideo(providerClip: Buffer, submit: () => Promise<string>) {
  const calls = { upload: 0, submit: 0, status: 0 };
  const engine: VideoEngine = {
    upload: async () => { calls.upload += 1; return "https://storage.example/frame.jpg"; },
    submit: async (model, payload) => { calls.submit += 1; assert.equal(model, "veo-3.1-lite-generate-001"); assert.equal(payload.image, "https://storage.example/frame.jpg"); return submit(); },
    status: async () => { calls.status += 1; return calls.status < 2 ? { state: "pending" } : { state: "success", mediaUrl: "https://storage.example/out.mp4" }; },
    download: async () => providerClip,
  };
  return { engine, calls };
}

test("a paid shot is uploaded, sent once, polled and cut into the film", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project, providerClip } = await paidSetup(t);
  const { engine, calls } = fakeVideo(providerClip, async () => "req-1");
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed", finished.run?.events.map((event) => event.message).join("\n"));
  assert.deepEqual(calls, { upload: 1, submit: 1, status: 2 });
  assert.equal(finished.ledger[0].status, "charged");
  assert.equal(finished.ledger[0].requestId, "req-1");
  const expected = finished.scenes.reduce((sum, scene) => sum + scene.duration, 0);
  assert.ok(Math.abs(finished.output!.duration - expected) < 0.5, "a short provider clip is held to the shot's length");
});

test("an unacknowledged submission falls back to free motion without resending", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project, providerClip } = await paidSetup(t);
  const { ProviderError } = await import("../providers/nvidia");
  const { engine, calls } = fakeVideo(providerClip, async () => { throw new ProviderError("GMI'a bağlanılamadı.", true); });
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(calls.submit, 1);
  assert.equal(finished.ledger[0].status, "failed", "its possible cost stays counted");
  assert.match(finished.ledger[0].note, /Belirsiz/);
});

test("a rejected request creates no job and returns its reservation", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project, providerClip } = await paidSetup(t);
  const { ProviderError } = await import("../providers/nvidia");
  const { engine } = fakeVideo(providerClip, async () => { throw new ProviderError("GMI bakiyesi yetersiz.", false); });
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(finished.ledger[0].status, "released");
});

test("after a crash mid-poll the job is picked up again without a second submission", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project, providerClip } = await paidSetup(t);
  const runId = project.run?.id ?? (await repository.getProject(project.id)).run!.id;
  const dead = "2147483647:crashed";
  const image = await repository.claimStep(dead, 60_000);
  await repository.completeStep(project.id, runId, image!.step.id, { kind: "image", url: "/images/mountains.jpg", source: "reference", review: null, note: "" });
  const video = await repository.claimStep(dead, 600_000);
  await repository.markSubmitting(project.id, runId, video!.step.id);
  await repository.recordRequest(project.id, runId, video!.step.id, "req-before-crash");
  const { engine, calls } = fakeVideo(providerClip, async () => { throw new Error("must not be called"); });
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(calls.submit, 0);
  assert.equal(finished.ledger[0].status, "charged");
});

function meanVolume(ffmpeg: string, file: string): number {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-i", file, "-map", "0:a", "-af", "volumedetect", "-f", "null", "-"], { encoding: "utf8" });
  const match = result.stderr.match(/mean_volume: (-?[\d.]+) dB/);
  if (!match) throw new Error(`volumedetect failed: ${result.stderr.slice(-300)}`);
  return Number(match[1]);
}

test("music is mixed into the montage and can be removed again without re-rendering", { timeout: 120_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-music-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: false, gmi: false, ffmpeg: true }) });
  const created = await repository.createProject({ title: "Müzikli", script, style: "Sinematik", aspectRatio: "16:9", budget: null });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  const media = path.join(repository.mediaDirectory, planned.id);
  await mkdir(media, { recursive: true });
  const tone = spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=frequency=440:duration=40", "-c:a", "pcm_s16le", path.join(media, "music-test.wav")]);
  assert.equal(tone.status, 0);
  const withMusic = await repository.commitSoundtrack(planned.id, planned.revision, { file: "music-test.wav", name: "Test tonu", duration: 40, volume: 1, offset: 2 });
  await repository.startRun(planned.id, withMusic.revision, "music-run-000001");
  await drain(createProductionWorker({ repository, publicDirectory, imageEngine: () => null, log: () => {} }));
  const finished = await repository.getProject(planned.id);
  assert.equal(finished.run?.status, "completed", finished.run?.events.map((event) => event.message).join("\n"));
  const film = path.join(media, finished.output!.url.split("/").pop()!);
  assert.ok(meanVolume(ffmpeg, film) > -40, "the film carries the music");
  assert.match(finished.run!.events.at(-2)!.message + finished.run!.steps.at(-1)!.note, /Müzik eklendi/);

  const silent = await changeSoundtrack(repository, planned.id, finished.revision, null);
  assert.equal(silent.music, null);
  assert.notEqual(silent.output!.url, finished.output!.url);
  assert.ok(meanVolume(ffmpeg, path.join(media, silent.output!.url.split("/").pop()!)) < -80, "removing music leaves a silent track");
  await assert.rejects(access(film), "the replaced film file is removed");
  await assert.rejects(access(path.join(media, "music-test.wav")), "the removed music file is deleted");
  assert.ok(Math.abs(silent.output!.duration - finished.output!.duration) < 0.01);
});

async function characterSetup(t: { after: (callback: () => Promise<void>) => void }, withPhoto: boolean, extra: RepositoryOptions = {}) {
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-char-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: true, gmi: true, ffmpeg: true }), referenceImagePrice: async () => 0.041, ...extra });
  const created = await repository.createProject({ title: "Karakter", script, style: "Sinematik", aspectRatio: "16:9", budget: 1 });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  let project = await repository.addCharacter(planned.id, planned.revision, { name: "Lider", appearance: "askeri kasket, ince bıyık", aliases: [], style: "stylized 3D caricature" });
  if (withPhoto) {
    const media = path.join(repository.mediaDirectory, project.id);
    await mkdir(media, { recursive: true });
    await writeFile(path.join(media, "ref-c1-test.jpg"), await readFile(path.join(publicDirectory, "images/space.jpg")));
    project = (await repository.setCharacterReference(project.id, project.revision, "c1", { source: "upload", title: "foto.jpg", pageUrl: null, file: "ref-c1-test.jpg", author: "Kullanıcı", license: "Kullanıcı yüklemesi", licenseUrl: null, addedAt: new Date().toISOString() })).project;
  }
  await repository.startCharacterRun(project.id, project.revision, `char-${withPhoto ? "photo" : "text"}-0001`, ["c1"], withPhoto ? 0.123 : 0);
  return { repository, projectId: project.id };
}

const image = () => readFile(path.join(publicDirectory, "images/mountains.jpg"));

test("the judge sends a rejected sheet back for another attempt and the user gets the passing one", async (t) => {
  const { repository, projectId } = await characterSetup(t, false);
  const prompts: string[] = [];
  const verdicts = [{ ok: false, scores: { style: 2, traits: 3, pose: 4, clean: 4 }, note: "fotoğraf gibi" }, { ok: true, scores: { style: 4, traits: 4, pose: 4, clean: 4 }, note: "uygun" }];
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => ({ generate: async ({ prompt }) => { prompts.push(prompt); return image(); } }), sheetJudge: () => async () => verdicts.shift()!, log: () => {} });
  await drain(worker);
  const done = await repository.getProject(projectId);
  const sheet = done.characters[0].sheet;
  assert.equal(prompts.length, 2);
  assert.match(prompts[0], /stylized 3D caricature\. askeri kasket, ince bıyık\. Single character/);
  assert.equal(sheet.status, "review");
  assert.equal(sheet.attempts.length, 2);
  assert.equal(sheet.chosen, sheet.attempts[1].id);
  assert.equal(done.ledger.length, 0, "description-based sheets cost nothing");
  await access(path.join(repository.mediaDirectory, projectId, sheet.attempts[1].url.split("/").pop()!));
});

test("a photo-based sheet is sent once per attempt and its cost is recorded", async (t) => {
  const { repository, projectId } = await characterSetup(t, true);
  const calls = { upload: 0, submit: 0 };
  const engine: VideoEngine = {
    upload: async () => { calls.upload += 1; return "https://storage.example/ref.jpg"; },
    submit: async (model, payload) => { calls.submit += 1; assert.equal(model, "gemini-nano-banana-2.1"); assert.deepEqual(payload.image, ["https://storage.example/ref.jpg"]); assert.equal(payload.aspect_ratio, "1:1"); return `req-${calls.submit}`; },
    status: async () => ({ state: "success", mediaUrl: "https://storage.example/sheet.png" }),
    download: image,
  };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, sheetJudge: () => async () => ({ ok: true, scores: { style: 5, traits: 4, pose: 4, clean: 5 }, note: "benziyor" }), pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const done = await repository.getProject(projectId);
  assert.deepEqual(calls, { upload: 1, submit: 1 });
  assert.equal(done.characters[0].sheet.status, "review");
  assert.equal(done.ledger[0].status, "charged");
  assert.equal(done.ledger[0].actual, 0.041);
});

test("a refused photo-based request is not reworded or resent", async (t) => {
  const { repository, projectId } = await characterSetup(t, true);
  let submits = 0;
  const engine: VideoEngine = {
    upload: async () => "https://storage.example/ref.jpg",
    submit: async () => { submits += 1; return "req-refused"; },
    status: async () => ({ state: "failed", message: "GMI işi başarısız oldu (failed): policy." }),
    download: image,
  };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, sheetJudge: () => async () => ({ ok: true, scores: { style: 5, traits: 5, pose: 5, clean: 5 }, note: "" }), pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const done = await repository.getProject(projectId);
  assert.equal(submits, 1);
  assert.equal(done.characters[0].sheet.status, "failed");
  assert.match(done.characters[0].sheet.note, /yeniden gönderilmez/);
  assert.equal(done.ledger[0].status, "failed", "a failed job may still be billed, so it stays counted");
});

test("after a crash between marking and sending, the attempt is not sent again", async (t) => {
  const { repository, projectId } = await characterSetup(t, true);
  const runId = (await repository.getProject(projectId)).run!.id;
  const claim = await repository.claimStep("2147483647:crashed", 600_000);
  await repository.markSubmitting(projectId, runId, claim!.step.id);
  let submits = 0;
  const engine: VideoEngine = { upload: async () => "https://x/ref.jpg", submit: async () => { submits += 1; return "never"; }, status: async () => ({ state: "pending" }), download: image };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const done = await repository.getProject(projectId);
  assert.equal(submits, 0);
  assert.equal(done.ledger[0].status, "submitted", "an uncertain submission stays counted against the budget");
  assert.match(done.characters[0].sheet.note, /belirsiz/);
});

test("approved character sheets are passed as reference images when generating scene frames", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-ref-scene-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, {
    providers: async () => ({ nvidia: true, gmi: true, ffmpeg: true }),
    videoPrices: async () => prices,
    referenceImagePrice: async () => 0.041,
  });
  const created = await repository.createProject({ title: "Referanslı", script, style: "Anime", aspectRatio: "16:9", budget: 1 });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  const added = await repository.addCharacter(planned.id, planned.revision, { name: "Fotoğrafçı", appearance: "denim jacket, camera strap", aliases: ["dağların"], style: "Anime" });
  const media = path.join(repository.mediaDirectory, planned.id);
  await mkdir(media, { recursive: true });
  await writeFile(path.join(media, "sheet-c1-approved.jpg"), await image());
  const charRun = await repository.startCharacterRun(planned.id, added.revision, "char-approve-01", ["c1"], 0);
  const charStep = await repository.claimStep("1:test", 60_000);
  await repository.recordSheetAttempt(planned.id, charRun.run!.id, charStep!.step.id, { id: "a1", url: `/api/projects/${planned.id}/media/sheet-c1-approved.jpg`, at: new Date().toISOString(), engine: "flux", verdict: { ok: true, scores: { style: 5, traits: 5, pose: 5, clean: 5 }, note: "" }, cost: 0 });
  await repository.completeStep(planned.id, charRun.run!.id, charStep!.step.id, { kind: "character", note: "", uncertain: false, failedSubmissions: 0 });
  const approved = await repository.reviewCharacterSheet(planned.id, (await repository.getProject(planned.id)).revision, "c1", "approve", "a1");

  const quoted = await repository.prepareQuote(planned.id, {
    revision: approved.revision,
    quality: "economy",
    budget: 1,
    referenceFrames: true,
    selections: [],
  });
  await repository.startRun(planned.id, quoted.revision, "ref-scene-run-01", quoted.quote!.id);

  const submittedPayloads: Record<string, unknown>[] = [];
  let reviewRefCount = 0;
  const videoEngine: VideoEngine = {
    upload: async () => "https://storage.example/sheet-c1-approved.jpg",
    submit: async (model, payload) => {
      assert.equal(model, "gemini-nano-banana-2.1");
      submittedPayloads.push(payload);
      return "req-scene-ref-1";
    },
    status: async () => ({ state: "success", mediaUrl: "https://storage.example/scene-frame.png" }),
    download: image,
  };
  const imageEngine: ImageEngine = {
    generate: async () => { throw new Error("FLUX must not be called when reference sheet is used"); },
    review: async ({ characterSheets }) => {
      reviewRefCount = characterSheets?.length ?? 0;
      return { ok: true, note: "Karakter referansıyla uyumlu." };
    },
  };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => imageEngine, videoEngine: () => videoEngine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);

  const finished = await repository.getProject(planned.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(submittedPayloads.length, 1);
  assert.deepEqual(submittedPayloads[0].image, ["https://storage.example/sheet-c1-approved.jpg"]);
  assert.match(String(submittedPayloads[0].prompt), /Reference image 1 is the approved character sheet for Fotoğrafçı/);
  assert.equal(reviewRefCount, 1, "Vision judge receives the approved character sheet for comparison");
  assert.equal(finished.ledger[0].status, "charged");
  assert.equal(finished.ledger[0].kind, "image");
});

test("native Flow pipeline makes a judged character, then a frame, then a playable film", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-full-flow-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: true, gmi: false, ffmpeg: true }) });
  const project = await repository.importStoryboard({ title: "Flow entegrasyon testi", style: "İllüstrasyon", aspectRatio: "16:9", budget: 0,
    shots: [{ id: "T1", durationSec: 2, visualSummary: "Gezgin dağa bakar.", aiPrompt: "Traveler looking at mountains" }],
    characters: [{ name: "Gezgin", appearance: "Adult traveler in a green coat", aliases: ["Gezgin", "Traveler"], style: "Illustration" }] });
  await repository.startRun(project.id, project.revision, "full-flow-test-0001", null, { prepareCharacters: true, reuseImages: true });
  const image = await readFile(path.join(publicDirectory, "images/mountains.jpg"));
  const generated: string[] = [];
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => ({ generate: async ({prompt}) => { generated.push(prompt); return image; }, review: async () => ({ ok: true, note: "Uygun" }) }),
    sheetJudge: () => async () => ({ ok: true, scores: { style: 5, traits: 5, pose: 5, clean: 5 }, note: "Uygun" }), log: () => {} });
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed");
  assert.equal(finished.characters[0].sheet.status, "approved");
  assert.equal(generated.length, 2);
  assert.match(generated[0], /Character reference sheet/);
  assert.match(generated[1], /Traveler looking at mountains/);
  assert.equal(finished.ledger.length, 0);
  assert.ok(finished.output && finished.output.duration >= 1.9);
});

/** One pixel of an image file, as rgb24 or rgba bytes. */
function pixel(ffmpeg: string, file: string, x: number, y: number, format: "rgb24" | "rgba" = "rgb24"): number[] {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-v", "error", "-i", file, "-vf", `crop=1:1:${x}:${y}`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", format, "-"]);
  assert.equal(result.status, 0, result.stderr?.toString());
  return [...result.stdout];
}

function stillImage(ffmpeg: string, file: string, source: string) {
  const result = spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", source, "-frames:v", "1", file]);
  assert.equal(result.status, 0, result.stderr?.toString());
}

test("a paid clip is kept and reused by later films and quotes instead of being bought again", { timeout: 120_000 }, async (t) => {
  if (!(await findFfmpeg())) return t.skip("FFmpeg yok");
  const { repository, project, providerClip } = await paidSetup(t);
  const { engine, calls } = fakeVideo(providerClip, async () => "req-1");
  const frames: ImageEngine = { generate: async () => readFile(path.join(publicDirectory, "images/mountains.jpg")) };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => frames, videoEngine: () => engine, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const paid = await repository.getProject(project.id);
  assert.equal(paid.run?.status, "completed", paid.run?.events.map((event) => event.message).join("\n"));
  assert.equal(paid.clips.length, 1);
  assert.equal(paid.clips[0].model, "veo-3.1-lite-generate-001");

  // A free film made afterwards keeps the paid motion.
  await repository.startRun(project.id, paid.revision, "reuse-free-0001");
  await drain(worker);
  const free = await repository.getProject(project.id);
  assert.match(free.run!.events.map((event) => event.message).join("\n"), /Veo 3\.1 Lite\) kullanıldı; yeniden ücret ödenmedi/);
  await access(path.join(repository.mediaDirectory, project.id, "clips", paid.clips[0].file));

  // A new quote for the same shot charges nothing for it.
  const scene = free.scenes.find((item) => item.kind === "video")!;
  const quoted = await repository.prepareQuote(project.id, { revision: free.revision, quality: "economy", budget: 1, selections: [{ sceneId: scene.id, motion: "ai", videoModel: null }] });
  assert.equal(quoted.quote!.lines.length, 0);
  assert.deepEqual(quoted.quote!.reused.map((line) => [line.kind, line.modelLabel]), [["video", "Veo 3.1 Lite"]]);
  assert.ok(quoted.quote!.reused[0].saved > 0, "the quote shows what reusing the clip saves");
  // Asking for a better tier than the clip's model is a new purchase.
  const better = await repository.prepareQuote(project.id, { revision: quoted.revision, quality: "balanced", budget: 1, selections: [{ sceneId: scene.id, motion: "ai", videoModel: null }] });
  assert.equal(better.quote!.reused.length, 0);
  assert.equal(calls.submit, 1);
});

test("a region repair redraws only the marked box, keeps every other pixel and can be undone", { timeout: 120_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-repair-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: true, gmi: true, ffmpeg: true }), repairPrice: async () => 0.0255 });
  const created = await repository.createProject({ title: "Onarım", script, style: "Sinematik", aspectRatio: "16:9", budget: 1 });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  await repository.startRun(planned.id, planned.revision, "repair-frames-01", null, { target: "frames" });
  const original = path.join(directory, "original.png");
  const red = path.join(directory, "red.png");
  stillImage(ffmpeg, original, "testsrc2=s=1360x768");
  stillImage(ffmpeg, red, "color=c=red:s=1024x576");
  const uploads: Buffer[] = [];
  const submitted: { model: string; payload: Record<string, unknown> }[] = [];
  const gmi: VideoEngine = {
    upload: async (image) => { uploads.push(image); return `https://storage.example/u${uploads.length}.png`; },
    submit: async (model, payload) => { submitted.push({ model, payload }); return "req-fix"; },
    status: async () => ({ state: "success", mediaUrl: "https://storage.example/edited.png" }),
    download: () => readFile(red),
  };
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => ({ generate: () => readFile(original), review: async () => ({ ok: true, note: "Düzgün." }) }), videoEngine: () => gmi, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const framed = await repository.getProject(planned.id);
  const scene = framed.scenes.find((item) => item.kind === "video")!;
  assert.equal(scene.imageSource, "generated");

  const estimate = await repository.estimateRepair(planned.id);
  assert.deepEqual([estimate.unitCost, estimate.problems], [0.0255, []]);
  await assert.rejects(repository.startRepair(planned.id, framed.revision, "repair-run-0001", { target: { sceneId: scene.id }, box: [0.25, 0.25, 0.5, 0.5], instruction: "Five fingers", maxCost: 0.02 }), /Fiyat değişti/);
  const started = await repository.startRepair(planned.id, framed.revision, "repair-run-0002", { target: { sceneId: scene.id }, box: [0.25, 0.25, 0.5, 0.5], instruction: "Redraw the hand with five fingers", maxCost: 0.0255 });
  assert.equal(started.ledger.at(-1)?.status, "reserved");
  await drain(worker);

  const repaired = await repository.getProject(planned.id);
  const fixed = repaired.scenes.find((item) => item.id === scene.id)!;
  assert.equal(repaired.run?.status, "completed", repaired.run?.events.map((event) => event.message).join("\n"));
  assert.equal(submitted.length, 1);
  assert.equal(submitted[0].model, "gpt-image-2.5-sunburst-edit");
  assert.deepEqual([submitted[0].payload.image, submitted[0].payload.mask, submitted[0].payload.size], ["https://storage.example/u1.png", "https://storage.example/u2.png", "1360x768"]);
  assert.match(String(submitted[0].payload.prompt), /Edit only the transparent \(masked\) area.*five fingers/);
  assert.deepEqual([repaired.ledger.at(-1)?.status, repaired.ledger.at(-1)?.actual], ["charged", 0.0255]);
  assert.equal(fixed.repair?.previous, scene.image);
  assert.notEqual(fixed.image, scene.image);

  const media = path.join(repository.mediaDirectory, planned.id);
  const after = path.join(media, fixed.image.split("/").pop()!);
  const before = path.join(media, scene.image.split("/").pop()!);
  const [r, g, b] = pixel(ffmpeg, after, 510, 288);
  assert.ok(r > 200 && g < 60 && b < 60, `inside the box the edit is used (${r},${g},${b})`);
  for (const [x, y] of [[1200, 700], [30, 30], [1000, 150]]) assert.deepEqual(pixel(ffmpeg, after, x, y), pixel(ffmpeg, before, x, y), `pixel ${x},${y} is untouched`);
  const mask = path.join(directory, "mask.png");
  await writeFile(mask, uploads[1]);
  assert.equal(pixel(ffmpeg, mask, 510, 288, "rgba")[3], 0, "the model may only redraw inside the box");
  assert.equal(pixel(ffmpeg, mask, 1200, 700, "rgba")[3], 255);

  const undone = await repository.revertRepair(planned.id, repaired.revision, scene.id);
  const restored = undone.scenes.find((item) => item.id === scene.id)!;
  assert.equal(restored.image, scene.image);
  assert.equal(restored.repair, null);
});

test("a rejected photo-based sheet with a located defect is repaired in place, not drawn again", { timeout: 120_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const { repository, projectId } = await characterSetup(t, true, { repairPrice: async () => 0.0255 });
  const red = path.join(repository.mediaDirectory, "..", "red.png");
  stillImage(ffmpeg, red, "color=c=red:s=1024x1024");
  const models: string[] = [];
  const engine: VideoEngine = {
    upload: async () => "https://storage.example/file.png",
    submit: async (model, payload) => { models.push(model); if (model !== "gemini-nano-banana-2.1") assert.ok(payload.mask); return `req-${models.length}`; },
    status: async () => ({ state: "success", mediaUrl: "https://storage.example/out.png" }),
    download: () => models.length === 1 ? image() : readFile(red),
  };
  const verdicts: SheetVerdict[] = [
    { ok: false, scores: { style: 4, traits: 4, pose: 4, clean: 2 }, note: "sağ elde fazla parmak", issues: [{ problem: "fazla parmak", fix: "five fingers on the right hand", box: [0.6, 0.6, 0.8, 0.9] }] },
    { ok: true, scores: { style: 4, traits: 4, pose: 4, clean: 4 }, note: "uygun", issues: [] },
  ];
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => engine, sheetJudge: () => async () => verdicts.shift()!, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  const done = await repository.getProject(projectId);
  const sheet = done.characters[0].sheet;
  assert.deepEqual(models, ["gemini-nano-banana-2.1", "gpt-image-2.5-sunburst-edit"]);
  assert.deepEqual(sheet.attempts.map((attempt) => [attempt.engine, attempt.cost]), [["nano-banana", 0.041], ["repair", 0.0255]]);
  assert.equal(sheet.chosen, sheet.attempts[1].id);
  assert.equal(done.ledger[0].actual, 0.0665, "only what was used is charged: one sheet and one repair");
  assert.match(done.run!.events.map((event) => event.message).join("\n"), /yalnızca işaretli bölge onarılacak|bölge onarıldı/i);
});

test("the project's look is graded into the film at montage without remaking frames or clips", { timeout: 120_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const { repository, project } = await setup(t);
  const colour = await readFile(path.join(publicDirectory, "images/desert.jpg"));
  let generated = 0;
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => ({ generate: async () => { generated += 1; return colour; } }), log: () => {} });
  await drain(worker);
  const plain = await repository.getProject(project.id);
  const graded = await repository.updateProject(project.id, { revision: plain.revision, look: "noir" });
  await repository.startRun(project.id, graded.revision, "look-run-000001");
  await drain(worker);
  const finished = await repository.getProject(project.id);
  assert.equal(finished.run?.status, "completed", finished.run?.events.map((event) => event.message).join("\n"));
  assert.equal(generated, 1, "a new look does not remake any frame");
  const film = path.join(repository.mediaDirectory, project.id, finished.output!.url.split("/").pop()!);
  const sample = spawnSync(ffmpeg, ["-hide_banner", "-v", "error", "-ss", "1.5", "-i", film, "-vf", "format=rgb24,crop=1:1:640:500", "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]);
  assert.equal(sample.status, 0, sample.stderr?.toString());
  const [r, g, b] = [...sample.stdout];
  assert.ok(Math.max(r, g, b) - Math.min(r, g, b) <= 6, `the noir look turns the desert grey (${r},${g},${b})`);
});

test("a location plate is drawn in the film's frame, not as a square character sheet", async (t) => {
  const { repository, projectId } = await characterSetup(t, false);
  const current = await repository.getProject(projectId);
  const placed = await repository.addCharacter(projectId, (await repository.cancelRun(projectId, current.revision)).revision, { name: "Liman", appearance: "small stone harbour, red fishing boats", aliases: [], style: "", kind: "place" });
  assert.equal(placed.characters.at(-1)?.id, "m1");
  await repository.startCharacterRun(projectId, placed.revision, "place-plate-0001", ["m1"], 0);
  const requests: { prompt: string; aspectRatio: string }[] = [];
  const judged: (string | undefined)[] = [];
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => ({ generate: async (request) => { requests.push(request); return image(); } }), sheetJudge: () => async (input) => { judged.push(input.kind); return { ok: true, scores: { style: 4, traits: 4, pose: 4, clean: 4 }, note: "" }; }, log: () => {} });
  await drain(worker);
  assert.deepEqual(requests.map((request) => request.aspectRatio), ["16:9"]);
  assert.match(requests[0].prompt, /^Location reference plate.*no people/);
  assert.deepEqual(judged, ["place"], "the judge is told it is looking at a place");
});

test("narration is spoken once, mixed into the film, and bought only for lines the quote included", { timeout: 180_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const { localVoices } = await import("./narration");
  if (!(await localVoices()).length) return t.skip("Türkçe yerel ses yok");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-voice-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const repository = createProjectRepository(directory, { providers: async () => ({ nvidia: false, gmi: true, ffmpeg: true }), videoPrices: async () => prices, voicePrice: async () => 0.06 });
  const created = await repository.createProject({ title: "Sesli", script, style: "Sinematik", aspectRatio: "16:9", budget: 1 });
  const planned = await repository.planProject(created.id, created.revision, "heuristic");
  const shot = planned.scenes.find((scene) => scene.kind === "video")!;
  const narrated = await repository.updateScene(planned.id, shot.id, planned.revision, { narration: "Sabah oldu." });
  const local = await repository.updateProject(planned.id, { revision: narrated.revision, narration: { engine: "local", voice: "Yelda", speed: 1, volume: 1 } });

  // Free draft: the macOS voice, cached by its text and voice.
  await repository.startRun(planned.id, local.revision, "voice-local-0001");
  const worker = createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => null, pollIntervalMs: 5, log: () => {} });
  await drain(worker);
  let project = await repository.getProject(planned.id);
  assert.equal(project.run?.status, "completed", project.run?.events.map((event) => event.message).join("\n"));
  const media = path.join(repository.mediaDirectory, planned.id);
  assert.ok(meanVolume(ffmpeg, path.join(media, project.output!.url.split("/").pop()!)) > -50, "the film carries the narration");
  assert.match(project.run!.steps.find((step) => step.kind === "voice")!.note, /Mac sesiyle/);
  await repository.startRun(planned.id, project.revision, "voice-local-0002");
  await drain(worker);
  project = await repository.getProject(planned.id);
  assert.match(project.run!.steps.find((step) => step.kind === "voice")!.note, /önceki ses kullanıldı/);

  // Paid voice: priced per character in the quote, bought once, then reused.
  const paidSettings = await repository.updateProject(planned.id, { revision: project.revision, narration: { engine: "gmi", voice: "Turkish_CalmWoman", speed: 1, volume: 1 } });
  const quoted = await repository.prepareQuote(planned.id, { revision: paidSettings.revision, quality: "economy", budget: 1, selections: [] });
  assert.deepEqual(quoted.quote!.lines.map((line) => [line.kind, line.modelId, line.estimate]), [["voice", "minimax-tts-speech-2.8-turbo", 0.0007]]);
  const tone = path.join(directory, "tone.mp3");
  assert.equal(spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=frequency=300:duration=1.5", tone]).status, 0);
  const payloads: Record<string, unknown>[] = [];
  const gmi: VideoEngine = {
    upload: async () => { throw new Error("nothing to upload"); },
    submit: async (model, payload) => { assert.equal(model, "minimax-tts-speech-2.8-turbo"); payloads.push(payload); return "req-voice"; },
    status: async () => ({ state: "success", mediaUrl: "https://storage.example/voice.mp3" }),
    download: () => readFile(tone),
  };
  await repository.startRun(planned.id, quoted.revision, "voice-paid-00001", quoted.quote!.id);
  await drain(createProductionWorker({ repository, publicDirectory, imageEngine: () => null, videoEngine: () => gmi, pollIntervalMs: 5, log: () => {} }));
  project = await repository.getProject(planned.id);
  assert.equal(project.run?.status, "completed", project.run?.events.map((event) => event.message).join("\n"));
  assert.deepEqual(payloads, [{ text: "Sabah oldu.", voice_id: "Turkish_CalmWoman", speed: 1, format: "mp3", language_boost: "Turkish" }]);
  const ledger = project.ledger.find((entry) => entry.kind === "voice")!;
  assert.deepEqual([ledger.status, ledger.actual], ["charged", 0.0007]);
  const again = await repository.prepareQuote(planned.id, { revision: project.revision, quality: "economy", budget: 1, selections: [] });
  assert.deepEqual([again.quote!.lines.length, again.quote!.reused.map((line) => line.kind)], [0, ["voice"]], "a voice already bought is not bought again");
});

test("music dips while the narration speaks and comes back after it", { timeout: 120_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const { applySoundtrack } = await import("./ffmpeg");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-duck-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const file = (name: string) => path.join(directory, name);
  assert.equal(spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "color=c=black:s=320x180:r=30:d=8", "-c:v", "libx264", "-pix_fmt", "yuv420p", file("film.mp4")]).status, 0);
  assert.equal(spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=frequency=220:duration=12", "-c:a", "pcm_s16le", file("music.wav")]).status, 0);
  assert.equal(spawnSync(ffmpeg, ["-hide_banner", "-y", "-f", "lavfi", "-i", "sine=frequency=1000:duration=2", "-af", "volume=4", "-c:a", "aac", file("voice.m4a")]).status, 0);
  await applySoundtrack({ film: file("film.mp4"), output: file("mixed.mp4"), duration: 8, music: { file: file("music.wav"), volume: 1, offset: 0 }, voices: [{ file: file("voice.m4a"), start: 3, length: 2 }] });
  // Measure only the music's 220 Hz band, before and during the speech.
  const band = (from: number) => {
    const result = spawnSync(ffmpeg, ["-hide_banner", "-ss", String(from), "-t", "1", "-i", file("mixed.mp4"), "-map", "0:a", "-af", "bandpass=f=220:width_type=q:w=4,volumedetect", "-f", "null", "-"], { encoding: "utf8" });
    return Number(result.stderr.match(/mean_volume: (-?[\d.]+) dB/)![1]);
  };
  const before = band(1.5);
  const during = band(3.6);
  assert.ok(during < before - 4, `the music is ducked under the voice (${before} dB → ${during} dB)`);
});
