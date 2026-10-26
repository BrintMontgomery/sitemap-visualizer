(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SitemapExports = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var NS = "http://www.w3.org/2000/svg";
  var metadata = ["record_type", "run_id", "started_at", "mode", "outcome", "state", "partial", "truncated", "coverage", "limits_json", "exclusions_json"];
  var schemas = Object.freeze({
    pages: Object.freeze(metadata.concat(["page_id", "url", "title", "depth", "in_degree", "out_degree", "fetched", "http_status", "evidence_classes_json", "evidence_json", "memberships_json"])),
    links: Object.freeze(metadata.concat(["link_id", "source_id", "target_id", "source_depth", "target_depth", "evidence_classes_json", "evidence_json"]))
  });
  function cell(value) {
    var text = value == null ? "" : String(value);
    // Ignore leading whitespace/control characters when detecting spreadsheet formulas.
    if (/^[\s\u0000-\u001f\u007f]*[=+@-]/u.test(text) || /^[\t\r\n]/.test(text)) text = "'" + text;
    return '"' + text.replace(/"/g, '""') + '"';
  }
  function filename(kind, runId) {
    var id = String(runId).replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 64) || "run";
    return "sitemap-" + kind + "-" + id + (kind === "png" ? ".png" : ".csv");
  }
  function available(graph, report) { return !!(graph && graph.nodes.length && report && ["complete", "partial"].includes(report.state)); }
  function requireData(graph, report) { if (!available(graph, report)) throw Error("Complete an analysis with included pages before exporting."); }
  function common(graph, report) {
    return ["data", report.runId, report.startedAt, report.mode, report.outcome, report.state, !!(graph.partial || report.state === "partial" || report.truncated), !!report.truncated, report.coverage, JSON.stringify(report.limits), JSON.stringify(report.exclusionsByReason)];
  }
  function csv(kind, graph, report) {
    requireData(graph, report);
    if (!schemas[kind]) throw Error("Unknown export kind.");
    var base = common(graph, report), rows = [schemas[kind]], depths = new Map(graph.nodes.map(function (n) { return [n.id, n.depth]; }));
    graph[kind === "pages" ? "nodes" : "edges"].forEach(function (record) {
      var fields = kind === "pages" ? [record.id, record.url, record.title, record.depth, record.inDegree, record.outDegree, record.fetched, record.httpStatus, JSON.stringify(record.evidenceClasses), JSON.stringify(record.evidence), JSON.stringify(graph.memberships.filter(function (m) { return m.url === record.url; }))] : [record.id, record.source, record.target, depths.get(record.source), depths.get(record.target), JSON.stringify(Array.from(new Set(record.evidence.map(function (e) { return e.evidenceClass; }))).sort()), JSON.stringify(record.evidence)];
      rows.push(base.concat(fields));
    });
    if (rows.length === 1) { var empty = base.slice(); empty[0] = "metadata"; rows.push(empty.concat(schemas[kind].slice(base.length).map(function () { return ""; }))); }
    return "\ufeff" + rows.map(function (row) { return row.map(cell).join(","); }).join("\r\n") + "\r\n";
  }
  // Inline only graph presentation properties. No imported markup, CSS imports,
  // images or external resources enter the SVG rasterization boundary.
  function svgSnapshot(svg, graph, report) {
    requireData(graph, report);
    var doc = svg.ownerDocument, win = doc.defaultView, copy = svg.cloneNode(true);
    var originals = [svg].concat(Array.from(svg.querySelectorAll("*"))), copies = [copy].concat(Array.from(copy.querySelectorAll("*")));
    var properties = ["fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-linejoin", "font-family", "font-size", "font-weight", "paint-order", "opacity", "text-anchor"];
    originals.forEach(function (el, i) {
      var computed = win.getComputedStyle(el);
      copies[i].removeAttribute("style");
      properties.forEach(function (name) { var value = computed.getPropertyValue(name); if (value) copies[i].style.setProperty(name, value); });
      // Computed SVG url() may be expanded to the file:// document URL.
      if (el.hasAttribute("marker-end")) copies[i].setAttribute("marker-end", el.getAttribute("marker-end"));
    });
    var output = doc.createElementNS(NS, "svg");
    output.setAttribute("width", "1000");
    function element(tag, attrs, text) {
      var el = doc.createElementNS(NS, tag);
      Object.keys(attrs).forEach(function (key) { el.setAttribute(key, attrs[key]); });
      if (text != null) el.textContent = text;
      output.appendChild(el); return el;
    }
    var background = element("rect", { width: "100%", height: "100%", fill: "white" });
    copy.setAttribute("x", "0"); copy.setAttribute("y", "0"); copy.setAttribute("width", "1000"); copy.setAttribute("height", "700"); copy.setAttribute("viewBox", "0 0 1000 700");
    output.appendChild(copy);
    var y = 730;
    function line(text) { element("text", { x: "20", y: y, fill: "#1e293b", "font-family": "sans-serif", "font-size": "14" }, text); y += 20; }
    var legend = [["#f59e0b", "Root / 0"], ["#22c55e", "Depth 1"], ["#8b5cf6", "Depth 2"], ["#ef4444", "Depth 3+"], ["#cbd5e1", "Unknown depth"]];
    legend.forEach(function (entry, i) { element("circle", { cx: 28 + i * 190, cy: y - 5, r: "7", fill: entry[0], stroke: "#334155", "stroke-dasharray": i === 4 ? "3 2" : "none" }); element("text", { x: 42 + i * 190, y: y, fill: "#1e293b", "font-family": "sans-serif", "font-size": "14" }, entry[1]); });
    y += 30;
    var lines = ["Sitemap | Run " + report.runId + " | " + report.startedAt,
      report.mode + " | " + report.outcome + " | " + report.state + " | Partial: " + common(graph, report)[6] + " | Truncated: " + report.truncated,
      graph.nodes.length + " pages | " + graph.edges.length + " links | Exclusions: " + report.counts.exclusions + " | Current viewport (pan/zoom and pins retained).",
      "Limits: " + JSON.stringify(report.limits), report.coverage,
      "Edges: observed-html = extracted HTML; imported-link = supplied assertion. XML membership is inventory only; unknown depth is not zero."];
    lines.forEach(function (text) {
      var current = "";
      String(text).split(/\s+/u).forEach(function (word) {
        if (current && current.length + word.length + 1 > 65) { line(current); current = ""; }
        while (word.length > 65) { line(word.slice(0, 65)); word = word.slice(65); }
        current += (current ? " " : "") + word;
      });
      if (current) line(current);
    });
    output.setAttribute("height", String(y + 10)); output.setAttribute("viewBox", "0 0 1000 " + (y + 10));
    background.setAttribute("height", String(y + 10));
    return output;
  }
  function png(svg, graph, report) {
    var snapshot = svgSnapshot(svg, graph, report), win = svg.ownerDocument.defaultView;
    return new Promise(function (resolve, reject) {
      var url, timer, settled = false, image = new win.Image();
      function finish(error, blob) { if (settled) return; settled = true; win.clearTimeout(timer); image.onload = image.onerror = null; if (url) win.URL.revokeObjectURL(url); if (error) reject(error); else resolve(blob); }
      try {
        var text = new win.XMLSerializer().serializeToString(snapshot);
        url = win.URL.createObjectURL(new win.Blob([text], { type: "image/svg+xml;charset=utf-8" }));
        timer = win.setTimeout(function () { finish(Error("PNG rendering timed out. Retry or export CSV.")); }, 10000);
        image.onerror = function () { finish(Error("The browser could not render the PNG. Retry or export CSV.")); };
        image.onload = function () {
          try {
            var canvas = svg.ownerDocument.createElement("canvas"); canvas.width = 1000; canvas.height = Number(snapshot.getAttribute("height"));
            var context = canvas.getContext("2d"); if (!context) throw Error("Canvas is unavailable. Export CSV instead.");
            context.drawImage(image, 0, 0);
            canvas.toBlob(function (blob) { finish(blob ? null : Error("PNG encoding failed. Export CSV instead."), blob); }, "image/png");
          } catch (error) { finish(error); }
        };
        image.src = url;
      } catch (error) { finish(error); }
    });
  }
  function download(blob, name, doc) {
    var win = doc.defaultView, url = win.URL.createObjectURL(blob), anchor = doc.createElement("a");
    try { anchor.href = url; anchor.download = name; doc.body.appendChild(anchor); anchor.click(); }
    finally { anchor.remove(); win.setTimeout(function () { win.URL.revokeObjectURL(url); }, 1000); }
  }
  return Object.freeze({ schemas: schemas, cell: cell, filename: filename, available: available, csv: csv, svgSnapshot: svgSnapshot, png: png, download: download });
});
