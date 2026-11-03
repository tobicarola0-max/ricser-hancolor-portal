/* Shared demo data and helpers. Everything on the page (client, admin, factory, tracker) reads from here,
   so an edit in one view shows up in the others. Business logic comes from "Portal de servicio técnico.html". */
window.Ricser = (() => {
  const TG = { c: 'Cliente ve', i: 'Solo interno', cf: 'Cliente y fábrica' };

  const ICON = {
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 12c0 .9-1 1.400-2 1.400h-5.200L10.600 21H8.600l2-7.600H6l-1.700 2.200H2.600L3.600 12 2.600 8.400h1.700L6 10.600h4.600L8.600 3h2l4.200 7.600H20c1 0 2 .5 2 1.400z"/></svg>',
    truck: '<svg viewBox="0 0 32 20" aria-hidden="true"><g fill="currentColor"><rect x="1" y="3" width="17" height="11" rx="1.500"/><path d="M19 7h6l5 4v3H19z"/><circle cx="8" cy="16" r="3"/><circle cx="24" cy="16" r="3"/></g></svg>',
    reg: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.500"><circle cx="12" cy="12" r="6.500"/><path d="M12 1.500v21M1.500 12h21"/></g></svg>',
  };

  const TYPES = {
    repuesto: { n: 'Reclamo de garantía', c: 'var(--red)', v: 'plane', steps: ['Reclamo enviado', 'Fábrica evalúa', 'Aprobado', 'Pieza en vuelo', 'En distribución local', 'Entregada e instalada'] },
    remoto: { n: 'Servicio remoto', c: 'var(--cyan)', steps: ['Solicitado', 'Agendado', 'Pago confirmado', 'Realizado'] },
    visita: { n: 'Visita técnica', c: 'var(--amber)', steps: ['Solicitada', 'Técnico asignado', 'En sitio', 'Informe enviado'] },
    insumo: { n: 'Pedido de insumos', c: 'var(--sky)', v: 'truck', steps: ['Pedido', 'Preparando', 'Despachado', 'Entregado'] },
    instalacion: { n: 'Instalación', c: 'var(--ink)', steps: ['Instalado'] },
  };

  const REM = [
    { k: 'Migración de datos', p: 100, d: 'Pasamos tus archivos y perfiles al equipo nuevo' },
    { k: 'Calibración del equipo', p: 150, d: 'Ajuste de color y precisión por conexión remota' },
    { k: 'Capacitación', p: 50, d: 'Sesión de 1 hora con tu operador' },
  ];

  const EQ = [
    { id: 'e1', m: 'Cama plana UV 6090', s: 'CP60-25-0471', inst: '2025-03-14', gar: '2027-03-14', h: 1840, img: 'assets/equipos/eq-cama-plana-6090.webp', iw: 900, ih: 624 },
    { id: 'e2', m: 'DTF Textil 6 cabezales', s: 'DT60-26-1129', inst: '2026-01-22', gar: '2028-01-22', h: 420, img: 'assets/equipos/eq-dtf-textil-6.webp', iw: 1100, ih: 697 },
    { id: 'e3', m: 'Cortadora láser 1,60 × 2,50', s: 'CL16-23-0098', inst: '2023-08-02', gar: '2025-08-02', h: 5210, img: 'assets/equipos/eq-cortadora-laser.webp', iw: 640, ih: 602 },
  ];

  const EV = [
    { id: 1, eq: 'e1', t: 'instalacion', ti: 'Instalación y puesta en marcha', d: '2025-03-14', s: 0, tec: 'M. Rossi', cost: 180, price: 0, note: 'Cliente pidió reforzar la capacitación inicial.' },
    { id: 2, eq: 'e1', t: 'visita', ti: 'Mantenimiento preventivo', d: '2025-11-05', s: 3, tec: 'M. Rossi', cost: 140, price: 260, note: 'Cabezal 2 con desgaste, ofrecer repuesto en la próxima visita.' },
    { id: 3, eq: 'e1', t: 'insumo', ti: 'Tinta UV CMYK ×4 + limpiador', d: '2026-10-30', s: 2, pedido: 'PED-2026-0003', tec: 'Depósito', cost: 610, price: 820, note: '' },
    { id: 4, eq: 'e2', t: 'instalacion', ti: 'Instalación y puesta en marcha', d: '2026-01-22', s: 0, tec: 'L. Giménez', cost: 150, price: 0, note: '' },
    { id: 5, eq: 'e2', t: 'repuesto', ti: 'Cabezal de impresión', d: '2026-10-20', s: 3, caso: 'GAR-2026-0042', guia: 'AWB 176-4410 2290', falla: 'El cabezal 2 imprime con líneas blancas.', tec: 'Importaciones', cost: 540, price: 0, note: 'RMA 8841 con el proveedor. Llega por courier, sin aduana.' },
    { id: 6, eq: 'e2', t: 'remoto', ti: 'Calibración del equipo', d: '2026-10-29', s: 1, tec: 'L. Giménez', cost: 30, price: 150, note: 'Esperar el cabezal nuevo antes de calibrar.' },
    { id: 7, eq: 'e3', t: 'visita', ti: 'Cambio de tubo láser', d: '2025-12-12', s: 3, tec: 'M. Rossi', cost: 420, price: 690, note: 'Cliente fuera de garantía, ofrecer contrato anual.' },
  ];

  // [tabla, descripción, campos[[nombre, visibilidad]], tablas a las que apunta]
  const DB = [
    ['clientes', 'Una fila por empresa', [['razon_social', 'c'], ['cuit', 'c'], ['contactos y usuarios del portal', 'c'], ['dirección de planta', 'c'], ['segmento (gráfica / textil)', 'i'], ['condición de pago y crédito', 'i'], ['notas comerciales', 'i']], []],
    ['equipos', 'El corazón de la base', [['modelo y número de serie', 'c'], ['fecha de instalación', 'c'], ['garantía hasta', 'c'], ['horas de uso', 'c'], ['estado actual', 'c'], ['lote y proveedor de origen', 'i'], ['costo de importación', 'i'], ['contrato de mantenimiento', 'i']], ['clientes']],
    ['eventos_servicio', 'Línea de tiempo única por equipo', [['equipo_id y tipo', 'c'], ['título y fecha', 'c'], ['estado y paso actual', 'c'], ['usuario que lo pidió', 'c'], ['técnico responsable', 'i'], ['costo y precio', 'i'], ['nota interna', 'i'], ['prioridad y SLA', 'i']], ['equipos']],
    ['casos_garantia', 'Reclamos a la fábrica, con número de caso', [['número de caso (GAR-AAAA-NNNN)', 'cf'], ['modelo y serie del equipo', 'cf'], ['fecha de instalación', 'cf'], ['pieza y descripción de la falla', 'cf'], ['fotos y videos de evidencia', 'cf'], ['estado del reclamo', 'cf'], ['guía aérea del envío', 'cf'], ['empresa cliente y contacto', 'i'], ['costo, RMA interno y notas', 'i']], ['eventos_servicio']],
    ['repuestos_solicitados', 'Pieza concreta de cada caso', [['pieza y cantidad', 'c'], ['cubierto por garantía (sí/no)', 'c'], ['guía de seguimiento del envío', 'c'], ['proveedor y número de RMA', 'i'], ['costo de la pieza', 'i'], ['stock reservado', 'i']], ['casos_garantia']],
    ['servicios_remotos', 'Migración, calibración, capacitación', [['tipo de servicio', 'c'], ['precio USD (50 a 150)', 'c'], ['estado de pago', 'c'], ['día y horario', 'c'], ['enlace de la sesión', 'c'], ['técnico y minutos usados', 'i'], ['grabación y checklist', 'i']], ['eventos_servicio']],
    ['visitas_tecnicas', 'Servicios presenciales', [['urgencia y motivo', 'c'], ['fecha de visita', 'c'], ['informe de la visita (PDF)', 'c'], ['técnico y horas', 'i'], ['viáticos y traslado', 'i'], ['recomendaciones comerciales', 'i']], ['eventos_servicio']],
    ['pedidos_insumos', 'Consumibles', [['ítems y cantidades', 'c'], ['estado del despacho', 'c'], ['transporte y guía', 'c'], ['costo y margen', 'i'], ['depósito de origen', 'i']], ['eventos_servicio']],
    ['usuarios_y_roles', 'Quién ve qué', [['cliente (solo su empresa)', 'c'], ['técnico (sus asignaciones)', 'i'], ['administración (todo)', 'i'], ['registro de cambios (auditoría)', 'i']], ['clientes']],
  ];

  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  const num = n => Number(n).toLocaleString('es-AR');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const done = e => e.s >= TYPES[e.t].steps.length - 1;

  const warranty = e => {
    const now = new Date(), i = new Date(e.inst + 'T12:00:00'), g = new Date(e.gar + 'T12:00:00');
    return { pct: Math.max(0, Math.min(100, (now - i) / (g - i) * 100)), valid: g > now };
  };
  // Derived, so that opening a service on a machine changes its status everywhere
  const eqStatus = e => {
    const svc = EV.some(v => v.eq === e.id && !done(v) && v.t !== 'insumo');
    if (svc) return { t: 'Con servicio abierto', c: 'ye' };
    if (!warranty(e).valid) return { t: 'Garantía vencida', c: 'mg' };
    return { t: 'Operativo', c: 'ok' };
  };

  const seq = { id: 8, gar: 42, ped: 3 };
  const subs = [];
  const on = fn => subs.push(fn);
  const emit = src => subs.forEach(fn => fn(src));

  function addEvent(o) {
    const year = new Date().getFullYear();
    const ev = Object.assign({ id: seq.id++, d: todayISO(), s: 0, tec: 'Sin asignar', cost: 0, price: 0, note: '' }, o);
    if (o.t === 'repuesto') ev.caso = `GAR-${year}-${String(++seq.gar).padStart(4, '0')}`;
    if (o.t === 'insumo') ev.pedido = `PED-${year}-${String(++seq.ped).padStart(4, '0')}`;
    EV.push(ev);
    emit('add');
    return ev;
  }

  function updateEvent(id, key, value, src) {
    const v = EV.find(x => x.id === id);
    if (!v) return null;
    v[key] = ['s', 'cost', 'price'].includes(key) ? (Number(value) || 0) : value;
    emit(src);
    return v;
  }

  // Tracker lookup: accepts case, order or air waybill, with any casing or spacing
  const norm = s => String(s || '').toUpperCase().replace(/^AWB/, '').replace(/[^A-Z0-9]/g, '');
  function findShipment(q) {
    const n = norm(q);
    if (!n) return null;
    return EV.find(e => [e.caso, e.pedido, e.guia].some(c => c && norm(c) === n)) || null;
  }
  const shipmentsOf = id => EV.filter(e => e.eq === id && TYPES[e.t].v).sort((a, b) => Number(done(a)) - Number(done(b)) || b.d.localeCompare(a.d));
  const codeOf = e => e.caso || e.pedido || '';

  return { TG, ICON, TYPES, REM, EQ, EV, DB, todayISO, fmt, num, esc, done, warranty, eqStatus, on, emit, addEvent, updateEvent, findShipment, shipmentsOf, codeOf };
})();
