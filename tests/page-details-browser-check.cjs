// Optional development check: Playwright and a separately installed Chromium.
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const root=path.resolve(__dirname,'..');
(async()=>{
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:['--no-sandbox','--disable-dev-shm-usage']});
 try {
  const page=await browser.newPage({viewport:{width:1440,height:1100}}),requests=[],errors=[];
  page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(/^https?:/.test(r.url()))requests.push(r.url());});
  await page.route(/^https?:/,r=>r.abort());
  await page.goto(pathToFileURL(path.join(root,'index.html')).href);
  async function load(name,mode='csv-import',url='https://example.test/') {
   await page.selectOption('[name=mode]',mode);await page.fill('[name=rootUrl]',url);
   await page.fill('[name=maxPages]','250');await page.fill('[name=maxDepth]','4');
   await page.setInputFiles('[name=inputFile]',path.join(root,'sample-data',name));
   // Activate the form with the keyboard after choosing a fixture.
   await page.locator('[type=submit]').focus();await page.keyboard.press('Enter');
   await page.waitForFunction(()=>['complete','partial'].includes(document.getElementById('run-status').dataset.state));
  }
  const selected=()=>page.locator('tbody button[aria-pressed=true]');
  const detailURL=()=>page.locator('.page-detail-content dd').first().textContent();
  async function inspectTable(expectedCount) {
   // Starting at the first toolbar control, reach and activate the skip link by Tab.
   await page.locator('[data-action=zoom-in]').focus();
   for(let i=0;i<8;i++) {
    if(await page.evaluate(()=>document.activeElement.classList.contains('inspection-skip')))break;
    await page.keyboard.press('Tab');
   }
   assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('inspection-skip')),true);
   await page.keyboard.press('Enter');
   assert.equal(await page.evaluate(()=>document.activeElement.id),'page-list-title');
   const ids=await page.locator('tbody button').evaluateAll(bs=>bs.map(b=>b.dataset.pageId));assert.equal(ids.length,expectedCount);
   for(const id of ids) {
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(()=>document.activeElement.dataset.pageId),id);
    assert.equal(await detailURL(),id);assert.equal(await selected().count(),1);
    assert.equal(await page.locator('.graph-node[aria-pressed=true]').getAttribute('data-node-id'),id);
   }
  }
  await load('four-page-links.csv');await inspectTable(4);
  const graphBefore=await page.evaluate(()=>JSON.stringify(document.getElementById('run-form').graph));
  // Keyboard traversal enters SVG nodes; Enter/Space retain inspection.
  await page.locator('.inspection-skip').focus();await page.keyboard.press('Tab');
  if(await page.evaluate(()=>document.activeElement.id==='graph-canvas'))await page.keyboard.press('Tab');
  assert.equal(await page.evaluate(()=>document.activeElement.classList.contains('graph-node')),true);
  await page.keyboard.press('Enter');await page.keyboard.press('Space');assert.equal(await detailURL(),'https://example.test/');
  assert.equal(await page.locator('.graph-node[aria-pressed=true]').evaluate(e=>e===document.activeElement),true);
  // Keyboard through the table, external action and an outbound inspection link.
  await page.locator('.inspection-skip').focus();await page.keyboard.press('Enter');await page.keyboard.press('Tab');
  for(let i=0;i<4;i++)await page.keyboard.press('Tab');
  const external=page.locator('.page-detail-content a');assert.equal(await external.evaluate(e=>e===document.activeElement),true);
  assert.equal(await external.getAttribute('target'),'_blank');assert.equal(await external.getAttribute('rel'),'noopener noreferrer');
  assert.equal(await external.getAttribute('referrerpolicy'),'no-referrer');
  await page.keyboard.press('Tab');const target=await page.evaluate(()=>document.activeElement.dataset.pageId);await page.keyboard.press('Enter');
  assert.equal(await detailURL(),target);assert.equal(await page.evaluate(()=>document.activeElement.closest('tbody')!==null),true);
  assert.equal(await page.evaluate(()=>JSON.stringify(document.getElementById('run-form').graph)),graphBefore);
  // Inspect actual accessibility tree: named buttons, structured table and live status.
  const ax=await page.locator('#page-inspection').ariaSnapshot();
  assert.match(ax,/table "Included pages and directed link counts"/);assert.match(ax,/button "Inspect page https:/);assert.match(ax,/heading "Selected page details"/);assert.match(ax,/status:/);
  for(const width of [768,320]) {
   await page.setViewportSize({width,height:1024});await page.locator('tbody button').first().focus();
   assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
   assert.equal(await page.locator('tbody button').first().evaluate(e=>getComputedStyle(e).outlineStyle),'solid');
   assert.ok(await page.locator('tbody button').first().evaluate(e=>e.getBoundingClientRect().height>=24));
  }
  await page.setViewportSize({width:1440,height:1100});
  if(process.env.DETAILS_SCREENSHOT_PATH)await page.locator('#page-inspection').screenshot({path:process.env.DETAILS_SCREENSHOT_PATH});
  await load('four-page-sitemap.xml','xml-import','');await inspectTable(4);
  assert.match(await page.locator('.page-detail-content').textContent(),/Unknown/);assert.equal(await page.locator('.page-detail-content button').count(),0);
  await load('hostile-page.html','html-import');await inspectTable(await page.locator('tbody button').count());
  assert.equal(await page.evaluate(()=>globalThis.phase5Executed),undefined);assert.equal(await page.locator('#page-inspection img,#page-inspection script,#page-inspection iframe').count(),0);
  await load('250-node-1000-edge-links.csv','csv-import','');await inspectTable(250);
  await page.locator('#reset-run').focus();await page.keyboard.press('Enter');assert.equal(await page.locator('#page-inspection').isVisible(),false);
  assert.equal(await page.locator('tbody button').count(),0);assert.deepEqual(errors,[]);assert.deepEqual(requests,[]);
  await page.evaluate(()=>fetch('https://canary.invalid/details-network-observer').catch(()=>{}));assert.equal(requests.length,1);
  console.log(JSON.stringify({browser:await browser.version(),protocol:'file:',keyboard:'skip/Tab/Enter/Space, 250 included pages, graph/list synchronization, neighbor navigation and reset passed',accessibility:'table headings, button names/states, live status, visible focus, 24px target and 320/768px reflow checks passed',remoteRequests:0,networkObserverControl:'passed',pageErrors:errors}));
 } finally {await browser.close();}
})().catch(e=>{console.error(e);process.exit(1);});
