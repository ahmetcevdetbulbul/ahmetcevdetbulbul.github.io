---
title: "Roketi İndirmeyi Tarayıcında Öğret: Sıfırdan PPO ile Lunar Lander (İnteraktif)"
date: 2026-10-14
excerpt: Lunar Lander'ı kendi bilgisayarında, tarayıcının içinde eğit — sıfırdan yazılmış PPO, canlı eğitim grafikleri, eğitilmiş modeli çalıştırma ve arkasındaki matematiğin tam açıklaması.
tags: [Pekiştirmeli Öğrenme, PPO, Oyun Geliştirme, JavaScript]
---

<div class="callout callout-tip">
<div class="callout-title">🚀 Bu sayfa bir demo, sadece yazı değil</div>
Aşağıdaki simülasyon <strong>senin bilgisayarında</strong> çalışır. Önce roketin rastgele eylemlerle nasıl
çakıldığını izle, sonra bir <strong>iterasyon sayısı</strong> girip eğit: sinir ağı gerçek zamanlı olarak,
senin işlemcini kullanarak inmeyi öğrenir; ödül, başarı ve entropi grafikleri canlı akar. Eğitim bitince
<strong>Çalıştır</strong>'a bas ve eğitilmiş modelin inişini izle. Sunucu yok, her şey tarayıcında bir
Web Worker içinde çalışır.
</div>

<div class="demo-embed">
<iframe src="assets/lunar-lander-rl/demo.html" title="Lunar Lander PPO demosu"></iframe>
<p class="demo-caption">Sol: simülasyon · Sağ: canlı eğitim. Eğitim sırasında "canlı önizleme" açıksa roket, politikanın o anki halini oynar — gelişimini gözünle görürsün.</p>
</div>

## Arayüzü nasıl okumalı

Her panel, aşağıda anlatacağım matematiğin tek bir parçasına denk geliyor:

<table>
<thead><tr><th>Arayüzdeki öğe</th><th>Neyi gösteriyor</th></tr></thead>
<tbody>
<tr><td><strong>Gözlem vektörü (8 çubuk)</strong></td><td>Ağın gördüğü tek şey: konum, hız, açı, açısal hız ve bacak teması. Politika, roketin "resmini" görmez — sadece bu 8 sayıyı görür.</td></tr>
<tr><td><strong>Politika π(a | s)</strong></td><td>Ağın o anki durumda 4 eylem için verdiği olasılıklar. Rastgele politikada hepsi %25; eğitim ilerledikçe dağılım keskinleşir. Seçilen eylem vurgulanır.</td></tr>
<tr><td><strong>Ortalama ödül</strong></td><td>Son 30 bölümün ortalama toplam ödülü. Yaklaşık +200 üstü "çözüldü" sayılır.</td></tr>
<tr><td><strong>İniş başarısı</strong></td><td>Son 30 bölümün yüzde kaçı gerçekten durarak inmeyle (+100) bitti.</td></tr>
<tr><td><strong>Politika entropisi</strong></td><td>Politikanın ne kadar "kararsız" olduğu. ln 4 ≈ 1.39 tam rastgele demek; öğrenme ilerledikçe düşer.</td></tr>
<tr><td><strong>Log değer kaybı</strong></td><td>Kritik ağın "bu durum ne kadar iyi?" tahminindeki hata (log₁₀ ölçeğinde).</td></tr>
<tr><td><strong>Adım / sn</strong></td><td>Senin işlemcinin saniyede kaç simülasyon adımı üretip öğrendiği. Bu sayı doğrudan makinene bağlıdır.</td></tr>
</tbody>
</table>

<div class="callout callout-code">
<div class="callout-title">⚙️ Bu ortam Gymnasium'un LunarLander-v3'ü değil, onun bir JavaScript portu</div>
Gözlem (8 boyut), aksiyon (4 ayrık) ve ödül yapısı orijinaliyle aynı; ama fizik Box2D yerine sade bir
rijit-cisim + yay-sönümleyici bacak modeliyle yazıldı. Benzerliği ölçtüm: Gymnasium'un kendi
<code>heuristic</code> kontrolcüsü bu portta 200 bölümün 199'unda iniyor (ortalama +256), rastgele politika
ortalama −147 alıyor. Yani fizik makul — ama skorlar orijinal ortamla birebir kıyaslanamaz.
</div>

## 1. Problem: bir Markov karar süreci

<p>Roketi indirmek, pekiştirmeli öğrenmenin klasik çerçevesine oturur: her zaman adımı <i>t</i>'de ajan bir durum
$s_t$ gözlemler, bir eylem $a_t$ seçer, ortam bir ödül $r_t$ ve yeni durum $s_{t+1}$ döndürür. Ajanın amacı,
iskontolu toplam ödülü (getiri) en büyük yapan politikayı bulmaktır:</p>

<div class="eq">
$$G_t=\sum_{k=0}^{T-t}\gamma^{k}\,r_{t+k},\qquad J(\theta)=\mathbb{E}_{\tau\sim\pi_\theta}\!\left[G_0\right],\qquad \gamma=0.99$$
</div>

<p>Burada $\pi_\theta(a\mid s)$ parametreleri $\theta$ olan bir sinir ağıdır ve $\tau=(s_0,a_0,r_0,s_1,\dots)$ bir
yörüngedir. Durum ve eylem uzayı şöyle:</p>

<table>
<thead><tr><th>İndeks</th><th>Gözlem (s)</th><th>Normalizasyon</th></tr></thead>
<tbody>
<tr><td>0, 1</td><td>yatay / dikey konum</td><td>$(x-10)/10$ ve $(y-y_\text{pist})/6.67$</td></tr>
<tr><td>2, 3</td><td>yatay / dikey hız</td><td>$0.2\,v_x$ ve $0.133\,v_y$</td></tr>
<tr><td>4</td><td>gövde açısı $\theta$</td><td>radyan</td></tr>
<tr><td>5</td><td>açısal hız $\omega$</td><td>$0.4\,\omega$</td></tr>
<tr><td>6, 7</td><td>sol / sağ bacak teması</td><td>0 veya 1</td></tr>
</tbody>
</table>

<p>Eylemler dört tane: <b>0</b> hiçbir şey, <b>1</b> sol yan motor (gövdeyi sola iter ve saat yönünün tersine
döndürür), <b>2</b> ana motor, <b>3</b> sağ yan motor. Eylem uzayı ayrık olduğu için politika bir
<i>kategorik dağılımdır</i>.</p>

### Ödül: şekillendirilmiş (shaped) ve neredeyse bir potansiyel fark

<p>Ödül yalnızca "indi / çakıldı" olsaydı, rastgele bir ajan neredeyse hiç sinyal alamazdı. Orijinal ortam bu yüzden
ara ödül verir: pist merkezine yaklaşmak, yavaşlamak, dik durmak ve bacakları yere değdirmek iyidir.</p>

<div class="eq">
$$\Phi(s)=-100\sqrt{x^2+y^2}\;-\;100\sqrt{v_x^2+v_y^2}\;-\;100\,|\theta|\;+\;10\,c_L+10\,c_R$$
$$r_t=\Phi(s_{t+1})-\Phi(s_t)\;-\;0.30\cdot\mathbf 1[a_t=2]\;-\;0.03\cdot\mathbf 1[a_t\in\{1,3\}]$$
</div>

<p>Ayrıca bölüm sonunda ödül <b>−100</b> (çakıldı ya da pist dışına çıktı) veya <b>+100</b> (iki bacak üstünde 0.5 saniye
hareketsiz kaldı) olarak değiştirilir. İlk ifadenin güzel bir özelliği var: ardışık farkların toplamı
teleskopik olarak sadeleşir,</p>

<div class="eq">
$$\sum_{t=0}^{T-1}\big(\Phi(s_{t+1})-\Phi(s_t)\big)=\Phi(s_T)-\Phi(s_0)$$
</div>

<p>yani şekillendirme ödülünün toplamı yalnızca <i>başlangıç ile son durumun kalitesi</i>ne bağlıdır; ajan rotayı
istediği gibi seçebilir, ama motoru gereksiz yakmak $-0.30$ ile cezalandırılır. Bu, Ng, Harada ve Russell'ın
potansiyel-tabanlı şekillendirme fikridir ($\gamma\approx1$ için optimal politikayı korur).</p>

### Fizik

<p>Roket bir rijit cisim; her adım 4 alt adımda yarı-örtük Euler ile entegre edilir (adım süresi $1/50$ s).
Konum ivmesi yer çekimi ve motorlardan gelir:</p>

<div class="eq">
$$\ddot{\mathbf p}=\begin{pmatrix}0\\-g\end{pmatrix}+A_{\text{main}}\begin{pmatrix}-\sin\theta\\ \cos\theta\end{pmatrix}\mathbf 1[a=2]+A_{\text{side}}\,d\begin{pmatrix}\cos\theta\\ \sin\theta\end{pmatrix},\qquad \ddot\theta=-d\,\alpha_{\text{side}}$$
</div>

<p>Burada $g=10\ \text{m/s}^2$, $A_{\text{main}}=17.4\ \text{m/s}^2$ (yani yer çekiminin 1.74 katı itki),
$A_{\text{side}}=2.4\ \text{m/s}^2$, $\alpha_{\text{side}}=5.5\ \text{rad/s}^2$ ve $d\in\{-1,0,+1\}$ yan motorun
yönüdür. Bacaklar yay-sönümleyici olarak modellenir: ayak ucu zemine $\delta$ kadar girdiğinde normal
kuvvet ve sürtünme</p>

<div class="eq">
$$F_n=\max\!\big(0,\;k\,\delta-c\,v_n\big),\qquad F_t=\operatorname{clip}\!\big(-c_f\,v_t,\;-\mu F_n,\;\mu F_n\big)$$
</div>

<p>ile hesaplanır ($k=2500$ N/m, $c=80$ N·s/m, $\mu=0.3$). Gövde (bacaklar değil) zemine değerse bölüm
"çakıldı" ile biter. Bacakların yumuşak olması, sert inişte gövdenin yere vurmasını mümkün kılar —
tıpkı orijinal ortamdaki gibi.</p>

## 2. Politika ağı: durumdan olasılığa

<div class="chart-card">
<h4>İki ağ: aktör (ne yapayım?) ve kritik (bu durum ne kadar iyi?)</h4>
<img src="assets/lunar-lander-rl/architecture.svg" alt="Sekiz gözlemin iki ayrı ağa girdiği şema: üstte 64-64-4 aktör ağı softmax ile dört eylem olasılığı üretir, altta 64-64-1 kritik ağı tek bir değer tahmini üretir.">
<p class="chart-caption">Örnek bir durum için çıktılar (sayılar açıklayıcıdır). Aktör 4 996, kritik 4 801 parametreye sahip;
ikisi ağırlık paylaşmaz. Toplam 9 797 sayıyı eğitiyoruz.</p>
</div>

<p>Aktör, 8 boyutlu gözlemi iki gizli katmandan geçirip 4 "logit" üretir; softmax bunları olasılığa çevirir:</p>

<div class="eq">
$$z=W_3\tanh\!\big(W_2\tanh(W_1 s+b_1)+b_2\big)+b_3,\qquad \pi_\theta(a\mid s)=\frac{e^{z_a}}{\sum_{j=0}^{3}e^{z_j}}$$
</div>

<p>Başlangıçta çıkış katmanının ağırlıkları çok küçük (ortogonal başlatma, kazanç $0.01$), bu yüzden tüm logit'ler
≈ 0 ve politika neredeyse tam <i>düzgün dağılımdır</i>: $\pi\approx(0.25,0.25,0.25,0.25)$. Rastgele politikayı
"Çalıştır"da görmenin sebebi budur. Belirsizliği ölçen şey <b>entropi</b>dir:</p>

<div class="eq">
$$H\big(\pi_\theta(\cdot\mid s)\big)=-\sum_{a}\pi_\theta(a\mid s)\,\log\pi_\theta(a\mid s)\ \in[0,\ \ln 4\approx1.386]$$
</div>

<p>Kritik ağı ise aynı girdiden tek bir sayı üretir: bu durumdan itibaren beklenen getiri
$V_\phi(s)\approx\mathbb{E}[G_t\mid s_t=s]$. Neden ikinci bir ağa ihtiyacımız var? Cevap, bir sonraki bölümde.</p>

## 3. Politika gradyanı ve avantaj

<p>Amacımız $J(\theta)$'yı artırmak. Zorluk: $J$, ortamın bilinmeyen dinamiklerinden geçen bir beklenti.
<i>Log-türev hilesi</i> bunu çözer: $\nabla_\theta\,\mathbb{E}_{x\sim p_\theta}[f(x)]=\mathbb{E}\big[f(x)\,\nabla_\theta\log p_\theta(x)\big]$.
Ortam kısmı $\theta$'ya bağlı olmadığı için türevden düşer ve geriye yalnızca politikanın log-olasılığı kalır:</p>

<div class="eq">
$$\nabla_\theta J(\theta)=\mathbb{E}\Big[\sum_{t}\nabla_\theta\log\pi_\theta(a_t\mid s_t)\;\hat A_t\Big]$$
</div>

<p>Sezgi: iyi çıkan eylemin ($\hat A_t>0$) olasılığını artır, kötü çıkanın ($\hat A_t<0$) azalt. Ham getiri
$G_t$ yerine <b>avantaj</b> $\hat A_t$ kullanırız — "bu eylem, o durumdaki ortalama eylemden ne kadar iyiydi?".
Ortalamayı çıkarmak (baseline) beklenen gradyanı değiştirmez ama varyansı büyük ölçüde düşürür; kritik ağın görevi
tam olarak bu ortalamayı, $V_\phi(s)$'yi, tahmin etmektir.</p>

### Genelleştirilmiş avantaj tahmini (GAE)

<p>Avantajı tek adımlı TD hatalarının üstel ağırlıklı toplamıyla tahmin ederiz:</p>

<div class="eq">
$$\delta_t=r_t+\gamma V_\phi(s_{t+1})-V_\phi(s_t),\qquad \hat A_t=\sum_{l=0}^{\infty}(\gamma\lambda)^{l}\,\delta_{t+l}=\delta_t+\gamma\lambda\,\hat A_{t+1}$$
</div>

<p>$\lambda=0.95$, bias–varyans takasını ayarlar: $\lambda=0$ yalnızca bir adım bakar (düşük varyans, yüksek bias),
$\lambda=1$ tüm getiriyi kullanır (bias yok, yüksek varyans). Sağdaki özyineleme, tamponu <i>sondan başa</i> tek geçişte
doldurmamızı sağlar. Kritik ağın hedefi $\hat R_t=\hat A_t+V_\phi(s_t)$'dir. Koddaki tam hâli:</p>

```js
// Ortam başına tamponu sondan başa tara (ppo.js)
for (let t = nSteps - 1; t >= 0; t--) {
  const nonTerm = 1 - done[t];                     // bölüm bittiyse getiriyi kes
  const nextV   = t === nSteps - 1 ? lastVal : val[t + 1];
  const delta   = rew[t] + gamma * nextV * nonTerm - val[t];   // TD hatası δ_t
  last = delta + gamma * lambda * nonTerm * last;              // Â_t = δ_t + γλ Â_{t+1}
  adv[t] = last;
  ret[t] = last + val[t];                                      // R̂_t
}
```

## 4. PPO: güncellemeyi güvenli tut

<p>Düz politika gradyanının büyük bir tuzağı var: aynı veriyle birden çok kez adım atarsak politika, verinin
toplandığı politikadan uzaklaşır ve tahminler geçersizleşir. <b>PPO</b> bunu, yeni ve eski politikanın olasılık oranını
sınırlayarak çözer:</p>

<div class="eq">
$$\rho_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{\theta_\text{eski}}(a_t\mid s_t)},\qquad L^{\text{CLIP}}(\theta)=\mathbb{E}\Big[\min\!\big(\rho_t\hat A_t,\ \operatorname{clip}(\rho_t,\,1-\epsilon,\,1+\epsilon)\,\hat A_t\big)\Big],\quad \epsilon=0.2$$
</div>

<div class="chart-card">
<h4>Kırpılmış amaç fonksiyonu neden "güvenli"?</h4>
<img src="assets/lunar-lander-rl/clip-objective.svg" alt="İki panelli grafik. Solda Â pozitifken amaç r=1.2'ye kadar artar, sonra düzleşir; sağda Â negatifken amaç r=0.8'in altında düzleşir. Düzleşen bölgelerde gradyan sıfırdır.">
<p class="chart-caption"><b>Sol:</b> eylem iyiydiyse olasılığını artırırız, ama oran $1+\epsilon$'u geçince ödül düzleşir — gradyan sıfır,
daha fazla zorlamanın anlamı yok. <b>Sağ:</b> eylem kötüydüyse olasılığını azaltırız, oran $1-\epsilon$'un altına inince
gradyan kesilir. İkisinde de politika, eski politikanın "güven bölgesi"nden fazla uzaklaşamaz.</p>
</div>

<p>Bu sayede aynı 2048 örneği <b>4 epoch</b> boyunca, 128'lik mini-batch'lerle tekrar tekrar kullanabiliyoruz (iterasyon
başına 64 gradyan adımı). Düz politika gradyanında bu güvenle yapılamazdı.</p>

### Toplam kayıp ve elle yazılmış gradyanlar

<p>Eğitilen tek bir kayıp var; üç parçadan oluşuyor — politika, değer ve keşif (entropi) terimi:</p>

<div class="eq">
$$L(\theta,\phi)=-L^{\text{CLIP}}\;+\;c_v\cdot\tfrac12\big(V_\phi(s_t)-\hat R_t\big)^2\;-\;c_e\cdot H\big(\pi_\theta(\cdot\mid s_t)\big),\qquad c_v=0.5,\ c_e=0.01$$
</div>

<p><b>Entropi bonusu</b>, politikanın erkenden tek bir eyleme kilitlenmesini engeller; yeterince keşfetmesini sağlar.
Çıkıştaki logit'lere göre gradyanlar kapalı formda yazılabilir (otomatik türev kullanmıyorum):</p>

<div class="eq">
$$\frac{\partial\log\pi_a}{\partial z_j}=\mathbf 1[j=a]-\pi_j,\qquad \frac{\partial H}{\partial z_j}=-\pi_j\big(\log\pi_j+H\big),\qquad \frac{\partial L^{\text{CLIP}}}{\partial z_j}=\begin{cases}\rho_t\hat A_t\,\big(\mathbf 1[j=a]-\pi_j\big)&\text{kırpılmamış dal}\\ 0&\text{kırpılmış dal}\end{cases}$$
</div>

```js
// Politika kaybının logit'lere gradyanı (ppo.js, update())
const dLogp = useClip ? 0 : -A * ratio;                // kırpıldıysa gradyan yok
for (let j = 0; j < nA; j++) {
  const p = probs[j];
  const dlogp_dz = (j === a ? 1 : 0) - p;              // ∂log π_a / ∂z_j
  const dEnt = entCoef * p * (Math.log(p) + entropy);  // −c_e · ∂H/∂z_j
  dOutA[n * nA + j] = (dLogp * dlogp_dz + dEnt) / B;
}
```

## 5. Geri yayılım ve Adam

<p>Logit gradyanlarını ağın içine, zincir kuralıyla geri taşırız. $\tanh$ türevi $1-\tanh^2$ olduğu için, gizli
katman $l$'nin hata sinyali ve ağırlık gradyanı:</p>

<div class="eq">
$$\delta^{(l)}=\big(W^{(l+1)\top}\delta^{(l+1)}\big)\odot\big(1-h^{(l)}\odot h^{(l)}\big),\qquad \nabla_{W^{(l)}}L=\delta^{(l)}\,h^{(l-1)\top},\qquad \nabla_{b^{(l)}}L=\delta^{(l)}$$
</div>

<p>Elle yazılmış geri yayılımın doğruluğunu sayısal gradyanla kontrol ettim (sonlu farklar): göreli hata
$\sim10^{-9}$. Parametreleri güncelleyen optimizer <b>Adam</b>'dır; her parametre için birinci ve ikinci moment'in
üstel ortalamalarını tutar:</p>

<div class="eq">
$$m_t=\beta_1 m_{t-1}+(1-\beta_1)g_t,\quad v_t=\beta_2 v_{t-1}+(1-\beta_2)g_t^2,\quad \theta\leftarrow\theta-\eta\,\frac{m_t/(1-\beta_1^t)}{\sqrt{v_t/(1-\beta_2^t)}+\varepsilon}$$
</div>

<p>Üstüne, gradyanın global normu $0.5$'i geçerse tüm gradyan vektörü küçültülür
($g\leftarrow g\cdot\min(1,\,0.5/\lVert g\rVert)$) ve öğrenme hızı $\eta=3\times10^{-4}$'ten başlayıp eğitim boyunca
doğrusal olarak %10'una iner.</p>

## 6. Bir iterasyonun içinde ne oluyor?

<div class="chart-card">
<h4>PPO döngüsü: topla → avantajı hesapla → güncelle</h4>
<img src="assets/lunar-lander-rl/ppo-loop.svg" alt="Altı kutulu döngü: ortam, politika, tampon, avantaj hesabı (GAE), PPO güncellemesi ve yeni parametreler; yeni parametreler tekrar politikaya döner.">
<p class="chart-caption">Arayüzdeki "iterasyon sayısı" bu döngünün kaç kez döneceğini belirler. Her tur yaklaşık 2048 yeni simülasyon adımı ve 64 gradyan adımı demek.</p>
</div>

<table>
<thead><tr><th>Hiperparametre</th><th>Değer</th><th>Hiperparametre</th><th>Değer</th></tr></thead>
<tbody>
<tr><td>Paralel ortam</td><td>8</td><td>İskonto $\gamma$</td><td>0.99</td></tr>
<tr><td>Adım / ortam / iterasyon</td><td>256 (toplam 2048)</td><td>GAE $\lambda$</td><td>0.95</td></tr>
<tr><td>Epoch</td><td>4</td><td>Kırpma $\epsilon$</td><td>0.2</td></tr>
<tr><td>Mini-batch</td><td>128</td><td>Değer / entropi katsayısı</td><td>0.5 / 0.01</td></tr>
<tr><td>Öğrenme hızı</td><td>$3\times10^{-4}\to3\times10^{-5}$</td><td>Gradyan kırpma</td><td>0.5 (global norm)</td></tr>
<tr><td>Ağ</td><td>8–64–64–{4 | 1}, tanh</td><td>Optimizer</td><td>Adam ($\varepsilon=10^{-5}$)</td></tr>
</tbody>
</table>

## 7. Öğrenme eğrisi ve ilginç bir bulgu: argmax neden çökebiliyor?

<p>Geliştirme makinemde bir iterasyon yaklaşık 0.4 saniye sürüyor (≈5 bin adım/sn). Üç farklı tohumda ilk iterasyonda
ortalama ödül −200 ile −300 arasında (rastgele politika); 20–40 iterasyonda (≈40–80 bin adım) pozitife geçiyor ve
60–100 iterasyonda (≈120–200 bin adım) +200 civarına yerleşiyor. Tam sayılar tohuma göre değişir — bu yüzden
grafikte kendi eğrini görmen daha değerli.</p>

<p>Ama şunu fark ettim: eğitimin sonunda modeli <b>deterministik</b> (her durumda en olası eylem,
<code>argmax</code>) çalıştırınca, kısa eğitimlerde sonuç felaket olabiliyor; oysa aynı model <b>örnekleyerek</b>
(π'den çekerek) neredeyse her seferinde iniyor. Tohumları sonuca bakmadan 1–6 seçtim; her hücre 100 değerlendirme
bölümü (<i>iniş sayısı · ortalama ödül</i>):</p>

<table>
<thead><tr><th>Tohum</th><th>100 iter. · stokastik</th><th>100 iter. · argmax</th><th>300 iter. · stokastik</th><th>300 iter. · argmax</th></tr></thead>
<tbody>
<tr><td>1</td><td>88 · +197</td><td>0 · −3430</td><td>100 · +227</td><td>100 · +205</td></tr>
<tr><td>2</td><td>96 · +223</td><td>0 · −3947</td><td>100 · +236</td><td>100 · +226</td></tr>
<tr><td>3</td><td>89 · +190</td><td>0 · −1462</td><td>100 · +232</td><td>100 · +215</td></tr>
<tr><td>4</td><td>91 · +198</td><td>0 · −910</td><td>98 · +229</td><td>99 · +212</td></tr>
<tr><td>5</td><td>94 · +220</td><td>0 · −5079</td><td>100 · +233</td><td>100 · +217</td></tr>
<tr><td>6</td><td>98 · +243</td><td>0 · −1569</td><td>100 · +231</td><td>100 · +218</td></tr>
<tr><td><b>Ortalama</b></td><td><b>92.7 · +212</b></td><td><b>0 · −2733</b></td><td><b>99.7 · +231</b></td><td><b>99.8 · +216</b></td></tr>
</tbody>
</table>

<p>Sebebini tahmin etmek yerine politikaların davranışını ölçtüm. 100 iterasyonda <code>argmax</code> politika altı
tohumun hepsinde <b>hiç inemiyor</b>: bölümlerin %79–100'ü pist dışına uçarak bitiyor, kalanı havada asılı kalıp
zaman aşımına uğruyor. Ana motoru adımların <b>%76–98</b>'inde ateşliyor; örnekleyen politika ise yalnızca
%25–31'inde. Mekanizma şu:</p>

<ul>
<li>Ayrık eylem uzayında "yarım itki" diye bir şey yok. Politika, istediği ortalama itkiyi <b>olasılıkla</b> kodluyor:
ana motor olasılığı $\approx0.3$ ise zamanın %30'unda ateşleyerek yaklaşık 0.3 × itki elde ediyor
(bir tür darbe-genişlik modülasyonu).</li>
<li><code>argmax</code> bu olasılığı <i>0 ya da 1</i>'e yuvarlıyor: $\pi(\text{ana})=0.38$ ama diğer üç eylem 0.2'şer ise en olası
eylem hep "ana motor"; roket istediğinin birkaç katı itkiyle yükseliyor ve yana savruluyor.</li>
<li>Savrulan roket, eğitimde hiç görmediği durumlara giriyor; politika orada neredeyse düzgün dağılıma düşüyor
(argmax koşularında adım başına ortalama <i>en yüksek olasılık</i> yalnızca 0.28–0.38; örneklenen yörüngelerde
0.55–0.60) ve hata katlanarak büyüyor.</li>
</ul>

<p>300 iterasyonda politika keskinleşiyor (örneklenen yörüngede ortalama en yüksek olasılık 0.64–0.67), itkiyi artık
daha çok <i>durum bazında kararlı seçimlerle</i> veriyor ve iki mod da birbirine yaklaşıyor (argmax'ın ana motor
payı %45–48, örneklemeninki %36–42). Ders: "deterministik değerlendirme her zaman daha iyi" varsayımı, ayrık
eylemli ve kısa eğitilmiş politikalarda yanıltıcı olabilir. Arayüzdeki <b>Deterministik (argmax)</b> kutusuyla bunu
kendin deneyebilirsin: 100 iterasyon eğit, sonra kutuyu aç-kapa.</p>

## 8. Dürüstlük notları ve sınırlar

- **Ortam benzer, aynı değil.** Box2D yerine sade fizik; motor "dispersiyon" gürültüsü yok. Skorları literatürdeki
  LunarLander-v3 sayılarıyla doğrudan kıyaslama.
- **Sayılar belirli koşullarda ölçüldü:** Node.js'te, 6 tohum (1–6), tohum başına 100 değerlendirme bölümü, aynı
  ortam portu. Bu bir istatistiksel benchmark değil, bir davranışın göstergesi.
- **Bu bir oyuncak ölçek.** Ağ küçük (≈9.8 bin parametre), tek iş parçacığı, tek makine. Amacım hız rekoru değil,
  algoritmanın her satırını görünür kılmak.
- **Python projesinden farkı:** Aynı fikri önce `gymnasium` + Stable-Baselines3 PPO ile masaüstünde
  çalıştırmıştım (300 bin adımlık baseline). Burada SB3 yok; PPO'nun tamamı bağımlılıksız JavaScript.
- **Eğitim senin cihazında:** Sekmeyi kapatırsan eğitim durur. Biten model tarayıcının `localStorage`'ında saklanır;
  "Mevcut modelden devam et" ile sürdürebilirsin.

## Kaynak kod

Hepsi bu sitenin deposunda, derleme adımı olmadan çalışan düz JavaScript:

- [lander-env.js](assets/lunar-lander-rl/lander-env.js) — fizik + gözlem/ödül (Gymnasium portu)
- [ppo.js](assets/lunar-lander-rl/ppo.js) — MLP, geri yayılım, Adam, GAE, PPO
- [train-worker.js](assets/lunar-lander-rl/train-worker.js) — eğitimi arka planda (Web Worker) çalıştırır
- [demo.js](assets/lunar-lander-rl/demo.js) — arayüz, çizim, canlı grafikler

## Referanslar

- Schulman, J. ve ark. — [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) (2017).
- Schulman, J. ve ark. — [High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) (2015).
- Kingma, D. P. & Ba, J. — [Adam: A Method for Stochastic Optimization](https://arxiv.org/abs/1412.6980) (2014).
- Ng, A. Y., Harada, D., & Russell, S. — Policy invariance under reward transformations: Theory and application to reward shaping, ICML (1999).
- [Gymnasium — Lunar Lander](https://gymnasium.farama.org/environments/box2d/lunar_lander/) ortam dokümantasyonu.
- [Stable-Baselines3](https://stable-baselines3.readthedocs.io/) — masaüstü sürümde kullandığım PPO uygulaması.
