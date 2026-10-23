import { spawn } from "node:child_process";
import { constants } from "node:fs";
import { access, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { cameraMove, type CameraMoveId } from "../cinema";
import type { AspectRatio, Box } from "../types";

const FPS = 30;
const FADE = 0.4;

export class FfmpegError extends Error {}

let located: string | null = null;

/** FFmpeg may live outside the server's PATH (e.g. ~/.local/bin), so check the usual places first. */
export async function findFfmpeg(): Promise<string | null> {
  if (located) return located;
  const candidates = [process.env.FFMPEG_PATH, path.join(os.homedir(), ".local/bin/ffmpeg"), "/opt/homebrew/bin/ffmpeg", "/usr/local/bin/ffmpeg", "/usr/bin/ffmpeg"];
  for (const candidate of candidates) {
    if (!candidate) continue;
    try { await access(candidate, constants.X_OK); located = candidate; return candidate; } catch { /* Try the next location. */ }
  }
  const inPath = await new Promise<boolean>((resolve) => {
    const child = spawn(/*turbopackIgnore: true*/ "ffmpeg", ["-version"], { stdio: "ignore" });
    child.on("error", () => resolve(false));
    child.on("exit", (code) => resolve(code === 0));
  });
  located = inPath ? "ffmpeg" : null;
  return located;
}

let font: string | null | undefined;
async function findFont(): Promise<string> {
  if (font === undefined) {
    font = null;
    for (const candidate of [process.env.KADRA_TITLE_FONT, "/System/Library/Fonts/Supplemental/Arial.ttf", "/System/Library/Fonts/Supplemental/Arial Unicode.ttf", "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", "C:\\Windows\\Fonts\\arial.ttf"]) {
      if (!candidate) continue;
      try { await access(candidate, constants.R_OK); font = candidate; break; } catch { /* Try the next font. */ }
    }
  }
  if (!font) throw new FfmpegError("Yazı kartı için Türkçe karakter destekli bir yazı tipi bulunamadı (KADRA_TITLE_FONT ile belirtin).");
  return font;
}

async function ffmpeg(args: string[], cwd: string, timeoutMs = 240_000): Promise<string> {
  const binary = await findFfmpeg();
  if (!binary) throw new FfmpegError("FFmpeg bulunamadı. Kurup FFMPEG_PATH ile yolunu belirtin.");
  return new Promise((resolve, reject) => {
    // The binary and work folders are runtime paths, not files to bundle.
    const child = spawn(/*turbopackIgnore: true*/ binary, ["-hide_banner", "-nostdin", "-y", ...args], { cwd, stdio: ["ignore", "ignore", "pipe"] });
    let head = "";
    let tail = "";
    child.stderr.on("data", (chunk: Buffer) => {
      if (head.length < 6_000) head += chunk.toString();
      tail = (tail + chunk.toString()).slice(-6_000);
    });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); reject(new FfmpegError(`FFmpeg başlatılamadı: ${error.message}`)); });
    child.on("close", (code, signal) => {
      clearTimeout(timer);
      if (code === 0) return resolve(head);
      const reason = signal ? "zaman aşımı" : tail.trim().split("\n").filter(Boolean).slice(-2).join(" ").slice(0, 300);
      reject(new FfmpegError(`FFmpeg işlemi başarısız oldu: ${reason}`));
    });
  });
}

export function outputSize(aspectRatio: AspectRatio): { width: number; height: number } {
  return aspectRatio === "16:9" ? { width: 1280, height: 720 } : aspectRatio === "9:16" ? { width: 720, height: 1280 } : { width: 960, height: 960 };
}

export type Motion = CameraMoveId;

/** Maps the planner's free-text Turkish/English camera note to the film's camera vocabulary. */
export function cameraMotion(camera: string): Motion {
  return cameraMove(camera).id;
}

const ENCODE = ["-c:v", "libx264", "-preset", "veryfast", "-crf", "20", "-pix_fmt", "yuv420p", "-r", String(FPS)];

export async function renderImageClip({ image, output, duration, aspectRatio }: { image: string; output: string; duration: number; aspectRatio: AspectRatio; camera?: string }): Promise<void> {
  const { width, height } = outputSize(aspectRatio);
  const frames = Math.round(duration * FPS);
  const filter = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos`,
    `crop=${width}:${height}`,
    "setsar=1",
    `fps=${FPS}`,
    `fade=t=in:st=0:d=${FADE}`, `fade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}`, "format=yuv420p",
  ].join(",");
  await mkdir(path.dirname(output), { recursive: true });
  await ffmpeg(["-loop", "1", "-i", image, "-vf", filter, "-frames:v", String(frames), ...ENCODE, "-an", output], path.dirname(output));
}

/** Fits a provider's clip to the film: same size and frame rate, exact shot length (holding the last frame if short). */
export async function renderVideoClip({ input, output, duration, aspectRatio }: { input: string; output: string; duration: number; aspectRatio: AspectRatio }): Promise<void> {
  const { width, height } = outputSize(aspectRatio);
  const filter = [
    `scale=${width}:${height}:force_original_aspect_ratio=increase`, `crop=${width}:${height}`, "setsar=1", `fps=${FPS}`,
    `tpad=stop_mode=clone:stop_duration=${duration}`,
    `fade=t=in:st=0:d=${FADE}`, `fade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}`, "format=yuv420p",
  ].join(",");
  await mkdir(path.dirname(output), { recursive: true });
  await ffmpeg(["-i", path.resolve(input), "-vf", filter, "-frames:v", String(Math.round(duration * FPS)), ...ENCODE, "-an", path.resolve(output)], path.dirname(path.resolve(output)));
}

/** Greedy word wrap; shrinks the font until the card fits in six lines. */
export function layoutTitle(text: string, width: number, height: number): { fontSize: number; lines: string[] } {
  const words = text.replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  let fontSize = Math.round(Math.min(width, height) * 0.065);
  while (true) {
    const maxChars = Math.max(8, Math.floor((width * 0.8) / (fontSize * 0.52)));
    const lines: string[] = [];
    for (const word of words) {
      const last = lines.at(-1);
      if (last !== undefined && `${last} ${word}`.length <= maxChars) lines[lines.length - 1] = `${last} ${word}`;
      else lines.push(word.length > maxChars ? word.slice(0, maxChars) : word);
    }
    if (lines.length <= 6 || fontSize <= 18) return { fontSize, lines: lines.slice(0, 8) };
    fontSize = Math.round(fontSize * 0.85);
  }
}

export async function renderTitleClip({ text, output, duration, aspectRatio }: { text: string; output: string; duration: number; aspectRatio: AspectRatio }): Promise<void> {
  const { width, height } = outputSize(aspectRatio);
  const fontFile = await findFont();
  const { fontSize, lines } = layoutTitle(text || " ", width, height);
  const lineHeight = Math.round(fontSize * 1.4);
  const top = Math.round((height - lineHeight * lines.length) / 2);
  const work = await mkdtemp(path.join(os.tmpdir(), "kadra-title-"));
  try {
    // Each line comes from a file so quotes, colons and percent signs in the script are never parsed as filter syntax.
    await Promise.all(lines.map((line, index) => writeFile(path.join(work, `line-${index}.txt`), line)));
    const draw = lines.map((_, index) => `drawtext=fontfile='${fontFile.replace(/'/g, "")}':textfile='line-${index}.txt':expansion=none:fontcolor=0xF2F3F1:fontsize=${fontSize}:x=(w-text_w)/2:y=${top + index * lineHeight}`);
    const filter = [...draw, `fade=t=in:st=0:d=${FADE}`, `fade=t=out:st=${(duration - FADE).toFixed(2)}:d=${FADE}`, "format=yuv420p"].join(",");
    await mkdir(path.dirname(output), { recursive: true });
    await ffmpeg(["-f", "lavfi", "-i", `color=c=0x111214:s=${width}x${height}:r=${FPS}:d=${duration}`, "-vf", filter, "-frames:v", String(Math.round(duration * FPS)), ...ENCODE, "-an", path.resolve(output)], work);
  } finally { await rm(work, { recursive: true, force: true }); }
}

/** Joins clips in order, applies the project's colour/era look and adds a silent stereo track so every player treats the film the same way. */
export async function concatClips({ clips, output, look = "" }: { clips: string[]; output: string; look?: string }): Promise<void> {
  if (!clips.length) throw new FfmpegError("Birleştirilecek klip yok.");
  const work = await mkdtemp(path.join(os.tmpdir(), "kadra-montage-"));
  try {
    await writeFile(path.join(work, "clips.txt"), clips.map((clip) => `file '${path.resolve(clip).replace(/'/g, "'\\''")}'`).join("\n"));
    await ffmpeg(["-f", "concat", "-safe", "0", "-i", "clips.txt", "-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000",
      "-map", "0:v", "-map", "1:a", "-shortest", ...(look ? ["-vf", `${look},format=yuv420p`] : []), ...ENCODE, "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", path.resolve(output)], work, 600_000);
  } finally { await rm(work, { recursive: true, force: true }); }
}

/** Reads an audio file's duration; fails if it holds no decodable audio stream. */
export async function inspectAudio(file: string): Promise<number> {
  const log = await ffmpeg(["-v", "info", "-i", path.resolve(file), "-map", "0:a:0", "-t", "1", "-f", "null", "-"], path.dirname(path.resolve(file)));
  const match = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new FfmpegError("Ses dosyasının süresi okunamadı.");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}

/** Converts any audio file to the stereo 48 kHz AAC that the mixer expects. */
export async function convertAudio({ input, output }: { input: string; output: string }): Promise<void> {
  await ffmpeg(["-i", path.resolve(input), "-vn", "-ac", "2", "-ar", "48000", "-c:a", "aac", "-b:a", "160k", path.resolve(output)], path.dirname(path.resolve(output)));
}

export interface VoiceTrack { file: string; start: number; length: number }

/**
 * Replaces the film's sound: narration placed at each shot's start (trimmed to the shot), and the music (from
 * `offset`, at `volume`, faded) ducked under the voice. With neither, the film gets silence. The picture is copied untouched.
 */
export async function applySoundtrack({ film, output, duration, music, voices = [], voiceVolume = 1 }: { film: string; output: string; duration: number; music: { file: string; volume: number; offset: number } | null; voices?: VoiceTrack[]; voiceVolume?: number }): Promise<void> {
  const fadeOut = Math.max(0, duration - 2).toFixed(2);
  const inputs = ["-i", path.resolve(film)];
  const graph: string[] = [];
  const format = "aformat=sample_rates=48000:channel_layouts=stereo";
  if (music) {
    inputs.push("-ss", music.offset.toFixed(2), "-i", path.resolve(music.file));
    graph.push(`[1:a]${format},volume=${music.volume.toFixed(2)},apad,afade=t=in:st=0:d=0.5,afade=t=out:st=${fadeOut}:d=2[music]`);
  }
  const first = music ? 2 : 1;
  voices.forEach((voice, index) => {
    inputs.push("-i", path.resolve(voice.file));
    const length = Math.max(0.3, voice.length);
    const delay = Math.round(voice.start * 1000);
    graph.push(`[${first + index}:a]${format},atrim=0:${length.toFixed(2)},afade=t=out:st=${Math.max(0, length - 0.15).toFixed(2)}:d=0.15,adelay=delays=${delay}:all=1,volume=${voiceVolume.toFixed(2)}[v${index}]`);
  });
  let audio: string[];
  if (voices.length) {
    graph.push(`${voices.map((_, index) => `[v${index}]`).join("")}amix=inputs=${voices.length}:normalize=0:dropout_transition=0,apad[voice]`);
    if (music) {
      // The voice keys a compressor on the music so the music dips while someone speaks.
      graph.push("[voice]asplit=2[key][speech]", "[music][key]sidechaincompress=threshold=0.03:ratio=8:attack=15:release=350[ducked]", "[ducked][speech]amix=inputs=2:normalize=0:duration=first[mix]");
    } else graph.push("[voice]anull[mix]");
    audio = ["-filter_complex", graph.join(";"), "-map", "0:v", "-map", "[mix]"];
  } else if (music) {
    audio = ["-filter_complex", graph.join(";"), "-map", "0:v", "-map", "[music]"];
  } else {
    inputs.push("-f", "lavfi", "-i", "anullsrc=channel_layout=stereo:sample_rate=48000");
    audio = ["-map", "0:v", "-map", "1:a"];
  }
  await ffmpeg([...inputs, ...audio, "-c:v", "copy", "-c:a", "aac", "-b:a", "192k", "-t", duration.toFixed(2), "-movflags", "+faststart", path.resolve(output)], path.dirname(path.resolve(output)));
}

/** Reads an image's pixel size. */
export async function probeImage(file: string): Promise<{ width: number; height: number }> {
  const log = await ffmpeg(["-v", "info", "-i", path.resolve(file), "-frames:v", "1", "-f", "null", "-"], path.dirname(path.resolve(file)));
  const match = log.match(/Stream #[^\n]*Video:[^\n]*?\b(\d{2,5})x(\d{2,5})\b/);
  if (!match) throw new FfmpegError("Görsel boyutu okunamadı.");
  return { width: Number(match[1]), height: Number(match[2]) };
}

type PixelBox = { x: number; y: number; w: number; h: number };
const pixels = ([x0, y0, x1, y1]: Box, width: number, height: number): PixelBox => {
  const x = Math.round(x0 * width); const y = Math.round(y0 * height);
  return { x, y, w: Math.max(2, Math.round(x1 * width) - x), h: Math.max(2, Math.round(y1 * height) - y) };
};

/** Scales an image to an exact size as PNG (the edit model wants its input and mask at the same, aligned size). */
export async function fitImage({ input, output, width, height }: { input: string; output: string; width: number; height: number }): Promise<void> {
  await ffmpeg(["-i", path.resolve(input), "-vf", `scale=${width}:${height}:flags=lanczos,format=rgb24`, "-frames:v", "1", path.resolve(output)], path.dirname(path.resolve(output)));
}

/** An inpainting mask: transparent where the model may redraw, opaque everywhere it must keep. */
export async function renderMask({ width, height, boxes, output }: { width: number; height: number; boxes: Box[]; output: string }): Promise<void> {
  const holes = boxes.map((box) => { const { x, y, w, h } = pixels(box, width, height); return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=black@0:t=fill:replace=1`; });
  await ffmpeg(["-f", "lavfi", "-i", `color=c=black:s=${width}x${height},format=rgba`, "-vf", holes.join(","), "-frames:v", "1", path.resolve(output)], path.dirname(path.resolve(output)));
}

/**
 * Pastes only the marked regions of the edited image back into the original, with softened edges.
 * Every pixel outside the regions comes from the original, so a repair can never disturb the rest of the frame.
 */
export async function compositeRegion({ original, edited, boxes, output }: { original: string; edited: string; boxes: Box[]; output: string }): Promise<void> {
  const { width, height } = await probeImage(original);
  const feather = Math.max(2, Math.round(Math.min(width, height) * 0.012));
  const fills = boxes.map((box) => { const { x, y, w, h } = pixels(box, width, height); return `drawbox=x=${x}:y=${y}:w=${w}:h=${h}:color=white:t=fill`; });
  const filter = [
    `[2:v]format=gray,${fills.join(",")},gblur=sigma=${feather}[mask]`,
    `[1:v]scale=${width}:${height}:flags=lanczos,format=rgb24[edit]`,
    "[edit][mask]alphamerge[patch]",
    "[0:v]format=rgb24[base]",
    "[base][patch]overlay=0:0:format=auto,format=rgb24",
  ].join(";");
  await ffmpeg(["-i", path.resolve(original), "-i", path.resolve(edited), "-f", "lavfi", "-i", `color=c=black:s=${width}x${height}`, "-filter_complex", filter, "-frames:v", "1", path.resolve(output)], path.dirname(path.resolve(output)));
}

/** Decodes the whole file to prove it is playable and returns its duration in seconds. */
export async function inspectVideo(file: string): Promise<number> {
  const log = await ffmpeg(["-v", "info", "-i", path.resolve(file), "-map", "0:v", "-f", "null", "-"], path.dirname(path.resolve(file)));
  const match = log.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
  if (!match) throw new FfmpegError("Video süresi okunamadı.");
  return Number(match[1]) * 3600 + Number(match[2]) * 60 + Number(match[3]);
}
