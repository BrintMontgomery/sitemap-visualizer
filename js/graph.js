(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapGraph = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";
  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  // Adapter records are internal parser output, never raw user JSON. Acquisitions
  // must have passed the shared boundary; all record URLs/provenance are checked again.
  function buildGraph(run, imports) {
    if (!run || !Array.isArray(imports)) throw new TypeError("Run and adapter results required.");
    var options = contracts.createRun({ mode: run.mode, rootUrl: run.rootUrl, maxPages: run.maxPages, maxDepth: run.maxDepth });
    var rootUrl = options.rootUrl, nodes = new Map(), edges = new Map(), memberships = new Map(), aliases = new Map(), evidenceKeys = new WeakMap();
    var acquisitions = [], acquisitionIds = new Map(), issues = [], exclusions = [], totalBytes = 0, records = 0, truncated = false;
    function issue(code, message) { issues.push({ code: code, message: message }); }
    function exclude(kind, id, reason) { exclusions.push({ kind: kind, id: id, reason: reason }); }
    function url(value) { var result = contracts.normalizeUrl(value); return result.ok ? result.url : null; }
    function page(value) {
      if (!nodes.has(value)) nodes.set(value, { id: value, url: value, title: null, httpStatus: null, fetched: false, depth: null, inDegree: 0, outDegree: 0, evidence: [], evidenceClasses: [] });
      return nodes.get(value);
    }
    function addEvidence(target, evidence) {
      var key = JSON.stringify(evidence);
      if (!evidenceKeys.has(target)) evidenceKeys.set(target, new Set());
      var keys = evidenceKeys.get(target);
      if (!keys.has(key)) { keys.add(key); target.evidence.push(evidence); }
      if (target.evidenceClasses && !target.evidenceClasses.includes(evidence.evidenceClass)) target.evidenceClasses.push(evidence.evidenceClass);
    }
    function nextRecord() {
      records++;
      if (records <= contracts.limits.maxRecords) return true;
      if (!truncated) issue("PARTIAL_LIMIT", "Graph record limit reached.");
      truncated = true; return false;
    }
    imports.forEach(function (batch) {
      if (!batch || batch.ok !== true) { issue("INPUT_MALFORMED", "Adapter did not supply a successful result."); return; }
      var supplied = batch.acquisitions || (batch.acquisition ? [batch.acquisition] : []), local = [];
      if (!Array.isArray(supplied) || !supplied.length || supplied.some(function (a) { return !contracts.isValidatedResult(a); })) {
        issue("INPUT_MALFORMED", "Graph requires validated acquisition references."); return;
      }
      supplied.forEach(function (a) {
        if (!acquisitionIds.has(a)) {
          if (totalBytes + a.result.bytesRead > contracts.limits.maxTotalBytes) { truncated = true; issue("SIZE_LIMIT", "Graph acquisition byte limit reached."); return; }
          totalBytes += a.result.bytesRead;
          var id = "acquisition-" + (acquisitions.length + 1); acquisitionIds.set(a, id);
          var r = a.result;
          acquisitions.push({ id: id, transport: r.transport, inputReference: r.inputReference, evidenceClass: r.evidenceClass, status: r.status, startedAt: r.startedAt, bytesRead: r.bytesRead, sourceOrigin: r.sourceOrigin, observedFinalUrl: r.observedFinalUrl, httpStatus: r.httpStatus, redirectHistory: null, issues: r.issues.slice() });
          if (r.status === "partial") issue("PARTIAL_LIMIT", "Acquisition reports partial coverage: " + r.inputReference);
          if (r.resourceUrl && r.observedFinalUrl && r.resourceUrl !== r.observedFinalUrl) {
            var key = JSON.stringify([r.resourceUrl, r.observedFinalUrl]);
            if (!aliases.has(key)) aliases.set(key, { source: r.resourceUrl, target: r.observedFinalUrl, evidenceIds: [] });
            aliases.get(key).evidenceIds.push(id);
          }
        }
        if (acquisitionIds.has(a)) local.push(a);
      });
      if (batch.truncated) truncated = true;
      if (Array.isArray(batch.issues)) batch.issues.forEach(function (i) { issue(typeof i.code === "string" ? i.code : "INPUT_MALFORMED", typeof i.message === "string" ? i.message : "Adapter issue."); });
      function evidence(value, expected) {
        if (!value || value.evidenceClass !== expected) return null;
        var a = local.find(function (candidate) { var r = candidate.result; return r.inputReference === value.inputReference && r.evidenceClass === expected && (!value.transport || r.transport === value.transport); });
        if (!a) return null;
        var result = { acquisitionId: acquisitionIds.get(a), transport: a.result.transport, inputReference: a.result.inputReference, evidenceClass: expected, coverageStatus: a.result.status };
        ["row", "anchor"].forEach(function (k) { if (Number.isSafeInteger(value[k]) && value[k] > 0) result[k] = value[k]; });
        if (value.sourceUrl && url(value.sourceUrl)) result.sourceUrl = url(value.sourceUrl);
        return result;
      }
      if (batch.page && nextRecord()) {
        var p = batch.page, u = url(p.url), e = evidence(p, "observed-html");
        if (u && e) { var n = page(u); if (typeof p.title === "string" && (n.title === null || compare(p.title, n.title) < 0)) n.title = p.title; addEvidence(n, e); }
        else issue("INPUT_MALFORMED", "Invalid page record or provenance.");
      }
      if (Array.isArray(batch.claims)) for (var claim of batch.claims) {
        if (!nextRecord()) break;
        var source = claim && url(claim.source), target = claim && url(claim.target);
        var allowed = claim && ["observed-html", "imported-link"].includes(claim.evidenceClass);
        var refs = allowed && Array.isArray(claim.evidence) ? claim.evidence.map(function (e) { return evidence(e, claim.evidenceClass); }) : [];
        if (!source || !target || !refs.length || refs.some(function (e) { return !e; })) { issue("INPUT_MALFORMED", "Invalid link claim or provenance."); continue; }
        if (rootUrl && (!contracts.inScope(source, rootUrl) || !contracts.inScope(target, rootUrl))) { exclude("edge", JSON.stringify([source, target]), "SCOPE_EXCLUDED"); continue; }
        var key = JSON.stringify([source, target]);
        if (!edges.has(key)) edges.set(key, { id: key, source: source, target: target, evidence: [] });
        refs.forEach(function (e) { addEvidence(edges.get(key), e); addEvidence(page(source), e); addEvidence(page(target), e); });
      }
      if (Array.isArray(batch.memberships)) for (var m of batch.memberships) {
        if (!nextRecord()) break;
        var u = m && url(m.url), e = evidence(m, "sitemap-only");
        if (!u || !e || (m.sourceSitemap != null && !url(m.sourceSitemap))) { issue("INPUT_MALFORMED", "Invalid sitemap membership or provenance."); continue; }
        var sourceSitemap = m.sourceSitemap == null ? null : url(m.sourceSitemap);
        var key = JSON.stringify([u, sourceSitemap, m.inputReference, typeof m.lastmod === "string" ? m.lastmod : null]);
        if (!memberships.has(key)) memberships.set(key, { url: u, sourceSitemap: sourceSitemap, lastmod: typeof m.lastmod === "string" ? m.lastmod : null, evidence: [] });
        addEvidence(memberships.get(key), e); addEvidence(page(u), e);
      }
    });
    // BFS on explicit links only. Sorting neighbors makes cap selection stable
    // even when CSV rows or adapter batches arrive in a different order.
    var adjacency = new Map();
    edges.forEach(function (e) { if (!adjacency.has(e.source)) adjacency.set(e.source, []); adjacency.get(e.source).push(e.target); });
    adjacency.forEach(function (neighbors) { neighbors.sort(compare); });
    var queue = [];
    if (rootUrl && nodes.has(rootUrl)) { nodes.get(rootUrl).depth = 0; queue.push(rootUrl); }
    else issue("INPUT_MALFORMED", rootUrl ? "Selected root is absent from the supplied records; depths remain unknown." : "Select a root to calculate directed link depth.");
    for (var i = 0; i < queue.length; i++) {
      var source = queue[i];
      (adjacency.get(source) || []).forEach(function (target) { var n = nodes.get(target); if (n.depth === null) { n.depth = nodes.get(source).depth + 1; queue.push(target); } });
    }
    var ordered = Array.from(nodes.values()).sort(function (a, b) { return (a.depth === null ? Infinity : a.depth) - (b.depth === null ? Infinity : b.depth) || compare(a.url, b.url); });
    var included = new Map();
    ordered.forEach(function (n) {
      var reason = rootUrl && !contracts.inScope(n.url, rootUrl) ? "SCOPE_EXCLUDED" : n.depth !== null && n.depth > options.maxDepth ? "DEPTH_LIMIT" : included.size >= options.maxPages ? "PAGE_LIMIT" : null;
      if (reason) { exclude("node", n.url, reason); if (reason !== "SCOPE_EXCLUDED") truncated = true; }
      else { n.unreachableInObservedGraph = n.depth === null; n.evidenceClasses.sort(compare); included.set(n.url, n); }
    });
    var finalEdges = [];
    Array.from(edges.values()).sort(function (a, b) { return compare(a.id, b.id); }).forEach(function (e) {
      if (!included.has(e.source) || !included.has(e.target)) exclude("edge", e.id, "ENDPOINT_EXCLUDED");
      else { finalEdges.push(e); included.get(e.source).outDegree++; included.get(e.target).inDegree++; }
    });
    if (truncated) issue("PARTIAL_LIMIT", "Graph or source limits exclude records; coverage is partial.");
    var finalMemberships = Array.from(memberships.values()).filter(function (m) { return included.has(m.url); }).sort(function (a, b) { return compare(JSON.stringify(a), JSON.stringify(b)); });
    return freeze({ rootUrl: rootUrl, effectiveRoot: rootUrl && included.has(rootUrl) ? rootUrl : null, maxPages: options.maxPages, maxDepth: options.maxDepth, nodes: Array.from(included.values()), edges: finalEdges, memberships: finalMemberships, redirectAliases: Array.from(aliases.values()), acquisitions: acquisitions, issues: issues, exclusions: exclusions, truncated: truncated, partial: truncated || issues.length > 0 || exclusions.length > 0, bytesRead: totalBytes });
  }
  return Object.freeze({ buildGraph: buildGraph });
});
