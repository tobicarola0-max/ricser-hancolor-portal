/* Client e-mails: a queue of everything sent, listed in "Ver mails enviados". The real sending lives in api/notify.js,
   where the API key stays on the server (a browser has no process.env and must never see a key). That function only
   exists on Vercel: on any other host, or without a key, the flow runs in demo mode and nothing leaves. */
window.Notifier = (() => {
  const { EQ, TYPES, CLIENTE, outbox, fmt, clStep } = Ricser;
  const subs = [];
  const endpoint = /\.vercel\.app$/.test(location.hostname) ? '/api/notify' : null;
  let nextId = 1, real = false; // real only once the server confirms it sent one
  const tell = m => subs.forEach(fn => fn(m));

  async function deliver(m) {
    try {
      const r = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(m.data) });
      const j = await r.json();
      m.estado = r.ok ? (j.sent ? 'enviado' : 'demo') : 'error';
      if (j.sent) real = true;
    } catch { m.estado = 'error'; }
    tell(m);
  }

  // mail: { to, toName, subject, html, caso, data }. `data` is what the server needs to build this same mail
  function send(mail) {
    const m = Object.assign({ id: nextId++, at: new Date().toISOString(), estado: endpoint && mail.data ? 'pendiente' : 'demo' }, mail);
    outbox.unshift(m);
    tell(m);
    if (m.estado === 'pendiente') deliver(m);
    return m;
  }

  function avisarAvance(e, motivo) {
    const q = EQ.find(x => x.id === e.eq), steps = TYPES[e.t].cl, k = clStep(e);
    const data = {
      caso: e.caso, cliente: CLIENTE.nombre, equipo: q.m, pieza: e.ti, estado: steps[k], etapa: k + 1, etapas: steps.length,
      awb: e.guia || '', transportista: e.carrier || '', eta: e.eta ? fmt(e.eta) : '', motivo,
      seguimiento: `${location.origin}${location.pathname}?caso=${encodeURIComponent(e.caso)}`,
    };
    const mail = MailTemplate.build(data);
    return send({ to: CLIENTE.email, toName: CLIENTE.nombre, subject: mail.subject, html: mail.html, caso: e.caso, data });
  }

  return { send, avisarAvance, outbox, endpoint, on: fn => subs.push(fn), get real() { return real; } };
})();
