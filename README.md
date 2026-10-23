# Senaryodan Videoya — Mimari ve Geliştirme Planı

Hazırlanma tarihi: 22 Ekim 2026.

Ürün hedefi: Kullanıcı senaryosunu ve üretim tercihlerini verir; uygulama sahneleri planlar, bağlı yapay zekâ servisleri arasından uygun modelleri seçer, görsel ve video parçalarını üretir, ses ve metinleri yerleştirir, indirilebilir bir final video hazırlar.

Bu klasör tasarım belgelerini ve uygulamanın yerel sürümünü (Kadra Studio) içerir. Uygulama senaryodan **ücretsiz** olarak indirilebilir bir MP4 film üretir:

1. **Modeller Arası Köprü ve Planlama:** `DEEPSEEK_API_KEY` tanımlıysa DeepSeek V4.1 Flash (`deepseek-flash` / `deepseek-v4-pro`) ve yerleşik Web Arama API'si (`/v1/tools/search`) senaryoyu planlar, karakterleri webde araştırıp çok dilli Wikimedia Commons sorguları üretir ve görsel kalite hakemliği yapar. Tanımlı değilse veya ulaşılamazsa NVIDIA Nemotron 3 Ultra, o da yoksa yerel kural tabanlı planlayıcı devreye girer.
2. **Karakter Bankası ve Referans Sayfaları:** Her karakter için Wikimedia Commons'tan lisanslı fotoğraf aranabilir veya bilgisayardan fotoğraf yüklenebilir. Fotoğrafsız karakterler ücretsiz **FLUX.2 Klein** ile, fotoğraflı karakterler onaylı bütçeyle **GMI Gemini Nano Banana 2.1** ile 1:1 karakter sayfasına dönüştürülür; yapay zekâ hakemi (DeepSeek VL / Nemotron VL) stil, özellik, poz ve temizlik puanlarını (`1–5`) değerlendirir.
3. **Kareler ve Referanslı Çekimler:** Ücretsiz akışta her video çekimi için NVIDIA FLUX.2 Klein başlangıç karesi üretir. İsteğe bağlı ücretli modda onaylı karakter sayfaları **Nano Banana 2.1**'e referans görsel olarak verilerek sahne kareleri üretilir.
4. **Kontrol:** DeepSeek V4.1 Flash VL (veya Nemotron 3.5 Super VL) kareyi çekim açıklaması ve onaylı karakter sayfalarıyla karşılaştırır ve her hatanın yerini işaretler. Uymazsa bir kez ücretsiz yeniden ürettirir ve iki denemeden daha az sorunlu olanı tutar.
5. **Film ve Müzik:** FFmpeg her kareye kamera hareketi verir, yazı kartlarını metin olarak çizer, zaman çizelgesine yüklenen müzik parçasını (`MusicLane`) ses seviyesi ve başlangıç saniyesiyle miksler ve tüm çekimleri tek MP4'te birleştirir. Hazır storyboard JSON dosyaları doğrudan içe aktarılabilir.

**İsteğe bağlı ücretli yapay zekâ hareketi (GMI Cloud):** Üretim sekmesinde seçilen çekimler gerçek videoya dönüştürülebilir. Kurallar kodda sabittir ve testlerle doğrulanır:

- Yönlendirici, seçilen kalite seviyesine (Ekonomik / Dengeli / En iyi) ve çekimin süresi ile kadraj oranına uyan modeller arasından GMI'ın canlı fiyatına göre **en ucuzunu** seçer. Fiyatlar çelişirse yüksek olan varsayılır.
- Önce fiyat teklifi gösterilir: çekim başına model, faturalanan süre, tahmini tutar, bir sonraki seçenek ve en pahalı uygun model. Teklif 15 dakika geçerlidir; ayarlar değişirse geçersizleşir.
- Teklif onaylanmadan ve proje bütçesine sığmadan hiçbir ücretli istek gönderilmez. Tutar başta bütçeden ayrılır; gönderilmeyen istekler iptalde iade edilir.
- Gönderimi belirsiz kalan bir istek asla otomatik olarak yeniden gönderilmez; o çekim ücretsiz kamera hareketiyle tamamlanır ve harcama defterinde işaretlenir.
- Tüm ücretli istekler projedeki harcama defterinde görünür.

**Yapılmış işi tekrar yapmama ve yalnızca hatalı bölgeyi onarma:**

- Her kare ve klip, neyden yapıldığının parmak iziyle saklanır (`src/lib/production/reuse.ts`). Bir kare yalnızca promptu, stili, karakterleri ya da kadrajı değiştiğinde veya hakem onu işaretlediğinde yeniden üretilir. Kamera hareketli klipler ve yazı kartları da değişmedikçe yeniden işlenmez. "Tüm kareleri yenile" bu kuralı bilerek atlar.
- Ödenmiş yapay zekâ videoları `.data/media/<proje>/clips/` altında, kare ve hareket parmak iziyle saklanır. Aynı kare ve hareket için yeni teklif bu çekimi ücretlendirmez, "yeniden kullanılır" diye gösterir. Ücretsiz film de bu videoları kullanır. Daha yüksek bir kalite seviyesi veya sabitlenmiş başka bir model istenirse yeni üretim yapılır.
- Hakemler (Nemotron VL / DeepSeek) her hatanın yerini kutu olarak bildirir. Ücretli karakter sayfasında hata yerelse, sayfa baştan üretilmez; yalnızca o bölge **GPT Image 2.5 Edit** maskeli düzenlemesiyle yeniden çizilir. Bunun maliyeti, zaten ayrılmış deneme bütçesinin içinde kalır.
- Storyboard ve karakter bankasındaki "Bölgeyi onar" düğmesiyle istediğin alanı çizip düzeltme isteyebilirsin. Önce canlı fiyat gösterilir (yaklaşık 0,02–0,03 $). Model yalnızca maskenin içini değiştirir; Kadra sonucu yumuşak kenarla orijinale geri yapıştırır, böylece alanın dışındaki her piksel birebir korunur. Onarım tek tıkla geri alınabilir.

**Tutarlılık, yönetmenlik ve ses:**

- **Mekân bankası:** Karakterlerle aynı bankada mekânlar da tutulur. Her mekân için film oranında, insansız bir mekân görseli üretilir ve hakem bunu mekân ölçütleriyle değerlendirir. Yapay zekâ planlayıcısı senaryodan mekânları da çıkarır ve her çekimi mekânına bağlar.
- **Referanslı kareler:** Onaylı karakter ve mekân görselleri kareye referans verilir. Aynı mekândaki bir önceki çekimin karesi de ışık ve eşyalar sürsün diye eklenir. Kare modeli, kalite seviyesine uyanlar arasından canlı fiyatla en ucuzu seçilerek belirlenir: Hunyuan Image 3.5, Seedream 5.0 Lite, Nano Banana 2 Lite veya Nano Banana 2.1 (`src/lib/routing/frame-router.ts`). İstersen modeli kendin de seçebilirsin.
- **Kamera ve görünüm:** Kamera hareketi kütüphanesine hızlı yaklaşma ve el kamerası eklendi; hareketler ücretsiz FFmpeg'e ve video modellerine (Hailuo'nun kendi kamera komutları dahil) aynı sözlükle iletilir (`src/lib/cinema.ts`). Tür (Aksiyon, Epik, Dram, Komedi, Korku, Belgesel) planı ve promptları yönlendirir. Renk ve dönem görünümü (Kara film, 1960'lar, 1980'ler VHS…) montajda ücretsiz uygulanır; bunun için hiçbir kare yeniden üretilmez.
- **Dış ses:** Çekimlerin seslendirme metinleri ya ücretsiz Mac sesiyle (Yelda) ya da teklifle alınan MiniMax Türkçe sesleriyle (1000 karakter 0,06 $) okunur. Her ses çekiminin başına yerleştirilir ve konuşma sırasında müzik otomatik kısılır. Her metin bir kez seslendirilir; ücretli ses onaylanana kadar filmde taslak Mac sesi kullanılır.

## Yerelde çalıştırma

Node.js 22 veya üzeri ve FFmpeg gerekir.

```bash
npm install
cp .env.example .env.local
npm run dev
```

`.env.local` içine [build.nvidia.com](https://build.nvidia.com/) üzerinden alınan ücretsiz anahtarı `NVIDIA_API_KEY` olarak ekleyin. Anahtar yoksa planlama kurallarla yapılır ve kareler yerine örnek referans görseller kullanılır; film yine üretilir.

Uygulama http://127.0.0.1:3000 adresinde açılır ve yalnızca bu bilgisayardan erişilebilir. Projeler `.data/projects.json`, üretilen kareler ve filmler `.data/media/` altında saklanır (`KADRA_DATA_DIR` ile değiştirilebilir). Üretim çalışanı web sunucusunun içinde çalışır; ayrı çalıştırmak için `KADRA_WORKER=off` ayarlayıp `npm run worker` kullanın.

Kontroller: `npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Belgeler

- [Google Flow entegrasyonu](docs/flow-entegrasyonu.md): hazır 31 çekim / 9 karakter şablonu, aşamalı üretim yönetmeni, müzik ve seslendirme araçları.
- [Teknik mimari](docs/teknik-mimari.md): modüller, teknoloji seçimi, model yönlendirme, kalıcı iş akışı, veriler, API sözleşmeleri, maliyet ve erişim yönetimi.
- [Geliştirme planı](docs/gelistirme-plani.md): ilk sürüm kapsamı, aşamalar, bağımlılıklar, kabul ölçütleri ve tahmini emek.
- [Örnek üretim planı](docs/ornek-uretim-plani.json): sağlayıcı ve model seçilmeden önce kullanılan sahne/çekim yapısının açıklayıcı örneği.

## Temel karar

İlk sürüm için Next.js ve TypeScript ile bir web uygulaması; PostgreSQL üzerinde kalıcı proje/iş verileri; pg-boss ile iş teslimi; ayrı Node.js üretim çalışanı; ayrı FFmpeg montaj çalışanı; özel S3 uyumlu dosya deposu önerilir.

İlk hedef, az sayıda modelle kısa bir filmi gerçekten tamamlamaktır. Model sayısı, bu akış çalıştıktan ve modeller aynı görevlerde ölçüldükten sonra artırılır.

Maliyet, süre ve kalite tabloları planlama önerileridir. Canlı hesap erişimi, sağlayıcı sözleşmeleri ve örnek üretimler doğrulanmadan kesin maliyet veya kesintisiz otomatik üretim garantisi verilmez.
