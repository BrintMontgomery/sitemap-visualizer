# Local PNG and CSV exports

After a complete or partial analysis with at least one included page, use Download PNG, Download pages CSV or Download links CSV. All assets, serialization, rasterization and downloads work locally under `file://`; no server, CDN, upload or installed spreadsheet is required. Export failure leaves the analysis available and offers retry/CSV guidance. Reset or replacement invalidates an unfinished export so it cannot download an old run.

## PNG

PNG is 1,000 pixels wide with a 700-pixel graph viewport and a variable-height white footer. It preserves the current pan/zoom, node positions, pins, selection, colors, arrows and labels. Content outside that viewport remains outside the exported view; use Fit to view first to include it. The footer contains the depth legend, run ID, start time, mode, outcome, state, partial/truncation flags, page/link/exclusion counts, effective limits and coverage/evidence qualifiers. Phase 14 adds weak component counts, observed HTML link counts, candidate counts, depth distribution and the candidate qualification; current direction highlights are preserved. Unknown depth is gray and dashed. A completed bounded attempt does not establish full-site coverage.

`SitemapExports.svgSnapshot(svg, graph, report)` clones the existing native renderer, retains transforms and internal marker references, and inlines a fixed set of presentation properties. It adds native SVG text and shapes for the footer, with no foreignObject, remote font, image or imported active markup. `png` rasterizes the local SVG Blob through Image and canvas to a PNG Blob. Decoder errors, missing canvas, encoding failure and a ten-second timeout reject with guidance. The intermediate SVG URL is revoked on success or failure.

## CSV format

CSV uses UTF-8 with BOM, comma separators, CRLF records and double quotes around every field. Embedded quotes are doubled; Unicode and embedded newlines are preserved. Null/unknown values are empty fields; numeric zero stays `0`, and booleans are `true`/`false`. JSON columns encode arrays or objects inside a quoted CSV field. Unknown depth must never be interpreted as zero.

Every row begins with these shared columns:

| Column | Meaning |
|---|---|
| record_type | `data` for a page/link; `metadata` only for an empty link export |
| run_id | Session run identifier; not a globally unique archive identifier |
| started_at | Analysis start time in ISO 8601 |
| mode, outcome, state | Acquisition mode and qualified terminal outcome/state |
| partial, truncated | Whether included evidence is partial, and whether a limit truncated work |
| coverage | Scope and source qualifier, including no full-site proof |
| limits_json | Effective page, depth, duration, concurrency and byte/record limits; request timeout when applicable |
| exclusions_json | Counts of excluded records by reason (not necessarily unique pages) |
| metrics_json | Included page/link/observed-HTML-link/component/candidate counts, degree/depth distributions and candidate qualification (see `metrics.md`) |
| duration_ms, failed_requests | Run duration and failed request count, matching the outcome report |

Pages CSV appends:

| Column | Meaning |
|---|---|
| page_id, url | Canonical URL identifier and page URL, identical to the graph |
| title | Extracted title when available |
| depth | Minimum directed link distance from the selected root; empty means unknown |
| in_degree, out_degree | Distinct included incoming/outgoing links |
| fetched, http_status | Whether this page was fetched and its observed status; empty status means unknown |
| evidence_classes_json | Distinct graph evidence classes, including `sitemap-only` inventory |
| evidence_json | Acquisition IDs, transport, input reference, evidence class, coverage status and available row/anchor/source references |
| memberships_json | Independent sitemap memberships, source sitemap, lastmod and evidence; never hyperlinks |
| component_id | Deterministic weak component identifier scoped to this included graph |
| observed_html_in_degree, observed_html_out_degree | Distinct included links carrying observed HTML evidence, including saved HTML; CSV assertions excluded |
| sitemap_member | Independent sitemap membership exists |
| orphan_candidate | Sitemap member, zero observed HTML inbound links and not the selected root; qualified candidate only |

Links CSV appends:

| Column | Meaning |
|---|---|
| link_id | Graph ID: JSON array containing canonical source and target URLs |
| source_id, target_id | Page identifiers defining the directed link |
| source_depth, target_depth | Included endpoint depths; empty means unknown |
| evidence_classes_json | Distinct classes for this link |
| evidence_json | All retained acquisition/source/row/anchor references |

`observed-html` means extracted from readable HTML (including a selected saved file). `imported-link` means a supplied assertion, not independent verification. XML membership and redirect aliases never become links. An inventory-only graph produces a links CSV with the schema and one explicit `metadata` row; its link fields are empty. Consumers must filter `record_type=data` when counting links. IDs remain stable across equivalent graphs; acquisition IDs and run IDs are scoped to each run.

## Spreadsheet and download safety

All columns pass through the same encoder. A cell beginning with `=`, `+`, `-` or `@`, including after whitespace/control characters, receives a leading apostrophe. Leading tab, CR and LF also trigger neutralization. This applies to titles, filenames and metadata as well as URLs. The apostrophe is an intentional export-only alteration; graph data is unchanged. This is a report format, not the two-column CSV import format.

Downloaded evidence includes original canonical URLs and supplied input references. These may contain queries or other sensitive source data; report redaction does not anonymize graph exports. Run coverage/limits come from the qualified report. PNG labels follow the current displayed graph. Review downloads before sharing.

Names use fixed `sitemap-{png|pages|links}-` prefixes and a bounded run ID restricted to ASCII letters, digits, underscores and hyphens. A temporary download anchor is removed after clicking; its Blob URL is revoked after one second to allow the browser to consume it. No exported content becomes a filename path.

## Interface and verification

The locally loaded classic script exposes immutable `SitemapExports.schemas`, `available`, `csv`, `svgSnapshot`, `png`, `download`, `cell` and `filename`. CSV/PNG require a nonempty graph and a complete/partial report. The run controller owns enabling buttons and rejecting stale exports. Serialization does not change graph evidence or layout.

- `npm test`: all 115 unit/integration/smoke tests pass, including eight export regressions for schemas, IDs, provenance, unknown depths, inventory-only output, quoted/multiline/Unicode values, formula variants, partiality, filename safety, SVG transforms/styles, URL cleanup, and decoder/canvas/encoding/timeout/setup failures.
- `tests/exports-browser-check.cjs`: Chromium 133.0.6943.0, `file://`, real complete/partial PNG and CSV downloads, dragged/pinned positions and zoom, malicious title fixture, inventory metadata, encoder failure, reset during export, all Blob URLs revoked, and zero remote requests.
- Existing hostile-HTML, graph interaction, keyboard/details and live-fetch/discovery browser checks pass unchanged.
- CSV values round-trip through Python's independent CSV reader. PNG was visually inspected for graph colors, arrows, current positions, legend and readable coverage footer. Excel/LibreOffice UI behavior and Edge/Firefox acceptance remain part of Phase 19; no claim is made that those applications were run here.

Development-only browser invocation:

```sh
NODE_PATH="$CODEX_PRIMARY_RUNTIME_NODE_MODULES" CHROMIUM_EXECUTABLE_PATH=/path/to/chromium node tests/exports-browser-check.cjs
```

Phase 14 verification: all 123 unit/integration/smoke tests pass. Metrics match CSV fields through Python CSV parsing; the Chromium export check passes with metrics in the PNG footer and CSV metadata. The updated PNG footer was visually inspected. CSV consumers should read headers by name; Phase 14 adds shared and per-page columns.
