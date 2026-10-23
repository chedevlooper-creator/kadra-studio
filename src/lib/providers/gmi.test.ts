import assert from "node:assert/strict";
import test from "node:test";
import { uploadImage } from "./gmi";
import { ProviderError } from "./nvidia";

test("uploads ask for the slot type the signature covers, and a storage refusal names its reason without retrying", async (t) => {
  const originalFetch = globalThis.fetch;
  const originalKey = process.env.GMI_API_KEY;
  t.after(() => { globalThis.fetch = originalFetch; process.env.GMI_API_KEY = originalKey; });
  process.env.GMI_API_KEY = "test-key-that-is-long-enough";
  const calls: { url: string; init?: RequestInit }[] = [];
  let storage = new Response("", { status: 200 });
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (String(url).endsWith("/upload-url")) return Response.json({ upload_url: "https://storage.googleapis.com/b/x.jpeg?X-Goog-SignedHeaders=content-type%3Bhost", public_url: "https://storage.googleapis.com/b/x.jpeg" });
    return storage;
  };

  assert.equal(await uploadImage(Buffer.from("jpeg bytes"), "jpg"), "https://storage.googleapis.com/b/x.jpeg");
  // GCS signs the content type: a "jpg" slot is signed for image/jpg, which is not what the file is sent as.
  assert.equal(JSON.parse(String(calls[0].init?.body)).file_type, "jpeg");
  assert.equal((calls[1].init?.headers as Record<string, string>)["Content-Type"], "image/jpeg");

  storage = new Response("<?xml version='1.0' encoding='UTF-8'?><Error><Code>SignatureDoesNotMatch</Code><Message>Access denied.</Message></Error>", { status: 403 });
  await assert.rejects(uploadImage(Buffer.from("jpeg bytes"), "jpg"), (error: unknown) => error instanceof ProviderError && /HTTP 403, SignatureDoesNotMatch/.test(error.message) && !error.retryable);
  storage = new Response("", { status: 503 });
  await assert.rejects(uploadImage(Buffer.from("png bytes"), "png"), (error: unknown) => error instanceof ProviderError && error.retryable, "a storage outage is worth another try");
});
