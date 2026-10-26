(function () {
  "use strict";
  var form = document.getElementById("run-form");
  if (!form) return;
  var current = null, sequence = 0, renderer = null, details = null;
  var status = document.getElementById("run-status"), summary = document.getElementById("run-summary");
  function clearGraph() {
    if (details) details.destroy(); details = null;
    if (renderer) renderer.destroy(); renderer = null;
    form.graph = null; form.layoutState = null; form.attempt = null;
    document.getElementById("empty-state").hidden = false;
    document.getElementById("graph-count").textContent = "Awaiting input";
  }
  function showGraph(graph, id) {
    if (graph.nodes.length && typeof SitemapRenderer !== "undefined") {
      renderer = SitemapRenderer.create(document.getElementById("graph-view"), graph, id, function (state) { form.layoutState = state; }, function (id) { if (details) details.select(id); });
      if (typeof SitemapDetails !== "undefined") details = SitemapDetails.create(document.getElementById("page-inspection"), graph, renderer);
      document.getElementById("empty-state").hidden = true;
    }
    document.getElementById("graph-count").textContent = graph.nodes.length + " pages · " + graph.edges.length + " links";
  }
  function setState(state, message) { status.dataset.state = state; status.textContent = state + (message ? ": " + message : ""); }
  function stop() { if (current) { current.controller.abort(); if (current.session) current.session.close(); } current = null; }
  function syncMode() {
    var live = form.elements.mode.value === "live-cors";
    form.elements.inputFile.required = !live; form.elements.inputFile.disabled = live;
    form.elements.rootUrl.required = live || form.elements.mode.value === "html-import";
    form.elements.requestTimeoutMs.disabled = !live;
    form.querySelector("[data-live-option]").hidden = !live;
  }
  form.elements.mode.onchange = syncMode; syncMode();
  document.getElementById("cancel-run").onclick = function () { if (current) { stop(); setState("cancelled"); } };
  document.getElementById("reset-run").onclick = function () { stop(); clearGraph(); form.reset(); syncMode(); summary.textContent = ""; setState("queued", "Ready for input."); };
  form.onsubmit = async function (event) {
    event.preventDefault();
    var mode = form.elements.mode.value, file = form.elements.inputFile.files[0], run;
    try {
      if (!["csv-import", "xml-import", "html-import", "live-cors"].includes(mode)) throw Error("This mode is unavailable.");
      if (mode !== "live-cors" && !file) throw Error("Select a local file.");
      var root = form.elements.rootUrl.value.trim();
      if (["html-import", "live-cors"].includes(mode) && !root) throw Error("Live retrieval and HTML require a declared source URL.");
      var timeout = Number(form.elements.requestTimeoutMs.value);
      if (mode === "live-cors" && (!Number.isInteger(timeout) || timeout < 1 || timeout > SitemapContracts.limits.requestTimeoutMs)) throw Error("Request timeout must be between 1 and 10000 milliseconds.");
      run = SitemapContracts.createRun({ mode: mode, rootUrl: root || null, maxPages: Number(form.elements.maxPages.value), maxDepth: Number(form.elements.maxDepth.value) });
    } catch (error) { setState("failed", error.message); return; }
    stop(); clearGraph(); summary.textContent = "";
    var active = { id: ++sequence, controller: new AbortController() }; current = active;
    setState("queued");
    try {
      setState("running", mode === "live-cors" ? "Requesting selected page." : "Reading local input.");
      var pending;
      if (mode === "live-cors") {
        active.session = SitemapFetch.createSession(run, { requestTimeoutMs: timeout });
        pending = active.session.request(run.rootUrl, { signal: active.controller.signal });
      } else pending = mode === "csv-import" ? SitemapCsvImport.importFile(file, run) : mode === "xml-import" ? SitemapXmlImport.importFiles([{ file: file }], run) : SitemapHtmlImport.importFile(file, run, root);
      var timer;
      var result;
      try { result = await Promise.race([pending, new Promise(function (_, reject) { timer = setTimeout(function () { reject(Error(mode === "live-cors" ? "Run time limit reached." : "Import time limit reached.")); }, SitemapContracts.limits.maxDurationMs); })]); }
      finally { clearTimeout(timer); }
      if (current !== active || active.controller.signal.aborted) return;
      if (mode === "live-cors") {
        form.attempt = result.attempt;
        if (result.ok) result = SitemapHtmlImport.fromAcquisition(run, result.acquisition);
      }
      if (!result.ok) throw Error(result.issue.code + ": " + result.issue.message);
      var graph = SitemapGraph.buildGraph(run, [result]); form.graph = graph;
      showGraph(graph, active.id);
      summary.textContent = "Run " + active.id + " | " + mode + " | " + (mode === "live-cors" ? run.rootUrl : file.name) + " | Root: " + (run.rootUrl || "unknown") + " | " + run.startedAt + " | Limits: " + run.maxPages + " pages, depth " + run.maxDepth + " | Included: " + graph.nodes.length + " pages, " + graph.edges.length + " links | Exclusions: " + graph.exclusions.length + " | Coverage: " + (graph.partial ? "partial" : mode === "live-cors" ? "selected page only; link targets not fetched" : "user-supplied records only") + " | " + graph.issues.map(function (i) { return i.message; }).join("; ");
      setState(graph.partial ? "partial" : "complete"); current = null;
    } catch (error) { if (current === active) { current = null; setState("failed", error.message); } }
    finally { if (active.session) active.session.close(); }
  };
})();
