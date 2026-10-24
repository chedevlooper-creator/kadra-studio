import type { NarrationSettings } from "./voices";

export type AspectRatio = "16:9" | "9:16" | "1:1";
export type ProjectStatus = "draft" | "planned" | "producing" | "ready";
export type SceneStatus = "draft" | "queued" | "running" | "ready" | "failed";
export type SceneKind = "video" | "title";
export type PlannerKind = "heuristic" | "nemotron" | "deepseek" | "import";
export type ImageSource = "reference" | "generated";
export type QualityTier = "economy" | "balanced" | "best";
/** "free" = FFmpeg camera move on the frame; "ai" = paid image-to-video through a configured provider. */
export type MotionMode = "free" | "ai";

/** A real photo the user picked as the basis of a character; its source and licence travel with it. */
export interface ReferencePhoto {
  source: "wikimedia" | "upload" | "openverse" | "web";
  title: string;
  pageUrl: string | null;
  file: string;
  author: string;
  license: string;
  licenseUrl: string | null;
  addedAt: string;
}

/** Fractions of the image (0–1): left, top, right, bottom. */
export type Box = [number, number, number, number];

/** One defect the reviewer located, with the change that would fix it. */
export interface ReviewIssue {
  problem: string;
  fix: string;
  box: Box | null;
}

/** The automatic judge's scores (1–5) for one character sheet attempt. */
export interface SheetVerdict {
  ok: boolean;
  scores: { style: number; traits: number; pose: number; clean: number };
  note: string;
  issues?: ReviewIssue[];
}

export interface SheetAttempt {
  id: string;
  runId: string;
  url: string;
  at: string;
  /** "repair" redraws only a marked region of an earlier attempt. */
  engine: "flux" | "nano-banana" | "repair";
  verdict: SheetVerdict | null;
  cost: number;
}

export type SheetStatus = "none" | "producing" | "review" | "approved" | "failed";

export interface CharacterSheet {
  status: SheetStatus;
  attempts: SheetAttempt[];
  /** The attempt offered for (or given) approval. */
  chosen: string | null;
  note: string;
}

export interface Character {
  id: string;
  /** How the picture is composed: a plain reference sheet, exactly what the text says, or decided from the text. */
  framing: "auto" | "sheet" | "free";
  /** A cast member, or a location whose reference plate keeps sets consistent across shots. */
  kind: "person" | "place";
  name: string;
  appearance: string;
  /** Words that mark a shot as featuring this character (matched in title, description and prompt). */
  aliases: string[];
  /** Drawing style for the sheet; empty uses the project style. */
  style: string;
  reference: ReferencePhoto | null;
  sheet: CharacterSheet;
}

export interface ImageReview {
  ok: boolean;
  note: string;
  issues?: ReviewIssue[];
}

/** The last region repair applied to a frame; `previous` lets the user undo it. */
export interface FrameRepair {
  previous: string;
  box: Box;
  instruction: string;
  at: string;
  cost: number;
}

/** A paid AI clip kept for reuse; `key` fingerprints the frame and motion it was made from. */
export interface ClipRecord {
  sceneId: string;
  key: string;
  file: string;
  model: string;
  modelLabel: string;
  cost: number;
  createdAt: string;
}

export interface Scene {
  id: string;
  order: number;
  title: string;
  description: string;
  prompt: string;
  /** English rendering of `prompt` made for the paid models; only valid while `promptEnSource` equals `prompt`. */
  promptEn: string;
  promptEnSource: string;
  motionPrompt: string;
  duration: number;
  camera: string;
  model: string;
  modelReason: string;
  kind: SceneKind;
  status: SceneStatus;
  image: string;
  imageSource: ImageSource;
  review: ImageReview | null;
  /** Fingerprint of what the current generated frame was made from; "" for frames made before fingerprints. */
  frameKey: string;
  /** The paid frame model that drew the current frame; "" for free FLUX frames. */
  frameModel: string;
  /** How each linked character feels in this shot: character id → emotion id (see EMOTIONS). */
  emotions: Record<string, string>;
  repair: FrameRepair | null;
  characterIds: string[];
  narration: string;
  notes: string[];
  motion: MotionMode;
  /** A model the user pinned for this shot; null lets the router pick the cheapest eligible one. */
  videoModel: string | null;
  /** Storyboard shot code such as "0A"; empty for planned shots. */
  code: string;
  /** Storyboard scene the shot belongs to, e.g. "SAHNE 0 · AÇILIŞ". */
  group: string;
  audioNotes: string;
  /** On-screen text or voice-over notes from the storyboard. */
  screenText: string;
}

export interface RunEvent {
  id: string;
  at: string;
  message: string;
  kind: "info" | "success" | "warning";
}

export type RunStepKind = "image" | "clip" | "video" | "title" | "montage" | "character" | "repair" | "voice";
export type RunStepStatus = "pending" | "running" | "done" | "failed" | "skipped";

/** What a repair step redraws: a region of a scene frame, or of a character sheet attempt. */
export interface RepairTask {
  box: Box;
  instruction: string;
  attemptId: string | null;
}

export interface RunStep {
  id: string;
  kind: RunStepKind;
  sceneId: string | null;
  characterId: string | null;
  status: RunStepStatus;
  attempts: number;
  leaseUntil: string | null;
  note: string;
  paid: PaidStep | null;
  repair: RepairTask | null;
}

/** Bookkeeping for a billable step: once submittedAt is set, the step is never sent again automatically. */
export interface PaidStep {
  ledgerId: string;
  model: string;
  requestId: string | null;
  submittedAt: string | null;
  /** Price of one submission, for steps that may submit more than once (character sheet attempts). */
  unitCost: number;
  /** Price of one region repair; 0 when repairs are not available to this step. */
  repairCost: number;
  /** Which kind of job the pending submission is, so a resumed step knows what comes back. */
  job: "generate" | "repair";
}

export interface ProductionRun {
  id: string;
  mode: "free" | "paid" | "characters" | "repair";
  /** Remake every frame, even unchanged ones. */
  regenerateImages: boolean;
  /** Keep frames the reviewer flagged instead of remaking them (the user already chose to go on with them). */
  keepFlagged: boolean;
  target?: "frames" | "film";
  prepareCharacters?: boolean;
  status: "running" | "completed" | "cancelled" | "failed";
  startedAt: string;
  completedAt: string | null;
  progress: number;
  cost: number;
  events: RunEvent[];
  steps: RunStep[];
}

export interface QuoteLine {
  sceneId: string;
  title: string;
  kind?: "video" | "image" | "voice";
  modelId: string;
  modelLabel: string;
  billedSeconds: number;
  estimate: number;
  reason: string;
  alternative: { label: string; estimate: number } | null;
  priciest: { label: string; estimate: number } | null;
}

/** A shot whose paid result already exists for the same inputs; it is reused instead of bought again. */
export interface ReusedLine {
  sceneId: string;
  title: string;
  kind: "video" | "image" | "voice";
  modelLabel: string;
  saved: number;
}

export interface Quote {
  /** Production scope authorized by this quote; old saved quotes default to film. */
  target: "frames" | "film";
  id: string;
  createdAt: string;
  expiresAt: string;
  quality: QualityTier;
  fingerprint: string;
  lines: QuoteLine[];
  reused: ReusedLine[];
  errors: string[];
  /** Things that will not stop the run but will probably hurt the result, e.g. people drawn without an approved reference. */
  warnings: string[];
  total: number;
  budget: number;
  committed: number;
  remaining: number;
  withinBudget: boolean;
}

export type LedgerStatus = "reserved" | "submitted" | "charged" | "failed" | "released";

export interface LedgerEntry {
  id: string;
  at: string;
  runId: string;
  sceneId: string;
  sceneTitle: string;
  provider: "GMI" | "Higgsfield";
  kind: "video" | "image" | "voice";
  model: string;
  modelLabel: string;
  estimate: number;
  actual: number | null;
  status: LedgerStatus;
  requestId: string | null;
  note: string;
}

/** A music file mixed under the film. */
export interface Soundtrack {
  file: string;
  name: string;
  duration: number;
  volume: number;
  offset: number;
}

export interface ProjectOutput {
  runId: string;
  url: string;
  duration: number;
  createdAt: string;
}

export interface Project {
  id: string;
  title: string;
  description: string;
  script: string;
  style: string;
  aspectRatio: AspectRatio;
  /** Story conventions (see GENRES); "" is general. */
  genre: string;
  /** Standing production notes (tone, do's and don'ts) added to every prompt of the film. */
  brief: string;
  /** Colour/era grade applied at montage (see LOOKS). */
  look: string;
  duration: number;
  budget: number | null;
  status: ProjectStatus;
  cover: string;
  createdAt: string;
  updatedAt: string;
  revision: number;
  planner: PlannerKind;
  planNote: string;
  characters: Character[];
  scenes: Scene[];
  run: ProductionRun | null;
  output: ProjectOutput | null;
  quality: QualityTier;
  quote: Quote | null;
  ledger: LedgerEntry[];
  music: Soundtrack | null;
  narration: NarrationSettings;
  clips: ClipRecord[];
  /** A frame model the user pinned for reference-guided frames; null lets the router pick the cheapest eligible one. */
  frameModel: string | null;
  isExample: boolean;
}

/** The fields of a shot the director assistant may change. */
export interface AssistantScenePatch {
  title?: string;
  description?: string;
  prompt?: string;
  motionPrompt?: string;
  camera?: string;
  duration?: number;
  narration?: string;
  emotions?: Record<string, string>;
}

export interface AssistantProjectPatch { genre?: string; look?: string; brief?: string }

export interface ProposedChange { sceneId: string; order: number; title: string; set: AssistantScenePatch; before: AssistantScenePatch }

/** What the assistant would change. Nothing is saved until the user applies it. */
export interface AssistantProposal {
  reply: string;
  changes: ProposedChange[];
  project: AssistantProjectPatch | null;
  projectBefore: AssistantProjectPatch | null;
}

export interface RepairEstimate {
  model: string;
  modelLabel: string;
  unitCost: number;
  budget: number | null;
  remaining: number;
  problems: string[];
}

export interface CreateProjectInput {
  title: string;
  script: string;
  style: string;
  aspectRatio: AspectRatio;
  budget: number | null;
  genre?: string;
  look?: string;
  brief?: string;
}

export interface ModelProfile {
  id: string;
  name: string;
  provider: "NVIDIA" | "FFmpeg" | "GMI" | "Higgsfield" | "DeepSeek" | "Yerel";
  type: "planning" | "image" | "review" | "video" | "graphics";
  description: string;
  tags: string[];
  configured: boolean;
  free: boolean;
}

export interface ProviderStatus {
  nvidia: boolean;
  gmi: boolean;
  higgsfield?: boolean;
  ffmpeg: boolean;
  deepseek?: boolean;
}

export interface VideoModelOption {
  id: string;
  label: string;
  quality: number;
}

export interface AppBootstrap {
  projects: Project[];
  models: ModelProfile[];
  videoModels: VideoModelOption[];
  providers: ProviderStatus;
  storage: "local-file";
}

export interface CharacterEstimateLine {
  characterId: string;
  name: string;
  engine: "flux" | "nano-banana";
  unitCost: number;
  maxAttempts: number;
  maxCost: number;
}

export interface CharacterEstimate {
  lines: CharacterEstimateLine[];
  total: number;
  budget: number | null;
  remaining: number;
  withinBudget: boolean;
  problems: string[];
}

export interface WikimediaResult {
  title: string;
  pageUrl: string;
  thumbUrl: string;
  width: number;
  height: number;
  license: string;
  licenseUrl: string | null;
  author: string;
  source?: "wikimedia" | "openverse" | "web";
  id?: string;
  imageUrl?: string;
}

export interface CharacterResearchView {
  summary: string;
  appearance: string;
  aliases: string[];
  commonsQueries: string[];
  sources: { title: string; url: string }[];
}
