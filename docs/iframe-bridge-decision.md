# Phase 17: cooperative iframe bridge decision

## Decision — 27 October 2026

The cooperative iframe bridge (`iframe-bridge`) is **unshipped**. Phase 17 is
complete through its documented omission path. No application script, markup,
transport, dependency, acquisition contract or graph behavior changes in this
phase.

FR-048 permits the transport only when an already deployed, documented
target-origin bridge supports the visualizer's message schema and may legally
be embedded. The repository identifies no such provider, protocol or embedding
policy. A normal web page is not a bridge, and the product may not build or
deploy one (NFR-019). FR-048–050, AT-25–28 and NFR-024 are P1 and conditional;
the requirements' release gate tests them only when the feature is enabled.
Omission does not block the P0 release.

The mode remains visible and disabled: the `index.html` option has no value and
reads "Iframe bridge — no compatible provider". `SitemapContracts.modes` keeps
the explanation "No compatible bridge is configured." The run controls reject
any mode outside the shipped list, and `validateResult` defines no content kind
for `iframe-bridge`. No result with `bridge-reported` evidence can be validated,
budgeted or added to a graph. No shipped script creates an iframe, registers a
`message` listener or calls `postMessage`.

## Threat boundary retained

Without a real provider there is no protocol to validate, so no partial bridge
code ships. Unused message-handling code would add attack surface and could be
mistaken for a verified integration. The page therefore accepts nothing from
`message` events. Spoofed messages, guessed nonces, origin `null` messages from
a `file://` context, and HTML strings are inert because nothing listens for
them. An origin of `null` is never treated as proof of a parent's identity.
Local CSV, XML, HTML and pasted inputs remain the alternatives.

## Verification

`npm test`: **138 tests pass**, including four new regressions in
`tests/iframe-bridge-decision.test.js`:

- A static check scans every `js/*.js` file and `index.html`: no `postMessage`,
  `message` listener, `onmessage`, iframe creation, `contentWindow`, `frames`
  access or `<iframe>` markup. The bridge option is disabled and has no value.
- `validateResult` rejects every `iframe-bridge` result across content kinds,
  evidence classes and statuses. A CSV result that claims `bridge-reported`
  evidence is rejected. The budget refuses unvalidated bridge-shaped results.
  A not-readable result keeps the `BRIDGE_UNAVAILABLE` issue code.
- Two jsdom integration tests load the actual contract, import, acquisition,
  discovery, graph, reporting, metrics, enhanced-import and control scripts. They
  select the disabled bridge option by script and, separately, after tampering
  with its value. Each run fails closed as `not-supported`, with no graph, no
  network request and import alternatives in the report. Spoofed bridge-shaped
  `MessageEvent`s from origins `null`, `file://`, empty and
  `https://bridge.example`, with and without guessed nonces, change nothing. A
  later local CSV import produces the four-page, four-edge graph, and further
  spoofed messages leave that graph and its report unchanged. No `message`
  listener is registered, no iframe is created and `fetch` is never called.

A mutation check confirmed sensitivity: adding a `message` listener that pushes
a node into the graph made three of the four new tests fail. It was reverted.

No browser checks were rerun for this documentation/test-only phase. jsdom does
not demonstrate browser framing, CSP `frame-ancestors`, `X-Frame-Options` or
cookie behavior. AT-25–28 are **not applicable**, not claimed as passing.

## Reopening criteria

Identify an existing, documented, embeddable HTTPS bridge operated by the target
origin, with a public-only data contract, message type and version, and legal
permission to embed. Before enabling the mode:

- Load the bridge URL only from explicit per-site configuration; derive the
  expected origin from it.
- Use a cryptographically random per-request nonce; accept a message only when
  `event.origin` equals the bridge origin exactly and `event.source` is that
  frame's `contentWindow`.
- Validate type, version, schema, URL scope, byte length and record count
  before any data reaches `validateResult`; tag accepted records
  `bridge-reported`, never `observed-html`.
- Record `BRIDGE_MESSAGE_REJECTED` for rejected messages without graph mutation;
  record `BRIDGE_UNAVAILABLE` for framing denial or missing bridge logic and
  `BRIDGE_TIMEOUT` on timeout; remove the frame and listener on every outcome.
- Under `file://`, accept that the bridge may reply with target origin `*`;
  require public-only payloads, disclose browser-managed frame cookies as a
  platform limitation, and never authenticate the parent by origin `null`.
- Pass AT-25–28 against the real provider or a development-only cooperative
  fixture, and keep local import recovery.

This phase does not change the conditional JSONP decision in Phase 18 or
perform the Phase 19 release gate.
