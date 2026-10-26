# Phase 6: graph construction and depth

`js/graph.js` exposes `SitemapGraph.buildGraph(run, imports)` as a local classic script, and exports the same API for Node development tests. It performs no file reading, DOM work, network requests, rendering, or persistent storage. Input controls and graph rendering belong to Phases 7–8.

Pass a run from `SitemapContracts.createRun` and an array of successful CSV, HTML, or XML adapter outputs. The graph accepts mixed import sources without changing their provenance. `SitemapContracts.isValidatedResult` checks the shared validator's private identity registry; a copied or forged acquisition wrapper is rejected. Parsed records are internal adapter output, not an API for arbitrary user JSON. Their URLs, evidence class, input reference, and transport are checked again against the validated acquisitions. This validation does not independently verify assertions in a CSV or authenticate the website origin of saved HTML.

The returned immutable snapshot contains:

| Field | Meaning |
| --- | --- |
| `rootUrl`, `effectiveRoot` | Declared normalized root and included matching node, or null when unknown/absent |
| `nodes` | Normalized URL as stable `id`/`url`, available title, depth, distinct degrees, evidence classes and evidence references |
| `edges` | One directed source/target pair, with all distinct evidence references; stable ID is the JSON-encoded URL pair |
| `memberships` | Separate sitemap URL membership, source sitemap, lastmod and evidence; never hyperlink edges |
| `redirectAliases` | Separate requested/final URL pairs from observable validated response metadata; no invented edge, identity merge, or hidden redirect history |
| `acquisitions` | Source metadata, coverage status, byte counts, collection timestamps, issues, and unknown redirect history |
| `exclusions` | Excluded node/edge IDs and explicit scope, depth, page or endpoint reasons |
| `issues`, `partial`, `truncated` | Acquisition/graph warnings and known limitations; scope exclusions and missing roots carry coverage warnings |
| `maxPages`, `maxDepth`, `bytesRead` | Effective graph limits and total accepted acquisition bytes |

Evidence retains acquisition ID, transport, filename/input reference, evidence class, coverage status, and available row/anchor/source URL. Repeated identical references collapse; different rows, anchors, or input sources survive. Reusing the same validated acquisition does not charge its bytes twice. HTTP status remains null and `fetched` remains false for imported nodes. Endpoint discovery does not imply a fetched page. Titles remain plain strings for later text-only rendering.

Node identity follows the shared URL normalizer. Edge identity is the normalized directed pair, including self-links. Degrees count distinct included neighbors; a self-link contributes one to each degree. Only `observed-html` and `imported-link` claims from the currently implemented adapters create edges. Future provider classes require their own validated integration before graph support is added.

Depth uses BFS over explicit hyperlinks and asserted CSV links, starting at the declared root only if a record establishes that node. Duplicate links, cycles, cross-links, and URL folders do not inflate distance. A sitemap-only node without a route has null depth and `unreachableInObservedGraph: true`. This flag describes the available graph, not proof that a website page is unreachable. No declared root, or a declared root absent from the records, leaves all depths null and reports an issue; the graph never creates a root record to conceal missing data. A declared inventory root can have depth zero without inventing outbound links.

With a root, internal scope uses the contract's exact-hostname rule. Without a root there is no selected host scope; valid imported endpoints survive until root selection. Excluded external links remain metadata rather than graph edges.

Limits apply deterministically: BFS first calculates shortest known routes; nodes beyond the depth cap are excluded. Among remaining nodes, reachable nodes precede unknown-depth inventory/components, sorted by distance then canonical URL. Page-cap selection uses that order, including the root first. This preserves the shortest route to every included reachable node. Edges survive only when both endpoints are included; degrees are recalculated afterward. Unknown-depth inventory/components remain eligible because a missing observed route does not establish a depth beyond the cap. A cap does not turn an excluded endpoint into an analyzed node. Sitemap membership survives only for included nodes.

The shared hard limits also bound combined acquisition bytes and parsed graph records. Each supplied page, unique adapter link claim, or membership consumes one record slot before graph deduplication; repeated batches therefore cannot evade the record bound. Aliases and acquisition metadata remain separate from capped graph nodes. Upstream truncation, partial status, and adapter issues propagate even when all surviving graph records fit.

`npm test` covers exact four-page nodes/edges/degrees/depths; integrated HTML/CSV/XML provenance; sitemap-only inventory; normalization/fragments; duplicate evidence; cycles and self-links; shortest cross-links; disconnected components; missing roots; page/depth/record/aggregate-byte caps; scope and spoofed provenance rejection; redirect separation; immutable snapshots; and classic-script loading. The 30-page chain fixture verifies both cap boundaries and depth-four truncation. These are graph/data checks for AT-03–07, AT-21, and AT-34; interactive and live-browser acceptance remains with later phases.
