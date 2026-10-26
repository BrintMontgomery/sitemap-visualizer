"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { JSDOM } = require("jsdom");
const c = require("../js/contracts.js");
const csv = require("../js/csv-import.js");
const xml = require("../js/xml-import.js");
const html = require("../js/html-import.js");
const { buildGraph } = require("../js/graph.js");
const root = "https://example.test/";
const run = (options = {}) => c.createRun({ mode: "csv-import", rootUrl: root, ...options });
const file = (text, name = "links.csv") => ({ name, size: Buffer.byteLength(text), text: async () => text });
const fixture = name => file(fs.readFileSync(`sample-data/${name}`, "utf8"), name);
const links = async (rows, r = run()) => csv.importFile(file("source,target\n" + rows.map(pair => pair.join(",")).join("\n")), r);
const shape = graph => ({ nodes: graph.nodes.map(n => [n.url, n.depth, n.inDegree, n.outDegree]), edges: graph.edges.map(e => [e.source, e.target]) });

test("four-page adapter fixture yields exact directed links, shortest depths and degrees", async () => {
  const r = run(), batch = await csv.importFile(fixture("four-page-links.csv"), r), graph = buildGraph(r, [batch]);
  assert.deepEqual(shape(graph), {
    nodes: [[root, 0, 0, 2], [root + "about", 1, 1, 1], [root + "contact", 1, 1, 1], [root + "team", 2, 2, 0]],
    edges: [[root, root + "about"], [root, root + "contact"], [root + "about", root + "team"], [root + "contact", root + "team"]]
  });
  assert.equal(graph.partial, false); assert.equal(graph.effectiveRoot, root);
  assert.equal(graph.nodes[0].fetched, false); assert.equal(graph.nodes[0].httpStatus, null);
  assert.equal(graph.edges[0].evidence[0].coverageStatus, "user-supplied");
});

test("normalization, cycles, cross-links and self-links retain evidence with distinct degrees", async () => {
  const batch = await links([["HTTPS://EXAMPLE.TEST:443/#x", root + "a#one"], [root, root + "a#two"], [root + "a", root], [root + "a", root + "a"], [root + "a", root + "b"], [root, root + "b"]]);
  const graph = buildGraph(run(), [batch, batch]);
  assert.equal(graph.nodes.length, 3); assert.equal(graph.edges.length, 5);
  assert.equal(graph.edges.find(e => e.target === root + "a" && e.source === root).evidence.length, 2);
  assert.deepEqual(graph.nodes.map(n => [n.depth, n.inDegree, n.outDegree]), [[0, 1, 2], [1, 2, 3], [1, 2, 0]]);
  assert.equal(graph.acquisitions.length, 1); assert.equal(graph.bytesRead, batch.acquisition.result.bytesRead);
  const repeated = await csv.importFile(file("source,target\n" + `${root},${root}a\n`.repeat(c.limits.maxRecords)), run());
  const many = buildGraph(run(), [repeated]);
  assert.equal(many.edges.length, 1); assert.equal(many.edges[0].evidence.length, c.limits.maxRecords);
  assert.equal(many.nodes[0].outDegree, 1); assert.equal(many.truncated, false);
});

test("inert HTML and XML adapters merge with CSV without inventing inventory paths", async () => {
  const dom = new JSDOM("");
  const oldDocument = global.document, oldParser = global.DOMParser;
  global.document = dom.window.document; global.DOMParser = dom.window.DOMParser;
  try {
    const h = await html.importFile(file('<title>Home</title><a href="/a">A</a>', "home.html"), c.createRun({ mode: "html-import" }), root);
    const x = await xml.importFiles([{ file: file(`<urlset><url><loc>${root}a</loc><lastmod>2026-10-26</lastmod></url><url><loc>${root}inventory</loc></url></urlset>`, "site.xml"), sourceUrl: root + "sitemap.xml" }], c.createRun({ mode: "xml-import" }));
    const batch = await links([[root, root + "a"]]);
    const graph = buildGraph(run(), [h, batch, x]);
    assert.equal(graph.nodes.length, 3); assert.equal(graph.edges.length, 1); assert.equal(graph.memberships.length, 2);
    assert.equal(graph.nodes[0].title, "Home");
    assert.deepEqual(graph.edges[0].evidence.map(e => e.evidenceClass), ["observed-html", "imported-link"]);
    const inventory = graph.nodes.find(n => n.url.endsWith("inventory"));
    assert.equal(inventory.depth, null); assert.equal(inventory.unreachableInObservedGraph, true);
    assert.equal(inventory.inDegree, 0); assert.equal(inventory.outDegree, 0);
    assert.equal(graph.memberships[0].lastmod, "2026-10-26");
    const onlyXml = buildGraph(run(), [x]);
    assert.equal(onlyXml.edges.length, 0); assert.ok(onlyXml.nodes.every(n => n.depth === null));
  } finally { global.document = oldDocument; global.DOMParser = oldParser; dom.window.close(); }
});

test("no root or absent root keeps depth unknown without fabricating a node", async () => {
  const batch = await links([[root + "a", root + "b"]]);
  for (const rootUrl of [null, root, root + "missing"]) {
    const graph = buildGraph(run({ rootUrl }), [batch]);
    assert.equal(graph.effectiveRoot, null); assert.equal(graph.nodes.length, 2);
    assert.ok(graph.nodes.every(n => n.depth === null)); assert.equal(graph.partial, true);
    assert.equal(graph.issues[0].code, "INPUT_MALFORMED");
  }
});

test("page and depth caps use stable BFS priority, preserve cross-links, count exclusions", async () => {
  const rows = [[root, root + "b"], [root + "a", root + "deep"], [root, root + "a"], [root + "b", root + "a"]];
  const batch = await links(rows), reversed = await links(rows.slice().reverse());
  const graph = buildGraph(run({ maxPages: 2 }), [batch]);
  assert.deepEqual(graph.nodes.map(n => n.url), [root, root + "a"]);
  assert.equal(graph.edges.length, 1); assert.equal(graph.exclusions.filter(e => e.kind === "node").length, 2);
  assert.equal(graph.exclusions.filter(e => e.kind === "edge").length, 3);
  assert.deepEqual(shape(graph), shape(buildGraph(run({ maxPages: 2 }), [reversed])));
  const depth = buildGraph(run({ maxDepth: 1 }), [batch]);
  assert.equal(depth.nodes.length, 3); assert.equal(depth.edges.length, 3);
  assert.equal(depth.exclusions.find(e => e.kind === "node").reason, "DEPTH_LIMIT");
  const zero = buildGraph(run({ maxDepth: 0 }), [batch]);
  assert.deepEqual(zero.nodes.map(n => n.url), [root]); assert.equal(zero.edges.length, 0);
  assert.equal(buildGraph(run({ maxPages: 4, maxDepth: 2 }), [batch]).truncated, false);
  assert.equal(graph.truncated, true); assert.equal(depth.partial, true);
});

test("30-page fixture enforces cap at one, below, and exactly the node count", async () => {
  const batch = await csv.importFile(fixture("thirty-page-links.csv"), run());
  for (const maxPages of [1, 29, 30]) {
    const graph = buildGraph(run({ rootUrl: null, maxPages, maxDepth: 4 }), [batch]);
    assert.equal(graph.nodes.length, maxPages); assert.equal(graph.truncated, maxPages < 30);
    const included = new Set(graph.nodes.map(n => n.url));
    assert.deepEqual(graph.edges.map(e => [e.source, e.target]), batch.claims.filter(e => included.has(e.source) && included.has(e.target)).map(e => [e.source, e.target]).sort((a, b) => JSON.stringify(a).localeCompare(JSON.stringify(b))));
  }
  const chain = buildGraph(run({ rootUrl: root + "0", maxPages: 30, maxDepth: 4 }), [batch]);
  assert.deepEqual(chain.nodes.map(n => [n.url, n.depth]), Array.from({ length: 5 }, (_, i) => [root + i, i]));
  assert.equal(chain.edges.length, 4); assert.equal(chain.exclusions.filter(e => e.reason === "DEPTH_LIMIT").length, 25);
});

test("BFS uses a shorter cross-link even when the longer path appears first", async () => {
  const batch = await links([[root, root + "a"], [root + "a", root + "b"], [root + "b", root + "c"], [root + "c", root + "d"], [root, root + "d"], [root + "island", root + "other"]]);
  const graph = buildGraph(run({ maxDepth: 2 }), [batch]);
  assert.deepEqual(graph.nodes.map(n => [n.url, n.depth]), [[root, 0], [root + "a", 1], [root + "d", 1], [root + "b", 2], [root + "island", null], [root + "other", null]]);
  assert.equal(graph.exclusions.filter(e => e.kind === "node").length, 1);
  assert.equal(graph.nodes.find(n => n.url.endsWith("other")).inDegree, 1);
});

test("aggregate acquisition byte limit rejects later batches without leaking their records", () => {
  const r = run(), imports = [];
  for (let i = 0; i < 6; i++) {
    const name = `part-${i}.csv`;
    const acquisition = c.validateResult(r, { transport: "csv-import", status: "user-supplied", contentKind: "links", evidenceClass: "imported-link", payload: "", bytesRead: c.limits.maxBytes, issues: [], inputReference: name, startedAt: new Date().toISOString(), elapsedMs: 0 });
    imports.push({ ok: true, acquisition, claims: [{ source: root, target: root + i, evidenceClass: "imported-link", evidence: [{ transport: "csv-import", inputReference: name, evidenceClass: "imported-link", row: 2 }] }] });
  }
  const graph = buildGraph(r, imports);
  assert.equal(graph.bytesRead, c.limits.maxTotalBytes); assert.equal(graph.acquisitions.length, 5);
  assert.equal(graph.edges.length, 5); assert.ok(!graph.nodes.some(n => n.url === root + "5"));
  assert.equal(graph.truncated, true); assert.ok(graph.issues.some(i => i.code === "SIZE_LIMIT"));
});

test("unsafe, unsupported and spoofed record evidence cannot create graph records", async () => {
  const batch = await links([[root, root + "a"]]);
  const forged = { ...batch, acquisition: { ...batch.acquisition } };
  assert.equal(buildGraph(run(), [forged]).nodes.length, 0);
  for (const claim of [
    { ...batch.claims[0], target: "javascript:alert(1)" },
    { ...batch.claims[0], evidenceClass: "sitemap-only" },
    { ...batch.claims[0], evidence: [{ ...batch.claims[0].evidence[0], inputReference: "unselected.csv" }] },
    { ...batch.claims[0], evidence: [] }, null
  ]) assert.equal(buildGraph(run(), [{ ...batch, claims: [claim] }]).nodes.length, 0);
  const scoped = buildGraph(run(), [await links([[root, "https://elsewhere.test/"], [root, root + "ok"]])]);
  assert.equal(scoped.nodes.length, 2); assert.equal(scoped.partial, true);
  assert.equal(scoped.exclusions[0].reason, "SCOPE_EXCLUDED");
  assert.throws(() => buildGraph({ mode: "csv-import", maxPages: 0 }, []), RangeError);
});

test("observable redirects stay separate from edges and never merge unrelated URL IDs", () => {
  const r = c.createRun({ mode: "live-cors", rootUrl: root });
  const acquisition = c.validateResult(r, { transport: "live-cors", status: "readable", contentKind: "html", evidenceClass: "observed-html", payload: "", bytesRead: 0, issues: [], inputReference: root, resourceUrl: root, observedFinalUrl: root + "home", httpStatus: 200, startedAt: new Date().toISOString(), elapsedMs: 1 });
  const graph = buildGraph(r, [{ ok: true, acquisition }]);
  assert.equal(graph.nodes.length, 0); assert.equal(graph.edges.length, 0);
  assert.deepEqual(graph.redirectAliases, [{ source: root, target: root + "home", evidenceIds: ["acquisition-1"] }]);
  assert.equal(graph.acquisitions[0].redirectHistory, null);
});

test("source partiality and aggregate record bounds remain visible; results are immutable snapshots", async () => {
  const batch = await links([[root, root + "a"]]);
  batch.truncated = true;
  const graph = buildGraph(run(), [batch]);
  assert.equal(graph.partial, true); assert.equal(graph.truncated, true);
  batch.claims[0].evidence[0].row = 999;
  assert.equal(graph.edges[0].evidence[0].row, 2);
  assert.throws(() => { graph.nodes[0].depth = 8; }, TypeError);
  const capped = buildGraph(run(), [{ ...batch, truncated: false, claims: Array(c.limits.maxRecords).fill(batch.claims[0]).concat({ ...batch.claims[0], target: root + "excluded" }) }]);
  assert.equal(capped.truncated, true); assert.equal(capped.nodes.length, 2);
  assert.ok(capped.issues.some(i => i.code === "PARTIAL_LIMIT"));
});

test("graph module loads with contracts as local classic scripts without DOM or network", () => {
  const context = vm.createContext({ URL, TextEncoder });
  for (const path of ["js/contracts.js", "js/graph.js"]) vm.runInContext(fs.readFileSync(path, "utf8"), context);
  assert.equal(typeof context.SitemapGraph.buildGraph, "function");
  const graph = context.SitemapGraph.buildGraph(context.SitemapContracts.createRun({ mode: "csv-import" }), []);
  assert.equal(graph.nodes.length, 0);
});
