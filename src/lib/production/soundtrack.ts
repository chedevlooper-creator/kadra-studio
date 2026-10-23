import { randomUUID } from "node:crypto";
import { rm } from "node:fs/promises";
import path from "node:path";
import { mediaUrl, projectMediaDirectory } from "../media";
import type { ProjectRepository } from "../projects";
import type { Project, ProjectOutput, Soundtrack } from "../types";
import { AppError } from "../validation";
import { applySoundtrack } from "./ffmpeg";
import { narrationTracks } from "./narration";

/**
 * Saves new music settings. When a film already exists it is re-mixed right away (the picture is copied,
 * so this takes seconds); later productions pick the music up in their montage step.
 */
export async function changeSoundtrack(repository: Pick<ProjectRepository, "getProject" | "commitSoundtrack" | "mediaDirectory">, id: string, revision: number, music: Soundtrack | null): Promise<Project> {
  const project = await repository.getProject(id);
  if (project.revision !== revision) throw new AppError(409, "Proje başka bir işlemde değişti. Güncel projeyi yükleyip tekrar deneyin.");
  if (project.run?.status === "running") throw new AppError(409, "Önce devam eden üretimi durdurun.");
  const directory = projectMediaDirectory(repository.mediaDirectory, id);
  let output: ProjectOutput | undefined;
  if (project.output) {
    const file = `film-${project.output.runId.slice(0, 8)}-${randomUUID().slice(0, 6)}.mp4`;
    // The narration stays: it is mixed again from the cached voices under the new music.
    await applySoundtrack({ film: path.join(directory, project.output.url.split("/").pop()!), output: path.join(directory, file), duration: project.output.duration, music: music ? { file: path.join(directory, music.file), volume: music.volume, offset: music.offset } : null, voices: await narrationTracks(project, directory), voiceVolume: project.narration.volume });
    output = { ...project.output, url: mediaUrl(id, file), createdAt: new Date().toISOString() };
  }
  let updated: Project;
  try { updated = await repository.commitSoundtrack(id, revision, music, output); }
  catch (error) {
    if (output) await rm(path.join(directory, output.url.split("/").pop()!), { force: true });
    throw error;
  }
  if (output && project.output) await rm(path.join(directory, project.output.url.split("/").pop()!), { force: true });
  if (project.music && project.music.file !== music?.file) await rm(path.join(directory, project.music.file), { force: true });
  return updated;
}
