# Phase 10: bounded internal-network and CORS acquisition

## Delivery and boundary

Choose **Live page** and enter the intended HTTP(S) page URL. The adapter retrieves that page, parses readable HTML through the existing inert template parser, and maps its observed links. It does not request linked targets, scan address ranges, fetch robots policy, or traverse sitemaps. Automatic multi-page and sitemap traversal belong to Phase 11. XML can be acquired as a bounded, validated `sitemap-only` payload through the adapter API; the live-page UI accepts HTML, and directs XML users to the existing local import mode. CSV/XML/saved-HTML imports remain offline and available after live failures.

The revised Phase 10 in commit `a11583d` supersedes the original explicit private/loopback exclusion in the Phase 2 contract, FR-062 and NFR-001. HTTP(S) intranet names, `.local`, IPv4 private/link-local/loopback literals and IPv6 literals can now be selected as roots or appear in imported records. Unsupported schemes and embedded credentials remain rejected. This is a deliberate plan-authorized policy change, not evidence that the browser will grant access. Exact normalized root-host scope still excludes other hostnames/IPs and subdomains; there is no implicit subnet expansion. Scope treats HTTP/HTTPS and ports on that host as before. No DNS-resolution or unseen-redirect control is claimed.

CORS, mixed-content restrictions and browser local-network permissions remain in force. A failure is never bypassed by `no-cors`, a relay, an executable script, an iframe, custom identity headers or an automatic alternate transport. A browser `TypeError` does not identify its cause: `NETWORK_OR_POLICY_FAILURE` explicitly leaves CORS/network/policy attribution unknown.

## Interface

`js/fetch-adapter.js` is a local deferred classic script after contracts. It exposes `SitemapFetch`; Node tests can require the same module.

```javascript
const session = SitemapFetch.createSession(run, { requestTimeoutMs: 5000 });
try {
  const fetched = await session.request(run.rootUrl, { signal });
  if (fetched.ok) {
    const parsed = SitemapHtmlImport.fromAcquisition(run, fetched.acquisition);
    // Only a successful parsed batch goes to SitemapGraph.buildGraph(run, [parsed]).
  }
} finally {
  session.close();
}
```

`run` is created by `SitemapContracts.createRun({mode: 'live-cors', rootUrl, maxPages, maxDepth})`. A session accepts explicit requests only, queues them FIFO, and releases a failed request's slot. The optional `fetch` function is a dependency-injection seam for deterministic tests; the UI uses native browser fetch. Request timeout is configurable from 1 to 10,000 ms, with a 10,000 ms default. Invalid timeouts are rejected before network work.

Each request resolves to `{ok:true, acquisition, attempt}` or `{ok:false, issue, attempt}`. Failure is data; it supplies no validated acquisition or partial body. The frozen attempt records transport, requested URL/origin, observable final URL/status, start time, duration, raw streamed byte count, content/evidence kind if known, and issue codes. Unknown status/final URL and redirect history are null. Queued requests cancelled before dispatch have no response metadata. Execution duration excludes queue wait. Diagnostics remain in session memory; the UI retains its current attempt on `run-form.attempt`, and the graph retains successful acquisition timing and metadata.

Successful HTML results use `observed-html`; successful XML payloads use `sitemap-only`. `fromAcquisition` requires a validated live HTML result and revalidates after inert parsing, retaining structural/anchor issues and partiality. Relative links use the observable final page URL. Imported/live markup never enters the application document. Embedded base elements remain ignored with an issue. An exposed redirect is an alias, never a hyperlink or proof of the hidden redirect path. Only the acquired page gets a fetched flag and HTTP status; a link target has neither unless separately acquired. A redirect can leave the selected root absent and graph depths unknown; no artificial root edge is added.

## Bounds and failures

- Requests are ordinary GETs using `mode: 'cors'`, `credentials: 'omit'`, `redirect: 'follow'`, `referrerPolicy: 'no-referrer'` and an AbortSignal. No custom headers are sent.
- Only `basic`/`cors` readable responses, exposed 2xx status, and in-scope normalized final URLs are accepted. Opaque, opaque-redirect, error and other non-readable response types supply no content evidence.
- Readable Content-Type must be `text/html`, `application/xhtml+xml`, `application/xml` or `text/xml`. Explicit charset must be UTF-8/UTF8/US-ASCII; invalid UTF-8 is rejected. Missing/unsupported types or unavailable streaming fail closed.
- Content-Length permits early rejection; the actual stream is still counted, including when length is absent or misleading. Limits are 2,000,000 decoded body bytes per resource and 10,000,000 per session, with no unbounded `text()` fallback. Rejected stream bytes count toward the session total. A browser-delivered chunk can cross a cap; it is counted, cancelled and never parsed.
- Sessions allow at most two active requests, at least one second between starts on the normalized host, no more explicit requests than `run.maxPages`, and a fixed 30-second lifetime. Failed attempts consume request slots and bytes already received. The selected graph's page/depth caps also apply independently.
- Per-request abort races both headers and body reading, so an unresponsive endpoint cannot hold a slot indefinitely. Late responses after cancellation cannot add bytes or evidence. Session close cancels active and queued work, removes listeners, and clears scheduling timers. The UI also discards superseded results.
- HTTP failures report `HTTP_ERROR` with exposed status. Bounds, unsupported content, unknown network/policy failures, timeouts, cancellation and observable scope failures use separate existing issue codes. Every outcome is terminal. Browser-followed hidden redirect hops/counts remain unknown; the application can reject an exposed out-of-scope final destination only after the browser has contacted it.

## Verification recorded 26 October 2026

`npm test`: **69 tests pass**, including 15 focused fetch/parser/graph regressions. Deterministic fixture coverage includes internal IPv4/IPv6/hostname roots, denied/opaque responses, HTTP errors, same-host and excluded redirects, raw byte limits, total bytes, split/malformed UTF-8, unsupported types, request/header/body timeouts, active/queued cancellation, late responses, 40-request bursts, two-slot concurrency, one-second host spacing, run expiry, inert hostile HTML, provenance and unfetched targets. Existing input/graph/detail tests also pass.

The optional `tests/fetch-adapter-browser-check.cjs` starts a development-only loopback HTTP fixture and opens the application under `file://`. Chromium **133.0.6943.0** passed actual CORS-authorized/denied requests, a real opaque-response rejection, loopback retrieval, redirect handling, HTTP error, streamed oversize, timeout, cancellation, replacement, and offline-import recovery. The fixture observes GET-only traffic, no cookies/referrer, no imported script execution or asset loads, no automatic target traversal, no startup HTTP request, and zero page errors. No browser CORS/security bypass flags are used. This is evidence for that browser version; current-browser and Edge/Firefox release checks remain Phase 19.

All three existing Chromium browser checks also pass: hostile local HTML extraction/bounds with zero remote requests; graph pointer/layout and 250-node/1,000-edge checks; accessible list/details, keyboard navigation and 320/768px reflow with zero automatic remote requests.

The Phase 10 portions of AT-22–24 and AT-37 are covered. Multi-page traversal portions of AT-37 remain Phase 11; robots-policy behavior is outside this phase. Provider modes remain disabled.

To rerun with separately installed Playwright and Chromium:

```sh
npm ci
npm test
NODE_PATH=/path/to/playwright/node_modules CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/fetch-adapter-browser-check.cjs
```

No browser test dependency, fixture server or installation step is shipped as a runtime requirement.
