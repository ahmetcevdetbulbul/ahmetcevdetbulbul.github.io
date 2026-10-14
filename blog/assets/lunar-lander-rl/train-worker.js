// Eğitim, kullanıcının kendi bilgisayarında bu Web Worker içinde çalışır (sunucu yok).
importScripts("lander-env.js", "ppo.js");

let trainer = null;
let running = false;
let stopRequested = false;

const tick = () => new Promise((r) => setTimeout(r, 0));

self.onmessage = async (e) => {
  const m = e.data;
  if (m.type === "stop") { stopRequested = true; return; }
  if (m.type === "reset") { trainer = null; return; }
  if (m.type !== "train" || running) return;

  if (m.fresh || !trainer) {
    trainer = new PPOLib.PPOTrainer(LanderLib.LanderEnv, {
      seed: m.seed || ((Math.random() * 1e6) | 0) + 1,
    });
    if (m.weights) trainer.setWeights(m.weights);
  }

  running = true;
  stopRequested = false;
  const total = m.iterations;
  const t0 = performance.now();
  const stepsAtStart = trainer.timesteps;
  let done = 0;

  for (let i = 0; i < total && !stopRequested; i++) {
    const metrics = trainer.trainIteration(i / total);
    done = i + 1;
    const elapsed = (performance.now() - t0) / 1000;
    self.postMessage({
      type: "progress",
      runIteration: done,
      runTotal: total,
      iteration: metrics.iteration,
      timesteps: metrics.timesteps,
      meanReward: metrics.meanReward,
      meanLen: metrics.meanLen,
      successRate: metrics.successRate,
      entropy: metrics.entropy,
      valueLoss: metrics.valueLoss,
      policyLoss: metrics.policyLoss,
      approxKL: metrics.approxKL,
      clipFraction: metrics.clipFraction,
      lr: metrics.lr,
      stepsPerSec: (trainer.timesteps - stepsAtStart) / Math.max(elapsed, 1e-3),
      elapsed,
      actor: trainer.actor.getParams(),
      sizes: trainer.actor.sizes,
    });
    await tick();
  }

  running = false;
  self.postMessage({ type: "done", stopped: stopRequested, completed: done, weights: trainer.getWeights() });
};
