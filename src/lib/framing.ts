/**
 * How a character entry is drawn. A "sheet" is a plain reference sheet: one figure, front view, neutral background.
 * "free" draws exactly what the description says (a monument, a creature, a group, a scene). Safe to import in the browser.
 */
export type Framing = "auto" | "sheet" | "free";
export type ResolvedFraming = "sheet" | "free";

/** True when the user's style words ask for a photograph-like picture, so nothing may tell the model otherwise. */
export const wantsPhoto = (text: string): boolean => /photo|fotoğraf|fotogerçek|hyper-?real|live-?action|gerçekçi|realistic/i.test(text);

/** Words that describe a scene, a monument or a group rather than one person on a plain background. */
const SCENE_CUES = /carved|monument|sculpt|colossal|rushmore|mountain|peak|ridge|landscape|skyline|crowd|army|battle|\bdağ|heykel|anıt|oyul|devasa|kalabalık|ordu|manzara|zirve/i;

export const looksLikeScene = (text: string): boolean => SCENE_CUES.test(text);

/** What an entry will actually be drawn as: its own choice, or (on "auto") what its words describe. */
export function resolveFraming(character: { kind: "person" | "place"; framing?: Framing; style: string; appearance: string }): ResolvedFraming {
  if (character.kind === "place") return "free";
  if (character.framing === "sheet" || character.framing === "free") return character.framing;
  return looksLikeScene(`${character.style} ${character.appearance}`) ? "free" : "sheet";
}
