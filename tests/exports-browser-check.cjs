// Development-only Chromium file:// export acceptance; no runtime dependency.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const fs=require('node:fs');
const os=require('node:os');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'sitemap-export-'));
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100},acceptDownloads:true}), requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  assert.ok(await page.locator('#export-png').isDisabled());
  await page.evaluate(()=>{
   window.createdUrls=[];window.revokedUrls=[];
   const create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   URL.createObjectURL=b=>{const url=create(b);createdUrls.push(url);return url;};
   URL.revokeObjectURL=u=>{revokedUrls.push(u);return revoke(u);};
  });
  async function load(file,mode='csv-import',maxPages=50){
   await page.selectOption('[name=mode]',mode);await page.fill('[name=rootUrl]','https://example.test/');
   await page.fill('[name=maxPages]',String(maxPages));await page.fill('[name=maxDepth]','4');
   await page.setInputFiles('[name=inputFile]',path.join(root,'sample-data',file));await page.click('[type=submit]');
   await page.waitForFunction(()=>['complete','partial'].includes(document.getElementById('run-status').dataset.state));
  }
  async function download(kind,saveAs){
   const pending=page.waitForEvent('download');await page.click('#export-'+kind);const d=await pending;
   assert.match(d.suggestedFilename(),new RegExp('^sitemap-'+kind+'-[0-9]+\\.'+(kind==='png'?'png':'csv')+'$'));
   await d.saveAs(saveAs);return fs.readFileSync(saveAs);
  }
  await load('four-page-links.csv');
  const before=await page.locator('.graph-layer').getAttribute('transform');await page.click('[data-action=zoom-in]');
  assert.notEqual(await page.locator('.graph-layer').getAttribute('transform'),before);
  const original=await page.evaluate(()=>JSON.stringify(document.getElementById('run-form').graph));
  const circle=page.locator('.graph-node circle').first();await circle.scrollIntoViewIfNeeded();const box=await circle.boundingBox();
  await page.mouse.move(box.x+box.width/2,box.y+box.height/2);await page.mouse.down();
  await page.mouse.move(box.x+box.width/2+30,box.y+box.height/2+20,{steps:3});await page.mouse.up();
  assert.equal(await page.locator('.is-pinned').count(),1);
  const pinnedTransform=await page.locator('.is-pinned').getAttribute('transform');
  // Record the exact SVG snapshot used for rasterization.
  await page.evaluate(()=>{
   const svg=document.getElementById('graph-canvas');

   const png=SitemapExports.png;
   window.SitemapExports={...SitemapExports,png(svg,g,r){window.lastExportSvg=new XMLSerializer().serializeToString(SitemapExports.svgSnapshot(svg,g,r));return png(svg,g,r);}};
  });
  const imagePath=process.env.EXPORT_SCREENSHOT_PATH||path.join(dir,'complete.png');
  const png=await download('png',imagePath);
  assert.equal(png.subarray(1,4).toString(),'PNG');assert.equal(png.readUInt32BE(16),1000);assert.ok(png.readUInt32BE(20)>800);
  const snapshot=await page.evaluate(()=>lastExportSvg);assert.ok(snapshot.includes(pinnedTransform));assert.match(snapshot,/Unknown depth/);assert.match(snapshot.replace(/<[^>]+>/g," ").replace(/\s+/g," "),/No result proves full-site coverage/);
  assert.equal(await page.evaluate(()=>JSON.stringify(document.getElementById('run-form').graph)),original);
  const pages=await download('pages',path.join(dir,'pages.csv')),links=await download('links',path.join(dir,'links.csv'));
  assert.match(pages.toString(),/"page_id"/);assert.match(links.toString(),/imported-link/);
  await load('export-values.html','html-import');
  const formula=await download('pages',path.join(dir,'formula.csv'));
  assert.match(formula.toString(),/'=SUM\(1,2\) ""quoted"" & café/);
  await load('four-page-links.csv','csv-import',2);
  assert.equal(await page.locator('#run-status').getAttribute('data-state'),'partial');
  await download('png',path.join(dir,'partial.png'));
  assert.match(await page.evaluate(()=>lastExportSvg),/Partial: true/);
  const partial=await download('pages',path.join(dir,'partial.csv'));assert.match(partial.toString(),/"partial","partial","true","true"/);
  await load('four-page-sitemap.xml','xml-import');
  const inventory=await download('links',path.join(dir,'inventory.csv'));assert.match(inventory.toString(),/"metadata"/);assert.doesNotMatch(inventory.toString(),/"data"/);
  // The app handles browser encoder failure and keeps CSV export available.
  await page.evaluate(()=>{window.realToBlob=HTMLCanvasElement.prototype.toBlob;HTMLCanvasElement.prototype.toBlob=function(fn){fn(null);};});
  await page.click('#export-png');await page.waitForFunction(()=>document.getElementById('export-status').textContent.includes('Export failed'));
  assert.ok(await page.locator('#export-pages').isEnabled());
  await page.evaluate(()=>{HTMLCanvasElement.prototype.toBlob=realToBlob;});
  // A pending export from a replaced/reset run must never trigger a stale download.
  await page.evaluate(()=>{const old=SitemapExports;window.SitemapExports={...old,png:()=>new Promise(resolve=>{window.finishExport=resolve;})};});
  await page.click('#export-png');await page.click('#reset-run');
  await page.evaluate(()=>finishExport(new Blob(['stale'],{type:'image/png'})));
  assert.ok(await page.locator('#export-png').isDisabled());
  assert.match(await page.locator('#export-status').textContent(),/Complete an analysis/);
  await page.waitForFunction(()=>createdUrls.length===revokedUrls.length);
  assert.deepEqual(await page.evaluate(()=>createdUrls.slice().sort()),await page.evaluate(()=>revokedUrls.slice().sort()));
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  console.log(JSON.stringify({browser:await browser.version(),protocol:'file:',downloads:'complete/partial PNG, pages CSV, links CSV, inventory metadata, formula fixture',pngWidth:1000,remoteRequests:0,blobUrlsReleased:await page.evaluate(()=>revokedUrls.length),failures:'encoder failure and stale reset handled',preview:imagePath}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
