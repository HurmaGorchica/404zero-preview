// Сигнал — фон сайта и звук. Шейдер и шум взяты с нынешнего 404zero.com без изменений в GLSL.
// Красная точка = запуск, как на старом сайте: поле на весь экран, шум noiseA/noiseB, мышь крутит камеру,
// у середины экрана по вертикали мерцание разгоняется (логика старого сайта один в один), клик по полю — звук вкл/выкл.
// Пока сигнал выключен, поле тихо живёт фоном: дышит по модулю LFO и ускоряется от прокрутки (до 2,5 Гц).
// Звук без Web Audio, поэтому работает и с file://.
// Собирается командой: python3 -I _build/make_signal.py
(function () {
  const FRAG = "//-------------------------GLSL CODE\n#ifdef GL_ES\nprecision mediump float;\n#endif\n \n#extension GL_OES_standard_derivatives : enable\n \n\nconst int MAX_MARCHING_STEPS = 30;\nconst float MIN_DIST = 0.0;\nconst float MAX_DIST = 100.0;\nuniform float EPSILON;\n\n\nuniform float time;\nuniform float lfoJs;\nuniform vec2 mouse;\nuniform vec2 resolution;\nvarying vec2 surfacePosition;\nuniform float sound;\nuniform sampler2D backbuffer;\n\n\n\n\n \nfloat \tnoiseH = -0.2;\nfloat \tnoiseFr = 20.0;\n\n\n\n//out vec4 fragColor; \n\nvec3 camP = vec3(0.0,0.0,10.0);\n//camP = vec3(0.0,0.0,10.0);\n\n\n\n\n\n\nvec4 mod289(vec4 x){\n\tfloat a = 289.0;\n\treturn x - floor(x / a) * a;\n\t}\n\nfloat mod13(float x){\n\tfloat a = 130.0;\n\treturn x - floor(x / a) * a;\n\t}\n\t\nvec4 perm(vec4 x){return mod289(((x * 1.0) + 1.0) * x);}\n\nfloat rand(float n){return fract(sin(n) * 43758.5453123);}\n\n\nfloat noise(vec3 p){\n/**\n    vec3 a = floor(p);\n    vec3 d = p - a;\n    d = d * d * (3.0 - 2.0 * d);\n\n    vec4 b = a.xxyy + vec4(0.0, 1.0, 0.0, 1.0);\n    vec4 k1 = perm(b.xyxy);\n    vec4 k2 = perm(k1.xyxy + b.zzww);\n\n    vec4 c = k2 + a.zzzz;\n    vec4 k3 = perm(c);\n    vec4 k4 = perm(c + 1.0);\n\n    vec4 o1 = fract(k3 * (1.0 / 41.0));\n    vec4 o2 = fract(k4 * (1.0 / 41.0));\n\n    vec4 o3 = o2 * d.z + o1 * (1.0 - d.z);\n    vec2 o4 = o3.yw * d.x + o3.xz * (1.0 - d.x);\n\n    return o4.y * d.y + o4.x * (1.0 - d.y);*/\n\treturn abs((sin(p.x)+0.3*sin(p.x*0.13+21.0)+sin(p.y*0.3+13.0)+sin(p.z*1.0)+sin(p.z*7.0+11.0))/3.0)+0.01*rand(mod13(p.z));\n}\nfloat sdSphere( vec3 p, float s )\n{\n  return -length(p)+s;\n}\n\nfloat noiseSDF(vec3 samplePoint){\n\t\n\tnoiseH = 0.2*sin(time/300.0)+(2.0*mouse.y-1.0)*2.0+0.9;\n\tnoiseFr = 10.0*abs((2.0*mouse.x-1.0))+7.0;\n\treturn (samplePoint.y)+noise(vec3(samplePoint.x*noiseFr, 0.5,samplePoint.z*noiseFr))*noiseH+2.1;// + noise(vec3(samplePoint.x*noiseFr*2.0, 0.5,samplePoint.z*noiseFr*0.1))*noiseH*5.0+2.1;\n}\n\n\n\nfloat sceneSDF(vec3 p) {\n\tvec3 cubePoint = p + vec3(sin(time/190.0)*10.0, 0.0,  sin(time/100.0)*20.0);\n    float a = min( noiseSDF( cubePoint), noiseSDF(vec3( -cubePoint.x, -cubePoint.y,  cubePoint.z)));\n\treturn sdSphere(p,10.0)*(0.5-abs(max(mouse.y,mouse.x)-0.5))+a;\n     \n     \n}\n\n\n\n\nfloat shortestDistanceToSurface(vec3 eye, vec3 marchingDirection, float start, float end, float newStart) {\n    float depth = start;\n    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {\n        float dist = sceneSDF(eye + depth * marchingDirection);\n        if (dist < EPSILON) {\n        \n        \tif (depth < end){\n        \t\treturn depth;\n        \t\t}\n        \t\t\n        \telse{return depth;}\n        }\n        depth += dist;\n        //marchingDirection = vec3(1.0, 1.0, 1.0);\n        if (depth >= end) {\n            return end;\n        }\n        \n    }\n    return end;\n}\n\nfloat colorStep(vec3 eye, vec3 marchingDirection, float start, float end) {\n    float depth = start;\n    vec3 newMarchDir =  marchingDirection;\n    for (int i = 0; i < MAX_MARCHING_STEPS; i++) {\n    \t\n        float dist = sceneSDF(eye + depth * newMarchDir);\n        if (dist < EPSILON) {\n\t\t\treturn float(i);\n        }\n        depth += dist;\n        //newMarchDir += noise(eye + depth * newMarchDir)*0.0251;\n        //normalize(newMarchDir);\n        if (depth >= end) {\n            return float(MAX_MARCHING_STEPS);\n        }\n    }\n    return float(MAX_MARCHING_STEPS);\n}\n            \n\n\n \nvec3 rayDirection(float fieldOfView, vec2 size, vec2 fragCoord) {\n    vec2 xy = fragCoord - size / 2.0;\n    float z = size.y / tan(radians(fieldOfView) / 2.0);\n    return normalize(vec3(xy, -z));\n}\n\nmat4 viewMatrix(vec3 eye, vec3 center, vec3 up) {\n    // Based on gluLookAt man page\n    vec3 f = normalize(center - eye);\n    vec3 s = cross(f, up);\n    vec3 u = cross(s, f);\n    return mat4(\n        vec4(s, 0.0),\n        vec4(u, 0.0),\n        vec4(-f, 0.0),\n        vec4(0.0, 0.0, 0.0, 1.0)\n    );\n}\n\n\nvoid main()\n{\n\tvec2 uv = gl_FragCoord.xy;\n\tvec2 fragCoord = surfacePosition*0.5+0.5; //FOR WEBGL\n\t//vec2 fragCoord = vUV.st;\n\tfragCoord.x = fragCoord.x*resolution.x/resolution.y+((1.0-resolution.x/resolution.y)/2.0);\n\t// float d = 0.2;\n\t// if (fragCoord.x>0.5-d && fragCoord.x<0.5+d && fragCoord.y>0.5-d*resolution.y/resolution.x && fragCoord.y<0.5+d*resolution.y/resolution.x)  gl_FragColor = vec4(0.0);\n\t// else{\n\t\t\n\t\tvec3 viewDir = rayDirection(150.0, vec2(1.0,1.0), fragCoord);\n\t\tvec3 eye = camP;\n\t\teye.x = 10.0*(2.0*mouse.x-1.0);\n\t\teye.y = 2.0*(2.0*mouse.y-1.0)+0.7;\n\t\t \n\t\tmat4 viewToWorld = viewMatrix(eye, vec3(0.0,0.0,0.0), vec3(0.0, 1.0, 0.0));\n\t\t\n\t\tvec3 worldDir = (viewToWorld * vec4(viewDir, 0.0)).xyz;\n\t\tfloat color = colorStep(eye, worldDir, MIN_DIST, MAX_DIST);\n\t\t\n\t\tfloat dist = MAX_DIST;\n\t\tfloat freq = 0.7;\n\t\tif (abs(mouse.y-0.5) < 0.15) freq = (abs(mouse.y)-0.15) * 1000.0+0.7;\n\t\telse freq = 0.7;\n\t\t\n\t\tcolor = 35.0-color*4.0;\n\t\tif (dist > MAX_DIST - EPSILON) {\n\t\t\t// Didn't hit anything\n\t\t\tgl_FragColor = vec4(0.0, 0.0, 0.0, 1.0);\n\t\t\treturn;\n\t\t}\n\t\tcolor = color*0.045;\n\t\t//V1-----------\n\t\t//gl_FragColor = vec4(color, color, color, 1.0) * (rand(fragCoord.x*123.0*fragCoord.y*dist)*0.5+0.5)*sin(time*mouse.x*mouse.y*120.0);//(0.3+0.6*noise((eye + worldDir*dist)*12312.0));\n\t\t//V2---------\n\t\t\n\t\tvec4 cPrev = texture2D(backbuffer, gl_FragCoord.xy / resolution).xyzw;\n\t\t//gl_FragColor = vec4(color, color, color, 1.0) * (rand(fragCoord.x*123.0*fragCoord.y*dist)*0.5+0.5)*sin(time*freq+mouse.x*mouse.y*1200.0)+mouse.x*cPrev*0.95;\n\t\tgl_FragColor = vec4(color, color, color, 1.0) * (rand(fragCoord.x*123.0*fragCoord.y*dist)*0.5+0.5)*lfoJs;\n   \n\t\n\t\n\tgl_FragColor.a = 1.0;\n\n\t//gl_FragColor.x = mouse.x;\n\t//gl_FragColor.y = surfacePosition.y;\n    }\n\n//-------------------------------/GLSL CODE\n";
  const VERT = "attribute vec3 position;attribute vec2 surfacePosAttrib;varying vec2 surfacePosition;" +
    "void main(){surfacePosition=surfacePosAttrib;gl_Position=vec4(position,1.0);}";
  const root = window.SIGNAL_ROOT || "../";
  const cv = document.getElementById("field"), dot = document.getElementById("dot");
  // «Уменьшить движение» в системе раньше замораживал поле на одном кадре (так было у Кристины на Маке, 06.11).
  // Поле — это и есть айдентика, поэтому крутится всегда; вспышки включаются только по клику на точку.
  const fine = matchMedia("(pointer: fine)").matches;
  const clamp = v => v < 0 ? 0 : v > 1 ? 1 : v;
  let gl, U = {}, posBuf, surfBuf, aPos, aSurf;
  // Мышь: как на старом сайте, стартовая точка 0.3 / 0.1, но с плавным догоном
  const M = { x: .3, y: .1, tx: .3, ty: .1 };
  let phase = .2, lfo = .8, last = performance.now(), t0 = Date.now(), vel = 0, lastY = scrollY, on = false, snd_on = false;
  const snd = ["noiseA", "noiseB"].map(n => { const a = new Audio(root + "snd/" + n + ".mp3"); a.loop = true; a.preload = "none"; a.volume = 0; return a; });

  function init() {
    try { gl = cv.getContext("webgl", { antialias: false, alpha: false }) || cv.getContext("experimental-webgl"); } catch (e) {}
    if (!gl) return document.documentElement.classList.add("nofield");
    gl.getExtension("OES_standard_derivatives");
    const sh = (src, type) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) console.warn(gl.getShaderInfoLog(s)); return s; };
    const p = gl.createProgram();
    gl.attachShader(p, sh(VERT, gl.VERTEX_SHADER)); gl.attachShader(p, sh(FRAG, gl.FRAGMENT_SHADER)); gl.linkProgram(p);
    if (!gl.getProgramParameter(p, gl.LINK_STATUS)) { console.warn(gl.getProgramInfoLog(p)); gl = null; return document.documentElement.classList.add("nofield"); }
    gl.useProgram(p);
    ["time", "lfoJs", "mouse", "resolution", "EPSILON", "sound"].forEach(k => U[k] = gl.getUniformLocation(p, k));
    posBuf = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, posBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, -1, 1, 1, -1, 1]), gl.STATIC_DRAW);
    aPos = gl.getAttribLocation(p, "position"); aSurf = gl.getAttribLocation(p, "surfacePosAttrib");
    surfBuf = gl.createBuffer();
    resize(); addEventListener("resize", resize);
  }
  function resize() {
    // Не больше ~1,3 Мп: зерно шейдера и так крупное, а ноутбук не греется
    const k = Math.min(1, Math.sqrt(1.3e6 / (innerWidth * innerHeight)));
    cv.width = Math.round(innerWidth * k); cv.height = Math.round(innerHeight * k);
    gl.viewport(0, 0, cv.width, cv.height);
    const hw = .5 * innerWidth / innerHeight, hh = .5;
    gl.bindBuffer(gl.ARRAY_BUFFER, surfBuf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-hw, -hh, hw, -hh, -hw, hh, hw, -hh, hw, hh, -hw, hh]), gl.STATIC_DRAW);
  }
  function draw() {
    gl.uniform1f(U.time, (Date.now() - t0) / 1000); gl.uniform1f(U.lfoJs, on ? lfo : Math.abs(lfo));
    gl.uniform1f(U.sound, 0); gl.uniform1f(U.EPSILON, 0);
    gl.uniform2f(U.mouse, M.x, M.y); gl.uniform2f(U.resolution, cv.width, cv.height);
    gl.bindBuffer(gl.ARRAY_BUFFER, posBuf); gl.enableVertexAttribArray(aPos); gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);
    gl.bindBuffer(gl.ARRAY_BUFFER, surfBuf); gl.enableVertexAttribArray(aSurf); gl.vertexAttribPointer(aSurf, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 6);
  }
  function frame(now) {
    const dt = Math.min(100, now - last); last = now;
    const y = scrollY; vel = vel * .92 + Math.abs(y - lastY) / Math.max(dt, 1) * .08; lastY = y;
    let freq = .05 + Math.min(2.5, vel * 1.4);
    if (on) {  // старый сайт: у середины экрана частота растёт кубически, до 30 Гц
      freq = .05; const d = Math.abs(M.y - .5);
      if (d < .15) { const v = (.15 - d) / .15; freq = v * v * v * 30 + .05; }
    }
    phase = (phase + dt * freq / 1000) % 1; lfo = Math.sin(phase * Math.PI * 2);
    const ease = on ? .25 : .035; M.x += (M.tx - M.x) * ease; M.y += (M.ty - M.y) * ease;
    if (snd_on) {
      snd[0].volume = clamp(-lfo + .3); snd[1].volume = clamp(lfo + .3);
      dot.style.setProperty("--pulse", (.84 + .16 * Math.abs(lfo)).toFixed(3));
    }
    const home = document.body.dataset.page === "home";
    const base = home ? 1 - Math.min(1, scrollY / innerHeight) * .6 : .34;
    cv.style.opacity = on ? 1 : base.toFixed(3);
    document.documentElement.classList.toggle("top", home && scrollY < 40);
    if (gl && !document.hidden) draw();
    requestAnimationFrame(frame);
  }
  function sound(v) {
    snd_on = v; document.documentElement.classList.toggle("snd", v);
    if (v) snd.forEach(a => a.play().catch(() => {}));
    else { snd.forEach(a => a.pause()); dot.style.removeProperty("--pulse"); }
  }
  function toggle(v = !on) {
    on = v;
    document.documentElement.classList.toggle("sig", on);
    dot.setAttribute("aria-pressed", on); dot.dataset.tip = on ? "back to the site" : "start the signal";
    sound(on);
  }
  // Клик по полю без перетаскивания — звук вкл/выкл, как на старом сайте; касание и ведение пальцем — как мышь
  let down = null, drag = false;
  cv.addEventListener("pointerdown", e => { down = [e.clientX, e.clientY]; drag = false; });
  cv.addEventListener("pointermove", e => { if (!on) return; M.tx = e.clientX / innerWidth; M.ty = e.clientY / innerHeight;
    if (down && Math.hypot(e.clientX - down[0], e.clientY - down[1]) > 6) drag = true; });
  cv.addEventListener("pointerup", () => { if (on && down && !drag) sound(!snd_on); down = null; });
  cv.addEventListener("touchmove", e => { if (on) e.preventDefault(); }, { passive: false });
  addEventListener("keydown", e => { if (e.key === "Escape" && on) toggle(false); });
  if (fine) addEventListener("mousemove", e => { M.tx = e.clientX / innerWidth; M.ty = e.clientY / innerHeight; }, { passive: true });
  dot.dataset.tip = "start the signal";
  dot.addEventListener("click", () => toggle());
  document.addEventListener("click", e => { if (e.target.closest("[data-signal]")) { e.preventDefault(); toggle(); } });
  init();
  requestAnimationFrame(frame);
})();
