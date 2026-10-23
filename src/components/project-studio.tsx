"use client";

import Image from "next/image";
import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import {
  ArrowDown, ArrowLeft, ArrowUp, Check, ChevronDown, Clock3, Download, Film, Info, LayoutGrid,
  LoaderCircle, MessageSquareText, Pencil, RotateCcw, Rows3, Search, Square, TriangleAlert, WandSparkles, X,
} from "lucide-react";
import { CAMERA_MOVES, EMOTIONS, GENRES, LOOKS, lookOf, PRESETS } from "@/lib/cinema";
import { titleCardText } from "@/lib/text";
import type { AspectRatio, Project, ProviderStatus, Scene, VideoModelOption } from "@/lib/types";
import AssistantPanel from "./assistant-panel";
import { CsvExport, MusicDirector, VoiceoverStudio } from "./creative-tools";
import ExportPanel from "./export-panel";
import CharacterBank from "./character-bank";
import MusicLane from "./music-lane";
import NarrationPanel from "./narration-panel";
import PaidMotionPanel, { committedSpend } from "./paid-motion-panel";
import RepairDialog, { type RepairTarget } from "./repair-dialog";
import "./project-studio.css";

type Step = "story" | "cast" | "scenes" | "film";
type ProjectStudioProps = {
  initialStep?: Step;
  project: Project;
  providers: ProviderStatus;
  videoModels: VideoModelOption[];
  onProjectChange: (project: Project) => void;
  onBack: () => void;
  notify: (message: string) => void;
};

const STEPS: { id: Step; label: string }[] = [
  { id: "story", label: "Hikâye" },
  { id: "cast", label: "Oyuncular" },
  { id: "scenes", label: "Sahneler" },
  { id: "film", label: "Film" },
];
const STYLE_OPTIONS = ["Sinematik", "Anime", "3D animasyon", "Gerçekçi", "İllüstrasyon", "Belgesel"];
const RUN_STAGE: Record<string, string> = { character: "Oyuncular çiziliyor", repair: "Bölge onarılıyor", image: "Kareler çiziliyor", video: "Videolar üretiliyor", voice: "Dış ses okunuyor", clip: "Klipler hazırlanıyor", title: "Yazı kartları hazırlanıyor", montage: "Montaj yapılıyor" };

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

/** Where a project picks up: the first step that still needs the user. */
function suggestedStep(project: Project): Step {
  if (!project.scenes.length) return "story";
  if (project.run?.status === "running" || project.output) return "film";
  if (project.characters.some((character) => character.sheet.status !== "approved")) return "cast";
  return "scenes";
}

export default function ProjectStudio({ project, providers, videoModels, onProjectChange, onBack, notify, initialStep }: ProjectStudioProps) {
  const [step, setStep] = useState<Step>(() => initialStep ?? suggestedStep(project));
  const [script, setScript] = useState(project.script);
  const [title, setTitle] = useState(project.title);
  const [style, setStyle] = useState(project.style);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(project.aspectRatio);
  const [genre, setGenre] = useState(project.genre);
  const [look, setLook] = useState(project.look);
  const [brief, setBrief] = useState(project.brief);
  const [assistantOpen, setAssistantOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [sceneQuery, setSceneQuery] = useState("");
  const [sceneGroup, setSceneGroup] = useState("");
  const [sceneView, setSceneView] = useState<"grid" | "strip">("grid");
  const [editingScene, setEditingScene] = useState<Scene | null>(null);
  const [selectedSceneId, setSelectedSceneId] = useState<string | null>(project.scenes[0]?.id ?? null);
  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null);
  const sceneDialog = useRef<HTMLDialogElement>(null);
  const prefix = useId();
  const changeRef = useRef(onProjectChange);
  const notifyRef = useRef(notify);
  const running = project.run?.status === "running";
  const scenes = project.scenes;
  const totalDuration = scenes.reduce((sum, scene) => sum + scene.duration, 0);
  const selectedScene = scenes.find((scene) => scene.id === selectedSceneId) ?? scenes[0];
  const scriptDirty = script !== project.script || title !== project.title || style !== project.style || aspectRatio !== project.aspectRatio || genre !== project.genre || look !== project.look || brief !== project.brief;
  const isDisabled = busy !== null || running;
  const output = project.output;
  const frames = scenes.filter((scene) => scene.kind === "video");
  const framed = frames.filter((scene) => scene.imageSource === "generated").length;
  const approved = project.characters.filter((character) => character.sheet.status === "approved").length;
  const groups = [...new Set(scenes.map((scene) => scene.group).filter(Boolean))];
  const shownScenes = scenes.filter((scene) => (!sceneGroup || scene.group === sceneGroup) && `${scene.code} ${scene.title} ${scene.description} ${scene.prompt}`.toLocaleLowerCase("tr").includes(sceneQuery.toLocaleLowerCase("tr")));
  const activeStep = project.run?.steps.find((item) => item.status === "running");

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
          if (result.project.run?.status === "completed") notifyRef.current(result.project.run.mode === "characters" ? "Oyuncular hazır; onayını bekliyor." : result.project.output ? "Filmin hazır." : "Üretim tamamlandı.");
          if (result.project.run?.status === "failed") notifyRef.current("Üretim durdu. Sebebi Film adımındaki kayıtta.");
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
    const updated = await projectRequest(`/api/projects/${project.id}`, "PATCH", { revision: project.revision, title: title.trim(), script, style, aspectRatio, genre, look, brief });
    onProjectChange(updated);
    setTitle(updated.title); setScript(updated.script); setStyle(updated.style); setAspectRatio(updated.aspectRatio); setGenre(updated.genre); setLook(updated.look); setBrief(updated.brief);
    return updated;
  }

  function handlePlan(planner: "auto" | "heuristic" = "auto") {
    if (scenes.length && !window.confirm("Yeni plan, mevcut sahnelerin ve düzenlemelerin yerini alır. Devam edilsin mi?")) return;
    void perform("plan", async () => {
      const current = scriptDirty ? await saveScript() : project;
      const updated = await projectRequest(`/api/projects/${project.id}/plan`, "POST", { revision: current.revision, planner });
      onProjectChange(updated);
      setSelectedSceneId(updated.scenes[0]?.id ?? null);
      setStep(updated.characters.length ? "cast" : "scenes");
      notify(`${updated.scenes.length} sahne hazır.`);
    });
  }

  function revertRepair(scene: Scene) {
    void perform("revert", async () => {
      onProjectChange(await projectRequest(`/api/projects/${project.id}/repair`, "DELETE", { revision: project.revision, sceneId: scene.id }));
      notify(`${scene.title}: önceki kareye dönüldü.`);
    });
  }

  function handleCancel() {
    void perform("cancel", async () => {
      onProjectChange(await projectRequest(`/api/projects/${project.id}/cancel`, "POST", { revision: project.revision }));
      notify("Üretim durduruldu.");
    });
  }

  function handleSceneSave(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editingScene) return;
    const scene = editingScene;
    void perform("scene", async () => {
      onProjectChange(await projectRequest(`/api/projects/${project.id}/scenes/${scene.id}`, "PATCH", {
        revision: project.revision,
        scene: { title: scene.title.trim(), description: scene.description, prompt: scene.prompt, duration: scene.duration, camera: scene.camera, kind: scene.kind, narration: scene.narration, screenText: scene.screenText, audioNotes: scene.audioNotes, characterIds: scene.characterIds, emotions: scene.emotions },
      }));
      setEditingScene(null);
      notify("Sahne kaydedildi.");
    });
  }

  function moveScene(scene: Scene, offset: -1 | 1) {
    const index = scenes.findIndex((item) => item.id === scene.id);
    const nextIndex = index + offset;
    if (nextIndex < 0 || nextIndex >= scenes.length) return;
    const ids = scenes.map((item) => item.id);
    [ids[index], ids[nextIndex]] = [ids[nextIndex], ids[index]];
    void perform("reorder", async () => {
      onProjectChange(await projectRequest(`/api/projects/${project.id}`, "PATCH", { revision: project.revision, sceneOrder: ids }));
    });
  }

  const stepState: Record<Step, { note: string; done: boolean }> = {
    story: { note: scenes.length ? `${scenes.length} sahne, ${timecode(totalDuration)}` : "Hikâyeni yaz", done: scenes.length > 0 },
    cast: { note: project.characters.length ? `${approved}/${project.characters.length} onaylı` : "Oyuncu yok", done: project.characters.length > 0 && approved === project.characters.length },
    scenes: { note: frames.length ? `${framed}/${frames.length} kare` : "Önce hikâye", done: frames.length > 0 && framed === frames.length },
    film: { note: running ? `%${Math.round(project.run?.progress ?? 0)}` : output ? `Hazır, ${timecode(output.duration)}` : "Henüz yok", done: Boolean(output) },
  };
  const next = STEPS[STEPS.findIndex((item) => item.id === step) + 1];

  return (
    <div className="studio">
      <header className="studio-head">
        <button type="button" className="back" onClick={onBack}><ArrowLeft size={16} />Projeler</button>
        <div className="studio-title">
          <h1 className="marquee marquee-title">{project.title}</h1>
          <ul className="facts" aria-label="Proje özeti"><li>{project.aspectRatio}</li><li>{project.style}</li><li>{scenes.length} sahne</li><li><Clock3 size={13} />{timecode(totalDuration)}</li></ul>
        </div>
        <div className="studio-actions">
          {scenes.length ? <button type="button" className="button" disabled={isDisabled} onClick={() => setAssistantOpen(true)}><MessageSquareText size={16} />Asistan</button> : null}
          {output ? <a className="button" href={output.url} download={`${project.title}.mp4`}><Download size={16} />Filmi indir</a> : <a className="button button-quiet" href={`/api/projects/${project.id}/export`} download><Download size={16} />Planı indir</a>}
        </div>
      </header>

      <nav className={`strip ${running ? "is-rolling" : ""}`} aria-label="Yapım adımları">
        <ol>{STEPS.map((item, index) => <li key={item.id}><button type="button" aria-current={step === item.id ? "step" : undefined} className={`strip-frame ${stepState[item.id].done ? "is-done" : ""}`} onClick={() => setStep(item.id)}>
          <span className="strip-index">{stepState[item.id].done ? <Check size={14} /> : index + 1}</span>
          <span className="strip-label">{item.label}</span>
          <span className="strip-note">{stepState[item.id].note}</span>
        </button></li>)}</ol>
      </nav>

      {error ? <div className="alert" role="alert"><TriangleAlert size={16} /><span>{error}</span><button type="button" className="icon-button" aria-label="Kapat" onClick={() => setError("")}><X size={15} /></button></div> : null}

      <section className="stage" key={step} aria-label={STEPS.find((item) => item.id === step)!.label}>
        {step === "story" ? <div className="story">
          <div className="story-main">
            <label className="field"><span>Film adı</span><input className="title-input" value={title} onChange={(event) => setTitle(event.target.value)} maxLength={120} disabled={running} placeholder="Filmine bir ad ver" /></label>
            <label className="field field-grow"><span>Hikâye <small>{script.length.toLocaleString("tr-TR")} karakter</small></span><textarea className="script" value={script} onChange={(event) => setScript(event.target.value)} disabled={running} maxLength={30000} placeholder={"Bir sabah, güneş dağların ardından yükselirken…\n\nHer paragraf yeni bir sahne olabilir."} /></label>
            {project.planNote ? <p className="note note-warn"><TriangleAlert size={15} />{project.planNote}</p> : null}
          </div>
          <aside className="story-side" aria-label="Görsel dünya">
            <label className="field"><span>Görsel stil</span><select value={style} onChange={(event) => setStyle(event.target.value)} disabled={running}>{[...new Set([style, ...STYLE_OPTIONS])].map((item) => <option key={item}>{item}</option>)}</select></label>
            <div className="field"><span id={`${prefix}-preset`}>Hazır tarz <small>Tür, renk ve notları birden ayarlar</small></span><div className="chips" role="group" aria-labelledby={`${prefix}-preset`}>{PRESETS.map((item) => <button key={item.id} type="button" className="chip" disabled={running} aria-pressed={style === item.style && genre === item.genre && look === item.look && brief === item.brief} title={item.blurb} onClick={() => { setStyle(item.style); setGenre(item.genre); setLook(item.look); setBrief(item.brief); }}>{item.label}</button>)}</div></div>
            <div className="field"><span id={`${prefix}-ratio`}>Ekran oranı</span><div className="segmented" role="group" aria-labelledby={`${prefix}-ratio`}>{(["16:9", "9:16", "1:1"] as const).map((ratio) => <button key={ratio} type="button" aria-pressed={aspectRatio === ratio} disabled={running} onClick={() => setAspectRatio(ratio)}><span className={`ratio-glyph ratio-${ratio.replace(":", "-")}`} aria-hidden="true" />{ratio}</button>)}</div></div>
            <div className="field"><span id={`${prefix}-genre`}>Tür</span><div className="chips" role="group" aria-labelledby={`${prefix}-genre`}>{GENRES.map((item) => <button key={item.id} type="button" className="chip" aria-pressed={genre === item.id} disabled={running} onClick={() => setGenre(item.id)}>{item.label}</button>)}</div></div>
            <label className="field"><span>Renk ve dönem</span><select value={look} onChange={(event) => setLook(event.target.value)} disabled={running}>{LOOKS.map((item) => <option key={item.id} value={item.id}>{item.label}</option>)}</select>{look !== "none" ? <small className="hint">{lookOf(look).hint} Montajda ücretsiz eklenir.</small> : null}</label>
            <label className="field"><span>Proje özeti <small>Her görüntüye uyulacak notlar</small></span><textarea rows={4} maxLength={1500} value={brief} disabled={running} onChange={(event) => setBrief(event.target.value)} placeholder="Örn. Gerçekçi ışık, yavaş ritim. Renkli neon ve çizgi film havası olmasın." /></label>
          </aside>
        </div> : null}

        {step === "cast" ? (scenes.length ? <CharacterBank key={project.id} project={project} providers={providers} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify} /> : <Empty text="Oyuncular hikâyeden çıkarılır. Önce hikâyeni yazıp sahnelere böl." action="Hikâyeye git" onAction={() => setStep("story")} />) : null}

        {step === "scenes" ? (scenes.length ? <>
          {project.run ? <RunReel project={project} busy={busy} onCancel={handleCancel} /> : null}
          <PaidMotionPanel key={`${project.id}-${project.revision}`} project={project} providers={providers} videoModels={videoModels} disabled={isDisabled} onProjectChange={onProjectChange} onRunStarted={(updated) => { onProjectChange(updated); notify("Üretim başladı."); }} />
          <div className="toolbar">
            <div className="segmented" role="group" aria-label="Görünüm"><button type="button" aria-pressed={sceneView === "grid"} onClick={() => setSceneView("grid")}><LayoutGrid size={15} />Kareler</button><button type="button" aria-pressed={sceneView === "strip"} onClick={() => setSceneView("strip")}><Rows3 size={15} />Sıra ve süre</button></div>
            {sceneView === "grid" && scenes.length > 8 ? <label className="search"><Search size={15} /><input aria-label="Sahnelerde ara" placeholder="Sahne ara" value={sceneQuery} onChange={(event) => setSceneQuery(event.target.value)} /></label> : null}
            {sceneView === "grid" && groups.length > 1 ? <select aria-label="Bölüm" value={sceneGroup} onChange={(event) => setSceneGroup(event.target.value)}><option value="">Bütün bölümler</option>{groups.map((group) => <option key={group}>{group}</option>)}</select> : null}
            <span className="toolbar-end"><CsvExport project={project} /></span>
          </div>
          {sceneView === "grid" ? <div className="frames">{shownScenes.map((scene) => <SceneCard key={scene.id} scene={scene} index={scene.order - 1} characters={project.characters} disabled={isDisabled} canRepair={providers.gmi} onEdit={() => setEditingScene({ ...scene })} onRepair={() => setRepairTarget({ kind: "scene", scene })} onRevert={() => revertRepair(scene)} />)}</div>
            : selectedScene ? <div className="sequence">
              <div className="viewer">
                <div className="viewer-media" style={{ aspectRatio: project.aspectRatio.replace(":", " / ") }}>{selectedScene.kind === "title" ? <div className="title-card"><p>{titleCardText(selectedScene.description) || selectedScene.title}</p></div> : <Image src={selectedScene.image || "/images/mountains.jpg"} alt={`${selectedScene.title} karesi`} fill sizes="(max-width: 900px) 100vw, 760px" unoptimized />}</div>
                <div className="viewer-bar"><strong>{(scenes.indexOf(selectedScene) + 1).toString().padStart(2, "0")} {selectedScene.title}</strong><span className="viewer-tools"><button type="button" className="icon-button" aria-label="Öne al" disabled={isDisabled || scenes[0].id === selectedScene.id} onClick={() => moveScene(selectedScene, -1)}><ArrowUp size={16} /></button><button type="button" className="icon-button" aria-label="Sona al" disabled={isDisabled || scenes.at(-1)!.id === selectedScene.id} onClick={() => moveScene(selectedScene, 1)}><ArrowDown size={16} /></button><button type="button" className="button button-small" disabled={isDisabled} onClick={() => setEditingScene({ ...selectedScene })}><Pencil size={14} />Düzenle</button></span></div>
                <p className="viewer-text">{selectedScene.description}</p>
                {selectedScene.narration ? <p className="viewer-voice">“{selectedScene.narration}”</p> : null}
              </div>
              <div className="track" role="list" aria-label="Sahne sırası">{scenes.map((scene, index) => <button key={scene.id} type="button" role="listitem" className="track-clip" style={{ flexGrow: scene.duration }} aria-pressed={selectedScene.id === scene.id} onClick={() => setSelectedSceneId(scene.id)}>
                <span className="track-thumb">{scene.kind === "title" ? <span className="track-title">Aa</span> : <Image src={scene.image || "/images/mountains.jpg"} alt="" fill sizes="160px" unoptimized />}</span>
                <span className="track-label">{(index + 1).toString().padStart(2, "0")} · {scene.duration} sn</span>
              </button>)}</div>
            </div> : null}
        </> : <Empty text="Sahneler hikâyeden çıkarılır. Hikâyeni yazıp “Sahnelere böl”e bas." action="Hikâyeye git" onAction={() => setStep("story")} />) : null}

        {step === "film" ? (scenes.length ? <div className="film">
          {output ? <><figure className="screen"><video key={output.url} src={output.url} poster={project.cover} controls preload="metadata" playsInline style={{ aspectRatio: project.aspectRatio.replace(":", " / ") }} /><figcaption><span>{timecode(output.duration)}{project.music ? `, müzik: ${project.music.name}` : ""}</span><a className="button button-small" href={output.url} download={`${project.title}.mp4`}><Download size={14} />MP4 indir</a></figcaption></figure><ExportPanel key={output.url} project={project} /></> : null}
          {project.run ? <RunReel project={project} busy={busy} onCancel={handleCancel} /> : null}
          <PaidMotionPanel key={`${project.id}-${project.revision}`} project={project} providers={providers} videoModels={videoModels} disabled={isDisabled} onProjectChange={onProjectChange} onRunStarted={(updated) => { onProjectChange(updated); notify("Üretim başladı."); }} />
          <details className="fold">
            <summary><span><strong>Ses ve müzik</strong><small>{[project.narration.engine !== "off" ? "Dış ses açık" : "Dış ses kapalı", project.music ? `Müzik: ${project.music.name}` : "Müzik yok"].join(", ")}</small></span><ChevronDown size={18} /></summary>
            <div className="fold-body">
              <NarrationPanel key={`${project.id}-${project.revision}`} project={project} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify} />
              <MusicLane key={`lane-${project.id}-${project.revision}`} project={project} disabled={isDisabled} onProjectChange={onProjectChange} notify={notify} />
              <MusicDirector project={project} notify={notify} />
              <VoiceoverStudio project={project} />
            </div>
          </details>
        </div> : <Empty text="Film, sahnelerden üretilir. Önce hikâyeni sahnelere böl." action="Hikâyeye git" onAction={() => setStep("story")} />) : null}
      </section>

      <div className="dock" role="region" aria-label="Sıradaki adım">
        <p className="dock-status">{running ? <><LoaderCircle size={15} className="spin" />{RUN_STAGE[activeStep?.kind ?? ""] ?? "Üretim sürüyor"}, %{Math.round(project.run?.progress ?? 0)}</>
          : step === "story" ? (scriptDirty ? "Kaydedilmemiş değişiklik var." : scenes.length ? `${scenes.length} sahne hazır.` : "Hikâyeni yaz, sahneler otomatik çıkarılsın.")
          : step === "cast" ? (project.characters.length ? `${approved}/${project.characters.length} oyuncu onaylı. Onaylananlar her sahnede aynı görünür.` : "Oyuncu eklemeden de devam edebilirsin.")
          : step === "scenes" ? `${framed}/${frames.length} kare hazır. Üretmek için yukarıdan fiyatı gör.`
          : `Harcama ${committedSpend(project.ledger).toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} $${project.budget !== null ? ` / ${project.budget.toLocaleString("tr-TR")} $` : ""}.`}</p>
        <div className="dock-actions">
          {running ? <><button type="button" className="button" onClick={handleCancel} disabled={busy !== null}><Square size={13} fill="currentColor" />{busy === "cancel" ? "Durduruluyor…" : "Durdur"}</button>{step !== "film" ? <button type="button" className="button button-lamp" onClick={() => setStep("film")}><Film size={16} />İzle</button> : null}</>
            : step === "story" ? <>
              {scriptDirty && scenes.length ? <button type="button" className="button" disabled={isDisabled || !title.trim()} onClick={() => void perform("save", async () => { await saveScript(); notify("Kaydedildi."); })}>{busy === "save" ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}Kaydet</button> : null}
              {(providers.deepseek || providers.nvidia) && !scenes.length ? <button type="button" className="button button-quiet" disabled={isDisabled || script.trim().length < 10 || !title.trim()} onClick={() => handlePlan("heuristic")}>Kurallarla böl</button> : null}
              {scenes.length && !scriptDirty ? <button type="button" className="button button-quiet" disabled={isDisabled} onClick={() => handlePlan()}>Yeniden böl</button> : null}
              {!scenes.length || scriptDirty ? <button type="button" className="button button-lamp" disabled={isDisabled || script.trim().length < 10 || !title.trim()} onClick={() => handlePlan()}>{busy === "plan" ? <LoaderCircle size={16} className="spin" /> : <WandSparkles size={16} />}{busy === "plan" ? "Sahnelere bölünüyor…" : "Sahnelere böl"}</button>
                : <button type="button" className="button button-lamp" onClick={() => setStep("cast")}>Oyunculara geç</button>}
            </>
            : next ? <button type="button" className="button button-lamp" disabled={!scenes.length} onClick={() => setStep(next.id)}>{next.id === "film" ? "Filme geç" : `${next.label} adımına geç`}</button>
            : output ? <a className="button button-lamp" href={output.url} download={`${project.title}.mp4`}><Download size={16} />Filmi indir</a> : null}
        </div>
      </div>

      <AssistantPanel project={project} open={assistantOpen} available={Boolean(providers.deepseek || providers.nvidia)} disabled={isDisabled} onClose={() => setAssistantOpen(false)} onProjectChange={onProjectChange} notify={notify} />
      {repairTarget ? <RepairDialog key={repairTarget.kind === "scene" ? repairTarget.scene.id : repairTarget.attempt.id} project={project} target={repairTarget} onClose={() => setRepairTarget(null)} onStarted={(updated) => { onProjectChange(updated); setRepairTarget(null); notify("Onarım başladı; yalnızca seçtiğin alan yeniden çiziliyor."); }} /> : null}
      <dialog ref={sceneDialog} {...({ closedby: "any" } as Record<string, string>)} className="sheet" aria-labelledby={`${prefix}-edit-title`} onCancel={() => setEditingScene(null)} onClose={() => setEditingScene(null)} onClick={(event) => { if (event.target === event.currentTarget && busy !== "scene") setEditingScene(null); }}>
        {editingScene ? <form onSubmit={handleSceneSave}>
          <div className="sheet-head"><h2 id={`${prefix}-edit-title`}>Sahne {(scenes.findIndex((scene) => scene.id === editingScene.id) + 1).toString().padStart(2, "0")}</h2><button type="button" className="icon-button" aria-label="Kapat" disabled={busy === "scene"} onClick={() => setEditingScene(null)}><X size={18} /></button></div>
          <div className="sheet-body">
            <label className="field"><span>Başlık</span><input value={editingScene.title} onChange={(event) => setEditingScene({ ...editingScene, title: event.target.value })} required maxLength={120} autoFocus /></label>
            <label className="field"><span>Ne oluyor?</span><textarea value={editingScene.description} onChange={(event) => setEditingScene({ ...editingScene, description: event.target.value })} rows={2} maxLength={30000} required /></label>
            <label className="field"><span>Görsel tarif <small>Türkçe yazabilirsin; modele İngilizce çevrilerek gider</small></span><textarea value={editingScene.prompt} onChange={(event) => setEditingScene({ ...editingScene, prompt: event.target.value })} rows={4} required maxLength={5000} />{editingScene.promptEn && editingScene.promptEnSource === editingScene.prompt && editingScene.promptEn !== editingScene.prompt ? <details className="hint-fold"><summary>Modele gidecek İngilizce metin</summary><p>{editingScene.promptEn}</p></details> : null}</label>
            <div className="field-row">
              <label className="field"><span>Süre (sn)</span><input type="number" min={2} max={30} step={1} value={editingScene.duration} onChange={(event) => setEditingScene({ ...editingScene, duration: Number(event.target.value) })} required /></label>
              <label className="field"><span>Tür</span><select value={editingScene.kind} onChange={(event) => setEditingScene({ ...editingScene, kind: event.target.value as Scene["kind"] })}><option value="video">Görüntü</option><option value="title">Yazı kartı</option></select></label>
              <label className="field"><span>Kamera</span><input list={`${prefix}-camera-moves`} value={editingScene.camera} onChange={(event) => setEditingScene({ ...editingScene, camera: event.target.value })} maxLength={160} required /><datalist id={`${prefix}-camera-moves`}>{CAMERA_MOVES.map((move) => <option key={move.id} value={move.label} />)}</datalist></label>
            </div>
            <label className="field"><span>Dış ses <small>İsteğe bağlı</small></span><textarea rows={2} value={editingScene.narration} onChange={(event) => setEditingScene({ ...editingScene, narration: event.target.value })} maxLength={3000} placeholder="Bu sahnede okunacak metin" /></label>
            {project.characters.length ? <fieldset className="field"><legend>Sahnede kimler ve nerede?</legend><div className="chips">{project.characters.map((character) => <label key={character.id} className="chip chip-check"><input type="checkbox" checked={editingScene.characterIds.includes(character.id)} onChange={(event) => setEditingScene({ ...editingScene, characterIds: event.target.checked ? [...editingScene.characterIds, character.id] : editingScene.characterIds.filter((id) => id !== character.id) })} />{character.name}</label>)}</div></fieldset> : null}
            {project.characters.some((character) => character.kind === "person" && editingScene.characterIds.includes(character.id)) ? <fieldset className="field"><legend>O anki duyguları</legend><div className="feelings">{project.characters.filter((character) => character.kind === "person" && editingScene.characterIds.includes(character.id)).map((character) => <label key={character.id}><span>{character.name}</span><select value={editingScene.emotions?.[character.id] ?? ""} onChange={(event) => setEditingScene({ ...editingScene, emotions: { ...editingScene.emotions, [character.id]: event.target.value } })}>{EMOTIONS.map((emotion) => <option key={emotion.id} value={emotion.id}>{emotion.label}</option>)}</select></label>)}</div></fieldset> : null}
            <details className="hint-fold"><summary>Ekran yazısı ve ses notu</summary>
              <label className="field"><span>Ekran yazısı</span><textarea rows={2} value={editingScene.screenText} onChange={(event) => setEditingScene({ ...editingScene, screenText: event.target.value })} maxLength={4000} /></label>
              <label className="field"><span>Ses ve müzik notu</span><textarea rows={2} value={editingScene.audioNotes} onChange={(event) => setEditingScene({ ...editingScene, audioNotes: event.target.value })} maxLength={4000} /></label>
            </details>
            {error ? <p className="note note-error" role="alert">{error}</p> : null}
          </div>
          <div className="sheet-actions"><button type="button" className="button" disabled={busy === "scene"} onClick={() => setEditingScene(null)}>Vazgeç</button><button className="button button-lamp" type="submit" disabled={busy !== null || running}>{busy === "scene" ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}{busy === "scene" ? "Kaydediliyor…" : "Kaydet"}</button></div>
        </form> : null}
      </dialog>
    </div>
  );
}

/** The run as a reel: one frame per scene that lights up as its work finishes; the log stays folded away. */
function RunReel({ project, busy, onCancel }: { project: Project; busy: string | null; onCancel: () => void }) {
  const run = project.run!;
  const live = run.status === "running";
  const sceneSteps = (sceneId: string) => run.steps.filter((item) => item.sceneId === sceneId);
  const stateOf = (sceneId: string) => {
    const items = sceneSteps(sceneId);
    if (!items.length) return "idle";
    if (items.some((item) => item.status === "failed")) return "failed";
    if (items.some((item) => item.status === "running")) return "live";
    if (items.every((item) => item.status === "done")) return "done";
    return "waiting";
  };
  const headline = live ? (RUN_STAGE[run.steps.find((item) => item.status === "running")?.kind ?? ""] ?? "Üretim sürüyor")
    : run.status === "completed" ? (run.mode === "characters" ? "Oyuncular çizildi" : run.mode === "repair" ? "Onarım bitti" : "Üretim bitti")
    : run.status === "failed" ? "Üretim durdu" : "Üretim durduruldu";
  const lastProblem = run.status === "failed" ? run.events.toReversed().find((event) => event.kind === "warning")?.message : null;
  return <section className={`reel ${live ? "is-live" : ""}`} aria-label="Üretim durumu">
    <div className="reel-head">
      <div><h2>{headline}</h2>{lastProblem ? <p className="note note-error">{lastProblem}</p> : null}</div>
      <strong className="reel-percent">%{Math.round(run.progress)}</strong>
      {live ? <button type="button" className="button button-small" onClick={onCancel} disabled={busy !== null}><Square size={12} fill="currentColor" />Durdur</button> : null}
    </div>
    {run.mode !== "characters" ? <ol className="reel-frames">{project.scenes.map((scene) => <li key={scene.id} className={`reel-frame is-${stateOf(scene.id)}`} title={scene.title}>
      {scene.kind === "title" ? <span className="track-title">Aa</span> : <Image src={scene.image || "/images/mountains.jpg"} alt="" fill sizes="96px" unoptimized />}
    </li>)}</ol> : null}
    <div className="meter" role="progressbar" aria-label="Üretim ilerlemesi" aria-valuenow={run.progress} aria-valuemin={0} aria-valuemax={100}><span style={{ width: `${run.progress}%` }} /></div>
    <details className="log"><summary>Ayrıntılı kayıt ({run.events.length})</summary><ol>{run.events.toReversed().map((event) => <li key={event.id} className={`log-${event.kind}`}><time>{new Date(event.at).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time><span>{event.message}</span></li>)}</ol></details>
  </section>;
}

function SceneCard({ scene, index, disabled, onEdit, characters, canRepair, onRepair, onRevert }: { characters: Project["characters"]; scene: Scene; index: number; disabled: boolean; canRepair: boolean; onEdit: () => void; onRepair: () => void; onRevert: () => void }) {
  const issues = scene.review && !scene.review.ok ? (scene.review.issues ?? []).flatMap((issue) => issue.box ? [issue.box] : []) : [];
  const repairable = scene.kind === "video" && scene.imageSource === "generated";
  const cast = characters.filter((character) => scene.characterIds.includes(character.id));
  return <article className={`frame is-${scene.status}`}>
    <button className="frame-media" type="button" onClick={onEdit} disabled={disabled} aria-label={`${scene.title} sahnesini düzenle`}>
      {scene.kind === "title" ? <span className="title-card"><span>{titleCardText(scene.description) || scene.title}</span></span> : <Image src={scene.image || "/images/mountains.jpg"} alt="" fill sizes="(max-width: 650px) 100vw, (max-width: 1100px) 45vw, 30vw" unoptimized className={scene.imageSource === "generated" ? "" : "is-placeholder"} />}
      {issues.map((box, number) => <span key={number} className="issue-box" style={{ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` }} />)}
      <span className="frame-code">{scene.code || (index + 1).toString().padStart(2, "0")}</span>
      <span className="frame-time">{scene.duration} sn</span>
      {scene.status === "running" ? <span className="frame-busy"><LoaderCircle size={22} className="spin" /></span> : null}
      {scene.kind === "video" && scene.imageSource !== "generated" ? <span className="frame-flag">Örnek görsel</span> : scene.repair ? <span className="frame-flag">Onarıldı</span> : null}
      <span className="frame-edit"><Pencil size={14} />Düzenle</span>
    </button>
    <div className="frame-body">
      <h3>{scene.title}</h3>
      <p className="clamp">{scene.description}</p>
      {cast.length ? <ul className="tags">{cast.map((character) => <li key={character.id} className={character.sheet.status === "approved" ? "is-approved" : ""}>{character.sheet.status === "approved" ? <Check size={11} /> : null}{character.name}</li>)}</ul> : null}
      {scene.review && !scene.review.ok ? <p className="note note-warn"><TriangleAlert size={13} /><span>{scene.review.note || "Kontrolden geçmedi."}</span></p> : null}
      {repairable && (canRepair || scene.repair) ? <div className="frame-actions">
        {canRepair ? (issues.length ? <button type="button" className="button button-small" disabled={disabled} onClick={onRepair}><WandSparkles size={13} />Hatayı onar</button>
          : <button type="button" className="icon-button" disabled={disabled} onClick={onRepair} aria-label={`${scene.title}: bir bölgeyi onar`} title="Bir bölgeyi onar"><WandSparkles size={15} /></button>) : null}
        {scene.repair ? <button type="button" className="button button-small button-quiet" disabled={disabled} onClick={onRevert} title={scene.repair.instruction}><RotateCcw size={13} />Geri al</button> : null}
      </div> : null}
      {scene.promptEn?.trim() ? <span className="frame-en" title={scene.promptEn}><Info size={12} />İngilizce tarif hazır</span> : null}
    </div>
  </article>;
}

function Empty({ text, action, onAction }: { text: string; action: string; onAction: () => void }) {
  return <div className="empty"><Film size={26} strokeWidth={1.5} /><p>{text}</p><button type="button" className="button button-lamp" onClick={onAction}>{action}</button></div>;
}
