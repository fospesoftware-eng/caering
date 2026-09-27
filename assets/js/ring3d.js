/* =====================================================================
   CAERING — 3D engine (Three.js)
   Real product ring (flat wide band, glossy black, ECG plate, interior
   sensors) · sand-dune hero with wind · finish viewer
   ===================================================================== */

import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';

export const FINISHES = {
  midnight: {
    color: new THREE.Color(0x0b0b0e),
    metalness: 0.25, roughness: 0.06,
    clearcoat: 1.0, clearcoatRoughness: 0.04, envMapIntensity: 1.6,
  },
  gold: {
    color: new THREE.Color(0xd3a657),
    metalness: 1.0, roughness: 0.17,
    clearcoat: 0.55, clearcoatRoughness: 0.12, envMapIntensity: 1.4,
  },
  rose: {
    color: new THREE.Color(0xd9a48d),
    metalness: 1.0, roughness: 0.22,
    clearcoat: 0.5, clearcoatRoughness: 0.15, envMapIntensity: 1.35,
  },
  platinum: {
    color: new THREE.Color(0xdfe1e5),
    metalness: 1.0, roughness: 0.25,
    clearcoat: 0.45, clearcoatRoughness: 0.18, envMapIntensity: 1.3,
  },
};

/* ring dimensions — pixel-measured from the product studio render */
const Ro = 1.44;   // outer radius
const Ri = 1.03;   // inner radius
const BH = 0.69;   // band height (along ring axis)
const CO = 0.066;  // outer corner radius
const CI = 0.04;   // inner corner radius

/* ---------- capsule plate texture (brushed silver + engraved ECG) ----------
   texture x = arc length (capsule length), y = axial (capsule width) */
function makePlateTexture() {
  const W = 1024, H = 408;
  const c = document.createElement('canvas');
  c.width = W; c.height = H;
  const ctx = c.getContext('2d');

  // brushed silver base
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#c9c7c1');
  g.addColorStop(0.5, '#eeece5');
  g.addColorStop(1, '#b8b6b0');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);

  // fine axial brushing
  ctx.globalAlpha = 0.09;
  for (let i = 0; i < 260; i++) {
    ctx.strokeStyle = i % 2 ? '#fff' : '#000';
    ctx.beginPath();
    const y = Math.random() * H;
    ctx.moveTo(0, y); ctx.lineTo(W, y);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;

  // engraved waveform — two large ECG spikes with wavy sections
  const cy = H / 2;
  const A = H * 0.36;
  const pts = [
    [0.07, 0.10], [0.11, -0.14], [0.15, 0.05],
    [0.20, 1.05], [0.27, -0.85],
    [0.32, 0.30], [0.37, -0.30], [0.42, 0.22], [0.47, -0.18],
    [0.52, 0.02],
    [0.58, 0.98], [0.65, -0.9],
    [0.70, 0.22], [0.75, -0.28], [0.81, 0.14],
    [0.87, 0.0], [0.94, -0.05],
  ];
  ctx.strokeStyle = '#4a4a46';
  ctx.lineWidth = 9;
  ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.beginPath();
  pts.forEach(([px, py], i) => {
    const x = 40 + px * (W - 80), y = cy - py * A;
    i ? ctx.lineTo(x, y) : ctx.moveTo(x, y);
  });
  ctx.stroke();
  ctx.strokeStyle = 'rgba(255,255,255,.45)';
  ctx.lineWidth = 2.4;
  ctx.stroke();

  // pill capsule mask (semicircle ends along x)
  ctx.globalCompositeOperation = 'destination-in';
  const r = H / 2;
  ctx.beginPath();
  ctx.moveTo(r, 0);
  ctx.lineTo(W - r, 0);
  ctx.arc(W - r, r, r, -Math.PI / 2, Math.PI / 2);
  ctx.lineTo(r, H);
  ctx.arc(r, r, r, Math.PI / 2, -Math.PI / 2);
  ctx.closePath();
  ctx.fill();
  ctx.globalCompositeOperation = 'source-over';

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return tex;
}

/* ---------- black speaker texture (concentric rings, top of bore) ---------- */
function makeSpeakerBlackTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#101013';
  ctx.fillRect(0, 0, S, S);
  // concentric machined rings
  for (let r = 24; r < 116; r += 11) {
    ctx.beginPath();
    ctx.strokeStyle = r % 2 ? '#3c3c42' : '#232328';
    ctx.lineWidth = 5;
    ctx.arc(128, 128, r, 0, Math.PI * 2);
    ctx.stroke();
  }
  // dark center hole
  const g = ctx.createRadialGradient(128, 128, 2, 128, 128, 26);
  g.addColorStop(0, '#000'); g.addColorStop(1, '#1a1a1e');
  ctx.fillStyle = g;
  ctx.beginPath(); ctx.arc(128, 128, 26, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- silver speaker texture (bottom of bore, dark centre) ---------- */
function makeSpeakerSilverTexture() {
  const S = 256;
  const c = document.createElement('canvas');
  c.width = c.height = S;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(120, 112, 8, 128, 128, 128);
  g.addColorStop(0, '#f2f0ea'); g.addColorStop(0.6, '#c9c7c1'); g.addColorStop(1, '#8f8d88');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, S, S);
  // dark ring around a silver centre
  ctx.strokeStyle = '#1b1b1e';
  ctx.lineWidth = 15;
  ctx.beginPath(); ctx.arc(128, 128, 52, 0, Math.PI * 2); ctx.stroke();
  const cg = ctx.createRadialGradient(128, 128, 2, 128, 128, 38);
  cg.addColorStop(0, '#e8e6e0'); cg.addColorStop(1, '#a8a6a1');
  ctx.fillStyle = cg;
  ctx.beginPath(); ctx.arc(128, 128, 40, 0, Math.PI * 2); ctx.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/* ---------- interior label: open-C mark + "CÆRING" in one horizontal row ---------- */
function makeLabelTexture() {
  const c = document.createElement('canvas');
  c.width = 460; c.height = 170;
  const ctx = c.getContext('2d');
  ctx.clearRect(0, 0, 460, 170);

  // open-C mark, gap at lower-right with a small dot
  ctx.strokeStyle = '#e4e2dc';
  ctx.lineWidth = 9;
  ctx.beginPath();
  ctx.arc(78, 88, 42, Math.PI * 0.30, Math.PI * 1.85);
  ctx.stroke();
  ctx.fillStyle = '#e4e2dc';
  ctx.beginPath();
  ctx.arc(110, 114, 6.5, 0, Math.PI * 2);
  ctx.fill();

  // word
  ctx.font = '600 52px Outfit, sans-serif';
  ctx.fillStyle = '#e4e2dc';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText('CÆRING', 150, 92);

  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

/* ---------- soft dot (wind sand particles) ---------- */
function makeDotTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(32, 32, 2, 32, 32, 30);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(0.4, 'rgba(255,255,255,.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 64, 64);
  return new THREE.CanvasTexture(c);
}

/* ---------- gust streak texture ---------- */
function makeStreakTexture() {
  const c = document.createElement('canvas');
  c.width = 256; c.height = 32;
  const ctx = c.getContext('2d');
  const h = ctx.createLinearGradient(0, 0, 256, 0);
  h.addColorStop(0, 'rgba(255,255,255,0)');
  h.addColorStop(0.35, 'rgba(255,255,255,.7)');
  h.addColorStop(0.5, 'rgba(255,255,255,1)');
  h.addColorStop(0.65, 'rgba(255,255,255,.7)');
  h.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = h;
  ctx.fillRect(0, 0, 256, 32);
  const v = ctx.createLinearGradient(0, 0, 0, 32);
  v.addColorStop(0, 'rgba(0,0,0,0)');
  v.addColorStop(0.5, 'rgba(0,0,0,1)');
  v.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.globalCompositeOperation = 'destination-in';
  ctx.fillStyle = v;
  ctx.fillRect(0, 0, 256, 32);
  return new THREE.CanvasTexture(c);
}

/* =============================================================
   buildRealRing — product-accurate ring shared by both scenes
   lathe of a closed rounded-rectangle profile (flat wide band)
   ============================================================= */
function buildRealRing() {
  const group = new THREE.Group();

  /* ---- band: revolve a rounded cross-section ---- */
  const prof = [];
  const arc = (cx, cy, r, a0, a1, n) => {
    for (let i = 1; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n;
      prof.push(new THREE.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
    }
  };
  const h2 = BH / 2;
  prof.push(new THREE.Vector2(Ri + CI, h2));                       // inner top edge
  prof.push(new THREE.Vector2(Ro - CO, h2));                       // top face
  arc(Ro - CO, h2 - CO, CO, Math.PI / 2, 0, 6);                    // outer top corner
  arc(Ro - CO, -h2 + CO, CO, 0, -Math.PI / 2, 6);                  // outer wall → bottom corner
  prof.push(new THREE.Vector2(Ri + CI, -h2));                      // bottom face
  arc(Ri + CI, -h2 + CI, CI, -Math.PI / 2, -Math.PI, 5);           // inner bottom corner
  arc(Ri + CI, h2 - CI, CI, Math.PI, Math.PI / 2, 5);              // inner wall → close loop

  const bandMat = new THREE.MeshPhysicalMaterial({
    color: FINISHES.midnight.color,
    metalness: FINISHES.midnight.metalness,
    roughness: FINISHES.midnight.roughness,
    clearcoat: FINISHES.midnight.clearcoat,
    clearcoatRoughness: FINISHES.midnight.clearcoatRoughness,
    envMapIntensity: FINISHES.midnight.envMapIntensity,
    side: THREE.DoubleSide,
  });
  const band = new THREE.Mesh(new THREE.LatheGeometry(prof, 180), bandMat);
  group.add(band);

  /* ---- silver ECG capsule plate — outer wall, left flank ---- */
  const plateArcLen = 1.082;                        // arc span (62°)
  const plateThetaC = 1.289;                        // θl center (73.8°)
  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(Ro + 0.006, Ro + 0.006, 0.62, 30, 1, true,
      plateThetaC - plateArcLen / 2, plateArcLen),
    new THREE.MeshStandardMaterial({
      map: makePlateTexture(), metalness: 1.0, roughness: 0.34,
      transparent: true, alphaTest: 0.1, envMapIntensity: 1.3,
    })
  );
  group.add(plate);

  /* ---- empty bore: no interior objects ---- */

  /* ---- ambient gold dust (finish viewer only) ---- */
  const sparkCount = 70;
  const sparkPos = new Float32Array(sparkCount * 3);
  for (let i = 0; i < sparkCount; i++) {
    const a = Math.random() * Math.PI * 2;
    const d = Ro + 0.25 + Math.random() * 1.1;
    sparkPos[i * 3] = d * Math.cos(a);
    sparkPos[i * 3 + 1] = d * Math.sin(a);
    sparkPos[i * 3 + 2] = (Math.random() - 0.5) * 1.4;
  }
  const sparkGeo = new THREE.BufferGeometry();
  sparkGeo.setAttribute('position', new THREE.BufferAttribute(sparkPos, 3));
  const sparkMat = new THREE.PointsMaterial({
    color: 0xf0d39a, size: 0.035, transparent: true, opacity: 0.7,
    depthWrite: false, blending: THREE.AdditiveBlending,
  });
  const sparkles = new THREE.Points(sparkGeo, sparkMat);
  group.add(sparkles);

  return { group, band, bandMat, sparkles, sparkMat };
}

/* =============================================================
   createRingViewer — finish section viewer
   ============================================================= */
export function createRingViewer(canvas, options = {}) {
  const opts = Object.assign({
    cameraZ: 4.6,
    offsetX: 0,
    offsetY: 0,
    tilt: 0.52,
    autoSpeed: 0.25,
    enableDrag: true,
    fov: 36,
    oscillate: false,
    oscAmp: 0.5,
  }, options);

  let width = canvas.clientWidth || 300;
  let height = canvas.clientHeight || 300;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov, width / height, 0.1, 100);
  camera.position.set(0, 0, opts.cameraZ);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  const key = new THREE.DirectionalLight(0xfff2d8, 2.0);
  key.position.set(4, 5.5, 4);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xbfd4ff, 0.85);
  rim.position.set(-5, -2, -3);
  scene.add(rim);
  const warm = new THREE.PointLight(0xe9bd6f, 14, 20);
  warm.position.set(-2.5, 1.5, 2.5);
  scene.add(warm);

  const ring = buildRealRing();
  const group = ring.group;
  group.rotation.order = 'XYZ';
  group.position.set(opts.offsetX, opts.offsetY, 0);
  const baseTiltX = 2.45;                          // 3/4 studio elevation
  scene.add(group);

  const { bandMat, sparkles, sparkMat } = ring;

  /* interaction state */
  const pointer = { x: 0, y: 0 };
  const target = { px: 0, py: 0 };
  let dragSpin = 0;
  let spin = 0;
  let scrollSpin = 0;
  let isDown = false;
  let lastX = 0, lastY = 0;
  let visible = true;
  let currentFinish = 'midnight';
  let finishMix = 1;
  const finishState = { ...FINISHES.midnight, color: FINISHES.midnight.color.clone() };

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
    if (isDown) {
      dragSpin += (e.clientX - lastX) * 0.006;
      target.py = THREE.MathUtils.clamp(target.py + (e.clientY - lastY) * 0.004, -0.5, 0.5);
      lastX = e.clientX; lastY = e.clientY;
    }
  }
  function onPointerDown(e) {
    isDown = true; lastX = e.clientX; lastY = e.clientY;
    canvas.setPointerCapture?.(e.pointerId);
  }
  function onPointerUp() { isDown = false; }

  if (opts.enableDrag) {
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('pointerup', onPointerUp);
  } else {
    canvas.addEventListener('pointermove', onPointerMove);
  }

  function setParallax(nx, ny) { pointer.x = nx; pointer.y = ny; }

  function setFinish(name) {
    if (!FINISHES[name]) return;
    currentFinish = name;
    finishMix = 0;
  }

  function resize() {
    width = canvas.clientWidth || width;
    height = canvas.clientHeight || height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) clock.start();
  }, { threshold: 0.02 });
  io.observe(canvas);

  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    target.px += (pointer.x - target.px) * 0.05;
    target.py += ((pointer.y * 0.35) - target.py) * 0.05;

    dragSpin *= 0.93;
    let rotY;
    if (opts.oscillate) {
      spin += dragSpin * 8 * dt + scrollSpin * 0.0016;
      spin *= 0.96;
      rotY = Math.sin(t * opts.autoSpeed) * opts.oscAmp + spin;
    } else {
      spin += (opts.autoSpeed + dragSpin * 8) * dt + scrollSpin * 0.0016;
      rotY = spin;
    }
    scrollSpin *= 0.9;

    group.rotation.y = rotY + target.px * 0.32 + Math.sin(t * 0.4) * 0.05;
    group.rotation.x = baseTiltX - target.py * 0.6 + Math.cos(t * 0.3) * 0.03;
    group.rotation.z = Math.sin(t * 0.23) * 0.05;

    sparkles.rotation.z = t * 0.03;
    sparkMat.opacity = 0.45 + Math.sin(t * 1.6) * 0.25;

    if (finishMix < 1) {
      finishMix = Math.min(1, finishMix + dt * 1.6);
      const f = FINISHES[currentFinish];
      const e = 1 - Math.pow(1 - finishMix, 3);
      bandMat.color.copy(finishState.color).lerp(f.color, e);
      bandMat.metalness += (f.metalness - bandMat.metalness) * 0.12;
      bandMat.roughness += (f.roughness - bandMat.roughness) * 0.12;
      bandMat.clearcoat += (f.clearcoat - bandMat.clearcoat) * 0.12;
      bandMat.clearcoatRoughness += (f.clearcoatRoughness - bandMat.clearcoatRoughness) * 0.12;
      bandMat.envMapIntensity += (f.envMapIntensity - bandMat.envMapIntensity) * 0.12;
      if (finishMix >= 1) finishState.color.copy(f.color);
    }

    renderer.render(scene, camera);
  }
  tick();

  function addScrollSpin(delta) { scrollSpin += delta; }

  function dispose() {
    ro.disconnect(); io.disconnect();
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    renderer.dispose();
    band.geometry.dispose();
    bandMat.dispose();
  }

  return { setFinish, setParallax, addScrollSpin, resize, dispose };
}

/* =============================================================
   createDuneHero — desert dawn
   shader dune field with wind · blowing sand · gust streaks
   real ring rising from behind the dunes
   ============================================================= */

const NOISE_GLSL = /* glsl */`
  float hash21(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
  float vnoise(vec2 p){
    vec2 i = floor(p), f = fract(p);
    f = f*f*(3.0-2.0*f);
    float a = hash21(i), b = hash21(i+vec2(1.0,0.0)), c = hash21(i+vec2(0.0,1.0)), d = hash21(i+vec2(1.0,1.0));
    return mix(mix(a,b,f.x), mix(c,d,f.x), f.y);
  }
  float fbm(vec2 p){
    float v = 0.0, a = 0.5;
    for (int i = 0; i < 4; i++){ v += a*vnoise(p); p = p*2.13 + 11.7; a *= 0.5; }
    return v;
  }`;

/* ring pose in the dune scene */
const DUNE_RING_Y = 1.6;
const DUNE_RING_TILT = 2.410;    // α: solved from reference bore ellipse
const DUNE_RING_YAW = 1.571;     // φ
const DUNE_RING_ROLL = 1.571;    // γ: outer image-plane roll

export function createDuneHero(canvas, options = {}) {
  const opts = Object.assign({ fov: 34, cameraZ: 7.2, dark: false }, options);
  const isMobile = innerWidth <= 860;

  let width = canvas.clientWidth || window.innerWidth;
  let height = canvas.clientHeight || window.innerHeight;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance',
  });
  const pixRatio = Math.min(window.devicePixelRatio, 2);
  renderer.setPixelRatio(pixRatio);
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(opts.fov, width / height, 0.1, 100);
  const CAM_BASE = new THREE.Vector3(0, 2.08, opts.cameraZ);
  camera.position.copy(CAM_BASE);
  camera.lookAt(0, 1.5, 0);

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  /* lights for the glossy ring */
  const key = new THREE.DirectionalLight(0xfff0d6, 1.9);
  key.position.set(3.2, 4.4, 5);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xffd9a0, 1.4);
  rim.position.set(-4.5, 2.2, -4.5);
  scene.add(rim);
  const fill = new THREE.DirectionalLight(0xfff0d6, 0.7);
  fill.position.set(-1, 0.2, 8);
  scene.add(fill);

  /* ---------------- ring ---------------- */
  const ring = buildRealRing();
  const ringGroup = ring.group;
  ringGroup.rotation.order = 'XYZ';           // yaw then tilt (Euler XYZ)
  ringGroup.rotation.x = DUNE_RING_TILT;
  ringGroup.rotation.y = DUNE_RING_YAW;

  const group = new THREE.Group();            // outer group: image-plane roll + rise
  group.rotation.z = DUNE_RING_ROLL;
  group.position.y = DUNE_RING_Y - 4.2;       // starts buried under the sand
  group.add(ringGroup);
  scene.add(group);
  ring.sparkMat.opacity = 0;

  /* soft shadow pool on the sand */
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = shadowCanvas.height = 128;
  const sctx = shadowCanvas.getContext('2d');
  const sg = sctx.createRadialGradient(64, 64, 4, 64, 64, 62);
  sg.addColorStop(0, 'rgba(255,255,255,.9)');
  sg.addColorStop(0.5, 'rgba(255,255,255,.42)');
  sg.addColorStop(1, 'rgba(255,255,255,0)');
  sctx.fillStyle = sg;
  sctx.fillRect(0, 0, 128, 128);
  const shadowTex = new THREE.CanvasTexture(shadowCanvas);
  const shadowMat = new THREE.MeshBasicMaterial({
    map: shadowTex, color: 0x2a1a08, transparent: true, opacity: 0, depthWrite: false,
  });
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(5.4, 3.2), shadowMat);
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.set(0, 0.16, 0.2);
  scene.add(shadow);

  /* ---------------- dune field ---------------- */
  const duneUniforms = {
    uTime: { value: 0 },
    uSunDir: { value: new THREE.Vector3(0.42, 0.5, 0.76).normalize() },
    uCamPos: { value: new THREE.Vector3() },
    uSandLo: { value: new THREE.Color(0x7c5522) },
    uSandHi: { value: new THREE.Color(0xd9ae6b) },
    uSandLit: { value: new THREE.Color(0xf4e0b0) },
    uFog: { value: new THREE.Color(0xefd9ac) },
  };

  const duneMat = new THREE.ShaderMaterial({
    uniforms: duneUniforms,
    vertexShader: /* glsl */`
      uniform float uTime;
      varying vec3 vWp;
      varying vec3 vN;
      ${NOISE_GLSL}
      float duneH(vec2 p){
        float far = 1.0 - smoothstep(-9.0, -2.0, p.y);           // p.y = world z
        vec2 q = p * 0.115;
        float ridge = 1.0 - abs(fbm(q) * 2.0 - 1.0);
        float dunes = pow(ridge, 2.1) * 1.95 * far;
        float med = fbm(p * 0.3 + 4.7) * 0.3 * (0.55 + 0.45 * far);
        float rip = (sin(p.x * 2.6 + p.y * 0.75 + fbm(p * 0.55) * 4.0 - uTime * 0.9) * 0.045
                   + sin(p.x * 5.1 - p.y * 1.3 - uTime * 1.3) * 0.016) * (0.55 + 0.45 * far);
        return dunes + med + rip;
      }
      void main(){
        vec4 wp = modelMatrix * vec4(position, 1.0);
        float h = duneH(wp.xz);
        wp.y += h;
        float e = 0.35;
        float hx = duneH(wp.xz + vec2(e, 0.0));
        float hz = duneH(wp.xz + vec2(0.0, e));
        vN = normalize(vec3(h - hx, e, h - hz));
        vWp = wp.xyz;
        gl_Position = projectionMatrix * viewMatrix * wp;
      }`,
    fragmentShader: /* glsl */`
      uniform float uTime;
      uniform vec3 uSunDir;
      uniform vec3 uCamPos;
      uniform vec3 uSandLo;
      uniform vec3 uSandHi;
      uniform vec3 uSandLit;
      uniform vec3 uFog;
      varying vec3 vWp;
      varying vec3 vN;
      ${NOISE_GLSL}
      void main(){
        vec3 N = normalize(vN);
        vec3 L = normalize(uSunDir);
        float diff = max(dot(N, L), 0.0);
        vec3 sand = mix(uSandLo, uSandHi, diff);
        sand = mix(sand, uSandLit, pow(diff, 3.0) * 0.6);
        sand *= 0.92 + 0.08 * vnoise(vWp.xz * 40.0);                       // grain
        float crest = smoothstep(0.55, 1.8, vWp.y);
        sand += uSandLit * crest * 0.15;                                    // blested crests
        float gust = fbm(vec2(vWp.x * 0.22 - uTime * 0.5, vWp.z * 0.72));   // blowing sand streaks
        sand += uSandLit * gust * crest * 0.3;
        float d = distance(vWp, uCamPos);
        float fog = smoothstep(9.0, 30.0, d);
        vec3 col = mix(sand, uFog, fog);
        // fine wind ripples drifting across the near sand
        float nearFade = 1.0 - smoothstep(6.0, 18.0, d);
        col *= 1.0 + nearFade * 0.11 * sin(vWp.x * 6.5 + vWp.z * 2.2 + fbm(vWp.xz * 0.4) * 4.0 - uTime * 1.2);
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

  const dunes = new THREE.Mesh(new THREE.PlaneGeometry(90, 40, isMobile ? 120 : 200, isMobile ? 56 : 96), duneMat);
  dunes.rotation.x = -Math.PI / 2;
  dunes.position.set(0, 0, -8);
  scene.add(dunes);

  /* ---------------- wind particles (fine grains) ---------------- */
  function makeParticles(count, yMin, yMax, sMin, sMax, sizeMin, sizeMax, op) {
    const pos0 = new Float32Array(count * 3);
    const speed = new Float32Array(count);
    const size = new Float32Array(count);
    const phase = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      pos0[i * 3] = Math.random() * 46;
      pos0[i * 3 + 1] = yMin + Math.random() * (yMax - yMin);
      pos0[i * 3 + 2] = -20 + Math.random() * 26;
      speed[i] = sMin + Math.random() * (sMax - sMin);
      size[i] = sizeMin + Math.random() * (sizeMax - sizeMin);
      phase[i] = Math.random() * Math.PI * 2;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos0, 3)); // dummy, real pos from aPos0
    geo.setAttribute('aPos0', new THREE.BufferAttribute(pos0, 3));
    geo.setAttribute('aSpeed', new THREE.BufferAttribute(speed, 1));
    geo.setAttribute('aSize', new THREE.BufferAttribute(size, 1));
    geo.setAttribute('aPhase', new THREE.BufferAttribute(phase, 1));
    const mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false,
      uniforms: {
        uTime: { value: 0 },
        uPix: { value: pixRatio },
        uColor: { value: new THREE.Color(0xf7e6bd) },
        uOpacity: { value: op },
        uMap: { value: makeDotTexture() },
      },
      vertexShader: /* glsl */`
        attribute vec3 aPos0;
        attribute float aSpeed;
        attribute float aSize;
        attribute float aPhase;
        uniform float uTime;
        uniform float uPix;
        varying float vA;
        void main(){
          float x = mod(aPos0.x + uTime * aSpeed + 23.0, 46.0) - 23.0;
          vec3 p = vec3(x, aPos0.y + sin(uTime * 1.6 + aPhase) * 0.25, aPos0.z);
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          gl_PointSize = aSize * uPix * (16.0 / max(1.0, -mv.z));
          vA = smoothstep(23.0, 19.5, abs(x));
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */`
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform sampler2D uMap;
        varying float vA;
        void main(){
          float a = texture2D(uMap, gl_PointCoord).a * vA * uOpacity;
          if (a < 0.004) discard;
          gl_FragColor = vec4(uColor, a);
        }`,
    });
    const pts = new THREE.Points(geo, mat);
    pts.frustumCulled = false;
    scene.add(pts);
    return mat;
  }
  const grainMat = makeParticles(isMobile ? 420 : 760, -0.3, 2.1, 1.6, 4.6, 0.8, 2.2, 0.55);
  const veilMat = makeParticles(isMobile ? 34 : 60, 0.0, 1.4, 0.5, 1.4, 10, 22, 0.055);

  /* ---------------- gust streaks ---------------- */
  const streakTex = makeStreakTexture();
  const streaks = [];
  for (let i = 0; i < 8; i++) {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(2.4 + Math.random() * 1.8, 0.13 + Math.random() * 0.1),
      new THREE.MeshBasicMaterial({
        map: streakTex, transparent: true, opacity: 0, depthWrite: false,
        color: 0xfff3d8,
      })
    );
    m.userData = {
      speed: 5 + Math.random() * 4.5,
      y: -0.7 + Math.random() * 1.5,
      z: -13 + Math.random() * 17,
      w: 0.5 + Math.random() * 1.2,
      p: Math.random() * Math.PI * 2,
      base: 0.14 + Math.random() * 0.16,
    };
    m.rotation.z = (Math.random() - 0.5) * 0.12;
    scene.add(m);
    streaks.push(m);
  }

  /* ---------------- interaction ---------------- */
  const pointer = { x: 0, y: 0 };
  const target = { px: 0, py: 0 };
  let dragY = 0, dragTilt = 0;
  let isDown = false, lastX = 0, lastY = 0;
  let visible = true;
  let rise = 0;

  function onPointerMove(ev) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((ev.clientY - rect.top) / rect.height) * 2 - 1;
    if (isDown) {
      dragY += (ev.clientX - lastX) * 0.006;
      dragTilt += (ev.clientY - lastY) * 0.003;
      dragTilt = THREE.MathUtils.clamp(dragTilt, -0.3, 0.3);
      lastX = ev.clientX; lastY = ev.clientY;
    }
  }
  function onPointerDown(ev) {
    isDown = true; lastX = ev.clientX; lastY = ev.clientY;
    canvas.setPointerCapture?.(ev.pointerId);
  }
  function onPointerUp() { isDown = false; }
  canvas.addEventListener('pointermove', onPointerMove);
  canvas.addEventListener('pointerdown', onPointerDown);
  window.addEventListener('pointerup', onPointerUp);

  function setParallax(nx, ny) { pointer.x = nx; pointer.y = ny; }

  /* ---------------- theme ---------------- */
  const PALETTES = {
    light: {
      lo: 0x7c5522, hi: 0xd9ae6b, lit: 0xf4e0b0, fog: 0xefd9ac,
      grain: 0xf7e6bd, grainOp: 0.5, veil: 0xfff2d2, veilOp: 0.05,
      streak: 0xfff3d8, streakOp: 0.16, shadow: 0x2a1a08,
      key: [0xfff0d6, 1.9], rim: [0xffd9a0, 1.4], fill: [0xfff0d6, 0.7], exposure: 1.12,
    },
    dark: {
      lo: 0x191007, hi: 0x4d3418, lit: 0x7a5726, fog: 0x241a10,
      grain: 0xcaa15e, grainOp: 0.3, veil: 0x8a5f2c, veilOp: 0.06,
      streak: 0xcaa15e, streakOp: 0.1, shadow: 0x000000,
      key: [0xffe2b8, 1.2], rim: [0xd8a24b, 1.1], fill: [0xffe2b8, 0.4], exposure: 1.0,
    },
  };

  function setTheme(dark) {
    const p = PALETTES[dark ? 'dark' : 'light'];

    duneUniforms.uSandLo.value.setHex(p.lo);
    duneUniforms.uSandHi.value.setHex(p.hi);
    duneUniforms.uSandLit.value.setHex(p.lit);
    duneUniforms.uFog.value.setHex(p.fog);
    grainMat.uniforms.uColor.value.setHex(p.grain);
    grainMat.uniforms.uOpacity.value = p.grainOp;
    veilMat.uniforms.uColor.value.setHex(p.veil);
    veilMat.uniforms.uOpacity.value = p.veilOp;
    streaks.forEach((s) => { s.material.color.setHex(p.streak); });
    shadowMat.color.setHex(p.shadow);
    key.color.setHex(p.key[0]); key.intensity = p.key[1];
    rim.color.setHex(p.rim[0]); rim.intensity = p.rim[1];
    fill.color.setHex(p.fill[0]); fill.intensity = p.fill[1];
    renderer.toneMappingExposure = p.exposure;
  }
  setTheme(opts.dark);

  /* ---------------- resize ---------------- */
  function resize() {
    width = canvas.clientWidth || width;
    height = canvas.clientHeight || height;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible) clock.start();
  }, { threshold: 0.02 });
  io.observe(canvas);

  /* ---------------- loop ---------------- */
  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    // rise from beneath the dunes
    if (rise < 1) {
      rise = Math.min(1, rise + dt / 2.8);
      const e = 1 - Math.pow(1 - rise, 4);
      group.position.y = DUNE_RING_Y - 4.2 * (1 - e);
    } else {
      group.position.y = DUNE_RING_Y + Math.sin(t * 0.5) * 0.055;
    }

    // shadow breathes with the bob
    shadowMat.opacity = rise * (0.24 - Math.sin(t * 0.5) * 0.04);

    // drag eases back, ring sways
    dragY *= 0.94; dragTilt *= 0.94;
    ringGroup.rotation.y = DUNE_RING_YAW + Math.sin(t * 0.28) * 0.2 + dragY + target.px * 0.14;
    ringGroup.rotation.x = DUNE_RING_TILT + dragTilt + Math.sin(t * 0.22) * 0.045 - target.py * 0.1;
    group.rotation.z = DUNE_RING_ROLL + Math.sin(t * 0.19) * 0.03;

    // camera parallax
    target.px += (pointer.x - target.px) * 0.05;
    target.py += (pointer.y * 0.5 - target.py) * 0.05;
    camera.position.x += (CAM_BASE.x + target.px * 0.3 - camera.position.x) * 0.04;
    camera.position.y += (CAM_BASE.y - target.py * 0.22 - camera.position.y) * 0.04;
    camera.lookAt(0, 1.52, 0);

    // wind
    duneUniforms.uTime.value = t;
    duneUniforms.uCamPos.value.copy(camera.position);
    grainMat.uniforms.uTime.value = t;
    veilMat.uniforms.uTime.value = t;
    streaks.forEach((s) => {
      const u = s.userData;
      s.position.x = ((s.position.x + u.speed * dt + 20) % 40) - 20;
      s.position.y = u.y + Math.sin(t * 0.7 + u.p) * 0.15;
      s.position.z = u.z;
      s.material.opacity = u.base * (0.45 + 0.55 * Math.sin(t * u.w + u.p)) * rise;
    });

    renderer.render(scene, camera);
  }
  tick();

  function dispose() {
    ro.disconnect(); io.disconnect();
    canvas.removeEventListener('pointermove', onPointerMove);
    canvas.removeEventListener('pointerdown', onPointerDown);
    window.removeEventListener('pointerup', onPointerUp);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    renderer.dispose();
  }

  return { setParallax, setTheme, resize, dispose };
}

/* =============================================================
   createTechExploded — Technology section
   Exploded assembly built around the exact CAERING ring:
   glass shells · outer shell arc · flex PCB · the ring itself
   (buildRealRing, unchanged) · battery cell · chip stack ·
   inner chassis — floating in a dark void with a distant ridge.
   ============================================================= */
export function createTechExploded(canvas, options = {}) {
  let width = canvas.clientWidth || 1200;
  let height = canvas.clientHeight || 800;
  let isMobile = width < 860;

  const renderer = new THREE.WebGLRenderer({
    canvas, antialias: true, alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  renderer.setSize(width, height, false);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(isMobile ? 40 : 30, width / height, 0.1, 100);
  const CAM_Z = () => (isMobile ? 15.2 : 12.4);
  camera.position.set(0, 0.35, CAM_Z());

  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  pmrem.dispose();

  /* lights */
  const key = new THREE.DirectionalLight(0xffffff, 2.1);
  key.position.set(5, 6, 5);
  scene.add(key);
  const rimL = new THREE.DirectionalLight(0x8fb4e0, 1.25);
  rimL.position.set(-6, 2.5, -4);
  scene.add(rimL);
  const fill = new THREE.DirectionalLight(0xfff0d8, 0.55);
  fill.position.set(-3, -3, 4);
  scene.add(fill);

  const asm = new THREE.Group();
  asm.rotation.x = 1.85;                       // common tilt for every ring
  scene.add(asm);

  /* ---------------- textures ---------------- */
  function ridgeTexture() {
    const W = 2048, H = 900;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const ridge = (baseY, amp, color, step) => {
      x.fillStyle = color;
      x.beginPath(); x.moveTo(0, H); x.lineTo(0, baseY);
      let y = baseY;
      for (let px = 0; px <= W; px += step) {
        y += (Math.random() - 0.5) * amp;
        y = Math.min(baseY + amp * 1.4, Math.max(baseY - amp * 1.9, y));
        x.lineTo(px, y);
      }
      x.lineTo(W, H); x.closePath(); x.fill();
    };
    ridge(H * 0.68, 78, 'rgba(25,25,31,0.7)', 62);
    ridge(H * 0.76, 60, 'rgba(18,18,23,0.9)', 48);
    ridge(H * 0.86, 46, 'rgba(10,10,13,1)', 34);
    const g = x.createLinearGradient(0, H * 0.62, 0, H * 0.8);
    g.addColorStop(0, 'rgba(130,130,150,0)');
    g.addColorStop(0.5, 'rgba(130,130,150,0.03)');
    g.addColorStop(1, 'rgba(130,130,150,0)');
    x.fillStyle = g; x.fillRect(0, H * 0.58, W, H * 0.3);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  function flexTexture() {
    const W = 1024, H = 256;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    const g = x.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, '#1a3b67'); g.addColorStop(0.5, '#12294a'); g.addColorStop(1, '#0c1e38');
    x.fillStyle = g; x.fillRect(0, 0, W, H);
    x.lineCap = 'round';
    for (let i = 0; i < 16; i++) {
      x.strokeStyle = 'rgba(86,138,200,0.55)';
      x.lineWidth = 2;
      const y = 24 + Math.random() * (H - 48);
      x.beginPath(); x.moveTo(10, y);
      let px = 10;
      while (px < W - 60) {
        const nx = px + 60 + Math.random() * 120;
        if (Math.random() > 0.5) x.lineTo(nx, y);
        else { x.lineTo(px + 26, y); x.lineTo(px + 26, y + (Math.random() > 0.5 ? 22 : -22)); x.lineTo(nx, y + (Math.random() > 0.5 ? 22 : -22)); }
        px = nx;
      }
      x.lineTo(W - 10, y); x.stroke();
    }
    for (let i = 0; i < 26; i++) {
      x.fillStyle = '#caa24e';
      const px = 30 + Math.random() * (W - 60), py = 18 + Math.random() * (H - 36);
      x.fillRect(px, py, 10, 10);
    }
    for (let i = 0; i < 4; i++) {
      const px = 120 + i * 230, py = 70 + (i % 2) * 60;
      x.fillStyle = '#0a0d13'; x.fillRect(px, py, 74, 48);
      x.fillStyle = 'rgba(255,255,255,0.5)';
      x.font = '9px sans-serif';
      x.fillText('MCU', px + 8, py + 16);
    }
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }
  function chipTexture() {
    const S = 512;
    const c = document.createElement('canvas');
    c.width = c.height = S;
    const x = c.getContext('2d');
    x.fillStyle = '#13251d'; x.fillRect(0, 0, S, S);
    x.strokeStyle = 'rgba(90,180,140,0.4)'; x.lineWidth = 3;
    for (let i = 0; i < 9; i++) {
      x.beginPath(); x.moveTo(20, 60 + i * 44); x.lineTo(S - 20, 60 + i * 44); x.stroke();
    }
    const pad = (px, py) => { x.fillStyle = '#caa24e'; x.fillRect(px, py, 26, 14); };
    for (let i = 0; i < 11; i++) { pad(40 + i * 40, 8); pad(40 + i * 40, S - 22); pad(8, 40 + i * 40); pad(S - 34, 40 + i * 40); }
    x.fillStyle = '#0a0d11';
    x.beginPath(); x.roundRect(166, 166, 180, 180, 14); x.fill();
    x.fillStyle = 'rgba(255,255,255,0.35)';
    x.font = '16px sans-serif'; x.textAlign = 'center';
    x.fillText('SENSOR', S / 2, 240);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }
  function chassisTexture() {
    const W = 2048, H = 512;
    const c = document.createElement('canvas');
    c.width = W; c.height = H;
    const x = c.getContext('2d');
    // band base with feathered top/bottom edges
    x.beginPath(); x.roundRect(0, 44, W, H - 88, 26); x.fillStyle = '#c9cbd1'; x.fill();
    const g = x.createLinearGradient(0, 44, 0, H - 44);
    g.addColorStop(0, '#e3e5ea'); g.addColorStop(0.45, '#c2c4ca'); g.addColorStop(1, '#8f9198');
    x.fillStyle = g; x.fill();
    x.globalAlpha = 0.08;
    for (let i = 0; i < 300; i++) {
      x.strokeStyle = i % 2 ? '#fff' : '#000';
      const y = 50 + Math.random() * (H - 100);
      x.beginPath(); x.moveTo(0, y); x.lineTo(W, y); x.stroke();
    }
    x.globalAlpha = 1;
    // rectangular slots — two rows (destination-out)
    x.globalCompositeOperation = 'destination-out';
    const rows = [150, 362];
    rows.forEach((ry, r) => {
      for (let i = 0; i < 16; i++) {
        const px = i * 128 + (r ? 64 : 0) + 30;
        x.beginPath(); x.roundRect(px, ry - 52, 74, 104, 10); x.fill();
      }
    });
    x.globalCompositeOperation = 'source-over';
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 8;
    return tex;
  }

  /* ---------------- distant ridge ---------------- */
  const backdrop = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 19),
    new THREE.MeshBasicMaterial({ map: ridgeTexture(), transparent: true, depthWrite: false })
  );
  backdrop.position.set(0, -3.2, -6);
  scene.add(backdrop);

  /* ---------------- component builders ---------------- */
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xdce6ee, metalness: 0, roughness: 0.04,
    transmission: 0.92, thickness: 0.04, ior: 1.45,
    transparent: true, opacity: 0.42,
    envMapIntensity: 2.3, clearcoat: 1, clearcoatRoughness: 0.05,
    side: THREE.DoubleSide, depthWrite: false,
  });
  const thinBand = (radius, radial, axH) => {
    const p = [
      new THREE.Vector2(radius - radial, -axH / 2),
      new THREE.Vector2(radius, -axH / 2),
      new THREE.Vector2(radius, axH / 2),
      new THREE.Vector2(radius - radial, axH / 2),
    ];
    return new THREE.Mesh(new THREE.LatheGeometry(p, 128), glassMat);
  };

  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0x131318, metalness: 0.5, roughness: 0.24,
    clearcoat: 1, clearcoatRoughness: 0.1, envMapIntensity: 1.5,
    side: THREE.DoubleSide,
  });
  const flexMat = new THREE.MeshStandardMaterial({
    map: flexTexture(), roughness: 0.55, metalness: 0.25,
    side: THREE.DoubleSide, envMapIntensity: 0.8,
  });
  const batteryMat = new THREE.MeshPhysicalMaterial({
    color: 0x101014, metalness: 0.35, roughness: 0.42,
    clearcoat: 0.6, clearcoatRoughness: 0.2,
  });
  const chipMat = new THREE.MeshStandardMaterial({
    map: chipTexture(), roughness: 0.5, metalness: 0.3,
  });
  const chassisMat = new THREE.MeshStandardMaterial({
    map: chassisTexture(), metalness: 1, roughness: 0.3,
    transparent: true, alphaTest: 0.35,
    side: THREE.DoubleSide, envMapIntensity: 1.4,
  });

  function makeGlassPair() {
    const g = new THREE.Group();
    const a = thinBand(Ro, 0.035, 0.13);
    const b = thinBand(Ro - 0.07, 0.03, 0.11);
    a.rotation.y = 0.3; b.rotation.y = -0.5;
    b.position.y = 0.14;
    g.add(a, b);
    return g;
  }
  function makeShell() {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(Ro - 0.02, Ro - 0.02, BH * 0.9, 80, 1, true, 1.0, 3.4),
      shellMat
    );
  }
  function makeFlex() {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(1.22, 1.22, 0.56, 96, 1, true, 0.3, 2.7),
      flexMat
    );
  }
  function makeBattery() {
    const g = new THREE.Group();
    const cell = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 0.62, 80), batteryMat);
    g.add(cell);
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x2c2c33, metalness: 0.8, roughness: 0.3 });
    [0.31, -0.31].forEach((y) => {
      const t = new THREE.Mesh(new THREE.TorusGeometry(0.9, 0.018, 12, 80), ringMat);
      t.rotation.x = Math.PI / 2; t.position.y = y;
      g.add(t);
    });
    return g;
  }
  function makeChips() {
    const g = new THREE.Group();
    const strip = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 1.35, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x111116, metalness: 0.6, roughness: 0.4 })
    );
    g.add(strip);
    [-0.42, 0, 0.42].forEach((y, i) => {
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.34, 0.05), chipMat);
      board.position.set(0, y, 0.03);
      board.rotation.z = (i - 1) * 0.07;
      g.add(board);
    });
    return g;
  }
  function makeChassis() {
    return new THREE.Mesh(
      new THREE.CylinderGeometry(1.12, 1.12, 0.68, 128, 1, true, 0.4, 4.2),
      chassisMat
    );
  }

  /* ---------------- assembly layout ----------------
     slot = desktop x position; pieces nest at CAERING radii
     when "assembled" (glass/shell Ro · flex mid · battery/
     chips/chassis inside Ri). */
  const realRing = buildRealRing();
  realRing.sparkMat.opacity = 0;            // no ambient dust here

  const defs = [
    { obj: makeGlassPair(), slot: -4.25, y: -0.02, s: 0.95, jx: 0.08, jy: 0.22, jz: -0.12, d: -1 },
    { obj: makeShell(),     slot: -2.75, y: 0.36,  s: 1.0,  jx: 0,    jy: 0.3,  jz: -0.18, d: 1 },
    { obj: makeFlex(),      slot: -1.35, y: -0.3,  s: 1.0,  jx: 0.18, jy: -0.2, jz: 0.28,  d: -1 },
    { obj: realRing.group,  slot: 0.15,  y: 0.06,  s: 1.04, jx: 0,    jy: 0.5,  jz: 0.04,  d: 1 },
    { obj: makeBattery(),   slot: 1.55,  y: 0.3,   s: 0.98, jx: 0.05, jy: 1.0,  jz: -0.1,  d: -1 },
    { obj: makeChips(),     slot: 2.85,  y: 0.1,   s: 1.0,  jx: 0,    jy: -0.18, jz: -0.12, d: 1 },
    { obj: makeChassis(),   slot: 4.2,   y: 0.18,  s: 1.02, jx: 0,    jy: 0.7,  jz: 0.12,  d: -1 },
  ];

  const holders = defs.map((d, i) => {
    const h = new THREE.Group();
    h.add(d.obj);
    h.rotation.set(d.jx, d.jy, d.jz);
    h.userData = {
      slot: d.slot, baseY: d.y, scale: d.s, dir: d.d,
      phase: Math.random() * Math.PI * 2,
      freq: 0.5 + Math.random() * 0.5,
      delay: i * 0.07,
    };
    asm.add(h);
    return h;
  });

  function layout() {
    const aspect = width / height;
    const spread = THREE.MathUtils.clamp(0.5 + aspect * 0.31, 0.62, 1.05);
    const yComp = isMobile ? 0.72 : 1.0;
    holders.forEach((h) => {
      const u = h.userData;
      h.userData._spread = spread;
      h.position.x = u.slot * spread;
      h.userData._layY = u.baseY * yComp;
    });
    camera.fov = isMobile ? 40 : 30;
    camera.updateProjectionMatrix();
  }
  layout();

  /* ---------------- state ---------------- */
  const pointer = { x: 0, y: 0 };
  const target = { px: 0, py: 0 };
  let intro = 0;
  let visible = false;
  let started = false;

  function onPointerMove(e) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = ((e.clientY - rect.top) / rect.height) * 2 - 1;
  }
  canvas.addEventListener('pointermove', onPointerMove);

  function resize() {
    width = canvas.clientWidth || width;
    height = canvas.clientHeight || height;
    isMobile = width < 860;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    layout();
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  const io = new IntersectionObserver((entries) => {
    visible = entries[0].isIntersecting;
    if (visible && !started) { started = true; }
    if (visible) clock.start();
  }, { threshold: 0.12 });
  io.observe(canvas);

  const clock = new THREE.Clock();

  function tick() {
    requestAnimationFrame(tick);
    if (!visible) return;
    const dt = Math.min(clock.getDelta(), 0.05);
    const t = clock.elapsedTime;

    if (started && intro < 1) intro = Math.min(1, intro + dt / 1.5);

    const ease = (x) => 1 - Math.pow(1 - x, 3);
    holders.forEach((h) => {
      const u = h.userData;
      const ip = started ? ease(Math.max(0, Math.min(1, (intro - u.delay) / (1 - u.delay)))) : 0;
      h.position.x = u.slot * (isMobile ? 0.6 : 1.0) * (1 + 0.55 * (1 - ip));
      const layY = u._layY;
      const bob = Math.sin(t * u.freq + u.phase) * 0.045;
      h.position.y = layY + bob + u.dir * 0.85 * (1 - ip);
      h.scale.setScalar(u.scale * (0.62 + 0.38 * ip));
      h.rotation.z += Math.sin(t * 0.3 + u.phase) * 0.0006;
    });

    target.px += (pointer.x - target.px) * 0.05;
    target.py += (pointer.y - target.py) * 0.05;
    camera.position.x += (target.px * 0.55 - camera.position.x) * 0.04;
    camera.position.y += ((isMobile ? 0.3 : 0.35) - target.py * 0.3 - camera.position.y) * 0.04;
    camera.position.z += (CAM_Z() - camera.position.z) * 0.04;
    asm.rotation.y = target.px * 0.07;
    camera.lookAt(0, 0.1, 0);

    renderer.render(scene, camera);
  }
  tick();

  function setParallax(nx, ny) { pointer.x = nx; pointer.y = ny; }

  function dispose() {
    ro.disconnect(); io.disconnect();
    canvas.removeEventListener('pointermove', onPointerMove);
    scene.traverse((o) => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) {
        const mats = Array.isArray(o.material) ? o.material : [o.material];
        mats.forEach((m) => m.dispose());
      }
    });
    renderer.dispose();
  }

  return { setParallax, resize, dispose };
}
