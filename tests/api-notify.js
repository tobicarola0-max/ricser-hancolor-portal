/* Checks api/notify.js without the network: the mail provider is replaced by a stub, so nothing is ever sent. */
const path = require('path');
const assert = require('assert');
const handler = require(path.join(__dirname, '..', 'api', 'notify.js'));

const HOST = 'ricser.example';
const run = req => new Promise(resolve => {
  const res = { code: 200, setHeader() {}, status(c) { this.code = c; return this; }, json(body) { resolve({ code: this.code, body }); } };
  handler({ headers: { host: HOST }, ...req }, res);
});
const good = { caso: 'GAR-2026-0042', cliente: 'Demo', equipo: 'DTF', pieza: 'Cabezal', estado: 'Despachada', etapa: 4, etapas: 6, awb: 'AWB 1', motivo: 's', seguimiento: `https://${HOST}/?caso=GAR-2026-0042` };

(async () => {
  delete process.env.RESEND_API_KEY; delete process.env.MAIL_FROM; delete process.env.MAIL_TO;
  assert.equal((await run({ method: 'GET' })).code, 405);
  assert.equal((await run({ method: 'POST', headers: { host: HOST, origin: 'https://otro.example' }, body: good })).code, 403);
  assert.equal((await run({ method: 'POST', body: { caso: 'x' } })).code, 400);
  assert.deepEqual((await run({ method: 'POST', body: good })).body, { sent: false, demo: true });

  process.env.RESEND_API_KEY = 'prueba'; process.env.MAIL_FROM = 'avisos@ricser.example'; process.env.MAIL_TO = 'demo@ricser.example';
  let sent = null;
  global.fetch = async (url, opts) => { sent = JSON.parse(opts.body); return { ok: true, json: async () => ({ id: 'abc' }) }; };
  const r = await run({ method: 'POST', body: { ...good, to: 'otro@otro.example', seguimiento: 'https://otro.example/' } });
  assert.equal(r.body.sent, true);
  assert.deepEqual(sent.to, ['demo@ricser.example'], 'el destinatario nunca sale del pedido');
  assert.ok(!sent.html.includes('otro.example'), 'un link a otro sitio se descarta');

  global.fetch = async () => ({ ok: false, json: async () => ({}) });
  assert.equal((await run({ method: 'POST', body: good })).code, 502);
  console.log('api/notify.js: todo ok');
})().catch(e => { console.error(e); process.exit(1); });
