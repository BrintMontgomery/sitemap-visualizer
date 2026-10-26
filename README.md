# Sitemap Visualizer

A browser-only sitemap visualizer, developed in small, testable phases.

## Open the application

Open `index.html` directly in Chrome, Edge, or Firefox. Import a local links CSV, sitemap XML, or saved HTML file, then explore the graph on its white canvas. It requires no local server, application backend, installation, account, or network connection at startup.

Set a known root URL for depth colors. Drag nodes to pin them; drag the canvas to pan; use zoom, fit, unpin, and reset controls. See `docs/graph-rendering.md` for controls, evidence semantics, fixtures, and browser checks. Use Live page to retrieve one browser-readable HTML page, including an intranet or loopback URL, with a configurable timeout. CORS and browser network permissions still apply. Automatic traversal and exports remain later phases. See `docs/fetch-adapter.md` for acquisition limits, metadata and browser evidence.

## Development checks

The app itself has no runtime dependency installation. To run the development smoke tests, install Node.js 18 or later and run:

```sh
npm ci
npm test
```

The tests use Node's built-in test runner and the development-only jsdom package for HTML extraction checks. See `docs/html-import.md` for the separate browser check. The unit tests do not start a server or make network requests. The separate optional fetch browser check starts only a development loopback fixture.

## Project files

- `index.html` — direct-file application entry point
- `css/styles.css` — local interface styles
- `js/app.bundle.js` — deferred classic-script entry point
- `sample-data/` — offline import and graph fixtures
- `THIRD_PARTY_NOTICES.md` — runtime dependency and CDN policy
