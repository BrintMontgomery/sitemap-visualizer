"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const { JSDOM } = require("jsdom");
const contracts = require("../js/contracts");

const scripts = ["contracts", "csv-import", "xml-import", "html-import", "fetch-adapter", "discovery", "graph", "outcome-report", "metrics", "enhanced-import", "run-controls"];
const bridgeLike = (nonce, origin) => ({ type: "SV_RESPONSE", version: 1, nonce, requestedScope: "public-sitemap", origin, payload: { pages: ["https://bridge.example/", "https://bridge.example/private"], links: [{ source: "https://bridge.example/", target: "https://bridge.example/private" }] } });

test("shipped scripts and markup contain no iframe or postMessage transport", () => {
  const files = fs.readdirSync("js").filter(name => name.endsWith(".js"));
  assert.ok(files.length > 0);
  for (const name of files) {
    const source = fs.readFileSync(`js/${name}`, "utf8");
    for (const pattern of [/postMessage/, /addEventListener\(\s*["']message["']/, /\bonmessage\b/, /createElement\(\s*["']iframe["']/i, /contentWindow/, /\.frames\b/]) {
      assert.doesNotMatch(source, pattern, `${name} ${pattern}`);
    }
  }
  const html = fs.readFileSync("index.html", "utf8");
  assert.doesNotMatch(html, /<iframe/i);
  const dom = new JSDOM(html);
  const option = Array.from(dom.window.document.querySelectorAll("select[name=mode] option")).find(o => /Iframe bridge/.test(o.textContent));
  assert.ok(option);
  assert.equal(option.disabled, true);
  assert.equal(option.hasAttribute("value"), false);
  assert.match(contracts.modes["iframe-bridge"], /No compatible bridge/);
  dom.window.close();
});

test("contracts accept no iframe-bridge result or bridge-reported evidence", () => {
  const run = contracts.createRun({ mode: "iframe-bridge" });
  const base = { transport: "iframe-bridge", status: "partial", payload: "https://bridge.example/", bytesRead: 23, issues: [], inputReference: "bridge", startedAt: new Date().toISOString(), elapsedMs: 1 };
  for (const contentKind of ["html", "xml", "links", "records"]) {
    for (const evidenceClass of ["bridge-reported", "observed-html", "sitemap-only", "imported-link"]) {
      for (const status of ["readable", "partial", "user-supplied"]) {
        const result = contracts.validateResult(run, { ...base, contentKind, evidenceClass, status });
        assert.equal(result.ok, false, `${contentKind} ${evidenceClass} ${status}`);
        assert.equal(contracts.isValidatedResult(result), false);
      }
    }
  }
  const csvRun = contracts.createRun({ mode: "csv-import" });
  const csv = { ...base, transport: "csv-import", status: "user-supplied", contentKind: "links", evidenceClass: "bridge-reported" };
  assert.equal(contracts.validateResult(csvRun, csv).ok, false);
  assert.equal(contracts.createBudget(run).accept({ ok: true, result: { ...base, evidenceClass: "bridge-reported" } }, ["https://bridge.example/"]), false);
  assert.equal(contracts.validateResult(run, { ...base, status: "not-readable", issueCode: "BRIDGE_UNAVAILABLE" }).issue.code, "BRIDGE_UNAVAILABLE");
});

for (const tampered of [false, true]) {
  test(`disabled bridge mode ${tampered ? "with tampered option value" : "selected by script"} fails closed; spoofed messages never mutate the graph`, async () => {
    const dom = new JSDOM(fs.readFileSync("index.html", "utf8"), { runScripts: "outside-only" });
    const w = dom.window;
    const fetchUrls = [], messageListeners = [], frames = [];
    w.TextEncoder = TextEncoder;
    w.TextDecoder = TextDecoder;
    w.AbortController = AbortController;
    w.fetch = async url => { fetchUrls.push(url); throw new TypeError("Failed to fetch"); };
    const addListener = w.addEventListener.bind(w);
    w.addEventListener = (type, listener, options) => { if (type === "message") messageListeners.push(listener); return addListener(type, listener, options); };
    const createElement = w.document.createElement.bind(w.document);
    w.document.createElement = (name, options) => { if (String(name).toLowerCase() === "iframe") frames.push(name); return createElement(name, options); };
    try {
      for (const name of scripts) w.eval(fs.readFileSync(`js/${name}.js`, "utf8"));
      const form = w.document.getElementById("run-form");
      const status = w.document.getElementById("run-status");
      const submit = () => form.onsubmit({ preventDefault() {} });
      const spoof = () => {
        for (const origin of ["null", "https://bridge.example", "file://", ""]) {
          for (const nonce of ["", "guessed-nonce", null]) {
            w.dispatchEvent(new w.MessageEvent("message", { data: bridgeLike(nonce, origin), origin, source: w }));
            w.dispatchEvent(new w.MessageEvent("message", { data: JSON.stringify(bridgeLike(nonce, origin)), origin }));
          }
        }
        w.dispatchEvent(new w.MessageEvent("message", { data: "<a href='https://bridge.example/x'>x</a>", origin: "https://bridge.example" }));
        w.dispatchEvent(new w.MessageEvent("message", { data: null, origin: "null" }));
      };

      const option = Array.from(form.elements.mode.options).find(o => /Iframe bridge/.test(o.textContent));
      if (tampered) { option.disabled = false; option.value = "iframe-bridge"; }
      option.selected = true;
      form.elements.mode.onchange();
      form.elements.rootUrl.value = "https://bridge.example/";
      await submit();
      assert.equal(status.dataset.state, "failed");
      assert.equal(form.graph, null);
      assert.equal(form.report.outcome, "not-supported");
      assert.ok(form.report.issues.some(i => i.code === "NOT_SUPPORTED"));
      assert.match(form.report.alternatives, /Links CSV/);
      assert.match(form.report.alternatives, /Sitemap XML/);
      assert.equal(form.report.counts.pages, 0);

      spoof();
      assert.equal(form.graph, null);
      assert.equal(status.dataset.state, "failed");

      form.elements.rootUrl.value = "https://example.test/";
      form.elements.mode.value = "csv-import";
      form.elements.mode.onchange();
      const text = fs.readFileSync("sample-data/four-page-links.csv", "utf8");
      Object.defineProperty(form.elements.inputFile, "files", { value: [{ name: "links.csv", size: Buffer.byteLength(text), text: async () => text }] });
      await submit();
      assert.equal(status.dataset.state, "complete");
      const graph = form.graph, report = form.report;
      assert.equal(graph.nodes.length, 4);
      assert.equal(graph.edges.length, 4);
      const snapshot = JSON.stringify(graph);
      assert.doesNotMatch(snapshot, /bridge/);

      spoof();
      assert.equal(form.graph, graph);
      assert.equal(form.report, report);
      assert.equal(graph.nodes.length, 4);
      assert.equal(graph.edges.length, 4);
      assert.equal(JSON.stringify(graph), snapshot);
      assert.equal(status.dataset.state, "complete");
      assert.deepEqual(messageListeners, []);
      assert.deepEqual(frames, []);
      assert.equal(w.document.querySelectorAll("iframe").length, 0);
      assert.deepEqual(fetchUrls, []);
    } finally { w.close(); }
  });
}
