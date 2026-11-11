/*  siderarium — planetary talismans timing
    The next elections for the talisman of each of the seven planets, at the place of the clock.

    The rule is the tradition's own formula for the images of the planets, as Agrippa and the Picatrix give it, image after
    image: "in the hour of the planet, the planet ascending" in its own sign or its exaltation (Agrippa, Occult Philosophy
    II.38-44; Picatrix II.10). Around that formula stand the general conditions of every work under a planet:

      Agrippa II.29   the planet "in its dignities, fortunate, and powerful, and ruling in the day, hour, and in the Figure of
                      the Heaven"; "thou shalt do nothing without the assistance of the Moon"; a planet is unfortunate
                      "by the aspect of Saturn or Mars, especially opposite, or quadrant"; "all Planets are afraid of the
                      conjunction of the Sun".
      Agrippa II.30   powerful "in a House, or in Exaltation or Triplicity, or term, or face without combustion", direct,
                      "in Angles, especially of the rising, or Tenth"; the Moon not in the burnt way, not slow, not in
                      eclipse, not burnt by the Sun, not hindered by Mars or Saturn.
      Picatrix III.7  the best condition is the exaltation, then the planet's own signs; failing these "one of his terms
                      or triplicities" on an angle (the midheaven preferred) or succeedent, direct; "beware of his
                      detriment and unfortunate aspects"; "do not let him be cadent"; retrograde or cadent he is "like a
                      man full of anger and ill will".
      Picatrix I.4    "in all good works, the Moon is safe from Saturn and Mars and their aspects, and from the combustion
                      of the Sun, and is joined to the fortunes by good aspects"; not within twelve degrees of the Sun,
                      not applying to an eclipse, not slow (under 12 degrees a day), not in the Via Combusta, not at the
                      end of a sign; an infortune in the ascendant "will overturn and destroy the effect".

    What the search does with them [SD]:
      never listed    (the core: what the sources call indispensable, or say turns the work against its maker) the planet
                      out of its hour, in detriment or fall, without dignity, retrograde, combust, away from the Ascendant
                      and the Midheaven, struck by Mars or Saturn (conjunction, square, opposition); Mars or Saturn (other
                      than the planet) in the 1st house or on an angle; the lord of the Ascendant retrograde or combust;
                      the Moon waning, within twelve degrees of the Sun, in the Via Combusta, void of course, impeded by
                      Mars or Saturn (conjunction, square, opposition), next applying by square or opposition or to the
                      Sun's body; an eclipse within three days before or one after.
      named, lowered  (the lesser impediments, 'avoid if possible') Mars or Saturn in the 7th or 10th house; the planet
                      besieged; the Dragon's Tail on an angle; the Moon in Scorpio or Capricorn, on the Ascendant (except
                      for her own talisman), cadent in the 6th, 8th, 9th or 12th, within twelve degrees of a Node, slow,
                      near the full, applying to Mars or Saturn even by trine or sextile, in the last term of a sign.
      first rate      the planet in its own sign or exaltation.
      lesser          the planet in its own terms or triplicity only: the Picatrix's fallback, shown as such and only
                      when no first-rate election is near.
      weighed         the planet's day as well as its hour, the Ascendant against the Midheaven, the Moon applying to the
                      planet itself, her light, speed, sign and house, the Sun's beams, the fortunes' help.
    Every listed moment is judged from the same state the clock computes (SD.engine.compute), so the clock opened at
    that moment shows the conditions the list names. The times hold for the place given: another city has other hours.

    Pure computation; no drawing. A searcher is advanced in small steps so the page never waits on it. */
(function (SD) {
  'use strict';
  const A = window.Astronomy, C = SD.corr, E = SD.engine;
  const DAY = 864e5, HOUR = 36e5, MIN = 6e4, D2R = Math.PI / 180;
  const n360 = E.norm360, n180 = E.norm180, sep = E.sep;
  const PLANETS = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const INFORTUNE = { mars: 1, saturn: 1 }, FORTUNE = { venus: 1, jupiter: 1 };
  const lon = (k, ms) => E.lonOf(k, new Date(ms));

  /* the numbers, in one place */
  const RULES = {
    version: 2,
    // the planet on the angle: from `short` degrees before the cusp (still to rise or to culminate, in the 1st or 10th
    // house) to `past` degrees beyond it (the five degrees a planet past a cusp still belongs to that house, Lilly)
    angle: { short: 7, past: 3 },
    minWindow: 4,                 // minutes: a shorter window is no time to work in
    moonRays: 12,                 // degrees from the Sun, either side (Picatrix I.4)
    moonSlow: 12,                 // degrees a day (Picatrix I.4)
    eclipse: { before: 3, after: 1 },   // days around a solar eclipse or an umbral lunar eclipse
    separatingShare: 0.5,         // a hard aspect of an infortune already separating counts within this share of its orb
    look: { moon: 60, sun: 45, mercury: 45, venus: 45, mars: 60, jupiter: 90, saturn: 90 },   // days from the first find among which the three best are chosen
    horizon: { moon: 900, sun: 2600, mercury: 1500, venus: 1000, mars: 1600, jupiter: 4600, saturn: 6000 },   // days searched
    near: 400                     // a first-rate election farther off than this is preceded by the lesser ones, if any
  };

  /* ---------- the sky by the day, kept for the whole search; the Moon is always asked afresh ---------- */
  function Sky() {
    const tab = new Map();
    const cell = (d, k) => { const key = d + k; let v = tab.get(key); if (v === undefined) { v = lon(k, d * DAY); tab.set(key, v); } return v; };
    return {
      lon(k, ms) { if (k === 'moon') return lon('moon', ms); const d = Math.floor(ms / DAY), a = cell(d, k), b = cell(d + 1, k); return n360(a + n180(b - a) * (ms / DAY - d)); },
      speed(k, ms) { const d = Math.floor(ms / DAY); return n180(cell(d + 1, k) - cell(d, k)); }
    };
  }

  /* ---------- the planetary day that holds a given instant: sunrise, sunset, next sunrise, as the clock reads them ---------- */
  function Days(place) {
    const obs = new A.Observer(place.lat, place.lon, 0), SUN = A.Body.Sun, cache = new Map();
    const T = ms => A.MakeTime(new Date(ms)), M = t => t.date.getTime();
    let last = null;
    const dayFrom = rise => {                               // the planetary day that opens at this sunrise
      const key = Math.round(M(rise) / MIN);
      if (cache.has(key)) return cache.get(key);
      const set = A.SearchRiseSet(SUN, obs, -1, rise, 1.2), next = set && A.SearchRiseSet(SUN, obs, +1, set, 1.2);
      if (!set || !next) return null;                       // the Sun does not set or does not rise: no unequal hours here today
      const pd = { rise: M(rise), set: M(set), next: M(next), ruler: C.WEEKDAY_RULER[E.weekdayAt(rise.date, place)], _next: next };
      if (cache.size > 64) cache.clear();
      cache.set(key, pd);
      return pd;
    };
    const holds = (pd, ms) => pd && ms >= pd.rise && ms < pd.next;
    return {
      of(ms) {
        if (holds(last, ms)) return last;
        if (last && ms >= last.next) { const pd = dayFrom(last._next); if (holds(pd, ms)) return (last = pd); }   // the day after the last one found, when it holds the instant
        let rise = A.SearchRiseSet(SUN, obs, +1, T(ms).AddDays(-1.1), 1.2);
        if (!rise) return null;
        for (;;) { const r2 = A.SearchRiseSet(SUN, obs, +1, rise.AddDays(0.01), 1.2); if (r2 && M(r2) <= ms) rise = r2; else break; }
        const pd = dayFrom(rise);
        return holds(pd, ms) ? (last = pd) : null;          // never a day that does not hold the instant
      }
    };
  }
  /* the hours of a planet in a planetary day: every seventh from its place in the Chaldean order */
  function hoursFor(pd, P) {
    const first = C.CHALDEAN.indexOf(pd.ruler), want = C.CHALDEAN.indexOf(P), out = [], Ld = (pd.set - pd.rise) / 12, Ln = (pd.next - pd.set) / 12;
    for (let k = (want - first + 7) % 7; k < 24; k += 7)
      out.push(k < 12 ? { k, start: pd.rise + k * Ld, end: pd.rise + (k + 1) * Ld } : { k, start: pd.set + (k - 12) * Ln, end: pd.set + (k - 11) * Ln });
    return out;
  }

  /* ---------- dignity by sign and degree, without a chart: 1 its own sign or exaltation, 2 its terms or triplicity
     (either sect: the hour decides which), 0 nothing to stand on, -1 detriment or fall ---------- */
  function tierOf(P, l) {
    const s = Math.floor(n360(l) / 30), deg = n360(l) - s * 30, sign = C.SIGNS[s], opp = C.SIGNS[(s + 6) % 12].key;
    const dom = C.DOMICILE[P] || [];
    if (dom.includes(opp) || C.EXALTATION[P] === opp) { if (!(dom.includes(sign.key) || C.EXALTATION[P] === sign.key)) return -1; }
    if (dom.includes(sign.key) || C.EXALTATION[P] === sign.key) return 1;
    const term = C.TERMS[sign.key].find(t => deg < t[1]);
    if ((term && term[0] === P) || C.TRIPLICITY[sign.element].includes(P)) return 2;
    return 0;
  }

  /* ---------- the Moon's road: every aspect she perfects with the Sun and the five planets before she leaves her
     sign, by their true motions, in order. none is void of course. ---------- */
  const ROAD = [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]];
  function moonRoad(ms) {
    const m0 = lon('moon', ms), vM = n180(lon('moon', ms + HOUR) - lon('moon', ms - HOUR)) * 12;   // degrees a day
    const edge = (Math.floor(m0 / 30) + 1) * 30;
    let leave = ms + (edge - m0) / vM * DAY;
    for (let i = 0; i < 4; i++) leave += n180(edge - lon('moon', leave)) / vM * DAY;
    const out = [];
    for (const k of ['sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn']) {
      const p0 = lon(k, ms), vP = n180(lon(k, ms + 6 * HOUR) - lon(k, ms - 6 * HOUR)) * 2, rel = vM - vP;
      if (rel <= 0) continue;
      for (const [name, ang] of ROAD) for (const sgn of ang === 0 || ang === 180 ? [1] : [1, -1]) {
        const dist = n360(p0 + sgn * ang - m0);            // degrees ahead of the Moon
        let t = ms + dist / rel * DAY;
        if (t > leave + 6 * HOUR) continue;
        for (let i = 0; i < 4; i++) t += n180(lon(k, t) + sgn * ang - lon('moon', t)) / rel * DAY;
        if (t > ms + 1000 && t < leave) out.push({ planet: k, aspect: name, at: t });   // an aspect a second from exact is still to come
      }
    }
    return { leave, speed: vM, list: out.sort((a, b) => a.at - b.at) };
  }

  /* ---------- eclipses: a solar eclipse anywhere, or a lunar one that enters the umbra, near an instant ---------- */
  const eclCache = new Map();
  function eclipseNear(ms) {
    const key = Math.floor(ms / (2 * DAY));
    if (eclCache.has(key)) return eclCache.get(key);
    const from = ms - (RULES.eclipse.after + 2) * DAY, to = ms + (RULES.eclipse.before + 2) * DAY, peaks = [];
    try {
      for (let e = A.SearchLunarEclipse(A.MakeTime(new Date(from))), n = 0; e && n < 4; e = A.NextLunarEclipse(e.peak), n++) { const t = e.peak.date.getTime(); if (t > to) break; if (e.kind !== 'penumbral') peaks.push({ kind: 'lunar', at: t }); }
      for (let e = A.SearchGlobalSolarEclipse(A.MakeTime(new Date(from))), n = 0; e && n < 4; e = A.NextGlobalSolarEclipse(e.peak), n++) { const t = e.peak.date.getTime(); if (t > to) break; peaks.push({ kind: 'solar', at: t }); }
    } catch (err) { peaks.push({ kind: 'unknown', at: ms, all: true }); }   // an eclipse search that fails leaves these days unlisted, never cleared
    if (eclCache.size > 400) eclCache.clear();
    eclCache.set(key, peaks);
    return peaks;
  }
  const inEclipse = ms => eclipseNear(ms).find(e => e.all || (ms > e.at - RULES.eclipse.before * DAY && ms < e.at + RULES.eclipse.after * DAY)) || null;

  /* ---------- the judgment of one instant for one planet. every hard rule first, each with its reason; then the
     weighing. returns { ok: false, why } or the record of the election. ---------- */
  const FRIENDLY = { conjunction: 1, sextile: 1, trine: 1 };
  const HARD = { conjunction: 1, square: 1, opposition: 1 };
  const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const lordOf = signIdx => SEVEN.find(k => (C.DOMICILE[k] || []).includes(C.SIGNS[signIdx].key));   // the traditional ruler of a sign
  const cadent = h => h === 3 || h === 6 || h === 9 || h === 12;
  /* the orbs of the planets, Lilly's larger set (Christian Astrology p. 107): two planets are joined while they stand within
     half of each one's orb, added together, of the exact aspect. the clock's own aspect orbs are for display and narrower */
  const ORBS = { sun: 17, moon: 12.5, mercury: 7, venus: 8, mars: 7.5, jupiter: 12, saturn: 10 };
  function hardContact(B, x, y) {                          // a conjunction, square or opposition of x and y within the moieties
    const lim = (ORBS[x] + ORBS[y]) / 2, d = sep(B[x].lon, B[y].lon), d1 = sep(B[x].lon + B[x].speed / 24, B[y].lon + B[y].speed / 24);   // and an hour on
    for (const [aspect, ang] of [['conjunction', 0], ['square', 90], ['opposition', 180]]) {
      const orb = Math.abs(d - ang);
      if (orb <= lim) return { aspect, orb, lim, applying: Math.abs(d1 - ang) < orb };
    }
    return null;
  }
  const struck = (B, x, y) => { const h = hardContact(B, x, y); return !!h && (h.applying || h.orb <= h.lim * RULES.separatingShare); };
  /* the lesser impediments: what the sources say to avoid if one can. each lowers the rank and is named on the line;
     with opts.strict they exclude, like the core rules */
  const CAUTION = {
    infortuneInAngle: 14,        // Mars or Saturn in the 7th or 10th house (Agrippa II.30; Bonatti Tr. VII; Ramesey III.1)
    besieged: 14,                // the planet between the bodies of Mars and Saturn (Lilly p. 114)
    tailOnAngle: 10,             // the Dragon's Tail on the Ascendant or Midheaven (Ramesey III.1)
    moonFall: 12,                // the Moon in Scorpio or Capricorn (Sahl 22; Bonatti, Cons. 5)
    moonOnAscendant: 12,         // 'the enemy of the ascendant' (Picatrix II.3; Ficino III.6), except for her own talisman
    moonCadent: 10,              // in the 6th, 8th, 9th or 12th (Picatrix I.4; Bonatti; Ficino III.6)
    moonNode: 10,                // within twelve degrees of a Node, the bound of eclipse (Sahl 22; Bonatti, Cons. 5)
    moonSlow: 10,                // under 12 degrees a day (Picatrix I.4; Agrippa II.30)
    moonOppositeSun: 10,         // within twelve degrees of the full (Agrippa II.30; Sahl 22)
    moonToInfortune: 10,         // applying to Mars or Saturn by trine or sextile ('safe from Saturn and Mars and their aspects', Picatrix I.4)
    moonLastTerm: 6              // the last degrees of a sign, the terms of the infortunes (Picatrix I.4; Dorotheus V.5.8)
  };
  function judge(P, ms, place, opts = {}) {
    const st = E.compute(new Date(ms), place, { light: true, houses: opts.houses || 'regiomontanus' });
    const fail = why => ({ ok: false, why, at: ms });
    const B = st.bodies, b = B[P], lab = b.dignity.labels, has = x => lab.includes(x);
    const cautions = [], cautionBy = {};                                               // cautionBy: the infortune behind a caution, to name it
    const caution = (key, by, then) => { if (opts.strict) return true; cautions.push(key); if (by) cautionBy[key] = then ? { by, then } : { by }; return false; };
    const houseOf = lon => { const h = E.houseIn(st.cusps, lon), nx = h % 12 + 1; return n360(st.cusps[nx] - lon) < 5 ? nx : h; };   // Lilly: within five degrees of the next cusp, the body is in that house
    const H = { moon: houseOf(B.moon.lon), mars: houseOf(B.mars.lon), saturn: houseOf(B.saturn.lon), venus: houseOf(B.venus.lon), jupiter: houseOf(B.jupiter.lon) };
    if (!st.hour || st.hour.polar) return fail('polar');
    // ---------- the core: what the sources call indispensable, or say turns the work against its maker ----------
    // 1 · the hour of the planet (Picatrix II.10, every image; Agrippa II.29; Lilly p. 485)
    if (st.hour.hourRuler !== P) return fail('hour');
    // 2 · the planet in its dignities, never in its detriment or fall (Agrippa II.29-30; Picatrix III.7; Ficino III.2).
    //     Agrippa's tables (II.22): made with the planet unfortunate, the talisman does the contrary of its good
    if (has('detriment') || has('fall')) return fail(has('fall') ? 'fall' : 'detriment');
    const major = has('domicile') || has('exaltation'), lesser = has('term') || has('triplicity');
    if (!major && !lesser) return fail('peregrine');
    // a triplicity alone, in the minutes when the Sun's rim is up and its centre is not (or the reverse): the sect is in
    // doubt, and with it the dignity [SD]
    if (!major && !has('term') && (st.sect === 'day') !== !!st.hour.isDay) return fail('sect in doubt');
    // 3 · direct, out of combustion (Agrippa II.30; Picatrix II.3, III.7: retrograde, 'like a man full of anger')
    if (b.retro) return fail('retrograde');
    if (b.combust) return fail('combust');
    // 4 · on the Ascendant or the Midheaven ('in the hour of the planet, the planet ascending'; Agrippa II.30, 'in Angles,
    //     especially of the rising, or Tenth'; Picatrix III.7, the midheaven preferred for Saturn)
    const dA = n180(b.lon - st.asc), dM = n180(b.lon - st.mc), R = RULES.angle;
    const onA = dA >= -R.past && dA <= R.short, onM = dM >= -R.past && dM <= R.short;
    if (!onA && !onM) return fail('angle');
    const angle = onA && (!onM || Math.abs(dA) <= Math.abs(dM)) ? 'asc' : 'mc', off = angle === 'asc' ? dA : dM;
    // 5 · free of Mars and Saturn: no conjunction, square or opposition, applying or still close (Agrippa II.29), by
    //     Lilly's moieties: applying anywhere within them, separating within half of them
    for (const k of ['mars', 'saturn']) if (k !== P && struck(B, P, k)) return fail('struck by ' + k);
    // 6 · no infortune (other than the planet) in the Ascendant or on an angle (Picatrix II.3; Bonatti; Ramesey III.1)
    for (const k of ['mars', 'saturn']) {
      if (k === P) continue;
      if (H[k] === 1 || st.onAngles.some(x => x.planet === k)) return fail(k + ' in the ascendant or on an angle');
    }
    // 7 · the lord of the Ascendant neither retrograde nor combust (Picatrix II.3; Thabit ch. 3; Ramesey III.1; Agrippa II.50)
    const lordA = lordOf(Math.floor(st.asc / 30)), LA = B[lordA];
    if (LA.retro) return fail('lord of the ascendant retrograde');
    if (LA.combust) return fail('lord of the ascendant combust');
    // 8 · the Moon: waxing, out of the Sun's rays, not in the burnt way, not void, not impeded by Mars or Saturn, not near an
    //     eclipse (Agrippa II.30, 'nec lumine minuatur'; the Fourth Book and the Heptameron, 'Luna crescente'; Picatrix I.4;
    //     Dorotheus V.5; Sahl 22; Bonatti, Cons. 5; Ficino III.6)
    const m = st.moon, mb = B.moon, dSun = sep(mb.lon, B.sun.lon);
    if (!m.waxing) return fail('moon waning');
    if (dSun < RULES.moonRays) return fail('moon under the rays');
    if (m.flags.includes('via combusta')) return fail('moon in the via combusta');
    const road = moonRoad(ms), next = road.list[0] || null;
    if (!next) return fail('moon void of course');
    if (!m.next || m.next.planet !== next.planet || m.next.aspect !== next.aspect) return fail('moon uncertain');   // the clock's own reading must agree
    for (const k of ['mars', 'saturn']) if (k !== P && struck(B, 'moon', k)) return fail('moon impeded by ' + k);   // Mars or Saturn on her by conjunction, square or opposition
    if (!FRIENDLY[next.aspect]) return fail('moon applying by ' + next.aspect);     // her next aspect: a trine, a sextile or a conjunction
    if (next.aspect === 'conjunction' && (next.planet === 'sun' || (INFORTUNE[next.planet] && next.planet !== P))) return fail('moon applying to the body of ' + next.planet);
    if (inEclipse(ms)) return fail('eclipse');                                         // three days before to one day after (Bonatti Tr. VII)

    // ---------- the lesser impediments ----------
    const node = E.trueNode(new Date(ms)), tail = n360(node + 180);
    { const inAngle = ['mars', 'saturn'].filter(k => k !== P && (H[k] === 7 || H[k] === 10));
      if (inAngle.length && caution('infortuneInAngle', inAngle)) return fail('infortune in an angle'); }
    if (!INFORTUNE[P] && sep(b.lon, B.mars.lon) < 12 && sep(b.lon, B.saturn.lon) < 12 && n180(B.mars.lon - b.lon) * n180(B.saturn.lon - b.lon) < 0) { if (caution('besieged')) return fail('besieged'); }
    if (sep(tail, st.asc) < 5 || sep(tail, st.mc) < 5) { if (caution('tailOnAngle')) return fail('tail on an angle'); }
    if (mb.sign === 7 || mb.sign === 9) { if (caution('moonFall')) return fail('moon in scorpio or capricorn'); }
    if (P !== 'moon' && (H.moon === 1 || sep(mb.lon, st.asc) < 5)) { if (caution('moonOnAscendant')) return fail('moon on the ascendant'); }
    if ([6, 8, 9, 12].includes(H.moon)) { if (caution('moonCadent')) return fail('moon cadent'); }
    if (Math.min(sep(mb.lon, node), sep(mb.lon, tail)) < 12) { if (caution('moonNode')) return fail('moon near a node'); }
    if (road.speed < RULES.moonSlow) { if (caution('moonSlow')) return fail('moon slow'); }
    if (180 - dSun < RULES.moonRays) { if (caution('moonOppositeSun')) return fail('moon opposite the sun'); }
    if (INFORTUNE[next.planet] && next.planet !== P) { if (caution('moonToInfortune', [next.planet])) return fail('moon applying to ' + next.planet); }
    else {
      const hit = st.aspects.find(a => a.moon && a.applying && INFORTUNE[a.a === 'moon' ? a.b : a.a] && (a.a === 'moon' ? a.b : a.a) !== P);
      if (hit && caution('moonToInfortune', [hit.a === 'moon' ? hit.b : hit.a], true)) return fail('moon applying to an infortune');   // after her next aspect, she goes on to it
    }
    if (mb.deg >= C.TERMS[C.SIGNS[mb.sign].key][3][1]) { if (caution('moonLastTerm')) return fail('moon in the last term'); }
    const moonTo = next.planet === P ? 'planet' : FORTUNE[next.planet] ? 'fortune' : INFORTUNE[next.planet] ? 'infortune' : next.planet === lordA ? 'lord' : 'other';

    // ---------- the weighing [SD]: what the sources ask for beyond the bare formula, in their order of insistence ----------
    const plus = [], minus = [];
    let score = 0;
    const add = (n, key) => { score += n; (n >= 0 ? plus : minus).push(key); };
    for (const c of cautions) add(-CAUTION[c], c);
    if (has('exaltation')) add(30, 'exaltation'); else if (has('domicile')) add(27, 'domicile');
    else { if (has('triplicity')) add(12, 'triplicity'); if (has('term')) add(9, 'term'); }
    if (major && has('term')) add(2, 'term'); if (major && has('triplicity')) add(2, 'triplicity'); if (has('face')) add(2, 'face');
    const dayOf = st.hour.dayRuler === P;
    if (dayOf) add(12, 'day');                                                         // Agrippa II.29, the Heptameron, Ficino III.2: day and hour
    add(angle === 'asc' ? 10 : 9, angle);
    score += 4 * (1 - Math.min(1, Math.abs(off) / RULES.angle.short));                 // the nearer the cusp the better
    if (moonTo === 'planet') add(next.aspect === 'sextile' ? 12 : 14, 'moonToPlanet');   // 'the Moon opportunely directed to this' (Agrippa II.29, II.32)
    else if (moonTo === 'fortune') add(8, 'moonToFortune');                           // 'joined to the fortunes by good aspects' (Picatrix I.4)
    else if (moonTo === 'lord') add(5, 'moonToLord');
    else if (moonTo === 'other') add(2, 'moonToOther');
    if (road.speed > 13.5) add(3, 'moonSwift');
    if (m.illum > 0.25 && m.illum < 0.95) add(3, 'moonLight');
    if (P !== 'moon') { const ml = mb.dignity.labels; if (ml.includes('domicile') || ml.includes('exaltation')) add(3, 'moonDignified'); }
    if (mb.sign === 2) add(-3, 'moonInGemini');                                        // the twelfth from her house (Bonatti)
    { const lat = A.EclipticGeoMoon(A.MakeTime(new Date(ms))).lat, lat1 = A.EclipticGeoMoon(A.MakeTime(new Date(ms + HOUR))).lat;
      if (lat < 0 && lat1 < lat) add(-3, 'moonDescendingSouth'); }                     // Agrippa II.30; Ficino III.6
    { const disp = B[lordOf(mb.sign)]; if (disp && [1, 4, 7, 10].includes(disp.house)) add(2, 'moonLordAngular'); else if (disp && cadent(disp.house)) add(-3, 'moonLordCadent'); }
    if (P !== 'sun' && P !== 'moon') { if (b.cazimi) add(10, 'cazimi'); else if (b.beams) add(-6, 'beams'); else add(4, 'freeOfBeams'); }
    if (P !== 'sun' && P !== 'moon') {
      const term = C.TERMS[C.SIGNS[b.sign].key].find(t => b.deg < t[1]);
      if (term && INFORTUNE[term[0]] && term[0] !== P) add(-4, 'termOfInfortune');        // Agrippa II.30; Ficino III.10: not in the terms of Saturn or Mars
      if (b.station) add(-3, 'slow');
      const east = n180(B.sun.lon - b.lon) > 0;                                         // oriental: rising before the Sun
      if (['mars', 'jupiter', 'saturn'].includes(P)) add(east ? 2 : -2, east ? 'oriental' : 'occidental');
      else add(east ? -1 : 2, east ? 'oriental' : 'occidental');                       // Lilly p. 115
    }
    if (lordA !== P) {
      const L = LA.dignity.labels;
      if (L.includes('detriment') || L.includes('fall')) add(-5, 'lordOfAscDebilitated');
      if (cadent(LA.house)) add(-3, 'lordOfAscCadent');
      if (L.includes('domicile') || L.includes('exaltation')) add(2, 'lordOfAscDignified');
    }
    for (const a of st.aspects) {                                                        // the fortunes' help to the planet
      const other = a.a === P ? a.b : a.b === P ? a.a : null;
      if (other && FORTUNE[other] && (a.aspect === 'trine' || a.aspect === 'sextile' || a.aspect === 'conjunction')) { add(a.applying ? 5 : 3, 'fortuneAspect'); break; }
    }
    const fortuneUp = ['venus', 'jupiter'].some(k => k !== P && [1, 10].includes(H[k]) && !B[k].retro && !B[k].combust);
    if (fortuneUp) add(4, 'fortuneOnAngle');                                          // Dorotheus V.5.11
    if (H.mars === 4 && P !== 'mars' || H.saturn === 4 && P !== 'saturn') add(-4, 'infortuneInFourth');
    // how many lesser impediments a moment may carry: one; two only with Jupiter or Venus on the Ascendant or Midheaven,
    // 'because they will rectify an unfortunate Moon' (Picatrix I.4, for 'some very necessary working'); three, never [SD]
    if (cautions.length >= 3 || (cautions.length === 2 && !fortuneUp)) return fail('too many impediments');
    for (const a of st.aspects) {                                                        // Mercury carries what he meets (Agrippa II.29)
      if (P === 'mercury') break;
      const other = a.a === 'mercury' ? a.b : a.b === 'mercury' ? a.a : null;
      if (other && INFORTUNE[other] && HARD[a.aspect] && a.applying) { add(-2, 'mercuryToInfortune'); break; }
    }
    return {
      ok: true, planet: P, at: ms, tier: major ? 1 : 2, angle, off, sign: b.sign, deg: b.deg, dignity: lab.filter(l => /^(domicile|exaltation|triplicity|term|face)$/.test(l)),
      day: dayOf, dayRuler: st.hour.dayRuler, sect: st.sect, lordOfAsc: lordA, cautions, cautionBy,
      moon: { sign: mb.sign, waxing: m.waxing, illum: m.illum, aspect: next.aspect, to: next.planet, perfects: next.at, toward: moonTo, speed: road.speed },
      score: Math.round(score * 10) / 10, plus, minus
    };
  }

  /* ---------- the minutes within an hour when the planet stands on the Ascendant or the Midheaven ---------- */
  function angleWindows(P, a, b, place, sky) {
    const R = RULES.angle, out = [], STEP = 4 * MIN, n = Math.max(1, Math.ceil((b - a) / STEP));
    const ang = ms => { const t = A.MakeTime(new Date(ms)); return E.angles(t, place, A.e_tilt(t).tobl * D2R); };
    for (const which of ['asc', 'mc']) {
      const g = ms => n180(sky.lon(P, ms) - ang(ms)[which]);                             // degrees the planet has still to go to the cusp
      const inside = d => d >= -R.past && d <= R.short;
      const edge = (t0, t1, in0) => { for (let i = 0; i < 12; i++) { const tm = (t0 + t1) / 2; if (inside(g(tm)) === in0) t0 = tm; else t1 = tm; } return (t0 + t1) / 2; };
      let pt = a, pin = inside(g(a)), run = pin ? { which, start: a } : null;
      for (let i = 1; i <= n; i++) {
        const t = Math.min(b, a + i * STEP), isIn = inside(g(t));
        if (isIn !== pin) { const e = edge(pt, t, pin); if (isIn) run = { which, start: e }; else if (run) { run.end = e; out.push(run); run = null; } }
        pt = t; pin = isIn;
      }
      if (run) { run.end = b; out.push(run); }
    }
    for (const w of out) {                                                               // the best instant: the planet on the cusp itself if the window holds it, else its nearer end
      const g = ms => n180(sky.lon(P, ms) - ang(ms)[w.which]);
      const g0 = g(w.start), g1 = g(w.end);
      if (g0 > 0 && g1 < 0) { let t0 = w.start, t1 = w.end; for (let i = 0; i < 14; i++) { const tm = (t0 + t1) / 2; if (g(tm) > 0) t0 = tm; else t1 = tm; } w.best = (t0 + t1) / 2; }
      else w.best = Math.abs(g0) < Math.abs(g1) ? w.start + 30000 : w.end - 30000;
      w.best = Math.max(w.start + 1000, Math.min(w.end - 1000, w.best));
    }
    return out;
  }

  /* ---------- one election from a window: judged at its best instant, then its true bounds found where the
     judgment still holds ---------- */
  function elect(P, w, place, opts) {
    const rec = judge(P, w.best, place, opts);
    if (!rec.ok) return rec;
    const holds = ms => { const r = judge(P, ms, place, opts); return r.ok && r.angle === rec.angle && r.tier === rec.tier; };
    const close = (good, bad) => { for (let i = 0; i < 7; i++) { const tm = (good + bad) / 2; if (holds(tm)) good = tm; else bad = tm; } return good; };
    const edge = (dir, limit) => {                          // two minutes at a time out from the best instant, so a condition that fails and
      for (let good = w.best; ;) {                          // recovers inside the window is never stepped over; then the edge to a second or two
        const next = good + dir * 2 * MIN;
        if (dir * (next - limit) >= 0) return holds(limit) ? limit : close(good, limit);
        if (!holds(next)) return close(good, next);
        good = next;
      }
    };
    rec.start = edge(-1, w.start + 1000); rec.end = edge(+1, w.end - 1000);
    rec.minutes = Math.round((rec.end - rec.start) / MIN);
    if (rec.minutes < RULES.minWindow) return { ok: false, why: 'short', at: w.best };
    return rec;
  }

  /* ---------- the search ---------- */
  const STEP_SLOW = { moon: 1, sun: 1, mercury: 1, venus: 1, mars: 2, jupiter: 3, saturn: 3 };   // days skipped at a time while the planet has nothing to stand on
  function coarse(P, ms, sky) {                             // can this day hold an election at all, and if not, why
    const l = sky.lon(P, ms), tier = Math.max(tierOf(P, l), P === 'moon' ? tierOf(P, sky.lon(P, ms + DAY)) : -9);
    if (tier === -1) return { fit: false, why: 'debility', sign: Math.floor(l / 30) };
    if (tier === 0) return { fit: false, why: 'peregrine', sign: Math.floor(l / 30) };
    if (P !== 'sun' && P !== 'moon') {
      if (sky.speed(P, ms) <= 0 && sky.speed(P, ms + DAY) <= 0) return { fit: false, why: 'retrograde' };
      const s0 = n180(l - sky.lon('sun', ms)), s1 = n180(sky.lon(P, ms + DAY) - sky.lon('sun', ms + DAY));
      if (Math.abs(s0) < 8.5 && Math.abs(s1) < 8.5 && s0 * s1 > 0 && Math.min(Math.abs(s0), Math.abs(s1)) > 1.5) return { fit: false, why: 'combust' };
    }
    return { fit: true, tier, sign: Math.floor(l / 30) };
  }
  function* hunt(P, env) {
    const res = env.out[P], first = [], second = [], look = RULES.look[P] * DAY, limit = env.from + RULES.horizon[P] * DAY;
    let d = Math.floor((env.from - 12 * HOUR) / DAY), secondOpen = true, waitWhy = null, waitSign = null, anyFit = false;
    const noonOf = day => (day + 0.5) * DAY - (env.place.lon / 15) * HOUR;                // the local mean noon of a day
    for (;;) {
      const noon = noonOf(d);
      if (noon - 12 * HOUR > limit) break;
      yield;
      const c = coarse(P, noon - 12 * HOUR, env.sky);
      if (!c.fit) {
        if (!anyFit && !waitWhy) { waitWhy = c.why; waitSign = c.sign; }
        d += (c.why === 'debility' || c.why === 'peregrine') ? STEP_SLOW[P] : 1;
        if (STEP_SLOW[P] > 1 && (c.why === 'debility' || c.why === 'peregrine')) {     // do not step over the day the planet comes into its own
          const ahead = coarse(P, noonOf(d) - 12 * HOUR, env.sky);
          if (ahead.fit || ahead.why !== c.why || ahead.sign !== c.sign) d -= STEP_SLOW[P] - 1;
        }
        continue;
      }
      if (!anyFit) { anyFit = true; if (waitWhy && noon - env.from > 20 * DAY) res.wait = { why: waitWhy, sign: waitSign, until: noon - 12 * HOUR }; }
      d++;
      if (c.tier === 2 && !secondOpen) continue;
      const pd = env.days.of(noon);
      if (!pd) continue;
      for (const hr of hoursFor(pd, P)) {
        if (hr.end <= env.from + MIN) continue;
        for (const w of angleWindows(P, Math.max(hr.start, env.from), hr.end, env.place, env.sky)) {
          yield;
          const rec = elect(P, w, env.place, env.opts);
          if (!rec.ok) continue;
          if (rec.tier === 1) first.push(rec); else if (secondOpen) second.push(rec);
        }
      }
      const pick = list => { const t0 = list[0].start, pool = list.filter(r => r.start <= t0 + look); return (pool.length >= 3 ? pool.slice().sort((x, y) => y.score - x.score).slice(0, 3) : list.slice(0, 3)).sort((x, y) => x.start - y.start); };
      if (first.length) { res.best = pick(first); if (first.length >= 3 && noon > first[0].start + look) break; }
      if (second.length) { res.lesser = pick(second); if (second.length >= 3 && noon > second[0].start + look) secondOpen = false; }
      if (first.length) secondOpen = false;
    }
    if (res.best.length && res.best[0].start - env.from <= RULES.near * DAY) res.lesser = [];   // the lesser are shown only while the first-rate are far off
    res.done = true;
  }
  /* a searcher: step(deadline) works until the clock passes the deadline, and says when all seven are done. a planet's
     lists are final only once its own search is done; a planet whose search fails is marked so, with nothing listed,
     and the next planet goes on */
  function searcher(place, fromMs, opts = {}) {
    const env = { place, from: fromMs, opts, sky: Sky(), days: Days(place), out: {} };
    for (const P of PLANETS) env.out[P] = { planet: P, done: false, best: [], lesser: [], wait: null };
    const order = ['moon', 'sun', 'venus', 'mercury', 'mars', 'jupiter', 'saturn'].map(P => ({ P, g: hunt(P, env) }));
    let i = 0;
    return {
      place, from: fromMs, planets: env.out,
      get done() { return i >= order.length; },
      get failed() { return PLANETS.some(P => env.out[P].error); },
      step(until) {
        while (i < order.length && until()) {
          try { if (order[i].g.next().done) i++; }
          catch (e) { Object.assign(env.out[order[i].P], { done: true, error: String((e && e.message) || e), best: [], lesser: [], wait: null }); i++; }
        }
        return i >= order.length;
      }
    };
  }

  SD.talismans = { RULES, PLANETS, searcher, judge, moonRoad, tierOf, hoursFor, angleWindows, Days, Sky, inEclipse };
})(window.SD = window.SD || {});
