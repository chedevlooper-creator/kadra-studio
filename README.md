# Senaryodan Videoya — Mimari ve Geliştirme Planı

Hazırlanma tarihi: 22 Ekim 2026.

Ürün hedefi: Kullanıcı senaryosunu ve üretim tercihlerini verir; uygulama sahneleri planlar, bağlı yapay zekâ servisleri arasından uygun modelleri seçer, görsel ve video parçalarını üretir, ses ve metinleri yerleştirir, indirilebilir bir final video hazırlar.

Bu klasör tasarım belgelerini ve uygulamanın yerel sürümünü (Kadra Studio) içerir. Uygulama senaryodan indirilebilir bir MP4 film üretir. **Görsel ve video üretiminin tamamı GMI Cloud'un ücretli modelleriyle yapılır; ücretsiz görsel modeli veya ücretsiz kamera hareketi yoktur.** FFmpeg yalnızca yazı kartları, ses/müzik miksajı ve montaj için kullanılır.

1. **Modeller Arası Köprü ve Planlama:** `DEEPSEEK_API_KEY` tanımlıysa DeepSeek V4.1 Flash (`deepseek-flash` / `deepseek-v4-pro`) ve yerleşik Web Arama API'si (`/v1/tools/search`) senaryoyu planlar, karakterleri webde araştırıp çok dilli Wikimedia Commons sorguları üretir ve görsel kalite hakemliği yapar. Tanımlı değilse veya ulaşılamazsa NVIDIA Nemotron 3 Ultra, o da yoksa yerel kural tabanlı planlayıcı devreye girer.
2. **Karakter Bankası ve Referans Sayfaları:** Her karakter ve mekân için **her zaman GMI Gemini Nano Banana 2.1** ile referans sayfası üretilir. Wikimedia Commons/Openverse'ten lisanslı fotoğraf aranabilir, bilgisayardan fotoğraf yüklenebilir veya **internette bulduğun herhangi bir görselin https adresi yapıştırılabilir** (telif ve kişilik hakları kullanıcıdadır; kaynak adresi referansla birlikte saklanır). Fotoğraf varsa model onu referans alır, yoksa tariften çizer. Yapay zekâ hakemi (DeepSeek VL / Nemotron VL) stil, özellik, poz ve temizlik puanlarını (`1–5`) değerlendirir; sayfa ancak sen onaylayınca karelerde referans olur.
3. **Kareler:** Her video çekiminin başlangıç karesi GMI görsel modeliyle üretilir. Onaylı karakter ve mekân sayfaları modele referans görsel olarak verilir; aynı mekândaki bir önceki çekim de ışık ve eşya sürekliliği için eklenir. Kare modeli kalite seviyesine uyanlar arasından canlı fiyatla en ucuzu seçilerek belirlenir: Hunyuan Image 3.5, Seedream 5.0 Lite, Nano Banana 2 Lite veya Nano Banana 2.1 (`src/lib/routing/frame-router.ts`); istersen modeli kendin de seçebilirsin.
4. **Kontrol:** DeepSeek V4.1 Flash VL (veya Nemotron 3.5 Super VL) kareyi çekim açıklaması ve onaylı karakter sayfalarıyla karşılaştırır ve her hatanın yerini işaretler. Üretim başarısız olursa ücretsiz bir yedek model devreye girmez; adım durur ve durum akış günlüğünde görünür. Yerel hata, sayfayı baştan üretmek yerine yalnızca o bölgeyi maskeli düzenlemeyle onarır.
5. **Video:** Her video çekimi GMI video yönlendiricisiyle gerçek videoya dönüştürülür. Yönlendirici; kalite seviyesine, çekimin süresine ve kadraj oranına uyan modeller arasından GMI'ın canlı fiyatına göre **en ucuzunu** seçer (Veo 3.1 Lite/Fast, Hailuo, Seedance, Wan, Kling). İstersen çekim bazında model sabitleyebilirsin.
6. **Film ve Müzik:** FFmpeg yazı kartlarını metin olarak çizer, müzik parçasını (`MusicLane`) ve dış sesi miksler, tüm videoları tek MP4'te birleştirir. Hazır storyboard JSON dosyaları doğrudan içe aktarılabilir; içe aktarılan her video çekimi ücretli animasyona ayarlanır.

**Ücret kuralları:** Kurallar kodda sabittir ve testlerle doğrulanır:

- Üretim, **onaylanmış bir fiyat teklifi olmadan başlamaz**. Teklif; her çekimin karesini ve videosunu, kullanılan modeli, faturalanan süreyi, tahmini tutarı, bir sonraki seçeneği ve en pahalı uygun modeli gösterir. Teklif 15 dakika geçerlidir; ayarlar, bütçe veya karakter bankası değişirse geçersizleşir.
- Teklif proje bütçesine sığmıyorsa hiçbir ücretli istek gönderilmez. Tutar başta bütçeden ayrılır; gönderilmeyen isteklerin ayrılan tutarı iade edilir. `KADRA_MAX_SPEND_USD` ile tüm projeler için toplam tavan, `KADRA_KILL_SWITCH=on` ile acil durdurma uygulanabilir.
- Gönderimi belirsiz kalan bir istek **asla otomatik olarak yeniden gönderilmez**; üretim durur, harcama defterinde işaretlenir ve teklif yenilenerek devam edilebilir.
- Tüm ücretli istekler projedeki harcama defterinde görünür.

**Yapılmış işi tekrar yapmama ve yalnızca hatalı bölgeyi onarma:**

- Her kare ve video, neyden yapıldığının parmak iziyle saklanır (`src/lib/production/reuse.ts`). Bir kare yalnızca promptu, stili, karakterleri ya da kadrajı değiştiğinde veya hakem onu işaretlediğinde yeniden üretilir. Değişmeyen kareler ve ödenmiş videolar yeniden ücretlendirilmez.
- Ödenmiş yapay zekâ videoları `.data/media/<proje>/clips/` altında, kare ve hareket parmak iziyle saklanır. Aynı kare ve hareket için yeni teklif bu çekimi ücretlendirmez, "yeniden kullanılır" diye gösterir. Daha yüksek bir kalite seviyesi veya sabitlenmiş başka bir model istenirse yeni teklif verilir.
- Hakemler (Nemotron VL / DeepSeek) her hatanın yerini kutu olarak bildirir. Karakter sayfasında hata yerelse, sayfa baştan üretilmez; yalnızca o bölge **GPT Image 2.5 Edit** maskeli düzenlemesiyle yeniden çizilir. Bunun maliyeti, zaten ayrılmış deneme bütçesinin içinde kalır.
- Storyboard ve karakter bankasındaki "Bölgeyi onar" düğmesiyle istediğin alanı çizip düzeltme isteyebilirsin. Önce canlı fiyat gösterilir (yaklaşık 0,02–0,03 $). Model yalnızca maskenin içini değiştirir; Kadra sonucu yumuşak kenarla orijinale geri yapıştırır, böylece alanın dışındaki her piksel birebir korunur. Onarım tek tıkla geri alınabilir.

**Tutarlılık, yönetmenlik ve ses:**

- **Mekân bankası:** Karakterlerle aynı bankada mekânlar da tutulur. Her mekân için film oranında, insansız bir mekân görseli üretilir ve hakem bunu mekân ölçütleriyle değerlendirir. Yapay zekâ planlayıcısı senaryodan mekânları da çıkarır ve her çekimi mekânına bağlar.
- **Kamera ve görünüm:** Kamera sözlüğü (yavaş yaklaşma, hızlı yaklaşma, el kamerası, kaydırma…) video modelinin kendi komutlarına çevrilir (`src/lib/cinema.ts`); FFmpeg kamera hareketi üretmez. Tür (Aksiyon, Epik, Dram, Komedi, Korku, Belgesel) planı ve promptları yönlendirir. Renk ve dönem görünümü (Kara film, 1960'lar, 1980'ler VHS…) montajda ücretsiz uygulanır; bunun için hiçbir kare yeniden üretilmez.
- **Dış ses:** Çekimlerin seslendirme metinleri ya ücretsiz Mac sesiyle (Yelda) ya da teklifle alınan MiniMax Türkçe sesleriyle (1000 karakter 0,06 $) okunur. Her ses çekiminin başına yerleştirilir ve konuşma sırasında müzik otomatik kısılır. Her metin bir kez seslendirilir; ücretli ses onaylanana kadar filmde taslak Mac sesi kullanılabilir.

## Yerelde çalıştırma

Node.js 22 veya üzeri ve FFmpeg gerekir.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` içine **zorunlu** olarak GMI Cloud anahtarını `GMI_API_KEY` olarak ekleyin; görsel ve video üretimi bu anahtar olmadan başlamaz. `NVIDIA_API_KEY` ve `DEEPSEEK_API_KEY` isteğe bağlıdır: planlama, karakter araştırması ve kalite kontrolü için kullanılır; yoksa planlama kurallarla yapılır, hakem atlanır. Üretim için bir de proje bütçesi ve onaylanmış fiyat teklifi gerekir.

Uygulama http://127.0.0.1:3000 adresinde açılır ve yalnızca bu bilgisayardan erişilebilir. Projeler `.data/projects.json`, üretilen kareler ve filmler `.data/media/`, günlük veri yedekleri `.data/backups/` altında saklanır (`KADRA_DATA_DIR` ile değiştirilebilir). Üretim çalışanı web sunucusunun içinde çalışır; ayrı çalıştırmak için `KADRA_WORKER=off` ayarlayıp `npm run worker` kullanın.

Harcama güvenliği: `KADRA_MAX_SPEND_USD` tüm projeler için toplam harcama tavanını, `KADRA_KILL_SWITCH=on` ise ücretli istekleri anında durdurmayı sağlar.

Kontroller: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build` veya hepsi için `npm run check`.

## Belgeler

- [Google Flow entegrasyonu](docs/flow-entegrasyonu.md): hazır 31 çekim / 9 karakter şablonu, aşamalı üretim yönetmeni, müzik ve seslendirme araçları.
- [Teknik mimari](docs/teknik-mimari.md): modüller, teknoloji seçimi, model yönlendirme, kalıcı iş akışı, veriler, API sözleşmeleri, maliyet ve erişim yönetimi.
- [Geliştirme planı](docs/gelistirme-plani.md): ilk sürüm kapsamı, aşamalar, bağımlılıklar, kabul ölçütleri ve tahmini emek.
- [Örnek üretim planı](docs/ornek-uretim-plani.json): sağlayıcı ve model seçilmeden önce kullanılan sahne/çekim yapısının açıklayıcı örneği.

## Temel karar

İlk sürüm için Next.js ve TypeScript ile bir web uygulaması; PostgreSQL üzerinde kalıcı proje/iş verileri; pg-boss ile iş teslimi; ayrı Node.js üretim çalışanı; ayrı FFmpeg montaj çalışanı; özel S3 uyumlu dosya deposu önerilir.

İlk hedef, az sayıda modelle kısa bir filmi gerçekten tamamlamaktır. Model sayısı, bu akış çalıştıktan ve modeller aynı görevlerde ölçüldükten sonra artırılır.

Maliyet, süre ve kalite tabloları planlama önerileridir. Canlı hesap erişimi, sağlayıcı sözleşmeleri ve örnek üretimler doğrulanmadan kesin maliyet veya kesintisiz otomatik üretim garantisi verilmez.
