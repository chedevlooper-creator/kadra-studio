import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectRepository } from './projects';
import { flowTemplate } from './templates/flow-template';
import { balonlarMasterTemplate } from './templates/balonlar-master';
import { audioPlan, storyboardCsv, csvCell } from './creative';
import { titleCardStyle, titleCardText } from './text';
import { sanitizeSatirePrompt } from './production/prompts';
async function fixture(t: { after: (fn: () => Promise<void>) => void }, nvidia = false) {
  const dir=await mkdtemp(path.join(os.tmpdir(),'kadra-flow-'));t.after(()=>rm(dir,{recursive:true,force:true}));
  return createProjectRepository(dir,{providers:async()=>({nvidia,gmi:false,ffmpeg:true})});
}
test('Flow template preserves 31 shots, 177 seconds, nine linked characters and no unverified external references',async t=>{
  const repository=await fixture(t);const template=flowTemplate('9:16');
  const project=await repository.importStoryboard(template);
  assert.equal(project.scenes.length,31);assert.equal(project.duration,177);assert.equal(project.characters.length,9);assert.equal(project.aspectRatio,'9:16');
  assert.ok(project.characters.every(c=>c.reference===null && c.sheet.status==='none'));
  assert.ok(project.scenes.find(s=>s.code==='0D')?.characterIds.includes('c2'));
  assert.equal(project.scenes[0].prompt,template.shots[0].aiPrompt);assert.equal(project.run,null);assert.equal(project.ledger.length,0);
  assert.match(storyboardCsv(project),/0A/);assert.match(audioPlan(project),/177/);assert.equal(csvCell('=CMD()'),'"\'=CMD()"');
});
test('frames stage ends without claiming a film and can be reloaded from disk',async t=>{
  const repository=await fixture(t);const p=await repository.importStoryboard({...flowTemplate(),shots:flowTemplate().shots.slice(0,1),characters:[]});
  const run=await repository.startRun(p.id,p.revision,'frames-stage-0001',null,{target:'frames'});
  assert.deepEqual(run.run?.steps.map(s=>s.kind),['image']);
  const claim=await repository.claimStep(`${process.pid}:frames`,60_000);
  await repository.completeStep(p.id,run.run!.id,claim!.step.id,{kind:'image',url:'/images/mountains.jpg',source:'reference',review:null,note:''});
  const finished=await repository.getProject(p.id);assert.equal(finished.run?.status,'completed');assert.equal(finished.status,'planned');assert.equal(finished.output,null);assert.equal(finished.scenes[0].status,"ready");
});
test('full pipeline puts character preparation before frames and clips; a missing verdict stops for review',async t=>{
  const repository=await fixture(t,true);const p=await repository.importStoryboard({...flowTemplate(),shots:flowTemplate().shots.slice(0,1),characters:flowTemplate().characters.slice(0,1)});
  const started=await repository.startRun(p.id,p.revision,'pipeline-char-0001',null,{prepareCharacters:true,reuseImages:true});
  assert.deepEqual(started.run?.steps.map(s=>s.kind),['character','image','clip','montage']);
  const claimed=await repository.claimStep(`${process.pid}:pipeline`,60_000);
  await repository.completeStep(p.id,started.run!.id,claimed!.step.id,{kind:'character',note:'Hakem yok',uncertain:false,failedSubmissions:0});
  const stopped=await repository.getProject(p.id);assert.equal(stopped.run?.status,'failed');assert.equal(await repository.claimStep(`${process.pid}:pipeline`,60_000),null);
});
test('full pipeline approves a passing character then continues to frame preparation',async t=>{
  const repository=await fixture(t,true);const p=await repository.importStoryboard({...flowTemplate(),shots:flowTemplate().shots.slice(0,1),characters:flowTemplate().characters.slice(0,1)});
  const started=await repository.startRun(p.id,p.revision,'pipeline-pass-0001',null,{prepareCharacters:true});
  const claim=await repository.claimStep(`${process.pid}:pass`,60_000);
  await repository.recordSheetAttempt(p.id,started.run!.id,claim!.step.id,{id:'pass-attempt',url:'/images/mountains.jpg',at:new Date().toISOString(),engine:'flux',verdict:{ok:true,scores:{style:5,traits:5,pose:5,clean:5},note:'Uygun'},cost:0});
  await repository.completeStep(p.id,started.run!.id,claim!.step.id,{kind:'character',note:'',uncertain:false,failedSubmissions:0});
  assert.equal((await repository.getProject(p.id)).characters[0].sheet.status,'approved');
  assert.equal((await repository.claimStep(`${process.pid}:pass`,60_000))?.step.kind,'image');
});
test('Balonlar master template and script auto-planner preserve all 32 shots, 12 characters, 4 red David and Goliath cards, and voiced Final spots',async t=>{
  const repository=await fixture(t);const master=balonlarMasterTemplate('16:9');
  const imported=await repository.importStoryboard(master);
  assert.equal(imported.scenes.length,32);assert.equal(imported.characters.length,12);assert.equal(imported.narration.engine,'local');
  const redTitles=imported.scenes.filter(s=>s.kind==='title' && titleCardStyle(s.description,`${s.title} ${s.screenText}`).isRed);
  assert.equal(redTitles.length,4);assert.ok(redTitles.every(s=>titleCardText(s.description)==='David and Goliath'));
  const voiced=imported.scenes.filter(s=>Boolean(s.narration.trim()));
  assert.equal(voiced.length,3);assert.match(voiced[0].narration,/Plastik doğaya ve vatanınıza zararlıdır/);
  assert.ok(imported.scenes.filter(s=>s.kind==='video').every(s=>s.promptEn===s.prompt && (s.code==='6A' || s.characterIds.length>0)));
  const rawCreated=await repository.createProject({title:'Balonlar',script:'İlk sahne: Dudayev ve Mashadov dağ olur.\n1. Sahne: Kadirov balon olur.\nSahne 10: Siyah ekranda kırmızı yazıyla David and Goliath\nFinal: Kamu spotu.',style:'Sinematik',aspectRatio:'16:9',budget:null});
  const planned=await repository.planProject(rawCreated.id,rawCreated.revision);
  assert.equal(planned.scenes.length,32);assert.equal(planned.characters.length,12);assert.equal(planned.narration.engine,'local');
  assert.match(sanitizeSatirePrompt('öldürülmüş bir çocuk ve kanlı dolarlar. Sahnede rusya bayrağı dışında asla bayrak olmayacak.'),/Only the Russian tricolor flag/i);
});
