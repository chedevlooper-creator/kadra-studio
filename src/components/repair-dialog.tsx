"use client";

import { useEffect, useRef, useState, type PointerEvent } from "react";
import { Check, LoaderCircle, ShieldCheck, TriangleAlert, WandSparkles, X } from "lucide-react";
import type { Box, Character, Project, RepairEstimate, ReviewIssue, Scene, SheetAttempt } from "@/lib/types";

export type RepairTarget = { kind: "scene"; scene: Scene } | { kind: "character"; character: Character; attempt: SheetAttempt };

const usd = (value: number) => `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: 3 })} $`;
const clamp = (value: number) => Math.min(1, Math.max(0, value));
/** Same padding the automatic repair uses, so the redraw blends past the defect's edge. */
const pad = ([x0, y0, x1, y1]: Box): Box => [clamp(x0 - 0.04), clamp(y0 - 0.04), clamp(x1 + 0.04), clamp(y1 + 0.04)];
const located = (issues: ReviewIssue[] | undefined) => (issues ?? []).filter((issue): issue is ReviewIssue & { box: Box } => issue.box !== null);
const percent = (box: Box) => ({ left: `${box[0] * 100}%`, top: `${box[1] * 100}%`, width: `${(box[2] - box[0]) * 100}%`, height: `${(box[3] - box[1]) * 100}%` });

/**
 * Marks one region of a frame or character sheet and has only that region redrawn. The reviewer's located issues
 * are offered as starting points; the price is shown and approved before anything is sent.
 * Mount it with a `key` per target so its fields start from that target's issues.
 */
export default function RepairDialog({ project, target, onClose, onStarted }: { project: Project; target: RepairTarget | null; onClose: () => void; onStarted: (project: Project) => void }) {
  const dialog = useRef<HTMLDialogElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const start = useRef<[number, number] | null>(null);
  const issues = located(target?.kind === "scene" ? target.scene.review?.issues : target?.attempt.verdict?.issues);
  const [box, setBox] = useState<Box | null>(issues[0] ? pad(issues[0].box) : null);
  const [instruction, setInstruction] = useState(issues[0]?.fix || issues[0]?.problem || "");
  const [budget, setBudget] = useState("1");
  const [estimate, setEstimate] = useState<RepairEstimate | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const image = target?.kind === "scene" ? target.scene.image : target?.attempt.url;
  const title = target?.kind === "scene" ? target.scene.title : target?.character.name;

  useEffect(() => {
    const element = dialog.current;
    if (target && element && !element.open) element.showModal();
    if (!target && element?.open) element.close();
  }, [target]);

  useEffect(() => {
    if (!target) return;
    const controller = new AbortController();
    fetch(`/api/projects/${project.id}/repair`, { cache: "no-store", signal: controller.signal })
      .then(async (response) => {
        const result = await response.json() as { estimate?: RepairEstimate; error?: string };
        if (!response.ok || !result.estimate) throw new Error(result.error || "Onarım fiyatı alınamadı.");
        setEstimate(result.estimate);
      })
      .catch((cause: unknown) => { if (!controller.signal.aborted) setError(cause instanceof Error ? cause.message : "Onarım fiyatı alınamadı."); });
    return () => controller.abort();
  }, [project.id, target]);

  function point(event: PointerEvent<HTMLDivElement>): [number, number] {
    const rect = stage.current!.getBoundingClientRect();
    return [clamp((event.clientX - rect.left) / rect.width), clamp((event.clientY - rect.top) / rect.height)];
  }
  function draw(event: PointerEvent<HTMLDivElement>) {
    if (!start.current) return;
    const [x, y] = point(event);
    const [sx, sy] = start.current;
    setBox([Math.min(sx, x), Math.min(sy, y), Math.max(sx, x), Math.max(sy, y)]);
  }

  const tooSmall = !box || box[2] - box[0] < 0.02 || box[3] - box[1] < 0.02;
  const parsedBudget = Number(budget);
  const needsBudget = project.budget === null;
  const ready = Boolean(estimate && !estimate.problems.length && !tooSmall && instruction.trim().length >= 3 && (!needsBudget || (Number.isFinite(parsedBudget) && parsedBudget >= (estimate?.unitCost ?? 0))));

  async function submit() {
    if (!target || !box || !estimate) return;
    setBusy(true); setError("");
    try {
      const response = await fetch(`/api/projects/${project.id}/repair`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Idempotency-Key": crypto.randomUUID() },
        body: JSON.stringify({
          revision: project.revision,
          target: target.kind === "scene" ? { sceneId: target.scene.id } : { characterId: target.character.id, attemptId: target.attempt.id },
          box, instruction: instruction.trim(), maxCost: estimate.unitCost, ...(needsBudget ? { budget: parsedBudget } : {}),
        }),
      });
      const result = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !result.project) throw new Error(result.error || "Onarım başlatılamadı.");
      onStarted(result.project);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Onarım başlatılamadı."); }
    finally { setBusy(false); }
  }

  return <dialog ref={dialog} className="sheet repair-dialog" aria-labelledby="repair-title" onCancel={onClose} onClose={onClose}>
    {target && image ? <div>
      <div className="sheet-head"><div><h2 id="repair-title">{title}: bir bölgeyi onar</h2><p className="quiet">Yalnızca çizdiğin alan yeniden çizilir; gerisi piksel piksel aynı kalır.</p></div><button type="button" className="icon-button" aria-label="Kapat" onClick={onClose}><X size={18} /></button></div>
      <div className="sheet-body">
        <div ref={stage} className="repair-stage" onPointerDown={(event) => { event.currentTarget.setPointerCapture(event.pointerId); start.current = point(event); setBox(null); }} onPointerMove={draw} onPointerUp={(event) => { draw(event); start.current = null; }} onPointerCancel={() => { start.current = null; }}>
          <img src={image} alt={`${title} görseli`} draggable={false} />
          {issues.map((issue, index) => <span key={index} className="repair-issue-box" style={percent(issue.box)} />)}
          {box ? <span className="repair-box" style={percent(box)} /> : null}
        </div>
        <p className="repair-hint">Düzeltilecek alanı görselin üzerinde sürükleyerek seç.</p>
        {issues.length ? <div className="repair-issues" aria-label="Hakemin bulduğu sorunlar">{issues.map((issue, index) => <button key={index} type="button" className={box && pad(issue.box).every((value, i) => Math.abs(value - box[i]) < 0.001) ? "is-selected" : ""} onClick={() => { setBox(pad(issue.box)); setInstruction(issue.fix || issue.problem); }}><TriangleAlert size={11} /> {issue.problem || issue.fix}</button>)}</div> : null}
        <label className="field"><span>Bu alanda ne düzeltilsin? <small>Doğal Türkçe yazabilirsin; arka planda DeepSeek İngilizceye çevirip geliştirir</small></span><textarea rows={2} maxLength={600} value={instruction} onChange={(event) => setInstruction(event.target.value)} placeholder="Örn. Sol eli beş doğal parmak olacak şekilde düzelt" /></label>
        {needsBudget ? <label className="field"><span>Proje bütçesi (USD) <small>Ücretli işlemler bu tutarı aşamaz</small></span><input type="number" min={0} step="0.5" inputMode="decimal" value={budget} onChange={(event) => setBudget(event.target.value)} /></label> : null}
        <div className="char-estimate">
          {estimate ? <div><strong>{estimate.modelLabel}</strong><span>Maskeli düzenleme · tek istek · bütçeden önce ayrılır</span><em>{estimate.unitCost ? `en fazla ${usd(estimate.unitCost)}` : "—"}</em></div> : <div><span><LoaderCircle size={12} className="spin" /> Güncel fiyat GMI&apos;dan alınıyor…</span></div>}
          {estimate?.problems.map((problem) => <p key={problem} className="paid-errors"><TriangleAlert size={12} /> {problem}</p>)}
          <p className="char-search-note"><ShieldCheck size={13} /> Beğenmezsen önceki hâline tek tıkla dönebilirsin.</p>
        </div>
        {error ? <p className="note note-error" role="alert">{error}</p> : null}
      </div>
      <div className="sheet-actions"><span>{tooSmall ? "Önce görselde bir alan seç." : ""}</span><button className="button button-lamp" type="button" disabled={busy || !ready} onClick={() => void submit()}>{busy ? <LoaderCircle size={14} className="spin" /> : estimate ? <WandSparkles size={14} /> : <Check size={14} />} {estimate?.unitCost ? `Onayla ve onar · ${usd(estimate.unitCost)}` : "Onar"}</button></div>
    </div> : null}
  </dialog>;
}
