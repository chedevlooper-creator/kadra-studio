import { createHash, randomUUID } from "node:crypto";
import { copyFile, mkdir, open, readFile, readdir, rename, rm, stat, unlink } from "node:fs/promises";
import path from "node:path";
import { z } from "zod";
import { existsSync } from "node:fs";
import type { AppBootstrap, Box, Character, CharacterEstimate, ClipRecord, CreateProjectInput, ImageReview, ImageSource, LedgerEntry, MotionMode, ProductionRun, Project, ProjectOutput, ProviderStatus, QualityTier, Quote, QuoteLine, ReferencePhoto, RepairEstimate, ReusedLine, RunEvent, RunStep, SheetAttempt, SheetVerdict, Soundtrack } from "./types";
import { projectMediaDirectory } from "./media";
import { approvedCharacterSheets, continuityFrame, frameIsCurrent, frameKeys, keptClips, REPAIR_LABEL, REPAIR_MODEL, reusableClip } from "./production/reuse";
import { voiceFile, voiceKey } from "./production/narration";
import { chooseFrameModel, frameModel } from "./routing/frame-router";
import { DEFAULT_NARRATION, narrationText, VOICE_LABEL, VOICE_MODEL } from "./voices";
import { mentionsCharacter, modelCatalog, newCharacter, parseScript, planScenes, scenesFromAiPlan, scenesFromStoryboard, scriptFromStoryboard, TITLE_MODEL, VIDEO_MODEL, type StoryboardShot } from "./planner";
import type { AiPlan, PlanRequest } from "./providers/nvidia";
import { chooseVideoModel, TIER_MIN_QUALITY, VIDEO_MODELS, type PriceRule } from "./routing/video-router";
import { AppError, createProjectSchema, idempotencySchema, idSchema, parseInput, revisionSchema, scenePatchSchema, updateProjectSchema } from "./validation";

export { approvedCharacterSheets } from "./production/reuse";

const MAX_ATTEMPTS = 3;
const MAX_EVENTS = 200;
const QUOTE_TTL_MS = 15 * 60_000;
/** Sheet attempts per character per run; the judge may reject earlier ones. */
export const SHEET_ATTEMPTS = 3;
export const REFERENCE_MODEL = "gemini-nano-banana-2.1";

const eventSchema = z.object({ id: z.string(), at: z.string().datetime(), message: z.string(), kind: z.enum(["info", "success", "warning"]) }).strict();
const boxSchema = z.tuple([z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1), z.number().min(0).max(1)]);
const issueSchema = z.object({ problem: z.string().max(300), fix: z.string().max(600), box: boxSchema.nullable() }).strict();
const stepSchema = z.object({
  id: idSchema, kind: z.enum(["image", "clip", "video", "title", "montage", "character", "repair", "voice"]), sceneId: idSchema.nullable(), characterId: z.string().max(20).nullable().default(null), status: z.enum(["pending", "running", "done", "failed", "skipped"]),
  attempts: z.number().int().min(0).max(20), leaseUntil: z.string().datetime().nullable(), owner: z.string().max(120).nullable(), note: z.string().max(500),
  paid: z.object({ ledgerId: idSchema, model: z.string().max(80), requestId: z.string().max(200).nullable(), submittedAt: z.string().datetime().nullable(), unitCost: z.number().min(0).default(0), repairCost: z.number().min(0).default(0), job: z.enum(["generate", "repair"]).default("generate") }).strict().nullable().default(null),
  repair: z.object({ box: boxSchema, instruction: z.string().max(600), attemptId: idSchema.nullable() }).strict().nullable().default(null),
}).strict();
const runRecordSchema = z.object({
  id: idSchema, mode: z.enum(["free", "paid", "characters", "repair"]), regenerateImages: z.boolean().default(false), keepFlagged: z.boolean().default(false), target: z.enum(["frames", "film"]).default("film"), prepareCharacters: z.boolean().default(false), status: z.enum(["running", "completed", "cancelled", "failed"]), startedAt: z.string().datetime(), completedAt: z.string().datetime().nullable(),
  progress: z.number().min(0).max(100), cost: z.number().min(0), events: z.array(eventSchema).max(MAX_EVENTS), steps: z.array(stepSchema).max(200),
}).strict();
const sceneRecordSchema = z.object({
  id: idSchema, order: z.number().int().min(1).max(40), title: z.string(), description: z.string(), prompt: z.string(), motionPrompt: z.string(), duration: z.number().int().min(2).max(30),
  camera: z.string(), model: z.string(), modelReason: z.string(), kind: z.enum(["video", "title"]), status: z.enum(["draft", "queued", "running", "ready", "failed"]),
  image: z.string(), imageSource: z.enum(["reference", "generated"]), review: z.object({ ok: z.boolean(), note: z.string(), issues: z.array(issueSchema).max(6).default([]) }).strict().nullable(),
  frameKey: z.string().max(40).default(""), frameModel: z.string().max(80).default(""),
  repair: z.object({ previous: z.string(), box: boxSchema, instruction: z.string().max(600), at: z.string().datetime(), cost: z.number().min(0) }).strict().nullable().default(null),
  characterIds: z.array(z.string().max(20)).max(12), narration: z.string(), notes: z.array(z.string()),
  motion: z.enum(["free", "ai"]).default("free"), videoModel: z.string().max(80).nullable().default(null),
  code: z.string().max(20).default(""), group: z.string().max(160).default(""), audioNotes: z.string().max(4_000).default(""), screenText: z.string().max(4_000).default(""),
}).strict();
const priceSchema = z.object({ label: z.string(), estimate: z.number().min(0) }).strict();
const verdictSchema = z.object({ ok: z.boolean(), scores: z.object({ style: z.number(), traits: z.number(), pose: z.number(), clean: z.number() }).strict(), note: z.string().max(600), issues: z.array(issueSchema).max(6).default([]) }).strict();
const characterSchema = z.object({
  id: z.string().max(20), kind: z.enum(["person", "place"]).default("person"), name: z.string().max(80), appearance: z.string().max(1_200),
  aliases: z.array(z.string().max(80)).max(12).default([]), style: z.string().max(400).default(""),
  reference: z.object({ source: z.enum(["wikimedia", "upload", "openverse"]), title: z.string().max(300), pageUrl: z.string().max(600).nullable(), file: z.string().regex(/^ref-[a-zA-Z0-9_-]+\.(jpg|png)$/), author: z.string().max(300), license: z.string().max(120), licenseUrl: z.string().max(400).nullable(), addedAt: z.string().datetime() }).strict().nullable().default(null),
  sheet: z.object({
    status: z.enum(["none", "producing", "review", "approved", "failed"]),
    attempts: z.array(z.object({ id: idSchema, runId: idSchema, url: z.string(), at: z.string().datetime(), engine: z.enum(["flux", "nano-banana", "repair"]), verdict: verdictSchema.nullable(), cost: z.number().min(0) }).strict()).max(24),
    chosen: idSchema.nullable(), note: z.string().max(600),
  }).strict().default({ status: "none", attempts: [], chosen: null, note: "" }),
}).strict();
const quoteSchema = z.object({
  id: idSchema, createdAt: z.string().datetime(), expiresAt: z.string().datetime(), quality: z.enum(["economy", "balanced", "best"]), fingerprint: z.string(),
  lines: z.array(z.object({ sceneId: idSchema, title: z.string(), kind: z.enum(["video", "image", "voice"]).default("video"), modelId: z.string(), modelLabel: z.string(), billedSeconds: z.number().min(0), estimate: z.number().min(0), reason: z.string(), alternative: priceSchema.nullable(), priciest: priceSchema.nullable() }).strict()).max(80),
  reused: z.array(z.object({ sceneId: idSchema, title: z.string(), kind: z.enum(["video", "image", "voice"]), modelLabel: z.string(), saved: z.number().min(0) }).strict()).max(80).default([]),
  errors: z.array(z.string()).max(40), total: z.number().min(0), budget: z.number().min(0), committed: z.number().min(0), remaining: z.number(), withinBudget: z.boolean(),
}).strict();
const ledgerSchema = z.object({
  id: idSchema, at: z.string().datetime(), runId: idSchema, sceneId: z.string().max(80), sceneTitle: z.string(), provider: z.literal("GMI"), kind: z.enum(["video", "image", "voice"]).default("video"), model: z.string(), modelLabel: z.string(),
  estimate: z.number().min(0), actual: z.number().min(0).nullable(), status: z.enum(["reserved", "submitted", "charged", "failed", "released"]), requestId: z.string().max(200).nullable(), note: z.string().max(500),
}).strict();
const projectRecordSchema = createProjectSchema.extend({
  id: idSchema, description: z.string(), duration: z.number().finite().min(0), status: z.enum(["draft", "planned", "producing", "ready"]), cover: z.string(),
  createdAt: z.string().datetime(), updatedAt: z.string().datetime(), revision: revisionSchema, planner: z.enum(["heuristic", "nemotron", "deepseek", "import"]), planNote: z.string().max(500),
  characters: z.array(characterSchema).max(12),
  scenes: z.array(sceneRecordSchema).max(40), run: runRecordSchema.nullable(),
  output: z.object({ runId: idSchema, url: z.string(), duration: z.number().min(0), createdAt: z.string().datetime() }).strict().nullable(), isExample: z.boolean(),
  genre: z.string().max(40).default(""), look: z.string().max(40).default("none"),
  quality: z.enum(["economy", "balanced", "best"]).default("economy"), quote: quoteSchema.nullable().default(null), ledger: z.array(ledgerSchema).max(500).default([]),
  music: z.object({ file: z.string().regex(/^music-[a-zA-Z0-9_-]+\.(mp3|m4a|wav|aac)$/), name: z.string().max(200), duration: z.number().min(0), volume: z.number().min(0).max(2), offset: z.number().min(0) }).strict().nullable().default(null),
  frameModel: z.string().max(80).nullable().default(null),
  narration: z.object({ engine: z.enum(["off", "local", "gmi"]), voice: z.string().max(80), speed: z.number().min(0.5).max(1.5), volume: z.number().min(0).max(2) }).strict().default(DEFAULT_NARRATION),
  clips: z.array(z.object({ sceneId: idSchema, key: z.string().max(40), file: z.string().regex(/^clip-[a-zA-Z0-9_-]+\.mp4$/), model: z.string().max(80), modelLabel: z.string().max(80), cost: z.number().min(0), createdAt: z.string().datetime() }).strict()).max(400).default([]),
}).strict();
const databaseSchema = z.object({
  version: z.literal(2), projects: z.array(projectRecordSchema).max(100),
  receipts: z.array(z.object({ projectId: idSchema, key: idempotencySchema, fingerprint: z.string(), runId: idSchema }).strict()).max(1_000),
}).strict();
type StoredStep = RunStep & { owner: string | null };
type StoredProject = Omit<Project, "run"> & { run: (Omit<ProductionRun, "steps"> & { steps: StoredStep[] }) | null };
type Database = { version: 2; projects: StoredProject[]; receipts: z.infer<typeof databaseSchema>["receipts"] };
type ProjectPatch = z.infer<typeof updateProjectSchema>;
type ScenePatch = z.infer<typeof scenePatchSchema>;

type LedgerUpdate = { status: "charged" | "failed" | "released"; note: string };
export type StepResult =
  | { kind: "image"; url: string; source: ImageSource; review: ImageReview | null; note: string; frameKey?: string; frameModel?: string; ledger?: LedgerUpdate }
  | { kind: "clip" | "title"; note: string }
  | { kind: "video"; note: string; ledger: LedgerUpdate; clip?: Omit<ClipRecord, "createdAt"> }
  | { kind: "montage"; url: string; duration: number; note: string }
  | { kind: "character"; note: string; uncertain: boolean; failedSubmissions: number }
  | { kind: "repair"; url: string | null; review: ImageReview | null; verdict: SheetVerdict | null; note: string; cost: number; ledger: LedgerUpdate }
  | { kind: "voice"; note: string; ledger?: LedgerUpdate };

export interface RepositoryOptions {
  providers?: () => Promise<ProviderStatus>;
  aiPlanner?: (request: PlanRequest) => Promise<AiPlan>;
  /** Live per-model prices for paid video; quotes are refused when this is missing or fails. */
  videoPrices?: () => Promise<ReadonlyMap<string, PriceRule>>;
  /** Live price of one reference-guided character image (USD). */
  referenceImagePrice?: () => Promise<number>;
  /** Live price of one masked region repair (USD). */
  repairPrice?: () => Promise<number>;
  /** Live per-image prices of the reference-guided frame models. */
  framePrices?: () => Promise<ReadonlyMap<string, number>>;
  /** Live price of paid narration, USD per 1,000 characters. */
  voicePrice?: () => Promise<number>;
  /** Ceiling for paid spend across every project, in USD; null means no extra ceiling. */
  spendLimit?: () => number | null;
  /** Emergency stop: while true, no paid request may be reserved or sent. */
  paymentsDisabled?: () => boolean;
}

export interface RepairInput {
  target: { sceneId: string } | { characterId: string; attemptId: string };
  box: Box;
  instruction: string;
  maxCost: number;
}

export interface CharacterInput { name: string; appearance: string; aliases: string[]; style: string; kind?: Character["kind"] }

/** Reference photos go to the paid reference model; characters without one are drawn free from their description unless paid is chosen. */
export function estimateCharacters(project: Pick<Project, "characters" | "budget" | "ledger">, characterIds: string[], providers: ProviderStatus, unitPrice: number | null, engineOverride: "auto" | "nano-banana" = "auto"): CharacterEstimate {
  const problems: string[] = [];
  const lines: CharacterEstimate["lines"] = [];
  for (const id of characterIds) {
    const character = project.characters.find((item) => item.id === id);
    if (!character) { problems.push(`Karakter bulunamadı: ${id}`); continue; }
    if (character.reference || engineOverride === "nano-banana") {
      if (!providers.gmi) problems.push(`${character.name}: ${character.reference ? "referans fotoğraflı" : "Nano Banana 2.1 ile"} üretim için GMI anahtarı gerekli.`);
      else if (unitPrice === null) problems.push(`${character.name}: GMI'dan güncel fiyat alınamadı.`);
      else lines.push({ characterId: id, name: character.name, engine: "nano-banana", unitCost: unitPrice, maxAttempts: SHEET_ATTEMPTS, maxCost: money(unitPrice * SHEET_ATTEMPTS) });
    } else if (!providers.nvidia) problems.push(`${character.name}: fotoğrafsız üretim için NVIDIA anahtarı gerekli.`);
    else lines.push({ characterId: id, name: character.name, engine: "flux", unitCost: 0, maxAttempts: SHEET_ATTEMPTS, maxCost: 0 });
  }
  const total = money(lines.reduce((sum, line) => sum + line.maxCost, 0));
  const remaining = money((project.budget ?? 0) - committedSpend(project.ledger));
  if (total > 0 && project.budget === null) problems.push("Ücretli üretim için proje bütçesi belirleyin.");
  else if (total > remaining) problems.push(`En yüksek tutar (${total.toFixed(2)} $) kalan bütçeyi (${Math.max(0, remaining).toFixed(2)} $) aşıyor.`);
  return { lines, total, budget: project.budget, remaining, withinBudget: problems.length === 0 && lines.length > 0, problems };
}

export interface QuoteInput {
  revision: number;
  quality: QualityTier;
  budget: number | null;
  referenceFrames?: boolean;
  frameModel?: string | null;
  selections: { sceneId: string; motion: MotionMode; videoModel: string | null }[];
}

const money = (value: number) => Math.round(value * 10_000) / 10_000;

/** Everything not explicitly released counts against the budget, including failed jobs that may have been billed. */
export function committedSpend(ledger: LedgerEntry[]): number {
  return money(ledger.filter((entry) => entry.status !== "released").reduce((sum, entry) => sum + (entry.actual ?? entry.estimate), 0));
}

/**
 * Anything that changes what would be generated or what it may cost invalidates an earlier quote.
 * The character bank is included because approved sheets decide whether a frame is reference-guided and which
 * references the frame model receives; the pinned frame model is included because it changes the frame line.
 */
function quoteFingerprint(project: Pick<Project, "aspectRatio" | "quality" | "budget" | "scenes"> & {
  genre?: string;
  narration?: Project["narration"];
  characters?: Project["characters"];
  frameModel?: string | null;
}): string {
  const characters = (project.characters ?? []).map((character) => [
    character.id, character.kind, character.name, character.appearance, character.style,
    character.sheet.status, character.sheet.chosen, character.sheet.attempts.map((attempt) => attempt.id),
  ]);
  const material = JSON.stringify([
    project.aspectRatio, project.quality, project.budget, project.genre ?? "", project.narration ?? null, project.frameModel ?? null, characters,
    project.scenes.map((scene) => [scene.id, scene.order, scene.kind, scene.duration, scene.motion, scene.videoModel, scene.prompt, scene.motionPrompt, scene.camera, scene.image, scene.frameKey, scene.narration]),
  ]);
  return createHash("sha256").update(material).digest("hex");
}

export function buildQuote(
  project: Pick<Project, "aspectRatio" | "quality" | "budget" | "scenes" | "ledger"> & Partial<Pick<Project, "characters" | "style" | "clips" | "genre" | "narration">>,
  prices: ReadonlyMap<string, PriceRule>,
  now = new Date(),
  frames?: { enabled: boolean; prices: ReadonlyMap<string, number> | null; override?: string | null },
  /** Whether a file exists in the project's media folder (paths relative to it, e.g. "clips/clip-….mp4"). */
  exists: (file: string) => boolean = () => true,
  voicePrice: number | null = null,
): Quote {
  const source = { characters: project.characters ?? [], style: project.style ?? "", genre: project.genre ?? "", aspectRatio: project.aspectRatio, clips: project.clips ?? [], scenes: project.scenes };
  const lines: QuoteLine[] = [];
  const reused: ReusedLine[] = [];
  const errors: string[] = [];
  for (const scene of project.scenes) {
    if (scene.kind !== "video") continue;
    // A frame made again in this run is a new file, so no clip of the old frame can stand in for it.
    let frameChanges = !frameIsCurrent(source, scene);
    if (frames?.enabled) {
      const sheets = approvedCharacterSheets(source, scene).slice(0, 4);
      const hasSheets = sheets.length > 0;
      const title = hasSheets ? `${scene.title} (referanslı kare)` : `${scene.title} (kare)`;
      const references = sheets.length + (continuityFrame(source, scene) ? 1 : 0);
      const route = frames.prices ? chooseFrameModel({ references, tier: project.quality, override: frames.override ?? null }, frames.prices) : null;
      // Frames drawn before frame models were tracked could only have come from Nano Banana 2.1 when guided by references.
      const madeBy = frameModel(scene.frameModel || (hasSheets ? REFERENCE_MODEL : ""));
      const expectedKey = hasSheets ? frameKeys(source, scene).reference : frameKeys(source, scene).flux;
      const current = scene.imageSource === "generated" && scene.frameKey === expectedKey && Boolean(hasSheets || scene.frameModel) && (madeBy?.quality ?? 0) >= TIER_MIN_QUALITY[project.quality] && (!frames.override || scene.frameModel === frames.override);
      if (current) reused.push({ sceneId: scene.id, title, kind: "image", modelLabel: madeBy?.label ?? scene.frameModel, saved: route?.ok ? route.choice.estimate : 0 });
      else if (!route) errors.push(`${scene.title}: kare modellerinin güncel fiyatı alınamadı.`);
      else if (!route.ok) errors.push(`${scene.title}: ${route.reason}`);
      else {
        frameChanges = true;
        const alternative = route.eligible.find((candidate) => candidate.id !== route.choice.id);
        const priciest = route.eligible.at(-1);
        lines.push({
          sceneId: scene.id, title, kind: "image", modelId: route.choice.id, modelLabel: route.choice.label,
          billedSeconds: 0, estimate: money(route.choice.estimate),
          reason: hasSheets ? `${route.reason} Referanslar: ${sheets.map((item) => item.character.name).join(", ")}${references > sheets.length ? " ve önceki çekim" : ""}.` : route.reason,
          alternative: alternative ? { label: alternative.label, estimate: alternative.estimate } : null,
          priciest: priciest && priciest.id !== route.choice.id ? { label: priciest.label, estimate: priciest.estimate } : null,
        });
      }
    }
    if (scene.motion !== "ai") continue;
    const route = chooseVideoModel({ duration: scene.duration, aspectRatio: project.aspectRatio, tier: project.quality, override: scene.videoModel }, prices);
    const earlier = frameChanges ? null : reusableClip(source, scene, project.quality);
    if (earlier && exists(`clips/${earlier.file}`)) {
      reused.push({ sceneId: scene.id, title: scene.title, kind: "video", modelLabel: earlier.modelLabel, saved: route.ok ? route.choice.estimate : earlier.cost });
      continue;
    }
    if (!route.ok) { errors.push(`${scene.title}: ${route.reason}`); continue; }
    const alternative = route.eligible.find((candidate) => candidate.id !== route.choice.id);
    const priciest = route.eligible.at(-1);
    lines.push({
      sceneId: scene.id, title: scene.title, kind: "video", modelId: route.choice.id, modelLabel: route.choice.label, billedSeconds: route.choice.billedSeconds, estimate: route.choice.estimate, reason: route.reason,
      alternative: alternative ? { label: alternative.label, estimate: alternative.estimate } : null,
      priciest: priciest && priciest.id !== route.choice.id ? { label: priciest.label, estimate: priciest.estimate } : null,
    });
  }
  // Paid narration is priced per character; a line already spoken with the same voice is reused.
  if (project.narration?.engine === "gmi") {
    for (const scene of project.scenes) {
      const text = narrationText(scene);
      if (!text) continue;
      const title = `${scene.title} (dış ses)`;
      const cost = voicePrice === null ? null : money(Math.max(0.0001, (text.length * voicePrice) / 1_000));
      if (exists(voiceFile(scene.id, voiceKey(project.narration, text)))) reused.push({ sceneId: scene.id, title, kind: "voice", modelLabel: VOICE_LABEL, saved: cost ?? 0 });
      else if (cost === null) errors.push(`${scene.title}: dış ses fiyatı alınamadı.`);
      else lines.push({ sceneId: scene.id, title, kind: "voice", modelId: VOICE_MODEL, modelLabel: VOICE_LABEL, billedSeconds: 0, estimate: cost, reason: `${text.length} karakter × ${voicePrice} $ / 1000 karakter.`, alternative: null, priciest: null });
    }
  }
  const total = money(lines.reduce((sum, line) => sum + line.estimate, 0));
  const committed = committedSpend(project.ledger);
  const budget = project.budget ?? 0;
  const remaining = money(budget - committed);
  return {
    id: randomUUID(), createdAt: now.toISOString(), expiresAt: new Date(now.getTime() + QUOTE_TTL_MS).toISOString(), quality: project.quality, fingerprint: quoteFingerprint(project),
    lines, reused, errors, total, budget, committed, remaining, withinBudget: project.budget !== null && lines.length > 0 && errors.length === 0 && total <= remaining,
  };
}

const NO_PROVIDERS: ProviderStatus = { nvidia: false, gmi: false, ffmpeg: false };

function makeEvent(message: string, kind: RunEvent["kind"] = "info", at = new Date().toISOString()): RunEvent {
  return { id: randomUUID(), at, message, kind };
}

function pushEvent(run: NonNullable<StoredProject["run"]>, message: string, kind: RunEvent["kind"] = "info") {
  run.events.push(makeEvent(message, kind));
  if (run.events.length > MAX_EVENTS) run.events.splice(1, run.events.length - MAX_EVENTS);
}

function makeProject(input: CreateProjectInput, now: string): StoredProject {
  return { ...input, genre: input.genre ?? "", look: input.look ?? "none", id: randomUUID(), description: input.script.trim().slice(0, 160), duration: 0, status: "draft", cover: "/images/mountains.jpg", createdAt: now, updatedAt: now, revision: 1, planner: "heuristic", planNote: "", characters: [], scenes: [], run: null, output: null, quality: "economy", quote: null, ledger: [], music: null, narration: DEFAULT_NARRATION, clips: [], frameModel: null, isExample: false };
}

function seedDatabase(): Database {
  const now = new Date().toISOString();
  const examples = [
    { title: "Dağın Hafızası", style: "Sinematik", cover: "/images/mountains.jpg", description: "Bir yolculuk. Binlerce yıllık bir hikâye.", script: "İlk sahne: Sisli dağların arasında, sabahın ilk ışığı kar çizgilerine dokunur. Kamera vadinin üzerinden ağır ağır yükselir.\n\nSahne 2: Yalnız bir yolcu taş patikada ilerler. Rüzgâr, paltosunun ucunu dağın sessizliğiyle buluşturur.\n\nSahne 3: Yolcu durur, elindeki eski fotoğrafa bakar. Fotoğraftaki zirve, karşısındaki dağla aynı kadraja girer.\n\nSahne 4: Bulutların arasından geçen ışık zirveyi aydınlatır. Yolcu ufka bakar.\n\nFinal: Yazı kartı: Bazı yollar, bizi kendimize götürür." },
    { title: "Son Işık", style: "Sinematik", cover: "/images/desert.jpg", description: "Güneşin son ışığında başlayan bir keşif.", script: "Sahne 1: Altın renkli kum tepeleri gün batımının ışığıyla parlar. Kamera alçaktan kumların üzerinden süzülür.\n\nSahne 2: Uzakta bir gezgin gölgesini takip ederek ufka yürür. Rüzgâr kumların yüzeyinde izler bırakır.\n\nFinal: Gökyüzü pembeden mora dönerken gezgin durur. Ekranda yazı: Her son, başka bir başlangıç." },
    { title: "Başka Bir Dünya", style: "Bilim kurgu", cover: "/images/space.jpg", description: "Bilinmeyen bir gezegenden ilk görüntüler.", script: "Intro: Yıldızlarla kaplı gökyüzünün altında, mavi bir gezegenin ince atmosferi görünür.\n\n1. Sahne: Bir keşif aracı kayalık yüzeye yaklaşır. Penceresinden uzak bir yıldızın ışığı yansır.\n\n2. Sahne: Astronot yüzeye ilk adımını atar. Ufukta iki ay ve mor bir sis katmanı belirir.\n\nFinal: Yazı kartı: Henüz tanışmadığımız dünyalar var." },
  ];
  return { version: 2, receipts: [], projects: examples.map((example) => {
    const project = makeProject({ title: example.title, script: example.script, style: example.style, aspectRatio: "16:9", budget: 0 }, now);
    project.cover = example.cover;
    project.description = example.description;
    project.scenes = planScenes(project.script, project.style, project.cover);
    project.duration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
    project.status = "planned";
    project.isExample = true;
    return project;
  }) };
}

type Loose = Record<string, unknown>;
/** Version 1 stored simulated demo runs; they are dropped because no media exists for them. */
export function migrateDatabase(raw: unknown): unknown {
  if (!raw || typeof raw !== "object" || (raw as Loose).version !== 1) return raw;
  const projects = Array.isArray((raw as Loose).projects) ? (raw as { projects: Loose[] }).projects : [];
  return { version: 2, receipts: [], projects: projects.map((project) => {
    const scenes = Array.isArray(project.scenes) ? (project.scenes as Loose[]) : [];
    return {
      ...project, run: null, output: null, planner: "heuristic", planNote: "", characters: [],
      status: scenes.length ? "planned" : "draft",
      scenes: scenes.map((scene) => ({ ...scene, status: "draft", motionPrompt: "", imageSource: "reference", review: null, characterIds: [], model: scene.kind === "title" ? TITLE_MODEL : VIDEO_MODEL })),
    };
  }) };
}

function checkRevision(project: StoredProject, revision: number) {
  parseInput(revisionSchema, revision);
  if (project.revision !== revision) throw new AppError(409, "Proje başka bir işlemde değişti. Güncel projeyi yükleyip tekrar deneyin.");
}
function requireIdle(project: StoredProject) {
  if (project.run?.status === "running") throw new AppError(409, "Önce devam eden üretimi durdurun.");
}
function touch(project: StoredProject, now: string) { project.revision += 1; project.updatedAt = now; }

function withoutOwner({ ...step }: StoredStep): RunStep {
  Reflect.deleteProperty(step, "owner");
  return step;
}

/** The browser never sees lease owners. */
function publicProject(project: StoredProject): Project {
  return project.run ? { ...project, run: { ...project.run, steps: project.run.steps.map(withoutOwner) } } : (project as Project);
}

function ownerAlive(owner: string | null): boolean {
  const pid = Number(owner?.split(":")[0]);
  if (!Number.isSafeInteger(pid) || pid <= 0) return false;
  if (pid === process.pid) return true;
  try { process.kill(pid, 0); return true; } catch (error) { return (error as NodeJS.ErrnoException).code !== "ESRCH"; }
}

const STEP_LABEL: Record<RunStep["kind"], string> = { image: "görsel", clip: "klip", video: "yapay zekâ videosu", title: "yazı kartı", montage: "montaj", character: "karakter sayfası", repair: "bölgesel onarım", voice: "dış ses" };

function subjectOf(project: StoredProject, step: RunStep): string {
  const name = project.scenes.find((scene) => scene.id === step.sceneId)?.title ?? project.characters.find((character) => character.id === step.characterId)?.name;
  return name ? `${name} ` : "";
}

/** The best attempt to offer: the judge's passes first, then the highest average score, then the newest. */
export function bestAttempt(attempts: SheetAttempt[]): SheetAttempt | null {
  const score = (attempt: SheetAttempt) => attempt.verdict ? (attempt.verdict.ok ? 10 : 0) + (attempt.verdict.scores.style + attempt.verdict.scores.traits + attempt.verdict.scores.pose + attempt.verdict.scores.clean) / 4 : 2.5;
  return attempts.reduce<SheetAttempt | null>((best, attempt) => !best || score(attempt) >= score(best) ? attempt : best, null);
}

export function createProjectRepository(directory: string, options: RepositoryOptions = {}) {
  const file = path.join(directory, "projects.json");
  const lock = path.join(directory, "projects.lock");
  const recoveryLock = path.join(directory, "projects.recovery");
  const mediaDirectory = path.join(directory, "media");
  const providers = options.providers ?? (async () => NO_PROVIDERS);
  const spendLimit = options.spendLimit ?? (() => null);
  const paymentsDisabled = options.paymentsDisabled ?? (() => false);
  const backupsDirectory = path.join(directory, "backups");
  const KEEP_BACKUPS = 7;

  /** Every paid request passes here before money is reserved or a request is sent. */
  function assertPaymentsAllowed() {
    if (paymentsDisabled()) throw new AppError(403, "Ödemeler acil durdurma anahtarıyla kapatıldı. KADRA_KILL_SWITCH ayarını kontrol edin.");
  }

  /** The ceiling spans every project, so one runaway loop cannot spend without bound. */
  function assertSpendLimit(database: Database, additional: number) {
    const limit = spendLimit();
    if (limit === null || additional <= 0) return;
    const spent = database.projects.reduce((sum, project) => sum + committedSpend(project.ledger), 0);
    if (money(spent + additional) > limit) throw new AppError(402, `Toplam harcama tavanı (${limit.toFixed(2)} $) aşılacak. KADRA_MAX_SPEND_USD değerini yükseltin.`);
  }

  /** One snapshot per day, taken before the first write of that day; only the newest few are kept. */
  async function backupDatabase() {
    await mkdir(backupsDirectory, { recursive: true, mode: 0o700 });
    const target = path.join(backupsDirectory, `projects-${new Date().toISOString().slice(0, 10)}.json`);
    if (await stat(target).then(() => true, () => false)) return;
    try { await copyFile(file, target); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; return; }
    const names = (await readdir(backupsDirectory)).filter((name) => /^projects-\d{4}-\d{2}-\d{2}\.json$/.test(name)).sort();
    for (const name of names.slice(0, Math.max(0, names.length - KEEP_BACKUPS))) await rm(path.join(backupsDirectory, name), { force: true });
  }

  /** Keeps the pre-upgrade file once, so a bad migration can always be rolled back. */
  async function snapshotBeforeMigration(version: unknown) {
    const target = path.join(directory, `projects.pre-v${String(version)}.json`);
    try { await copyFile(file, target); }
    catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
  }

  async function recoverStaleLock() {
    let guard;
    try { guard = await open(recoveryLock, "wx", 0o600); }
    catch (error) { if ((error as NodeJS.ErrnoException).code === "EEXIST") return; throw error; }
    try {
      await guard.writeFile(JSON.stringify({ pid: process.pid, at: Date.now() }));
      // Recheck under the recovery guard: another process may have recovered the old lock already.
      const metadata = await stat(lock);
      if (Date.now() - metadata.mtimeMs <= 30_000) return;
      let alive = false;
      try {
        const owner = JSON.parse(await readFile(lock, "utf8"));
        if (Number.isSafeInteger(owner.pid) && owner.pid > 0) {
          try { process.kill(owner.pid, 0); alive = true; } catch (failure) { alive = (failure as NodeJS.ErrnoException).code !== "ESRCH"; }
        }
      } catch { /* A stale, incomplete lock has no owner. */ }
      if (!alive) await unlink(lock);
    } catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
    finally { await guard.close(); await unlink(recoveryLock).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  }

  async function acquireLock(): Promise<() => Promise<void>> {
    await mkdir(directory, { recursive: true, mode: 0o700 });
    const token = randomUUID();
    const deadline = Date.now() + 5_000;
    while (true) {
      try {
        const handle = await open(lock, "wx", 0o600);
        try { await handle.writeFile(JSON.stringify({ token, pid: process.pid, at: Date.now() })); }
        finally { await handle.close(); }
        return async () => {
          try { const owner = JSON.parse(await readFile(lock, "utf8")); if (owner.token === token) await unlink(lock); }
          catch (error) { if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error; }
        };
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") throw error;
        try {
          const metadata = await stat(lock);
          // An incomplete lock can briefly exist while its owner writes the token.
          if (Date.now() - metadata.mtimeMs > 30_000) {
            await recoverStaleLock();
          }
        } catch (failure) { if ((failure as NodeJS.ErrnoException).code !== "ENOENT") throw failure; }
        if (Date.now() >= deadline) throw new AppError(503, "Yerel depo şu anda meşgul. Biraz sonra tekrar deneyin.");
        await new Promise((resolve) => setTimeout(resolve, 20 + Math.random() * 30));
      }
    }
  }

  async function writeDatabase(database: Database) {
    const serialized = JSON.stringify(database, null, 2);
    if (Buffer.byteLength(serialized, "utf8") > 20 * 1024 * 1024) throw new AppError(400, "Yerel depo 20 MB sınırına ulaştı. Yeni değişikliklerden önce eski projeleri dışa aktarın ve silin.");
    const temporary = `${file}.${randomUUID()}.tmp`;
    const handle = await open(temporary, "wx", 0o600);
    try { await handle.writeFile(serialized); await handle.sync(); }
    finally { await handle.close(); }
    try {
      await rename(temporary, file);
      const directoryHandle = await open(directory, "r");
      try { await directoryHandle.sync(); } finally { await directoryHandle.close(); }
    } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== "ENOENT") throw error; }); }
  }

  async function transaction<T>(action: (database: Database) => T): Promise<T> {
    const release = await acquireLock();
    try {
      let database: Database;
      let initialized = false;
      let migratedFrom: unknown = null;
      try {
        if ((await stat(file)).size > 20 * 1024 * 1024) throw new AppError(500, "Yerel veri dosyası beklenen boyutu aşıyor. Dosyayı yedekleyip inceleyin.");
        const raw = JSON.parse(await readFile(file, "utf8"));
        const parsed = databaseSchema.safeParse(migrateDatabase(raw));
        if (!parsed.success) throw new Error("Invalid local database schema");
        database = parsed.data as Database;
        initialized = raw.version !== database.version;
        if (initialized) migratedFrom = raw.version;
        const unique = new Set(database.projects.map((project) => project.id));
        if (unique.size !== database.projects.length) throw new Error("Duplicate project IDs");
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === "ENOENT") { database = seedDatabase(); initialized = true; }
        else if (error instanceof AppError) throw error;
        else throw new AppError(500, "Yerel veri dosyası okunamadı veya bozuk. Güvenlik için dosya değiştirilmedi; .data/projects.json yedeğini inceleyin.");
      }
      const before = JSON.stringify(database);
      const result = action(database);
      if (initialized || JSON.stringify(database) !== before) {
        if (migratedFrom !== null) await snapshotBeforeMigration(migratedFrom);
        else if (!initialized) await backupDatabase();
        await writeDatabase(database);
      }
      return structuredClone(result);
    } finally { await release(); }
  }
  function find(database: Database, id: string): StoredProject {
    parseInput(idSchema, id);
    const project = database.projects.find((item) => item.id === id);
    if (!project) throw new AppError(404, "Proje bulunamadı.");
    return project;
  }
  /** Worker writes are only accepted for the step they claimed in the run that is still active. */
  function activeStep(database: Database, projectId: string, runId: string, stepId: string) {
    const project = database.projects.find((item) => item.id === projectId);
    const run = project?.run;
    if (!project || !run || run.id !== runId || run.status !== "running") return null;
    const step = run.steps.find((item) => item.id === stepId);
    return step && step.status === "running" ? { project, run, step } : null;
  }
  function stopRun(project: StoredProject, status: "failed" | "cancelled", now: string) {
    const run = project.run!;
    run.status = status; run.completedAt = now;
    run.steps.forEach((step) => { if (step.status === "pending" || step.status === "running") { step.status = "skipped"; step.leaseUntil = null; step.owner = null; } });
    project.scenes.forEach((scene) => { if (scene.status !== "ready" && scene.status !== "failed") scene.status = "draft"; });
    project.characters.forEach((character) => {
      if (character.sheet.status !== "producing") return;
      const best = bestAttempt(character.sheet.attempts.filter((attempt) => attempt.runId === run.id));
      character.sheet.status = best ? "review" : character.sheet.chosen ? "review" : "none";
      if (best) character.sheet.chosen = best.id;
    });
    // Money set aside for paid steps that were never sent goes back to the budget.
    project.ledger.forEach((entry) => { if (entry.runId === run.id && entry.status === "reserved") { entry.status = "released"; entry.note = "Üretim bitmeden durdu; istek gönderilmedi, ayrılan tutar bütçeye döndü."; } });
    project.status = "planned"; project.updatedAt = now;
  }
  function ledgerEntry(project: StoredProject, ledgerId: string | undefined) {
    return project.ledger.find((entry) => entry.id === ledgerId);
  }

  return {
    directory,
    mediaDirectory,
    getBootstrap: async (): Promise<AppBootstrap> => {
      const status = await providers();
      return transaction((database) => ({ projects: database.projects.toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)).map(publicProject), models: modelCatalog(status), videoModels: VIDEO_MODELS.map(({ id, label, quality }) => ({ id, label, quality })), providers: status, storage: "local-file" as const }));
    },
    getProject: (id: string): Promise<Project> => transaction((database) => publicProject(find(database, id))),
    createProject: (input: CreateProjectInput): Promise<Project> => transaction((database) => {
      if (database.projects.length >= 100) throw new AppError(400, "Yerel sürümde en fazla 100 proje saklanabilir.");
      const project = makeProject(parseInput(createProjectSchema, input), new Date().toISOString());
      database.projects.unshift(project); return publicProject(project);
    }),
    updateProject: (id: string, input: ProjectPatch): Promise<Project> => transaction((database) => {
      const patch = parseInput(updateProjectSchema, input); const project = find(database, id); checkRevision(project, patch.revision); requireIdle(project);
      if (patch.sceneOrder) {
        const ids = new Set(patch.sceneOrder);
        if (ids.size !== patch.sceneOrder.length || ids.size !== project.scenes.length || project.scenes.some((scene) => !ids.has(scene.id))) throw new AppError(400, "Çekim sırası mevcut tüm çekimleri tam bir kez içermeli.");
        project.scenes = patch.sceneOrder.map((sceneId, index) => ({ ...project.scenes.find((scene) => scene.id === sceneId)!, order: index + 1 }));
      }
      const fields = { ...patch };
      delete fields.sceneOrder;
      Reflect.deleteProperty(fields, "revision");
      const replan = (fields.script !== undefined && fields.script !== project.script) || (fields.style !== undefined && fields.style !== project.style);
      Object.assign(project, fields);
      if (fields.script !== undefined) project.description = fields.script.trim().slice(0, 160);
      if (replan) { project.scenes = []; project.characters = []; project.planNote = ""; project.duration = 0; project.status = "draft"; project.run = null; }
      else if (project.scenes.length) { project.status = "planned"; project.run = null; project.scenes.forEach((scene) => { scene.status = "draft"; }); }
      touch(project, new Date().toISOString()); return publicProject(project);
    }),
    deleteProject: async (id: string, revision: number): Promise<void> => {
      await transaction((database) => {
        const project = find(database, id); checkRevision(project, revision); requireIdle(project);
        database.projects = database.projects.filter((item) => item.id !== id); database.receipts = database.receipts.filter((receipt) => receipt.projectId !== id);
      });
      await rm(projectMediaDirectory(mediaDirectory, id), { recursive: true, force: true });
    },
    /** The AI call runs outside the file lock; the result is only committed if nobody changed the project meanwhile. */
    planProject: async (id: string, revision: number, mode: "auto" | "heuristic" = "auto"): Promise<Project> => {
      const snapshot = await transaction((database) => {
        const project = find(database, id); checkRevision(project, revision); requireIdle(project); parseScript(project.script);
        return { script: project.script, style: project.style, aspectRatio: project.aspectRatio, genre: project.genre, cover: project.cover };
      });
      const status = await providers();
      const useAi = mode === "auto" && Boolean(options.aiPlanner) && Boolean(status.deepseek || status.nvidia);
      let plan: Pick<Project, "planner" | "planNote" | "characters" | "scenes">;
      if (useAi) {
        try {
          const result = scenesFromAiPlan(await options.aiPlanner!({ script: snapshot.script, style: snapshot.style, aspectRatio: snapshot.aspectRatio, genre: snapshot.genre }), snapshot.cover);
          plan = { planner: status.deepseek ? "deepseek" : "nemotron", planNote: "", ...result };
        } catch (error) {
          const reason = error instanceof Error ? error.message : "bilinmeyen hata";
          plan = { planner: "heuristic", planNote: `Yapay zekâ planlayıcısı kullanılamadı (${reason.slice(0, 200)}). Kural tabanlı plan hazırlandı; daha sonra yeniden deneyebilirsiniz.`, characters: [], scenes: planScenes(snapshot.script, snapshot.style, snapshot.cover) };
        }
      } else {
        plan = { planner: "heuristic", planNote: "", characters: [], scenes: planScenes(snapshot.script, snapshot.style, snapshot.cover) };
      }
      return transaction((database) => {
        const project = find(database, id); checkRevision(project, revision); requireIdle(project);
        Object.assign(project, plan);
        project.duration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0); project.status = "planned"; project.run = null;
        touch(project, new Date().toISOString()); return publicProject(project);
      });
    },
    updateScene: (id: string, sceneId: string, revision: number, input: ScenePatch): Promise<Project> => transaction((database) => {
      const patch = parseInput(scenePatchSchema, input); const project = find(database, id); checkRevision(project, revision); requireIdle(project); parseInput(idSchema, sceneId);
      const scene = project.scenes.find((item) => item.id === sceneId); if (!scene) throw new AppError(404, "Çekim bulunamadı.");
      if (patch.model && ![VIDEO_MODEL, TITLE_MODEL].includes(patch.model)) throw new AppError(400, "Katalogdaki bir üretim yöntemini seçin.");
      if (patch.characterIds?.some((characterId) => !project.characters.some((character) => character.id === characterId))) throw new AppError(400, "Çekime yalnızca projedeki karakterler bağlanabilir.");
      const frameChanged = (patch.prompt !== undefined && patch.prompt !== scene.prompt) || (patch.description !== undefined && patch.description !== scene.description);
      Object.assign(scene, patch);
      if (patch.kind) { scene.model = patch.kind === "title" ? TITLE_MODEL : VIDEO_MODEL; }
      if (frameChanged && scene.imageSource === "generated") { scene.imageSource = "reference"; scene.review = null; scene.repair = null; }
      project.scenes.forEach((item) => { item.status = "draft"; }); project.run = null; project.status = "planned"; project.duration = project.scenes.reduce((sum, item) => sum + item.duration, 0); touch(project, new Date().toISOString()); return publicProject(project);
    }),
    /** Without a quote the run is free. With one, every paid shot is reserved against the budget before anything is sent. */
    /**
     * Frames are only made again when what they are made from changed or the reviewer flagged them; `reuseImages` also keeps
     * flagged frames and `regenerate` remakes every frame. Paid shots whose clip already exists are not in the quote at all.
     */
    startRun: async (id: string, revision: number, key: string, quoteId: string | null = null, options: { target?: "frames" | "film"; reuseImages?: boolean; prepareCharacters?: boolean; regenerate?: boolean } = {}): Promise<Project> => {
      parseInput(idempotencySchema, key); parseInput(revisionSchema, revision);
      if (quoteId !== null) parseInput(idSchema, quoteId);
      const status = await providers();
      const target = options.target ?? "film";
      if (target === "frames" && quoteId) throw new AppError(400, "Kare aşaması ücretli video teklifiyle başlatılamaz.");
      return transaction((database) => {
        const project = find(database, id); const fingerprint = JSON.stringify({ mode: quoteId ? "paid" : "free", revision, quoteId, ...options });
        const receipt = database.receipts.find((item) => item.projectId === id && item.key === key);
        if (receipt) {
          if (receipt.fingerprint !== fingerprint || project.run?.id !== receipt.runId) throw new AppError(409, "Bu işlem anahtarı daha önce başka bir üretim isteğinde kullanıldı. Yeni bir anahtar oluşturun.");
          return publicProject(project);
        }
        checkRevision(project, revision); requireIdle(project);
        if (!project.scenes.length) throw new AppError(400, "Önce senaryodan bir çekim planı hazırlayın.");
        if (!status.ffmpeg) throw new AppError(400, "FFmpeg bulunamadı. Video montajı için FFmpeg kurulu olmalı (FFMPEG_PATH ile yolunu belirtebilirsiniz).");
        let paidVideoLines = new Map<string, QuoteLine>();
        let paidImageLines = new Map<string, QuoteLine>();
        let paidVoiceLines = new Map<string, QuoteLine>();
        if (quoteId) {
          const quote = project.quote;
          if (!status.gmi) throw new AppError(400, "GMI anahtarı tanımlı değil; ücretli üretim başlatılamaz.");
          if (!quote || quote.id !== quoteId) throw new AppError(409, "Bu fiyat teklifi artık geçerli değil. Yeni bir teklif alın.");
          if (Date.parse(quote.expiresAt) < Date.now()) throw new AppError(409, "Fiyat teklifinin süresi doldu (15 dakika). Güncel fiyatlarla yeni bir teklif alın.");
          if (quote.fingerprint !== quoteFingerprint(project)) throw new AppError(409, "Teklif alındıktan sonra çekimler veya bütçe değişti. Yeni bir teklif alın.");
          const remaining = money((project.budget ?? 0) - committedSpend(project.ledger));
          if (project.budget === null || !quote.withinBudget || quote.total > remaining) throw new AppError(400, `Teklif (${quote.total.toFixed(2)} $) kalan bütçeyi (${Math.max(0, remaining).toFixed(2)} $) aşıyor.`);
          paidImageLines = new Map(quote.lines.filter((line) => line.kind === "image").map((line) => [line.sceneId, line]));
          paidVideoLines = new Map(quote.lines.filter((line) => (line.kind ?? "video") === "video").map((line) => [line.sceneId, line]));
          paidVoiceLines = new Map(quote.lines.filter((line) => line.kind === "voice").map((line) => [line.sceneId, line]));
          assertPaymentsAllowed();
          assertSpendLimit(database, money([...paidImageLines.values(), ...paidVideoLines.values(), ...paidVoiceLines.values()].reduce((sum, line) => sum + line.estimate, 0)));
        }
        if (database.receipts.length >= 1_000) database.receipts.splice(0, database.receipts.length - 999);
        const now = new Date().toISOString();
        const runId = randomUUID();
        const step = (kind: RunStep["kind"], sceneId: string | null, paid: StoredStep["paid"] = null): StoredStep => ({ id: randomUUID(), kind, sceneId, characterId: null, status: "pending", attempts: 0, leaseUntil: null, owner: null, note: "", paid, repair: null });
        // A shot with narration gets a voice step: paid when the quote bought it, otherwise the cached or free voice.
        const voiceSteps = (scene: StoredProject["scenes"][number]): StoredStep[] => {
          if (project.narration.engine === "off" || !narrationText(scene)) return [];
          const line = paidVoiceLines.get(scene.id);
          if (!line) return [step("voice", scene.id)];
          const ledgerId = randomUUID();
          project.ledger.push({ id: ledgerId, at: now, runId, sceneId: scene.id, sceneTitle: `${scene.title} (dış ses)`, provider: "GMI", kind: "voice", model: line.modelId, modelLabel: line.modelLabel, estimate: line.estimate, actual: null, status: "reserved", requestId: null, note: "Dış ses için bütçeden ayrıldı." });
          return [step("voice", scene.id, { ledgerId, model: line.modelId, requestId: null, submittedAt: null, unitCost: line.estimate, repairCost: 0, job: "generate" })];
        };
        let steps = [...project.scenes.flatMap((scene) => [...shotSteps(scene), ...voiceSteps(scene)]), step("montage", null)];
        function shotSteps(scene: StoredProject["scenes"][number]): StoredStep[] {
          if (scene.kind === "title") return [step("title", scene.id)];
          const imgLine = paidImageLines.get(scene.id);
          let imgPaid: StoredStep["paid"] = null;
          if (imgLine) {
            const imgLedgerId = randomUUID();
            project.ledger.push({ id: imgLedgerId, at: now, runId, sceneId: scene.id, sceneTitle: `${scene.title} (kare)`, provider: "GMI", kind: "image", model: imgLine.modelId, modelLabel: imgLine.modelLabel, estimate: imgLine.estimate, actual: null, status: "reserved", requestId: null, note: "Karakter referanslı kare için bütçeden ayrıldı." });
            imgPaid = { ledgerId: imgLedgerId, model: imgLine.modelId, requestId: null, submittedAt: null, unitCost: imgLine.estimate, repairCost: 0, job: "generate" };
          }
          const line = paidVideoLines.get(scene.id);
          if (!line) return [step("image", scene.id, imgPaid), step("clip", scene.id)];
          const ledgerId = randomUUID();
          project.ledger.push({ id: ledgerId, at: now, runId, sceneId: scene.id, sceneTitle: scene.title, provider: "GMI", kind: "video", model: line.modelId, modelLabel: line.modelLabel, estimate: line.estimate, actual: null, status: "reserved", requestId: null, note: `${line.billedSeconds} sn için bütçeden ayrıldı.` });
          return [step("image", scene.id, imgPaid), step("video", scene.id, { ledgerId, model: line.modelId, requestId: null, submittedAt: null, unitCost: line.estimate, repairCost: 0, job: "generate" })];
        }
        if (target === "frames") steps = steps.filter((item) => item.kind === "image");
        if (!steps.length) throw new AppError(400, "Üretilecek görsel çekim yok.");
        // Frame stage completes before clip generation; references are stable for the whole film.
        steps = [...steps.filter((item) => item.kind === "image"), ...steps.filter((item) => item.kind !== "image")];
        if (options.prepareCharacters) {
          const pending = project.characters.filter((character) => character.sheet.status !== "approved");
          if (pending.some((character) => character.reference)) throw new AppError(400, "Fotoğraf referanslı karakterler için önce Karakter bankasında fiyatı onaylayın ve sayfaları hazırlayın.");
          if (pending.length && !status.nvidia) throw new AppError(400, "Otomatik karakter hazırlamak için NVIDIA bağlantısı gerekir. Karakterleri elle hazırlayabilir veya yalnızca film üretimini seçebilirsiniz.");
          steps.unshift(...pending.map((character) => ({ ...step("character", null), characterId: character.id })));
          pending.forEach((character) => { character.sheet.status = "producing"; });
        }
        const paidTotal = money([...paidImageLines.values(), ...paidVideoLines.values(), ...paidVoiceLines.values()].reduce((sum, line) => sum + line.estimate, 0));
        const message = quoteId
          ? `Üretim başladı.${paidImageLines.size ? ` ${paidImageLines.size} çekim karesi onaylı karakter sayfalarıyla Nano Banana 2.1 üzerinden üretilecek.` : ""}${paidVideoLines.size ? ` ${paidVideoLines.size} çekim GMI ile yapay zekâ videosuna dönüşecek.` : ""}${paidVoiceLines.size ? ` ${paidVoiceLines.size} çekimin dış sesi ${VOICE_LABEL} ile seslendirilecek.` : ""} Tahmini ${paidTotal.toFixed(2)} $ bütçeden ayrıldı.`
          : status.nvidia
            ? "Ücretsiz üretim başladı. Görseller NVIDIA FLUX.2 Klein ile üretilip Nemotron VL ile kontrol edilecek; FFmpeg kamera hareketini ve montajı yapacak. Ücretli istek gönderilmez."
            : "Ücretsiz üretim başladı. NVIDIA anahtarı olmadığı için çekimlerde mevcut referans görseller kullanılacak; FFmpeg hareketi ve montajı yapacak.";
        const run = { id: runId, mode: quoteId ? "paid" as const : "free" as const, regenerateImages: Boolean(options.regenerate) && !quoteId, keepFlagged: Boolean(quoteId) || Boolean(options.reuseImages), target, prepareCharacters: options.prepareCharacters ?? false, status: "running" as const, startedAt: now, completedAt: null, progress: 0, cost: paidTotal, steps, events: [makeEvent(message, "info", now)] };
        project.run = run; project.quote = null; project.status = "producing"; project.scenes.forEach((scene) => { scene.status = "queued"; }); touch(project, now);
        database.receipts.push({ projectId: id, key, fingerprint, runId: run.id }); return publicProject(project);
      });
    },
    cancelRun: (id: string, revision: number): Promise<Project> => transaction((database) => {
      parseInput(revisionSchema, revision);
      const project = find(database, id);
      // Worker progress does not bump the revision, so a running project can always be stopped.
      if (!project.run || project.run.status !== "running") throw new AppError(409, "Durdurulacak bir üretim yok.");
      const now = new Date().toISOString();
      stopRun(project, "cancelled", now);
      pushEvent(project.run, "Üretim durduruldu. Tamamlanan görseller projede kaldı; film birleştirilmedi. Gönderilmemiş ücretli istekler için ayrılan tutar bütçeye döndü.", "warning");
      touch(project, now); return publicProject(project);
    }),
    /** Claims the next step of any active run. Steps run in order; an expired or orphaned lease is taken over. */
    claimStep: (owner: string, leaseMs: number): Promise<{ project: Project; runId: string; step: RunStep } | null> => transaction((database) => {
      const now = Date.now();
      for (const project of database.projects) {
        const run = project.run;
        if (!run || run.status !== "running") continue;
        const step = run.steps.find((item) => item.status === "pending" || item.status === "running");
        if (!step) continue;
        if (step.status === "running" && (step.owner === owner || (step.leaseUntil && Date.parse(step.leaseUntil) > now && ownerAlive(step.owner)))) continue;
        const scene = project.scenes.find((item) => item.id === step.sceneId);
        if (step.attempts >= MAX_ATTEMPTS) {
          step.status = "failed"; if (scene) scene.status = "failed";
          stopRun(project, "failed", new Date(now).toISOString());
          pushEvent(run, `Üretim durdu: ${subjectOf(project, step)}${STEP_LABEL[step.kind]} adımı ${MAX_ATTEMPTS} denemede tamamlanamadı.`, "warning");
          continue;
        }
        if (step.status === "running") pushEvent(run, `${subjectOf(project, step).trim() ? `${subjectOf(project, step).trim()}: ` : ""}yarım kalan ${STEP_LABEL[step.kind]} adımı yeniden başlatılıyor.`, "warning");
        step.status = "running"; step.attempts += 1; step.owner = owner; step.leaseUntil = new Date(now + leaseMs).toISOString();
        if (scene) scene.status = "running";
        project.updatedAt = new Date(now).toISOString();
        return { project: publicProject(project), runId: run.id, step: withoutOwner(step) };
      }
      return null;
    }),
    completeStep: (projectId: string, runId: string, stepId: string, result: StepResult): Promise<boolean> => transaction((database) => {
      const active = activeStep(database, projectId, runId, stepId);
      if (!active) return false;
      const { project, run, step } = active;
      const now = new Date().toISOString();
      const scene = project.scenes.find((item) => item.id === step.sceneId);
      step.status = "done"; step.leaseUntil = null; step.owner = null; step.note = result.note.slice(0, 500);
      if (result.kind === "image" && scene) {
        if (result.url !== scene.image) { scene.repair = null; scene.frameModel = result.frameModel ?? ""; }
        scene.image = result.url; scene.imageSource = result.source; scene.review = result.review;
        if (result.frameKey !== undefined) scene.frameKey = result.frameKey;
        if (run.target === "frames") scene.status = "ready";
        const entry = ledgerEntry(project, step.paid?.ledgerId);
        if (entry && result.ledger) { entry.status = result.ledger.status; entry.note = result.ledger.note.slice(0, 500); entry.at = now; if (result.ledger.status === "charged") entry.actual = entry.estimate; }
        pushEvent(run, `${scene.title}: ${result.source === "generated" ? "görsel üretildi" : "referans görsel kullanılacak"}.${result.note ? ` ${result.note}` : ""}`, result.review && !result.review.ok ? "warning" : "success");
      } else if ((result.kind === "clip" || result.kind === "title") && scene) {
        scene.status = "ready";
        pushEvent(run, `${scene.title}: ${result.kind === "title" ? "yazı kartı" : "klip"} hazır.${result.note ? ` ${result.note}` : ""}`, "success");
      } else if (result.kind === "video" && scene) {
        scene.status = "ready";
        const entry = ledgerEntry(project, step.paid?.ledgerId);
        if (entry) { entry.status = result.ledger.status; entry.note = result.ledger.note.slice(0, 500); entry.at = now; }
        const clip = result.clip;
        if (clip) {
          project.clips = [...project.clips.filter((record) => record.sceneId !== clip.sceneId || record.key !== clip.key), { ...clip, createdAt: now }];
          if (project.clips.length > 300) project.clips = keptClips(project);
        }
        pushEvent(run, `${scene.title}: ${result.ledger.status === "charged" ? "yapay zekâ videosu hazır" : "yapay zekâ videosu alınamadı, ücretsiz kamera hareketi kullanıldı"}.${result.note ? ` ${result.note}` : ""}`, result.ledger.status === "charged" ? "success" : "warning");
      } else if (result.kind === "character") {
        const character = project.characters.find((item) => item.id === step.characterId);
        if (character) {
          const attempts = character.sheet.attempts.filter((attempt) => attempt.runId === run.id);
          const best = bestAttempt(attempts);
          character.sheet.status = best ? "review" : "failed";
          if (best) character.sheet.chosen = best.id;
          character.sheet.note = result.note.slice(0, 600);
          if (run.prepareCharacters) {
            if (best?.verdict?.ok) character.sheet.status = "approved";
            else {
              stopRun(project, "failed", now);
              pushEvent(run, `${character.name}: otomatik akış durdu; karakter bankasında sayfayı inceleyip onaylayın ve akışı yeniden başlatın.`, "warning");
              project.updatedAt = now;
              return true;
            }
          }
          const entry = ledgerEntry(project, step.paid?.ledgerId);
          if (entry) {
            // Failed provider jobs may still be billed, so they count until the console says otherwise.
            const paid = attempts.reduce((sum, attempt) => sum + attempt.cost, 0) + result.failedSubmissions * (step.paid?.unitCost ?? 0);
            entry.actual = result.uncertain ? null : money(paid); entry.at = now;
            entry.status = result.uncertain ? "submitted" : result.failedSubmissions > 0 ? "failed" : paid > 0 ? "charged" : "released";
            entry.note = `${attempts.filter((attempt) => attempt.cost > 0).length} deneme × ${(step.paid?.unitCost ?? 0).toFixed(3)} $ (tahmini).${result.uncertain ? " Bir gönderimin sonucu belirsiz; GMI konsolundan kontrol edin." : ""}`;
          }
          pushEvent(run, `${character.name}: ${best ? (best.verdict?.ok ? "hakem karakter sayfasını onayladı; son karar senin" : "hakem onaylamadı; en iyi deneme incelemene sunuldu") : "karakter sayfası üretilemedi"}.${result.note ? ` ${result.note}` : ""}`, best?.verdict?.ok ? "success" : "warning");
        }
      } else if (result.kind === "voice") {
        const entry = ledgerEntry(project, step.paid?.ledgerId);
        if (entry && result.ledger) { entry.status = result.ledger.status; entry.note = result.ledger.note.slice(0, 500); entry.at = now; if (result.ledger.status === "charged") entry.actual = entry.estimate; }
        pushEvent(run, `${scene?.title ?? ""}: dış ses hazır.${result.note ? ` ${result.note}` : ""}`, result.ledger?.status === "failed" ? "warning" : "success");
      } else if (result.kind === "repair") {
        const entry = ledgerEntry(project, step.paid?.ledgerId);
        if (entry) { entry.status = result.ledger.status; entry.note = result.ledger.note.slice(0, 500); entry.at = now; if (result.ledger.status === "charged") entry.actual = money(result.cost); }
        const character = project.characters.find((item) => item.id === step.characterId);
        if (scene) {
          scene.status = "ready";
          if (result.url && step.repair) {
            scene.repair = { previous: scene.image, box: step.repair.box, instruction: step.repair.instruction, at: now, cost: money(result.cost) };
            scene.image = result.url; scene.imageSource = "generated"; scene.review = result.review;
          }
        } else if (character) {
          if (result.url) {
            const id = randomUUID();
            character.sheet.attempts.push({ id, runId: run.id, url: result.url, at: now, engine: "repair", verdict: result.verdict, cost: money(result.cost) });
            while (character.sheet.attempts.length > 24) character.sheet.attempts.splice(character.sheet.attempts.findIndex((item) => item.id !== character.sheet.chosen), 1);
            character.sheet.chosen = id;
          }
          character.sheet.status = character.sheet.chosen ? "review" : "none";
          character.sheet.note = result.url ? "Onarılan sayfa incelemende; beğenirsen onayla." : result.note.slice(0, 600);
        }
        const subject = scene?.title ?? character?.name ?? "";
        pushEvent(run, `${subject}: ${result.url ? "işaretli bölge onarıldı, görselin geri kalanı korundu" : "onarım yapılamadı"}.${result.note ? ` ${result.note}` : ""}`, result.url ? "success" : "warning");
      } else if (result.kind === "montage") {
        project.output = { runId: run.id, url: result.url, duration: result.duration, createdAt: now };
        project.clips = keptClips(project);
        const spent = committedSpend(project.ledger.filter((entry) => entry.runId === run.id));
        pushEvent(run, `Film hazır: ${result.duration.toFixed(1)} saniye. ${spent ? `Bu üretimin tahmini ücretli harcaması: ${spent.toFixed(2)} $.` : "Gerçek gider: $0."}`, "success");
      }
      const done = run.steps.filter((item) => item.status === "done").length;
      run.progress = Math.round((done / run.steps.length) * 1000) / 10;
      if (done === run.steps.length) {
        run.status = "completed"; run.completedAt = now;
        if (run.target === "frames") project.scenes.forEach((item) => { if (item.kind === "title") item.status = "draft"; });
        if (run.mode === "characters" || run.mode === "repair" || run.target === "frames") project.status = project.output ? "ready" : project.scenes.length ? "planned" : "draft";
        else {
          project.status = "ready";
          const generated = project.scenes.find((item) => item.imageSource === "generated");
          if (generated) project.cover = generated.image;
        }
      }
      project.updatedAt = now;
      return true;
    }),
    failStep: (projectId: string, runId: string, stepId: string, message: string, retryable: boolean): Promise<boolean> => transaction((database) => {
      const active = activeStep(database, projectId, runId, stepId);
      if (!active) return false;
      const { project, run, step } = active;
      const scene = project.scenes.find((item) => item.id === step.sceneId);
      const label = `${subjectOf(project, step)}${STEP_LABEL[step.kind]}`;
      step.note = message.slice(0, 500); step.leaseUntil = null; step.owner = null;
      // Retrying is safe before a paid request is sent, or once its request id is known (the retry only polls); never in between.
      const uncertain = Boolean(step.paid?.submittedAt && !step.paid.requestId);
      if (retryable && step.attempts < MAX_ATTEMPTS && !uncertain) {
        step.status = "pending";
        pushEvent(run, `${label}: ${message} Yeniden denenecek (${step.attempts}/${MAX_ATTEMPTS}).`, "warning");
        project.updatedAt = new Date().toISOString();
      } else {
        step.status = "failed"; if (scene) scene.status = "failed";
        stopRun(project, "failed", new Date().toISOString());
        pushEvent(run, `Üretim durdu: ${label} — ${message}`, "warning");
      }
      return true;
    }),
    /** A storyboard file becomes a ready-to-produce project; its prompts, timings and camera notes are kept verbatim. */
    importStoryboard: (input: Omit<CreateProjectInput, "script"> & { shots: StoryboardShot[]; characters?: { name: string; appearance: string; aliases: string[]; style: string }[] }): Promise<Project> => transaction((database) => {
      if (database.projects.length >= 100) throw new AppError(400, "Yerel sürümde en fazla 100 proje saklanabilir.");
      const now = new Date().toISOString();
      const project = makeProject(parseInput(createProjectSchema, { title: input.title, script: scriptFromStoryboard(input.shots), style: input.style, aspectRatio: input.aspectRatio, budget: input.budget }), now);
      project.scenes = scenesFromStoryboard(input.shots, project.cover);
      project.characters = (input.characters ?? []).map((item, index) => characterSchema.parse(newCharacter(`c${index + 1}`, item.name, item.appearance, item.aliases, item.style)));
      if (project.characters.length > 12) throw new AppError(400, "En fazla 12 karakter olabilir.");
      project.scenes.forEach((scene) => { scene.characterIds = project.characters.filter((character) => mentionsCharacter(scene, character)).map((character) => character.id); });
      project.planner = "import";
      project.planNote = "";
      project.description = `${input.shots.length} çekimlik storyboard içe aktarıldı.`;
      project.duration = project.scenes.reduce((sum, scene) => sum + scene.duration, 0);
      project.status = "planned";
      database.projects.unshift(project);
      return publicProject(project);
    }),
    /** Stores new music settings (and, when the film was re-mixed, its new file) only if nothing changed meanwhile. */
    commitSoundtrack: (id: string, revision: number, music: Soundtrack | null, output?: ProjectOutput): Promise<Project> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      project.music = music;
      if (output) project.output = output;
      touch(project, new Date().toISOString());
      return publicProject(project);
    }),
    addCharacter: (id: string, revision: number, input: CharacterInput): Promise<Project> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      if (project.characters.length >= 12) throw new AppError(400, "Bir projede en fazla 12 karakter ve mekân olabilir.");
      const kind = input.kind ?? "person";
      const prefix = kind === "place" ? "m" : "c";
      let number = 1;
      while (project.characters.some((character) => character.id === `${prefix}${number}`)) number += 1;
      const character = newCharacter(`${prefix}${number}`, input.name.trim(), input.appearance.trim(), input.aliases.length ? input.aliases : [input.name], input.style.trim(), kind);
      project.characters.push(character);
      project.scenes.forEach((scene) => { if (mentionsCharacter(scene, character) && !scene.characterIds.includes(character.id)) scene.characterIds.push(character.id); });
      project.quote = null;
      touch(project, new Date().toISOString()); return publicProject(project);
    }),
    /** Edits keep existing shot links and add new ones for new aliases; an approved sheet stays approved until the user regenerates it. */
    updateCharacter: (id: string, revision: number, characterId: string, input: Partial<CharacterInput>): Promise<Project> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      const character = project.characters.find((item) => item.id === characterId);
      if (!character) throw new AppError(404, "Karakter bulunamadı.");
      const looksChanged = (input.appearance !== undefined && input.appearance.trim() !== character.appearance) || (input.style !== undefined && input.style.trim() !== character.style);
      if (input.name !== undefined) character.name = input.name.trim();
      if (input.appearance !== undefined) character.appearance = input.appearance.trim();
      if (input.style !== undefined) character.style = input.style.trim();
      if (input.aliases !== undefined) character.aliases = input.aliases.map((alias) => alias.trim()).filter(Boolean).slice(0, 12);
      if (looksChanged && character.sheet.status === "approved") character.sheet.note = "Tarif değişti; karakter sayfasını yeniden üretmek isteyebilirsin.";
      project.scenes.forEach((scene) => { if (mentionsCharacter(scene, character) && !scene.characterIds.includes(character.id)) scene.characterIds.push(character.id); });
      project.quote = null;
      touch(project, new Date().toISOString()); return publicProject(project);
    }),
    /** Returns the media files that belonged only to the removed character, for the caller to delete. */
    deleteCharacter: (id: string, revision: number, characterId: string): Promise<{ project: Project; files: string[] }> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      const character = project.characters.find((item) => item.id === characterId);
      if (!character) throw new AppError(404, "Karakter bulunamadı.");
      project.characters = project.characters.filter((item) => item.id !== characterId);
      project.scenes.forEach((scene) => { scene.characterIds = scene.characterIds.filter((item) => item !== characterId); });
      project.quote = null;
      touch(project, new Date().toISOString());
      return { project: publicProject(project), files: [...(character.reference ? [character.reference.file] : []), ...character.sheet.attempts.map((attempt) => attempt.url.split("/").pop()!)] };
    }),
    setCharacterReference: (id: string, revision: number, characterId: string, reference: ReferencePhoto | null): Promise<{ project: Project; previous: string | null }> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      const character = project.characters.find((item) => item.id === characterId);
      if (!character) throw new AppError(404, "Karakter bulunamadı.");
      const previous = character.reference?.file ?? null;
      character.reference = reference;
      project.quote = null;
      touch(project, new Date().toISOString());
      return { project: publicProject(project), previous: previous !== reference?.file ? previous : null };
    }),
    /** Prices a character run without starting it. */
    estimateCharacterRun: async (id: string, characterIds: string[], runOptions: { engine?: "auto" | "nano-banana"; budget?: number } = {}): Promise<CharacterEstimate> => {
      const project = await transaction((database) => publicProject(find(database, id)));
      const status = await providers();
      const needsPrice = status.gmi && (runOptions.engine === "nano-banana" || characterIds.some((characterId) => project.characters.find((character) => character.id === characterId)?.reference));
      const price = needsPrice && options.referenceImagePrice ? await options.referenceImagePrice().catch(() => null) : null;
      return estimateCharacters(runOptions.budget !== undefined ? { ...project, budget: runOptions.budget } : project, characterIds, status, price, runOptions.engine ?? "auto");
    },
    /** Starts sheet generation; paid attempts are reserved at their maximum and the unused part is returned at the end. */
    startCharacterRun: async (id: string, revision: number, key: string, characterIds: string[], maxCost: number, runOptions: { engine?: "auto" | "nano-banana"; budget?: number } = {}): Promise<Project> => {
      parseInput(idempotencySchema, key); parseInput(revisionSchema, revision);
      const status = await providers();
      const preview = await transaction((database) => publicProject(find(database, id)));
      const needsPrice = status.gmi && (runOptions.engine === "nano-banana" || characterIds.some((characterId) => preview.characters.find((character) => character.id === characterId)?.reference));
      const price = needsPrice && options.referenceImagePrice ? await options.referenceImagePrice().catch(() => null) : null;
      // A rejected sheet whose defects are located is repaired in place, never for more than a fresh attempt would cost.
      const repairPrice = needsPrice && options.repairPrice ? await options.repairPrice().catch(() => null) : null;
      return transaction((database) => {
        const project = find(database, id);
        const fingerprint = JSON.stringify({ mode: "characters", revision, characterIds, engine: runOptions.engine ?? "auto" });
        const receipt = database.receipts.find((item) => item.projectId === id && item.key === key);
        if (receipt) {
          if (receipt.fingerprint !== fingerprint || project.run?.id !== receipt.runId) throw new AppError(409, "Bu işlem anahtarı daha önce başka bir istekte kullanıldı. Yeni bir anahtar oluşturun.");
          return publicProject(project);
        }
        checkRevision(project, revision); requireIdle(project);
        if (runOptions.budget !== undefined) project.budget = runOptions.budget;
        const estimate = estimateCharacters(project, characterIds, status, price, runOptions.engine ?? "auto");
        if (!estimate.withinBudget) throw new AppError(400, estimate.problems.join(" ") || "Üretilecek karakter seçin.");
        if (estimate.total > maxCost + 0.0001) throw new AppError(409, `Fiyat değişti: en yüksek tutar artık ${estimate.total.toFixed(2)} $. Tahmini yenileyip tekrar onaylayın.`);
        if (estimate.total > 0) { assertPaymentsAllowed(); assertSpendLimit(database, estimate.total); }
        if (database.receipts.length >= 1_000) database.receipts.splice(0, database.receipts.length - 999);
        const now = new Date().toISOString();
        const runId = randomUUID();
        const steps: StoredStep[] = estimate.lines.map((line) => {
          const character = project.characters.find((item) => item.id === line.characterId)!;
          character.sheet.status = "producing"; character.sheet.note = "";
          let paid: StoredStep["paid"] = null;
          if (line.engine === "nano-banana") {
            const ledgerId = randomUUID();
            project.ledger.push({ id: ledgerId, at: now, runId, sceneId: character.id, sceneTitle: character.name, provider: "GMI", kind: "image", model: REFERENCE_MODEL, modelLabel: "Nano Banana 2.1", estimate: line.maxCost, actual: null, status: "reserved", requestId: null, note: `En fazla ${line.maxAttempts} deneme için bütçeden ayrıldı.` });
            paid = { ledgerId, model: REFERENCE_MODEL, requestId: null, submittedAt: null, unitCost: line.unitCost, repairCost: repairPrice !== null && repairPrice <= line.unitCost ? money(repairPrice) : 0, job: "generate" };
          }
          return { id: randomUUID(), kind: "character", sceneId: null, characterId: character.id, status: "pending", attempts: 0, leaseUntil: null, owner: null, note: "", paid, repair: null };
        });
        const paidCount = estimate.lines.filter((line) => line.engine === "nano-banana").length;
        const message = `Karakter sayfaları üretiliyor: ${estimate.lines.length} karakter, karakter başına en fazla ${SHEET_ATTEMPTS} deneme. Her denemeyi hakem (Nemotron VL) puanlıyor; son onay senin.${paidCount ? ` ${paidCount} karakter referans fotoğrafla Nano Banana 2.1 üzerinden üretilecek; en fazla ${estimate.total.toFixed(2)} $ bütçeden ayrıldı.${repairPrice !== null ? " Hakem bir hatanın yerini gösterirse sayfa baştan üretilmez, yalnızca o bölge onarılır." : ""}` : " Ücretli istek yok."}`;
        project.run = { id: runId, mode: "characters", regenerateImages: false, keepFlagged: true, status: "running", startedAt: now, completedAt: null, progress: 0, cost: estimate.total, steps, events: [makeEvent(message, "info", now)] };
        project.status = "producing"; touch(project, now);
        database.receipts.push({ projectId: id, key, fingerprint, runId }); return publicProject(project);
      });
    },
    /** Stores one judged attempt and clears the paid step's submission marker so the next attempt may be sent. */
    recordSheetAttempt: (projectId: string, runId: string, stepId: string, attempt: Omit<SheetAttempt, "runId">): Promise<boolean> => transaction((database) => {
      const active = activeStep(database, projectId, runId, stepId);
      const character = active?.project.characters.find((item) => item.id === active.step.characterId);
      if (!active || !character) return false;
      character.sheet.attempts.push({ ...attempt, runId });
      while (character.sheet.attempts.length > 24) {
        const index = character.sheet.attempts.findIndex((item) => item.id !== character.sheet.chosen);
        character.sheet.attempts.splice(index, 1);
      }
      if (active.step.paid) { active.step.paid.submittedAt = null; active.step.paid.requestId = null; active.step.paid.job = "generate"; }
      active.project.updatedAt = new Date().toISOString();
      return true;
    }),
    reviewCharacterSheet: (id: string, revision: number, characterId: string, action: "approve" | "reject", attemptId: string | null): Promise<Project> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      const character = project.characters.find((item) => item.id === characterId);
      if (!character) throw new AppError(404, "Karakter bulunamadı.");
      if (action === "approve") {
        const attempt = character.sheet.attempts.find((item) => item.id === (attemptId ?? character.sheet.chosen));
        if (!attempt) throw new AppError(400, "Onaylanacak bir karakter sayfası yok.");
        character.sheet.chosen = attempt.id; character.sheet.status = "approved"; character.sheet.note = "";
      } else {
        character.sheet.status = "none"; character.sheet.note = "Reddedildi; tarifi veya fotoğrafı değiştirip yeniden üretebilirsin.";
      }
      project.quote = null;
      touch(project, new Date().toISOString()); return publicProject(project);
    }),
    /** Prices one region repair against the project's remaining budget, without starting it. */
    estimateRepair: async (id: string): Promise<RepairEstimate> => {
      const project = await transaction((database) => publicProject(find(database, id)));
      const problems: string[] = [];
      let unitCost = 0;
      if (!(await providers()).gmi) problems.push("Bölgesel onarım GMI üzerinden yapılır; GMI anahtarı tanımlı değil.");
      else if (!options.repairPrice) problems.push("Onarım fiyatı okunamıyor.");
      else {
        try { unitCost = money(await options.repairPrice()); }
        catch (error) { problems.push(`GMI'dan güncel onarım fiyatı alınamadı. ${error instanceof Error ? error.message : ""}`.trim()); }
      }
      const remaining = money((project.budget ?? 0) - committedSpend(project.ledger));
      if (project.budget !== null && unitCost > remaining) problems.push(`Onarım (${unitCost.toFixed(3)} $) kalan bütçeyi (${Math.max(0, remaining).toFixed(2)} $) aşıyor.`);
      return { model: REPAIR_MODEL, modelLabel: REPAIR_LABEL, unitCost, budget: project.budget, remaining, problems };
    },
    /** Starts one paid region repair. Its price is reserved before anything is sent, and it is sent at most once. */
    startRepair: async (id: string, revision: number, key: string, input: RepairInput & { budget?: number }): Promise<Project> => {
      parseInput(idempotencySchema, key); parseInput(revisionSchema, revision);
      if (!(await providers()).gmi) throw new AppError(400, "Bölgesel onarım için GMI anahtarı gerekli.");
      if (!options.repairPrice) throw new AppError(400, "Onarım fiyatı okunamıyor.");
      let price: number;
      try { price = money(await options.repairPrice()); }
      catch (error) { throw new AppError(502, `GMI'dan güncel onarım fiyatı alınamadı; onarım başlatılmadı. ${error instanceof Error ? error.message : ""}`.trim()); }
      return transaction((database) => {
        const project = find(database, id);
        const fingerprint = JSON.stringify({ mode: "repair", revision, input });
        const receipt = database.receipts.find((item) => item.projectId === id && item.key === key);
        if (receipt) {
          if (receipt.fingerprint !== fingerprint || project.run?.id !== receipt.runId) throw new AppError(409, "Bu işlem anahtarı daha önce başka bir istekte kullanıldı. Yeni bir anahtar oluşturun.");
          return publicProject(project);
        }
        checkRevision(project, revision); requireIdle(project);
        if (price > input.maxCost + 0.0001) throw new AppError(409, `Fiyat değişti: onarım artık ${price.toFixed(3)} $. Yeniden onaylayın.`);
        if (project.budget === null && input.budget !== undefined) project.budget = input.budget;
        if (project.budget === null) throw new AppError(400, "Ücretli onarım için proje bütçesi belirleyin.");
        const remaining = money(project.budget - committedSpend(project.ledger));
        if (price > remaining) throw new AppError(400, `Onarım (${price.toFixed(3)} $) kalan bütçeyi (${Math.max(0, remaining).toFixed(2)} $) aşıyor.`);
        assertPaymentsAllowed();
        assertSpendLimit(database, price);
        const target = input.target;
        let sceneId: string | null = null;
        let characterId: string | null = null;
        let attemptId: string | null = null;
        let title: string;
        if ("sceneId" in target) {
          const scene = project.scenes.find((item) => item.id === target.sceneId);
          if (!scene || scene.kind !== "video") throw new AppError(404, "Çekim bulunamadı.");
          if (scene.imageSource !== "generated") throw new AppError(400, "Yalnızca üretilmiş bir kare onarılabilir; önce kareyi üret.");
          sceneId = scene.id; title = scene.title; scene.status = "queued";
        } else {
          const character = project.characters.find((item) => item.id === target.characterId);
          const attempt = character?.sheet.attempts.find((item) => item.id === target.attemptId);
          if (!character || !attempt) throw new AppError(404, "Onarılacak karakter sayfası bulunamadı.");
          characterId = character.id; attemptId = attempt.id; title = character.name; character.sheet.status = "producing";
        }
        if (database.receipts.length >= 1_000) database.receipts.splice(0, database.receipts.length - 999);
        const now = new Date().toISOString();
        const runId = randomUUID();
        const ledgerId = randomUUID();
        project.ledger.push({ id: ledgerId, at: now, runId, sceneId: sceneId ?? characterId!, sceneTitle: `${title} (bölgesel onarım)`, provider: "GMI", kind: "image", model: REPAIR_MODEL, modelLabel: REPAIR_LABEL, estimate: price, actual: null, status: "reserved", requestId: null, note: "Bölgesel onarım için bütçeden ayrıldı." });
        const step: StoredStep = {
          id: randomUUID(), kind: "repair", sceneId, characterId, status: "pending", attempts: 0, leaseUntil: null, owner: null, note: "",
          paid: { ledgerId, model: REPAIR_MODEL, requestId: null, submittedAt: null, unitCost: price, repairCost: price, job: "repair" },
          repair: { box: input.box, instruction: input.instruction.trim(), attemptId },
        };
        project.run = { id: runId, mode: "repair", regenerateImages: false, keepFlagged: true, target: "film", prepareCharacters: false, status: "running", startedAt: now, completedAt: null, progress: 0, cost: price, steps: [step], events: [makeEvent(`${title}: yalnızca işaretli bölge ${REPAIR_LABEL} ile yeniden çiziliyor; görselin geri kalanı birebir korunacak. ${price.toFixed(3)} $ bütçeden ayrıldı.`, "info", now)] };
        project.status = "producing"; touch(project, now);
        database.receipts.push({ projectId: id, key, fingerprint, runId }); return publicProject(project);
      });
    },
    /** Puts back the frame as it was before its last region repair. */
    revertRepair: (id: string, revision: number, sceneId: string): Promise<Project> => transaction((database) => {
      const project = find(database, id); checkRevision(project, revision); requireIdle(project);
      const scene = project.scenes.find((item) => item.id === sceneId);
      if (!scene?.repair) throw new AppError(400, "Bu karede geri alınacak bir onarım yok.");
      scene.image = scene.repair.previous; scene.review = null; scene.repair = null;
      touch(project, new Date().toISOString()); return publicProject(project);
    }),
    /** Saves the chosen motion settings and prices them with live rates. Prices are fetched outside the file lock. */
    prepareQuote: async (id: string, input: QuoteInput): Promise<Project> => {
      parseInput(revisionSchema, input.revision);
      if (input.budget !== null && (!Number.isFinite(input.budget) || input.budget < 0 || input.budget > 100_000)) throw new AppError(400, "Bütçe 0 ile 100.000 USD arasında olmalı.");
      const narration = await transaction((database) => { const project = find(database, id); checkRevision(project, input.revision); requireIdle(project); return project.narration; });
      const wantsVideo = input.selections.some((selection) => selection.motion === "ai");
      const wantsVoice = narration.engine === "gmi";
      if (!(await providers()).gmi || (wantsVideo && !options.videoPrices) || (!wantsVideo && !input.referenceFrames && !wantsVoice && !options.videoPrices)) throw new AppError(400, "GMI anahtarı tanımlı değil; ücretli video için teklif alınamaz.");
      const voicePrice = wantsVoice && options.voicePrice ? await options.voicePrice().catch(() => null) : null;
      let prices: ReadonlyMap<string, PriceRule> = new Map();
      if (options.videoPrices && (wantsVideo || !input.referenceFrames)) {
        try { prices = await options.videoPrices(); }
        catch (error) { throw new AppError(502, `GMI'dan güncel fiyatlar alınamadı; teklif verilmedi. ${error instanceof Error ? error.message : ""}`.trim()); }
      }
      // Without the frame router's live prices, Nano Banana 2.1 (the character-sheet model) is the only frame model offered.
      let framePrices: ReadonlyMap<string, number> | null = null;
      if (input.referenceFrames) {
        if (options.framePrices) framePrices = await options.framePrices().catch(() => null);
        else if (options.referenceImagePrice) { const price = await options.referenceImagePrice().catch(() => null); framePrices = price === null ? null : new Map([[REFERENCE_MODEL, price]]); }
      }
      return transaction((database) => {
        const project = find(database, id); checkRevision(project, input.revision); requireIdle(project);
        const choices = new Map(input.selections.map((selection) => [selection.sceneId, selection]));
        for (const scene of project.scenes) {
          const choice = choices.get(scene.id);
          if (!choice || scene.kind !== "video") continue;
          scene.motion = choice.motion;
          scene.videoModel = choice.motion === "ai" ? choice.videoModel : null;
        }
        project.quality = input.quality;
        project.budget = input.budget;
        if (input.frameModel !== undefined) project.frameModel = input.frameModel;
        const media = projectMediaDirectory(mediaDirectory, project.id);
        project.quote = buildQuote(project, prices, new Date(), input.referenceFrames ? { enabled: true, prices: framePrices, override: project.frameModel } : undefined, (file) => existsSync(path.join(media, file)), voicePrice);
        touch(project, new Date().toISOString());
        return publicProject(project);
      });
    },
    /** Must be persisted before a paid request is sent: a later crash then leaves an "uncertain", never a duplicate, request. */
    markSubmitting: (projectId: string, runId: string, stepId: string, job: "generate" | "repair" = "generate"): Promise<boolean> => transaction((database) => {
      const active = activeStep(database, projectId, runId, stepId);
      if (!active?.step.paid || active.step.paid.submittedAt) return false;
      // Last gate before money leaves: an emergency stop also blocks a request that was already prepared.
      if (paymentsDisabled()) return false;
      active.step.paid.submittedAt = new Date().toISOString();
      active.step.paid.job = job;
      const entry = ledgerEntry(active.project, active.step.paid.ledgerId);
      if (entry) { entry.status = "submitted"; entry.note = "GMI'a gönderiliyor."; entry.at = active.step.paid.submittedAt; }
      return true;
    }),
    recordRequest: (projectId: string, runId: string, stepId: string, requestId: string): Promise<boolean> => transaction((database) => {
      const active = activeStep(database, projectId, runId, stepId);
      if (!active?.step.paid) return false;
      active.step.paid.requestId = requestId.slice(0, 200);
      const entry = ledgerEntry(active.project, active.step.paid.ledgerId);
      if (entry) { entry.requestId = requestId.slice(0, 200); entry.note = active.step.kind === "video" ? "GMI isteği kuyrukta; video bekleniyor (genelde 5–6 dk sürer)." : active.step.paid.job === "repair" ? "GMI isteği kuyrukta; işaretli bölge yeniden çiziliyor." : "GMI isteği kuyrukta; görsel bekleniyor."; }
      return true;
    }),
    /** Long provider jobs keep their lease while the worker that owns them is alive. */
    extendLease: (projectId: string, runId: string, stepId: string, owner: string, leaseMs: number): Promise<boolean> => transaction((database) => {
      const active = activeStep(database, projectId, runId, stepId);
      if (!active || active.step.owner !== owner) return false;
      active.step.leaseUntil = new Date(Date.now() + leaseMs).toISOString();
      return true;
    }),
  };
}

export type ProjectRepository = ReturnType<typeof createProjectRepository>;
