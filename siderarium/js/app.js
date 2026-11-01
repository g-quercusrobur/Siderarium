/*  siderarium — app shell
    Live clock, time scrubber, places, modes, export.
*/
(function (SD) {
  'use strict';
  /* one city for each time zone, west to east */
  const ZONES = [
    ['pago pago', -14.2756, -170.7020, 'Pacific/Pago_Pago'], ['honolulu', 21.3069, -157.8583, 'Pacific/Honolulu'],
    ['atuona', -9.8030, -139.0410, 'Pacific/Marquesas'], ['anchorage', 61.2181, -149.9003, 'America/Anchorage'],
    ['los angeles', 34.0522, -118.2437, 'America/Los_Angeles'], ['denver', 39.7392, -104.9903, 'America/Denver'],
    ['mexico city', 19.4326, -99.1332, 'America/Mexico_City'], ['new york', 40.7128, -74.0060, 'America/New_York'],
    ['caracas', 10.4806, -66.9036, 'America/Caracas'], ["st. john's", 47.5615, -52.7126, 'America/St_Johns'],
    ['são paulo', -23.5505, -46.6333, 'America/Sao_Paulo'], ['noronha', -3.8540, -32.4240, 'America/Noronha'],
    ['ponta delgada', 37.7412, -25.6756, 'Atlantic/Azores'], ['greenwich', 51.4769, -0.0005, 'UTC', 'GMT'],
    ['rome', 41.9028, 12.4964, 'Europe/Rome'], ['jerusalem', 31.7683, 35.2137, 'Asia/Jerusalem'],
    ['istanbul', 41.0082, 28.9784, 'Europe/Istanbul'], ['tehran', 35.6892, 51.3890, 'Asia/Tehran'],
    ['dubai', 25.2048, 55.2708, 'Asia/Dubai'], ['kabul', 34.5553, 69.2075, 'Asia/Kabul'],
    ['karachi', 24.8607, 67.0011, 'Asia/Karachi'], ['mumbai', 19.0760, 72.8777, 'Asia/Kolkata'],
    ['kathmandu', 27.7172, 85.3240, 'Asia/Kathmandu'], ['dhaka', 23.8103, 90.4125, 'Asia/Dhaka'],
    ['yangon', 16.8409, 96.1735, 'Asia/Yangon'], ['bangkok', 13.7563, 100.5018, 'Asia/Bangkok'],
    ['beijing', 39.9042, 116.4074, 'Asia/Shanghai'], ['tokyo', 35.6762, 139.6503, 'Asia/Tokyo'],
    ['darwin', -12.4634, 130.8456, 'Australia/Darwin'], ['sydney', -33.8688, 151.2093, 'Australia/Sydney'],
    ['nouméa', -22.2758, 166.4580, 'Pacific/Noumea'], ['auckland', -36.8485, 174.7633, 'Pacific/Auckland'],
    ["nuku'alofa", -21.1394, -175.2018, 'Pacific/Tongatapu'], ['kiritimati', 1.8721, -157.3626, 'Pacific/Kiritimati']
  ].map(([name, lat, lon, tz, zoneLabel]) => ({ name, lat, lon, tz, zoneLabel }));
  const PLACES = Object.fromEntries(ZONES.map(z => [z.name, z]));
  const offsetOf = (tz, d = new Date()) => {
    try { return new Intl.DateTimeFormat('en-GB', { timeZone: tz, timeZoneName: 'shortOffset' }).formatToParts(d).find(p => p.type === 'timeZoneName').value.replace('GMT', 'UTC') || 'UTC'; }
    catch (e) { return ''; }
  };
  /* without a stored place: the city of the device's own time zone, then the device's position if allowed */
  function placeFromDevice() {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const exact = ZONES.find(z => z.tz === tz);
    if (exact) return exact;
    const off = offsetOf(tz);
    return ZONES.find(z => offsetOf(z.tz) === off) || PLACES.greenwich;
  }
  const store = {
    get(k, d) { try { const v = localStorage.getItem('cw.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem('cw.' + k, JSON.stringify(v)); return localStorage.getItem('cw.' + k) === JSON.stringify(v); } catch (e) { return false; } },   // true only when the browser kept it
    works() { try { localStorage.setItem('cw.probe', '1'); const ok = localStorage.getItem('cw.probe') === '1'; localStorage.removeItem('cw.probe'); return ok; } catch (e) { return false; } }
  };
  const params = new URLSearchParams(location.search);

  const S = {
    mode: params.get('mode') || store.get('mode', 'clock'),
    place: store.get('place', null) || placeFromDevice(),
    firstVisit: !store.get('place', null),
    speed: 1,                                              // hours of sky per second while running
    live: !params.get('t'),
    offsetMs: 0,
    fixed: params.get('t') ? new Date(params.get('t')) : null,
    playing: false,
    preview: 0,                                            // minutes ahead, from the 24-hour strip
    sigil: params.get('sigil') === '1',
    engrave: params.get('field') ? params.get('field') !== 'glow' : (params.get('engrave') !== '0' && store.get('field', 'engraved') !== 'glow'),   // engraved at rest; glow on request
    natal: store.get('natal', null),                        // { date, place, unknownTime } — stays on this device
    lang: params.get('lang') || store.get('lang', null) || ((navigator.language || 'en').toLowerCase().startsWith('es') ? 'es' : 'en'),
    field: params.get('field') || (store.get('field', 'engraved') === 'guilloche' ? 'guilloche' : 'waves'),   // the engraving as it was; guilloché on request
    houses: params.get('houses') || store.get('houses', 'regiomontanus'),   // lilly's system; equal and placidus to compare
    luminous: params.get('bodies') === 'luminous' || (!params.get('bodies') && store.get('bodies', 'lights') === 'lights'),   // planets as lights (default); bodies on request
    relocate: store.get('relocate', false),                   // the nativity seen from the current place
    charts: store.get('charts', []),                           // saved nativities, on this device
    reading: true,                                             // the readout is always there
    groundEl: params.get('ground') === 'element',              // prototype: the element of the hour as the ground
    wall: params.get('wall') === '1', ox: 0,                          // live wallpaper: the sky alone, filling the window, for lively / plash / wallpaper engine
    state: null,
    lastCompute: 0
  };
  if (params.get('place') && PLACES[params.get('place')]) S.place = PLACES[params.get('place')];
  if (params.get('lat') && params.get('lon') && Number.isFinite(+params.get('lat')) && Number.isFinite(+params.get('lon')))   // any horizon, for a wallpaper: ?lat=45.05&lon=9.69&tz=Europe/Rome&name=Piacenza
    S.place = { name: (params.get('name') || 'here').slice(0, 80), lat: Math.max(-90, Math.min(90, +params.get('lat'))), lon: Math.max(-180, Math.min(180, +params.get('lon'))), tz: validZone(params.get('tz')) ? params.get('tz') : Intl.DateTimeFormat().resolvedOptions().timeZone };

  const $ = id => document.getElementById(id);
  const canvas = $('dial');
  const ctx = canvas.getContext('2d');
  const plate = document.createElement('canvas');          // the full render, redrawn only when the sky moves
  const pctx = plate.getContext('2d');
  let info = null, lastPlate = 0;
  const view = { z: 1, x: 0, y: 0, pinching: false };      // screen = view.xy + view.z × dial

  /* one displacement: the moment shown = anchor (real now, or a fixed moment) + offsetMs. the dial, the slider, the arrows and the run all move it. */
  const anchor = () => S.fixed ? S.fixed.getTime() : Date.now();
  function base() { return new Date(anchor() + S.offsetMs); }
  function now() { return base(); }

  /* the nativity, computed once per birth data */
  const natalCache = { key: null, state: null };
  function natalState() {
    if (!S.natal) return null;
    const place = S.relocate ? S.place : S.natal.place;     // relocated: the same instant, the houses of another horizon
    const key = JSON.stringify([S.natal.date, place, S.houses]);
    if (natalCache.key !== key) {
      const st = SD.engine.compute(new Date(S.natal.date), place, { houses: S.houses });
      st.natalView = true; st.nextChord = null; st.relocated = S.relocate ? place.name : null;
      natalCache.key = key; natalCache.state = st;
    }
    return natalCache.state;
  }
  const natalModes = ['natal', 'natalchart', 'synastry'];
  /* the leading transits' dates (exact, entering and leaving orb) are searched once per transit and day and kept */
  const spanCache = new Map();
  function transitInfo(ns, tr) {
    const day = Math.floor(now().getTime() / 864e5), spans = {}, houses = {};
    for (const a of tr.slice(0, 4)) {
      const key = [S.natal.id || S.natal.date, a.a, a.b, a.aspect, day].join('|');
      if (!spanCache.has(key)) { if (spanCache.size > 200) spanCache.clear(); spanCache.set(key, SD.engine.transitSpan(a.a, a.nlon, a.angle, a.orbMax, now())); }
      spans[a.a + '|' + a.b + '|' + a.aspect] = spanCache.get(key);
      houses[a.a] = SD.engine.houseIn(ns.cusps, S.state.bodies[a.a].lon);
    }
    return { name: S.natal.name || '', spans, houses };
  }
  function viewState() { return (S.mode === 'natal' || S.mode === 'natalchart') && S.natal ? natalState() : S.state; }

  function recompute() {
    const busy = S.playing || S.dragging;
    S.state = SD.engine.compute(now(), S.place, { light: busy, houses: S.houses });
    if (!busy) S.state.nextChord = SD.engine.nextChordShift(S.state.date, S.place);
    if (S.mode === 'synastry' && S.natal) {                 // the sky of now against the nativity: the figure is the strongest transit
      const ns = natalState(), tr = SD.engine.computeTransits(S.state, ns).filter(x => x.power > 0.04);
      S.state.natal = ns; S.state.transits = tr;
      S.state.interaction = SD.engine.computeInteractions(S.state, ns, tr);   // what the two skies make together
      S.state.transitInfo = transitInfo(ns, tr);                                 // when each leading transit is exact, and where it stands in the natal houses
      // the companion stone (SD.engine.stoneOf) is kept but not shown for now
      S.state.configs = { ...S.state.configs, primary: tr[0] || null, secondary: tr.slice(1, 3), scale: 1, cut: null };
    }
    S.lastCompute = performance.now();
    S.dirty = true;
    document.documentElement.style.setProperty('--ground', S.groundEl ? SD.render.ground(S.state, true) : '#000000');
    document.body.classList.toggle('mrx', viewState().bodies.mercury.slow > 0.5);   // mercury retrograde: the print misregisters
    const c = SD.render.captionLines(viewState());
    const low = s => s.replace(/^./, ch => ch.toLowerCase());
    for (const k in c) if (typeof c[k] === 'string') c[k] = esc(c[k]);
    $('caption').innerHTML = `<p class="eyebrow">${c.label} <a class="what" href="#read-title">${esc(SD.i18n.t('cap.whatItMeans'))}</a></p><h2 class="h1 state-${c.stateKey}">${c.state}</h2><p class="deck">${c.title}</p><p class="reason">${c.reason}</p><p class="moment">${c.l1}</p><p class="detail">${c.detail1}<br>${c.detail2} · ${c.detail3}</p><p class="detail">${c.detail4}</p>`;
    linkTerms($('caption'));
    if (!busy) scanIfNeeded();
    drawStrip();
    if (!busy) updateReadout();                            // the heavy parts wait until the clock rests
    followChord();
    updateControls();
  }

  function size() {
    if (S.wall) {                                           // the whole window, no wheel: a live wallpaper
      const W = window.innerWidth, H = window.innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
      canvas.style.width = W + 'px'; canvas.style.height = H + 'px';
      canvas.width = Math.round(W * dpr); canvas.height = Math.round(H * dpr);
      plate.width = canvas.width; plate.height = canvas.height;
      S.side = Math.min(W, H); S.dpr = dpr; S.dirty = true; return;
    }
    const box = $('stage').getBoundingClientRect();
    const small = box.width < 560;
    const reserve = small ? 0 : 110;                        // room for the 24-hour strip under the dial
    const side = Math.floor(Math.min(box.width - 16, small ? box.width : box.height - reserve - 16));
    $('ahead').style.width = side + 'px';
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const W = small ? side : Math.floor(box.width - 16);     // on desktop the canvas spans the stage: the aura runs beside the square
    S.ox = Math.floor((W - side) / 2);
    canvas.style.width = W + 'px'; canvas.style.height = side + 'px';
    canvas.width = Math.round(W * dpr); canvas.height = Math.round(side * dpr);
    document.querySelector('.dialwrap').style.setProperty('--ox', S.ox + 'px');
    S.side = side; S.dpr = dpr;
    plate.width = canvas.width; plate.height = canvas.height;
    S.dirty = true;
    document.body.classList.toggle('small', side < 560);
    const st = $('strip'); st.width = Math.round(side * dpr); st.height = Math.round(44 * dpr);
    drawStrip();
  }

  /* ---------- the next 24 hours: ideation (aleph), incarnation (mem), destruction (shin) ---------- */
  const MOTHER_INK = { ideation: '#f2e8a0', incarnation: '#4a7ef0', destruction: '#ff5a2a' };   // king scale of the mother letters
  const STRIP_H = 72;                                       // the strip under the dial spans three days
  const VEIL_INK = '#c9b8f5';                                // the veil: a silver violet, on its own scale, dashed
  const scan = { key: null, t0: 0, step: 20, vals: null, nexts: null, token: 0 };
  function scanIfNeeded() {
    const b = anchor();                                     // the strip stays anchored at now; the playhead moves along it
    const key = S.place.name + S.place.lat + S.place.lon;
    if (scan.key === key && Math.abs(b - scan.t0) < 30 * 60000) return;
    scan.key = key; scan.t0 = b; scan.vals = null; scan.nexts = null;
    const token = ++scan.token, N = 7 * 72, out = [];
    let i = 0;
    (function chunk() {
      if (token !== scan.token) return;
      for (let k = 0; k < 24 && i <= N; k++, i++) {
        const st = SD.engine.compute(new Date(b + i * scan.step * 60000), S.place, { light: true, houses: S.houses });
        out.push({ ...st.windows, house: st.bodies.moon.house, veil: st.veil.v, share: st.mode.share });   // the Moon's house names the window's stage; the veil and the mode's shares ride along
      }
      if (i <= N) return setTimeout(chunk, 0);
      scan.vals = out;
      scan.nexts = {};
      for (const m of Object.keys(MOTHER_INK)) {
        const v = out.map(w => w[m]), sorted = v.slice().sort((x, y) => x - y);
        const T = Math.max(0.06, sorted[Math.floor(sorted.length * 0.85)]);   // each mother names her best hour of the week, even a modest one
        let j = v.findIndex((x, n) => n > 0 && x >= T);
        if (j > 0) { while (j + 1 < v.length && v[j + 1] >= v[j]) j++; scan.nexts[m] = { at: new Date(b + j * scan.step * 60000), v: v[j], house: out[j].house }; }
      }
      {                                                       // the veil: its thinnest point in the coming day, else the week
        const pick = (from, to) => { let j = -1, best = 0; for (let n = from; n < Math.min(to, out.length); n++) if (out[n].veil > best) { best = out[n].veil; j = n; } return j; };
        let j = pick(1, 73); const jw = pick(1, out.length);   // a great night within the week outranks the day's own twilight
        if (jw >= 0 && (j < 0 || out[jw].veil >= 0.9 || out[jw].veil > out[j].veil + 0.15)) j = jw;
        scan.veil = j >= 0 ? { at: new Date(b + j * scan.step * 60000), v: out[j].veil, house: out[j].house } : null;
      }
      drawStrip(); drawNexts();
    })();
  }
  function drawStrip() {
    const cv = $('strip'); if (!cv || !cv.width) return;
    const c = cv.getContext('2d'), W = cv.width, H = cv.height, d = S.dpr || 1;
    c.clearRect(0, 0, W, H);
    c.strokeStyle = 'rgba(235,231,220,0.18)'; c.lineWidth = d;
    c.beginPath(); c.moveTo(0, H - 0.5 * d); c.lineTo(W, H - 0.5 * d); c.stroke();
    for (let h = 0; h <= STRIP_H; h += 6) { const x = Math.min(W - d, h / STRIP_H * W); c.beginPath(); c.moveTo(x, H); c.lineTo(x, H - (h % 24 ? 3 : 6) * d); c.stroke(); }   // a tick every six hours, taller at the days
    if (scan.vals) {
      const n = STRIP_H * 3, vals = scan.vals.slice(0, n + 1), keys = Object.keys(MOTHER_INK);   // three steps an hour
      const peak = Math.max(0.08, ...scan.vals.flatMap(w => keys.map(k => w[k])));   // the week's strongest window sets the scale; the rows also carry the Moon's house, which is not a value
      const top = 14 * d;                                     // room for the hour labels (the band of shares was tried and retired: too busy)
      for (const [m, col] of Object.entries(MOTHER_INK)) {
        c.strokeStyle = col; c.lineWidth = 1.6 * d; c.globalAlpha = 0.9;
        c.beginPath();
        vals.forEach((w, i) => { const x = i / n * W, y = H - 2 * d - (w[m] / peak) * (H - 4 * d - top); i ? c.lineTo(x, y) : c.moveTo(x, y); });
        c.stroke();
      }
      c.strokeStyle = VEIL_INK; c.lineWidth = 1.4 * d; c.globalAlpha = 0.85; c.setLineDash([3 * d, 3 * d]);   // the veil on its own scale, 0 to 1
      c.beginPath();
      vals.forEach((w, i) => { const x = i / n * W, y = H - 2 * d - (w.veil || 0) * (H - 4 * d - top); i ? c.lineTo(x, y) : c.moveTo(x, y); });
      c.stroke(); c.setLineDash([]);
      c.globalAlpha = 1;
    }
    c.font = `${10 * d}px "Geist Mono", monospace`; c.fillStyle = 'rgba(235,231,220,0.5)'; c.textBaseline = 'top';
    SD.i18n.t('ui.strip').map((l, n) => [SD.i18n.cap1(l), n * 24]).forEach(([l, h]) => { c.textAlign = h === 0 ? 'left' : h === STRIP_H ? 'right' : 'center'; c.fillText(l, h / STRIP_H * W, 2 * d); });
    const x = Math.max(0, Math.min(1, S.offsetMs / (STRIP_H * 3600e3))) * W;
    c.fillStyle = 'rgba(235,231,220,0.9)'; c.fillRect(Math.min(W - 2 * d, x), 0, 2 * d, H);
  }
  function fmtAt(d) {
    return new Intl.DateTimeFormat(SD.i18n.locale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: S.place.tz || 'UTC' }).format(d).replace(/^./, c => c.toUpperCase());
  }
  function drawNexts() {
    const el = $('nexts');
    const i = SD.i18n;
    if (!scan.nexts) { el.innerHTML = `<span>${i.cap1(i.t('ui.reading'))}</span>`; return; }
    el.innerHTML = Object.entries(MOTHER_INK).map(([m, col]) => {
      const n = scan.nexts[m];
      return n ? `<button data-jump="${n.at.toISOString()}" title="${i.t('ui.goTo')}"><i style="background:${col}"></i>${i.cap1(i.window(m))} · ${fmtAt(n.at)} · ${i.t('ui.r.in')} ${i.house12(n.house)}</button>`
               : `<span><i style="background:${col}"></i>${i.cap1(i.window(m))} · ${i.t('ui.notThisWeek')}</span>`;
    }).join('') + (scan.veil
      ? `<button data-jump="${scan.veil.at.toISOString()}" title="${i.t('ui.goTo')}"><i class="dash" style="background:${VEIL_INK}"></i>${i.cap1(i.t('ui.veil'))} · ${i.t('ui.veilThin')} ${fmtAt(scan.veil.at)} · ${i.t('ui.r.in')} ${i.house12(scan.veil.house)}</button>`
      : `<span><i class="dash" style="background:${VEIL_INK}"></i>${i.cap1(i.t('ui.veil'))} · ${i.t('ui.notThisWeek')}</span>`);
    el.querySelectorAll('[data-jump]').forEach(b => b.addEventListener('click', () => { S.playing = false; S.offsetMs = new Date(b.dataset.jump).getTime() - anchor(); recompute(); }));
  }

  let t0 = performance.now(), lastFrame = 0;
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!S.playing && !S.dragging && ts - lastFrame < 1000 / 30) return;     // at rest 30 fps; running, every frame the screen gives
    const dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000);
    if (S.playing) { S.offsetMs += S.speed * 3600e3 * dt; recompute(); }   // smooth: time advances with the real frame interval
    else if (performance.now() - S.lastCompute > 20000) recompute();
    lastFrame = ts;
    const t = (ts - t0) / 1000;
    if (S.wall) {
      if (S.dirty) {
        pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, plate.width, plate.height);
        info = SD.render.renderWallpaper(pctx, viewState(), plate.width, plate.height, t, { fieldRes: 300, plate: true, fast: S.playing, field: S.field, sigil: S.sigil, engrave: S.engrave, luminous: S.luminous });
        S.dirty = false; lastPlate = ts;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(plate, 0, 0);
      SD.render.overlay(ctx, info, t);
      return;
    }
    if (S.dirty) {
      pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, plate.width, plate.height);
      pctx.setTransform(S.dpr * view.z, 0, 0, S.dpr * view.z, S.dpr * (view.x + S.ox), S.dpr * view.y);   // the view: zoom and pan, the square centred in the canvas
      const busy = S.playing || S.dragging || view.pinching;
      const bounds = { x: -(view.x + S.ox) / view.z, y: -view.y / view.z, w: (S.side + 2 * S.ox) / view.z, h: S.side / view.z };   // the canvas, in dial coordinates
      info = SD.render.render(pctx, viewState(), S.side, t, { mode: S.mode === 'chart' || S.mode === 'natalchart' ? 'chart' : 'clock', fieldRes: busy ? 110 : 200, caption: S.side >= 560, plate: true, fast: busy, field: S.field, sigil: S.sigil, engrave: S.engrave, luminous: S.luminous, tight: S.side < 560, groundEl: S.groundEl, bounds });
      S.dirty = false; lastPlate = ts;
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(plate, 0, 0);
    ctx.setTransform(S.dpr * view.z, 0, 0, S.dpr * view.z, S.dpr * (view.x + S.ox), S.dpr * view.y);
    SD.render.overlay(ctx, info, t);
    placeWhatLink(info);
  }
  /* the "what it means" link drawn on the canvas gets a clickable area in the page, following zoom and pan */
  function placeWhatLink(info) {
    const a = $('what-link'); if (!a) return;
    const e = info && info.layout && info.layout.eyebrow;
    if (!e || S.side < 560 || S.wall || document.body.classList.contains('bare')) { a.hidden = true; return; }
    a.hidden = false;
    a.style.left = `${view.x + S.ox + e.x * view.z}px`; a.style.top = `${view.y + e.y * view.z}px`; a.style.width = `${e.w * view.z}px`; a.style.height = `${e.h * view.z}px`;
  }

  /* ---------- sound: the chord as a slow organ drone ----------
     Pure tones with their first overtones (the organ pipe; Pythagoras' and Kepler's music of the spheres),
     each doubled with a slight detune so it breathes. A = 440. The root also sounds an octave below.
     Swells in over 3 s, glides to the next chord when the sky shifts, fades over 3 s on stop. */
  const audio = { ctx: null, bus: null, voices: [], key: null, on: false };
  function reverb(ac) {
    const len = ac.sampleRate * 3.2, buf = ac.createBuffer(2, len, ac.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = buf.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.2); }
    const c = ac.createConvolver(); c.buffer = buf; return c;
  }
  /* the voicing: the sign gives the pitch, the sky gives the register. a planet high in the sky sounds high, one
     below the horizon low; the Moon sings softer in her own place; the guardians of the day and the hour hold the
     ground in the lowest octave. the root of the figure's chord is doubled an octave below for weight. */
  function voicing(ch) {
    if (!ch || !ch.voices || !ch.voices.length) return [];
    const freq = (pc, oct) => 440 * Math.pow(2, (pc - 9) / 12 + (oct - 4));
    const octOf = alt => 2 + Math.round((Math.max(-90, Math.min(90, alt || 0)) + 90) / 180 * 2.6);   // octave 2 deep below the horizon, 3 near it, 4 high, 5 at the zenith
    const out = [];
    for (const v of ch.voices) {
      if (v.role === 'day' || v.role === 'hour') { out.push({ f: freq(v.pc, 2), g: v.role === 'day' ? 0.7 : 0.55, role: v.role }); continue; }
      const o = octOf(v.alt), isRoot = v.role === 'figure' && v.pc === ch.root;
      out.push({ f: freq(v.pc, o), g: v.role === 'moon' ? 0.45 : isRoot ? 1 : 0.8, role: v.role });
      if (isRoot && o > 2) out.push({ f: freq(v.pc, o - 1), g: 0.5, role: 'root' });
    }
    const one = new Map();                                  // one voice per pitch: the louder stays
    for (const v of out) { const k = v.f.toFixed(2); if (!one.has(k) || one.get(k).g < v.g) one.set(k, v); }
    return [...one.values()].sort((a, b) => a.f - b.f);
  }
  const voiceKey = ch => voicing(ch).map(v => v.f.toFixed(1)).join(',');
  function soundChord(ch, fadeIn = 3) {
    const ac = audio.ctx, now = ac.currentTime;
    for (const v of audio.voices) { v.gain.gain.cancelScheduledValues(now); v.gain.gain.setValueAtTime(v.gain.gain.value, now); v.gain.gain.linearRampToValueAtTime(0, now + 3); v.oscs.forEach(o => o.stop(now + 3.1)); }
    audio.voices = [];
    for (const { f, g } of voicing(ch)) {
      const gain = ac.createGain(); gain.gain.setValueAtTime(0, now); gain.gain.linearRampToValueAtTime(0.11 * g, now + fadeIn);
      gain.connect(audio.bus);
      const oscs = [];
      for (const [mult, amp] of [[1, 1], [2, 0.32], [3, 0.14], [4, 0.06]]) for (const det of [-0.12, 0.12]) {
        const o = ac.createOscillator(), a = ac.createGain();
        o.type = 'sine'; o.frequency.value = f * mult + det * mult; a.gain.value = amp / 2;
        o.connect(a).connect(gain); o.start(now); oscs.push(o);
      }
      audio.voices.push({ gain, oscs });
    }
    audio.key = ch ? voiceKey(ch) : null;
  }
  function listen(on) {
    if (on && !audio.ctx) {
      const Ctx = window.AudioContext || window.webkitAudioContext; if (!Ctx) return;
      const ac = audio.ctx = new Ctx();
      const lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
      const master = ac.createGain(); master.gain.value = 0.9;
      const wet = ac.createGain(); wet.gain.value = 0.55; const rv = reverb(ac);
      audio.bus = lp; lp.connect(master); lp.connect(rv).connect(wet).connect(master); master.connect(ac.destination);
    }
    audio.on = on;
    if (!audio.ctx) return;
    if (on) { audio.ctx.resume(); soundChord(viewState().chord); }   // the chord of the view: the birth chart's in the natal tab, the sky's elsewhere
    else soundChord(null);
    $('listen-corner').classList.toggle('on', on); $('listen-corner').title = SD.i18n.t(on ? 'ui.listening' : 'ui.listen');
  }
  function followChord() { if (!audio.on || !S.state) return; const ch = viewState().chord; if (ch && voiceKey(ch) !== audio.key) soundChord(ch, 2.5); }   // a new note, or a voice changing register as the sky turns

  /* ---------- export: square art ---------- */
  async function downloadBlob(b, name) {
    try {                                                   // inside the claude.ai viewer a file is handed over through its downloads capability
      const dl = window.claude && typeof window.claude.use === 'function' ? await window.claude.use('downloads') : null;
      if (dl) { await dl.save({ filename: name, data: b }); return; }
    } catch (e) { if (e && e.code === 'declined') return; }
    const a = document.createElement('a');
    a.href = URL.createObjectURL(b); a.download = name;
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }
  function download(cv, name) { cv.toBlob(b => downloadBlob(b, name), 'image/png'); }

  /* ---------- charts out and in: a small file of the saved charts and settings, to carry between devices and addresses ---------- */
  function exportCharts() {
    const payload = { app: 'siderarium', format: 1, exported: new Date().toISOString(), natal: S.natal, charts: S.charts,
      settings: { lang: S.lang, houses: S.houses, field: S.field, bodies: store.get('bodies', 'lights'), relocate: S.relocate, place: S.place } };
    downloadBlob(new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' }), `siderarium-charts-${new Date().toISOString().slice(0, 10)}.json`);
  }
  /* a chart from outside is rebuilt from its known fields only, each one checked: a bad zone or date is refused, never run */
  function validZone(tz) { try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); return typeof tz === 'string' && tz.length < 64; } catch (e) { return false; } }   // a declaration: it is used at the top of the module too
  function soundChart(c) {
    if (!c || typeof c !== 'object' || !c.place || typeof c.place !== 'object') return null;
    const t = Date.parse(c.date); if (!Number.isFinite(t) || t < -62135596800000 || t > 253402300799000) return null;
    const lat = +c.place.lat, lon = +c.place.lon;
    if (!(lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180)) return null;
    const tz = validZone(c.place.tz) ? c.place.tz : null; if (!tz) return null;
    const str = (v, n) => typeof v === 'string' ? v.slice(0, n) : undefined;
    return { id: str(c.id, 40) || uid(), name: str(c.name, 80), date: new Date(t).toISOString(), unknownTime: !!c.unknownTime,
      place: { name: str(c.place.name, 80) || 'place', label: str(c.place.label, 160), lat, lon, tz } };
  }
  function importCharts(file) {
    const i = SD.i18n, note = $('import-note');
    file.text().then(txt => {
      const d = JSON.parse(txt);
      if (!d || d.app !== 'siderarium' || !Array.isArray(d.charts)) throw new Error('format');
      let n = 0;
      for (const raw of d.charts) {
        const c = soundChart(raw); if (!c) continue;
        if (!S.charts.some(x => x.id === c.id)) { S.charts.push(c); n++; }
      }
      store.set('charts', S.charts);
      const nat = soundChart(d.natal);
      if (!S.natal && nat) { S.natal = nat; store.set('natal', S.natal); natalCache.key = null; }
      note.textContent = i.cap1(i.t('ui.imported')(n));
      refreshMenu(); recompute();
    }).catch(() => { note.textContent = i.cap1(i.t('ui.badFile')); });
  }

  /* ---------- the birth chart report: everything an interpreter, human or machine, needs, as plain text ---------- */
  function chartReportText() {
    const st = natalState(); if (!st) return null;
    const i = SD.i18n, C = SD.corr, n = S.natal, R = k => i.t('ui.rep.' + k);
    const P = k => i.cap1(i.planet(k)), A = k => i.aspect(k);
    const lonTxt = lon => { const L = ((lon % 360) + 360) % 360, sg = Math.floor(L / 30), d = L - sg * 30; return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′ ${i.sign(sg)} (${L.toFixed(2)}°)`; };
    const pp = placeParts(new Date(n.date), n.place.tz), off = offsetOf(n.place.tz, new Date(n.date));
    const L = [];
    L.push(`# ${R('title')} · ${n.name || i.t('ui.noneSet')}`, '');
    L.push(R('intro').replace('{houses}', S.houses), '');
    L.push(`## ${R('birth')}`);
    L.push(`- ${R('name')}: ${n.name || '—'}`);
    L.push(`- ${R('local')}: ${pp.year}-${pp.month}-${pp.day} ${n.unknownTime ? R('noon') : pp.hour + ':' + pp.minute} (${n.place.tz}, ${off})`);
    L.push(`- ${R('utc')}: ${new Date(n.date).toISOString().replace('T', ' ').slice(0, 16)} UTC`);
    L.push(`- ${R('place')}: ${n.place.label || i.placeName(n.place.name)} · ${(+n.place.lat).toFixed(4)}, ${(+n.place.lon).toFixed(4)}`);
    if (st.relocated) L.push(`- ${R('relocated')}: ${i.placeName(st.relocated)}`);
    L.push(`- ${R('system')}: ${R('zodiac')} · ${S.houses} · ${st.sect === 'day' ? R('dayChart') : R('nightChart')}`, '');
    L.push(`## ${R('angles')}`);
    L.push(`- ASC ${lonTxt(st.asc)}`, `- MC ${lonTxt(st.mc)}`, `- DSC ${lonTxt(st.asc + 180)}`, `- IC ${lonTxt(st.mc + 180)}`);
    L.push(`- ${i.cap1(i.t('ui.r.onAngles'))}: ${st.onAngles && st.onAngles.length ? st.onAngles.map(x => `${P(x.planet)} ${A('conjunction')} ${i.t('ui.r.angle.' + x.angle)} ${x.orb.toFixed(1)}°`).join(' · ') : i.t('ui.r.noneOnAngles')}`, '');
    L.push(`## ${R('houses')}`);
    for (let h = 1; h <= 12; h++) L.push(`- ${i.roman(h)} ${lonTxt(st.cusps[h])}`);
    L.push('');
    L.push(`## ${R('planets')}`);
    L.push(`| ${R('planet')} | ${R('position')} | ${R('house')} | ${R('motion')} | ${R('dignity')} | ${R('condition')} | ${R('decan')} |`, '|---|---|---|---|---|---|---|');
    for (const k of C.ORDER) {
      const b = st.bodies[k];
      const motion = b.station ? R('stationary') : b.retro ? R('retrograde') : R('direct');
      const cond = [b.cazimi && 'cazimi', b.combust && R('combust'), b.beams && R('beams'), b.oob && R('oob'), b.angular && R('angular')].filter(Boolean).join(', ') || '—';
      const dg = `${b.dignity.score >= 0 ? '+' : ''}${b.dignity.score} ${b.dignity.labels.map(x => i.t('dignity.' + x.split(' ')[0]) === 'dignity.' + x.split(' ')[0] ? x : x.replace(/^reception with (\w+)$/, (m, o) => `${i.t('dignity.reception')} ${i.planet(o)}`).replace(/^\w+$/, y => i.t('dignity.' + y))).join(', ')}`;
      const dec = `${i.decanOrd(b.decan.decan)} ${i.t('cap.decanOf')} ${i.sign(b.sign)} · ${P(b.decan.ruler)} · ${i.card(b.decan)} · ${i.title(b.decan)}`;
      L.push(`| ${P(k)} | ${lonTxt(b.lon)} | ${i.roman(b.house)} | ${motion} ${b.speed.toFixed(2)}°/d | ${dg} | ${cond} | ${dec} |`);
    }
    L.push('');
    const m = st.bodies.moon, mc = st.moon;
    L.push(`## ${R('moon')}`);
    L.push(`- ${R('phase')}: ${mc.phaseAngle.toFixed(1)}° · ${Math.round(mc.illum * 100)}% · ${mc.waxing ? R('waxing') : R('waning')}`);
    L.push(`- ${R('verdict')}: ${i.verdict(mc.verdict)}${mc.verdict === 'void' && mc.tolerable ? ` (${R('tolerable')})` : ''}`);
    if (mc.next) L.push(`- ${R('nextMoon')}: ${A(mc.next.aspect)} ${P(mc.next.planet)} ${R('inDays')} ${mc.next.days.toFixed(2)}`);
    if (mc.flags && mc.flags.length) L.push(`- ${R('flags')}: ${mc.flags.map(f => i.flag(f)).join(', ')}`);
    L.push(`- ${R('mansion')}: ${i.ordinal(m.mansion.index)} · ${i.name(m.mansion.name)}`, '');
    L.push(`## ${R('aspects')}`);
    L.push(`| ${R('pair')} | ${R('aspect')} | ${R('orb')} | ${R('phase2')} | ${R('power')} |`, '|---|---|---|---|---|');
    for (const a of st.aspects) L.push(`| ${P(a.a)} – ${P(a.b)} | ${A(a.aspect)} (${a.angle}°) | ${a.orb.toFixed(2)}° | ${a.applying ? R('applying') : R('separating')}${a.dissociate ? ', ' + R('dissociate') : ''} | ${a.power.toFixed(2)} |`);
    L.push('');
    const h = st.hour;
    L.push(`## ${R('hour')}`);
    L.push(`- ${R('dayRuler')}: ${P(h.dayRuler)} · ${R('angel')} ${i.name(h.dayAngel)}`);
    L.push(`- ${R('hourRuler')}: ${P(h.hourRuler)} · ${R('angel')} ${i.name(h.angel)} · ${R('hourIndex')} ${h.index + 1} ${h.isDay ? R('ofDay') : R('ofNight')}${h.polar ? ' · ' + R('polar') : ''}`, '');
    L.push(`## ${R('elements')}`);
    L.push(Object.entries(st.elements.shares).map(([k, v]) => `${i.t('elements.' + k) === 'elements.' + k ? k : i.t('elements.' + k)} ${Math.round(v * 100)}%`).join(' · '), '');
    L.push(`## ${R('layers')}`);
    const pr = st.configs.primary;
    if (pr) L.push(`- ${R('figure')}: ${P(pr.a)} ${A(pr.aspect)} ${P(pr.b)} · {${pr.n}/${pr.k}} · ${R('orb')} ${pr.orb.toFixed(2)}°${st.configs.cut ? ` · ${R('cut')} ${P(st.configs.cut.by)}` : ''}`);
    L.push(`- ${R('chord')}: ${i.chordLong(st.chord)}${st.chord.notes.length ? ' · ' + st.chord.notes.map(x => i.note(x)).join(' ') : ''}`);
    L.push(`- ${R('windows')}: ${Object.entries(st.windows).map(([k, v]) => `${i.window(k)} ${v.toFixed(2)}`).join(' · ')}`);
    L.push(`- ${R('titleOf')}: ${i.state(st.title.state)} · ${i.house12(st.title.house)} · ${i.window(st.title.mode)}`);
    L.push(`- ${R('veil')}: ${st.veil.v.toFixed(2)}${st.veil.factors.length ? ' · ' + st.veil.factors.map(x => i.t('ui.veilOf.' + x.key)).join(', ') : ''}`, '');
    if (S.state) {                                          // the sky of now against this chart
      const tr = SD.engine.computeTransits(S.state, st).filter(x => x.power > 0.04), inter = SD.engine.computeInteractions(S.state, st, tr);
      L.push(`## ${R('transits')} · ${placeStamp(S.state.date)} ${S.place.tz}`);
      L.push(`- ${R('verdict')}: ${i.t('ui.r.' + inter.verdict) === 'ui.r.' + inter.verdict ? inter.verdict : i.t('ui.r.' + inter.verdict)} · ${R('harmony')} ${inter.harmony.toFixed(2)} · ${R('strife')} ${inter.strife.toFixed(2)}`);
      for (const a of tr.slice(0, 14)) L.push(`- ${P(a.a)} ${A(a.aspect)} ${R('natal')} ${C.PLANETS[a.b] ? P(a.b) : a.b === 'ascendant' ? 'ASC' : 'MC'} · ${a.orb.toFixed(2)}° ${a.applying ? R('applying') : R('separating')} · ${a.power.toFixed(2)}`);
      L.push('');
    }
    L.push(`— ${R('footer')} · siderarium.com · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    return { text: L.join('\n'), name: n.name || 'chart' };
  }
  function chartReport() {
    const r = chartReportText(); if (!r) return;
    const base = r.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    downloadBlob(new Blob([r.text], { type: 'text/markdown' }), `siderarium-report-${base}.md`);
  }
  /* the same report onto the clipboard, to paste into an interpreter; the old way when the clipboard refuses */
  async function copyReport() {
    const r = chartReportText(); if (!r) return;
    const note = $('import-note'), i = SD.i18n;
    try { await navigator.clipboard.writeText(r.text); note.textContent = i.cap1(i.t('ui.copied')); return; } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea'); ta.value = r.text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove();
    note.textContent = i.cap1(i.t(ok ? 'ui.copied' : 'ui.copyFailed'));
  }
  const stampOf = st => st.date.toISOString().slice(0, 16).replace(/[:T]/g, '');
  function exportPNG(px) {
    const st = viewState(), cv = document.createElement('canvas');
    cv.width = cv.height = px;
    SD.render.render(cv.getContext('2d'), st, px, (performance.now() - t0) / 1000, { mode: S.mode === 'chart' || S.mode === 'natalchart' ? 'chart' : 'clock', fieldRes: px >= 3000 ? 420 : 300, field: S.field, sigil: S.sigil, engrave: S.engrave, luminous: S.luminous, groundEl: S.groundEl });
    download(cv, `siderarium_${st.loc.name}_${stampOf(st)}_${px}.png`);
  }
  /* a wallpaper at this screen's size: the square render set in a portrait field of the same ground */
  function exportWallpaper() {
    const st = viewState(), dpr = window.devicePixelRatio || 1;
    const W = Math.round((screen.width || 1080) * dpr), H = Math.round((screen.height || 2340) * dpr);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    SD.render.renderWallpaper(cv.getContext('2d'), st, W, H, 3, { fieldRes: 300, field: S.field, sigil: S.sigil, engrave: S.engrave, luminous: S.luminous });
    download(cv, `siderarium_wallpaper_${st.loc.name}_${stampOf(st)}.png`);
  }

  const ordinalWord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  /* ---------- readout: every mark traceable ---------- */
  function updateReadout() {
    const st = viewState(), C = SD.corr, i = SD.i18n, R = k => i.t('ui.r.' + k), H = k => i.cap1(i.t('ui.h.' + k));
    const P = k => i.planet(k), A = k => i.aspect(k);
    const rows = C.ORDER.map(k => {
      const b = st.bodies[k];
      const flags = [b.retro ? i.flag('retrograde') : '', b.station ? i.flag('stationary') : '', b.cazimi ? i.flag('cazimi') : b.combust ? i.flag('combust') : b.beams ? i.flag('beams') : '', b.oob ? i.flag('oob') : ''].filter(Boolean).join(', ');
      const dig = C.PLANETS[k].kind === 'optic' ? i.flag('noDignity') : `${b.dignity.score > 0 ? '+' : ''}${b.dignity.score} · ${b.dignity.labels.map(l => i.dignity(l)).join(', ') || '—'}`;
      return `<tr><td>${P(k)}</td><td>${Math.floor(b.deg)}°${String(Math.floor((b.deg % 1) * 60)).padStart(2, '0')}′ ${i.sign(b.sign)}</td><td>${R('house')} ${i.roman(b.house)}</td></tr><tr class="sub"><td></td><td colspan="2">${i.cap1(dig)}${flags ? ' · ' + flags : ''}</td></tr>`;
    }).join('');
    const cf = st.configs;
    const figName = a => a.natal ? `${P(a.a)} ${A(a.aspect)} ${i.t('cap.natal')} ${P(a.b)}` : `${P(a.a)} ${A(a.aspect)} ${P(a.b)}`;
    const evName = e => e.split(' ').map(w => i.event(w)).join(' ');
    const figs = [cf.primary, ...cf.secondary].filter(Boolean).map((a, n) =>
      `<tr><td>${i.cap1(n ? R('ring') : R('figure'))}</td><td colspan="2">${figName(a)} · {${a.n}/${a.k}}</td></tr><tr class="sub"><td></td><td colspan="2">${i.cap1(R('orb'))} ${a.orb.toFixed(2)}° ${a.applying ? R('applying') : R('separating')}${a.dissociate ? ' · ' + i.flag('outOfSign') : ''} · ${a.power.toFixed(2)}${a.event ? ' · ' + evName(a.event) : ''}</td></tr>`).join('');
    const cap = SD.render.captionLines(st);
    const el = st.elements ? `${R('element')} ${i.t('ui.el.' + st.elements.dominant)} ${Math.round(st.elements.shares[st.elements.dominant] * 100)}% · ${i.t('ui.el.' + st.elements.order[1])} ${Math.round(st.elements.shares[st.elements.order[1]] * 100)}%` : '';
    const guardians = `${R('guardians')} ${P(st.hour.dayRuler)}${st.hour.dayRuler === st.hour.hourRuler ? ' ' + R('alone') : ' ' + R('and') + ' ' + P(st.hour.hourRuler)}`;
    const lead = `<p class="verdict state-${st.title.state}">${i.state(st.title.state)} · ${i.house12(st.title.house)} · ${i.cap1(i.window(st.title.mode))} · ${i.t('cap.under')} ${i.name(st.hour.angel)}</p>`;
    const inter = st.interaction;
    const interSentence = f => f.name === 'setOff' ? `${P(f.t)} ${R('setsOff')} ${P(f.a)} ${A(f.natalAspect)} ${P(f.b)}` : `${P(f.t)} ${R('closes')} ${R('fig.' + f.name)} ${R('with')} ${P(f.a)} ${A(f.natalAspect)} ${P(f.b)}`;
    const interRows = inter ? (inter.figures.length ? inter.figures.slice(0, 6).map(f => `<tr><td>${i.cap1(R(f.tone))}</td><td colspan="2">${interSentence(f)}</td></tr><tr class="sub"><td></td><td colspan="2">${P(f.t)} ${A(f.x.aspect)} ${P(f.a)} ${f.x.orb.toFixed(1)}° · ${P(f.t)} ${A(f.y.aspect)} ${P(f.b)} ${f.y.orb.toFixed(1)}° · ${f.power.toFixed(2)}</td></tr>`).join('') : `<tr><td colspan="3">${i.cap1(R('noFigure'))}</td></tr>`) : '';
    const verdict = inter ? `<p class="verdict">${i.cap1(R('harmony'))} ${inter.harmony.toFixed(2)} · ${R('strife')} ${inter.strife.toFixed(2)} · ${R(inter.verdict)}</p>` : '';
    const tz = st.loc.tz || 'UTC';
    const hm = d => new Intl.DateTimeFormat(i.locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz }).format(d);
    const dec = b => `${i.decanOrd(b.decan.decan)} ${i.t('cap.decanOf')} ${i.sign(b.sign)} · ${P(b.decan.ruler)}`;
    const tarot = `<table>
      <tr><td>${i.cap1(R('sun'))}</td><td>${i.cap1(dec(st.bodies.sun))}</td><td>${i.card(st.bodies.sun.decan)} · ${i.title(st.bodies.sun.decan)}</td></tr>
      <tr><td>${i.cap1(R('moon'))}</td><td>${i.cap1(dec(st.bodies.moon))}</td><td>${i.card(st.bodies.moon.decan)} · ${i.title(st.bodies.moon.decan)}</td></tr>
      <tr><td>${i.cap1(R('ascendant'))}</td><td>${i.sign(Math.floor(st.asc / 30))}</td><td>${i.trumpSign(Math.floor(st.asc / 30))}</td></tr>
      <tr><td>${i.cap1(R('dayRuler'))}</td><td>${P(st.hour.dayRuler)}</td><td>${i.trumpPlanet(st.hour.dayRuler)}</td></tr>
      <tr><td>${i.cap1(R('hourRuler'))}</td><td>${P(st.hour.hourRuler)}</td><td>${i.trumpPlanet(st.hour.hourRuler)}</td></tr></table>`;
    const hours = st.hour.table ? st.hour.table.map(h => `<span${h.index === st.hour.index ? ' class="now"' : ''}>${h.index + 1} ${P(h.ruler)} ${hm(h.start)}</span>`).join(' · ') : i.cap1(i.t('ui.polar'));
    const top = st.aspects.slice(0, 12).map(a =>
      `<tr><td>${figName(a)}</td><td class="nw">${a.orb.toFixed(2)}° ${a.applying ? R('applying') : R('separating')}</td><td class="nw">${a.power.toFixed(2)}</td></tr>`).join('');
    const ev = st.events.map(e => i.event(e.type) + (e.planet ? ' ' + P(e.planet) : '') + (e.kind ? ' ' + evName(e.kind) : '') + (e.direction ? ' ' + i.event(e.direction) : '')).join(' · ') || '—';
    $('readout').innerHTML = `
      ${lead}
      <h3>${H('bodies')}</h3><table>${rows}</table>
      <h3>${H('figure')}</h3><table>${figs || `<tr><td>${i.cap1(i.t('ui.quietSky'))}</td></tr>`}</table>
      <h3>${H('sound')}</h3><p>${i.chordLong(st.chord)}${st.chord.interval ? ' · ' + i.interval(st.chord.interval) : ''}${st.chord.notes.length ? ` · ${R('notes')} ` + st.chord.notes.map(n => i.note(n)).join(' ') : ''}${st.chord.planets ? ` · ${R('from')} ` + st.chord.planets.map(P).join(', ') : ''}${st.chord.moonNote ? ` · ${R('moonNote')} ${i.note(st.chord.moonNote)}` : ''}${st.chord.ground && st.chord.ground.length ? ` · ${R('ground')} ` + st.chord.ground.map(v => `${i.note(v.note)} (${P(v.planet)})`).join(' ') : ''}${st.nextChord ? ` · ${R('next')} ${i.chordName(st.nextChord.to)} ${R('at')} ${hm(st.nextChord.at)}` : ''}</p>
      <h3>${H('tarot')}</h3>${tarot}
      ${st.stone ? `<h3>${H('stone')}</h3><p>${i.cap1(i.stone(st.stone.stone))} · ${P(st.stone.planet)} · ${i.t('cap.stoneRule.' + st.stone.rule)}${st.stone.why ? ` · ${P(st.stone.why.a)} ${A(st.stone.why.aspect)} ${i.t('cap.your')} ${C.PLANETS[st.stone.why.b] ? P(st.stone.why.b) : st.stone.why.b === 'ascendant' ? 'ASC' : 'MC'}` : ''} · ${R('alternatives')} ${st.stone.alternatives.map(x => i.stone(x)).join(', ')} · ${R('flavour')} ${i.t('elements.' + st.stone.flavour) === 'elements.' + st.stone.flavour ? st.stone.flavour : i.t('elements.' + st.stone.flavour)}</p>` : ''}
      ${st.transits ? `<h3>${H('transits')}</h3>${verdict}<table>${interRows}</table><table>${st.transits.slice(0, 8).map(a => `<tr><td>${figName(a)}</td><td>${a.orb.toFixed(2)}° ${a.applying ? R('applying') : R('separating')}</td><td>${a.power.toFixed(2)}</td></tr>`).join('') || `<tr><td>${i.cap1(i.t('ui.noContact'))}</td></tr>`}</table>` : ''}
      <h3>${H('moon')}</h3>${st.moon.verdict === 'void' ? `<p class="dim">${i.cap1(R('voidNote'))}</p>` : ''}<p>${i.cap1(i.verdict(st.moon.verdict))} · ${st.moon.next ? `${R('nextMoon')} ${A(st.moon.next.aspect)} ${P(st.moon.next.planet)} ${R('in')} ${(st.moon.next.days * 24).toFixed(1)}h` : i.flag('void of course')}${st.moon.flags.filter(f => f !== 'void of course').map(f => ' · ' + i.flag(f === 'under the beams' ? 'beams' : f)).join('')}</p>
      <p>${i.cap1(guardians)}</p>
      <p>${i.cap1(i.t('ui.veil'))} ${st.veil.v.toFixed(2)}${st.veil.factors.length ? ' · ' + st.veil.factors.map(x => i.t('ui.veilOf.' + x.key)).join(', ') : ''}</p>
      <p>${i.ordinal(st.bodies.moon.mansion.index)} ${R('mansion')} · ${i.name(st.bodies.moon.mansion.name)} (Agrippa II.33)</p>
      <h3>${H('hours')}</h3><p class="hours">${hours}</p>
      <h3>${H('events')}</h3><p>${i.cap1(ev)}</p>
      ${st.wheel ? `<p>${i.cap1(R('wheel'))}: ${st.wheel.today ? `${i.t('ui.wheel.' + st.wheel.today)} ${R('today')} · ` : ''}${R('wheelNext')} ${i.t('ui.wheel.' + st.wheel.next)} · ${new Intl.DateTimeFormat(i.locale(), { day: 'numeric', month: 'short', timeZone: 'UTC' }).format(st.wheel.nextDate)} · ${R('inDays')(st.wheel.days)}</p>` : ''}
      <h3>${H('hierarchy')}</h3><table>${top}</table>
      <p>${i.cap1(R('onAngles'))}: ${st.onAngles && st.onAngles.length ? st.onAngles.map(x => `${P(x.planet)} ${A('conjunction')} ${R('angle.' + x.angle)} ${x.orb.toFixed(1)}°`).join(' · ') : R('noneOnAngles')}</p>
      <p class="dim">${i.cap1(R('sect'))} ${st.sect === 'day' ? R('day') : R('night')} · ASC ${Math.floor(st.asc % 30)}° ${i.sign(Math.floor(st.asc / 30))} · MC ${Math.floor(st.mc % 30)}° ${i.sign(Math.floor(st.mc / 30))} · ${R('dayRuler')} ${P(st.hour.dayRuler)} / ${i.name(st.hour.dayAngel)} · ${R('hour')} ${st.hour.index + 1} ${P(st.hour.hourRuler)} / ${i.name(st.hour.angel)}</p>`;
    linkTerms($('readout'));
  }

  function updateControls() {
    if (document.activeElement !== $('when')) $('when').value = placeStamp(S.state.date);
    $('zone').textContent = offsetOf(S.place.tz || 'UTC', S.state.date);
    const live = S.offsetMs === 0 && !S.fixed && !S.playing;
    $('live').classList.toggle('on', live);
    $('now-float').hidden = live;                           // the way back, in sight whenever the clock has been moved
    if (document.activeElement !== $('preview')) $('preview').value = Math.max(0, Math.min(STRIP_H * 60, Math.round(S.offsetMs / 60000)));
    $('play').classList.toggle('on', S.playing);
    $('play').textContent = SD.i18n.cap1(SD.i18n.t(S.playing ? 'ui.pause' : 'ui.run'));
    $('speed').textContent = S.speed < 1 ? `${S.speed * 60}m/s` : `${S.speed}h/s`;
    $('here').classList.toggle('on', S.place.name === 'here');
    if (PLACES[S.place.name] && $('city').value !== S.place.name) $('city').value = S.place.name;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode || (S.mode === 'natalchart' && (b.dataset.mode === 'chart' || b.dataset.mode === 'natal'))));
    document.body.classList.toggle('natal', S.mode === 'natal' || S.mode === 'natalchart');
    $('sigil').classList.toggle('on', S.sigil);
    slideSeg();
  }
  /* the segmented control: an indicator slides under the lit view (two of them in natal chart) */
  function slideSeg() {
    const seg = document.querySelector('.seg'), ind = seg && seg.querySelector('.seg-ind'); if (!ind) return;
    const on = [...seg.querySelectorAll('button[data-mode].on')];
    if (!on.length) { ind.style.width = '0px'; return; }
    const l = Math.min(...on.map(b => b.offsetLeft)), r = Math.max(...on.map(b => b.offsetLeft + b.offsetWidth));
    ind.style.left = l + 'px'; ind.style.width = (r - l) + 'px';
  }

  /* ---------- the menu: view, settings, nativity and saved charts ---------- */
  const uid = () => Math.random().toString(36).slice(2, 10);
  /* ---------- the glossary panel: built once per language, opened at a term ---------- */
  let glossaryLang = null;
  function buildGlossary() {
    const i = SD.i18n, lang = i.locale().startsWith('es') ? 'es' : 'en', GL = SD.glossary;
    if (glossaryLang === lang) return; glossaryLang = lang;
    const groups = { ...GL.groups[lang], tarot: i.t('ui.tarot.group') };
    glossaryTerms(); const tarot = GL.dynamic(lang);
    const order = [...GL.order.slice(0, GL.order.indexOf('time') + 1), 'tarot', ...GL.order.slice(GL.order.indexOf('time') + 1)];
    $('glossary-index').innerHTML = order.map(g => `<a href="#gg-${g}">${groups[g]}</a>`).join('');
    $('glossary-body').innerHTML = order.map(g => {
      const items = (g === 'tarot' ? tarot : GL.entries.filter(x => x.group === g));
      const plate = x => x.img ? `<dd class="plate"><img loading="lazy" src="${x.img}" alt="${esc(x[lang][0])}" width="110"><p>${esc(x[lang][1])}</p></dd>` : `<dd>${esc(x[lang][1])}</dd>`;
      return `<h2 id="gg-${g}">${groups[g]}</h2>${g === 'tarot' ? `<p class="meta nolink">${esc(i.t('ui.tarot.note'))}</p>` : ''}<dl>${items.map(x => `<dt id="g-${x.key}">${esc(x[lang][0])}</dt>${plate(x)}`).join('')}</dl>`;
    }).join('');
    SD.glossary.link($('glossary-body'), lang);                 // the entries link to one another
  }
  /* the tarot plates: one entry per decan card (36) and per trump (22), named in the reader's language, each with its
     Rider plate. built per language from the correspondences and the strings; the files are the Commons scans. */
  function tarotEntries(lang) {
    const i = SD.i18n, C = SD.corr, T = k => i.t('ui.tarot.' + k), out = [];
    const FILE = { wands: 'Wands', cups: 'Cups', swords: 'Swords', pentacles: 'Pents' };
    for (const d of C.DECANS) {
      const name = i.card(d), title = i.title(d);
      out.push({ key: `card_${d.suit}${d.num}`, group: 'tarot', img: `img/tarot/${FILE[d.suit]}${String(d.num).padStart(2, '0')}.jpg`, [lang]: [name, T('minor')(title, i.cap1(i.decanOrd(d.decan)), i.sign(d.sign), i.cap1(i.planet(d.ruler)))], aliases: {} });
    }
    const trumpFile = ['00_Fool', '01_Magician', '02_High_Priestess', '03_Empress', '04_Emperor', '05_Hierophant', '06_Lovers', '07_Chariot', '08_Strength', '09_Hermit', '10_Wheel_of_Fortune', '11_Justice', '12_Hanged_Man', '13_Death', '14_Temperance', '15_Devil', '16_Tower', '17_Star', '18_Moon', '19_Sun', '20_Judgement', '21_World'];
    const signTrump = [4, 5, 6, 7, 8, 9, 11, 13, 14, 15, 17, 18];       // Aries the Emperor … Pisces the Moon
    const planetTrump = { saturn: 21, jupiter: 10, mars: 16, sun: 19, venus: 3, mercury: 1, moon: 2 };
    const elemTrump = { air: [0, 'fool'], water: [12, 'hanged'], fire: [20, 'judgement'] };
    const push = (n, name, of) => out.push({ key: `trump_${n}`, group: 'tarot', img: `img/tarot/RWS_Tarot_${trumpFile[n]}.jpg`, [lang]: [name, `${T('trumpOf')} ${of}, ${T('inGD')}.`], aliases: {} });
    for (let s = 0; s < 12; s++) push(signTrump[s], i.trumpSign(s), i.sign(s));
    for (const [p, n] of Object.entries(planetTrump)) push(n, p === 'saturn' ? T('universe') : i.trumpPlanet(p), i.cap1(i.planet(p)));
    for (const [el, [n, k]] of Object.entries(elemTrump)) push(n, T(k), T('elem.' + el));
    return out.sort((a, b) => (a.key < b.key ? -1 : 1));
  }
  /* the card entries must exist before the first readout is linked, and again when the language changes */
  function glossaryTerms() { try { const lang = SD.i18n.locale().startsWith('es') ? 'es' : 'en'; if (!SD.glossary.dynamic(lang).length) SD.glossary.setDynamic(lang, tarotEntries(lang)); } catch (e) { /* the glossary is a nicety */ } }
  /* hold the Natal tab (or right-click it): a menu of the saved charts; choosing one loads it on the clock */
  let pickHeld = false;
  function bindChartPick() {
    const btn = document.querySelector('[data-mode="natal"]'), menu = $('chart-pick'); if (!btn || !menu) return;
    let timer = null;
    const show = () => {
      pickHeld = true;
      const i = SD.i18n;
      menu.innerHTML = S.charts.length ? S.charts.map(c => `<button type="button" data-id="${c.id}"${S.natal && S.natal.id === c.id ? ' class="on"' : ''}>${esc(c.name || '—')}</button>`).join('') : `<div class="empty">${i.cap1(i.t('ui.noCharts'))}</div>`;
      const r = btn.getBoundingClientRect();
      menu.hidden = false;
      const w = menu.offsetWidth, left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
      menu.style.left = `${left}px`; menu.style.top = `${r.bottom + 6}px`;
      try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* no haptics */ }
    };
    const arm = e => { if (e.button && e.button !== 0) return; clearTimeout(timer); timer = setTimeout(show, 480); };
    const disarm = () => { clearTimeout(timer); timer = null; };
    btn.addEventListener('pointerdown', arm); btn.addEventListener('pointerup', disarm); btn.addEventListener('pointerleave', disarm); btn.addEventListener('pointercancel', disarm);
    btn.addEventListener('contextmenu', e => { e.preventDefault(); disarm(); show(); });
    menu.addEventListener('click', e => {
      const b = e.target.closest('button[data-id]'); if (!b) return;
      const chart = S.charts.find(c => c.id === b.dataset.id); menu.hidden = true; if (!chart) return;
      S.natal = { ...chart }; store.set('natal', S.natal); natalCache.key = null;
      if (!natalModes.includes(S.mode)) S.mode = 'natal'; store.set('mode', S.mode); recompute(); updateControls(); requestAnimationFrame(slideSeg);
    });
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('#chart-pick, [data-mode="natal"]')) menu.hidden = true; });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
  }
  function openGlossary(key) {
    buildGlossary();
    $('glossary').hidden = false; $('about').hidden = true;
    const t = key && document.getElementById('g-' + key);
    document.querySelectorAll('#glossary-body .lit').forEach(x => x.classList.remove('lit'));
    if (t) { t.scrollIntoView({ block: 'start' }); t.classList.add('lit'); }   // the entry stays lit until the next word is followed
    else $('glossary').scrollTop = 0;
  }
  const linkTerms = root => { try { SD.glossary.link(root, SD.i18n.locale().startsWith('es') ? 'es' : 'en'); } catch (e) { /* the glossary is a nicety */ } };
  function natalSummary() {
    const i = SD.i18n;
    if (!S.natal) return i.cap1(i.t('ui.noneSet'));
    const p = placeParts(new Date(S.natal.date), S.natal.place.tz);
    return `${S.natal.name ? S.natal.name + ' · ' : ''}${p.year}-${p.month}-${p.day} ${S.natal.unknownTime ? '' : p.hour + ':' + p.minute + ' '}· ${i.placeName(S.natal.place.name)}`;
  }
  function refreshMenu() {
    const i = SD.i18n;
    $('set-lang').value = S.lang; $('set-houses').value = S.houses; $('set-field').value = !S.engrave ? 'glow' : S.field === 'guilloche' ? 'guilloche' : 'engraved'; $('set-bodies').value = S.luminous ? 'lights' : 'metal';
    $('set-relocate').value = S.relocate ? '1' : '0';
    $('natal-summary').textContent = natalSummary();
    $('natal-saveas').disabled = !S.natal; $('natal-report').disabled = !S.natal; $('natal-copy').disabled = !S.natal;
    const ul = $('charts');
    ul.innerHTML = S.charts.length ? S.charts.map(c => `<li data-id="${c.id}"${S.natal && S.natal.id === c.id ? ' class="on"' : ''}><input type="radio" name="chart-use" class="use" data-act="load" aria-label="${i.t('ui.useChart')}" title="${i.t('ui.useChart')}"${S.natal && S.natal.id === c.id ? ' checked' : ''}><span class="name" data-act="load" role="button" tabindex="0" title="${i.t('ui.useChart')}">${esc(c.name)}</span><span class="ops"><button data-act="rename">${i.cap1(i.t('ui.rename'))}</button><button data-act="delete">${i.cap1(i.t('ui.del'))}</button></span></li>`).join('')
      : `<li class="empty">${i.cap1(i.t('ui.noCharts'))}</li>`;
  }
  const esc = t => String(t).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
  function openMenu(open) { $('menu').hidden = !open; $('menu-open').classList.toggle('on', open); if (open) refreshMenu(); }
  function upsertChart(chart) {
    const k = S.charts.findIndex(c => c.id === chart.id);
    if (k >= 0) S.charts[k] = chart; else S.charts.push(chart);
    store.set('charts', S.charts);
  }
  function saveChartAs(name) {
    if (!S.natal || !name) return;
    const chart = { ...S.natal, id: uid(), name };
    upsertChart(chart); S.natal = chart; store.set('natal', S.natal); refreshMenu();
  }
  function bindMenu() {
    $('menu-open').addEventListener('click', () => openMenu($('menu').hidden));
    $('menu-close').addEventListener('click', () => openMenu(false));
    document.addEventListener('pointerdown', e => { if (!$('menu').hidden && !e.target.closest('#menu, #menu-open')) openMenu(false); });
    $('set-lang').addEventListener('change', e => setLang(e.target.value));
    $('set-houses').addEventListener('change', e => { S.houses = e.target.value; store.set('houses', S.houses); natalCache.key = null; scan.key = null; recompute(); });
    $('set-field').addEventListener('change', e => { S.engrave = e.target.value !== 'glow'; S.field = e.target.value === 'guilloche' ? 'guilloche' : 'waves'; store.set('field', e.target.value); S.dirty = true; });
    $('set-bodies').addEventListener('change', e => { S.luminous = e.target.value === 'lights'; store.set('bodies', e.target.value); S.dirty = true; });
    $('set-relocate').addEventListener('change', e => { S.relocate = e.target.value === '1'; store.set('relocate', S.relocate); natalCache.key = null; recompute(); });
    $('natal-edit').addEventListener('click', () => { openMenu(false); openBirth(); });
    $('natal-new').addEventListener('click', () => { openMenu(false); openBirth(true); });   // a blank form; the loaded chart stays until the new one is saved
    $('natal-report').addEventListener('click', chartReport);
    $('natal-copy').addEventListener('click', copyReport);
    const showKey = e => { e.preventDefault(); openMenu(true); const sec = $('read-title'); if (sec) sec.scrollIntoView({ block: 'start' }); };
    $('what-link').addEventListener('click', showKey);
    $('caption').addEventListener('click', e => { if (e.target.closest('a.what')) showKey(e); });
    $('charts-export').addEventListener('click', exportCharts);
    $('charts-import').addEventListener('click', () => $('charts-file').click());
    $('charts-file').addEventListener('change', e => { const f = e.target.files && e.target.files[0]; if (f) importCharts(f); e.target.value = ''; });
    $('natal-saveas').addEventListener('click', () => { const row = $('chart-new'); row.hidden = !row.hidden; if (!row.hidden) { $('chart-name').value = S.natal && S.natal.name || ''; $('chart-name').focus(); } });
    const commitNew = () => { const name = $('chart-name').value.trim(); if (!name) return; saveChartAs(name); $('chart-new').hidden = true; };
    $('chart-ok').addEventListener('click', commitNew);
    $('chart-name').addEventListener('keydown', e => { if (e.key === 'Enter') commitNew(); if (e.key === 'Escape') $('chart-new').hidden = true; });
    $('charts').addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('span[data-act]')) { e.preventDefault(); e.target.click(); } });
    $('charts').addEventListener('click', e => {
      const b = e.target.closest('[data-act]'); if (!b || (e.target.tagName === 'INPUT' && !e.target.classList.contains('use'))) return;
      const li = b.closest('li'), id = li.dataset.id, chart = S.charts.find(c => c.id === id); if (!chart) return;
      if (b.dataset.act === 'load') { S.natal = { ...chart }; store.set('natal', S.natal); natalCache.key = null; if (!natalModes.includes(S.mode)) S.mode = 'natal'; store.set('mode', S.mode); recompute(); refreshMenu(); openMenu(false); }
      else if (b.dataset.act === 'rename') {
        const nameBtn = li.querySelector('.name'); const input = document.createElement('input'); input.type = 'text'; input.value = chart.name;
        nameBtn.replaceChildren(input); input.focus(); input.select();
        let finished = false;
        const done = () => { if (finished) return; finished = true; const v = input.value.trim(); if (v) { chart.name = v; if (S.natal && S.natal.id === id) { S.natal.name = v; store.set('natal', S.natal); } store.set('charts', S.charts); } refreshMenu(); };
        input.addEventListener('keydown', ev => { if (ev.key === 'Enter') done(); if (ev.key === 'Escape') { finished = true; refreshMenu(); } ev.stopPropagation(); });
        input.addEventListener('blur', done);
      } else if (b.dataset.act === 'delete') {
        if (b.dataset.armed) { S.charts = S.charts.filter(c => c.id !== id); store.set('charts', S.charts); refreshMenu(); }
        else { b.dataset.armed = '1'; b.textContent = SD.i18n.cap1(SD.i18n.t('ui.confirm')); setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = SD.i18n.cap1(SD.i18n.t('ui.del')); } }, 3000); }
      }
    });
  }

  function bind() {
    document.querySelectorAll('[data-step]').forEach(b => b.addEventListener('click', () => { S.offsetMs += Number(b.dataset.step) * 3600e3; recompute(); }));
    $('live').addEventListener('click', () => { S.offsetMs = 0; S.fixed = null; S.playing = false; recompute(); });
    $('now-float').addEventListener('click', () => $('live').click());
    $('play').addEventListener('click', () => {
      S.playing = !S.playing;
      if (!S.playing) recompute(); else updateControls();  // on pause, the full reading of the moment where it stopped
    });
    const SPEEDS = [0.25, 1, 4, 24];
    $('speed').addEventListener('click', () => { S.speed = SPEEDS[(SPEEDS.indexOf(S.speed) + 1) % SPEEDS.length]; updateControls(); });
    const fill = () => { const pn = SD.i18n.placeName; $('city').innerHTML = ZONES.map(z => `<option value="${z.name}">${offsetOf(z.tz)} · ${pn(z.name)}</option>`).join('') + (PLACES[S.place.name] ? '' : `<option value="" selected>${esc(pn(S.place.name))}</option>`); };
    fill();
    $('city').addEventListener('change', e => { if (!PLACES[e.target.value]) return; S.place = PLACES[e.target.value]; store.set('place', S.place); recompute(); });
    const commit = e => {
      const txt = normStamp(e.target.value), v = fromPlaceStamp(txt);
      if (v) { e.target.value = placeStamp(v); S.playing = false; S.fixed = v; S.offsetMs = 0; recompute(); e.target.classList.remove('bad'); }   // the stamp as the place reads it: a skipped spring time shows an hour later
      else e.target.classList.add('bad');
    };
    liveFormat($('when'), 'stamp'); liveFormat($('birth-date'), 'date'); liveFormat($('birth-time'), 'time');
    $('when').addEventListener('change', commit);
    $('when').addEventListener('keydown', e => { if (e.key === 'Enter') { commit(e); e.target.blur(); } });
    $('here').addEventListener('click', () => locate(true));
    bindChartPick();
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      if (pickHeld) { pickHeld = false; return; }                     // the click that follows a hold is not a tab change
      let m = b.dataset.mode;
      if ((m === 'natal' || m === 'synastry') && !S.natal) { openBirth(); return; }
      if (m === 'chart' && S.mode === 'natal') m = 'natalchart';          // the nativity as a chart: chart + natal lit together
      else if (m === 'natal' && S.mode === 'chart') m = 'natalchart';
      S.mode = m; store.set('mode', S.mode); recompute();
    }));
    $('birth-open').addEventListener('click', openBirth);
    $('birth-close').addEventListener('click', () => { $('birth').hidden = true; });
    $('birth-save').addEventListener('click', saveBirth);
    bindPlaceSearch();
    $('birth-clear').addEventListener('click', () => { S.natal = null; store.set('natal', null); if (natalModes.includes(S.mode)) S.mode = 'clock'; $('birth').hidden = true; recompute(); });
    $('wallpaper').addEventListener('click', exportWallpaper);
    $('save').addEventListener('click', () => exportPNG(2048));
    $('sigil').addEventListener('click', () => { S.sigil = !S.sigil; S.dirty = true; updateControls(); });
    $('preview').addEventListener('input', e => { S.playing = false; S.offsetMs = Number(e.target.value) * 60000; recompute(); });
    $('save-hd').addEventListener('click', () => exportPNG(4096));
    $('listen-corner').addEventListener('click', () => listen(!audio.on));
    $('about-open').addEventListener('click', () => { $('about').hidden = !$('about').hidden; $('about-open').classList.toggle('on', !$('about').hidden); if (!$('about').hidden) openMenu(false); });
    $('about-close').addEventListener('click', () => { $('about').hidden = true; $('about-open').classList.remove('on'); });
    $('glossary-open').addEventListener('click', () => { openGlossary(); openMenu(false); });
    $('glossary-close').addEventListener('click', () => { $('glossary').hidden = true; });
    document.addEventListener('click', e => { const a = e.target.closest('a.g, [data-g]'); if (!a) return; e.preventDefault(); openGlossary(a.dataset.g); });
    const fullScreen = () => {                              // the f key: the bare dial, full screen where the browser allows it
      document.body.classList.toggle('bare');
      if (document.body.classList.contains('bare') && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      if (e.key === 'f') fullScreen();
      if (e.key === 's') $('sigil').click();
      if (e.key === 'l') $('listen-corner').click();
      if (e.key === ' ') { e.preventDefault(); $('play').click(); }
      if (e.key === 'ArrowRight') { S.offsetMs += (e.shiftKey ? 24 : 1) * 3600e3; recompute(); }
      if (e.key === 'ArrowLeft') { S.offsetMs -= (e.shiftKey ? 24 : 1) * 3600e3; recompute(); }
      if (e.key === 'Escape') { document.body.classList.remove('bare'); $('about').hidden = true; $('about-open').classList.remove('on'); $('birth').hidden = true; openMenu(false); }
    });
    window.addEventListener('resize', () => { size(); slideSeg(); });
    $('readout').addEventListener('transitionend', e => { if (e.propertyName === 'width') size(); });   // the stage is only final once the panel has opened
    if (params.get('hd') !== '1') $('save-hd').hidden = true;
  }

  /* ---------- the nativity: birth data, kept on this device only ---------- */
  function openBirth(blank) {
    const n = blank ? null : S.natal;
    S.birthNew = !!blank;
    if (n) {
      const p = placeParts(new Date(n.date), n.place.tz);
      $('birth-name').value = n.name || '';
      $('birth-date').value = `${p.year}-${p.month}-${p.day}`; $('birth-time').value = n.unknownTime ? '' : `${p.hour}:${p.minute}`;
      $('birth-unknown').checked = !!n.unknownTime;
      choosePlace(n.place);
    } else { $('birth-name').value = ''; $('birth-date').value = ''; $('birth-time').value = ''; $('birth-unknown').checked = false; choosePlace(null); }
    $('birth-note').textContent = '';
    $('birth').hidden = false;
    loadPlaces().catch(() => {});                           // the list, fetched once, cached with the app
  }
  /* ---------- the birthplace: a gazetteer of every town of a thousand people (GeoNames, CC BY 4.0), searched as you type ----------
     each entry carries its time zone, so the birth is read in the zone of its own place with the rules of its year. */
  const gaz = { rows: null, loading: null };
  const fold = t => String(t).toLowerCase().normalize('NFD').replace(/\p{M}/gu, '');
  function loadPlaces() {
    if (gaz.rows) return Promise.resolve(gaz.rows);
    if (gaz.loading) return gaz.loading;
    gaz.loading = fetch('data/places.txt').then(r => { if (!r.ok) throw new Error(r.status); return r.text(); }).then(txt => {
      const L = txt.split('\n'), tz = L[1].split('\t'), cc = {}, a1 = {};
      const cf = L[2].split('\t'); for (let i = 0; i + 1 < cf.length; i += 2) cc[cf[i]] = cf[i + 1];
      const af = L[3].split('\t'); for (let i = 0; i + 1 < af.length; i += 2) a1[af[i]] = af[i + 1];
      const rows = [];
      for (let i = 4; i < L.length; i++) {
        const f = L[i].split('\t'); if (f.length < 8) continue;
        rows.push({ name: f[0], key: fold(f[0]) + (f[1] ? ' ' + fold(f[1]) : ''), cc: f[2], region: a1[f[2] + '.' + f[3]] || '', country: cc[f[2]] || f[2], lat: +f[4], lon: +f[5], tz: tz[+f[6]], pop: +f[7] });
      }
      gaz.rows = rows; gaz.loading = null; return rows;
    }).catch(e => { gaz.loading = null; throw e; });
    return gaz.loading;
  }
  function searchPlaces(q) {
    q = fold(q.trim()); if (!q || !gaz.rows) return [];
    const out = [];
    for (const r of gaz.rows) {
      const k = r.key; let sc = 0;
      if (k === q || k.startsWith(q + ' ')) sc = 3; else if (k.startsWith(q)) sc = 2; else if (k.includes(' ' + q) || k.includes('-' + q)) sc = 1;
      if (sc) out.push({ r, sc });
    }
    return out.sort((a, b) => b.sc - a.sc || b.r.pop - a.r.pop).slice(0, 8).map(x => x.r);
  }
  const placeLabel = r => `${r.name}${r.region ? ', ' + r.region : ''}${r.country ? ', ' + r.country : ''}`;
  function nearestZone(lat, lon) {                        // for coordinates typed by hand: the zone of the nearest listed town
    if (!gaz.rows) return S.place.tz;
    let best = null, bd = 1e9;
    for (const r of gaz.rows) { const dx = (r.lon - lon) * Math.cos(lat * Math.PI / 180), dy = r.lat - lat, d = dx * dx + dy * dy; if (d < bd) { bd = d; best = r; } }
    return best ? best.tz : S.place.tz;
  }
  function choosePlace(pl) {                              // pl: a saved place {name, label?, lat, lon, tz} or a gazetteer row, or null
    S.birthPlace = pl ? { name: pl.name, label: pl.label || (pl.country ? placeLabel(pl) : undefined), lat: pl.lat, lon: pl.lon, tz: pl.tz } : null;
    $('birth-place').value = pl ? (S.birthPlace.label || SD.i18n.placeName(pl.name)) : '';
    $('birth-lat').value = pl ? pl.lat : ''; $('birth-lon').value = pl ? pl.lon : '';
    $('birth-chosen').textContent = pl ? `${pl.tz} · ${(+pl.lat).toFixed(3)}, ${(+pl.lon).toFixed(3)}` : '';
    $('birth-results').hidden = true;
  }
  function bindPlaceSearch() {
    const box = $('birth-place'), list = $('birth-results'); let timer = null;
    const show = () => {
      const q = box.value; if (!q.trim()) { list.hidden = true; return; }
      if (!gaz.rows) { list.innerHTML = `<li><button type="button" disabled>${SD.i18n.cap1(SD.i18n.t(gaz.loading ? 'ui.placesLoading' : 'ui.noPlace'))}</button></li>`; list.hidden = false; return; }
      const rows = searchPlaces(q);
      list.innerHTML = rows.length ? rows.map((r, i) => `<li><button type="button" data-i="${i}">${esc(r.name)}<span class="where">${esc((r.region ? ', ' + r.region : '') + ', ' + r.country)}</span></button></li>`).join('')
        : `<li><button type="button" disabled>${SD.i18n.cap1(SD.i18n.t('ui.noPlace'))}</button></li>`;
      list.hidden = false; list.rows = rows;
    };
    box.addEventListener('input', () => { S.birthPlace = null; $('birth-chosen').textContent = ''; clearTimeout(timer); timer = setTimeout(() => { if (!gaz.rows && !gaz.loading) loadPlaces().then(show).catch(show); else if (gaz.loading) gaz.loading.then(show).catch(show); show(); }, 90); });
    box.addEventListener('keydown', e => { if (e.key === 'Enter') { const b = list.querySelector('button[data-i]'); if (b) b.click(); e.preventDefault(); } if (e.key === 'Escape') list.hidden = true; });
    list.addEventListener('click', e => { const b = e.target.closest('button[data-i]'); if (!b) return; choosePlace(list.rows[+b.dataset.i]); });
    box.addEventListener('blur', () => setTimeout(() => { list.hidden = true; }, 150));
  }
  function saveBirth() {
    const dateTxt = normDate($('birth-date').value), unknown = $('birth-unknown').checked, timeTxt = unknown ? '12:00' : normTime($('birth-time').value);
    $('birth-date').value = dateTxt; if (!unknown) $('birth-time').value = timeTxt;
    const lat = parseFloat($('birth-lat').value), lon = parseFloat($('birth-lon').value), hand = Number.isFinite(lat) && Number.isFinite(lon);
    let place = null;
    if (S.birthPlace) place = { ...S.birthPlace, lat: hand ? lat : S.birthPlace.lat, lon: hand ? lon : S.birthPlace.lon };   // the coordinates may be corrected by hand
    else if (hand) place = { name: $('birth-place').value.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon, tz: nearestZone(lat, lon) };
    if (!place) { $('birth-note').textContent = SD.i18n.cap1(SD.i18n.t('ui.needPlace')); return; }
    const d = fromStamp(`${dateTxt} ${timeTxt}`, place.tz);
    if (!d) { $('birth-note').textContent = SD.i18n.cap1(SD.i18n.t('ui.badDate')); return; }
    const name = $('birth-name').value.trim();
    S.natal = { date: d.toISOString(), place, unknownTime: unknown, name: name || undefined, id: name ? (!S.birthNew && S.natal && S.natal.id) || uid() : undefined };
    S.birthNew = false;
    if (name) upsertChart(S.natal);                         // a named nativity is kept in the saved charts
    const kept = store.set('natal', S.natal); natalCache.key = null;
    if (!kept) { $('birth-note').textContent = SD.i18n.cap1(SD.i18n.t('ui.noStorage')); return; }   // the browser refuses to keep data: say so, keep the form open, the chart lives for this visit only
    $('birth').hidden = true;
    if (S.mode !== 'natal' && S.mode !== 'synastry') S.mode = 'synastry';
    store.set('mode', S.mode); recompute();
  }

  /* the moment as the place reads it: yyyy-mm-dd hh:mm in the place's time zone */
  function placeParts(d, tz) {
    const f = new Intl.DateTimeFormat('en-GB', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz || 'UTC' });
    return Object.fromEntries(f.formatToParts(d).map(p => [p.type, p.value]));
  }
  function placeStamp(d) { const p = placeParts(d, S.place.tz); return `${p.year}-${p.month}-${p.day} ${p.hour}:${p.minute}`; }
  /* typed dates and times: digits alone are enough, the app sets the separators. a date of eight digits is read as
     yyyymmdd, or as ddmmyyyy when the first four cannot be a year; a time of three or four digits as h:mm or hh:mm. */
  const digitsOf = t => String(t).replace(/\D/g, '');
  function normDate(txt) {
    const d = digitsOf(txt);
    if (d.length !== 8) return txt.trim();
    let y = d.slice(0, 4), m = d.slice(4, 6), dd = d.slice(6, 8);
    if (+y < 1800 || +m > 12) { y = d.slice(4, 8); dd = d.slice(0, 2); m = d.slice(2, 4); }   // ddmmyyyy, as Europe writes it
    return `${y}-${m}-${dd}`;
  }
  function normTime(txt) {
    const d = digitsOf(txt);
    if (!d.length) return txt.trim();
    if (d.length <= 2) return `${d.padStart(2, '0')}:00`;
    const hh = d.slice(0, d.length - 2), mm = d.slice(-2);
    return `${hh.padStart(2, '0')}:${mm}`;
  }
  const normStamp = txt => { const d = digitsOf(txt); return d.length >= 9 ? `${normDate(d.slice(0, 8))} ${normTime(d.slice(8, 12))}` : txt.trim(); };
  /* while typing, the separators appear on their own: 1990-11-27, 27-11-1990, 11:05, 9:05. the date is read as
     yyyy… when it opens with 19 or 20, as dd-mm-yyyy otherwise; the time as h:mm when its first two digits exceed 23.
     the saved value is always yyyy-mm-dd and hh:mm (normDate, normTime). */
  const datePat = d => {
    if (d.length >= 6) return (+d.slice(0, 4) < 1800 || +d.slice(4, 6) > 12) ? 'dd-dd-dddd' : 'dddd-dd-dd';   // the same test as normDate
    return (/^(19|20)/.test(d) || d.length < 2) ? 'dddd-dd-dd' : 'dd-dd-dddd';
  };
  const timePat = d => (d.length >= 2 && +d.slice(0, 2) > 23) ? 'd:dd' : 'dd:dd';
  const PATTERNS = { date: datePat, time: timePat, stamp: d => datePat(d.slice(0, 8)) + ' ' + timePat(d.slice(8)) };
  function liveFormat(el, kind) {
    el.addEventListener('input', () => {
      const digits = digitsOf(el.value), pattern = PATTERNS[kind](digits); let out = '', k = 0;
      for (const ch of pattern) { if (k >= digits.length) break; if (ch === 'd') out += digits[k++]; else out += ch; }
      if (out !== el.value) { el.value = out; try { el.setSelectionRange(out.length, out.length); } catch (e) { /* number keyboards */ } }
    });
  }
  function fromStamp(txt, tz) {
    const m = txt.match(/^(\d{4})-(\d{1,2})-(\d{1,2})[ t](\d{1,2}):(\d{2})$/i);
    if (!m) return null;
    const want = Date.UTC(+m[1], m[2] - 1, +m[3], +m[4], +m[5]);
    const wall = x => { const p = placeParts(new Date(x), tz); return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute); };
    let t = want;                                           // the zone's offset at that moment, found by two corrections
    for (let i = 0; i < 2; i++) t += want - wall(t);
    if (wall(t) !== want) t = want - (wall(t - 864e5) - (t - 864e5));   // a time the clocks skipped (spring): read it with the offset in force before the change, so 02:30 becomes 03:30
    return new Date(t);
  }
  const fromPlaceStamp = txt => fromStamp(txt, S.place.tz);

  /* ---------- the gesture: turn the dial to travel in time ----------
     clockwise = forward. one full turn = one day. the wheel moves ten minutes a notch. */
  function bindGesture() {
    /* one finger or the mouse turns the dial (time). two fingers pinch to zoom and pan.
       ctrl/⌘ + wheel, or a trackpad pinch, zooms at the pointer. the plain wheel moves time.
       double click or double tap returns to the whole dial. */
    const pts = new Map();
    let drag = null, pinch = null, lastTap = 0;
    const local = e => { const r = canvas.getBoundingClientRect(); return { x: e.clientX - r.left - (S.ox || 0), y: e.clientY - r.top }; };
    const toDial = p => ({ x: (p.x - view.x) / view.z, y: (p.y - view.y) / view.z });
    const clampView = () => {
      view.z = Math.max(1, Math.min(8, view.z));
      if (view.z === 1) { view.x = 0; view.y = 0; }
      view.x = Math.min(0, Math.max(S.side * (1 - view.z), view.x));
      view.y = Math.min(0, Math.max(S.side * (1 - view.z), view.y));
      S.dirty = true;
    };
    const zoomAt = (p, z) => { const w = toDial(p); view.z = z; view.x = p.x - w.x * view.z; view.y = p.y - w.y * view.z; clampView(); };
    const angleAt = p => { const Lt = SD.render.layout(S.side, S.side < 560), q = toDial(p); return { a: Math.atan2(q.y - Lt.cy, q.x - Lt.cx), d: Math.hypot(q.y - Lt.cy, q.x - Lt.cx), R: Lt.Rb }; };
    const endTurn = () => { if (!drag) return; drag = null; S.dragging = false; canvas.classList.remove('turning'); recompute(); };
    canvas.addEventListener('pointerdown', e => {
      canvas.setPointerCapture(e.pointerId);
      pts.set(e.pointerId, local(e));
      if (pts.size === 2) {                                  // second finger: leave time alone, start the pinch
        endTurn();
        const [a, b] = [...pts.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), z: view.z, w: toDial({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }) };
        view.pinching = true; return;
      }
      const now = performance.now();
      if (now - lastTap < 300) { view.z = 1; clampView(); lastTap = 0; return; }   // double tap: the whole dial
      lastTap = now;
      const p = angleAt(local(e)); if (p.d > p.R) return;
      drag = { last: p.a, base: S.offsetMs, turned: 0 };
      S.playing = false; S.dragging = true; canvas.classList.add('turning');
    });
    canvas.addEventListener('pointermove', e => {
      if (!pts.has(e.pointerId)) return;
      pts.set(e.pointerId, local(e));
      if (pinch && pts.size >= 2) {
        const [a, b] = [...pts.values()], mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
        view.z = pinch.z * Math.hypot(a.x - b.x, a.y - b.y) / pinch.d;
        view.x = mid.x - pinch.w.x * Math.max(1, Math.min(8, view.z)); view.y = mid.y - pinch.w.y * Math.max(1, Math.min(8, view.z));
        clampView(); return;
      }
      if (!drag) return;
      const p = angleAt(local(e));
      let d = p.a - drag.last; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI;
      drag.last = p.a; drag.turned += d;                    // screen y points down: a positive delta is clockwise
      S.offsetMs = drag.base + drag.turned / (2 * Math.PI) * 864e5;   // one turn, one day; the slider under the dial follows
      recompute();
    });
    const up = e => {
      pts.delete(e.pointerId);
      if (pinch && pts.size < 2) { pinch = null; view.pinching = false; S.dirty = true; }
      if (!pts.size) endTurn();
    };
    canvas.addEventListener('pointerup', up); canvas.addEventListener('pointercancel', up);
    canvas.addEventListener('dblclick', () => { view.z = 1; clampView(); });
    // some phone browsers start their own page zoom on two fingers despite touch-action; the dial keeps the gesture
    canvas.addEventListener('touchmove', e => { if (e.touches.length >= 2) e.preventDefault(); }, { passive: false });
    canvas.addEventListener('touchstart', e => { if (e.touches.length >= 2) e.preventDefault(); }, { passive: false });
    canvas.addEventListener('wheel', e => {
      e.preventDefault();
      if (e.ctrlKey || e.metaKey) { zoomAt(local(e), view.z * Math.exp(-e.deltaY * 0.005)); return; }   // trackpad pinch arrives as ctrl + wheel
      S.playing = false; S.offsetMs += Math.sign(e.deltaY) * 600000;
      recompute();
    }, { passive: false });
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT') return;
      const c = { x: S.side / 2, y: S.side / 2 };
      if (e.key === '+' || e.key === '=') zoomAt(c, view.z * 1.4);
      if (e.key === '-' || e.key === '_') zoomAt(c, view.z / 1.4);
      if (e.key === '0') { view.z = 1; clampView(); }
    });
  }

  /* the device's position: asked once on the first visit, and whenever "here" is pressed */
  function locate(asked) {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(p => {
      S.place = { name: 'here', lat: p.coords.latitude, lon: p.coords.longitude, tz: Intl.DateTimeFormat().resolvedOptions().timeZone };
      store.set('place', S.place);
      const sel = $('city'); if (![...sel.options].some(o => o.value === '')) sel.insertAdjacentHTML('beforeend', '<option value="">here</option>');
      sel.value = ''; recompute();
    }, () => { if (asked) $('here').title = 'location not available on this device or browser'; }, { timeout: 10000, maximumAge: 3600e3 });
  }

  function setLang(l) {
    S.lang = l; store.set('lang', l); SD.i18n.set(l); SD.i18n.apply(); glossaryTerms(); glossaryLang = null;
    if ($('set-lang').value !== l) $('set-lang').value = l;
    requestAnimationFrame(slideSeg);
    if (!$('menu').hidden) refreshMenu();
    document.querySelectorAll('[data-about]').forEach(el => { el.hidden = el.dataset.about !== l; });
    scan.key = null;                                        // the week's labels are rebuilt in the new language
    if (S.state) recompute(); drawNexts();
  }

  async function start() {
    SD.i18n.set(S.lang); SD.i18n.apply();
    document.querySelectorAll('[data-about]').forEach(el => { el.hidden = el.dataset.about !== S.lang; });
    try {
      await Promise.all(['400 20px Geist', '500 20px Geist', '400 20px "Geist Mono"'].map(f => document.fonts.load(f)));
    } catch (e) { /* fonts are a nicety */ }
    if (natalModes.includes(S.mode) && !S.natal) S.mode = 'clock';
    document.body.classList.toggle('reading', S.reading && !S.wall); document.body.classList.toggle('wall', S.wall);
    bind(); bindMenu(); if (!S.wall) bindGesture(); size(); glossaryTerms(); recompute(); drawNexts(); requestAnimationFrame(slideSeg);
    if (!S.wall && (S.firstVisit || S.place.name === 'here')) locate(false);   // a wallpaper never asks for the position: it takes the address's place or the device's zone
    requestAnimationFrame(frame);
    if (navigator.storage && navigator.storage.persist) navigator.storage.persist().catch(() => {});   // ask the browser not to evict the saved charts under storage pressure
    if (!store.works()) { const w = document.createElement('p'); w.className = 'meta storage-warn'; w.textContent = SD.i18n.cap1(SD.i18n.t('ui.noStorage')); const ns = $('natal-summary'); if (ns) ns.after(w); }
    if ('serviceWorker' in navigator && /^https?:/.test(location.protocol) && !/claude\.ai$/.test(location.hostname)) navigator.serviceWorker.register('./sw.js').catch(() => {});
  }
  SD.app = { start, exportPNG, exportWallpaper, setLang, S, viewState, view, voicing, audio };
  start();
})(window.SD = window.SD || {});
