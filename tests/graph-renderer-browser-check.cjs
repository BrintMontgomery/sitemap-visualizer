// Optional development check: Playwright plus installed Chromium, not runtime assets.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}), requests=[], errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  await page.waitForFunction(()=>document.documentElement.dataset.appReady==='true');
  await page.evaluate(()=>{
   const api=SitemapRenderer;
   window.SitemapRenderer={create(...args){const start=performance.now();const result=api.create(...args);window.lastGraphRenderMs=performance.now()-start;return result;}};
  });
  assert.equal(await page.locator('.graph-legend li').count(),5);
  assert.equal(await page.locator('#empty-state').isVisible(),true);
  async function load(name,mode='csv-import',rootUrl='https://example.test/') {
   await page.selectOption('[name=mode]',mode);
   await page.fill('[name=rootUrl]',rootUrl);
   await page.fill('[name=maxPages]','250');await page.fill('[name=maxDepth]','4');
   await page.setInputFiles('[name=inputFile]',path.join(root,'sample-data',name));
   const start=performance.now();await page.click('[type=submit]');
   await page.waitForFunction(()=>['complete','partial'].includes(document.getElementById('run-status').dataset.state));
   return performance.now()-start;
  }
  await load('radial-clusters-links.csv');
  assert.equal(await page.locator('.graph-node').count(),49);
  assert.equal(await page.locator('.graph-edge').count(),50);
  const counts=await page.locator('.graph-node circle').evaluateAll(cs=>cs.reduce((o,c)=>(o[c.getAttribute('fill')]=(o[c.getAttribute('fill')]||0)+1,o),{}));
  assert.deepEqual(counts,{'#f59e0b':1,'#22c55e':8,'#8b5cf6':38,'#ef4444':2});
  assert.equal(await page.locator('#graph-canvas').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(255, 255, 255)');
  const original=await page.evaluate(()=>JSON.stringify(document.getElementById('run-form').graph));
  const circle=page.locator('.graph-node circle').first(), nodeBox=await circle.boundingBox();
  await page.mouse.move(nodeBox.x+nodeBox.width/2,nodeBox.y+nodeBox.height/2);await page.mouse.down();
  await page.mouse.move(nodeBox.x+nodeBox.width/2+80,nodeBox.y+nodeBox.height/2+40,{steps:8});await page.mouse.up();
  const movedBox=await circle.boundingBox();
  assert.ok(Math.abs(movedBox.x-nodeBox.x-80)<2,'drag tracks screen X through the SVG transform');
  assert.ok(Math.abs(movedBox.y-nodeBox.y-40)<2,'drag tracks screen Y through the SVG transform');
  const pinned=await page.evaluate(()=>document.getElementById('run-form').layoutState.nodes.find(n=>n.pinned));
  assert.ok(pinned);assert.ok(pinned.x>0);
  const svg=page.locator('#graph-canvas'), layer=page.locator('.graph-layer'), box=await svg.boundingBox();
  const before=await layer.getAttribute('transform');
  await page.mouse.move(box.x+10,box.y+10);await page.mouse.down();await page.mouse.move(box.x+65,box.y+35,{steps:5});await page.mouse.up();
  assert.notEqual(await layer.getAttribute('transform'),before);
  const panned=await layer.getAttribute('transform');await page.mouse.wheel(0,-100);
  await page.waitForFunction(old=>document.querySelector('.graph-layer').getAttribute('transform')!==old,panned);
  await page.click('[data-action=zoom-in]');await page.click('[data-action=zoom-out]');await page.click('[data-action=fit]');
  assert.deepEqual(await page.evaluate(()=>document.getElementById('run-form').layoutState.nodes.find(n=>n.pinned)),pinned);
  await page.click('[data-action=unpin]');assert.equal(await page.locator('.is-pinned').count(),0);
  // Pointer cancellation ends a drag, retains the intentional pin, and permits new gestures.
  const cb=await circle.boundingBox();await page.mouse.move(cb.x+cb.width/2,cb.y+cb.height/2);await page.mouse.down();await page.mouse.move(cb.x+cb.width/2+40,cb.y+cb.height/2+20,{steps:3});
  await svg.evaluate(e=>e.dispatchEvent(new PointerEvent('pointercancel',{pointerId:1,bubbles:true})));
  await page.mouse.up();assert.equal(await page.locator('.is-pinned').count(),1);
  await circle.dblclick();assert.equal(await page.locator('.is-pinned').count(),0);
  await page.click('[data-action=reset]');assert.equal(await page.locator('.is-pinned').count(),0);
  assert.equal(await page.evaluate(()=>JSON.stringify(document.getElementById('run-form').graph)),original);
  // Retain an optional screenshot for visual review without polluting the repository.
  if(process.env.GRAPH_SCREENSHOT_PATH)await page.locator('.map-panel').screenshot({path:process.env.GRAPH_SCREENSHOT_PATH});
  await page.setViewportSize({width:768,height:1024});await page.click('[data-action=fit]');
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
  assert.equal(await page.locator('[data-action=reset]').isVisible(),true);
  await page.setViewportSize({width:1440,height:1100});
  await load('four-page-sitemap.xml','xml-import');
  assert.equal(await page.locator('.graph-node').count(),4);assert.equal(await page.locator('.graph-edge').count(),0);assert.equal(await page.locator('.unknown-depth').count(),3);
  await load('four-page-links.csv','csv-import','');
  assert.equal(await page.locator('.unknown-depth').count(),4);
  await load('hostile-page.html','html-import','https://example.test/');
  assert.equal(await page.evaluate(()=>globalThis.phase5Executed),undefined);
  const duration=await load('250-node-1000-edge-links.csv');
  const layoutAndSvgMs=await page.evaluate(()=>lastGraphRenderMs);
  assert.equal(await page.locator('.graph-node').count(),250);assert.equal(await page.locator('.graph-edge').count(),1000);
  const interactionStart=performance.now();await page.click('[data-action=zoom-in]');await page.click('[data-action=fit]');
  const denseBox=await svg.boundingBox(), denseTransform=await layer.getAttribute('transform');
  await page.mouse.move(denseBox.x+10,denseBox.y+10);await page.mouse.down();await page.mouse.move(denseBox.x+70,denseBox.y+30,{steps:3});await page.mouse.up();
  assert.notEqual(await layer.getAttribute('transform'),denseTransform);
  const interactionMs=performance.now()-interactionStart;
  assert.ok(duration<10000,'dense fixture should complete in 10s on the check host');
  assert.ok(layoutAndSvgMs<5000,'layout and SVG should complete in 5s on the check host');
  assert.ok(interactionMs<2000,'zoom, fit and pan should respond in 2s on the check host');
  await page.click('#reset-run');assert.equal(await page.locator('.graph-node').count(),0);assert.equal(await page.locator('#empty-state').isVisible(),true);
  assert.equal(await page.evaluate(()=>document.getElementById('run-form').layoutState),null);
  assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await page.evaluate(()=>fetch('https://canary.invalid/graph-network-observer').catch(()=>{}));
  assert.deepEqual(requests,['https://canary.invalid/graph-network-observer']);
  console.log(JSON.stringify({browser:await browser.version(),protocol:'file:',referenceNodes:49,referenceEdges:50,denseNodes:250,denseEdges:1000,importAndRenderMs:Math.round(duration),layoutAndSvgMs:Math.round(layoutAndSvgMs),zoomFitPanMs:Math.round(interactionMs),remoteRequests:0,networkObserverControl:'passed',interactions:'drag/pin/pan/wheel/buttons/fit/unpin/cancel/reset/replacement passed',tablet:'768px viewport passed'}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
