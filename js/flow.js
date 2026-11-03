/* Airflow: horizontal streaks that bend around the machine (behind and in front of it),
   plus a particle phrase that assembles from the stream and blows away with the scroll. */
window.Flow = (() => {
  const PHRASE = ['PRECISIÓN INDUSTRIAL', 'HANCOLOR'];
  let back, front, cb, cf, W = 0, H = 0, dpr = 1, streaks = [], pts = [], ready = false;

  function ctxOf(c) { return c.getContext('2d'); }

  function makeStreaks() {
    const n = W < 860 ? 110 : 260;
    streaks = Array.from({ length: n }, (_, i) => ({
      x: Math.random() * W,
      y: Math.random() * H,
      v: .6 + Math.random() * 1.8,
      l: 20 + Math.random() * 110,
      a: .25 + Math.random() * .75,
      layer: i % 2,
      tone: Math.random() < .7 ? 0 : 1,
    }));
  }

  function makePhrase() {
    const mobile = W < 860;
    const off = document.createElement('canvas');
    off.width = W; off.height = H;
    const c = off.getContext('2d', { willReadFrequently: true });
    let size = mobile ? W * .083 : Math.min(W * .05, H * .095);
    c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillStyle = '#fff';
    const font = s => { c.font = `800 ${s}px Archivo, Arial, sans-serif`; if ('fontStretch' in c) c.fontStretch = 'expanded'; };
    font(size);
    const widest = Math.max(...PHRASE.map(p => c.measureText(p).width));
    if (widest > W * .92) { size *= W * .92 / widest; font(size); }
    const cy = H * (mobile ? .73 : .77);
    PHRASE.forEach((p, i) => c.fillText(p, W / 2, cy + (i - .5) * size * 1.14));
    const d = c.getImageData(0, 0, W, H).data;
    const step = mobile ? 2 : 3;
    pts = [];
    for (let y = 0; y < H; y += step) for (let x = 0; x < W; x += step) {
      if (d[(y * W + x) * 4 + 3] > 130) pts.push({ x, y, r: Math.random(), o: Math.random() * W * .9 + W * .2, j: Math.random() * 6.28 });
    }
    if (pts.length > 9000) { const k = 9000 / pts.length; pts = pts.filter(() => Math.random() < k); }
  }

  function resize() {
    if (!back) return;
    W = innerWidth; H = back.parentNode.offsetHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.5);
    [back, front].forEach(c => { c.width = W * dpr; c.height = H * dpr; });
    makeStreaks(); makePhrase();
    ready = true;
  }

  function init(b, f) {
    back = b; front = f; cb = ctxOf(b); cf = ctxOf(f);
    resize();
  }

  // Bend around an ellipse centered on the machine
  function bend(x, y0, cx, cy) {
    const small = W < 860;
    const dx = (x - cx) / (W * (small ? .5 : .27)), bump = Math.exp(-dx * dx);
    const side = y0 < cy ? -1 : 1, near = 1 - Math.min(1, Math.abs(y0 - cy) / (H * .46));
    return y0 + side * near * near * H * (small ? .1 : .3) * bump;
  }

  function draw(S, dt, t) {
    if (!ready) return;
    cb.setTransform(dpr, 0, 0, dpr, 0, 0); cf.setTransform(dpr, 0, 0, dpr, 0, 0);
    cb.clearRect(0, 0, W, H); cf.clearRect(0, 0, W, H);
    if (S.flow < .01 && (S.word <= 0 || S.word >= 2)) return;

    const cx = W / 2, cy = H * .5;
    const speed = (.35 + S.flow * 3.6) * dt * 60;
    const drop = (S.drop || 0) * H; // opening descent: the air rises past the camera, nearer streaks faster
    const colors = ['#50bab7', '#2982a3'];
    for (let lay = 0; lay < 2; lay++) {
      const ctx = lay ? cf : cb;
      ctx.lineWidth = 1;
      for (let tone = 0; tone < 2; tone++) {
        ctx.strokeStyle = colors[tone];
        for (let bucket = 0; bucket < 3; bucket++) {
          ctx.globalAlpha = Math.min(1, (.12 + S.flow * .72) * (.35 + bucket * .32));
          ctx.beginPath();
          for (let i = 0; i < streaks.length; i++) {
            const p = streaks[i];
            if (p.layer !== lay || p.tone !== tone || (i % 3) !== bucket) continue;
            const len = p.l * (.5 + S.flow * 1.3);
            const y0 = drop ? (((p.y + drop * (lay ? 1 : .6)) % H) + H) % H : p.y;
            ctx.moveTo(p.x - len, bend(p.x - len, y0, cx, cy));
            ctx.lineTo(p.x, bend(p.x, y0, cx, cy));
          }
          ctx.stroke();
        }
      }
    }
    for (const p of streaks) { p.x += p.v * speed; if (p.x > W + 160) { p.x = -40; p.y = Math.random() * H; } }
    cb.globalAlpha = cf.globalAlpha = 1;

    // Particle phrase: word 0→1 assembles from the right, word 1→2 blows out to the left
    if (S.word > 0 && S.word < 2 && pts.length) {
      const inP = Math.min(1, S.word), outP = Math.max(0, S.word - 1);
      cf.fillStyle = '#7fdcd8';
      const size = W < 860 ? 1.3 : 1.7;
      for (let i = 0; i < pts.length; i++) {
        const p = pts[i];
        const k = Math.min(1, Math.max(0, inP * 1.7 - p.r * .7));
        const e = 1 - (1 - k) ** 3;
        const q = Math.min(1, Math.max(0, outP * 1.7 - p.r * .7));
        const x = p.x + (1 - e) * p.o - q * q * (p.o + W * .35) + Math.sin(t * 2 + p.j) * .5;
        const y = p.y + Math.sin(t * 1.4 + p.j + p.x * .01) * .7 * (1 + (1 - e) * 6);
        cf.globalAlpha = e * (1 - q) * .95;
        const stretch = 1 + (1 - e + q) * 22;
        cf.fillRect(x, y, size * stretch, size);
      }
      cf.globalAlpha = 1;
    }
  }

  return { init, resize, draw };
})();
