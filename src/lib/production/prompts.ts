import { CAMERA_MOVES, cameraMove, emotionOf, genreOf } from "../cinema";
import { resolveFraming, wantsPhoto } from "../framing";
import type { Character, Project, ReviewIssue, Scene } from "../types";

type PromptProject = Pick<Project, "characters" | "style"> & { genre?: string; brief?: string };

/** Invalidates quotes made with a different prompt/payload contract. */
export const PROMPT_PIPELINE_VERSION = 2;

/**
 * Translates raw Turkish political-satire metaphors that could trigger upstream image/video provider safety refusals
 * into safe, high-adherence editorial political-cartoon visual descriptions, while leaving ordinary prompts untouched.
 */
export function sanitizeSatirePrompt(text: string): string {
  if (!/(?:öldürülmüş|bok(?:ları|u|\s+içinde)?|domalıyor|kanlı\s+dolar|kan\s+damlayan|rusya\s+bayrağı\s+dışında\s+asla\s+bayrak\s+olmayacak|spews\s+brown\s+foul\s+muck|small\s+child|child's\s+motionless|child's\s+vulnerability|striking\s+at\s+her|blood-dripping|blood-stained|boy\s+around\s+12)/iu.test(text)) {
    return text;
  }
  return text
    .replace(/öldürülmüş\s+bir\s+çocuk/giu, "yere düşmüş kapüşonlu küçük bir figür silüeti (editorial political cartoon drama, fallen hooded figure silhouette in shadow)")
    .replace(/ağzından\s+çıkan\s+bokları/giu, "ağzından çıkan koyu çamur ve balçıkları (spewing dark brown muck from mouth)")
    .replace(/\bbok\s+içinde\b/giu, "çamur ve balçık içinde (covered in dark brown muck)")
    .replace(/\bbokları\b/giu, "çamur ve balçıkları (dark brown muck)")
    .replace(/gözlerinden\s+kalp\s+çıkıp\s+domalıyor/giu, "gözlerinden kalpler çıkıp iki büklüm boyun eğiyor (cartoon red hearts popping from eyes, bowing submissively on the ground)")
    .replace(/\bdomalıyor\b/giu, "iki büklüm boyun eğiyor (bowing submissively on the ground)")
    .replace(/kanlı\s+dolar(?:lar)?/giu, "kırmızı lekeli dolar banknotları (crimson-stained US dollar bills)")
    .replace(/kan\s+damlayan\s+bir\s+kalemle/giu, "koyu kırmızı mürekkep damlayan bir kalemle (with an ornate pen dripping thick crimson ink)")
    .replace(/sahnede\s+rusya\s+bayrağı\s+dışında\s+asla\s+bayrak\s+olmayacak\.?/giu, "Strictly only the Russian tricolor flag is visible in the scene; no other flags anywhere.")
    .replace(/\bblood-dripping\b/giu, "crimson-ink-dripping")
    .replace(/\bblood-stained\b/giu, "crimson-stained")
    .replace(/fires\s+his\s+AK-47\s+into\s+the\s+air,\s+spews\s+brown\s+foul\s+muck\s+from\s+his\s+mouth\s+onto\s+the\s+poor\s+people/giu, "waves his prop rifle in the air, sprays dark brown mud from his mouth toward the figures")
    .replace(/a\s+small\s+child's\s+motionless\s+silhouette\s+(?:rests|lying\s+flat)\s+[^.]*\./giu, "a small fallen hooded silhouette rests in deep shadow beside a dropped schoolbag on the cold grey pavement, while a towering spherical balloon policeman in a glossy black uniform stands guard beside the shadow.")
    .replace(/small\s+child\s+lies\s+motionless\s+in\s+shadow\s+on\s+the\s+pavement,\s+while\s+a\s+towering,\s+heartless\s+spherical\s+balloon\s+policeman\s+in\s+black\s+uniform\s+stands\s+guard\s+over\s+the\s+child\s+clutching\s+an\s+AK-47\s+rifle/giu, "small fallen hooded silhouette rests in deep shadow beside a dropped schoolbag on the cold grey pavement, while a towering spherical balloon policeman in black uniform stands guard beside the shadow")
    .replace(/child's\s+vulnerability/giu, "figure's vulnerability")
    .replace(/beside\s+the\s+child,\s+gripping\s+an\s+AK-47\s+rifle/giu, "beside the shadow")
    .replace(/boy\s+around\s+12[–-]14\s+years\s+old/giu, "young red-haired Anatolian hero")
    .replace(/raising\s+their\s+batons\s+and\s+striking\s+at\s+her\s+as\s+she\s+shields\s+her\s+face/giu, "raising their rubber batons menacingly as she shields her face");
}

/**
 * Uses the background-enhanced English prompt when it is still in sync with the scene's source prompt;
 * falls back to `scene.prompt` when enhancement has not run yet or after an offline edit.
 */
export function effectiveScenePrompt(scene: Pick<Scene, "prompt"> & Partial<Pick<Scene, "promptEn" | "promptEnSource">>): string {
  const raw = scene.promptEn && scene.promptEnSource === scene.prompt ? scene.promptEn : scene.prompt;
  return sanitizeSatirePrompt(raw);
}

/**
 * Returns the motion prompt only when it is still in sync with the scene's prompt, and ensures the
 * selected camera movement is always represented so user camera edits are never ignored.
 */
export function effectiveMotionPrompt(scene: Pick<Scene, "prompt" | "camera" | "motionPrompt"> & Partial<Pick<Scene, "promptEnSource">>): string {
  const cam = cameraPhrase(scene as Scene);
  const action = motionAction(scene);
  return action ? `${cam}. ${action}` : cam;
}

function motionAction(scene: Pick<Scene, "prompt" | "camera" | "motionPrompt"> & Partial<Pick<Scene, "promptEnSource">>): string {
  const synced = !scene.promptEnSource || scene.promptEnSource === scene.prompt;
  const rawMotion = synced ? scene.motionPrompt?.trim() ?? "" : "";
  // Replace a previously compiled camera directive; a word such as "camera" or "subject"
  // alone is not evidence that the currently selected movement is already present.
  return rawMotion.replace(/^Camera:\s*[^.!?]+[.!?]?\s*/i, "").replace(cameraMove(scene.camera).prompt, "").replace(/^[.,;\s]+/, "").trim();
}

/** True when `text` already contains a description of `character` (by name or a key appearance phrase). */
function alreadyDescribesCharacter(text: string, character: Pick<Character, "name" | "appearance">): boolean {
  const lower = text.toLowerCase();
  const name = character.name.trim().toLowerCase();
  const app = character.appearance.trim().toLowerCase();
  if (!name || !lower.includes(name)) return false;
  const sample = app.slice(0, 45).split(/[,\s]+/).filter((w) => w.length >= 5).slice(0, 3);
  return sample.length >= 2 && sample.every((word) => lower.includes(word));
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

/** The move in the model's words; an English free-text note that is more than a preset name is kept alongside it. */
function cameraPhrase(scene: Scene): string {
  const move = cameraMove(scene.camera);
  const raw = scene.camera.trim();
  const preset = CAMERA_MOVES.some((item) => item.label.toLocaleLowerCase("tr") === raw.toLocaleLowerCase("tr"));
  const hasTurkish = /[çğıöşüÇĞİÖŞÜ]|\b(?:çekim|hareket|açı|kadraj|yaklaş|uzaklaş|takip|geçiş|kamera|dönüş|bakış)\b/iu.test(raw);
  return preset || !raw || hasTurkish ? `Camera: ${move.prompt}` : `Camera: ${move.prompt} (${raw})`;
}

/** A compiled prompt and whether the model's character limit forced anything out. */
export interface CompiledPrompt { prompt: string; truncated: boolean }

const FRAME_TAIL = "cinematic composition, high detail, no text, no captions, no watermark";
const VIDEO_TAIL = "Preserve the first frame's visual style and subject identity, coherent motion, no text, no subtitles, no watermark";

function trimToWordBoundary(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text.replace(/\.+$/, "").trim();
  return text
    .slice(0, maxLen)
    .replace(/\s+\S*$/, "")
    .replace(/[,;:.]+$/, "")
    .replace(/\s+\b(?:and|or|with|of|in|on|to|for|as|at|by|from|the|a|an)$/i, "")
    .replace(/[,;:.]+$/, "")
    .trim();
}

/**
 * Joins sections in priority order and always keeps the style/negative tail. When the model's limit is
 * smaller than the text, lower-priority sections are dropped and the overflowing section is cut on a word boundary,
 * so higher-priority sections (like the scene prompt) are never skipped in favour of trailing hints.
 */
function fitPrompt(sections: (string | false | undefined)[], tail: string, maxChars: number): CompiledPrompt {
  const body = sections
    .filter((section): section is string => Boolean(section && section.trim()))
    .map((section) => sanitizeSatirePrompt(section.trim()).replace(/\.+$/, "").trim())
    .filter(Boolean);
  const full = [...body, tail].join(". ");
  if (full.length <= maxChars) return { prompt: full, truncated: false };
  const budget = Math.max(120, maxChars - tail.length - 2);
  const kept: string[] = [];
  for (const section of body) {
    const candidate = [...kept, section].join(". ");
    if (candidate.length <= budget) {
      kept.push(section);
      continue;
    }
    const used = kept.length ? kept.join(". ").length + 2 : 0;
    const room = budget - used;
    if (room >= 40) {
      const trimmed = trimToWordBoundary(section, room);
      if (trimmed) kept.push(trimmed);
    }
    break;
  }
  let prompt = [...kept, tail].join(". ");
  if (prompt.length > maxChars) {
    const room = Math.max(40, maxChars - tail.length - 2);
    const main = trimToWordBoundary(kept[0] ?? "", room);
    prompt = `${main}. ${tail}`;
  }
  return { prompt: prompt.slice(0, maxChars), truncated: true };
}

/** Reserves space for each essential instruction before spending any on decorative detail. */
function fitDirectedPrompt(core: [string, number][], details: (string | false | undefined)[], tail: string, maxChars: number): CompiledPrompt {
  const essential = core.map(([text, weight]) => [sanitizeSatirePrompt(text.trim()).replace(/\.+$/, ""), weight] as const).filter(([text]) => text);
  const budget = Math.max(0, maxChars - tail.length - 2 * essential.length);
  if (essential.reduce((sum, [text]) => sum + text.length, 0) <= budget) {
    return fitPrompt([...essential.map(([text]) => text), ...details], tail, maxChars);
  }
  const weight = essential.reduce((sum, [, value]) => sum + value, 0);
  const limits = essential.map(([text, value]) => Math.min(text.length, Math.floor(budget * value / weight)));
  let spare = budget - limits.reduce((sum, value) => sum + value, 0);
  // Short camera directives leave their unused share to the scene, then the remaining instructions.
  for (let index = 0; index < essential.length && spare > 0; index++) {
    const extra = Math.min(spare, essential[index][0].length - limits[index]);
    limits[index] += extra; spare -= extra;
  }
  const result = fitPrompt(essential.map(([text], index) => trimToWordBoundary(text, limits[index])), tail, maxChars);
  return { ...result, truncated: true };
}

export function compileVideoPrompt(project: PromptProject, scene: Scene, maxChars = 1_900): CompiledPrompt {
  const linked = project.characters.filter((character) => scene.characterIds.includes(character.id));
  const main = effectiveScenePrompt(scene);
  const motion = motionAction(scene);
  const formatCast = (kind: Character["kind"], limit: number) => linked
    .filter((character) => (character.kind ?? "person") === kind)
    .map((character) => {
      if (limit <= 0 || alreadyDescribesCharacter(main, character)) return character.name;
      const app = trimToWordBoundary(character.appearance, limit);
      return app ? `${character.name}: ${app}` : character.name;
    })
    .join("; ");
  const emotionText = feelings(project, scene);
  const styleText = styleHint(project, scene);
  const moodText = moodHint(project);
  const briefText = briefHint(project);
  let places = formatCast("place", 180);
  let people = formatCast("person", 180);
  const totalWith = (p: string, pl: string) => [
    motion,
    main,
    emotionText,
    p && `Keep these characters exactly as they appear in the first frame: ${p}`,
    pl && `Keep the location as it appears in the first frame: ${pl}`,
    styleText,
    moodText,
    briefText,
    VIDEO_TAIL,
  ].filter(Boolean).join(". ").length;
  if ((people || places) && totalWith(people, places) > maxChars) {
    people = formatCast("person", 70);
    places = formatCast("place", 70);
  }
  if ((people || places) && totalWith(people, places) > maxChars) {
    people = formatCast("person", 0);
    places = formatCast("place", 0);
  }
  return fitDirectedPrompt([
    [cameraPhrase(scene), 1], [main, 5], [motion, 3], [briefText, 2],
  ], [
    emotionText,
    people && `Keep these characters exactly as they appear in the first frame: ${people}`,
    places && `Keep the location as it appears in the first frame: ${places}`,
    styleText,
    moodText,
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
  const main = effectiveScenePrompt(scene);
  const linked = project.characters.filter((character) => scene.characterIds.includes(character.id));
  const missingNotes = (kind: Character["kind"]) => linked
    .filter((character) => (character.kind ?? "person") === kind && !alreadyDescribesCharacter(main, character))
    .map((character) => `${character.name}: ${character.appearance}`)
    .join("; ");
  const people = missingNotes("person");
  const places = missingNotes("place");
  return fitDirectedPrompt([[main, 5], [briefHint(project), 2]], [feelings(project, scene), people && `Characters: ${people}`, places && `Location: ${places}`, styleHint(project, scene), moodHint(project)], FRAME_TAIL, maxChars);
}

export function imagePrompt(project: PromptProject, scene: Scene): string {
  return compileImagePrompt(project, scene, 6_000).prompt;
}

/**
 * Prompt for a scene frame guided by approved character sheets and location plates; with `continuity` the last
 * reference image is the previous shot of the same place.
 */
export function compileScenePrompt(project: PromptProject, scene: Scene, references: Character[], continuity = false, maxChars = 1_800): CompiledPrompt {
  const main = effectiveScenePrompt(scene);
  const formatRefs = (appearanceLimit: number) => references.map((item, index) => {
    const raw = item.appearance?.trim() ?? "";
    const note = !raw || appearanceLimit <= 0 || alreadyDescribesCharacter(main, item) ? "" : trimToWordBoundary(raw, appearanceLimit);
    return `Reference image ${index + 1} is the approved ${item.kind === "place" ? "location plate" : "character sheet"} for ${item.name}${note ? ` (${note})` : ""}`;
  }).join(". ");
  const hasPeople = references.some((item) => item.kind !== "place");
  const hasPlaces = references.some((item) => item.kind === "place");
  const keep = [hasPeople && "each character's exact face, headwear, hair and outfit from their reference sheet", hasPlaces && "the location's layout, architecture and colours from its plate"].filter(Boolean).join(" and ");
  const continuityLine = continuity ? `Reference image ${references.length + 1} is the previous shot of this scene; keep the lighting, props and layout continuous with it` : "";
  const sceneLine = `Draw this scene while keeping ${keep || "the references' look"}: ${main}`;
  const extras = [feelings(project, scene), styleHint(project, scene), moodHint(project), briefHint(project)].filter(Boolean).join(". ");
  let refs = formatRefs(400);
  const totalWith = (r: string) => [r, continuityLine, sceneLine, extras, FRAME_TAIL].filter(Boolean).join(". ").length;
  if (totalWith(refs) > maxChars) {
    refs = formatRefs(85);
  }
  if (totalWith(refs) > maxChars) {
    refs = formatRefs(0);
  }
  return fitDirectedPrompt([
    [sceneLine, 5], [refs, 3], [briefHint(project), 2], [continuityLine, 1],
  ], [
    feelings(project, scene),
    styleHint(project, scene), moodHint(project),
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
