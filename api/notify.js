/* POST /api/notify: real sending of the spare-part e-mails. Runs as a Vercel serverless function.

   Environment variables (never in the front end):
     RESEND_API_KEY  key of the mail provider
     MAIL_FROM       verified sender, e.g. "Ricser <avisos@tudominio.com>"
     MAIL_TO         recipient while this is a prototype
   Missing any of them, it answers { sent: false, demo: true } and nothing leaves.

   The recipient is deliberately not taken from the request: an open endpoint that mails any address would work as
   a spam relay for whoever finds it.
   TODO: when the portal has real sign-in, require the session here and look up the address from the client record. */
const { build } = require('../js/mail-template.js');

const FIELDS = ['caso', 'cliente', 'equipo', 'pieza', 'estado', 'awb', 'transportista', 'eta', 'seguimiento', 'motivo'];
const MAX = 300;

function clean(body) {
  const d = {};
  for (const k of FIELDS) {
    const v = body && body[k];
    if (v != null && (typeof v !== 'string' || v.length > MAX)) return null;
    d[k] = v || '';
  }
  d.etapa = Number(body.etapa);
  d.etapas = Number(body.etapas);
  if (!/^GAR-\d{4}-\d{4,}$/.test(d.caso) || !d.estado || !Number.isInteger(d.etapa) || !Number.isInteger(d.etapas)) return null;
  return d;
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  // Only this site's own pages may call it
  const origin = req.headers.origin;
  if (origin) {
    let host = '';
    try { host = new URL(origin).host; } catch { /* malformed origin: rejected below */ }
    if (host !== req.headers.host) return res.status(403).json({ error: 'Origen no permitido' });
  }
  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch { body = null; }
  }
  const data = body && clean(body);
  if (!data) return res.status(400).json({ error: 'Datos inválidos' });
  // The tracking link can only point back to this same site
  try {
    if (data.seguimiento && new URL(data.seguimiento).host !== req.headers.host) data.seguimiento = '';
  } catch { data.seguimiento = ''; }

  const { RESEND_API_KEY: key, MAIL_FROM: from, MAIL_TO: to } = process.env;
  if (!key || !from || !to) return res.status(200).json({ sent: false, demo: true });

  const mail = build(data);
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, to: [to], subject: mail.subject, html: mail.html, text: mail.text }),
    });
    if (!r.ok) return res.status(502).json({ sent: false, error: 'El proveedor de mail rechazó el envío' });
    const j = await r.json();
    return res.status(200).json({ sent: true, id: j.id });
  } catch {
    return res.status(502).json({ sent: false, error: 'No se pudo contactar al proveedor de mail' });
  }
};
