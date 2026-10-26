"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM, ResourceLoader } = require("jsdom");
const contracts = require("../js/contracts.js");
const html = require("../js/html-import.js");
const requests = [];
class NetworkTrap extends ResourceLoader { fetch(url) { requests.push(url); return null; } }
const dom = new JSDOM("<!doctype html><title>Test host</title>", { url: "https://host.test/", resources: new NetworkTrap(), runScripts: "dangerously" });
global.document = dom.window.document;
after(() => { dom.window.close(); delete global.document; });
const run = () => contracts.createRun({ mode: "html-import" });
const file = (text, name = "page.html") => ({ name, size: Buffer.byteLength(text), text: async () => text });
const fixture = name => file(fs.readFileSync(`sample-data/${name}`, "utf8"), name);
const source = "https://example.test/section/page.html";
test("HTML import rejects invalid inputs without reading a selected file", async () => {
  let reads = 0;
  const f = { name: "page.html", size: 20, text: async () => { reads++; return ""; } };
  for (const url of [undefined, "file:///etc/passwd", "http://127.0.0.1/"]) assert.equal((await html.importFile(f, run(), url)).issue.code, "URL_REJECTED");
  assert.equal((await html.importFile({ ...f, name: "page.txt" }, run(), source)).issue.code, "INPUT_MALFORMED");
  assert.equal((await html.importFile({ ...f, size: contracts.limits.maxBytes + 1 }, run(), source)).issue.code, "SIZE_LIMIT");
  assert.equal(reads, 0);
  assert.equal((await html.importFile(fixture("no-source-page.html"), run())).issue.code, "URL_REJECTED");
});
test("relative links, entities, duplicates, provenance and title survive once", async () => {
  const r = await html.importFile(fixture("relative-page.html"), run(), source);
  assert.equal(r.ok, true); assert.equal(r.page.title, "Saved & linked");
  assert.deepEqual(r.claims.map(c => c.target), ["https://example.test/about", "https://example.test/section/contact?x=1&y=2", "https://other.test/"]);
  assert.equal(r.claims[0].evidence.length, 2);
  assert.deepEqual(r.claims[0].evidence[1], { transport: "html-import", inputReference: "relative-page.html", sourceUrl: source, anchor: 2, evidenceClass: "observed-html" });
  assert.equal(r.acquisition.result.httpStatus, null); assert.equal(r.acquisition.result.status, "partial");
  assert.equal(r.issues.length, 2); assert.ok(r.claims.every(c => c.source === source && c.evidenceClass === "observed-html"));
});
test("hostile HTML remains inert and cannot substitute its embedded base", async () => {
  requests.length = 0;
  const before = document.documentElement.outerHTML;
  const r = await html.importFile(fixture("hostile-page.html"), run(), source);
  await new Promise(resolve => setTimeout(resolve, 25));
  assert.equal(r.ok, true); assert.deepEqual(r.claims.map(c => c.target), ["https://example.test/safe"]);
  assert.equal(dom.window.phase5Executed, undefined); assert.deepEqual(requests, []);
  assert.equal(document.documentElement.outerHTML, before);
  assert.match(r.issues[0].message, /base URL ignored/);
});
test("actual UTF-8 bytes, read failures, and parser availability fail closed", async () => {
  assert.equal((await html.importFile({ ...file("é".repeat(contracts.limits.maxBytes / 2 + 1)), size: 1 }, run(), source)).issue.code, "SIZE_LIMIT");
  assert.equal((await html.importFile({ ...file(""), text: async () => { throw Error(); } }, run(), source)).issue.code, "INPUT_MALFORMED");
  assert.equal((await html.importFile({ ...file(""), text: async () => 5 }, run(), source)).issue.code, "INPUT_MALFORMED");
  const saved = global.document; delete global.document;
  try { assert.equal((await html.importFile(file("<a href='/'>"), run(), source)).issue.code, "UNSUPPORTED_CONTENT"); }
  finally { global.document = saved; }
});
test("record, element, nesting and duration bounds reject or report partiality", async () => {
  const many = await html.importFile(file('<a href="/a"></a>'.repeat(contracts.limits.maxRecords + 1)), run(), source);
  assert.equal(many.ok, true); assert.equal(many.truncated, true); assert.equal(many.claims[0].evidence.length, contracts.limits.maxRecords);
  assert.equal((await html.importFile(file('<b></b>'.repeat(contracts.limits.maxElements + 1)), run(), source)).issue.code, "PARTIAL_LIMIT");
  assert.equal((await html.importFile(file('<div>'.repeat(contracts.limits.maxNesting + 1) + '</div>'.repeat(contracts.limits.maxNesting + 1)), run(), source)).issue.code, "PARTIAL_LIMIT");
  const saved = Date.now; let time = 0; Date.now = () => (time += contracts.limits.maxDurationMs + 1);
  try { assert.equal((await html.importFile(file(""), run(), source)).issue.code, "TIMEOUT"); } finally { Date.now = saved; }
});
test("empty and recoverable malformed HTML yield no invented links", async () => {
  for (const text of ["", "<html><p>No anchors", "<script><a href='/fake'></script>"]) {
    const r = await html.importFile(file(text, "PAGE.HTM"), run(), source); assert.equal(r.ok, true); assert.deepEqual(r.claims, []);
  }
});
