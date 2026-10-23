import assert from "node:assert/strict";
import test from "node:test";
import { handleMcpRpcRequest, KADRA_MCP_TOOLS } from "./mcp-server";
import {
  AE_PLUGIN_TOOLS,
  compileHiggsfieldPrompt,
  CONTENT_FACTORY_STYLES,
  defaultStudioDraft,
  generateAfterEffectsExtendScript,
  generateBlenderPythonScript,
  HIGGSFIELD_VFX_PRESETS,
  insertElementMention,
  MCP_AGENT_SKILLS,
  MCP_CONNECTOR_GUIDES,
  POPCORN_MODES,
  restoreStudioDraft,
  STUDIO_VIEWS,
  studioProjectInput,
} from "./studio-draft";

test("STUDIO_VIEWS includes Higgsfield 2026 studios (popcorn, factory, layers, mcp, after-effects)", () => {
  assert.ok(STUDIO_VIEWS.includes("popcorn"));
  assert.ok(STUDIO_VIEWS.includes("factory"));
  assert.ok(STUDIO_VIEWS.includes("layers"));
  assert.ok(STUDIO_VIEWS.includes("mcp"));
  assert.ok(STUDIO_VIEWS.includes("after-effects"));
  assert.equal(POPCORN_MODES.length, 3);
  assert.equal(CONTENT_FACTORY_STYLES.length, 4);
  assert.equal(MCP_CONNECTOR_GUIDES.length, 4);
  assert.ok(MCP_AGENT_SKILLS.length >= 7);
  assert.equal(AE_PLUGIN_TOOLS.length, 5);
  assert.equal(HIGGSFIELD_VFX_PRESETS.length, 6);
});

test("compileHiggsfieldPrompt strips conversational filler and compiles 6-variable command-line prompt", () => {
  const compiled = compileHiggsfieldPrompt({
    subject: "Lütfen metalik zırhlı @Gezgin",
    composition: "POV shot, macro lens",
    action: "çatı boşluğundan sıçrarken",
    location: "neon ışıklı Tokyo ara sokağı",
    style: "1980s polaroid, gritty 70s film look",
    cameraGear: "85mm f/1.4",
    quotedText: "KADRA 2026",
    negativeConstraints: "bulanık yüz, bozuk geometri",
  });
  assert.ok(!compiled.toLowerCase().includes("lütfen"));
  assert.match(compiled, /metalik zırhlı @Gezgin/);
  assert.match(compiled, /composition: POV shot, macro lens/);
  assert.match(compiled, /çatı boşluğundan sıçrarken/);
  assert.match(compiled, /in neon ışıklı Tokyo ara sokağı/);
  assert.match(compiled, /style: 1980s polaroid, gritty 70s film look/);
  assert.match(compiled, /shot on 85mm f\/1\.4/);
  assert.match(compiled, /visible text "KADRA 2026"/);
  assert.match(compiled, /exclude: bulanık yüz, bozuk geometri/);
});

test("generateAfterEffectsExtendScript builds editable After Effects composition script with footage import, camera and keyframes", () => {
  const jsx = generateAfterEffectsExtendScript(
    {
      title: "Kuzey Feneri",
      aspectRatio: "16:9",
      duration: 12,
      musicTrack: "/api/projects/p1/assets/score.mp3",
      scenes: [
        { order: 1, title: "Açılış", prompt: "Sisli fener", camera: "slow push-in", duration: 6, videoUrl: "/api/projects/p1/assets/shot1.mp4" },
        { order: 2, title: "Kule", prompt: "Merdivenler", camera: "pan right", duration: 6, image: "/images/mountains.jpg" },
      ],
    },
    "bounce",
  );
  assert.match(jsx, /app\.project\.items\.addComp\("Kuzey Feneri", 1920, 1080, 1, 12, 30\)/);
  assert.match(jsx, /comp\.layers\.addCamera\("Kadra_35mm_Cinema_Camera"/);
  assert.match(jsx, /app\.project\.importFile\(new ImportOptions\(f\)\)/);
  assert.match(jsx, /data\/projects\/p1\/assets\/shot1\.mp4/);
  assert.match(jsx, /public\/images\/mountains\.jpg/);
  assert.match(jsx, /data\/projects\/p1\/assets\/score\.mp3/);
  assert.match(jsx, /Math\.cos\(freq \* t \* 2 \* Math\.PI\)/);
});

test("generateBlenderPythonScript builds Blender 4.x bpy camera and lighting script", () => {
  const py = generateBlenderPythonScript(
    {
      title: "Kuzey Feneri",
      aspectRatio: "16:9",
      scenes: [
        { order: 1, title: "Açılış", prompt: "Sisli fener", camera: "Yavaş yaklaşma", duration: 5 },
      ],
    },
    85,
  );
  assert.match(py, /import bpy/);
  assert.match(py, /cam_data\.lens = 85/);
  assert.match(py, /scene\.timeline_markers\.new/);
  assert.match(py, /cam_obj\.keyframe_insert\(data_path="location"/);
});

test("handleMcpRpcRequest serves initialize, tools/list, and tools/call for kadra_compile_prompt and kadra_apply_vfx_preset", async () => {
  const initRes = await handleMcpRpcRequest({ jsonrpc: "2.0", id: 1, method: "initialize" });
  assert.equal(initRes.id, 1);
  assert.ok(initRes.result);

  const listRes = await handleMcpRpcRequest({ jsonrpc: "2.0", id: 2, method: "tools/list" });
  const tools = (listRes.result as { tools: typeof KADRA_MCP_TOOLS }).tools;
  assert.equal(tools.length, 6);

  const callPrompt = await handleMcpRpcRequest({
    jsonrpc: "2.0",
    id: 3,
    method: "tools/call",
    params: {
      name: "kadra_compile_prompt",
      arguments: {
        subject: "Lütfen @Kozmonot",
        location: "yörünge istasyonu",
        cameraGear: "35mm anamorphic",
      },
    },
  });
  const compiledText = (callPrompt.result as { compiledPrompt: string }).compiledPrompt;
  assert.match(compiledText, /@Kozmonot, in yörünge istasyonu, shot on 35mm anamorphic/);

  const callVfx = await handleMcpRpcRequest({
    jsonrpc: "2.0",
    id: 4,
    method: "tools/call",
    params: {
      name: "kadra_apply_vfx_preset",
      arguments: {
        vfxId: "earth-zoom-out",
        prompt: "Göz bebeğinde yansıyan galaksi",
      },
    },
  });
  const vfxPrompt = (callVfx.result as { prompt: string }).prompt;
  assert.match(vfxPrompt, /Göz bebeğinde yansıyan galaksi/);
  assert.match(vfxPrompt, /hyper-fast seamless cosmic zoom out/);
});

test("insertElementMention appends @Character token without duplicating existing mentions", () => {
  const initial = "Sisli vadide yürüyen";
  const withFirst = insertElementMention(initial, "Gezgin");
  assert.equal(withFirst, "Sisli vadide yürüyen @Gezgin ");
  const duplicate = insertElementMention(withFirst, "@Gezgin");
  assert.equal(duplicate, withFirst);
  const withSecond = insertElementMention(withFirst, "DenizFeneri");
  assert.equal(withSecond, "Sisli vadide yürüyen @Gezgin @DenizFeneri ");
});

test("restoreStudioDraft validates quality tier, shotCount (1..8) and withVoiceover", () => {
  const fallback = defaultStudioDraft("video");
  const restored = restoreStudioDraft(
    {
      prompt: "Gece yağmur altında @Dedektif",
      quality: "best",
      shotCount: 4,
      withVoiceover: true,
      aspectRatio: "9:16",
    },
    fallback,
  );
  assert.equal(restored.quality, "best");
  assert.equal(restored.shotCount, 4);
  assert.equal(restored.withVoiceover, true);
  assert.equal(restored.aspectRatio, "9:16");

  const invalid = restoreStudioDraft(
    {
      quality: "ultra-8k",
      shotCount: 99,
      withVoiceover: "yes",
    },
    fallback,
  );
  assert.equal(invalid.quality, "economy");
  assert.equal(invalid.shotCount, 1);
  assert.equal(invalid.withVoiceover, false);
});

test("studioProjectInput expands single-paragraph prompt into shotCount shots and attaches voiceover when enabled", () => {
  const draft = {
    ...defaultStudioDraft("video"),
    prompt: "Yörünge istasyonunda @Kozmonot kubbeden Dünya'ya bakar.",
    shotCount: 4,
    withVoiceover: true,
    lens: "anamorphic",
    lighting: "neon",
  };
  const input = studioProjectInput(draft, 12);
  assert.equal(input.shots.length, 4);
  assert.equal(input.budget, 12);
  assert.match(input.brief, /anamorphic cinema lens/);
  assert.match(input.brief, /cinematic neon practical lighting/);
  assert.ok(input.shots.every((shot) => shot.voiceoverOrText.length > 0));
  assert.equal(input.shots[0].sceneTitle, "Çekim 1");
  assert.equal(input.shots[3].sceneTitle, "Çekim 4");
});
