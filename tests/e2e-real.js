/* Service requests and internal access against a real database. It uses temporary passwords that exist only during
   the test, and deletes every row it creates. Needs DATABASE_URL in the environment, with the tables already created. */
const crypto = require('crypto');
const assert = require('assert');
const path = require('path');
const { chromium } = require(path.join(__dirname, 'node_modules', 'playwright-core'));

if (!process.env.DATABASE_URL) { console.error('Falta DATABASE_URL'); process.exit(1); }
const CLAVES = { tec: crypto.randomBytes(12).toString('hex'), admin: crypto.randomBytes(12).toString('hex'), fab: crypto.randomBytes(12).toString('hex') };
Object.assign(process.env, { SESSION_SECRET: crypto.randomBytes(32).toString('hex'), ACCESO_TECNICO: CLAVES.tec, ACCESO_ADMIN: CLAVES.admin, ACCESO_FABRICA: CLAVES.fab });

const { crear } = require('./servidor-local.js');
const { db } = require('../api/_lib/comun.js');

const PORT = 4174, BASE = `http://localhost:${PORT}`, MARCA = `PRUEBA-E2E-${Date.now()}`;
let pass = 0, fail = 0;
const ok = (c, m, extra) => { if (c) pass++; else { fail++; console.log('  FALLA', m, extra === undefined ? '' : JSON.stringify(extra)); } };

const limpiar = async () => {
  await db("DELETE FROM solicitudes WHERE nombre LIKE 'PRUEBA-E2E%'");
  await db('DELETE FROM intentos_acceso');
};
const api = (ruta, opts = {}) => fetch(BASE + ruta, { ...opts, headers: { 'Content-Type': 'application/json', ...(opts.headers || {}) } });
const mismo = { Origin: BASE };

(async () => {
  await limpiar();
  const server = crear();
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ channel: 'chrome', headless: true });
  try {
    console.log('== API sin sesión');
    let r = await api('/api/solicitudes');
    ok(r.status === 401, 'sin clave no se leen las solicitudes', r.status);
    r = await api('/api/solicitudes', { method: 'PATCH', headers: mismo, body: JSON.stringify({ id: 1, estado: 'cerrada' }) });
    ok(r.status === 401, 'sin clave no se modifican', r.status);
    r = await api('/api/solicitudes', { method: 'POST', headers: { Origin: 'https://otro.example' }, body: JSON.stringify({ equipo: 'x', nombre: 'y', telefono: '1155550100', detalle: 'z' }) });
    ok(r.status === 403, 'otro sitio no puede enviar', r.status);
    r = await api('/api/solicitudes', { method: 'POST', headers: mismo, body: JSON.stringify({ equipo: 'x', nombre: `${MARCA}`, telefono: '12', detalle: 'z' }) });
    ok(r.status === 400, 'valida el teléfono en el servidor', r.status);
    r = await api('/api/solicitudes', { method: 'POST', headers: mismo, body: JSON.stringify({ equipo: 'x', nombre: `${MARCA}-bot`, telefono: '1155550100', detalle: 'z', web: 'spam' }) });
    ok(r.status === 200 && (await db('SELECT count(*)::int n FROM solicitudes WHERE nombre = $1', [`${MARCA}-bot`]))[0].n === 0, 'el campo trampa no guarda nada');
    r = await api('/api/acceso', { method: 'POST', headers: mismo, body: JSON.stringify({ rol: 'tec', clave: 'mal' }) });
    ok(r.status === 401, 'clave incorrecta rechazada', r.status);
    r = await api('/api/acceso', { method: 'POST', headers: { Origin: 'https://otro.example' }, body: JSON.stringify({ rol: 'tec', clave: CLAVES.tec }) });
    ok(r.status === 403, 'otro sitio no puede iniciar sesión', r.status);
    const falsa = `${Buffer.from(JSON.stringify({ r: 'admin', e: 9999999999 })).toString('base64url')}.falsa`;
    r = await api('/api/solicitudes', { headers: { Cookie: `ricser_sesion=${falsa}` } });
    ok(r.status === 401, 'una sesión falsificada no entra', r.status);
    r = await api('/api/acceso', { method: 'POST', headers: mismo, body: JSON.stringify({ rol: 'fab', clave: CLAVES.fab }) });
    const cookie = r.headers.get('set-cookie') || '';
    ok(/HttpOnly/.test(cookie) && /Secure/.test(cookie) && /SameSite=Strict/.test(cookie), 'cookie protegida', cookie.replace(/=[^;]+/, '=…'));
    r = await api('/api/solicitudes', { headers: { Cookie: cookie.split(';')[0] } });
    ok(r.status === 403, 'fábrica no lee las solicitudes', r.status);
    for (let i = 0; i < 9; i++) r = await api('/api/acceso', { method: 'POST', headers: mismo, body: JSON.stringify({ rol: 'tec', clave: 'mal' }) });
    ok(r.status === 429, 'frena los intentos repetidos', r.status);
    await db('DELETE FROM intentos_acceso');

    for (const [w, h] of [[1440, 900], [390, 844]]) {
      console.log(`== flujo real ${w}x${h}`);
      const nombre = `${MARCA}-${w}`, mobile = w < 800;
      // The client, on one device
      const ctxC = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
      const c = await ctxC.newPage();
      const errs = [], pedidos = [];
      c.on('pageerror', e => errs.push(e.message));
      c.on('request', q => { if (q.url().includes('/api/')) pedidos.push(`${q.method()} ${new URL(q.url()).pathname}`); });
      await c.goto(`${BASE}/index.html?api=1`, { waitUntil: 'load' });
      await c.waitForTimeout(5500);
      await c.locator('#stOpen').click(); await c.waitForTimeout(450);
      ok(await c.locator('#stDemo').isHidden(), 'no dice demostración');
      await c.locator('#stEq').selectOption('dtf-uv-60'); await c.waitForTimeout(500);
      await c.locator('#stName').fill(nombre);
      await c.locator('#stTel').fill('223 555 0199');
      await c.locator('#stMsg').fill('<img src=x onerror=alert(1)> No toma el film.');
      await c.locator('#stF button[type=submit]').click(); await c.waitForTimeout(1800);
      const code = await c.locator('#stCode').innerText();
      ok(/^ST-\d{4}-\d{4,}$/.test(code), 'recibe el número de la base', code);
      ok(pedidos.includes('POST /api/solicitudes'), 'el formulario llama a la API');
      ok(!(await c.evaluate(() => JSON.stringify(localStorage))).includes(nombre), 'no queda nada en el navegador del cliente');
      await ctxC.close();

      // The person on duty, on another device: another browser context, nothing shared
      const ctxT = await browser.newContext({ viewport: { width: w, height: h }, hasTouch: mobile, isMobile: mobile });
      const t = await ctxT.newPage();
      t.on('pageerror', e => errs.push(e.message));
      let dialogo = false;
      t.on('dialog', d => { dialogo = true; d.dismiss(); });
      await t.goto(`${BASE}/index.html?api=1#portal`, { waitUntil: 'load' });
      await t.waitForTimeout(3500);
      await t.locator('#rolBtn').click(); await t.waitForTimeout(400);
      ok(await t.locator('#rolClave').isVisible() && await t.locator('#rolAviso').isHidden(), 'pide clave');
      await t.locator('#rolSel').selectOption('tec');
      await t.locator('#rolClave').fill('mal');
      await t.locator('#rolF button[type=submit]').click(); await t.waitForTimeout(1200);
      ok((await t.locator('#rolErr').innerText()).includes('no es correcta') && await t.locator('#tab-sol').isHidden(), 'clave incorrecta no entra');
      await t.locator('#rolClave').fill(CLAVES.tec);
      await t.locator('#rolF button[type=submit]').click(); await t.waitForTimeout(2200);
      ok(await t.locator('#sol').isVisible(), 'el técnico entra');
      const card = () => t.locator('.st-card', { hasText: nombre });
      ok(await card().count() === 1, 'la solicitud llegó de otro dispositivo');
      ok((await card().innerText()).includes('<img src=x') && !dialogo, 'el texto no se interpreta como código');
      ok(await card().locator('.st-tel').getAttribute('href') === 'tel:2235550199', 'el teléfono se puede llamar');
      await card().locator('[data-tomar]').click(); await t.waitForTimeout(1500);
      ok(/tomada por/i.test(await card().innerText()) && /técnico/i.test(await card().innerText()), 'queda quién la tomó');
      await card().locator('[data-nota]').fill('Llamar a las 10.');
      await card().locator('[data-nota]').blur(); await t.waitForTimeout(1200);
      // Reloading keeps the session and the data comes back from the database
      await t.reload({ waitUntil: 'load' }); await t.waitForTimeout(3500);
      ok(await t.locator('#tab-sol').isVisible(), 'la sesión sigue al recargar');
      await t.locator('#tab-sol').click(); await t.waitForTimeout(1500);
      await t.locator('#solF [data-f="contacto"]').click(); await t.waitForTimeout(300);
      ok(await card().locator('[data-nota]').inputValue() === 'Llamar a las 10.', 'la nota quedó guardada');
      await card().locator('[data-cerrar]').click(); await t.waitForTimeout(1500);
      await t.locator('#solF [data-f="cerrada"]').click(); await t.waitForTimeout(300);
      ok(await card().count() === 1, 'queda resuelta');
      ok(!(await t.evaluate(() => JSON.stringify(localStorage))).includes(nombre), 'no queda nada en el navegador del técnico');
      await t.locator('#rolBtn').click(); await t.waitForTimeout(900);
      ok(await t.evaluate(() => Ricser.solicitudes.length) === 0, 'al salir se borra de la memoria');
      r = await t.evaluate(() => fetch('/api/solicitudes').then(x => x.status));
      ok(r === 401, 'al salir se cierra la sesión', r);
      ok(errs.length === 0, 'sin errores de script', errs);
      await ctxT.close();
    }

    console.log('== límite de envíos');
    await db("DELETE FROM solicitudes WHERE nombre LIKE 'PRUEBA-E2E%'");
    const uno = i => api('/api/solicitudes', { method: 'POST', headers: mismo, body: JSON.stringify({ equipo: 'x', nombre: `${MARCA}-l${i}`, telefono: '1155550100', detalle: 'z' }) });
    let last;
    for (let i = 0; i < 6; i++) last = await uno(i);
    ok(last.status === 429, 'frena los envíos repetidos', last.status);
  } finally {
    await browser.close();
    await limpiar();
    server.close();
    const quedan = (await db("SELECT count(*)::int n FROM solicitudes WHERE nombre LIKE 'PRUEBA-E2E%'"))[0].n;
    assert.equal(quedan, 0, 'quedaron filas de prueba');
  }
  console.log(`\nTOTAL REAL: ${pass} ok, ${fail} con falla (filas de prueba borradas)`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e.message); process.exit(1); });
