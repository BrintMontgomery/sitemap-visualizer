# Dev Plan: Browser-Only Sitemap Visualizer
Deliver an offline-capable sitemap graph from local inputs and browser-permitted live pages, with evidence-labeled links and exports.

**Source:** `docs/Sitemap_Visualizer_Requirements_v3.0.md` (Version 3.0, 26 October 2026). This plan follows the supplied `template_phasePlan.md`. Phase work changes implementation files only when that phase begins.

## Status
* **Current phase:** Phase 13 — complete; Phase 14 is next; Phases 1–13 are complete.
* **Last green commit:** Phase 13 PNG and CSV exports; all 115 unit/integration/smoke tests and five Chromium file:// browser checks pass. See `docs/exports.md` for schemas, export safety and evidence.
* **Open questions / blockers:** An actual cooperative iframe bridge and an approved JSONP provider are not identified. Phases 17–18 remain conditional; they do not block the P0 release.

## Why this plan
The repository now displays a semantic static application shell from `index.html`, with local CSS, a deferred classic script, an empty state, and a development smoke suite. It does not yet import source data, build a graph, crawl permitted pages, or export results. The goal is a static package that opens under `file://` and gives a site analyst an honest map of what the browser or imported files actually establish. Live coverage is bounded by CORS and readable site policy; XML inventory alone cannot prove links or click depth.

### Design rationale
Build the reliable offline path before live acquisition. All modes feed one validated evidence model, so a blocked fetch cannot be mistaken for content and sitemap membership cannot become an invented hyperlink. Use one locally bundled graph library (or a documented native alternative), locally available CSV parsing, and classic scripts or a prebuilt bundle. An HTTPS CDN can be optional after pinned bytes, license, SRI, and offline fallback are verified. Revisit the library choice only if the 250-node/1,000-edge target or `file://` browser checks fail. Development tools and fixture servers may run during verification; the delivered application has no runtime server, proxy, extension, service worker, or remote telemetry.

### Existing code to reuse
* `index.html:7` and `index.html:8` already load local CSS and a deferred classic script. Keep direct-file launch and relative paths while replacing the placeholder markup.
* `js/app.bundle.js:1` already uses an immediately invoked strict-mode script. Preserve a classic-script entry point; its current status text at `js/app.bundle.js:6` is only a smoke check.
* `css/styles.css:1` supplies starter page styling. Extend or replace it deliberately; the specification's illustrative `css/app.css` path is not yet the shipped path.
* `docs/READ_ME.md:4` describes editing through vscode.dev and GitHub Pages. Retain that developer workflow while documenting direct-file and offline acceptance separately.
* No parsers, graph modules, tests, runtime configuration, or vendor bundles exist in the inspected repository tree. Add focused fixtures and tests rather than assuming an existing harness.

## Cross-Phase Engineering Contract
* **Authority and state:** One run controller owns status, cancellation, caps, and replacement. Acquisition adapters return bounded results; only the shared validator may add evidence to the run. Graph and UI derive from validated run data.
* **Data shapes:** Use the specification's `CrawlRun`, `PageNode`, `LinkEdge`, `SitemapMembership`, `AcquisitionEvidence`, `CrawlIssue`, and `LayoutState` concepts. Keep `observed-html`, `imported-link`, `bridge-reported`, and `jsonp-reported` claims distinct. Store a null depth when no observed or asserted route from the selected root exists.
* **Determinism:** Normalize URLs once, deduplicate nodes and source/target edges, calculate minimum directed depth by BFS, and apply page/depth/byte/time limits consistently. Tests use small deterministic fixtures.
* **Safety and visibility:** Parse HTML/XML as inert data and render fields as text. Never infer HTML from an opaque response, URL hierarchy, a script/image load, or ordinary iframe DOM access. Browser error labels distinguish observed facts from hypotheses. Imported files and run records remain in session memory by default.
* **Compatibility:** Every shipped core asset works with local relative paths under `file://` in current desktop Chrome, Edge, and Firefox. No runtime ES module import, local `fetch` of source files, worker, install step, or CDN request is required for XML/CSV/HTML import, graph interaction, and export.
* **Handoff:** Each phase publishes a documented interface and a focused check before its successor uses it. Commit only a coherent phase that passes the development checks then available; record deviations in this plan in the same phase commit. Optional transports must never disable offline core behavior.

## Phase Map
| # | Phase | Depends on | Risk / thinking effort | Observable delivery |
|---|---|---|---|---|
| 1 | Static package and development checks | — | Low / simple model | Direct-file shell and offline assets |
| 2 | Run contracts and URL policy | 1 | Medium / simple model | Validated modes, budgets, evidence, URL rules |
| 3 | CSV link import | 2 | Low-Medium / simple model | Local links parsed without network |
| 4 | XML sitemap import | 2 | Medium / simple model | URL inventory and nested sitemap records |
| 5 | Local HTML import | 2 | Medium / simple model | Inert HTML links with base URL |
| 6 | Graph construction and depth | 3–5 | Medium / simple model | Deterministic nodes, edges, provenance |
| 7 | Run controls and input UI | 2, 6 | Low-Medium / simple model | Mode selection, limits, status, cancellation |
| 8 | Graph rendering and layout | 6–7 | High / advanced model | White-canvas interactive graph and legend |
| 9 | Details and accessible list | 6–8 | Medium / simple model | Keyboard inspection and link details |
| 10 | CORS-readable fetch adapter | 2, 7 | High / advanced model | Bounded readable URL acquisition |
| 11 | Deep HTML/sitemap discovery | 6, 10 | Very High / advanced model | Bounded traversal with robots restrictions ignored |
| 12 | Outcome and coverage reporting | 7, 10–11 | Medium / simple model | Terminal and partial states with guidance |
| 13 | PNG and CSV exports | 6, 8, 12 | Medium / simple model | Provenance-aware local downloads |
| 14 | Metrics and orphan candidates | 6, 12 | Medium / simple model | Qualified components and candidates |
| 15 | Paste, multi-file, hierarchy preview | 4–6, 7 | Medium / simple model | Explicit enhanced imports |
| 16 | Optional XHR adapter | 10, 12 | Medium / simple model | Equivalent bounded CORS behavior |
| 17 | Conditional cooperative bridge | 2, 12 | Very High / advanced model | Verified public message transport if provider exists |
| 18 | Conditional allowlisted JSONP | 2, 12 | Very High / advanced model | Disabled-default provider adapter if approved |
| 19 | Cross-browser and release gate | 1–18 as shipped | High / advanced model | P0 traceability and release evidence |

**Primary requirement allocation** (the release matrix in Phase 19 records each individual requirement and its evidence):

| Phase | Functional requirements | Nonfunctional focus |
|---|---|---|
| 1 | FR-056 | NFR-015–019, NFR-021, NFR-023, NFR-027–028 |
| 2 | FR-010, FR-040–043, FR-057, FR-060–065 | NFR-001–002, NFR-004–006, NFR-012, NFR-022, NFR-026, NFR-029 |
| 3 | FR-038–039, FR-041 | NFR-026 |
| 4 | FR-009, FR-037 | NFR-026 |
| 5 | FR-053 | NFR-004 |
| 6 | FR-014–015, FR-017, FR-057, FR-061 | NFR-022 |
| 7 | FR-001–006, FR-039, FR-042, FR-065 | NFR-007, NFR-011 |
| 8 | FR-018–021, FR-025–026 | NFR-010 |
| 9 | FR-022–023, FR-026 | NFR-007 |
| 10 | FR-013, FR-040, FR-043–044, FR-046–047, FR-062–064 | NFR-001–002, NFR-020 |
| 11 | FR-007–013, FR-016 | NFR-002–003, NFR-006 |
| 12 | FR-016, FR-033–036, FR-043, FR-047, FR-059, FR-065 | NFR-011, NFR-013–014, NFR-029 |
| 13 | FR-030–032, FR-057 | NFR-005, NFR-014 |
| 14 | FR-024, FR-027–029, FR-058 | NFR-010 |
| 15 | FR-054–055, FR-058 | NFR-026 |
| 16 | FR-045 | NFR-020, NFR-022 |
| 17 | FR-048–050 | NFR-024 |
| 18 | FR-051–052, FR-063 | NFR-025 |
| 19 | All shipped functions | NFR-007–014, NFR-017–029 |

---

## [x] Phase 1: Static package and development checks
*Establish the direct-file runtime and a small development verification harness. **Risk:** Low — an optional CDN could accidentally become a boot dependency. **Thinking effort:** Low (simple model). **Depends on:** none.*

### 1. Objectives & Scope
* **In scope:** `index.html`, `css/styles.css` or a documented replacement, `js/app.bundle.js`, `vendor/`, `sample-data/`, dependency notices, and development-only test commands.
* **Done means:** opening `index.html` directly shows an application shell with no network; an offline smoke check runs.

### 2. Implementation Checklist
- [x] Replace placeholder markup with semantic regions and an empty-state shell.
- [x] Choose one graph library and CSV parser or documented native equivalents; pin, verify, and bundle every core runtime byte locally. Record versions, licenses, hashes, and optional CDN/SRI policy in `THIRD_PARTY_NOTICES.md`.
- [x] Make classic-script order and local relative paths deterministic; create minimal offline fixtures and a development-only test harness without a runtime server dependency.
- [x] Document `file://` launch in `README.md`.

### 3. Testing & Verification
- [x] `npm test` passes five built-in smoke tests for local file paths, the accessible empty state, classic-script readiness, fixture consistency, and runtime dependency inventory.
- [x] Asset audit confirms no remote script, stylesheet, package dependency, or required CDN request at startup.
* **Checks:** source-level AT-16 direct-file startup checks and the no-required-CDN startup smoke for AT-18/AT-35. Full browser, import, graph, and export cases remain with their later feature phases and the Phase 19 release gate.
* **Acceptance:** local relative assets resolve from a `file://` entry point, and the shell script reaches its ready state without a server or network dependency.
* **Commit point:** commit the shell, asset inventory, fixture, and check together.

---

## [x] Phase 2: Run contracts and URL policy
*Define one data boundary before adding inputs. **Risk:** Medium — ambiguous provenance or URL scope could contaminate every graph. **Thinking effort:** Medium (simple model). **Depends on:** 1.*

### 1. Objectives & Scope
* **In scope:** `js/config.js` or bundled immutable equivalent, shared run/acquisition validation, issue codes, URL normalization, safety limits.
* **Done means:** unsupported schemes and explicit private/loopback targets are rejected, and adapters cannot mutate graph state.

### 2. Implementation Checklist
- [x] Define all acquisition modes, discriminated result statuses, evidence classes, issue codes, and fixed byte/page/depth/time budgets from §7.4; mark unsupported modes unavailable.
- [x] Implement canonical URL resolution, fragment/default-port removal, deduplication, scope checks, and explicit URL/host rejection without claiming DNS or hidden redirect insight.
- [x] Centralize evidence validation, resource budgets, run metadata, and observable-versus-unknown fields; use text-only rendering contracts.
- [x] Add focused tests for invalid URL, normalization, budget rejection, and spoofed adapter data.

### 3. Testing & Verification
* **Checks:** AT-02, AT-06, AT-13 and AT-24 covered at contract level; issue codes and rejected results have no graph effect. Browser network execution remains for later phases.
* **Decision:** Initial resource limits and conservative IPv6 policy are documented in `docs/run-contract.md`; no adapter is enabled before its implementation and validation.
* **Acceptance:** one documented validated result shape is usable by every later adapter.
* **Commit point:** commit contract, implementation, and tests.

---

## [x] Phase 3: CSV link import
*Make local directed-link data usable without network. **Risk:** Low — malformed rows or quoted delimiters may generate false edges. **Thinking effort:** Low-Medium (simple model). **Depends on:** 2.*

### 1. Objectives & Scope
* **In scope:** user-selected CSV parser and field validation; output asserted link records only.
* **Done means:** a bounded source/target CSV yields link claims and row-specific errors without uploading files.

### 2. Implementation Checklist
- [x] Read a selected local file with size and row caps; validate required source/target columns and quoted/delimited data.
- [x] Normalize endpoints and tag each claim `imported-link` with filename/row evidence; do not claim independent verification.
- [x] Add small four-page, duplicate, malformed, formula-like, and 30-page fixtures.

### 3. Testing & Verification
* **Checks:** AT-03–06 and AT-21 at record level; no network requests. Graph depth and page-cap acceptance remain in Phase 6. `npm test` passes CSV parsing, provenance, limits, and regression checks.
* **Acceptance:** valid rows survive once, invalid rows report actionable location, caps report partiality.
* **Commit point:** commit CSV adapter and fixtures.

---

## [x] Phase 4: XML sitemap import
*Import sitemap membership without inventing hyperlinks. **Risk:** Medium — nested indexes or XML entity growth may evade limits. **Thinking effort:** Medium (simple model). **Depends on:** 2.*

### 1. Objectives & Scope
* **In scope:** selected `urlset` and `sitemapindex` XML, namespace handling, bounded parsing, unresolved local references.
* **Done means:** sitemap URLs have membership evidence and null observed depth until link evidence exists.

### 2. Implementation Checklist
- [x] Parse inert XML with byte, element, nesting, and entry caps; reject malformed input.
- [x] Resolve index references only among files expressly selected later; report missing references without fetching local paths.
- [x] Record membership, source sitemap, and optional `lastmod` separately from link edges.
- [x] Add deterministic `urlset`, nested index, malformed, and oversized fixtures.

### 3. Testing & Verification
* **Checks:** AT-07 and AT-34 at record level; no XML-sourced hyperlink edge or fabricated click depth. `npm test` covers namespaces, bounds, nested indexes, malformed data, provenance, and cycles. Browser UI and full acceptance remain in later phases.
* **Decision:** Index references resolve only against explicitly supplied URL-to-selected-file mappings; missing mappings are reported. DTD declarations are rejected. Oversized and limit fixtures are generated deterministically by the tests.
* **Acceptance:** inventory imports offline and bounded indexes terminate with clear issues.
* **Commit point:** commit XML adapter and fixtures.

---

## [x] Phase 5: Local HTML import
*Extract links from user-supplied pages as inert data. **Risk:** Medium — active markup or wrong base URLs may misstate link targets. **Thinking effort:** Medium (simple model). **Depends on:** 2.*

### 1. Objectives & Scope
* **In scope:** `.html`/`.htm` file reading, explicit or trusted mapped base URL, inert title/link extraction.
* **Done means:** relative links resolve from the correct source and imported scripts/assets never execute or load.

### 2. Implementation Checklist
- [x] Parse selected HTML in native inert template contents (documented DOMParser deviation); ignore scripts, handlers, resource loading, and invalid/unsafe URLs.
- [x] Require a declared source URL when one cannot be trusted or derived; resolve relative anchors and preserve source evidence.
- [x] Add fixtures with relative links, duplicate anchors, hostile markup, absent base URL, and oversized files.

### 3. Testing & Verification
* **Checks:** AT-31 and NFR-004/026: `npm test` passes 27 tests; real Chromium file:// extraction, bounds, hostile-file script isolation and network observation pass. See `docs/html-import.md`.
- [x] HTML extraction, provenance, duplicates, unsafe URLs, parser/read failures, and generated limit regression tests pass.
- [x] Hostile-file browser check reports zero remote requests and no imported script execution; network observer positive control passes.
* **Decision:** Use native inert template contents instead of detached DOMParser HTML to avoid resource loading. Explicit source URL is also the resolution base; embedded base tags are ignored with a visible issue. See `docs/html-import.md` for limitations and browser evidence.
* **Acceptance:** valid links carry HTML-file evidence and no imported active content runs.
* **Commit point:** commit HTML adapter and fixtures.

---

## [x] Phase 6: Graph construction and depth
*Merge validated records into a graph with honest edge semantics. **Risk:** Medium — sitemap-only pages may acquire false paths. **Thinking effort:** Medium (simple model). **Depends on:** 3–5.*

### 1. Objectives & Scope
* **In scope:** `buildGraph`, root selection, unique nodes and edges, BFS, degree counts, evidence/coverage propagation.
* **Done means:** every edge comes from an explicit link claim, and depth is the shortest directed route from the chosen root.

### 2. Implementation Checklist
- [x] Deduplicate normalized page IDs and source/target edge pairs while retaining all evidence references.
- [x] Keep sitemap membership and redirect aliases separate; leave unlinked inventory depth null.
- [x] Apply page/depth caps to included records, track exclusions, and calculate distinct in/out degree.
- [x] Add graph tests for cycles, cross-links, fragments, missing root, sitemap-only pages, and cap boundaries.

### 3. Testing & Verification
* **Checks:** AT-03–07, AT-21, AT-34; compare exact node/edge/depth sets.
- [x] `npm test` passes all 39 tests, including 12 focused graph tests and unchanged import/contract checks.
- [x] Regression coverage verifies combined-source provenance, spoofed evidence rejection, unknown depth, deterministic cap selection, record/byte limits, redirect separation, immutable snapshots, and local classic-script loading.
* **Decision:** `buildGraph(run, imports)` consumes validated adapter outputs. Missing/absent roots preserve unknown depths; cap selection prioritizes shortest reachable routes before unknown-depth records. See `docs/graph.md` for the interface and remaining later-phase acceptance boundaries.
* **Acceptance:** four-page fixture yields specified edges/depths and sitemap-only nodes have no invented links.
* **Commit point:** commit graph pipeline and tests.

---

## [x] Phase 7: Run controls and input UI
*Expose modes and a cancellable analysis state. **Risk:** Low — duplicate submissions or stale runs may overwrite current results. **Thinking effort:** Low-Medium (simple model). **Depends on:** 2, 6.*

### 1. Objectives & Scope
* **In scope:** URL/import mode controls, defaults depth 2 and pages 50, status, errors, reset/new run, cancellation.
* **Done means:** one active run at a time reaches a terminal state and a new run replaces old graph data.

### 2. Implementation Checklist
- [x] Wire accessible labeled inputs and explain which modes establish edges versus inventory.
- [x] Validate mode-specific inputs and range limits; disable unsupported optional transports with reasons.
- [x] Add run IDs and `AbortController`; ignore late results from superseded runs and show queued/running/complete/partial/failed/cancelled.
- [x] Show source, effective limits, timestamp, and current coverage without storing files remotely.

### 3. Testing & Verification
* **Checks:** AT-01, AT-02, AT-12, AT-20 at local-import controller level. `npm test` passes 40 tests, including cancellation, replacement, stale results, validation and reset. Live retrieval and rendering remain later phases.
* **Acceptance:** statuses end deterministically; invalid input cannot start acquisition.
* **Commit point:** commit UI controller and tests.

---

## [x] Phase 8: Graph rendering and layout
*Make the validated graph navigable on a white canvas. **Risk:** High — dense layouts may be slow or misleading. **Thinking effort:** High (advanced model). **Depends on:** 6–7.*

### 1. Objectives & Scope
* **In scope:** one graph renderer, depth colors, legend, edge direction, drag/pin, pan, zoom, fit, layout reset.
* **Done means:** the reference topology displays with orange root, green depth 1, purple depth 2, red depth 3+, and visible links.

### 2. Implementation Checklist
- [x] Render only validated graph nodes/edges on a white SVG/canvas with a persistent legend and distinguish unknown depth.
- [x] Add drag/pin/unpin, zoom/pan/fit, and layout reset without changing graph identities.
- [x] Keep pinned positions in run-local `LayoutState`; dispose old simulations on new runs.
- [x] Use bounded layout work and fixtures near 250 nodes/1,000 edges for later performance gate.

### 3. Testing & Verification
* **Checks:** Phase 8 portions of AT-08–09; Chromium file:// pointer interactions and screenshot review pass. Details remain Phase 9. See `docs/graph-rendering.md`.
- [x] All 46 unit/integration/smoke tests pass, including six renderer regression tests for identities, safe text, unknown depth, pins, reset, disposal, stale results, and dense/empty graphs.
- [x] Browser drag/pin/unpin, pointer cancellation, pan, wheel/button zoom, fit, reset, replacement, and 768 px viewport checks pass; zero remote requests with a working observation control.
- [x] Exact 250-node/1,000-edge fixture passes finite-position/count and preliminary responsiveness checks; full release benchmarking remains Phase 19.
* **Decision:** Use deterministic bounded native SVG layout with no background simulation. Unknown-depth nodes use a separate dashed-gray grid; no positioning tree becomes evidence. `LayoutState` is run-local and immutable to consumers; old renderer listeners/content are disposed on replacement/reset.
* **Acceptance:** user can manipulate graph without losing records or freezing a normal desktop.
* **Commit point:** commit renderer and interaction checks.

---

## [x] Phase 9: Details and accessible list
*Make graph evidence inspectable without a mouse. **Risk:** Medium — visual selection can exclude keyboard users. **Thinking effort:** Medium (simple model). **Depends on:** 6–8.*

### 1. Objectives & Scope
* **In scope:** selected-node details, inbound/outbound navigation, safe new-tab link, page list, status announcements.
* **Done means:** a keyboard user can select every page and read the same evidence and counts shown on the graph.

### 2. Implementation Checklist
- [x] Add a structured page list with focus and selection synchronized to the graph.
- [x] Render URL, available title/status, depth or unknown, evidence source, inbound/outbound counts and included links as text.
- [x] Provide safe external-page navigation, clear focus indicators, accessible labels and live status messages.
- [x] Add keyboard checks and a focused WCAG 2.2 AA review of these controls.

### 3. Testing & Verification
* **Checks:** Phase 9 portions of AT-08 and AT-14 pass: keyboard-only inspect/select/navigation, accessibility-tree labels/states, safe text/links, and a focused WCAG 2.2 AA review. See `docs/page-inspection.md` for the interface and evidence; human screen-reader speech and full browser release checks remain Phase 19.
- [x] All 54 unit/integration/smoke tests pass, including eight new selection, metadata/provenance, safe navigation, unknown/capped/dense graph and stale-run/disposal regressions.
- [x] Chromium file:// keyboard checks pass for every page in a 250-node/1,000-edge fixture, graph/table selection, neighbor navigation, focus, live status and 320/768px reflow; zero automatic remote requests.
- [x] Existing graph pointer/layout browser regressions pass after selection integration.
* **Acceptance:** all included pages and details are reachable without pointer dragging.
* **Commit point:** commit detail panel, list, and accessibility checks.

---

## [x] Phase 10: Resilient internal network and CORS fetch adapter
*Enable internal network crawling and handle CORS boundaries gracefully without stalling execution. **Risk:** High — non-CORS readable responses or internal timeout delays can impact run efficiency if not handled asynchronously. **Thinking effort:** High (advanced model). **Depends on:** 2, 7.*

### 1. Objectives & Scope
* **In scope:** internal network/intranet endpoint target resolution (including permitted private/loopback IP ranges), resilient CORS error handling, non-blocking fallback modes, bounded GET requests, cancellation, and observable metadata validation.
* **Done means:** internal pages and reachable HTTP(S) endpoints are parsed when accessible; CORS-restricted or opaque responses are flagged cleanly without halting or slowing down the broader crawling run.

### 2. Implementation Checklist
- [x] Implement flexible `fetch` handling that gracefully intercepts CORS policy restrictions (e.g., handling cross-origin fetch failures and non-opaque fallbacks) so execution continues seamlessly.
- [x] Remove explicit private/loopback IP blocking rules to allow discovery and mapping across configured internal network ranges and local intranet hosts.
- [x] Implement configurable timeout and request abort mechanisms to ensure slow or non-responsive internal network nodes do not stall the crawler.
- [x] Streamline error categorization so CORS issues, transport drops, and timeouts log actionable status codes without throwing unhandled exceptions or blocking queued tasks.
- [x] Record observable final URLs, HTTP statuses, byte counts, request duration, and access issues while keeping graph processing resilient to endpoint failures.

### 3. Testing & Verification
* **Checks:** AT-22–24 and AT-37 updated with internal network targets, intranet fixtures, simulated CORS-denied endpoints, timeout handling, and high-concurrency internal crawl tests.
- [x] All 69 unit/integration/smoke tests pass, including 15 new adapter/parser/graph regressions and a 40-request burst with concurrency/rate/cancellation/expiry checks.
- [x] Actual Chromium file:// CORS allowed/denied, loopback, opaque, redirects, HTTP errors, size/time bounds, cancellation, replacement and local-import recovery pass; all three previous browser checks also pass.
* **Decision:** The revised Phase 10 permits private/loopback/intranet HTTP(S) roots, superseding the earlier explicit-target exclusion in FR-062/NFR-001 and the Phase 2 contract. Browser policy and exact root-host scope remain binding. Only the selected HTML page is requested in the UI; queued explicit adapter calls are bounded, while automatic multi-page traversal and live sitemap parsing remain Phase 11. Generic browser fetch errors retain unknown cause; no CORS bypass is attempted. See `docs/fetch-adapter.md` for the interface, bounds, requirement deviation and version-specific browser evidence.
* **Acceptance:** internal host links are mapped when accessible; CORS errors log transparently without halting the crawl process or freezing the UI.
* **Commit point:** commit internal fetch adapter, resilient CORS handler, and test suite.

---

## [x] Phase 11: Unrestricted sitemap traversal and deep discovery engine
*Traverse readable pages and sitemaps aggressively while bypassing robots restrictions to maximize graph coverage. **Risk:** High — recursive discovery across complex sites can hit browser memory limits if unthrottled. **Thinking effort:** Very High (advanced model). **Depends on:** 6, 10.*

### 1. Objectives & Scope
* **In scope:** bypass of `robots.txt` restrictions, sitemap index traversal, multi-depth HTML link extraction, configurable queueing, and expanded traversal budgets for maximum surface-area mapping across internal and external networks.
* **Done means:** multi-page traversal navigates across all discovered readable links and sitemaps regardless of robots rules until user-configured page, depth, or memory limits are reached.

### 2. Implementation Checklist
- [x] Bypass `robots.txt` restriction checks to allow unconstrained discovery across all accessible endpoints and paths.
- [x] Implement dynamic queue management to support high-capacity link discovery and recursive sitemap index expansion.
- [x] Extract and queue in-scope HTML links and embedded sitemap directives continuously to maximize visual node coverage.
- [x] Provide configurable crawl budgets (concurrency, high page count caps, and link depth) to optimize browser performance while allowing deep-scan runs.
- [x] Log queue progress, observed edges, failed endpoints, and network limits transparently while preserving all reachable link relationships.

### 3. Testing & Verification
* **Checks:** AT-03–07, AT-12, and AT-37 updated for unconstrained crawling fixtures, deep link recursion, robots-bypass confirmation, and multi-sitemap index expansion.
- [x] All 94 unit/integration/smoke tests pass, including 25 new discovery/control regressions covering cycles, shortest paths, scope, provenance, nested XML, caps, failures, concurrency/rate, cancellation, replacement, safe diagnostics and a 260-page crawl.
- [x] Chromium file:// live discovery, CORS-denied branches, recursive sitemap cycles, robots ignored, depth caps and the request log pass; all three existing offline/graph/keyboard browser regressions also pass.
* **Decision:** `SitemapDiscovery.discover` owns bounded breadth-first HTML waves and recursive sitemap/inventory queues over one fetch session. Live limits now allow 1,000 pages, depth 20, concurrency 1–8 and up to 300 seconds; fixed byte/record/rate bounds still apply. Robots restrictions are ignored as requested by the revised phase, superseding FR-007/012 and NFR-003 policy portions. Sitemap seeds use direct XML, conventional `/sitemap.xml` and HTML sitemap directives rather than robots `Sitemap:` lines (FR-008 deviation). Browser access and exact-host scope remain binding. See `docs/discovery.md` for interfaces, limits, provenance, deviations and verification.
* **Acceptance:** discovery engine bypasses robots directives and maps the maximum reachable topology up to configured user limits.
* **Commit point:** commit discovery engine, queue manager, and deep-scan test suite.

---

## [x] Phase 12: Outcome and coverage reporting
*Explain the scope and failures of every analysis. **Risk:** Medium — a partial result may look complete. **Thinking effort:** Medium (simple model). **Depends on:** 7, 10–11.*

### 1. Objectives & Scope
* **In scope:** issue taxonomy, readable/partial/user-supplied/not-readable/not-supported outcomes, error guidance and diagnostics.
* **Done means:** empty, blocked, capped and cancelled runs never leave an indefinite spinner or imply full coverage.

### 2. Implementation Checklist
- [x] Map adapter issues to user-facing outcomes while preserving unknown cause and raw diagnostic codes.
- [x] Explain possible CORS/network/policy causes and how to import a sitemap, links CSV or HTML; state what each cannot establish.
- [x] Show input, mode, limits, duration, counts, exclusions and truncation in the result and local diagnostics without exposing sensitive query strings.
- [x] Add regression cases for no response, malformed input, robots restriction, timeout and cancellation.

### 3. Testing & Verification
* **Checks:** AT-12, AT-19–20, AT-22, AT-37; inspect all terminal states.
- [x] All 107 unit/integration/smoke tests pass, including 13 reporting regressions for terminal outcomes, empty/malformed input, unknown network causes, robots diagnostics, timeout/cancellation, redaction, caps and stale/reset behavior.
- [x] Chromium file:// allowed/denied, caps, cancellation, fallback imports, query/fragment redaction and narrow diagnostics checks pass; existing offline/graph/keyboard browser regressions pass.
* **Decision:** Reports retain raw issue codes while qualifying unknown causes; cancellation discards unfinished discovery. Current robots-ignore policy remains unchanged. See `docs/outcome-reporting.md`.
* **Acceptance:** every failed attempt ends with actionable choices and no fabricated graph.
* **Commit point:** commit outcome UI and diagnostic checks.

---

## [x] Phase 13: PNG and CSV exports
*Export the analyzed view with evidence and partiality intact. **Risk:** Medium — CSV formulas or omitted warnings can mislead recipients. **Thinking effort:** Medium (simple model). **Depends on:** 6, 8, 12.*

### 1. Objectives & Scope
* **In scope:** PNG, pages CSV, links CSV, stable IDs, run metadata, secure download names.
* **Done means:** completed or partial analyses produce local downloads that distinguish inventory from observed/asserted edges.

### 2. Implementation Checklist
- [x] Capture current graph colors/positions with legend in PNG and handle browser export errors.
- [x] Specify pages/links schemas and generate correctly quoted CSV with evidence, null depth, run ID, time, and partiality.
- [x] Neutralize formula-leading cells and sanitize filenames; release Blob URLs after download.
- [x] Document export fields and add fixtures for quoted values and formula injection.

### 3. Testing & Verification
* **Checks:** AT-10, AT-15; open CSV in a spreadsheet and inspect PNG from complete/partial runs.
- [x] All 115 unit/integration/smoke tests pass, including eight export regressions for schemas, provenance, unknown depths, partiality, inventory-only metadata, formula injection, quoted/multiline Unicode, filename safety, SVG state, URL cleanup, browser failure paths and stale exports.
- [x] Chromium 133.0.6943.0 file:// complete/partial PNG and pages/links CSV downloads pass with zero remote requests; dragged pins/zoom, encoder failure, reset isolation and Blob URL release are verified. All four existing browser checks pass.
- [x] PNG visually inspected; CSV values independently round-trip through Python's CSV reader. Spreadsheet application UI and Edge/Firefox acceptance remain with Phase 19, as documented in `docs/exports.md`.
* **Decision:** Native SVG/canvas export captures the current viewport at 1,000px width with a coverage/legend footer. CSV retains graph IDs/evidence and uses empty fields for null depths. Inventory-only links export contains one explicit metadata row and no link data rows. See `docs/exports.md` for schemas, evidence semantics and source-data privacy.
* **Acceptance:** all exports work offline and carry source/coverage qualifiers.
* **Commit point:** commit exporters, schema docs, and checks.

---

## [ ] Phase 14: Metrics and orphan candidates
*Add analysis only where evidence supports it. **Risk:** Medium — missing links may be labeled as proven orphan pages. **Thinking effort:** Medium (simple model). **Depends on:** 6, 12.*

### 1. Objectives & Scope
* **In scope:** connected components, degree/depth distribution, summary counts, conditional orphan candidates and neighbor highlight.
* **Done means:** sitemap-only nodes with no observed incoming edge are candidates, with incompleteness clearly stated.

### 2. Implementation Checklist
- [ ] Compute components and summary counts over included nodes and real graph edges.
- [ ] Flag candidates only when an independent discovery source exists; never claim global orphan proof.
- [ ] Expose optional inbound/outbound highlights and metrics alongside coverage warnings.

### 3. Testing & Verification
* **Checks:** AT-11 and AT-34; complete versus bounded/blocked fixtures.
* **Acceptance:** displayed/exported metrics agree with graph records and candidates are qualified.
* **Commit point:** commit metrics and tests.

---

## [ ] Phase 15: Paste, multi-file and hierarchy preview
*Improve imports without broadening network access. **Risk:** Medium — implicit local file resolution or hierarchy lines may be mistaken for observed links. **Thinking effort:** Medium (simple model). **Depends on:** 4–6, 7.*

### 1. Objectives & Scope
* **In scope:** bounded HTML/XML/CSV paste, selected multi-file import, source URL mapping, optional URL hierarchy preview.
* **Done means:** only expressly selected files are read; hierarchy is labeled inference and does not affect link depth.

### 2. Implementation Checklist
- [ ] Add bounded paste with explicit content kind/base URL, inert parsing and localized errors.
- [ ] Map selected HTML files to source URLs and match sitemap index references only to selected local files.
- [ ] Render hierarchy preview as a separate inferred relation, excluded from `LinkEdge`, degrees and observed BFS.
- [ ] Add malformed/oversize/missing-reference and multi-file provenance fixtures.

### 3. Testing & Verification
* **Checks:** AT-32–34; inspect no implicit local reads or network calls.
* **Acceptance:** added input modes preserve identical graph semantics and offline capability.
* **Commit point:** commit enhanced imports and tests.

---

## [ ] Phase 16: Optional XHR compatibility adapter
*Provide a second browser transport with the same CORS boundary. **Risk:** Medium — XHR could diverge in caps or error labels. **Thinking effort:** Medium (simple model). **Depends on:** 10, 12.*

### 1. Objectives & Scope
* **In scope:** XHR only if a documented compatibility need justifies it; otherwise record this P1 feature as unshipped.
* **Done means:** if enabled, XHR returns the same validated result shape and cannot read CORS-blocked bodies.

### 2. Implementation Checklist
- [ ] Implement timeout, abort, content type and byte limits using the shared contract when enabled.
- [ ] Reuse central URL/scope validation and issue classification; do not describe XHR as a CORS workaround.
- [ ] Compare fetch and XHR results against the same allowed/denied fixture.

### 3. Testing & Verification
* **Checks:** AT-22 and AT-37 for enabled XHR; offline import remains usable when adapter fails.
* **Acceptance:** no special-case graph mutation or weaker resource bound exists.
* **Commit point:** commit only if adapter is shipped; otherwise mark the documented decision.

---

## [ ] Phase 17: Conditional cooperative iframe bridge
*Integrate only an existing target-operated public-data bridge. **Risk:** High — spoofed cross-origin messages can inject untrusted records. **Thinking effort:** Very High (advanced model). **Depends on:** 2, 12.*

### 1. Objectives & Scope
* **In scope:** documented bridge endpoint, exact origin/source/nonce/version/schema/scope checks, byte budget, timeout and framing failures. No new target-side service is built.
* **Done means:** if a compatible provider exists, only a validated public response enters acquisition evidence; otherwise mode stays disabled.

### 2. Implementation Checklist
- [ ] Document real provider protocol and embedding policy before enabling the mode.
- [ ] Create a per-request random nonce; validate `event.origin`, `event.source`, protocol version, public-only schema, length and URL scope.
- [ ] Reject malformed/spoofed messages without graph mutation; classify frame denial and timeout as unavailable.
- [ ] Test `file://` origin `null` without treating it as proof of parent identity or exposing credentials.

### 3. Testing & Verification
* **Checks:** AT-25–28 with real compatible provider or a development-only cooperative fixture; offline imports still work on failure.
* **Acceptance:** enable only after valid/invalid-message tests pass; otherwise record feature as unshipped P1.
* **Commit point:** commit validated integration and threat note only if enabled.

---

## [ ] Phase 18: Conditional allowlisted JSONP
*Consider a publisher-supported inventory endpoint only after an explicit security decision. **Risk:** High — remote provider script executes in the application page. **Thinking effort:** Very High (advanced model). **Depends on:** 2, 12.*

### 1. Objectives & Scope
* **In scope:** P2, disabled by default; no generic URL-to-script adapter. Omit if no audited trusted provider exists.
* **Done means:** an unapproved URL never loads as script; if shipped, a user deliberately opts into exactly the configured HTTPS provider.

### 2. Implementation Checklist
- [ ] Review a real provider, endpoint, callback parameter, schema and legal trust boundary; ship immutable allowlist config only after approval.
- [ ] Require per-provider affirmative opt-in and visible code-execution warning.
- [ ] Use unique callback, timeout, schema/budget checks and callback/script cleanup for every outcome.
- [ ] Verify generic URL rejection, disabled mode and optional approved-provider behavior.

### 3. Testing & Verification
* **Checks:** AT-29 always; AT-30 only if shipped. Confirm no provider script in offline/default operation.
* **Acceptance:** default remains disabled and omission does not block P0 release.
* **Commit point:** commit adapter and threat note only if an approved endpoint exists.

---

## [ ] Phase 19: Cross-browser and release gate
*Prove the shipped capability set against the specification. **Risk:** High — a hosted Pages check can conceal a broken direct-file package. **Thinking effort:** High (advanced model). **Depends on:** all shipped phases.*

### 1. Objectives & Scope
* **In scope:** release artifact, README, requirement-to-test matrix, dependency/security records, sample data, measured performance and documented manual evidence.
* **Done means:** every P0 item is evidenced; every enabled P1/P2 mode passes its checks; the package imports, graphs, inspects and exports offline under `file://`.

### 2. Implementation Checklist
- [ ] Map FR-001–065 and NFR-001–029 to tests/manual evidence and state unshipped conditional features plainly.
- [ ] Run AT-01–37 as applicable, including file launch in Chrome/Edge/Firefox, CORS allowed/denied fixtures, no-network imports/exports, keyboard use, caps, CSV injection and traffic inspection.
- [ ] Record 50-page duration and 250-node/1,000-edge responsiveness against proposed targets; identify browser/device and exceptions.
- [ ] Review bundled dependency versions, licenses, exact source/SRI if CDN enabled, export schema, threat model, and README CORS limits.
- [ ] Verify no backend/proxy/telemetry, no remote script from imported data, and no false completeness or unrestricted-crawl claim.

### 3. Testing & Verification
* **Checks:** all P0 acceptance rows in §10, especially AT-16–19, AT-22–24, AT-35–37; AT-25–30 only for enabled optional modes.
* **Acceptance:** clean local package passes required checks in all three desktop browsers with documented evidence and no P0 gap.
* **Commit point:** commit only release docs/evidence/fixes needed to clear the gate.

---

## Deferred Items And Explicit Non-Goals
* **Out of scope:** backend, proxy, hosted crawler, browser extension, arbitrary cross-origin HTML access, authentication crawling, CAPTCHA bypass, cloud history/sharing, and unstated live coverage. The browser security boundary in Version 3.0 remains binding.
* **Dependency-gated:** P1 iframe bridge requires an existing compatible target endpoint; P2 JSONP requires a real trusted JSONP provider and explicit approval. XHR ships only for a justified compatibility need. Disabled modes remain visible as unavailable where appropriate.
* **Chosen values:** default depth 2 and pages 50 come from FR-002. Proposed selectable ranges and final resource budgets must be fixed in `js/config.js` and tested before live discovery; do not silently turn proposed values into asserted product facts.
* **Discovered along the way:** log out-of-scope findings here with a separate follow-up, without expanding a current phase.
* **Plan maintenance:** if implementation deviates, record the decision, affected requirement IDs and verification in the same phase commit.

## Completion Checklist
- [ ] Every shipped phase's tasks and acceptance criteria are complete; deferred P1/P2 decisions are recorded.
- [ ] Requirement-to-test matrix covers FR-001–065 and NFR-001–029, with passing P0 evidence.
- [ ] Offline `file://` import, graph inspection and PNG/CSV export pass in Chrome, Edge and Firefox.
- [ ] CORS-allowed/denied, robots, bounds, injection, provenance, cancellation and accessible-list checks pass.
- [ ] Dependency inventory, sample fixtures, export schemas, README, threat notes and release evidence match the final build.
- [ ] Deviations are accurate; Status is marked complete with the final green commit.
