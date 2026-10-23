export type VisualStyleCategory = 'satire' | 'mountain' | 'graphic';

export interface ShotItem {
  id: string; // e.g. "0A", "1B"
  sceneId: string;
  sceneTitle: string;
  durationSec: number;
  timeRange: string;
  visualSummary: string;
  cameraMovement: string;
  aiPrompt: string;
  styleCategory: VisualStyleCategory;
  audioCues: string;
  voiceoverOrText?: string;
  generatedImageBase64?: string;
  generatedMimeType?: string;
  mediaId?: string;
  generatedVideoBase64?: string;
  generatedVideoMimeType?: string;
  generatedVideoBlobUrl?: string;
  videoMediaId?: string;
  generationStatus?: 'idle' | 'generating-image' | 'generating-video' | 'completed' | 'error';
  errorMessage?: string;
}

export interface SceneGroup {
  id: string;
  sceneNumber: string;
  title: string;
  theme: string;
  tempo: string;
  totalDuration: number;
  shots: ShotItem[];
}

export interface ArchivePhotoPreset {
  id: string;
  label: string;
  url: string;
  description: string;
}

export interface CharacterReference {
  name: string;
  role: string;
  description: string;
  stylePrompt: string;
  likenessKeywords?: string; // Specific facial features & anatomical descriptors
  referenceMediaId?: string;
  userReferenceMediaId?: string; // Real uploaded/selected photo from gallery
  userReferenceBase64?: string;
  userReferenceUrl?: string; // Direct previewable photo url
  archivePresets?: ArchivePhotoPreset[]; // Ready real historical photo portraits
  avatarBase64?: string;
  status?: 'idle' | 'generating' | 'completed' | 'error';
  errorMessage?: string;
}

export type PipelineStage = 'idle' | 'characters' | 'storyboard' | 'videos' | 'done' | 'paused';

export interface BatchPipelineStatus {
  stage: PipelineStage;
  currentIndex: number;
  totalItems: number;
  currentItemName: string;
  logs: string[];
}
