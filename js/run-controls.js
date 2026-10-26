(function () {
  "use strict";
  var form = document.getElementById("run-form");
  if (!form) return;
  var current = null, sequence = 0;
  var status = document.getElementById("run-status"), summary = document.getElementById("run-summary");
  function setState(state, message) { status.dataset.state = state; status.textContent = state + (message ? ": " + message : ""); }
  function stop() { if (current) current.controller.abort(); current = null; }
  document.getElementById("cancel-run").onclick = function () { if (current) { stop(); setState("cancelled"); } };
  document.getElementById("reset-run").onclick = function () { stop(); form.reset(); summary.textContent = ""; form.graph = null; setState("queued", "Ready for input."); };
  form.onsubmit = async function (event) {
    event.preventDefault();
    var mode = form.elements.mode.value, file = form.elements.inputFile.files[0], run;
    try {
      if (!["csv-import", "xml-import", "html-import"].includes(mode)) throw Error("This mode is unavailable.");
      if (!file) throw Error("Select a local file.");
      var root = form.elements.rootUrl.value.trim();
      if (mode === "html-import" && !root) throw Error("HTML requires a declared source URL.");
      run = SitemapContracts.createRun({ mode: mode, rootUrl: root || null, maxPages: Number(form.elements.maxPages.value), maxDepth: Number(form.elements.maxDepth.value) });
    } catch (error) { setState("failed", error.message); return; }
    stop(); form.graph = null; summary.textContent = "";
    var active = { id: ++sequence, controller: new AbortController() }; current = active;
    setState("queued");
    try {
      setState("running", "Reading local input.");
      var pending = mode === "csv-import" ? SitemapCsvImport.importFile(file, run) : mode === "xml-import" ? SitemapXmlImport.importFiles([{ file: file }], run) : SitemapHtmlImport.importFile(file, run, root);
      var timer;
      var result;
      try { result = await Promise.race([pending, new Promise(function (_, reject) { timer = setTimeout(function () { reject(Error("Import time limit reached.")); }, SitemapContracts.limits.maxDurationMs); })]); }
      finally { clearTimeout(timer); }
      if (current !== active || active.controller.signal.aborted) return;
      if (!result.ok) throw Error(result.issue.message);
      var graph = SitemapGraph.buildGraph(run, [result]); form.graph = graph;
      summary.textContent = "Run " + active.id + " | " + mode + " | " + file.name + " | Root: " + (run.rootUrl || "unknown") + " | " + run.startedAt + " | Limits: " + run.maxPages + " pages, depth " + run.maxDepth + " | Included: " + graph.nodes.length + " pages, " + graph.edges.length + " links | Exclusions: " + graph.exclusions.length + " | Coverage: " + (graph.partial ? "partial" : "user-supplied records only") + " | " + graph.issues.map(function (i) { return i.message; }).join("; ");
      setState(graph.partial ? "partial" : "complete"); current = null;
    } catch (error) { if (current === active) { current = null; setState("failed", error.message); } }
  };
})();
