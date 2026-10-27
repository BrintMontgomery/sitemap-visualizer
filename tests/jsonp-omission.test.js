"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const contracts = require("../js/contracts");

// AT-29 for the omitted P2 JSONP mode: no adapter ships, and no path loads remote script.
const scripts = ["contracts", "csv-import", "xml-import", "html-import", "fetch-adapter", "discovery", "graph", "outcome-report", "metrics", "enhanced-import", "run-controls"];

test("shipped scripts and markup contain no JSONP or dynamic script loader", () => {
  const files = fs.readdirSync("js").filter(name => name.endsWith(".js"));
  assert.ok(files.length > 0);
  for (const name of files) {
    const source = fs.readFileSync(`js/${name}`, "utf8");
    for (const pattern of [/createElement\(\s*["']script["']/i, /\bimportScripts\b/, /\bimport\(/, /[?&]callback=/, /__sv_jsonp/, /\beval\(/, /new Function\(/]) {
      assert.doesNotMatch(source, pattern, `${name} ${pattern}`);
    }
  }
  const html = fs.readFileSync("index.html", "utf8");
  const dom = new JSDOM(html);
  const doc = dom.window.document;
  for (const script of doc.querySelectorAll("script")) {
    assert.match(script.getAttribute("src") || "", /^js\/[a-z-]+(\.bundle)?\.js$/, "only local classic scripts");
    assert.equal(script.hasAttribute("type"), false);
  }
  assert.equal(doc.querySelectorAll("script:not([src])").length, 0);
  const option = Array.from(doc.querySelectorAll("select[name=mode] option")).find(o => /JSONP/.test(o.textContent));
  assert.ok(option);
  assert.equal(option.disabled, true);
  assert.equal(option.hasAttribute("value"), false);
  assert.match(option.textContent, /no approved provider/);
  assert.match(contracts.modes["jsonp-provider"], /No approved provider/);
  dom.window.close();
});

test("contracts accept no jsonp-provider result or jsonp-reported evidence", () => {
  const run = contracts.createRun({ mode: "jsonp-provider" });
  const base = { transport: "jsonp-provider", status: "partial", payload: "https://provider.example/", bytesRead: 25, issues: [], inputReference: "jsonp", startedAt: new Date().toISOString(), elapsedMs: 1 };
  for (const contentKind of ["html", "xml", "links", "records"]) {
    for (const evidenceClass of ["jsonp-reported", "observed-html", "sitemap-only", "imported-link"]) {
      for (const status of ["readable", "partial", "user-supplied"]) {
        const result = contracts.validateResult(run, { ...base, contentKind, evidenceClass, status });
        assert.equal(result.ok, false, `${contentKind} ${evidenceClass} ${status}`);
        assert.equal(contracts.isValidatedResult(result), false);
      }
    }
  }
  const csvRun = contracts.createRun({ mode: "csv-import" });
  const csv = { ...base, transport: "csv-import", status: "user-supplied", contentKind: "links", evidenceClass: "jsonp-reported" };
  assert.equal(contracts.validateResult(csvRun, csv).ok, false);
  assert.equal(contracts.createBudget(run).accept({ ok: true, result: { ...base, evidenceClass: "jsonp-reported" } }, ["https://provider.example/"]), false);
  assert.equal(contracts.validateResult(run, { ...base, status: "not-readable", issueCode: "JSONP_DISABLED" }).issue.code, "JSONP_DISABLED");
});

for (const tampered of [false, true]) {
  test(`disabled JSONP mode ${tampered ? "with tampered option value" : "selected by script"} fails closed and never loads a script`, async () => {
    const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), { runScripts: "outside-only" });
    const w = dom.window;
    const fetchUrls = [], created = [];
    w.TextEncoder = TextEncoder;
    w.TextDecoder = TextDecoder;
    w.AbortController = AbortController;
    w.fetch = async url => { fetchUrls.push(url); throw new TypeError("Failed to fetch"); };
    const createElement = w.document.createElement.bind(w.document);
    w.document.createElement = (name, options) => { if (String(name).toLowerCase() === "script") created.push(name); return createElement(name, options); };
    const scriptCount = () => w.document.querySelectorAll("script").length;
    const globals = () => Object.keys(w).filter(key => /jsonp|callback/i.test(key));
    try {
      for (const name of scripts) w.eval(fs.readFileSync(`js/${name}.js`, "utf8"));
      const initialScripts = scriptCount(), initialGlobals = globals();
      const form = w.document.getElementById("run-form");
      const status = w.document.getElementById("run-status");
      const submit = () => form.onsubmit({ preventDefault() {} });

      const option = Array.from(form.elements.mode.options).find(o => /JSONP/.test(o.textContent));
      if (tampered) { option.disabled = false; option.value = "jsonp-provider"; }
      option.selected = true;
      form.elements.mode.onchange();
      for (const url of ["https://provider.example/inventory.js?callback=cb", "https://example.test/sitemap.xml", "javascript:alert(1)"]) {
        form.elements.rootUrl.value = url;
        await submit();
        assert.equal(status.dataset.state, "failed", url);
        assert.equal(form.graph, null);
        assert.equal(form.report.outcome, "not-supported");
        assert.ok(form.report.issues.some(i => i.code === "NOT_SUPPORTED"));
        assert.match(form.report.alternatives, /Links CSV/);
        assert.equal(form.report.counts.pages, 0);
      }

      form.elements.rootUrl.value = "https://example.test/";
      form.elements.mode.value = "csv-import";
      form.elements.mode.onchange();
      const text = fs.readFileSync("sample-data/four-page-links.csv", "utf8");
      Object.defineProperty(form.elements.inputFile, "files", { value: [{ name: "links.csv", size: Buffer.byteLength(text), text: async () => text }] });
      await submit();
      assert.equal(status.dataset.state, "complete");
      assert.equal(form.graph.nodes.length, 4);
      assert.equal(form.graph.edges.length, 4);
      assert.doesNotMatch(JSON.stringify(form.graph), /jsonp|provider\.example/);

      assert.deepEqual(created, []);
      assert.equal(scriptCount(), initialScripts);
      assert.deepEqual(globals(), initialGlobals);
      assert.deepEqual(fetchUrls, []);
    } finally { w.close(); }
  });
}
