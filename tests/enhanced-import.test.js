'use strict';
const {test, beforeEach, afterEach} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const c = require('../js/contracts'), api = require('../js/enhanced-import'), graphs = require('../js/graph');
const metrics = require('../js/metrics'), exportsApi = require('../js/exports'), outcomes = require('../js/outcome-report');
const root = 'https://example.test/';
const file = (text, name) => ({name, size: Buffer.byteLength(text), text: async () => text});
const run = (mode='html-import', extra={}) => c.createRun({mode, rootUrl:root, maxDepth:4, ...extra});
let dom, oldDoc, oldParser;
beforeEach(()=>{dom=new JSDOM('');oldDoc=global.document;oldParser=global.DOMParser;global.document=dom.window.document;global.DOMParser=dom.window.DOMParser;});
afterEach(()=>{global.document=oldDoc;global.DOMParser=oldParser;dom.window.close();});
function inventory(urls){return '<urlset>'+urls.map(u=>'<url><loc>'+u+'</loc></url>').join('')+'</urlset>';}

test('paste parses three explicit kinds with original evidence classes and localized failures',async()=>{
 const r=run('paste-import');
 for(const [kind,text,source,expected] of [
  ['html','<title>Pasted</title><a href="/a">A</a>',root,'observed-html'],
  ['xml',inventory([root+'a']),root+'sitemap.xml','sitemap-only'],
  ['csv','source,target\n'+root+','+root+'a',null,'imported-link']
 ]){
  const result=await api.importPaste(text,kind,source,r);assert.equal(result.ok,true);
  const graph=graphs.buildGraph(r,result.batches);assert.ok(graph.nodes.length);
  assert.equal(graph.acquisitions[0].evidenceClass,expected);assert.match(graph.acquisitions[0].inputReference,/Pasted input/);
  if(kind==='xml'){assert.equal(graph.edges.length,0);assert.equal(graph.nodes[0].depth,null);}
 }
 for(const [text,kind,source,code] of [['','csv',null,'INPUT_MALFORMED'],['x','auto',null,'INPUT_MALFORMED'],['<a/>','html',null,'URL_REJECTED'],['<urlset>','xml',null,'INPUT_MALFORMED'],['wrong,header','csv',null,'INPUT_MALFORMED'],['é'.repeat(1000001),'csv',null,'SIZE_LIMIT'],['x'.repeat(2000001),'html',root,'SIZE_LIMIT']]){
  const result=await api.importPaste(text,kind,source,r);assert.equal(result.ok,false);assert.equal(result.issue.code,code);assert.ok(result.issue.inputReference);
 }
});

test('mixed files preserve HTML and XML provenance, explicit mappings and missing references',async()=>{
 const r=run(),calls=[];
 const selected=(text,name,kind,sourceUrl)=>({kind,sourceUrl,file:{...file(text,name),text:async()=>{calls.push(name);return text;}}});
 const result=await api.importSelected([
  selected('<a href="/guide/page">Guide</a>','home.html','html',root),
  selected('<a href="/contact">Contact</a>','guide.html','html',root+'guide/page'),
  selected('<sitemapindex><sitemap><loc>'+root+'child.xml</loc></sitemap><sitemap><loc>'+root+'missing.xml</loc></sitemap></sitemapindex>','index.xml','xml',root+'sitemap.xml'),
  selected(inventory([root+'guide/page',root+'isolated']),'child.xml','xml',root+'child.xml'),
  selected('<script>throw Error()</script>','unreferenced.xml','xml',root+'unused.xml'),
  selected('source,target\n'+root+','+root+'contact','assertions.csv','csv')
 ],r);
 assert.equal(result.ok,true);assert.deepEqual(calls,['home.html','guide.html','index.xml','child.xml','assertions.csv']);
 assert.ok(result.issues.some(i=>i.inputReference==='index.xml'&&i.message.includes('missing.xml')));
 const g=graphs.buildGraph(r,result.batches);assert.equal(g.edges.length,3);assert.equal(g.nodes.length,4);
 assert.equal(g.nodes.find(n=>n.url===root+'guide/page').depth,1);
 assert.equal(g.nodes.find(n=>n.url===root+'isolated').depth,null);
 assert.equal(g.edges.find(e=>e.source===root+'guide/page').evidence[0].inputReference,'guide.html');
 assert.ok(g.acquisitions.some(a=>a.inputReference==='child.xml'));
 assert.equal(g.memberships.find(m=>m.url===root+'isolated').sourceSitemap,root+'child.xml');
});

test('preflight rejects excessive files, bytes and missing mappings before any read',async()=>{
 let calls=0;const f={name:'a.html',size:1,text:async()=>{calls++;return 'a';}};
 for(const selected of [Array.from({length:129},()=>({file:f})),[{file:{...f,size:2000001},sourceUrl:root}],[{file:f}],Array.from({length:6},()=>({file:{...f,size:2000000},sourceUrl:root}))])assert.equal((await api.importSelected(selected,run())).ok,false);
 assert.equal(calls,0);
 const result=await api.importSelected([{file:file('<urlset/>','a.xml'),sourceUrl:root+'s.xml'},{file:file('<urlset/>','b.xml'),sourceUrl:root+'s.xml'}],run('xml-import'));
 assert.equal(result.ok,false);assert.match(result.issue.message,/Duplicate/);
});

test('actual UTF-8 totals and combined record budget exclude excess files with partial coverage',async()=>{
 const selected=Array.from({length:6},(_,i)=>({file:{...file('x'.repeat(1900000),'a'+i+'.html'),size:0},sourceUrl:root+i}));
 const result=await api.importSelected(selected,run());assert.equal(result.ok,true);assert.equal(result.batches.length,5);assert.equal(result.truncated,true);assert.ok(result.issues.some(i=>i.code==='SIZE_LIMIT'));
 const html='<a href="/a">A</a>'.repeat(6000);
 const records=await api.importSelected([{file:file(html,'a.html'),sourceUrl:root},{file:file(html,'b.html'),sourceUrl:root+'b'}],run());
 assert.equal(records.batches.length,1);assert.equal(records.truncated,true);assert.ok(records.issues.some(i=>i.code==='PARTIAL_LIMIT'));
});

test('malformed and unreadable files localize issues while retaining valid selected inputs',async()=>{
 const result=await api.importSelected([{file:file('bad','bad.csv')},{file:{name:'unreadable.csv',size:1,text:async()=>{throw Error('private path');}}},{file:file('source,target\n'+root+','+root+'a','good.csv')}],run('csv-import'));
 assert.equal(result.ok,true);assert.equal(result.batches.length,1);assert.deepEqual(result.issues.map(i=>i.inputReference),['bad.csv','unreadable.csv']);
 assert.doesNotMatch(JSON.stringify(result.issues),/private path/);
});

test('cancellation and elapsed budget prevent subsequent selected reads and stale evidence',async()=>{
 const controller=new AbortController();let calls=0;
 const r=run();const result=await api.importSelected([{file:{name:'a.html',size:1,text:async()=>{controller.abort();return 'a';}},sourceUrl:root},{file:{name:'b.html',size:1,text:async()=>{calls++;return 'b';}},sourceUrl:root+'b'}],r,{signal:controller.signal});
 assert.equal(result.ok,false);assert.equal(result.issue.code,'CANCELLED');assert.equal(calls,0);
 const timed=await api.importSelected([{file:{name:'stalled.html',size:1,text:()=>new Promise(()=>{})},sourceUrl:root}],run('html-import',{maxDurationMs:5}));
 assert.equal(timed.ok,false);assert.equal(timed.issue.code,'TIMEOUT');assert.equal(timed.truncated,true);
});

test('hostile paste stays inert and missing selected XML reference never performs acquisition',async()=>{
 const before=global.fetch;let requests=0;global.fetch=()=>{requests++;throw Error('No fetch');};
 try{
  const result=await api.importPaste(fs.readFileSync('sample-data/hostile-page.html','utf8'),'html',root,run('paste-import'));
  assert.equal(result.ok,true);assert.equal(dom.window.phase5Executed,undefined);assert.equal(dom.window.document.querySelector('script'),null);
  const xml=await api.importPaste('<sitemapindex><sitemap><loc>'+root+'missing.xml</loc></sitemap></sitemapindex>','xml',root+'index.xml',run('paste-import'));
  assert.equal(xml.ok,true);assert.match(xml.issues[0].message,/not among the selected/);assert.equal(requests,0);
 }finally{global.fetch=before;}
});

test('hierarchy uses nearest included strict path ancestors and never affects graph metrics or exports',async()=>{
 const r=run('xml-import');const result=await api.importPaste(inventory([root,root+'guide',root+'guide/sub',root+'guide/sub/page?x=1',root+'guidebook',root+'guide?x=1','https://elsewhere.test/guide/sub']),'xml',null,run('paste-import'));
 const g=graphs.buildGraph(r,result.batches),before=JSON.stringify(g),m=metrics.analyze(g),report=outcomes.create({id:15,run:r,graph:g,result});
 const csv=exportsApi.csv('links',g,report),relations=api.hierarchy(g);
 assert.deepEqual(relations.find(v=>v.child===root+'guide/sub'),{parent:root+'guide',child:root+'guide/sub',relation:'inferred-url-hierarchy'});
 assert.equal(relations.find(v=>v.child===root+'guidebook').parent,root);
 assert.equal(relations.some(v=>v.parent.includes('?')),false);
 const panel=dom.window.document.createElement('section');api.renderHierarchy(panel,g);assert.match(panel.textContent,/not observed hyperlinks/);
 assert.equal(g.edges.length,0);assert.ok(g.nodes.filter(n=>n.id!==root).every(n=>n.depth===null&&n.inDegree===0&&n.outDegree===0));
 assert.equal(JSON.stringify(g),before);assert.deepEqual(metrics.analyze(g),m);assert.equal(exportsApi.csv('links',g,report),csv);
 api.renderHierarchy(panel,null);assert.equal(panel.hidden,true);assert.equal(panel.childElementCount,0);
});

test('UI handles mixed file mappings, paste, hierarchy, replacement, localized error and reset',async()=>{
 const app=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}),w=app.window,doc=w.document,f=doc.getElementById('run-form');
 w.TextEncoder=TextEncoder;
 for(const name of ['contracts','csv-import','xml-import','html-import','graph','outcome-report','enhanced-import','run-controls'])w.eval(fs.readFileSync('js/'+name+'.js','utf8'));
 let files=[file('<a href="/guide/a">A</a>','a.html'),file(inventory([root,root+'guide/a']),'sitemap.xml')];
 Object.defineProperty(f.elements.inputFile,'files',{get:()=>files});f.elements.mode.value='html-import';f.elements.mode.onchange();f.elements.inputFile.onchange();
 const mappings=doc.querySelectorAll('#source-mappings input');mappings[0].value=root;mappings[1].value=root+'sitemap.xml';f.elements.rootUrl.value=root;
 await f.onsubmit({preventDefault(){}});assert.equal(f.graph.edges.length,1);assert.equal(f.graph.memberships.length,2);
 f.elements.hierarchyPreview.checked=true;f.elements.hierarchyPreview.onchange();assert.equal(doc.getElementById('hierarchy-preview').hidden,false);
 f.elements.mode.value='paste-import';f.elements.mode.onchange();assert.equal(f.elements.inputFile.disabled,true);assert.equal(mappings[0].disabled,true);
 f.elements.pasteKind.value='xml';f.elements.pasteKind.onchange();f.elements.pasteText.value=inventory([root,root+'other']);
 await f.onsubmit({preventDefault(){}});assert.equal(f.graph.edges.length,0);assert.match(doc.getElementById('hierarchy-preview').textContent,/other/);assert.doesNotMatch(doc.getElementById('hierarchy-preview').textContent,/guide/);
 f.elements.pasteText.value='<urlset>';await f.onsubmit({preventDefault(){}});assert.equal(f.graph,null);assert.equal(doc.getElementById('hierarchy-preview').hidden,true);assert.match(doc.getElementById('run-diagnostics').textContent,/Pasted input.xml/);
 doc.getElementById('reset-run').click();assert.equal(doc.getElementById('source-mappings').childElementCount,0);assert.equal(f.elements.pasteText.value,'');assert.equal(f.elements.hierarchyPreview.checked,false);w.close();
});
