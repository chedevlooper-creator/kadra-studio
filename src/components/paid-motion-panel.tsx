"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clapperboard, Info, LoaderCircle, Receipt, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { FRAME_MODELS } from "@/lib/routing/frame-router";
import { buildShotPreview } from "@/lib/preview";
import type { LedgerEntry, Project, ProviderStatus, QualityTier, VideoModelOption } from "@/lib/types";

type Selection = Record<string, { ai: boolean; model: string | null }>;

const TIERS: { id: QualityTier; label: string; hint: string }[] = [
  { id: "economy", label: "Ekonomik", hint: "Tüm uygun modeller arasından en ucuzu" },
  { id: "balanced", label: "Dengeli", hint: "Daha iyi hareket kalitesi olanlar arasından en ucuzu" },
  { id: "best", label: "En iyi", hint: "En üst seviye modeller arasından en ucuzu" },
];
const LEDGER_STATUS: Record<LedgerEntry["status"], string> = {
  reserved: "Bütçeden ayrıldı", submitted: "Gönderildi", charged: "Ücretlendi", failed: "Başarısız / belirsiz", released: "Gönderilmedi, iade",
};

const usd = (value: number) => `${value.toLocaleString("tr-TR", { minimumFractionDigits: 2, maximumFractionDigits: value > 0 && value < 0.1 ? 3 : 2 })} $`;
export const committedSpend = (ledger: LedgerEntry[]) => ledger.filter((entry) => entry.status !== "released").reduce((sum, entry) => sum + (entry.actual ?? entry.estimate), 0);

function initialSelection(project: Project): Selection {
  return Object.fromEntries(project.scenes.filter((scene) => scene.kind === "video").map((scene) => [scene.id, { ai: true, model: scene.videoModel }]));
}

async function send(url: string, body: unknown, key?: string): Promise<Project> {
  const response = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json", ...(key ? { "Idempotency-Key": key } : {}) }, body: JSON.stringify(body) });
  const result = await response.json() as { project?: Project; error?: string };
  if (!response.ok || !result.project) throw new Error(result.error || "İşlem tamamlanamadı.");
  return result.project;
}

export default function PaidMotionPanel({ project, providers, videoModels, disabled, onProjectChange, onRunStarted }: {
  project: Project;
  providers: ProviderStatus;
  videoModels: VideoModelOption[];
  disabled: boolean;
  onProjectChange: (project: Project) => void;
  onRunStarted: (project: Project) => void;
}) {
  const [quality, setQuality] = useState<QualityTier>(project.quality);
  const [budget, setBudget] = useState(project.budget === null ? "20" : String(project.budget));
  const [selection, setSelection] = useState<Selection>(() => initialSelection(project));
  const videoScenes = project.scenes.filter((scene) => scene.kind === "video");
  const refSceneIds = useMemo(() => new Set(videoScenes.filter((scene) => project.characters.some((character) => scene.characterIds.includes(character.id) && character.sheet.status === "approved")).map((scene) => scene.id)), [videoScenes, project.characters]);
  const [referenceFrames] = useState(true);
  const [frameModel, setFrameModel] = useState(project.frameModel ?? "");
  const [busy, setBusy] = useState<"quote" | "start" | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const spent = committedSpend(project.ledger);
  const parsedBudget = budget.trim() === "" ? null : Number(budget);
  const quote = project.quote;
  const expired = quote ? Date.parse(quote.expiresAt) <= now : false;
  const quotedRefFrames = Boolean(quote?.lines.some((line) => line.kind === "image") || quote?.reused.some((line) => line.kind === "image"));

  // The quote only applies to the settings it was made for; any local change asks for a new one.
  const dirty = useMemo(() => (quote !== null && quote.target !== "film") || quality !== project.quality || parsedBudget !== project.budget || referenceFrames !== quotedRefFrames || (frameModel || null) !== project.frameModel || videoScenes.some((scene) => {
    const local = selection[scene.id];
    return Boolean(local?.ai) !== (scene.motion === "ai") || (local?.ai && (local.model ?? null) !== scene.videoModel);
  }), [quote, quality, parsedBudget, referenceFrames, quotedRefFrames, frameModel, selection, project.quality, project.budget, project.frameModel, videoScenes]);
  const preview = useMemo(() => (quote && !dirty ? buildShotPreview(project) : []), [quote, dirty, project]);

  useEffect(() => {
    if (!quote || expired) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [quote, expired]);

  async function requestQuote() {
    if (!providers.gmi) { setError("Üretim için GMI anahtarı gerekli."); return; }
    if (parsedBudget === null || !Number.isFinite(parsedBudget) || parsedBudget < 0) { setError("Ücretli üretim için 0 veya daha büyük bir bütçe girin."); return; }
    setBusy("quote"); setError("");
    try {
      const updated = await send(`/api/projects/${project.id}/quote`, {
        revision: project.revision, quality, budget: parsedBudget, referenceFrames: true, frameModel: frameModel || null,
        selections: videoScenes.map((scene) => ({ sceneId: scene.id, motion: "ai" as const, videoModel: selection[scene.id]?.model ?? null })),
      });
      onProjectChange(updated);
      setNow(Date.now());
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Teklif alınamadı."); }
    finally { setBusy(null); }
  }

  async function approve() {
    if (!quote) return;
    setBusy("start"); setError("");
    try { onRunStarted(await send(`/api/projects/${project.id}/run`, { mode: "paid", revision: project.revision, quoteId: quote.id }, crypto.randomUUID())); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Üretim başlatılamadı."); }
    finally { setBusy(null); }
  }

  return <section className="paid-panel" aria-labelledby="paid-panel-title">
    <div className="paid-panel-heading">
      <div><h2 id="paid-panel-title">Filmi üret</h2><p className="quiet">Kareler ve videolar çizilir, sonra tek filmde birleşir. Fiyatı görüp onaylamadan ücret oluşmaz.</p></div>
      <span className="paid-spend"><Receipt size={14} /> <strong>{usd(spent)}</strong>{project.budget !== null ? <> / {usd(project.budget)}</> : null}</span>
    </div>

    {!providers.gmi ? <p className="note note-warn"><Info size={15} />GMI bağlı değil. .env.local dosyasına GMI_API_KEY ekleyip sunucuyu yeniden başlat.</p> : !videoScenes.length ? <p className="paid-empty">Filmde görüntülü sahne yok.</p> : <>
      <fieldset className="paid-tiers" disabled={disabled || busy !== null}>
        <legend>Kalite seviyesi</legend>
        {TIERS.map((tier) => <button key={tier.id} type="button" className={quality === tier.id ? "is-selected" : ""} aria-pressed={quality === tier.id} onClick={() => setQuality(tier.id)}><strong>{tier.label}</strong><span>{tier.hint}</span></button>)}
      </fieldset>

      <details className="paid-models">
        <summary>Model seçimi <span className="quiet">Otomatik: her sahne için seviyene uyan en ucuz model</span></summary>
        <div className="paid-scene">
          <span><strong>Kareler</strong><small>{videoScenes.length} sahne, {refSceneIds.size} tanesinde onaylı oyuncu referansı</small></span>
          <select aria-label="Kare modeli" name="frameModel" value={frameModel} disabled={disabled || busy !== null} onChange={(event) => setFrameModel(event.target.value)}><option value="">Otomatik</option>{FRAME_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select>
        </div>
      <div className="paid-scenes">{videoScenes.map((scene) => {
        const local = selection[scene.id] ?? { ai: true, model: null };
        return <div key={scene.id} className="paid-scene">
          <span><strong>{scene.order.toString().padStart(2, "0")} {scene.title}</strong><small>{scene.duration} sn{scene.imageSource === "generated" ? ", karesi hazır" : ""}</small></span>
          <select aria-label={`${scene.title} için video modeli`} name={`model-${scene.id}`} value={local.model ?? ""} disabled={disabled || busy !== null} onChange={(event) => setSelection({ ...selection, [scene.id]: { ai: true, model: event.target.value || null } })}><option value="">Otomatik</option>{videoModels.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select>
        </div>;
      })}</div>
      </details>
      {project.narration.engine === "gmi" ? <p className="paid-note"><ShieldCheck size={13} /> Dış ses de bu teklife dahil.</p> : null}

      <div className="paid-actions">
        <label className="paid-budget"><span>Bütçe tavanı</span><input type="number" name="budget" min={0} max={100000} step="0.5" inputMode="decimal" value={budget} disabled={disabled || busy !== null} onChange={(event) => setBudget(event.target.value)} /><span>USD</span></label>
        <button type="button" className="button" disabled={disabled || busy !== null} onClick={() => void requestQuote()}>{busy === "quote" ? <LoaderCircle size={14} className="spin" /> : <Sparkles size={14} />} {busy === "quote" ? "Fiyatlar alınıyor…" : quote && !dirty ? "Fiyatı yenile" : "Fiyatı gör"}</button>
      </div>

      {quote && !dirty ? <div className="paid-quote">
        <table>
          <thead><tr><th>Sahne</th><th>Model</th><th>Ne</th><th>Fiyat</th><th>Seçenekler</th></tr></thead>
          <tbody>{quote.lines.map((line) => <tr key={`${line.sceneId}-${line.kind ?? "video"}`}>
            <td>{line.title}</td>
            <td><strong>{line.modelLabel}</strong><small>{line.reason}</small></td>
            <td>{line.kind === "image" ? "Kare" : line.kind === "voice" ? "Dış ses" : `${line.billedSeconds} sn`}</td>
            <td><strong>{usd(line.estimate)}</strong></td>
            <td><small>{line.alternative ? `Sonraki: ${line.alternative.label} ${usd(line.alternative.estimate)}` : "Tek uygun model"}{line.priciest && line.priciest.label !== line.alternative?.label ? ` · En pahalı: ${line.priciest.label} ${usd(line.priciest.estimate)}` : ""}</small></td>
          </tr>)}{quote.reused.map((line) => <tr key={`${line.sceneId}-${line.kind}-reused`} className="paid-reused">
            <td>{line.title}</td>
            <td><strong>{line.modelLabel}</strong><small>Aynı kare ve hareketle daha önce üretildi; yeniden kullanılır.</small></td>
            <td>{line.kind === "image" ? "Kare" : line.kind === "voice" ? "Mevcut ses" : "Mevcut klip"}</td>
            <td><strong>0 $</strong></td>
            <td><small>Tasarruf {usd(line.saved)}</small></td>
          </tr>)}</tbody>
        </table>
        {!quote.lines.length && quote.reused.length ? <p className="paid-empty">Seçtiğin her çekim bu kare ve hareketle zaten üretilmiş; yeni ücret gerekmiyor. Onayladığında mevcut videolar yeniden kullanılır.</p> : null}
        {quote.warnings.length ? <ul className="warnings" aria-label="Dikkat">{quote.warnings.map((item) => <li key={item}><TriangleAlert size={13} />{item}</li>)}</ul> : null}
        {quote.errors.length ? <ul className="paid-errors">{quote.errors.map((item) => <li key={item}><TriangleAlert size={12} /> {item}</li>)}</ul> : null}
        <div className="paid-total">
          <span>Toplam <strong>{usd(quote.total)}</strong></span>
          <span>Kalan bütçe {usd(Math.max(0, quote.remaining))}</span>
          <span>{expired ? "Teklifin süresi doldu" : `Geçerlilik: ${Math.max(1, Math.ceil((Date.parse(quote.expiresAt) - now) / 60_000))} dk`}</span>
        </div>
        {preview.length ? <details className="paid-preview">
          <summary>Modellere gidecek tarifler ve referanslar ({preview.length})</summary>
          <div className="preview-list">
            {preview.map((line) => <article key={line.sceneId}>
              <strong>{line.title}</strong>
              {line.frame ? <div>
                <small>Kare, {line.frame.modelLabel}{line.frame.truncated ? " (kısaltıldı)" : ""}</small>
                {line.frame.references.length ? <div className="preview-refs">{line.frame.references.map((reference, index) => <figure key={`${reference.url}-${index}`}><img src={reference.url} alt={reference.name} /><figcaption>{reference.name}</figcaption></figure>)}</div> : <p className="paid-note">Referans görsel yok; kare yalnızca metinden çizilir.</p>}
                <p className="prompt-text">{line.frame.prompt}</p>
              </div> : null}
              {line.video ? <div>
                <small>Video, {line.video.modelLabel}{line.video.truncated ? " (kısaltıldı)" : ""}</small>
                <p className="prompt-text">{line.video.prompt}</p>
              </div> : null}
              {line.warnings.map((warning) => <p key={warning} className="paid-errors"><TriangleAlert size={12} /> {warning}</p>)}
            </article>)}
          </div>
        </details> : null}
        <p className="paid-note"><ShieldCheck size={13} /> Fiyatlar GMI&apos;ın canlı fiyatlarıdır; emin olunamayan durumda yüksek olan alınır. Sonucu belirsiz kalan bir istek asla ikinci kez gönderilmez.</p>
        <button type="button" className="button button-lamp" disabled={disabled || busy !== null || expired || !quote.withinBudget} onClick={() => void approve()}>{busy === "start" ? <LoaderCircle size={14} className="spin" /> : <Check size={14} />} {quote.withinBudget ? `Onayla ve üret, ${usd(quote.total)}` : "Bütçe ya da model uygun değil"}</button>
      </div> : quote && dirty ? <p className="paid-empty">Ayarlar değişti; fiyatı yenile.</p> : null}
    </>}

    {error ? <p className="note note-error" role="alert">{error}</p> : null}

    {project.ledger.length ? <details className="paid-ledger">
      <summary><Clapperboard size={13} /> Harcama kaydı ({project.ledger.length})</summary>
      <ol>{project.ledger.toReversed().slice(0, 30).map((entry) => <li key={entry.id}>
        <time>{new Date(entry.at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
        <span><strong>{entry.sceneTitle}</strong> · {entry.modelLabel}<small>{entry.note}</small></span>
        <span className={`paid-status paid-status-${entry.status}`}>{LEDGER_STATUS[entry.status]}</span>
        <strong>{usd(entry.actual ?? entry.estimate)}</strong>
      </li>)}</ol>
    </details> : null}
  </section>;
}
