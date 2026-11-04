/* Scene 4: spare-parts tracker. Six stages for warranty parts (plane on the arc, truck on the ground rail),
   four for supplies (truck only). Reads live from Ricser, so admin and factory edits move the vehicles. */
window.Tracker = (() => {
  const { EQ, TYPES, ICON, esc, fmt, done, findShipment, shipmentsOf, codeOf, on } = Ricser;
  const $ = s => document.querySelector(s);

  // Rail geometry in viewBox units
  const AIR = { d: 'M50 186 L410 186 C500 186 530 52 640 52 C750 52 780 186 870 186 L1150 186', nodes: [[50, 186], [230, 186], [410, 186], [640, 52], [870, 186], [1150, 186]] };
  const GROUND = { d: 'M50 186 L1150 186', nodes: [[50, 186], [417, 186], [783, 186], [1150, 186]] };

  let cur = null, vehTween = null, lastPos = null, renderHook = null;
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');

  function nearestLen(path, x, y) {
    const total = path.getTotalLength(); let best = 0, bd = Infinity;
    for (let i = 0; i <= 300; i++) {
      const l = total * i / 300, p = path.getPointAtLength(l), d = (p.x - x) ** 2 + (p.y - y) ** 2;
      if (d < bd) { bd = d; best = l; }
    }
    return best;
  }

  function header(e, q) {
    const T = TYPES[e.t];
    const stage = T.steps[e.s];
    return `<div class="cp-top">
      <div class="cp-id"><b class="mono">${esc(codeOf(e))}</b><span>${esc(q.m)} · Serie ${esc(q.s)}</span></div>
      <span class="pill ${done(e) ? 'ok' : ''}"><i class="dot"></i>${esc(stage)}</span>
    </div>`;
  }

  function dataStrip(e, q) {
    const T = TYPES[e.t];
    const rows = e.t === 'repuesto' ? [
      ['Pieza', esc(e.ti)],
      ['Guía aérea', e.guia ? esc(e.guia) : 'Pendiente de fábrica'],
      ['Transportista', e.carrier ? esc(e.carrier) : 'A confirmar'],
      ['Llegada estimada', e.eta ? fmt(e.eta) : 'A confirmar'],
      ['Etapa', `${e.s + 1} de ${T.steps.length}`],
    ] : [
      ['Pedido', esc(e.ti)],
      ['Inicio', fmt(e.d)],
      ['Transporte', 'Distribución local'],
      ['Etapa', `${e.s + 1} de ${T.steps.length}`],
    ];
    return `<dl class="cp-data">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${r[1]}</dd></div>`).join('')}</dl>`;
  }

  function list(e) {
    const T = TYPES[e.t];
    return `<ol class="rail-v">${T.steps.map((s, k) => {
      const st = k < e.s || done(e) ? 'd' : k === e.s ? 'n' : '';
      const showIcon = k === e.s;
      const icon = (e.t === 'repuesto' && k >= 4) || e.t === 'insumo' ? ICON.truck : ICON.plane;
      const last = k === T.steps.length - 1;
      return `<li class="${st}"><span class="rv-n${last ? ' portal-target' : ''}">${showIcon ? icon : ''}</span><span>${esc(s)}</span></li>`;
    }).join('')}</ol>`;
  }

  function svg(e) {
    const G = e.t === 'repuesto' ? AIR : GROUND;
    const T = TYPES[e.t];
    const nodes = G.nodes.map((n, k) => {
      const st = k < e.s || done(e) ? 'd' : k === e.s ? 'n' : '';
      const air = e.t === 'repuesto' && k === 3;
      const last = k === G.nodes.length - 1;
      const label = T.steps[k].split(' ');
      // two-line labels so that long stage names never collide
      const mid = Math.ceil(label.length / 2);
      const lines = label.length > 1 ? [label.slice(0, mid).join(' '), label.slice(mid).join(' ')] : [T.steps[k]];
      const ly = air ? n[1] - 34 - (lines.length - 1) * 18 : n[1] + 46; // clears the vehicle parked on the node
      const anchor = k === 0 ? 'start' : last ? 'end' : 'middle';
      const lx = k === 0 ? n[0] - 16 : last ? n[0] + 16 : n[0];
      return `<g class="node ${st}">
        ${last ? `<g class="portal-target" transform="translate(${n[0]} ${n[1]})"><circle r="14"/><path d="M0-24V24M-24 0H24"/></g>` : `<circle cx="${n[0]}" cy="${n[1]}" r="7"/>`}
        <text x="${lx}" y="${ly}" text-anchor="${anchor}">${lines.map((l, i) => `<tspan x="${lx}" dy="${i ? 18 : 0}">${esc(l)}</tspan>`).join('')}</text>
      </g>`;
    }).join('');
    return `<svg id="railSvg" viewBox="0 0 1200 250" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(T.steps[e.s])}, etapa ${e.s + 1} de ${T.steps.length}">
      <defs><linearGradient id="litG" x1="0" x2="1"><stop offset="0" stop-color="#2982a3"/><stop offset="1" stop-color="#50bab7"/></linearGradient></defs>
      <path class="r-base" d="${G.d}"/>
      <path class="r-glow" id="rGlow" d="${G.d}"/>
      <path class="r-lit" id="rLit" d="${G.d}"/>
      <path class="r-flow" id="rFlow" d="${G.d}"/>
      ${nodes}
      ${e.t === 'repuesto' ? `<g class="veh" id="vPlane"><circle class="veh-p" r="26"/><g transform="translate(-20 -20) scale(1.660)">${inner(ICON.plane)}</g></g>` : ''}
      <g class="veh" id="vTruck"><circle class="veh-p" r="26"/><g transform="translate(-24 -22) scale(1.500)">${inner(ICON.truck)}</g></g>
    </svg>`;
  }
  const inner = s => s.replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '');

  // Path length at each stage marker. The search is slow and the rail geometry never changes, so it runs once
  function nodeLens(e, path) {
    const G = e.t === 'repuesto' ? AIR : GROUND;
    return G.L || (G.L = G.nodes.map(n => nearestLen(path, n[0], n[1])));
  }

  // Lengths along the path for the plane and truck at every stage
  function stops(e, path) {
    const L = nodeLens(e, path);
    if (e.t === 'repuesto') {
      const atStage = [L[0], L[1], L[2], L[3], L[4] + (L[5] - L[4]) * .5, L[5]];
      return { lit: atStage[e.s], plane: e.s >= 4 ? L[4] : e.s === 3 ? L[3] : L[2], truck: e.s >= 5 ? L[5] : e.s === 4 ? atStage[4] : L[4] };
    }
    const mid = [L[0], L[1], L[2], L[3]];
    return { lit: mid[e.s], truck: mid[e.s] };
  }

  function place(el, path, len, flat) {
    if (!el) return;
    const p = path.getPointAtLength(len);
    let a = 0;
    if (!flat) {
      const q = path.getPointAtLength(Math.min(path.getTotalLength(), len + 2)), r = path.getPointAtLength(Math.max(0, len - 2));
      a = Math.atan2(q.y - r.y, q.x - r.x) * 180 / Math.PI;
    }
    el.setAttribute('transform', `translate(${p.x} ${p.y}) rotate(${a})`);
  }

  function animate(e, from, deferPlay) {
    const path = $('#rLit'), glow = $('#rGlow');
    if (!path) return;
    const s = stops(e, path), L = nodeLens(e, path), plane = $('#vPlane'), truck = $('#vTruck'), total = path.getTotalLength();
    const start = from || (e.t === 'repuesto' ? { lit: 0, plane: L[2], truck: L[4] } : { lit: 0, plane: 0, truck: 0 });
    if (e.t !== 'repuesto') start.plane = 0;
    const state = Object.assign({}, start);
    const apply = () => {
      path.style.strokeDasharray = glow.style.strokeDasharray = `${state.lit} ${total}`;
      place(plane, path, state.plane);
      place(truck, path, state.truck, true);
    };
    if (vehTween) vehTween.kill();
    if (deferPlay && motion()) {
      apply();
      lastPos = null;
    } else if (motion()) {
      vehTween = gsap.to(state, { lit: s.lit, plane: s.plane === undefined ? 0 : s.plane, truck: s.truck, duration: 1.8, ease: 'power2.inOut', onUpdate: apply, onComplete: () => { lastPos = Object.assign({}, state); } });
    } else {
      Object.assign(state, { lit: s.lit, plane: s.plane || 0, truck: s.truck }); apply(); lastPos = Object.assign({}, state);
    }
    apply();
    $('#vPlane')?.classList.toggle('dim', e.s < 3 || e.s >= 4);
    $('#vPlane')?.classList.toggle('live', e.s === 3);
    $('#vTruck')?.classList.toggle('dim', e.t === 'repuesto' && e.s < 4);
    $('#vTruck')?.classList.toggle('live', (e.t === 'repuesto' && e.s === 4) || (e.t === 'insumo' && !done(e)));
    $('#rFlow')?.classList.toggle('off', done(e));
  }

  function syncChips(selectedEqId) {
    const activeEq = selectedEqId !== undefined ? selectedEqId : (cur && cur.eq);
    $('#trkEq').innerHTML = EQ.map(q => {
      const sel = activeEq === q.id;
      return `<button type="button" class="chip chip-eq" data-eq="${q.id}" aria-pressed="${!!sel}"><img src="${q.img}" alt="" width="${q.iw}" height="${q.ih}" loading="lazy"><span>${esc(q.m)}</span></button>`;
    }).join('');
    document.querySelectorAll('.trk-quick [data-code]').forEach(btn => {
      const code = btn.dataset.code;
      const isMatch = !!cur && [cur.caso, cur.pedido, cur.guia].some(c => c && c === code);
      btn.setAttribute('aria-pressed', String(isMatch));
    });
  }

  function render(animFrom, opts = {}) {
    const box = $('#cockpit');
    syncChips(opts.eqId);
    if (!cur) {
      box.innerHTML = `<div class="cp-empty">${ICON.reg}<p><b>Sin envíos en curso para este equipo.</b></p><p>Si necesitás un repuesto, abrí un reclamo desde el portal del cliente.</p><button type="button" class="btn ghost" data-go="portal">Ir al portal</button></div>`;
      renderHook?.();
      return;
    }
    const q = EQ.find(x => x.id === cur.eq);
    box.innerHTML = header(cur, q) + `<div class="cp-rail">${svg(cur)}${list(cur)}</div>` + dataStrip(cur, q);
    animate(cur, animFrom, opts.deferPlay);
    renderHook?.();
  }

  function select(e, opts = {}) {
    const same = cur && e && cur.id === e.id;
    cur = e;
    render(same && !opts.deferPlay ? lastPos : null, opts);
    if (opts.fromSearch) $('#trkMsg').textContent = '';
  }

  function search(q, opts = {}) {
    const msg = $('#trkMsg');
    if (!String(q || '').trim()) { msg.textContent = 'Ingresá un código, por ejemplo GAR-2026-0042.'; msg.className = 'err'; return false; }
    const hit = findShipment(q);
    if (!hit) {
      msg.textContent = `No encontramos "${q}". Revisá el código: caso (GAR-2026-0042), pedido (PED-2026-0003) o guía aérea (AWB 176-4410 2290).`;
      msg.className = 'err';
      return false;
    }
    msg.textContent = ''; msg.className = '';
    $('#trkIn').value = codeOf(hit);
    select(hit, { fromSearch: true, deferPlay: !!opts.deferPlay });
    return true;
  }

  function init() {
    $('#trkForm').addEventListener('submit', ev => { ev.preventDefault(); search($('#trkIn').value); });
    document.querySelector('.trk-quick').addEventListener('click', ev => {
      const c = ev.target.closest('[data-code]');
      if (c) { $('#trkIn').value = c.dataset.code; search(c.dataset.code); return; }
      const b = ev.target.closest('[data-eq]');
      if (b) {
        const list = shipmentsOf(b.dataset.eq);
        const msg = $('#trkMsg'); msg.textContent = ''; msg.className = '';
        if (list[0]) {
          $('#trkIn').value = codeOf(list[0]);
          select(list[0]);
        } else {
          $('#trkIn').value = '';
          select(null, { eqId: b.dataset.eq });
        }
      }
    });
    cur = findShipment('GAR-2026-0042');
    $('#trkIn').value = codeOf(cur);
    render();
    on(src => {
      // Keep the open shipment live; if a new order was just created, stay on the current one
      if (cur) render(lastPos);
      else syncChips();
    });
  }

  // Called by the timeline when the scene arrives, so the plane takes off on screen.
  // It only restarts the vehicles: rebuilding the rail here would stall the scroll in progress.
  function play() {
    if (cur) animate(cur, null, false);
  }
  const onRender = fn => { renderHook = fn; };

  // Stage-local position of the final stage marker: the camera flies into it in portal #2
  function anchor() {
    const stage = document.getElementById('stage');
    const sr = stage ? stage.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    const els = [...document.querySelectorAll('#cockpit .portal-target')];
    const el = els.find(x => x.getBoundingClientRect().width > 0);
    if (!el) return { x: sr.width / 2, y: sr.height / 2 };
    const r = el.getBoundingClientRect();
    return { x: r.left - sr.left + r.width / 2, y: r.top - sr.top + r.height / 2 };
  }

  return { init, search, play, anchor, select, onRender };
})();
