/* Scene 5: Command Center. Four functional views ported from "Portal de servicio técnico.html":
   client portal, internal panel, manufacturer portal and the data model. */
window.Portal = (() => {
  const { TG, ICON, TYPES, REM, EQ, EV, DB, fmt, num, esc, done, warranty, eqStatus, on, addEvent, updateEvent, codeOf } = Ricser;
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  let cur = 'e1', dtype = '', toastTimer = 0;
  const motion = () => !!window.gsap && !document.documentElement.classList.contains('static');

  const toast = m => {
    const t = $('#toast'); t.textContent = m; t.classList.add('on');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('on'), 3200);
  };

  /* ---------- CLIENT ---------- */
  function renderEqs() {
    $('#eqs').innerHTML = EQ.map(e => {
      const open = EV.filter(v => v.eq === e.id && !done(v)).length;
      const w = warranty(e), st = eqStatus(e);
      return `<button class="eq glass" data-id="${e.id}" aria-current="${e.id === cur}">
        <span class="eq-img"><img src="${e.img}" alt="" width="${e.iw}" height="${e.ih}" loading="lazy"></span>
        <span class="eq-b">
          <b>${esc(e.m)}</b>
          <span class="mono eq-s">${esc(e.s)}</span>
          <span class="eq-m mono"><span>${num(e.h)} h</span><span>${w.valid ? 'Garantía ' + Math.round(w.pct) + '%' : 'Sin garantía'}</span></span>
          <span class="bar" aria-hidden="true"><i class="${w.valid ? '' : 'over'}" style="width:${w.pct}%"></i></span>
          <span class="pills"><span class="pill ${st.c}">${st.t}</span>${open ? `<span class="pill">${open} en curso</span>` : ''}</span>
        </span>
      </button>`;
    }).join('');
  }

  function tracker(v, T) {
    const n = T.steps.length;
    if (n < 2) return '';
    if (T.v) {
      const p = done(v) ? 100 : v.s / (n - 1) * 100;
      const icon = v.t === 'repuesto' && v.s >= 4 ? 'truck' : T.v;
      return `<div class="trk ${icon}"><div class="rail"><i style="width:${p}%"></i><span class="vh" style="left:${p}%">${ICON[icon]}</span></div>
        <div class="lbl">${T.steps.map((s, k) => `<span class="${k === v.s ? 'n' : ''}">${esc(s)}</span>`).join('')}</div></div>`;
    }
    return `<div class="steps">${T.steps.map((s, k) => `<div class="${k < v.s || done(v) ? 'd' : k === v.s ? 'n' : ''}">${esc(s)}</div>`).join('')}</div>`;
  }

  function renderDet() {
    const e = EQ.find(x => x.id === cur), w = warranty(e), st = eqStatus(e);
    const evs = EV.filter(v => v.eq === cur).sort((x, y) => y.d.localeCompare(x.d) || y.id - x.id);
    $('#det').innerHTML = `
    <div class="panel glass det-hero">
      <div class="det-img"><img src="${e.img}" alt="${esc(e.m)}" width="${e.iw}" height="${e.ih}"></div>
      <div class="det-info">
        <div class="det-t"><h3>${esc(e.m)}</h3><span class="pill ${st.c}">${st.t}</span></div>
        <dl class="facts">
          <div><dt>Número de serie</dt><dd class="mono">${esc(e.s)}</dd></div>
          <div><dt>Uso acumulado</dt><dd class="mono">${num(e.h)} h</dd></div>
          <div><dt>Instalado el</dt><dd>${fmt(e.inst)}</dd></div>
          <div><dt>Garantía hasta</dt><dd>${fmt(e.gar)}</dd></div>
        </dl>
        <div class="bar big" role="img" aria-label="Garantía consumida ${Math.round(w.pct)}%"><i class="${w.valid ? '' : 'over'}" style="width:${w.pct}%"></i></div>
        <p class="sm">${w.valid ? 'Garantía consumida: ' + Math.round(w.pct) + '%' : 'Garantía vencida. Los repuestos y visitas tienen costo.'}</p>
      </div>
    </div>
    <div class="panel glass">
      <h3>¿Qué necesitás?</h3>
      <div class="acts">
        <button class="act" data-t="repuesto"><b>Reclamo de garantía</b><span>Le pedimos a la fábrica que envíe la pieza</span><em>${w.valid ? 'Recibís un número de caso' : 'Se cotiza'}</em></button>
        <button class="act" data-t="remoto"><b>Soporte remoto</b><span>Migración, calibración o capacitación</span><em>Desde USD 50</em></button>
        <button class="act" data-t="visita"><b>Visita técnica</b><span>Un técnico va a tu planta</span><em>Se cotiza según zona</em></button>
        <button class="act" data-t="insumo"><b>Pedir insumos</b><span>Tintas, cabezales, consumibles</span><em>Con tu lista de precios</em></button>
      </div>
    </div>
    <div class="panel glass">
      <h3>Historial y seguimiento</h3>
      <ul class="tl">${evs.map(v => {
        const T = TYPES[v.t], code = codeOf(v);
        return `<li style="--c:${T.c}">
          <div class="tl-h"><b>${esc(v.ti)}</b><span class="pill ${done(v) ? 'ok' : ''}">${esc(T.steps[v.s])}</span></div>
          <p class="sm">${T.n} · ${fmt(v.d)}${code ? ` · <span class="case mono">${esc(code)}</span>` : ''}${v.guia ? ` · <span class="mono">${esc(v.guia)}</span>` : ''}</p>
          ${tracker(v, T)}
          ${T.v && code ? `<button class="link" data-track="${esc(code)}">Ver en el radar</button>` : ''}
        </li>`;
      }).join('')}</ul>
    </div>`;
  }

  /* ---------- DIALOG ---------- */
  function openDlg(t) {
    dtype = t;
    const e = EQ.find(x => x.id === cur);
    $('#dt').textContent = TYPES[t].n;
    $('#dsub').textContent = e.m + ' · ' + e.s;
    $('#note').value = '';
    let o = '', x = '';
    if (t === 'remoto') {
      o = REM.map((r, k) => `<label class="opt"><input type="radio" name="o" value="${k}" ${k ? '' : 'checked'}><span><b>${esc(r.k)}</b><small>${esc(r.d)}</small></span><b class="mono">USD ${r.p}</b></label>`).join('');
      x = '<label class="f">Día y horario preferido<select id="slot"><option>Mañana, 10:00</option><option>Mañana, 15:00</option><option>Pasado mañana, 11:00</option></select></label>';
    }
    if (t === 'repuesto') x = '<label class="f">¿Qué pieza falló?<input id="part" placeholder="Ej.: cabezal de impresión" aria-describedby="partErr"></label><p class="f-err" id="partErr"></p><label class="f">Foto o video de la falla<input type="file" accept="image/*,video/*"></label>';
    if (t === 'visita') x = '<label class="f">Urgencia<select id="urg"><option>Esta semana</option><option>Este mes</option><option>Equipo detenido (urgente)</option></select></label>';
    if (t === 'insumo') x = '<label class="f">Insumos y cantidades<input id="part" placeholder="Ej.: Tinta UV cian ×2"></label>';
    $('#opts').innerHTML = o;
    $('#extra').innerHTML = x;
    upd();
    $('#dlg').showModal();
    window.__lenis?.stop();
    if (motion()) gsap.fromTo('#dlg', { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: .35, ease: 'power3.out', clearProps: 'all' });
  }

  function upd() {
    const r = document.querySelector('input[name=o]:checked');
    $('#tot').textContent = dtype === 'remoto' && r ? 'Total: USD ' + REM[r.value].p : dtype === 'repuesto' ? 'Sin costo si está en garantía' : 'Te enviamos cotización';
  }

  function submitDlg(ev) {
    ev.preventDefault();
    const r = document.querySelector('input[name=o]:checked'), p = $('#part'), T = TYPES[dtype];
    if (dtype === 'repuesto' && !p.value.trim()) { $('#partErr').textContent = 'Decinos qué pieza falló.'; p.focus(); return; }
    const note = $('#note').value.trim();
    const ti = dtype === 'remoto' ? REM[r.value].k : (p && p.value.trim()) || T.n;
    const e = addEvent({ eq: cur, t: dtype, ti, price: dtype === 'remoto' ? REM[r.value].p : 0, note, falla: note });
    $('#dlg').close();
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
    if (!box.children.length) box.innerHTML = vals.map(k => `<div class="kpi glass" data-k="${k[0]}"><b class="mono">0</b><span>${k[1]}</span></div>`).join('');
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
        <td><select data-id="${e.id}" data-k="s" ${aria('Estado')}>${T.steps.map((s, k) => `<option value="${k}" ${k === e.s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></td>
        <td><input data-id="${e.id}" data-k="tec" value="${esc(e.tec)}" ${aria('Técnico')}></td>
        <td><input class="num" type="number" min="0" data-id="${e.id}" data-k="cost" value="${e.cost}" ${aria('Costo en USD')}></td>
        <td><input class="num" type="number" min="0" data-id="${e.id}" data-k="price" value="${e.price}" ${aria('Precio en USD')}></td>
        <td class="mono mg">${margin(e)}</td>
        <td class="note-c"><input data-id="${e.id}" data-k="note" value="${esc(e.note)}" ${aria('Nota interna')}></td>
      </tr>`;
    }).join('');
  }

  /* ---------- FACTORY ---------- */
  function renderFab() {
    const cs = EV.filter(e => e.t === 'repuesto');
    $('#fabT').innerHTML = cs.length ? cs.slice().reverse().map(e => {
      const q = EQ.find(x => x.id === e.eq);
      const awbMissing = e.s >= 3 && !e.guia;
      return `<tr>
        <td><b class="case mono">${esc(e.caso)}</b><span class="sm">${fmt(e.d)}</span></td>
        <td>${esc(q.m)}<span class="sm">Serie ${esc(q.s)} · instalado ${fmt(q.inst)}</span></td>
        <td>${esc(e.ti)}<span class="sm">${esc(e.falla || '')}</span></td>
        <td><select data-id="${e.id}" data-k="s" aria-label="Estado del caso ${esc(e.caso)}">${TYPES.repuesto.steps.map((s, k) => `<option value="${k}" ${k === e.s ? 'selected' : ''}>${esc(s)}</option>`).join('')}</select></td>
        <td><input class="mono" data-id="${e.id}" data-k="guia" value="${esc(e.guia || '')}" placeholder="AWB 000-0000 0000" aria-label="Guía aérea del caso ${esc(e.caso)}">${awbMissing ? '<span class="sm warn">Falta la guía para este estado.</span>' : ''}</td>
      </tr>`;
    }).join('') : '<tr><td colspan="5">Sin casos abiertos.</td></tr>';
  }

  /* ---------- DATA MODEL ---------- */
  const ER_POS = {
    usuarios_y_roles: [110, 44], clientes: [330, 44], equipos: [550, 44], eventos_servicio: [790, 44],
    casos_garantia: [130, 176], servicios_remotos: [370, 176], visitas_tecnicas: [610, 176], pedidos_insumos: [860, 176],
    repuestos_solicitados: [130, 296],
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
    const items = [['plotter-8-cabezales', 'Plotter 8 cabezales'], ['dtg', 'DTG'], ['uv-hybrid', 'UV Hybrid'], ['dtf-uv-30', 'DTF UV 30'], ['plotter-2-cabezales', 'Plotter 2 cabezales'], ['dtf-h3070', 'DTF H3070'], ['a3-uv', 'A3 UV'], ['plotter-uv-32', 'Plotter UV 3,2 m']];
    const one = items.map(i => `<figure><img src="assets/equipos/fleet-${i[0]}.webp" alt="" loading="lazy"><figcaption class="mono">${i[1]}</figcaption></figure>`).join('');
    $('#fleet').innerHTML = one + one;
  }

  /* ---------- WIRING ---------- */
  function renderAll(src) {
    renderEqs(); renderDet();
    // Editing a row must not rebuild the table you are typing in, or keyboard focus would be lost
    if (src !== 'int') renderInt(); else renderKpis();
    if (src !== 'fab') renderFab();
  }

  function setView(id, focus) {
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
    if (motion()) gsap.fromTo(`#${id} > *`, { y: 14, autoAlpha: 0 }, { y: 0, autoAlpha: 1, duration: .4, stagger: .05, ease: 'power3.out', clearProps: 'transform,opacity,visibility' });
  }

  function init() {
    $('#eqs').addEventListener('click', e => { const b = e.target.closest('.eq'); if (b) { cur = b.dataset.id; renderEqs(); renderDet(); } });
    $('#det').addEventListener('click', e => {
      const a = e.target.closest('.act');
      if (a) { openDlg(a.dataset.t); return; }
      const t = e.target.closest('[data-track]');
      if (t) { Tracker.search(t.dataset.track, { deferPlay: true }); window.Cinema?.go('s4'); }
    });
    $('#opts').addEventListener('change', upd);
    $('#cx').addEventListener('click', () => $('#dlg').close());
    $('#dlg').addEventListener('close', () => window.__lenis?.start());
    $('#dlg').addEventListener('click', e => { if (e.target === e.currentTarget) e.currentTarget.close(); });
    $('#dlgF').addEventListener('submit', submitDlg);

    $('#tick').addEventListener('change', e => {
      const t = e.target; if (!t.dataset.id) return;
      const v = updateEvent(+t.dataset.id, t.dataset.k, t.value, 'int');
      const row = t.closest('tr');
      if (v && row) row.querySelector('.mg').textContent = margin(v);
      toast('Guardado. El cliente ya ve el cambio.');
    });
    $('#fabT').addEventListener('change', e => {
      const t = e.target; if (!t.dataset.id) return;
      updateEvent(+t.dataset.id, t.dataset.k, t.value.trim(), 'fab');
      renderFab();
      toast('Caso actualizado. El cliente ya ve el nuevo estado.');
    });

    const tabs = $('.cc-tabs');
    tabs.addEventListener('click', e => { const b = e.target.closest('[role=tab]'); if (b) setView(b.dataset.v); });
    tabs.addEventListener('keydown', e => {
      const list = $$('.cc-tabs [role=tab]'), i = list.indexOf(document.activeElement);
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

    renderAll(); renderDb(); fleet();
    on(renderAll);
  }

  return { init, toast };
})();
