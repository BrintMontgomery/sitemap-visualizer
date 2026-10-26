"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { spawnSync } = require("node:child_process");
const c = require("../js/contracts.js");
const adapter = require("../js/xml-import.js");
// The production parser is the browser's DOMParser. The Node harness supplies
// an XML DOM backed by Python's standard-library parser for deterministic tests.
global.DOMParser = class { parseFromString(text) {
  const p = spawnSync("python3", ["tests/xml-dom-helper.py"], { input: text, encoding: "utf8" });
  if (p.status !== 0) throw new Error(p.stderr);
  const root = JSON.parse(p.stdout);
  return { documentElement: root, getElementsByTagName: () => root ? [] : [{}] };
}};
const run = () => c.createRun({ mode: "xml-import" });
const file = (text, name = "map.xml") => ({ name, size: Buffer.byteLength(text), text: async () => text });
const fixture = name => file(fs.readFileSync(`sample-data/${name}`, "utf8"), name);
const selected = (f, sourceUrl) => ({ file: f, sourceUrl });

test("urlset produces inventory with null depth and no edges", async () => {
  const result = await adapter.importFiles([selected(fixture("four-page-sitemap.xml"), "https://example.test/sitemap.xml")], run());
  assert.equal(result.ok, true); assert.equal(result.memberships.length, 4);
  assert.ok(result.memberships.every(m => m.depth === null && m.evidenceClass === "sitemap-only" && m.sourceSitemap === "https://example.test/sitemap.xml"));
  assert.equal(result.claims, undefined); assert.equal(result.acquisitions[0].result.status, "user-supplied");
});
test("nested mapped indexes terminate cycles and report missing references without fetching", async () => {
  const a = fixture("index-sitemap.xml"), b = fixture("nested-sitemap.xml"), urls = fixture("nested-urlset.xml");
  const result = await adapter.importFiles([selected(a, "https://example.test/index.xml"), selected(b, "https://example.test/nested.xml"), selected(urls, "https://example.test/pages.xml")], run());
  assert.equal(result.acquisitions.length, 3); assert.equal(result.memberships.length, 1);
  assert.equal(result.memberships[0].lastmod, "2026-10-01");
  assert.equal(result.references.length, 4); assert.equal(result.references.filter(r => !r.resolved).length, 1);
  assert.equal(result.status, "partial");
});
test("malformed and entity-bearing XML are rejected without evidence", async () => {
  for (const text of ["<urlset><url></urlset>", '<!DOCTYPE urlset [<!ENTITY x "https://example.test/">]><urlset><url><loc>&x;</loc></url></urlset>', '<urlset><url><loc>https://example.test/?x=1&y=2</loc></url></urlset>', '<urlset xmlns="https://wrong.test/"></urlset>']) {
    const result = await adapter.importFiles([selected(file(text))], run()); assert.equal(result.ok, false); assert.equal(result.issue.code, "INPUT_MALFORMED");
  }
});
test("size, structure and entry limits are enforced", async () => {
  let read = false; const oversized = { name: "oversized.xml", size: c.limits.maxBytes + 1, text: async () => { read = true; return ""; } };
  assert.equal((await adapter.importFiles([selected(oversized)], run())).issue.code, "SIZE_LIMIT"); assert.equal(read, false);
  const deep = "<urlset>" + "<a>".repeat(c.limits.maxNesting) + "</a>".repeat(c.limits.maxNesting) + "</urlset>";
  assert.equal((await adapter.importFiles([selected(file(deep))], run())).issue.code, "PARTIAL_LIMIT");
  const manyElements = "<urlset>" + "<a/>".repeat(c.limits.maxElements) + "</urlset>";
  assert.equal((await adapter.importFiles([selected(file(manyElements))], run())).issue.code, "PARTIAL_LIMIT");
  // 10,001 simple entries fit the element cap using one loc per url only if the
  // cap is temporarily reached first; duplicate empty url elements exercise entry cap.
  const many = "<urlset>" + "<url/>".repeat(c.limits.maxRecords + 1) + "</urlset>";
  const r = await adapter.importFiles([selected(file(many))], run()); assert.equal(r.truncated, true); assert.equal(r.issues.at(-1).code, "PARTIAL_LIMIT");
});
test("selected mappings are explicit, unique and do not read unrelated files", async () => {
  let reads = 0; const unused = { name: "unused.xml", size: 0, text: async () => { reads++; return ""; } };
  const first = selected(fixture("four-page-sitemap.xml"), "https://example.test/map.xml");
  const result = await adapter.importFiles([first, selected(unused, "https://example.test/unused.xml")], run());
  assert.equal(result.ok, true); assert.equal(reads, 0);
  assert.equal((await adapter.importFiles([first, selected(unused, "https://example.test/map.xml#fragment")], run())).issue.code, "INPUT_MALFORMED");
});
test("namespaces, invalid URLs, duplicate loc and XML escaped values are handled", async () => {
  const xml = '<s:urlset xmlns:s="http://www.sitemaps.org/schemas/sitemap/0.9"><s:url><s:loc>https://example.test/a?x=1&amp;y=2</s:loc></s:url><s:url><s:loc>file:///etc/passwd</s:loc></s:url><s:url><s:loc>https://example.test/</s:loc><s:loc>https://example.test/a</s:loc></s:url></s:urlset>';
  const r = await adapter.importFiles([selected(file(xml))], run());
  assert.equal(r.memberships.length, 1); assert.equal(r.memberships[0].url, "https://example.test/a?x=1&y=2"); assert.deepEqual(r.issues.map(x => x.code), ["URL_REJECTED", "INPUT_MALFORMED"]);
});
