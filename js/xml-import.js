(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapXmlImport = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";
  var ns = "http://www.sitemaps.org/schemas/sitemap/0.9";
  // Bound work before DOMParser constructs a tree. DTDs are prohibited, so neither
  // external entities nor custom entity expansion can occur.
  function preflight(text) {
    var i = 0, depth = 0, elements = 0;
    while (i < text.length) {
      var start = text.indexOf("<", i);
      if (start < 0) break;
      if (text.slice(start, start + 4) === "<!--") { i = text.indexOf("-->", start + 4); if (i < 0) return "INPUT_MALFORMED"; i += 3; continue; }
      if (text.slice(start, start + 9) === "<![CDATA[") { i = text.indexOf("]]>", start + 9); if (i < 0) return "INPUT_MALFORMED"; i += 3; continue; }
      if (text.slice(start, start + 2) === "<?") { i = text.indexOf("?>", start + 2); if (i < 0) return "INPUT_MALFORMED"; i += 2; continue; }
      if (text.slice(start, start + 2) === "<!") return "INPUT_MALFORMED";
      var quote = "", end = start + 1;
      for (; end < text.length; end++) { var ch = text[end]; if (quote) { if (ch === quote) quote = ""; } else if (ch === '"' || ch === "'") quote = ch; else if (ch === ">") break; }
      if (end === text.length) return "INPUT_MALFORMED";
      var tag = text.slice(start + 1, end);
      if (/^\//.test(tag)) { depth--; if (depth < 0) return "INPUT_MALFORMED"; }
      else { elements++; if (elements > contracts.limits.maxElements) return "PARTIAL_LIMIT"; depth++; if (depth > contracts.limits.maxNesting) return "PARTIAL_LIMIT"; if (/\/\s*$/.test(tag)) depth--; }
      i = end + 1;
    }
    return depth === 0 ? null : "INPUT_MALFORMED";
  }
  function children(node, name, namespace) {
    return Array.from(node.children).filter(function (child) { return child.localName === name && (child.namespaceURI || "") === namespace; });
  }
  function failure(code, message) { return { ok: false, issue: { code: code, message: message } }; }
  // Each selected file may be explicitly mapped to its absolute sitemap URL.
  // The first selected file is the entry point; only reachable mapped files are read.
  async function importFiles(selected, run) {
    if (!run || run.mode !== "xml-import") throw new TypeError("An XML import run is required.");
    if (!Array.isArray(selected) || !selected.length) throw new TypeError("Select at least one XML file.");
    var map = new Map(), inputs = [], total = 0, records = 0, started = Date.now();
    for (var s of selected) {
      if (!s || !s.file || typeof s.file.name !== "string" || !s.file.name || !Number.isSafeInteger(s.file.size) || s.file.size < 0 || typeof s.file.text !== "function") throw new TypeError("A selected file is required.");
      var source = null;
      if (s.sourceUrl != null) { var normalized = contracts.normalizeUrl(s.sourceUrl); if (!normalized.ok) return failure("URL_REJECTED", "Invalid sitemap mapping for " + s.file.name + "."); source = normalized.url; if (map.has(source)) return failure("INPUT_MALFORMED", "Duplicate sitemap URL mapping."); }
      var item = { file: s.file, sourceUrl: source }; inputs.push(item); if (source) map.set(source, item);
    }
    var queue = [inputs[0]], visited = new Set(), memberships = [], references = [], issues = [], acquisitions = [], truncated = false;
    function issue(code, input, message) { issues.push({ code: code, inputReference: input, message: message }); }
    while (queue.length) {
      var item = queue.shift(); if (visited.has(item)) continue; visited.add(item);
      if (Date.now() - started > contracts.limits.maxDurationMs) { truncated = true; issue("PARTIAL_LIMIT", item.file.name, "Import time limit reached."); break; }
      if (item.file.size > contracts.limits.maxBytes || total + item.file.size > contracts.limits.maxTotalBytes) { truncated = true; issue("SIZE_LIMIT", item.file.name, "File or total byte limit exceeded."); continue; }
      var text;
      var timer;
      try {
        text = await Promise.race([item.file.text(), new Promise(function (_, reject) {
          timer = setTimeout(function () { reject(new Error("timeout")); }, Math.max(0, contracts.limits.maxDurationMs - (Date.now() - started)));
        })]);
      } catch (err) {
        if (err && err.message === "timeout") { truncated = true; issue("PARTIAL_LIMIT", item.file.name, "Import time limit reached."); break; }
        issue("INPUT_MALFORMED", item.file.name, "Selected file could not be read."); continue;
      } finally { clearTimeout(timer); }
      if (typeof text !== "string") { issue("INPUT_MALFORMED", item.file.name, "Selected file did not contain text."); continue; }
      var bytes = Math.max(item.file.size, new TextEncoder().encode(text).length);
      if (bytes > contracts.limits.maxBytes || total + bytes > contracts.limits.maxTotalBytes) { truncated = true; issue("SIZE_LIMIT", item.file.name, "File or total byte limit exceeded."); continue; }
      total += bytes;
      var error = preflight(text);
      if (error) { if (error === "PARTIAL_LIMIT") truncated = true; issue(error, item.file.name, "XML is malformed, contains a prohibited declaration, or exceeds structural limits."); continue; }
      var doc = new DOMParser().parseFromString(text, "application/xml"), root = doc.documentElement;
      if (!root || doc.getElementsByTagName("parsererror").length || !["urlset", "sitemapindex"].includes(root.localName) || !["", ns].includes(root.namespaceURI || "")) { issue("INPUT_MALFORMED", item.file.name, "Expected a well-formed sitemap urlset or sitemapindex."); continue; }
      var namespace = root.namespaceURI || "", isIndex = root.localName === "sitemapindex", entries = children(root, isIndex ? "sitemap" : "url", namespace);
      var localIssues = [], localMemberships = [], localReferences = [];
      for (var entry of entries) {
        if (records >= contracts.limits.maxRecords) { truncated = true; localIssues.push({ code: "PARTIAL_LIMIT", inputReference: item.file.name, message: "Entry limit reached." }); break; }
        records++;
        var locs = children(entry, "loc", namespace), mods = children(entry, "lastmod", namespace);
        if (locs.length !== 1 || locs[0].children.length || mods.length > 1 || (mods[0] && mods[0].children.length)) { localIssues.push({ code: "INPUT_MALFORMED", inputReference: item.file.name, message: "Entry requires one text-only loc and at most one text-only lastmod." }); continue; }
        var url = contracts.normalizeUrl(locs[0].textContent.trim());
        if (!url.ok) { localIssues.push({ code: "URL_REJECTED", inputReference: item.file.name, message: "Entry contains an invalid public HTTP(S) URL." }); continue; }
        var lastmod = mods.length ? mods[0].textContent.trim() : null;
        if (isIndex) localReferences.push({ url: url.url, sourceSitemap: item.sourceUrl, inputReference: item.file.name, lastmod: lastmod, resolved: map.has(url.url) });
        else localMemberships.push({ url: url.url, sourceSitemap: item.sourceUrl, inputReference: item.file.name, lastmod: lastmod, evidenceClass: "sitemap-only", depth: null });
      }
      var validated = contracts.validateResult(run, { transport: "xml-import", status: localIssues.length ? "partial" : "user-supplied", contentKind: "xml", evidenceClass: "sitemap-only", payload: text, bytesRead: bytes, inputReference: item.file.name, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, issues: Array.from(new Set(localIssues.map(function (x) { return x.code; }))) });
      if (!validated.ok) { issues.push(Object.assign({ inputReference: item.file.name }, validated.issue)); continue; }
      acquisitions.push(validated); memberships.push.apply(memberships, localMemberships); issues.push.apply(issues, localIssues);
      for (var ref of localReferences) { references.push(ref); if (ref.resolved) queue.push(map.get(ref.url)); else issue("INPUT_MALFORMED", item.file.name, "Referenced sitemap is not among the selected URL mappings: " + ref.url); }
      if (truncated && records >= contracts.limits.maxRecords) break;
    }
    if (!acquisitions.length) return { ok: false, issue: issues[0] || { code: "INPUT_MALFORMED", message: "No valid sitemap supplied." }, issues: issues, truncated: truncated };
    return { ok: true, acquisitions: acquisitions, memberships: memberships, references: references, issues: issues, truncated: truncated, status: issues.length ? "partial" : "user-supplied" };
  }
  return Object.freeze({ importFiles: importFiles });
});
