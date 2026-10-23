import assert from "node:assert/strict";
import test from "node:test";
import { api, assertLocalRequest, readBody } from "./http";
import { revisionBodySchema } from "./validation";

function request(headers: Record<string, string> = {}, body?: string) { return new Request("http://127.0.0.1:3000/api/projects", { method: body === undefined ? "GET" : "POST", headers: { host: "127.0.0.1:3000", ...headers }, body }); }

test("local requests require loopback Host and exact origin for mutation", () => {
  assert.doesNotThrow(() => assertLocalRequest(request()));
  assert.throws(() => assertLocalRequest(request({ host: "example.com" })), /localhost/);
  assert.throws(() => assertLocalRequest(request(), true), /kendi adresinden/);
  assert.throws(() => assertLocalRequest(request({ origin: "http://attacker.example" }), true), /kendi adresinden/);
  assert.throws(() => assertLocalRequest(request({ origin: "http://127.0.0.1:3000", "sec-fetch-site": "cross-site" }), true), /Farklı bir siteden/);
  assert.doesNotThrow(() => assertLocalRequest(request({ origin: "http://127.0.0.1:3000" }), true));
  assert.throws(() => assertLocalRequest(request({ origin: "http://localhost:3000" }), true), /kendi adresinden/);
  assert.throws(() => assertLocalRequest(request({ origin: "null" }), true), /kendi adresinden/);
});

test("Next.js URL normalization to localhost does not reject the browser's 127.0.0.1 host", () => {
  const normalized = (headers: Record<string, string>) => new Request("http://localhost:3000/api/projects", { method: "POST", headers: { host: "127.0.0.1:3000", ...headers }, body: "{}" });
  assert.doesNotThrow(() => assertLocalRequest(normalized({})));
  assert.doesNotThrow(() => assertLocalRequest(normalized({ origin: "http://127.0.0.1:3000", "sec-fetch-site": "same-origin" }), true));
  assert.throws(() => assertLocalRequest(normalized({ host: "rebind.example:3000" })), /localhost/);
  assert.throws(() => assertLocalRequest(normalized({ origin: "http://127.0.0.1:4000" }), true), /kendi adresinden/);
});

test("JSON reader validates type, actual streamed size, malformed JSON and schema", async () => {
  await assert.rejects(readBody(request({}, "{}"), revisionBodySchema), /JSON biçiminde/);
  await assert.rejects(readBody(request({ "content-type": "application/json" }, "{ broken"), revisionBodySchema), /okunamadı/);
  await assert.rejects(readBody(request({ "content-type": "application/json" }, JSON.stringify({ revision: 0 })), revisionBodySchema));
  await assert.rejects(readBody(request({ "content-type": "application/json" }, "x".repeat(160_001)), revisionBodySchema), /çok büyük/);
  assert.deepEqual(await readBody(request({ "content-type": "application/json" }, '{"revision":1}'), revisionBodySchema), { revision: 1 });
});

test("API errors return concise Turkish JSON with no cache", async () => {
  const response = await api(request({ host: "evil.example" }), async () => Response.json({ private: "data" }));
  assert.equal(response.status, 403);
  assert.equal(response.headers.get("cache-control"), "no-store");
  const data = await response.json(); assert.equal(typeof data.error, "string"); assert.equal(data.private, undefined);
});
