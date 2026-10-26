# Outcome and coverage reporting

`SitemapOutcomes.create(options)` builds a report without changing graph or acquisition data. The classic script loads locally before run controls. `run-form.report` holds the latest report in session memory; Reset and replacement clear it. The report is displayed as text with a native expandable local JSON diagnostic panel. There is no upload, persistence or new export feature.

## Outcomes and terminal states

| Evidence | Outcome | Terminal state |
|---|---|---|
| Nonempty live graph without issues or exclusions | readable | complete |
| Nonempty local graph without issues or exclusions | user-supplied | complete |
| Nonempty graph with issues, exclusions or truncation | partial | partial |
| Empty graph, rejected input, or no readable response | not-readable | failed |
| Unavailable acquisition mode | not-supported | failed |
| User cancellation | not-readable (no retained graph) | cancelled |

“Complete” describes completion of a bounded attempt. Every report states that it does not prove full-site coverage. XML supplies inventory only, CSV supplies asserted links, and saved HTML establishes links in the selected file only. No outcome invents links or click depth. Cancellation immediately aborts the active request signal, reports progress counters, discards unfinished discovery and ignores its eventual completion. Cancellation does not claim retained graph evidence from requests still being processed.

The report includes input, selected root, mode, start time, duration, effective page/depth/time/concurrency/request-timeout/byte/record limits, included page/link counts, request and failure counts, bytes, exclusions by reason, queue count at stop, truncation, issue codes and request observations. Graph exclusions count excluded records, not necessarily distinct pages. Request failures include an absent optional conventional sitemap; that optional 404 alone does not make coverage partial. For validation failure before a valid run exists, effective run limits are unavailable.

## Guidance and privacy

Generic fetch rejection retains `NETWORK_OR_POLICY_FAILURE`: CORS, connectivity, browser permissions and policy are possibilities, never a diagnosed cause. HTTP status and final URL remain null when unobservable. Timeouts, opaque bodies, size limits, malformed input and cancellation have specific guidance and local-import alternatives. Legacy `ROBOTS_EXCLUDED` and `ROBOTS_UNAVAILABLE` results retain their codes, but guidance states that current live discovery ignores robots restrictions. Phase 11 policy is unchanged.

Reports and the request log strip HTTP(S) credentials, query strings and fragments, including URLs embedded in issue messages. Raw issue codes remain available. All display uses `textContent`. Diagnostics omit response bodies, headers and raw evidence. Original URLs remain in acquisition/graph session data for accurate identity and link inspection; this is report redaction, not anonymization of source data or URL paths. No diagnostic export is introduced.

## Verification

- `npm test`: 107 passing unit/integration/smoke tests, including 13 new reporting tests. Covers every outcome, empty results, no response, malformed input, legacy robots restrictions, timeouts, cancellation, limits, redaction, fallback guidance, reset and stale-run isolation.
- Development Chromium 133.0.6943.0 under `file://`: live allowed/denied requests, redirects, HTTP errors, opaque responses, byte/time/depth caps, cancellation/replacement, local-import recovery, redacted query/fragment reports and 320px diagnostics reflow.
- Existing offline hostile-HTML, graph interaction and keyboard/detail browser regressions remain passing. Cross-browser release acceptance remains Phase 19.

Development command for browser checks (using an existing compatible Chromium):

```sh
NODE_PATH="$CODEX_PRIMARY_RUNTIME_NODE_MODULES" CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/fetch-adapter-browser-check.cjs
```
