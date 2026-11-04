/* Shared by the API functions: database, session and request helpers. Files under a leading underscore are not routes. */
const crypto = require('crypto');
const { neon } = require('@neondatabase/serverless');

let client = null;
const db = (text, params = []) => {
  if (!client) client = neon(process.env.DATABASE_URL);
  return client.query(text, params);
};

const ROLES = { tec: { n: 'Técnico', env: 'ACCESO_TECNICO' }, admin: { n: 'Administrador', env: 'ACCESO_ADMIN' }, fab: { n: 'Fábrica HanColor', env: 'ACCESO_FABRICA' } };
const COOKIE = 'ricser_sesion';
const SESION_S = 12 * 3600;

const activo = () => !!(process.env.DATABASE_URL && process.env.SESSION_SECRET && Object.values(ROLES).some(r => process.env[r.env]));
const hmac = text => crypto.createHmac('sha256', process.env.SESSION_SECRET).update(text).digest('base64url');

function firmar(rol) {
  const payload = Buffer.from(JSON.stringify({ r: rol, e: Math.floor(Date.now() / 1000) + SESION_S })).toString('base64url');
  return `${payload}.${hmac(payload)}`;
}

function rolDe(req) {
  if (!process.env.SESSION_SECRET) return null;
  const m = (req.headers.cookie || '').match(new RegExp(`(?:^|;\\s*)${COOKIE}=([^;]+)`));
  if (!m) return null;
  const [payload, firma] = m[1].split('.');
  if (!payload || !firma) return null;
  const a = Buffer.from(firma), b = Buffer.from(hmac(payload));
  if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
  try {
    const { r, e } = JSON.parse(Buffer.from(payload, 'base64url').toString());
    return ROLES[r] && e > Date.now() / 1000 ? r : null;
  } catch { return null; }
}

function ponerCookie(res, token, maxAge) {
  res.setHeader('Set-Cookie', `${COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAge}`);
}

function claveOk(rol, clave) {
  const real = ROLES[rol] && process.env[ROLES[rol].env];
  if (!real || typeof clave !== 'string') return false;
  const h = s => crypto.createHash('sha256').update(s).digest();
  return crypto.timingSafeEqual(h(clave), h(real));
}

// Anything that changes data must come from this site's own pages
function mismoOrigen(req) {
  try { return new URL(req.headers.origin).host === req.headers.host; } catch { return false; }
}

// A keyed hash: enough to count requests per visitor without storing anyone's address
function origen(req) {
  const ip = String(req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '').split(',')[0].trim();
  return hmac(`origen:${ip}`);
}

function cuerpo(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch { return {}; }
}

module.exports = { db, ROLES, activo, firmar, rolDe, ponerCookie, claveOk, mismoOrigen, origen, cuerpo, SESION_S };
