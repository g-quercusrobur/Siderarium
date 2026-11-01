/*  siderarium — renderer
    Austere frame, maximal content. Everything outside the dial is grid and type;
    everything inside the circle is computed light.

    Channel map (one variable, one channel):
      moon phase        global exposure, line weight
      dignity           chroma (clarity)
      aspects           geometry {n/k} + colour law (light / pigment)
      sect              which light leads the field
      retrograde/slow   blur of the primitive the planet owns
      outer planets     optics: iridescence, brilliance, lensing
*/
(function (SD) {
  'use strict';
  const C = SD.corr, K = SD.color, G = SD.glyphs, E_ = SD.engine, I = () => SD.i18n;
  const TAU = Math.PI * 2;
  const INK = '#ebe7dc';            // off-white, the only colour the frame owns
  const MIDNIGHT = '#050a20';
  const VOID = '#000000';                                 // the page is pure black; the art sits lighter on it
  const STAR = '#ffffff';            // reserved for constellations
  const NATAL_INK = '#d9d3c6';       // the nativity is drawn in ink: it is the fixed thing the sky moves against
  const SANS = 'Geist, "Helvetica Neue", Arial, sans-serif';
  const MONO = '"Geist Mono", ui-monospace, Menlo, monospace';

  const supportsFilter = (() => {
    try { const c = document.createElement('canvas').getContext('2d'); c.filter = 'blur(2px)'; return c.filter === 'blur(2px)'; }
    catch (e) { return false; }
  })();
  let FAST = false, PURE = false, ENGRAVE = false, LUMINOUS = false, TIGHT = false, GUILLOCHE = false, PURE_LW = 3, PURE_BASE = 1, PURE_ALPHA = 1, PURE_SIMPLE = false;   // PURE_SIMPLE: the sigil as lines only, one weight   // PURE_LW: the sigil's line weight for a figure's edges; its bands and rays follow in proportion   // TIGHT: phones, caption outside the canvas: the dial fills the square   // LUMINOUS: prototype — planets as lights, flat, glowing by power   // ENGRAVE: prototype — light as engraved line weight, no glows, no gradients                    // PURE: the sigil layer — solid ink, no glow, no fill                       // scrubbing at speed: skip blurs and the neptune pass
  function withBlur(ctx, px, fn) {
    if (FAST || px < 0.35) return fn();
    if (supportsFilter) { ctx.save(); ctx.filter = `blur(${px.toFixed(2)}px)`; fn(); ctx.restore(); return; }
    const a = ctx.globalAlpha;
    ctx.save(); ctx.globalAlpha = a / 3;
    for (const [dx, dy] of [[-px, 0], [px, 0], [0, -px], [0, px]]) { ctx.save(); ctx.translate(dx * 0.6, dy * 0.6); fn(); ctx.restore(); }
    ctx.restore();
  }
  const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
  const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };
  /* the moon's light sets the weight of every mark: a floor of 70% at new moon, and the full moon adds luminosity of its own */
  const lunarE = state => { const i = state.moon.illum; return 0.81 + 0.35 * i + 0.25 * smooth(0.9, 1, i); };   // ~15% lighter than before
  const lunarLw = state => { const i = state.moon.illum; return 2.24 + 0.96 * i + 0.3 * smooth(0.9, 1, i); };

  /* ---------- colour of things ---------- */
  function signColorAt(lon) {
    const L = E_.norm360(lon), i = Math.floor(L / 30), d = L % 30;
    const c = C.SIGNS[i].color;
    if (d > 28) return K.mixLight(c, C.SIGNS[(i + 1) % 12].color, (d - 28) / 4, 0);
    if (d < 2) return K.mixLight(c, C.SIGNS[(i + 11) % 12].color, (2 - d) / 4, 0);
    return c;
  }
  /* core = tincture, nudged ≤15% toward the sign; clarity from dignity */
  function coreColor(state, key) {
    const P = C.PLANETS[key], b = state.bodies[key];
    if (key === 'saturn') return P.tincture;
    let c = K.mixLight(P.tincture, signColorAt(b.lon), P.kind === 'optic' ? 0.05 : 0.15, 0);
    c = K.shade(K.clarify(c, b.clarity), -0.2 * (1 - b.clarity));
    if (b.combust) c = K.mixLight(c, '#fff6dc', 0.35, 0.05);
    return c;
  }
  /* presence: what a planet contributes to a figure — core leaning further into its aura */
  function presence(state, key) {
    const b = state.bodies[key], P = C.PLANETS[key];
    if (key === 'saturn') return P.tincture;
    if (key === 'neptune') return '#eef3ff';
    if (key === 'pluto') return '#2a1418';
    if (key === 'uranus') return K.mixLight('#cfe3f0', signColorAt(b.lon), 0.35, 0.02);
    return K.clarify(K.mixLight(P.tincture, signColorAt(b.lon), 0.3, 0), b.clarity);
  }
  const lightness = c => K.lab(c)[0];

  /* ---------- layout ---------- */
  function layout(S, tight = TIGHT) {
    const u = S / 2048, t = tight ? 1.17 : 1;
    return {
      S, u, tight, cx: S / 2, cy: S * (tight ? 0.5 : 0.435),
      Rb: S * 0.405 * t,              // dodecagon circumradius — the container, a narrow band; the houses are drawn across it
      Rz: S * 0.375 * t,              // bezel inner edge / zodiac ring outer
      Rzi: S * (tight ? 0.343 : 0.35) * t,   // zodiac ring inner: the ring is wider on a phone, for the glyphs
      R: S * (tight ? 0.338 : 0.345) * t,    // sky
      capY: S * 0.872,
      ts: Math.min(2.6, Math.max(1, 2000 / S)),   // text scale of the frame marks: a phone's canvas is small, its marks must stay readable
      tc: Math.min(1.55, Math.max(1, 1400 / S))   // text scale of the caption: exports keep the master size
    };
  }
  /* mundane placement: angle = Placidian time position, radius = altitude */
  function skyPoint(Lt, b) {
    const th = Math.PI + (b.lon - Lt.asc) * Math.PI / 180;   // the same projection as the rete: one sky, one angle
    const r = Lt.R * (0.62 + 0.33 * clamp(Math.abs(b.alt) / 90));
    return { x: Lt.cx + r * Math.cos(th), y: Lt.cy - r * Math.sin(th), th, r };
  }
  /* ecliptic placement: the rete, rotated so the ascendant sits on the eastern horizon */
  const eclAngle = (state, lon) => Math.PI + (lon - state.asc) * Math.PI / 180;
  const polar = (Lt, th, r) => ({ x: Lt.cx + r * Math.cos(th), y: Lt.cy - r * Math.sin(th) });

  /* ---------- noise ---------- */
  function hash(i, j, s) {
    let h = Math.imul(i, 374761393) ^ Math.imul(j, 668265263) ^ Math.imul(s, 982451653);
    h = Math.imul(h ^ (h >>> 13), 1274126177);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967295;
  }
  function vnoise(x, y, s) {
    const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = hash(xi, yi, s), b = hash(xi + 1, yi, s), c = hash(xi, yi + 1, s), d = hash(xi + 1, yi + 1, s);
    return a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v;
  }
  function fbm(x, y, s, o = 4) {
    let v = 0, a = 0.5, f = 1;
    for (let i = 0; i < o; i++) { v += a * vnoise(x * f, y * f, s + i * 17); f *= 2.03; a *= 0.5; }
    return v / (1 - Math.pow(0.5, o));
  }

  /* ---------- the field: three lights, midnight between ---------- */
  function lights(state, Lt) {
    const B = state.bodies, day = state.sect === 'day';
    const sp = skyPoint(Lt, B.sun), mp = skyPoint(Lt, B.moon);
    const toU = p => ({ x: (p.x - Lt.cx) / Lt.R, y: (p.y - Lt.cy) / Lt.R });
    const L = [
      { name: 'ascendant', pos: { x: -1.0, y: 0 }, color: signColorAt(state.asc), w: 0.30, sigma: 0.62 },
      { name: 'sun', pos: toU(sp), color: signColorAt(B.sun.lon), w: (day ? 0.45 : 0.25) * (B.sun.alt > 0 ? 1 : 0.5), sigma: 0.55 },
      { name: 'moon', pos: toU(mp), color: signColorAt(B.moon.lon), w: (day ? 0.25 : 0.45) * (0.45 + 0.55 * state.moon.illum), sigma: 0.48 }
    ];
    if (state.pair && state.natal) {                        // synastry: the second chart's lights join the field, so the ground is both skies blended
      const N = state.natal, a2 = Math.PI + (N.asc - Lt.asc) * Math.PI / 180;
      L.push({ name: 'ascendant2', pos: { x: Math.cos(a2), y: -Math.sin(a2) }, color: signColorAt(N.asc), w: 0.22, sigma: 0.6 });
      L.push({ name: 'sun2', pos: toU(skyPoint(Lt, N.bodies.sun)), color: signColorAt(N.bodies.sun.lon), w: 0.3, sigma: 0.55 });
      L.push({ name: 'moon2', pos: toU(skyPoint(Lt, N.bodies.moon)), color: signColorAt(N.bodies.moon.lon), w: 0.26, sigma: 0.48 });
    }
    return L;
  }
  const fieldCache = { key: null, canvas: null };

  /* The field: three lights over midnight — ascendant from the eastern horizon, sun and moon where
     they stand, in their sign colours, weighted by sect. Pure light, no texture: a colour field. */
  function buildLight(state, Lt, N) {
    const key = ['l', N, Lt.ext || 1, Math.round(state.date.getTime() / 60000), state.loc.lat, state.loc.lon].join('|');
    if (fieldCache.key === key) return fieldCache.canvas;
    const cv = fieldCache.canvas && fieldCache.canvas.width === N ? fieldCache.canvas : document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const img = g.createImageData(N, N);
    const lin = c => K.hexToRgb(c).map(v => Math.pow(v, 2.2));
    const L = lights(state, Lt).map(l => ({ ...l, lin: lin(l.color) }));
    const base = lin(MIDNIGHT);
    const E = lunarE(state);
    const ext = Lt.ext || 1.08;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) * 2 - 1) * ext, y = (j / (N - 1) * 2 - 1) * ext;
      const rr = x * x + y * y, o = (j * N + i) * 4;
      if (!Lt.bleed && rr > ext * ext) { img.data[o + 3] = 0; continue; }
      let r = base[0], gg = base[1], b = base[2];
      for (const l of L) {
        const dx = x - l.pos.x, dy = y - l.pos.y;
        const f = 1.35 * l.w * Math.exp(-(dx * dx + dy * dy) / (2 * l.sigma * l.sigma));
        r += l.lin[0] * f; gg += l.lin[1] * f; b += l.lin[2] * f;
      }
      const under = 1 - 0.32 * smooth(0, 0.35, y);           // below the horizon: under the earth
      const vig = 0.55 + 0.45 * (1 - Math.min(1, rr));
      const k = E * under * vig;
      img.data[o] = 255 * Math.pow(1 - Math.exp(-r * k * 2.6), 1 / 2.2);
      img.data[o + 1] = 255 * Math.pow(1 - Math.exp(-gg * k * 2.6), 1 / 2.2);
      img.data[o + 2] = 255 * Math.pow(1 - Math.exp(-b * k * 2.6), 1 / 2.2);
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    fieldCache.key = key; fieldCache.canvas = cv;
    return cv;
  }

  function buildField(state, Lt, N) {
    const key = [N, Lt.ext || 1, Math.round(state.date.getTime() / 60000), state.loc.lat, state.loc.lon].join('|');
    if (fieldCache.key === key) return fieldCache.canvas;
    const cv = fieldCache.canvas && fieldCache.canvas.width === N ? fieldCache.canvas : document.createElement('canvas');
    cv.width = cv.height = N;
    const g = cv.getContext('2d');
    const img = g.createImageData(N, N);
    const lin = c => K.hexToRgb(c).map(v => Math.pow(v, 2.2));
    // each light carries two neighbouring hues; the smoke drifts between them
    const L = lights(state, Lt).map(l => ({ ...l, lin: lin(l.color), linA: lin(K.hueShift(l.color, -28)), linB: lin(K.hueShift(K.shade(l.color, 0.06), 30)) }));
    const base = K.hexToRgb(MIDNIGHT).map(c => Math.pow(c, 2.2));
    const E = lunarE(state);
    const seed = Math.floor(state.date.getTime() / 864e5);   // one weather per day, drifting with the hour
    const drift = (state.date.getTime() / 3600e3) % 1000 * 0.07;
    const ext = Lt.ext || 1.08;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
      const x = (i / (N - 1) * 2 - 1) * ext, y = (j / (N - 1) * 2 - 1) * ext;
      const rr = x * x + y * y;
      const o = (j * N + i) * 4;
      if (!Lt.bleed && rr > ext * ext) { img.data[o + 3] = 0; continue; }
      // domain-warped fbm: smoke, not stars
      const qx = fbm(x * 1.6 + drift, y * 1.6, seed, 3), qy = fbm(x * 1.6 + 5.2, y * 1.6 - drift, seed + 3, 3);
      const n1 = fbm(x * 2.2 + 3.0 * qx, y * 2.2 + 3.0 * qy, seed + 7, 4);
      const n2 = fbm(x * 4.1 - 1.7 * qy, y * 4.1 + 1.7 * qx, seed + 11, 3);
      const veil = Math.pow(n1, 1.8);
      const n3 = fbm(x * 1.3 - qy, y * 1.3 + qx, seed + 19, 3);                  // hue drift
      const lane = smooth(0.28, 0.72, fbm(x * 2.8 + 2 * qy, y * 2.8 - 2 * qx, seed + 23, 4)); // dust lanes
      const rid = 1 - Math.abs(2 * fbm(x * 5.2 + 4 * qx, y * 5.2 + 4 * qy, seed + 29, 4) - 1);
      const fil = Math.pow(rid, 7);                                                // filaments
      const dust = 0.38 + 0.62 * lane;
      let r = base[0] * (0.45 + 0.8 * n2), gg = base[1] * (0.45 + 0.8 * n2), b = base[2] * (0.5 + 0.9 * n2);
      for (const l of L) {
        const dx = x - l.pos.x, dy = y - l.pos.y;
        const fall = l.w * Math.exp(-(dx * dx + dy * dy) / (2 * l.sigma * l.sigma));
        const f = fall * (0.12 + 1.6 * veil * dust + 0.9 * fil);
        const h = n3;
        r += (l.linA[0] * (1 - h) + l.linB[0] * h) * f;
        gg += (l.linA[1] * (1 - h) + l.linB[1] * h) * f;
        b += (l.linA[2] * (1 - h) + l.linB[2] * h) * f;
      }
      const under = 1 - 0.22 * smooth(0, 0.35, y);           // below the horizon: under the earth
      const vig = 0.72 + 0.28 * (1 - Math.min(1, rr));
      const k = E * under * vig;
      img.data[o] = 255 * Math.pow(1 - Math.exp(-r * k * 2.2), 1 / 2.2);
      img.data[o + 1] = 255 * Math.pow(1 - Math.exp(-gg * k * 2.2), 1 / 2.2);
      img.data[o + 2] = 255 * Math.pow(1 - Math.exp(-b * k * 2.2), 1 / 2.2);
      img.data[o + 3] = 255;
    }
    g.putImageData(img, 0, 0);
    fieldCache.key = key; fieldCache.canvas = cv;
    return cv;
  }

  /* ---------- engraved field (prototype) ----------
     Concentric guilloché lines about the pole, twelve waves to the turn. Each short segment takes the
     colour of the lights at that point, flat; its weight and opacity carry their intensity, as in intaglio. */
  const engraveCache = { key: null, canvas: null };
  function drawEngravedField(ctx, state, Lt, density = 1) {
    const m = ctx.getTransform(), k = m.a;
    const ext = Lt.ext || 1;
    const key = [Lt.S, Lt.R, k.toFixed(3), density, ext, GUILLOCHE ? 'g' : 'e', Math.round(state.date.getTime() / 60000), state.loc.lat, state.loc.lon].join('|');
    const px = Math.ceil(Lt.R * 2 * ext * k) + 4;
    if (engraveCache.key !== key) {
      const cv = engraveCache.canvas || document.createElement('canvas');
      const g = cv.getContext('2d');
      if (cv.width !== px) cv.width = cv.height = px; else { g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, px, px); }   // clear under the identity: under the old transform only part of the plate was wiped, and the next minute's rings were drawn over the rest, a doubled rectangle
      g.setTransform(k, 0, 0, k, px / 2 - Lt.cx * k, px / 2 - Lt.cy * k);
      engrave(g, state, Lt, density);
      engraveCache.key = key; engraveCache.canvas = cv;
    }
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(engraveCache.canvas, Math.round(Lt.cx * k + m.e - px / 2), Math.round(Lt.cy * k + m.f - px / 2));
    ctx.restore();
  }
  function engrave(ctx, state, Lt, density) {
    const L = lights(state, Lt).map(l => ({ ...l, rgb: K.hexToRgb(l.color) }));
    const k = ctx.getTransform().a || 1;                   // device pixels per unit. the rings never closer than 3.2 device pixels, the pitch a retina screen shows: on a plain screen the old pitch was 1.6 pixels and aliased into moiré
    const E = lunarE(state), u = Lt.u, step = Math.max((GUILLOCHE ? Math.max(4.4 * u, 3.0) : 4.4 * u) / density, 3.2 / k), segLen = (GUILLOCHE ? 5 : 7) * u / density;
    const drift = 0.037;                                    // the waves' slow phase drift from ring to ring, as the approved engraving had it
    const lobes = 96, amp = Math.max(1.25 * u, 1.0);         // guilloché: grain d'orge as fine as the older engraving, alternate rings half a period apart
    let ring = 0;
    ctx.save(); ctx.lineCap = 'butt';
    for (let r = step; r < Lt.R * (Lt.ext || 1); r += step, ring++) {
      const segs = Math.max(24, Math.round(TAU * r / segLen));
      for (let j = 0; j < segs; j++) {
        const a0 = j / segs * TAU, a1 = (j + 1) / segs * TAU, am = (a0 + a1) / 2;
        const x = r * Math.cos(am) / Lt.R, y = -r * Math.sin(am) / Lt.R;   // unit coords, y down as in lights()
        let I = 0, cr = 0, cg = 0, cb = 0;
        for (const l of L) {
          const dx = x - l.pos.x, dy = y - l.pos.y;
          const f = l.w * Math.exp(-(dx * dx + dy * dy) / (2 * l.sigma * l.sigma));
          I += f; cr += l.rgb[0] * f; cg += l.rgb[1] * f; cb += l.rgb[2] * f;
        }
        const under = 1 - 0.4 * smooth(0, 0.35, y);
        const kk = Math.min(1, I * 2.2 * E * under);
        ctx.strokeStyle = `rgba(${Math.round(255 * cr / I)},${Math.round(255 * cg / I)},${Math.round(255 * cb / I)},${(0.18 + 0.82 * kk).toFixed(3)})`;
        ctx.lineWidth = Math.min(step * 0.7, u * (0.45 + 2.6 * kk) / Math.sqrt(density));   // a line at most seven tenths of the gap: the rings blend into a field, they do not merge into a wall
        ctx.beginPath();
        for (let q = 0; q <= 4; q++) {
          const a = a0 + (a1 - a0) * q / 4, rr = GUILLOCHE ? r + amp * Math.sin(lobes * a + (ring % 2) * Math.PI) : r + 2.1 * u * Math.sin(12 * a + r * drift);
          const px = Lt.cx + rr * Math.cos(a), py = Lt.cy - rr * Math.sin(a);
          q ? ctx.lineTo(px, py) : ctx.moveTo(px, py);
        }
        ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---------- the luminaries' field ----------
     Sun = source, moon = sink. In the plane, the streamlines of a source and a sink are exactly the circles
     through both points (the pencil Frieda Harris drew), and the equipotentials are the Apollonian circles
     around each. So the weave is the sun's outflow arriving in the moon's cup. The flow runs gold to silver;
     its pace follows how full the cup is (the moon's light); the cup is drawn as rings around the moon. */
  /* ---------- Harris weave: one figure spanning the two luminaries ----------
     The circles through both sun and moon, drawn only between them: a spindle of arcs,
     gold at the sun, silver at the moon. Tight at new moon, spanning the dial at full. */
  function drawWeave(ctx, state, Lt, lw, E) {
    const B = state.bodies;
    const s = skyPoint(Lt, B.sun), m = skyPoint(Lt, B.moon);
    const mx = (s.x + m.x) / 2, my = (s.y + m.y) / 2;
    const dx = m.x - s.x, dy = m.y - s.y;
    const c = Math.hypot(dx, dy) / 2;
    const sunC = K.mixLight(C.PLANETS.sun.tincture, signColorAt(B.sun.lon), 0.35, 0.05);
    const moonC = K.mixLight(C.PLANETS.moon.tincture, signColorAt(B.moon.lon), 0.35, 0.05);
    const arcs = [];
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.lineWidth = lw * 0.75;
    withBlur(ctx, 5 * Lt.u * B.venus.slow, () => {        // venus owns the curves
      if (c < Lt.R * 0.03) {                            // conjunction: the spindle closes to rings
        ctx.strokeStyle = K.rgba(K.mixLight(sunC, moonC, 0.5, 0), 0.2 * E);
        for (let i = 1; i <= 4; i++) { ctx.beginPath(); ctx.arc(mx, my, Lt.R * 0.03 * i, 0, TAU); ctx.stroke(); }
        return;   // new moon: source and sink coincide, nothing flows
      }
      // the cup: equipotential rings closing around the moon
      ctx.save();
      ctx.strokeStyle = K.rgba(moonC, 0.3 * E);
      for (let i = 1; i <= 4; i++) {
        const sh = 0.55 + i * 0.32, cth = Math.cosh(sh) / Math.sinh(sh), r = c / Math.sinh(sh);
        const ux0 = dx / (2 * c), uy0 = dy / (2 * c);
        ctx.beginPath(); ctx.arc(mx + ux0 * c * cth, my + uy0 * c * cth, r, 0, TAU); ctx.stroke();
      }
      ctx.restore();
      const g = ctx.createLinearGradient(s.x, s.y, m.x, m.y);
      g.addColorStop(0, K.rgba(sunC, 0.36 * E)); g.addColorStop(1, K.rgba(moonC, 0.36 * E));
      ctx.strokeStyle = g;
      const ux = dx / (2 * c), uy = dy / (2 * c), nx = -uy, ny = ux;
      ctx.beginPath(); ctx.moveTo(s.x, s.y); ctx.lineTo(m.x, m.y); ctx.stroke();
      arcs.push({ line: true, s, m });
      for (let i = 1; i <= 8; i++) for (const sg of [-1, 1]) {
        const a = i * Math.PI / 18, t = sg * c / Math.tan(a), r = c / Math.sin(a);
        const ox = mx + nx * t, oy = my + ny * t;
        const a1 = Math.atan2(s.y - oy, s.x - ox), a2 = Math.atan2(m.y - oy, m.x - ox);
        let d = a2 - a1; while (d > Math.PI) d -= TAU; while (d <= -Math.PI) d += TAU;
        ctx.beginPath(); ctx.arc(ox, oy, r, a1, a1 + d, d < 0); ctx.stroke();
        arcs.push({ ox, oy, r, a1, d });
      }
    });
    ctx.restore();
    return { arcs, sunC, moonC, s, m };
  }
  /* the flow: particles leaving the sun along every streamline and arriving in the moon */
  function drawFlow(ctx, weave, state, Lt, E, t) {
    if (!weave || !weave.arcs.length) return;
    const pace = 0.03 + 0.09 * state.moon.illum, per = 1 + Math.round(2 * state.bodies.sun.clarity);
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    weave.arcs.forEach((A, i) => {
      for (let j = 0; j < per; j++) {
        const f = ((t * pace + i * 0.618 + j / per) % 1 + 1) % 1;
        const x = A.line ? A.s.x + (A.m.x - A.s.x) * f : A.ox + A.r * Math.cos(A.a1 + A.d * f);
        const y = A.line ? A.s.y + (A.m.y - A.s.y) * f : A.oy + A.r * Math.sin(A.a1 + A.d * f);
        const fade = Math.sin(Math.PI * f);
        ctx.fillStyle = K.rgba(K.mixLight(weave.sunC, weave.moonC, f, 0.1), 0.85 * fade * E);
        ctx.beginPath(); ctx.arc(x, y, Lt.u * 3.2, 0, TAU); ctx.fill();
      }
    });
    ctx.restore();
  }

  /* ---------- figures: the rose engine ---------- */
  function hardness(cfg) {
    let h = { soft: 0.08, fusion: 0.3, creative: 0.42, fated: 0.55, hard: 0.86 }[cfg.nature] ?? 0.5;
    for (const p of [cfg.a, cfg.b]) { h -= 0.18 * (C.BENEFIC[p] || 0); h += 0.12 * (C.MALEFIC[p] || 0); }
    return clamp(h, 0, 1);
  }
  function figureColor(state, cfg) {
    const a = presence(state, cfg.a), b = presence(state, cfg.b);
    if (cfg.a === 'pluto') return b;             // pluto lends no pigment
    if (cfg.b === 'pluto') return a;
    if (cfg.nature === 'hard') return K.mixPigment(a, b, 0.3);
    return K.mixLight(a, b, 0.5, cfg.nature === 'fusion' ? 0.06 : 0.03);
  }
  /* star polygon {n/k} vertices; k = 0 or n < 3 handled by caller */
  function starVerts(cx, cy, r, n, rot) {
    const v = [];
    for (let i = 0; i < n; i++) { const a = rot + i * TAU / n; v.push({ x: cx + r * Math.cos(a), y: cy - r * Math.sin(a) }); }
    return v;
  }
  /* the edges of {n/k}, as segments, for both drawing and constellation */
  function starEdges(verts, n, k) {
    const e = [];
    if (n < 3) return e;
    for (let i = 0; i < n; i++) e.push([verts[i], verts[(i + k) % n]]);
    return e;
  }

  /* A line holds its colour: core drawn over, glow screened. Black (saturn) is carved, edged by the other force. */
  function strokeGlow(ctx, path, color, lw, alpha, E, accent) {
    if (PURE) { const ratio = PURE_SIMPLE ? 1 : Math.max(0.3, Math.min(1, lw / PURE_BASE)); ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = PURE_SIMPLE ? '#fbf8f0' : `rgba(251,248,240,${(PURE_ALPHA * (ratio < 0.6 ? 0.6 : 1)).toFixed(2)})`; ctx.lineWidth = PURE_LW * ratio; ctx.lineJoin = 'round'; ctx.lineCap = 'round'; ctx.stroke(path); return; }   // the sigil: solid ink; the edges at the full weight, bands and rays finer in proportion (before the engraving's own rule)
    if (ENGRAVE && lightness(color) >= 0.22) { ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = K.rgba(color, Math.min(1, alpha)); ctx.lineWidth = lw * 0.75; ctx.stroke(path); return; }
    const dark = lightness(color) < 0.22;
    if (dark) {
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = K.rgba('#000000', 0.8 * alpha); ctx.lineWidth = lw * 3; ctx.stroke(path);
      ctx.strokeStyle = K.rgba(accent || C.PLANETS.saturn.rim, 0.8 * alpha); ctx.lineWidth = lw * 0.55; ctx.stroke(path);
      return;
    }
    ctx.globalCompositeOperation = 'screen';
    ctx.strokeStyle = K.rgba(color, 0.18 * alpha * E); ctx.lineWidth = lw * 5; ctx.stroke(path);
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = K.rgba(color, Math.min(1, alpha)); ctx.lineWidth = lw; ctx.stroke(path);
  }
  /* an edge that passes from one planet to the other: a smooth passage when soft, a hard split when hard */
  function strokeEdge(ctx, a, b, path, cA, cB, hard, lw, alpha, E) {
    if (PURE) return strokeGlow(ctx, path, cA, lw, alpha, E);
    const dA = lightness(cA) < 0.22, dB = lightness(cB) < 0.22;
    if (dA || dB) {                                       // saturn's half is a groove
      ctx.globalCompositeOperation = 'source-over';
      ctx.strokeStyle = K.rgba('#000000', 0.7 * alpha); ctx.lineWidth = lw * 3; ctx.stroke(path);
      if (dA) cA = C.PLANETS.saturn.rim;
      if (dB) cB = C.PLANETS.saturn.rim;
    }
    const grad = op => {
      const g = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
      if (hard) { g.addColorStop(0, K.rgba(cA, op)); g.addColorStop(0.5, K.rgba(cA, op)); g.addColorStop(0.5, K.rgba(cB, op)); g.addColorStop(1, K.rgba(cB, op)); }
      else { g.addColorStop(0, K.rgba(cA, op)); g.addColorStop(1, K.rgba(cB, op)); }
      return g;
    };
    if (!ENGRAVE) { ctx.globalCompositeOperation = 'screen'; ctx.strokeStyle = grad(0.12 * alpha * E); ctx.lineWidth = lw * 4.5; ctx.stroke(path); }
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = grad(0.88 * alpha); ctx.lineWidth = lw; ctx.stroke(path);
  }

  /* rose engine: passes twist clockwise (sign +1) or counter-clockwise (sign -1) */
  function roseBand(n, passes, h, R, rot, cx, cy, sign) {
    const paths = [];
    const P = Math.max(2, n);
    for (let j = 0; j < passes; j++) {
      const rho = 0.5 + 0.48 * (j + 1) / passes;
      const amp = (0.05 + 0.1 * (1 - j / passes)) * (1 + 0.6 * h);
      const ph = sign * j * (Math.PI / P) * 0.32;
      const p = new Path2D();
      const M = 720;
      for (let s = 0; s <= M; s++) {
        const th = s / M * TAU;
        const x = ((P * (th - rot + ph)) / TAU) % 1;        // 0..1 within a petal
        const tri = Math.abs(2 * ((x + 1) % 1) - 1);         // 1 at petal tip, 0 between
        const soft = 0.5 + 0.5 * Math.cos((1 - tri) * Math.PI);
        const hard = Math.pow(tri, 4.5);
        const f = soft + (hard - soft) * h;
        const r = R * rho * (1 - amp + amp * f);
        const px = cx + r * Math.cos(th), py = cy - r * Math.sin(th);
        s === 0 ? p.moveTo(px, py) : p.lineTo(px, py);
      }
      p.closePath();
      paths.push(p);
    }
    return paths;
  }

  /* the colour each planet lends a figure; pluto lends none, it compresses the other's */
  function lend(state, key, other, t) {
    if (key === 'pluto') return K.shade(presence(state, other), -0.18);
    const c = presence(state, key);
    return key === 'uranus' ? K.hueShift(c, 50 * Math.sin(t * 0.5)) : c;
  }

  /* draws one configuration; returns its constellation-eligible geometry */
  function drawFigure(ctx, state, Lt, cfg, R, role, lw, E, t) {
    const B = state.bodies;
    const n = cfg.n, k = cfg.k;
    const rot = eclAngle(state, B[cfg.a].lon);
    const h = hardness(cfg);
    const hard = cfg.nature === 'hard';
    const cA = lend(state, cfg.a, cfg.natal ? cfg.a : cfg.b, t), cB = cfg.natal ? NATAL_INK : lend(state, cfg.b, cfg.a, t + 1.7);
    const col = cfg.natal ? K.mixLight(cA, NATAL_INK, 0.5, 0.02) : figureColor(state, cfg);   // the relationship: only the translucent fill
    const accent = lightness(cA) > lightness(cB) ? cA : cB;
    const dark = lightness(col) < 0.22;
    const primary = role === 'primary';
    const alpha = primary ? 1 : 0.38;
    R *= 1 + 0.006 * Math.sin(t * 0.6 + (primary ? 0 : 2));
    const cx = Lt.cx, cy = Lt.cy;
    const blur = { curves: 5 * Lt.u * B.venus.slow, rays: 5 * Lt.u * B.mercury.slow, points: 4 * Lt.u * B.mars.slow };
    const sg = (p, c, w, a) => strokeGlow(ctx, p, c, w, a, E, accent);
    const AB = i => (i % 2 ? cB : cA);
    ctx.save();
    const geo = { verts: [], edges: [], power: cfg.power, role };

    // rose-engine band: planet A's passes twist clockwise, planet B's counter-clockwise
    if (primary && !PURE_SIMPLE) {
      const passes = clamp(Math.round(4 + 3 * Math.min(1, cfg.power)), 4, 7);
      const nP = n === 1 ? ((C.PLANETS[cfg.a].number || 0) + (C.PLANETS[cfg.b].number || 0) || 12) : n;
      const bandA = roseBand(nP, passes, h, R, rot, cx, cy, 1);
      const bandB = roseBand(nP, passes, h, R, rot, cx, cy, -1);
      withBlur(ctx, blur.curves, () => {
        bandA.forEach((p, i) => sg(p, cA, lw * 0.5, alpha * (0.3 + 0.45 * i / passes)));
        bandB.forEach((p, i) => sg(p, cB, lw * 0.5, alpha * (0.3 + 0.45 * i / passes)));
      });
    }

    // stained glass: the relationship as a translucent fill (harris)
    const facet = path => {
      if (PURE) return;
      if (ENGRAVE) { ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.fillStyle = dark ? 'rgba(0,0,0,0.3)' : K.rgba(col, 0.13 * alpha); ctx.fill(path, 'evenodd'); ctx.restore(); return; }
      ctx.save();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, R);
      if (dark) { g.addColorStop(0, 'rgba(0,0,0,0.42)'); g.addColorStop(1, 'rgba(0,0,0,0.05)'); ctx.globalCompositeOperation = 'source-over'; }
      else { g.addColorStop(0, K.rgba(col, 0.2 * alpha * E)); g.addColorStop(0.7, K.rgba(col, 0.08 * alpha * E)); g.addColorStop(1, K.rgba(col, 0)); ctx.globalCompositeOperation = 'screen'; }
      ctx.fillStyle = g; ctx.fill(path, 'evenodd');
      ctx.restore();
    };

    if (n === 1) {                                        // conjunction: two interlaced roses of the summed number
      const P = (C.PLANETS[cfg.a].number || 0) + (C.PLANETS[cfg.b].number || 0) || 12;
      const roseAt = off => {
        const rose = new Path2D();
        for (let s2 = 0; s2 <= 1440; s2++) {
          const th = s2 / 1440 * TAU * 2;
          const r = R * 0.86 * Math.abs(Math.cos(P * (th - rot - off) / 2));
          const x = cx + r * Math.cos(th), y = cy - r * Math.sin(th);
          s2 ? rose.lineTo(x, y) : rose.moveTo(x, y);
        }
        return rose;
      };
      const rA = roseAt(Math.PI / P * 0.12), rB = roseAt(-Math.PI / P * 0.12);
      if (PURE_SIMPLE) { const one = new Path2D(); one.arc(cx, cy, R * 0.86, 0, TAU); sg(one, cA, lw, alpha); }   // the sigil: a conjunction is one ring, one weight, no rose
      else {
        if (primary) facet(rA);
        withBlur(ctx, blur.curves, () => { sg(rA, cA, lw * 0.9, alpha); sg(rB, cB, lw * 0.9, alpha); });
      }
      const ring = starVerts(cx, cy, R * 0.86, P, rot);
      geo.verts = ring; for (let i = 0; i < P; i++) geo.edges.push([ring[i], ring[(i + 1) % P]]);
    } else if (n === 2) {                                 // opposition: vesica piscis on the axis, one circle each
      const d = R * 0.42, ax = Math.cos(rot), ay = -Math.sin(rot);
      const ves = new Path2D();
      for (const s of [-1, 1]) { ves.moveTo(cx + s * ax * d / 2 + d, cy + s * ay * d / 2); ves.arc(cx + s * ax * d / 2, cy + s * ay * d / 2, d, 0, TAU); }
      if (primary) facet(ves);
      withBlur(ctx, blur.curves, () => {
        for (const s of [1, -1]) { const p = new Path2D(); p.arc(cx + s * ax * d / 2, cy + s * ay * d / 2, d, 0, TAU); sg(p, s > 0 ? cA : cB, lw, alpha); }
      });
      const e0 = { x: cx + ax * R, y: cy + ay * R }, e1 = { x: cx - ax * R, y: cy - ay * R };
      withBlur(ctx, blur.rays, () => { const p = new Path2D(); p.moveTo(e0.x, e0.y); p.lineTo(e1.x, e1.y); strokeEdge(ctx, e0, e1, p, cA, cB, true, lw * 0.8, alpha, E); });
      geo.verts = [{ x: cx - ax * R * 0.71, y: cy - ay * R * 0.71 }, { x: cx + ax * R * 0.71, y: cy + ay * R * 0.71 }];
      const hx = -ay * d * Math.sqrt(3) / 2, hy = ax * d * Math.sqrt(3) / 2;
      geo.verts.push({ x: cx + hx, y: cy + hy }, { x: cx - hx, y: cy - hy });
      geo.edges.push([geo.verts[0], geo.verts[1]], [geo.verts[2], geo.verts[3]]);
    } else {
      const v = starVerts(cx, cy, R * 0.9, n, rot);
      const edges = starEdges(v, n, k);
      geo.verts = v; geo.edges = edges;
      const circles = [];
      for (let i = 0; i < n; i++) {
        const a = rot + i * TAU / n, rc = R * 0.45, x0 = cx + rc * Math.cos(a), y0 = cy - rc * Math.sin(a);
        const p = new Path2D(); p.arc(x0, y0, rc, 0, TAU); circles.push(p);
      }
      const edgePath = (a, b) => {
        const p = new Path2D(); p.moveTo(a.x, a.y);
        if (h > 0.6) p.lineTo(b.x, b.y);
        else { const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, bow = (0.6 - h) * 0.55; p.quadraticCurveTo(mx + (mx - cx) * bow, my + (my - cy) * bow, b.x, b.y); }
        return p;
      };
      if (primary) {
        if (h < 0.6) { const chain = new Path2D(); circles.forEach(c => chain.addPath(c)); facet(chain); }
        else { const poly = new Path2D(); v.forEach((q, i) => (i ? poly.lineTo(q.x, q.y) : poly.moveTo(q.x, q.y))); poly.closePath(); facet(poly); }
      }
      // soft: circle chain through the pole (n = 6 is the seed of life), circles alternating between the two planets
      if (h < 0.6 && !PURE_SIMPLE) withBlur(ctx, blur.curves, () => circles.forEach((c, i) => sg(c, AB(i), lw * (0.9 - 0.5 * h), alpha * (1 - 0.6 * h))));
      // star polygon: each edge passes from one planet's colour to the other's
      withBlur(ctx, blur.points, () => {
        edges.forEach(([a, b], i) => strokeEdge(ctx, a, b, edgePath(a, b), i % 2 ? cB : cA, i % 2 ? cA : cB, hard, lw * (0.8 + 0.5 * h), alpha, E));
        if (h > 0.6 && !PURE_SIMPLE) v.forEach((q, i) => { const d = new Path2D(); d.arc(q.x, q.y, lw * 1.6, 0, TAU); sg(d, AB(i), lw, alpha); });
      });
      // spokes — rays (mercury)
      if (!PURE_SIMPLE) withBlur(ctx, blur.rays, () => v.forEach((q, i) => { const p = new Path2D(); p.moveTo(cx, cy); p.lineTo(q.x, q.y); sg(p, AB(i), lw * 0.4, alpha * 0.45); }));
    }
    ctx.restore();
    return geo;
  }

  /* station: the planet's own number, as hour-marks just outside the portal. pluto has no number: it bends the portal instead */
  function drawStation(ctx, state, Lt, st, R, lw, E) {
    if (!st.n) return;
    const b = state.bodies[st.planet];
    const col = st.planet === 'saturn' ? C.PLANETS.saturn.rim : C.PLANETS[st.planet].kind === 'optic' ? INK : coreColor(state, st.planet);
    const rot = eclAngle(state, b.lon);
    ctx.save();
    const p = new Path2D();
    for (let i = 0; i < st.n; i++) {
      const a = rot + i * TAU / st.n, p0 = polar(Lt, a, R * 1.09), p1 = polar(Lt, a, R * 1.16);
      p.moveTo(p0.x, p0.y); p.lineTo(p1.x, p1.y);
    }
    ctx.lineCap = 'round'; ctx.strokeStyle = K.rgba(col, 0.85); ctx.lineWidth = lw * 1.4; ctx.stroke(p);
    ctx.restore();
  }

  /* the guardians: day ruler and hour ruler as their planetary stars, point up, inside a soft light.
     one ruler: one pure figure. two: they overlap, sharing gcd(n1, n2) points. */
  const GUARD_K = { 3: 1, 4: 1, 5: 2, 6: 2, 7: 3, 8: 3, 9: 4 };
  function drawGuardians(ctx, state, Lt, E) {
    const d = state.hour.dayRuler, hr = state.hour.hourRuler;
    const cx = Lt.cx, cy = Lt.cy, rg = Lt.R * 0.095;
    const dc = C.PLANETS[d].tincture, hc = C.PLANETS[hr].tincture;
    ctx.save();
    // the light: warm white, tinted by the two guardians
    // the light is the ripeness of the moment, read from the moon: warm when ripe, cold when unripe, out when void
    const v = state.moon.verdict;
    let tint = K.mixLight(K.mixLight(dc === '#040507' ? '#9aa0ab' : dc, hc === '#040507' ? '#9aa0ab' : hc, 0.5, 0), '#fff4dc', 0.6, 0);
    if (v === 'unripe') tint = K.mixLight(tint, '#7d889c', 0.7, -0.08);
    const level = { ripe: 1.25, open: 0.9, unripe: 0.45, void: state.moon.tolerable ? 0.28 : 0 }[v];   // void but tolerable (lilly): a low light stays
    if (PURE) { /* the sigil carries the stars only */ }
    else if (level > 0 && v !== 'void') {
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rg * 2.6);
      g.addColorStop(0, K.rgba(tint, 0.55 * E * level)); g.addColorStop(0.35, K.rgba(tint, 0.18 * E * level)); g.addColorStop(1, K.rgba(tint, 0));
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rg * 2.6, 0, TAU); ctx.fill();
    } else {                                              // void: the door is closed — a dark pupil, and the whole portal dims around it
      ctx.globalCompositeOperation = 'source-over';
      if (level > 0) {                                    // tolerable: a low light remains at the pole
        const gl = ctx.createRadialGradient(cx, cy, 0, cx, cy, rg * 2.2);
        gl.addColorStop(0, K.rgba(tint, 0.45 * E * level)); gl.addColorStop(1, K.rgba(tint, 0));
        ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = gl; ctx.beginPath(); ctx.arc(cx, cy, rg * 2.2, 0, TAU); ctx.fill();
        ctx.globalCompositeOperation = 'source-over';
      }
      const g0 = ctx.createRadialGradient(cx, cy, rg * 1.2, cx, cy, rg * 6);
      g0.addColorStop(0, 'rgba(0,0,0,0.55)'); g0.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g0; ctx.beginPath(); ctx.arc(cx, cy, rg * 6, 0, TAU); ctx.fill();
      const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rg * 2.4);
      const deep = level > 0 ? 0.72 : 0.97;
      g.addColorStop(0, `rgba(0,0,0,${deep})`); g.addColorStop(0.5, `rgba(0,0,0,${(deep * 0.88).toFixed(2)})`); g.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(cx, cy, rg * 2.4, 0, TAU); ctx.fill();
    }
    const ghost = v === 'void' ? 0.8 : v === 'unripe' ? 0.7 : 1;   // void: the light goes out, the guardians still hold the room
    const lw = Lt.u * 1.6;
    const star = (key, alpha) => {
      const n = C.PLANETS[key].number, k = GUARD_K[n];
      const v = starVerts(cx, cy, rg, n, Math.PI / 2);
      const p = new Path2D();
      for (let i = 0; i < n; i++) { const a = v[i], b = v[(i + k) % n]; p.moveTo(a.x, a.y); p.lineTo(b.x, b.y); }
      const c = key === 'moon' ? '#dfe6ee' : C.PLANETS[key].tincture;
      ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.globalCompositeOperation = 'source-over';
      if (!PURE) { ctx.strokeStyle = 'rgba(0,0,0,0.45)'; ctx.lineWidth = lw * 2.6; ctx.stroke(p); }   // a dark bed so any tincture reads on any light
      strokeGlow(ctx, p, c, lw * 1.1, alpha, E, '#9aa0ab');
    };
    if (d === hr) star(d, ghost);
    else { star(d, 0.9 * ghost); star(hr, 0.9 * ghost); }
    ctx.restore();
  }

  /* ---------- constellation: where figures meet, white ---------- */
  function segX(p1, p2, p3, p4) {
    const d = (p2.x - p1.x) * (p4.y - p3.y) - (p2.y - p1.y) * (p4.x - p3.x);
    if (Math.abs(d) < 1e-9) return null;
    const ua = ((p4.x - p3.x) * (p1.y - p3.y) - (p4.y - p3.y) * (p1.x - p3.x)) / d;
    const ub = ((p2.x - p1.x) * (p1.y - p3.y) - (p2.y - p1.y) * (p1.x - p3.x)) / d;
    if (ua < 0 || ua > 1 || ub < 0 || ub > 1) return null;
    return { x: p1.x + ua * (p2.x - p1.x), y: p1.y + ua * (p2.y - p1.y) };
  }
  function constellation(geos, R) {
    const stars = [];
    const tol = R * 0.035;
    for (let i = 0; i < geos.length; i++) for (let j = i + 1; j < geos.length; j++) {
      const A = geos[i], B = geos[j];
      const w = Math.sqrt(Math.min(1.5, A.power) * Math.min(1.5, B.power));
      for (const a of A.verts) for (const b of B.verts) {
        if (Math.hypot(a.x - b.x, a.y - b.y) < tol) stars.push({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2, b: 1.0 * w + 0.4, major: true });
      }
    }
    // merge near-duplicates, keep the brightest few
    const out = [];
    for (const s of stars.sort((a, b) => b.b - a.b)) {
      const o = out.find(q => Math.hypot(q.x - s.x, q.y - s.y) < tol * 0.6);
      if (o) { o.b = Math.min(2, o.b + s.b * 0.5); o.major = o.major || s.major; } else out.push({ ...s });
    }
    const major = out.filter(s => s.major), minor = out.filter(s => !s.major).slice(0, 8);
    return major.slice(0, 12).concat(minor);
  }
  function drawStars(ctx, stars, Lt, E, t) {
    if (!stars.length) return;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const majors = stars.filter(s => s.major);
    if (majors.length > 1) {                              // the figure of the day
      ctx.strokeStyle = K.rgba(STAR, 0.22); ctx.lineWidth = 1.1 * Lt.u;
      ctx.beginPath();
      const c = majors.map(s => ({ ...s, a: Math.atan2(s.y - Lt.cy, s.x - Lt.cx) })).sort((a, b) => a.a - b.a);
      c.forEach((s, i) => (i ? ctx.lineTo(s.x, s.y) : ctx.moveTo(s.x, s.y)));
      ctx.closePath(); ctx.stroke();
    }
    stars.forEach((s, i) => {
      const tw = 0.85 + 0.15 * Math.sin(t * 1.7 + i * 2.1);
      const r = Lt.u * (s.major ? 7 : 3.2) * (0.6 + 0.4 * s.b) * tw;
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r * 5);
      g.addColorStop(0, K.rgba(STAR, 0.9)); g.addColorStop(0.18, K.rgba(STAR, 0.35)); g.addColorStop(1, K.rgba(STAR, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r * 5, 0, TAU); ctx.fill();
      ctx.fillStyle = STAR; ctx.beginPath(); ctx.arc(s.x, s.y, r * 0.45, 0, TAU); ctx.fill();
      if (s.major) {                                      // diffraction cross
        ctx.strokeStyle = K.rgba(STAR, 0.55); ctx.lineWidth = Lt.u * 1.2;
        ctx.beginPath(); ctx.moveTo(s.x - r * 4, s.y); ctx.lineTo(s.x + r * 4, s.y); ctx.moveTo(s.x, s.y - r * 4); ctx.lineTo(s.x, s.y + r * 4); ctx.stroke();
      }
    });
    ctx.restore();
  }

  /* ---------- the intelligences ---------- */
  /* conjunct bodies are one thing: grouped through the conjunction aspects */
  function conjunctionClusters(state) {
    const parent = {}; C.ORDER.forEach(k => { parent[k] = k; });
    const find = k => parent[k] === k ? k : (parent[k] = find(parent[k]));
    for (const a of state.aspects) if (a.aspect === 'conjunction') parent[find(a.a)] = find(a.b);
    const groups = {};
    for (const k of C.ORDER) { const r = find(k); (groups[r] = groups[r] || []).push(k); }
    return Object.values(groups).filter(g => g.length > 1)
      .map(g => { const l0 = state.bodies[g[0]].lon; return g.sort((x, y) => E_.norm180(state.bodies[x].lon - l0) - E_.norm180(state.bodies[y].lon - l0)); });
  }
  function placeBodies(state, Lt, clusters = []) {
    const pts = C.ORDER.map(k => ({ key: k, ...skyPoint(Lt, state.bodies[k]) }));
    const byKey = {}; pts.forEach(p => { byKey[p.key] = p; });
    const inCluster = {}; clusters.forEach((g, i) => g.forEach(k => { inCluster[k] = i; }));
    const put = q => { q.x = Lt.cx + q.r * Math.cos(q.th); q.y = Lt.cy - q.r * Math.sin(q.th); };
    // conjunct bodies close on their common centre until their rings overlap: one form
    for (const g of clusters) {
      const ps = g.map(k => byKey[k]), th0 = ps[0].th;
      const rel = ps.map(p => E_.norm180((p.th - th0) * 180 / Math.PI) * Math.PI / 180);
      const rMean = ps.reduce((a, p) => a + p.r, 0) / ps.length;
      const gap = Lt.S * 0.036 / rMean;
      const mean = rel.reduce((a, v) => a + v, 0) / rel.length;
      const pos = [0]; for (let i = 1; i < rel.length; i++) pos.push(pos[i - 1] + Math.min(gap, Math.abs(rel[i] - rel[i - 1])));
      const shift = mean - pos.reduce((a, v) => a + v, 0) / pos.length;
      ps.forEach((p, i) => { p.th = th0 + pos[i] + shift; put(p); });
    }
    const min = Lt.S * 0.056;
    const turn = (q, d) => { for (const k of (inCluster[q.key] !== undefined ? clusters[inCluster[q.key]] : [q.key])) { byKey[k].th += d; put(byKey[k]); } };
    for (let it = 0; it < 24; it++) {                     // nudge apart along the orbit, never radially; a cluster moves as one
      let moved = false;
      for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
        const a = pts[i], b = pts[j];
        if (inCluster[a.key] !== undefined && inCluster[a.key] === inCluster[b.key]) continue;
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        if (d < min) {
          const push = (min - d) / (2 * ((a.r + b.r) / 2));
          const sg = E_.norm180((a.th - b.th) * 180 / Math.PI) >= 0 ? 1 : -1;
          turn(a, sg * push); turn(b, -sg * push);
          moved = true;
        }
      }
      if (!moved) break;
    }
    return byKey;
  }

  function drawMoonDisc(ctx, x, y, r, phaseAngle, col, P) {
    const k = Math.cos(phaseAngle * Math.PI / 180);        // 1 new, -1 full
    ctx.save();
    ctx.fillStyle = '#0b0f1c'; ctx.beginPath(); ctx.arc(x, y, r, 0, TAU); ctx.fill();
    const g = ctx.createRadialGradient(x - r * 0.35, y - r * 0.4, 0, x - r * 0.1, y - r * 0.1, r * 1.7);   // silver: a sheen, the tincture, a shadow
    g.addColorStop(0, (P && P.sheen) || '#f6f8fa'); g.addColorStop(0.5, col); g.addColorStop(1, (P && P.shade) || '#6d7684');
    ctx.fillStyle = g;
    ctx.beginPath();
    const waxing = phaseAngle < 180;
    // lit limb on the right when waxing (northern view)
    ctx.arc(x, y, r, -Math.PI / 2, Math.PI / 2, !waxing);
    ctx.ellipse(x, y, Math.abs(k) * r, r, 0, Math.PI / 2, -Math.PI / 2, (k > 0) === waxing ? true : false);
    ctx.fill();
    ctx.restore();
  }

  /* ---------- the nativity: a ring of ink markers at the natal longitudes, on the current dial ---------- */
  function drawNatal(ctx, state, Lt, lw) {
    const N = state.natal, u = Lt.u, rN = Lt.R - 22 * u, out = {};
    if (!N) return out;
    ctx.save();
    ctx.strokeStyle = K.rgba(NATAL_INK, 0.16); ctx.lineWidth = u; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, rN, 0, TAU); ctx.stroke();
    const mark = (key, lon, shape) => {
      const a = eclAngle(state, lon), q = polar(Lt, a, rN); q.th = a; q.r = rN; out[key] = q;
      ctx.fillStyle = K.rgba(NATAL_INK, 0.92); ctx.strokeStyle = K.rgba(NATAL_INK, 0.92); ctx.lineWidth = 1.2 * u; ctx.lineJoin = 'round';
      if (shape === 'asc') { const p = polar(Lt, a, rN + 9 * u), l = polar(Lt, a + 0.035, rN - 6 * u), r = polar(Lt, a - 0.035, rN - 6 * u); ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(l.x, l.y); ctx.lineTo(r.x, r.y); ctx.closePath(); ctx.fill(); return; }
      if (shape === 'mc') { const p0 = polar(Lt, a, rN - 8 * u), p1 = polar(Lt, a, rN + 8 * u); ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke(); return; }
      const n = POLY[key];
      ctx.fill(polyPath(q.x, q.y, 5.5 * u, n, Math.PI / 2));
      const g = polar(Lt, a, rN - 19 * u);
      G.planet(ctx, key, g.x, g.y, 15 * u, K.rgba(NATAL_INK, 0.7), 0.12);
    };
    for (const k of C.ORDER) mark(k, N.bodies[k].lon, 'planet');
    mark('ascendant', N.asc, 'asc'); mark('midheaven', N.mc, 'mc');
    ctx.restore();
    return out;
  }

  /* ---------- the contacts between two skies ----------
     for each transit in orb, a chord from the first sky's planet to the second's point, bowed toward the pole: cold
     for trine and sextile, warm for square, opposition and a malefic conjunction, pale for the other conjunctions;
     weight and light by power. at the second sky's point a short arc on its ring and a soft glow of the same colour,
     so the rim shows where the two skies agree and where they strain. in the sigil, solid ink, one weight. */
  const COLD = '#7fa4e0', WARM = '#e08a62', PALE = '#e8e2d4';
  function contactTone(a) {
    const malefic = k => k === 'mars' || k === 'saturn' || k === 'pluto';
    if (a.aspect === 'trine' || a.aspect === 'sextile') return COLD;
    if (a.aspect === 'square' || a.aspect === 'opposition' || (a.aspect === 'conjunction' && (malefic(a.a) || malefic(a.b)))) return WARM;
    return PALE;
  }
  function drawContacts(ctx, state, Lt, pos, npos, lw) {
    const tr = (state.transits || []).slice(0, 10); if (!tr.length) return;
    const top = tr[0].power || 1, u = Lt.u;
    ctx.save();
    for (let i = tr.length - 1; i >= 0; i--) {
      const a = tr[i], p = pos[a.a], q = npos[a.b]; if (!p || !q) continue;
      const col = contactTone(a), k = Math.min(1, a.power / top), al = PURE ? 1 : 0.32 + 0.55 * k;
      const mx = (p.x + q.x) / 2, my = (p.y + q.y) / 2, cx = mx + (Lt.cx - mx) * 0.35, cy = my + (Lt.cy - my) * 0.35;
      ctx.strokeStyle = PURE ? '#fbf8f0' : K.rgba(col, al); ctx.lineWidth = PURE ? PURE_LW : lw * (0.8 + 1.4 * k); ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.quadraticCurveTo(cx, cy, q.x, q.y); ctx.stroke();
      if (PURE) continue;
      // the zone at the second sky's point: a short arc on its ring and a glow
      const th = q.th, r = q.r, span = (4 + 4 * k) * Math.PI / 180;
      ctx.globalCompositeOperation = 'screen';
      ctx.strokeStyle = K.rgba(col, 0.5 + 0.4 * k); ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, r, -(th + span), -(th - span)); ctx.stroke();
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, (22 + 18 * k) * u);
      g.addColorStop(0, K.rgba(col, 0.5 * (0.4 + 0.6 * k))); g.addColorStop(1, K.rgba(col, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, (22 + 18 * k) * u, 0, TAU); ctx.fill();
      ctx.globalCompositeOperation = 'source-over';
    }
    ctx.restore();
  }

  /* ---------- the figure of a pair ----------
     the two charts' ruling polygons on one wheel, each turned to its own planet, each outlined faint in its own
     colour; the region they have in common drawn solid, with a glow of the two colours mixed. what the two share is
     the figure of the pair: an intersection, not a contact. a conjunction is a disc, an opposition a lens. [SD] */
  function regionPath(cfg, bodies, state, Lt, R) {
    const p = new Path2D(), rot = eclAngle(state, bodies[cfg.a].lon);
    if (cfg.n === 1) { p.arc(Lt.cx, Lt.cy, R * 0.86, 0, TAU); return p; }
    if (cfg.n === 2) {                                        // the lens of the vesica: the two circles' overlap
      const d = R * 0.42, ax = Math.cos(rot), ay = -Math.sin(rot), c1 = { x: Lt.cx + ax * d / 2, y: Lt.cy + ay * d / 2 }, c2 = { x: Lt.cx - ax * d / 2, y: Lt.cy - ay * d / 2 };
      const a1 = Math.atan2(c2.y - c1.y, c2.x - c1.x), h = Math.acos(0.5);   // half-angle at each centre, radius d and distance d
      p.arc(c1.x, c1.y, d, a1 - h, a1 + h); p.arc(c2.x, c2.y, d, a1 + Math.PI - h, a1 + Math.PI + h); p.closePath(); return p;
    }
    const v = starVerts(Lt.cx, Lt.cy, R, cfg.n, rot), seen = new Set();
    for (let s = 0; s < cfg.n; s++) {                         // a compound star (hexagram, octagram) has several components: walk each
      if (seen.has(s)) continue; let j = s; p.moveTo(v[j].x, v[j].y);
      do { seen.add(j); j = (j + cfg.k) % cfg.n; p.lineTo(v[j].x, v[j].y); } while (j !== s);
      p.closePath();
    }
    return p;
  }
  function drawPairFigure(ctx, state, Lt, Rp, lw, E) {
    const own = state.ownFigures; if (!own || !own.a || !own.b || !state.natal) return;
    const stB = { ...state, bodies: state.natal.bodies };
    const pa = regionPath(own.a, state.bodies, state, Lt, Rp), pb = regionPath(own.b, state.natal.bodies, state, Lt, Rp);
    const ca = figureColor(state, own.a), cb = figureColor(stB, own.b), mix = K.mixLight(ca, cb, 0.5, 0.05);
    ctx.save();
    if (PURE) {                                               // the sigil: the shared region's outline alone, in ink, one weight
      ctx.strokeStyle = '#fbf8f0'; ctx.lineWidth = PURE_LW; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
      ctx.save(); ctx.clip(pa, 'nonzero'); ctx.stroke(pb); ctx.restore();
      ctx.save(); ctx.clip(pb, 'nonzero'); ctx.stroke(pa); ctx.restore();
      ctx.restore(); return;
    }
    ctx.globalAlpha = 0.3 * E; ctx.lineWidth = lw * 0.8;    // the two polygons, faint, in their own colours
    ctx.strokeStyle = ca; ctx.stroke(pa); ctx.strokeStyle = cb; ctx.stroke(pb);
    ctx.globalAlpha = 1;
    ctx.save(); ctx.clip(pa, 'nonzero');                      // what they share: a glow of the mixed colour and a solid edge
    ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = K.rgba(mix, 0.26 * E); ctx.fill(pb, 'nonzero');
    ctx.globalCompositeOperation = 'source-over'; ctx.strokeStyle = K.rgba('#fbf8f0', 0.92); ctx.lineWidth = lw * 1.3; ctx.lineJoin = 'round'; ctx.stroke(pb);
    ctx.restore();
    ctx.save(); ctx.clip(pb, 'nonzero'); ctx.strokeStyle = K.rgba('#fbf8f0', 0.92); ctx.lineWidth = lw * 1.3; ctx.lineJoin = 'round'; ctx.stroke(pa); ctx.restore();
    ctx.restore();
  }

  /* ---------- the intelligences as polygons ----------
     core   = the planet's own polygon (saturn 3, jupiter 4, mars 5, sun 6, venus 7, mercury 8), point up,
              in its tincture. the moon keeps its phase disc; the outer planets keep their optics.
     ring   = the same polygon, larger. its form is the planet's condition, its rotation is the alignment:
              domicile and exaltation sit aligned with the core; minor dignity a quarter-step off;
              peregrine half-off; detriment and fall a full half-step: vertex against edge, out of tune.
     size   = power: dignity, angularity, and the planet's part in the figure. */
  const POLY = { sun: 6, venus: 7, mercury: 8, mars: 5, jupiter: 4, saturn: 3, moon: 9 };
  function stateOf(b, key) {
    const L = b.dignity.labels;
    if (L.includes('detriment')) return 'detriment';
    if (L.includes('fall')) return 'fall';
    if (L.includes('domicile')) return 'domicile';
    if (L.includes('exaltation')) return 'exaltation';
    if (L.some(l => l === 'triplicity' || l === 'term' || l === 'face')) return 'minor';
    return C.PLANETS[key].kind === 'optic' ? 'neutral' : 'peregrine';
  }
  function polyPath(x, y, r, n, rot) {
    const p = new Path2D();
    if (!n || n < 3) { p.arc(x, y, r, 0, TAU); return p; }
    for (let i = 0; i <= n; i++) { const a = rot + i * TAU / n; const px = x + r * Math.cos(a), py = y - r * Math.sin(a); i ? p.lineTo(px, py) : p.moveTo(px, py); }
    p.closePath(); return p;
  }
  function planetPower(state, key, inv) {
    const b = state.bodies[key];
    const dig = C.PLANETS[key].kind === 'optic' ? 0.5 : (b.dignity.score + 5) / 15;   // −5 … +10 → 0 … 1
    return clamp(0.45 * dig + 0.5 * Math.min(1, inv || 0) + (b.angular ? 0.2 : 0) + (b.station ? 0.2 : 0), 0, 1.2);
  }

  /* the state ring: the planet's own polygon, larger; its form is the condition, its rotation the alignment */
  const RING = {
    domicile: { w: 1.6, a: 1, off: 0 }, exaltation: { w: 1.4, a: 1, off: 0, double: true }, minor: { w: 1.0, a: 0.85, off: 0.25 },
    peregrine: { w: 0.8, a: 0.55, off: 0.5 }, neutral: { w: 0.9, a: 0.6, off: 0 },
    detriment: { w: 1.4, a: 0.9, off: 1, broken: true }, fall: { w: 1.2, a: 0.75, off: 1, broken: true, inward: true }
  };
  function ringSpec(ctx, state, Lt, key, q, coreR, t) {
    const b = state.bodies[key];
    const st = stateOf(b, key);
    const n = POLY[key];
    let rr = coreR * (key === 'sun' ? 1.75 : key === 'moon' ? 1.8 : 2.1);
    let col = K.clarify(signColorAt(b.lon), b.clarity);
    if (b.combust) col = K.mixLight(col, '#fff1c8', 0.5, 0.04);
    let stroke = K.rgba(col, 1);
    if (key === 'neptune') stroke = '#f4f7ff';
    if (key === 'pluto') stroke = K.rgba(INK, 0.6);
    if (key === 'uranus' && ctx.createConicGradient) {
      const g = ctx.createConicGradient(t * 0.4, q.x, q.y);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, K.hueShift('#c9f0ff', i * 60));
      stroke = g;
    }
    const spec = RING[st];
    if (spec.inward) rr *= 0.92;
    const rot = Math.PI / 2 + (n ? spec.off * Math.PI / n : 0);
    return { rr, n, rot, stroke, spec, slow: b.slow, oob: !!b.oob };
  }
  function strokeRing(ctx, sp, q, lw, alpha, wIn = 1, wOut = 0.8) {
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = alpha;
    ctx.strokeStyle = sp.stroke; ctx.lineWidth = lw * sp.spec.w * wIn; ctx.lineJoin = 'round';
    if (sp.spec.broken) { const per = sp.n ? 2 * sp.rr * Math.sin(Math.PI / sp.n) : TAU * sp.rr / 12; ctx.setLineDash([per * 0.55, per * 0.45]); }
    ctx.stroke(polyPath(q.x, q.y, sp.rr, sp.n, sp.rot));
    if (sp.spec.double) { ctx.lineWidth = lw * wOut; ctx.stroke(polyPath(q.x, q.y, sp.rr * 1.3, sp.n, sp.rot)); }
    if (sp.oob) {                                           // out of bounds: a dotted fence beyond the ring, the planet outside the sun's road
      ctx.setLineDash([lw * 0.9, lw * 1.6]); ctx.lineWidth = lw * 0.7; ctx.globalAlpha = alpha * 0.7;
      ctx.beginPath(); ctx.arc(q.x, q.y, sp.rr * 1.5, 0, TAU); ctx.stroke();
    }
    ctx.restore();
  }
  function drawStateRing(ctx, state, Lt, key, q, coreR, lw, E, dim, t) {
    const sp = ringSpec(ctx, state, Lt, key, q, coreR, t);
    withBlur(ctx, 3 * Lt.u * sp.slow, () => strokeRing(ctx, sp, q, lw, sp.spec.a * dim));   // retrograde: the ring loses focus
    return sp.rr;
  }

  const SOLID = new Set(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']);
  function bodyGeom(state, Lt, key, q, involved) {
    const b = state.bodies[key], P = C.PLANETS[key];
    const up = b.alt > 0;
    const pw = planetPower(state, key, involved[key]);
    const k = 0.95 + 0.5 * pw;                             // a powerful planet stands larger
    const coreR = Lt.S * (key === 'sun' ? 0.022 : key === 'moon' ? 0.0195 : 0.0145) * k;
    return { key, b, P, q, up, dim: up ? 1 : 0.6, core: coreColor(state, key), aura: signColorAt(b.lon), pw, coreR,
      auraR: coreR * (key === 'sun' ? 4.2 : 3.6), n: POLY[key], solid: SOLID.has(key) && !(key === 'sun' && !up) };
  }
  // aura: sign colour, purity and brightness from dignity
  function drawAura(ctx, m, Lt, E) {
    if ((m.key === 'sun' && !m.up) || ENGRAVE) return;
    const b = m.b, q = m.q;
    const ac = K.shade(K.clarify(m.aura, b.clarity), -0.15 * (1 - b.clarity));
    const aw = 0.35 + 0.65 * b.clarity;
    withBlur(ctx, 4 * Lt.u * b.slow, () => {
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, m.auraR);
      g.addColorStop(0, K.rgba(ac, 0.6 * E * m.dim * aw)); g.addColorStop(0.4, K.rgba(ac, 0.18 * E * m.dim * aw)); g.addColorStop(1, K.rgba(ac, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, m.auraR, 0, TAU); ctx.fill();
      ctx.restore();
    });
  }
  function shapePath(m) {
    const q = m.q, r = m.coreR;
    if (m.key === 'moon') { const p = new Path2D(); p.arc(q.x, q.y, r, 0, TAU); return p; }
    if (m.key === 'saturn') return polyPath(q.x, q.y, r * 1.25, 3, Math.PI / 2);
    return polyPath(q.x, q.y, r * 1.12, m.n, Math.PI / 2);
  }
  function drawShape(ctx, state, m, Lt, lw) {
    const { key, q, coreR, P, core, n } = m;
    ctx.save();
    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = m.dim;
    if (key === 'sun' && !m.up) {                         // below the horizon the sun is switched off
      ctx.strokeStyle = K.rgba(C.PLANETS.sun.tincture, 0.6); ctx.lineWidth = lw;
      ctx.stroke(polyPath(q.x, q.y, coreR, 6, Math.PI / 2));
    } else if (key === 'moon') {
      drawMoonDisc(ctx, q.x, q.y, coreR, state.moon.phaseAngle, core, P);
    } else if (key === 'saturn') {
      const p = shapePath(m);
      ctx.fillStyle = '#000'; ctx.fill(p); ctx.strokeStyle = P.rim; ctx.lineWidth = lw * 0.9; ctx.lineJoin = 'round'; ctx.stroke(p);
    } else if (key === 'uranus') {
      ctx.fillStyle = '#dcebf3'; ctx.beginPath(); ctx.arc(q.x, q.y, coreR * 0.6, 0, TAU); ctx.fill();
    } else if (key === 'neptune') {
      const g = ctx.createRadialGradient(q.x, q.y, 0, q.x, q.y, coreR * 2.2);
      g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(235,242,255,0.4)'); g.addColorStop(1, 'rgba(235,242,255,0)');
      ctx.globalCompositeOperation = 'screen'; ctx.fillStyle = g; ctx.beginPath(); ctx.arc(q.x, q.y, coreR * 2.2, 0, TAU); ctx.fill();
    } else if (key === 'pluto') {
      // no body colour: pluto is the occultation drawn after everything
    } else if (LUMINOUS) {                                // a light, not a body: flat, a hairline edge, and it glows by its power
      glow(ctx, q.x, q.y, coreR, core, m.pw, m.dim);
      const p = shapePath(m);
      ctx.fillStyle = K.shade(core, 0.08 + 0.22 * m.pw); ctx.fill(p);
      ctx.strokeStyle = K.rgba(K.shade(core, 0.4), 0.55); ctx.lineWidth = Lt.u; ctx.lineJoin = 'round'; ctx.stroke(p);
    } else {
      const p = shapePath(m);
      // a material, not a flat: a sheen off-centre, the tincture, a shadow at the edge. gold and silver shine hardest.
      const g = ctx.createRadialGradient(q.x - coreR * 0.38, q.y - coreR * 0.42, 0, q.x - coreR * 0.1, q.y - coreR * 0.1, coreR * 2.0);
      g.addColorStop(0, P.sheen || K.shade(core, 0.16)); g.addColorStop(0.42, core); g.addColorStop(1, P.shade || K.shade(core, -0.14));
      ctx.fillStyle = g; ctx.fill(p);
      if (P.sheen) { ctx.strokeStyle = K.rgba(P.sheen, 0.5); ctx.lineWidth = Lt.u; ctx.lineJoin = 'round'; ctx.stroke(p); }
    }
    if (LUMINOUS && key === 'moon') glow(ctx, q.x, q.y, coreR, '#e8edf3', 0.2 + 0.8 * state.moon.illum, m.dim);
    if (LUMINOUS && key === 'saturn') glow(ctx, q.x, q.y, coreR, '#6e737c', 0.25, m.dim);
    ctx.restore();
  }
  function glow(ctx, x, y, r, col, pw, dim) {
    const R = r * (1.9 + 2.6 * Math.min(1, pw)), a = (0.3 + 0.6 * Math.min(1, pw)) * dim;
    ctx.save(); ctx.globalCompositeOperation = 'screen';
    const g = ctx.createRadialGradient(x, y, r * 0.5, x, y, R);
    g.addColorStop(0, K.rgba(col, a)); g.addColorStop(0.35, K.rgba(col, a * 0.35)); g.addColorStop(1, K.rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, R, 0, TAU); ctx.fill();
    ctx.restore();
  }
  function drawCazimi(ctx, m, rr, lw) {
    if (!m.b.cazimi) return;
    ctx.save(); ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = 'rgba(255,240,200,0.95)'; ctx.lineWidth = lw * 1.3;
    ctx.beginPath(); ctx.arc(m.q.x, m.q.y, rr * 1.5, 0, TAU); ctx.stroke();
    ctx.restore();
  }
  function drawGlyph(ctx, m, Lt, gx, gy) {
    const gr = Lt.S * 0.022;
    const ink = K.rgba(INK, (m.up ? 0.9 : 0.5));
    withBlur(ctx, 2.5 * Lt.u * m.b.slow, () => G.planet(ctx, m.key, gx, gy, gr, ink, 0.11));
  }
  function drawOne(ctx, state, Lt, m, E, lw, t) {
    drawAura(ctx, m, Lt, E);
    const rr = drawStateRing(ctx, state, Lt, m.key, m.q, m.coreR, lw, E, (m.key === 'sun' && !m.up) ? 0.4 : m.dim, t);
    drawShape(ctx, state, m, Lt, lw);
    drawCazimi(ctx, m, rr, lw);
    const gr = Lt.S * 0.022, off = rr + gr * 0.85;        // glyph, outward of the body
    drawGlyph(ctx, m, Lt, m.q.x + Math.cos(m.q.th) * off, m.q.y - Math.sin(m.q.th) * off);
  }

  /* a scratch plate the size of the canvas, in the canvas's own transform: for unions */
  let scratch = null;
  function scratchFor(ctx) {
    const W = ctx.canvas.width, H = ctx.canvas.height;
    if (!scratch || scratch.width !== W || scratch.height !== H) { scratch = document.createElement('canvas'); scratch.width = W; scratch.height = H; }
    const s = scratch.getContext('2d');
    s.setTransform(1, 0, 0, 1, 0, 0); s.clearRect(0, 0, W, H);
    s.globalCompositeOperation = 'source-over'; s.globalAlpha = 1; s.filter = 'none'; s.setLineDash([]);
    if (ctx.getTransform) s.setTransform(ctx.getTransform());
    return s;
  }
  function blit(ctx, s, blur) {
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = 1;
    withBlur(ctx, blur, () => ctx.drawImage(s.canvas, 0, 0));
    ctx.restore();
  }

  /* conjunct planets are one form: the rings fuse into a single outline, the bodies into one material mixed
     from their tinctures by power, and the glyphs stand side by side outside it, in the order of the zodiac. */
  function drawCluster(ctx, state, Lt, ms, E, lw, t) {
    for (const m of ms) drawAura(ctx, m, Lt, E);
    // rings as a union: stroked on the scratch plate at double width, the interiors erased, so only the outer edge remains
    const s = scratchFor(ctx);
    const specs = ms.map(m => ringSpec(s, state, Lt, m.key, m.q, m.coreR, t));
    ms.forEach((m, i) => strokeRing(s, specs[i], m.q, lw, specs[i].spec.a * ((m.key === 'sun' && !m.up) ? 0.4 : m.dim), 2, 0.8));
    s.globalCompositeOperation = 'destination-out'; s.fillStyle = '#000';
    ms.forEach((m, i) => s.fill(polyPath(m.q.x, m.q.y, specs[i].rr * 0.995, specs[i].n, specs[i].rot)));
    blit(ctx, s, 3 * Lt.u * Math.max(...ms.map(m => m.b.slow)));
    // bodies: the solid ones as one material
    const solids = ms.filter(m => m.solid);
    if (solids.length >= 2) {
      let col = null, w = 0;
      for (const m of solids) { const c = m.key === 'saturn' ? '#15171c' : m.core; const wm = 0.3 + m.pw; col = col ? K.mixLight(col, c, wm / (w + wm), 0.02) : c; w += wm; }
      const cx = solids.reduce((a, m) => a + m.q.x, 0) / solids.length, cy = solids.reduce((a, m) => a + m.q.y, 0) / solids.length;
      const ext = Math.max(...solids.map(m => Math.hypot(m.q.x - cx, m.q.y - cy) + m.coreR * 1.25)) * 1.6;
      const sheen = K.shade(col, solids.some(m => m.P.sheen) ? 0.3 : 0.16);
      const g = ctx.createRadialGradient(cx - ext * 0.28, cy - ext * 0.3, 0, cx - ext * 0.07, cy - ext * 0.07, ext);
      g.addColorStop(0, sheen); g.addColorStop(0.42, col); g.addColorStop(1, K.shade(col, -0.16));
      const pwMax = Math.max(...solids.map(m => m.pw)), dimMax = Math.max(...solids.map(m => m.dim));
      if (LUMINOUS) glow(ctx, cx, cy, ext * 0.45, col, pwMax, dimMax);
      ctx.save(); ctx.globalCompositeOperation = 'source-over'; ctx.globalAlpha = dimMax;
      ctx.fillStyle = LUMINOUS ? K.shade(col, 0.08 + 0.22 * pwMax) : g; for (const m of solids) ctx.fill(shapePath(m));
      ctx.restore();
      const s2 = scratchFor(ctx);                          // one outline around the union
      s2.strokeStyle = K.rgba(sheen, 0.6); s2.lineWidth = Lt.u * 2.2; s2.lineJoin = 'round';
      for (const m of solids) s2.stroke(shapePath(m));
      s2.globalCompositeOperation = 'destination-out'; s2.fillStyle = '#000';
      for (const m of solids) s2.fill(shapePath(m));
      blit(ctx, s2, 0);
    }
    for (const m of ms) if (!(m.solid && solids.length >= 2)) drawShape(ctx, state, m, Lt, lw);
    ms.forEach((m, i) => drawCazimi(ctx, m, specs[i].rr, lw));
    // glyphs: a fan outside the form
    const gr = Lt.S * 0.022;
    const sx = ms.reduce((a, m) => a + Math.cos(m.q.th), 0), sy = ms.reduce((a, m) => a + Math.sin(m.q.th), 0);
    const thM = Math.atan2(sy, sx), rM = ms.reduce((a, m) => a + m.q.r, 0) / ms.length;
    const off = rM + Math.max(...specs.map(sp => sp.rr)) + gr * 0.85;
    const base = { x: Lt.cx + Math.cos(thM) * off, y: Lt.cy - Math.sin(thM) * off };
    const tx = -Math.sin(thM), ty = -Math.cos(thM);       // along the orbit
    const order = ms.slice().sort((a, b) => E_.norm180((a.q.th - thM) * 180 / Math.PI) - E_.norm180((b.q.th - thM) * 180 / Math.PI));
    const step = gr * 1.9;
    order.forEach((m, i) => { const d = (i - (order.length - 1) / 2) * step; drawGlyph(ctx, m, Lt, base.x + tx * d, base.y + ty * d); });
  }

  function drawBodies(ctx, state, Lt, pos, E, lw, t, involved, clusters = []) {
    const geoms = {}; for (const key of C.ORDER) geoms[key] = bodyGeom(state, Lt, key, pos[key], involved);
    const inCluster = {}; clusters.forEach((g, i) => g.forEach(k => { inCluster[k] = i; }));
    const done = new Set();
    for (const key of C.ORDER.slice().reverse()) {
      if (done.has(key)) continue;
      if (inCluster[key] !== undefined) { const g = clusters[inCluster[key]]; drawCluster(ctx, state, Lt, g.map(k => geoms[k]), E, lw, t); g.forEach(k => done.add(k)); }
      else drawOne(ctx, state, Lt, geoms[key], E, lw, t);
    }
  }

  /* occultation: pluto hides. inside its circle the field is put out and only the structure remains, as under an
     eclipse; at the limb the light that was there stands out as a corona of streamers. no magnification, no pigment
     of its own: the corona takes the colour of what it covers. */
  function occult(ctx, cx, cy, r, strength, u, disc = true, soft = 0) {
    if (strength < 0.05) return;
    const s = Math.min(1, strength);
    let col = INK;
    try {                                                   // sample the plate just inside the limb
      const m = ctx.getTransform ? ctx.getTransform() : { a: 1, e: 0, f: 0 }, k = m.a;
      let R = 0, Gc = 0, Bc = 0, n = 0;
      for (let i = 0; i < 12; i++) {
        const a = i * TAU / 12, px = Math.round((cx + Math.cos(a) * r * 0.85) * k + m.e), py = Math.round((cy + Math.sin(a) * r * 0.85) * k + m.f);
        const d = ctx.getImageData(px, py, 1, 1).data; R += d[0]; Gc += d[1]; Bc += d[2]; n++;
      }
      if (n && (R + Gc + Bc) / (3 * n) > 14) col = '#' + [R / n, Gc / n, Bc / n].map(v => Math.round(v).toString(16).padStart(2, '0')).join('');
    } catch (e) { /* tainted: ink */ }
    col = K.shade(col, 0.45);
    ctx.save();
    ctx.globalCompositeOperation = 'source-over'; ctx.filter = 'none'; ctx.setLineDash([]);
    if (disc) {
      ctx.fillStyle = `rgba(0,0,0,${(0.82 * s).toFixed(2)})`; ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.fill();
      withBlur(ctx, 2.5 * u * soft, () => { ctx.strokeStyle = K.rgba(col, s * (1 - 0.3 * soft)); ctx.lineWidth = Math.max(u, r * 0.04); ctx.beginPath(); ctx.arc(cx, cy, r, 0, TAU); ctx.stroke(); });
    }
    withBlur(ctx, 4 * u * soft, () => {                    // retrograde: the corona loses focus
    ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    const N = 84;
    for (let i = 0; i < N; i++) {                           // streamers, their lengths fixed by a hash so the corona keeps its shape
      const a = i * TAU / N, h = hash(i, 11, 5);
      const len = r * (0.1 + 0.7 * s * (0.3 + 0.7 * h) * (0.75 + 0.25 * Math.abs(Math.cos(2 * a))));
      const r0 = r * 1.0, r1 = r0 + len;
      const x0 = cx + Math.cos(a) * r0, y0 = cy + Math.sin(a) * r0, x1 = cx + Math.cos(a) * r1, y1 = cy + Math.sin(a) * r1;
      const g = ctx.createLinearGradient(x0, y0, x1, y1);
      g.addColorStop(0, K.rgba(col, 0.95 * s)); g.addColorStop(1, K.rgba(col, 0));
      ctx.strokeStyle = g; ctx.lineWidth = u * (0.9 + 0.9 * h);
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    }
    const hg = ctx.createRadialGradient(cx, cy, r, cx, cy, r * 1.8);
    hg.addColorStop(0, K.rgba(col, 0.32 * s)); hg.addColorStop(1, K.rgba(col, 0));
    ctx.fillStyle = hg; ctx.beginPath(); ctx.arc(cx, cy, r * 1.8, 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  /* what the two skies make together: the transiting planet joined to both ends of the natal aspect it sets off.
     the natal side in ink, the transits in the planet's colour, the triangle filled by its tone: harmony in the
     planet's light, strife in mars's. */
  function drawInteraction(ctx, state, Lt, inter, pos, npos, lw, E) {
    const T = pos[inter.t], A = npos[inter.a], B = npos[inter.b];
    if (!T || !A || !B) return;
    const col = presence(state, inter.t), tone = inter.tone === 'strife' ? C.PLANETS.mars.tincture : col;
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = K.rgba(tone, 0.10 + 0.12 * Math.min(1, inter.power * 2));
    ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.closePath(); ctx.fill();
    ctx.globalCompositeOperation = 'source-over'; ctx.lineCap = 'round';
    ctx.strokeStyle = K.rgba(NATAL_INK, 0.85); ctx.lineWidth = lw * 0.9; ctx.setLineDash(inter.tone === 'strife' ? [lw * 1.2, lw * 1.2] : []);
    ctx.beginPath(); ctx.moveTo(A.x, A.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    ctx.setLineDash([]);
    ctx.strokeStyle = K.rgba(col, 0.9); ctx.lineWidth = lw;
    ctx.beginPath(); ctx.moveTo(T.x, T.y); ctx.lineTo(A.x, A.y); ctx.moveTo(T.x, T.y); ctx.lineTo(B.x, B.y); ctx.stroke();
    for (const q of [A, B]) { ctx.fillStyle = NATAL_INK; ctx.beginPath(); ctx.arc(q.x, q.y, lw * 1.6, 0, TAU); ctx.fill(); }
    ctx.restore();
  }

  /* the element of the hour: an aura outside the sky, the dominant element mixed with the next by their shares.
     earth, near black as a pigment, is lifted to umber as a light. */
  const ELEMENT_LIGHT = { air: '#f2e8a0', water: '#4a7ef0', fire: '#ff5a2a', earth: '#c9a070' };
  function auraClip(ctx, Lt) {
    const b = Lt.bounds || { x: 0, y: 0, w: Lt.S, h: Lt.S };   // the canvas may be wider than the square: the aura runs into that room
    const clip = new Path2D(); clip.rect(b.x, b.y, b.w, Lt.tight ? b.h : (Lt.capY - 36 * Lt.u) - b.y); clip.addPath(dodecagon(Lt));
    ctx.clip(clip, 'evenodd');                             // outside the container only, above the caption
  }
  function drawAura(ctx, state, Lt) {
    const el = state.elements; if (!el) return;
    const [d0, d1] = el.order, u = Lt.u;
    const col = K.mixLight(ELEMENT_LIGHT[d0], ELEMENT_LIGHT[d1], 0.3 * el.shares[d1] / (el.shares[d0] + el.shares[d1]), 0);
    const a = (d0 === 'earth' ? 0.34 : 0.3) + 0.36 * el.shares[d0];
    ctx.save(); auraClip(ctx, Lt);
    ctx.globalCompositeOperation = 'screen';
    const Rb = Lt.poly ? Lt.poly.Rv : Lt.Rb, inR = Lt.poly ? Lt.poly.apothem : Lt.Rb * Math.cos(Math.PI / 12), outR = Rb * 1.32;   // compact: the light stays close to the ring
    const g = ctx.createRadialGradient(Lt.cx, Lt.cy, inR, Lt.cx, Lt.cy, outR);
    g.addColorStop(0, K.rgba(col, a * 1.1)); g.addColorStop(0.3, K.rgba(col, a * 0.55)); g.addColorStop(0.65, K.rgba(col, a * 0.14)); g.addColorStop(1, K.rgba(col, 0));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, outR, 0, TAU); ctx.fill();
    if (d0 === 'earth') {                                 // earth is still: a firm dark ground with a stone's grain, specks and hairline cracks
      const span = outR - inR;
      for (let i = 0; i < 900; i++) {
        const h1 = hash(i, 17, 1), h2 = hash(i, 19, 2), h3 = hash(i, 23, 3);
        const r = inR + Math.pow(h1, 0.7) * span, th = h2 * TAU, fade = 1 - (r - inR) / span;
        ctx.fillStyle = K.rgba(h3 > 0.8 ? '#c9a070' : ELEMENT_LIGHT.earth, (0.12 + 0.24 * h3) * fade);
        ctx.beginPath(); ctx.arc(Lt.cx + r * Math.cos(th), Lt.cy + r * Math.sin(th), u * (0.7 + 1.6 * h3), 0, TAU); ctx.fill();
      }
      ctx.strokeStyle = K.rgba(ELEMENT_LIGHT.earth, 0.4); ctx.lineWidth = u * 1.2; ctx.lineJoin = 'round';
      for (let i = 0; i < 36; i++) {
        const th = hash(i, 29, 4) * TAU, r0 = inR + hash(i, 31, 5) * span * 0.6; let r = r0, a0 = th;
        ctx.beginPath(); ctx.moveTo(Lt.cx + r * Math.cos(a0), Lt.cy + r * Math.sin(a0));
        for (let k = 1; k <= 4; k++) { r += span * (0.05 + 0.08 * hash(i, 37 + k, 6)); a0 += (hash(i, 41 + k, 7) - 0.5) * 0.12; ctx.lineTo(Lt.cx + r * Math.cos(a0), Lt.cy + r * Math.sin(a0)); }
        ctx.stroke();
      }
    }
    ctx.restore();
  }
  /* the aura alive, drawn every frame over the plate: water ripples outward in slow rings; air is small lines
     drifting round the container, each at its own pace; fire is faint tongues rising from the edge and flickering.
     earth does not move. */
  function drawAuraLive(ctx, state, Lt, t) {
    const el = state.elements; if (!el) return;
    const d0 = el.order[0]; if (d0 === 'earth') return;
    const Rb = Lt.poly ? Lt.poly.Rv : Lt.Rb, col = ELEMENT_LIGHT[d0], u = Lt.u, inR = Lt.poly ? Lt.poly.apothem : Lt.Rb * Math.cos(Math.PI / 12), outR = Rb * 1.3, span = outR - inR;
    const k = 0.5 + el.shares[d0];
    ctx.save(); auraClip(ctx, Lt); ctx.globalCompositeOperation = 'screen'; ctx.lineCap = 'round';
    if (d0 === 'water') {
      for (let i = 0; i < 7; i++) {
        const ph = ((t * 0.05 + i / 7) % 1 + 1) % 1, r = inR + ph * span, a = 0.46 * k * Math.sin(Math.PI * ph);
        ctx.strokeStyle = K.rgba(col, a); ctx.lineWidth = u * (1.6 + 2.2 * (1 - ph));
        ctx.beginPath();
        for (let q = 0; q <= 108; q++) { const th = q / 108 * TAU, rr = r + 3 * u * Math.sin(9 * th + t * 0.7 + i) + 2 * u * Math.sin(5 * th - t * 0.5); const x = Lt.cx + rr * Math.cos(th), y = Lt.cy + rr * Math.sin(th); q ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
        ctx.closePath(); ctx.stroke();
      }
    } else if (d0 === 'air') {
      for (let i = 0; i < 72; i++) {
        const h1 = hash(i, 3, 1), h2 = hash(i, 5, 2), h3 = hash(i, 7, 3);
        const r = inR + 6 * u + h1 * (span - 12 * u), speed = (0.1 + 0.22 * h2) * (h3 > 0.5 ? 1 : -1);
        const th = h3 * TAU + t * speed, len = (18 + 40 * h2) * u / r;
        const a = 0.6 * k * (0.45 + 0.55 * Math.sin(t * 1.1 + i * 0.9));
        ctx.strokeStyle = K.rgba(col, a); ctx.lineWidth = u * (1.1 + 1.1 * h1);
        ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, r, th, th + len); ctx.stroke();
      }
    } else if (d0 === 'fire') {
      for (let i = 0; i < 48; i++) {
        const h1 = hash(i, 11, 1), h2 = hash(i, 13, 2);
        const th = (i / 48) * TAU + 0.04 * Math.sin(t * 1.9 + i * 1.7);
        const fl = 0.55 + 0.45 * Math.sin(t * (1.6 + 2.6 * h1) + i * 2.3) * Math.sin(t * 0.8 + h2 * 6);
        const len = span * (0.22 + 0.5 * h2) * fl, r0 = inR - 2 * u, r1 = r0 + len;
        const cs = Math.cos(th), sn = Math.sin(th), bend = 9 * u * Math.sin(t * 1.4 + i);
        const x0 = Lt.cx + r0 * cs, y0 = Lt.cy + r0 * sn, x1 = Lt.cx + r1 * cs - bend * sn, y1 = Lt.cy + r1 * sn + bend * cs;
        const g = ctx.createLinearGradient(x0, y0, x1, y1); g.addColorStop(0, K.rgba(col, 0.58 * k)); g.addColorStop(1, K.rgba(col, 0));
        ctx.strokeStyle = g; ctx.lineWidth = u * (1.8 + 3.6 * h1) * fl;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.quadraticCurveTo(Lt.cx + (r0 + len * 0.5) * cs - bend * 0.4 * sn, Lt.cy + (r0 + len * 0.5) * sn + bend * 0.4 * cs, x1, y1); ctx.stroke();
      }
    }
    ctx.restore();
  }

  /* ---------- the frame: dodecagon container, rete, houses ---------- */
  /* the container is the house wheel itself: a twelve-sided polygon with a vertex on every cusp. houses are unequal, so
     the polygon is irregular; its vertices sit at one radius chosen so that no edge cuts into the chapter ring, and when
     the widest house would push that radius off the canvas the sky inside shrinks a little instead. */
  function housePoly(state, Lt) {
    const key = state.date.getTime() + '|' + state.asc + '|' + Lt.S;
    if (Lt.poly && Lt.poly.key === key) return Lt.poly;
    const norm = a => ((a % TAU) + TAU) % TAU;
    const angles = []; for (let h = 1; h <= 12; h++) angles.push(eclAngle(state, state.cusps[h]));
    const dir = norm(angles[1] - angles[0]) < Math.PI ? 1 : -1;
    const spans = angles.map((a, h) => norm(dir * (angles[(h + 1) % 12] - a)));
    const maxSpan = Math.max(...spans);
    const cap = (Lt.tight ? 0.485 : 0.49) * Lt.S;
    const Rv = Math.min(cap, Math.max(Lt.Rb, Lt.Rz * 1.04 / Math.cos(maxSpan / 2)));
    const apothem = Rv * Math.cos(maxSpan / 2);
    const verts = angles.map(a => ({ a, x: Lt.cx + Rv * Math.cos(a), y: Lt.cy - Rv * Math.sin(a) }));
    const path = new Path2D(); verts.forEach((v, i) => i ? path.lineTo(v.x, v.y) : path.moveTo(v.x, v.y)); path.closePath();
    const edgeR = a => {                                   // the outline's distance from the centre along direction a
      for (let h = 0; h < 12; h++) {
        const a1 = angles[h], span = spans[h], off = norm(dir * (a - a1));
        if (off <= span) { const mid = a1 + dir * span / 2; return Rv * Math.cos(span / 2) / Math.max(0.25, Math.cos(a - mid)); }
      }
      return Rv;
    };
    Lt.poly = { key, angles, spans, dir, Rv, apothem, verts, path, edgeR };
    return Lt.poly;
  }
  function dodecagon(Lt) { return Lt.poly ? Lt.poly.path : new Path2D(); }
  function drawFrame(ctx, state, Lt, lw) {
    const u = Lt.u;
    // container — saturn's black, lead edges
    const poly = housePoly(state, Lt), outer = poly.path;
    const ring = new Path2D(outer); ring.arc(Lt.cx, Lt.cy, Lt.Rz, 0, TAU, true);
    ctx.save();
    ctx.fillStyle = VOID; ctx.fill(ring, 'evenodd');
    ctx.strokeStyle = C.PLANETS.saturn.rim; ctx.lineWidth = 1.4 * u; ctx.stroke(outer);

    // houses: the cusps as spokes across the band (Regiomontanus unless set otherwise), the angles stronger, the number mid-house
    ctx.font = `400 ${Math.round(18 * u * Lt.ts)}px ${SANS}`;    // Roman numerals, in the text face
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    const inR = poly.apothem, edgeR = poly.edgeR;
    for (let h = 1; h <= 12; h++) {
      const a = eclAngle(state, state.cusps[h]);
      const angle = h % 3 === 1;
      // the cusp traced as one radial line: a hairline across the sky from the portal's reach to the rim, then through
      // the chapter ring and the band to the container's edge, the four angles heavier
      const q0 = polar(Lt, a, Lt.R * 0.5), q1 = polar(Lt, a, Lt.Rzi);
      ctx.strokeStyle = K.rgba(INK, angle ? 0.36 : 0.26); ctx.lineWidth = 1 * u;
      ctx.beginPath(); ctx.moveTo(q0.x, q0.y); ctx.lineTo(q1.x, q1.y); ctx.stroke();
      const p0 = polar(Lt, a, Lt.Rzi), p1 = polar(Lt, a, poly.Rv);             // to the vertex: the cusp is a corner of the container
      ctx.strokeStyle = K.rgba(INK, angle ? 0.95 : 0.7); ctx.lineWidth = (angle ? 2.2 : 1.5) * u;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      const span = E_.norm360(state.cusps[h % 12 + 1] - state.cusps[h]);
      // the numeral: on one circle midway across the band, mid-house, set radially as on a chapter ring
      const ma = eclAngle(state, state.cusps[h] + span / 2), lp = polar(Lt, ma, Lt.Rz + (edgeR(ma) - Lt.Rz) * 0.42);   // in the band, nearer the ring than the edge
      const sunHouse = state.bodies.sun.house === h;
      ctx.fillStyle = K.rgba(sunHouse ? C.PLANETS.sun.tincture : INK, sunHouse ? 0.95 : 0.72);
      ctx.save(); ctx.translate(lp.x, lp.y); ctx.rotate(Math.sin(ma) < 0 ? -Math.PI / 2 - ma : Math.PI / 2 - ma); ctx.fillText(I().roman(h), 0, 0); ctx.restore();   // radial; the lower half turned to read upright at the foot
    }
    // the cardinal ring: a hairline concentric with the dial beyond the container, the four cardinal points set
    // into it like the indices of a bezel, each joined to the container by a radial index. upright text, the ring
    // cleared behind it; on narrow layouts a label is kept inside the canvas.
    const Rc = poly.Rv + (Lt.tight ? 13 : 28) * u, fs = Math.round(16 * u * Lt.ts);
    ctx.font = `500 ${fs}px ${SANS}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(0.08 * fs).toFixed(1)}px`;
    const am = eclAngle(state, state.mc);
    const lab = [['ASC', Math.PI], ['DSC', 0], ['MC', am], ['IC', am + Math.PI]].map(([s, a]) => {
      const w = ctx.measureText(s).width + 0.08 * fs + 12 * u, h = fs * 1.15, p = polar(Lt, a, Rc), half = w / 2;
      return { s, a, w, h, x: Math.max(half + 2 * u, Math.min(Lt.S - half - 2 * u, p.x)), y: p.y };
    });
    ctx.strokeStyle = K.rgba(INK, 0.42); ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Rc, 0, TAU); ctx.stroke();
    for (const l of lab) {
      // the index: from the container's outline to the label's box
      const reach = l.w / 2 * Math.abs(Math.cos(l.a)) + l.h / 2 * Math.abs(Math.sin(l.a));
      const p0 = polar(Lt, l.a, edgeR(l.a) + 1.5 * u), p1 = polar(Lt, l.a, Rc - reach - 4 * u);
      ctx.strokeStyle = K.rgba(INK, 0.85); ctx.lineWidth = 2 * u;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      ctx.fillStyle = VOID; ctx.fillRect(l.x - l.w / 2, l.y - l.h / 2, l.w, l.h);
      ctx.fillStyle = K.rgba(INK, 0.88); ctx.fillText(l.s, l.x + 0.04 * fs, l.y);
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    ctx.restore();
  }

  /* the rete: a chapter ring. degrees, signs, planet notches. no colour — the colour lives in the sky */
  function drawRete(ctx, state, Lt, lw) {
    const u = Lt.u, rm = (Lt.Rz + Lt.Rzi) / 2;
    ctx.save();
    ctx.fillStyle = VOID;
    ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.Rz, 0, TAU); ctx.arc(Lt.cx, Lt.cy, Lt.Rzi, 0, TAU, true); ctx.fill('evenodd');
    ctx.strokeStyle = K.rgba(INK, 0.55); ctx.lineWidth = 1.2 * u;
    ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.Rzi, 0, TAU); ctx.stroke();
    for (let d = 0; d < 360; d++) {
      const a = eclAngle(state, d), major = d % 30 === 0, five = d % 5 === 0;
      if (!five && !major) continue;
      const ts = Math.min(1.8, Lt.ts);
      const l = major ? (Lt.Rz - Lt.Rzi) * 0.8 : five && d % 10 === 0 ? 11 * u * ts : 6 * u * ts;   // the sign divider stops a little short of the ring's outer edge
      const p0 = polar(Lt, a, Lt.Rzi), p1 = polar(Lt, a, Lt.Rzi + l);
      ctx.strokeStyle = K.rgba(INK, major ? 0.95 : d % 10 === 0 ? 0.6 : 0.44); ctx.lineWidth = (major ? 2 : 1) * u * Math.min(1.5, ts);
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    for (let i = 0; i < 12; i++) {
      const p = polar(Lt, eclAngle(state, i * 30 + 15), rm + 2 * u);
      G.sign(ctx, i, p.x, p.y, (Lt.Rz - Lt.Rzi) * 0.58 * Math.min(1.45, Math.max(1, Lt.ts * 0.7)), K.rgba(INK, 0.9), 0.12);
    }
    // planet notches on the inner edge: true ecliptic longitude, in each planet's tincture
    for (const key of C.ORDER) {
      const a = eclAngle(state, state.bodies[key].lon);
      const p0 = polar(Lt, a, Lt.Rzi), p1 = polar(Lt, a, Lt.Rzi - 14 * u);
      ctx.strokeStyle = key === 'saturn' ? C.PLANETS.saturn.rim : C.PLANETS[key].kind === 'optic' ? K.rgba(INK, 0.7) : K.rgba(coreColor(state, key), 0.95);
      ctx.lineWidth = 3 * u; ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.restore();
  }

  /* ---------- caption: the almanac line ---------- */
  const ordinal = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');
  function dms(x) { const d = Math.floor(x), m = Math.floor((x - d) * 60); return `${d}°${String(m).padStart(2, '0')}′`; }
  function fmtTime(date, loc) {
    const tz = loc.tz || 'UTC';
    const f = new Intl.DateTimeFormat(I().locale(), { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
    const parts = Object.fromEntries(f.formatToParts(date).map(p => [p.type, p.value]));
    let zone = loc.zoneLabel;
    if (!zone) {
      try { zone = new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'short' }).formatToParts(date).find(p => p.type === 'timeZoneName').value; }
      catch (e) { zone = tz; }
    }
    return { day: I().cap1(parts.weekday), date: `${parts.day} ${parts.month} ${parts.year}`, time: `${parts.hour}:${parts.minute}`, zone };
  }
  function moonLine(state) {
    const m = state.moon, i = I();
    const to = i.t('cap.to');
    const head = m.next ? `${i.t('cap.moonApplying')} ${i.aspect(m.next.aspect)} ${to ? to + ' ' : ''}${i.planet(m.next.planet)}` : i.t('cap.moonVoid') + (m.tolerable ? ' · ' + i.t('cap.tolerable') : '');
    const extra = m.flags.filter(f => f !== 'void of course')[0];
    return extra ? `${head} · ${i.flag(extra === 'under the beams' ? 'beams' : extra)}` : head;
  }
  function fmtShort(date, loc) {
    const f = new Intl.DateTimeFormat(I().locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: loc.tz || 'UTC' });
    const p = Object.fromEntries(f.formatToParts(date).map(x => [x.type, x.value]));
    return `${I().cap1(p.weekday)} ${p.day} ${p.month.replace(/\.$/, '')} ${p.hour}:${p.minute}`;   // the month as the language writes it: Oct, oct
  }
  function captionLines(state) {
    const i = I(), T = fmtTime(state.date, state.loc), B = state.bodies, H = state.hour;
    const fig = state.configs.primary, ev = fig && fig.event ? (i.event(fig.event) === fig.event && fig.event.includes(' ') ? fig.event.split(' ').map(w => i.event(w)).join(' ') : i.event(fig.event)) : '';
    const inter = state.interaction && state.interaction.figures[0];
    const figLine = inter ? (inter.name === 'setOff'
        ? `${i.planet(inter.t)} ${i.t('ui.r.setsOff')} ${i.t('cap.natal')} ${i.planet(inter.a)} ${i.aspect(inter.natalAspect)} ${i.planet(inter.b)} · ${i.t('ui.r.' + inter.tone)}`
        : `${i.planet(inter.t)} ${i.t('ui.r.closes')} ${i.t('ui.r.fig.' + inter.name)} ${i.t('ui.r.with')} ${i.t('cap.natal')} ${i.planet(inter.a)} ${i.aspect(inter.natalAspect)} ${i.planet(inter.b)} · ${i.t('ui.r.' + inter.tone)}`)
      : !fig ? i.t('cap.quiet')
      : fig.natal ? `${i.t('cap.transit')} ${i.planet(fig.a)} ${i.aspect(fig.aspect)} ${i.t('cap.natal')} ${i.planet(fig.b)} · ${fig.orb.toFixed(1)}°`
      : `${i.planet(fig.a)} ${i.aspect(fig.aspect)} ${i.planet(fig.b)}${ev ? ' · ' + ev : ''}`;
    const d = B.sun.decan, c1 = i.cap1, cs = i.capSegs, to = i.t('cap.to');
    const T2 = state.title || { house: B.moon.house, mode: 'ideation', state: 'watch' };
    const mv = `${i.t('ui.r.moonIs')} ${i.verdict(state.moon.verdict)}`;
    const mn = state.moon.next ? `, ${i.t('cap.applying')} ${i.aspect(state.moon.next.aspect)} ${to ? to + ' ' : ''}${i.planet(state.moon.next.planet)}` : (state.moon.tolerable ? ` · ${i.t('cap.tolerable')}` : '');
    const ch = state.chord;
    const chordTxt = ch.name === 'none' ? i.t('cap.quiet') : `${i.t('cap.chord')} ${i.chordLong(ch)}${ch.interval ? ' · ' + i.interval(ch.interval) : ch.notes.length > 1 ? ' · ' + ch.notes.map(n => i.note(n)).join(' ') : ''}`;
    const nextTxt = state.nextChord ? `${i.t('cap.nextChord')} ${i.chordName(state.nextChord.to)} · ${fmtShort(state.nextChord.at, state.loc)}` : '';
    if (state.transits) return transitCaption(state, { T, chordTxt, nextTxt, c1, cs });
    if (state.pairMissing) return { label: i.t('cap.synastryLabel'), stateKey: 'watch', state: c1(i.t('cap.noPair')), title: '', reason: '', l1: c1(`${T.day} · ${T.date} · ${T.time} ${T.zone} · ${i.placeName(state.loc.name)}`), detail1: '', detail2: '', detail3: '', detail4: '', l2: '', l3: '', fig: '', moon: '', chord: '', decan: '', mansion: '', next: '' };
    return {
      // the tiers: the instrument, the state, the title, the reason, the moment, the day's colour, the sound
      label: i.t('cap.clockLabel'),
      stateKey: T2.state,
      state: i.state(T2.state),
      title: `${i.t('cap.modeOf')} ${c1(i.window(T2.mode))} · ${i.realm(T2.house)} · ${i.t('cap.under')} ${i.name(H.angel)}`,   // the mode first, named as a mode; the house as a realm; the angel
      reason: `${c1(figLine)} · ${c1(mv)}${mn}`,
      l1: c1(`${state.natalView ? i.t('cap.nativity') + (state.relocated ? ' · ' + i.t('cap.relocated') + ' ' + i.placeName(state.relocated) : '') + ' · ' : ''}${T.day} · ${T.date} · ${T.time} ${T.zone} · ${i.placeName(state.loc.name)}`),
      detail1: cs(`${i.t('cap.dayOf')} ${i.planet(H.dayRuler)} · ${i.t('cap.hourOf')} ${i.planet(H.hourRuler)} · ${i.t('cap.sunIn')} ${i.t('cap.house')} ${i.roman(B.sun.house)} · ${dms(B.sun.deg)} ${i.sign(B.sun.sign)}`),
      detail2: cs(`${i.t('cap.decanOf')} ${i.planet(d.ruler)} · ${i.card(d)} · ${i.title(d)}`),
      detail3: cs(`${i.ordinal(B.moon.mansion.index)} ${i.t('cap.mansion')} · ${i.name(B.moon.mansion.name)}`),
      detail4: cs(`${chordTxt}${nextTxt ? ' · ' + nextTxt : ''}`),
      // the older keys, for the readout and the sky renders
      l2: cs(`${i.t('cap.dayOf')} ${i.planet(H.dayRuler)} · ${i.t('cap.hourOf')} ${i.planet(H.hourRuler)} · ${i.t('cap.angel')} ${i.name(H.angel)}`),
      l3: cs(`${i.t('cap.sunIn')} ${i.t('cap.house')} ${i.roman(B.sun.house)} · ${dms(B.sun.deg)} ${i.sign(B.sun.sign)}`),
      fig: c1(figLine),
      moon: c1(moonLine(state)),
      chord: c1(chordTxt),
      decan: cs(`${i.t('cap.decanOf')} ${i.planet(d.ruler)} · ${i.card(d)} · ${i.title(d)}`),
      mansion: cs(`${i.t('cap.moonIn')} ${i.ordinal(B.moon.mansion.index)} ${i.t('cap.mansion')} · ${i.name(B.moon.mansion.name)}`),
      next: nextTxt ? c1(nextTxt) : ''
    };
  }
  /* the transits view: what the sky of now does to this chart. the state is the verdict of harmony against strife; the
     title is the leading transit with its date of exactness; the reason the next two; the details the transiting
     planets' natal houses, the figure the two skies close, and the count in orb. no hour, no mode: that is the clock's. */
  function transitCaption(state, x) {
    const i = I(), tr = state.transits, inter = state.interaction, info = state.transitInfo || { spans: {}, houses: {} };
    const pr = state.pair, P = k => i.planet(k), A = k => i.aspect(k);
    const pt = k => C.PLANETS[k] ? P(k) : k === 'ascendant' ? 'ASC' : 'MC';
    const own = (k, who) => pr ? i.t('cap.own')(who, pt(k)) : (C.PLANETS[k] ? `${i.t('cap.your')} ${P(k)}` : `${i.t('cap.your')} ${pt(k)}`);
    const nat = k => own(k, pr && pr.b), mine = k => pr ? i.t('cap.own')(pr.a, P(k)) : P(k);
    const when = a => { const sp = info.spans[a.a + '|' + a.b + '|' + a.aspect]; if (!sp) return ''; if (sp.exact) { const past = sp.exact.getTime() < state.date.getTime() - 3600e3; return ` · ${i.t(past ? 'cap.wasExact' : 'cap.exact')} ${fmtShort(sp.exact, state.loc)}`; } return sp.leave ? ` · ${i.t('cap.untilOrb')} ${fmtShort(sp.leave, state.loc)}` : ''; };
    const line = a => `${mine(a.a)} ${A(a.aspect)} ${nat(a.b)}`;
    const short = a => pr ? `${line(a)} · ${a.orb.toFixed(1)}°` : `${line(a)} · ${a.orb.toFixed(1)}° ${i.t(a.applying ? 'cap.applying' : 'cap.separating')}`;   // two fixed charts have no applying or separating
    const verdict = inter ? inter.verdict : 'balanced';
    const stateKey = verdict === 'harmonyPrevails' ? 'work' : verdict === 'strifePrevails' ? 'shelter' : 'watch';
    const fig = inter && inter.figures[0];
    const figTxt = fig ? (fig.name === 'setOff' ? `${mine(fig.t)} ${i.t('ui.r.setsOff')} ${nat(fig.a)} ${A(fig.natalAspect)} ${P(fig.b)}` : `${mine(fig.t)} ${i.t('ui.r.closes')} ${i.t('ui.r.fig.' + fig.name)} ${i.t('ui.r.with')} ${nat(fig.a)} ${A(fig.natalAspect)} ${P(fig.b)}`) : '';
    const housesTxt = Object.entries(info.houses).slice(0, 3).map(([k, h]) => pr ? i.t('cap.houseOf')(P(k), pr.b, i.roman(h), pr.a) : `${P(k)} ${i.t('cap.inYourHouse')} ${i.roman(h)}`).join(' · ');
    const soft = a => a.aspect === 'trine' || a.aspect === 'sextile', hardish = a => a.aspect === 'square' || a.aspect === 'opposition' || (a.aspect === 'conjunction' && ['mars', 'saturn', 'pluto'].some(m => m === a.a || m === a.b));
    const topH = tr.find(soft), topS = tr.find(hardish);
    const twoSides = `${i.t('cap.harmonyIs')} ${topH ? short(topH) : i.t('cap.noHarmony')} · ${i.t('cap.strifeIs')} ${topS ? short(topS) : i.t('cap.noStrife')}`;
    const el = k => i.t('ui.el.' + k) === 'ui.el.' + k ? k : i.t('ui.el.' + k);
    const blend = pr && state.elements && state.natal.elements ? `${i.t('cap.own')(pr.a, el(state.elements.dominant))} ${i.t('cap.meets')} ${i.t('cap.own')(pr.b, el(state.natal.elements.dominant))}` : '';
    const applying = tr.filter(a => a.applying).length;
    return {
      label: x.c1(pr ? `${i.t('cap.synastryLabel')} · ${info.name}` : `${i.t('cap.transitsTo')} ${info.name || i.t('cap.nativity')}`),
      stateKey,
      state: x.c1(i.t('ui.r.' + verdict)),
      title: tr[0] ? x.c1(`${line(tr[0])}${when(tr[0])}`) : x.c1(i.t('cap.noTransit')),
      reason: pr ? x.c1(twoSides) : tr.slice(1, 3).map(a => x.c1(short(a))).join(' · '),
      l1: x.c1(`${x.T.day} · ${x.T.date} · ${x.T.time} ${x.T.zone} · ${i.placeName(state.loc.name)}`),
      detail1: state.stone ? x.cs(`${i.t('cap.stone')} ${i.stone(state.stone.stone)}, ${i.t('cap.or')} ${state.stone.alternatives.map(s => i.stone(s)).join(', ')} · ${P(state.stone.planet)}, ${i.t('cap.stoneRule.' + state.stone.rule)}`) : x.cs(housesTxt),
      detail2: state.stone ? x.cs(housesTxt) : x.cs(figTxt || `${i.t('ui.r.harmony')} ${inter ? inter.harmony.toFixed(2) : '0'} · ${i.t('ui.r.strife')} ${inter ? inter.strife.toFixed(2) : '0'}`),
      detail3: state.stone ? x.cs(`${figTxt ? figTxt + ' · ' : ''}${i.t('cap.inOrb')(tr.length)} · ${i.t('cap.applyingN')(applying)}`) : x.cs(pr ? `${blend ? blend + ' · ' : ''}${i.t('cap.contactsN')(tr.length)}` : `${i.t('cap.inOrb')(tr.length)} · ${i.t('cap.applyingN')(applying)}`),
      detail4: x.cs(`${x.chordTxt}${x.nextTxt ? ' · ' + x.nextTxt : ''}`),
      l2: '', l3: '', fig: x.c1(tr[0] ? line(tr[0]) : ''), moon: '', chord: x.c1(x.chordTxt), decan: '', mansion: '', next: ''
    };
  }
  const STATE_INK = { work: '#6fcf8e', watch: '#e3b341', shelter: '#ff5a2a' };   // the one coloured text on the instrument
  function drawCaption(ctx, state, Lt) {
    const u = Lt.u, m = Lt.S * 0.0625, k = u * Lt.tc;     // type scales up on small screens; the 2048 export is unchanged
    const c = captionLines(state);
    const pitch = Math.min(34 * k, (Lt.S - Lt.capY - 14 * k - 8 * u) / 6.6);   // six rows and the notice must fit the band
    const row = i => Lt.capY + 8 * k + pitch * i + (i >= 1 ? 6 * k : 0);        // the headline gets air under the eyebrow
    const mrx = state.bodies.mercury.slow;                // mercury slow or retrograde: the print misregisters, a ghost beside each line
    const put = (txt, x, y) => {
      if (mrx > 0.3 && !PURE) { const a = ctx.globalAlpha, f = ctx.fillStyle; ctx.globalAlpha = a * 0.32 * mrx; ctx.fillText(txt, x + 2.2 * u * mrx, y); ctx.globalAlpha = a; ctx.fillStyle = f; }
      ctx.fillText(txt, x, y);
    };
    const fit = (txt, maxW) => { const f = ctx.font, w = ctx.measureText(txt).width; if (w > maxW) { const px = parseFloat(f.match(/(\d+)px/)[1]); ctx.font = f.replace(/\d+px/, `${Math.round(Math.max(px * 0.72, px * maxW / w))}px`); } return f; };
    ctx.save();
    ctx.textBaseline = 'alphabetic';
    ctx.strokeStyle = K.rgba(INK, 0.22); ctx.lineWidth = 1 * u;
    ctx.beginPath(); ctx.moveTo(m, Lt.capY - 30 * u); ctx.lineTo(Lt.S - m, Lt.capY - 30 * u); ctx.stroke();
    const W = Lt.S - 2 * m, left = W * 0.54 - 20 * u, right = W * 0.46 - 20 * u;
    let f;
    // 1 · the instrument, alone on its line
    ctx.textAlign = 'left'; ctx.fillStyle = K.rgba(INK, 0.9); ctx.font = `500 ${Math.round(17 * k)}px ${SANS}`;
    if ('letterSpacing' in ctx) ctx.letterSpacing = `${(1.8 * k).toFixed(1)}px`;
    ctx.fillText(c.label, m, row(0));
    {                                                     // beside the eyebrow, an underlined "what it means": the menu's key answers it
      const i = I(), lw = ctx.measureText(c.label).width, link = i.t('cap.whatItMeans'), gap = 14 * k;
      ctx.save(); ctx.font = `400 ${Math.round(15 * k)}px ${SANS}`; ctx.fillStyle = K.rgba(INK, 0.62);
      const w = ctx.measureText(link).width, x = m + lw + gap, y = row(0);
      ctx.fillText(link, x, y);
      ctx.strokeStyle = K.rgba(INK, 0.5); ctx.lineWidth = Math.max(1, u); ctx.beginPath(); ctx.moveTo(x, y + 3 * k); ctx.lineTo(x + w, y + 3 * k); ctx.stroke();
      ctx.restore();
      Lt.eyebrow = { x: m, y: y - 17 * k, w: lw + gap + w, h: 22 * k, link: { x, w } };   // for the clickable area over the canvas
    }
    if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
    // 2 · the state: do I work now. the one line in colour
    ctx.fillStyle = STATE_INK[c.stateKey] || INK; ctx.font = `500 ${Math.round(31 * k)}px ${SANS}`;
    f = fit(c.state, left); put(c.state, m, row(1)); ctx.font = f;
    // 3 · the title of the moment: the stage of life, the mother letter, the angel of the hour
    ctx.fillStyle = K.rgba(INK, 0.95); ctx.font = `500 ${Math.round(23 * k)}px ${SANS}`;
    f = fit(c.title, left); put(c.title, m, row(2)); ctx.font = f;
    // 4 · the reason: the sky and the Moon
    ctx.fillStyle = K.rgba(INK, 0.8); ctx.font = `400 ${Math.round(20 * k)}px ${SANS}`;
    f = fit(c.reason, left); put(c.reason, m, row(3)); ctx.font = f;
    // 7 · the sound
    ctx.fillStyle = K.rgba(INK, 0.72);
    f = fit(c.detail4, left); put(c.detail4, m, row(4)); ctx.font = f;
    // 5 · the moment, and 6 · the day's colour, on the right
    ctx.textAlign = 'right'; ctx.fillStyle = K.rgba(INK, 0.8); ctx.font = `400 ${Math.round(20 * k)}px ${SANS}`;
    f = fit(c.l1, right); put(c.l1, Lt.S - m, row(1)); ctx.font = f;
    ctx.fillStyle = K.rgba(INK, 0.72);
    for (const [txt, r] of [[c.detail1, 2], [c.detail2, 3], [c.detail3, 4]]) { f = fit(txt, right); put(txt, Lt.S - m, row(r)); ctx.font = f; }
    // every print carries the notice
    ctx.textAlign = 'left'; ctx.fillStyle = K.rgba(INK, 0.45); ctx.font = `400 ${Math.round(14 * k)}px ${SANS}`;
    ctx.fillText(NOTICE(), m, Math.min(row(5) + 2 * k, Lt.S - 6 * u));
    ctx.restore();
  }
  const NOTICE = () => `© ${new Date().getFullYear()} Siderarium · proprietary design and method · all rights reserved`;
  /* the bare wallpaper carries the notice in its lower right corner, small */
  /* the wallpaper's four corners glow in the colour of the element that rules the sky now, stronger as its share grows.
     earth's own tincture is sable, invisible as a light, so its glow is an umber. */
  function drawCornerGlows(ctx, W, H, state) {
    const el = state.elements && state.elements.dominant; if (!el) return;
    const col = el === 'earth' ? '#7a5a2e' : C.ELEMENTS[el];
    const share = state.elements.shares[el] || 0.3, a = Math.min(0.6, 0.18 + 0.9 * (share - 0.25)), r = Math.min(W, H) * 0.42;
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.globalCompositeOperation = 'screen';
    for (const [x, y] of [[0, 0], [W, 0], [0, H], [W, H]]) {
      const g = ctx.createRadialGradient(x, y, 0, x, y, r);
      g.addColorStop(0, K.rgba(col, a)); g.addColorStop(0.45, K.rgba(col, a * 0.28)); g.addColorStop(1, K.rgba(col, 0));
      ctx.fillStyle = g; ctx.fillRect(x ? x - r : 0, y ? y - r : 0, r, r);   // the square that lies inside the screen at that corner
    }
    ctx.restore();
  }
  function drawNotice(ctx, W, H) {
    const s = Math.min(W, H), px = Math.max(10, Math.round(0.011 * s));
    ctx.save(); ctx.textAlign = 'right'; ctx.textBaseline = 'alphabetic'; ctx.fillStyle = K.rgba(INK, 0.28); ctx.font = `400 ${px}px ${SANS}`;
    ctx.fillText(NOTICE(), W - 0.02 * s, H - 0.02 * s); ctx.restore();
  }

  /* ---------- clock mode ---------- */
  /* the ground: midnight by the moon's light. prototype (?ground=element): tinted by the element of the hour through its
     qualities, hot or cold as warmth of the dark, wet or dry as a lift of light. air, the hot and wet, is the lightest dark;
     earth, the cold and dry, the deepest. none of them leaves the night. */
  const ELEMENT_DARK = { fire: '#2c100c', air: '#2d2a22', water: '#0a1838', earth: '#17150f' };
  let GROUND_EL = false;
  const ground = (state, el = GROUND_EL) => {
    const base = K.mixLight(VOID, MIDNIGHT, 0.3 + 0.45 * state.moon.illum, 0);
    if (!el || !state.elements) return base;
    const [d0, d1] = state.elements.order, sh = state.elements.shares;
    const tint = K.mixLight(ELEMENT_DARK[d0], ELEMENT_DARK[d1], sh[d1] / (sh[d0] + sh[d1]), 0);
    return K.mixLight(base, tint, 0.4 + 0.4 * sh[d0], 0);
  };
  function renderClock(ctx, state, S, t, opts) {
    const bare = opts.bare;                               // wallpaper: no wheel, the field runs to the edges of a W × H canvas
    const Lt = layout(S); Lt.asc = state.asc; Lt.bounds = !bare && opts.bounds ? opts.bounds : null;
    if (!bare) {                                          // the container follows the cusps; the chapter ring must stay inside its edges
      const poly = housePoly(state, Lt), fitS = Math.min(1, poly.apothem * 0.97 / Lt.Rz);
      if (fitS < 1) { Lt.R *= fitS; Lt.Rz *= fitS; Lt.Rzi *= fitS; }
    }
    const W = bare ? bare.W : S, H = bare ? bare.H : S;
    if (bare) {
      Lt.cx = W / 2; Lt.cy = H * (H > W * 1.4 ? 0.56 : 0.5);   // on a phone the clock sits at the top: the sky below it
      Lt.bleed = true;
      Lt.ext = Math.max(1.08, Math.hypot(W / 2, Math.max(Lt.cy, H - Lt.cy)) / Lt.R * 1.02);
    }
    const E = lunarE(state);
    const lw = Lt.u * lunarLw(state);                    // never below 70% of the full moon's weight; the full moon adds luminosity
    const B = state.bodies;

    // ground: pure black across the whole canvas (the prototype ground tint only under ?ground=element)
    ctx.fillStyle = GROUND_EL ? ground(state) : VOID;
    const gb = Lt.bounds || { x: 0, y: 0, w: W, h: H };
    ctx.fillRect(gb.x, gb.y, gb.w, gb.h);

    // sky
    ctx.save();
    if (!bare) { ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.R + 1, 0, TAU); ctx.clip(); }
    ctx.fillStyle = MIDNIGHT; ctx.fillRect(0, 0, W, H);
    const smoke = opts.field === 'smoke';
    const ext = Lt.ext || 1.08;
    const field = smoke ? buildField(state, Lt, opts.fieldRes || 180) : buildLight(state, Lt, opts.fieldRes || 180);
    ctx.save();
    ctx.translate(Lt.cx, Lt.cy);
    ctx.imageSmoothingEnabled = true; ctx.imageSmoothingQuality = 'high';
    if (!ENGRAVE) ctx.drawImage(field, -Lt.R * ext, -Lt.R * ext, Lt.R * 2 * ext, Lt.R * 2 * ext);
    ctx.restore();
    if (ENGRAVE) { ctx.fillStyle = '#03061a'; ctx.fillRect(0, 0, W, H); drawEngravedField(ctx, state, Lt, opts.fast ? 0.4 : 1); }
    const weave = drawWeave(ctx, state, Lt, lw, E);
    if (!opts.plate && !ENGRAVE) drawFlow(ctx, weave, state, Lt, E, t);
    // horizon
    if (!bare) {
      ctx.strokeStyle = K.rgba(INK, 0.22); ctx.lineWidth = 1 * Lt.u;
      ctx.beginPath(); ctx.moveTo(Lt.cx - Lt.R, Lt.cy); ctx.lineTo(Lt.cx + Lt.R, Lt.cy); ctx.stroke();
    }

    // the portal
    const cf = state.configs;
    const quiet = cf.primary && cf.primary.power < 0.25;
    const Rp = Lt.R * 0.61 * Math.max(0.85, (cf.scale || 1) * (quiet ? 0.88 : 1));   // jupiter widens, saturn narrows; never below 0.85
    const geos = [];
    const involved = {};
    const all = [cf.primary, ...cf.secondary].filter(Boolean);
    all.forEach(c => { involved[c.a] = Math.max(involved[c.a] || 0, c.power); involved[c.b] = Math.max(involved[c.b] || 0, c.power); });
    const clusters = conjunctionClusters(state);
    const pos = placeBodies(state, Lt, clusters);
    // spokes from the planets feeding the primary figure to the pole — mercury owns rays
    const npos = drawNatal(ctx, state, Lt, lw);
    if (cf.primary) {
      withBlur(ctx, 5 * Lt.u * B.mercury.slow, () => {
        const ends = cf.primary.natal
          ? [[pos[cf.primary.a], presence(state, cf.primary.a)], [npos[cf.primary.b], NATAL_INK]]
          : [cf.primary.a, cf.primary.b].map(k => [pos[k], k === 'saturn' ? C.PLANETS.saturn.rim : presence(state, k)]);
        for (const [q, col] of ends) {
          if (!q) continue;
          ctx.strokeStyle = K.rgba(col, 0.32); ctx.lineWidth = lw * 0.7;
          ctx.beginPath(); ctx.moveTo(q.x, q.y); ctx.lineTo(Lt.cx + (q.x - Lt.cx) * Rp * 1.06 / q.r, Lt.cy + (q.y - Lt.cy) * Rp * 1.06 / q.r); ctx.stroke();
        }
      });
    }
    // secondary first, primary on top; a pair of charts draws its own figure instead
    if (state.pair && state.ownFigures) drawPairFigure(ctx, state, Lt, Rp, lw, E);
    else cf.secondary.slice().reverse().forEach(c => geos.push(drawFigure(ctx, state, Lt, c, Rp, 'secondary', lw * 0.7, E, t)));
    if (cf.primary && !(state.pair && state.ownFigures)) {
      // the cut: a wedge removed toward the planet that afflicts the figure
      let wedge = null;
      if (cf.cut) {
        const th = eclAngle(state, B[cf.cut.by].lon), w = cf.cut.width * Math.PI / 360;
        wedge = { th, w };
        const clip = new Path2D(); clip.rect(0, 0, S, S);
        const p0 = polar(Lt, th - w, Rp * 2), p1 = polar(Lt, th + w, Rp * 2);
        clip.moveTo(Lt.cx, Lt.cy); clip.lineTo(p0.x, p0.y); clip.lineTo(p1.x, p1.y); clip.closePath();
        ctx.save(); ctx.clip(clip, 'evenodd');
      }
      const g = drawFigure(ctx, state, Lt, cf.primary, Rp, 'primary', lw, E, t);
      if (wedge) {
        ctx.restore();
        const inWedge = q => Math.abs(E_.norm180((Math.atan2(Lt.cy - q.y, q.x - Lt.cx) - wedge.th) * 180 / Math.PI)) < wedge.w * 180 / Math.PI;
        g.verts = g.verts.filter(q => !inWedge(q));
        const ac = cf.cut.by === 'saturn' ? C.PLANETS.saturn.rim : presence(state, cf.cut.by);
        ctx.save(); ctx.strokeStyle = K.rgba(ac, 0.6); ctx.lineWidth = lw * 0.6;
        for (const sgn of [-1, 1]) { const e = polar(Lt, wedge.th + sgn * wedge.w, Rp * 1.02); ctx.beginPath(); ctx.moveTo(Lt.cx, Lt.cy); ctx.lineTo(e.x, e.y); ctx.stroke(); }
        ctx.restore();
      }
      geos.push(g);
    }
    cf.stations.forEach(st => drawStation(ctx, state, Lt, st, Rp, lw, E));
    const rippleCol = cf.ripple ? K.mixLight(C.PLANETS.moon.tincture, presence(state, cf.ripple.a === 'moon' ? cf.ripple.b : cf.ripple.a), 0.4, 0) : null;
    // the Moon's ripple, a ring opening from the centre, is retired: the field breathes enough
    const stars = constellation(geos, Rp);
    drawStars(ctx, stars, Lt, E, t);

    drawBodies(ctx, state, Lt, pos, E, lw, t, involved, clusters);
    if (state.interaction && state.interaction.figures[0]) drawInteraction(ctx, state, Lt, state.interaction.figures[0], pos, npos, lw, E);

    drawGuardians(ctx, state, Lt, E);

    // optics after everything inside the sky: pluto occults, neptune diffuses
    const pl = pos.pluto;
    const plPower = planetPower(state, 'pluto', involved.pluto);
    const plStrength = (0.7 + 0.3 * Math.min(1, involved.pluto || 0)) * (B.pluto.retro ? 0.8 : 1);
    occult(ctx, pl.x, pl.y, Lt.S * 0.0145 * (0.95 + 0.5 * plPower) * 2.1, Math.min(1, plStrength), Lt.u, true, B.pluto.slow);   // the disc is its state ring; retrograde: soft
    if (involved.pluto) occult(ctx, Lt.cx, Lt.cy, Rp * 0.3, Math.min(1, involved.pluto) * 0.6, Lt.u);      // in the figure: its heart goes into eclipse
    // the outer planets have no number, so a station of theirs is an optic at the portal's rim, not hour-marks
    if (B.pluto.station) {                                // pluto: a corona around the whole portal
      occult(ctx, Lt.cx, Lt.cy, Rp * 1.2, 0.35, Lt.u, false);
      ctx.save(); ctx.strokeStyle = K.rgba(INK, 0.14); ctx.lineWidth = Lt.u; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Rp * 1.2, 0, TAU); ctx.stroke(); ctx.restore();
    }
    if (B.neptune.station) {                              // neptune: the rim dissolves into white
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createRadialGradient(Lt.cx, Lt.cy, Rp * 1.08, Lt.cx, Lt.cy, Rp * 1.3);
      g.addColorStop(0, 'rgba(238,243,255,0)'); g.addColorStop(0.45, 'rgba(238,243,255,0.22)'); g.addColorStop(1, 'rgba(238,243,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Rp * 1.3, 0, TAU); ctx.fill(); ctx.restore();
    }
    if (B.uranus.station && ctx.createConicGradient) {    // uranus: an iridescent rim
      ctx.save(); ctx.globalCompositeOperation = 'screen';
      const g = ctx.createConicGradient(t * 0.3, Lt.cx, Lt.cy);
      for (let i = 0; i <= 6; i++) g.addColorStop(i / 6, K.rgba(K.hueShift('#c9f0ff', i * 60), 0.5));
      ctx.strokeStyle = g; ctx.lineWidth = lw * 1.2; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Rp * 1.16, 0, TAU); ctx.stroke(); ctx.restore();
    }
    const nep = (0.18 + 0.5 * Math.min(1, involved.neptune || 0)) * (B.neptune.retro ? 0.4 : 1);
    if (!FAST && !ENGRAVE && supportsFilter && nep > 0.05) {
      ctx.save();
      ctx.globalCompositeOperation = 'screen'; ctx.globalAlpha = nep * 0.5;
      ctx.filter = `blur(${(14 * Lt.u).toFixed(1)}px)`;
      const m = ctx.getTransform(), k = m.a;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      const sx = (Lt.cx - Lt.R) * k + m.e, sy = (Lt.cy - Lt.R) * k + m.f, sw = 2 * Lt.R * k;
      // through a copy, never the canvas onto itself: a self-read under a filter leaves partial rectangles on some GPUs
      const cp = scratchFor(ctx); cp.setTransform(1, 0, 0, 1, 0, 0); cp.drawImage(ctx.canvas, 0, 0);
      ctx.drawImage(cp.canvas, sx, sy, sw, sw, sx, sy, sw, sw);
      ctx.restore();
    }
    ctx.restore(); // sky clip

    // the sigil layer: veil the sky, draw the figure of the moment in solid ink to be copied
    if (opts.sigil && cf.primary) {
      ctx.save();
      ctx.fillStyle = 'rgba(0,0,0,0.82)';
      if (bare) ctx.fillRect(0, 0, W, H); else { ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.R + 1, 0, TAU); ctx.fill(); }
      if (!bare) { ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.R, 0, TAU); ctx.clip(); }
      PURE = true; PURE_SIMPLE = true; PURE_LW = Math.max(lw * 2.2, 4.2 * Lt.u); PURE_BASE = lw; PURE_ALPHA = 1;
      try {
        // the sigil: the ruling figure's lines and the guardians' stars, one weight, nothing else. a key, not a drawing
        if (state.pair && state.ownFigures) {                 // a pair: the shared region of the two ruling figures, and the two ruling planets' glyphs
          drawPairFigure(ctx, state, Lt, Rp, lw, E);
          const own = state.ownFigures, stB = { ...state, bodies: state.natal.bodies };
          const vA = starVerts(Lt.cx, Lt.cy, Rp, Math.max(own.a.n, 1), eclAngle(state, state.bodies[own.a.a].lon))[0], vB = starVerts(Lt.cx, Lt.cy, Rp, Math.max(own.b.n, 1), eclAngle(stB, state.natal.bodies[own.b.a].lon))[0];
          const glyphAt2 = (key, q, extra) => { const dx = q.x - Lt.cx, dy = q.y - Lt.cy, L = Math.hypot(dx, dy) || 1, r = L + (34 + extra) * Lt.u; G.planet(ctx, key, Lt.cx + dx / L * r, Lt.cy + dy / L * r, PURE_LW / 0.12 * 1.25, '#fbf8f0', 0.12); };
          glyphAt2(own.a.a, vA, 0); glyphAt2(own.b.a, vB, 0);
          drawGuardians(ctx, state, Lt, E);
          throw { skip: true };
        }
        if (cf.cut) {
          const th = eclAngle(state, B[cf.cut.by].lon), w = cf.cut.width * Math.PI / 360;
          const clip = new Path2D(); clip.rect(0, 0, S, S);
          const p0 = polar(Lt, th - w, Rp * 2), p1 = polar(Lt, th + w, Rp * 2);
          clip.moveTo(Lt.cx, Lt.cy); clip.lineTo(p0.x, p0.y); clip.lineTo(p1.x, p1.y); clip.closePath();
          ctx.save(); ctx.clip(clip, 'evenodd'); drawFigure(ctx, state, Lt, cf.primary, Rp, 'primary', lw, E, 0); ctx.restore();
        } else drawFigure(ctx, state, Lt, cf.primary, Rp, 'primary', lw, E, 0);
        // who: the two planets' glyphs at their own vertices, in the same line
        const glyphAt = (key, q, extra) => { const dx = q.x - Lt.cx, dy = q.y - Lt.cy, L = Math.hypot(dx, dy) || 1, r = L + (34 + extra) * Lt.u; G.planet(ctx, key, Lt.cx + dx / L * r, Lt.cy + dy / L * r, PURE_LW / 0.12 * 1.25, '#fbf8f0', 0.12); };
        const who = cfg => {
          const n = cfg.n, rot = eclAngle(state, B[cfg.a].lon), v = starVerts(Lt.cx, Lt.cy, Rp, n, rot);
          if (n === 1) { glyphAt(cfg.a, v[0], 0); glyphAt(cfg.b, v[0], 44); return; }
          const aB = eclAngle(state, B[cfg.b].lon);
          const near = v.reduce((best, q) => { const qa = Math.atan2(-(q.y - Lt.cy), q.x - Lt.cx), d = Math.abs(Math.atan2(Math.sin(qa - aB), Math.cos(qa - aB))); return d < best.d ? { q, d } : best; }, { q: v[0], d: 9 }).q;
          glyphAt(cfg.a, v[0], 0); glyphAt(cfg.b, near, 0);
        };
        who(cf.primary);
        // the hour: the Moon's aspect the caption names, her next application, as a small figure within; the guardians' stars at the pole.
        // when that application is not yet in orb, the Moon's strongest aspect (the ripple's) stands in
        const same = (x, y) => x && y && x.a === y.a && x.b === y.b;
        const mn = state.moon.next;
        const moonFig = (mn && (state.aspects || []).find(a => a.moon && a.aspect === mn.aspect && (a.a === mn.planet || a.b === mn.planet))) || cf.ripple;
        if (moonFig && !same(moonFig, cf.primary)) {
          if (moonFig.n === 1) { ctx.strokeStyle = '#fbf8f0'; ctx.lineWidth = PURE_LW; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Rp * 0.3, 0, TAU); ctx.stroke(); }   // the Moon's conjunction: one ring
          else drawFigure(ctx, state, Lt, moonFig, Rp * 0.46, 'secondary', lw, E, 0);
        }
        drawGuardians(ctx, state, Lt, E);
      } catch (e) { if (!(e && e.skip)) throw e; } finally { PURE = false; PURE_SIMPLE = false; }
      ctx.restore();
    }

    if (state.transits && state.natal && !opts.sigil) drawContacts(ctx, state, Lt, pos, npos, lw);   // the contacts between the two skies, over the figure: cold for harmony, warm for strife
    if (!bare) {
      drawRete(ctx, state, Lt, lw);
      drawFrame(ctx, state, Lt, lw);
      if (!GROUND_EL) { drawAura(ctx, state, Lt); if (!opts.plate) drawAuraLive(ctx, state, Lt, t); }
      if (opts.caption !== false) drawCaption(ctx, state, Lt);
    }
    if (bare) { drawCornerGlows(ctx, W, H, state); drawNotice(ctx, W, H); }
    return { mode: 'clock', sigil: !!opts.sigil, bare: !!bare, groundEl: GROUND_EL, layout: Lt, positions: pos, stars, rippleCol, Rp, E, lw, weave, state };
  }

  function drawRipple(ctx, Lt, Rp, col, lw, E, t) {
    const ph = (t * 0.08) % 1;
    ctx.save(); ctx.globalCompositeOperation = 'lighter';
    ctx.strokeStyle = K.rgba(col, 0.22 * (1 - ph) * E); ctx.lineWidth = lw * 0.8;
    ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Rp * (0.2 + 0.95 * ph), 0, TAU); ctx.stroke();
    ctx.restore();
  }
  /* the living layer over a cached plate: lunar ripple, star breath */
  function overlay(ctx, info, t) {
    if (!info || info.mode !== 'clock') return;
    const Lt = info.layout;
    if (!info.bare && !info.groundEl) drawAuraLive(ctx, info.state, Lt, t);
    ctx.save();
    ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.R, 0, TAU); ctx.clip();
    // the ripple is retired (see renderClock)
    if (!info.sigil) drawFlow(ctx, info.weave, info.state, Lt, info.E, t);
    ctx.globalCompositeOperation = 'lighter';
    info.stars.forEach((s, i) => {
      const a = 0.18 * (0.5 + 0.5 * Math.sin(t * 1.7 + i * 2.1));
      const r = Lt.u * (s.major ? 16 : 7);
      const g = ctx.createRadialGradient(s.x, s.y, 0, s.x, s.y, r);
      g.addColorStop(0, K.rgba(STAR, a)); g.addColorStop(1, K.rgba(STAR, 0));
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(s.x, s.y, r, 0, TAU); ctx.fill();
    });
    ctx.restore();
  }

  /* ---------- chart mode: the plain instrument ----------
     no field. signs as full sectors, equal houses from the ascendant, aspects in their own colours. */
  const ASPECT_INK = {
    conjunction: '#e9c45c', opposition: '#e5483d', square: '#ef7a3a', trine: '#3f86f2', sextile: '#2fbfa6',
    quincunx: '#a6cf3e', semisquare: '#c85a44', sesquisquare: '#c85a44',
    quintile: '#a77bff', biquintile: '#a77bff', septile: '#d873cf', biseptile: '#d873cf', triseptile: '#d873cf', novile: '#9fb2cf'
  };
  const ASPECT_DASH = { quincunx: [10, 7], semisquare: [3, 6], sesquisquare: [3, 6], quintile: [2, 5], biquintile: [2, 5], septile: [2, 5], biseptile: [2, 5], triseptile: [2, 5], novile: [2, 5] };
  function renderChart(ctx, state, S, t, opts) {
    const Lt = layout(S); Lt.asc = state.asc;
    const u = Lt.u, B = state.bodies;
    ctx.fillStyle = GROUND_EL ? ground(state) : VOID; const gb = opts.bounds || { x: 0, y: 0, w: S, h: S }; ctx.fillRect(gb.x, gb.y, gb.w, gb.h);
    // plain ground inside: midnight, slightly lifted at the centre
    const bg = ctx.createRadialGradient(Lt.cx, Lt.cy, 0, Lt.cx, Lt.cy, Lt.R);
    bg.addColorStop(0, '#0b1230'); bg.addColorStop(1, '#04071a');
    ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, Lt.R, 0, TAU); ctx.fill();

    // zodiac band: twelve sectors with full boundaries, glyphs, degree scale
    const r0 = Lt.Rzi - 18 * u, r1 = Lt.Rb * 0.97;
    const band = new Path2D(); band.arc(Lt.cx, Lt.cy, r1, 0, TAU); band.arc(Lt.cx, Lt.cy, Lt.R, 0, TAU, true);
    ctx.fillStyle = VOID; ctx.fill(band, 'evenodd');
    for (let i = 0; i < 12; i++) {
      const a0 = eclAngle(state, i * 30), am = eclAngle(state, i * 30 + 15);
      const p0 = polar(Lt, a0, Lt.R), p1 = polar(Lt, a0, r1);
      ctx.strokeStyle = K.rgba(INK, 0.55); ctx.lineWidth = 1.4 * u;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      const g = polar(Lt, am, (Lt.Rz + r1) / 2 + 4 * u);
      G.sign(ctx, i, g.x, g.y, 40 * u, K.rgba(C.SIGNS[i].color, 0.95), 0.1);
    }
    for (let d = 0; d < 360; d++) {
      if (d % 30 === 0) continue;
      const a = eclAngle(state, d), l = d % 10 === 0 ? 14 : d % 5 === 0 ? 9 : 5;
      const p0 = polar(Lt, a, Lt.R), p1 = polar(Lt, a, Lt.R + l * u);
      ctx.strokeStyle = K.rgba(INK, d % 10 === 0 ? 0.5 : 0.28); ctx.lineWidth = (d % 10 === 0 ? 1.2 : 0.8) * u;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.strokeStyle = K.rgba(INK, 0.35); ctx.lineWidth = u;
    for (const r of [Lt.R, r1]) { ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, r, 0, TAU); ctx.stroke(); }

    // houses: the cusps (Regiomontanus unless set otherwise), the angles stronger, the number mid-house
    const rIn = Lt.R * 0.34;
    const am = eclAngle(state, state.mc);
    ctx.font = `400 ${Math.round(17 * u * Lt.ts)}px ${MONO}`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    for (let h = 1; h <= 12; h++) {
      const a = eclAngle(state, state.cusps[h]);
      const angle = h % 3 === 1;
      const p0 = polar(Lt, a, rIn), p1 = polar(Lt, a, angle ? r1 : Lt.R);
      ctx.strokeStyle = K.rgba(INK, angle ? 0.6 : 0.16); ctx.lineWidth = (angle ? 1.6 : 1) * u;
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
      const span = E_.norm360(state.cusps[h % 12 + 1] - state.cusps[h]);
      const lp = polar(Lt, eclAngle(state, state.cusps[h] + span / 2), rIn + 22 * u);
      ctx.fillStyle = K.rgba(INK, 0.4); ctx.fillText(String(h), lp.x, lp.y);
    }
    ctx.strokeStyle = K.rgba(INK, 0.2); ctx.lineWidth = u; ctx.beginPath(); ctx.arc(Lt.cx, Lt.cy, rIn, 0, TAU); ctx.stroke();

    // aspects, each in its own colour; width by exactness
    const pts = {};
    for (const k of C.ORDER) pts[k] = polar(Lt, eclAngle(state, B[k].lon), rIn);
    ctx.save(); ctx.lineCap = 'round';
    for (const a of state.aspects.slice().reverse()) {
      if (a.aspect === 'conjunction') continue;           // conjunctions read from the planets' closeness
      const col = ASPECT_INK[a.aspect], p0 = pts[a.a], p1 = pts[a.b];
      ctx.strokeStyle = K.rgba(col, 0.35 + 0.6 * a.exact);
      ctx.lineWidth = u * (1 + 2.6 * a.exact);
      ctx.setLineDash((ASPECT_DASH[a.aspect] || []).map(v => v * u));
      ctx.beginPath(); ctx.moveTo(p0.x, p0.y); ctx.lineTo(p1.x, p1.y); ctx.stroke();
    }
    ctx.restore();

    // planets: exact notch on the band, glyph on a track with a leader line, degree and sign beside it
    const track = Lt.R * 0.8;
    const items = C.ORDER.map(k => ({ k, a0: eclAngle(state, B[k].lon), a: eclAngle(state, B[k].lon) })).sort((x, y) => x.a - y.a);
    const minA = 0.085;
    for (let it = 0; it < 40; it++) for (let i = 0; i < items.length; i++) {
      const A = items[i], Bn = items[(i + 1) % items.length];
      const d = E_.norm180((Bn.a - A.a) * 180 / Math.PI) * Math.PI / 180;
      if (d >= 0 && d < minA) { A.a -= (minA - d) / 2; Bn.a += (minA - d) / 2; }
    }
    ctx.font = `400 ${Math.round(16 * u * Lt.ts)}px ${MONO}`;
    for (const it of items) {
      const b = B[it.k];
      const n0 = polar(Lt, it.a0, Lt.R), n1 = polar(Lt, it.a0, Lt.R - 16 * u), lead = polar(Lt, it.a, track + 30 * u);
      ctx.strokeStyle = K.rgba(INK, 0.85); ctx.lineWidth = 2.4 * u; ctx.beginPath(); ctx.moveTo(n0.x, n0.y); ctx.lineTo(n1.x, n1.y); ctx.stroke();
      ctx.strokeStyle = K.rgba(INK, 0.3); ctx.lineWidth = u; ctx.beginPath(); ctx.moveTo(n1.x, n1.y); ctx.lineTo(lead.x, lead.y); ctx.stroke();
      const p = polar(Lt, it.a, track);
      const col = it.k === 'saturn' ? '#aab0bb' : C.PLANETS[it.k].kind === 'optic' ? INK : K.mixLight(coreColor(state, it.k), INK, 0.3, 0.08);
      G.planet(ctx, it.k, p.x, p.y, 46 * u, col, 0.1);
      const dp = polar(Lt, it.a, track - 50 * u);
      ctx.fillStyle = K.rgba(INK, 0.7);
      ctx.fillText(`${Math.floor(b.deg)}°${b.retro ? 'r' : ''}`, dp.x, dp.y);
      G.sign(ctx, b.sign, polar(Lt, it.a, track - 76 * u).x, polar(Lt, it.a, track - 76 * u).y, 18 * u, K.rgba(C.SIGNS[b.sign].color, 0.9), 0.12);
    }
    // labels
    ctx.font = `400 ${Math.round(18 * u * Lt.ts)}px ${SANS}`; ctx.fillStyle = K.rgba(INK, 0.6);
    for (const [s, a] of [['ASC', Math.PI], ['DSC', 0], ['MC', am], ['IC', am + Math.PI]]) { const p = polar(Lt, a, r1 + 22 * u); ctx.fillText(s, p.x, p.y); }
    // legend
    ctx.font = `400 ${Math.round(15 * u * Lt.ts)}px ${MONO}`; ctx.textAlign = 'left';
    const leg = ['opposition', 'square', 'trine', 'sextile', 'quincunx', 'semisquare', 'quintile', 'septile'].map(k => [k, I().aspectShort(k)]);
    let lx = Lt.S * 0.0625; const ly = Lt.capY - 62 * u;
    for (const [k, l] of leg) {
      ctx.strokeStyle = ASPECT_INK[k]; ctx.lineWidth = 3 * u; ctx.setLineDash((ASPECT_DASH[k] || []).map(v => v * u));
      ctx.beginPath(); ctx.moveTo(lx, ly); ctx.lineTo(lx + 30 * u, ly); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = K.rgba(INK, 0.6); ctx.fillText(l, lx + 38 * u, ly + 1); lx += 38 * u + ctx.measureText(l).width + 30 * u;
    }
    if (opts.caption !== false) drawCaption(ctx, state, Lt);
    return { mode: 'chart', layout: Lt };
  }

  function render(ctx, state, S, t, opts = {}) {
    FAST = !!opts.fast; ENGRAVE = !!opts.engrave || opts.field === 'guilloche'; LUMINOUS = !!opts.luminous; TIGHT = !!opts.tight; GROUND_EL = !!opts.groundEl;
    GUILLOCHE = ENGRAVE && opts.field !== 'waves';          // the engraving is grain d'orge; ?field=waves keeps the older wobble
    try { return (opts.mode === 'chart' ? renderChart : renderClock)(ctx, state, S, t, opts); }
    finally { FAST = false; ENGRAVE = false; LUMINOUS = false; TIGHT = false; GROUND_EL = false; GUILLOCHE = false; }
  }
  /* a wallpaper: the sky without its wheel, the field running to the edges of a W × H canvas. the dial is sized to the width. */
  function renderWallpaper(ctx, state, W, H, t, opts = {}) {
    const S = Math.round(Math.min(W, H) / 0.74 * (W > H ? 0.75 : 1));   // on a landscape screen (a desktop wallpaper) the figure sits a quarter smaller, clear of the icons
    return render(ctx, state, S, t, { ...opts, mode: 'clock', bare: { W, H }, caption: false });
  }

  SD.render = { render, renderWallpaper, overlay, ground, captionLines, layout, signColorAt, coreColor, presence, hardness, figureColor, supportsFilter };
})(window.SD = window.SD || {});
