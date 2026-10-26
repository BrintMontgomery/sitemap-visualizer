"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const c = require("../js/contracts.js");
const adapter = require("../js/csv-import.js");
const run = () => c.createRun({ mode: "csv-import" });
const file = (text, name = "links.csv") => ({ name, size: Buffer.byteLength(text), text: async () => text });
const fixture = (name) => file(fs.readFileSync(`sample-data/${name}`, "utf8"), name);

test("four-page links are validated as user assertions with file and row provenance", async () => {
  const r = run(), result = await adapter.importFile(fixture("four-page-links.csv"), r);
  assert.equal(result.ok, true); assert.equal(result.claims.length, 4);
  assert.equal(new Set(result.claims.flatMap(x => [x.source, x.target])).size, 4);
  assert.deepEqual(result.claims[0].evidence[0], { transport: "csv-import", inputReference: "four-page-links.csv", row: 2, evidenceClass: "imported-link" });
  assert.equal(c.createBudget(r).accept(result.acquisition, [...new Set(result.claims.flatMap(x => [x.source, x.target]))]), true);
});
test("duplicates retain evidence and malformed or formula-like endpoints are rejected", async () => {
  const duplicate = await adapter.importFile(fixture("duplicate-links.csv"), run());
  assert.equal(duplicate.claims.length, 1); assert.deepEqual(duplicate.claims[0].evidence.map(x => x.row), [2, 3]);
  const bad = await adapter.importFile(fixture("malformed-links.csv"), run());
  assert.equal(bad.claims.length, 0); assert.deepEqual(bad.issues.map(x => x.row), [2, 3, 4]);
  const formula = await adapter.importFile(fixture("formula-like-links.csv"), run());
  assert.equal(formula.claims.length, 1); assert.equal(formula.issues[0].row, 2);
});
test("handles quoted commas, escaped quotes, multiline fields and physical row numbers", async () => {
  const input = 'source,target,note\r\n"https://example.test/a?q=1,2",https://example.test/b,"first\nsecond ""quoted"""\r\nhttps://example.test/b,https://example.test/c,ok\r\n';
  const result = await adapter.importFile(file(input), run());
  assert.equal(result.claims.length, 2); assert.equal(result.claims[1].evidence[0].row, 4);
  assert.equal(result.claims[0].source, "https://example.test/a?q=1,2");
});
test("rejects invalid headers, unreadable and oversized files without reading them", async () => {
  for (const data of ["source;target\na;b", "source,source,target\na,b,c", '"source,target']) assert.equal((await adapter.importFile(file(data), run())).ok, false);
  let read = false;
  const big = { name: "big.csv", size: c.limits.maxBytes + 1, text: async () => { read = true; return ""; } };
  assert.equal((await adapter.importFile(big, run())).issue.code, "SIZE_LIMIT"); assert.equal(read, false);
  assert.equal((await adapter.importFile({ name: "x", size: 1, text: async () => { throw Error(); } }, run())).ok, false);
});
test("record cap reports partiality; 30-page fixture remains available to graph phase", async () => {
  const thirty = await adapter.importFile(fixture("thirty-page-links.csv"), run());
  assert.equal(new Set(thirty.claims.flatMap(x => [x.source, x.target])).size, 30);
  const row = 'https://example.test/,https://example.test/a\n';
  const result = await adapter.importFile(file('source,target\n' + row.repeat(c.limits.maxRecords + 1)), run());
  assert.equal(result.truncated, true); assert.equal(result.acquisition.result.status, "partial"); assert.equal(result.issues.at(-1).row, c.limits.maxRecords + 2);
});
