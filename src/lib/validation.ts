import { z } from "zod";
import { GENRES, LOOKS } from "./cinema";

export class AppError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export const idSchema = z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/, "Geçersiz kayıt kimliği.");
export const revisionSchema = z.number().int().min(1).max(Number.MAX_SAFE_INTEGER);
export const createProjectSchema = z.object({
  title: z.string().trim().min(1, "Proje adı gerekli.").max(120, "Proje adı en fazla 120 karakter olabilir."),
  script: z.string().max(30_000, "Senaryo en fazla 30.000 karakter olabilir."),
  style: z.string().trim().min(1, "Bir görsel tarz seçin.").max(100),
  aspectRatio: z.enum(["16:9", "9:16", "1:1"]),
  budget: z.number().finite().min(0, "Bütçe negatif olamaz.").max(100_000).nullable(),
  genre: z.enum(GENRES.map((genre) => genre.id) as [string, ...string[]]).optional(),
  look: z.enum(LOOKS.map((look) => look.id) as [string, ...string[]]).optional(),
}).strict();

export const narrationSchema = z.object({
  engine: z.enum(["off", "local", "gmi"]),
  voice: z.string().trim().max(80),
  speed: z.number().finite().min(0.5).max(1.5),
  volume: z.number().finite().min(0).max(2),
}).strict();

export const updateProjectSchema = createProjectSchema.partial().extend({
  revision: revisionSchema,
  narration: narrationSchema.optional(),
  sceneOrder: z.array(idSchema).min(1).max(40).optional(),
}).strict().refine((value) => Object.keys(value).length > 1, "Kaydedilecek bir değişiklik yok.");

export const scenePatchSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  description: z.string().trim().min(1).max(30_000).optional(),
  prompt: z.string().trim().min(1).max(30_000).optional(),
  motionPrompt: z.string().trim().max(4_000).optional(),
  duration: z.number().finite().int().min(2).max(30).optional(),
  camera: z.string().trim().min(1).max(160).optional(),
  model: z.string().trim().min(1).max(100).optional(),
  kind: z.enum(["video", "title"]).optional(),
  narration: z.string().max(4_000).optional(),
  audioNotes: z.string().max(4_000).optional(),
  screenText: z.string().max(4_000).optional(),
  characterIds: z.array(z.string().max(20)).max(12).optional(),
}).strict().refine((value) => Object.keys(value).length > 0, "Kaydedilecek bir değişiklik yok.");

export const updateSceneSchema = z.object({ revision: revisionSchema, scene: scenePatchSchema }).strict();
export const revisionBodySchema = z.object({ revision: revisionSchema }).strict();
export const planSchema = z.object({ revision: revisionSchema, planner: z.enum(["auto", "heuristic"]).default("auto") }).strict();
export const runSchema = z.object({ mode: z.enum(["free", "paid"]), revision: revisionSchema, quoteId: idSchema.optional(), target: z.enum(["frames", "film"]).optional(), reuseImages: z.boolean().optional(), prepareCharacters: z.boolean().optional(), regenerate: z.boolean().optional() }).strict()
  .refine((value) => (value.mode === "paid") === Boolean(value.quoteId), "Ücretli üretim için onaylanmış bir fiyat teklifi gerekir.");
export const quoteSchema = z.object({
  revision: revisionSchema,
  quality: z.enum(["economy", "balanced", "best"]),
  budget: z.number().finite().min(0, "Bütçe negatif olamaz.").max(100_000).nullable(),
  referenceFrames: z.boolean().optional(),
  frameModel: z.string().trim().min(1).max(80).nullable().optional(),
  selections: z.array(z.object({ sceneId: idSchema, motion: z.enum(["free", "ai"]), videoModel: z.string().trim().min(1).max(80).nullable() }).strict()).max(40),
}).strict();
export const idempotencySchema = z.string().min(8).max(128).regex(/^[A-Za-z0-9._:-]+$/);

export function parseInput<T>(schema: z.ZodType<T>, value: unknown): T {
  const result = schema.safeParse(value);
  if (!result.success) {
    const detail = result.error.issues[0]?.message || "Geçersiz istek.";
    throw new AppError(400, /^(Invalid|Too |Unrecognized|Expected|Required|Input)/.test(detail) ? "İstek alanlarını ve sınırlarını kontrol edin." : detail);
  }
  return result.data;
}

const storyboardShotSchema = z.object({
  id: z.string().trim().min(1).max(20),
  sceneId: z.string().max(80).optional(),
  sceneTitle: z.string().max(160).optional(),
  durationSec: z.number().finite().min(1).max(60),
  timeRange: z.string().max(40).optional(),
  visualSummary: z.string().trim().min(1).max(4_000),
  cameraMovement: z.string().max(500).optional(),
  aiPrompt: z.string().trim().min(1).max(4_000),
  audioCues: z.string().max(2_000).optional(),
  voiceoverOrText: z.string().max(4_000).optional(),
});
export const importStoryboardSchema = createProjectSchema.omit({ script: true }).extend({
  shots: z.array(storyboardShotSchema).min(1, "Dosyada çekim bulunamadı.").max(40, "Bu sürüm bir projede en fazla 40 çekim destekliyor."),
}).strict();
export const soundtrackSettingsSchema = z.object({
  revision: revisionSchema,
  volume: z.number().finite().min(0).max(2),
  offset: z.number().finite().min(0).max(3_600),
}).strict();

const characterFields = {
  name: z.string().trim().min(1, "Karakter adı gerekli.").max(80),
  appearance: z.string().trim().max(1_200),
  aliases: z.array(z.string().trim().min(1).max(80)).max(12),
  style: z.string().trim().max(400),
};
export const characterCreateSchema = z.object({ revision: revisionSchema, ...characterFields, kind: z.enum(["person", "place"]).default("person") }).strict();
export const characterUpdateSchema = z.object({ revision: revisionSchema, ...characterFields }).partial({ name: true, appearance: true, aliases: true, style: true }).strict();
export const characterRunSchema = z.object({ revision: revisionSchema, characterIds: z.array(z.string().max(20)).min(1, "Üretilecek karakter seçin.").max(12), maxCost: z.number().finite().min(0).max(100_000), preview: z.boolean().optional(), engine: z.enum(["auto", "nano-banana"]).optional(), budget: z.number().finite().min(0).max(100_000).optional() }).strict();
export const characterReviewSchema = z.object({ revision: revisionSchema, action: z.enum(["approve", "reject"]), attemptId: idSchema.nullable().optional() }).strict();
export const commonsSelectSchema = z.union([
  z.object({ revision: revisionSchema, source: z.literal("openverse"), openverseId: z.string().trim().min(8).max(80).regex(/^[A-Za-z0-9-]+$/) }).strict(),
  z.object({ revision: revisionSchema, source: z.literal("wikimedia").optional(), title: z.string().trim().min(6).max(300).regex(/^File:/, "Wikimedia dosya adı \"File:\" ile başlamalı.") }).strict(),
  z.object({ revision: revisionSchema, source: z.literal("web"), url: z.string().trim().min(12).max(2_048).refine((value) => /^https:\/\//i.test(value), "Görsel adresi https:// ile başlamalı.") }).strict(),
]);

const fraction = z.number().finite().min(0).max(1);
export const repairSchema = z.object({
  revision: revisionSchema,
  target: z.union([z.object({ sceneId: idSchema }).strict(), z.object({ characterId: z.string().min(1).max(20), attemptId: idSchema }).strict()]),
  box: z.tuple([fraction, fraction, fraction, fraction]).refine(([x0, y0, x1, y1]) => x1 - x0 >= 0.02 && y1 - y0 >= 0.02, "Onarılacak alan çok küçük; görselde daha büyük bir alan seç."),
  instruction: z.string().trim().min(3, "Bu alanda neyin düzeltileceğini yaz.").max(600),
  maxCost: z.number().finite().min(0).max(5),
  budget: z.number().finite().min(0).max(100_000).optional(),
}).strict();
export const repairRevertSchema = z.object({ revision: revisionSchema, sceneId: idSchema }).strict();
