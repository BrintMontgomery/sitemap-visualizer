const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const contracts=require('../js/contracts');
const setup=()=>{
  const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}), w=dom.window;
  w.SitemapContracts=contracts;
  w.SitemapGraph={buildGraph:(run,batches)=>({nodes:[{url:"http://intranet/"}],edges:[],exclusions:[],issues:[],partial:false,tag:batches[0].tag})};
  return {dom,w,f:w.document.getElementById('run-form'),status:w.document.getElementById('run-status')};
};
test('live controls validate expanded budgets, clamp import ranges, and isolate cancelled/replaced runs',async()=>{
  const {dom,w,f,status}=setup(), calls=[];
  try {
    w.SitemapDiscovery={discover:(run,options)=>new Promise(resolve=>calls.push({run,options,resolve}))};
    w.SitemapOutcomes=require('../js/outcome-report');w.eval(fs.readFileSync('js/run-controls.js','utf8'));
    const submit=()=>f.onsubmit({preventDefault(){}});
    f.elements.mode.value='live-cors'; f.elements.mode.onchange(); f.elements.rootUrl.value='http://intranet/';
    assert.equal(f.elements.maxPages.max,'1000'); assert.equal(f.elements.maxDepth.max,'20');
    assert.equal(f.elements.maxConcurrency.disabled,false);
    f.elements.maxConcurrency.value='9'; await submit(); assert.equal(status.dataset.state,'failed'); assert.equal(calls.length,0);
    f.elements.maxConcurrency.value='3';f.elements.maxPages.value='1000'; f.elements.maxDepth.value='20'; f.elements.runDurationSeconds.value='300';
    const first=submit();assert.equal(calls[0].run.maxDurationMs,300000);assert.equal(calls[0].run.maxConcurrency,3);
    calls[0].options.onProgress({requested:1,queued:4,active:2,observedEdges:3,failed:0,bytesRead:123});assert.match(status.textContent,/4 queued/);
    w.document.getElementById('cancel-run').click();assert.equal(calls[0].options.signal.aborted,true);
    calls[0].options.onProgress({requested:99});assert.equal(status.dataset.state,'cancelled');
    const second=submit();
    calls[1].resolve({ok:true,batches:[{tag:'latest'}],attempts:[]}); await second;assert.equal(f.graph.tag,'latest');assert.equal(status.dataset.state,'complete');
    calls[0].resolve({ok:true,batches:[{tag:'old'}],attempts:[]});await first;assert.equal(f.graph.tag,'latest');
    f.elements.mode.value='csv-import';f.elements.mode.onchange();assert.equal(f.elements.maxPages.value,'250');assert.equal(f.elements.maxDepth.value,'4');assert.equal(f.elements.runDurationSeconds.disabled,true);
    w.document.getElementById('reset-run').click();assert.equal(f.graph,null);assert.equal(w.document.getElementById('discovery-log').hidden,true);
  } finally {dom.window.close();}
});
test('request diagnostics render hostile endpoint text safely, including failed-root attempts',async()=>{
  const {dom,w,f,status}=setup();
  try {
    w.SitemapDiscovery={discover:async()=>({ok:false,issue:{code:'NETWORK_OR_POLICY_FAILURE',message:'Unknown cause'},attempts:[{resourceUrl:'<script>bad</script>',httpStatus:null,observedFinalUrl:null,bytesRead:0,elapsedMs:12,issues:['NETWORK_OR_POLICY_FAILURE']}]})};
    w.SitemapOutcomes=require('../js/outcome-report');w.eval(fs.readFileSync('js/run-controls.js','utf8'));f.elements.mode.value='live-cors';f.elements.mode.onchange();f.elements.rootUrl.value='http://intranet/';
    await f.onsubmit({preventDefault(){}});assert.equal(status.dataset.state,'failed');assert.equal(f.graph,null);
    assert.equal(w.document.querySelector('#discovery-log script'),null);assert.match(w.document.getElementById('discovery-log').textContent,/<script>bad/);assert.match(w.document.getElementById('discovery-log').textContent,/HTTP status unknown/);
  } finally {dom.window.close();}
});
