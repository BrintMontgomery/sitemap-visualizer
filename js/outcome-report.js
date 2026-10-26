(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapOutcomes = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";
  // Reports contain no bodies, request headers, credentials, queries or fragments.
  function redact(value) {
    return String(value == null ? "" : value).replace(/https?:\/\/[^\s<>"']+/gi, function (text) {
      try { var url = new URL(text); return url.origin + url.pathname + (url.search || url.hash ? " [redacted]" : ""); }
      catch (_) { return "[invalid URL]"; }
    });
  }
  var guidance = {
    NETWORK_OR_POLICY_FAILURE: "No readable response. Possible causes include CORS, network failure, browser permissions or site policy; the browser does not reveal which cause applies.",
    OPAQUE_RESPONSE: "An opaque response cannot establish page content or links. Browser CORS permission is required.",
    TIMEOUT: "The time budget expired. Retry with a permitted larger timeout or import local data.",
    CANCELLED: "Analysis was cancelled. Only included evidence is reported; unfinished discovery is discarded and unprocessed pages remain unknown.",
    HTTP_ERROR: "The server returned an HTTP error. Check the address and request log before retrying.",
    INPUT_MALFORMED: "Check the input format, declared source URL and selected root. Empty input establishes no coverage.",
    UNSUPPORTED_CONTENT: "The response content type is unsupported. Use HTML, sitemap XML or a links CSV import.",
    PARTIAL_LIMIT: "A configured limit excluded work. Increase permitted budgets or analyze a smaller scope.",
    SIZE_LIMIT: "A byte limit was reached. Use a smaller source or local data within the import limits.",
    ROBOTS_EXCLUDED: "The supplied result reports a robots restriction. Current live discovery ignores robots restrictions; browser access rules still apply.",
    ROBOTS_UNAVAILABLE: "Robots information was unavailable. Current live discovery ignores robots restrictions; this supplies no coverage evidence.",
    NOT_SUPPORTED: "This acquisition mode is unavailable. Choose a supported local import or live discovery."
  };
  function create(options) {
    var run = options.run || {}, result = options.result || {}, graph = options.graph, progress = result.progress || options.progress || {};
    var issues = (result.issues || []).concat(result.issue ? [result.issue] : [], graph ? graph.issues : [], options.issue ? [options.issue] : []);
    if (options.unsupported) issues.push({ code: "NOT_SUPPORTED", message: guidance.NOT_SUPPORTED });
    var codes = Array.from(new Set(issues.map(function (i) { return i.code; }).filter(Boolean)));
    var cancelled = options.state === "cancelled" || codes.includes("CANCELLED");
    var truncated = !!(result.truncated || (graph && graph.truncated) || codes.some(function (code) { return ["CANCELLED", "TIMEOUT", "SIZE_LIMIT", "PARTIAL_LIMIT"].includes(code); }));
    var hasData = !!(graph && graph.nodes.length);
    var partial = cancelled || truncated || !!(graph && graph.partial) || codes.length > 0;
    var outcome = options.unsupported ? "not-supported" : hasData ? partial ? "partial" : run.mode === "live-cors" ? "readable" : "user-supplied" : "not-readable";
    var state = cancelled ? "cancelled" : options.state === "failed" || !hasData ? "failed" : partial ? "partial" : "complete";
    var attempts = (result.attempts || []).map(function (a) { return { resourceUrl: redact(a.resourceUrl), observedFinalUrl: a.observedFinalUrl ? redact(a.observedFinalUrl) : null, httpStatus: a.httpStatus == null ? null : a.httpStatus, bytesRead: a.bytesRead, elapsedMs: a.elapsedMs, issues: (a.issues || []).slice() }; });
    var exclusions = {};
    (graph ? graph.exclusions : []).forEach(function (e) { exclusions[e.reason] = (exclusions[e.reason] || 0) + 1; });
    return {
      runId: options.id, state: state, outcome: outcome,
      input: redact(options.input).split(/[?#]/)[0], root: run.rootUrl ? redact(run.rootUrl) : null, mode: run.mode || options.mode,
      startedAt: run.startedAt || options.startedAt, durationMs: Math.max(0, options.durationMs || 0),
      limits: { pages: run.maxPages, depth: run.maxDepth, durationMs: run.maxDurationMs, concurrency: run.maxConcurrency, requestTimeoutMs: options.requestTimeoutMs, totalBytes: contracts.limits.maxTotalBytes, records: contracts.limits.maxRecords, responseBytes: contracts.limits.maxBytes },
      counts: { pages: graph ? graph.nodes.length : 0, links: graph ? graph.edges.length : 0, requests: attempts.length || progress.requested || 0, failedRequests: attempts.length ? attempts.filter(function (a) { return a.issues.length; }).length : progress.failed || 0, bytesRead: graph ? graph.bytesRead || 0 : progress.bytesRead || 0, exclusions: graph ? graph.exclusions.length : 0, queuedAtStop: progress.queued || 0 },
      exclusionsByReason: exclusions, truncated: truncated,
      coverage: "Coverage: " + outcome + ". " + (run.mode === "live-cors" ? "Bounded browser-readable discovery; robots restrictions ignored. Unread or unrequested content remains unknown." : "User-supplied records only; no independent live verification.") + " No result proves full-site coverage.",
      guidance: codes.map(function (code) { return code + ": " + (guidance[code] || "Inspect the input and request diagnostics; retry or import local data."); }).join(" ") + (!hasData ? " No pages established by this attempt." : ""),
      alternatives: "Choose Sitemap XML to import URL inventory (no hyperlinks or click depth); Links CSV to import asserted source/target links (not independently verified); or Saved HTML with a declared source URL to extract links in that file (not the whole site).",
      issues: issues.map(function (i) { return { code: i.code, message: redact(i.message), inputReference: redact(i.inputReference) }; }), attempts: attempts
    };
  }
  return Object.freeze({ create: create, redact: redact });
});
