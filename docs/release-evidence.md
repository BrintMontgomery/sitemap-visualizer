# Release Evidence

**Phase 19 — 27 October 2026.** This records what the release-gate runs established, what they did not, and what remains before release. The requirement-by-requirement view is in [release matrix](release-matrix.md).

**Gate result: not yet passed.** The automated gate is green in Chromium. The gate also requires Chrome, Edge and Firefox runs, a human accessibility review, and decisions on three exceptions. Those are listed under [open items](#open-items).

## Environment

| Item | Value |
|---|---|
| Host | Linux container (Ubuntu 24.04), no display; headless browser |
| Browser | Chromium 153.0.8010.12 through Playwright 1.63.0 |
| Spreadsheet | LibreOffice 24.2.7.2 (headless) |
| Node.js | 22.22.0, development checks only |
| Not available | Google Chrome, Microsoft Edge, Firefox. Firefox could not be downloaded: the environment's network policy refused Mozilla's and Playwright's download hosts |

Chromium shares its engine with Chrome and Edge, but it is not either release build. No claim is made for them.

## Package under test

The release package is the static folder: `index.html`, `css/`, `js/`, `sample-data/`, `docs/`, `README.md` and `THIRD_PARTY_NOTICES.md` (68 files, 816 KB). It has no runtime dependencies, `vendor/` is empty, and no CDN is used. `tests/`, `tools/`, `node_modules/` and `package*.json` are development files. `tools/same-origin-link-export.js` is a helper the user runs on a target site; the application never loads it.

The release check ran twice: against the repository and against a clean copy that held only the package files (`SITEMAP_APP_DIR`). Both passed.

## Commands and results

| Command | Result |
|---|---|
| `npm test` | 152 of 152 pass |
| `node tests/release-gate-browser-check.cjs` | Pass; repository and clean package |
| `node tests/enhanced-import-browser-check.cjs` | Pass |
| `node tests/exports-browser-check.cjs` | Pass |
| `node tests/fetch-adapter-browser-check.cjs` | Pass (selector updated for the new explanation panel) |
| `node tests/graph-renderer-browser-check.cjs` | Pass |
| `node tests/html-import-browser-check.cjs` | Pass |
| `node tests/metrics-browser-check.cjs` | Pass |
| `node tests/page-details-browser-check.cjs` | Pass |
| `node tests/spreadsheet-injection-check.cjs` | Pass; 0 formula cells in 354 cells |

Browser checks need Playwright and a Chromium build; set `CHROMIUM_EXECUTABLE_PATH` to use a specific binary. The spreadsheet check needs `soffice` on `PATH`. Two positive controls ran: the traffic observer recorded a deliberate request, and the spreadsheet check found formula cells once neutralization was disabled.

## Measurements

Times come from four Chromium runs on the host above (ranges shown). They are a few samples, not medians from a controlled benchmark.

| Case | Target | Result |
|---|---|---|
| 50-page links CSV import at depth 2, offline (`fifty-page-links.csv`) | NFR-009: median under 30 s | 77–92 ms from submit to graph |
| 250 pages / 1,000 links, import to graph (`250-node-1000-edge-links.csv`) | NFR-010: layout under 5 s | 130–152 ms |
| 250 / 1,000 zoom in, zoom out, fit and pan | NFR-010: responsive | 295–345 ms for the sequence |
| 50-page CORS-readable loopback site at depth 2, default limits | NFR-009: under 30 s | Partial at 30.1 s in every run: 30 of 50 pages fetched, run-duration limit reached |
| Same site, run duration raised to 120 s | NFR-009: under 30 s | Complete at 50.1 s in every run: 50 pages, 51 requests |

The live result follows from the app's own politeness limit: at most one request start per host per second (`minHostIntervalMs: 1000`). A 50-page site therefore needs about 50 s, more than the 30-second default run duration. The specification excludes remote-site throttling from the target, but this limit is the app's own. See open item 3.

## Acceptance tests

"Chromium" means the case passed in Chromium only; the other browsers are open.

| Test | Result | Evidence |
|---|---|---|
| AT-01 | Pass, Chromium | `release-gate`: defaults 2/50, legend, empty state, blank URL field |
| AT-02 | Pass, Chromium | `release-gate`, `run-controls`: `javascript:`, `ftp:`, credentials and a malformed host rejected with a field message and no request |
| AT-03 | Pass | `graph`, `csv-import`: four pages, four edges, shortest depths |
| AT-04 | Pass | `graph`, `discovery`: depth cap and warning |
| AT-05 | Pass | `graph`, `csv-import`: 30-page fixture with cap 10 |
| AT-06 | Pass | `graph`, `csv-import`, `fetch-adapter`: duplicates, fragments, observable redirects only |
| AT-07 | Pass | `xml-import`, `metrics`: inventory without links or depth |
| AT-08 | Pass, Chromium | `graph-renderer (browser)`, `page-details (browser)`, `release-gate` |
| AT-09 | Pass, Chromium | `graph-renderer (browser)` with `radial-clusters-links.csv` |
| AT-10 | Pass, Chromium | `exports (browser)`, `release-gate` |
| AT-11 | Pass | `metrics`: candidate, not proven, orphan |
| AT-12 | Pass, Chromium; Deviation | CORS-blocked and timeout messages in `fetch-adapter (browser)`, `release-gate`. Robots part superseded (Phase 11) |
| AT-13 | Pass; Deviation | Schemes and credentials rejected. Private, loopback and metadata hosts accepted by owner decision (Phase 10) |
| AT-14 | Partial, Chromium | Keyboard and accessibility tree in `page-details (browser)`. Screen-reader speech not tested (open item 2) |
| AT-15 | Pass, LibreOffice | `spreadsheet-injection-check`, `exports`. Excel and Google Sheets not tested (open item 1) |
| AT-16 | Pass, Chromium | Clean package under `file://` in `release-gate`. Chrome, Edge, Firefox open; no person double-clicked the file |
| AT-17 | Pass, Chromium | Browser offline: CSV, XML and HTML import, select, drag, zoom, fit, PNG and both CSVs, in `release-gate` |
| AT-18 | Not applicable | No CDN is configured; every script is local |
| AT-19 | Pass, Chromium | Zero non-file requests across import, interaction and export, with positive control, in `release-gate` |
| AT-20 | Pass, Chromium | `fetch-adapter (browser)`: denied fetch, then local import |
| AT-21 | Pass | `csv-import`, `graph` |
| AT-22 | Pass, Chromium | `fetch-adapter (browser)`. XHR part not applicable (not shipped) |
| AT-23 | Pass, Chromium | `fetch-adapter (browser)`: status, final URL, duration, bytes, provenance |
| AT-24 | Pass, Chromium | `fetch-adapter (browser)`: opaque response rejected |
| AT-25–28 | Not applicable | Iframe bridge not shipped; omission tested in `iframe-bridge-decision` |
| AT-29 | Pass, Chromium | `jsonp-omission`, `release-gate`: option disabled and labeled; tampered mode fails closed; no script element or global added |
| AT-30 | Not applicable | JSONP not shipped |
| AT-31 | Pass, Chromium | `html-import (browser)`, `release-gate` |
| AT-32 | Pass, Chromium | `enhanced-import (browser)` |
| AT-33 | Pass, Chromium | `enhanced-import (browser)` |
| AT-34 | Pass, Chromium | `enhanced-import (browser)` |
| AT-35 | Pass, Chromium | No CDN exists, so the bundled run is the only run; offline in `release-gate` |
| AT-36 | Pass | Local pinned scripts only; no backend, proxy, extension or telemetry; no JSONP loader, in `package-smoke`, `jsonp-omission`, `release-gate` |
| AT-37 | Pass, Chromium; Deviation | Out-of-scope redirect, oversize body, slow endpoint and cancellation in `fetch-adapter (browser)`. Robots part superseded |

## Static review

- Scripts: 15 local classic scripts with `defer`; no inline script, `type="module"`, dynamic `import()`, `importScripts`, `eval`, `new Function`, or script-element creation (`jsonp-omission`).
- Storage and telemetry: no `localStorage`, `sessionStorage`, IndexedDB, cookies, service worker, worker, `sendBeacon`, WebSocket or EventSource in `js/` or `index.html`. The only absolute URLs in `js/` are XML namespace identifiers (SVG and sitemap schema).
- Dependencies: none at runtime. jsdom 26.1.0 (MIT) is a development dependency, pinned in `package-lock.json`. See `THIRD_PARTY_NOTICES.md`.
- Export schemas: [exports](exports.md). Threat notes for optional integrations: [iframe bridge decision](iframe-bridge-decision.md), [XHR decision](xhr-decision.md) and the Deferred Items section of the [development plan](devPlan.md).
- README CORS limits: `README.md` and [READ_ME](READ_ME.md) state that live discovery cannot read sites without CORS permission and that no proxy exists.

## Defects fixed in Phase 19

1. **Malformed host reached the network (AT-02).** Chromium's URL parser accepts `https://exa mple.test/` and encodes the host as `exa%20mple.test`; the app then requested it. `normalizeUrl` now rejects hosts that are empty or contain `%`. Node's parser already rejected them, so the regression is in `release-gate`.
2. **Root URL errors were not field-specific (FR-003).** The reason ("Only HTTP(S) URLs are supported.") was stored but not shown. The guidance now starts with `Root URL: <reason>`, and the field is marked `aria-invalid` until the next submission or reset.
3. **Rejected-run summary was wrong.** It showed "Limits: undefined pages" and called a live attempt "User-supplied records only". It now shows "Limits: not applied (input rejected)" and the live coverage text.
4. **No "Why can't this URL be read?" explanation (FR-059).** Added to the outcome report. It appears after a refused or opaque live read, not after a time-limited partial run.

## Open items

1. **Cross-browser runs.** Run all browser checks, or the manual workflow below, in current Chrome, Edge and Firefox on a desktop. Open the package by double-clicking `index.html`. Open an exported CSV in Excel and Google Sheets for AT-15.
2. **Accessibility.** A person should complete a screen-reader pass (NVDA or JAWS with Chrome/Edge/Firefox, or VoiceOver with Safari) and a WCAG 2.2 AA review of the controls, statuses and details. Automated checks cover keyboard use, names, states, focus visibility, 24 px targets and 320/768 px reflow, but not speech output.
3. **Live performance exception (NFR-009, P1).** A 50-page live run needs about 50 s because of the one-request-per-second host limit, and the 30-second default run duration cuts it to 30 pages. The owner should either accept this exception, raise the default run duration, or relax the host spacing.
4. **Run reproducibility (NFR-014, P1).** Exports do not record an application or normalization-policy version. The owner should accept this or schedule a schema change.
5. **Owner deviations.** Robots handling and private-address acceptance depart from P0 requirements (see the matrix). The release notes should state them.

## Manual workflow for other browsers

For each of Chrome, Edge and Firefox, with the network disconnected:

1. Double-click `index.html`. Confirm Max Depth 2, Max Pages 50 and the five-entry legend.
2. Select **Links CSV**, choose `sample-data/fifty-page-links.csv`, enter root `https://example.test/`, and select **Analyze / New run**. Expect 50 pages and 98 links, state complete.
3. Select a page in the table; drag a node; use zoom and **Fit to view**.
4. Download the PNG and both CSVs. Open the PNG and check colors, legend and footer.
5. Repeat with `four-page-sitemap.xml` (Sitemap XML) and `home-page.html` (Saved HTML).
6. Choose **Live discovery** and enter `javascript:alert(1)`. Expect "Root URL: Only HTTP(S) URLs are supported."
7. Reconnect the network. Enter a site that sends no CORS header. Expect a failed run and the **Why can't this URL be read?** explanation.

Record the browser version and result for each step here.
