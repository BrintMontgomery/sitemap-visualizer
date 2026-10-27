"use strict";
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const contracts=require('../js/contracts');
const csv=require('../js/csv-import');
const graphApi=require('../js/graph');
const rendererApi=require('../js/graph-renderer');
const detailsApi=require('../js/page-details');
async function fixture(name='four-page-links.csv',extra={}) {
 const run=contracts.createRun({mode:'csv-import',rootUrl:'https://example.test/',maxPages:250,maxDepth:4,...extra});
 const text=fs.readFileSync('sample-data/'+name,'utf8');
 return graphApi.buildGraph(run,[await csv.importFile({name,size:Buffer.byteLength(text),text:async()=>text},run)]);
}
function setup(graph) {
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),doc=dom.window.document;
 let details;
 const renderer=rendererApi.create(doc.getElementById('graph-view'),graph,1,null,id=>details.select(id));
 const container=doc.getElementById('page-inspection');details=detailsApi.create(container,graph,renderer);
 return {dom,doc,container,renderer,details,buttons:()=>[...container.querySelectorAll('tbody button')],svg:()=>[...doc.querySelectorAll('.graph-node')],close(){details.destroy();renderer.destroy();dom.window.close();}};
}
function fields(container) {return Object.fromEntries([...container.querySelectorAll('dt')].map(e=>[e.textContent,e.nextElementSibling.textContent]));}
test('page table mirrors included graph and focus synchronizes details and graph selection without stealing focus',async()=>{
 const graph=await fixture(),before=JSON.stringify(graph),s=setup(graph);
 assert.equal(s.buttons().length,4);
 for(let i=0;i<graph.nodes.length;i++) {
  s.buttons()[i].focus();
  assert.equal(s.doc.activeElement,s.buttons()[i]);
  assert.equal(s.buttons()[i].getAttribute('aria-pressed'),'true');
  assert.equal(s.svg()[i].getAttribute('aria-pressed'),'true');
  assert.equal(s.container.querySelectorAll('tbody [aria-pressed=true]').length,1);
  const n=graph.nodes[i],f=fields(s.container);
  assert.equal(f.URL,n.url);assert.equal(f.Depth,String(n.depth));assert.equal(f.Title,'Unavailable');
  assert.equal(f['HTTP status'],'Unknown (not recorded)');assert.equal(f['Fetched by this application'],'No');
  assert.equal(f['Inbound links in included graph'],String(n.inDegree));assert.equal(f['Outbound links in included graph'],String(n.outDegree));
  assert.match(s.container.querySelector('.selection-status').textContent,/Selected https:/);
 }
 assert.equal(JSON.stringify(graph),before);s.close();
});
test('graph keyboard focus, Enter, Space and layout reset synchronize page selection and safe new-tab links',async()=>{
 const graph=await fixture(),s=setup(graph),w=s.dom.window;
 s.svg()[1].focus();assert.equal(s.buttons()[1].getAttribute('aria-pressed'),'true');
 for(const key of ['Enter',' ']) {
  s.svg()[2].dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
  assert.equal(s.buttons()[2].getAttribute('aria-pressed'),'true');
 }
 const link=s.container.querySelector('.page-detail-content a');
 assert.equal(link.href,graph.nodes[2].url);assert.equal(link.target,'_blank');assert.equal(link.rel,'noopener noreferrer');assert.equal(link.referrerPolicy,'no-referrer');
 assert.match(link.textContent,/new tab/);
 s.renderer.reset();assert.equal(s.container.querySelectorAll('tbody [aria-pressed=true]').length,0);
 assert.match(s.container.querySelector('.page-detail-content').textContent,/Select a page/);s.close();
});
test('included link buttons navigate inbound/outbound pages, show row provenance and put focus on a surviving table control',async()=>{
 const graph=await fixture(),s=setup(graph);
 s.buttons()[0].focus();
 assert.match(s.container.querySelector('.page-detail-content').textContent,/imported-link \| csv-import \| four-page-links.csv \| Row 2 \| Coverage: user-supplied/);
 const links=[...s.container.querySelectorAll('.page-detail-content button')];assert.equal(links.length,2);
 const id=links[0].dataset.pageId;links[0].click();
 assert.equal(fields(s.container).URL,id);assert.equal(s.doc.activeElement.dataset.pageId,id);
 assert.equal(s.doc.activeElement.closest('tbody')!==null,true);
 const inbound=s.container.querySelector('.page-detail-content button[aria-label^="Inspect inbound"]');
 assert.equal(inbound.dataset.pageId,graph.nodes[0].id);inbound.click();assert.equal(fields(s.container).URL,graph.nodes[0].url);s.close();
});
test('hostile page metadata and evidence render only as text; unsafe destinations never get hrefs',async()=>{
 const base=await fixture(),hostile='<img src="https://invalid.test" onerror="alert(1)">';
 const graph={...base,nodes:base.nodes.map(n=>({...n,title:hostile,httpStatus:200,evidence:[{evidenceClass:'observed-html',transport:'file',inputReference:hostile,sourceUrl:n.url,anchor:1,coverageStatus:'user-supplied'}]}))};
 const s=setup(graph);s.buttons()[0].focus();
 assert.equal(fields(s.container).Title,hostile);assert.equal(fields(s.container)['HTTP status'],'200');
 assert.equal(s.container.querySelector('img,script,iframe'),null);assert.match(s.container.textContent,/Anchor 1/);
 s.close();
 for(const url of ['javascript:alert(1)','data:text/html,hello','https://user:secret@example.test/','not a URL']) {
  const n={...base.nodes[0],id:url,url};const view=new JSDOM(fs.readFileSync('index.html','utf8'));
  const container=view.window.document.getElementById('page-inspection');
  const d=detailsApi.create(container,{nodes:[n],edges:[]},{select(){}});d.select(url);
  assert.equal(container.querySelector('.page-detail-content a'),null);d.destroy();view.window.close();
 }
});
test('unknown-depth sitemap inventory shows no invented hyperlinks and only included neighbors are listed',async()=>{
 const g=await fixture(),n={...g.nodes[0],depth:null,inDegree:0,outDegree:0,evidence:[{evidenceClass:'sitemap-only',transport:'file',inputReference:'inventory.xml',coverageStatus:'user-supplied'}]};
 const s=setup({...g,nodes:[n],edges:[]});s.buttons()[0].focus();
 assert.equal(fields(s.container).Depth,'Unknown');assert.match(s.container.textContent,/sitemap-only/);
 assert.equal(s.container.querySelectorAll('.page-detail-content button').length,0);s.close();
 const capped=await fixture('four-page-links.csv',{maxPages:2});const t=setup(capped);t.buttons()[0].focus();
 assert.equal(fields(t.container)['Outbound links in included graph'],'1');assert.equal(t.container.querySelectorAll('.page-detail-content button').length,1);t.close();
});
test('every page in dense and disconnected graphs has a labeled native keyboard control and accurate selection',async()=>{
 const graph=await fixture('250-node-1000-edge-links.csv',{rootUrl:null}),s=setup(graph);
 assert.equal(s.buttons().length,250);
 for(const [i,b] of s.buttons().entries()) {b.focus();assert.equal(fields(s.container).URL,graph.nodes[i].url);assert.equal(fields(s.container).Depth,'Unknown');assert.equal(s.svg()[i].getAttribute('aria-pressed'),'true');}
 assert.equal(s.container.querySelectorAll('thead [scope=col]').length,4);
 assert.equal(s.container.querySelectorAll('tbody th[scope=row]').length,250);
 assert.equal(s.container.querySelector('.selection-status').getAttribute('role'),'status');s.close();
});
test('disposed detail views ignore old controls, invalid selections, and callbacks',async()=>{
 const graph=await fixture(),s=setup(graph),old=s.buttons()[0];
 s.details.select('not-in-graph');assert.equal(s.container.querySelector('dl'),null);
 s.details.destroy();s.details.destroy();old.click();s.details.select(graph.nodes[0].id);
 assert.equal(s.container.hidden,true);assert.equal(s.container.querySelector('tbody').childElementCount,0);assert.equal(s.container.querySelector('.page-detail-content').childElementCount,0);
 s.close();
});
test('controller clears details on replacement/reset, and cancelled or stale imports cannot restore old selection',async()=>{
 const graph=await fixture(),dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,doc=w.document,form=doc.getElementById('run-form');
 const pending=[];w.SitemapContracts=contracts;w.SitemapRenderer=rendererApi;w.SitemapDetails=detailsApi;
 w.SitemapGraph={buildGraph:()=>graph};w.SitemapCsvImport={importFile:()=>new Promise(resolve=>pending.push(resolve))};
 w.SitemapOutcomes=require('../js/outcome-report');w.eval(fs.readFileSync('js/run-controls.js','utf8'));form.elements.mode.value='csv-import';form.elements.mode.onchange();Object.defineProperty(form.elements.inputFile,'files',{value:[{name:'links.csv'}]});
 const submit=()=>form.onsubmit({preventDefault(){}}),container=doc.getElementById('page-inspection');
 let run=submit();pending.shift()({ok:true});await run;container.querySelector('tbody button').focus();assert.ok(container.querySelector('dl'));
 const staleRun=submit(),stale=pending.shift();assert.equal(container.hidden,true);assert.equal(container.querySelectorAll('button').length,0);
 run=submit();pending.shift()({ok:true});await run;const buttons=[...container.querySelectorAll('tbody button')];buttons[1].focus();
 stale({ok:true});await staleRun;assert.equal(fields(container).URL,graph.nodes[1].url);
 run=submit();const cancelled=pending.shift();doc.getElementById('cancel-run').click();cancelled({ok:true});await run;assert.equal(container.hidden,true);
 run=submit();pending.shift()({ok:true});await run;doc.getElementById('reset-run').click();assert.equal(container.hidden,true);assert.equal(container.querySelectorAll('tbody button').length,0);dom.window.close();
});
