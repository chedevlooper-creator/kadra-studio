"use client";

import { useState } from "react";
import { ChevronDown, Download, LoaderCircle } from "lucide-react";
import { EXPORT_FORMATS, EXPORT_MODES, type ExportMode } from "@/lib/formats";
import type { Project } from "@/lib/types";

/** Re-frames the finished film for another screen on this computer. Free; the sound is kept as it is. */
export default function ExportPanel({ project }: { project: Project }) {
  const [mode, setMode] = useState<ExportMode>("fit");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");

  async function make(format: string) {
    if (busy) return;
    setBusy(format); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/export-video`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ format, mode }) });
      const result = await response.json() as { url?: string; name?: string; error?: string };
      if (!response.ok || !result.url) throw new Error(result.error || "Film bu biçimde hazırlanamadı.");
      const link = document.createElement("a");
      link.href = result.url; link.download = result.name ?? "film.mp4"; link.click();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Film bu biçimde hazırlanamadı."); }
    finally { setBusy(null); }
  }

  return <details className="fold">
    <summary><span><strong>Başka bir ekran için indir</strong><small>Dikey, kare ya da Full HD; ücretsiz</small></span><ChevronDown size={18} /></summary>
    <div className="fold-body">
      <div className="segmented" role="group" aria-label="Kadraj">{EXPORT_MODES.map((item) => <button key={item.id} type="button" aria-pressed={mode === item.id} title={item.hint} onClick={() => setMode(item.id)}>{item.label}</button>)}</div>
      <div className="formats">{EXPORT_FORMATS.map((format) => <button key={format.id} type="button" className="format" disabled={Boolean(busy)} onClick={() => void make(format.id)}>
        <span className={`format-shape format-${format.id}`} aria-hidden="true" />
        <span><strong>{format.label}</strong><small>{format.hint}</small></span>
        {busy === format.id ? <LoaderCircle size={16} className="spin" /> : <Download size={16} />}
      </button>)}</div>
      <p className="quiet">{EXPORT_MODES.find((item) => item.id === mode)?.hint}. Hazırlanan dosya filmin yanında saklanır.</p>
      {error ? <p className="note note-error" role="alert">{error}</p> : null}
    </div>
  </details>;
}
