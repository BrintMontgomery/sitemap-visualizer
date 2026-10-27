# Phase 16: optional XHR decision

## Decision — 27 October 2026

XHR compatibility transport is **unshipped**. Phase 16 is complete through its
documented omission path. No application script, transport selector, dependency,
acquisition contract or graph behavior changes in this phase.

Phase 16 requires a documented compatibility need before enabling XHR. The current
repository records no browser/endpoint case where XHR is needed. Existing fetch
browser evidence is recorded in `fetch-adapter.md` and `enhanced-imports.md`;
it does not establish support for every browser or endpoint.

FR-045 is P1 and optional. The specification's “Optional XHR adapter (P1)” section
also permits omission where streaming byte caps are mandatory: XHR may expose
size only after browser buffering. The current fetch adapter counts streamed
bytes, rejects incomplete/oversize content and validates acquisitions before
parsing. A second transport would need independent evidence of comparable bounds.

XHR has the same CORS boundary as fetch. Neither grants access to a blocked body.
Unknown browser network/policy failures must retain their unknown cause. No
automatic XHR fallback is enabled when fetch fails or is unavailable. Local
CSV/XML/HTML and pasted inputs remain the available alternatives.

## Verification

`npm test`: **134 tests pass**, including two new UI integration regressions in
`tests/xhr-decision.test.js`. They load the actual contracts, acquisition,
discovery, import, graph, reporting and control scripts in jsdom and verify:

- Rejected fetch preserves `NETWORK_OR_POLICY_FAILURE`; absent fetch reports
  `UNSUPPORTED_CONTENT`. Neither produces a graph, readable status, final URL or
  response bytes.
- An instrumented XHR constructor is never called. The rejected-fetch case only
  makes the existing root and conventional `/sitemap.xml` discovery attempts.
- Switching to local CSV import after each failure yields the four-page,
  four-edge sample graph without additional fetch or XHR calls.

Existing fetch tests still exercise allowed/denied results, scope validation,
content types, per-resource/aggregate byte limits, timeouts and cancellation.
The existing browser fixture in `tests/fetch-adapter-browser-check.cjs` remains
available for real CORS allowed/denied and offline-recovery checks. No browser
checks were rerun for this documentation/test-only phase; earlier browser evidence
is historical. jsdom checks do not demonstrate browser CORS enforcement.

AT-22 and AT-37 apply to the shipped fetch path. XHR-specific acceptance and a
fetch/XHR fixture comparison are **not applicable**, not claimed as passing.

## Reopening criteria

Identify a browser version and endpoint that demonstrate a fetch compatibility
failure XHR could resolve without bypassing browser policy. Before shipping,
prove shared URL/scope/result validation, bounded resource use, timeout/abort
cleanup, and parity on the same allowed/denied browser fixtures. Preserve local
import recovery. This phase does not change the conditional decisions in Phases
17–18 or perform the Phase 19 release gate.
