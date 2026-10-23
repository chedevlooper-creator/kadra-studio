import React from 'react';
import { PipelineStage } from '../types';

interface AutoPipelineBarProps {
  pipelineStage: PipelineStage;
  currentStepIndex: number;
  totalStepItems: number;
  currentStepName: string;
  characterCount: number;
  characterDoneCount: number;
  shotImageCount: number;
  shotVideoCount: number;
  totalShots: number;
  onStartFullPipeline: () => void;
  onStartCharacterBatch: () => void;
  onStartStoryboardBatch: () => void;
  onStartVideoBatch: () => void;
  onPausePipeline: () => void;
  onOpenCharacterModal: () => void;
}

export const AutoPipelineBar: React.FC<AutoPipelineBarProps> = ({
  pipelineStage,
  currentStepIndex,
  totalStepItems,
  currentStepName,
  characterCount,
  characterDoneCount,
  shotImageCount,
  shotVideoCount,
  totalShots,
  onStartFullPipeline,
  onStartCharacterBatch,
  onStartStoryboardBatch,
  onStartVideoBatch,
  onPausePipeline,
  onOpenCharacterModal,
}) => {
  const isRunning =
    pipelineStage === 'characters' || pipelineStage === 'storyboard' || pipelineStage === 'videos';

  const progressPercent =
    totalStepItems > 0 ? Math.min(100, Math.round(((currentStepIndex + 1) / totalStepItems) * 100)) : 0;

  return (
    <div className="bg-[#141222] border-b border-[#2d2745] px-4 md:px-8 py-3 shadow-xl">
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
        {/* Step Progression Indicators */}
        <div className="flex items-center gap-2 flex-wrap text-xs">
          {/* Step 1 Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
              pipelineStage === 'characters'
                ? 'bg-amber-500/20 border-amber-400 text-amber-300 ring-2 ring-amber-400/30'
                : characterDoneCount === characterCount && characterCount > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-[#1a1728] border-[#2f2945] text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                pipelineStage === 'characters'
                  ? 'bg-amber-400 text-slate-950 animate-pulse'
                  : characterDoneCount === characterCount && characterCount > 0
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#29243a] text-slate-300'
              }`}
            >
              {characterDoneCount === characterCount && characterCount > 0 ? '✓' : '1'}
            </span>
            <div className="flex flex-col">
              <span className="font-bold leading-tight flex items-center gap-1">
                Karakterler
                <button
                  onClick={onOpenCharacterModal}
                  className="hover:text-white underline text-[10px] text-amber-400"
                >
                  (Gör)
                </button>
              </span>
              <span className="text-[10px] font-mono text-slate-400">
                {characterDoneCount}/{characterCount} Hazır
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-xs text-slate-600">arrow_forward</span>

          {/* Step 2 Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
              pipelineStage === 'storyboard'
                ? 'bg-cyan-500/20 border-cyan-400 text-cyan-300 ring-2 ring-cyan-400/30'
                : shotImageCount === totalShots && totalShots > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-[#1a1728] border-[#2f2945] text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                pipelineStage === 'storyboard'
                  ? 'bg-cyan-400 text-slate-950 animate-pulse'
                  : shotImageCount === totalShots && totalShots > 0
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#29243a] text-slate-300'
              }`}
            >
              {shotImageCount === totalShots && totalShots > 0 ? '✓' : '2'}
            </span>
            <div className="flex flex-col">
              <span className="font-bold leading-tight">Sahne Görselleri (I2I/R2I)</span>
              <span className="text-[10px] font-mono text-slate-400">
                {shotImageCount}/{totalShots} Hazır
              </span>
            </div>
          </div>

          <span className="material-symbols-outlined text-xs text-slate-600">arrow_forward</span>

          {/* Step 3 Pill */}
          <div
            className={`flex items-center gap-2 px-3 py-1.5 rounded-xl border transition-all ${
              pipelineStage === 'videos'
                ? 'bg-purple-500/20 border-purple-400 text-purple-300 ring-2 ring-purple-400/30'
                : shotVideoCount === totalShots && totalShots > 0
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                : 'bg-[#1a1728] border-[#2f2945] text-slate-400'
            }`}
          >
            <span
              className={`w-5 h-5 rounded-full flex items-center justify-center font-bold text-[10px] ${
                pipelineStage === 'videos'
                  ? 'bg-purple-400 text-slate-950 animate-pulse'
                  : shotVideoCount === totalShots && totalShots > 0
                  ? 'bg-emerald-500 text-slate-950'
                  : 'bg-[#29243a] text-slate-300'
              }`}
            >
              {shotVideoCount === totalShots && totalShots > 0 ? '✓' : '3'}
            </span>
            <div className="flex flex-col">
              <span className="font-bold leading-tight">Video Klipleri (I2V)</span>
              <span className="text-[10px] font-mono text-slate-400">
                {shotVideoCount}/{totalShots} Üretildi
              </span>
            </div>
          </div>
        </div>

        {/* Master Action Trigger & Step Controls */}
        <div className="flex items-center gap-2 flex-wrap w-full lg:w-auto justify-end">
          {isRunning ? (
            <div className="flex items-center gap-3 bg-[#1e1a33] border border-amber-400/40 px-3.5 py-2 rounded-xl text-xs w-full lg:w-auto justify-between">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-amber-400 animate-spin text-sm">
                  progress_activity
                </span>
                <div className="flex flex-col">
                  <span className="font-bold text-amber-200">
                    {pipelineStage === 'characters'
                      ? '1. Aşama: Karakterler Üretiliyor...'
                      : pipelineStage === 'storyboard'
                      ? '2. Aşama: Sahne Görselleri Üretiliyor...'
                      : '3. Aşama: AI Video Klipleri İşleniyor...'}
                  </span>
                  <span className="text-[10px] text-slate-400 truncate max-w-[280px]">
                    [{currentStepIndex + 1}/{totalStepItems}] {currentStepName}
                  </span>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className="font-mono text-amber-300 font-bold text-xs">{progressPercent}%</span>
                <button
                  onClick={onPausePipeline}
                  className="px-2.5 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold text-[11px] flex items-center gap-1 active:scale-95"
                >
                  <span className="material-symbols-outlined text-xs">pause</span>
                  <span>Durdur</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-wrap">
              {/* Master 1-Click Button */}
              <button
                onClick={onStartFullPipeline}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-amber-500 via-rose-500 to-purple-600 hover:from-amber-400 hover:via-rose-400 hover:to-purple-500 text-slate-950 font-black text-xs flex items-center gap-2 shadow-lg shadow-purple-900/30 active:scale-95 transition-all"
                title="Sırasıyla tüm karakterleri üretir, sonra karakter referanslarıyla sahneleri üretir, ardından tüm videoları üretir"
              >
                <span className="material-symbols-outlined text-sm font-black">auto_mode</span>
                <span>TEK TUŞLA TAM ÜRETİMİ BAŞLAT</span>
              </button>

              {/* Sub-steps dropdown / direct shortcuts */}
              <button
                onClick={onStartCharacterBatch}
                className="px-2.5 py-2 rounded-xl bg-[#231f36] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all border border-[#3b3457]"
                title="Sadece tüm karakterleri sırayla üret"
              >
                <span className="material-symbols-outlined text-xs text-amber-400">group</span>
                <span>Karakterleri Üret ({characterCount})</span>
              </button>

              <button
                onClick={onStartStoryboardBatch}
                className="px-2.5 py-2 rounded-xl bg-[#231f36] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all border border-[#3b3457]"
                title="Karakter referanslarını kullanarak sahnelerin görsellerini üret"
              >
                <span className="material-symbols-outlined text-xs text-cyan-400">photo_library</span>
                <span>Sahneleri Üret ({totalShots})</span>
              </button>

              <button
                onClick={onStartVideoBatch}
                className="px-2.5 py-2 rounded-xl bg-[#231f36] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold flex items-center gap-1 transition-all border border-[#3b3457]"
                title="Oluşan sahne karelerinden tüm videoları sırayla üret"
              >
                <span className="material-symbols-outlined text-xs text-purple-400">movie</span>
                <span>Tüm Videoları Üret</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
