/** Narration choices shared by the editor and the server. Safe to import in the browser. */

export type NarrationEngine = "off" | "local" | "gmi";

export interface NarrationSettings {
  engine: NarrationEngine;
  voice: string;
  /** 0.5–1.5; 1 is the voice's natural pace. */
  speed: number;
  /** Narration level in the mix (music is ducked under it). */
  volume: number;
}

export const DEFAULT_NARRATION: NarrationSettings = { engine: "off", voice: "", speed: 1, volume: 1 };

/** The macOS voice used for free drafts (and as the stand-in while a paid voice is not yet bought). */
export const LOCAL_VOICE = "Yelda";

export const VOICE_MODEL = "minimax-tts-speech-2.8-turbo";
export const VOICE_LABEL = "MiniMax Speech 2.8 Turbo";

/** MiniMax's Turkish voices on GMI. */
export const GMI_VOICES = [
  { id: "Turkish_CalmWoman", label: "Sakin kadın sesi" },
  { id: "Turkish_Trustworthyman", label: "Güven veren erkek sesi" },
];

export const narrationText = (scene: { narration: string }) => scene.narration.replace(/\s+/g, " ").trim();
