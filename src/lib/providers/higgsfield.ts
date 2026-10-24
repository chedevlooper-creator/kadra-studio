import { ProviderError } from "./nvidia";
import type { VideoEngine } from "../production/worker";
import type { RequestState } from "./gmi";

const BASE = "https://api.higgsfield.ai";
const MODEL_PATH = "bytedance/seedance-2.5/image-to-video";

export function higgsfieldConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return (env.HIGGSFIELD_API_KEY?.trim().length ?? 0) > 20;
}

function headers(): Record<string, string> {
  const key = process.env.HIGGSFIELD_API_KEY?.trim();
  if (!key) throw new ProviderError("Higgsfield API anahtarı tanımlı değil (.env.local içinde HIGGSFIELD_API_KEY).", false);
  return { Authorization: `Key ${key}`, "Content-Type": "application/json" };
}

function providerError(status: number, body: string): ProviderError {
  let message = body.replace(/\s+/g, " ").slice(0, 180);
  try {
    const data = JSON.parse(body) as { error?: string | { message?: string }; message?: string; detail?: string };
    message = (typeof data.error === "string" ? data.error : data.error?.message) ?? data.message ?? data.detail ?? message;
  } catch { /* Use the bounded response text. */ }
  if (status === 401 || status === 403) return new ProviderError("Higgsfield API anahtarı reddedildi; open.higgsfield.ai API keys bölümünden kontrol edin.", false);
  if (status === 402) return new ProviderError("Higgsfield API bakiyesi yetersiz.", false);
  if (status === 422) return new ProviderError(`Higgsfield isteği doğrulamadan geçmedi: ${message}`, false);
  if (status === 429) return new ProviderError("Higgsfield hız sınırına ulaşıldı.", true);
  return new ProviderError(`Higgsfield API isteği başarısız oldu (HTTP ${status}): ${message}`, status >= 500);
}

async function request<T>(url: string, init: RequestInit, timeoutMs = 30_000): Promise<T> {
  let response: Response;
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (error) { throw new ProviderError((error as Error).name === "TimeoutError" ? "Higgsfield API yanıt vermedi (zaman aşımı)." : "Higgsfield API'ye bağlanılamadı.", true); }
  if (!response.ok) throw providerError(response.status, await response.text());
  return await response.json() as T;
}

/** Uses Higgsfield's signed server-side upload flow; signed URLs and credentials are never logged. */
export async function uploadImage(image: Buffer, type: "jpg" | "png"): Promise<string> {
  const contentType = type === "png" ? "image/png" : "image/jpeg";
  const target = await request<{ upload_url?: string; public_url?: string; upload_headers?: Record<string, string> }>(`${BASE}/files/generate-upload-url`, {
    method: "POST", headers: headers(), body: JSON.stringify({ content_type: contentType }),
  });
  if (!target.upload_url || !target.public_url) throw new ProviderError("Higgsfield yükleme bağlantısı döndürmedi.", false);
  let response: Response;
  try {
    response = await fetch(target.upload_url, { method: "PUT", headers: target.upload_headers ?? { "Content-Type": contentType }, body: new Uint8Array(image), signal: AbortSignal.timeout(60_000) });
  } catch { throw new ProviderError("Kare Higgsfield depolamasına yüklenemedi.", true); }
  if (!response.ok) throw new ProviderError(`Kare Higgsfield depolamasına yüklenemedi (HTTP ${response.status}).`, response.status === 408 || response.status === 429 || response.status >= 500);
  return target.public_url;
}

export async function submitRequest(_model: string, payload: Record<string, unknown>): Promise<string> {
  const result = await request<{ request_id?: string }>(`${BASE}/${MODEL_PATH}`, { method: "POST", headers: headers(), body: JSON.stringify(payload) }, 60_000);
  if (!result.request_id) throw new ProviderError("Higgsfield istek numarası döndürmedi; istek sonucu belirsiz.", true);
  return result.request_id;
}

export async function getRequest(requestId: string): Promise<RequestState> {
  const data = await request<{ status?: string; video?: { url?: string }; images?: { url?: string }[]; error?: string | { message?: string }; message?: string }>(`${BASE}/requests/${encodeURIComponent(requestId)}/status`, { headers: headers() });
  const status = (data.status ?? "").toLowerCase();
  if (status === "completed") {
    const mediaUrl = data.video?.url ?? data.images?.[0]?.url;
    return mediaUrl ? { state: "success", mediaUrl } : { state: "failed", message: "Higgsfield işi tamamlandı ancak çıktı bağlantısı dönmedi." };
  }
  if (["failed", "nsfw", "canceled", "cancelled"].includes(status)) {
    const detail = typeof data.error === "string" ? data.error : data.error?.message ?? data.message;
    return { state: "failed", message: `Higgsfield işi başarısız oldu (${status})${detail ? `: ${detail.slice(0, 160)}` : ""}.` };
  }
  return { state: "pending" };
}

export async function downloadMedia(url: string): Promise<Buffer> {
  if (!/^https:\/\//.test(url)) throw new ProviderError("Higgsfield çıktı bağlantısı güvenli değil.", false);
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(120_000) }); }
  catch { throw new ProviderError("Higgsfield çıktısı indirilemedi.", true); }
  if (!response.ok) throw new ProviderError(`Higgsfield çıktısı indirilemedi (HTTP ${response.status}).`, true);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > 300 * 1024 * 1024) throw new ProviderError("Higgsfield çıktısı beklenenden büyük.", false);
  return data;
}

export type HiggsfieldVideoEngine = VideoEngine;
