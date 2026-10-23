# Geliştirme Planı

Tarih: 22 Ekim 2026. Bu dosya teknik mimariyle birlikte uygulanacak iş sırasını tanımlar.

## 1. İlk sürümün teslim ettiği değer

Kullanıcı senaryo ve tercihlerini girer. Uygulama düzenlenebilir bir plan çıkarır, referans görseller ve kısa klipler üretir, maliyeti ve durumu gösterir, anlatıcı/metin/müzik ile final videoyu indirilebilir hale getirir. Tarayıcı yenilendiğinde ve çalışan yeniden başlatıldığında proje korunur.

İlk sürüm, bütün motorları desteklemek veya profesyonel video editörünü tamamen yeniden yapmak zorunda değildir. Bir ana medya adaptörü, bir alternatif video adaptörü ve bir metin planlayıcı adaptörüyle doğrulanan uçtan uca akış yeterlidir. Model ve endpoint sayısı başlangıçta sınırlı tutulur. Kullanıcı dosyası içe aktarma, sağlayıcıların üretemediği veya elde hazır bulunan klipleri montaja dahil eder.

Başlangıç adayları fal ve Runway'dir; ayrıntılar ve resmî kaynaklar [teknik mimarinin sağlayıcı bölümünde](teknik-mimari.md#18-ilk-sağlayıcı-bağlantıları-ve-doğrulanmış-api-farkları) bulunur. Metin planlayıcı ve anlatıcı için gerekli dil/çıktı desteğini sunan birer adaptör teknik denemede seçilir. Bu seçimler bağlı hesap erişimine göre kesinleşir.

İlk teslim kapsamı:

- Çalışma alanı ve korunan oturum; sağlayıcı bağlantıları.
- Türkçe senaryo girişi, sahne/çekim planı ve düzenlenebilir storyboard.
- Sürümlü karakter/stil referansları; çekime bağlı zorunlu/yasak unsurlar.
- Göreve göre model seçimi; kalite/dengeli/ekonomik tercihi ve karar gerekçesi.
- Görsel ve kısa video üretimi; kalıcı işler, iptal, sınırlı tekrar, hata kurtarma.
- Tahmini gider, rezervler ve kesinleşen giderlerin ayrılması.
- Temel zaman çizelgesi; klip trim, sıralama, yazı kartı, basit geçiş, ses ve altyazı.
- S3 uyumlu özel dosya arşivi; MP4 ve altyazı dışa aktarma.
- Üretim kökeni ve model/prompt geçmişi; önemli hatalar için operatör görünümü.

Sonraya bırakılacaklar: çok kiracılı ticari abonelik/kredi satışı, sınırsız model kataloğu, yerel GPU kurulumları, model eğitimi, gelişmiş compositing, otomatik dudak senkronu, ses klonlama, tam profesyonel kurgu araçları ve mobil yerel uygulama.

## 2. Aşamalar ve kabul ölçütleri

Süreler tek deneyimli geliştiricinin aktif geliştirme emeği için ilk tahminlerdir. Sağlayıcı hesap/onay beklemeleri, ücretli değerlendirme üretimleri, tasarım revizyonları ve harici servis sorunları dahil değildir. Toplam yaklaşık 32–46 iş günü, yani 6–10 haftalık bir çalışma aralığı öngörülür; sabit teslim taahhüdü değildir.

| Aşama | Tahmini emek | Somut çıktı | Geçiş koşulu |
| --- | --- | --- | --- |
| 0 — Sözleşmeler ve teknik deneme | 2–3 gün | Plan/iş/varlık sözleşmeleri; sağlayıcı erişim kontrolü | Küçük görsel ve video işi gönderilir, izlenir, depoya alınır; maliyet/erişim belirsizliği kaydedilir |
| 1 — Ürün temeli | 3–4 gün | Web iskeleti, oturum, PostgreSQL, özel depo, yerel çalışanlar | Yetkisiz erişim engellenir; proje ve referans dosyası kaybolmadan saklanır |
| 2 — Senaryo ve storyboard | 4–6 gün | Planlayıcı, karakter/mekân listesi, düzenlenebilir sahneler | Türkçe örnekler geçerli plana dönüşür; eksik/çelişkili bilgi görünür; kaynak metin korunur |
| 3 — Dayanıklı üretim | 6–8 gün | pg-boss, sağlayıcı adaptörü, gönderim/sorgu/webhook/içe aktarma | Süreç kapanması, tekrar bildirim ve gönderim belirsizliği testleri geçer |
| 4 — Model seçimi ve süreklilik | 4–6 gün | İkinci video adaptörü, model profilleri, referans paketi, yönlendirme ve kalite seçimi | İkinci adaptör aynı çekim sözleşmesiyle üretim/sorgu/arşiv/maliyet akışını tamamlar; uyumsuz adaylar elenir; bağımlı çekimler doğru geçersizleşir |
| 5 — Montaj ve ses | 5–7 gün | Timeline, anlatıcı adaptörü, yüklenen müzik, FFmpeg, altyazı | Görsel/video/ses/metin içeren kısa proje geçerli MP4 olarak iner |
| 6 — Kullanıcı kontrolü ve kurtarma | 4–6 gün | Üretim görünümü, gider ekranı, inceleme ve seçili çekimi yenileme | İptal/yeniden başlatma bütçe ve mevcut çıktıları korur; kullanıcı hatadan çıkabilir |
| 7 — Uçtan uca doğrulama ve dağıtım | 4–6 gün | Doğrulanmış sürüm, geri yükleme/dağıtım adımları, kullanım rehberi | Gerçek küçük film, zorlanan kesinti ve çıktı indirme akışı tamamlanır |

Kritik sıra: sözleşmeler → veri/erişim → plan → tek sağlayıcıda dayanıklı üretim → seçim/süreklilik → montaj → gerçek uçtan uca test. Ekran tasarımı, içerik örnekleri ve değerlendirme seti hazırlığı bu sıranın uygun bölümleriyle paralel yürütülebilir.

## 3. Teknik denemede cevaplanacak sorular

1. Seçilen hesabın API üzerinden görsel ve video modellerine erişimi var mı? Web sitesindeki model, API'de de mevcut mu?
2. Asenkron iş kimliği nasıl alınır; durum sorgusu ve çıktı alma sözleşmeleri nedir?
3. Webhook varsa hangi imza/doğrulama yöntemi gerekir; bildirim gelmezse sorgulamayla kurtarılabilir mi?
4. Gönderim zaman aşımında aynı işlemi güvenle bulma veya tekrar etme desteği var mı? Yoksa belirsizlik nasıl gösterilecek?
5. Dosya bağlantısının ömrü, kaynak/veri saklama davranışı ve kullanım koşulları nedir?
6. Model gerekli referansı, süreyi ve oranı destekliyor mu? Fiyat birimi ve gerçek hesaptaki kota nedir?
7. Anlatıcı sesi gereken dilde kullanılabilir mi; süre/ücret neye göre hesaplanıyor?

Bu deneme sonrasında adaptör sözleşmesi kesinleşir. Belgede model adını görmek, hesap erişimi veya ölçülmüş kalite kanıtı sayılmaz. Sağlayıcı anahtarları belgeye, kaynak koda veya tarayıcı depolamasına yazılmaz.

## 4. Önerilen kaynak kod düzeni

```text
apps/
  web/                   # Projeler, storyboard, timeline ve kısa API işlemleri
  worker/                # Plan, sağlayıcı gönderimi/sorgusu, içe aktarma, kalite
  render-worker/         # FFmpeg ve çıktı doğrulama
packages/
  contracts/             # Şemalar, API/olay tipleri ve sürümler
  domain/                # Üretim kuralları, revizyon, durum geçişleri, bütçe
  db/                    # Drizzle şeması, migration ve erişim sorguları
  providers/             # Metin, medya ve ses adaptörleri
  routing/               # Filtreler, puanlama, karar kaydı
  media/                 # Varlık doğrulama, manifestolar, montaj şablonları
  observability/         # Kimlikli olaylar, metrikler, gizli veri maskeleme
infra/
  local/                 # Yerel konteyner ve ortam örnekleri
  deploy/                # Çalışan/depo/veri tabanı dağıtım ayarları
docs/
```

Bu yapı uygulama kodu yazıldığında oluşturulacak öneridir; şu an kurulmuş bir uygulama olduğu anlamına gelmez. Paket sayısı ihtiyaçla birlikte azaltılabilir; paylaşılan sözleşmeler ile dış servis çağrılarını ayırmak temel karardır.

## 5. Adaptör sözleşmesinin kapsamı

Her adaptör şu bilgileri açıkça bildirir: desteklenen işlemler ve şema; doğrulanmış model sürümleri; giriş/çıktı sınırları; gönderme; durum sorgulama; sonuç alma; varsa iptal ve webhook doğrulama; idempotency ve uzlaştırma desteği; hata sınıflaması; fiyat tahmin yöntemi.

Desteklenmeyen özellik sahte başarıyla geçilmez. Örneğin iptal API'si yoksa kullanıcıya uzaktaki işi kesin durdurmuş gibi gösterilmez; yalnızca yeni uygulama adımları durdurulur. Nihai ücret API'den alınamıyorsa 'kesinleşmiş ücret' uydurulmaz.

Metin planlayıcı ve ses sağlayıcısı da adaptör olabilir, ancak video işleriyle aynı yaşam döngüsüne zorlanmaz. Senkron ve asenkron servisler ortak domain sonuçlarına dönüştürülür.

## 6. Değerlendirme seti

İlk değerlendirme paketi önerisi: 8–12 küçük görev; anime karakter, sinematik çevre, iki karakter, referans tutarlılığı, nesne sürekliliği, basit hareket, dönüşüm ve yazı içermeyen kompozisyon. Bu sayı başlangıç önerisidir. Her model/görev çifti birden fazla çıktı ile incelenir; değerlendirme üretimleri de bütçelidir.

Karşılaştırma girdisi, referanslar, oran ve mümkün olduğunca maliyet/süre koşulları sabitlenir. Kör kullanıcı puanı, otomatik teknik denetimler ve gerekiyorsa görsel değerlendirme modeli birlikte kullanılır. Gözlenen örnek sayısı ve belirsizlik raporlanır; az örnekten evrensel model sıralaması üretilmez.

Model yeni sürüme geçtiğinde eski puan yeni sürüme doğrudan taşınmaz. Uygulamanın gerçek projelerindeki başarı verileri göreve ve model sürümüne bağlı olarak değerlendirme kayıtlarını besler.

## 7. Zorunlu doğrulama senaryoları

### Veri, sahiplik ve revizyon

- Farklı çalışma alanındaki proje, bağlantı ve dosyaya kimlik değiştirerek erişilemez.
- Senaryo/karakter değişikliği yalnızca bağımlı çekimleri ve montajları etkiler.
- Eski çalışmanın geç gelen sonucu yeni revizyonun seçili çıktısını değiştiremez.
- Aynı iş başlatma anahtarı aynı payload ile tekrarlandığında yeni ücretli girişim açılmaz; farklı payload çakışma verir.

### Ücretli işlemler ve kurtarma

- İşçi gönderimden önce, sağlayıcı kabulünden sonra ve cevap veritabanına yazılmadan önce durdurulur. Kurtarma ikinci ücretli isteği körlemesine açmaz.
- Bilinmeyen gönderim durumunda rezerv korunur; otomatik fallback bu sınırı aşamaz.
- Aynı webhook 20 kez, ters sıralı ilerleme olaylarıyla veya create cevabından önce verildiğinde tek varlık ve tek gider uzlaştırması oluşur.
- Süresi dolan işçi çalışmaya devam etse bile fencing token yeni girişimin kaydını korur.
- Eşzamanlı gönderimler uygulamanın kullanılabilir bütçesinden fazla rezerv oluşturamaz.
- İptal; gönderim, sorgulama, indirme ve render sırasında denenir. Yeni alt işler açılmaz; geç gelen ücret/sonuç kaybolmaz.
- Süresi yaklaşan çıktı önce arşivlenir. İndirme hatası yeni üretim başlatmadan mevcut dosya üzerinden çözülür.

### Montaj ve kullanıcı akışı

- Farklı fps/boyut/ses özellikli girdiler ortak çıkışa alınır; geçişler ve anlatıcı gerçek süreleriyle uyuşur.
- Bozuk dosya, eksik font, kayıp ses ve yarım yükleme finali 'hazır' yapmaz.
- Aynı montaj manifestosu mevcut kaynaklarla tekrar render edilebilir; kaynak görsel/video tekrar üretilmez.
- Tarayıcı kapatılır/açılır; üretim durumu, seçili varyantlar ve giderler yeniden görünür.
- Gerçek bir küçük proje senaryodan plan, referans, görsel, video, ses, montaj ve indirmeye kadar tamamlanır; bir kesinti sonrası da teslim edilir.

Domain testleri ve sağlayıcı taklitleri bu hata durumlarını doğrular. Adaptör sözleşme testleri gerçek servislerin küçük, bütçeli çağrılarıyla tamamlanır. Yalnızca taklit sağlayıcıyla geçen testler gerçek entegrasyon kanıtı sayılmaz. Arayüzün masaüstü ve dar mobil görünümü tarayıcıda incelenir.

## 8. Dağıtım öncesi kontrol ve işletim

Geliştirme ve üretim verileri/anahtarları ayrılır. Migration, veritabanı yedeği ve geri yükleme denenir. Çalışan kapatma sırasında iş alma durur; devam eden işler kayıp veya çift gönderim oluşturmadan bırakılır. Depo erişimi, ücret eşikleri, takılan iş görünümü ve alarm kanalları yapılandırılır.

İlk canlı sürüm düşük eşzamanlılıkla açılır. Örnek proje tamamlanır; maliyet kayıtları sağlayıcı paneliyle karşılaştırılır. Model ve fiyat değişiklikleri kontrollü yayımlanır. Mevcut çalışan işlerin bağlı olduğu sözleşme sürümleri korunur.

## 9. Temel riskler ve tasarım karşılıkları

| Risk | Karşılık |
| --- | --- |
| Karakter veya stilin bozulması | Referans paketi, daha küçük çekimler, kalite kontrolü, sınırlı varyant |
| Sağlayıcının sahneyi reddetmesi | Açık hata sınıfı, yetkili anlatım revizyonu veya kullanıcı incelemesi |
| Kontrolsüz gider | Üretim öncesi fiyat, atomik rezerv, deneme/eşzamanlılık sınırı |
| Aynı ücretli işin iki kez açılması | Kararlı işlem kimliği, sağlayıcı desteği varsa idempotency, belirsiz durumda uzlaştırma |
| Dosyanın süre dolunca kaybolması | Tamamlanınca özel depoya öncelikli içe aktarma |
| Uzun işte süreç kaybı | Kalıcı durum ve kısa kuyruk işleri; kanıtlı yeniden başlatma davranışı |
| Model şemasının değişmesi | Sürümlü katalog, adaptör testleri, kontrollü etkinleştirme |
| Tam otomasyonun anlatıyı değiştirmesi | Orijinali koruma, değişiklik kaydı, maddi revizyon sınırı |

## 10. Kodlamaya başlanınca ilk somut teslim

İlk teslim; boş proje kabuğundan daha fazlası olmalıdır: proje oluşturma, senaryo kaydetme, sahne planı çıkarma, bir sağlayıcıya tek görsel/video işi gönderme, durumunu izleme ve sonucunu özel depoda gösterme. Planlayıcı ve ilk üretim çağrıları için gerçek erişimler sağlandığında ücretler önceden görünür olur.

Bu temel akış doğrulandıktan sonra karakter sürekliliği, model karşılaştırması ve tam montaj eklenir. Geliştirme sırasında yeni bir model listesi veya gösterişli ekran sayısı, çalışan uçtan uca teslim akışının yerini tutmaz.
