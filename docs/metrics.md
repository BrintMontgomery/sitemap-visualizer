# Included graph metrics and candidate orphan pages

Phase 14 implements FR-024 and FR-027–029. All metrics refer to the included immutable graph, not an inferred whole site. Page count, rendered edge count, duration, excluded record count and failed request count appear with the existing coverage warning. Excluded records can include both nodes and edges; failed requests are not necessarily unique failed pages.

## Definitions

- Components are **weakly connected**: each included explicit link connects its endpoints for component membership regardless of direction. Isolated inventory pages each form a component. Redirect aliases, sitemap membership and URL hierarchy add no links. Component IDs follow sorted canonical page IDs and are stable for an equivalent included graph; they are not persistent identifiers across changed runs.
- Inbound/outbound degree distributions count distinct included directed edges, including supplied CSV assertions. A self-link counts once in each direction; reciprocal links are distinct. Multiple evidence references do not increase degree.
- Observed HTML degrees count only included links with at least one `observed-html` evidence reference. This includes readable live HTML and user-selected saved HTML; it does not imply live verification of a saved file. CSV assertions remain distinct and are excluded from observed counts.
- Depth uses the graph's minimum directed root distance over its explicit observed/asserted links. Null stays **Unknown**. No membership, alias or hierarchy is converted into click depth.
- A **candidate orphan** has independent sitemap membership, zero observed HTML inbound links in the included corpus, and is not the selected root. Sitemap inventory is the independent discovery source currently used. Pages lacking membership are not assessed as candidates. A page with only asserted CSV incoming links can remain a candidate; its all-link and observed counts expose this distinction.

Candidates are never proof of global orphan status. Missing, blocked, unrequested or bounded content may contain incoming links. This qualification appears even for a complete local import, which establishes only the supplied corpus. A sitemap-only import can flag all non-root pages as candidates while establishing no hyperlinks. An empty candidate list does not prove absence of orphan pages. FR-058 hierarchy preview remains Phase 15 and is not introduced here.

## Interface and UI

`SitemapMetrics.analyze(graph)` returns a deeply frozen snapshot: per-page component/degrees/depth/membership/candidate status, component member IDs and sizes, depth and degree distributions, counts, candidate IDs and qualification. It reads validated graph output, does not mutate records or recompute acquisition, and uses iterative component traversal. Work is bounded by current graph limits (250 local pages or 1,000 live pages, 10,000 records); sorting ensures deterministic output. `summary(metrics)` returns counts, distributions and qualification for CSV metadata. `render(container, metrics, report)` renders text and semantic distribution tables alongside outcome coverage and run counts.

Selected-page details show component, observed HTML degrees and qualified candidate status. The graph's labeled native select control offers Off, Inbound, Outbound or both directions for the selected page. Highlights apply to included explicit links, including assertions; they do not add evidence, change layout/pins or count hidden links. Selection, keyboard navigation and reset update highlights. Reset, replacement, input failure and stale results cannot restore old metrics. No network, storage, dependency or runtime backend is added.

CSV exports repeat the metric summary and qualification, duration and failed request count in both schemas. Pages CSV also contains per-page component, observed HTML degrees, membership and candidate status. PNG carries component/observed-link/candidate counts, depth distribution and qualification, and preserves active highlights. See `exports.md` for exact column names and download safety.

## Verification (26 October 2026)

- `npm test`: 123 passing unit/integration/smoke tests, including eight Phase 14 regressions. Actual XML/HTML/CSV adapters feed the mixed-evidence fixture. Tests cover cycles, self/reciprocal links, disconnected inventory, deterministic components, root exclusion, unknown depth, asserted versus observed incoming links, empty/no-inventory graphs, page caps, failed-branch qualification, immutability, safe text rendering, highlights, controller replacement/failure/reset and stale results.
- CSV metric and per-page fields round-trip through Python's independent CSV reader and match calculated records. SVG/PNG footer counts and qualification match analysis.
- `tests/metrics-browser-check.cjs`: Chromium 133.0.6943.0, direct `file://`, zero remote requests or page errors. Real selected XML and CSV imports verify component and candidate counts, selected-page fields, keyboard selection, direction highlights, capped partial coverage and reset.
- Existing hostile HTML, graph interaction, keyboard/details, live fetch/discovery and export browser scripts pass. The metrics panel and exported PNG footer were visually inspected. Edge/Firefox and the full release matrix remain Phase 19.

Run the browser check with development-only Playwright and an installed Chromium:

```sh
NODE_PATH="$CODEX_PRIMARY_RUNTIME_NODE_MODULES" CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/metrics-browser-check.cjs
```

## Reverification (27 October 2026)

Reused the existing Phase 14 implementation commit `74544dc` on top of `16ce02a`, the current remote baseline. All 123 unit/integration/smoke tests pass again, and `git diff --check` is clean. The browser results above are retained evidence from 26 October, not fresh results: this session has no installed Chromium, and the Playwright browser download returned an invalid archive, preventing a new browser run. No later phase was changed.
