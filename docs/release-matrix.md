# Release Requirement Matrix

**Phase 19 — 27 October 2026.** Source: `Sitemap_Visualizer_Requirements_v3.0.md`. Each functional (FR) and nonfunctional (NFR) requirement maps to the tests or manual evidence that support it. Run details, measurements and open manual checks are in [release evidence](release-evidence.md).

## Status key

| Status | Meaning |
|---|---|
| **Pass** | Automated evidence passes in Node/jsdom and, where a browser is involved, in Chromium under `file://`. |
| **Pass (Chromium)** | Passes in Chromium only. Chrome, Edge and Firefox release runs are still open. |
| **Deviation** | The owner changed the requirement during development. The decision and its location are named. |
| **Not shipped** | An optional P1/P2 capability was omitted under its own omission rule. Omission is tested. |
| **Open** | Evidence is still missing. The gap is named in [release evidence](release-evidence.md#open-items). |

## Test sources

Unit and integration tests run with `npm test` (`tests/*.test.js`). Browser checks are `tests/*-browser-check.cjs`; the spreadsheet check is `tests/spreadsheet-injection-check.cjs`. Short names below drop the `tests/` prefix and the `.test.js` / `-browser-check.cjs` suffix. A name ending in "(browser)" is the Chromium check of that name.

## Functional requirements

| ID | P | Status | Evidence |
|---|---|---|---|
| FR-001 | P0 | Pass (Chromium) | URL and local-file inputs in `index.html`; `package-smoke`; `release-gate (browser)` AT-01 |
| FR-002 | P0 | Pass (Chromium) | Defaults 2/50 and ranges in `run-controls`, `discovery-controls`; `release-gate (browser)` AT-01 |
| FR-003 | P0 | Pass (Chromium) | Root URL errors name the field and reason (fixed in Phase 19), in `run-controls`, `release-gate (browser)` AT-02. A second submission replaces the active run and stale results are ignored, so no two jobs run (`run-controls`) |
| FR-004 | P0 | Pass | Queued/running/complete/partial/failed/cancelled in `run-controls`, `outcome-report` |
| FR-005 | P1 | Pass | Cancellation in `run-controls`, `discovery`, `fetch-adapter`; `fetch-adapter (browser)` |
| FR-006 | P0 | Pass | Replacement and reset in `run-controls`, `graph-renderer`, `page-details`, `metrics` |
| FR-007 | P0 | Pass (Chromium); Deviation | Bounded HTML traversal in `discovery`, `fetch-adapter (browser)`. Robots portion superseded (Phase 11, `discovery.md`) |
| FR-008 | P1 | Pass; Deviation | Direct, conventional and HTML-declared sitemaps in `discovery`. Robots `Sitemap:` lookup not used (Phase 11) |
| FR-009 | P1 | Pass | `urlset`/`sitemapindex`, nesting and cycles in `xml-import`, `discovery` |
| FR-010 | P0 | Pass | Normalization and deduplication in `contracts`, `graph` |
| FR-011 | P0 | Pass (Chromium) | Page, depth, time, redirect, byte and scope limits in `discovery`, `fetch-adapter`, `graph`; `fetch-adapter (browser)` |
| FR-012 | P0 | Deviation | Robots rules ignored by owner decision (Phase 11, `discovery.md`). Rate limits and timeouts pass in `fetch-adapter` |
| FR-013 | P1 | Pass (Chromium) | Status, final URL and failure reason; unknown stays unknown, in `fetch-adapter`, `discovery`; `fetch-adapter (browser)` |
| FR-014 | P0 | Pass | Breadth-first minimum depth in `graph`, `discovery`, `csv-import` |
| FR-015 | P0 | Pass | Directed edges, cross-links and collapsed duplicates in `graph`, `csv-import` |
| FR-016 | P0 | Pass | Truncation and blocked-page disclosure in `outcome-report`, `discovery`, `graph` |
| FR-017 | P0 | Pass (Chromium) | One node per page, directed edges, in `graph-renderer`; `graph-renderer (browser)` |
| FR-018 | P0 | Pass (Chromium) | Orange/green/purple/red nodes and legend in `graph-renderer`; `release-gate (browser)` |
| FR-019 | P0 | Pass (Chromium) | White canvas and gray edges in `graph-renderer (browser)`; topology fixture `radial-clusters-links.csv` |
| FR-020 | P0 | Pass (Chromium) | Drag and pin in `graph-renderer (browser)`, `release-gate (browser)` |
| FR-021 | P0 | Pass (Chromium) | Zoom, pan and fit in `graph-renderer (browser)`, `release-gate (browser)` |
| FR-022 | P0 | Pass (Chromium) | Click and keyboard details in `page-details`, `page-details (browser)` |
| FR-023 | P1 | Pass (Chromium) | Included links and safe new-tab links in `page-details (browser)` |
| FR-024 | P1 | Pass | Summary counts, depth distribution, duration, exclusions in `metrics`, `outcome-report` |
| FR-025 | P1 | Pass (Chromium) | Layout reset and neighbor highlight in `metrics (browser)`, `graph-renderer (browser)` |
| FR-026 | P0 | Pass (Chromium) | Keyboard page list; 320/768 px reflow in `page-details (browser)`; tablet viewport in `graph-renderer (browser)` |
| FR-027 | P1 | Pass | Degrees, depth and weak components in `metrics` |
| FR-028 | P1 | Pass (Chromium) | Candidate orphans need an inventory source, in `metrics`, `metrics (browser)` |
| FR-029 | P0 | Pass | "Candidate" qualification in `metrics`, `exports` |
| FR-030 | P1 | Pass (Chromium) | PNG with colors, legend, coverage footer in `exports`, `exports (browser)` |
| FR-031 | P1 | Pass | Pages and links CSVs with stable IDs and partial flags in `exports` |
| FR-032 | P1 | Pass (Chromium) | Export availability and failure reporting in `exports (browser)` |
| FR-033 | P0 | Pass | Result states per failure class in `outcome-report`, `discovery`, `csv-import`, `xml-import` |
| FR-034 | P0 | Pass | No silent empty canvas in `outcome-report`, `run-controls` |
| FR-035 | P1 | Pass | Input, limits, timestamp and truncation in the run summary, `outcome-report`, `run-controls` |
| FR-036 | P0 | Pass | No challenge bypass; access limitation explained in `outcome-report`; no bypass code (`release-gate` traffic checks) |
| FR-037 | P0 | Pass (Chromium) | Local XML import in `xml-import`; offline in `release-gate (browser)` |
| FR-038 | P0 | Pass (Chromium) | Local CSV validation in `csv-import`; offline in `release-gate (browser)` |
| FR-039 | P0 | Pass | Mode labels state what each input establishes, in `index.html`; `package-smoke`, `outcome-report` |
| FR-040 | P0 | Pass (Chromium) | No `no-cors`, relay or frame bypass in `fetch-adapter`, `iframe-bridge-decision`; `fetch-adapter (browser)` |
| FR-041 | P0 | Pass | In-memory parsing; user-initiated file selection in `enhanced-import`, `csv-import` |
| FR-042 | P0 | Pass | Seven modes; bridge and JSONP disabled with explanation, in `contracts`, `iframe-bridge-decision`, `jsonp-omission` |
| FR-043 | P0 | Pass (Chromium) | Attempt records; no CORS inference from `TypeError`, in `fetch-adapter`; `fetch-adapter (browser)` |
| FR-044 | P0 | Pass (Chromium) | `mode: 'cors'`, `credentials: 'omit'`, abort, timeout, streamed bounds in `fetch-adapter`; `fetch-adapter (browser)` |
| FR-045 | P1 | Not shipped | XHR omitted (Phase 16, `xhr-decision.md`); `xhr-decision` |
| FR-046 | P0 | Pass (Chromium) | Plain GET without custom headers in `fetch-adapter`; header capture in `fetch-adapter (browser)` |
| FR-047 | P0 | Pass | Explanation and next choices; no automatic script or frame load, in `outcome-report`, `jsonp-omission`, `iframe-bridge-decision` |
| FR-048 | P1 | Not shipped | Iframe bridge omitted (Phase 17, `iframe-bridge-decision.md`); `iframe-bridge-decision` |
| FR-049 | P1 | Not shipped | As FR-048 |
| FR-050 | P1 | Not shipped | As FR-048; `BRIDGE_UNAVAILABLE` preserved in contracts |
| FR-051 | P2 | Not shipped | JSONP omitted; Phase 18 removed from plan (`devPlan.md`); `jsonp-omission` |
| FR-052 | P2 | Not shipped | As FR-051 |
| FR-053 | P0 | Pass (Chromium) | Saved HTML with declared base; inert, in `html-import`, `html-import (browser)` |
| FR-054 | P1 | Pass (Chromium) | Bounded paste in `enhanced-import`, `enhanced-import (browser)` |
| FR-055 | P1 | Pass (Chromium) | Multi-file mapping; selected files only, in `enhanced-import`, `enhanced-import (browser)` |
| FR-056 | P0 | Pass (Chromium) | Offline import, graph and export with browser offline, in `release-gate (browser)` |
| FR-057 | P0 | Pass | Provenance on nodes, edges and CSVs in `graph`, `exports`, `page-details` |
| FR-058 | P1 | Pass (Chromium) | Labeled hierarchy preview; never an edge, in `enhanced-import`, `enhanced-import (browser)` |
| FR-059 | P0 | Pass (Chromium) | "Why can't this URL be read?" explanation added in Phase 19; shown after a refused live read, in `run-controls`, `release-gate (browser)` |
| FR-060 | P0 | Pass (Chromium) | Opaque/blocked responses never become evidence, in `contracts`, `fetch-adapter`; `fetch-adapter (browser)` |
| FR-061 | P0 | Pass | One validation and graph pipeline in `contracts`, `graph`, `enhanced-import` |
| FR-062 | P0 | Pass (Chromium); Deviation | Schemes, credentials and host scope rejected, in `contracts`, `fetch-adapter`. Private/loopback literals allowed (Phase 10, `fetch-adapter.md`) |
| FR-063 | P0 | Pass | No path executes remote script; generic URL in tampered JSONP mode fails closed, in `jsonp-omission` |
| FR-064 | P0 | Pass | No `Origin`, `Host` or `User-Agent` injection in `fetch-adapter` |
| FR-065 | P0 | Pass | Five outcome classes and independent issue codes in `outcome-report`, `contracts` |

## Nonfunctional requirements

| ID | P | Status | Evidence |
|---|---|---|---|
| NFR-001 | P0 | Pass (Chromium); Deviation | Non-HTTP(S), credentials and malformed hosts rejected, in `contracts`, `run-controls`, `release-gate (browser)`. Private/loopback/metadata-style targets allowed (Phase 10) |
| NFR-002 | P0 | Pass | Byte, record, structure, concurrency, rate and duration bounds in `fetch-adapter`, `discovery`, `xml-import`, `enhanced-import` |
| NFR-003 | P0 | Deviation | Robots not read (Phase 11). Requests carry no forged identity (`fetch-adapter`) |
| NFR-004 | P0 | Pass (Chromium) | Inert HTML/XML; no script execution, in `html-import (browser)`, `fetch-adapter (browser)` |
| NFR-005 | P0 | Pass | Escaped text rendering in `page-details`, `graph-renderer`; formula neutralization in `exports`; LibreOffice in `spreadsheet-injection-check` |
| NFR-006 | P0 | Pass | Per-run limits and responsive cancellation in `discovery`, `fetch-adapter`, `run-controls` |
| NFR-007 | P0 | Open | Keyboard, names, states, focus, target size and reflow pass in `page-details (browser)`. Human screen-reader review and a full WCAG 2.2 AA audit are open |
| NFR-008 | P1 | Open | Chromium 153 passes all checks. Chrome, Edge and Firefox runs are open |
| NFR-009 | P1 | Open | 50-page import: 77–92 ms. 50-page live site at depth 2: 50.1 s; default 30 s run ends partial at 30 pages. Exceeds the 30 s target (exception in evidence) |
| NFR-010 | P1 | Pass (Chromium) | 250 nodes / 1,000 links: 130–152 ms import-to-graph; 295–345 ms zoom/fit/pan, in `release-gate (browser)` |
| NFR-011 | P0 | Pass | Terminal states for every failure path in `outcome-report`, `discovery`, `run-controls` |
| NFR-012 | P0 | Pass (Chromium) | No storage APIs or uploads (static scan); zero remote requests offline, in `release-gate (browser)` |
| NFR-013 | P1 | Pass | Redacted local diagnostics in `outcome-report` |
| NFR-014 | P1 | Open | Exports carry run ID, mode, timestamp, limits and truncation; input references are per record in `evidence_json` (`exports`). No application or normalization-policy version is recorded |
| NFR-015 | P0 | Pass | Browser JavaScript, HTML and CSS only, in `package-smoke` |
| NFR-016 | P0 | Pass (Chromium) | Clean package opens under `file://`, in `release-gate (browser)` with `SITEMAP_APP_DIR` |
| NFR-017 | P0 | Pass | No CDN library is used (`THIRD_PARTY_NOTICES.md`); `package-smoke` |
| NFR-018 | P0 | Pass (Chromium) | Core workflow with browser offline, in `release-gate (browser)` |
| NFR-019 | P0 | Pass (Chromium) | No backend, proxy or telemetry; traffic observer with positive control, in `release-gate (browser)` |
| NFR-020 | P0 | Pass (Chromium) | CORS honored; opaque never content, in `fetch-adapter (browser)` |
| NFR-021 | P0 | Pass | Classic deferred scripts in `package-smoke`, `jsonp-omission`; no module, worker, service-worker or storage API (static scan in release evidence) |
| NFR-022 | P0 | Pass | One adapter contract and validation pipeline in `contracts`, `graph` |
| NFR-023 | P0 | Pass | Dependency inventory: none at runtime (`THIRD_PARTY_NOTICES.md`); `package-smoke` |
| NFR-024 | P1 | Not shipped | Iframe bridge omitted (Phase 17) |
| NFR-025 | P0 | Pass | JSONP disabled and excluded from the release path; no script loader, in `jsonp-omission`, `release-gate (browser)` |
| NFR-026 | P0 | Pass | Import bounds and text-only display in `csv-import`, `xml-import`, `html-import`, `enhanced-import` |
| NFR-027 | P0 | Pass | Local relative classic scripts in `package-smoke`, `jsonp-omission` |
| NFR-028 | P0 | Pass (Chromium) | Live, bridge, JSONP and XHR absence never blocks import or export, in `release-gate (browser)`, `iframe-bridge-decision`, `jsonp-omission` |
| NFR-029 | P0 | Pass | Unknown causes qualified; no unrestricted-crawl claim, in `outcome-report` |

## Deviations recorded by the owner

| Decision | Requirements affected | Where recorded |
|---|---|---|
| Live discovery ignores `robots.txt` and robots meta directives | FR-007 (policy portion), FR-008 (robots `Sitemap:`), FR-012, NFR-003; robots parts of FR-016, AT-12, AT-37 | `devPlan.md` Phase 11; `discovery.md` |
| Private, loopback, link-local and intranet roots are accepted | FR-062 (address portion), NFR-001 (address portion), AT-13 (address portion) | `devPlan.md` Phase 10; `fetch-adapter.md`; `run-contract.md` |
| XHR, iframe bridge and JSONP are not shipped | FR-045, FR-048–052, NFR-024; AT-22 (XHR part), AT-25–28, AT-30 | `xhr-decision.md`; `iframe-bridge-decision.md`; `devPlan.md` Deferred Items |

These are the owner's decisions, recorded at the time they were made. The release gate does not change them. The specification's release gate expects robots compliance and private-address rejection, so these rows stay visible at release and are not counted as passes.
