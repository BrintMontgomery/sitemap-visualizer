const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const root = require('node:path').resolve(__dirname, '..');
(async () => {
 const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined, args: ['--no-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--no-zygote'], headless: true });
 try {
  const page = await browser.newPage(); const requests = [];
  await page.route(/^https?:/, route => route.abort());
  page.on('request', r => { if (/^https?:/.test(r.url())) requests.push(r.url()); });
  await page.goto('file://' + root + '/tests/html-import-browser.html');
  await page.setInputFiles('#file', root + '/sample-data/hostile-page.html');
  await page.click('#import');
  await page.waitForFunction(() => document.getElementById('result').textContent.includes('"ok"'));
  await page.waitForTimeout(300);
  const r = JSON.parse(await page.locator('#result').textContent());
  assert.equal(r.ok, true); assert.deepEqual(r.claims.map(c => c.target), ['https://example.test/safe']);
  assert.equal(await page.evaluate(() => globalThis.phase5Executed), undefined); assert.deepEqual(requests, []);
  assert.equal(await page.title(), 'Phase 5 browser check');
  console.log(JSON.stringify({browser: await browser.version(), hostileImport: 'passed', remoteRequests: requests.length, scriptExecuted: false}));
  // Verify core extraction and limits in the real browser, without a mock DOM.
  const result = await page.evaluate(async ({relative, maxBytes, maxRecords, maxElements, maxNesting}) => {
   const run = SitemapContracts.createRun({mode:'html-import'});
   const f = s => new File([s], 'page.html', {type:'text/html'});
   const imp = s => SitemapHtmlImport.importFile(f(s), run, 'https://example.test/section/page.html');
   const r = await imp(relative);
   const record = await imp('<a href="/a"></a>'.repeat(maxRecords+1));
   const element = await imp('<b></b>'.repeat(maxElements+1));
   const nesting = await imp('<div>'.repeat(maxNesting+1)+'</div>'.repeat(maxNesting+1));
   const oversized = await imp('x'.repeat(maxBytes+1));
   const missing = await SitemapHtmlImport.importFile(f(''),run);
   return {targets:r.claims.map(c=>c.target),title:r.page.title,duplicates:r.claims[0].evidence.length,record:record.truncated,element:element.issue.code,nesting:nesting.issue.code,oversized:oversized.issue.code,missing:missing.issue.code};
  }, {relative:fs.readFileSync(root+'/sample-data/relative-page.html','utf8'), maxBytes:2000000,maxRecords:10000,maxElements:20000,maxNesting:64});
  assert.deepEqual(result, {targets:['https://example.test/about','https://example.test/section/contact?x=1&y=2','https://other.test/'], title:'Saved & linked',duplicates:2,record:true,element:'PARTIAL_LIMIT',nesting:'PARTIAL_LIMIT',oversized:'SIZE_LIMIT',missing:'URL_REJECTED'});
  console.log('Real-browser extraction and bounds passed.');
  await page.evaluate(() => fetch('https://canary.invalid/positive-control').catch(() => {}));
  assert.deepEqual(requests, ['https://canary.invalid/positive-control']);
  console.log('Network observation positive control passed.');
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1)});
