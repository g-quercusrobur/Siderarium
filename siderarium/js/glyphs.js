/*  siderarium — glyphs
    Every symbol is built from circle, line and arc on a unit grid [-1, 1],
    one stroke weight, round caps. No font glyphs: they drift between platforms.
*/
(function (SD) {
  'use strict';
  const TAU = Math.PI * 2;

  const circle = (p, x, y, r) => { p.moveTo(x + r, y); p.arc(x, y, r, 0, TAU); };
  const line = (p, x1, y1, x2, y2) => { p.moveTo(x1, y1); p.lineTo(x2, y2); };
  const arc = (p, x, y, r, a0, a1, ccw) => { p.moveTo(x + r * Math.cos(a0), y + r * Math.sin(a0)); p.arc(x, y, r, a0, a1, ccw); };

  const PLANET = {
    sun(p) { circle(p, 0, 0, 0.78); circle(p, 0, 0, 0.1); },
    moon(p) {
      // crescent from two circles: outer r .8 at origin, inner r .66 shifted right
      const R = 0.8, r = 0.66, d = 0.36;
      const x = (d * d + R * R - r * r) / (2 * d), y = Math.sqrt(Math.max(0, R * R - x * x));
      const a = Math.atan2(y, x), b = Math.atan2(y, x - d);
      p.moveTo(x, -y);
      p.arc(0, 0, R, -a, a, true);
      p.arc(d, 0, r, b, -b, false);
    },
    mercury(p) { circle(p, 0, -0.08, 0.38); arc(p, 0, -0.78, 0.3, 0, Math.PI, false); line(p, 0, 0.3, 0, 0.98); line(p, -0.28, 0.66, 0.28, 0.66); },
    venus(p) { circle(p, 0, -0.32, 0.46); line(p, 0, 0.14, 0, 0.98); line(p, -0.3, 0.6, 0.3, 0.6); },
    mars(p) {
      circle(p, -0.2, 0.22, 0.5);
      const e = Math.SQRT1_2 * 0.5;
      line(p, -0.2 + e, 0.22 - e, 0.74, -0.74);
      line(p, 0.74, -0.74, 0.28, -0.74); line(p, 0.74, -0.74, 0.74, -0.28);
    },
    jupiter(p) {
      p.moveTo(-0.62, -0.62); p.bezierCurveTo(-0.15, -1.0, 0.18, -0.25, -0.72, 0.36);
      line(p, -0.72, 0.36, 0.72, 0.36); line(p, 0.36, -0.82, 0.36, 0.9);
    },
    saturn(p) {
      line(p, -0.34, -0.95, -0.34, 0.3); line(p, -0.68, -0.6, 0.04, -0.6);
      p.moveTo(-0.34, 0.02); p.bezierCurveTo(-0.08, -0.36, 0.56, -0.3, 0.38, 0.22);
      p.bezierCurveTo(0.24, 0.58, 0.32, 0.92, 0.62, 0.84);
    },
    uranus(p) {
      line(p, -0.56, -0.86, -0.56, 0.14); line(p, 0.56, -0.86, 0.56, 0.14);
      line(p, -0.56, -0.36, 0.56, -0.36); line(p, 0, -0.86, 0, 0.44); circle(p, 0, 0.66, 0.22);
    },
    neptune(p) {
      arc(p, 0, -0.66, 0.6, 0, Math.PI, false);
      line(p, 0.6, -0.66, 0.6, -0.92); line(p, -0.6, -0.66, -0.6, -0.92);
      line(p, 0, -0.95, 0, 0.95); line(p, -0.32, 0.56, 0.32, 0.56);
    },
    pluto(p) { circle(p, 0, -0.58, 0.2); arc(p, 0, -0.58, 0.44, 0, Math.PI, false); line(p, 0, -0.14, 0, 0.95); line(p, -0.3, 0.56, 0.3, 0.56); }
  };

  const SIGN = [
    function aries(p) {
      p.moveTo(-0.74, -0.28); p.bezierCurveTo(-0.86, -0.96, 0, -0.98, 0, -0.18); p.lineTo(0, 0.9);
      p.moveTo(0.74, -0.28); p.bezierCurveTo(0.86, -0.96, 0, -0.98, 0, -0.18);
    },
    function taurus(p) { circle(p, 0, 0.36, 0.44); arc(p, 0, -0.64, 0.54, 0, Math.PI, false); },
    function gemini(p) {
      line(p, -0.36, -0.62, -0.36, 0.62); line(p, 0.36, -0.62, 0.36, 0.62);
      p.moveTo(-0.76, -0.86); p.quadraticCurveTo(0, -0.46, 0.76, -0.86);
      p.moveTo(-0.76, 0.86); p.quadraticCurveTo(0, 0.46, 0.76, 0.86);
    },
    function cancer(p) {
      circle(p, -0.44, -0.24, 0.22); p.moveTo(-0.44, -0.46); p.bezierCurveTo(0.06, -0.78, 0.56, -0.62, 0.82, -0.3);
      circle(p, 0.44, 0.24, 0.22); p.moveTo(0.44, 0.46); p.bezierCurveTo(-0.06, 0.78, -0.56, 0.62, -0.82, 0.3);
    },
    function leo(p) {
      circle(p, -0.46, 0.36, 0.24);
      p.moveTo(-0.24, 0.26); p.bezierCurveTo(-0.46, -0.36, -0.1, -0.92, 0.26, -0.76);
      p.bezierCurveTo(0.66, -0.56, 0.36, -0.06, 0.26, 0.26); p.bezierCurveTo(0.16, 0.62, 0.46, 0.96, 0.78, 0.74);
    },
    function virgo(p) {
      line(p, -0.82, -0.56, -0.82, 0.74);
      p.moveTo(-0.82, -0.3); p.bezierCurveTo(-0.82, -0.82, -0.28, -0.82, -0.28, -0.3); p.lineTo(-0.28, 0.74);
      p.moveTo(-0.28, -0.3); p.bezierCurveTo(-0.28, -0.82, 0.26, -0.82, 0.26, -0.3); p.lineTo(0.26, 0.62);
      p.moveTo(0.26, 0.0); p.bezierCurveTo(0.96, -0.24, 0.92, 0.6, 0.3, 0.96);
    },
    function libra(p) {
      line(p, -0.8, 0.7, 0.8, 0.7);
      p.moveTo(-0.8, 0.26); p.lineTo(-0.3, 0.26); p.bezierCurveTo(-0.62, -0.1, -0.46, -0.66, 0, -0.66);
      p.bezierCurveTo(0.46, -0.66, 0.62, -0.1, 0.3, 0.26); p.lineTo(0.8, 0.26);
    },
    function scorpio(p) {
      line(p, -0.82, -0.56, -0.82, 0.6);
      p.moveTo(-0.82, -0.3); p.bezierCurveTo(-0.82, -0.82, -0.28, -0.82, -0.28, -0.3); p.lineTo(-0.28, 0.6);
      p.moveTo(-0.28, -0.3); p.bezierCurveTo(-0.28, -0.82, 0.26, -0.82, 0.26, -0.3); p.lineTo(0.26, 0.5);
      p.quadraticCurveTo(0.26, 0.84, 0.6, 0.84); p.lineTo(0.88, 0.84);
      line(p, 0.88, 0.84, 0.66, 0.62); line(p, 0.88, 0.84, 0.66, 1.0);
    },
    function sagittarius(p) {
      line(p, -0.8, 0.8, 0.8, -0.8); line(p, 0.8, -0.8, 0.24, -0.8); line(p, 0.8, -0.8, 0.8, -0.24);
      line(p, -0.56, -0.14, 0.14, 0.56);
    },
    function capricorn(p) {
      p.moveTo(-0.86, -0.7); p.bezierCurveTo(-0.52, -0.72, -0.46, -0.5, -0.46, 0.78);
      p.moveTo(-0.46, -0.2); p.bezierCurveTo(-0.3, -0.78, 0.18, -0.8, 0.2, -0.2); p.lineTo(0.2, 0.36);
      p.bezierCurveTo(0.2, 0.92, 0.9, 0.86, 0.8, 0.36); p.bezierCurveTo(0.7, -0.04, 0.24, 0.08, 0.2, 0.46);
      p.bezierCurveTo(0.16, 0.76, 0.0, 0.92, -0.16, 0.92);
    },
    function aquarius(p) {
      for (const y of [-0.26, 0.3]) {
        p.moveTo(-0.86, y + 0.14); p.lineTo(-0.43, y - 0.2); p.lineTo(0, y + 0.14); p.lineTo(0.43, y - 0.2); p.lineTo(0.86, y + 0.14);
      }
    },
    function pisces(p) { arc(p, -1.36, 0, 0.92, -0.62, 0.62, false); arc(p, 1.36, 0, 0.92, Math.PI - 0.62, Math.PI + 0.62, false); line(p, -0.58, 0, 0.58, 0); }
  ];

  function draw(ctx, builder, x, y, size, color, weight) {
    const p = new Path2D();
    builder(p);
    ctx.save();
    ctx.translate(x, y);
    ctx.scale(size / 2, size / 2);
    ctx.lineWidth = (weight || 0.1) ;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.strokeStyle = color;
    ctx.stroke(p);
    ctx.restore();
  }
  const planet = (ctx, key, x, y, size, color, weight) => draw(ctx, PLANET[key], x, y, size, color, weight);
  const sign = (ctx, idx, x, y, size, color, weight) => draw(ctx, SIGN[idx], x, y, size, color, weight);

  SD.glyphs = { planet, sign, PLANET, SIGN };
})(window.SD = window.SD || {});
