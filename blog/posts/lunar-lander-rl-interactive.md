---
title: "Client-Side Proximal Policy Optimization for Discrete-Action Lunar Landing: Implementation, Learning Dynamics, and a Stochastic–Deterministic Evaluation Gap"
title_tr: "Ayrık Eylemli Ay İniş Problemi için İstemci Taraflı Yakınsal Politika Optimizasyonu: Uygulama, Öğrenme Dinamikleri ve Stokastik–Deterministik Değerlendirme Farkı"
date: 2026-10-14
excerpt: A dependency-free PPO implementation that trains entirely in the reader's browser on a Lunar Lander benchmark, with live learning curves, a full derivation of the method, and an unexpected gap between stochastic and argmax evaluation.
excerpt_tr: Okuyucunun tarayıcısında, bağımlılıksız çalışan bir PPO uygulaması — canlı öğrenme eğrileri, yöntemin tam türetimi ve stokastik ile argmax değerlendirme arasında beklenmedik bir fark.
tags: [Reinforcement Learning, PPO, Game Development, JavaScript]
---

<div data-lang="en">

<div class="callout callout-math">
<div class="callout-title">Abstract</div>
We present a dependency-free implementation of Proximal Policy Optimization (PPO) that trains entirely inside the reader's browser, on a lightweight JavaScript port of the Lunar Lander benchmark (8-dimensional observation, four discrete actions, shaped reward). The agent, comprising a 4,996-parameter actor and a 4,801-parameter critic, is trained with generalized advantage estimation, a clipped surrogate objective and Adam, using hand-derived gradients verified against finite differences (relative error ≈ 10<sup>−9</sup>). Across six seeds the agent reaches mean returns near +200 within roughly 120–200 thousand environment steps. We also report an evaluation gap: after 100 iterations (≈205 k steps), a deterministic argmax policy lands in 0 of 100 episodes for every seed, whereas the stochastic policy lands in 93 on average; after 300 iterations the gap closes (≈99.8 vs ≈99.7 landings out of 100). We attribute the gap to thrust being encoded as an action probability in a discrete action space. An interactive demo accompanies the text: the reader can train the agent on their own CPU and run the result.
<br><br>
<b>Keywords:</b> reinforcement learning · proximal policy optimization · generalized advantage estimation · in-browser training · evaluation protocol
</div>

## 1. Introduction

Most reinforcement-learning write-ups show results; few let the reader watch the learning happen. Lunar Lander is a good testbed for that: the state is small, the reward is shaped, and a successful policy is visually obvious. This article contributes (i) a JavaScript port of the Lunar Lander observation, action and reward structure, validated against a hand-written controller and a random baseline; (ii) a from-scratch PPO with analytically derived gradients that runs in a Web Worker on the reader's own hardware; (iii) an empirical observation about evaluating discrete-action policies; and (iv) an interactive demo tying them together.

<div class="callout callout-tip">
<div class="callout-title">How to use the demo</div>
1. Press <strong>Run</strong> to watch a random policy crash the lander.<br>
2. Enter a number of <strong>iterations</strong> and press <strong>Train</strong>. Training runs on <em>your</em> CPU; learning curves stream live and, with live preview on, the lander plays the current policy.<br>
3. When training finishes, press <strong>Run</strong> again to watch the trained model land.
</div>

</div>

<div data-lang="tr">

<div class="callout callout-math">
<div class="callout-title">Özet (Abstract)</div>
Lunar Lander kıyas problemi için (8 boyutlu gözlem, dört ayrık eylem, şekillendirilmiş ödül), tamamen okuyucunun tarayıcısında çalışan, bağımlılıksız bir Yakınsal Politika Optimizasyonu (PPO) uygulaması sunuyoruz. 4 996 parametreli aktör ve 4 801 parametreli kritikten oluşan ajan; genelleştirilmiş avantaj tahmini, kırpılmış vekil amaç ve Adam ile, sonlu farklarla doğrulanmış (göreli hata ≈ 10<sup>−9</sup>) elle türetilmiş gradyanlar kullanılarak eğitilir. Altı tohumun hepsinde ajan, yaklaşık 120–200 bin ortam adımında +200 civarı ortalama getiriye ulaşır. Ayrıca bir değerlendirme farkı raporluyoruz: 100 iterasyondan (≈205 bin adım) sonra deterministik argmax politika her tohumda 100 bölümün 0'ında iniyor, stokastik politika ise ortalama 93'ünde; 300 iterasyonda fark kapanıyor (100 bölümde ≈99.8'e karşı ≈99.7 iniş). Farkı, ayrık eylem uzayında itkinin eylem olasılığı olarak kodlanmasına bağlıyoruz. Metne interaktif bir demo eşlik ediyor: okuyucu ajanı kendi işlemcisinde eğitip sonucu çalıştırabilir.
<br><br>
<b>Anahtar sözcükler:</b> pekiştirmeli öğrenme · yakınsal politika optimizasyonu · genelleştirilmiş avantaj tahmini · tarayıcıda eğitim · değerlendirme protokolü
</div>

## 1. Giriş

Pekiştirmeli öğrenme yazılarının çoğu sonuç gösterir; azı okuyucuya öğrenmeyi <i>izletir</i>. Lunar Lander bunun için iyi bir test yatağı: durum küçük, ödül şekillendirilmiş ve başarılı bir politika gözle hemen anlaşılıyor. Bu yazının katkıları: (i) Lunar Lander gözlem, eylem ve ödül yapısının, elle yazılmış bir kontrolcü ve rastgele bir taban çizgisiyle doğrulanmış bir JavaScript portu; (ii) okuyucunun kendi donanımında bir Web Worker içinde çalışan, gradyanları analitik türetilmiş sıfırdan bir PPO; (iii) ayrık eylemli politikaların değerlendirilmesine dair ampirik bir gözlem; (iv) hepsini bağlayan interaktif bir demo.

<div class="callout callout-tip">
<div class="callout-title">Demo nasıl kullanılır</div>
1. <strong>Çalıştır</strong>'a basıp rastgele bir politikanın roketi çakışını izle.<br>
2. Bir <strong>iterasyon sayısı</strong> girip <strong>Eğit</strong>'e bas. Eğitim <em>senin</em> işlemcinde çalışır; öğrenme eğrileri canlı akar ve canlı önizleme açıksa roket politikanın o anki halini oynar.<br>
3. Eğitim bitince tekrar <strong>Çalıştır</strong>'a basıp eğitilmiş modelin inişini izle.
</div>

</div>

<div class="demo-embed">
<iframe data-demo-src="assets/lunar-lander-rl/demo.html" title="Lunar Lander PPO demo"></iframe>
</div>

<div data-lang="en">

<div class="callout callout-code">
<div class="callout-title">Environment note</div>
This is not Gymnasium's LunarLander-v3 itself but a JavaScript port with the same observation (8-D), action (4 discrete) and reward structure; physics uses a rigid body plus spring–damper legs instead of Box2D. As a sanity check, the heuristic controller distributed with Gymnasium (re-implemented here) lands in 199 of 200 episodes with mean return +256, and a uniformly random policy averages −147. Scores are therefore not directly comparable with the original environment.
</div>

### Reading the interface

<table>
<thead><tr><th>Element</th><th>What it shows</th></tr></thead>
<tbody>
<tr><td><strong>Observation vector (8 bars)</strong></td><td>The only thing the agent sees: position, velocity, angle, angular velocity and leg contacts. The policy never sees an image of the lander.</td></tr>
<tr><td><strong>Policy π(a | s)</strong></td><td>The probabilities the network assigns to the four actions in the current state. 25% each for the random policy; the distribution sharpens during training. The chosen action is highlighted.</td></tr>
<tr><td><strong>Mean reward</strong></td><td>Average return over the last 30 episodes. Roughly +200 and above counts as solved.</td></tr>
<tr><td><strong>Landing rate</strong></td><td>Fraction of the last 30 episodes that ended with a genuine, settled landing (+100).</td></tr>
<tr><td><strong>Policy entropy</strong></td><td>How undecided the policy is. ln 4 ≈ 1.39 means uniformly random; it falls as the policy sharpens.</td></tr>
<tr><td><strong>log value loss</strong></td><td>Error of the critic's value estimate (log<sub>10</sub> scale).</td></tr>
<tr><td><strong>Steps / s</strong></td><td>Environment steps your CPU simulates and learns from per second.</td></tr>
</tbody>
</table>

## 2. Problem formulation: a Markov decision process

<p>At each time step <i>t</i> the agent observes a state $s_t$, chooses an action $a_t$, and the environment returns a reward $r_t$ and a new state $s_{t+1}$. The goal is a policy that maximizes the discounted return:</p>

<div class="eq">
$$G_t=\sum_{k=0}^{T-t}\gamma^{k}\,r_{t+k},\qquad J(\theta)=\mathbb{E}_{\tau\sim\pi_\theta}\!\left[G_0\right],\qquad \gamma=0.99$$
</div>

<p>Here $\pi_\theta(a\mid s)$ is a neural network with parameters $\theta$ and $\tau=(s_0,a_0,r_0,s_1,\dots)$ is a trajectory. The observation is:</p>

<table>
<thead><tr><th>Index</th><th>Observation (s)</th><th>Normalization</th></tr></thead>
<tbody>
<tr><td>0, 1</td><td>horizontal / vertical position</td><td>$(x-10)/10$ and $(y-y_\text{pad})/6.67$</td></tr>
<tr><td>2, 3</td><td>horizontal / vertical velocity</td><td>$0.2\,v_x$ and $0.133\,v_y$</td></tr>
<tr><td>4</td><td>body angle $\theta$</td><td>radians</td></tr>
<tr><td>5</td><td>angular velocity $\omega$</td><td>$0.4\,\omega$</td></tr>
<tr><td>6, 7</td><td>left / right leg contact</td><td>0 or 1</td></tr>
</tbody>
</table>

<p>There are four actions: <b>0</b> do nothing, <b>1</b> left side engine (pushes the hull left and rotates it counter-clockwise), <b>2</b> main engine, <b>3</b> right side engine. Because the action space is discrete, the policy is a <i>categorical distribution</i>.</p>

### Reward: shaped, and almost a potential difference

<p>With a sparse "landed / crashed" reward a random agent would receive almost no signal. The original environment therefore adds shaping: approaching the pad, slowing down, staying upright and touching the ground with both legs are rewarded.</p>

<div class="eq">
$$\Phi(s)=-100\sqrt{x^2+y^2}\;-\;100\sqrt{v_x^2+v_y^2}\;-\;100\,|\theta|\;+\;10\,c_L+10\,c_R$$
$$r_t=\Phi(s_{t+1})-\Phi(s_t)\;-\;0.30\cdot\mathbf 1[a_t=2]\;-\;0.03\cdot\mathbf 1[a_t\in\{1,3\}]$$
</div>

<p>At the end of an episode the reward is overridden by <b>−100</b> (crash or leaving the pad area) or <b>+100</b> (resting on both legs for 0.5 s). The first expression telescopes:</p>

<div class="eq">
$$\sum_{t=0}^{T-1}\big(\Phi(s_{t+1})-\Phi(s_t)\big)=\Phi(s_T)-\Phi(s_0)$$
</div>

<p>so the shaping reward depends only on the quality of the start and end states, not on the path taken; burning fuel is still penalized by $-0.30$ per main-engine step. This is the potential-based shaping idea of Ng, Harada and Russell (it preserves the optimal policy for $\gamma\approx1$).</p>

### Physics

<p>The lander is a rigid body integrated with semi-implicit Euler in four substeps per $1/50$ s step. Translational acceleration comes from gravity and the engines:</p>

<div class="eq">
$$\ddot{\mathbf p}=\begin{pmatrix}0\\-g\end{pmatrix}+A_{\text{main}}\begin{pmatrix}-\sin\theta\\ \cos\theta\end{pmatrix}\mathbf 1[a=2]+A_{\text{side}}\,d\begin{pmatrix}\cos\theta\\ \sin\theta\end{pmatrix},\qquad \ddot\theta=-d\,\alpha_{\text{side}}$$
</div>

<p>with $g=10\ \text{m/s}^2$, $A_{\text{main}}=17.4\ \text{m/s}^2$ (1.74 times gravity), $A_{\text{side}}=2.4\ \text{m/s}^2$, $\alpha_{\text{side}}=5.5\ \text{rad/s}^2$, and $d\in\{-1,0,+1\}$ the side-engine direction. Legs are spring–dampers: when a foot penetrates the ground by $\delta$, the normal force and friction are</p>

<div class="eq">
$$F_n=\max\!\big(0,\;k\,\delta-c\,v_n\big),\qquad F_t=\operatorname{clip}\!\big(-c_f\,v_t,\;-\mu F_n,\;\mu F_n\big)$$
</div>

<p>($k=2500$ N/m, $c=80$ N·s/m, $\mu=0.3$). If the hull (not a leg) touches the ground the episode ends as a crash. Soft legs make a hard landing able to drive the hull into the ground, as in the original environment.</p>

## 3. Policy and value networks

<div class="chart-card">
<h4>Two networks: the actor (what should I do?) and the critic (how good is this state?)</h4>
<img src="assets/lunar-lander-rl/architecture-en.svg" alt="Diagram: eight observations feed two separate networks. The upper 64-64-4 actor network produces four action probabilities through a softmax; the lower 64-64-1 critic network produces a single value estimate.">
<p class="chart-caption">Outputs shown for an illustrative state. The actor has 4,996 and the critic 4,801 parameters; they share no weights, so 9,797 numbers are trained in total.</p>
</div>

<p>The actor maps the 8-D observation through two hidden layers to four logits; a softmax turns them into probabilities:</p>

<div class="eq">
$$z=W_3\tanh\!\big(W_2\tanh(W_1 s+b_1)+b_2\big)+b_3,\qquad \pi_\theta(a\mid s)=\frac{e^{z_a}}{\sum_{j=0}^{3}e^{z_j}}$$
</div>

<p>Weights use orthogonal initialization (gain $\sqrt2$ for hidden layers, $0.01$ for the output layer), so initially all logits are $\approx0$ and the policy is almost exactly uniform, $\pi\approx(0.25,0.25,0.25,0.25)$; that is the random policy you see before training. Uncertainty is measured by the <b>entropy</b>:</p>

<div class="eq">
$$H\big(\pi_\theta(\cdot\mid s)\big)=-\sum_{a}\pi_\theta(a\mid s)\,\log\pi_\theta(a\mid s)\ \in[0,\ \ln 4\approx1.386]$$
</div>

<p>The critic maps the same input to a single number, the expected return from that state, $V_\phi(s)\approx\mathbb{E}[G_t\mid s_t=s]$. Why do we need it? See the next section.</p>

## 4. Policy gradient and the advantage

<p>We want to increase $J(\theta)$, an expectation over unknown environment dynamics. The <i>log-derivative trick</i> makes this tractable: $\nabla_\theta\,\mathbb{E}_{x\sim p_\theta}[f(x)]=\mathbb{E}\big[f(x)\,\nabla_\theta\log p_\theta(x)\big]$. The environment terms do not depend on $\theta$ and drop out, leaving only the log-probability of the policy:</p>

<div class="eq">
$$\nabla_\theta J(\theta)=\mathbb{E}\Big[\sum_{t}\nabla_\theta\log\pi_\theta(a_t\mid s_t)\;\hat A_t\Big]$$
</div>

<p>Intuitively: raise the probability of actions that turned out well ($\hat A_t>0$) and lower it for those that turned out badly ($\hat A_t<0$). Instead of the raw return $G_t$ we use the <b>advantage</b> $\hat A_t$, "how much better was this action than the average action in that state?". Subtracting a baseline does not change the expected gradient but sharply reduces its variance; the critic's job is precisely to estimate that baseline, $V_\phi(s)$.</p>

### Generalized advantage estimation (GAE)

<p>The advantage is estimated as an exponentially weighted sum of one-step TD errors:</p>

<div class="eq">
$$\delta_t=r_t+\gamma V_\phi(s_{t+1})-V_\phi(s_t),\qquad \hat A_t=\sum_{l=0}^{\infty}(\gamma\lambda)^{l}\,\delta_{t+l}=\delta_t+\gamma\lambda\,\hat A_{t+1}$$
</div>

<p>$\lambda=0.95$ trades bias for variance: $\lambda=0$ looks one step ahead (low variance, high bias), $\lambda=1$ uses the whole return (no bias, high variance). The recursion lets us fill the buffer in a single backward pass. The critic's regression target is $\hat R_t=\hat A_t+V_\phi(s_t)$. In code:</p>

```js
// Scan each environment's buffer from the end (ppo.js)
for (let t = nSteps - 1; t >= 0; t--) {
  const nonTerm = 1 - done[t];                     // cut the return at episode end
  const nextV   = t === nSteps - 1 ? lastVal : val[t + 1];
  const delta   = rew[t] + gamma * nextV * nonTerm - val[t];   // TD error δ_t
  last = delta + gamma * lambda * nonTerm * last;              // Â_t = δ_t + γλ Â_{t+1}
  adv[t] = last;
  ret[t] = last + val[t];                                      // R̂_t
}
```

## 5. Proximal Policy Optimization

<p>Plain policy gradient has a trap: taking several steps on the same batch moves the policy away from the one that collected the data, invalidating the estimates. <b>PPO</b> bounds the probability ratio between the new and old policy:</p>

<div class="eq">
$$\rho_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{\theta_\text{old}}(a_t\mid s_t)},\qquad L^{\text{CLIP}}(\theta)=\mathbb{E}\Big[\min\!\big(\rho_t\hat A_t,\ \operatorname{clip}(\rho_t,\,1-\epsilon,\,1+\epsilon)\,\hat A_t\big)\Big],\quad \epsilon=0.2$$
</div>

<div class="chart-card">
<h4>Why is the clipped objective "safe"?</h4>
<img src="assets/lunar-lander-rl/clip-objective-en.svg" alt="Two-panel plot. Left: for a positive advantage the objective rises until the ratio reaches 1.2 and then flattens. Right: for a negative advantage it flattens below a ratio of 0.8. Flat regions have zero gradient.">
<p class="chart-caption"><b>Left:</b> if an action was good we raise its probability, but once the ratio passes $1+\epsilon$ the objective is flat: zero gradient, no point pushing further. <b>Right:</b> if an action was bad we lower its probability and the gradient is cut once the ratio falls below $1-\epsilon$. Either way the policy cannot leave the old policy's trust region by much.</p>
</div>

<p>This lets us reuse the same 2048 samples for <b>4 epochs</b> in mini-batches of 128 (64 gradient steps per iteration), which would not be safe with plain policy gradient.</p>

### Total loss and hand-written gradients

<p>A single loss is trained, with three parts: policy, value, and an entropy (exploration) term:</p>

<div class="eq">
$$L(\theta,\phi)=-L^{\text{CLIP}}\;+\;c_v\cdot\tfrac12\big(V_\phi(s_t)-\hat R_t\big)^2\;-\;c_e\cdot H\big(\pi_\theta(\cdot\mid s_t)\big),\qquad c_v=0.5,\ c_e=0.01$$
</div>

<p>The <b>entropy bonus</b> discourages the policy from collapsing onto one action too early. Gradients with respect to the output logits have closed forms (no automatic differentiation is used):</p>

<div class="eq">
$$\frac{\partial\log\pi_a}{\partial z_j}=\mathbf 1[j=a]-\pi_j,\qquad \frac{\partial H}{\partial z_j}=-\pi_j\big(\log\pi_j+H\big),\qquad \frac{\partial L^{\text{CLIP}}}{\partial z_j}=\begin{cases}\rho_t\hat A_t\,\big(\mathbf 1[j=a]-\pi_j\big)&\text{unclipped branch}\\ 0&\text{clipped branch}\end{cases}$$
</div>

```js
// Gradient of the policy loss w.r.t. the logits (ppo.js, update())
const dLogp = useClip ? 0 : -A * ratio;                // no gradient when clipped
for (let j = 0; j < nA; j++) {
  const p = probs[j];
  const dlogp_dz = (j === a ? 1 : 0) - p;              // ∂log π_a / ∂z_j
  const dEnt = entCoef * p * (Math.log(p) + entropy);  // −c_e · ∂H/∂z_j
  dOutA[n * nA + j] = (dLogp * dlogp_dz + dEnt) / B;
}
```

## 6. Backpropagation and Adam

<p>The logit gradients are propagated into the network with the chain rule. Since $\tanh'=1-\tanh^2$, the error signal and weight gradient of hidden layer $l$ are:</p>

<div class="eq">
$$\delta^{(l)}=\big(W^{(l+1)\top}\delta^{(l+1)}\big)\odot\big(1-h^{(l)}\odot h^{(l)}\big),\qquad \nabla_{W^{(l)}}L=\delta^{(l)}\,h^{(l-1)\top},\qquad \nabla_{b^{(l)}}L=\delta^{(l)}$$
</div>

<p>I verified the hand-written backward pass against finite differences: relative error $\sim10^{-9}$. Parameters are updated with <b>Adam</b>, which keeps exponential averages of the first and second moments of each gradient:</p>

<div class="eq">
$$m_t=\beta_1 m_{t-1}+(1-\beta_1)g_t,\quad v_t=\beta_2 v_{t-1}+(1-\beta_2)g_t^2,\quad \theta\leftarrow\theta-\eta\,\frac{m_t/(1-\beta_1^t)}{\sqrt{v_t/(1-\beta_2^t)}+\varepsilon}$$
</div>

<p>In addition, if the global gradient norm exceeds $0.5$ the whole gradient is rescaled ($g\leftarrow g\cdot\min(1,\,0.5/\lVert g\rVert)$), and the learning rate starts at $\eta=3\times10^{-4}$ and decays linearly to 10% over the run.</p>

## 7. Training procedure

<div class="chart-card">
<h4>The PPO loop: collect → compute advantages → update</h4>
<img src="assets/lunar-lander-rl/ppo-loop-en.svg" alt="Six-box loop: environment, policy, buffer, advantage computation (GAE), PPO update and new parameters, which feed back into the policy.">
<p class="chart-caption">The “iterations” input in the demo sets how many times this loop runs. Each turn is about 2048 new simulation steps and 64 gradient steps.</p>
</div>

<table>
<thead><tr><th>Hyperparameter</th><th>Value</th><th>Hyperparameter</th><th>Value</th></tr></thead>
<tbody>
<tr><td>Parallel environments</td><td>8</td><td>Discount $\gamma$</td><td>0.99</td></tr>
<tr><td>Steps / env / iteration</td><td>256 (2048 total)</td><td>GAE $\lambda$</td><td>0.95</td></tr>
<tr><td>Epochs</td><td>4</td><td>Clip $\epsilon$</td><td>0.2</td></tr>
<tr><td>Mini-batch</td><td>128</td><td>Value / entropy coefficient</td><td>0.5 / 0.01</td></tr>
<tr><td>Learning rate</td><td>$3\times10^{-4}\to3\times10^{-5}$</td><td>Gradient clipping</td><td>0.5 (global norm)</td></tr>
<tr><td>Networks</td><td>8–64–64–{4 | 1}, tanh</td><td>Optimizer</td><td>Adam ($\varepsilon=10^{-5}$)</td></tr>
</tbody>
</table>

## 8. Results: learning dynamics and an evaluation gap

<p>On the author's machine one iteration takes about 0.4 s (≈5 k steps/s). Over three seeds, the mean return in the first iteration is between −200 and −300 (random policy); it turns positive within 20–40 iterations (≈40–80 k steps) and settles around +200 by 60–100 iterations (≈120–200 k steps). Exact numbers vary with the seed, so your own curve in the demo is the better evidence.</p>

<p>One thing surprised me: at the end of training, running the model <b>deterministically</b> (most probable action, <code>argmax</code>) can fail badly for short runs, while the same model <b>sampling</b> from π lands almost every time. Seeds 1–6 were fixed in advance, before looking at results; each cell is 100 evaluation episodes (<i>landings · mean return</i>):</p>

<table>
<thead><tr><th>Seed</th><th>100 it. · stochastic</th><th>100 it. · argmax</th><th>300 it. · stochastic</th><th>300 it. · argmax</th></tr></thead>
<tbody>
<tr><td>1</td><td>88 · +197</td><td>0 · −3430</td><td>100 · +227</td><td>100 · +205</td></tr>
<tr><td>2</td><td>96 · +223</td><td>0 · −3947</td><td>100 · +236</td><td>100 · +226</td></tr>
<tr><td>3</td><td>89 · +190</td><td>0 · −1462</td><td>100 · +232</td><td>100 · +215</td></tr>
<tr><td>4</td><td>91 · +198</td><td>0 · −910</td><td>98 · +229</td><td>99 · +212</td></tr>
<tr><td>5</td><td>94 · +220</td><td>0 · −5079</td><td>100 · +233</td><td>100 · +217</td></tr>
<tr><td>6</td><td>98 · +243</td><td>0 · −1569</td><td>100 · +231</td><td>100 · +218</td></tr>
<tr><td><b>Mean</b></td><td><b>92.7 · +212</b></td><td><b>0 · −2733</b></td><td><b>99.7 · +231</b></td><td><b>99.8 · +216</b></td></tr>
</tbody>
</table>

<p>Rather than guess at the cause I measured the behaviour. After 100 iterations the <code>argmax</code> policy <b>never lands</b> for any of the six seeds: 79–100% of episodes end by flying out of the pad area, the rest time out hovering. It fires the main engine in <b>76–98%</b> of steps, versus only 25–31% for the sampling policy. The mechanism:</p>

<ul>
<li>A discrete action space has no "half thrust". The policy encodes the average thrust it wants as a <b>probability</b>: if $P(\text{main})\approx0.3$ it fires about 30% of the time and gets about 0.3 × thrust (a form of pulse-width modulation).</li>
<li><code>argmax</code> rounds that probability to <i>0 or 1</i>: with $\pi(\text{main})=0.38$ and the other three actions at 0.2 each, the most probable action is always "main engine", and the lander climbs with several times the thrust it wanted and drifts sideways.</li>
<li>The drifting lander enters states never seen in training; the policy there is nearly uniform (mean <i>maximum probability</i> per step along argmax runs is only 0.28–0.38, versus 0.55–0.60 along sampled trajectories) and the error compounds.</li>
</ul>

<p>After 300 iterations the policy has sharpened (mean maximum probability along sampled trajectories 0.64–0.67), thrust is delivered more through <i>state-dependent decisive choices</i>, and the two modes converge (argmax main-engine share 45–48%, sampling 36–42%). Lesson: "deterministic evaluation is always better" is a misleading assumption for discrete-action, briefly-trained policies. Try it yourself with the <b>Deterministic (argmax)</b> checkbox: train 100 iterations, then toggle it.</p>

## 9. Limitations

- **Similar, not identical, environment.** Simple physics instead of Box2D and no engine dispersion noise. Do not compare scores with published LunarLander-v3 numbers.
- **Measured under specific conditions:** Node.js, six seeds (1–6), 100 evaluation episodes per seed, the same environment port. This is an indication of a behaviour, not a statistical benchmark.
- **Toy scale.** Small networks (≈9.8 k parameters), one thread, one machine. The goal is to expose every line of the algorithm, not speed.
- **Relation to the Python project.** I first ran the same idea on the desktop with `gymnasium` + Stable-Baselines3 PPO (a 300 k-step baseline). There is no SB3 here; the whole PPO is dependency-free JavaScript.
- **Training lives on your device.** Closing the tab stops it. The finished model is kept in the browser's `localStorage`; “Continue from current model” resumes it.

## Reproducibility and source code

Everything is in this site's repository, as plain JavaScript with no build step:

- [lander-env.js](assets/lunar-lander-rl/lander-env.js): physics, observation and reward (Gymnasium port)
- [ppo.js](assets/lunar-lander-rl/ppo.js): MLP, backpropagation, Adam, GAE, PPO
- [train-worker.js](assets/lunar-lander-rl/train-worker.js): runs training in a background Web Worker
- [demo.js](assets/lunar-lander-rl/demo.js): interface, rendering, live charts

## References

- Schulman, J. et al. [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) (2017).
- Schulman, J. et al. [High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) (2015).
- Kingma, D. P. & Ba, J. [Adam: A Method for Stochastic Optimization](https://arxiv.org/abs/1412.6980) (2014).
- Ng, A. Y., Harada, D., & Russell, S. Policy invariance under reward transformations: Theory and application to reward shaping. ICML (1999).
- [Gymnasium: Lunar Lander](https://gymnasium.farama.org/environments/box2d/lunar_lander/), environment documentation.
- [Stable-Baselines3](https://stable-baselines3.readthedocs.io/), the PPO implementation used in the desktop version.

</div>

<div data-lang="tr">

<div class="callout callout-code">
<div class="callout-title">Ortam notu</div>
Bu, Gymnasium'un LunarLander-v3'ünün kendisi değil; aynı gözlem (8 boyut), eylem (4 ayrık) ve ödül yapısına sahip bir JavaScript portu. Fizik, Box2D yerine rijit cisim + yay-sönümleyici bacak modeliyle yazıldı. Sağlama olarak, Gymnasium ile gelen heuristic kontrolcü (burada yeniden yazıldı) 200 bölümün 199'unda iniyor (ortalama getiri +256), düzgün rastgele politika ise ortalama −147 alıyor. Dolayısıyla skorlar orijinal ortamla birebir kıyaslanamaz.
</div>

### Arayüzü nasıl okumalı

<table>
<thead><tr><th>Öğe</th><th>Neyi gösteriyor</th></tr></thead>
<tbody>
<tr><td><strong>Gözlem vektörü (8 çubuk)</strong></td><td>Ajanın gördüğü tek şey: konum, hız, açı, açısal hız ve bacak teması. Politika roketin "resmini" görmez.</td></tr>
<tr><td><strong>Politika π(a | s)</strong></td><td>Ağın o anki durumda 4 eylem için verdiği olasılıklar. Rastgele politikada hepsi %25; eğitim ilerledikçe dağılım keskinleşir. Seçilen eylem vurgulanır.</td></tr>
<tr><td><strong>Ortalama ödül</strong></td><td>Son 30 bölümün ortalama getirisi. Yaklaşık +200 üstü "çözüldü" sayılır.</td></tr>
<tr><td><strong>İniş başarısı</strong></td><td>Son 30 bölümün yüzde kaçı gerçekten durarak inmeyle (+100) bitti.</td></tr>
<tr><td><strong>Politika entropisi</strong></td><td>Politikanın ne kadar "kararsız" olduğu. ln 4 ≈ 1.39 tam rastgele demek; politika keskinleştikçe düşer.</td></tr>
<tr><td><strong>log değer kaybı</strong></td><td>Kritik ağın değer tahmini hatası (log<sub>10</sub> ölçeğinde).</td></tr>
<tr><td><strong>Adım / sn</strong></td><td>İşlemcinin saniyede kaç simülasyon adımı üretip öğrendiği.</td></tr>
</tbody>
</table>

## 2. Problem formülasyonu: bir Markov karar süreci

<p>Her <i>t</i> adımında ajan bir durum $s_t$ gözlemler, bir eylem $a_t$ seçer; ortam bir ödül $r_t$ ve yeni durum $s_{t+1}$ döndürür. Amaç, iskontolu getiriyi en büyük yapan politikayı bulmaktır:</p>

<div class="eq">
$$G_t=\sum_{k=0}^{T-t}\gamma^{k}\,r_{t+k},\qquad J(\theta)=\mathbb{E}_{\tau\sim\pi_\theta}\!\left[G_0\right],\qquad \gamma=0.99$$
</div>

<p>Burada $\pi_\theta(a\mid s)$ parametreleri $\theta$ olan bir sinir ağıdır ve $\tau=(s_0,a_0,r_0,s_1,\dots)$ bir yörüngedir. Gözlem şöyle:</p>

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

<p>Dört eylem var: <b>0</b> hiçbir şey, <b>1</b> sol yan motor (gövdeyi sola iter ve saat yönünün tersine döndürür), <b>2</b> ana motor, <b>3</b> sağ yan motor. Eylem uzayı ayrık olduğu için politika bir <i>kategorik dağılımdır</i>.</p>

### Ödül: şekillendirilmiş ve neredeyse bir potansiyel fark

<p>Ödül yalnızca "indi / çakıldı" olsaydı, rastgele bir ajan neredeyse hiç sinyal alamazdı. Orijinal ortam bu yüzden ara ödül verir: pist merkezine yaklaşmak, yavaşlamak, dik durmak ve iki bacağı yere değdirmek ödüllendirilir.</p>

<div class="eq">
$$\Phi(s)=-100\sqrt{x^2+y^2}\;-\;100\sqrt{v_x^2+v_y^2}\;-\;100\,|\theta|\;+\;10\,c_L+10\,c_R$$
$$r_t=\Phi(s_{t+1})-\Phi(s_t)\;-\;0.30\cdot\mathbf 1[a_t=2]\;-\;0.03\cdot\mathbf 1[a_t\in\{1,3\}]$$
</div>

<p>Bölüm sonunda ödül <b>−100</b> (çakıldı ya da pist dışına çıktı) veya <b>+100</b> (iki bacak üstünde 0.5 saniye hareketsiz kaldı) ile değiştirilir. İlk ifade teleskopiktir:</p>

<div class="eq">
$$\sum_{t=0}^{T-1}\big(\Phi(s_{t+1})-\Phi(s_t)\big)=\Phi(s_T)-\Phi(s_0)$$
</div>

<p>yani şekillendirme ödülünün toplamı yalnızca başlangıç ve son durumun kalitesine bağlıdır, izlenen yola değil; ana motoru gereksiz yakmak yine adım başına $-0.30$ ile cezalandırılır. Bu, Ng, Harada ve Russell'ın potansiyel-tabanlı şekillendirme fikridir ($\gamma\approx1$ için optimal politikayı korur).</p>

### Fizik

<p>Roket bir rijit cisim; her $1/50$ s'lik adım 4 alt adımda yarı-örtük Euler ile entegre edilir. Öteleme ivmesi yer çekimi ve motorlardan gelir:</p>

<div class="eq">
$$\ddot{\mathbf p}=\begin{pmatrix}0\\-g\end{pmatrix}+A_{\text{main}}\begin{pmatrix}-\sin\theta\\ \cos\theta\end{pmatrix}\mathbf 1[a=2]+A_{\text{side}}\,d\begin{pmatrix}\cos\theta\\ \sin\theta\end{pmatrix},\qquad \ddot\theta=-d\,\alpha_{\text{side}}$$
</div>

<p>Burada $g=10\ \text{m/s}^2$, $A_{\text{main}}=17.4\ \text{m/s}^2$ (yer çekiminin 1.74 katı), $A_{\text{side}}=2.4\ \text{m/s}^2$, $\alpha_{\text{side}}=5.5\ \text{rad/s}^2$ ve $d\in\{-1,0,+1\}$ yan motorun yönüdür. Bacaklar yay-sönümleyici olarak modellenir: ayak ucu zemine $\delta$ kadar girdiğinde normal kuvvet ve sürtünme</p>

<div class="eq">
$$F_n=\max\!\big(0,\;k\,\delta-c\,v_n\big),\qquad F_t=\operatorname{clip}\!\big(-c_f\,v_t,\;-\mu F_n,\;\mu F_n\big)$$
</div>

<p>ile hesaplanır ($k=2500$ N/m, $c=80$ N·s/m, $\mu=0.3$). Gövde (bacaklar değil) zemine değerse bölüm "çakıldı" ile biter. Yumuşak bacaklar, sert inişte gövdenin yere vurmasını mümkün kılar; orijinal ortamdaki gibi.</p>

## 3. Politika ve değer ağları

<div class="chart-card">
<h4>İki ağ: aktör (ne yapayım?) ve kritik (bu durum ne kadar iyi?)</h4>
<img src="assets/lunar-lander-rl/architecture.svg" alt="Sekiz gözlemin iki ayrı ağa girdiği şema: üstte 64-64-4 aktör ağı softmax ile dört eylem olasılığı üretir, altta 64-64-1 kritik ağı tek bir değer tahmini üretir.">
<p class="chart-caption">Çıktılar açıklayıcı bir durum için gösterilmiştir. Aktör 4 996, kritik 4 801 parametreye sahip; ikisi ağırlık paylaşmaz, toplam 9 797 sayı eğitilir.</p>
</div>

<p>Aktör, 8 boyutlu gözlemi iki gizli katmandan geçirip 4 "logit" üretir; softmax bunları olasılığa çevirir:</p>

<div class="eq">
$$z=W_3\tanh\!\big(W_2\tanh(W_1 s+b_1)+b_2\big)+b_3,\qquad \pi_\theta(a\mid s)=\frac{e^{z_a}}{\sum_{j=0}^{3}e^{z_j}}$$
</div>

<p>Ağırlıklar ortogonal başlatılır (gizli katmanlarda kazanç $\sqrt2$, çıkış katmanında $0.01$); bu yüzden başlangıçta tüm logit'ler $\approx0$ ve politika neredeyse tam düzgün dağılımdır, $\pi\approx(0.25,0.25,0.25,0.25)$: eğitimden önce gördüğün rastgele politika budur. Belirsizliği <b>entropi</b> ölçer:</p>

<div class="eq">
$$H\big(\pi_\theta(\cdot\mid s)\big)=-\sum_{a}\pi_\theta(a\mid s)\,\log\pi_\theta(a\mid s)\ \in[0,\ \ln 4\approx1.386]$$
</div>

<p>Kritik ağı ise aynı girdiden tek bir sayı üretir: o durumdan itibaren beklenen getiri, $V_\phi(s)\approx\mathbb{E}[G_t\mid s_t=s]$. Neden ona ihtiyacımız var? Cevap bir sonraki bölümde.</p>

## 4. Politika gradyanı ve avantaj

<p>Amacımız, bilinmeyen ortam dinamiklerini içeren bir beklenti olan $J(\theta)$'yı artırmak. <i>Log-türev hilesi</i> bunu çözülebilir yapar: $\nabla_\theta\,\mathbb{E}_{x\sim p_\theta}[f(x)]=\mathbb{E}\big[f(x)\,\nabla_\theta\log p_\theta(x)\big]$. Ortam terimleri $\theta$'ya bağlı olmadığı için düşer, geriye yalnızca politikanın log-olasılığı kalır:</p>

<div class="eq">
$$\nabla_\theta J(\theta)=\mathbb{E}\Big[\sum_{t}\nabla_\theta\log\pi_\theta(a_t\mid s_t)\;\hat A_t\Big]$$
</div>

<p>Sezgi: iyi çıkan eylemin ($\hat A_t>0$) olasılığını artır, kötü çıkanın ($\hat A_t<0$) azalt. Ham getiri $G_t$ yerine <b>avantaj</b> $\hat A_t$ kullanırız: "bu eylem, o durumdaki ortalama eylemden ne kadar iyiydi?". Bir baseline çıkarmak beklenen gradyanı değiştirmez ama varyansı büyük ölçüde düşürür; kritik ağın görevi tam olarak bu baseline'ı, $V_\phi(s)$'yi, tahmin etmektir.</p>

### Genelleştirilmiş avantaj tahmini (GAE)

<p>Avantaj, tek adımlı TD hatalarının üstel ağırlıklı toplamı olarak tahmin edilir:</p>

<div class="eq">
$$\delta_t=r_t+\gamma V_\phi(s_{t+1})-V_\phi(s_t),\qquad \hat A_t=\sum_{l=0}^{\infty}(\gamma\lambda)^{l}\,\delta_{t+l}=\delta_t+\gamma\lambda\,\hat A_{t+1}$$
</div>

<p>$\lambda=0.95$ bias–varyans takasını ayarlar: $\lambda=0$ yalnızca bir adım bakar (düşük varyans, yüksek bias), $\lambda=1$ tüm getiriyi kullanır (bias yok, yüksek varyans). Özyineleme, tamponu sondan başa tek geçişte doldurmamızı sağlar. Kritik ağın regresyon hedefi $\hat R_t=\hat A_t+V_\phi(s_t)$'dir. Kodda:</p>

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

## 5. Yakınsal Politika Optimizasyonu (PPO)

<p>Düz politika gradyanının büyük bir tuzağı var: aynı veriyle birden çok adım atarsak politika, veriyi toplayan politikadan uzaklaşır ve tahminler geçersizleşir. <b>PPO</b> bunu, yeni ve eski politikanın olasılık oranını sınırlayarak çözer:</p>

<div class="eq">
$$\rho_t(\theta)=\frac{\pi_\theta(a_t\mid s_t)}{\pi_{\theta_\text{eski}}(a_t\mid s_t)},\qquad L^{\text{CLIP}}(\theta)=\mathbb{E}\Big[\min\!\big(\rho_t\hat A_t,\ \operatorname{clip}(\rho_t,\,1-\epsilon,\,1+\epsilon)\,\hat A_t\big)\Big],\quad \epsilon=0.2$$
</div>

<div class="chart-card">
<h4>Kırpılmış amaç fonksiyonu neden "güvenli"?</h4>
<img src="assets/lunar-lander-rl/clip-objective.svg" alt="İki panelli grafik. Solda Â pozitifken amaç oran 1.2'ye kadar artar, sonra düzleşir; sağda Â negatifken amaç oran 0.8'in altında düzleşir. Düzleşen bölgelerde gradyan sıfırdır.">
<p class="chart-caption"><b>Sol:</b> eylem iyiydiyse olasılığını artırırız, ama oran $1+\epsilon$'u geçince amaç düzleşir: gradyan sıfır, daha fazla zorlamanın anlamı yok. <b>Sağ:</b> eylem kötüydüyse olasılığını azaltırız, oran $1-\epsilon$'un altına inince gradyan kesilir. İkisinde de politika, eski politikanın güven bölgesinden fazla uzaklaşamaz.</p>
</div>

<p>Bu sayede aynı 2048 örneği <b>4 epoch</b> boyunca, 128'lik mini-batch'lerle tekrar kullanabiliyoruz (iterasyon başına 64 gradyan adımı); düz politika gradyanında bu güvenle yapılamazdı.</p>

### Toplam kayıp ve elle yazılmış gradyanlar

<p>Eğitilen tek bir kayıp var; üç parçadan oluşuyor: politika, değer ve entropi (keşif) terimi:</p>

<div class="eq">
$$L(\theta,\phi)=-L^{\text{CLIP}}\;+\;c_v\cdot\tfrac12\big(V_\phi(s_t)-\hat R_t\big)^2\;-\;c_e\cdot H\big(\pi_\theta(\cdot\mid s_t)\big),\qquad c_v=0.5,\ c_e=0.01$$
</div>

<p><b>Entropi bonusu</b>, politikanın erkenden tek bir eyleme kilitlenmesini engeller. Çıkıştaki logit'lere göre gradyanlar kapalı formda yazılabilir (otomatik türev kullanılmıyor):</p>

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

## 6. Geri yayılım ve Adam

<p>Logit gradyanlarını ağın içine, zincir kuralıyla geri taşırız. $\tanh$ türevi $1-\tanh^2$ olduğu için, gizli katman $l$'nin hata sinyali ve ağırlık gradyanı:</p>

<div class="eq">
$$\delta^{(l)}=\big(W^{(l+1)\top}\delta^{(l+1)}\big)\odot\big(1-h^{(l)}\odot h^{(l)}\big),\qquad \nabla_{W^{(l)}}L=\delta^{(l)}\,h^{(l-1)\top},\qquad \nabla_{b^{(l)}}L=\delta^{(l)}$$
</div>

<p>Elle yazılmış geri yayılımı sonlu farklarla doğruladım: göreli hata $\sim10^{-9}$. Parametreleri güncelleyen optimizer <b>Adam</b>'dır; her gradyanın birinci ve ikinci moment'inin üstel ortalamalarını tutar:</p>

<div class="eq">
$$m_t=\beta_1 m_{t-1}+(1-\beta_1)g_t,\quad v_t=\beta_2 v_{t-1}+(1-\beta_2)g_t^2,\quad \theta\leftarrow\theta-\eta\,\frac{m_t/(1-\beta_1^t)}{\sqrt{v_t/(1-\beta_2^t)}+\varepsilon}$$
</div>

<p>Üstüne, global gradyan normu $0.5$'i geçerse tüm gradyan yeniden ölçeklenir ($g\leftarrow g\cdot\min(1,\,0.5/\lVert g\rVert)$) ve öğrenme hızı $\eta=3\times10^{-4}$'ten başlayıp koşu boyunca doğrusal olarak %10'una iner.</p>

## 7. Eğitim prosedürü

<div class="chart-card">
<h4>PPO döngüsü: topla → avantajı hesapla → güncelle</h4>
<img src="assets/lunar-lander-rl/ppo-loop.svg" alt="Altı kutulu döngü: ortam, politika, tampon, avantaj hesabı (GAE), PPO güncellemesi ve yeni parametreler; yeni parametreler tekrar politikaya döner.">
<p class="chart-caption">Demodaki "iterasyon sayısı", bu döngünün kaç kez döneceğini belirler. Her tur yaklaşık 2048 yeni simülasyon adımı ve 64 gradyan adımı demek.</p>
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

## 8. Sonuçlar: öğrenme dinamikleri ve bir değerlendirme farkı

<p>Yazarın makinesinde bir iterasyon yaklaşık 0.4 saniye sürüyor (≈5 bin adım/sn). Üç tohumda ilk iterasyonda ortalama getiri −200 ile −300 arasında (rastgele politika); 20–40 iterasyonda (≈40–80 bin adım) pozitife geçiyor ve 60–100 iterasyonda (≈120–200 bin adım) +200 civarına yerleşiyor. Tam sayılar tohuma göre değişir; bu yüzden demodaki kendi eğrin daha değerli bir kanıt.</p>

<p>Beni şaşırtan bir şey oldu: eğitimin sonunda modeli <b>deterministik</b> (en olası eylem, <code>argmax</code>) çalıştırınca, kısa koşularda sonuç felaket olabiliyor; oysa aynı model π'den <b>örnekleyerek</b> neredeyse her seferinde iniyor. Tohumları (1–6) sonuçlara bakmadan önce sabitledim; her hücre 100 değerlendirme bölümü (<i>iniş sayısı · ortalama getiri</i>):</p>

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

<p>Sebebini tahmin etmek yerine politikaların davranışını ölçtüm. 100 iterasyonda <code>argmax</code> politika altı tohumun hepsinde <b>hiç inemiyor</b>: bölümlerin %79–100'ü pist dışına uçarak bitiyor, kalanı havada asılı kalıp zaman aşımına uğruyor. Ana motoru adımların <b>%76–98</b>'inde ateşliyor; örnekleyen politika ise yalnızca %25–31'inde. Mekanizma şu:</p>

<ul>
<li>Ayrık eylem uzayında "yarım itki" diye bir şey yok. Politika, istediği ortalama itkiyi <b>olasılıkla</b> kodluyor: $P(\text{ana})\approx0.3$ ise zamanın %30'unda ateşleyerek yaklaşık 0.3 × itki elde ediyor (bir tür darbe-genişlik modülasyonu).</li>
<li><code>argmax</code> bu olasılığı <i>0 ya da 1</i>'e yuvarlıyor: $\pi(\text{ana})=0.38$ ama diğer üç eylem 0.2'şer ise en olası eylem hep "ana motor"; roket istediğinin birkaç katı itkiyle yükseliyor ve yana savruluyor.</li>
<li>Savrulan roket, eğitimde hiç görmediği durumlara giriyor; politika orada neredeyse düzgün dağılıma düşüyor (argmax koşularında adım başına ortalama <i>en yüksek olasılık</i> yalnızca 0.28–0.38; örneklenen yörüngelerde 0.55–0.60) ve hata katlanarak büyüyor.</li>
</ul>

<p>300 iterasyonda politika keskinleşiyor (örneklenen yörüngede ortalama en yüksek olasılık 0.64–0.67), itkiyi artık daha çok <i>durum bazında kararlı seçimlerle</i> veriyor ve iki mod birbirine yaklaşıyor (argmax'ın ana motor payı %45–48, örneklemeninki %36–42). Ders: "deterministik değerlendirme her zaman daha iyi" varsayımı, ayrık eylemli ve kısa eğitilmiş politikalarda yanıltıcı olabilir. Arayüzdeki <b>Deterministik (argmax)</b> kutusuyla kendin deneyebilirsin: 100 iterasyon eğit, sonra kutuyu aç-kapa.</p>

## 9. Sınırlamalar

- **Ortam benzer, aynı değil.** Box2D yerine sade fizik; motor dispersiyon gürültüsü yok. Skorları yayımlanmış LunarLander-v3 sayılarıyla kıyaslama.
- **Sayılar belirli koşullarda ölçüldü:** Node.js, altı tohum (1–6), tohum başına 100 değerlendirme bölümü, aynı ortam portu. Bu bir istatistiksel benchmark değil, bir davranışın göstergesi.
- **Oyuncak ölçek.** Küçük ağlar (≈9.8 bin parametre), tek iş parçacığı, tek makine. Amaç hız rekoru değil, algoritmanın her satırını görünür kılmak.
- **Python projesiyle ilişki.** Aynı fikri önce masaüstünde `gymnasium` + Stable-Baselines3 PPO ile çalıştırmıştım (300 bin adımlık baseline). Burada SB3 yok; PPO'nun tamamı bağımlılıksız JavaScript.
- **Eğitim senin cihazında.** Sekmeyi kapatırsan durur. Biten model tarayıcının `localStorage`'ında saklanır; "Mevcut modelden devam et" ile sürdürülebilir.

## Tekrarlanabilirlik ve kaynak kod

Hepsi bu sitenin deposunda, derleme adımı olmadan çalışan düz JavaScript:

- [lander-env.js](assets/lunar-lander-rl/lander-env.js): fizik, gözlem ve ödül (Gymnasium portu)
- [ppo.js](assets/lunar-lander-rl/ppo.js): MLP, geri yayılım, Adam, GAE, PPO
- [train-worker.js](assets/lunar-lander-rl/train-worker.js): eğitimi arka planda (Web Worker) çalıştırır
- [demo.js](assets/lunar-lander-rl/demo.js): arayüz, çizim, canlı grafikler

## Kaynakça

- Schulman, J. ve ark. [Proximal Policy Optimization Algorithms](https://arxiv.org/abs/1707.06347) (2017).
- Schulman, J. ve ark. [High-Dimensional Continuous Control Using Generalized Advantage Estimation](https://arxiv.org/abs/1506.02438) (2015).
- Kingma, D. P. & Ba, J. [Adam: A Method for Stochastic Optimization](https://arxiv.org/abs/1412.6980) (2014).
- Ng, A. Y., Harada, D., & Russell, S. Policy invariance under reward transformations: Theory and application to reward shaping. ICML (1999).
- [Gymnasium: Lunar Lander](https://gymnasium.farama.org/environments/box2d/lunar_lander/), ortam dokümantasyonu.
- [Stable-Baselines3](https://stable-baselines3.readthedocs.io/), masaüstü sürümde kullandığım PPO uygulaması.

</div>
