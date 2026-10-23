"use client";

import { useState, type ReactNode } from "react";
import { AudioLines, ChevronDown, ChevronRight, Clapperboard, Film, FolderOpen, Heart, Home, ImageIcon, Layers3, Menu, PanelLeftClose, Plus, Search, Settings2, Shapes, Sparkles, Unplug, WandSparkles, X } from "lucide-react";
import type { Project, ProviderStatus } from "@/lib/types";
import type { StudioView } from "@/lib/studio-draft";

const PRIMARY: { id: StudioView; label: string; icon: typeof Film }[] = [
  { id: "explore", label: "Keşfet", icon: Home }, { id: "image", label: "Görsel", icon: ImageIcon }, { id: "video", label: "Video", icon: Film }, { id: "audio", label: "Ses", icon: AudioLines },
];
const SECONDARY: { id: StudioView; label: string; badge?: string }[] = [
  { id: "cinema", label: "Cinema Studio", badge: "YENİ" }, { id: "effects", label: "Efektler" }, { id: "characters", label: "Karakterler" }, { id: "editor", label: "Video Editör" }, { id: "projects", label: "Projelerim" }, { id: "queue", label: "Üretimler" },
];

export function KadraMark({ small = false }: { small?: boolean }) {
  return <span className={`kadra-symbol ${small ? "is-small" : ""}`} aria-hidden="true"><Clapperboard size={small ? 17 : 23} strokeWidth={2.2} /></span>;
}

export default function WorkspaceShell({ view, selected, projects, providers, onNavigate, onOpen, onNew, children }: {
  view: StudioView; selected: boolean; projects: Project[]; providers: ProviderStatus; onNavigate: (view: StudioView) => void; onOpen: (project: Project) => void; onNew: () => void; children: ReactNode;
}) {
  const [menu, setMenu] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [search, setSearch] = useState("");
  const cinema = view === "cinema" && !selected;
  const running = projects.filter((project) => project.run?.status === "running").length;
  function navigate(next: StudioView) { setMenu(false); onNavigate(next); }

  return <div className={`workspace ${cinema ? "workspace-cinema" : ""} ${collapsed ? "sidebar-collapsed" : ""}`}>
    <a className="skip-link" href="#main-content">İçeriğe geç</a>
    {!cinema ? <>
      <header className="workspace-header">
        <a className="workspace-brand" href="/" onClick={(event) => { event.preventDefault(); navigate("explore"); }} aria-label="Kadra ana sayfa"><KadraMark /><span>kadra<span className="brand-period">.</span></span></a>
        <nav className="workspace-primary" aria-label="Oluşturma araçları">{PRIMARY.map((item) => <button key={item.id} type="button" aria-current={!selected && view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>{item.label}</button>)}</nav>
        <span className="header-divider" />
        <button type="button" className="header-cinema" aria-current={!selected && view === "cinema" ? "page" : undefined} onClick={() => navigate("cinema")}><Clapperboard size={15} />Cinema Studio <span>YENİ</span></button>
        <div className="workspace-header-end">
          <button type="button" className="header-assets" onClick={() => navigate("library")}><FolderOpen size={15} /><span>Varlıklarım</span></button>
          <button type="button" className="workspace-status" onClick={() => navigate("connections")} title="Servis bağlantıları"><i className={providers.gmi ? "connected" : ""} /><span>{providers.gmi ? "Stüdyo hazır" : "Bağlantılar"}</span></button>
          <button type="button" className="workspace-avatar" onClick={() => navigate("settings")} aria-label="Çalışma alanı ayarları">K</button>
          <button type="button" className="icon-button mobile-menu-toggle" aria-label={menu ? "Menüyü kapat" : "Menüyü aç"} aria-expanded={menu} onClick={() => setMenu(!menu)}>{menu ? <X size={20} /> : <Menu size={20} />}</button>
        </div>
      </header>
      <nav className="workspace-secondary" aria-label="Stüdyolar">{SECONDARY.map((item) => <button key={item.id} type="button" aria-current={!selected && view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>{item.label}{item.badge ? <span>{item.badge}</span> : null}{item.id === "queue" && running ? <i>{running}</i> : null}</button>)}<button type="button" onClick={() => navigate("favorites")}><Heart size={13} />Favoriler</button><button type="button" onClick={() => navigate("connections")}><Unplug size={13} />Bağlantılar</button></nav>
    </> : <>
      <header className="cinema-mobile-header"><button type="button" onClick={() => navigate("explore")} aria-label="Keşfete dön"><KadraMark small /></button><strong>Cinema Studio</strong><button type="button" className="icon-button" aria-label="Menüyü aç" aria-expanded={menu} onClick={() => setMenu(!menu)}><Menu size={20} /></button></header>
      <aside className="cinema-sidebar" aria-label="Cinema Studio gezinme">
        <div className="cinema-sidebar-brand"><button type="button" onClick={() => navigate("explore")}><KadraMark small />{!collapsed ? <><strong>Cinema Studio</strong><ChevronDown size={13} /></> : null}</button><button type="button" className="icon-button" aria-label={collapsed ? "Kenar çubuğunu aç" : "Kenar çubuğunu daralt"} onClick={() => setCollapsed(!collapsed)}>{collapsed ? <ChevronRight size={15} /> : <PanelLeftClose size={15} />}</button></div>
        <nav className="cinema-sidebar-nav" aria-label="Stüdyo bölümleri">{[
          { id: "cinema" as const, label: "Ana sayfa", icon: Home, tone: "silver" },
          { id: "library" as const, label: "Üretimlerim", icon: Sparkles, tone: "cyan" },
          { id: "characters" as const, label: "Karakterlerim", icon: Shapes, tone: "blue" },
          { id: "favorites" as const, label: "Favorilerim", icon: Heart, tone: "pink" },
          { id: "explore" as const, label: "Keşfet", icon: Layers3, tone: "silver" },
        ].map((item) => <button key={item.id} type="button" title={collapsed ? item.label : undefined} aria-label={item.label} aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}><span className={`sidebar-tool-icon tone-${item.tone}`}><item.icon size={16} /></span>{!collapsed ? item.label : null}</button>)}</nav>
        {!collapsed ? <div className="sidebar-projects"><label className="sidebar-project-label"><span>Projeler</span><Search size={13} /><input aria-label="Kenar çubuğunda proje ara" placeholder="Ara…" value={search} onChange={(event) => setSearch(event.target.value)} /></label><button type="button" className="sidebar-new" onClick={onNew}><Plus size={16} />Yeni proje</button><div className="sidebar-project-list">{projects.filter((project) => project.title.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr"))).slice(0, 12).map((project) => <button key={project.id} type="button" title={project.title} onClick={() => onOpen(project)}><Clapperboard size={17} /><span>{project.title}</span>{project.run?.status === "running" ? <i className="live-dot" /> : null}</button>)}</div></div> : null}
        <div className="sidebar-bottom"><button type="button" onClick={() => navigate("projects")} aria-label="Tüm projeler"><FolderOpen size={17} />{!collapsed ? <><span>Tüm projeler</span><ChevronRight size={14} /></> : null}</button><button type="button" onClick={() => navigate("connections")} aria-label="Bağlantılar"><Unplug size={17} />{!collapsed ? <><span>Bağlantılar</span><i className={providers.gmi ? "ready-dot" : "offline-dot"} /></> : null}</button><button type="button" onClick={() => navigate("settings")} aria-label="Ayarlar"><span className="workspace-avatar">K</span>{!collapsed ? <><span>Kişisel çalışma alanı</span><Settings2 size={15} /></> : null}</button></div>
      </aside>
    </>}
    {menu ? <nav className="workspace-mobile-menu" aria-label="Mobil menü">{[...PRIMARY, ...SECONDARY, { id: "library" as const, label: "Varlıklarım" }, { id: "favorites" as const, label: "Favoriler" }, { id: "connections" as const, label: "Bağlantılar" }, { id: "settings" as const, label: "Ayarlar" }].map((item) => <button key={item.id} type="button" aria-current={view === item.id ? "page" : undefined} onClick={() => navigate(item.id)}>{item.label}<ChevronRight size={15} /></button>)}</nav> : null}
    <div className="workspace-content">{children}</div>
    <nav className="workspace-mobile-dock" aria-label="Hızlı gezinme"><button type="button" aria-current={view === "explore" ? "page" : undefined} onClick={() => navigate("explore")}><Home size={19} />Keşfet</button><button type="button" aria-current={view === "library" ? "page" : undefined} onClick={() => navigate("library")}><FolderOpen size={19} />Arşiv</button><button type="button" className="dock-create" onClick={() => navigate("cinema")} aria-label="Cinema Studio ile oluştur"><WandSparkles size={22} /></button><button type="button" aria-current={view === "projects" ? "page" : undefined} onClick={() => navigate("projects")}><Film size={19} />Projeler</button><button type="button" aria-current={view === "settings" ? "page" : undefined} onClick={() => navigate("settings")}><Settings2 size={19} />Ayarlar</button></nav>
  </div>;
}
