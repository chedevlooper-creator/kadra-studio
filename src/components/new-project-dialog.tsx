"use client";

import { useEffect, useId, useRef, useState, type FormEvent } from "react";
import { ArrowRight, Check, FileUp, Film, LoaderCircle, Sparkles, X } from "lucide-react";
import type { AspectRatio, CreateProjectInput, Project } from "@/lib/types";

interface NewProjectDialogProps {
  open: boolean;
  onClose: () => void;
  onCreated: (project: Project) => void;
}

type Phase = "form" | "creating" | "planning" | "created" | "uncertain";

const SAMPLE_SCRIPT = `Sabahın ilk ışıkları, sakin bir sahil kasabasının üzerine düşer. Genç bir fotoğrafçı, omzunda çantasıyla dar bir sokakta yürür.

Eski bir kitapçının vitrininde sararmış bir kartpostal görür. Kartpostaldaki manzaranın kendi çocukluk fotoğrafıyla aynı olduğunu fark eder.

Gün batımında kartpostaldaki deniz fenerine ulaşır. Fotoğraf makinesini kaldırır; ufukta yeni bir yolculuğun başlangıcı görünür.`;

function responseMessage(payload: unknown, fallback: string): string {
  if (payload && typeof payload === "object" && "error" in payload) {
    const error = (payload as { error?: unknown }).error;
    if (typeof error === "string") return error;
  }
  return fallback;
}

function responseProject(payload: unknown): Project | null {
  if (!payload || typeof payload !== "object" || !("project" in payload)) return null;
  const project = (payload as { project?: Project }).project;
  return project && typeof project.id === "string" && typeof project.revision === "number"
    ? project
    : null;
}

export default function NewProjectDialog({ open, onClose, onCreated }: NewProjectDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const submittingRef = useRef(false);
  const importRef = useRef<HTMLInputElement>(null);
  const headingId = useId();
  const descriptionId = useId();
  const titleId = useId();
  const scriptId = useId();
  const scriptNoteId = useId();
  const styleId = useId();
  const budgetId = useId();
  const [title, setTitle] = useState("");
  const [script, setScript] = useState("");
  const [style, setStyle] = useState("Sinematik");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [budget, setBudget] = useState("");
  const [phase, setPhase] = useState<Phase>("form");
  const [error, setError] = useState("");
  const [createdProject, setCreatedProject] = useState<Project | null>(null);
  const busy = phase === "creating" || phase === "planning";

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;
    if (open && !dialog.open) {
      previousFocusRef.current = document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
      dialog.showModal();
    } else if (!open && dialog.open) {
      dialog.close();
      previousFocusRef.current?.focus();
    }
  }, [open]);

  function resetForm() {
    setTitle("");
    setScript("");
    setStyle("Sinematik");
    setAspectRatio("16:9");
    setBudget("");
    setPhase("form");
    setError("");
    setCreatedProject(null);
  }

  function close() {
    if (submittingRef.current) return;
    resetForm();
    onClose();
  }

  function finish(project: Project) {
    resetForm();
    onCreated(project);
  }

  /** Creates the project straight from an exported storyboard JSON (array of shots or { shots }). */
  async function importStoryboard(file: File) {
    if (submittingRef.current || phase !== "form") return;
    setError("");
    let shots: unknown;
    try { const data = JSON.parse(await file.text()); shots = Array.isArray(data) ? data : (data as { shots?: unknown })?.shots; }
    catch { setError("Dosya geçerli bir JSON değil."); return; }
    if (!Array.isArray(shots) || shots.length === 0) { setError("Dosyada çekim listesi bulunamadı."); return; }
    const parsedBudget = budget.trim() === "" ? null : Number(budget);
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 0 || parsedBudget > 100000)) { setError("Bütçe 0 ile 100.000 USD arasında olmalı."); return; }
    const fields = ["id", "sceneId", "sceneTitle", "durationSec", "timeRange", "visualSummary", "cameraMovement", "aiPrompt", "audioCues", "voiceoverOrText"];
    // Generated media (base64) and status fields are dropped; only the plan travels.
    const picked = shots.map((shot) => Object.fromEntries(fields.filter((key) => shot && typeof shot === "object" && key in shot).map((key) => [key, (shot as Record<string, unknown>)[key]])));
    submittingRef.current = true;
    setPhase("creating");
    try {
      const response = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title: title.trim() || file.name.replace(/\.json$/i, "").replace(/[_-]+/g, " ").trim().slice(0, 120) || "Storyboard", style, aspectRatio, budget: parsedBudget, shots: picked }),
      });
      const payload: unknown = await response.json().catch(() => null);
      const project = responseProject(payload);
      if (!response.ok || !project) { setPhase("form"); setError(responseMessage(payload, "Storyboard içe aktarılamadı.")); return; }
      finish(project);
    } catch {
      setPhase("uncertain");
      setError("Bağlantı kesildi ve içe aktarmanın sonucu doğrulanamadı. Yeniden denemeden önce projeler listenizi kontrol edin.");
    } finally { submittingRef.current = false; }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (submittingRef.current || phase !== "form") return;
    if (!title.trim()) {
      setError("Projenize bir isim verin.");
      return;
    }
    const parsedBudget = budget.trim() === "" ? null : Number(budget);
    if (parsedBudget !== null && (!Number.isFinite(parsedBudget) || parsedBudget < 0 || parsedBudget > 100000)) {
      setError("Bütçe 0 ile 100.000 USD arasında olmalı.");
      return;
    }

    submittingRef.current = true;
    setError("");
    setPhase("creating");
    const input: CreateProjectInput = {
      title: title.trim(),
      script,
      style,
      aspectRatio,
      budget: parsedBudget,
    };
    let project: Project;

    try {
      const response = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input),
      });
      const payload: unknown = await response.json().catch(() => null);
      if (!response.ok) {
        setPhase(response.status >= 500 ? "uncertain" : "form");
        setError(responseMessage(payload, response.status >= 500
          ? "İşlemin sonucu doğrulanamadı. Yeniden oluşturmadan önce projeler listenizi kontrol edin."
          : "Proje oluşturulamadı. Alanları kontrol edip tekrar deneyin."));
        submittingRef.current = false;
        return;
      }
      const result = responseProject(payload);
      if (!result) throw new Error("Unconfirmed project response");
      project = result;
      setCreatedProject(project);
    } catch {
      setError("Bağlantı kesildi ve işlemin sonucu doğrulanamadı. Yeniden oluşturmadan önce projeler listenizi kontrol edin.");
      setPhase("uncertain");
      submittingRef.current = false;
      return;
    }

    if (script.trim().length >= 10) {
      setPhase("planning");
      try {
        const response = await fetch(`/api/projects/${encodeURIComponent(project.id)}/plan`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ revision: project.revision }),
        });
        const payload: unknown = await response.json().catch(() => null);
        const plannedProject = responseProject(payload);
        if (!response.ok || !plannedProject) {
          throw new Error(responseMessage(payload, "Sahne planı hazırlanamadı. Projeniz kaydedildi; proje içinden tekrar planlayabilirsiniz."));
        }
        project = plannedProject;
      } catch (cause) {
        setError(cause instanceof Error
          ? cause.message
          : "Sahne planı hazırlanamadı. Projeniz kaydedildi; proje içinden tekrar planlayabilirsiniz.");
        setPhase("created");
        submittingRef.current = false;
        return;
      }
    }

    submittingRef.current = false;
    finish(project);
  }

  async function createFlowTemplate() {
    if (submittingRef.current) return;
    submittingRef.current = true; setPhase("creating"); setError("");
    try {
      const response = await fetch("/api/templates/balonlar", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ aspectRatio }) });
      const payload = await response.json();
      if (!response.ok || !payload.project) throw new Error(payload.error || "Şablon açılamadı.");
      finish(payload.project);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Şablon açılamadı. Listeyi kontrol edin."); setPhase("uncertain"); }
    finally { submittingRef.current = false; }
  }

  return (
    <dialog
      ref={dialogRef}
      {...({ closedby: "any" } as Record<string, string>)}
      className="sheet sheet-wide new-project"
      aria-labelledby={headingId}
      aria-describedby={descriptionId}
      onCancel={(event) => {
        event.preventDefault();
        close();
      }}
      onClick={(event) => {
        if (event.target !== event.currentTarget) return;
        const bounds = event.currentTarget.getBoundingClientRect();
        if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) close();
      }}
    >
      <div className="sheet-head">
        <div>
          <h2 id={headingId}>Yeni film</h2>
          <p id={descriptionId} className="quiet">Hikâyeni yaz ya da hazır bir storyboard dosyası getir.</p>
        </div>
        <button type="button" className="icon-button" onClick={close} disabled={busy} aria-label="Pencereyi kapat">
          <X size={20} aria-hidden="true" />
        </button>
      </div>

      <button type="button" className="template-launch" disabled={busy || phase === "uncertain" || phase === "created"} onClick={() => void createFlowTemplate()}><Film size={20} /><span><strong>Balonlar ve Dağlar · Tam Senaryo Şablonu</strong><small>32 sahne, 12 karakter, 181 sn · 4 kırmızı &ldquo;David and Goliath&rdquo; ara kartı ve 2 seslendirmeli kamu spotu hazır.</small></span></button>
      <form onSubmit={submit} aria-busy={busy}>
        <fieldset className="new-project-fields" disabled={busy || phase === "created" || phase === "uncertain"}>
          <div className="field">
            <label className="form-label" htmlFor={titleId}>Film adı</label>
            <input id={titleId} name="title" value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Örn. Deniz Feneri" required maxLength={100} autoFocus autoComplete="off" />
          </div>

          <div className="field">
            <div className="form-label-row">
              <label className="form-label" htmlFor={scriptId}>Hikâye</label>
              <span className="form-label-actions">
                <button type="button" className="text-button" onClick={() => importRef.current?.click()}><FileUp size={13} aria-hidden="true" /> Storyboard dosyası (JSON)</button>
                <button type="button" className="text-button" onClick={() => setScript(SAMPLE_SCRIPT)}><Sparkles size={13} aria-hidden="true" /> Örnek ekle</button>
              </span>
              <input ref={importRef} type="file" accept="application/json,.json" hidden onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ""; if (file) void importStoryboard(file); }} />
            </div>
            <textarea id={scriptId} name="script" className="script-input" value={script} onChange={(event) => setScript(event.target.value)} maxLength={30000} rows={6} placeholder="Hikâyen nerede başlıyor? Karakterlerini, atmosferi ve önemli anları anlat…" aria-describedby={scriptNoteId} />
            <div className="form-label-row">
              <span className="form-note" id={scriptNoteId}>Sonra da yazabilirsin.</span>
              <span className="form-note">{script.length.toLocaleString("tr-TR")} / 30.000</span>
            </div>
          </div>

          <div className="form-grid">
            <div className="field">
              <label className="form-label" htmlFor={styleId}>Görsel stil</label>
              <select id={styleId} name="style" value={style} onChange={(event) => setStyle(event.target.value)}>
                <option>Sinematik</option>
                <option>Anime</option>
                <option>Gerçekçi</option>
                <option>İllüstrasyon</option>
                <option>Belgesel</option>
              </select>
            </div>
            <div className="field">
              <label className="form-label" htmlFor={budgetId}>Bütçe tavanı <span className="form-note">isteğe bağlı</span></label>
              <div className="budget-input"><input id={budgetId} name="budget" type="number" inputMode="decimal" min={0} max={100000} step="0.01" value={budget} onChange={(event) => setBudget(event.target.value)} placeholder="Sınır belirle" /><span>USD</span></div>
            </div>
          </div>

          <fieldset className="ratio-field">
            <legend className="form-label">Ekran oranı</legend>
            <div className="ratio-options">
              {(["16:9", "9:16", "1:1"] as AspectRatio[]).map((ratio) => (
                <button key={ratio} type="button" className={`ratio-option${aspectRatio === ratio ? " selected" : ""}`} aria-pressed={aspectRatio === ratio} onClick={() => setAspectRatio(ratio)}>
                  <span className={`ratio-preview ratio-preview-${ratio.replace(":", "-")}`} aria-hidden="true" />
                  <span>{ratio}</span><span className="form-note">{ratio === "16:9" ? "Yatay" : ratio === "9:16" ? "Dikey" : "Kare"}</span>
                  {aspectRatio === ratio ? <Check size={14} aria-hidden="true" /> : null}
                </button>
              ))}
            </div>
          </fieldset>
        </fieldset>

        <p className="form-note"><Sparkles size={14} aria-hidden="true" /> Hikâyen yaklaşık 20 saniyede sahnelere bölünür. Ücretli hiçbir şey onayın olmadan başlamaz.</p>

        {error ? <div className={phase === "created" ? "form-notice" : "form-error"} role={phase === "created" ? "status" : "alert"}>{phase === "created" ? <><strong><Check size={15} aria-hidden="true" /> Projen oluşturuldu.</strong><br /></> : null}{error}</div> : null}

        <div className="sheet-actions">
          <button type="button" className="button" onClick={close} disabled={busy}>{phase === "uncertain" ? "Kapat ve kontrol et" : "Vazgeç"}</button>
          {phase === "created" && createdProject ? (
            <button type="button" className="button button-lamp" onClick={() => finish(createdProject)}>Projeyi aç <ArrowRight size={16} aria-hidden="true" /></button>
          ) : phase !== "uncertain" ? (
            <button type="submit" className="button button-lamp" disabled={busy}>
              {busy ? <LoaderCircle className="spin" size={16} aria-hidden="true" /> : <Sparkles size={16} aria-hidden="true" />}
              {phase === "creating" ? "Kaydediliyor…" : phase === "planning" ? "Sahnelere bölünüyor…" : "Filme başla"}
            </button>
          ) : null}
        </div>
        <div className="sr-only" role="status" aria-live="polite">{phase === "creating" ? "Projeniz oluşturuluyor." : phase === "planning" ? "Senaryonuz sahnelere ayrılıyor." : ""}</div>
      </form>
    </dialog>
  );
}
