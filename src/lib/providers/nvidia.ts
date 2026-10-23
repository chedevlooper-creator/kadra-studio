import { z } from "zod";
import { CAMERA_MOVES, genreOf } from "../cinema";
import type { AspectRatio, Box, ImageReview, ReviewIssue, SheetVerdict } from "../types";

/** Free NVIDIA API catalog (build.nvidia.com). Server-only: the key never reaches the browser. */
export const NVIDIA_MODELS = {
  planner: "nvidia/nemotron-3-ultra-550b-a55b",
  image: "black-forest-labs/flux.2-klein-4b",
  review: "nvidia/nemotron-3.5-super-vl-120b-a12b",
  reviewFallback: "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning",
} as const;

const CHAT_URL = "https://integrate.api.nvidia.com/v1/chat/completions";
const IMAGE_URL = `https://ai.api.nvidia.com/v1/genai/${NVIDIA_MODELS.image}`;

export class ProviderError extends Error {
  constructor(message: string, public retryable: boolean) { super(message); }
}

export function nvidiaConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return /^nvapi-[A-Za-z0-9_-]{20,}$/.test(env.NVIDIA_API_KEY?.trim() ?? "");
}

function apiKey(): string {
  if (!nvidiaConfigured()) throw new ProviderError("NVIDIA API anahtarı tanımlı değil (.env.local içinde NVIDIA_API_KEY).", false);
  return process.env.NVIDIA_API_KEY!.trim();
}

/** Provider error bodies are JSON blobs; keep only their human-readable message. */
function errorDetail(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string; detail?: unknown; message?: string };
    const message = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message ?? (typeof parsed.detail === "string" ? parsed.detail : "");
    if (message) return message.slice(0, 160);
  } catch { /* Not JSON. */ }
  return raw.replace(/\s+/g, " ").slice(0, 160);
}

async function post(url: string, body: unknown, timeoutMs: number, attempts = 3, retryTimeouts = true): Promise<unknown> {
  let last: ProviderError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return await response.json();
      const retryable = response.status === 429 || response.status >= 500;
      const detail = errorDetail(await response.text());
      last = new ProviderError(response.status === 401 || response.status === 403
        ? "NVIDIA anahtarı reddedildi. build.nvidia.com üzerinden anahtarı kontrol edin."
        : response.status === 429 ? "NVIDIA ücretsiz katman hız sınırına ulaşıldı."
        : response.status === 503 ? "NVIDIA ücretsiz katmanı şu anda yoğun."
        : `NVIDIA isteği başarısız oldu (HTTP ${response.status}): ${detail}`, retryable);
      if (!retryable) throw last;
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) throw error;
      const timedOut = (error as Error).name === "TimeoutError";
      last = error instanceof ProviderError ? error : new ProviderError(timedOut ? "NVIDIA yanıt vermedi (zaman aşımı)." : "NVIDIA'ya bağlanılamadı.", true);
      if (timedOut && !retryTimeouts) throw last;
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_500 * attempt));
  }
  throw last ?? new ProviderError("NVIDIA isteği tamamlanamadı.", true);
}

async function chat(model: string, messages: unknown[], maxTokens: number, timeoutMs: number, extra: Record<string, unknown> = {}, retryTimeouts = true): Promise<string> {
  const data = await post(CHAT_URL, { model, messages, max_tokens: maxTokens, temperature: 0.3, stream: false, ...extra }, timeoutMs, 2, retryTimeouts) as { choices?: { message?: { content?: string | null } }[] };
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("NVIDIA modeli boş yanıt döndürdü.", true);
  return content;
}

/** Models sometimes wrap JSON in prose or code fences; take the outermost object. */
export function extractJson(text: string): unknown {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start < 0 || end <= start) throw new ProviderError("Model yanıtında JSON bulunamadı.", true);
  try { return JSON.parse(text.slice(start, end + 1)); }
  catch { throw new ProviderError("Model yanıtındaki JSON okunamadı.", true); }
}

const text = (max: number) => z.string().trim().max(max);
export const aiPlanSchema = z.object({
  characters: z.array(z.object({ id: text(60), name: text(80).min(1), appearance: text(600) })).max(12).default([]),
  locations: z.array(z.object({ id: text(60), name: text(80).min(1), appearance: text(600) })).max(8).default([]),
  shots: z.array(z.object({
    title: text(160).min(1),
    kind: z.string().default("video").transform((value) => (value.trim().toLowerCase() === "title" ? "title" : "video") as "title" | "video"),
    duration_seconds: z.union([z.number(), z.string()]).optional().transform((value) => {
      const seconds = Number(value ?? 5);
      return Number.isFinite(seconds) ? Math.min(12, Math.max(3, Math.round(seconds))) : 5;
    }),
    camera: text(160).default(""),
    character_ids: z.array(z.string()).max(12).default([]),
    location_id: z.string().max(60).nullable().default("").transform((value) => value ?? ""),
    description: text(2_000).default(""),
    on_screen_text: text(400).default(""),
    image_prompt: text(3_000).default(""),
    motion_prompt: text(1_000).default(""),
    narration: text(1_000).default(""),
  })).min(1).max(40),
});
export type AiPlan = z.infer<typeof aiPlanSchema>;

export function parseAiPlan(content: string): AiPlan {
  const parsed = aiPlanSchema.safeParse(extractJson(content));
  if (!parsed.success) throw new ProviderError("Yapay zekâ planı beklenen yapıda değil.", true);
  return parsed.data;
}

export interface PlanRequest { script: string; style: string; aspectRatio: AspectRatio; genre?: string }

/** The planning brief every planner model gets, so their plans have the same shape and rules. */
export function planInstructions({ script, style, aspectRatio, genre = "" }: PlanRequest): string {
  const chosen = genreOf(genre);
  return `Sen bir film yönetmeni ve storyboard sanatçısısın. Aşağıdaki Türkçe senaryoyu kısa bir video için çekim planına dönüştür.
Kurallar:
- Senaryodaki hiçbir olayı atlama, olayların sırasını koru, yeni olay ekleme.
- Her çekim tek bir görüntüdür: 3-8 saniye, tek kamera hareketi.
- kind "title" yalnızca senaryo açıkça yazı kartı ya da ekranda yazı istediğinde kullanılır; tam metni on_screen_text alanına aynen yaz. Senaryoda yazı istenmiyorsa başlık veya kapanış kartı EKLEME; tüm çekimler kind "video" olsun.
- Karakterlerin görünüşünü bir kez tanımla; her image_prompt içinde o karakterin görünüşünü aynı kelimelerle tekrar et (tutarlılık için).
- Olayların geçtiği mekânları da bir kez tanımla (locations: ad ve görünüş; mimari, ışık, renk, belirgin nesneler). Her video çekiminde location_id ver ve image_prompt içinde mekânın görünüşünü aynı kelimelerle tekrar et. Mekân belli değilse location_id boş kalsın.
- image_prompt ve motion_prompt İngilizce olsun; görsel stil: "${style}", kadraj oranı ${aspectRatio}.${chosen.id ? `
- Tür: ${chosen.label}. ${chosen.direction}` : ""}
- title, camera, description ve narration Türkçe olsun. camera alanında şu ifadelerden birini kullan: ${CAMERA_MOVES.map((move) => `"${move.label}"`).join(", ")}.
Yalnızca şu yapıda geçerli JSON döndür, başka metin yazma:
{"characters":[{"id":"c1","name":"","appearance":""}],"locations":[{"id":"m1","name":"","appearance":""}],"shots":[{"title":"","kind":"video","duration_seconds":5,"camera":"","character_ids":["c1"],"location_id":"m1","description":"","on_screen_text":"","image_prompt":"","motion_prompt":"","narration":""}]}

SENARYO:
${script}`;
}

export async function planWithNemotron(request: PlanRequest): Promise<AiPlan> {
  // A planning timeout is not retried: the caller falls back to the rule-based planner instead of keeping the editor waiting.
  return parseAiPlan(await chat(NVIDIA_MODELS.planner, [{ role: "user", content: planInstructions(request) }], 8_000, 120_000, {}, false));
}

/** FLUX.2 Klein accepts 512–1568 px in steps of 16. */
export function imageSizeFor(aspectRatio: AspectRatio): { width: number; height: number } {
  return aspectRatio === "16:9" ? { width: 1360, height: 768 } : aspectRatio === "9:16" ? { width: 768, height: 1360 } : { width: 1024, height: 1024 };
}

export async function generateFluxImage({ prompt, aspectRatio, seed }: { prompt: string; aspectRatio: AspectRatio; seed: number }): Promise<Buffer> {
  const data = await post(IMAGE_URL, { prompt: prompt.slice(0, 800), ...imageSizeFor(aspectRatio), steps: 4, seed }, 120_000) as { artifacts?: { base64?: string; finishReason?: string }[] };
  const artifact = data.artifacts?.[0];
  if (artifact?.finishReason && artifact.finishReason !== "SUCCESS") {
    throw new ProviderError(artifact.finishReason === "CONTENT_FILTERED" ? "Görsel, sağlayıcının içerik filtresine takıldı. Çekim açıklamasını değiştirin." : `Görsel üretilemedi (${artifact.finishReason}).`, artifact.finishReason !== "CONTENT_FILTERED");
  }
  if (!artifact?.base64) throw new ProviderError("NVIDIA görsel döndürmedi.", true);
  const image = Buffer.from(artifact.base64, "base64");
  if (image.byteLength < 1_000) throw new ProviderError("NVIDIA'dan gelen görsel geçersiz.", true);
  return image;
}

/** Reviewers locate each defect so it can be redrawn on its own instead of remaking the whole image. */
const ISSUE_RULES = `Her bariz sorunun yerini "kutu" olarak ver: [sol, üst, sağ, alt], görselin genişliğine ve yüksekliğine göre 0-1000 arası tam sayılar. Kutu sorunu tamamen içersin ama gereğinden büyük olmasın. Sorun bütün görsele yayılıyorsa (yanlış stil, yanlış sahne, fotoğraf gibi görünme) kutu null olsun. "duzeltme" yalnızca o bölgede yapılacak değişikliği anlatan kısa bir İngilizce talimat olsun. Kareyi geçirsen bile fark ettiğin küçük ama yeri belli sorunları (ör. anlamsız yazı) listele. Sorun yoksa "sorunlar" boş liste olsun.`;
const ISSUE_SHAPE = `"sorunlar": [{"sorun": "kısa Türkçe", "duzeltme": "short English instruction", "kutu": [sol, ust, sag, alt]}]`;

/** The question every frame reviewer is asked, so the free and the bridge reviewers answer in the same shape. */
export function reviewQuestion(expectation: string, extra = ""): string {
  return `Bu görsel bir film çekiminin başlangıç karesi olacak. Beklenen içerik: "${expectation.slice(0, 1_200)}".${extra}
Görsel beklenen içerikle genel olarak uyumlu mu, ve bariz bir bozukluk (eriyen yüz, fazla parmak, anlamsız yazı) var mı? Küçük farkları sorun sayma.
${ISSUE_RULES}
Yalnızca JSON döndür: {"uygun": true veya false, "not": "kısa Türkçe açıklama", ${ISSUE_SHAPE}}`;
}

/** Accepts boxes as 0–1000 integers (as asked) or as 0–1 fractions; anything unusable becomes "not located". */
function parseBox(value: unknown): Box | null {
  if (!Array.isArray(value) || value.length !== 4 || !value.every((item) => typeof item === "number" && Number.isFinite(item))) return null;
  const numbers = value as number[];
  const scale = numbers.every((item) => item <= 1) ? 1 : 1000;
  const [x0, y0, x1, y1] = numbers.map((item) => Math.min(1, Math.max(0, item / scale)));
  return x1 - x0 >= 0.01 && y1 - y0 >= 0.01 ? [x0, y0, x1, y1] : null;
}

export function parseIssues(value: unknown): ReviewIssue[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 6).flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const raw = item as Record<string, unknown>;
    const problem = typeof raw.sorun === "string" ? raw.sorun.trim().slice(0, 300) : "";
    const fix = typeof raw.duzeltme === "string" ? raw.duzeltme.trim().slice(0, 600) : "";
    return problem || fix ? [{ problem, fix, box: parseBox(raw.kutu) }] : [];
  });
}

export function parseReview(content: string): ImageReview {
  try {
    const value = extractJson(content) as { uygun?: unknown; not?: unknown; sorunlar?: unknown };
    // A passing frame keeps the minor issues the reviewer noted: they are offered as starting points for a repair, never acted on alone.
    return { ok: value.uygun !== false, note: typeof value.not === "string" ? value.not.slice(0, 300) : "", issues: parseIssues(value.sorunlar) };
  } catch { return { ok: true, note: "Kontrol yanıtı okunamadı; görsel kabul edildi.", issues: [] }; }
}

/** Free vision endpoints are often saturated, so a second model is tried before giving up. */
export async function reviewImage({ image, expectation }: { image: Buffer; expectation: string }): Promise<ImageReview> {
  const messages = [{ role: "user", content: [
    { type: "text", text: reviewQuestion(expectation) },
    { type: "image_url", image_url: { url: `data:image/jpeg;base64,${image.toString("base64")}` } },
  ] }];
  try { return parseReview(await chat(NVIDIA_MODELS.review, messages, 1_500, 60_000)); }
  catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
    return parseReview(await chat(NVIDIA_MODELS.reviewFallback, messages, 2_000, 60_000, { reasoning_budget: 768 }));
  }
}

export function parseSheetVerdict(content: string): SheetVerdict {
  const value = extractJson(content) as Record<string, unknown>;
  const score = (key: string) => Math.min(5, Math.max(1, Math.round(Number(value[key]) || 1)));
  const scores = { style: score("stil"), traits: score("ozellikler"), pose: score("poz"), clean: score("temizlik") };
  const values = Object.values(scores);
  const average = values.reduce((sum, item) => sum + item, 0) / values.length;
  return { ok: Math.min(...values) >= 3 && average >= 3.5, scores, note: typeof value.not === "string" ? value.not.slice(0, 300) : "", issues: parseIssues(value.sorunlar) };
}

/** The judging criteria every sheet judge is given; a location plate is judged on its set, not on a pose. */
export function sheetCriteria({ name, appearance, style, withReference, kind = "person" }: { name: string; appearance: string; style: string; withReference: boolean; kind?: "person" | "place" }): string {
  const place = kind === "place";
  return `Bir film için ${place ? "mekân referans görseli" : "karakter referans sayfası"} değerlendiriyorsun. ${place ? "Mekân" : "Karakter"}: "${name}". Tarif: "${appearance.slice(0, 600)}". İstenen çizim stili: "${style.slice(0, 300)}".
${withReference ? `İlk görsel üretilen ${place ? "mekân görseli" : "karakter sayfası"}, ikinci görsel referans fotoğraf.` : `Görsel üretilen ${place ? "mekân görseli" : "karakter sayfası"}.`}
Her ölçütü 1-5 puanla (5 en iyi):
- stil: Görsel istenen çizim/animasyon stilinde mi? Fotoğraf gibi görünüyorsa düşük puan ver.
${place
    ? `- ozellikler: Tarifteki mekân özellikleri (mimari, ışık, renk, belirgin nesneler)${withReference ? " ve referans fotoğraftaki yerin belirgin hatları" : ""} var mı?
- poz: Geniş, insansız ve düzeni okunur bir kadraj mı?
- temizlik: Bozuk perspektif, eriyen şekil, anlamsız yazı ya da filigran yok mu?`
    : `- ozellikler: Tarifteki ayırt edici özellikler${withReference ? " ve referans fotoğraftaki kişinin belirgin hatları (yüz şekli, saç, sakal/bıyık, başlık)" : ""} karakterde var mı?
- poz: Tek karakter, önden ya da hafif açılı, düz ve sade arka plan mı?
- temizlik: Bozuk yüz, fazla parmak, eriyen şekil, anlamsız yazı ya da filigran yok mu?`}
${ISSUE_RULES}
Yalnızca JSON döndür: {"stil": n, "ozellikler": n, "poz": n, "temizlik": n, "not": "kısa Türkçe açıklama", ${ISSUE_SHAPE}}`;
}

/**
 * Judges a character sheet against what was asked: drawn style, the described traits, a clean front-facing pose.
 * With a reference photo it also checks that the person's distinctive features carried over into the drawing.
 */
export async function judgeCharacterSheet({ image, reference, name, appearance, style, kind }: { image: Buffer; reference: Buffer | null; name: string; appearance: string; style: string; kind?: "person" | "place" }): Promise<SheetVerdict> {
  const criteria = sheetCriteria({ name, appearance, style, withReference: Boolean(reference), kind });
  const images = [image, ...(reference ? [reference] : [])].map((bytes) => ({ type: "image_url", image_url: { url: `data:image/${bytes[0] === 0x89 ? "png" : "jpeg"};base64,${bytes.toString("base64")}` } }));
  const ask = (model: string, content: unknown[], extra: Record<string, unknown> = {}) => chat(model, [{ role: "user", content: [{ type: "text", text: criteria }, ...content] }], 1_500, 90_000, extra);
  try { return parseSheetVerdict(await ask(NVIDIA_MODELS.review, images)); }
  catch (error) {
    if (error instanceof ProviderError && !error.retryable && reference) return parseSheetVerdict(await ask(NVIDIA_MODELS.review, images.slice(0, 1)));
    return parseSheetVerdict(await ask(NVIDIA_MODELS.reviewFallback, images.slice(0, 1), { reasoning_budget: 768 }));
  }
}
