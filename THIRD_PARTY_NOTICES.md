# Third-Party Runtime Notices

**Release review (Phase 19) — 27 October 2026.** First recorded in Phase 1 (26 October 2026); unchanged since.

The application ships no third-party runtime libraries or package dependencies, remote scripts, remote stylesheets, or CDN requests. The `vendor/` directory is reserved and contains no production code. Dependency versions, third-party licenses, asset hashes, and CDN subresource-integrity values are therefore not applicable to this phase.

## Selected native equivalents

| Capability | Selected implementation | Runtime dependency |
| --- | --- | --- |
| Graph display | Browser SVG and DOM APIs | None |
| CSV parsing | A bounded parser implemented in local JavaScript in the CSV import phase | None |
| Local file reading | Browser File and text APIs | None |
| Inert HTML/XML parsing | Browser DOMParser (XML) and inert HTMLTemplateElement contents (HTML) | None |

The Node.js test command is development-only. Tests use Node's built-in modules and jsdom 26.1.0 (MIT), pinned with its dependency tree in package-lock.json. jsdom and its transitive development dependencies do not ship with the browser application. Upstream: https://github.com/jsdom/jsdom. Optional browser verification uses Playwright and a separately installed Chromium; neither is loaded by the application.

## Future dependency policy

Core features must remain usable from local files with network access disabled. If a third-party package is later selected, pin its exact version, bundle and verify the production bytes locally, record its license and SHA-256 hash, and test the offline copy. Any optional HTTPS CDN fallback must use a pinned version and Subresource Integrity, load only after the local copy, and never be required for startup or core behavior. No CDN is configured. The release check confirms that all 15 scripts load from local relative paths and that an offline run makes no remote request.
