import type { WikimediaResult } from "../types";
import { ProviderError } from "./nvidia";

/** Wikimedia Commons: freely licensed photos whose author and licence are known. */
const API = "https://commons.wikimedia.org/w/api.php";
const HEADERS = { "User-Agent": "KadraStudio/0.1 (local single-user film tool)", Accept: "application/json" };
const ALLOWED_HOSTS = new Set(["upload.wikimedia.org", "thumb.wikimedia.org"]);

function plain(html: string): string {
  return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&quot;/g, "\"").replace(/&#0?39;/g, "'").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
}

type ImageInfo = { mime?: string; width?: number; height?: number; descriptionurl?: string; thumburl?: string; extmetadata?: Record<string, { value?: string }> };

/** Turns a Commons API answer into licence-labelled results; non-photo formats are skipped. */
export function parseCommons(data: unknown): WikimediaResult[] {
  const pages = (data as { query?: { pages?: Record<string, { title?: string; index?: number; imageinfo?: ImageInfo[] }> } })?.query?.pages ?? {};
  return Object.values(pages).sort((a, b) => (a.index ?? 0) - (b.index ?? 0)).flatMap((page) => {
    const info = page.imageinfo?.[0];
    if (!page.title || !info?.thumburl || !info.descriptionurl || !["image/jpeg", "image/png"].includes(info.mime ?? "")) return [];
    const meta = info.extmetadata ?? {};
    return [{
      title: page.title, pageUrl: info.descriptionurl, thumbUrl: info.thumburl, width: info.width ?? 0, height: info.height ?? 0,
      license: plain(meta.LicenseShortName?.value ?? "") || "Lisans belirtilmemiş",
      licenseUrl: meta.LicenseUrl?.value ? plain(meta.LicenseUrl.value) : null,
      author: plain(meta.Artist?.value ?? meta.Credit?.value ?? "") || "Bilinmiyor",
      source: "wikimedia" as const,
    }];
  });
}

/** Strips Turkish and other diacritics so "Şeyh Şamil" also matches "Sheikh Shamil" style file names. */
export function stripDiacritics(text: string): string {
  return text.replace(/ı/g, "i").replace(/İ/g, "I").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/\s+/g, " ").trim();
}

/**
 * Commons file names are inconsistent, so one exact query misses most photos.
 * Variants cover: parenthetical notes dropped, diacritic-free spelling, and "Surname, Name" order flipped.
 */
export function expandQueryVariants(query: string): string[] {
  const raw = query.trim().replace(/\s+/g, " ");
  if (raw.length < 2) return [];
  const withoutParens = raw.replace(/\([^)]*\)/g, "").replace(/\s+/g, " ").trim();
  const candidates = [withoutParens || raw, raw];
  if (withoutParens.includes(",")) {
    const parts = withoutParens.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 2) candidates.push(`${parts[1]} ${parts[0]}`);
  }
  const stripped = stripDiacritics(withoutParens || raw);
  if (stripped && stripped !== (withoutParens || raw)) candidates.push(stripped);
  if (stripped.includes(",")) {
    const parts = stripped.split(",").map((part) => part.trim()).filter(Boolean);
    if (parts.length === 2) candidates.push(`${parts[1]} ${parts[0]}`);
  }
  const seen = new Set<string>();
  return candidates.filter((item) => {
    const key = item.toLocaleLowerCase("tr");
    if (item.length < 2 || seen.has(key)) return false;
    seen.add(key);
    return true;
  }).slice(0, 6);
}

async function api(params: Record<string, string>): Promise<unknown> {
  const url = `${API}?${new URLSearchParams({ action: "query", format: "json", prop: "imageinfo", iiprop: "url|extmetadata|size|mime", iiextmetadatafilter: "LicenseShortName|LicenseUrl|Artist|Credit", ...params })}`;
  let response: Response;
  try { response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) }); }
  catch { throw new ProviderError("Wikimedia Commons'a bağlanılamadı.", true); }
  if (!response.ok) throw new ProviderError(`Wikimedia Commons yanıt vermedi (HTTP ${response.status}).`, response.status >= 500);
  return response.json();
}

export async function searchCommons(query: string, options: { limit?: number; broad?: boolean; offset?: number } = {}): Promise<WikimediaResult[]> {
  const term = query.trim().slice(0, 120);
  if (term.length < 2) return [];
  const limit = Math.min(50, Math.max(1, options.limit ?? 50));
  const search = options.broad ? term : `${term} filetype:bitmap`;
  return parseCommons(await api({
    generator: "search", gsrnamespace: "6", gsrsearch: search, gsrlimit: String(limit),
    ...(options.offset ? { gsroffset: String(options.offset) } : {}), iiurlwidth: "480",
  }));
}

/**
 * Searches Commons across base queries plus their spelling variants.
 * First pass keeps the photo-only filter; when that is sparse a second, broader pass drops it.
 */
export async function searchCommonsMulti(queries: string[], options: { limit?: number; broad?: boolean } = {}): Promise<WikimediaResult[]> {
  const limit = options.limit ?? 80;
  const terms: string[] = [];
  const seenTerms = new Set<string>();
  for (const query of queries) {
    for (const variant of expandQueryVariants(query)) {
      const key = variant.toLocaleLowerCase("tr");
      if (seenTerms.has(key)) continue;
      seenTerms.add(key);
      terms.push(variant);
      if (terms.length >= 8) break;
    }
    if (terms.length >= 8) break;
  }
  if (!terms.length) return [];
  const run = async (broad: boolean, list: string[]) => {
    const batches = await Promise.all(list.map((term, index) => index === 0 && !broad ? searchCommons(term, { broad }) : searchCommons(term, { broad }).catch(() => [])));
    return batches.flat();
  };
  let results = await run(Boolean(options.broad), terms);
  if (!options.broad && results.length < 16) {
    results = [...results, ...await run(true, terms.slice(0, 4))];
  }
  const seen = new Set<string>();
  return results.filter((result) => {
    if (seen.has(result.title)) return false;
    seen.add(result.title);
    return true;
  }).slice(0, limit);
}

/** Looks the file up by its Commons title (never by a client-supplied URL) and downloads a 1024px copy. */
export async function fetchCommonsFile(title: string): Promise<{ meta: WikimediaResult; bytes: Buffer; type: "jpg" | "png" }> {
  const meta = parseCommons(await api({ titles: title, iiurlwidth: "1024" }))[0];
  if (!meta) throw new ProviderError("Bu dosya Wikimedia Commons'ta bulunamadı ya da fotoğraf değil.", false);
  const url = new URL(meta.thumbUrl);
  if (url.protocol !== "https:" || !ALLOWED_HOSTS.has(url.hostname)) throw new ProviderError("Beklenmeyen bir dosya adresi döndü.", false);
  let response: Response;
  try { response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) }); }
  catch { throw new ProviderError("Fotoğraf indirilemedi.", true); }
  if (!response.ok) throw new ProviderError(`Fotoğraf indirilemedi (HTTP ${response.status}).`, response.status >= 500);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > 15 * 1024 * 1024) throw new ProviderError("Fotoğraf çok büyük.", false);
  const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg" : null;
  if (!type) throw new ProviderError("İndirilen dosya JPEG ya da PNG değil.", false);
  return { meta, bytes, type };
}
