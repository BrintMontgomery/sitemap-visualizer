# Phase 11: bounded live discovery

Select **Live discovery**, enter an HTTP(S) root, and choose page, depth, concurrency, timeout and duration limits. The static application still opens directly from `file://`. Imports need no network. Live requests use the existing credential-free CORS adapter; no proxy, backend, remote script or security-disabling browser flag is used by the application.

## Interface and scheduling

`SitemapDiscovery.discover(run, { signal, requestTimeoutMs, onProgress })` accepts a `SitemapContracts.createRun({ mode: "live-cors", ... })` run. Its CommonJS equivalent is `require("./js/discovery").discover`. A development-only `fetch` override permits deterministic transport tests.

The result is `{ ok, batches, attempts, attempt, issues, progress, truncated }`. `batches` contains validated HTML/XML parser output for `SitemapGraph.buildGraph(run, batches)`. `attempt` is the initial root attempt; `attempts` records all completed attempts, including failures. If no resource can be parsed, the result has `ok: false`, a diagnostic `issue`, and no graph batches. Every outcome closes the fetch session. Cancellation uses `AbortSignal`; the UI suppresses updates and results from cancelled or replaced runs.

The engine processes HTML links in breadth-first waves. It fetches a bounded chunk concurrently, then parses that chunk in request order so response timing cannot select different records at a cap. Normalized URLs and observable redirect destinations are visited once; duplicate anchors retain their evidence. Cycles terminate. Redirect aliases remain separate from hyperlink edges, and relative links resolve from the observable final URL. As before, a redirected root absent from the observed link graph leaves depth unknown rather than inventing a redirect hyperlink.

Sitemap seeds are the origin's conventional `/sitemap.xml`, a direct XML root, and inert HTML `<link rel="sitemap" href="…">` directives. Nested `sitemapindex` references expand within independent bounds. The conventional location's HTTP 404 is logged as absence without making an otherwise successful run partial. An explicitly declared sitemap failure does make coverage partial. Other failures keep their diagnostic codes and unknown metadata.

Root-reachable HTML waves take priority, followed by sitemap expansion and then inventory seeds. Sitemap inventory pages may be fetched and their actual HTML links observed. Each inventory seed receives a traversal budget starting at zero, but this scheduling value is **never** used as graph click depth. Graph depth is still BFS over actual hyperlink evidence from the selected root; unconnected inventory remains null. Source sitemap, lastmod and acquisition provenance survive without fabricated sitemap-to-page edges.

## Effective budgets

| Control | Default | Allowed / fixed ceiling |
|---|---:|---:|
| Included pages and HTML-target request attempts | 50 | 1–1,000 |
| HTML traversal depth | 2 | 0–20 |
| Concurrent requests | 2 | 1–8 |
| Run acquisition duration | 30 seconds | UI: 1–300 seconds |
| Per-request timeout | 10 seconds | 1–10,000 milliseconds |
| Host request-start interval | 1 second | Fixed minimum |
| Sitemap-target attempts / distinct queued sitemap URLs | — | 128 |
| Total admitted request attempts | — | Page budget + 128; maximum 1,128 |
| Body bytes per resource / network bytes per run | — | 2,000,000 / 10,000,000 |
| Aggregate retained discovery records / distinct queued HTML URLs | — | 10,000 |
| XML/HTML elements per resource / nesting | — | 20,000 / 64 |

Page request attempts include failed HTML targets. Sitemap-target attempts have a separate allowance, and a target's readable MIME determines which parser is used. The graph applies the page cap again to included node identities, including linked targets that were not fetched. Discovery records count pages, link claims, memberships and sitemap references; graph construction has its own existing record guard. These are bounded structural and byte budgets, not a measurement of JavaScript heap size. Import limits remain 250 pages and depth 4.

The first exhausted bound limits the run. A 1,000-page ceiling is not a promise to fetch 1,000 pages: host spacing, the five-minute maximum, slow endpoints, bytes, records and browser policy can stop it earlier. Per-resource oversize, HTTP failures and request timeouts preserve other readable branches. Aggregate exhaustion, cancellation and the run deadline stop further work. Existing fetch limitations on hidden redirects, DNS and in-flight network buffering remain as documented in `fetch-adapter.md`. Parsing is synchronous but structurally bounded; it is not preempted mid-DOM operation.

Progress reports completed responses, active/queued work, requested page/sitemap targets, observed links, failures, bytes, records and elapsed time. The UI presents progress, the effective limits and a text-only request log with each requested/final URL, observable HTTP status, bytes, duration and diagnostic codes. Logs and records remain in session memory. Their broader reporting/export treatment remains Phase 12–13.

## Deliberate requirement revision

The repository's revised Phase 11 explicitly requests ignoring robots restrictions. Accordingly, discovery does not fetch `robots.txt`, enforce Disallow/Crawl-delay, or honor HTML robots `nofollow` directives. The UI states this policy. No browser permission, CORS, authentication or CAPTCHA bypass is implemented. Exact root-host scope from Phase 10 remains binding; subdomains and other hosts are not traversed. Existing scope treats ports/schemes on that host as eligible.

This supersedes the original robots-policy portions of **FR-007, FR-012 and NFR-003**, and the robots-specific expectations in **FR-016, AT-12 and AT-37**. **FR-008** uses conventional/direct/HTML-declared sitemap sources rather than robots `Sitemap:` discovery. All other browser-access boundaries, rate, timeout and resource controls remain. The source specification is retained unchanged, so this decision records the discrepancy rather than claiming the original robots requirements pass. No other phase's checklist was changed.

## Verification, 26 October 2026

- `npm test`: **94 passing tests**, including 25 new discovery/control regressions. These cover directed shortest paths, cycles, duplicates, final-URL provenance, recursive/cyclic/oversize/malformed XML, scope and hostile HTML, configured concurrency and host spacing, depth/page/record/byte/time bounds, cancellation and stale UI results, failed-root sitemap recovery, unknown status, safe diagnostics and a deterministic 260-page crawl. Fake clocks and injected responses are used for unit transport tests.
- `tests/fetch-adapter-browser-check.cjs`: **Chromium 133.0.6943.0**, real `file://` launch and development-only loopback HTTP fixture. CORS allowed/denied, opaque rejection, redirects, HTTP/size/time failures, cancellation/replacement, HTML traversal, recursive sitemap cycles, null inventory depth, robots ignored, depth caps, request log, offline-import recovery and zero page errors pass. Browser CORS/security enforcement remains enabled.
- The existing HTML isolation/network-observer, graph pointer/layout and page-inspection keyboard/accessibility browser checks pass in the same Chromium. Imports trigger zero automatic remote requests. The page-inspection check includes 250 nodes/1,000 edges and 320/768px reflow.

Use the browser check commands in `fetch-adapter.md`, `html-import.md`, `graph-rendering.md` and `page-inspection.md`. Playwright and Chromium are optional development tools, not shipped runtime dependencies. Chrome/Edge/Firefox release verification remains Phase 19; the recorded Chromium evidence does not establish those browsers' current-version results.
