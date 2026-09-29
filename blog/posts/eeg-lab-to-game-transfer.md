---
title: "Laboratuvarda Eğitilen Bir EEG Modeli Gerçek Bir Oyunda İşe Yarar mı? Çift-Etiketleme ile Sağlamlık Testi"
date: 2026-09-29
excerpt: Laboratuvar verisiyle eğitilen bir EEG bilişsel-yük sınıflandırıcısını, gerçek bir MOBA oyunu kaydına sıfır-atışlı uyguladım — ve iki tamamen bağımsız etiketleme stratejisiyle aynı başarısızlığı, aynı mekanistik açıklamayla doğruladım.
tags: [Yapay Zeka, Sinirbilim, Araştırma, Python]
---

<div class="callout callout-tip">
<div class="callout-title">📋 Özet</div>
STEW veri setinde (48 katılımcı, laboratuvar SIMKAP görevi) eğitilen bir EEG bilişsel-yük
sınıflandırıcısını, gerçek bir MOBA (multiplayer online battle arena) oyunu sırasında kaydedilmiş
halka açık bir EEG veri setine (OpenNeuro ds005520, 23 katılımcı) <strong>hiç ince ayar yapmadan</strong>
uyguladım. Sonuç: "yüksek bilişsel yük" sınıfında sadece %28–33 recall (şans seviyesi %50).
Bunun bir etiketleme sorunundan kaynaklanıp kaynaklanmadığını test etmek için, aynı veriyi
<strong>iki tamamen bağımsız etiketleme stratejisiyle</strong> (kaba bir zaman penceresi ve
oyun içi kill/death olaylarına kilitlenen nesnel bir pencere) ayrı ayrı işledim — ikisi de
istatistiksel olarak ayırt edilemez sonuçlar verdi. Başarısızlık bireyler arasında son derece
değişkendi (%0'dan %100'e), ve bu değişkenlik her iki etiketleme yönteminde de katılımcının
özellik-uzayındaki konumuyla güçlü şekilde açıklanabiliyordu (Spearman rho = 0.76 ve 0.91),
ama hiçbir demografik/psikometrik değişkenle açıklanamıyordu.
</div>

Bu yazı da, WAY-EEG-GAL yazısı gibi bir araştırma sürecinin dürüst kaydı — ama bu sefer sonuç
tamamen negatif değil, daha çok "beklenenden çok daha kırılgan ve düzeltilmesi ucuz" bir hikaye.

## Motivasyon

EEG tabanlı bilişsel yük tahmini; cerrahi robotik arayüzlerden, otonom araç kokpitlerine, oyunlarda
dinamik zorluk ayarlamasına (dynamic difficulty adjustment, DDA) kadar geniş bir yelpazede
öneriliyor. Ama yayınlanan modellerin neredeyse tamamı, N-Back, MATB veya SIMKAP gibi kontrollü
laboratuvar görevleriyle eğitiliyor ve doğrulanıyor. Sorulması gereken basit ama nadiren
sorulan bir soru var: <strong>bu modeller, gerçek ve duygusal olarak yüklü bir görevde — mesela
gerçek bir oyun oturumunda — hâlâ işe yarıyor mu?</strong>

## Veri setleri

<table>
<thead><tr><th>Özellik</th><th>STEW (kaynak)</th><th>OpenNeuro ds005520 (hedef)</th></tr></thead>
<tbody>
<tr><td>Katılımcı sayısı</td><td>48</td><td>23</td></tr>
<tr><td>Donanım</td><td>Emotiv EPOC, 14 kanal, 128 Hz</td><td>BrainVision, 64 kanal, araştırma sınıfı</td></tr>
<tr><td>Görev</td><td>Dinlenme vs. SIMKAP çoklu görev</td><td>Dinlenme vs. gerçek MOBA oyunu</td></tr>
<tr><td>Olay işaretleri</td><td>—</td><td>Kill (kod 13, 836 olay), Death (kod 14, 523 olay), milisaniye hassasiyetinde</td></tr>
<tr><td>Ek veri</td><td>—</td><td>Yaş, cinsiyet, haftalık oyun saati, rütbe, IGD-20, BIS-11, DERS</td></tr>
</tbody>
</table>

ds005520'nin gerçek oyun kayıtlarında kill/death olaylarının milisaniye hassasiyetinde işaretlenmiş
olması, bu projenin metodolojik omurgasını oluşturdu.

## Özellik temsili

İki veri seti farklı kanal sayısına sahip olduğu için (14 vs 64), kanal-sayısından bağımsız bir
temsil kullandım: her 4 saniyelik pencere için, dört klasik EEG bandının (delta, theta, alpha, beta)
göreceli gücü, tüm kanallar üzerinden ortalanarak hesaplandı.

## Çift-etiketleme stratejisi: asıl metodolojik katkı

Tek bir etiketleme yöntemiyle yapılan bir "ekolojik geçerlilik" çalışmasına yöneltilebilecek doğal
bir itiraz var: kaba bir etiket (örneğin "oyunun ilk 10 dakikası = yüksek yük") kendi başına
gürültü enjekte edip sahte bir başarısızlık görüntüsü yaratmış olabilir. Bunu doğrudan veriyle
test etmek için, aynı kayıtları iki bağımsız şekilde etiketledim:

<div class="chart-card">
<h4>Olay-kilitli pencere tanımı</h4>
<img src="assets/fig5_windowing_schematic.png" alt="Zaman çizelgesi: yüksek-yük penceresi, kill/death olayından T-4 saniye önce başlayıp T-0'da bitiyor.">
<p class="chart-caption">Yüksek-yük penceresi, her kill/death olayından hemen önceki 4 saniyeye
kilitleniyor — olayın kendisine değil, öncesindeki beklenti/tırmanma dönemine.</p>
</div>

1. **Sabit pencere**: Oyunun ilk 10 dakikası düz bir şekilde "yüksek yük" olarak etiketlendi.
2. **Olay-kilitli pencere**: Her kill/death olayından hemen önceki 4 saniye (T-4s .. T-0s)
   "yüksek yük" olarak etiketlendi — olayın kendisi değil, öncesindeki bilişsel tırmanma dönemi.

İkisinde de dinlenme kayıtları "düşük yük" sınıfını oluşturdu.

## Sıfır-atışlı transfer: iki yöntem, aynı başarısızlık

Kaynak sınıflandırıcı STEW üzerinde %68.4 doğruluk gösterdi (5-kat çapraz doğrulama). Aynı model,
hiçbir ince ayar yapılmadan hedef veri setine uygulandığında:

<table>
<thead><tr><th>Koşul</th><th>Sabit pencere</th><th>Olay-kilitli</th></tr></thead>
<tbody>
<tr><td>Düşük-yük recall</td><td>%89.6</td><td>%90.3</td></tr>
<tr><td><strong>Yüksek-yük recall</strong></td><td><strong>%33.1</strong></td><td><strong>%28.3</strong></td></tr>
<tr><td>Kalibrasyon sonrası yüksek-yük recall</td><td>%66.4</td><td>%62.4</td></tr>
</tbody>
</table>

İki yöntem, tamamen farklı pencere seçim mantığına rağmen (biri kaba bir 10-dakikalık blok,
diğeri 1359 ayrı, nesnel zaman damgalı kill/death olayına kilitli) **istatistiksel olarak ayırt
edilemez** sonuçlar verdi. Bu, gözlemlenen transfer başarısızlığının altta yatan sinyalin sağlam
bir özelliği olduğunu, "yüksek yük" sınıfının nasıl tanımlandığına bağlı bir artefakt olmadığını
gösteriyor.

## Bireysel farklılık: kim, neden başarısız?

Ortalama %28–33'lük recall, uçtan uca bir heterojenliği gizliyor: bazı katılımcılarda model
yüksek-yükü **hiç** yakalayamadı (%0), bazılarında ise neredeyse kusursuzdu (%100). Bu farkı
açıklayan şey ne demografi ne de kişilik oldu — açıklayan şey, katılımcının kendi verisinin
**özellik uzayındaki konumu**ydu:

<div class="chart-card">
<h4>Bireysel transfer başarısı vs. özellik-uzayı konumu</h4>
<img src="assets/fig2_heterogeneity_EVENT.png" alt="Saçılım grafiği: özellik-uzayı konumu ile sıfır-atışlı yüksek-yük recall arasında güçlü pozitif ilişki, Spearman rho=0.91.">
<p class="chart-caption">Gerçek oyun pencereleri, STEW'in "yüksek yük" merkezine ne kadar
yakınsa, model o katılımcıyı o kadar iyi tespit ediyor — katılımcının gerçekte ne kadar
zorlandığından bağımsız olarak.</p>
</div>

Sabit pencerede rho=0.76, olay-kilitli pencerede **rho=0.91** (ikisi de p<0.0001) — yani daha
hassas, nesnel etiketleme, bu mekanistik açıklamayı zayıflatmak yerine **güçlendirdi**.

Test edilen yedi demografik/psikometrik değişkenin (yaş, cinsiyet, haftalık oyun saati, rütbe,
IGD-20, BIS-11, DERS) hiçbiri bu değişkenliği anlamlı şekilde açıklamadı (tümü p>0.18) —
yani davranışsal ya da kişilik temelli bir açıklama yok.

## Artefakt kontrolü: gürültü mü, gerçek sinyal mi?

Aktif oyun oynarken hızlı fare tıklamaları ve göz hareketleri, EEG sinyaline kas/göz kaynaklı
gürültü (EMG/EOG) karıştırabilir. Bunu kontrol etmek için, kas gürültüsünün yoğunlaştığı gama
bandını (30–45 Hz) ayrıca ölçtüm: oyun sırasında dinlenmeye kıyasla sadece **1.64 kat** bir artış
bulundu — kaba kas kirlenmesiyle ilişkilendirilen tipik 3-4 kat artışın oldukça altında. Yani
sonuçlar fiziksel gürültüden değil, gerçek bir sinyalden kaynaklanıyor gibi görünüyor.

## Kalibrasyonun gücü

İyi haber şu: bu boşluk, ucuz bir şekilde kapatılabiliyor.

<div class="chart-card">
<h4>Kalibrasyon bütçesi vs. yüksek-yük recall</h4>
<img src="assets/fig1_calibration_curve_EVENT.png" alt="Kalibrasyon penceresi sayısı arttıkça yüksek-yük recall'ün %36'dan %68'e çıktığını gösteren eğri.">
<p class="chart-caption">Sadece 80 saniyelik (20 pencere) kişiye özel kalibrasyon verisi,
recall'ü %28'den %58'e çıkarıyor. 80 pencere (~5.3 dakika) ile %68 zirveye ulaşılıyor.</p>
</div>

<div class="chart-card">
<h4>İki etiketleme stratejisinin doğrudan karşılaştırması</h4>
<img src="assets/fig4_robustness.png" alt="Yan yana iki bar grafik: (a) iki etiketleme stratejisinin zero-shot recall'ü neredeyse aynı, (b) olay-kilitli tasarımın özellik-uzayı açıklamasının daha güçlü olduğunu gösteriyor.">
<p class="chart-caption">Sol: iki yöntemin zero-shot başarısızlığı istatistiksel olarak ayırt
edilemez. Sağ: olay-kilitli tasarım, mekanistik açıklamayı (rho) daha da netleştiriyor.</p>
</div>

<div class="chart-card">
<h4>Kalibrasyon öncesi/sonrası sınıf bazlı recall</h4>
<img src="assets/fig3_classwise_EVENT.png" alt="Kalibrasyon öncesi ve sonrası düşük-yük ve yüksek-yük recall'ünü karşılaştıran bar grafik.">
<p class="chart-caption">Düşük-yük recall zaten yüksekti ve kalibrasyonla hafif düştü; yüksek-yük
recall ise kalibrasyonla belirgin şekilde arttı.</p>
</div>

## Metodolojik dersler

- **Tek bir etiketleme stratejisiyle rapor edilen bir "ekolojik geçerlilik" bulgusu, her zaman
  "belki de etiketleme kötüydü" itirazına açıktır.** İki bağımsız stratejiyi aynı anda test etmek,
  bu itirazı varsayımla değil veriyle kapatıyor.
- **Nesnel, olay-kilitli etiketleme, kaba bir zaman penceresinden daha "temiz" bir mekanistik
  sinyal üretebiliyor** (rho 0.76 → 0.91) — bu da olay-kilitli tasarımın sadece daha savunulabilir
  değil, muhtemelen gerçekten daha doğru olduğunu düşündürüyor.
- **Demografik/psikometrik değişkenlerin hiçbirinin anlamlı çıkmaması**, kendi başına önemli bir
  negatif kontrol: bireysel farkın kaynağı davranışsal değil, elektrofizyolojik görünüyor.
- **Kısa bir kalibrasyon oturumu (dakikalar mertebesinde), tam bir model eğitimi kadar değerli
  olabilir** — pratik uygulamalar için umut verici bir sonuç.

<div class="callout callout-tip">
<div class="callout-title">🎯 Sonuç</div>
Laboratuvarda eğitilen EEG bilişsel-yük modelleri, gerçek oyun ortamına zayıf ve son derece
düzensiz bir şekilde aktarılıyor. Ama bu başarısızlık rastgele değil — iki bağımsız etiketleme
yöntemiyle doğrulanan, tutarlı ve mekanik olarak açıklanabilir bir örüntü izliyor, ve birkaç
dakikalık kişiye özel kalibrasyonla büyük ölçüde düzeltilebiliyor. Makale şu anda hakemli bir
dergiye gönderim aşamasında; tam kaynak kodlar ve veri işleme betikleri ilgilenen olursa
paylaşılabilir.
</div>

## Referanslar

- Lim, W. L., Sourina, O., & Wang, L. P. — [STEW: Simultaneous Task EEG Workload Data
  Set](https://doi.org/10.1109/TNSRE.2018.2872924), IEEE TNSRE (2018).
- Li, H.-Z. ve ark. — [EEG recording during playing MOBA game, OpenNeuro
  ds005520](https://doi.org/10.18112/openneuro.ds005520.v1.0.1).
- Abinaya, G. & Dinakaran, K. — [Multi-source domain generalization with few-shot fine-tuning
  (MSDG-FT) for cross-dataset EEG mental workload classification](https://doi.org/10.1016/j.mex.2026.103913),
  MethodsX (2026).
