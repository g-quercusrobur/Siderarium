# siderarium

Macrocosmic clock visually tracking the astrological energy of the moment. Formerly cosmo weather.

Siderarium draws the sky of the present moment as a living mandala. Through synesthesia it conveys, in a multi-sensory experience, the astrological energy of the hour: its colour, its geometry, its chord. It captures the moment and its vibration, to be seen, heard and kept as an image; for practitioners of the Arts it is also a timing tool. Classical aspects are divisions of the circle, so each is drawn as its star polygon: the pattern that results is the key to the present moment.

Open `index.html` in a browser: no build step, no server, works offline (the fonts ship with it).

**Controls:** clock / chart / natal / transits · `readout` · `menu` (sigil, listen, screen, about; language, houses, field, planets; nativity, relocation, saved charts) · `now` · `±1h` · `±1d` · `run` / `pause` (15 min, 1 h, 4 h, 24 h of sky per second) · date field (place's own time) · one city per time zone · `here` · `birth` · print HD art (2048) · wallpaper
**Gestures:** turn the dial to travel in time (one turn = one day, wheel = ten minutes) · pinch or ctrl+wheel to zoom · double tap to reset
**Keys:** `space` run · `←/→` hour · `shift+←/→` day · `f` screen · `i` readout · `esc`
**URL:** `?t=2027-01-15T21:00:00Z` fixes the moment · `?place=rome` · `?mode=chart` · `?lang=es` · `?field=glow` (the glow field instead of the engraving) · `?hd=1` shows the 4096 export

**Install:** the folder is a PWA (manifest, service worker, icons). Served over https it can be added to the home screen; `wallpaper` saves a portrait image at the phone's pixel size. `.github/workflows/pages.yml` publishes the website (`../site/`) at the root of the `gh-pages` branch and this folder under `/app/`, with the hourly sky renders at `/sky/`; GitHub serves that branch at `https://<owner>.github.io/mosaicgen/` (the app at `/mosaicgen/app/`) once Pages is set to deploy from it (settings → pages → source: deploy from a branch → gh-pages). A custom domain (siderarium.com) is a `CNAME` file in `site/` plus DNS at the registrar.

**Website:** `../site/` is a static page in two widths (index, privacy and legal, images, self-hosted fonts), no build step.

Samples in `samples/`: today at sunrise, the Venus cazimi of 24 Oct 2026, the exact Uranus–Neptune sextile of 15 Jan 2027, and the chart mode.

## Files

| file | role |
|---|---|
| `js/engine.js` | sky → state: positions, Placidian mundane positions, houses, dignity, planetary hours, aspects, hierarchy, events. No drawing. |
| `js/correspondences.js` | the tables: tinctures, King scale, sephiroth, numbers, angels, dignities, terms, faces, decans and Book T titles, mansions, aspects |
| `js/i18n.js` | English and Spanish: every string, name and title |
| `js/color.js` | OKLab; the two mixing laws (light, pigment) |
| `js/glyphs.js` | planet and sign glyphs, drawn from circle, line and arc |
| `js/render.js` | dial, field, Harris weave, rose engine, constellations, optics, caption |
| `js/app.js` | shell: live clock, dial gesture, zoom, places, nativity, exports, readout, language |
| `sw.js`, `manifest.webmanifest`, `icons/` | the installable shell |
| `js/vendor/astronomy.browser.min.js` | Astronomy Engine 2.1.19 (MIT, Don Cross). Ephemeris accurate to about an arcminute. |
| `DESIGN.md` | the system book: every rule the code implements |
