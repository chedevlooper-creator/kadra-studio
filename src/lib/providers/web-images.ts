import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import type { ReferencePhoto, WikimediaResult } from "../types";
import { ProviderError } from "./nvidia";

/**
 * Imports an image the user found on the web. Search engines and most sites block automated
 * crawling, so the app does not scrape them: the user pastes a direct image URL and the server
 * downloads it safely (https only, public address only, size/type limits, validated redirects).
 */

const MAX_BYTES = 15 * 1024 * 1024;
const MAX_REDIRECTS = 3;
const HEADERS = { "User-Agent": "KadraStudio/0.1 (local single-user film tool)", Accept: "image/*" };

/** Loopback, private, link-local, carrier-grade NAT and multicast ranges that must never be fetched. */
export function isPrivateAddress(address: string): boolean {
  if (isIP(address) === 4) {
    const [a, b] = address.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31)
      || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  const value = address.toLowerCase();
  return value === "::" || value === "::1" || value.startsWith("fe80") || value.startsWith("fc") || value.startsWith("fd")
    || value.startsWith("ff") || value.startsWith("::ffff:127.") || value.startsWith("::ffff:10.")
    || value.startsWith("::ffff:192.168.") || value.startsWith("::ffff:172.");
}

/** Every hop must be a plain public https address; this is the SSRF gate for user-supplied URLs. */
export async function assertPublicImageUrl(raw: string): Promise<URL> {
  let url: URL;
  try { url = new URL(raw.trim()); }
  catch { throw new ProviderError("Geçerli bir görsel adresi girin.", false); }
  if (url.protocol !== "https:") throw new ProviderError("Yalnızca https:// görsel adresleri kullanılabilir.", false);
  if (url.username || url.password) throw new ProviderError("Kullanıcı adı içeren adresler kullanılamaz.", false);
  let addresses: { address: string }[];
  try { addresses = await lookup(url.hostname, { all: true }); }
  catch { throw new ProviderError("Görsel adresi çözümlenemedi.", false); }
  if (!addresses.length || addresses.some(({ address }) => isPrivateAddress(address))) {
    throw new ProviderError("Bu adres genel bir internet adresi değil; yerel veya özel ağ adresleri kullanılamaz.", false);
  }
  return url;
}

async function safeFetch(start: URL): Promise<Response> {
  let current = start;
  for (let hop = 0; hop <= MAX_REDIRECTS; hop += 1) {
    const response = await fetch(current, { redirect: "manual", headers: HEADERS, signal: AbortSignal.timeout(25_000) })
      .catch(() => { throw new ProviderError("Görsel indirilemedi; adres yanıt vermedi.", true); });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get("location");
    if (!location) throw new ProviderError("Görsel adresi geçersiz bir yönlendirme döndürdü.", false);
    current = await assertPublicImageUrl(new URL(location, current).toString());
  }
  throw new ProviderError("Görsel adresi çok fazla yönlendirme yapıyor.", false);
}

/** Downloads a user-supplied image and verifies it is a JPEG or PNG before it is stored as a reference. */
export async function fetchWebImage(raw: string): Promise<{ bytes: Buffer; type: "jpg" | "png" }> {
  const url = await assertPublicImageUrl(raw);
  const response = await safeFetch(url);
  if (!response.ok) throw new ProviderError(`Görsel indirilemedi (HTTP ${response.status}).`, response.status >= 500);
  const declared = Number(response.headers.get("content-length") ?? 0);
  if (Number.isFinite(declared) && declared > MAX_BYTES) throw new ProviderError("Görsel çok büyük (en fazla 15 MB).", false);
  const bytes = Buffer.from(await response.arrayBuffer());
  if (bytes.byteLength > MAX_BYTES) throw new ProviderError("Görsel çok büyük (en fazla 15 MB).", false);
  const type = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg" : null;
  if (!type) throw new ProviderError("Adres JPEG ya da PNG bir görsel döndürmedi. Görselin doğrudan adresini kullanın.", false);
  return { bytes, type };
}

/** Provenance for a web image: the licence is unknown, so the record says so instead of guessing. */
export function webImageMeta(raw: string): Omit<ReferencePhoto, "file" | "addedAt"> {
  const url = new URL(raw.trim());
  const name = decodeURIComponent(url.pathname.split("/").filter(Boolean).at(-1) ?? "").replace(/\.[a-z0-9]+$/i, "").trim();
  return {
    source: "web",
    title: (name || url.hostname).slice(0, 300),
    pageUrl: url.toString().slice(0, 600),
    author: url.hostname.slice(0, 300),
    license: "Web görseli — kullanım hakkını kontrol edin",
    licenseUrl: null,
  };
}

/** The same shape the Commons/Openverse result lists use, for a URL the user added manually. */
export function webImageResult(raw: string): WikimediaResult {
  const meta = webImageMeta(raw);
  return { title: meta.title, pageUrl: meta.pageUrl ?? raw, thumbUrl: raw, width: 0, height: 0, license: meta.license, licenseUrl: null, author: meta.author, source: "web", imageUrl: raw };
}
