"use strict";
const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const {JSDOM} = require('jsdom');
const renderer = require('../js/graph-renderer');
const contracts = require('../js/contracts');
const csv = require('../js/csv-import');
const graphApi = require('../js/graph');
async function fixture(name='radial-clusters-links.csv', extra={}) {
 const run=contracts.createRun({mode:'csv-import',rootUrl:'https://example.test/',maxPages:250,maxDepth:4,...extra});
 const text=fs.readFileSync('sample-data/'+name,'utf8');
 const result=await csv.importFile({name,size:Buffer.byteLength(text),text:async()=>text},run);
 return graphApi.buildGraph(run,[result]);
}
function setup(graph) {
 const dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'});
 const container=dom.window.document.getElementById('graph-view');
 let state;
 const api=renderer.create(container,graph,71,s=>{state=s;});
 return {dom,container,api,state:()=>state};
}
test('SVG preserves exact validated identities, directed edges, colors and unknown depths',async()=>{
 const graph=await fixture(), before=JSON.stringify(graph), {dom,container,api}=setup(graph);
 assert.equal(graph.nodes.length,49);
 assert.deepEqual([...container.querySelectorAll('.graph-node')].map(g=>g.dataset.nodeId),graph.nodes.map(n=>n.id));
 assert.deepEqual([...container.querySelectorAll('.graph-edge')].map(g=>g.dataset.edgeId),graph.edges.map(e=>e.id));
 for(const node of graph.nodes) {
  const g=[...container.querySelectorAll('.graph-node')].find(g=>g.dataset.nodeId===node.id);
  assert.equal(g.querySelector('circle').getAttribute('fill'),renderer.color(node));
 }
 assert.deepEqual([...new Set(graph.nodes.map(renderer.color))],['#f59e0b','#22c55e','#8b5cf6','#ef4444']);
 for(const path of container.querySelectorAll('.graph-edge')) assert.match(path.getAttribute('marker-end'),/^url\(#graph-arrow-/);
 assert.equal(JSON.stringify(graph),before);
 api.destroy();
 const unknown=await fixture('four-page-links.csv',{rootUrl:null});
 const second=renderer.create(container,unknown,72);
 for(const circle of container.querySelectorAll('.graph-node circle')) { assert.equal(circle.getAttribute('fill'),'#cbd5e1'); assert.equal(circle.getAttribute('class'),'unknown-depth'); }
 second.destroy();dom.window.close();
});
test('layout/pins are deterministic, immutable snapshots scoped to a run; fit and zoom preserve pins',async()=>{
 const graph=await fixture(), original=JSON.stringify(graph), a=renderer.initialPositions(graph), b=renderer.initialPositions({...graph,nodes:[...graph.nodes].reverse(),edges:[...graph.edges].reverse()});
 assert.deepEqual([...a].sort(),[...b].sort());
 const {dom,container,api,state}=setup(graph), id=graph.nodes[1].id, initial=api.getLayoutState();
 api.pin(id,600,-700);
 assert.deepEqual(state().nodes.find(n=>n.node_id===id),{run_id:71,node_id:id,x:600,y:-700,pinned:true});
 assert.equal(initial.nodes.find(n=>n.node_id===id).pinned,false);
 assert.ok(Object.isFrozen(state().nodes[0]));
 api.zoom(100);api.fit();
 assert.equal(state().nodes.find(n=>n.node_id===id).x,600);
 container.querySelector('[data-action="unpin"]').click();
 assert.deepEqual(state().nodes.find(n=>n.node_id===id),initial.nodes.find(n=>n.node_id===id));
 api.pin(id,1,2);container.querySelector('[data-action="reset"]').click();
 assert.deepEqual(state(),initial);
 api.pin('fake',1,2);api.pin(id,Infinity,0);api.pin(id,0,NaN);
 assert.deepEqual(state(),initial);
 assert.equal(JSON.stringify(graph),original);
 api.destroy();
 const oldState=state();api.pin(id,8,9);api.reset();assert.equal(state(),oldState);
 const newApi=renderer.create(container,graph,72);assert.ok(newApi.getLayoutState().nodes.every(n=>n.run_id===72&&!n.pinned));
 newApi.destroy();dom.window.close();
});
test('self links and reciprocal edges remain visible, unsafe titles are text, and dispose removes handlers',async()=>{
 let graph=await fixture('four-page-links.csv');
 const node=graph.nodes[0];
 // Rendering-only snapshot derived from a real graph; titles never enter HTML.
 graph={...graph,nodes:graph.nodes.map(n=>({...n,title:'<img src="https://invalid.test" onerror="alert(1)">'})),edges:[...graph.edges,{id:'self',source:node.id,target:node.id}]};
 const {dom,container,api}=setup(graph);
 assert.equal(container.querySelector('img'),null);
 assert.match(container.querySelector('.graph-node title').textContent,/<img/);
 assert.match(container.querySelector('[data-edge-id="self"]').getAttribute('d'),/ C /);
 const layer=container.querySelector('.graph-layer'), initial=layer.getAttribute('transform');
 container.querySelector('[data-action="zoom-in"]').click();assert.notEqual(layer.getAttribute('transform'),initial);
 api.destroy();api.destroy();assert.equal(container.querySelectorAll('.graph-node').length,0);
 assert.equal(container.hidden,true);
 const saved=layer.getAttribute('transform');container.querySelector('[data-action="zoom-in"]').dispatchEvent(new dom.window.Event('click'));assert.equal(layer.getAttribute('transform'),saved);
 dom.window.close();
});
test('250-node / 1,000-edge fixture has bounded finite positions and no background layout work',async()=>{
 const graph=await fixture('250-node-1000-edge-links.csv');assert.equal(graph.nodes.length,250);assert.equal(graph.edges.length,1000);
 const {dom,container,api}=setup(graph);
 assert.equal(container.querySelectorAll('.graph-node').length,250);assert.equal(container.querySelectorAll('.graph-edge').length,1000);
 const points=api.getLayoutState().nodes;
 assert.equal(new Set(points.map(p=>p.x+','+p.y)).size,250);
 assert.ok(points.every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)));
 for(const path of container.querySelectorAll('.graph-edge')) assert.doesNotMatch(path.getAttribute('d'),/NaN|Infinity/);
 const before=api.getLayoutState();api.fit();assert.deepEqual(api.getLayoutState(),before);
 api.destroy();dom.window.close();
});
test('run replacement, cancellation and reset dispose displayed graphs; stale imports cannot render',async()=>{
 const graph=await fixture(), dom=new JSDOM(fs.readFileSync('index.html','utf8'),{runScripts:'outside-only'}), w=dom.window, form=w.document.getElementById('run-form');
 const pending=[];w.SitemapContracts=contracts;w.SitemapRenderer=renderer;
 w.SitemapGraph={buildGraph:()=>graph};w.SitemapCsvImport={importFile:()=>new Promise(r=>pending.push(r))};
 w.SitemapOutcomes=require('../js/outcome-report');w.eval(fs.readFileSync('js/run-controls.js','utf8'));
 Object.defineProperty(form.elements.inputFile,'files',{value:[{name:'links.csv'}]});
 const submit=()=>form.onsubmit({preventDefault(){}});
 const first=submit();pending.shift()({ok:true});await first;
 assert.equal(form.layoutState.nodes.length,49);
 assert.equal(w.document.querySelectorAll('.graph-node').length,49);
 const second=submit(), stale=pending.shift();assert.equal(w.document.querySelectorAll('.graph-node').length,0);assert.equal(form.layoutState,null);
 const third=submit();pending.shift()({ok:true});await third;
 const state=form.layoutState;stale({ok:true});await second;assert.equal(form.layoutState,state);
 const fourth=submit(), cancelled=pending.shift();w.document.getElementById('cancel-run').click();cancelled({ok:true});await fourth;
 assert.equal(form.layoutState,null);assert.equal(w.document.querySelectorAll('.graph-node').length,0);
 const fifth=submit();pending.shift()({ok:true});await fifth;
 w.document.getElementById('reset-run').click();assert.equal(form.layoutState,null);assert.equal(form.graph,null);assert.equal(w.document.getElementById('empty-state').hidden,false);
 dom.window.close();
});
test('empty and single-node inventories fit safely; hub centers have breathing room',async()=>{
 const graph=await fixture(), positions=renderer.initialPositions(graph), hubs=graph.nodes.filter(n=>n.depth===1);
 for(const a of hubs)for(const b of hubs)if(a.id!==b.id)assert.ok(Math.hypot(positions.get(a.id).x-positions.get(b.id).x,positions.get(a.id).y-positions.get(b.id).y)>30);
 for(const snapshot of [{nodes:[],edges:[]},{nodes:[graph.nodes[0]],edges:[]}]) {
  const {dom,container,api}=setup(snapshot);
  api.zoom(0);api.fit();api.reset();
  assert.doesNotMatch(container.querySelector('.graph-layer').getAttribute('transform'),/NaN|Infinity/);
  assert.equal(api.getLayoutState().nodes.length,snapshot.nodes.length);
  api.destroy();dom.window.close();
 }
});
