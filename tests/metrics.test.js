'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const metrics=require('../js/metrics');
const graphApi=require('../js/graph');
const contracts=require('../js/contracts');
const outcomes=require('../js/outcome-report');
const exporters=require('../js/exports');
const rendererApi=require('../js/graph-renderer');
const detailsApi=require('../js/page-details');
const root='https://example.test/';
const file=(text,name)=>({name,size:Buffer.byteLength(text),text:async()=>text});
async function fixture(options={}){
 const dom=new JSDOM(''),previousDocument=global.document,previousParser=global.DOMParser;
 global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;
 try{
  const run=contracts.createRun({mode:'xml-import',rootUrl:root,maxDepth:4,...options});
  const inventory=await require('../js/xml-import').importFiles([{file:file(fs.readFileSync('sample-data/metrics-inventory.xml','utf8'),'metrics.xml')}],contracts.createRun({mode:'xml-import'}));
  const html=await require('../js/html-import').importFile(file('<a href="/observed">one</a><a href="/observed#again">two</a>','home.html'),contracts.createRun({mode:'html-import'}),root);
  const csv=await require('../js/csv-import').importFile(file(`source,target\n${root},${root}asserted\n${root}asserted,${root}asserted\n`,'links.csv'),contracts.createRun({mode:'csv-import'}));
  const graph=graphApi.buildGraph(run,[inventory,html,csv]);
  const report=outcomes.create({id:14,run,graph,result:{ok:true},durationMs:7});
  return {run,graph,report};
 }finally{global.document=previousDocument;global.DOMParser=previousParser;dom.window.close();}
}
test('mixed inventory, observed HTML and supplied links yield exact components, degrees and qualified candidates',async()=>{
 const {graph}=await fixture(),before=JSON.stringify(graph),m=metrics.analyze(graph);
 assert.equal(m.pageCount,4);assert.equal(m.edgeCount,3);assert.equal(m.observedEdgeCount,1);assert.equal(m.componentCount,2);
 assert.deepEqual(m.components.map(c=>c.size),[3,1]);
 assert.deepEqual(m.candidates,[root+'asserted',root+'isolated']);
 assert.equal(m.pages.find(p=>p.id===root+'asserted').inDegree,2);
 assert.equal(m.pages.find(p=>p.id===root+'asserted').observedInDegree,0);
 assert.equal(m.pages.find(p=>p.id===root+'observed').observedInDegree,1);
 assert.deepEqual(m.depthDistribution,[{value:0,count:1},{value:1,count:2},{value:null,count:1}]);
 for(const n of graph.nodes){const p=m.pages.find(p=>p.id===n.id);assert.equal(p.inDegree,n.inDegree);assert.equal(p.outDegree,n.outDegree);}
 assert.match(m.qualification,/No candidate is proof/);assert.equal(JSON.stringify(graph),before);
 assert.ok(Object.isFrozen(m.pages[0]));assert.ok(Object.isFrozen(m.components[0].pageIds));
});
test('weak components handle directed cycles, reciprocal links, self loops and isolated nodes deterministically',()=>{
 const nodes=['a','b','c','d','e'].map(id=>({id,url:id,depth:null}));
 const edge=(source,target)=>({source,target,evidence:[{evidenceClass:'observed-html'},{evidenceClass:'imported-link'}]});
 const edges=[edge('b','a'),edge('a','b'),edge('b','b'),edge('c','d')];
 const g={nodes,edges,memberships:[],rootUrl:null},m=metrics.analyze(g);
 assert.deepEqual(m.components.map(c=>c.pageIds),[['a','b'],['c','d'],['e']]);
 assert.equal(m.pages.find(p=>p.id==='b').inDegree,2);assert.equal(m.pages.find(p=>p.id==='b').outDegree,2);
 assert.deepEqual(metrics.analyze({...g,nodes:[...nodes].reverse(),edges:[...edges].reverse()}),m);
 assert.equal(m.candidateCount,0);assert.equal(m.observedEdgeCount,4);
});
test('inventory alone never creates edges or depth and excludes the selected root from candidates',async()=>{
 const {graph}=await fixture();
 const inventory={...graph,edges:[],nodes:graph.nodes.map(n=>({...n,depth:null})),redirectAliases:[{source:root,target:root+'isolated'}]};
 const m=metrics.analyze(inventory);
 assert.equal(m.edgeCount,0);assert.equal(m.componentCount,4);assert.equal(m.candidateCount,3);
 assert.deepEqual(m.depthDistribution,[{value:null,count:4}]);
 assert.deepEqual(m.inDegreeDistribution,[{value:0,count:4}]);
 assert.equal(metrics.analyze({...inventory,memberships:[]}).candidateCount,0);
 assert.equal(metrics.analyze({...inventory,rootUrl:null}).candidateCount,4);
 const empty=metrics.analyze({nodes:[],edges:[],memberships:[]});assert.equal(empty.componentCount,0);assert.deepEqual(empty.depthDistribution,[]);
});
test('bounded and failed-branch reports keep metrics limited to included records and retain qualification',async()=>{
 const {graph,report}=await fixture({maxPages:2}),m=metrics.analyze(graph);
 assert.equal(m.pageCount,2);assert.equal(m.edgeCount,2);assert.equal(m.componentCount,1);assert.ok(graph.truncated);
 const dom=new JSDOM('<section/>'),container=dom.window.document.querySelector('section');
 metrics.render(container,m,{...report,counts:{...report.counts,failedRequests:1},coverage:'Coverage: partial. Blocked branch unknown.'});
 assert.match(container.textContent,/2 pages \| 2 rendered links/);assert.match(container.textContent,/1 failed requests/);
 assert.match(container.textContent,/Blocked branch unknown/);assert.match(container.textContent,/bounded content may contain incoming links/);
 assert.match(container.textContent,/excluded records/);dom.window.close();
});
test('CSV and PNG metrics agree with analysis and preserve per-page observed evidence distinctions',async()=>{
 const {graph,report}=await fixture(),m=metrics.analyze(graph);
 function parse(text){const r=require('node:child_process').spawnSync('python',['-c','import csv,io,json,sys; print(json.dumps(list(csv.DictReader(io.StringIO(sys.stdin.read().lstrip("\\ufeff"))))))'],{input:text,encoding:'utf8'});assert.equal(r.status,0,r.stderr);return JSON.parse(r.stdout);}
 for(const kind of ['pages','links']){
  const rows=parse(exporters.csv(kind,graph,report));
  for(const row of rows){assert.deepEqual(JSON.parse(row.metrics_json),metrics.summary(m));assert.equal(row.duration_ms,'7');}
  if(kind==='pages')for(const row of rows){const p=m.pages.find(p=>p.id===row.page_id);assert.equal(row.component_id,p.componentId);assert.equal(row.orphan_candidate,String(p.orphanCandidate));assert.equal(row.observed_html_in_degree,String(p.observedInDegree));}
 }
 const dom=new JSDOM('<svg/>');const snapshot=exporters.svgSnapshot(dom.window.document.querySelector('svg'),graph,report);
 const text=[...snapshot.querySelectorAll('text')].map(n=>n.textContent).join(' ');
 assert.match(text,/2 weak components/);assert.match(text,/2 candidate orphans/);assert.match(text,/Unknown=1/);assert.match(text,/No candidate is proof of a global orphan/);dom.window.close();
});
test('metric UI renders hostile candidate IDs as text and can clear stale contents',async()=>{
 const {graph,report}=await fixture(),m=metrics.analyze(graph),dom=new JSDOM('<section/>'),container=dom.window.document.querySelector('section');
 metrics.render(container,{...m,candidates:['<img src=x onerror=alert(1)>']},report);
 assert.equal(container.querySelector('img'),null);assert.match(container.textContent,/<img/);
 assert.equal(container.querySelectorAll('table caption').length,3);
 metrics.render(container,null,report);assert.equal(container.hidden,true);assert.equal(container.childElementCount,0);dom.window.close();
});
test('direction highlights follow selection and reset without changing graph or pinned positions',async()=>{
 const {graph}=await fixture(),before=JSON.stringify(graph),dom=new JSDOM(fs.readFileSync('index.html','utf8')),doc=dom.window.document;
 const view=doc.getElementById('graph-view'),renderer=rendererApi.create(view,graph,14),control=view.querySelector('select');
 function mode(value){control.value=value;control.dispatchEvent(new dom.window.Event('change'));}
 function active(){return [...view.querySelectorAll('.graph-edge.is-highlighted')].map(e=>e.dataset.edgeId).sort();}
 renderer.pin(root,45,67);const layout=JSON.stringify(renderer.getLayoutState());
 mode('outbound');assert.equal(active().length,2);assert.equal(view.querySelectorAll('.is-neighbor').length,2);
 mode('inbound');assert.equal(active().length,0);
 renderer.select(root+'asserted');assert.equal(active().length,2);
 mode('both');assert.equal(active().length,2);
 mode('none');assert.equal(active().length,0);assert.equal(JSON.stringify(renderer.getLayoutState()),layout);
 mode('both');renderer.reset();assert.equal(active().length,0);
 renderer.select(root+'isolated');assert.equal(active().length,0);
 assert.equal(JSON.stringify(graph),before);renderer.destroy();mode('outbound');assert.equal(view.querySelectorAll('svg *').length,0);dom.window.close();
});
test('controller metrics and selected page fields clear on reset, failure, replacement and stale result',async()=>{
 const {graph}=await fixture(),dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,doc=w.document,f=doc.getElementById('run-form'),pending=[];
 Object.assign(w,{SitemapContracts:contracts,SitemapOutcomes:outcomes,SitemapMetrics:metrics,SitemapRenderer:rendererApi,SitemapDetails:detailsApi,SitemapGraph:{buildGraph:()=>graph},SitemapCsvImport:{importFile:()=>new Promise(resolve=>pending.push(resolve))}});
 w.eval(fs.readFileSync('js/run-controls.js','utf8'));f.elements.mode.value='csv-import';f.elements.mode.onchange();Object.defineProperty(f.elements.inputFile,'files',{value:[{name:'links.csv'}]});
 const submit=()=>f.onsubmit({preventDefault(){}}),panel=doc.getElementById('graph-metrics');
 let task=submit();pending.shift()({ok:true});await task;assert.equal(panel.hidden,false);assert.equal(f.metrics.candidateCount,2);
 doc.querySelector('#page-inspection tbody button').focus();assert.match(doc.querySelector('.page-detail-content').textContent,/Weak component/);
 const stale=submit(),finish=pending.shift();assert.equal(panel.hidden,true);assert.equal(f.metrics,null);
 task=submit();pending.shift()({ok:true});await task;finish({ok:true});await stale;assert.equal(panel.hidden,false);
 task=submit();pending.shift()({ok:false,issue:{code:'NETWORK_OR_POLICY_FAILURE'}});await task;assert.equal(panel.hidden,true);assert.equal(f.metrics,null);
 task=submit();pending.shift()({ok:true});await task;doc.getElementById('reset-run').click();assert.equal(panel.hidden,true);assert.equal(panel.childElementCount,0);assert.equal(f.metrics,null);w.close();
});
