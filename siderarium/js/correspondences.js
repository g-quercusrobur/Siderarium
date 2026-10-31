/*  siderarium — correspondences
    Renaissance core, two declared modern windows.
      core     astrology     Lilly (1647): dignities, terms (Egyptian), faces (Chaldean), solar phase
               kabbalah      Agrippa III (1533): the seven planets on the seven lower Sephiroth, Kircher's Tree (1652)
               number        Sephirah = order of the planet's magic square (Agrippa II.22)
               planet colour heraldic tinctures by planet (Ferne 1586); agrees with the GD Queen scale
               timing        planetary hours and angels (Heptameron); 28 lunar mansions (Agrippa II.33)
               outer planets no place on the Tree, no number, no dignity: optics in the sky only
      window 1 sign colour   GD King scale of the paths (1880s) = Itten's 12-step circle; sound by Case's scale
      window 2 tarot         decans as Chaldean faces with their minor cards and Book T titles (GD); trumps on signs and planets
      letters  Golden Dawn order. No Crowley swaps.
*/
(function (SD) {
  'use strict';

  const SIGNS = [
    { key: 'aries',       name: 'aries',       element: 'fire',  mode: 'cardinal', letter: 'heh',    value: 5,   color: '#e0262c' }, // scarlet
    { key: 'taurus',      name: 'taurus',      element: 'earth', mode: 'fixed',    letter: 'vav',    value: 6,   color: '#e8571c' }, // red-orange
    { key: 'gemini',      name: 'gemini',      element: 'air',   mode: 'mutable',  letter: 'zayin',  value: 7,   color: '#f0891b' }, // orange
    { key: 'cancer',      name: 'cancer',      element: 'water', mode: 'cardinal', letter: 'cheth',  value: 8,   color: '#f4b223' }, // amber
    { key: 'leo',         name: 'leo',         element: 'fire',  mode: 'fixed',    letter: 'teth',   value: 9,   color: '#ece03a' }, // greenish yellow
    { key: 'virgo',       name: 'virgo',       element: 'earth', mode: 'mutable',  letter: 'yod',    value: 10,  color: '#a6cc31' }, // yellow-green
    { key: 'libra',       name: 'libra',       element: 'air',   mode: 'cardinal', letter: 'lamed',  value: 30,  color: '#23a65a' }, // emerald
    { key: 'scorpio',     name: 'scorpio',     element: 'water', mode: 'fixed',    letter: 'nun',    value: 50,  color: '#13938e' }, // green-blue
    { key: 'sagittarius', name: 'sagittarius', element: 'fire',  mode: 'mutable',  letter: 'samekh', value: 60,  color: '#2262d2' }, // blue
    { key: 'capricorn',   name: 'capricorn',   element: 'earth', mode: 'cardinal', letter: 'ayin',   value: 70,  color: '#3b33a6' }, // indigo
    { key: 'aquarius',    name: 'aquarius',    element: 'air',   mode: 'fixed',    letter: 'tzaddi', value: 90,  color: '#7b31ba' }, // violet
    { key: 'pisces',      name: 'pisces',      element: 'water', mode: 'mutable',  letter: 'qoph',   value: 100, color: '#a01c88', glow: '#c63ee6' } // ultraviolet
  ];

  /* kind: 'pigment' (seven classical tinctures) | 'optic' (outer planets) */
  const PLANETS = {
    sun:     { name: 'sun',     kind: 'pigment', tincture: '#d4a93a', sheen: '#fff2c2', shade: '#8a6318', metal: 'gold',        sephira: 'tiphareth', number: 6,    angel: 'michael',  body: 'Sun',     period: 365.256, owns: 'radiance' },
    moon:    { name: 'moon',    kind: 'pigment', tincture: '#c3cad2', sheen: '#f6f8fa', shade: '#6d7684', metal: 'silver',      sephira: 'yesod',     number: 9,    angel: 'gabriel',  body: 'Moon',    period: 27.3217, owns: 'fill' },
    mercury: { name: 'mercury', kind: 'pigment', tincture: '#8f52b8', metal: 'quicksilver', sephira: 'hod',       number: 8,    angel: 'raphael',  body: 'Mercury', period: 365.256, owns: 'rays' },
    venus:   { name: 'venus',   kind: 'pigment', tincture: '#2e7050', metal: 'copper',      sephira: 'netzach',   number: 7,    angel: 'anael',    body: 'Venus',   period: 365.256, owns: 'curves' },
    mars:    { name: 'mars',    kind: 'pigment', tincture: '#b5302a', metal: 'iron',        sephira: 'geburah',   number: 5,    angel: 'samael',   body: 'Mars',    period: 686.98,  owns: 'points' },
    jupiter: { name: 'jupiter', kind: 'pigment', tincture: '#2b63c4', metal: 'tin',         sephira: 'chesed',    number: 4,    angel: 'sachiel',  body: 'Jupiter', period: 4332.59, owns: 'halos' },
    saturn:  { name: 'saturn',  kind: 'pigment', tincture: '#040507', rim: '#4d525c', metal: 'lead', sephira: 'binah', number: 3, angel: 'cassiel', body: 'Saturn', period: 10759.2, owns: 'container' },
    uranus:  { name: 'uranus',  kind: 'optic',   tincture: '#d8e4ee', optic: 'iridescence', sephira: null, number: null, body: 'Uranus',  period: 30688.5, owns: 'lattice' },
    neptune: { name: 'neptune', kind: 'optic',   tincture: '#eef3ff', optic: 'brilliance',  sephira: null, number: null, body: 'Neptune', period: 60182,   owns: 'diffusion' },
    pluto:   { name: 'pluto',   kind: 'optic',   tincture: '#1a0f12', optic: 'lensing',     sephira: null, number: null, body: 'Pluto',   period: 90560,   owns: 'core' }
  };
  const ORDER = ['sun', 'moon', 'mercury', 'venus', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto'];
  /* the elements, GD King scale of the mother letters; earth is Malkuth's black, here a dark brown */
  /* the stones of the planets, after Agrippa, Book I, chapters 23 to 29. the element beside each is the clock's own tag,
     by the stone's colour and nature, so the one nearest a chart's flavour can be offered first [SD]. */
  const STONES = {
    sun: [['ruby', 'fire'], ['carbuncle', 'fire'], ['chrysolite', 'earth'], ['topaz', 'earth'], ['hyacinth', 'air'], ['heliotrope', 'water']],
    moon: [['moonstone', 'water'], ['pearl', 'water'], ['crystal', 'air'], ['beryl', 'water'], ['marcasite', 'earth']],
    mercury: [['agate', 'earth'], ['emerald', 'water'], ['topaz', 'earth'], ['jasper', 'fire'], ['crystal', 'air']],
    venus: [['emerald', 'water'], ['beryl', 'water'], ['coral', 'fire'], ['carnelian', 'fire'], ['sapphire', 'air'], ['lapis', 'air'], ['greenJasper', 'earth']],
    mars: [['bloodstone', 'fire'], ['diamond', 'air'], ['lodestone', 'earth'], ['jasper', 'fire'], ['amethyst', 'water']],
    jupiter: [['sapphire', 'air'], ['hyacinth', 'air'], ['emerald', 'water'], ['beryl', 'water'], ['greenJasper', 'earth']],
    saturn: [['onyx', 'earth'], ['jet', 'earth'], ['sapphire', 'air'], ['chalcedony', 'water'], ['brownJasper', 'earth'], ['lodestone', 'earth']]
  };
  const ELEMENTS = { air: '#f2e8a0', water: '#4a7ef0', fire: '#ff5a2a', earth: '#1c1410' };
  const CHALDEAN = ['saturn', 'jupiter', 'mars', 'sun', 'venus', 'mercury', 'moon'];
  const WEEKDAY_RULER = ['sun', 'moon', 'mars', 'mercury', 'jupiter', 'venus', 'saturn']; // Sunday..Saturday

  /* Synodic periods where geocentric mean motion is shared with the Sun */
  const SYNODIC_OVERRIDE = { 'sun|mercury': 115.88, 'sun|venus': 583.92, 'mercury|venus': 144.56 };

  const DOMICILE = {
    sun: ['leo'], moon: ['cancer'], mercury: ['gemini', 'virgo'], venus: ['taurus', 'libra'],
    mars: ['aries', 'scorpio'], jupiter: ['sagittarius', 'pisces'], saturn: ['capricorn', 'aquarius'],
    uranus: ['aquarius'], neptune: ['pisces'], pluto: ['scorpio']
  };
  const EXALTATION = { sun: 'aries', moon: 'taurus', mercury: 'virgo', venus: 'pisces', mars: 'capricorn', jupiter: 'cancer', saturn: 'libra' };
  const TRIPLICITY = { fire: ['sun', 'jupiter'], earth: ['venus', 'moon'], air: ['saturn', 'mercury'], water: ['mars', 'mars'] }; // [day, night]
  /* Egyptian terms: [ruler, upper bound in degrees] */
  const TERMS = {
    aries:       [['jupiter', 6], ['venus', 12], ['mercury', 20], ['mars', 25], ['saturn', 30]],
    taurus:      [['venus', 8], ['mercury', 14], ['jupiter', 22], ['saturn', 27], ['mars', 30]],
    gemini:      [['mercury', 6], ['jupiter', 12], ['venus', 17], ['mars', 24], ['saturn', 30]],
    cancer:      [['mars', 7], ['venus', 13], ['mercury', 19], ['jupiter', 26], ['saturn', 30]],
    leo:         [['jupiter', 6], ['venus', 11], ['saturn', 18], ['mercury', 24], ['mars', 30]],
    virgo:       [['mercury', 7], ['venus', 17], ['jupiter', 21], ['mars', 28], ['saturn', 30]],
    libra:       [['saturn', 6], ['mercury', 14], ['jupiter', 21], ['venus', 28], ['mars', 30]],
    scorpio:     [['mars', 7], ['venus', 11], ['mercury', 19], ['jupiter', 24], ['saturn', 30]],
    sagittarius: [['jupiter', 12], ['venus', 17], ['mercury', 21], ['saturn', 26], ['mars', 30]],
    capricorn:   [['mercury', 7], ['jupiter', 14], ['venus', 22], ['saturn', 26], ['mars', 30]],
    aquarius:    [['mercury', 7], ['venus', 13], ['jupiter', 20], ['mars', 25], ['saturn', 30]],
    pisces:      [['venus', 12], ['jupiter', 16], ['mercury', 19], ['mars', 28], ['saturn', 30]]
  };
  /* Faces: Chaldean order from Mars at 0° Aries, one per decan */
  const faceRuler = decanIndex => CHALDEAN[(2 + decanIndex) % 7];

  /* Window 2 — tarot. The 36 decans with their minor cards and Book T titles (Golden Dawn).
     Cardinal signs take 2–3–4, fixed 5–6–7, mutable 8–9–10; the suit follows the element. */
  const SUIT = { fire: 'wands', earth: 'pentacles', air: 'swords', water: 'cups' };
  const CARD_BASE = { cardinal: 2, fixed: 5, mutable: 8 };
  const NUMBER_NAME = ['', '', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'];
  const TITLES = {
    wands:     { 2: 'dominion', 3: 'established strength', 4: 'perfected work', 5: 'strife', 6: 'victory', 7: 'valour', 8: 'swiftness', 9: 'great strength', 10: 'oppression' },
    cups:      { 2: 'love', 3: 'abundance', 4: 'blended pleasure', 5: 'loss in pleasure', 6: 'pleasure', 7: 'illusionary success', 8: 'abandoned success', 9: 'material happiness', 10: 'perfected success' },
    swords:    { 2: 'peace restored', 3: 'sorrow', 4: 'rest from strife', 5: 'defeat', 6: 'earned success', 7: 'unstable effort', 8: 'shortened force', 9: 'despair and cruelty', 10: 'ruin' },
    pentacles: { 2: 'harmonious change', 3: 'material works', 4: 'earthly power', 5: 'material trouble', 6: 'material success', 7: 'success unfulfilled', 8: 'prudence', 9: 'material gain', 10: 'wealth' }
  };
  const DECANS = [];
  for (let i = 0; i < 12; i++) for (let d = 0; d < 3; d++) {
    const sg = SIGNS[i], suit = SUIT[sg.element], num = CARD_BASE[sg.mode] + d;
    DECANS.push({ index: i * 3 + d, sign: i, decan: d + 1, ruler: faceRuler(i * 3 + d), suit, num, card: `${NUMBER_NAME[num]} of ${suit}`, title: `lord of ${TITLES[suit][num]}` });
  }
  const decanOf = lon => DECANS[Math.floor((((lon % 360) + 360) % 360) / 10)];

  /* Trumps on the paths, Golden Dawn attribution (Strength VIII to Leo, Justice XI to Libra, the Star to Aquarius). */
  const TRUMP_SIGN = ['the emperor', 'the hierophant', 'the lovers', 'the chariot', 'strength', 'the hermit', 'justice', 'death', 'temperance', 'the devil', 'the star', 'the moon'];
  const TRUMP_PLANET = { saturn: 'the universe', jupiter: 'the wheel of fortune', mars: 'the tower', sun: 'the sun', venus: 'the empress', mercury: 'the magician', moon: 'the high priestess' };
  const TRUMP_ELEMENT = { air: 'the fool', water: 'the hanged man', fire: 'judgement' };

  /* The 28 mansions of the moon, 12°51′26″ each from 0° aries, names after Agrippa II.33 (first spelling of each). */
  const MANSIONS = ['alnath', 'allothaim', 'achaomazon', 'aldebaram', 'alchatay', 'alhanna', 'aldimiach', 'alnaza', 'archaam', 'algelioche', 'azobra', 'alzarpha', 'alhaire', 'achureth',
    'agrapha', 'azubene', 'alchil', 'alchas', 'allatha', 'abnahaya', 'abeda', 'sadahacha', 'zabadola', 'sadabath', 'sadalabra', 'alpharg', 'alcharya', 'albotham'];
  const mansionOf = lon => { const i = Math.floor((((lon % 360) + 360) % 360) / (360 / 28)); return { index: i + 1, name: MANSIONS[i] }; };

  /* Aspects as fractions of the circle: angle = k·360/n  →  star polygon {n/k} */
  const ASPECTS = [
    { key: 'conjunction',  angle: 0,     n: 1,  k: 0, weight: 1.00, orb: 8,   nature: 'fusion' },
    { key: 'opposition',   angle: 180,   n: 2,  k: 1, weight: 0.90, orb: 8,   nature: 'hard' },
    { key: 'square',       angle: 90,    n: 4,  k: 1, weight: 0.80, orb: 7,   nature: 'hard' },
    { key: 'trine',        angle: 120,   n: 3,  k: 1, weight: 0.70, orb: 7,   nature: 'soft' },
    { key: 'sextile',      angle: 60,    n: 6,  k: 1, weight: 0.50, orb: 5,   nature: 'soft' },
    { key: 'quincunx',     angle: 150,   n: 12, k: 5, weight: 0.35, orb: 3,   nature: 'hard' },
    { key: 'sesquisquare', angle: 135,   n: 8,  k: 3, weight: 0.32, orb: 2,   nature: 'hard' },
    { key: 'semisquare',   angle: 45,    n: 8,  k: 1, weight: 0.30, orb: 2,   nature: 'hard' },
    { key: 'quintile',     angle: 72,    n: 5,  k: 1, weight: 0.30, orb: 2,   nature: 'creative' },
    { key: 'biquintile',   angle: 144,   n: 5,  k: 2, weight: 0.30, orb: 2,   nature: 'creative' },
    { key: 'septile',      angle: 360/7, n: 7,  k: 1, weight: 0.28, orb: 1.2, nature: 'fated' },
    { key: 'biseptile',    angle: 720/7, n: 7,  k: 2, weight: 0.28, orb: 1.2, nature: 'fated' },
    { key: 'triseptile',   angle: 1080/7,n: 7,  k: 3, weight: 0.28, orb: 1.2, nature: 'fated' },
    { key: 'novile',       angle: 40,    n: 9,  k: 1, weight: 0.26, orb: 1,   nature: 'creative' }
  ];
  const ASPECT_GLYPH = {
    conjunction: '☌', opposition: '☍', square: '□', trine: '△', sextile: '⚹', quincunx: '⚻',
    sesquisquare: '⚼', semisquare: '∠', quintile: 'Q', biquintile: 'bQ', septile: 'S7', biseptile: 'S7²', triseptile: 'S7³', novile: 'N'
  };

  /* Sound. Paul Foster Case's colour–note scale: the King-scale wheel read as the chromatic scale,
     red = C. So the zodiac's colours and its notes are the same circle. */
  const NOTES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];   // aries … pisces
  /* one sign = one semitone, so the distance between two signs names the interval: a trine (4 signs) is a major third */
  const INTERVALS = ['unison', 'minor second', 'major second', 'minor third', 'major third', 'perfect fourth', 'tritone'];

  /* The three mothers (Sefer Yetzirah) as the three kinds of window:
     aleph / air  = ideation · mem / water = incarnation (descent into form) · shin / fire = destruction */
  const MOTHERS = {
    ideation:    { letter: 'aleph', planets: { mercury: 1, jupiter: 0.7, sun: 0.7, uranus: 0.8 }, elements: ['air', 'fire'], wants: 'soft' },
    incarnation: { letter: 'mem',   planets: { venus: 1, moon: 0.9, jupiter: 0.7, saturn: 0.5 }, elements: ['earth', 'water'], wants: 'soft' },
    destruction: { letter: 'shin',  planets: { mars: 1, pluto: 1, saturn: 0.8, uranus: 0.5 }, elements: ['fire', 'water'], wants: 'hard' }
  };

  const BENEFIC = { venus: 1, jupiter: 1, sun: 0.3, moon: 0.4 };
  const MALEFIC = { mars: 1, saturn: 1, pluto: 0.6, uranus: 0.4 };

  SD.corr = {
    STONES,
    SIGNS, PLANETS, ORDER, CHALDEAN, WEEKDAY_RULER, SYNODIC_OVERRIDE,
    DOMICILE, EXALTATION, TRIPLICITY, TERMS, faceRuler, ASPECTS, ASPECT_GLYPH, BENEFIC, MALEFIC, NOTES, INTERVALS, MOTHERS,
    DECANS, decanOf, TRUMP_SIGN, TRUMP_PLANET, TRUMP_ELEMENT, MANSIONS, mansionOf, ELEMENTS
  };
})(window.SD = window.SD || {});
