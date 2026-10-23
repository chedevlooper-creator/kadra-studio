import React, { useState, useMemo, useRef, useCallback } from 'react';
import { STORYBOARD_SHOTS, CHARACTER_SHEET_PRESETS } from './constants';
import { ShotItem, CharacterReference, PipelineStage } from './types';
import { ShotCard } from './components/ShotCard';
import { ShotDetailModal } from './components/ShotDetailModal';
import { CharacterSheetModal } from './components/CharacterSheetModal';
import { MusicDirectorView } from './components/MusicDirectorView';
import { VoiceoverStudio } from './components/VoiceoverStudio';
import { AutoPipelineBar } from './components/AutoPipelineBar';
import { Flow } from 'flow-sdk';

// Utility helper to prevent API hangs with a hard timeout
function withTimeout<T>(promise: Promise<T>, ms = 35000, errorMsg = 'İstek zaman aşımına uğradı'): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(errorMsg)), ms);
    promise
      .then((res) => {
        clearTimeout(timer);
        resolve(res);
      })
      .catch((err) => {
        clearTimeout(timer);
        reject(err);
      });
  });
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

export default function App() {
  const [shots, setShots] = useState<ShotItem[]>(STORYBOARD_SHOTS);
  const [characters, setCharacters] = useState<CharacterReference[]>(CHARACTER_SHEET_PRESETS);
  const [selectedShot, setSelectedShot] = useState<ShotItem | null>(null);
  const [activeTab, setActiveTab] = useState<'storyboard' | 'characters' | 'music' | 'voiceover'>('storyboard');
  const [sceneFilter, setSceneFilter] = useState<string>('ALL');
  const [aspectRatio, setAspectRatio] = useState<'16:9' | '9:16'>('16:9');
  const [searchQuery, setSearchQuery] = useState('');
  const [isExporting, setIsExporting] = useState(false);
  const [showCharactersModal, setShowCharactersModal] = useState(false);
  const [onlyShowVideos, setOnlyShowVideos] = useState(false);
  const [imageModel, setImageModel] = useState<string>('🍌 Nano Banana Pro');

  // Pipeline automated execution state
  const [pipelineStage, setPipelineStage] = useState<PipelineStage>('idle');
  const [pipelineCurrentIndex, setPipelineCurrentIndex] = useState<number>(0);
  const [pipelineTotalCount, setPipelineTotalCount] = useState<number>(0);
  const [pipelineCurrentName, setPipelineCurrentName] = useState<string>('');
  const isCancelledRef = useRef<boolean>(false);

  // Keep a ref to latest characters so batches always have immediate access to generated mediaIds
  const charactersRef = useRef<CharacterReference[]>(characters);
  charactersRef.current = characters;

  // Keep a ref to latest shots for video batch processing
  const shotsRef = useRef<ShotItem[]>(shots);
  shotsRef.current = shots;

  // Character mapping helper for storyboard shots - prioritize userReferenceMediaId over generated AI avatar
  const getLinkedCharactersForShot = useCallback((shot: ShotItem, currentCharsList?: CharacterReference[]): CharacterReference[] => {
    const textToMatch = `${shot.visualSummary} ${shot.aiPrompt} ${shot.sceneTitle}`.toLowerCase();
    const linked: CharacterReference[] = [];
    const sourceChars = currentCharsList || charactersRef.current;

    sourceChars.forEach((char) => {
      const name = char.name.toLowerCase();
      if (name.includes('dudayev') && (textToMatch.includes('dudayev') || textToMatch.includes('gehi-çu') || shot.sceneId.includes('SAHNE 0'))) {
        linked.push(char);
      } else if (name.includes('mashadov') && (textToMatch.includes('mashadov') || textToMatch.includes('maskhadov'))) {
        linked.push(char);
      } else if (name.includes('şamil') && (textToMatch.includes('şamil') || textToMatch.includes('mansur') || textToMatch.includes('baysungur'))) {
        linked.push(char);
      } else if (name.includes('putin') && textToMatch.includes('putin')) {
        linked.push(char);
      } else if (name.includes('ahmad kadirov') && (textToMatch.includes('ahmad') || textToMatch.includes('akhmad') || shot.sceneId.includes('SAHNE 1') || shot.sceneId.includes('SAHNE 2'))) {
        linked.push(char);
      } else if (name.includes('ramzan kadirov') && (textToMatch.includes('ramzan') || shot.sceneId.includes('SAHNE 4') || shot.sceneId.includes('SAHNE 5') || shot.sceneId.includes('SAHNE 7'))) {
        linked.push(char);
      } else if (name.includes('emir şahin') && (textToMatch.includes('emir') || textToMatch.includes('şahin') || textToMatch.includes('fes') || shot.sceneId.includes('SAHNE 8') || shot.sceneId.includes('SAHNE 9'))) {
        linked.push(char);
      } else if (name.includes('medet önlü') && (textToMatch.includes('medet') || textToMatch.includes('önlü') || shot.sceneId.includes('SAHNE 9'))) {
        linked.push(char);
      } else if (name.includes('kurt') && (textToMatch.includes('kurt') || textToMatch.includes('wolf') || shot.sceneId.includes('SAHNE 11'))) {
        linked.push(char);
      }
    });

    return linked;
  }, []);

  // Set real user photo from media gallery or historical preset
  const handleSetUserReferenceMedia = (index: number, mediaId: string, base64: string, previewUrl?: string) => {
    setCharacters((prev) =>
      prev.map((c, i) =>
        i === index
          ? {
              ...c,
              userReferenceMediaId: mediaId,
              userReferenceBase64: base64,
              userReferenceUrl: previewUrl,
              referenceMediaId: mediaId, // prioritize immediately for generation
            }
          : c
      )
    );
  };

  // Update prompt directly
  const handleUpdateCharacterPrompt = (index: number, newPrompt: string) => {
    setCharacters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, stylePrompt: newPrompt } : c))
    );
  };

  // Single character generator with timeout protection and reference photo support
  const handleGenerateSingleCharacter = async (index: number) => {
    const char = characters[index];

    setCharacters((prev) =>
      prev.map((c, i) => (i === index ? { ...c, status: 'generating', errorMessage: undefined } : c))
    );

    try {
      const options: Parameters<typeof Flow.generate.image>[0] = {
        prompt: `${char.stylePrompt}, 1:1 square portrait, high fidelity 3D caricature model sheet, clean studio background, sharp focus, iconic recognizable likeness`,
        modelDisplayName: imageModel,
        aspectRatio: '1:1',
      };

      // If user uploaded or selected a real photo, supply it as reference
      if (char.userReferenceMediaId) {
        options.referenceImageMediaIds = [char.userReferenceMediaId];
      }

      const result = await withTimeout(
        Flow.generate.image(options),
        35000,
        'Görsel üretimi zaman aşımına uğradı'
      );

      setCharacters((prev) =>
        prev.map((c, i) =>
          i === index
            ? {
                ...c,
                avatarBase64: result.base64,
                referenceMediaId: char.userReferenceMediaId || result.mediaId,
                status: 'completed',
                errorMessage: undefined,
              }
            : c
        )
      );

      return result.mediaId;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Karakter görseli üretilemedi';
      setCharacters((prev) =>
        prev.map((c, i) => (i === index ? { ...c, status: 'error', errorMessage: msg } : c))
      );
    }
  };

  // 1. Resilient Sequential Character Generation Batch
  const runCharacterBatch = async (isStandalone = true): Promise<CharacterReference[]> => {
    isCancelledRef.current = false;
    setPipelineStage('characters');
    setPipelineTotalCount(characters.length);

    let currentCharsState = [...charactersRef.current];

    for (let i = 0; i < currentCharsState.length; i++) {
      if (isCancelledRef.current) break;

      const char = currentCharsState[i];
      setPipelineCurrentIndex(i);
      setPipelineCurrentName(char.name);

      setCharacters((prev) =>
        prev.map((c, idx) => (idx === i ? { ...c, status: 'generating', errorMessage: undefined } : c))
      );

      try {
        const options: Parameters<typeof Flow.generate.image>[0] = {
          prompt: `${char.stylePrompt}, 1:1 square portrait, high fidelity 3D caricature model sheet, clean studio background, sharp focus, iconic recognizable likeness`,
          modelDisplayName: imageModel,
          aspectRatio: '1:1',
        };

        if (char.userReferenceMediaId) {
          options.referenceImageMediaIds = [char.userReferenceMediaId];
        }

        const result = await withTimeout(
          Flow.generate.image(options),
          35000,
          `${char.name} için üretim 35 saniyede yanıt vermedi`
        );

        currentCharsState = currentCharsState.map((c, idx) =>
          idx === i
            ? {
                ...c,
                avatarBase64: result.base64,
                referenceMediaId: char.userReferenceMediaId || result.mediaId,
                status: 'completed',
                errorMessage: undefined,
              }
            : c
        );

        setCharacters([...currentCharsState]);
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : 'Sunucu yanıt vermedi';
        console.warn(`Character generation error for ${char.name}:`, errorMsg);

        currentCharsState = currentCharsState.map((c, idx) =>
          idx === i ? { ...c, status: 'error', errorMessage: errorMsg } : c
        );
        setCharacters([...currentCharsState]);
      }

      await sleep(400);
    }

    if (isStandalone && !isCancelledRef.current) {
      setPipelineStage('idle');
    }

    return currentCharsState;
  };

  // 2. Sequential Storyboard Scenes Batch with Cooldown & Timeout Protection
  const runStoryboardBatch = async (latestChars?: CharacterReference[], isStandalone = true): Promise<ShotItem[]> => {
    if (isCancelledRef.current) return shotsRef.current;

    const charsToUse = latestChars && latestChars.length > 0 ? latestChars : charactersRef.current;

    setPipelineStage('storyboard');
    setPipelineTotalCount(shots.length);

    let currentShotsState = [...shotsRef.current];

    for (let i = 0; i < currentShotsState.length; i++) {
      if (isCancelledRef.current) break;

      const currentShot = currentShotsState[i];
      setPipelineCurrentIndex(i);
      setPipelineCurrentName(`Shot ${currentShot.id}: ${currentShot.sceneTitle}`);

      setShots((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, generationStatus: 'generating-image', errorMessage: undefined } : s))
      );

      const matchedChars = getLinkedCharactersForShot(currentShot, charsToUse);
      // Prioritize user reference photo if available, otherwise generated avatar
      const refMediaIds = matchedChars
        .map((c) => {
          const liveChar = charsToUse.find((lc) => lc.name === c.name);
          return liveChar?.userReferenceMediaId || liveChar?.referenceMediaId;
        })
        .filter((id): id is string => Boolean(id));

      try {
        const imgOptions: Parameters<typeof Flow.generate.image>[0] = {
          prompt: currentShot.aiPrompt,
          modelDisplayName: imageModel,
          aspectRatio: aspectRatio,
        };

        if (refMediaIds.length > 0) {
          imgOptions.referenceImageMediaIds = refMediaIds.slice(0, 10);
        }

        const result = await withTimeout(
          Flow.generate.image(imgOptions),
          35000,
          `Shot ${currentShot.id} görsel üretimi zaman aşımına uğradı`
        );

        currentShotsState = currentShotsState.map((s, idx) =>
          idx === i
            ? {
                ...s,
                generatedImageBase64: result.base64,
                generatedMimeType: result.mimeType,
                mediaId: result.mediaId,
                generationStatus: 'completed',
                errorMessage: undefined,
              }
            : s
        );

        setShots([...currentShotsState]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Görsel üretilemedi';
        console.warn(`Shot image generation failed for ${currentShot.id}:`, msg);

        currentShotsState = currentShotsState.map((s, idx) =>
          idx === i ? { ...s, generationStatus: 'error', errorMessage: msg } : s
        );
        setShots([...currentShotsState]);
      }

      await sleep(300);
    }

    if (isStandalone && !isCancelledRef.current) {
      setPipelineStage('idle');
    }

    return currentShotsState;
  };

  // 3. Sequential Video Generation Batch with Automatic Failover
  const runVideoBatch = async (latestShots?: ShotItem[]) => {
    if (isCancelledRef.current) return;

    const shotsToProcess = latestShots && latestShots.length > 0 ? latestShots : shotsRef.current;

    setPipelineStage('videos');
    setPipelineTotalCount(shotsToProcess.length);

    let currentShotsState = [...shotsToProcess];

    for (let i = 0; i < currentShotsState.length; i++) {
      if (isCancelledRef.current) break;

      const currentShot = currentShotsState[i];
      setPipelineCurrentIndex(i);
      setPipelineCurrentName(`Shot ${currentShot.id}: Video İşleniyor`);

      setShots((prev) =>
        prev.map((s, idx) => (idx === i ? { ...s, generationStatus: 'generating-video', errorMessage: undefined } : s))
      );

      const safePrompt = `${currentShot.visualSummary}. Camera: ${currentShot.cameraMovement}. High cinematic quality.`;

      try {
        let result;
        try {
          const vidOptions: Parameters<typeof Flow.generate.video>[0] = {
            prompt: safePrompt,
            modelDisplayName: 'Omni 1.1 Flash',
            aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
            durationSeconds: 4,
            resolution: '720p',
          };

          if (currentShot.mediaId) {
            vidOptions.firstFrameImageMediaId = currentShot.mediaId;
          }

          result = await withTimeout(Flow.generate.video(vidOptions), 120000, 'Omni video zaman aşımına uğradı');
        } catch {
          const fallbackOptions: Parameters<typeof Flow.generate.video>[0] = {
            prompt: safePrompt,
            modelDisplayName: 'Veo 3.1 - Lite',
            aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
            durationSeconds: 4,
            resolution: '720p',
          };

          if (currentShot.mediaId) {
            fallbackOptions.firstFrameImageMediaId = currentShot.mediaId;
          }

          result = await withTimeout(Flow.generate.video(fallbackOptions), 120000, 'Veo video zaman aşımına uğradı');
        }

        const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
        const blob = new Blob([bytes], { type: result.mimeType || 'video/mp4' });
        const blobUrl = URL.createObjectURL(blob);

        currentShotsState = currentShotsState.map((s, idx) =>
          idx === i
            ? {
                ...s,
                generatedVideoBase64: result.base64,
                generatedVideoMimeType: result.mimeType || 'video/mp4',
                videoMediaId: result.mediaId,
                generatedVideoBlobUrl: blobUrl,
                generationStatus: 'completed',
                errorMessage: undefined,
              }
            : s
        );

        setShots([...currentShotsState]);
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Video servisi yoğun';
        console.warn(`Video generation failed for shot ${currentShot.id}:`, msg);

        currentShotsState = currentShotsState.map((s, idx) =>
          idx === i ? { ...s, generationStatus: 'error', errorMessage: msg } : s
        );
        setShots([...currentShotsState]);
      }

      await sleep(500);
    }

    setPipelineStage('idle');
  };

  // Full 1-Click End-to-End Pipeline
  const handleStartFullPipeline = async () => {
    isCancelledRef.current = false;
    try {
      const latestChars = await runCharacterBatch(false);

      if (!isCancelledRef.current) {
        const latestShots = await runStoryboardBatch(latestChars, false);

        if (!isCancelledRef.current) {
          await runVideoBatch(latestShots);
        }
      }

      if (!isCancelledRef.current) {
        setPipelineStage('done');
        setTimeout(() => setPipelineStage('idle'), 4000);
      }
    } catch (err) {
      console.error('Pipeline error:', err);
      setPipelineStage('idle');
    }
  };

  const handlePausePipeline = () => {
    isCancelledRef.current = true;
    setPipelineStage('paused');
    setTimeout(() => setPipelineStage('idle'), 1200);
  };

  // Scene unique list
  const sceneList = useMemo(() => {
    const list = Array.from(new Set(shots.map((s) => s.sceneId)));
    return ['ALL', ...list];
  }, [shots]);

  // Filtered shots
  const filteredShots = useMemo(() => {
    return shots.filter((s) => {
      const matchScene = sceneFilter === 'ALL' || s.sceneId === sceneFilter;
      const matchVideoFilter = !onlyShowVideos || Boolean(s.generatedVideoBlobUrl);
      const matchSearch =
        searchQuery === '' ||
        s.id.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.visualSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.aiPrompt.toLowerCase().includes(searchQuery.toLowerCase()) ||
        s.sceneTitle.toLowerCase().includes(searchQuery.toLowerCase());
      return matchScene && matchSearch && matchVideoFilter;
    });
  }, [shots, sceneFilter, searchQuery, onlyShowVideos]);

  // Update shot with generated image
  const handleShotUpdated = (shotId: string, base64: string, mimeType: string, mediaId: string) => {
    setShots((prev) =>
      prev.map((s) =>
        s.id === shotId
          ? {
              ...s,
              generatedImageBase64: base64,
              generatedMimeType: mimeType,
              mediaId,
              generationStatus: 'completed',
              errorMessage: undefined,
            }
          : s
      )
    );

    setSelectedShot((current) =>
      current && current.id === shotId
        ? {
            ...current,
            generatedImageBase64: base64,
            generatedMimeType: mimeType,
            mediaId,
            generationStatus: 'completed',
            errorMessage: undefined,
          }
        : current
    );
  };

  // Update shot with generated video
  const handleVideoUpdated = (
    shotId: string,
    base64: string,
    mimeType: string,
    videoMediaId: string,
    blobUrl: string
  ) => {
    setShots((prev) =>
      prev.map((s) =>
        s.id === shotId
          ? {
              ...s,
              generatedVideoBase64: base64,
              generatedVideoMimeType: mimeType,
              videoMediaId,
              generatedVideoBlobUrl: blobUrl,
              generationStatus: 'completed',
              errorMessage: undefined,
            }
          : s
      )
    );

    setSelectedShot((current) =>
      current && current.id === shotId
        ? {
            ...current,
            generatedVideoBase64: base64,
            generatedVideoMimeType: mimeType,
            videoMediaId,
            generatedVideoBlobUrl: blobUrl,
            generationStatus: 'completed',
            errorMessage: undefined,
          }
        : current
    );
  };

  // Full Storyboard CSV / JSON export
  const handleExportFullStoryboard = async (format: 'json' | 'csv') => {
    setIsExporting(true);
    try {
      if (format === 'json') {
        const json = JSON.stringify(
          shots.map((s) => ({
            id: s.id,
            sceneId: s.sceneId,
            sceneTitle: s.sceneTitle,
            durationSec: s.durationSec,
            timeRange: s.timeRange,
            visualSummary: s.visualSummary,
            cameraMovement: s.cameraMovement,
            aiPrompt: s.aiPrompt,
            audioCues: s.audioCues,
            voiceoverOrText: s.voiceoverOrText,
            hasImage: Boolean(s.generatedImageBase64),
            hasVideo: Boolean(s.generatedVideoBlobUrl),
          })),
          null,
          2
        );
        const bytes = new TextEncoder().encode(json);
        const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
        await Flow.download({
          base64,
          mimeType: 'application/json',
          filename: 'balonlar_ve_daglar_storyboard.json',
        });
      } else {
        const headers = [
          'Shot ID',
          'Scene',
          'Duration',
          'Timecode',
          'Camera',
          'Visual',
          'Prompt',
          'Audio',
          'Text',
          'Image Rendered',
          'Video Rendered',
        ];
        const rows = shots.map((s) => [
          `"${s.id}"`,
          `"${s.sceneTitle}"`,
          `"${s.durationSec}s"`,
          `"${s.timeRange}"`,
          `"${s.cameraMovement.replace(/"/g, '""')}"`,
          `"${s.visualSummary.replace(/"/g, '""')}"`,
          `"${s.aiPrompt.replace(/"/g, '""')}"`,
          `"${s.audioCues.replace(/"/g, '""')}"`,
          `"${(s.voiceoverOrText || '').replace(/"/g, '""')}"`,
          `"${s.generatedImageBase64 ? 'YES' : 'NO'}"`,
          `"${s.generatedVideoBlobUrl ? 'YES' : 'NO'}"`,
        ]);
        const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
        const bytes = new TextEncoder().encode(csvContent);
        const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
        await Flow.download({
          base64,
          mimeType: 'text/csv',
          filename: 'balonlar_ve_daglar_storyboard.csv',
        });
      }
    } catch {
      // Handled
    } finally {
      setIsExporting(false);
    }
  };

  const characterDoneCount = characters.filter((c) => c.avatarBase64 || c.userReferenceMediaId).length;
  const generatedCount = shots.filter((s) => s.generatedImageBase64).length;
  const generatedVideoCount = shots.filter((s) => s.generatedVideoBlobUrl).length;

  return (
    <div className="min-h-full w-full bg-[#0c0b12] text-slate-100 flex flex-col font-sans">
      {/* Top Bar Controls */}
      <header className="sticky top-0 z-30 bg-[#12101b]/95 backdrop-blur-md border-b border-[#242036] px-4 md:px-8 py-3.5 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-amber-500 to-rose-500 flex items-center justify-center shadow-lg shadow-amber-500/20 text-slate-950 font-black">
            <span className="material-symbols-outlined text-2xl">movie_filter</span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-white font-black text-base md:text-lg tracking-tight">
                BALONLAR VE DAĞLAR
              </span>
              <span className="text-[10px] font-bold font-mono px-2 py-0.5 rounded-full bg-amber-400/10 text-amber-300 border border-amber-400/20">
                31 Shot · 9 Karakter · 2:57
              </span>
            </div>
            <p className="text-xs text-slate-400 hidden sm:block">
              3D Karikatür Politik Hiciv & Kafkas Anıt Dağları Otomatik Prodüksiyon Fabrikası
            </p>
          </div>
        </div>

        {/* Global Action Tools */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Aspect Ratio Toggle */}
          <div className="flex items-center bg-[#1a1728] border border-[#2e2846] rounded-xl p-0.5 text-xs font-semibold">
            <button
              onClick={() => setAspectRatio('16:9')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                aspectRatio === '16:9' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              16:9 (Yatay)
            </button>
            <button
              onClick={() => setAspectRatio('9:16')}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                aspectRatio === '9:16' ? 'bg-amber-400 text-slate-950 shadow' : 'text-slate-400 hover:text-white'
              }`}
            >
              9:16 (Reels/TikTok)
            </button>
          </div>

          <button
            onClick={() => setShowCharactersModal(true)}
            className="px-3 py-1.5 rounded-xl bg-[#242036] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold flex items-center gap-1.5 transition-colors border border-[#373152]"
          >
            <span className="material-symbols-outlined text-sm text-amber-400">face</span>
            <span>Karakterler & Benzerlik ({characterDoneCount}/{characters.length})</span>
          </button>

          <div className="flex items-center gap-1">
            <button
              onClick={() => handleExportFullStoryboard('csv')}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-xl bg-[#242036] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-[#373152]"
              title="CSV olarak dışa aktar"
            >
              <span className="material-symbols-outlined text-sm">table_view</span>
              <span>CSV</span>
            </button>
            <button
              onClick={() => handleExportFullStoryboard('json')}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-xl bg-[#242036] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold flex items-center gap-1 transition-colors border border-[#373152]"
              title="JSON olarak dışa aktar"
            >
              <span className="material-symbols-outlined text-sm">code</span>
              <span>JSON</span>
            </button>
          </div>
        </div>
      </header>

      {/* Automated Pipeline Bar */}
      <AutoPipelineBar
        pipelineStage={pipelineStage}
        currentStepIndex={pipelineCurrentIndex}
        totalStepItems={pipelineTotalCount}
        currentStepName={pipelineCurrentName}
        characterCount={characters.length}
        characterDoneCount={characterDoneCount}
        shotImageCount={generatedCount}
        shotVideoCount={generatedVideoCount}
        totalShots={shots.length}
        onStartFullPipeline={handleStartFullPipeline}
        onStartCharacterBatch={() => runCharacterBatch(true)}
        onStartStoryboardBatch={() => runStoryboardBatch(characters, true)}
        onStartVideoBatch={() => runVideoBatch()}
        onPausePipeline={handlePausePipeline}
        onOpenCharacterModal={() => setShowCharactersModal(true)}
      />

      {/* Navigation Sub-bar */}
      <div className="bg-[#100e18] border-b border-[#221e33] px-4 md:px-8 py-2.5 flex items-center justify-between gap-4 overflow-x-auto">
        <div className="flex items-center gap-1">
          <button
            onClick={() => setActiveTab('storyboard')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'storyboard'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#1c192b]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">grid_view</span>
            <span>Storyboard ({shots.length})</span>
          </button>

          <button
            onClick={() => setActiveTab('music')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'music'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#1c192b]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">graphic_eq</span>
            <span>Müzik & Ses Miksajı</span>
          </button>

          <button
            onClick={() => setActiveTab('voiceover')}
            className={`px-3.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all ${
              activeTab === 'voiceover'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white hover:bg-[#1c192b]'
            }`}
          >
            <span className="material-symbols-outlined text-sm">mic</span>
            <span>Dış Ses Stüdyosu</span>
          </button>
        </div>

        {/* Progress Tracker */}
        <div className="flex items-center gap-4 shrink-0 text-xs text-slate-400">
          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-amber-400" />
            <span>Karakterler:</span>
            <span className="font-mono font-bold text-amber-400">
              {characterDoneCount}/{characters.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-cyan-400" />
            <span>Görseller:</span>
            <span className="font-mono font-bold text-cyan-400">
              {generatedCount}/{shots.length}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="w-2 h-2 rounded-full bg-purple-400" />
            <span>Videolar:</span>
            <span className="font-mono font-bold text-purple-400">
              {generatedVideoCount}/{shots.length}
            </span>
          </div>
        </div>
      </div>

      {/* Main Workspace Body */}
      <main className="flex-1 p-4 md:p-8 space-y-6">
        {activeTab === 'storyboard' && (
          <>
            {/* Filter & Search Bar */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-[#14121e] p-3 rounded-2xl border border-[#27233a]">
              {/* Scene Pills */}
              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
                {sceneList.map((scene) => (
                  <button
                    key={scene}
                    onClick={() => setSceneFilter(scene)}
                    className={`px-3 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${
                      sceneFilter === scene
                        ? 'bg-[#2b2742] text-amber-300 border border-amber-400/30'
                        : 'text-slate-400 hover:text-slate-200 hover:bg-[#1e1a2d]'
                    }`}
                  >
                    {scene === 'ALL' ? 'Tüm Sahneler (31)' : scene}
                  </button>
                ))}
              </div>

              {/* Video toggle & Search */}
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setOnlyShowVideos((prev) => !prev)}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1 border transition-all ${
                    onlyShowVideos
                      ? 'bg-purple-600/30 text-purple-300 border-purple-500/50'
                      : 'bg-[#1b172a] text-slate-400 border-[#2e2846] hover:text-white'
                  }`}
                  title="Sadece video üretilen shotları göster"
                >
                  <span className="material-symbols-outlined text-sm">movie</span>
                  <span>Sadece Videolar ({generatedVideoCount})</span>
                </button>

                <div className="relative min-w-[200px]">
                  <span className="material-symbols-outlined absolute left-3 top-2.5 text-slate-500 text-sm">
                    search
                  </span>
                  <input
                    type="text"
                    placeholder="Shot veya sahne ara..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-[#0c0a13] border border-[#29243c] rounded-xl pl-9 pr-3 py-1.5 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-amber-400/50"
                  />
                </div>
              </div>
            </div>

            {/* Shots Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
              {filteredShots.map((shot) => (
                <ShotCard
                  key={shot.id}
                  shot={shot}
                  aspectRatio={aspectRatio}
                  onImageGenerated={handleShotUpdated}
                  onVideoGenerated={handleVideoUpdated}
                  onSelectForPreview={(s) => setSelectedShot(s)}
                  isSelected={selectedShot?.id === shot.id}
                  linkedCharacters={getLinkedCharactersForShot(shot)}
                />
              ))}
            </div>

            {filteredShots.length === 0 && (
              <div className="text-center py-16 space-y-3">
                <span className="material-symbols-outlined text-4xl text-slate-600">search_off</span>
                <p className="text-sm text-slate-400">Aramanıza uygun shot bulunamadı.</p>
              </div>
            )}
          </>
        )}

        {activeTab === 'music' && <MusicDirectorView />}
        {activeTab === 'voiceover' && <VoiceoverStudio />}
      </main>

      {/* Modal Inspector */}
      {selectedShot && (
        <ShotDetailModal
          shot={selectedShot}
          aspectRatio={aspectRatio}
          onClose={() => setSelectedShot(null)}
          onShotUpdated={handleShotUpdated}
          onVideoUpdated={handleVideoUpdated}
        />
      )}

      {/* Character Sheets Bank */}
      {showCharactersModal && (
        <CharacterSheetModal
          characters={characters}
          onGenerateSingle={handleGenerateSingleCharacter}
          onGenerateAll={() => runCharacterBatch(true)}
          onStop={handlePausePipeline}
          onClose={() => setShowCharactersModal(false)}
          onUpdateCharacterPrompt={handleUpdateCharacterPrompt}
          onSetUserReferenceMedia={handleSetUserReferenceMedia}
          isBatchRunning={pipelineStage === 'characters'}
          selectedModel={imageModel}
          onSelectModel={setImageModel}
        />
      )}
    </div>
  );
}
