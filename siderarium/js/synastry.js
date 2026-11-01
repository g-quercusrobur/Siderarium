/* Synastry, after the owner's rules v2.1 (DESIGN.md, "Synastry rules v2.1"). One source of truth for every word the
   pair view shows: the contacts, their weights and polarity, the headline grid, the three categories, the temperament,
   the house overlays, the transits active now, and the age rule that overrides all of it. */
(function () {
  const SD = window.SD = window.SD || {};
  const E = () => SD.engine, C = () => SD.corr;

  const BODIES = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto', 'node', 'ascendant', 'midheaven'];
  const OUTER = new Set(['uranus', 'neptune', 'pluto']), ANGLE = new Set(['ascendant', 'midheaven']);
  // B2: orb class by body; the faster of the two decides. c conj, o opp, t trine, q square, s sextile, x quincunx
  const CLASS = { sun: 0, moon: 0, mercury: 1, venus: 1, mars: 1, jupiter: 2, saturn: 2, ascendant: 2, midheaven: 2, uranus: 3, neptune: 3, pluto: 3, node: 3 };
  const ORBS = [{ c: 8, o: 8, t: 7, q: 7, s: 5, x: 3 }, { c: 6, o: 6, t: 5, q: 5, s: 4, x: 3 }, { c: 5, o: 5, t: 4, q: 4, s: 3, x: 2 }, { c: 3, o: 3, t: 3, q: 3, s: 2, x: 0 }];
  const ASPECTS = [['conjunction', 0, 'c'], ['opposition', 180, 'o'], ['trine', 120, 't'], ['square', 90, 'q'], ['sextile', 60, 's'], ['quincunx', 150, 'x']];
  // B3: the pleasure contacts get at least 6° and 5°
  const PLEASURE_PAIRS = [['venus', 'sun'], ['venus', 'moon'], ['venus', 'mars'], ['mars', 'moon'], ['venus', 'ascendant'], ['mars', 'ascendant']];
  // B4: body weights
  const W = { sun: 10, moon: 10, ascendant: 9, venus: 7, mars: 7, midheaven: 6, mercury: 5, saturn: 5, jupiter: 4, node: 3, uranus: 2, neptune: 2, pluto: 2 };
  // E1: what feeds each category
  const CAT = {
    friendship: { set: new Set(['sun', 'moon', 'mercury', 'jupiter', 'ascendant']) },
    business: { set: new Set(['saturn', 'jupiter', 'mercury', 'midheaven', 'sun']) },
    pleasure: { pairs: [['venus', 'mars'], ['venus', 'ascendant'], ['mars', 'ascendant'], ['sun', 'moon'], ['venus', 'sun'], ['venus', 'moon'], ['venus', 'pluto'], ['mars', 'pluto']] }
  };
  const ELEMENT = ['fire', 'earth', 'air', 'water'];
  const has = (pairs, a, b) => pairs.some(([p, q]) => (p === a && q === b) || (p === b && q === a));
  const inCat = (k, a, b) => CAT[k].set ? CAT[k].set.has(a) && CAT[k].set.has(b) : has(CAT[k].pairs, a, b);
  /* C6: one shared normalization for harmony, strife and adjustment; the categories share their own. Calibrated on
     1,770 random couples so the grid's thresholds split them sensibly (DESIGN.md) */
  const K_ALL = 22, K_CAT = 8;
  const squash = (x, k) => 1 - Math.exp(-Math.max(0, x) / k);

  const years = (a, b) => Math.abs(b.getTime() - a.getTime()) / (365.2425 * 864e5);
  const ageAt = (birth, at) => (at.getTime() - birth.getTime()) / (365.2425 * 864e5);

  /* the age rule (0): who is a minor, and what that forces */
  function ageRule(A, B, at, type) {
    const da = A.date, db = B.date;
    if (!da || !db) return { known: false, anyMinor: true, bothMinor: false, gap: null, family: type === 'parent' || type === 'sibling', vocab: 'safe' };
    const aa = ageAt(da, at), ab = ageAt(db, at), gap = years(da, db), anyMinor = aa < 18 || ab < 18, bothMinor = aa < 18 && ab < 18;
    const forced = anyMinor && gap > 3;                        // 0.2
    const family = forced || type === 'parent' || type === 'sibling';
    // the word for the third category, and whether sexual vocabulary is allowed anywhere
    const third = forced || family ? 'affection' : anyMinor ? (bothMinor && gap <= 3 ? 'attraction' : 'affection') : 'pleasure';
    return { known: true, ages: [aa, ab], gap, anyMinor, bothMinor, forced, family, third, sexual: !anyMinor };
  }

  function points(st, noTime) {
    const p = {};
    for (const k of C().ORDER) p[k] = st.bodies[k].lon;
    p.node = E().trueNode(st.date);
    if (!noTime) { p.ascendant = st.asc; p.midheaven = st.mc; }
    return p;
  }
  /* C, E2: the share of harmony and strife a contact carries */
  function polarity(aspect, a, b, family) {
    if (family && (a === 'saturn' || b === 'saturn')) return [0.5, 0.5];   // E2: Saturn as structure and authority
    if (aspect === 'trine' || aspect === 'sextile') return [1, 0];
    if (aspect === 'square') return [0, 1];
    if (aspect === 'opposition') return [0.5, 0.5];
    if (aspect === 'quincunx') return [0, 0];                                // C5: adjustment, its own axis
    const hard = ['saturn', 'mars', 'pluto'], odd = ['neptune', 'uranus'];
    if (hard.includes(a) || hard.includes(b)) return [0.4, 0.6];
    if (odd.includes(a) || odd.includes(b)) return [0.5, 0.5];
    return [1, 0];                                                           // the lights, Venus, Jupiter, Mercury, the angles, the node: fusion
  }

  /* the whole reading of a pair */
  function of(A, B, opts = {}) {
    const at = opts.at || new Date(), type = opts.type || 'other';
    const age = ageRule(A, B, at, type), family = age.family;
    const noA = !!opts.noTimeA, noB = !!opts.noTimeB;
    const PA = points(A, noA), PB = points(B, noB), gapY = age.known ? age.gap : years(A.date, B.date);
    const contacts = [];
    for (const a of BODIES) for (const b of BODIES) {
      if (PA[a] === undefined || PB[b] === undefined) continue;
      if (gapY <= 7 && OUTER.has(a) && OUTER.has(b)) continue;            // B7
      const d = E().sep(PA[a], PB[b]), cls = Math.min(CLASS[a], CLASS[b]), plea = has(PLEASURE_PAIRS, a, b);
      for (const [name, ang, key] of ASPECTS) {
        let max = ORBS[cls][key]; if (!max) continue;
        if (plea && (key === 'c' || key === 'o')) max = Math.max(max, 6); else if (plea && (key === 't' || key === 'q')) max = Math.max(max, 5);   // B3
        const orb = Math.abs(d - ang); if (orb > max) continue;
        let w = (W[a] * W[b] / 10) * (1 - orb / max);                          // B5
        const outer = OUTER.has(a) || OUTER.has(b);
        if (gapY > 2 && outer) w *= 0.4;                                     // B6
        if (a === 'ascendant' && b === 'ascendant' && (key === 'c' || key === 'o')) w *= 1.5;   // B8
        if (family && (a === 'moon' || b === 'moon')) w *= 1.2;              // E2
        const [hf, sf] = polarity(name, a, b, family);
        contacts.push({ a, b, aspect: name, angle: ang, orb, max, w, h: w * hf, s: w * sf, x: name === 'quincunx' ? w : 0,
          discounted: gapY > 2 && outer, uncertain: (a === 'moon' && noA) || (b === 'moon' && noB) });
        break;                                                               // one aspect per pair of points
      }
    }
    contacts.sort((x, y) => y.w - x.w);
    // F: temperament from Sun, Moon and Ascendant, pairwise across the charts
    const elOf = lon => C().SIGNS[Math.floor(lon / 30)].element;
    const TW = { sun: 3, moon: 3, ascendant: 2 }, compat = (e1, e2) => e1 === e2 || [e1, e2].sort().join() === 'air,fire' || [e1, e2].sort().join() === 'earth,water';
    let tw = 0, ts = 0;
    for (const x of ['sun', 'moon', 'ascendant']) for (const y of ['sun', 'moon', 'ascendant']) {
      if (PA[x] === undefined || PB[y] === undefined) continue;
      const w = TW[x] * TW[y]; tw += w; ts += w * (compat(elOf(PA[x]), elOf(PB[y])) ? 1 : -1);
    }
    const temper = tw ? ts / tw : 0;
    // C6, D: one normalization, then the grid
    const sum = f => contacts.reduce((t, c) => t + c[f], 0);
    const harmony = squash(sum('h'), K_ALL), strife = squash(sum('s'), K_ALL), adjustment = squash(sum('x'), K_ALL);
    const balance = harmony - strife + 0.05 * temper, intensity = (harmony + strife) / 2;   // F3: at most ±0.05
    const label = gridLabel(balance, intensity);
    // E: the three categories, each on the same scale as the whole
    const cats = {};
    for (const k of ['friendship', 'business', 'pleasure']) {
      const cs = contacts.filter(c => inCat(k, c.a, c.b));
      const ch = squash(cs.reduce((t, c) => t + c.h, 0), K_CAT), cst = squash(cs.reduce((t, c) => t + c.s, 0), K_CAT), bal = ch - cst, int = (ch + cst) / 2;
      const grade = !cs.length ? 'neutral' : bal > 0.30 ? 'strongPositive' : bal > 0.10 ? 'positive' : bal < -0.30 ? 'strongFriction' : bal < -0.10 ? 'friction' : int >= 0.30 ? 'mixed' : 'neutral';
      cats[k] = { balance: bal, intensity: int, grade, contacts: cs.slice(0, 5), n: cs.length };
    }
    // D4, D5: the featured contact, the strongest of each polarity (near-equal: angle-to-personal beats angle-to-outer)
    const pick = f => { const xs = contacts.filter(c => c[f] > 0).sort((x, y) => y[f] - x[f]); if (xs.length > 1 && xs[1][f] > 0.95 * xs[0][f] && isOuterAngle(xs[0]) && !isOuterAngle(xs[1])) return xs[1]; return xs[0] || null; };
    const overlays = (noA || noB) ? null : overlaysOf(A, B);
    return { contacts, harmony, strife, adjustment, balance, intensity, label, temper, temperWord: temper > 0.33 ? 'compatible' : temper < -0.33 ? 'tense' : 'mixed',
      cats, featured: contacts[0] || null, topH: pick('h'), topS: pick('s'), age, type: family && type !== 'parent' && type !== 'sibling' ? 'family' : type, overlays, noA, noB };
  }
  const isOuterAngle = c => (ANGLE.has(c.a) || ANGLE.has(c.b)) && (OUTER.has(c.a) || OUTER.has(c.b));
  /* D2: the grid; "aversion" only deep in strife */
  function gridLabel(balance, intensity) {
    if (balance < -0.30 && intensity >= 0.40) return 'aversion';
    const col = balance > 0.10 ? 0 : balance < -0.10 ? 2 : 1, row = intensity >= 0.55 ? 0 : intensity >= 0.30 ? 1 : 2;
    return [['deepBond', 'charged', 'volatile'], ['ease', 'mixed', 'friction'], ['light', 'neutral', 'distance']][row][col];
  }
  /* G1: each person's Sun, Moon, Venus, Mars, Jupiter, Saturn in the other's houses; a gift in the other's 12th goes unseen */
  function overlaysOf(A, B) {
    const out = [];
    for (const [who, X, Y] of [['a', A, B], ['b', B, A]]) for (const k of ['sun', 'moon', 'venus', 'mars', 'jupiter', 'saturn']) {
      const h = E().houseIn(Y.cusps, X.bodies[k].lon);
      out.push({ who, planet: k, house: h, unseen: h === 12 && (k === 'jupiter' || k === 'venus' || k === 'sun') });
    }
    return out;
  }

  /* G2: a transiting outer planet within 1° of a synastry point or its axis, with its exact passes and its stations.
     the points are the two ends of the contacts that carry weight */
  function activeNow(A, B, res, now, noA, noB) {
    const PA = points(A, noA), PB = points(B, noB), out = [];
    const pts = []; const seen = new Set();
    for (const c of res.contacts) for (const [who, k] of [['a', c.a], ['b', c.b]]) { const id = who + k; if (seen.has(id)) continue; seen.add(id); pts.push({ who, key: k, lon: (who === 'a' ? PA : PB)[k], axes: res.contacts.filter(x => (who === 'a' ? x.a : x.b) === k) }); }   // every point a contact touches, with the contacts it belongs to
    for (const t of ['uranus', 'neptune', 'pluto']) {
      const lon = E().lonOf(t, now), hits = [];
      for (const p of pts) { const d = E().sep(lon, p.lon); if (d <= 1) hits.push({ ...p, aspect: 'conjunction', orb: d }); else if (Math.abs(d - 180) <= 1) hits.push({ ...p, aspect: 'opposition', orb: Math.abs(d - 180) }); }
      if (!hits.length) continue;
      const st = stationsAround(t, now), from = st.before || new Date(now.getTime() - 200 * 864e5), to = st.after || new Date(now.getTime() + 200 * 864e5);
      const lo = new Date(from.getTime() - 150 * 864e5), hi = new Date(to.getTime() + 150 * 864e5);
      const main = hits[0], target = main.aspect === 'conjunction' ? main.lon : E().norm360(main.lon + 180);
      out.push({ planet: t, hits, exact: passes(t, target, lo, hi), stations: [st.before, st.after].filter(Boolean) });
    }
    return out;
  }
  const DAY = 864e5;
  function stationsAround(key, now) {
    const sp = d => E().norm180(E().lonOf(key, new Date(d + DAY / 2)) - E().lonOf(key, new Date(d - DAY / 2)));
    const find = (dir) => {
      let t = now.getTime(), s0 = sp(t);
      for (let i = 0; i < 400; i++) {
        const t1 = t + dir * 2 * DAY, s1 = sp(t1);
        if (Math.sign(s1) !== Math.sign(s0)) { let a = Math.min(t, t1), b = Math.max(t, t1), sa = sp(a); for (let j = 0; j < 30; j++) { const m = (a + b) / 2, sm = sp(m); if (Math.sign(sm) === Math.sign(sa)) { a = m; sa = sm; } else b = m; } return new Date((a + b) / 2); }
        t = t1; s0 = s1;
      }
      return null;
    };
    return { before: find(-1), after: find(1) };
  }
  function passes(key, target, from, to) {
    const f = d => E().norm180(E().lonOf(key, new Date(d)) - target), out = [];
    let t = from.getTime(), v = f(t);
    for (; t < to.getTime(); t += 2 * DAY) {
      const t1 = t + 2 * DAY, v1 = f(t1);
      if (Math.sign(v1) !== Math.sign(v) && Math.abs(v1 - v) < 10) { let a = t, b = t1, va = v; for (let j = 0; j < 30; j++) { const m = (a + b) / 2, vm = f(m); if (Math.sign(vm) === Math.sign(va)) { a = m; va = vm; } else b = m; } out.push(new Date((a + b) / 2)); }
      v = v1;
    }
    return out;
  }

  SD.synastry = { of, activeNow, gridLabel, BODIES, W, K_ALL, K_CAT };
})();
