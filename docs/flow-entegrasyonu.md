# Google Flow → Kadra entegrasyonu

22 Ekim 2026. Kaynak snapshot: `imports/google-flow/balonlar-ve-daglar/`.

## Kullanım

1. **Yeni proje → Balonlar ve Dağlar · Flow şablonu**: 31 çekim, 9 karakter ve 177 saniyelik plan oluşturur. Üretim çağrısı yapmaz. Önceki projeleri değiştirmez.
2. Üretim yönetmeni **Tam akışı başlat**: fotoğrafsız, onaysız karakterleri NVIDIA ile hazırlar; hakemin kabul ettiği sayfaları bu akış için otomatik onaylar; tüm kareleri hazırladıktan sonra klipleri ve montajı işler. Hakem yoksa veya sayfa kabul edilmezse film aşamasına geçmez; karakter bankasından inceleme/onay sonrası yeniden başlatılır.
3. Fotoğraf referanslı karakterler için Karakter bankasının mevcut fiyat onayı gerekir. Onaylı karakter görsellerini fiziksel referans olarak sahne modeline göndermek ve gerçek AI videosu üretmek için GMI panelindeki referanslı kare/video teklifini onaylamak gerekir. Ücretsiz FLUX akışı karakterleri metinsel tanımlarla yönlendirir; fiziksel referans görsel desteğiyle karıştırılmaz.
4. **Yalnız kareleri üret** montaj açmadan bir kare çalışması kaydeder. **Mevcut karelerle film** var olan üretilmiş kareleri tekrar çağırmadan klip ve MP4 üretir; henüz kare olmayan çekimlerin görselleri hazırlanır. Ücretsiz klipler FFmpeg kamera hareketidir.
5. Storyboard'da sahne grubu filtresi, arama, karakter referans durumları ve CSV indirme bulunur. JSON indirme korunur.
6. **Müzik yönetmeni** çekimlere ait ses notlarını, beste promptunu, indirilebilir ses planını ve mevcut müzik miksajını bir araya getirir.
7. **Seslendirme** mikrofonla yerel prova, dinleme ve indirme sunar. Prova kayıtları sekme belleğindedir; kendiliğinden proje deposuna kaydedilmez veya filme mikslenmez. Ayrılmadan önce indirilmelidir.

## Uyarlama kararları

- `flow-sdk` Kadra'ya eklenmedi. Flow'a ait generation/download/microphone çağrıları yerine mevcut sunucu adaptörleri, tarayıcı indirme ve MediaRecorder kullanılır.
- Flow'un kaynak kopyası korunur. Veri ve davranışlar Kadra'nın tiplerine uyarlanır; Flow medya kimlikleri yerel dosya kimliği sayılmaz.
- Kaynaktaki arşiv fotoğraf URL'leri doğrulanmış kimlik/fotoğraf olarak otomatik atanmaz. Kadra'nın kaynak ve lisans kaydı tutan fotoğraf arama/yükleme akışı kullanılır.
- Kare ve tam film hedefi kalıcı run kaydındadır; eski kayıtlarda hedef varsayılan olarak film olur. Kaynak kodda kamera/başlık/ses notları korunur.
- Belirsiz karakter gönderiminde `actual=null` bırakılarak gider uzlaştırılana kadar rezerv korunur.

## Doğrulama

Şablon verileri ve karakter bağlantıları; CSV formül kaçışı; yalnız kare üretimi; karakter kontrolünde durma; olumlu hakem sonrası aşama geçişi için domain testleri vardır. Ek uçtan uca test, taklit görsel/hakem sağlayıcısıyla gerçek FFmpeg kullanarak karakter → kare → indirilebilir MP4 hattını doğrular. Canlı GMI/NVIDIA çağrıları bu testlerin kapsamında değildir.
