import React, { useState } from 'react';
import { CharacterReference, ArchivePhotoPreset } from '../types';
import { Flow } from 'flow-sdk';

interface CharacterSheetModalProps {
  characters: CharacterReference[];
  onGenerateSingle: (index: number) => Promise<void>;
  onGenerateAll: () => void;
  onStop: () => void;
  onClose: () => void;
  onUpdateCharacterPrompt: (index: number, newPrompt: string) => void;
  onSetUserReferenceMedia: (index: number, mediaId: string, base64: string, previewUrl?: string) => void;
  isBatchRunning: boolean;
  selectedModel: string;
  onSelectModel: (model: string) => void;
}

export const CharacterSheetModal: React.FC<CharacterSheetModalProps> = ({
  characters,
  onGenerateSingle,
  onGenerateAll,
  onStop,
  onClose,
  onUpdateCharacterPrompt,
  onSetUserReferenceMedia,
  isBatchRunning,
  selectedModel,
  onSelectModel,
}) => {
  const [activeGeneratingIdx, setActiveGeneratingIdx] = useState<number | null>(null);
  const [editingIdx, setEditingIdx] = useState<number | null>(null);
  const [editedPrompt, setEditedPrompt] = useState<string>('');
  const [copyToastIdx, setCopyToastIdx] = useState<number | null>(null);
  const [loadingArchiveId, setLoadingArchiveId] = useState<string | null>(null);

  const handleGenerate = async (index: number) => {
    setActiveGeneratingIdx(index);
    try {
      await onGenerateSingle(index);
    } finally {
      setActiveGeneratingIdx(null);
    }
  };

  const handleSelectFromGallery = async (index: number) => {
    try {
      const media = await Flow.media.select({ filter: 'image' });
      if (media && media.mediaId) {
        onSetUserReferenceMedia(index, media.mediaId, media.base64);
      }
    } catch (err) {
      console.warn('Fotoğraf seçimi iptal edildi veya başarısız:', err);
    }
  };

  // Convert an online archive photo directly to a Flow mediaId via canvas & Flow.upload
  const handleAdoptArchivePhoto = async (index: number, preset: ArchivePhotoPreset) => {
    setLoadingArchiveId(preset.id);
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';

      await new Promise((resolve, reject) => {
        img.onload = () => resolve(true);
        img.onerror = () => reject(new Error('Görsel yüklenemedi'));
        img.src = preset.url;
      });

      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth || 600;
      canvas.height = img.naturalHeight || 600;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw new Error('Canvas bağlamı alınamadı');
      ctx.drawImage(img, 0, 0);

      const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
      const base64 = dataUrl.split(',')[1];

      const uploaded = await Flow.upload({
        base64,
        mimeType: 'image/jpeg',
        name: `${characters[index].name}_Arsiv_${preset.id}`,
      });

      onSetUserReferenceMedia(index, uploaded.mediaId, base64, preset.url);
    } catch (err) {
      console.warn('Arşiv fotoğrafı yüklenirken hata:', err);
      // Fallback: If external CDN fails canvas CORS, allow manual gallery pick
      alert('Arşiv görseli tarayıcı güvenlik politikasından ötürü doğrudan aktarılamadı. Lütfen görseli sağ tıklayıp bilgisayarınıza kaydedin ve "Galeriden Yükle" ile seçin.');
    } finally {
      setLoadingArchiveId(null);
    }
  };

  const handleStartEditing = (index: number) => {
    setEditingIdx(index);
    setEditedPrompt(characters[index].stylePrompt);
  };

  const handleSaveEdit = (index: number) => {
    onUpdateCharacterPrompt(index, editedPrompt);
    setEditingIdx(null);
  };

  const handleCopyPrompt = async (index: number, prompt: string) => {
    await navigator.clipboard.writeText(prompt);
    setCopyToastIdx(index);
    setTimeout(() => setCopyToastIdx(null), 2000);
  };

  const completedCount = characters.filter((c) => c.avatarBase64).length;
  const userPhotoCount = characters.filter((c) => c.userReferenceMediaId).length;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md">
      <div className="relative w-full max-w-6xl max-h-[92vh] bg-[#13111c] border border-[#2d2942] rounded-2xl shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between px-6 py-4 border-b border-[#242036] bg-[#0d0c15] gap-3">
          <div className="flex items-center gap-3">
            <span className="material-symbols-outlined text-amber-400 text-2xl">face</span>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-white font-bold text-base">
                  Karakter & Yüz Benzerliği Stüdyosu
                </h2>
                <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-400/10 text-amber-300 border border-amber-400/20">
                  {completedCount}/{characters.length} Üretildi
                </span>
                {userPhotoCount > 0 && (
                  <span className="px-2 py-0.5 rounded text-[11px] font-mono font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/20 flex items-center gap-1">
                    <span className="material-symbols-outlined text-xs">verified</span>
                    {userPhotoCount} Gerçek Arşiv Referansı Aktif
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Cevher Dudayev ve Aslan Mashadov'un gerçek fotoğraflarını seçin; AI sahne üretimlerinde bu gerçek yüzü referans alır.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center bg-[#1c182b] border border-[#373052] rounded-xl px-2 py-1 text-xs">
              <span className="text-slate-400 mr-1.5 text-[11px]">Model:</span>
              <select
                value={selectedModel}
                onChange={(e) => onSelectModel(e.target.value)}
                disabled={isBatchRunning}
                className="bg-transparent text-amber-300 font-semibold focus:outline-none cursor-pointer text-xs"
              >
                <option value="🍌 Nano Banana Pro" className="bg-[#1c182b] text-white">
                  🍌 Nano Banana Pro (Önerilen)
                </option>
                <option value="🍌 Nano Banana 2.1" className="bg-[#1c182b] text-white">
                  🍌 Nano Banana 2.1
                </option>
                <option value="🍌 Nano Banana 2 Lite" className="bg-[#1c182b] text-white">
                  🍌 Nano Banana 2 Lite
                </option>
              </select>
            </div>

            {isBatchRunning ? (
              <button
                onClick={onStop}
                className="px-3.5 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">pause</span>
                <span>Durdur</span>
              </button>
            ) : (
              <button
                onClick={onGenerateAll}
                disabled={activeGeneratingIdx !== null}
                className="px-3.5 py-1.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 disabled:opacity-50 shadow-md"
              >
                <span className="material-symbols-outlined text-sm">auto_awesome</span>
                <span>Tümünü Sırayla Üret (9)</span>
              </button>
            )}

            <button
              onClick={onClose}
              className="w-8 h-8 rounded-lg bg-[#242036] text-slate-400 hover:text-white flex items-center justify-center hover:bg-[#342e4e] transition-colors"
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        </div>

        {/* Tip Banner */}
        <div className="bg-[#161324] border-b border-[#29243d] px-6 py-2.5 flex items-center justify-between text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-cyan-400 text-sm">verified_user</span>
            <span>
              <strong>Birebir Yüz Benzerliği Çözümü:</strong> Aşağıdaki hazır tarihi arşiv fotoğraflarından birine tıklayarak doğrudan referans atayabilir veya webden indirdiğiniz en net portreyi <span className="text-cyan-300 font-semibold">«Galeriden Seç»</span> ile bağlayabilirsiniz.
            </span>
          </div>
        </div>

        {/* Character Grid */}
        <div className="overflow-y-auto p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {characters.map((char, idx) => (
            <div
              key={char.name}
              className={`bg-[#181624] border rounded-xl p-4 flex flex-col justify-between gap-3.5 transition-all ${
                char.userReferenceMediaId
                  ? 'border-cyan-500/50 ring-1 ring-cyan-500/30 bg-[#161729]'
                  : char.referenceMediaId
                  ? 'border-emerald-500/35 ring-1 ring-emerald-500/20'
                  : char.status === 'error'
                  ? 'border-rose-500/40 bg-rose-950/10'
                  : 'border-[#2b273f] hover:border-amber-400/40'
              }`}
            >
              <div className="flex items-start gap-3">
                {/* Visual Preview Box */}
                <div className="flex flex-col items-center gap-1 shrink-0">
                  <div className="w-20 h-20 rounded-xl bg-[#0c0b12] border border-[#2e2a44] overflow-hidden flex items-center justify-center relative shadow-inner">
                    {char.userReferenceBase64 ? (
                      <img
                        src={`data:image/jpeg;base64,${char.userReferenceBase64}`}
                        alt="Gerçek Arşiv Referansı"
                        className="w-full h-full object-cover"
                      />
                    ) : char.avatarBase64 ? (
                      <img
                        src={`data:image/png;base64,${char.avatarBase64}`}
                        alt={char.name}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <span className="material-symbols-outlined text-slate-600 text-3xl">person</span>
                    )}

                    {(activeGeneratingIdx === idx || char.status === 'generating') && (
                      <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center gap-1 text-center p-1">
                        <span className="material-symbols-outlined text-amber-400 animate-spin text-base">
                          progress_activity
                        </span>
                        <span className="text-[9px] text-amber-300 font-mono font-bold">Üretiliyor</span>
                      </div>
                    )}

                    {char.userReferenceMediaId && (
                      <div
                        className="absolute bottom-1 right-1 bg-cyan-600 text-white rounded p-0.5 text-[9px] shadow flex items-center justify-center"
                        title="Gerçek tarihi arşiv fotoğrafı referans olarak kilitlendi"
                      >
                        <span className="material-symbols-outlined text-[11px] block">verified</span>
                      </div>
                    )}
                  </div>

                  {char.userReferenceMediaId ? (
                    <span className="text-[9px] font-mono text-cyan-300 font-semibold flex items-center gap-0.5">
                      <span className="material-symbols-outlined text-[10px]">image</span>
                      Gerçek Foto
                    </span>
                  ) : char.avatarBase64 ? (
                    <span className="text-[9px] font-mono text-emerald-400 font-semibold">✓ Model Hazır</span>
                  ) : null}
                </div>

                <div className="space-y-1 flex-1 min-w-0">
                  <div className="flex items-center gap-1 justify-between">
                    <h3 className="font-bold text-sm text-white truncate" title={char.name}>
                      {char.name}
                    </h3>
                  </div>

                  <span className="inline-block text-[10px] font-semibold text-amber-400 bg-amber-400/10 px-2 py-0.5 rounded border border-amber-400/20">
                    {char.role}
                  </span>

                  <p className="text-[11px] text-slate-300 leading-snug line-clamp-2 mt-1">
                    {char.description}
                  </p>
                </div>
              </div>

              {/* Curated Historical Archive Presets (Dudayev & Mashadov) */}
              {char.archivePresets && char.archivePresets.length > 0 && (
                <div className="p-2.5 rounded-xl bg-[#0f0e1a] border border-[#2d2847] space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-cyan-300 flex items-center gap-1">
                      <span className="material-symbols-outlined text-xs">auto_fix_high</span>
                      Tarihî Arşiv Portreleri (1-Tıkla Referans):
                    </span>
                    <span className="text-[9px] text-slate-400 font-mono">Gerçek Fotoğraf</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {char.archivePresets.map((preset) => (
                      <button
                        key={preset.id}
                        onClick={() => handleAdoptArchivePhoto(idx, preset)}
                        disabled={loadingArchiveId === preset.id}
                        className="group relative flex flex-col p-1.5 rounded-lg bg-[#181628] hover:bg-[#231f38] border border-[#322c4d] hover:border-cyan-400 text-left transition-all"
                        title={preset.description}
                      >
                        <div className="flex items-center gap-2">
                          <img
                            src={preset.url}
                            alt={preset.label}
                            className="w-8 h-8 rounded-md object-cover border border-[#3e375e] group-hover:scale-105 transition-transform"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="block text-[10px] font-bold text-slate-200 group-hover:text-cyan-300 truncate">
                              {preset.label}
                            </span>
                            <span className="block text-[8px] text-slate-400 truncate">
                              {loadingArchiveId === preset.id ? 'Yükleniyor...' : 'Seç & Kilitle'}
                            </span>
                          </div>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Likeness feature tags */}
              {char.likenessKeywords && (
                <div className="p-2 rounded-lg bg-[#0e0d16] border border-[#252238] space-y-1">
                  <span className="text-[9px] uppercase tracking-wider font-bold text-slate-400 flex items-center gap-1">
                    <span className="material-symbols-outlined text-[11px] text-cyan-400">fingerprint</span>
                    Karakteristik Yüz & Üniforma Belirteçleri:
                  </span>
                  <p className="text-[10px] text-slate-300 line-clamp-2 leading-relaxed font-sans">
                    {char.likenessKeywords}
                  </p>
                </div>
              )}

              {/* Prompt box with edit mode */}
              <div className="space-y-1">
                <div className="flex items-center justify-between text-[10px]">
                  <span className="font-bold text-slate-400">AI Promptu:</span>
                  {editingIdx === idx ? (
                    <button
                      onClick={() => handleSaveEdit(idx)}
                      className="text-emerald-400 hover:text-emerald-300 font-semibold flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-xs">check</span> Kaydet
                    </button>
                  ) : (
                    <button
                      onClick={() => handleStartEditing(idx)}
                      className="text-amber-400 hover:text-amber-300 font-semibold flex items-center gap-0.5"
                    >
                      <span className="material-symbols-outlined text-xs">edit</span> Düzenle
                    </button>
                  )}
                </div>

                {editingIdx === idx ? (
                  <textarea
                    value={editedPrompt}
                    onChange={(e) => setEditedPrompt(e.target.value)}
                    rows={3}
                    className="w-full bg-[#0a0910] border border-amber-400/50 rounded-lg p-2 text-[10px] font-mono text-amber-200 focus:outline-none"
                  />
                ) : (
                  <div
                    onClick={() => handleStartEditing(idx)}
                    className="p-2 rounded-lg bg-[#0c0a13] border border-[#221f33] text-[10px] font-mono text-slate-400 line-clamp-2 hover:border-[#3b3457] cursor-pointer"
                    title="Düzenlemek için tıklayın"
                  >
                    {char.stylePrompt}
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-2 pt-2 border-t border-[#262238] flex-wrap">
                <button
                  onClick={() => handleGenerate(idx)}
                  disabled={isBatchRunning || activeGeneratingIdx !== null}
                  className={`flex-1 py-1.5 px-2 text-xs font-semibold rounded-lg active:scale-95 transition-all flex items-center justify-center gap-1 disabled:opacity-50 ${
                    char.status === 'error'
                      ? 'bg-rose-600 hover:bg-rose-500 text-white'
                      : 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow'
                  }`}
                  title="Yapay zekâ ile model sayfası üret"
                >
                  <span className="material-symbols-outlined text-xs">
                    {char.avatarBase64 ? 'refresh' : 'smart_toy'}
                  </span>
                  <span>
                    {char.status === 'error'
                      ? 'Tekrar Dene'
                      : char.avatarBase64
                      ? 'Yenile'
                      : 'Avatar Üret'}
                  </span>
                </button>

                <button
                  onClick={() => handleSelectFromGallery(idx)}
                  className="px-2.5 py-1.5 rounded-lg bg-[#211d33] hover:bg-[#322c4d] text-cyan-300 hover:text-cyan-200 text-xs font-semibold flex items-center gap-1 border border-cyan-500/30 active:scale-95 transition-all"
                  title="Kendi indirdiğiniz veya arşivdeki bir portre fotoğrafını galeriden seçip referans ata"
                >
                  <span className="material-symbols-outlined text-xs">photo_library</span>
                  <span>{char.userReferenceMediaId ? 'Fotoğrafı Değiş' : 'Galeriden Seç'}</span>
                </button>

                <button
                  onClick={() => handleCopyPrompt(idx, char.stylePrompt)}
                  className="p-1.5 rounded-lg bg-[#242036] hover:bg-[#342e4e] text-slate-300 hover:text-white transition-colors"
                  title="Promptu Kopyala"
                >
                  <span className="material-symbols-outlined text-xs">
                    {copyToastIdx === idx ? 'check' : 'content_copy'}
                  </span>
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
