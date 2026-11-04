/* Tables used by the API. Safe to run more than once. */
module.exports = [
  `CREATE TABLE IF NOT EXISTS solicitudes (
    id BIGSERIAL PRIMARY KEY,
    creada_el TIMESTAMPTZ NOT NULL DEFAULT now(),
    equipo TEXT NOT NULL,
    nombre TEXT NOT NULL,
    telefono TEXT NOT NULL,
    detalle TEXT NOT NULL,
    estado TEXT NOT NULL DEFAULT 'nueva' CHECK (estado IN ('nueva', 'contacto', 'cerrada')),
    tomada_por TEXT,
    tomada_el TIMESTAMPTZ,
    nota TEXT NOT NULL DEFAULT '',
    origen TEXT NOT NULL
  )`,
  'CREATE INDEX IF NOT EXISTS solicitudes_origen_idx ON solicitudes (origen, creada_el)',
  'CREATE INDEX IF NOT EXISTS solicitudes_fecha_idx ON solicitudes (creada_el DESC)',
  `CREATE TABLE IF NOT EXISTS intentos_acceso (
    origen TEXT NOT NULL,
    creado_el TIMESTAMPTZ NOT NULL DEFAULT now()
  )`,
  'CREATE INDEX IF NOT EXISTS intentos_acceso_idx ON intentos_acceso (origen, creado_el)',
];
