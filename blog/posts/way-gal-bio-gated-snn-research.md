---
title: "WAY-EEG-GAL Üzerinde Bio-Gated SNN Hipotezi: Titiz Bir Negatif Sonuç Araştırması"
date: 2026-09-20
excerpt: EEG ve sEMG'yi öğrenilmiş bir kapılama mekanizmasıyla birleştiren bir biyonik el kontrol hipotezini, sıfır sentetik veriyle ve konu-bağımsız istatistiksel titizlikle test ettim — hipotez desteklenmedi, ama süreçte gerçek ve sağlam bir fizyolojik bulgu ile kritik bir metodolojik hata ortaya çıktı.
tags: [Yapay Zeka, Sinirbilim, Araştırma, Python]
---

<div class="callout callout-tip">
<div class="callout-title">📋 Özet</div>
Kas yorgunluğuna dayanıklı bir biyonik el kontrolü için EEG (kortikal sinyal) ve sEMG (kas
sinyali) birleştiren, öğrenilmiş bir "Bio-Gating" mekanizmasını halka açık <strong>WAY-EEG-GAL</strong>
veri setinde (12 katılımcı, 108 oturum, 3528 gerçek deneme) — sıfır sentetik veri, konu-bağımsız
(LOSO) doğrulama ile üç bağımsız hipotezde test ettim. Ana hipotez desteklenmedi. Ama süreçte
istatistiksel olarak çok sağlam gerçek bir yorgunluk izi bulundu, çok-modlu biyosinyal
çalışmalarında sık rastlanan bir örnekleme-frekansı hizalama hatası tespit edilip düzeltildi, ve
üç farklı hipotezin neden desteklenmediği kanıtlarla gösterildi.
</div>

Bu yazı, bir araştırma sürecinin dürüst kaydıdır — başarılı adımlar kadar başarısız olanları da,
seçici raporlama yapmadan. Miyoelektrik protezler günlük kullanımda güvenilirlik sorunu yaşar: kas
yorgunluğu sEMG sinyalinin kalitesini bozar. Başlangıç hipotezi şuydu:

> Bir Spiking Neural Network (SNN), EEG (kortikal motor niyet) ve sEMG (kas aktivasyonu)
> sinyallerini "Bio-Gating" adlı öğrenilmiş bir kapılama mekanizmasıyla birleştirirse, kas
> yorulduğunda ağ bunu otonom olarak hisseder, kontrolü EEG'ye kaydırır ve statik füzyonlu
> mimarilere göre daha dayanıklı kalır.

Bu hipotez daha önce **tek katılımcı, tek oturum ve yapay/sentetik yorgunluk enjeksiyonu** ile
"kanıtlanmıştı". Projenin ilk adımı, hiçbir veriyi sahte kullanmadan, **sıfırdan tamamen gerçek
veri ve titiz istatistiksel yöntemlerle** bu iddiayı yeniden test etmekti.

<div class="chart-card">
<h4>Araştırma süreci: 14 script, 5 aşama</h4>
<img src="assets/way-gal-bio-gated-snn/phase-timeline.svg" alt="14 script boyunca ilerleyen araştırma sürecinin 5 aşamaya ayrılmış zaman çizelgesi: yapısal teşhis, olay-kilitli pipeline, LOSO ve ablasyon, ağırlık sınıflandırmasına pivot, kuvvet zamanlama düzeltmesi.">
<p class="chart-caption">Her kutu bir teşhis → düzeltme → yeniden test döngüsünü temsil ediyor. Süreç
doğrusal ilerlemedi — üç farklı hipotez denendi, üçü de aynı şeffaflıkla raporlandı.</p>
</div>

## Veri seti: WAY-EEG-GAL

[Luciw ve arkadaşları tarafından toplanan](https://www.nature.com/articles/sdata201447) bu veri
seti, katılımcıların bir cismi uzanıp kavrayıp kaldırdığı doğal hareketler sırasında eş zamanlı
EEG, sEMG ve kinematik/kuvvet verisi kaydeder. Gerçek yapısı, teşhis scriptleriyle ortaya
çıkarıldı:

| Özellik | Değer |
|---|---|
| Katılımcı sayısı | 12 (P1–P12) |
| Katılımcı başına oturum | 8–9 (toplam 108 oturum dosyası) |
| Oturum başına gerçek deneme | 34 (bazı oturumlarda 28) |
| Toplam gerçek deneme | 3528+ |
| EEG kanalları / örnekleme hızı | 32 kanal, **500 Hz** |
| sEMG kanalları / örnekleme hızı | 5 kanal, **4000 Hz** |
| Kinematik/kuvvet kanalları | 45 kanal (açı, pozisyon, kuvvet, tork) |
| Ağırlık koşulları | 165g / 330g / 660g |
| Olay zamanlaması | `LEDon` — her deneme için kesin hareket başlangıç saniyesi |

## Faz 0 — Tek-deneme hatası

Mevcut taslak kod `mat['ws'][0,0]['win'][0,0]` şeklinde veriye erişiyordu. İlk teşhis
(`00_diagnose_mat_structure.py`), `win` alanının `(1, 34)` şeklinde — yani **34 ayrı deneme**
içerdiğini ortaya çıkardı. Önceki kod `[0,0]` indeksiyle sadece ilk denemeyi kullanıyor, "yorgunluk"
analizini bir oturumun tek bir denemesinin kaydırmalı pencerelenmesine dayandırıyordu —
birbirine yüksek oranda bağımlı, sahte-çoklu-örneklem üreten bir hata. Düzeltme basitti: `win[0, i]`
ile tüm gerçek denemeler işlendi.

## Faz 1 — Örnekleme frekansı hatası ve gerçek yorgunluk

`eeg_t` ve `emg_t` zaman damgaları doğrudan ölçüldüğünde: **EEG 500.00 Hz** (varsayımla uyumlu),
ama **sEMG 4000.00 Hz** — önceki kodun varsaydığı "500 Hz" **yanlıştı**. Önceki kod, iki farklı
hızda örneklenmiş sinyale aynı pencere indekslerini uygulayarak (`eeg[s:s+50]`, `emg[s:s+50]`)
onları yanlış zaman noktalarında eşleştiriyordu — çok-modlu EEG/EMG literatüründe sık rastlanan
ama nadiren fark edilen bir hata sınıfı.

<div class="chart-card">
<h4>İndeks bazlı vs. zaman damgası bazlı hizalama</h4>
<img src="assets/way-gal-bio-gated-snn/sampling-mismatch.svg" alt="İki panel: üstte aynı indeksin EEG'de 0.1 saniyeye, sEMG'de 0.0125 saniyeye denk geldiğini gösteren yanlış hizalama; altta gerçek zaman damgalarıyla doğru eşleştirmeyi gösteren düzeltme.">
<p class="chart-caption">500 Hz ve 4000 Hz sinyallere aynı indeksi uygulamak, aynı "örnek 50"yi
8 kat farklı zaman noktalarında eşleştiriyordu. Düzeltme, indeks yerine gerçek saniye
değerleriyle hizalama yapmaktı.</p>
</div>

```python
def infer_fs(t_field, n_samples, label):
    t = np.array(t_field).flatten().astype(np.float64)
    dt = np.median(np.diff(t))
    fs_est = 1.0 / dt if dt > 0 else np.nan
    print(f"  {label}: medyan dt = {dt:.6f}s => tahmini fs = {fs_est:.2f} Hz")
    return fs_est
```

Aynı script, 108 oturumun tamamında, deneme sırası ile sEMG medyan frekansı (MDF) arasındaki
ilişkiyi ağırlık/yüzey koşulunu kısmi korelasyonla kontrol ederek test etti:

| Metrik | Değer |
|---|---|
| Ham korelasyonda anlamlı (p<0.05) negatif trend gösteren oturum | 17/108 (%15.7) |
| Ağırlık/yüzey-kontrollü anlamlı negatif trend gösteren oturum | 21/108 (%19.4) |
| Popülasyon seviyesinde ortalama kısmi korelasyon | rho ≈ −0.144 |
| Tek-örneklem t-testi (rho'nun 0'dan farkı) | **t = −6.44, p < 0.00001** |

Tek oturum bazında düşük istatistiksel güç nedeniyle çoğu oturum bireysel olarak anlamlı çıkmasa
da, 108 oturum havuzlandığında **istatistiksel olarak çok sağlam, tutarlı bir gerçek yorgunluk
izi** bulundu — kısa süreli (8–10 saniyelik), aralarında dinlenme olan doğal hareketlerde bile.
Literatürde bu etki genelde sadece uzun süreli maksimal kasılma protokollerinde aranır.

## Faz 2 — Olay-kilitli, çok-katılımcılı pipeline

Bir sonraki script, önceki iki hatayı (tek-deneme, yanlış hizalama) düzelterek `LEDon` işaretine
kilitli, gerçek zaman damgalarıyla hizalanmış pencereler üretti:

<div class="chart-card">
<h4>REST ve GRASP pencereleri, LEDon'a göre</h4>
<img src="assets/way-gal-bio-gated-snn/event-locked-windows.svg" alt="LEDon işaretine göre -2 ile +2 saniye arası bir zaman çizelgesi; REST penceresi -1.5 ile -0.5 saniye arasında, GRASP penceresi +0.5 ile +1.5 saniye arasında işaretlenmiş.">
<p class="chart-caption">Her pencere ayrı, bağımsız bir denemeden geliyor — önceki kodun kaydırmalı
pencere otokorelasyonu sorunu tamamen ortadan kalktı.</p>
</div>

Sonuç: 12 katılımcı, 108 oturum, 3528 deneme → **7056 bağımsız pencere** (3528 REST + 3528
GRASP), sıfır atlanan deneme.

## Faz 3 — LOSO çapraz doğrulama ve ablasyon

**Leave-One-Subject-Out (LOSO)** çapraz doğrulamasıyla (12 kat, her katta 11 katılımcıyla eğitim,
hiç görmediği 1 katılımcıyla test) 7 model karşılaştırıldı. Bio-Gating mekanizmasının merkezinde
şu füzyon adımı var — `gamma`, EMG spike'larından öğrenilen bir kapılama değeri:

```python
if self.gate_mode == "learned":
    g_cur = self.gate_fc(spk_emg[t])
    _, mem_g = self.gate_lif(g_cur, mem_g)
    gamma = torch.sigmoid(mem_g)
else:
    gamma = torch.full((x_eeg.size(0), 1), 0.5)  # ablasyon: sabit kapılama

fused = (1.0 - gamma) * h_e + gamma * h_m  # EEG ve EMG'yi gamma ile karıştır
```

<div class="chart-card">
<h4>LOSO doğruluğu: BioGatedSNN vs. 6 karşılaştırma modeli</h4>
<img src="assets/way-gal-bio-gated-snn/loso-ablation-chart.svg" alt="Bar chart: BioGatedSNN %93.84, NoGate-ablasyon %93.72 (anlamsız fark), EEG-only %54.31 (anlamlı derecede kötü), EMG-only %93.78 (anlamsız fark), CNN1D %95.92, LSTM %95.18, SVM %96.53 (CNN1D ve SVM anlamlı derecede iyi).">
<p class="chart-caption">Bio-Gating'i sabit γ=0.5 ile değiştiren NoGate-ablasyonu, öğrenilmiş
kapılamadan istatistiksel olarak ayırt edilemiyor (p=0.79). Klasik SVM ve CNN1D, BioGated'i anlamlı
derecede geçiyor.</p>
</div>

Ayrıca, ağın öğrendiği gamma değeri ile bağımsız ölçülen gerçek MDF arasındaki korelasyon:
**rho = +0.045** (p=0.007) — istatistiksel olarak anlamlı ama **yön yanlış** ve etki büyüklüğü
ihmal edilebilir. Yorum: Bio-Gating hiçbir ölçülebilir katkı sağlamıyor. EMG-only tek başına
zaten görevi çözüyor — REST/GRASP ayrımı kas aktivasyonu genliğiyle o kadar kolay ki, hiçbir
"akıllı" füzyon stratejisi fark yaratamıyor. Klasik bir **tavan etkisi** (ceiling effect).

## Faz 4 — Hedefe yönelik yorgunluk testi

"Görev çok kolay" sorununu bertaraf etmek için, SADECE Faz 1'de istatistiksel olarak doğrulanmış
21 gerçek-yorgunluk oturumuna odaklanıldı; her oturumun taze (ilk 1/3) ile yorgun (son 1/3) kısmı
arasındaki GRASP recall düşüşü, 3 seed ortalamasıyla ölçüldü:

| Model | Taze Recall | Yorgun Recall | Düşüş | Wilcoxon p |
|---|---|---|---|---|
| BioGatedSNN | %95.0 | %94.4 | +0.57pp | — |
| NoGate-ablasyon | %96.2 | %95.0 | +1.15pp | 0.69 |
| EMG-only | %97.7 | %95.0 | +2.67pp | 0.05 (sınırda, BioGated lehine değil) |
| CNN1D / LSTM / SVM | %98–99 | %96–98 | +1.8/+2.4/+1.9pp | anlamsız |

Taze recall zaten %95–99.6 (tavan etkisi burada da geçerli). Tüm "düşüşler" gürültü seviyesinde
(std 5–8pp) — hedefe yönelik test bile aynı duvara çarptı.

## Faz 5-6 — Spektral özellik zenginleştirmesi

Teşhis: gate mekanizması sadece zaman-alanında ortalama genliği görüyordu; gerçek yorgunluk izi
(MDF) frekans alanındaydı ve modele hiç verilmemişti. Her pencereye kendi MDF değeri eklendiğinde:

| Metrik | Önce (Faz 3) | Sonra (MDF eklendi) |
|---|---|---|
| BioGated vs NoGate (genel doğruluk) | p=0.79 | p=0.66 (hâlâ anlamsız) |
| Gamma-MDF korelasyonu | rho=+0.045 (yanlış yön) | **rho=−0.105, p<0.00001 (doğru yön)** |

Ağ artık kendisine verilen MDF bilgisini doğru yönde kullanmayı öğrendi (iç tutarlılık
kanıtlandı), ama bu **davranışsal bir faydaya dönüşmedi** — çünkü sınıflandırma görevi zaten o
kadar doygun ki, daha "akıllı" bir kapılama stratejisinin değiştirecek hiçbir alanı yoktu.

## Faz 7 — Pivot: ağırlık sınıflandırması

REST/GRASP görevi üç farklı açıdan tavan etkisine çarpınca, veri setinin asıl bilimsel tasarım
amacına ("anticipatory grip scaling" — ağırlığa göre önceden kavrama kuvveti ayarlama) pivot
edildi. EMG genliği + MDF özellikleriyle 3-sınıflı (165g/330g/660g, şans=%33.3) ağırlık tahmini:

| Model | Ort. Doğruluk |
|---|---|
| BioGatedSNN | %44.22 |
| EEG-only | %42.80 |
| EMG-only | %44.84 |
| SVM | %48.95 (çoğunluk sınıfına çökmüş — her katılımcıda tam %52.0) |

SVM'in aynı sayıyı (%52.0, çoğunluk sınıfı oranı) tekrar tekrar üretmesi, hiçbir ayırt edici
sinyal bulunamadığının açık göstergesi. EMG genliği, mutlak ağırlığı doğrudan kodlamıyor.

## Faz 8-9 — Kinematik/kuvvet kanallarının teşhisi

Veri setinin `kin` alanının (45 kanal) gerçek MATLAB struct etiketleri okunarak kanal isimleri
kesin olarak ortaya çıkarıldı:

| Kanal grubu | Anlamı |
|---|---|
| `Ae/Ar/Az 1-4` | Açı sensörleri (12 kanal) |
| `FX/FY/FZ 1-2` | Kuvvet plakası (6 kanal) |
| `Px/Py/Pz 1-4` | Pozisyon sensörleri (12 kanal) |
| `TX/TY/TZ 1-2` | Tork plakası (6 kanal) |
| `IndLF/ThuLF/LF` | Parmak/toplam Yük Kuvveti (Load Force) |
| `IndGF/ThuGF/GF` | Parmak/toplam Kavrama Kuvveti (Grip Force) |

Bu, Johansson & Westling paradigmasının standart değişkenleri — EMG genliğinden çok daha
doğrudan, fiziksel bir ağırlık ölçütü.

## Faz 10-13 — Kuvvet-tabanlı tahmin ve zamanlama düzeltmesi

Sabit pencerelerle (LEDon+0.5..+1.5s) kuvvet-tabanlı ağırlık tahmini denendiğinde, **"geç"
pencerede bile** ForceOnly sadece %51.7 çıktı — fizik kurallarına aykırı görünen bir sonuç. Kök
neden, LEDon'a göre ortalama Yük Kuvvetinin (LF) zaman içinde çizdirilmesiyle ortaya çıktı:

<div class="chart-card">
<h4>Yük Kuvveti zaman eğrisi, ağırlık sınıfına göre</h4>
<img src="assets/way-gal-bio-gated-snn/force-timing-chart.svg" alt="Zamana karşı yük kuvveti grafiği: 0.85 saniyeye kadar tüm ağırlık sınıfları için düz/gürültülü; sonrasında yükseliyor ve 3-3.5 saniyede 165g için 1.61N, 330g için 3.3N, 660g için 6.5N platolarına ulaşıyor. Önceki yanlış pencere (0.5-1.5s) geçiş bölgesiyle çakışıyor.">
<p class="chart-caption"><strong>t &lt; 0.85s:</strong> kuvvet tamamen düz (sensör gürültü tabanı) —
nesneye henüz temas yok. <strong>t ≈ 3.0-3.5s:</strong> net plato — 165g→1.61N, 330g→3.3N,
660g→6.5N (g=9.8 m/s² ile neredeyse birebir örtüşüyor). Önceki "geç" pencere bu platoya değil,
kuvvetin henüz oluşmaya başladığı belirsiz geçiş bölgesine denk geliyordu.</p>
</div>

Ölçülen gerçek zamanlamayla düzeltilmiş son test:

| Pencere | BioGatedSNN | EEG-only | Force-only | SVM |
|---|---|---|---|---|
| GEÇ (sağlık kontrolü, +2.5..+4.0s) | %82.23 | %44.59 | **%84.67** | **%96.88** |
| ERKEN (asıl test, +0.1..+0.7s) | %44.73 | %43.74 | %45.89 | %52.04 (çoğunluk sınıfı) |

Geç pencerede kuvvet sensörleri beklendiği gibi çalışıyor (sağlık kontrolü geçti — metodoloji
doğru). Ama erken, kuvvetin kör olduğu pencerede EEG-only, Force-only'den daha iyi değil ve şans
seviyesine yakın kaldı. **"EEG nesneye dokunmadan önce ağırlığı önceden hissediyor" hipotezi de
desteklenmedi.**

## Genel bulgular

<div class="callout callout-tip">
<div class="callout-title">✅ Pozitif / kalıcı bulgular</div>

1. **Gerçek yorgunluk izi**: 108 oturumda, ağırlık/yüzeyden bağımsız, istatistiksel olarak çok
   sağlam (t=−6.44, p<0.00001) gerçek bir sEMG spektral yorgunluk trendi.
2. **Örnekleme frekansı hatası tespiti**: EEG (500Hz) / sEMG (4000Hz) farkının fark edilmemesi ve
   düzeltilmesi.
3. **Olay-kilitli, çok-katılımcılı, LOSO-doğrulamalı bir pipeline** — yeniden kullanılabilir bir
   metodoloji.
4. **Kuvvet/kinematik kanalların doğru etiketlenmesi ve zamanlamasının doğrulanması.**
</div>

<div class="callout callout-code">
<div class="callout-title">❌ Negatif (ama titizlikle kanıtlanmış) bulgular</div>

1. Bio-Gating mekanizması, REST/GRASP ayrımında NoGate-ablasyonuna göre hiçbir ölçülebilir katkı
   sağlamıyor (p=0.79) — hedefe yönelik ve spektral zenginleştirilmiş versiyonlarda da değişmiyor.
2. EEG'nin ağırlığı nesneye dokunmadan önce öngörebildiği hipotezi desteklenmiyor.
3. Kök neden her denemede farklıydı ama ortak bir tema var: **görev/özellik temsili, hipotezin
   gerçekten test edilmesine izin verecek kadar zor/bilgilendirici değildi.**
</div>

## Metodolojik dersler

- **Ablasyon çalışması yapmadan "füzyon işe yarıyor" demek yanıltıcı olabilir.** EMG-only zaten
  yüksek doğruluk verdiği için, Bio-Gating hiçbir ek fayda sağlamasa bile görünürde "başarılı" bir
  sistem gibi görünebilirdi.
- **Örnekleme frekansı varsayımları her zaman ölçülerek doğrulanmalı**, özellikle çok-modlu veri
  setlerinde.
- **Tavan etkisi**, ince bir etkiyi (yorgunluk gibi) test etmek için seçilen görevin kritik bir
  tuzağıdır — görev çok kolaysa, hiçbir mimari farkı ortaya çıkaramaz.
- **Sürekli görev değiştirerek "işe yarayan" bir sonuç aramak** bilimsel olarak sorunludur; bu
  projede üç farklı hipotez denendi ve hepsi şeffaf şekilde raporlandı.
- **Veri setinin kendi etiketlerini okumak**, sütun anlamlarını varsaymaktan çok daha güvenilir.

<div class="callout callout-tip">
<div class="callout-title">🎯 Sonuç</div>
Bu proje bir "başarı hikayesi" değil — ama bilimsel olarak bundan daha değerli bir şey üretti:
üç bağımsız yolla test edilmiş, dürüstçe raporlanmış bir negatif sonuç, artı süreçte keşfedilen
gerçek bir fizyolojik bulgu ve yeniden kullanılabilir bir metodoloji. 14 script, 2 kritik hata
(tek-deneme, örnekleme frekansı) düzeltildi, sıfır sentetik veri kullanıldı. Tam kaynak kodlar bu
yazının kapsamı dışında tutuldu; ilgilenen olursa paylaşabilirim.
</div>

## Referanslar

- Luciw, M. D., Jarocka, E., & Edin, B. B. — [WAY-EEG-GAL veri seti, Nature Scientific
  Data (2014)](https://www.nature.com/articles/sdata201447)
- Johansson, R. S. & Westling, G. — kavrama kuvveti öngörüsü (anticipatory grip force scaling)
  paradigmasının klasik referansı.
