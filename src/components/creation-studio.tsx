"use client";

import Image from "next/image";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import { Aperture, ArrowRight, AtSign, Camera, Check, ChevronDown, Clapperboard, Clock3, Film, FolderOpen, ImageIcon, Layers3, Lightbulb, LoaderCircle, Minus, Palette, Plus, Save, ShieldCheck, SlidersHorizontal, Sparkles, TriangleAlert, Volume2, VolumeX, X } from "lucide-react";
import { CAMERA_MOVES, GENRES, LOOKS, PRESETS, presetOf } from "@/lib/cinema";
import { FRAME_MODELS } from "@/lib/routing/frame-router";
import { compileHiggsfieldPrompt, defaultStudioDraft, HIGGSFIELD_VFX_PRESETS, insertElementMention, LIGHTING, LENSES, NANO_BANANA_TEMPLATES, restoreStudioDraft, studioProjectInput, type HiggsfieldPromptBuilderInput, type StudioDraft, type StudioLaunch, type StudioView } from "@/lib/studio-draft";
import type { Project, ProviderStatus, VideoModelOption } from "@/lib/types";

async function requestProject(url: string, body: unknown, key?: string): Promise<Project> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
  const result = await response.json() as { project?: Project; error?: string };
  if (!response.ok || !result.project) throw new Error(result.error ?? "İşlem tamamlanamadı.");
  return result.project;
}
const money = (value: number) => `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 4 })} $`;
type Panel = "film" | "camera" | "palette" | "light" | "references" | "prompt-guide" | null;

const DEFAULT_ELEMENTS = [
  { name: "Gezgin", role: "Karakter · Mavi pelerinli dağ yolcusu" },
  { name: "Dedektif", role: "Karakter · Yağmurlu gece trençkotlu" },
  { name: "Kozmonot", role: "Karakter · Yörünge mühendisi" },
  { name: "DenizFeneri", role: "Mekân · Sisli kayalık kıyı" },
];

export default function CreationStudio({ view, launch, projects, providers, videoModels, onProjectChange, onOpen, onNavigate, onNew, notify }: {
  view: "image" | "video" | "cinema"; launch?: StudioLaunch; projects: Project[]; providers: ProviderStatus; videoModels: VideoModelOption[];
  onProjectChange: (project: Project) => void; onOpen: (project: Project, step?: "story" | "cast" | "scenes" | "film") => void; onNavigate: (view: StudioView) => void; onNew: () => void; notify: (message: string) => void;
}) {
  const cinema = view === "cinema";
  const [draft, setDraft] = useState(() => defaultStudioDraft(view === "image" ? "image" : "video", launch));
  const [ready, setReady] = useState(false);
  const [panel, setPanel] = useState<Panel>(null);
  const [showElements, setShowElements] = useState(false);
  const [promptBuilder, setPromptBuilder] = useState<HiggsfieldPromptBuilderInput>({
    subject: "@Gezgin rüzgârdan yıpranmış mavi pelerinli genç araştırmacı",
    action: "antik saat mekanizmasının dişlileri arasında ilerler",
    location: "sisli kıyıdaki terk edilmiş deniz feneri",
    composition: "35mm orta-yakın plan, asimetrik sinematik kadraj",
    style: "70s gritty film dokusu, yüksek kontrast",
    cameraGear: "full-frame cinema camera, 85mm anamorphic lens, f/1.4",
    quotedText: "",
    negativeConstraints: "bulanık yüz, bozuk el anatomisi, yapay plastik cilt",
  });
  const [budget, setBudget] = useState("10");
  const [busy, setBusy] = useState<"save" | "quote" | "run" | null>(null);
  const [error, setError] = useState("");
  const [uncertain, setUncertain] = useState(false);
  const [uncertainRun, setUncertainRun] = useState(false);
  const [prepared, setPrepared] = useState<{ project: Project; fingerprint: string } | null>(null);
  const [showQuote, setShowQuote] = useState(false);
  const [now, setNow] = useState(() => Date.now());
  const [history, setHistory] = useState(false);
  const [storageNote, setStorageNote] = useState("");
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const quoteDialog = useRef<HTMLDialogElement>(null);
  const submitting = useRef(false);
  const requestKey = useRef("");
  const storageKey = `kadra.creation.${view}.v1`;
  const fingerprint = JSON.stringify({ draft, budget });
  const activeProject = prepared ? projects.find((project) => project.id === prepared.project.id) ?? prepared.project : null;
  const quote = activeProject?.quote;
  const expired = quote ? Date.parse(quote.expiresAt) <= now : false;
  const validQuote = quote && prepared?.fingerprint === fingerprint && !expired && quote.withinBudget && !quote.errors.length && quote.target === (draft.mode === "image" ? "frames" : "film");
  const running = activeProject?.run?.status === "running";
  const finished = activeProject?.run?.status === "completed";
  const recent = projects.filter((project) => project.scenes.some((scene) => scene.imageSource === "generated") || project.output).slice(0, 6);
  const shots = studioProjectInput(draft, null).shots.length;

  const availableElements = useMemo(() => {
    const map = new Map<string, { name: string; role: string }>();
    for (const project of projects) {
      for (const char of project.characters) {
        if (!map.has(char.name)) {
          map.set(char.name, {
            name: char.name,
            role: `${char.kind === "place" ? "Mekân" : "Karakter"} · ${project.title}`,
          });
        }
      }
    }
    for (const fallback of DEFAULT_ELEMENTS) {
      if (!map.has(fallback.name)) map.set(fallback.name, fallback);
    }
    return Array.from(map.values()).slice(0, 10);
  }, [projects]);

  useEffect(() => {
    if (!launch) {
      try { const raw = localStorage.getItem(storageKey); if (raw) setDraft(restoreStudioDraft(JSON.parse(raw), defaultStudioDraft(view === "image" ? "image" : "video"))); }
      catch { setStorageNote("Kaydedilmiş taslak okunamadı; yeni bir taslak açıldı."); }
    }
    setReady(true);
  }, [storageKey, view, launch]);
  useEffect(() => {
    if (!ready) return;
    try { localStorage.setItem(storageKey, JSON.stringify(draft)); }
    catch { setStorageNote("Tarayıcı taslağı saklayamadı. Projeye kaydederek devam edebilirsin."); }
  }, [draft, ready, storageKey]);
  useEffect(() => { if (panel) settingsDialog.current?.showModal(); else settingsDialog.current?.close(); }, [panel]);
  useEffect(() => { if (showQuote) quoteDialog.current?.showModal(); else quoteDialog.current?.close(); }, [showQuote]);
  useEffect(() => { if (!showQuote) return; const timer = setInterval(() => setNow(Date.now()), 10000); return () => clearInterval(timer); }, [showQuote]);

  function update<K extends keyof StudioDraft>(key: K, value: StudioDraft[K]) { setDraft((current) => ({ ...current, [key]: value })); setError(""); }
  function choosePreset(id: string) { const preset = presetOf(id); setDraft((current) => ({ ...current, presetId: id, genre: preset?.genre === "general" ? "" : preset?.genre ?? "", look: preset?.look ?? "none" })); }

  async function persist(): Promise<Project> {
    if (prepared?.fingerprint === fingerprint) return activeProject!;
    let response: Response;
    try { response = await fetch("/api/projects/import", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(studioProjectInput(draft, Number(budget))) }); }
    catch { setUncertain(true); throw new Error("Kaydetmenin sonucu doğrulanamadı. Yeniden oluşturmadan önce Projelerim bölümünü kontrol et."); }
    const payload = await response.json().catch(() => null) as { project?: Project; error?: string } | null;
    if (!response.ok || !payload?.project) {
      if (response.status >= 500 || !payload) setUncertain(true);
      throw new Error(payload?.error ?? "Proje kaydedilemedi. Projelerim bölümünden sonucu kontrol et.");
    }
    setPrepared({ project: payload.project, fingerprint });
    onProjectChange(payload.project);
    return payload.project;
  }

  function validate() {
    if (draft.prompt.trim().length < 10) { setError("Sahneni en az 10 karakterle anlat."); return false; }
    const parsed = Number(budget);
    if (!budget.trim() || !Number.isFinite(parsed) || parsed < 0 || parsed > 100000) { setError("0 ile 100.000 USD arasında bir bütçe gir."); return false; }
    return true;
  }

  async function save(step: "story" | "cast" | "scenes" = "scenes") {
    if (submitting.current || uncertain || !validate()) return;
    submitting.current = true; setBusy("save"); setError("");
    try { const project = await persist(); notify("Taslak projeye kaydedildi."); onOpen(project, step); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Taslak kaydedilemedi."); }
    finally { submitting.current = false; setBusy(null); }
  }

  async function price(event: FormEvent) {
    event.preventDefault();
    if (submitting.current || uncertain || !validate()) return;
    if (!providers.gmi) { setError("Üretim servisi bağlı değil. Taslağını kaydedebilir veya Bağlantılar bölümünü açabilirsin."); return; }
    submitting.current = true; setBusy("quote"); setError(""); setUncertainRun(false);
    try {
      const project = await persist();
      const updated = await requestProject(`/api/projects/${project.id}/quote`, { target: draft.mode === "image" ? "frames" : "film", revision: project.revision, quality: draft.quality, budget: Number(budget), referenceFrames: true, frameModel: draft.frameModel || null, selections: draft.mode === "image" ? [] : project.scenes.map((scene) => ({ sceneId: scene.id, motion: "ai", videoModel: draft.videoModel || null })) });
      setPrepared({ project: updated, fingerprint }); onProjectChange(updated); requestKey.current = crypto.randomUUID(); setNow(Date.now()); setShowQuote(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Fiyat alınamadı."); }
    finally { submitting.current = false; setBusy(null); }
  }

  async function approve() {
    if (submitting.current || !activeProject || !validQuote || uncertainRun) return;
    submitting.current = true; setBusy("run"); setError("");
    try {
      const updated = await requestProject(`/api/projects/${activeProject.id}/run`, { target: draft.mode === "image" ? "frames" : "film", mode: "paid", revision: activeProject.revision, quoteId: quote!.id }, requestKey.current);
      onProjectChange(updated); setPrepared({ project: updated, fingerprint }); setShowQuote(false); notify("Üretim başladı. İlerlemeyi Üretimler bölümünden takip edebilirsin.");
    } catch (cause) { setUncertainRun(true); setError(`${cause instanceof Error ? cause.message : "Üretim yanıtı alınamadı."} Yeniden başlatmadan önce Üretimler bölümünden durumu kontrol et.`); }
    finally { submitting.current = false; setBusy(null); }
  }

  const composer = <form className={`hf-composer ${cinema ? "is-cinema" : "is-standard"}`} onSubmit={(event) => void price(event)} aria-busy={busy !== null}>
    {!cinema ? <div className="hf-create-tabs" role="group" aria-label="Üretim türü"><button type="button" aria-pressed={draft.mode === "image"} onClick={() => update("mode", "image")}><ImageIcon size={16} />Görsel · Soul</button><button type="button" aria-pressed={draft.mode === "video"} onClick={() => update("mode", "video")}><Film size={16} />Video · Omni</button><button type="button" onClick={() => onNavigate("popcorn")}><Layers3 size={15} />Popcorn</button></div> : null}
    {!cinema ? <div className={`hf-model-cover preset-${draft.presetId}`}><Image src={draft.mode === "image" ? "/images/desert.jpg" : "/images/mountains.jpg"} alt="" fill sizes="340px" /><span><small>{draft.mode === "image" ? "KADRA SOUL CINEMA 2.0" : "OMNI REFERENCE · AI VIDEO"}</small><strong>{presetOf(draft.presetId)?.label ?? "Serbest tarz"}</strong></span><button type="button" onClick={() => setPanel("film")}><SlidersHorizontal size={13} />Değiştir</button></div> : null}
    <div className="hf-cinematic-controls">
      <button type="button" onClick={() => setPanel("references")}><span className="hf-control-art"><Plus size={21} /></span><span><small>Referanslar</small><strong>0/50 · Ekle</strong></span></button>
      <button type="button" onClick={() => setPanel("film")}><span className="hf-control-art control-film"><Clapperboard size={22} /></span><span><small>Film kurulumu</small><strong>{GENRES.find((item) => item.id === draft.genre)?.label ?? "Otomatik"}</strong></span></button>
      <button type="button" onClick={() => setPanel("camera")}><span className="hf-control-art control-camera"><Camera size={22} /></span><span><small>Kamera</small><strong>{LENSES.find((item) => item.id === draft.lens)?.label ?? "Otomatik"}</strong></span></button>
      <button type="button" onClick={() => setPanel("palette")}><span className={`hf-control-art control-palette palette-${draft.look}`}><Palette size={22} /></span><span><small>Renk paleti</small><strong>{LOOKS.find((item) => item.id === draft.look)?.label ?? "Doğal"}</strong></span></button>
      <button type="button" onClick={() => setPanel("light")}><span className="hf-control-art control-light"><Lightbulb size={22} /></span><span><small>Işık</small><strong>{LIGHTING.find((item) => item.id === draft.lighting)?.label ?? "Otomatik"}</strong></span></button>
    </div>
    <div className="hf-prompt-area">
      <label className="sr-only" htmlFor="studio-prompt">Sahneni anlat</label>
      <textarea
        id="studio-prompt"
        rows={cinema ? 3 : 5}
        value={draft.prompt}
        maxLength={4000}
        placeholder={draft.multiShot ? "Her çekimi ayrı bir paragrafta anlat veya @ ile karakter ve mekân ekle…" : "Sahneni anlat, @ kullanarak karakter ve mekân referanslarını ekle…"}
        disabled={busy !== null || uncertain || running}
        onChange={(event) => update("prompt", event.target.value)}
        onKeyDown={(event) => {
          if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
            event.preventDefault();
            event.currentTarget.form?.requestSubmit();
          }
        }}
      />
      <span className="hf-prompt-count">{draft.prompt.length.toLocaleString("tr")} / 4.000</span>
    </div>
    {showElements ? (
      <div className="hf-elements-bar" role="region" aria-label="@Elements karakter ve mekân seçici">
        <div className="hf-elements-bar-head">
          <span><AtSign size={12} /> Karakter ve mekân ekle (@Elements)</span>
          <button type="button" onClick={() => setShowElements(false)} aria-label="Karakter seçiciyi kapat"><X size={13} /></button>
        </div>
        <div className="hf-elements-chips">
          {availableElements.map((item) => (
            <button
              key={item.name}
              type="button"
              title={item.role}
              onClick={() => update("prompt", insertElementMention(draft.prompt, item.name))}
            >
              <strong>@{item.name}</strong>
              <small>{item.role}</small>
            </button>
          ))}
        </div>
      </div>
    ) : null}
    <div className="hf-composer-toolbar">
      <button type="button" className="hf-small-control" aria-label="Karakter veya mekân etiketle (@)" title="@ Karakter ve mekân ekle" aria-pressed={showElements} onClick={() => setShowElements((current) => !current)}>
        <AtSign size={14} /><span>Karakter</span>
      </button>
      <button type="button" className="hf-small-control" aria-label="6 Değişkenli Prompt Mimarı" title="Higgsfield 6 Değişkenli Prompt Mimarı" onClick={() => setPanel("prompt-guide")}>
        <Sparkles size={14} /><span>6 Değişken</span>
      </button>
      <button type="button" className="hf-small-control" aria-label="Örnek fikir ekle" title="Örnek fikir" onClick={() => update("prompt", (presetOf(draft.presetId) ?? PRESETS[0]).idea)}>
        <Sparkles size={15} />
      </button>
      <label className="hf-select-control hf-model-select">
        <span className="sr-only">Görsel modeli</span>
        <ImageIcon size={14} />
        <select aria-label="Görsel modeli" value={draft.frameModel} onChange={(event) => update("frameModel", event.target.value)}>
          <option value="">Görsel modeli · Otomatik</option>
          {FRAME_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
        </select>
        <ChevronDown size={12} />
      </label>
      {draft.mode === "video" ? (
        <label className="hf-select-control hf-model-select">
          <Film size={14} />
          <select aria-label="Video modeli" value={draft.videoModel} onChange={(event) => update("videoModel", event.target.value)}>
            <option value="">Video · Otomatik</option>
            {videoModels.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}
          </select>
          <ChevronDown size={12} />
        </label>
      ) : null}
      <label className="hf-select-control">
        <span className="ratio-glyph" />
        <select aria-label="Ekran oranı" value={draft.aspectRatio} onChange={(event) => update("aspectRatio", event.target.value as StudioDraft["aspectRatio"])}>
          <option>16:9</option>
          <option>9:16</option>
          <option>1:1</option>
        </select>
        <ChevronDown size={12} />
      </label>
      <label className="hf-select-control">
        <select aria-label="Kalite katmanı" value={draft.quality} onChange={(event) => update("quality", event.target.value as StudioDraft["quality"])}>
          <option value="economy">Ekonomik</option>
          <option value="balanced">Dengeli</option>
          <option value="best">Kalite öncelikli</option>
        </select>
        <ChevronDown size={12} />
      </label>
      {draft.mode === "video" ? (
        <label className="hf-select-control">
          <Clock3 size={14} />
          <select aria-label="Çekim süresi" value={draft.duration} onChange={(event) => update("duration", Number(event.target.value))}>
            {[3, 4, 5, 6, 8, 10, 12, 15].map((seconds) => <option key={seconds} value={seconds}>{seconds} sn</option>)}
          </select>
        </label>
      ) : null}
      {draft.mode === "video" ? (
        <button type="button" className="hf-small-control" aria-pressed={draft.withVoiceover} title="Dış ses ve atmosfer ipucu ekle" onClick={() => update("withVoiceover", !draft.withVoiceover)}>
          {draft.withVoiceover ? <Volume2 size={14} /> : <VolumeX size={14} />}
          <span>{draft.withVoiceover ? "Ses açık" : "Sessiz"}</span>
        </button>
      ) : null}
    </div>
    <div className="hf-composer-bottom">
      <label className="hf-budget"><span>Bütçe sınırı</span><div><input aria-label="Bütçe sınırı USD" type="number" min="0" max="100000" step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} /><span>USD</span></div></label>
      <div className="hf-shot-stepper" role="group" aria-label="Çekim sayısı">
        <button type="button" aria-label="Çekim sayısını azalt" disabled={draft.shotCount <= 1} onClick={() => update("shotCount", Math.max(1, draft.shotCount - 1))}><Minus size={12} /></button>
        <span>{shots}/8 çekim</span>
        <button type="button" aria-label="Çekim sayısını artır" disabled={draft.shotCount >= 8} onClick={() => update("shotCount", Math.min(8, draft.shotCount + 1))}><Plus size={12} /></button>
      </div>
      {draft.mode === "video" ? <button type="button" className="hf-small-control hf-multishot" aria-pressed={draft.multiShot} onClick={() => update("multiShot", !draft.multiShot)}><Layers3 size={14} />{draft.multiShot ? "Çoklu paragraf" : "Tek metin"}</button> : null}
      <button type="submit" className="hf-generate" disabled={!ready || draft.prompt.trim().length < 10 || busy !== null || uncertain || running}>{busy === "quote" ? <LoaderCircle size={17} className="spin" /> : <Sparkles size={17} />}<span>{busy === "quote" ? "Fiyat alınıyor…" : "FİYATI GÖR"}<small>{draft.mode === "image" ? `${shots} görsel oluştur` : `${shots} çekim video`}</small></span></button>
    </div>
    <div className="hf-composer-notes"><span><ShieldCheck size={12} />Fiyatı onayladıktan sonra üretim başlar.</span><button type="button" disabled={busy !== null || uncertain || running || draft.prompt.trim().length < 10} onClick={() => void save()}>{busy === "save" ? <LoaderCircle size={13} className="spin" /> : <Save size={13} />}Taslağı kaydet</button></div>
  </form>;

  return <div className={`hf-creation ${cinema ? "creation-cinema" : "creation-standard"}`}>
    {cinema ? <><div className="cinema-intro"><div className="cinema-film-fan" aria-hidden="true">{["/images/desert.jpg", "/images/mountains.jpg", "/images/space.jpg"].map((src, index) => <div className={`cinema-film-sample sample-${index}`} key={src}><Image src={src} alt="" fill sizes="280px" preload={index === 1} /><span>{["THE LAST LIGHT", "BEYOND THE FRAME", "ANOTHER WORLD"][index]}</span></div>)}</div><span className="hf-eyebrow">KADRA CINEMA STUDIO 4.0</span><h1>HİKÂYELERİNE HAYAT VER.</h1><p>Her çekimi hayal et. Kamera, lens, ışık ve @Karakter referanslarını tek yerden yönet.</p></div><div className="cinema-create-wrap"><div className="cinema-mode-switch" role="group" aria-label="Cinema Studio üretim türü"><button type="button" aria-pressed={draft.mode === "image"} onClick={() => update("mode", "image")}><ImageIcon size={18} />Görsel</button><button type="button" aria-pressed={draft.mode === "video"} onClick={() => update("mode", "video")}><Film size={18} />Video</button></div>{composer}</div></> : <div className="hf-standard-controls">{composer}</div>}
    <div className="hf-creation-main">
      {error ? <div className="alert" role="alert"><TriangleAlert size={17} /><span>{error}</span>{uncertain || uncertainRun ? <button type="button" className="button button-small" onClick={() => onNavigate(uncertainRun ? "queue" : "projects")}>Durumu kontrol et</button> : <button type="button" className="icon-button" aria-label="Hatayı kapat" onClick={() => setError("")}><X size={15} /></button>}</div> : null}
      {storageNote ? <p className="quiet" role="status">{storageNote}</p> : null}
      {running || finished ? <div className="hf-production-status" role="status"><span className={running ? "spin" : ""}>{running ? <LoaderCircle size={20} /> : <Check size={20} />}</span><div><strong>{running ? `Üretiliyor · %${Math.round(activeProject?.run?.progress ?? 0)}` : "Üretim tamamlandı"}</strong><p>{activeProject?.title}</p></div><button type="button" className="button" onClick={() => onNavigate(running ? "queue" : "library")}>{running ? "Üretimleri aç" : "Arşivde gör"}<ArrowRight size={15} /></button></div> : null}
      {!cinema ? <div className="hf-filter-tabs hf-creation-tabs" role="group" aria-label="Stüdyo görünümü"><button type="button" aria-pressed={!history} onClick={() => setHistory(false)}><Clapperboard size={14} />{draft.mode === "image" ? "Soul Cinema Vitrin" : "Nasıl çalışır?"}</button><button type="button" aria-pressed={history} onClick={() => setHistory(true)}><FolderOpen size={14} />Geçmiş</button></div> : null}
      {!cinema && !history ? <div className="hf-how-it-works">
        <span className="hf-eyebrow">{draft.mode === "image" ? "KADRA SOUL CINEMA 2.0" : "OMNI REFERENCE · VİDEO MOTORU"}</span>
        <h1>{draft.mode === "image" ? "SOUL CINEMA İLE SİNEMATİK KARELER." : "KARELERİNİ HAREKETE GEÇİR."}</h1>
        <p>{draft.mode === "image" ? "Anamorfik optikler, gerçekçi cilt dokusu ve @Karakter tutarlılığıyla ilk kareni oluştur." : "Referans görselini veya @Karakterini seç, kamera hareketini kur ve videonu üret."}</p>
        <div className="hf-soul-pills" role="group" aria-label="Hızlı sahne şablonları">
          {[
            { label: "35mm Portre", prompt: "Yağmurlu gece neon yansımaları altında @Dedektif yakın plan portresi, 85mm anamorfik lens, sığ alan derinliği." },
            { label: "Epik Kurucu Plan", prompt: "Sisli vadide yükselen antik fenerin önünde duran @Gezgin, altın saat güneş kırılması, 24mm geniş sinema lensi." },
            { label: "Bilimkurgu Kare", prompt: "Yörünge istasyonunun cam kubbesinden Dünya'ya bakan @Kozmonot, soğuk mavi-turuncu renk paleti, IMAX kadraj." },
          ].map((sample) => (
            <button key={sample.label} type="button" className="chip" onClick={() => update("prompt", sample.prompt)}>
              <Sparkles size={12} /> {sample.label}
            </button>
          ))}
        </div>
        <div className="hf-how-grid">{[
          { icon: ImageIcon, title: draft.mode === "image" ? "REFERANS & @KARAKTER EKLE" : "GÖRSEL VEYA @ELEMENT EKLE", text: "Karakterini, mekânı ve istediğin atmosferi @ etiketleriyle yaz.", image: "/images/desert.jpg" },
          { icon: SlidersHorizontal, title: "LENS, IŞIK & MODEL SEÇ", text: "Anamorfik lens, diyafram, renk paleti ve çekim adedini (1–8) belirle.", image: "/images/mountains.jpg" },
          { icon: Sparkles, title: "FİYATI ONAYLA & ÜRET", text: "Canlı GMI fiyat teklifini gör, onayla ve üretimini takip et.", image: "/images/space.jpg" },
        ].map((item, index) => <article key={item.title}><div><Image src={item.image} alt="" fill sizes="(max-width: 900px) 90vw, 25vw" fetchPriority="low" /><span>{String(index + 1).padStart(2, "0")}</span><item.icon size={32} /></div><h2>{item.title}</h2><p>{item.text}</p></article>)}</div>
        <button type="button" className="hf-text-link" onClick={() => onNavigate("effects")}>Bir tarzdan başla <ArrowRight size={16} /></button>
      </div> : <section className="hf-creation-projects"><div className="hf-section-head"><h2>{cinema ? "Projelerim" : "Son üretimler"}</h2><button type="button" className="hf-text-link" onClick={() => onNavigate(cinema ? "projects" : "library")}>Tümünü gör <ArrowRight size={14} /></button></div><div className="hf-project-grid">{cinema ? <button type="button" className="hf-project-new" onClick={onNew}><span><Plus size={23} /></span><strong>Yeni proje oluştur</strong></button> : null}{(cinema ? projects.slice(0, 5) : recent).map((project) => <button key={project.id} type="button" className="hf-project-tile" onClick={() => onOpen(project)}><span className="hf-project-image"><Image src={project.cover} alt="" fill sizes="(max-width: 700px) 50vw, 25vw" fetchPriority="low" unoptimized={project.cover.startsWith("/api/")} /><span>{project.isExample ? "ÖRNEK" : project.output ? "FİLM HAZIR" : `${project.scenes.length} SAHNE`}</span></span><strong>{project.title}</strong><small>{project.aspectRatio} · {project.style}</small></button>)}</div>{!cinema && !recent.length ? <div className="hf-empty"><ImageIcon size={32} /><h2>İlk üretimin burada görünecek</h2><p>Soldaki alana bir fikir yazarak başla.</p></div> : null}</section>}
    </div>

    <dialog
      ref={settingsDialog}
      {...({ closedby: "any" } as Record<string, string>)}
      className={`sheet hf-settings-dialog ${panel === "camera" || panel === "prompt-guide" ? "sheet-wide" : ""}`}
      aria-labelledby="studio-settings-title"
      onCancel={() => setPanel(null)}
      onClick={(event) => {
        const dialog = event.currentTarget;
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          setPanel(null);
        }
      }}
    ><div className="sheet-head"><h2 id="studio-settings-title">{panel === "film" ? "Film ayarları" : panel === "camera" ? "Kamera & VFX Hareketleri" : panel === "palette" ? "Renk paleti" : panel === "light" ? "Işık" : panel === "prompt-guide" ? "6 Değişkenli Prompt Mimarı (Nano Banana Pro & Cinema Studio)" : "Referanslar"}</h2><button type="button" className="icon-button" aria-label="Ayarları kapat" onClick={() => setPanel(null)}><X size={20} /></button></div><div className="sheet-body">{panel === "film" ? <><label className="field"><span>Görsel tarz</span><select value={draft.presetId} onChange={(event) => choosePreset(event.target.value)}>{PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}</select></label><label className="field"><span>Film türü</span><select value={draft.genre} onChange={(event) => update("genre", event.target.value)}>{GENRES.map((genre) => <option key={genre.id} value={genre.id}>{genre.label}</option>)}</select></label><div className="field-row"><label className="field"><span>Dönem</span><select value={draft.era} onChange={(event) => update("era", event.target.value)}><option value="">Otomatik</option>{["1960s", "1980s", "1990s", "2020s"].map((era) => <option key={era}>{era}</option>)}</select></label><label className="field"><span>Ritim</span><select value={draft.pacing} onChange={(event) => update("pacing", event.target.value)}><option value="">Otomatik</option><option value="calm">Sakin</option><option value="dynamic">Dinamik</option><option value="single">Tek plan</option></select></label></div></> : panel === "camera" ? <><div className="hf-camera-columns"><fieldset><legend><Camera size={16} />KAMERA HAREKETİ</legend>{CAMERA_MOVES.map((move) => <button type="button" key={move.id} aria-pressed={draft.camera === move.id} onClick={() => update("camera", move.id)}><span><Camera size={24} /></span>{move.label}{draft.camera === move.id ? <Check size={14} /> : null}</button>)}</fieldset><fieldset><legend><Aperture size={16} />LENS</legend>{LENSES.map((lens) => <button type="button" key={lens.id} aria-pressed={draft.lens === lens.id} onClick={() => update("lens", lens.id)}><span className="hf-lens-art"><i /></span>{lens.label}{draft.lens === lens.id ? <Check size={14} /> : null}</button>)}</fieldset><fieldset><legend><Aperture size={16} />DİYAFRAM</legend>{[{ id: "", label: "Otomatik" }, { id: "f/1.4", label: "f/1.4 · Sığ odak" }, { id: "f/4", label: "f/4 · Dengeli" }, { id: "f/11", label: "f/11 · Derin odak" }].map((item) => <button type="button" key={item.id} aria-pressed={draft.aperture === item.id} onClick={() => update("aperture", item.id)}><span><Aperture size={28} /></span>{item.label}{draft.aperture === item.id ? <Check size={14} /> : null}</button>)}</fieldset></div><div className="hf-elements-bar"><div className="hf-elements-bar-head"><span><Sparkles size={13} /> HIGGSFIELD GENJUTSU &amp; KATANA VFX KAMERA ŞABLONLARI</span><small>Tıkla, kamera ve VFX yönergesi eklensin</small></div><div className="hf-elements-chips">{HIGGSFIELD_VFX_PRESETS.map((vfx) => <button key={vfx.id} type="button" onClick={() => { update("camera", vfx.camera); if (!draft.prompt.includes(vfx.promptDirective)) update("prompt", `${draft.prompt.trim() ? `${draft.prompt.trim()}, ` : ""}${vfx.promptDirective}`); }}><strong>{vfx.title}</strong><small>{vfx.badge}</small></button>)}</div></div><p className="quiet">Lens, diyafram ve VFX seçimleri görsel yönlendirme olarak prompta eklenir.</p></> : panel === "palette" ? <div className="hf-palette-options">{LOOKS.map((look) => <button type="button" key={look.id} className={`palette-${look.id}`} aria-pressed={draft.look === look.id} onClick={() => update("look", look.id)}><span className="hf-palette-swatch"><i /><i /><i /><i /><i /></span><strong>{look.label}</strong><small>{look.hint}</small>{draft.look === look.id ? <Check size={16} /> : null}</button>)}</div> : panel === "light" ? <div className="hf-light-options">{LIGHTING.map((light) => <button type="button" key={light.id} className={`light-${light.id || "auto"}`} aria-pressed={draft.lighting === light.id} onClick={() => update("lighting", light.id)}><span><Lightbulb size={32} /></span><strong>{light.label}</strong>{draft.lighting === light.id ? <Check size={15} /> : null}</button>)}</div> : panel === "prompt-guide" ? <div className="hf-prompt-guide-sheet">
      <p className="quiet">Higgsfield Nano Banana Pro mimarisi her tokenı kesin bir talimat olarak işler. Sohbet dolgularını (&quot;lütfen&quot;) atarak 6 temel değişkeni komut dizisi hâlinde derler:</p>
      <div className="hf-elements-bar">
        <div className="hf-elements-bar-head"><span><Sparkles size={13} /> NANO BANANA PRO HAZIR BENCHMARK ŞABLONLARI</span><small>Tıkla, 6 değişken otomatik dolsun</small></div>
        <div className="hf-elements-chips">
          {NANO_BANANA_TEMPLATES.map((tpl) => (
            <button key={tpl.id} type="button" onClick={() => setPromptBuilder({ ...tpl.builder })}>
              <strong>{tpl.title}</strong>
              <small>{tpl.badge}</small>
            </button>
          ))}
        </div>
      </div>
      <div className="field-row">
        <label className="field"><span>01 · Özne (Subject &amp; Materyal)</span><input value={promptBuilder.subject} onChange={(e) => setPromptBuilder((c) => ({ ...c, subject: e.target.value }))} placeholder="Örn: Metalik zırhlı @Gezgin" /></label>
        <label className="field"><span>02 · Kompozisyon (Composition)</span><input value={promptBuilder.composition ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, composition: e.target.value }))} placeholder="Örn: POV shot, macro lens, isometric view" /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>03 · Eylem &amp; Hareket (Action)</span><input value={promptBuilder.action ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, action: e.target.value }))} placeholder="Örn: çatı boşluğundan sıçrarken" /></label>
        <label className="field"><span>04 · Mekân &amp; Atmosfer (Location)</span><input value={promptBuilder.location ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, location: e.target.value }))} placeholder="Örn: neon ışıklı yağmurlu Tokyo ara sokağı" /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>05 · Görsel Ortam (Style)</span><input value={promptBuilder.style ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, style: e.target.value }))} placeholder="Örn: 1980s polaroid, gritty 70s film look" /></label>
        <label className="field"><span>06 · Kamera &amp; Optik (Camera Gear)</span><input value={promptBuilder.cameraGear ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, cameraGear: e.target.value }))} placeholder="Örn: full-frame cinema camera, 85mm f/1.4" /></label>
      </div>
      <div className="field-row">
        <label className="field"><span>Tırnak İçi Görünür Metin (Opsiyonel)</span><input value={promptBuilder.quotedText ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, quotedText: e.target.value }))} placeholder='Örn: "KADRA 2026"' /></label>
        <label className="field"><span>Negatif Kısıtlar (Exclude)</span><input value={promptBuilder.negativeConstraints ?? ""} onChange={(e) => setPromptBuilder((c) => ({ ...c, negativeConstraints: e.target.value }))} placeholder="Örn: bulanık yüz, bozuk geometri" /></label>
      </div>
      <div className="hf-xray-brief">
        <strong>Derlenen Komut-Satırı Promptu</strong>
        <p>{compileHiggsfieldPrompt(promptBuilder)}</p>
      </div>
      <button type="button" className="button button-lamp" onClick={() => { update("prompt", compileHiggsfieldPrompt(promptBuilder)); setPanel(null); }}><Sparkles size={15} /> Bu Promptu Stüdyoya Aktar</button>
    </div> : panel === "references" ? <><div className="hf-reference-intro"><Layers3 size={38} strokeWidth={1.2} /><h3>Tutarlı karakterler ve mekânlar (Soul ID &amp; @Elements)</h3><p>Fotoğrafını projeye yükle, karakter sayfanı oluştur ve onayla. Onaylı referanslar o projenin sahnelerinde kullanılır.</p></div><button type="button" className="button button-lamp" disabled={busy !== null || draft.prompt.trim().length < 10 || uncertain} onClick={() => { setPanel(null); void save("cast"); }}><Save size={16} />Taslağı kaydet ve referans ekle</button><p className="quiet">Mevcut bir projenin referanslarını yönet:</p><div className="hf-reference-projects">{projects.filter((project) => !project.isExample).slice(0, 5).map((project) => <button type="button" key={project.id} onClick={() => { setPanel(null); onOpen(project, "cast"); }}><FolderOpen size={16} /><span>{project.title}</span><ArrowRight size={15} /></button>)}</div></> : null}</div><div className="sheet-actions"><button type="button" className="button button-lamp" onClick={() => setPanel(null)}>Tamam <Check size={16} /></button></div></dialog>

    <dialog
      ref={quoteDialog}
      {...({ closedby: "any" } as Record<string, string>)}
      className="sheet hf-quote-dialog"
      aria-labelledby="studio-quote-title"
      onCancel={(event) => { if (busy === "run") event.preventDefault(); else setShowQuote(false); }}
      onClick={(event) => {
        if (busy === "run") return;
        const dialog = event.currentTarget;
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          setShowQuote(false);
        }
      }}
    ><div className="sheet-head"><div><span className="hf-eyebrow">ÜRETİM TEKLİFİ</span><h2 id="studio-quote-title">{draft.mode === "image" ? "Görselini oluşturalım." : "Hikâyene hareket katalım."}</h2></div><button type="button" className="icon-button" disabled={busy === "run"} aria-label="Teklifi kapat" onClick={() => setShowQuote(false)}><X size={19} /></button></div>{quote ? <><div className="sheet-body"><p className="quiet">{activeProject?.title}</p><div className="hf-quote-lines">{quote.lines.map((line, index) => <div key={`${line.sceneId}:${line.kind}:${index}`}><span><strong>{line.modelLabel}</strong><small>{line.title} · {line.kind === "image" ? "Görsel" : line.kind === "voice" ? "Ses" : `${line.billedSeconds} sn video`}</small></span><strong>{money(line.estimate)}</strong></div>)}</div>{quote.reused.length ? <p className="note"><Check size={15} />{quote.reused.length} hazır sonuç tekrar kullanılacak.</p> : null}<div className="hf-quote-total"><span>Toplam tahmin</span><strong>{money(quote.total)}</strong></div><p className="quiet">Bütçe sınırın: {money(quote.budget)} · Kullanılabilir: {money(quote.remaining)}</p>{quote.errors.map((message) => <p key={message} className="note note-error"><TriangleAlert size={15} />{message}</p>)}{quote.warnings.map((message) => <p key={message} className="note note-warn"><TriangleAlert size={15} />{message}</p>)}{expired ? <p className="note note-error">Teklifin süresi doldu. Kapatıp yeniden fiyat al.</p> : null}{uncertainRun && error ? <p className="note note-error" role="alert">{error}</p> : null}<p className="note"><ShieldCheck size={15} />Onayladığında ücretli üretim başlar. Bu teklif yalnızca {quote.target === "frames" ? "görsel" : "video"} üretimini kapsar.</p></div><div className="sheet-actions"><button type="button" className="button" disabled={busy === "run"} onClick={() => setShowQuote(false)}>Vazgeç</button>{uncertainRun ? <button type="button" className="button button-lamp" onClick={() => { setShowQuote(false); onNavigate("queue"); }}>Üretimleri kontrol et</button> : <button type="button" className="button button-lamp" disabled={!validQuote || busy === "run"} onClick={() => void approve()}>{busy === "run" ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{busy === "run" ? "Başlatılıyor…" : `${money(quote.total)} · Onayla ve üret`}</button>}</div></> : null}</dialog>
  </div>;
}
