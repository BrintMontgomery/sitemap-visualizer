# Phase 9: page details and keyboard inspection

`js/page-details.js` consumes only the immutable validated graph. It loads as a local deferred classic script before the run controller, with no additional dependency, network access, or persistence.

## Interface and behavior

`SitemapDetails.create(container, graph, renderer)` builds a native table with one page button per included node. Its returned `select(id)` updates selection and metadata; `destroy()` removes listeners/content and hides the view. The renderer now accepts an optional fifth `onSelect(id)` callback and exposes `select(id)`; existing four-argument callers remain supported. A null selection clears details. Unknown IDs and disposed instances are ignored.

Focusing or activating a table button selects its graph node. Graph pointer selection, keyboard focus, Enter and Space select the same page in the table and detail panel. Selection updates `aria-pressed` in both views. Keyboard/list selection brings an off-canvas node into view without changing graph records or pins. Focus stays on the control used. Selecting an inbound/outbound inspection button moves focus to the corresponding surviving table button, because changing details replaces the old button. Reset layout clears selection; a new valid run, cancellation of a pending replacement, or full reset cannot retain obsolete details. Superseded imports cannot publish a view.

The definition list displays URL, available title, depth, recorded HTTP status, whether the application fetched the page, and included inbound/outbound counts. Missing title/status and null depth remain explicit, without implying a request succeeded. Evidence lists retain class, transport, input reference, available source URL, row/anchor and coverage status. Inbound/outbound lists use only included graph edges and retain each edge's provenance. Inventory membership never creates a hyperlink or degree. Text uses DOM `textContent`; no imported metadata becomes HTML. A separate external action accepts only HTTP(S) URLs without credentials and uses `target="_blank"`, `rel="noopener noreferrer"` and `referrerpolicy="no-referrer"`, with the new-tab behavior in its label.

## Verification, 26 October 2026

- `npm test`: **54 passing tests**, including eight new detail-view/integration regressions. They cover focus/selection synchronization, metadata/degrees, neighbor navigation and surviving focus, safe destinations/text, unknown-depth inventory and capped graphs, every page in a 250-node fixture, invalid/disposed operations, and replacement/reset/cancelled/stale results.
- `tests/page-details-browser-check.cjs`: Chromium **133.0.6943.0**, Linux, direct `file://` entry. Real Tab/Enter/Space traversal passes for CSV, XML inventory, hostile saved HTML and all 250 pages of the 1,000-edge fixture. The table and graph select the same IDs; inspection navigation preserves focus. Accessibility-tree checks find the named table, page buttons, selected-page heading and status region. New-tab security attributes pass. No page errors or HTTP(S) requests occur; a blocked canary proves traffic observation is active.
- Desktop 1440×1100, tablet 768×1024 and narrow 320×1024 checks pass. The document has no horizontal overflow; focused table controls have a visible solid outline and targets at least 24 CSS pixels high. Screenshot review confirms readable structured details, provenance, included links, table headings, and visible selection/focus.
- The existing graph browser check also passes drag/pin/unpin, pointer cancellation, pan/wheel/button zoom, fit/reset/replacement, the 250-node/1,000-edge fixture and no-network control. Selection integration preserves the Phase 8 interactions.

Run the optional browser checks with separately installed development tools:

```sh
NODE_PATH=/path/to/node_modules CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node tests/page-details-browser-check.cjs
NODE_PATH=/path/to/node_modules CHROMIUM_EXECUTABLE_PATH=/path/to/chrome node tests/graph-renderer-browser-check.cjs
```

`DETAILS_SCREENSHOT_PATH=/tmp/details.png` optionally records the inspection view. These tools and screenshots are not runtime assets.

## Focused WCAG 2.2 AA review

This is a review of Phase 9 controls, not a claim of whole-application conformance.

| Criterion | Implementation and evidence |
|---|---|
| 1.3.1 Information and relationships | Native table/caption, column and row header scopes, nested headings, definition list and link/evidence lists; DOM tests and browser accessibility tree. |
| 1.4.1 Use of color | Depths, counts and unknown values are text. Selection exposes pressed state and an underlined label/thicker border. |
| 1.4.3 Contrast (minimum), 1.4.11 Non-text contrast | New text uses #e6edf3 on #111820/#18222e; external link #79c0ff; focus/selection #58a6ff; button border #8b949e. These exceed 4.5:1 for text and 3:1 for focus/borders against their backgrounds. |
| 1.4.10 Reflow | Long URLs/evidence wrap. Browser checks show no horizontal document overflow at 320 CSS pixels; details remain in normal document flow. |
| 2.1.1 Keyboard, 2.1.2 No keyboard trap | Native page/link buttons work with Tab/Shift+Tab, Enter and Space. SVG nodes support focus/Enter/Space. Real keyboard traversal reaches every included page; no focus capture. |
| 2.4.1 Bypass blocks, 2.4.3 Focus order | Before the SVG, a skip link targets the focusable page-list heading. Normal document order reaches the table, external action and neighbor controls. Neighbor navigation focuses the selected table button. |
| 2.4.6 Headings and labels, 2.4.7 Focus visible, 2.4.11 Focus not obscured (minimum) | Named table, URL-specific inspection labels, section headings, 3-pixel table focus outlines and SVG focus strokes. No overlay or sticky region obscures focus. Browser focus/reflow checks and screenshot review. |
| 2.5.8 Target size (minimum) | Page and neighbor buttons have minimum 32px height/width and padding; the external action and skip link have padding. Small SVG circles have equivalent native page buttons. |
| 4.1.2 Name, role, value; 4.1.3 Status messages | Native buttons and SVG button roles expose names/pressed state. A polite atomic status announces URL, depth and included counts. Browser accessibility-tree and DOM checks verify labels/status markup. |

Phase 9 portions of AT-08 and AT-14 pass these checks. A human screen-reader session and current Chrome/Edge/Firefox release checks remain part of Phase 19; the accessibility tree and live-region markup checks do not establish actual speech output.
