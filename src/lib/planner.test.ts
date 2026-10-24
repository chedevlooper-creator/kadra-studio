import assert from "node:assert/strict";
import test from "node:test";
import { parseScript, planScenes, scenesFromStoryboard, scriptFromStoryboard } from "./planner";

test("Turkish, intro, final and repeated numbered labels preserve every shot", () => {
  const script = "Intro: Gökyüzü açılır.\n\nİlk sahne: Yolcu ilerler.\nSahne 1: Çocuk durur.\nSahne 1: Kapı açılır.\n1. Sahne: Rüzgâr eser.\nFİNAL: Ufuk aydınlanır.\nSahne 2: Sonraki güne geçilir.";
  const segments = parseScript(script);
  assert.equal(segments.length, 7);
  assert.deepEqual(segments.map((segment) => segment.content), ["Gökyüzü açılır.", "Yolcu ilerler.", "Çocuk durur.", "Kapı açılır.", "Rüzgâr eser.", "Ufuk aydınlanır.", "Sonraki güne geçilir."]);
  assert.equal(segments[1].title, "İlk sahne");
});

test("unlabeled paragraphs become scenes without sentence truncation", () => {
  const description = "Güneş kaybolur. " + "Ayrıntı korunur. ".repeat(100);
  const segments = parseScript(`${description}\n\nBir yolcu patikaya adım atar.\nSis yavaşça dağılır.`);
  assert.equal(segments.length, 2);
  assert.equal(segments[0].content, description.trim());
  assert.match(segments[1].content, /Sis yavaşça dağılır/);
});

test("preamble and blank label content remain in the plan", () => {
  const segments = parseScript("Filmin bütününde yumuşak ışık kullan.\nİlk sahne:\nDağ görünür.\nFinal:");
  assert.equal(segments.length, 3);
  assert.equal(segments[0].content, "Filmin bütününde yumuşak ışık kullan.");
  assert.equal(segments[2].content, "Final");
});

test("heuristic planner marks reference images and picks the paid production method", () => {
  const scenes = planScenes("Sahne 1: Yolcu patikada ilerler.\nFinal: Yazı kartı: Yol devam eder.", "Sinematik", "/images/mountains.jpg");
  assert.equal(scenes[0].kind, "video");
  assert.equal(scenes[1].kind, "title");
  assert.equal(scenes[0].image, "/images/mountains.jpg");
  assert.ok(scenes.every((scene) => scene.status === "draft" && scene.imageSource === "reference" && scene.notes.some((note) => note.includes("dil modeli kullanılmadı"))));
  assert.equal(scenes[0].model, "GMI video · yapay zekâ");
  assert.equal(scenes[1].model, "Yazı kartı");
  assert.match(scenes[1].modelReason, /eksiksiz/);
});

test("parser rejects bounds rather than silently dropping shots", () => {
  assert.throws(() => parseScript("kısa"), /en az 10/);
  assert.throws(() => parseScript("x".repeat(30_001)), /30.000/);
  assert.throws(() => parseScript(Array.from({ length: 41 }, (_, index) => `Sahne ${index + 1}: Ufuk görünür.`).join("\n")), /en fazla 40/);
});

const storyboard = [
  { id: "0A", sceneId: "SAHNE 0", sceneTitle: "AÇILIŞ", durationSec: 6, timeRange: "0:00–0:06", visualSummary: "Gece, karlı bozkır yolu. Bir cip durur.", cameraMovement: "Geniş plan, yavaş dolly-in", aiPrompt: "Night road. Style: stylized 3D animation, 16:9.", audioCues: "Rüzgâr.", voiceoverOrText: "Alt köşe, daktilo: «Gehi-Çu, 1996»" },
  { id: "F2", sceneId: "FİNAL", sceneTitle: "KAPANIŞ", durationSec: 16, visualSummary: "Sisli dağlar.", aiPrompt: "Misty mountains.", voiceoverOrText: "—" },
  { id: "F3", sceneId: "FİNAL", sceneTitle: "KAPANIŞ", durationSec: 3, visualSummary: "Siyah ekran, kanal logosu ve yasal hiciv uyarısı.", cameraMovement: "Sabit grafik kadrajı.", aiPrompt: "Pure black screen with typography.", voiceoverOrText: "«Hiciv eseridir; kişilerin kamuya açık eylem ve tutumlarını eleştirir.»" },
];

test("storyboard shots keep their prompts, timings and notes; black-screen cards become drawn title cards", () => {
  const scenes = scenesFromStoryboard(storyboard, "/images/mountains.jpg");
  assert.deepEqual(scenes.map((scene) => [scene.code, scene.kind, scene.duration]), [["0A", "video", 6], ["F2", "video", 16], ["F3", "title", 3]]);
  assert.equal(scenes[0].title, "0A · Gece, karlı bozkır yolu.");
  assert.equal(scenes[0].group, "SAHNE 0 · AÇILIŞ");
  assert.equal(scenes[0].prompt, storyboard[0].aiPrompt);
  assert.equal(scenes[0].screenText, "Alt köşe, daktilo: «Gehi-Çu, 1996»");
  assert.equal(scenes[0].audioNotes, "Rüzgâr.");
  assert.equal(scenes[1].screenText, "", "a dash means no text");
  assert.equal(scenes[1].camera, "Yavaş yaklaşma");
  assert.equal(scenes[2].description, "Hiciv eseridir; kişilerin kamuya açık eylem ve tutumlarını eleştirir.");
  const script = scriptFromStoryboard(storyboard);
  assert.match(script, /^Sahne 0 – 0A: Gece/);
  assert.equal(parseScript(script).length, 3, "the generated script re-plans into the same number of shots");
});

const USER_BALONLAR_SCRIPT = `İlk sahne

 Dudayevin bulunduğu arabaya güdümlü füze düşer melek olarak yükselen ruh ve cahar dudayev devasa bir dağa dönüşür yanında yine dağ olarak şeyh mansur, imam şamil, baysangur vs dağ dudayevde saplı içkerya bayrağını insan Aslan mashadov eline alır

1. Sahne
Altınlar dolarlar ettafta ahmed kadirov (kolunda rusya bayrağı rozeti var) yere putinin önünde boyun eğmiş halde eğilmiş putin  ona ağzından balon pompasıyla hava veriyor ahmad kadirov gitgide balona dönüp şişen ahmed kadirov kan damlayan bir kalemle ihanet anlaşması imzalayıp kafası elleri ve ayakları gözüken balon olarak havaya uçuyor. Sahnede rusya bayrağı dışında asla bayrak olmayacak

Sahne 2 
Dudayev dağının etrafında uçan ahmed kadirov balonu dağın içinden uzanan el detayı tutuyor içkerya bayrağı  bayrağın alemi ile ahmed kadirov balonuna değip balonu patlatıyor

Sahne 3 
Putin morarmış kara kara düşünüyor

Sahne 4

Pembe kırmızı russia başlığıyla ayıya sarılmış ramzan kadirov gerçek fotoğrafı yanakları pembeleşiyor

Sahne 5
Putin çok daha sinirli daha çok para var ramzan kadirov  putin önünde diz çökmüş putinin elinde hava pompa kadirovun ağzında onu balon gibi şişiriyor. Kadirov gitgide şişiyor taki balon formuna geçip havalanana kadar ve putin tam balon formundayken sahnedeki ak 47yi kadirovun eline veriyor

Sahne 6

Eline silah verilen maymun videosundan kesit

Sahne  7

Kadirov ilk sahnedeki cahar dudayev, mashadov, imam şamil, imam mansur dağları arasında balon olmuş uçuyor silahı ateşliyor. Ağzından çıkan bokları dağların eteklerine sığınmış insanların üstüne fırlatıyor. Diğer eliyle kanlı dolar atıyor. Doları alan insanlar bok içinde  tıpkı onun gibi balon olup uçmaya başlıyor.
 
Sahne 8
Kadirov daudov delimxanov balonları gökyüzünde yüzlerinde iğrenç ifadeler ağızlarından katran saçarak dans ediyor

Sahne 10 
Yüzleri maskeli balon polisler genç bir çeçeni kaçırıyor

Siyah ekranda kırmızı yazıyla David and Goliath

Sahne 11
Yerde yatan öldürülmüş bir çocuk ve başında ak 47 ile bekleyen balon polis

Siyah ekranda kırmızı yazıyla David and Goliath

Sahne 12 

Yaşlı bir çeçen kadın balon polisler dövüyor

Siyah ekranda kırmızı yazıyla David and Goliath

Sahne 13 gazeteci anna politskaya kalemiyle balonları patlatıyor

 Siyah ekranda kırmızı yazıyla David and Goliath

Sahne 8
Dondurmacı tezgahında başı fesli emir şahin bu sefer balon kadirovun elinde pompa görünce gözlerinden kalp çıkıp domalıyor balon ramzan onu şişirip balonlaştırmaya başlıyor.

Sahne 9
Emir şahin balonu elinde dolar dolu çantalar medet önlü dağ halinin yanında semalarında uçuyor kanlı dolarlar atıyor. Medet dağı sinirle ona bakıyor.

Sahne 10

Başka balonlar emir şahine katılıyor

Sahne 11 
Kafkasyada dudayev, mashadov, mansur vs dağları eteklerindeki sinmiş insanlar dayanamayıp dağlardan taşlar kopararak sapanlarla balon askerlere fırlatıyor balonlar bir bir patlıyor

Sahne 12 
Türkiyede kızıl saçlı bir çocuk önce yakın çekim düşünceli sonra yüzünde bir anda öfke beliriyor, tüm bedeni gözükür çekimde medet dağından taşlar kopararak sapanla balonları vurmaya başlıyor. 
 

Sahne 13 
Cahar şamil maskhadov baysangur dağları etrafındaki sapanlı insanlar bir araya toplanıyor toplandıkça kalabalık insan formu tek bir kurta dönüşüyor ve kadirov ve kalan tüm balonları tek pençe atışıyla patlatıyor. Tavuk tüyleri havada uçuşuyor 

Sahne 14
Balon ayı kostümü giymiş putin balonun havasını indirip normal hale dönüyor ve kurta bakıp korkuyla sırıtıyor

Final
Daktilo yazısı ve seslendirme ile kamu spotu
 1. Spot
Plastik doğaya ve vatanınıza zararlıdır. Bir gün patlayacak plastik balonlar olmayın.

1. Spot
Milletleri oluşturan temel yapı taşlarından vazgeçerseniz o milletten olma iddianızdan vazgeçmişsiniz demektir.
Bu milletin  tüm vatanını zapt etseniz dahi anıt dağlar gibi yükselmek sizin için hayaldir. Ancak bir balon gibi hızla şişer, uçar ve patlayıp gidersiniz. bana tek seferde hatasız böyle bir video üretecek sistem`;

test("raw Balonlar ve Dağlar script parses uncolon headers, David and Goliath red cards, and both public service spots", () => {
  const scenes = planScenes(USER_BALONLAR_SCRIPT, "Sinematik", "/images/mountains.jpg");
  assert.equal(scenes.length, 26);
  const redCards = scenes.filter((scene) => scene.kind === "title" && scene.description.includes("David and Goliath"));
  assert.equal(redCards.length, 4, "all four David and Goliath intertitles become separate title cards");
  const politkovskaya = scenes.find((scene) => scene.description.includes("anna politskaya"));
  assert.ok(politkovskaya, "Sahne 13 without colon is parsed as its own scene");
  assert.equal(politkovskaya.kind, "video");
  const spots = scenes.filter((scene) => scene.title.includes("Spot"));
  assert.equal(spots.length, 2, "both Final public service spots are separated");
  assert.ok(spots.every((spot) => spot.kind === "title" && spot.narration.length > 20));
  assert.doesNotMatch(spots[1].narration, /bana tek seferde/, "trailing prompt request is stripped");
});
