/* Scene 2: technical sheet of the active machine plus a carousel with the whole catalogue.
   Everything is drawn from Ricser.EQUIPOS, so a new machine only needs a new entry there. */
window.Ficha = (() => {
  const { EQUIPOS, equipoActivo, setEquipoActivo, onEquipo, esc } = Ricser;
  const $ = s => document.querySelector(s);
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');
  let viewIdx = 0, token = 0, onScreen = false, drawTl = null, stage, info, track, prev, next, live;

  const fullName = e => [e.nombre, e.modelo].filter(Boolean).join(' ');

  /* ---------- Carousel ---------- */
  function renderCarousel() {
    const act = equipoActivo().id;
    track.innerHTML = EQUIPOS.map(e => {
      const on = e.id === act;
      return `<button type="button" class="car-i" data-id="${e.id}" aria-pressed="${on}"${on ? ' aria-current="true"' : ''} tabindex="${on ? 0 : -1}">
        <span class="car-img"><img src="${e.thumb.src}" alt="" width="${e.thumb.w}" height="${e.thumb.h}" loading="lazy" decoding="async"></span>
        <span class="car-t"><b>${esc(e.nombre)}</b><small class="mono">${esc(e.modelo)}</small></span>
      </button>`;
    }).join('');
    updateArrows();
  }

  function syncCarousel(focus) {
    const act = equipoActivo().id;
    track.querySelectorAll('.car-i').forEach(b => {
      const on = b.dataset.id === act;
      b.setAttribute('aria-pressed', on);
      if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current');
      b.tabIndex = on ? 0 : -1;
      if (on) {
        // scrollTo, not scrollIntoView: it must never move the pinned page
        const left = b.offsetLeft - (track.clientWidth - b.offsetWidth) / 2;
        track.scrollTo({ left, behavior: motion() ? 'smooth' : 'auto' });
        if (focus) b.focus({ preventScroll: true });
      }
    });
  }

  function updateArrows() {
    const max = track.scrollWidth - track.clientWidth - 2;
    prev.disabled = track.scrollLeft <= 2;
    next.disabled = track.scrollLeft >= max;
  }

  function step(dir, focus) {
    const i = EQUIPOS.findIndex(e => e.id === equipoActivo().id);
    const n = Math.max(0, Math.min(EQUIPOS.length - 1, i + dir));
    if (n !== i) setEquipoActivo(EQUIPOS[n].id, { focus });
  }

  /* ---------- Sheet ---------- */
  function overlays(e, img) {
    const H = 1000 / (img.w / img.h), X = v => v * 10, Y = v => v * H / 100;
    if (img.vista === 'cotas' && e.cotas) {
      const cota = c => {
        const [x1, y1] = c.de, [x2, y2] = c.a;
        const ang = Math.atan2(Y(y2) - Y(y1), X(x2) - X(x1));
        const nx = -Math.sin(ang) * 11, ny = Math.cos(ang) * 11;
        const tick = (x, y) => `M${X(x) - nx} ${Y(y) - ny}L${X(x) + nx} ${Y(y) + ny}`;
        const mx = X((x1 + x2) / 2) + nx * 2.3 * c.lado, my = Y((y1 + y2) / 2) + ny * 2.3 * c.lado;
        let deg = ang * 180 / Math.PI;
        if (deg > 90 || deg < -90) deg += 180;
        return `<path class="fi-ln" d="M${X(x1)} ${Y(y1)}L${X(x2)} ${Y(y2)}${tick(x1, y1)}${tick(x2, y2)}"/>
          <text class="fi-tx" x="${mx}" y="${my}" transform="rotate(${deg} ${mx} ${my})" text-anchor="middle" dominant-baseline="middle">${esc(c.t)}</text>`;
      };
      return `<svg class="fi-lines" viewBox="0 0 1000 ${H}" aria-hidden="true">${e.cotas.map(cota).join('')}</svg>`;
    }
    if (img.vista !== 'callouts' || !e.callouts.length) return '';
    const lines = e.callouts.map(c => {
      const end = c.pos === 'abajo' ? '' : `H${X(c.l[0])}`;
      return `<path class="fi-ln" d="M${X(c.a[0])} ${Y(c.a[1])}V${Y(c.l[1])}${end}"/>`;
    }).join('');
    const marks = e.callouts.map(c => `<i class="fi-dot" style="left:${c.a[0]}%;top:${c.a[1]}%"></i>
      <p class="fi-co ${c.pos || 'der'}" style="left:${c.l[0]}%;top:${c.l[1]}%">${esc(c.t)}</p>`).join('');
    return `<svg class="fi-lines" viewBox="0 0 1000 ${H}" aria-hidden="true">${lines}</svg><div class="fi-marks" aria-hidden="true">${marks}</div>`;
  }

  function hideOverlay(root) {
    if (!motion()) return;
    drawTl?.kill(); drawTl = null;
    root.querySelectorAll('.fi-ln').forEach(p => { const L = p.getTotalLength(); gsap.set(p, { strokeDasharray: L, strokeDashoffset: L }); });
    const marks = root.querySelectorAll('.fi-dot, .fi-co, .fi-tx');
    if (marks.length) gsap.set(marks, { autoAlpha: 0 });
  }

  // Leader lines draw from the point on the machine towards their label
  function drawOverlay(root) {
    if (!motion() || !root) return;
    hideOverlay(root);
    const paths = [...root.querySelectorAll('.fi-ln')];
    if (!paths.length) return;
    const dots = [...root.querySelectorAll('.fi-dot')], labels = [...root.querySelectorAll('.fi-co, .fi-tx')];
    drawTl = gsap.timeline();
    paths.forEach((p, i) => {
      const at = i * .13;
      if (dots[i]) drawTl.fromTo(dots[i], { autoAlpha: 0, scale: 0 }, { autoAlpha: 1, scale: 1, duration: .28, ease: 'back.out(2.4)' }, at);
      drawTl.to(p, { strokeDashoffset: 0, duration: .5, ease: 'power2.inOut' }, at + .06);
      if (labels[i]) drawTl.fromTo(labels[i], { autoAlpha: 0 }, { autoAlpha: 1, duration: .3, ease: 'power2.out' }, at + .36);
    });
  }

  function showView(e, idx) {
    const img = e.imagenes[idx] || e.imagenes[0];
    viewIdx = e.imagenes.indexOf(img);
    const my = ++token;
    const hasOverlay = img.vista === 'cotas' || (img.vista === 'callouts' && e.callouts.length);
    const view = document.createElement('div');
    view.className = 'fi-view';
    view.innerHTML = `<div class="fi-fit" style="--r:${(img.w / img.h).toFixed(4)};--k:${hasOverlay ? 74 : 88}cqh">
      <i class="fi-glow"></i>
      <img src="${img.src}" alt="${esc(fullName(e))}, ${esc(img.label.toLowerCase())}" width="${img.w}" height="${img.h}" decoding="async">
      ${overlays(e, img)}
    </div>`;
    const pic = view.querySelector('img');
    const old = [...stage.querySelectorAll('.fi-view')];
    if (motion()) gsap.set(view, { autoAlpha: 0 });
    stage.appendChild(view);
    hideOverlay(view);
    const swap = () => {
      if (my !== token) { view.remove(); return; }
      if (!motion()) { old.forEach(o => o.remove()); return; }
      gsap.fromTo(view, { autoAlpha: 0, scale: .985 }, { autoAlpha: 1, scale: 1, duration: .45, ease: 'power2.out', clearProps: 'transform' });
      old.forEach(o => gsap.to(o, { autoAlpha: 0, duration: .32, ease: 'power1.in', onComplete: () => o.remove() }));
      if (onScreen) drawOverlay(view);
    };
    // Wait for the file, so the crossfade never reveals a half-painted image
    if (pic.decode) pic.decode().then(swap, swap); else swap();
  }

  function renderInfo(e) {
    const tabs = e.imagenes.length > 1 ? `<div class="fi-tabs" role="group" aria-label="Vistas del equipo">${e.imagenes.map((m, i) => `<button type="button" class="chip" data-view="${i}" aria-pressed="${i === viewIdx}">${esc(m.label)}</button>`).join('')}</div>` : '';
    const specs = e.specs.length
      ? `<dl class="fi-specs">${e.specs.map(s => `<div><dt>${esc(s.k)}</dt><dd>${esc(s.v)}</dd></div>`).join('')}</dl>`
      : '<p class="fi-pend">Datos técnicos a confirmar con Ricser.</p>';
    const mats = e.materiales.length ? `<div class="fi-mats"><h3>Imprime sobre</h3><ul>${e.materiales.map(m => `<li class="mat"><img src="${m.img}" alt="" width="128" height="128" loading="lazy" decoding="async"><span>${esc(m.n)}</span></li>`).join('')}</ul></div>` : '';
    info.innerHTML = `${e.marca ? `<p class="fi-brand">${esc(e.marca)}</p>` : ''}
      <h2 class="fi-name">${esc(e.nombre)} <em>${esc(e.modelo)}</em></h2>${tabs}${specs}${mats}`;
    if (motion()) gsap.fromTo(info.children, { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .36, stagger: .035, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
  }

  function show(e, focus) {
    viewIdx = 0;
    renderInfo(e);
    showView(e, 0);
    syncCarousel(focus);
    live.textContent = `${fullName(e)} seleccionado.`;
  }

  /* ---------- Wiring ---------- */
  function init() {
    stage = $('#fiStage'); info = $('#fiInfo'); track = $('#carTrack'); prev = $('#carPrev'); next = $('#carNext'); live = $('#fiLive');
    renderCarousel();
    renderInfo(equipoActivo());
    showView(equipoActivo(), 0);

    track.addEventListener('click', ev => {
      const b = ev.target.closest('.car-i');
      if (b && b.dataset.id !== equipoActivo().id) setEquipoActivo(b.dataset.id);
    });
    track.addEventListener('scroll', updateArrows, { passive: true });
    window.addEventListener('resize', updateArrows, { passive: true });
    const page = dir => track.scrollBy({ left: dir * track.clientWidth * .8, behavior: motion() ? 'smooth' : 'auto' });
    prev.addEventListener('click', () => page(-1));
    next.addEventListener('click', () => page(1));

    track.addEventListener('keydown', ev => {
      const keys = { ArrowRight: 1, ArrowLeft: -1 };
      if (keys[ev.key]) { ev.preventDefault(); step(keys[ev.key], true); return; }
      if (ev.key === 'Home' || ev.key === 'End') { ev.preventDefault(); setEquipoActivo(EQUIPOS[ev.key === 'Home' ? 0 : EQUIPOS.length - 1].id, { focus: true }); }
    });
    // With the scene on screen, the arrow keys also work without first tabbing into the carousel
    document.addEventListener('keydown', ev => {
      if (ev.key !== 'ArrowRight' && ev.key !== 'ArrowLeft') return;
      if (!onScreen || ev.target.closest?.('input,select,textarea,video,dialog,#carTrack')) return;
      ev.preventDefault();
      step(ev.key === 'ArrowRight' ? 1 : -1, false);
    });

    info.addEventListener('click', ev => {
      const b = ev.target.closest('[data-view]');
      if (!b) return;
      const i = Number(b.dataset.view);
      info.querySelectorAll('[data-view]').forEach(x => x.setAttribute('aria-pressed', x === b));
      showView(equipoActivo(), i);
    });

    onEquipo((e, opts) => show(e, opts && opts.focus));
  }

  // The timeline calls these when the scene arrives and leaves
  function enter() {
    onScreen = true;
    updateArrows();
    const v = stage.querySelector('.fi-view:last-child');
    if (motion()) drawOverlay(v);
  }
  function leave() {
    onScreen = false;
    const v = stage.querySelector('.fi-view:last-child');
    if (v) hideOverlay(v);
  }

  return { init, enter, leave };
})();
