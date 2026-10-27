# Guidance for coding agents

## Chromium browser-check fallback

If Chromium browser checks fail to start, recall the workaround used for sitemap-visualizer Phase 15: Playwright's browser download returned HTML instead of a valid ZIP, so we installed the cached package with `npm install --offline --prefix /tmp/phase15-browser-offline --no-package-lock --no-save @sparticuz/chromium@133.0.0`. Its automatic extraction then failed on a filesystem `chown` operation. We bypassed that extraction by using Node's `zlib.brotliDecompressSync` to decompress the package's `bin/chromium.br` into `/tmp/phase15-chromium`, then made the binary executable with `chmod 755`. We ran the existing Playwright checks with `CHROMIUM_EXECUTABLE_PATH=/tmp/phase15-chromium`, using launch arguments `--no-sandbox` and `--disable-dev-shm-usage`. Chromium 133.0.6943.0 successfully completed all seven browser checks. These temporary paths and cached packages may need to be recreated in a future session; no browser binary or additional dependency was added to the application.

Use an existing working browser first. This fallback depends on the package being cached; it is a record of a successful workaround, not a guarantee of future availability. Keep browser packages and extracted binaries outside the repository and do not change the application's dependencies just to run browser checks.
