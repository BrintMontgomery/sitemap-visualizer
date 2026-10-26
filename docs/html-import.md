# Local HTML import — Phase 5

`js/html-import.js` exposes `SitemapHtmlImport.importFile(file, run, sourceUrl)` as a local classic script and a Node export. The run must use `html-import`. The selected filename must end in `.html` or `.htm` (case insensitive). Supply a public HTTP(S) URL from the user or an explicitly trusted mapping; a filename, run root, embedded base tag, and file:// application location are never used to guess it.

The adapter returns `{ok, acquisition, page, claims, issues, truncated}` or `{ok:false, issue}`. `page` contains the normalized URL and title. Claims contain normalized source/target URLs, `observed-html`, and per-anchor evidence (filename, declared source URL, one-based anchor ordinal). Duplicate targets retain each anchor's evidence. Acquisition records pass the shared validator and cannot claim HTTP status or network observation. Imported observation describes the selected file, not independent verification of the current website. No graph or persistent state is mutated.

## Isolation decision

Phase 5 uses native `HTMLTemplateElement.innerHTML` and reads its inert `content` fragment rather than passing original markup to a detached DOMParser HTML document. Template contents have an inert owner document without a browsing context. No parsed node is ever appended, adopted, or cloned into the application. Only text and raw anchor attributes leave this boundary. Scripts, handlers, images, frames, CSS imports, media, refresh tags and custom elements remain inactive. This is the inert-data equivalent permitted by NFR-004; it deliberately replaces the plan's DOMParser implementation detail to meet AT-31's no-resource-load condition. XML parsing is unchanged.

References: https://html.spec.whatwg.org/multipage/scripting.html#the-template-element and https://web.dev/articles/webcomponents-template.

Only document `a[href]` elements are extracted. Nested template content is excluded. HTML syntax recovery follows the browser's template fragment parser; syntactically imperfect HTML is not rejected merely for lacking closing tags. Empty pages yield no claims. Titles are returned as text. Consumers must use textContent to display all fields. Never insert the acquisition payload as HTML.

The explicit source URL also supplies the link resolution base. Embedded `<base href>` is ignored and produces a partial-result issue asking for the intended base explicitly. If a saved document used a different base, supply that intended resolution URL; this version has one URL for both source identity and resolution. Do not silently interpret the file's base as trusted metadata.

File-declared and actual UTF-8 size are both bounded at 2,000,000 bytes, including before reading oversized selected files. The extraction tree is bounded at 20,000 elements and depth 64; exceeding either rejects the whole input without claims. Up to 10,000 anchors are inspected, with partiality reported for the remainder. Inert nested template trees are not traversed; their input still falls within the byte limit. Elapsed time is checked after reading and at shared validation. Browser parsing is synchronous and cannot be interrupted mid-call; the byte cap bounds its input. Page/depth graph limits remain Phase 6 work.

## Development verification

Run `npm ci` and `npm test`. jsdom is development-only, with a resource trap and script execution enabled in the test host to verify that template content remains inactive. The suite covers relative URLs, entities, duplicates, unsafe URLs, provenance, absent source, file/read/parser errors, empty/recoverable HTML, and generated oversized/element/nesting/anchor limit inputs. It does not substitute for a real browser.

Open `tests/html-import-browser.html` directly under file://. In Developer Tools → Network, clear the log, select `sample-data/hostile-page.html`, and click Import. Expect one claim to `https://example.test/safe`, no remote requests, no new content in the host, and no `globalThis.phase5Executed` flag. The result displays the ignored-base and unsafe-link issues. This is a development harness; application input controls remain in Phase 7.

Optional automated browser check: install Playwright separately (`npm install --no-save --package-lock=false playwright@1.62.1`), install its Chromium (`npx playwright install chromium`), then run `node tests/html-import-browser-check.cjs`. Set `CHROMIUM_EXECUTABLE_PATH` to use an existing Chromium. The runner blocks external traffic while counting attempted requests; its positive control proves the observer detects a deliberately attempted fetch after checking that import caused zero requests.

Verified on 26 October 2026 under file:// with headless Chromium 133.0.6943.0 via Playwright 1.62.1: hostile import passed, zero HTTP(S) requests during import, no imported script execution, extraction and bounds passed, and network-observer positive control passed. Browser binaries were used only for development. Chrome/Edge/Firefox release coverage remains Phase 19 work.
