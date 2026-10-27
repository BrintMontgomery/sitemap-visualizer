(function () {
  "use strict";
  var form = document.getElementById("run-form");
  if (!form) return;
  var current = null, sequence = 0, renderer = null, details = null;
  var status = document.getElementById("run-status"), summary = document.getElementById("run-summary");
  var exportVersion = 0, exportBusy = false;
  function syncExports() {
    ["png", "pages", "links"].forEach(function (kind) {
      document.getElementById("export-" + kind).disabled = exportBusy || typeof SitemapExports === "undefined" || !SitemapExports.available(form.graph, form.report);
    });
  }
  ["png", "pages", "links"].forEach(function (kind) {
    document.getElementById("export-" + kind).onclick = async function () {
      if (exportBusy || !SitemapExports.available(form.graph, form.report)) return;
      var version = exportVersion, graph = form.graph, data = form.report, output = document.getElementById("export-status");
      exportBusy = true; syncExports(); output.textContent = "Preparing " + kind + " download…";
      try {
        var blob = kind === "png" ? await SitemapExports.png(document.getElementById("graph-canvas"), graph, data) : new Blob([SitemapExports.csv(kind, graph, data)], { type: "text/csv;charset=utf-8" });
        if (version !== exportVersion) return;
        SitemapExports.download(blob, SitemapExports.filename(kind, data.runId), document);
        output.textContent = "Download prepared. Coverage qualifiers are included; URLs and supplied evidence may contain sensitive data.";
      } catch (_) { if (version === exportVersion) output.textContent = "Export failed. Retry or choose a CSV download. The analysis remains available."; }
      finally { if (version === exportVersion) { exportBusy = false; syncExports(); } }
    };
  });
  function syncHierarchy() {
    if (typeof SitemapEnhancedImport !== "undefined") SitemapEnhancedImport.renderHierarchy(document.getElementById("hierarchy-preview"), form.elements.hierarchyPreview.checked ? form.graph : null);
  }
  form.elements.hierarchyPreview.onchange = syncHierarchy;
  function clearGraph() {
    exportVersion++; exportBusy = false;
    document.getElementById("export-status").textContent = "Complete an analysis to export. Downloads contain included URLs and evidence.";
    if (details) details.destroy(); details = null;
    if (renderer) renderer.destroy(); renderer = null;
    document.getElementById("discovery-log").hidden = true;
    document.querySelector("#discovery-log ol").textContent = "";
    document.getElementById("outcome-report").hidden = true; form.report = null;
    form.graph = null; form.metrics = null;
    document.getElementById("graph-metrics").replaceChildren(); document.getElementById("graph-metrics").hidden = true;
    syncHierarchy();
    syncExports(); form.layoutState = null; form.attempt = null; form.discovery = null;
    document.getElementById("empty-state").hidden = false;
    document.getElementById("graph-count").textContent = "Awaiting input";
  }
  function showGraph(graph, id) {
    syncHierarchy();
    if (typeof SitemapMetrics !== "undefined") form.metrics = SitemapMetrics.analyze(graph);
    if (graph.nodes.length && typeof SitemapRenderer !== "undefined") {
      renderer = SitemapRenderer.create(document.getElementById("graph-view"), graph, id, function (state) { form.layoutState = state; }, function (id) { if (details) details.select(id); });
      if (typeof SitemapDetails !== "undefined") details = SitemapDetails.create(document.getElementById("page-inspection"), graph, renderer, form.metrics);
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
    if (graph && typeof SitemapMetrics !== "undefined") {
      form.metrics = form.metrics || SitemapMetrics.analyze(graph);
      SitemapMetrics.render(document.getElementById("graph-metrics"), form.metrics, data);
    }
    syncExports();
    summary.textContent = "Run " + data.runId + " | " + data.mode + " | " + data.input + " | Root: " + (data.root || "unknown") + " | " + data.startedAt + " | Limits: " + (data.limits.pages == null ? "not applied (input rejected)" : data.limits.pages + " pages, depth " + data.limits.depth + ", " + data.limits.durationMs + " ms") + " | Duration: " + data.durationMs + " ms | Included: " + data.counts.pages + " pages, " + data.counts.links + " links | Exclusions: " + data.counts.exclusions + " | Truncated: " + data.truncated + " | " + data.coverage;
    document.getElementById("outcome-report").hidden = false;
    document.getElementById("outcome-guidance").textContent = data.guidance;
    document.getElementById("outcome-alternatives").textContent = data.alternatives;
    document.getElementById("unreadable-help").hidden = data.mode !== "live-cors" || !data.issues.some(function (i) { return ["NETWORK_OR_POLICY_FAILURE", "OPAQUE_RESPONSE"].includes(i.code); });
    document.getElementById("run-diagnostics").textContent = JSON.stringify(data, null, 2);
    setState(data.state, data.outcome);
  }
  function clearInvalid() { Array.from(form.querySelectorAll("[aria-invalid]")).forEach(function (el) { el.removeAttribute("aria-invalid"); }); }
  function setState(state, message) { status.dataset.state = state; status.textContent = state + (message ? ": " + message : ""); }
  function stop() { if (current) { current.controller.abort(); if (current.session) current.session.close(); } current = null; }
  function syncMappings() {
    var container = document.getElementById("source-mappings");
    container.replaceChildren();
    Array.from(form.elements.inputFile.files).slice(0, 128).forEach(function (file, index) {
      var label = document.createElement("label"), input = document.createElement("input"), kind = document.createElement("select");
      label.appendChild(document.createTextNode(file.name + " — source URL"));
      input.type = "url"; input.dataset.mappingIndex = String(index); input.value = "";
      ["html", "xml", "csv"].forEach(function (value) { var option = document.createElement("option"); option.value = value; option.textContent = value.toUpperCase(); kind.appendChild(option); });
      kind.setAttribute("aria-label", file.name + " content kind");
      kind.value = /\.html?$/i.test(file.name) ? "html" : /\.xml$/i.test(file.name) ? "xml" : /\.csv$/i.test(file.name) ? "csv" : form.elements.mode.value.split("-")[0];
      if (kind.value === "html" && index === 0) input.value = form.elements.rootUrl.value;
      kind.onchange = function () { input.required = kind.value === "html"; input.disabled = kind.value === "csv"; }; kind.onchange();
      label.appendChild(kind);
      label.appendChild(input); container.appendChild(label);
    });
  }
  function syncMode() {
    var mode = form.elements.mode.value, live = mode === "live-cors", paste = mode === "paste-import";
    form.elements.inputFile.required = !live && !paste; form.elements.inputFile.disabled = live || paste;
    form.elements.rootUrl.required = live;
    form.querySelectorAll("[data-file-option]").forEach(function (element) { element.hidden = live || paste; });
    form.querySelectorAll("[data-paste-option]").forEach(function (element) { element.hidden = !paste; });
    ["pasteKind", "pasteText", "pasteSourceUrl"].forEach(function (name) { form.elements[name].disabled = !paste; });
    form.elements.pasteText.required = paste;
    form.elements.pasteSourceUrl.required = paste && form.elements.pasteKind.value === "html";
    ["requestTimeoutMs", "maxConcurrency", "runDurationSeconds"].forEach(function (name) { form.elements[name].disabled = !live; });
    form.querySelectorAll("[data-live-option]").forEach(function (element) { element.hidden = !live; });
    ["maxPages", "maxDepth"].forEach(function (name) {
      var ceiling = (live ? SitemapContracts.liveLimits : SitemapContracts.limits)[name];
      form.elements[name].max = String(ceiling);
      if (Number(form.elements[name].value) > ceiling) form.elements[name].value = String(ceiling);
    });
    document.querySelectorAll("#source-mappings label").forEach(function (label) { var input = label.querySelector("input"), kind = label.querySelector("select"); kind.disabled = live || paste; input.disabled = live || paste || kind.value === "csv"; input.required = !live && !paste && kind.value === "html"; });
  }
  form.elements.inputFile.onchange = function () { document.getElementById("source-mappings").replaceChildren(); syncMappings(); };
  var modeHelp = document.getElementById("input-mode-dialog");
  document.getElementById("input-mode-help").onclick = function () { if (modeHelp.showModal) modeHelp.showModal(); else modeHelp.setAttribute("open", ""); };
  modeHelp.onclick = function (event) { if (event.target === modeHelp) modeHelp.close(); };
  form.elements.mode.onchange = syncMode; form.elements.pasteKind.onchange = syncMode; syncMode();
  document.getElementById("cancel-run").onclick = function () { if (current) { var active = current; stop(); report(active, null, form.graph, "cancelled", { code: "CANCELLED", message: "Analysis cancelled." }); } };
  document.getElementById("reset-run").onclick = function () { stop(); clearGraph(); form.reset(); clearInvalid(); document.getElementById("source-mappings").replaceChildren(); syncMode(); summary.textContent = ""; setState("queued", "Ready for input."); };
  form.onsubmit = async function (event) {
    event.preventDefault();
    var mode = form.elements.mode.value, file = form.elements.inputFile.files[0], run, field;
    clearInvalid();
    try {
      field = form.elements.mode;
      if (!["csv-import", "xml-import", "html-import", "paste-import", "live-cors"].includes(mode)) throw Error("This mode is unavailable.");
      field = form.elements.inputFile;
      if (!["live-cors", "paste-import"].includes(mode) && !file) throw Error("Select a local file.");
      field = form.elements.rootUrl;
      var root = form.elements.rootUrl.value.trim();
      if (mode === "live-cors" && !root) throw Error("Live retrieval requires a declared source URL.");
      if (root) { var checked = SitemapContracts.normalizeUrl(root); if (!checked.ok) throw Error("Root URL: " + checked.issue.message); }
      field = form.elements.requestTimeoutMs;
      var timeout = Number(form.elements.requestTimeoutMs.value);
      if (mode === "live-cors" && (!Number.isInteger(timeout) || timeout < 1 || timeout > SitemapContracts.limits.requestTimeoutMs)) throw Error("Request timeout must be between 1 and 10000 milliseconds.");
      field = null;
      run = SitemapContracts.createRun({ mode: mode, rootUrl: root || null, maxPages: Number(form.elements.maxPages.value), maxDepth: Number(form.elements.maxDepth.value), maxConcurrency: mode === "live-cors" ? Number(form.elements.maxConcurrency.value) : undefined, maxDurationMs: mode === "live-cors" ? Number(form.elements.runDurationSeconds.value) * 1000 : undefined });
    } catch (error) {
      stop(); clearGraph();
      report({ id: ++sequence, mode: mode, input: mode === "live-cors" ? form.elements.rootUrl.value : mode === "paste-import" ? "Pasted input" : file && file.name, started: Date.now(), startedAt: new Date().toISOString(), unsupported: !["csv-import", "xml-import", "html-import", "paste-import", "live-cors"].includes(mode) }, null, null, "failed", { code: "INPUT_MALFORMED", message: error.message });
      // Name the rejected field before the general guidance.
      if (field) field.setAttribute("aria-invalid", "true");
      var guidanceText = document.getElementById("outcome-guidance");
      guidanceText.textContent = error.message + " " + guidanceText.textContent;
      return;
    }
    stop(); clearGraph(); summary.textContent = "";
    var active = { id: ++sequence, controller: new AbortController(), run: run, mode: mode, input: mode === "live-cors" ? run.rootUrl : mode === "paste-import" ? "Pasted input" : Array.from(form.elements.inputFile.files).map(function (f) { return f.name; }).join(", "), started: Date.now(), timeout: mode === "live-cors" ? timeout : undefined }; current = active;
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
      } else if (typeof SitemapEnhancedImport !== "undefined") {
        if (mode === "paste-import") pending = SitemapEnhancedImport.importPaste(form.elements.pasteText.value, form.elements.pasteKind.value, form.elements.pasteSourceUrl.value.trim(), run, { signal: active.controller.signal });
        else {
          var mappings = Array.from(document.querySelectorAll("#source-mappings input"));
          var selected = Array.from(form.elements.inputFile.files).map(function (file, index) { return { file: file, kind: mappings[index] ? mappings[index].parentElement.querySelector("select").value : mode.split("-")[0], sourceUrl: (mappings[index] ? mappings[index].value.trim() : index === 0 ? root : "") || null }; });
          pending = SitemapEnhancedImport.importSelected(selected, run, { signal: active.controller.signal });
        }
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
      var graph = SitemapGraph.buildGraph(run, result.batches || [result]); form.graph = graph;
      showGraph(graph, active.id);
      report(active, result, graph); current = null;
    } catch (error) { if (current === active) { current = null; report(active, null, null, "failed", { code: /time limit/i.test(error.message) ? "TIMEOUT" : "INPUT_MALFORMED", message: error.message }); } }
    finally { if (active.session) active.session.close(); }
  };
})();
