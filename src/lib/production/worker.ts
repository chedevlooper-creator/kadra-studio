import { createHash, randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { mediaUrl, projectMediaDirectory, resolveImageFile } from "../media";
import { titleCardText } from "../planner";
import { bestAttempt, REFERENCE_MODEL, SHEET_ATTEMPTS, type ProjectRepository, type StepResult } from "../projects";
import type { RequestState } from "../providers/gmi";
import { ProviderError } from "../providers/nvidia";
import { VIDEO_MODELS } from "../routing/video-router";
import type { AspectRatio, Box, Character, ImageReview, Project, RunStep, Scene, SheetAttempt, SheetVerdict } from "../types";
import { AppError } from "../validation";
import { cameraMove, lookOf } from "../cinema";
import { GMI_VOICES, LOCAL_VOICE, narrationText, VOICE_LABEL, VOICE_MODEL } from "../voices";
import { applySoundtrack, compositeRegion, concatClips, convertAudio, FfmpegError, fitImage, inspectAudio, inspectVideo, probeImage, renderImageClip, renderMask, renderTitleClip, renderVideoClip } from "./ffmpeg";
import { narrationTracks, speakLocally, standInSettings, voiceCandidates, voiceFile, voiceKey } from "./narration";
import { imagePrompt, issueInstruction, repairPrompt, sceneSheetPrompt, sheetPrompt, videoPrompt } from "./prompts";
import { frameModel } from "../routing/frame-router";
import { aiClipKey, approvedCharacterSheets, cameraClipKey, clipFile, continuityFrame, editSize, frameIsCurrent, frameKeys, keptClips, REPAIR_MODEL, repairRegions, reusableClip, titleClipKey } from "./reuse";

const LEASE_MS = 6 * 60_000;
const IDLE_MS = 1_500;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
const exists = (file: string) => access(file).then(() => true, () => false);

/** Paid GMI jobs: image-to-video, reference-guided images and region repairs. Only submit() can cost money. */
export interface VideoEngine {
  upload(image: Buffer, type: "jpg" | "png"): Promise<string>;
  submit(model: string, payload: Record<string, unknown>): Promise<string>;
  status(requestId: string): Promise<RequestState>;
  download(url: string): Promise<Buffer>;
}

export interface ImageEngine {
  generate(request: { prompt: string; aspectRatio: AspectRatio; seed: number }): Promise<Buffer>;
  review?(request: { image: Buffer; expectation: string; characterSheets?: { name: string; image: Buffer }[] }): Promise<ImageReview>;
}

export interface WorkerOptions {
  repository: Pick<ProjectRepository, "claimStep" | "completeStep" | "failStep" | "markSubmitting" | "recordRequest" | "extendLease" | "recordSheetAttempt" | "mediaDirectory">;
  publicDirectory: string;
  /** Read at each step so a key added to .env.local is picked up without restarting a long-lived worker. */
  imageEngine: () => ImageEngine | null;
  /** Paid GMI jobs: reference-guided character sheets, image-to-video and region repairs. */
  videoEngine?: () => VideoEngine | null;
  sheetJudge?: () => ((input: { image: Buffer; reference: Buffer | null; name: string; appearance: string; style: string; kind?: Character["kind"] }) => Promise<SheetVerdict>) | null;
  sheetTimeoutMs?: number;
  pollIntervalMs?: number;
  videoTimeoutMs?: number;
  /** Paid-only product mode: a failed paid job stops the run instead of falling back to a free render. */
  paidOnly?: boolean;
  log?: (message: string) => void;
}

/** How a paid region repair ended: done, never sent, sent with an unknown outcome, or sent and failed (maybe billed). */
type RepairOutcome = { state: "done"; image: Buffer; requestId: string } | { state: "unsent" | "unknown" | "failed"; message: string };

function seedFor(sceneId: string, attempt: number): number {
  return createHash("sha256").update(`${sceneId}:${attempt}`).digest().readUInt32BE(0) % 2_147_483_647;
}

function failure(error: unknown): { message: string; retryable: boolean } {
  if (error instanceof ProviderError) return { message: error.message, retryable: error.retryable };
  if (error instanceof AppError) return { message: error.message, retryable: false };
  if (error instanceof FfmpegError) return { message: error.message, retryable: true };
  return { message: error instanceof Error ? error.message.slice(0, 300) : "Bilinmeyen hata.", retryable: true };
}

/** Renders to a temporary name first, so a crash mid-render never leaves a half file that looks like a finished clip. */
async function renderOnce(target: string, render: (output: string) => Promise<void>): Promise<void> {
  await mkdir(path.dirname(target), { recursive: true });
  const temporary = path.join(path.dirname(target), `.tmp-${randomUUID()}${path.extname(target)}`);
  try { await render(temporary); await rename(temporary, target); }
  finally { await rm(temporary, { force: true }); }
}

export function createProductionWorker(options: WorkerOptions) {
  const owner = `${process.pid}:${randomUUID()}`;
  const mediaRoot = options.repository.mediaDirectory;
  const log = options.log ?? ((message: string) => console.warn(message));
  const paidOnly = options.paidOnly ?? false;
  const clipsDirectory = (projectId: string) => path.join(projectMediaDirectory(mediaRoot, projectId), "clips");

  async function review(engine: ImageEngine | null, image: Buffer, expectation: string, characterSheets: { name: string; image: Buffer }[] = []): Promise<ImageReview | null> {
    if (!engine?.review) return null;
    try { return await engine.review({ image, expectation, characterSheets }); }
    catch (error) { return { ok: true, note: `Görsel kontrolü yapılamadı (${failure(error).message}); görsel kabul edildi.`, issues: [] }; }
  }

  async function loadCharacterSheets(project: Project, scene: Scene): Promise<{ character: Character; image: Buffer }[]> {
    const directory = projectMediaDirectory(mediaRoot, project.id);
    const loaded: { character: Character; image: Buffer }[] = [];
    for (const item of approvedCharacterSheets(project, scene).slice(0, 4)) {
      try { loaded.push({ character: item.character, image: await readFile(path.join(directory, item.file)) }); }
      catch { /* Sheet file missing; skip rather than failing the shot. */ }
    }
    return loaded;
  }

  /** Waits for a paid job; keeps the step's lease alive while it waits. */
  async function waitFor(engine: VideoEngine, requestId: string, project: Project, runId: string, step: RunStep, timeoutMs: number): Promise<RequestState> {
    const deadline = Date.now() + timeoutMs;
    let heartbeat = Date.now();
    while (true) {
      let state: RequestState | null = null;
      try { state = await engine.status(requestId); }
      catch (error) { if (!failure(error).retryable) throw error; }
      if (state && state.state !== "pending") return state;
      if (Date.now() > deadline) return { state: "pending" };
      if (Date.now() - heartbeat > 60_000) { await options.repository.extendLease(project.id, runId, step.id, owner, LEASE_MS); heartbeat = Date.now(); }
      await sleep(options.pollIntervalMs ?? 5_000);
    }
  }

  /**
   * Redraws only `boxes` of the image through the masked edit model, then pastes those regions back into the
   * untouched original. Follows the paid-step rules: marked before sending, sent at most once, resumed by polling.
   */
  async function regionRepair(gmi: VideoEngine, project: Project, runId: string, step: RunStep, file: string, boxes: Box[], instruction: string, pendingRequest: string | null): Promise<RepairOutcome> {
    const work = await mkdtemp(path.join(os.tmpdir(), "kadra-repair-"));
    try {
      let requestId = pendingRequest;
      if (!requestId) {
        if (step.paid?.submittedAt) return { state: "unknown", message: "Önceki onarım gönderiminin sonucu belirsiz; çift ücret olmaması için yeniden gönderilmedi." };
        const { width, height } = await probeImage(file);
        const size = editSize(width, height);
        const input = path.join(work, "input.png");
        const mask = path.join(work, "mask.png");
        await fitImage({ input: file, output: input, ...size });
        await renderMask({ ...size, boxes, output: mask });
        const imageUrl = await gmi.upload(await readFile(input), "png");
        const maskUrl = await gmi.upload(await readFile(mask), "png");
        if (!(await options.repository.markSubmitting(project.id, runId, step.id, "repair"))) throw new AppError(409, "Üretim durdurulduğu için istek gönderilmedi.");
        try {
          requestId = await gmi.submit(REPAIR_MODEL, { prompt: repairPrompt(instruction), image: imageUrl, mask: maskUrl, size: `${size.width}x${size.height}`, quality: "medium", output_format: "png", n: 1 });
        } catch (error) {
          const { message, retryable } = failure(error);
          // A clear rejection created no job; a lost connection may have.
          return retryable ? { state: "unknown", message: `Onarım gönderiminin sonucu belirsiz; yeniden gönderilmedi. ${message}` } : { state: "unsent", message };
        }
        await options.repository.recordRequest(project.id, runId, step.id, requestId);
      }
      const state = await waitFor(gmi, requestId, project, runId, step, options.sheetTimeoutMs ?? 5 * 60_000);
      if (state.state === "pending") return { state: "failed", message: `GMI onarımı zamanında tamamlamadı; istek ${requestId} sonradan tamamlanmış ve ücretlendirilmiş olabilir.` };
      if (state.state === "failed") return { state: "failed", message: state.message };
      const edited = path.join(work, "edited.png");
      await writeFile(edited, await gmi.download(state.mediaUrl));
      const output = path.join(work, "repaired.png");
      await compositeRegion({ original: file, edited, boxes, output });
      return { state: "done", image: await readFile(output), requestId };
    } finally { await rm(work, { recursive: true, force: true }); }
  }

  async function imageStep(project: Project, runId: string, step: RunStep, scene: Scene): Promise<StepResult> {
    const directory = projectMediaDirectory(mediaRoot, project.id);
    const engine = options.imageEngine();
    const expectation = `${scene.description} (Stil: ${project.style})`;
    const keys = frameKeys(project, scene);
    const run = project.run!;

    // A frame is only made again when what it is made from changed, the reviewer flagged it, or every frame was asked for.
    if (!step.paid && !run.regenerateImages && frameIsCurrent(project, scene) && (run.keepFlagged || scene.review?.ok !== false)) {
      return { kind: "image", url: scene.image, source: "generated", review: scene.review, note: "Kare değişmediği için yeniden üretilmedi.", frameKey: scene.frameKey || keys.flux };
    }

    const sheets = await loadCharacterSheets(project, scene);
    const sheetRefs = sheets.map(({ character, image }) => ({ name: character.name, image }));

    // Paid reference-guided scene frame: approved character sheets and location plates (and, for the same place, the
    // previous shot) go to the frame model the quote chose.
    if (step.paid) {
      const paid = step.paid;
      const spec = frameModel(paid.model) ?? frameModel(REFERENCE_MODEL)!;
      const gmi = options.videoEngine?.() ?? null;
      const fallbackFrame = async (reason: string, ledger: { status: "failed" | "released"; note: string }): Promise<StepResult> => {
        // Paid-only mode never substitutes a free frame: the run fails and the user decides.
        if (paidOnly) throw new AppError(503, `${reason} Ücretli kare üretilemedi; üretim durduruldu.`);
        if (scene.imageSource === "generated") return { kind: "image", url: scene.image, source: "generated", review: scene.review, note: `${reason} Mevcut kare korundu.`, ledger };
        if (!engine) return { kind: "image", url: scene.image, source: scene.imageSource, review: null, note: `${reason} Mevcut referans görsel kullanıldı.`, ledger };
        const generated = await engine.generate({ prompt: imagePrompt(project, scene), aspectRatio: project.aspectRatio, seed: seedFor(`${scene.id}:${runId}`, step.attempts) });
        const verdict = await review(engine, generated, expectation, sheetRefs);
        const file = `scene-${scene.id.slice(0, 8)}-${runId.slice(0, 8)}.jpg`;
        await mkdir(directory, { recursive: true });
        await writeFile(path.join(directory, file), generated);
        return { kind: "image", url: mediaUrl(project.id, file), source: "generated", review: verdict, note: `${reason} Ücretsiz FLUX.2 Klein ile üretildi.`, frameKey: keys.flux, ledger };
      };
      let requestId = paid.requestId;
      if (!requestId) {
        if (paid.submittedAt) return fallbackFrame("Önceki kare gönderiminin sonucu belirsiz; yeniden gönderilmedi.", { status: "failed", note: "Gönderim sırasında bağlantı koptu; GMI'da iş oluşmuş olabilir." });
        if (!gmi) return fallbackFrame("GMI bağlantısı bulunamadı.", { status: "released", note: "İstek gönderilmedi; ayrılan tutar bütçeye döndü." });
        const previous = continuityFrame(project, scene);
        const previousImage = previous ? await readFile(resolveImageFile(previous, { publicDirectory: options.publicDirectory, mediaDirectory: mediaRoot })).catch(() => null) : null;
        const references = [...sheets.map((item) => item.image).slice(0, spec.maxReferences - (previousImage ? 1 : 0)), ...(previousImage ? [previousImage] : [])];
        const imageUrls = await Promise.all(references.map((image) => gmi.upload(image, image[0] === 0x89 ? "png" : "jpg")));
        if (!(await options.repository.markSubmitting(project.id, runId, step.id))) throw new AppError(409, "Üretim durdurulduğu için istek gönderilmedi.");
        try {
          const prompt = sheets.length
            ? sceneSheetPrompt(project, scene, sheets.map((item) => item.character).slice(0, references.length - (previousImage ? 1 : 0)), Boolean(previousImage))
            : imagePrompt(project, scene);
          requestId = await gmi.submit(spec.id, spec.payload({
            prompt,
            imageUrls,
            aspectRatio: project.aspectRatio,
            seed: seedFor(`${scene.id}:${runId}`, 0),
          }));
        } catch (error) {
          const { message, retryable } = failure(error);
          return retryable
            ? fallbackFrame("GMI'a kare gönderiminin sonucu belirsiz; yeniden gönderilmedi.", { status: "failed", note: `Belirsiz gönderim: ${message}` })
            : fallbackFrame(`GMI kare isteğini reddetti: ${message}`, { status: "released", note: `Reddedildi: ${message} İş oluşmadı.` });
        }
        await options.repository.recordRequest(project.id, runId, step.id, requestId);
      }
      if (!gmi) return fallbackFrame("GMI bağlantısı kesildiği için kare alınamadı.", { status: "failed", note: `İstek ${requestId} GMI'da tamamlanmış olabilir.` });
      const state = await waitFor(gmi, requestId, project, runId, step, options.sheetTimeoutMs ?? 5 * 60_000);
      if (state.state === "pending") return fallbackFrame("GMI kareyi zamanında tamamlamadı.", { status: "failed", note: `Zaman aşımı: istek ${requestId} sonradan tamamlanmış olabilir.` });
      if (state.state === "failed") return fallbackFrame(state.message, { status: "failed", note: state.message });
      const image = await gmi.download(state.mediaUrl);
      const verdict = await review(engine, image, expectation, sheetRefs);
      const ext = image[0] === 0x89 ? "png" : "jpg";
      const file = `scene-${scene.id.slice(0, 8)}-${runId.slice(0, 8)}.${ext}`;
      await mkdir(directory, { recursive: true });
      await writeFile(path.join(directory, file), image);
      const repairHint = verdict && !verdict.ok && repairRegions(verdict.issues).length ? " İşaretli hata Storyboard'da yalnızca o bölge onarılarak düzeltilebilir." : "";
      return {
        kind: "image",
        url: mediaUrl(project.id, file),
        source: "generated",
        review: verdict,
        note: `${sheets.length ? `Onaylı sayfalar (${sheets.map((item) => item.character.name).join(", ")}) referans alınarak ` : ""}${spec.label} ile üretildi.${verdict?.note ? ` Kontrol: ${verdict.note}` : ""}${repairHint}`,
        frameKey: keys.reference ?? keys.flux,
        frameModel: spec.id,
        ledger: { status: "charged", note: `GMI isteği ${requestId} tamamlandı.` },
      };
    }

    if (!engine) return { kind: "image", url: scene.image, source: scene.imageSource, review: null, note: "NVIDIA anahtarı tanımlı olmadığı için mevcut görsel kullanıldı." };
    const prompt = imagePrompt(project, scene);
    let image = await engine.generate({ prompt, aspectRatio: project.aspectRatio, seed: seedFor(`${scene.id}:${runId}`, step.attempts) });
    let verdict = await review(engine, image, expectation, sheetRefs);
    let note = verdict?.note ? `Kontrol: ${verdict.note}` : "";
    if (verdict && !verdict.ok) {
      // Free frames cost nothing to remake, so a flagged one gets one fresh attempt; the less faulty of the two is kept.
      const second = await engine.generate({ prompt, aspectRatio: project.aspectRatio, seed: seedFor(`${scene.id}:${runId}`, step.attempts + 100) });
      const secondVerdict = await review(engine, second, expectation, sheetRefs);
      const keepSecond = !secondVerdict || secondVerdict.ok || (secondVerdict.issues?.length ?? 0) <= (verdict.issues?.length ?? 0);
      if (keepSecond) { image = second; verdict = secondVerdict; }
      note = `İlk görsel kontrolden geçmedi, yeniden üretildi.${keepSecond ? "" : " İlk deneme daha az sorunlu olduğu için o tutuldu."}${verdict?.note ? ` Kontrol: ${verdict.note}` : ""}`;
      if (verdict && !verdict.ok && repairRegions(verdict.issues).length) note += " İşaretli hata Storyboard'da yalnızca o bölge onarılarak düzeltilebilir.";
    }
    const file = `scene-${scene.id.slice(0, 8)}-${runId.slice(0, 8)}.jpg`;
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, file), image);
    return { kind: "image", url: mediaUrl(project.id, file), source: "generated", review: verdict, note, frameKey: keys.flux };
  }

  /** The clip the film uses for a shot: an earlier paid clip of this exact frame and motion, else its camera-move or title clip. */
  async function sceneClip(project: Project, scene: Scene): Promise<{ file: string; source: "ai" | "camera" | "title"; label: string }> {
    const directory = clipsDirectory(project.id);
    if (scene.kind === "title") return { file: path.join(directory, clipFile(scene.id, titleClipKey(project, scene))), source: "title", label: "" };
    if (scene.motion === "ai") {
      const record = reusableClip(project, scene, null);
      if (record && await exists(path.join(directory, record.file))) return { file: path.join(directory, record.file), source: "ai", label: record.modelLabel };
    }
    return { file: path.join(directory, clipFile(scene.id, cameraClipKey(project, scene))), source: "camera", label: "" };
  }

  async function cameraClip(project: Project, scene: Scene, target: string): Promise<boolean> {
    if (await exists(target)) return false;
    const image = resolveImageFile(scene.image, { publicDirectory: options.publicDirectory, mediaDirectory: mediaRoot });
    await access(image).catch(() => { throw new AppError(400, `${scene.title} için görsel dosyası bulunamadı.`); });
    await renderOnce(target, (output) => renderImageClip({ image, output, duration: scene.duration, aspectRatio: project.aspectRatio, camera: scene.camera }));
    return true;
  }

  async function videoStep(project: Project, runId: string, step: RunStep, scene: Scene): Promise<StepResult> {
    const paid = step.paid!;
    const spec = VIDEO_MODELS.find((model) => model.id === paid.model);
    const image = resolveImageFile(scene.image, { publicDirectory: options.publicDirectory, mediaDirectory: mediaRoot });
    await access(image).catch(() => { throw new AppError(400, `${scene.title} için görsel dosyası bulunamadı.`); });
    const fallback = async (note: string, ledger: { status: "failed" | "released"; note: string }): Promise<StepResult> => {
      if (paidOnly) throw new AppError(503, `${note} Ücretli video üretilemedi; üretim durduruldu.`);
      await cameraClip(project, scene, path.join(clipsDirectory(project.id), clipFile(scene.id, cameraClipKey(project, scene))));
      return { kind: "video", note, ledger };
    };
    const engine = options.videoEngine?.() ?? null;
    let requestId = paid.requestId;
    if (!requestId) {
      if (paid.submittedAt) return fallback("Önceki gönderimin sonucu belirsiz; çift ücret olmaması için yeniden gönderilmedi.", { status: "failed", note: "Gönderim sırasında bağlantı koptu; GMI'da iş oluşmuş ve ücretlendirilmiş olabilir. Konsoldan kontrol edin." });
      if (!engine || !spec) return fallback("GMI bağlantısı kullanılamadığı için ücretsiz kamera hareketi kullanıldı.", { status: "released", note: "İstek gönderilmedi; ayrılan tutar bütçeye döndü." });
      const imageUrl = await engine.upload(await readFile(image), image.endsWith(".png") ? "png" : "jpg");
      if (!(await options.repository.markSubmitting(project.id, runId, step.id))) throw new AppError(409, "Üretim durdurulduğu için istek gönderilmedi.");
      const duration = spec.durations.find((value) => value >= scene.duration) ?? spec.durations[spec.durations.length - 1];
      try {
        requestId = await engine.submit(spec.id, spec.payload({ prompt: videoPrompt(project, scene), imageUrl, duration, aspectRatio: project.aspectRatio, seed: seedFor(`${scene.id}:${runId}`, 0), camera: cameraMove(scene.camera).id }));
      } catch (error) {
        const { message, retryable } = failure(error);
        // A clear rejection created no job; a lost connection may have.
        return retryable
          ? fallback("GMI'a gönderimin sonucu belirsiz; yeniden gönderilmedi.", { status: "failed", note: `Belirsiz gönderim: ${message} Konsoldan kontrol edin.` })
          : fallback(`GMI isteği reddetti: ${message}`, { status: "released", note: `Reddedildi: ${message} İş oluşmadı.` });
      }
      await options.repository.recordRequest(project.id, runId, step.id, requestId);
    }
    if (!engine) return fallback("GMI bağlantısı kesildiği için video alınamadı.", { status: "failed", note: `İstek ${requestId} GMI'da tamamlanmış olabilir; konsoldan kontrol edin.` });
    const deadline = Date.now() + (options.videoTimeoutMs ?? 15 * 60_000);
    let heartbeat = Date.now();
    while (true) {
      let state: RequestState | null = null;
      try { state = await engine.status(requestId); }
      catch (error) { if (!failure(error).retryable) throw error; }
      if (state?.state === "success") {
        // The paid clip is kept under its fingerprint, so later films reuse it instead of paying again.
        const key = aiClipKey(project, scene);
        const file = clipFile(scene.id, key);
        const work = await mkdtemp(path.join(os.tmpdir(), "kadra-video-"));
        try {
          const raw = path.join(work, "provider.mp4");
          await writeFile(raw, await engine.download(state.mediaUrl));
          await renderOnce(path.join(clipsDirectory(project.id), file), (output) => renderVideoClip({ input: raw, output, duration: scene.duration, aspectRatio: project.aspectRatio }));
        } finally { await rm(work, { recursive: true, force: true }); }
        return {
          kind: "video", note: `${spec?.label ?? paid.model} ile üretildi.`, ledger: { status: "charged", note: `GMI isteği ${requestId} tamamlandı.` },
          clip: { sceneId: scene.id, key, file, model: paid.model, modelLabel: spec?.label ?? paid.model, cost: paid.unitCost },
        };
      }
      if (state?.state === "failed") return fallback(state.message, { status: "failed", note: `${state.message} Başarısız işlerin ücretlendirilip ücretlendirilmediğini konsoldan kontrol edin.` });
      if (Date.now() > deadline) return fallback("GMI videoyu zamanında tamamlamadı.", { status: "failed", note: `Zaman aşımı: istek ${requestId} sonradan tamamlanmış ve ücretlendirilmiş olabilir.` });
      if (Date.now() - heartbeat > 60_000) { await options.repository.extendLease(project.id, runId, step.id, owner, LEASE_MS); heartbeat = Date.now(); }
      await sleep(options.pollIntervalMs ?? 5_000);
    }
  }

  /** A rejected paid sheet whose defects the judge located is repaired in place rather than drawn again. */
  function repairBase(attempts: SheetAttempt[], step: RunStep): { attempt: SheetAttempt; boxes: Box[]; instruction: string } | null {
    if (!step.paid?.repairCost) return null;
    const best = bestAttempt(attempts);
    if (!best?.verdict || best.verdict.ok) return null;
    const boxes = repairRegions(best.verdict.issues);
    return boxes.length ? { attempt: best, boxes, instruction: issueInstruction(best.verdict.issues ?? []) } : null;
  }

  async function characterStep(project: Project, runId: string, step: RunStep): Promise<StepResult> {
    const character = project.characters.find((item) => item.id === step.characterId);
    if (!character) throw new AppError(400, "Adımın karakteri projede bulunamadı.");
    const directory = projectMediaDirectory(mediaRoot, project.id);
    const reference = character.reference ? await readFile(path.join(directory, character.reference.file)) : null;
    const judge = options.sheetJudge?.() ?? null;
    const earlier = character.sheet.attempts.filter((attempt) => attempt.runId === runId);
    const result = (note: string, extra: Partial<{ uncertain: boolean; failedSubmissions: number }> = {}): StepResult => ({ kind: "character", note, uncertain: false, failedSubmissions: 0, ...extra });
    if (earlier.some((attempt) => attempt.verdict?.ok)) return result("");
    // A cast sheet is square; a location plate is framed like the film.
    const aspectRatio: AspectRatio = character.kind === "place" ? project.aspectRatio : "1:1";
    const attempts = [...earlier];
    let made = earlier.length;
    let requestId = step.paid?.requestId ?? null;
    let job = step.paid?.job ?? "generate";
    let note = "";
    await mkdir(directory, { recursive: true });
    while (made < SHEET_ATTEMPTS) {
      let image: Buffer;
      let cost = 0;
      const usePaid = Boolean(reference || step.paid);
      let engineLabel: SheetAttempt["engine"] = usePaid ? "nano-banana" : "flux";
      if (usePaid) {
        const engine = options.videoEngine?.() ?? null;
        if (!requestId && step.paid?.submittedAt && made === earlier.length) return result("Önceki gönderimin sonucu belirsiz; çift ücret olmaması için yeniden gönderilmedi.", { uncertain: true });
        if (!engine) return result("GMI bağlantısı kullanılamıyor; referanslı üretim yapılamadı.");
        const base = repairBase(attempts, step);
        if (!requestId) job = base ? "repair" : "generate";
        if (job === "repair" && base) {
          const outcome = await regionRepair(engine, project, runId, step, path.join(directory, base.attempt.url.split("/").pop()!), base.boxes, base.instruction, requestId);
          if (outcome.state !== "done") {
            if (outcome.state === "unknown") return result(outcome.message, { uncertain: true });
            return outcome.state === "unsent"
              ? result(`GMI onarım isteğini reddetti: ${outcome.message} Reddedilen istek değiştirilip yeniden gönderilmez.`)
              : result(`${outcome.message} Reddedilen istek değiştirilip yeniden gönderilmez.`, { failedSubmissions: 1 });
          }
          image = outcome.image;
          cost = step.paid?.repairCost ?? 0;
          engineLabel = "repair";
        } else {
          if (!requestId) {
            const referenceUrls = reference ? [await engine.upload(reference, reference[0] === 0x89 ? "png" : "jpg")] : [];
            if (!(await options.repository.markSubmitting(project.id, runId, step.id))) throw new AppError(409, "Üretim durdurulduğu için istek gönderilmedi.");
            try {
              requestId = await engine.submit(REFERENCE_MODEL, { prompt: sheetPrompt(project, character), ...(referenceUrls.length ? { image: referenceUrls } : {}), image_size: "1K", aspect_ratio: aspectRatio, thinking: "medium", image_output_format: "png" });
            } catch (error) {
              const { message, retryable } = failure(error);
              return retryable ? result("Gönderimin sonucu belirsiz; yeniden gönderilmedi.", { uncertain: true }) : result(`GMI isteği reddetti: ${message}`);
            }
            await options.repository.recordRequest(project.id, runId, step.id, requestId);
          }
          const state = await waitFor(engine, requestId, project, runId, step, options.sheetTimeoutMs ?? 5 * 60_000);
          if (state.state === "pending") return result("GMI görseli zamanında tamamlamadı; iş sonradan tamamlanmış ve ücretlendirilmiş olabilir.", { failedSubmissions: 1 });
          if (state.state === "failed") return result(`${state.message} Reddedilen istek değiştirilip yeniden gönderilmez; fotoğrafı, tarifi ya da stili değiştirip yeniden üretebilirsin.`, { failedSubmissions: 1 });
          image = await engine.download(state.mediaUrl);
          cost = step.paid?.unitCost ?? 0;
        }
      } else {
        const flux = options.imageEngine();
        if (!flux) return result("NVIDIA anahtarı tanımlı değil; fotoğrafsız karakter üretilemedi.");
        try { image = await flux.generate({ prompt: sheetPrompt(project, character), aspectRatio, seed: seedFor(`${character.id}:${runId}`, made) }); }
        catch (error) {
          const { message, retryable } = failure(error);
          if (retryable) throw error;
          return result(message);
        }
      }
      made += 1;
      const file = `sheet-${character.id}-${runId.slice(0, 8)}-${made}.${image[0] === 0x89 ? "png" : "jpg"}`;
      await writeFile(path.join(directory, file), image);
      let verdict: SheetVerdict | null = null;
      if (judge) {
        try { verdict = await judge({ image, reference, name: character.name, appearance: character.appearance, style: character.style || project.style, kind: character.kind }); }
        catch { verdict = null; }
      }
      const attempt = { id: randomUUID(), url: mediaUrl(project.id, file), at: new Date().toISOString(), engine: engineLabel, verdict, cost };
      await options.repository.recordSheetAttempt(project.id, runId, step.id, attempt);
      attempts.push({ ...attempt, runId });
      requestId = null;
      job = "generate";
      if (!verdict) { note = judge ? "Hakem şu an yanıt vermedi; karar senin." : "Hakem kullanılamıyor (NVIDIA anahtarı yok); karar senin."; break; }
      if (verdict.ok) { note = engineLabel === "repair" ? "Hakemin işaretlediği bölge onarıldı; sayfanın geri kalanı korundu." : ""; break; }
      note = `Hakem ${made}. denemeyi reddetti: ${verdict.note}${repairBase(attempts, step) && made < SHEET_ATTEMPTS ? " Yalnızca işaretli bölge onarılacak." : ""}`;
    }
    return result(note);
  }

  /**
   * Speaks a shot's narration. A line already spoken with the same text and voice is reused; a paid voice is only
   * bought when the quote included it, and otherwise the free macOS voice stands in so the film still completes.
   */
  async function voiceStep(project: Project, runId: string, step: RunStep, scene: Scene): Promise<StepResult> {
    const text = narrationText(scene);
    const settings = project.narration;
    const directory = projectMediaDirectory(mediaRoot, project.id);
    await mkdir(directory, { recursive: true });
    const timing = async (file: string) => {
      const length = await inspectAudio(file);
      return length > scene.duration + 0.2 ? ` Ses ${length.toFixed(1)} sn, çekim ${scene.duration} sn; sesin sonu kesilir, çekimi uzatabilirsin.` : "";
    };
    const chosen = path.join(directory, voiceFile(scene.id, voiceKey(settings, text)));
    if (await exists(chosen)) return { kind: "voice", note: `Metin ve ses değişmediği için önceki ses kullanıldı.${await timing(chosen)}`, ...(step.paid ? { ledger: { status: "released" as const, note: "Bu ses zaten vardı; istek gönderilmedi." } } : {}) };
    const draft = async (reason: string): Promise<string> => {
      const standIn = standInSettings(settings);
      const file = path.join(directory, voiceFile(scene.id, voiceKey(standIn, text)));
      if (!(await exists(file))) await renderOnce(file, (output) => speakLocally({ text, voice: standIn.voice || LOCAL_VOICE, speed: standIn.speed, output }));
      return `${reason}${await timing(file)}`;
    };
    if (!step.paid) return { kind: "voice", note: await draft(settings.engine === "gmi" ? "Ücretli ses teklif onayıyla alınır; şimdilik taslak Mac sesi (ücretsiz) kullanıldı." : "Mac sesiyle ücretsiz seslendirildi.") };
    const paid = step.paid;
    const gmi = options.videoEngine?.() ?? null;
    const fallback = async (reason: string, ledger: { status: "failed" | "released"; note: string }): Promise<StepResult> => ({ kind: "voice", note: await draft(`${reason} Taslak Mac sesi kullanıldı.`), ledger });
    let requestId = paid.requestId;
    if (!requestId) {
      if (paid.submittedAt) return fallback("Önceki ses gönderiminin sonucu belirsiz; yeniden gönderilmedi.", { status: "failed", note: "Gönderim sırasında bağlantı koptu; GMI'da iş oluşmuş olabilir." });
      if (!gmi) return fallback("GMI bağlantısı yok.", { status: "released", note: "İstek gönderilmedi; ayrılan tutar bütçeye döndü." });
      if (!(await options.repository.markSubmitting(project.id, runId, step.id))) throw new AppError(409, "Üretim durdurulduğu için istek gönderilmedi.");
      try {
        const voice = GMI_VOICES.some((item) => item.id === settings.voice) ? settings.voice : GMI_VOICES[0].id;
        requestId = await gmi.submit(VOICE_MODEL, { text, voice_id: voice, speed: settings.speed, format: "mp3", language_boost: "Turkish" });
      } catch (error) {
        const { message, retryable } = failure(error);
        return retryable
          ? fallback("Ses gönderiminin sonucu belirsiz; yeniden gönderilmedi.", { status: "failed", note: `Belirsiz gönderim: ${message}` })
          : fallback(`GMI ses isteğini reddetti: ${message}`, { status: "released", note: `Reddedildi: ${message} İş oluşmadı.` });
      }
      await options.repository.recordRequest(project.id, runId, step.id, requestId);
    }
    if (!gmi) return fallback("GMI bağlantısı kesildiği için ses alınamadı.", { status: "failed", note: `İstek ${requestId} GMI'da tamamlanmış olabilir.` });
    const state = await waitFor(gmi, requestId, project, runId, step, options.sheetTimeoutMs ?? 5 * 60_000);
    if (state.state === "pending") return fallback("GMI sesi zamanında tamamlamadı.", { status: "failed", note: `Zaman aşımı: istek ${requestId} sonradan tamamlanmış olabilir.` });
    if (state.state === "failed") return fallback(state.message, { status: "failed", note: state.message });
    const work = await mkdtemp(path.join(os.tmpdir(), "kadra-tts-"));
    try {
      const raw = path.join(work, "voice.mp3");
      await writeFile(raw, await gmi.download(state.mediaUrl));
      await renderOnce(chosen, (output) => convertAudio({ input: raw, output }));
    } finally { await rm(work, { recursive: true, force: true }); }
    return { kind: "voice", note: `${VOICE_LABEL} ile seslendirildi.${await timing(chosen)}`, ledger: { status: "charged", note: `GMI isteği ${requestId} tamamlandı.` } };
  }

  /** A region repair the user asked for, on a scene frame or a character sheet attempt. */
  async function repairStep(project: Project, runId: string, step: RunStep): Promise<StepResult> {
    const task = step.repair;
    if (!task) throw new AppError(400, "Onarım adımının ayrıntıları eksik.");
    const scene = project.scenes.find((item) => item.id === step.sceneId) ?? null;
    const character = project.characters.find((item) => item.id === step.characterId) ?? null;
    const attempt = character?.sheet.attempts.find((item) => item.id === task.attemptId) ?? null;
    const source = scene?.image ?? attempt?.url;
    if (!source) throw new AppError(400, "Onarılacak görsel bulunamadı.");
    const file = resolveImageFile(source, { publicDirectory: options.publicDirectory, mediaDirectory: mediaRoot });
    await access(file).catch(() => { throw new AppError(400, "Onarılacak görsel dosyası bulunamadı."); });
    const unfinished = (note: string, ledger: { status: "failed" | "released"; note: string }): StepResult => ({ kind: "repair", url: null, review: null, verdict: null, note, cost: 0, ledger });
    const gmi = options.videoEngine?.() ?? null;
    if (!gmi) return step.paid?.requestId
      ? unfinished("GMI bağlantısı kesildiği için onarım alınamadı.", { status: "failed", note: `İstek ${step.paid.requestId} GMI'da tamamlanmış olabilir.` })
      : unfinished("GMI bağlantısı yok; onarım gönderilmedi.", { status: "released", note: "İstek gönderilmedi; ayrılan tutar bütçeye döndü." });
    const outcome = await regionRepair(gmi, project, runId, step, file, [task.box], task.instruction, step.paid?.requestId ?? null);
    if (outcome.state === "unsent") return unfinished(`GMI onarım isteğini reddetti: ${outcome.message}`, { status: "released", note: `Reddedildi: ${outcome.message} İş oluşmadı.` });
    if (outcome.state !== "done") return unfinished(outcome.message, { status: "failed", note: outcome.message });
    const directory = projectMediaDirectory(mediaRoot, project.id);
    const name = scene ? `scene-${scene.id.slice(0, 8)}-${runId.slice(0, 8)}-fix.png` : `sheet-${character!.id}-${runId.slice(0, 8)}-fix.png`;
    await mkdir(directory, { recursive: true });
    await writeFile(path.join(directory, name), outcome.image);
    let reviewed: ImageReview | null = null;
    let verdict: SheetVerdict | null = null;
    if (scene) {
      const sheets = await loadCharacterSheets(project, scene);
      reviewed = await review(options.imageEngine(), outcome.image, `${scene.description} (Stil: ${project.style})`, sheets.map(({ character: item, image }) => ({ name: item.name, image })));
    } else if (character) {
      const judge = options.sheetJudge?.() ?? null;
      const reference = character.reference ? await readFile(path.join(directory, character.reference.file)).catch(() => null) : null;
      if (judge) verdict = await judge({ image: outcome.image, reference, name: character.name, appearance: character.appearance, style: character.style || project.style, kind: character.kind }).catch(() => null);
    }
    const check = reviewed?.note ?? verdict?.note;
    return {
      kind: "repair", url: mediaUrl(project.id, name), review: reviewed, verdict, cost: step.paid?.unitCost ?? 0,
      note: `Görselin geri kalanı piksel piksel korundu.${check ? ` Kontrol: ${check}` : ""}`,
      ledger: { status: "charged", note: `GMI isteği ${outcome.requestId} tamamlandı.` },
    };
  }

  async function execute(project: Project, runId: string, step: RunStep): Promise<StepResult> {
    if (step.kind === "character") return characterStep(project, runId, step);
    if (step.kind === "repair") return repairStep(project, runId, step);
    const scene = project.scenes.find((item) => item.id === step.sceneId);
    if (step.kind !== "montage" && !scene) throw new AppError(400, "Adımın çekimi projede bulunamadı.");
    if (step.kind === "image") return imageStep(project, runId, step, scene!);
    if (step.kind === "video") return videoStep(project, runId, step, scene!);
    if (step.kind === "voice") return voiceStep(project, runId, step, scene!);
    if (step.kind === "clip") {
      const clip = await sceneClip(project, scene!);
      if (clip.source === "ai") return { kind: "clip", note: `Bu kareden daha önce üretilmiş yapay zekâ videosu (${clip.label}) kullanıldı; yeniden ücret ödenmedi.` };
      const rendered = await cameraClip(project, scene!, clip.file);
      return { kind: "clip", note: rendered ? `Kamera: ${cameraMove(scene!.camera).label.toLocaleLowerCase("tr")}.` : "Kare ve kamera hareketi değişmediği için önceki klip kullanıldı." };
    }
    if (step.kind === "title") {
      const clip = await sceneClip(project, scene!);
      if (await exists(clip.file)) return { kind: "title", note: "Yazı değişmediği için önceki kart kullanıldı." };
      await renderOnce(clip.file, (output) => renderTitleClip({ text: titleCardText(scene!.description), output, duration: scene!.duration, aspectRatio: project.aspectRatio }));
      return { kind: "title", note: "" };
    }
    const clips = await Promise.all(project.scenes.map(async (item) => (await sceneClip(project, item)).file));
    for (const clip of clips) await access(clip).catch(() => { throw new AppError(400, "Montaj için bir klip eksik. Üretimi yeniden başlatın."); });
    const directory = projectMediaDirectory(mediaRoot, project.id);
    const file = `film-${runId.slice(0, 8)}.mp4`;
    const output = path.join(directory, file);
    const music = project.music ? path.join(directory, project.music.file) : null;
    const hasMusic = music !== null && await exists(music);
    const voices = await narrationTracks(project, directory);
    if (!hasMusic && !voices.length) {
      await concatClips({ clips, output, look: lookOf(project.look).filter });
      return { kind: "montage", url: mediaUrl(project.id, file), duration: await inspectVideo(output), note: project.music ? "Müzik dosyası bulunamadı; film sessiz birleştirildi." : "" };
    }
    const silent = path.join(directory, "runs", runId, "film-silent.mp4");
    await mkdir(path.dirname(silent), { recursive: true });
    await concatClips({ clips, output: silent, look: lookOf(project.look).filter });
    const total = await inspectVideo(silent);
    await applySoundtrack({ film: silent, output, duration: total, music: hasMusic ? { file: music!, volume: project.music!.volume, offset: project.music!.offset } : null, voices, voiceVolume: project.narration.volume });
    const parts = [hasMusic && `Müzik eklendi: ${project.music!.name}.`, voices.length && `${voices.length} çekimin dış sesi eklendi${hasMusic ? "; konuşma sırasında müzik kısılır" : ""}.`].filter(Boolean);
    return { kind: "montage", url: mediaUrl(project.id, file), duration: await inspectVideo(output), note: parts.join(" ") };
  }

  /** After a finished film: keep the film, the frames in use (and the one a repair can be undone to), the clips it used and every paid clip kept for reuse. */
  async function pruneMedia(project: Project, filmUrl: string) {
    const directory = projectMediaDirectory(mediaRoot, project.id);
    // Only one run per project can be active, so leftovers of earlier or cancelled runs are disposable.
    await rm(path.join(directory, "runs"), { recursive: true, force: true });
    const keep = new Set([filmUrl, ...project.scenes.flatMap((scene) => [scene.image, scene.repair?.previous ?? "", ...voiceCandidates(project, scene)])].map((url) => url.split("/").pop()));
    for (const file of await readdir(directory)) {
      if (/^(scene|film)-.*\.(jpg|png|mp4)$|^voice-.*\.m4a$/.test(file) && !keep.has(file)) await rm(path.join(directory, file), { force: true });
    }
    const used = new Set(await Promise.all(project.scenes.map(async (scene) => path.basename((await sceneClip(project, scene)).file))));
    for (const record of keptClips(project)) used.add(record.file);
    for (const file of await readdir(clipsDirectory(project.id)).catch(() => [] as string[])) {
      if (!used.has(file)) await rm(path.join(clipsDirectory(project.id), file), { force: true });
    }
  }

  /** Runs at most one step. Returns false when no work was waiting. */
  async function runNext(): Promise<boolean> {
    const claim = await options.repository.claimStep(owner, LEASE_MS);
    if (!claim) return false;
    const { project, runId, step } = claim;
    try {
      const result = await execute(project, runId, step);
      const accepted = await options.repository.completeStep(project.id, runId, step.id, result);
      if (accepted && result.kind === "montage") await pruneMedia(project, result.url);
    } catch (error) {
      const { message, retryable } = failure(error);
      log(`Kadra üretim adımı başarısız (${step.kind}): ${message}`);
      await options.repository.failStep(project.id, runId, step.id, message, retryable);
    }
    return true;
  }

  let timer: ReturnType<typeof setTimeout> | null = null;
  let active = false;
  let stopped = true;
  async function loop() {
    if (active || stopped) return;
    active = true;
    if (timer) { clearTimeout(timer); timer = null; }
    try { while (!stopped && await runNext()) { /* Keep draining queued steps. */ } }
    catch (error) { log(`Kadra üretim çalışanı: ${failure(error).message}`); }
    finally {
      active = false;
      if (!stopped) timer = setTimeout(() => void loop(), IDLE_MS);
    }
  }

  return {
    owner,
    runNext,
    start() { if (stopped) { stopped = false; void loop(); } },
    wake() { if (!stopped) void loop(); },
    stop() { stopped = true; if (timer) clearTimeout(timer); timer = null; },
  };
}
