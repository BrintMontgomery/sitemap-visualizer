(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SitemapDetails = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  // The graph is an immutable validated snapshot. This view never adds evidence.
  function create(container, graph, renderer) {
    var doc = container.ownerDocument, selected = null, disposed = false, listeners = [];
    var nodes = new Map(graph.nodes.map(function (n) { return [n.id, n]; })), buttons = new Map();
    var body = container.querySelector("tbody"), panel = container.querySelector(".page-detail-content"), status = container.querySelector(".selection-status");
    function el(tag, text, parent) { var e = doc.createElement(tag); if (text != null) e.textContent = text; if (parent) parent.appendChild(e); return e; }
    function listen(target, event, fn) { target.addEventListener(event, fn); listeners.push(function () { target.removeEventListener(event, fn); }); }
    function depth(n) { return n.depth === null ? "Unknown" : String(n.depth); }
    function sources(parent, evidence) {
      if (!evidence || !evidence.length) { el("p", "No evidence recorded.", parent); return; }
      var list = el("ul", null, parent);
      evidence.forEach(function (e) {
        el("li", e.evidenceClass + " | " + e.transport + " | " + e.inputReference +
          (e.sourceUrl ? " | Source URL: " + e.sourceUrl : "") +
          (e.row ? " | Row " + e.row : "") + (e.anchor ? " | Anchor " + e.anchor : "") +
          " | Coverage: " + e.coverageStatus, list);
      });
    }
    function renderDetails(node) {
      panel.replaceChildren();
      if (!node) { el("p", "Select a page in the table or graph to inspect its evidence.", panel); return; }
      var fields = el("dl", null, panel);
      var entries = [["URL", node.url], ["Title", node.title || "Unavailable"], ["Depth", depth(node)],
        ["HTTP status", node.httpStatus === null ? "Unknown (not recorded)" : String(node.httpStatus)],
        ["Fetched by this application", node.fetched ? "Yes" : "No"], ["Inbound links in included graph", String(node.inDegree)], ["Outbound links in included graph", String(node.outDegree)]];
      entries.forEach(function (entry) { el("dt", entry[0], fields); el("dd", entry[1], fields); });
      // Defense in depth: an invalid URL must never become an actionable href.
      try {
        var url = new URL(node.url);
        if ((url.protocol === "https:" || url.protocol === "http:") && !url.username && !url.password) {
          var external = el("a", "Open selected page in a new tab", panel);
          external.href = url.href; external.target = "_blank"; external.rel = "noopener noreferrer"; external.referrerPolicy = "no-referrer";
        }
      } catch (_) { /* No navigation for an invalid URL. */ }
      el("h3", "Evidence sources", panel); sources(panel, node.evidence);
      [["Inbound", "target", "source"], ["Outbound", "source", "target"]].forEach(function (direction) {
        var links = graph.edges.filter(function (e) { return e[direction[1]] === node.id && nodes.has(e[direction[2]]); });
        el("h3", direction[0] + " included links (" + links.length + ")", panel);
        if (!links.length) { el("p", "None in the included graph.", panel); return; }
        var list = el("ul", null, panel);
        links.forEach(function (edge) {
          var id = edge[direction[2]], item = el("li", null, list), button = el("button", nodes.get(id).url, item);
          button.type = "button"; button.dataset.pageId = id; button.setAttribute("aria-label", "Inspect " + direction[0].toLowerCase() + " page " + nodes.get(id).url);
          sources(item, edge.evidence);
        });
      });
    }
    function select(id) {
      if (disposed || (id !== null && !nodes.has(id))) return;
      if (id === selected) return;
      selected = id;
      buttons.forEach(function (button, key) { button.setAttribute("aria-pressed", String(key === id)); button.closest("tr").classList.toggle("is-selected", key === id); });
      renderDetails(nodes.get(id));
      var n = nodes.get(id);
      status.textContent = n ? "Selected " + n.url + ". Depth " + depth(n) + ". " + n.inDegree + " inbound and " + n.outDegree + " outbound links in the included graph." : "Page selection cleared.";
    }
    function activate(id, focusList) {
      if (!nodes.has(id)) return;
      select(id); renderer.select(id);
      if (focusList) buttons.get(id).focus();
    }
    body.replaceChildren();
    graph.nodes.forEach(function (node) {
      var row = el("tr", null, body), heading = el("th", null, row); heading.scope = "row";
      var button = el("button", node.url, heading); button.type = "button"; button.dataset.pageId = node.id;
      button.setAttribute("aria-pressed", "false"); button.setAttribute("aria-label", "Inspect page " + node.url); buttons.set(node.id, button);
      [depth(node), String(node.inDegree), String(node.outDegree)].forEach(function (value) { el("td", value, row); });
    });
    function listSelect(event) { var b = event.target.closest("button[data-page-id]"); if (b && body.contains(b)) activate(b.dataset.pageId, false); }
    listen(body, "focusin", listSelect); listen(body, "click", listSelect);
    listen(panel, "click", function (event) { var b = event.target.closest("button[data-page-id]"); if (b && panel.contains(b)) activate(b.dataset.pageId, true); });
    renderDetails(null); status.textContent = graph.nodes.length + " included pages available for inspection."; container.hidden = !graph.nodes.length;
    return Object.freeze({ select: select, destroy: function () {
      if (disposed) return; disposed = true; listeners.forEach(function (remove) { remove(); });
      body.replaceChildren(); panel.replaceChildren(); status.textContent = ""; container.hidden = true;
    } });
  }
  return Object.freeze({ create: create });
});
