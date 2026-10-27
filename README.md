# Sitemap Visualizer

A browser-only sitemap visualizer, developed in small, testable phases.

## Open the application

Open `index.html` directly in Chrome, Edge, or Firefox. Import a local links CSV, sitemap XML, or saved HTML file, then explore the graph on its white canvas. It requires no local server, application backend, installation, account, or network connection at startup.

Set a known root URL for depth colors. Drag nodes to pin them; drag the canvas to pan; use zoom, fit, unpin, and reset controls. See `docs/graph-rendering.md` for controls, evidence semantics, fixtures, and browser checks. Use Live discovery to traverse browser-readable HTML links and sitemap indexes, including on an intranet or loopback host. Set pages (up to 1,000), depth (up to 20), concurrency, request timeout and run duration. Robots restrictions are ignored; CORS and browser network permissions still apply. Byte, record and time limits can stop a run before its page ceiling. See `docs/discovery.md` for scheduling, provenance, budgets and browser evidence. If a site sends no CORS header, live discovery cannot read it; `tools/same-origin-link-export.js` exports its links from the site's own origin as a CSV for import (see `docs/same-origin-export.md`). Download the graph as PNG, or pages and links as CSV, after a complete or partial run (see `docs/exports.md`).

## Browser support and release status

The release gate (Phase 19) passes its automated checks in Chromium 153 under `file://`, including a fully offline import, graph and export run. Chrome, Edge and Firefox release runs and a screen-reader review are still open. See `docs/release-evidence.md` for results and open items, and `docs/release-matrix.md` for each requirement's evidence.

Live discovery reads only sites that grant CORS permission to this page; a page opened from a file has origin `null`. The application has no proxy or backend and cannot read a blocked response. Robots rules are ignored and private or loopback hosts are allowed, by owner decision.

## Development checks

The app itself has no runtime dependency installation. To run the development smoke tests, install Node.js 18 or later and run:

```sh
npm ci
npm test
```

The tests use Node's built-in test runner and the development-only jsdom package. The unit tests do not start a server or make network requests. Optional browser checks (`tests/*-browser-check.cjs`) need Playwright and Chromium; the fetch and release checks start a development-only loopback fixture. `tests/spreadsheet-injection-check.cjs` needs LibreOffice. See `docs/release-evidence.md` for the full list.

## Project files

- `index.html` — direct-file application entry point
- `css/styles.css` — local interface styles
- `js/app.bundle.js` — deferred classic-script entry point
- `sample-data/` — offline import and graph fixtures
- `docs/` — user guide (`READ_ME.md`), specification, design notes and release evidence
- `THIRD_PARTY_NOTICES.md` — runtime dependency and CDN policy
