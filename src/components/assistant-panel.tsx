"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight, Check, LoaderCircle, Sparkles, X } from "lucide-react";
import { emotionOf, GENRES, LOOKS } from "@/lib/cinema";
import type { AssistantProposal, AssistantScenePatch, Project, ProposedChange } from "@/lib/types";

const SUGGESTIONS = [
  "Tüm sahneler gece geçsin",
  "Kamera hareketlerini çeşitlendir",
  "Daha gergin bir hava ver",
  "Her sahneyi 1 saniye kısalt",
  "Dış ses metinlerini kısalt",
];

const FIELD_LABEL: Record<keyof AssistantScenePatch, string> = {
  title: "Başlık", description: "Anlatım", prompt: "Görsel tarif", motionPrompt: "Hareket", camera: "Kamera", duration: "Süre", narration: "Dış ses", emotions: "Duygular",
};

const short = (value: string, max = 150) => value.length > max ? `${value.slice(0, max - 1).trim()}…` : value || "boş";

/**
 * The director assistant: say what to change in plain words, read what it would do, then apply it.
 * It only rewrites shot text, camera, length, narration and feelings; it never starts anything that costs money.
 */
export default function AssistantPanel({ project, open, available, disabled, onClose, onProjectChange, notify }: {
  project: Project; open: boolean; available: boolean; disabled: boolean; onClose: () => void; onProjectChange: (project: Project) => void; notify: (message: string) => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const [message, setMessage] = useState("");
  const [proposal, setProposal] = useState<AssistantProposal | null>(null);
  const [chosen, setChosen] = useState<Set<string>>(new Set());
  const [withProject, setWithProject] = useState(true);
  const [busy, setBusy] = useState<"ask" | "apply" | null>(null);
  const [error, setError] = useState("");
  const names = new Map(project.characters.map((character) => [character.id, character.name]));

  useEffect(() => {
    const element = dialog.current;
    if (open && element && !element.open) element.showModal();
    if (!open && element?.open) element.close();
  }, [open]);

  function describe(field: keyof AssistantScenePatch, value: AssistantScenePatch[keyof AssistantScenePatch]) {
    if (field === "emotions") {
      const entries = Object.entries((value ?? {}) as Record<string, string>);
      return entries.length ? entries.map(([who, feeling]) => `${names.get(who) ?? who}: ${emotionOf(feeling).label}`).join(", ") : "yok";
    }
    if (field === "duration") return `${value} sn`;
    return short(String(value ?? ""));
  }

  async function ask() {
    if (busy || message.trim().length < 3) return;
    setBusy("ask"); setError(""); setProposal(null);
    try {
      const response = await fetch(`/api/projects/${project.id}/assistant`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: project.revision, message }) });
      const result = await response.json() as { proposal?: AssistantProposal; error?: string };
      if (!response.ok || !result.proposal) throw new Error(result.error || "Asistan yanıt veremedi.");
      setProposal(result.proposal);
      setChosen(new Set(result.proposal.changes.map((change) => change.sceneId)));
      setWithProject(true);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Asistan yanıt veremedi."); }
    finally { setBusy(null); }
  }

  async function apply() {
    if (!proposal || busy) return;
    const scenes = proposal.changes.filter((change) => chosen.has(change.sceneId)).map((change) => ({ id: change.sceneId, set: change.set }));
    const projectPatch = withProject ? proposal.project : null;
    if (!scenes.length && !projectPatch) return;
    setBusy("apply"); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/assistant`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ revision: project.revision, scenes, project: projectPatch }) });
      const result = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !result.project) throw new Error(result.error || "Değişiklikler uygulanamadı.");
      onProjectChange(result.project);
      notify(`${scenes.length ? `${scenes.length} sahne güncellendi` : "Film ayarları güncellendi"}.`);
      setProposal(null); setMessage("");
      onClose();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Değişiklikler uygulanamadı."); }
    finally { setBusy(null); }
  }

  const count = (proposal?.changes.filter((change) => chosen.has(change.sceneId)).length ?? 0) + (withProject && proposal?.project ? 1 : 0);
  const toggle = (change: ProposedChange) => setChosen((current) => { const next = new Set(current); if (next.has(change.sceneId)) next.delete(change.sceneId); else next.add(change.sceneId); return next; });

  return <dialog ref={dialog} className="sheet drawer" aria-labelledby="assistant-title" onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="sheet-head"><div><h2 id="assistant-title">Yönetmen asistanı</h2><p className="quiet">Ne değişsin, yaz. Önce ne yapacağını gösterir, onaylarsan uygular.</p></div><button type="button" className="icon-button" aria-label="Kapat" onClick={onClose}><X size={18} /></button></div>
    <div className="sheet-body">
      {!available ? <p className="note note-warn">Asistan için DeepSeek ya da NVIDIA bağlı olmalı. Bağlantılar sayfasından bakabilirsin.</p> : null}
      <div className="field">
        <textarea value={message} rows={3} maxLength={1000} disabled={Boolean(busy) || !available || disabled} onChange={(event) => setMessage(event.target.value)} aria-label="Asistana isteğin" placeholder="Örn. 3. sahneyi daha gergin yap ve fotoğrafçı korkmuş görünsün"
          onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) { event.preventDefault(); void ask(); } }} />
        <div className="chips" role="group" aria-label="Öneriler">{SUGGESTIONS.map((item) => <button key={item} type="button" className="chip" disabled={Boolean(busy) || !available || disabled} onClick={() => setMessage(item)}>{item}</button>)}</div>
      </div>
      <button type="button" className="button button-lamp" disabled={Boolean(busy) || !available || disabled || message.trim().length < 3} onClick={() => void ask()}>{busy === "ask" ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}{busy === "ask" ? "Düşünüyor…" : "Gönder"}</button>
      {error ? <p className="note note-error" role="alert">{error}</p> : null}

      {proposal ? <div className="proposal" aria-live="polite">
        <p className="proposal-reply">{proposal.reply}</p>
        {proposal.project ? <label className="change"><input type="checkbox" checked={withProject} onChange={(event) => setWithProject(event.target.checked)} /><span><strong>Bütün film</strong>
          <ul className="diff">{(Object.keys(proposal.project) as (keyof typeof proposal.project)[]).map((key) => <li key={key}><em>{key === "genre" ? "Tür" : key === "look" ? "Renk" : "Proje özeti"}</em>
            <del>{key === "genre" ? GENRES.find((g) => g.id === proposal.projectBefore?.genre)?.label ?? "Genel" : key === "look" ? LOOKS.find((l) => l.id === proposal.projectBefore?.look)?.label ?? "Doğal" : short(proposal.projectBefore?.brief ?? "", 80)}</del><ArrowRight size={12} />
            <ins>{key === "genre" ? GENRES.find((g) => g.id === proposal.project?.genre)?.label : key === "look" ? LOOKS.find((l) => l.id === proposal.project?.look)?.label : short(proposal.project?.brief ?? "")}</ins></li>)}</ul></span></label> : null}
        {proposal.changes.map((change) => <label key={change.sceneId} className="change"><input type="checkbox" checked={chosen.has(change.sceneId)} onChange={() => toggle(change)} /><span><strong>{change.order.toString().padStart(2, "0")} {change.title}</strong>
          <ul className="diff">{(Object.keys(change.set) as (keyof AssistantScenePatch)[]).map((field) => <li key={field}><em>{FIELD_LABEL[field]}</em><del>{describe(field, change.before[field])}</del><ArrowRight size={12} /><ins>{describe(field, change.set[field])}</ins></li>)}</ul></span></label>)}
        {count ? <div className="proposal-actions"><button type="button" className="button" disabled={Boolean(busy)} onClick={() => setProposal(null)}>Vazgeç</button><button type="button" className="button button-lamp" disabled={Boolean(busy)} onClick={() => void apply()}>{busy === "apply" ? <LoaderCircle size={15} className="spin" /> : <Check size={15} />}{busy === "apply" ? "Uygulanıyor…" : `Uygula (${count})`}</button></div> : null}
        {proposal.changes.some((change) => change.set.prompt !== undefined || change.set.emotions !== undefined) || proposal.project?.brief !== undefined || proposal.project?.genre !== undefined ? <p className="note"><Sparkles size={14} />Görsel değişiklikler, ilgili kareler bir sonraki üretimde yeniden çizilince görünür. Fiyatı üretimden önce görüp onaylarsın.</p> : null}
      </div> : null}
    </div>
  </dialog>;
}
