(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"), require("./fetch-adapter.js"), require("./html-import.js"), require("./xml-import.js"));
  else root.SitemapDiscovery = factory(root.SitemapContracts, root.SitemapFetch, root.SitemapHtmlImport, root.SitemapXmlImport);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts, transport, html, xml) {
  "use strict";
  // One bounded fetch session owns network bytes, rate, concurrency and expiry.
  // Breadth-first waves keep request depth independent of response timing.
  async function discover(run, options) {
    options = options || {};
    if (!run || run.mode !== "live-cors" || !run.rootUrl) throw new TypeError("A live run with a root URL is required.");
    var session = transport.createSession(run, { fetch: options.fetch, requestTimeoutMs: options.requestTimeoutMs, maxRequests: Math.min(contracts.liveLimits.maxRequests, run.maxPages + contracts.liveLimits.maxSitemaps) });
    var signal = options.signal, started = Date.now(), batches = [], attempts = [], issues = [], issueKeys = new Set();
    var parsedUrls = new Set(), visited = new Set(), queuedPages = new Set(), queuedMaps = new Set(), pages = [], maps = [], inventory = [];
    var pageRequests = 0, mapRequests = 0, records = 0, edges = 0, successful = 0, truncated = false, halted = false, initialAttempt = null, frontierPending = 0;
    function issue(code, message, url) {
      var key = JSON.stringify([code, message, url || null]);
      if (issueKeys.has(key)) return;
      issueKeys.add(key); issues.push({ code: code, message: message, inputReference: url || run.rootUrl });
    }
    function limit(message) { truncated = true; issue("PARTIAL_LIMIT", message); }
    function progress() {
      var network = session.snapshot();
      var state = Object.freeze({ requested: attempts.length, queued: frontierPending + pages.length + maps.length + inventory.length + network.queued, active: network.active, pagesRequested: pageRequests, sitemapsRequested: mapRequests, observedEdges: edges, failed: attempts.filter(function (a) { return a.status !== "readable"; }).length, bytesRead: network.bytesRead, records: records, elapsedMs: Date.now() - started, robotsPolicy: "ignored" });
      if (typeof options.onProgress === "function") options.onProgress(state);
      return state;
    }
    function allowed(value) { var u = contracts.normalizeUrl(value); return u.ok && contracts.inScope(u.url, run.rootUrl) ? u.url : null; }
    function enqueuePage(value, depth, target) {
      var u = allowed(value);
      if (!u || visited.has(u) || queuedPages.has(u)) return;
      if (depth > run.maxDepth) { limit("Link depth limit reached; deeper pages were not requested."); return; }
      if (queuedPages.size >= contracts.limits.maxRecords) { limit("Discovery queue limit reached."); return; }
      queuedPages.add(u); target.push({ url: u, depth: depth, kind: "page" });
    }
    function enqueueMap(value, depth, optional) {
      var u = allowed(value);
      if (!u || visited.has(u)) return;
      if (queuedMaps.has(u)) {
        if (!optional) maps.forEach(function (job) { if (job.url === u) job.optional = false; });
        return;
      }
      if (depth > contracts.limits.maxNesting || queuedMaps.size >= contracts.liveLimits.maxSitemaps) { limit("Sitemap queue or nesting limit reached."); return; }
      queuedMaps.add(u); maps.push({ url: u, depth: depth, kind: "sitemap", optional: !!optional });
    }
    function process(job, response) {
      attempts.push(response.attempt);
      if (job.url === run.rootUrl) initialAttempt = response.attempt;
      if (!response.ok) {
        // A conventional /sitemap.xml 404 is absence, not a failed coverage claim.
        if (!(job.optional && response.attempt.httpStatus === 404)) issue(response.issue.code, response.issue.message, job.url);
        if (response.issue.code === "SIZE_LIMIT") truncated = true;
        if (["CANCELLED", "PARTIAL_LIMIT"].includes(response.issue.code) || (response.issue.code === "SIZE_LIMIT" && session.snapshot().bytesRead >= contracts.limits.maxTotalBytes) || (response.issue.code === "TIMEOUT" && Date.now() - started >= run.maxDurationMs)) { halted = true; truncated = true; }
        progress(); return;
      }
      var acquisition = response.acquisition, finalUrl = acquisition.result.observedFinalUrl;
      // Keep observable redirect metadata even if another request parsed this URL.
      if (parsedUrls.has(finalUrl)) { batches.push({ ok: true, acquisition: acquisition }); progress(); return; }
      visited.add(finalUrl); parsedUrls.add(finalUrl);
      var parsed = acquisition.result.contentKind === "html" ? html.fromAcquisition(run, acquisition) : xml.fromAcquisition(run, acquisition);
      if (!parsed.ok) { batches.push({ ok: true, acquisition: acquisition }); issue(parsed.issue.code, parsed.issue.message, job.url); if (parsed.issue.code === "PARTIAL_LIMIT") truncated = true; progress(); return; }
      successful++;
      var remaining = Math.max(0, contracts.limits.maxRecords - records), cost = (parsed.page ? 1 : 0) + (parsed.claims || []).length + (parsed.memberships || []).length + (parsed.references || []).length;
      if (cost > remaining) {
        limit("Discovery record limit reached; remaining records were excluded.");
        if (parsed.page && remaining) remaining--;
        else if (parsed.page) delete parsed.page;
        ["claims", "memberships", "references"].forEach(function (key) { if (parsed[key]) { parsed[key] = parsed[key].slice(0, remaining); remaining -= parsed[key].length; } });
        halted = true;
      }
      records += Math.min(cost, Math.max(0, contracts.limits.maxRecords - records));
      if (parsed.truncated) truncated = true;
      batches.push(parsed);
      if (parsed.claims) {
        edges += parsed.claims.length;
        parsed.claims.forEach(function (claim) { enqueuePage(claim.target, job.kind === "page" ? job.depth + 1 : 1, pages); });
        (parsed.sitemaps || []).forEach(function (u) { enqueueMap(u, 0, false); });
      } else {
        parsed.references.forEach(function (ref) { enqueueMap(ref.url, job.kind === "sitemap" ? job.depth + 1 : 0, false); });
        parsed.memberships.forEach(function (m) { enqueuePage(m.url, 0, inventory); });
      }
      progress();
    }
    // Fetch in parallel, then parse in request order. This keeps budget selection
    // and breadth-first queues stable regardless of response timing.
    async function wave(jobs) {
      frontierPending = jobs.length;
      for (var i = 0; i < jobs.length && !halted; i += run.maxConcurrency) {
        if (signal && signal.aborted) break;
        var chunk = jobs.slice(i, i + run.maxConcurrency).filter(function (job) {
          if (visited.has(job.url)) return false;
          if (job.kind === "page" && pageRequests >= run.maxPages) { limit("Page request limit reached; remaining targets were not requested."); return false; }
          if (job.kind === "sitemap" && mapRequests >= contracts.liveLimits.maxSitemaps) { limit("Sitemap request limit reached."); return false; }
          visited.add(job.url);
          if (job.kind === "page") pageRequests++; else mapRequests++;
          return true;
        });
        frontierPending = Math.max(0, jobs.length - i - run.maxConcurrency);
        var pending = chunk.map(function (job) { return session.request(job.url, { signal: signal }); });
        progress();
        var responses = await Promise.all(pending);
        chunk.forEach(function (job, index) { process(job, responses[index]); });
      }
    }
    try {
      enqueuePage(run.rootUrl, 0, pages);
      // Robots restrictions are deliberately ignored in this phase. No robots
      // file or Crawl-delay directive gates acquisition; browser access still does.
      enqueueMap(new URL("/sitemap.xml", run.rootUrl).href, 0, true);
      while ((pages.length || maps.length || inventory.length) && !halted && !(signal && signal.aborted)) {
        if (Date.now() - started >= run.maxDurationMs) { issue("TIMEOUT", "Run time limit reached."); truncated = true; break; }
        if (pages.length) { var frontier = pages; pages = []; await wave(frontier); }
        else if (maps.length) { var frontier = maps; maps = []; await wave(frontier); }
        else { pages = inventory; inventory = []; }
      }
      if (signal && signal.aborted) { issue("CANCELLED", "Discovery was cancelled."); truncated = true; }
      if (halted && (pages.length || maps.length || inventory.length)) truncated = true;
      var finalProgress = progress();
      if (!successful) return { ok: false, issue: issues[0] || { code: "INPUT_MALFORMED", message: "No readable HTML or sitemap was discovered." }, issues: issues, attempts: attempts, attempt: initialAttempt, progress: finalProgress };
      // Graph construction already handles parser issues. Add network/queue issues
      // to one validated batch so existing graph semantics remain authoritative.
      batches[0].issues = (batches[0].issues || []).concat(issues); batches[0].truncated = batches[0].truncated || truncated;
      return { ok: true, batches: batches, issues: issues, attempts: attempts, attempt: initialAttempt, progress: finalProgress, truncated: truncated };
    } finally { session.close(); }
  }
  return Object.freeze({ discover: discover });
});
