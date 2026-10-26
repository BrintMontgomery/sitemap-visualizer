// Development-only loopback fixtures. No CORS/security disabling flags or runtime server.
const { chromium } = require('playwright');
const http = require('node:http');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const root = path.resolve(__dirname, '..');
(async () => {
  const requests = [], errors = [];
  let origin;
  const fixture = '<title>Intranet €</title><script>window.liveExecuted=true</script><img src="/unwanted"><a href="child">child</a>';
  const server = http.createServer((req, res) => {
    requests.push({ path: req.url, method: req.method, cookie: req.headers.cookie, origin: req.headers.origin, referer: req.headers.referer });
    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    if (req.url !== '/denied') res.setHeader('Access-Control-Allow-Origin', '*');
    if (req.url === '/slow') {
      const timer = setTimeout(() => res.end(fixture), 2000);
      res.on('close', () => clearTimeout(timer)); return;
    }
    if (req.url === '/redirect') { res.writeHead(302, { Location: origin + '/dir/home' }); return res.end(); }
    if (req.url === '/other-host') { res.writeHead(302, { Location: origin.replace('127.0.0.1', 'localhost') + '/allowed' }); return res.end(); }
    if (req.url === '/oversize') return res.end('x'.repeat(2000001));
    if (req.url === '/missing') { res.statusCode = 404; return res.end('missing'); }
    res.end(fixture);
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  origin = 'http://127.0.0.1:' + server.address().port;
  let browser;
  try {
    browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage'] });
    const context = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    await context.addCookies([{ name: 'test', value: 'private', url: origin }]);
    const page = await context.newPage();
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(pathToFileURL(path.join(root, 'index.html')).href);
    assert.equal(requests.length, 0);
    const live = async (pathname, timeout = '1000') => {
      await page.selectOption('[name=mode]', 'live-cors');
      await page.fill('[name=rootUrl]', origin + pathname);
      await page.fill('[name=requestTimeoutMs]', timeout);
      await page.click('[type=submit]');
    };
    const terminal = () => page.waitForFunction(() => ['complete', 'partial', 'failed', 'cancelled'].includes(document.getElementById('run-status').dataset.state));
    await live('/allowed'); await terminal();
    const first = await page.evaluate(() => {
      const f = document.getElementById('run-form');
      return { graph: f.graph, attempt: f.attempt, executed: window.liveExecuted === true, state: document.getElementById('run-status').dataset.state };
    });
    assert.equal(first.state, 'complete'); assert.equal(first.executed, false);
    assert.equal(first.attempt.httpStatus, 200); assert.equal(first.attempt.observedFinalUrl, origin + '/allowed');
    assert.equal(first.attempt.bytesRead, Buffer.byteLength(fixture)); assert.ok(first.attempt.elapsedMs >= 0);
    assert.deepEqual(first.graph.edges.map(e => [e.source, e.target]), [[origin + '/allowed', origin + '/child']]);
    assert.equal(first.graph.nodes.find(n => n.url.endsWith('/allowed')).fetched, true);
    assert.equal(first.graph.nodes.find(n => n.url.endsWith('/child')).fetched, false);
    assert.match(await page.locator('#run-summary').textContent(), /selected page only/);
    assert.equal(await page.locator('[name=inputFile]').isDisabled(), true);
    assert.equal(requests.length, 1); assert.equal(requests[0].cookie, undefined); assert.equal(requests[0].referer, undefined); assert.equal(requests[0].origin, 'null');
    await page.screenshot({ path: process.env.FETCH_SCREENSHOT_PATH || '/tmp/phase10-live.png', fullPage: true });

    await live('/denied'); await terminal();
    assert.match(await page.locator('#run-status').textContent(), /NETWORK_OR_POLICY_FAILURE/);
    assert.match(await page.locator('#run-status').textContent(), /cause is unknown/);
    assert.equal(await page.evaluate(() => document.getElementById('run-form').graph), null);
    const denied = await page.evaluate(() => document.getElementById('run-form').attempt);
    assert.equal(denied.httpStatus, null); assert.equal(denied.observedFinalUrl, null); assert.equal(denied.bytesRead, 0);
    // A real opaque response from a test-only no-cors call cannot become evidence.
    const opaque = await page.evaluate(async url => {
      const run = SitemapContracts.createRun({ mode: 'live-cors', rootUrl: url });
      const response = await fetch(url, { mode: 'no-cors', credentials: 'omit' });
      const session = SitemapFetch.createSession(run, { fetch: async () => response });
      try { return await session.request(); } finally { session.close(); }
    }, origin + '/denied');
    assert.equal(opaque.issue.code, 'OPAQUE_RESPONSE'); assert.equal(opaque.acquisition, undefined); assert.equal(opaque.attempt.bytesRead, 0);

    for (const [pathname, code] of [['/missing', 'HTTP_ERROR'], ['/oversize', 'SIZE_LIMIT'], ['/other-host', 'SCOPE_EXCLUDED'], ['/slow', 'TIMEOUT']]) {
      await live(pathname, pathname === '/slow' ? '50' : '1000'); await terminal();
      assert.match(await page.locator('#run-status').textContent(), new RegExp(code));
      assert.equal(await page.evaluate(() => document.getElementById('run-form').graph), null);
    }
    await live('/redirect'); await terminal();
    const redirected = await page.evaluate(() => document.getElementById('run-form').graph);
    assert.equal(redirected.acquisitions[0].observedFinalUrl, origin + '/dir/home');
    assert.deepEqual(redirected.edges.map(e => [e.source, e.target]), [[origin + '/dir/home', origin + '/dir/child']]);
    assert.equal(redirected.redirectAliases.length, 1); assert.equal(redirected.acquisitions[0].redirectHistory, null);

    await live('/slow'); await page.click('#cancel-run'); await terminal();
    assert.equal(await page.locator('#run-status').getAttribute('data-state'), 'cancelled');
    // A replacing run must stay visible after the old response would have completed.
    await live('/slow'); await live('/allowed'); await terminal();
    await page.waitForTimeout(2100);
    assert.equal(await page.evaluate(() => document.getElementById('run-form').graph.effectiveRoot), origin + '/allowed');
    assert.equal(await page.locator('#run-status').getAttribute('data-state'), 'complete');

    await page.selectOption('[name=mode]', 'csv-import');
    assert.equal(await page.locator('[name=inputFile]').isDisabled(), false);
    assert.equal(await page.locator('[name=requestTimeoutMs]').isDisabled(), true);
    await page.fill('[name=rootUrl]', 'https://example.test/');
    await page.setInputFiles('[name=inputFile]', path.join(root, 'sample-data/four-page-links.csv'));
    const beforeImport = requests.length;
    await page.click('[type=submit]'); await terminal();
    assert.equal(await page.locator('#run-status').getAttribute('data-state'), 'complete');
    assert.equal(requests.length, beforeImport);
    assert.ok(requests.every(r => r.method === 'GET'));
    assert.ok(requests.every(r => !r.path.includes('unwanted') && !r.path.endsWith('/child')));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ browser: await browser.version(), fileLaunch: 'passed', corsAllowedDenied: 'passed', loopback: 'passed', opaque: 'rejected', redirectsHttpBytesTimeoutCancelReplacement: 'passed', localImportFallback: 'passed', automaticTraversal: false, pageErrors: errors.length }));
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
