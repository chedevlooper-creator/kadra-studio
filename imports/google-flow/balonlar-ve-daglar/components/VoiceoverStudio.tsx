import React, { useState } from 'react';
import { Flow } from 'flow-sdk';

export const VoiceoverStudio: React.FC = () => {
  const [isRecording, setIsRecording] = useState(false);
  const [recordedAudioBase64, setRecordedAudioBase64] = useState<string | null>(null);
  const [recordedMime, setRecordedMime] = useState<string>('audio/webm');
  const [playbackAudioUrl, setPlaybackAudioUrl] = useState<string | null>(null);

  const scriptA = `«Plastik, doğaya da vatana da zarar verir.
Bir gün patlayacak plastik balonlar olmayın.»`;

  const scriptB = `«Bir milleti var eden, ona özünü ve karakterini veren ruhtur.
O ruhtan vazgeçen, o milletten olma iddiasından da vazgeçmiş demektir.
Bu milletin bütün vatanını zapt etseniz bile,
anıt dağlar gibi yükselmek sizin için hep bir hayal olarak kalır.
Olsa olsa bir balon gibi hızla şişer, uçar…
ve patlayıp gidersiniz.»`;

  const handleRecord = async (durationSec: number) => {
    setIsRecording(true);
    try {
      const result = await Flow.microphone.record({ durationMs: durationSec * 1000 });
      setRecordedAudioBase64(result.base64);
      setRecordedMime(result.mimeType);

      const audioUrl = `data:${result.mimeType};base64,${result.base64}`;
      setPlaybackAudioUrl(audioUrl);
    } catch {
      // recording stopped or cancelled
    } finally {
      setIsRecording(false);
    }
  };

  const handleDownloadNarration = async () => {
    if (!recordedAudioBase64) return;
    try {
      await Flow.download({
        base64: recordedAudioBase64,
        mimeType: recordedMime as 'audio/webm' | 'audio/mp3' | 'audio/wav',
        filename: 'balonlar_ve_daglar_dis_ses.webm',
      });
    } catch {
      // Download handled
    }
  };

  return (
    <div className="space-y-6">
      <div className="p-5 rounded-2xl bg-[#14121f] border border-[#2b2742] space-y-1">
        <div className="flex items-center gap-2">
          <span className="material-symbols-outlined text-amber-400">mic</span>
          <h2 className="text-white font-bold text-lg">Dış Ses & Daktilo Seslendirme Stüdyosu</h2>
        </div>
        <p className="text-xs text-slate-300">
          Klibin finalinde daktilo efektiyle ekrana gelecek dış ses metinlerini inceleyin, mikrofon ile prova kaydı alın
          ve ses dosyasını indirin.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Script A */}
        <div className="p-5 rounded-2xl bg-[#161423] border border-[#2b2740] flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-amber-400 uppercase tracking-wider">
                (A) ESPRİ SPOTU (2:31 – 2:38)
              </span>
              <span className="text-[10px] font-mono text-slate-400">7 saniye · İronik Resmî Spiker Tonu</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0c0a13] border border-[#221e33] font-serif text-amber-100 text-sm whitespace-pre-line leading-relaxed shadow-inner">
              {scriptA}
            </div>
          </div>

          <button
            onClick={() => handleRecord(7)}
            disabled={isRecording}
            className="w-full py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isRecording ? 'animate-pulse text-red-600' : ''}`}>
              mic
            </span>
            <span>{isRecording ? 'Kayıt Yapılıyor (7s)...' : '7s Spot Prova Kaydı Al'}</span>
          </button>
        </div>

        {/* Script B */}
        <div className="p-5 rounded-2xl bg-[#161423] border border-[#2b2740] flex flex-col justify-between gap-4">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-cyan-400 uppercase tracking-wider">
                (B) CİDDİ ANIT KAPANIŞI (2:38 – 2:54)
              </span>
              <span className="text-[10px] font-mono text-slate-400">16 saniye · Ağırbaşlı & Destansı</span>
            </div>
            <div className="p-4 rounded-xl bg-[#0c0a13] border border-[#221e33] font-serif text-slate-200 text-xs whitespace-pre-line leading-relaxed shadow-inner">
              {scriptB}
            </div>
          </div>

          <button
            onClick={() => handleRecord(16)}
            disabled={isRecording}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center justify-center gap-2 transition-all disabled:opacity-50"
          >
            <span className={`material-symbols-outlined text-sm ${isRecording ? 'animate-pulse text-red-600' : ''}`}>
              mic
            </span>
            <span>{isRecording ? 'Kayıt Yapılıyor (16s)...' : '16s Epik Kapanış Provası Al'}</span>
          </button>
        </div>
      </div>

      {/* Recording Player Bar */}
      {playbackAudioUrl && (
        <div className="p-4 rounded-xl bg-[#181628] border border-[#322c4f] flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-emerald-400 text-2xl">check_circle</span>
            <div>
              <p className="text-xs font-bold text-white">Prova Kaydı Alındı</p>
              <p className="text-[11px] text-slate-400">Kaydettiğiniz dış sesi dinleyin veya dışa aktarın</p>
            </div>
          </div>

          <div className="flex items-center gap-3 w-full sm:w-auto">
            <audio src={playbackAudioUrl} controls className="h-9 max-w-full" />
            <button
              onClick={handleDownloadNarration}
              className="px-3.5 py-2 rounded-lg bg-emerald-500 hover:bg-emerald-400 active:scale-95 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all shrink-0"
            >
              <span className="material-symbols-outlined text-sm">download</span>
              <span>İndir</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
