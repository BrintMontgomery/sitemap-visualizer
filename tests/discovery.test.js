'use strict';
const { test, after } = require('node:test');
const assert = require('node:assert/strict');
const { JSDOM } = require('jsdom');
const contracts = require('../js/contracts');
const xml = require('../js/xml-import');
const graph = require('../js/graph');
const { discover } = require('../js/discovery');
const { root, crawl, response, urlset, index, fakeClock, drain } = require('./discovery-test-support.cjs');
const dom = new JSDOM(''); global.document = dom.window.document; global.DOMParser = dom.window.DOMParser;
after(() => { dom.window.close(); delete global.document; delete global.DOMParser; });
const build = r => graph.buildGraph(r.run, r.result.batches);

test('breadth-first HTML traversal ignores robots, preserves cycles/cross-links and minimum directed depths', async t => {
  const r = await crawl(t, {
    [root]: ['<meta name="robots" content="nofollow,noindex"><a href="a#one">a</a><a href="a#two">dup</a><a href="b">b</a>'],
    [root + 'a']: ['<a href="c">c</a><a href="/">root</a>'],
    [root + 'b']: ['<a href="c">c</a>'], [root + 'c']: ['<title>C</title><a href="b">b</a>'],
    [root + 'robots.txt']: ['User-agent: *\nDisallow: /\nCrawl-delay: 99', 'text/plain']
  });
  assert.equal(r.result.ok, true);
  assert.deepEqual(r.calls, [root, root+'a', root+'b', root+'c', root+'sitemap.xml']);
  const g = build(r); assert.equal(g.partial, false); assert.equal(g.edges.length, 6);
  assert.deepEqual(g.nodes.map(n => [n.url, n.depth, n.fetched]), [[root,0,true],[root+'a',1,true],[root+'b',1,true],[root+'c',2,true]]);
  assert.equal(g.edges.find(e => e.source === root && e.target === root+'a').evidence.length, 2);
  assert.ok(r.snapshots.some(s => s.queued > 0)); assert.equal(r.result.progress.robotsPolicy, 'ignored');
});

test('recursive sitemap indexes and HTML directives retain membership without inventing links or depth', async t => {
  const r = await crawl(t, {
    [root]: ['<link rel="alternate sitemap" href="/maps/index.xml"><title>Home</title>'],
    [root+'maps/index.xml']: [index([root+'maps/child.xml',root+'maps/index.xml']), 'text/xml'],
    [root+'maps/child.xml']: [urlset([root+'inventory','http://other.test/']), 'application/xml'],
    [root+'inventory']: ['<a href="leaf">leaf</a>'], [root+'leaf']: ['<title>Leaf</title>']
  });
  assert.equal(r.calls.filter(u => u === root+'maps/index.xml').length, 1);
  assert.ok(!r.calls.includes('http://other.test/'));
  const g = build(r);
  assert.deepEqual(g.edges.map(e => [e.source,e.target]), [[root+'inventory',root+'leaf']]);
  assert.equal(g.nodes.find(n => n.url === root+'inventory').depth, null);
  assert.equal(g.nodes.find(n => n.url === root+'leaf').depth, null);
  assert.equal(g.memberships.length, 1); assert.equal(g.memberships[0].sourceSitemap, root+'maps/child.xml');
  assert.equal(g.memberships[0].evidence[0].transport,'live-cors');
  assert.equal(g.acquisitions.find(a=>a.inputReference===root+'maps/child.xml').httpStatus,200);
});

test('a live XML root recursively discovers pages', async t => {
  const r = await crawl(t, { [root]: [index([root+'list.xml']), 'text/xml'], [root+'list.xml']: [urlset([root+'a']), 'text/xml'], [root+'a']: ['<title>A</title>'] });
  assert.equal(r.result.ok,true); const g=build(r); assert.equal(g.edges.length,0); assert.equal(g.nodes[0].depth,null); assert.equal(g.nodes[0].fetched,true);
});

test('depth and page caps stop requests, preserve observed boundary links and mark partial results', async t => {
  const r = await crawl(t, { [root]: ['<a href="a">a</a><a href="b">b</a>'], [root+'a']: ['<a href="deep">deep</a>'], [root+'b']: ['<title>B</title>'] }, { maxDepth: 1, maxPages: 2 });
  assert.deepEqual(r.calls,[root,root+'a',root+'sitemap.xml']); assert.equal(r.result.truncated,true);
  assert.ok(r.result.issues.some(i=>/depth/.test(i.message))); assert.ok(r.result.issues.some(i=>/Page request/.test(i.message)));
  const g=build(r); assert.equal(g.partial,true); assert.deepEqual(g.nodes.map(n=>n.url),[root,root+'a']);
  assert.equal(g.edges.length,1); assert.ok(g.exclusions.some(e=>e.reason==='DEPTH_LIMIT'));
});

test('CORS, HTTP, malformed XML and timeout failures leave successful branches intact', async t => {
  const r = await crawl(t, {
    [root]: ['<a href="denied">d</a><a href="missing">m</a><a href="slow">s</a><a href="good">g</a><link rel="sitemap" href="bad.xml">'],
    [root+'denied']: new TypeError('Failed to fetch'), [root+'slow']: ()=>new Promise(()=>{}),
    [root+'good']: ['<title>Good</title>'], [root+'bad.xml']: ['<!DOCTYPE x><urlset/>','text/xml']
  }, {}, { requestTimeoutMs: 50 });
  assert.equal(r.result.ok,true); const codes = r.result.issues.map(i=>i.code);
  for(const code of ['NETWORK_OR_POLICY_FAILURE','HTTP_ERROR','TIMEOUT','INPUT_MALFORMED']) assert.ok(codes.includes(code),code);
  const g=build(r); assert.equal(g.partial,true); assert.equal(g.nodes.find(n=>n.url===root+'good').fetched,true);
  assert.equal(g.nodes.find(n=>n.url===root+'denied').fetched,false);
  assert.equal(r.result.attempts.find(a=>a.resourceUrl===root+'denied').httpStatus,null);
});

test('same-host redirects resolve HTML and XML relative metadata without redirect edges', async t => {
  const r=await crawl(t, {
    [root]: u=>response(root+'dir/home','<a href="child">c</a><link rel="sitemap" href="index.xml">'),
    [root+'dir/child']: ['<title>Child</title>'],
    [root+'dir/index.xml']: u=>response(root+'map.xml',urlset([root+'inventory']),'text/xml'), [root+'inventory']: ['<title>I</title>']
  });
  const g=build(r); assert.equal(g.redirectAliases.length,2);
  assert.deepEqual(g.edges.map(e=>[e.source,e.target]), [[root+'dir/home',root+'dir/child']]);
  assert.equal(g.memberships[0].sourceSitemap,root+'map.xml');
  assert.ok(g.nodes.every(n=>n.depth===null));
});

test('unsafe URLs, other hosts and hostile markup cannot trigger scripts, assets or external discovery', async t => {
  const r=await crawl(t, { [root]: ['<base href="http://evil.test/"><script>window.executed=true</script><img src="http://evil.test/image"><iframe src="http://evil.test/frame"></iframe><a href="javascript:x">x</a><a href="http://evil.test/">e</a><link rel="sitemap" href="http://evil.test/map.xml"><a href="safe">s</a>'], [root+'safe']: ['<title>Safe</title>'] });
  assert.deepEqual(r.calls,[root,root+'safe',root+'sitemap.xml']); assert.equal(dom.window.executed,undefined);
  const g=build(r); assert.equal(g.edges.length,1); assert.equal(g.edges[0].target,root+'safe');
});

test('aggregate record and sitemap queue budgets bound expansion and report exclusions', async t => {
  const maps=Array.from({length:140},(_,i)=>root+'map'+i+'.xml');
  const r=await crawl(t, { [root]: [index(maps),'text/xml'] }, { maxDurationMs:300000 });
  assert.ok(r.result.progress.sitemapsRequested<=128); assert.ok(r.result.issues.some(i=>/Sitemap queue/.test(i.message))); assert.equal(r.result.truncated,true);
});

test('global records are capped across resources, including XML references', async t => {
  const r=await crawl(t,{ [root]: ['<a href="a">a</a><a href="b">b</a>'], [root+'a']: [urlset(Array.from({length:6000},(_,i)=>root+'p'+i)), 'text/xml'], [root+'b']: [urlset(Array.from({length:6000},(_,i)=>root+'q'+i)), 'text/xml'] }, { maxPages:1000, maxDurationMs:300000 });
  assert.equal(r.result.progress.records,10000); assert.equal(r.result.truncated,true);
  assert.ok(r.result.issues.some(i=>/record limit/.test(i.message))); assert.ok(r.calls.length<5);
});

test('total-byte and resource-size limits terminate with earlier evidence intact', async t => {
  const text='<a href="big">big</a>'+ ' '.repeat(1999900);
  const fixtures={ [root]: [text], [root+'big']: ['x'.repeat(2000001)] };
  const r=await crawl(t,fixtures);
  assert.equal(r.result.ok,true); assert.equal(r.result.truncated,true); assert.ok(r.result.issues.some(i=>i.code==='SIZE_LIMIT'));
  assert.equal(build(r).nodes.find(n=>n.url===root).fetched,true);
});

test('deep runs exceed previous depth/page ceilings while imports keep their limits', async t => {
  const fixtures={}; for(let i=0;i<=8;i++) fixtures[i===0?root:root+'p'+i]=[i<8?'<a href="p'+(i+1)+'">next</a>':'<title>End</title>'];
  const r=await crawl(t,fixtures,{maxDepth:8,maxPages:1000,maxConcurrency:8});
  assert.equal(build(r).nodes.find(n=>n.url===root+'p8').depth,8);
  assert.throws(()=>contracts.createRun({mode:'csv-import',maxPages:251}),RangeError);
  for(const settings of [{maxPages:1001},{maxDepth:21},{maxConcurrency:9},{maxConcurrency:0},{maxDurationMs:300001},{maxDurationMs:0}]) assert.throws(()=>contracts.createRun({mode:'live-cors',...settings}),RangeError);
});

test('live XML validation rejects forged acquisitions, malformed namespaces and prohibited declarations', () => {
  const run=contracts.createRun({mode:'live-cors',rootUrl:root});
  assert.equal(xml.fromAcquisition(run,{ok:true,result:{transport:'live-cors',contentKind:'xml'}}).ok,false);
  for(const payload of ['<!DOCTYPE x><urlset/>','<urlset xmlns="urn:wrong"/>','<urlset><url></urlset>']) {
    const a=contracts.validateResult(run,{transport:'live-cors',status:'readable',resourceUrl:root,observedFinalUrl:root,httpStatus:200,contentKind:'xml',evidenceClass:'sitemap-only',payload,bytesRead:Buffer.byteLength(payload),issues:[],inputReference:root,startedAt:new Date().toISOString(),elapsedMs:0});
    assert.equal(xml.fromAcquisition(run,a).ok,false);
  }
});

test('cancellation and run deadline settle active/queued work and clean timers', async t => {
  const controller=new AbortController();
  const r=await crawl(t,{ [root]: ['<a href="slow">s</a>'], [root+'slow']: (u,o)=>{controller.abort();return new Promise(()=>{});} },{}, {signal:controller.signal});
  assert.equal(r.result.ok,true); assert.equal(r.result.truncated,true); assert.ok(r.result.issues.some(i=>i.code==='CANCELLED')); assert.ok(r.calls.length<=2);
});

test('run deadline preserves completed pages and prevents later requests', async t => {
  const r=await crawl(t,{ [root]: ['<a href="slow">s</a><a href="other">o</a>'], [root+'slow']: ()=>new Promise(()=>{}) },{maxDurationMs:1500});
  assert.equal(r.result.ok,true); assert.equal(r.result.truncated,true); assert.ok(r.result.issues.some(i=>i.code==='TIMEOUT')); assert.ok(!r.calls.includes(root+'other'));
});

test('failed root can recover through a readable sitemap; all-failed runs return no fabricated graph', async t => {
  const r=await crawl(t,{ [root]: new TypeError('blocked'), [root+'sitemap.xml']: [urlset([root+'a']),'text/xml'], [root+'a']: ['<title>A</title>'] });
  assert.equal(r.result.ok,true); assert.equal(build(r).nodes[0].depth,null); assert.equal(build(r).partial,true);
});

test('all unreadable endpoints terminate with diagnostics and no graph batches', async t => {
  const r=await crawl(t,{[root]:new TypeError('blocked')}); assert.equal(r.result.ok,false); assert.equal(r.result.batches,undefined); assert.equal(r.result.issue.code,'NETWORK_OR_POLICY_FAILURE');
});

test('an empty readable sitemap supplies honest inventory evidence', async t => {
  const r=await crawl(t,{[root]:['<urlset/>','text/xml']}); assert.equal(r.result.ok,true); assert.equal(build(r).edges.length,0); assert.equal(build(r).nodes.length,0);
});

test('high-capacity discovery fetches more than 250 pages within fixed byte/record/time limits', async t => {
  const fixtures={ [root]: [Array.from({length:259},(_,i)=>'<a href="p'+i+'">p</a>').join('')] };
  for(let i=0;i<259;i++) fixtures[root+'p'+i]=['<title>Page '+i+'</title><a href="/">home</a>'];
  const r=await crawl(t,fixtures,{maxPages:300,maxDepth:1,maxDurationMs:300000,maxConcurrency:8});
  const g=build(r); assert.equal(g.nodes.length,260); assert.equal(g.edges.length,518); assert.ok(g.nodes.every(n=>n.fetched)); assert.equal(g.partial,false);
  assert.equal(r.calls.length,261); assert.ok(r.result.progress.bytesRead<contracts.limits.maxTotalBytes);
});

test('configured concurrency and host spacing remain binding for slow endpoints', async t => {
  const clock=fakeClock(t), starts=[], resolvers=[];
  const run=contracts.createRun({mode:'live-cors',rootUrl:root,maxConcurrency:3});
  const controller=new AbortController();
  const pending=discover(run,{signal:controller.signal,fetch:async url=>{
    starts.push({url,at:Date.now()});
    if(url===root) return response(url,'<a href="a">a</a><a href="b">b</a><a href="c">c</a><a href="d">d</a>');
    return new Promise(resolve=>resolvers.push(()=>resolve(response(url,'<title>OK</title>'))));
  }});
  await drain(); clock.tick(); await drain(); clock.tick(); await drain(); clock.tick(); await drain();
  assert.equal(starts.length,4); clock.tick(); await drain(); assert.equal(starts.length,4);
  assert.ok(starts.slice(1).every((s,i)=>s.at-starts[i].at>=1000));
  controller.abort(); const r=await pending; await drain(); assert.equal(r.truncated,true); assert.equal(clock.timers.size,0);
  resolvers.forEach(r=>r()); await drain(); assert.equal(starts.length,4);
});

test('an oversized endpoint cannot prevent a readable sibling from contributing evidence', async t => {
  const r=await crawl(t,{[root]:['<a href="big">b</a><a href="good">g</a>'],[root+'big']:['x'.repeat(2000001)],[root+'good']:['<title>Good</title>']});
  assert.equal(r.result.truncated,true); assert.equal(build(r).nodes.find(n=>n.url===root+'good').fetched,true);
});

test('aggregate network bytes terminate discovery before another body is parsed', async t => {
  const fixtures={}; for(let i=0;i<7;i++) fixtures[i===0?root:root+'p'+i]=['<a href="p'+(i+1)+'">next</a>'+' '.repeat(1999950)];
  const r=await crawl(t,fixtures,{maxDepth:20});
  assert.equal(r.result.truncated,true); assert.ok(r.result.issues.some(i=>i.code==='SIZE_LIMIT')); assert.equal(r.calls.length,6);
  assert.equal(build(r).acquisitions.length,5); assert.ok(r.result.progress.bytesRead>=contracts.limits.maxTotalBytes);
});

test('out-of-order responses keep breadth-first acquisition and shortest-depth selection deterministic', async t => {
  const r=await crawl(t,{
    [root]:['<a href="slow">slow</a><a href="fast">fast</a>'],
    [root+'slow']:u=>new Promise(resolve=>setTimeout(()=>resolve(response(u,'<a href="deep">deep</a>')),1500)),
    [root+'fast']:['<a href="deep">deep</a>'],[root+'deep']:['<title>Deep</title>']
  });
  assert.deepEqual(r.result.batches.filter(b=>b.page).map(b=>b.page.url),[root,root+'slow',root+'fast',root+'deep']);
  assert.equal(build(r).nodes.find(n=>n.url===root+'deep').depth,2); assert.equal(r.calls.filter(u=>u===root+'deep').length,1);
});

test('deep sitemap chains obey a separate nesting limit', async t => {
  const fixtures={[root]:[index([root+'map0']),'text/xml']};
  for(let i=0;i<67;i++) fixtures[root+'map'+i]=[index([root+'map'+(i+1)]),'text/xml'];
  const r=await crawl(t,fixtures,{maxDurationMs:300000});
  assert.ok(r.calls.includes(root+'map64')); assert.ok(!r.calls.includes(root+'map65')); assert.equal(r.result.truncated,true);
});
