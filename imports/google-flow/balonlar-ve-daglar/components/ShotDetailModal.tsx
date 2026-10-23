import React, { useState, useEffect } from 'react';
import { ShotItem } from '../types';
import { Flow } from 'flow-sdk';

interface ShotDetailModalProps {
  shot: ShotItem | null;
  aspectRatio: '16:9' | '9:16';
  onClose: () => void;
  onShotUpdated: (shotId: string, base64: string, mimeType: string, mediaId: string) => void;
  onVideoUpdated: (shotId: string, base64: string, mimeType: string, mediaId: string, blobUrl: string) => void;
}

export const ShotDetailModal: React.FC<ShotDetailModalProps> = ({
  shot,
  aspectRatio,
  onClose,
  onShotUpdated,
  onVideoUpdated,
}) => {
  if (!shot) return null;

  const [isGeneratingImg, setIsGeneratingImg] = useState(false);
  const [isGeneratingVid, setIsGeneratingVid] = useState(false);
  const [selectedVideoModel, setSelectedVideoModel] = useState<'Omni 1.1 Flash' | 'Veo 3.1 - Lite'>('Omni 1.1 Flash');
  const [videoDuration, setVideoDuration] = useState<number>(4);
  const [videoResolution, setVideoResolution] = useState<'720p' | '360p'>('360p');
  const [useImageAsFirstFrame, setUseImageAsFirstFrame] = useState<boolean>(true);
  const [videoBlobUrl, setVideoBlobUrl] = useState<string | null>(shot.generatedVideoBlobUrl || null);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [downloadState, setDownloadState] = useState<'idle' | 'downloading' | 'done'>('idle');

  // Synchronize duration and resolution options based on model
  useEffect(() => {
    if (selectedVideoModel === 'Veo 3.1 - Lite') {
      if (videoDuration === 10) setVideoDuration(8);
      setVideoResolution('720p');
    }
  }, [selectedVideoModel, videoDuration]);

  // Keep local blobUrl in sync with shot changes
  useEffect(() => {
    if (shot.generatedVideoBlobUrl) {
      setVideoBlobUrl(shot.generatedVideoBlobUrl);
    }
  }, [shot.generatedVideoBlobUrl]);

  const handleCopyPrompt = async () => {
    await navigator.clipboard.writeText(shot.aiPrompt);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleGenerateImage = async () => {
    setIsGeneratingImg(true);
    setErrorMessage(null);
    setStatusMessage('Görsel karesi üretiliyor (🍌 Nano Banana Pro)...');
    try {
      const result = await Flow.generate.image({
        prompt: shot.aiPrompt,
        modelDisplayName: '🍌 Nano Banana Pro',
        aspectRatio,
      });
      onShotUpdated(shot.id, result.base64, result.mimeType, result.mediaId);
      setStatusMessage('Görsel başarıyla oluşturuldu ve video için başlangıç karesi olarak hazırlandı!');
    } catch (err: unknown) {
      setErrorMessage(err instanceof Error ? err.message : 'Görsel üretimi başarısız oldu.');
    } finally {
      setIsGeneratingImg(false);
    }
  };

  const handleGenerateVideoClip = async (overrideModel?: 'Omni 1.1 Flash' | 'Veo 3.1 - Lite', overrideRes?: '360p' | '720p') => {
    const activeModel = overrideModel || selectedVideoModel;
    const activeRes = overrideRes || videoResolution;

    setIsGeneratingVid(true);
    setErrorMessage(null);
    setStatusMessage(
      `${activeModel} (${activeModel === 'Omni 1.1 Flash' ? activeRes : '720p'}) ile video klibi üretiliyor... AI modelin işlemesi 1-2 dakika sürebilir.`
    );

    try {
      const cleanPrompt = `${shot.visualSummary.slice(0, 180)}. Camera movement: ${shot.cameraMovement}. High cinematic 3D caricature quality.`;

      const vidOptions: Parameters<typeof Flow.generate.video>[0] = {
        prompt: cleanPrompt,
        modelDisplayName: activeModel,
        aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
        durationSeconds: activeModel === 'Veo 3.1 - Lite' && videoDuration > 8 ? 8 : videoDuration,
      };

      if (activeModel === 'Omni 1.1 Flash') {
        vidOptions.resolution = activeRes;
      } else {
        vidOptions.resolution = '720p';
      }

      if (useImageAsFirstFrame && shot.mediaId) {
        vidOptions.firstFrameImageMediaId = shot.mediaId;
      }

      let vidResult;
      try {
        vidResult = await Flow.generate.video(vidOptions);
      } catch (primaryError) {
        // Automatically try fallback model
        const altModel = activeModel === 'Omni 1.1 Flash' ? 'Veo 3.1 - Lite' : 'Omni 1.1 Flash';
        setStatusMessage(`${activeModel} meşgul, yedek model (${altModel}) ile deneniyor...`);

        const altOptions: Parameters<typeof Flow.generate.video>[0] = {
          prompt: cleanPrompt,
          modelDisplayName: altModel,
          aspectRatio: aspectRatio === '9:16' ? '9:16' : '16:9',
          durationSeconds: 4,
          resolution: altModel === 'Omni 1.1 Flash' ? '360p' : '720p',
        };

        if (useImageAsFirstFrame && shot.mediaId) {
          altOptions.firstFrameImageMediaId = shot.mediaId;
        }

        vidResult = await Flow.generate.video(altOptions);
        setSelectedVideoModel(altModel);
      }

      const bytes = Uint8Array.from(atob(vidResult.base64), (c) => c.charCodeAt(0));
      const blob = new Blob([bytes], { type: vidResult.mimeType || 'video/mp4' });
      const url = URL.createObjectURL(blob);

      setVideoBlobUrl(url);
      onVideoUpdated(shot.id, vidResult.base64, vidResult.mimeType || 'video/mp4', vidResult.mediaId, url);
      setStatusMessage('✓ Video klibi başarıyla üretildi ve galeriye kaydedildi!');
    } catch (err: unknown) {
      const errorMsg =
        err instanceof Error
          ? err.message
          : 'Video kuyruğu anlık olarak yoğun. Aşağıdaki tek tıkla hızlı deneme butonlarını kullanabilirsiniz.';
      setErrorMessage(errorMsg);
      setStatusMessage(null);
    } finally {
      setIsGeneratingVid(false);
    }
  };

  const handleDownloadVideo = async () => {
    if (!shot.generatedVideoBase64) return;
    setDownloadState('downloading');
    try {
      await Flow.download({
        base64: shot.generatedVideoBase64,
        mimeType: 'video/mp4',
        filename: `balonlar_ve_daglar_${shot.id}_video.mp4`,
      });
      setDownloadState('done');
      setTimeout(() => setDownloadState('idle'), 2000);
    } catch (err) {
      setErrorMessage(err instanceof Error ? err.message : 'Video indirilemedi.');
      setDownloadState('idle');
    }
  };

  const handleDownloadImage = async () => {
    if (!shot.generatedImageBase64) return;
    try {
      await Flow.download({
        base64: shot.generatedImageBase64,
        mimeType: (shot.generatedMimeType as 'image/png' | 'image/jpeg') || 'image/png',
        filename: `balonlar_ve_daglar_${shot.id}_kare.png`,
      });
    } catch {
      // handled
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-4xl max-h-[92vh] bg-[#14121d] border border-[#2e2a44] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#242036] bg-[#0e0d16]">
          <div className="flex items-center gap-3">
            <span className="font-mono text-sm font-black px-2.5 py-1 rounded bg-amber-400 text-slate-950">
              SHOT {shot.id}
            </span>
            <div>
              <h2 className="text-white font-bold text-base">{shot.sceneTitle}</h2>
              <p className="text-xs text-slate-400 font-mono">
                Süre: {shot.durationSec} sn ({shot.timeRange}) · Format: {aspectRatio}
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-lg bg-[#242036] text-slate-400 hover:text-white flex items-center justify-center hover:bg-[#342e4e] transition-colors"
          >
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        {/* Content Scrollable */}
        <div className="overflow-y-auto p-6 space-y-6">
          {/* Visual Showcase */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
            <div className="space-y-4">
              {/* Media Player Monitor */}
              <div className="relative aspect-video w-full rounded-xl bg-black border border-[#2c2742] overflow-hidden flex items-center justify-center shadow-lg">
                {videoBlobUrl ? (
                  <video
                    src={videoBlobUrl}
                    controls
                    autoPlay
                    loop
                    playsInline
                    className="w-full h-full object-cover"
                  />
                ) : shot.generatedImageBase64 ? (
                  <img
                    src={`data:${shot.generatedMimeType};base64,${shot.generatedImageBase64}`}
                    alt={shot.visualSummary}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="text-center p-6 text-slate-500 flex flex-col items-center">
                    <span className="material-symbols-outlined text-4xl mb-2 text-slate-600">art_track</span>
                    <p className="text-xs text-slate-400">Henüz bu shot için görsel veya video üretilmedi.</p>
                  </div>
                )}

                {/* Badge top-left */}
                <div className="absolute top-2 left-2 flex items-center gap-1.5">
                  {videoBlobUrl && (
                    <span className="bg-purple-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm flex items-center gap-1 shadow">
                      <span className="material-symbols-outlined text-[11px]">movie</span>
                      Video Aktif
                    </span>
                  )}
                  {shot.generatedImageBase64 && !videoBlobUrl && (
                    <span className="bg-amber-500/90 text-slate-950 text-[10px] font-bold px-2 py-0.5 rounded backdrop-blur-sm shadow">
                      Görsel Kare
                    </span>
                  )}
                </div>
              </div>

              {/* Video Generation Controls Box */}
              <div className="p-4 rounded-xl bg-[#1a1728] border border-[#312b4a] space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-purple-300 flex items-center gap-1.5">
                    <span className="material-symbols-outlined text-sm">tune</span>
                    Video Üretim Parametreleri
                  </span>
                  <span className="text-[10px] text-slate-400">Flow SDK AI Video</span>
                </div>

                {/* Model Selector */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Video Modeli</label>
                    <select
                      value={selectedVideoModel}
                      onChange={(e) => setSelectedVideoModel(e.target.value as 'Omni 1.1 Flash' | 'Veo 3.1 - Lite')}
                      disabled={isGeneratingVid}
                      className="w-full bg-[#0e0c17] border border-[#3b3457] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value="Omni 1.1 Flash">Omni 1.1 Flash (Hızlı & 360p/720p)</option>
                      <option value="Veo 3.1 - Lite">Veo 3.1 - Lite (Sinematik 720p)</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] text-slate-400 mb-1">Klip Süresi</label>
                    <select
                      value={videoDuration}
                      onChange={(e) => setVideoDuration(Number(e.target.value))}
                      disabled={isGeneratingVid}
                      className="w-full bg-[#0e0c17] border border-[#3b3457] rounded-lg px-2.5 py-1.5 text-xs text-white focus:outline-none focus:border-purple-400"
                    >
                      <option value={4}>4 Saniye (En Hızlı Sonuç)</option>
                      <option value={6}>6 Saniye</option>
                      <option value={8}>8 Saniye</option>
                      {selectedVideoModel === 'Omni 1.1 Flash' && (
                        <option value={10}>10 Saniye</option>
                      )}
                    </select>
                  </div>
                </div>

                {/* Resolution & First Frame Option */}
                <div className="flex items-center justify-between pt-1 gap-2 text-xs">
                  {selectedVideoModel === 'Omni 1.1 Flash' ? (
                    <div className="flex items-center gap-1.5">
                      <span className="text-[11px] text-slate-400">Çözünürlük:</span>
                      <button
                        type="button"
                        onClick={() => setVideoResolution('360p')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          videoResolution === '360p' ? 'bg-purple-600 text-white' : 'bg-[#29233f] text-slate-300'
                        }`}
                        title="En hızlı ve kesintisiz video üretimi için"
                      >
                        360p (Hızlı Taslak)
                      </button>
                      <button
                        type="button"
                        onClick={() => setVideoResolution('720p')}
                        className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                          videoResolution === '720p' ? 'bg-purple-600 text-white' : 'bg-[#29233f] text-slate-300'
                        }`}
                      >
                        720p (HD)
                      </button>
                    </div>
                  ) : (
                    <span className="text-[11px] text-slate-400">Veo 3.1: 720p HD</span>
                  )}

                  {shot.mediaId && (
                    <label className="flex items-center gap-1.5 cursor-pointer text-[11px] text-slate-300 ml-auto">
                      <input
                        type="checkbox"
                        checked={useImageAsFirstFrame}
                        onChange={(e) => setUseImageAsFirstFrame(e.target.checked)}
                        className="rounded border-[#3b3457] text-purple-600 focus:ring-0 bg-[#0e0c17]"
                      />
                      <span>Görselden Başlat (I2V)</span>
                    </label>
                  )}
                </div>

                {/* Primary Action Buttons */}
                <div className="flex items-center gap-2 pt-1">
                  <button
                    onClick={handleGenerateImage}
                    disabled={isGeneratingImg || isGeneratingVid}
                    className="flex-1 py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 font-bold text-slate-950 text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-md"
                  >
                    <span className={`material-symbols-outlined text-sm ${isGeneratingImg ? 'animate-spin' : ''}`}>
                      {isGeneratingImg ? 'progress_activity' : 'image'}
                    </span>
                    <span>{shot.generatedImageBase64 ? 'Kareyi Yenile' : 'Kare Üret'}</span>
                  </button>

                  <button
                    onClick={() => handleGenerateVideoClip()}
                    disabled={isGeneratingVid || isGeneratingImg}
                    className="flex-1 py-2 px-3 rounded-xl bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-500 hover:to-indigo-500 active:scale-95 font-bold text-white text-xs flex items-center justify-center gap-1.5 transition-all disabled:opacity-50 shadow-lg"
                  >
                    <span className={`material-symbols-outlined text-sm ${isGeneratingVid ? 'animate-spin' : ''}`}>
                      {isGeneratingVid ? 'progress_activity' : 'movie'}
                    </span>
                    <span>
                      {isGeneratingVid
                        ? 'Video İşleniyor...'
                        : videoBlobUrl
                        ? 'Videoyu Yeniden Üret'
                        : 'Video Klibi Üret'}
                    </span>
                  </button>
                </div>

                {/* Downloads bar */}
                <div className="flex items-center justify-end gap-2 pt-1">
                  {shot.generatedImageBase64 && (
                    <button
                      onClick={handleDownloadImage}
                      className="px-2.5 py-1 rounded-lg bg-[#252039] hover:bg-[#342e4e] text-slate-300 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                      title="Kareyi İndir"
                    >
                      <span className="material-symbols-outlined text-xs">download</span>
                      <span>Kare PNG</span>
                    </button>
                  )}

                  {shot.generatedVideoBase64 && (
                    <button
                      onClick={handleDownloadVideo}
                      disabled={downloadState === 'downloading'}
                      className="px-2.5 py-1 rounded-lg bg-purple-700/50 hover:bg-purple-600 text-purple-200 hover:text-white text-[11px] flex items-center gap-1 transition-colors"
                      title="Videoyu Bilgisayara İndir"
                    >
                      <span className="material-symbols-outlined text-xs">
                        {downloadState === 'done' ? 'check' : 'download'}
                      </span>
                      <span>{downloadState === 'done' ? 'İndirildi ✓' : 'Video MP4'}</span>
                    </button>
                  )}
                </div>
              </div>

              {/* Status & Error Feedback */}
              {statusMessage && (
                <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-300 text-xs flex items-start gap-2 animate-fadeIn">
                  <span className="material-symbols-outlined text-sm shrink-0 mt-0.5">check_circle</span>
                  <span className="leading-relaxed">{statusMessage}</span>
                </div>
              )}

              {errorMessage && (
                <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-200 text-xs flex flex-col gap-2">
                  <div className="flex items-center gap-1.5 font-bold text-amber-300">
                    <span className="material-symbols-outlined text-base">info</span>
                    <span>Video Sunucusu Yanıtı</span>
                  </div>
                  <p className="text-[11px] text-slate-300 leading-relaxed">
                    {errorMessage}
                  </p>
                  
                  {/* Quick 1-click retry helpers */}
                  <div className="pt-1 flex items-center gap-2 flex-wrap">
                    <button
                      onClick={() => handleGenerateVideoClip('Omni 1.1 Flash', '360p')}
                      disabled={isGeneratingVid}
                      className="px-2.5 py-1 rounded-lg bg-purple-600 hover:bg-purple-500 text-white font-semibold text-[10px] flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">bolt</span>
                      Omni 1.1 Flash (360p Hızlı Taslak) ile Dene
                    </button>

                    <button
                      onClick={() => handleGenerateVideoClip('Veo 3.1 - Lite', '720p')}
                      disabled={isGeneratingVid}
                      className="px-2.5 py-1 rounded-lg bg-amber-500 hover:bg-amber-400 text-slate-950 font-semibold text-[10px] flex items-center gap-1"
                    >
                      <span className="material-symbols-outlined text-xs">smart_toy</span>
                      Veo 3.1 - Lite ile Dene
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Directing & Staging Information */}
            <div className="space-y-4">
              <div className="space-y-1">
                <span className="text-[11px] font-bold text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">visibility</span>
                  Görsel Tasvir & Mizansen
                </span>
                <p className="text-sm text-slate-200 leading-relaxed bg-[#1b1828] p-3 rounded-xl border border-[#2b2740]">
                  {shot.visualSummary}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-cyan-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">video_camera_front</span>
                  Kamera Hareketi & Kadraj
                </span>
                <p className="text-xs text-slate-300 font-mono bg-[#1b1828] p-2.5 rounded-lg border border-[#2b2740]">
                  {shot.cameraMovement}
                </p>
              </div>

              <div className="space-y-1">
                <span className="text-[11px] font-bold text-purple-400 uppercase tracking-wider flex items-center gap-1">
                  <span className="material-symbols-outlined text-xs">graphic_eq</span>
                  Müzik, Enstrüman & Ses Efektleri
                </span>
                <p className="text-xs text-slate-300 bg-[#1b1828] p-2.5 rounded-lg border border-[#2b2740] leading-relaxed">
                  {shot.audioCues}
                </p>
              </div>

              {shot.voiceoverOrText && shot.voiceoverOrText !== '—' && (
                <div className="space-y-1">
                  <span className="text-[11px] font-bold text-amber-300 uppercase tracking-wider flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">subtitles</span>
                    Ekranda Yazı / Daktilo / Dış Ses
                  </span>
                  <div className="text-xs text-amber-100 whitespace-pre-line font-serif italic bg-amber-500/10 p-3 rounded-xl border border-amber-500/20 leading-relaxed">
                    {shot.voiceoverOrText}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* AI Prompt Box */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                <span className="material-symbols-outlined text-amber-400 text-sm">terminal</span>
                Üretim AI Promptu (Nano Banana Pro / Omni 1.1 Flash / Veo 3.1)
              </span>
              <button
                onClick={handleCopyPrompt}
                className="flex items-center gap-1 px-3 py-1 text-xs font-medium rounded-lg bg-amber-400 text-slate-950 hover:bg-amber-300 active:scale-95 transition-all"
              >
                <span className="material-symbols-outlined text-xs">{copied ? 'check' : 'content_copy'}</span>
                <span>{copied ? 'Kopyalandı!' : 'Promptu Kopyala'}</span>
              </button>
            </div>
            <div className="p-3.5 rounded-xl bg-[#0b0a11] border border-[#28243c] font-mono text-xs text-amber-200/90 leading-relaxed select-all">
              {shot.aiPrompt}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
