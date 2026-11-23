  /* ---------------- PNGtuber renderer ----------------
     Jade as a PNGtuber: one body picture plus a 5x4 atlas of face patches (expression x frame), drawn on a 2D canvas.
     Frames: 1 eyes open / mouth shut, 2 open / open, 3 shut / shut, 4 shut / open. Moods pick the expression, the voice
     flaps the mouth (and she hops a little on each word, the PNGtuber way), she blinks, breathes, nods and leans towards
     the pointer. It shares this object's state, moods, speech and API with the Live2D renderer, so the rest of the app
     cannot tell them apart. The default: no WebGL, no Live2D runtime work, a fraction of the memory and battery.
     The Live2D model is still there: Settings > Avatar, or automatically when her appearance colours are customised
     (recolouring needs the Live2D texture). */
  const PNG_MOOD = { idle: 'neutral', listening: 'neutral', writing: 'neutral', thinking: 'shy', working: 'mad', happy: 'happy', error: 'sad' };
  function avatarKind() {
    const want = (typeof S !== 'undefined' && S.jadeAvatar) || 'auto';
    if (want === 'png' || want === 'live2d') return want;
    if (!document.getElementById('png-body')) return 'live2d';
    // auto: the PNGtuber, unless her appearance colours were customised (only the Live2D texture can be recoloured)
    const custom = typeof JADE_APPEARANCE_PARTS !== 'undefined' && typeof S !== 'undefined' &&
      JADE_APPEARANCE_PARTS.some(({ id }) => id !== 'skin' && S[`jade${id[0].toUpperCase()}${id.slice(1)}Mode`] && S[`jade${id[0].toUpperCase()}${id.slice(1)}Mode`] !== 'original');
    return custom ? 'live2d' : 'png';
  }
  async function initPng({ host, onStatus, onSpeak } = {}) {
    state.host = host; state.onStatus = onStatus || (() => {}); state.onSpeak = onSpeak || (() => {});
    state.kind = 'png';
    const meta = JSON.parse(document.getElementById('png-meta').textContent);
    const load = async (id) => { const im = new Image(); im.src = document.getElementById(id).textContent.trim(); await im.decode(); return im; };
    const [body, faces] = await Promise.all([load('png-body'), load('png-faces')]);
    const cv = document.createElement('canvas'); cv.className = 'jade-canvas jade-png';
    cv.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;z-index:1';
    host.prepend(cv);
    const g = cv.getContext('2d');
    // pre-compose the 20 frames once (body + face), so a frame change is one drawImage
    const [cw, ch] = meta.cell, [fx, fy] = meta.face, cache = {};
    const frameOf = (emo, n) => {
      const k = emo + n; if (cache[k]) return cache[k];
      const c = document.createElement('canvas'); c.width = meta.width; c.height = meta.height;
      const x = c.getContext('2d'); x.drawImage(body, 0, 0);
      const r = Math.max(0, meta.emotions.indexOf(emo));
      x.drawImage(faces, (n - 1) * cw, r * ch, cw, ch, fx, fy, cw, ch);
      return (cache[k] = c);
    };
    const P2 = { running: true, raf: 0, mouthOpen: false, mouthNext: 0, hop: 0, lean: 0, w: 0, h: 0, dpr: 1 };
    const fit = () => {
      const r = host.getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
      P2.w = r.width; P2.h = r.height; P2.dpr = dpr;
      const W = Math.max(1, Math.round(r.width * dpr)), H = Math.max(1, Math.round(r.height * dpr));
      if (cv.width !== W || cv.height !== H) { cv.width = W; cv.height = H; }
    };
    function tick() {
      if (!P2.running) { P2.raf = 0; return; }
      P2.raf = requestAnimationFrame(tick);
      if (!P2.w) fit(); if (!P2.w || !P2.h) return;
      const now = performance.now();
      if (state.mood !== 'idle' && state.moodUntil && now > state.moodUntil) { state.mood = state.moodNext; state.moodUntil = 0; }
      // blink
      const B = state.blink; let shut = false;
      if (B.t < 0 && now > B.next) B.t = now;
      if (B.t >= 0) { shut = now - B.t < 140; if (!shut) { B.t = -1; B.next = now + 1800 + Math.random() * 4200 * (Math.random() < 0.15 ? 0.1 : 1); } }
      // mouth: open and close while speaking; a word boundary (state.bump) opens it at once
      if (state.speaking) {
        if (state.bump > 0.2) { P2.mouthOpen = true; P2.mouthNext = now + 90 + Math.random() * 70; P2.hop = 1; state.bump = 0; }
        else if (now > P2.mouthNext) { P2.mouthOpen = !P2.mouthOpen; P2.mouthNext = now + (P2.mouthOpen ? 90 + Math.random() * 70 : 70 + Math.random() * 110); if (P2.mouthOpen) P2.hop = Math.max(P2.hop, 0.6); }
      } else P2.mouthOpen = false;
      P2.hop *= 0.86;
      const emo = PNG_MOOD[state.mood] || 'neutral';
      const img = frameOf(emo, 1 + (shut ? 2 : 0) + (P2.mouthOpen ? 1 : 0));
      // lean towards the pointer (or the mood's gaze), breathe, nod, hop
      const M = MOODS[state.mood] || MOODS.idle; let gx = 0;
      if (state.speaking) gx = 0; else if (M.gaze) gx = M.gaze[0];
      else if (now - state.pointer.t < 4000) { const r = cv.getBoundingClientRect(); gx = Math.max(-1, Math.min(1, (state.pointer.x - (r.left + r.width / 2)) / (innerWidth * 0.35))); }
      else gx = Math.sin(now / 5200) * 0.3;
      P2.lean += (gx - P2.lean) * 0.06;
      let nod = 0; if (state.nodT >= 0) { const d = (now - state.nodT) / 600; if (d > 1) state.nodT = -1; else nod = Math.sin(d * Math.PI); }
      // framing like the Live2D layout: a face strip when very short, full body, or portrait (head and chest)
      const { w, h, dpr } = P2, iw = meta.width, ih = meta.height;
      let sx, sy, sw, sh;
      if (h < 130) { sw = cw * 1.6; sh = ch * 1.15; sx = fx + cw / 2 - sw / 2; sy = fy - ch * 0.25; }
      else if (state.frame === 'full') { sx = 0; sy = 0; sw = iw; sh = ih; }
      else { sh = ih * 0.6; sw = iw * 0.9; sx = (iw - sw) / 2; sy = ih * 0.04; }
      const s = h < 130 ? h / sh : Math.min(h / sh, w / sw);
      const breathe = 1 + Math.sin(now / 1400) * 0.006;
      g.setTransform(dpr, 0, 0, dpr, 0, 0);
      g.clearRect(0, 0, w, h);
      const cx = h < 130 ? Math.max(40, h * 0.55) : w / 2;
      const by = h < 130 ? 0 : (state.frame === 'full' ? (h - sh * s) / 2 : h * 0.02);
      g.translate(cx, by + sh * s);                                 // pivot at the bottom centre: lean and breathe from the hips
      g.rotate(P2.lean * 0.035);
      g.scale(breathe, breathe);
      g.translate(0, -P2.hop * 6 + nod * 7);
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, sx, sy, sw, sh, -sw * s / 2, -sh * s, sw * s, sh * s);
    }
    const ro = new ResizeObserver(fit); ro.observe(host);
    window.addEventListener('pointermove', e => { state.pointer = { x: e.clientX, y: e.clientY, t: performance.now() }; }, { passive: true });
    // the app starts and stops the renderer through state.app.ticker (hidden avatar, other tabs, hands-free screen)
    state.app = {
      view: cv,
      ticker: { start() { if (!P2.running) { P2.running = true; if (!P2.raf) P2.raf = requestAnimationFrame(tick); } }, stop() { P2.running = false; } },
      resize: fit,
      destroy() { P2.running = false; cancelAnimationFrame(P2.raf); ro.disconnect(); cv.remove(); },
    };
    state.model = null;
    fit(); P2.raf = requestAnimationFrame(tick);
    state.ready = true; state.onStatus('');
    return api;
  }
