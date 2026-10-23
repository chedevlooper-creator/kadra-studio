"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowRight, ArrowUp, Check, CheckCheck, ChevronRight,
  Clapperboard, Clock3, Download, FileText, Film, Info,
  LayoutGrid, LoaderCircle, Maximize2, Pencil, Play, RotateCcw, Save, ScanLine, ShieldCheck,
  Sparkles, Square, TriangleAlert, WandSparkles, X, Music, Mic, Search,
} from "lucide-react";
import { CAMERA_MOVES, GENRES, LOOKS, lookOf } from "@/lib/cinema";
import { titleCardText } from "@/lib/text";
import type { AspectRatio, Project, ProviderStatus, RunStep, Scene, VideoModelOption } from "@/lib/types";
import { ProductionDirector, MusicDirector, VoiceoverStudio, CsvExport } from "./creative-tools";
import CharacterBank from "./character-bank";
import MusicLane from "./music-lane";
import PaidMotionPanel, { committedSpend } from "./paid-motion-panel";
import NarrationPanel from "./narration-panel";
import RepairDialog, { type RepairTarget } from "./repair-dialog";
import "./project-studio.css";

type StudioTab = "script" | "storyboard" | "production" | "timeline" | "music" | "voiceover";
type ProjectStudioProps = {
  project: Project;
  providers: ProviderStatus;
  videoModels: VideoModelOption[];
  onProjectChange: (project: Project) => void;
  onBack: () => void;
  notify: (message: string) => void;
};

const TABS = [
  { id: "script", label: "Senaryo", icon: FileText },
  { id: "storyboard", label: "Storyboard", icon: LayoutGrid },
  { id: "production", label: "Üretim", icon: Sparkles },
  { id: "timeline", label: "Zaman çizelgesi", icon: Film },
  { id: "music", label: "Müzik yönetmeni", icon: Music },
  { id: "voiceover", label: "Seslendirme", icon: Mic },
] as const;

const SCENE_STATUS: Record<Scene["status"], string> = {
  draft: "Taslak", queued: "Sırada", running: "İşleniyor", ready: "Hazır", failed: "Hata",
};
const STEP_STATUS: Record<RunStep["status"], string> = { pending: "Sırada", running: "İşleniyor", done: "Hazır", failed: "Hata", skipped: "Atlandı" };
const STEP_STATE: Record<RunStep["status"], Scene["status"]> = { pending: "queued", running: "running", done: "ready", failed: "failed", skipped: "draft" };

function timecode(seconds: number) {
  const rounded = Math.round(seconds);
  return `${Math.floor(rounded / 60).toString().padStart(2, "0")}:${(rounded % 60).toString().padStart(2, "0")}`;
}

async function projectRequest(url: string, method: string, body: unknown, idempotencyKey?: string) {
  const response = await fetch(url, {
    method,
    headers: { "Content-Type": "application/json", ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}) },
    body: JSON.stringify(body),
  });
  const result = await response.json() as { project?: Project; error?: string };
  if (!response.ok || !result.project) throw new Error(result.error || "İşlem tamamlanamadı. Yeniden deneyin.");
  return result.project;
}

export default function ProjectStudio({ project, providers, videoModels, onProjectChange, onBack, notify }: ProjectStudioProps) {
  const [tab, setTab] = useState<StudioTab>(project.scenes.length ? "storyboard" : "script");
  const [script, setScript] = useState(project.script);
  const [title, setTitle] = useState(project.title);
  const [style, setStyle] = useState(project.style);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(project.aspectRatio);
  const [genre, setGenre] = useState(project.genre);
  const [look, setLook] = useState(project.look);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sceneQuery, setSceneQuery] = useState("");
  const [sceneGroup, setSceneGroup] = useState("");
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(project.scenes[0]?.id ?? null);
  const [showPlanDetails, setShowPlanDetails] = useState(false);
  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null);
  const sceneDialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  const changeRef = useRef(onProjectChange);
  const notifyRef = useRef(notify);
  const running = project.run?.status === "running";
  const scenes = project.scenes;
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0];
  const scriptDirty = script !== project.script || title !== project.title || style !== project.style || aspectRatio !== project.aspectRatio || genre !== project.genre || look !== project.look;
  const isDisabled = busy !== null || running;
  const runStatus = project.run?.status;
  const generatedCount = scenes.filter((scene) => scene.imageSource === "generated").length;
  const videoCount = scenes.filter((scene) => scene.kind === "video").length;
  const montageStep = project.run?.steps.find((step) => step.kind === "montage");
  const output = project.output;
  const spentLabel = `$${committedSpend(project.ledger).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

  useEffect(() => { changeRef.current = onProjectChange; notifyRef.current = notify; }, [onProjectChange, notify]);

  useEffect(() => {
    if (!running) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    let reportedError = false;
    const controller = new AbortController();
    async function poll() {
      try {
        const response = await fetch(`/api/projects/${project.id}`, { cache: "no-store", signal: controller.signal });
        const result = await response.json() as { project?: Project; error?: string };
        if (!response.ok || !result.project) throw new Error(result.error || "Üretim durumu alınamadı.");
        if (stopped) return;
        changeRef.current(result.project);
        if (result.project.run?.status !== "running") {
          if (result.project.run?.status === "completed") notifyRef.current("Filmin hazır. Üretim sekmesinden izleyip indirebilirsin.");
          if (result.project.run?.status === "failed") notifyRef.current("Üretim yarıda kaldı. Ayrıntılar akış günlüğünde.");
          return;
        }
        reportedError = false;
      } catch (cause) {
        if (stopped) return;
        if (!reportedError) notifyRef.current(cause instanceof Error ? cause.message : "Bağlantı yeniden deneniyor.");
        reportedError = true;
      }
      if (!stopped) timer = setTimeout(poll, 1000);
    }
    timer = setTimeout(poll, 700);
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [project.id, running]);

  useEffect(() => {
    const dialog = sceneDialog.current;
    if (editingScene && dialog && !dialog.open) dialog.showModal();
    if (!editingScene && dialog?.open) dialog.close();
  }, [editingScene]);

  async function perform(action: string, task: () => Promise<void>) {
    setBusy(action);
    setError("");
    try { await task(); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Beklenmeyen bir hata oluştu."); }
    finally { setBusy(null); }
  }

  async function saveScript() {
    const updated = await projectRequest(`/api/projects/${project.id}`, "PATCH", { revision: project.revision, title: title.trim(), script, style, aspectRatio, genre, look });
    onProjectChange(updated);
    setTitle(updated.title);
    setScript(updated.script);
    setStyle(updated.style);
    setAspectRatio(updated.aspectRatio);
    setGenre(updated.genre);
    setLook(updated.look);
    return updated;
  }

  function handlePlan(planner: "auto" | "heuristic" = "auto") {
    void perform("plan", async () => {
      const current = scriptDirty ? await saveScript() : project;
      const updated = await projectRequest(`/api/projects/${project.id}/plan`, "POST", { revision: current.revision, planner });
      onProjectChange(updated);
      setSelectedSceneId(updated.scenes[0]?.id ?? null);
      setTab("storyboard");
      notify(updated.planner === "deepseek" ? `Senaryo DeepSeek ile ${updated.scenes.length} çekime ayrıldı.` : updated.planner === "nemotron" ? `Senaryo Nemotron ile ${updated.scenes.length} çekime ayrıldı.` : updated.planNote ? "Yapay zekâ planlayıcısına ulaşılamadı; kural tabanlı plan hazırlandı." : "Senaryo yerel kurallarla çekimlere ayrıldı.");
    });
  }

  function handleRun() {
    void perform("run", async () => {
      const updated = await projectRequest(`/api/projects/${project.id}/run`, "POST", { mode: "free", revision: project.revision }, crypto.randomUUID());
      onProjectChange(updated);
      setTab("production");
      notify("Ücretsiz üretim başladı. Ücretli servis çağrılmıyor.");
    });
  }

  function startStage(target: "frames" | "film", reuseImages = false, prepareCharacters = false, regenerate = false) {
    void perform("run", async () => {
      const updated = await projectRequest(`/api/projects/${project.id}/run`, "POST", { mode: "free", revision: project.revision, target, reuseImages, prepareCharacters, regenerate }, crypto.randomUUID());
      onProjectChange(updated); setTab("production");
      notify(target === "frames" ? (regenerate ? "Tüm sahne kareleri yeniden üretiliyor." : "Yeni ve değişen sahne kareleri hazırlanıyor; değişmeyenler korunuyor.") : "Üretim akışı başladı; ücretli GMI isteği gönderilmez.");
    });
  }

  function revertRepair(scene: Scene) {
    void perform("revert", async () => {
      onProjectChange(await projectRequest(`/api/projects/${project.id}/repair`, "DELETE", { revision: project.revision, sceneId: scene.id }));
      notify(`${scene.title}: onarım geri alındı, önceki kare kullanılıyor.`);
    });
  }

  function handleCancel() {
    void perform("cancel", async () => {
      const updated = await projectRequest(`/api/projects/${project.id}/cancel`, "POST", { revision: project.revision });
      onProjectChange(updated);
      notify("Üretim durduruldu.");
    });
  }

  function handleSceneSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingScene) return;
    const scene = editingScene;
    void perform("scene", async () => {
      const updated = await projectRequest(`/api/projects/${project.id}/scenes/${scene.id}`, "PATCH", {
        revision: project.revision,
        scene: { title: scene.title.trim(), description: scene.description, prompt: scene.prompt, duration: scene.duration, camera: scene.camera, kind: scene.kind, narration: scene.narration, screenText: scene.screenText, audioNotes: scene.audioNotes, characterIds: scene.characterIds },
      });
      onProjectChange(updated);
      setEditingScene(null);
      notify("Çekim güncellendi.");
    });
  }

  function moveScene(scene: Scene, offset: -1 | 1) {
    const index = scenes.findIndex((item) => item.id === scene.id);
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= scenes.length) return;
    const ids = scenes.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    void perform("reorder", async () => {
      const updated = await projectRequest(`/api/projects/${project.id}`, "PATCH", { revision: project.revision, sceneOrder: ids });
      onProjectChange(updated);
      notify("Çekim sırası kaydedildi.");
    });
  }

  return (
    <div className="studio">
      <div className="studio-breadcrumb">
        <button type="button" onClick={onBack}><ArrowLeft size={15} /> Projelerim</button>
        <ChevronRight size={13} /><span>{project.title}</span>
        <span className="studio-saved"><CheckCheck size={14} /> Yerel kayıt</span>
      </div>

      <header className="studio-heading">
        <div>
          <div className="studio-overline"><span /> PROJE STÜDYOSU</div>
          <h1>{project.title}</h1>
          <div className="studio-meta">
            <span><Maximize2 size={13} /> {project.aspectRatio}</span><i />
            <span>{project.style}</span><i />
            <span>{scenes.length} çekim</span><i />
            <span><Clock3 size={13} /> {timecode(totalDuration)}</span>
          </div>
        </div>
        <div className="studio-heading-actions">
          {output ? <a className="studio-button studio-button-secondary" href={output.url} download={`${project.title}.mp4`}><Download size={15} /> Filmi indir</a> : <a className="studio-button studio-button-secondary" href={`/api/projects/${project.id}/export`} download><Download size={15} /> Planı indir</a>}
          {running ? (
            <button className="studio-button studio-button-primary" onClick={() => setTab("production")} type="button"><LoaderCircle className="studio-spin" size={15} /> Üretimi izle</button>
          ) : (
            <>
              <button className="studio-button studio-button-secondary" onClick={() => { setTab("production"); setTimeout(() => document.querySelector(".paid-panel")?.scrollIntoView({ behavior: "smooth" }), 50); }} disabled={isDisabled || !scenes.length || scriptDirty} title={scriptDirty ? "Önce senaryoyu kaydedip çekim planını güncelleyin." : !scenes.length ? "Önce çekim planı oluşturun." : undefined} type="button"><Sparkles size={14} /> Ücretli üret (GMI)</button>
              <button className="studio-button studio-button-primary" onClick={handleRun} disabled={isDisabled || !scenes.length || scriptDirty || !providers.ffmpeg} title={!providers.ffmpeg ? "FFmpeg bulunamadı." : scriptDirty ? "Önce senaryoyu kaydedip çekim planını güncelleyin." : !scenes.length ? "Önce çekim planı oluşturun." : undefined} type="button">{output ? <RotateCcw size={14} /> : <Play size={14} fill="currentColor" />} {busy === "run" ? "Başlatılıyor…" : output ? "Yeniden üret" : "Ücretsiz üret"}</button>
            </>
          )}
        </div>
      </header>

      {scenes.length ? <ProductionDirector project={project} disabled={busy !== null || scriptDirty} onCharacters={() => { setTab("storyboard"); setTimeout(() => document.querySelector(".char-bank")?.scrollIntoView({ behavior: "smooth" }), 50); }} onFrames={() => startStage("frames")} onRegenerate={() => startStage("frames", false, false, true)} onFilm={() => startStage("film", true)} onFull={() => startStage("film", true, true)} onPaid={() => { setTab("production"); setTimeout(() => document.querySelector(".paid-panel")?.scrollIntoView({ behavior: "smooth" }), 50); }} onCancel={handleCancel} /> : null}
      <div className="studio-tab-bar">
        <div className="studio-tabs" role="tablist" aria-label="Proje bölümleri">
          {TABS.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" id={`${prefix}-${id}-tab`} role="tab" aria-selected={tab === id} aria-controls={`${prefix}-${id}-panel`} tabIndex={tab === id ? 0 : -1} className={tab === id ? "is-active" : ""} onClick={() => setTab(id)} onKeyDown={(event) => {
              const index = TABS.findIndex((item) => item.id === id);
              const next = event.key === "ArrowRight" ? (index + 1) % TABS.length : event.key === "ArrowLeft" ? (index + TABS.length - 1) % TABS.length : event.key === "Home" ? 0 : event.key === "End" ? TABS.length - 1 : -1;
              if (next !== -1) { event.preventDefault(); setTab(TABS[next].id); document.getElementById(`${prefix}-${TABS[next].id}-tab`)?.focus(); }
            }}><Icon size={16} /> {label}{id === "storyboard" && scenes.length ? <span className="studio-tab-count">{scenes.length}</span> : null}</button>
          ))}
        </div>
        <span className="studio-mode-label"><span /> {providers.gmi && providers.nvidia ? "GMI Cloud + NVIDIA" : providers.gmi ? "GMI Cloud" : providers.nvidia ? "NVIDIA · ücretsiz" : "Yerel mod"}</span>
      </div>

      {error ? <div className="studio-error" role="alert"><Info size={16} /><span>{error}</span><button type="button" aria-label="Hata mesajını kapat" onClick={() => setError("")}><X size={15} /></button></div> : null}

      <section className="studio-tab-content" role="tabpanel" id={`${prefix}-${tab}-panel`} aria-labelledby={`${prefix}-${tab}-tab`}>
        {tab === "music" ? <MusicDirector project={project} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify}/> : null}
        {tab === "voiceover" ? <><NarrationPanel key={`${project.id}-${project.revision}`} project={project} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify} /><VoiceoverStudio project={project}/></> : null}
        {tab === "script" ? (
          <div className="studio-script-layout">
            <div className="studio-script-card">
              <div className="studio-section-title"><div><span className="studio-eyebrow">01 / HİKÂYENİN BAŞLADIĞI YER</span><h2>Önce bir hikâye.</h2><p>Aklındaki dünyayı anlat. Çekim planını birlikte şekillendirelim.</p></div><span className="studio-script-count">{script.length.toLocaleString("tr-TR")} karakter</span></div>
              <label className="studio-field"><span>Proje adı</span><input value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={running} placeholder="Hikâyene bir isim ver" /></label>
              <label className="studio-field studio-script-field"><span>Senaryon</span><textarea value={script} onChange={(event) => setScript(event.target.value)} disabled={running} placeholder="Bir sabah, güneş dağların ardından yükselirken…\n\nHer paragraf yeni bir sahnenin başlangıcı olabilir." maxLength={30000} /></label>
              <div className="studio-script-footer"><span><ShieldCheck size={14} /> Özgün senaryon yerel olarak saklanır.</span><button type="button" className="studio-button studio-button-secondary" disabled={isDisabled || !scriptDirty || !title.trim()} onClick={() => void perform("save", async () => { await saveScript(); notify("Senaryo kaydedildi."); })}>{busy === "save" ? <LoaderCircle size={14} className="studio-spin" /> : <Save size={14} />} Kaydet</button></div>
            </div>
            <aside className="studio-settings-card">
              <div className="studio-settings-icon"><ScanLine size={22} strokeWidth={1.5} /></div><h3>Görsel dünyanı kur</h3><p>Bu tercihler tüm çekimler için başlangıç noktası olur.</p>
              <label className="studio-field"><span>Görsel stil</span><select value={style} onChange={(event) => setStyle(event.target.value)} disabled={running}>{[...new Set([style, "Sinematik", "Anime", "Gerçekçi", "3D animasyon", "Belgesel"])].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
              <label className="studio-field"><span>Tür <small>Plan ritmini, kamera seçimini ve ışığı belirler</small></span><select value={genre} onChange={(event) => setGenre(event.target.value)} disabled={running}>{GENRES.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select></label>
              <label className="studio-field"><span>Renk ve dönem <small>Montajda ücretsiz uygulanır; kareler yeniden üretilmez</small></span><select value={look} onChange={(event) => setLook(event.target.value)} disabled={running}>{LOOKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{look !== "none" ? <small className="studio-field-hint">{lookOf(look).hint}</small> : null}</label>
              <fieldset className="studio-ratio-field"><legend>Çerçeve oranı</legend><div>{(["16:9", "9:16", "1:1"] as const).map((ratio) => <button key={ratio} className={aspectRatio === ratio ? "is-selected" : ""} type="button" aria-pressed={aspectRatio === ratio} disabled={running} onClick={() => setAspectRatio(ratio)}><span style={{ aspectRatio: ratio.replace(":", " / "), width: ratio === "9:16" ? 14 : 24 }} />{ratio}</button>)}</div></fieldset>
              <div className="studio-local-notice"><Info size={15} /><p>{providers.deepseek ? "Plan DeepSeek V4.1 Flash köprüsüyle hazırlanır (yedeği NVIDIA Nemotron 3 Ultra): karakterler, çekimler, kamera ve görsel promptları." : providers.nvidia ? "Plan NVIDIA Nemotron 3 Ultra ile ücretsiz hazırlanır: karakterler, çekimler, kamera ve görsel promptları. Yaklaşık 20 saniye sürer; ulaşılamazsa yerel kurallar kullanılır." : "NVIDIA veya DeepSeek anahtarı tanımlı değil; senaryo yerel kurallarla paragraflara ve çekimlere ayrılır."}</p></div>
              <button className="studio-button studio-button-primary studio-button-full" type="button" disabled={isDisabled || script.trim().length < 10 || !title.trim()} onClick={() => handlePlan()}>{busy === "plan" ? <LoaderCircle size={15} className="studio-spin" /> : <WandSparkles size={15} />} {busy === "plan" ? (providers.deepseek || providers.nvidia ? "Yapay zekâ planlıyor…" : "Planlanıyor…") : scenes.length ? "Çekim planını yenile" : "Çekim planı oluştur"}<ArrowRight size={15} /></button>
              {providers.deepseek || providers.nvidia ? <button type="button" className="studio-text-button studio-plan-alt" disabled={isDisabled || script.trim().length < 10 || !title.trim()} onClick={() => handlePlan("heuristic")}>Yapay zekâ olmadan, kurallarla planla</button> : null}
              {scenes.length ? <p className="studio-settings-hint">Yeni plan, mevcut çekim düzenlemelerinin yerini alır.</p> : null}
            </aside>
          </div>
        ) : null}

        {tab === "storyboard" ? (
          <>
            <div className="studio-content-heading"><div><span className="studio-eyebrow">HİKÂYENDEN KARELER</span><h2>Bir kare, bin olasılık.</h2><p>Çekimlerini düzenle. Her sahnenin ritmini ve görsel dilini belirle.</p></div><button className="studio-button studio-button-secondary" type="button" onClick={() => setTab("script")}><Pencil size={14} /> Senaryoyu düzenle</button></div>
            <div className="studio-reference-note"><span><Info size={14} /> {generatedCount ? `${generatedCount}/${videoCount} kare üretildi.` : "Görseller temsili referanslardır; üretim başlayınca gerçek kareler gelir."}</span><span>Plan: {project.planner === "deepseek" ? "DeepSeek V4.1 Flash" : project.planner === "nemotron" ? "Nemotron 3 Ultra" : project.planner === "import" ? "storyboard dosyası" : "kural tabanlı"}</span></div>
            {project.planNote ? <div className="studio-local-notice studio-plan-note"><TriangleAlert size={15} /><p>{project.planNote}</p></div> : null}
            {scenes.length ? <CharacterBank key={project.id} project={project} providers={providers} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify} /> : null}
            {scenes.length ? (
              <><div className="creative-storyboard-toolbar"><label><Search size={14}/><input aria-label="Çekimlerde ara" placeholder="Kod, karakter veya çekim ara…" value={sceneQuery} onChange={event=>setSceneQuery(event.target.value)}/></label><select aria-label="Sahne grubunu filtrele" value={sceneGroup} onChange={event=>setSceneGroup(event.target.value)}><option value="">Tüm sahneler</option>{[...new Set(scenes.map(scene=>scene.group).filter(Boolean))].map(group=><option key={group} value={group}>{group}</option>)}</select><CsvExport project={project}/></div><div className="studio-scene-grid">{scenes.filter(scene=>(!sceneGroup || scene.group===sceneGroup) && `${scene.code} ${scene.title} ${scene.description} ${scene.prompt}`.toLocaleLowerCase("tr").includes(sceneQuery.toLocaleLowerCase("tr"))).map((scene) => <SceneCard key={scene.id} scene={scene} index={scene.order - 1} characters={project.characters} disabled={isDisabled} canRepair={providers.gmi} onEdit={() => setEditingScene({ ...scene })} onRepair={() => setRepairTarget({ kind: "scene", scene })} onRevert={() => revertRepair(scene)} />)}</div></>
            ) : <EmptyState title="Hikâyen kadraja girmeyi bekliyor." description="Senaryonu ekle ve yerel planlayıcıyla ilk çekim planını oluştur." onAction={() => setTab("script")} action="Senaryoya git" />}
            {scenes.length ? <div className="studio-storyboard-bottom"><div><Clapperboard size={17} /><span><strong>{scenes.length} çekim</strong> · {timecode(totalDuration)} planlanan süre</span></div><button type="button" onClick={() => setTab("timeline")}>Zaman çizelgesinde aç <ArrowRight size={15} /></button></div> : null}
          </>
        ) : null}

        {tab === "production" ? (
          <div className="studio-production-layout">
            <div>
              <div className="studio-content-heading"><div><span className="studio-eyebrow">HER ADIM GÖZÜNÜN ÖNÜNDE</span><h2>{running ? "Hikâyen kare kare üretiliyor." : runStatus === "completed" ? "Filmin hazır." : runStatus === "failed" ? "Üretim yarıda kaldı." : "Plana hareket kat."}</h2><p>Kareleri üret, kontrol et, kamera hareketi ver ve tek filmde birleştir.</p></div></div>
              {output ? <div className="studio-film"><video key={output.url} src={output.url} poster={project.cover} controls preload="metadata" playsInline style={{ aspectRatio: project.aspectRatio.replace(":", " / ") }} /><div className="studio-film-meta"><span><strong>{project.title}</strong> · {timecode(output.duration)}{project.music ? ` · Müzik: ${project.music.name}` : " · Sessiz"} · {new Date(output.createdAt).toLocaleString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span><a className="studio-button studio-button-secondary" href={output.url} download={`${project.title}.mp4`}><Download size={14} /> MP4 indir</a></div></div> : null}
              <div className="studio-run-card"><div className="studio-run-card-top"><span className="studio-run-symbol">{running ? <LoaderCircle size={25} className="studio-spin" /> : runStatus === "completed" ? <Check size={25} /> : runStatus === "failed" ? <TriangleAlert size={25} /> : <Sparkles size={25} />}</span><div><h3>{running && project.run?.mode === "characters" ? "Karakter sayfaları üretiliyor" : running && project.run?.mode === "repair" ? "Bölgesel onarım sürüyor" : running ? "Üretim sürüyor" : runStatus === "completed" && project.run?.mode === "characters" ? "Karakter sayfaları hazır" : runStatus === "completed" && project.run?.mode === "repair" ? "Onarım tamamlandı" : runStatus === "completed" && project.run?.target === "frames" ? "Sahne kareleri hazır" : runStatus === "completed" ? "Film birleştirildi" : runStatus === "failed" ? "Üretim durdu" : runStatus === "cancelled" ? "Üretim durduruldu" : "Üretim planın hazır mı?"}</h3><p>{project.run?.mode === "repair" ? "Yalnızca işaretli bölge · GMI · görselin geri kalanı korunur" : project.run?.mode === "paid" ? "Seçili çekimler GMI Cloud yapay zekâ modelleriyle üretilir" : `${providers.nvidia ? "NVIDIA FLUX.2 Klein" : "Referans görseller"} · Ücretli servis çağrısı yok`}</p></div><strong>{Math.round(project.run?.progress ?? 0)}<small>%</small></strong></div><div className="studio-progress" role="progressbar" aria-label="Üretim ilerlemesi" aria-valuenow={project.run?.progress ?? 0} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${project.run?.progress ?? 0}%` }} /></div><div className="studio-run-bottom"><span><ShieldCheck size={13} /> Ücretli harcama (tahmini): {spentLabel}</span>{running ? <button type="button" onClick={handleCancel} disabled={busy !== null}><Square size={12} fill="currentColor" /> {busy === "cancel" ? "Durduruluyor…" : "Üretimi durdur"}</button> : <span>{runStatus === "completed" && output ? `Film ${timecode(output.duration)}` : runStatus === "failed" ? "Ayrıntılar akış günlüğünde" : "İstediğin zaman başlatabilirsin"}</span>}</div></div>
              {scenes.length ? <PaidMotionPanel key={`${project.id}-${project.revision}`} project={project} providers={providers} videoModels={videoModels} disabled={isDisabled} onProjectChange={onProjectChange} onRunStarted={(updated) => { onProjectChange(updated); notify("Onaylı teklifle üretim başladı."); }} /> : null}
              <div className="studio-production-scene-list">{scenes.map((scene, index) => <div key={scene.id} className={`studio-production-scene studio-state-${scene.status}`}><span className="studio-production-number">{scene.status === "ready" ? <Check size={15} /> : scene.status === "running" ? <LoaderCircle size={15} className="studio-spin" /> : (index + 1).toString().padStart(2, "0")}</span><div><strong>{scene.title}</strong><span>{scene.motion === "ai" ? "Yapay zekâ videosu · GMI" : scene.model} <span>·</span> {scene.duration} sn{scene.review && !scene.review.ok ? <> <span>·</span> kontrol uyarısı</> : null}</span></div><span className={`studio-scene-status studio-state-${scene.status}`}><span /> {SCENE_STATUS[scene.status]}</span></div>)}{montageStep ? <div className={`studio-production-scene studio-state-${STEP_STATE[montageStep.status]}`}><span className="studio-production-number">{montageStep.status === "done" ? <Check size={15} /> : montageStep.status === "running" ? <LoaderCircle size={15} className="studio-spin" /> : <Film size={14} />}</span><div><strong>Montaj</strong><span>Tüm çekimler tek MP4 dosyasında</span></div><span className={`studio-scene-status studio-state-${STEP_STATE[montageStep.status]}`}><span /> {STEP_STATUS[montageStep.status]}</span></div> : null}</div>
              {!scenes.length ? <EmptyState title="Önce çekimlerini planla." description="Bir senaryo ekledikten sonra üretimi başlatabilirsin." action="Senaryoya git" onAction={() => setTab("script")} /> : null}
              <div className="studio-events"><h3><span /> Akış günlüğü</h3>{project.run?.events.length ? <ol>{project.run.events.map((event) => <li key={event.id}><time>{new Date(event.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><span className={`studio-event-dot studio-event-${event.kind}`} /><span>{event.message}</span></li>)}</ol> : <p>Üretim başladığında ilerleme adımları burada görünür.</p>}</div>
            </div>
            <aside className="studio-production-aside"><div className="studio-settings-icon"><ShieldCheck size={22} strokeWidth={1.5} /></div><h3>Kontrol sende.</h3><p>{providers.nvidia ? "Kareler NVIDIA veya GMI Cloud modellerinde üretilir ve tek MP4 filmde birleştirilir." : "Kareler ve videolar GMI Cloud modellerinde üretilir ve tek MP4 filmde birleştirilir."} Ücretli üretim yalnızca onayladığın teklifle başlar.</p><div className="studio-budget-row"><span>Ücretli harcama (tahmini)</span><strong>{spentLabel}</strong></div><div className="studio-budget-row"><span>Proje bütçesi</span><strong>{project.budget === null ? "Belirlenmedi" : `$${project.budget.toLocaleString("tr-TR", { minimumFractionDigits: 2 })}`}</strong></div><hr /><span className="studio-eyebrow">ÜRETİM YÖNTEMİ</span><p>Video çekimlerinde FLUX.2 Klein veya GMI görsel modelleri başlangıç karesini üretir, Nemotron VL / DeepSeek kontrol eder. Yapay zekâ videoları ve referanslı kareler GMI teklif panelinden seçilen modellerle oluşturulur.</p><button type="button" className="studio-text-button" onClick={() => setShowPlanDetails(!showPlanDetails)} aria-expanded={showPlanDetails}>{showPlanDetails ? "Seçim gerekçelerini gizle" : "Seçim gerekçelerini gör"}<ChevronRight size={14} className={showPlanDetails ? "studio-rotate" : ""} /></button>{showPlanDetails ? <div className="studio-model-reasons">{scenes.map((scene, index) => <div key={scene.id}><strong>{(index + 1).toString().padStart(2, "0")} · {scene.model}</strong><p>{scene.modelReason || "Çekim türü için başlangıç adayı. Gerçek üretim öncesi doğrulanmalıdır."}</p></div>)}</div> : null}<div className="studio-local-notice"><Info size={15} /><p>Müzik yönetmeninde parça yükleyip filme miksleyebilirsin. Seslendirme sekmesi yerel prova kaydı ve indirme sunar; prova otomatik mikslenmez.</p></div></aside>
          </div>
        ) : null}

        {tab === "timeline" ? (
          <>
            <div className="studio-content-heading"><div><span className="studio-eyebrow">HİKÂYENİN RİTMİ</span><h2>Her saniye yerini bulsun.</h2><p>Çekimleri sırala, süreleri düzenle ve hikâyenin bütününü gör.</p></div><span className="studio-timeline-total"><Clock3 size={15} /> {timecode(totalDuration)}<span>toplam süre</span></span></div>
            {scenes.length && selectedScene ? <div className="studio-timeline-layout"><div className="studio-preview"><div className="studio-preview-top"><span><span /> {selectedScene.kind === "title" ? "YAZI KARTI" : selectedScene.imageSource === "generated" ? "ÜRETİLEN KARE" : "REFERANS ÖNİZLEME"}</span><span>{project.aspectRatio}</span></div><div className="studio-preview-media" style={{ aspectRatio: project.aspectRatio.replace(":", " / ") }}>{selectedScene.kind === "title" ? <div className="studio-title-frame"><span>YAZI KARTI</span><p>{titleCardText(selectedScene.description) || selectedScene.title}</p></div> : <Image src={selectedScene.image || "/images/mountains.jpg"} alt={`${selectedScene.title} karesi`} fill sizes="(max-width: 900px) 100vw, 700px" unoptimized />}{selectedScene.kind === "video" && selectedScene.imageSource === "reference" ? <span className="studio-preview-watermark">KADRA <span>/ REFERANS</span></span> : null}</div><div className="studio-preview-caption"><span><strong>{(scenes.indexOf(selectedScene) + 1).toString().padStart(2, "0")}</strong> {selectedScene.title}</span><button type="button" disabled={isDisabled} onClick={() => setEditingScene({ ...selectedScene })}><Pencil size={14} /> Çekimi düzenle</button></div></div><aside className="studio-shot-detail"><span className="studio-eyebrow">SEÇİLİ ÇEKİM</span><h3>{selectedScene.title}</h3><p>{selectedScene.description}</p><dl><div><dt>Süre</dt><dd>{selectedScene.duration} saniye</dd></div><div><dt>Kamera</dt><dd>{selectedScene.camera || "Belirlenmedi"}</dd></div><div><dt>Yöntem</dt><dd>{selectedScene.model}</dd></div></dl>{selectedScene.review ? <p className={`studio-review ${selectedScene.review.ok ? "" : "studio-review-warning"}`}>{selectedScene.review.ok ? <Check size={12} /> : <TriangleAlert size={12} />} {selectedScene.review.note || (selectedScene.review.ok ? "Kare kontrolden geçti." : "Kare kontrolden geçmedi.")}</p> : null}{selectedScene.narration ? <div className="studio-narration"><span>SESLENDİRME</span><p>“{selectedScene.narration}”</p></div> : null}<div className="studio-reorder"><span>Çekim sırası</span><div><button type="button" aria-label="Çekimi önceye taşı" disabled={isDisabled || scenes[0].id === selectedScene.id} onClick={() => moveScene(selectedScene, -1)}><ArrowUp size={15} /></button><button type="button" aria-label="Çekimi sonraya taşı" disabled={isDisabled || scenes[scenes.length - 1].id === selectedScene.id} onClick={() => moveScene(selectedScene, 1)}><ArrowDown size={15} /></button></div></div></aside><div className="studio-timeline"><div className="studio-timeline-header"><span><Film size={15} /> Çekim şeridi</span><span>Bir çekim seçerek ayrıntılarını düzenle</span></div><div className="studio-timeline-scroll"><div className="studio-timeline-ruler"><span>00:00</span><span>{timecode(totalDuration / 4)}</span><span>{timecode(totalDuration / 2)}</span><span>{timecode(totalDuration * .75)}</span><span>{timecode(totalDuration)}</span></div><div className="studio-timeline-track">{scenes.map((scene, index) => <button key={scene.id} type="button" className={`studio-timeline-clip ${selectedScene.id === scene.id ? "is-selected" : ""}`} style={{ flexGrow: scene.duration }} onClick={() => setSelectedSceneId(scene.id)} aria-pressed={selectedScene.id === scene.id}><div className="studio-timeline-clip-thumb">{scene.kind === "title" ? <FileText size={17} /> : <Image src={scene.image || "/images/mountains.jpg"} alt="" fill sizes="180px" unoptimized />}<span>{(index + 1).toString().padStart(2, "0")}</span></div><div><span>{scene.title}</span><small>{scene.duration} sn</small></div></button>)}</div><MusicLane key={`${project.id}-${project.revision}`} project={project} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify} /></div></div></div> : <EmptyState title="Zaman çizelgen henüz boş." description="Çekim planını oluşturduktan sonra hikâyenin ritmini burada düzenle." action="Senaryoya git" onAction={() => setTab("script")} />}
          </>
        ) : null}
      </section>

      {repairTarget ? <RepairDialog key={repairTarget.kind === "scene" ? repairTarget.scene.id : repairTarget.attempt.id} project={project} target={repairTarget} onClose={() => setRepairTarget(null)} onStarted={(updated) => { onProjectChange(updated); setRepairTarget(null); notify("Onarım başladı: yalnızca işaretli bölge yeniden çiziliyor."); }} /> : null}
      <dialog ref={sceneDialog} className="studio-scene-dialog" aria-labelledby={`${prefix}-edit-title`} onCancel={() => setEditingScene(null)} onClose={() => setEditingScene(null)} onClick={(event) => { if (event.target === event.currentTarget && busy !== "scene") setEditingScene(null); }}>
        {editingScene ? <form onSubmit={handleSceneSave}><div className="studio-dialog-heading"><div><span className="studio-eyebrow">ÇEKİM {(scenes.findIndex((scene) => scene.id === editingScene.id) + 1).toString().padStart(2, "0")}</span><h2 id={`${prefix}-edit-title`}>Kadraja yön ver.</h2></div><button type="button" aria-label="Çekim düzenleyiciyi kapat" disabled={busy === "scene"} onClick={() => setEditingScene(null)}><X size={19} /></button></div><div className="studio-dialog-fields"><label className="studio-field"><span>Çekim adı</span><input value={editingScene.title} onChange={(event) => setEditingScene({ ...editingScene, title: event.target.value })} required maxLength={120} autoFocus /></label><label className="studio-field"><span>Görsel anlatım</span><textarea value={editingScene.description} onChange={(event) => setEditingScene({ ...editingScene, description: event.target.value })} rows={2} maxLength={30000} required /></label><label className="studio-field"><span>Üretim promptu</span><textarea value={editingScene.prompt} onChange={(event) => setEditingScene({ ...editingScene, prompt: event.target.value })} rows={4} required maxLength={5000} /></label><div className="studio-field-row"><label className="studio-field"><span>Süre (saniye)</span><input type="number" min={2} max={30} step={1} value={editingScene.duration} onChange={(event) => setEditingScene({ ...editingScene, duration: Number(event.target.value) })} required /></label><label className="studio-field"><span>Çekim türü</span><select value={editingScene.kind} onChange={(event) => setEditingScene({ ...editingScene, kind: event.target.value as Scene["kind"] })}><option value="video">Video çekimi</option><option value="title">Yazı kartı</option></select></label></div><label className="studio-field"><span>Kamera hareketi <small>Listeden seç ya da kendin yaz</small></span><input list={`${prefix}-camera-moves`} value={editingScene.camera} onChange={(event) => setEditingScene({ ...editingScene, camera: event.target.value })} maxLength={160} required /><datalist id={`${prefix}-camera-moves`}>{CAMERA_MOVES.map((move) => <option key={move.id} value={move.label} />)}</datalist></label><label className="studio-field"><span>Seslendirme <small>İsteğe bağlı</small></span><textarea rows={2} value={editingScene.narration} onChange={(event) => setEditingScene({ ...editingScene, narration: event.target.value })} maxLength={3000} placeholder="Bu çekimde duyulacak anlatım…" /></label><label className="studio-field"><span>Ekran metni / dış ses notu <small>Storyboard'dan</small></span><textarea rows={2} value={editingScene.screenText} onChange={(event) => setEditingScene({ ...editingScene, screenText: event.target.value })} maxLength={4000} placeholder="Ekranda görünecek yazı veya dış ses notu…" /></label>{project.characters.length ? <fieldset className="studio-field char-links"><legend>Bu çekimdeki karakterler ve mekân <small>Onaylı sayfaları referans olur</small></legend><div>{project.characters.map((character) => <label key={character.id}><input type="checkbox" checked={editingScene.characterIds.includes(character.id)} onChange={(event) => setEditingScene({ ...editingScene, characterIds: event.target.checked ? [...editingScene.characterIds, character.id] : editingScene.characterIds.filter((id) => id !== character.id) })} /> {character.name}</label>)}</div></fieldset> : null}<label className="studio-field"><span>Ses ve müzik notu</span><textarea rows={2} value={editingScene.audioNotes} onChange={(event) => setEditingScene({ ...editingScene, audioNotes: event.target.value })} maxLength={4000} placeholder="Bu çekimde duyulacak efekt ve müzik…" /></label><div className="studio-dialog-model"><Sparkles size={17} /><div><strong>{editingScene.model}</strong><p>{editingScene.modelReason}</p><span>Ücretsiz üretim yöntemi</span></div></div>{error ? <p className="studio-dialog-error" role="alert">{error}</p> : null}</div><div className="studio-dialog-footer"><span><CheckCheck size={14} /> Proje planına kaydedilir</span><button className="studio-button studio-button-primary" type="submit" disabled={busy !== null || running}>{busy === "scene" ? <LoaderCircle size={15} className="studio-spin" /> : <Check size={15} />} {busy === "scene" ? "Kaydediliyor…" : "Değişiklikleri kaydet"}</button></div></form> : null}
      </dialog>
    </div>
  );
}

function SceneCard({ scene, index, disabled, onEdit, characters, canRepair, onRepair, onRevert }: { characters: Project["characters"]; scene: Scene; index: number; disabled: boolean; canRepair: boolean; onEdit: () => void; onRepair: () => void; onRevert: () => void }) {
  const issues = scene.review && !scene.review.ok ? (scene.review.issues ?? []).flatMap((issue) => issue.box ? [issue.box] : []) : [];
  const repairable = scene.kind === "video" && scene.imageSource === "generated";
  return <article className="studio-scene-card"><button className="studio-scene-visual" type="button" onClick={onEdit} disabled={disabled} aria-label={`${scene.title} çekimini düzenle`}>{scene.kind === "title" ? <div className="studio-title-frame"><span>YAZI KARTI</span><p>{titleCardText(scene.description) || scene.title}</p></div> : <Image className="studio-scene-image" src={scene.image || "/images/mountains.jpg"} alt={`${scene.title} karesi`} fill sizes="(max-width: 650px) 100vw, (max-width: 1100px) 45vw, 30vw" unoptimized />}{issues.map((box, number) => <span key={number} className="studio-issue-box" style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }} />)}<span className="studio-shot-number">{scene.code || (index + 1).toString().padStart(2, "0")}</span><span className="studio-shot-duration"><Clock3 size={11} /> {scene.duration} sn</span><span className="studio-scene-visual-edit"><Pencil size={14} /> Çekimi düzenle</span>{scene.kind === "video" ? <span className="studio-reference-label">{scene.repair ? "ONARILDI" : scene.imageSource === "generated" ? "ÜRETİLDİ" : "REFERANS"}</span> : null}</button><div className="studio-scene-body"><div className="studio-scene-title"><h3>{scene.title}</h3><button type="button" onClick={onEdit} disabled={disabled} aria-label={`${scene.title} ayrıntılarını düzenle`}><Pencil size={14} /></button></div><p>{scene.description}</p><div className="creative-character-tags">{characters.filter(character=>scene.characterIds.includes(character.id)).map(character=><span key={character.id} className={character.sheet.status === "approved" ? "approved" : ""}>{character.name} {character.sheet.status === "approved" ? "✓" : "·"}</span>)}</div>{scene.review && !scene.review.ok ? <p className="studio-review studio-review-warning"><TriangleAlert size={12} /> {scene.review.note || "Kare kontrolden geçmedi."}{issues.length ? ` İşaretli ${issues.length} bölge yalnız başına onarılabilir.` : ""}</p> : null}{repairable && (canRepair || scene.repair) ? <div className="studio-scene-actions">{canRepair ? <button type="button" disabled={disabled} onClick={onRepair}><WandSparkles size={12} /> {issues.length ? "Hatalı bölgeyi onar" : "Bölgeyi onar"}</button> : null}{scene.repair ? <button type="button" disabled={disabled} onClick={onRevert} title={`Onarım: ${scene.repair.instruction}`}><RotateCcw size={12} /> Onarımı geri al</button> : null}</div> : null}<div className="studio-scene-model"><span><Sparkles size={12} /> {scene.model}</span><span className={`studio-scene-status studio-state-${scene.status}`}><span /> {SCENE_STATUS[scene.status]}</span></div></div></article>;
}

function EmptyState({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="studio-empty"><div><Clapperboard size={29} strokeWidth={1.3} /></div><h3>{title}</h3><p>{description}</p><button type="button" className="studio-button studio-button-primary" onClick={onAction}>{action}<ArrowRight size={15} /></button></div>;
}
