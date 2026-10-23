import data from './balonlar.json';
import type { AspectRatio } from '../types';
import type { StoryboardShot } from '../planner';

const aliases = [
  ['Dudayev', 'Dzhokhar', 'Cevher', 'Gehi-Çu'], ['Mashadov', 'Maskhadov'],
  ['Şamil', 'Shamil', 'Mansur', 'Baysungur', 'Baysangur'], ['Putin'],
  ['Ahmad', 'Akhmad'], ['Ramzan'], ['Emir', 'Şahin', 'fez'], ['Medet', 'Önlü'], ['kurt', 'wolf', 'Borz'],
];
/** Local data only. Archive URLs in the original are deliberately not treated as verified photo references. */
export function flowTemplate(aspectRatio: AspectRatio = '16:9') {
  return {
    title: 'Balonlar ve Dağlar · Flow', style: '3D karikatür hiciv / fotogerçekçi anıt dağlar', aspectRatio, budget: null,
    shots: data.shots.map(({ id, sceneId, sceneTitle, durationSec, timeRange, visualSummary, cameraMovement, aiPrompt, audioCues, voiceoverOrText }) => ({ id, sceneId, sceneTitle, durationSec, timeRange, visualSummary, cameraMovement, aiPrompt, audioCues, voiceoverOrText })) as StoryboardShot[],
    characters: data.characters.map((item, index) => ({ name: item.name, appearance: `${item.description} ${item.likenessKeywords ?? ''}`.slice(0,1200), aliases: aliases[index], style: item.stylePrompt.replace(/100% accurate historical likeness/g, 'historical likeness').slice(0,400) })),
  };
}
