# Enhanced local imports

Phase 15 implements FR-054, FR-055 and the optional FR-058 hierarchy preview.
Everything runs from `file://` with local classic scripts, native inert parsers
and session memory. No new runtime library or network transport is added.

## Paste

Select **Paste**, choose HTML, sitemap XML or links CSV, and paste the content.
HTML requires an HTTP(S) source URL, which resolves relative anchors. XML may
have an optional sitemap source identity. CSV uses absolute source/target URLs.
The separate root field controls graph scope and directed depth; it does not
supply a missing paste source URL. Unknown roots retain unknown depth.

Paste is limited to 2,000,000 UTF-8 bytes. Character length is checked before
UTF-8 allocation; multibyte characters still count by bytes. The existing HTML,
XML and CSV parsers enforce their structural, entry and URL rules. HTML uses
inert template contents, ignores embedded bases, and never inserts imported DOM.
XML declarations/DTD restrictions and CSV row errors remain unchanged.

## Selected files and source mappings

Select up to 128 files in one operation in any local file mode. Each row has an
explicit HTML/XML/CSV content selector, initially suggested by the extension or
selected mode. Mixed selections are supported. Map each HTML file to its source
HTTP(S) URL. A first HTML file may start with the entered root as an editable
suggestion. Filenames never imply page URLs. HTML files retain the existing
`.html`/`.htm` restriction.

For XML, map selected files to their sitemap URLs. The first XML file is the
entry point. References are resolved by normalized exact URL only within the
selected XML mappings. Unreferenced XML files are not read; a missing mapping
produces a localized issue with no fetch or filesystem lookup. Duplicate sitemap
URL mappings are rejected. To import an unrelated inventory, start a separate
run with that XML as the entry point. HTML and CSV files are processed in
selection order; the reachable XML group is processed at its first position.

Limits are 2,000,000 bytes per file, 10,000,000 total bytes, 10,000 combined
accepted records and the run duration (default/ceiling 30 seconds). Declared file
sizes are checked before any reads and actual UTF-8 sizes are checked on reading.
Existing per-parser limits remain binding. A batch that would exceed the
combined record allowance is excluded as a whole with remaining work marked
partial. Earlier valid batches survive malformed/unreadable later files. The
shared graph validator independently enforces its record/page/depth/byte caps.
Cancellation and replacement discard unfinished results; queued wrapper reads
check cancellation, expiry and stopped state before touching a selected file.
An already-started native `File.text()` read cannot be interrupted.

Each accepted batch retains its original acquisition transport and evidence
class: `observed-html`, `sitemap-only`, or `imported-link`. Paste references are
named `Pasted input.html`, `.xml` or `.csv`. No paste is described as a network
observation. Filenames, source URLs, row/anchor evidence, missing references and
partiality flow into existing graph/report/export contracts. Per-file errors
appear in redacted local diagnostics. Source text stays in memory until reset
or page closure; it is not uploaded.

## Separate hierarchy preview

Enable **Show inferred URL hierarchy preview** to see nearest path ancestors
among included pages on the same URL origin. Ancestors must have no query;
paths match on slash boundaries, without decoding encoded slashes. Equal paths,
query variants of the same path, and cross-origin pages do not establish a
parent relation. Missing ancestors are never fabricated. Trailing slash variants
remain distinct page IDs. Ties use URL ordering.

The preview is a separate labeled list, not graph edges. It never mutates
`LinkEdge`, observed BFS, degrees, metrics, candidate analysis, or PNG/CSV exports.
It is off by default and clears on failure, replacement and reset. An XML-only
inventory therefore still has zero hyperlinks and null non-root click depths.

## Verification — 27 October 2026

- `npm test`: 132 passing unit/integration/smoke tests, including nine new
  enhanced-import tests covering all three paste kinds, mixed provenance,
  malformed/oversize content, missing/duplicate mappings, selection/byte/record
  limits, unreadable input, cancellation/expiry, inertness, hierarchy isolation,
  and UI replacement/failure/reset.
- Chromium 133.0.6943.0, Linux, direct `file://` launch:
  `tests/enhanced-import-browser-check.cjs` passes AT-32–34. Actual file selection,
  hostile paste, multibyte oversize rejection, mapped mixed sources, missing XML
  references, unknown inventory depth and a 390px viewport pass. Import produces
  zero remote request attempts; a separate positive control proves the network
  observer detects a deliberate request.
- All six existing Chromium browser checks pass: inert HTML, graph gestures and
  dense fixture, keyboard details, CORS/discovery/outcomes, PNG/CSV and metrics.
  The graph check now scrolls the canvas into view before pointer gestures to
  accommodate the taller import form. The narrow import/preview UI was visually
  inspected. Edge and Firefox release acceptance remains Phase 19.

Run the new optional browser check with separately installed Playwright and
Chromium (neither ships with the application):

```sh
CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/enhanced-import-browser-check.cjs
```

This session's standard Playwright download returned an HTML response instead of
a ZIP. Browser verification used cached `@sparticuz/chromium@133.0.0` development
bytes. No browser download, package change or binary is part of the app.
