/* Client e-mail for every step of a spare part. One template for both sides: the demo inbox in the browser
   and the real sending in api/notify.js. Table layout and inline styles, which is what mail clients render. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.MailTemplate = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeUrl = u => (/^https?:\/\//i.test(String(u || '')) ? String(u) : '');

  const INTRO = {
    s: d => `Tu repuesto avanzó a la etapa <b>${esc(d.estado)}</b>.`,
    guia: () => 'Actualizamos la guía de tu envío.',
    eta: () => 'Actualizamos la fecha estimada de entrega.',
  };

  function build(d) {
    const url = safeUrl(d.seguimiento);
    const asunto = { guia: 'Guía actualizada', eta: 'Nueva fecha estimada' }[d.motivo] || d.estado;
    const subject = `${d.caso} · ${asunto}: ${d.pieza}`;
    const rows = [['Caso', d.caso], ['Equipo', d.equipo], ['Pieza', d.pieza], ['Estado', d.estado], ['Guía aérea', d.awb || 'Pendiente'], ['Transportista', d.transportista], ['Llegada estimada', d.eta || 'A confirmar']].filter(r => r[1]);
    const steps = Number(d.etapas) || 6, at = Number(d.etapa) || 1;
    const bar = Array.from({ length: steps }, (_, i) => `<td style="height:6px;padding:0 2px;"><div style="height:6px;border-radius:2px;background:${i < at ? '#50bab7' : '#17404f'};font-size:0;line-height:0;">&nbsp;</div></td>`).join('');
    const html = `<!DOCTYPE html><html lang="es"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title>
<style>@media (max-width:480px){.pad{padding:20px 16px!important}.h1{font-size:22px!important}.lbl{display:block!important;width:auto!important;padding-bottom:0!important;border-bottom:0!important}.val{display:block!important;padding-top:2px!important}}</style></head>
<body style="margin:0;padding:0;background:#00131b;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#00131b;"><tr><td align="center" style="padding:24px 10px;">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:600px;background:#04202c;border:1px solid #2982a3;border-radius:6px;font-family:Arial,Helvetica,sans-serif;color:#e6f4f5;">
<tr><td class="pad" style="padding:26px 30px 8px;font-size:20px;font-weight:bold;letter-spacing:1px;color:#ffffff;">RICSER</td></tr>
<tr><td class="pad" style="padding:6px 30px 0;">
  <p style="margin:0 0 6px;font-size:13px;color:#a7c6cd;">Hola, ${esc(d.cliente)}</p>
  <h1 class="h1" style="margin:0 0 10px;font-size:26px;line-height:1.15;color:#ffffff;">${esc(d.estado)}</h1>
  <p style="margin:0 0 16px;font-size:15px;line-height:1.45;color:#cfe3e7;">${(INTRO[d.motivo] || INTRO.s)(d)}</p>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 18px;"><tr>${bar}</tr></table>
</td></tr>
<tr><td class="pad" style="padding:0 30px 8px;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="font-size:14px;">
  ${rows.map(r => `<tr><td class="lbl" width="38%" style="padding:9px 0;color:#7fa6b1;border-bottom:1px solid #17404f;">${esc(r[0])}</td><td class="val" style="padding:9px 0;color:#ffffff;border-bottom:1px solid #17404f;">${esc(r[1])}</td></tr>`).join('')}
  </table>
</td></tr>
${url ? `<tr><td class="pad" style="padding:18px 30px 6px;"><a href="${esc(url)}" style="display:inline-block;padding:13px 22px;background:#50bab7;border-radius:4px;color:#000f16;font-weight:bold;font-size:15px;text-decoration:none;">Ver el seguimiento</a></td></tr>` : ''}
<tr><td class="pad" style="padding:16px 30px 26px;font-size:12px;line-height:1.5;color:#7fa6b1;">Ricser SRL, importadores directos y exclusivos de HanColor.<br>Recibís este mail porque tenés un caso abierto con nosotros.</td></tr>
</table></td></tr></table></body></html>`;
    const text = [`Hola, ${d.cliente}`, `${d.caso}: ${d.estado}`, ...rows.map(r => `${r[0]}: ${r[1]}`), url ? `Seguimiento: ${url}` : '', 'Ricser SRL'].filter(Boolean).join('\n');
    return { subject, html, text };
  }

  return { build };
});
