# Phase 8: graph rendering and layout

`js/graph-renderer.js` is a locally loaded classic script using native SVG/DOM APIs. It adds no runtime library, network request, backend, worker, or installation. Open `index.html` from disk, select a local input and root URL, and analyze. The persistent legend is visible before importing.

## Interface and evidence boundary

`SitemapRenderer.create(container, graph, runId, onChange)` consumes the immutable snapshot returned by `SitemapGraph.buildGraph`. The application calls it only after validation and graph construction. The renderer never reads raw imports, constructs evidence, changes graph identities, or adds inferred edges. Sitemap memberships and redirects are not drawn as hyperlinks. Only included graph nodes and edges are rendered. Node URLs and titles enter text nodes/attributes, never HTML. Labels use the final URL path segment; the full URL and available title are in a native tooltip.

The return value exposes `fit()`, `zoom(factor)`, `pin(id, x, y)`, `unpin(id)`, `reset()`, `getLayoutState()`, and idempotent `destroy()`. The run controller retains the graph as `form.graph` and the latest immutable layout snapshot as `form.layoutState`. Each snapshot contains `run_id` and node records with `run_id`, `node_id`, `x`, `y`, and `pinned`. Pins stay in session memory for that run. Layout operations cannot mutate evidence, URLs, edges, degrees, or depths.

## Display and interaction

- Orange: depth 0 (included declared root). Green: depth 1. Purple: depth 2. Red: depth 3+. Dashed gray: null/unknown depth, including disconnected or sitemap-only inventory. The color legend remains visible.
- A white SVG canvas, thin gray arrows, larger root/hubs, and radial leaf clusters follow the supplied reference. The deterministic layout uses one temporary shortest-depth parent per node for positioning only; every actual graph edge is drawn, including cross-links, reciprocal curves and self-loops. Unknown-depth nodes occupy a separate grid and gain no inferred depth or links.
- Drag a node to pin its position. Select a pinned node and choose **Unpin selected**, or double-click it. Unpin returns it to its deterministic initial position. **Reset layout** clears all pins and restores the fitted layout.
- Drag the canvas to pan. Use wheel zoom or zoom buttons. **Fit to view** fits current positions and retains pins. SVG coordinate conversion accounts for scaling, letterboxing, responsive resizing, and the current pan/zoom.
- Enter/Space on a focused SVG node selects it for layout controls. The structured page list and evidence details remain Phase 9 work. A fit overview can have small labels, especially at 250 nodes; zoom to read them or use the full-URL tooltip.

There is no force simulation or background layout loop. One bounded traversal/sort of the capped graph produces positions; DOM creation/redrawing is linear in nodes plus edges. Dragging updates positions and paths synchronously, while pan/zoom changes one group transform. `destroy()` releases capture, unregisters listeners, removes old SVG content, and disables controls. Starting a new valid run or resetting destroys the old renderer and clears layout state. Cancelled or superseded imports cannot publish a renderer.

## Verification recorded 26 October 2026

`npm test`: all **46** unit/integration/smoke tests pass, including six new rendering tests for exact IDs, arrows/colors, unknown depths, deterministic layout, pin isolation, immutable snapshots, fit/zoom/reset, safe text, self-loops, disposal, stale imports, empty/single-node graphs, hub spacing and dense graphs. Existing import and graph checks remain green.

Optional real-browser check (requires separately installed Playwright and Chromium):

```sh
CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node tests/graph-renderer-browser-check.cjs
```

Expose the installed Playwright package through normal Node resolution or `NODE_PATH` if needed. `GRAPH_SCREENSHOT_PATH=/tmp/graph.png` optionally saves a screenshot for review. These are development tools only.

Headless Chromium **133.0.6943.0**, Linux check host, `file://` entry, 1440×1100 desktop and 768×1024 tablet-sized viewport:

- The 49-page / 50-edge reference fixture shows one orange root, eight green hubs, 38 purple leaves and two red deep nodes. Screenshot review confirmed the white canvas, radial clusters, arrows, persistent legend, node size differences and labels. Review prompted extra space around leafless hubs and shorter labels.
- Real pointer dragging/pinning, pointer cancellation, canvas pan, wheel/button zoom, fit without losing pins, unpin, reset and replacement passed. Graph snapshots remained unchanged. XML inventory creates no edges and unknown-depth imports use dashed gray nodes. No horizontal document overflow at 768 px.
- The 250-node / 1,000-edge fixture retains exact counts, finite distinct initial positions and responsive zoom/fit/pan. A recorded run took 12 ms for layout/SVG creation, 116 ms from import submission to result, and 121 ms for the zoom/fit/pan sequence. Timing is reported by the browser check, separating layout/SVG creation from total import-to-result time. These host measurements are preliminary evidence for NFR-010, not the Phase 19 release benchmark.
- Imports and interactions generated zero HTTP(S) requests and no page errors. The blocked canary request positive control confirmed that network observation was active. Imported hostile HTML executed no script.

This check covers Phase 8 portions of AT-08–09 and the proposed NFR-010 target on this host. Full details/accessibility, current Chrome/Edge/Firefox package validation and device-specific performance acceptance remain assigned to their later phases.
