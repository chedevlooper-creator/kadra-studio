# Google Flow → Kadra entegrasyonu

22 Ekim 2026. Kaynak snapshot: `imports/google-flow/balonlar-ve-daglar/`.

## Kullanım

1. **Yeni proje → Balonlar ve Dağlar · Flow şablonu**: 31 çekim, 9 karakter ve 177 saniyelik plan oluşturur. Üretim çağrısı yapmaz. Önceki projeleri değiştirmez. İçe aktarılan her video çekimi ücretli animasyona (`motion: ai`) ayarlanır.
2. **Önce karakterler:** Karakter bankasındaki tüm sayfalar GMI Nano Banana 2.1 ile üretilir (fotoğraf varsa referans alınır). Hakem her denemeyi puanlar; sayfayı sen onaylarsın. Onaylı sayfalar kare üretiminde fiziksel referans olur.
3. **Sonra tek teklif:** Üretim sekmesindeki GMI panelinden kalite seviyesi, kare modeli ve çekim bazında video modeli seçilir; canlı fiyatla teklif alınır. Teklif onaylanınca her çekimin karesi (onaylı sayfalar ve aynı mekânın önceki karesi referans verilerek) ve videosu üretilir. Ücretsiz görsel veya FFmpeg kamera hareketi yoktur.
4. **Tutarlılık ve yeniden kullanım:** Aynı kare ve hareketle daha önce üretilmiş video yeniden ücretlendirilmez. Hakemin yerini gösterdiği hata, kareyi baştan üretmek yerine yalnızca o bölge maskeli düzenlemeyle onarılır. Değişmeyen kareler korunur.
5. Storyboard'da sahne grubu filtresi, arama, karakter referans durumları ve CSV indirme bulunur. JSON indirme korunur.
6. **Müzik yönetmeni** çekimlere ait ses notlarını, beste promptunu, indirilebilir ses planını ve mevcut müzik miksajını bir araya getirir.
7. **Seslendirme** mikrofonla yerel prova, dinleme ve indirme sunar. Prova kayıtları sekme belleğindedir; kendiliğinden proje deposuna kaydedilmez veya filme mikslenmez. Ayrılmadan önce indirilmelidir.

## Uyarlama kararları

- `flow-sdk` Kadra'ya eklenmedi. Flow'a ait generation/download/microphone çağrıları yerine mevcut sunucu adaptörleri, tarayıcı indirme ve MediaRecorder kullanılır.
- Flow'un kaynak kopyası korunur. Veri ve davranışlar Kadra'nın tiplerine uyarlanır; Flow medya kimlikleri yerel dosya kimliği sayılmaz.
- Kaynaktaki arşiv fotoğraf URL'leri doğrulanmış kimlik/fotoğraf olarak otomatik atanmaz. Kadra'nın kaynak ve lisans kaydı tutan fotoğraf arama/yükleme akışı kullanılır.
- Eski kayıtlardaki kare/film hedefi korunur; yeni ücretli akışta tek teklif kareleri ve videoları birlikte üretir. Kaynak kodda kamera/başlık/ses notları korunur.
- Belirsiz karakter gönderiminde `actual=null` bırakılarak gider uzlaştırılana kadar rezerv korunur.
- Ücretsiz görsel üretimi ve FFmpeg kamera hareketi yeni akıştan kaldırıldı; testler eski yolu yalnızca geriye dönük uyumluluk için kapsar.

## Doğrulama

Şablon verileri ve karakter bağlantıları; CSV formül kaçışı; yalnız kare üretimi; karakter kontrolünde durma; olumlu hakem sonrası aşama geçişi için domain testleri vardır. Ek uçtan uca test, taklit görsel/hakem sağlayıcısıyla gerçek FFmpeg kullanarak karakter → kare → indirilebilir MP4 hattını doğrular. Canlı GMI/NVIDIA çağrıları bu testlerin kapsamında değildir.
