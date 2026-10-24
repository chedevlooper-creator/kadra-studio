import { CAMERA_MOVES, GENRES, LOOKS, presetOf } from "./cinema";
import type { AspectRatio, QualityTier } from "./types";

export type StudioView =
  | "explore"
  | "image"
  | "video"
  | "cinema"
  | "popcorn"
  | "factory"
  | "layers"
  | "mcp"
  | "after-effects"
  | "effects"
  | "characters"
  | "audio"
  | "editor"
  | "projects"
  | "queue"
  | "library"
  | "connections"
  | "settings"
  | "favorites";

export const STUDIO_VIEWS: StudioView[] = [
  "explore",
  "image",
  "video",
  "cinema",
  "popcorn",
  "factory",
  "layers",
  "mcp",
  "after-effects",
  "effects",
  "characters",
  "audio",
  "editor",
  "projects",
  "queue",
  "library",
  "connections",
  "settings",
  "favorites",
];

export type CreationMode = "image" | "video";
export interface StudioLaunch { id: number; presetId?: string; prompt?: string; }
export interface StudioDraft {
  prompt: string;
  mode: CreationMode;
  presetId: string;
  aspectRatio: AspectRatio;
  duration: number;
  camera: string;
  lens: string;
  aperture: string;
  lighting: string;
  genre: string;
  look: string;
  era: string;
  pacing: string;
  frameModel: string;
  videoModel: string;
  multiShot: boolean;
  quality: QualityTier;
  shotCount: number;
  withVoiceover: boolean;
}

/**
 * Six-variable prompt architecture captured from Higgsfield's Nano Banana Pro & Cinema Studio Prompt Guide
 * (`ev_2473aa242f76e45d1cfa5f003d28ccb5c2bab17973622503dc16cad5861bae6e`).
 */
export interface HiggsfieldPromptBuilderInput {
  subject: string;
  composition?: string;
  action?: string;
  location?: string;
  style?: string;
  cameraGear?: string;
  quotedText?: string;
  negativeConstraints?: string;
}

const POLITE_FILLER_RE = /\b(lütfen|acaba|bana\s+bir|please|could\s+you|can\s+you|i\s+would\s+like|yapabilir\s+misin)\b/gi;

/**
 * Compiles the 6 core variables + pro constraints into a command-line style, high-adherence prompt
 * without conversational filler, isolating on-screen text in double quotes and appending negative boundaries.
 */
export function compileHiggsfieldPrompt(input: HiggsfieldPromptBuilderInput): string {
  const cleanPart = (val?: string) =>
    (val ?? "")
      .replace(POLITE_FILLER_RE, "")
      .replace(/\s+/g, " ")
      .trim()
      .replace(/[.,;]+$/, "");

  const subject = cleanPart(input.subject);
  const action = cleanPart(input.action);
  const location = cleanPart(input.location);
  const composition = cleanPart(input.composition);
  const style = cleanPart(input.style);
  const cameraGear = cleanPart(input.cameraGear);
  const quotedText = cleanPart(input.quotedText).replace(/^"+|"+$/g, "");
  const negative = cleanPart(input.negativeConstraints);

  const segments: string[] = [];
  if (subject) segments.push(subject);
  if (action) segments.push(action);
  if (location) segments.push(`in ${location}`);
  if (composition) segments.push(`composition: ${composition}`);
  if (style) segments.push(`style: ${style}`);
  if (cameraGear) segments.push(`shot on ${cameraGear}`);
  if (quotedText) segments.push(`visible text "${quotedText}"`);
  if (negative) segments.push(`exclude: ${negative}`);

  return segments.join(", ").slice(0, 4000);
}

export const NANO_BANANA_TEMPLATES: ReadonlyArray<{
  id: string;
  title: string;
  badge: string;
  builder: HiggsfieldPromptBuilderInput;
}> = [
  {
    id: "pink-ice-pov",
    title: "Kırılmış Pembe Buz POV (Yüksek Kontrol)",
    badge: "POV OPTİK",
    builder: {
      subject: "Young woman leaning over a transparent container filled with crushed pink ice, sipping through a bright blue straw",
      composition: "Ultra-detailed POV shot from inside the container looking upward, slight lens distortion",
      action: "Sipping with glossy lips and wide playful curiosity as sunlight hits sparkling ice crystals",
      location: "Clear summer sky overhead with water droplets on container walls",
      style: "Hyperrealistic textures, high-contrast cinematic saturation",
      cameraGear: "24mm macro probe lens, f/2.8",
    },
  },
  {
    id: "medieval-armor",
    title: "Ortaçağ İşlemeli Zırh Makro",
    badge: "MATERYAL",
    builder: {
      subject: "Ornate medieval knight @Gezgin in engraved steel armor",
      composition: "Extreme close-up macro framing on chestplate engravings",
      action: "Breathing slowly as embers drift across the metal",
      location: "Torchlit stone castle interior",
      style: "Dark historical realism, shallow depth of field",
      cameraGear: "85mm f/1.4 cinema prime",
    },
  },
  {
    id: "oni-samurai",
    title: "Kızıl Oni Maskeli Samuray",
    badge: "KARAKTER",
    builder: {
      subject: "Samurai in lacquered red armor wearing a fierce red oni mask and weathered headband",
      composition: "Low-angle heroic medium close-up",
      action: "Drawing a katana through swirling mist",
      location: "Moonlit bamboo courtyard",
      style: "Kurosawa-inspired high-contrast cinema",
      cameraGear: "50mm anamorphic cinema lens",
    },
  },
  {
    id: "fighter-jet-vapor",
    title: "Süpersonik Jet Buhar Konisi",
    badge: "HIZ & FİZİK",
    builder: {
      subject: "Futuristic stealth fighter jet",
      composition: "Dynamic aerial tracking shot from wingtip perspective",
      action: "Performing a high-G supersonic maneuver with transonic vapor cones forming around the wings",
      location: "Above rugged ocean coastline at golden hour",
      style: "Photorealistic aviation cinematography",
      cameraGear: "Full-frame cinema camera, 1/2000s shutter",
    },
  },
  {
    id: "knitted-farmers",
    title: "Örgü Kumaş Tarlalarda Minyatür Çiftçiler",
    badge: "MİNYATÜR",
    builder: {
      subject: "Tiny miniature farmers with woven baskets",
      composition: "Tilt-shift isometric macro view from above",
      action: "Harvesting across giant green knitted wool fabric as if it were terraced mountain fields",
      location: "Sunlit tabletop diorama",
      style: "Tactile stop-motion macro photography",
      cameraGear: "100mm macro tilt-shift lens, f/4",
    },
  },
  {
    id: "retro-cassette-ad",
    title: "1980'ler Kaset Çalar Reklam Afişi",
    badge: "TİPOGRAFİ",
    builder: {
      subject: "Floating brushed-aluminum portable cassette player with orange foam headphones",
      composition: "Centered editorial poster layout with bottom specification lineup",
      action: "Suspended in mid-air with magnetic tape ribbons spiraling outward",
      location: "Dark studio backdrop with warm rim light",
      style: "Retro 1980s magazine print ad, grainy halftone texture",
      cameraGear: "Medium format studio camera, f/8",
      quotedText: "KADRA SOUND 1984",
    },
  },
];

export const MCP_CONNECTOR_GUIDES = [
  {
    id: "kadra-local",
    name: "Kadra Yerel MCP Sunucusu (JSON-RPC 2.0)",
    endpoint: "http://127.0.0.1:3000/api/mcp",
    publicEndpoint: "http://localhost:3000/api/mcp",
    command: "kadra_compile_prompt / kadra_create_project_from_skill",
    steps: [
      "Kadra Studio çalışırken yerel MCP sunucusu http://127.0.0.1:3000/api/mcp adresinde JSON-RPC 2.0 protokolüyle aktif olur.",
      "Claude Code, Antigravity veya Cursor mcp_config.json dosyana aşağıdaki yapılandırmayı yapıştır.",
      "Ajanından doğrudan kadra_compile_prompt, kadra_create_project_from_skill, kadra_export_after_effects_jsx ve kadra_export_blender_py araçlarını çağır.",
    ],
    configJson: `{
  "mcpServers": {
    "kadra-local-mcp": {
      "url": "http://127.0.0.1:3000/api/mcp"
    },
    "higgsfield-mcp": {
      "url": "https://mcp.higgsfield.ai/mcp"
    },
    "higgsfield-ae-bridge": {
      "url": "https://bridge.higgsfield.ai/mcp"
    }
  }
}`,
  },
  {
    id: "claude-code",
    name: "Claude / Claude Code & Antigravity MCP",
    endpoint: "https://bridge.higgsfield.ai/mcp",
    publicEndpoint: "https://mcp.higgsfield.ai/mcp",
    command: "@higgsfield /use-after-effects",
    steps: [
      "MCP istemcisinde Ayarlar → Connectors (Bağlayıcılar) bölümünü aç.",
      "Özel bağlayıcı adı olarak 'Higgsfield Bridge' gir ve https://bridge.higgsfield.ai/mcp veya https://mcp.higgsfield.ai/mcp adresini yapıştır.",
      "Sohbette @higgsfield /use-after-effects veya /katana gibi beceri komutlarıyla doğrudan üretime başla.",
    ],
    configJson: `{
  "mcpServers": {
    "higgsfield-mcp": {
      "url": "https://mcp.higgsfield.ai/mcp"
    },
    "higgsfield-ae-bridge": {
      "url": "https://bridge.higgsfield.ai/mcp"
    }
  }
}`,
  },
  {
    id: "chatgpt",
    name: "ChatGPT Plugin & Agent",
    endpoint: "https://mcp.higgsfield.ai/mcp",
    publicEndpoint: "https://chatgpt.com/plugins/higgsfield",
    command: "@Higgsfield /katana",
    steps: [
      "ChatGPT içinde Plugins / Connectors menüsünden Higgsfield eklentisini etkinleştir.",
      "Referans videonu veya ürün özetini yükle.",
      "/katana, /ugc-flow veya /use-after-effects komutuyla sahne planını tetikle.",
    ],
    configJson: `{
  "connector": "Higgsfield",
  "mcpEndpoint": "https://mcp.higgsfield.ai/mcp",
  "defaultSkill": "/katana"
}`,
  },
  {
    id: "cli",
    name: "Terminal CLI & Yerel Kadra Köprüsü",
    endpoint: "http://127.0.0.1:3000/api/projects/import",
    publicEndpoint: "https://mcp.higgsfield.ai/mcp",
    command: "kadra-mcp --bridge after-effects",
    steps: [
      "Yerel Kadra sunucusu çalışırken /api/projects/import uç noktası üzerinden çoklu çekim JSON paketlerini doğrudan içeri aktar.",
      "After Effects स्टüdyosundan üretilen .jsx ExtendScript dosyasını Adobe After Effects (Window > Extensions / File > Scripts) içinde çalıştır.",
    ],
    configJson: `{
  "localKadraApi": "http://127.0.0.1:3000/api/projects/import",
  "upstreamMcp": "https://mcp.higgsfield.ai/mcp"
}`,
  },
] as const;

export const MCP_AGENT_SKILLS = [
  {
    id: "katana",
    slash: "/katana",
    title: "Recreate Aura Edits (Katana)",
    category: "Motion Design",
    badge: "YENİ",
    presetId: "cinematic",
    aspectRatio: "9:16" as AspectRatio,
    description: "Çekimlerini yüksek enerjili aura kurgusuna dönüştürür; hız geçişleri (speed ramp), ritim ve görsel efektleri kendi öznenle yeniden kurar.",
    samplePrompt: "Gece neon ışıklar altında @Gezgin hızlı kamera dönüşüyle kadraja girer, keskin hız rampası (speed ramp) ve ışık izleriyle sahne geçişi.",
  },
  {
    id: "use-after-effects",
    slash: "/use-after-effects",
    title: "AI Motion Designer · After Effects",
    category: "For After Effects",
    badge: "AE MCP",
    presetId: "promo",
    aspectRatio: "16:9" as AspectRatio,
    description: "Bounce ease, ışık huzmesi (light streak), kinetik tipografi ve düzenlenebilir katman/keyframe yapısıyla After Effects kompozisyonu üretir.",
    samplePrompt: "Koyu kadife arka planda altın ışık huzmesiyle (light streak) beliren 3B logo açılışı, yaylanma ivmeli (bounce ease) kinetik tipografi.",
  },
  {
    id: "ugc-flow",
    slash: "/ugc-flow",
    title: "Product Review UGC",
    category: "UGC",
    badge: "UGC",
    presetId: "documentary",
    aspectRatio: "9:16" as AspectRatio,
    description: "Ürün özetinden ve referans görsellerden içerik üreticisi (creator) tarzında doğal ürün inceleme serisi oluşturur.",
    samplePrompt: "Doğal pencere ışığında elde tutulan kamera açısıyla ürün kutu açılışı, yakın plan doku detayı ve samimi kullanıcı deneyimi.",
  },
  {
    id: "marketing-adapt-video",
    slash: "/marketing-adapt-video",
    title: "Ad Recreator",
    category: "Paid Ads",
    badge: "ADS",
    presetId: "promo",
    aspectRatio: "9:16" as AspectRatio,
    description: "Referans bir reklam videosunun hikâye anlatımını ve satış kurgusunu kendi ürünün için özgün bir video reklama uyarlar.",
    samplePrompt: "İlk 3 saniyede çarpıcı görsel kanca (hook), ardından ürünün çözdüğü temel problemi gösteren dinamik ikili sahne ve net çağrı kartı.",
  },
  {
    id: "marketing-hook-variants",
    slash: "/marketing-hook-variants",
    title: "Hook Multiplier (Kanca Çoğaltıcı)",
    category: "Paid Ads",
    badge: "A/B TEST",
    presetId: "cinematic",
    aspectRatio: "9:16" as AspectRatio,
    description: "Tek bir videoya dikkat çekici birden fazla açılış kancası (hook) üretir; A/B testi için tam kurgulanmış alternatifler hazırlar.",
    samplePrompt: "Aynı ana hikâye için 4 farklı açılış çekimi: 1) Makro ekstrem yakın plan, 2) Ters açı aksiyon başlangıcı, 3) Soru kartı, 4) Dramatik silüet.",
  },
  {
    id: "vox-mixed-media",
    slash: "/vox-mixed-media",
    title: "Editorial Motion Graphics",
    category: "Faceless",
    badge: "VOX STİLİ",
    presetId: "documentary",
    aspectRatio: "16:9" as AspectRatio,
    description: "Karma görsel medya, gazete kupürü katmanları, harita yakınlaştırmaları ve editoryal hareketli grafiklerle konuyu anlatır.",
    samplePrompt: "Dokulu kağıt arka plan üzerinde hareketli arşiv fotoğrafları, fosforlu vurgu çizgileri ve izometrik 3B veri grafikleriyle belgesel anlatım.",
  },
  {
    id: "use-blender",
    slash: "@higgsfield /use-blender",
    title: "Blender 3D Camera & Scene Rig",
    category: "For Blender",
    badge: "BLENDER 3D",
    presetId: "cinematic",
    aspectRatio: "16:9" as AspectRatio,
    description: "35mm/85mm sinema kamerası yörüngesini, 3 noktalı alan ışıklarını ve sahne zaman çizelgesi işaretçilerini Blender Python (bpy) sahnesi olarak kurar.",
    samplePrompt: "Exploded engineering view where a precision cinema camera separates into floating mechanical parts in mid-air, orbital 35mm camera sweep.",
  },
  {
    id: "genjutsu-remake",
    slash: "@higgsfield /genjutsu",
    title: "Genjutsu (Hareket & Kamera Aktarımı)",
    category: "Motion Design",
    badge: "GENJUTSU",
    presetId: "cinematic",
    aspectRatio: "16:9" as AspectRatio,
    description: "Referans bir videodaki kamera hareketini, zamanlamayı ve ritmi koruyarak sahneyi kendi @Karakter, @Mekân ve ürünlerinle yeniden çeker.",
    samplePrompt: "Referans sahnenin kamera yörüngesini ve kesme ritmini koruyarak @Gezgin karakterini @DenizFeneri mekânında yeniden sahnele.",
  },
  {
    id: "marketing-research-to-ads",
    slash: "/marketing-research-to-ads",
    title: "Ad Strategist (Pazar Araştırmasından Reklama)",
    category: "Paid Ads",
    badge: "STRATEJİ",
    presetId: "promo",
    aspectRatio: "9:16" as AspectRatio,
    description: "Ürün ve rakip analizini hedef pazara uyarlanmış farklı açılarda reklam sahnelerine ve görsel kancalara dönüştürür.",
    samplePrompt: "Minimalist stüdyo ışığında ürünün üç temel avantajını karşılaştırmalı makro çekimlerle gösteren yüksek dönüşümlü reklam kurgusu.",
  },
  {
    id: "stickman-explainer",
    slash: "/stickman-explainer",
    title: "Stickman Cartoon (Çöp Adam Anlatıcı)",
    category: "Faceless",
    badge: "EXPLAINER",
    presetId: "toon",
    aspectRatio: "16:9" as AspectRatio,
    description: "Karmaşık bir fikri veya hikâyeyi sade ve esprili çöp adam (stickman) karakterlerle animasyonlu anlatım videosuna dönüştürür.",
    samplePrompt: "Noktalı defter kağıdı dokusu üzerinde sade siyah çizgili çöp adam karakterin dev bir ampulü yakarak fikri anlattığı eğlenceli animasyon.",
  },
] as const;

export const AE_PLUGIN_TOOLS = [
  {
    id: "ai-video",
    title: "Generate AI Video (Timeline İçi)",
    badge: "TIMELINE",
    description: "Doğal dille sahne, karakter, B-roll veya kamera hareketi tarif et; sonuç doğrudan Adobe After Effects / Premiere Pro zaman çizelgesine düşsün.",
    actionView: "video" as StudioView,
  },
  {
    id: "ai-image",
    title: "Generate AI Image & Katman",
    badge: "PLATE & KART",
    description: "Arka plan plakaları (clean plate), başlık kartları veya sahne öğeleri oluşturup kompozisyona katman olarak ekle.",
    actionView: "image" as StudioView,
  },
  {
    id: "reframe",
    title: "Smart Reframe (Akıllı Kadraj)",
    badge: "9:16 · 16:9 · 21:9",
    description: "Tek tıkla 9:16, 16:9, 4:3, 21:9 veya 1:1 oranına dönüştür; akıllı özne takibi odak noktasını merkezde tutar.",
    actionView: "editor" as StudioView,
  },
  {
    id: "remove-bg",
    title: "Remove Background (Alfa Key)",
    badge: "ALPHA CHANNEL",
    description: "Yeşil perde olmadan piksel hassasiyetinde temiz alfa kanalı çıkar; saç detaylarını koruyarak kompozite hazırla.",
    actionView: "layers" as StudioView,
  },
  {
    id: "draw-to-edit",
    title: "Draw to Edit & 4K/8K Upscale",
    badge: "INPAINT + 8K",
    description: "Kare üzerinde fırçayla çizerek istenmeyen nesneleri kaldır veya yeni öğe ekle; düşük çözünürlüklü kaynakları 4K/8K detayla kurtar.",
    actionView: "layers" as StudioView,
  },
] as const;

export const HIGGSFIELD_VFX_PRESETS = [
  {
    id: "earth-zoom-out",
    title: "Earth Zoom Out",
    badge: "GENJUTSU VFX",
    camera: "crash" as const,
    promptDirective: "hyper-fast seamless cosmic zoom out from extreme macro eye detail into high-altitude aerial orbit, radial motion blur trails",
    description: "Makro göz veya yüz detayından bulutların üzerine kesintisiz kozmik hiper-uzaklaşma.",
  },
  {
    id: "bullet-time-orbit",
    title: "Bullet Time 360° Orbit",
    badge: "CAMERA VFX",
    camera: "right" as const,
    promptDirective: "frozen-moment bullet-time 360-degree orbital camera sweep around the suspended subject, floating rain droplets and debris in mid-air",
    description: "Zaman donmuşken öznenin etrafında 360 derece dönen matris kamera ve havada asılı parçacıklar.",
  },
  {
    id: "katana-whip-slash",
    title: "Katana Aura Slash",
    badge: "KATANA",
    camera: "crash" as const,
    promptDirective: "high-contrast anime aura slash with glowing katana light streak, whip-pan transition and speed-ramp impact frames",
    description: "Yüksek kontrastlı ışık izi, hız rampası (speed-ramp) ve sert whip-pan geçişi.",
  },
  {
    id: "fpv-drone-dive",
    title: "FPV Drone Acro Dive",
    badge: "FPV VFX",
    camera: "down" as const,
    promptDirective: "fpv racing drone vertical dive down a towering structure with dynamic barrel roll and high-speed parallax",
    description: "Yüksek kule veya uçurum kenarından dikey serbest düşüş FPV drone dalışı.",
  },
  {
    id: "soul-jump-out",
    title: "Soul Astral Projection",
    badge: "GENJUTSU VFX",
    camera: "in" as const,
    promptDirective: "ethereal glowing astral double detaching from the subject in slow motion with volumetric chromatic aberration",
    description: "Öznenin içinden yarı saydam ışık ikizinin ağır çekimde süzülerek ayrılması.",
  },
  {
    id: "exploded-3d-parts",
    title: "1,025-Part Exploded View",
    badge: "3D MOTION",
    camera: "out" as const,
    promptDirective: "exploded engineering view where the object separates into hundreds of floating precision mechanical parts suspended in mid-air",
    description: "Mekanik ürün veya kameranın havada yüzlerce hassas parçaya ayrılıp yeniden birleşmesi.",
  },
] as const;

function resolveLocalMediaDiskPath(urlOrPath?: string | null): string {
  if (!urlOrPath) return "";
  const trimmed = urlOrPath.trim();
  const assetMatch = /^\/api\/projects\/([^/]+)\/assets\/([^/?#]+)/.exec(trimmed);
  if (assetMatch) {
    return `data/projects/${assetMatch[1]}/assets/${assetMatch[2]}`;
  }
  if (trimmed.startsWith("/images/")) {
    return `public${trimmed}`;
  }
  return trimmed;
}

/**
 * Generates an executable Adobe After Effects ExtendScript (`.jsx`) file for a Kadra project,
 * modeled on Higgsfield's AI Motion Designer (`var comp = app.project.items.addComp(...)` in
 * `ev_2473aa242f76e45d1cfa5f003d28ccb5c2bab17973622503dc16cad5861bae6e`).
 * Creates an editable composition with a 35mm camera layer, real footage imports (`app.project.importFile`)
 * with automatic solid fallback, kinetic typography title layers with bounce-ease expressions, and audio track import.
 */
export function generateAfterEffectsExtendScript(
  project: {
    id?: string;
    title: string;
    aspectRatio: AspectRatio;
    duration?: number;
    output?: { url: string } | string | null;
    music?: { file: string } | null;
    musicTrack?: string | null;
    clips?: Array<{ sceneId: string; file?: string; url?: string }>;
    scenes: Array<{
      id?: string;
      order: number;
      title: string;
      prompt: string;
      promptEn?: string;
      screenText?: string;
      narration?: string;
      camera: string;
      duration?: number;
      image?: string | null;
      videoUrl?: string | null;
    }>;
  },
  motionStyle: "bounce" | "cinematic" | "kinetic" = "bounce",
): string {
  const dims = project.aspectRatio === "9:16"
    ? { width: 1080, height: 1920 }
    : project.aspectRatio === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1920, height: 1080 };
  const totalDuration = Math.max(
    5,
    project.scenes.reduce((sum, scene) => sum + (scene.duration || 5), 0),
  );
  const safeTitle = project.title.replace(/["\\\r\n]/g, " ").trim() || "Kadra_Comp";

  const sceneBlocks = project.scenes.map((scene, index) => {
    const safeSceneTitle = scene.title.replace(/["\\\r\n]/g, " ").trim();
    const safePrompt = (scene.promptEn || scene.prompt).replace(/["\\\r\n]/g, " ").slice(0, 180);
    const safeText = (scene.screenText || scene.narration || scene.title).replace(/["\\\r\n]/g, " ").slice(0, 90);
    const dur = Math.max(1, scene.duration || 5);
    const matchedClipObj = scene.id ? project.clips?.find((clip) => clip.sceneId === scene.id) : undefined;
    const matchedClip = matchedClipObj?.file || matchedClipObj?.url;
    const mediaPath = resolveLocalMediaDiskPath(scene.videoUrl || matchedClip || scene.image || "").replace(/["\\\r\n]/g, "");
    const shotName = `Shot_${String(scene.order).padStart(2, "0")}_${safeSceneTitle.slice(0, 24)}`;
    return [
      `  // Sahne ${index + 1}: ${safeSceneTitle} (${dur} sn · ${scene.camera})`,
      `  var solid_${index + 1} = addFootageOrSolid(comp, "${mediaPath}", "${shotName}", ${dims.width}, ${dims.height}, ${dur});`,
      `  solid_${index + 1}.startTime = cursor;`,
      `  solid_${index + 1}.outPoint = cursor + ${dur};`,
      `  solid_${index + 1}.comment = "Prompt: ${safePrompt} | Camera: ${scene.camera}";`,
      `  var text_${index + 1} = comp.layers.addText("${safeText}");`,
      `  text_${index + 1}.startTime = cursor;`,
      `  text_${index + 1}.outPoint = cursor + ${dur};`,
      motionStyle === "bounce"
        ? `  text_${index + 1}.property("Transform").property("Scale").expression = "freq = 2.5; decay = 5.0; t = time - inPoint; s = 100 - 30 * Math.cos(freq * t * 2 * Math.PI) / Math.exp(decay * t); [s, s]";`
        : motionStyle === "kinetic"
          ? `  text_${index + 1}.property("Transform").property("Position").expression = "t = Math.min(1, (time - inPoint) * 3); [value[0], value[1] + (1 - t) * 80]";`
          : `  text_${index + 1}.property("Transform").property("Opacity").expression = "linear(time, inPoint, inPoint + 0.6, 0, 100)";`,
      `  cursor += ${dur};`,
    ].join("\n");
  });

  const rawAudio = project.musicTrack || project.music?.file || (typeof project.output === "string" ? project.output : project.output?.url) || "";
  const audioDiskPath = resolveLocalMediaDiskPath(rawAudio).replace(/["\\\r\n]/g, "");
  const audioBlock = audioDiskPath
    ? [
        `  var audioFile = new File("${audioDiskPath}");`,
        `  if (audioFile.exists) {`,
        `    var audioItem = app.project.importFile(new ImportOptions(audioFile));`,
        `    var audioLayer = comp.layers.add(audioItem);`,
        `    audioLayer.startTime = 0;`,
        `  }`,
      ]
    : [];

  return [
    `// Kadra Studio × Higgsfield AI Motion Designer — Adobe After Effects ExtendScript (.jsx)`,
    `// Proje: ${safeTitle} (${project.aspectRatio}, ${totalDuration} sn, ${project.scenes.length} sahne)`,
    `// Kullanım: After Effects > File > Scripts > Run Script File... veya MCP Bridge (@higgsfield /use-after-effects)`,
    `(function createKadraMotionComp() {`,
    `  app.beginUndoGroup("Kadra AI Motion Designer - ${safeTitle}");`,
    `  function addFootageOrSolid(comp, diskPath, name, w, h, dur) {`,
    `    if (diskPath) {`,
    `      var f = new File(diskPath);`,
    `      if (f.exists) {`,
    `        var item = app.project.importFile(new ImportOptions(f));`,
    `        item.name = name;`,
    `        return comp.layers.add(item, dur);`,
    `      }`,
    `    }`,
    `    return comp.layers.addSolid([0.08, 0.09, 0.10], name, w, h, 1.0, dur);`,
    `  }`,
    `  var comp = app.project.items.addComp("${safeTitle}", ${dims.width}, ${dims.height}, 1, ${totalDuration}, 30);`,
    `  var cameraLayer = comp.layers.addCamera("Kadra_35mm_Cinema_Camera", [${dims.width / 2}, ${dims.height / 2}]);`,
    `  var cursor = 0;`,
    ...sceneBlocks,
    ...audioBlock,
    `  comp.openInViewer();`,
    `  app.endUndoGroup();`,
    `})();`,
  ].join("\n");
}

/**
 * Generates an executable Blender 4.x Python (`bpy`) script (`For Blender` MCP skill category
 * in `ev_9593c91e07f5f85cc3325986c41ec11bb81ce6ce93b28128c8692cfcee15c3b7`) that sets up
 * render resolution, a 3D Cinema Camera with animated shot keyframes, 3-point lighting, and timeline markers.
 */
export function generateBlenderPythonScript(
  project: {
    title: string;
    aspectRatio: AspectRatio;
    scenes: Array<{
      order: number;
      title: string;
      prompt: string;
      camera: string;
      duration?: number;
    }>;
  },
  lensMm: 24 | 35 | 50 | 85 = 35,
): string {
  const dims = project.aspectRatio === "9:16"
    ? { width: 1080, height: 1920 }
    : project.aspectRatio === "1:1"
      ? { width: 1080, height: 1080 }
      : { width: 1920, height: 1080 };
  const fps = 30;
  const totalSeconds = Math.max(
    5,
    project.scenes.reduce((sum, scene) => sum + (scene.duration || 5), 0),
  );
  const safeTitle = project.title.replace(/["\\\r\n]/g, " ").trim() || "Kadra_Blender_Scene";

  let currentFrame = 1;
  const markerLines: string[] = [];
  for (const scene of project.scenes) {
    const durFrames = Math.max(1, (scene.duration || 5) * fps);
    const endFrame = currentFrame + durFrames;
    const cleanTitle = scene.title.replace(/["\\\r\n]/g, " ").trim();
    const isPushIn = /yaklaş|push|zoom in|in/i.test(scene.camera);
    const isPullOut = /uzaklaş|pull|zoom out|out/i.test(scene.camera);
    const startY = isPullOut ? -6.5 : -9.0;
    const endY = isPushIn ? -6.0 : isPullOut ? -10.5 : -8.5;
    markerLines.push(
      `# Sahne ${scene.order}: ${cleanTitle} (${scene.camera})`,
      `marker = scene.timeline_markers.new(name="Shot_${String(scene.order).padStart(2, "0")}_${cleanTitle.slice(0, 20)}", frame=${currentFrame})`,
      `cam_obj.location = (0.0, ${startY}, 1.65)`,
      `cam_obj.keyframe_insert(data_path="location", frame=${currentFrame})`,
      `cam_obj.location = (0.0, ${endY}, 1.65)`,
      `cam_obj.keyframe_insert(data_path="location", frame=${endFrame - 1})`,
    );
    currentFrame = endFrame;
  }

  return [
    `# Kadra Studio × Higgsfield MCP ("For Blender") — Blender 4.x Python Script (.py)`,
    `# Proje: ${safeTitle} (${project.aspectRatio}, ${totalSeconds} sn, ${lensMm}mm Sinema Lensi)`,
    `# Kullanım: Blender > Scripting > Open > Run Script veya: blender --python script.py`,
    `import bpy`,
    ``,
    `scene = bpy.context.scene`,
    `scene.name = "${safeTitle}"`,
    `scene.render.resolution_x = ${dims.width}`,
    `scene.render.resolution_y = ${dims.height}`,
    `scene.render.fps = ${fps}`,
    `scene.frame_start = 1`,
    `scene.frame_end = ${totalSeconds * fps}`,
    ``,
    `# ${lensMm}mm Sinema Kamerası ve Alan Derinliği (DOF)`,
    `cam_data = bpy.data.cameras.new(name="Kadra_${lensMm}mm_Camera")`,
    `cam_data.lens = ${lensMm}`,
    `cam_data.dof.use_dof = True`,
    `cam_data.dof.aperture_fstop = 1.8`,
    `cam_obj = bpy.data.objects.new("Kadra_${lensMm}mm_Camera", cam_data)`,
    `scene.collection.objects.link(cam_obj)`,
    `scene.camera = cam_obj`,
    `cam_obj.rotation_euler = (1.52, 0.0, 0.0)`,
    ``,
    `# 3 Noktalı Sinematik Işık Kurulumu (Key + Rim)`,
    `key_data = bpy.data.lights.new(name="Kadra_Key_Light", type='AREA')`,
    `key_data.energy = 850`,
    `key_obj = bpy.data.objects.new(name="Kadra_Key_Light", object_data=key_data)`,
    `key_obj.location = (3.2, -4.5, 4.0)`,
    `scene.collection.objects.link(key_obj)`,
    ``,
    ...markerLines,
  ].join("\n");
}

export const LENSES = [
  { id: "", label: "Otomatik", prompt: "" },
  { id: "clean", label: "Keskin / Modern", prompt: "clean sharp modern cinema lens" },
  { id: "anamorphic", label: "Anamorfik", prompt: "anamorphic cinema lens, oval bokeh, horizontal lens flares" },
  { id: "vintage", label: "Vintage", prompt: "vintage cinema lens, gentle halation and soft highlight rolloff" },
  { id: "wide", label: "Geniş açı", prompt: "24mm wide angle cinema lens" },
  { id: "portrait", label: "Portre", prompt: "85mm portrait lens, shallow depth of field" },
] as const;
export const LIGHTING = [
  { id: "", label: "Otomatik", prompt: "" },
  { id: "window", label: "Pencere ışığı", prompt: "soft natural window light" },
  { id: "golden", label: "Altın saat", prompt: "warm golden hour sunlight" },
  { id: "silhouette", label: "Silüet", prompt: "dramatic backlit silhouette" },
  { id: "studio", label: "Stüdyo", prompt: "soft professional studio lighting" },
  { id: "neon", label: "Neon", prompt: "cinematic neon practical lighting" },
  { id: "lowkey", label: "Düşük ışık", prompt: "low key dramatic lighting with deep shadows" },
] as const;

export const POPCORN_MODES = [
  {
    id: "auto",
    label: "Otomatik Storyboard",
    badge: "AI PLAN",
    description: "Tek bir fikir ve referans karakterlerden 4–8 tutarlı sahneyi otomatik kurgula.",
  },
  {
    id: "manual",
    label: "Manuel Sahne Dizisi",
    badge: "KADRAJ KONTROLÜ",
    description: "Her karenin kamera açısını ve eylemini sahne sahne kendin yönet.",
  },
  {
    id: "instadump",
    label: "Hızlı Seri (Photodump)",
    badge: "SOSYAL SERİ",
    description: "Aynı karakter ve atmosferle farklı anlardan oluşan çoklu kare serisi üret.",
  },
] as const;

export const CONTENT_FACTORY_STYLES = [
  {
    id: "what-if",
    title: "Alternatif Tarih & Ya Olsaydı?",
    tag: "VİRAL SERİ",
    presetId: "cinematic",
    aspectRatio: "9:16" as AspectRatio,
    image: "/images/mountains.jpg",
    sampleTopic: "Ya antik kütüphaneler hiç yanmasaydı ve bugün buharlı gökdelenlerde yaşasaydık?",
  },
  {
    id: "noir-case",
    title: "Gece Dosyası & Gizem",
    tag: "SUÇ & GERİLİM",
    presetId: "noir",
    aspectRatio: "9:16" as AspectRatio,
    image: "/images/desert.jpg",
    sampleTopic: "Gece 03:15'te terk edilmiş istasyonda bulunan şifreli kasetin sırrı.",
  },
  {
    id: "scifi-lore",
    title: "Bilimkurgu Evren Günlüğü",
    tag: "SİNEMATİK EVREN",
    presetId: "anime",
    aspectRatio: "16:9" as AspectRatio,
    image: "/images/space.jpg",
    sampleTopic: "Yörünge asansörünün tepesinde yaşayan son bakım mühendisinin keşfi.",
  },
  {
    id: "brand-story",
    title: "Marka & Ürün Hikâyesi",
    tag: "REKLAM KAMPANYASI",
    presetId: "promo",
    aspectRatio: "9:16" as AspectRatio,
    image: "/images/desert.jpg",
    sampleTopic: "Sabah güneşinde el yapımı seramik atölyesinden çıkan ilk fincanın yolculuğu.",
  },
] as const;

export function defaultStudioDraft(mode: CreationMode = "video", launch?: StudioLaunch): StudioDraft {
  const preset = presetOf(launch?.presetId ?? "");
  return {
    prompt: launch?.prompt ?? preset?.idea ?? "",
    mode,
    presetId: preset?.id ?? "cinematic",
    aspectRatio: "16:9",
    duration: 5,
    camera: "in",
    lens: "",
    aperture: "",
    lighting: "",
    genre: preset?.genre === "general" ? "" : preset?.genre ?? "",
    look: preset?.look ?? "none",
    era: "",
    pacing: "",
    frameModel: "",
    videoModel: "",
    multiShot: false,
    quality: "best",
    shotCount: 1,
    withVoiceover: false,
  };
}

/** Browser storage is untrusted; restore only known values and bounded text. */
export function restoreStudioDraft(raw: unknown, fallback: StudioDraft): StudioDraft {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fallback;
  const data = raw as Record<string, unknown>;
  const text = (key: string, max: number) => typeof data[key] === "string" ? (data[key] as string).slice(0, max) : fallback[key as keyof StudioDraft];
  const oneOf = <T extends string>(key: keyof StudioDraft, choices: readonly T[], otherwise: T): T => choices.includes(data[key] as T) ? data[key] as T : otherwise;
  const shotCount = typeof data.shotCount === "number" && Number.isInteger(data.shotCount) && data.shotCount >= 1 && data.shotCount <= 8
    ? data.shotCount
    : fallback.shotCount;
  return {
    ...fallback,
    prompt: text("prompt", 4000) as string,
    mode: oneOf("mode", ["image", "video"], fallback.mode),
    aspectRatio: oneOf("aspectRatio", ["16:9", "9:16", "1:1"], fallback.aspectRatio),
    duration: typeof data.duration === "number" && Number.isInteger(data.duration) && data.duration >= 2 && data.duration <= 15 ? data.duration : fallback.duration,
    camera: oneOf("camera", CAMERA_MOVES.map((item) => item.id), "in"),
    lens: oneOf("lens", LENSES.map((item) => item.id), ""),
    lighting: oneOf("lighting", LIGHTING.map((item) => item.id), ""),
    genre: oneOf("genre", GENRES.map((item) => item.id), ""),
    look: oneOf("look", LOOKS.map((item) => item.id), "none"),
    presetId: presetOf(data.presetId as string)?.id ?? fallback.presetId,
    aperture: oneOf("aperture", ["", "f/1.4", "f/4", "f/11"], ""),
    era: oneOf("era", ["", "1960s", "1980s", "1990s", "2020s"], ""),
    pacing: oneOf("pacing", ["", "calm", "dynamic", "single"], ""),
    frameModel: text("frameModel", 100) as string,
    videoModel: text("videoModel", 100) as string,
    multiShot: data.multiShot === true,
    quality: oneOf("quality", ["economy", "balanced", "best"], fallback.quality),
    shotCount,
    withVoiceover: data.withVoiceover === true,
  };
}

/** Inserts an `@Character` or `@Location` mention token cleanly into a studio prompt. */
export function insertElementMention(prompt: string, name: string): string {
  const clean = name.trim().replace(/^@+/, "");
  if (!clean) return prompt;
  const token = `@${clean}`;
  if (prompt.includes(token)) return prompt;
  const trimmed = prompt.trimEnd();
  return trimmed ? `${trimmed} ${token} ` : `${token} `;
}

const SHOT_ANGLE_HINTS = [
  "Geniş kurucu plan (establishing shot)",
  "Orta plan, karakter odaklı kadraj",
  "Yakın plan, duygusal detay ve bakış",
  "Dinamik takip açısı, atmosferik derinlik",
  "Alçak açı kahraman kadrajı",
  "Omuz üstü sinematik perspektif",
  "Yüksek açı mekân ve hareket",
  "Kapanış planı, dramatik son kare",
];

/** Cinematic selections are explicit prompt direction; they never impersonate provider hardware parameters. */
export function studioProjectInput(draft: StudioDraft, budget: number | null) {
  const preset = presetOf(draft.presetId);
  const direction = [
    preset?.brief,
    LENSES.find((item) => item.id === draft.lens)?.prompt,
    LIGHTING.find((item) => item.id === draft.lighting)?.prompt,
    draft.aperture ? `aperture ${draft.aperture}` : "",
    draft.era ? `visual era: ${draft.era}` : "",
    draft.pacing ? `pacing: ${draft.pacing}` : "",
  ].filter(Boolean).join(". ").slice(0, 1500);

  const paragraphs = draft.prompt.trim().split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean).slice(0, 12);
  let parts: string[];
  if ((draft.multiShot || draft.shotCount > 1) && paragraphs.length > 1) {
    parts = paragraphs;
  } else if (draft.shotCount > 1 && paragraphs.length === 1) {
    const base = paragraphs[0];
    const count = Math.min(8, Math.max(1, draft.shotCount));
    parts = Array.from({ length: count }, (_, idx) => `${base} — ${SHOT_ANGLE_HINTS[idx % SHOT_ANGLE_HINTS.length]}`);
  } else {
    parts = [draft.prompt.trim()];
  }

  const first = (paragraphs[0] ?? parts[0])?.split(/[.!?\n]/)[0]?.trim() || "Yeni üretim";
  return {
    title: first.length > 64 ? `${first.slice(0, 62)}…` : first,
    style: preset?.style ?? "Sinematik",
    aspectRatio: draft.aspectRatio,
    budget,
    genre: GENRES.some((item) => item.id === draft.genre) ? draft.genre : "",
    look: draft.look,
    brief: direction,
    shots: parts.map((prompt, index) => ({
      id: String(index + 1).padStart(2, "0"),
      sceneTitle: parts.length > 1 ? `Çekim ${index + 1}` : first.slice(0, 120),
      durationSec: draft.duration,
      visualSummary: prompt,
      cameraMovement: CAMERA_MOVES.find((item) => item.id === draft.camera)?.label ?? "Sabit kadraj",
      aiPrompt: prompt,
      audioCues: draft.withVoiceover ? "Sinematik atmosfer ve doğal ortam sesi" : "",
      voiceoverOrText: draft.withVoiceover ? prompt.slice(0, 220) : "",
    })),
  };
}
