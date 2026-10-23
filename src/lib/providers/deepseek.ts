import { genreOf } from "../cinema";
import type { AspectRatio, ImageReview, SheetVerdict, WikimediaResult } from "../types";
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

const IMAGE_URL = /https?:\/\/[^\s"'<>(){}]+?\.(?:jpe?g|png|webp)(?:\?[^\s"'<>(){}]*)?/gi;

/**
 * Finds absolute image URLs in search snippets and page content. Only https addresses are usable as
 * references; the user still sees and picks each candidate before anything is downloaded.
 */
export function extractImageUrls(texts: (string | null | undefined)[], limit = 12): string[] {
  const urls: string[] = [];
  const seen = new Set<string>();
  for (const text of texts) {
    if (!text) continue;
    for (const match of text.matchAll(IMAGE_URL)) {
      const raw = match[0].replace(/[.,;:]+$/, "");
      try {
        const url = new URL(raw);
        if (url.protocol !== "https:") continue;
        const value = url.toString();
        if (seen.has(value)) continue;
        seen.add(value);
        urls.push(value);
        if (urls.length >= limit) return urls;
      } catch { /* Skip malformed URLs. */ }
    }
  }
  return urls;
}

/** DeepSeek web search + page content as an unlicensed photo finder; every hit is tagged as a web image. */
export async function searchImagesWithDeepSeek(query: string, name = query): Promise<WikimediaResult[]> {
  const term = `${name} portre fotoğraf`.slice(0, 128);
  const hits = await searchWebWithDeepSeek(term, { count: 10, needContent: true, oriQuestion: `${name} portre fotoğraf görsel`.slice(0, 128) }).catch(() => []);
  const seen = new Set<string>();
  const results: WikimediaResult[] = [];
  for (const hit of hits) {
    for (const url of extractImageUrls([hit.content, hit.summary, hit.snippet])) {
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: (hit.title || name).slice(0, 200),
        pageUrl: hit.url.slice(0, 600),
        thumbUrl: url,
        width: 0,
        height: 0,
        license: "Web görseli — kullanım hakkını kontrol edin",
        licenseUrl: null,
        author: new URL(url).hostname,
        source: "web",
        imageUrl: url,
      });
      if (results.length >= 12) return results;
    }
  }
  return results;
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
export async function judgeSheetWithDeepSeek({ image, reference, name, appearance, style, kind, framing }: { image: Buffer; reference: Buffer | null; name: string; appearance: string; style: string; kind?: "person" | "place"; framing?: "sheet" | "free" }): Promise<SheetVerdict> {
  const criteria = sheetCriteria({ name, appearance, style, withReference: Boolean(reference), kind, framing });
  const content = [{ type: "text", text: criteria }, imageBlock(image), ...(reference ? [imageBlock(reference, "low")] : [])];
  return parseSheetVerdict(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content }], 1_000, 60_000));
}

export interface ShotEnhanceItem {
  id: string;
  title: string;
  description: string;
  prompt: string;
  motionPrompt?: string;
  camera?: string;
  characters?: { name: string; appearance: string; kind?: "person" | "place" }[];
}

export interface PromptEnhanceRequest {
  style: string;
  aspectRatio: AspectRatio;
  genre?: string;
  shots: ShotEnhanceItem[];
}

export interface EnhancedShot {
  id: string;
  imagePrompt: string;
  motionPrompt: string;
}

export function parseEnhancedShots(content: string, requestedIds: string[] = []): EnhancedShot[] {
  try {
    const raw = extractJson(content) as Record<string, unknown>;
    const list = Array.isArray(raw.shots)
      ? raw.shots
      : (typeof raw.image_prompt === "string" || typeof raw.imagePrompt === "string")
        ? [raw]
        : [];
    const results: EnhancedShot[] = [];
    list.forEach((item, index) => {
      if (!item || typeof item !== "object") return;
      const entry = item as Record<string, unknown>;
      const id = typeof entry.id === "string" && entry.id.trim()
        ? entry.id.trim()
        : requestedIds[index] ?? "";
      const imagePrompt = (typeof entry.image_prompt === "string" ? entry.image_prompt : typeof entry.imagePrompt === "string" ? entry.imagePrompt : "").trim().slice(0, 2_500);
      const motionPrompt = (typeof entry.motion_prompt === "string" ? entry.motion_prompt : typeof entry.motionPrompt === "string" ? entry.motionPrompt : "").trim().slice(0, 900);
      if (id && imagePrompt) results.push({ id, imagePrompt, motionPrompt });
    });
    return results;
  } catch {
    return [];
  }
}

async function enhanceShotBatch(input: PromptEnhanceRequest): Promise<EnhancedShot[]> {
  if (!input.shots.length) return [];
  const chosen = genreOf(input.genre ?? "");
  const payload = input.shots.map((shot) => ({
    id: shot.id,
    title: shot.title,
    description: shot.description,
    user_prompt: shot.prompt,
    motion_hint: shot.motionPrompt ?? "",
    camera: shot.camera ?? "",
    cast_and_locations: (shot.characters ?? []).map((item) => `${item.name} (${item.kind === "place" ? "location" : "character"}): ${item.appearance}`),
  }));
  const prompt = `Sen dünyaca ünlü bir görüntü yönetmeni (DoP) ve yapay zekâ görsel/video prompt mühendisisin.
Kullanıcı çekim açıklamalarını veya promptlarını günlük konuşma diliyle, kısa, devrik veya yazım hatalı Türkçe (ya da karışık Türkçe/İngilizce) yazmış olabilir.
Görevin: Her çekimi arka planda görsel ve video üretim modellerinin tek seferde muhteşem, sinematik bir çıktı üreteceği profesyonel İngilizce promptlara dönüştürmek.

Kurallar:
- Kullanıcının istediği sahneyi, olayı, duygusal tonu ve bağlı karakter/mekân özelliklerini birebir koru; senaryoda olmayan alakasız olay uydurma.
- image_prompt: Yalnızca İngilizce. Konuyu, karakterlerin duruş ve yüz ifadesini, mekân detaylarını, kamera açısını ve lens derinliğini (ör. 35mm anamorphic, shallow depth of field), ışık yönünü ve rengini (ör. volumetric golden hour rim light, moody chiaroscuro), atmosferi ve dokuları zengin bir sinema diliyle betimle. Görsel stil: "${input.style}", kadraj oranı: ${input.aspectRatio}.${chosen.id ? ` Tür: ${chosen.label} (${chosen.mood}).` : ""}
- motion_prompt: Yalnızca İngilizce, 1-2 cümle. Kamera hareketini ve karedeki doğal fiziksel hareketi (rüzgâr, adım, bakış, ışık değişimi) akıcı biçimde tarif et.
- Görsel içinde yazı, altyazı veya filigran isteme.

Yalnızca şu JSON yapısını döndür, başka açıklama yazma:
{"shots":[{"id":"","image_prompt":"","motion_prompt":""}]}

ÇEKİMLER:
${JSON.stringify(payload)}`;
  const ids = input.shots.map((shot) => shot.id);
  try {
    const parsed = parseEnhancedShots(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content: prompt }], 4_000, 60_000), ids);
    if (parsed.length) return parsed;
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
  }
  return parseEnhancedShots(await chat(DEEPSEEK_MODELS.pro, [{ role: "user", content: prompt }], 4_000, 90_000), ids);
}

/**
 * Upgrades user-written Turkish or rough shot descriptions/prompts in the background into cinema-grade
 * English image and motion prompts using DeepSeek (`deepseek-flash` with `deepseek-v4-pro` fallback).
 */
export async function enhanceShotsWithDeepSeek(input: PromptEnhanceRequest): Promise<EnhancedShot[]> {
  const valid = input.shots.filter((shot) => shot.prompt.trim() || shot.description.trim());
  if (!valid.length) return [];
  const results: EnhancedShot[] = [];
  for (let index = 0; index < valid.length; index += 10) {
    const chunk = valid.slice(index, index + 10);
    const enhanced = await enhanceShotBatch({ ...input, shots: chunk });
    results.push(...enhanced);
  }
  return results;
}

export interface CharacterEnhanceInput {
  name: string;
  appearance: string;
  style: string;
  kind?: "person" | "place";
  withReference?: boolean;
}

export interface EnhancedCharacterTraits {
  appearance: string;
  style: string;
}

export function parseEnhancedCharacter(content: string, fallback: EnhancedCharacterTraits): EnhancedCharacterTraits {
  try {
    const raw = extractJson(content) as Record<string, unknown>;
    const appearance = (typeof raw.appearance === "string" ? raw.appearance : typeof raw.gorunus === "string" ? raw.gorunus : "").trim().slice(0, 700);
    const style = (typeof raw.style === "string" ? raw.style : typeof raw.stil === "string" ? raw.stil : "").trim().slice(0, 200);
    return {
      appearance: appearance || fallback.appearance,
      style: style || fallback.style,
    };
  } catch {
    return fallback;
  }
}

/**
 * Translates and upgrades a Turkish or colloquial character/location description and style into
 * studio-grade English reference-sheet traits for the image generator.
 */
export async function enhanceCharacterWithDeepSeek(input: CharacterEnhanceInput): Promise<EnhancedCharacterTraits> {
  const fallback = { appearance: input.appearance.trim(), style: input.style.trim() };
  if (!fallback.appearance && !fallback.style) return fallback;
  const isPlace = input.kind === "place";
  const prompt = `Sen bir film stüdyosunun konsept sanat yönetmenisin.
Kullanıcının günlük veya kısa Türkçe ile yazdığı ${isPlace ? "mekân" : "karakter"} tarifini ve görsel stili, görsel üretim modelinin (${input.withReference ? "referans fotoğrafı da koruyarak " : ""}stüdyo kalitesinde bir ${isPlace ? "mekân referans plakası" : "karakter referans sayfası"} çizeceği) profesyonel İngilizce betimlemeye dönüştür.

Girdi:
- Ad: "${input.name}"
- Tür: ${isPlace ? "Mekân (place)" : "Karakter (person)"}
- Kullanıcı tarifi: "${fallback.appearance}"
- İstenen stil: "${fallback.style}"

Kurallar:
- Kullanıcının belirttiği hiçbir fiziksel özelliği (yaş, bıyık/sakal, kasket/başlık, kıyafet, renk, mimari detay) atlama; çelişen özellik ekleme.
- appearance: Yalnızca İngilizce, 1-3 yoğun cümle. ${isPlace ? "Mimari yapıyı, malzemeleri, ışık-gölge atmosferini, renk paletini ve belirgin çevre unsurlarını" : "Yüz hatlarını, yaşını, saç/sakal/bıyık yapısını, başlık/aksesuarlarını, kıyafet kesimini, kumaş dokusunu ve renklerini"} net ve görsel olarak betimle.
- style: Yalnızca İngilizce, kısa ve net sanatsal stil tanımı (ör. "Cinematic realistic concept art, finely textured brushwork" veya "Stylized 3D feature animation, rich subsurface scattering").

Yalnızca geçerli JSON döndür:
{"appearance":"","style":""}`;
  try {
    return parseEnhancedCharacter(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content: prompt }], 800, 30_000), fallback);
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
    try {
      return parseEnhancedCharacter(await chat(DEEPSEEK_MODELS.pro, [{ role: "user", content: prompt }], 800, 45_000), fallback);
    } catch {
      return fallback;
    }
  }
}

export function parseEnhancedRepair(content: string, fallback: string): string {
  try {
    const raw = extractJson(content) as Record<string, unknown>;
    const text = (typeof raw.instruction === "string" ? raw.instruction : typeof raw.prompt === "string" ? raw.prompt : typeof raw.duzeltme === "string" ? raw.duzeltme : "").trim().slice(0, 550);
    return text || fallback.trim().slice(0, 550);
  } catch {
    return fallback.trim().slice(0, 550);
  }
}

/**
 * Converts a user's colloquial Turkish region-repair instruction into a precise English masked-inpainting command.
 */
export async function enhanceRepairWithDeepSeek(input: { instruction: string; context?: string; style?: string }): Promise<string> {
  const raw = input.instruction.trim();
  if (!raw) return "";
  const prompt = `Sen bir görsel onarım (inpainting) uzmanısın.
Kullanıcı bir sahne veya karakter karesindeki işaretli (maskeli) bölgeyi düzeltmek için Türkçe veya günlük dille şu talimatı verdi:
"${raw}"
${input.context ? `Görsel bağlamı: "${input.context.slice(0, 400)}"` : ""}
${input.style ? `Görsel stili: "${input.style.slice(0, 160)}"` : ""}

Görevin: Maskeli bölgede tam olarak ne çizilmesi veya düzeltilmesi gerektiğini anlatan, görsel düzenleme modeline verilecek net, kısa ve profesyonel bir İngilizce talimat (instruction) yazmak.
Yalnızca geçerli JSON döndür:
{"instruction":""}`;
  try {
    return parseEnhancedRepair(await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content: prompt }], 400, 25_000), raw);
  } catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
    try {
      return parseEnhancedRepair(await chat(DEEPSEEK_MODELS.pro, [{ role: "user", content: prompt }], 400, 35_000), raw);
    } catch {
      return raw.slice(0, 550);
    }
  }
}

/** A plain JSON-answering completion (flash first, pro when flash is saturated); used by the director assistant. */
export async function completeWithDeepSeek(prompt: string, maxTokens = 6_000): Promise<string> {
  try { return await chat(DEEPSEEK_MODELS.flash, [{ role: "user", content: prompt }], maxTokens, 90_000); }
  catch (error) {
    if (error instanceof ProviderError && !error.retryable) throw error;
    return chat(DEEPSEEK_MODELS.pro, [{ role: "user", content: prompt }], maxTokens, 120_000);
  }
}
