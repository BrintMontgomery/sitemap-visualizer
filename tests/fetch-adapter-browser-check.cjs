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
    if (req.url === '/sitemap.xml') { res.statusCode = 404; return res.end('no conventional sitemap'); }
    if (['/child', '/dir/child', '/inventory', '/deep'].includes(req.url)) return res.end('<title>Leaf</title>');
    if (req.url === '/robots.txt') { res.setHeader('Content-Type', 'text/plain'); return res.end('User-agent: *\nDisallow: /'); }
    if (req.url === '/crawl') return res.end('<title>Discovery root</title><meta name="robots" content="nofollow"><link rel="sitemap" href="/maps/index.xml"><a href="/branch">branch</a><a href="/denied">denied</a>');
    if (req.url === '/branch') return res.end('<a href="/deep">deep</a><a href="/crawl">back</a>');
    if (req.url === '/maps/index.xml') { res.setHeader('Content-Type', 'application/xml'); return res.end('<sitemapindex><sitemap><loc>'+origin+'/maps/leaf.xml</loc></sitemap><sitemap><loc>'+origin+'/maps/index.xml</loc></sitemap></sitemapindex>'); }
    if (req.url === '/maps/leaf.xml') { res.setHeader('Content-Type', 'application/xml'); return res.end('<urlset><url><loc>'+origin+'/inventory</loc></url></urlset>'); }
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
    assert.equal(first.graph.nodes.find(n => n.url.endsWith('/child')).fetched, true);
    assert.match(await page.locator('#run-summary').textContent(), /bounded readable discovery/);
    assert.equal(await page.locator('[name=inputFile]').isDisabled(), true);
    assert.equal(requests.length, 3); assert.equal(requests[0].cookie, undefined); assert.equal(requests[0].referer, undefined); assert.equal(requests[0].origin, 'null');
    await page.screenshot({ path: process.env.FETCH_SCREENSHOT_PATH || '/tmp/phase11-live.png', fullPage: true });

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

    const beforeCrawl = requests.length;
    await live('/crawl'); await terminal();
    const discovered = await page.evaluate(() => document.getElementById('run-form').graph);
    assert.equal(discovered.nodes.find(n => n.url.endsWith('/deep')).depth, 2);
    assert.equal(discovered.nodes.find(n => n.url.endsWith('/inventory')).depth, null);
    assert.equal(discovered.nodes.find(n => n.url.endsWith('/inventory')).fetched, true);
    assert.equal(discovered.nodes.find(n => n.url.endsWith('/denied')).fetched, false);
    assert.equal(discovered.edges.length, 4); assert.equal(discovered.memberships.length, 1);
    assert.equal(discovered.memberships[0].sourceSitemap, origin + '/maps/leaf.xml');
    assert.equal(discovered.partial, true);
    assert.equal(requests.slice(beforeCrawl).filter(r => r.path === '/maps/index.xml').length, 1);
    assert.ok(!requests.some(r => r.path === '/robots.txt'));
    assert.equal(await page.locator('#discovery-log').isVisible(), true);
    assert.match(await page.locator('#discovery-log').textContent(), /NETWORK_OR_POLICY_FAILURE/);
    await page.locator('#discovery-log summary').click();
    await page.screenshot({ path: process.env.DISCOVERY_SCREENSHOT_PATH || '/tmp/phase11-discovery.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 1024 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
    await page.setViewportSize({ width: 1280, height: 1000 });
    await page.fill('[name=maxDepth]', '1');
    const beforeDepth = requests.length;
    await live('/crawl'); await terminal();
    assert.ok(!requests.slice(beforeDepth).some(r => r.path === '/deep'));
    assert.equal(await page.locator('#run-status').getAttribute('data-state'), 'partial');
    await page.fill('[name=maxPages]', '1000'); await page.fill('[name=maxDepth]', '20');
    assert.equal(await page.locator('[name=maxConcurrency]').isDisabled(), false);
    assert.equal(await page.locator('[name=runDurationSeconds]').isDisabled(), false);
    await page.selectOption('[name=mode]', 'csv-import');
    assert.equal(await page.locator('[name=maxPages]').inputValue(), '250');
    assert.equal(await page.locator('[name=maxDepth]').inputValue(), '4');
    assert.equal(await page.locator('[name=inputFile]').isDisabled(), false);
    assert.equal(await page.locator('[name=requestTimeoutMs]').isDisabled(), true);
    await page.fill('[name=rootUrl]', 'https://example.test/');
    await page.setInputFiles('[name=inputFile]', path.join(root, 'sample-data/four-page-links.csv'));
    const beforeImport = requests.length;
    await page.click('[type=submit]'); await terminal();
    assert.equal(await page.locator('#run-status').getAttribute('data-state'), 'complete');
    assert.equal(requests.length, beforeImport);
    assert.ok(requests.every(r => r.method === 'GET'));
    assert.ok(requests.every(r => !r.path.includes('unwanted')));
    assert.deepEqual(errors, []);
    console.log(JSON.stringify({ browser: await browser.version(), fileLaunch: 'passed', corsAllowedDenied: 'passed', loopback: 'passed', opaque: 'rejected', redirectsHttpBytesTimeoutCancelReplacement: 'passed', localImportFallback: 'passed', automaticTraversal: 'passed', recursiveSitemaps: 'passed', robotsIgnored: 'passed', depthCap: 'passed', pageErrors: errors.length }));
  } finally {
    if (browser) await browser.close();
    server.closeAllConnections(); await new Promise(resolve => server.close(resolve));
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
