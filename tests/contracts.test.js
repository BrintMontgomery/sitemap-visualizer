"use strict";
const { test } = require("node:test");
const assert = require("node:assert/strict");
const c = require("../js/contracts.js");
const run = c.createRun({ mode: "live-cors", rootUrl: "https://example.org", maxPages: 2 });
const valid = () => ({ transport: "live-cors", status: "readable", resourceUrl: "https://example.org/a", observedFinalUrl: "https://example.org/a", httpStatus: 200, contentKind: "html", evidenceClass: "observed-html", payload: "hello", bytesRead: 5, issues: [], inputReference: "request", startedAt: "2026-10-26T00:00:00Z", elapsedMs: 5 });

test("normalize and deduplicate URLs while preserving meaningful distinctions", () => {
  assert.equal(c.normalizeUrl("../a/./b#x", "HTTPS://Example.org:443/z/").url, "https://example.org/a/b");
  assert.deepEqual(c.uniqueUrls(["https://EXAMPLE.org:443/a#x", "https://example.org/a#y", "https://example.org/a/", "https://example.org/a?q=1"]).urls, ["https://example.org/a", "https://example.org/a/", "https://example.org/a?q=1"]);
  assert.equal(c.inScope("https://sub.example.org/", "https://example.org/"), false);
});

test("reject malformed schemes and credentials while allowing configured intranet roots", () => {
  for (const url of ["javascript:alert(1)", "file:///tmp/a", "data:text/html,x", "ftp://intranet/a", "https://", "https://user:pass@example.org"]) assert.equal(c.normalizeUrl(url).ok, false, url);
  for (const url of ["https://example.org", "http://intranet/", "http://server.local/", "http://localhost/", "http://127.1/", "http://0x7f000001/", "http://10.0.0.1/", "http://172.31.0.1/", "http://192.168.1.2/", "http://169.254.169.254/", "http://metadata.google.internal/", "http://[::1]/", "http://[::ffff:127.0.0.1]/"]) assert.equal(c.normalizeUrl(url).ok, true, url);
  assert.equal(c.normalizeUrl("http://0x7f000001/").url, "http://127.0.0.1/");
  assert.equal(c.inScope("http://10.0.0.2/", "http://10.0.0.1/"), false);
});

test("validate provenance, transport, budgets, and never accept opaque or spoofed results", () => {
  const ok = c.validateResult(run, valid());
  assert.equal(ok.ok, true);
  assert.equal(ok.result.redirectHistory, null);
  assert.equal(ok.result.sourceOrigin, "https://example.org");
  for (const override of [{ opaque: true }, { responseType: "opaque" }, { responseType: "opaqueredirect" }, { responseType: "error" }, { transport: "iframe-bridge" }, { evidenceClass: "imported-link" }, { observedFinalUrl: "http://127.0.0.1" }, { observedFinalUrl: "https://other.example/" }, { bytesRead: 1 }, { bytesRead: 2000001 }, { issues: ["made-up"] }, { httpStatus: 404 }]) assert.equal(c.validateResult(run, { ...valid(), ...override }).ok, false, JSON.stringify(override));
  assert.equal(c.validateResult(run, { ...valid(), status: "not-readable" }).ok, false);
  assert.throws(() => c.createRun({ mode: "live-cors", maxDepth: 5 }), RangeError);
  assert.throws(() => c.createRun({ mode: "unknown" }), TypeError);
});

test("budget accounting rejects forged results and preserves state on rejection", () => {
  const budget = c.createBudget(run);
  const result = c.validateResult(run, valid());
  assert.equal(budget.accept({ ok: true, result: result.result }, ["https://example.org/"]), false);
  assert.equal(budget.accept(result, ["https://example.org/#a", "https://example.org/#b"]), true);
  assert.equal(budget.accept(result, ["https://example.org/a", "https://example.org/b"]), false);
  assert.deepEqual(budget.snapshot(), { bytes: 5, pages: 1 });
});

test("imports cannot spoof response metadata or observed link assertions", () => {
  const r = c.createRun({ mode: "csv-import" });
  const item = { ...valid(), transport: "csv-import", status: "user-supplied", resourceUrl: null, observedFinalUrl: null, httpStatus: null, contentKind: "links", evidenceClass: "imported-link" };
  assert.equal(c.validateResult(r, item).ok, true);
  assert.equal(c.validateResult(r, { ...item, evidenceClass: "observed-html" }).ok, false);
  assert.equal(c.validateResult(r, { ...item, httpStatus: 200 }).ok, false);
});
