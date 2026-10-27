// Development-only Phase 19 release-gate check: direct-file launch, defaults, offline
// workflow, traffic, JSONP omission and timing. No runtime dependency or CORS flags.
const { chromium } = require('playwright');
const http = require('node:http');
const assert = require('node:assert/strict');
const path = require('node:path');
const fs = require('node:fs');
const os = require('node:os');
const { pathToFileURL } = require('node:url');
// SITEMAP_APP_DIR points the check at a clean copy of the shipped files.
const root = path.resolve(process.env.SITEMAP_APP_DIR || path.join(__dirname, '..'));
const appUrl = pathToFileURL(path.join(root, 'index.html')).href;

// A 50-page CORS-readable site: root -> 7 sections -> 6 pages each (depth 2).
function liveSite() {
  const pages = new Map(), hits = [];
  const link = href => '<a href="' + href + '">' + href + '</a>';
  const sections = Array.from({ length: 7 }, (_, i) => '/section-' + (i + 1));
  pages.set('/', sections.map(link).join(''));
  sections.forEach((s, i) => {
    pages.set(s, Array.from({ length: 6 }, (_, j) => link(s + '/page-' + (j + 1))).join('') + link(sections[(i + 1) % 7]));
    for (let j = 1; j <= 6; j++) pages.set(s + '/page-' + j, link('/'));
  });
  const server = http.createServer((req, res) => {
    hits.push(req.url);
    if (req.url.startsWith('/missing-cors')) { res.setHeader('Content-Type', 'text/html'); return res.end('<a href="/">no CORS header</a>'); }
    res.setHeader('Access-Control-Allow-Origin', '*');
    const body = pages.get(req.url);
    if (!body) { res.statusCode = 404; return res.end('missing'); }
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.end('<title>' + req.url + '</title>' + body);
  });
  return { server, hits };
}

(async () => {
  const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-release-'));
  const result = { browser: browser.version(), protocol: null };
  const { server, hits } = liveSite();
  try {
    // --- Offline context: every non-file request is recorded and aborted.
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
    await context.setOffline(true);
    const page = await context.newPage(), remote = [], loaded = [], errors = [];
    page.on('pageerror', e => errors.push(e.message));
    page.on('request', r => { loaded.push(r.url()); if (!/^(file|blob|data):/.test(r.url())) remote.push(r.url()); });
    page.on('websocket', ws => remote.push(ws.url()));
    await context.route(/^(https?|wss?):/, r => r.abort());
    await page.goto(appUrl);
    await page.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    result.protocol = await page.evaluate(() => location.protocol);
    assert.equal(result.protocol, 'file:');
    assert.ok(loaded.every(u => u.startsWith('file:')), 'startup loads only local files');

    // AT-01: defaults, legend and empty state; the placeholder is not a value.
    const defaults = await page.evaluate(() => {
      const f = document.getElementById('run-form');
      return { depth: f.elements.maxDepth.value, pages: f.elements.maxPages.value, root: f.elements.rootUrl.value,
        legend: Array.from(document.querySelectorAll('.graph-legend li')).map(li => li.textContent.trim()),
        empty: !document.getElementById('empty-state').hidden, scripts: document.scripts.length };
    });
    assert.equal(defaults.depth, '2'); assert.equal(defaults.pages, '50'); assert.equal(defaults.root, '');
    assert.deepEqual(defaults.legend, ['Root · depth 0', 'Depth 1', 'Depth 2', 'Depth 3+', 'Unknown depth']);
    assert.ok(defaults.empty);
    for (const name of ['Analyze / New run', 'Cancel', 'Reset']) assert.ok(await page.getByRole('button', { name }).isVisible());

    // AT-02 / AT-13 (scheme and credential portions): rejected before any request.
    await page.selectOption('[name=mode]', 'live-cors');
    for (const url of ['javascript:alert(1)', 'ftp://example.test/', 'https://user:secret@example.test/', 'https://exa mple.test/']) {
      await page.fill('[name=rootUrl]', url);
      await page.click('[type=submit]');
      await page.waitForFunction(() => document.getElementById('run-status').dataset.state === 'failed');
      assert.equal(await page.evaluate(() => document.getElementById('run-form').graph), null, url);
      assert.match(await page.locator('#outcome-guidance').textContent(), /^Root URL: (Enter a valid HTTP\(S\) URL|Only HTTP\(S\) URLs are supported|URLs containing credentials are not allowed)\./, url);
      assert.equal(await page.locator('[name=rootUrl]').getAttribute('aria-invalid'), 'true');
      assert.match(await page.locator('#run-summary').textContent(), /Limits: not applied \(input rejected\).*Bounded browser-readable discovery/);
      await page.click('#reset-run'); await page.selectOption('[name=mode]', 'live-cors');
    }
    assert.deepEqual(remote, [], 'rejected URLs make no request');

    // AT-29: the JSONP option stays disabled and labelled.
    const jsonp = page.locator('[name=mode] option', { hasText: 'JSONP' });
    assert.equal(await jsonp.evaluate(o => o.disabled && !o.hasAttribute('value')), true);
    assert.match(await jsonp.textContent(), /no approved provider/);

    // AT-17 / NFR-009 (import): 50-page links CSV at depth 2, offline.
    async function load(file, mode, maxPages, maxDepth) {
      await page.selectOption('[name=mode]', mode); await page.fill('[name=rootUrl]', 'https://example.test/');
      await page.fill('[name=maxPages]', String(maxPages)); await page.fill('[name=maxDepth]', String(maxDepth));
      await page.setInputFiles('[name=inputFile]', path.join(root, 'sample-data', file));
      const start = Date.now();
      await page.click('[type=submit]');
      await page.waitForFunction(() => ['complete', 'partial'].includes(document.getElementById('run-status').dataset.state));
      return Date.now() - start;
    }
    result.fiftyPageImportMs = await load('fifty-page-links.csv', 'csv-import', 50, 2);
    const fifty = await page.evaluate(() => { const g = document.getElementById('run-form').graph; return { nodes: g.nodes.length, edges: g.edges.length, state: document.getElementById('run-status').dataset.state }; });
    assert.deepEqual(fifty, { nodes: 50, edges: 98, state: 'complete' });
    assert.ok(result.fiftyPageImportMs < 30000);

    // Interaction offline: select from the table, drag/pin, zoom, fit.
    await page.locator('tbody button').nth(3).click();
    assert.equal(await page.locator('.graph-node[aria-pressed=true]').count(), 1);
    const circle = page.locator('.graph-node circle').first(); await circle.scrollIntoViewIfNeeded();
    const box = await circle.boundingBox();
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.down();
    await page.mouse.move(box.x + box.width / 2 + 40, box.y + box.height / 2 + 25, { steps: 4 }); await page.mouse.up();
    assert.equal(await page.locator('.is-pinned').count(), 1);
    await page.click('[data-action=zoom-in]'); await page.click('[data-action=fit]');

    // Offline exports.
    async function download(kind) {
      const pending = page.waitForEvent('download'); await page.click('#export-' + kind);
      const d = await pending, file = path.join(dir, d.suggestedFilename()); await d.saveAs(file); return fs.readFileSync(file);
    }
    const png = await download('png');
    assert.equal(png.subarray(1, 4).toString(), 'PNG');
    const pagesCsv = (await download('pages')).toString(), linksCsv = (await download('links')).toString();
    assert.equal(pagesCsv.split('\n').filter(l => l.startsWith('"data"')).length, 50);
    assert.equal(linksCsv.split('\n').filter(l => l.startsWith('"data"')).length, 98);

    // XML and saved HTML imports offline (AT-07, AT-31 regression under the release context).
    await load('four-page-sitemap.xml', 'xml-import', 50, 2);
    assert.equal(await page.evaluate(() => document.getElementById('run-form').graph.edges.length), 0);
    await load('home-page.html', 'html-import', 50, 2);
    assert.ok(await page.evaluate(() => document.getElementById('run-form').graph.edges.length) > 0);

    // NFR-010: 250 pages / 1,000 links.
    result.denseImportMs = await load('250-node-1000-edge-links.csv', 'csv-import', 250, 4);
    const dense = await page.evaluate(() => { const g = document.getElementById('run-form').graph; return [g.nodes.length, g.edges.length]; });
    assert.deepEqual(dense, [250, 1000]);
    const t = Date.now();
    for (const a of ['zoom-in', 'zoom-out', 'fit']) await page.click('[data-action=' + a + ']');
    const svg = await page.locator('#graph-canvas').boundingBox();
    await page.mouse.move(svg.x + 20, svg.y + 20); await page.mouse.down(); await page.mouse.move(svg.x + 140, svg.y + 90, { steps: 6 }); await page.mouse.up();
    result.denseZoomFitPanMs = Date.now() - t;
    assert.ok(result.denseImportMs < 5000);

    // AT-19 / AT-36: no remote request, no added script, every resource local.
    const after = await page.evaluate(() => ({ scripts: document.scripts.length, srcs: Array.from(document.scripts).map(s => s.src),
      resources: performance.getEntriesByType('resource').map(r => r.name).filter(n => !/^(file|blob|data):/.test(n)) }));
    assert.equal(after.scripts, defaults.scripts);
    assert.ok(after.srcs.every(s => s.startsWith('file:')));
    assert.deepEqual(after.resources, []);
    assert.deepEqual(remote, []);
    result.remoteRequestsOffline = remote.length;
    // Positive control: the observer does see an outbound attempt.
    await page.evaluate(() => fetch('https://example.test/control').catch(() => {}));
    await page.waitForTimeout(200);
    assert.deepEqual(remote, ['https://example.test/control']);
    result.networkObserverControl = 'passed';
    assert.deepEqual(errors, []);
    await context.close();

    // --- NFR-009 (live): 50-page CORS-readable loopback site at depth 2 with default limits.
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + server.address().port;
    const live = await browser.newPage({ viewport: { width: 1440, height: 1000 } });
    const liveErrors = []; live.on('pageerror', e => liveErrors.push(e.message));
    await live.goto(appUrl);
    await live.waitForFunction(() => document.documentElement.dataset.appReady === 'true');
    async function liveRun(seconds) {
      hits.length = 0;
      await live.selectOption('[name=mode]', 'live-cors'); await live.fill('[name=rootUrl]', origin + '/');
      await live.fill('[name=maxPages]', '50'); await live.fill('[name=maxDepth]', '2');
      if (seconds) await live.fill('[name=runDurationSeconds]', String(seconds));
      const start = Date.now(); await live.click('[type=submit]');
      await live.waitForFunction(() => ['complete', 'partial', 'failed', 'cancelled'].includes(document.getElementById('run-status').dataset.state), null, { timeout: 330000 });
      const out = await live.evaluate(() => ({ state: document.getElementById('run-status').dataset.state, pages: document.getElementById('run-form').graph.nodes.length,
        fetched: document.getElementById('run-form').graph.nodes.filter(n => n.fetched).length }));
      return { ...out, wallMs: Date.now() - start, requests: hits.length };
    }
    result.liveDefault = await liveRun(null);
    assert.equal(await live.locator('#unreadable-help').isHidden(), true, 'a time-limited readable run is not called unreadable');
    assert.equal(result.liveDefault.pages, 50);
    result.liveExtended = await liveRun(120);
    assert.equal(result.liveExtended.state, 'complete'); assert.equal(result.liveExtended.fetched, 50);
    // FR-059: a refused read shows the explanation.
    await live.fill('[name=rootUrl]', origin + '/missing-cors'); await live.fill('[name=requestTimeoutMs]', '2000');
    await live.click('[type=submit]');
    await live.waitForFunction(() => document.getElementById('run-status').dataset.state === 'failed', null, { timeout: 60000 });
    assert.equal(await live.locator('#unreadable-help').isVisible(), true);
    assert.deepEqual(liveErrors, []);
    console.log(JSON.stringify(result));
  } finally {
    server.close(); await browser.close(); fs.rmSync(dir, { recursive: true, force: true });
  }
})().catch(error => { console.error(error); process.exit(1); });
