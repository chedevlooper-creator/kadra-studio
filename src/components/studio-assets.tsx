"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { ArrowDownToLine, ArrowUpRight, AudioLines, Check, Copy, Film, FolderOpen, Heart, ImageIcon, Search, Shapes, X } from "lucide-react";
import type { Project } from "@/lib/types";

interface Asset { id: string; url: string; title: string; kind: "image" | "video" | "audio" | "character"; project: Project; prompt: string; }

function assetsOf(projects: Project[]): Asset[] {
  return projects.flatMap((project) => {
    const assets: Asset[] = project.scenes.filter((scene) => scene.imageSource === "generated").map((scene) => ({ id: scene.image, url: scene.image, title: scene.title, kind: "image", project, prompt: scene.prompt }));
    if (project.output) assets.push({ id: project.output.url, url: project.output.url, title: project.title, kind: "video", project, prompt: project.script });
    for (const clip of project.clips) {
      const url = `/api/projects/${project.id}/media/${clip.file}`;
      assets.push({ id: url, url, title: `${project.scenes.find((scene) => scene.id === clip.sceneId)?.title ?? project.title} · Klip`, kind: "video", project, prompt: project.scenes.find((scene) => scene.id === clip.sceneId)?.motionPrompt ?? "" });
    }
    for (const character of project.characters) for (const attempt of character.sheet.attempts) assets.push({ id: attempt.url, url: attempt.url, title: character.name, kind: "character", project, prompt: character.appearance });
    if (project.music) { const url = `/api/projects/${project.id}/media/${project.music.file}`; assets.push({ id: url, url, title: project.music.name, kind: "audio", project, prompt: "" }); }
    return assets;
  }).filter((asset, index, all) => all.findIndex((other) => other.id === asset.id) === index);
}

const KIND_LABEL = { image: "Görsel", video: "Video", audio: "Ses", character: "Karakter" };
const KIND_ICON = { image: ImageIcon, video: Film, audio: AudioLines, character: Shapes };

export default function StudioAssets({ projects, favorites, onFavorite, onOpen, onCreate, onlyFavorites = false }: { projects: Project[]; favorites: string[]; onFavorite: (id: string) => void; onOpen: (project: Project) => void; onCreate: () => void; onlyFavorites?: boolean }) {
  const [kind, setKind] = useState("all");
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState<Asset | null>(null);
  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState("");
  const dialog = useRef<HTMLDialogElement>(null);
  const assets = assetsOf(projects).filter((asset) => !onlyFavorites || favorites.includes(asset.id));
  const shown = assets.filter((asset) => (kind === "all" || asset.kind === kind) && `${asset.title} ${asset.project.title}`.toLocaleLowerCase("tr").includes(query.toLocaleLowerCase("tr")));
  useEffect(() => { if (selected) dialog.current?.showModal(); else dialog.current?.close(); setCopied(false); setCopyError(""); }, [selected]);

  return <section className="hf-assets">
    <div className="hf-section-head"><div><span className="hf-eyebrow">YARATICI ARŞİVİN</span><h1>{onlyFavorites ? "Favori varlıklarım" : "Varlıklarım"}</h1><p>Ürettiğin görseller, videolar, karakterler ve ses dosyaları.</p></div><button type="button" className="button button-lamp" onClick={onCreate}><ImageIcon size={16} />Yeni oluştur</button></div>
    <div className="hf-filterbar"><div className="hf-filter-tabs" role="group" aria-label="Varlık türü">{[{ id: "all", label: "Tümü" }, ...Object.entries(KIND_LABEL).map(([id, label]) => ({ id, label }))].map((item) => <button key={item.id} type="button" aria-pressed={kind === item.id} onClick={() => setKind(item.id)}>{item.label}<span>{assets.filter((asset) => item.id === "all" || asset.kind === item.id).length}</span></button>)}</div><label className="hf-asset-search"><Search size={16} /><input aria-label="Varlıklarda ara" placeholder="Varlık ara…" value={query} onChange={(event) => setQuery(event.target.value)} /></label></div>
    {shown.length ? <div className="hf-asset-grid">{shown.map((asset) => { const Icon = KIND_ICON[asset.kind]; return <article className="hf-asset" key={asset.id}><button type="button" className="hf-asset-preview" onClick={() => setSelected(asset)} aria-label={`${asset.title} önizle`}>{asset.kind === "image" || asset.kind === "character" ? <Image src={asset.url} alt="" fill sizes="(max-width: 600px) 50vw, (max-width: 1100px) 33vw, 25vw" unoptimized /> : asset.kind === "video" ? <><Image src={asset.project.cover} alt="" fill sizes="(max-width: 600px) 50vw, 25vw" unoptimized /><span className="hf-asset-play"><Film size={25} /></span></> : <span className="hf-audio-art"><AudioLines size={52} strokeWidth={1} /></span>}<span className="hf-asset-kind"><Icon size={12} />{KIND_LABEL[asset.kind]}</span></button><button type="button" className="hf-heart" aria-label={`${asset.title} ${favorites.includes(asset.id) ? "favorilerden çıkar" : "favorilere ekle"}`} aria-pressed={favorites.includes(asset.id)} onClick={() => onFavorite(asset.id)}><Heart size={16} fill={favorites.includes(asset.id) ? "currentColor" : "none"} /></button><div className="hf-asset-caption"><button type="button" onClick={() => setSelected(asset)}>{asset.title}</button><small>{asset.project.title}</small></div></article>; })}</div> : <div className="hf-empty"><FolderOpen size={36} strokeWidth={1.2} /><h2>{query ? "Eşleşen varlık yok" : onlyFavorites ? "Henüz favori varlık yok" : "Burası senin yaratıcı arşivin"}</h2><p>{query ? "Aramanı veya filtreyi değiştir." : "Üretilen dosyalar burada görünür. Örnek fotoğraflar üretim olarak listelenmez."}</p><button type="button" className="button" onClick={onCreate}>Oluşturmaya başla <ArrowUpRight size={15} /></button></div>}
    <dialog ref={dialog} className="sheet hf-asset-dialog" aria-labelledby="asset-preview-title" onCancel={() => setSelected(null)} onClick={(event) => { if (event.target === event.currentTarget) setSelected(null); }}>{selected ? <><div className="sheet-head"><div><h2 id="asset-preview-title">{selected.title}</h2><p className="quiet">{KIND_LABEL[selected.kind]} · {selected.project.title}</p></div><button type="button" className="icon-button" aria-label="Önizlemeyi kapat" onClick={() => setSelected(null)}><X size={19} /></button></div><div className="hf-asset-dialog-media">{selected.kind === "image" || selected.kind === "character" ? <Image src={selected.url} alt={selected.title} width={1200} height={800} unoptimized /> : selected.kind === "video" ? <video src={selected.url} controls playsInline preload="metadata" /> : <audio src={selected.url} controls preload="metadata" />}</div><div className="sheet-body">{selected.prompt ? <><h3>Prompt</h3><p className="hf-asset-prompt">{selected.prompt}</p><button type="button" className="text-button" onClick={async () => { try { await navigator.clipboard.writeText(selected.prompt); setCopied(true); setCopyError(""); } catch { setCopyError("Kopyalanamadı; metni seçerek kopyalayabilirsin."); } }}>{copied ? <Check size={15} /> : <Copy size={15} />}{copied ? "Kopyalandı" : "Promptu kopyala"}</button>{copyError ? <p role="status" className="quiet">{copyError}</p> : null}</> : null}</div><div className="sheet-actions"><button type="button" className="button" onClick={() => { setSelected(null); onOpen(selected.project); }}>Projede aç <ArrowUpRight size={15} /></button><a className="button button-lamp" href={selected.url} download><ArrowDownToLine size={16} />Dosyayı indir</a></div></> : null}</dialog>
  </section>;
}
