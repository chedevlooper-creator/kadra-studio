# Kadra Studio — Kod İncelemesi ve İyileştirme Planı

İnceleme tarihi: 22 Ekim 2026. Kapsam: `src/lib` (domain + üretim + sağlayıcılar), `src/app/api` (20 rota), `src/components` (8 bileşen + 52 KB CSS), testler ve yapılandırma. Bu belge **öneri** niteliğindedir; inceleme sırasında hiçbir kaynak dosya değiştirilmemiştir.

---

## 1. Özet

Kadra Studio, yerel tek kullanıcı için tasarlanmış, uçtan uca çalışan bir senaryo→film hattı. Genel kalite beklentinin üzerinde:

- **Sağlık:** `tsc --noEmit` temiz, `eslint` temiz, 92/92 test geçiyor (gerçek FFmpeg ile uçtan uca üretim testleri dahil).
- **Güvenlik duruşu iyi:** yalnızca loopback, Host + Origin + `Sec-Fetch-Site` doğrulaması, gövde boyutu sınırları, zod ile katı şema, yol geçişi korumaları, sağlayıcı indirmelerinde host allowlist.
- **Para disiplini güçlü:** teklif → onay → rezervasyon → tek gönderim kuralı; belirsiz gönderim asla yeniden denenmiyor; harcama defteri tutuluyor.
- **Zayıf noktalar:** teklif geçersizleştirme eksikliği (P0), yedekleme/global harcama tavanı yokluğu, tek JSON dosyasının ölçek sınırı, iptal/hata sonrası medya artıkları, rota/UI/narration test boşlukları ve bakımı zorlaştıran dev CSS/JSX.

Öncelik sırası: **önce parayı ve veriyi koru**, sonra dayanıklılık, sonra ölçek, en son UX/ürünleşme.

---

## 2. Bulgular

Önem: **P0** = para/veri kaybı riski, **P1** = doğruluk/dayanıklılık, **P2** = bakım/UX, **P3** = ürün/ölçek.

| ID | Önem | Bulgu | Kanıt |
| :-- | :-- | :-- | :-- |
| F1 | **P0** | Teklif parmak izi karakter sayfası onaylarını içermiyor; teklif sonrası karakter değişikliği bayat teklifi geçerli bırakıyor | `src/lib/projects.ts:166`, `src/lib/projects.ts:824`, `src/lib/projects.ts:921` |
| F2 | **P0** | Küresel harcama tavanı / acil durdurma anahtarı yok | `src/lib/projects.ts:161`; `src/lib/production/worker.ts` (5 submit noktası) |
| F3 | **P0** | Veri dosyası için otomatik yedek/snapshot yok; migration öncesi kopya alınmıyor | `src/lib/projects.ts:396`, `src/lib/projects.ts:410` |
| F4 | **P1** | Idempotency defteri 1.000 kayıtla sınırlı ve eski kayıtlar atılıyor; çok eski bir yeniden deneme çift üretim başlatabilir | `src/lib/projects.ts:579` |
| F5 | **P1** | Medya temizliği yalnızca başarılı montajdan sonra çalışıyor; iptal/hata sonrası kare, klip ve `runs/` artıkları kalıyor | `src/lib/production/worker.ts:561` |
| F6 | **P1** | `getBootstrap` tüm projeleri tam hâliyle döndürüyor (10 proje = 528 KB); proje sayısıyla doğrusal büyüyor | `src/lib/projects.ts:471` |
| F7 | **P1** | Her işlem tüm veritabanını okuyup doğrulayıp yeniden yazıyor; worker adım başına onlarca transaction açıyor | `src/lib/projects.ts:410` |
| F8 | **P1** | Karakter fotoğraf araması her istekte DeepSeek web araması + 8 Commons + 3 Openverse çağrısı yapıyor; önbellek yok | `src/app/api/projects/[id]/characters/[cid]/reference/route.ts:20` |
| F9 | **P1** | Aynı retry/timeout/backoff mantığı üç sağlayıcı dosyasında kopyalanmış | `src/lib/providers/nvidia.ts:45`, `src/lib/providers/deepseek.ts:45`, `src/lib/providers/gmi.ts:33` |
| F10 | **P1** | Müzik ve fotoğraf yüklemelerinde idempotency yok; yanıt kaybında yetim dosya kalır | `src/app/api/projects/[id]/music/route.ts:24`, `src/app/api/projects/[id]/characters/[cid]/reference/route.ts:93` |
| F11 | **P1** | Fotoğraf yükleme tüm gövdeyi belleğe alıyor; müzik yükleme akışlı — tutarsız | `src/app/api/projects/[id]/characters/[cid]/reference/route.ts:102` |
| F12 | **P1** | `committedSpend` iki ayrı uygulama (sunucu ve istemci); yuvarlama ve bakım farkı | `src/lib/projects.ts:161`, `src/components/paid-motion-panel.tsx:20` |
| F13 | **P1** | Medya temizliği `sheet-*` ve `ref-*` dosyalarını kapsamıyor; DB'de 24 ile sınırlanan denemelerin dosyaları kalıyor | `src/lib/production/worker.ts:561` |
| F14 | **P1** | `startRun`, teklif anından sonra oluşan yeniden kullanılabilir klibi kontrol etmiyor (teorik çift ödeme) | `src/lib/projects.ts:548`, `src/lib/production/worker.ts:271` |
| F15 | **P1** | Test boşlukları: API rotaları, `voiceStep`/narration, medya range, UI akışları | `src/lib/production/worker.test.ts`, `src/lib/projects.test.ts` |
| F16 | **P1** | Şablon içe aktarma ve proje oluşturma idempotent değil; mükerrer proje oluşabiliyor (depoda 4 aynı "Balonlar" projesi var) | `src/app/api/templates/balonlar/route.ts:5` |
| F17 | **P2** | CSS tek satırda, 52 KB ve 52 satır; okunamaz ve diff'lenemez | `src/components/project-studio.css:1` |
| F18 | **P2** | `project-studio.tsx` altı sekmeyi tek dosyada ve 1000+ karakterlik satırlarla tutuyor | `src/components/project-studio.tsx:117` |
| F19 | **P2** | Yazı boyutları 8–11 px; küçük ekranda okunabilirlik ve kontrast riski | `src/app/globals.css:1` |
| F20 | **P2** | Müzik promptu proje adında "balonlar" geçince özelleşiyor — ürün kodu proje verisine bağlı | `src/components/creative-tools.tsx:28` |
| F21 | **P2** | Sistem rehberi §16'daki tablo eskimiş (TTS "bağlı değil" diyor, oysa çalışıyor) | `SISTEM-REHBERI.md:499` |
| F22 | **P2** | `next.config.ts` içinde gereksiz `serverExternalPackages: []` | `next.config.ts:1` |
| F23 | **P2** | `artifacts/kadra-flow-integration.png` aslında JPEG | `artifacts/kadra-flow-integration.png` |
| F24 | **P2** | Git deposu yok; sürüm geçmişi, yedek ve kod incelemesi akışı yok | — |
| F25 | **P2** | Yıkıcı işlemler onaysız: senaryo/stil değişimi tüm çekimleri ve karakterleri siler; kaydedilmemiş senaryo ile sekme değişimi uyarısız | `src/lib/projects.ts:491` |
| F26 | **P2** | Canlı fiyat ipucu istemcide sabit (`GMI_RATE = 0.06`), sunucu canlı fiyat kullanıyor | `src/components/narration-panel.tsx:10` |
| F27 | **P2** | Formatlama aracı yok (Prettier), CI betiği yok; kontroller elle çalıştırılıyor | `package.json:5` |

---

## 3. Detaylı bulgular ve çözüm önerileri

### F1 — Teklif, karakter bankası değişince geçersizleşmiyor (P0)

`quoteFingerprint` yalnızca `aspectRatio, quality, budget, genre, narration` ve çekim alanlarını hash'liyor; `project.characters` (özellikle `sheet.status`, `sheet.chosen`, onaylı deneme kimlikleri) kapsam dışı. `reviewCharacterSheet`, `updateCharacter`, `setCharacterReference`, `deleteCharacter` da `project.quote`'u temizlemiyor.

İki somut sonuç:

1. **Onaysız sayfa onaylanırsa:** ücretsiz kare yeniden kullanılır, yeni karakter kareye hiç girmez; kullanıcı "referanslı" sandığı videoyu alır.
2. **Onaylı sayfa reddedilirse:** teklif hâlâ ücretli kare satırı taşır; worker referanssız kare üretir ama ücreti alır — küçük ama gerçek bir sürpriz maliyet.

**Çözüm:**
- `quoteFingerprint`'e `characters.map(c => [c.id, c.kind, c.sheet.status, c.sheet.chosen, c.sheet.attempts.map(a => a.id)])` ve `frameModel` ekle.
- Karakteri etkileyen tüm mutasyonlarda `project.quote = null` (veya `quote.staleSince`).
- İstemci `PaidMotionPanel.dirty` hesabına "onaylı sayfa kümesi" imzasını ekle.
- Regresyon testi: teklif al → sayfayı onayla → `startRun` 409 dönmeli.

**Kabul ölçütü:** Karakter bankasındaki herhangi bir değişiklikten sonra eski `quoteId` ile üretim başlatılamaz; test bunu doğrular.

**Efor:** 0,5 gün.

### F2 — Global harcama tavanı yok (P0)

Bütçe proje bazında korunuyor, ancak toplam harcamayı sınırlayan bir üst katman yok. Bir hata döngüsü (ör. yeni proje + onay + tekrar) teorik olarak sınırsız harcayabilir; GMI anahtarı canlı.

**Çözüm:** `KADRA_MAX_SPEND_USD` ortam değişkeni; `startRun`/`startRepair`/`startCharacterRun` rezervasyonundan önce toplam `committedSpend` kontrolü; ayrıca `KADRA_KILL_SWITCH=on` ile tüm `submit` çağrılarını durdur. Worker'da `submit` öncesi son kapı.

**Kabul ölçütü:** Tavan aşıldığında 402 benzeri anlaşılır hata; tek bir testte sahte sağlayıcıyla doğrulanır.

**Efor:** 0,5 gün.

### F3 — Yedekleme ve migration güvenliği (P0)

`writeDatabase` atomik yazıyor (tmp + fsync + rename) ve bozuk dosyayı ezmiyor; bu iyi. Ancak:

- Düzenli yedek yok; kullanıcı hatası/disk arızası durumunda tek kopya.
- `migrateDatabase` v1→v2 dönüşümü yapıyor, öncesinde kopya almıyor.
- 20 MB sınırı aşıldığında yazma reddediliyor; kullanıcıya "dışa aktar ve sil" deniyor ama dışa aktarma yalnızca tek proje.

**Çözüm:** Her başarılı yazımdan önce `projects.json.bak` (günlük) ve migration öncesi `projects.json.pre-v2`; `kadra doctor` ile şema doğrulama + onarım; tüm projeleri tek ZIP/JSON olarak dışa aktarma.

**Kabul ölçütü:** Bozuk dosya senaryosunda son iyi yedekten geri dönüş; dışa aktarma/yükleme turu veri kaybetmez.

**Efor:** 1 gün.

### F4 — Idempotency defteri sınırı (P1)

`receipts` 1.000 kayıtla sınırlı ve `splice(0, n)` ile en eskiler atılıyor. Atılan bir anahtar tekrar gönderilirse ve proje boştaysa yeni bir ücretli üretim başlayabilir.

**Çözüm:** Kayıtları proje bazında ve zaman damgalı tut; temizliği TTL (ör. 30 gün) ile yap; `startRun`'da "son 24 saatte aynı proje için aynı revizyon" ek kontrolü.

**Efor:** 0,5 gün.

### F5 / F13 — İptal ve hata sonrası medya artıkları (P1)

`pruneMedia` yalnızca `runNext` içinde, montaj başarılı olduktan sonra çağrılıyor. İptal (`cancelRun`), kalıcı hata (`stopRun`) ve süreç çökmesi durumunda yarım kalan kareler, klipler ve `runs/<runId>/film-silent.mp4` diskte kalıyor. `pruneMedia` ayrıca `sheet-*` ve `ref-*` dosyalarını kapsamıyor.

**Çözüm:** İptal/hata sonunda da "kullanımdaki dosyalar" kümesine göre temizlik; başlangıçta (instrumentation) yetim dosya taraması; `sheet-*` dosyalarını DB'deki deneme listesine göre budama.

**Efor:** 1 gün.

### F6 / F7 — Bootstrap ve tek dosya ölçeği (P1)

- Ana sayfa 528 KB JSON indiriyor; 100 projede ~5 MB ve her yenilemede tekrar.
- Her API çağrısı 700 KB dosyayı parse edip zod ile doğruluyor, değişiklikte yeniden serileştiriyor. Worker her adımda birden çok transaction açıyor (kare adımında 4, karakter adımında deneme başına 3 ek).

**Kısa vadeli çözüm (1 gün):** `GET /api/projects?summary=1` yalnızca başlık, kapak, durum, süre, çekim sayısı döndürsün; ana sayfa bunu kullansın. Süreç içi bellek önbelleği + `mtime`/boyut kontrolü.

**Orta vadeli çözüm (1–2 hafta):** SQLite (`node:sqlite` Node 22'de deneysel; `better-sqlite3` alternatif) veya tek yazıcılı bir kuyruk. Şema aynı zod nesnelerinden üretilebilir. Migration: çift yazım + doğrulama + geri dönüş yolu.

**Kabul ölçütü:** 100 proje / 4.000 çekim sentetik veride ana sayfa < 200 ms ve < 150 KB; adım başına transaction < 5 ms.

### F8 — Arama maliyeti (P1)

Her "Ara" tıklaması DeepSeek web araması (ücretli/gecikmeli) + 8 Commons sorgusu + 3 Openverse sorgusu yapıyor; aynı karakter için tekrar tekrar. Öneri: `(characterId, query, source, broad)` anahtarlı 10 dakikalık bellek önbelleği, tek uçuş (single-flight), ilk istekte research, sonraki isteklerde yalnızca arama.

**Efor:** 0,5 gün.

### F9 — Sağlayıcı HTTP katmanı (P1)

Üç dosyada da benzer `for (attempt...)` + `AbortSignal.timeout` + hata mesajı eşlemesi var. Ortak `lib/providers/http.ts`: tek `request()` (retry, jitter, `Retry-After`, devre kesici, istek kimliği), sağlayıcıya özgü yalnızca URL/başlık/hata eşlemesi. Kazanç: tutarlılık, test edilebilirlik, gözlemlenebilirlik.

**Efor:** 1 gün (davranış korunarak).

### F10 / F11 — Yükleme dayanıklılığı (P1)

- Müzik ve fotoğraf yüklemede `Idempotency-Key` yok; yanıt kaybında istemci tekrar denerse yetim dosya oluşur. Anahtar + dosya adı türetme (hash) ile çözülebilir.
- Fotoğraf yükleme `arrayBuffer()` ile tamamını belleğe alıyor; müzikteki akışlı desen buraya da uygulanmalı.

**Efor:** 0,5 gün.

### F12 / F26 — Tek kaynak ilkesi (P1/P2)

`committedSpend` iki yerde, fiyat ipucu istemcide sabit. `lib/money.ts` (yuvarlama + harcama) ve `/api/pricing/hints` (veya bootstrap içinde) tek kaynak olmalı. Aksi halde sunucu ve arayüz farklı tutarlar gösterir.

### F14 — Çift ödeme kenar durumu (P1)

Teklif alındıktan sonra aynı kare+hareket için ücretli bir klip oluşursa, `startRun` bu klibi kontrol etmeden rezervasyon yapıyor. `startRun` içinde `reusableClip` kontrolü + varsa `reused` satırına dönüştürme, teklif toplamını düşürme.

**Efor:** 0,5 gün + test.

### F15 — Test kapsamı (P1)

Mevcut 92 test domain mantığında güçlü. Eksikler:

- **Rota testleri:** her `route.ts` için doğrudan handler çağrısıyla revision/origin/boyut/idempotency testleri (supertest gerekmez).
- **Narration:** `voiceStep`, `narrationTracks`, `applySoundtrack`'in ses altında müzik kısma davranışı (sahte `say` ve `ffmpeg` ile).
- **Medya:** range istekleri (`bytes=0-`, `bytes=-500`, geçersiz aralık, 416).
- **UI:** Playwright ile üç kritik akış: teklif→onay→üretim, bölge onarımı, müzik yükleme.
- **Regresyon:** F1, F2, F4 için özel testler.

**Efor:** 2–3 gün, kademeli.

### F16 — Mükerrer proje (P1)

`/api/templates/balonlar` ve `POST /api/projects` idempotency anahtarı kabul etmiyor. Depoda birebir aynı 4 "Balonlar ve Dağlar · Flow" projesi var (3'ünde hiç üretim yapılmamış). `NewProjectDialog` çift tıklamayı engelliyor ama ağ tekrarı/yeni sekme engellenmiyor.

**Çözüm:** Her iki rotaya `Idempotency-Key`; şablon için sabit bir "template instance" anahtarı; aynı başlık+açıklama 10 saniye içinde tekrar gelirse mevcut projeyi döndür.

### F17–F19 — Bakım ve okunabilirlik (P2)

- CSS tek satırda; `@import` zinciri ve `!important` kullanımı var. Prettier + CSS'i mantıksal dosyalara bölme (`studio.css`, `paid.css`, `character.css`).
- `project-studio.tsx` 6 sekmeyi tek bileşende tutuyor; `StoryboardTab`, `ProductionTab`, `TimelineTab`, `ScriptTab` olarak ayrılmalı. Aynı şekilde `character-bank.tsx` (arama, düzenleme, deneme listesi) alt bileşenlere.
- Minimum 12 px gövde yazısı; `--font-xs` gibi token'lar; kontrast için WCAG AA hedefi.

### F20–F27 — Küçük ama önemli (P2)

- "balonlar" özel promptunu `templates/balonlar.json` içine taşı (`musicPrompt` alanı).
- Rehber §16'yı güncelle.
- `serverExternalPackages: []` kaldır.
- Artefaktı `.jpg` yap veya yeniden üret.
- `git init` + ilk commit + `.env.local` hariç tutma doğrulaması.
- Yıkıcı işlemler için onay diyaloğu: senaryo/stil değişimi, "planı yenile", karakter silme.
- Kaydedilmemiş senaryo varken sekme/geri geçişinde uyarı (`beforeunload` + sekme içi onay).
- `GMI_RATE` yerine sunucudan gelen tahmin.
- `package.json`: `format`, `lint:fix`, `check` (typecheck + lint + test) betikleri; CI (GitHub Actions) eklenirse aynı betik.

---

## 4. Hedef mimari ilkeleri

1. **Para tek kapıdan geçer.** Tüm ücretli çağrılar `submit()`; ondan önce rezervasyon + global tavan + kill switch. Bu kapı test edilebilir tek bir fonksiyon olmalı.
2. **Teklif = sözleşme.** Teklifi geçersiz kılan her alan parmak izinde olmalı; "hangi girdiler ücreti etkiler?" sorusunun cevabı kodda tek yerde durmalı.
3. **Yazma tek yerde, okuma önbellekli.** Şimdilik dosya + kilit yeterli; ölçek noktasında SQLite. Okuma yolu her istekte tüm dosyayı ayrıştırmamalı.
4. **Sağlayıcılar ince adaptör.** Retry/timeout/log tek ortak katmanda; her sağlayıcı yalnızca şema ve hata eşlemesi.
5. **Medya yaşam döngüsü sahipli.** Her dosyanın bir sahibi ve temizlik kuralı olmalı; başarı, iptal ve çökme aynı temizliği tetiklemeli.
6. **Arayüz durumu sunucuyla tek yönlü.** Teklif, harcama ve fiyat ipuçları sunucudan gelir; istemci kendi hesabını yapmaz.
7. **Değiştirilebilir model kataloğu.** Model kimlikleri/fiyat anahtarları yapılandırmada; açılışta şema doğrulaması; değişiklik release gerektirmez.

---

## 5. Yol haritası

### Faz 0 — Güvenlik ağı (2–3 gün)

| # | İş | Kabul ölçütü |
| :-- | :-- | :-- |
| 0.1 | `git init`, ilk commit, `.env.local` kontrolü | Geçmiş var; anahtar commit'te değil |
| 0.2 | F1: teklif parmak izi + karakter mutasyonlarında teklif iptali | Regresyon testi: onay sonrası eski teklif 409 |
| 0.3 | F2: global harcama tavanı + kill switch | Tavan aşımında istek gönderilmiyor |
| 0.4 | F3: günlük yedek + migration öncesi snapshot | Bozuk dosyadan geri dönüş testi |
| 0.5 | F21/F22/F23: doküman ve artefakt düzeltmeleri | Rehber güncel; artefakt uzantısı doğru |
| 0.6 | `format` + `check` betikleri, Prettier | `npm run check` yeşil |

### Faz 1 — Doğruluk ve dayanıklılık (1–2 hafta)

| # | İş | Kabul ölçütü |
| :-- | :-- | :-- |
| 1.1 | F4: idempotency TTL ve proje bazlı saklama | Eski anahtar çift üretim başlatamıyor |
| 1.2 | F5/F13: iptal/hata/çökme sonrası medya temizliği + açılışta yetim tarama | Tekrarlanan iptal testinde disk sabit |
| 1.3 | F14: teklif anında klip yeniden kullanım kontrolü | Aynı kare+hareket ikinci kez ücretlenmiyor |
| 1.4 | F10/F11: yüklemelerde idempotency + akışlı okuma | Ağ kesintisi sonrası yetim dosya yok |
| 1.5 | F9: ortak sağlayıcı HTTP katmanı | Üç sağlayıcı testi aynı davranışı doğruluyor |
| 1.6 | F6: özet bootstrap + detay endpoint | Ana sayfa < 150 KB |
| 1.7 | F15: rota ve narration testleri | Kapsam: `src/app/api/**` temel mutlu/kötü yollar |
| 1.8 | F12/F26: para/fiyat tek kaynak | İstemcide sabit fiyat kalmadı |
| 1.9 | F16: idempotent şablon/proje oluşturma | Çift istek tek proje |

### Faz 2 — Ölçek ve performans (2–3 hafta)

| # | İş | Kabul ölçütü |
| :-- | :-- | :-- |
| 2.1 | SQLite'a geçiş (şema zod'dan üretilir) | 100 proje sentetik veride tüm API p95 < 150 ms |
| 2.2 | Bellek içi okuma önbelleği + mtime doğrulaması | Boşta CPU ~0; yazma sonrası tutarlı |
| 2.3 | Ağır işlemler için kuyruk ayrımı (worker zaten ayrılabilir) | `KADRA_WORKER=off` ile bağımsız çalışma testi |
| 2.4 | Medya boyut paneli / depolama göstergesi | Ayarlar'da gerçek disk kullanımı |
| 2.5 | Performans regresyon testi (benchmark) | CI'da eşik kontrolü |

### Faz 3 — Arayüz ve erişilebilirlik (2 hafta)

| # | İş | Kabul ölçütü |
| :-- | :-- | :-- |
| 3.1 | `project-studio.tsx` ve `character-bank.tsx` bölme | Hiçbir dosya > 400 satır |
| 3.2 | CSS'i modülerleştirme + Prettier | Diff okunabilir |
| 3.3 | Tipografi token'ları, min 12 px, AA kontrast | Lighthouse a11y ≥ 95 |
| 3.4 | Yıkıcı işlem onayları + kaydedilmemiş değişiklik koruması | Senaryo kaybı senaryosu yok |
| 3.5 | Yönlendirilmiş üretim akışı (tek "Başla" + gelişmiş mod) | Kullanıcı testinde adım sayısı düşüyor |
| 3.6 | Polling için `aria-live`, klavye ile tam gezinme | Ekran okuyucu duyurusu |

### Faz 4 — Ürünleşme (4+ hafta)

- Kimlik doğrulama + çok kullanıcı (Postgres, pg-boss).
- S3 uyumlu medya deposu, imzalı URL'ler.
- Model kataloğu yapılandırması + açılış doğrulaması.
- i18n (TR/EN), hak/lisans yönetimi (gerçek kişiler için onay akışı, çıktı metadata'sı).
- Gözlemlenebilirlik: yapılandırılmış log, adım süreleri, sağlayıcı hata oranı, maliyet panosu.
- CLI: `kadra doctor`, `kadra export`, `kadra run`.

---

## 6. Başarı ölçütleri

| Alan | Metrik | Hedef |
| :-- | :-- | :-- |
| Kalite | `npm run check` (typecheck + lint + test) | Her commit'te yeşil |
| Para | Çift gönderim / çift ücret olayı | 0 (fault-injection testleriyle) |
| Para | Teklif sonrası bayat üretim | 0 (F1 regresyonu) |
| Performans | Ana sayfa yükü (100 proje) | < 200 ms, < 150 KB |
| Performans | API p95 | < 150 ms |
| Dayanıklılık | İptal/hata sonrası disk artışı | 0 yetim dosya (açılış taraması) |
| Erişilebilirlik | Lighthouse a11y | ≥ 95 |
| Bakım | En büyük kaynak dosya | < 400 satır |

---

## 7. Riskler ve notlar

- **SQLite geçişi** en riskli adım: çift yazım + doğrulama + geri dönüş planı olmadan yapılmamalı. Faz 2'ye kadar dosya tabanlı yapı yeterli.
- **Sağlayıcı şeması değişebilir:** GMI parametreleri ve fiyatları canlı doğrulanıyor (iyi); yine de sözleşme testleri (kaydedilmiş yanıtlar) eklenmeli.
- **Model maliyetleri:** fiyatlar kodda sabit değil, canlı okunuyor; ancak küresel tavan olmadan bu koruma yeterli değil.
- **Eşzamanlı düzenleme:** Bu inceleme sırasında çalışma alanında başka bir oturum/araç dosya değiştiriyordu (`character-bank.tsx`, `project-studio.tsx`, `studio-app.tsx`). Uygulamaya geçmeden önce tek bir oturumda çalışılması ve git ile çakışmaların izlenmesi önerilir.
- **Yasal:** Gerçek kişilerin benzerliğiyle içerik üretimi kişilik hakları açısından risk taşır. Ürünleşme aşamasında onay/lisans akışı ve görünür uyarı eklenmeli; bu, teknik bir kontrolle (ör. `rightsAcknowledged` alanı) desteklenebilir.

---

## 8. Hemen yapılabilecek 10 iş (ilk hafta)

1. `git init` + ilk commit.
2. F1: teklif parmak izine karakter sayfalarını ekle, mutasyonlarda teklifi temizle.
3. F2: `KADRA_MAX_SPEND_USD` ve kill switch.
4. F3: günlük `projects.json` yedeği.
5. F5: iptal/hata sonrası medya budaması.
6. F16: şablon rotasına idempotency.
7. F6: özet bootstrap.
8. F15: teklif/karakter regresyon testleri.
9. F21–F23: doküman ve artefakt düzeltmeleri.
10. `npm run check` + Prettier.

---

## 9. Uygulama günlüğü

### 2026-10-22 — Faz 0 (güvenlik ağı) tamamlandı

| İş | Durum | Not |
| :-- | :-- | :-- |
| F1 — teklif geçersizleştirme | ✅ | `quoteFingerprint` karakter bankasını ve `frameModel`'i kapsıyor; karakter ekleme/düzenleme/silme, fotoğraf değiştirme ve sayfa onaylama/reddetme teklifi düşürüyor. Regresyon testi eklendi. |
| F2 — harcama tavanı + kill switch | ✅ | `KADRA_MAX_SPEND_USD` ve `KADRA_KILL_SWITCH`; rezervasyon anında 402/403, gönderim anında son kapı. İki regresyon testi eklendi. |
| F3 — yedekleme | ✅ | Günlük `.data/backups/projects-YYYY-MM-DD.json` (son 7) ve migration öncesi `projects.pre-vN.json`; iki test eklendi. |
| F21 — rehber §16 | ✅ | TTS ve veritabanı satırları güncellendi. |
| F22 — `next.config.ts` | ✅ | Gereksiz `serverExternalPackages` kaldırıldı. |
| F23 — artefakt uzantısı | ✅ | `artifacts/kadra-flow-integration.jpg` olarak yeniden adlandırıldı. |
| F24 — sürüm kontrolü | ✅ | `git init` + ilk commit (`b96b324`); `.env.local` sahne dışı. |
| F27 — kontroller | ◐ | `npm run check` eklendi; Prettier/CI henüz yok. |

Doğrulama: `npm run check` → typecheck ✅, lint ✅, 95/95 test ✅.

Sonraki adım: **Faz 1** (F4 idempotency TTL, F5 iptal/hata medya temizliği, F14 çift ödeme kenarı, F10/F11 yükleme dayanıklılığı, F6 özet bootstrap).

