/* /api/acceso: internal sign-in by role.
   GET    tells the page whether the real system is on, and who is signed in
   POST   { rol, clave } signs in and sets an HttpOnly cookie
   DELETE signs out
   Passwords live in environment variables (ACCESO_TECNICO, ACCESO_ADMIN, ACCESO_FABRICA), never in the front end. */
const { db, ROLES, activo, firmar, rolDe, ponerCookie, claveOk, mismoOrigen, origen, cuerpo, SESION_S } = require('./_lib/comun.js');

const MAX_INTENTOS = 8;

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'GET') return res.status(200).json({ activo: activo(), rol: rolDe(req) });
  if (!['POST', 'DELETE'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, DELETE');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (!mismoOrigen(req)) return res.status(403).json({ error: 'Origen no permitido' });
  if (req.method === 'DELETE') {
    ponerCookie(res, '', 0);
    return res.status(200).json({ rol: null });
  }
  if (!activo()) return res.status(503).json({ error: 'El acceso todavía no está configurado.' });

  const { rol, clave } = cuerpo(req);
  try {
    const quien = origen(req);
    const [{ n }] = await db("SELECT count(*)::int AS n FROM intentos_acceso WHERE origen = $1 AND creado_el > now() - interval '15 minutes'", [quien]);
    if (n >= MAX_INTENTOS) return res.status(429).json({ error: 'Demasiados intentos. Probá de nuevo en 15 minutos.' });
    if (!ROLES[rol] || !claveOk(rol, clave)) {
      await db('INSERT INTO intentos_acceso (origen) VALUES ($1)', [quien]);
      await db("DELETE FROM intentos_acceso WHERE creado_el < now() - interval '1 day'");
      return res.status(401).json({ error: 'La clave no es correcta.' });
    }
    await db('DELETE FROM intentos_acceso WHERE origen = $1', [quien]);
    ponerCookie(res, firmar(rol), SESION_S);
    return res.status(200).json({ rol });
  } catch (e) {
    console.error('acceso:', e.message);
    return res.status(503).json({ error: 'No pudimos validar el acceso. Probá de nuevo en unos minutos.' });
  }
};
