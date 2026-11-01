/* The tikkun: the life mission, read from the lunar nodes, after the owner's method
   (DESIGN.md, "The tikkun"). Mainstream karmic nodal astrology, as the Kabbalah Centre also teaches it: the South Node
   is the karma the soul brings in, the North Node the mission, the correction. The Kabbalistic layer is the Sefer
   Yetzirah's sign → letter; the tarot is the Golden Dawn's letter → card. A symbolic reading, not a prediction.
   The node is the true (osculating) node, always, as in the owner's own readings. */
(function () {
  const SD = window.SD = window.SD || {};
  const C = () => SD.corr, E = () => SD.engine, I = () => SD.i18n;

  // Table 1: sign → letter, card (Major Arcana number), Psalm 119 stanza
  const SIGN = [
    ['heh', 4, '33–40'], ['vav', 5, '41–48'], ['zayin', 6, '49–56'], ['cheth', 7, '57–64'], ['teth', 8, '65–72'], ['yod', 9, '73–80'],
    ['lamed', 11, '89–96'], ['nun', 13, '105–112'], ['samekh', 14, '113–120'], ['ayin', 15, '121–128'], ['tzaddi', 17, '137–144'], ['qoph', 18, '145–152']
  ];
  // Table 2: planet → sefirah, own letter, own card; the outer planets by the modern attribution, with no path
  const PLANET = {
    saturn: ['binah', 'tav', 21], jupiter: ['chesed', 'kaph', 10], mars: ['gevurah', 'peh', 16], sun: ['tiferet', 'resh', 19],
    venus: ['netzach', 'daleth', 3], mercury: ['hod', 'beth', 1], moon: ['yesod', 'gimel', 2], ascendant: ['malkhut', null, null],
    uranus: [null, 'aleph', 0], neptune: [null, 'mem', 12], pluto: [null, 'shin', 20]
  };
  // Table 3: the paths of the Golden Dawn Tree between two planets' sefirot
  const PATH = {
    'saturn|mars': ['cheth', 7], 'saturn|sun': ['zayin', 6], 'jupiter|mars': ['teth', 8], 'jupiter|sun': ['yod', 9], 'jupiter|venus': ['kaph', 10],
    'mars|sun': ['lamed', 11], 'mars|mercury': ['mem', 12], 'sun|venus': ['nun', 13], 'sun|moon': ['samekh', 14], 'sun|mercury': ['ayin', 15],
    'venus|mercury': ['peh', 16], 'venus|moon': ['tzaddi', 17], 'venus|ascendant': ['qoph', 18], 'mercury|moon': ['resh', 19],
    'mercury|ascendant': ['shin', 20], 'moon|ascendant': ['tav', 21]
  };
  const RULER = ['mars', 'venus', 'mercury', 'moon', 'sun', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'saturn', 'jupiter'];
  const SEVEN = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn'];
  const MAJOR_ASPECTS = [['conjunction', 0], ['sextile', 60], ['square', 90], ['trine', 120], ['opposition', 180]];

  const signOf = lon => Math.floor((((lon % 360) + 360) % 360) / 30);
  const pathOf = (a, b) => PATH[a + '|' + b] || PATH[b + '|' + a] || null;
  /* the card of an aspect: the path between the two sefirot if there is one; else the two planets' own cards */
  function aspectCard(a, b) {
    const p = pathOf(a, b);
    if (p) return { path: true, letter: p[0], card: p[1] };
    const ca = PLANET[a] && PLANET[a][2], cb = PLANET[b] && PLANET[b][2];
    return { path: false, cards: [ca, cb].filter(x => x !== null && x !== undefined) };
  }
  const quality = asp => asp === 'conjunction' ? 'fusion' : asp === 'trine' || asp === 'sextile' ? 'gift' : 'lesson';

  /* the whole reading. st: a computed chart; opts.noTime: no birth time, so no houses, Ascendant or Midheaven */
  function of(st, opts = {}) {
    const noTime = !!opts.noTime, B = st.bodies;
    const nn = E().trueNode(st.date), sn = E().norm360(nn + 180);
    const house = lon => noTime ? null : E().houseIn(st.cusps, lon);
    const node = lon => { const s = signOf(lon); return { lon, sign: s, deg: lon - s * 30, house: house(lon), letter: SIGN[s][0], card: SIGN[s][1], psalm: SIGN[s][2] }; };
    const north = node(nn), south = node(sn);
    const rk = RULER[north.sign], rs = B[rk].sign;
    const engine = { planet: rk, sign: rs, letter: SIGN[rs][0], card: SIGN[rs][1], psalm: SIGN[rs][2], house: noTime ? null : B[rk].house, doubled: SIGN[rs][1] === north.card };
    const conj = [];
    for (const [which, n] of [['north', north], ['south', south]]) for (const k of SEVEN) {
      const orb = E().sep(B[k].lon, n.lon); if (orb <= 5) conj.push({ node: which, planet: k, orb, card: PLANET[k][2], letter: PLANET[k][1] });
    }
    const threshold = [];
    for (const [which, n] of [['north', north]]) {           // the mission's threshold: the two nodes always share the degree
      if (n.deg >= 29) { const s = (n.sign + 1) % 12; threshold.push({ node: which, sign: s, card: SIGN[s][1], letter: SIGN[s][0] }); }
      else if (n.deg < 1) { const s = (n.sign + 11) % 12; threshold.push({ node: which, sign: s, card: SIGN[s][1], letter: SIGN[s][0] }); }
    }
    // the signs on the road: the sign card of the Ascendant, the Midheaven and the seven; repeats first, with their count
    const places = (noTime ? [] : [['ascendant', st.asc], ['midheaven', st.mc]]).concat(SEVEN.map(k => [k, B[k].lon]));
    const byCard = new Map();
    for (const [k, lon] of places) { const s = signOf(lon), c = SIGN[s][1]; if (!byCard.has(c)) byCard.set(c, { card: c, sign: s, keys: [] }); byCard.get(c).keys.push(k); }
    if (!noTime) { const c = north.card; if (byCard.has(c)) byCard.get(c).keys.push('northNode'); }
    const placements = [...byCard.values()].map(x => ({ ...x, count: x.keys.length, tikkun: x.card === north.card || x.card === engine.card }))
      .sort((x, y) => y.count - x.count || (y.tikkun - x.tikkun));
    // the aspect cards: up to five major aspects, orb 5°, 8° with a luminary; out of sign marked weak
    const pts = Object.keys(B).map(k => [k, B[k].lon]).concat(noTime ? [] : [['ascendant', st.asc]]);
    const asp = [];
    for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
      const [a, la] = pts[i], [b, lb] = pts[j], d = E().sep(la, lb), lum = /^(sun|moon)$/.test(a) || /^(sun|moon)$/.test(b), max = lum ? 8 : 5;
      if ((a === 'ascendant' || b === 'ascendant') && !pathOf(a, b)) continue;   // the Ascendant has no card of its own: only its paths count
      for (const [name, ang] of MAJOR_ASPECTS) {
        const orb = Math.abs(d - ang); if (orb > max) continue;
        const sd = Math.min((signOf(lb) - signOf(la) + 12) % 12, (signOf(la) - signOf(lb) + 12) % 12);
        asp.push({ a, b, aspect: name, orb, weak: sd !== ang / 30, quality: quality(name), ...aspectCard(a, b) });
      }
    }
    asp.sort((x, y) => (x.orb / (/^(sun|moon)$/.test(x.a) || /^(sun|moon)$/.test(x.b) ? 8 : 5)) - (y.orb / (/^(sun|moon)$/.test(y.a) || /^(sun|moon)$/.test(y.b) ? 8 : 5)));
    return { node: 'true', noTime, north, south, engine, conj, threshold, placements, aspects: asp.slice(0, 5) };
  }

  /* ---------- words ---------- */
  const TEXT = {
    en: {
      letter: { heh: 'window', vav: 'nail', zayin: 'sword', cheth: 'fence', teth: 'serpent', yod: 'hand', lamed: 'ox-goad', nun: 'fish', samekh: 'prop', ayin: 'eye', tzaddi: 'fishhook', qoph: 'back of the head',
        tav: 'seal', kaph: 'palm', peh: 'mouth', resh: 'head', daleth: 'door', beth: 'house', gimel: 'camel', aleph: 'ox', mem: 'water', shin: 'tooth' },
      name: { heh: 'Heh', vav: 'Vav', zayin: 'Zayin', cheth: 'Cheth', teth: 'Teth', yod: 'Yod', lamed: 'Lamed', nun: 'Nun', samekh: 'Samekh', ayin: 'Ayin', tzaddi: 'Tzaddi', qoph: 'Qoph',
        tav: 'Tav', kaph: 'Kaph', peh: 'Peh', resh: 'Resh', daleth: 'Daleth', beth: 'Beth', gimel: 'Gimel', aleph: 'Aleph', mem: 'Mem', shin: 'Shin' },
      // the mission by the North Node's sign: a few words for the dial, a sentence for the reading (the South Node is the opposite sign)
      short: ['to act first, alone', 'to build steady worth', 'to ask, listen, connect', 'to belong and to nurture', 'to create and be seen', 'to serve with precision',
        'to partner and to balance', 'to transform through depth', 'to seek meaning and teach', 'to build authority', 'to serve the many', 'to surrender and trust'],
      long: [
        'From pleasing and weighing others to initiative: choose, begin, and stand behind it without waiting for agreement.',
        'From crisis, intensity and other people’s power to quiet self-worth: build slowly, keep what you make, trust the body.',
        'From preaching one truth to curiosity: ask before answering, learn the detail, carry the message between people.',
        'From status and control to belonging: let feeling lead, make a home, care for others and let them care for you.',
        'From the detached crowd to the heart: create in your own name, take the stage, love openly and personally.',
        'From drifting and dissolving to useful order: daily practice, craft, health, and help that can be measured.',
        'From going it alone to partnership: weigh the other, cooperate, make fairness and beauty the measure.',
        'From holding on and comfort to depth: share what you own, let go, be changed by intimacy.',
        'From scattered facts and talk to meaning: commit to a belief, travel far, teach what you have lived.',
        'From the shelter of family and mood to authority: take responsibility in the world, build what outlasts you.',
        'From personal glory to the group: work for a cause larger than yourself, as the friend and the innovator rather than the star.',
        'From control, criticism and the list to faith: trust the larger order, serve through compassion, let the work be inspired.'
      ],
      label: 'Life mission (tikkun)', karma: 'Karma', mission: 'Mission', engine: 'Engine', conj: 'Conjunct', threshold: 'Threshold', doubled: 'the mission doubled',
      livedIn: 'Lived in the', north: 'North Node', south: 'South Node', mean: 'true node', road: 'Signs on the road', aspects: 'Aspect cards',
      gift: 'gift', lesson: 'lesson', fusion: 'fusion', weak: 'out of sign, weak', psalm: 'Psalm 119', noTime: 'no birth time: houses, Ascendant and Midheaven left out',
      symbolic: 'A symbolic reading, not a prediction. South Node, the karma the soul brings in; North Node, the mission. Sign → Hebrew letter after the Sefer Yetzirah, letter → card after the Golden Dawn.'
    },
    es: {
      letter: { heh: 'ventana', vav: 'clavo', zayin: 'espada', cheth: 'cerca', teth: 'serpiente', yod: 'mano', lamed: 'aguijada', nun: 'pez', samekh: 'sostén', ayin: 'ojo', tzaddi: 'anzuelo', qoph: 'nuca',
        tav: 'sello', kaph: 'palma', peh: 'boca', resh: 'cabeza', daleth: 'puerta', beth: 'casa', gimel: 'camello', aleph: 'buey', mem: 'agua', shin: 'diente' },
      name: { heh: 'Hei', vav: 'Vav', zayin: 'Zayin', cheth: 'Jet', teth: 'Tet', yod: 'Yod', lamed: 'Lamed', nun: 'Nun', samekh: 'Samej', ayin: 'Ayin', tzaddi: 'Tsadi', qoph: 'Kof',
        tav: 'Tav', kaph: 'Kaf', peh: 'Pe', resh: 'Resh', daleth: 'Dalet', beth: 'Bet', gimel: 'Guimel', aleph: 'Alef', mem: 'Mem', shin: 'Shin' },
      short: ['actuar primero, solo', 'construir valor estable', 'preguntar, escuchar, unir', 'pertenecer y cuidar', 'crear y ser visto', 'servir con precisión',
        'asociarse y equilibrar', 'transformarse en lo hondo', 'buscar sentido y enseñar', 'construir autoridad', 'servir a muchos', 'entregarse y confiar'],
      long: [
        'De complacer y sopesar a los demás a la iniciativa: elegir, empezar y sostenerlo sin esperar acuerdo.',
        'De la crisis, la intensidad y el poder ajeno a la valía tranquila: construir despacio, conservar lo que se hace, confiar en el cuerpo.',
        'De predicar una verdad a la curiosidad: preguntar antes de responder, aprender el detalle, llevar el mensaje entre personas.',
        'Del estatus y el control a la pertenencia: dejar que guíe el sentimiento, hacer un hogar, cuidar y dejarse cuidar.',
        'De la multitud distante al corazón: crear en nombre propio, salir a escena, amar abierta y personalmente.',
        'De la deriva y la disolución al orden útil: práctica diaria, oficio, salud y una ayuda que se pueda medir.',
        'De ir por libre a la asociación: sopesar al otro, cooperar, hacer de la justicia y la belleza la medida.',
        'Del aferrarse y la comodidad a la hondura: compartir lo que se tiene, soltar, dejarse cambiar por la intimidad.',
        'De los datos dispersos y la charla al sentido: comprometerse con una creencia, viajar lejos, enseñar lo vivido.',
        'Del refugio de la familia y el ánimo a la autoridad: asumir responsabilidad en el mundo, construir lo que dure más que uno.',
        'De la gloria personal al grupo: trabajar por una causa mayor, como amigo e innovador antes que como estrella.',
        'Del control, la crítica y la lista a la fe: confiar en el orden mayor, servir con compasión, dejar que la obra sea inspirada.'
      ],
      label: 'Misión de vida (tikún)', karma: 'Karma', mission: 'Misión', engine: 'Motor', conj: 'Conjunción', threshold: 'Umbral', doubled: 'la misión duplicada',
      livedIn: 'Vivida en el', north: 'Nodo Norte', south: 'Nodo Sur', mean: 'nodo verdadero', road: 'Señales del camino', aspects: 'Cartas de los aspectos',
      gift: 'don', lesson: 'lección', fusion: 'fusión', weak: 'fuera de signo, débil', psalm: 'Salmo 119', noTime: 'sin hora de nacimiento: sin casas, Ascendente ni Medio Cielo',
      symbolic: 'Una lectura simbólica, no una predicción. Nodo Sur, el karma que trae el alma; Nodo Norte, la misión. Signo → letra hebrea según el Séfer Yetzirá, letra → carta según la Aurora Dorada.'
    }
  };
  const T = () => TEXT[(I().locale() || 'en').startsWith('es') ? 'es' : 'en'];
  const SIGN_CARD = [4, 5, 6, 7, 8, 9, 11, 13, 14, 15, 17, 18], PLANET_CARD = { 21: 'saturn', 10: 'jupiter', 16: 'mars', 19: 'sun', 3: 'venus', 1: 'mercury', 2: 'moon' };
  /* a Major Arcana card's name in the interface language, as the rest of the app names it */
  function major(n) {
    const s = SIGN_CARD.indexOf(n); if (s >= 0) return I().trumpSign(s);
    if (PLANET_CARD[n]) return I().trumpPlanet(PLANET_CARD[n]);
    return I().t('ui.tarot.' + ({ 0: 'fool', 12: 'hanged', 20: 'judgement' })[n]);
  }
  const letter = k => `${T().name[k]} (${T().letter[k]})`;
  const cardOf = x => x.path ? major(x.card) : x.cards.map(major).join(' + ');

  SD.tikkun = { of, aspectCard, major, letter, cardOf, text: T, SIGN, PLANET, PATH };
})();
