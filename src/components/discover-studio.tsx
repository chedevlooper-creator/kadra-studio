"use client";

import Image from "next/image";
import { ArrowRight, Camera, Check, ChevronRight, Clapperboard, Copy, Eye, Film, Heart, LayoutGrid, MoveUpRight, Play, Plus, ScanFace, Sparkles, Terminal, WandSparkles, X } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { PRESETS } from "@/lib/cinema";
import type { Project } from "@/lib/types";
import type { StudioView } from "@/lib/studio-draft";

export const PRESET_IMAGES: Record<string, string> = {
  cinematic: "/images/mountains.jpg",
  anime: "/images/space.jpg",
  noir: "/images/desert.jpg",
  horror: "/images/mountains.jpg",
  documentary: "/images/mountains.jpg",
  retro: "/images/space.jpg",
  toon: "/images/desert.jpg",
  storybook: "/images/mountains.jpg",
  promo: "/images/desert.jpg",
};

export function PresetGallery({ favorites, onFavorite, onPreset, onlyFavorites = false }: {
  favorites: string[]; onFavorite: (id: string) => void; onPreset: (id: string) => void; onlyFavorites?: boolean;
}) {
  const [category, setCategory] = useState("all");
  const [search, setSearch] = useState("");
  const shown = PRESETS.filter((preset) =>
    (!onlyFavorites || favorites.includes(`preset:${preset.id}`)) &&
    (category === "all" || (category === "cinema" ? ["cinematic", "noir", "horror", "retro"].includes(preset.id) : category === "animation" ? ["anime", "toon", "storybook"].includes(preset.id) : ["documentary", "promo"].includes(preset.id))) &&
    `${preset.label} ${preset.blurb}`.toLocaleLowerCase("tr").includes(search.toLocaleLowerCase("tr")),
  );
  return <section className="hf-presets">
    <div className="hf-filterbar"><div className="hf-filter-tabs" role="group" aria-label="Tarz kategorisi">{[{ id: "all", label: "Tümü" }, { id: "cinema", label: "Sinematik" }, { id: "animation", label: "Animasyon" }, { id: "brand", label: "Belgesel & marka" }].map((item) => <button key={item.id} type="button" aria-pressed={category === item.id} onClick={() => setCategory(item.id)}>{item.label}</button>)}</div><input className="hf-preset-search" aria-label="Tarzlarda ara" placeholder="Tarz ara…" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
    {shown.length ? <div className="hf-preset-grid">{shown.map((preset) => <article key={preset.id} className={`hf-preset preset-${preset.id}`}><button className="hf-preset-open" type="button" onClick={() => onPreset(preset.id)} aria-label={`${preset.label} tarzını kullan`}><Image src={PRESET_IMAGES[preset.id]} alt="" fill sizes="(max-width: 600px) 50vw, (max-width: 1000px) 33vw, 20vw" fetchPriority="low" /><span className="hf-preset-scrim" /><span className="hf-preset-sample">TARZ ÖRNEĞİ</span><span className="hf-preset-center"><Play size={20} fill="currentColor" /></span><span className="hf-preset-caption"><strong>{preset.label}</strong><small>{preset.blurb}</small></span><span className="hf-preset-use">Tarzı kullan <ArrowRight size={14} /></span></button><button className="hf-heart" type="button" aria-label={`${preset.label} ${favorites.includes(`preset:${preset.id}`) ? "favorilerden çıkar" : "favorilere ekle"}`} aria-pressed={favorites.includes(`preset:${preset.id}`)} onClick={() => onFavorite(`preset:${preset.id}`)}><Heart size={16} fill={favorites.includes(`preset:${preset.id}`) ? "currentColor" : "none"} /></button></article>)}</div> : <div className="hf-empty"><Heart size={30} /><h2>{onlyFavorites ? "Favori tarzların burada" : "Tarz bulunamadı"}</h2><p>{onlyFavorites ? "Bir tarzın üzerindeki kalbe dokunarak kaydet." : "Başka bir arama veya kategori dene."}</p></div>}
  </section>;
}

export default function DiscoverStudio({ projects, favorites, onFavorite, onNavigate, onPreset, onOpen, onNew, onLaunchPrompt }: {
  projects: Project[];
  favorites: string[];
  onFavorite: (id: string) => void;
  onNavigate: (view: StudioView) => void;
  onPreset: (id: string) => void;
  onOpen: (project: Project, step?: "story" | "cast" | "scenes" | "film") => void;
  onNew: () => void;
  onLaunchPrompt?: (presetId: string, prompt: string) => void;
}) {
  const [inspected, setInspected] = useState<Project | null>(null);
  const [copiedId, setCopiedId] = useState("");
  const inspectDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    if (inspected) inspectDialog.current?.showModal();
    else inspectDialog.current?.close();
    setCopiedId("");
  }, [inspected]);

  return <div className="hf-discover">
    <section className="hf-feature-row" aria-label="Öne çıkan stüdyolar">
      <article className="hf-feature">
        <button type="button" className="hf-feature-visual feature-cinema" onClick={() => onNavigate("cinema")}>
          <Image src="/images/mountains.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 40vw" preload />
          <span className="hf-feature-tag"><Clapperboard size={13} />CINEMA STUDIO 4.0</span>
          <span className="feature-headline">HER KARENİN<br /><em>YÖNETMENİ SENSİN.</em></span>
          <span className="feature-play"><MoveUpRight size={22} /></span>
          <span className="feature-grain" />
        </button>
        <h2>Cinema Studio 4.0</h2>
        <p>Hikâyeni yaz, anamorfik lens ve ışığı kur, çoklu sahneni yönet.</p>
      </article>
      <article className="hf-feature">
        <button type="button" className="hf-feature-visual feature-image" onClick={() => onNavigate("factory")}>
          <Image src="/images/desert.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 35vw" />
          <span className="hf-feature-tag"><Sparkles size={13} />CONTENT FACTORY · YENİ</span>
          <span className="feature-editorial">SERİ<br /><i>ÜRET</i><span>TREND TARZDAN HAZIR BÖLÜME.</span></span>
          <span className="feature-play"><MoveUpRight size={22} /></span>
        </button>
        <h2>Content Factory</h2>
        <p>Trend tarzlar girer, yayına hazır kısa dizi ve video serileri çıkar.</p>
      </article>
      <article className="hf-feature">
        <button type="button" className="hf-feature-visual feature-motion" onClick={() => onNavigate("video")}>
          <Image src="/images/space.jpg" alt="" fill sizes="(max-width: 600px) 90vw, 35vw" />
          <span className="hf-feature-tag"><Film size={13} />OMNI REFERENCE · AI VIDEO</span>
          <span className="feature-headline">HAYALİNE<br /><em>HAREKET KAT.</em></span>
          <span className="feature-play"><MoveUpRight size={22} /></span>
        </button>
        <h2>Yapay Zekâ Video &amp; Omni Referans</h2>
        <p>Metin, görsel ve @Karakter referanslarıyla tutarlı video çekimleri oluştur.</p>
      </article>
    </section>

    <section className="hf-studio-strip">
      <span className="hf-strip-icon"><Sparkles size={23} /></span>
      <div>
        <h2>BUGÜN NE OLUŞTURACAKSIN? TEK ÇALIŞMA ALANINDA TÜM STÜDYOLAR.</h2>
        <p>Cinema Studio 4.0, Popcorn Storyboard, Content Factory, Soul ID Karakterler ve Katman Onarımı aynı çatı altında.</p>
      </div>
      <button type="button" onClick={() => onNavigate("cinema")}>Cinema Studio&apos;yu aç <ArrowRight size={16} /></button>
    </section>

    <section className="hf-tools-section" aria-label="Yaratıcı araçlar">
      <button type="button" className="hf-cinema-banner" onClick={() => onNavigate("cinema")}>
        <Image src="/images/mountains.jpg" alt="" fill sizes="(max-width: 800px) 100vw, 50vw" fetchPriority="low" />
        <span className="hf-banner-content">
          <span className="hf-eyebrow">SENİN HİKÂYEN. SENİN VİZYONUN.</span>
          <strong>CINEMA<br /><em>STUDIO 4.0</em></strong>
          <span>İlk fikirden son kareye, lens, ışık ve @Karakter kontrolü sende.</span>
          <span className="hf-lime-button">Stüdyoyu aç <ArrowRight size={16} /></span>
        </span>
        <span className="hf-banner-count">4.0 / PRO</span>
      </button>
      <div className="hf-tool-grid">{[
        { id: "popcorn" as const, title: "Popcorn Storyboard", text: "Tek fikirden 4–8 tutarlı sahne", icon: LayoutGrid, tone: "lime", badge: "YENİ" },
        { id: "factory" as const, title: "Content Factory", text: "Hazır seri ve kısa video fabrikası", icon: Sparkles, tone: "orange", badge: "YENİ" },
        { id: "mcp" as const, title: "MCP & Ajan Becerileri", text: "Claude, ChatGPT ve /slash becerileri", icon: Terminal, tone: "cyan", badge: "MCP" },
        { id: "after-effects" as const, title: "After Effects & Motion", text: "AE eklentisi ve canlı .jsx kompozisyon", icon: Clapperboard, tone: "purple", badge: "AE" },
        { id: "characters" as const, title: "Karakterler · Soul ID", text: "Her sahnede aynı yüz ve mekân", icon: ScanFace, tone: "blue", badge: "SOUL" },
        { id: "layers" as const, title: "Katmanlar & Onarım", text: "Maskeli bölgesel yeniden çizim", icon: WandSparkles, tone: "pink", badge: "EDIT" },
      ].map((tool) => <button key={tool.id} type="button" className={`hf-tool tool-${tool.tone}`} onClick={() => onNavigate(tool.id)}>
        <div className="hf-tool-top"><tool.icon size={21} strokeWidth={1.6} />{tool.badge ? <span className="hf-tool-badge">{tool.badge}</span> : null}</div>
        <span><strong>{tool.title}</strong><small>{tool.text}</small></span>
        <MoveUpRight size={14} />
      </button>)}</div>
    </section>

    <section className="hf-section" aria-labelledby="inside-projects-heading">
      <div className="hf-section-head">
        <div>
          <span className="hf-eyebrow">PROMPTLARI, VARLIKLARI VE KAMERA KURULUMUNU GÖR</span>
          <h2 id="inside-projects-heading">HER PROJENİN İÇİNİ KEŞFET.</h2>
          <p>Her filmin hangi promptlarla, hangi karakter referanslarıyla ve hangi kamera hareketleriyle üretildiğini adım adım incele.</p>
        </div>
        <button type="button" className="hf-text-link" onClick={() => onNavigate("projects")}>Tüm projeler <ChevronRight size={16} /></button>
      </div>
      <div className="hf-xray-grid">
        {projects.slice(0, 3).map((project) => (
          <article key={project.id} className="hf-xray-card">
            <div className="hf-xray-cover">
              <Image src={project.cover} alt="" fill sizes="(max-width: 700px) 100vw, 33vw" fetchPriority="low" unoptimized={project.cover.startsWith("/api/")} />
              <span className="hf-xray-scrim" />
              <div className="hf-xray-badges">
                <span>{project.scenes.length} SAHNE</span>
                <span>{project.aspectRatio}</span>
                <span>{project.style}</span>
              </div>
              <button type="button" className="hf-xray-inspect-btn" onClick={() => setInspected(project)}>
                <Eye size={14} /> İçini incele
              </button>
            </div>
            <div className="hf-xray-body">
              <div className="hf-xray-title-row">
                <strong>{project.title}</strong>
                {project.characters.length ? <small>{project.characters.length} karakter</small> : <small>{project.duration || 0} sn</small>}
              </div>
              <p className="hf-xray-prompt-preview">
                {project.scenes[0]?.prompt || project.script}
              </p>
              <div className="hf-xray-shot-pills">
                {project.scenes.slice(0, 3).map((scene) => (
                  <span key={scene.id}>#{scene.order} {scene.camera}</span>
                ))}
              </div>
              <div className="hf-xray-actions">
                <button type="button" className="button button-small" onClick={() => setInspected(project)}>
                  <Eye size={13} /> Prompt &amp; Varlıklar
                </button>
                <button type="button" className="button button-small button-lamp" onClick={() => onOpen(project)}>
                  Projeyi aç <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </article>
        ))}
      </div>
    </section>

    <section className="hf-section"><div className="hf-section-head"><div><span className="hf-eyebrow">BİR GÖRSEL DİL SEÇ</span><h2>HİKÂYENİN BİR TARZI OLSUN.</h2><p>Sinematik, anime, retro veya tamamen senin dünyan.</p></div><button type="button" className="hf-text-link" onClick={() => onNavigate("effects")}>Tüm tarzlar <ChevronRight size={16} /></button></div><PresetGallery favorites={favorites} onFavorite={onFavorite} onPreset={onPreset} /></section>

    <section className="hf-section"><div className="hf-section-head"><div><span className="hf-eyebrow">KALDIĞIN YERDEN DEVAM ET</span><h2>SENİN PROJELERİN.</h2><p>Hikâyeler, sahneler ve üretimler aynı yerde.</p></div><button type="button" className="hf-text-link" onClick={() => onNavigate("projects")}>Tüm projeler <ChevronRight size={16} /></button></div><div className="hf-project-grid"><button type="button" className="hf-project-new" onClick={onNew}><span><Plus size={26} /></span><strong>Yeni proje oluştur</strong><small>Bir sonraki hikâyeni başlat</small></button>{projects.slice(0, 3).map((project) => <button key={project.id} type="button" className="hf-project-tile" onClick={() => onOpen(project)}><span className="hf-project-image"><Image src={project.cover} alt="" fill sizes="(max-width: 600px) 50vw, 25vw" fetchPriority="low" unoptimized={project.cover.startsWith("/api/")} /><span>{project.isExample ? "ÖRNEK PROJE" : project.output ? "FİLM HAZIR" : `${project.scenes.length} SAHNE`}</span></span><strong>{project.title}</strong><small>{project.aspectRatio} · {project.style}</small></button>)}</div></section>
    <footer className="hf-footer"><span>kadra<span className="brand-period">.</span></span><p>Hikâyelerin için yaratıcı çalışma alanı.</p><button type="button" onClick={() => onNavigate("connections")}>Bağlantıları yönet <ArrowRight size={14} /></button></footer>

    <dialog
      ref={inspectDialog}
      {...({ closedby: "any" } as Record<string, string>)}
      className="sheet hf-xray-dialog"
      aria-labelledby="xray-dialog-title"
      onCancel={() => setInspected(null)}
      onClick={(event) => {
        const dialog = event.currentTarget;
        const rect = dialog.getBoundingClientRect();
        const isInDialog =
          rect.top <= event.clientY &&
          event.clientY <= rect.top + rect.height &&
          rect.left <= event.clientX &&
          event.clientX <= rect.left + rect.width;
        if (!isInDialog) {
          setInspected(null);
        }
      }}
    >
      {inspected ? <>
        <div className="sheet-head">
          <div>
            <span className="hf-eyebrow">PROJE İÇ GÖRÜNÜMÜ · TÜM PROMPTLAR VE VARLIKLAR</span>
            <h2 id="xray-dialog-title">{inspected.title}</h2>
            <p className="quiet">{inspected.style} · {inspected.aspectRatio} · {inspected.scenes.length} sahne · {inspected.duration || 0} sn</p>
          </div>
          <button type="button" className="icon-button" aria-label="İncelemeyi kapat" onClick={() => setInspected(null)}><X size={19} /></button>
        </div>
        <div className="sheet-body hf-xray-dialog-body">
          {inspected.brief ? <div className="hf-xray-brief"><strong>Yönetmen Notu &amp; Görsel Yönlendirme</strong><p>{inspected.brief}</p></div> : null}
          <div className="hf-xray-cast">
            <h3>Model Yığını (Stack) &amp; Proje Klasörleri (The Prompter Anatomisi)</h3>
            <div className="hf-xray-shot-pills">
              <span>Nano Banana Pro · %41.3</span>
              <span>Seedance 2.5 · %28.6</span>
              <span>Soul Cinema Studio · %16.4</span>
              <span>Soul ID Location · %13.7</span>
            </div>
            <div className="hf-xray-shot-pills">
              <span>📁 All Assets ({inspected.scenes.length + inspected.characters.length + 2})</span>
              <span>📁 Characters ({inspected.characters.length})</span>
              <span>📁 Frames ({inspected.scenes.length})</span>
              <span>📁 Key Art (1)</span>
              <span>📁 Prompting Sequences ({inspected.scenes.length})</span>
              <span>📁 Music &amp; Audio ({inspected.music ? 1 : 0})</span>
            </div>
          </div>
          {inspected.characters.length ? <div className="hf-xray-cast">
            <h3>Karakter &amp; Mekân Varlıkları (@Elements)</h3>
            <div className="hf-xray-cast-list">
              {inspected.characters.map((char) => (
                <div key={char.id} className="hf-xray-cast-item">
                  <ScanFace size={16} />
                  <div>
                    <strong>@{char.name}</strong>
                    <small>{char.appearance}</small>
                  </div>
                </div>
              ))}
            </div>
          </div> : null}
          <div className="hf-xray-scenes">
            <h3>Sahne Promptları ve Kamera Kurulumu ({inspected.scenes.length})</h3>
            {inspected.scenes.map((scene) => (
              <div key={scene.id} className="hf-xray-scene-row">
                <div className="hf-xray-scene-thumb">
                  <Image src={scene.image} alt={scene.title} fill sizes="140px" unoptimized={scene.image.startsWith("/api/")} />
                  <span>#{String(scene.order).padStart(2, "0")} · {scene.duration}sn</span>
                </div>
                <div className="hf-xray-scene-info">
                  <div className="hf-xray-scene-head">
                    <strong>{scene.title}</strong>
                    <span><Camera size={12} /> {scene.camera} · {scene.model}</span>
                  </div>
                  <p>{scene.prompt}</p>
                  <button
                    type="button"
                    className="text-button"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(scene.prompt);
                        setCopiedId(scene.id);
                      } catch { /* Clipboard optional */ }
                    }}
                  >
                    {copiedId === scene.id ? <Check size={13} /> : <Copy size={13} />}
                    {copiedId === scene.id ? "Kopyalandı" : "Promptu kopyala"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="sheet-actions">
          {onLaunchPrompt && inspected.scenes[0] ? (
            <button
              type="button"
              className="button"
              onClick={() => {
                const firstPrompt = inspected.scenes[0].prompt;
                setInspected(null);
                onLaunchPrompt("cinematic", firstPrompt);
              }}
            >
              <Sparkles size={15} /> Cinema Studio&apos;da benzerini üret
            </button>
          ) : null}
          <button
            type="button"
            className="button button-lamp"
            onClick={() => {
              const target = inspected;
              setInspected(null);
              onOpen(target, "scenes");
            }}
          >
            Projeyi stüdyoda aç <ArrowRight size={15} />
          </button>
        </div>
      </> : null}
    </dialog>
  </div>;
}
