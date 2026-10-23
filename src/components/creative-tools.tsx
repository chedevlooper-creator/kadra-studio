"use client";
import { useEffect, useRef, useState } from 'react';
import { Download, Mic, Square, Copy, Music, Users, Clapperboard, Film, Sparkles } from 'lucide-react';
import type { Project } from '@/lib/types';
import { audioPlan, storyboardCsv } from '@/lib/creative';
import MusicLane from './music-lane';

export function saveText(text: string, name: string, type = 'text/plain;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function CsvExport({project}:{project:Project}) {
  return <button type="button" className="studio-button studio-button-secondary" onClick={() => saveText(storyboardCsv(project),'storyboard.csv','text/csv;charset=utf-8')}><Download size={14}/>CSV indir</button>;
}
export function ProductionDirector({project,disabled,onCharacters,onFrames,onRegenerate,onFilm,onFull,onPaid,onCancel}:{project:Project;disabled:boolean;onCharacters:()=>void;onFrames:()=>void;onRegenerate:()=>void;onFilm:()=>void;onFull:()=>void;onPaid:()=>void;onCancel:()=>void}) {
  const steps=project.run?.steps ?? [];
  const active=steps.find(step=>step.status==='running');
  const frames=project.scenes.filter(scene=>scene.kind==='video');
  const stage=active?.kind==='character'?'Karakterler':active?.kind==='repair'?'Bölgesel onarım':active?.kind==='image'?'Sahne kareleri':active?.kind==='montage'?'Montaj':'Klipler';
  return <section className="creative-director" aria-label="Otomatik üretim yönetmeni">
    <div className="creative-stage-grid"><div><Users size={19}/><strong>1 · Karakterler</strong><span>{project.characters.filter(c=>c.sheet.status==='approved').length}/{project.characters.length} onaylı</span></div><div><Clapperboard size={19}/><strong>2 · Sahne kareleri</strong><span>{frames.filter(s=>s.imageSource==='generated').length}/{frames.length} üretildi</span></div><div><Film size={19}/><strong>3 · Klip ve montaj</strong><span>{project.output ? `${project.output.duration} sn film mevcut`:'Teslim bekleniyor'}</span></div></div>
    <p>Otomatik akış tariften karakterleri hazırlar, hakem onayından sonra karelere ve filme geçer. Değişmeyen kareler, klipler ve daha önce ödenmiş videolar yeniden üretilmez; hakemin yerini gösterdiği hatalar baştan üretilmek yerine yalnızca o bölge onarılarak düzeltilebilir. Fotoğrafa dayalı karakterler ve GMI referanslı kare/video üretimi ayrıca fiyat onayı gerektirir.</p>
    <div className="creative-actions">{project.run?.status==='running'?<><span role="status">{stage} · %{project.run.progress}</span><button className="studio-button studio-button-secondary" disabled={disabled} onClick={onCancel}><Square size={13}/>Durdur</button></>:<><button className="studio-button studio-button-primary" disabled={disabled} onClick={onFull}><Sparkles size={14}/>Tam akışı başlat</button><button className="studio-button studio-button-secondary" disabled={disabled} onClick={onCharacters}>Karakterler</button><button className="studio-button studio-button-secondary" disabled={disabled} onClick={onFrames} title="Yalnızca yeni, değişen ya da hakemin işaretlediği kareler üretilir">Yalnız kareleri üret</button><button className="studio-button studio-button-secondary" disabled={disabled} onClick={onRegenerate} title="Değişmeyenler dahil bütün kareler baştan üretilir">Tüm kareleri yenile</button><button className="studio-button studio-button-secondary" disabled={disabled} onClick={onFilm}>Mevcut karelerle film</button><button className="studio-button studio-button-secondary" disabled={disabled} onClick={onPaid}>AI video teklifi</button></>}</div>
  </section>;
}
export function MusicDirector({project,disabled,onProjectChange,notify}:{project:Project;disabled:boolean;onProjectChange:(p:Project)=>void;notify:(s:string)=>void}) {
  const prompt=project.title.toLocaleLowerCase('tr').includes('balonlar')?'Chechen folk dechig-pondar melody, male choir, epic cinematic drums, comedic tuba waltz, fast lezginka rock, dramatic crescendo, 120-140 BPM, instrumental, original composition':`Original instrumental cinematic score, ${project.style}, coherent recurring motif, contrasting scene dynamics. ${project.scenes.map(s=>s.audioNotes).filter(Boolean).join(' ').slice(0,1600)}`;
  return <div className="creative-tools"><h2>Müzik & ses yönetmenliği</h2><p>Çekimlerin ses notlarından müzik planını oluştur; seçtiğin parçayı filme ekle.</p><div className="creative-card"><h3>Beste yönlendirmesi</h3><p className="creative-prompt">{prompt}</p><div className="creative-actions"><button className="studio-button studio-button-secondary" onClick={async()=>{try{await navigator.clipboard.writeText(prompt);notify('Beste promptu kopyalandı.');}catch{notify('Panoya erişilemedi; metni seçerek kopyalayabilirsin.');}}}><Copy size={14}/>Promptu kopyala</button><button className="studio-button studio-button-secondary" onClick={()=>saveText(audioPlan(project),'ses-yonetim-plani.txt')}><Download size={14}/>Ses planını indir</button></div></div><MusicLane project={project} disabled={disabled} onProjectChange={onProjectChange} notify={notify}/><div className="creative-cue-list">{project.scenes.map(scene=><article className="creative-card" key={scene.id}><span>{scene.code || scene.order} · {scene.duration} sn</span><h3>{scene.title}</h3><p><Music size={13}/> {scene.audioNotes || 'Bu çekim için ses notu eklenmedi.'}</p></article>)}</div></div>;
}
export function VoiceoverStudio({project}:{project:Project}) {
  const recorder=useRef<MediaRecorder|null>(null), stream=useRef<MediaStream|null>(null), timer=useRef<ReturnType<typeof setTimeout>|null>(null),mounted=useRef(true),urlRef=useRef('');
  const [recording,setRecording]=useState(false),[requesting,setRequesting]=useState(false),[url,setUrl]=useState(''),[mime,setMime]=useState('audio/webm'),[error,setError]=useState('');
  useEffect(()=>{mounted.current=true;return()=>{mounted.current=false;if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();stream.current?.getTracks().forEach(t=>t.stop());if(urlRef.current)URL.revokeObjectURL(urlRef.current);};},[]);
  function stop(){if(timer.current)clearTimeout(timer.current);if(recorder.current?.state==='recording')recorder.current.stop();}
  async function record(duration:number){
    if(recording||requesting)return;setRequesting(true);setError('');
    try{
      if(!navigator.mediaDevices?.getUserMedia||typeof MediaRecorder==='undefined')throw Error('Bu tarayıcı mikrofon kaydını desteklemiyor.');
      const media=await navigator.mediaDevices.getUserMedia({audio:true});
      if(!mounted.current){media.getTracks().forEach(t=>t.stop());return;}
      stream.current=media;const type=['audio/webm;codecs=opus','audio/mp4','audio/webm'].find(t=>MediaRecorder.isTypeSupported(t));
      const rec=new MediaRecorder(media,type?{mimeType:type}:undefined);recorder.current=rec;const chunks:BlobPart[]=[];
      rec.ondataavailable=e=>{if(e.data.size)chunks.push(e.data);};
      rec.onstop=()=>{media.getTracks().forEach(t=>t.stop());if(timer.current)clearTimeout(timer.current);if(!mounted.current)return;setRecording(false);if(urlRef.current)URL.revokeObjectURL(urlRef.current);urlRef.current=URL.createObjectURL(new Blob(chunks,{type:rec.mimeType}));setUrl(urlRef.current);setMime(rec.mimeType);};
      rec.onerror=()=>{stop();setError('Kayıt sırasında hata oluştu.');};rec.start();setRecording(true);timer.current=setTimeout(stop,Math.min(120,duration)*1000);
    }catch(cause){stream.current?.getTracks().forEach(t=>t.stop());if(mounted.current)setError(cause instanceof Error?cause.message:'Mikrofon izni alınamadı.');}finally{if(mounted.current)setRequesting(false);}
  }
  const scripts=project.scenes.filter(s=>s.narration || (s.screenText && s.screenText!=='—'));
  return <div className="creative-tools"><h2>Dış ses & prova stüdyosu</h2><p>Çekim metinlerini prova et, mikrofonla kaydet ve indir. Kayıt bu sekmede tutulur; filme otomatik eklenmez. Sekmeden ayrılmadan indir.</p>{scripts.length?<div className="creative-cue-list">{scripts.map(scene=><article className="creative-card" key={scene.id}><span>{scene.code || scene.order} · {scene.duration} sn</span><h3>{scene.title}</h3><p className="creative-script">{scene.narration || scene.screenText}</p><button className="studio-button studio-button-secondary" disabled={recording||requesting} onClick={()=>void record(scene.duration)}><Mic size={14}/>{scene.duration} sn prova kaydı</button></article>)}</div>:<div className="creative-card"><p>Sahne düzenleyicisinden seslendirme metni ekleyebilirsin.</p><button className="studio-button studio-button-secondary" disabled={recording||requesting} onClick={()=>void record(30)}><Mic size={14}/>30 sn serbest prova</button></div>}{recording?<div className="creative-card" role="status"><p>Mikrofon kaydı sürüyor…</p><button className="studio-button studio-button-secondary" onClick={stop}><Square size={14}/>Kaydı bitir</button></div>:null}{url?<div className="creative-card"><audio controls src={url}/><a className="studio-button studio-button-secondary" href={url} download={`dis-ses-prova.${mime.includes('mp4')?'m4a':'webm'}`}><Download size={14}/>Prova kaydını indir</a></div>:null}{error?<p role="alert" className="studio-dialog-error">{error}</p>:null}</div>;
}
