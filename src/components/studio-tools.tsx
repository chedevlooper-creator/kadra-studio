"use client";

import dynamic from "next/dynamic";
import { useState } from "react";
import { ArrowRight, AudioLines, Clapperboard, FolderOpen, Plus, ScanFace } from "lucide-react";
import type { Project, ProviderStatus } from "@/lib/types";
import "./project-studio.css";

const CharacterBank = dynamic(() => import("./character-bank"));
const MusicLane = dynamic(() => import("./music-lane"));
const NarrationPanel = dynamic(() => import("./narration-panel"));
const ExportPanel = dynamic(() => import("./export-panel"));

const TOOLS = {
  characters: { title: "Karakter stüdyosu", eyebrow: "HER SAHNEDE AYNI KARAKTER", description: "Karakterlerini ve mekânlarını tanımla. Referans fotoğraflarını ekle, oluşturulan sayfaları onayla.", icon: ScanFace },
  audio: { title: "Ses stüdyosu", eyebrow: "HİKÂYENİN BİR SESİ OLSUN", description: "Türkçe dış ses, müzik ve ses dengesi. Bütün sesler projenle birlikte saklanır.", icon: AudioLines },
  editor: { title: "Video editör", eyebrow: "HER ŞEYİ BİR ARAYA GETİR", description: "Sahnelerini düzenle, filmini izle ve istediğin ekran oranında dışa aktar.", icon: Clapperboard },
};

export default function StudioTools({ tool, projects, providers, onProjectChange, onOpen, onNew, notify }: { tool: keyof typeof TOOLS; projects: Project[]; providers: ProviderStatus; onProjectChange: (project: Project) => void; onOpen: (project: Project, step?: "story" | "cast" | "scenes" | "film") => void; onNew: () => void; notify: (message: string) => void }) {
  const [projectId, setProjectId] = useState(() => projects.find((project) => !project.isExample)?.id ?? projects[0]?.id ?? "");
  const project = projects.find((item) => item.id === projectId);
  const config = TOOLS[tool];
  const running = project?.run?.status === "running";
  return <section className="hf-tools-page"><div className="hf-section-head"><div><span className="hf-eyebrow">{config.eyebrow}</span><h1><config.icon size={30} strokeWidth={1.5} />{config.title}</h1><p>{config.description}</p></div><button type="button" className="button" onClick={onNew}><Plus size={16} />Yeni proje</button></div><div className="hf-tool-project-picker"><FolderOpen size={18} /><label><span>Çalışılacak proje</span><select aria-label="Çalışılacak proje" value={projectId} onChange={(event) => setProjectId(event.target.value)}>{projects.map((item) => <option key={item.id} value={item.id}>{item.title}{item.isExample ? " · Örnek" : ""}</option>)}</select></label>{project ? <button type="button" className="hf-text-link" onClick={() => onOpen(project, tool === "characters" ? "cast" : "film")}>Projede aç <ArrowRight size={15} /></button> : null}</div>{project ? <div className="hf-tools-body" key={`${tool}:${project.id}`}>
      {running ? <p className="note note-warn">Üretim sürüyor. Değişiklikler üretim tamamlandıktan sonra açılır.</p> : null}
      {tool === "characters" ? <CharacterBank project={project} providers={providers} disabled={running} onProjectChange={onProjectChange} notify={notify} /> : tool === "audio" ? <><NarrationPanel project={project} disabled={running} onProjectChange={onProjectChange} notify={notify} /><MusicLane project={project} disabled={running} onProjectChange={onProjectChange} notify={notify} /><div className="hf-tool-info"><strong>Dış ses metnini sahnelerde düzenle</strong><p>Her çekimin metni ayrı okunur. Seslendirme üretim sırasında filme eklenir.</p><button type="button" className="button" onClick={() => onOpen(project, "scenes")}>Sahne metinlerini düzenle <ArrowRight size={15} /></button></div></> : <>{project.output ? <div className="hf-editor-player"><video key={project.output.url} src={project.output.url} controls playsInline preload="metadata" /></div> : <div className="hf-empty"><Clapperboard size={40} strokeWidth={1.2} /><h2>Filminin kurgusunu hazırla</h2><p>{project.scenes.length} sahnen var. Çekim sırası, süreler ve geçişleri proje editöründen düzenle.</p></div>}<div className="hf-editor-shot-strip">{project.scenes.map((scene) => <button type="button" key={scene.id} onClick={() => onOpen(project, "scenes")}><span>{String(scene.order).padStart(2, "0")}</span><strong>{scene.title}</strong><small>{scene.duration} sn</small></button>)}</div><div className="row"><button type="button" className="button button-lamp" onClick={() => onOpen(project, "scenes")}>Sahneleri düzenle <ArrowRight size={16} /></button><button type="button" className="button" onClick={() => onOpen(project, "film")}>Üretim ve montaj <Clapperboard size={16} /></button></div>{project.output ? <ExportPanel project={project} /> : null}</>}
    </div> : <div className="hf-empty"><FolderOpen size={35} /><h2>Önce bir proje oluştur</h2><p>Karakter, ses ve kurgu ayarları projeye bağlı saklanır.</p><button type="button" className="button button-lamp" onClick={onNew}><Plus size={16} />Proje oluştur</button></div>}</section>;
}
