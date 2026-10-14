(function () {
  "use strict";

  const L = LanderLib, P = PPOLib;
  const STORE = "lunarlander-ppo-v2";
  const LANG_STORE = "ll-lang";
  const $ = (id) => document.getElementById(id);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  // ------------------------------------------------------------------ çeviri (varsayılan: İngilizce)
  const I18N = {
    en: {
      title: "Lunar Lander — PPO in the Browser",
      simulation: "Simulation", trainingH: "Training", trainingSub: "(PPO · on your CPU)",
      hudSteps: "Step", hudScore: "Episode score", hudHist: "Recent episodes",
      run: "▶ Run", terrain: "⟳ New terrain", terrainTitle: "New random terrain and initial velocity",
      modeRandom: "Random", modeTrained: "Trained model",
      loop: "Auto-repeat", det: "Deterministic (argmax)",
      detTitle: "On: always take the most probable action (argmax). Off: sample from π(a|s).",
      tip: "Tip: after short training runs, <b>argmax</b> can be much worse than sampling (the policy sets thrust through probabilistic “pulses”). The reason is explained in the article below.",
      obsTitle: "Observation vector s (8 sensors)",
      obs: ["x position", "y position", "x velocity", "y velocity", "angle", "angular vel.", "left leg", "right leg"],
      contact: "contact",
      polTitle: "Policy π(a | s)",
      acts: ["Noop", "Push left", "Main engine", "Push right"],
      hintRandom: "Random policy: all four actions are equally likely (π = 0.25).",
      hintDet: "Deterministic: the most probable action is taken.",
      hintSample: "Stochastic: the action is sampled from this distribution (chosen action highlighted).",
      badgeRandom: "Random policy", badgeTraining: "Training…", badgeDet: "Trained · argmax", badgeSample: "Trained · stochastic",
      cores: "{n}-core CPU",
      iterations: "Iterations", train: "⚡ Train", stop: "■ Stop", reset: "Reset model", resetTitle: "Delete the saved model and charts",
      chip50: "50 · fast", chip150: "150 · balanced", chip300: "300 · robust", chip600: "600 · long",
      preview: "Live preview while training", cont: "Continue from current model",
      stepsHint: "1 iteration = 2048 steps from 8 parallel environments + 4 PPO epochs. <b>{n} iterations ≈ {k}k steps.</b>",
      stIter: "Iteration", stSteps: "Total steps", stSps: "Steps / s", stTime: "Elapsed", stEta: "Remaining (est.)", stSucc: "Landing rate",
      chReward: "Mean reward", chSucc: "Landing rate %", chEnt: "Policy entropy H(π)", chVl: "log₁₀ value loss",
      solved: "solved ≈ 200", randomRef: "ln 4 (random)",
      empty: "Charts fill in live when you press “Train”.",
      note: "All computation runs <b>in your browser</b> inside a Web Worker; nothing is sent to a server. This is a lightweight JavaScript port of Gymnasium <b>LunarLander-v3</b> (same observation, action and reward structure); it uses a simple physics engine instead of Box2D, so scores are not directly comparable.",
      landed: "LANDED  ✓", crashed: "CRASHED  ✗", oob: "OUT OF BOUNDS  ✗", timeout: "TIME LIMIT (1000 steps)", score: "score",
      histFmt: "{w}/{n} landed", workerErr: "Worker error: ",
    },
    tr: {
      title: "Lunar Lander — Tarayıcıda PPO",
      simulation: "Simülasyon", trainingH: "Eğitim", trainingSub: "(PPO · senin işlemcinde)",
      hudSteps: "Adım", hudScore: "Bölüm skoru", hudHist: "Son bölümler",
      run: "▶ Çalıştır", terrain: "⟳ Yeni arazi", terrainTitle: "Yeni rastgele arazi ve başlangıç hızı",
      modeRandom: "Rastgele", modeTrained: "Eğitilmiş model",
      loop: "Otomatik tekrarla", det: "Deterministik (argmax)",
      detTitle: "Açık: her durumda en yüksek olasılıklı eylem (argmax). Kapalı: π(a|s) dağılımından örnekle.",
      tip: "İpucu: kısa eğitimlerde <b>argmax</b>, örneklemeden çok daha kötü olabilir (politika itkiyi olasılıksal “darbelerle” ayarlar). Nedeni aşağıdaki yazıda anlatılıyor.",
      obsTitle: "Gözlem vektörü s (8 sensör)",
      obs: ["x konumu", "y konumu", "x hızı", "y hızı", "açı", "açısal hız", "sol bacak", "sağ bacak"],
      contact: "temas",
      polTitle: "Politika π(a | s)",
      acts: ["Boşta", "Sola it", "Ana motor", "Sağa it"],
      hintRandom: "Rastgele politika: dört eylem eşit olasılıklı (π = 0.25).",
      hintDet: "Deterministik: en yüksek olasılıklı eylem seçilir.",
      hintSample: "Stokastik: eylem bu dağılımdan örneklenir (seçilen eylem vurgulu).",
      badgeRandom: "Rastgele politika", badgeTraining: "Eğitiliyor…", badgeDet: "Eğitilmiş · argmax", badgeSample: "Eğitilmiş · stokastik",
      cores: "{n} çekirdekli CPU",
      iterations: "İterasyon sayısı", train: "⚡ Eğit", stop: "■ Durdur", reset: "Modeli sıfırla", resetTitle: "Kayıtlı modeli ve grafikleri sil",
      chip50: "50 · hızlı", chip150: "150 · dengeli", chip300: "300 · sağlam", chip600: "600 · uzun",
      preview: "Eğitim sırasında canlı önizleme", cont: "Mevcut modelden devam et",
      stepsHint: "1 iterasyon = 8 paralel ortamdan 2048 adım toplamak + 4 epoch PPO güncellemesi. <b>{n} iterasyon ≈ {k} bin adım.</b>",
      stIter: "İterasyon", stSteps: "Toplam adım", stSps: "Adım / sn", stTime: "Geçen süre", stEta: "Kalan (tahmini)", stSucc: "İniş başarısı",
      chReward: "Ortalama ödül", chSucc: "İniş başarısı %", chEnt: "Politika entropisi H(π)", chVl: "log₁₀ değer kaybı",
      solved: "çözüldü ≈ 200", randomRef: "ln 4 (rastgele)",
      empty: "Grafikler “Eğit” düğmesine bastığında canlı olarak dolar.",
      note: "Tüm hesap <b>tarayıcında</b> bir Web Worker içinde çalışır; sunucuya hiçbir şey gönderilmez. Bu, Gymnasium <b>LunarLander-v3</b>'ün (aynı gözlem, aksiyon ve ödül yapısı) hafif bir JavaScript portudur; Box2D yerine sade bir fizik motoru kullanır, bu yüzden skorlar birebir aynı olmaz.",
      landed: "İNİŞ BAŞARILI  ✓", crashed: "ÇAKILDI  ✗", oob: "SINIR DIŞINA ÇIKTI  ✗", timeout: "ZAMAN AŞIMI (1000 adım)", score: "skor",
      histFmt: "{w}/{n} iniş", workerErr: "Worker hatası: ",
    },
  };

  function initialLang() {
    try {
      const q = new URLSearchParams(location.search).get("lang");
      if (q === "en" || q === "tr") return q;
      const s = localStorage.getItem(LANG_STORE);
      if (s === "en" || s === "tr") return s;
    } catch (e) {}
    return "en";
  }
  let LANG = initialLang();
  const t = (k, vars) => {
    let s = I18N[LANG][k];
    if (s === undefined) s = I18N.en[k];
    if (vars) for (const v in vars) s = s.replace("{" + v + "}", vars[v]);
    return s;
  };
  const fmt = (n, d) => (isFinite(n) ? n.toLocaleString(LANG === "tr" ? "tr-TR" : "en-US", { maximumFractionDigits: d === undefined ? 0 : d, minimumFractionDigits: d || 0 }) : "—");

  // ------------------------------------------------------------------ durum
  const state = {
    weights: null,          // {actor, critic, sizes}
    policy: null,
    pendingActor: null,
    mode: "random",
    det: false,
    training: false,
    workerHasTrainer: false,
    worker: null,
    hist: { it: [], reward: [], succ: [], ent: [], vl: [] },
    meta: { timesteps: 0, iterations: 0 },
    recent: [],             // son bölüm sonuçları (simülasyon)
    last: null,
  };

  // ------------------------------------------------------------------ simülasyon
  const canvas = $("sim");
  const ctx = canvas.getContext("2d");
  const DPR = Math.min(2, window.devicePixelRatio || 1);
  canvas.width = 600 * DPR; canvas.height = 400 * DPR;
  const S = 30;

  const sim = {
    env: new L.LanderEnv(),
    running: false, score: 0, steps: 0, action: 0, probs: [0.25, 0.25, 0.25, 0.25],
    speed: 1, acc: 0, last: performance.now(), endTimer: 0, outcome: null,
    particles: [], frameNo: 0, useTrained: false,
  };

  const stars = (() => {
    const c = document.createElement("canvas");
    c.width = 600 * DPR; c.height = 400 * DPR;
    const g = c.getContext("2d");
    g.scale(DPR, DPR);
    const grad = g.createLinearGradient(0, 0, 0, 400);
    grad.addColorStop(0, "#020617"); grad.addColorStop(1, "#0b1530");
    g.fillStyle = grad; g.fillRect(0, 0, 600, 400);
    let s = 12345;
    const rnd = () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; };
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.25 + rnd() * 0.7;
      g.fillStyle = "#cbd5e1";
      const r = rnd() * 1.3 + 0.2;
      g.beginPath(); g.arc(rnd() * 600, rnd() * 300, r, 0, 7); g.fill();
    }
    return c;
  })();

  function px(x) { return x * S; }
  function py(y) { return 400 - y * S; }

  function drawScene() {
    const env = sim.env;
    ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    ctx.drawImage(stars, 0, 0, 600, 400);

    // zemin
    ctx.beginPath();
    ctx.moveTo(0, 400);
    for (let i = 0; i < L.CHUNKS; i++) ctx.lineTo(px(env.terrainX[i]), py(env.terrainY[i]));
    ctx.lineTo(600, 400); ctx.closePath();
    const tg = ctx.createLinearGradient(0, 100, 0, 400);
    tg.addColorStop(0, "#1e293b"); tg.addColorStop(1, "#0f172a");
    ctx.fillStyle = tg; ctx.fill();
    ctx.lineWidth = 2; ctx.strokeStyle = "#475569"; ctx.stroke();

    // iniş pisti + bayraklar
    const hy = py(L.HELIPAD_Y);
    ctx.save();
    ctx.shadowColor = "#22d3ee"; ctx.shadowBlur = 12;
    ctx.strokeStyle = "#22d3ee"; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.moveTo(px(env.padX1), hy); ctx.lineTo(px(env.padX2), hy); ctx.stroke();
    ctx.restore();
    for (const fx of [env.padX1, env.padX2]) {
      ctx.strokeStyle = "#e2e8f0"; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(px(fx), hy); ctx.lineTo(px(fx), hy - 30); ctx.stroke();
      ctx.fillStyle = "#ef4444";
      ctx.beginPath(); ctx.moveTo(px(fx), hy - 30); ctx.lineTo(px(fx) + 15, hy - 25); ctx.lineTo(px(fx), hy - 19); ctx.fill();
    }

    drawLander(env);

    // parçacıklar
    for (const p of sim.particles) {
      ctx.globalAlpha = Math.max(0, p.life / p.max);
      ctx.fillStyle = p.color;
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, 7); ctx.fill();
    }
    ctx.globalAlpha = 1;
  }

  function drawLander(env) {
    ctx.save();
    ctx.translate(px(env.x), py(env.y));
    ctx.rotate(-env.angle);

    // motor alevleri
    const flick = 0.75 + Math.random() * 0.5;
    if (env.mainFire) {
      const len = 0.55 * S * flick * 1.3;
      const fg = ctx.createLinearGradient(0, 0.38 * S, 0, 0.38 * S + len);
      fg.addColorStop(0, "#fef08a"); fg.addColorStop(0.5, "#fb923c"); fg.addColorStop(1, "rgba(239,68,68,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(-0.2 * S, 0.38 * S); ctx.lineTo(0.2 * S, 0.38 * S); ctx.lineTo(0, 0.38 * S + len); ctx.fill();
    }
    if (env.sideFire !== 0) {
      // aksiyon 1 gövdeyi sola iter -> alev sağa çıkar
      const dir = env.sideFire === -1 ? 1 : -1;
      const len = 0.38 * S * flick;
      const x0 = dir * 0.57 * S, y0 = -0.08 * S;
      const fg = ctx.createLinearGradient(x0, 0, x0 + dir * len, 0);
      fg.addColorStop(0, "#fef08a"); fg.addColorStop(1, "rgba(251,146,60,0)");
      ctx.fillStyle = fg;
      ctx.beginPath(); ctx.moveTo(x0, y0 - 0.09 * S); ctx.lineTo(x0, y0 + 0.09 * S); ctx.lineTo(x0 + dir * len, y0); ctx.fill();
    }

    // bacaklar
    ctx.lineCap = "round";
    for (let f = 0; f < 2; f++) {
      const sgn = f === 0 ? -1 : 1;
      const contact = f === 0 ? env.leg1 : env.leg2;
      ctx.strokeStyle = contact ? "#4ade80" : "#94a3b8";
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(sgn * 0.45 * S, 0.3 * S);
      ctx.lineTo(sgn * 0.75 * S, 0.62 * S);
      ctx.stroke();
      ctx.lineWidth = 3.5;
      ctx.beginPath();
      ctx.moveTo(sgn * 0.75 * S - 5, 0.62 * S);
      ctx.lineTo(sgn * 0.75 * S + 5, 0.62 * S);
      ctx.stroke();
    }

    // gövde
    ctx.beginPath();
    L.HULL.forEach((p, i) => { i ? ctx.lineTo(p[0] * S, -p[1] * S) : ctx.moveTo(p[0] * S, -p[1] * S); });
    ctx.closePath();
    const hg = ctx.createLinearGradient(-17, -17, 17, 10);
    hg.addColorStop(0, "#e2e8f0"); hg.addColorStop(1, "#94a3b8");
    ctx.fillStyle = hg; ctx.fill();
    ctx.lineWidth = 1.5; ctx.strokeStyle = "#475569"; ctx.stroke();
    ctx.fillStyle = "#38bdf8";
    ctx.beginPath(); ctx.arc(0, -0.2 * S, 0.19 * S, 0, 7); ctx.fill();
    ctx.fillStyle = "rgba(255,255,255,.5)";
    ctx.beginPath(); ctx.arc(-0.05 * S, -0.25 * S, 0.06 * S, 0, 7); ctx.fill();
    ctx.restore();
  }

  function spawnExplosion(x, y, good) {
    const cols = good ? ["#4ade80", "#bbf7d0", "#22d3ee"] : ["#fb923c", "#fde047", "#ef4444", "#e2e8f0"];
    const n = good ? 18 : 46;
    for (let i = 0; i < n; i++) {
      const a = Math.random() * Math.PI * (good ? 1 : 2) - (good ? Math.PI : 0);
      const sp = (good ? 30 : 60) + Math.random() * (good ? 60 : 140);
      sim.particles.push({
        x: px(x), y: py(y), vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - (good ? 30 : 0),
        life: 0.6 + Math.random() * 0.7, max: 1.1, r: 1 + Math.random() * 2.2,
        color: cols[(Math.random() * cols.length) | 0],
      });
    }
  }
  function updateParticles(dt) {
    for (const p of sim.particles) { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 220 * dt; p.life -= dt; }
    sim.particles = sim.particles.filter((p) => p.life > 0);
  }

  // ------------------------------------------------------------------ bölüm yönetimi
  function applyPendingWeights() {
    if (state.pendingActor) {
      state.policy = new P.Policy({ sizes: state.pendingActor.sizes, actor: state.pendingActor.actor });
      state.pendingActor = null;
    }
  }

  function startEpisode() {
    applyPendingWeights();
    sim.env.reset();
    sim.running = true;
    sim.score = 0; sim.steps = 0; sim.outcome = null; sim.acc = 0;
    sim.useTrained = (state.mode === "trained" || (state.training && $("previewChk").checked)) && !!state.policy;
    hideBanner();
    updateBadge();
  }

  function chooseAction() {
    if (sim.useTrained && state.policy) {
      const a = state.policy.act(sim.env.obs, state.det, Math.random);
      for (let i = 0; i < 4; i++) sim.probs[i] = state.policy.probs[i];
      return a;
    }
    for (let i = 0; i < 4; i++) sim.probs[i] = 0.25;
    return (Math.random() * 4) | 0;
  }

  function stepSim() {
    const a = chooseAction();
    sim.action = a;
    sim.score += sim.env.step(a);
    sim.steps++;
    if (sim.env.terminated || sim.env.truncated) finishEpisode();
  }

  function finishEpisode() {
    const env = sim.env;
    sim.running = false;
    env.mainFire = false; env.sideFire = 0;
    let key, cls;
    if (env.landed) { key = "landed"; cls = "ok"; spawnExplosion(env.x, env.y - 0.5, true); }
    else if (env.crashed) { key = "crashed"; cls = "bad"; spawnExplosion(env.x, env.y, false); }
    else if (env.outOfBounds) { key = "oob"; cls = "bad"; }
    else { key = "timeout"; cls = "warn"; }
    sim.outcome = key;
    sim.bannerInfo = { key, cls, score: sim.score };
    renderBanner();
    state.recent.push({ landed: env.landed ? 1 : 0, score: sim.score });
    if (state.recent.length > 10) state.recent.shift();
    sim.endTimer = 1.3;
    updateHist();
  }

  function wantsLoop() { return $("loopChk").checked || (state.training && $("previewChk").checked); }

  function showBanner(text, cls) { const b = $("banner"); b.textContent = text; b.className = "banner show " + cls; }
  function hideBanner() { sim.bannerInfo = null; $("banner").className = "banner"; }
  function renderBanner() {
    const i = sim.bannerInfo;
    if (i) showBanner(`${t(i.key)} · ${t("score")} ${fmt(i.score, 0)}`, i.cls);
  }

  function frame(now) {
    const dt = Math.min(0.1, (now - sim.last) / 1000);
    sim.last = now;
    if (sim.running) {
      sim.acc += dt * sim.speed;
      const h = 1 / L.FPS;
      let n = 0;
      while (sim.acc >= h && sim.running && n < 24) { stepSim(); sim.acc -= h; n++; }
    } else if (sim.endTimer > 0) {
      sim.endTimer -= dt;
      if (sim.endTimer <= 0 && wantsLoop()) startEpisode();
    } else if (!sim.running && state.training && $("previewChk").checked && !sim.outcome) {
      startEpisode();
    }
    updateParticles(dt);
    drawScene();
    if ((sim.frameNo++ & 1) === 0) updateHud();
    requestAnimationFrame(frame);
  }

  // ------------------------------------------------------------------ HUD / paneller
  const obsRows = [], actRows = [];
  (function buildPanels() {
    const o = $("obsRows");
    t("obs").forEach((l, i) => {
      const r = document.createElement("div"); r.className = "row";
      const leg = i >= 6;
      r.innerHTML = `<span class="lbl">${l}</span><div class="bar ${leg ? "" : "center"}"><i></i></div><span class="val">0</span>`;
      o.appendChild(r); obsRows.push(r);
    });
    const a = $("actRows");
    t("acts").forEach((l, i) => {
      const r = document.createElement("div"); r.className = "row";
      r.innerHTML = `<span class="lbl">${i} · ${l}</span><div class="bar act"><i></i></div><span class="val">25%</span>`;
      a.appendChild(r); actRows.push(r);
    });
  })();

  function updateHud() {
    $("hudSteps").textContent = fmt(sim.steps);
    const sc = $("hudScore");
    sc.textContent = fmt(sim.score, 0);
    sc.className = "v " + (sim.score >= 0 ? "pos" : "neg");

    const o = sim.env.obs;
    for (let i = 0; i < 8; i++) {
      const bar = obsRows[i].querySelector("i");
      if (i >= 6) { bar.style.left = "0"; bar.style.width = o[i] ? "100%" : "0%"; }
      else {
        const v = clamp(o[i] / 1.5, -1, 1);
        bar.style.left = (v >= 0 ? 50 : 50 + v * 50) + "%";
        bar.style.width = Math.abs(v) * 50 + "%";
      }
      obsRows[i].querySelector(".val").textContent = i >= 6 ? (o[i] ? t("contact") : "—") : o[i].toFixed(2);
    }
    for (let i = 0; i < 4; i++) {
      const row = actRows[i];
      row.querySelector("i").style.width = sim.probs[i] * 100 + "%";
      row.querySelector(".val").textContent = Math.round(sim.probs[i] * 100) + "%";
      row.classList.toggle("chosen", sim.running && sim.action === i);
    }
    $("actHint").textContent = sim.useTrained
      ? (state.det ? t("hintDet") : t("hintSample"))
      : t("hintRandom");
  }

  function updateHist() {
    if (!state.recent.length) { $("hudHist").textContent = "—"; return; }
    const w = state.recent.reduce((a, b) => a + b.landed, 0);
    $("hudHist").textContent = t("histFmt", { w, n: state.recent.length });
  }

  function updateBadge() {
    const b = $("policyBadge");
    if (state.training) { b.textContent = t("badgeTraining"); b.className = "badge training"; }
    else if (sim.useTrained) { b.textContent = state.det ? t("badgeDet") : t("badgeSample"); b.className = "badge trained"; }
    else { b.textContent = t("badgeRandom"); b.className = "badge"; }
  }

  // ------------------------------------------------------------------ kontroller (sim)
  $("runBtn").addEventListener("click", () => {
    startEpisode();
  });
  $("terrainBtn").addEventListener("click", () => { sim.env.reset(); sim.env.mainFire = false; sim.running = false; sim.outcome = null; sim.steps = 0; sim.score = 0; hideBanner(); sim.endTimer = 0; });
  $("modeSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || b.disabled) return;
    setMode(b.dataset.mode);
  });
  $("speedSeg").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b) return;
    sim.speed = +b.dataset.speed;
    [...$("speedSeg").children].forEach((c) => c.classList.toggle("on", c === b));
  });
  $("detChk").addEventListener("change", (e) => { state.det = e.target.checked; updateBadge(); });

  function setMode(m) {
    state.mode = m;
    [...$("modeSeg").children].forEach((c) => c.classList.toggle("on", c.dataset.mode === m));
    sim.useTrained = m === "trained" && !!state.policy;
    updateBadge();
  }
  function enableTrainedMode(on) {
    $("modeSeg").querySelector('[data-mode="trained"]').disabled = !on;
    $("contChk").disabled = !on;
    $("contWrap").style.opacity = on ? 1 : 0.45;
    if (!on) setMode("random");
  }

  // ------------------------------------------------------------------ grafikler
  class Chart {
    constructor(id, o) {
      this.cv = $(id); this.o = o;
      this.cv.width = 480 * DPR; this.cv.height = 300 * DPR;
      this.g = this.cv.getContext("2d");
    }
    draw(xs, ys) {
      const g = this.g, W = 480, H = 300, o = this.o;
      g.setTransform(DPR, 0, 0, DPR, 0, 0);
      g.clearRect(0, 0, W, H);
      const l = 46, r = 12, t = 12, b = 26;
      const n = ys.length;
      let lo = o.min !== undefined ? o.min : Infinity, hi = o.max !== undefined ? o.max : -Infinity;
      if (n) {
        let mn = Infinity, mx = -Infinity;
        for (const v of ys) { if (v < mn) mn = v; if (v > mx) mx = v; }
        if (o.min === undefined) lo = Math.min(mn, o.refs && o.refs.length ? Math.min(...o.refs.map((q) => q.y)) : mn);
        if (o.max === undefined) hi = Math.max(mx, o.refs && o.refs.length ? Math.max(...o.refs.map((q) => q.y)) : mx);
      } else { if (lo === Infinity) lo = 0; if (hi === -Infinity) hi = 1; }
      if (hi - lo < 1e-9) { hi += 1; lo -= 1; }
      const pad = (hi - lo) * 0.08;
      if (o.min === undefined) lo -= pad;
      if (o.max === undefined) hi += pad;
      const X = (i) => l + (n <= 1 ? 0 : (i / (n - 1)) * (W - l - r));
      const Y = (v) => t + (1 - (v - lo) / (hi - lo)) * (H - t - b);

      g.font = "11px Inter, sans-serif";
      g.fillStyle = "#64748b"; g.strokeStyle = "rgba(255,255,255,.07)"; g.lineWidth = 1;
      g.textAlign = "right"; g.textBaseline = "middle";
      for (let k = 0; k <= 4; k++) {
        const v = lo + ((hi - lo) * k) / 4, y = Y(v);
        g.beginPath(); g.moveTo(l, y); g.lineTo(W - r, y); g.stroke();
        g.fillText(o.fmt ? o.fmt(v) : v.toFixed(0), l - 6, y);
      }
      g.textAlign = "center"; g.textBaseline = "top";
      if (n) {
        g.fillText(String(xs[0]), l, H - b + 7);
        if (n > 1) g.fillText(String(xs[n - 1]), W - r, H - b + 7);
      }
      for (const ref of o.refs || []) {
        const y = Y(ref.y);
        g.save(); g.setLineDash([5, 4]); g.strokeStyle = ref.color; g.globalAlpha = 0.7;
        g.beginPath(); g.moveTo(l, y); g.lineTo(W - r, y); g.stroke(); g.restore();
        g.fillStyle = ref.color; g.textAlign = "left"; g.textBaseline = "bottom";
        g.fillText(typeof ref.label === "function" ? ref.label() : ref.label, l + 4, y - 2);
      }
      if (!n) return;
      g.beginPath();
      for (let i = 0; i < n; i++) i ? g.lineTo(X(i), Y(ys[i])) : g.moveTo(X(i), Y(ys[i]));
      g.lineWidth = 2; g.strokeStyle = o.color; g.lineJoin = "round"; g.stroke();
      g.lineTo(X(n - 1), Y(lo)); g.lineTo(X(0), Y(lo)); g.closePath();
      const gr = g.createLinearGradient(0, t, 0, H - b);
      gr.addColorStop(0, o.color + "55"); gr.addColorStop(1, o.color + "00");
      g.fillStyle = gr; g.fill();
      g.fillStyle = o.color;
      g.beginPath(); g.arc(X(n - 1), Y(ys[n - 1]), 3.5, 0, 7); g.fill();
    }
  }

  const charts = {
    reward: new Chart("chReward", { color: "#3b82f6", refs: [{ y: 200, color: "#22c55e", label: () => t("solved") }, { y: 0, color: "#64748b", label: "" }], fmt: (v) => v.toFixed(0) }),
    succ: new Chart("chSucc", { color: "#22c55e", min: 0, max: 100, fmt: (v) => v.toFixed(0) }),
    ent: new Chart("chEnt", { color: "#f59e0b", refs: [{ y: Math.log(4), color: "#64748b", label: () => t("randomRef") }], fmt: (v) => v.toFixed(2) }),
    vl: new Chart("chVl", { color: "#a855f7", fmt: (v) => v.toFixed(1) }),
  };
  function drawCharts() {
    const h = state.hist;
    charts.reward.draw(h.it, h.reward);
    charts.succ.draw(h.it, h.succ);
    charts.ent.draw(h.it, h.ent);
    charts.vl.draw(h.it, h.vl);
    const last = (a) => (a.length ? a[a.length - 1] : NaN);
    $("vReward").textContent = fmt(last(h.reward), 0);
    $("vSucc").textContent = fmt(last(h.succ), 0) + (h.succ.length ? "%" : "");
    $("vEnt").textContent = fmt(last(h.ent), 2);
    $("vVl").textContent = fmt(last(h.vl), 2);
    $("chartEmpty").style.display = h.it.length ? "none" : "block";
  }

  // ------------------------------------------------------------------ eğitim
  const cores = navigator.hardwareConcurrency || "?";
  function updateCoreBadge() { $("coreBadge").textContent = t("cores", { n: cores }); }

  function updateStepsHint() {
    const n = clamp(parseInt($("iterInput").value) || 0, 0, 3000);
    $("stepsHint").innerHTML = t("stepsHint", { n: fmt(n), k: fmt((n * 2048) / 1000) });
  }
  $("iterInput").addEventListener("input", updateStepsHint);
  $("presetChips").addEventListener("click", (e) => {
    const b = e.target.closest("button"); if (!b || state.training) return;
    $("iterInput").value = b.dataset.n; updateStepsHint();
  });

  function ensureWorker() {
    if (state.worker) return state.worker;
    const w = new Worker("train-worker.js");
    w.onmessage = onWorkerMessage;
    w.onerror = (e) => { console.error(e); setTraining(false); showBanner(t("workerErr") + (e.message || "?"), "bad"); };
    state.worker = w;
    return w;
  }

  function setTraining(on) {
    state.training = on;
    const tb = $("trainBtn");
    tb.textContent = on ? t("stop") : t("train");
    tb.className = "btn " + (on ? "danger" : "primary");
    $("iterInput").disabled = on;
    $("resetBtn").disabled = on;
    [...$("presetChips").children].forEach((c) => (c.disabled = on));
    updateBadge();
  }

  function startTraining() {
    const n = clamp(parseInt($("iterInput").value) || 0, 1, 3000);
    $("iterInput").value = n; updateStepsHint();
    const cont = $("contChk").checked && !!state.weights && !$("contChk").disabled;
    const fresh = !cont || !state.workerHasTrainer;
    if (!cont) {
      state.hist = { it: [], reward: [], succ: [], ent: [], vl: [] };
      state.meta = { timesteps: 0, iterations: 0 };
      state.weights = null; state.policy = null; state.pendingActor = null;
      enableTrainedMode(false);
      drawCharts();
    }
    const w = ensureWorker();
    setTraining(true);
    sim.running = false; sim.outcome = null; sim.endTimer = 0;
    state.t0 = performance.now();
    w.postMessage({ type: "train", iterations: n, fresh, weights: fresh && cont ? state.weights : null });
  }
  function stopTraining() { state.worker && state.worker.postMessage({ type: "stop" }); }

  $("trainBtn").addEventListener("click", () => (state.training ? stopTraining() : startTraining()));

  $("resetBtn").addEventListener("click", () => {
    if (state.worker) state.worker.postMessage({ type: "reset" });
    state.workerHasTrainer = false;
    state.weights = null; state.policy = null; state.pendingActor = null;
    state.hist = { it: [], reward: [], succ: [], ent: [], vl: [] };
    state.meta = { timesteps: 0, iterations: 0 };
    try { localStorage.removeItem(STORE); } catch (e) {}
    enableTrainedMode(false);
    ["stIter", "stSteps"].forEach((id) => ($(id).textContent = "0"));
    ["stSps", "stEta", "stSucc"].forEach((id) => ($(id).textContent = "—"));
    $("stTime").textContent = "0:00"; $("progBar").style.width = "0%";
    hideBanner(); drawCharts(); updateBadge();
  });

  const mmss = (s) => (isFinite(s) ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}` : "—");

  function onWorkerMessage(e) {
    const m = e.data;
    if (m.type === "progress") {
      state.workerHasTrainer = true;
      state.meta = { timesteps: m.timesteps, iterations: m.iteration };
      const h = state.hist;
      h.it.push(m.iteration);
      h.reward.push(isFinite(m.meanReward) ? m.meanReward : 0);
      h.succ.push(isFinite(m.successRate) ? m.successRate * 100 : 0);
      h.ent.push(m.entropy);
      h.vl.push(Math.log10(Math.max(m.valueLoss, 1e-6)));
      state.pendingActor = { sizes: m.sizes, actor: m.actor };
      if (!state.policy) applyPendingWeights();
      if (!state.weights) state.weights = { sizes: m.sizes, actor: m.actor, critic: null };
      $("modeSeg").querySelector('[data-mode="trained"]').disabled = false;

      $("progBar").style.width = (100 * m.runIteration) / m.runTotal + "%";
      $("stIter").textContent = `${m.runIteration}/${m.runTotal}`;
      $("stSteps").textContent = fmt(m.timesteps);
      $("stSps").textContent = fmt(m.stepsPerSec);
      $("stTime").textContent = mmss(m.elapsed);
      $("stEta").textContent = mmss((m.elapsed / m.runIteration) * (m.runTotal - m.runIteration));
      $("stSucc").textContent = isFinite(m.successRate) ? Math.round(m.successRate * 100) + "%" : "—";
      drawCharts();
    } else if (m.type === "done") {
      state.weights = m.weights;
      state.pendingActor = { sizes: m.weights.sizes, actor: m.weights.actor };
      setTraining(false);
      enableTrainedMode(true);
      persist();
      $("progBar").style.width = m.stopped ? $("progBar").style.width : "100%";
      applyPendingWeights();
      setMode("trained");
      if (!sim.running) { startEpisode(); }
    }
  }

  // ------------------------------------------------------------------ kalıcılık
  function persist() {
    try {
      localStorage.setItem(STORE, JSON.stringify({ weights: state.weights, hist: state.hist, meta: state.meta }));
    } catch (e) { /* kota / gizli mod */ }
  }
  function restore() {
    try {
      const raw = localStorage.getItem(STORE);
      if (!raw) return;
      const d = JSON.parse(raw);
      if (!d.weights || !d.weights.actor) return;
      state.weights = d.weights;
      state.hist = d.hist || state.hist;
      state.meta = d.meta || state.meta;
      state.policy = new P.Policy({ sizes: d.weights.sizes, actor: d.weights.actor });
      enableTrainedMode(true);
      setMode("trained");
      $("stIter").textContent = String(state.meta.iterations);
      $("stSteps").textContent = fmt(state.meta.timesteps);
      const h = state.hist;
      if (h.succ.length) $("stSucc").textContent = Math.round(h.succ[h.succ.length - 1]) + "%";
    } catch (e) { /* bozuk kayıt */ }
  }

  // ------------------------------------------------------------------ iframe boyutu
  function reportHeight() {
    if (window.parent === window) return;
    // body'nin gerçek içerik yüksekliği (scrollHeight iframe yüksekliğinin altına inmez ve geri besleme yapar)
    const h = Math.ceil(document.body.getBoundingClientRect().height) + 4;
    if (h === state.lastReported) return;
    state.lastReported = h;
    window.parent.postMessage({ type: "iframe-height", height: h }, "*");
  }
  if (window.ResizeObserver) new ResizeObserver(reportHeight).observe(document.body);
  window.addEventListener("load", reportHeight);

  // ------------------------------------------------------------------ dil
  function applyLang() {
    document.documentElement.lang = LANG;
    document.title = t("title");
    document.querySelectorAll("[data-i18n]").forEach((el) => { el.textContent = t(el.dataset.i18n); });
    document.querySelectorAll("[data-i18n-title]").forEach((el) => { el.title = t(el.dataset.i18nTitle); });
    document.querySelectorAll("[data-i18n-html]").forEach((el) => { el.innerHTML = t(el.dataset.i18nHtml); });
    t("obs").forEach((l, i) => { obsRows[i].querySelector(".lbl").textContent = l; });
    t("acts").forEach((l, i) => { actRows[i].querySelector(".lbl").textContent = `${i} · ${l}`; });
    $("trainBtn").textContent = state.training ? t("stop") : t("train");
    [...$("langSeg").children].forEach((b) => b.classList.toggle("on", b.dataset.lang === LANG));
    updateCoreBadge(); updateStepsHint(); updateBadge(); updateHist(); renderBanner(); drawCharts();
  }
  function setLang(l, persist) {
    if (l !== "en" && l !== "tr") return;
    LANG = l;
    if (persist) { try { localStorage.setItem(LANG_STORE, l); } catch (e) {} }
    applyLang();
  }
  // Gömülüyken dil, üst sayfadaki seçiciden gelir; tek başına açıldığında kendi seçicisi görünür
  if (window.parent === window) {
    $("langSeg").hidden = false;
    $("langSeg").addEventListener("click", (e) => {
      const b = e.target.closest("button"); if (b) setLang(b.dataset.lang, true);
    });
  }
  window.addEventListener("message", (e) => {
    if (e.origin !== window.location.origin) return;
    if (e.data && e.data.type === "set-lang") setLang(e.data.lang, false);
  });

  // ------------------------------------------------------------------ başlat
  enableTrainedMode(false);
  restore();
  applyLang();
  sim.env.reset();
  requestAnimationFrame(frame);
})();
