/* The temperament of the native: the complexion laid down at birth, the mixture of the four qualities (hot, cold, moist,
   dry) and of the four humours they make. Computed from the significators Ptolemy names (Tetrabiblos III.11) and Lilly
   lists (Christian Astrology III, ch. CVI, after Garcaeus 1576), weighed as in Greenbaum's reconstruction (2005), judged
   by the rows (Ribeiro 2008-9), read after Ficino (De vita), Agrippa (Occult Philosophy) and the Picatrix.
   DESIGN.md, "Temperament", gives every rule its source; [SD] marks the instrument's choice where the sources part.

   The testimonies: each gives one pair of qualities, so one temperament, with a weight.
     S1  the quarter of the year (the Sun's quadrant of the zodiac)                                   2
     S2  the sign ascending, by triplicity                                                            2
     S3  the lord of the Ascendant, by nature                                                         1
     S4  the almuten of the ascending degree, by nature, shared when planets tie                      1
     S5  the Moon's sign                                                                              2
     S6  the Moon's quarter                                                                           1
     S7  the lord of the Moon, by place                                                               1
     S8  the lord of the Ascendant, by place                                                          1
     S9  each planet and node in the first house, by nature; the Moon there "twice exhibited"         1 each
     S10 each planet beholding the ascending degree within 3° [SD], by place; a conjunction by nature  ½
     S11 each planet beholding the Moon within the mediety of their orbs, likewise                    ½
     S12 the Lord of the Geniture, by place                                                           1
   By nature: Saturn cold and dry, Jupiter hot and moist, Mars and the Sun hot and dry, the Moon cold and moist, Venus
   hot and moist (Ptolemy I.4, Ribeiro), Mercury hot and dry oriental, cold and dry occidental [SD].
   By place: the triplicity of the planet's sign; the Sun by the quarter of the year, the Moon by her quarter (Lilly p. 533).
   Weights are kept in twelfths, so every comparison is exact. */
(function () {
  const SD = window.SD = window.SD || {};
  const C = () => SD.corr, E = () => SD.engine, I = () => SD.i18n;

  const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const TEMPS = ['sanguine', 'choleric', 'melancholic', 'phlegmatic'];
  const PAIR = { HM: 'sanguine', HD: 'choleric', CD: 'melancholic', CM: 'phlegmatic' };      // Lilly CA III p. 532
  const QUAL = { sanguine: 'HM', choleric: 'HD', melancholic: 'CD', phlegmatic: 'CM' };
  const CONTRARY = { sanguine: 'melancholic', melancholic: 'sanguine', choleric: 'phlegmatic', phlegmatic: 'choleric' };
  const ELEMENT_Q = { fire: 'HD', earth: 'CD', air: 'HM', water: 'CM' };                     // the signs by triplicity (Lilly, Garcaeus)
  const QUARTER_Q = ['HM', 'HD', 'CD', 'CM'];   // spring, summer, autumn, winter; and the Moon's four quarters (Lilly p. 533; Agrippa II.32)
  const W2 = 24, W1 = 12, WH = 6;              // the weights in twelfths
  const ORB = { sun: 17, moon: 12.5, mercury: 7, venus: 8, mars: 7.5, jupiter: 12, saturn: 10 };   // Lilly CA I p. 107
  const TO_ASC = 3;                            // "partilly aspecting the ascendant": Lilly's own example counts 2°25′ and 2°43′ [SD]
  const ASPECTS = [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]];
  const POINTS = { domicile: 5, exaltation: 4, triplicity: 3, term: 2, face: 1 };
  // the Lord of the Geniture: Lilly's table of fortitudes and debilities (CA I p. 115), his mean motions (CA I)
  const HOUSE_PTS = { 1: 5, 10: 5, 4: 4, 7: 4, 11: 4, 2: 3, 5: 3, 9: 2, 3: 1, 6: -2, 8: -2, 12: -5 };
  const MEAN = { saturn: 0.033611, jupiter: 0.083056, mars: 0.524167, sun: 0.985556, venus: 0.985556, mercury: 0.985556, moon: 13.176667 };
  const STARS = { regulus: [10.139531, 11.967208], spica: [13.419883, -11.161319] };      // J2000 RA (h), Dec (°)
  const KEY_ROWS = ['S1', 'S2', 'S5'];         // the season, the sign ascending and the Moon's sign: Greenbaum's surest three

  const n360 = x => ((x % 360) + 360) % 360;
  const sgn = lon => Math.floor(n360(lon) / 30);
  const lordOf = i => SEVEN.find(k => (C().DOMICILE[k] || []).includes(C().SIGNS[i].key));
  function aspect(a, b, limit) {
    const d = E().sep(a, b);
    for (const [name, ang] of ASPECTS) { const orb = Math.abs(d - ang); if (orb <= limit) return { name, orb }; }
    return null;
  }
  function starLon([ra, dec], date) {
    const A = window.Astronomy, t = A.MakeTime(date);
    return A.SphereFromVector(A.RotateVector(A.Rotation_EQJ_ECT(t), A.VectorFromSphere(new A.Spherical(dec, ra * 15, 1), t))).lon;
  }

  /* the chart's qualities: who is oriental, which house by Lilly's five degrees, the pair by nature and by place */
  function qualities(st) {
    const B = st.bodies;
    const oriental = k => n360(B[k].lon - B.sun.lon) > 180;              // rises before the Sun (Lilly CA I p. 114)
    const house = lon => { let h = E().houseIn(st.cusps, lon); const nx = h % 12 + 1; if (n360(st.cusps[nx] - lon) < 5) h = nx; return h; };
    const season = QUARTER_Q[Math.floor(n360(B.sun.lon) / 90)];
    const quarter = QUARTER_Q[Math.floor(n360(st.moon.phaseAngle) / 90)];
    const signQ = lon => ELEMENT_Q[C().SIGNS[sgn(lon)].element];
    const nature = k => ({ saturn: 'CD', jupiter: 'HM', mars: 'HD', sun: 'HD', moon: 'CM', venus: 'HM' })[k] || (oriental(k) ? 'HD' : 'CD');
    const place = k => k === 'sun' ? season : k === 'moon' ? quarter : signQ(B[k].lon);
    return { B, oriental, house, season, quarter, signQ, nature, place };
  }

  /* Lilly's Lord of the Geniture: the planet with the most essential and accidental fortitudes, "posited best, and elevated
     most" (CA III ch. CV). Ties: essential dignity, then height, then the Chaldean order [SD]. Within two points, the next
     planet participates. Mutual reception counts as Lilly scores it, 5 by house and 4 by exaltation. */
  function lordOfGeniture(st, Q) {
    Q = Q || qualities(st);
    const { B, oriental, house } = Q, Cr = C();
    const node = E().trueNode(st.date), south = n360(node + 180);
    const reg = starLon(STARS.regulus, st.date), spi = starLon(STARS.spica, st.date), alg = E().algol(st.date, st.loc).lon;
    const recep = {}; for (const k of SEVEN) recep[k] = 0;
    for (let i = 0; i < 7; i++) for (let j = i + 1; j < 7; j++) {
      const a = SEVEN[i], b = SEVEN[j], sa = Cr.SIGNS[B[a].sign].key, sb = Cr.SIGNS[B[b].sign].key;
      const v = (Cr.DOMICILE[b] || []).includes(sa) && (Cr.DOMICILE[a] || []).includes(sb) ? 5 : Cr.EXALTATION[b] === sa && Cr.EXALTATION[a] === sb ? 4 : 0;
      recep[a] += v; recep[b] += v;
    }
    const totals = {}, parts = {};
    for (const k of SEVEN) {
      const b = B[k], p = {};
      p.essential = b.dignity.score + recep[k];        // the engine lifts only the peregrine penalty for a reception
      p.house = HOUSE_PTS[house(b.lon)];
      p.motion = k === 'sun' || k === 'moon' ? 0 : b.retro ? -5 : 4;
      p.speed = !b.retro && Math.abs(b.speed) > MEAN[k] ? 2 : -2;
      p.phase = ['saturn', 'jupiter', 'mars'].includes(k) ? (oriental(k) ? 2 : -2) : ['venus', 'mercury'].includes(k) ? (oriental(k) ? -2 : 2) : k === 'moon' ? (st.moon.waxing ? 2 : -2) : 0;
      p.rays = k === 'sun' ? 0 : b.cazimi ? 5 : b.combust ? -5 : b.beams ? -4 : 5;
      let g = 0;
      for (const o of SEVEN) {
        if (o === k) continue;
        const a = aspect(b.lon, B[o].lon, 1); if (!a) continue;
        if (o === 'jupiter' || o === 'venus') g += { conjunction: 5, trine: 4, sextile: 3 }[a.name] || 0;
        if (o === 'saturn' || o === 'mars') g += { conjunction: -5, opposition: -4, square: -3 }[a.name] || 0;
      }
      if (E().sep(b.lon, node) <= 1) g += 4;
      if (E().sep(b.lon, south) <= 1) g -= 4;
      p.contacts = g;
      p.besieged = k !== 'saturn' && k !== 'mars' && b.sign === B.saturn.sign && b.sign === B.mars.sign && b.lon > Math.min(B.saturn.lon, B.mars.lon) && b.lon < Math.max(B.saturn.lon, B.mars.lon) ? -5 : 0;
      p.stars = (E().sep(b.lon, reg) <= 1 ? 6 : 0) + (E().sep(b.lon, spi) <= 1 ? 5 : 0) + (E().sep(b.lon, alg) <= 5 ? -5 : 0);
      totals[k] = Object.values(p).reduce((s, x) => s + x, 0);
      parts[k] = p;
    }
    const ess = k => parts[k].essential;
    const order = SEVEN.slice().sort((x, y) => totals[y] - totals[x] || ess(y) - ess(x) || B[y].alt - B[x].alt || Cr.CHALDEAN.indexOf(x) - Cr.CHALDEAN.indexOf(y));
    const G = order[0], R = order[1];
    return { planet: G, total: totals[G], participant: totals[G] - totals[R] <= 2 ? R : null, totals, parts, order };
  }

  /* the testimonies of a chart. full: the birth time is known (the Ascendant's rows, the bodies in it, the Lord of the
     Geniture); without it only the season, the Moon, her lord and the planets beholding her */
  function testimonies(st, full, pin) {
    const Q = qualities(st), { B, house, season, quarter, signQ, nature, place } = Q, rows = [];
    const add = (step, pair, w, d) => rows.push(Object.assign({ step, pair, temperament: PAIR[pair], w }, d));
    add('S1', season, W2, { season: Math.floor(n360(B.sun.lon) / 90) });
    let L = null, lord = null;
    if (full) {
      add('S2', signQ(st.asc), W2, { sign: sgn(st.asc) });
      L = lordOf(sgn(st.asc));
      add('S3', nature(L), W1, { planet: L });
      const isDay = st.sect === 'day', pts = {};
      for (const k of SEVEN) pts[k] = E().dignity(k, sgn(st.asc), n360(st.asc) % 30, isDay).labels.reduce((s, l) => s + (POINTS[l] || 0), 0);
      const max = Math.max(...SEVEN.map(k => pts[k])), Wn = SEVEN.filter(k => pts[k] === max);
      for (const k of Wn) add('S4', nature(k), W1 / Wn.length, { planet: k, points: max, shared: Wn.length });
    }
    add('S5', signQ(B.moon.lon), W2, { sign: B.moon.sign });
    add('S6', quarter, W1, { quarter: Math.floor(n360(st.moon.phaseAngle) / 90) });
    const M = lordOf(B.moon.sign);
    add('S7', place(M), W1, { planet: M, sign: B[M].sign });
    if (full) {
      add('S8', place(L), W1, { planet: L, sign: B[L].sign });
      for (const k of SEVEN) if (k !== 'moon' && house(B[k].lon) === 1) add('S9', nature(k), W1, { planet: k, orb: E().sep(B[k].lon, st.asc) });
      const N = E().trueNode(st.date);
      if (house(N) === 1) add('S9', 'HM', W1, { planet: 'northNode' });             // the Dragon's Head as Jupiter (Lilly p. 533)
      if (house(N + 180) === 1) add('S9', 'CD', W1, { planet: 'southNode' });       // the Tail as Saturn and Mars
      if (house(B.moon.lon) === 1) { add('S9', signQ(B.moon.lon), W1, { planet: 'moon', again: 'sign' }); add('S9', quarter, W1, { planet: 'moon', again: 'quarter' }); }
      for (const k of SEVEN) {
        if (house(B[k].lon) === 1) continue;
        const a = aspect(B[k].lon, st.asc, TO_ASC);
        if (a) add('S10', a.name === 'conjunction' ? nature(k) : place(k), WH, { planet: k, aspect: a.name, orb: a.orb });
      }
    }
    for (const k of SEVEN) {
      if (k === 'moon') continue;
      const a = aspect(B[k].lon, B.moon.lon, (ORB[k] + ORB.moon) / 2);
      if (a) add('S11', a.name === 'conjunction' ? nature(k) : place(k), WH, { planet: k, aspect: a.name, orb: a.orb });
    }
    if (full) {
      lord = lordOfGeniture(st, Q);
      if (pin && pin !== lord.planet) lord = Object.assign({}, lord, { planet: pin, total: lord.totals[pin], participant: null, pinned: true });
      add('S12', place(lord.planet), W1, { planet: lord.planet, sign: B[lord.planet].sign });
    }
    // the intemperance: Saturn or Mars in the first house, or by body, square or opposition on the ascending degree or the Moon
    const intemperance = [], HARD = ['conjunction', 'square', 'opposition'];
    for (const k of ['saturn', 'mars']) {
      if (full) {
        if (house(B[k].lon) === 1) { const orb = E().sep(B[k].lon, st.asc); intemperance.push({ planet: k, to: 'ascendant', aspect: 'body', orb, grade: orb <= ORB[k] / 2 ? 'strong' : 'slight' }); }
        else { const a = aspect(B[k].lon, st.asc, TO_ASC); if (a && HARD.includes(a.name)) intemperance.push({ planet: k, to: 'ascendant', aspect: a.name, orb: a.orb, grade: 'strong' }); }
      }
      const a = aspect(B[k].lon, B.moon.lon, (ORB[k] + ORB.moon) / 2);
      if (a && HARD.includes(a.name)) intemperance.push({ planet: k, to: 'moon', aspect: a.name, orb: a.orb, grade: a.orb <= 3 ? 'strong' : 'slight' });
    }
    return { rows, intemperance, lord, lordOfAsc: L };
  }

  /* the judgement: the rows decide (Ribeiro), Lilly's four columns are shown as his check */
  function judge(rows, intemperance) {
    const T = { sanguine: 0, choleric: 0, melancholic: 0, phlegmatic: 0 };
    for (const r of rows) T[r.temperament] += r.w;
    const hot = T.sanguine + T.choleric, cold = T.melancholic + T.phlegmatic, moist = T.sanguine + T.phlegmatic, dry = T.choleric + T.melancholic;
    const heat = hot > cold ? 'H' : cold > hot ? 'C' : '', wet = moist > dry ? 'M' : dry > moist ? 'D' : '';
    const verdict = heat && wet ? PAIR[heat + wet] : heat ? (heat === 'H' ? 'hot' : 'cold') : wet ? (wet === 'M' ? 'moist' : 'dry') : 'even';
    // ties: the qualities the columns decide, then the season, the sign ascending and the Moon's sign, then a fixed order [SD]
    const shared = t => (heat && QUAL[t][0] === heat ? 1 : 0) + (wet && QUAL[t][1] === wet ? 1 : 0);
    const key = t => rows.filter(r => r.temperament === t && KEY_ROWS.includes(r.step)).reduce((s, r) => s + r.w, 0);
    const rank = TEMPS.slice().sort((x, y) => T[y] - T[x] || shared(y) - shared(x) || key(y) - key(x) || TEMPS.indexOf(x) - TEMPS.indexOf(y));
    const D = rank[0], top = rank.filter(t => T[t] === T[D]);
    let kind = 'pure', firsts = [D], seconds = [];
    if (top.length > 2) { kind = 'balanced'; firsts = top; }
    else if (top.length === 2) { kind = 'equal'; firsts = top; }
    else {
      const X = rank[1];
      if (T[X] > 0 && 3 * T[X] >= T[D]) {                                   // a second reaches a third of the first
        seconds = rank.slice(1).filter(t => T[t] === T[X]);
        kind = T[D] - T[X] <= WH ? 'near' : 'mixed';                         // within half a point: almost equal
      }
    }
    const all = firsts.concat(seconds);
    const contraries = all.some(a => all.includes(CONTRARY[a]));
    const columnsThird = TEMPS.includes(verdict) && !all.includes(verdict) ? verdict : null;
    const planets = [...new Set(intemperance.map(c => c.planet))];
    return { T, columns: { hot, cold, moist, dry, verdict }, rank, dominant: D, firsts, seconds, kind, contraries, columnsThird,
      intemperance, intemperate: planets.length ? { planets, grade: intemperance.some(c => c.grade === 'strong') ? 'strong' : 'slight' } : null };
  }
  const signature = j => j.firsts.slice().sort().join('+');      // the day's verdicts differ when the leading temperament, or the set tied first, changes

  /* the local day of a date at a place, as instants */
  function dayBounds(date, loc) {
    const off = d => {
      if (!loc.tz) return loc.lon / 15 * 3600e3;
      const p = {}; for (const x of new Intl.DateTimeFormat('en-GB', { timeZone: loc.tz, year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric', second: 'numeric', hourCycle: 'h23' }).formatToParts(d)) p[x.type] = +x.value;
      return Date.UTC(p.year, p.month - 1, p.day, p.hour, p.minute, p.second) - Math.floor(d.getTime() / 1000) * 1000;
    };
    const local = new Date(date.getTime() + off(date)), y = local.getUTCFullYear(), m = local.getUTCMonth(), d = local.getUTCDate();
    const at = (yy, mm, dd) => { let t = Date.UTC(yy, mm, dd) - off(date); t = Date.UTC(yy, mm, dd) - off(new Date(t)); return t; };
    return [at(y, m, d), at(y, m, d + 1)];
  }

  /* the temperament of a birth chart. opts.noTime: the birth time is unknown; the chart is the day's noon, so only the
     testimonies that need no Ascendant are counted, and the day is searched for the hours where the Moon changes the
     verdict. opts.lordOfGeniture pins the lord (a test of Lilly's merchant). */
  function of(st, opts) {
    opts = opts || {};
    const polar = Math.abs(st.loc.lat) > 90 - st.eps * 180 / Math.PI;    // beyond the polar circles the houses fail: read without the Ascendant [SD]
    const full = !opts.noTime && !polar, t = testimonies(st, full, opts.lordOfGeniture);
    const out = Object.assign(judge(t.rows, t.intemperance), { rows: t.rows, lordOfGeniture: t.lord, lordOfAsc: t.lordOfAsc, partial: !full, polar, day: null });
    if (!opts.noTime) return out;
    try {
      const [t0, t1] = dayBounds(st.date, st.loc), HOUR = 3600e3;
      const at = ms => { const s = E().compute(new Date(ms), st.loc, { light: true, houses: st.houses }); const x = testimonies(s, false); return judge(x.rows, x.intemperance); };
      const runs = []; let prev = null, prevT = t0;
      for (let ms = t0; ms < t1; ms = Math.min(ms + HOUR, t1 - 6e4)) {
        const j = at(ms), sg = signature(j);
        if (!prev) runs.push({ from: t0, j, sg });
        else if (sg !== prev.sg) {
          for (let from = prevT; ;) {                                        // each turn within the hour, to the minute of the local day
            let lo = from, hi = ms;                                          // every probe lies strictly inside, a whole minute on: the search ends
            while (hi - lo > 6e4) { const mid = lo + Math.max(1, Math.floor((hi - lo) / 12e4)) * 6e4; if (signature(at(mid)) === prev.sg) lo = mid; else hi = mid; }
            const jh = hi === ms ? j : at(hi);
            runs.push({ from: hi, j: jh, sg: signature(jh) }); prev = runs[runs.length - 1];
            if (prev.sg === sg) break;
            from = hi;
          }
        }
        prev = runs[runs.length - 1]; prevT = ms;
        if (ms >= t1 - 6e4) break;
      }
      out.day = runs.length > 1 ? runs.map((r, n) => ({ from: new Date(r.from), to: new Date(n + 1 < runs.length ? runs[n + 1].from : t1), judgement: r.j })) : null;
    } catch (e) { out.day = null; }                                          // the day's search is a courtesy
    return out;
  }

  /* ---------- words ---------- */
  const TEXT = {
    en: {
      heading: 'temperament',
      temp: { sanguine: 'sanguine', choleric: 'choleric', melancholic: 'melancholic', phlegmatic: 'phlegmatic' },
      q: { hot: 'hot', cold: 'cold', moist: 'moist', dry: 'dry', even: 'even' },
      season: ['spring', 'summer', 'autumn', 'winter'],
      quarter: ['first quarter', 'second quarter', 'third quarter', 'last quarter'],
      row: { S1: 'Quarter of the year', S2: 'Sign ascending', S3: 'Lord of the Ascendant, by nature', S4: 'Almuten of the Ascendant', S5: 'The Moon’s sign',
        S6: 'The Moon’s quarter', S7: 'Lord of the Moon, by place', S8: 'Lord of the Ascendant, by place', S9: 'In the Ascendant', S10: 'Beholding the Ascendant',
        S11: 'Beholding the Moon', S12: 'Lord of the Geniture, by place' },
      again: { sign: 'the Moon, her sign again', quarter: 'the Moon, her quarter again' },
      north: 'North Node', south: 'South Node', in: 'in', oriental: 'oriental', occidental: 'occidental', shared: n => `shared by ${n}`,
      testimonies: 'Testimonies', weight: 'weight', humour: 'humour', lordIs: 'Lord of the Geniture', lordVal: (p, n) => `${p}, ${n} points of fortitude`,
      tally: 'Tally', columns: (h, c, m, d, v) => `Lilly’s columns: hot ${h}, cold ${c}, moist ${m}, dry ${d}: ${v}`,
      columnsThird: v => `The columns alone would say ${v}, a false result of mixing contraries (Ribeiro); the rows decide.`,
      lord: (p, n) => `Lord of the Geniture: ${p}, ${n} points of fortitude`, participates: (p, n) => `${p} participates (${n})`,
      verdict: {
        pure: f => f[0], mixed: (f, s) => `${f[0]}, inclining to ${list(s)}`, near: (f, s) => s.length > 1 ? `${f[0]}, ${list(s)}, almost equally` : `${f[0]} and ${s[0]}, almost equally`,
        equal: f => `${f[0]} and ${f[1]} in equal measure`, balanced: f => f.length === 4 ? 'the four humours in equal measure' : `${f[0]}, ${f[1]} and ${f[2]} in equal measure`,
        intemperance: (g, p) => `, with ${g === 'strong' ? 'a' : 'some'} ${p} intemperance`, saturn: 'Saturnine', mars: 'Martial', both: 'Saturnine and Martial',
        partial: v => `Partial, without the Ascendant: ${v}` },
      dayRuns: 'Without the birth time the Moon decides, and she changes the verdict during the day:',
      until: t => `until ${t}`, after: t => `from ${t}`,
      relocated: 'Computed at the birthplace, whatever horizon the dial shows.', polar: 'Beyond the polar circle the Ascendant cannot be found, so its testimonies are left out.',
      intro: 'The temperament, or complexion, is the native’s mixture of the four qualities (hot, cold, moist and dry) and of the four humours they make, laid down at birth in body and spirit. It is computed from the significators Ptolemy names (Tetrabiblos III.11) and Lilly lists (Christian Astrology III, ch. CVI), seven of them weighed as in Greenbaum’s reconstruction, and read after Ficino, Agrippa and the Picatrix. The other weights, the limits and the ties are the instrument’s [SD].',
      reading: {
        choleric: 'Choleric: hot and dry, the complexion of fire and of yellow bile, under Mars and, more temperately, the Sun, with Mercury when oriental; it answers to summer and to the Moon’s second quarter. Agrippa gives fire “a fierce, quick and angry disposition” (Occult Philosophy I.7), and from Mars come a truth not to be terrified, constant strength and fortitude, the ardour of courage and the power of acting (III.38). The Picatrix makes the native whose nativity Mars or the Sun rules “a lover of overcoming and defeating” (IV.5). The danger is a heat that consumes: wrath and pride (Agrippa III.39), a drying of the natural moisture (Ficino, De vita II.4), and bile burnt into black bile, which brings frenzy (I.5). Ficino tempers it with moisture.',
        sanguine: 'Sanguine: hot and moist in a temperate degree, the complexion of air and of blood, under Jupiter with Venus; it answers to spring and to the Moon’s first quarter. For Ficino it is the measure of health: good blood is “hot, moist, and clear” (De vita II.5), and “the quality of the spirit is undoubtedly Jovial” (III.11). Agrippa gives air “chearfulness, and an amiable disposition” (Occult Philosophy I.7), and from Jupiter come prudence, temperance and justice (III.38). The Picatrix makes Jupiter lord of the liver, which sets right the complexion and the humours (III.1). The danger is excess: too much blood, shown in immoderate laughter and swollen veins (De vita I.22), or a moisture that dulls the heat and putrefies (II.5). Ficino keeps this complexion with its like (III.11).',
        melancholic: 'Melancholic: cold and dry, the complexion of earth and of black bile, under Saturn, with Mercury when he is occidental (Lilly calls Mercury cold and dry “and therefore Melancholly”); it answers to autumn and to the Moon’s third quarter. It is the complexion of the learned, which Saturn and Mercury impart from birth (Ficino, De vita I.4). From Saturn, Agrippa says, come sublime contemplation, solidity of judgement and an immoveable resolution (Occult Philosophy III.38). Ficino’s Saturn signifies “an individual set apart from others, divine or brutish” (De vita III.2). Natural black bile, rarefied and kindled by blood and yellow bile, lets the mind find, judge and retain (I.5, I.6). In excess, or burnt, it brings fear, sadness and stupor (I.3, I.5). Ficino’s rule is “let it shine, but not burn” (I.5).',
        phlegmatic: 'Phlegmatic: cold and moist, the complexion of water and of phlegm, under the Moon; it answers to winter and to the Moon’s last quarter. From the Moon, Agrippa says, come “a peace making consonancy, fecundity”, growth and a moderate temperance (Occult Philosophy III.38), and the Lunar native is kind, gentle and sociable (I.52). The Picatrix gives the Moon good manners with people and grace in every action (III.7). But in Agrippa water also signifies fearfulness and slowness in working (I.7), and Ficino names the danger: “Phlegm dulls and suffocates the intelligence” (De vita I.3). It weighs on the head and thickens the spirit (I.25, III.11). Ficino’s remedy is warmth and light.'
      },
      regimen: 'Ficino’s regimen',
      reg: { call: 'planets to call on', colours: 'colours', music: 'music', odours: 'odours', places: 'places', stones: 'stones' },
      regimens: {
        choleric: { call: 'Venus, who keeps the studious from drying out, and Jupiter (III.5, III.6)', colours: 'the watery whites and greens of violets, roses and lilies (III.11)', music: 'Jupiter’s: deep, earnest and sweet (III.21)', odours: 'rose, violet, myrtle, camphor and sandal (I.10)', places: 'away from hot, dry air (II.4)', stones: 'carnelian and coral (III.2, I.17)' },
        sanguine: { call: 'Jupiter; the complexion is kept with its like (III.11)', colours: 'sapphire, rich purples, gold with silver, and greens (III.11)', music: 'deep, earnest, sweet and joyful (III.21)', odours: 'the golden peach and the orange (III.11)', places: 'lofty, clear, temperate regions (III.11)', stones: 'jacinth, topaz and sapphire (III.1)' },
        melancholic: { call: 'Jupiter, with the Sun and Venus, the three Graces (III.5, III.6)', colours: 'green, gold and sapphire-blue (III.19)', music: 'the lyre and song (I.10)', odours: 'tempered ones, with light, clear, fragrant wine (I.10)', places: 'shining water, gardens, groves and walks along rivers (I.10)', stones: 'jacinth and lapis lazuli (I.10, III.19)' },
        phlegmatic: { call: 'the Sun; when phlegm threatens, the Moon’s relation to the Sun is looked to (III.6)', colours: 'gold and blazing yellows (III.1, III.11)', music: 'the Sun’s: reverent, simple and earnest (III.21)', odours: 'cinnamon, cloves, saffron, aloe-wood, amber and musk (I.10)', places: 'a high dwelling far from heavy, cloudy air, dried by fire (I.9)', stones: 'chrysolite and carbuncle (III.1)' }
      },
      mixed: 'No native is of one humour alone. The leading humour gives the ground of the complexion; another bends it when the two are neighbours, as Garcaeus’s sanguine prince leans to choleric dryness (Astrologiae methodus, 1576, p. 51), and tempers it when they are contraries. The reading of the leading humour stands, and the other’s virtues and remedies are taken in measure; humours in equal measure are read together. Of a planet nearly as strong as the Lord of the Geniture, Lilly says “a kind of mixture must be framed” (Christian Astrology III, ch. CV); the humours mix in the same way.', mixedIs: 'How the humours mix',
      melancholyMix: 'Ficino’s best temper of the learned is black bile mixed with blood and with yellow bile, eight parts of blood to two of each bile, so that black bile is kindled and may “shine, but not burn” (De vita I.5). The danger is adustion: any humour burnt by too much heat turns to black bile, which brings frenzy and then stupor. Mixed only with phlegm, black bile brings torpor and fear (I.5).',
      intemperanceIs: 'Intemperance', grade: { strong: 'strong', slight: 'slight' },
      contact: { body: (p, o) => `${p} in the Ascendant, ${o} from its degree`, ascendant: (p, a, o, k) => k === 'conjunction' ? `${p} conjunct the ascending degree, ${o}` : `${p} in ${a} to the ascending degree, ${o}`, moon: (p, a, o, k) => k === 'conjunction' ? `${p} conjunct the Moon, ${o}` : `${p} in ${a} to the Moon, ${o}` },
      intemperanceNote: 'Saturn or Mars in the Ascendant (Garcaeus), or beholding the Ascendant or the Moon with a malevolent aspect: “they intermix their intemperate qualities to the temperature of the body, yea, though all other testimonies concur very well” (Lilly, Christian Astrology p. 533). Saturn adds cold and dryness, Mars heat and dryness. Ficino turns to Jupiter against black bile and to Venus against bile and drying-out (De vita III.6); Jupiter defends from Saturn (III.22), and “the nature of Venus dissolves what is closed up by Mars, and repairs what he damages” (Picatrix III.7).'
    },
    es: {
      heading: 'temperamento',
      temp: { sanguine: 'sanguíneo', choleric: 'colérico', melancholic: 'melancólico', phlegmatic: 'flemático' },
      q: { hot: 'caliente', cold: 'frío', moist: 'húmedo', dry: 'seco', even: 'igualadas' },
      season: ['primavera', 'verano', 'otoño', 'invierno'],
      quarter: ['primer cuarto', 'segundo cuarto', 'tercer cuarto', 'último cuarto'],
      row: { S1: 'Estación del año', S2: 'Signo ascendente', S3: 'Señor del Ascendente, por naturaleza', S4: 'Almutén del Ascendente', S5: 'Signo de la Luna',
        S6: 'Cuarto de la Luna', S7: 'Señor de la Luna, por su lugar', S8: 'Señor del Ascendente, por su lugar', S9: 'En el Ascendente', S10: 'Mira al Ascendente',
        S11: 'Mira a la Luna', S12: 'Señor de la Genitura, por su lugar' },
      again: { sign: 'la Luna, su signo otra vez', quarter: 'la Luna, su cuarto otra vez' },
      north: 'Nodo Norte', south: 'Nodo Sur', in: 'en', oriental: 'oriental', occidental: 'occidental', shared: n => `compartido entre ${n}`,
      testimonies: 'Testimonios', weight: 'peso', humour: 'humor', lordIs: 'Señor de la Genitura', lordVal: (p, n) => `${p}, ${n} puntos de fortaleza`,
      tally: 'Cuenta', columns: (h, c, m, d, v) => `Columnas de Lilly: caliente ${h}, frío ${c}, húmedo ${m}, seco ${d}: ${v}`,
      columnsThird: v => `Las columnas solas dirían ${v}, un resultado falso de la mezcla de contrarios (Ribeiro); deciden las filas.`,
      lord: (p, n) => `Señor de la Genitura: ${p}, ${n} puntos de fortaleza`, participates: (p, n) => `participa ${p} (${n})`,
      verdict: {
        pure: f => f[0], mixed: (f, s) => `${f[0]}, que declina a ${list(s)}`, near: (f, s) => s.length > 1 ? `${f[0]}, ${list(s)}, casi por igual` : `${f[0]} y ${s[0]}, casi por igual`,
        equal: f => `${f[0]} y ${f[1]} por igual`, balanced: f => f.length === 4 ? 'los cuatro humores por igual' : `${f[0]}, ${f[1]} y ${f[2]} por igual`,
        intemperance: (g, p) => `, con ${g === 'strong' ? 'una' : 'alguna'} destemplanza ${p}`, saturn: 'saturnina', mars: 'marcial', both: 'saturnina y marcial',
        partial: v => `Parcial, sin el Ascendente: ${v}` },
      dayRuns: 'Sin la hora de nacimiento decide la Luna, y cambia el veredicto durante el día:',
      until: t => `hasta las ${t}`, after: t => `desde las ${t}`,
      relocated: 'Calculado en el lugar de nacimiento, sea cual sea el horizonte de la esfera.', polar: 'Más allá del círculo polar no se puede hallar el Ascendente, así que sus testimonios quedan fuera.',
      intro: 'El temperamento, o complexión, es la mezcla que el nativo recibe al nacer, en el cuerpo y en el espíritu, de las cuatro cualidades (calor, frío, humedad y sequedad) y de los cuatro humores que forman. Se calcula con los significadores que nombra Ptolomeo (Tetrabiblos III.11) y enumera Lilly (Christian Astrology III, cap. CVI), siete de ellos con los pesos de la reconstrucción de Greenbaum, y se lee según Ficino, Agripa y el Picatrix. Los demás pesos, los límites y los desempates son del instrumento [SD].',
      reading: {
        choleric: 'Colérico: caliente y seco, la complexión del fuego y de la bilis amarilla, bajo Marte y, más templado, el Sol, con Mercurio cuando es oriental; responde al verano y al segundo cuarto de la Luna. Agripa da al fuego «una disposición feroz, pronta e iracunda» (Filosofía oculta I.7), y de Marte vienen una verdad que no se espanta, el vigor y la fortaleza constantes, el ardor del ánimo y el poder de obrar (III.38). El Picatrix hace al nativo cuya natividad rigen Marte o el Sol «amante de superar y de vencer» (IV.5). El peligro es un calor que consume: la ira y la soberbia (Agripa III.39), la desecación de la humedad natural (Ficino, De vita II.4) y la bilis quemada hasta volverse bilis negra, que trae el frenesí (I.5). Ficino lo templa con humedad.',
        sanguine: 'Sanguíneo: caliente y húmedo en grado templado, la complexión del aire y de la sangre, bajo Júpiter con Venus; responde a la primavera y al primer cuarto de la Luna. Para Ficino es la medida de la salud: la sangre buena es «caliente, húmeda y clara» (De vita II.5), y «la cualidad del espíritu es sin duda jovial» (III.11). Agripa da al aire «alegría y una disposición amable» (Filosofía oculta I.7), y de Júpiter vienen la prudencia, la templanza y la justicia (III.38). El Picatrix hace a Júpiter señor del hígado, que endereza la complexión y los humores (III.1). El peligro es el exceso: demasiada sangre, que se ve en la risa desmedida y las venas hinchadas (De vita I.22), o una humedad que embota el calor y se corrompe (II.5). Ficino conserva esta complexión con sus semejantes (III.11).',
        melancholic: 'Melancólico: frío y seco, la complexión de la tierra y de la bilis negra, bajo Saturno, con Mercurio cuando es occidental (Lilly lo llama frío y seco «y por tanto melancólico»); responde al otoño y al tercer cuarto de la Luna. Es la complexión de los doctos, que Saturno y Mercurio infunden desde el nacimiento (Ficino, De vita I.4). De Saturno, dice Agripa, vienen la contemplación sublime, la solidez del juicio y un propósito inmóvil (Filosofía oculta III.38). El Saturno de Ficino significa «un individuo apartado de los demás, divino o bruto» (De vita III.2). La bilis negra natural, enrarecida y encendida por la sangre y la bilis amarilla, hace que la mente halle, juzgue y retenga (I.5, I.6). En exceso, o quemada, trae miedo, tristeza y estupor (I.3, I.5). La regla de Ficino es que «resplandezca, pero no arda» (I.5).',
        phlegmatic: 'Flemático: frío y húmedo, la complexión del agua y de la flema, bajo la Luna; responde al invierno y al último cuarto de la Luna. De la Luna, dice Agripa, vienen «una consonancia pacífica, la fecundidad», el crecimiento y una templanza moderada (Filosofía oculta III.38), y el nativo lunar es benigno, apacible y sociable (I.52). El Picatrix da a la Luna los buenos modales con la gente y la gracia en toda acción (III.7). Pero en Agripa el agua significa también temor y lentitud en el obrar (I.7), y Ficino nombra el peligro: «la flema a menudo embota y sofoca el ingenio» (De vita I.3). Pesa sobre la cabeza y espesa el espíritu (I.25, III.11). El remedio de Ficino es el calor y la luz.'
      },
      regimen: 'El régimen de Ficino',
      reg: { call: 'planetas que invocar', colours: 'colores', music: 'música', odours: 'olores', places: 'lugares', stones: 'piedras' },
      regimens: {
        choleric: { call: 'Venus, que guarda de la desecación a los estudiosos, y Júpiter (III.5, III.6)', colours: 'los blancos y verdes acuosos de violetas, rosas y lirios (III.11)', music: 'la de Júpiter: grave, seria y dulce (III.21)', odours: 'rosa, violeta, mirto, alcanfor y sándalo (I.10)', places: 'lejos del aire caliente y seco (II.4)', stones: 'la cornalina y el coral (III.2, I.17)' },
        sanguine: { call: 'Júpiter; la complexión se conserva con sus semejantes (III.11)', colours: 'el zafiro, los tonos púrpura más intensos, el oro con plata y los verdes (III.11)', music: 'grave, seria, dulce y alegre (III.21)', odours: 'el melocotón dorado y la naranja (III.11)', places: 'las regiones altas, claras y templadas (III.11)', stones: 'el jacinto, el topacio y el zafiro (III.1)' },
        melancholic: { call: 'Júpiter, con el Sol y Venus, las tres Gracias (III.5, III.6)', colours: 'el verde, el oro y el azul de zafiro (III.19)', music: 'la lira y el canto (I.10)', odours: 'los templados, con vino ligero, claro y fragante (I.10)', places: 'el agua resplandeciente, los jardines, las arboledas y los paseos junto a los ríos (I.10)', stones: 'el jacinto y el lapislázuli (I.10, III.19)' },
        phlegmatic: { call: 'el Sol; cuando amenaza la flema, se mira la relación de la Luna con el Sol (III.6)', colours: 'el oro y los amarillos encendidos (III.1, III.11)', music: 'la del Sol: reverente, sencilla y seria (III.21)', odours: 'canela, clavo, azafrán, palo de áloe, ámbar y almizcle (I.10)', places: 'una morada alta, lejos del aire pesado y nublado, secada con fuego (I.9)', stones: 'el crisólito y el carbunclo (III.1)' }
      },
      mixed: 'Ningún nativo es de un solo humor. El humor que predomina da el fondo de la complexión; otro la inclina cuando son vecinos, como el príncipe sanguíneo de Garcaeus declina a la sequedad colérica (Astrologiae methodus, 1576, p. 51), y la templa cuando son contrarios. La lectura del que predomina se mantiene, y las virtudes y los remedios del otro se toman con medida; los humores que están por igual se leen juntos. De un planeta casi tan fuerte como el Señor de la Genitura dice Lilly que «ha de formarse una suerte de mezcla» (Christian Astrology III, cap. CV); los humores se mezclan del mismo modo.', mixedIs: 'Cómo se mezclan los humores',
      melancholyMix: 'El mejor temple de los doctos, para Ficino, es la bilis negra mezclada con la sangre y con la bilis amarilla, ocho partes de sangre por dos de cada bilis, para que la bilis negra se encienda y «resplandezca, pero no arda» (De vita I.5). El peligro es la adustión: cualquier humor quemado por un calor excesivo se vuelve bilis negra, que trae el frenesí y después el estupor. Mezclada solo con la flema, la bilis negra trae entorpecimiento y miedo (I.5).',
      intemperanceIs: 'Destemplanza', grade: { strong: 'fuerte', slight: 'leve' },
      contact: { body: (p, o) => `${p} en el Ascendente, a ${o} de su grado`, ascendant: (p, a, o, k) => k === 'conjunction' ? `${p} en conjunción con el grado ascendente, ${o}` : `${p} en ${a} al grado ascendente, ${o}`, moon: (p, a, o, k) => k === 'conjunction' ? `${p} en conjunción con la Luna, ${o}` : `${p} en ${a} a la Luna, ${o}` },
      intemperanceNote: 'Saturno o Marte en el Ascendente (Garcaeus), o mirando al Ascendente o a la Luna con un aspecto maléfico: «mezclan sus cualidades destempladas en la complexión del cuerpo, aunque todos los demás testimonios concuerden muy bien» (Lilly, Christian Astrology p. 533). Saturno añade frío y sequedad; Marte, calor y sequedad. Ficino acude a Júpiter contra la bilis negra y a Venus contra la bilis y la desecación (De vita III.6); Júpiter defiende de Saturno (III.22), y «la naturaleza de Venus disuelve lo que Marte cierra y repara lo que él daña» (Picatrix III.7).'
    }
  };
  const lang = () => (I() && I().locale && (I().locale() || 'en').startsWith('es')) ? 'es' : 'en';
  const T = () => TEXT[lang()];
  const list = s => s.length > 1 ? `${s.slice(0, -1).join(', ')} ${lang() === 'es' ? 'y' : 'and'} ${s[s.length - 1]}` : s[0];

  /* the verdict in words: "melancholic, inclining to sanguine, with a Saturnine intemperance" */
  function line(j, partial) {
    const t = T(), nm = x => t.temp[x], V = t.verdict;
    let s = V[j.kind](j.firsts.map(nm), j.seconds.map(nm));
    if (j.intemperate) { const p = j.intemperate.planets; s += V.intemperance(j.intemperate.grade, p.length > 1 ? V.both : V[p[0]]); }
    return partial ? V.partial(s) : s;
  }

  SD.temperament = { of, line, lordOfGeniture, testimonies, judge, text: T, TEXT, PAIR, QUAL, TEMPS, SEVEN, ORB, TO_ASC };
})();
