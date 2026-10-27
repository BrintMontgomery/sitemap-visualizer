"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const contracts = require("../js/contracts");
const csvImport = require("../js/csv-import");
const graphApi = require("../js/graph");

const source = fs.readFileSync("tools/same-origin-link-export.js", "utf8");
const site = {
  "https://site.test/": '<a href="/a">A</a><a href="b#top">B</a><a href="https://other.test/x">Off</a><a href="mailto:x@site.test">Mail</a><script>window.ran=1</script>',
  "https://site.test/a": '<a href="/">Home</a><a href="/c">C</a><a href="/file.pdf">PDF</a>',
  "https://site.test/b": '<base href="/deep/"><a href="d">D</a>',
  "https://site.test/c": '<a href="/too-deep">Deep</a>',
  "https://site.test/deep/d": "<p>Leaf</p>"
};

function load(options, extra = {}) {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://site.test/", runScripts: "outside-only" });
  const w = dom.window, requests = [];
  w.SITEMAP_EXPORT_OPTIONS = { delayMs: 250, download: false, ...options };
  w.setTimeout = (fn, ms) => setTimeout(fn, ms === 250 ? 0 : ms);
  w.fetch = async (url, init) => {
    requests.push({ url, credentials: init.credentials });
    if (url === "https://site.test/file.pdf") return { ok: true, status: 200, url, headers: { get: () => "application/pdf" }, text: async () => "%PDF" };
    if (extra.redirect === url) return { ok: true, status: 200, url: "https://other.test/", headers: { get: () => "text/html" }, text: async () => "" };
    if (!(url in site)) return { ok: false, status: 404, url, headers: { get: () => "text/html" }, text: async () => "" };
    return { ok: true, status: 200, url, headers: { get: () => "text/html; charset=utf-8" }, text: async () => site[url] };
  };
  w.console = { log() {}, table() {} };
  return { w, requests, run: () => w.eval(source) };
}

test("exports same-origin links breadth-first within page and depth limits", async () => {
  const { w, requests, run } = load({ maxDepth: 2 });
  const result = await run();
  assert.deepEqual(requests.map(r => r.url), ["https://site.test/", "https://site.test/a", "https://site.test/b", "https://site.test/c", "https://site.test/file.pdf", "https://site.test/deep/d"]);
  assert.ok(requests.every(r => r.credentials === "omit"));
  assert.equal(w.ran, undefined);
  assert.equal(result.csv, [
    "source,target",
    '"https://site.test/","https://site.test/a"',
    '"https://site.test/","https://site.test/b"',
    '"https://site.test/a","https://site.test/"',
    '"https://site.test/a","https://site.test/c"',
    '"https://site.test/a","https://site.test/file.pdf"',
    '"https://site.test/b","https://site.test/deep/d"',
    '"https://site.test/c","https://site.test/too-deep"',
    ""
  ].join("\r\n"));
  assert.equal(result.failures, 1);
  assert.equal(result.unvisited, 0);
  w.close();
});

test("page limit stops requests and reports unvisited pages", async () => {
  const { w, requests, run } = load({ maxPages: 2 });
  const result = await run();
  assert.equal(requests.length, 2);
  assert.equal(result.pagesRequested, 2);
  assert.ok(result.unvisited > 0);
  w.close();
});

test("off-site redirects, invalid options and foreign start URLs are rejected", async () => {
  const redirected = load({ maxDepth: 1 }, { redirect: "https://site.test/a" });
  const result = await redirected.run();
  assert.doesNotMatch(result.csv, /"https:\/\/site\.test\/a","/);
  assert.equal(result.failures, 1);
  redirected.w.close();
  for (const options of [{ maxPages: -1 }, { delayMs: 1.5 }, { startUrl: "https://other.test/" }, { startUrl: "javascript:alert(1)" }]) {
    const { w, requests, run } = load(options);
    await assert.rejects(run());
    assert.equal(requests.length, 0);
    w.close();
  }
});

test("download path creates and releases one CSV blob", async () => {
  const { w, run } = load({ maxPages: 1, download: true });
  const created = [], revoked = [];
  let clicked = null;
  w.URL.createObjectURL = blob => { created.push(blob); return "blob:export"; };
  w.URL.revokeObjectURL = url => revoked.push(url);
  w.HTMLAnchorElement.prototype.click = function () { clicked = this.download; };
  await run();
  await new Promise(resolve => setTimeout(resolve, 1100));
  assert.equal(created.length, 1);
  assert.equal(clicked, "site.test-links.csv");
  assert.deepEqual(revoked, ["blob:export"]);
  assert.equal(w.document.querySelectorAll("a").length, 0);
  w.close();
});

test("exported CSV imports as asserted links with depth from the declared root", async () => {
  const { w, run } = load({ maxDepth: 2 });
  const { csv } = await run();
  w.close();
  const importRun = contracts.createRun({ mode: "csv-import", rootUrl: "https://site.test/", maxDepth: 4 });
  const imported = await csvImport.importFile({ name: "site.test-links.csv", size: Buffer.byteLength(csv), text: async () => csv }, importRun);
  assert.equal(imported.ok, true);
  const graph = graphApi.buildGraph(importRun, [imported]);
  const depth = Object.fromEntries(graph.nodes.map(n => [n.url, n.depth]));
  assert.deepEqual(depth, { "https://site.test/": 0, "https://site.test/a": 1, "https://site.test/b": 1, "https://site.test/c": 2, "https://site.test/file.pdf": 2, "https://site.test/deep/d": 2, "https://site.test/too-deep": 3 });
  assert.equal(graph.edges.length, 7);
  assert.ok(graph.edges.every(e => e.evidence.every(v => v.evidenceClass === "imported-link")));
});

test("a redirected start page becomes the reported root, and depth propagates from it", async () => {
  const dom = new JSDOM("<!doctype html><body></body>", { url: "https://site.test/", runScripts: "outside-only" });
  const w = dom.window, pages = { "https://site.test/default.aspx": '<a href="/">Logo</a><a href="/a">A</a>', "https://site.test/a": '<a href="/">Logo</a>' };
  const messages = [];
  w.SITEMAP_EXPORT_OPTIONS = { delayMs: 250, download: false };
  w.setTimeout = (fn, ms) => setTimeout(fn, ms === 250 ? 0 : ms);
  w.console = { log: m => messages.push(m), table() {} };
  w.fetch = async url => {
    const final = url === "https://site.test/" ? "https://site.test/default.aspx" : url;
    return { ok: final in pages, status: final in pages ? 200 : 404, url: final, headers: { get: () => "text/html" }, text: async () => pages[final] || "" };
  };
  const result = await w.eval(source);
  w.close();
  assert.equal(result.start, "https://site.test/");
  assert.equal(result.root, "https://site.test/default.aspx");
  assert.match(messages[0], /root URL to https:\/\/site\.test\/default\.aspx \(the start page redirected there\)/);
  const csv = result.csv;
  for (const [root, expected] of [["https://site.test/", { "https://site.test/": 0, "https://site.test/default.aspx": null, "https://site.test/a": null }], [result.root, { "https://site.test/default.aspx": 0, "https://site.test/": 1, "https://site.test/a": 1 }]]) {
    const run = contracts.createRun({ mode: "csv-import", rootUrl: root, maxDepth: 4 });
    const imported = await csvImport.importFile({ name: "links.csv", size: Buffer.byteLength(csv), text: async () => csv }, run);
    const graph = graphApi.buildGraph(run, [imported]);
    assert.deepEqual(Object.fromEntries(graph.nodes.map(n => [n.url, n.depth])), expected, root);
  }
});

test("an unreadable start page reports no root", async () => {
  const { w, run } = load({ startUrl: "https://site.test/missing" });
  const result = await run();
  assert.equal(result.root, null);
  assert.equal(result.links, 0);
  w.close();
});
