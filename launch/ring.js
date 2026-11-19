/* =====================================================================
   CAERING — launch ring renderer
   A real 3D band (surface of revolution) projected and shaded on a 2D
   canvas: perspective, per-face lighting, occlusion, studio reflection
   sweep. No libraries, no network — works offline from file://
   ===================================================================== */
(function () {
  'use strict';

  var TAU = Math.PI * 2;

  /* ---- product geometry (same proportions as the real band) ---- */
  var RO = 1.44;   // outer radius
  var RI = 1.03;   // inner radius
  var HH = 0.345;  // half band height

  /* ---- capsule plate (silver ECG inlay) ---- */
  var CAP_A = -0.60;
  var CAP_B = 0.48;
  var CAP_H = 0.295;

  var GOLD = {
    base: [1.00, 0.67, 0.22],
    hi: [1.00, 0.95, 0.80],
    spec: 1.45,
    shine: 46,
    fill: 1.0,
  };

  var GOLD_FACE = {
    base: [0.80, 0.53, 0.18],
    hi: [1.00, 0.95, 0.82],
    spec: 0.85,
    shine: 26,
    fill: 1.0,
  };

  var GOLD_BEVEL = {
    base: [1.00, 0.80, 0.40],
    hi: [1.00, 0.98, 0.90],
    spec: 1.60,
    shine: 56,
    fill: 1.0,
  };

  var SILVER = {
    base: [0.70, 0.70, 0.67],
    hi: [1.00, 0.99, 0.95],
    spec: 1.45,
    shine: 52,
    fill: 0.8,
  };

  /* ECG trace (u along the capsule, v across it) */
  var ECG = [
    [0.07, 0.10], [0.11, -0.14], [0.15, 0.05],
    [0.20, 1.05], [0.27, -0.85],
    [0.32, 0.30], [0.37, -0.30], [0.42, 0.22], [0.47, -0.18],
    [0.52, 0.02],
    [0.58, 0.98], [0.65, -0.90],
    [0.70, 0.22], [0.75, -0.28], [0.81, 0.14],
    [0.87, 0.00], [0.94, -0.05],
  ];

  /* ---- vector helpers ---- */
  function norm(v) {
    var l = Math.hypot(v[0], v[1], v[2]) || 1;
    return [v[0] / l, v[1] / l, v[2] / l];
  }
  function dot(a, b) { return a[0] * b[0] + a[1] * b[1] + a[2] * b[2]; }
  function clamp01(x) { return x < 0 ? 0 : x > 1 ? 1 : x; }
  function smooth(e0, e1, x) {
    var t = clamp01((x - e0) / (e1 - e0));
    return t * t * (3 - 2 * t);
  }
  function rotY(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }
  function rotX(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }
  function rotZ(p, a) {
    var c = Math.cos(a), s = Math.sin(a);
    return [p[0] * c - p[1] * s, p[0] * s + p[1] * c, p[2]];
  }

  /* ---- lighting rig ---- */
  var KEY = norm([-0.34, 0.56, 0.76]);     // warm overhead key
  var FILL = norm([0.74, -0.30, 0.58]);    // low warm fill
  var RIM = norm([0.16, -0.52, -0.84]);    // cool back rim
  var VIEW = [0, 0, 1];
  var HALF = norm([KEY[0] + VIEW[0], KEY[1] + VIEW[1], KEY[2] + VIEW[2]]);

  // filmic-ish tone curve so highlights roll off instead of clipping
  function tone(x) {
    if (x < 0) x = 0;
    var v = x / (1 + x * 0.92);
    return Math.pow(v, 0.95);
  }

  /* sweep: a moving band of studio light reflected in the metal (-1..1) */
  function shade(n, mat, sweep) {
    var lamK = Math.max(dot(n, KEY), 0);
    var lamF = Math.max(dot(n, FILL), 0);
    var rim = Math.max(dot(n, RIM), 0);

    // reflected view ray: r = 2(n·v)n - v,  v = (0,0,1)
    var d2 = 2 * n[2];
    var rx = d2 * n[0];
    var ry = d2 * n[1];
    var rz = d2 * n[2] - 1;

    // studio environment: soft overhead box + horizon glow
    var env = 0.14
      + 1.02 * smooth(0.10, 0.86, ry)
      + 0.22 * smooth(-0.35, 0.35, ry);

    // the travelling light band
    var band = Math.exp(-Math.pow((rx - sweep) * 2.7, 2)) * smooth(-0.1, 0.45, ry);
    // secondary static strip on the opposite flank
    var strip = Math.exp(-Math.pow((rx + 0.74) * 4.6, 2)) * smooth(0.05, 0.7, ry);

    var spec = Math.pow(Math.max(dot(n, HALF), 0), mat.shine);
    var fres = Math.pow(1 - Math.max(dot(n, VIEW), 0), 3);

    var b = mat.base, h = mat.hi;

    var lit = 0.16 + 0.86 * lamK + 0.26 * lamF * mat.fill;

    var cr = b[0] * lit * env + h[0] * spec * mat.spec + band * 0.34 + strip * 0.10;
    var cg = b[1] * lit * env + h[1] * spec * mat.spec + band * 0.27 + strip * 0.085;
    var cb = b[2] * lit * env + h[2] * spec * mat.spec + band * 0.16 + strip * 0.06;

    // cool fresnel edge + plum back rim
    cr += 0.075 * fres + 0.10 * rim;
    cg += 0.115 * fres + 0.10 * rim;
    cb += 0.145 * fres + 0.13 * rim;

    return 'rgb(' +
      Math.round(tone(cr) * 255) + ',' +
      Math.round(tone(cg) * 255) + ',' +
      Math.round(tone(cb) * 255) + ')';
  }

  /* ---- static face list (model space) ---- */
  function buildFaces() {
    var faces = [];
    var N = 150;

    function quad(a, b, c, d, n, mat, kind) {
      faces.push({ p: [a, b, c, d], n: n, mat: mat, kind: kind });
    }

    var BW = 0.052;   // chamfer width on the top edge

    for (var i = 0; i < N; i++) {
      var t0 = (i / N) * TAU;
      var t1 = ((i + 1) / N) * TAU;
      var tm = (t0 + t1) / 2;
      var c0 = Math.cos(t0), s0 = Math.sin(t0);
      var c1 = Math.cos(t1), s1 = Math.sin(t1);
      var cm = Math.cos(tm), sm = Math.sin(tm);

      // outer wall — the polished face of the band
      quad([RO * c0, -HH, RO * s0], [RO * c1, -HH, RO * s1],
           [RO * c1, HH - BW, RO * s1], [RO * c0, HH - BW, RO * s0],
           [cm, 0, sm], GOLD, 'wall');

      // outer chamfer — catches the key light as a fine bright rim
      quad([RO * c0, HH - BW, RO * s0], [RO * c1, HH - BW, RO * s1],
           [(RO - BW) * c1, HH, (RO - BW) * s1], [(RO - BW) * c0, HH, (RO - BW) * s0],
           norm([cm * 0.78, 0.72, sm * 0.78]), GOLD_BEVEL, 'bevel');

      // inner chamfer
      quad([(RI + BW) * c0, HH, (RI + BW) * s0], [(RI + BW) * c1, HH, (RI + BW) * s1],
           [RI * c1, HH - BW, RI * s1], [RI * c0, HH - BW, RI * s0],
           norm([-cm * 0.78, 0.72, -sm * 0.78]), GOLD_BEVEL, 'bevel');

      // flat top
      quad([(RI + BW) * c0, HH, (RI + BW) * s0], [(RO - BW) * c0, HH, (RO - BW) * s0],
           [(RO - BW) * c1, HH, (RO - BW) * s1], [(RI + BW) * c1, HH, (RI + BW) * s1],
           [0, 1, 0], GOLD_FACE, 'top');

      // inner wall
      quad([RI * c0, -HH, RI * s0], [RI * c0, HH - BW, RI * s0],
           [RI * c1, HH - BW, RI * s1], [RI * c1, -HH, RI * s1],
           [-cm, 0, -sm], GOLD, 'inner');

      // bottom face
      quad([RI * c0, -HH, RI * s0], [RI * c1, -HH, RI * s1],
           [RO * c1, -HH, RO * s1], [RO * c0, -HH, RO * s0],
           [0, -1, 0], GOLD_FACE, 'bottom');
    }

    // silver ECG capsule, just proud of the outer wall
    var M = 16;
    var R = RO + 0.012;
    for (var k = 0; k < M; k++) {
      var a0 = CAP_A + ((CAP_B - CAP_A) * k) / M;
      var a1 = CAP_A + ((CAP_B - CAP_A) * (k + 1)) / M;
      var am = (a0 + a1) / 2;
      var ca0 = Math.cos(a0), sa0 = Math.sin(a0);
      var ca1 = Math.cos(a1), sa1 = Math.sin(a1);
      var cam = Math.cos(am), sam = Math.sin(am);
      quad([R * ca0, -CAP_H, R * sa0], [R * ca1, -CAP_H, R * sa1],
           [R * ca1, CAP_H, R * sa1], [R * ca0, CAP_H, R * sa0],
           [cam, 0, sam], SILVER, 'plate');
    }

    return faces;
  }

  var FACES = buildFaces();

  function create(canvas, options) {
    options = options || {};
    var reduce = !!options.reduceMotion;
    var ctx = canvas.getContext('2d');
    if (!ctx) return null;

    var W = 1, H = 1, DPR = 1;
    var spin = -0.55;
    var intro = reduce ? 1 : 0;
    var running = false;
    var started = false;
    var t0 = 0;
    var last = 0;
    var pointer = { x: 0, y: 0, tx: 0, ty: 0 };
    var dust = [];

    for (var i = 0; i < 36; i++) {
      dust.push({
        a: Math.random() * TAU,
        r: 1.95 + Math.random() * 1.5,
        z: (Math.random() - 0.5) * 2.0,
        s: 0.6 + Math.random() * 1.5,
        v: 0.04 + Math.random() * 0.10,
        p: Math.random() * TAU,
      });
    }

    function resize() {
      var rect = canvas.getBoundingClientRect();
      W = Math.max(1, rect.width);
      H = Math.max(1, rect.height);
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.round(W * DPR);
      canvas.height = Math.round(H * DPR);
    }

    function drawFrame(t) {
      var size = Math.min(W, H);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
      ctx.clearRect(0, 0, W, H);

      var ease = 1 - Math.pow(1 - intro, 4);
      var dolly = (0.90 + 0.10 * ease) * (1 + Math.sin(t * 0.62) * 0.006);

      // a gentle three-quarter pose with life in it
      var tilt = 0.735 + Math.sin(t * 0.23) * 0.030 - pointer.y * 0.09;
      var roll = Math.sin(t * 0.17) * 0.020;
      var ang = spin + pointer.x * 0.22;

      // the light sweep crosses the metal once as the curtain opens
      var sweepT = reduce ? 0.4 : clamp01((t - 0.7) / 2.0);
      var sweep = -1.35 + 2.7 * (sweepT * sweepT * (3 - 2 * sweepT));
      if (sweepT >= 1) sweep = 0.34 + Math.sin(t * 0.30) * 0.13;

      var dist = 6.2;
      var focal = size * 2.06 * dolly;
      var cx = W / 2;
      var cy = H / 2 + Math.sin(t * 0.5) * size * 0.005;

      function project(p) {
        var q = rotZ(rotX(rotY(p, ang), tilt), roll);
        var k = focal / (dist - q[2]);
        return { x: cx + q[0] * k, y: cy - q[1] * k, z: q[2] };
      }
      function normalOf(n) {
        return rotZ(rotX(rotY(n, ang), tilt), roll);
      }

      // ---- gold dust ----
      for (var di = 0; di < dust.length; di++) {
        var d = dust[di];
        var da = d.a + t * d.v;
        var dx = Math.cos(da) * d.r;
        var dy = Math.sin(da * 0.8 + d.p) * d.r * 0.5;
        var kk = focal / (dist - d.z - 0.6);
        var rr = Math.max(0.5, d.s * (kk / 300));
        ctx.beginPath();
        ctx.fillStyle = 'rgba(246,222,175,' + (0.26 * ease).toFixed(3) + ')';
        ctx.arc(cx + dx * kk, cy - dy * kk, rr, 0, TAU);
        ctx.fill();
      }

      // ---- band ----
      var draw = [];
      for (var fi = 0; fi < FACES.length; fi++) {
        var f = FACES[fi];
        var n = normalOf(f.n);
        if (dot(n, VIEW) <= 0.02) continue;             // back-face cull
        var a = project(f.p[0]);
        var b = project(f.p[1]);
        var c = project(f.p[2]);
        var e = project(f.p[3]);

        // two shading samples across the facet give a continuous,
        // curved-metal sheen instead of flat facets
        var c0, c1, gx0, gy0, gx1, gy1;
        if (f.kind === 'top' || f.kind === 'bottom') {
          var sg = f.kind === 'top' ? 1 : -1;
          c0 = shade(norm([n[0] - sg * 0.30, n[1], n[2] - sg * 0.30]), f.mat, sweep);
          c1 = shade(norm([n[0] + sg * 0.30, n[1], n[2] + sg * 0.30]), f.mat, sweep);
          gx0 = (a.x + e.x) / 2; gy0 = (a.y + e.y) / 2;
          gx1 = (b.x + c.x) / 2; gy1 = (b.y + c.y) / 2;
        } else {
          c0 = shade(norm([n[0], n[1] - 0.34, n[2]]), f.mat, sweep);
          c1 = shade(norm([n[0], n[1] + 0.34, n[2]]), f.mat, sweep);
          gx0 = (a.x + b.x) / 2; gy0 = (a.y + b.y) / 2;
          gx1 = (e.x + c.x) / 2; gy1 = (e.y + c.y) / 2;
        }

        draw.push({
          a: a, b: b, c: c, d: e,
          z: (a.z + b.z + c.z + e.z) / 4,
          c0: c0, c1: c1,
          gx0: gx0, gy0: gy0, gx1: gx1, gy1: gy1,
        });
      }
      draw.sort(function (p, q) { return p.z - q.z; });

      for (var j = 0; j < draw.length; j++) {
        var s = draw[j];
        ctx.beginPath();
        ctx.moveTo(s.a.x, s.a.y);
        ctx.lineTo(s.b.x, s.b.y);
        ctx.lineTo(s.c.x, s.c.y);
        ctx.lineTo(s.d.x, s.d.y);
        ctx.closePath();

        var grad = ctx.createLinearGradient(s.gx0, s.gy0, s.gx1, s.gy1);
        grad.addColorStop(0, s.c0);
        grad.addColorStop(1, s.c1);
        ctx.fillStyle = grad;
        ctx.fill();

        // cover anti-aliasing seams between neighbouring facets
        ctx.strokeStyle = grad;
        ctx.lineWidth = 1;
        ctx.stroke();
      }

      // ---- engraved ECG on the capsule ----
      var capMid = (CAP_A + CAP_B) / 2;
      var capN = normalOf([Math.cos(capMid), 0, Math.sin(capMid)]);
      if (dot(capN, VIEW) > 0.58) {
        var R2 = RO + 0.019;
        ctx.beginPath();
        for (var gi = 0; gi < ECG.length; gi++) {
          var th = CAP_A + 0.07 + ECG[gi][0] * (CAP_B - CAP_A - 0.14);
          var yy = Math.max(-CAP_H * 0.8, Math.min(CAP_H * 0.8, ECG[gi][1] * CAP_H * 0.42));
          var pp = project([R2 * Math.cos(th), yy, R2 * Math.sin(th)]);
          if (gi === 0) ctx.moveTo(pp.x, pp.y);
          else ctx.lineTo(pp.x, pp.y);
        }
        ctx.strokeStyle = 'rgba(52,50,44,.72)';
        ctx.lineWidth = Math.max(1, size * 0.0048);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.stroke();
      }
    }

    function loop(now) {
      if (!running) return;
      if (!last) last = now;
      var dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      var t = (now - t0) / 1000;

      if (intro < 1) intro = Math.min(1, intro + dt / 2.5);

      pointer.x += (pointer.tx - pointer.x) * 0.045;
      pointer.y += (pointer.ty - pointer.y) * 0.045;

      spin += dt * (0.42 - 0.28 * intro);

      drawFrame(t);
      requestAnimationFrame(loop);
    }

    function start() {
      if (started) return;
      started = true;
      resize();
      if (reduce) {
        intro = 1;
        spin = -0.18;
        drawFrame(0);
        return;
      }
      running = true;
      t0 = performance.now();
      last = 0;
      requestAnimationFrame(loop);
    }

    var ro = new ResizeObserver(function () {
      resize();
      if (started && reduce) drawFrame(0);
    });
    ro.observe(canvas);

    if (!reduce) {
      window.addEventListener('pointermove', function (e) {
        pointer.tx = (e.clientX / window.innerWidth) * 2 - 1;
        pointer.ty = (e.clientY / window.innerHeight) * 2 - 1;
      }, { passive: true });
    }

    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        running = false;
      } else if (started && !reduce && !running) {
        running = true;
        last = 0;
        requestAnimationFrame(loop);
      }
    });

    resize();
    drawFrame(0);

    return { start: start };
  }

  window.CAERING_RING = { create: create };
})();
