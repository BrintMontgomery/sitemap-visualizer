// Development-only offline file:// verification for Phase 14.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  async function load(file,mode,maxPages=50){
   await page.selectOption('[name=mode]',mode);await page.fill('[name=rootUrl]','https://example.test/');
   await page.fill('[name=maxPages]',String(maxPages));
   await page.setInputFiles('[name=inputFile]',path.resolve('sample-data',file));await page.click('[type=submit]');
   await page.waitForFunction(()=>['complete','partial'].includes(document.getElementById('run-status').dataset.state));
  }
  await load('metrics-inventory.xml','xml-import');
  assert.equal(await page.locator('.graph-edge').count(),0);
  assert.match(await page.locator('#graph-metrics').textContent(),/4 weakly connected components/);
  assert.match(await page.locator('#graph-metrics').textContent(),/Candidate orphan pages \(3\)/);
  assert.match(await page.locator('#graph-metrics').textContent(),/No candidate is proof of a global orphan/);
  await page.locator('#page-inspection tbody button').nth(1).focus();
  assert.match(await page.locator('.page-detail-content').textContent(),/Yes — sitemap member/);
  // Verify CSV export fields through the same serializer the download uses.
  assert.match(await page.evaluate(()=>{const f=document.getElementById('run-form');return SitemapExports.csv('pages',f.graph,f.report);}),/orphan_candidate/);
  await load('four-page-links.csv','csv-import');
  assert.match(await page.locator('#graph-metrics').textContent(),/1 weakly connected components/);
  assert.match(await page.locator('#graph-metrics').textContent(),/Candidate orphan pages \(0\)/);
  await page.locator('#page-inspection tbody button').first().focus();
  await page.selectOption('.neighbor-highlight','outbound');
  assert.equal(await page.locator('.graph-edge.is-highlighted').count(),2);
  assert.equal(await page.locator('.graph-node.is-neighbor').count(),2);
  await page.selectOption('.neighbor-highlight','inbound');assert.equal(await page.locator('.graph-edge.is-highlighted').count(),0);
  await page.locator('#page-inspection tbody button').last().focus();
  assert.equal(await page.locator('.graph-edge.is-highlighted').count(),2);
  await page.selectOption('.neighbor-highlight','none');assert.equal(await page.locator('.graph-edge.is-highlighted').count(),0);
  await load('metrics-inventory.xml','xml-import',2);
  assert.match(await page.locator('#graph-metrics').textContent(),/Coverage: partial/);
  assert.match(await page.locator('#graph-metrics').textContent(),/2 pages \| 0 rendered links/);
  assert.match(await page.locator('#graph-metrics').textContent(),/Candidate orphan pages \(1\)/);
  if(process.env.METRICS_SCREENSHOT_PATH)await page.locator('#graph-metrics').screenshot({path:process.env.METRICS_SCREENSHOT_PATH});
  await page.click('#reset-run');assert.equal(await page.locator('#graph-metrics').isHidden(),true);
  assert.equal(await page.locator('#graph-metrics').textContent(),'');
  assert.deepEqual(requests,[]);assert.deepEqual(errors,[]);
  console.log('PASS Chromium '+browser.version()+': offline inventory candidates, metrics, selected-page fields, directions, caps, reset; zero remote requests.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
