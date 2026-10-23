"use client";

import Image from "next/image";
import { ArrowRight, AudioLines, ChevronRight, Clapperboard, Film, Heart, ImageIcon, Layers3, MoveUpRight, Play, Plus, ScanFace, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { PRESETS } from "@/lib/cinema";
import type { Project } from "@/lib/types";
import type { StudioView } from "@/lib/studio-draft";

export const PRESET_IMAGES: Record<string, string> = { cinematic: "/images/mountains.jpg", anime: "/images/space.jpg", noir: "/images/desert.jpg", horror: "/images/mountains.jpg", documentary: "/images/mountains.jpg", retro: "/images/space.jpg", toon: "/images/desert.jpg", storybook: "/images/mountains.jpg", promo: "/images/desert.jpg" };

export function PresetGallery({ favorites, onFavorite, onPreset, onlyFavorites = false }: { favorites: string[]; onFavorite: (id: string) => void; onPreset: (id: string) => void; onlyFavorites?: boolean }) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const shown = PRESETS.filter((preset) => (!onlyFavorites || favorites.includes(`preset:${preset.id}`)) && (category === "all" || (category === "cinema" ? ["cinematic", "noir", "horror", "retro"].includes(preset.id) : category === "animation" ? ["anime", "toon", "storybook"].includes(preset.id) : ["documentary", "promo"].includes(preset.id))) && `${preset.label} ${preset.blurb}`.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")));
  return <section className="hf-presets">
    <div className="hf-filterbar"><div className="hf-filter-tabs" role="group" aria-label="Tarz kategorisi">{[{ id: "all", label: "Tümü" }, { id: "cinema", label: "Sinematik" }, { id: "animation", label: "Animasyon" }, { id: "brand", label: "Belgesel & marka" }].map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div><input className="hf-preset-search" aria-label="Tarzlarda ara" placeholder="Tarz ara…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {shown.length ? <div className="hf-preset-grid">{shown.map((preset) => <article key={preset.id} className={`hf-preset preset-${preset.id}`}><button className="hf-preset-open" type="button" onClick={() => onPreset(preset.id)} aria-label={`${preset.label} tarzını kullan`}><Image src={PRESET_IMAGES[preset.id]} alt="" fill sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 20vw" /><span className="hf-preset-scrim" /><span className="hf-preset-sample">TARZ ÖRNEĞİ</span><span className="hf-preset-center"><Play size={20} fill="currentColor" /></span><span className="hf-preset-caption"><strong>{preset.label}</strong><small>{preset.blurb}</small></span><span className="hf-preset-use">Tarzı kullan <ArrowRight size={14} /></span></button><button className="hf-heart" type="button" aria-label={`${preset.label} ${favorites.includes(`preset:${preset.id}`) ? "favorilerden çıkar" : "favorilere ekle"}`} aria-pressed={favorites.includes(`preset:${preset.id}`)} onClick={() => onFavorite(`preset:${preset.id}`)}><Heart size={16} fill={favorites.includes(`preset:${preset.id}`) ? "currentColor" : "none"} /></button></article>)}</div> : <div className="hf-empty"><Heart size={30} /><h2>{onlyFavorites ? "Favori tarzların burada" : "Tarz bulunamadı"}</h2><p>{onlyFavorites ? "Bir tarzın üzerindeki kalbe dokunarak kaydet." : "Başka bir arama veya kategori dene."}</p></div>}
  </section>;
}

export default function DiscoverStudio({ projects, favorites, onFavorite, onNavigate, onPreset, onOpen, onNew }: {
  projects: Project[]; favorites: string[]; onFavorite: (id: string) => void; onNavigate: (view: StudioView) => void; onPreset: (id: string) => void; onOpen: (project: Project) => void; onNew: () => void;
}) {
  return <div className="hf-discover">
    <section className="hf-feature-row" aria-label="Öne çıkan stüdyolar">
      <article className="hf-feature"><button type="button" className="hf-feature-visual feature-cinema" onClick={() => onNavigate("cinema")}><Image src="/images/mountains.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 40vw" preload /><span className="hf-feature-tag"><Clapperboard size={13} />CINEMA STUDIO</span><span className="feature-headline">HER KARENİN<br /><em>YÖNETMENİ SENSİN.</em></span><span className="feature-play"><MoveUpRight size={22} /></span><span className="feature-grain" /></button><h2>CINEMA STUDIO</h2><p>Hikâyeni yaz. Kamerayı kur. Filmini yönet.</p></article>
      <article className="hf-feature"><button type="button" className="hf-feature-visual feature-image" onClick={() => onNavigate("image")}><Image src="/images/desert.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 35vw" /><span className="hf-feature-tag"><ImageIcon size={13} />IMAGE STUDIO</span><span className="feature-editorial">MAKE<br /><i>IT</i> REAL<span>FİKİRDEN İLK KAREYE.</span></span><span className="feature-play"><MoveUpRight size={22} /></span></button><h2>GÖRSEL STÜDYOSU</h2><p>Tek bir fikir. Sınırsız görsel olasılık.</p></article>
      <article className="hf-feature"><button type="button" className="hf-feature-visual feature-motion" onClick={() => onNavigate("video")}><Image src="/images/space.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 35vw" /><span className="hf-feature-tag"><Film size={13} />AI VIDEO</span><span className="feature-headline">HAYALİNE<br /><em>HAREKET KAT.</em></span><span className="feature-play"><MoveUpRight size={22} /></span></button><h2>YAPAY ZEKÂ VİDEO</h2><p>Bir sahneyi, izlenmeye değer bir ana dönüştür.</p></article>
    </section>

    <section className="hf-studio-strip"><span className="hf-strip-icon"><Sparkles size={23} /></span><div><h2>BÜYÜK FİKİRLER. TEK BİR ÇALIŞMA ALANI.</h2><p>Görsel, video, karakter ve kurgu. Hepsi hikâyenin bir parçası.</p></div><button type="button" onClick={() => onNavigate("cinema")}>Oluşturmaya başla <ArrowRight size={16} /></button></section>

    <section className="hf-tools-section" aria-label="Yaratıcı araçlar"><button type="button" className="hf-cinema-banner" onClick={() => onNavigate("cinema")}><Image src="/images/mountains.jpg" alt="" fill sizes="(max-width: 800px) 100vw, 50vw" /><span className="hf-banner-content"><span className="hf-eyebrow">SENİN HİKÂYEN. SENİN VİZYONUN.</span><strong>CINEMA<br /><em>STUDIO</em></strong><span>İlk fikirden son kareye, kontrol sende.</span><span className="hf-lime-button">Stüdyoyu aç <ArrowRight size={16} /></span></span><span className="hf-banner-count">01 / 03</span></button><div className="hf-tool-grid">{[
      { id: "image" as const, title: "Görsel oluştur", text: "Bir fikri ilk karesine dönüştür", icon: ImageIcon, tone: "lime" },
      { id: "video" as const, title: "Video oluştur", text: "Karelerine hareket ver", icon: Film, tone: "blue" },
      { id: "characters" as const, title: "Karakterler", text: "Her sahnede aynı karakter", icon: ScanFace, tone: "purple" },
      { id: "effects" as const, title: "Tarzlar & efektler", text: "Filminin görsel dilini bul", icon: WandSparkles, tone: "orange" },
      { id: "audio" as const, title: "Ses stüdyosu", text: "Dış ses, müzik ve ses dengesi", icon: AudioLines, tone: "pink" },
      { id: "editor" as const, title: "Video editör", text: "Sahnelerini bir araya getir", icon: Layers3, tone: "cyan" },
    ].map((tool) => <button key={tool.id} type="button" className={`hf-tool tool-${tool.tone}`} onClick={() => onNavigate(tool.id)}><tool.icon size={21} strokeWidth={1.6} /><span><strong>{tool.title}</strong><small>{tool.text}</small></span><MoveUpRight size={14} /></button>)}</div></section>

    <section className="hf-section"><div className="hf-section-head"><div><span className="hf-eyebrow">BİR GÖRSEL DİL SEÇ</span><h2>HİKÂYENİN BİR TARZI OLSUN.</h2><p>Sinematik, anime, retro veya tamamen senin dünyan.</p></div><button type="button" className="hf-text-link" onClick={() => onNavigate("effects")}>Tüm tarzlar <ChevronRight size={16} /></button></div><PresetGallery favorites={favorites} onFavorite={onFavorite} onPreset={onPreset} /></section>

    <section className="hf-section"><div className="hf-section-head"><div><span className="hf-eyebrow">KALDIĞIN YERDEN DEVAM ET</span><h2>SENİN PROJELERİN.</h2><p>Hikâyeler, sahneler ve üretimler aynı yerde.</p></div><button type="button" className="hf-text-link" onClick={() => onNavigate("projects")}>Tüm projeler <ChevronRight size={16} /></button></div><div className="hf-project-grid"><button type="button" className="hf-project-new" onClick={onNew}><span><Plus size={26} /></span><strong>Yeni proje oluştur</strong><small>Bir sonraki hikâyeni başlat</small></button>{projects.slice(0, 3).map((project) => <button key={project.id} type="button" className="hf-project-tile" onClick={() => onOpen(project)}><span className="hf-project-image"><Image src={project.cover} alt="" fill sizes="(max-width: 600px) 50vw, 25vw" unoptimized={project.cover.startsWith("/api/")} /><span>{project.isExample ? "ÖRNEK PROJE" : project.output ? "FİLM HAZIR" : `${project.scenes.length} SAHNE`}</span></span><strong>{project.title}</strong><small>{project.aspectRatio} · {project.style}</small></button>)}</div></section>
    <footer className="hf-footer"><span>kadra<span className="brand-period">.</span></span><p>Hikâyelerin için yaratıcı çalışma alanı.</p><button type="button" onClick={() => onNavigate("connections")}>Bağlantıları yönet <ArrowRight size={14} /></button></footer>
  </div>;
}
