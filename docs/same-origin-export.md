# Same-origin link export helper

## Purpose

Live discovery reads a page only when its server sends a CORS header that admits
the application's origin (`null` under `file://`). Many public sites send none.
The browser then withholds the response and the run reports
`NETWORK_OR_POLICY_FAILURE`. No browser-only application can lift that
restriction; FR-040 and NFR-019 forbid relays, proxies and `no-cors` reads.

`tools/same-origin-link-export.js` offers a supported alternative. You run it
in your own browser on the site itself, where same-origin reads are permitted.
It produces a links CSV that the application imports in **Links CSV** mode. The
application never loads this file.

## Use

1. Open the site's start page, for example `https://www.oscn.net/`.
2. Open the DevTools console (F12). Paste the whole file and press Enter. Some
   browsers ask you to type `allow pasting` first.
3. Wait for the summary line. A file named `<host>-links.csv` downloads.
4. In the application choose **Links CSV**, select the file, set **Root URL**
   to the URL the summary line names and run the analysis. If the start page
   redirected (for example `/` to `/default.aspx`), that is the redirect
   target, not the address you opened.

To change limits, run this before pasting:

```js
window.SITEMAP_EXPORT_OPTIONS = { maxPages: 100, maxDepth: 3, delayMs: 1500 };
```

| Option | Default | Bounds |
|---|---|---|
| `maxPages` | 50 | 1–1,000 pages requested |
| `maxDepth` | 2 | 0–20 link steps from the start page |
| `delayMs` | 1000 | at least 250 ms between requests |
| `timeoutMs` | 10000 | per request |
| `maxBytes` | 2000000 | characters per page |
| `startUrl` | current page | must share the current origin |
| `download` | `true` | `false` returns the CSV without downloading |

## Behavior

- Breadth-first, one request at a time, with the configured delay.
- Same origin only: links to other hosts or schemes are dropped, and an
  off-site redirect is recorded as a failure.
- `credentials: "omit"`: no cookies or stored credentials are sent. Pages
  visible only when logged in are not read.
- HTML only (`text/html`, `application/xhtml+xml`). Other types and HTTP
  errors are listed as failures in a console table.
- Pages are parsed with `DOMParser`, which is inert: scripts do not run and
  resources do not load. `<base href>` is honored. Fragments are removed.
- Links found on pages at the depth limit are recorded but not followed.
- Links are recorded under each page's final URL after redirects. The summary
  reports the start page's final URL as `root`. Using the pre-redirect address
  as the application's root leaves other depths unknown, because the CSV
  records no link from it.
- Robots restrictions are not consulted, as in live discovery. Keep the
  delay and limits modest on sites you do not operate.

## Evidence semantics

Imported rows are `imported-link` assertions, not `observed-html`. The
application did not read these pages itself and labels them accordingly. Depth
is computed from the declared root over the imported links. Coverage is
bounded by the helper's limits; the console reports pages queued but not
visited.

## Verification

`tests/same-origin-link-export.test.js` (7 tests, jsdom) covers breadth-first
order, depth and page limits, `credentials: "omit"`, inert parsing (an embedded
script does not run), `<base href>`, fragment removal, off-site link and
redirect handling, non-HTML and HTTP failures, option validation, foreign start
URLs, the download path with blob release, and import of the exported CSV into
a graph with the expected depths and `imported-link` evidence. Two later tests
cover a redirected start page (the reported root yields full depths; the
pre-redirect address reproduces all-unknown depths) and an unreadable start page.

The helper was also run in Chromium against an intercepted fixture site with a
session cookie set. Its four requests carried no cookie, and the downloaded CSV
listed the fixture's five same-origin links. No live third-party site was
contacted during verification.
