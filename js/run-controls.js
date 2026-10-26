(function () {
  "use strict";
  var form = document.getElementById("run-form");
  if (!form) return;
  var current = null, sequence = 0, renderer = null, details = null;
  var status = document.getElementById("run-status"), summary = document.getElementById("run-summary");
  function clearGraph() {
    if (details) details.destroy(); details = null;
    if (renderer) renderer.destroy(); renderer = null;
    document.getElementById("discovery-log").hidden = true;
    document.querySelector("#discovery-log ol").textContent = "";
    document.getElementById("outcome-report").hidden = true; form.report = null;
    form.graph = null; form.layoutState = null; form.attempt = null; form.discovery = null;
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
  function showDiscovery(result) {
    var log = document.getElementById("discovery-log"), list = log.querySelector("ol");
    log.hidden = false; list.textContent = "";
    (result.attempts || []).forEach(function (attempt) {
      var item = document.createElement("li");
      item.textContent = SitemapOutcomes.redact(attempt.resourceUrl) + " | " + (attempt.httpStatus === null ? "HTTP status unknown" : "HTTP " + attempt.httpStatus) + " | Final: " + (SitemapOutcomes.redact(attempt.observedFinalUrl) || "unknown") + " | " + attempt.bytesRead + " bytes | " + attempt.elapsedMs + " ms | " + (attempt.issues.join(", ") || "readable");
      list.appendChild(item);
    });
  }
  function report(active, result, graph, state, issue) {
    var data = SitemapOutcomes.create({ id: active.id, run: active.run, mode: active.mode, input: active.input, startedAt: active.startedAt, durationMs: Date.now() - active.started, requestTimeoutMs: active.timeout, result: result, graph: graph, state: state, issue: issue, progress: form.discovery && (form.discovery.progress || form.discovery), unsupported: active.unsupported });
    form.report = data;
    summary.textContent = "Run " + data.runId + " | " + data.mode + " | " + data.input + " | Root: " + (data.root || "unknown") + " | " + data.startedAt + " | Limits: " + data.limits.pages + " pages, depth " + data.limits.depth + ", " + data.limits.durationMs + " ms | Duration: " + data.durationMs + " ms | Included: " + data.counts.pages + " pages, " + data.counts.links + " links | Exclusions: " + data.counts.exclusions + " | Truncated: " + data.truncated + " | " + data.coverage;
    document.getElementById("outcome-report").hidden = false;
    document.getElementById("outcome-guidance").textContent = data.guidance;
    document.getElementById("outcome-alternatives").textContent = data.alternatives;
    document.getElementById("run-diagnostics").textContent = JSON.stringify(data, null, 2);
    setState(data.state, data.outcome);
  }
  function setState(state, message) { status.dataset.state = state; status.textContent = state + (message ? ": " + message : ""); }
  function stop() { if (current) { current.controller.abort(); if (current.session) current.session.close(); } current = null; }
  function syncMode() {
    var live = form.elements.mode.value === "live-cors";
    form.elements.inputFile.required = !live; form.elements.inputFile.disabled = live;
    form.elements.rootUrl.required = live || form.elements.mode.value === "html-import";
    ["requestTimeoutMs", "maxConcurrency", "runDurationSeconds"].forEach(function (name) { form.elements[name].disabled = !live; });
    form.querySelectorAll("[data-live-option]").forEach(function (element) { element.hidden = !live; });
    ["maxPages", "maxDepth"].forEach(function (name) {
      var ceiling = (live ? SitemapContracts.liveLimits : SitemapContracts.limits)[name];
      form.elements[name].max = String(ceiling);
      if (Number(form.elements[name].value) > ceiling) form.elements[name].value = String(ceiling);
    });
  }
  form.elements.mode.onchange = syncMode; syncMode();
  document.getElementById("cancel-run").onclick = function () { if (current) { var active = current; stop(); report(active, null, form.graph, "cancelled", { code: "CANCELLED", message: "Analysis cancelled." }); } };
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
      run = SitemapContracts.createRun({ mode: mode, rootUrl: root || null, maxPages: Number(form.elements.maxPages.value), maxDepth: Number(form.elements.maxDepth.value), maxConcurrency: mode === "live-cors" ? Number(form.elements.maxConcurrency.value) : undefined, maxDurationMs: mode === "live-cors" ? Number(form.elements.runDurationSeconds.value) * 1000 : undefined });
    } catch (error) {
      stop(); clearGraph();
      report({ id: ++sequence, mode: mode, input: mode === "live-cors" ? form.elements.rootUrl.value : file && file.name, started: Date.now(), startedAt: new Date().toISOString(), unsupported: !["csv-import", "xml-import", "html-import", "live-cors"].includes(mode) }, null, null, "failed", { code: "INPUT_MALFORMED", message: error.message }); return;
    }
    stop(); clearGraph(); summary.textContent = "";
    var active = { id: ++sequence, controller: new AbortController(), run: run, mode: mode, input: mode === "live-cors" ? run.rootUrl : file.name, started: Date.now(), timeout: mode === "live-cors" ? timeout : undefined }; current = active;
    setState("queued");
    try {
      setState("running", mode === "live-cors" ? "Discovering readable pages and sitemaps." : "Reading local input.");
      var pending;
      if (mode === "live-cors") {
        pending = SitemapDiscovery.discover(run, { requestTimeoutMs: timeout, signal: active.controller.signal, onProgress: function (progress) {
          if (current !== active || active.controller.signal.aborted) return;
          form.discovery = progress;
          setState("running", progress.requested + " responses; " + progress.queued + " queued; " + progress.active + " active; " + progress.observedEdges + " observed links; " + progress.failed + " failed; " + progress.bytesRead + " bytes.");
        } });
      } else pending = mode === "csv-import" ? SitemapCsvImport.importFile(file, run) : mode === "xml-import" ? SitemapXmlImport.importFiles([{ file: file }], run) : SitemapHtmlImport.importFile(file, run, root);
      var timer;
      var result;
      try { result = mode === "live-cors" ? await pending : await Promise.race([pending, new Promise(function (_, reject) { timer = setTimeout(function () { reject(Error(mode === "live-cors" ? "Run time limit reached." : "Import time limit reached.")); }, run.maxDurationMs); })]); }
      finally { clearTimeout(timer); }
      if (current !== active || active.controller.signal.aborted) return;
      if (mode === "live-cors") {
        form.attempt = result.attempt;
        form.discovery = result; showDiscovery(result);
      }
      if (!result.ok) { report(active, result, null, "failed"); current = null; return; }
      var graph = SitemapGraph.buildGraph(run, mode === "live-cors" ? result.batches : [result]); form.graph = graph;
      showGraph(graph, active.id);
      report(active, result, graph); current = null;
    } catch (error) { if (current === active) { current = null; report(active, null, null, "failed", { code: /time limit/i.test(error.message) ? "TIMEOUT" : "INPUT_MALFORMED", message: error.message }); } }
    finally { if (active.session) active.session.close(); }
  };
})();
