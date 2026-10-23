"use client";
import { useEffect, useRef, useState } from "react";
import { Copy, Download, Mic, Square } from "lucide-react";
import type { Project } from "@/lib/types";
import { audioPlan, storyboardCsv } from "@/lib/creative";

export function saveText(text: string, name: string, type = "text/plain;charset=utf-8") {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement("a"); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function CsvExport({ project }: { project: Project }) {
  return <button type="button" className="button button-quiet button-small" onClick={() => saveText(storyboardCsv(project), "storyboard.csv", "text/csv;charset=utf-8")}><Download size={14} />CSV</button>;
}

/** A brief for composing the score elsewhere, built from the scenes' sound notes. */
export function MusicDirector({ project, notify }: { project: Project; notify: (message: string) => void }) {
  const prompt = project.title.toLocaleLowerCase("tr").includes("balonlar")
    ? "Chechen folk dechig-pondar melody, male choir, epic cinematic drums, comedic tuba waltz, fast lezginka rock, dramatic crescendo, 120-140 BPM, instrumental, original composition"
    : `Original instrumental cinematic score, ${project.style}, coherent recurring motif, contrasting scene dynamics. ${project.scenes.map((scene) => scene.audioNotes).filter(Boolean).join(" ").slice(0, 1600)}`;
  return <div className="panel">
    <div className="panel-head"><h3>Müzik tarifi</h3><p className="quiet">Bir müzik üreticisine yapıştırmak için; çıkan parçayı yukarıdan filme ekle.</p></div>
    <p className="prompt-text">{prompt}</p>
    <div className="row">
      <button type="button" className="button button-small" onClick={async () => { try { await navigator.clipboard.writeText(prompt); notify("Tarif kopyalandı."); } catch { notify("Panoya erişilemedi; metni seçerek kopyalayabilirsin."); } }}><Copy size={14} />Kopyala</button>
      <button type="button" className="button button-small button-quiet" onClick={() => saveText(audioPlan(project), "ses-plani.txt")}><Download size={14} />Sahne sahne ses planı</button>
    </div>
  </div>;
}

/** Rehearse a line with the microphone; the recording stays in the browser and is not added to the film. */
export function VoiceoverStudio({ project }: { project: Project }) {
  const recorder = useRef<MediaRecorder | null>(null), stream = useRef<MediaStream | null>(null), timer = useRef<ReturnType<typeof setTimeout> | null>(null), mounted = useRef(true), urlRef = useRef("");
  const [recording, setRecording] = useState<string | null>(null), [requesting, setRequesting] = useState(false), [url, setUrl] = useState(""), [mime, setMime] = useState("audio/webm"), [error, setError] = useState("");
  useEffect(() => { mounted.current = true; return () => { mounted.current = false; if (timer.current) clearTimeout(timer.current); if (recorder.current?.state === "recording") recorder.current.stop(); stream.current?.getTracks().forEach((track) => track.stop()); if (urlRef.current) URL.revokeObjectURL(urlRef.current); }; }, []);
  function stop() { if (timer.current) clearTimeout(timer.current); if (recorder.current?.state === "recording") recorder.current.stop(); }
  async function record(id: string, duration: number) {
    if (recording || requesting) return; setRequesting(true); setError("");
    try {
      if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") throw Error("Bu tarayıcı mikrofon kaydını desteklemiyor.");
      const media = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mounted.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media; const type = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find((item) => MediaRecorder.isTypeSupported(item));
      const rec = new MediaRecorder(media, type ? { mimeType: type } : undefined); recorder.current = rec; const chunks: BlobPart[] = [];
      rec.ondataavailable = (event) => { if (event.data.size) chunks.push(event.data); };
      rec.onstop = () => { media.getTracks().forEach((track) => track.stop()); if (timer.current) clearTimeout(timer.current); if (!mounted.current) return; setRecording(null); if (urlRef.current) URL.revokeObjectURL(urlRef.current); urlRef.current = URL.createObjectURL(new Blob(chunks, { type: rec.mimeType })); setUrl(urlRef.current); setMime(rec.mimeType); };
      rec.onerror = () => { stop(); setError("Kayıt sırasında hata oluştu."); }; rec.start(); setRecording(id); timer.current = setTimeout(stop, Math.min(120, duration) * 1000);
    } catch (cause) { stream.current?.getTracks().forEach((track) => track.stop()); if (mounted.current) setError(cause instanceof Error ? cause.message : "Mikrofon izni alınamadı."); } finally { if (mounted.current) setRequesting(false); }
  }
  const lines = project.scenes.filter((scene) => scene.narration || (scene.screenText && scene.screenText !== "—"));
  return <details className="panel panel-fold">
    <summary><h3>Kendi sesinle prova</h3><span className="quiet">Kayıt filme eklenmez; indirip saklayabilirsin.</span></summary>
    <ul className="lines">{(lines.length ? lines : [{ id: "free", title: "Serbest prova", narration: "", screenText: "", duration: 30, code: "", order: 0 }]).map((scene) => <li key={scene.id}>
      <span><strong>{scene.title}</strong>{scene.narration || scene.screenText ? <span className="quiet">{scene.narration || scene.screenText}</span> : null}</span>
      {recording === scene.id ? <button type="button" className="button button-small button-rec" onClick={stop}><Square size={12} fill="currentColor" />Bitir</button> : <button type="button" className="button button-small" disabled={Boolean(recording) || requesting} onClick={() => void record(scene.id, scene.duration)}><Mic size={14} />{scene.duration} sn kaydet</button>}
    </li>)}</ul>
    {url ? <div className="row"><audio controls src={url} /><a className="button button-small" href={url} download={`prova.${mime.includes("mp4") ? "m4a" : "webm"}`}><Download size={14} />İndir</a></div> : null}
    {error ? <p role="alert" className="note note-error">{error}</p> : null}
  </details>;
}
