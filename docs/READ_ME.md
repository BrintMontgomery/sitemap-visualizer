# Sitemap Visualizer

A browser-only JavaScript application for mapping site structure from local files or browser-readable live pages. It displays a directed graph, provides page and link evidence, and downloads PNG and CSV reports.

**Updated:** 26 October 2026. **Implementation status:** Phases 1–13 complete; Phase 14 is next. See [the development plan](devPlan.md) for the checklist and remaining work.

## Open the application

Download the repository ZIP from GitHub and extract it, or clone the repository. Keep the folder structure intact, then open `index.html` directly in a desktop browser using `file://`.

The application loads its core JavaScript and CSS locally. Local imports, graph interaction, inspection, and exports need no server, account, Node.js installation, CDN, or network connection. Live discovery requires network access and remains subject to browser permissions.

The hosted version is available at [GitHub Pages](https://brintmontgomery.github.io/sitemap-visualizer/). Test direct-file operation separately: a successful hosted run does not establish offline compatibility.

## Analyze data

Choose an input mode, provide its required input, set limits, and select **Analyze / New run**.

| Mode | Required input | What it establishes |
|---|---|---|
| Links CSV | One local comma-separated file with `source` and `target` headers containing absolute HTTP(S) URLs | Supplied assertions of directed hyperlinks; these are not independently verified |
| Sitemap XML | One local sitemap XML file | URL inventory and available sitemap metadata; membership does not establish hyperlinks |
| Saved HTML | One local `.html` or `.htm` file and its declared HTTP(S) source URL in **Root URL** | Links observed in that saved file, not verification of the current live page |
| Live discovery | An HTTP(S) **Root URL**; no local file | Links extracted from readable HTML and inventory from readable sitemaps within the root host and configured bounds |

For saved HTML, the declared source URL also resolves relative links. Embedded `<base>` tags are ignored and reported. Imported scripts and embedded resources remain inactive.

The current import UI selects one file. A local sitemap index can report missing referenced files; it does not automatically read neighboring files or fetch referenced sitemaps. Multi-file selection/mapping and paste input remain planned work. Live discovery can expand readable nested sitemap indexes.

### Offline example

1. Open `index.html` and select **Links CSV — asserted hyperlinks**.
2. Select [four-page-links.csv](../sample-data/four-page-links.csv).
3. Enter `https://example.test/` as **Root URL** and keep the default 50-page, depth-2 limits.
4. Select **Analyze / New run**. Expect four pages and four directed links, with the root at depth 0 and the team page at depth 2.
5. Inspect a page, adjust the layout, and download a PNG or CSV.

Try [four-page-sitemap.xml](../sample-data/four-page-sitemap.xml) in XML mode to compare inventory with link evidence, or [home-page.html](../sample-data/home-page.html) in saved HTML mode with the same root URL. The reserved `.test` host is fixture data; local imports do not contact it.

## Live discovery and limits

Live discovery follows readable HTML links and sitemap indexes within the root host. Sitemap sources include a direct XML root, the conventional `/sitemap.xml` location, and HTML sitemap directives. It ignores `robots.txt` restrictions under the current implementation policy.

| Control | Default | Current selectable range |
|---|---:|---:|
| Maximum pages, local import | 50 | 1–250 |
| Maximum depth, local import | 2 | 0–4 |
| Maximum pages, live discovery | 50 | 1–1,000 |
| Maximum traversal depth, live discovery | 2 | 0–20 |
| Concurrent live requests | 2 | 1–8 |
| Per-request timeout | 10,000 ms | 1–10,000 ms |
| Live run duration | 30 seconds | 1–300 seconds |

Fixed safeguards also bound bytes, records, sitemap requests, parsing structure, and request frequency. For example, live acquisition allows at most 2,000,000 body bytes per resource and 10,000,000 network bytes per run, with at least one second between request starts for a host. The first exhausted bound stops or truncates work; the page ceiling is not a promise to fetch that many pages. See [discovery details](discovery.md) for scheduling and all budgets.

Public, intranet, and loopback HTTP(S) hosts are accepted, but CORS, mixed-content restrictions, and local-network permissions still control access. The application has no backend or proxy and cannot read a CORS-blocked or opaque response. A generic network rejection cannot establish whether CORS, connectivity, or another policy caused it. Use a local import when live content is unreadable.

**Cancel** stops the active run and discards unfinished discovery. **Analyze / New run** replaces the previous run; **Reset** clears the current results and restores the form defaults.

## Explore the graph and evidence

- Arrows point from source pages to link targets.
- Depth is the minimum directed link distance from the chosen root. Without an established route, depth is unknown; URL path structure and sitemap membership never create a route.
- Root nodes are orange; depth 1 is green, depth 2 purple, depth 3+ red, and unknown depth gray with a dashed outline.
- Drag a node to pin it. Drag the canvas to pan. Use **Zoom in**, **Zoom out**, **Fit to view**, and **Reset layout** to adjust the view.
- Double-click a node or use **Unpin selected** to release its position.
- Select a node or use the **Included pages** table to inspect its URL, available title/status, depth, evidence, and included inbound/outbound links. Tab, Enter, and Space support graph selection.

Layout changes stay in the current run. Incoming/outgoing counts describe included links only. CSV assertions, HTML observations, and sitemap-only inventory retain their distinct evidence classes.

## Read outcomes and coverage

Results include the mode, input, effective limits, duration, included counts, exclusions, and truncation. The outcome distinguishes readable live evidence, user-supplied data, partial results, unreadable input, and unsupported modes. Local diagnostics and the live discovery request log provide details and guidance.

**Complete means the bounded attempt finished; it does not prove full-site coverage.** Blocked resources, excluded records, limits, and cancellation affect what can be concluded. XML inventory alone supplies neither hyperlinks nor proof that pages are orphans.

Diagnostics and request-log URLs redact credentials, queries, and fragments. Original URLs and evidence remain in session memory for analysis. See [outcome reporting](outcome-reporting.md).

## Download results

Exports become available after a complete or partial analysis containing at least one included page.

| Download | Contents |
|---|---|
| PNG | Current graph viewport, colors, positions, pins, pan/zoom, selection, depth legend, and coverage footer |
| Pages CSV | Stable graph IDs, URLs, titles, known/unknown depths, included degrees, fetched/status fields, evidence, and sitemap memberships |
| Links CSV | Directed source/target IDs, endpoint depths, and retained link evidence |

Use **Fit to view** before exporting PNG if you want all nodes inside the captured viewport. CSV exports carry run metadata and coverage qualifiers. Empty depth fields mean unknown, not zero. An inventory-only links CSV has a metadata row and no link data rows.

CSV fields are quoted, and formula-leading values are neutralized for spreadsheet safety. Export CSVs are reports with their own schemas, not the two-column import format. Downloads can contain original URLs, query strings, and supplied evidence even though diagnostics are redacted; review them before sharing. See [export schemas and behavior](exports.md).

Files and analysis remain in session memory unless you download results. There is no built-in cloud history or telemetry.

## Development and testing workflow

The application runs without development dependencies. To run the automated suite, install Node.js 18 or later and Python 3 (used by the XML test harness), then run these commands from the repository root:

```sh
npm ci
npm test
```

The suite uses Node's test runner, development-only jsdom, and deterministic fixtures. The latest Phase 13 verification records **115 passing unit/integration/smoke tests** and five separate Chromium `file://` browser checks. Those are recorded implementation results, not a claim that every browser has passed the release gate.

Optional browser checks use Playwright and Chromium; the live-fetch check starts a development-only loopback fixture. Instructions and evidence are in [HTML import](html-import.md), [graph rendering](graph-rendering.md), [page inspection](page-inspection.md), [fetch adapter](fetch-adapter.md), and [exports](exports.md). Current Chrome, Edge, and Firefox release acceptance, spreadsheet application checks, and final performance evidence remain Phase 19 work.

### Edit through the browser

1. Open the repository in [vscode.dev](https://vscode.dev/github/BrintMontgomery/sitemap-visualizer).
2. Make or review changes in the Explorer pane.
3. Save changes with `Ctrl+S`.
4. Open **Source Control**, enter a concise commit message, and select **Commit & Push**.
5. GitHub Pages deploys from `main`; allow deployment time after a push and check the deployment status if the hosted version has not updated.
6. Test the [deployed version](https://brintmontgomery.github.io/sitemap-visualizer/) and verify direct-file behavior where relevant.

After Codex changes the repository, refresh or pull in vscode.dev. Commit and push your browser-editor changes so subsequent work uses the latest version.

## Remaining work and reference

Phase 14 metrics, connected components, qualified orphan candidates, and optional neighbor highlights are not yet shipped. Phase 15 adds paste, multi-file imports, and a separately labeled inferred hierarchy preview. XHR is conditional; cooperative iframe and JSONP modes remain disabled without suitable providers and verification. None provides arbitrary cross-origin access.

For technical details, consult [run contracts](run-contract.md), [CSV import](csv-import.md), [XML import](xml-import.md), [graph construction](graph.md), [dependency notices](../THIRD_PARTY_NOTICES.md), and [the development plan](devPlan.md).
