const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const contracts=require('../js/contracts');
const outcomes=require('../js/outcome-report');
const run=mode=>contracts.createRun({mode,rootUrl:'https://example.org/?token=ROOT_SECRET'});
const graph=(extra={})=>({nodes:[{}],edges:[],issues:[],exclusions:[],partial:false,bytesRead:20,...extra});
test('outcomes distinguish bounded readable, supplied, partial, empty and unsupported results',()=>{
 for(const mode of ['live-cors','csv-import','xml-import','html-import']) {
  const report=outcomes.create({run:run(mode),graph:graph(),durationMs:123});
  assert.equal(report.outcome,mode==='live-cors'?'readable':'user-supplied');assert.equal(report.state,'complete');assert.equal(report.durationMs,123);
  assert.match(report.coverage,/No result proves full-site coverage/);assert.match(report.alternatives,/no hyperlinks or click depth/);
  assert.equal(outcomes.create({run:run(mode),graph:graph({nodes:[]})}).state,'failed');
 }
 assert.equal(outcomes.create({unsupported:true}).outcome,'not-supported');
 const partial=outcomes.create({run:run('live-cors'),graph:graph({truncated:true,exclusions:[{reason:'PAGE_LIMIT'},{reason:'PAGE_LIMIT'}]})});
 assert.equal(partial.outcome,'partial');assert.equal(partial.state,'partial');assert.equal(partial.exclusionsByReason.PAGE_LIMIT,2);assert.equal(partial.counts.exclusions,2);
 assert.equal(partial.limits.totalBytes,10000000);assert.equal(partial.limits.responseBytes,2000000);
});
for(const code of ['NETWORK_OR_POLICY_FAILURE','OPAQUE_RESPONSE','INPUT_MALFORMED','ROBOTS_EXCLUDED','ROBOTS_UNAVAILABLE','TIMEOUT','CANCELLED','HTTP_ERROR','SIZE_LIMIT','PARTIAL_LIMIT']) {
 test('terminal report preserves '+code+' and actionable recovery',()=>{
  const report=outcomes.create({run:run('live-cors'),result:{ok:false,issue:{code,message:'Diagnostic'}},durationMs:10});
  assert.equal(report.state,code==='CANCELLED'?'cancelled':'failed');assert.equal(report.outcome,'not-readable');
  assert.equal(report.issues[0].code,code);assert.match(report.guidance,new RegExp(code));assert.match(report.alternatives,/Saved HTML/);assert.equal(report.counts.pages,0);
  if(code==='NETWORK_OR_POLICY_FAILURE') assert.match(report.guidance,/does not reveal which cause/);
  if(code.startsWith('ROBOTS_')) assert.match(report.guidance,/ignores robots restrictions/);
 });
}
test('redaction removes queries, fragments and credentials from every diagnostic URL',()=>{
 const secret='https://user:PASS@example.org/path?token=SECRET#FRAGMENT';
 const report=outcomes.create({run:run('live-cors'),input:secret,result:{issue:{code:'HTTP_ERROR',message:'Failed '+secret,inputReference:secret},attempts:[{resourceUrl:secret,observedFinalUrl:secret,httpStatus:null,bytesRead:0,elapsedMs:1,issues:['HTTP_ERROR']}]}});
 const json=JSON.stringify(report);assert.doesNotMatch(json,/PASS|SECRET|FRAGMENT|token=/);assert.match(json,/example.org\/path/);assert.equal(report.attempts[0].httpStatus,null);
});
test('controller reports failures, empty imports, partial runs, cancellation and clears stale graphs',async()=>{
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=dom.window,f=w.document.getElementById('run-form');
 try {
  w.SitemapContracts=contracts;w.SitemapOutcomes=outcomes;
  let imported={ok:true}, included=graph();
  w.SitemapCsvImport={importFile:async()=>imported};w.SitemapGraph={buildGraph:()=>included};
  w.eval(fs.readFileSync('js/run-controls.js','utf8'));
  Object.defineProperty(f.elements.inputFile,'files',{value:[{name:'links.csv'}]});
  const submit=()=>f.onsubmit({preventDefault(){}});
  await submit();assert.equal(f.report.outcome,'user-supplied');
  included=graph({nodes:[]});await submit();assert.equal(f.report.state,'failed');assert.equal(f.report.counts.pages,0);
  imported={ok:false,issue:{code:'INPUT_MALFORMED',message:'Bad CSV'}};await submit();assert.equal(f.graph,null);assert.match(f.report.guidance,/Check the input format/);
  f.elements.mode.value='live-cors';f.elements.mode.onchange();f.elements.rootUrl.value='https://example.org/?token=SECRET';
  let finish;w.SitemapDiscovery={discover:()=>new Promise(r=>finish=r)};
  const pending=submit();w.document.getElementById('cancel-run').click();
  assert.equal(f.report.state,'cancelled');assert.equal(f.report.truncated,true);assert.equal(f.graph,null);
  finish({ok:false,issue:{code:'TIMEOUT'}});await pending;assert.equal(f.report.state,'cancelled');
  w.SitemapDiscovery={discover:async()=>({ok:false,issue:{code:'NETWORK_OR_POLICY_FAILURE',message:'Failed https://example.org/?token=SECRET'},attempts:[{resourceUrl:'https://example.org/?token=SECRET',httpStatus:null,bytesRead:0,elapsedMs:10,issues:['NETWORK_OR_POLICY_FAILURE']}]})};
  await submit();assert.equal(f.report.state,'failed');assert.equal(f.graph,null);
  assert.doesNotMatch(w.document.getElementById('run-diagnostics').textContent,/SECRET/);assert.doesNotMatch(w.document.getElementById('run-summary').textContent,/SECRET/);assert.doesNotMatch(w.document.getElementById('discovery-log').textContent,/SECRET/);
  imported={ok:true};f.elements.mode.value='csv-import';f.elements.mode.onchange();included=graph({partial:true,truncated:true,issues:[{code:'PARTIAL_LIMIT',message:'Cap reached'}]});await submit();assert.equal(f.report.outcome,'partial');
  f.elements.maxPages.value='0';await submit();assert.equal(f.graph,null);assert.equal(f.report.state,'failed');
  w.document.getElementById('reset-run').click();assert.equal(f.report,null);assert.equal(w.document.getElementById('outcome-report').hidden,true);
 } finally {w.close();}
});
test('a failed discovery reports each issue once, keeping distinct URLs and codes',()=>{
 const root={code:'NETWORK_OR_POLICY_FAILURE',message:'Unreadable',inputReference:'https://example.org/'};
 const map={...root,inputReference:'https://example.org/sitemap.xml'};
 const report=outcomes.create({run:run('live-cors'),result:{ok:false,issue:{...root},issues:[root,map]},issue:{code:'TIMEOUT',message:'Unreadable',inputReference:'https://example.org/'}});
 assert.deepEqual(report.issues.map(i=>[i.code,i.inputReference]),[['NETWORK_OR_POLICY_FAILURE','https://example.org/'],['NETWORK_OR_POLICY_FAILURE','https://example.org/sitemap.xml'],['TIMEOUT','https://example.org/']]);
 assert.equal(report.state,'failed');assert.equal(report.outcome,'not-readable');
});
