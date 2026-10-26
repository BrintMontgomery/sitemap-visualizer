(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SitemapRenderer = factory();
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var serial = 0, NS = "http://www.w3.org/2000/svg";
  function compare(a, b) { return a < b ? -1 : a > b ? 1 : 0; }
  var colors = Object.freeze({ root: "#f59e0b", one: "#22c55e", two: "#8b5cf6", deep: "#ef4444", unknown: "#cbd5e1" });
  function color(node) { return node.depth === null ? colors.unknown : node.depth === 0 ? colors.root : node.depth === 1 ? colors.one : node.depth === 2 ? colors.two : colors.deep; }
  function radius(node) { return node.depth === 0 ? 20 : node.depth === 1 ? 13 : 8; }
  function label(node) {
    var u = new URL(node.url), parts = u.pathname.split("/").filter(Boolean), value = (parts.length ? parts[parts.length - 1] : u.hostname) + u.search;
    return value.length > 30 ? value.slice(0, 27) + "…" : value;
  }
  // A deterministic radial tree is only a layout aid. The SVG draws actual edges,
  // including cross-links and cycles; the temporary tree never becomes evidence.
  // Work is bounded by the graph contract (250 nodes / 10,000 records), with no
  // force simulation, animation loop, timers or quadratic pairwise repulsion.
  function initialPositions(graph) {
    var byId = new Map(graph.nodes.map(function (n) { return [n.id, n]; })), children = new Map(), parents = new Map(), weights = new Map(), result = new Map();
    var known = graph.nodes.filter(function (n) { return n.depth !== null; }).sort(function (a, b) { return a.depth - b.depth || compare(a.id, b.id); });
    graph.edges.forEach(function (e) {
      var s = byId.get(e.source), t = byId.get(e.target);
      if (s && t && t.depth !== null && s.depth !== null && t.depth === s.depth + 1 && (!parents.has(t.id) || e.source < parents.get(t.id))) parents.set(t.id, e.source);
    });
    // Reserve space around first-level hubs even when they have no known leaves.
    known.forEach(function (n) { children.set(n.id, []); weights.set(n.id, n.depth === 1 ? 4 : 1); });
    parents.forEach(function (p, id) { children.get(p).push(id); });
    children.forEach(function (list) { list.sort(); });
    known.slice().reverse().forEach(function (n) { var list = children.get(n.id); if (list.length) weights.set(n.id, list.reduce(function (sum, id) { return sum + weights.get(id); }, 0)); });
    var radii = [0];
    for (var depth = 1; depth <= 4; depth++) radii[depth] = Math.max(radii[depth - 1] + 180, known.filter(function (n) { return n.depth === depth; }).length * 12);
    function place(id, start, end) {
      var n = byId.get(id), angle = (start + end) / 2, r = radii[n.depth];
      result.set(id, { x: Math.cos(angle) * r, y: Math.sin(angle) * r });
      var cursor = start;
      children.get(id).forEach(function (child) { var span = (end - start) * weights.get(child) / weights.get(id); place(child, cursor, cursor + span); cursor += span; });
    }
    var roots = known.filter(function (n) { return !parents.has(n.id); });
    roots.forEach(function (n, i) { place(n.id, -Math.PI / 2 + i * Math.PI * 2 / roots.length, -Math.PI / 2 + (i + 1) * Math.PI * 2 / roots.length); });
    var unknown = graph.nodes.filter(function (n) { return n.depth === null; }).sort(function (a, b) { return compare(a.id, b.id); });
    var right = known.length ? Math.max.apply(null, Array.from(result.values()).map(function (p) { return p.x; })) + 240 : 0;
    var columns = Math.ceil(Math.sqrt(unknown.length));
    unknown.forEach(function (n, i) { result.set(n.id, { x: right + (i % columns) * 210, y: Math.floor(i / columns) * 100 }); });
    return result;
  }
  function create(container, graph, runId, onChange, onSelect) {
    var doc = container.ownerDocument, svg = container.querySelector("svg"), layer, disposed = false, listeners = [], selected = null, gesture = null;
    var positions = initialPositions(graph), nodes = new Map(), edges = [], view = { x: 0, y: 0, k: 1 }, state = new Map();
    var output = container.querySelector(".layout-status"), unpin = container.querySelector('[data-action="unpin"]');
    function el(tag, attrs, parent) { var e = doc.createElementNS(NS, tag); Object.entries(attrs || {}).forEach(function (a) { e.setAttribute(a[0], a[1]); }); if (parent) parent.appendChild(e); return e; }
    function listen(target, name, fn, options) { target.addEventListener(name, fn, options); listeners.push(function () { target.removeEventListener(name, fn, options); }); }
    function snapshot() { return Object.freeze({ run_id: runId, nodes: Object.freeze(Array.from(state.values()).map(function (p) { return Object.freeze(Object.assign({}, p)); })) }); }
    function changed() { if (onChange) onChange(snapshot()); }
    function announce(message) { output.textContent = message; }
    function transform() { layer.setAttribute("transform", "translate(" + view.x + " " + view.y + ") scale(" + view.k + ")"); }
    function draw() {
      nodes.forEach(function (item, id) { var p = state.get(id); item.group.setAttribute("transform", "translate(" + p.x + " " + p.y + ")"); item.group.classList.toggle("is-pinned", p.pinned); item.group.classList.toggle("is-selected", id === selected); item.group.setAttribute("aria-pressed", String(id === selected)); item.pin.textContent = p.pinned ? "Pinned" : ""; });
      edges.forEach(function (item) {
        var s = state.get(item.edge.source), t = state.get(item.edge.target), sr = radius(nodes.get(item.edge.source).node), tr = radius(nodes.get(item.edge.target).node);
        if (s === t) { item.path.setAttribute("d", "M " + (s.x - sr * 0.7) + " " + (s.y - sr * 0.7) + " C " + (s.x - 65) + " " + (s.y - 75) + " " + (s.x + 65) + " " + (s.y - 75) + " " + (s.x + sr * 0.9) + " " + (s.y - sr * 0.9)); return; }
        var dx = t.x - s.x, dy = t.y - s.y, length = Math.hypot(dx, dy) || 1, ux = dx / length, uy = dy / length;
        var bend = item.reciprocal ? 22 : 0, cx = (s.x + t.x) / 2 - uy * bend, cy = (s.y + t.y) / 2 + ux * bend;
        var startLength = Math.hypot(cx - s.x, cy - s.y) || 1, endLength = Math.hypot(t.x - cx, t.y - cy) || 1;
        item.path.setAttribute("d", "M " + (s.x + (cx - s.x) / startLength * sr) + " " + (s.y + (cy - s.y) / startLength * sr) + " Q " + cx + " " + cy + " " + (t.x - (t.x - cx) / endLength * (tr + 7)) + " " + (t.y - (t.y - cy) / endLength * (tr + 7)));
      });
      unpin.disabled = !selected || !state.get(selected).pinned;
    }
    function fit() {
      if (disposed) return;
      var values = Array.from(state.values());
      if (!values.length) return;
      var minX = Math.min.apply(null, values.map(function (p) { return p.x; })) - 125, maxX = Math.max.apply(null, values.map(function (p) { return p.x; })) + 125;
      var minY = Math.min.apply(null, values.map(function (p) { return p.y; })) - 85, maxY = Math.max.apply(null, values.map(function (p) { return p.y; })) + 85;
      view.k = Math.min(2, 920 / (maxX - minX), 620 / (maxY - minY));
      view.x = 500 - (minX + maxX) / 2 * view.k; view.y = 350 - (minY + maxY) / 2 * view.k; transform();
    }
    function zoom(factor, point) {
      if (disposed) return;
      var k = Math.max(0.02, Math.min(8, view.k * factor)), p = point || { x: 500, y: 350 }, ratio = k / view.k;
      view.x = p.x - (p.x - view.x) * ratio; view.y = p.y - (p.y - view.y) * ratio; view.k = k; transform();
    }
    function select(id, reveal) {
      if (disposed || (id !== null && !state.has(id))) return;
      var previous = selected; selected = id;
      if (id !== null && reveal !== false) {
        var p = state.get(id), x = p.x * view.k + view.x, y = p.y * view.k + view.y;
        if (x < 50 || x > 950 || y < 50 || y > 650) { view.x = 500 - p.x * view.k; view.y = 350 - p.y * view.k; transform(); }
      }
      draw();
      if (previous !== id && onSelect) onSelect(id);
    }
    function pin(id, x, y) {
      if (disposed || !state.has(id) || !Number.isFinite(x) || !Number.isFinite(y) || Math.abs(x) > 100000 || Math.abs(y) > 100000) return;
      Object.assign(state.get(id), { x: x, y: y, pinned: true }); select(id, false); changed();
    }
    function release(id) {
      if (disposed || !state.has(id)) return;
      Object.assign(state.get(id), positions.get(id), { pinned: false }); draw(); changed(); announce("Node unpinned and returned to its initial position.");
    }
    function reset() {
      if (disposed) return;
      state.forEach(function (p, id) { Object.assign(p, positions.get(id), { pinned: false }); }); select(null); fit(); changed(); announce("Layout reset. All pins cleared.");
    }
    function point(event) {
      var p = svg.createSVGPoint(); p.x = event.clientX; p.y = event.clientY;
      return p.matrixTransform(svg.getScreenCTM().inverse());
    }
    function end(event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      var completed = gesture; gesture = null;
      if (completed.captureTarget.hasPointerCapture(event.pointerId)) completed.captureTarget.releasePointerCapture(event.pointerId);
      if (completed.id && completed.moved) announce("Node pinned. Use Unpin selected or Reset layout to release it.");
      svg.classList.remove("is-moving");
    }
    svg.replaceChildren();
    var defs = el("defs", {}, svg), markerId = "graph-arrow-" + (++serial);
    var marker = el("marker", { id: markerId, viewBox: "0 0 8 8", refX: 7, refY: 4, markerWidth: 7, markerHeight: 7, orient: "auto", markerUnits: "userSpaceOnUse" }, defs);
    el("path", { d: "M 0 0 L 8 4 L 0 8 z", fill: "#64748b" }, marker);
    layer = el("g", { "class": "graph-layer" }, svg);
    var pairs = new Set(graph.edges.map(function (e) { return JSON.stringify([e.source, e.target]); }));
    var ids = new Set(graph.nodes.map(function (n) { return n.id; }));
    graph.edges.forEach(function (edge) {
      if (!ids.has(edge.source) || !ids.has(edge.target)) return;
      var path = el("path", { "class": "graph-edge", "data-edge-id": edge.id, "marker-end": "url(#" + markerId + ")" }, layer);
      edges.push({ edge: edge, path: path, reciprocal: pairs.has(JSON.stringify([edge.target, edge.source])) });
    });
    graph.nodes.forEach(function (node) {
      var p = positions.get(node.id); state.set(node.id, { run_id: runId, node_id: node.id, x: p.x, y: p.y, pinned: false });
      var group = el("g", { "class": "graph-node", "data-node-id": node.id, tabindex: "0", role: "button", "aria-pressed": "false", "aria-label": node.url + "; depth " + (node.depth === null ? "unknown" : node.depth) + "; " + node.inDegree + " inbound and " + node.outDegree + " outbound links. Enter or Space inspects page details." }, layer);
      el("title", {}, group).textContent = node.url + (node.title ? " — " + node.title : "");
      el("circle", { r: radius(node), fill: color(node), "class": node.depth === null ? "unknown-depth" : "" }, group);
      el("text", { y: radius(node) + 16, "class": "node-label", "text-anchor": "middle" }, group).textContent = label(node);
      var badge = el("text", { y: -radius(node) - 8, "class": "pin-label", "text-anchor": "middle" }, group);
      nodes.set(node.id, { group: group, node: node, pin: badge });
    });
    listen(svg, "pointerdown", function (event) {
      if (event.button !== 0 || gesture) return;
      var p = point(event), target = event.target.closest(".graph-node"), id = target && target.getAttribute("data-node-id");
      if (id) { select(id, false); target.focus(); announce("Selected " + label(nodes.get(id).node) + (state.get(id).pinned ? ". Pinned." : ". Drag to pin.")); }
      var captureTarget = target || svg;
      gesture = { pointerId: event.pointerId, id: id, captureTarget: captureTarget, start: p, origin: id ? Object.assign({}, state.get(id)) : Object.assign({}, view), moved: false };
      // Capturing on the node preserves click/double-click targeting after drag.
      captureTarget.setPointerCapture(event.pointerId); svg.classList.add("is-moving"); event.preventDefault();
    });
    listen(svg, "pointermove", function (event) {
      if (!gesture || event.pointerId !== gesture.pointerId) return;
      var p = point(event), dx = p.x - gesture.start.x, dy = p.y - gesture.start.y;
      if (!gesture.moved && Math.hypot(dx, dy) < 3) return;
      gesture.moved = true;
      if (gesture.id) pin(gesture.id, gesture.origin.x + dx / view.k, gesture.origin.y + dy / view.k);
      else { view.x = gesture.origin.x + dx; view.y = gesture.origin.y + dy; transform(); }
    });
    ["pointerup", "pointercancel", "lostpointercapture"].forEach(function (name) { listen(svg, name, end); });
    listen(svg, "wheel", function (event) { event.preventDefault(); if (!gesture) zoom(event.deltaY < 0 ? 1.15 : 1 / 1.15, point(event)); }, { passive: false });
    listen(svg, "dblclick", function (event) { var g = event.target.closest(".graph-node"); if (g) release(g.getAttribute("data-node-id")); });
    listen(svg, "focusin", function (event) {
      var g = event.target.closest(".graph-node"); if (g) select(g.getAttribute("data-node-id"));
    });
    listen(svg, "click", function (event) {
      var g = event.target.closest(".graph-node"); if (g) select(g.getAttribute("data-node-id"), false);
    });
    listen(svg, "keydown", function (event) {
      var g = event.target.closest(".graph-node");
      if (g && (event.key === "Enter" || event.key === " ")) { event.preventDefault(); select(g.getAttribute("data-node-id")); announce("Page selected. Details and included links are available below the graph."); }
    });
    container.querySelectorAll("[data-action]").forEach(function (button) {
      button.disabled = false;
      listen(button, "click", function () {
        var action = button.dataset.action;
        if (action === "zoom-in") zoom(1.25);
        else if (action === "zoom-out") zoom(0.8);
        else if (action === "fit") fit();
        else if (action === "reset") reset();
        else if (action === "unpin" && selected) release(selected);
      });
    });
    container.hidden = false; draw(); fit(); changed(); announce("Drag a node to pin it. Drag the canvas to pan; use the wheel or buttons to zoom.");
    return Object.freeze({ select: select, fit: fit, zoom: zoom, pin: pin, unpin: release, reset: reset, getLayoutState: snapshot,
      destroy: function () {
        if (disposed) return;
        if (gesture) end({ pointerId: gesture.pointerId });
        disposed = true; listeners.forEach(function (remove) { remove(); }); svg.replaceChildren(); container.hidden = true;
        container.querySelectorAll("[data-action]").forEach(function (b) { b.disabled = true; });
      }
    });
  }
  return Object.freeze({ create: create, initialPositions: initialPositions, color: color, colors: colors });
});
