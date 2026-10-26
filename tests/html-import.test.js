"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const contracts = require("../js/contracts.js");
const html = require("../js/html-import.js");
const run = () => contracts.createRun({ mode: "html-import" });
test("HTML import rejects invalid inputs without reading a selected file", async () => {
  let reads = 0;
  const file = { name: "page.html", size: 20, text: async () => { reads++; return "<a href='/'>home</a>"; } };
  for (const source of [undefined, "file:///etc/passwd", "http://127.0.0.1/"]) {
    assert.equal((await html.importFile(file, run(), source)).issue.code, "URL_REJECTED");
  }
  assert.equal((await html.importFile({ ...file, name: "page.txt" }, run(), "https://example.test/")).issue.code, "INPUT_MALFORMED");
  assert.equal((await html.importFile({ ...file, size: contracts.limits.maxBytes + 1 }, run(), "https://example.test/")).issue.code, "SIZE_LIMIT");
  assert.equal((await html.importFile(file, run(), "https://example.test/")).issue.code, "UNSUPPORTED_CONTENT");
  assert.equal(reads, 0);
});
