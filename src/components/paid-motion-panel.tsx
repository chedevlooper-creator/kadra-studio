"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, Clapperboard, Info, LoaderCircle, Receipt, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { FRAME_MODELS } from "@/lib/routing/frame-router";
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
  return Object.fromEntries(project.scenes.filter((scene) => scene.kind === "video").map((scene) => [scene.id, { ai: scene.motion === "ai", model: scene.videoModel }]));
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
  const [referenceFrames, setReferenceFrames] = useState(() => Boolean(project.quote?.lines.some((line) => line.kind === "image") || project.quote?.reused.some((line) => line.kind === "image")));
  const [frameModel, setFrameModel] = useState(project.frameModel ?? "");
  const [bulkVideoModel, setBulkVideoModel] = useState("");
  const [busy, setBusy] = useState<"quote" | "start" | null>(null);
  const [error, setError] = useState("");
  const [now, setNow] = useState(() => Date.now());
  const spent = committedSpend(project.ledger);
  const parsedBudget = budget.trim() === "" ? null : Number(budget);
  const quote = project.quote;
  const expired = quote ? Date.parse(quote.expiresAt) <= now : false;
  const chosenCount = Object.values(selection).filter((item) => item.ai).length;
  const allChosen = videoScenes.length > 0 && chosenCount === videoScenes.length;
  const quotedRefFrames = Boolean(quote?.lines.some((line) => line.kind === "image") || quote?.reused.some((line) => line.kind === "image"));

  // The quote only applies to the settings it was made for; any local change asks for a new one.
  const dirty = useMemo(() => quality !== project.quality || parsedBudget !== project.budget || referenceFrames !== quotedRefFrames || (frameModel || null) !== project.frameModel || videoScenes.some((scene) => {
    const local = selection[scene.id];
    return Boolean(local?.ai) !== (scene.motion === "ai") || (local?.ai && (local.model ?? null) !== scene.videoModel);
  }), [quality, parsedBudget, referenceFrames, quotedRefFrames, frameModel, selection, project.quality, project.budget, project.frameModel, videoScenes]);

  useEffect(() => {
    if (!quote || expired) return;
    const timer = setInterval(() => setNow(Date.now()), 15_000);
    return () => clearInterval(timer);
  }, [quote, expired]);

  function toggleAllScenes(enable: boolean, modelOverride?: string | null) {
    setSelection(Object.fromEntries(videoScenes.map((scene) => {
      const current = selection[scene.id] ?? { ai: false, model: null };
      return [scene.id, { ai: enable, model: modelOverride !== undefined ? modelOverride : current.model }];
    })));
  }

  function applyBulkVideoModel(value: string) {
    setBulkVideoModel(value);
    const nextModel = value || null;
    const hasAnySelected = Object.values(selection).some((item) => item.ai);
    setSelection(Object.fromEntries(videoScenes.map((scene) => {
      const current = selection[scene.id] ?? { ai: false, model: null };
      const shouldEnable = hasAnySelected ? current.ai : true;
      return [scene.id, { ai: shouldEnable, model: shouldEnable ? nextModel : current.model }];
    })));
  }

  async function requestQuote() {
    if (chosenCount === 0 && !referenceFrames && project.narration.engine !== "gmi") {
      setError("Teklif almak için en az bir video çekimi seçin, üstten GMI kare üretimini işaretleyin veya Seslendirme sekmesinden GMI dış sesini açın.");
      return;
    }
    if (parsedBudget === null || !Number.isFinite(parsedBudget) || parsedBudget < 0) { setError("Ücretli üretim için 0 veya daha büyük bir bütçe girin."); return; }
    setBusy("quote"); setError("");
    try {
      const updated = await send(`/api/projects/${project.id}/quote`, {
        revision: project.revision, quality, budget: parsedBudget, referenceFrames, frameModel: frameModel || null,
        selections: videoScenes.map((scene) => ({ sceneId: scene.id, motion: selection[scene.id]?.ai ? "ai" : "free", videoModel: selection[scene.id]?.ai ? selection[scene.id]?.model ?? null : null })),
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
      <div><span className="studio-eyebrow">ÜCRETLİ · GMI</span><h3 id="paid-panel-title">Yapay zekâ kare ve video üretimi</h3><p>İstediğin kare ve video modellerini doğrudan seç. Seçtiğin çekimler gerçek videoya dönüşür; başlangıç karesi henüz yoksa üretim sırasında otomatik hazırlanır. Teklifi onaylamadan hiçbir ücret oluşmaz.</p></div>
      <span className="paid-spend"><Receipt size={14} /> Harcanan <strong>{usd(spent)}</strong>{project.budget !== null ? <> / {usd(project.budget)}</> : null}</span>
    </div>

    {!providers.gmi ? <div className="studio-local-notice"><Info size={15} /><p>GMI anahtarı tanımlı değil. Proje klasöründeki .env.local dosyasına GMI_API_KEY ekleyip sunucuyu yeniden başlatın.</p></div> : !videoScenes.length ? <p className="paid-empty">Önce video çekimleri içeren bir plan hazırlayın.</p> : <>
      <fieldset className="paid-tiers" disabled={disabled || busy !== null}>
        <legend>Kalite seviyesi</legend>
        {TIERS.map((tier) => <button key={tier.id} type="button" className={quality === tier.id ? "is-selected" : ""} aria-pressed={quality === tier.id} onClick={() => setQuality(tier.id)}><strong>{tier.label}</strong><span>{tier.hint}</span></button>)}
      </fieldset>

      <div className={`paid-scene ${referenceFrames ? "is-on" : ""}`} style={{ marginBottom: 10 }}>
        <label><input type="checkbox" name="referenceFrames" checked={referenceFrames} disabled={disabled || busy !== null} onChange={(event) => setReferenceFrames(event.target.checked)} /><span><strong>{refSceneIds.size ? `Sahne karelerini GMI ile üret ve onaylı karakter/mekân sayfalarını referans ver (${videoScenes.length} çekim, ${refSceneIds.size} referanslı)` : `Sahne karelerini GMI görsel modelleriyle üret (${videoScenes.length} çekim)`}</strong><small>{refSceneIds.size ? "Onaylı karakter veya mekân sayfası olan çekimlerde sayfalar referans verilir; diğer kareler sahne promptundan seçilen GMI görsel modeliyle üretilir." : "Ücretsiz FLUX yerine sahne başlangıç karelerini doğrudan seçtiğin ücretli GMI görsel modeliyle (Hunyuan, Nano Banana, Seedream) üret."}</small></span></label>
        <select aria-label="Kare modeli" name="frameModel" value={frameModel} disabled={disabled || busy !== null} onChange={(event) => { setFrameModel(event.target.value); setReferenceFrames(true); }}><option value="">Otomatik · en ucuz uygun kare modeli</option>{FRAME_MODELS.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select>
      </div>

      {project.narration.engine === "gmi" ? <p className="paid-note"><ShieldCheck size={13} /> Dış ses MiniMax Türkçe sesiyle bu teklife dahil edilir (karakter başına fiyat). Ayarı Seslendirme sekmesinden değiştirebilirsin.</p> : null}

      <div className="paid-scene is-on" style={{ marginBottom: 10 }}>
        <label><input type="checkbox" name="selectAllVideoScenes" checked={allChosen} disabled={disabled || busy !== null} onChange={(event) => toggleAllScenes(event.target.checked, bulkVideoModel || null)} /><span><strong>Tüm video çekimlerini seç ({chosenCount}/{videoScenes.length} seçili)</strong><small>Tüm çekimleri tek tıkla yapay zekâ videosuna dahil et veya sağdan tümü için tek bir video modeli belirle.</small></span></label>
        <select aria-label="Tüm çekimler için video modeli" name="bulkVideoModel" value={bulkVideoModel} disabled={disabled || busy !== null} onChange={(event) => applyBulkVideoModel(event.target.value)}><option value="">Toplu model · Otomatik (en ucuz uygun)</option>{videoModels.map((model) => <option key={model.id} value={model.id}>Tümü: {model.label}</option>)}</select>
      </div>

      <div className="paid-scenes">{videoScenes.map((scene) => {
        const local = selection[scene.id] ?? { ai: false, model: null };
        const frameHint = scene.imageSource === "generated" ? " · mevcut kare hazır" : referenceFrames ? " · önce GMI ile karesi üretilir" : providers.nvidia ? " · önce ücretsiz FLUX karesi üretilir" : "";
        return <div key={scene.id} className={`paid-scene ${local.ai ? "is-on" : ""}`}>
          <label><input type="checkbox" name={`scene-${scene.id}`} aria-label={`${scene.title} çekimini yapay zekâyla hareketlendir`} checked={local.ai} disabled={disabled || busy !== null} onChange={(event) => setSelection({ ...selection, [scene.id]: { ...local, ai: event.target.checked } })} /><span><strong>{scene.order.toString().padStart(2, "0")} · {scene.title}</strong><small>{scene.duration} sn{frameHint}</small></span></label>
          <select aria-label={`${scene.title} için model`} name={`model-${scene.id}`} value={local.model ?? ""} disabled={disabled || busy !== null} onChange={(event) => setSelection({ ...selection, [scene.id]: { ai: true, model: event.target.value || null } })}><option value="">Otomatik · en ucuz uygun</option>{videoModels.map((model) => <option key={model.id} value={model.id}>{model.label}</option>)}</select>
        </div>;
      })}</div>

      <div className="paid-actions">
        <label className="paid-budget"><span>Proje bütçesi</span><input type="number" name="budget" min={0} max={100000} step="0.5" inputMode="decimal" value={budget} disabled={disabled || busy !== null} onChange={(event) => setBudget(event.target.value)} /><span>USD</span></label>
        <button type="button" className="studio-button studio-button-secondary" disabled={disabled || busy !== null} onClick={() => void requestQuote()}>{busy === "quote" ? <LoaderCircle size={14} className="studio-spin" /> : <Sparkles size={14} />} {busy === "quote" ? "Canlı fiyatlar alınıyor…" : quote && !dirty ? "Teklifi yenile" : "Fiyat teklifi al"}</button>
      </div>

      {quote && !dirty ? <div className="paid-quote">
        <table>
          <thead><tr><th>Çekim</th><th>Seçilen model</th><th>Süre</th><th>Tahmin</th><th>Karşılaştırma</th></tr></thead>
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
        {!quote.lines.length && quote.reused.length ? <p className="paid-empty">Seçtiğin her çekim bu kare ve hareketle zaten üretilmiş; yeni ücret gerekmiyor. &quot;Mevcut karelerle film&quot; bu videoları ücretsiz kullanır.</p> : null}
        {quote.errors.length ? <ul className="paid-errors">{quote.errors.map((item) => <li key={item}><TriangleAlert size={12} /> {item}</li>)}</ul> : null}
        <div className="paid-total">
          <span>Toplam tahmin <strong>{usd(quote.total)}</strong></span>
          <span>Kalan bütçe {usd(Math.max(0, quote.remaining))}</span>
          <span>{expired ? "Teklifin süresi doldu" : `Geçerlilik: ${Math.max(1, Math.ceil((Date.parse(quote.expiresAt) - now) / 60_000))} dk`}</span>
        </div>
        <p className="paid-note"><ShieldCheck size={13} /> Onaylarsan seçili çekimlerin kareleri GMI depolamasına yüklenir (herkese açık ama tahmin edilemez bir adres). Tahminler GMI&apos;ın canlı fiyatlarıdır; belirsiz durumda yüksek fiyat varsayılır. Bir gönderimin sonucu belirsiz kalırsa istek tekrar gönderilmez, çekim ücretsiz yöntemle tamamlanır.</p>
        <button type="button" className="studio-button studio-button-primary" disabled={disabled || busy !== null || expired || !quote.withinBudget} onClick={() => void approve()}>{busy === "start" ? <LoaderCircle size={14} className="studio-spin" /> : <Check size={14} />} {quote.withinBudget ? `Onayla ve üret · ${usd(quote.total)}` : "Bütçe veya model uygun değil"}</button>
      </div> : quote && dirty ? <p className="paid-empty">Ayarlar değişti; onaylamadan önce teklifi güncelle.</p> : null}
    </>}

    {error ? <p className="studio-dialog-error" role="alert">{error}</p> : null}

    {project.ledger.length ? <div className="paid-ledger">
      <h4><Clapperboard size={13} /> Harcama defteri</h4>
      <ol>{project.ledger.toReversed().slice(0, 30).map((entry) => <li key={entry.id}>
        <time>{new Date(entry.at).toLocaleString("tr-TR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</time>
        <span><strong>{entry.sceneTitle}</strong> · {entry.modelLabel}<small>{entry.note}</small></span>
        <span className={`paid-status paid-status-${entry.status}`}>{LEDGER_STATUS[entry.status]}</span>
        <strong>{usd(entry.actual ?? entry.estimate)}</strong>
      </li>)}</ol>
    </div> : null}
  </section>;
}
