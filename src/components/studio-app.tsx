"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowRight, ArrowUpRight, BookOpen, Check,
  ChevronDown, ChevronRight, Clapperboard, Clock3, Copy, Film, Folder,
  FolderOpen, Grid2X2, ImageIcon, Layers3, LayoutList, Menu, MoreHorizontal,
  Plus, Search, Settings2, ShieldCheck, SlidersHorizontal, Sparkles,
  Unplug, Video, WandSparkles, Workflow, X,
} from "lucide-react";
import type { AppBootstrap, ModelProfile, Project, ProjectStatus, ProviderStatus } from "@/lib/types";
import NewProjectDialog from "./new-project-dialog";

const ProjectStudio = dynamic(() => import("./project-studio"), {
  loading: () => <div className="view-loading"><span className="spinner" />Proje hazırlanıyor…</div>,
});

type View = "projects" | "queue" | "library" | "models" | "connections" | "settings";
type Filter = "all" | ProjectStatus;

const viewNames: Record<View, string> = {
  projects: "Projelerim", queue: "Üretim kuyruğu", library: "Medya arşivi",
  models: "Model kataloğu", connections: "Bağlantılar", settings: "Ayarlar",
};
const statusLabels: Record<ProjectStatus, string> = {
  draft: "Taslak", planned: "Storyboard hazır", producing: "Üretimde", ready: "Film hazır",
};
const navItems: { id: View; label: string; icon: typeof Folder }[] = [
  { id: "projects", label: "Projelerim", icon: FolderOpen },
  { id: "queue", label: "Üretim kuyruğu", icon: Workflow },
  { id: "library", label: "Medya arşivi", icon: ImageIcon },
];
const toolItems: { id: View; label: string; icon: typeof Folder }[] = [
  { id: "models", label: "Model kataloğu", icon: Layers3 },
  { id: "connections", label: "Bağlantılar", icon: Unplug },
  { id: "settings", label: "Ayarlar", icon: Settings2 },
];

function relativeDate(value: string) {
  const days = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 86400000));
  return days === 0 ? "Bugün düzenlendi" : days === 1 ? "Dün düzenlendi" : `${days} gün önce`;
}

async function apiProject(url: string, init: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init.headers } });
  const data = await response.json();
  if (!response.ok) throw new Error(data.error ?? "İşlem tamamlanamadı.");
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

export default function StudioApp({ initialData, initialProjectId }: { initialData: AppBootstrap; initialProjectId: string | null }) {
  const [projects, setProjects] = useState(initialData.projects);
  const [view, setView] = useState<View>("projects");
  const [selectedId, setSelectedId] = useState<string | null>(initialProjectId);
  const [newProject, setNewProject] = useState(false);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sort, setSort] = useState("updated");
  const [listView, setListView] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);
  const [toast, setToast] = useState("");
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Project | null>(null);
  const [deleting, setDeleting] = useState(false);
  const deleteDialog = useRef<HTMLDialogElement>(null);
  const [showExamples, setShowExamples] = useState(true);
  const [modelType, setModelType] = useState("all");
  const selectedProject = projects.find(project => project.id === selectedId) ?? null;

  useEffect(() => {
    const stored = localStorage.getItem("kadra.preferences.v1");
    if (stored) {
      try {
        const value = JSON.parse(stored);
        setShowExamples(value.showExamples !== false);
        setListView(value.listView === true);
      } catch { localStorage.removeItem("kadra.preferences.v1"); }
    }
    return () => { if (toastTimer.current) clearTimeout(toastTimer.current); };
  }, []);

  useEffect(() => {
    const popstate = () => {
      setSelectedId(new URLSearchParams(window.location.search).get("project"));
      setView("projects");
    };
    window.addEventListener("popstate", popstate);
    return () => window.removeEventListener("popstate", popstate);
  }, []);

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
    setProjects(current => {
      const exists = current.some(project => project.id === updated.id);
      return exists ? current.map(project => project.id === updated.id ? updated : project) : [updated, ...current];
    });
  }, []);

  function openProject(project: Project) {
    setSelectedId(project.id);
    setView("projects");
    window.history.pushState({}, "", `/?project=${encodeURIComponent(project.id)}`);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  function navigate(next: View) {
    setView(next);
    setSelectedId(null);
    setMobileNav(false);
    setQuery("");
    window.history.pushState({}, "", "/");
  }

  function savePreferences(next: { showExamples?: boolean; listView?: boolean }) {
    const preferences = { showExamples, listView, ...next };
    setShowExamples(preferences.showExamples);
    setListView(preferences.listView);
    localStorage.setItem("kadra.preferences.v1", JSON.stringify(preferences));
  }

  const filteredProjects = useMemo(() => {
    const result = projects.filter(project =>
      (showExamples || !project.isExample) &&
      (filter === "all" || project.status === filter) &&
      `${project.title} ${project.description} ${project.style}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")),
    );
    return result.toSorted((a, b) => sort === "name" ? a.title.localeCompare(b.title, "tr") : sort === "created" ? b.createdAt.localeCompare(a.createdAt) : b.updatedAt.localeCompare(a.updatedAt));
  }, [projects, query, filter, sort, showExamples]);
  const sceneCount = projects.reduce((sum, project) => sum + project.scenes.length, 0);
  const activeCount = projects.filter(project => project.run?.status === "running").length;

  async function duplicateProject(project: Project) {
    try {
      const copy = await apiProject("/api/projects", { method: "POST", body: JSON.stringify({ title: `${project.title.slice(0, 85)} · Kopya`, script: project.script, style: project.style, aspectRatio: project.aspectRatio, budget: project.budget }) });
      changeProject(copy);
      notify("Proje yeni bir taslak olarak kopyalandı.");
    } catch (error) { notify(error instanceof Error ? error.message : "Proje kopyalanamadı."); }
  }

  async function deleteProject() {
    if (!confirmDelete || deleting) return;
    setDeleting(true);
    try {
      const response = await fetch(`/api/projects/${confirmDelete.id}`, { method: "DELETE", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: confirmDelete.revision }) });
      if (!response.ok) { const data = await response.json(); throw new Error(data.error); }
      setProjects(current => current.filter(project => project.id !== confirmDelete.id));
      setConfirmDelete(null);
      notify("Proje silindi.");
    } catch (error) { notify(error instanceof Error ? error.message : "Proje silinemedi."); }
    finally { setDeleting(false); }
  }

  function renderProjectCard(project: Project) {
    return <article className={`project-card ${listView ? "project-card-list" : ""}`} key={project.id}>
      <button className="project-cover" onClick={() => openProject(project)} aria-label={`${project.title} projesini aç`}>
        <Image src={project.cover} alt={`${project.title} kapak görseli`} fill sizes={listView ? "160px" : "(max-width: 700px) 100vw, (max-width: 1100px) 45vw, 30vw"} unoptimized={project.cover.startsWith("/api/")} />
        <span className="cover-shade" /><span className="cover-type"><Film size={13} />{project.aspectRatio}</span>
        <span className="cover-open"><ArrowUpRight size={18} /></span>
        <span className="cover-bottom"><span>{project.style}</span><span><Clock3 size={12} />{project.duration || 0} sn</span></span>
      </button>
      <div className="project-info">
        <div className="project-name-row"><button className="project-title" onClick={() => openProject(project)}>{project.title}</button>
          <details className="card-menu"><summary className="icon-btn" aria-label={`${project.title} seçenekleri`}><MoreHorizontal size={18} /></summary><div className="dropdown-menu"><button onClick={() => void duplicateProject(project)}><Copy size={14} />Taslak olarak kopyala</button><a href={`/api/projects/${project.id}/export`} download><ArrowDownToLine size={14} />Planı indir</a><button className="danger-text" onClick={() => setConfirmDelete(project)}><X size={14} />Projeyi sil</button></div></details>
        </div>
        <p className="project-description">{project.description || "Yeni hikâyen ilk sahnesini bekliyor."}</p>
        <div className="project-meta"><span><Clapperboard size={13} />{project.scenes.length} sahne<span className="meta-dot">·</span>{relativeDate(project.updatedAt)}</span><span className={`status-badge status-${project.status}`}><i />{statusLabels[project.status]}</span></div>
        {project.isExample ? <span className="example-caption">{project.output ? "Örnek proje · üretilmiş film" : "Örnek proje · referans görseller"}</span> : null}
      </div>
    </article>;
  }

  return <div className="app-shell">
    {mobileNav ? <button className="nav-backdrop" aria-label="Menüyü kapat" onClick={() => setMobileNav(false)} /> : null}
    <aside className={`sidebar ${mobileNav ? "sidebar-open" : ""}`}>
      <a className="brand" href="/" onClick={event => { event.preventDefault(); navigate("projects"); }} aria-label="Kadra ana sayfa"><span className="brand-symbol"><span /><span /><span /></span><span>kadra<span className="brand-period">.</span></span><span className="brand-beta">BETA</span></a>
      <button className="workspace-select" onClick={() => navigate("settings")}><span className="workspace-avatar">K</span><span><strong>Kişisel stüdyom</strong><small>Yerel çalışma alanı</small></span><ChevronDown size={14} /></button>
      <div className="nav-heading">ÇALIŞMA ALANI</div>
      <nav aria-label="Çalışma alanı">{navItems.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "projects" ? <span className="nav-count">{projects.length}</span> : item.id === "queue" && activeCount > 0 ? <span className="nav-count">{activeCount}</span> : null}</button>)}</nav>
      <div className="nav-heading tools-heading">STÜDYO ARAÇLARI</div>
      <nav aria-label="Stüdyo araçları">{toolItems.map(item => <button key={item.id} className={`nav-item ${view === item.id ? "active" : ""}`} onClick={() => navigate(item.id)}><item.icon size={18} /><span>{item.label}</span>{item.id === "models" ? <span className="tiny-new">YENİ</span> : null}</button>)}</nav>
      <div className="sidebar-bottom"><div className="local-card"><span className="local-icon"><ShieldCheck size={17} /></span><strong>Hikâyen, senin alanın.</strong><p>Projelerin bu bilgisayarda saklanır. Dilediğinde dışa aktar.</p><button onClick={() => downloadJson({ version: 1, exportedAt: new Date().toISOString(), projects }, "kadra-calisma-alani.json")}>Çalışma alanını indir<ArrowUpRight size={13} /></button></div><button className="profile-button" onClick={() => navigate("settings")}><span className="profile-avatar">Y</span><span><strong>Yaratıcı</strong><small>Kişisel çalışma alanı</small></span><Settings2 size={15} /></button></div>
    </aside>

    <div className="main-shell">
      <header className="topbar"><div className="breadcrumb"><button className="icon-btn mobile-menu" onClick={() => setMobileNav(!mobileNav)} aria-label="Gezinme menüsünü aç"><Menu size={20} /></button><span>Çalışma alanım</span><ChevronRight size={13} /><strong>{selectedProject ? selectedProject.title : viewNames[view]}</strong></div><div className="topbar-right"><span className="local-status"><i />Yerel kayıt</span><button className="demo-badge" onClick={() => navigate("connections")}><span />{initialData.providers.gmi && initialData.providers.nvidia ? "GMI + NVIDIA · Bağlı" : initialData.providers.gmi ? "GMI Cloud · Bağlı" : initialData.providers.nvidia ? "Ücretsiz mod · NVIDIA" : "Ücretsiz mod"}<ChevronDown size={12} /></button><span className="topbar-avatar" aria-label="Kişisel profil">Y</span></div></header>

      <main id="main-content" className={`main-content ${selectedProject ? "editor-content" : ""}`}>
        {selectedProject ? <ProjectStudio key={selectedProject.id} project={selectedProject} providers={initialData.providers} videoModels={initialData.videoModels} onProjectChange={changeProject} onBack={() => navigate("projects")} notify={notify} /> : view === "projects" ? <>
          <div className="page-heading"><div><p className="eyebrow"><span className="small-spark" />YARATICI ALANIN</p><h1>Yeni bir hikâyeye ne dersin?</h1><p>Fikrini yaz. Sahnelerini kur. Hikâyene hareket kat.</p></div><button className="btn btn-primary" onClick={() => setNewProject(true)}><Plus size={17} />Yeni proje</button></div>

          <section className="hero-banner" aria-label="Yeni hikâye oluştur"><Image src="/images/mountains.jpg" alt="Bulutlar arasından yükselen dağ zirveleri" fill priority sizes="(max-width: 900px) 100vw, 80vw" /><div className="hero-overlay" /><div className="hero-copy"><span className="hero-overline"><Sparkles size={13} />FİKRİNDEN SON KAREYE</span><h2>Bir cümle yaz.<br /><span>Bir dünya kur.</span></h2><p>Senaryodan storyboard’a uzanan yaratıcı yolculuğun,<br className="desktop-break" /> tüm araçlarınla tek bir stüdyoda.</p><button className="btn hero-button" onClick={() => setNewProject(true)}>Hikâyeni oluşturmaya başla<ArrowUpRight size={16} /></button></div><div className="hero-corner"><span className="hero-corner-line" /><span>HAYAL ET. KURGULA. ÜRET.</span><span className="hero-frame">01 / ∞</span></div><div className="hero-caption">Dağın Hafızası <span>— örnek görsel dünya</span></div></section>

          <div className="workspace-stats"><div><span className="stat-icon"><Folder size={17} /></span><span><strong>{projects.length}<small>proje</small></strong><p>Her hikâye bir başlangıç</p></span></div><span className="stat-divider" /><div><span className="stat-icon"><Clapperboard size={17} /></span><span><strong>{sceneCount}<small>planlanan sahne</small></strong><p>Fikirler karelere dönüşüyor</p></span></div><span className="stat-divider" /><div><span className="stat-icon"><Workflow size={17} /></span><span><strong>{activeCount}<small>aktif üretim</small></strong><p>Kareler filme dönüşüyor</p></span></div><div className="stat-note"><span className="status-light" />Stüdyon hazır</div></div>

          <section className="projects-section"><div className="section-heading"><div><h2>Projelerin<span>{projects.length}</span></h2><p>Her büyük hikâye, küçük bir fikirle başlar.</p></div><div className="view-toggle" aria-label="Proje görünümü"><button className={!listView ? "active" : ""} aria-label="Izgara görünümü" aria-pressed={!listView} onClick={() => savePreferences({ listView: false })}><Grid2X2 size={15} /></button><button className={listView ? "active" : ""} aria-label="Liste görünümü" aria-pressed={listView} onClick={() => savePreferences({ listView: true })}><LayoutList size={17} /></button></div></div>
          <div className="project-toolbar"><div className="filter-tabs" aria-label="Proje durum filtresi">{([{ id: "all", label: "Tüm projeler" }, { id: "draft", label: "Taslaklar" }, { id: "planned", label: "Storyboard" }, { id: "producing", label: "Üretimde" }] as { id: Filter; label: string }[]).map(item => <button key={item.id} className={filter === item.id ? "active" : ""} onClick={() => setFilter(item.id)}>{item.label}{item.id === "all" ? <span>{projects.filter(p => showExamples || !p.isExample).length}</span> : null}</button>)}</div><div className="toolbar-actions"><label className="search-box"><Search size={15} /><input aria-label="Projelerde ara" placeholder="Projelerde ara…" value={query} onChange={event => setQuery(event.target.value)} /><kbd>⌕</kbd></label><label className="sort-select"><SlidersHorizontal size={14} /><select aria-label="Projeleri sırala" value={sort} onChange={event => setSort(event.target.value)}><option value="updated">Son düzenlenen</option><option value="created">En yeni</option><option value="name">İsme göre</option></select><ChevronDown size={12} /></label></div></div>
          <div className={listView ? "project-list" : "project-grid"}>{filteredProjects.map(renderProjectCard)}{query === "" && filter === "all" ? <button className="new-project-card" onClick={() => setNewProject(true)}><span className="new-project-plus"><Plus size={23} strokeWidth={1.5} /></span><strong>Bir sonraki hikâyen</strong><p>Boş bir sayfa, sonsuz olasılık.</p><span>Yeni proje oluştur<ArrowRight size={13} /></span></button> : null}</div>
          {filteredProjects.length === 0 && (query !== "" || filter !== "all") ? <div className="empty-state"><Search size={26} /><h3>Burada henüz bir proje yok.</h3><p>Aramanı veya durum filtresini değiştirebilirsin.</p><button className="btn btn-secondary" onClick={() => { setQuery(""); setFilter("all"); }}>Filtreleri temizle</button></div> : null}</section>

          <section className="workflow-strip"><span className="workflow-icon"><WandSparkles size={22} /></span><div><h3>Sen hikâyeye odaklan.</h3><p>Sahne planlama, model önerileri ve üretim takibi bir arada.</p></div><button onClick={() => navigate("models")}>Araçları keşfet<ArrowUpRight size={16} /></button><span className="workflow-decoration">✦</span></section>
          <footer className="page-footer"><span>Yaratıcılık sende. Olasılıklar burada.</span><span><span className="footer-dot" />Kadra Studio <small>v0.1</small></span></footer>
        </> : view === "models" ? <>
          <PageHeading eyebrow="YARATICI ARAÇLAR" title="Doğru sahne, doğru model." description="Her üretim adımı için yetenekleri karşılaştır, model seçiminin nedenini gör." />
          <div className="info-banner"><BookOpen size={18} /><p>Planlama, görsel ve kontrol adımları NVIDIA’nın ücretsiz katmanında veya GMI Cloud ücretli modellerinde; kamera hareketi ve montaj bu bilgisayarda FFmpeg ile çalışır. Ücretli görsel (Nano Banana, Seedream, Hunyuan) ve video (Veo, Kling, Seedance, Wan, Hailuo) modellerini projenin <strong>Üretim</strong> sekmesindeki GMI panelinden seçebilirsin.</p></div>
          <div className="filter-tabs model-filters">{[{ id: "all", label: "Tüm araçlar" }, { id: "planning", label: "Planlama" }, { id: "image", label: "Görsel" }, { id: "review", label: "Kontrol" }, { id: "graphics", label: "Montaj" }, { id: "video", label: "Video" }].map(item => <button key={item.id} className={modelType === item.id ? "active" : ""} onClick={() => setModelType(item.id)}>{item.label}</button>)}</div>
          <div className="model-grid">{initialData.models.filter(model => modelType === "all" || model.type === modelType).map(model => <ModelCard key={model.id} model={model} onSetup={() => navigate("connections")} />)}</div>
          <div className="explanation-card"><Sparkles size={21} /><div><h3>Model seçimi nasıl çalışacak?</h3><p>Nemotron senaryoyu karakterler ve çekimlerle planlar. Her video çekimi için FLUX.2 Klein bir başlangıç karesi üretir, Nemotron VL kareyi açıklamayla karşılaştırır, FFmpeg kamera hareketi verip tüm çekimleri tek filmde birleştirir. Yazı kartları yapay zekâya bırakılmaz; metin olarak çizilir.</p></div></div>
        </> : view === "connections" ? <Connections providers={initialData.providers} /> : view === "settings" ? <>
          <PageHeading eyebrow="SANA AİT STÜDYO" title="Çalışma alanı ayarları" description="Yerel verilerini yönet, çalışma görünümünü kendine göre düzenle." />
          <section className="settings-card"><h2>Görünüm tercihleri</h2><div className="setting-row"><div><strong>Örnek projeleri göster</strong><p>Stüdyoyu keşfetmek için hazırlanan örnekler proje listesinde görünür.</p></div><button className={`switch ${showExamples ? "on" : ""}`} role="switch" aria-checked={showExamples} aria-label="Örnek projeleri göster" onClick={() => savePreferences({ showExamples: !showExamples })}><span /></button></div><div className="setting-row"><div><strong>Liste görünümü</strong><p>Projelerini daha kompakt bir listede göster.</p></div><button className={`switch ${listView ? "on" : ""}`} role="switch" aria-checked={listView} aria-label="Liste görünümü" onClick={() => savePreferences({ listView: !listView })}><span /></button></div></section>
          <section className="settings-card"><h2>Veriler ve saklama</h2><div className="setting-row"><div><strong>Çalışma alanını dışa aktar</strong><p>Projelerini, senaryolarını ve sahne planlarını JSON olarak indir.</p></div><button className="btn btn-secondary" onClick={() => downloadJson({ version: 1, exportedAt: new Date().toISOString(), projects }, "kadra-calisma-alani.json")}><ArrowDownToLine size={16} />Verilerimi indir</button></div><div className="storage-note"><ShieldCheck size={17} /><span>Projeler bu bilgisayardaki yerel dosyada saklanır. Bu sürüm kişisel, yerel kullanım içindir.</span></div></section>
        </> : view === "queue" ? <>
          <PageHeading eyebrow="ÜRETİM MERKEZİ" title="Her adım kontrolün altında." description="Üretimleri, sahne durumlarını ve işlem geçmişini takip et." />
          <QueueView projects={projects} onOpen={openProject} onUpdate={changeProject} />
        </> : <>
          <PageHeading eyebrow="GÖRSEL DÜNYAN" title="İlhamının arşivi." description="Projelerinde üretilen kareleri, filmleri ve görsel dünyaları keşfet." />
          <div className="info-banner"><ImageIcon size={17} /><p>Üretilen kareler ve filmler bu bilgisayardaki .data/media klasöründe saklanır. Henüz üretim yapılmamış projelerde örnek referans görseller görünür.</p></div>
          <div className="library-grid">{projects.filter(project => project.scenes.length > 0).map(project => <button className="library-card" key={project.id} onClick={() => openProject(project)}><div><Image src={project.cover} alt={`${project.title} görseli`} fill sizes="(max-width: 700px) 100vw, 40vw" unoptimized={project.cover.startsWith("/api/")} /></div><span><strong>{project.title}</strong><small>{project.output ? `Film hazır · ${Math.round(project.output.duration)} sn` : project.scenes.some(scene => scene.imageSource === "generated") ? `${project.scenes.filter(scene => scene.imageSource === "generated").length} üretilmiş kare` : `Referans dünya · ${project.scenes.length} sahne`}</small><ArrowUpRight size={18} /></span></button>)}</div>
          {projects.every(project => project.scenes.length === 0) ? <div className="empty-state"><ImageIcon size={28} /><h3>Görsel arşivin burada büyüyecek.</h3><p>İlk sahne planını oluşturarak başlayabilirsin.</p><button className="btn btn-primary" onClick={() => setNewProject(true)}>Yeni proje</button></div> : null}
        </>}
      </main>
    </div>

    <NewProjectDialog open={newProject} onClose={() => setNewProject(false)} onCreated={project => { changeProject(project); setNewProject(false); openProject(project); notify("Projen oluşturuldu. Hikâyeni geliştirmeye başlayabilirsin."); }} />
    <dialog ref={deleteDialog} className="confirm-dialog" onCancel={() => { if (!deleting) setConfirmDelete(null); }} onClick={event => { if (event.target === event.currentTarget && !deleting) setConfirmDelete(null); }} aria-labelledby="delete-title"><div className="dialog-card"><h2 id="delete-title">Projeyi silmek istiyor musun?</h2><p><strong>{confirmDelete?.title}</strong> ve kayıtlı sahne planı bu çalışma alanından silinecek.</p><div className="dialog-actions"><button className="btn btn-secondary" disabled={deleting} onClick={() => setConfirmDelete(null)}>Vazgeç</button><button className="btn btn-danger" disabled={deleting} onClick={() => void deleteProject()}>{deleting ? "Siliniyor…" : "Projeyi sil"}</button></div></div></dialog>
    {toast ? <div className="toast" role="status"><Check size={17} /><span>{toast}</span><button className="icon-btn" onClick={() => setToast("")} aria-label="Bildirimi kapat"><X size={15} /></button></div> : null}
  </div>;
}

function PageHeading({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return <div className="page-heading secondary-heading"><div><p className="eyebrow"><span className="small-spark" />{eyebrow}</p><h1>{title}</h1><p>{description}</p></div></div>;
}

const MODEL_TYPE_LABEL: Record<ModelProfile["type"], string> = { planning: "Planlama", image: "Görsel", review: "Kontrol", video: "Video", graphics: "Montaj" };

function ModelCard({ model, onSetup }: { model: ModelProfile; onSetup: () => void }) {
  return <article className="model-card"><div className="model-card-top"><span className={`provider-mark provider-${model.provider.toLowerCase()}`}>{model.provider === "NVIDIA" ? "N" : model.provider === "DeepSeek" ? "DS" : model.provider === "FFmpeg" ? "ff" : model.provider === "GMI" ? "G" : "Aa"}</span><span className="model-type">{model.type === "image" || model.type === "review" ? <ImageIcon size={13} /> : model.type === "video" ? <Video size={13} /> : model.type === "planning" ? <Sparkles size={13} /> : <Film size={13} />}{MODEL_TYPE_LABEL[model.type]}</span></div><h3>{model.name}</h3><p>{model.description}</p><div className="model-tags">{model.tags.map(tag => <span key={tag}>{tag}</span>)}</div><div className="model-card-bottom"><span>{model.provider} · {model.configured ? "Bağlı" : "Anahtar bekliyor"}</span><button onClick={onSetup}>Bağlantı<ArrowUpRight size={14} /></button></div></article>;
}

function Connections({ providers }: { providers: ProviderStatus }) {
  const [expanded, setExpanded] = useState<string | null>(providers.deepseek ? null : "deepseek");
  const items = [
    { id: "deepseek", name: "DeepSeek API Köprüsü", icon: "DS", description: "Modeller arası köprü: web arama, senaryo planlama, görsel hakem ve referans hazırlığı", ready: Boolean(providers.deepseek), status: providers.deepseek ? "Bağlı" : "Anahtar yok", url: "https://api-docs.deepseek.com/", detail: "DeepSeek V4.1 Flash ve Web Search API (/v1/tools/search) karakterleri webde araştırır, çok dilli Wikimedia sorguları üretir, senaryoyu planlar, üretilen karakter sayfalarını ve sahne karelerini referans görsellerle karşılaştırır.", steps: ["platform.deepseek.com üzerinden bir API anahtarı oluştur.", "Anahtarı proje klasöründeki .env.local dosyasına DEEPSEEK_API_KEY=… olarak ekle.", "Sunucuyu yeniden başlat; durum burada Bağlı olarak görünür."] },
    { id: "nvidia", name: "NVIDIA", icon: "N", description: "Planlama, görsel üretimi ve kalite kontrolü · ücretsiz katman", ready: providers.nvidia, status: providers.nvidia ? "Bağlı" : "Anahtar yok", url: "https://build.nvidia.com/", detail: "Nemotron 3 Ultra senaryoyu planlar, FLUX.2 Klein kareleri üretir, Nemotron 3.5 Super VL kareleri kontrol eder (yoğunlukta Nano Omni devreye girer). Ücretsiz katman geliştirme ve deneme içindir; dakikada yaklaşık 40 istek sınırı vardır.", steps: ["build.nvidia.com üzerinden ücretsiz bir API anahtarı oluştur.", "Anahtarı proje klasöründeki .env.local dosyasına NVIDIA_API_KEY=… olarak ekle.", "Sunucuyu yeniden başlat; durum burada Bağlı olarak görünür."] },
    { id: "ffmpeg", name: "FFmpeg", icon: "ff", description: "Kamera hareketi, yazı kartları ve film montajı · bu bilgisayarda", ready: providers.ffmpeg, status: providers.ffmpeg ? "Bulundu" : "Bulunamadı", url: "https://ffmpeg.org/download.html", detail: "Her kareye kamera hareketi verir, yazı kartlarını Türkçe karakterlerle çizer ve tüm çekimleri tek MP4 dosyasında birleştirir. İnternet bağlantısı veya ücret gerektirmez.", steps: ["FFmpeg kurulu değilse resmî sayfadan kur.", "Farklı bir konumdaysa .env.local içine FFMPEG_PATH=… ekle."] },
    { id: "gmi", name: "GMI Cloud", icon: "G", description: "Referanslı görsel (Nano Banana 2.1) ve yapay zekâ videosu (Veo, Kling, Seedance) · ücretli", ready: providers.gmi, status: providers.gmi ? "Bağlı · ücretli" : "Yapılandırılmadı", url: "https://docs.gmicloud.ai/inference-engine/api-reference/video-api-reference", detail: "Onaylı karakter sayfalarını referans alarak kare üreten Gemini Nano Banana 2.1 ve kareleri videoya dönüştüren ücretli motorlar. Her istekten önce canlı fiyatla maliyet hesaplanır ve yalnızca onayınla çalışır.", steps: ["GMI konsolunda bakiyeni kontrol et.", "Anahtar .env.local içinde GMI_API_KEY olarak durur.", "Ücretli her üretim yalnızca teklif onayınla başlar."] },
  ];
  return <>
    <PageHeading eyebrow="MOTORLARINI BİR ARAYA GETİR" title="Yaratıcı araçların, tek stüdyoda." description="Hangi motorların bağlı olduğunu gör, eksik olanları nasıl ekleyeceğini öğren." />
    <div className="info-banner"><ShieldCheck size={18} /><p>API anahtarları yalnızca sunucuda, proje klasöründeki .env.local dosyasında tutulur; tarayıcıya gönderilmez. Ücretsiz mod hiçbir ücretli servis çağırmaz.</p></div>
    <div className="connections-list">{items.map(provider => <article className="connection-card" key={provider.id}><div className="connection-main"><span className={`provider-mark provider-${provider.id}`}>{provider.icon}</span><div><h3>{provider.name}</h3><p>{provider.description}</p></div><span className={`connection-status ${provider.ready ? "connection-ready" : ""}`}><i />{provider.status}</span><button className="btn btn-secondary" aria-expanded={expanded === provider.id} onClick={() => setExpanded(expanded === provider.id ? null : provider.id)}>Kurulum bilgisi<ChevronDown size={14} /></button></div>{expanded === provider.id ? <div className="connection-details"><p>{provider.detail}</p><ol>{provider.steps.map(step => <li key={step}>{step}</li>)}</ol><a href={provider.url} target="_blank" rel="noreferrer">Resmî sayfa<ArrowUpRight size={14} /></a></div> : null}</article>)}</div>
    <div className="explanation-card"><Unplug size={22} /><div><h3>Önce ücretsiz, çalışan bir hat.</h3><p>Senaryo → plan → kareler → kontrol → klipler → film zinciri ücretsiz çalışır. Ücretli video motorları bu hattın üstüne, bütçe denetimiyle eklenecek.</p></div></div>
  </>;
}

function QueueView({ projects, onOpen, onUpdate }: { projects: Project[]; onOpen: (project: Project) => void; onUpdate: (project: Project) => void }) {
  const activeIds = projects.filter(project => project.run?.status === "running").map(project => project.id).join(",");
  useEffect(() => {
    if (!activeIds) return;
    let active = true;
    const refresh = async () => {
      await Promise.all(activeIds.split(",").map(async id => {
        try { const response = await fetch(`/api/projects/${id}`); if (response.ok && active) { const data = await response.json(); onUpdate(data.project); } } catch { /* Next poll can recover a transient local network error. */ }
      }));
    };
    const interval = setInterval(() => void refresh(), 1500);
    void refresh();
    return () => { active = false; clearInterval(interval); };
  }, [activeIds, onUpdate]);
  const withRuns = projects.filter(project => project.run);
  if (withRuns.length === 0) return <div className="empty-state queue-empty"><span className="empty-icon-stack"><Workflow size={32} /></span><span className="eyebrow">SAHNE ARKASI HAZIR</span><h3>İlk hikâyenin sırasını bekliyor.</h3><p>Bir projenin Üretim sekmesinden ücretsiz üretimi başlat.<br />Adım adım ilerlemeyi burada takip edebilirsin.</p>{projects[0] ? <button className="btn btn-secondary" onClick={() => onOpen(projects[0])}>Örnek projeyi keşfet<ArrowRight size={15} /></button> : null}</div>;
  return <div className="queue-list">{withRuns.map(project => <button className="queue-card" key={project.id} onClick={() => onOpen(project)}><span className="queue-thumb"><Image src={project.cover} alt="" fill sizes="90px" unoptimized={project.cover.startsWith("/api/")} /></span><span className="queue-copy"><strong>{project.title}</strong><span>Ücretsiz üretim · {project.scenes.length} sahne</span><span className="progress-track"><span style={{ width: `${project.run?.progress ?? 0}%` }} /></span></span><span className="queue-state">{project.run?.status === "completed" ? "Film hazır" : project.run?.status === "cancelled" ? "Durduruldu" : project.run?.status === "failed" ? "Hata" : `%${Math.round(project.run?.progress ?? 0)}`}<ChevronRight size={16} /></span></button>)}</div>;
}
