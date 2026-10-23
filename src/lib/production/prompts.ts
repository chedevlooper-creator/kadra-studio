import { CAMERA_MOVES, cameraMove, emotionOf, genreOf } from "../cinema";
import { resolveFraming, wantsPhoto } from "../framing";
import type { Character, Project, ReviewIssue, Scene } from "../types";

type PromptProject = Pick<Project, "characters" | "style"> & { genre?: string; brief?: string };

/**
 * Uses the background-enhanced English prompt when it is still in sync with the scene's source prompt;
 * falls back to `scene.prompt` when enhancement has not run yet or after an offline edit.
 */
export function effectiveScenePrompt(scene: Pick<Scene, "prompt"> & Partial<Pick<Scene, "promptEn" | "promptEnSource">>): string {
  return scene.promptEn && scene.promptEnSource === scene.prompt ? scene.promptEn : scene.prompt;
}

/** Storyboard prompts often carry their own "Style:" sentence; the project style is only added when they don't. */
function styleHint(project: PromptProject, scene: Scene): string {
  return /\bstyle\s*:/i.test(effectiveScenePrompt(scene)) ? "" : `Visual style: ${project.style}`;
}

const moodHint = (project: PromptProject) => genreOf(project.genre ?? "").mood;

/** The film's standing notes; empty (and therefore absent from every prompt and fingerprint) until the user writes some. */
const briefHint = (project: PromptProject) => project.brief?.trim() ? `Production notes to follow throughout: ${project.brief.trim().replace(/\s+/g, " ")}` : "";

/** How the characters of this shot feel, e.g. "Ada looks frightened, wide eyes". */
function feelings(project: PromptProject, scene: Scene): string {
  return project.characters
    .filter((character) => scene.characterIds.includes(character.id) && (character.kind ?? "person") === "person")
    .flatMap((character) => { const phrase = emotionOf(scene.emotions?.[character.id] ?? "").prompt; return phrase ? [`${character.name} ${phrase}`] : []; })
    .join("; ");
}

/** The people and the places linked to a shot, each as "name: description". */
function cast(project: PromptProject, scene: Scene): { people: string; places: string } {
  const linked = project.characters.filter((character) => scene.characterIds.includes(character.id));
  const notes = (kind: Character["kind"]) => linked.filter((character) => (character.kind ?? "person") === kind).map((character) => `${character.name}: ${character.appearance}`).join("; ");
  return { people: notes("person"), places: notes("place") };
}

/** The move in the model's words; a free-text note that is more than a preset name is kept alongside it. */
function cameraPhrase(scene: Scene): string {
  const move = cameraMove(scene.camera);
  const preset = CAMERA_MOVES.some((item) => item.label.toLocaleLowerCase("tr") === scene.camera.trim().toLocaleLowerCase("tr"));
  return preset || !scene.camera.trim() ? `Camera: ${move.prompt}` : `Camera: ${move.prompt} (${scene.camera.trim()})`;
}

/** A compiled prompt and whether the model's character limit forced anything out. */
export interface CompiledPrompt { prompt: string; truncated: boolean }

const FRAME_TAIL = "cinematic composition, high detail, no text, no captions, no watermark";
const VIDEO_TAIL = "Smooth cinematic motion, consistent lighting, no text, no subtitles, no watermark";

/**
 * Joins sections in priority order and always keeps the style/negative tail. When the model's limit is
 * smaller than the text, lower-priority sections are dropped and the main section is cut on a word boundary,
 * so "no text/no watermark" is never the part that disappears.
 */
function fitPrompt(sections: (string | false | undefined)[], tail: string, maxChars: number): CompiledPrompt {
  const body = sections.filter((section): section is string => Boolean(section && section.trim())).map((section) => section.trim());
  const full = [...body, tail].join(". ");
  if (full.length <= maxChars) return { prompt: full, truncated: false };
  const budget = Math.max(120, maxChars - tail.length - 2);
  const kept: string[] = [];
  for (const section of body) {
    const candidate = [...kept, section].join(". ");
    if (!kept.length || candidate.length <= budget) kept.push(section);
  }
  let prompt = [...kept, tail].join(". ");
  if (prompt.length > maxChars) {
    const room = Math.max(40, maxChars - tail.length - 2);
    const main = (kept[0] ?? "").slice(0, room).replace(/\s+\S*$/, "").trim();
    prompt = `${main}. ${tail}`;
  }
  return { prompt: prompt.slice(0, maxChars), truncated: true };
}

export function compileVideoPrompt(project: PromptProject, scene: Scene, maxChars = 1_900): CompiledPrompt {
  const { people, places } = cast(project, scene);
  return fitPrompt([
    scene.motionPrompt || cameraPhrase(scene), effectiveScenePrompt(scene),
    people && `Keep these characters exactly as they appear in the first frame: ${people}`,
    feelings(project, scene),
    places && `Keep the location as it appears in the first frame: ${places}`,
    styleHint(project, scene), moodHint(project), briefHint(project),
  ], VIDEO_TAIL, maxChars);
}

export function videoPrompt(project: PromptProject, scene: Scene): string {
  return compileVideoPrompt(project, scene, 1_900).prompt;
}

const SHEET_FRAMING = "Single character, upper body, front view, neutral light grey background, even studio light, clean shapes, no text, no logos, no watermark";
const PLATE_FRAMING = "Wide establishing view of the place, no people, no characters, clear readable layout, natural light, no text, no logos, no watermark";
const FREE_TAIL = "Compose it exactly as described, with every figure, object and setting that is mentioned. No text, no logos, no watermark";

/**
 * The text a character, creature, monument or place is drawn from. The user's own style and description lead; Kadra only adds
 * framing that cannot contradict them: a plain sheet (one figure, front view, neutral background) only when the entry is a
 * sheet, "draw it as a stylized character, not a photograph" only when the style does not ask for a photograph, and a note
 * about what the previous attempt got wrong when there is one. A refused request is never reworded to get past a filter.
 */
export function sheetPrompt(project: Pick<Project, "style">, character: Character, fix = ""): string {
  const rawStyle = character.style || project.style;
  const photo = wantsPhoto(rawStyle);
  const correction = fix.trim() ? ` The previous attempt was rejected for this reason, so fix exactly that: ${fix.trim().replace(/\s+/g, " ").slice(0, 300)}.` : "";
  const free = resolveFraming(character) === "free";
  if (character.kind === "place") {
    if (character.reference) {
      return `Turn the place in the reference photo into a location reference plate in this style: ${rawStyle}. ${character.appearance}. Keep its recognisable layout, architecture and landmarks${photo ? "" : ", drawn in the style, not as a photograph"}. ${PLATE_FRAMING}.${correction}`;
    }
    const style = rawStyle.slice(0, 200);
    const maxAppearance = Math.max(100, 800 - (`Location reference plate in this style: ${style}. . ${PLATE_FRAMING}.`).length);
    return `Location reference plate in this style: ${style}. ${character.appearance.slice(0, maxAppearance)}. ${PLATE_FRAMING}.${correction}`;
  }
  if (free) {
    if (character.reference) {
      return `Create an image in this style: ${rawStyle}. ${character.appearance}. Use the reference photo for the recognisable features of the people or places it shows (face shape, hairline, facial hair, headwear, landmarks)${photo ? "" : ", but render them in the style above rather than as a photograph"}. ${FREE_TAIL}.${correction}`;
    }
    const style = rawStyle.slice(0, 200);
    const maxAppearance = Math.max(100, 800 - (`Create an image in this style: ${style}. . ${FREE_TAIL}.`).length);
    return `Create an image in this style: ${style}. ${character.appearance.slice(0, maxAppearance)}. ${FREE_TAIL}.${correction}`;
  }
  if (character.reference) {
    return `Turn the person in the reference photo into a character reference sheet in this style: ${rawStyle}. ${character.appearance}. Keep their recognisable features (face shape, hairline, facial hair, headwear, age)${photo ? "" : " but draw them clearly as a stylized character, not as a photograph"}. ${SHEET_FRAMING}.${correction}`;
  }
  const style = rawStyle.slice(0, 200);
  const maxAppearance = Math.max(100, 800 - (`Character reference sheet in this style: ${style}. . ${SHEET_FRAMING}.`).length);
  return `Character reference sheet in this style: ${style}. ${character.appearance.slice(0, maxAppearance)}. ${SHEET_FRAMING}.${correction}`;
}

export function compileImagePrompt(project: PromptProject, scene: Scene, maxChars = 1_800): CompiledPrompt {
  const { people, places } = cast(project, scene);
  return fitPrompt([effectiveScenePrompt(scene), people && `Characters: ${people}`, feelings(project, scene), places && `Location: ${places}`, styleHint(project, scene), moodHint(project), briefHint(project)], FRAME_TAIL, maxChars);
}

export function imagePrompt(project: PromptProject, scene: Scene): string {
  return compileImagePrompt(project, scene, 6_000).prompt;
}

/**
 * Prompt for a scene frame guided by approved character sheets and location plates; with `continuity` the last
 * reference image is the previous shot of the same place.
 */
export function compileScenePrompt(project: PromptProject, scene: Scene, references: Character[], continuity = false, maxChars = 1_800): CompiledPrompt {
  const refs = references.map((item, index) => `Reference image ${index + 1} is the approved ${item.kind === "place" ? "location plate" : "character sheet"} for ${item.name}${item.appearance ? ` (${item.appearance})` : ""}`).join(". ");
  const hasPeople = references.some((item) => item.kind !== "place");
  const hasPlaces = references.some((item) => item.kind === "place");
  const keep = [hasPeople && "each character's exact face, headwear, hair and outfit from their reference sheet", hasPlaces && "the location's layout, architecture and colours from its plate"].filter(Boolean).join(" and ");
  return fitPrompt([
    refs,
    continuity && `Reference image ${references.length + 1} is the previous shot of this scene; keep the lighting, props and layout continuous with it`,
    `Draw this scene while keeping ${keep || "the references' look"}: ${effectiveScenePrompt(scene)}`,
    feelings(project, scene),
    styleHint(project, scene), moodHint(project), briefHint(project),
  ], FRAME_TAIL, maxChars);
}

export function sceneSheetPrompt(project: PromptProject, scene: Scene, references: Character[], continuity = false): string {
  return compileScenePrompt(project, scene, references, continuity, 6_000).prompt;
}

/** The edit model may only touch the masked area; everything else is pasted back from the original afterwards anyway. */
export function repairPrompt(instruction: string): string {
  return `Edit only the transparent (masked) area of this image: ${instruction.trim().slice(0, 600)}. Match the surrounding style, colours, lighting and line work exactly so the edit blends in. Leave everything outside the mask unchanged. No text, no watermark.`;
}

/** Turns the reviewer's located issues into one instruction for the edit model. */
export function issueInstruction(issues: ReviewIssue[]): string {
  return issues.map((issue) => issue.fix || issue.problem).filter(Boolean).join("; ").slice(0, 600);
}
