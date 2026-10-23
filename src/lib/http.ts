import { z } from "zod";
import { AppError, parseInput } from "./validation";

const MAX_BODY_BYTES = 160_000;
function localHost(host: string): boolean {
  try { return ["localhost", "127.0.0.1", "[::1]"].includes(new URL(`http://${host}`).hostname); }
  catch { return false; }
}

/**
 * This milestone has no authentication: only loopback hosts and same-origin writes are admitted.
 * Next.js normalizes `request.url` to `localhost`, so the browser's Host header is the address to compare against.
 */
export function assertLocalRequest(request: Request, mutation = false) {
  const host = request.headers.get("host")?.toLowerCase();
  const isVercel = Boolean(process.env.VERCEL);
  if (!host || (!isVercel && (!localHost(host) || !localHost(new URL(request.url).host)))) throw new AppError(403, "Bu yerel sürüme yalnızca localhost üzerinden erişilebilir.");
  if (!mutation) return;
  const origin = request.headers.get("origin");
  let originHost = "";
  try { const parsed = new URL(origin ?? ""); if (parsed.protocol === "http:" || parsed.protocol === "https:") originHost = parsed.host; } catch { /* Missing or opaque origin. */ }
  if (originHost !== host) throw new AppError(403, "Değişiklik isteği uygulamanın kendi adresinden gelmeli.");
  const site = request.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new AppError(403, "Farklı bir siteden değişiklik yapılamaz.");
}

export async function readBody<T>(request: Request, schema: z.ZodType<T>): Promise<T> {
  if (request.headers.get("content-type")?.split(";")[0].trim().toLowerCase() !== "application/json") throw new AppError(415, "İstek JSON biçiminde olmalı.");
  const declared = request.headers.get("content-length");
  if (declared && (!/^\d+$/.test(declared) || Number(declared) > MAX_BODY_BYTES)) throw new AppError(413, "İstek boyutu çok büyük.");
  if (!request.body) throw new AppError(400, "İstek gövdesi gerekli.");
  const reader = request.body.getReader();
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > MAX_BODY_BYTES) { await reader.cancel(); throw new AppError(413, "İstek boyutu çok büyük."); }
      chunks.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  let data: unknown;
  try { data = JSON.parse(Buffer.concat(chunks).toString("utf8")); }
  catch { throw new AppError(400, "JSON verisi okunamadı."); }
  return parseInput(schema, data);
}

export function json(data: unknown, status = 200) { return Response.json(data, { status, headers: { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" } }); }
export async function api(request: Request, action: () => Promise<Response>, mutation = false): Promise<Response> {
  try { assertLocalRequest(request, mutation); return await action(); }
  catch (error) {
    if (error instanceof AppError) return json({ error: error.message }, error.status);
    console.error("Local API operation failed:", error instanceof Error ? error.message : "Unknown error");
    return json({ error: "İşlem tamamlanamadı. Yerel sunucu günlüğünü kontrol edin." }, 500);
  }
}
