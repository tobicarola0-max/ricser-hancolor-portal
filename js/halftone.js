/* Scene 3: full-screen stipple/halftone mesh in WebGL.
   Three brightness fields are painted once in vector form (registration mark, Ricser symbol, distribution map).
   The vertex shader morphs between them and applies magnetic repulsion plus frequency waves from the cursor.
   Nothing here reads image files, so it also works when opened straight from disk. */
window.Halftone = (() => {
  const VS = `precision highp float;
  attribute vec2 aP;attribute vec3 aF;attribute float aR;
  uniform vec2 uRes,uMouse;uniform vec3 uShock;
  uniform float uT,uMorph,uDpr,uStep,uOn,uBlow,uZoom;
  varying float vL,vB,vA;
  void main(){
    float a=clamp(uMorph,0.,1.),b=clamp(uMorph-1.,0.,1.);
    float ka=smoothstep(aR*.45,aR*.45+.55,a),kb=smoothstep(aR*.45,aR*.45+.55,b);
    float f=mix(mix(aF.x,aF.y,ka),aF.z,kb);
    float energy=4.*ka*(1.-ka)+4.*kb*(1.-kb);
    vec2 p=aP;
    p+=vec2(cos(aR*40.+uT*.7),sin(aR*53.+uT*.6))*energy*uStep*2.6;
    float wave=sin(p.x*.011+uT*.8)*cos(p.y*.015-uT*.55);
    vec2 d=p-uMouse;float r=length(d);
    float infl=exp(-r*r/(2.*150.*150.))*uOn;
    float ripple=sin(r*.055-uT*4.5)*exp(-r*.0065)*uOn;
    p+=(d/max(r,1.))*(infl*44.+ripple*5.);
    float sr=length(aP-uShock.xy);
    float shock=exp(-pow((sr-uShock.z*1100.)*.012,2.))*max(0.,1.-uShock.z);
    p+=normalize(aP-uShock.xy+.001)*shock*30.;
    p=(p-.5*uRes)*uZoom+.5*uRes;
    p.x+=uBlow*(.3+aR*.9)*uRes.x*1.3;
    vec2 clip=p/uRes*2.-1.;
    gl_Position=vec4(clip.x,-clip.y,0.,1.);
    float lum=clamp(f,0.,1.);
    float size=uStep*(.15+.72*sqrt(lum))+wave*.28*uStep*(.05+lum*.25)+infl*uStep*.62+abs(ripple)*uStep*.14+shock*uStep*.5;
    gl_PointSize=max(1.,size*uZoom)*uDpr;
    vL=lum;vB=clamp(infl*1.1+shock+abs(ripple)*.35,0.,1.);
    vA=(.14+lum*.86+vB*.4)*(1.-smoothstep(.15,1.,uBlow));
  }`;
  const FS = `precision mediump float;varying float vL,vB,vA;
  void main(){
    float d=length(gl_PointCoord-.5);
    float m=smoothstep(.5,.34,d);
    if(m<.01)discard;
    vec3 c=mix(vec3(.161,.51,.639),vec3(.314,.729,.718),smoothstep(.18,.75,vL));
    c=mix(c,vec3(.74,.97,.95),vB*.75);
    gl_FragColor=vec4(c*m*vA,1.);
  }`;

  let cv, gl, u = {}, W = 0, H = 0, dpr = 1, step = 7, count = 0, buf, ok = false, geoP = null;
  const mouse = { x: -9999, y: -9999, tx: -9999, ty: -9999, on: 0, ton: 0 };
  const shock = { x: 0, y: 0, z: 1 };

  // Approximate outline of Argentina (lon, lat): enough for a stippled map at this resolution
  const AR = [[-66.2, -21.8], [-64.3, -22], [-62.8, -22], [-62.3, -22.4], [-61, -23.8], [-59, -24.6], [-57.7, -25.3], [-58.6, -27.3], [-55.9, -27.4], [-54.6, -25.6], [-53.7, -26.2], [-53.8, -27.1], [-55.8, -28.3], [-57.6, -30.2], [-58.2, -32.4], [-58.4, -33.9], [-57.2, -35.3], [-57.3, -36], [-56.7, -36.4], [-57.5, -38], [-58.7, -38.6], [-62.2, -38.9], [-62.2, -40.5], [-65, -41], [-63.6, -42.6], [-65, -43.3], [-65.4, -45], [-67.5, -45.9], [-65.9, -47.2], [-67.6, -49.3], [-69, -50.5], [-68.4, -52.3], [-68.6, -52.7], [-65.2, -54.7], [-68.6, -54.9], [-68.6, -52.7], [-72, -51.9], [-72.3, -50.7], [-73.3, -49.5], [-72.1, -47], [-71.7, -45], [-71.4, -43.5], [-71.8, -41], [-71, -39.5], [-71.2, -37.5], [-70, -35.5], [-70, -33], [-69.8, -30.5], [-69, -28], [-68.3, -26.5], [-67.3, -24]];
  const HUB = { n: 'HUB EZE', p: [-58.54, -34.82] };
  const CITIES = [['Rosario', -60.65, -32.95], ['Córdoba', -64.18, -31.42], ['Mendoza', -68.84, -32.89], ['Tucumán', -65.22, -26.81], ['Neuquén', -68.06, -38.95], ['Mar del Plata', -57.55, -38], ['Comodoro Rivadavia', -67.5, -45.86]];

  function layout() {
    const mobile = W < 860;
    return { cx: mobile ? .5 : .63, cy: mobile ? .56 : .5, size: mobile ? Math.min(W * .86, H * .56) : Math.min(W * .46, H * .78) };
  }

  function paintField(cols, rows, painter) {
    const off = document.createElement('canvas'); off.width = cols; off.height = rows;
    const c = off.getContext('2d', { willReadFrequently: true });
    c.fillStyle = '#000'; c.fillRect(0, 0, cols, rows);
    painter(c, cols, rows);
    const d = c.getImageData(0, 0, cols, rows).data, out = new Float32Array(cols * rows);
    for (let i = 0; i < out.length; i++) out[i] = d[i * 4] / 255;
    return out;
  }

  const gray = (v, a = 1) => { const g = Math.round(v * 255); return `rgba(${g},${g},${g},${a})`; };

  function drawReg(c, cols, rows) {
    const L = layout(), x = cols * L.cx, y = rows * L.cy, R = (L.size / step) * .36;
    const g = c.createRadialGradient(x, y, R * .12, x, y, R);
    g.addColorStop(0, gray(.05)); g.addColorStop(.7, gray(.2)); g.addColorStop(1, gray(.42));
    c.fillStyle = g; c.beginPath(); c.arc(x, y, R, 0, 7); c.fill();
    c.strokeStyle = gray(1); c.lineWidth = Math.max(1.4, R * .085);
    c.beginPath(); c.arc(x, y, R, 0, 7); c.stroke();
    c.lineWidth = Math.max(1, R * .05);
    c.beginPath(); c.moveTo(x - R * 1.42, y); c.lineTo(x + R * 1.42, y); c.moveTo(x, y - R * 1.42); c.lineTo(x, y + R * 1.42); c.stroke();
    c.fillStyle = gray(1); c.beginPath(); c.arc(x, y, R * .15, 0, 7); c.fill();
    c.strokeStyle = gray(.55); c.lineWidth = Math.max(.8, R * .025); c.setLineDash([R * .08, R * .1]);
    c.beginPath(); c.arc(x, y, R * 1.24, 0, 7); c.stroke(); c.setLineDash([]);
  }

  // Ricser symbol, traced from the supplied logo in unit coordinates
  function drawLogo(c, cols, rows) {
    const L = layout(), S = (L.size / step) * .84, ox = cols * L.cx - S / 2, oy = rows * L.cy - S / 2;
    const X = v => ox + v * S, Y = v => oy + v * S;
    const fill = (a, b) => { const g = c.createLinearGradient(ox, oy, ox + S, oy + S); g.addColorStop(0, gray(a)); g.addColorStop(1, gray(b)); c.fillStyle = g; };
    fill(.95, .48); c.beginPath(); c.moveTo(X(0), Y(0)); c.lineTo(X(1), Y(0)); c.lineTo(X(1), Y(.032)); c.quadraticCurveTo(X(.55), Y(.3), X(.2356), Y(.769)); c.lineTo(X(0), Y(.654)); c.closePath(); c.fill();
    fill(.6, 1); c.beginPath(); c.moveTo(X(1), Y(.091)); c.quadraticCurveTo(X(.62), Y(.38), X(.346), Y(1)); c.lineTo(X(1), Y(1)); c.closePath(); c.fill();
    fill(.8, .8); c.beginPath(); c.moveTo(X(0), Y(.733)); c.lineTo(X(.2356), Y(1)); c.lineTo(X(0), Y(1)); c.closePath(); c.fill();
  }

  function projector() {
    const L = layout(), mobile = W < 860;
    const hPx = mobile ? H * .62 : H * .88;
    const k = hPx / 33.2, lonK = k * Math.cos(38 * Math.PI / 180);
    const cx = W * (mobile ? .5 : .66), cy = H * (mobile ? .6 : .52);
    return (lon, lat) => [cx + (lon - (-63.6)) * lonK, cy - (lat - (-38.4)) * k];
  }

  function drawMap(c, cols, rows) {
    const P = projector();
    const pt = (lon, lat) => { const q = P(lon, lat); return [q[0] / step, q[1] / step]; };
    const top = pt(-64, -21.8)[1], bot = pt(-64, -55)[1];
    const g = c.createLinearGradient(0, top, 0, bot);
    g.addColorStop(0, gray(.62)); g.addColorStop(.55, gray(.46)); g.addColorStop(1, gray(.28));
    c.fillStyle = g; c.beginPath();
    AR.forEach((q, i) => { const s = pt(q[0], q[1]); if (i) c.lineTo(s[0], s[1]); else c.moveTo(s[0], s[1]); });
    c.closePath(); c.fill();
    c.strokeStyle = gray(.92); c.lineWidth = 1; c.stroke();
    const h = pt(HUB.p[0], HUB.p[1]);
    c.strokeStyle = gray(1); c.lineWidth = .9;
    CITIES.forEach(n => { const s = pt(n[1], n[2]); c.beginPath(); c.moveTo(h[0], h[1]); c.lineTo(s[0], s[1]); c.stroke(); });
    c.fillStyle = gray(1); c.beginPath(); c.arc(h[0], h[1], 2.2, 0, 7); c.fill();
  }

  function buildRoutes() {
    const svg = document.getElementById('routes');
    if (!svg) return;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    const P = projector(), h = P(HUB.p[0], HUB.p[1]), mobile = W < 860;
    const start = mobile ? [W + 20, H * .25] : [W + 20, H * .04];
    const air = `M${start[0]} ${start[1]} C${W * .92} ${H * .1} ${h[0] + W * .1} ${h[1] - H * .34} ${h[0]} ${h[1]}`;
    const fs = mobile ? 10 : 11;
    const ground = CITIES.map((n, i) => {
      const s = P(n[1], n[2]), right = s[0] >= h[0] - 4;
      const lx = s[0] + (mobile && !right ? -8 : right ? 10 : -10), anchor = right ? 'start' : 'end';
      return `<path id="g${i}" class="rt-g" d="M${h[0]} ${h[1]}L${s[0]} ${s[1]}"/>
        <circle class="rt-n" cx="${s[0]}" cy="${s[1]}" r="3"/>
        <text class="rt-t" x="${lx}" y="${s[1] + 4}" text-anchor="${anchor}" font-size="${fs}">${n[0]}</text>
        <rect class="rt-truck" x="-4" y="-2" width="8" height="4"><animateMotion dur="${5 + i * .9}s" repeatCount="indefinite" begin="${i * .7}s"><mpath href="#g${i}"/></animateMotion></rect>`;
    }).join('');
    const plane = '<path class="rt-plane" transform="translate(-13 -13) scale(1.100)" d="M22 12c0 .9-1 1.400-2 1.400h-5.200L10.600 21H8.600l2-7.600H6l-1.700 2.200H2.600L3.600 12 2.600 8.400h1.700L6 10.600h4.600L8.600 3h2l4.200 7.600H20c1 0 2 .5 2 1.400z"/>';
    svg.innerHTML = `<path id="airR" class="rt-a" d="${air}"/>
      ${ground}
      <g>${plane}<animateMotion dur="9s" repeatCount="indefinite" rotate="auto"><mpath href="#airR"/></animateMotion></g>
      <circle class="rt-hub" cx="${h[0]}" cy="${h[1]}" r="7"/><circle class="rt-hub2" cx="${h[0]}" cy="${h[1]}" r="16"/>
      <text class="rt-t rt-b" x="${h[0] + 22}" y="${h[1] + 5}" font-size="${fs + 2}">${HUB.n}</text>
      <text class="rt-t rt-air" x="${mobile ? W - 12 : W * .96}" y="${mobile ? H * .225 : Math.max(H * .1, 172)}" text-anchor="end" font-size="${fs}">VUELO DIRECTO · FÁBRICA HANCOLOR</text>`;
    if (!svg.classList.contains('on')) svg.pauseAnimations?.();
  }

  function buildMesh() {
    const cols = Math.ceil(W / step) + 2, rows = Math.ceil(H / step) + 2;
    const f1 = paintField(cols, rows, drawReg), f2 = paintField(cols, rows, drawLogo), f3 = paintField(cols, rows, drawMap);
    count = cols * rows;
    const data = new Float32Array(count * 6);
    for (let y = 0, i = 0; y < rows; y++) for (let x = 0; x < cols; x++, i++) {
      const o = i * 6;
      data[o] = x * step; data[o + 1] = y * step;
      data[o + 2] = f1[i]; data[o + 3] = f2[i]; data[o + 4] = f3[i];
      data[o + 5] = Math.random();
    }
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, data, gl.STATIC_DRAW);
  }

  function resize() {
    if (!cv) return;
    W = innerWidth; H = cv.parentNode.offsetHeight || innerHeight;
    dpr = Math.min(devicePixelRatio || 1, 1.75);
    step = W < 860 ? 6 : 7;
    cv.width = W * dpr; cv.height = H * dpr;
    cv.style.width = W + 'px'; cv.style.height = H + 'px';
    if (ok) { gl.viewport(0, 0, cv.width, cv.height); buildMesh(); }
    buildRoutes();
  }

  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }

  function init(canvas) {
    cv = canvas;
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'high-performance' });
    if (gl) {
      const pr = gl.createProgram();
      gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
      if (gl.getProgramParameter(pr, gl.LINK_STATUS)) {
        gl.useProgram(pr);
        buf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, buf);
        const aP = gl.getAttribLocation(pr, 'aP'), aF = gl.getAttribLocation(pr, 'aF'), aR = gl.getAttribLocation(pr, 'aR');
        [aP, aF, aR].forEach(l => gl.enableVertexAttribArray(l));
        gl.vertexAttribPointer(aP, 2, gl.FLOAT, false, 24, 0);
        gl.vertexAttribPointer(aF, 3, gl.FLOAT, false, 24, 8);
        gl.vertexAttribPointer(aR, 1, gl.FLOAT, false, 24, 20);
        ['uRes', 'uMouse', 'uShock', 'uT', 'uMorph', 'uDpr', 'uStep', 'uOn', 'uBlow', 'uZoom'].forEach(n => { u[n] = gl.getUniformLocation(pr, n); });
        gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE);
        ok = true;
      }
    }
    resize();
    window.addEventListener('pointermove', e => { mouse.tx = e.clientX; mouse.ty = e.clientY; mouse.ton = 1; }, { passive: true });
    window.addEventListener('pointerdown', e => { shock.x = e.clientX; shock.y = e.clientY; shock.z = 0; }, { passive: true });
    document.addEventListener('pointerleave', () => { mouse.ton = 0; });
    return ok;
  }

  function draw(S, dt, t) {
    if (!ok) return;
    if (mouse.x < -999) { mouse.x = mouse.tx; mouse.y = mouse.ty; }
    mouse.x += (mouse.tx - mouse.x) * .12; mouse.y += (mouse.ty - mouse.y) * .12; mouse.on += (mouse.ton - mouse.on) * .08;
    shock.z = Math.min(1, shock.z + dt * .9);
    gl.clearColor(0, .059, .086, 1); gl.clear(gl.COLOR_BUFFER_BIT);
    gl.uniform2f(u.uRes, W, H); gl.uniform2f(u.uMouse, mouse.x, mouse.y);
    gl.uniform3f(u.uShock, shock.x, shock.y, shock.z);
    gl.uniform1f(u.uT, t); gl.uniform1f(u.uMorph, S.morph); gl.uniform1f(u.uDpr, dpr);
    gl.uniform1f(u.uStep, step); gl.uniform1f(u.uOn, mouse.on); gl.uniform1f(u.uBlow, S.blow); gl.uniform1f(u.uZoom, S.htZoom);
    gl.drawArrays(gl.POINTS, 0, count);
  }

  return { init, resize, draw };
})();
