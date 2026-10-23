import { ProviderError } from "./nvidia";

/** GMI Cloud request-queue API. Server-only; every call that can cost money goes through the run ledger. */
const BASE = "https://console.gmicloud.ai/api/v1/ie/requestqueue/apikey";

export function gmiConfigured(env: Record<string, string | undefined> = process.env): boolean {
  return (env.GMI_API_KEY?.trim().length ?? 0) > 20;
}

function headers(json = true): Record<string, string> {
  const key = process.env.GMI_API_KEY?.trim();
  if (!key) throw new ProviderError("GMI API anahtarı tanımlı değil (.env.local içinde GMI_API_KEY).", false);
  return { Authorization: `Bearer ${key}`, ...(json ? { "Content-Type": "application/json" } : {}) };
}

function describe(status: number, body: string): ProviderError {
  let message = body.replace(/\s+/g, " ").slice(0, 160);
  try {
    const parsed = JSON.parse(body) as { error?: string | { message?: string }; message?: string; detail?: unknown };
    message = (typeof parsed.error === "string" ? parsed.error : parsed.error?.message) ?? parsed.message ?? (typeof parsed.detail === "string" ? parsed.detail : message);
  } catch { /* Not JSON. */ }
  if (status === 401 || status === 403) return new ProviderError("GMI anahtarı reddedildi. Konsoldan anahtarı kontrol edin.", false);
  if (status === 402) return new ProviderError("GMI bakiyesi yetersiz. Konsoldan bakiye yükleyin.", false);
  if (status === 429) return new ProviderError("GMI hız sınırına ulaşıldı.", true);
  return new ProviderError(`GMI isteği başarısız oldu (HTTP ${status}): ${message}`, status >= 500);
}

async function call<T>(path: string, init: RequestInit = {}, timeoutMs = 30_000): Promise<T> {
  let response: Response;
  try { response = await fetch(`${BASE}${path}`, { ...init, headers: { ...headers(), ...init.headers }, signal: AbortSignal.timeout(timeoutMs) }); }
  catch (error) { throw new ProviderError((error as Error).name === "TimeoutError" ? "GMI yanıt vermedi (zaman aşımı)." : "GMI'a bağlanılamadı.", true); }
  if (!response.ok) throw describe(response.status, await response.text());
  return await response.json() as T;
}

export interface GmiModelParameter {
  name: string;
  type?: string;
  options?: { value: unknown }[];
  required?: boolean;
}

export interface GmiModelInfo {
  model: string;
  status?: string;
  price_info?: { pricing_type?: string; price?: number; unit?: string; price_chart?: { rates?: Record<string, Record<string, number>> } };
  pricing_details?: string;
  parameters?: GmiModelParameter[];
}

export const getModelInfo = (model: string) => call<GmiModelInfo>(`/models/${encodeURIComponent(model)}`);

/** Uploads a frame to GMI storage and returns its public (unguessable) URL. Uploading is not billed. */
export async function uploadImage(image: Buffer, type: "jpg" | "png"): Promise<string> {
  const fileType = type === "png" ? "png" : "jpeg";
  const target = await call<{ upload_url: string; public_url: string }>("/upload-url", { method: "POST", body: JSON.stringify({ file_type: fileType }) });
  let response: Response;
  try { response = await fetch(target.upload_url, { method: "PUT", headers: { "Content-Type": `image/${fileType}` }, body: new Uint8Array(image), signal: AbortSignal.timeout(60_000) }); }
  catch { throw new ProviderError("Kare GMI depolamasına yüklenemedi.", true); }
  if (!response.ok) {
    // Storage answers in XML; its error code (e.g. SignatureDoesNotMatch) says why. A refused upload does not fix
    // itself, so only throttling and server errors are retried.
    const code = (await response.text().catch(() => "")).match(/<Code>([^<]{1,60})<\/Code>/)?.[1];
    throw new ProviderError(`Kare GMI depolamasına yüklenemedi (HTTP ${response.status}${code ? `, ${code}` : ""}).`, response.status === 408 || response.status === 429 || response.status >= 500);
  }
  return target.public_url;
}

/** Submits a paid job. A network error here leaves the outcome unknown; callers must not blindly resubmit. */
export async function submitRequest(model: string, payload: Record<string, unknown>): Promise<string> {
  const result = await call<{ request_id?: string }>("/requests", { method: "POST", body: JSON.stringify({ model, payload }) }, 60_000);
  if (!result.request_id) throw new ProviderError("GMI istek numarası döndürmedi.", false);
  return result.request_id;
}

export type RequestState = { state: "pending" } | { state: "success"; mediaUrl: string } | { state: "failed"; message: string };

/** Video models answer with video_url; image models with media_urls: [{ url }]; speech models with an audio URL. */
export function outcomeUrl(outcome: Record<string, unknown>): string | null {
  const listed = Array.isArray(outcome.media_urls) ? outcome.media_urls.map((item) => (item && typeof item === "object" ? (item as { url?: unknown }).url : item)) : [];
  const candidates = [outcome.video_url, outcome.image_url, outcome.audio_url, outcome.url, ...listed, ...(Array.isArray(outcome.video_urls) ? outcome.video_urls : []), ...(Array.isArray(outcome.audio_urls) ? outcome.audio_urls : [])];
  return candidates.find((value): value is string => typeof value === "string" && /^https:\/\//.test(value)) ?? null;
}

export async function getRequest(requestId: string): Promise<RequestState> {
  const data = await call<{ status?: string; outcome?: Record<string, unknown> | null; error?: unknown; message?: string }>(`/requests/${encodeURIComponent(requestId)}`);
  const status = (data.status ?? "").toLowerCase();
  if (status === "success" || status === "succeeded" || status === "finished" || status === "completed") {
    const mediaUrl = outcomeUrl(data.outcome ?? {});
    return mediaUrl ? { state: "success", mediaUrl } : { state: "failed", message: "GMI işi bitti ama çıktı bağlantısı dönmedi." };
  }
  if (["failed", "error", "cancelled", "canceled", "timeout", "rejected"].includes(status)) {
    const detail = typeof data.error === "string" ? data.error : typeof data.message === "string" ? data.message : JSON.stringify(data.outcome ?? data.error ?? "").slice(0, 160);
    return { state: "failed", message: `GMI işi başarısız oldu (${status})${detail && detail !== '""' ? `: ${detail}` : ""}.` };
  }
  return { state: "pending" };
}

export async function downloadMedia(url: string): Promise<Buffer> {
  if (!/^https:\/\//.test(url)) throw new ProviderError("Çıktı bağlantısı güvenli değil.", false);
  let response: Response;
  try { response = await fetch(url, { signal: AbortSignal.timeout(120_000) }); }
  catch { throw new ProviderError("Üretilen dosya indirilemedi.", true); }
  if (!response.ok) throw new ProviderError(`Üretilen dosya indirilemedi (HTTP ${response.status}).`, true);
  const data = Buffer.from(await response.arrayBuffer());
  if (data.byteLength > 300 * 1024 * 1024) throw new ProviderError("Üretilen dosya beklenenden büyük.", false);
  return data;
}
