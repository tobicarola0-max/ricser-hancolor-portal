/* Scene 5: Portal del cliente. Four functional views ported from "Portal de servicio técnico.html":
   client portal, internal panel, manufacturer portal and the data model. */
window.Portal = (() => {
  const { TG, ICON, TYPES, REM, EQ, EV, DB, EQUIPOS, fmt, num, esc, done, warranty, eqStatus, on, emit, addEvent, updateEvent, codeOf, addEvidence, removeEvidence, checkFile, LIMITS, ACCESOS, CLIENTE, getRol, setRol, onRol, clStep, clDate, updateEquipo } = Ricser;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  let cur = 'e1', dtype = '', toastTimer = 0;
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');

  const toast = m => {
    const t = $('#toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
  };

  /* ---------- CLIENT ----------
     The client sees its own details, machines, open services and orders, in three stages. Warranty, hours of use and
     the internal steps are only for technicians and administration, who open this same tab with everything. */
  const full = () => getRol() !== 'cliente';
  const stepsOf = v => (full() ? TYPES[v.t].steps : TYPES[v.t].cl);
  const stepOf = v => (full() ? v.s : clStep(v));
  const typeName = v => (full() ? TYPES[v.t].n : TYPES[v.t].cn);
  const dateOf = (v, i) => (full() ? (v.hist && i <= v.s ? v.hist[i] || '' : '') : clDate(v, i));

  function renderDatos() {
    const rows = [['Empresa', CLIENTE.nombre], ['CUIT', CLIENTE.cuit], ['Contacto', CLIENTE.contacto], ['Teléfono', CLIENTE.telefono], ['Email', CLIENTE.email], ['Planta', CLIENTE.planta]];
    $('#misDatos').innerHTML = `<div class="panel glass cl-datos"><h3>Mis datos</h3><dl class="cl-dl">${rows.map(r => `<div><dt>${r[0]}</dt><dd>${esc(r[1])}</dd></div>`).join('')}</dl></div>`;
  }

  function renderEqs() {
    $('#eqs').innerHTML = `<h3 class="cl-eqs">Mis equipos</h3>${EQ.map(e => {
      const open = EV.filter(v => v.eq === e.id && !done(v)).length;
      const w = warranty(e), st = eqStatus(e, !full());
      const info = full()
        ? `<span class="eq-m mono"><span>${num(e.h)} h</span><span>${w.valid ? 'Garantía ' + Math.round(w.pct) + '%' : 'Sin garantía'}</span></span>
          <span class="bar" aria-hidden="true"><i class="${w.valid ? '' : 'over'}" style="width:${w.pct}%"></i></span>`
        : `<span class="eq-s">Instalado el ${fmt(e.inst)}</span>`;
      return `<button class="eq glass" data-id="${e.id}" aria-current="${e.id === cur}">
        <span class="eq-img"><img src="${e.img}" alt="" width="${e.iw}" height="${e.ih}" loading="lazy"></span>
        <span class="eq-b">
          <b>${esc(e.m)}</b>
          <span class="mono eq-s">${esc(e.s)}</span>
          ${info}
          <span class="pills"><span class="pill ${st.c}">${st.t}</span>${open ? `<span class="pill">${open} en curso</span>` : ''}</span>
        </span>
      </button>`;
    }).join('')}`;
  }

  function tracker(v) {
    const T = TYPES[v.t], steps = stepsOf(v), at = stepOf(v), n = steps.length;
    if (n < 2) return '';
    if (T.v) {
      const p = done(v) ? 100 : at / (n - 1) * 100;
      const icon = v.t === 'repuesto' && at >= n - (full() ? 2 : 1) ? 'truck' : T.v;
      return `<div class="trk ${icon}"><div class="rail"><i style="width:${p}%"></i><span class="vh" style="left:${p}%">${ICON[icon]}</span></div>
        <div class="lbl">${steps.map((s, k) => `<span class="${k === at ? 'n' : ''}">${esc(s)}</span>`).join('')}</div></div>`;
    }
    return `<div class="steps">${steps.map((s, k) => `<div class="${k < at || done(v) ? 'd' : k === at ? 'n' : ''}">${esc(s)}</div>`).join('')}</div>`;
  }

  /* A spare-part request in the history expands into its own detail: stages, shipment and the client's own videos and
     photos. The internal chat, the technical note and editing the stages stay in the factory view. */
  const openCases = new Set(), caseEv = new Map();
  const CHEVRON = '<svg class="fc-ch" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 6l5 5 5-5"/></svg>';

  function caseMedia(v) {
    const list = v.fab.evidencia.filter(x => x.por === 'Cliente');
    if (!list.length) return '<div class="ev-empty cd-empty">Todavía no cargaste videos ni fotos de este pedido.</div>';
    const sel = list.find(x => x.id === caseEv.get(v.id)) || list[list.length - 1];
    const media = sel.tipo === 'video'
      ? `<video src="${sel.url}" controls playsinline preload="metadata" aria-label="Tu registro: ${esc(sel.nombre)}"></video>`
      : `<img src="${sel.url}" alt="Tu registro: ${esc(sel.nombre)}">`;
    return `<div class="ev-view">${media}</div><ul class="ev-list">${list.map(x => `<li><button type="button" class="chip" data-cev="${x.id}" data-case="${v.id}" aria-pressed="${x.id === sel.id}">${x.tipo === 'video' ? 'Video' : 'Foto'} · ${esc(x.nombre)}</button><button type="button" class="ev-x" data-cevx="${x.id}" data-case="${v.id}" aria-label="Quitar ${esc(x.nombre)}">×</button></li>`).join('')}</ul>`;
  }

  function caseRow(v) {
    const T = TYPES[v.t], open = openCases.has(v.id), steps = stepsOf(v), at = stepOf(v);
    const facts = [['Pieza', v.ti], ['Falla informada', v.falla || 'Sin detalle'], ['Guía aérea', v.guia || 'Pendiente de fábrica'], ['Transportista', v.carrier || 'A confirmar'], ['Llegada estimada', v.eta ? fmt(v.eta) : 'A confirmar']];
    return `<li style="--c:${T.c}">
      <button type="button" class="case-row" data-case-id="${v.id}" aria-expanded="${open}" aria-controls="cd-${v.id}">
        <span class="tl-h"><b>${esc(v.ti)}</b><span class="pill ${done(v) ? 'ok' : ''}">${esc(steps[at])}</span></span>
        <span class="sm">${typeName(v)} · ${fmt(v.d)} · <span class="case mono">${esc(v.caso)}</span>${v.guia ? ` · <span class="mono">${esc(v.guia)}</span>` : ''}${v.carrier ? ` · ${esc(v.carrier)}` : ''}${v.eta ? ` · Llega el ${fmt(v.eta)}` : ''}</span>
        ${CHEVRON}
      </button>
      ${v.notas ? `<p class="sm">${esc(v.notas)}</p>` : ''}
      ${tracker(v)}
      <div class="case-detail" id="cd-${v.id}"${open ? '' : ' hidden'}>
        <div class="cd-in">
          <dl class="fc-sum">${facts.map(f => `<div><dt>${f[0]}</dt><dd>${esc(f[1])}</dd></div>`).join('')}</dl>
          <ol class="pz-tl" style="--n:${steps.length}">${steps.map((n, i) => `<li class="${i < at ? 'd' : i === at ? 'n' : ''}"${i === at ? ' aria-current="step"' : ''}><span class="pz-b"><b>${esc(n)}</b><small>${dateOf(v, i) ? fmt(dateOf(v, i)) : ''}</small></span></li>`).join('')}</ol>
          <section class="cd-ev" aria-label="Tus videos y fotos del pedido ${esc(v.caso)}">
            <h4>Tus videos y fotos</h4>
            <div class="ev-box">${caseMedia(v)}</div>
            <div class="ev-up"><label class="btn ghost ev-btn">Cargar video o foto<input class="sr" type="file" accept="video/*,image/*" data-cup="${v.id}"></label><small>Video hasta ${LIMITS.video} MB, foto hasta ${LIMITS.imagen} MB.</small></div>
            <p class="f-err" role="alert" data-cerr="${v.id}"></p>
          </section>
        </div>
      </div>
      <button class="link" data-track="${esc(v.caso)}">Ver en seguimiento</button>
    </li>`;
  }

  function evRow(v) {
    if (v.t === 'repuesto') return caseRow(v);
    const T = TYPES[v.t], code = codeOf(v);
    return `<li style="--c:${T.c}">
      <div class="tl-h"><b>${esc(v.ti)}</b><span class="pill ${done(v) ? 'ok' : ''}">${esc(stepsOf(v)[stepOf(v)])}</span></div>
      <p class="sm">${typeName(v)} · ${fmt(v.d)}${code ? ` · <span class="case mono">${esc(code)}</span>` : ''}</p>
      ${tracker(v)}
      ${T.v && code ? `<button class="link" data-track="${esc(code)}">Ver en seguimiento</button>` : ''}
    </li>`;
  }

  // Height animation, so nothing below the row jumps
  function toggleCase(btn) {
    const id = Number(btn.dataset.caseId), p = document.getElementById(`cd-${id}`), open = btn.getAttribute('aria-expanded') !== 'true';
    btn.setAttribute('aria-expanded', open);
    if (open) openCases.add(id); else openCases.delete(id);
    if (window.gsap) gsap.killTweensOf(p);
    const end = () => { p.classList.remove('anim'); gsap.set(p, { clearProps: 'height' }); window.__lenis?.resize(); };
    if (open) {
      p.hidden = false;
      if (motion()) { p.classList.add('anim'); gsap.fromTo(p, { height: 0 }, { height: 'auto', duration: .45, ease: 'power3.out', onComplete: end }); }
    } else {
      p.querySelectorAll('video').forEach(v => v.pause());
      if (motion()) { p.classList.add('anim'); gsap.to(p, { height: 0, duration: .34, ease: 'power2.inOut', onComplete: () => { p.hidden = true; end(); } }); } else p.hidden = true;
    }
  }

  function renderDet() {
    const e = EQ.find(x => x.id === cur), w = warranty(e), st = eqStatus(e, !full());
    const evs = EV.filter(v => v.eq === cur).sort((x, y) => y.d.localeCompare(x.d) || y.id - x.id);
    const block = (title, list, empty) => `<div class="panel glass"><h3>${title}</h3>${list.length ? `<ul class="tl">${list.map(evRow).join('')}</ul>` : `<p class="sm cl-none">${empty}</p>`}</div>`;
    const historia = full()
      ? block('Historial y seguimiento', evs, 'Sin movimientos.')
      : block('Servicios abiertos', evs.filter(v => v.t !== 'insumo' && !done(v)), 'No tenés servicios abiertos para este equipo.')
        + block('Pedidos', evs.filter(v => v.t === 'insumo'), 'Todavía no hiciste pedidos para este equipo.')
        + block('Historial', evs.filter(v => v.t !== 'insumo' && done(v)), 'Todavía no hay servicios cerrados.');
    $('#det').innerHTML = `
    <div class="panel glass det-hero">
      <div class="det-img"><img src="${e.img}" alt="${esc(e.m)}" width="${e.iw}" height="${e.ih}"></div>
      <div class="det-info">
        <div class="det-t"><h3>${esc(e.m)}</h3><span class="pill ${st.c}">${st.t}</span></div>
        <dl class="facts">
          <div><dt>Número de serie</dt><dd class="mono">${esc(e.s)}</dd></div>
          <div><dt>Instalado el</dt><dd>${fmt(e.inst)}</dd></div>
          <div class="fact-w"><dt>Cabezal</dt><dd>${full() ? `<input data-eqk="cabezal" data-id="${e.id}" value="${esc(e.cabezal)}" aria-label="Cabezal de ${esc(e.m)}" autocomplete="off">` : esc(e.cabezal)}</dd></div>
          ${full() ? `<div><dt>Uso acumulado</dt><dd class="mono">${num(e.h)} h</dd></div><div><dt>Garantía hasta</dt><dd>${fmt(e.gar)}</dd></div>` : ''}
        </dl>
        ${full() ? `<div class="bar big" role="img" aria-label="Garantía consumida ${Math.round(w.pct)}%"><i class="${w.valid ? '' : 'over'}" style="width:${w.pct}%"></i></div>
        <p class="sm">${w.valid ? 'Garantía consumida: ' + Math.round(w.pct) + '%' : 'Garantía vencida. Los repuestos y visitas tienen costo.'}</p>` : ''}
      </div>
    </div>
    <div class="panel glass">
      <h3>¿Qué necesitás?</h3>
      <div class="acts">
        <button class="act" data-t="repuesto"><b>${full() ? 'Reclamo de garantía' : 'Pedir un repuesto'}</b><span>Le pedimos a la fábrica que envíe la pieza</span><em>${full() && !w.valid ? 'Se cotiza' : 'Recibís un número de caso'}</em></button>
        <button class="act" data-t="remoto"><b>Soporte remoto</b><span>Migración, calibración o capacitación</span><em>Desde USD 50</em></button>
        <button class="act" data-t="visita"><b>Visita técnica</b><span>Un técnico va a tu planta</span><em>Se cotiza según zona</em></button>
        <button class="act" data-t="insumo"><b>Pedir insumos</b><span>Tintas, cabezales, consumibles</span><em>Con tu lista de precios</em></button>
      </div>
    </div>
    ${historia}`;
  }

  /* ---------- DIALOG ---------- */
  function openDlg(t) {
    dtype = t;
    const e = EQ.find(x => x.id === cur);
    $('#dt').textContent = full() ? TYPES[t].n : TYPES[t].cn;
    $('#dsub').textContent = e.m + ' · ' + e.s;
    $('#note').value = '';
    let o = '', x = '';
    if (t === 'remoto') {
      o = REM.map((r, k) => `<label class="opt"><input type="radio" name="o" value="${k}" ${k ? '' : 'checked'}><span><b>${esc(r.k)}</b><small>${esc(r.d)}</small></span><b class="mono">USD ${r.p}</b></label>`).join('');
      x = '<label class="f">Día y horario preferido<select id="slot"><option>Mañana, 10:00</option><option>Mañana, 15:00</option><option>Pasado mañana, 11:00</option></select></label>';
    }
    if (t === 'repuesto') x = '<label class="f">¿Qué pieza falló?<input id="part" placeholder="Ej.: cabezal de impresión" aria-describedby="partErr"></label><p class="f-err" id="partErr"></p><label class="f">Foto o video de la falla<input id="partFile" type="file" accept="image/*,video/*" aria-describedby="fileErr"></label><p class="f-err" id="fileErr"></p>';
    if (t === 'visita') x = '<label class="f">Urgencia<select id="urg"><option>Esta semana</option><option>Este mes</option><option>Equipo detenido (urgente)</option></select></label>';
    if (t === 'insumo') x = '<label class="f">Insumos y cantidades<input id="part" placeholder="Ej.: Tinta UV cian ×2"></label>';
    $('#opts').innerHTML = o;
    $('#extra').innerHTML = x;
    upd();
    $('#dlg').showModal();
    window.__lenis?.stop();
    // Animate the form, not the <dialog>: GSAP on the dialog itself drops it out of the modal top layer,
    // leaving it unreachable below the fold and the page unresponsive.
    if (motion()) gsap.fromTo('#dlgF', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power3.out', clearProps: 'transform,opacity' });
  }

  function upd() {
    const r = document.querySelector('input[name=o]:checked');
    $('#tot').textContent = dtype === 'remoto' && r ? 'Total: USD ' + REM[r.value].p : dtype === 'repuesto' ? (full() ? 'Sin costo si está en garantía' : 'Te avisamos cómo sigue') : 'Te enviamos cotización';
  }

  function submitDlg(ev) {
    ev.preventDefault();
    const r = document.querySelector('input[name=o]:checked'), p = $('#part'), T = TYPES[dtype];
    if (dtype === 'repuesto' && !p.value.trim()) { $('#partErr').textContent = 'Decinos qué pieza falló.'; p.focus(); return; }
    const file = dtype === 'repuesto' && $('#partFile').files[0];
    if (file) {
      const err = checkFile(file);
      $('#fileErr').textContent = err || '';
      if (err) { $('#partFile').focus(); return; }
    }
    const note = $('#note').value.trim();
    const ti = dtype === 'remoto' ? REM[r.value].k : (p && p.value.trim()) || T.n;
    const e = addEvent({ eq: cur, t: dtype, ti, price: dtype === 'remoto' ? REM[r.value].p : 0, note, falla: note });
    $('#dlg').close();
    // The file goes with the claim, so the technician and the factory find it on the case
    if (file) addEvidence(e.id, file, 'Cliente').then(() => emit('cli'));
    const code = codeOf(e);
    toast(code ? `Solicitud enviada. Tu número es ${code}.` : 'Solicitud enviada. Podés seguirla en el historial.');
  }

  /* ---------- INTERNAL ---------- */
  const margin = e => e.price ? Math.round((e.price - e.cost) / e.price * 100) + '%' : '—';

  function renderKpis() {
    const open = EV.filter(e => !done(e));
    const rev = EV.reduce((a, e) => a + e.price, 0), cost = EV.reduce((a, e) => a + e.cost, 0);
    const vals = [
      ['open', 'Servicios abiertos', open.length, ''],
      ['parts', 'Repuestos en curso', open.filter(e => e.t === 'repuesto').length, ''],
      ['rev', 'Facturado USD', rev, ''],
      ['mg', 'Margen', rev ? Math.round((rev - cost) / rev * 100) : 0, '%'],
    ];
    const box = $('#kpis');
    if (!box.children.length) box.innerHTML = vals.map(k => `<div class="kpi glass" data-k="${k[0]}"${k[0] === 'rev' || k[0] === 'mg' ? ' data-admin' : ''}><b class="mono">0</b><span>${k[1]}</span></div>`).join('');
    vals.forEach(k => {
      const el = box.querySelector(`[data-k=${k[0]}] b`);
      const from = Number(el.dataset.v || 0), to = k[2];
      el.dataset.v = to;
      if (motion() && from !== to) {
        const o = { v: from };
        gsap.to(o, { v: to, duration: .6, ease: 'power2.out', onUpdate: () => { el.textContent = num(Math.round(o.v)) + k[3]; } });
        gsap.fromTo(el.parentNode, { borderColor: '#50bab7' }, { borderColor: 'rgba(41,130,163,.55)', duration: .9, clearProps: 'borderColor' });
      } else el.textContent = num(to) + k[3];
    });
  }

  function renderInt() {
    renderKpis();
    $('#tick').innerHTML = EV.filter(e => e.t !== 'instalacion').slice().reverse().map(e => {
      const T = TYPES[e.t], q = EQ.find(x => x.id === e.eq), code = codeOf(e);
      const aria = what => `aria-label="${what}: ${esc(e.ti)}"`;
      return `<tr data-row="${e.id}">
        <td><b>Gráfica Del Plata</b><span class="sm">${esc(q.m)}</span></td>
        <td>${esc(e.ti)}<span class="sm">${T.n}${code ? ' · ' + esc(code) : ''}</span></td>
        <td><select data-id="${e.id}" data-k="s" ${aria('Estado')}>${T.steps.map((s, k) => `<option value="${k}" ${k === e.s ? 'selected' : ''} ${e.fab && e.fab.estado !== 'enviado' && k > 0 ? 'disabled' : ''}>${esc(s)}</option>`).join('')}</select></td>
        <td><input data-id="${e.id}" data-k="tec" value="${esc(e.tec)}" ${aria('Técnico')}></td>
        <td data-admin><input class="num" type="number" min="0" data-id="${e.id}" data-k="cost" value="${e.cost}" ${aria('Costo en USD')}></td>
        <td data-admin><input class="num" type="number" min="0" data-id="${e.id}" data-k="price" value="${e.price}" ${aria('Precio en USD')}></td>
        <td class="mono mg" data-admin>${margin(e)}</td>
        <td class="note-c"><input data-id="${e.id}" data-k="note" value="${esc(e.note)}" ${aria('Nota interna')}></td>
      </tr>`;
    }).join('');
  }

  /* ---------- MAILS SENT (the button in the bar hides on the factory tab: it never sees client addresses) ---------- */
  let mailSel = null;
  const MAIL_STATE = { demo: 'Demo, no salió', pendiente: 'Enviando', enviado: 'Enviado', error: 'Falló' };

  function renderInbox() {
    const list = Notifier.outbox, cur = list.find(m => m.id === mailSel) || list[0];
    $('#mbMode').textContent = Notifier.real ? 'Envío real' : 'Modo demo';
    $('#mailsN').textContent = list.length;
    $('#mbList').innerHTML = list.length ? list.map(m => `<li><button type="button" class="mb-i" data-mail="${m.id}" aria-pressed="${m === cur}">
        <b>${esc(m.subject)}</b>
        <span>Para ${esc(m.toName)} · ${esc(m.to)}</span>
        <span class="mono">${new Date(m.at).toLocaleString('es-AR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })} · ${MAIL_STATE[m.estado]}</span>
      </button></li>`).join('') : '<li class="mb-empty">Todavía no salió ningún mail. Avanzá la etapa de una pieza en Fábrica HanColor y el aviso aparece acá.</li>';
    const prev = $('#mbPrev');
    prev.hidden = !cur;
    if (cur && prev.dataset.id !== String(cur.id)) { prev.srcdoc = cur.html; prev.dataset.id = cur.id; }
  }

  function openInbox() {
    renderInbox();
    $('#mailDlg').showModal();
    window.__lenis?.stop();
    // Same rule as the request dialog: animate what is inside, never the <dialog> itself
    if (motion()) gsap.fromTo('#mailIn', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power3.out', clearProps: 'transform,opacity' });
  }

  /* ---------- DATA MODEL ---------- */
  const ER_POS = {
    usuarios_y_roles: [110, 44], clientes: [330, 44], equipos: [550, 44], eventos_servicio: [790, 44],
    casos_garantia: [130, 176], servicios_remotos: [370, 176], visitas_tecnicas: [610, 176], pedidos_insumos: [860, 176],
    repuestos_solicitados: [130, 296], notificaciones: [370, 296], solicitudes_servicio: [610, 296],
  };
  let dbFilter = 'all', dbSel = null;

  function counts(t) {
    const r = { c: 0, cf: 0, i: 0 };
    t[2].forEach(f => r[f[1]]++);
    return r;
  }
  function related(name) {
    const set = new Set([name]);
    DB.forEach(t => { if (t[0] === name) t[3].forEach(x => set.add(x)); if (t[3].includes(name)) set.add(t[0]); });
    return set;
  }

  function renderFilter() {
    const total = { all: 0, c: 0, cf: 0, i: 0 };
    DB.forEach(t => t[2].forEach(f => { total.all++; total[f[1]]++; }));
    const opts = [['all', 'Todos'], ['c', TG.c], ['cf', TG.cf], ['i', TG.i]];
    $('#dbFilter').innerHTML = opts.map(o => `<button class="chip f-${o[0]}" data-f="${o[0]}" aria-pressed="${dbFilter === o[0]}">${o[1]} <span class="mono">${total[o[0]]}</span></button>`).join('');
  }

  function renderEr() {
    const W = 180, H = 44;
    const rel = dbSel ? related(dbSel) : null;
    const link = (a, b) => {
      const [ax, ay] = ER_POS[a], [bx, by] = ER_POS[b];
      const on = !rel || (rel.has(a) && rel.has(b) && (a === dbSel || b === dbSel));
      let d;
      if (Math.abs(ay - by) < 4) {
        const dir = bx > ax ? 1 : -1;
        d = `M${ax + dir * W / 2} ${ay}L${bx - dir * W / 2} ${by}`;
      } else {
        const top = ay < by ? [ax, ay + H / 2, bx, by - H / 2] : [bx, by + H / 2, ax, ay - H / 2];
        const m = (top[1] + top[3]) / 2;
        d = `M${top[0]} ${top[1]}C${top[0]} ${m} ${top[2]} ${m} ${top[2]} ${top[3]}`;
      }
      return `<path class="er-l ${on ? '' : 'off'}" d="${d}"/>`;
    };
    let lines = '';
    DB.forEach(t => t[3].forEach(p => { lines += link(t[0], p); }));
    const nodes = DB.map(t => {
      const [x, y] = ER_POS[t[0]], c = counts(t);
      const dim = (rel && !rel.has(t[0])) || (dbFilter !== 'all' && !c[dbFilter]);
      const sub = dbFilter === 'all' ? `${t[2].length} campos` : `${c[dbFilter]} de ${t[2].length}`;
      return `<g class="er-n ${dim ? 'dim' : ''} ${dbSel === t[0] ? 'sel' : ''}" tabindex="0" role="button" aria-pressed="${dbSel === t[0]}" data-t="${t[0]}" transform="translate(${x - W / 2} ${y - H / 2})">
        <rect width="${W}" height="${H}" rx="3"/><text x="${W / 2}" y="19">${t[0]}</text><text class="s" x="${W / 2}" y="35">${sub}</text></g>`;
    }).join('');
    $('#erMap').innerHTML = lines + nodes;
  }

  function renderTables() {
    const rel = dbSel ? related(dbSel) : null;
    $('#tables').innerHTML = DB.map(t => {
      const fields = t[2].filter(f => dbFilter === 'all' || f[1] === dbFilter);
      const dim = rel && !rel.has(t[0]);
      return `<article class="tb glass ${dim ? 'dim' : ''} ${dbSel === t[0] ? 'sel' : ''}" data-tb="${t[0]}">
        <h3 class="mono">${t[0]}</h3><p>${esc(t[1])}</p>
        ${t[3].length ? `<p class="fk mono">→ ${t[3].join(', ')}</p>` : ''}
        ${fields.length ? `<ul>${fields.map(f => `<li><span>${esc(f[0])}</span><span class="tag ${f[1]}">${TG[f[1]]}</span></li>`).join('')}</ul>` : '<p class="none">Sin campos con esta visibilidad.</p>'}
      </article>`;
    }).join('');
  }
  function renderDb() { renderFilter(); renderEr(); renderTables(); }

  function fleet() {
    const one = EQUIPOS.map(e => `<figure><img src="${e.thumb.src}" alt="" width="${e.thumb.w}" height="${e.thumb.h}" loading="lazy" decoding="async"><figcaption class="mono">${esc([e.nombre, e.modelo].filter(Boolean).join(' '))}</figcaption></figure>`).join('');
    $('#fleet').style.animationDuration = `${EQUIPOS.length * 7.5}s`; // same speed whatever the size of the catalogue
    $('#fleet').innerHTML = one + one;
  }

  /* ---------- WIRING ---------- */
  function renderAll(src) {
    renderDatos(); renderEqs(); renderDet();
    // Editing a row must not rebuild the table you are typing in, or keyboard focus would be lost
    if (src !== 'int') renderInt(); else renderKpis();
    if (src !== 'fab') Fabrica.render();
  }

  /* What each person can open. Prototype: it changes what is shown, it does not protect the data */
  function applyRol() {
    const r = getRol(), vistas = ACCESOS[r].vistas;
    $$('.cc-tabs [role=tab]').forEach(t => { t.hidden = !vistas.includes(t.dataset.v); });
    $('#rolBtn').textContent = r === 'cliente' ? 'Acceso interno' : `${ACCESOS[r].n} · Salir`;
    const act = $('.cc-tabs [aria-selected="true"]').dataset.v;
    setView(vistas.includes(act) ? act : vistas[0], false, true);
    renderAll();
  }

  function setView(id, focus, quiet) {
    $$('.cc-tabs [role=tab]').forEach(x => {
      const on = x.dataset.v === id;
      x.setAttribute('aria-selected', on);
      x.tabIndex = on ? 0 : -1;
      if (on && focus) x.focus();
    });
    $$('.view').forEach(v => {
      const on = v.id === id;
      v.classList.toggle('on', on);
      v.hidden = !on;
    });
    $('#mailsBtn').hidden = id === 'fab' || ['cliente', 'fab'].includes(getRol());
    if (motion() && !quiet) gsap.fromTo(`#${id} > *`, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, stagger: .05, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  }

  function init() {
    $('#eqs').addEventListener('click', e => { const b = e.target.closest('.eq'); if (b) { cur = b.dataset.id; renderEqs(); renderDet(); } });
    $('#det').addEventListener('click', e => {
      const row = e.target.closest('.case-row');
      if (row) { toggleCase(row); return; }
      const a = e.target.closest('.act');
      if (a) { openDlg(a.dataset.t); return; }
      const pick = e.target.closest('[data-cev]');
      if (pick) { caseEv.set(Number(pick.dataset.case), Number(pick.dataset.cev)); renderDet(); return; }
      const del = e.target.closest('[data-cevx]');
      if (del) { removeEvidence(Number(del.dataset.case), Number(del.dataset.cevx)); emit('cli'); return; }
      const t = e.target.closest('[data-track]');
      if (t) { Tracker.search(t.dataset.track, { deferPlay: true }); window.Cinema?.go('s4'); }
    });
    $('#det').addEventListener('change', async e => {
      const k = e.target.closest('[data-eqk]');
      if (k) { updateEquipo(k.dataset.id, k.dataset.eqk, k.value.trim()); toast('Guardado. El cliente ya ve el cambio.'); return; }
      const input = e.target.closest('[data-cup]');
      if (!input) return;
      const id = Number(input.dataset.cup), file = input.files[0];
      input.value = '';
      if (!file) return;
      const r = await addEvidence(id, file, 'Cliente');
      if (r.error) { document.querySelector(`[data-cerr="${id}"]`).textContent = r.error; return; }
      caseEv.set(id, r.item.id);
      emit('cli');
      toast('Listo. Ricser y la fábrica ya lo pueden ver.');
      document.querySelector(`[data-cup="${id}"]`)?.focus();
    });
    // A video the browser cannot play must say so instead of showing a dead player
    $('#det').addEventListener('error', e => {
      if (e.target.tagName === 'VIDEO') e.target.insertAdjacentHTML('afterend', '<p class="f-err">Este navegador no puede reproducir el formato. Probá con MP4 o WebM.</p>');
    }, true);
    $('#opts').addEventListener('change', upd);
    $('#cx').addEventListener('click', () => $('#dlg').close());
    $('#dlg').addEventListener('close', () => window.__lenis?.start());
    $('#dlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#dlgF').addEventListener('submit', submitDlg);

    $('#tick').addEventListener('change', e => {
      const t = e.target; if (!t.dataset.id) return;
      const mails = Notifier.outbox.length;
      const v = updateEvent(+t.dataset.id, t.dataset.k, t.value, 'int');
      const row = t.closest('tr');
      if (v && row) row.querySelector('.mg').textContent = margin(v);
      if (Notifier.outbox.length === mails) toast('Guardado. El cliente ya ve el cambio.'); // otherwise the mail toast already said it
    });
    Fabrica.init({ toast, openInbox });
    Servicio.init({ toast });
    $('#rolBtn').addEventListener('click', () => {
      if (getRol() !== 'cliente') { setRol('cliente'); toast('Saliste del acceso interno.'); return; }
      $('#rolDlg').showModal();
      window.__lenis?.stop();
      if (motion()) gsap.fromTo('#rolF', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power3.out', clearProps: 'transform,opacity' });
    });
    $('#rolF').addEventListener('submit', e => {
      e.preventDefault();
      const r = $('#rolSel').value;
      $('#rolDlg').close();
      setRol(r);
      setView(ACCESOS[r].vistas[0]);
      toast(`Entraste como ${ACCESOS[r].n}.`);
    });
    $('#rolCx').addEventListener('click', () => $('#rolDlg').close());
    $('#rolDlg').addEventListener('close', () => window.__lenis?.start());
    $('#rolDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#mbList').addEventListener('click', e => { const b = e.target.closest('[data-mail]'); if (b) { mailSel = Number(b.dataset.mail); renderInbox(); } });
    Notifier.on(m => { renderInbox(); if (m.estado !== 'error') toast(`Mail enviado a ${m.toName}`); else toast(`No se pudo enviar el mail a ${m.toName}`); });
    renderInbox();
    $('#mailsBtn').addEventListener('click', openInbox);
    $('#mbClose').addEventListener('click', () => $('#mailDlg').close());
    $('#mailDlg').addEventListener('close', () => window.__lenis?.start());
    $('#mailDlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });

    const tabs = $('.cc-tabs');
    tabs.addEventListener('click', e => { const b = e.target.closest('[role=tab]'); if (b) setView(b.dataset.v); });
    tabs.addEventListener('keydown', e => {
      const list = $$('.cc-tabs [role=tab]:not([hidden])'), i = list.indexOf(document.activeElement);
      if (i < 0) return;
      const n = e.key === 'ArrowRight' ? i + 1 : e.key === 'ArrowLeft' ? i - 1 : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : null;
      if (n === null) return;
      e.preventDefault();
      setView(list[(n + list.length) % list.length].dataset.v, true);
    });

    $('#dbFilter').addEventListener('click', e => { const b = e.target.closest('[data-f]'); if (b) { dbFilter = b.dataset.f; renderDb(); } });
    const pick = name => { dbSel = dbSel === name ? null : name; renderEr(); renderTables(); };
    $('#erMap').addEventListener('click', e => { const g = e.target.closest('[data-t]'); if (g) pick(g.dataset.t); });
    $('#erMap').addEventListener('keydown', e => { if (e.key !== 'Enter' && e.key !== ' ') return; const g = e.target.closest('[data-t]'); if (!g) return; e.preventDefault(); const name = g.dataset.t; pick(name); $(`#erMap [data-t=${name}]`)?.focus(); });

    renderDb(); fleet();
    on(renderAll);
    onRol(applyRol);
    applyRol();
  }

  return { init, toast };
})();
