/* Manufacturer view: one expandable row per warranty case, with what the factory needs to decide on it.
   All data lives in Ricser (js/store.js), so every change here reaches the client portal, the internal panel and
   the tracker. The factory never sees the client's name, prices or internal notes. */
window.Fabrica = (() => {
  const { TYPES, EQ, EV, ROLES, LIMITS, fmt, esc, warranty, updateEvent, addEvidence, removeEvidence, addMessage, sendToFactory, Notifier } = Ricser;
  const STEPS = TYPES.repuesto.steps;
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');
  const CHEVRON = '<svg class="fc-ch" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>';
  let root, api = {};

  // View state that must survive a repaint: open rows, selected evidence, who is writing in each chat
  const ui = new Map();
  const st = id => { if (!ui.has(id)) ui.set(id, { open: false, ev: null, rol: 'tec', file: null }); return ui.get(id); };
  const byId = id => EV.find(e => e.id === id);
  const eqOf = e => EQ.find(q => q.id === e.eq);
  const cardOf = id => root.querySelector(`.fc[data-id="${id}"]`);
  const sent = e => e.fab.estado === 'enviado';
  const hora = iso => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* ---------- Row ---------- */
  function headMarkup(e) {
    const q = eqOf(e), awbMissing = e.s >= 3 && !e.guia;
    return `<span class="fc-c"><b class="case mono">${esc(e.caso)}</b><small>${fmt(e.d)}</small></span>
      <span>${esc(q.m)}<small>Serie ${esc(q.s)} · instalado ${fmt(q.inst)}</small></span>
      <span>${esc(e.ti)}<small>${esc(e.falla || '')}</small></span>
      <span class="fc-st"><span class="pill ${sent(e) ? 'ok' : 'ye'}">${sent(e) ? 'Enviado a fábrica' : 'En diagnóstico'}</span><span class="pill">${esc(STEPS[e.s])}</span></span>
      <span class="mono fc-awb">${e.guia ? esc(e.guia) : 'Sin guía'}${awbMissing ? '<small class="warn">Falta la guía</small>' : ''}</span>
      ${CHEVRON}`;
  }

  function cardMarkup(e) {
    const s = st(e.id);
    return `<article class="fc glass" data-id="${e.id}">
      <h3 class="fc-t"><button type="button" class="fc-h" id="fc-h-${e.id}" aria-expanded="${s.open}" aria-controls="fc-p-${e.id}">${headMarkup(e)}</button></h3>
      <div class="fc-p" id="fc-p-${e.id}" role="region" aria-labelledby="fc-h-${e.id}"${s.open ? '' : ' hidden'}>${s.open ? panelMarkup(e) : ''}</div>
    </article>`;
  }

  /* ---------- Panel ---------- */
  function panelMarkup(e) {
    const q = eqOf(e), w = warranty(q);
    const facts = [['Código', e.caso], ['Equipo', q.m], ['Serie', q.s], ['Instalación', fmt(q.inst)], ['Garantía', `${w.valid ? 'Vigente' : 'Vencida'} · hasta ${fmt(q.gar)}`], ['Pieza reclamada', e.ti], ['Estado', STEPS[e.s]]];
    return `<div class="fc-in">
      <div class="fc-top"><h4>Así lo ve la fábrica</h4><dl class="fc-sum">${facts.map(f => `<div><dt>${f[0]}</dt><dd data-f="${f[0]}">${esc(f[1])}</dd></div>`).join('')}</dl></div>
      <div class="fc-grid">
        <section class="fc-sec" aria-labelledby="ev-t-${e.id}">
          <h5 id="ev-t-${e.id}">Evidencia</h5>
          <div class="ev-box">${evidenceMarkup(e)}</div>
          <div class="ev-up">
            <label class="btn ghost ev-btn">Cargar video o foto<input class="sr" type="file" accept="video/*,image/*" data-up="${e.id}"></label>
            <small>Video hasta ${LIMITS.video} MB, foto hasta ${LIMITS.imagen} MB.</small>
          </div>
          <p class="f-err" role="alert" data-err="ev"></p>
        </section>
        <section class="fc-sec" aria-labelledby="ob-t-${e.id}">
          <h5 id="ob-t-${e.id}">Observación técnica</h5>
          <label class="f fc-ob"><span>Qué ocurre con la pieza o el equipo. Obligatoria para enviar el caso.</span>
            <textarea rows="5" data-obs="${e.id}" aria-describedby="ob-e-${e.id}" required>${esc(e.fab.obs)}</textarea></label>
          <p class="f-err" id="ob-e-${e.id}" role="alert" data-err="obs"></p>
          <div class="fc-send"><button type="button" class="btn" data-send="${e.id}"${sent(e) ? ' disabled' : ''}>${sent(e) ? 'Enviado a fábrica' : 'Enviar a fábrica'}</button>${sent(e) && e.fab.enviadoEl ? `<small>${fmt(e.fab.enviadoEl)}</small>` : ''}</div>
        </section>
        <section class="fc-sec fc-chat" aria-labelledby="ch-t-${e.id}">
          <h5 id="ch-t-${e.id}">Chat interno del caso</h5>
          <ol class="ch-th" aria-live="polite" aria-relevant="additions" tabindex="0" aria-label="Mensajes del caso ${esc(e.caso)}" data-lenis-prevent>${e.fab.chat.length ? e.fab.chat.map(msgMarkup).join('') : '<li class="ch-empty">Todavía no hay mensajes.</li>'}</ol>
          <form class="ch-f" data-chat="${e.id}">
            <label class="ch-rol">Escribís como
              <select data-rol="${e.id}">${Object.keys(ROLES).map(k => `<option value="${k}"${k === st(e.id).rol ? ' selected' : ''}>${ROLES[k].rol}</option>`).join('')}</select></label>
            <textarea rows="2" aria-label="Mensaje" placeholder="Escribí un mensaje. Enter envía, Mayús + Enter baja de línea."></textarea>
            <div class="ch-acts">
              <label class="btn ghost ch-att"><svg viewBox="0 0 16 16" aria-hidden="true"><path d="M13 7.500l-5.300 5.300a3 3 0 0 1-4.300-4.300l5.800-5.800a2 2 0 0 1 2.900 2.900l-5.700 5.700a1 1 0 0 1-1.500-1.400l5-5"/></svg>Adjuntar<input class="sr" type="file" accept="video/*,image/*,application/pdf" data-att="${e.id}"></label>
              <small class="ch-file" data-file></small>
              <button type="submit" class="btn">Enviar</button>
            </div>
            <p class="f-err" role="alert" data-err="chat"></p>
          </form>
        </section>
        <section class="fc-sec fc-pieza" aria-labelledby="pz-t-${e.id}">
          <h5 id="pz-t-${e.id}">Seguimiento de la pieza</h5>
          <p class="sm">Editable por Ricser. Cada avance actualiza el seguimiento y el portal del cliente, y le manda un mail.</p>
          <ol class="pz-tl">${STEPS.map((n, i) => `<li><button type="button" data-stage="${i}" data-id="${e.id}"><b>${esc(n)}</b><small></small></button></li>`).join('')}</ol>
          <p class="f-err" role="alert" data-err="pz"></p>
          <div class="pz-f">
            <label class="f">Guía aérea (AWB)<input class="mono" data-k="guia" data-id="${e.id}" value="${esc(e.guia || '')}" placeholder="AWB 000-0000 0000" autocomplete="off"></label>
            <label class="f">Transportista<input data-k="carrier" data-id="${e.id}" value="${esc(e.carrier || '')}" autocomplete="off"></label>
            <label class="f">Llegada estimada (ETA)<input type="date" data-k="eta" data-id="${e.id}" value="${esc(e.eta || '')}"></label>
            <label class="f">Notas para el cliente<input data-k="notas" data-id="${e.id}" value="${esc(e.notas || '')}" autocomplete="off"></label>
          </div>
          <div class="pz-mail" data-mail></div>
        </section>
      </div>
    </div>`;
  }

  function evidenceMarkup(e) {
    const list = e.fab.evidencia, s = st(e.id);
    if (!list.length) return '<div class="ev-empty">Sin registro cargado. El técnico sube acá el video o la foto del diagnóstico.</div>';
    const cur = list.find(x => x.id === s.ev) || list[list.length - 1];
    const media = cur.tipo === 'video'
      ? `<video src="${cur.url}" controls playsinline preload="metadata" aria-label="Registro del diagnóstico: ${esc(cur.nombre)}"></video>`
      : `<img src="${cur.url}" alt="Registro del diagnóstico: ${esc(cur.nombre)}">`;
    const thumbs = list.map(x => `<li><button type="button" class="chip" data-ev="${x.id}" aria-pressed="${x.id === cur.id}">${x.tipo === 'video' ? 'Video' : 'Foto'} · ${esc(x.nombre)}</button><button type="button" class="ev-x" data-evx="${x.id}" aria-label="Quitar ${esc(x.nombre)}">×</button></li>`).join('');
    return `<div class="ev-view">${media}</div><p class="sm">${esc(cur.por)} · ${hora(cur.at)}</p><ul class="ev-list">${thumbs}</ul>`;
  }

  function msgMarkup(m) {
    const a = m.adjunto;
    const att = !a ? '' : a.tipo === 'imagen' ? `<a href="${a.url}" target="_blank" rel="noopener"><img class="ch-img" src="${a.url}" alt="${esc(a.nombre)}"></a>`
      : a.tipo === 'video' ? `<video class="ch-img" src="${a.url}" controls playsinline preload="metadata" aria-label="${esc(a.nombre)}"></video>`
        : `<a class="link" href="${a.url}" target="_blank" rel="noopener">${esc(a.nombre)}</a>`;
    return `<li class="ch-m r-${m.rol}"><div class="ch-h"><b>${esc(m.autor)}</b><span class="pill">${esc(ROLES[m.rol].rol)}</span><time datetime="${m.at}">${hora(m.at)}</time></div>${m.txt ? `<p>${esc(m.txt)}</p>` : ''}${att}</li>`;
  }

  /* ---------- Targeted repaints: nothing the user is typing or watching gets rebuilt ---------- */
  function syncHead(e) {
    const card = cardOf(e.id);
    if (!card) return;
    card.querySelector('.fc-h').innerHTML = headMarkup(e);
    const d = card.querySelector('[data-f="Estado"]');
    if (d) d.textContent = STEPS[e.s];
  }

  function syncPieza(e) {
    const card = cardOf(e.id);
    if (!card || !card.querySelector('.pz-tl')) return;
    card.querySelectorAll('.pz-tl button').forEach((b, i) => {
      const li = b.parentNode;
      li.className = i < e.s ? 'd' : i === e.s ? 'n' : '';
      if (i === e.s) b.setAttribute('aria-current', 'step'); else b.removeAttribute('aria-current');
      b.setAttribute('aria-disabled', String(!sent(e) && i > 0));
      b.querySelector('small').textContent = e.hist && e.hist[i] && i <= e.s ? fmt(e.hist[i]) : '';
    });
    const m = Notifier.cola.find(x => x.caso === e.caso);
    card.querySelector('[data-mail]').innerHTML = `${m ? `<span>Último aviso al cliente: <b>${esc(m.subject)}</b> · ${hora(m.at)}</span>` : '<span>Todavía no se avisó al cliente sobre este caso.</span>'}<button type="button" class="link" data-inbox>Ver bandeja de mails</button>`;
  }

  function fillPanel(e) {
    const p = cardOf(e.id).querySelector('.fc-p');
    if (!p.firstElementChild) p.innerHTML = panelMarkup(e);
    syncPieza(e);
    const th = p.querySelector('.ch-th');
    th.scrollTop = th.scrollHeight;
  }

  function render() {
    const list = EV.filter(e => e.t === 'repuesto').slice().reverse();
    root.innerHTML = list.length ? list.map(cardMarkup).join('') : '<p class="fc-none">Sin casos abiertos.</p>';
    list.forEach(e => { if (st(e.id).open) fillPanel(e); });
  }

  /* ---------- Open and close: the height animates, so nothing below the row jumps ---------- */
  function toggle(btn) {
    const card = btn.closest('.fc'), id = Number(card.dataset.id), e = byId(id), s = st(id), p = card.querySelector('.fc-p');
    s.open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', s.open);
    if (window.gsap) gsap.killTweensOf(p);
    if (s.open) {
      p.hidden = false;
      fillPanel(e);
      if (motion()) {
        p.classList.add('anim');
        gsap.fromTo(p, { height: 0 }, { height: 'auto', duration: .5, ease: 'power3.out', onComplete: () => { p.classList.remove('anim'); gsap.set(p, { clearProps: 'height' }); window.__lenis?.resize(); } });
        gsap.fromTo(p.querySelector('.fc-in'), { autoAlpha: 0, y: 10 }, { autoAlpha: 1, y: 0, duration: .4, delay: .08, ease: 'power2.out', clearProps: 'transform,opacity,visibility' });
      }
    } else {
      p.querySelectorAll('video').forEach(v => v.pause());
      if (motion()) {
        p.classList.add('anim');
        gsap.to(p, { height: 0, duration: .36, ease: 'power2.inOut', onComplete: () => { p.hidden = true; p.classList.remove('anim'); gsap.set(p, { clearProps: 'height' }); window.__lenis?.resize(); } });
      } else p.hidden = true;
    }
  }

  const setErr = (scope, name, text) => { const el = scope.querySelector(`[data-err="${name}"]`); if (el) el.textContent = text || ''; };

  /* ---------- Actions ---------- */
  async function onEvidence(input) {
    const id = Number(input.dataset.up), e = byId(id), card = cardOf(id), file = input.files[0];
    input.value = '';
    if (!file) return;
    const r = await addEvidence(id, file);
    setErr(card, 'ev', r.error);
    if (r.error) return;
    st(id).ev = r.item.id;
    card.querySelector('.ev-box').innerHTML = evidenceMarkup(e);
    api.toast?.('Evidencia cargada en el caso.');
  }

  function onSend(btn) {
    const id = Number(btn.dataset.send), e = byId(id), card = cardOf(id), ta = card.querySelector('[data-obs]');
    const r = sendToFactory(id, ta.value);
    ta.setAttribute('aria-invalid', String(!r.ok));
    setErr(card, 'obs', r.error);
    if (!r.ok) { ta.focus(); return; }
    btn.textContent = 'Enviado a fábrica';
    btn.disabled = true;
    setErr(card, 'pz', '');
    syncHead(e); syncPieza(e);
    api.toast?.(`${e.caso} enviado a fábrica.`);
  }

  function onStage(btn) {
    const id = Number(btn.dataset.id), e = byId(id), i = Number(btn.dataset.stage), card = cardOf(id);
    if (!sent(e) && i > 0) { setErr(card, 'pz', 'Primero enviá el caso a fábrica: la pieza no avanza sin observación técnica.'); return; }
    setErr(card, 'pz', '');
    if (i === e.s) return;
    updateEvent(id, 's', i, 'fab');
    syncHead(e); syncPieza(e);
  }

  async function onChat(form) {
    const id = Number(form.dataset.chat), s = st(id), ta = form.querySelector('textarea'), txt = ta.value.trim();
    if (!txt && !s.file) { setErr(form, 'chat', 'Escribí un mensaje o adjuntá un archivo.'); ta.focus(); return; }
    setErr(form, 'chat', '');
    const m = await addMessage(id, { rol: s.rol, txt, file: s.file });
    s.file = null; ta.value = '';
    form.querySelector('[data-file]').textContent = '';
    const th = cardOf(id).querySelector('.ch-th');
    th.querySelector('.ch-empty')?.remove();
    th.insertAdjacentHTML('beforeend', msgMarkup(m));
    th.scrollTop = th.scrollHeight;
    ta.focus();
  }

  function onAttach(input) {
    const id = Number(input.dataset.att), form = input.closest('form'), file = input.files[0], s = st(id);
    input.value = '';
    if (!file) return;
    const err = Ricser.checkFile(file, true);
    setErr(form, 'chat', err);
    s.file = err ? null : file;
    form.querySelector('[data-file]').textContent = s.file ? s.file.name : '';
  }

  function init(opts) {
    api = opts;
    root = document.querySelector('#fabT');
    root.addEventListener('click', ev => {
      const t = ev.target;
      const head = t.closest('.fc-h');
      if (head) { toggle(head); return; }
      const stage = t.closest('[data-stage]');
      if (stage) { onStage(stage); return; }
      const send = t.closest('[data-send]');
      if (send) { onSend(send); return; }
      if (t.closest('[data-inbox]')) { api.openInbox?.(); return; }
      const card = t.closest('.fc');
      if (!card) return;
      const id = Number(card.dataset.id), e = byId(id);
      const pick = t.closest('[data-ev]');
      if (pick) { st(id).ev = Number(pick.dataset.ev); card.querySelector('.ev-box').innerHTML = evidenceMarkup(e); return; }
      const del = t.closest('[data-evx]');
      if (del) { removeEvidence(id, Number(del.dataset.evx)); card.querySelector('.ev-box').innerHTML = evidenceMarkup(e); }
    });
    root.addEventListener('change', ev => {
      const t = ev.target;
      if (t.dataset.up) { onEvidence(t); return; }
      if (t.dataset.att) { onAttach(t); return; }
      if (t.dataset.rol) { st(Number(t.dataset.rol)).rol = t.value; return; }
      if (t.dataset.k) {
        const id = Number(t.dataset.id), e = byId(id), v = t.value.trim();
        if ((e[t.dataset.k] || '') === v) return;
        updateEvent(id, t.dataset.k, v, 'fab');
        syncHead(e); syncPieza(e);
        if (t.dataset.k === 'carrier' || t.dataset.k === 'notas') api.toast?.('Guardado. El cliente ya ve el cambio.');
      }
    });
    // The note is kept as it is typed, so reopening a row or repainting the list never loses it
    root.addEventListener('input', ev => {
      const t = ev.target;
      if (!t.dataset.obs) return;
      byId(Number(t.dataset.obs)).fab.obs = t.value;
      if (t.value.trim()) { t.removeAttribute('aria-invalid'); setErr(t.closest('section'), 'obs', ''); }
    });
    root.addEventListener('keydown', ev => {
      const t = ev.target;
      if (ev.key === 'Enter' && !ev.shiftKey && !ev.isComposing && t.matches('.ch-f textarea')) { ev.preventDefault(); t.form.requestSubmit(); }
    });
    root.addEventListener('submit', ev => { ev.preventDefault(); onChat(ev.target); });
    // An attachment that finishes loading makes the message taller: the thread stays on the last message
    const keepAtEnd = ev => {
      const th = ev.target.closest?.('.ch-th');
      if (th) th.scrollTop = th.scrollHeight;
    };
    root.addEventListener('load', keepAtEnd, true);
    root.addEventListener('loadedmetadata', keepAtEnd, true);
    // A video the browser cannot play must say so instead of showing a dead player
    root.addEventListener('error', ev => {
      if (ev.target.tagName !== 'VIDEO') return;
      const box = ev.target.closest('.ev-view, .ch-m');
      if (box && !box.querySelector('.f-err')) ev.target.insertAdjacentHTML('afterend', '<p class="f-err">Este navegador no puede reproducir el formato. Probá con MP4 o WebM.</p>');
    }, true);
    render();

  }

  return { init, render };
})();
