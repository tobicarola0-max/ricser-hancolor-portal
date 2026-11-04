/* Technical service requests. The public side is the form opened from the start of the site; the internal side is the
   "Solicitudes" tab, where the person on duty picks each request up and calls the client.
   With the API on, everything goes through the database and internal access asks for a password. Without it (GitHub
   Pages, or Vercel before the passwords are set) the same screens run as a labelled demonstration. */
window.Servicio = (() => {
  const { EQUIPOS, solicitudes, setSolicitudes, addSolicitud, updateSolicitud, onSol, onRol, getRol, setRol, ACCESOS, esc } = Ricser;
  const $ = s => document.querySelector(s);
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');
  const ESTADOS = { nueva: ['Nueva', 'ye'], contacto: ['En contacto', ''], cerrada: ['Resuelta', 'ok'] };
  let filtro = 'nueva', api = {}, real = false, poll = 0, errorCarga = '';
  // GitHub Pages and a plain local server have no API; asking would only fill the console with errors
  const hayApi = !/github\.io$|^localhost$|^127\./.test(location.hostname) || /[?&]api\b/.test(location.search);
  const internoLee = () => ['tec', 'admin'].includes(getRol());

  async function pedir(ruta, method = 'GET', body) {
    const r = await fetch(ruta, { method, credentials: 'same-origin', headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
    let data = {};
    try { data = await r.json(); } catch { /* an empty or broken answer is handled by the status */ }
    return { ok: r.ok, status: r.status, data };
  }

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

  async function submit(ev) {
    ev.preventDefault();
    clearErrors();
    const eq = $('#stEq'), name = $('#stName'), tel = $('#stTel'), msg = $('#stMsg');
    const fail = (el, text) => { el.setAttribute('aria-invalid', 'true'); $('#stErr').textContent = text; el.focus(); };
    if (!eq.value) return fail(eq, 'Elegí tu equipo.');
    if (!name.value.trim()) return fail(name, 'Escribí tu nombre.');
    if (tel.value.replace(/\D/g, '').length < 8) return fail(tel, 'Escribí un teléfono con código de área.');
    if (!msg.value.trim()) return fail(msg, 'Contanos qué le está pasando al equipo.');
    const datos = { equipo: eq.options[eq.selectedIndex].text, nombre: name.value.trim(), telefono: tel.value.trim(), detalle: msg.value.trim() };
    let code;
    if (real) {
      const btn = $('#stOk');
      btn.disabled = true;
      btn.textContent = 'Enviando...';
      let r = null;
      try { r = await pedir('/api/solicitudes', 'POST', { ...datos, web: $('#stWeb').value }); } catch { /* no connection: handled below */ }
      btn.disabled = false;
      btn.textContent = 'Enviar solicitud';
      if (!r || !r.ok) { $('#stErr').textContent = (r && r.data.error) || 'No pudimos enviar la solicitud. Probá de nuevo en unos minutos.'; return undefined; }
      code = r.data.code;
    } else {
      code = addSolicitud(datos).code;
    }
    $('#stF').hidden = true;
    $('#stCode').textContent = code;
    $('#stTelOk').textContent = datos.telefono;
    $('#stDone').hidden = false;
    $('#stClose').focus();
    return undefined;
  }

  /* ---------- Real data ---------- */
  async function cargar() {
    if (!real || !internoLee()) return;
    let r = null;
    try { r = await pedir('/api/solicitudes'); } catch { /* no connection: handled below */ }
    if (r && r.status === 401) { setRol('cliente'); api.toast?.('Tu sesión venció. Ingresá de nuevo.'); return; }
    errorCarga = r && r.ok ? '' : 'No pudimos cargar las solicitudes. Probá de nuevo en unos minutos.';
    if (r && r.ok && JSON.stringify(r.data.solicitudes) !== JSON.stringify(solicitudes)) setSolicitudes(r.data.solicitudes);
    else render();
  }

  // A new request shows up by itself, unless someone is in the middle of writing a note
  function vigilar() {
    clearInterval(poll);
    if (!real) return;
    if (!internoLee()) { setSolicitudes([]); return; } // names and phones do not stay in memory after leaving
    cargar();
    poll = setInterval(() => {
      if (document.visibilityState === 'visible' && !$('#solL').contains(document.activeElement)) cargar();
    }, 60000);
  }

  async function cambiar(id, patch, demo) {
    if (!real) { updateSolicitud(id, demo || patch); return true; }
    let r = null;
    try { r = await pedir('/api/solicitudes', 'PATCH', { id, ...patch }); } catch { /* no connection: handled below */ }
    if (!r || !r.ok) { api.toast?.((r && r.data.error) || 'No pudimos guardar el cambio. Probá de nuevo.'); return false; }
    setSolicitudes(solicitudes.map(s => (s.id === id ? r.data.solicitud : s)));
    return true;
  }

  // Password check for "Acceso interno". Without the API there is nothing to check against
  async function ingresar(rol, clave) {
    if (!real) return { ok: true };
    let r = null;
    try { r = await pedir('/api/acceso', 'POST', { rol, clave }); } catch { /* no connection: handled below */ }
    return r && r.ok ? { ok: true } : { ok: false, error: (r && r.data.error) || 'No pudimos validar la clave. Probá de nuevo.' };
  }
  function salir() {
    if (real) pedir('/api/acceso', 'DELETE').catch(() => {});
  }

  function aplicarModo() {
    ['#stDemo', '#stDoneDemo', '#rolAviso'].forEach(s => { $(s).hidden = real; });
    $('#rolClaveF').hidden = !real;
    $('#rolClave').required = real;
  }

  async function detectar() {
    if (!hayApi) return;
    try {
      const r = await pedir('/api/acceso');
      if (!r.ok || !r.data.activo) return;
      real = true;
      setSolicitudes([]);
      aplicarModo();
      if (r.data.rol) setRol(r.data.rol);
    } catch { /* no API here: it stays a demonstration */ }
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
    if (errorCarga) { $('#solL').innerHTML = `<p class="st-none f-err">${esc(errorCarga)}</p>`; return; }
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
        cambiar(id, { estado: 'contacto' }, { estado: 'contacto', tomadaPor: ACCESOS[getRol()].n, tomadaEl: new Date().toISOString() }).then(ok => {
          if (!ok) return;
          filtro = 'contacto';
          render();
          $(`[data-card="${id}"] a.btn`)?.focus();
          api.toast?.('Solicitud tomada. Ya podés llamar.');
        });
        return;
      }
      const cerrar = t.closest('[data-cerrar]');
      if (cerrar) { cambiar(Number(cerrar.dataset.cerrar), { estado: 'cerrada' }).then(ok => { if (ok) api.toast?.('Solicitud resuelta.'); }); return; }
      const reabrir = t.closest('[data-reabrir]');
      if (reabrir) cambiar(Number(reabrir.dataset.reabrir), { estado: 'contacto' }).then(ok => { if (ok) { filtro = 'contacto'; render(); } });
    });
    $('#solL').addEventListener('change', e => { const n = e.target.dataset.nota; if (n) cambiar(Number(n), { nota: e.target.value.trim() }).then(ok => { if (ok) api.toast?.('Nota guardada.'); }); });
    onSol(render);
    onRol(vigilar);
    aplicarModo();
    render();
    detectar();
  }

  return { init, render, open, ingresar, salir, actualizar: cargar };
})();
