(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SitemapMetrics = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var qualification = "Candidate orphan pages have sitemap membership and zero observed HTML inbound links in the included corpus; the selected root is excluded. Supplied CSV links are assertions, not observed HTML. Missing, blocked or bounded content may contain incoming links. No candidate is proof of a global orphan.";
  function freeze(value) {
    if (value && typeof value === "object") { Object.values(value).forEach(freeze); Object.freeze(value); }
    return value;
  }
  // Included validated graph only. Membership and redirects never become
  // adjacency; weak components intentionally ignore edge direction.
  function analyze(graph) {
    var pages = new Map(), neighbors = new Map(), inventory = new Set((graph.memberships || []).map(function (m) { return m.url; }));
    graph.nodes.slice().sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; }).forEach(function (n) {
      pages.set(n.id, { id: n.id, componentId: null, inDegree: 0, outDegree: 0, observedInDegree: 0, observedOutDegree: 0, depth: n.depth, sitemapMember: inventory.has(n.url), orphanCandidate: false });
      neighbors.set(n.id, new Set());
    });
    var pairs = new Set(), observedEdges = 0;
    graph.edges.forEach(function (edge) {
      if (!pages.has(edge.source) || !pages.has(edge.target)) return;
      var key = JSON.stringify([edge.source, edge.target]);
      if (pairs.has(key)) return; pairs.add(key);
      var source = pages.get(edge.source), target = pages.get(edge.target);
      source.outDegree++; target.inDegree++;
      if (edge.evidence.some(function (e) { return e.evidenceClass === "observed-html"; })) { source.observedOutDegree++; target.observedInDegree++; observedEdges++; }
      neighbors.get(edge.source).add(edge.target); neighbors.get(edge.target).add(edge.source);
    });
    var components = [], visited = new Set();
    pages.forEach(function (_, id) {
      if (visited.has(id)) return;
      var queue = [id], componentId = "component-" + (components.length + 1); visited.add(id);
      for (var i = 0; i < queue.length; i++) {
        pages.get(queue[i]).componentId = componentId;
        Array.from(neighbors.get(queue[i])).sort().forEach(function (neighbor) { if (!visited.has(neighbor)) { visited.add(neighbor); queue.push(neighbor); } });
      }
      components.push({ id: componentId, pageIds: queue.sort(), size: queue.length });
    });
    var candidates = [];
    pages.forEach(function (p) {
      p.orphanCandidate = p.sitemapMember && p.observedInDegree === 0 && p.id !== graph.rootUrl;
      if (p.orphanCandidate) candidates.push(p.id);
    });
    function distribution(field) {
      var counts = new Map();
      pages.forEach(function (p) { var value = p[field]; counts.set(value, (counts.get(value) || 0) + 1); });
      return Array.from(counts, function (pair) { return { value: pair[0], count: pair[1] }; }).sort(function (a, b) { return (a.value === null ? Infinity : a.value) - (b.value === null ? Infinity : b.value); });
    }
    return freeze({ pages: Array.from(pages.values()), pageCount: pages.size, edgeCount: pairs.size, observedEdgeCount: observedEdges,
      components: components, componentCount: components.length, candidates: candidates, candidateCount: candidates.length,
      depthDistribution: distribution("depth"), inDegreeDistribution: distribution("inDegree"), outDegreeDistribution: distribution("outDegree"), qualification: qualification });
  }
  function render(container, metrics, report) {
    var doc = container.ownerDocument;
    function el(tag, text, parent) { var e = doc.createElement(tag); e.textContent = text; (parent || container).appendChild(e); return e; }
    container.replaceChildren(); container.hidden = !metrics;
    if (!metrics) return;
    el("h2", "Included graph metrics"); el("p", report.coverage);
    el("p", metrics.pageCount + " pages | " + metrics.edgeCount + " rendered links (" + metrics.observedEdgeCount + " with observed HTML evidence) | " + metrics.componentCount + " weakly connected components | " + report.durationMs + " ms | " + report.counts.exclusions + " excluded records | " + report.counts.failedRequests + " failed requests.");
    el("p", "Components ignore link direction. Degrees count distinct included directed links, including supplied assertions. Unknown depth remains unknown; inventory and redirect aliases add no links.");
    [["Depth distribution", metrics.depthDistribution], ["Inbound degree distribution", metrics.inDegreeDistribution], ["Outbound degree distribution", metrics.outDegreeDistribution]].forEach(function (entry) {
      var table = el("table", ""); el("caption", entry[0], table);
      var head = el("thead", "", table), header = el("tr", "", head);
      ["Value", "Pages"].forEach(function (text) { el("th", text, header).scope = "col"; });
      var body = el("tbody", "", table);
      entry[1].forEach(function (bin) { var row = el("tr", "", body); el("th", bin.value === null ? "Unknown" : String(bin.value), row).scope = "row"; el("td", String(bin.count), row); });
    });
    el("h3", "Candidate orphan pages (" + metrics.candidateCount + ")"); el("p", metrics.qualification);
    if (metrics.candidates.length) { var list = el("ul", ""); metrics.candidates.forEach(function (id) { el("li", id, list); }); }
    else el("p", "No candidates in included records. Pages without sitemap membership are not assessed; this does not establish absence of orphan pages.");
  }
  function summary(metrics) {
    return { pages: metrics.pageCount, links: metrics.edgeCount, observedHtmlLinks: metrics.observedEdgeCount, weakComponents: metrics.componentCount, orphanCandidates: metrics.candidateCount,
      depthDistribution: metrics.depthDistribution, inDegreeDistribution: metrics.inDegreeDistribution, outDegreeDistribution: metrics.outDegreeDistribution, qualification: metrics.qualification };
  }
  return Object.freeze({ analyze: analyze, render: render, summary: summary });
});
