import { ShotItem, CharacterReference } from './types';

export const STORYBOARD_SHOTS: ShotItem[] = [
  // SAHNE 0
  {
    id: '0A',
    sceneId: 'SAHNE 0',
    sceneTitle: 'AÇILIŞ: DAĞLARIN DOĞUŞU',
    durationSec: 6,
    timeRange: '0:00–0:06',
    visualSummary: 'Gece, karlı bozkır yolu (Nisan 1996, Gehi-Çu). UAZ araç yanında Cevher Dudayev uydu telefonuyla konuşur. Kırmızı sinyal çizgisi, yaklaşan roket, beyaz flaş.',
    cameraMovement: 'Geniş plan, yavaş dolly-in; patlamada beyaz flaşa kesme.',
    aiPrompt: 'Night, snowy rural road in the North Caucasus, April 1996. An old Soviet UAZ military jeep parked in a snow field; Dzhokhar Dudayev in exact photographic facial likeness (gaunt sharp cheekbones, high forehead, neatly trimmed dark moustache, piercing eyes, authentic Soviet Air Force Major General peaked visor service cap with emerald-green band and gold wings cockade, dark military winter coat with shoulder boards) speaks on an INMARSAT satellite phone. A thin red laser/signal beam ascends into stormy night sky; a guided missile follows the beam downwards toward the vehicle. Pure white flash before impact, zero gore. Stylized 3D cinematic caricature animation with photoreal likeness, dramatic lighting, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Sessizlik → rüzgâr, uzak köpek havlaması. Tek bir pondur (dechig-pondar) teli; roket ıslığı yaklaşır; patlamada 2 sn mutlak sessizlik.',
    voiceoverOrText: 'Alt köşe, daktilo: «Gehi-Çu, 21 Nisan 1996»'
  },
  {
    id: '0B',
    sceneId: 'SAHNE 0',
    sceneTitle: 'AÇILIŞ: DAĞLARIN DOĞUŞU',
    durationSec: 6,
    timeRange: '0:06–0:12',
    visualSummary: 'Beyaz flaştan ve dumandan ışıklı kanatlı bir ruh yükselir: Dudayev yüz hatları, sakin melek figürü. Kar taneleri yukarı akar (zaman durmuş hissi).',
    cameraMovement: 'Tilt-up, ruhu takip eden yavaş vinç hareketi.',
    aiPrompt: 'From a blinding white flash and swirling smoke, a radiant winged spirit ascends serenely into the snowy night sky; its face bears the exact photographic likeness of Dzhokhar Dudayev (trim moustache, Soviet Air Force visor cap with golden badge, calm sovereign gaze) sculpted from pure ethereal golden-white luminescence. Snowflakes float suspended in mid-air as if time stopped. Slow crane-up following the spirit. Style: stylized 3D animation, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Erkek koro (vainakh tarzı, kelimesiz uzun "aaa" notası) girer; tek davul vuruşu.',
    voiceoverOrText: '—'
  },
  {
    id: '0C',
    sceneId: 'SAHNE 0',
    sceneTitle: 'AÇILIŞ: DAĞLARIN DOĞUŞU',
    durationSec: 8,
    timeRange: '0:12–0:20',
    visualSummary: 'Ruh ufka iner, ışık kayaya dönüşür; dev dağ yükselir — zirvesi Dudayev taş yüzü. Yanında Şeyh Mansur, İmam Şamil, Baysungur anıt dağları belirir.',
    cameraMovement: 'Hızlı pull-back → epik geniş plan; bulutlar dağların önünden geçer.',
    aiPrompt: 'The glowing spirit touches down onto the Caucasus horizon and crystalizes into massive granite: a colossal mountain rises, its peak sculpted into the monumental stone portrait of Dzhokhar Dudayev (military peaked cap, trimmed moustache, hollow cheeks, majestic steadfast expression). Pull back reveals a row of monumental Mount Rushmore-style rock faces: Sheikh Mansur, Imam Shamil in a tall papakha with long beard, one-eyed Baysangur of Benoy with an eye patch, all crowned with glacier snow and fur papakhas of ice. Photoreal epic mountain range, god-rays breaking through storm clouds, 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Koro tam güç; derin davullar; pondur melodisi ana temayı ilk kez çalar.',
    voiceoverOrText: 'İsim etiketleri: «Şeyh Mansur · İmam Şamil · Baysungur · Cevher Dudayev»'
  },
  {
    id: '0D',
    sceneId: 'SAHNE 0',
    sceneTitle: 'AÇILIŞ: DAĞLARIN DOĞUŞU',
    durationSec: 6,
    timeRange: '0:20–0:26',
    visualSummary: 'Dudayev zirvesinde İçkerya bayrağı ve dev taş el. Dağ eteğinde Aslan Mashadov. Taş el eğilip Mashadov\'a bayrak devreder; Mashadov bayrağı kaldırır.',
    cameraMovement: 'Low-angle Mashadov\'dan dağa tilt-up, sonra tekrar Mashadov\'a; rüzgârda slow-motion.',
    aiPrompt: 'At the summit of the colossal Dudayev mountain, a giant green flag of Ichkeria with bottom stripes is held in an enormous stone hand. At the foothills below, human-sized Aslan Maskhadov in exact photographic likeness (distinct bushy grey moustache, weathered wise face, traditional black astrakhan fur papakha hat, camouflage combat field jacket) looks up with pride; the gigantic stone hand lowers gently to pass him a battle flag; he hoists it into the Caucasus wind. Low-angle hero shot, slow-motion cloth physics, snow particles. 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Müzik nefes alır; tek pondur cümlesiyle sahne kapanır. Sert kesme.',
    voiceoverOrText: '—'
  },

  // SAHNE 1
  {
    id: '1A',
    sceneId: 'SAHNE 1',
    sceneTitle: '1. POMPA: AHMAD KADİROV',
    durationSec: 5,
    timeRange: '0:26–0:31',
    visualSummary: 'Altın duvarlı, kan damlayan dolar desteleriyle dolu sığınak. Ahmad Kadirov kollarını açar, göz bebekleri dolar işaretine döner.',
    cameraMovement: 'Altın yığınlarının üzerinden kayan yavaş dolly; Kadirov\'un gözlerine snap-zoom.',
    aiPrompt: 'Lavish bunker room overflowing with gold bars and stacks of US dollars, money bags stained with dripping red, warm greedy golden light. Caricature of Akhmad Kadyrov (grey beard, tall white papakha, dark suit) stares at the treasure, his pupils turning into dollar signs. Slow dolly across gold piles, snap zoom on his eyes. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Vals başlar: tuba "um-pa-pa", pizzicato yaylılar; kasa çekmecesi "çın!" efekti.',
    voiceoverOrText: '—'
  },
  {
    id: '1B',
    sceneId: 'SAHNE 1',
    sceneTitle: '1. POMPA: AHMAD KADİROV',
    durationSec: 6,
    timeRange: '0:31–0:37',
    visualSummary: 'Kadirov öne eğilir; arkasında Putin sırıtır, bisiklet pompasıyla Kadirov\'un kemerindeki valften şişirir. Her fısta düğmeler fırlar.',
    cameraMovement: 'Sabit orta plan (sitcom); her pompa vuruşunda hafif kamera sarsıntısı.',
    aiPrompt: 'Caricature of Vladimir Putin (navy suit, red tie, smug calm half-smile) slowly works a brass bicycle floor pump; its hose connects to an inflatable-toy valve on the belt of a bent-over caricature Akhmad Kadyrov, who swells up like a shiny rubber balloon with each pump, buttons popping off comically. Gold and dollars all around. Static medium shot, slight camera bump on each stroke. Slapstick comedy. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Her pompa vuruşu vals vuruşuna denk: "fıs… fıs… fıs". Lastik gerilme gıcırtıları.',
    voiceoverOrText: '—'
  },
  {
    id: '1C',
    sceneId: 'SAHNE 1',
    sceneTitle: '1. POMPA: AHMAD KADİROV',
    durationSec: 6,
    timeRange: '0:37–0:43',
    visualSummary: 'Balon-Kadirov kan damlayan dolma kalemle İHANET ANTLAŞMASI imzalar; ayakları yerden kesilip tavandaki kapaktan uçar. Putin el sallar.',
    cameraMovement: 'Kalem ucunda makro insert → balonu takip eden tilt-up.',
    aiPrompt: 'Close-up: a fountain pen dripping red ink like blood signs a parchment titled "TREATY OF BETRAYAL" (Turkish: "İHANET ANTLAŞMASI"). Then the fully inflated balloon-shaped caricature of Akhmad Kadyrov lifts off the floor and floats up through an open hatch in the ceiling while caricature Putin waves goodbye with a smug smile. Macro insert then tilt-up. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Vals yükselen glissando ile biter; balon gıcırtısı.',
    voiceoverOrText: 'Parşömen başlığı: «İHANET ANTLAŞMASI»'
  },

  // SAHNE 2
  {
    id: '2A',
    sceneId: 'SAHNE 2',
    sceneTitle: 'İLK PATLAMA',
    durationSec: 6,
    timeRange: '0:43–0:49',
    visualSummary: 'Balon-Kadirov, Dudayev dağının etrafında tur atıp dil çıkarır. Dağın taş gözleri ağırbaşlılıkla ona döner.',
    cameraMovement: 'Balonun etrafında 180° orbit; dağın gözlerine yavaş push-in.',
    aiPrompt: 'A smug balloon-shaped caricature of Akhmad Kadyrov floats in circles around a colossal mountain carved with Dzhokhar Dudayev\'s face, sticking out his tongue. The stone eyes of the mountain slowly turn to follow him. 180-degree orbit camera, slow push-in on the stone eyes. Style: photoreal epic Caucasus mountain range where peaks are carved into giant stone faces (Mount Rushmore-like), snow, glaciers, low clouds, god-rays through storm clouds, 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Vals temasının kırık/akortsuz versiyonu; alttan pondur gerilim teli.',
    voiceoverOrText: '—'
  },
  {
    id: '2B',
    sceneId: 'SAHNE 2',
    sceneTitle: 'İLK PATLAMA',
    durationSec: 5,
    timeRange: '0:49–0:54',
    visualSummary: 'Dağdan çıkan dev taş el, bayrağın sivri mızrak ucuyla balona dokunur — PAT! Balon fırıl fırıl sönüp vınlayarak ufka kaçar, havaya dolarlar saçılır.',
    cameraMovement: 'Sabit geniş plan; patlamada 6 karelik freeze-frame + zoom.',
    aiPrompt: 'A gigantic stone hand emerges from the Dudayev mountain holding the Ichkeria flag and pokes the floating balloon caricature with the flag\'s spear-tip finial. The balloon bursts with a cartoon POP, deflates and zips away across the sky like a released party balloon, leaving a shower of fluttering dollar bills. Freeze-frame on the pop. Style: photoreal epic Caucasus mountain range where peaks are carved into giant stone faces (Mount Rushmore-like), snow, glaciers, low clouds, god-rays through storm clouds, 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Müzik durur → büyük "POP!" → söner balon "vıııınnn" sesi; tek pondur akoru.',
    voiceoverOrText: '—'
  },

  // SAHNE 3
  {
    id: '3A',
    sceneId: 'SAHNE 3',
    sceneTitle: 'MOR PUTİN',
    durationSec: 5,
    timeRange: '0:54–0:59',
    visualSummary: 'Putin dev masasında; yüzü mora döner, kulaklarından buhar çıkar, parmaklarıyla ritim tutar. Arkasında boş bisiklet pompası.',
    cameraMovement: 'Yavaş push-in, sonu ekstrem yakın plan (kısılan göz).',
    aiPrompt: 'Caricature of Vladimir Putin sitting at a huge empty desk in a dim Kremlin office, his face slowly turning deep purple, tiny puffs of steam from his ears, drumming his fingers, an idle bicycle pump leaning behind him. Slow push-in to extreme close-up of his narrowed eyes. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Tik-tak saat; düşük homurdanan kontrbas.',
    voiceoverOrText: '—'
  },

  // SAHNE 4
  {
    id: '4A',
    sceneId: 'SAHNE 4',
    sceneTitle: 'RAMZAN VE AYI',
    durationSec: 6,
    timeRange: '0:59–1:05',
    visualSummary: 'Ramzan Kadirov (gür sakal, kamuflaj), üzerinde RUSYA kurdelesi olan dev peluş ayıya sıkıca sarılır; yanakları kızarır, kalpler uçar.',
    cameraMovement: 'Yavaş orbit; sonda yanaklara rack-focus.',
    aiPrompt: 'Caricature of Ramzan Kadyrov (big bushy beard, round cheeks, dark military uniform with Russian flag patch) tightly hugging a giant plush brown bear wearing a pink-red sash with the word "RUSSIA"; Ramzan blushes deeply with rosy cheeks, little cartoon hearts floating around him; the bear looks expressionless and slightly uncomfortable. Pastel romantic lighting. Slow orbit, rack focus on the blushing cheeks. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Aşırı şekerli romantik keman + arp parodisi (rom-com klişesi).',
    voiceoverOrText: 'Ayının kurdelesinde: «RUSYA»'
  },

  // SAHNE 5
  {
    id: '5A',
    sceneId: 'SAHNE 5',
    sceneTitle: '2. POMPA: RAMZAN',
    durationSec: 5,
    timeRange: '1:05–1:10',
    visualSummary: 'Oda tavana kadar parayla dolu; dolar çığları. Putin öfkeli ve ter içinde hızla pompalar, Ramzan bir hava balonu gibi hızla şişer.',
    cameraMovement: 'El kamerası sarsıntısı, hızlı jump-cutlar, dar çerçeve.',
    aiPrompt: 'Room flooded to the ceiling with avalanches of dollar bills and gold. Caricature of Vladimir Putin, angry, gritted teeth, sweating, pumps a bicycle floor pump frantically with both hands; the hose connects to an inflatable-toy valve on the belt of caricature Ramzan Kadyrov (bushy beard, military uniform), who inflates rapidly into a huge shiny balloon, his beard stretching on the rubber surface. Handheld camera, fast jump cuts. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Vals tuba motifi 2x hızda, üzerine lezginka davulu ve sert elektro gitar.',
    voiceoverOrText: '—'
  },
  {
    id: '5B',
    sceneId: 'SAHNE 5',
    sceneTitle: '2. POMPA: RAMZAN',
    durationSec: 5,
    timeRange: '1:10–1:15',
    visualSummary: 'Putin balon-Ramzan\'a oyuncak silahlar uzatır: roketatar, altın tabanca, tüfek. Ramzan kucaklar ve neşeyle selfie çeker.',
    cameraMovement: 'Hızlı whip-pan\'lerle her silah teslimi ayrı insert.',
    aiPrompt: 'Angry caricature Putin hands a floating balloon-shaped caricature Ramzan Kadyrov a pile of cartoonish shiny weapons: an assault rifle, a rocket launcher, a gold-plated pistol, toy-like and glossy. Ramzan hugs them all happily and takes a selfie with a smartphone. Fast whip pans between each hand-over. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Her teslimde "ka-ching" kasa sesi, ritme oturmuş.',
    voiceoverOrText: '—'
  },

  // SAHNE 6
  {
    id: '6A',
    sceneId: 'SAHNE 6',
    sceneTitle: 'MAYMUNA SİLAH',
    durationSec: 5,
    timeRange: '1:15–1:20',
    visualSummary: 'Asker kasketli çizgi-film maymun tabancayı ters tutar, namluya bakar, basınca "BANG!" bayrağı burnuna çarpar; şaşkın dördüncü duvara bakar.',
    cameraMovement: 'Sabit sitcom çerçevesi; kameraya şaşkın bakış.',
    aiPrompt: 'A cartoon monkey in a tiny military cap is handed a pistol, holds it backwards, peers into the barrel, pulls the trigger and a comic "BANG!" flag pops out and boops him on the nose; he looks dazed directly at the camera. Bright slapstick cartoon, static framing. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Müzik kesilir; plak cızırtısı (record scratch); "boing" efekti.',
    voiceoverOrText: '—'
  },

  // SAHNE 7
  {
    id: '7A',
    sceneId: 'SAHNE 7',
    sceneTitle: 'BALON-RAMZAN DAĞLARIN ARASINDA',
    durationSec: 5,
    timeRange: '1:20–1:25',
    visualSummary: 'Balon-Ramzan anıt dağlar arasında uçar, havaya rastgele sıkar, mermiler havai fişek gibi açılır. Dağ eteğindeki köylüler şemsiyeler ardına saklanır.',
    cameraMovement: 'Drone hissi veren geniş, dağlar arasında kayan takip planı.',
    aiPrompt: 'A huge balloon-shaped caricature of Ramzan Kadyrov floats between colossal mountains carved with stone faces, firing a cartoon rifle wildly into the air; the bullets burst like colorful fireworks. Below, Chechen villagers sheltering at the mountain foothills duck behind rocks and umbrellas. Sweeping drone-style tracking shot. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Lezginka-rock tam güç; komik "pew pew" çizgi-film silah efektleri.',
    voiceoverOrText: '—'
  },
  {
    id: '7B',
    sceneId: 'SAHNE 7',
    sceneTitle: 'BALON-RAMZAN DAĞLARIN ARASINDA',
    durationSec: 5,
    timeRange: '1:25–1:30',
    visualSummary: 'Ramzan köylülere kovalarla siyah balçık atar; balçık şemsiyelere yapışır. Bir blob kamerayı kaplar ve wipe geçişi yapar.',
    cameraMovement: 'Orta plan; balçık kameraya doğru gelip lensi kaplar → wipe geçişi.',
    aiPrompt: 'Balloon-caricature Ramzan Kadyrov tosses buckets of cartoonish black goo and mud down onto villagers at the foothills; the goo splats comically on umbrellas and faces like custard pies, villagers make funny disgusted faces. A blob of goo flies toward the camera and covers the lens as a wipe transition. Slapstick, non-violent. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: '"Şlap! şlap!" çamur efektleri; müzik ritmine senkron.',
    voiceoverOrText: '—'
  },
  {
    id: '7C',
    sceneId: 'SAHNE 7',
    sceneTitle: 'BALON-RAMZAN DAĞLARIN ARASINDA',
    durationSec: 5,
    timeRange: '1:30–1:35',
    visualSummary: 'Kan lekeli dolar desteleri saçar. Kapan birkaç köylü anında şişip uydu gibi Ramzan etrafında döner; diğerleri kollarını bağlayıp reddeder.',
    cameraMovement: 'Yere düşen paraya low-angle; şişenleri takip eden tilt-up.',
    aiPrompt: 'Balloon-caricature Ramzan Kadyrov throws stacks of red-stained dollar bills down onto the foothills. A few villagers grab the money and instantly inflate into small shiny balloons that float up and orbit around Ramzan like satellites, while other villagers refuse the money and step back with crossed arms. Low-angle then tilt-up. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Her şişen kişide yükselen "vuuup" sesi, glockenspiel yükselen gam.',
    voiceoverOrText: '—'
  },

  // SAHNE 8
  {
    id: '8A',
    sceneId: 'SAHNE 8',
    sceneTitle: '3. POMPA: EMİR ŞAHİN',
    durationSec: 4,
    timeRange: '1:35–1:39',
    visualSummary: 'Maraş dondurmacısı tezgâhı. Fesli Emir Şahin dondurma beklerken Ramzan\'ın kemerindeki altın pompayı görür; gözleri kalp olur, külahı düşürür.',
    cameraMovement: 'Ramzan\'ın pompasına parlama efektli snap-zoom; Emir\'e karşı açı.',
    aiPrompt: 'A colorful Turkish ice-cream stand (Maraş dondurma vendor with long paddle) on a city square. A middle-aged Turkish man in a red fez (caricature of Emir Şahin) waits for ice cream, then spots a shiny golden bicycle pump hanging from the belt of a balloon-caricature Ramzan Kadyrov floating nearby; his eyes turn into big pulsing cartoon hearts and his ice cream cone drops. Snap zoom with sparkle on the pump. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Arabesk keman parodisi, "ding!" kalp efekti; dondurmacı zili.',
    voiceoverOrText: '—'
  },
  {
    id: '8B',
    sceneId: 'SAHNE 8',
    sceneTitle: '3. POMPA: EMİR ŞAHİN',
    durationSec: 5,
    timeRange: '1:39–1:44',
    visualSummary: 'Emir Şahin hevesle kendi valfini uzatır; Ramzan altın pompayla onu hızla şişirir. Fesi dev kafasında minicik kalır. Dondurmacı şaşkın.',
    cameraMovement: 'Hızlandırılmış (undercrank) komedi kurgusu.',
    aiPrompt: 'The fez-wearing caricature man eagerly bends forward and points at an inflatable-toy valve on his own belt; balloon-caricature Ramzan Kadyrov pumps him up with the golden bicycle pump. As he swells into a round balloon, his red fez stays tiny on top of his giant head. Shocked ice-cream vendor in the foreground. Fast undercranked comedy timing. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Pompa sesleri 4x hızda, chipmunk tiz kahkahası.',
    voiceoverOrText: '—'
  },
  {
    id: '8C',
    sceneId: 'SAHNE 8',
    sceneTitle: '3. POMPA: EMİR ŞAHİN',
    durationSec: 4,
    timeRange: '1:44–1:48',
    visualSummary: 'Meydandaki binanın dev ekranında Putin koltuğunda çay yudumlayarak keyifle izler, tembelce başparmak kaldırır (sistem kendi işliyor).',
    cameraMovement: 'Dev ekrana yavaş push-in.',
    aiPrompt: 'On a giant billboard screen behind the square, caricature Vladimir Putin relaxes in an armchair sipping tea from a glass, watching contentedly and giving a lazy thumbs-up. Slow push-in on the screen. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Müzik asansör / lounge bossa-nova moduna kayar.',
    voiceoverOrText: '—'
  },

  // SAHNE 9
  {
    id: '9A',
    sceneId: 'SAHNE 9',
    sceneTitle: 'MEDET ÖNLÜ DAĞI',
    durationSec: 5,
    timeRange: '1:48–1:53',
    visualSummary: 'Dolar çuvallarına sarılı balon-Emir Şahin, yüzü kayaya oyulmuş Medet Önlü Dağı üzerinden uçar, kırmızı lekeli dolarlar saçar.',
    cameraMovement: 'Kuşbakışı havadan süzülüş; dağ belirdikçe alçalış.',
    aiPrompt: 'A round balloon-shaped caricature man in a tiny red fez, clutching bags of dollars, flies over a snowy Caucasus peak carved with a stone face of Medet Önlü (modern man, short hair, sharp facial contours, stern and calm), scattering red-stained dollar bills that flutter down. High aerial shot descending. Style: photoreal epic Caucasus mountain range where peaks are carved into giant stone faces (Mount Rushmore-like), snow, glaciers, low clouds, god-rays through storm clouds, 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Lezginka-rock döner ama yanına keskin direniş pondur riffi girer.',
    voiceoverOrText: 'Dağın eteğinde etiket: «Medet Önlü»'
  },
  {
    id: '9B',
    sceneId: 'SAHNE 9',
    sceneTitle: 'MEDET ÖNLÜ DAĞI',
    durationSec: 4,
    timeRange: '1:53–1:57',
    visualSummary: 'Dağın taş yüzü ağırbaşlılıkla kaşlarını çatar; kırmızı dolarlar taşa çarpıp kül gibi dökülür. Emir Şahin korkuyla ter döker.',
    cameraMovement: 'Taş yüzün gözlerine sert push-in; Emir\'e ters açı.',
    aiPrompt: 'Extreme close-up: the stone face of the mountain slowly frowns and glares at the floating fez-wearing balloon; red-stained dollar bills hit the stone and crumble into ash. The balloon man gulps nervously, sweat drop. Hard push-in, reverse angle. Style: photoreal epic Caucasus mountain range where peaks are carved into giant stone faces (Mount Rushmore-like), snow, glaciers, low clouds, god-rays through storm clouds, 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Müzik kesilir; tek derin doul davulu + taş gıcırtısı + komik "gulp" yutkunma sesi.',
    voiceoverOrText: '—'
  },

  // SAHNE 10
  {
    id: '10A',
    sceneId: 'SAHNE 10',
    sceneTitle: 'BALON FİLOSU',
    durationSec: 6,
    timeRange: '1:57–2:03',
    visualSummary: 'Diğer takımlı ve paralı balonlar Emir\'in etrafında toplanır; gökyüzünde Rus renkli kurdelelerle kendini beğenmiş bir balon geçit töreni oluşur.',
    cameraMovement: 'Yükselen vinç planı; balonlar arttıkça geri çekilen kamera.',
    aiPrompt: 'Dozens of shiny inflated balloon-people (men in suits, uniforms, a fez) gather around the fez balloon, forming a smug parade formation in the sky above the Caucasus foothills, tied with red-white-blue ribbons, all grinning and waving dollar bills. Rising crane shot pulling back as the crowd of balloons grows. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Bando marşı parodisi (balon lastik gıcırtılarıyla), kreşendo.',
    voiceoverOrText: '—'
  },

  // SAHNE 11
  {
    id: '11A',
    sceneId: 'SAHNE 11',
    sceneTitle: 'KURT: KLİMAKS',
    durationSec: 6,
    timeRange: '2:03–2:09',
    visualSummary: 'Dağ eteğindeki köylüler balçığı siler, el ele tutuşur: dedeler, kadınlar, gençler. Kararlı bakışlar, ellerde küçük İçkerya bayrakları.',
    cameraMovement: 'Yüzler üzerinde yakın plan montajı → el ele yürüyen kalabalığa geniş plan.',
    aiPrompt: 'Chechen villagers of all ages at the mountain foothills wipe black goo from their faces and join hands - elders in papakhas, women in headscarves, young men, children - holding small Ichkeria flags, determined expressions. Quick montage of faces then wide shot of the crowd walking forward together. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Müzik sıfırlanır; yalnızca kalp atışı davulu + derinden gelen koro mırıltısı.',
    voiceoverOrText: '—'
  },
  {
    id: '11B',
    sceneId: 'SAHNE 11',
    sceneTitle: 'KURT: KLİMAKS',
    durationSec: 7,
    timeRange: '2:09–2:16',
    visualSummary: 'Kalabalık koşar, bedenleri ışığa dönüşüp birleşir; gökyüzünde ayağa kalkmış, dağlar kadar dev bir ışık kurdu belirir ve ulur.',
    cameraMovement: 'Koşan kalabalığın içinden tracking → dev kurt açılırken hızlı pull-back.',
    aiPrompt: 'The crowd of villagers starts running, their bodies turn into streams of light that merge into one colossal wolf made of light and people (like the wolf on the Ichkeria coat of arms), growing as tall as the stone-face mountains, howling at a full moon. Tracking shot through the running crowd, then fast pull-back to reveal the giant wolf. Epic, heroic. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Koro + davullar patlar; müziğin zirve notasında güçlü kurt uluması.',
    voiceoverOrText: '—'
  },
  {
    id: '11C',
    sceneId: 'SAHNE 11',
    sceneTitle: 'KURT: KLİMAKS',
    durationSec: 5,
    timeRange: '2:16–2:21',
    visualSummary: 'Balonlar panikler: sararır, birbirine toslar; fesi düşer. Dev ekrandaki Putin şokla çayını püskürtür.',
    cameraMovement: 'Balonlar arasında hızlı whip-pan\'ler; Putin\'e kısa insert.',
    aiPrompt: 'Panicked balloon-people in the sky turn pale, bump into each other trying to flee, a tiny red fez falls off one balloon; on a distant billboard screen caricature Putin spits out his tea in shock. Fast whip pans. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Panik balon gıcırtıları müziğe ritmik davul gibi işlenir.',
    voiceoverOrText: '—'
  },
  {
    id: '11D',
    sceneId: 'SAHNE 11',
    sceneTitle: 'KURT: KLİMAKS',
    durationSec: 4,
    timeRange: '2:21–2:25',
    visualSummary: 'Kurt tek bir pençe darbesi savurur: SLOW-MOTION pençe tüm balonları aynı hat boyunca kesip biçer; kauçuk gerilme anı.',
    cameraMovement: 'Pençeyi takip eden süper slow-motion yatay pan; ışık izi.',
    aiPrompt: 'Super slow motion: the giant wolf of light swipes a single massive claw across the sky, the claw trail glowing, slicing through an entire row of shiny balloon-people at once, rubber stretching at the moment of contact. Horizontal tracking pan following the claw. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Her şey yavaşlar, pitch-down; derin tek bir nefes sesi.',
    voiceoverOrText: '—'
  },
  {
    id: '11E',
    sceneId: 'SAHNE 11',
    sceneTitle: 'KURT: KLİMAKS',
    durationSec: 6,
    timeRange: '2:25–2:31',
    visualSummary: 'Normal hız: zincirleme POP-POP-POP! Balonların yerinden tavuk tüyleri ve dolarlar yağar; çocuklar sevinçle tüyleri havada yakalar.',
    cameraMovement: 'Geniş plan; tüylerin arasından yavaşça aşağı süzülen kamera.',
    aiPrompt: 'Chain reaction of cartoon balloon pops across the sky, POP POP POP; where each balloon was, only a burst of white chicken feathers and fluttering dollar bills remains. The feathers drift down like snow over the foothills, laughing children catch them. Camera slowly drifts down through the falling feathers. Joyful, comedic release. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: 'Pop sesleri davul ritmi oluşturur; arkasından zafer teması tam orkestra; komik tavuk "gıt-gıdak" sesi.',
    voiceoverOrText: '—'
  },

  // FİNAL
  {
    id: 'F1',
    sceneId: 'FİNAL',
    sceneTitle: 'KAMU SPOTU & ANIT DAĞLAR',
    durationSec: 7,
    timeRange: '2:31–2:38',
    visualSummary: 'Temiz beyaz arka planda sönmüş patlak balon ve tavuk tüyleri. 80\'ler kamu spotu havası.',
    cameraMovement: 'Sabit, minimalist ortalanmış stüdyo çerçevesi.',
    aiPrompt: 'Minimalist public-service-announcement style shot: a single deflated popped balloon and a few white chicken feathers lying on a clean white background, soft studio light, empty space above for text. Static centered framing. Style: stylized 3D caricature animation, oversized heads and exaggerated facial features, Pixar-meets-political-cartoon look, cinematic dramatic lighting, rich textures, 16:9, no text, no logos.',
    styleCategory: 'satire',
    audioCues: '80\'ler TRT kamu spotu synth "ding-dong" jingle\'ı; daktilo tıkırtısı.',
    voiceoverOrText: 'DAKTİLO & DIŞ SES (İronik Spiker):\n«Plastik, doğaya da vatana da zarar verir.\nBir gün patlayacak plastik balonlar olmayın.»'
  },
  {
    id: 'F2',
    sceneId: 'FİNAL',
    sceneTitle: 'KAMU SPOTU & ANIT DAĞLAR',
    durationSec: 16,
    timeRange: '2:38–2:54',
    visualSummary: 'Sisler içinde altın gün doğumunda anıt dağlar (Dudayev, Şamil, Mansur, Baysungur, Medet Önlü). Önlerinde dinlenen kurt silüeti ve dalgalanan bayrak.',
    cameraMovement: 'Çok yavaş dolly-out; derin, saygılı ve epik kadraj.',
    aiPrompt: 'Sunrise over a misty Caucasus range of colossal mountains carved with stone faces (Dzhokhar Dudayev in peaked cap, Sheikh Mansur, Imam Shamil in tall papakha, Medet Önlü), a giant wolf silhouette resting peacefully before them, an Ichkeria flag waving gently on a ridge, golden light breaking through clouds. Very slow dolly-out, contemplative, reverent. Style: photoreal epic Caucasus mountain range where peaks are carved into giant stone faces (Mount Rushmore-like), snow, glaciers, low clouds, god-rays through storm clouds, 16:9, no text.',
    styleCategory: 'mountain',
    audioCues: 'Tek pondur, ana temanın ağırbaşlı hüzünlü versiyonu; derin koro uğultusu.',
    voiceoverOrText: 'DAKTİLO & DIŞ SES (Ağırbaşlı, Ciddi):\n«Bir milleti var eden, ona özünü ve karakterini veren ruhtur. O ruhtan vazgeçen, o milletten olma iddiasından da vazgeçmiş demektir. Bu milletin bütün vatanını zapt etseniz bile, anıt dağlar gibi yükselmek sizin için hep bir hayal olarak kalır. Olsa olsa bir balon gibi hızla şişer, uçar… ve patlayıp gidersiniz.»'
  },
  {
    id: 'F3',
    sceneId: 'FİNAL',
    sceneTitle: 'KAMU SPOTU & ANIT DAĞLAR',
    durationSec: 3,
    timeRange: '2:54–2:57',
    visualSummary: 'Siyah ekran, kanal logosu ve yasal hiciv uyarısı.',
    cameraMovement: 'Sabit grafik kadrajı.',
    aiPrompt: 'Pure black screen with cinematic typography layout, high contrast white lettering, minimalist aesthetic, 16:9.',
    styleCategory: 'graphic',
    audioCues: 'Son pondur tınlaması + tek minik ironik "pop" efekti.',
    voiceoverOrText: '«Hiciv eseridir; kişilerin kamuya açık eylem ve tutumlarını eleştirir.»'
  }
];

export const CHARACTER_SHEET_PRESETS: CharacterReference[] = [
  {
    name: 'Cevher Dudayev (Anıt Dağ & Ruh)',
    role: 'Tarihî Lider / Ruh',
    description: 'Keskin elmacık kemikleri, ince bıyık, Sovyet Hava Kuvvetleri general kasketi, asil ve kararlı bakış.',
    likenessKeywords: 'Exact facial anatomy of Dzhokhar Dudayev (Джохар Дудаев): gaunt hollow cheeks, prominent angular cheekbones, thin well-groomed dark pencil moustache, sharp piercing dark brown eyes, high forehead with slender nose bridge, Soviet Air Force Major General peaked service cap with dark green velvet band, golden wings cockade, high-collar Soviet military uniform with shoulder board rank stars',
    stylePrompt: 'Master photographic portrait with ultra-precise anatomical likeness of Dzhokhar Dudayev (General Dzhokhar Dudayev of Chechen Republic of Ichkeria): exact historical facial features with gaunt cheekbones, thin dark pencil moustache, intense piercing eyes, wearing authentic Soviet Air Force major general visor peaked cap with green band and gold cockade, military officer collar with golden shoulder epaulets. Stylized with subtle 3D cinematic animation polish, dignified, respectful, 8k Rembrandt studio portrait lighting.',
    archivePresets: [
      {
        id: 'dudayev_general_cap',
        label: 'General Üniforması & Kasketli',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/c/ca/Dzhokhar_Dudayev.jpg/800px-Dzhokhar_Dudayev.jpg',
        description: 'Tarihi Sovyet Hava Kuvvetleri general kasketi ve altın apoletli resmi portresi'
      },
      {
        id: 'dudayev_speech',
        label: 'Papaklı & Konuşma Portresi',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/62/Dzhokhar_Dudayev_1994.jpg/800px-Dzhokhar_Dudayev_1994.jpg',
        description: '1994 Grozni dönemi, geleneksel karakul papaklı ve kararlı bakışlı tarihi fotoğrafı'
      }
    ]
  },
  {
    name: 'Aslan Mashadov',
    role: 'Tarihî Komutan',
    description: 'Karakteristik gri bıyıklı, siyah astrahan papaklı, kamuflaj üniformalı lider.',
    likenessKeywords: 'Exact facial likeness of Aslan Maskhadov (Аслан Масхадов): bushy prominent grey moustache, weathered wise forehead wrinkles, solemn deep-set eyes, Caucasian black astrakhan wool papakha hat, camouflage combat field jacket with high collar',
    stylePrompt: 'Master photographic portrait of Aslan Maskhadov with 100% accurate historical likeness: prominent bushy grey moustache, solemn weathered face with wise wrinkles, wearing iconic tall black Caucasian sheepskin papakha hat and combat military camouflage uniform. Dignified commander posture, photorealistic rendering with subtle 3D animation polish, 8k resolution, cinematic lighting.',
    archivePresets: [
      {
        id: 'maskhadov_papakha',
        label: 'Siyah Papaklı & Gri Bıyıklı',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/1/14/Aslan_Maskhadov_1997.jpg/800px-Aslan_Maskhadov_1997.jpg',
        description: '1997 dönemi, geleneksel siyah karakul papak ve karakteristik gri bıyıklı tarihi portresi'
      },
      {
        id: 'maskhadov_field',
        label: 'Kamuflaj & Cephe Portresi',
        url: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Maskhadov.jpg/800px-Maskhadov.jpg',
        description: 'Cephe kamuflaj üniforması ve bilge bakışları'
      }
    ]
  },
  {
    name: 'Kafkas Anıt Dağları (Şamil, Mansur, Baysungur)',
    role: 'Tarihî Direniş Liderleri',
    description: 'Kafkas sıradağlarının kayalarına oyulmuş dev taş yüzler; karlı papaklar, tek gözü bantlı Baysungur, uzun sakallı Şamil.',
    likenessKeywords: 'Mount Rushmore style Caucasian resistance leaders: Imam Shamil with long white beard, Sheikh Mansur with piercing gaze, Baysangur of Benoy with iconic black eyepatch',
    stylePrompt: 'Monumental granite rock sculptures carved into Caucasus mountain peaks: Sheikh Mansur, Imam Shamil in tall fur papakha with long white beard, Baysangur Benoysky with eyepatch, photorealistic weathered granite, snow, god-rays.'
  },
  {
    name: 'Vladimir Putin (Karikatür)',
    role: 'Kuklacı / Pompalayıcı',
    description: 'Lacivert takım, kırmızı kravat, sırıtan iş adamı tavrı; öfkeden mora dönen yüz, kulaklardan çıkan buhar.',
    likenessKeywords: 'Recognizable caricature of Vladimir Putin, thin lips, pointed nose, receding blonde hair, cold calculating eyes',
    stylePrompt: 'Stylized 3D animated caricature of Vladimir Putin, navy suit, red tie, smug smirk, exaggerated round head with receding hair, holding a brass bicycle floor pump, expressive Pixar-political cartoon style.'
  },
  {
    name: 'Ahmad Kadirov (1. Balon)',
    role: 'Şişirilen Figür 1',
    description: 'Gri sakal, beyaz papak, dolar gözler, kemerinde şişme oyuncak valfi.',
    likenessKeywords: 'Caricature of Akhmad Kadyrov, bushy grey beard, tall white traditional wool papakha',
    stylePrompt: 'Caricature of Akhmad Kadyrov, bushy grey beard, tall white traditional wool papakha, round inflatable body, dollar sign eyes, rubber texture reflections.'
  },
  {
    name: 'Ramzan Kadirov (2. Balon)',
    role: 'Şişirilen Figür 2',
    description: 'Gür sakal, pembe yanaklar, oyuncak ayısına sarılan, kamuflajlı, silahlı ve selfie çeken dev balon.',
    likenessKeywords: 'Caricature of Ramzan Kadyrov, wide chin beard without moustache, round puffy face, camouflage',
    stylePrompt: 'Stylized 3D caricature of Ramzan Kadyrov, big bushy chin beard, round rosy cheeks, camouflage uniform, hugging a plush toy bear, inflated balloon physique.'
  },
  {
    name: 'Emir Şahin (3. Balon)',
    role: 'Şişirilen Figür 3',
    description: 'Kafasında minik kırmızı fes, takım elbiseli, Maraş dondurmacısı önünde altın pompayla şişen figür.',
    likenessKeywords: 'Turkish middle-aged businessman caricature with a tiny red Ottoman fez on an oversized round head',
    stylePrompt: 'Caricature of a middle-aged Turkish man wearing a tiny red fez on an inflated giant head, expressive eager cartoon face, clutching sacks of dollar bills, slapstick aesthetic.'
  },
  {
    name: 'Medet Önlü Dağı',
    role: 'Modern Şehit Anıtı',
    description: 'Kafkas dağ zirvesine oyulmuş modern, sakin ve sert bakışlı taş yüz.',
    likenessKeywords: 'Exact face of Medet Önlü, short hair, clean shaven, modern Chechen honorary consul, calm solemn gaze',
    stylePrompt: 'Monumental granite mountain face carved into Caucasus peak depicting Medet Önlü, modern dignified face, frowning sternly against snow blizzard, photoreal stone texture.'
  },
  {
    name: 'Işık Kurdu (Bozkurt / Borz)',
    role: 'Manevi Kurtarıcı / Klimaks',
    description: 'Halkın birleşen ışıklarından doğan, anıt dağlar kadar dev, tek pençeyle balonları patlatan parlayan kurt.',
    likenessKeywords: 'Chechen national wolf (Borz) coat of arms silhouette, made of celestial golden light',
    stylePrompt: 'Colossal mythical wolf made of glowing golden-cyan spirit light and constellation trails, rising behind mountain ridges, howling majestically, sharp ethereal claws.'
  }
];
