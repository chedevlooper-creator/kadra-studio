import type { AspectRatio } from "../types";
import type { StoryboardShot } from "../planner";

export interface MasterCharacterSeed {
  name: string;
  appearance: string;
  aliases: string[];
  style: string;
}

export const BALONLAR_MASTER_CHARACTERS: MasterCharacterSeed[] = [
  {
    name: "Cahar Dudayev (İnsan & Anıt Dağ)",
    appearance:
      "Dzhokhar Dudayev with his iconic sharp thin moustache, stern dignified gaze, dark-olive general's overcoat, and slanted black astrakhan papakha hat, also depicted as a colossal granite Caucasus mountain peak carved with his face.",
    aliases: ["Dudayev", "Cahar", "Dzhokhar", "Cevher", "Dudayevin"],
    style:
      "Photorealistic monumental granite mountain sculpture and epic historical drama portrait, high contrast cinematic lighting, snow-swept Caucasus peaks.",
  },
  {
    name: "Aslan Mashadov (İnsan & Anıt Dağ)",
    appearance:
      "Aslan Maskhadov, bearded Chechen commander in woodland field jacket and military beret with a calm resolute gaze, also depicted as a monumental rock-carved Caucasus granite peak.",
    aliases: ["Mashadov", "Maskhadov", "Aslan"],
    style:
      "Photorealistic historical drama character and monumental rock-carved Caucasus mountain peak, dramatic volumetric mist.",
  },
  {
    name: "Kafkasya Anıt Dağları (Şeyh Mansur, İmam Şamil, Baysangur)",
    appearance:
      "Colossal Rushmore-like granite mountain peaks rising side by side in the snowy Caucasus: Sheikh Mansur in tall white wool turban, Imam Shamil with full beard and papakha, and one-armed commander Baysangur of Benoy.",
    aliases: ["Şeyh Mansur", "Mansur", "İmam Şamil", "Şamil", "Baysangur", "Baysungur"],
    style:
      "Epic photorealistic granite mountains with recognizable historical faces carved into sheer rock walls, eternal snow and storm clouds.",
  },
  {
    name: "Vladimir Putin (Pompacı & Balon Ayı Kostümlü)",
    appearance:
      "3D editorial political satire caricature of Vladimir Putin with pale cold eyes, thin calculating smirk, receding blonde hair, dark tailored suit and red tie.",
    aliases: ["Putin", "Putinin"],
    style:
      "Stylized 3D political cartoon caricature, expressive grotesque satire, dramatic Kremlin-dark lighting.",
  },
  {
    name: "Ahmed Kadirov (Rus Rozetli & Balon Formu)",
    appearance:
      "3D political satire caricature of Ahmad Kadyrov with grey beard and traditional papakha, wearing a dark coat with a Russian tricolor flag badge on his sleeve, inflated into a glossy spherical human-balloon with tiny head, hands, and feet.",
    aliases: ["Ahmed Kadirov", "Ahmad Kadyrov", "Ahmed", "Ahmad"],
    style:
      "Stylized 3D editorial cartoon caricature, glossy latex balloon texture, sharp satirical proportions.",
  },
  {
    name: "Ramzan Kadyrov (RUSSIA Başlıklı & Silahlı Balon)",
    appearance:
      "3D political satire caricature of Ramzan Kadyrov with ginger-reddish scruffy beard and wide manic grin, depicted in khaki military attire and as an inflated glossy round khaki human-balloon with tiny limbs.",
    aliases: ["Ramzan Kadirov", "Ramzan Kadyrov", "Ramzan", "balon Kadirov", "Balon Ramzan"],
    style:
      "Stylized 3D political cartoon caricature, glossy inflated rubber skin, exaggerated grotesque facial expressions.",
  },
  {
    name: "Daudov, Delimhanov ve Maskeli Balon Polisler",
    appearance:
      "Spherical glossy black-uniformed regime balloon henchmen and black-balaclava-masked inflatable balloon riot police with taut rubbery round bodies.",
    aliases: ["Daudov", "Delimxanov", "Delimhanov", "balon polis", "balon polisler", "balon askerlere", "regime balloons"],
    style:
      "3D dark political satire caricature, shiny black vinyl balloon texture, ominous cold street lighting.",
  },
  {
    name: "Gazeteci Anna Politkovskaya",
    appearance:
      "Brave investigative journalist Anna Politkovskaya with short silver-streaked dark hair, rectangular glasses, and beige trench coat, holding a sharp metallic fountain pen like a rapier.",
    aliases: ["Anna Politkovskaya", "anna politskaya", "gazeteci"],
    style:
      "Dignified cinematic realism contrasted against 3D satirical balloon figures, dramatic spotlight.",
  },
  {
    name: "Fesli Dondurmacı Emir Şahin (Balon Formu)",
    appearance:
      "3D satirical caricature of Emir Şahin wearing a red Ottoman tasseled fez and traditional Turkish Maras ice-cream vendor vest, inflated into a grotesque floating human-balloon.",
    aliases: ["Emir Şahin", "emir şahin", "emir şahine", "dondurmacı", "fesli"],
    style:
      "3D editorial political cartoon caricature, glossy latex balloon body, gaudy neon and dollar-green accents.",
  },
  {
    name: "Medet Önlü (Anıt Dağ)",
    appearance:
      "Monumental granite mountain peak carved in the noble likeness of martyred Chechen honorary consul Medet Önlü with a neat grey beard and stern, righteous gaze.",
    aliases: ["Medet Önlü", "Medet dağı", "medet dağından", "Medet"],
    style:
      "Photorealistic monumental rock mountain peak, dramatic stormy sunset lighting, heroic scale.",
  },
  {
    name: "Kızıl Saçlı Çocuk (Sapanlı Direnişçi)",
    appearance:
      "Determined young red-haired Anatolian hero in Turkey with freckles, intense expressive eyes, and a simple hoodie, holding a wooden slingshot.",
    aliases: ["kızıl saçlı bir çocuk", "kızıl saçlı çocuk", "red-haired boy", "young red-haired Anatolian hero"],
    style:
      "Cinematic dramatic realism, warm rim lighting, expressive emotional transition from contemplation to defiance.",
  },
  {
    name: "Bozkurt (Borz — Kolektif Halk Ruhu)",
    appearance:
      "Colossal mythic Caucasian Wolf (Borz) with silver-grey fur crackling with storm light, glowing amber eyes, and giant powerful claws.",
    aliases: ["Bozkurt", "Borz", "Caucasian Wolf", "tek bir Kurta", "Devasa Kurt", "Kurda bakıp", "towering Wolf"],
    style:
      "Epic mythic photorealism, monumental scale, swirling storm clouds and flying white chicken feathers.",
  },
];

export const BALONLAR_MASTER_SHOTS: StoryboardShot[] = [
  {
    id: "0A",
    sceneId: "İlk sahne",
    sceneTitle: "Güdümlü Füze ve Yükselen Ruh",
    durationSec: 6,
    timeRange: "0:00–0:06",
    visualSummary:
      "Dudayev'in bulunduğu arabaya güdümlü füze düşer; dumanların arasından kanatlı melek olarak yükselen ruh gökyüzüne çıkar.",
    cameraMovement: "Hızlı alçalan takip çekiminden gökyüzüne yükselen vinç hareketine geçiş",
    aiPrompt:
      "Style: Epic historical drama realism. High-angle tracking shot of a guided missile streaking down through grey Caucasus clouds and striking Dzhokhar Dudayev's parked field car in a muddy clearing. From the fiery explosion and dark smoke, a luminous winged angelic spirit rises gracefully toward the heavens in a shaft of divine light. Dramatic volumetric fog, 8k cinematic realism.",
    motionPrompt:
      "High-angle tracking camera plunges down following the guided missile into the parked field car, then smoothly cranes upward through billowing smoke and fire as the luminous winged angelic spirit ascends into a beam of light.",
    audioCues: "Füze ıslığı, şiddetli patlama ve ardından yükselen ruhani koro",
    voiceoverOrText: "—",
  },
  {
    id: "0B",
    sceneId: "İlk sahne",
    sceneTitle: "Anıt Dağlar: Dudayev, Şeyh Mansur, İmam Şamil, Baysangur",
    durationSec: 6,
    timeRange: "0:06–0:12",
    visualSummary:
      "Cahar Dudayev devasa bir dağa dönüşür; yanında yine dağ olarak Şeyh Mansur, İmam Şamil ve Baysangur yükselir. Dağ Dudayev'in zirvesinde İçkerya bayrağı saplıdır.",
    cameraMovement: "Geniş epik pan ve aşağıdan yukarıya anıtsal açı",
    aiPrompt:
      "Style: Photorealistic monumental landscape. The rising spirit of Dzhokhar Dudayev solidifies into a colossal granite mountain peak bearing his iconic moustached face and papakha hat. Beside him stand the towering rock-carved mountain peaks of Sheikh Mansur, Imam Shamil, and Baysangur of Benoy across the snowy Caucasus range. Planted firmly on Mountain Dudayev's summit waves the green, white, and red flag of Ichkeria with the wolf crest.",
    motionPrompt:
      "Sweeping low-angle epic crane and pan across the colossal snow-swept granite mountain peaks of Dudayev, Sheikh Mansur, Imam Shamil, and Baysangur as clouds part and the green Ichkeria flag waves proudly on the summit.",
    audioCues: "Dağların gürleyerek yükselişi, sert zirve rüzgarı ve bayrak dalgalanması",
    voiceoverOrText: "—",
  },
  {
    id: "0C",
    sceneId: "İlk sahne",
    sceneTitle: "İnsan Aslan Mashadov İçkerya Bayrağını Eline Alır",
    durationSec: 6,
    timeRange: "0:12–0:18",
    visualSummary:
      "Dağ Dudayev'de saplı İçkerya bayrağını insan formundaki Aslan Mashadov uzanıp kararlılıkla eline alır.",
    cameraMovement: "Yakınlaşan kahramanca alt açı (dolly in)",
    aiPrompt:
      "Style: Cinematic historical realism. On the rocky ridge of the colossal Mountain Dudayev, human commander Aslan Maskhadov in woodland military fatigues and beret reaches out with both hands and firmly grasps the wooden staff of the green Ichkeria flag planted in the granite peak, holding the banner high against the wind while the giant stone faces of Dudayev, Shamil, Mansur, and Baysangur watch behind him.",
    motionPrompt:
      "Heroic low-angle dolly-in as human commander Aslan Maskhadov steps forward on the rocky summit, grasps the wooden staff of the Ichkeria flag with both hands, and raises it against the rushing mountain wind.",
    audioCues: "Sancak gönderinin kavranışı, rüzgarda şahlanan kumaş sesi ve vakur yaylılar",
    voiceoverOrText: "—",
  },
  {
    id: "1A",
    sceneId: "1. Sahne",
    sceneTitle: "Altınlar, Dolarlar ve Ağızdan Pompayla Şişirilen Ahmed Kadirov",
    durationSec: 6,
    timeRange: "0:18–0:24",
    visualSummary:
      "Etrafta altınlar ve dolarlar saçılıdır. Kolunda Rusya bayrağı rozeti olan Ahmed Kadirov yere Putin'in önünde boyun eğmiş halde eğilmiştir; Putin ona ağzından balon pompasıyla hava verir ve Ahmed Kadirov gitgide balona dönüp şişer. Sahnede Rusya bayrağı dışında asla bayrak olmayacak.",
    cameraMovement: "Yukarıdan baskın açı ve pompalama ritmiyle yavaş yaklaşma",
    aiPrompt:
      "Style: 3D editorial political cartoon satire. Inside a dark opulent hall scattered with piles of gold bars and US dollar bills, Ahmad Kadyrov wearing a prominent Russian tricolor flag badge on his sleeve bows submissively on his knees on the floor in front of Vladimir Putin. Putin holds a red manual balloon air pump and pumps air through the hose directly into Ahmad Kadyrov's mouth. With each pump, Ahmad Kadyrov's body swells and rounds out into a glossy latex balloon. Strictly only the Russian tricolor flag is visible in the scene; no other flags anywhere.",
    motionPrompt:
      "Slow high-angle dolly-in as Vladimir Putin rhythmically pushes the red air pump handle up and down, pumping air through the hose into kneeling Ahmad Kadyrov's mouth while Ahmad's body visibly swells and rounds into a glossy balloon amid piles of gold and dollars.",
    audioCues: "Altın ve para şıngırtısı, ritmik bisiklet pompası tıslaması, gerilen lastik gıcırtısı",
    voiceoverOrText: "—",
  },
  {
    id: "1B",
    sceneId: "1. Sahne",
    sceneTitle: "Kan Damlayan Kalemle İhanet Anlaşması ve Balon Olarak Uçuş",
    durationSec: 6,
    timeRange: "0:24–0:30",
    visualSummary:
      "Balona dönüp şişen Ahmed Kadirov kan damlayan bir kalemle ihanet anlaşmasını imzalar ve kafası, elleri ve ayakları gözüken yuvarlak bir balon olarak havaya uçar. Sahnede Rusya bayrağı dışında asla bayrak olmayacak.",
    cameraMovement: "Kalem ucundan yakın çekimden havalanan balonu takip eden tilt-up hareketine geçiş",
    aiPrompt:
      "Style: 3D editorial political cartoon satire. Swollen into a glossy spherical balloon with his tiny head, hands, and feet sticking out and a Russian flag badge on his arm, Ahmad Kadyrov signs a betrayal treaty document on the floor using an ornate pen dripping thick crimson ink, then lifts off the ground and floats up toward the ceiling as a round human-balloon while Putin watches smugly. Strictly only the Russian tricolor flag is present in the scene; no other flags.",
    motionPrompt:
      "Camera starts close on the crimson-ink-dripping pen signing the treaty on the floor, then tilts upward following the spherical Ahmad Kadyrov human-balloon as he lifts off the ground and floats up into the air while Putin smirks.",
    audioCues: "Damlayan sıvı sesi, kağıda sert imza cızırtısı ve helyum balonu yükselme vınlaması",
    voiceoverOrText: "—",
  },
  {
    id: "2A",
    sceneId: "Sahne 2",
    sceneTitle: "Dağın İçinden Uzanan El ve Bayrak Alemiyle Patlayan Balon",
    durationSec: 6,
    timeRange: "0:30–0:36",
    visualSummary:
      "Dudayev dağının etrafında uçan Ahmed Kadirov balonunu dağın içinden uzanan devasa taş el tutar; İçkerya bayrağının alemi Ahmed Kadirov balonuna değip balonu patlatır.",
    cameraMovement: "Dinamik takip ve patlama anında sarsıntılı yakın çekim",
    aiPrompt:
      "Style: Hybrid photorealistic granite mountains and 3D satirical balloon. The glossy spherical Ahmad Kadyrov balloon (with tiny head, hands, and feet) floats arrogantly around the colossal granite Mountain Dudayev. Suddenly, a giant stone hand emerges directly out of the rock face of Mountain Dudayev, grabs the floating Ahmad Kadyrov balloon, and presses it against the sharp metallic finial tip of the Ichkeria flagstaff planted on the summit—instantly popping the balloon in a dramatic burst of shredded latex.",
    motionPrompt:
      "Dynamic tracking shot as a giant granite hand emerges from Mountain Dudayev, seizes the floating spherical Ahmad Kadyrov balloon in mid-air, and touches it to the sharp metal finial tip of the Ichkeria flagstaff, bursting the balloon into shredded rubber.",
    audioCues: "Taş kırılma gürültüsü, metalik çınlama ve kulakları sağır eden balon patlaması",
    voiceoverOrText: "—",
  },
  {
    id: "3A",
    sceneId: "Sahne 3",
    sceneTitle: "Morarmış Putin Kara Kara Düşünüyor",
    durationSec: 5,
    timeRange: "0:36–0:41",
    visualSummary:
      "Putin yüzü öfke ve hüsrandan morarmış halde karanlıkta kara kara düşünüyor.",
    cameraMovement: "Yavaşça yüze kilitlenen klostrofobik dolly-in",
    aiPrompt:
      "Style: 3D dark political satire caricature. Close-up of Vladimir Putin sitting alone in a dimly lit shadowy room, his face turned deep bruised purple-violet with humiliation and suppressed fury, chin resting on steepled fingers as he broods darkly.",
    motionPrompt:
      "Slow claustrophobic dolly-in toward Vladimir Putin's deep purple-flushed face in the dark room as his jaw clenches, eyes narrow in brooding rage, and shadows deepen around him.",
    audioCues: "Boğuk kalp atışı, diş gıcırtısı ve uğursuz bas uğultusu",
    voiceoverOrText: "—",
  },
  {
    id: "4A",
    sceneId: "Sahne 4",
    sceneTitle: "Pembe-Kırmızı RUSSIA Başlığıyla Ayıya Sarılan Ramzan Kadirov",
    durationSec: 5,
    timeRange: "0:41–0:46",
    visualSummary:
      "Pembe-kırmızı RUSSIA başlığıyla boz ayıya sarılmış Ramzan Kadirov'un gerçek fotoğraf üslubundaki görüntüsü; yanakları utangaçça pembeleşiyor.",
    cameraMovement: "Sabit portre kadrajında hafif zoom ve pembeleşen yanak vurgusu",
    aiPrompt:
      "Style: Candid realistic archival photograph aesthetic with satirical surreal touch. Ramzan Kadyrov wearing a bright pink-and-red knitted winter sports headband with bold white letters 'RUSSIA' across his forehead, warmly hugging a large brown Russian bear in a snowy yard; his cheeks visibly blush bright rosy pink with infatuation.",
    motionPrompt:
      "Subtle slow zoom-in on Ramzan Kadyrov in his pink-and-red RUSSIA headband as he hugs the large brown bear tightly and his cheeks flush a glowing rosy pink.",
    audioCues: "Fotoğraf deklanşör sesi, komik arp tınısı ve ayı homurtusu",
    voiceoverOrText: "—",
  },
  {
    id: "5A",
    sceneId: "Sahne 5",
    sceneTitle: "Daha Çok Para, Ağızdan Pompa ve Balon Ramzan'a Verilen AK-47",
    durationSec: 7,
    timeRange: "0:46–0:53",
    visualSummary:
      "Putin çok daha sinirlidir, etrafta daha çok para vardır; Ramzan Kadirov Putin'in önünde diz çökmüştür. Putin'in elindeki hava pompası Ramzan Kadirov'un ağzındadır, onu balon gibi şişirir. Ramzan gitgide şişip balon formuna geçerek havalanır ve Putin tam balon formundayken sahnedeki AK-47'yi Ramzan Kadirov'un eline verir.",
    cameraMovement: "Geniş açıdan yükselen balonu takip eden kamera hareketi",
    aiPrompt:
      "Style: 3D editorial political cartoon satire. Vladimir Putin looks furious amid even larger mountains of gold bars and cash stacks. Ramzan Kadyrov kneels on the floor before him while Putin furiously works an air pump whose hose is inside Ramzan's mouth. Ramzan inflates rapidly into a huge glossy spherical balloon with tiny head, hands, and feet, lifting off the floor; right as Ramzan floats in full balloon form, Putin hands a golden AK-47 assault rifle into the floating balloon's tiny hand.",
    motionPrompt:
      "Camera tilts upward as furious Putin rapidly pumps air into kneeling Ramzan Kadyrov's mouth, inflating Ramzan into a giant glossy round balloon that rises off the floor while Putin hands an AK-47 rifle into the floating balloon's hand.",
    audioCues: "Hızlı ve öfkeli pompa sesi, şişen balon gıcırtısı ve AK-47 mekanizma şakırtısı",
    voiceoverOrText: "—",
  },
  {
    id: "6A",
    sceneId: "Sahne 6",
    sceneTitle: "Eline Silah Verilen Maymun Kesiti",
    durationSec: 5,
    timeRange: "0:53–0:58",
    visualSummary:
      "Eline AK-47 silah verilen şempanzenin rastgele ateş açtığı viral arşiv videosundan belgesel kesit.",
    cameraMovement: "El kamerası sarsıntılı VHS arşiv estetiği",
    aiPrompt:
      "Style: Grainy handheld archival viral video footage (4:3 camcorder look). A chimpanzee in a dusty clearing is handed an AK-47 rifle by careless soldiers and immediately starts firing blanks wildly into the air while jumping up and down as everyone scrambles in panic.",
    motionPrompt:
      "Shaky handheld archival camcorder footage as the chimpanzee grabs the rifle, jumps up and down, and fires wildly into the air while soldiers scatter in panic.",
    audioCues: "VHS kaset cızırtısı, kontrolsüz tüfek takırtısı ve panikleyen çığlıklar",
    voiceoverOrText: "—",
  },
  {
    id: "7A",
    sceneId: "Sahne 7",
    sceneTitle: "Anıt Dağlar Arasında Ateş Eden, Çamur ve Kanlı Dolar Saçan Balon Ramzan",
    durationSec: 7,
    timeRange: "0:58–1:05",
    visualSummary:
      "Balon Ramzan Kadirov ilk sahnedeki Cahar Dudayev, Mashadov, İmam Şamil ve Şeyh Mansur dağları arasında balon olmuş uçar, silahı ateşler. Ağzından çıkan pislikleri dağların eteklerine sığınmış insanların üstüne fırlatır; diğer eliyle kanlı dolar atar. Doları alan insanlar pislik içinde tıpkı onun gibi balon olup uçmaya başlar.",
    cameraMovement: "Anıt dağlar ve vadi arasında geniş dramatik vinç çekimi",
    aiPrompt:
      "Style: Hybrid photorealistic monumental mountains and 3D editorial political cartoon. Floating between the towering granite mountain peaks of Dzhokhar Dudayev, Maskhadov, Imam Shamil, and Sheikh Mansur, the spherical balloon Ramzan Kadyrov waves his prop rifle in the air, sprays dark brown mud from his mouth toward the figures sheltering at the mountain foothills, and scatters crimson-stained dollar bills with his other hand. Those down below who greedily grab the stained dollars while covered in mud swell up into round glossy balloons themselves and float into the sky.",
    motionPrompt:
      "Wide dramatic crane shot between the towering granite mountains as floating balloon Ramzan Kadyrov waves his rifle, sprays dark brown mud from his mouth, and scatters crimson-stained dollar bills while figures grabbing the bills below inflate into round balloons and float upward.",
    audioCues: "Tüfek sesleri, iğrenç balçık sıçraması, uçuşan kağıt paralar ve şişen yeni balonlar",
    voiceoverOrText: "—",
  },
  {
    id: "8A",
    sceneId: "Sahne 8",
    sceneTitle: "Ramzan Kadirov, Daudov ve Delimhanov Balonlarının Katran Dansı",
    durationSec: 6,
    timeRange: "1:05–1:11",
    visualSummary:
      "Ramzan Kadirov, Daudov ve Delimhanov balonları gökyüzünde yüzlerinde iğrenç ifadelerle ağızlarından siyah katran saçarak dans ediyor.",
    cameraMovement: "Gökyüzünde dönen grotesk dairesel kamera (orbit)",
    aiPrompt:
      "Style: 3D grotesque political satire cartoon. High in the stormy sky, three bloated spherical regime balloons—Ramzan Kadyrov, Magomed Daudov, and Adam Delimkhanov—bounce and dance together in mid-air with hideous, manic grimaces on their faces, spewing thick black tar droplets from their mouths as they twirl.",
    motionPrompt:
      "Orbiting aerial camera circles the three bloated spherical balloons—Ramzan Kadyrov, Daudov, and Delimkhanov—as they bounce, spin, and dance grotesquely in the stormy sky while spewing black tar droplets from their mouths.",
    audioCues: "Alaycı sirk müziği, fokurdayan siyah katran sesi ve grotesk kahkahalar",
    voiceoverOrText: "—",
  },
  {
    id: "10A",
    sceneId: "Sahne 10",
    sceneTitle: "Maskeli Balon Polisler Genç Bir Çeçeni Kaçırıyor",
    durationSec: 5,
    timeRange: "1:11–1:16",
    visualSummary:
      "Yüzleri kar maskeli şişkin balon polisler genç bir Çeçeni kollarından sürükleyerek kaçırıyor.",
    cameraMovement: "Karanlık sokakta el kamerasıyla gerilimli takip",
    aiPrompt:
      "Style: Dark cinematic 3D editorial political satire. On a cold rain-slicked street at night, bloated spherical policemen with glossy black balloon bodies and black ski-mask balaclavas grip a young Chechen civilian by his arms and drag him away into the dark shadows.",
    motionPrompt:
      "Tense handheld tracking camera follows close behind on the rain-slicked night street as the bloated black-masked balloon policemen drag the struggling young Chechen civilian by his arms into the dark alley.",
    audioCues: "Sert fren sesi, boğuşma ve karanlıkta uzaklaşan adımlar",
    voiceoverOrText: "—",
  },
  {
    id: "10B",
    sceneId: "Sahne 10",
    sceneTitle: "Ara Kart · David and Goliath (1)",
    durationSec: 3,
    timeRange: "1:16–1:19",
    visualSummary: "Siyah ekranda kırmızı yazıyla David and Goliath",
    cameraMovement: "Sabit kadraj",
    aiPrompt: "Pure black screen with stark crimson red serif typography reading 'David and Goliath' centered.",
    audioCues: "Derin ve yankılı tek bir davul vuruşu",
    voiceoverOrText: "Siyah ekranda kırmızı yazıyla «David and Goliath»",
  },
  {
    id: "11A",
    sceneId: "Sahne 11",
    sceneTitle: "Yerde Yatan Çocuk ve AK-47 ile Bekleyen Balon Polis",
    durationSec: 5,
    timeRange: "1:19–1:24",
    visualSummary:
      "Yerde hareketsiz yatan bir çocuk ve başında AK-47 ile bekleyen şişkin balon polis.",
    cameraMovement: "Alçak açıdan sabit ve sarsıcı dramatik kadraj",
    aiPrompt:
      "Style: Somber 3D editorial political cartoon drama. Low-angle shot on a cold grey courtyard where a small fallen hooded silhouette rests in deep shadow beside a dropped schoolbag on the pavement, while a towering, heartless spherical balloon policeman in a glossy black uniform stands guard beside the shadow.",
    motionPrompt:
      "Low, somber push-in across the cold grey pavement toward the fallen hooded silhouette in deep shadow while the towering spherical black balloon policeman stands motionless on guard overhead.",
    audioCues: "Rüzgar uğultusu ve ağır sessizlik",
    voiceoverOrText: "—",
  },
  {
    id: "11B",
    sceneId: "Sahne 11",
    sceneTitle: "Ara Kart · David and Goliath (2)",
    durationSec: 3,
    timeRange: "1:24–1:27",
    visualSummary: "Siyah ekranda kırmızı yazıyla David and Goliath",
    cameraMovement: "Sabit kadraj",
    aiPrompt: "Pure black screen with stark crimson red serif typography reading 'David and Goliath' centered.",
    audioCues: "Derin ve yankılı tek bir davul vuruşu",
    voiceoverOrText: "Siyah ekranda kırmızı yazıyla «David and Goliath»",
  },
  {
    id: "12A",
    sceneId: "Sahne 12",
    sceneTitle: "Yaşlı Çeçen Kadını Darp Eden Balon Polisler",
    durationSec: 5,
    timeRange: "1:27–1:32",
    visualSummary:
      "Yaşlı bir Çeçen kadını etrafını saran balon polisler coplarla dövüyor.",
    cameraMovement: "Sarsıntılı yakın plan dramatik kamera",
    aiPrompt:
      "Style: Dark 3D editorial political satire. Multiple bloated spherical balloon riot policemen in glossy black uniforms surround an elderly Chechen grandmother wearing a traditional headscarf, raising their rubber batons menacingly as she shields her face in the dimly lit street.",
    motionPrompt:
      "Tense handheld close camera shakes as the bloated spherical black balloon riot policemen loom around the elderly Chechen grandmother and swing their rubber batons while she shields her head.",
    audioCues: "Sert cop darbeleri, yaşlı kadının hıçkırığı ve uğursuz uğultu",
    voiceoverOrText: "—",
  },
  {
    id: "12B",
    sceneId: "Sahne 12",
    sceneTitle: "Ara Kart · David and Goliath (3)",
    durationSec: 3,
    timeRange: "1:32–1:35",
    visualSummary: "Siyah ekranda kırmızı yazıyla David and Goliath",
    cameraMovement: "Sabit kadraj",
    aiPrompt: "Pure black screen with stark crimson red serif typography reading 'David and Goliath' centered.",
    audioCues: "Derin ve yankılı tek bir davul vuruşu",
    voiceoverOrText: "Siyah ekranda kırmızı yazıyla «David and Goliath»",
  },
  {
    id: "13A",
    sceneId: "Sahne 13",
    sceneTitle: "Gazeteci Anna Politkovskaya Kalemiyle Balonları Patlatıyor",
    durationSec: 5,
    timeRange: "1:35–1:40",
    visualSummary:
      "Gazeteci Anna Politkovskaya elindeki gazeteci kalemiyle üzerine gelen balonları tek tek patlatıyor.",
    cameraMovement: "Aşağıdan kahramanca takip çekimi",
    aiPrompt:
      "Style: Cinematic editorial satire. Fearless journalist Anna Politkovskaya in her glasses and beige trench coat stands firm under a cold spotlight, thrusting her gleaming fountain pen forward like a rapier and popping the menacing black regime balloons floating toward her one after another.",
    motionPrompt:
      "Heroic low-angle tracking shot as journalist Anna Politkovskaya lunges forward with her sharp fountain pen like a sword, piercing and popping the floating black regime balloons one after another.",
    audioCues: "Keskin kalem hamleleri ve ardı ardına patlayan balon sesleri",
    voiceoverOrText: "—",
  },
  {
    id: "13B",
    sceneId: "Sahne 13",
    sceneTitle: "Ara Kart · David and Goliath (4)",
    durationSec: 3,
    timeRange: "1:40–1:43",
    visualSummary: "Siyah ekranda kırmızı yazıyla David and Goliath",
    cameraMovement: "Sabit kadraj",
    aiPrompt: "Pure black screen with stark crimson red serif typography reading 'David and Goliath' centered.",
    audioCues: "Derin ve yankılı tek bir davul vuruşu",
    voiceoverOrText: "Siyah ekranda kırmızı yazıyla «David and Goliath»",
  },
  {
    id: "8B",
    sceneId: "Sahne 8 (2. Bölüm)",
    sceneTitle: "Dondurmacı Tezgahında Fesli Emir Şahin ve Balon Ramzan'ın Pompası",
    durationSec: 6,
    timeRange: "1:43–1:49",
    visualSummary:
      "Dondurmacı tezgahında başı fesli Emir Şahin, balon Ramzan Kadirov'un elinde pompayı görünce gözlerinden kalp çıkıp iki büklüm eğiliyor; balon Ramzan onu şişirip balonlaştırmaya başlıyor.",
    cameraMovement: "Dondurma tezgahına alaycı pan ve şişme hareketiyle yaklaşma",
    aiPrompt:
      "Style: 3D editorial political cartoon satire. Beside a Turkish Maras ice-cream stand, Emir Şahin wearing a red tasseled fez and patterned vest spots floating balloon Ramzan Kadyrov holding an air pump. Cartoon red hearts pop out of Emir Şahin's eyes, he bends over submissively on the ground, and balloon Ramzan uses the pump to inflate Emir Şahin into a glossy round human-balloon.",
    motionPrompt:
      "Satirical pan and push-in beside the Turkish ice-cream stand as red hearts pop from fez-wearing Emir Şahin's eyes, he bows down submissively, and floating balloon Ramzan Kadyrov pumps air into him until Emir Şahin swells into a round glossy balloon.",
    audioCues: "Komik çizgi film kalp sesi, dondurma çıngırağı ve pompa tıslaması",
    voiceoverOrText: "—",
  },
  {
    id: "9A",
    sceneId: "Sahne 9",
    sceneTitle: "Medet Önlü Dağı Semalarında Kanlı Dolar Saçan Emir Şahin Balonu",
    durationSec: 6,
    timeRange: "1:49–1:55",
    visualSummary:
      "Emir Şahin balonu elinde dolar dolu çantalarla Medet Önlü'nün dağ halinin yanında semalarda uçuyor, kanlı dolarlar atıyor. Medet Dağı sinirle ona bakıyor.",
    cameraMovement: "Uçan balondan heybetli Medet Dağı'nın öfkeli bakışına pan",
    aiPrompt:
      "Style: Hybrid photorealistic monumental mountain and 3D satirical balloon. The round fez-wearing Emir Şahin balloon floats through the sky clutching briefcases overflowing with cash and tossing crimson-stained dollar bills into the wind beside the colossal granite mountain peak carved with the noble bearded face of Medet Önlü. Mountain Medet glares down at the floating balloon with righteous fury.",
    motionPrompt:
      "Camera pans from the floating fez-wearing Emir Şahin balloon tossing crimson-stained dollar bills from overflowing briefcases across to the colossal granite Mountain Medet Önlü glaring down in righteous fury.",
    audioCues: "Rüzgarda savrulan banknotlar ve dağdan yükselen öfkeli taş gürlemesi",
    voiceoverOrText: "—",
  },
  {
    id: "10C",
    sceneId: "Sahne 10 (2. Bölüm)",
    sceneTitle: "Başka Balonlar Emir Şahin'e Katılıyor",
    durationSec: 5,
    timeRange: "1:55–2:00",
    visualSummary:
      "Gökyüzünde başka şişkin balonlar uçarak Emir Şahin balonuna katılıyor.",
    cameraMovement: "Genişleyen gökyüzü kadrajı (zoom out)",
    aiPrompt:
      "Style: 3D editorial political cartoon satire. Several other smaller greedy human-balloons in suits and fezzes float up into the murky sky, clustering around the fez-wearing Emir Şahin balloon like a swarm of opportunistic parasites.",
    motionPrompt:
      "Slow dolly-out revealing several other greedy spherical human-balloons rising through the murky sky and bobbing around the fez-wearing Emir Şahin balloon.",
    audioCues: "Birbirine sürtünen plastik balon gıcırtıları ve kibirli kıkırdamalar",
    voiceoverOrText: "—",
  },
  {
    id: "11C",
    sceneId: "Sahne 11 (2. Bölüm)",
    sceneTitle: "Kafkasya Dağlarından Koparılan Taşlar ve Sapanlarla Patlayan Balonlar",
    durationSec: 6,
    timeRange: "2:00–2:06",
    visualSummary:
      "Kafkasya'da Dudayev, Mashadov, Mansur dağları eteklerindeki sinmiş insanlar dayanamayıp dağlardan taşlar kopararak sapanlarla balon askerlere fırlatıyor; balonlar bir bir patlıyor.",
    cameraMovement: "Direnişçilerin sapanlarından gökyüzünde patlayan balonlara hızlı takip",
    aiPrompt:
      "Style: Epic hybrid cinematic realism and 3D satire. At the rocky foothills of the colossal Dudayev, Maskhadov, and Sheikh Mansur granite mountains in the Caucasus, the oppressed people rise up in defiance, breaking sharp granite stones from the sacred mountains and firing them with wooden slingshots into the sky. The stones strike the floating balloon soldiers, popping them one by one in mid-air.",
    motionPrompt:
      "Dynamic upward tracking shot from the defiant crowd at the foothills of the Dudayev, Maskhadov, and Mansur granite mountains pulling back wooden slingshots and launching granite stones that burst the floating balloon soldiers in mid-air one after another.",
    audioCues: "Koparılan kaya sesleri, gerilen sapan lastiği vınlaması ve peş peşe patlayan balonlar",
    voiceoverOrText: "—",
  },
  {
    id: "12C",
    sceneId: "Sahne 12 (2. Bölüm)",
    sceneTitle: "Türkiye'de Kızıl Saçlı Çocuk: Düşünceden Öfkeye",
    durationSec: 5,
    timeRange: "2:06–2:11",
    visualSummary:
      "Türkiye'de kızıl saçlı bir çocuk önce yakın çekimde düşünceli görünür; sonra yüzünde bir anda kararlı bir öfke belirir.",
    cameraMovement: "Gözlere kilitlenen dramatik yakın çekim (extreme close-up)",
    aiPrompt:
      "Style: Cinematic dramatic realism. Tight close-up portrait of a young red-haired Anatolian hero in Turkey looking up at the sky in deep, sorrowful contemplation; suddenly his brows furrow and a fierce, righteous anger ignites in his eyes.",
    motionPrompt:
      "Tight dramatic push-in on the young red-haired Anatolian hero's freckled face as his quiet, thoughtful expression suddenly hardens into fierce, righteous anger with blazing eyes.",
    audioCues: "Derin nefes alış ve aniden yükselen epik davul ritmi",
    voiceoverOrText: "—",
  },
  {
    id: "12D",
    sceneId: "Sahne 12 (2. Bölüm)",
    sceneTitle: "Kızıl Saçlı Çocuk Medet Dağından Taş Koparıp Sapanla Balonları Vuruyor",
    durationSec: 6,
    timeRange: "2:11–2:17",
    visualSummary:
      "Tüm bedeni gözükür çekimde kızıl saçlı çocuk Medet Dağı'ndan taşlar kopararak sapanla balonları vurmaya başlıyor.",
    cameraMovement: "Tam boy kahramanca alt açıdan sapan atışını takip eden kamera",
    aiPrompt:
      "Style: Epic cinematic realism. Full-body low-angle shot of the young red-haired Anatolian hero standing at the base of the monumental granite Mountain Medet Önlü, breaking jagged stones from the mountain rock, loading his wooden slingshot, and firing stones high into the sky to burst the floating Emir Şahin and regime balloons.",
    motionPrompt:
      "Heroic full-body low-angle shot as the young red-haired Anatolian hero breaks a jagged stone from Mountain Medet Önlü, stretches his wooden slingshot taut, and fires upward into the sky, bursting the floating Emir Şahin balloon.",
    audioCues: "Sapan vınlaması, ıslık çalan taşlar ve gökyüzünde patlayan balonlar",
    voiceoverOrText: "—",
  },
  {
    id: "13C",
    sceneId: "Sahne 13 (2. Bölüm)",
    sceneTitle: "Sapanlı İnsanların Birleşip Tek Bir Kurta Dönüşmesi",
    durationSec: 6,
    timeRange: "2:17–2:23",
    visualSummary:
      "Cahar, Şamil, Mashadov ve Baysangur dağları etrafındaki sapanlı insanlar bir araya toplanıyor; toplandıkça kalabalık insan formu devasa tek bir Kurta dönüşüyor.",
    cameraMovement: "Kalabalığın etrafında yükselen 360 derece epik dönüş",
    aiPrompt:
      "Style: Mythic photorealistic epic. Around the foothills of the colossal Dudayev, Shamil, Maskhadov, and Baysangur granite mountains, hundreds of slingshot-wielding people rush together into a single united crowd; as they merge, their collective human form seamlessly transforms into one gigantic, awe-inspiring Caucasian Wolf (Borz) with silver-grey fur and glowing amber eyes.",
    motionPrompt:
      "Sweeping 360-degree rising camera around the foothills of the Dudayev, Shamil, Maskhadov, and Baysangur mountains as hundreds of slingshot-wielding people converge and morph seamlessly into a single colossal silver-grey Caucasian Wolf (Borz) with glowing amber eyes.",
    audioCues: "Binlerce kişinin ayak sesi ve gökleri titreten devasa kurt uluması",
    voiceoverOrText: "—",
  },
  {
    id: "13D",
    sceneId: "Sahne 13 (2. Bölüm)",
    sceneTitle: "Kurdun Tek Pençe Atışıyla Balonları Patlatması ve Uçuşan Tavuk Tüyleri",
    durationSec: 6,
    timeRange: "2:23–2:29",
    visualSummary:
      "Devasa Kurt, Ramzan Kadirov ve kalan tüm balonları tek pençe atışıyla patlatıyor; patlayan balonlardan havada tavuk tüyleri uçuşuyor.",
    cameraMovement: "Kurdun sıçrayışı ve pençe darbesiyle ağır çekim (slow-motion) patlama",
    aiPrompt:
      "Style: Epic mythic realism and satirical climax. The colossal Caucasian Wolf leaps toward the sky and unleashes a single sweeping strike of its giant claws across the floating Ramzan Kadyrov balloon and all remaining regime balloons. Every balloon bursts simultaneously in a massive shockwave, scattering clouds of white chicken feathers fluttering helplessly through the air.",
    motionPrompt:
      "Epic slow-motion low-angle shot as the colossal Caucasian Wolf leaps skyward and swipes its giant paw across the floating Ramzan Kadyrov balloon and regime balloons, bursting them all at once into a drifting cloud of white chicken feathers.",
    audioCues: "Şimşek gibi pençe darbesi, dev balon patlaması ve rüzgarda savrulan tüylerin hışırtısı",
    voiceoverOrText: "—",
  },
  {
    id: "14A",
    sceneId: "Sahne 14",
    sceneTitle: "Balon Ayı Kostümünün Havasını İndirip Korkuyla Sırıtan Putin",
    durationSec: 6,
    timeRange: "2:29–2:35",
    visualSummary:
      "Balon ayı kostümü giymiş Putin balonun havasını indirip normal hale dönüyor ve Kurda bakıp korkuyla sırıtıyor.",
    cameraMovement: "Kurdun omuz hizasından küçülen Putin'e yukarıdan bakan açı",
    aiPrompt:
      "Style: 3D editorial political cartoon satire. Vladimir Putin, wearing a giant inflatable brown bear balloon costume, hastily pulls the air plug to deflate the bear suit; as the costume shrivels into limp rubber folds around his ankles and returns him to his small normal stature, he looks up at the towering Wolf and forces a trembling, terrified grin.",
    motionPrompt:
      "High over-the-shoulder angle past the towering Wolf looking down at Vladimir Putin as his giant inflatable brown bear balloon costume rapidly hisses and deflates into limp folds around his shoes, leaving him tiny and trembling with a terrified grin.",
    audioCues: "Sönen balonun komik fırıldama sesi ve titrek, korku dolu yutkunma",
    voiceoverOrText: "—",
  },
  {
    id: "FIN1",
    sceneId: "Final",
    sceneTitle: "1. Kamu Spotu · Plastik Balonlar Olmayın",
    durationSec: 6,
    timeRange: "2:35–2:41",
    visualSummary:
      "Siyah ekran üzerinde daktilo yazısı ve seslendirme ile 1. Kamu Spotu: «Plastik doğaya ve vatanınıza zararlıdır. Bir gün patlayacak plastik balonlar olmayın.»",
    cameraMovement: "Sabit kadraj",
    aiPrompt:
      "Pure black screen with crisp white typewriter typography: 'Plastik doğaya ve vatanınıza zararlıdır. Bir gün patlayacak plastik balonlar olmayın.'",
    audioCues: "Mekanik daktilo tuş vuruşları ve vakur dış ses",
    voiceoverOrText:
      "DAKTİLO & DIŞ SES (1. Kamu Spotu): «Plastik doğaya ve vatanınıza zararlıdır. Bir gün patlayacak plastik balonlar olmayın.»",
  },
  {
    id: "FIN2",
    sceneId: "Final",
    sceneTitle: "2. Kamu Spotu (Bölüm 1) · Milletin Yapı Taşları",
    durationSec: 7,
    timeRange: "2:41–2:48",
    visualSummary:
      "Siyah ekran üzerinde daktilo yazısı ve seslendirme ile 2. Kamu Spotu (1. Bölüm): «Milletleri oluşturan temel yapı taşlarından vazgeçerseniz o milletten olma iddianızdan vazgeçmişsiniz demektir.»",
    cameraMovement: "Sabit kadraj",
    aiPrompt:
      "Pure black screen with crisp white typewriter typography: 'Milletleri oluşturan temel yapı taşlarından vazgeçerseniz o milletten olma iddianızdan vazgeçmişsiniz demektir.'",
    audioCues: "Mekanik daktilo tuş vuruşları, şaryo dönüş zili ve vakur dış ses",
    voiceoverOrText:
      "DAKTİLO & DIŞ SES (2. Kamu Spotu): «Milletleri oluşturan temel yapı taşlarından vazgeçerseniz o milletten olma iddianızdan vazgeçmişsiniz demektir.»",
  },
  {
    id: "FIN3",
    sceneId: "Final",
    sceneTitle: "2. Kamu Spotu (Bölüm 2) · Anıt Dağlar ve Patlayan Balonlar",
    durationSec: 8,
    timeRange: "2:48–2:56",
    visualSummary:
      "Siyah ekran üzerinde daktilo yazısı ve seslendirme ile 2. Kamu Spotu (2. Bölüm): «Bu milletin tüm vatanını zapt etseniz dahi anıt dağlar gibi yükselmek sizin için hayaldir. Ancak bir balon gibi hızla şişer, uçar ve patlayıp gidersiniz.»",
    cameraMovement: "Sabit kadraj",
    aiPrompt:
      "Pure black screen with crisp white typewriter typography: 'Bu milletin tüm vatanını zapt etseniz dahi anıt dağlar gibi yükselmek sizin için hayaldir. Ancak bir balon gibi hızla şişer, uçar ve patlayıp gidersiniz.'",
    audioCues: "Son daktilo vuruşu, uzaktan gelen rüzgar ve sessizlik",
    voiceoverOrText:
      "DAKTİLO & DIŞ SES (2. Kamu Spotu): «Bu milletin tüm vatanını zapt etseniz dahi anıt dağlar gibi yükselmek sizin için hayaldir. Ancak bir balon gibi hızla şişer, uçar ve patlayıp gidersiniz.»",
  },
];

/** Detects whether a user's script is the 'Balonlar ve Dağlar' scenario (or a close variant). */
export function isBalonlarScript(script: string): boolean {
  const lower = script.toLocaleLowerCase("tr");
  const hits = [
    lower.includes("dudayev"),
    lower.includes("kadirov"),
    lower.includes("balon"),
    lower.includes("mashadov") || lower.includes("maskhadov"),
    lower.includes("david and goliath") || lower.includes("emir şahin") || lower.includes("kamu spotu"),
  ].filter(Boolean).length;
  return hits >= 4;
}

export function balonlarMasterTemplate(aspectRatio: AspectRatio = "16:9") {
  return {
    title: "Balonlar ve Dağlar · Tam Senaryo",
    style: "3D karikatür hiciv / fotogerçekçi anıt dağlar",
    aspectRatio,
    budget: null,
    genre: "epic",
    brief: "",
    shots: BALONLAR_MASTER_SHOTS.map((shot) => ({ ...shot })),
    characters: BALONLAR_MASTER_CHARACTERS.map((character) => ({
      ...character,
      aliases: [...character.aliases],
    })),
  };
}
