"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");

for (const unavailable of [false, true]) {
  test(`live ${unavailable ? "fetch unavailable" : "network/policy failure"} never falls back to XHR; local CSV still works`, async () => {
    const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), { runScripts: "outside-only" });
    const w = dom.window;
    const fetchUrls = [];
    let xhrCalls = 0;
    w.TextEncoder = TextEncoder;
    w.TextDecoder = TextDecoder;
    w.AbortController = AbortController;
    w.fetch = unavailable ? undefined : async url => { fetchUrls.push(url); throw new TypeError("Failed to fetch"); };
    w.XMLHttpRequest = function () { xhrCalls++; throw new Error("XHR is unshipped"); };
    try {
      for (const name of ["contracts", "csv-import", "xml-import", "html-import", "fetch-adapter", "discovery", "graph", "outcome-report", "enhanced-import", "run-controls"]) {
        w.eval(fs.readFileSync(`js/${name}.js`, "utf8"));
      }
      const form = w.document.getElementById("run-form");
      const status = w.document.getElementById("run-status");
      const selectMode = mode => { form.elements.mode.value = mode; form.elements.mode.onchange(); };
      const submit = () => form.onsubmit({ preventDefault() {} });
      form.elements.rootUrl.value = "https://example.test/";
      selectMode("live-cors");
      await submit();
      assert.equal(status.dataset.state, "failed");
      assert.equal(form.graph, null);
      assert.equal(form.attempt.bytesRead, 0);
      assert.equal(form.attempt.httpStatus, null);
      assert.equal(form.attempt.observedFinalUrl, null);
      assert.equal(form.attempt.issues[0], unavailable ? "UNSUPPORTED_CONTENT" : "NETWORK_OR_POLICY_FAILURE");
      if (!unavailable) assert.match(w.document.getElementById("outcome-guidance").textContent, /does not reveal which cause/);
      const expectedUrls = unavailable ? [] : ["https://example.test/", "https://example.test/sitemap.xml"];
      assert.deepEqual(fetchUrls, expectedUrls);
      assert.equal(xhrCalls, 0);

      selectMode("csv-import");
      const text = fs.readFileSync("sample-data/four-page-links.csv", "utf8");
      Object.defineProperty(form.elements.inputFile, "files", { value: [{ name: "links.csv", size: Buffer.byteLength(text), text: async () => text }] });
      await submit();
      assert.equal(status.dataset.state, "complete");
      assert.equal(form.graph.nodes.length, 4);
      assert.equal(form.graph.edges.length, 4);
      assert.equal(form.report.outcome, "user-supplied");
      assert.deepEqual(fetchUrls, expectedUrls);
      assert.equal(xhrCalls, 0);
    } finally { w.close(); }
  });
}
