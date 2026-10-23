import React, { useState } from 'react';
import { ShotItem, CharacterReference } from '../types';
import { Flow } from 'flow-sdk';

interface ShotCardProps {
  shot: ShotItem;
  aspectRatio: '16:9' | '9:16';
  onImageGenerated: (shotId: string, base64: string, mimeType: string, mediaId: string) => void;
  onVideoGenerated: (shotId: string, base64: string, mimeType: string, mediaId: string, blobUrl: string) => void;
  onSelectForPreview: (shot: ShotItem) => void;
  isSelected: boolean;
  linkedCharacters?: CharacterReference[];
}

export const ShotCard: React.FC<ShotCardProps> = ({
  shot,
  aspectRatio,
  onImageGenerated,
  onVideoGenerated,
  onSelectForPreview,
  isSelected,
  linkedCharacters = [],
}) => {
  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isGeneratingVid, setIsGeneratingVid] = useState(false);
  const [copyToast, setCopyToast] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleCopyPrompt = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(shot.aiPrompt);
      setCopyToast(true);
      setTimeout(() => setCopyToast(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleGenerateFrame = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingImg(true);
    setErrorMessage(null);

    try {
      const refMediaIds = linkedCharacters
        .map((c) => c.referenceMediaId)
        .filter((id): id is string => Boolean(id));

      const imgOptions: Parameters<typeof Flow.generate.image>[0] = {
        prompt: shot.aiPrompt,
        modelDisplayName: '🍌 Nano Banana Pro',
        aspectRatio: aspectRatio,
      };

      if (refMediaIds.length > 0) {
        imgOptions.referenceImageMediaIds = refMediaIds.slice(0, 10);
      }

      const result = await Flow.generate.image(imgOptions);

      onImageGenerated(shot.id, result.base64, result.mimeType, result.mediaId);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Görsel üretilemedi';
      setErrorMessage(msg);
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleGenerateVideoDirect = async (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsGeneratingVid(true);
    setErrorMessage(null);

    // Shortened, direct prompt focused on motion to maximize server acceptance
    const safePrompt = `${shot.visualSummary.slice(0, 180)}. Camera: ${shot.cameraMovement}. 3D caricature cinematic animation.`;

    try {
      let result;
      // Step 1: Attempt Omni 1.1 Flash at 360p first for fastest queue processing
      try {
        const vidOptions: Parameters<typeof Flow.generate.video>[0] = {
          prompt: safePrompt,
          modelDisplayName: 'Omni 1.1 Flash',
          aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
          durationSeconds: 4,
          resolution: '360p',
        };

        if (shot.mediaId) {
          vidOptions.firstFrameImageMediaId = shot.mediaId;
        }

        result = await Flow.generate.video(vidOptions);
      } catch (omniErr) {
        console.warn('Omni 1.1 Flash yoğun, Veo 3.1 - Lite deneniyor...', omniErr);
        // Step 2: Fallback to Veo 3.1 - Lite (supports 4s 720p)
        const fallbackOptions: Parameters<typeof Flow.generate.video>[0] = {
          prompt: safePrompt,
          modelDisplayName: 'Veo 3.1 - Lite',
          aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
          durationSeconds: 4,
          resolution: '720p',
        };
        if (shot.mediaId) {
          fallbackOptions.firstFrameImageMediaId = shot.mediaId;
        }
        result = await Flow.generate.video(fallbackOptions);
      }

      const bytes = Uint8Array.from(atob(result.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: result.mimeType || 'video/mp4' });
      const blobUrl = URL.createObjectURL(blob);

      onVideoGenerated(shot.id, result.base64, result.mimeType || 'video/mp4', result.mediaId, blobUrl);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Video sunucularında anlık yoğunluk yaşanıyor.';
      setErrorMessage(msg);
    } finally {
      setIsGeneratingVid(false);
    }
  };

  const isMountain = shot.styleCategory === 'mountain';
  const isCurrentlyInPipeline =
    shot.generationStatus === 'generating-image' || shot.generationStatus === 'generating-video';

  return (
    <div
      onClick={() => onSelectForPreview(shot)}
      className={`group relative rounded-xl border transition-all duration-200 cursor-pointer overflow-hidden flex flex-col ${
        isSelected
          ? 'bg-[#1e1c2b] border-amber-400 ring-2 ring-amber-400/30 shadow-xl'
          : 'bg-[#15141e] border-[#292639] hover:border-[#4a4563] hover:bg-[#1a1827]'
      }`}
    >
      {/* Top Header Badge */}
      <div className="flex items-center justify-between px-3.5 py-2.5 border-b border-[#242133] bg-[#111019]/60 backdrop-blur-sm">
        <div className="flex items-center gap-2">
          <span className="font-mono text-xs font-black tracking-wider px-2 py-0.5 rounded bg-amber-400/10 text-amber-300 border border-amber-400/20">
            {shot.id}
          </span>
          <span className="text-[11px] font-mono text-slate-400 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">timer</span>
            {shot.durationSec}s · {shot.timeRange}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          {shot.generatedVideoBlobUrl && (
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/30 flex items-center gap-1">
              <span className="material-symbols-outlined text-[11px]">movie</span>
              Video
            </span>
          )}
          <span
            className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full ${
              isMountain
                ? 'bg-cyan-500/10 text-cyan-300 border border-cyan-500/20'
                : 'bg-rose-500/10 text-rose-300 border border-rose-500/20'
            }`}
          >
            {isMountain ? '🏔️ Dağ' : '🎈 Hiciv'}
          </span>
        </div>
      </div>

      {/* Visual Canvas / Frame Preview */}
      <div className="relative aspect-video w-full bg-[#0a0a0f] flex items-center justify-center overflow-hidden border-b border-[#242133]">
        {shot.generatedVideoBlobUrl ? (
          <video
            src={shot.generatedVideoBlobUrl}
            autoPlay
            loop
            muted
            playsInline
            className="w-full h-full object-cover"
          />
        ) : shot.generatedImageBase64 ? (
          <img
            src={`data:${shot.generatedMimeType};base64,${shot.generatedImageBase64}`}
            alt={shot.visualSummary}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="p-4 text-center flex flex-col items-center justify-center gap-2">
            <span className="material-symbols-outlined text-3xl text-slate-600">
              {isMountain ? 'landscape' : 'animation'}
            </span>
            <p className="text-[11px] text-slate-400 line-clamp-2 px-2 text-balance leading-relaxed">
              {shot.visualSummary}
            </p>
          </div>
        )}

        {/* Pipeline In-Progress Overlay */}
        {isCurrentlyInPipeline && (
          <div className="absolute inset-0 bg-black/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 p-3 text-center">
            <span className="material-symbols-outlined text-amber-400 animate-spin text-2xl">
              progress_activity
            </span>
            <span className="text-xs font-bold text-amber-200">
              {shot.generationStatus === 'generating-image'
                ? 'Karakter Referanslı Görsel Üretiliyor...'
                : 'AI Video Klibi İşleniyor (1-2 dk)...'}
            </span>
          </div>
        )}

        {/* Video active play indicator */}
        {shot.generatedVideoBlobUrl && !isCurrentlyInPipeline && (
          <div className="absolute top-2 left-2 bg-black/70 px-2 py-0.5 rounded text-[10px] text-white flex items-center gap-1 font-mono backdrop-blur-sm pointer-events-none">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
            VİDEO
          </div>
        )}

        {/* Action overlays */}
        <div className="absolute bottom-2 right-2 flex items-center gap-1.5 opacity-90 group-hover:opacity-100 transition-opacity">
          <button
            onClick={handleGenerateFrame}
            disabled={isGeneratingImg || isGeneratingVid || isCurrentlyInPipeline}
            title="Karakter referanslarıyla görsel karesi üret"
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-semibold rounded-lg bg-amber-500 text-slate-950 hover:bg-amber-400 active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-xs ${isGeneratingImg ? 'animate-spin' : ''}`}>
              {isGeneratingImg ? 'progress_activity' : 'image'}
            </span>
            <span>{isGeneratingImg ? 'Görsel...' : shot.generatedImageBase64 ? 'Kare Yenile' : 'Kare'}</span>
          </button>

          <button
            onClick={handleGenerateVideoDirect}
            disabled={isGeneratingVid || isGeneratingImg || isCurrentlyInPipeline}
            title="AI ile animasyon videosu üret (Omni 1.1 Flash / Veo 3.1 - Lite)"
            className="flex items-center gap-1 px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-purple-600 text-white hover:bg-purple-500 active:scale-95 transition-all shadow-md disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-xs ${isGeneratingVid ? 'animate-spin' : ''}`}>
              {isGeneratingVid ? 'progress_activity' : 'movie'}
            </span>
            <span>{isGeneratingVid ? 'İşleniyor...' : shot.generatedVideoBlobUrl ? 'Video Yenile' : 'Video'}</span>
          </button>
        </div>
      </div>

      {/* Body Info */}
      <div className="p-3.5 flex flex-col flex-1 justify-between gap-3 text-xs">
        <div className="space-y-2">
          {/* Linked Character References Indicator */}
          {linkedCharacters.length > 0 && (
            <div className="flex items-center gap-1 flex-wrap">
              <span className="text-[10px] text-slate-400 font-semibold flex items-center gap-0.5">
                <span className="material-symbols-outlined text-[11px] text-amber-400">group</span>
                Ref:
              </span>
              {linkedCharacters.map((char) => (
                <span
                  key={char.name}
                  className={`text-[9px] px-1.5 py-0.5 rounded-md font-semibold border ${
                    char.referenceMediaId
                      ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/20'
                      : 'bg-[#211e33] text-slate-400 border-[#322c4d]'
                  }`}
                  title={char.referenceMediaId ? 'Model referansı aktif' : 'Avatar henüz üretilmedi'}
                >
                  {char.name.split(' ')[0]} {char.referenceMediaId ? '✓' : ''}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-1.5 text-slate-400 font-medium text-[11px]">
            <span className="material-symbols-outlined text-sm text-amber-400">videocam</span>
            <span>{shot.cameraMovement}</span>
          </div>

          <p className="text-slate-300 text-xs leading-relaxed line-clamp-3">
            {shot.visualSummary}
          </p>

          {shot.voiceoverOrText && shot.voiceoverOrText !== '—' && (
            <div className="p-2 rounded bg-amber-500/5 border border-amber-500/15 text-amber-200/90 text-[11px] flex items-start gap-1.5 font-sans">
              <span className="material-symbols-outlined text-xs text-amber-400 shrink-0 mt-0.5">mic</span>
              <span className="line-clamp-2">{shot.voiceoverOrText}</span>
            </div>
          )}
        </div>

        {/* Action bar for Prompt Copy */}
        <div className="pt-2 border-t border-[#242133] flex items-center justify-between">
          <div className="text-[11px] text-slate-500 flex items-center gap-1">
            <span className="material-symbols-outlined text-xs">graphic_eq</span>
            <span className="truncate max-w-[140px]">{shot.audioCues.split(';')[0]}</span>
          </div>

          <button
            onClick={handleCopyPrompt}
            className="flex items-center gap-1 px-2 py-1 text-[11px] font-medium text-slate-300 hover:text-white rounded bg-[#242036] hover:bg-[#342e4e] active:scale-95 transition-all"
            title="İngilizce AI Promptunu Kopyala"
          >
            <span className="material-symbols-outlined text-xs">
              {copyToast ? 'check' : 'content_copy'}
            </span>
            <span>{copyToast ? 'Kopyalandı' : 'Prompt'}</span>
          </button>
        </div>

        {errorMessage && (
          <div className="p-2.5 rounded-lg bg-amber-500/10 border border-amber-500/25 text-amber-200 text-[11px] flex flex-col gap-1">
            <div className="flex items-start gap-1 font-semibold text-amber-300">
              <span className="material-symbols-outlined text-xs shrink-0 mt-0.5">info</span>
              <span>Video Üretim Durumu:</span>
            </div>
            <p className="text-[10px] text-slate-300 leading-normal pl-3.5">
              {errorMessage}
            </p>
            <div className="text-[10px] text-cyan-300/90 pl-3.5 space-y-0.5">
              <p>• Önce <strong>Kare</strong> butonuna basıp sahne görseli oluşturun.</p>
              <p>• Karta tıklayıp detaydan <strong>Veo 3.1 - Lite</strong> veya <strong>360p (Hızlı Taslak)</strong> seçerek tekrar deneyin.</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
