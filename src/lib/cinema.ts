/**
 * The director's vocabulary shared by the planner, the editor, the free camera (FFmpeg) and the paid video models:
 * camera moves, genres and colour/era looks. Safe to import in the browser.
 */

export type CameraMoveId = "in" | "out" | "left" | "right" | "up" | "down" | "still" | "crash" | "handheld";

export interface CameraMove {
  id: CameraMoveId;
  /** What the planner writes and the editor offers. */
  label: string;
  /** How the move is asked of a video model. */
  prompt: string;
  /** MiniMax Hailuo's own camera command. */
  hailuo: string;
}

export const CAMERA_MOVES: CameraMove[] = [
  { id: "in", label: "Yavaş yaklaşma", prompt: "slow dolly in toward the subject", hailuo: "[Push in]" },
  { id: "out", label: "Yavaş uzaklaşma", prompt: "slow dolly out, pulling back to reveal the scene", hailuo: "[Pull out]" },
  { id: "left", label: "Sola kaydırma", prompt: "smooth pan to the left", hailuo: "[Pan left]" },
  { id: "right", label: "Sağa kaydırma", prompt: "smooth pan to the right", hailuo: "[Pan right]" },
  { id: "up", label: "Yukarı kaydırma", prompt: "camera tilts and rises upward", hailuo: "[Tilt up]" },
  { id: "down", label: "Aşağı kaydırma", prompt: "camera tilts downward", hailuo: "[Tilt down]" },
  { id: "still", label: "Sabit kadraj", prompt: "static locked-off camera, only the subject moves", hailuo: "[Static shot]" },
  { id: "crash", label: "Hızlı yaklaşma", prompt: "fast dramatic crash zoom in", hailuo: "[Zoom in]" },
  { id: "handheld", label: "El kamerası", prompt: "handheld camera with subtle natural shake", hailuo: "[Shake]" },
];

/** Maps a free-text Turkish or English camera note to a move; storyboards write "tilt up" and "tilt-up" alike. */
export function cameraMove(camera: string): CameraMove {
  const value = camera.toLocaleLowerCase("tr").replace(/[-_–]/g, " ");
  const pick = (id: CameraMoveId) => CAMERA_MOVES.find((move) => move.id === id)!;
  if (/el kamerası|omuz kamerası|handheld|shaky|titrek/.test(value)) return pick("handheld");
  if (/hızlı yaklaş|hızlı zoom|ani yaklaş|crash zoom|snap zoom|whip zoom/.test(value)) return pick("crash");
  if (/uzaklaş|geri çekil|zoom out|pull back|dolly out|pull out/.test(value)) return pick("out");
  if (/sağa|pan right|\bright\b/.test(value)) return pick("right");
  if (/sola|pan left|\bleft\b/.test(value)) return pick("left");
  if (/yukarı|yüksel|tilt up|crane up|\brise/.test(value)) return pick("up");
  if (/aşağı|alçal|tilt down|crane down|\bdown\b/.test(value)) return pick("down");
  if (/sabit|static|\bstill\b|durağan/.test(value)) return pick("still");
  return pick("in");
}

export interface Genre { id: string; label: string; mood: string; direction: string }

/** A genre sets the story conventions: framing and light in every prompt, pacing and camera choices in the plan. */
export const GENRES: Genre[] = [
  { id: "", label: "Genel", mood: "", direction: "" },
  { id: "action", label: "Aksiyon", mood: "dynamic action framing, high energy, strong motion", direction: "Kısa çekimler (3-5 sn), hızlı yaklaşma ve el kamerası gibi enerjik hareketler." },
  { id: "epic", label: "Epik", mood: "epic grand scale, sweeping vistas, heroic light", direction: "Geniş açılar, yavaş yükselen ve uzaklaşan kamera, görkemli manzaralar." },
  { id: "drama", label: "Dram", mood: "intimate dramatic lighting, emotional close framing", direction: "Yüzlere yakın kadrajlar, yavaş yaklaşmalar, sakin ritim." },
  { id: "comedy", label: "Komedi", mood: "bright playful framing, vivid colours, light mood", direction: "Aydınlık sahneler, sabit kadraj ve zamanlamayla çalışan komik anlar." },
  { id: "horror", label: "Korku", mood: "eerie low-key lighting, deep shadows, unsettling atmosphere", direction: "Karanlık ve gölgeli sahneler, yavaş yaklaşma, ani hızlı yaklaşmalar." },
  { id: "documentary", label: "Belgesel", mood: "natural documentary look, observational framing", direction: "Gözlemci kamera, el kamerası ve sabit kadraj, doğal ışık." },
];

export const genreOf = (id: string) => GENRES.find((genre) => genre.id === id) ?? GENRES[0];

export interface Look { id: string; label: string; hint: string; filter: string }

/**
 * A colour/era grade applied once at montage (free, never touches the frames or the cached clips).
 * `filter` is an FFmpeg video filter chain.
 */
export const LOOKS: Look[] = [
  { id: "none", label: "Doğal", hint: "Renklere dokunulmaz.", filter: "" },
  { id: "warm", label: "Sıcak", hint: "Altın saat sıcaklığı.", filter: "colorbalance=rs=0.06:gs=0.01:bs=-0.07:rm=0.04:bm=-0.04,eq=saturation=1.08" },
  { id: "teal-orange", label: "Sinema (turkuaz-turuncu)", hint: "Gölgeler turkuaz, ten ve ışıklar turuncu.", filter: "colorbalance=rs=-0.08:bs=0.1:rh=0.08:bh=-0.07,eq=contrast=1.06:saturation=1.1" },
  { id: "cold", label: "Soğuk", hint: "Mavi, mesafeli bir hava.", filter: "colorbalance=rs=-0.05:bs=0.08:bm=0.04,eq=saturation=0.9" },
  { id: "noir", label: "Kara film", hint: "Siyah beyaz, sert kontrast, film greni.", filter: "hue=s=0,eq=contrast=1.3:brightness=-0.03,vignette=angle=PI/4,noise=alls=7:allf=t" },
  { id: "1960s", label: "1960'lar filmi", hint: "Soluk renk, sıcak ton, gren ve kenar kararması.", filter: "eq=saturation=0.72:contrast=0.94,colorbalance=rs=0.06:bs=-0.06,noise=alls=9:allf=t,vignette=angle=PI/5" },
  { id: "1980s", label: "1980'ler VHS", hint: "Doygun renk, yumuşak görüntü, bant gürültüsü.", filter: "eq=saturation=1.3:contrast=0.92,gblur=sigma=0.6,noise=alls=10:allf=t" },
  { id: "1990s", label: "1990'lar", hint: "Hafif soluk, yeşilimsi film tonu.", filter: "eq=saturation=0.85:gamma=1.04,colorbalance=gs=0.03:gm=0.02" },
];

export const lookOf = (id: string) => LOOKS.find((look) => look.id === id) ?? LOOKS[0];
