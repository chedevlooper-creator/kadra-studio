"use client";

import { useRef, useState } from "react";
import { LoaderCircle, Music, Trash2, Upload } from "lucide-react";
import type { Project } from "@/lib/types";

const AUDIO_TYPES: Record<string, string> = { mp3: "audio/mpeg", m4a: "audio/mp4", wav: "audio/wav", aac: "audio/aac" };

function minutes(seconds: number) {
  const total = Math.round(seconds);
  return `${Math.floor(total / 60)}:${(total % 60).toString().padStart(2, "0")}`;
}

async function send(url: string, init: RequestInit): Promise<Project> {
  const response = await fetch(url, init);
  const result = await response.json().catch(() => ({})) as { project?: Project; error?: string };
  if (!response.ok || !result.project) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result.project;
}

/** The film's music track: upload, volume, start point, removal. An existing film is re-mixed on every change. */
export default function MusicLane({ project, disabled, onProjectChange, notify }: { project: Project; disabled: boolean; onProjectChange: (project: Project) => void; notify: (message: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const music = project.music;
  const [volume, setVolume] = useState(Math.round((music?.volume ?? 0.8) * 100));
  const [offset, setOffset] = useState(String(music?.offset ?? 0));
  const [busy, setBusy] = useState<"upload" | "apply" | "remove" | null>(null);
  const [error, setError] = useState("");
  const dirty = Boolean(music) && (volume !== Math.round(music!.volume * 100) || Number(offset) !== music!.offset);
  const locked = disabled || busy !== null;

  async function run(action: NonNullable<typeof busy>, task: () => Promise<Project>, done: string) {
    setBusy(action); setError("");
    try { onProjectChange(await task()); notify(done); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "İşlem tamamlanamadı."); }
    finally { setBusy(null); }
  }

  function upload(file: File) {
    const type = file.type || AUDIO_TYPES[file.name.split(".").pop()?.toLowerCase() ?? ""] || "application/octet-stream";
    void run("upload", () => send(`/api/projects/${project.id}/music?revision=${project.revision}&name=${encodeURIComponent(file.name)}`, { method: "POST", headers: { "Content-Type": type }, body: file }),
      project.output ? "Müzik filme eklendi." : "Müzik kaydedildi; bir sonraki üretimde filme eklenecek.");
  }

  const json = (method: string, body: unknown): RequestInit => ({ method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  return <div className="music-lane">
    <span className="music-lane-label"><Music size={13} /> Müzik</span>
    {music ? <div className="music-lane-body">
      <div className="music-lane-track"><strong title={music.name}>{music.name}</strong><small>{minutes(music.duration)}</small></div>
      <audio controls preload="none" src={`/api/projects/${project.id}/media/${music.file}`} />
      <label className="music-lane-control"><span>Ses {volume}%</span><input type="range" min={0} max={150} step={5} value={volume} disabled={locked} onChange={(event) => setVolume(Number(event.target.value))} /></label>
      <label className="music-lane-control"><span>Başlangıç (sn)</span><input type="number" min={0} max={Math.floor(music.duration)} step={0.5} value={offset} disabled={locked} onChange={(event) => setOffset(event.target.value)} /></label>
      <div className="music-lane-actions">
        <button type="button" className="studio-button studio-button-secondary" disabled={locked || !dirty} onClick={() => void run("apply", () => send(`/api/projects/${project.id}/music`, json("PATCH", { revision: project.revision, volume: volume / 100, offset: Number(offset) || 0 })), "Müzik ayarları uygulandı.")}>{busy === "apply" ? <LoaderCircle size={13} className="studio-spin" /> : null} Uygula</button>
        <button type="button" className="studio-button studio-button-secondary" disabled={locked} onClick={() => input.current?.click()}><Upload size={13} /> Değiştir</button>
        <button type="button" className="studio-button studio-button-secondary" disabled={locked} aria-label="Müziği kaldır" onClick={() => void run("remove", () => send(`/api/projects/${project.id}/music`, json("DELETE", { revision: project.revision })), "Müzik kaldırıldı.")}>{busy === "remove" ? <LoaderCircle size={13} className="studio-spin" /> : <Trash2 size={13} />}</button>
      </div>
    </div> : <div className="music-lane-body">
      <span className="music-lane-hint">MP3, M4A veya WAV ekle (en fazla 40 MB). Film varsa müzik hemen altına yerleşir; sonraki üretimlerde otomatik eklenir.</span>
      <button type="button" className="studio-button studio-button-secondary" disabled={locked} onClick={() => input.current?.click()}>{busy === "upload" ? <LoaderCircle size={13} className="studio-spin" /> : <Upload size={13} />} {busy === "upload" ? "Yükleniyor…" : "Müzik ekle"}</button>
    </div>}
    <input ref={input} type="file" accept="audio/mpeg,audio/mp4,audio/x-m4a,audio/wav,audio/aac,.mp3,.m4a,.wav,.aac" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) upload(file); }} />
    {error ? <p className="studio-dialog-error" role="alert">{error}</p> : null}
  </div>;
}
