const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const api=require('../js/exports');
const contracts=require('../js/contracts');
const csvImport=require('../js/csv-import');
const graphApi=require('../js/graph');
const outcomes=require('../js/outcome-report');
async function fixture(maxPages=50){
 const run=contracts.createRun({mode:'csv-import',rootUrl:'https://example.test/',maxPages,maxDepth:4});
 const text=fs.readFileSync('sample-data/four-page-links.csv','utf8');
 const batch=await csvImport.importFile({name:'links.csv',size:Buffer.byteLength(text),text:async()=>text},run);
 const graph=graphApi.buildGraph(run,[batch]);
 const report=outcomes.create({id:'test-1',run,result:batch,graph,durationMs:5});
 return {graph,report};
}
function rows(text){
 const result=require('node:child_process').spawnSync('python',['-c','import csv,io,json,sys; print(json.dumps(list(csv.reader(io.StringIO(sys.stdin.read().lstrip("\\ufeff"))))))'],{input:text,encoding:'utf8'});
 assert.equal(result.status,0,result.stderr);return JSON.parse(result.stdout);
}
function objects(text){const r=rows(text);return r.slice(1).map(row=>Object.fromEntries(r[0].map((key,i)=>[key,row[i]])));}
test('CSV schemas round-trip stable IDs, directions, exact provenance and repeated run qualifiers',async()=>{
 const {graph,report}=await fixture();
 for(const kind of ['pages','links']){
  const text=api.csv(kind,graph,report), data=objects(text);
  assert.ok(text.startsWith('\ufeff'));assert.ok(text.endsWith('\r\n'));
  assert.deepEqual(rows(text)[0],api.schemas[kind]);
  assert.equal(data.length,4);
  data.forEach((row,i)=>{
   assert.equal(row.record_type,'data');assert.equal(row.run_id,'test-1');assert.equal(row.started_at,report.startedAt);
   assert.equal(row.partial,'false');assert.equal(row.coverage,report.coverage);
   assert.deepEqual(JSON.parse(row.limits_json),JSON.parse(JSON.stringify(report.limits)));
   const source=graph[kind==='pages'?'nodes':'edges'][i];
   assert.deepEqual(JSON.parse(row.evidence_json),source.evidence);
   assert.equal(row[kind==='pages'?'page_id':'link_id'],source.id);
   if(kind==='links'){assert.equal(row.source_id,source.source);assert.equal(row.target_id,source.target);}
  });
 }
});
test('CSV escaping preserves commas, quotes, multiline Unicode and neutralizes formula variants',async()=>{
 const {graph,report}=await fixture();
 const values=['=SUM(1,2)',' +cmd','\t@SUM(A1)','\r-1','\n=1','\u0000=1','\uFEFF=1','"quotes", café\r\nnext line','ordinary'];
 for(const value of values){
  const copy=structuredClone(graph);copy.nodes[0].title=value;
  const title=objects(api.csv('pages',copy,report))[0].title;
  assert.equal(title,(values.indexOf(value)<7?"'":'')+value);
 }
 assert.equal(api.cell(null),'""');assert.equal(api.cell(0),'"0"');assert.equal(api.cell(false),'"false"');
});
test('partial reports preserve exclusions and unknown depth stays empty; inventory never creates links',async()=>{
 const {graph,report}=await fixture(2), pages=objects(api.csv('pages',graph,report));
 assert.ok(pages.every(r=>r.partial==='true'&&r.truncated==='true'));
 assert.deepEqual(JSON.parse(pages[0].exclusions_json),report.exclusionsByReason);
 const copy=structuredClone(graph);copy.nodes[0].depth=null;copy.edges=[];
 copy.memberships=[{url:copy.nodes[0].url,sourceSitemap:'https://example.test/sitemap.xml',evidence:[{evidenceClass:'sitemap-only'}]}];
 const page=objects(api.csv('pages',copy,report))[0];assert.equal(page.depth,'');assert.equal(JSON.parse(page.memberships_json).length,1);
 const links=objects(api.csv('links',copy,report));assert.equal(links.length,1);assert.equal(links[0].record_type,'metadata');assert.equal(links[0].source_id,'');assert.equal(links[0].coverage,report.coverage);
});
test('export availability and download names reject unusable results and path characters',async()=>{
 const {graph,report}=await fixture();
 assert.ok(api.available(graph,report));
 for(const state of ['failed','cancelled','running','queued'])assert.throws(()=>api.csv('pages',graph,{...report,state}));
 assert.throws(()=>api.csv('pages',{nodes:[]},report));assert.throws(()=>api.csv('unknown',graph,report));
 assert.match(api.filename('pages','../../evil\r\n"/\\:*?<>|'),/^sitemap-pages-[a-zA-Z0-9_-]+\.csv$/);
 assert.ok(api.filename('png','a'.repeat(1000)).length<100);
});
test('SVG captures the current viewport, node positions, inline colors, legend and qualified coverage',async()=>{
 const {graph,report}=await fixture(2);
 const dom=new JSDOM('<svg viewBox="0 0 1000 700"><defs><marker id="arrow"/></defs><g transform="translate(120 80) scale(2)"><path marker-end="url(#arrow)" style="stroke:#94a3b8;fill:none"/><g transform="translate(42 33)"><circle r="20" fill="#f59e0b"/><text>Label</text></g></g></svg>');
 const svg=dom.window.document.querySelector('svg'), original=svg.outerHTML;
 const out=api.svgSnapshot(svg,graph,report);
 assert.equal(svg.outerHTML,original);
 assert.equal(out.querySelector('svg g').getAttribute('transform'),'translate(120 80) scale(2)');
 assert.equal(out.querySelector('path').getAttribute('marker-end'),'url(#arrow)');
 assert.match(out.querySelector('path').getAttribute('style'),/stroke:/);
 assert.match(out.textContent,/Unknown depth/);assert.match(out.textContent,/Partial: true/);assert.match(Array.from(out.querySelectorAll("text")).map(n=>n.textContent).join(" "),/No result proves full-site coverage/);
 assert.equal(out.querySelectorAll('image,foreignObject,script').length,0);
 dom.window.close();
});
test('download releases URL and anchor even when click fails',()=>{
 const dom=new JSDOM('<body/>'),w=dom.window, revoked=[];
 w.URL.createObjectURL=()=> 'blob:test';w.URL.revokeObjectURL=u=>revoked.push(u);w.setTimeout=fn=>fn();
 w.HTMLAnchorElement.prototype.click=function(){assert.equal(this.download,'safe.csv');throw Error('blocked');};
 assert.throws(()=>api.download(new w.Blob(['x']),'safe.csv',w.document),/blocked/);
 assert.deepEqual(revoked,['blob:test']);assert.equal(w.document.querySelector('a'),null);w.close();
});
test('PNG reports decode, canvas, encoding, timeout and setup errors and revokes its intermediate URL',async()=>{
 const {graph,report}=await fixture();
 for(const failure of ['decode','canvas','encoding','timeout','setup']){
  const dom=new JSDOM('<svg/>'),w=dom.window, revoked=[];let image;
  w.Image=function(){image=this;};
  w.URL.createObjectURL=()=>{if(failure==='setup')throw Error('setup');return 'blob:svg';};w.URL.revokeObjectURL=u=>revoked.push(u);
  w.HTMLCanvasElement.prototype.getContext=()=>failure==='canvas'?null:{drawImage(){}};
  w.HTMLCanvasElement.prototype.toBlob=fn=>fn(null);
  let timeout;w.setTimeout=fn=>{timeout=fn;return 1;};w.clearTimeout=()=>{};
  const pending=api.png(w.document.querySelector('svg'),graph,report);
  if(failure==='decode')image.onerror();else if(failure==='timeout')timeout();else if(failure!=='setup')image.onload();
  await assert.rejects(pending);
  assert.deepEqual(revoked,failure==='setup'?[]:['blob:svg']);w.close();
 }
});
test('export controls enable after reporting, preserve graph on failure and discard stale pending PNG',async()=>{
 const {graph,report}=await fixture(),dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,f=w.document.getElementById('run-form');
 w.SitemapContracts=contracts;w.SitemapOutcomes=outcomes;
 w.SitemapCsvImport={importFile:async()=>({ok:true})};w.SitemapGraph={buildGraph:()=>graph};
 let finish,downloads=0;
 w.SitemapExports={...api,png:()=>new Promise(resolve=>finish=resolve),download:()=>downloads++};
 w.eval(fs.readFileSync('js/run-controls.js','utf8'));
 Object.defineProperty(f.elements.inputFile,'files',{value:[{name:'links.csv'}]});
 f.elements.rootUrl.value='https://example.test/';
 const button=w.document.getElementById('export-png'), output=w.document.getElementById('export-status');
 assert.equal(button.disabled,true);
 await f.onsubmit({preventDefault(){}});assert.equal(button.disabled,false);
 const pending=button.onclick();assert.equal(button.disabled,true);
 w.document.getElementById('reset-run').click();finish(new w.Blob(['old']));await pending;
 assert.equal(downloads,0);assert.equal(button.disabled,true);assert.match(output.textContent,/Complete an analysis/);
 await f.onsubmit({preventDefault(){}});
 w.SitemapExports.png=async()=>{throw Error('encoder');};
 await button.onclick();assert.match(output.textContent,/Export failed/);assert.equal(f.graph,graph);
 assert.equal(w.document.getElementById('export-pages').disabled,false);
 await w.document.getElementById('export-pages').onclick();assert.equal(downloads,1);
 w.close();
});
