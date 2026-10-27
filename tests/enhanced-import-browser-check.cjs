// Development-only Phase 15 offline/direct-file acceptance.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs'),path=require('node:path');
const {pathToFileURL}=require('node:url');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  const page=await browser.newPage({viewport:{width:1440,height:1000}}),requests=[],errors=[];
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});page.on('pageerror',e=>errors.push(e.message));
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.resolve('index.html')).href);
  async function analyze(){await page.click('[type=submit]');await page.waitForFunction(()=>['complete','partial','failed'].includes(document.getElementById('run-status').dataset.state));}
  async function paste(kind,text,source=''){
   await page.selectOption('[name=mode]','paste-import');await page.selectOption('[name=pasteKind]',kind);
   await page.fill('[name=pasteText]',text);await page.fill('[name=pasteSourceUrl]',source);await analyze();
  }
  await page.fill('[name=rootUrl]','https://example.test/');
  await paste('html',fs.readFileSync('sample-data/hostile-page.html','utf8'),'https://example.test/');
  assert.equal(await page.evaluate(()=>window.phase5Executed),undefined);
  assert.equal(await page.evaluate(()=>document.getElementById('run-form').graph.acquisitions[0].transport),'html-import');
  await paste('csv',fs.readFileSync('sample-data/four-page-links.csv','utf8'));
  assert.equal(await page.locator('.graph-edge').count(),4);
  await paste('xml',fs.readFileSync('sample-data/multi-import-child.xml','utf8'),'https://example.test/selected.xml');
  assert.equal(await page.locator('.graph-edge').count(),0);
  const before=await page.evaluate(()=>{const f=document.getElementById('run-form');return JSON.stringify([f.graph,f.metrics,SitemapExports.csv('links',f.graph,f.report)]);});
  await page.check('[name=hierarchyPreview]');assert.match(await page.locator('#hierarchy-preview').textContent(),/not observed hyperlinks/);
  assert.match(await page.locator('#hierarchy-preview').textContent(),/guide\/page/);
  assert.equal(await page.evaluate(()=>{const f=document.getElementById('run-form');return JSON.stringify([f.graph,f.metrics,SitemapExports.csv('links',f.graph,f.report)]);}),before);
  await page.selectOption('[name=mode]','html-import');
  await page.setInputFiles('[name=inputFile]',['home-page.html','multi-import-guide.html','multi-import-index.xml','multi-import-child.xml'].map(f=>path.resolve('sample-data',f)));
  const maps=page.locator('#source-mappings input');
  for(const [i,url] of ['https://example.test/','https://example.test/guide','https://example.test/sitemap.xml','https://example.test/selected.xml'].entries())await maps.nth(i).fill(url);
  await analyze();
  assert.equal(await page.evaluate(()=>document.getElementById('run-form').graph.acquisitions.length),4);
  assert.equal(await page.locator('.graph-edge').count(),4);
  assert.match(await page.locator('#run-diagnostics').textContent(),/missing.xml/);
  assert.equal(await page.evaluate(()=>document.getElementById('run-form').graph.nodes.find(n=>n.url.endsWith('/inventory-only')).depth),null);
  assert.ok(await page.evaluate(()=>document.getElementById('run-form').graph.edges.some(e=>e.evidence.some(v=>v.inputReference==='multi-import-guide.html'))));
  await paste('xml','<urlset>');assert.equal(await page.locator('#run-status').getAttribute('data-state'),'failed');
  assert.match(await page.locator('#run-diagnostics').textContent(),/Pasted input.xml/);assert.equal(await page.locator('#hierarchy-preview').isHidden(),true);
  await paste('csv','é'.repeat(1000001));assert.match(await page.locator('#run-diagnostics').textContent(),/SIZE_LIMIT/);
  await paste('xml',fs.readFileSync('sample-data/multi-import-child.xml','utf8'));
  await page.setViewportSize({width:390,height:844});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth),true);
  if(process.env.ENHANCED_SCREENSHOT_PATH)await page.screenshot({path:process.env.ENHANCED_SCREENSHOT_PATH,fullPage:true});
  await page.click('#reset-run');assert.equal(await page.locator('#source-mappings input').count(),0);assert.equal(await page.locator('#hierarchy-preview').isHidden(),true);
  assert.equal(await page.inputValue('[name=pasteText]'),'');assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  // Positive control proves the request observer is active.
  await page.evaluate(()=>fetch('https://example.test/observer-control').catch(()=>{}));assert.equal(requests.length,1);
  console.log('PASS Chromium '+browser.version()+': file:// paste HTML/XML/CSV, hostile/oversize/malformed input, mixed mapped files, missing references, provenance, isolated hierarchy, narrow UI/reset; zero import network attempts; observer positive control passes.');
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
