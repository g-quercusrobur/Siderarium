/*  siderarium — colour
    OKLab is the working space for every mix. Two mixing laws:
      light   (soft aspects)  additive, interpolated in OKLab, lifted
      pigment (hard aspects)  multiplicative in linear RGB, muddied
*/
(function (SD) {
  'use strict';

  function hexToRgb(hex) {
    const h = hex.replace('#', '');
    return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16) / 255);
  }
  function rgbToHex(rgb) {
    return '#' + rgb.map(v => {
      const c = Math.round(Math.min(1, Math.max(0, v)) * 255);
      return c.toString(16).padStart(2, '0');
    }).join('');
  }
  const toLin = c => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  const toGam = c => (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055);

  function rgbToOklab(rgb) {
    const [r, g, b] = rgb.map(toLin);
    const l = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
    const m = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
    const s = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);
    return [
      0.2104542553 * l + 0.7936177850 * m - 0.0040720468 * s,
      1.9779984951 * l - 2.4285922050 * m + 0.4505937099 * s,
      0.0259040371 * l + 0.7827717662 * m - 0.8086757660 * s
    ];
  }
  function oklabToRgb(lab) {
    const [L, a, b] = lab;
    const l = Math.pow(L + 0.3963377774 * a + 0.2158037573 * b, 3);
    const m = Math.pow(L - 0.1055613458 * a - 0.0638541728 * b, 3);
    const s = Math.pow(L - 0.0894841775 * a - 1.2914855480 * b, 3);
    return [
      4.0767416621 * l - 3.3077115913 * m + 0.2309699292 * s,
      -1.2684380046 * l + 2.6097574011 * m - 0.3413193965 * s,
      -0.0041960863 * l - 0.7034186147 * m + 1.7076147010 * s
    ].map(toGam);
  }

  const lab = hex => rgbToOklab(hexToRgb(hex));
  const hex = l => rgbToHex(oklabToRgb(l));

  /* light: soft aspects, conjunction of benefics — clean OKLab interpolation, slightly lifted */
  function mixLight(a, b, t = 0.5, lift = 0.04) {
    const A = lab(a), B = lab(b);
    const m = A.map((v, i) => v + (B[i] - v) * t);
    m[0] = Math.min(0.98, m[0] + lift);
    return hex(m);
  }

  /* pigment: hard aspects — multiply in linear light, then pull chroma down */
  function mixPigment(a, b, mud = 0.35) {
    const A = hexToRgb(a).map(toLin), B = hexToRgb(b).map(toLin);
    const prod = A.map((v, i) => Math.sqrt(v * B[i]));
    const l = rgbToOklab(prod.map(toGam));
    l[1] *= 1 - mud; l[2] *= 1 - mud;
    return hex(l);
  }

  /* clarity: 1 = pure, 0 = grey and dim. Lightness is held so dignity never fights the Moon. */
  function clarify(c, clarity) {
    const l = lab(c);
    const k = 0.25 + 0.75 * clarity;
    l[1] *= k; l[2] *= k;
    return hex(l);
  }

  function shade(c, dL) { const l = lab(c); l[0] = Math.max(0, Math.min(1, l[0] + dL)); return hex(l); }

  function hueShift(c, deg) {
    const l = lab(c);
    const C = Math.hypot(l[1], l[2]);
    const h = Math.atan2(l[2], l[1]) + deg * Math.PI / 180;
    return hex([l[0], C * Math.cos(h), C * Math.sin(h)]);
  }

  function rgba(c, a) {
    const [r, g, b] = hexToRgb(c).map(v => Math.round(v * 255));
    return `rgba(${r},${g},${b},${Math.max(0, Math.min(1, a)).toFixed(4)})`;
  }

  SD.color = { hexToRgb, rgbToHex, lab, hex, mixLight, mixPigment, clarify, shade, hueShift, rgba };
})(window.SD = window.SD || {});
