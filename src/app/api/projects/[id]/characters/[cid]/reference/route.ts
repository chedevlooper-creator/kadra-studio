import { randomUUID } from "node:crypto";
import { mkdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { api, json, readBody } from "@/lib/http";
import { projectMediaDirectory } from "@/lib/media";
import { deepseekConfigured, researchCharacterWithDeepSeek } from "@/lib/providers/deepseek";
import { fetchOpenverseFile, searchOpenverse } from "@/lib/providers/openverse";
import { fetchWebImage, webImageMeta } from "@/lib/providers/web-images";
import { expandQueryVariants, fetchCommonsFile, searchCommonsMulti } from "@/lib/providers/wikimedia";
import { repository } from "@/lib/store";
import type { ReferencePhoto } from "@/lib/types";
import { AppError, commonsSelectSchema, idSchema, parseInput, revisionBodySchema, revisionSchema } from "@/lib/validation";
export const runtime = "nodejs";
type Context = { params: Promise<{ id: string; cid: string }> };
const MAX_UPLOAD = 10 * 1024 * 1024;

/** Searches Commons + Openverse with spelling variants; DeepSeek research widens the queries when configured. */
export async function GET(request: Request, context: Context) {
  return api(request, async () => {
    const { id, cid } = await context.params;
    parseInput(idSchema, id);
    const params = new URL(request.url).searchParams;
    const q = params.get("q") ?? "";
    const source = params.get("source") ?? "all";
    const broad = params.get("broad") === "1";
    const warnings: string[] = [];
    let research: Awaited<ReturnType<typeof researchCharacterWithDeepSeek>> | null = null;
    let queries = [q];
    if (deepseekConfigured()) {
      const project = await repository.getProject(id).catch(() => null);
      const character = project?.characters.find((item) => item.id === cid);
      research = await researchCharacterWithDeepSeek({ name: character?.name ?? q, query: q, appearance: character?.appearance });
      if (research.commonsQueries.length) queries = [...new Set([q, ...research.commonsQueries, ...(character?.aliases ?? [])])];
      if (!research.summary && !research.appearance) warnings.push("DeepSeek araştırması sonuç döndürmedi; arama yerel varyantlarla genişletildi.");
    }
    const suggestions = [...new Set(queries.flatMap((item) => expandQueryVariants(item)))].slice(0, 10);
    const wantWikimedia = source !== "openverse";
    const wantOpenverse = source !== "wikimedia";
    const [commons, openverse] = await Promise.all([
      wantWikimedia ? searchCommonsMulti(queries, { broad, limit: 80 }).catch(() => { warnings.push("Wikimedia Commons'a ulaşılamadı."); return []; }) : Promise.resolve([]),
      wantOpenverse ? Promise.all(queries.slice(0, 3).map((item) => searchOpenverse(item, 32).catch(() => []))).then((batches) => batches.flat()) : Promise.resolve([]),
    ]);
    const seen = new Set<string>();
    const results = [...commons, ...openverse].filter((item) => {
      const key = `${item.source ?? "wikimedia"}:${item.id ?? item.title}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }).slice(0, 96);
    return json({ results, research, queries: suggestions, warnings });
  });
}

async function store(id: string, cid: string, revision: number, bytes: Buffer, type: "jpg" | "png", reference: Omit<ReferencePhoto, "file" | "addedAt">) {
  const directory = projectMediaDirectory(repository.mediaDirectory, id);
  await mkdir(directory, { recursive: true });
  const file = `ref-${cid}-${randomUUID().slice(0, 8)}.${type}`;
  await writeFile(path.join(directory, file), bytes);
  try {
    const { project, previous } = await repository.setCharacterReference(id, revision, cid, { ...reference, file, addedAt: new Date().toISOString() });
    if (previous) await rm(path.join(directory, previous), { force: true });
    return project;
  } catch (error) { await rm(path.join(directory, file), { force: true }); throw error; }
}

/** Picks a Commons photo (JSON { revision, title }) or uploads the user's own (raw JPEG/PNG body, ?revision=&name=). */
export async function POST(request: Request, context: Context) {
  return api(request, async () => {
    const { id, cid } = await context.params;
    parseInput(idSchema, id);
    const type = request.headers.get("content-type")?.split(";")[0].trim().toLowerCase();
    if (type === "application/json") {
      const body = await readBody(request, commonsSelectSchema);
      if ("url" in body) {
        const { bytes, type: kind } = await fetchWebImage(body.url);
        return json({ project: await store(id, cid, body.revision, bytes, kind, webImageMeta(body.url)) });
      }
      if ("openverseId" in body) {
        const { meta, bytes, type: kind } = await fetchOpenverseFile(body.openverseId);
        return json({ project: await store(id, cid, body.revision, bytes, kind, { source: "openverse", title: meta.title, pageUrl: meta.pageUrl, author: meta.author, license: meta.license, licenseUrl: meta.licenseUrl }) });
      }
      const { meta, bytes, type: kind } = await fetchCommonsFile(body.title);
      return json({ project: await store(id, cid, body.revision, bytes, kind, { source: "wikimedia", title: meta.title, pageUrl: meta.pageUrl, author: meta.author, license: meta.license, licenseUrl: meta.licenseUrl }) });
    }
    if (type !== "image/jpeg" && type !== "image/png") throw new AppError(415, "JPEG ya da PNG bir fotoğraf seçin.");
    const url = new URL(request.url);
    const revision = parseInput(revisionSchema, Number(url.searchParams.get("revision")));
    const name = [...(url.searchParams.get("name") ?? "")].filter((character) => character >= " ").join("").slice(0, 200) || "Yüklenen fotoğraf";
    if (Number(request.headers.get("content-length") ?? 0) > MAX_UPLOAD) throw new AppError(413, "Fotoğraf en fazla 10 MB olabilir.");
    const bytes = Buffer.from(await request.arrayBuffer());
    if (bytes.byteLength > MAX_UPLOAD) throw new AppError(413, "Fotoğraf en fazla 10 MB olabilir.");
    const kind = bytes[0] === 0x89 && bytes[1] === 0x50 ? "png" : bytes[0] === 0xff && bytes[1] === 0xd8 ? "jpg" : null;
    if (!kind) throw new AppError(415, "Dosya JPEG ya da PNG değil.");
    return json({ project: await store(id, cid, revision, bytes, kind, { source: "upload", title: name, pageUrl: null, author: "Kullanıcı", license: "Kullanıcı yüklemesi (kullanım hakkı kullanıcıda)", licenseUrl: null }) });
  }, true);
}

export async function DELETE(request: Request, context: Context) {
  return api(request, async () => {
    const { id, cid } = await context.params;
    const { revision } = await readBody(request, revisionBodySchema);
    const { project, previous } = await repository.setCharacterReference(id, revision, cid, null);
    if (previous) await rm(path.join(projectMediaDirectory(repository.mediaDirectory, id), previous), { force: true });
    return json({ project });
  }, true);
}
