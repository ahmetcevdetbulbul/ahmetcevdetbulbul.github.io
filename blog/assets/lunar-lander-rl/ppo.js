// Bağımlılıksız PPO: MLP (elle yazılmış ileri/geri yayılım), Adam, GAE, kırpılmış vekil amaç.
// Tarayıcıda Web Worker içinde (ve test için Node'da) çalışır.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.PPOLib = factory();
})(typeof self !== "undefined" ? self : this, function () {

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  function randn(rng) {
    let u = 0, v = 0;
    while (u === 0) u = rng();
    while (v === 0) v = rng();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  // ---------------------------------------------------------------- MLP
  class MLP {
    constructor(sizes, outGain, rng, maxBatch) {
      this.sizes = sizes;
      this.L = sizes.length - 1;
      this.maxBatch = maxBatch;
      this.W = []; this.b = []; this.gW = []; this.gb = [];
      this.mW = []; this.vW = []; this.mb = []; this.vb = [];
      this.A = []; this.D = [];
      for (let l = 0; l < this.L; l++) {
        const nin = sizes[l], nout = sizes[l + 1];
        // Yarı-ortogonal başlatma: N(0,1) matrisini Gram-Schmidt ile dikleştir (nout<=nin ise
        // satırlar, aksi halde sütunlar ortonormal olur), sonra kazançla ölçekle.
        const gain = l === this.L - 1 ? outGain : Math.SQRT2;
        const w = new Float64Array(nin * nout);
        for (let i = 0; i < w.length; i++) w[i] = randn(rng);
        const byRows = nout <= nin;
        const nVec = byRows ? nout : nin;      // dikleştirilecek vektör sayısı
        const len = byRows ? nin : nout;       // her vektörün uzunluğu
        const at = byRows ? (v, k) => v * nin + k : (v, k) => k * nin + v;
        for (let v = 0; v < nVec; v++) {
          for (let q = 0; q < v; q++) {
            let dot = 0;
            for (let k = 0; k < len; k++) dot += w[at(v, k)] * w[at(q, k)];
            for (let k = 0; k < len; k++) w[at(v, k)] -= dot * w[at(q, k)];
          }
          let nrm = 0;
          for (let k = 0; k < len; k++) nrm += w[at(v, k)] ** 2;
          nrm = Math.sqrt(nrm) || 1;
          for (let k = 0; k < len; k++) w[at(v, k)] /= nrm;
        }
        for (let i = 0; i < w.length; i++) w[i] *= gain;
        this.W.push(w); this.b.push(new Float64Array(nout));
        this.gW.push(new Float64Array(nin * nout)); this.gb.push(new Float64Array(nout));
        this.mW.push(new Float64Array(nin * nout)); this.vW.push(new Float64Array(nin * nout));
        this.mb.push(new Float64Array(nout)); this.vb.push(new Float64Array(nout));
      }
      for (let l = 0; l <= this.L; l++) {
        this.A.push(new Float64Array(maxBatch * sizes[l]));
        this.D.push(new Float64Array(maxBatch * sizes[l]));
      }
      this.adamT = 0;
      this.s1 = new Float64Array(sizes[1]);
      this.s2 = new Float64Array(sizes[2] || 1);
    }

    // tek örnek ileri geçiş (rollout için, ayırma yapmaz)
    forwardOne(x, out) {
      let inp = x, nin = this.sizes[0];
      for (let l = 0; l < this.L; l++) {
        const nout = this.sizes[l + 1];
        const w = this.W[l], b = this.b[l];
        const dst = l === this.L - 1 ? out : (l === 0 ? this.s1 : this.s2);
        for (let o = 0; o < nout; o++) {
          let s = b[o];
          const base = o * nin;
          for (let i = 0; i < nin; i++) s += w[base + i] * inp[i];
          dst[o] = l === this.L - 1 ? s : Math.tanh(s);
        }
        inp = dst; nin = nout;
      }
    }

    forwardBatch(B) {
      for (let l = 0; l < this.L; l++) {
        const nin = this.sizes[l], nout = this.sizes[l + 1];
        const a = this.A[l], z = this.A[l + 1], w = this.W[l], b = this.b[l];
        const last = l === this.L - 1;
        for (let n = 0; n < B; n++) {
          const ia = n * nin, iz = n * nout;
          for (let o = 0; o < nout; o++) {
            let s = b[o];
            const base = o * nin;
            for (let i = 0; i < nin; i++) s += w[base + i] * a[ia + i];
            z[iz + o] = last ? s : Math.tanh(s);
          }
        }
      }
    }

    zeroGrad() {
      for (let l = 0; l < this.L; l++) { this.gW[l].fill(0); this.gb[l].fill(0); }
    }

    // dOut: B*nOut, çıkış katmanına gelen dL/dz
    backwardBatch(B, dOut) {
      const Lm = this.L;
      this.D[Lm].set(dOut.subarray(0, B * this.sizes[Lm]));
      for (let l = Lm - 1; l >= 0; l--) {
        const nin = this.sizes[l], nout = this.sizes[l + 1];
        const a = this.A[l], d = this.D[l + 1], gw = this.gW[l], gb = this.gb[l], w = this.W[l];
        const dprev = l > 0 ? this.D[l] : null;
        if (dprev) dprev.fill(0, 0, B * nin);
        for (let n = 0; n < B; n++) {
          const ia = n * nin, id = n * nout;
          for (let o = 0; o < nout; o++) {
            const dv = d[id + o];
            if (dv === 0) continue;
            gb[o] += dv;
            const base = o * nin;
            for (let i = 0; i < nin; i++) {
              gw[base + i] += dv * a[ia + i];
              if (dprev) dprev[ia + i] += dv * w[base + i];
            }
          }
          if (dprev) {
            for (let i = 0; i < nin; i++) { const h = a[ia + i]; dprev[ia + i] *= 1 - h * h; }
          }
        }
      }
    }

    gradNormSq() {
      let s = 0;
      for (let l = 0; l < this.L; l++) {
        for (let i = 0; i < this.gW[l].length; i++) s += this.gW[l][i] ** 2;
        for (let i = 0; i < this.gb[l].length; i++) s += this.gb[l][i] ** 2;
      }
      return s;
    }

    adamStep(lr, scale) {
      const b1 = 0.9, b2 = 0.999, eps = 1e-5;
      this.adamT++;
      const c1 = 1 - Math.pow(b1, this.adamT), c2 = 1 - Math.pow(b2, this.adamT);
      for (let l = 0; l < this.L; l++) {
        const upd = (p, g, m, v) => {
          for (let i = 0; i < p.length; i++) {
            const gi = g[i] * scale;
            m[i] = b1 * m[i] + (1 - b1) * gi;
            v[i] = b2 * v[i] + (1 - b2) * gi * gi;
            p[i] -= lr * (m[i] / c1) / (Math.sqrt(v[i] / c2) + eps);
          }
        };
        upd(this.W[l], this.gW[l], this.mW[l], this.vW[l]);
        upd(this.b[l], this.gb[l], this.mb[l], this.vb[l]);
      }
    }

    getParams() {
      return this.W.map((w, l) => ({ W: Array.from(w), b: Array.from(this.b[l]) }));
    }
    setParams(p) {
      for (let l = 0; l < this.L; l++) { this.W[l].set(p[l].W); this.b[l].set(p[l].b); }
    }
  }

  function softmaxInPlace(z, off, n, out, outOff) {
    let mx = -Infinity;
    for (let i = 0; i < n; i++) if (z[off + i] > mx) mx = z[off + i];
    let s = 0;
    for (let i = 0; i < n; i++) { const e = Math.exp(z[off + i] - mx); out[outOff + i] = e; s += e; }
    for (let i = 0; i < n; i++) out[outOff + i] /= s;
  }

  // ---------------------------------------------------------------- PPO
  const DEFAULTS = {
    nEnvs: 8, nSteps: 256, epochs: 4, batchSize: 128,
    lr: 3e-4, gamma: 0.99, lambda: 0.95, clip: 0.2,
    entCoef: 0.01, vfCoef: 0.5, maxGradNorm: 0.5, hidden: 64, seed: 1,
  };

  class PPOTrainer {
    constructor(EnvClass, cfg) {
      this.cfg = Object.assign({}, DEFAULTS, cfg || {});
      const c = this.cfg;
      this.rng = mulberry32(c.seed);
      this.nObs = 8; this.nAct = 4;
      this.total = c.nEnvs * c.nSteps;
      this.envs = [];
      for (let i = 0; i < c.nEnvs; i++) this.envs.push(new EnvClass(c.seed * 1000 + i));
      const H = c.hidden;
      this.actor = new MLP([this.nObs, H, H, this.nAct], 0.01, this.rng, c.batchSize);
      this.critic = new MLP([this.nObs, H, H, 1], 1.0, this.rng, c.batchSize);
      this.sampler = mulberry32(c.seed + 7919);
      const T = this.total;
      this.obsBuf = new Float64Array(T * this.nObs);
      this.actBuf = new Int32Array(T);
      this.logpBuf = new Float64Array(T);
      this.rewBuf = new Float64Array(T);
      this.doneBuf = new Float64Array(T);
      this.valBuf = new Float64Array(T);
      this.advBuf = new Float64Array(T);
      this.retBuf = new Float64Array(T);
      this.logits = new Float64Array(this.nAct);
      this.probs = new Float64Array(this.nAct);
      this.v1 = new Float64Array(1);
      this.lastVal = new Float64Array(c.nEnvs);
      this.epRet = new Float64Array(c.nEnvs);
      this.epLen = new Float64Array(c.nEnvs);
      this.recent = [];      // son bölümler: {r, len, landed}
      this.timesteps = 0;
      this.iteration = 0;
      this.dOutA = new Float64Array(c.batchSize * this.nAct);
      this.dOutC = new Float64Array(c.batchSize);
      this.sprobs = new Float64Array(c.batchSize * this.nAct);
      this.idx = new Int32Array(T);
      for (let i = 0; i < T; i++) this.idx[i] = i;
      for (const e of this.envs) e.reset();
    }

    sampleAction() {
      softmaxInPlace(this.logits, 0, this.nAct, this.probs, 0);
      let u = this.sampler(), a = 0, cum = this.probs[0];
      while (u > cum && a < this.nAct - 1) { a++; cum += this.probs[a]; }
      return a;
    }

    collect() {
      const c = this.cfg, N = c.nEnvs, nObs = this.nObs;
      for (let t = 0; t < c.nSteps; t++) {
        for (let e = 0; e < N; e++) {
          const env = this.envs[e], k = t * N + e;
          this.obsBuf.set(env.obs, k * nObs);
          this.actor.forwardOne(env.obs, this.logits);
          const a = this.sampleAction();
          this.critic.forwardOne(env.obs, this.v1);
          this.actBuf[k] = a;
          this.logpBuf[k] = Math.log(this.probs[a] + 1e-12);
          this.valBuf[k] = this.v1[0];
          let r = env.step(a);
          this.epRet[e] += r; this.epLen[e]++;
          let done = 0;
          if (env.terminated || env.truncated) {
            done = 1;
            if (env.truncated) {
              this.critic.forwardOne(env.obs, this.v1);
              r += c.gamma * this.v1[0];
            }
            this.recent.push({ r: this.epRet[e], len: this.epLen[e], landed: env.landed ? 1 : 0 });
            if (this.recent.length > 100) this.recent.shift();
            this.epRet[e] = 0; this.epLen[e] = 0;
            env.reset();
          }
          this.rewBuf[k] = r; this.doneBuf[k] = done;
        }
      }
      for (let e = 0; e < N; e++) {
        this.critic.forwardOne(this.envs[e].obs, this.v1);
        this.lastVal[e] = this.v1[0];
      }
      // GAE(lambda)
      for (let e = 0; e < N; e++) {
        let last = 0;
        for (let t = c.nSteps - 1; t >= 0; t--) {
          const k = t * N + e;
          const nonTerm = 1 - this.doneBuf[k];
          const nextV = t === c.nSteps - 1 ? this.lastVal[e] : this.valBuf[(t + 1) * N + e];
          const delta = this.rewBuf[k] + c.gamma * nextV * nonTerm - this.valBuf[k];
          last = delta + c.gamma * c.lambda * nonTerm * last;
          this.advBuf[k] = last;
          this.retBuf[k] = last + this.valBuf[k];
        }
      }
      this.timesteps += c.nSteps * N;
    }

    update(lr) {
      const c = this.cfg, T = this.total, B = c.batchSize, nA = this.nAct, nObs = this.nObs;
      let sumPL = 0, sumVL = 0, sumEnt = 0, sumKL = 0, clipped = 0, cnt = 0;
      for (let ep = 0; ep < c.epochs; ep++) {
        for (let i = T - 1; i > 0; i--) {            // Fisher-Yates
          const j = (this.rng() * (i + 1)) | 0;
          const tmp = this.idx[i]; this.idx[i] = this.idx[j]; this.idx[j] = tmp;
        }
        for (let s = 0; s + B <= T; s += B) {
          // minibatch avantaj normalizasyonu
          let mean = 0, sq = 0;
          for (let n = 0; n < B; n++) { const a = this.advBuf[this.idx[s + n]]; mean += a; sq += a * a; }
          mean /= B; const std = Math.sqrt(Math.max(sq / B - mean * mean, 0)) + 1e-8;

          const aIn = this.actor.A[0], cIn = this.critic.A[0];
          for (let n = 0; n < B; n++) {
            const k = this.idx[s + n];
            for (let i = 0; i < nObs; i++) { const v = this.obsBuf[k * nObs + i]; aIn[n * nObs + i] = v; cIn[n * nObs + i] = v; }
          }
          this.actor.forwardBatch(B);
          this.critic.forwardBatch(B);
          const Z = this.actor.A[this.actor.L], V = this.critic.A[this.critic.L];
          this.actor.zeroGrad(); this.critic.zeroGrad();

          for (let n = 0; n < B; n++) {
            const k = this.idx[s + n];
            softmaxInPlace(Z, n * nA, nA, this.sprobs, n * nA);
            const a = this.actBuf[k];
            const logp = Math.log(this.sprobs[n * nA + a] + 1e-12);
            const ratio = Math.exp(logp - this.logpBuf[k]);
            const A = (this.advBuf[k] - mean) / std;
            const unclipped = ratio * A;
            const cl = Math.max(1 - c.clip, Math.min(1 + c.clip, ratio)) * A;
            const useClip = cl < unclipped;          // min seçildi ve kırpılmış dal
            const surr = Math.min(unclipped, cl);
            let ent = 0;
            for (let j = 0; j < nA; j++) { const p = this.sprobs[n * nA + j]; ent -= p * Math.log(p + 1e-12); }
            // dL/dlogp = -A*ratio (kırpılmışsa 0)
            const dLogp = useClip ? 0 : -A * ratio;
            for (let j = 0; j < nA; j++) {
              const p = this.sprobs[n * nA + j];
              const dlogp_dz = (j === a ? 1 : 0) - p;
              // entropi gradyanı: -entCoef * dH/dz,  dH/dz_j = -p_j (log p_j + H)
              const dEnt = c.entCoef * p * (Math.log(p + 1e-12) + ent);
              this.dOutA[n * nA + j] = (dLogp * dlogp_dz + dEnt) / B;
            }
            const vErr = V[n] - this.retBuf[k];
            this.dOutC[n] = c.vfCoef * vErr / B;
            sumPL += -surr; sumVL += 0.5 * vErr * vErr; sumEnt += ent;
            sumKL += ratio - 1 - Math.log(ratio);
            if (useClip) clipped++;
            cnt++;
          }
          this.actor.backwardBatch(B, this.dOutA);
          this.critic.backwardBatch(B, this.dOutC);
          const gn = Math.sqrt(this.actor.gradNormSq() + this.critic.gradNormSq());
          const scale = gn > c.maxGradNorm ? c.maxGradNorm / (gn + 1e-6) : 1;
          this.actor.adamStep(lr, scale);
          this.critic.adamStep(lr, scale);
        }
      }
      return {
        policyLoss: sumPL / cnt, valueLoss: sumVL / cnt, entropy: sumEnt / cnt,
        approxKL: sumKL / cnt, clipFraction: clipped / cnt,
      };
    }

    stats() {
      const r = this.recent;
      if (!r.length) return { meanReward: NaN, meanLen: NaN, successRate: NaN, episodes: 0 };
      const last = r.slice(-30);
      let sr = 0, sl = 0, ss = 0;
      for (const e of last) { sr += e.r; sl += e.len; ss += e.landed; }
      return { meanReward: sr / last.length, meanLen: sl / last.length, successRate: ss / last.length, episodes: last.length };
    }

    // lr: doğrusal azalan öğrenme hızı için fraction (1 -> 0)
    trainIteration(progress) {
      const lr = this.cfg.lr * Math.max(0.1, 1 - (progress || 0));
      this.collect();
      const u = this.update(lr);
      this.iteration++;
      return Object.assign({ iteration: this.iteration, timesteps: this.timesteps, lr }, u, this.stats());
    }

    getWeights() { return { actor: this.actor.getParams(), critic: this.critic.getParams(), sizes: this.actor.sizes }; }
    setWeights(w) { this.actor.setParams(w.actor); if (w.critic) this.critic.setParams(w.critic); }
  }

  // Yalnızca aktör ağıyla çıkarım (demo / Çalıştır düğmesi için)
  class Policy {
    constructor(weights) {
      this.sizes = weights.sizes;
      this.net = new MLP(this.sizes, 0.01, mulberry32(1), 1);
      this.net.setParams(weights.actor);
      this.logits = new Float64Array(this.sizes[this.sizes.length - 1]);
      this.probs = new Float64Array(this.logits.length);
    }
    act(obs, deterministic, rng) {
      this.net.forwardOne(obs, this.logits);
      softmaxInPlace(this.logits, 0, this.logits.length, this.probs, 0);
      if (deterministic) {
        let b = 0;
        for (let i = 1; i < this.logits.length; i++) if (this.logits[i] > this.logits[b]) b = i;
        return b;
      }
      let u = (rng || Math.random)(), a = 0, cum = this.probs[0];
      while (u > cum && a < this.probs.length - 1) { a++; cum += this.probs[a]; }
      return a;
    }
  }

  return { MLP, PPOTrainer, Policy, DEFAULTS };
});
