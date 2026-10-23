import React, { useState } from 'react';
import { Flow } from 'flow-sdk';

export const MusicDirectorView: React.FC = () => {
  const [sunoCopied, setSunoCopied] = useState(false);
  const sunoPrompt =
    'Chechen folk dechig-pondar melody, male choir, epic cinematic drums, transitioning to comedic tuba waltz, then fast lezginka rock, satirical cartoon orchestration, dramatic crescendo, 120-140 BPM, high production value';

  const handleCopySuno = async () => {
    await navigator.clipboard.writeText(sunoPrompt);
    setSunoCopied(true);
    setTimeout(() => setSunoCopied(false), 2000);
  };

  const handleExportAudioPlan = async () => {
    const textPlan = `BALONLAR VE DAĞLAR - MÜZİK VE SES YÖNETİM PLANI
Süre: 177 sn (2:57)
Genel Yapı: Kuzey Kafkas (Vaynah) halk motifleri + sinematik orkestra + karikatür hiciv enstrümantasyonu.

1. DAĞLAR & KAHRAMANLAR TEMASI (0:00 - 0:26 & 2:38 - 2:54):
- Vainakh erkek korosu, derin doul davulları, dechig-pondar tınıları.
- Asla komik kullanılmaz, kutsal ve saygı duyulan dağ dünyası.

2. AHMAD KADİROV (0:26 - 0:43):
- Yavaş vals (3/4, ~90 BPM): Tuba + pizzicato yaylılar.
- Her pompa vuruşu ritme kilitli: 'fıs... fıs... fıs'.

3. RAMZAN KADİROV (1:05 - 1:15):
- Vals temasının 2x hızlandırılmış versiyonu (~140 BPM): Lezginka davulu + sert elektro gitar.

4. EMİR ŞAHİN (1:35 - 1:48):
- Arabesk / romantik Türk pop parodisi, Maraş dondurmacı zili, 4x hızda pompa ve chipmunk gülüşü.

5. IŞIK KURDU KLİMAKSI (2:03 - 2:31):
- Kalp atışı ritminden devasa kreşendoya geçiş.
- Kurt uluması zirve notasına kilitli, tek pençe darbesinde pitch-down yavaşlama.
- Normal hıza dönüşte zincirleme POP-POP-POP davul atakları ve tavuk gıt-gıdak efekti.

6. KAMU SPOTU (2:31 - 2:38):
- 80'ler TRT kamu spotu synth 'ding-dong' jingle parodisi + daktilo sesleri.
`;

    const bytes = new TextEncoder().encode(textPlan);
    const base64 = btoa(Array.from(bytes, (b) => String.fromCharCode(b)).join(''));
    await Flow.download({
      base64,
      mimeType: 'text/plain',
      filename: 'balonlar_ve_daglar_ses_plani.txt',
    });
  };

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="p-5 rounded-2xl bg-[#14121f] border border-[#2b2742] flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-amber-400">graphic_eq</span>
            <h2 className="text-white font-bold text-lg">Müzik & Ses Miksaj Yönetmenliği</h2>
          </div>
          <p className="text-xs text-slate-300 max-w-2xl leading-relaxed">
            Klip iki işitsel evren arasında salınır: Destansı Kuzey Kafkas (Vaynah) korosu ve dechig-pondar tınıları ile
            hiciv sahnelerindeki tırmanan pompa valsi & lezginka-rock.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopySuno}
            className="px-3.5 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold text-xs flex items-center gap-1.5 transition-all active:scale-95 shadow-lg"
          >
            <span className="material-symbols-outlined text-sm">{sunoCopied ? 'check' : 'music_note'}</span>
            <span>{sunoCopied ? 'Kopyalandı!' : 'Suno / Udio Promptu'}</span>
          </button>
          <button
            onClick={handleExportAudioPlan}
            className="px-3 py-2 rounded-xl bg-[#242036] hover:bg-[#342e4e] text-slate-200 text-xs font-semibold transition-colors flex items-center gap-1"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            <span>Ses Planını İndir</span>
          </button>
        </div>
      </div>

      {/* 3 Escalating Stages of Satire */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="p-4 rounded-xl bg-[#161423] border border-[#29243c] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-amber-400">1. POMPA: AHMAD</span>
            <span className="font-mono text-[10px] text-slate-400">~90 BPM (3/4)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Tuba + Pizzicato Valsi:</strong> Yavaş, ağırbaşlı ve absürt. Putin soğukkanlı sırıtan iş adamı. Kasa
            "çın!" sesi ve lastik gıcırtıları.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#161423] border border-[#29243c] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-rose-400">2. POMPA: RAMZAN</span>
            <span className="font-mono text-[10px] text-slate-400">~140 BPM (4/4)</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>2x Hızda Vals → Lezginka-Rock:</strong> Distorsiyon elektro gitar ve lezginka davulu. Putin öfkeli,
            morarmış ve terliyor. Çizgi film silah "pew pew" efektleri.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#161423] border border-[#29243c] space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold text-purple-400">3. POMPA: EMİR ŞAHİN</span>
            <span className="font-mono text-[10px] text-slate-400">Hiper Hızlı & Absürt</span>
          </div>
          <p className="text-xs text-slate-300 leading-relaxed">
            <strong>Arabesk Pop & Chipmunk:</strong> En absürt aşama. 4x hızda pompa, dondurmacı zili, arka ekranda
            Putin koltuğunda çay yudumlayarak izliyor.
          </p>
        </div>
      </div>

      {/* Climax & Finale Audio Guide */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="p-4 rounded-xl bg-[#111624] border border-[#1f2c45] space-y-2">
          <span className="text-xs font-bold text-cyan-400 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">pets</span>
            Işık Kurdu & Büyük Patlama (Klimaks)
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            Kalabalık koşarken kalp atışı doul vuruşu. Dev kurt ayağa kalkarken epik koro kreşendosu ve uluma senkronu.
            Pençe darbesinde süper slow-motion pitch-down. Ardından zincirleme POP-POP-POP davul atakları ve komik tavuk
            "gıt-gıdak" sesi.
          </p>
        </div>

        <div className="p-4 rounded-xl bg-[#1f1a14] border border-[#3b2d1c] space-y-2">
          <span className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm">campaign</span>
            Kamu Spotu & Gün Doğumu Kapanışı
          </span>
          <p className="text-xs text-slate-300 leading-relaxed">
            80'ler nostaljik TRT kamu spotu synth 'ding-dong' tınısı ve daktilo mekanik tıkırtıları. Ardından sisli dağlar
            arasında tek bir hüzünlü dechig-pondar teli ve ağırbaşlı erkek koro mırıltısı.
          </p>
        </div>
      </div>
    </div>
  );
};
