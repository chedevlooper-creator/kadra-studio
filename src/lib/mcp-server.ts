import { randomUUID } from "node:crypto";
import { z } from "zod";
import { wakeProductionWorker } from "./production/runtime";
import { repository } from "./store";
import {
  compileHiggsfieldPrompt,
  defaultStudioDraft,
  generateAfterEffectsExtendScript,
  generateBlenderPythonScript,
  HIGGSFIELD_VFX_PRESETS,
  MCP_AGENT_SKILLS,
  studioProjectInput,
} from "./studio-draft";
import { balonlarMasterTemplate } from "./templates/balonlar-master";
import type { AspectRatio, QualityTier } from "./types";

export const MCP_RPC_REQUEST_SCHEMA = z.object({
  jsonrpc: z.literal("2.0").default("2.0"),
  id: z.union([z.string(), z.number(), z.null()]).optional(),
  method: z.string().min(1).max(120),
  params: z.record(z.string(), z.unknown()).optional(),
});

export type McpRpcRequest = z.infer<typeof MCP_RPC_REQUEST_SCHEMA>;

export interface McpRpcResponse {
  jsonrpc: "2.0";
  id: string | number | null;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

export const KADRA_MCP_TOOLS = [
  {
    name: "kadra_compile_prompt",
    description:
      "Higgsfield Nano Banana Pro & Cinema Studio 6 değişkenli komut-satırı prompt derleyicisi. Sohbet dolgularını temizler, görünür metni çift tırnağa alır ve negatif kısıtları ekler.",
    inputSchema: {
      type: "object",
      properties: {
        subject: { type: "string", description: "Özne ve fiziksel materyal (örn. 'Metalik zırhlı @Gezgin')" },
        composition: { type: "string", description: "Kompozisyon ve kadraj (örn. 'POV shot, macro lens')" },
        action: { type: "string", description: "Fiziksel eylem ve hareket yönü" },
        location: { type: "string", description: "Mekân ve atmosfer" },
        style: { type: "string", description: "Sanatsal ortam ve dönem (örn. '1980s polaroid, gritty 70s film look')" },
        cameraGear: { type: "string", description: "Kamera ve lens (örn. '85mm f/1.4, anamorphic cinema lens')" },
        quotedText: { type: "string", description: "Sahne içinde görünecek çift tırnaklı metin" },
        negativeConstraints: { type: "string", description: "Hariç tutulacak unsurlar (exclude)" },
      },
      required: ["subject"],
    },
  },
  {
    name: "kadra_list_projects",
    description: "Kadra Studio çalışma alanındaki mevcut projeleri, sahne sayılarını, ekran oranlarını ve durumlarını listeler.",
    inputSchema: {
      type: "object",
      properties: {},
    },
  },
  {
    name: "kadra_create_project_from_skill",
    description:
      "Bir Higgsfield/Kadra MCP ajan becerisini (/katana, /use-after-effects, /ugc-flow, /marketing-adapt-video, /marketing-hook-variants, /vox-mixed-media, /use-blender) veya özel promptu çok sahneli bir Kadra projesine dönüştürür (ücretsiz planlama, harcama yapmaz).",
    inputSchema: {
      type: "object",
      properties: {
        skillId: {
          type: "string",
          description: "MCP beceri kimliği (katana, use-after-effects, ugc-flow, marketing-adapt-video, marketing-hook-variants, vox-mixed-media, use-blender)",
        },
        prompt: { type: "string", description: "İsteğe bağlı özel hikâye/sahne promptu" },
        shotCount: { type: "number", description: "Sahne sayısı (1-8)", minimum: 1, maximum: 8 },
        aspectRatio: { type: "string", enum: ["16:9", "9:16", "1:1"], description: "Ekran oranı" },
      },
    },
  },
  {
    name: "kadra_apply_vfx_preset",
    description:
      "Higgsfield Genjutsu / Katana VFX kamera hareketini (earth-zoom-out, bullet-time-orbit, katana-whip-slash, fpv-drone-dive, soul-jump-out, exploded-3d-parts) verilen promptla birleştirir.",
    inputSchema: {
      type: "object",
      properties: {
        vfxId: {
          type: "string",
          enum: HIGGSFIELD_VFX_PRESETS.map((item) => item.id),
          description: "VFX şablon kimliği",
        },
        prompt: { type: "string", description: "Temel sahne promptu" },
      },
      required: ["vfxId", "prompt"],
    },
  },
  {
    name: "kadra_export_after_effects_jsx",
    description:
      "Belirtilen Kadra projesini gerçek dosya ithalatlı (app.project.importFile), 35mm kameralı ve ivmeli (expression) tipografi katmanlı Adobe After Effects ExtendScript (.jsx) koduna dönüştürür.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Proje kimliği (boş bırakılırsa ilk proje kullanılır)" },
        motionStyle: {
          type: "string",
          enum: ["bounce", "kinetic", "cinematic"],
          description: "Metin katmanı keyframe/expression stili",
        },
      },
    },
  },
  {
    name: "kadra_export_blender_py",
    description:
      "Belirtilen Kadra projesini 3B sinema kamerası yörüngesi, alan derinliği (DOF), 3 noktalı ışık kurulumu ve sahne işaretçileri içeren çalıştırılabilir Blender 4.x Python (bpy .py) koduna dönüştürür.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Proje kimliği (boş bırakılırsa ilk proje kullanılır)" },
        lensMm: { type: "number", enum: [24, 35, 50, 85], description: "Kamera odak uzaklığı (mm)" },
      },
    },
  },
  {
    name: "kadra_start_production",
    description:
      "Belirtilen Kadra projesinin (veya 'Balonlar ve Dağlar · Tam Senaryo' şablonunun) canlı GMI fiyat teklifini hazırlar, onaylar ve arka plan üretim işçisini (worker) tek seferde başlatır.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Proje kimliği (boş bırakılırsa en üstteki proje veya Balonlar ve Dağlar kullanılır)" },
        target: { type: "string", enum: ["frames", "film"], description: "Üretim hedefi: 'frames' (yalnızca kareler) veya 'film' (tam video + ses + montaj)" },
        quality: { type: "string", enum: ["economy", "balanced", "best"], description: "Kalite katmanı" },
        budget: { type: "number", description: "Bütçe tavanı (USD, varsayılan 18)" },
      },
    },
  },
  {
    name: "kadra_get_production_status",
    description:
      "Çalışan veya tamamlanan bir Kadra projesinin canlı üretim ilerlemesini, tamamlanan adımlarını, olay günlüğünü ve çıktı MP4 adresini döndürür.",
    inputSchema: {
      type: "object",
      properties: {
        projectId: { type: "string", description: "Proje kimliği (boş bırakılırsa en üstteki proje kullanılır)" },
      },
    },
  },
] as const;

export async function handleMcpRpcRequest(req: McpRpcRequest): Promise<McpRpcResponse> {
  const id = req.id ?? null;

  if (req.method === "initialize") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        protocolVersion: "2024-11-05",
        serverInfo: {
          name: "kadra-higgsfield-mcp",
          version: "2.0.0",
        },
        capabilities: {
          tools: { listChanged: false },
          prompts: { listChanged: false },
        },
      },
    };
  }

  if (req.method === "notifications/initialized" || req.method === "ping") {
    return { jsonrpc: "2.0", id, result: {} };
  }

  if (req.method === "tools/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        tools: KADRA_MCP_TOOLS,
      },
    };
  }

  if (req.method === "prompts/list") {
    return {
      jsonrpc: "2.0",
      id,
      result: {
        prompts: MCP_AGENT_SKILLS.map((skill) => ({
          name: skill.id,
          description: `${skill.slash} — ${skill.description}`,
        })),
      },
    };
  }

  if (req.method === "prompts/get") {
    const skillName = typeof req.params?.name === "string" ? req.params.name : "";
    const skill = MCP_AGENT_SKILLS.find((item) => item.id === skillName || item.slash === skillName) ?? MCP_AGENT_SKILLS[0];
    return {
      jsonrpc: "2.0",
      id,
      result: {
        description: skill.description,
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text: `${skill.slash} ${skill.samplePrompt}`,
            },
          },
        ],
      },
    };
  }

  if (req.method === "tools/call") {
    const toolName = typeof req.params?.name === "string" ? req.params.name : "";
    const args = (req.params?.arguments && typeof req.params.arguments === "object"
      ? req.params.arguments
      : {}) as Record<string, unknown>;

    if (toolName === "kadra_compile_prompt") {
      const compiled = compileHiggsfieldPrompt({
        subject: typeof args.subject === "string" ? args.subject : "",
        composition: typeof args.composition === "string" ? args.composition : undefined,
        action: typeof args.action === "string" ? args.action : undefined,
        location: typeof args.location === "string" ? args.location : undefined,
        style: typeof args.style === "string" ? args.style : undefined,
        cameraGear: typeof args.cameraGear === "string" ? args.cameraGear : undefined,
        quotedText: typeof args.quotedText === "string" ? args.quotedText : undefined,
        negativeConstraints: typeof args.negativeConstraints === "string" ? args.negativeConstraints : undefined,
      });
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: compiled }],
          compiledPrompt: compiled,
        },
      };
    }

    if (toolName === "kadra_list_projects") {
      const boot = await repository.getBootstrap();
      const summary = boot.projects.map((project) => ({
        id: project.id,
        title: project.title,
        aspectRatio: project.aspectRatio,
        style: project.style,
        scenes: project.scenes.length,
        status: project.status,
      }));
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(summary, null, 2) }],
          projects: summary,
        },
      };
    }

    if (toolName === "kadra_create_project_from_skill") {
      const skillId = typeof args.skillId === "string" ? args.skillId : "katana";
      const skill = MCP_AGENT_SKILLS.find((item) => item.id === skillId || item.slash === skillId) ?? MCP_AGENT_SKILLS[0];
      const customPrompt = typeof args.prompt === "string" && args.prompt.trim().length >= 10 ? args.prompt.trim() : skill.samplePrompt;
      const shotCount = typeof args.shotCount === "number" ? Math.max(1, Math.min(8, Math.round(args.shotCount))) : 4;
      const ratio: AspectRatio = args.aspectRatio === "9:16" || args.aspectRatio === "1:1" || args.aspectRatio === "16:9"
        ? args.aspectRatio
        : skill.aspectRatio;
      const draft = {
        ...defaultStudioDraft("video", { id: 1, presetId: skill.presetId, prompt: customPrompt }),
        aspectRatio: ratio,
        shotCount,
      };
      const project = await repository.importStoryboard(studioProjectInput(draft, null));
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `Proje oluşturuldu: "${project.title}" (${project.id}) — ${project.scenes.length} sahne, ${project.aspectRatio}.`,
            },
          ],
          project: {
            id: project.id,
            title: project.title,
            scenes: project.scenes.length,
            aspectRatio: project.aspectRatio,
          },
        },
      };
    }

    if (toolName === "kadra_apply_vfx_preset") {
      const vfxId = typeof args.vfxId === "string" ? args.vfxId : "earth-zoom-out";
      const preset = HIGGSFIELD_VFX_PRESETS.find((item) => item.id === vfxId) ?? HIGGSFIELD_VFX_PRESETS[0];
      const basePrompt = typeof args.prompt === "string" ? args.prompt.trim() : "";
      const merged = `${basePrompt ? `${basePrompt}, ` : ""}${preset.promptDirective}`;
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: merged }],
          vfxPreset: preset,
          prompt: merged,
        },
      };
    }

    if (toolName === "kadra_export_after_effects_jsx") {
      const boot = await repository.getBootstrap();
      const projectId = typeof args.projectId === "string" ? args.projectId : "";
      const project = boot.projects.find((item) => item.id === projectId) ?? boot.projects[0];
      if (!project) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Çalışma alanında proje bulunamadı." },
        };
      }
      const style = args.motionStyle === "kinetic" || args.motionStyle === "cinematic" ? args.motionStyle : "bounce";
      const jsx = generateAfterEffectsExtendScript(project, style);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: jsx }],
          script: jsx,
        },
      };
    }

    if (toolName === "kadra_export_blender_py") {
      const boot = await repository.getBootstrap();
      const projectId = typeof args.projectId === "string" ? args.projectId : "";
      const project = boot.projects.find((item) => item.id === projectId) ?? boot.projects[0];
      if (!project) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Çalışma alanında proje bulunamadı." },
        };
      }
      const lensMm = args.lensMm === 24 || args.lensMm === 50 || args.lensMm === 85 ? args.lensMm : 35;
      const py = generateBlenderPythonScript(project, lensMm);
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: py }],
          script: py,
        },
      };
    }

    if (toolName === "kadra_start_production") {
      const boot = await repository.getBootstrap();
      const requestedId = typeof args.projectId === "string" ? args.projectId.trim() : "";
      let targetProject =
        boot.projects.find((item) => item.id === requestedId) ??
        boot.projects.find((item) => item.title.includes("Balonlar ve Dağlar · Tam Senaryo")) ??
        boot.projects[0];
      if (!targetProject) {
        targetProject = await repository.importStoryboard(balonlarMasterTemplate("16:9"));
      }
      if (targetProject.run?.status === "running") {
        wakeProductionWorker();
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: `Üretim zaten çalışıyor: "${targetProject.title}" (${targetProject.id}) — %${targetProject.run.progress} tamamlandı.`,
              },
            ],
            projectId: targetProject.id,
            runId: targetProject.run.id,
            status: targetProject.run.status,
            progress: targetProject.run.progress,
          },
        };
      }
      const target: "frames" | "film" = args.target === "frames" ? "frames" : "film";
      const quality: QualityTier = args.quality === "balanced" || args.quality === "best" ? args.quality : "economy";
      const budget = typeof args.budget === "number" && Number.isFinite(args.budget) && args.budget > 0 ? args.budget : 18;
      // Auto-approve any reviewed character sheets with a chosen attempt so reference-guided frame generation works in one shot.
      for (const character of targetProject.characters) {
        if (character.sheet.status === "review" && character.sheet.chosen) {
          targetProject = await repository.reviewCharacterSheet(
            targetProject.id,
            targetProject.revision,
            character.id,
            "approve",
            character.sheet.chosen,
          );
        }
      }
      const quoted = await repository.prepareQuote(targetProject.id, {
        revision: targetProject.revision,
        target,
        quality,
        budget,
        referenceFrames: true,
        frameModel: "gemini-nano-banana-2.1",
        selections: targetProject.scenes
          .filter((scene) => scene.kind === "video")
          .map((scene) => ({ sceneId: scene.id, motion: "ai" as const, videoModel: null })),
      });
      if (!quoted.quote || quoted.quote.errors.length > 0 || !quoted.quote.withinBudget) {
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32000,
            message: quoted.quote?.errors.join(" ") || "Teklif bütçe sınırını aşıyor veya hazırlanamadı.",
            data: quoted.quote,
          },
        };
      }
      const key = `mcp-run-${randomUUID()}`;
      const started = await repository.startRun(quoted.id, quoted.revision, key, quoted.quote.id, {
        target,
        reuseImages: true,
      });
      wakeProductionWorker();
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [
            {
              type: "text",
              text: `MCP üzerinden üretim başlatıldı: "${started.title}" (${started.id}) — ${started.run?.steps.length ?? 0} adım, tahmini maliyet: ${quoted.quote.total.toFixed(2)} USD.`,
            },
          ],
          projectId: started.id,
          title: started.title,
          runId: started.run?.id ?? null,
          status: started.run?.status ?? started.status,
          totalSteps: started.run?.steps.length ?? 0,
          estimatedUsd: quoted.quote.total,
        },
      };
    }

    if (toolName === "kadra_get_production_status") {
      const boot = await repository.getBootstrap();
      const requestedId = typeof args.projectId === "string" ? args.projectId.trim() : "";
      const project =
        boot.projects.find((item) => item.id === requestedId) ??
        boot.projects.find((item) => item.title.includes("Balonlar ve Dağlar · Tam Senaryo")) ??
        boot.projects[0];
      if (!project) {
        return {
          jsonrpc: "2.0",
          id,
          error: { code: -32602, message: "Proje bulunamadı." },
        };
      }
      if (project.run?.status === "running") {
        wakeProductionWorker();
      }
      const doneSteps = project.run?.steps.filter((step) => step.status === "done").length ?? 0;
      const runningSteps = project.run?.steps.filter((step) => step.status === "running").length ?? 0;
      const totalSteps = project.run?.steps.length ?? 0;
      const activeStep = project.run?.steps.find((step) => step.status === "running" || step.status === "pending") ?? null;
      const payload = {
        projectId: project.id,
        title: project.title,
        status: project.status,
        runStatus: project.run?.status ?? null,
        progress: project.run?.progress ?? 0,
        doneSteps,
        runningSteps,
        totalSteps,
        activeStep: activeStep ? { kind: activeStep.kind, status: activeStep.status, sceneId: activeStep.sceneId } : null,
        recentEvents: (project.run?.events ?? []).slice(-6),
        output: project.output,
      };
      return {
        jsonrpc: "2.0",
        id,
        result: {
          content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
          ...payload,
        },
      };
    }

    return {
      jsonrpc: "2.0",
      id,
      error: { code: -32601, message: `Bilinmeyen MCP aracı: ${toolName}` },
    };
  }

  return {
    jsonrpc: "2.0",
    id,
    error: { code: -32601, message: `Desteklenmeyen MCP metodu: ${req.method}` },
  };
}
