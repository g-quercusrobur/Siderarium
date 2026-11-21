/* renders one square image a day for a run of days, at a fixed local hour in one place, with the caption of the moment,
   and writes the posting plan beside them: plan.csv (date, time, caption, image_url) and plan.json.
   the ephemeris is deterministic, so a year can be rendered ahead and handed to any scheduler that takes a CSV.
   usage: node tools/render-year.js <out dir> <start yyyy-mm-dd> <days> [place=rome] [hour=08:00] [lang=en] [chromium path] [base url]
   (run from the siderarium folder) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const [out = 'year-out', start = new Date().toISOString().slice(0, 10), daysArg = '365', place = 'rome', hour = '08:00', lang = 'en', exe, base] = process.argv.slice(2);
const days = +daysArg;
const SITE = base || process.env.POST_BASE || 'https://siderarium.com/post/';   // the folder's public address, unlisted when the workflow gives it a token
const TAGS = { en: '#siderarium #astrology #planetaryhours #electionalastrology #moonvoidofcourse #astrologicalclock #macrocosmicclock',
               es: '#siderarium #astrología #horasplanetarias #astrologíaelectiva #lunavacíadecurso #relojastrológico' };
const ZONES = { rome: 'Europe/Rome', 'new york': 'America/New_York', london: 'Europe/London', greenwich: 'UTC', madrid: 'Europe/Madrid', paris: 'Europe/Paris', berlin: 'Europe/Berlin', 'los angeles': 'America/Los_Angeles', tokyo: 'Asia/Tokyo', sydney: 'Australia/Sydney', 'mexico city': 'America/Mexico_City', 'buenos aires': 'America/Argentina/Buenos_Aires' };
/* the instant of a local wall time in a zone: two corrections through the zone's own clock */
function instant(ymd, hm, tz) {
  const [y, m, d] = ymd.split('-').map(Number), [hh, mm] = hm.split(':').map(Number);
  const want = Date.UTC(y, m - 1, d, hh, mm);
  const wall = x => { const p = Object.fromEntries(new Intl.DateTimeFormat('en-GB', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(x)).map(q => [q.type, q.value])); return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute); };
  let t = want; for (let i = 0; i < 2; i++) t += want - wall(t);
  return new Date(t);
}
const csvCell = s => '"' + String(s).replace(/"/g, '""') + '"';
(async () => {
  fs.mkdirSync(out, { recursive: true });
  const tz = ZONES[place] || 'UTC';
  const index = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const p = await (await b.newContext({ viewport: { width: 1000, height: 1000 } })).newPage();
  const rows = [], t0 = Date.parse(start + 'T00:00:00Z');
  for (let i = 0; i < days; i++) {
    const ymd = new Date(t0 + i * 864e5).toISOString().slice(0, 10), at = instant(ymd, hour, tz);
    await p.goto(`${index}?place=${encodeURIComponent(place)}&lang=${lang}&mode=clock&t=${at.toISOString()}`);
    await p.waitForFunction(() => window.SD && SD.app && SD.app.S.state, null, { timeout: 30000 });
    await p.waitForTimeout(600);
    const r = await p.evaluate(() => {
      const st = SD.app.S.state, big = document.createElement('canvas'); big.width = big.height = 2048;
      SD.render.render(big.getContext('2d'), st, 2048, 3, { mode: 'clock', fieldRes: 300, engrave: SD.app.S.engrave, luminous: SD.app.S.luminous });
      const cv = document.createElement('canvas'); cv.width = cv.height = 1080; cv.getContext('2d').drawImage(big, 0, 0, 1080, 1080);
      const c = SD.render.captionLines(st);
      return { jpg: cv.toDataURL('image/jpeg', 0.9), c };
    });
    const c = r.c;
    const caption = [c.label, `${c.state} · ${c.title}`, c.reason, c.l1, c.detail1, `${c.detail2} · ${c.detail3}`, c.detail4, '', 'siderarium.com', TAGS[lang] || TAGS.en].filter(x => x !== undefined).join('\n');
    fs.writeFileSync(path.join(out, `${ymd}.jpg`), Buffer.from(r.jpg.split(',')[1], 'base64'));
    rows.push({ date: ymd, time: hour, zone: tz, place, caption, image_url: `${SITE}${ymd}.jpg`, file: `${ymd}.jpg` });
    if (i % 10 === 0) console.log(ymd, '·', c.state, '·', c.title);
  }
  fs.writeFileSync(path.join(out, 'plan.csv'), ['date,time,caption,image_url'].concat(rows.map(r => [r.date, r.time, csvCell(r.caption), r.image_url].join(','))).join('\n') + '\n');
  fs.writeFileSync(path.join(out, 'plan.json'), JSON.stringify({ rendered: new Date().toISOString(), place, zone: tz, hour, lang, days: rows.length, posts: rows }, null, 1));
  await b.close();
  console.log(rows.length, 'days rendered into', out);
})().catch(e => { console.error(e); process.exit(1); });
