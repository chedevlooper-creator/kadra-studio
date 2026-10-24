"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from "react";
import {
  ArrowDownToLine, ArrowUpRight, Check, ChevronDown, Copy, FileUp, Film,
  LoaderCircle, MoreHorizontal, Search, ShieldCheck, Sparkles, Unplug, X,
} from "lucide-react";
import { PRESETS, presetOf } from "@/lib/cinema";
import type { AppBootstrap, AspectRatio, ModelProfile, Project, ProjectStatus, ProviderStatus } from "@/lib/types";
import NewProjectDialog from "./new-project-dialog";
import WorkspaceShell from "./workspace-shell";
import DiscoverStudio, { PresetGallery } from "./discover-studio";
import { STUDIO_VIEWS, type StudioLaunch, type StudioView } from "@/lib/studio-draft";

const CreationStudio = dynamic(() => import("./creation-studio"), { loading: () => <div className="view-loading"><span className="spinner" />Stüdyo açılıyor…</div> });
const StudioAssets = dynamic(() => import("./studio-assets"));
const StudioTools = dynamic(() => import("./studio-tools"));

const ProjectStudio = dynamic(() => import("./project-studio"), {
  loading: () => <div className="view-loading"><span className="spinner" />Proje açılıyor…</div>,
});

const STATUS_LABEL: Record<ProjectStatus, string> = { draft: "Taslak", planned: "Planlandı", producing: "Üretimde", ready: "Film hazır" };
const RATIOS: { id: AspectRatio; label: string }[] = [{ id: "16:9", label: "Yatay" }, { id: "9:16", label: "Dikey" }, { id: "1:1", label: "Kare" }];

async function apiProject(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.project) throw new Error(data.error ?? "İşlem tamamlanamadı.");
  return data.project as Project;
}

function downloadJson(data: unknown, name: string) {
  const url = URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  anchor.click();
  URL.revokeObjectURL(url);
}

/** The first sentence of an idea makes a good working title; the user can rename it in the story step. */
function titleFrom(idea: string) {
  const first = idea.trim().split(/[.!?\n]/)[0].trim();
  return (first.length > 48 ? `${first.slice(0, 46).trim()}…` : first) || "Yeni film";
}

export default function StudioApp({ initialData, initialProjectId, initialView = "explore", initialStep }: { initialData: AppBootstrap; initialProjectId: string | null; initialView?: StudioView; initialStep?: "story" | "cast" | "scenes" | "film" }) {
  const [projects, setProjects] = useState(initialData.projects);
  const [view, setView] = useState<StudioView>(initialView);
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId);
  const [selectedStep, setSelectedStep] = useState(initialStep);
  const [launch, setLaunch] = useState<StudioLaunch>();
  const [favorites, setFavorites] = useState<string[]>([]);
  const [preferencesReady, setPreferencesReady] = useState(false);
  const [newProject, setNewProject] = useState(false);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [showExamples, setShowExamples] = useState(true);
  const selectedProject = projects.find((project) => project.id === selectedId) ?? null;
  const providers = initialData.providers;

  useEffect(() => {
    try {
      const stored = JSON.parse(localStorage.getItem("kadra.preferences.v1") ?? "{}");
      setShowExamples(stored.showExamples !== false);
      const saved = JSON.parse(localStorage.getItem("kadra.favorites.v1") ?? "[]");
      if (Array.isArray(saved)) setFavorites(saved.filter((id): id is string => typeof id === "string").slice(0, 1000));
    } catch { /* Preferences are a convenience; defaults apply. */ }
    setPreferencesReady(true);
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    const popstate = () => { const params = new URLSearchParams(window.location.search); setSelectedId(params.get("project")); setSelectedStep(["story", "cast", "scenes", "film"].includes(params.get("step") ?? "") ? params.get("step") as typeof selectedStep : undefined); setView(STUDIO_VIEWS.includes(params.get("view") as StudioView) ? params.get("view") as StudioView : "explore"); setLaunch(undefined); };
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, []);

  useEffect(() => { if (preferencesReady) { try { localStorage.setItem("kadra.favorites.v1", JSON.stringify(favorites)); } catch { /* Favorites remain available for this session. */ } } }, [favorites, preferencesReady]);

  useEffect(() => {
    if (confirmDelete) deleteDialog.current?.showModal();
    else deleteDialog.current?.close();
  }, [confirmDelete]);

  const notify = useCallback((message: string) => {
    if (toastTimer.current) clearTimeout(toastTimer.current);
    setToast(message);
    toastTimer.current = setTimeout(() => setToast(""), 5000);
  }, []);

  const changeProject = useCallback((updated: Project) => {
    setProjects((current) => current.some((project) => project.id === updated.id) ? current.map((project) => project.id === updated.id ? updated : project) : [updated, ...current]);
  }, []);

  const backgroundRunIds = selectedId || view === "queue" ? "" : projects.filter((project) => project.run?.status === "running").map((project) => project.id).join(",");
  useEffect(() => {
    if (!backgroundRunIds) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout>;
    const controller = new AbortController();
    async function refresh() {
      await Promise.all(backgroundRunIds.split(",").map(async (id) => { try { const response = await fetch(`/api/projects/${id}`, { cache: "no-store", signal: controller.signal }); if (response.ok && !stopped) changeProject((await response.json()).project); } catch { /* The next refresh recovers transient errors. */ } }));
      if (!stopped) timer = setTimeout(refresh, 1500);
    }
    void refresh();
    return () => { stopped = true; controller.abort(); clearTimeout(timer); };
  }, [backgroundRunIds, changeProject]);

  function toggleFavorite(id: string) { setFavorites((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id].slice(-1000)); }

  function openProject(project: Project, step?: "story" | "cast" | "scenes" | "film") {
    setSelectedId(project.id);
    setSelectedStep(step);
    setView("projects");
    window.history.pushState({}, "", `/?project=${encodeURIComponent(project.id)}${step ? `&step=${step}` : ""}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function navigate(next: StudioView) {
    setView(next);
    setSelectedId(null);
    setSelectedStep(undefined);
    setLaunch(undefined);
    setQuery("");
    window.history.pushState({}, "", next === "explore" ? "/" : `/?view=${next}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function launchPreset(presetId: string, prompt?: string) { navigate("cinema"); setLaunch({ id: Date.now(), presetId, prompt }); }

  function saveExamples(value: boolean) {
    setShowExamples(value);
    try { localStorage.setItem("kadra.preferences.v1", JSON.stringify({ showExamples: value })); } catch { /* Not saved; the choice still applies now. */ }
  }

  const visibleProjects = useMemo(() => projects
    .filter((project) => (showExamples || !project.isExample) && `${project.title} ${project.description} ${project.style}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")))
    .toSorted((a, b) => b.updatedAt.localeCompare(a.updatedAt)), [projects, query, showExamples]);

  async function duplicateProject(project: Project) {
    try {
      changeProject(await apiProject("/api/projects", { method: "POST", body: JSON.stringify({ title: `${project.title.slice(0, 85)} (kopya)`, script: project.script, style: project.style, aspectRatio: project.aspectRatio, budget: project.budget }) }));
      notify("Proje kopyalandı.");
    } catch (error) { notify(error instanceof Error ? error.message : "Proje kopyalanamadı."); }
  }

  async function deleteProject() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${confirmDelete.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: confirmDelete.revision }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      setProjects((current) => current.filter((project) => project.id !== confirmDelete.id));
      setConfirmDelete(null);
      notify("Proje silindi.");
    } catch (error) { notify(error instanceof Error ? error.message : "Proje silinemedi."); }
    finally { setDeleting(false); }
  }

  return <WorkspaceShell view={view} selected={Boolean(selectedProject)} projects={projects} providers={providers} onNavigate={navigate} onOpen={openProject} onNew={() => setNewProject(true)}>
    <main id="main-content" className={selectedProject ? "page page-studio" : ["explore", "image", "video", "cinema"].includes(view) ? "workspace-main" : "page hf-page"}>
      {selectedProject ? <ProjectStudio key={`${selectedProject.id}:${selectedStep ?? "auto"}`} initialStep={selectedStep} project={selectedProject} providers={providers} videoModels={initialData.videoModels} onProjectChange={changeProject} onBack={() => navigate("projects")} notify={notify} />
        : view === "explore" ? <DiscoverStudio projects={visibleProjects} favorites={favorites} onFavorite={toggleFavorite} onNavigate={navigate} onPreset={launchPreset} onOpen={openProject} onNew={() => setNewProject(true)} onLaunchPrompt={launchPreset} />
        : view === "image" || view === "video" || view === "cinema" ? <CreationStudio key={`${view}:${launch?.id ?? "draft"}`} view={view} launch={launch} projects={projects} providers={providers} videoModels={initialData.videoModels} onProjectChange={changeProject} onOpen={openProject} onNavigate={navigate} onNew={() => setNewProject(true)} notify={notify} />
        : view === "effects" ? <><div className="hf-section-head"><div><span className="hf-eyebrow">GÖRSEL DİLİNİ BUL</span><h1>Tarzlar & efektler</h1><p>Bir tarz seç. Kamera, renk ve atmosferi kendi hikâyene uyarla.</p></div></div><PresetGallery favorites={favorites} onFavorite={toggleFavorite} onPreset={launchPreset} /></>
        : view === "popcorn" || view === "factory" || view === "layers" || view === "characters" || view === "audio" || view === "editor" || view === "mcp" || view === "after-effects" ? <StudioTools key={view} tool={view} projects={projects} providers={providers} onProjectChange={changeProject} onOpen={openProject} onNew={() => setNewProject(true)} onNavigate={navigate} notify={notify} />
        : view === "favorites" ? <><div className="hf-section-head"><div><span className="hf-eyebrow">İLHAMINI KAYDET</span><h1>Favorilerim</h1><p>Kaydettiğin tarzlar ve üretilmiş varlıklar.</p></div></div><PresetGallery favorites={favorites} onFavorite={toggleFavorite} onPreset={launchPreset} onlyFavorites /><StudioAssets projects={projects} favorites={favorites} onFavorite={toggleFavorite} onOpen={openProject} onCreate={() => navigate("image")} onlyFavorites /></>
        : view === "projects" ? <Home projects={visibleProjects} allCount={projects.length} query={query} onQuery={setQuery} onOpen={openProject} onCreated={(project) => { changeProject(project); openProject(project); }} onMore={() => setNewProject(true)} onDuplicate={(project) => void duplicateProject(project)} onDelete={setConfirmDelete} notify={notify} />
        : view === "queue" ? <><PageTitle title="Üretimler" lead="Süren ve biten üretimler. Bir satıra dokununca proje açılır." /><QueueView projects={projects} onOpen={openProject} onUpdate={changeProject} /></>
        : view === "library" ? <StudioAssets projects={projects} favorites={favorites} onFavorite={toggleFavorite} onOpen={openProject} onCreate={() => navigate("image")} />
        : view === "connections" ? <Connections providers={providers} models={initialData.models} />
        : <Settings showExamples={showExamples} onExamples={saveExamples} onExport={() => downloadJson({ version: 1, exportedAt: new Date().toISOString(), projects }, "kadra-calisma-alani.json")} />}
    </main>

    <NewProjectDialog open={newProject} onClose={() => setNewProject(false)} onCreated={(project) => { changeProject(project); setNewProject(false); openProject(project); notify("Proje hazır."); }} />
    <dialog
      ref={deleteDialog}
      {...({ closedby: "any" } as Record<string, string>)}
      className="sheet sheet-small"
      onCancel={() => { if (!deleting) setConfirmDelete(null); }}
      onClick={(event) => {
        if (deleting) return;
        const dialog = event.currentTarget;
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          setConfirmDelete(null);
        }
      }}
      aria-labelledby="delete-title"
    >
      <div className="sheet-body"><h2 id="delete-title">“{confirmDelete?.title}” silinsin mi?</h2><p>Senaryo, sahneler ve üretilen dosyalar bu bilgisayardan kalıcı olarak silinir.</p></div>
      <div className="sheet-actions"><button type="button" className="button" disabled={deleting} onClick={() => setConfirmDelete(null)}>Vazgeç</button><button type="button" className="button button-danger" disabled={deleting} onClick={() => void deleteProject()}>{deleting ? "Siliniyor…" : "Projeyi sil"}</button></div>
    </dialog>
    {toast ? <div className="toast" role="status"><Check size={16} /><span>{toast}</span><button type="button" className="icon-button" onClick={() => setToast("")} aria-label="Bildirimi kapat"><X size={15} /></button></div> : null}
  </WorkspaceShell>;
}

function Home({ projects, allCount, query, onQuery, onOpen, onCreated, onMore, onDuplicate, onDelete, notify }: {
  projects: Project[]; allCount: number; query: string; onQuery: (value: string) => void; onOpen: (project: Project) => void; onCreated: (project: Project) => void;
  onMore: () => void; onDuplicate: (project: Project) => void; onDelete: (project: Project) => void; notify: (message: string) => void;
}) {
  const [idea, setIdea] = useState("");
  const [presetId, setPresetId] = useState("cinematic");
  const [ratio, setRatio] = useState<AspectRatio>("16:9");
  const preset = presetOf(presetId);
  const [phase, setPhase] = useState<"idle" | "creating" | "planning" | "template">("idle");
  const busy = phase !== "idle";

  /** One sentence is enough: the project is created, split into scenes, and opened. */
  async function start(event: FormEvent) {
    event.preventDefault();
    if (busy || idea.trim().length < 10) return;
    setPhase("creating");
    try {
      let project = await apiProject("/api/projects", { method: "POST", body: JSON.stringify({ title: titleFrom(idea), script: idea.trim(), style: preset?.style ?? "Sinematik", aspectRatio: ratio, budget: null, ...(preset ? { genre: preset.genre, look: preset.look, brief: preset.brief } : {}) }) });
      setPhase("planning");
      try { project = await apiProject(`/api/projects/${project.id}/plan`, { method: "POST", body: JSON.stringify({ revision: project.revision }) }); }
      catch (error) { notify(error instanceof Error ? `Proje kaydedildi; sahnelere bölünemedi: ${error.message}` : "Proje kaydedildi; sahnelere bölünemedi."); }
      setIdea("");
      onCreated(project);
    } catch (error) { notify(error instanceof Error ? error.message : "Proje oluşturulamadı."); }
    finally { setPhase("idle"); }
  }

  async function openTemplate() {
    if (busy) return;
    setPhase("template");
    try { onCreated(await apiProject("/api/templates/balonlar", { method: "POST", body: JSON.stringify({ aspectRatio: ratio }) })); }
    catch (error) { notify(error instanceof Error ? error.message : "Şablon açılamadı."); }
    finally { setPhase("idle"); }
  }

  return <>
    <section className="home-hero" aria-labelledby="home-title">
      <h1 id="home-title" className="marquee">Bugün hangi filmi çekiyoruz?</h1>
      <form className="composer" onSubmit={start} aria-busy={busy}>
        <label className="sr-only" htmlFor="idea">Hikâyen</label>
        <textarea id="idea" value={idea} onChange={(event) => setIdea(event.target.value)} rows={3} maxLength={30000} disabled={busy}
          placeholder="Sisli bir sahil kasabasında genç bir fotoğrafçı, çocukluk fotoğrafındaki deniz fenerini arar…"
          onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); event.currentTarget.form?.requestSubmit(); } }} />
        <div className="composer-bar">
          <div className="chips" role="group" aria-label="Hazır tarz"><button type="button" className="chip" aria-pressed={!preset} disabled={busy} onClick={() => setPresetId("")}>Serbest</button>{PRESETS.map((item) => <button key={item.id} type="button" className="chip" aria-pressed={presetId === item.id} disabled={busy} onClick={() => setPresetId(item.id)}>{item.label}</button>)}</div>
          <div className="segmented" role="group" aria-label="Ekran oranı">{RATIOS.map((item) => <button key={item.id} type="button" aria-pressed={ratio === item.id} title={item.label} disabled={busy} onClick={() => setRatio(item.id)}><span className={`ratio-glyph ratio-${item.id.replace(":", "-")}`} aria-hidden="true" />{item.id}</button>)}</div>
          <button type="submit" className="button button-lamp" disabled={busy || idea.trim().length < 10}>{phase === "creating" || phase === "planning" ? <LoaderCircle size={17} className="spin" /> : <Film size={17} />}{phase === "creating" ? "Kaydediliyor…" : phase === "planning" ? "Sahnelere bölünüyor…" : "Filme başla"}</button>
        </div>
      </form>
      <div className="home-alt">
        <button type="button" className="text-button" disabled={busy} onClick={() => setIdea((preset ?? PRESETS[0]).idea)}><Sparkles size={14} />Örnek bir fikir yaz</button>
        {preset ? <span className="quiet">{preset.label}: {preset.blurb}</span> : null}
        <button type="button" className="text-button" disabled={busy} onClick={() => void openTemplate()}>{phase === "template" ? <LoaderCircle size={14} className="spin" /> : <Film size={14} />}Balonlar ve Dağlar şablonunu aç</button>
        <button type="button" className="text-button" disabled={busy} onClick={onMore}><FileUp size={14} />Storyboard dosyası ya da tüm seçenekler</button>
      </div>
    </section>

    {allCount ? <section className="shelf" aria-labelledby="shelf-title">
      <div className="shelf-head">
        <h2 id="shelf-title">Projelerin <span className="count">{allCount}</span></h2>
        {allCount > 6 ? <label className="search"><Search size={15} /><input aria-label="Projelerde ara" placeholder="Ara" value={query} onChange={(event) => onQuery(event.target.value)} /></label> : null}
      </div>
      {projects.length ? <div className="posters">{projects.map((project) => <Poster key={project.id} project={project} onOpen={() => onOpen(project)} onDuplicate={() => onDuplicate(project)} onDelete={() => onDelete(project)} />)}</div>
        : <p className="quiet">“{query}” ile eşleşen proje yok.</p>}
    </section> : null}
  </>;
}

function Poster({ project, onOpen, onDuplicate, onDelete }: { project: Project; onOpen: () => void; onDuplicate: () => void; onDelete: () => void }) {
  const running = project.run?.status === "running";
  return <article className="poster">
    <button type="button" className="poster-frame" onClick={onOpen} aria-label={`${project.title} projesini aç`}>
      <Image src={project.cover} alt="" fill sizes="(max-width: 700px) 100vw, (max-width: 1200px) 50vw, 33vw" unoptimized={project.cover.startsWith("/api/")} />
      <span className="poster-shade" />
      <span className={`state state-${running ? "live" : project.status}`}><i />{running ? `Üretimde %${Math.round(project.run?.progress ?? 0)}` : STATUS_LABEL[project.status]}</span>
      <span className="poster-copy"><strong>{project.title}</strong><small>{project.scenes.length} sahne, {project.duration || 0} sn{project.isExample ? ", örnek" : ""}</small></span>
      {running ? <span className="poster-progress" style={{ width: `${project.run?.progress ?? 0}%` }} /> : null}
    </button>
    <details className="menu">
      <summary className="icon-button" aria-label={`${project.title} seçenekleri`}><MoreHorizontal size={18} /></summary>
      <div className="menu-list">
        <button type="button" onClick={onDuplicate}><Copy size={14} />Kopyala</button>
        <a href={`/api/projects/${project.id}/export`} download><ArrowDownToLine size={14} />Planı indir</a>
        <button type="button" className="is-danger" onClick={onDelete}><X size={14} />Sil</button>
      </div>
    </details>
  </article>;
}

function PageTitle({ title, lead }: { title: string; lead: string }) {
  return <div className="page-title"><h1 className="marquee marquee-small">{title}</h1><p>{lead}</p></div>;
}

const MODEL_TYPE: Record<ModelProfile["type"], string> = { planning: "Planlama", image: "Görsel", review: "Kontrol", video: "Video", graphics: "Montaj" };

function Connections({ providers, models }: { providers: ProviderStatus; models: ModelProfile[] }) {
  const services = [
    { id: "gmi", name: "GMI Cloud", ready: providers.gmi, role: "Karakter, kare ve video üretimi (ücretli)", key: "GMI_API_KEY", url: "https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference", provider: "GMI" },
    { id: "higgsfield", name: "Higgsfield API", ready: Boolean(providers.higgsfield), role: "Seedance 2.5 ile video üretimi (ücretli)", key: "HIGGSFIELD_API_KEY", url: "https://open.higgsfield.ai/quick-start", provider: "Higgsfield" },
    { id: "deepseek", name: "DeepSeek", ready: Boolean(providers.deepseek), role: "Planlama, prompt yazımı, web araması ve kontrol", key: "DEEPSEEK_API_KEY", url: "https://api-docs.deepseek.com/", provider: "DeepSeek" },
    { id: "nvidia", name: "NVIDIA", ready: providers.nvidia, role: "Planlama ve görsel kontrolü (ücretsiz katman)", key: "NVIDIA_API_KEY", url: "https://build.nvidia.com/", provider: "NVIDIA" },
    { id: "ffmpeg", name: "FFmpeg", ready: providers.ffmpeg, role: "Kamera hareketi, ses ve montaj (bu bilgisayarda)", key: "FFMPEG_PATH", url: "https://ffmpeg.org/download.html", provider: "FFmpeg" },
  ];
  return <>
    <PageTitle title="Bağlantılar" lead="Anahtarlar yalnızca bu bilgisayardaki .env.local dosyasında durur; tarayıcıya gönderilmez." />
    <div className="services">{services.map((service) => <details key={service.id} className="service">
      <summary><span className={`state ${service.ready ? "state-ready" : "state-draft"}`}><i />{service.ready ? "Bağlı" : "Bağlı değil"}</span><strong>{service.name}</strong><span className="quiet">{service.role}</span><ChevronDown size={16} className="service-chevron" /></summary>
      <div className="service-body">
        {models.filter((model) => model.provider === service.provider).map((model) => <div key={model.id} className="service-model"><strong>{model.name}</strong><span>{MODEL_TYPE[model.type]}</span><p>{model.description}</p></div>)}
        <p className="quiet">{service.ready ? "Hazır." : <>.env.local dosyasına <code>{service.key}</code> ekleyip sunucuyu yeniden başlat.</>} <a href={service.url} target="_blank" rel="noreferrer">Resmî sayfa <ArrowUpRight size={13} /></a></p>
      </div>
    </details>)}</div>
  </>;
}

function Settings({ showExamples, onExamples, onExport }: { showExamples: boolean; onExamples: (value: boolean) => void; onExport: () => void }) {
  return <>
    <PageTitle title="Ayarlar" lead="Bu stüdyo yerel ve kişisel; projelerin bu bilgisayarda saklanır." />
    <div className="settings">
      <div className="setting"><div><strong>Örnek projeleri göster</strong><p className="quiet">Başlangıç için hazırlanan örnekler proje listesinde görünür.</p></div><button type="button" className={`switch ${showExamples ? "is-on" : ""}`} role="switch" aria-checked={showExamples} aria-label="Örnek projeleri göster" onClick={() => onExamples(!showExamples)}><span /></button></div>
      <div className="setting"><div><strong>Çalışma alanını indir</strong><p className="quiet">Bütün projeler ve planlar tek bir JSON dosyasında.</p></div><button type="button" className="button" onClick={onExport}><ArrowDownToLine size={16} />İndir</button></div>
      <p className="quiet with-icon"><ShieldCheck size={15} />Ücretli her üretim yalnızca senin onayladığın fiyat teklifiyle başlar.</p>
    </div>
  </>;
}

function QueueView({ projects, onOpen, onUpdate }: { projects: Project[]; onOpen: (project: Project) => void; onUpdate: (project: Project) => void }) {
  const activeIds = projects.filter((project) => project.run?.status === "running").map((project) => project.id).join(",");
  useEffect(() => {
    if (!activeIds) return;
    let active = true;
    const refresh = async () => {
      await Promise.all(activeIds.split(",").map(async (id) => {
        try { const response = await fetch(`/api/projects/${id}`); if (response.ok && active) onUpdate((await response.json()).project); } catch { /* The next poll recovers a transient local network error. */ }
      }));
    };
    const interval = setInterval(() => void refresh(), 1500);
    void refresh();
    return () => { active = false; clearInterval(interval); };
  }, [activeIds, onUpdate]);
  const withRuns = projects.filter((project) => project.run).toSorted((a, b) => (b.run!.startedAt).localeCompare(a.run!.startedAt));
  if (!withRuns.length) return <div className="empty"><Unplug size={26} /><p>Henüz bir üretim yok. Bir projede “Film” adımından başlatabilirsin.</p></div>;
  return <ol className="runs">{withRuns.map((project) => {
    const run = project.run!;
    return <li key={project.id}><button type="button" onClick={() => onOpen(project)}>
      <span className="run-thumb"><Image src={project.cover} alt="" fill sizes="96px" unoptimized={project.cover.startsWith("/api/")} /></span>
      <span className="run-copy"><strong>{project.title}</strong><span className="meter"><span style={{ width: `${run.progress}%` }} /></span></span>
      <span className={`state state-${run.status === "running" ? "live" : run.status === "completed" ? "ready" : run.status === "failed" ? "failed" : "draft"}`}><i />{run.status === "running" ? `%${Math.round(run.progress)}` : run.status === "completed" ? "Bitti" : run.status === "failed" ? "Durdu" : "İptal"}</span>
    </button></li>;
  })}</ol>;
}
