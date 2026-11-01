/*  siderarium — engine
    sky → state. Pure computation, no drawing. This file is the part that
    survives every port (desktop, android, wallpaper, the daily export).
*/
(function (SD) {
  'use strict';
  const A = window.Astronomy;
  const C = SD.corr;
  const D2R = Math.PI / 180, R2D = 180 / Math.PI;
  const norm360 = x => ((x % 360) + 360) % 360;
  const norm180 = x => { const y = norm360(x); return y > 180 ? y - 360 : y; };
  const sep = (a, b) => Math.abs(norm180(a - b));
  const WINDOW_DAYS = 1.5;   // "exact on that day": the portal is open within about a day and a half of exactness
  const MOON_WINDOW_DAYS = 0.25;   // the moon's windows are hours: it moves a degree every two hours

  /* ---------- positions ---------- */
  function eclipticOfDate(body, t) {
    const v = A.GeoVector(body, t, true);
    const r = A.RotateVector(A.Rotation_EQJ_ECT(t), v);
    return A.SphereFromVector(r).lon;
  }
  function eclToEq(lonDeg, eps) {
    const l = lonDeg * D2R;
    const ra = Math.atan2(Math.sin(l) * Math.cos(eps), Math.cos(l));
    const dec = Math.asin(Math.sin(eps) * Math.sin(l));
    return { ra: norm360(ra * R2D), dec: dec * R2D };
  }
  function semiArc(decDeg, latDeg) {
    const x = -Math.tan(latDeg * D2R) * Math.tan(decDeg * D2R);
    if (x <= -1) return 180;      // circumpolar, never sets
    if (x >= 1) return 0;         // never rises
    return Math.acos(x) * R2D;
  }
  /* Placidian mundane position: 0 at rising, 3 culminating, 6 setting, 9 anti-culminating.
     Each unit is one third of the body's own semi-arc — the same unequal division as the planetary hours. */
  function mundane(H, dsa) {
    const d = Math.min(179.5, Math.max(0.5, dsa)), n = 180 - d;
    if (H >= -d && H < 0) return 3 * (H + d) / d;
    if (H >= 0 && H < d) return 3 + 3 * H / d;
    if (H >= d) return 6 + 3 * (H - d) / n;
    return 9 + 3 * (H + 180) / n;
  }
  const houseOf = p => 12 - Math.floor(norm360(p * 30) / 30);

  function angles(t, loc, eps) {
    const gast = A.SiderealTime(t);
    const ramc = norm360(gast * 15 + loc.lon);
    const R = ramc * D2R, phi = loc.lat * D2R;
    const mc = norm360(Math.atan2(Math.sin(R), Math.cos(R) * Math.cos(eps)) * R2D);
    const asc = norm360(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(eps) + Math.tan(phi) * Math.sin(eps))) * R2D);
    return { ramc, mc, asc, lst: ramc };
  }

  /* Placidus cusps by semi-arc iteration (for the chart mode) */
  function placidus(ramc, lat, eps, asc, mc) {
    const cusp = (frac, below) => {
      let ra = norm360(ramc + (below ? 180 : 0) + frac * 90 * (below ? 1 : 1));
      let lon = 0;
      for (let i = 0; i < 30; i++) {
        lon = norm360(Math.atan2(Math.sin(ra * D2R), Math.cos(ra * D2R) * Math.cos(eps)) * R2D);
        const dec = Math.asin(Math.sin(eps) * Math.sin(lon * D2R)) * R2D;
        const dsa = semiArc(dec, lat);
        ra = below ? norm360(ramc + dsa + frac * (180 - dsa) * 3 / 3) : norm360(ramc + frac * dsa);
      }
      return lon;
    };
    // above horizon, east: 11 = 1/3, 12 = 2/3 of diurnal semi-arc from MC
    const c11 = cusp(1 / 3, false), c12 = cusp(2 / 3, false);
    // below horizon, east: 2 = 1/3, 3 = 2/3 of nocturnal semi-arc past the ascendant
    const c2 = cusp(1 / 3, true), c3 = cusp(2 / 3, true);
    const c = [];
    c[1] = asc; c[2] = c2; c[3] = c3; c[4] = norm360(mc + 180);
    c[5] = norm360(c11 + 180); c[6] = norm360(c12 + 180); c[7] = norm360(asc + 180);
    c[8] = norm360(c2 + 180); c[9] = norm360(c3 + 180); c[10] = mc; c[11] = c11; c[12] = c12;
    return c;
  }
  /* Regiomontanus cusps (Lilly's system): the equator divided into twelve from the meridian, each division carried
     to the ecliptic by a great circle through the north and south points of the horizon. Such a circle is the horizon
     of a latitude whose tangent is tan(lat)·sin(H), so each cusp is an ascendant computed for that pole. */
  function regiomontanus(ramc, lat, eps, asc, mc) {
    const phi = lat * D2R;
    const cuspAt = H => {
      const pole = Math.atan(Math.tan(phi) * Math.sin(H * D2R));
      const R = (ramc + H - 90) * D2R;
      return norm360(Math.atan2(Math.cos(R), -(Math.sin(R) * Math.cos(eps) + Math.tan(pole) * Math.sin(eps))) * R2D);
    };
    const c = [];
    c[1] = asc; c[10] = mc; c[11] = cuspAt(30); c[12] = cuspAt(60); c[2] = cuspAt(120); c[3] = cuspAt(150);
    c[4] = norm360(mc + 180); c[7] = norm360(asc + 180);
    c[5] = norm360(c[11] + 180); c[6] = norm360(c[12] + 180); c[8] = norm360(c[2] + 180); c[9] = norm360(c[3] + 180);
    return c;
  }
  function equalHouses(asc) { const c = []; for (let k = 1; k <= 12; k++) c[k] = norm360(asc + (k - 1) * 30); return c; }
  function houseIn(cusps, lon) {
    for (let k = 1; k <= 12; k++) { const a = cusps[k], b = cusps[k % 12 + 1]; if (norm360(lon - a) < norm360(b - a)) return k; }
    return 1;
  }

  /* ---------- dignity ---------- */
  function dignity(key, signIdx, deg, isDay) {
    const s = C.SIGNS[signIdx], labels = [];
    let score = 0, positive = false;
    const P = C.PLANETS[key];
    if (P.kind === 'optic') return { score: 0, labels: [], peregrine: false };   // the outer planets have no essential dignity
    if ((C.DOMICILE[key] || []).includes(s.key)) { score += 5; labels.push('domicile'); positive = true; }
    const opp = C.SIGNS[(signIdx + 6) % 12].key;
    if ((C.DOMICILE[key] || []).includes(opp)) { score -= 5; labels.push('detriment'); }
    if (P.kind === 'optic') return { score, labels, peregrine: false };
    if (C.EXALTATION[key] === s.key) { score += 4; labels.push('exaltation'); positive = true; }
    if (C.EXALTATION[key] === opp) { score -= 4; labels.push('fall'); }
    if (C.TRIPLICITY[s.element][isDay ? 0 : 1] === key) { score += 3; labels.push('triplicity'); positive = true; }
    const term = C.TERMS[s.key].find(tr => deg < tr[1]);
    if (term && term[0] === key) { score += 2; labels.push('term'); positive = true; }
    if (C.faceRuler(signIdx * 3 + Math.floor(deg / 10)) === key) { score += 1; labels.push('face'); positive = true; }
    const peregrine = !positive;
    if (peregrine) { score -= 5; labels.push('peregrine'); }
    return { score, labels, peregrine };
  }

  /* ---------- planetary day and hour ---------- */
  function weekdayAt(date, loc) {
    if (loc.tz) {
      const w = new Intl.DateTimeFormat('en-GB', { weekday: 'short', timeZone: loc.tz }).format(date);
      return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(w);
    }
    return new Date(date.getTime() + loc.lon / 15 * 3600e3).getUTCDay();
  }
  function planetaryHour(t, obs, loc, full) {
    const S = A.Body.Sun;
    let rise = A.SearchRiseSet(S, obs, +1, t.AddDays(-1.1), 1.2);
    if (!rise) return fallbackHour(t, loc);
    for (;;) {
      const r2 = A.SearchRiseSet(S, obs, +1, rise.AddDays(0.01), 1.2);
      if (r2 && r2.ut <= t.ut) rise = r2; else break;
    }
    const set = A.SearchRiseSet(S, obs, -1, rise, 1.2);
    if (!set) return fallbackHour(t, loc);
    const dayRuler = C.WEEKDAY_RULER[weekdayAt(rise.date, loc)];
    let isDay, start, len, idx, next = null;
    if (t.ut < set.ut) {
      isDay = true; start = rise.ut; len = (set.ut - rise.ut) / 12; idx = Math.floor((t.ut - start) / len);
    } else {
      next = A.SearchRiseSet(S, obs, +1, set, 1.2);
      if (!next) return fallbackHour(t, loc);
      isDay = false; start = set.ut; len = (next.ut - set.ut) / 12; idx = 12 + Math.floor((t.ut - start) / len);
    }
    idx = Math.max(0, Math.min(23, idx));
    const first = C.CHALDEAN.indexOf(dayRuler);
    const ruler = C.CHALDEAN[(first + idx) % 7];
    let table = null;
    if (full) {                                            // the day's 24 hours, for the readout
      if (!next) next = A.SearchRiseSet(S, obs, +1, set, 1.2);
      const dl = (set.ut - rise.ut) / 12, nl = next ? (next.ut - set.ut) / 12 : dl;
      table = [];
      for (let i = 0; i < 24; i++) {
        const ut = i < 12 ? rise.ut + i * dl : set.ut + (i - 12) * nl;
        table.push({ index: i, ruler: C.CHALDEAN[(first + i) % 7], start: new Date(Date.UTC(2000, 0, 1, 12) + ut * 864e5), isDay: i < 12 });   // ut = days since J2000
      }
    }
    return { dayRuler, hourRuler: ruler, index: idx, isDay, angel: C.PLANETS[ruler].angel, dayAngel: C.PLANETS[dayRuler].angel,
      sunrise: rise.date, sunset: set.date, nextSunrise: next ? next.date : null, hourLengthMin: len * 1440, table };
  }
  function fallbackHour(t, loc) {
    const local = new Date(t.date.getTime() + loc.lon / 15 * 3600e3);
    const h = local.getUTCHours() + local.getUTCMinutes() / 60;
    const isDay = h >= 6 && h < 18;
    const idx = isDay ? Math.floor(h - 6) : 12 + Math.floor(((h - 18) + 24) % 24);
    const dayRuler = C.WEEKDAY_RULER[(local.getUTCDay() + (h < 6 ? 6 : 0)) % 7];
    const ruler = C.CHALDEAN[(C.CHALDEAN.indexOf(dayRuler) + idx) % 7];
    return { dayRuler, hourRuler: ruler, index: idx, isDay, angel: C.PLANETS[ruler].angel, dayAngel: C.PLANETS[dayRuler].angel, polar: true };
  }

  /* ---------- aspects and hierarchy ---------- */
  function synodic(a, b) {
    const k = [a, b].sort((x, y) => C.ORDER.indexOf(x) - C.ORDER.indexOf(y)).join('|');
    if (C.SYNODIC_OVERRIDE[k]) return C.SYNODIC_OVERRIDE[k];
    const pa = C.PLANETS[a].period, pb = C.PLANETS[b].period;
    const d = Math.abs(1 / pa - 1 / pb);
    return d < 1e-9 ? 365.25 : 1 / d;
  }
  const rarity = (a, b) => Math.min(1, Math.max(0, (Math.log10(synodic(a, b)) - 1.4) / 3.9));

  function findAspects(B) {
    const out = [];
    const keys = C.ORDER;
    for (let i = 0; i < keys.length; i++) for (let j = i + 1; j < keys.length; j++) {
      const a = B[keys[i]], b = B[keys[j]];
      const d = sep(a.lon, b.lon);
      const lum = (keys[i] === 'sun' || keys[i] === 'moon' || keys[j] === 'moon');
      let best = null;
      for (const asp of C.ASPECTS) {
        const orbMax = asp.orb + (lum && asp.n <= 6 ? 2 : 0);
        const orb = Math.abs(d - asp.angle);
        if (orb <= orbMax && (!best || orb / orbMax < best.orb / best.orbMax)) best = { asp, orb, orbMax };
      }
      if (!best) continue;
      // applying: is the orb shrinking over the next hour?
      const d1 = sep(a.lon + a.speed / 24, b.lon + b.speed / 24);
      const applying = Math.abs(d1 - best.asp.angle) < best.orb;
      const exact = 1 - best.orb / best.orbMax;
      // a window is measured in time, not degrees: slow pairs linger in orb for years,
      // so they open the portal only in the days around the exact pass
      const rate = Math.abs(d1 - d) * 24;                              // degrees per day
      const days = best.orb < 0.1 ? 0 : best.orb / Math.max(rate, 1e-4);
      const isMoon = a.key === 'moon' || b.key === 'moon';
      const windowT = Math.exp(-0.5 * Math.pow(days / (isMoon ? MOON_WINDOW_DAYS : WINDOW_DAYS), 2));
      const rar = rarity(a.key, b.key);
      // a whole-sign aspect that does not hold by sign (29° aries – 1° virgo) is dissociate: half weight
      const wholeSigns = best.asp.angle % 30 === 0 ? best.asp.angle / 30 : null;
      const signDist = Math.min((b.sign - a.sign + 12) % 12, (a.sign - b.sign + 12) % 12);
      const dissociate = wholeSigns !== null && signDist !== wholeSigns;
      let mods = (applying ? 1.2 : 0.8) * (dissociate ? 0.5 : 1);
      if (a.station || b.station) mods *= 1.5;
      if ((a.key === 'sun' || b.key === 'sun') && !(a.key === 'moon' || b.key === 'moon')) mods *= 1.2;
      const sky = (0.2 + 0.8 * rar) * best.asp.weight * (0.3 * Math.pow(exact, 1.5) + 0.7 * windowT) * mods;   // the sky's own weight
      if (a.angular || b.angular) mods *= 1.3;                                                                // local: the horizon turning
      const power = (0.2 + 0.8 * rar) * best.asp.weight * (0.3 * Math.pow(exact, 1.5) + 0.7 * windowT) * mods;
      out.push({
        a: a.key, b: b.key, aspect: best.asp.key, n: best.asp.n, k: best.asp.k, nature: best.asp.nature,
        angle: best.asp.angle, orb: best.orb, orbMax: best.orbMax, exact, applying, rarity: rar, power, sky, days, window: windowT,
        moon: a.key === 'moon' || b.key === 'moon', dissociate, signs: signDist
      });
    }
    return out.sort((x, y) => y.power - x.power);
  }

  function findEvents(t, B, aspects, light) {
    const ev = [];
    if (!light) try {
      const le = A.SearchLunarEclipse(t.AddDays(-1));
      if (le && Math.abs(le.peak.ut - t.ut) < 1) ev.push({ type: 'eclipse', kind: 'lunar', priority: 100, at: le.peak.date });
      const se = A.SearchGlobalSolarEclipse(t.AddDays(-1));
      if (se && Math.abs(se.peak.ut - t.ut) < 1) ev.push({ type: 'eclipse', kind: 'solar', priority: 100, at: se.peak.date });
    } catch (e) { /* eclipse search is best-effort */ }
    const sm = aspects.find(x => x.a === 'sun' && x.b === 'moon');
    if (sm && (sm.aspect === 'conjunction' || sm.aspect === 'opposition') && sm.orb < 1.5)
      ev.push({ type: 'lunation', kind: sm.aspect === 'conjunction' ? 'new moon' : 'full moon', priority: 90, aspect: sm });
    for (const k of C.ORDER) {
      if (k === 'sun') continue;
      const b = B[k];
      if (b.cazimi) ev.push({ type: 'cazimi', planet: k, priority: 80 });
      if (b.station) ev.push({ type: 'station', planet: k, priority: 60, direction: b.speed < 0 ? 'retrograde' : 'direct' });
    }
    const slow = ['jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
    for (const a of aspects) if (slow.includes(a.a) && slow.includes(a.b) && a.orb < 0.25 && a.n <= 6)
      ev.push({ type: 'outer exact', aspect: a, priority: 70 });
    return ev.sort((x, y) => y.priority - x.priority);
  }

  /* The figure: one primary configuration, up to two secondary rings, a lunar ripple. */
  function selectConfigs(aspects, events, B) {
    const configs = [];
    const lunation = events.find(e => e.type === 'lunation');
    const eclipse = events.find(e => e.type === 'eclipse');
    if (lunation) configs.push(Object.assign({}, lunation.aspect, { power: Math.max(1.2, lunation.aspect.power * 3), event: eclipse ? eclipse.kind + ' eclipse' : lunation.kind }));
    for (const e of events) if (e.type === 'cazimi') {
      const a = aspects.find(x => x.a === 'sun' && x.b === e.planet);
      if (a) configs.push(Object.assign({}, a, { power: Math.max(1.0, a.power * 2.5), event: 'cazimi' }));
    }
    for (const e of events) if (e.type === 'outer exact') {
      if (!configs.find(c => c.a === e.aspect.a && c.b === e.aspect.b)) configs.push(Object.assign({}, e.aspect, { power: e.aspect.power * 2, event: 'exact' }));
    }
    for (const a of aspects) {
      if (configs.length >= 3) break;
      if (configs.find(c => c.a === a.a && c.b === a.b)) continue;
      if (a.power < 0.08) continue;
      configs.push(a);
    }
    configs.sort((x, y) => y.power - x.power);
    const stations = events.filter(e => e.type === 'station').map(e => ({ type: 'station', planet: e.planet, direction: e.direction, n: C.PLANETS[e.planet].number || 0, power: 0.5 }));
    const ripple = aspects.find(a => a.moon && a.a !== 'sun') || null;
    const primary = configs[0] || null;
    return { primary, secondary: configs.slice(1, 3), stations, ripple, ...portalShape(B, aspects, primary) };
  }

  /* Portal shape. Jupiter owns scale, Saturn owns restriction: the portal grows or shrinks with
     their dignity and with their part in the figure. A hard aspect from a third planet to either
     planet of the figure removes a wedge, pointed at the afflicting planet. The moon never cuts. */
  function portalShape(B, aspects, primary) {
    if (!primary) return { scale: 1, expansion: 0, cut: null };
    const inv = k => k === primary.a || k === primary.b;
    const jx = B.jupiter.dignity.score / 10, sx = B.saturn.dignity.score / 10;
    let e = 0.3 * (jx - sx) + (inv('jupiter') ? 0.6 : 0) - (inv('saturn') ? 0.6 : 0)
      + (inv('venus') || inv('sun') ? 0.15 : 0) - (inv('pluto') ? 0.3 : 0);
    if (e > 0) e *= 1 - 0.5 * B.jupiter.slow;            // jupiter slowing: the expansion turns inward
    const scale = Math.max(0.5, Math.min(1.5, 1 + 0.45 * e));
    let cut = null;
    for (const a of aspects) {
      const malefic = (a.a === 'mars' || a.a === 'saturn' || a.b === 'mars' || a.b === 'saturn');
      if (a.nature !== 'hard' && !(a.aspect === 'conjunction' && malefic)) continue;
      if (a.moon && !a.applying) continue;                // the moon afflicts by what it moves toward
      const ia = inv(a.a), ib = inv(a.b);
      if (ia === ib) continue;                             // exactly one planet of the figure
      if (a.power < 0.06) continue;
      if (!cut || a.power > cut.power) cut = { by: ia ? a.b : a.a, target: ia ? a.a : a.b, aspect: a.aspect, power: a.power,
        width: Math.max(24, Math.min(100, 24 + 70 * Math.min(1, a.power * 1.5))) };
    }
    return { scale, expansion: e, cut };
  }

  /* The moon's electional condition: is the moment ripe?
     next = the first Ptolemaic aspect the moon will perfect with a classical planet before leaving its sign.
     none = void of course. Applying to mars or saturn by conjunction, square or opposition = afflicted.
     Within 12° of the sun = under the beams (combust within 8.5°). 15° libra – 15° scorpio = via combusta. */
  function moonCondition(B, eps) {
    const m = B.moon, left = 30 - m.deg;
    const angles = [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]];
    let next = null;
    for (const k of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
      const p = B[k], rel = m.speed - p.speed;
      if (rel <= 0) continue;
      for (const [name, A] of angles) for (const sgn of A === 0 || A === 180 ? [1] : [1, -1]) {
        const target = p.lon + sgn * A;
        const dist = norm360(target - m.lon);                // ahead of the moon
        const days = dist / rel;
        if (dist > 0.01 && m.speed * days <= left && (!next || days < next.days)) next = { planet: k, aspect: name, days };
      }
    }
    const dSun = sep(m.lon, B.sun.lon);
    const flags = [];
    if (!next) flags.push('void of course');
    if (dSun < 8.5) flags.push('combust'); else if (dSun < 12) flags.push('under the beams');
    if (m.lon >= 195 && m.lon < 225) flags.push('via combusta');
    let ripe = 0;
    if (!next) ripe -= 1;
    else {
      const mal = next.planet === 'mars' || next.planet === 'saturn', ben = next.planet === 'venus' || next.planet === 'jupiter';
      const hardA = next.aspect === 'square' || next.aspect === 'opposition' || (next.aspect === 'conjunction' && mal);
      if (mal && hardA) ripe -= 0.7; else if (hardA) ripe -= 0.35;
      if (ben || next.aspect === 'trine' || next.aspect === 'sextile') ripe += 0.6;
    }
    if (dSun < 8.5) ripe -= 0.7; else if (dSun < 12) ripe -= 0.4;
    if (m.lon >= 195 && m.lon < 225) ripe -= 0.3;
    if (m.speed > 13.2) ripe += 0.1;
    const verdict = !next ? 'void' : ripe >= 0.3 ? 'ripe' : ripe <= -0.3 ? 'unripe' : 'open';
    const tolerable = verdict === 'void' && [1, 3, 8, 11].includes(m.sign);   // lilly: void in taurus, cancer, sagittarius or pisces 'performs somewhat'
    return { next, flags, ripe, verdict, tolerable };
  }

  /* The chord of the moment. Each planet of the two strongest figures sounds the note of the sign it stands in
     (Case's colour–note scale). Three or more notes forming a known chord are named; otherwise the
     figure's two planets give a dyad written lower note first, with the interval named: C–E · major third. */
  const CHORDS = [
    [[0, 4, 7, 11], 'maj7'], [[0, 4, 7, 10], '7'], [[0, 3, 7, 10], '-7'], [[0, 3, 6, 10], 'ø'], [[0, 3, 6, 9], 'dim7'],
    [[0, 4, 7], ''], [[0, 3, 7], '-'], [[0, 3, 6], 'dim'], [[0, 4, 8], '+'], [[0, 5, 7], 'sus4'], [[0, 2, 7], 'sus2']
  ];
  function chordOf(st) {
    // the harmony of the sky: the two strongest figures, moon included, weighed without the turning horizon
    const figs = st.aspects.filter(a => a.sky >= 0.08).sort((x, y) => y.sky - x.sky).slice(0, 2);
    if (!figs.length) return { name: 'none', notes: [] };
    const planets = [...new Set(figs.flatMap(f => [f.a, f.b]))];
    const pcs = [...new Set(planets.map(k => st.bodies[k].sign))].sort((a, b) => a - b);
    const N = C.NOTES;
    /* the voices: the figure's planets, then the Moon always (she alone moves at the clock's pace), then the
       guardians of the day and the hour as the ground. each voice carries its altitude: the register follows the sky. */
    const voiceOf = (k, role) => ({ planet: k, role, pc: st.bodies[k].sign, note: N[st.bodies[k].sign], alt: st.bodies[k].alt });
    const voices = planets.map(k => voiceOf(k, 'figure'));
    if (!planets.includes('moon')) voices.push(voiceOf('moon', 'moon'));
    if (st.hour) { voices.push(voiceOf(st.hour.dayRuler, 'day')); if (st.hour.hourRuler !== st.hour.dayRuler) voices.push(voiceOf(st.hour.hourRuler, 'hour')); }
    const extra = { voices, moonNote: planets.includes('moon') ? null : N[st.bodies.moon.sign], ground: voices.filter(v => v.role === 'day' || v.role === 'hour') };
    for (const [tmpl, suffix] of CHORDS) {
      if (tmpl.length !== pcs.length) continue;
      for (const root of pcs) {
        const set = tmpl.map(i => (root + i) % 12).sort((a, b) => a - b);
        if (set.join() === pcs.join()) return { name: N[root] + suffix, notes: pcs.map(i => N[i]), planets, root, pcs, ...extra };
      }
    }
    const ra = st.bodies[figs[0].a].sign, rb = st.bodies[figs[0].b].sign;
    let lo = ra, hi = rb, d = (rb - ra + 12) % 12;
    if (d > 6) { lo = rb; hi = ra; d = 12 - d; }
    const interval = C.INTERVALS[d];
    return { name: d === 0 ? N[lo] : `${N[lo]}–${N[hi]}`, interval, notes: pcs.map(i => N[i]), planets, dyad: true, root: lo, pcs: d === 0 ? [lo] : [lo, hi], ...extra };
  }

  /* The three windows: how far the moment serves ideation, incarnation, destruction (0..1).
     The figure's planets and their signs must belong to the mother, the figure's nature must match it,
     and the moment must be beautiful for that work: whole, with harmonious guardians and a ripe moon
     (destruction takes the cut, the clash and the waning moon instead). */
  /* The mode of the moment, after the three mothers of the Sefer Yetzirah read as the text has them: Mem (water) and
     Shin (fire) are the two poles, Aleph (air) is "the tongue of the balance" between them (SY 2:1, 3:1). Shin gathers
     what breaks: a hard figure, heavier with a malefic in it, a malefic conjunction, a malefic cut, the void waning
     Moon, the fire family. Mem gathers what lands: a figure just past exactness and separating, a soft figure between
     benefics, the ripe Moon, the water and earth family. Aleph is the balance itself, high when the poles are even or
     both weak, lifted by an applying soft figure and the air family. The Moon's own figures are left out of the mode:
     they flip by the hour and belong to the state, not the mode. The reading of the mothers as poles is [SD]. */
  function modeOf(st) {
    const cf = st.configs, m = st.moon;
    const malefic = k => k === 'mars' || k === 'saturn' || k === 'pluto';
    const benefic = k => k === 'venus' || k === 'jupiter';
    const figs = [cf.primary, ...(cf.secondary || [])].filter(f => f && !f.moon);
    const p = figs[0] || cf.primary;
    const any = xs => 1 - xs.reduce((a, x) => a * (1 - Math.max(0, Math.min(1, x))), 1);   // "any of these": one strong cause is enough
    const fam = (f, M) => f ? ([f.a, f.b].reduce((a, k) => a + (M.planets[k] || 0), 0) / 2) : 0;
    const el = (f, M) => f ? ([f.a, f.b].reduce((a, k) => a + (M.elements.includes(C.SIGNS[st.bodies[k].sign].element) ? 1 : 0), 0) / 2) : 0;
    const strength = f => f ? Math.min(1, Math.sqrt(f.power / 0.3)) : 0;
    const landing = f => (f && !f.applying && f.days !== undefined) ? Math.exp(-f.days / 0.75) : 0;
    const M = C.MOTHERS;
    let shin = 0, mem = 0, aleph = 0;
    if (p) {
      const s = strength(p), withMalefic = malefic(p.a) || malefic(p.b), withBenefic = benefic(p.a) || benefic(p.b);
      shin = any([
        p.nature === 'hard' ? (withMalefic ? 0.9 : 0.45) * s : 0,
        p.nature === 'fusion' && withMalefic ? 0.7 * s : 0,
        cf.cut && malefic(cf.cut.by) ? 0.6 : 0,
        m.verdict === 'void' && !m.waxing ? 0.35 : 0,
        0.3 * fam(p, M.destruction) * el(p, M.destruction)
      ]);
      mem = any([
        0.9 * Math.max(...figs.map(landing), 0) * s,
        p.nature !== 'hard' && withBenefic ? 0.6 * s : 0,
        m.verdict === 'ripe' ? 0.3 : 0,
        0.3 * fam(p, M.incarnation) * Math.max(el(p, M.incarnation), 0.5)
      ]);
      const balance = (1 - Math.abs(shin - mem)) * (1 - 0.5 * Math.max(shin, mem));
      aleph = any([
        balance,
        p.nature !== 'hard' && p.applying ? 0.5 * s : 0,
        0.3 * fam(p, M.ideation) * Math.max(el(p, M.ideation), 0.5)
      ]);
    } else { aleph = 0.6; mem = m.waxing ? 0.3 : 0.2; shin = m.waxing ? 0.2 : 0.3; }
    const w = { ideation: Math.max(0.05, aleph), incarnation: Math.max(0.05, mem), destruction: Math.max(0.05, shin) };
    const sum = w.ideation + w.incarnation + w.destruction;
    const share = { ideation: w.ideation / sum, incarnation: w.incarnation / sum, destruction: w.destruction / sum };
    const key = Object.entries(w).sort((a, b) => b[1] - a[1])[0][0];
    return { key, w, share, quiet: !p };
  }
  /* Whether the magician can work at all: time to work, time to watch, time to shelter. Shelter: a storm, the fiery
     pole strong while the Moon is weak, or a malefic cutting the portal with the Moon unripe or void. Work: the Moon
     ripe (or open with a strong soft figure), a figure of some strength, the fiery pole not in command. Watch: between. */
  function stateOf(st) {
    const m = st.moon, p = st.configs.primary, cut = st.configs.cut, md = st.mode;
    const malefic = k => k === 'mars' || k === 'saturn' || k === 'pluto';
    const weakMoon = m.verdict === 'unripe' || (m.verdict === 'void' && !m.tolerable);
    const storm = (md.w.destruction >= 0.6 && weakMoon) || (cut && malefic(cut.by) && weakMoon) || (st.events || []).some(e => e.type === 'eclipse');
    if (storm) return 'shelter';
    if (weakMoon) return 'watch';
    const strong = p && p.power >= 0.12;
    const open = m.verdict === 'ripe' || (m.verdict === 'open' && p && p.nature !== 'hard' && p.power >= 0.2);
    if (open && strong && md.w.destruction < 0.5 && !(cut && malefic(cut.by))) return 'work';
    return 'watch';
  }
  function windowsOf(st) {
    const cf = st.configs, p = cf.primary, out = {};
    const figs = [p, ...cf.secondary].filter(Boolean);
    const gcd = (a, b) => (b ? gcd(b, a % b) : a);
    const nd = C.PLANETS[st.hour.dayRuler].number, nh = C.PLANETS[st.hour.hourRuler].number;
    const guard = st.hour.dayRuler === st.hour.hourRuler ? 1 : gcd(nd, nh) > 1 ? 0.85 : 0.6;
    for (const [key, M] of Object.entries(C.MOTHERS)) {
      if (!p) { out[key] = 0; continue; }
      let fam = 0, el = 0, n = 0;
      for (const f of figs) {
        const w = f === p ? 1 : 0.5;
        for (const k of [f.a, f.b]) {
          fam += w * (M.planets[k] || 0);
          el += w * (M.elements.includes(C.SIGNS[st.bodies[k].sign].element) ? 1 : 0);
          n += w;
        }
      }
      fam /= n; el /= n;
      const soft = p.nature !== 'hard';
      const nature = M.wants === 'hard' ? (soft ? 0.35 : 1) : (soft ? 1 : 0.3);
      const v = st.moon.verdict;
      let beauty;
      if (key === 'destruction') beauty = (cf.cut ? 1 : 0.8) * (guard < 0.7 ? 1 : 0.85) * ({ ripe: 0.6, open: 0.8, unripe: 1, void: 0.3 }[v]) * (st.moon.waxing ? 0.8 : 1);
      else beauty = (cf.cut ? 0.55 : 1) * guard * ({ ripe: 1, open: 0.75, unripe: 0.4, void: 0.15 }[v]) * (key === 'incarnation' ? (st.moon.waxing ? 1 : 0.8) : 1);
      const strength = Math.min(1, Math.sqrt(p.power));
      out[key] = Math.min(1, strength * (0.4 + 0.6 * fam) * (0.5 + 0.5 * el) * nature * beauty * 1.6);   // the family and the element lift, they do not gate: the mode of the moment can carry a window
    }
    if (st.mode) for (const k of Object.keys(out)) out[k] *= st.mode.w[k];   // the mode of the moment leads; the others fall back
    return out;
  }

  /* The companion stone for the moment, against a chart [SD]. the rule: when it is time to work, go with the hour
     (the hour's ruler, or the planet of the leading harmonious transit); when it is time to watch, compensate (a malefic
     striking the chart is tempered by its antidote, Jupiter for Saturn, Venus for Mars; a light or benefic striking it
     is answered by supporting the planet struck; a soft leading transit by its own planet; no transit, by the mode);
     when it is time to shelter, Saturn's wall. among the planet's stones, after Agrippa, the one of the chart's dominant
     element comes first, the others follow as alternatives. */
  function stoneOf(st, natal, transits, inter) {
    const state = st.title.state, flavour = natal && natal.elements ? natal.elements.dominant : (st.elements ? st.elements.dominant : 'earth');
    const lead = transits && transits[0], malefic = k => k === 'mars' || k === 'saturn' || k === 'pluto', antidote = { saturn: 'jupiter', mars: 'venus', pluto: 'jupiter' };
    const classical = k => !!C.STONES[k];
    let planet, rule, why = null;
    if (state === 'shelter') { planet = 'saturn'; rule = 'wall'; }
    else if (state === 'work') { rule = 'flow'; planet = (lead && inter && inter.verdict === 'harmonyPrevails' && classical(lead.a) && lead.nature !== 'hard') ? lead.a : st.hour.hourRuler; if (lead && planet === lead.a) why = lead; }
    else {
      rule = 'balance';
      if (lead && (lead.nature === 'hard' || (lead.aspect === 'conjunction' && malefic(lead.a)))) {
        planet = malefic(lead.a) ? antidote[lead.a] : (classical(lead.b) ? lead.b : 'venus'); why = lead;
      } else if (lead && classical(lead.a)) { planet = lead.a; why = lead; }
      else planet = { destruction: 'jupiter', incarnation: 'venus', ideation: 'mercury' }[st.mode.key] || 'moon';
    }
    if (!classical(planet)) planet = 'moon';
    const list = C.STONES[planet].slice().sort((a, b) => (b[1] === flavour) - (a[1] === flavour));
    return { planet, rule, flavour, stone: list[0][0], alternatives: list.slice(1, 3).map(x => x[0]), why: why ? { a: why.a, aspect: why.aspect, b: why.b } : null };
  }
  /* The wheel of the year: the eight feasts by the calendar, in the place's own zone. the four solar points and the
     four cross-quarters; the names are the neopagan Wheel's, laid over older festivals (the veil also knows the
     astronomical doors, the Sun at 0°/15° of the signs). today's feast, if any, and the next with its date. */
  const WHEEL = [['yule', 12, 21], ['imbolc', 2, 1], ['ostara', 3, 20], ['beltane', 4, 30], ['litha', 6, 21], ['lammas', 8, 1], ['mabon', 9, 22], ['samhain', 10, 31]];
  function wheelOf(st) {
    const tz = (st.loc && st.loc.tz) || 'UTC';
    let p; try { p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(st.date).map(x => [x.type, x.value])); } catch (e) { return null; }
    const y = +p.year, m = +p.month, d = +p.day, todayN = m * 100 + d;
    const feast = (w, yy) => ({ key: w[0], date: new Date(Date.UTC(yy, w[1] - 1, w[2], 12)) });
    let today = null, next = null, days = 0;
    for (const w of WHEEL) if (w[1] === m && (w[2] === d || (w[0] === 'beltane' && m === 5 && d === 1) || (w[0] === 'imbolc' && m === 2 && d === 2) || (w[0] === 'samhain' && m === 11 && d === 1))) today = w[0];
    const ahead = WHEEL.map(w => [w, w[1] * 100 + w[2]]).filter(([w, n]) => n > todayN).sort((a, b) => a[1] - b[1]);
    const first = WHEEL.slice().sort((a, b) => (a[1] * 100 + a[2]) - (b[1] * 100 + b[2]))[0];   // after the year's last feast, the next is the first of the year to come
    const nw = ahead.length ? feast(ahead[0][0], y) : feast(first, y + 1);
    const dayUTC = Date.UTC(y, m - 1, d, 12);
    days = Math.round((nw.date.getTime() - dayUTC) / 864e5);
    return { today, next: nw.key, nextDate: nw.date, days };
  }
  /* The thinning of the veil, 0..1 [SD]. The between-times of the day (twilight, solar midnight), the Moon's light
     (dark, full), her place (water signs, water houses), her void, the hours of the Moon and of Saturn, the doors of
     the year (the cross-quarters, Samhain heaviest; the solstices and equinoxes lighter), an eclipse, and Neptune on
     the Moon or the angles. Each factor is a weight 0..1; they combine as "any of them": one strong cause opens it alone. */
  function veilOf(st) {
    const g = (x, s) => Math.exp(-0.5 * (x / s) * (x / s));
    const f = [], add = (key, w) => { if (w > 0.02) f.push({ key, w: Math.min(1, w) }); };
    const t = st.date.getTime(), h = st.hour, min = 60000;
    if (h && h.sunrise && h.sunset) {
      const rises = [h.sunrise, h.nextSunrise].filter(Boolean), sets = [h.sunset];
      let tw = 0; for (const r of rises) tw = Math.max(tw, g((t - r.getTime()) / min, 40)); for (const x of sets) tw = Math.max(tw, g((t - x.getTime()) / min, 40));
      add('twilight', 0.6 * tw);
      if (h.nextSunrise) add('midnight', 0.45 * g((t - (h.sunset.getTime() + h.nextSunrise.getTime()) / 2) / min, 40));
    }
    const ph = st.moon.phaseAngle, dark = Math.min(ph, 360 - ph);
    add('dark', 0.8 * g(dark, 25)); add('full', 0.6 * g(ph - 180, 20));
    const m = st.bodies.moon;
    if (C.SIGNS[m.sign].element === 'water') add('water', 0.45);
    if ([4, 8, 12].includes(m.house)) add('waterHouse', 0.4);
    if (st.moon.verdict === 'void') add('void', 0.5);
    if (h) { if (h.hourRuler === 'moon') add('moonHour', 0.45); else if (h.hourRuler === 'saturn') add('saturnHour', 0.4); if (h.dayRuler === 'moon' || h.dayRuler === 'saturn') add('day', 0.2); }
    const sl = st.bodies.sun.lon, dist = x => { const d = Math.abs(((sl - x) % 360 + 540) % 360 - 180); return d; };
    const doors = [['samhain', 225, 0.8], ['beltane', 45, 0.65], ['imbolc', 315, 0.45], ['lammas', 135, 0.45], ['litha', 90, 0.4], ['yule', 270, 0.4], ['ostara', 0, 0.4], ['mabon', 180, 0.4]];
    for (const [k, lon, w] of doors) add(k, w * g(dist(lon), 1.5));          // the doors as the Sun reaches them
    // the doors as the calendar keeps them: the nights of 31 October, 30 April, 1 February and 31 July, a bell of 14 hours about local midnight
    if (st.loc && st.loc.tz) {
      try {
        const pp = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: st.loc.tz, month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(st.date).map(x => [x.type, x.value]));
        const hm = +pp.hour + pp.minute / 60, md = pp.month + '-' + pp.day;
        const nights = { '10-31': ['samhain', 1, 1], '11-01': ['samhain', 1, -1], '04-30': ['beltane', 0.8, 1], '05-01': ['beltane', 0.8, -1], '02-01': ['imbolc', 0.55, 1], '02-02': ['imbolc', 0.55, -1], '07-31': ['lammas', 0.55, 1], '08-01': ['lammas', 0.55, -1] };
        const n = nights[md];
        if (n) { const hoursFromMidnight = n[2] > 0 ? 24 - hm : hm; add(n[0], n[1] * g(hoursFromMidnight, 14)); }
      } catch (e) { /* no zone: the Sun's doors alone */ }
    }
    if ((st.events || []).some(e => e.type === 'eclipse')) add('eclipse', 1);
    for (const a of st.aspects || []) if ((a.a === 'neptune' || a.b === 'neptune') && a.moon && ['conjunction', 'opposition', 'square'].includes(a.aspect)) add('neptune', 0.5 * a.exact);
    const np = st.bodies.neptune.lon;
    if ([st.asc, st.mc, (st.asc + 180) % 360, (st.mc + 180) % 360].some(x => dist.call(null, 0) >= 0 && Math.abs(((np - x) % 360 + 540) % 360 - 180) < 3)) add('neptuneAngle', 0.5);
    let v = 1; for (const x of f) v *= 1 - x.w;
    f.sort((a, b) => b.w - a.w);
    return { v: 1 - v, factors: f };
  }

  /* The next chord shift: walk forward in 10-minute steps until the chord's name changes,
     then halve the interval down to the minute. */
  function nextChordShift(date, loc, maxDays = 7) {
    const name = d => compute(d, loc, { light: true }).chord.name;
    const from = name(date), t0 = date.getTime(), step = 10 * 60000;
    for (let t = t0 + step; t <= t0 + maxDays * 864e5; t += step) {
      if (name(new Date(t)) === from) continue;
      let lo = t - step, hi = t;
      while (hi - lo > 60000) { const mid = (lo + hi) / 2; if (name(new Date(mid)) === from) lo = mid; else hi = mid; }
      return { at: new Date(Math.round(hi / 60000) * 60000), from, to: name(new Date(hi)) };
    }
    return null;
  }

  /* ---------- synastry: the sky of now against a nativity ----------
     Transiting planets to natal planets and angles: Ptolemaic aspects and the quincunx, tight orbs.
     power = weight × exactness^1.5 × slowness of the transiting planet: a Saturn contact outweighs a Moon contact. */
  const TRANSIT_ORB = { conjunction: 6, opposition: 6, square: 5, trine: 5, sextile: 3, quincunx: 2 };
  function computeTransits(cur, natal) {
    const out = [];
    const targets = [...C.ORDER.map(k => ({ key: k, lon: natal.bodies[k].lon })), { key: 'ascendant', lon: natal.asc }, { key: 'midheaven', lon: natal.mc }];
    for (const tk of C.ORDER) {
      const a = cur.bodies[tk];
      const slow = Math.min(1, Math.log10(C.PLANETS[tk].period) / 5);
      const lum = tk === 'sun' || tk === 'moon' ? 1 : 0;
      for (const n of targets) {
        const d = sep(a.lon, n.lon);
        let best = null;
        for (const asp of C.ASPECTS) {
          if (!TRANSIT_ORB[asp.key]) continue;
          const orbMax = TRANSIT_ORB[asp.key] + lum, orb = Math.abs(d - asp.angle);
          if (orb <= orbMax && (!best || orb < best.orb)) best = { asp, orb, orbMax };
        }
        if (!best) continue;
        const d1 = sep(a.lon + a.speed / 24, n.lon);
        const applying = Math.abs(d1 - best.asp.angle) < best.orb;
        const exact = 1 - best.orb / best.orbMax;
        const power = best.asp.weight * Math.pow(exact, 1.5) * (0.35 + 0.65 * slow) * (applying ? 1.15 : 0.9);
        out.push({ a: tk, b: n.key, natal: true, nlon: n.lon, aspect: best.asp.key, n: best.asp.n, k: best.asp.k, nature: best.asp.nature,
          angle: best.asp.angle, orb: best.orb, orbMax: best.orbMax, exact, applying, power, moon: tk === 'moon' });
      }
    }
    return out.sort((x, y) => y.power - x.power);
  }

  /* ---------- the pull between two charts ----------
     What the sources agree on, old and new. Ptolemy (Tetrabiblos IV.5) keeps the two matters apart: the luminaries in
     harmony make a marriage last, while Venus with Mars "produces merely amorous dispositions", ardent and impetuous;
     Valens (Anthologies II) gives Mars intercourse and the genitals, Venus desire and "the parts of intercourse", and
     reads Venus with Mars by conjunction or square as lechery, by trine as a union that follows the affair; Firmicus
     (Mathesis) the same. So desire is Venus and Mars across the charts, by any aspect, the hard ones no weaker than the
     soft. Ptolemy also gives the damper: Saturn on Venus makes "firm" but cold unions, Saturn on Mars "frigid".
     The moderns (Sargent, Arroyo, Greene; the Cafe Astrology and Astrology Anonymous synastry primers) add Pluto with
     Venus or Mars as the most intense, Mars on the other's Sun, Moon or Ascendant, Mars in the other's fifth or eighth
     house, Uranus and Neptune with Venus or Mars as excitement, and rank Venus on the Sun or Moon as affection more
     than desire. The one statistical study (Astro Investigators, 749 + 829 married couples, 2005) finds Venus–Mars
     contacts barely above chance among the married: desire is not durability, which is the point of keeping this
     score apart from harmony and strife. Weights are Siderarium's reading of that corpus. [SD] */
  const HARD3 = a => a === 'conjunction' || a === 'square' || a === 'opposition', PTOLEMAIC = new Set(['conjunction', 'sextile', 'square', 'trine', 'opposition']);
  const DESIRE = [
    ['venus', 'mars', 1.0, 1.15],        // the marker itself: every aspect counts, the hard ones more
    ['venus', 'pluto', 0.7, 1.15], ['mars', 'pluto', 0.7, 1.15],   // modern: the deepest pull, and the battles of will
    ['mars', 'moon', 0.55, 1.1], ['mars', 'sun', 0.5, 1.1],         // Mars on the other's lights: the body noticed
    ['mars', 'ascendant', 0.5, 1.1], ['venus', 'ascendant', 0.35, 1.0],
    ['venus', 'uranus', 0.35, 1.0], ['mars', 'uranus', 0.25, 1.0], ['mars', 'neptune', 0.3, 1.0],   // excitement, inconstant
    ['venus', 'sun', 0.25, 1.0], ['venus', 'moon', 0.2, 1.0],      // affection more than desire
    ['mars', 'mars', 0.3, 1.2],                                     // heat by friction: the hard contacts only
    ['venus', 'saturn', -0.35, 1.3], ['mars', 'saturn', -0.35, 1.3] // Ptolemy's damper: firm but cold, frigid
  ];
  function desireOf(contacts, A, B) {
    let sum = 0; const parts = []; let vmA = false, vmB = false;
    const add = (a, b, aspect, power, w) => { sum += w; parts.push({ a, b, aspect, w }); };
    for (const t of contacts) {
      if (!PTOLEMAIC.has(t.aspect)) continue;              // the five aspects only, as every source reads them
      const row = DESIRE.find(([p, q]) => (t.a === p && t.b === q) || (t.a === q && t.b === p));
      if (!row) continue;
      const [p, q, base, hardK] = row, hard = HARD3(t.aspect);
      if (p === 'mars' && q === 'mars' && !hard) continue;
      const w = base * t.power * (hard ? hardK : 0.85);
      add(t.a, t.b, t.aspect, t.power, w);
      if ((p === 'venus' && q === 'mars')) { if (t.a === 'venus') vmA = true; else vmB = true; }
    }
    if (A && B) {
      // the second chart's Venus and Mars on the first chart's Ascendant: the contacts list runs the other way only
      for (const k of ['mars', 'venus']) {
        const d = sep(B.bodies[k].lon, A.asc), near = [[0, 'conjunction', 6], [180, 'opposition', 6], [90, 'square', 5]].find(([deg, , orb]) => Math.abs(d - deg) <= orb);
        if (near) { const orb = Math.abs(d - near[0]), power = 1 - orb / near[2], base = k === 'mars' ? 0.5 : 0.35; add(k, 'ascendant', near[1], power, base * power * (k === 'mars' ? 1.1 : 1)); }
      }
      // Mars in the other's fifth or eighth house: the houses of pleasure and of the bed (modern)
      if ([5, 8].includes(houseIn(A.cusps, B.bodies.mars.lon))) add('mars', 'house', 'in', 1, 0.3);
      if ([5, 8].includes(houseIn(B.cusps, A.bodies.mars.lon))) add('mars', 'house', 'in', 1, 0.3);
    }
    if (vmA && vmB) sum *= 1.2;                              // Venus on Mars both ways: the strongest form
    const value = 1 - Math.exp(-Math.max(0, sum));
    const grade = value >= DESIRE_STRONG ? 'strong' : value >= DESIRE_SOME ? 'some' : null;
    return { value, grade, parts: parts.sort((x, y) => y.w - x.w).slice(0, 4) };
  }
  const DESIRE_SOME = 0.6, DESIRE_STRONG = 0.71;              // the top quarter and the top tenth of 1,770 random couples at Rome

  /* ---------- what the two skies make together ----------
     A transiting planet that aspects both ends of a natal aspect sets that aspect off: the native's own strife or
     harmony brought to life. Three aspects close a figure: {trine, trine, trine} a grand trine, {opposition, square,
     square} a t-square, {opposition, trine, sextile} a release. Each figure is scored by the two transits that make it,
     and the whole is summed as harmony against strife. */
  const SOFT = new Set(['trine', 'sextile']), HARD = new Set(['square', 'opposition']);
  const malefic = k => k === 'mars' || k === 'saturn';
  function computeInteractions(cur, natal, transits) {
    const byT = {};
    for (const t of transits) if (C.PLANETS[t.b]) (byT[t.a] = byT[t.a] || []).push(t);
    const figures = [];
    for (const tk in byT) {
      const hits = byT[tk];
      for (let i = 0; i < hits.length; i++) for (let j = i + 1; j < hits.length; j++) {
        const x = hits[i], y = hits[j];
        const na = natal.aspects.find(a => (a.a === x.b && a.b === y.b) || (a.a === y.b && a.b === x.b));
        if (!na || !(SOFT.has(na.aspect) || HARD.has(na.aspect) || na.aspect === 'conjunction')) continue;
        const set = [na.aspect, x.aspect, y.aspect].sort().join('+');
        let name = 'setOff', tone;
        if (set === 'trine+trine+trine') { name = 'grandTrine'; tone = 'harmony'; }
        else if (set === 'sextile+sextile+trine') { name = 'minorGrandTrine'; tone = 'harmony'; }
        else if (set === 'opposition+square+square') { name = 'tSquare'; tone = 'strife'; }
        else if (set === 'opposition+sextile+trine') { name = 'release'; tone = 'harmony'; }
        else if (HARD.has(na.aspect)) tone = (HARD.has(x.aspect) || HARD.has(y.aspect) || x.aspect === 'conjunction' || y.aspect === 'conjunction') ? 'strife' : 'harmony';
        else if (SOFT.has(na.aspect)) tone = (HARD.has(x.aspect) && HARD.has(y.aspect)) ? 'strife' : 'harmony';
        else tone = (malefic(tk) || malefic(x.b) || malefic(y.b)) && (HARD.has(x.aspect) || HARD.has(y.aspect) || x.aspect === 'conjunction') ? 'strife' : 'harmony';
        const power = Math.sqrt(x.power * y.power) * (name === 'setOff' ? 1 : 1.3);
        figures.push({ t: tk, a: x.b, b: y.b, natalAspect: na.aspect, x, y, name, tone, power });
      }
    }
    figures.sort((u, v) => v.power - u.power);
    let h = 0, st = 0;
    for (const f of figures) if (f.tone === 'harmony') h += f.power; else st += f.power;
    for (const t of transits) {
      if (!C.PLANETS[t.b]) continue;
      if (SOFT.has(t.aspect)) h += 0.4 * t.power;
      else if (HARD.has(t.aspect) || (t.aspect === 'conjunction' && (malefic(t.a) || malefic(t.b)))) st += 0.4 * t.power;
    }
    const harmony = 1 - Math.exp(-h), strife = 1 - Math.exp(-st);
    const verdict = harmony > strife * 1.25 ? 'harmonyPrevails' : strife > harmony * 1.25 ? 'strifePrevails' : 'balanced';
    /* the grade: the balance of harmony against strife read on seven steps, deep harmony to deep strife, with "quiet"
       when the two skies barely touch. the verdict above is the coarse three-way reading the stone and the state use. [SD] */
    const balance = harmony - strife, weight = harmony + strife;
    // the steps are centred on the median of random couples (+0.04: soft contacts outnumber hard ones under these orbs),
    // so that balanced holds about three couples in ten, each deep end about one in twenty
    const bz = balance - 0.04;
    const grade = weight < 0.15 ? 'quiet' : bz >= 0.30 ? 'deepHarmony' : bz >= 0.15 ? 'harmony' : bz >= 0.05 ? 'ease' : bz > -0.05 ? 'balanced' : bz > -0.15 ? 'tension' : bz > -0.30 ? 'strife' : 'deepStrife';
    return { figures, harmony, strife, verdict, grade, balance };
  }

  /* the element of the sky: the four elements weighed by the bodies' signs, the luminaries and the ascendant heaviest */
  function elements(st) {
    const W = { sun: 3, moon: 3, mercury: 1.5, venus: 1.5, mars: 1.5, jupiter: 1, saturn: 1, uranus: 0.4, neptune: 0.4, pluto: 0.4 };
    const s = { fire: 0, earth: 0, air: 0, water: 0 };
    for (const k in W) s[C.SIGNS[st.bodies[k].sign].element] += W[k];
    s[C.SIGNS[Math.floor(st.asc / 30)].element] += 2.5; s[C.SIGNS[Math.floor(st.mc / 30)].element] += 1;
    const tot = Object.values(s).reduce((a, b) => a + b, 0);
    const shares = {}; for (const k in s) shares[k] = s[k] / tot;
    const order = Object.keys(s).sort((a, b) => s[b] - s[a]);
    return { shares, order, dominant: order[0] };
  }

  /* ---------- the whole state ---------- */
  function compute(date, loc, opts = {}) {
    const t = A.MakeTime(date);
    const obs = new A.Observer(loc.lat, loc.lon, 0);
    const eps = A.e_tilt(t).tobl * D2R;
    const ang = angles(t, loc, eps);
    const houses = opts.houses || 'regiomontanus';
    const cusps = houses === 'equal' ? equalHouses(ang.asc) : houses === 'placidus' ? placidus(ang.ramc, loc.lat, eps, ang.asc, ang.mc) : regiomontanus(ang.ramc, loc.lat, eps, ang.asc, ang.mc);
    const sunLon = eclipticOfDate(A.Body.Sun, t);
    const t1 = t.AddDays(0.5), t0 = t.AddDays(-0.5);
    const B = {};
    for (const key of C.ORDER) {
      const P = C.PLANETS[key];
      const lon = eclipticOfDate(A.Body[P.body], t);
      const speed = norm180(eclipticOfDate(A.Body[P.body], t1) - eclipticOfDate(A.Body[P.body], t0));
      const eq = A.Equator(A.Body[P.body], t, obs, true, true);
      const hor = A.Horizon(t, obs, eq.ra, eq.dec, 'normal');
      const ra = eq.ra * 15, dec = eq.dec;
      const H = norm180(ang.lst - ra);
      const dsa = semiArc(dec, loc.lat);
      const p = mundane(H, dsa);
      const signIdx = Math.floor(lon / 30), deg = lon % 30;
      const meanSpeed = 360 / (key === 'mercury' || key === 'venus' ? 365.256 : P.period);
      const retro = speed < 0;
      const station = key !== 'sun' && key !== 'moon' && Math.abs(speed) < 0.12 * meanSpeed;
      // slowness drives blur: full when retrograde, ramps in as a direct planet slows toward station
      const slow = retro ? 1 : Math.max(0, Math.min(1, 1 - speed / (0.5 * meanSpeed)));
      const dSun = sep(lon, sunLon);
      const angular = Math.min(sep(lon, ang.asc), sep(lon, ang.asc + 180), sep(lon, ang.mc), sep(lon, ang.mc + 180)) < 5;   // conjunct an angle, by longitude
      B[key] = {
        key, lon, speed, retro, station, slow: key === 'sun' || key === 'moon' ? 0 : slow,
        ra, dec, alt: hor.altitude, az: hor.azimuth, H, dsa, p, house: houseIn(cusps, lon), angular,
        sign: signIdx, deg, combust: key !== 'sun' && dSun < 8.5 && dSun >= 0.2833, cazimi: key !== 'sun' && key !== 'moon' && dSun < 0.2833,
        beams: key !== 'sun' && dSun >= 8.5 && dSun < 17,
        oob: Math.abs(dec) > eps * R2D,                    // out of bounds: declination beyond the sun's
        decan: C.decanOf(lon), mansion: C.mansionOf(lon)
      };
    }
    const isDay = B.sun.alt > -0.833;
    for (const key of C.ORDER) B[key].dignity = dignity(key, B[key].sign, B[key].deg, isDay);
    // mutual reception by domicile or by exaltation (Lilly): each planet stands in the other's dignity.
    // Lilly counts it as strengthening; here it lifts the peregrine penalty [SD scoring].
    const seven = C.CHALDEAN;
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
      const a = seven[i], b = seven[j], sa = C.SIGNS[B[a].sign].key, sb = C.SIGNS[B[b].sign].key;
      const byDom = (C.DOMICILE[b] || []).includes(sa) && (C.DOMICILE[a] || []).includes(sb);
      const byEx = C.EXALTATION[b] === sa && C.EXALTATION[a] === sb;
      if (!byDom && !byEx) continue;
      for (const [k, o] of [[a, b], [b, a]]) {
        const D = B[k].dignity;
        D.labels.push(`reception with ${o}`);
        if (D.peregrine) { D.peregrine = false; D.score += 5; D.labels.splice(D.labels.indexOf('peregrine'), 1); }
      }
    }
    for (const key of C.ORDER) {
      const b = B[key];
      let clarity = Math.max(0.18, Math.min(1, 0.62 + b.dignity.score / 16));
      if (b.combust) clarity *= 0.6;
      else if (b.beams) clarity *= 0.85;                  // under the sun's beams: weakened, less than combust
      b.clarity = clarity;
    }
    const phaseAngle = A.MoonPhase(t);
    const moon = { phaseAngle, illum: (1 - Math.cos(phaseAngle * D2R)) / 2, waxing: phaseAngle < 180 };
    const hour = planetaryHour(t, obs, loc, !opts.light);
    const aspects = findAspects(B);
    const events = findEvents(t, B, aspects, opts.light);
    const configs = selectConfigs(aspects, events, B);
    const lunar = moonCondition(B, eps);
    const st = { date, loc, eps, ...ang, bodies: B, sect: isDay ? 'day' : 'night', moon: { ...moon, ...lunar }, hour, aspects, events, configs, cusps, houses };
    st.chord = chordOf(st);
    st.elements = elements(st);
    st.mode = modeOf(st); st.windows = windowsOf(st);
    st.title = { house: st.bodies.moon.house, mode: st.mode.key, state: stateOf(st) };   // the title of the moment: stage of life, mother letter, time to work / watch / rest
    st.veil = veilOf(st);
    st.wheel = wheelOf(st);
    // the planets on the angles: within 5° of the Ascendant, Midheaven, Descendant or Imum Coeli, with the orb
    st.onAngles = [];
    for (const k of C.ORDER) { const lon = B[k].lon; for (const [key, a] of [['asc', ang.asc], ['mc', ang.mc], ['dsc', ang.asc + 180], ['ic', ang.mc + 180]]) { const o = sep(lon, a); if (o < 5) st.onAngles.push({ planet: k, angle: key, orb: o }); } }
    st.onAngles.sort((a, b) => a.orb - b.orb);
    return st;
  }

  /* a transit in time: the instant of exactness nearest to now, and the span in orb around it, by stepping the
     transiting planet's longitude. the Moon is searched over days in minutes; the others over months in hours. */
  function transitSpan(key, targetLon, angle, orbMax, from) {
    const P = C.PLANETS[key]; if (!P || !P.body) return null;
    const moon = key === 'moon', step = moon ? 10 * 60000 : 6 * 3600e3, reach = moon ? 3 * 864e5 : 400 * 864e5;
    const t0 = from.getTime();
    const orbAt = ms => { const lon = eclipticOfDate(A.Body[P.body], A.MakeTime(new Date(ms))); return Math.abs(sep(lon, targetLon) - angle); };
    let o0 = orbAt(t0), exact = null, best = o0, bestT = t0;
    // walk outwards from now, both ways, until the orb has grown past its limit on each side; the minimum met is the exactness
    let enter = null, leave = null;
    for (let s = 1; s * step <= reach; s++) {
      const tf = t0 + s * step, of = orbAt(tf);
      if (of < best) { best = of; bestT = tf; }
      if (leave === null && of > orbMax) leave = tf;
      if (leave !== null && bestT < leave) break;
    }
    for (let s = 1; s * step <= reach; s++) {
      const tb = t0 - s * step, ob = orbAt(tb);
      if (ob < best - 1e-6 && (enter === null)) { best = ob; bestT = tb; }
      if (enter === null && ob > orbMax) enter = tb;
      if (enter !== null) break;
    }
    // refine the minimum to a few minutes by halving around bestT
    let lo = bestT - step, hi = bestT + step;
    for (let k = 0; k < 14; k++) { const m1 = lo + (hi - lo) / 3, m2 = hi - (hi - lo) / 3; if (orbAt(m1) < orbAt(m2)) hi = m2; else lo = m1; }
    const tm = (lo + hi) / 2;
    if (orbAt(tm) < Math.min(0.5, orbMax * 0.35)) exact = new Date(tm);
    return { exact, enter: enter ? new Date(enter) : null, leave: leave ? new Date(leave) : null, orbNow: o0 };
  }
  SD.engine = { compute, computeTransits, computeInteractions, desireOf, transitSpan, stoneOf, elements, nextChordShift, norm360, norm180, sep, houseOf, houseIn, mundane, semiArc, dignity, placidus, regiomontanus, equalHouses, synodic, rarity };
})(window.SD = window.SD || {});
