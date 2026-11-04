/* Shared demo data and helpers. Everything on the page (client, admin, factory, tracker) reads from here,
   so an edit in one view shows up in the others. Business logic comes from "Portal de servicio técnico.html". */
window.Ricser = (() => {
  const TG = { c: 'Cliente ve', i: 'Solo interno', cf: 'Cliente y fábrica' };

  const ICON = {
    plane: '<svg viewBox="0 0 24 24" aria-hidden="true"><path fill="currentColor" d="M22 12c0 .9-1 1.400-2 1.400h-5.200L10.600 21H8.600l2-7.600H6l-1.700 2.200H2.600L3.600 12 2.600 8.400h1.700L6 10.600h4.600L8.600 3h2l4.200 7.600H20c1 0 2 .5 2 1.400z"/></svg>',
    truck: '<svg viewBox="0 0 32 20" aria-hidden="true"><g fill="currentColor"><rect x="1" y="3" width="17" height="11" rx="1.500"/><path d="M19 7h6l5 4v3H19z"/><circle cx="8" cy="16" r="3"/><circle cx="24" cy="16" r="3"/></g></svg>',
    reg: '<svg viewBox="0 0 24 24" aria-hidden="true"><g fill="none" stroke="currentColor" stroke-width="1.500"><circle cx="12" cy="12" r="6.500"/><path d="M12 1.500v21M1.500 12h21"/></g></svg>',
  };

  // steps: what Ricser and the factory work with. cl: the only stages the client sees. map: internal step -> client stage
  const TYPES = {
    repuesto: { n: 'Reclamo de garantía', cn: 'Pedido de repuesto', c: 'var(--red)', v: 'plane', steps: ['Solicitada', 'Aprobada', 'En producción', 'Despachada', 'En aduana', 'Reemplazada'], cl: ['Solicitada', 'Despachada', 'Reemplazada'], map: [0, 0, 0, 1, 1, 2] },
    remoto: { n: 'Servicio remoto', cn: 'Servicio remoto', c: 'var(--cyan)', steps: ['Solicitado', 'Agendado', 'Pago confirmado', 'Realizado'], cl: ['Solicitado', 'Agendado', 'Realizado'], map: [0, 1, 1, 2] },
    visita: { n: 'Visita técnica', cn: 'Visita técnica', c: 'var(--amber)', steps: ['Solicitada', 'Técnico asignado', 'En sitio', 'Informe enviado'], cl: ['Solicitada', 'Agendada', 'Realizada'], map: [0, 1, 1, 2] },
    insumo: { n: 'Pedido de insumos', cn: 'Pedido de insumos', c: 'var(--sky)', v: 'truck', steps: ['Pedido', 'Preparando', 'Despachado', 'Entregado'], cl: ['Solicitado', 'Despachado', 'Entregado'], map: [0, 0, 1, 2] },
    instalacion: { n: 'Instalación', cn: 'Instalación', c: 'var(--ink)', steps: ['Instalado'], cl: ['Instalado'], map: [0] },
  };

  const REM = [
    { k: 'Migración de datos', p: 100, d: 'Pasamos tus archivos y perfiles al equipo nuevo' },
    { k: 'Calibración del equipo', p: 150, d: 'Ajuste de color y precisión por conexión remota' },
    { k: 'Capacitación', p: 50, d: 'Sesión de 1 hora con tu operador' },
  ];

  // TODO: confirmar con Ricser el cabezal de cada equipo. Técnicos y administración lo pueden editar en el portal
  const EQ = [
    { id: 'e1', m: 'Cama plana UV 6090', cabezal: 'A confirmar', s: 'CP60-25-0471', inst: '2025-03-14', gar: '2027-03-14', h: 1840, img: 'assets/equipos/eq-cama-plana-6090.webp', iw: 900, ih: 624 },
    { id: 'e2', m: 'DTF Textil 6 cabezales', cabezal: '6 cabezales, modelo a confirmar', s: 'DT60-26-1129', inst: '2026-01-22', gar: '2028-01-22', h: 420, img: 'assets/equipos/eq-dtf-textil-6.webp', iw: 1100, ih: 697 },
    { id: 'e3', m: 'Cortadora láser 1,60 × 2,50', cabezal: 'No usa cabezal de impresión', s: 'CL16-23-0098', inst: '2023-08-02', gar: '2025-08-02', h: 5210, img: 'assets/equipos/eq-cortadora-laser.webp', iw: 640, ih: 602 },
  ];

  /* ---------- Equipment catalogue: the only source for the technical sheet, the carousel and the footer ---------- */
  const AE = 'assets/equipos/', AM = 'assets/materiales/';
  const im = (f, w, h, label, vista) => ({ src: AE + f, w, h, label, vista });
  const PEND = 'TODO: confirmar con Ricser'; // no invented specs: fill specs[], callouts[] and materiales[] when Ricser confirms them
  const eqp = (id, nombre, modelo, tw, th, imagenes, extra) => Object.assign({ id, nombre, modelo, thumb: { src: `${AE}thumbs/${id}.webp`, w: tw, h: th }, imagenes, specs: [], callouts: [], materiales: [], pendiente: PEND }, extra);
  const vistas = (id, list) => list.map((d, i) => im(i ? `${id}-${i + 1}.webp` : `${id}.webp`, d[0], d[1], `Vista ${i + 1}`));

  const EQUIPOS = [
    eqp('cama-plana-uv-2513', 'Cama plana UV', '2513', 320, 143, [
      im('cama-plana-uv-2513.webp', 1600, 717, 'Vista 3/4', 'callouts'),
      im('cama-plana-uv-2513-frente.webp', 1600, 554, 'Frente'),
      im('cama-plana-uv-2513.webp', 1600, 717, 'Medidas', 'cotas'),
    ], {
      marca: 'HanColor',
      pendiente: null,
      specs: [
        { k: 'Medidas', v: '4535 × 2175 × 1600 mm' },
        { k: 'Cabezales', v: '4 Ricoh 6ta generación' },
        { k: 'Altura máxima de impresión', v: '15 cm' },
        { k: 'Succión', v: 'Cinco áreas independientes' },
        { k: 'Sistema', v: 'Levitación magnética + rejilla metálica' },
      ],
      // a = point on the photo, l = where the label goes, both in % of the image; pos = side the text grows towards
      callouts: [
        { t: 'Levitación magnética + rejilla metálica', a: [22, 10], l: [32, -8] },
        { t: 'Cinco áreas de succión independientes', a: [66, 41], l: [71, 7] },
        { t: '4 cabezales Ricoh 6ta generación', a: [14, 37], l: [14, 60], pos: 'abajo' },
        { t: 'Altura máxima de impresión 15 cm', a: [78, 47], l: [80, 96] },
      ],
      cotas: [
        { t: '4535 mm', de: [3, -8], a: [97, -8], lado: -1 },
        { t: '1600 mm', de: [-3, 2], a: [-3, 97], lado: -1 },
        { t: '2175 mm', de: [21, 80], a: [43, 100], lado: 1 },
      ],
      materiales: [
        { n: 'Cuero', img: `${AM}cuero.webp` },
        { n: 'Cerámica', img: `${AM}ceramica.webp` },
        { n: 'PVC símil mármol', img: `${AM}pvc-marmol.webp` },
        { n: 'Metal para señalización', img: `${AM}metal.webp` },
        { n: 'Acrílico', img: `${AM}acrilico.webp` },
        { n: 'Vidrio', img: `${AM}vidrio.webp` },
        { n: 'Madera / MDF', img: `${AM}madera-mdf.webp` },
      ],
    }),
    eqp('cama-plana-uv-6090', 'Cama plana UV', '6090', 320, 223, vistas('cama-plana-uv-6090', [[924, 644]])),
    eqp('a3-uv', 'Impresora UV', 'A3', 320, 300, vistas('a3-uv', [[811, 760]])),
    eqp('dtf-uv-60', 'DTF UV', '60 cm', 320, 283, vistas('dtf-uv-60', [[1464, 1293], [1132, 767]])),
    eqp('dtf-uv-30', 'DTF UV', '30 cm', 320, 306, vistas('dtf-uv-30', [[1367, 1307], [776, 696]])),
    eqp('dtf-textil-6', 'DTF Textil', '6 cabezales', 320, 204, vistas('dtf-textil-6', [[1600, 1018], [1600, 970]])),
    eqp('dtf-textil-4', 'DTF Textil', '4 cabezales', 320, 269, vistas('dtf-textil-4', [[1581, 1328]])),
    eqp('dtf-h3070-4', 'DTF', 'H3070-4', 320, 238, vistas('dtf-h3070-4', [[1600, 1192]])),
    eqp('dtg-1-estacion', 'DTG', '1 estación', 320, 246, vistas('dtg-1-estacion', [[1590, 1221]])),
    eqp('dtg-2-estaciones', 'DTG', '2 estaciones', 320, 190, vistas('dtg-2-estaciones', [[1534, 909]])),
    eqp('dtg', 'DTG', 'Modelo a confirmar', 320, 158, vistas('dtg', [[1600, 792]])), // TODO: confirmar con Ricser qué modelo es esta foto
    eqp('hibrida-uv', 'Híbrida UV', 'Hybrid', 320, 116, vistas('hibrida-uv', [[1600, 581]])),
    eqp('plotter-uv', 'Plotter UV', 'Modelo a confirmar', 320, 134, vistas('plotter-uv', [[1600, 669], [1600, 558], [979, 449]])), // TODO: confirmar con Ricser qué modelo es
    eqp('plotter-uv-32', 'Plotter UV', '3,2 m', 320, 111, vistas('plotter-uv-32', [[1600, 557]])),
    eqp('plotter-1-cabezal', 'Plotter', '1 cabezal', 320, 236, vistas('plotter-1-cabezal', [[1600, 1182]])),
    eqp('plotter-2-cabezales', 'Plotter', '2 cabezales', 320, 294, vistas('plotter-2-cabezales', [[1489, 1367]])),
    eqp('plotter-8-cabezales', 'Plotter', '8 cabezales', 320, 147, vistas('plotter-8-cabezales', [[1600, 737]])),
    eqp('plotter-subli-4', 'Plotter de sublimación', '4 cabezales', 320, 145, vistas('plotter-subli-4', [[1600, 726]])),
    eqp('plotter-corte', 'Plotter de corte', 'Skycut', 320, 238, vistas('plotter-corte', [[1600, 1188], [1600, 910], [1600, 1096]]), { marca: 'Skycut' }),
    eqp('cortadora-laser', 'Cortadora láser', '1,60 × 2,50', 320, 302, vistas('cortadora-laser', [[433, 408]])),
    eqp('cortadoras-skycut', 'Cortadoras', 'Skycut', 295, 320, vistas('cortadoras-skycut', [[1223, 1326], [1069, 1159], [856, 1191], [1271, 1298]]), { marca: 'Skycut' }),
    eqp('mesa-corte-1625', 'Mesa de corte', '1625', 320, 144, vistas('mesa-corte-1625', [[1600, 722]])),
    eqp('mesa-corte-6090', 'Mesa de corte', '6090', 320, 269, vistas('mesa-corte-6090', [[1542, 1297]])),
    eqp('mesa-corte-1x070', 'Mesa de corte', '1 × 0,70', 291, 320, vistas('mesa-corte-1x070', [[617, 679]])),
    eqp('mesas-corte-skycut', 'Mesas de corte', 'Skycut', 320, 230, vistas('mesas-corte-skycut', [[1600, 1148], [1600, 932]]), { marca: 'Skycut' }),
    eqp('calandra-1726', 'Calandra', '1726', 320, 249, vistas('calandra-1726', [[1600, 1244]])),
    eqp('plancha-doble-neumatica', 'Plancha doble', 'Neumática', 320, 168, vistas('plancha-doble-neumatica', [[1600, 842], [1290, 1331], [1600, 1276]])),
  ];

  // Active machine, shared with the rest of the site through onEquipo()
  let activoId = EQUIPOS[0].id;
  const equipoSubs = [];
  const equipoActivo = () => EQUIPOS.find(e => e.id === activoId);
  const onEquipo = fn => equipoSubs.push(fn);
  function setEquipoActivo(id, opts) {
    if (id === activoId || !EQUIPOS.some(e => e.id === id)) return;
    activoId = id;
    equipoSubs.forEach(fn => fn(equipoActivo(), opts));
  }

  const EV = [
    { id: 1, eq: 'e1', t: 'instalacion', ti: 'Instalación y puesta en marcha', d: '2025-03-14', s: 0, tec: 'M. Rossi', cost: 180, price: 0, note: 'Cliente pidió reforzar la capacitación inicial.' },
    { id: 2, eq: 'e1', t: 'visita', ti: 'Mantenimiento preventivo', d: '2025-11-05', s: 3, tec: 'M. Rossi', cost: 140, price: 260, note: 'Cabezal 2 con desgaste, ofrecer repuesto en la próxima visita.' },
    { id: 3, eq: 'e1', t: 'insumo', ti: 'Tinta UV CMYK ×4 + limpiador', d: '2026-10-30', s: 2, pedido: 'PED-2026-0003', tec: 'Depósito', cost: 610, price: 820, note: '' },
    { id: 4, eq: 'e2', t: 'instalacion', ti: 'Instalación y puesta en marcha', d: '2026-01-22', s: 0, tec: 'L. Giménez', cost: 150, price: 0, note: '' },
    { id: 5, eq: 'e2', t: 'repuesto', ti: 'Cabezal de impresión', d: '2026-10-20', s: 3, caso: 'GAR-2026-0042', guia: 'AWB 176-4410 2290', carrier: 'Courier aéreo', eta: '2026-11-12', notas: '', hist: { 0: '2026-10-20', 1: '2026-10-21', 2: '2026-10-22', 3: '2026-10-24' }, falla: 'El cabezal 2 imprime con líneas blancas.', tec: 'Importaciones', cost: 540, price: 0, note: 'RMA 8841 con el proveedor.',
      fab: {
        estado: 'enviado', enviadoEl: '2026-10-20', evidencia: [],
        obs: 'El cabezal 2 deja líneas blancas después de la purga y del test de boquillas. Los otros cabezales imprimen bien.',
        chat: [
          { rol: 'tec', autor: 'L. Giménez', at: '2026-10-20T10:12:00', txt: 'Cargué la observación. Sigue con líneas blancas después de la purga.' },
          { rol: 'fab', autor: 'HanColor', at: '2026-10-21T08:40:00', txt: 'Recibido. Aprobamos el reemplazo del cabezal.' },
          { rol: 'ricser', autor: 'Ricser SRL', at: '2026-10-24T15:05:00', txt: 'Pieza despachada. Ya cargamos la guía aérea.' },
        ],
      } },
    { id: 6, eq: 'e2', t: 'remoto', ti: 'Calibración del equipo', d: '2026-10-29', s: 1, tec: 'L. Giménez', cost: 30, price: 150, note: 'Esperar el cabezal nuevo antes de calibrar.' },
    { id: 7, eq: 'e3', t: 'visita', ti: 'Cambio de tubo láser', d: '2025-12-12', s: 3, tec: 'M. Rossi', cost: 420, price: 690, note: 'Cliente fuera de garantía, ofrecer contrato anual.' },
    { id: 8, eq: 'e1', t: 'repuesto', ti: 'Bomba de tinta', d: '2026-11-02', s: 0, caso: 'GAR-2026-0043', guia: '', carrier: '', eta: '', notas: '', hist: { 0: '2026-11-02' }, falla: 'Pierde presión en el circuito de tinta blanca.', tec: 'M. Rossi', cost: 0, price: 0, note: '',
      fab: { estado: 'diagnostico', obs: '', evidencia: [], chat: [] } },
  ];

  // [tabla, descripción, campos[[nombre, visibilidad]], tablas a las que apunta]
  const DB = [
    ['clientes', 'Una fila por empresa', [['razon_social', 'c'], ['cuit', 'c'], ['contactos y usuarios del portal', 'c'], ['dirección de planta', 'c'], ['segmento (gráfica / textil)', 'i'], ['condición de pago y crédito', 'i'], ['notas comerciales', 'i']], []],
    ['equipos', 'El corazón de la base', [['modelo y número de serie', 'c'], ['fecha de instalación', 'c'], ['cabezal', 'c'], ['estado actual', 'c'], ['garantía hasta', 'i'], ['horas de uso', 'i'], ['lote y proveedor de origen', 'i'], ['costo de importación', 'i'], ['contrato de mantenimiento', 'i']], ['clientes']],
    ['eventos_servicio', 'Línea de tiempo única por equipo', [['equipo_id y tipo', 'c'], ['título y fecha', 'c'], ['estado y paso actual', 'c'], ['usuario que lo pidió', 'c'], ['técnico responsable', 'i'], ['costo y precio', 'i'], ['nota interna', 'i'], ['prioridad y SLA', 'i']], ['equipos']],
    ['casos_garantia', 'Reclamos a la fábrica, con número de caso', [['número de caso (GAR-AAAA-NNNN)', 'cf'], ['modelo y serie del equipo', 'cf'], ['fecha de instalación', 'cf'], ['pieza y descripción de la falla', 'cf'], ['fotos y videos de evidencia', 'cf'], ['observación técnica', 'cf'], ['chat interno del caso', 'cf'], ['estado del reclamo', 'cf'], ['guía aérea del envío', 'cf'], ['empresa cliente y contacto', 'i'], ['costo, RMA interno y notas', 'i']], ['eventos_servicio']],
    ['repuestos_solicitados', 'Pieza concreta de cada caso', [['pieza y cantidad', 'c'], ['cubierto por garantía (sí/no)', 'c'], ['guía de seguimiento del envío', 'c'], ['etapa, transportista, ETA y notas', 'c'], ['proveedor y número de RMA', 'i'], ['costo de la pieza', 'i'], ['stock reservado', 'i']], ['casos_garantia']],
    ['servicios_remotos', 'Migración, calibración, capacitación', [['tipo de servicio', 'c'], ['precio USD (50 a 150)', 'c'], ['estado de pago', 'c'], ['día y horario', 'c'], ['enlace de la sesión', 'c'], ['técnico y minutos usados', 'i'], ['grabación y checklist', 'i']], ['eventos_servicio']],
    ['visitas_tecnicas', 'Servicios presenciales', [['urgencia y motivo', 'c'], ['fecha de visita', 'c'], ['informe de la visita (PDF)', 'c'], ['técnico y horas', 'i'], ['viáticos y traslado', 'i'], ['recomendaciones comerciales', 'i']], ['eventos_servicio']],
    ['pedidos_insumos', 'Consumibles', [['ítems y cantidades', 'c'], ['estado del despacho', 'c'], ['transporte y guía', 'c'], ['costo y margen', 'i'], ['depósito de origen', 'i']], ['eventos_servicio']],
    ['notificaciones', 'Mails al cliente por cada avance', [['caso y etapa', 'c'], ['asunto y fecha de envío', 'c'], ['destinatario', 'i'], ['estado de entrega', 'i']], ['casos_garantia']],
    ['solicitudes_servicio', 'Pedidos que entran desde el inicio de la web', [['equipo y detalle del problema', 'i'], ['nombre y teléfono', 'i'], ['estado y quién la tomó', 'i'], ['nota del contacto', 'i']], ['equipos']],
    ['usuarios_y_roles', 'Quién ve qué', [['cliente (solo su empresa)', 'c'], ['técnico (sus asignaciones)', 'i'], ['administración (todo)', 'i'], ['registro de cambios (auditoría)', 'i']], ['clientes']],
  ];

  const pad = n => String(n).padStart(2, '0');
  const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const fmt = d => new Date(d + 'T12:00:00').toLocaleDateString('es-AR', { day: 'numeric', month: 'short', year: 'numeric' });
  const num = n => Number(n).toLocaleString('es-AR');
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const done = e => e.s >= TYPES[e.t].steps.length - 1;
  const clStep = e => TYPES[e.t].map[e.s];
  const clName = e => TYPES[e.t].cl[clStep(e)];
  // Date a client stage was reached: that of the first internal step that maps to it
  const clDate = (e, k) => (e.hist && k <= clStep(e) ? e.hist[TYPES[e.t].map.indexOf(k)] || '' : '');

  const warranty = e => {
    const now = new Date(), i = new Date(e.inst + 'T12:00:00'), g = new Date(e.gar + 'T12:00:00');
    return { pct: Math.max(0, Math.min(100, (now - i) / (g - i) * 100)), valid: g > now };
  };
  // Derived, so that opening a service on a machine changes its status everywhere
  const eqStatus = (e, forClient) => {
    const svc = EV.some(v => v.eq === e.id && !done(v) && v.t !== 'insumo');
    if (svc) return { t: 'Con servicio abierto', c: 'ye' };
    if (!forClient && !warranty(e).valid) return { t: 'Garantía vencida', c: 'mg' };
    return { t: 'Operativo', c: 'ok' };
  };

  const seq = { id: 9, gar: 43, ped: 3, ev: 1 };
  const subs = [];
  const on = fn => subs.push(fn);
  const emit = src => subs.forEach(fn => fn(src));

  function addEvent(o) {
    const year = new Date().getFullYear();
    const ev = Object.assign({ id: seq.id++, d: todayISO(), s: 0, tec: 'Sin asignar', cost: 0, price: 0, note: '' }, o);
    if (o.t === 'repuesto') {
      ev.caso = `GAR-${year}-${String(++seq.gar).padStart(4, '0')}`;
      Object.assign(ev, { guia: '', carrier: '', eta: '', notas: '', hist: { 0: ev.d }, fab: { estado: 'diagnostico', obs: '', evidencia: [], chat: [] } });
    }
    if (o.t === 'insumo') ev.pedido = `PED-${year}-${String(++seq.ped).padStart(4, '0')}`;
    EV.push(ev);
    emit('add');
    return ev;
  }

  function updateEvent(id, key, value, src) {
    const v = EV.find(x => x.id === id);
    if (!v) return null;
    const before = v[key], clBefore = clStep(v);
    v[key] = ['s', 'cost', 'price'].includes(key) ? (Number(value) || 0) : value;
    const changed = v[key] !== before;
    if (changed && key === 's' && v.hist) v.hist[v.s] = v.hist[v.s] || todayISO();
    emit(src);
    // The client hears about what the client can see, whichever view it was changed from: a new stage, the guide or the ETA
    const visible = key === 's' ? clStep(v) !== clBefore : ['guia', 'eta'].includes(key);
    if (changed && v.t === 'repuesto' && visible) Notifier.avisarAvance(v, key);
    return v;
  }

  function updateEquipo(id, key, value) {
    const q = EQ.find(x => x.id === id);
    if (!q) return;
    q[key] = value;
    emit('eq');
  }

  /* ---------- Who is looking ----------
     Prototype only: this decides what the interface shows, it does not protect the data. Real access needs sign-in
     and a server that sends each person only what they may see. */
  const ACCESOS = {
    cliente: { n: 'Cliente', vistas: ['cli'] },
    tec: { n: 'Técnico', vistas: ['sol', 'int', 'fab', 'cli'] },
    admin: { n: 'Administrador', vistas: ['sol', 'int', 'fab', 'cli', 'db'] },
    fab: { n: 'Fábrica HanColor', vistas: ['fab'] },
  };
  let rol = 'cliente';
  const rolSubs = [];
  document.documentElement.dataset.rol = rol;
  const getRol = () => rol;
  const onRol = fn => rolSubs.push(fn);
  function setRol(r) {
    rol = r;
    document.documentElement.dataset.rol = r;
    rolSubs.forEach(fn => fn(r));
  }

  /* ---------- Technical service requests ----------
     They stay in this browser's localStorage, so they survive a reload and the next day on this same computer.
     TODO: a real database, so a request reaches the person on duty from any device. */
  const SOL_KEY = 'ricser.solicitudes';
  const solSubs = [];
  const solSeed = () => [{ id: 1, code: `ST-${new Date().getFullYear()}-0001`, at: new Date(Date.now() - 864e5).toISOString(), equipo: 'DTF Textil 6 cabezales', nombre: 'Contacto de ejemplo', telefono: '11 5555 0100', detalle: 'La impresora se detiene a mitad del trabajo y marca un error en pantalla.', estado: 'nueva' }];
  const solicitudes = (() => {
    try {
      const saved = JSON.parse(localStorage.getItem(SOL_KEY));
      if (Array.isArray(saved)) return saved;
    } catch { /* no storage or broken data: start from the example */ }
    return solSeed();
  })();
  const onSol = fn => solSubs.push(fn);
  function solChanged() {
    try { localStorage.setItem(SOL_KEY, JSON.stringify(solicitudes)); } catch { /* private mode: it lasts until reload */ }
    solSubs.forEach(fn => fn());
  }
  function addSolicitud(o) {
    const id = solicitudes.reduce((m, x) => Math.max(m, x.id), 0) + 1;
    const item = Object.assign({ id, code: `ST-${new Date().getFullYear()}-${String(id).padStart(4, '0')}`, at: new Date().toISOString(), estado: 'nueva' }, o);
    solicitudes.unshift(item);
    solChanged();
    return item;
  }
  function updateSolicitud(id, patch) {
    const item = solicitudes.find(x => x.id === id);
    if (!item) return;
    Object.assign(item, patch);
    solChanged();
  }

  /* ---------- Evidence and uploads ---------- */
  const LIMITS = { video: 200, imagen: 15, pdf: 25 }; // MB
  const tipoDe = f => (f.type.startsWith('video/') ? 'video' : f.type.startsWith('image/') ? 'imagen' : f.type === 'application/pdf' ? 'pdf' : '');

  function checkFile(file, allowPdf) {
    const t = tipoDe(file);
    if (!t || (t === 'pdf' && !allowPdf)) return allowPdf ? 'Solo se aceptan videos, fotos o PDF.' : 'Solo se aceptan videos o fotos.';
    if (!file.size) return 'El archivo está vacío.';
    if (file.size > LIMITS[t] * 1048576) return `"${file.name}" pesa ${Math.ceil(file.size / 1048576)} MB. El máximo es ${LIMITS[t]} MB.`;
    return null;
  }

  /* Prototype storage: the file stays in this tab. For real storage change only this function so it uploads
     the file (for example to a signed URL) and returns its final address: the interface does not change. */
  const Uploads = { async subir(file) { return URL.createObjectURL(file); } };

  async function addEvidence(id, file, por = 'Técnico') {
    const v = EV.find(x => x.id === id), error = checkFile(file);
    if (error) return { error };
    const item = { id: seq.ev++, tipo: tipoDe(file), nombre: file.name, tam: file.size, url: await Uploads.subir(file), por, at: new Date().toISOString() };
    v.fab.evidencia.push(item);
    return { item };
  }

  function removeEvidence(id, evId) {
    const f = EV.find(x => x.id === id).fab, k = f.evidencia.findIndex(x => x.id === evId);
    if (k < 0) return;
    if (f.evidencia[k].url.startsWith('blob:')) URL.revokeObjectURL(f.evidencia[k].url);
    f.evidencia.splice(k, 1);
  }

  const ROLES = { tec: { rol: 'Técnico', autor: 'Técnico' }, ricser: { rol: 'Ricser', autor: 'Ricser SRL' }, fab: { rol: 'Fábrica', autor: 'HanColor' } };

  async function addMessage(id, { rol, txt, file }) {
    const v = EV.find(x => x.id === id);
    const m = { rol, autor: rol === 'tec' && v.tec !== 'Sin asignar' && v.tec !== 'Importaciones' ? v.tec : ROLES[rol].autor, at: new Date().toISOString(), txt };
    if (file) m.adjunto = { tipo: tipoDe(file), nombre: file.name, url: await Uploads.subir(file) };
    v.fab.chat.push(m);
    return m;
  }

  // The factory only receives a case once the technician has explained what happens
  function sendToFactory(id, obs) {
    const v = EV.find(x => x.id === id), text = String(obs || '').trim();
    if (!text) return { ok: false, error: 'Escribí la observación técnica antes de enviar el caso a fábrica.' };
    v.fab.obs = text;
    v.fab.estado = 'enviado';
    v.fab.enviadoEl = todayISO();
    emit('fab');
    return { ok: true };
  }

  // Client e-mails: the queue lives here and js/notifier.js fills it
  const CLIENTE = { nombre: 'Gráfica Del Plata', email: 'compras@graficadelplata.example', cuit: '30-00000000-0', contacto: 'Compras', telefono: '223 555 0100', planta: 'Planta de ejemplo, Mar del Plata' };
  const outbox = [];

  // Tracker lookup: accepts case, order or air waybill, with any casing or spacing
  const norm = s => String(s || '').toUpperCase().replace(/^AWB/, '').replace(/[^A-Z0-9]/g, '');
  function findShipment(q) {
    const n = norm(q);
    if (!n) return null;
    return EV.find(e => [e.caso, e.pedido, e.guia].some(c => c && norm(c) === n)) || null;
  }
  const shipmentsOf = id => EV.filter(e => e.eq === id && TYPES[e.t].v).sort((a, b) => Number(done(a)) - Number(done(b)) || b.d.localeCompare(a.d));
  const codeOf = e => e.caso || e.pedido || '';

  return { TG, ICON, TYPES, REM, EQ, EV, DB, EQUIPOS, equipoActivo, setEquipoActivo, onEquipo, ACCESOS, getRol, setRol, onRol, solicitudes, addSolicitud, updateSolicitud, onSol, updateEquipo, clStep, clName, clDate, ROLES, LIMITS, CLIENTE, outbox, Uploads, checkFile, addEvidence, removeEvidence, addMessage, sendToFactory, todayISO, fmt, num, esc, done, warranty, eqStatus, on, emit, addEvent, updateEvent, findShipment, shipmentsOf, codeOf };
})();
