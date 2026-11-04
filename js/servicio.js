/* Technical service requests. The public side is the form opened from the start of the site; the internal side is the
   "Solicitudes" tab, where the person on duty picks each request up and calls the client. */
window.Servicio = (() => {
  const { EQUIPOS, solicitudes, addSolicitud, updateSolicitud, onSol, getRol, ACCESOS, esc } = Ricser;
  const $ = s => document.querySelector(s);
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');
  const ESTADOS = { nueva: ['Nueva', 'ye'], contacto: ['En contacto', ''], cerrada: ['Resuelta', 'ok'] };
  let filtro = 'nueva', api = {};

  const when = iso => new Date(iso).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

  /* ---------- Public form ---------- */
  const equipoLabel = e => (/confirmar/i.test(e.modelo) ? e.nombre : `${e.nombre} ${e.modelo}`);

  function open() {
    const form = $('#stF');
    form.reset();
    form.hidden = false;
    $('#stDone').hidden = true;
    $('#stMore').hidden = true;
    clearErrors();
    $('#stDlg').showModal();
    window.__lenis?.stop();
    // Same rule as the other dialogs: animate what is inside, never the <dialog> itself
    if (motion()) gsap.fromTo(form, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power3.out', clearProps: 'transform,opacity' });
  }

  function clearErrors() {
    $('#stErr').textContent = '';
    ['#stEq', '#stName', '#stTel', '#stMsg'].forEach(s => $(s).removeAttribute('aria-invalid'));
  }

  // The person's details only appear once the machine is chosen
  function onEquipo() {
    const more = $('#stMore'), show = !!$('#stEq').value;
    if (show === !more.hidden) return;
    clearErrors();
    more.hidden = !show;
    if (show && motion()) {
      more.classList.add('anim');
      gsap.fromTo(more, { height: 0, opacity: 0 }, { height: 'auto', opacity: 1, duration: .4, ease: 'power3.out', clearProps: 'height,opacity', onComplete: () => more.classList.remove('anim') });
    }
  }

  function submit(ev) {
    ev.preventDefault();
    clearErrors();
    const eq = $('#stEq'), name = $('#stName'), tel = $('#stTel'), msg = $('#stMsg');
    const fail = (el, text) => { el.setAttribute('aria-invalid', 'true'); $('#stErr').textContent = text; el.focus(); };
    if (!eq.value) return fail(eq, 'Elegí tu equipo.');
    if (!name.value.trim()) return fail(name, 'Escribí tu nombre.');
    if (tel.value.replace(/\D/g, '').length < 8) return fail(tel, 'Escribí un teléfono con código de área.');
    if (!msg.value.trim()) return fail(msg, 'Contanos qué le está pasando al equipo.');
    const s = addSolicitud({ equipo: eq.options[eq.selectedIndex].text, nombre: name.value.trim(), telefono: tel.value.trim(), detalle: msg.value.trim() });
    $('#stF').hidden = true;
    $('#stCode').textContent = s.code;
    $('#stTelOk').textContent = s.telefono;
    $('#stDone').hidden = false;
    $('#stClose').focus();
    return undefined;
  }

  /* ---------- Internal tab ---------- */
  function cardMarkup(s) {
    const [label, cls] = ESTADOS[s.estado];
    const tel = s.telefono.replace(/[^\d+]/g, '');
    const acts = {
      nueva: `<button type="button" class="btn" data-tomar="${s.id}">Tomar solicitud</button>`,
      contacto: `<a class="btn" href="tel:${esc(tel)}">Llamar</a><button type="button" class="btn ghost" data-cerrar="${s.id}">Marcar como resuelta</button>`,
      cerrada: `<button type="button" class="btn ghost" data-reabrir="${s.id}">Reabrir</button>`,
    }[s.estado];
    return `<article class="st-card glass" data-card="${s.id}">
      <div class="st-h"><b class="case mono">${esc(s.code)}</b><span class="pill ${cls}">${label}</span><time class="mono" datetime="${esc(s.at)}">${when(s.at)}</time></div>
      <h3>${esc(s.equipo)}</h3>
      <p class="st-msg">${esc(s.detalle)}</p>
      <dl class="st-who">
        <div><dt>Nombre</dt><dd>${esc(s.nombre)}</dd></div>
        <div><dt>Teléfono</dt><dd><a class="link st-tel" href="tel:${esc(tel)}">${esc(s.telefono)}</a></dd></div>
        ${s.tomadaPor ? `<div><dt>Tomada por</dt><dd>${esc(s.tomadaPor)} · ${when(s.tomadaEl)}</dd></div>` : ''}
      </dl>
      ${s.estado === 'nueva' ? '' : `<label class="f st-nota">Nota del contacto<input data-nota="${s.id}" value="${esc(s.nota || '')}" autocomplete="off"></label>`}
      <div class="st-acts">${acts}</div>
    </article>`;
  }

  function render() {
    const counts = { nueva: 0, contacto: 0, cerrada: 0 };
    solicitudes.forEach(s => { counts[s.estado]++; });
    $('#solN').textContent = counts.nueva || '';
    $('#solF').innerHTML = Object.keys(ESTADOS).map(k => `<button type="button" class="chip" data-f="${k}" aria-pressed="${filtro === k}">${ESTADOS[k][0]} <span class="mono">${counts[k]}</span></button>`).join('');
    const list = solicitudes.filter(s => s.estado === filtro);
    $('#solL').innerHTML = list.length ? list.map(cardMarkup).join('') : `<p class="st-none">No hay solicitudes en "${ESTADOS[filtro][0]}".</p>`;
  }

  function init(opts) {
    api = opts;
    $('#stEq').insertAdjacentHTML('beforeend', `${EQUIPOS.map(e => `<option value="${e.id}">${esc(equipoLabel(e))}</option>`).join('')}<option value="otro">Otro equipo o no lo sé</option>`);
    $('#stOpen').addEventListener('click', open);
    $('#stEq').addEventListener('change', onEquipo);
    $('#stF').addEventListener('submit', submit);
    $('#stCx').addEventListener('click', () => $('#stDlg').close());
    $('#stClose').addEventListener('click', () => $('#stDlg').close());
    $('#stDlg').addEventListener('close', () => window.__lenis?.start());
    $('#stDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

    $('#solF').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { filtro = b.dataset.f; render(); } });
    $('#solL').addEventListener('click', e => {
      const t = e.target;
      const tomar = t.closest('[data-tomar]');
      if (tomar) {
        // It stays on screen under "En contacto", ready to call
        const id = Number(tomar.dataset.tomar);
        filtro = 'contacto';
        updateSolicitud(id, { estado: 'contacto', tomadaPor: ACCESOS[getRol()].n, tomadaEl: new Date().toISOString() });
        $(`[data-card="${id}"] a.btn`)?.focus();
        api.toast?.('Solicitud tomada. Ya podés llamar.');
        return;
      }
      const cerrar = t.closest('[data-cerrar]');
      if (cerrar) { updateSolicitud(Number(cerrar.dataset.cerrar), { estado: 'cerrada' }); api.toast?.('Solicitud resuelta.'); return; }
      const reabrir = t.closest('[data-reabrir]');
      if (reabrir) { filtro = 'contacto'; updateSolicitud(Number(reabrir.dataset.reabrir), { estado: 'contacto' }); }
    });
    $('#solL').addEventListener('change', e => { const n = e.target.dataset.nota; if (n) { updateSolicitud(Number(n), { nota: e.target.value.trim() }); api.toast?.('Nota guardada.'); } });
    onSol(render);
    render();
  }

  return { init, render, open };
})();
