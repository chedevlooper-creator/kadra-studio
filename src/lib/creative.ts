import type { Project } from './types';
export function csvCell(value: unknown) {
  const text = String(value ?? '');
  return `"${(/^[=+@\-\t\r]/.test(text) ? "'" : '') + text.replace(/"/g, '""')}"`;
}
export function storyboardCsv(project: Project) {
  return '\uFEFF' + [['Kod','Sahne','Süre (sn)','Görsel','Kamera','Prompt','Ses / müzik','Dış ses / yazı'], ...project.scenes.map(scene => [scene.code,scene.group,scene.duration,scene.description,scene.camera,scene.prompt,scene.audioNotes,scene.screenText || scene.narration])].map(row => row.map(csvCell).join(',')).join('\r\n');
}
export function audioPlan(project: Project) {
  let elapsed = 0;
  return `${project.title} — Müzik ve ses yönetim planı\nToplam: ${project.duration} sn\n\n` + project.scenes.map(scene => {
    const start = elapsed; elapsed += scene.duration;
    return `[${start}–${elapsed} sn] ${scene.code || scene.order} · ${scene.title}\nMüzik / efekt: ${scene.audioNotes || 'Belirlenmedi'}\nDış ses / yazı: ${scene.narration || scene.screenText || 'Yok'}`;
  }).join('\n\n');
}
