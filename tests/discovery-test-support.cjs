const assert = require('node:assert/strict');
const c = require('../js/contracts');
const discover = require('../js/discovery').discover;
const root = 'http://intranet/';
const drain = () => new Promise(setImmediate);
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
  return { timers, tick(ms = 1000) {
    now += ms;
    while (true) {
      const next = [...timers.entries()].filter(([, timer]) => timer.at <= now).sort((a, b) => a[1].at - b[1].at)[0];
      if (!next) return;
      timers.delete(next[0]); next[1].fn();
    }
  } };
}
function response(url, text, type = 'text/html', status = 200) {
  let done = false;
  return { type: 'cors', url, status, headers: new Headers({ 'Content-Type': type }), body: { getReader: () => ({
    read: async () => done ? { done: true } : (done = true, { done: false, value: new TextEncoder().encode(text) }), cancel() {}, releaseLock() {}
  }) } };
}
const urlset = urls => '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">' + urls.map(u => '<url><loc>' + u + '</loc></url>').join('') + '</urlset>';
const index = urls => '<sitemapindex>' + urls.map(u => '<sitemap><loc>' + u + '</loc></sitemap>').join('') + '</sitemapindex>';
async function crawl(t, fixtures, settings = {}, options = {}) {
  const clock = fakeClock(t), calls = [], snapshots = [];
  const run = c.createRun({ mode: 'live-cors', rootUrl: root, ...settings });
  const fetch = async (url, settings) => {
    calls.push({ url, at: Date.now(), settings });
    const value = fixtures[url] || ['', 'text/html', 404];
    if (typeof value === 'function') return value(url, settings);
    if (value instanceof Error) throw value;
    return response(url, ...value);
  };
  const pending = discover(run, { fetch, ...options, onProgress: p => { snapshots.push(p); if (options.onProgress) options.onProgress(p); } });
  let result, error, finished = false;
  pending.then(r => { result = r; finished = true; }, e => { error = e; finished = true; });
  for (let i = 0; i < 2000 && !finished; i++) { await drain(); if (!finished) clock.tick(); }
  assert.equal(finished, true, 'discovery must terminate');
  if (error) throw error;
  await drain(); assert.equal(clock.timers.size, 0, 'session timers must be cleaned up');
  return { result, run, calls: calls.map(c => c.url), starts: calls, snapshots };
}
module.exports = { root, drain, fakeClock, response, urlset, index, crawl };
