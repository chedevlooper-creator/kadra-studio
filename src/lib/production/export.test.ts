import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EXPORT_FORMATS } from "../formats";
import { concatClips, exportFilm, findFfmpeg, inspectVideo, probeImage, renderImageClip } from "./ffmpeg";

test("a finished film is re-framed to each screen without touching its sound, in both modes", { timeout: 180_000 }, async (t) => {
  const ffmpeg = await findFfmpeg();
  if (!ffmpeg) return t.skip("FFmpeg yok");
  const directory = await mkdtemp(path.join(os.tmpdir(), "kadra-export-"));
  t.after(() => rm(directory, { recursive: true, force: true }));
  const clip = path.join(directory, "clip.mp4");
  await renderImageClip({ image: path.join(process.cwd(), "public/images/mountains.jpg"), output: clip, duration: 2, aspectRatio: "16:9", camera: "Sabit kadraj" });
  const film = path.join(directory, "film.mp4");
  await concatClips({ clips: [clip], output: film });

  for (const format of EXPORT_FORMATS) for (const mode of ["fit", "fill"] as const) {
    const output = path.join(directory, `${format.id}-${mode}.mp4`);
    await exportFilm({ input: film, output, width: format.width, height: format.height, mode });
    assert.deepEqual(await probeImage(output), { width: format.width, height: format.height }, `${format.id} ${mode}`);
    assert.ok(Math.abs((await inspectVideo(output)) - 2) < 0.3, "the length is unchanged");
    const audio = spawnSync(ffmpeg, ["-hide_banner", "-i", output], { encoding: "utf8" }).stderr;
    assert.match(audio, /Audio: aac/, "the sound track is kept");
  }

  // "fit" keeps the whole picture: the centre of a vertical frame shows the film, its top shows the blurred copy.
  const sample = (file: string, x: number, y: number) => [...spawnSync(ffmpeg, ["-hide_banner", "-v", "error", "-ss", "0.5", "-i", file, "-vf", `format=rgb24,crop=1:1:${x}:${y}`, "-frames:v", "1", "-f", "rawvideo", "-pix_fmt", "rgb24", "-"]).stdout];
  const fit = path.join(directory, "vertical-fit.mp4");
  const topLeft = sample(fit, 10, 10);
  assert.equal(topLeft.length, 3, "the blurred fill covers the whole canvas, no black bars");
  assert.ok(topLeft.some((value) => value > 20), `the top of the vertical frame is not black (${topLeft})`);
});
