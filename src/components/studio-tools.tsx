"use client";

import Image from "next/image";
import dynamic from "next/dynamic";
import { useState, type FormEvent } from "react";
import { ArrowDownToLine, ArrowRight, AtSign, AudioLines, Check, Clapperboard, Code2, Copy, FolderOpen, Layers3, LayoutGrid, LoaderCircle, Plus, ScanFace, Sparkles, Terminal, WandSparkles } from "lucide-react";
import { PRESETS, presetOf } from "@/lib/cinema";
import {
  AE_PLUGIN_TOOLS,
  CONTENT_FACTORY_STYLES,
  defaultStudioDraft,
  generateAfterEffectsExtendScript,
  generateBlenderPythonScript,
  insertElementMention,
  MCP_AGENT_SKILLS,
  MCP_CONNECTOR_GUIDES,
  POPCORN_MODES,
  studioProjectInput,
  type StudioView,
} from "@/lib/studio-draft";
import type { AspectRatio, Project, ProviderStatus } from "@/lib/types";
import RepairDialog, { type RepairTarget } from "./repair-dialog";
import "./project-studio.css";

const CharacterBank = dynamic(() => import("./character-bank"));
const MusicLane = dynamic(() => import("./music-lane"));
const NarrationPanel = dynamic(() => import("./narration-panel"));
const ExportPanel = dynamic(() => import("./export-panel"));

export const TOOLS = {
  popcorn: {
    title: "Popcorn Storyboard",
    eyebrow: "TEK FİKİRDEN TUTARLI ÇOKLU SAHNE",
    description: "Otomatik AI planlama, manuel kadraj dizisi veya hızlı seri (photodump) moduyla 4–8 tutarlı sahneyi tek seferde kurgula.",
    icon: LayoutGrid,
  },
  factory: {
    title: "Content Factory",
    eyebrow: "TREND TARZLAR GİRER · HAZIR SERİLER ÇIKAR",
    description: "Viral kısa video veya mini dizi formatını seç, bölüm konusunu yaz ve sahne sahne yayına hazır projeye dönüştür.",
    icon: Sparkles,
  },
  mcp: {
    title: "Higgsfield MCP & Agent Skills",
    eyebrow: "FOR_AGENTS · HER AJAN İÇİN GÖRSEL VE VİDEO ÜRETİMİ",
    description: "Claude Code, Antigravity, ChatGPT veya CLI ajanlarını MCP köprüsüyle bağla; /katana, /ugc-flow ve /use-after-effects becerileriyle doğrudan sahne üret.",
    icon: Terminal,
  },
  "after-effects": {
    title: "Adobe After Effects & AI Motion Designer",
    eyebrow: "WINDOW > EXTENSIONS > HIGGSFIELD · @HIGGSFIELD /USE-AFTER-EFFECTS",
    description: "Timeline içi AI Video/Görsel, Smart Reframe, Remove Background, Draw to Edit ve projenden doğrudan düzenlenebilir After Effects (.jsx) kompozisyon üretimi.",
    icon: Code2,
  },
  layers: {
    title: "Katmanlar & Bölge Onarımı",
    eyebrow: "MASKELİ BÖLGESEL YENİDEN ÇİZİM (INPAINT)",
    description: "Sahnelerindeki veya karakter sayfalarındaki tek bir bölgeyi seçerek geri kalan piksellere dokunmadan yeniden çizdir.",
    icon: WandSparkles,
  },
  characters: {
    title: "Karakter stüdyosu · Soul ID",
    eyebrow: "HER SAHNEDE AYNI KARAKTER VE MEKÂN",
    description: "Karakterlerini ve mekânlarını tanımla. Referans fotoğraflarını ekle, oluşturulan sayfaları onayla.",
    icon: ScanFace,
  },
  audio: {
    title: "Ses stüdyosu",
    eyebrow: "HİKÂYENİN BİR SESİ OLSUN",
    description: "Türkçe dış ses, müzik ve ses dengesi. Bütün sesler projenle birlikte saklanır.",
    icon: AudioLines,
  },
  editor: {
    title: "Video editör",
    eyebrow: "HER ŞEYİ BİR ARAYA GETİR",
    description: "Sahnelerini düzenle, filmini izle ve istediğin ekran oranında dışa aktar.",
    icon: Clapperboard,
  },
};

export type ToolKey = keyof typeof TOOLS;

export default function StudioTools({ tool, projects, providers, onProjectChange, onOpen, onNavigate, onNew, notify }: {
  tool: ToolKey;
  projects: Project[];
  providers: ProviderStatus;
  onProjectChange: (project: Project) => void;
  onOpen: (project: Project, step?: "story" | "cast" | "scenes" | "film") => void;
  onNavigate?: (view: StudioView) => void;
  onNew: () => void;
  notify: (message: string) => void;
}) {
  const [projectId, setProjectId] = useState(() => projects.find((project) => !project.isExample)?.id ?? projects[0]?.id ?? "");
  const project = projects.find((item) => item.id === projectId);
  const config = TOOLS[tool];
  const running = project?.run?.status === "running";

  return <section className="hf-tools-page">
    <div className="hf-section-head">
      <div>
        <span className="hf-eyebrow">{config.eyebrow}</span>
        <h1><config.icon size={30} strokeWidth={1.5} />{config.title}</h1>
        <p>{config.description}</p>
      </div>
      <button type="button" className="button" onClick={onNew}><Plus size={16} />Yeni proje</button>
    </div>

    {tool === "popcorn" ? (
      <PopcornStudio
        projects={projects}
        onCreated={(created) => {
          onProjectChange(created);
          notify("Popcorn Storyboard hazırlandı.");
          onOpen(created, "scenes");
        }}
        notify={notify}
      />
    ) : tool === "factory" ? (
      <ContentFactoryStudio
        onCreated={(created) => {
          onProjectChange(created);
          notify("Content Factory serisi hazırlandı.");
          onOpen(created, "scenes");
        }}
        notify={notify}
      />
    ) : tool === "mcp" ? (
      <McpAgentStudio
        onCreated={(created) => {
          onProjectChange(created);
          notify("MCP Skill projesi hazırlandı.");
          onOpen(created, "scenes");
        }}
        notify={notify}
      />
    ) : (
      <>
        <div className="hf-tool-project-picker">
          <FolderOpen size={18} />
          <label>
            <span>Çalışılacak proje</span>
            <select aria-label="Çalışılacak proje" value={projectId} onChange={(event) => setProjectId(event.target.value)}>
              {projects.map((item) => <option key={item.id} value={item.id}>{item.title}{item.isExample ? " · Örnek" : ""}</option>)}
            </select>
          </label>
          {project ? <button type="button" className="hf-text-link" onClick={() => onOpen(project, tool === "characters" ? "cast" : tool === "layers" || tool === "after-effects" ? "scenes" : "film")}>Projede aç <ArrowRight size={15} /></button> : null}
        </div>
        {project ? (
          <div className="hf-tools-body" key={`${tool}:${project.id}`}>
            {running ? <p className="note note-warn">Üretim sürüyor. Değişiklikler üretim tamamlandıktan sonra açılır.</p> : null}
            {tool === "after-effects" ? (
              <AfterEffectsMotionStudio project={project} onNavigate={onNavigate} onOpen={onOpen} notify={notify} />
            ) : tool === "layers" ? (
              <LayersRepairStudio project={project} disabled={running} onProjectChange={onProjectChange} onOpen={onOpen} notify={notify} />
            ) : tool === "characters" ? (
              <CharacterBank project={project} providers={providers} disabled={running} onProjectChange={onProjectChange} notify={notify} />
            ) : tool === "audio" ? (
              <>
                <NarrationPanel project={project} disabled={running} onProjectChange={onProjectChange} notify={notify} />
                <MusicLane project={project} disabled={running} onProjectChange={onProjectChange} notify={notify} />
                <div className="hf-tool-info">
                  <strong>Dış ses metnini sahnelerde düzenle</strong>
                  <p>Her çekimin metni ayrı okunur. Seslendirme üretim sırasında filme eklenir.</p>
                  <button type="button" className="button" onClick={() => onOpen(project, "scenes")}>Sahne metinlerini düzenle <ArrowRight size={15} /></button>
                </div>
              </>
            ) : (
              <>
                {project.output ? <div className="hf-editor-player"><video key={project.output.url} src={project.output.url} controls playsInline preload="metadata" /></div> : <div className="hf-empty"><Clapperboard size={40} strokeWidth={1.2} /><h2>Filminin kurgusunu hazırla</h2><p>{project.scenes.length} sahnen var. Çekim sırası, süreler ve geçişleri proje editöründen düzenle.</p></div>}
                <div className="hf-editor-shot-strip">{project.scenes.map((scene) => <button type="button" key={scene.id} onClick={() => onOpen(project, "scenes")}><span>{String(scene.order).padStart(2, "0")}</span><strong>{scene.title}</strong><small>{scene.duration} sn</small></button>)}</div>
                <div className="row"><button type="button" className="button button-lamp" onClick={() => onOpen(project, "scenes")}>Sahneleri düzenle <ArrowRight size={16} /></button><button type="button" className="button" onClick={() => onOpen(project, "film")}>Üretim ve montaj <Clapperboard size={16} /></button></div>
                {project.output ? <ExportPanel project={project} /> : null}
              </>
            )}
          </div>
        ) : (
          <div className="hf-empty"><FolderOpen size={35} /><h2>Önce bir proje oluştur</h2><p>Karakter, After Effects, katman, ses ve kurgu ayarları projeye bağlı saklanır.</p><button type="button" className="button button-lamp" onClick={onNew}><Plus size={16} />Proje oluştur</button></div>
        )}
      </>
    )}
  </section>;
}

function McpAgentStudio({ onCreated, notify }: { onCreated: (project: Project) => void; notify: (message: string) => void }) {
  const [connectorId, setConnectorId] = useState<(typeof MCP_CONNECTOR_GUIDES)[number]["id"]>("kadra-local");
  const [category, setCategory] = useState("all");
  const [copiedKey, setCopiedKey] = useState("");
  const [busyId, setBusyId] = useState("");
  const [rpcPreview, setRpcPreview] = useState("");
  const activeConnector = MCP_CONNECTOR_GUIDES.find((item) => item.id === connectorId) ?? MCP_CONNECTOR_GUIDES[0];

  const categories = ["all", "For After Effects", "For Blender", "Motion Design", "Paid Ads", "UGC", "Faceless"];
  const visibleSkills = MCP_AGENT_SKILLS.filter((skill) => category === "all" || skill.category === category);

  async function copyText(key: string, value: string) {
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
    } catch {
      notify("Panoya kopyalanamadı.");
    }
  }

  async function testLocalMcpServer() {
    setBusyId("mcp-ping");
    try {
      const response = await fetch("/api/mcp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "tools/list" }),
      });
      const data = await response.json();
      setRpcPreview(JSON.stringify(data, null, 2));
      notify("Yerel Kadra MCP sunucusu (/api/mcp) yanıt verdi.");
    } catch (error) {
      notify(error instanceof Error ? error.message : "MCP sunucusuna ulaşılamadı.");
    } finally {
      setBusyId("");
    }
  }

  async function launchSkill(skill: (typeof MCP_AGENT_SKILLS)[number]) {
    if (busyId) return;
    setBusyId(skill.id);
    try {
      const draft = {
        ...defaultStudioDraft("video", { id: 1, presetId: skill.presetId, prompt: skill.samplePrompt }),
        aspectRatio: skill.aspectRatio,
        shotCount: 4,
      };
      const payload = studioProjectInput(draft, null);
      const response = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !data.project) throw new Error(data.error ?? "MCP Skill projesi oluşturulamadı.");
      onCreated(data.project);
    } catch (error) {
      notify(error instanceof Error ? error.message : "MCP Skill projesi oluşturulamadı.");
    } finally {
      setBusyId("");
    }
  }

  return <div className="hf-mcp-studio">
    <div className="hf-popcorn-modes" role="group" aria-label="MCP Ajan Bağlayıcıları">
      {MCP_CONNECTOR_GUIDES.map((item) => (
        <button key={item.id} type="button" className="hf-popcorn-mode-card" aria-pressed={connectorId === item.id} onClick={() => setConnectorId(item.id)}>
          <div className="hf-popcorn-mode-top">
            <strong>{item.name}</strong>
            <span>MCP</span>
          </div>
          <p>{item.endpoint}</p>
        </button>
      ))}
    </div>

    <div className="hf-mcp-connector-box">
      <div className="hf-mcp-connector-info">
        <span className="hf-eyebrow">MCP BRIDGE · {activeConnector.publicEndpoint}</span>
        <h2>{activeConnector.name}</h2>
        <ol className="hf-mcp-steps">
          {activeConnector.steps.map((step) => <li key={step}>{step}</li>)}
        </ol>
        <div className="row">
          <button type="button" className="button button-small button-lamp" onClick={() => void copyText("endpoint", activeConnector.endpoint)}>
            {copiedKey === "endpoint" ? <Check size={13} /> : <Copy size={13} />}
            {copiedKey === "endpoint" ? "Köprü URL Kopyalandı" : `Köprü URL: ${activeConnector.endpoint}`}
          </button>
          <button type="button" className="button button-small" onClick={() => void copyText("cmd", activeConnector.command)}>
            {copiedKey === "cmd" ? <Check size={13} /> : <Terminal size={13} />}
            {copiedKey === "cmd" ? "Komut Kopyalandı" : activeConnector.command}
          </button>
          <button type="button" className="button button-small" disabled={busyId === "mcp-ping"} onClick={() => void testLocalMcpServer()}>
            {busyId === "mcp-ping" ? <LoaderCircle size={13} className="spin" /> : <Code2 size={13} />}
            Canlı /api/mcp Sunucusunu Test Et
          </button>
        </div>
      </div>
      <div className="hf-mcp-code-wrap">
        <div className="hf-mcp-code-head">
          <span>{rpcPreview ? "POST /api/mcp (tools/list yanıtı)" : "mcp_config.json"}</span>
          <button type="button" className="text-button" onClick={() => void copyText("json", rpcPreview || activeConnector.configJson)}>
            {copiedKey === "json" ? <Check size={13} /> : <Copy size={13} />}
            {copiedKey === "json" ? "Kopyalandı" : "JSON Kopyala"}
          </button>
        </div>
        <pre><code>{rpcPreview || activeConnector.configJson}</code></pre>
      </div>
    </div>

    <div className="hf-section-head">
      <div>
        <span className="hf-eyebrow">SKILL PRESETS · AJAN BECERİ KOMUTLARI</span>
        <h2>MCP İle Neler Üretebilirsin?</h2>
      </div>
      <div className="hf-filter-tabs" role="group" aria-label="Skill kategorisi">
        {categories.map((cat) => (
          <button key={cat} type="button" aria-pressed={category === cat} onClick={() => setCategory(cat)}>
            {cat === "all" ? "Tümü" : cat}
          </button>
        ))}
      </div>
    </div>

    <div className="hf-xray-grid">
      {visibleSkills.map((skill) => (
        <article key={skill.id} className="hf-xray-card">
          <div className="hf-xray-body">
            <div className="hf-xray-title-row">
              <strong>{skill.title}</strong>
              <span className="hf-tool-badge">{skill.badge}</span>
            </div>
            <div className="hf-xray-shot-pills">
              <span><code>{skill.slash}</code></span>
              <span>{skill.category}</span>
              <span>{skill.aspectRatio}</span>
            </div>
            <p className="hf-xray-prompt-preview">{skill.description}</p>
            <div className="hf-xray-brief">
              <strong>Örnek Ajan Promptu</strong>
              <p>{skill.samplePrompt}</p>
            </div>
            <div className="hf-xray-actions">
              <button type="button" className="button button-small" onClick={() => void copyText(skill.id, `${skill.slash} ${skill.samplePrompt}`)}>
                {copiedKey === skill.id ? <Check size={13} /> : <Copy size={13} />}
                {copiedKey === skill.id ? "Kopyalandı" : "Komutu Kopyala"}
              </button>
              <button type="button" className="button button-small button-lamp" disabled={Boolean(busyId)} onClick={() => void launchSkill(skill)}>
                {busyId === skill.id ? <LoaderCircle size={13} className="spin" /> : <Sparkles size={13} />}
                Projeye Dönüştür
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>
  </div>;
}

function AfterEffectsMotionStudio({ project, onNavigate, onOpen, notify }: {
  project: Project;
  onNavigate?: (view: StudioView) => void;
  onOpen: (project: Project, step?: "story" | "cast" | "scenes" | "film") => void;
  notify: (message: string) => void;
}) {
  const [targetApp, setTargetApp] = useState<"ae" | "blender">("ae");
  const [motionStyle, setMotionStyle] = useState<"bounce" | "cinematic" | "kinetic">("bounce");
  const [lensMm, setLensMm] = useState<24 | 35 | 50 | 85>(35);
  const [copied, setCopied] = useState(false);
  const scriptCode = targetApp === "ae"
    ? generateAfterEffectsExtendScript(project, motionStyle)
    : generateBlenderPythonScript(project, lensMm);

  function downloadScript() {
    const slug = project.title.toLocaleLowerCase("tr").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "kadra-comp";
    const ext = targetApp === "ae" ? "after-effects.jsx" : "blender-rig.py";
    const url = URL.createObjectURL(new Blob([scriptCode], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${slug}-${ext}`;
    anchor.click();
    URL.revokeObjectURL(url);
    notify(targetApp === "ae" ? "Adobe After Effects (.jsx) script dosyası indirildi." : "Blender 3D Python (.py) script dosyası indirildi.");
  }

  return <div className="hf-ae-studio">
    <div className="hf-tool-info">
      <strong>Adobe Premiere Pro, After Effects &amp; Blender 3D Köprüsü (Window &gt; Extensions &gt; Higgsfield / Kadra)</strong>
      <p>Ürettiğin gerçek sahne videolarını/görsellerini (`app.project.importFile`), ses katmanlarını, akıllı kadraj (Reframe) çıktısını ve 3B kamera yörüngesini doğrudan After Effects (.jsx) veya Blender 3D (.py) sahnesine aktar.</p>
    </div>

    <div className="hf-xray-grid">
      {AE_PLUGIN_TOOLS.map((item) => (
        <article key={item.id} className="hf-xray-card">
          <div className="hf-xray-body">
            <div className="hf-xray-title-row">
              <strong>{item.title}</strong>
              <span className="hf-tool-badge">{item.badge}</span>
            </div>
            <p className="hf-xray-prompt-preview">{item.description}</p>
            <div className="hf-xray-actions">
              <button
                type="button"
                className="button button-small button-lamp"
                onClick={() => {
                  if (onNavigate) onNavigate(item.actionView);
                  else onOpen(project, "scenes");
                }}
              >
                Aracı Aç <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </article>
      ))}
    </div>

    <div className="hf-mcp-connector-box">
      <div className="hf-mcp-connector-info">
        <div className="hf-filter-tabs" role="group" aria-label="Hedef masaüstü uygulaması">
          <button type="button" aria-pressed={targetApp === "ae"} onClick={() => { setTargetApp("ae"); setCopied(false); }}>
            Adobe After Effects (.jsx)
          </button>
          <button type="button" aria-pressed={targetApp === "blender"} onClick={() => { setTargetApp("blender"); setCopied(false); }}>
            Blender 3D Kamera Rig (.py)
          </button>
        </div>
        <span className="hf-eyebrow">
          {targetApp === "ae"
            ? "AI MOTION DESIGNER · @HIGGSFIELD /USE-AFTER-EFFECTS"
            : "BLENDER 3D MCP · @HIGGSFIELD /USE-BLENDER"}
        </span>
        <h2>
          {targetApp === "ae"
            ? "Gerçek Medya İthalatlı After Effects (.jsx) Kompozisyon Üretici"
            : "Blender 3D Sinema Kamerası & Işık Rig (.py) Üretici"}
        </h2>
        <p className="quiet">
          {targetApp === "ae"
            ? "Diskteki gerçek sahne videolarını/görsellerini (app.project.importFile), ses izini, 35mm sanal kamerayı ve ivmeli (expression) tipografi katmanlarını içeren Adobe ExtendScript dosyası üretir."
            : "Seçilen sinema lensine göre alan derinliği (DOF), sahne geçiş keyframe'leri, 3 noktalı ışık kurulumu ve zaman çizelgesi işaretçileri içeren Blender 4.x Python (bpy) scripti üretir."}
        </p>
        {targetApp === "ae" ? (
          <label className="field">
            <span>Animasyon &amp; Keyframe İfadesi (Expression)</span>
            <select value={motionStyle} onChange={(e) => setMotionStyle(e.target.value as typeof motionStyle)}>
              <option value="bounce">Bounce Ease &amp; Light Streak (Yaylanan Logo / Başlık)</option>
              <option value="kinetic">Kinetik Tipografi (Yukarı İvmeli Metin Katmanları)</option>
              <option value="cinematic">Sinematik Yumuşak Geçiş (Linear Opacity Fade)</option>
            </select>
          </label>
        ) : (
          <label className="field">
            <span>3B Sinema Lensi &amp; Odak Uzaklığı (DOF f/1.8)</span>
            <select value={lensMm} onChange={(e) => setLensMm(Number(e.target.value) as 24 | 35 | 50 | 85)}>
              <option value={24}>24mm Geniş Açı Sinema Lensi</option>
              <option value={35}>35mm Anamorfik Sinema Lensi</option>
              <option value={50}>50mm Doğal Perspektif</option>
              <option value={85}>85mm Portre &amp; Sığ Alan Derinliği</option>
            </select>
          </label>
        )}
        <div className="row">
          <button type="button" className="button button-lamp" onClick={downloadScript}>
            <ArrowDownToLine size={15} /> {targetApp === "ae" ? "After Effects (.jsx) İndir" : "Blender (.py) İndir"}
          </button>
          <button
            type="button"
            className="button"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(scriptCode);
                setCopied(true);
              } catch {
                notify("Kopyalanamadı.");
              }
            }}
          >
            {copied ? <Check size={15} /> : <Copy size={15} />}
            {copied ? "Script Kopyalandı" : "Script Kodunu Kopyala"}
          </button>
        </div>
      </div>
      <div className="hf-mcp-code-wrap">
        <div className="hf-mcp-code-head">
          <span>{project.title} · {targetApp === "ae" ? "ExtendScript (.jsx)" : "Blender Python (.py)"}</span>
          <small>{project.scenes.length} sahne katmanı · {project.aspectRatio}</small>
        </div>
        <pre><code>{scriptCode}</code></pre>
      </div>
    </div>
  </div>;
}

function PopcornStudio({ projects, onCreated, notify }: { projects: Project[]; onCreated: (project: Project) => void; notify: (message: string) => void }) {
  const [mode, setMode] = useState<(typeof POPCORN_MODES)[number]["id"]>("auto");
  const [shotCount, setShotCount] = useState(4);
  const [presetId, setPresetId] = useState("cinematic");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("16:9");
  const [prompt, setPrompt] = useState("Sisli bir kıyı kasabasında @Gezgin eski deniz fenerinin kapısını açar, içeride çalışan antik saat mekanizmasını keşfeder.");
  const [busy, setBusy] = useState(false);

  const elements = Array.from(new Set([
    ...projects.flatMap((p) => p.characters.map((c) => c.name)),
    "Gezgin",
    "Dedektif",
    "Kozmonot",
    "DenizFeneri",
  ])).slice(0, 8);

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || prompt.trim().length < 10) return;
    setBusy(true);
    try {
      const draft = {
        ...defaultStudioDraft("video", { id: 1, presetId, prompt }),
        aspectRatio,
        shotCount: mode === "manual" ? Math.max(2, shotCount) : shotCount,
        multiShot: mode === "manual",
      };
      const payload = studioProjectInput(draft, null);
      const response = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !data.project) throw new Error(data.error ?? "Storyboard oluşturulamadı.");
      onCreated(data.project);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Storyboard oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="hf-popcorn-builder" onSubmit={(event) => void submit(event)} aria-busy={busy}>
    <div className="hf-popcorn-modes" role="group" aria-label="Popcorn çalışma modu">
      {POPCORN_MODES.map((item) => (
        <button key={item.id} type="button" className="hf-popcorn-mode-card" aria-pressed={mode === item.id} onClick={() => setMode(item.id)}>
          <div className="hf-popcorn-mode-top">
            <strong>{item.label}</strong>
            <span>{item.badge}</span>
          </div>
          <p>{item.description}</p>
        </button>
      ))}
    </div>

    <div className="hf-popcorn-controls">
      <label className="field">
        <span>Sahne sayısı</span>
        <select value={shotCount} onChange={(event) => setShotCount(Number(event.target.value))}>
          <option value={4}>4 sahne · Hızlı kurgu</option>
          <option value={6}>6 sahne · Dengeli anlatı</option>
          <option value={8}>8 sahne · Tam sekans</option>
        </select>
      </label>
      <label className="field">
        <span>Görsel tarz</span>
        <select value={presetId} onChange={(event) => setPresetId(event.target.value)}>
          {PRESETS.map((preset) => <option key={preset.id} value={preset.id}>{preset.label}</option>)}
        </select>
      </label>
      <label className="field">
        <span>Ekran oranı</span>
        <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}>
          <option value="16:9">16:9 · Sinematik Yatay</option>
          <option value="9:16">9:16 · Dikey Seri</option>
          <option value="1:1">1:1 · Kare</option>
        </select>
      </label>
    </div>

    <div className="hf-elements-bar">
      <div className="hf-elements-bar-head">
        <span><AtSign size={12} /> Tutarlı @Karakter ve @Mekân referansı ekle</span>
      </div>
      <div className="hf-elements-chips">
        {elements.map((name) => (
          <button key={name} type="button" onClick={() => setPrompt((curr) => insertElementMention(curr, name))}>
            <strong>@{name}</strong>
          </button>
        ))}
      </div>
    </div>

    <label className="field">
      <span>{mode === "manual" ? "Her sahneyi ayrı bir paragrafta yaz" : "Hikâye veya seri fikrin"}</span>
      <textarea
        rows={5}
        value={prompt}
        maxLength={4000}
        onChange={(event) => setPrompt(event.target.value)}
        placeholder="Örn: @Dedektif gece yağmur altında neon sokakta yürür, gizemli telefon kulübesinde çalan telefonu açar…"
      />
    </label>

    <div className="hf-popcorn-footer">
      <span className="quiet"><Layers3 size={14} /> {shotCount} tutarlı sahne planlanır; ücretli üretim yalnızca fiyat onayıyla başlar.</span>
      <button type="submit" className="button button-lamp" disabled={busy || prompt.trim().length < 10}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <LayoutGrid size={16} />}
        {busy ? "Storyboard hazırlanıyor…" : `${shotCount} Sahnelik Storyboard Oluştur`}
      </button>
    </div>
  </form>;
}

function ContentFactoryStudio({ onCreated, notify }: { onCreated: (project: Project) => void; notify: (message: string) => void }) {
  const [styleId, setStyleId] = useState<(typeof CONTENT_FACTORY_STYLES)[number]["id"]>("what-if");
  const selectedStyle = CONTENT_FACTORY_STYLES.find((item) => item.id === styleId) ?? CONTENT_FACTORY_STYLES[0];
  const [topic, setTopic] = useState<string>(selectedStyle.sampleTopic);
  const [episodeDuration, setEpisodeDuration] = useState(30);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>(selectedStyle.aspectRatio);
  const [withVoiceover, setWithVoiceover] = useState(true);
  const [busy, setBusy] = useState(false);

  function selectTemplate(item: (typeof CONTENT_FACTORY_STYLES)[number]) {
    setStyleId(item.id);
    setAspectRatio(item.aspectRatio);
    setTopic(item.sampleTopic);
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    if (busy || topic.trim().length < 10) return;
    setBusy(true);
    try {
      const shotCount = episodeDuration <= 15 ? 3 : episodeDuration <= 30 ? 5 : 8;
      const draft = {
        ...defaultStudioDraft("video", { id: 1, presetId: selectedStyle.presetId, prompt: topic }),
        aspectRatio,
        duration: 5,
        shotCount,
        withVoiceover,
      };
      const payload = studioProjectInput(draft, null);
      const response = await fetch("/api/projects/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await response.json() as { project?: Project; error?: string };
      if (!response.ok || !data.project) throw new Error(data.error ?? "Seri bölümü oluşturulamadı.");
      onCreated(data.project);
    } catch (error) {
      notify(error instanceof Error ? error.message : "Seri bölümü oluşturulamadı.");
    } finally {
      setBusy(false);
    }
  }

  return <form className="hf-factory-builder" onSubmit={(event) => void submit(event)} aria-busy={busy}>
    <div className="hf-factory-grid" role="group" aria-label="Trend seri şablonları">
      {CONTENT_FACTORY_STYLES.map((item) => (
        <button
          key={item.id}
          type="button"
          className="hf-factory-card"
          aria-pressed={styleId === item.id}
          onClick={() => selectTemplate(item)}
        >
          <div className="hf-factory-card-media">
            <Image src={item.image} alt="" fill sizes="(max-width: 700px) 50vw, 25vw" fetchPriority="low" />
            <span>{item.tag}</span>
          </div>
          <strong>{item.title}</strong>
          <small>{presetOf(item.presetId)?.label} · {item.aspectRatio}</small>
        </button>
      ))}
    </div>

    <div className="hf-popcorn-controls">
      <label className="field">
        <span>Bölüm süresi</span>
        <select value={episodeDuration} onChange={(event) => setEpisodeDuration(Number(event.target.value))}>
          <option value={15}>15 sn · 3 Hızlı Çekim</option>
          <option value={30}>30 sn · 5 Sahnelik Bölüm</option>
          <option value={60}>60 sn · 8 Sahnelik Tam Hikâye</option>
        </select>
      </label>
      <label className="field">
        <span>Yayın formatı</span>
        <select value={aspectRatio} onChange={(event) => setAspectRatio(event.target.value as AspectRatio)}>
          <option value="9:16">9:16 · Reels / Shorts / TikTok</option>
          <option value="16:9">16:9 · YouTube / Sinematik</option>
          <option value="1:1">1:1 · Kare Akış</option>
        </select>
      </label>
      <label className="field">
        <span>Anlatıcı dış ses</span>
        <select value={withVoiceover ? "yes" : "no"} onChange={(event) => setWithVoiceover(event.target.value === "yes")}>
          <option value="yes">Türkçe dış ses metni hazırla</option>
          <option value="no">Yalnızca görsel ve atmosfer</option>
        </select>
      </label>
    </div>

    <label className="field">
      <span>Bölüm konusu veya kanca cümlesi (Hook)</span>
      <textarea
        rows={4}
        value={topic}
        maxLength={3000}
        onChange={(event) => setTopic(event.target.value)}
        placeholder="Örn: Ya kediler antik Mısır'dan beri gizli bir uzay istasyonunu yönetiyorsa?"
      />
    </label>

    <div className="hf-popcorn-footer">
      <span className="quiet"><Sparkles size={14} /> Seçilen trend tarza göre çekim planı ve dış ses otomatik kurgulanır.</span>
      <button type="submit" className="button button-lamp" disabled={busy || topic.trim().length < 10}>
        {busy ? <LoaderCircle size={16} className="spin" /> : <Sparkles size={16} />}
        {busy ? "Bölüm kurgulanıyor…" : "Bölümü Hazırla ve Sahnelere Geç"}
      </button>
    </div>
  </form>;
}

function LayersRepairStudio({ project, disabled, onProjectChange, onOpen, notify }: {
  project: Project;
  disabled?: boolean;
  onProjectChange: (project: Project) => void;
  onOpen: (project: Project, step?: "story" | "cast" | "scenes" | "film") => void;
  notify: (message: string) => void;
}) {
  const [repairTarget, setRepairTarget] = useState<RepairTarget | null>(null);
  const repairableCharacters = project.characters.flatMap((character) =>
    character.sheet.attempts.map((attempt) => ({ character, attempt })),
  );

  return <div className="hf-layers-studio">
    <div className="hf-tool-info">
      <strong>Maskeli Bölge Onarımı (Higgsfield Layers &amp; Inpaint)</strong>
      <p>Bir sahne karesini veya karakter sayfasını seç, düzeltmek istediğin alanı kutu içine al ve Türkçe talimatını yaz. Geri kalan pikseller korunarak yalnızca seçili bölge yeniden çizilir.</p>
    </div>

    <div className="hf-layers-grid">
      {project.scenes.map((scene) => (
        <article key={scene.id} className="hf-layer-card">
          <div className="hf-layer-thumb">
            <Image src={scene.image} alt={scene.title} fill sizes="(max-width: 700px) 50vw, 25vw" unoptimized={scene.image.startsWith("/api/")} />
            <span>Sahne #{String(scene.order).padStart(2, "0")}</span>
          </div>
          <div className="hf-layer-meta">
            <strong>{scene.title}</strong>
            <small>{scene.imageSource === "generated" ? "Üretilmiş kare" : "Önizleme karesi"} · {scene.camera}</small>
            <button
              type="button"
              className="button button-small button-lamp"
              disabled={disabled}
              onClick={() => setRepairTarget({ kind: "scene", scene })}
            >
              <WandSparkles size={13} /> Bölgeyi Onar / Düzenle
            </button>
          </div>
        </article>
      ))}

      {repairableCharacters.map(({ character, attempt }) => (
        <article key={attempt.id} className="hf-layer-card">
          <div className="hf-layer-thumb">
            <Image src={attempt.url} alt={character.name} fill sizes="(max-width: 700px) 50vw, 25vw" unoptimized />
            <span>Soul ID · Karakter</span>
          </div>
          <div className="hf-layer-meta">
            <strong>@{character.name}</strong>
            <small>Karakter referans sayfası</small>
            <button
              type="button"
              className="button button-small button-lamp"
              disabled={disabled}
              onClick={() => setRepairTarget({ kind: "character", character, attempt })}
            >
              <WandSparkles size={13} /> Bölgeyi Onar / Düzenle
            </button>
          </div>
        </article>
      ))}
    </div>

    {!project.scenes.length && !repairableCharacters.length ? (
      <div className="hf-empty">
        <WandSparkles size={36} />
        <h2>Bu projede henüz sahne karesi yok</h2>
        <p>Önce sahnelerini planla veya kare üret, ardından istediğin bölgeyi maskeleyerek düzenle.</p>
        <button type="button" className="button button-lamp" onClick={() => onOpen(project, "scenes")}>Sahnelere git <ArrowRight size={15} /></button>
      </div>
    ) : null}

    <RepairDialog
      key={repairTarget ? (repairTarget.kind === "scene" ? repairTarget.scene.id : repairTarget.attempt.id) : "closed"}
      project={project}
      target={repairTarget}
      onClose={() => setRepairTarget(null)}
      onStarted={(updated) => {
        onProjectChange(updated);
        setRepairTarget(null);
        notify("Bölgesel onarım başlatıldı. İlerlemeyi Üretimler bölümünden takip edebilirsin.");
      }}
    />
  </div>;
}
