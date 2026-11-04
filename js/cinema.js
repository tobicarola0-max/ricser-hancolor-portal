/* Scroll direction: Lenis + GSAP ScrollTrigger.
   One pinned stage with a single scrubbed master timeline (1 timeline unit = 1 viewport of scroll).
   Scenes overlap inside the stage, which is what lets each portal reveal the next scene from inside the previous one. */
(() => {
  const html = document.documentElement;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];

  /* Optional AI video plates (see PROMPTS-VIDEO-IA.md). They play over the procedural background during the
     given timeline range. Example: { src: 'assets/video/hero.mp4', from: 0, to: 1.6, opacity: .6 } */
  const VIDEO_PLATES = [];

  const TOTAL = 9.8;
  const LABELS = { s1: 0, s2: 2.2, s3: 4.95, s4: 7.65 };
  const P2 = 8.6; // start of portal #2
  const NAMES = [[0, '01', 'THE AWAKENING', 's1'], [1.6, '02', 'INFORMACIÓN TÉCNICA', 's2'], [4.5, '03', 'INSTITUCIONAL', 's3'], [7.1, '04', 'TELEMETRÍA LOGÍSTICA', 's4'], [P2 + .5, '05', 'COMMAND CENTER', 'portal']];

  // Shared state read by the WebGL/canvas layers and written by the timeline
  const S = { flow: .22, ring: 0, beam: 0, word: 0, drop: 0, morph: 0, blow: 0, htZoom: .55, ringY: -.36, ringX: 0, ringS: 1, mx: 0, my: 0 };

  Tracker.init();
  Portal.init();
  Ficha.init();
  $('#quickIn').addEventListener('input', () => { $('#quickMsg').textContent = ''; });

  // Shared by the animated site and the static fallback: a code that exists goes to the tracker, anything else stays here
  function quickSearch(send) {
    const q = $('#quickIn').value.trim(), msg = $('#quickMsg');
    if (!q) { msg.textContent = 'Ingresá un código, por ejemplo GAR-2026-0042.'; $('#quickIn').focus(); return; }
    if (!Tracker.search(q, { deferPlay: true })) { msg.textContent = `No encontramos "${q}". Probá con GAR-2026-0042.`; $('#quickIn').focus(); return; }
    msg.textContent = '';
    send();
  }

  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  // ?static previews the fallback that reduced-motion users get
  if (!window.gsap || !window.ScrollTrigger || !window.Lenis || reduce || location.search.includes('static')) return staticMode();

  gsap.registerPlugin(ScrollTrigger);
  ScrollTrigger.config({ ignoreMobileResize: true });

  /* ---------- Lenis, driven by the GSAP ticker ---------- */
  const lenis = new Lenis({ lerp: .085, smoothWheel: true, wheelMultiplier: .9 });
  window.__lenis = lenis;
  lenis.on('scroll', ScrollTrigger.update);
  gsap.ticker.add(t => lenis.raf(t * 1000));
  gsap.ticker.lagSmoothing(0);

  const deepLink = location.hash === '#portal';
  let tl = null, st = null, bgPaused = false, hudIdx = -1, played = false, measureA2 = null;
  const irisEl = $('#iris');

  if (deepLink) gsap.set('#boot', { display: 'none' }); else lenis.stop();

  // Any input during the opening shortens it: nobody gets held back from the page
  const LOGO_HOLD = 2100;
  const SKIP_EVENTS = ['wheel', 'touchstart', 'keydown', 'pointerdown'];
  let skipped = false, endHold = () => {}, introTl = null;
  const onSkip = () => { skipped = true; endHold(); introTl?.timeScale(3.5); };
  if (!deepLink) SKIP_EVENTS.forEach(e => window.addEventListener(e, onSkip, { passive: true }));

  bootSequence(start);

  function bootSequence(cb) {
    const imgs = $$('#lMachine img'); // only the hero: the catalogue loads lazily
    const p = { v: 0 }; let n = 0;
    const tick = () => {
      n++;
      gsap.to(p, { v: n / imgs.length * 100, duration: .4, overwrite: true, onUpdate: () => {
        $('#bootBar').style.transform = `scaleX(${p.v / 100})`;
      } });
    };
    imgs.forEach(i => { if (i.complete) tick(); else { i.addEventListener('load', tick, { once: true }); i.addEventListener('error', tick, { once: true }); } });
    const fonts = document.fonts ? Promise.all([document.fonts.load('800 40px Archivo'), document.fonts.load('500 14px "JetBrains Mono"')]).catch(() => {}) : Promise.resolve();
    const decoded = Promise.all(imgs.map(i => (i.decode ? i.decode().catch(() => {}) : null)));
    // The logo stays until the page is ready, and long enough to finish assembling
    const hold = new Promise(r => {
      if (deepLink || skipped) return r();
      endHold = r;
      setTimeout(r, Math.max(0, LOGO_HOLD - (performance.now() - (window.__bootT0 || 0))));
    });
    Promise.race([Promise.all([fonts, decoded]), new Promise(r => setTimeout(r, 6000))]).then(() => hold).then(cb);
  }

  function start() {
    RicserBG.init($('#bg'));
    Flow.init($('#flowBack'), $('#flowFront'));
    if (!Halftone.init($('#halftone'))) html.classList.add('no-webgl');
    videoPlates();

    const mm = gsap.matchMedia();
    mm.add({ desk: '(min-width: 861px)', mob: '(max-width: 860px)' }, ctx => buildTimeline(!!ctx.conditions.mob));

    ScrollTrigger.create({ trigger: '#portal', start: 'top 30%', end: 'max', onToggle: self => { bgPaused = self.isActive; } });

    gsap.ticker.add(render);
    pointer();
    wireNav();
    window.addEventListener('resize', debounce(onResize, 180));

    ScrollTrigger.refresh();
    // The pin adds its spacer after Lenis has measured the page: its scroll limit must be updated
    lenis.resize();
    ScrollTrigger.addEventListener('refresh', () => { lenis.resize(); measureA2?.(); if (tl) { hudIdx = -1; updateHud(tl.time()); } });
    if (deepLink) {
      S.ring = 0; S.beam = 1;
      gsap.set('.brand, #scenes, .hd-r, #hud', { clearProps: 'opacity,visibility' });
      lenis.scrollTo('#portal', { immediate: true, force: true, offset: -portalOffset() });
      ScrollTrigger.update();
      RicserBG.draw(S, 3);
      return;
    }
    intro();
  }

  /* ---------- Opening cinematic ----------
     The logo assembles first (CSS in site.css, so it does not depend on the network). Then the camera descends:
     the wall holding the logo rises, the logo travels to its place in the header, and the floor, the machine and
     the air come up from below. Everything moves upward on screen because the viewer is going down. */
  function intro() {
    const boot = $('#boot'), logo = $('.bt-logo');
    const from = logo.getBoundingClientRect(), to = $('.brand img').getBoundingClientRect();
    const H = innerHeight, D = 1.6, restY = S.ringY, ease = 'expo.inOut';

    gsap.set('.brand, #scenes, .hd-r', { autoAlpha: 0 });
    S.ringY = restY - 1.25; S.drop = 1.25; S.flow = .75;

    const i = introTl = gsap.timeline({
      onComplete: () => {
        gsap.set(boot, { display: 'none' });
        SKIP_EVENTS.forEach(e => window.removeEventListener(e, onSkip));
      },
    });
    i.timeScale(skipped ? 3.5 : 1);
    i.to('.bt-bar', { autoAlpha: 0, duration: .22 }, 0)
      .set('.bt-edge', { opacity: 1 }, .05)
      .to('.bt-plate', { yPercent: -100, duration: D, ease }, .05)
      .to('.bt-halo', { autoAlpha: 0, duration: .6, ease: 'power2.in' }, .05)
      .to(logo, {
        x: to.left + to.width / 2 - (from.left + from.width / 2),
        y: to.top + to.height / 2 - (from.top + from.height / 2),
        scale: to.width / from.width,
        duration: D, ease,
      }, .05)
      .to(S, { ringY: restY, drop: 0, duration: D + .1, ease }, .05)
      .to(S, { ring: 1, beam: 1, duration: D, ease: 'power2.out' }, .1)
      .to(S, { flow: .22, duration: D - .3, ease: 'power2.inOut' }, .3)
      .fromTo('.mm-grid', { y: H * .4 }, { y: 0, duration: D + .05, ease, clearProps: 'transform' }, .05)
      .fromTo('#rigOuter', { y: H * .72, autoAlpha: .25 }, { y: 0, autoAlpha: 1, duration: D + .35, ease }, .05)
      .from('.m1 .mi', { yPercent: 112, duration: 1.15, ease: 'expo.out' }, D * .6)
      .from('.m2 .mi', { yPercent: 112, duration: 1.15, ease: 'expo.out' }, D * .6 + .09)
      .from('.s1-copy > *', { y: 18, autoAlpha: 0, duration: .55, stagger: .07, ease: 'power3.out', clearProps: 'transform,opacity,visibility' }, D * .85)
      .from('#hud', { autoAlpha: 0, duration: .6, clearProps: 'opacity,visibility' }, D * .9)
      .to('#scenes, .hd-r', { autoAlpha: 1, duration: .5, clearProps: 'opacity,visibility' }, D * .85)
      // The flying logo lands exactly over the header logo and hands over to it
      .set('.brand', { autoAlpha: 1 }, D + .06)
      .set(logo, { autoAlpha: 0 }, D + .07)
      .call(() => { boot.style.pointerEvents = 'none'; lenis.start(); }, null, D + .08);
  }

  /* ---------- Master timeline ---------- */
  function buildTimeline(isMob) {
    const stage = $('#stage'), rigOuter = $('#rigOuter');
    // Light pool centered on the base of the machine
    const restRingY = isMob ? -.12 : -.31;
    S.ringY = restRingY; S.ringS = isMob ? .6 : 1; S.ringX = 0;

    // Initial state
    gsap.set('#v34', { rotationY: 5, autoAlpha: 1, transformOrigin: '50% 60%' });
    gsap.set('#rig', { scale: 1, x: 0, y: 0, transformOrigin: '50% 50%' });
    gsap.set('#lS2, .s2-head, .fi-info, .fi-car, #fiStage', { autoAlpha: 0 });
    gsap.set('#s3, #s4, #s5, #routes, .cap', { autoAlpha: 0 });
    S.morph = 0; S.blow = 0; S.word = 0;

    // Where the hero lands: the image slot of the technical sheet, from layout values so transforms never affect it
    const HERO_R = 1600 / 717, fiStage = $('#fiStage');
    const slot = () => {
      let x = 0, y = 0, el = fiStage;
      while (el && el !== stage) { x += el.offsetLeft; y += el.offsetTop; el = el.offsetParent; }
      const w = fiStage.offsetWidth, h = fiStage.offsetHeight, fit = Math.min(w * .96, h * .74 * HERO_R);
      return { cx: x + w / 2, cy: y + h / 2, w: fit, h: fit / HERO_R };
    };
    const rigCx = () => rigOuter.offsetLeft + rigOuter.offsetWidth / 2, rigCy = () => rigOuter.offsetTop + rigOuter.offsetHeight / 2;

    const ir1 = { r: 0 }, ir2 = { r: 0 };
    let a2 = { x: innerWidth / 2, y: innerHeight / 2 };
    const applyIris = (el, r, x, y) => {
      const R = r * Math.hypot(innerWidth, innerHeight) * 1.02;
      el.style.clipPath = r >= .999 ? 'none' : `circle(${R}px at ${x}px ${y}px)`;
      const live = r > .001 && r < .55; // past that the ring is outside the screen
      irisEl.style.opacity = live ? 1 : 0;
      if (live) irisEl.style.transform = `translate(${x}px,${y}px) scale(${R / 50})`;
    };
    const s3 = $('#s3'), s5 = $('#s5');
    applyIris(s3, 0, 0, 0); applyIris(s5, 0, 0, 0);

    tl = gsap.timeline({ paused: true, defaults: { ease: 'none' } });

    /* ===== ESCENA 1 · THE AWAKENING ===== */
    tl.fromTo('.m1', { xPercent: 0 }, { xPercent: -24, duration: 1.35, ease: 'power1.in', immediateRender: false }, 0)
      .fromTo('.m2', { xPercent: 0 }, { xPercent: 24, duration: 1.35, ease: 'power1.in', immediateRender: false }, 0)
      .fromTo('#lTitle, #lOutline', { autoAlpha: 1 }, { autoAlpha: 0, duration: .4, immediateRender: false }, .85)
      .fromTo('#lCopy', { autoAlpha: 1, y: 0 }, { autoAlpha: 0, y: -24, duration: .3, immediateRender: false }, .18)
      .fromTo(S, { flow: .22 }, { flow: 1, duration: .75, ease: 'power2.in', immediateRender: false }, 0)
      .fromTo(S, { flow: 1 }, { flow: .3, duration: .6, ease: 'power2.out', immediateRender: false }, .85)
      .fromTo(S, { word: 0 }, { word: 1, duration: .5, ease: 'power2.out', immediateRender: false }, .22)
      .fromTo(S, { word: 1 }, { word: 2, duration: .45, ease: 'power2.in', immediateRender: false }, .9)
      .fromTo('#rig', { scale: 1, x: 0, y: 0 }, { scale: 1.06, x: 0, y: 0, duration: 1.1, ease: 'power1.inOut', immediateRender: false }, 0)
      .fromTo('#v34', { rotationY: 5 }, { rotationY: -3, duration: 1.1, ease: 'power1.inOut', immediateRender: false }, 0)
      .fromTo('.hud-b', { autoAlpha: 1 }, { autoAlpha: 0, duration: .2, immediateRender: false }, 1.2);

    // Hand-over: the hero flies into the slot of the technical sheet and becomes its first image
    tl.fromTo('#v34', { rotationY: -3 }, { rotationY: 0, duration: .55, ease: 'power2.inOut', immediateRender: false }, 1.1)
      .fromTo('#rig', { scale: 1.06, x: 0, y: 0 }, { scale: () => slot().w / rigOuter.offsetWidth, x: () => slot().cx - rigCx(), y: () => slot().cy - rigCy(), duration: .6, ease: 'power2.inOut', immediateRender: false }, 1.1)
      .fromTo('.v-reflect', { opacity: .32 }, { opacity: 0, duration: .25, immediateRender: false }, 1.15)
      .fromTo(S, { ringX: 0, ringY: restRingY }, { ringX: () => (slot().cx - innerWidth / 2) / (stage.offsetHeight || innerHeight), ringY: () => (stage.offsetHeight / 2 - slot().cy - slot().h / 2) / (stage.offsetHeight || innerHeight), duration: .6, ease: 'power2.inOut', immediateRender: false }, 1.1)
      .fromTo(S, { ring: 1 }, { ring: .55, duration: .5, immediateRender: false }, 1.2);

    /* ===== ESCENA 2 · INFORMACIÓN TÉCNICA ===== */
    tl.fromTo('#lS2', { autoAlpha: 0 }, { autoAlpha: 1, duration: .01, immediateRender: false }, 1.62)
      .fromTo('#fiStage', { autoAlpha: 0 }, { autoAlpha: 1, duration: .08, immediateRender: false }, 1.64)
      .fromTo('#lMachine', { autoAlpha: 1 }, { autoAlpha: 0, duration: .06, immediateRender: false }, 1.7)
      .fromTo('.hud-c', { autoAlpha: 1 }, { autoAlpha: 0, duration: .1, immediateRender: false }, 1.6)
      .fromTo('.mm-grid', { opacity: .5 }, { opacity: .8, duration: .4, immediateRender: false }, 1.8)
      .fromTo('.s2-head, .fi-info', { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .2, stagger: .03, ease: 'power2.out', immediateRender: false }, 1.7)
      .fromTo('.fi-car', { autoAlpha: 0, y: 40 }, { autoAlpha: 1, y: 0, duration: .22, ease: 'power2.out', immediateRender: false }, 1.76);

    /* ===== PORTAL #1 · into the machine on the sheet =====
       Scrolling back, this layer is painted again at whatever zoom it has at that moment, and the browser keeps
       that resolution. So the zoom stays moderate and the layer is hidden as soon as the iris covers the screen
       (t = 4.64): above that point it would only cost memory and freeze the page on the way up. */
    tl.to('.s2-head, .fi-info, .fi-car', { autoAlpha: 0, duration: .12 }, 3.92)
      .fromTo(fiStage, { scale: 1, x: 0, y: 0 }, { scale: isMob ? 9 : 7, x: () => stage.offsetWidth / 2 - slot().cx, y: () => stage.offsetHeight / 2 - slot().cy, duration: .82, ease: 'power3.in', immediateRender: false }, 3.95)
      .fromTo(S, { ring: .55, flow: .3 }, { ring: 0, flow: 0, duration: .35, immediateRender: false }, 3.95)
      .fromTo(s3, { autoAlpha: 0 }, { autoAlpha: 1, duration: .01, immediateRender: false }, 4.3)
      .fromTo(ir1, { r: 0 }, { r: 1, duration: .46, ease: 'power2.in', immediateRender: false, onUpdate: () => applyIris(s3, ir1.r, innerWidth / 2, stage.offsetHeight / 2) }, 4.3)
      .fromTo(S, { htZoom: .55 }, { htZoom: 1, duration: .62, ease: 'power2.out', immediateRender: false }, 4.3)
      .fromTo('#lS2, #flowFront, #flowBack', { autoAlpha: 1 }, { autoAlpha: 0, duration: .01, immediateRender: false }, 4.64)
      .fromTo('.hud-c', { autoAlpha: 0 }, { autoAlpha: 1, duration: .1, immediateRender: false }, 4.7);

    /* ===== ESCENA 3 · INSTITUCIONAL, SOBRE LA MALLA HALFTONE ===== */
    const capIO = (id, a, b) => {
      tl.fromTo(id, { autoAlpha: 0, y: 26 }, { autoAlpha: 1, y: 0, duration: .15, ease: 'power2.out', immediateRender: false }, a)
        .to(id, { autoAlpha: 0, y: -18, duration: .12, ease: 'power2.in' }, b);
    };
    capIO('#capA', 4.68, 5.02);
    tl.fromTo(S, { morph: 0 }, { morph: 1, duration: .68, ease: 'power1.inOut', immediateRender: false }, 5.05);
    capIO('#capB', 5.55, 5.92);
    tl.fromTo(S, { morph: 1 }, { morph: 2, duration: .68, ease: 'power1.inOut', immediateRender: false }, 5.96)
      .fromTo('#routes', { autoAlpha: 0 }, { autoAlpha: 1, duration: .2, immediateRender: false }, 6.5);
    capIO('#capC', 6.42, 6.98);

    tl.fromTo('#routes', { autoAlpha: 1 }, { autoAlpha: 0, duration: .12, immediateRender: false }, 6.95)
      .fromTo(S, { blow: 0 }, { blow: 1, duration: .5, ease: 'power2.in', immediateRender: false }, 6.95)
      .fromTo(S, { beam: 1 }, { beam: .75, duration: .1, immediateRender: false }, 6.95)
      .fromTo(s3, { autoAlpha: 1 }, { autoAlpha: 0, duration: .32, immediateRender: false }, 7.12);

    /* ===== ESCENA 4 · TELEMETRÍA ===== */
    tl.fromTo('#s4', { autoAlpha: 0 }, { autoAlpha: 1, duration: .01, immediateRender: false }, 7.12)
      .fromTo('.hud-c', { autoAlpha: 1 }, { autoAlpha: 0, duration: .1, immediateRender: false }, 7.1)
      .fromTo('.s4-top > *', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .2, stagger: .04, ease: 'power2.out', immediateRender: false }, 7.18)
      .fromTo('#cockpit', { autoAlpha: 0, y: 46 }, { autoAlpha: 1, y: 0, duration: .24, ease: 'power2.out', immediateRender: false }, 7.26)
      .fromTo(S, { beam: .75 }, { beam: 1, duration: P2 - 7.5, immediateRender: false }, 7.5); // the light keeps answering the scroll while the tracker holds still

    /* ===== PORTAL #2 · into the final registration mark =====
       The tracker only zooms a little and fades: the iris growing out of the mark does the deep zoom.
       Zooming the whole tracker froze the page for seconds when scrolling back up (see the note on portal #1). */
    const cam2 = { p: 0 }, Z2 = isMob ? 5 : 4, s4in = $('#s4in');
    // Marker position in #stage coordinates with the camera at rest, independent of viewport scroll offset
    measureA2 = () => {
      const cp = $('#cockpit'), keep = [s4in.style.transform, cp.style.transform];
      s4in.style.transform = cp.style.transform = 'none';
      a2 = Tracker.anchor();
      const sr = stage.getBoundingClientRect(), b = s4in.getBoundingClientRect();
      s4in.style.transform = keep[0]; cp.style.transform = keep[1];
      s4in.style.transformOrigin = `${a2.x - (b.left - sr.left)}px ${a2.y - (b.top - sr.top)}px`;
    };
    measureA2();
    Tracker.onRender(measureA2);
    // The camera slides the marker to the middle of the screen while it dives in
    const slide = () => { const q = Math.min(1, cam2.p / .55); return q * q * (3 - 2 * q); };
    const applyCam2 = () => {
      const k = slide();
      gsap.set(s4in, { x: (innerWidth / 2 - a2.x) * k, y: (stage.offsetHeight / 2 - a2.y) * k, scale: 1 + (Z2 - 1) * cam2.p ** 3.5 });
    };
    const center2 = () => {
      const k = slide();
      return [a2.x + (innerWidth / 2 - a2.x) * k, a2.y + (stage.offsetHeight / 2 - a2.y) * k];
    };
    tl.fromTo(cam2, { p: 0 }, { p: 1, duration: .78, immediateRender: false, onUpdate: applyCam2 }, P2)
      .fromTo('#s4in > *', { autoAlpha: 1 }, { autoAlpha: 0, duration: .2, immediateRender: false }, P2 + .42)
      .fromTo(s5, { autoAlpha: 0 }, { autoAlpha: 1, duration: .01, immediateRender: false }, P2 + .3)
      .fromTo(ir2, { r: 0 }, { r: 1, duration: .46, ease: 'power2.in', immediateRender: false, onUpdate: () => { const c = center2(); applyIris(s5, ir2.r, c[0], c[1]); } }, P2 + .3)
      .fromTo('.s5-in', { scale: .84 }, { scale: 1, duration: .5, ease: 'power2.out', immediateRender: false }, P2 + .3)
      .fromTo('.s5-in > *', { autoAlpha: 0, y: 30 }, { autoAlpha: 1, y: 0, duration: .18, stagger: .035, ease: 'power2.out', immediateRender: false }, P2 + .6)
      .fromTo('#s4', { autoAlpha: 1 }, { autoAlpha: 0, duration: .01, immediateRender: false }, P2 + .64)
      .to({}, { duration: TOTAL - (P2 + .78) }, P2 + .78); // hold on the landing frame until the pin releases

    st = ScrollTrigger.create({
      animation: tl,
      trigger: stage,
      start: 'top top',
      end: `+=${TOTAL * 100}%`,
      pin: true,
      scrub: 1,
      anticipatePin: isMob ? 1 : 0, // only touch scrolling runs on another thread; with Lenis it would add a jump
      invalidateOnRefresh: true,
    });

    const s4El = $('#s4'), topEl = $('#top'), lS2 = $('#lS2'), routes = $('#routes');
    let routesOn = true, fiOn = false;
    tl.eventCallback('onUpdate', () => {
      const t = tl.time();
      if (t < 7.05 || t > 8.45) played = false;
      else if (t >= 7.35 && t <= 8.35 && !played) { played = true; Tracker.play(); }
      s4El.classList.toggle('live', t > 7.2 && t < P2 + .02); // interactive only while the tracker is on screen
      // Scene 4 has its own search field and the portal its own bar: the quick tracker steps aside for both
      topEl.classList.toggle('trk-off', t > 7.05);
      // Dedicated GPU layer only during each zoom: leaving the band resets the resolution of that layer
      fiStage.classList.toggle('zoom', t > 3.9 && t < 4.66);
      // The sheet is interactive only while it holds still; its callouts draw again on every arrival
      const fiLive = t > 1.74 && t < 3.92;
      if (fiLive !== fiOn) { fiOn = fiLive; lS2.classList.toggle('live', fiLive); if (fiLive) Ficha.enter(); else Ficha.leave(); }
      s4in.classList.toggle('zoom', t >= P2 && t < P2 + .66);
      const showRoutes = t > 6.4 && t < 7.1;
      if (showRoutes !== routesOn) {
        routesOn = showRoutes;
        routes.classList.toggle('on', showRoutes);
        if (showRoutes) routes.unpauseAnimations?.(); else routes.pauseAnimations?.();
      }
      updateHud(t);
      videoFrame(t);
    });
    routes.pauseAnimations?.(); routesOn = false;
    updateHud(0);

    return () => { gsap.set(s4in, { clearProps: 'all' }); gsap.set(fiStage, { clearProps: 'all' }); lS2.classList.remove('live'); Ficha.leave(); Tracker.onRender(null); measureA2 = null; tl = null; st = null; };
  }

  /* ---------- Per-frame drawing, only for the layers on screen ---------- */
  let flowClear = false;
  function render(time, deltaMs) {
    const dt = Math.min(.05, deltaMs / 1000);
    const t = tl ? tl.time() : 0;
    if (!bgPaused && (t < 4.66 || t > 7)) RicserBG.draw(S, time);
    if (t < 4.66) { Flow.draw(S, dt, time); flowClear = false; }
    else if (!flowClear) { Flow.draw({ flow: 0, word: 0 }, dt, time); flowClear = true; }
    if (t > 4.2 && t < 7.5) Halftone.draw(S, dt, time);
  }

  function updateHud(t) {
    let i = 0;
    NAMES.forEach((n, k) => { if (t >= n[0]) i = k; });
    $('#hudBar').style.transform = `scaleX(${Math.min(1, t / TOTAL)})`;
    if (i === hudIdx) return;
    hudIdx = i;
    $('#hudN').textContent = NAMES[i][1];
    $('#hudName').textContent = NAMES[i][2];
    $$('#scenes a').forEach(a => {
      const on = a.dataset.go === NAMES[i][3];
      a.classList.toggle('on', on);
      if (on) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current');
    });
  }

  /* ---------- Navigation ---------- */
  const portalOffset = () => $('#top').offsetHeight;
  function go(name) {
    if (name === 'portal') { lenis.scrollTo('#portal', { duration: 2.6, offset: -portalOffset(), force: true, easing: e => 1 - (1 - e) ** 4 }); return; }
    if (!st) return;
    const y = st.start + (st.end - st.start) * LABELS[name] / TOTAL;
    lenis.scrollTo(y, { duration: 2.2, force: true, easing: e => 1 - (1 - e) ** 4 });
  }
  window.Cinema = { go };

  function wireNav() {
    document.addEventListener('click', e => {
      const a = e.target.closest('[data-go]');
      if (!a) return;
      e.preventDefault();
      go(a.dataset.go);
    });
    $('#quickTrk').addEventListener('submit', e => {
      e.preventDefault();
      played = false;
      quickSearch(() => go('s4'));
    });
  }

  /* ---------- Pointer: registration-mark cursor, machine parallax, HUD coordinates ---------- */
  function pointer() {
    const fine = matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (!fine) return;
    const cur = $('#cursor');
    const qx = gsap.quickTo(cur, 'x', { duration: .28, ease: 'power3' }), qy = gsap.quickTo(cur, 'y', { duration: .28, ease: 'power3' });
    const ry = gsap.quickTo('#rigOuter', 'rotationY', { duration: .9, ease: 'power2' }), rx = gsap.quickTo('#rigOuter', 'rotationX', { duration: .9, ease: 'power2' });
    // Soft parallax: the machine and the title drift in opposite directions, so the title reads as further back
    const mx = gsap.quickTo('#rigOuter', 'x', { duration: 1.1, ease: 'power2' });
    const titles = $$('.mega').map(el => [gsap.quickTo(el, 'x', { duration: 1.3, ease: 'power2' }), gsap.quickTo(el, 'y', { duration: 1.3, ease: 'power2' })]);
    const xy = $('#hudXY');
    cur.classList.add('on');
    window.addEventListener('pointermove', e => {
      qx(e.clientX); qy(e.clientY);
      const nx = e.clientX / innerWidth - .5, ny = e.clientY / innerHeight - .5;
      S.mx = nx * 2; S.my = -ny * 2;
      ry(nx * 4); rx(-ny * 2); mx(nx * 16);
      titles.forEach(q => { q[0](-nx * 14); q[1](-ny * 8); });
      xy.textContent = `${String(Math.round(e.clientX)).padStart(4, '0')} · ${String(Math.round(e.clientY)).padStart(4, '0')}`;
      cur.classList.toggle('hot', !!e.target.closest?.('a,button,input,select,textarea,label,[role=button]'));
    }, { passive: true });
  }

  function videoPlates() {
    VIDEO_PLATES.forEach(p => {
      const v = document.createElement('video');
      Object.assign(v, { src: p.src, muted: true, loop: true, autoplay: true, playsInline: true });
      v.style.opacity = 0;
      $('#lVideo').appendChild(v);
      p.el = v;
    });
  }
  function videoFrame(t) { VIDEO_PLATES.forEach(p => { p.el.style.opacity = t >= p.from && t <= p.to ? (p.opacity ?? .6) : 0; }); }

  function onResize() {
    RicserBG.resize(); Flow.resize(); Halftone.resize();
    ScrollTrigger.refresh();
  }

  /* ---------- Fallback: reduced motion, or the animation CDN could not load ---------- */
  function staticMode() {
    html.classList.add('static');
    RicserBG.init($('#bg'));
    S.ring = .7; S.beam = 1; S.morph = 1; S.htZoom = 1;
    RicserBG.draw(S, 3);
    if (!Halftone.init($('#halftone'))) html.classList.add('no-webgl');
    else Halftone.draw(S, 0, 3);
    Tracker.search('GAR-2026-0042');
    Ficha.enter();
    const map = { s1: '#stage', s2: '#lS2', s3: '#s3', s4: '#s4', portal: '#portal' };
    window.Cinema = { go: n => $(map[n]).scrollIntoView() };
    document.addEventListener('click', e => { const a = e.target.closest('[data-go]'); if (a) { e.preventDefault(); window.Cinema.go(a.dataset.go); } });
    $('#quickTrk').addEventListener('submit', e => { e.preventDefault(); quickSearch(() => window.Cinema.go('s4')); });
  }

  function debounce(fn, ms) { let id; return () => { clearTimeout(id); id = setTimeout(fn, ms); }; }
})();
