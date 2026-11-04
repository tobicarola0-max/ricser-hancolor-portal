/* /api/solicitudes: technical service requests.
   POST  public: the form on the start of the site. It answers with the request number and nothing else
   GET   technicians and administrators: the list, with names and phones
   PATCH technicians and administrators: { id, estado?, nota? } */
const { db, ROLES, activo, rolDe, mismoOrigen, origen, cuerpo } = require('./_lib/comun.js');

const POR_ORIGEN = 5; // per 10 minutes
const POR_HORA = 100; // for the whole site
const ESTADOS = ['nueva', 'contacto', 'cerrada'];

const texto = (v, max) => (typeof v === 'string' ? v.trim().slice(0, max) : '');
const fila = r => ({
  id: Number(r.id),
  code: `ST-${new Date(r.creada_el).getFullYear()}-${String(r.id).padStart(4, '0')}`,
  at: new Date(r.creada_el).toISOString(),
  equipo: r.equipo, nombre: r.nombre, telefono: r.telefono, detalle: r.detalle, estado: r.estado,
  tomadaPor: r.tomada_por || undefined,
  tomadaEl: r.tomada_el ? new Date(r.tomada_el).toISOString() : undefined,
  nota: r.nota,
});
const CAMPOS = 'id, creada_el, equipo, nombre, telefono, detalle, estado, tomada_por, tomada_el, nota';

async function crear(req, res) {
  if (!mismoOrigen(req)) return res.status(403).json({ error: 'Origen no permitido' });
  const b = cuerpo(req);
  // The hidden field only gets filled by bots: they get an answer, but nothing is saved
  if (b.web) return res.status(200).json({ code: 'ST-0000' });
  const equipo = texto(b.equipo, 120), nombre = texto(b.nombre, 120), telefono = texto(b.telefono, 40), detalle = texto(b.detalle, 2000);
  if (!equipo || !nombre || !detalle || telefono.replace(/\D/g, '').length < 8) return res.status(400).json({ error: 'Revisá los datos: faltan campos o el teléfono no es válido.' });
  const quien = origen(req);
  const [{ propias, total }] = await db(`SELECT
    count(*) FILTER (WHERE origen = $1 AND creada_el > now() - interval '10 minutes')::int AS propias,
    count(*) FILTER (WHERE creada_el > now() - interval '1 hour')::int AS total
    FROM solicitudes`, [quien]);
  if (propias >= POR_ORIGEN || total >= POR_HORA) return res.status(429).json({ error: 'Recibimos muchas solicitudes seguidas. Probá de nuevo en unos minutos.' });
  const [r] = await db(`INSERT INTO solicitudes (equipo, nombre, telefono, detalle, origen) VALUES ($1, $2, $3, $4, $5) RETURNING ${CAMPOS}`, [equipo, nombre, telefono, detalle, quien]);
  return res.status(201).json({ code: fila(r).code });
}

async function listar(res) {
  const rows = await db(`SELECT ${CAMPOS} FROM solicitudes ORDER BY creada_el DESC LIMIT 500`);
  return res.status(200).json({ solicitudes: rows.map(fila) });
}

async function cambiar(req, res, rol) {
  if (!mismoOrigen(req)) return res.status(403).json({ error: 'Origen no permitido' });
  const b = cuerpo(req), id = Number(b.id);
  const estado = b.estado === undefined ? null : b.estado;
  const nota = b.nota === undefined ? null : texto(b.nota, 2000);
  if (!Number.isInteger(id) || id < 1 || (estado !== null && !ESTADOS.includes(estado)) || (estado === null && nota === null)) return res.status(400).json({ error: 'Datos inválidos' });
  // The first person to take a request stays recorded; the name comes from the session, never from the page
  const [r] = await db(`UPDATE solicitudes SET
      estado = COALESCE($2, estado),
      nota = COALESCE($3, nota),
      tomada_por = CASE WHEN $2 = 'contacto' THEN COALESCE(tomada_por, $4) ELSE tomada_por END,
      tomada_el = CASE WHEN $2 = 'contacto' THEN COALESCE(tomada_el, now()) ELSE tomada_el END
    WHERE id = $1 RETURNING ${CAMPOS}`, [id, estado, nota, ROLES[rol].n]);
  if (!r) return res.status(404).json({ error: 'No encontramos esa solicitud.' });
  return res.status(200).json({ solicitud: fila(r) });
}

module.exports = async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'POST', 'PATCH'].includes(req.method)) {
    res.setHeader('Allow', 'GET, POST, PATCH');
    return res.status(405).json({ error: 'Método no permitido' });
  }
  if (!activo()) return res.status(503).json({ error: 'El servicio todavía no está configurado.' });
  try {
    if (req.method === 'POST') return await crear(req, res);
    const rol = rolDe(req);
    if (!rol) return res.status(401).json({ error: 'Tenés que ingresar con tu clave.' });
    if (!['tec', 'admin'].includes(rol)) return res.status(403).json({ error: 'Tu acceso no incluye las solicitudes.' });
    return await (req.method === 'GET' ? listar(res) : cambiar(req, res, rol));
  } catch (e) {
    console.error('solicitudes:', e.message);
    return res.status(503).json({ error: 'No pudimos procesar el pedido. Probá de nuevo en unos minutos.' });
  }
};
