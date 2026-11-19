/* =====================================================================
   CAERING — website inauguration
   Choreography · Web Audio score · parallax · hand-off
   ===================================================================== */
(function () {
  'use strict';

  /* ---------------- destination ---------------- */
  var LAUNCH_URL = 'https://caering.com';

  var CONFIG = {
    redirectDelay: 5400,     // ms after the inaugurate click
    autoRedirect: true,      // add ?stay to the URL to keep the page open (QA)
  };

  var params = new URLSearchParams(window.location.search);
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var stay = params.has('stay');

  var stage = document.getElementById('stage');
  var gate = document.getElementById('gate');
  var cta = document.getElementById('inaugurate');
  var soundBtn = document.getElementById('soundBtn');
  var soundLabel = document.getElementById('soundLabel');
  var statusEl = document.getElementById('status');
  var enterNow = document.getElementById('enterNow');

  /* ===================================================================
     SCORE — synthesised, mixed through a small hall reverb
     =================================================================== */
  var Sound = (function () {
    var ctx = null;
    var master = null;
    var send = null;
    var ambience = null;
    var muted = localStorage.getItem('caering-launch-muted') === '1';

    function noiseBuffer(seconds) {
      var frames = Math.floor(ctx.sampleRate * seconds);
      var buf = ctx.createBuffer(1, frames, ctx.sampleRate);
      var data = buf.getChannelData(0);
      var last = 0;
      for (var i = 0; i < frames; i++) {
        var white = Math.random() * 2 - 1;
        last = (last + 0.022 * white) / 1.022;     // softened white noise
        data[i] = last * 3.4;
      }
      return buf;
    }

    function impulse(seconds, decay) {
      var rate = ctx.sampleRate;
      var len = Math.floor(rate * seconds);
      var buf = ctx.createBuffer(2, len, rate);
      for (var ch = 0; ch < 2; ch++) {
        var d = buf.getChannelData(ch);
        var energy = 0;
        for (var i = 0; i < len; i++) {
          var p = i / len;
          var v = (Math.random() * 2 - 1) * Math.pow(1 - p, decay);
          d[i] = v;
          energy += v * v;
        }
        // unit-energy IR: the tail sits behind the sound, never on top of it
        var k = 1 / Math.sqrt(energy || 1);
        for (var j = 0; j < len; j++) d[j] *= k;
      }
      return buf;
    }

    function ensure() {
      if (ctx) return ctx;
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;

      ctx = new AC();

      master = ctx.createGain();
      master.gain.value = muted ? 0 : 0.85;

      // soft-clip safety net: the score can never crackle on any device
      var limiter = ctx.createWaveShaper();
      var curve = new Float32Array(1024);
      for (var ci = 0; ci < curve.length; ci++) {
        var x = (ci / (curve.length - 1)) * 2 - 1;
        curve[ci] = Math.tanh(x * 1.25);
      }
      limiter.curve = curve;
      limiter.oversample = '4x';
      master.connect(limiter);
      limiter.connect(ctx.destination);

      var conv = ctx.createConvolver();
      conv.buffer = impulse(3.2, 2.4);
      var damp = ctx.createBiquadFilter();
      damp.type = 'lowpass';
      damp.frequency.value = 3600;
      var wet = ctx.createGain();
      wet.gain.value = 0.42;
      conv.connect(damp);
      damp.connect(wet);
      wet.connect(master);

      send = ctx.createGain();
      send.gain.value = 0.42;
      send.connect(conv);

      return ctx;
    }

    function unlock() {
      var c = ensure();
      if (!c) return;
      if (c.state === 'suspended') c.resume();
      startAmbience();
    }

    function startAmbience() {
      if (!ctx || ambience) return;
      var t = ctx.currentTime;

      var bus = ctx.createGain();
      bus.gain.setValueAtTime(0.0001, t);
      bus.gain.linearRampToValueAtTime(0.6, t + 2.6);
      bus.connect(master);
      bus.connect(send);
      ambience = bus;

      // slow breathing pad — A1 with its fifth and octaves
      [[55, 0.46], [82.5, 0.30], [110, 0.18], [164.8, 0.09], [220, 0.05]]
        .forEach(function (p, i) {
          var o1 = ctx.createOscillator();
          o1.type = i % 2 ? 'triangle' : 'sine';
          o1.frequency.value = p[0];
          o1.detune.value = -5 - i;

          var o2 = ctx.createOscillator();
          o2.type = 'sine';
          o2.frequency.value = p[0];
          o2.detune.value = 5 + i;

          var g = ctx.createGain();
          g.gain.value = p[1] * 0.24;

          var lp = ctx.createBiquadFilter();
          lp.type = 'lowpass';
          lp.Q.value = 0.5;
          lp.frequency.value = 480 + i * 60;

          var lfo = ctx.createOscillator();
          lfo.frequency.value = 0.042 + i * 0.013;
          var lfoGain = ctx.createGain();
          lfoGain.gain.value = 110;
          lfo.connect(lfoGain);
          lfoGain.connect(lp.frequency);

          var trem = ctx.createOscillator();
          trem.frequency.value = 0.068 + i * 0.011;
          var tremGain = ctx.createGain();
          tremGain.gain.value = p[1] * 0.028;
          trem.connect(tremGain);
          tremGain.connect(g.gain);

          o1.connect(g);
          o2.connect(g);
          g.connect(lp);
          lp.connect(bus);

          o1.start(t); o2.start(t); lfo.start(t); trem.start(t);
        });

      // air of the room
      var air = ctx.createBufferSource();
      air.buffer = noiseBuffer(6);
      air.loop = true;
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.frequency.value = 1150;
      bp.Q.value = 0.55;
      var airGain = ctx.createGain();
      airGain.gain.value = 0.06;
      air.connect(bp);
      bp.connect(airGain);
      airGain.connect(bus);
      air.start(t);
    }

    /* rising swell before the reveal */
    function riser(dur) {
      if (!ctx) return;
      var t = ctx.currentTime;
      var d = dur || 3.0;

      var n = ctx.createBufferSource();
      n.buffer = noiseBuffer(d + 0.6);
      var bp = ctx.createBiquadFilter();
      bp.type = 'bandpass';
      bp.Q.value = 1.5;
      bp.frequency.setValueAtTime(220, t);
      bp.frequency.exponentialRampToValueAtTime(5600, t + d);
      var g = ctx.createGain();
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.15, t + d * 0.9);
      g.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.2);
      n.connect(bp);
      bp.connect(g);
      g.connect(master);
      g.connect(send);
      n.start(t);
      n.stop(t + d + 0.25);

      [55, 82.5].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.setValueAtTime(f, t);
        o.frequency.exponentialRampToValueAtTime(f * 2, t + d);
        var og = ctx.createGain();
        og.gain.setValueAtTime(0.0001, t);
        og.gain.exponentialRampToValueAtTime(0.07 / (i + 1), t + d * 0.85);
        og.gain.exponentialRampToValueAtTime(0.0001, t + d + 0.15);
        o.connect(og);
        og.connect(master);
        og.connect(send);
        o.start(t);
        o.stop(t + d + 0.2);
      });
    }

    /* low impact as the curtain parts */
    function impact(delay) {
      if (!ctx) return;
      var t = ctx.currentTime + (delay || 0);

      var sub = ctx.createOscillator();
      sub.type = 'sine';
      sub.frequency.setValueAtTime(96, t);
      sub.frequency.exponentialRampToValueAtTime(31, t + 1.05);
      var subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.44, t);
      subGain.gain.exponentialRampToValueAtTime(0.0001, t + 1.35);
      sub.connect(subGain);
      subGain.connect(master);
      sub.start(t);
      sub.stop(t + 1.4);

      // the cloth / air transient
      var body = ctx.createBufferSource();
      body.buffer = noiseBuffer(1.4);
      var lp = ctx.createBiquadFilter();
      lp.type = 'lowpass';
      lp.frequency.setValueAtTime(1400, t);
      lp.frequency.exponentialRampToValueAtTime(220, t + 0.8);
      var bg = ctx.createGain();
      bg.gain.setValueAtTime(0.26, t);
      bg.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
      body.connect(lp);
      lp.connect(bg);
      bg.connect(master);
      bg.connect(send);
      body.start(t);
      body.stop(t + 1.0);

      // a touch of struck metal
      [1468, 2202].forEach(function (f, i) {
        var m = ctx.createOscillator();
        m.type = 'sine';
        m.frequency.value = f;
        var mg = ctx.createGain();
        mg.gain.setValueAtTime(0.0001, t);
        mg.gain.exponentialRampToValueAtTime(0.024 / (i + 1), t + 0.01);
        mg.gain.exponentialRampToValueAtTime(0.0001, t + 1.1 + i * 0.4);
        m.connect(mg);
        mg.connect(master);
        mg.connect(send);
        m.start(t);
        m.stop(t + 1.7);
      });
    }

    /* the tail that resolves as the mark settles */
    function resolve(delay) {
      if (!ctx) return;
      var t = ctx.currentTime + (delay || 0);

      [110, 164.8, 220, 277.2, 329.6].forEach(function (f, i) {
        var o = ctx.createOscillator();
        o.type = i < 2 ? 'sine' : 'triangle';
        o.frequency.value = f;
        o.detune.value = (i - 2) * 3;

        var g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.setValueAtTime(0.0001, t + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.052 / (1 + i * 0.35), t + 0.55 + i * 0.09);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 4.2 + i * 0.2);

        var lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 1400 + i * 220;

        o.connect(lp);
        lp.connect(g);
        g.connect(master);
        g.connect(send);
        o.start(t);
        o.stop(t + 4.6);
      });

      // high shimmer settling on the gold
      [1318.5, 1760, 2637].forEach(function (f, i) {
        var s = ctx.createOscillator();
        s.type = 'sine';
        s.frequency.value = f;
        var sg = ctx.createGain();
        sg.gain.value = 0.0001;
        sg.gain.setValueAtTime(0.0001, t + 0.2 + i * 0.12);
        sg.gain.exponentialRampToValueAtTime(0.016 / (i + 1), t + 0.6 + i * 0.12);
        sg.gain.exponentialRampToValueAtTime(0.0001, t + 3.4 + i * 0.3);
        s.connect(sg);
        sg.connect(master);
        sg.connect(send);
        s.start(t);
        s.stop(t + 3.9);
      });
    }

    /* soft bell for the hand-off */
    function chime() {
      if (!ctx) return;
      var t = ctx.currentTime;
      [[880, 0.05], [1318.5, 0.028]].forEach(function (p, i) {
        var o = ctx.createOscillator();
        o.type = 'sine';
        o.frequency.value = p[0];
        var g = ctx.createGain();
        g.gain.value = 0.0001;
        g.gain.setValueAtTime(0.0001, t + i * 0.08);
        g.gain.exponentialRampToValueAtTime(p[1], t + 0.05 + i * 0.08);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0 + i * 0.2);
        o.connect(g);
        g.connect(master);
        g.connect(send);
        o.start(t);
        o.stop(t + 2.3);
      });
    }

    function fadeOut() {
      if (!ctx || !ambience) return;
      var t = ctx.currentTime;
      ambience.gain.cancelScheduledValues(t);
      ambience.gain.setValueAtTime(ambience.gain.value, t);
      ambience.gain.exponentialRampToValueAtTime(0.0001, t + 1.2);
    }

    function setMuted(next) {
      muted = next;
      localStorage.setItem('caering-launch-muted', muted ? '1' : '0');
      if (!ctx || !master) return;
      var t = ctx.currentTime;
      master.gain.cancelScheduledValues(t);
      master.gain.setValueAtTime(master.gain.value, t);
      master.gain.linearRampToValueAtTime(muted ? 0 : 0.85, t + 0.4);
    }

    return {
      unlock: unlock,
      riser: riser,
      impact: impact,
      resolve: resolve,
      chime: chime,
      fadeOut: fadeOut,
      setMuted: setMuted,
      get muted() { return muted; },
    };
  })();

  function paintSound() {
    var on = !Sound.muted;
    soundBtn.setAttribute('aria-pressed', String(on));
    soundBtn.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
    soundLabel.textContent = on ? 'Sound on' : 'Sound off';
  }
  paintSound();

  soundBtn.addEventListener('click', function () {
    Sound.unlock();                     // a gesture may start the context
    Sound.setMuted(!Sound.muted);
    paintSound();
  });

  /* ===================================================================
     RING
     =================================================================== */
  var ringScene = window.CAERING_RING
    ? window.CAERING_RING.create(document.getElementById('ringCanvas'), { reduceMotion: reduceMotion })
    : null;

  /* ===================================================================
     PARALLAX — the stage breathes with the pointer
     =================================================================== */
  var glow = document.getElementById('curtainGlow');
  var queued = false;

  if (!reduceMotion) {
    window.addEventListener('pointermove', function (e) {
      if (queued) return;
      queued = true;
      window.requestAnimationFrame(function () {
        queued = false;
        var nx = (e.clientX / window.innerWidth) * 2 - 1;
        var ny = (e.clientY / window.innerHeight) * 2 - 1;
        stage.style.setProperty('--px', nx.toFixed(3));
        stage.style.setProperty('--py', ny.toFixed(3));
        if (glow) {
          glow.style.setProperty('--gx', e.clientX + 'px');
          glow.style.setProperty('--gy', e.clientY + 'px');
        }
      });
    }, { passive: true });
  }

  /* ===================================================================
     CHOREOGRAPHY
     curtain part · ring emergence · mark settle · hand-off
     =================================================================== */
  var T = reduceMotion
    ? { reveal: 80, live: 240, handoff: 900, redirect: 2800 }
    : { reveal: 240, live: 1250, handoff: 3500, redirect: CONFIG.redirectDelay };

  var launched = false;

  function launch() {
    if (launched) return;
    launched = true;

    cta.disabled = true;
    cta.setAttribute('aria-disabled', 'true');
    gate.setAttribute('aria-hidden', 'true');

    if (reduceMotion) stage.classList.add('is-instant');

    // score: swell → low impact on the opening → resolve on the settle
    Sound.unlock();
    Sound.riser(reduceMotion ? 1.2 : 3.1);
    Sound.impact(reduceMotion ? 0.05 : 0.22);
    if (!reduceMotion) Sound.resolve(2.55);

    stage.classList.add('is-launching');
    if (ringScene) ringScene.start();

    window.setTimeout(function () { stage.classList.add('is-revealed'); }, T.reveal);
    window.setTimeout(function () { stage.classList.add('is-live'); }, T.live);
    window.setTimeout(function () {
      stage.classList.add('is-handoff');
      statusEl.textContent = 'The CAERING website is inaugurated. Taking you to caering.com.';
      Sound.chime();
    }, T.handoff);
    window.setTimeout(function () { Sound.fadeOut(); }, T.redirect - 900);

    if (CONFIG.autoRedirect && !stay) {
      window.setTimeout(function () { window.location.href = LAUNCH_URL; }, T.redirect);
    }
  }

  cta.addEventListener('click', launch);

  // the whole gate is clickable, like a curtain
  gate.addEventListener('click', function (e) {
    if (e.target.closest('button, a')) return;
    launch();
  });

  enterNow.href = LAUNCH_URL;

  // the curtain catches a little light once the page is settled
  window.requestAnimationFrame(function () { stage.classList.add('is-ready'); });

  // QA / preview: ?auto raises the curtain without a click
  if (params.has('auto')) window.setTimeout(launch, 500);
})();
