import type { WikimediaResult } from "../types";
import { ProviderError } from "./nvidia";

/** Openverse: CC-licensed images aggregated from Flickr and other open collections. No key needed. */
const API = "https://api.openverse.org/v1/images";
const HEADERS = { "User-Agent": "KadraStudio/0.1 (local single-user film tool)", Accept: "application/json" };

type OpenverseImage = {
  id?: string; title?: string; url?: string; thumbnail?: string; foreign_landing_url?: string;
  width?: number; height?: number; license?: string; license_url?: string; creator?: string;
};

/** Maps an Openverse answer to the shared result shape; entries without a usable image are skipped. */
export function parseOpenverse(data: unknown): WikimediaResult[] {
  const results = (data as { results?: OpenverseImage[] })?.results ?? [];
  return results.flatMap((item) => {
    if (!item.id || !item.url || !item.foreign_landing_url) return [];
    return [{
      title: (item.title || "Openverse görseli").trim().slice(0, 200),
      pageUrl: item.foreign_landing_url,
      thumbUrl: item.thumbnail || item.url,
      width: item.width ?? 0,
      height: item.height ?? 0,
      license: (item.license || "").toUpperCase() || "Lisans belirtilmemiş",
      licenseUrl: item.license_url ?? null,
      author: (item.creator || "").trim() || "Bilinmiyor",
      source: "openverse" as const,
      id: item.id,
      imageUrl: item.url,
    }];
  });
}

export async function searchOpenverse(query: string, limit = 48): Promise<WikimediaResult[]> {
  const term = query.trim().slice(0, 120);
  if (term.length < 2) return [];
  const url = `${API}/?${new URLSearchParams({ q: term, page_size: String(Math.min(50, Math.max(1, limit))), filter_dead: "false", license_type: "all" })}`;
  let response: Response;
  try { response = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(20_000) }); }
  catch { throw new ProviderError("Openverse'e bağlanılamadı.", true); }
  if (!response.ok) throw new ProviderError(`Openverse yanıt vermedi (HTTP ${response.status}).`, response.status >= 500);
  return parseOpenverse(await response.json());
}

function assertPublicHttps(raw: string): URL {
  const url = new URL(raw);
  const host = url.hostname.toLowerCase();
  if (url.protocol !== "https:" || host === "localhost" || host === "::1" || /^127\.|^10\.|^192\.168\.|^172\.(1[6-9]|2\d|3[01])\./.test(host)) {
    throw new ProviderError("Beklenmeyen bir görsel adresi döndü.", false);
  }
  return url;
}

/** Re-reads the Openverse record server-side (never trusts client-supplied licence text) and downloads the image. */
export async function fetchOpenverseFile(id: string): Promise<{ meta: WikimediaResult; bytes: Buffer; type: "jpg" | "png" }> {
  if (!/^[A-Za-z0-9-]{8,80}$/.test(id)) throw new ProviderError("Geçersiz Openverse kimliği.", false);
  let response: Response;
  try { response = await fetch(`${API}/${encodeURIComponent(id)}/`, { headers: HEADERS, signal: AbortSignal.timeout(20_000) }); }
  catch { throw new ProviderError("Openverse kaydına ulaşılamadı.", true); }
  if (!response.ok) throw new ProviderError("Bu görsel Openverse'te bulunamadı.", false);
  const meta = parseOpenverse({ results: [await response.json() as OpenverseImage] })[0];
  if (!meta?.imageUrl) throw new ProviderError("Bu görselin indirilebilir adresi yok.", false);
  const url = assertPublicHttps(meta.imageUrl);
  let imageResponse: Response;
  try { imageResponse = await fetch(url, { headers: HEADERS, signal: AbortSignal.timeout(30_000) }); }
  catch { throw new ProviderError("Fotoğraf indirilemedi.", true); }
  if (!imageResponse.ok) throw new ProviderError(`Fotoğraf indirilemedi (HTTP ${imageResponse.status}).`, imageResponse.status >= 500);
  const bytes = Buffer.from(await imageResponse.arrayBuffer());
  if (bytes.byteLength > 15 * 1024 * 1024) throw new ProviderError("Fotoğraf çok büyük.", false);
  const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg" : null;
  if (!type) throw new ProviderError("İndirilen dosya JPEG ya da PNG değil.", false);
  return { meta, bytes, type };
}
