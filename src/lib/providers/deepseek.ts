import type { ImageReview, SheetVerdict } from "../types";
import { extractJson, parseAiPlan, parseReview, parseSheetVerdict, planInstructions, ProviderError, reviewQuestion, sheetCriteria, type AiPlan, type PlanRequest } from "./nvidia";

/**
 * DeepSeek API bridge (https://api-docs.deepseek.com).
 * Acts as the cross-model orchestrator: web search (/v1/tools/search), page fetch (/v1/tools/fetch),
 * script planning, multimodal vision judging (deepseek-flash), and prompt/reference preparation for image & video engines.
 */
const BASE = "https://api.deepseek.com";

export const DEEPSEEK_MODELS = {
  flash: "deepseek-flash",
  pro: "deepseek-v4-pro",
} as const;

export function deepseekConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return (env.DEEPSEEK_API_KEY?.trim().length ?? 0) > 15;
}

function apiKey(): string {
  const key = process.env.DEEPSEEK_API_KEY?.trim();
  if (!key || !deepseekConfigured()) throw new ProviderError("DeepSeek API anahtarı tanımlı değil (.env.local içinde DEEPSEEK_API_KEY).", false);
  return key;
}

function errorMessage(raw: string): string {
  try {
    const parsed = JSON.parse(raw) as { error?: { message?: string } | string; message?: string };
    const text = typeof parsed.error === "string" ? parsed.error : parsed.error?.message ?? parsed.message ?? "";
    if (text) return text.slice(0, 180);
  } catch { /* Plain text body. */ }
  return raw.replace(/\s+/g, " ").slice(0, 180);
}

async function request<T>(path: string, body: unknown, timeoutMs = 45_000, attempts = 2): Promise<T> {
  let last: ProviderError | null = null;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      const response = await fetch(`${BASE}${path}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey()}`, "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(timeoutMs),
      });
      if (response.ok) return await response.json() as T;
      const retryable = response.status === 408 || response.status === 429 || response.status >= 500;
      const detail = errorMessage(await response.text());
      last = new ProviderError(
        response.status === 401 ? "DeepSeek API anahtarı reddedildi. platform.deepseek.com üzerinden kontrol edin."
        : response.status === 402 ? "DeepSeek hesabında bakiye yetersiz."
        : response.status === 429 ? "DeepSeek hız sınırına ulaşıldı."
        : `DeepSeek isteği başarısız oldu (HTTP ${response.status}): ${detail}`,
        retryable,
      );
      if (!retryable) throw last;
    } catch (error) {
      if (error instanceof ProviderError && !error.retryable) throw error;
      const timedOut = (error as Error).name === "TimeoutError";
      last = error instanceof ProviderError ? error : new ProviderError(timedOut ? "DeepSeek yanıt vermedi (zaman aşımı)." : "DeepSeek API'sine bağlanılamadı.", true);
    }
    if (attempt < attempts) await new Promise((resolve) => setTimeout(resolve, 1_200 * attempt));
  }
  throw last ?? new ProviderError("DeepSeek isteği tamamlanamadı.", true);
}

async function chat(model: string, messages: unknown[], maxTokens = 2_000, timeoutMs = 60_000): Promise<string> {
  const data = await request<{ choices?: { message?: { content?: string | null } }[] }>(
    "/chat/completions",
    { model, messages, max_tokens: maxTokens, temperature: 0.2, thinking: { type: "disabled" }, stream: false },
    timeoutMs,
  );
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new ProviderError("DeepSeek modeli boş yanıt döndürdü.", true);
  return content;
}

export interface DeepSeekSearchResult {
  title: string;
  url: string;
  snippet: string;
  summary: string;
  content: string;
  site_name: string | null;
  date: string | null;
  rerank_score: number;
  authority: number;
}

/** Native DeepSeek Web Search API (POST /v1/tools/search). */
export async function searchWebWithDeepSeek(query: string, options: { count?: number; oriQuestion?: string; needContent?: boolean } = {}): Promise<DeepSeekSearchResult[]> {
  const trimmed = query.trim().slice(0, 128);
  if (!trimmed) return [];
  const data = await request<{ results?: DeepSeekSearchResult[] }>("/v1/tools/search", {
    query: trimmed,
    count: Math.min(50, Math.max(1, options.count ?? 8)),
    ...(options.oriQuestion ? { ori_question: options.oriQuestion.trim().slice(0, 128) } : {}),
    need_content: Boolean(options.needContent),
  }, 25_000);
  return Array.isArray(data.results) ? data.results : [];
}

/** Native DeepSeek Web Fetch API (POST /v1/tools/fetch). */
export async function fetchPageWithDeepSeek(url: string): Promise<{ title: string; content: string }> {
  const data = await request<{ title?: string; content?: string }>("/v1/tools/fetch", { url: url.trim().slice(0, 8_192) }, 25_000);
  return { title: data.title ?? "", content: data.content ?? "" };
}

export interface CharacterWebResearch {
  summary: string;
  appearance: string;
  aliases: string[];
  commonsQueries: string[];
  sources: { title: string; url: string }[];
}

export function parseCharacterResearch(content: string, fallbackQuery: string, sources: { title: string; url: string }[] = []): CharacterWebResearch {
  const cleanList = (input: unknown, max: number) => Array.isArray(input)
    ? [...new Set(input.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean))].slice(0, max)
    : [];
  try {
    const raw = extractJson(content) as {
      ozet?: unknown; summary?: unknown;
      gorunus?: unknown; appearance?: unknown;
      adlar?: unknown; aliases?: unknown;
      commons?: unknown; commonsQueries?: unknown;
    };
    const commonsQueries = cleanList(raw.commons ?? raw.commonsQueries, 6);
    if (!commonsQueries.includes(fallbackQuery)) commonsQueries.push(fallbackQuery);
    const summaryText = typeof raw.ozet === "string" ? raw.ozet : typeof raw.summary === "string" ? raw.summary : "";
    const appearanceText = typeof raw.gorunus === "string" ? raw.gorunus : typeof raw.appearance === "string" ? raw.appearance : "";
    return {
      summary: summaryText.trim().slice(0, 500),
      appearance: appearanceText.trim().slice(0, 1_000),
      aliases: cleanList(raw.adlar ?? raw.aliases, 10),
      commonsQueries: commonsQueries.slice(0, 6),
      sources: sources.slice(0, 6),
    };
  } catch {
    return { summary: "", appearance: "", aliases: [], commonsQueries: [fallbackQuery], sources: sources.slice(0, 4) };
  }
}

/**
 * Uses DeepSeek Web Search + deepseek-flash to research a character/person on the web,
 * produce international Wikimedia Commons search terms, and extract visual traits for the image models.
 */
export async function researchCharacterWithDeepSeek(input: { name: string; query: string; appearance?: string }): Promise<CharacterWebResearch> {
  const term = (input.query || input.name).trim();
  const hits = await searchWebWithDeepSeek(term, { count: 10, oriQuestion: `${term} kimdir fiziksel görünüşü fotoğrafı` }).catch(() => []);
  const context = hits.map((hit, index) => `[${index + 1}] ${hit.title} (${hit.url})\n${hit.summary || hit.snippet}`).join("\n\n").slice(0, 8_000);
  const prompt = `Bir film stüdyosu için "${input.name}" (arama: "${term}") karakterini araştırıyorsun.
${input.appearance ? `Mevcut görünüş notu: "${input.appearance}".` : ""}
${context ? `WEB ARAMA SONUÇLARI:\n${context}` : "Web araması sonuç döndürmedi; genel bilginle yanıtla."}

Görev:
1. Bu kişi veya karakter hakkında 1-2 cümlelik Türkçe özet yaz (ozet).
2. Görsel üretim modeline verilecek ayırt edici dış görünüş tarifini yaz: yüz hatları, saç/bıyık/sakal, gözlük/başlık/kasket, tipik kıyafet ve yaş. Hem Türkçe hem parantez içinde İngilizce anahtar kelimeler olsun (gorunus).
3. Senaryoda veya uluslararası kaynaklarda geçen adlarını listele (adlar).
4. Wikimedia Commons ve Openverse'te bu kişinin fotoğrafını bulmak için en etkili 4-6 arama terimini sırala: tam ad, İngilizce yazılış, varsa Kiril/orijinal yazılış, Türkçe yazılış ve "portrait" ekli varyantları kapsa (commons).

Yalnızca geçerli JSON döndür:
{"ozet":"","gorunus":"","adlar":[""],"commons":[""]}`;
  const sources = hits.filter((hit) => /^https?:\/\//.test(hit.url)).map((hit) => ({ title: hit.title || hit.url, url: hit.url }));
  try {
    return parseCharacterResearch(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content: prompt }], 1_200, 35_000), term, sources);
  } catch {
    return { summary: hits[0]?.snippet ?? "", appearance: "", aliases: [], commonsQueries: [term], sources: sources.slice(0, 4) };
  }
}

/** Plans a Turkish script into characters and shots using deepseek-flash (with deepseek-v4-pro fallback). */
export async function planWithDeepSeek(request: PlanRequest): Promise<AiPlan> {
  const prompt = planInstructions(request);
  try {
    return parseAiPlan(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content: prompt }], 8_000, 90_000));
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
    return parseAiPlan(await chat(DEEPSEEK_MODELS.pro, [{ role: "user", content: prompt }], 8_000, 120_000));
  }
}

function imageBlock(bytes: Buffer, detail: "low" | "high" | "auto" = "auto") {
  const mime = bytes[0] === 0x89 ? "png" : "jpeg";
  return { type: "image_url" as const, image_url: { url: `data:image/${mime};base64,${bytes.toString("base64")}`, detail } };
}

/** Reviews a generated scene frame with deepseek-flash Vision, optionally comparing against approved character sheets. */
export async function reviewImageWithDeepSeek({ image, expectation, characterSheets = [] }: { image: Buffer; expectation: string; characterSheets?: { name: string; image: Buffer }[] }): Promise<ImageReview> {
  const sheetNote = characterSheets.length
    ? ` Ayrıca ekteki ${characterSheets.length} karakter referans sayfasıyla (${characterSheets.map((item) => item.name).join(", ")}) sahnedeki karakterlerin yüz, saç/bıyık, başlık ve kıyafet tutarlılığını kontrol et.`
    : "";
  const content = [
    { type: "text", text: reviewQuestion(expectation, ` İlk görsel üretilen sahne karesidir.${sheetNote}`) },
    imageBlock(image),
    ...characterSheets.slice(0, 4).map((sheet) => imageBlock(sheet.image, "low")),
  ];
  return parseReview(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content }], 1_000, 45_000));
}

/** Judges a character sheet with deepseek-flash Vision against the requested style, traits, and optional reference photo. */
export async function judgeSheetWithDeepSeek({ image, reference, name, appearance, style, kind }: { image: Buffer; reference: Buffer | null; name: string; appearance: string; style: string; kind?: "person" | "place" }): Promise<SheetVerdict> {
  const criteria = sheetCriteria({ name, appearance, style, withReference: Boolean(reference), kind });
  const content = [{ type: "text", text: criteria }, imageBlock(image), ...(reference ? [imageBlock(reference, "low")] : [])];
  return parseSheetVerdict(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content }], 1_000, 60_000));
}
