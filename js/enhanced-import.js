(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts"), require("./csv-import"), require("./xml-import"), require("./html-import"));
  else root.SitemapEnhancedImport = factory(root.SitemapContracts, root.SitemapCsvImport, root.SitemapXmlImport, root.SitemapHtmlImport);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts, csv, xml, html) {
  "use strict";
  var maxFiles = 128;
  function failure(code, message, input) { return { ok: false, issue: { code: code, message: message, inputReference: input } }; }
  function cancelled(signal) { return signal && signal.aborted; }
  async function importSelected(selected, run, options) {
    options = options || {};
    if (!Array.isArray(selected) || !selected.length) return failure("INPUT_MALFORMED", "Select at least one file.");
    if (selected.length > maxFiles) return failure("PARTIAL_LIMIT", "Select at most 128 files.");
    if (!["csv-import", "xml-import", "html-import"].includes(run.mode)) return failure("INPUT_MALFORMED", "Choose an explicit content kind.");
    var declared = 0, defaultKind = run.mode.split("-")[0];
    for (var item of selected) {
      var f = item && item.file;
      if (!f || typeof f.name !== "string" || !f.name || typeof f.text !== "function" || !Number.isSafeInteger(f.size) || f.size < 0) return failure("INPUT_MALFORMED", "A selected text file is required.");
      declared += f.size;
      if (f.size > contracts.limits.maxBytes || declared > contracts.limits.maxTotalBytes) return failure("SIZE_LIMIT", "Selected files exceed the per-file or total byte limit.", f.name);
      if (!["html", "xml", "csv"].includes(item.kind || defaultKind)) return failure("INPUT_MALFORMED", "Choose a content kind for each selected file.", f.name);
      if ((item.kind || defaultKind) === "html" && !contracts.normalizeUrl(item.sourceUrl).ok) return failure("URL_REJECTED", "Map every selected HTML file to an HTTP(S) source URL.", f.name);
    }
    var started = Date.now(), total = 0, records = 0, batches = [], issues = [], truncated = false, sizeExceeded = false, stopped = false;
    // Wrap only user-selected objects. Never resolve a filename or read a path.
    var wrapped = selected.map(function (item) {
      return { sourceUrl: item.sourceUrl, kind: item.kind || defaultKind, file: { name: item.file.name, size: item.file.size, text: async function () {
        if (cancelled(options.signal) || stopped || sizeExceeded || Date.now() - started >= run.maxDurationMs) throw Error("Import stopped");
        var text = await item.file.text();
        if (cancelled(options.signal) || stopped || Date.now() - started >= run.maxDurationMs) throw Error("Import stopped");
        if (typeof text !== "string") throw Error("Expected text");
        var bytes = Math.max(item.file.size, new TextEncoder().encode(text).length);
        total += bytes;
        if (bytes > contracts.limits.maxBytes || total > contracts.limits.maxTotalBytes) { sizeExceeded = true; throw Error("SIZE_LIMIT"); }
        return text;
      } } };
    });
    async function bounded(pending) {
      var timer;
      try { return await Promise.race([pending, new Promise(function (_, reject) { timer = setTimeout(function () { stopped = true; reject(Error("TIMEOUT")); }, Math.max(0, run.maxDurationMs - (Date.now() - started))); })]); }
      finally { clearTimeout(timer); }
    }
    try {
      if (cancelled(options.signal)) return failure("CANCELLED", "Import cancelled.");
      var xmlDone = false;
      for (var entry of wrapped) {
        if (entry.kind === "xml" && xmlDone) continue;
        if (cancelled(options.signal)) return failure("CANCELLED", "Import cancelled.");
        if (Date.now() - started >= run.maxDurationMs) { truncated = true; issues.push({ code: "TIMEOUT", message: "Import time limit reached.", inputReference: entry.file.name }); break; }
        var adapterRun = contracts.createRun(Object.assign({}, run, { mode: entry.kind + "-import" }));
        var batch;
        if (entry.kind === "xml") { xmlDone = true; batch = await bounded(xml.importFiles(wrapped.filter(function (s) { return s.kind === "xml"; }), adapterRun)); }
        else batch = await bounded(entry.kind === "html" ? html.importFile(entry.file, adapterRun, entry.sourceUrl) : csv.importFile(entry.file, adapterRun));
        if (cancelled(options.signal)) return failure("CANCELLED", "Import cancelled.");
        if (sizeExceeded || total > contracts.limits.maxTotalBytes) { truncated = true; issues.push({ code: "SIZE_LIMIT", message: "Actual content exceeds total byte limit.", inputReference: entry.file.name }); break; }
        if (!batch.ok) { issues.push(Object.assign({ inputReference: entry.file.name }, batch.issue)); continue; }
        var count = (batch.memberships || []).length + (batch.references || []).length + (batch.page ? 1 : 0) + (batch.claims || []).reduce(function (n, c) { return n + c.evidence.length; }, 0);
        if (records + count > contracts.limits.maxRecords) { truncated = true; issues.push({ code: "PARTIAL_LIMIT", message: "Combined record limit reached; this and remaining files were excluded.", inputReference: entry.file.name }); break; }
        records += count; batches.push(batch); truncated = truncated || batch.truncated;
        issues.push.apply(issues, (batch.issues || []).map(function (issue) { return Object.assign({ inputReference: entry.file.name }, issue); }));
      }
    } catch (error) { stopped = true; truncated = true; issues.push({ code: error.message === "TIMEOUT" ? "TIMEOUT" : "INPUT_MALFORMED", message: "Import stopped; unfinished input excluded.", inputReference: entry && entry.file.name }); }
    return { ok: batches.length > 0, batches: batches, issues: issues, truncated: truncated, issue: batches.length ? undefined : issues[0] || { code: "INPUT_MALFORMED", message: "No valid input supplied." } };
  }
  async function importPaste(text, kind, sourceUrl, run, options) {
    var mode = { html: "html-import", xml: "xml-import", csv: "csv-import" }[kind];
    if (!mode || typeof text !== "string" || !text.trim()) return failure("INPUT_MALFORMED", "Paste nonempty content and choose HTML, XML or CSV.", "Pasted input");
    // Check length before allocating the UTF-8 representation.
    if (text.length > contracts.limits.maxBytes) return failure("SIZE_LIMIT", "Pasted input exceeds the byte limit.", "Pasted input");
    var size = new TextEncoder().encode(text).length;
    if (size > contracts.limits.maxBytes) return failure("SIZE_LIMIT", "Pasted input exceeds the byte limit.", "Pasted input");
    var adapterRun = contracts.createRun(Object.assign({}, run, { mode: mode }));
    return importSelected([{ file: { name: "Pasted input." + kind, size: size, text: async function () { return text; } }, sourceUrl: sourceUrl || null }], adapterRun, options);
  }
  // Nearest strict path ancestor among included pages, same origin, no query on
  // the parent. No synthetic pages, hyperlinks, or click depths are generated.
  function hierarchy(graph) {
    var pages = graph.nodes.map(function (n) { return { id: n.id, url: new URL(n.url) }; });
    return pages.map(function (child) {
      var parents = pages.filter(function (parent) {
        var prefix = parent.url.pathname.replace(/\/$/, "") + "/";
        return parent.id !== child.id && !parent.url.search && parent.url.origin === child.url.origin && parent.url.pathname.replace(/\/$/, "") !== child.url.pathname.replace(/\/$/, "") && child.url.pathname.startsWith(prefix);
      }).sort(function (a, b) { return b.url.pathname.length - a.url.pathname.length || a.id.localeCompare(b.id); });
      return parents.length ? Object.freeze({ parent: parents[0].id, child: child.id, relation: "inferred-url-hierarchy" }) : null;
    }).filter(Boolean).sort(function (a, b) { return a.child < b.child ? -1 : a.child > b.child ? 1 : 0; });
  }
  function renderHierarchy(container, graph) {
    container.replaceChildren(); container.hidden = !graph;
    if (!graph) return;
    var doc = container.ownerDocument, title = doc.createElement("h2"), note = doc.createElement("p"), list = doc.createElement("ul"), relations = hierarchy(graph);
    title.textContent = "Inferred URL hierarchy preview";
    note.textContent = "Path inference among included pages only. These are not observed hyperlinks. This preview does not affect link depth, degrees, metrics or exports. " + relations.length + " inferred relations.";
    relations.forEach(function (r) { var li = doc.createElement("li"); li.textContent = r.parent + " → " + r.child; list.appendChild(li); });
    container.append(title, note, list);
  }
  return Object.freeze({ maxFiles: maxFiles, importSelected: importSelected, importPaste: importPaste, hierarchy: hierarchy, renderHierarchy: renderHierarchy });
});
