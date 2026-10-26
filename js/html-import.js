(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapHtmlImport = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";
  function failure(code, message) { return { ok: false, issue: { code: code, message: message } }; }
  async function importFile(file, run, sourceUrl) {
    if (!run || run.mode !== "html-import") throw new TypeError("An HTML import run is required.");
    if (!file || typeof file.name !== "string" || !/\.html?$/i.test(file.name) ||
        !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.text !== "function") return failure("INPUT_MALFORMED", "Select an HTML or HTM file.");
    // A filename, embedded <base>, or the application's file:// URL is not a trusted source mapping.
    var source = contracts.normalizeUrl(sourceUrl);
    if (!source.ok) return failure("URL_REJECTED", "A public HTTP(S) source URL is required.");
    if (file.size > contracts.limits.maxBytes) return failure("SIZE_LIMIT", "File exceeds the byte limit.");
    var started = Date.now(), text;
    try { text = await file.text(); } catch (_) { return failure("INPUT_MALFORMED", "The selected file could not be read."); }
    if (typeof text !== "string") return failure("INPUT_MALFORMED", "The selected file did not contain text.");
    var bytes = Math.max(file.size, new TextEncoder().encode(text).length);
    if (bytes > contracts.limits.maxBytes) return failure("SIZE_LIMIT", "File exceeds the byte limit.");
    if (Date.now() - started > contracts.limits.maxDurationMs) return failure("TIMEOUT", "HTML import exceeded the time limit.");
    var fragment;
    try {
      // Template contents have a separate inert owner document. Unlike a detached
      // DOMParser HTML document, they cannot load image/frame resources. Never
      // append, clone, or adopt these nodes into a browsing document.
      var template = document.createElement("template");
      if (!template.content) return failure("UNSUPPORTED_CONTENT", "Inert HTML templates are unavailable.");
      template.innerHTML = text;
      fragment = template.content;
    } catch (_) { return failure("UNSUPPORTED_CONTENT", "Inert HTML parsing is unavailable."); }
    var elements = fragment.querySelectorAll("*");
    if (elements.length > contracts.limits.maxElements) return failure("PARTIAL_LIMIT", "HTML element limit exceeded; no records imported.");
    // Iterative traversal also bounds deeply nested content; template children
    // remain excluded because they are not document hyperlinks.
    var stack = [{ node: fragment, depth: 0 }];
    while (stack.length) {
      var entry = stack.pop();
      if (entry.depth > contracts.limits.maxNesting) return failure("PARTIAL_LIMIT", "HTML nesting limit exceeded; no records imported.");
      for (var child = entry.node.firstElementChild; child; child = child.nextElementSibling) stack.push({ node: child, depth: entry.depth + 1 });
    }
    var issues = [], claims = [], seen = new Map(), anchors = fragment.querySelectorAll("a[href]"), truncated = anchors.length > contracts.limits.maxRecords;
    if (fragment.querySelector("base[href]")) issues.push({ code: "INPUT_MALFORMED", message: "Embedded base URL ignored; supply the intended resolution base explicitly." });
    for (var i = 0; i < Math.min(anchors.length, contracts.limits.maxRecords); i++) {
      var href = anchors[i].getAttribute("href");
      var target = contracts.normalizeUrl(href, source.url);
      if (!target.ok) { issues.push({ code: "URL_REJECTED", anchor: i + 1, message: "Anchor must resolve to a public HTTP(S) URL." }); continue; }
      var evidence = { transport: "html-import", inputReference: file.name, sourceUrl: source.url, anchor: i + 1, evidenceClass: "observed-html" };
      if (seen.has(target.url)) seen.get(target.url).evidence.push(evidence);
      else {
        var claim = { source: source.url, target: target.url, evidenceClass: "observed-html", evidence: [evidence] };
        seen.set(target.url, claim); claims.push(claim);
      }
    }
    if (truncated) issues.push({ code: "PARTIAL_LIMIT", message: "Anchor limit reached; remaining anchors were not imported." });
    var titleElement = fragment.querySelector("title"), title = titleElement ? titleElement.textContent.trim() : "";
    var acquisition = contracts.validateResult(run, { transport: "html-import", status: issues.length ? "partial" : "user-supplied", contentKind: "html", evidenceClass: "observed-html", payload: text, bytesRead: bytes, inputReference: file.name, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, issues: Array.from(new Set(issues.map(function (issue) { return issue.code; }))) });
    if (!acquisition.ok) return acquisition;
    return { ok: true, acquisition: acquisition, page: { url: source.url, title: title, evidenceClass: "observed-html", inputReference: file.name }, claims: claims, issues: issues, truncated: truncated };
  }
  return Object.freeze({ importFile: importFile });
});
