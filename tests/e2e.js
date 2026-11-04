/* End-to-end checks in real Chrome. See tests/README.md.
   BASE: site to test (default http://localhost:4173/). TEST_VIDEO: path to a real video, to also check playback. */
const { chromium } = require('playwright-core');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE = process.env.BASE || 'http://localhost:4173/';
const VIDEO = process.env.TEST_VIDEO;
const ROOT = path.join(__dirname, '..');
const SIZES = [[1440, 900], [1024, 768], [390, 844]];
const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
const SAMPLE = VIDEO || { name: 'diagnostico.webm', mimeType: 'video/webm', buffer: Buffer.from('prueba') };

let pass = 0, fail = 0;
const ok = (cond, label, extra) => {
  if (cond) pass++;
  else { fail++; console.log('  FALLA', label, extra === undefined ? '' : JSON.stringify(extra)); }
};
const section = t => console.log(`\n== ${t}`);

async function open(browser, w, h, url = '', extra = {}) {
  const mobile = w < 800;
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
  const page = await ctx.newPage();
  const errs = [];
  page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text()}`); });
  page.on('pageerror', e => errs.push(`pageerror: ${e.message}`));
  page.on('response', r => { if (r.status() >= 400) errs.push(`http ${r.status()}: ${r.url()}`); });
  // Only where it is read: init scripts also run in the sandboxed mail preview, which correctly blocks them
  if (extra.cls) await page.addInitScript(() => {
    window.__cls = 0;
    new PerformanceObserver(l => { for (const e of l.getEntries()) if (!e.hadRecentInput) window.__cls += e.value; }).observe({ type: 'layout-shift', buffered: true });
  });
  await page.goto(new URL(url, BASE).href, { waitUntil: 'load' });
  return { ctx, page, errs };
}
const noOverflow = page => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth);
const scrollTo = async (page, t) => {
  await page.evaluate(v => window.__lenis.scrollTo(v === 'portal' ? '#portal' : Number(v) * innerHeight, { immediate: true, force: true, offset: v === 'portal' ? -70 : 0 }), t);
  await page.waitForTimeout(1700);
};

function syntax() {
  section('sintaxis');
  const files = [...fs.readdirSync(path.join(ROOT, 'js')).map(f => path.join('js', f)), ...fs.readdirSync(path.join(ROOT, 'api')).map(f => path.join('api', f))];
  for (const f of files) {
    try { execFileSync(process.execPath, ['--check', path.join(ROOT, f)], { stdio: 'pipe' }); ok(true, f); } catch { ok(false, `node --check ${f}`); }
  }
  console.log(`  ${files.length} archivos`);
}

async function scenes(browser, w, h) {
  section(`escenas y header ${w}x${h}`);
  const { ctx, page, errs } = await open(browser, w, h, '', { cls: true });
  await page.waitForTimeout(5000);
  ok(await page.evaluate(() => window.__cls) <= .1, 'CLS de 0,1 o menos', await page.evaluate(() => window.__cls));
  const hud = () => page.evaluate(() => [document.querySelector('#hudN').textContent, document.querySelector('#hudName').textContent]);
  for (const [t, n, name, quick] of [[.3, '01', 'THE AWAKENING', true], [2.5, '02', 'INFORMACIÓN TÉCNICA', true], [5.7, '03', 'INSTITUCIONAL', true], [8, '04', 'SEGUIMIENTO', false], [9.5, '05', 'PORTAL DEL CLIENTE', false]]) {
    await scrollTo(page, t);
    const r = await hud();
    ok(r[0] === n && r[1] === name, `escena ${n} se llama ${name}`, r);
    ok(await page.locator('#quickIn').isVisible() === quick, `rastreo ${quick ? 'visible' : 'oculto'} en escena ${n}`);
    ok(await noOverflow(page), `sin overflow en escena ${n}`);
  }
  ok(!/Telemetr|Command Center|COMMAND|Anatom|ANATOM|Núcleo/.test(await page.evaluate(() => document.body.textContent)), 'no quedan nombres viejos');
  await scrollTo(page, .3);
  ok(await page.locator('.hud-a').count() === 0, 'sin bloque de telemetría');
  const input = await page.locator('#quickIn').evaluate(el => [el.offsetHeight, getComputedStyle(el).fontSize]);
  ok(input[0] >= 48, 'campo de 48 px o más', input);
  ok(await page.locator('#quickTrk button').getAttribute('aria-label') === 'Rastrear caso', 'botón con aria-label');
  if (w >= 800) {
    ok(input[1] === '18px', 'letra de 18 px', input);
    const fits = await page.locator('#quickIn').evaluate(el => { el.value = 'GAR-2026-0042'; const f = el.scrollWidth <= el.clientWidth; el.value = ''; return f; });
    ok(fits, 'el código entra completo en el campo');
    ok(Math.round((await page.locator('.brand img').boundingBox()).height) === 45, 'logo de 45 px');
  }
  await page.locator('#quickIn').focus();
  ok(await page.locator('.quick-r').evaluate(el => getComputedStyle(el).animationName) === 'pulse', 'pulso al hacer foco');
  await page.locator('#quickTrk button').click(); await page.waitForTimeout(150);
  ok((await page.locator('#quickMsg').innerText()).includes('Ingresá'), 'rastreo vacío avisa sin moverse');
  await page.locator('#quickIn').fill('NOEXISTE'); await page.locator('#quickIn').press('Enter'); await page.waitForTimeout(150);
  ok((await page.locator('#quickMsg').innerText()).includes('No encontramos'), 'código inexistente avisa sin moverse');
  await page.locator('#quickIn').fill('GAR-2026-0042'); await page.locator('#quickIn').press('Enter');
  await page.waitForTimeout(4200);
  ok((await hud())[0] === '04', 'código válido va a Seguimiento');
  ok(errs.length === 0, 'consola limpia', [...new Set(errs)]);
  await ctx.close();
}

async function carousel(browser) {
  section('carrusel');
  const { ctx, page, errs } = await open(browser, 1440, 900);
  await page.waitForTimeout(5000);
  await scrollTo(page, 2.5);
  await page.waitForTimeout(1000);
  const ids = await page.$$eval('.car-i', b => b.map(x => x.dataset.id));
  ok(ids.length === await page.evaluate(() => Ricser.EQUIPOS.length), 'todos los equipos están en el carrusel', ids.length);
  ok(await page.locator('#carTrack').evaluate(el => getComputedStyle(el).scrollSnapType.includes('mandatory')), 'snap obligatorio');
  for (const id of ids) {
    const item = page.locator(`.car-i[data-id="${id}"]`);
    await item.scrollIntoViewIfNeeded();
    await item.click();
    await page.waitForTimeout(600);
    const r = await page.evaluate(i => {
      const b = document.querySelector(`.car-i[data-id="${i}"]`), im = document.querySelector('.fi-view:last-child img');
      return { p: b.getAttribute('aria-pressed'), c: b.getAttribute('aria-current'), a: Ricser.equipoActivo().id, img: im.complete && im.naturalWidth > 0, v: document.querySelectorAll('.fi-view').length };
    }, id);
    ok(r.p === 'true' && r.c === 'true' && r.a === id && r.img && r.v === 1, `modelo ${id}`, r);
  }
  await page.locator('.car-i[aria-current="true"]').focus();
  await page.keyboard.press('Home'); await page.waitForTimeout(600);
  ok(await page.evaluate(() => Ricser.equipoActivo().id) === ids[0], 'tecla Inicio');
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(500);
  ok(await page.evaluate(() => Ricser.equipoActivo().id) === ids[1], 'flecha derecha');
  await page.keyboard.press('ArrowLeft'); await page.waitForTimeout(600);
  await page.locator('#carNext').click(); await page.waitForTimeout(800);
  ok(await page.locator('#carTrack').evaluate(el => el.scrollLeft) > 0, 'flecha en pantalla mueve el carrusel');
  await page.locator('.fi-tabs [data-view="2"]').click(); await page.waitForTimeout(1300);
  ok(await page.locator('.fi-tx').count() === 3, 'pestaña Medidas con 3 cotas');
  const box = await page.locator('#carTrack').boundingBox();
  await page.mouse.move(box.x + 300, box.y + 40);
  const y0 = await page.evaluate(() => scrollY);
  for (let i = 0; i < 4; i++) { await page.mouse.wheel(0, 120); await page.waitForTimeout(120); }
  await page.waitForTimeout(500);
  ok(await page.evaluate(() => scrollY) > y0, 'la ruedita sobre el carrusel baja la página');
  ok(errs.length === 0, 'consola limpia', [...new Set(errs)]);
  await ctx.close();
}

async function factory(browser, w, h) {
  section(`caso en Fábrica ${w}x${h}`);
  const { ctx, page, errs } = await open(browser, w, h, 'index.html#portal');
  await page.waitForTimeout(3500);
  await page.locator('#tab-fab').click(); await page.waitForTimeout(500);
  ok(await page.locator('#mailsBtn').isHidden(), 'en Fábrica no aparece el botón de mails');
  const card = page.locator('.fc', { hasText: 'GAR-2026-0043' }), head = card.locator('.fc-h');
  await head.click();
  const hs = [];
  for (let i = 0; i < 8; i++) { hs.push(Math.round((await card.locator('.fc-p').boundingBox() || { height: 0 }).height)); await page.waitForTimeout(40); }
  await page.waitForTimeout(600);
  ok(new Set(hs).size >= 3, 'la altura se anima', hs);
  ok(await head.getAttribute('aria-expanded') === 'true' && await card.getByText('Así lo ve la fábrica').isVisible(), 'abre el panel');
  ok(!(await card.innerText()).includes('Gráfica Del Plata'), 'la fábrica no ve al cliente');
  await card.locator('[data-stage="1"]').click({ force: true });
  ok((await card.locator('[data-err="pz"]').innerText()).includes('Primero'), 'la pieza no avanza sin enviar a fábrica');
  await card.locator('[data-send]').click();
  ok(await card.locator('[data-obs]').getAttribute('aria-invalid') === 'true', 'observación obligatoria');
  await card.locator('[data-obs]').fill('La bomba pierde presión a los 10 minutos.');
  await card.locator('[data-send]').click();
  ok(await card.locator('.fc-h').getByText('Enviado a fábrica').isVisible(), 'pasa a Enviado a fábrica');
  await card.locator('[data-up]').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }); await page.waitForTimeout(150);
  ok((await card.locator('[data-err="ev"]').innerText()).includes('Solo se aceptan'), 'rechaza otros archivos');
  ok(/máximo es 200 MB/.test(await page.evaluate(() => Ricser.checkFile({ type: 'video/mp4', size: 250 * 1048576, name: 'x.mp4' }))), 'límite de tamaño');
  await card.locator('[data-up]').setInputFiles(SAMPLE); await page.waitForTimeout(800);
  ok(await card.locator('.ev-view video').count() === 1, 'carga el video');
  if (VIDEO) {
    const v = await card.locator('.ev-view video').evaluate(async el => { await el.play(); await new Promise(r => setTimeout(r, 500)); el.pause(); return { w: el.videoWidth, t: el.currentTime, e: el.error && el.error.message }; });
    ok(v.w > 0 && v.t > 0 && !v.e, 'el video se reproduce', v);
  }
  const ta = card.locator('.ch-f textarea');
  await ta.fill('Probamos con otra manguera.'); await ta.press('Enter'); await page.waitForTimeout(200);
  ok(await card.locator('.ch-m').count() === 1 && await ta.inputValue() === '', 'Enter envía');
  await card.locator('[data-rol]').selectOption('fab');
  await card.locator('[data-att]').setInputFiles({ name: 'foto.png', mimeType: 'image/png', buffer: PNG });
  await ta.fill('Mandá una foto.');
  await card.locator('.ch-f button[type=submit]').click(); await page.waitForTimeout(300);
  const last = await card.locator('.ch-m').last().innerText();
  ok(last.includes('HanColor') && last.includes('Fábrica') && await card.locator('.ch-m').last().locator('time, img').count() === 2, 'autor, rol, hora y adjunto', last);
  const th = await card.locator('.ch-th').evaluate(el => [el.scrollTop + el.clientHeight, el.scrollHeight, el.getAttribute('aria-live')]);
  ok(th[0] >= th[1] - 2 && th[2] === 'polite', 'scroll al último y aria-live', th);
  await card.locator('[data-stage="1"]').click(); await page.waitForTimeout(300);
  ok(await page.locator('#toast').innerText() === 'Mail enviado a Gráfica Del Plata', 'toast del mail');
  ok(await page.evaluate(() => Notifier.outbox.length === 1 && Ricser.outbox === Notifier.outbox), 'el mail entra en la bandeja');
  await card.locator('[data-k="guia"]').fill('AWB 999-1111 2222'); await card.locator('[data-k="guia"]').blur();
  await card.locator('[data-k="carrier"]').fill('Courier demo'); await card.locator('[data-k="carrier"]').blur();
  await card.locator('[data-k="eta"]').fill('2026-12-01'); await card.locator('[data-k="eta"]').blur();
  await card.locator('[data-stage="3"]').click(); await page.waitForTimeout(200);
  ok(await page.evaluate(() => Notifier.outbox.length) === 4, 'guía, ETA y etapa avisan; transportista no');
  const cp = await page.evaluate(() => { Tracker.search('GAR-2026-0043'); return document.querySelector('#cockpit').textContent; });
  ok(['Despachada', 'AWB 999-1111 2222', 'Courier demo'].every(x => cp.includes(x)), 'Seguimiento actualizado');
  // Inbox from the case, then back to where you were
  await card.locator('[data-inbox]').click(); await page.waitForTimeout(500);
  ok(await page.evaluate(() => document.querySelector('#mailDlg').matches(':modal')), 'el link abre el modal de mails');
  const html = await page.locator('#mbPrev').getAttribute('srcdoc');
  ok(html.includes('GAR-2026-0043') && html.includes('AWB 999-1111 2222') && html.includes('?caso=GAR-2026-0043'), 'plantilla con caso, guía y link');
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok(!(await page.locator('#mailDlg').isVisible()), 'Esc cierra el modal');
  await head.focus(); await page.keyboard.press('Enter'); await page.waitForTimeout(600);
  ok(await card.locator('.fc-p').isHidden(), 'cierra con teclado');
  ok(await noOverflow(page), 'sin overflow');
  ok(errs.length === 0, 'consola limpia', [...new Set(errs)]);
  await ctx.close();
}

async function client(browser, w, h) {
  section(`reclamo en Portal del cliente ${w}x${h}`);
  const { ctx, page, errs } = await open(browser, w, h, 'index.html#portal');
  await page.waitForTimeout(3500);
  await page.locator('.eq[data-id="e2"]').click(); await page.waitForTimeout(300);
  const row = page.locator('.case-row', { hasText: 'GAR-2026-0042' });
  ok(await row.getAttribute('aria-expanded') === 'false', 'la fila arranca cerrada');
  ok(await page.locator('#det .case-row').count() === 1, 'solo los reclamos se despliegan');
  await row.click(); await page.waitForTimeout(600);
  const d = page.locator('#cd-5');
  ok(await row.getAttribute('aria-expanded') === 'true' && await d.isVisible(), 'abre el detalle');
  const txt = await d.innerText();
  ok(['Cabezal de impresión', 'AWB 176-4410 2290', 'Courier aéreo', 'Despachada'].every(x => txt.includes(x)), 'etapa, guía y llegada', txt.slice(0, 120));
  ok(!txt.includes('Aprobamos el reemplazo') && !txt.includes('Los otros cabezales') && !(await d.locator('[data-stage], textarea').count()), 'sin chat, observación ni edición de etapas');
  ok(await d.locator('li').first().evaluate(el => getComputedStyle(el, '::before').content) === 'none', 'las listas del detalle no heredan las viñetas del historial');
  await d.locator('[data-cup]').setInputFiles({ name: 'nota.txt', mimeType: 'text/plain', buffer: Buffer.from('hola') }); await page.waitForTimeout(150);
  ok((await d.locator('[data-cerr]').innerText()).includes('Solo se aceptan'), 'valida el archivo');
  await d.locator('[data-cup]').setInputFiles(SAMPLE); await page.waitForTimeout(800);
  ok(await page.locator('#cd-5').isVisible() && await page.locator('#cd-5 .ev-view video').count() === 1, 'carga el video y sigue abierto');
  if (VIDEO) {
    const v = await page.locator('#cd-5 .ev-view video').evaluate(async el => { await el.play(); await new Promise(r => setTimeout(r, 500)); el.pause(); return { w: el.videoWidth, t: el.currentTime }; });
    ok(v.w > 0 && v.t > 0, 'el video se reproduce', v);
  }
  await page.locator('#tab-fab').click(); await page.waitForTimeout(400);
  const c42 = page.locator('.fc', { hasText: 'GAR-2026-0042' });
  await c42.locator('.fc-h').click(); await page.waitForTimeout(700);
  ok((await c42.locator('.ev-box').innerText()).includes('Cliente'), 'la fábrica ve el video del cliente');
  await c42.locator('[data-stage="4"]').click(); await page.waitForTimeout(250);
  await page.locator('#tab-cli').click(); await page.waitForTimeout(400);
  ok((await page.locator('#cd-5 .pz-tl .n').innerText()).includes('En aduana'), 'la etapa se actualiza en la vista del cliente');
  // Modal from the bar
  ok((await page.locator('#mailsN').innerText()) === '1', 'el botón cuenta los mails');
  await page.locator('#mailsBtn').click(); await page.waitForTimeout(450);
  ok(await page.evaluate(() => document.querySelector('#mailDlg').matches(':modal')) && await page.locator('#mbList .mb-i').count() === 1, 'el modal lista los mails');
  ok(await page.locator('#mbMode').innerText() === 'Modo demo', 'modo demo');
  await page.locator('#mbClose').click(); await page.waitForTimeout(250);
  ok(!(await page.locator('#mailDlg').isVisible()), 'Cerrar funciona');
  // Claim dialog: Esc, Cancel, and the file travels with the case
  for (const how of ['Esc', 'Cancelar']) {
    await page.locator('.act[data-t="visita"]').click(); await page.waitForTimeout(450);
    ok(await page.evaluate(() => document.querySelector('#dlg').matches(':modal')), `diálogo modal (${how})`);
    if (how === 'Esc') await page.keyboard.press('Escape'); else await page.locator('#cx').click();
    await page.waitForTimeout(250);
    ok(!(await page.locator('#dlg').isVisible()), `diálogo cierra con ${how}`);
  }
  await page.locator('.act[data-t="repuesto"]').click(); await page.waitForTimeout(400);
  await page.locator('#part').fill('Sensor de altura');
  await page.locator('#partFile').setInputFiles({ name: 'falla.png', mimeType: 'image/png', buffer: PNG });
  await page.locator('#ok').click(); await page.waitForTimeout(500);
  ok(await page.evaluate(() => { const e = Ricser.EV.find(x => x.caso === 'GAR-2026-0044'); return e && e.fab.evidencia.length === 1 && e.fab.evidencia[0].por === 'Cliente'; }), 'la foto del reclamo queda en el caso');
  ok(await noOverflow(page), 'sin overflow');
  ok(errs.length === 0, 'consola limpia', [...new Set(errs)]);
  await ctx.close();
}

async function fallback(browser) {
  section('link del mail');
  {
    const { ctx, page, errs } = await open(browser, 1440, 900, 'index.html?caso=GAR-2026-0042');
    await page.waitForTimeout(4000);
    ok(await page.evaluate(() => document.querySelector('#hudN').textContent) === '04', 'abre en Seguimiento');
    ok((await page.locator('#cockpit').innerText()).includes('GAR-2026-0042'), 'con ese caso');
    ok(errs.length === 0, 'consola limpia', [...new Set(errs)]);
    await ctx.close();
  }
  for (const [label, extra, block] of [['movimiento reducido', { reducedMotion: 'reduce' }, false], ['sin CDN', {}, true]]) {
    section(label);
    const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, ...extra });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    if (block) await page.route(/jsdelivr/, r => r.abort());
    await page.goto(new URL('index.html', BASE).href, { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(await page.evaluate(() => document.documentElement.classList.contains('static')), 'modo estático');
    await page.locator('#carTrack').scrollIntoViewIfNeeded();
    await page.locator('.car-i').nth(2).click(); await page.waitForTimeout(300);
    ok(await page.evaluate(() => Ricser.equipoActivo().id) === await page.locator('.car-i').nth(2).getAttribute('data-id'), 'carrusel');
    await page.locator('#tab-fab').scrollIntoViewIfNeeded();
    await page.locator('#tab-fab').click();
    await page.locator('.fc').first().locator('.fc-h').click(); await page.waitForTimeout(200);
    ok(await page.locator('.fc').first().locator('.fc-in').isVisible(), 'caso de Fábrica');
    await page.locator('#tab-cli').click();
    const row = page.locator('#det .case-row').first();
    if (await row.count()) { await row.click(); await page.waitForTimeout(200); ok(await page.locator('#det .case-detail').first().isVisible(), 'reclamo del cliente'); }
    ok(errs.length === 0, 'sin errores de script', errs);
    await ctx.close();
  }
}

(async () => {
  console.log(`Probando ${BASE}${VIDEO ? '' : ' (sin TEST_VIDEO no se comprueba la reproducción)'}`);
  syntax();
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  for (const [w, h] of SIZES) await scenes(browser, w, h);
  await carousel(browser);
  for (const [w, h] of SIZES) await factory(browser, w, h);
  for (const [w, h] of SIZES) await client(browser, w, h);
  await fallback(browser);
  await browser.close();
  console.log(`\nTOTAL: ${pass} ok, ${fail} con falla`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
