/* renders the sky of now for each target in wallpapers.json: a phone wallpaper and a 2048 square.
   usage: node tools/render-sky.js <out dir> [chromium path]   (run from the siderarium folder) */
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const out = process.argv[2] || 'out', exe = process.argv[3];
  fs.mkdirSync(out, { recursive: true });
  const targets = JSON.parse(fs.readFileSync(path.join(__dirname, 'wallpapers.json'), 'utf8'));
  const index = 'file://' + path.resolve(__dirname, '..', 'index.html');
  const b = await chromium.launch(exe ? { executablePath: exe, args: ['--no-sandbox'] } : { args: ['--no-sandbox'] });
  const ctx = await b.newContext({ viewport: { width: 1000, height: 1000 } });
  const p = await ctx.newPage();
  const stamp = new Date().toISOString().slice(0, 16).replace('T', ' ') + ' utc';
  const meta = { rendered: stamp, targets: [] };
  for (const t of targets) {
    await p.goto(`${index}?place=${encodeURIComponent(t.place)}&lang=en&mode=clock`);
    await p.waitForFunction(() => window.SD && SD.app && SD.app.S.state, null, { timeout: 30000 });
    await p.waitForTimeout(1500);
    const png = await p.evaluate(([w, h]) => {
      const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
      SD.render.renderWallpaper(cv.getContext('2d'), SD.app.S.state, w, h, 3, { fieldRes: 300, engrave: SD.app.S.engrave, luminous: SD.app.S.luminous });
      return cv.toDataURL('image/png');
    }, [t.w, t.h]);
    fs.writeFileSync(path.join(out, `${t.name}.png`), Buffer.from(png.split(',')[1], 'base64'));
    const sq = await p.evaluate(() => {
      const cv = document.createElement('canvas'); cv.width = cv.height = 2048;
      SD.render.render(cv.getContext('2d'), SD.app.S.state, 2048, 3, { mode: 'clock', fieldRes: 300, engrave: SD.app.S.engrave, luminous: SD.app.S.luminous });
      return cv.toDataURL('image/png');
    });
    fs.writeFileSync(path.join(out, `${t.name}-square.png`), Buffer.from(sq.split(',')[1], 'base64'));
    const cap = await p.evaluate(() => SD.render.captionLines(SD.app.S.state));
    meta.targets.push({ name: t.name, place: t.place, caption: cap.l1, figure: cap.fig, chord: cap.chord });
    console.log(t.name, '·', cap.l1, '·', cap.fig);
  }
  fs.writeFileSync(path.join(out, 'sky.json'), JSON.stringify(meta, null, 1));
  await b.close();
})().catch(e => { console.error(e); process.exit(1); });
