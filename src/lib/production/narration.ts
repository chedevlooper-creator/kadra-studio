import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import type { Project, Scene } from "../types";
import { LOCAL_VOICE, narrationText, type NarrationSettings } from "../voices";
import { convertAudio, FfmpegError, type VoiceTrack } from "./ffmpeg";

/** Narration is cached like frames and clips: a line is only spoken (or bought) again when its text or voice changes. */
export function voiceKey(settings: Pick<NarrationSettings, "engine" | "voice" | "speed">, text: string): string {
  return createHash("sha256").update(JSON.stringify(["voice", settings.engine, settings.voice, settings.speed, text])).digest("hex").slice(0, 16);
}

export const voiceFile = (sceneId: string, key: string) => `voice-${sceneId.slice(0, 8)}-${key}.m4a`;

/** The draft voice that stands in for a paid voice not yet bought. */
export function standInSettings(settings: NarrationSettings): NarrationSettings {
  return { ...settings, engine: "local", voice: settings.engine === "local" && settings.voice ? settings.voice : LOCAL_VOICE };
}

/** Files that may hold a shot's narration, best first: the chosen voice, then (for a paid voice) its free stand-in. */
export function voiceCandidates(project: Pick<Project, "narration">, scene: Scene): string[] {
  const text = narrationText(scene);
  if (project.narration.engine === "off" || !text) return [];
  const chosen = voiceFile(scene.id, voiceKey(project.narration, text));
  return project.narration.engine === "gmi" ? [chosen, voiceFile(scene.id, voiceKey(standInSettings(project.narration), text))] : [chosen];
}

const exists = (file: string) => access(file).then(() => true, () => false);

/** Where each shot's narration starts in the film: clips are cut to exactly their shot's length. */
export async function narrationTracks(project: Pick<Project, "narration" | "scenes">, directory: string): Promise<VoiceTrack[]> {
  const tracks: VoiceTrack[] = [];
  let start = 0;
  for (const scene of project.scenes) {
    for (const name of voiceCandidates(project, scene)) {
      if (await exists(path.join(directory, name))) { tracks.push({ file: path.join(directory, name), start, length: scene.duration }); break; }
    }
    start += scene.duration;
  }
  return tracks;
}

function run(binary: string, args: string[], timeoutMs = 60_000): Promise<string> {
  return new Promise((resolve, reject) => {
    // A system binary at runtime, not a file to bundle.
    const child = spawn(/*turbopackIgnore: true*/ binary, args, { stdio: ["ignore", "pipe", "pipe"] });
    let out = "";
    let err = "";
    child.stdout.on("data", (chunk: Buffer) => { out += chunk.toString(); });
    child.stderr.on("data", (chunk: Buffer) => { err += chunk.toString(); });
    const timer = setTimeout(() => child.kill("SIGKILL"), timeoutMs);
    child.on("error", (error) => { clearTimeout(timer); reject(new FfmpegError(`Ses motoru başlatılamadı: ${error.message}`)); });
    child.on("close", (code) => { clearTimeout(timer); if (code === 0) resolve(out); else reject(new FfmpegError(`Yerel ses üretilemedi: ${err.trim().slice(0, 200) || `çıkış kodu ${code}`}`)); });
  });
}

const SAY = "/usr/bin/say";
let voices: Promise<string[]> | null = null;

/** Turkish voices of the macOS speech engine; empty on other systems. */
export function localVoices(): Promise<string[]> {
  voices ??= process.platform !== "darwin" ? Promise.resolve([]) : run(SAY, ["-v", "?"]).then(
    (list) => list.split("\n").filter((line) => /\btr_TR\b/.test(line)).map((line) => line.replace(/\s+tr_TR.*$/, "").trim()).filter(Boolean),
    () => [],
  );
  return voices;
}

/** Speaks a line with the free macOS voice into a stereo AAC file. */
export async function speakLocally({ text, voice, speed, output }: { text: string; voice: string; speed: number; output: string }): Promise<void> {
  const available = await localVoices();
  if (!available.length) throw new FfmpegError("Bu bilgisayarda Türkçe yerel ses yok (macOS 'Yelda' sesi gerekir).");
  const work = await mkdtemp(path.join(os.tmpdir(), "kadra-voice-"));
  try {
    // The text goes through a file so nothing in it is read as a command-line option.
    await writeFile(path.join(work, "line.txt"), text);
    await run(SAY, ["-v", available.includes(voice) ? voice : available[0], "-r", String(Math.round(175 * speed)), "-o", path.join(work, "line.aiff"), "-f", path.join(work, "line.txt")]);
    await convertAudio({ input: path.join(work, "line.aiff"), output });
  } finally { await rm(work, { recursive: true, force: true }); }
}
