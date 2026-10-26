# Sitemap Visualizer

A browser-only sitemap visualizer, developed in small, testable phases.

## Open the application

Open `index.html` directly in Chrome, Edge, or Firefox. This phase provides the static application shell and empty state. It requires no local server, application backend, installation, account, or network connection at startup.

Import, analysis, graph interaction, and export features will be added in later phases.

## Development checks

The app itself has no runtime dependency installation. To run the development smoke tests, install Node.js 18 or later and run:

```sh
npm ci
npm test
```

The tests use Node's built-in test runner and the development-only jsdom package for HTML extraction checks. See `docs/html-import.md` for the separate browser check. They do not start a server or make network requests.

## Project files

- `index.html` — direct-file application entry point
- `css/styles.css` — local interface styles
- `js/app.bundle.js` — deferred classic-script entry point
- `sample-data/` — offline fixtures for later import phases
- `THIRD_PARTY_NOTICES.md` — runtime dependency and CDN policy
