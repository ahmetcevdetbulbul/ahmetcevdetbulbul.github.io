// Gymnasium LunarLander-v3'ün hafif bir JavaScript portu.
// Gözlem (8), aksiyon (4) ve ödül yapısı orijinaliyle aynıdır; fizik Box2D yerine
// sade bir rijit-cisim + yay-sönümleyici bacak modeliyle yazılmıştır.
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.LanderLib = factory();
})(typeof self !== "undefined" ? self : this, function () {

  const FPS = 50;
  const DT = 1 / FPS;
  const SUBSTEPS = 4;
  const SCALE = 30;
  const VIEW_W = 600 / SCALE;      // 20 m
  const VIEW_H = 400 / SCALE;      // 13.33 m
  const CHUNKS = 11;
  const HELIPAD_Y = VIEW_H / 4;
  const LEG_DOWN = 18 / SCALE;
  const MAX_STEPS = 1000;

  const GRAVITY = 10;
  const MASS = 5;
  const INERTIA = 1.4;
  const MAIN_ACC = 17.4;           // ana motor ivmesi (m/s^2)
  const SIDE_ACC = 2.4;            // yan motor yanal ivmesi
  const SIDE_ALPHA = 5.5;          // yan motor açısal ivmesi (rad/s^2)

  const LEG_K = 2500;              // bacak yay sertliği (N/m)
  const LEG_C = 80;                // bacak sönümü (N·s/m)
  const FRICTION_MU = 0.3;
  const FRICTION_C = 200;

  const FEET = [[-0.75, -0.62], [0.75, -0.62]];
  const HULL = [[-0.47, 0.57], [-0.57, 0], [-0.57, -0.33], [0.57, -0.33], [0.57, 0], [0.47, 0.57]];

  function mulberry32(a) {
    return function () {
      a |= 0; a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class LanderEnv {
    constructor(seed) {
      this.rng = mulberry32(seed === undefined ? (Math.random() * 2 ** 31) | 0 : seed);
      this.obs = new Float64Array(8);
      this.terrainX = new Float64Array(CHUNKS);
      this.terrainY = new Float64Array(CHUNKS);
      this.padX1 = 0; this.padX2 = 0;
      this.mainFire = false; this.sideFire = 0;
      this.reset();
    }

    uniform(a, b) { return a + (b - a) * this.rng(); }

    makeTerrain() {
      const h = new Float64Array(CHUNKS + 1);
      for (let i = 0; i <= CHUNKS; i++) h[i] = this.uniform(0, VIEW_H / 2);
      const mid = CHUNKS >> 1;
      for (let i = mid - 2; i <= mid + 2; i++) h[i] = HELIPAD_Y;
      for (let i = 0; i < CHUNKS; i++) {
        this.terrainX[i] = (VIEW_W / (CHUNKS - 1)) * i;
        const prev = i === 0 ? h[CHUNKS] : h[i - 1];
        this.terrainY[i] = (prev + h[i] + h[i + 1]) / 3;
      }
      this.padX1 = this.terrainX[mid - 1];
      this.padX2 = this.terrainX[mid + 1];
    }

    // zemin yüksekliği ve eğimi (parçalı doğrusal)
    ground(x) {
      const tx = this.terrainX, ty = this.terrainY;
      if (x <= tx[0]) return [ty[0], 0];
      if (x >= tx[CHUNKS - 1]) return [ty[CHUNKS - 1], 0];
      const seg = Math.min(CHUNKS - 2, Math.floor(x / (VIEW_W / (CHUNKS - 1))));
      const slope = (ty[seg + 1] - ty[seg]) / (tx[seg + 1] - tx[seg]);
      return [ty[seg] + slope * (x - tx[seg]), slope];
    }

    reset() {
      this.makeTerrain();
      this.x = VIEW_W / 2;
      this.y = VIEW_H;
      this.vx = this.uniform(-2.5, 2.5);
      this.vy = this.uniform(-2.5, 1.0);
      this.angle = 0;
      this.omega = 0;
      this.leg1 = 0; this.leg2 = 0;
      this.stepCount = 0;
      this.restSteps = 0;
      this.prevShaping = null;
      this.terminated = false;
      this.truncated = false;
      this.landed = false;
      this.crashed = false;
      this.outOfBounds = false;
      this.mainFire = false; this.sideFire = 0;
      this.updateObs();
      return this.obs;
    }

    updateObs() {
      const o = this.obs;
      o[0] = (this.x - VIEW_W / 2) / (VIEW_W / 2);
      o[1] = (this.y - (HELIPAD_Y + LEG_DOWN)) / (VIEW_H / 2);
      o[2] = this.vx * (VIEW_W / 2) / FPS;
      o[3] = this.vy * (VIEW_H / 2) / FPS;
      o[4] = this.angle;
      o[5] = 20 * this.omega / FPS;
      o[6] = this.leg1;
      o[7] = this.leg2;
    }

    // action: 0 hiçbiri, 1 sol motor, 2 ana motor, 3 sağ motor
    step(action) {
      const useMain = action === 2;
      const side = action === 1 ? -1 : action === 3 ? 1 : 0; // -1: sol motor ateşli
      this.mainFire = useMain;
      this.sideFire = side;

      const h = DT / SUBSTEPS;
      let c1 = 0, c2 = 0, hullHit = false;

      for (let s = 0; s < SUBSTEPS; s++) {
        const cs = Math.cos(this.angle), sn = Math.sin(this.angle);
        let ax = 0, ay = -GRAVITY, alpha = 0;

        if (useMain) { ax += -sn * MAIN_ACC; ay += cs * MAIN_ACC; }
        if (side !== 0) {
          // aksiyon 1 (side=-1): gövdeyi sola iter ve saat yönünün tersine döndürür (Gymnasium ile aynı)
          ax += side * cs * SIDE_ACC;
          ay += side * sn * SIDE_ACC;
          alpha -= side * SIDE_ALPHA;
        }

        c1 = 0; c2 = 0;
        for (let f = 0; f < 2; f++) {
          const lx = FEET[f][0], ly = FEET[f][1];
          const rx = lx * cs - ly * sn, ry = lx * sn + ly * cs;
          const px = this.x + rx, py = this.y + ry;
          const g = this.ground(px);
          const slope = g[1];
          const inv = 1 / Math.sqrt(1 + slope * slope);
          const nx = -slope * inv, ny = inv;
          const d = (py - g[0]) * ny;
          if (d < 0) {
            const vfx = this.vx - this.omega * ry;
            const vfy = this.vy + this.omega * rx;
            const vn = vfx * nx + vfy * ny;
            let fn = LEG_K * (-d) - LEG_C * vn;
            if (fn < 0) fn = 0;
            const tx = ny, ty = -nx;
            const vt = vfx * tx + vfy * ty;
            let ft = -FRICTION_C * vt;
            const lim = FRICTION_MU * fn;
            if (ft > lim) ft = lim; else if (ft < -lim) ft = -lim;
            const fx = fn * nx + ft * tx, fy = fn * ny + ft * ty;
            ax += fx / MASS; ay += fy / MASS;
            alpha += (rx * fy - ry * fx) / INERTIA;
            if (f === 0) c1 = 1; else c2 = 1;
          }
        }

        this.vx += ax * h; this.vy += ay * h; this.omega += alpha * h;
        this.x += this.vx * h; this.y += this.vy * h; this.angle += this.omega * h;
      }
      this.leg1 = c1; this.leg2 = c2;

      // gövde zemine değdi mi (çarpma)
      {
        const cs = Math.cos(this.angle), sn = Math.sin(this.angle);
        for (let i = 0; i < HULL.length; i++) {
          const px = this.x + HULL[i][0] * cs - HULL[i][1] * sn;
          const py = this.y + HULL[i][0] * sn + HULL[i][1] * cs;
          if (py < this.ground(px)[0]) { hullHit = true; break; }
        }
      }

      this.updateObs();
      const o = this.obs;

      let shaping =
        -100 * Math.sqrt(o[0] * o[0] + o[1] * o[1])
        - 100 * Math.sqrt(o[2] * o[2] + o[3] * o[3])
        - 100 * Math.abs(o[4])
        + 10 * o[6] + 10 * o[7];
      let reward = 0;
      if (this.prevShaping !== null) reward = shaping - this.prevShaping;
      this.prevShaping = shaping;
      if (useMain) reward -= 0.30;
      if (side !== 0) reward -= 0.03;

      this.stepCount++;
      let terminated = false;

      if (hullHit) { this.crashed = true; terminated = true; reward = -100; }
      else if (Math.abs(o[0]) >= 1) { this.outOfBounds = true; terminated = true; reward = -100; }
      else {
        const speed = Math.hypot(this.vx, this.vy);
        if (c1 && c2 && speed < 0.08 && Math.abs(this.omega) < 0.08) this.restSteps++;
        else this.restSteps = 0;
        if (this.restSteps >= 25) { this.landed = true; terminated = true; reward = 100; }
      }

      this.terminated = terminated;
      this.truncated = !terminated && this.stepCount >= MAX_STEPS;
      return reward;
    }
  }

  return { LanderEnv, FPS, VIEW_W, VIEW_H, HELIPAD_Y, LEG_DOWN, MAX_STEPS, FEET, HULL, CHUNKS };
});
