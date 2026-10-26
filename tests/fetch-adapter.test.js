"use strict";
const { test, after } = require("node:test");
const assert = require("node:assert/strict");
const { JSDOM } = require("jsdom");
const c = require("../js/contracts");
const adapter = require("../js/fetch-adapter");
const html = require("../js/html-import");
const graph = require("../js/graph");
const dom = new JSDOM(""); global.document = dom.window.document;
after(() => { delete global.document; dom.window.close(); });
const root = "http://10.20.30.40/";
const run = (url = root, maxPages = 50) => c.createRun({ mode: "live-cors", rootUrl: url, maxPages });
const drain = () => new Promise(setImmediate);
// Keep deterministic timeout/rate tests compatible with the project's Node 18 floor.
function fakeClock(t) {
  const RealDate = global.Date, nativeSet = global.setTimeout, nativeClear = global.clearTimeout;
  let now = RealDate.now(), id = 0; const timers = new Map();
  global.Date = class extends RealDate {
    constructor(...args) { super(...(args.length ? args : [now])); }
    static now() { return now; }
  };
  global.setTimeout = (fn, delay) => { const key = ++id; timers.set(key, { at: now + Math.max(0, delay), fn }); return key; };
  global.clearTimeout = key => timers.delete(key);
  t.after(() => { global.Date = RealDate; global.setTimeout = nativeSet; global.clearTimeout = nativeClear; });
  return { tick(ms) {
    now += ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) return;
      timers.delete(next[0]); next[1].fn();
    }
  } };
}
function response(url = root, text = "<title>Intranet</title><a href='/a'>A</a>", options = {}) {
  const state = { reads: 0, cancelled: false };
  const chunks = options.chunks || [new TextEncoder().encode(text)]; let index = 0;
  return { type: "cors", url, status: 200, headers: new Headers({ "Content-Type": "text/html; charset=utf-8" }),
    body: { getReader: () => ({ read: async () => { state.reads++; return index < chunks.length ? { value: chunks[index++], done: false } : { done: true }; }, cancel: () => { state.cancelled = true; }, releaseLock() {} }) }, ...options, state };
}
async function acquire(res, options = {}) {
  const session = adapter.createSession(run(), { fetch: async () => res, ...options });
  try { return await session.request(); } finally { session.close(); }
}

test("ordinary CORS GET uses no credentials/custom headers; live HTML has correct graph provenance", async () => {
  let call;
  const session = adapter.createSession(run(), { fetch: async (url, options) => { call = { url, options }; return response(); } });
  try {
    const r = await session.request(); assert.equal(r.ok, true);
    assert.equal(call.url, root);
    assert.deepEqual(Object.keys(call.options).sort(), ["credentials", "method", "mode", "redirect", "referrerPolicy", "signal"]);
    assert.equal(call.options.credentials, "omit"); assert.equal(call.options.mode, "cors"); assert.equal(call.options.method, "GET"); assert.equal(call.options.redirect, "follow");
    assert.equal(call.options.referrerPolicy, "no-referrer"); assert.ok(call.options.signal instanceof AbortSignal);
    assert.equal(c.isValidatedResult(r.acquisition), true);
    assert.equal(r.attempt.observedFinalUrl, root); assert.equal(r.attempt.httpStatus, 200);
    assert.equal(r.attempt.redirectHistory, null); assert.equal(r.attempt.sourceOrigin, "http://10.20.30.40");
    assert.ok(r.attempt.elapsedMs >= 0); assert.ok(r.attempt.bytesRead > 0);
    const batch = html.fromAcquisition(run(), r.acquisition), g = graph.buildGraph(run(), [batch]);
    assert.equal(g.nodes.find(n => n.url === root).fetched, true);
    assert.equal(g.nodes.find(n => n.url === root).httpStatus, 200);
    assert.equal(g.nodes.find(n => n.url === root + "a").fetched, false);
    assert.equal(g.nodes.find(n => n.url === root + "a").httpStatus, null);
    assert.deepEqual(g.edges.map(e => [e.source, e.target]), [[root, root + "a"]]);
    assert.equal(g.edges[0].evidence[0].transport, "live-cors"); assert.equal(g.acquisitions[0].elapsedMs, r.acquisition.result.elapsedMs);
  } finally { session.close(); }
});

test("private, intranet, loopback and IPv6 roots work; schemes, credentials and other hosts never fetch", async () => {
  for (const url of ["http://intranet/", "http://server.local/", "http://localhost/", "http://127.0.0.1/", "http://192.168.10.1/", "http://172.16.0.1/", "http://[::1]/"]) {
    let calls = 0;
    const s = adapter.createSession(run(url), { fetch: async u => { calls++; return response(u); } });
    try {
      assert.equal((await s.request("javascript:alert(1)")).issue.code, "URL_REJECTED");
      assert.equal((await s.request("http://user:pass@intranet/")).issue.code, "URL_REJECTED");
      assert.equal((await s.request("https://other.test/")).issue.code, "SCOPE_EXCLUDED");
      assert.equal(calls, 0); assert.equal((await s.request()).ok, true); assert.equal(calls, 1);
    } finally { s.close(); }
  }
  assert.throws(() => adapter.createSession(c.createRun({ mode: "csv-import" })), TypeError);
  for (const timeout of [0, -1, 10001, NaN, 1.5]) assert.throws(() => adapter.createSession(run(), { requestTimeoutMs: timeout }), RangeError);
});

test("CORS/network failures retain unknown metadata, never fabricate evidence or attempt a fallback", async () => {
  for (const error of [new TypeError("Failed to fetch"), new Error("socket dropped"), { code: "invented" }]) {
    let calls = 0;
    const s = adapter.createSession(run(), { fetch: async () => { calls++; throw error; } });
    try {
      const r = await s.request(); assert.equal(r.ok, false); assert.equal(r.issue.code, "NETWORK_OR_POLICY_FAILURE");
      assert.match(r.issue.message, /cause is unknown/); assert.match(r.issue.message, /Import/);
      assert.equal(r.acquisition, undefined); assert.equal(r.attempt.observedFinalUrl, null); assert.equal(r.attempt.httpStatus, null); assert.equal(r.attempt.bytesRead, 0);
      assert.equal(calls, 1);
    } finally { s.close(); }
  }
});

test("opaque/error/default responses cannot supply a body, status or final URL", async () => {
  for (const type of ["opaque", "opaqueredirect", "error", "default"]) {
    const res = response(root, "secret", { type }); const r = await acquire(res);
    assert.equal(r.issue.code, "OPAQUE_RESPONSE"); assert.equal(res.state.reads, 0);
    assert.equal(r.attempt.httpStatus, null); assert.equal(r.attempt.observedFinalUrl, null); assert.equal(r.acquisition, undefined);
  }
});

test("HTTP failures and observable scope changes retain metadata but cancel bodies without parsing", async () => {
  for (const [options, code] of [[{ status: 404 }, "HTTP_ERROR"], [{ status: 500 }, "HTTP_ERROR"], [{ url: "http://other.test/page" }, "SCOPE_EXCLUDED"], [{ url: "file:///secret" }, "SCOPE_EXCLUDED"]]) {
    const res = response(root, "", options), r = await acquire(res);
    assert.equal(r.issue.code, code); assert.equal(r.attempt.httpStatus, options.status || 200);
    assert.equal(res.state.reads, 0); assert.equal(res.state.cancelled, true); assert.equal(r.acquisition, undefined);
    assert.equal(r.attempt.redirectHistory, null);
  }
});

test("same-host redirects resolve links against the final page and never become link edges", async () => {
  const r = await acquire(response(root + "dir/home", "<title>Moved</title><a href='child'>child</a>"));
  const batch = html.fromAcquisition(run(), r.acquisition), g = graph.buildGraph(run(), [batch]);
  assert.deepEqual(g.edges.map(e => [e.source, e.target]), [[root + "dir/home", root + "dir/child"]]);
  assert.deepEqual(g.redirectAliases.map(a => [a.source, a.target]), [[root, root + "dir/home"]]);
  assert.equal(g.nodes.find(n => n.url === root + "dir/home").httpStatus, 200);
  assert.ok(g.nodes.every(n => n.depth === null));
});

test("content type, charset and streaming capability fail closed; XML stays inventory data", async () => {
  for (const type of ["", "text/plain", "application/json", "image/png", "text/html; charset=windows-1252"]) {
    const res = response(root, "<a href='/fake'>", { headers: new Headers({ "content-type": type }) });
    assert.equal((await acquire(res)).issue.code, "UNSUPPORTED_CONTENT"); assert.equal(res.state.reads, 0); assert.equal(res.state.cancelled, true);
  }
  assert.equal((await acquire(response(root, "", { body: null }))).issue.code, "UNSUPPORTED_CONTENT");
  const r = await acquire(response(root, "<urlset/>", { headers: new Headers({ "content-type": "application/xml" }) }));
  assert.equal(r.ok, true); assert.equal(r.acquisition.result.evidenceClass, "sitemap-only");
  assert.equal(html.fromAcquisition(run(), r.acquisition).ok, false);
  assert.equal(html.fromAcquisition(run(), { ...r.acquisition }).ok, false);
});

test("byte limits cover announced lengths, actual decoded streams, UTF-8 boundaries and malformed encodings", async () => {
  const announced = response(root, "small", { headers: new Headers({ "content-type": "text/html", "content-length": String(c.limits.maxBytes + 1) }) });
  assert.equal((await acquire(announced)).issue.code, "SIZE_LIMIT"); assert.equal(announced.state.reads, 0); assert.equal(announced.state.cancelled, true);
  const over = response(root, "", { chunks: [new Uint8Array(c.limits.maxBytes), new Uint8Array(1)] });
  const rejected = await acquire(over); assert.equal(rejected.issue.code, "SIZE_LIMIT"); assert.equal(rejected.attempt.bytesRead, c.limits.maxBytes + 1); assert.equal(over.state.cancelled, true);
  const exact = await acquire(response(root, "", { chunks: [new Uint8Array(c.limits.maxBytes).fill(65)] })); assert.equal(exact.ok, true);
  const split = await acquire(response(root, "", { chunks: [Uint8Array.of(0xe2), Uint8Array.of(0x82, 0xac)] }));
  assert.equal(split.acquisition.result.payload, "€"); assert.equal(split.attempt.bytesRead, 3);
  for (const chunk of [Uint8Array.of(0xff), Uint8Array.of(0xe2)]) assert.equal((await acquire(response(root, "", { chunks: [chunk] }))).issue.code, "UNSUPPORTED_CONTENT");
  const dropped = response(root, "", { body: { getReader: () => ({ read: async () => { throw new TypeError("connection lost"); }, cancel() {}, releaseLock() {} }) } });
  assert.equal((await acquire(dropped)).issue.code, "NETWORK_OR_POLICY_FAILURE");
});

test("timeout settles even a fetch that ignores abort; late bodies never enter budgets", async t => {
  const clock = fakeClock(t);
  let finish, signal;
  const s = adapter.createSession(run(), { requestTimeoutMs: 20, fetch: (_, o) => { signal = o.signal; return new Promise(r => { finish = r; }); } });
  const pending = s.request(); clock.tick(20); await drain();
  assert.equal((await pending).issue.code, "TIMEOUT"); assert.equal(signal.aborted, true);
  const late = response(root, "late", { body: { cancel: () => {} } }); finish(late); await drain();
  assert.equal(s.snapshot().bytesRead, 0); assert.equal(s.snapshot().active, 0); s.close();
});

test("a queued internal endpoint proceeds after the preceding request times out", async t => {
  const clock = fakeClock(t);
  const calls = [];
  const s = adapter.createSession(run(), { requestTimeoutMs: 20, fetch: async url => {
    calls.push(url);
    if (url.endsWith("hang")) return new Promise(() => {});
    return response(url);
  } });
  const stalled = s.request(root + "hang"), queued = s.request(root + "good");
  clock.tick(20); await drain();
  assert.equal((await stalled).issue.code, "TIMEOUT"); assert.equal(calls.length, 1);
  clock.tick(980); await drain();
  assert.equal((await queued).ok, true); assert.deepEqual(calls, [root + "hang", root + "good"]);
  assert.equal(s.snapshot().active, 0); assert.equal(s.snapshot().queued, 0); s.close();
});

test("body-read stalls time out, cancellation handles active/queued/pre-aborted work and cleans up", async t => {
  const clock = fakeClock(t);
  let cancelled = 0, calls = 0;
  const s = adapter.createSession(run(), { requestTimeoutMs: 20, fetch: async () => { calls++; return response(root, "", { body: { getReader: () => ({ read: () => new Promise(() => {}), cancel: () => { cancelled++; }, releaseLock() {} }) } }); } });
  const first = s.request(); await drain(); clock.tick(20); await drain();
  assert.equal((await first).issue.code, "TIMEOUT"); assert.equal(cancelled, 1);
  const controller = new AbortController(), queued = s.request(root, { signal: controller.signal }); controller.abort();
  assert.equal((await queued).issue.code, "CANCELLED");
  assert.equal((await s.request(root, { signal: controller.signal })).issue.code, "CANCELLED");
  const next = s.request(); clock.tick(1000); await drain();
  s.close(); assert.equal((await next).issue.code, "CANCELLED"); assert.equal((await s.request()).issue.code, "CANCELLED");
  await drain(); assert.equal(calls, 2); assert.equal(s.snapshot().active, 0); assert.equal(s.snapshot().queued, 0);
});

test("a 40-request burst respects concurrency/rate; failures free slots and queued requests proceed", async t => {
  const clock = fakeClock(t);
  const starts = [], finishers = [];
  const s = adapter.createSession(run(), { fetch: (u, o) => { starts.push(Date.now()); return new Promise((resolve, reject) => { finishers.push({ resolve, reject, u, signal: o.signal }); }); } });
  const pending = Array.from({ length: 40 }, (_, i) => s.request(root + i));
  assert.equal(starts.length, 1); clock.tick(1000); await drain(); assert.equal(starts.length, 2);
  clock.tick(1000); await drain(); assert.equal(starts.length, 2); assert.equal(s.snapshot().active, 2);
  finishers[0].reject(new TypeError("CORS or transport failure")); await drain(); assert.equal(starts.length, 3);
  finishers[1].resolve(response(root + "1")); await drain(); clock.tick(1000); await drain(); assert.equal(starts.length, 4);
  assert.ok(starts.slice(1).every((time, i) => time - starts[i] >= c.limits.minHostIntervalMs));
  assert.equal(s.snapshot().active, 2); s.close();
  const results = await Promise.all(pending);
  assert.equal(results[0].issue.code, "NETWORK_OR_POLICY_FAILURE"); assert.equal(results[1].ok, true);
  assert.equal(results.filter(r => r.issue && r.issue.code === "CANCELLED").length, 38);
  await drain(); assert.equal(s.snapshot().active, 0); assert.equal(s.snapshot().queued, 0);
});

test("aggregate bytes and request count remain bounded after failures and between calls", async t => {
  const clock = fakeClock(t);
  let calls = 0;
  const s = adapter.createSession(run(root, 10), { fetch: async () => { calls++; return response(root, "", { chunks: [new Uint8Array(c.limits.maxBytes).fill(65)] }); } });
  const pending = Array.from({ length: 6 }, () => s.request());
  await drain();
  for (let i = 0; i < 5; i++) { clock.tick(1000); await drain(); }
  const results = await Promise.all(pending);
  assert.ok(results.slice(0, 5).every(r => r.ok)); assert.equal(results[5].issue.code, "SIZE_LIMIT");
  assert.equal(calls, 5); assert.equal(s.snapshot().bytesRead, c.limits.maxTotalBytes);
  assert.equal((await s.request()).issue.code, "SIZE_LIMIT"); s.close();
  const limited = adapter.createSession(run(root, 1), { fetch: async () => { throw Error(); } });
  assert.equal((await limited.request()).ok, false); assert.equal((await limited.request()).issue.code, "PARTIAL_LIMIT"); limited.close();
});

test("session deadline bounds active and queued work as well as later requests", async t => {
  const clock = fakeClock(t);
  let calls = 0;
  const s = adapter.createSession(run(), { fetch: () => { calls++; return new Promise(() => {}); } });
  const pending = Array.from({ length: 40 }, () => s.request());
  clock.tick(c.limits.maxDurationMs); await drain();
  const r = await Promise.all(pending); assert.ok(r.every(x => x.issue.code === "TIMEOUT"));
  assert.equal((await s.request()).issue.code, "TIMEOUT"); assert.equal(calls, 1);
  assert.equal(s.snapshot().active, 0); assert.equal(s.snapshot().queued, 0); s.close();
});

test("hostile live HTML uses the same inert structural limits and final-source provenance as saved HTML", async () => {
  const text = "<base href='https://evil.test/'><title>&lt;script&gt;</title><script>globalThis.executed=true</script><img src='https://evil.test/image'><a href='ok'>ok</a><a href='javascript:alert(1)'>bad</a>";
  const r = await acquire(response(root, text)); const parsed = html.fromAcquisition(run(), r.acquisition);
  assert.equal(parsed.ok, true); assert.equal(parsed.acquisition.result.status, "partial");
  assert.equal(parsed.page.title, "<script>"); assert.equal(dom.window.executed, undefined);
  assert.deepEqual(parsed.claims.map(x => x.target), [root + "ok"]); assert.equal(parsed.claims[0].evidence[0].inputReference, root);
  const deep = await acquire(response(root, '<div>'.repeat(c.limits.maxNesting + 1)));
  assert.equal(html.fromAcquisition(run(), deep.acquisition).issue.code, "PARTIAL_LIMIT");
});
