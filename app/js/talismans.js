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
                      or triplicities" on an angle (the midheaven preferred), oriental, direct, "in quarta masculina";
                      "caveas a suis damnacionibus et infortuniis", the worst of them his square with Mars.
      Picatrix I.4    "the root and foundation" of every good work: the Moon "salva a Saturno et Marte et eorum
                      aspectibus", out of the Sun's combustion, "et iungatur fortunis bonis aspectibus"; and the contrary
                      for every evil work. Her misfortunes: eclipsed, within twelve degrees of the Sun, with Saturn or
                      Mars, slow, in the Via Combusta, at the end of a sign, cadent in the 9th; for a necessary work that
                      cannot wait, Jupiter and Venus on the Ascendant or Midheaven "will rectify an unfortunate Moon".
                      An infortune in the ascendant "will overturn and destroy the effect".
      Picatrix II.3   no infortune in the ascendant "nec in aliquo angulorum", the lord of the ascendant never retrograde,
                      the Moon never on the ascendant, held "tamquam radices tocius magice artis"; and if all cannot be
                      kept, at the least the Moon beholding a fortune and the lord of the ascendant by trine or sextile.
      Thabit, the     the lord of the ascendant afflicted, in the house of death, joined to an infortune or in its square
      Speculum        or opposition without reception: the timing of the images of expulsion and destruction.

    What the search does with them [SD]:
      never listed    (what the sources call indispensable, give as the timing of a harmful work, or say turns the work
                      against its maker) the planet out of its hour, in detriment or fall, without dignity, retrograde,
                      combust or cazimi, off the Ascendant (east of the meridian) and the Midheaven; struck by Mars or
                      Saturn (conjunction, square, opposition within Lilly's moieties) or besieged; Mars or Saturn (other
                      than the planet) in the 1st house or within five degrees of an angle; the lord of the Ascendant
                      retrograde, combust, in the 8th, or struck by Mars or Saturn without reception; the Moon waning,
                      within twelve degrees of the Sun, in the Via Combusta, void, joined to Mars or Saturn or in their
                      square or opposition (the talisman's own planet no exception), next applying by square or
                      opposition or to the body of the Sun, Mars or Saturn, on a node, or directed neither to the planet
                      nor to a fortune nor beholding a fortune and the lord of the Ascendant; an eclipse three days
                      before to one after. For the lesser dignity, the planet in a feminine quarter, or a superior
                      occidental.
      named, lowered  (two at most) the Moon's misfortunes of the Picatrix's list, borne only with the remedy: slow, at the
                      end of a sign, cadent in the 9th, in trine or sextile with Mars or Saturn; the Picatrix's other
                      roots, broken only while her minimum holds: Mars or Saturn in the 4th, 7th or 10th, the lord of
                      the Ascendant cadent or debilitated, the Moon on the Ascendant; the other authors': the Moon in
                      Scorpio or Capricorn, in the 6th, 8th or 12th, near a Node, near the full, her lord afflicted;
                      the Dragon's Tail on an angle; the Sun in the 1st outside Leo and Aries.
      first rate      the planet in its own sign or exaltation.
      lesser          the planet in its own terms or triplicity only: the Picatrix's fallback with its conditions,
                      shown as such and only when no first-rate election is near.
      weighed         the planet's day as well as its hour, the Ascendant against the Midheaven, the Moon applying to the
                      planet itself or a fortune, her light, speed, sign, house and lord, the terms of the infortunes,
                      the Sun's beams, the fortunes' help.
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
    version: 3,
    // the planet on the angle: from `short` degrees before the cusp (still to rise or to culminate, in the 1st or 10th
    // house) to `past` degrees beyond it (Lilly gives a planet five degrees past a cusp to that house; three here [SD])
    angle: { short: 7, past: 3 },
    minWindow: 4,                 // minutes: a shorter window is no time to work in
    moonRays: 12,                 // degrees from the Sun, either side (Picatrix I.4)
    moonSlow: 12,                 // degrees a day (Picatrix I.4)
    eclipse: { before: 3, after: 1 },   // days around a solar eclipse or an umbral lunar eclipse
    separating: { planet: 0.5, moon: 0.5 }, // the share of the moieties within which an aspect already separating still binds (Saturn and Mars on each other: the whole)
    node: 5,                      // degrees: the Moon on a node, 'in ecliptica' (Agrippa II.30; Sahl 30) [SD]
    viaCombusta: [188, 225],      // 8 Libra to 15 Scorpio: the Picatrix's bounds in the English (8 Libra) and Bonatti's and Lilly's (15 Scorpio) together
    look: { moon: 60, sun: 45, mercury: 45, venus: 45, mars: 60, jupiter: 90, saturn: 90 },   // days from the first find among which the three best are chosen
    horizon: { moon: 2600, sun: 3650, mercury: 2600, venus: 2600, mars: 2600, jupiter: 4600, saturn: 6000 },   // days searched: elections that keep every rule are rare
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
      const set = A.SearchRiseSet(SUN, obs, -1, rise.AddDays(1e-4), 1.2), next = set && A.SearchRiseSet(SUN, obs, +1, set.AddDays(1e-4), 1.2);   // as the engine: a few seconds past each crossing
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
        if (t > ms && t < leave) out.push({ planet: k, aspect: name, at: t });   // an aspect not yet exact is still to come, to the last instant
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
  const SUPERIOR = { mars: 1, jupiter: 1, saturn: 1 };
  const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const lordOf = signIdx => SEVEN.find(k => (C.DOMICILE[k] || []).includes(C.SIGNS[signIdx].key));   // the traditional ruler of a sign
  const cadent = h => h === 3 || h === 6 || h === 9 || h === 12;
  const ANGLES = [1, 4, 7, 10];
  /* the orbs of the planets, Lilly's larger set (Christian Astrology p. 107): two planets are joined while they stand within
     half of each one's orb, added together, of the exact aspect. the clock's own aspect orbs are for display and narrower */
  const ORBS = { sun: 17, moon: 12.5, mercury: 7, venus: 8, mars: 7.5, jupiter: 12, saturn: 10 };
  const PTOLEMAIC = [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]];
  const HARD_ASPECTS = PTOLEMAIC.filter(a => HARD[a[0]]), EASY_ASPECTS = PTOLEMAIC.filter(a => a[0] === 'sextile' || a[0] === 'trine');
  function contact(B, x, y, set) {                          // the nearest aspect of the set between x and y within the moieties
    const lim = (ORBS[x] + ORBS[y]) / 2, d = sep(B[x].lon, B[y].lon), d1 = sep(B[x].lon + B[x].speed / 24, B[y].lon + B[y].speed / 24);   // and an hour on
    let best = null;
    for (const [aspect, ang] of set) { const orb = Math.abs(d - ang); if (orb <= lim && (!best || orb < best.orb)) best = { aspect, orb, lim, applying: Math.abs(d1 - ang) < orb }; }
    return best;
  }
  // joined: applying anywhere within the moieties, or separating within `share` of them
  const joined = (B, x, y, set, share) => { const c = contact(B, x, y, set); return c && (c.applying || c.orb <= c.lim * share) ? c : null; };
  // reception: either stands in the other's domicile or exaltation, and the aspect between them does not harm
  const owns = (k, signIdx) => (C.DOMICILE[k] || []).includes(C.SIGNS[signIdx].key) || C.EXALTATION[k] === C.SIGNS[signIdx].key;
  const received = (B, x, y) => owns(y, B[x].sign) || owns(x, B[y].sign);

  /* the lesser impediments, named on the line and lowering the rank:
       the Moon's misfortunes in the Picatrix's own list (I.4): borne only with the remedy, Jupiter or Venus on the
         Ascendant or Midheaven, 'because they will rectify an unfortunate Moon';
       the Picatrix's 'roots' (II.3): broken only while her minimum holds, 'si omnia ista non possent plene considerari,
         tamen aspicias ut Luna sit aspiciens fortunam et dominum ascendentis trino vel sextili';
       the other authors' (Sahl, Bonatti, Dorotheus, Ramesey): named and weighed.
     two at most, three never [SD] */
  const CAUTION = {
    moonFall: 12,                // the Moon in Scorpio or Capricorn, her fall and detriment (Sahl 22; Bonatti, Cons. 5)
    moonNinth: 10,               // cadent from the Midheaven, in the 9th ('nec cadens ab angulo medii celi', Picatrix I.4)
    moonCadent: 8,               // in the 6th, 8th or 12th, unseen by the Ascendant (Bonatti; Ficino III.6, the 8th)
    moonNode: 10,                // within twelve degrees of a Node, the bound of eclipse (Sahl 22; Bonatti, Cons. 5)
    moonSlow: 10,                // under 12 degrees a day (Picatrix I.4; Agrippa II.30)
    moonOppositeSun: 10,         // within twelve degrees of the full (Bonatti, Cons. 5)
    moonLastTerm: 6,             // the last degrees of a sign, the terms of the infortunes (Picatrix I.4, 'nec in fine signorum')
    moonToInfortune: 12,         // a trine or sextile of Mars or Saturn within the moieties ('salva a Saturno et Marte et eorum aspectibus', Picatrix I.4)
    moonLordAfflicted: 8,        // her lord retrograde, burnt, or debilitated and cadent (Dorotheus V.5: 'until the Moon and its lord is ameliorated')
    infortuneInAngle: 14,        // Mars or Saturn in the 4th, 7th or 10th (Picatrix II.3, 'nec in aliquo angulorum'; Ramesey III.1)
    lordOfAscWeak: 10,           // the lord of the Ascendant cadent or in its detriment or fall (Thabit ch. 3; Agrippa II.50)
    moonOnAscendant: 12,         // 'nullo modo ponas Lunam in ascendente' (Picatrix II.3; Ramesey III.1; but Picatrix I.4 places her there)
    tailOnAngle: 10,             // the Dragon's Tail on the Ascendant (Ramesey III.1) or the Midheaven [SD]
    sunInFirst: 6                // the Sun in the 1st outside Leo and Aries (Ramesey III.1; against him, Picatrix II.3)
  };
  const PICATRIX_I4 = { moonSlow: 1, moonLastTerm: 1, moonNinth: 1, moonToInfortune: 1 };   // the Moon's misfortunes the Picatrix (I.4) cures only with Jupiter or Venus
  const PICATRIX_II3 = { infortuneInAngle: 1, lordOfAscWeak: 1, moonOnAscendant: 1 };      // the 'roots' (II.3) broken only while her minimum holds
  function judge(P, ms, place, opts = {}) {
    const st = E.compute(new Date(ms), place, { light: true, houses: opts.houses || 'regiomontanus' });
    const fail = (why, turns) => { if (opts.trace) opts.trace(P, why); return { ok: false, why, at: ms, turns: !!turns }; };   // turns: the turning sky may lift it within the hour
    const B = st.bodies, b = B[P], lab = b.dignity.labels, has = x => lab.includes(x);
    const cautions = [], cautionBy = {}, caution = (key, by, how) => { cautions.push(key); if (by) cautionBy[key] = { by, how }; };
    const houseOf = lon => { const h = E.houseIn(st.cusps, lon), nx = h % 12 + 1; return n360(st.cusps[nx] - lon) < 5 ? nx : h; };   // Lilly: within five degrees of the next cusp, the body is in that house
    const H = {}; for (const k of SEVEN) H[k] = houseOf(B[k].lon);
    const share = (x, y) => (INFORTUNE[x] && INFORTUNE[y]) ? 1 : RULES.separating.planet;   // Saturn and Mars on each other: the whole moiety ('quorum deterior omnibus est aspectus ipsius ad Martem quartus', Picatrix III.7)
    if (!st.hour || st.hour.polar) return fail('polar');
    if (n360(st.asc - st.mc) >= 180) return fail('polar ascendant');                    // beyond the polar circles the formula's 'ascendant' is at times the point setting in the west
    // ---------- the core: what the sources call indispensable, give as the timing of a harmful work, or say turns the
    //            work against its maker. a moment that breaks one is never listed ----------
    // 1 · the hour of the planet (Picatrix II.10, every image; Agrippa II.29; Lilly p. 485). the day is weighed, not
    //     required: Agrippa II.29 asks day and hour, but II.34 allows 'both or one', Picatrix II.10 names the hour only,
    //     and Ficino III.2 asks the day 'si fieri potest'
    if (st.hour.hourRuler !== P) return fail('hour');
    // 2 · the planet in its dignities, never in its detriment or fall (Agrippa II.34, its 'dejections'; Thabit ch. 5;
    //     Lilly's table). Agrippa's tables (II.22): made with the planet unfortunate, the talisman does the contrary of its good
    if (has('detriment') || has('fall')) return fail(has('fall') ? 'fall' : 'detriment');
    const major = has('domicile') || has('exaltation'), lesser = has('term') || has('triplicity');
    if (!major && !lesser) return fail('peregrine');
    // a triplicity alone, in the minutes when the Sun's rim is up and its centre is not (or the reverse): the sect is in
    // doubt, and with it the dignity [SD]
    if (!major && !has('term') && (st.sect === 'day') !== !!st.hour.isDay) return fail('sect in doubt', true);
    // 3 · direct, out of combustion and out of the Sun's body: 'all Planets are afraid of the conjunction of the Sun'
    //     (Agrippa II.29-30; Picatrix II.3, III.7: retrograde, 'like a man full of anger')
    if (b.retro) return fail('retrograde');
    if (b.combust) return fail('combust');
    if (b.cazimi) return fail('joined to the sun');
    // 4 · on the Ascendant or the Midheaven ('in the hour of the planet, the planet ascending'; Agrippa II.30, 'in Angles,
    //     especially of the rising, or Tenth')
    const dA = n180(b.lon - st.asc), dM = n180(b.lon - st.mc), R = RULES.angle;
    const onA = dA >= -R.past && dA <= R.short && b.H < 0, onM = dM >= -R.past && dM <= R.short;   // rising means east of the meridian
    if (!onA && !onM) return fail('angle', true);
    const angle = onA && (!onM || Math.abs(dA) <= Math.abs(dM)) ? 'asc' : 'mc', off = angle === 'asc' ? dA : dM;
    // 4b · its terms or triplicity only: the Picatrix's fallback (III.7) with its own conditions, 'in quarta masculina'
    //     (the 10th to the 12th house, the 4th to the 6th: Bonatti), and oriental for the superiors
    if (!major) {
      if (angle === 'mc' ? dM < 0 : dA > 0) return fail('feminine quarter', true);
      if (SUPERIOR[P] && n180(B.sun.lon - b.lon) <= 0) return fail('occidental');
    }
    // 5 · free of Mars and Saturn: no conjunction, square or opposition within Lilly's moieties, applying, or separating
    //     within half of them (Agrippa II.29: unfortunate 'by the aspect of Saturn or Mars, especially opposite, or
    //     quadrant'); not besieged between their bodies (Lilly p. 114)
    for (const k of ['mars', 'saturn']) if (k !== P && joined(B, P, k, HARD_ASPECTS, share(P, k))) return fail('struck by ' + k, P === 'moon');
    if (!INFORTUNE[P] && sep(b.lon, B.mars.lon) < 12 && sep(b.lon, B.saturn.lon) < 12 && n180(B.mars.lon - b.lon) * n180(B.saturn.lon - b.lon) < 0) return fail('besieged');
    // 6 · no infortune (other than the planet) in the Ascendant or within five degrees of an angle: in the ascendant it
    //     'will overturn and destroy the effect' (Picatrix I.4; II.3; Bonatti; Ramesey III.1)
    for (const k of ['mars', 'saturn']) if (k !== P && (H[k] === 1 || st.onAngles.some(x => x.planet === k))) return fail(k + ' in the ascendant or on an angle', true);
    // 7 · the lord of the Ascendant neither retrograde ('nullo modo', Picatrix II.3) nor burnt, nor struck by Mars or Saturn,
    //     nor in the house of death: the Speculum (ch. 11) and Thabit (ch. 1) give these for the image of destruction and
    //     of expulsion, and the contrary for good images
    const lordA = lordOf(Math.floor(st.asc / 30)), LA = B[lordA], LAL = LA.dignity.labels;
    if (LA.retro) return fail('lord of the ascendant retrograde', true);
    if (LA.combust) return fail('lord of the ascendant combust', true);
    if (lordA !== P) {
      if (H[lordA] === 8) return fail('lord of the ascendant in the eighth', true);
      for (const k of ['mars', 'saturn']) if (k !== lordA && joined(B, lordA, k, HARD_ASPECTS, share(lordA, k)) && !received(B, lordA, k)) return fail('lord of the ascendant struck by ' + k, true);   // 'absque ulla receptione' (Speculum ch. 11)
    }
    // 8 · the Moon: waxing, out of the Sun's rays, out of the burnt way, not void, not on a node; neither joined to Mars or
    //     Saturn nor in their square or opposition, nor applying to either by any aspect, the talisman's own planet no
    //     exception: that is the Picatrix's timing 'in omni opere malo' (I.4; Agrippa II.30, II.45; Sahl 22; Dorotheus V.5)
    const m = st.moon, mb = B.moon, dSun = sep(mb.lon, B.sun.lon);
    if (!m.waxing) return fail('moon waning');
    if (dSun < RULES.moonRays) return fail('moon under the rays');
    if (mb.lon >= RULES.viaCombusta[0] && mb.lon < RULES.viaCombusta[1]) return fail('moon in the via combusta');
    const road = moonRoad(ms), next = road.list[0] || null;
    if (!next) return fail('moon void of course', true);
    if (!m.next || m.next.planet !== next.planet || m.next.aspect !== next.aspect) return fail('moon uncertain', true);   // the clock's own reading must agree
    for (const k of ['mars', 'saturn']) { const c = joined(B, 'moon', k, HARD_ASPECTS, RULES.separating.moon); if (c) return fail('moon ' + c.aspect + ' ' + k); }
    if (!FRIENDLY[next.aspect]) return fail('moon applying by ' + next.aspect, true);   // her next aspect: a trine, a sextile or a conjunction
    if (next.aspect === 'conjunction' && (next.planet === 'sun' || INFORTUNE[next.planet])) return fail('moon applying to the body of ' + next.planet, true);
    const node = E.trueNode(new Date(ms)), tail = n360(node + 180), dNode = Math.min(sep(mb.lon, node), sep(mb.lon, tail));
    if (dNode < RULES.node) return fail('moon on a node');                             // 'non sit in ecliptica' (Agrippa II.30; Sahl 30, 'horribile')
    // 9 · the Moon directed: her next aspect to the planet (Agrippa II.29, 'lunam ad hunc observes opportune directam:
    //     nihil enim sine lunae beneficio perfeceris') or to a fortune ('et iungatur fortunis bonis aspectibus', Picatrix
    //     I.4), or at the least her beholding a fortune and the lord of the Ascendant by trine or sextile (Picatrix II.3)
    const beholds = k => k === 'moon' || !!joined(B, 'moon', k, EASY_ASPECTS, RULES.separating.moon);
    const minimum = ['venus', 'jupiter'].some(beholds) && beholds(lordA);
    const directed = next.planet === P || !!FORTUNE[next.planet];
    if (!directed && !minimum) return fail('moon not directed', true);
    // 10 · no eclipse near: three days before to one day after, Bonatti's bound for the Moon's, kept for the Sun's [SD]
    if (inEclipse(ms)) return fail('eclipse');

    // ---------- the lesser impediments ----------
    if (mb.sign === 7 || mb.sign === 9) caution('moonFall');
    if (H.moon === 9) caution('moonNinth'); else if ([6, 8, 12].includes(H.moon)) caution('moonCadent', [], H.moon);
    if (dNode < 12) caution('moonNode');
    if (road.speed < RULES.moonSlow) caution('moonSlow');
    if (180 - dSun < RULES.moonRays) caution('moonOppositeSun');
    if (mb.deg >= C.TERMS[C.SIGNS[mb.sign].key][3][1]) caution('moonLastTerm');
    if (INFORTUNE[next.planet]) caution('moonToInfortune', [next.planet], next.aspect);   // her next aspect a trine or sextile of Mars or Saturn
    else for (const k of ['mars', 'saturn']) { const c = joined(B, 'moon', k, EASY_ASPECTS, RULES.separating.moon); if (c) { caution('moonToInfortune', [k], c.aspect); break; } }
    { const dk = lordOf(mb.sign), D = B[dk], DL = D.dignity.labels;
      if (dk !== 'moon') { const how = D.retro ? 'retrograde' : D.combust ? 'combust' : (DL.includes('detriment') || DL.includes('fall')) && cadent(H[dk]) ? 'weak' : null; if (how) caution('moonLordAfflicted', [dk], how); } }
    { const inAngle = ['mars', 'saturn'].filter(k => k !== P && (H[k] === 4 || H[k] === 7 || H[k] === 10)); if (inAngle.length) caution('infortuneInAngle', inAngle); }
    if (lordA !== P) { const how = cadent(H[lordA]) ? 'cadent' : LAL.includes('fall') ? 'fall' : LAL.includes('detriment') ? 'detriment' : null;
      if (how && !(lordA === 'moon' && how !== 'cadent' && cautions.includes('moonFall'))) caution('lordOfAscWeak', [lordA], how); }   // the Moon ruling the Ascendant in her fall is one impediment, not two
    if (P !== 'moon' && (H.moon === 1 || sep(mb.lon, st.asc) < 5)) caution('moonOnAscendant');
    if (sep(tail, st.asc) < 5 || sep(tail, st.mc) < 5) caution('tailOnAngle');
    if (P !== 'sun' && H.sun === 1 && B.sun.sign !== 0 && B.sun.sign !== 4) caution('sunInFirst');
    // the remedy (Picatrix I.4; Ficino III.6, one of them is enough): Jupiter or Venus in the 1st or 10th, direct, out of
    // the beams, out of its detriment and fall, free of any aspect of Mars and Saturn (Dorotheus V.5.11-13: else 'this
    // action will have no strength'); the talisman's own planet, when it is the fortune rising or culminating, counts
    const remedy = ['venus', 'jupiter'].some(k => {
      if (H[k] !== 1 && H[k] !== 10) return false;
      const F = B[k], FL = F.dignity.labels;
      if (F.retro || F.combust || F.beams || F.cazimi || FL.includes('detriment') || FL.includes('fall')) return false;
      return !['mars', 'saturn'].some(j => joined(B, k, j, PTOLEMAIC, RULES.separating.planet));
    });
    if (cautions.some(c => PICATRIX_I4[c]) && !remedy) return fail('the moon impeded, with no remedy', true);
    if (cautions.some(c => PICATRIX_II3[c]) && !minimum) return fail('a root broken, without the minimum', true);
    if (cautions.length >= 3) return fail('too many impediments', true);               // two at most, whatever their kind [SD]
    if (opts.strict && cautions.length) return fail('impeded: ' + cautions.join(', '), true);

    // ---------- the weighing [SD]: what the sources ask for beyond the bare formula, in their order of insistence ----------
    const moonTo = next.planet === P ? 'planet' : FORTUNE[next.planet] ? 'fortune' : next.planet === lordA ? 'lord' : 'other';
    const plus = [], minus = [];
    let score = 0;
    const add = (n, key) => { score += n; (n >= 0 ? plus : minus).push(key); };
    for (const c of cautions) add(-CAUTION[c], c);
    if (has('exaltation')) add(30, 'exaltation'); else if (has('domicile')) add(27, 'domicile');
    else { if (has('triplicity')) add(12, 'triplicity'); if (has('term')) add(9, 'term'); }
    if (major && has('term')) add(2, 'term'); if (major && has('triplicity')) add(2, 'triplicity'); if (has('face')) add(2, 'face');
    const dayOf = st.hour.dayRuler === P;
    if (dayOf) add(12, 'day');                                                         // Agrippa II.29, the Heptameron, Ficino III.2: day and hour
    add(major ? (angle === 'asc' ? 10 : 9) : (angle === 'mc' ? 10 : 9), angle);         // the rising first (Agrippa II.30); for the fallback, the Midheaven (Picatrix III.7)
    score += 4 * (1 - Math.min(1, Math.abs(off) / RULES.angle.short));                 // the nearer the cusp the better
    if (moonTo === 'planet') add(next.aspect === 'sextile' ? 12 : 14, 'moonToPlanet');   // 'the Moon opportunely directed to this' (Agrippa II.29, II.32)
    else if (moonTo === 'fortune') add(8, 'moonToFortune');                           // 'joined to the fortunes by good aspects' (Picatrix I.4)
    else if (moonTo === 'lord') add(5, 'moonToLord');
    else add(2, 'moonToOther');
    if (minimum) add(4, 'moonBeholdsFortuneAndLord');                                  // Picatrix II.3
    if (road.speed > 13.5) add(3, 'moonSwift');
    if (m.illum > 0.25 && m.illum < 0.95) add(3, 'moonLight');
    if (P !== 'moon') { const ml = mb.dignity.labels; if (ml.includes('domicile') || ml.includes('exaltation')) add(3, 'moonDignified'); }
    if (mb.sign === 2) add(-3, 'moonInGemini');                                        // the twelfth from her house (Bonatti)
    { const lat = A.EclipticGeoMoon(A.MakeTime(new Date(ms))).lat, lat1 = A.EclipticGeoMoon(A.MakeTime(new Date(ms + HOUR))).lat;
      if (lat < 0 && lat1 < lat) add(-3, 'moonDescendingSouth'); }                     // Agrippa II.30; Ficino III.6
    { const dk = lordOf(mb.sign); if (ANGLES.includes(H[dk])) add(2, 'moonLordAngular'); else if (cadent(H[dk])) add(-3, 'moonLordCadent'); }
    { const t = C.TERMS[C.SIGNS[mb.sign].key].find(x => mb.deg < x[1]);                 // 'nec in finibus Martis vel Saturni' (Ficino III.6)
      if (t && INFORTUNE[t[0]] && !cautions.includes('moonLastTerm')) add(-4, 'moonInTermOfInfortune'); }
    if (P !== 'sun' && P !== 'moon') { if (b.beams) add(-6, 'beams'); else add(4, 'freeOfBeams'); }
    if (P !== 'sun' && P !== 'moon') {
      const term = C.TERMS[C.SIGNS[b.sign].key].find(t => b.deg < t[1]);
      if (term && INFORTUNE[term[0]] && term[0] !== P) add(-4, 'termOfInfortune');        // Agrippa II.30; Ficino III.10: not in the terms of Saturn or Mars
      if (b.station) add(-3, 'slow');
      const east = n180(B.sun.lon - b.lon) > 0;                                         // oriental: rising before the Sun
      if (SUPERIOR[P]) add(east ? 2 : -2, east ? 'oriental' : 'occidental');
      else add(east ? -1 : 2, east ? 'oriental' : 'occidental');                       // Lilly p. 115
    }
    for (const k of ['mars', 'saturn']) if (k !== P && joined(B, P, k, EASY_ASPECTS, RULES.separating.planet)) { add(-4, 'infortuneAspect'); break; }   // 'it subtracts something of its goodness' (Bonatti Tr. VII)
    if (lordA !== P) {
      if (LAL.includes('domicile') || LAL.includes('exaltation')) add(2, 'lordOfAscDignified');
      if (ANGLES.includes(H[lordA])) add(2, 'lordOfAscAngular');                       // 'let him be strong, & in an angle' (Agrippa II.50)
    }
    for (const k of ['venus', 'jupiter']) if (k !== P && joined(B, P, k, [['conjunction', 0], ...EASY_ASPECTS], 0.5)) { add(4, 'fortuneAspect'); break; }   // the fortunes' help to the planet
    if (remedy) add(4, 'fortuneOnAngle');                                             // Dorotheus V.5.11
    for (const a of st.aspects) {                                                        // Mercury carries what he meets (Agrippa II.29)
      if (P === 'mercury') break;
      const other = a.a === 'mercury' ? a.b : a.b === 'mercury' ? a.a : null;
      if (other && INFORTUNE[other] && HARD[a.aspect] && a.applying) { add(-2, 'mercuryToInfortune'); break; }
    }
    return {
      ok: true, planet: P, at: ms, tier: major ? 1 : 2, angle, off, sign: b.sign, deg: b.deg, dignity: lab.filter(l => /^(domicile|exaltation|triplicity|term|face)$/.test(l)),
      day: dayOf, dayRuler: st.hour.dayRuler, sect: st.sect, lordOfAsc: lordA, cautions, cautionBy, remedy, minimum,
      moon: { sign: mb.sign, mansion: mb.mansion, waxing: m.waxing, illum: m.illum, aspect: next.aspect, to: next.planet, perfects: next.at, toward: moonTo, speed: road.speed },
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

  /* ---------- one election from a window: judged at its best instant, or, when what fails there may lift as the sky
     turns, at the first instant along the window that passes; then walked out to its true bounds. the record is the one
     at the instant nearest the cusp, and names every impediment met anywhere inside the window ---------- */
  function elect(P, w, place, opts) {
    let seed = w.best, rec = judge(P, seed, place, opts);
    if (!rec.ok && rec.turns) {
      for (let i = 1; !rec.ok; i++) {
        const a = w.best - i * 6 * MIN, b = w.best + i * 6 * MIN;      // six minutes apart: shorter runs are no time to work in anyway
        if (a <= w.start && b >= w.end) break;
        for (const t of [a, b]) { if (t <= w.start || t >= w.end) continue; const r = judge(P, t, place, opts); if (r.ok) { seed = t; rec = r; break; } }
      }
    }
    if (!rec.ok) return rec;
    const met = new Set(rec.cautions), metBy = { ...rec.cautionBy };
    const holds = ms => { const r = judge(P, ms, place, opts), ok = r.ok && r.angle === rec.angle && r.tier === rec.tier;
      if (ok) { r.cautions.forEach(c => met.add(c)); for (const k in r.cautionBy) if (!metBy[k]) metBy[k] = r.cautionBy[k]; }
      return ok; };
    const close = (good, bad) => { for (let i = 0; i < 7; i++) { const tm = (good + bad) / 2; if (holds(tm)) good = tm; else bad = tm; } return good; };
    const edge = (dir, limit) => {                          // two minutes at a time out from the seed, so a condition that fails and
      for (let good = seed; ;) {                            // recovers inside the window is never stepped over; then the edge to a second or two
        const next = good + dir * 2 * MIN;
        if (dir * (next - limit) >= 0) return holds(limit) ? limit : close(good, limit);
        if (!holds(next)) return close(good, next);
        good = next;
      }
    };
    const start = edge(-1, w.start + 1000), end = edge(+1, w.end - 1000), minutes = Math.round((end - start) / MIN);
    if (minutes < RULES.minWindow) return { ok: false, why: 'short', at: seed };
    const at = Math.min(end, Math.max(start, w.best));
    const out = at === seed ? rec : judge(P, at, place, opts);
    if (!out.ok) return { ok: false, why: 'unsteady', at };
    out.cautions.forEach(c => met.add(c));
    return Object.assign(out, { start, end, minutes, cautions: [...met], cautionBy: { ...metBy, ...out.cautionBy } });
  }

  /* ---------- the search ---------- */
  const STEP_SLOW = { moon: 1, sun: 1, mercury: 1, venus: 1, mars: 2, jupiter: 3, saturn: 3 };   // days skipped at a time while the planet has nothing to stand on
  function coarse(P, ms, sky) {                             // can this day hold an election at all, and if not, why
    const l = sky.lon(P, ms), tier = Math.max(tierOf(P, l), tierOf(P, sky.lon(P, ms + 1.3 * DAY)));   // both ends of the planetary day: an ingress inside it is not lost
    if (tier === -1) return { fit: false, why: 'debility', sign: Math.floor(l / 30) };
    if (tier === 0) return { fit: false, why: 'peregrine', sign: Math.floor(l / 30) };
    if (P !== 'sun' && P !== 'moon') {
      if (sky.speed(P, ms) <= 0 && sky.speed(P, ms + DAY) <= 0) return { fit: false, why: 'retrograde' };
      const s0 = n180(l - sky.lon('sun', ms)), s1 = n180(sky.lon(P, ms + DAY) - sky.lon('sun', ms + DAY));
      if (Math.abs(s0) < 8.5 && Math.abs(s1) < 8.5 && s0 * s1 > 0 && Math.min(Math.abs(s0), Math.abs(s1)) > 1.5) return { fit: false, why: 'combust' };
    }
    const e0 = n360(sky.lon('moon', ms) - sky.lon('sun', ms)), e1 = n360(sky.lon('moon', ms + 1.3 * DAY) - sky.lon('sun', ms + 1.3 * DAY));
    if (e0 >= 180 && e1 >= 180 && e1 > e0) return { fit: false, why: 'moon waning', sign: Math.floor(l / 30) };   // the Moon wanes the whole day: no work of increase
    return { fit: true, tier, sign: Math.floor(l / 30) };
  }
  function* hunt(P, env) {
    const res = env.out[P], first = [], second = [], look = RULES.look[P] * DAY, limit = env.from + RULES.horizon[P] * DAY;
    let d = Math.floor((env.from - 12 * HOUR) / DAY) - 1, secondOpen = true, waitWhy = null, waitSign = null, anyFit = false;   // a day early: the planetary day under way is searched too
    const noonOf = day => (day + 0.5) * DAY - (env.place.lon / 15) * HOUR;                // the local mean noon of a day
    for (;;) {
      const noon = noonOf(d);
      if (noon - 12 * HOUR > limit) break;
      yield;
      const c = coarse(P, noon - 12 * HOUR, env.sky), dignified = c.why !== 'debility' && c.why !== 'peregrine';
      if (dignified && !anyFit) { anyFit = true; if (waitWhy && noon - env.from > 20 * DAY) res.wait = { why: waitWhy, sign: waitSign, until: noon - 12 * HOUR }; }   // the first day it has a dignity to stand on
      if (!c.fit) {
        if (!anyFit && !waitWhy) { waitWhy = c.why; waitSign = c.sign; }
        d += (c.why === 'debility' || c.why === 'peregrine') ? STEP_SLOW[P] : 1;
        if (STEP_SLOW[P] > 1 && (c.why === 'debility' || c.why === 'peregrine')) {     // do not step over the day the planet comes into its own
          const ahead = coarse(P, noonOf(d) - 12 * HOUR, env.sky);
          if (ahead.fit || ahead.why !== c.why || ahead.sign !== c.sign) d -= STEP_SLOW[P] - 1;
        }
        continue;
      }
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
    const order = (opts.only || ['moon', 'sun', 'venus', 'mercury', 'mars', 'jupiter', 'saturn']).map(P => ({ P, g: hunt(P, env) }));
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
