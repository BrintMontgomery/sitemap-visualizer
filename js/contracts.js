(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.SitemapContracts = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var modes = Object.freeze({
    "live-cors": "Bounded HTML and sitemap discovery within the selected host.",
    "iframe-bridge": "No compatible bridge is configured.",
    "jsonp-provider": "No approved provider is configured.",
    "xml-import": "XML import is not implemented yet.",
    "csv-import": "CSV import is not implemented yet.",
    "html-import": "HTML import is not implemented yet.",
    "paste-import": "Bounded pasted HTML, sitemap XML or links CSV via local parsers."
  });
  var statuses = Object.freeze(["readable", "partial", "user-supplied", "not-readable", "not-supported"]);
  var evidenceClasses = Object.freeze(["observed-html", "imported-link", "sitemap-only", "bridge-reported", "jsonp-reported"]);
  var issueCodes = Object.freeze(["NETWORK_OR_POLICY_FAILURE", "TIMEOUT", "CANCELLED", "HTTP_ERROR", "OPAQUE_RESPONSE", "UNSUPPORTED_CONTENT", "SIZE_LIMIT", "ROBOTS_UNAVAILABLE", "ROBOTS_EXCLUDED", "BRIDGE_UNAVAILABLE", "BRIDGE_TIMEOUT", "BRIDGE_MESSAGE_REJECTED", "JSONP_DISABLED", "JSONP_SCRIPT_ERROR", "JSONP_TIMEOUT", "INPUT_MALFORMED", "PARTIAL_LIMIT", "URL_REJECTED", "SCOPE_EXCLUDED"]);
  var limits = Object.freeze({ maxBytes: 2000000, maxTotalBytes: 10000000, maxPages: 250, maxDepth: 4, maxDurationMs: 30000, requestTimeoutMs: 10000, maxConcurrency: 2, minHostIntervalMs: 1000, maxRedirects: 5, maxRecords: 10000, maxElements: 20000, maxNesting: 64 });
  var liveLimits = Object.freeze({ maxPages: 1000, maxDepth: 20, maxConcurrency: 8, maxDurationMs: 300000, maxSitemaps: 128, maxRequests: 1128 });
  var defaults = Object.freeze({ maxPages: 50, maxDepth: 2 });

  function rejected(message) { return { ok: false, issue: { code: "URL_REJECTED", message: message } }; }
  function normalizeUrl(input, base) {
    if (typeof input !== "string" || !input.trim()) return rejected("Enter a valid HTTP(S) URL.");
    try {
      var url = base === undefined ? new URL(input) : new URL(input, base);
      if (url.protocol !== "http:" && url.protocol !== "https:") return rejected("Only HTTP(S) URLs are supported.");
      if (url.username || url.password) return rejected("URLs containing credentials are not allowed.");
      // Some parsers percent-encode forbidden host characters instead of failing.
      if (!url.hostname || url.hostname.indexOf("%") !== -1) return rejected("Enter a valid HTTP(S) URL.");
      url.hash = "";
      return { ok: true, url: url.href };
    } catch (_) { return rejected("Enter a valid HTTP(S) URL."); }
  }
  function inScope(url, rootUrl) {
    var a = normalizeUrl(url), b = normalizeUrl(rootUrl);
    return a.ok && b.ok && new URL(a.url).hostname.replace(/\.$/, "") === new URL(b.url).hostname.replace(/\.$/, "");
  }
  function uniqueUrls(values, base) {
    var seen = new Set(), urls = [], issues = [];
    values.forEach(function (value) { var result = normalizeUrl(value, base); if (!result.ok) issues.push(result.issue); else if (!seen.has(result.url)) { seen.add(result.url); urls.push(result.url); } });
    return { urls: urls, issues: issues };
  }
  function createRun(options) {
    if (!options || !Object.hasOwn(modes, options.mode)) throw new TypeError("Unknown acquisition mode");
    var pages = options.maxPages === undefined ? defaults.maxPages : options.maxPages;
    var depth = options.maxDepth === undefined ? defaults.maxDepth : options.maxDepth;
    var ceiling = options.mode === "live-cors" ? liveLimits : limits;
    if (!Number.isInteger(pages) || pages < 1 || pages > ceiling.maxPages || !Number.isInteger(depth) || depth < 0 || depth > ceiling.maxDepth) throw new RangeError("Invalid run limits");
    var concurrency = options.maxConcurrency === undefined ? limits.maxConcurrency : options.maxConcurrency;
    var duration = options.maxDurationMs === undefined ? limits.maxDurationMs : options.maxDurationMs;
    if (!Number.isInteger(concurrency) || concurrency < 1 || concurrency > ceiling.maxConcurrency || !Number.isInteger(duration) || duration < 1 || duration > ceiling.maxDurationMs) throw new RangeError("Invalid crawl budgets");
    var rootUrl = null;
    if (options.rootUrl != null) { var result = normalizeUrl(options.rootUrl); if (!result.ok) throw new TypeError(result.issue.message); rootUrl = result.url; }
    return Object.freeze({ mode: options.mode, rootUrl: rootUrl, maxPages: pages, maxDepth: depth, maxConcurrency: concurrency, maxDurationMs: duration, startedAt: new Date().toISOString(), status: "queued", truncated: false });
  }
  var validated = new WeakMap();
  function createBudget(run) {
    if (!run || !Number.isInteger(run.maxPages)) throw new TypeError("Run required");
    var bytes = 0, pages = new Set(), used = new WeakSet();
    return Object.freeze({
      accept: function (result, pageUrls) {
        if (!result || validated.get(result) !== run || used.has(result) || !Array.isArray(pageUrls) || pageUrls.length > limits.maxRecords) return false;
        var next = new Set(pages);
        for (var i = 0; i < pageUrls.length; i++) { var url = normalizeUrl(pageUrls[i]); if (!url.ok) return false; next.add(url.url); }
        if (next.size > run.maxPages || bytes + result.result.bytesRead > limits.maxTotalBytes) return false;
        bytes += result.result.bytesRead; pages = next; used.add(result); return true;
      },
      snapshot: function () { return Object.freeze({ bytes: bytes, pages: pages.size }); }
    });
  }
  function validateResult(run, value) {
    function fail(code, message) { return { ok: false, issue: { code: code, message: message } }; }
    if (!run || !Object.hasOwn(modes, run.mode) || !value || typeof value !== "object" || value.transport !== run.mode || !statuses.includes(value.status)) return fail("INPUT_MALFORMED", "Invalid acquisition result.");
    if (value.status === "not-readable" || value.status === "not-supported") return fail(value.issueCode && issueCodes.includes(value.issueCode) ? value.issueCode : "NETWORK_OR_POLICY_FAILURE", "No readable content was supplied.");
    if (value.opaque === true || ["opaque", "opaqueredirect", "error"].includes(value.responseType)) return fail("OPAQUE_RESPONSE", "Opaque responses cannot provide content evidence.");
    var kinds = { "live-cors": ["html", "xml"], "html-import": ["html"], "xml-import": ["xml"], "csv-import": ["links"], "paste-import": ["html", "xml", "links"] };
    var expected = { html: "observed-html", xml: "sitemap-only", links: "imported-link" };
    if (!kinds[run.mode] || !kinds[run.mode].includes(value.contentKind) || value.evidenceClass !== expected[value.contentKind] || typeof value.payload !== "string" || (run.mode === "live-cors" ? !["readable", "partial"].includes(value.status) : !["user-supplied", "partial"].includes(value.status))) return fail("INPUT_MALFORMED", "Transport, status, content and evidence do not match.");
    var actualBytes = new TextEncoder().encode(value.payload).length;
    if (!Number.isSafeInteger(value.bytesRead) || value.bytesRead < actualBytes || value.bytesRead > limits.maxBytes || actualBytes > limits.maxBytes) return fail("SIZE_LIMIT", "Content exceeds the byte budget or has an invalid byte count.");
    if (!Array.isArray(value.issues) || value.issues.some(function (i) { return typeof i !== "string" || !issueCodes.includes(i); })) return fail("INPUT_MALFORMED", "Invalid issue codes.");
    if (typeof value.inputReference !== "string" || !value.inputReference || typeof value.startedAt !== "string" || !Number.isFinite(Date.parse(value.startedAt)) || !Number.isFinite(value.elapsedMs) || value.elapsedMs < 0 || value.elapsedMs > (run.maxDurationMs || limits.maxDurationMs)) return fail("INPUT_MALFORMED", "Invalid provenance or timing.");
    var requested = null, finalUrl = null;
    if (run.mode === "live-cors") {
      requested = normalizeUrl(value.resourceUrl); finalUrl = normalizeUrl(value.observedFinalUrl);
      if (!requested.ok || !finalUrl.ok || !run.rootUrl || !inScope(requested.url, run.rootUrl) || !inScope(finalUrl.url, run.rootUrl)) return fail("SCOPE_EXCLUDED", "Requested or observable final URL is invalid or outside the run scope.");
      if (!Number.isInteger(value.httpStatus) || value.httpStatus < 200 || value.httpStatus > 299) return fail("HTTP_ERROR", "A successful observable HTTP status is required.");
    } else if (value.resourceUrl != null || value.observedFinalUrl != null || value.httpStatus != null) return fail("INPUT_MALFORMED", "Imports cannot claim network response metadata.");
    var accepted = { ok: true, result: Object.freeze({ transport: run.mode, status: value.status, contentKind: value.contentKind, evidenceClass: value.evidenceClass, payload: value.payload, inputReference: value.inputReference, resourceUrl: requested ? requested.url : null, observedFinalUrl: finalUrl ? finalUrl.url : null, sourceOrigin: requested ? new URL(requested.url).origin : null, httpStatus: requested ? value.httpStatus : null, redirectHistory: null, startedAt: value.startedAt, elapsedMs: value.elapsedMs, bytesRead: value.bytesRead, issues: Object.freeze(value.issues.slice()) }) };
    Object.freeze(accepted); validated.set(accepted, run); return accepted;
  }
  function isValidatedResult(value) { return !!value && validated.has(value); }
  return Object.freeze({ modes: modes, statuses: statuses, evidenceClasses: evidenceClasses, issueCodes: issueCodes, limits: limits, liveLimits: liveLimits, defaults: defaults, normalizeUrl: normalizeUrl, inScope: inScope, uniqueUrls: uniqueUrls, createRun: createRun, createBudget: createBudget, validateResult: validateResult, isValidatedResult: isValidatedResult });
});
