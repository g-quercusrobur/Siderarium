# Siderarium

The macrocosmic clock: https://siderarium.com

**Proprietary.** Copyright (c) 2026 Hippocrene Design Works LLC. All rights reserved. This repository is
public so that the site can be served from it and its handling of data inspected; it is not open
source. See [LICENSE](LICENSE).

| Folder | What it is |
|---|---|
| `siderarium/` | the app, served at siderarium.com/app (its notes: `siderarium/DESIGN.md`) |
| `site/` | the website, served at siderarium.com |
| `.github/` | how both are published |

**Privacy.** The app has no server. Birth charts and settings stay in the visitor's own browser; the
app's scripts fetch its own files and nothing else, the page's content policy forbids anything more,
and the publishing workflow refuses to deploy a build that breaks either rule. No one's chart, real or
for testing, is kept in this repository.

The other files in the root belong to the Python "mosaic" project this repository was forked from
(Copyright (c) 2021 Johannes Beetz, MIT licence: `LICENSE-mosaic-MIT.txt`, `README-mosaic.md`).
Siderarium does not use them.
