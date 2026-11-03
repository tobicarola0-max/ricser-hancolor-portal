/* Procedural backdrop (WebGL fragment shader): volumetric cyan light and luminous floor waves.
   It is the placeholder for an optional rendered video plate, see VIDEO_PLATES in cinema.js. */
window.RicserBG = (() => {
  const VS = 'attribute vec2 p;void main(){gl_Position=vec4(p,0.,1.);}';
  const FS = `precision mediump float;
  uniform vec2 uR,uM,uC;uniform float uT,uRing,uBeam,uS;
  const vec3 ABYSS=vec3(0.,.059,.086),TEAL=vec3(.043,.361,.486),STEEL=vec3(.161,.51,.639),CYAN=vec3(.314,.729,.718);
  float h(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
  float n(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);
    return mix(mix(h(i),h(i+vec2(1,0)),f.x),mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x),f.y);}
  float fbm(vec2 p){float a=.5,s=0.;for(int i=0;i<4;i++){s+=a*n(p);p=p*2.03+vec2(7.1,3.7);a*=.5;}return s;}
  void main(){
    vec2 uv=(gl_FragCoord.xy-.5*uR)/uR.y;
    vec3 c=ABYSS;
    /* volumetric cone falling from above, leaning a little toward the cursor */
    vec2 q=uv-vec2(uM.x*.07,.72);
    float a=atan(q.x,-q.y),d=length(q);
    float shafts=fbm(vec2(a*7.+uT*.035,uT*.05));
    float cone=smoothstep(.85,.05,abs(a))*smoothstep(1.85,.15,d);
    c+=mix(TEAL,STEEL,shafts)*cone*(.12+.62*shafts*shafts)*uBeam;
    c+=TEAL*.14*fbm(uv*1.3+vec2(uT*.02,-uT*.012))*uBeam;
    /* floor waves, squashed into perspective around the machine */
    vec2 p=uv-uC;p.y*=3.3;
    float r=length(p)/uS;
    float fine=pow(.5+.5*sin(r*46.-uT*1.5),18.);
    float wide=pow(.5+.5*sin(r*11.-uT*.75),34.);
    float fall=exp(-r*2.15);
    c+=mix(TEAL,CYAN,.35)*fine*.42*fall*uRing;
    c+=mix(STEEL,CYAN,.8)*wide*1.25*fall*uRing;
    c+=CYAN*exp(-r*r*16.)*.2*uRing;
    /* vignette and grain */
    float v=smoothstep(1.4,.25,length(uv*vec2(.85,1.2)));
    c*=mix(.5,1.,v);
    c+=(h(gl_FragCoord.xy+fract(uT)*91.)-.5)*.016;
    gl_FragColor=vec4(c,1.);
  }`;
  let gl, cv, u = {}, ok = false, W = 0, H = 0;

  function sh(type, src) { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); return s; }

  function init(canvas) {
    cv = canvas;
    gl = cv.getContext('webgl', { antialias: false, alpha: false, powerPreference: 'low-power' });
    if (!gl) return false;
    const pr = gl.createProgram();
    gl.attachShader(pr, sh(gl.VERTEX_SHADER, VS)); gl.attachShader(pr, sh(gl.FRAGMENT_SHADER, FS)); gl.linkProgram(pr);
    if (!gl.getProgramParameter(pr, gl.LINK_STATUS)) return false;
    gl.useProgram(pr);
    gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
    const loc = gl.getAttribLocation(pr, 'p'); gl.enableVertexAttribArray(loc); gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
    ['uR', 'uM', 'uC', 'uT', 'uRing', 'uBeam', 'uS'].forEach(n => { u[n] = gl.getUniformLocation(pr, n); });
    ok = true; resize();
    return true;
  }

  function resize() {
    if (!ok) return;
    // Soft content: rendering at a fraction of the screen keeps it cheap and the grain stays fine
    const s = Math.min(1, 1100 / Math.max(innerWidth, innerHeight)) * Math.min(devicePixelRatio || 1, 1.25);
    W = Math.max(2, Math.round(innerWidth * s)); H = Math.max(2, Math.round(innerHeight * s));
    cv.width = W; cv.height = H;
    gl.viewport(0, 0, W, H);
  }

  function draw(S, t) {
    if (!ok) return;
    gl.uniform2f(u.uR, W, H);
    gl.uniform2f(u.uM, S.mx || 0, S.my || 0);
    gl.uniform2f(u.uC, S.ringX || 0, S.ringY);
    gl.uniform1f(u.uT, t);
    gl.uniform1f(u.uRing, S.ring);
    gl.uniform1f(u.uBeam, S.beam);
    gl.uniform1f(u.uS, S.ringS || 1);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  return { init, resize, draw };
})();
