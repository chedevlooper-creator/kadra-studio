"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { Check, ExternalLink, ImagePlus, Info, LoaderCircle, MapPin, Pencil, Plus, Search, ShieldCheck, Sparkles, Trash2, TriangleAlert, Upload, Users, WandSparkles, X } from "lucide-react";
import type { Character, CharacterEstimate, CharacterResearchView, Project, ProviderStatus, SheetAttempt, WikimediaResult } from "@/lib/types";
import RepairDialog, { type RepairTarget } from "./repair-dialog";

const STATUS: Record<Character["sheet"]["status"], string> = { none: "Sayfa yok", producing: "Üretiliyor", review: "Onayını bekliyor", approved: "Onaylandı", failed: "Üretilemedi" };
const usd = (value: number) => `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} $`;

async function send<T>(url: string, init: RequestInit): Promise<T> {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({})) as T & { error?: string };
  if (!response.ok) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result;
}
const json = (method: string, body: unknown, headers: Record<string, string> = {}): RequestInit => ({ method, headers: { "Content-Type": "application/json", ...headers }, body: JSON.stringify(body) });

function average(attempt: SheetAttempt) {
  if (!attempt.verdict) return null;
  const { style, traits, pose, clean } = attempt.verdict.scores;
  return (style + traits + pose + clean) / 4;
}

type Draft = { id: string | null; kind: Character["kind"]; name: string; appearance: string; aliases: string; style: string };

/**
 * Characters come first: each gets a reference sheet (from a chosen photo or from its description),
 * an automatic judge scores every attempt, and only a sheet the user approves is used later.
 */
export default function CharacterBank({ project, providers, disabled, onProjectChange, notify }: { project: Project; providers: ProviderStatus; disabled: boolean; onProjectChange: (project: Project) => void; notify: (message: string) => void }) {
  const characters = project.characters;
  const base = `/api/projects/${project.id}/characters`;
  const [selected, setSelected] = useState<string[]>(() => characters.filter((character) => character.sheet.status !== "approved").map((character) => character.id));
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [searchFor, setSearchFor] = useState<Character | null>(null);
  const [query, setQuery] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [results, setResults] = useState<WikimediaResult[] | null>(null);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);
  const [sourceFilter, setSourceFilter] = useState<"all" | "wikimedia" | "openverse">("all");
  const [research, setResearch] = useState<CharacterResearchView | null>(null);
  const [estimate, setEstimate] = useState<CharacterEstimate | null>(null);
  const engine = "nano-banana" as const;
  const [budget, setBudget] = useState<string>(() => project.budget !== null ? String(project.budget) : "25");
  const [viewing, setViewing] = useState<Record<string, string>>({});
  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null);
  const uploadFor = useRef<string | null>(null);
  const uploadInput = useRef<HTMLInputElement>(null);
  const draftDialog = useRef<HTMLDialogElement>(null);
  const searchDialog = useRef<HTMLDialogElement>(null);
  const estimateDialog = useRef<HTMLDialogElement>(null);
  const locked = disabled || busy !== null;

  useEffect(() => { const dialog = draftDialog.current; if (draft && dialog && !dialog.open) dialog.showModal(); if (!draft && dialog?.open) dialog.close(); }, [draft]);
  useEffect(() => { const dialog = searchDialog.current; if (searchFor && dialog && !dialog.open) dialog.showModal(); if (!searchFor && dialog?.open) dialog.close(); }, [searchFor]);
  useEffect(() => { const dialog = estimateDialog.current; if (estimate && dialog && !dialog.open) dialog.showModal(); if (!estimate && dialog?.open) dialog.close(); }, [estimate]);

  async function run(label: string, task: () => Promise<void>) {
    setBusy(label); setError("");
    try { await task(); } catch (cause) { setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı."); } finally { setBusy(null); }
  }
  const apply = (result: { project: Project }, message: string) => { onProjectChange(result.project); notify(message); };

  function saveDraft(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!draft) return;
    const body = { revision: project.revision, name: draft.name, appearance: draft.appearance, aliases: draft.aliases.split(",").map((alias) => alias.trim()).filter(Boolean), style: draft.style, ...(draft.id ? {} : { kind: draft.kind }) };
    void run("draft", async () => {
      const result = await send<{ project: Project }>(draft.id ? `${base}/${draft.id}` : base, json(draft.id ? "PATCH" : "POST", body));
      if (!draft.id) { const added = result.project.characters.at(-1); if (added) setSelected((current) => [...current, added.id]); }
      apply(result, draft.id ? `${draft.kind === "place" ? "Mekân" : "Karakter"} güncellendi.` : `${draft.kind === "place" ? "Mekân" : "Karakter"} eklendi; adının geçtiği çekimlere bağlandı.`);
      setDraft(null);
    });
  }

  function openSearch(character: Character) {
    setSearchFor(character); setQuery(character.name.replace(/\(.*?\)/g, "").trim()); setImageUrl(""); setResults(null); setResearch(null); setSuggestions([]); setWarnings([]); setSourceFilter("all"); setError("");
  }
  function doSearch(term: string, broad = false) {
    if (!searchFor) return;
    void run("search", async () => {
      const params = new URLSearchParams({ q: term, ...(broad ? { broad: "1" } : {}) });
      const response = await send<{ results: WikimediaResult[]; research?: CharacterResearchView | null; queries?: string[]; warnings?: string[] }>(`${base}/${searchFor.id}/reference?${params}`, { method: "GET" });
      setResults(response.results);
      setResearch(response.research ?? null);
      setSuggestions(response.queries ?? []);
      setWarnings(response.warnings ?? []);
    });
  }
  function search(event?: FormEvent) {
    event?.preventDefault();
    doSearch(query);
  }
  /** Any public https image URL can become the reference; no scraping, no search-engine key. */
  function addImageUrl(event: FormEvent) {
    event.preventDefault();
    if (!searchFor) return;
    const url = imageUrl.trim();
    if (!/^https:\/\//i.test(url)) { setError("Görsel adresi https:// ile başlamalı."); return; }
    void run("url", async () => {
      const result = await send<{ project: Project }>(`${base}/${searchFor.id}/reference`, json("POST", { revision: project.revision, source: "web", url }));
      apply(result, "Web görseli referans olarak eklendi; karakter sayfası bu fotoğraftan üretilecek.");
      setImageUrl("");
      setSearchFor(null);
    });
  }
  function applyResearch() {
    if (!searchFor || !research) return;
    const aliases = [...new Set([...searchFor.aliases, ...research.aliases])].slice(0, 12);
    void run("apply-research", async () => {
      const result = await send<{ project: Project }>(`${base}/${searchFor.id}`, json("PATCH", { revision: project.revision, appearance: research.appearance || searchFor.appearance, aliases }));
      const updated = result.project.characters.find((item) => item.id === searchFor.id) ?? null;
      setSearchFor(updated);
      apply(result, "DeepSeek web araştırmasından görünüş tarifi ve adlar karaktere aktarıldı.");
    });
  }
  function pick(result: WikimediaResult) {
    if (!searchFor) return;
    const body = result.source === "openverse" && result.id ? { revision: project.revision, source: "openverse" as const, openverseId: result.id } : { revision: project.revision, title: result.title };
    void run("pick", async () => { apply(await send<{ project: Project }>(`${base}/${searchFor.id}/reference`, json("POST", body)), "Referans fotoğraf kaydedildi; kaynak ve lisans bilgisi karakterde."); setSearchFor(null); });
  }
  function upload(file: File) {
    const id = uploadFor.current;
    if (!id) return;
    void run("upload", async () => apply(await send<{ project: Project }>(`${base}/${id}/reference?revision=${project.revision}&name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": file.type || "image/jpeg" }, body: file }), "Fotoğraf yüklendi."));
  }

  function priceRun(customBudget?: number) {
    if (!selected.length) { setError("Üretilecek en az bir karakter seç."); return; }
    const parsedBudget = customBudget ?? (project.budget === null ? Number(budget.replace(",", ".")) : undefined);
    const budgetValue = parsedBudget !== undefined && Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : undefined;
    void run("estimate", async () => setEstimate((await send<{ estimate: CharacterEstimate }>(`${base}/run`, json("POST", { revision: project.revision, characterIds: selected, maxCost: 0, preview: true, engine, ...(budgetValue !== undefined ? { budget: budgetValue } : {}) }))).estimate));
  }
  function startRun() {
    if (!estimate) return;
    const parsedBudget = Number(budget.replace(",", "."));
    const budgetValue = Number.isFinite(parsedBudget) && parsedBudget > 0 ? parsedBudget : undefined;
    void run("start", async () => { apply(await send<{ project: Project }>(`${base}/run`, json("POST", { revision: project.revision, characterIds: estimate.lines.map((line) => line.characterId), maxCost: estimate.total, engine, ...(budgetValue !== undefined ? { budget: budgetValue } : {}) }, { "Idempotency-Key": crypto.randomUUID() })), "Karakter sayfaları üretiliyor; hakem her denemeyi puanlıyor."); setEstimate(null); });
  }

  return <section className="char-bank" aria-labelledby="char-bank-title">
    <div className="char-bank-head">
      <div><span className="studio-eyebrow">ÖNCE KARAKTERLER VE MEKÂNLAR</span><h3 id="char-bank-title"><Users size={15} /> Karakter ve mekân bankası <span>{characters.length}</span></h3><p>Her karakter için bir referans sayfası, her mekân için geniş bir mekân görseli üretilir; onaylananlar referanslı karelerde modele verilir ve aynı mekândaki çekimler birbirini takip eder. Tüm sayfalar ücretli GMI Nano Banana 2.1 ile üretilir. Hakem her denemeyi puanlar; ücretli sayfada hatanın yerini gösterirse sayfa baştan üretilmez, yalnızca o bölge onarılır. Son onay senin.</p></div>
      <div className="char-bank-actions">
        <span className="char-hint" style={{ alignSelf: "center" }}>Nano Banana 2.1 · GMI ücretli</span>
        <button type="button" className="studio-button studio-button-secondary" disabled={locked} onClick={() => setDraft({ id: null, kind: "person", name: "", appearance: "", aliases: "", style: "" })}><Plus size={14} /> Karakter ekle</button>
        <button type="button" className="studio-button studio-button-secondary" disabled={locked} onClick={() => setDraft({ id: null, kind: "place", name: "", appearance: "", aliases: "", style: "" })}><MapPin size={14} /> Mekân ekle</button>
        <button type="button" className="studio-button studio-button-primary" disabled={locked || !selected.length} onClick={() => priceRun()}>{busy === "estimate" ? <LoaderCircle size={14} className="studio-spin" /> : <Sparkles size={14} />} Seçilenleri üret ({selected.length})</button>
      </div>
    </div>

    {!providers.nvidia ? <p className="char-search-note"><TriangleAlert size={13} /> NVIDIA anahtarı yok: fotoğrafsız çizim{providers.deepseek ? " kapalı (hakem DeepSeek üzerinden çalışır)." : " ve hakem kapalı."}</p> : null}
    {!providers.gmi && characters.some((character) => character.reference) ? <p className="char-search-note"><TriangleAlert size={13} /> GMI anahtarı yok: fotoğraflı karakterler üretilemez.</p> : null}
    {!characters.length ? <p className="char-bank-empty">Henüz karakter ya da mekân yok. "Karakter ekle" veya "Mekân ekle" ile başla; adının geçtiği çekimler otomatik bağlanır.</p> : <div className="char-grid">{characters.map((character) => {
      const attempts = character.sheet.attempts;
      const shownId = viewing[character.id] ?? character.sheet.chosen;
      const shown = attempts.find((attempt) => attempt.id === shownId) ?? attempts.find((attempt) => attempt.id === character.sheet.chosen) ?? null;
      const linked = project.scenes.filter((scene) => scene.characterIds.includes(character.id)).length;
      const reference = character.reference;
      return <article key={character.id} className={`char-card char-${character.sheet.status}${character.kind === "place" ? " char-place" : ""}`}>
        <div className="char-media">
          {shown ? <img src={shown.url} alt={`${character.name} karakter sayfası`} /> : reference ? <img src={`/api/projects/${project.id}/media/${reference.file}`} alt={`${character.name} referans fotoğrafı`} /> : <span className="char-placeholder"><Users size={26} /></span>}
          <span className={`char-status char-status-${character.sheet.status}`}>{character.sheet.status === "producing" ? <LoaderCircle size={11} className="studio-spin" /> : null}{STATUS[character.sheet.status]}</span>
          {shown?.verdict ? <span className={`char-verdict ${shown.verdict.ok ? "is-ok" : ""}`}>{shown.verdict.ok ? <Check size={11} /> : <TriangleAlert size={11} />} Hakem {average(shown)!.toFixed(1)}/5</span> : null}
          <label className="char-select"><input type="checkbox" checked={selected.includes(character.id)} disabled={locked} onChange={(event) => setSelected(event.target.checked ? [...selected, character.id] : selected.filter((id) => id !== character.id))} aria-label={`${character.name} üretime dahil`} /></label>
        </div>
        <div className="char-body">
          <div className="char-title"><strong>{character.kind === "place" ? <MapPin size={12} aria-label="Mekân" /> : null}{character.name}</strong><span>{linked} çekim</span></div>
          <p className="char-appearance">{character.appearance || "Tarif yok."}</p>
          {character.aliases.length ? <div className="char-aliases">{character.aliases.map((alias) => <span key={alias}>{alias}</span>)}</div> : null}
          <div className="char-reference">
            {reference ? <>
              <img src={`/api/projects/${project.id}/media/${reference.file}`} alt="" />
              <span><strong>Referans</strong> {reference.license} · {reference.author}{reference.pageUrl ? <a href={reference.pageUrl} target="_blank" rel="noreferrer" aria-label="Kaynak sayfası"><ExternalLink size={11} /></a> : null}</span>
              <button type="button" aria-label="Referansı kaldır" disabled={locked} onClick={() => void run("unref", async () => apply(await send<{ project: Project }>(`${base}/${character.id}/reference`, json("DELETE", { revision: project.revision })), "Referans fotoğraf kaldırıldı."))}><X size={13} /></button>
            </> : <>
              <button type="button" className="char-link" disabled={locked} onClick={() => openSearch(character)}><Search size={12} /> Fotoğraf bul</button>
              <button type="button" className="char-link" disabled={locked} onClick={() => { uploadFor.current = character.id; uploadInput.current?.click(); }}><Upload size={12} /> Fotoğraf yükle</button>
              <span className="char-hint">Fotoğrafsız: Nano Banana 2.1 (GMI ücretli)</span>
            </>}
          </div>
          {attempts.length > 1 ? <div className="char-attempts" aria-label="Denemeler">{attempts.slice(-6).map((attempt) => <button key={attempt.id} type="button" className={attempt.id === shown?.id ? "is-shown" : ""} onClick={() => setViewing({ ...viewing, [character.id]: attempt.id })} title={attempt.verdict ? `${attempt.verdict.ok ? "Hakem onayladı" : "Hakem reddetti"} · ${attempt.verdict.note}` : "Hakem puanı yok"}><img src={attempt.url} alt="" />{attempt.verdict ? <span className={attempt.verdict.ok ? "is-ok" : ""}>{attempt.verdict.ok ? "✓" : "✗"}</span> : null}{attempt.engine === "repair" ? <em className="char-attempt-fix" aria-label="Onarılmış deneme">onarım</em> : null}</button>)}</div> : null}
          {shown?.verdict?.note || character.sheet.note ? <p className="char-note">{shown?.verdict?.note ? `Hakem: ${shown.verdict.note}` : ""}{shown?.verdict?.note && character.sheet.note ? " · " : ""}{character.sheet.note}</p> : null}
          <div className="char-actions">
            {shown && character.sheet.status !== "producing" && (character.sheet.status !== "approved" || shown.id !== character.sheet.chosen) ? <button type="button" className="studio-button studio-button-primary" disabled={locked} onClick={() => void run("approve", async () => apply(await send<{ project: Project }>(`${base}/${character.id}/review`, json("POST", { revision: project.revision, action: "approve", attemptId: shown.id })), `${character.name} onaylandı; sahneler bu sayfayı referans alacak.`))}><Check size={13} /> Onayla</button> : null}
            {shown && providers.gmi && character.sheet.status !== "producing" ? <button type="button" className="studio-button studio-button-secondary" disabled={locked} title="Sayfanın yalnızca işaretlediğin bölgesini yeniden çizdir" onClick={() => setRepairTarget({ kind: "character", character, attempt: shown })}><WandSparkles size={13} /> Bölgeyi onar</button> : null}
            {character.sheet.status === "review" ? <button type="button" className="studio-button studio-button-secondary" disabled={locked} onClick={() => void run("reject", async () => apply(await send<{ project: Project }>(`${base}/${character.id}/review`, json("POST", { revision: project.revision, action: "reject" })), "Karakter sayfası reddedildi."))}>Reddet</button> : null}
            <button type="button" className="studio-button studio-button-secondary" aria-label={`${character.name} düzenle`} disabled={locked} onClick={() => setDraft({ id: character.id, kind: character.kind, name: character.name, appearance: character.appearance, aliases: character.aliases.join(", "), style: character.style })}><Pencil size={13} /></button>
            <button type="button" className="studio-button studio-button-secondary" aria-label={`${character.name} sil`} disabled={locked} onClick={() => { if (window.confirm(`${character.name} ve üretilen sayfaları silinsin mi?`)) void run("delete", async () => apply(await send<{ project: Project }>(`${base}/${character.id}`, json("DELETE", { revision: project.revision })), "Karakter silindi.")); }}><Trash2 size={13} /></button>
          </div>
        </div>
      </article>;
    })}</div>}

    {error ? <p className="studio-dialog-error" role="alert">{error}</p> : null}
    {repairTarget ? <RepairDialog key={repairTarget.kind === "character" ? repairTarget.attempt.id : repairTarget.scene.id} project={project} target={repairTarget} onClose={() => setRepairTarget(null)} onStarted={(updated) => { onProjectChange(updated); setRepairTarget(null); notify("Onarım başladı: sayfanın yalnızca işaretli bölgesi yeniden çiziliyor."); }} /> : null}
    <input ref={uploadInput} type="file" accept="image/jpeg,image/png" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload(file); }} />

    <dialog ref={draftDialog} className="studio-scene-dialog char-dialog" onCancel={() => setDraft(null)} onClose={() => setDraft(null)} aria-labelledby="char-draft-title">
      {draft ? <form onSubmit={saveDraft}>
        <div className="studio-dialog-heading"><div><span className="studio-eyebrow">{draft.kind === "place" ? "MEKÂN" : "KARAKTER"}</span><h2 id="char-draft-title">{draft.kind === "place" ? (draft.id ? "Mekânı düzenle" : "Yeni mekân") : (draft.id ? "Karakteri düzenle" : "Yeni karakter")}</h2></div><button type="button" aria-label="Kapat" onClick={() => setDraft(null)}><X size={18} /></button></div>
        <div className="studio-dialog-fields">
          <label className="studio-field"><span>Ad</span><input value={draft.name} required maxLength={80} autoFocus onChange={(event) => setDraft({ ...draft, name: event.target.value })} /></label>
          <label className="studio-field"><span>Görünüş tarifi <small>{draft.kind === "place" ? "Mekân görseli bu tariften çizilir" : "Sayfa bu tariften çizilir"}; fotoğraf varsa ona ek olarak kullanılır</small></span><textarea rows={3} maxLength={1200} value={draft.appearance} onChange={(event) => setDraft({ ...draft, appearance: event.target.value })} placeholder={draft.kind === "place" ? "Örn. taş döşeli küçük liman, kırmızı balıkçı tekneleri, sabah sisi" : "Örn. askeri kasket, ince bıyık, ağırbaşlı ifade, haki ceket"} /></label>
          <label className="studio-field"><span>Çizim stili <small>Boşsa proje stili</small></span><input maxLength={400} value={draft.style} onChange={(event) => setDraft({ ...draft, style: event.target.value })} placeholder="Örn. stylized 3D caricature, Pixar-meets-political-cartoon" /></label>
          <label className="studio-field"><span>Çekimlerde geçen adları <small>Virgülle ayır; bu kelimelerin geçtiği çekimler karaktere bağlanır</small></span><input maxLength={600} value={draft.aliases} onChange={(event) => setDraft({ ...draft, aliases: event.target.value })} placeholder="Örn. Dudayev, Dzhokhar" /></label>
        </div>
        <div className="studio-dialog-footer"><span /><button className="studio-button studio-button-primary" type="submit" disabled={busy !== null}>{busy === "draft" ? <LoaderCircle size={14} className="studio-spin" /> : <Check size={14} />} Kaydet</button></div>
      </form> : null}
    </dialog>

    <dialog ref={searchDialog} className="studio-scene-dialog char-dialog char-search" onCancel={() => setSearchFor(null)} onClose={() => setSearchFor(null)} aria-labelledby="char-search-title">
      {searchFor ? <div>
        <div className="studio-dialog-heading"><div><span className="studio-eyebrow">{providers.deepseek ? "DEEPSEEK WEB ARAMA + WIKIMEDIA + OPENVERSE" : "WIKIMEDIA + OPENVERSE · LİSANSLI FOTOĞRAFLAR"}</span><h2 id="char-search-title">{searchFor.name} için fotoğraf</h2></div><button type="button" aria-label="Kapat" onClick={() => setSearchFor(null)}><X size={18} /></button></div>
        <form className="char-search-bar" onSubmit={search}><input value={query} onChange={(event) => setQuery(event.target.value)} aria-label="Arama" autoFocus /><button className="studio-button studio-button-secondary" type="submit" disabled={busy !== null || query.trim().length < 2}>{busy === "search" ? <LoaderCircle size={14} className="studio-spin" /> : <Search size={14} />} Ara</button><button className="studio-button studio-button-secondary" type="button" disabled={busy !== null || query.trim().length < 2} onClick={() => doSearch(query, true)}>Daha geniş ara</button></form>
        <form className="char-search-bar" onSubmit={addImageUrl}><input value={imageUrl} onChange={(event) => setImageUrl(event.target.value)} aria-label="Görsel adresi" placeholder="İnternette bulduğun görselin adresi (https://…)" /><button className="studio-button studio-button-secondary" type="submit" disabled={busy !== null || !/^https:\/\//i.test(imageUrl.trim())}>{busy === "url" ? <LoaderCircle size={14} className="studio-spin" /> : <Upload size={14} />} URL'den ekle</button></form>
        <p className="char-search-note"><Info size={13} /> Web araması, sitelerin bot engelleri ve arama motoru kullanım koşulları nedeniyle uygulama içinde yapılmaz. Görseli tarayıcında bul, doğrudan görsel adresini yapıştır; sunucu yalnızca https ve genel internet adreslerinden indirir. Telif ve kişilik hakları senin sorumluluğunda; kaynak adresi referansla birlikte saklanır.</p>
        <div className="char-aliases" role="group" aria-label="Kaynak filtresi">{([["all", "Tümü"], ["wikimedia", "Wikimedia"], ["openverse", "Openverse"]] as const).map(([id, label]) => <button key={id} type="button" aria-pressed={sourceFilter === id} className={sourceFilter === id ? "is-shown" : ""} onClick={() => setSourceFilter(id)}>{label}</button>)}</div>
        {suggestions.length > 1 ? <div className="char-aliases" aria-label="Arama önerileri">{suggestions.map((item) => <button key={item} type="button" disabled={busy !== null} onClick={() => { setQuery(item); doSearch(item); }}>{item}</button>)}</div> : null}
        {warnings.map((item) => <p key={item} className="char-search-note"><TriangleAlert size={13} /> {item}</p>)}
        <p className="char-search-note"><ShieldCheck size={13} /> Doğru kişiyi sen seç: aynı adda başka biri ya da yanlış etiketli bir fotoğraf olabilir. Lisans fotoğrafın telif durumunu gösterir; fotoğraftaki kişinin kişilik haklarını kapsamaz.</p>
        {research && (research.summary || research.appearance) ? <div className="char-estimate" style={{ marginBottom: 12 }}>
          <div><strong>DeepSeek web araştırması</strong><span>{research.summary}{research.appearance ? ` · Görünüş: ${research.appearance}` : ""}</span>{research.appearance || research.aliases.length ? <em><button type="button" className="studio-button studio-button-secondary" disabled={busy !== null} onClick={applyResearch}>Tarifi uygula</button></em> : null}</div>
        </div> : null}
        {results === null ? null : !results.length ? <p className="char-bank-empty">Sonuç bulunamadı. Önerilerden birini dene veya Daha geniş ara.</p> : <><p className="char-search-note">{results.filter((r) => sourceFilter === "all" || (r.source ?? "wikimedia") === sourceFilter).length} sonuç · Wikimedia + Openverse</p><div className="char-results">{results.filter((r) => sourceFilter === "all" || (r.source ?? "wikimedia") === sourceFilter).map((result) => <button key={`${result.source ?? "wikimedia"}-${result.id ?? result.title}`} type="button" disabled={busy !== null} onClick={() => pick(result)}><img src={result.thumbUrl} alt={result.title} loading="lazy" /><span><strong>{result.title.replace(/^File:/, "").replace(/\.[a-z]+$/i, "")}</strong><small>{result.source === "openverse" ? "Openverse" : "Wikimedia"} · {result.license} · {result.author}</small></span></button>)}</div></>}
        {busy === "pick" ? <p className="char-search-note"><LoaderCircle size={13} className="studio-spin" /> Fotoğraf indiriliyor…</p> : null}
      </div> : null}
    </dialog>

    <dialog ref={estimateDialog} className="studio-scene-dialog char-dialog" onCancel={() => setEstimate(null)} onClose={() => setEstimate(null)} aria-labelledby="char-estimate-title">
      {estimate ? <div>
        <div className="studio-dialog-heading"><div><span className="studio-eyebrow">ONAYINDAN ÖNCE</span><h2 id="char-estimate-title">Karakter sayfaları</h2></div><button type="button" aria-label="Kapat" onClick={() => setEstimate(null)}><X size={18} /></button></div>
        <div className="char-estimate">
          {estimate.lines.map((line) => {
            const hasRef = Boolean(characters.find((character) => character.id === line.characterId)?.reference);
            return <div key={line.characterId}><strong>{line.name}</strong><span>{`Nano Banana 2.1 · ${hasRef ? "fotoğraftan" : "tariften"} · ${line.maxAttempts} × ${usd(line.unitCost)}`}</span><em>{line.maxCost ? `en fazla ${usd(line.maxCost)}` : "0 $"}</em></div>;
          })}
          {estimate.total > 0 ? <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginTop: 6 }}>
            <label className="paid-field" style={{ flex: 1, minWidth: 180 }}>
              <span>Proje bütçe tavanı ($)</span>
              <input type="number" min={1} max={10000} step={0.5} value={budget} disabled={busy !== null} onChange={(event) => setBudget(event.target.value)} />
            </label>
            <button type="button" className="studio-button studio-button-secondary" disabled={busy !== null} onClick={() => priceRun(Number(budget.replace(",", ".")))}>Bütçeyi uygula</button>
          </div> : null}
          {estimate.problems.map((problem) => <p key={problem} className="paid-errors"><TriangleAlert size={12} /> {problem}</p>)}
          <p className="char-estimate-total">En yüksek tutar <strong>{usd(estimate.total)}</strong>{estimate.budget !== null ? ` · kalan bütçe ${usd(Math.max(0, estimate.remaining))}` : ""}</p>
          <p className="char-search-note"><ShieldCheck size={13} /> Karakter başına en fazla {estimate.lines[0]?.maxAttempts ?? 3} deneme yapılır; hakem onaylarsa erken durur ve kullanılmayan tutar bütçeye döner. Model reddederse istek değiştirilip yeniden gönderilmez, sebebi gösterilir.</p>
        </div>
        <div className="studio-dialog-footer"><span /><button className="studio-button studio-button-primary" type="button" disabled={busy !== null || !estimate.withinBudget} onClick={startRun}>{busy === "start" ? <LoaderCircle size={14} className="studio-spin" /> : <ImagePlus size={14} />} {estimate.total ? `Onayla ve üret · en fazla ${usd(estimate.total)}` : "Ücretsiz üret"}</button></div>
      </div> : null}
    </dialog>
  </section>;
}
