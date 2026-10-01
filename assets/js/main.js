/* =====================================================================
   CAERING — main interactions
   3D viewers · theme · sound · parallax · charts · counters
   ===================================================================== */

const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const isFinePointer = window.matchMedia('(pointer: fine)').matches;
const $ = (s, c = document) => c.querySelector(s);
const $$ = (s, c = document) => [...c.querySelectorAll(s)];

/* =============================================================
   1. PRELOADER
   ============================================================= */
const preloader = $('#preloader');
function dismissPreloader() {
  if (!preloader || preloader.classList.contains('is-done')) return;
  preloader.classList.add('is-done');
  document.body.classList.add('is-loaded');
  // restart hero intro animations cleanly after curtain
  requestAnimationFrame(() => {
    $$('.hero .line__inner, .hero .chip').forEach((el) => {
      el.style.animation = 'none';
      void el.offsetWidth;
      el.style.animation = '';
    });
  });
  setTimeout(() => preloader.remove(), 1200);
}
const preloaderMax = setTimeout(dismissPreloader, 3400);
window.addEventListener('load', () => {
  clearTimeout(preloaderMax);
  setTimeout(dismissPreloader, prefersReduced ? 100 : 1900);
});

/* =============================================================
   2. THEME
   ============================================================= */
// Theme is fixed to light; clear any previously saved preference.
localStorage.removeItem('caering-theme');

/* =============================================================
   3. SOUND — minimal Web Audio
   ============================================================= */
let audioCtx = null, masterGain = null;
const soundOn = true;
localStorage.removeItem('caering-sound');

function ensureAudio() {
  if (audioCtx) { if (audioCtx.state === 'suspended') audioCtx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  audioCtx = new AC();
  masterGain = audioCtx.createGain();
  masterGain.gain.value = soundOn ? 0.14 : 0;
  masterGain.connect(audioCtx.destination);
}
function playSound(kind) {
  if (!soundOn || prefersReduced) return;
  ensureAudio();
  if (!audioCtx) return;
  const t = audioCtx.currentTime;
  const osc = audioCtx.createOscillator();
  const g = audioCtx.createGain();
  if (kind === 'tick') {
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(880, t);
    osc.frequency.exponentialRampToValueAtTime(620, t + 0.07);
    g.gain.setValueAtTime(0.5, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.09);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.1);
  } else {
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, t);
    osc.frequency.exponentialRampToValueAtTime(380, t + 0.12);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
    osc.connect(g); g.connect(masterGain);
    osc.start(t); osc.stop(t + 0.18);
  }
}
document.addEventListener('pointerdown', ensureAudio, { once: true });

// delegated sound hooks
document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-sound]');
  if (el) playSound(el.dataset.sound);
});

/* =============================================================
   4. MAGNETIC ELEMENTS
   ============================================================= */
if (isFinePointer && !prefersReduced) {
  $$('[data-magnetic]').forEach((el) => {
    el.addEventListener('mousemove', (e) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left - r.width / 2;
      const y = e.clientY - r.top - r.height / 2;
      el.style.transform = `translate(${x * 0.18}px, ${y * 0.26}px)`;
    });
    el.addEventListener('mouseleave', () => { el.style.transform = ''; });
  });
}

/* =============================================================
   6. REVEAL ON SCROLL
   ============================================================= */
const revealIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) {
      en.target.classList.add('is-in');
      revealIO.unobserve(en.target);
    }
  });
}, { threshold: 0.14, rootMargin: '0px 0px -6% 0px' });
$$('[data-reveal]').forEach((el) => revealIO.observe(el));

/* =============================================================
   7. 3D RING VIEWERS
   ============================================================= */
let heroViewer = null, finishViewer = null;

async function initViewers() {
  try {
    const { createRingViewer, createDuneHero } = await import('./ring3d.js?v=20260927b');

    const heroCanvas = $('#heroRing');
    if (heroCanvas) {
      const darkHero = document.documentElement.getAttribute('data-theme') === 'dark';
      heroViewer = createDuneHero(heroCanvas, innerWidth <= 860
        ? { fov: 42, cameraZ: 8.5, dark: darkHero }
        : { fov: 34, cameraZ: 8.4, dark: darkHero });
    }
    const finishCanvas = $('#finishRing');
    if (finishCanvas) {
      finishViewer = createRingViewer(finishCanvas, innerWidth <= 860
        ? { cameraZ: 8.0, offsetX: 0, tilt: 0.35, autoSpeed: 0.18, fov: 40 }
        : { cameraZ: 7.2, offsetX: 0, tilt: 0.62, autoSpeed: 0.18, fov: 36 });
    }
  } catch (err) {
    console.warn('3D unavailable — showing fallback ring.', err);
    document.body.classList.add('no-webgl');
  }
}
initViewers();

/* hero mouse parallax */
if (!prefersReduced) {
  const hero = $('.hero');
  if (hero) hero.addEventListener('mousemove', (e) => {
    const nx = (e.clientX / innerWidth) * 2 - 1;
    const ny = (e.clientY / innerHeight) * 2 - 1;
    heroViewer?.setParallax(nx, ny);
  });
}

/* =============================================================
   8. SCROLL BEHAVIOUR
   ============================================================= */
const header = $('#header');
const progress = $('#scrollProgress');
const craftImg = $('.craft__visual img');
let lastY = 0, ticking = false;

function onScroll() {
  const y = window.scrollY;
  header.classList.toggle('is-scrolled', y > 24);
  const max = document.documentElement.scrollHeight - innerHeight;
  progress.style.width = `${(y / max) * 100}%`;

  if (!prefersReduced) {
    if (craftImg) {
      const sec = $('.craft');
      const r = sec.getBoundingClientRect();
      if (r.bottom > 0 && r.top < innerHeight) {
        const p = THREE_clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1);
        craftImg.style.transform = `translateY(${-10 + p * 10}%)`;
      }
    }
    const delta = y - lastY;
    if (Math.abs(delta) > 0.4) {
      finishViewer?.addScrollSpin(delta * 0.6);
    }
  }
  lastY = y;
  ticking = false;
}
function THREE_clamp(v, a, b) { return Math.min(b, Math.max(a, v)); }

window.addEventListener('scroll', () => {
  if (!ticking) { requestAnimationFrame(onScroll); ticking = true; }
}, { passive: true });
onScroll();

/* =============================================================
   8b. TECHNOLOGY BACKGROUND VIDEO
   Muted, looping; plays only while the section is on screen.
   Reduced-motion users stay on the static poster frame.
   ============================================================= */
const techVideo = $('#techVideo');
if (techVideo) {
  techVideo.muted = true;
  if (prefersReduced) {
    techVideo.removeAttribute('autoplay');
    techVideo.addEventListener('loadeddata', () => techVideo.pause(), { once: true });
  } else {
    const techVideoIO = new IntersectionObserver((entries) => {
      entries.forEach((en) => {
        if (en.isIntersecting) techVideo.play().catch(() => {});
        else techVideo.pause();
      });
    }, { threshold: 0.2 });
    techVideoIO.observe(techVideo);
  }
}

/* =============================================================
   9. COUNTERS
   ============================================================= */
function animateCount(el) {
  if (el.dataset.counted) return;
  el.dataset.counted = '1';
  const target = parseFloat(el.dataset.count);
  const dec = parseInt(el.dataset.decimals || '0', 10);
  if (prefersReduced) { el.textContent = target.toFixed(dec); return; }
  const dur = 1500; const start = performance.now();
  function frame(now) {
    const p = Math.min((now - start) / dur, 1);
    const e = 1 - Math.pow(1 - p, 3);
    el.textContent = (target * e).toFixed(dec);
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}
const countIO = new IntersectionObserver((entries) => {
  entries.forEach((en) => { if (en.isIntersecting) { animateCount(en.target); countIO.unobserve(en.target); } });
}, { threshold: 0.5 });
$$('.count').forEach((el) => countIO.observe(el));

/* =============================================================
   10. WELL-BEING TABS + CHARTS
   ============================================================= */
const tabs = $$('.ptab');
const panels = $$('.ppanel');
let activeChart = 'sleep';

tabs.forEach((tab) => {
  tab.addEventListener('click', () => {
    const name = tab.dataset.tab;
    tabs.forEach((t) => t.classList.toggle('is-active', t === tab));
    panels.forEach((p) => p.classList.toggle('is-active', p.dataset.panel === name));
    activeChart = name;
    chartState[name] = 0;
    requestAnimationFrame(() => requestAnimationFrame(setupChartSizes));
    // re-animate that panel's counters
    panels.forEach((p) => $$('.count', p).forEach((el) => {
      delete el.dataset.counted; animateCount(el);
    }));
    // pause others' loops
    Object.keys(chartState).forEach((k) => { if (k !== name && k !== 'pulse') chartState[k] = 1; });
  });
});

/* ---------- canvas chart engine ---------- */
const chartCanvas = {
  sleep: $('#chartSleep'),
  pulse: $('#chartPulse'),
  stress: $('#chartStress'),
  temp: $('#chartTemp'),
};
const chartState = { sleep: 0, pulse: 0, stress: 1, temp: 1 };
const chartCtx = {};
let cw = 0, chh = 0;

function setupChartSizes() {
  const first = chartCanvas.sleep;
  if (!first || !first.parentElement) return; // no charts on this page
  const rect = first.parentElement.getBoundingClientRect();
  if (rect.width < 4 || rect.height < 4) return; // hidden panels
  cw = rect.width - 28; chh = rect.height - 28; // inset 14 each side
  const dpr = Math.min(devicePixelRatio, 2);
  Object.entries(chartCanvas).forEach(([k, cv]) => {
    cv.width = Math.round(cw * dpr); cv.height = Math.round(chh * dpr);
    cv.style.width = `${cw}px`; cv.style.height = `${chh}px`;
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    chartCtx[k] = ctx;
  });
}

/* helpers */
function smoothPath(ctx, pts) {
  ctx.beginPath();
  ctx.moveTo(pts[0][0], pts[0][1]);
  for (let i = 1; i < pts.length - 1; i++) {
    const xc = (pts[i][0] + pts[i + 1][0]) / 2;
    const yc = (pts[i][1] + pts[i + 1][1]) / 2;
    ctx.quadraticCurveTo(pts[i][0], pts[i][1], xc, yc);
  }
  const last = pts[pts.length - 1];
  ctx.lineTo(last[0], last[1]);
}

const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();

/* data generators */
function genSleep(n = 72) {
  const out = [];
  let v = 3;
  for (let i = 0; i < n; i++) {
    const hour = i / n;
    if (i < 4) v = 0.5;
    else if (i === 8) v = 2.6;
    else if (i > 10 && i < 22) v = 3.2;   // deep early night
    else if (i > 24 && i < 30 && Math.random() < .5) v = 1.6;
    else if (i > 40 && i < 60 && Math.random() < .6) v = 1.4; // REM mornings
    else v += (Math.random() - .5) * 1.4;
    v = THREE_clamp(v, 0.2, 3.6);
    out.push([hour, v]);
  }
  return out;
}
const sleepData = genSleep();

function genStress(n = 90) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    let v = 0.24 + Math.sin(x * 9) * 0.06 + Math.random() * 0.05;
    // three peaks
    [0.28, 0.52, 0.78].forEach((p, k) => {
      v += 0.42 * Math.exp(-Math.pow((x - p) * 9, 2)) * (0.8 + k * 0.2);
    });
    out.push([x, THREE_clamp(v, 0.05, 0.9)]);
  }
  return out;
}
const stressData = genStress();

function genTemp(n = 90) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const x = i / (n - 1);
    out.push([x, 0.5 + Math.sin(x * Math.PI * 2.2 + 0.8) * 0.28 + Math.sin(x * 7) * 0.05]);
  }
  return out;
}
const tempData = genTemp();

/* draw functions */
function drawGrid(ctx, pad) {
  ctx.strokeStyle = cssVar('--grid-line');
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = pad + ((chh - pad * 2) / 4) * i;
    ctx.beginPath(); ctx.moveTo(pad, y); ctx.lineTo(cw - pad, y); ctx.stroke();
  }
}

function drawSleepChart(p) {
  const ctx = chartCtx.sleep;
  const pad = 18;
  ctx.clearRect(0, 0, cw, chh);
  drawGrid(ctx, pad);

  const labels = ['Awake', 'REM', 'Light', 'Deep'];
  const colors = ['rgba(221,94,134,.10)', 'rgba(111,95,240,.10)', 'rgba(210,166,90,.10)', 'rgba(26,168,154,.12)'];
  labels.forEach((l, i) => {
    const y = pad + ((chh - pad * 2) / 4) * i;
    ctx.fillStyle = colors[i];
    ctx.fillRect(pad, y, cw - pad * 2, (chh - pad * 2) / 4);
    ctx.fillStyle = cssVar('--ink-faint');
    ctx.font = '10px Outfit';
    ctx.fillText(l, pad + 6, y + 14);
  });

  const pts = sleepData.map(([x, v]) => [
    pad + x * (cw - pad * 2),
    pad + (v / 4) * (chh - pad * 2),
  ]);

  ctx.save();
  ctx.beginPath();
  ctx.rect(pad, 0, (cw - pad * 2) * p, chh);
  ctx.clip();

  smoothPath(ctx, pts);
  ctx.strokeStyle = cssVar('--gold-2');
  ctx.lineWidth = 2;
  ctx.shadowColor = cssVar('--gold-2');
  ctx.shadowBlur = 12;
  ctx.stroke();

  ctx.lineTo(cw - pad, chh - pad);
  ctx.lineTo(pad, chh - pad);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad, 0, chh - pad);
  grad.addColorStop(0, 'rgba(210,166,90,.28)');
  grad.addColorStop(1, 'rgba(210,166,90,0)');
  ctx.fillStyle = grad;
  ctx.shadowBlur = 0;
  ctx.fill();
  ctx.restore();
}

function drawPulseChart(p) {
  const ctx = chartCtx.pulse;
  const pad = 18;
  ctx.clearRect(0, 0, cw, chh);
  drawGrid(ctx, pad);

  const base = chh * 0.58;
  const beatW = 78;
  const beats = Math.ceil((cw - pad * 2) / beatW) + 1;

  ctx.beginPath();
  let x = pad;
  ctx.moveTo(x, base);
  for (let b = 0; b < beats; b++) {
    const o = pad + b * beatW;
    ctx.lineTo(o + 18, base);
    ctx.lineTo(o + 24, base - 4);
    ctx.lineTo(o + 30, base - 46);
    ctx.lineTo(o + 38, base + 22);
    ctx.lineTo(o + 46, base - 12);
    ctx.lineTo(o + 54, base);
    ctx.lineTo(o + beatW, base);
  }
  const full = new Path2D ? null : null;

  // faint full trace
  ctx.strokeStyle = cssVar('--grid-line');
  ctx.lineWidth = 2;
  ctx.stroke();

  // bright sweeping segment
  ctx.save();
  ctx.beginPath();
  x = pad;
  ctx.moveTo(x, base);
  for (let b = 0; b < beats; b++) {
    const o = pad + b * beatW;
    ctx.lineTo(o + 18, base);
    ctx.lineTo(o + 24, base - 4);
    ctx.lineTo(o + 30, base - 46);
    ctx.lineTo(o + 38, base + 22);
    ctx.lineTo(o + 46, base - 12);
    ctx.lineTo(o + 54, base);
    ctx.lineTo(o + beatW, base);
  }
  ctx.strokeStyle = cssVar('--rose');
  ctx.lineWidth = 2;
  ctx.shadowColor = cssVar('--rose');
  ctx.shadowBlur = 14;
  ctx.setLineDash([beatW * 1.1, cw + beatW * 4]);
  ctx.lineDashOffset = -p * (cw + beatW);
  ctx.stroke();
  ctx.restore();
}

function drawStressChart(p) {
  const ctx = chartCtx.stress;
  const pad = 18;
  ctx.clearRect(0, 0, cw, chh);
  drawGrid(ctx, pad);

  const pts = stressData.map(([x, v]) => [
    pad + x * (cw - pad * 2),
    chh - pad - v * (chh - pad * 2),
  ]);

  // calm threshold
  const thY = chh - pad - 0.55 * (chh - pad * 2);
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = 'rgba(26,168,154,.6)';
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(pad, thY); ctx.lineTo(cw - pad, thY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = cssVar('--teal');
  ctx.font = '10px Outfit';
  ctx.fillText('calm zone', cw - pad - 58, thY - 6);

  ctx.save();
  ctx.beginPath(); ctx.rect(pad, 0, (cw - pad * 2) * p, chh); ctx.clip();

  smoothPath(ctx, pts);
  ctx.lineTo(cw - pad, chh - pad);
  ctx.lineTo(pad, chh - pad);
  ctx.closePath();
  const grad = ctx.createLinearGradient(0, pad, 0, chh - pad);
  grad.addColorStop(0, 'rgba(221,94,134,.30)');
  grad.addColorStop(1, 'rgba(26,168,154,.05)');
  ctx.fillStyle = grad;
  ctx.fill();

  smoothPath(ctx, pts);
  ctx.strokeStyle = cssVar('--rose');
  ctx.lineWidth = 2;
  ctx.shadowColor = cssVar('--rose');
  ctx.shadowBlur = 12;
  ctx.stroke();
  ctx.restore();
}

function drawTempChart(p) {
  const ctx = chartCtx.temp;
  const pad = 18;
  ctx.clearRect(0, 0, cw, chh);
  drawGrid(ctx, pad);

  const pts = tempData.map(([x, v]) => [
    pad + x * (cw - pad * 2),
    chh - pad - v * (chh - pad * 2),
  ]);

  // baseline
  const bY = chh - pad - 0.5 * (chh - pad * 2);
  ctx.setLineDash([5, 6]);
  ctx.strokeStyle = cssVar('--line-strong');
  ctx.lineWidth = 1.2;
  ctx.beginPath(); ctx.moveTo(pad, bY); ctx.lineTo(cw - pad, bY); ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = cssVar('--ink-faint');
  ctx.font = '10px Outfit';
  ctx.fillText('36.6° baseline', pad + 4, bY - 7);

  ctx.save();
  ctx.beginPath(); ctx.rect(pad, 0, (cw - pad * 2) * p, chh); ctx.clip();

  smoothPath(ctx, pts);
  ctx.strokeStyle = cssVar('--teal');
  ctx.lineWidth = 2.2;
  ctx.shadowColor = cssVar('--teal');
  ctx.shadowBlur = 12;
  ctx.stroke();

  // end dot
  const end = pts[pts.length - 1];
  ctx.beginPath();
  ctx.fillStyle = cssVar('--gold-1');
  ctx.arc(end[0], end[1], 4.5, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/* chart loop */
let lastChartT = performance.now();
function chartLoop(now) {
  requestAnimationFrame(chartLoop);
  const dt = Math.min((now - lastChartT) / 1000, 0.05);
  lastChartT = now;

  // animate progress of active chart
  if (activeChart !== 'pulse') {
    if (chartState[activeChart] < 1) {
      chartState[activeChart] = Math.min(1, chartState[activeChart] + dt / 1.5);
    }
  } else {
    chartState.pulse = (chartState.pulse + dt / 2.4) % 1;
  }

  if (!cw) return;
  drawSleepChart(chartState.sleep);
  drawPulseChart(chartState.pulse);
  drawStressChart(chartState.stress);
  drawTempChart(chartState.temp);
}

setupChartSizes();
chartState.sleep = 0;
const pillarsEl = $('.pillars');
if (pillarsEl) {
  new ResizeObserver(() => {
    setupChartSizes();
    if (activeChart !== 'sleep') chartState.sleep = 1;
  }).observe(pillarsEl);
}
requestAnimationFrame(chartLoop);

/* =============================================================
   11. FINISH SWITCHING
   ============================================================= */
$$('.finish').forEach((btn) => {
  btn.addEventListener('click', () => {
    $$('.finish').forEach((b) => b.classList.toggle('is-active', b === btn));
    finishViewer?.setFinish(btn.dataset.finish);
  });
});

/* =============================================================
   12. DRAWER (mobile)
   ============================================================= */
const burger = $('#burger');
const drawer = $('#drawer');
burger.addEventListener('click', () => {
  const open = drawer.classList.toggle('is-open');
  drawer.setAttribute('aria-hidden', String(!open));
  burger.setAttribute('aria-label', open ? 'Close menu' : 'Open menu');
});
$$('.drawer__link').forEach((l) => l.addEventListener('click', () => {
  drawer.classList.remove('is-open');
  drawer.setAttribute('aria-hidden', 'true');
}));

/* =============================================================
   13. FILM MODAL
   ============================================================= */
const modal = $('#filmModal');
if (modal) {
  function closeModal() {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
  }
  const modalClose = $('.modal__close');
  modalClose?.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  window.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });
}

/* =============================================================
   14. RESERVE FORM
   ============================================================= */
$('#reserveForm')?.addEventListener('submit', (e) => {
  e.preventDefault();
  e.target.style.display = 'none';
  $('#reserveDone')?.classList.add('is-visible');
});

/* =============================================================
   15. FINAL TITLE REVEAL
   ============================================================= */
const finalTitle = $('.final__title');
if (finalTitle) new IntersectionObserver((entries) => {
  entries.forEach((en) => {
    if (en.isIntersecting) { finalTitle.classList.add('is-visible'); }
  });
}, { threshold: 0.4 }).observe(finalTitle);
