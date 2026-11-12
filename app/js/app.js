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
    algol: store.get('algol', false),
    engrave: params.get('field') ? params.get('field') !== 'glow' : (params.get('engrave') !== '0' && store.get('field', 'engraved') !== 'glow'),   // engraved at rest; glow on request
    natal: store.get('natal', null),                        // { date, place, unknownTime } — stays on this device
    pair: store.get('pair', null),                          // the second chart for synastry, by id
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
  const natalCache = { key: null, state: null }, pairCache = { key: null, state: null }, activeCache = { key: null, v: [] };
  /* the relationship type of a pair (rule A3), kept per pair whichever chart is first; "other" by default */
  const pairKey = (a, b) => 'pairType:' + [a, b].sort().join('|');
  const pairTypeOf = (a, b) => store.get(pairKey(a, b), 'other');
  function natalState() {
    if (!S.natal) return null;
    const place = S.relocate ? S.place : S.natal.place;     // relocated: the same instant, the houses of another horizon
    const key = JSON.stringify([S.natal.date, place, S.houses, S.natal.name, !!S.natal.unknownTime]);
    if (natalCache.key !== key) {
      const st = SD.engine.compute(new Date(S.natal.date), place, { houses: S.houses });
      st.natalView = true; st.nextChord = null; st.relocated = S.relocate ? place.name : null;
      st.chartName = S.natal.name || '';                   // the owner's name, after "birth chart" on the dial
      if (S.natal.unknownTime) st.elements = SD.engine.elements(st, { noTime: true });   // no birth time: the angles are unknown, the elements go by the bodies alone
      st.tikkun = SD.tikkun.of(st, { noTime: !!S.natal.unknownTime });   // the life mission, from the nodes
      try {                                                 // the temperament, laid down at the birthplace whatever horizon is shown
        const at = S.relocate ? SD.engine.compute(new Date(S.natal.date), S.natal.place, { houses: S.houses }) : st;
        st.temperament = Object.assign(SD.temperament.of(at, { noTime: !!S.natal.unknownTime }), { relocated: !!S.relocate, tz: S.natal.place.tz || null });
      } catch (e) { st.temperament = null; }
      natalCache.key = key; natalCache.state = st;
    }
    return natalCache.state;
  }
  /* the stone of the day for the chart on show: read from the sky at the place's local noon of the day displayed, so it
     holds from midnight to midnight and does not flicker with the hour (SD.engine.stoneOfDay) */
  const stoneCache = { key: null, v: null };
  function stoneOfTheDay(ns) {
    try {
      const p = placeParts(now(), S.place.tz), key = [S.natal.id || S.natal.date, S.natal.date, p.year, p.month, p.day, S.place.lat, S.place.lon].join('|');
      if (stoneCache.key !== key) {
        const noon = fromStamp(`${p.year}-${p.month}-${p.day} 12:00`, S.place.tz) || now();
        const day = SD.engine.compute(noon, S.place, { light: true, houses: S.houses });
        stoneCache.key = key; stoneCache.v = SD.engine.stoneOfDay(day, ns, SD.engine.computeTransits(day, ns));
      }
      return stoneCache.v;
    } catch (e) { return null; }                            // the stone is a courtesy: the transits never wait on it
  }
  const natalModes = ['natal', 'natalchart', 'synastry', 'pair'];
  /* the leading transits' dates (exact, entering and leaving orb) are searched once per transit and day and kept */
  const spanCache = new Map();
  function transitInfo(ns, tr) {
    const day = Math.floor(now().getTime() / 864e5), spans = {}, houses = {};
    for (const a of tr.slice(0, 4)) {
      const key = [S.natal.id || S.natal.date, a.a, a.b, a.aspect, day].join('|');
      if (!spanCache.has(key)) { if (spanCache.size > 200) spanCache.clear(); spanCache.set(key, SD.engine.transitSpan(a.a, a.nlon, a.angle, a.orbMax, now())); }
      spans[a.a + '|' + a.b + '|' + a.aspect] = spanCache.get(key);
      if (!S.natal.unknownTime) houses[a.a] = SD.engine.houseIn(ns.cusps, S.state.bodies[a.a].lon);
    }
    return { name: S.natal.name || '', spans, houses };
  }
  function viewState() { return (S.mode === 'natal' || S.mode === 'natalchart') && S.natal ? natalState() : S.state; }

  function recompute() {
    const busy = S.playing || S.dragging;
    S.state = SD.engine.compute(now(), S.place, { light: busy, houses: S.houses });
    if (!busy) S.state.nextChord = SD.engine.nextChordShift(S.state.date, S.place);
    if (S.mode === 'pair' && S.natal) {                     // two charts: the second laid over the first, the figure their strongest contact
      const A = natalState(), Bc = S.charts.find(c => c.id === S.pair && c.id !== S.natal.id);
      if (Bc) {
        const key = JSON.stringify([Bc.date, Bc.place, S.houses, !!Bc.unknownTime]);
        if (pairCache.key !== key) { pairCache.key = key; pairCache.state = SD.engine.compute(new Date(Bc.date), Bc.place, { houses: S.houses }); if (Bc.unknownTime) pairCache.state.elements = SD.engine.elements(pairCache.state, { noTime: true }); }
        // the first chart is the dial, the second is the ring laid over it; the contacts run from the first's planets to the second's points
        const Bs = pairCache.state, type = pairTypeOf(S.natal.id, Bc.id), noA = !!S.natal.unknownTime, noB = !!Bc.unknownTime;
        // synastry rules v2.1: one source of truth for every word of the pair (js/synastry.js)
        const syn = SD.synastry.of(A, Bs, { at: new Date(), type, noTimeA: noA, noTimeB: noB });
        const ASP = Object.fromEntries(SD.corr.ASPECTS.map(x => [x.key, x]));
        const tr = syn.contacts.filter(c => SD.corr.PLANETS[c.a] && (SD.corr.PLANETS[c.b] || c.b === 'ascendant' || c.b === 'midheaven'))   // the drawable contacts, heaviest first
          .map(c => ({ a: c.a, b: c.b, natal: true, nlon: c.b === 'ascendant' ? Bs.asc : c.b === 'midheaven' ? Bs.mc : Bs.bodies[c.b].lon, aspect: c.aspect, n: (ASP[c.aspect] || {}).n, k: (ASP[c.aspect] || {}).k, nature: (ASP[c.aspect] || {}).nature, angle: c.angle, orb: c.orb, power: c.w / 10, exact: 1 - c.orb / c.max, applying: false }));
        const dayKey = JSON.stringify([S.natal.id, Bc.id, new Date().toISOString().slice(0, 10)]);
        if (activeCache.key !== dayKey) { activeCache.key = dayKey; activeCache.v = SD.synastry.activeNow(A, Bs, syn, new Date(), noA, noB); }
        S.state = { ...A, natalView: true, natal: Bs, transits: tr, syn, synActive: activeCache.v, pair: { a: S.natal.name || '', b: Bc.name || '', ids: [S.natal.id, Bc.id], noTime: [noA, noB] } };
        S.state.interaction = SD.engine.computeInteractions(A, Bs, tr);
        S.state.attraction = syn.age.sexual ? SD.engine.desireOf(tr, A, Bs) : null;   // the pull between two bodies: adults only (rule 0)
        S.state.transitInfo = { name: `${S.natal.name || ''} × ${Bc.name || ''}`, spans: {}, houses: Object.fromEntries(tr.slice(0, 5).filter(a => Bs.bodies[a.b]).slice(0, 3).map(a => [a.b, SD.engine.houseIn(A.cusps, Bs.bodies[a.b].lon)])) };
        S.state.configs = { ...A.configs, primary: tr[0] || null, secondary: tr.slice(1, 3), scale: 1, cut: null };
        S.state.ownFigures = { a: A.configs.primary, b: Bs.configs.primary };   // each chart's own ruling figure, faint behind the pair's
        S.state.composite = SD.engine.compositeOf(A, Bs);    // the pair's own chart: its figure is the mandala
      } else { S.state = { ...A, natalView: true, pairMissing: true }; }
    }
    if (S.mode === 'synastry' && S.natal) {                 // the sky of now against the nativity: the figure is the strongest transit
      const ns = natalState(), tr = SD.engine.computeTransits(S.state, ns).filter(x => x.power > 0.04 && !(S.natal.unknownTime && (x.b === 'ascendant' || x.b === 'midheaven')));
      S.state.natal = ns; S.state.transits = tr;
      S.state.interaction = SD.engine.computeInteractions(S.state, ns, tr);   // what the two skies make together
      S.state.transitInfo = transitInfo(ns, tr);                                 // when each leading transit is exact, and where it stands in the natal houses
      S.state.stone = stoneOfTheDay(ns);                                         // one stone for the whole day, with one alternative
      S.state.configs = { ...S.state.configs, primary: tr[0] || null, secondary: tr.slice(1, 3), scale: 1, cut: null };
    }
    S.lastCompute = performance.now();
    S.dirty = true;
    document.documentElement.style.setProperty('--ground', S.groundEl ? SD.render.ground(S.state, true) : '#000000');
    document.body.classList.toggle('mrx', viewState().bodies.mercury.slow > 0.5);   // mercury retrograde: the print misregisters
    const c = SD.render.captionLines(viewState(), true);
    const low = s => s.replace(/^./, ch => ch.toLowerCase());
    for (const k in c) if (typeof c[k] === 'string') c[k] = esc(c[k]);
    for (const k of ['label', 'state', 'els', 'title', 'reason', 'l1', 'detail1', 'detail2', 'detail3', 'detail4', 'pairLine', 'pairLine2']) if (typeof c[k] === 'string') c[k] = c[k].replace(/ · /g, '\u00a0· ');   // a separator ends its line, never starts the next
    const copyBtn = `<button class="copy-btn" aria-label="${esc(SD.i18n.t('ui.copyReport'))}" title="${esc(SD.i18n.t('ui.copyReport'))}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true" class="ico-copy"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ico-done"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>`;
    const capHtml = `<button class="share-btn${shareState ? ' ' + shareState : ''}" aria-label="${esc(SD.i18n.t(shareState === 'ready' ? 'ui.tapToShare' : 'ui.share'))}" title="${esc(SD.i18n.t('ui.share'))}"><svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round" aria-hidden="true"><circle cx="17.5" cy="5.5" r="2.4"/><circle cx="6.5" cy="12" r="2.4"/><circle cx="17.5" cy="18.5" r="2.4"/><path d="M8.6 10.8l6.8-4M8.6 13.2l6.8 4"/></svg></button><p class="eyebrow">${c.label} <a class="what" href="#read-title">${esc(SD.i18n.t('cap.whatItMeans'))}</a></p>${c.els ? `<h2 class="h1 els" style="color:${c.elInk}">${c.els}</h2>` : `<h2 class="h1 state-${c.stateKey}">${c.opLabel ? `<span class="op">${c.opLabel}</span> ` : ''}${c.state}</h2>`}<p class="deck">${c.title}</p>${c.cols && (S.state.syn || S.state.ties) ? tieScales(S.state) : `<p class="reason">${c.reason}${c.brief && c.copy ? ' ' + copyBtn : ''}</p>`}${c.cols ? `<p class="reason">${c.detail4}</p><div class="pair-cols">${c.cols.map(col => `<div><b>${esc(col.head)}</b>${col.lines.map(l => '<br>' + esc(l)).join('')}</div>`).join('')}</div><p class="detail">${c.pairLine}<br>${c.pairLine2}</p>` : c.brief ? '' : `<p class="moment">${c.l1}${c.copy ? ' ' + copyBtn : ''}</p><p class="detail">${c.detail1}<br>${c.detail2} · ${c.detail3}</p>${c.stone ? `<p class="detail stone-line">${c.stone}</p>` : ''}<p class="detail">${c.detail4}</p>`}`;
    if (capHtml !== S.capHtml) { const back = focusOf($('caption')); S.capHtml = capHtml; $('caption').innerHTML = capHtml; linkTerms($('caption')); if (back) back($('caption')); if (SD.app_pop) SD.app_pop.repoint(); }
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
    const later = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 400 }) : setTimeout(f, 16));   // in the page's idle time, never in the way of a tap
    (function chunk() {
      if (token !== scan.token) return;
      const until = performance.now() + 6;                          // at most 6 ms at a time
      for (; i <= N && performance.now() < until; i++) {
        const st = SD.engine.compute(new Date(b + i * scan.step * 60000), S.place, { light: true, houses: S.houses });
        out.push({ ...st.windows, house: st.bodies.moon.house, veil: st.veil.v, share: st.mode.share });   // the Moon's house names the window's stage; the veil and the mode's shares ride along
      }
      if (i <= N) return later(chunk);
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
  const REDUCED = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : { matches: false };
  function frame(ts) {
    requestAnimationFrame(frame);
    if (!S.playing && !S.dragging && ts - lastFrame < 1000 / 30) return;     // at rest 30 fps; running, every frame the screen gives
    const dt = Math.min(0.1, (ts - (lastFrame || ts)) / 1000);
    if (S.playing) { S.offsetMs += S.speed * 3600e3 * dt; recompute(); }   // smooth: time advances with the real frame interval
    else if (performance.now() - S.lastCompute > 20000) recompute();
    lastFrame = ts;
    const t = REDUCED.matches ? 0 : (ts - t0) / 1000;      // reduced motion: no twinkle, no glow pulse
    if (S.wall) {
      if (S.dirty) {
        pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, plate.width, plate.height);
        info = SD.render.renderWallpaper(pctx, viewState(), plate.width, plate.height, t, { fieldRes: 300, plate: true, fast: S.playing, field: S.field, sigil: S.sigil, algol: S.algol, engrave: S.engrave, luminous: S.luminous });
        S.dirty = false; lastPlate = ts;
      }
      ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.drawImage(plate, 0, 0);
      SD.render.overlay(ctx, info, t);
      return;
    }
    if (S.dirty) {
      pctx.setTransform(1, 0, 0, 1, 0, 0); pctx.clearRect(0, 0, plate.width, plate.height);
      pctx.setTransform(S.dpr * view.z, 0, 0, S.dpr * view.z, S.dpr * (view.x + S.ox), S.dpr * view.y);   // the view: zoom and pan, the square centred in the canvas
      const busy = S.playing || S.dragging || view.pinching || S.quick;
      const bounds = { x: -(view.x + S.ox) / view.z, y: -view.y / view.z, w: (S.side + 2 * S.ox) / view.z, h: S.side / view.z };   // the canvas, in dial coordinates
      info = SD.render.render(pctx, viewState(), S.side, t, { mode: S.mode === 'chart' || S.mode === 'natalchart' ? 'chart' : 'clock', fieldRes: busy ? 110 : 200, caption: S.side >= 560, brief: true, plate: true, fast: busy, field: S.field, sigil: S.sigil, algol: S.algol, engrave: S.engrave, luminous: S.luminous, tight: S.side < 560, groundEl: S.groundEl, bounds });
      S.dirty = false; lastPlate = ts;
      if (S.quick) { S.quick = false; S.dirty = true; }               // a quick frame is followed by the full one
    }
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.drawImage(plate, 0, 0);
    ctx.setTransform(S.dpr * view.z, 0, 0, S.dpr * view.z, S.dpr * (view.x + S.ox), S.dpr * view.y);
    SD.render.overlay(ctx, info, t);
    placeWhatLink(info); placeCopyLink(info);
  }
  /* the "what it means" link drawn on the canvas gets a clickable area in the page, following zoom and pan */
  function placeCopyLink(info) {                           // the copy icon drawn on the dial after the birth city: a button laid over it
    const a = $('copy-link'); if (!a) return;
    const e = info && info.layout && info.layout.copyHit;
    if (!e || S.side < 560 || S.wall || document.body.classList.contains('bare')) { a.hidden = true; return; }
    a.hidden = false;
    a.style.left = `${view.x + S.ox + e.x * view.z}px`; a.style.top = `${view.y + e.y * view.z}px`; a.style.width = `${e.w * view.z}px`; a.style.height = `${e.h * view.z}px`;
  }
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
  const SPEAKER = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" stroke-linecap="round" aria-hidden="true"><path d="M4 9.5v5h3.2l4.3 3.3V6.2L7.2 9.5H4z"/><path class="w1" d="M15 9.6a3.4 3.4 0 0 1 0 4.8"/><path class="w2" d="M17.6 7a7 7 0 0 1 0 10"/><line class="x" x1="4" y1="20" x2="20" y2="4" stroke-width="1.8"/></svg>';
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
    const ac = audio.ctx, now = ac.currentTime, out = ch ? 3 : 0.25;   // a new chord glides over 3 s; silence comes at once, a quick fade with no click
    for (const v of audio.voices) { v.gain.gain.cancelScheduledValues(now); v.gain.gain.setValueAtTime(v.gain.gain.value, now); v.gain.gain.linearRampToValueAtTime(0, now + out); v.oscs.forEach(o => o.stop(now + out + 0.05)); }
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
    for (const b of document.querySelectorAll('#readout [data-act="listen"]')) { b.classList.toggle('on', on); b.setAttribute('aria-pressed', String(on)); b.title = SD.i18n.t(on ? 'ui.listening' : 'ui.listen'); }   // the chord's speaker in the reading: one sound, two switches
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
  /* the reading spec: the owner's own format for a natal reading, set at the head of every copied or saved birth chart
     report so that any AI it is pasted into reads the chart that way by default. Kept verbatim in English: it is an
     instruction to the model, whatever the interface language. Section 9 is reserved: the owner's text stopped at "9." */
  const READING_SPEC = `NATAL READING SPEC · apply to the chart below
Derive missing houses or nodes and say so in one line; never ask for data you can infer.
No preamble. Open with the one fact that governs the chart: usually the chart ruler's sign, house, dignity, retrogradation; add the Sun-Moon phase if notable. Then ## sections in this order:
1. ANCORE LUNARI: the Moon's hard aspects, term defined in one line. Sign and house together, always. Hard aspects with orbs, then the supporting sextiles and trines.
2. [SIGN NOTE]: the dominant sign against its stereotype, briefly. Only if one sign clearly dominates.
3. NODES: South = provenance (past-life competence, the trap); North = this incarnation's mission. Sign and house of each. End with the tell: the sentence or reflex that shows the South Node running.
4. SATURN: sign, house, dignity; flag if it disposits a cluster.
5. VOCATION: MC sign, its ruler's placement, aspects to MC, 10th house planets.
6. MONEY: 2nd house sign, its ruler's placement, planets inside. End with one line: the income model that actually works.
7. THE CRITICAL ASPECT: the tightest hard aspect. How the two planets misfire together, concrete risk zones, 2-3 literal operating rules.
8. OCCULT LAYER, only if present: Pluto, Neptune, Uranus, 8th and 12th houses. 8th = eros, shared resources, inheritance, power, depth-work; not death and crisis.
9. OVERVIEW: element and modality balance and what it means in behaviour. Close with the current transits to the angles and nodes (given in the data).
10. TAROT, Golden Dawn: Majors for signs and planets, Minors for decans (decan card with its title). Cover Sun, Moon, Ascendant, chart ruler, MC, Saturn, the critical aspect, the nodes. End with one single card for the whole nativity.
Sections 1-8 each end with two italic lines:
*Vibrazione bassa:* how the configuration misfires.
*Vibrazione alta:* how to raise it; concrete and operational, not inspirational.
Style: discursive prose, dense and exact. Explain each technical term once, briefly, for a first-time reader. State orbs. No confidence tags, no hedging, no "may suggest": commit to readings. Don't flatter the chart. End flat, no uplifting closer. Reply in the language the user writes in; with no other text, in the language of this report.
11. TIKKUN, from the Tikkun data below (true node; the cards are a symbolic reading, not prediction): Karma (South Node) → Mission (North Node), with the Engine and any Threshold. For each card three lines: the letter (name and meaning), the card, how it applies to this chart. Then one paragraph on the movement from Karma to Mission. Then the signs on the road, one line each: repeated cards first, then the other placement cards, then the aspect cards (a path card that shares a planet's name has nothing to do with that planet). Then 3-4 sentences of synthesis, reading the road signs as help toward the Mission or friction against it. Then the Psalm 119 stanzas for the Mission and Engine letters as an optional practice.
12. TEMPERAMENT, from the Temperament data below (computed after Lilly's significators with Greenbaum's weights; the verdict is given, do not recount it): the complexion and its mixture, the testimonies that carry it, the Lord of the Geniture, any intemperance. Read it as Ficino (De vita), Agrippa (Occult Philosophy) and the Picatrix read the four humours, and end with Ficino's regimen for it: what to call on, colours, music, odours, places, stones.`;
  /* the mean lunar node (Meeus 47.7): the nodes are not among the bodies, and the spec reads them */
  const meanNode = date => SD.engine.trueNode(date);   // the true node, as the tikkun reads it: one node throughout the report
  function chartReportText() {
    const st = natalState(); if (!st) return null;
    const i = SD.i18n, C = SD.corr, n = S.natal, R = k => i.t('ui.rep.' + k);
    const P = k => i.cap1(i.planet(k)), A = k => i.aspect(k);
    const lonTxt = lon => { const L = ((lon % 360) + 360) % 360, sg = Math.floor(L / 30), d = L - sg * 30; return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′ ${i.sign(sg)} (${L.toFixed(2)}°)`; };
    const pp = placeParts(new Date(n.date), n.place.tz), off = offsetOf(n.place.tz, new Date(n.date));
    const L = [];
    L.push(`# ${R('title')} · ${n.name || i.t('ui.noneSet')}`, '');
    L.unshift(READING_SPEC, '', '---', '');                // the owner's reading format first: the AI reads the chart this way by default
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
    { const nn = meanNode(new Date(n.date)), sn = SD.engine.norm360(nn + 180), hIn = lon => i.roman(SD.engine.houseIn(st.cusps, lon));
      L.push(`- ${R('northNode')}: ${lonTxt(nn)} · ${R('house')} ${hIn(nn)}`, `- ${R('southNode')}: ${lonTxt(sn)} · ${R('house')} ${hIn(sn)}`);
      L.push(`- ${i.t('ui.r.fortune')}: ${lonTxt(st.fortune)} · ${R('house')} ${hIn(st.fortune)}`); }
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
    L.push(`- ${R('verdict')}: ${i.verdict(mc.verdict)}${mc.verdict === 'void' && mc.tolerable ? ` (${i.t('cap.tolerable')(i.sign(m.sign))})` : ''}`);
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
    L.push(st.elements.order.map(k => `${i.t('ui.el.' + k)} ${st.elements.pct[k]}%`).join(' · '));   // heaviest first, whole numbers that add up to 100: as the caption and the reading show them
    { const W = { sun: 3, moon: 3, mercury: 1.5, venus: 1.5, mars: 1.5, jupiter: 1, saturn: 1, uranus: 0.4, neptune: 0.4, pluto: 0.4 }, m = { cardinal: 0, fixed: 0, mutable: 0 };   // the same weights as the elements
      for (const k in W) m[C.SIGNS[st.bodies[k].sign].mode] += W[k];
      if (!(st.natalView && S.natal && S.natal.unknownTime)) { m[C.SIGNS[Math.floor(st.asc / 30)].mode] += 2.5; m[C.SIGNS[Math.floor(st.mc / 30)].mode] += 1; }   // no birth time, no angles: as the elements
      const tot = m.cardinal + m.fixed + m.mutable;
      L.push(`${R('modalities')}: ${['cardinal', 'fixed', 'mutable'].map(k => `${R(k)} ${Math.round(m[k] / tot * 100)}%`).join(' · ')} (${R('weights')})`, ''); }
    /* the Golden Dawn's cards for the points the spec reads: the sign's Major, the planet's Major, the decan's Minor with its title */
    { const ruler = k => Object.keys(C.DOMICILE).find(p => C.CHALDEAN.includes(p) && C.DOMICILE[p].includes(C.SIGNS[Math.floor(k / 30)].key));
      const rk = ruler(st.asc), nn = meanNode(new Date(n.date)), rows = [['sun', st.bodies.sun.lon], ['moon', st.bodies.moon.lon], ['ascendant', st.asc], [rk, st.bodies[rk].lon, R('chartRuler')], ['midheaven', st.mc], ['saturn', st.bodies.saturn.lon], ['northNode', nn], ['southNode', SD.engine.norm360(nn + 180)]];
      L.push(`## ${R('tarot')}`);
      L.push(`| ${R('point')} | ${R('position')} | ${R('signCard')} | ${R('planetCard')} | ${R('decanCard')} |`, '|---|---|---|---|---|');
      for (const [k, lon, tag] of rows) {
        const sg = Math.floor(lon / 30), d = C.decanOf(lon), name = C.PLANETS[k] ? P(k) : k === 'ascendant' ? 'ASC' : k === 'midheaven' ? 'MC' : R(k);
        L.push(`| ${name}${tag ? ' (' + tag + ')' : ''} | ${lonTxt(lon)} | ${i.trumpSign(sg)} | ${C.PLANETS[k] && i.trumpPlanet(k) ? i.trumpPlanet(k) : '—'} | ${i.card(d)} · ${i.title(d)} |`);
      }
      L.push(''); }
    if (st.tikkun) {                                        // the life mission, every card already computed, so the reader never invents a position
      const k = st.tikkun, T = SD.tikkun.text(), M = SD.tikkun.major, Lt = SD.tikkun.letter;
      const nm = x => x === 'ascendant' ? 'ASC' : x === 'midheaven' ? 'MC' : x === 'northNode' ? T.north : P(x);
      const hs = h => h ? ` · ${R('house')} ${i.roman(h)}` : '';
      L.push(`## ${T.label} · ${T.mean}`);
      L.push(`- ${T.karma}: ${T.south} ${lonTxt(k.south.lon)}${hs(k.south.house)} · ${Lt(k.south.letter)} · ${M(k.south.card)}`);
      L.push(`- ${T.mission}: ${T.north} ${lonTxt(k.north.lon)}${hs(k.north.house)} · ${Lt(k.north.letter)} · ${M(k.north.card)} · ${T.psalm} ${k.north.psalm}`);
      L.push(`- ${T.engine}: ${P(k.engine.planet)}, ${i.t('ui.rep.rulerOf')} ${i.sign(k.north.sign)}, ${i.t('ui.rep.inSign')} ${i.sign(k.engine.sign)}${hs(k.engine.house)} · ${Lt(k.engine.letter)} · ${M(k.engine.card)} · ${T.psalm} ${k.engine.psalm}${k.engine.doubled ? ' · ' + T.doubled : ''}`);
      for (const c of k.conj) L.push(`- ${T.conj}: ${P(c.planet)} ${A('conjunction')} ${c.node === 'north' ? T.north : T.south} ${c.orb.toFixed(1)}° · ${M(c.card)}`);
      for (const t of k.threshold) L.push(`- ${T.threshold}: ${t.node === 'north' ? T.north : T.south} ${SD.tikkun.near(t)} · ${Lt(t.letter)} · ${M(t.card)}`);
      L.push(`- ${T.mission}, ${i.t('ui.rep.inWords')}: ${T.long[k.north.sign]}${k.north.house ? ` ${T.livedIn} ${i.realm(k.north.house)}.` : ''}`);
      L.push(`- ${T.road}: ${k.placements.map(p => `${M(p.card)}${p.count > 1 ? ' ×' + p.count : ''} (${p.keys.map(nm).join(', ')})${p.tikkun ? ' ★' : ''}`).join(' · ')}`);
      L.push(`- ${T.aspects}: ${k.aspects.map(a => `${nm(a.a)} ${A(a.aspect)} ${nm(a.b)} ${a.orb.toFixed(1)}° → ${SD.tikkun.cardOf(a)}${a.path ? ` (${Lt(a.letter)})` : ''}, ${T[a.quality]}${a.weak ? ', ' + T.weak : ''}`).join(' · ')}`);
      if (k.noTime) L.push(`- ${i.cap1(T.noTime)}`);
      L.push(`- ★ = ${i.t('ui.rep.reinforces')}`, '');
    }
    if (st.temperament) {                                   // the temperament, computed: the reader reads it, never recounts it
      const tp = st.temperament, TT = SD.temperament.text(), nm = t => TT.temp[t], q = r => SD.temperament.QUAL[r.temperament].split('').map(x => TT.q[{ H: 'hot', C: 'cold', M: 'moist', D: 'dry' }[x]]).join(', ');
      L.push(`## ${i.cap1(TT.heading)}`);
      L.push(`- ${R('verdict')}: ${i.cap1(SD.temperament.line(tp, tp.partial))}`);
      if (tp.day) { const hm = d => new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tp.tz || 'UTC' }).format(tp.tz ? d : new Date(d.getTime() + n.place.lon / 15 * 3600e3)); L.push(`- ${TT.dayRuns} ${tp.day.map(x => `${SD.temperament.line(x.judgement)} (${hm(x.from)}–${hm(x.to)})`).join('; ')}`); }
      for (const r of tp.rows) L.push(`- ${TT.row[r.step]} · ${tempDetail(st, r)}: ${nm(r.temperament)} (${q(r)}) · ${tempNum(r.w)}`);
      L.push(`- ${TT.tally}: ${tp.rank.map(t => `${nm(t)} ${tempNum(tp.T[t])}`).join(' · ')}`);
      L.push(`- ${TT.columns(tempNum(tp.columns.hot), tempNum(tp.columns.cold), tempNum(tp.columns.moist), tempNum(tp.columns.dry), SD.temperament.TEMPS.includes(tp.columns.verdict) ? nm(tp.columns.verdict) : TT.q[tp.columns.verdict])}`);
      if (tp.lordOfGeniture) { const lg = tp.lordOfGeniture; L.push(`- ${TT.lord(P(lg.planet), lg.total)}${lg.participant ? '; ' + TT.participates(P(lg.participant), lg.totals[lg.participant]) : ''}`); }
      for (const c of tp.intemperance) L.push(`- ${TT.excessOf([c.planet])}: ${c.aspect === 'body' ? TT.contact.body(P(c.planet), c.orb.toFixed(1) + '°') : TT.contact[c.to](P(c.planet), A(c.aspect), c.orb.toFixed(1) + '°', c.aspect)} (${TT.grade[c.grade]})`);
      if (tp.relocated) L.push(`- ${TT.relocated}`);
      L.push('');
    }
    L.push(`## ${R('layers')}`);
    const pr = st.configs.primary;
    if (pr) L.push(`- ${R('figure')}: ${P(pr.a)} ${A(pr.aspect)} ${P(pr.b)} · {${pr.n}/${pr.k}} · ${R('orb')} ${pr.orb.toFixed(2)}°${st.configs.cut ? ` · ${R('cut')} ${P(st.configs.cut.by)}` : ''}`);
    L.push(`- ${R('chord')}: ${i.chordLong(st.chord)}${st.chord.notes.length ? ' · ' + st.chord.notes.map(x => i.note(x)).join(' ') : ''}`);
    L.push(`- ${R('windows')}: ${Object.entries(st.windows).map(([k, v]) => `${i.window(k)} ${v.toFixed(2)}`).join(' · ')}`);
    L.push(`- ${R('titleOf')}: ${i.state(st.title.state)} · ${i.house12(st.title.house)} · ${i.window(st.title.mode)}`);
    L.push(`- ${R('veil')}: ${st.veil.v.toFixed(2)}${st.veil.factors.length ? ' · ' + st.veil.factors.map(x => i.t('ui.veilOf.' + x.key)).join(', ') : ''}`, '');
    {                                                       // the sky of now against this chart: the real now, whatever the dial shows
      const nowSt = SD.engine.compute(new Date(), S.place, { light: true, houses: S.houses });
      const tr = SD.engine.computeTransits(nowSt, st).filter(x => x.power > 0.04), inter = SD.engine.computeInteractions(nowSt, st, tr);
      const nn = meanNode(new Date(n.date)), pts = [['ascendant', st.asc], ['midheaven', st.mc], ['northNode', nn], ['southNode', SD.engine.norm360(nn + 180)]];
      const asp = [[0, 'conjunction', 3], [180, 'opposition', 3], [90, 'square', 3], [120, 'trine', 2.5], [60, 'sextile', 2]], hits = [];
      for (const k of C.ORDER) { if (k === 'moon') continue;     // the Moon crosses every point monthly: left out
        for (const [pk, plon] of pts) { const d = SD.engine.sep(nowSt.bodies[k].lon, plon), a = asp.find(([deg, , o]) => Math.abs(d - deg) <= o); if (a) hits.push(`- ${P(k)} ${A(a[1])} ${R('natal')} ${pk === 'ascendant' ? 'ASC' : pk === 'midheaven' ? 'MC' : R(pk)} · ${Math.abs(d - a[0]).toFixed(2)}°${nowSt.bodies[k].retro ? ' · ' + R('retrograde') : ''}`); } }
      L.push(`## ${R('anglesNodes')} · ${placeStamp(nowSt.date)} ${S.place.tz}`);
      L.push(...(hits.length ? hits : [`- ${R('noneInOrb')}`]), '');
      L.push(`## ${R('transits')} · ${placeStamp(nowSt.date)} ${S.place.tz}`);
      L.push(`- ${R('verdict')}: ${i.t('ui.r.' + inter.verdict) === 'ui.r.' + inter.verdict ? inter.verdict : i.t('ui.r.' + inter.verdict)} · ${R('harmony')} ${inter.harmony.toFixed(2)} · ${R('strife')} ${inter.strife.toFixed(2)}`);
      for (const a of tr.slice(0, 14)) L.push(`- ${P(a.a)} ${A(a.aspect)} ${R('natal')} ${C.PLANETS[a.b] ? P(a.b) : a.b === 'ascendant' ? 'ASC' : 'MC'} · ${a.orb.toFixed(2)}° ${a.applying ? R('applying') : R('separating')} · ${a.power.toFixed(2)}`);
      L.push('');
    }
    L.push(`— ${R('footer')} · siderarium.com · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    return { text: L.join('\n'), name: n.name || 'chart' };
  }
  const reportText = () => S.mode === 'pair' && S.state && S.state.pair ? pairReportText() : chartReportText();
  function chartReport() {
    const r = reportText(); if (!r) return;
    const base = r.name.toLowerCase().replace(/[^\p{L}\p{N}]+/gu, '-').replace(/^-|-$/g, '');
    downloadBlob(new Blob([r.text], { type: 'text/markdown' }), `siderarium-report-${base}.md`);
  }
  /* the same report onto the clipboard, to paste into an interpreter; the old way when the clipboard refuses */
  /* the copy icon: the chart report onto the clipboard, a tick for a moment as the answer */
  async function copyWithTick(btn) { const ok = await copyReport(); if (ok === false) return; btn.classList.add('done'); setTimeout(() => btn.classList.remove('done'), 1600); }
  async function copyReport() {
    const r = reportText(); if (!r) return false;
    const note = $('import-note'), i = SD.i18n;
    try { await navigator.clipboard.writeText(r.text); note.textContent = i.cap1(i.t('ui.copied')); return true; } catch (e) { /* fall through */ }
    const ta = document.createElement('textarea'); ta.value = r.text; ta.setAttribute('readonly', ''); ta.style.position = 'fixed'; ta.style.left = '-9999px';
    document.body.appendChild(ta); ta.select(); let ok = false; try { ok = document.execCommand('copy'); } catch (e) { ok = false; } ta.remove();
    note.textContent = i.cap1(i.t(ok ? 'ui.copied' : 'ui.copyFailed'));
    return ok;
  }
  const stampOf = st => st.date.toISOString().slice(0, 16).replace(/[:T]/g, '');
  /* a file name that says what it is: siderarium-<view>-<whose or where>-<yyyymmdd>.png */
  function fileName(st, extra) {
    const slug = t => String(t || '').normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
    const view = { clock: 'sky', chart: 'chart', natal: 'natal', natalchart: 'natal', synastry: 'transits', pair: 'synastry' }[S.mode] || 'sky';
    const who = st.pair ? `${st.pair.a}-${st.pair.b}` : (S.mode === 'natal' || S.mode === 'natalchart' || S.mode === 'synastry') && S.natal ? S.natal.name || 'chart' : st.loc.name;
    const day = new Date(st.date.getTime()).toISOString().slice(0, 10).replace(/-/g, '');
    return `siderarium-${view}-${slug(who) || 'chart'}-${day}${extra ? '-' + extra : ''}.png`;
  }
  /* the three image buttons answer the tap at once: the button says it is preparing, the page paints, and only then
     the heavy drawing starts; afterwards it says what happened. a second tap while it works does nothing */
  const nextPaint = () => new Promise(r => requestAnimationFrame(() => setTimeout(r, 0)));
  async function busy(btn, work) {
    if (!btn || btn.dataset.busy) return;
    const label = btn.innerHTML, i = SD.i18n; btn.dataset.busy = '1'; btn.classList.add('busy'); btn.setAttribute('aria-busy', 'true');
    btn.textContent = i.cap1(i.t('ui.preparing'));
    await nextPaint();
    let note = '';
    try { note = (await work()) || ''; } catch (e) { note = ''; }
    finally {
      btn.classList.remove('busy'); btn.removeAttribute('aria-busy'); delete btn.dataset.busy;
      if (note) { btn.textContent = i.cap1(note); setTimeout(() => { if (!btn.dataset.busy && btn.textContent === i.cap1(note)) btn.innerHTML = label; }, 2200); } else btn.innerHTML = label;
    }
  }
  const renderOpts = extra => ({ exported: true, mode: S.mode === 'chart' || S.mode === 'natalchart' ? 'chart' : 'clock', fieldRes: 300, field: S.field, sigil: S.sigil, algol: S.algol, engrave: S.engrave, luminous: S.luminous, ...extra });
  /* share: the art of the moment as an image, with its headline and the address; where the device cannot share files,
     the text and address; where it cannot share at all, the image is saved and the text copied.
     a browser opens its share sheet only within a few seconds of a tap: when the drawing takes longer, the image is
     kept and the button asks for a second tap, which shares at once */
  let shareReady = null, shareState = '';
  const shareKey = () => { const st = viewState(), live = !S.fixed && !S.offsetMs && !S.playing && (S.mode === 'clock' || S.mode === 'chart');   // the live sky moves by the second: within the two minutes an image is kept, it is the same moment
    return [S.mode, live ? 'live' : st.date.getTime(), S.sigil, S.algol, S.field, S.natal && S.natal.id, S.pair, S.lang].join('|'); };
  function setShare(state) {
    shareState = state; const i = SD.i18n, bar = $('share');
    document.querySelectorAll('.share-btn').forEach(b => { b.classList.toggle('busy', state === 'busy'); b.classList.toggle('ready', state === 'ready'); b.setAttribute('aria-label', i.t(state === 'ready' ? 'ui.tapToShare' : 'ui.share')); });
    if (bar && !bar.dataset.busy) bar.textContent = i.cap1(i.t(state === 'ready' ? 'ui.tapToShare' : state === 'busy' ? 'ui.preparing' : 'ui.shareBtn'));
    bar && bar.classList.toggle('ready', state === 'ready'); bar && bar.classList.toggle('busy', state === 'busy');
  }
  async function makeShare() {
    const st = viewState(), cv = document.createElement('canvas'); cv.width = cv.height = 1080;
    SD.render.render(cv.getContext('2d'), st, 1080, (performance.now() - t0) / 1000, renderOpts());
    const c = SD.render.captionLines(st), plain = t => String(t || '').replace(/<[^>]+>/g, '');
    const text = [plain(c.state), plain(c.label)].filter(Boolean).join(' · '), url = 'https://siderarium.com/app/';
    const blob = await new Promise(r => cv.toBlob(r, 'image/png'));
    return { key: shareKey(), at: Date.now(), blob, name: fileName(st), text, url };
  }
  async function doShare(p) {
    try {
      const file = new File([p.blob], p.name, { type: 'image/png' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) { await navigator.share({ files: [file], title: 'Siderarium', text: `${p.text} · ${p.url}` }); return 'shared'; }
      if (navigator.share) { await navigator.share({ title: 'Siderarium', text: p.text, url: p.url }); return 'shared'; }
    } catch (e) { if (e && e.name === 'AbortError') return 'cancel'; if (e && e.name === 'NotAllowedError') return 'needTap'; }
    await downloadBlob(p.blob, p.name);
    try { await navigator.clipboard.writeText(`${p.text} · ${p.url}`); } catch (e) { /* the image is saved all the same */ }
    return 'saved';
  }
  async function shareArt() {
    if (shareState === 'busy') return;
    if (shareReady && shareReady.key === shareKey() && Date.now() - shareReady.at < 120000) {   // the second tap: the image is ready, share now
      const p = shareReady; shareReady = null; setShare(''); if ((await doShare(p)) === 'needTap') { shareReady = p; setShare('ready'); }
      return;
    }
    shareReady = null; setShare('busy'); await nextPaint();
    const t = performance.now(); let p;
    try { p = await makeShare(); } catch (e) { setShare(''); return; }
    if (performance.now() - t > 3500) { shareReady = p; setShare('ready'); return; }   // the tap's few seconds are spent: one more tap
    setShare('');
    if ((await doShare(p)) === 'needTap') { shareReady = p; setShare('ready'); }
  }
  const download = (cv, name) => new Promise(r => cv.toBlob(async b => { await downloadBlob(b, name); r(); }, 'image/png'));
  async function exportPNG(px) {
    const st = viewState(), cv = document.createElement('canvas');
    cv.width = cv.height = px;
    SD.render.render(cv.getContext('2d'), st, px, (performance.now() - t0) / 1000, renderOpts({ fieldRes: px >= 3000 ? 420 : 300, groundEl: S.groundEl }));
    await download(cv, fileName(st, px > 2048 ? String(px) : ''));
    return SD.i18n.t('ui.savedFile');
  }
  /* a wallpaper at this screen's size: the square render set in a portrait field of the same ground */
  async function exportWallpaper() {
    const st = viewState(), dpr = window.devicePixelRatio || 1;
    const W = Math.round((screen.width || 1080) * dpr), H = Math.round((screen.height || 2340) * dpr);
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    SD.render.renderWallpaper(cv.getContext('2d'), st, W, H, 3, renderOpts());
    await download(cv, fileName(st, 'wallpaper'));
    return SD.i18n.t('ui.savedFile');
  }

  const ordinalWord = n => n + (n % 100 >= 11 && n % 100 <= 13 ? 'th' : ['th', 'st', 'nd', 'rd'][n % 10] || 'th');

  /* ---------- the readout: one reading system for the four views (DESIGN.md, "The readout system") ----------
     A section opens with its answer: a 20 px title, a 17 px standfirst. The evidence follows as rows, one fact a row;
     reference folds away under a summary that names what is inside; every note of method sits behind a labelled pill
     that opens a pop-up. Each section is one element carrying data-sec, so a re-render replaces only what changed and
     an open fold stays open. Astrology first, tarot and Kabbalah last; the Transits tab holds only the transits. */
  const kvTable = rows => { const r = rows.filter(x => x && x[1]); return r.length ? `<table class="kv">${r.map(([k, v]) => `<tr><th scope="row">${k}</th><td>${v}</td></tr>`).join('')}</table>` : ''; };
  const rankList = (items, cls, start) => items.length ? `<ol class="rank${cls ? ' ' + cls : ''}"${start ? ` start="${start}"` : ''}>${items.map(x => x.grp ? `<li class="grp">${x.grp}</li>`
    : `<li${x.tone ? ` class="asp-${x.tone}"` : ''}><span class="nm">${x.name}</span><span class="n">${x.n || ''}</span>${(x.meta || []).filter(Boolean).map(m => `<span class="meta">${m}</span>`).join('')}</li>`).join('')}</ol>` : '';
  const secOf = (view, key, inner, attrs) => `<section class="rs" data-sec="${view}.${key}"${attrs || ''}>${inner}</section>`;
  const pillRow = (...b) => { const x = b.filter(Boolean); return x.length ? `<p class="pills">${x.join('')}</p>` : ''; };
  const signed = (x, d) => (x > 0 ? '+' : x < 0 ? '\u2212' : '') + Math.abs(x).toFixed(d || 0);   // a true minus sign
  const cardLink = (key, name) => `<a class="g card" data-g="${key}" href="#g-${key}">${name}</a>`;
  const SIGN_TRUMP = [4, 5, 6, 7, 8, 9, 11, 13, 14, 15, 17, 18], PLANET_TRUMP = { saturn: 21, jupiter: 10, mars: 16, sun: 19, venus: 3, mercury: 1, moon: 2 };
  const trumpLink = n => cardLink('trump_' + n, SD.tikkun.major(n));
  const decanLink = d => cardLink(`card_${d.suit}${d.num}`, SD.i18n.card(d));
  const fmtIn = (d, tz, o) => new Intl.DateTimeFormat(SD.i18n.locale(), Object.assign({ timeZone: tz || 'UTC' }, o)).format(d);
  const dayIn = (d, tz) => fmtIn(d, tz, { day: 'numeric', month: 'short' });                         // no weekday: "Sun 25 Oct" would link the Sunday to the Sun
  const hmIn = (d, tz) => fmtIn(d, tz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const timeTag = (d, txt) => `<time class="nolink" datetime="${d.toISOString()}">${txt}</time>`;
  const aspKeyHtml = () => { const R = k => SD.i18n.t('ui.r.' + k); return `<p class="asp-key nolink"><span class="asp asp-flow">${R('aspFlow')}</span><span class="asp asp-tension">${R('aspTension')}</span><span class="asp asp-afflict">${R('aspAfflict')}</span></p>`; };
  const PETAL = 'M5 7C9 1 17 1 21 7C17 13 9 13 5 7Z';
  const roseKeyHtml = (a, b) => { const K = k => SD.i18n.t('ui.r.roseKey')[k];
    return `<p class="rose-key"><span class="k"><svg viewBox="0 0 26 14" aria-hidden="true"><path class="pe pe-h" d="${PETAL}"/></svg>${K(a)}</span><span class="k"><svg viewBox="0 0 26 14" aria-hidden="true"><path class="pe pe-s" d="${PETAL}"/></svg>${K(b)}</span><span class="k"><svg viewBox="0 0 26 14" aria-hidden="true"><path class="pe pe-h" d="M1 7C5 1 13 1 17 7C13 13 5 13 1 7Z"/><path class="pe pe-s" d="M9 7C13 1 21 1 25 7C21 13 13 13 9 7Z"/></svg>${K('overlap')}</span></p>`; };

  /* paint: the first paint of a view sets every section; a later one replaces only the sections whose html changed, links
     each one's terms (drawn once a section), restores its open folds and re-points an open pop-up to its new trigger */
  const openSecs = new Set(store.get('openSecs', []));
  const painted = { view: null, keys: '', html: new Map() };
  const restoreOpen = el => { const all = [...el.querySelectorAll('details[data-sec]')]; if (el.matches && el.matches('details[data-sec]')) all.push(el); for (const d of all) if (openSecs.has(d.dataset.sec)) d.open = true; };
  const linkSection = el => { glossaryTerms(); try { SD.glossary.link(el, SD.i18n.locale().startsWith('es') ? 'es' : 'en', { marks: true }); } catch (e) { /* the glossary is a nicety */ } };
  let toggleBound = false;
  const focusOf = host => {                                 // the focused control inside host, found again after a repaint
    const a = document.activeElement; if (!a || a === document.body || !host.contains(a)) return null;
    const sel = a.id ? '#' + a.id : a.dataset.act ? `[data-act="${a.dataset.act}"]` : a.dataset.def ? `[data-def="${a.dataset.def}"]` : a.dataset.tal ? `[data-tal="${a.dataset.tal}"]` : a.dataset.go ? `[data-go="${a.dataset.go}"]`
      : a.tagName === 'SUMMARY' && a.parentElement.dataset.sec ? `details[data-sec="${a.parentElement.dataset.sec}"] > summary` : a.dataset.g ? `a.g[data-g="${a.dataset.g}"]` : null;
    if (!sel) return null; const nth = [...host.querySelectorAll(sel)].indexOf(a);
    return el => { const n = [...el.querySelectorAll(sel)][nth] || el.querySelector(sel); if (n) n.focus({ preventScroll: true }); };
  };
  function paintReadout(view, parts) {
    parts = parts.map(([k, h]) => [k, h.replace(/ · /g, '\u00a0· ')]);   // a separator ends its line, never starts the next
    const ro = $('readout'), keys = parts.map(p => p[0]).join('|');
    if (!toggleBound) {                                      // 'toggle' does not bubble: caught on the way down, kept for the next visit
      toggleBound = true;
      ro.addEventListener('toggle', e => { const d = e.target; if (!d.dataset || !d.dataset.sec) return; if (d.open) openSecs.add(d.dataset.sec); else openSecs.delete(d.dataset.sec); store.set('openSecs', [...openSecs]); }, true);
    }
    let full = view !== painted.view || keys !== painted.keys;
    if (!full) for (const [k, html] of parts) {
      if (painted.html.get(k) === html) continue;
      const old = ro.querySelector(`:scope > [data-sec="${view}.${k}"]`), t = document.createElement('template'); t.innerHTML = html.trim();
      const el = t.content.firstElementChild; if (!old || !el) { full = true; break; }
      const back = focusOf(old); old.replaceWith(el); linkSection(el); restoreOpen(el); painted.html.set(k, html); if (back) back(el);
    }
    if (full) {
      if (view !== painted.view) ro.scrollTop = 0;            // a new view starts at its top (the desktop column scrolls on its own)
      ro.innerHTML = parts.map(p => p[1]).join('\n');
      Object.assign(painted, { view, keys, html: new Map(parts) }); ro.dataset.view = view;
      for (const el of ro.children) { linkSection(el); restoreOpen(el); }
    }
    if (SD.app_pop) SD.app_pop.repoint();
  }
  /* one section painted alone, the same way (the talismans' search repaints its section as it goes) */
  function paintSection(view, key, html) {
    html = html.replace(/ · /g, '\u00a0· ');
    const ro = $('readout'); if (painted.view !== view || !painted.html.has(key) || painted.html.get(key) === html) return;
    const old = ro.querySelector(`:scope > [data-sec="${view}.${key}"]`), t = document.createElement('template'); t.innerHTML = html.trim();
    const el = t.content.firstElementChild; if (!old || !el) return;
    const back = focusOf(old); old.replaceWith(el); linkSection(el); restoreOpen(el); painted.html.set(key, html); if (back) back(el);
    if (SD.app_pop) SD.app_pop.repoint();
  }

  function updateReadout() {
    const st = viewState();
    if (S.mode === 'pair' && st && (st.pair || st.pairMissing)) { paintReadout('pair', pairParts(st)); return; }
    const C = SD.corr, i = SD.i18n, R = k => i.t('ui.r.' + k), H = k => i.cap1(i.t('ui.h.' + k)), K = k => i.t('ui.kv.' + k);
    const P = k => i.planet(k), A = k => i.aspect(k), E = SD.engine;
    const view = st.transits ? 'transits' : st.natalView ? 'natal' : 'clock', sec = (key, inner, attrs) => secOf(view, key, inner, attrs);
    const noTime = st.natalView && S.natal && S.natal.unknownTime, tz = st.loc.tz || 'UTC', hm = d => hmIn(d, tz);
    const tone = a => E.aspectTone(a.aspect, a.a, a.b, a.orb) || '';
    const motion = a => i.cap1(a.applying ? R('applying') : R('separating'));
    const evName = e => i.event(e) !== e ? i.event(e) : e.split(' ').map(w => i.event(w)).join(' ');   // whole names first: 'new moon', 'lunar eclipse'
    const deg = lon => { const d = E.norm360(lon) % 30; return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′`; };
    const sgnOf = lon => Math.floor(E.norm360(lon) / 30);

    // ---- the moment (the clock) and the birth moment: operations, mode, realm, angel, sect; then the sound
    const momentRows = () => kvTable([
      [K('operations'), i.state(st.title.state)],
      [K('mode'), `${i.cap1(i.window(st.title.mode))} (${K('mother')[st.title.mode]})`],
      [K('realm'), noTime ? '' : `${i.house12(st.title.house)} (${R('house')}\u00a0${i.roman(st.title.house)})`],   // without a birth time the noon's house, hour and sect are not the native's
      [K('angelHour'), noTime ? '' : i.name(st.hour.angel)],
      [K('sect2'), noTime ? '' : K('sect')[st.sect]]]);
    const speak = () => `<button type="button" class="speak${audio.on ? ' on' : ''}" data-act="listen" aria-pressed="${audio.on}" aria-label="${esc(i.cap1(i.t('ui.listenChord')))}" title="${esc(i.t(audio.on ? 'ui.listening' : 'ui.listen'))}">${SPEAKER}</button>`;   // the chord of this view: the birth chart's here, the sky's in the Clock
    const ch = st.chord, soundRows = () => kvTable([
      [K('chord'), ch && ch.name && ch.name !== 'none' ? `${i.chordLong(ch)}${ch.interval ? ', ' + i.interval(ch.interval) : ''}\u00a0${speak()}` : ''],
      [K('notes'), ch.notes.length ? `${ch.notes.map(n => i.note(n)).join(' ')}${ch.planets ? `, ${R('from')} ${ch.planets.map(P).join(', ')}` : ''}` : ''],
      [K('moonNote'), ch.moonNote ? i.note(ch.moonNote) : ''],
      [K('ground'), ch.ground && ch.ground.length ? ch.ground.map(v => `${i.note(v.note)} (${P(v.planet)})`).join(', ') : ''],
      [K('nextChord'), !st.natalView && st.nextChord ? `${i.chordName(st.nextChord.to)} ${K('at')(hm(st.nextChord.at))}` : '']]);
    const birthWhen = () => {
      const n = S.natal, ntz = n.place.tz || 'UTC', d = new Date(n.date);
      const day = fmtIn(d, ntz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      const time = n.unknownTime ? i.t('ui.rep.noon') : fmtIn(d, ntz, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZoneName: 'short' });
      const place = esc(n.place.label || i.placeName(n.place.name));
      return n.unknownTime ? `${i.cap1(day)} · ${place}` : `${i.cap1(day)} · ${time} · ${place}`;
    };

    // ---- the bodies: name | degrees | sign | house, the condition on a second line; the angles; Algol
    const houseCol = !noTime, span = houseCol ? 4 : 3;
    const bRow = (name, lon, h, sub) => `<tr><th class="k" scope="row">${name}</th><td class="n">${deg(lon)}</td><td class="v">${i.sign(sgnOf(lon))}</td>${houseCol ? `<td class="n">${h ? i.roman(h) : ''}</td>` : ''}</tr>${sub ? `<tr class="sub"><td></td><td colspan="${span - 1}">${sub}</td></tr>` : ''}`;
    const condition = (k, b) => {
      const conds = [b.retro ? i.flag('retrograde') : '', b.station ? i.flag('stationary') : '', b.cazimi ? i.flag('cazimi') : b.combust ? i.flag('combust') : b.beams ? i.flag('beams') : '', b.oob ? i.flag('oob') : ''].filter(Boolean);
      if (C.PLANETS[k].kind === 'optic') return conds.length ? i.cap1(conds.join(', ')) : '';
      return `${i.cap1(b.dignity.labels.map(l => i.dignity(l)).join(', ') || '—')} (${signed(b.dignity.score)})${conds.length ? ' · ' + conds.join(', ') : ''}`;
    };
    const al = E.algol(st.date, st.loc);
    const alNote = al.eclipse > 0.3 ? i.cap1(R(st.natalView ? 'algolDimBirth' : 'algolDimNow')) : st.natalView ? '' : `${i.cap1(R('algolNext'))} ${timeTag(al.nextMin, `${dayIn(al.nextMin, tz)}, ${hm(al.nextMin)}`)}`;
    const bodiesHtml = () => {
      const head = `<tr class="head"><td></td><td colspan="2">${K('position')}</td>${houseCol ? `<td class="n">${K('house')}</td>` : ''}</tr>`;
      const rows = C.ORDER.map(k => bRow(P(k), st.bodies[k].lon, st.bodies[k].house, condition(k, st.bodies[k]))).join('');
      const angles = noTime ? '' : `<tr class="grp"><td colspan="${span}">${K('angles')}</td></tr>` + [['asc', st.asc, 1], ['ic', st.mc + 180, 4], ['dsc', st.asc + 180, 7], ['mc', st.mc, 10]].map(([k, lon, h]) => bRow(i.t('ui.r.angleName.' + k), lon, h)).join('');
      const algol = `<tr class="grp"><td colspan="${span}">${K('fixedStar')}</td></tr>` + bRow('Algol', al.lon, noTime ? 0 : E.houseIn(st.cusps, al.lon), alNote);
      const el = st.elements && !st.natalView ? `${i.cap1(K('elements'))}: ${st.elements.order.map(k => `${i.t('ui.el.' + k)}\u00a0${st.elements.pct[k]}%`).join(', ')}` : '';   // the sky's four, heaviest first; a birth chart's lead its caption, so its reading does not repeat them
      return sec('bodies', `<h3>${H('bodies')}</h3>${el ? `<p class="verdict">${el}</p>` : ''}<table class="bodies">${head}${rows}${angles}${algol}</table>
        <p class="ctl"><button class="toggle algol-toggle" data-act="algol" aria-pressed="${S.algol ? 'true' : 'false'}"><span class="sw" aria-hidden="true"></span><span>${i.cap1(R(S.algol ? 'algolShown' : 'algolShow'))}</span></button></p>`);
    };

    // ---- the aspects: the dial's figure and two rings first, then the rest by weight; the planets on the angles
    const aspectsHtml = () => {
      const cf = st.configs, dial = [cf.primary, ...cf.secondary].filter(Boolean);
      const ranked = [...dial, ...st.aspects.filter(a => !dial.some(d => d.a === a.a && d.b === a.b))].slice(0, 12);
      const items = ranked.map(a => { const n = dial.indexOf(a);
        return { tone: tone(a), name: `${P(a.a)} ${A(a.aspect)} ${P(a.b)}`, n: `${a.orb.toFixed(2)}°`,
          meta: [[motion(a), n < 0 ? '' : `${R(n ? 'ring' : 'figure')} {${a.n}/${a.k}}`, a.event ? evName(a.event) : '', a.dissociate ? i.flag('outOfSign') : ''].filter(Boolean).join(' · ')] }; });
      const angles = st.onAngles && st.onAngles.length ? [{ grp: i.cap1(R('onAngles')) }, ...st.onAngles.map(x => ({ tone: E.aspectTone('conjunction', x.planet, x.angle) || '', name: `${P(x.planet)} ${A('conjunction')} ${R('angle.' + x.angle)}`, n: `${x.orb.toFixed(2)}°` }))] : [];
      return sec('aspects', `<h3>${H('aspects')}</h3>${items.length ? aspKeyHtml() + rankList([...items, ...angles]) : `<p class="verdict">${i.cap1(i.t('ui.quietSky'))}</p>${rankList(angles)}`}`);
    };

    // ---- the Moon, the day and its hours, the events
    const m = st.moon;
    const conditionTxt = () => {
      const flags = m.flags.filter(f => f !== 'void of course').map(f => i.flag(f === 'under the beams' ? 'beams' : f));
      if (m.verdict === 'void') return `${i.cap1(i.flag('void of course'))}${m.tolerable ? `, ${i.t('cap.tolerable')(i.sign(st.bodies.moon.sign))}` : ''}${st.natalView ? '' : `: ${R('voidFit')}`}${flags.length ? '; ' + flags.join(', ') : ''}`;
      if (st.natalView) return `${m.next ? i.cap1(K('applyingTo')(A(m.next.aspect), m.next.planet, P(m.next.planet))) : i.cap1(i.verdict(m.verdict))}${flags.length ? '; ' + flags.join(', ') : ''}`;
      return `${i.cap1(i.verdict(m.verdict))}${m.next ? `: ${A(m.next.aspect)} ${P(m.next.planet)} ${R('in')} ${(m.next.days * 24).toFixed(1)}\u00a0h` : ''}${flags.length ? '; ' + flags.join(', ') : ''}`;
    };
    const veilTxt = () => { const f = st.veil.factors.filter(x => !(m.verdict === 'void' && /void/i.test(x.key))); return `${st.veil.v.toFixed(2)}${f.length ? ': ' + f.map(x => i.t('ui.veilOf.' + x.key)).join(', ') : ''}`; };
    const mansionTxt = `${i.ordinal(st.bodies.moon.mansion.index)}, ${i.name(st.bodies.moon.mansion.name)}`;
    const hourIdx = st.hour.index, table = st.hour.table;
    const hourTxt = () => { const h = table && table[hourIdx], nx = table && table[hourIdx + 1];
      return `${K('hourOf')(i.ordinal(hourIdx + 1), P(st.hour.hourRuler), st.hour.hourRuler)}, ${K('angelOf')(i.name(st.hour.angel))}${!st.natalView && h ? ` · ${hm(h.start)}–${nx ? hm(nx.start) : ''}` : ''}`; };
    const events = () => {
      const rows = st.events.map(e => [i.cap1(i.event(e.type === 'outer exact' ? 'exact' : e.type)), e.type === 'outer exact' && e.aspect ? `${P(e.aspect.a)} ${A(e.aspect.aspect)} ${P(e.aspect.b)}` : [e.planet ? P(e.planet) : '', e.kind ? evName(e.kind) : '', e.direction ? (K('turning')[e.direction] || i.event(e.direction)) : ''].filter(Boolean).join(', ')]);
      if (!st.natalView && st.wheel) rows.push([K('wheel'), `${st.wheel.today ? `${i.t('ui.wheel.' + st.wheel.today)} ${R('today')}, ` : ''}${i.t('ui.wheel.' + st.wheel.next)}, ${fmtIn(st.wheel.nextDate, 'UTC', { day: 'numeric', month: 'long' })}, ${R('inDays')(st.wheel.days)}`]);
      return rows.length ? `<h4>${st.natalView ? H('eventsBirth') : K('events')}</h4>${kvTable(rows)}` : '';
    };
    const dayHtml = () => {
      const moon = kvTable([[K('condition'), conditionTxt()], [K('guardians'), !st.natalView && m.verdict === 'void' ? i.cap1(`${K('the')(st.hour.dayRuler, P(st.hour.dayRuler))}${st.hour.dayRuler === st.hour.hourRuler ? '' : ' ' + R('and') + ' ' + K('the')(st.hour.hourRuler, P(st.hour.hourRuler))}`) : ''],
        [K('veil'), st.natalView ? '' : veilTxt()], [K('mansion'), mansionTxt]]);
      const day = kvTable([[K('day'), `${P(st.hour.dayRuler)}, ${K('angelOf')(i.name(st.hour.dayAngel))}`], [K('hour'), noTime ? '' : hourTxt()],
        [K('nextHour'), !st.natalView && table && table[hourIdx + 1] ? `${P(table[hourIdx + 1].ruler)}, ${K('at')(hm(table[hourIdx + 1].start))}` : '']]);
      const all = !st.natalView ? (table ? `<details class="more" data-sec="clock.hours"><summary>${K('all24')}</summary><ol class="hours">${table.map(h => `<li${h.index === hourIdx ? ' class="now"' : ''}><span class="i">${h.index + 1}</span><span>${P(h.ruler)}</span><span class="t">${hm(h.start)}</span></li>`).join('')}</ol></details>` : `<p class="note">${i.cap1(i.t('ui.polar'))}</p>`) : '';
      return sec('day', `<h3>${H(st.natalView ? 'dayNatal' : 'dayClock')}</h3><h4>${st.natalView ? H('moonBirth') : K('theMoon')}</h4>${moon}<h4>${st.natalView ? K('dayHourBirth') : K('dayHours')}</h4>${day}${all}${events()}`);
    };

    // ---- the tarot: what the card answers | the card (it opens its plate), its derivation beneath
    const tarotHtml = () => {
      const row = (label, card, sub) => `<tr><th class="k" scope="row">${label}</th><td class="card">${card}</td></tr><tr class="sub"><td></td><td>${sub}</td></tr>`;
      const dec = b => `${i.cap1(i.decanOrd(b.decan.decan))} ${i.t('cap.decanOf')} ${i.sign(b.sign)}, ${P(b.decan.ruler)}`, asc = sgnOf(st.asc);
      return sec('tarot', `<h3>${H('tarot')}</h3><table class="cards">${row(P('sun'), decanLink(st.bodies.sun.decan), dec(st.bodies.sun))}${row(P('moon'), decanLink(st.bodies.moon.decan), dec(st.bodies.moon))}${noTime ? '' : row(K('ascendant'), trumpLink(SIGN_TRUMP[asc]), i.sign(asc))}${row(K('day'), trumpLink(PLANET_TRUMP[st.hour.dayRuler]), P(st.hour.dayRuler))}${noTime ? '' : row(K('hour'), trumpLink(PLANET_TRUMP[st.hour.hourRuler]), P(st.hour.hourRuler))}</table>`);
    };

    // ---- the transits to a chart: one ranked list, the timing and the house beneath, the figure set off beneath that
    const inter = st.interaction, owner = (st.transitInfo && st.transitInfo.name) || '';
    const pt = k => C.PLANETS[k] ? P(k) : k === 'ascendant' ? i.t('ui.r.angleName.asc') : k === 'midheaven' ? i.t('ui.r.angleName.mc') : k;
    const natalPt = k => owner ? i.t('cap.own')(owner, pt(k)) : `${i.t('cap.natalOf')} ${pt(k)}`;
    const transitsHtml = () => {
      const all = st.transits || [], shown = all.slice(0, 8), tags = new Map(), same = (x, t, n, asp) => x.a === t && x.b === n && x.aspect === asp;
      for (const [n, f] of (inter ? inter.figures.slice(0, 6) : []).entries()) {
        const both = [all.find(x => same(x, f.t, f.a, f.x.aspect)), all.find(x => same(x, f.t, f.b, f.y.aspect))].filter(Boolean).sort((p, q) => q.power - p.power);
        const c = both.find(x => shown.includes(x)) || (n === 0 ? both[0] : null); if (!c) continue;
        if (!shown.includes(c)) shown.push(c);
        tags.set(c, (tags.get(c) || []).concat(f));
      }
      shown.sort((p, q) => q.power - p.power);
      const spans = (st.transitInfo && st.transitInfo.spans) || {}, houses = (st.transitInfo && st.transitInfo.houses) || {};
      const timing = a => { const sp = spans[a.a + '|' + a.b + '|' + a.aspect]; if (!sp) return '';
        return [sp.exact ? `${i.t(sp.exact.getTime() < st.date.getTime() - 3600e3 ? 'cap.wasExact' : 'cap.exact')} ${timeTag(sp.exact, `${dayIn(sp.exact, tz)}, ${hm(sp.exact)}`)}` : '', sp.leave ? `${i.t('cap.untilOrb')} ${timeTag(sp.leave, dayIn(sp.leave, tz))}` : ''].filter(Boolean).join(' · '); };
      const house = a => houses[a.a] && owner ? `${P(a.a)} ${i.t('cap.inHouseOf')(owner, i.roman(houses[a.a]))}` : '';
      const figLine = f => `${i.cap1(R(f.tone))}: ${f.name === 'setOff' ? `${R('setsOff')} ${natalPt(f.a)} ${A(f.natalAspect)} ${P(f.b)}` : `${R('closes')} ${R('fig.' + f.name)} ${R('with')} ${natalPt(f.a)} ${A(f.natalAspect)} ${P(f.b)}`}`;
      const item = (a, full) => ({ tone: tone(a), name: `${P(a.a)} ${A(a.aspect)} ${natalPt(a.b)}`, n: `${a.orb.toFixed(2)}°`, meta: [[motion(a), full ? timing(a) : '', full ? house(a) : ''].filter(Boolean).join(' · '), ...(full ? (tags.get(a) || []).map(figLine) : [])] });
      const rest = all.filter(a => !shown.includes(a));
      const head = owner ? i.cap1(i.t('ui.h.transitsTo')(owner)) : H('transits');
      const std = inter ? `<p class="verdict">${i.cap1(R('harmony'))} ${inter.harmony.toFixed(2)}, ${R('strife')} ${inter.strife.toFixed(2)}</p>` : '';
      return sec('transits', `<h3>${head}</h3>${std}${shown.length ? aspKeyHtml() + rankList(shown.map(a => item(a, true))) : `<p>${i.cap1(i.t('ui.noContact'))}</p>`}${rest.length ? `<details class="more" data-sec="transits.rest"><summary>${R('moreInOrb')(rest.length)}</summary>${rankList(rest.map(a => item(a, false)), '', shown.length + 1)}</details>` : ''}${inter && !inter.figures.length && shown.length ? `<p class="note">${i.cap1(R('noFigure'))}.</p>` : ''}`);
    };
    const roseHead = () => { const line = roseLine(st, true);
      return `<div class="r-head nolink" data-sec="transits.howto">${roseKeyHtml('easy', 'hard')}<p class="lede">${R('roseTransitsLine')} ${popBtn('roseTransits', R('howRose'))}</p>${line ? `<p class="note">${i.cap1(line)}.</p>` : ''}</div>`; };
    const stoneHtml = () => st.stone ? sec('stone', `<h3>${H('stone')}</h3><p class="verdict">${i.cap1(i.stone(st.stone.stone))}${st.stone.alternative ? ` ${i.t('cap.or')} ${i.stone(st.stone.alternative)}` : ''}</p><p class="note">${i.cap1(i.t('cap.stonesOf')(st.stone.planet, P(st.stone.planet)))}, ${i.t('cap.stoneRule.' + st.stone.rule)}${st.stone.why ? ` ${P(st.stone.why.a)} ${A(st.stone.why.aspect)} ${natalPt(st.stone.why.b)}` : ''}</p>${pillRow(popBtn('stone', R('howStone')))}`) : '';

    // ---- the parts of each view, in order
    const parts = [];
    const add = (key, html) => { if (html) parts.push([key, html]); };
    if (view === 'transits') {
      add('howto', roseHead()); add('transits', transitsHtml()); add('stone', stoneHtml());
      add('out', `<p class="out" data-sec="transits.out">${R('outLead')} <button type="button" data-go="clock">${R('openClock')}</button></p>`);
    } else if (view === 'natal') {
      const notes = [noTime ? R('timeUnknown') : '', st.relocated ? R('housesFrom')(esc(i.placeName(st.relocated))) : ''].filter(Boolean).map(x => `<p class="note">${x}</p>`).join('');
      add('birth', sec('birth', `<h3>${H('birth')}</h3><p class="verdict">${birthWhen()}</p>${notes}${momentRows()}<h4>${K('sound')}</h4>${soundRows()}`));
      add('bodies', bodiesHtml()); add('aspects', aspectsHtml());
      if (st.temperament) add('temperament', temperamentHtml(st));
      add('day', dayHtml()); add('tarot', tarotHtml());
      if (st.tikkun) add('kabbalah', kabbalahHtml(st));
    } else {
      add('moment', sec('moment', `<h3>${H('moment')}</h3>${momentRows()}<h4>${K('sound')}</h4>${soundRows()}`));
      add('bodies', bodiesHtml()); add('aspects', aspectsHtml()); add('day', dayHtml());
      add('talismans', talismansHtml()); add('tarot', tarotHtml());
    }
    paintReadout(view, parts);
    if (view === 'clock') talismansKick();
  }

  /* ---------- the reading of a pair: the rose, the three ties, the contacts, what is active now, the pair's chart,
     the house overlays, and the two charts side by side, folded. With no second chart, only the way to choose one */
  function pairParts(st) {
    const C = SD.corr, i = SD.i18n, R = k => i.t('ui.r.' + k), H = k => i.cap1(i.t('ui.h.' + k)), K = k => i.t('ui.kv.' + k), P = k => i.planet(k), A = k => i.aspect(k);
    const sec = (key, inner) => secOf('pair', key, inner);
    if (st.pairMissing || !st.natal) return [['empty', `<div class="r-head" data-sec="pair.empty"><p class="lede">${R('pairEmpty')}</p><p><button type="button" class="cta" data-go="pick-second">${R('chooseSecond')}</button></p></div>`]];
    const a = st, b = st.natal, pr = st.pair, own = (who, what) => i.t('cap.own')(who, what), Y = st.syn, inter = st.interaction, parts = [];
    const nt = pr.noTime || [], blind = !!(nt[0] || nt[1]);   // a chart without a birth time has no houses or angles
    const add = (key, html) => { if (html) parts.push([key, html]); };
    // the rose
    { const line = roseLine(st);
      add('rose', `<div class="r-head nolink" data-sec="pair.rose">${roseKeyHtml('harmony', 'strife')}<p class="lede">${R('roseLine')} ${popBtn('rose', R('howRose'))}</p>${line ? `<p class="note">${i.cap1(line)}.</p>` : ''}</div>`); }
    // the three ties: the relationship first (it changes them), then each tie's makers, signed
    if (Y) {
      const types = ['partner', 'friend', 'colleague', 'parent', 'sibling', 'other'], cur = pairTypeOf(pr.ids[0], pr.ids[1]);
      const rel = `<p class="rel nolink"><label>${i.cap1(i.t('ui.rel.label'))} <select id="pair-type">${types.map(t => `<option value="${t}"${t === cur ? ' selected' : ''}>${i.t('ui.rel.' + t)}</option>`).join('')}</select></label>${Y.age.forced ? ` <span class="dim">${i.t('ui.rel.forced')}</span>` : ''}</p>`;
      const scales = SD.render.tieScale(st), keys = ['friendship', 'business', 'pleasure'];
      const ties = keys.map((k, n) => { const g = scales[n] || {}, makers = Y.cats[k].contacts.map(c => ({ name: contactWords(c, pr), n: signed(+(c.h - c.s).toFixed(2), 2) }));
        return `<h4>${i.cap1(SD.render.catName(Y, k))}${g.word ? ` <span class="hv">· ${g.word}</span>` : ''}</h4>${makers.length ? rankList(makers, 'plain') : `<p class="note">${i.cap1(i.t('ui.catWord.neutral'))}</p>`}`; }).join('');
      add('ties', sec('ties', `<h3>${H('ties')}</h3>${rel}${pillRow(popBtn('ties', R('howTies')))}${ties}`));
    }
    // the contacts, the figures they set off on the line beneath
    if (Y) {
      const cTone = c => { const t = c.h + c.s; if (c.x > 0 || !t) return c.x > 0 ? 'tension' : ''; const r = c.h / t; return r >= 0.6 ? 'flow' : r > 0.4 ? 'tension' : ['mars', 'saturn', 'pluto'].some(m => m === c.a || m === c.b) ? 'afflict' : 'tension'; };
      const figs = inter ? inter.figures.slice(0, 6) : [], tagFor = new Map();
      for (const f of figs) { const c = Y.contacts.find(x => !x.rev && !x.place && x.a === f.t && (x.b === f.a || x.b === f.b)); if (c) tagFor.set(c, (tagFor.get(c) || []).concat(f)); }
      const figLine = f => `${i.cap1(R(f.tone))}: ${f.name === 'setOff' ? `${R('setsOff')} ${own(pr.b, P(f.a))} ${A(f.natalAspect)} ${P(f.b)}` : `${R('closes')} ${R('fig.' + f.name)} ${R('with')} ${own(pr.b, P(f.a))} ${A(f.natalAspect)} ${P(f.b)}`}`;
      const item = (c, full) => ({ tone: cTone(c), name: contactWords(c, pr), n: `${c.orb.toFixed(2)}°`, meta: [[c.discounted ? i.cap1(R('discounted')) : '', c.uncertain ? i.t('cap.syn.uncertain') : ''].filter(Boolean).join(' · '), ...(full ? (tagFor.get(c) || []).map(figLine) : [])] });
      const top = Y.contacts.slice(0, 10), rest = Y.contacts.slice(10);
      add('contacts', sec('contacts', `<h3>${H('contacts')}</h3><p class="verdict">${i.cap1(R('harmony'))} ${Y.harmony.toFixed(2)}, ${R('strife')} ${Y.strife.toFixed(2)}, ${R('adjustment')} ${Y.adjustment.toFixed(2)}</p>${pillRow(popBtn('pair', R('aboutContacts')))}${top.length ? aspKeyHtml() + rankList(top.map(c => item(c, true))) : `<p>${i.cap1(i.t('ui.noContact'))}</p>`}${rest.length ? `<details class="more" data-sec="pair.rest"><summary>${R('moreContacts')(rest.length)}</summary>${rankList(rest.map(c => item(c, false)), '', 11)}</details>` : ''}`));
    }
    // what is active now: each transiting planet on the pair's points, its exact passes and stations
    { const act = st.synActive || [];
      if (act.length) {
        const d = dt => timeTag(dt, fmtIn(dt, st.loc.tz, { day: 'numeric', month: 'short', year: 'numeric' }));
        const who = h => h.who === 'a' ? pr.a : pr.b, ptOf = k => C.PLANETS[k] ? P(k) : k === 'ascendant' ? i.t('ui.r.angleName.asc') : k === 'midheaven' ? i.t('ui.r.angleName.mc') : SD.tikkun.text().north;
        const items = act.map(x => { const [h0, ...more] = x.hits;
          const axes = [...new Set(x.hits.flatMap(h => h.axes.filter(c => c.aspect === 'opposition' || c.aspect === 'conjunction' || c.aspect === 'square').slice(0, 1).map(c => contactWords(c, pr))))];
          return { tone: SD.engine.aspectTone(h0.aspect, x.planet, h0.key, h0.orb) || '', name: `${P(x.planet)} ${A(h0.aspect)} ${own(who(h0), ptOf(h0.key))}`, n: `${h0.orb.toFixed(2)}°`,
            meta: [more.length ? i.cap1(`${R('also')} ${more.map(h => `${A(h.aspect)} ${own(who(h), ptOf(h.key))}, ${h.orb.toFixed(1)}°`).join('; ')}`) : '',
              `${i.cap1(R('exactPasses'))} ${x.exact.map(d).join(', ') || '—'}${x.stations.length ? ` · ${R('stations')} ${x.stations.map(d).join(', ')}` : ''}`,
              axes.length ? i.cap1(`${R('onAxis')} ${axes.join(' · ')}`) : ''] }; });
        add('active', sec('active', `<h3>${H('active')}</h3>${rankList(items)}`));
      } }
    // the pair's chart
    { const c = st.composite;
      if (c) {
        const deg = lon => `${Math.floor(SD.engine.norm360(lon) % 30)}° ${i.sign(Math.floor(SD.engine.norm360(lon) / 30))}`, f = c.configs.primary;
        const std = f ? `${P(f.a)} ${A(f.aspect)} ${P(f.b)} {${f.n}/${f.k}}, ${R('orb')} ${f.orb.toFixed(2)}°` : i.cap1(i.t('ui.quietSky'));
        const kv = kvTable([[K('ascendant'), blind ? '' : deg(c.asc)], [K('midheaven'), blind ? '' : deg(c.mc)], [K('fortune'), blind ? '' : deg(c.fortune)], [K('element'), c.elements ? `${i.t('ui.el.' + c.elements.dominant)}\u00a0${c.elements.pct[c.elements.dominant]}%` : '']]);
        const pos = C.ORDER.map(k => { const x = c.bodies[k], d = x.deg % 30; return `<tr><th class="k" scope="row">${P(k)}</th><td class="n">${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′</td><td class="v">${i.sign(x.sign)}</td><td class="n">${i.roman(x.house)}</td></tr>`; }).join('');
        add('composite', sec('composite', `<h3>${H('composite')}</h3><p class="verdict">${std}</p>${kv}${pillRow(popBtn('composite', R('howComposite')))}<details class="more" data-sec="pair.positions"><summary>${K('positions')}</summary><table class="bodies">${pos}</table></details>`));
      } }
    // the house overlays: two rows
    if (Y && Y.overlays && Y.overlays.length) {
      const row = w => Y.overlays.filter(o => o.who === w).map(o => `${P(o.planet)}\u00a0${i.roman(o.house)}${o.unseen ? ` (${R('unseenShort')})` : ''}`).join(', ');
      add('overlays', sec('overlays', `<h3>${H('overlays')}</h3>${kvTable([[R('inHouses')(esc(pr.a), esc(pr.b)), row('a')], [R('inHouses')(esc(pr.b), esc(pr.a)), row('b')]])}`));
    }
    // the two charts, folded
    { const when = (x, no) => `${fmtIn(x.date, x.loc.tz, no ? { day: 'numeric', month: 'short', year: 'numeric' } : { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })}<br>${esc(i.placeName(x.loc.name))}`;   // no birth time: the date alone
      const pos = (x, no) => `${Math.floor(x.deg % 30)}°${String(Math.floor(((x.deg % 30) % 1) * 60)).padStart(2, '0')}′ ${i.sign(x.sign).slice(0, 3)}${no ? '' : ' · ' + i.roman(x.house)}`;
      const angle = (l, no) => no ? '—' : `${Math.floor(SD.engine.norm360(l) % 30)}° ${i.sign(Math.floor(SD.engine.norm360(l) / 30))}`;
      const elem = x => x.elements ? `${i.t('ui.el.' + x.elements.dominant)}\u00a0${x.elements.pct[x.elements.dominant]}%` : '—';
      const of = st.ownFigures || {}, figOf = f => f ? `${P(f.a)} ${A(f.aspect)} ${P(f.b)} {${f.n}/${f.k}}` : i.cap1(i.t('ui.quietSky'));
      const sect = x => x.sect === 'day' ? R('dayChartShort') : R('nightChartShort');
      const rows = [[K('born'), when(a, nt[0]), when(b, nt[1])], [K('ascendant'), angle(a.asc, nt[0]), angle(b.asc, nt[1])], [K('midheaven'), angle(a.mc, nt[0]), angle(b.mc, nt[1])], ...C.ORDER.map(k => [P(k), pos(a.bodies[k], nt[0]), pos(b.bodies[k], nt[1])]), [K('element'), elem(a), elem(b)], [K('figure'), figOf(of.a), figOf(of.b)], [K('sect2'), i.cap1(sect(a)), i.cap1(sect(b))]];
      const summary = `${esc(pr.a)}, ${sect(a)}, ${a.elements ? i.t('ui.el.' + a.elements.dominant) : ''} · ${esc(pr.b)}, ${sect(b)}, ${b.elements ? i.t('ui.el.' + b.elements.dominant) : ''}`;
      add('charts', sec('charts', `<details class="fold" data-sec="pair.chartsFold"><summary><h3>${H('charts')}</h3><span class="s">${summary}</span></summary><table class="pair"><tr class="head"><td></td><td>${esc(pr.a)}</td><td>${esc(pr.b)}</td></tr>${rows.map(([k, x, y]) => `<tr><th scope="row">${k}</th><td>${x}</td><td>${y}</td></tr>`).join('')}</table></details>`)); }
    return parts;
  }
  /* the rose in words: its leading symmetries and their share of the weight */
  function roseLine(st, transits) {
    const i = SD.i18n, R = k => i.t('ui.r.' + k), rs = SD.render.roseSummary(st); if (!rs) return '';
    const top = rs.folds.filter((f, k) => k === 0 || f.share >= 0.15).slice(0, 2).map(f => `${R('fold')[f.n]} (${Math.round(100 * f.share)}%)`);
    return i.t(transits ? 'ui.r.roseTransitsIs' : 'ui.r.roseIs')(rs.n, top.join(i.locale().startsWith('es') ? ', y ' : ', and '));
  }
  /* a contact between the two charts in words, whichever way it runs */
  function contactWords(x, pr) {
    const i = SD.i18n, C = SD.corr, P = k => i.planet(k), own = (who, what) => i.t('cap.own')(who, what);
    const pt = k => C.PLANETS[k] ? P(k) : k === 'ascendant' ? i.t('ui.r.angleName.asc') : k === 'midheaven' ? i.t('ui.r.angleName.mc') : k === 'node' ? SD.tikkun.text().north : k;
    if (x.place) return `${i.t('ui.r.byPlace')}: ${i.t('ui.r.place.' + x.place)}`;
    if (x.b === 'house') { const [who, whose] = x.rev ? [pr.b, pr.a] : [pr.a, pr.b]; return `${own(who, P('mars'))} ${i.t('ui.r.inThe')} ${own(whose, i.t('ui.r.house58'))}`; }
    const [first, second] = x.rev ? [pr.b, pr.a] : [pr.a, pr.b];
    return `${own(first, pt(x.a))} ${i.aspect(x.aspect)} ${own(second, pt(x.b))}`;
  }
  /* the three ties as scales, in the caption: a hairline with a tick wherever the word changes, a dot at the score, the word
     under the dot in its colour; warm for antipathy, neutral for none, cool for sympathy */
  function tieScales(st) {
    const i = SD.i18n; if (!st.syn && !st.ties) return '';
    return `<div class="scales">${SD.render.tieScale(st).map(g => `<div class="scale"><span class="sl">${i.cap1(g.label)}</span><div class="sline">${g.ticks.map(x => `<i style="left:${(x * 100).toFixed(1)}%"${x === 0.5 ? ' class="mid"' : ''}></i>`).join('')}<b style="left:${(g.pos * 100).toFixed(1)}%;background:${g.color}"></b></div><span class="sw" style="color:${g.color}">${g.word}</span></div>`).join('')}</div>`;
  }
  /* a transiting outer planet on a synastry point, as one line of the pair's report: the hit, the axis it belongs to, the exact passes and the stations */
  function activeLine(x, st) {
    const i = SD.i18n, pr = st.pair, P = k => i.cap1(i.planet(k)), A = a => i.aspect(a), d = dt => new Intl.DateTimeFormat(i.locale(), { day: 'numeric', month: 'short', year: 'numeric', timeZone: st.loc.tz || 'UTC' }).format(dt);
    const who = h => h.who === 'a' ? pr.a : pr.b, pt = k => SD.corr.PLANETS[k] ? i.planet(k) : k === 'ascendant' ? 'ASC' : k === 'midheaven' ? 'MC' : SD.tikkun.text().north;
    const hits = x.hits.map(h => `${A(h.aspect)} ${i.t('cap.own')(who(h), pt(h.key))} ${h.orb.toFixed(1)}°`).join(' · ');
    const axes = [...new Set(x.hits.flatMap(h => h.axes.filter(c => c.aspect === 'opposition' || c.aspect === 'conjunction' || c.aspect === 'square').slice(0, 1).map(c => contactWords(c, pr))))].join(' · ');
    return `<p class="nolink">${P(x.planet)} ${hits}${axes ? ` <span class="dim">(${i.t('ui.r.onAxis')} ${axes})</span>` : ''}<br><span class="dim">${i.cap1(i.t('ui.r.exactOn'))} ${x.exact.map(d).join(', ') || '—'} · ${i.t('ui.r.stations')} ${x.stations.map(d).join(', ')}</span></p>`;
  }
  /* the report of a pair, for pasting into an interpreter: both charts' birth data, the three ties with their makers,
     the grade of harmony and strife, the pull, the composite, every contact */
  function pairReportText() {
    const st = S.state; if (!st || !st.pair) return null;
    const i = SD.i18n, C = SD.corr, R = k => i.t('ui.rep.' + k), P = k => i.cap1(i.planet(k)), A = k => i.aspect(k), pr = st.pair;
    const lonTxt = lon => { const L = ((lon % 360) + 360) % 360, sg = Math.floor(L / 30), d = L - sg * 30; return `${Math.floor(d)}°${String(Math.floor((d % 1) * 60)).padStart(2, '0')}′ ${i.sign(sg)} (${L.toFixed(2)}°)`; };
    const chartB = S.charts.find(c => c.id === S.pair), charts = [[pr.a, S.natal, st], [pr.b, chartB, st.natal]];
    const L = [];
    L.push(`# ${i.t('cap.synastryLabel')} · ${pr.a} × ${pr.b}`, '');
    L.push(R('pairIntro').replace('{houses}', S.houses), '');
    for (const [name, n, x] of charts) {
      if (!n) continue;
      const pp = placeParts(new Date(n.date), n.place.tz), off = offsetOf(n.place.tz, new Date(n.date));
      L.push(`## ${R('birth')} · ${name}`);
      L.push(`- ${R('local')}: ${pp.year}-${pp.month}-${pp.day} ${n.unknownTime ? R('noon') : pp.hour + ':' + pp.minute} (${n.place.tz}, ${off}) · ${R('utc')}: ${new Date(n.date).toISOString().replace('T', ' ').slice(0, 16)} UTC`);
      L.push(`- ${R('place')}: ${n.place.label || i.placeName(n.place.name)} · ${(+n.place.lat).toFixed(4)}, ${(+n.place.lon).toFixed(4)} · ${x.sect === 'day' ? R('dayChart') : R('nightChart')}`);
      L.push(`- ASC ${lonTxt(x.asc)} · MC ${lonTxt(x.mc)} · ${i.t('ui.r.fortune')} ${lonTxt(x.fortune)}`);
      L.push(`| ${R('planet')} | ${R('position')} | ${R('house')} | ${R('dignity')} |`, '|---|---|---|---|');
      for (const k of C.ORDER) { const b = x.bodies[k]; L.push(`| ${P(k)} | ${lonTxt(b.lon)} | ${i.roman(b.house)} | ${b.dignity.score >= 0 ? '+' : ''}${b.dignity.score} ${b.dignity.labels.join(', ')}${b.retro ? ' · ' + R('retrograde') : ''} |`); }
      L.push('');
    }
    const Y = st.syn, D = st.attraction, cap = SD.render.captionLines(st), plain = t => String(t || '').replace(/<[^>]+>/g, '');
    if (Y) {
      const ageTxt = Y.age.known ? Y.age.ages.map(a => Math.floor(a)).join(' / ') : '—';
      L.push(`## ${i.cap1(i.t('cap.synastryLabel'))}: ${plain(cap.state)}`);
      L.push(`- ${i.cap1(i.t('ui.rel.label'))}: ${i.t('ui.rel.' + (Y.type === 'family' ? 'parent' : Y.type))}${Y.age.forced ? ' · ' + i.t('ui.rel.forced') : ''} · ${i.t('ui.rel.ages')} ${ageTxt}`);
      L.push(`- ${plain(cap.title)}`);
      L.push(`- ${i.cap1(i.t('ui.r.harmony'))} ${Y.harmony.toFixed(2)} · ${i.t('ui.r.strife')} ${Y.strife.toFixed(2)} · ${i.t('ui.r.adjustment')} ${Y.adjustment.toFixed(2)} · balance ${Y.balance.toFixed(2)} · intensity ${Y.intensity.toFixed(2)}`);
      L.push(`- ${plain(cap.detail4)}`, `- ${plain(cap.pairLine)}`, `- ${i.t('cap.syn.temper.' + Y.temperWord)} (${Y.temper.toFixed(2)})`);
      for (const k of ['friendship', 'business', 'pleasure']) { const t = Y.cats[k]; L.push(`- ${i.cap1(SD.render.catName(Y, k))}: ${SD.render.tieScale(st).find(g => g.key === k).word}${t.contacts.length ? ' · ' + t.contacts.map(x => `${contactWords(x, pr)} ${x.h >= x.s ? '+' : '−'}${Math.abs(x.h - x.s).toFixed(2)}`).join('; ') : ''}`); }
      L.push('');
      if (Y.overlays) { L.push(`## ${i.cap1(i.t('ui.h.overlays'))}`); for (const o of Y.overlays) L.push(`- ${i.t('cap.own')(o.who === 'a' ? pr.a : pr.b, P(o.planet))} ${i.t('cap.inHouseOf')(o.who === 'a' ? pr.b : pr.a, i.roman(o.house))}${o.unseen ? ' · ' + i.t('ui.r.unseen') : ''}`); L.push(''); }
      if ((st.synActive || []).length) { L.push(`## ${i.cap1(i.t('ui.h.active'))}`); for (const x of st.synActive) L.push('- ' + plain(activeLine(x, st)).replace(/\s+/g, ' ')); L.push(''); }
    }
    { const rl = roseLine(st); if (rl) L.push(`## ${i.cap1(i.t('ui.h.rose'))}`, i.cap1(rl) + '.', ''); }
    const c = st.composite;
    if (c) {
      L.push(`## ${i.cap1(i.t('ui.h.composite'))}`);
      L.push(`${i.t('ui.r.compositeNote')}`, '');
      L.push(`- ASC ${lonTxt(c.asc)} · MC ${lonTxt(c.mc)} · ${i.t('ui.r.fortune')} ${lonTxt(c.fortune)}`);
      const f = c.configs.primary; if (f) L.push(`- ${i.cap1(i.t('ui.r.pairFigure'))}: ${P(f.a)} ${A(f.aspect)} ${P(f.b)} {${f.n}/${f.k}} · ${f.orb.toFixed(2)}°`);
      L.push(`| ${R('planet')} | ${R('position')} | ${R('house')} |`, '|---|---|---|');
      for (const k of C.ORDER) L.push(`| ${P(k)} | ${lonTxt(c.bodies[k].lon)} | ${i.roman(c.bodies[k].house)} |`);
      L.push('');
    }
    L.push(`## ${i.cap1(i.t('ui.h.contacts'))}`);
    L.push(`| ${R('pair')} | ${R('aspect')} | ${R('orb')} | ${R('power')} |`, '|---|---|---|---|');
    for (const x of (st.syn ? st.syn.contacts : st.transits)) L.push(`| ${contactWords(x, pr)}${x.discounted ? ' (' + i.t('ui.r.discounted') + ')' : ''}${x.uncertain ? ' (' + i.t('cap.syn.uncertain') + ')' : ''} | ${A(x.aspect)} | ${x.orb.toFixed(2)}° | ${(x.w !== undefined ? x.w : x.power).toFixed(2)} |`);
    L.push('');
    L.push(`— ${R('footer')} · siderarium.com · ${new Date().toISOString().slice(0, 16).replace('T', ' ')} UTC`);
    return { text: L.join('\n'), name: `${pr.a}-${pr.b}` };
  }

  /* the life mission: karma to mission, the engine, the conjunctions and threshold, the signs on the road, the aspect cards */
  /* the head of the natal reading: the mission in one line and one sentence */
  /* the long notes live in pop-ups: a labelled pill in the reading, the text on tap (DESIGN.md, "The readout system") */
  function noteText(k) {
    const i = SD.i18n, R = x => i.t('ui.r.' + x), TT = () => SD.temperament.text(), Y = S.state && S.state.syn, tp = () => (viewState() || {}).temperament;
    if (k.startsWith('humour.')) {                           // the humour's reading; with a mixture, how the humours mix, and Ficino's melancholy mixtures
      const t = k.slice(7), T = TT(), x = tp(), mix = x ? x.firsts.concat(x.seconds) : [t];
      return T.reading[t] + (mix.length > 1 ? `\n\n§ ${T.mixedIs}\n\n${T.mixed}${mix.includes('melancholic') ? '\n\n' + T.melancholyMix : ''}` : '');
    }
    const N = { roseTransits: () => R('roseTransitsNote'), rose: () => R('roseNote'), stone: () => R('stoneNote'),
      ties: () => R(Y && !Y.age.sexual ? 'tiesNoteFamily' : 'tiesNote'), composite: () => R('compositeNote'), pair: () => R('pairNote'),
      temperament: () => TT().intro, intemperance: () => TT().intemperanceNote, symbolic: () => SD.tikkun.text().symbolic.replace(/^[^:]+:\s*/, ''),
      talHow: () => i.t('ui.tal.how'), talSources: () => i.t('ui.tal.note'), cautionMars: () => i.t('ui.tal.cautionMars'), cautionSaturn: () => i.t('ui.tal.cautionSaturn') };
    return N[k] ? N[k]() : null;
  }
  const popBtn = (k, label) => `<button type="button" class="pill nolink" data-def="note:${k}" aria-expanded="false" aria-haspopup="dialog">${label}</button>`;
  /* the temperament (SD.temperament): what each testimony is, in words */
  function tempDetail(st, r) {
    const i = SD.i18n, TT = SD.temperament.text(), P = k => i.cap1(i.planet(k)), B = st.bodies;
    const phase = k => k === 'mercury' ? `, ${SD.engine.norm360(B.mercury.lon - B.sun.lon) > 180 ? TT.oriental : TT.occidental}` : '';   // Mercury's heat goes by his phase
    const placed = k => k === 'sun' ? `${P('sun')}, ${TT.season[Math.floor(B.sun.lon / 90)]}` : k === 'moon' ? `${P('moon')}, ${TT.quarter[Math.floor(st.moon.phaseAngle / 90)]}` : `${P(k)} ${TT.in} ${i.sign(B[k].sign)}`;
    switch (r.step) {
      case 'S1': return i.cap1(TT.season[r.season]);
      case 'S2': case 'S5': return i.sign(r.sign);
      case 'S3': return P(r.planet) + phase(r.planet);
      case 'S4': return P(r.planet) + phase(r.planet) + (r.shared > 1 ? `, ${TT.shared(r.shared)}` : '');
      case 'S6': return i.cap1(TT.quarter[r.quarter]);
      case 'S7': case 'S8': case 'S12': return placed(r.planet);
      case 'S9': return r.again ? i.cap1(TT.again[r.again]) : r.planet === 'northNode' ? TT.north : r.planet === 'southNode' ? TT.south : P(r.planet) + phase(r.planet);
      default: return `${r.aspect === 'conjunction' ? P(r.planet) + phase(r.planet) : placed(r.planet)} · ${i.aspect(r.aspect)} ${r.orb.toFixed(1)}°`;
    }
  }
  const tempNum = x => String(+(x / 12).toFixed(2));                 // the tallies are kept in twelfths
  /* the temperament: the verdict; the humour's reading and the method behind pills; the conditions of this chart; Ficino's
     regimen; the intemperance and the Lord of the Geniture; the testimonies folded under their tally */
  function temperamentHtml(st) {
    const i = SD.i18n, tp = st.temperament, TT = SD.temperament.text(), P = k => i.cap1(i.planet(k)), nm = t => TT.temp[t], R = k => i.t('ui.r.' + k);
    const hm = d => new Intl.DateTimeFormat(i.locale(), { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tp.tz || 'UTC' }).format(tp.tz ? d : new Date(d.getTime() + S.natal.place.lon / 15 * 3600e3));   // no zone: the local mean time of the longitude
    const many = tp.firsts.length > 1;
    const cite = v => { const m = v.match(/^(.*?)\s*\(([^()]*)\)$/); return m ? `${m[1]} <span class="sep">${m[2]}</span>` : v; };   // the chapter, quiet, after the value
    const regimen = t => `<h4>${TT.regimen}${many ? ` <span class="hv">· ${nm(t)}</span>` : ''}</h4>${kvTable(['call', 'colours', 'music', 'odours', 'places', 'stones'].map(k => [i.cap1(TT.reg[k]), i.cap1(cite(TT.regimens[t][k]))]))}`;
    const notes = [tp.polar ? TT.polar : '', tp.relocated ? TT.relocated : '',
      tp.day ? `${TT.dayRuns} ${tp.day.map((x, n) => `${SD.temperament.line(x.judgement)} ${n + 1 < tp.day.length ? TT.until(hm(x.to)) : TT.after(hm(x.from))}`).join('; ')}.` : ''].filter(Boolean).map(x => `<p class="note">${x}</p>`).join('');
    const contact = c => c.aspect === 'body' ? TT.contact.body(P(c.planet), `${c.orb.toFixed(1)}°`) : TT.contact[c.to](P(c.planet), i.aspect(c.aspect), `${c.orb.toFixed(1)}°`, c.aspect);
    const lg = tp.lordOfGeniture;
    const facts = kvTable([[tp.intemperate ? TT.excessOf(tp.intemperate.planets) : TT.intemperanceIs, tp.intemperate ? `${tp.intemperance.map(contact).join('; ')} ${popBtn('intemperance', R('lillyRule'))}` : ''],
      [TT.lordIs, lg ? `${TT.lordVal(P(lg.planet), lg.total)}${lg.participant ? '; ' + TT.participates(P(lg.participant), lg.totals[lg.participant]) : ''}` : '']]);
    const rows = tp.rows.map(r => `<tr><td>${TT.row[r.step]}<span class="det">${tempDetail(st, r)}</span></td><td class="v">${nm(r.temperament)}</td><td class="n">${(r.w / 12).toFixed(2)}</td></tr>`).join('');
    const c = tp.columns, cv = SD.temperament.TEMPS.includes(c.verdict) ? nm(c.verdict) : TT.q[c.verdict];
    const tally = `${TT.tally}: ${tp.rank.map(t => `${nm(t)} ${tempNum(tp.T[t])}`).join(', ')}`;
    return secOf('natal', 'temperament', `<h3>${i.cap1(i.t('ui.h.temperament'))}</h3>
      <p class="verdict">${i.cap1(SD.temperament.line(tp, tp.partial))}</p>
      ${pillRow(...tp.firsts.map(t => popBtn('humour.' + t, R('humourOf')(nm(t)))), popBtn('temperament', R('aboutMethod')))}${notes}
      ${tp.firsts.map(regimen).join('')}${facts}
      <details class="fold" data-sec="natal.testimonies"><summary><h4>${TT.testimonies}</h4><span class="s">${tally}</span></summary>
        <table class="temper"><tr class="head"><td></td><td>${i.cap1(TT.humour)}</td><td class="n">${i.cap1(TT.weight)}</td></tr>${rows}</table>
        <p class="note">${TT.columns(tempNum(c.hot), tempNum(c.cold), tempNum(c.moist), tempNum(c.dry), cv)}.${tp.columnsThird ? ' ' + TT.columnsThird(nm(tp.columnsThird)) : ''}</p></details>`);
  }
  /* the life mission (tikkun) and its cards, one section: the mission, the cards of the tikkun, the signs on the road folded
     under the cards that recur, the aspect cards. Every card name opens its plate; the role words open their definitions */
  function kabbalahHtml(st) {
    const i = SD.i18n, k = st.tikkun, T = SD.tikkun.text(), P = p => i.cap1(i.planet(p)), A = a => i.aspect(a), R = x => i.t('ui.r.' + x);
    const lt = l => `${T.name[l]} <span class="he" lang="he" dir="rtl">${SD.tikkun.GLYPH[l]}</span>, ${T.letter[l]}`;   // the name, the letter itself, what it depicts
    const dl = (key, word) => `<button type="button" class="deflink" data-def="${key}" aria-expanded="false">${word}</button>`;
    const hs = h => h ? `, ${i.roman(h)}` : '';
    const row = (a, card, sub) => `<tr><td>${a}</td><td class="card">${card}</td></tr>${sub ? `<tr class="sub"><td></td><td>${sub}</td></tr>` : ''}`;
    const t1 = [row(dl('karma', T.karma), trumpLink(k.south.card), `${T.south}, ${i.sign(k.south.sign)}${hs(k.south.house)} · ${lt(k.south.letter)}`),
      row(dl('mission', T.mission), trumpLink(k.north.card), `${T.north}, ${i.sign(k.north.sign)}${hs(k.north.house)} · ${lt(k.north.letter)}`),
      row(dl('engine', T.engine), trumpLink(k.engine.card), `${P(k.engine.planet)}, ${i.sign(k.engine.sign)}${hs(k.engine.house)} · ${lt(k.engine.letter)}${k.engine.doubled ? ` · ${T.doubled}` : ''}`),
      ...k.conj.map(c => row(dl('conj', T.conj), trumpLink(c.card), `${P(c.planet)}, ${c.node === 'north' ? T.north : T.south} ${c.orb.toFixed(1)}° · ${lt(c.letter)}`)),
      ...k.threshold.map(t => row(dl('threshold', T.threshold), trumpLink(t.card), `${SD.tikkun.near(t)} · ${lt(t.letter)}`))].join('');
    const order = (k.noTime ? [] : ['ascendant']).concat(['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']).concat(k.noTime ? [] : ['midheaven']);
    const lonOf = x => x === 'ascendant' ? st.asc : x === 'midheaven' ? st.mc : st.bodies[x].lon, nm = x => x === 'ascendant' ? i.cap1(R('ascendant')) : x === 'midheaven' ? i.cap1(R('midheaven')) : x === 'northNode' ? T.north : P(x);
    const t2 = order.map(x => { const s = Math.floor(SD.engine.norm360(lonOf(x)) / 30); return `<tr><td>${nm(x)}</td><td>${i.sign(s)}</td><td class="card">${trumpLink(SD.tikkun.SIGN[s][1])}</td></tr>`; }).join('');
    const recur = k.placements.filter(p => p.count > 1).map(p => T.recurs(trumpLink(p.card), p.count, p.keys.map(nm).join(', ')));
    const cards = a => a.path ? trumpLink(a.card) : a.cards.map(trumpLink).join(' + ');
    const t3 = k.aspects.map(a => `<tr class="asp-${SD.engine.aspectTone(a.aspect, a.a, a.b, a.orb) || ''}"><td><span class="nm">${nm(a.a)} ${A(a.aspect)} ${nm(a.b)}</span></td><td class="card">${cards(a)}</td></tr><tr class="sub"><td colspan="2">${a.orb.toFixed(1)}° · ${T[a.quality]}${a.weak ? `, ${T.weak}` : ''}${a.path ? ` · ${lt(a.letter)}` : ''}</td></tr>`).join('');
    const realm = k.north.house ? ` ${T.livedIn} ${i.realm(k.north.house)}.` : '';
    return secOf('natal', 'kabbalah', `<h3>${T.label}</h3>
      <p class="verdict">${i.cap1(T.short[k.north.sign])} · ${trumpLink(k.north.card)}</p>
      <p class="prose">${T.long[k.north.sign]}${realm}</p>
      ${pillRow(popBtn('symbolic', R('howCards')))}${k.noTime ? `<p class="note">${i.cap1(T.noTime)}.</p>` : ''}
      <h4>${T.cards}</h4><table class="cards">${t1}</table>
      <details class="fold" data-sec="natal.road"><summary><h4>${T.road}</h4><span class="s">${recur.length ? recur.join(' ') : R('noRepeat')}</span></summary><table class="cards">${t2}</table></details>
      <h4>${T.aspects}</h4><table class="cards asp">${t3}</table>`);
  }
  /* the update button: ask the server for a newer service worker, let it install (it takes over at once), then reload.
     the pages come network-first, so the reload brings the newest files; offline it simply reloads the cached app */
  async function updateApp() {
    const b = $('update'); if (b.classList.contains('busy')) return; b.classList.add('busy');
    try {
      const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null;
      if (reg) {
        await reg.update();
        const w = reg.installing || reg.waiting;
        if (w) await new Promise(res => { const t = setTimeout(res, 4000); w.addEventListener('statechange', () => { if (w.state === 'activated') { clearTimeout(t); res(); } }); });
      }
    } catch (e) { /* offline or no service worker: a plain reload still helps */ }
    location.reload();
  }

  function updateControls() {
    if (document.activeElement !== $('when')) { $('when').value = placeStamp(S.state.date); $('when').classList.remove('bad'); }
    $('zone').textContent = offsetOf(S.place.tz || 'UTC', S.state.date);
    const live = S.offsetMs === 0 && !S.fixed && !S.playing;
    $('live').classList.toggle('on', live);
    $('now-float').hidden = live || S.mode === 'natal' || S.mode === 'natalchart';   // the birth dial does not move with the clock; the chart button holds that corner                           // the way back, in sight whenever the clock has been moved
    if (document.activeElement !== $('preview')) $('preview').value = Math.max(0, Math.min(STRIP_H * 60, Math.round(S.offsetMs / 60000)));
    $('play').classList.toggle('on', S.playing);
    $('play').textContent = SD.i18n.cap1(SD.i18n.t(S.playing ? 'ui.pause' : 'ui.run'));
    $('speed').textContent = S.speed < 1 ? `${S.speed * 60}m/s` : `${S.speed}h/s`;
    $('here').classList.toggle('on', S.place.name === 'here');
    if (PLACES[S.place.name] && $('city').value !== S.place.name) $('city').value = S.place.name;
    document.querySelectorAll('[data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === S.mode || (S.mode === 'natalchart' && b.dataset.mode === 'natal')));
    { const ct = $('chart-toggle'), on = S.mode === 'natalchart', i = SD.i18n; ct.classList.toggle('on', on); ct.setAttribute('aria-pressed', on ? 'true' : 'false'); ct.setAttribute('aria-label', i.t(on ? 'ui.asArt' : 'ui.asChart')); ct.title = i.t(on ? 'ui.asArt' : 'ui.asChart'); }
    document.body.classList.toggle('natal', S.mode === 'natal' || S.mode === 'natalchart');
    document.body.classList.toggle('pair', S.mode === 'pair');
    document.body.classList.toggle('transits', S.mode === 'synastry');   // the Transits tab: no 72-hour strip, that is the clock's
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
  /* install: always from the clock itself, so the icon on the home screen opens the clock. the website's "Install on your
     phone" lands here with ?install=1 and this card opens over the dial at once. where the browser offers its own prompt
     (Chrome, Edge, Android) the card carries an Install button; elsewhere the steps for this device, in plain words.
     the card never shows once the app runs installed */
  let installEvt = null;
  const standalone = () => (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true;
  window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEvt = e; const n = $('install-native'); if (n && !$('install-sheet').hidden) n.hidden = false; });
  window.addEventListener('appinstalled', () => { installEvt = null; const r = $('install-row'); if (r) r.hidden = true; const h = $('install-how'); if (h) h.innerHTML = `<p>${esc(SD.i18n.t('ui.install.done'))}</p>`; const n = $('install-native'); if (n) n.hidden = true; });
  function openInstall() {
    const i = SD.i18n, ua = navigator.userAgent, how = $('install-how'), L = k => i.t('ui.install.' + k);
    const ios = /iPhone|iPad|iPod/.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const safari = ios && /Safari/.test(ua) && !/CriOS|FxiOS|EdgiOS|GSA|Instagram|FBAN|FBAV/.test(ua);
    const inApp = /Instagram|FBAN|FBAV|Line\/|WhatsApp|; wv\)/.test(ua);
    const steps = arr => `<ol>${arr.map(s => `<li>${esc(s)}</li>`).join('')}</ol>`;
    how.innerHTML = standalone() ? `<p>${esc(L('done'))}</p>` : `<p>${esc(L('lead'))}</p>` + (inApp ? `<p class="warn">${esc(L('inapp'))}</p>` : '')
      + (installEvt ? '' : ios ? (safari ? steps(L('ios')) : `<p class="warn">${esc(L('iosOther'))}</p>` + steps(L('ios'))) : /Android/.test(ua) ? steps(L('android')) : steps(L('desktop')));
    $('install-native').hidden = !installEvt || standalone();
    $('menu').hidden = true; $('install-sheet').hidden = false;
  }
  function setupInstall() {
    const row = $('install-row'); if (!row) return;
    row.hidden = standalone();
    $('install-btn').addEventListener('click', openInstall);
    $('install-close').addEventListener('click', () => { $('install-sheet').hidden = true; });
    $('install-sheet').addEventListener('click', e => { if (e.target.id === 'install-sheet') $('install-sheet').hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') $('install-sheet').hidden = true; });
    $('install-native').addEventListener('click', async () => { if (!installEvt) return; installEvt.prompt(); try { await installEvt.userChoice; } catch (e) { /* closed */ } installEvt = null; $('install-sheet').hidden = true; });
    if (params.get('install') === '1') {                   // arrived from the website's button: the address loses the flag (iPhone saves the address it is on)
      try { const u = new URL(location.href); u.searchParams.delete('install'); history.replaceState(null, '', u.pathname + (u.search ? u.search : '') + u.hash); } catch (e) { /* the card opens all the same */ }
      if (!standalone()) setTimeout(openInstall, 400);    // the clock first, then the card over it
    }
  }
  /* ---------- planetary talismans timing ----------
     the next moments to make each planet's talisman at the clock's place (SD.talismans), counted from the real now. the
     search runs in the page's idle time, a few milliseconds at a slice, and is kept in this browser for the day and the
     place; a moment already past drops from the list. each date opens the clock at that moment, with its sound. */
  const tal = { key: null, out: null, partial: null, token: 0, from: 0 };
  const talKey = () => [SD.talismans.RULES.version, S.place.lat.toFixed(3), S.place.lon.toFixed(3), S.houses, Math.floor(Date.now() / 864e5)].join('|');
  const talSpent = out => Object.values(out).some(r => r.best.concat(r.lesser).some(e => e.end <= Date.now()));   // a listed moment has gone by: count again from now
  function talismansKick() {
    if (!SD.talismans) return;
    const key = talKey();
    if (tal.key === key && !(tal.out && talSpent(tal.out))) return;
    tal.key = key; tal.out = null; tal.partial = null;
    const cached = store.get('talismans', null);
    if (cached && cached.key === key && cached.out && !talSpent(cached.out)) { tal.out = cached.out; tal.from = cached.from; renderTalismans(); return; }
    const token = ++tal.token, from = Math.floor(Date.now() / 6e4) * 6e4, place = { ...S.place };
    const s = SD.talismans.searcher(place, from, { houses: S.houses });
    tal.from = from;
    const later = f => (window.requestIdleCallback ? requestIdleCallback(f, { timeout: 600 }) : setTimeout(f, 40));
    (function chunk() {
      if (token !== tal.token) return;
      const until = performance.now() + 8;                 // at most 8 ms at a time: a tap is never kept waiting
      let done = false, broke = false;
      try { done = s.step(() => performance.now() < until); } catch (e) { done = broke = true; }
      tal.partial = s.planets;
      if (!done) { renderTalismans(); return later(chunk); }
      tal.out = s.planets;
      if (!broke && !s.failed) store.set('talismans', { key, from, out: s.planets });   // a search that failed anywhere is tried again on the next visit
      renderTalismans();
    })();
  }
  function renderTalismans() { paintSection('clock', 'talismans', talismansHtml()); }
  /* the talismans: one sentence, the rules and the sources behind pills, then seven rows present from the first paint, so the
     page never jumps while the search runs; a found planet's row opens on its windows, the soonest named on the row */
  function talismansHtml() {
    const i = SD.i18n, T = k => i.t('ui.tal.' + k), P = k => i.cap1(i.planet(k)), tz = S.place.tz || 'UTC', loc = i.locale();
    const day = new Intl.DateTimeFormat(loc, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric', timeZone: tz });
    const hm = new Intl.DateTimeFormat(loc, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23', timeZone: tz });
    const cap = t => t.replace(/^./, c => c.toUpperCase());
    const res = tal.out || tal.partial, now = Date.now();
    const edges = e => { const a = Math.ceil(e.start / 6e4) * 6e4, z = Math.floor(e.end / 6e4) * 6e4; return [a, z]; };   // whole minutes inside the window, never past its edges
    const dayTxt = d => day.formatToParts(d).map(p => p.type === 'literal' ? p.value.replace(',', '') : p.value).join('');   // 'Wed 29 Mar 2028'
    const when = e => { const [a, z] = edges(e); return `${cap(dayTxt(a))}, ${hm.format(a)}–${hm.format(z)}`; };
    const dig = e => e.dignity.includes('exaltation') ? T('exalted') : e.dignity.includes('domicile') ? T('ownSign') : e.dignity.includes('triplicity') ? T('triplicity') : T('term');
    const line = (e, k) => {
      const where = T(e.angle === 'asc' ? 'rising' : 'culminating')(k, P(k), i.sign(e.sign));
      const mn = e.moon.mansion ? `${i.ordinal(e.moon.mansion.index)} ${i.t('cap.mansion')}, ${i.name(e.moon.mansion.name)}` : '';   // her mansion: its use depends on the work (Agrippa II.33)
      const moon = T('moonLine')(i.sign(e.moon.sign), mn, i.aspect(e.moon.aspect), e.moon.to === k ? '' : e.moon.to, e.moon.to === k ? T('itself') : P(e.moon.to));
      const by = e.cautionBy || {}, cBy = T('cBy'), x = { P, asp: a => i.aspect(a), ord: n => i.ordinal(n) };   // name the planet behind a caution, and say fall or detriment for the Moon
      const said = c => c === 'moonFall' ? cBy.moonFall(i.sign(e.moon.sign), e.moon.sign === 7) : by[c] && cBy[c] ? cBy[c](by[c].by, by[c].how, x) : T('c')[c] || c;
      const caut = e.cautions.length ? ` · <span class="asp asp-tension">${e.cautions.map(said).join(', ')}</span>` : '';
      const [a, z] = edges(e), at = Math.min(Math.max(e.at, a), z);
      return `<li><a href="#" class="tal-at" data-tal="${new Date(at).toISOString()}">${when(e)}</a> (${T('minutes')(Math.round((z - a) / 6e4))})<span class="tal-why nolink">${where}, ${dig(e)} · ${e.day ? T('dayHour')(k, P(k)) : T('hourOf')(k, P(k))} · ${moon}${caut}</span></li>`;
    };
    const rows = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'].map(k => {
      const r = res && res[k];
      if (!r || !r.done) return `<div class="tal-planet"><span class="p">${P(k)}</span><span class="w">${T('searching')}</span></div>`;   // a list half searched is not yet the best three
      if (r.error) return `<div class="tal-planet"><span class="p">${P(k)}</span><span class="w">${T('failed')(k, P(k))}</span></div>`;
      const best = r.best.filter(e => e.end > now), lesser = r.lesser.filter(e => e.end > now);
      const soonest = [...best].sort((u, v) => u.start - v.start)[0] || [...lesser].sort((u, v) => u.start - v.start)[0];
      const summary = soonest ? when(soonest) : T('noneShort')(Math.round(SD.talismans.RULES.horizon[k] / 365));
      let body = '';
      if (best.length) body += `<p class="tal-sub">${T('firstRate')}</p><ul class="tal">${best.map(e => line(e, k)).join('')}</ul>`;
      if (lesser.length) body += `<p class="tal-sub">${T('lesserHead')}</p><ul class="tal">${lesser.map(e => line(e, k)).join('')}</ul>`;
      const first = [...best, ...lesser].reduce((m, e) => Math.min(m, e.start), Infinity);
      if (r.wait && r.wait.until > now && (!isFinite(first) || first - now > 60 * 864e5)) body += `<p class="note">${T('wait')(k, P(k), timeTag(new Date(r.wait.until), dayTxt(r.wait.until)))}</p>`;
      if (!body) return `<div class="tal-planet"><span class="p">${P(k)}</span><span class="w">${summary}</span></div>`;
      if (k === 'mars' || k === 'saturn') body += pillRow(popBtn(k === 'mars' ? 'cautionMars' : 'cautionSaturn', T('cautionPill')));
      return `<details class="tal-planet" data-sec="tal.${k}"><summary><span class="p">${P(k)}</span><span class="w">${summary}</span></summary>${body}</details>`;
    }).join('');
    return secOf('clock', 'talismans', `<h3>${i.cap1(T('h'))}</h3><p>${T('lead')(S.place.name === 'here' ? '' : i.placeName(S.place.name))}</p>${pillRow(popBtn('talHow', T('howPill')), popBtn('talSources', T('sourcesPill')))}<div class="tal-list">${rows}</div>`, ' id="talismans"');
  }
  /* a date of the list: the clock at that moment, the dial in view, and its chord (the tap lets the sound start) */
  function openMoment(d) {
    S.playing = false; S.fixed = d; S.offsetMs = 0;
    if (S.mode !== 'clock') { S.mode = 'clock'; store.set('mode', S.mode); }
    updateControls(); recompute();
    try { listen(true); } catch (e) { /* the clock opens all the same */ }
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  /* a tarot card named anywhere in the reading: a lightbox over the page, at once, with the plate, its Golden Dawn line and
     its meaning; the plate taps through to the full scan; a tap outside, Close or Escape shuts it */
  function openCard(key) {
    glossaryTerms();
    const i = SD.i18n, lang = i.locale().startsWith('es') ? 'es' : 'en', x = SD.glossary.dynamic(lang).find(e => e.key === key);
    if (!x) { openGlossary(key); return; }
    let v = document.querySelector('.card-view');
    if (!v) {
      v = document.createElement('div'); v.className = 'card-view'; v.setAttribute('role', 'dialog'); v.setAttribute('aria-modal', 'true');
      v.addEventListener('click', e => { const im = e.target.closest('img'); if (im) { openPlate(im.dataset.full, im.alt); return; } if (e.target === v || e.target.closest('.cv-close')) { v.hidden = true; if (v.opener && v.opener.isConnected) v.opener.focus({ preventScroll: true }); } });
      v.addEventListener('keydown', e => { if (e.key === 'Tab') { e.preventDefault(); v.querySelector('.cv-close').focus(); } });
      document.addEventListener('keydown', e => { if (e.key !== 'Escape' || v.hidden) return; const pv = document.querySelector('.plate-view'); if (pv && !pv.hidden) return; v.hidden = true; if (v.opener && v.opener.isConnected) v.opener.focus({ preventScroll: true }); });
      document.body.appendChild(v);
    }
    const m = SD.tarotMeanings && SD.tarotMeanings[lang] && SD.tarotMeanings[lang][key];
    v.innerHTML = `<div class="cv-card"><button class="cv-close">${esc(i.cap1(i.t('ui.close')))}</button><img src="${x.img.replace('img/tarot/', 'img/tarot/sm/')}" data-full="${x.img}" alt="${esc(x[lang][0])}" width="440" height="760"><div class="cv-text"><h2>${esc(x[lang][0])}</h2><p class="gd">${esc(x[lang][1])}</p>${m ? `<p class="meaning">${esc(m)}</p>` : ''}</div></div>`;
    if (v.hidden !== false || !v.opener) v.opener = document.activeElement;
    v.hidden = false; v.scrollTop = 0; v.querySelector('.cv-close').focus({ preventScroll: true });
  }
  /* a tarot plate at full size, over everything; any tap or Escape closes it */
  function openPlate(src, alt) {
    let v = document.querySelector('.plate-view');
    if (!v) { v = document.createElement('div'); v.className = 'plate-view'; v.setAttribute('role', 'dialog'); v.addEventListener('click', () => { v.hidden = true; }); document.addEventListener('keydown', e => { if (e.key === 'Escape') v.hidden = true; }); document.body.appendChild(v); }
    v.innerHTML = `<img src="${src}" alt="${esc(alt || '')}">`; v.hidden = false;
  }
  function buildGlossary() {
    const i = SD.i18n, lang = i.locale().startsWith('es') ? 'es' : 'en', GL = SD.glossary;
    if (glossaryLang === lang) return; glossaryLang = lang;
    const groups = { ...GL.groups[lang], tarot: i.t('ui.tarot.group') };
    glossaryTerms(); const tarot = GL.dynamic(lang);
    const order = [...GL.order.slice(0, GL.order.indexOf('time') + 1), 'tarot', ...GL.order.slice(GL.order.indexOf('time') + 1)];
    $('glossary-index').innerHTML = order.map(g => `<a href="#gg-${g}">${groups[g]}</a>`).join('');
    $('glossary-body').innerHTML = order.map(g => {
      const items = (g === 'tarot' ? tarot : GL.entries.filter(x => x.group === g));
      // a plate: the card at a size that reads (a 440 px copy, tap for the full scan), the Golden Dawn line, then its meaning
      const meaning = x => { const m = SD.tarotMeanings && SD.tarotMeanings[lang] && SD.tarotMeanings[lang][x.key]; return m ? `<p class="meaning nolink">${esc(m)}</p>` : ''; };
      const plate = x => x.img ? `<dd class="plate"><img loading="lazy" decoding="async" src="${x.img.replace('img/tarot/', 'img/tarot/sm/')}" data-full="${x.img}" alt="${esc(x[lang][0])}" width="440" height="760"><div><p class="gd">${esc(x[lang][1])}</p>${meaning(x)}</div></dd>` : `<dd>${esc(x[lang][1])}</dd>`;
      return `<h2 id="gg-${g}">${groups[g]}</h2>${g === 'tarot' ? `<p class="meta nolink">${esc(i.t('ui.tarot.note'))}</p>` : ''}<dl>${items.map(x => `<dt id="g-${x.key}">${esc(x[lang][0])}</dt>${plate(x)}`).join('')}</dl>`;
    }).join('');
    SD.glossary.link($('glossary-body'), lang);                 // the entries link to one another
    if (!$('glossary-body').dataset.plates) { $('glossary-body').dataset.plates = '1'; $('glossary-body').addEventListener('click', e => { const im = e.target.closest('dd.plate img'); if (im) openPlate(im.dataset.full, im.alt); }); }
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
  let pickHeld = 0;                                          // when the chart menu was last shown by a long press
  let openPick = null;                                       // opens the chart menu under a tab: set by bindChartPick
  function bindChartPick() {
    const menu = $('chart-pick'); if (!menu) return;
    const btnA = document.querySelector('[data-mode="natal"]'), btnB = document.querySelector('[data-mode="pair"]');
    let timer = null, which = 'first', btn = btnA;
    const show = () => {
      pickHeld = performance.now();
      const i = SD.i18n, onId = which === 'first' ? (S.natal && S.natal.id) : S.pair;
      const list = which === 'second' && S.natal ? S.charts.filter(c => c.id !== S.natal.id) : S.charts;
      menu.innerHTML = (list.length ? list.map(c => `<button type="button" data-id="${c.id}"${onId === c.id ? ' class="on"' : ''}>${esc(c.name || '—')}</button>`).join('') : `<div class="empty">${i.cap1(i.t('ui.noCharts'))}</div>`)
        + `<button type="button" class="new" data-new="1">+ ${esc(i.cap1(i.t('ui.newChart')))} ${esc(i.t('ui.chartWord'))}</button>`;   // and a way to add one, for either place
      const r = btn.getBoundingClientRect();
      menu.hidden = false;
      const w = menu.offsetWidth, left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left));
      const mh = menu.offsetHeight, top = r.bottom + 6 + mh <= window.innerHeight - 8 ? r.bottom + 6 : Math.max(8, r.top - 6 - mh);
      menu.style.left = `${left}px`; menu.style.top = `${top}px`;
      try { navigator.vibrate && navigator.vibrate(12); } catch (e) { /* no haptics */ }
    };
    const disarm = () => { clearTimeout(timer); timer = null; };
    openPick = (w, b) => { which = w; btn = b; show(); pickHeld = 0; const f = menu.querySelector('button:not(.on)') || menu.querySelector('button'); if (f) f.focus({ preventScroll: true }); };
    for (const [b, w] of [[btnA, 'first'], [btnB, 'second']]) {
      if (!b) continue;
      const arm = e => { if (e.button && e.button !== 0) return; which = w; btn = b; clearTimeout(timer); timer = setTimeout(() => { show(); try { window.getSelection && window.getSelection().removeAllRanges(); } catch (x) { /* none */ } }, 480); };
      b.addEventListener('pointerdown', arm); b.addEventListener('pointerup', disarm); b.addEventListener('pointerleave', disarm); b.addEventListener('pointercancel', disarm);
      b.addEventListener('contextmenu', e => { e.preventDefault(); disarm(); which = w; btn = b; show(); });
    }
    menu.addEventListener('click', e => {
      if (e.target.closest('button[data-new]')) { menu.hidden = true; S.birthForPair = which === 'second'; openBirth(true); return; }   // a blank form; the loaded chart stays until the new one is saved
      const b = e.target.closest('button[data-id]'); if (!b) return;
      const chart = S.charts.find(c => c.id === b.dataset.id); menu.hidden = true; if (!chart) return;
      if (which === 'second') { S.pair = chart.id; store.set('pair', S.pair); S.mode = 'pair'; }
      else { S.natal = { ...chart }; store.set('natal', S.natal); natalCache.key = null; if (!natalModes.includes(S.mode)) S.mode = 'natal'; }
      store.set('mode', S.mode); recompute(); updateControls(); requestAnimationFrame(slideSeg);
    });
    document.addEventListener('pointerdown', e => { if (!menu.hidden && !e.target.closest('#chart-pick, [data-mode="natal"], [data-mode="pair"]')) menu.hidden = true; });
    window.addEventListener('keydown', e => { if (e.key === 'Escape') menu.hidden = true; });
  }
  function openGlossary(key) {
    buildGlossary();
    $('glossary').hidden = false; $('about').hidden = true;
    const t = key && document.getElementById('g-' + key);
    document.querySelectorAll('#glossary-body .lit').forEach(x => x.classList.remove('lit'));
    if (t) { t.scrollIntoView({ block: 'start', behavior: 'instant' }); t.classList.add('lit'); }   // the entry at once, no slide; it stays lit until the next word is followed
    else $('glossary').scrollTop = 0;
  }
  const linkTerms = root => { try { glossaryTerms(); SD.glossary.link(root, SD.i18n.locale().startsWith('es') ? 'es' : 'en', { marks: false }); } catch (e) { /* the glossary is a nicety */ } };
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
    $('natal-summary').innerHTML = `${esc(natalSummary())}${S.natal ? ` <button class="copy-btn" aria-label="${esc(i.t('ui.copyReport'))}" title="${esc(i.t('ui.copyReport'))}"><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true" class="ico-copy"><rect x="8.5" y="8.5" width="11" height="11" rx="2"/><path d="M15.5 8.5V6a1.5 1.5 0 0 0-1.5-1.5H6A1.5 1.5 0 0 0 4.5 6v8A1.5 1.5 0 0 0 6 15.5h2.5"/></svg><svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" class="ico-done"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button>` : ''}`;
    $('natal-saveas').disabled = !S.natal; $('natal-report').disabled = !S.natal; $('natal-copy').disabled = !S.natal;
    const ul = $('charts');
    ul.innerHTML = S.charts.length ? S.charts.map(c => `<li data-id="${c.id}"${S.natal && S.natal.id === c.id ? ' class="on"' : ''}><input type="radio" name="chart-use" class="use" data-act="load" aria-label="${i.t('ui.useChart')}" title="${i.t('ui.useChart')}"${S.natal && S.natal.id === c.id ? ' checked' : ''}><span class="name" data-act="load" role="button" tabindex="0" title="${i.t('ui.useChart')}">${esc(c.name)}</span><span class="ops"><button data-act="rename">${i.cap1(i.t('ui.rename'))}</button><button data-act="dup">${i.cap1(i.t('ui.dup'))}</button><button data-act="delete">${i.cap1(i.t('ui.del'))}</button></span></li>`).join('')
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
    $('natal-new').addEventListener('click', () => { openMenu(false); S.birthForPair = false; openBirth(true); });   // a blank form; the loaded chart stays until the new one is saved
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
      } else if (b.dataset.act === 'dup') {               // a copy to edit without touching the original
        const copy = { ...chart, place: chart.place && { ...chart.place }, id: uid(), name: SD.i18n.t('ui.copyOf')(chart.name || '') };
        S.charts.splice(S.charts.indexOf(chart) + 1, 0, copy); store.set('charts', S.charts); refreshMenu();
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
    $('chart-toggle').addEventListener('click', () => { if (!S.natal) return; S.mode = S.mode === 'natalchart' ? 'natal' : 'natalchart'; store.set('mode', S.mode); updateControls(); S.quick = true; recompute(); });   // in Natal: the birth as the dial, or as a printed chart
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
    liveFormat($('when'), 'stamp'); $('when').addEventListener('input', e => e.target.classList.remove('bad'));   // red only until the next keystroke liveFormat($('birth-date'), 'date'); liveFormat($('birth-time'), 'time');
    { let prev = '24';                                      // switching 24 h / am / pm converts the time already typed: 16:30 ⇄ 4:30 pm
      $('birth-ampm').addEventListener('focus', () => { prev = $('birth-ampm').value; });
      $('birth-ampm').addEventListener('change', () => {
        const el = $('birth-time'), mode = $('birth-ampm').value, t24 = normTime(el.value.replace(/[ap]\.?\s*m?\.?\s*$/i, ''), prev);
        if (t24) { const [h, m] = t24.split(':').map(Number); if (mode === '24') el.value = t24; else if ((mode === 'pm') === (h >= 12)) el.value = `${h % 12 || 12}:${String(m).padStart(2, '0')}`; else if (prev === '24') { el.value = `${h % 12 || 12}:${String(m).padStart(2, '0')}`; $('birth-ampm').value = h >= 12 ? 'pm' : 'am'; } }
        prev = $('birth-ampm').value; }); }
    $('when').addEventListener('change', commit);
    $('when-go').addEventListener('click', () => commit({ target: $('when') }));
    $('when').addEventListener('keydown', e => { if (e.key === 'Enter') { commit(e); e.target.blur(); } });
    $('here').addEventListener('click', () => locate(true));
    bindChartPick(); setupInstall();
    document.querySelectorAll('[data-mode]').forEach(b => b.addEventListener('click', () => {
      if (pickHeld && performance.now() - pickHeld < 900) { pickHeld = 0; return; }   // only the click that ends a hold is swallowed; a later tap always goes through
      let m = b.dataset.mode;
      if ((m === 'natal' || m === 'synastry' || m === 'pair') && !S.natal) { openBirth(); return; }
      // a second tap on the lit Natal or Synastry tab opens its list of charts (holding it still works)
      if ((m === 'natal' && (S.mode === 'natal' || S.mode === 'natalchart')) || (m === 'pair' && S.mode === 'pair')) { openPick && openPick(m === 'pair' ? 'second' : 'first', b); return; }
      S.mode = m; store.set('mode', S.mode);                // one tab, one view: whatever was lit goes dark
      document.querySelectorAll('[data-mode]').forEach(x => x.classList.toggle('on', x.dataset.mode === m));   // the tab answers at once
      requestAnimationFrame(() => setTimeout(() => { S.quick = true; recompute(); }, 0));   // the work after the paint; the first frame quick, the full plate on the next
    }));
    if ($('birth-open')) $('birth-open').addEventListener('click', openBirth);   // the button is gone from the place row; the form opens from the Natal tab and the menu
    $('birth-close').addEventListener('click', () => { $('birth').hidden = true; });
    $('birth-save').addEventListener('click', saveBirth);
    bindPlaceSearch();
    $('birth-clear').addEventListener('click', () => { S.natal = null; store.set('natal', null); if (natalModes.includes(S.mode)) S.mode = 'clock'; $('birth').hidden = true; recompute(); });
    $('wallpaper').addEventListener('click', e => busy(e.currentTarget, exportWallpaper));
    $('update').addEventListener('click', updateApp);
    for (const cv of [canvas, plate]) if (cv && cv.addEventListener) cv.addEventListener('contextrestored', () => { SD.render.resetCaches(); S.dirty = true; });   // a canvas the browser dropped is drawn again
    document.addEventListener('visibilitychange', () => { if (!document.hidden) { SD.render.resetCaches(); S.dirty = true; } });   // back from the background: fresh plates
    $('share').addEventListener('click', shareArt);
    $('caption').addEventListener('click', e => { if (e.target.closest('.share-btn')) shareArt(); const cb = e.target.closest('.copy-btn'); if (cb) copyWithTick(cb); });
    $('copy-link').addEventListener('click', e => copyWithTick(e.currentTarget));
    $('natal-summary').addEventListener('click', e => { const cb = e.target.closest('.copy-btn'); if (cb) copyWithTick(cb); });
    $('readout').addEventListener('change', e => {           // the relationship type of the pair on show
      if (e.target.id !== 'pair-type' || !S.state.pair) return;
      const [a, b] = S.state.pair.ids; store.set(pairKey(a, b), e.target.value); recompute(); });
    $('save').addEventListener('click', e => busy(e.currentTarget, () => exportPNG(2048)));
    $('sigil').addEventListener('click', () => { S.sigil = !S.sigil; S.dirty = true; updateControls(); });
    $('readout').addEventListener('click', e => { const a = e.target.closest('[data-tal]'); if (!a) return; e.preventDefault(); openMoment(new Date(a.dataset.tal)); });
    $('readout').addEventListener('click', e => { const g = e.target.closest('[data-go]'); if (!g) return; e.preventDefault();   // the links out of the reading: to the Clock, or to choose the second chart
      if (g.dataset.go === 'clock') { const b = document.querySelector('.seg [data-mode="clock"]') || document.querySelector('[data-mode="clock"]'); if (b) { b.click(); window.scrollTo({ top: 0, behavior: 'instant' }); b.focus({ preventScroll: true }); } }
      else if (g.dataset.go === 'pick-second' && openPick) openPick('second', g); });
    // the pop-up (DESIGN.md, "The readout system"): one at a time, titled with the words that opened it; anchored under its
    // trigger, or above it near the foot of the screen; on a phone a text over sixty words rises as a sheet. It holds a method
    // note ("note:stone"), a tikkun word ("karma") or a glossary entry ("g:void"). The trigger again, ×, a tap outside,
    // Escape or a change of width closes it; a sheet gives the focus back to its trigger
    let defOpen = null;
    const closeDef = back => { if (!defOpen) return; const d = defOpen; defOpen = null; cancelAnimationFrame(d.raf); d.box.remove(); if (d.scrim) d.scrim.remove(); d.btn.setAttribute('aria-expanded', 'false'); if (back && d.btn.isConnected) d.btn.focus({ preventScroll: true }); };
    const popContent = (key, btn) => {
      const lang = SD.i18n.locale().startsWith('es') ? 'es' : 'en';
      if (key.startsWith('g:')) { const k = key.slice(2), g = SD.glossary.byKey(k) || SD.glossary.dynamic(lang).find(x => x.key === k); return g ? { title: g[lang][0].replace(/\s*\(.*\)$/, ''), text: g[lang][1], gloss: k } : null; }
      const title = btn.textContent.trim();
      if (key.startsWith('note:')) return { title, text: noteText(key.slice(5)) };
      return { title, text: (SD.tikkun.text().defs || {})[key] };
    };
    const openDef = (btn, key, kb) => {
      key = key || btn.dataset.def;
      const same = defOpen && defOpen.key === key && defOpen.btn === btn; closeDef(); if (same) return;
      const c = popContent(key, btn); if (!c || !c.text) return;
      const i = SD.i18n, txt = String(c.text), sheet = window.innerWidth <= 720 && txt.split(/\s+/).length > 60;
      const box = document.createElement('div'); box.className = 'popdef' + (sheet ? ' sheet' : ''); box.id = 'popdef'; box.tabIndex = -1;
      box.setAttribute('role', sheet ? 'dialog' : 'note'); box.setAttribute('aria-labelledby', 'popdef-t'); if (sheet) box.setAttribute('aria-modal', 'true');
      const t = document.createElement('span'); t.className = 'pt'; t.id = 'popdef-t'; t.textContent = i.cap1(c.title); box.appendChild(t);
      const x = document.createElement('button'); x.type = 'button'; x.className = 'pclose'; x.setAttribute('aria-label', i.cap1(i.t('ui.close'))); x.textContent = '×'; box.appendChild(x);
      for (const para of txt.split(/\n\n+/)) { const p = document.createElement('p'); if (para.startsWith('§ ')) { p.className = 'ps'; p.textContent = para.slice(2); } else p.textContent = i.cap1(para); box.appendChild(p); }
      if (c.gloss) { const f = document.createElement('p'), b = document.createElement('button'); f.className = 'pfoot'; b.type = 'button'; b.dataset.gloss = c.gloss; b.textContent = i.t('ui.inGlossary'); f.appendChild(b); box.appendChild(f); }
      let scrim = null;
      if (sheet) { scrim = document.createElement('div'); scrim.className = 'pop-scrim'; document.body.appendChild(scrim); }
      document.body.appendChild(box);
      btn.setAttribute('aria-expanded', 'true'); btn.setAttribute('aria-controls', 'popdef');
      const host = btn.closest('#readout > [data-sec], #caption'), sel = key.startsWith('g:') ? `a.g[data-g="${key.slice(2)}"]` : `[data-def="${key}"]`;
      defOpen = { btn, box, scrim, key, w: window.innerWidth, sel, host: host ? (host.id === 'caption' ? '#caption' : `#readout > [data-sec="${host.dataset.sec}"]`) : null, nth: host ? [...host.querySelectorAll(sel)].indexOf(btn) : 0 };
      if (!sheet) follow();
      if (sheet || kb) box.focus({ preventScroll: true });
      box.addEventListener('keydown', e => { if (e.key !== 'Tab') return; const f = [box, ...box.querySelectorAll('button')], i = f.indexOf(document.activeElement); e.preventDefault(); f[(i + (e.shiftKey ? f.length - 1 : 1)) % f.length].focus(); });
    };
    const place = () => {                                   // under the trigger, or above it near the foot; never taller than the room it has
      const d = defOpen; if (!d || d.scrim) return;
      const r = d.btn.getBoundingClientRect(); if (d.r && d.r.top === r.top && d.r.left === r.left && d.sy === window.scrollY) return;
      d.r = r; d.sy = window.scrollY; d.box.style.maxHeight = '';
      const vw = document.documentElement.clientWidth, vh = window.innerHeight, w = d.box.offsetWidth, h = d.box.offsetHeight;
      const below = vh - 8 - (r.bottom + 8), above = r.top - 16, down = h <= below || below >= above, room = Math.max(120, down ? below : above), hh = Math.min(h, room);
      if (h > room) d.box.style.maxHeight = room + 'px';
      d.box.style.left = (Math.max(16, Math.min(vw - 16 - w, r.left)) + window.scrollX) + 'px'; d.box.style.top = ((down ? r.bottom + 8 : r.top - 8 - hh) + window.scrollY) + 'px';
    };
    const follow = () => { if (!defOpen || defOpen.scrim) return; place(); defOpen.raf = requestAnimationFrame(follow); };   // the column scrolls, the page above it grows: the pop-up stays with its word
    const repoint = () => {                                 // after a repaint: the same word or pill in the same section, else close
      const d = defOpen; if (!d || d.btn.isConnected) return;
      const h = d.host && document.querySelector(d.host), list = h ? [...h.querySelectorAll(d.sel)] : [], nb = list[d.nth] || list[0];
      if (!nb) { closeDef(); return; }
      d.btn = nb; nb.setAttribute('aria-expanded', 'true'); nb.setAttribute('aria-controls', 'popdef');
    };
    SD.app_pop = { openDef, closeDef, repoint, open: () => defOpen };          // the readout's re-render re-points or closes an open pop-up
    document.addEventListener('click', e => {
      if (e.target.closest('.popdef .pclose')) { closeDef(true); return; }
      const gb = e.target.closest('.popdef [data-gloss]'); if (gb) { const k = gb.dataset.gloss, back = defOpen && defOpen.btn; closeDef(); openGlossary(k); $('glossary').back = back; $('glossary-close').focus({ preventScroll: true }); return; }
      const b = e.target.closest('[data-def]'); if (b) { e.preventDefault(); openDef(b, null, e.detail === 0); return; }
      if (defOpen && !e.target.closest('.popdef') && !defOpen.btn.contains(e.target)) closeDef(!!defOpen.scrim);
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDef(true); });
    window.addEventListener('resize', () => { if (defOpen && defOpen.w !== window.innerWidth) closeDef(); });   // a phone's toolbar changes the height while scrolling: only a new width closes it
    $('readout').addEventListener('click', e => { if (e.target.closest('[data-act="listen"]')) listen(!audio.on); });
    $('readout').addEventListener('click', e => { if (!e.target.closest('[data-act="algol"]')) return; S.algol = !S.algol; store.set('algol', S.algol); S.dirty = true; updateReadout(); });   // the Demon Star on the art, kept between visits
    $('preview').addEventListener('input', e => { S.playing = false; S.offsetMs = Number(e.target.value) * 60000; recompute(); });
    $('save-hd').addEventListener('click', e => busy(e.currentTarget, () => exportPNG(4096)));
    $('listen-corner').addEventListener('click', () => listen(!audio.on));
    $('about-open').addEventListener('click', () => { $('about').hidden = !$('about').hidden; $('about-open').classList.toggle('on', !$('about').hidden); if (!$('about').hidden) openMenu(false); });
    $('about-close').addEventListener('click', () => { $('about').hidden = true; $('about-open').classList.remove('on'); });
    $('glossary-open').addEventListener('click', () => { openGlossary(); openMenu(false); });
    $('glossary-close').addEventListener('click', () => { $('glossary').hidden = true; const b = $('glossary').back; $('glossary').back = null; if (b && b.isConnected) b.focus({ preventScroll: true }); });
    document.addEventListener('click', e => { const a = e.target.closest('a.g, [data-g]'); if (!a) return; e.preventDefault(); if (/^(card_|trump_)/.test(a.dataset.g || '')) openCard(a.dataset.g); else if (a.closest('#readout, #caption') && SD.app_pop) SD.app_pop.openDef(a, 'g:' + a.dataset.g, e.detail === 0); else openGlossary(a.dataset.g); });   // a tarot card opens as a lightbox, at once
    const fullScreen = () => {                              // the f key: the bare dial, full screen where the browser allows it
      document.body.classList.toggle('bare');
      if (document.body.classList.contains('bare') && document.documentElement.requestFullscreen) document.documentElement.requestFullscreen().catch(() => {});
      else if (document.fullscreenElement) document.exitFullscreen();
    };
    window.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'SELECT' || e.target.tagName === 'TEXTAREA') return;
      if (e.key === ' ' && e.target.closest && e.target.closest('button, a[href], summary, [role="button"], .popdef, .card-view')) return;   // Space activates the focused control
      if (e.key === 'f') fullScreen();
      if (e.key === 's') $('sigil').click();
      if (e.key === 'l') $('listen-corner').click();
      if (e.key === ' ') { e.preventDefault(); $('play').click(); }
      if (e.key === 'ArrowRight') { S.offsetMs += (e.shiftKey ? 24 : 1) * 3600e3; recompute(); }
      if (e.key === 'ArrowLeft') { S.offsetMs -= (e.shiftKey ? 24 : 1) * 3600e3; recompute(); }
      if (e.key === 'Escape') { document.body.classList.remove('bare'); $('about').hidden = true; $('about-open').classList.remove('on'); $('birth').hidden = true; $('glossary').hidden = true; openMenu(false); }
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
      $('birth-date').value = `${p.year}-${p.month}-${p.day}`; $('birth-time').value = n.unknownTime ? '' : `${p.hour}:${p.minute}`; $('birth-ampm').value = '24';
      $('birth-unknown').checked = !!n.unknownTime;
      choosePlace(n.place);
    } else { $('birth-name').value = ''; $('birth-date').value = ''; $('birth-time').value = ''; $('birth-ampm').value = '24'; $('birth-unknown').checked = false; choosePlace(null); }
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
    const dateTxt = normDate($('birth-date').value), unknown = $('birth-unknown').checked, timeTxt = unknown ? '12:00' : normTime($('birth-time').value, $('birth-ampm').value);
    if (!unknown && !/^\d{2}:\d{2}$/.test(timeTxt)) { $('birth-note').textContent = SD.i18n.cap1(SD.i18n.t('ui.badTime')); return; }
    $('birth-date').value = dateTxt; if (!unknown) { $('birth-time').value = timeTxt; $('birth-ampm').value = '24'; }
    const lat = parseFloat($('birth-lat').value), lon = parseFloat($('birth-lon').value), hand = Number.isFinite(lat) && Number.isFinite(lon);
    let place = null;
    if (S.birthPlace) place = { ...S.birthPlace, lat: hand ? lat : S.birthPlace.lat, lon: hand ? lon : S.birthPlace.lon };   // the coordinates may be corrected by hand
    else if (hand) place = { name: $('birth-place').value.trim() || `${lat.toFixed(2)}, ${lon.toFixed(2)}`, lat, lon, tz: nearestZone(lat, lon) };
    if (!place) { $('birth-note').textContent = SD.i18n.cap1(SD.i18n.t('ui.needPlace')); return; }
    const d = fromStamp(`${dateTxt} ${timeTxt}`, place.tz);
    if (!d) { $('birth-note').textContent = SD.i18n.cap1(SD.i18n.t('ui.badDate')); return; }
    const name = $('birth-name').value.trim();
    if (S.birthForPair) {                                   // a new second chart for the pair: kept and chosen as the second; the first chart stays
      const c = { date: d.toISOString(), place, unknownTime: unknown, name: name || '—', id: uid() };
      upsertChart(c); S.pair = c.id; store.set('pair', S.pair); S.birthForPair = false; S.birthNew = false;
      $('birth').hidden = true; S.mode = 'pair'; store.set('mode', S.mode); recompute(); return;
    }
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
  /* a time typed as 24-hour (16:30, 1630, 9:05) or as 12-hour with am or pm, typed (4:30 pm, 4.30p.m., 4pm) or chosen
     beside the field; always returned as 24-hour hh:mm, or '' when it cannot be a time */
  const ampmOf = txt => { const m = String(txt).match(/([ap])\.?\s*(m\.?)?\s*$/i); return m ? (m[1].toLowerCase() === 'a' ? 'am' : 'pm') : null; };
  /* the chooser's labels as the language writes them, lower case: am / pm, a. m. / p. m. */
  function ampmLabels() { const sel = $('birth-ampm'); if (!sel) return; for (const o of sel.options) o.textContent = SD.i18n.t('ui.' + (o.value === '24' ? 'h24' : o.value)); }
  function normTime(txt, mode = '24') {
    mode = ampmOf(txt) || mode;
    const d = digitsOf(txt);
    if (!d.length) return txt.trim();
    let h = d.length <= 2 ? +d : +d.slice(0, d.length - 2), m = d.length <= 2 ? 0 : +d.slice(-2);
    if (mode !== '24') { if (h < 1 || h > 12) return ''; h = h % 12 + (mode === 'pm' ? 12 : 0); }
    if (h > 23 || m > 59) return '';
    return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
  }
  /* a moment typed in the clock: a date alone means noon; an hour alone (2026-07-12 14) means on the hour */
  const normStamp = txt => {
    const sep = txt.trim().match(/^(\d{4})\D(\d{1,2})\D(\d{1,2})(?:\s+(\d{1,2})(?::?(\d{2}))?)?$/) || txt.trim().match(/^(\d{1,2})\D(\d{1,2})\D(\d{4})(?:\s+(\d{1,2})(?::?(\d{2}))?)?$/);
    if (sep) {                                                // written with its own separators: read by them, so 2026-7-12 9:5 is fine
      const ymd = sep[1].length === 4 ? [sep[1], sep[2], sep[3]] : [sep[3], sep[2], sep[1]], p2 = x => String(x).padStart(2, '0');
      txt = `${ymd[0]}${p2(ymd[1])}${p2(ymd[2])}${sep[4] ? p2(sep[4]) + (sep[5] || '00') : ''}`;
    }
    const d = digitsOf(txt); if (d.length < 8) return txt.trim();
    const t = d.slice(8, 12), day = normDate(d.slice(0, 8)), [y, m, dd] = day.split('-').map(Number), x = new Date(Date.UTC(y, m - 1, dd));
    if (!(y >= 1000 && y <= 3000 && x.getUTCMonth() === m - 1 && x.getUTCDate() === dd)) return txt.trim();   // 2026-13-40 or 31 February: refused, not rolled over
    return `${day} ${!t ? '12:00' : normTime(t.length <= 2 ? t.padStart(2, '0') + '00' : t)}`;
  };
  /* while typing, the separators appear on their own: 1990-11-27, 27-11-1990, 11:05, 9:05. the date is read as
     yyyy… when it opens with 19 or 20, as dd-mm-yyyy otherwise; the time as h:mm when its first two digits exceed 23.
     the saved value is always yyyy-mm-dd and hh:mm (normDate, normTime). */
  const datePat = d => {
    if (d.length >= 6) return (+d.slice(0, 4) < 1800 || +d.slice(4, 6) > 12) ? 'dd-dd-dddd' : 'dddd-dd-dd';   // the same test as normDate
    return (/^(19|20)/.test(d) || d.length < 2) ? 'dddd-dd-dd' : 'dd-dd-dddd';
  };
  const timePat = (d, top = 23) => (d.length >= 2 && d.length < 4 && +d.slice(0, 2) > top) ? 'd:dd' : 'dd:dd';   // three digits: 905 reads 9:05 (130 reads 1:30 in 12-hour); four are always hh:mm, so 2510 stays 25:10 and is refused
  const PATTERNS = { date: datePat, time: timePat, stamp: d => datePat(d.slice(0, 8)) + ' ' + timePat(d.slice(8)) };
  function liveFormat(el, kind) {
    /* the caret stays where the hand put it: a digit changed in the middle is changed in place, and the separators
       re-form around it. backspace over a separator deletes the digit before it */
    let prev = el.value;
    el.addEventListener('focus', () => { prev = el.value; });
    el.addEventListener('input', e => {
      if (kind === 'time' && $('birth-ampm') && el.id === 'birth-time') { const ap = ampmOf(el.value); if (ap) $('birth-ampm').value = ap; }   // "pm" typed moves into the chooser
      const twelve = kind === 'time' && el.id === 'birth-time' && $('birth-ampm') && $('birth-ampm').value !== '24';
      const v = el.value, pos = el.selectionStart == null ? v.length : el.selectionStart;
      if (pos < v.length) { prev = v; return; }              // an edit inside the line is left exactly as typed; the separators form only at the end
      let digits = digitsOf(v), before = digitsOf(v.slice(0, pos)).length;
      if (e.inputType === 'deleteContentBackward' && digits === digitsOf(prev) && before > 0) { digits = digits.slice(0, before - 1) + digits.slice(before); before--; }
      const pattern = twelve ? timePat(digits, 12) : PATTERNS[kind](digits); let out = '', k = 0;
      for (const ch of pattern) { if (k >= digits.length) break; if (ch === 'd') out += digits[k++]; else out += ch; }
      let c = 0; for (let n = 0; c < out.length && n < before; c++) if (/\d/.test(out[c])) n++;
      if (out !== v) el.value = out;
      if (out !== v || c !== pos) { try { el.setSelectionRange(c, c); } catch (err) { /* number keyboards */ } }
      prev = out;
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
    S.lang = l; store.set('lang', l); SD.i18n.set(l); SD.i18n.apply(); ampmLabels(); glossaryTerms(); glossaryLang = null;
    if ($('set-lang').value !== l) $('set-lang').value = l;
    requestAnimationFrame(slideSeg);
    if (!$('menu').hidden) refreshMenu();
    document.querySelectorAll('[data-about]').forEach(el => { el.hidden = el.dataset.about !== l; });
    scan.key = null;                                        // the week's labels are rebuilt in the new language
    if (S.state) recompute(); drawNexts();
  }

  async function start() {
    SD.i18n.set(S.lang); SD.i18n.apply(); ampmLabels();
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
  SD.app = { start, exportPNG, exportWallpaper, setLang, S, viewState, view, voicing, audio, reportText };
  start();
})(window.SD = window.SD || {});
