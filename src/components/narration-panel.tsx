"use client";

import { useEffect, useState } from "react";
import { Check, LoaderCircle, Mic, ShieldCheck, TriangleAlert } from "lucide-react";
import type { Project } from "@/lib/types";
import { GMI_VOICES, LOCAL_VOICE, narrationText, type NarrationEngine, type NarrationSettings } from "@/lib/voices";

/** Turkish narration runs at roughly 14 characters a second; used only to warn about lines longer than their shot. */
const CHARS_PER_SECOND = 14;
const GMI_RATE = 0.06;

/**
 * Narration settings: off, a free macOS voice for drafts, or a paid Turkish voice bought through the quote.
 * Each line is spoken once and reused until its text or voice changes.
 */
export default function NarrationPanel({ project, disabled, onProjectChange, notify }: { project: Project; disabled: boolean; onProjectChange: (project: Project) => void; notify: (message: string) => void }) {
  const [settings, setSettings] = useState<NarrationSettings>(project.narration);
  const [localVoices, setLocalVoices] = useState<string[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const lines = project.scenes.filter((scene) => narrationText(scene));
  const characters = lines.reduce((sum, scene) => sum + narrationText(scene).length, 0);
  const dirty = JSON.stringify(settings) !== JSON.stringify(project.narration);

  useEffect(() => {
    const controller = new AbortController();
    fetch("/api/voices", { signal: controller.signal }).then((response) => response.json()).then((result: { local?: string[] }) => setLocalVoices(result.local ?? [])).catch(() => { if (!controller.signal.aborted) setLocalVoices([]); });
    return () => controller.abort();
  }, []);

  function choose(engine: NarrationEngine) {
    setSettings({ ...settings, engine, voice: engine === "gmi" ? (GMI_VOICES.some((voice) => voice.id === settings.voice) ? settings.voice : GMI_VOICES[0].id) : engine === "local" ? (localVoices?.includes(settings.voice) ? settings.voice : localVoices?.[0] ?? LOCAL_VOICE) : "" });
  }

  async function save() {
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: project.revision, narration: settings }) });
      const result = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !result.project) throw new Error(result.error || "Ayar kaydedilemedi.");
      onProjectChange(result.project);
      notify(settings.engine === "off" ? "Dış ses kapatıldı." : "Dış ses ayarı kaydedildi; bir sonraki üretimde filme eklenir.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Ayar kaydedilemedi."); }
    finally { setBusy(false); }
  }

  const voices = settings.engine === "gmi" ? GMI_VOICES.map((voice) => ({ id: voice.id, label: voice.label })) : (localVoices ?? []).map((voice) => ({ id: voice, label: voice }));
  return <section className="creative-card narration-panel" aria-labelledby="narration-title">
    <h3 id="narration-title"><Mic size={15} /> Filme dış ses</h3>
    <p>Çekimlerin seslendirme metinleri seçtiğin sesle okunur ve her çekimin başına yerleştirilir; konuşma sırasında müzik otomatik kısılır. Bir metin bir kez seslendirilir, değişmedikçe yeniden üretilmez.</p>
    <fieldset className="narration-engines" disabled={disabled || busy}>
      <legend className="sr-only">Ses kaynağı</legend>
      {([["off", "Kapalı", "Film yalnızca müzikle"], ["local", "Mac sesi", localVoices?.length === 0 ? "Bu bilgisayarda Türkçe ses yok" : "Ücretsiz taslak"], ["gmi", "MiniMax Türkçe", "Ücretli · teklif onayıyla"]] as const).map(([id, label, hint]) => <button key={id} type="button" className={settings.engine === id ? "is-selected" : ""} aria-pressed={settings.engine === id} disabled={id === "local" && localVoices?.length === 0} onClick={() => choose(id)}><strong>{label}</strong><span>{hint}</span></button>)}
    </fieldset>
    {settings.engine !== "off" ? <div className="narration-controls">
      <label className="studio-field"><span>Ses</span><select value={settings.voice} disabled={disabled || busy} onChange={(event) => setSettings({ ...settings, voice: event.target.value })}>{voices.map((voice) => <option key={voice.id} value={voice.id}>{voice.label}</option>)}</select></label>
      <label className="studio-field"><span>Hız · {settings.speed.toFixed(2)}×</span><input type="range" min={0.8} max={1.3} step={0.05} value={settings.speed} disabled={disabled || busy} onChange={(event) => setSettings({ ...settings, speed: Number(event.target.value) })} /></label>
      <label className="studio-field"><span>Ses düzeyi · %{Math.round(settings.volume * 100)}</span><input type="range" min={0.3} max={1.6} step={0.1} value={settings.volume} disabled={disabled || busy} onChange={(event) => setSettings({ ...settings, volume: Number(event.target.value) })} /></label>
    </div> : null}
    <p className="char-search-note"><ShieldCheck size={13} /> {lines.length ? `${lines.length} çekimde metin var, toplam ${characters.toLocaleString("tr-TR")} karakter.` : "Henüz seslendirme metni yok; çekim düzenleyicisinden ekleyebilirsin."}{settings.engine === "gmi" && characters ? ` Tahmini ${(characters * GMI_RATE / 1000).toLocaleString("tr-TR", { maximumFractionDigits: 3 })} $; kesin fiyat Üretim sekmesindeki teklifte, onayından sonra alınır. Onaylanana kadar filmde taslak Mac sesi kullanılır.` : ""}</p>
    {settings.engine !== "off" ? <ul className="narration-lines">{lines.map((scene) => {
      const seconds = narrationText(scene).length / CHARS_PER_SECOND / settings.speed;
      return <li key={scene.id}><span>{scene.code || scene.order.toString().padStart(2, "0")} · {scene.title}</span><em className={seconds > scene.duration ? "is-long" : ""}>{seconds > scene.duration ? <TriangleAlert size={11} /> : null} ≈ {seconds.toFixed(1)} sn / çekim {scene.duration} sn</em></li>;
    })}</ul> : null}
    {error ? <p className="studio-dialog-error" role="alert">{error}</p> : null}
    <button type="button" className="studio-button studio-button-primary" disabled={disabled || busy || !dirty} onClick={() => void save()}>{busy ? <LoaderCircle size={14} className="studio-spin" /> : <Check size={14} />} Dış ses ayarını kaydet</button>
  </section>;
}
