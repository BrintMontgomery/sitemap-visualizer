(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapCsvImport = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";

  // RFC-style comma-separated records; line numbers refer to physical input lines.
  function parse(text) {
    var rows = [], fields = [], field = "", line = 1, start = 1, state = "start", error = null;
    function finish() { fields.push(field); rows.push({ fields: fields, row: start, error: error }); fields = []; field = ""; error = null; state = "start"; }
    for (var i = 0; i < text.length; i++) {
      var ch = text[i];
      if (state === "quoted") {
        if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else state = "closed"; }
        else if (ch === "\r" && text[i + 1] === "\n") { field += "\r\n"; i++; line++; }
        else { field += ch; if (ch === "\n" || ch === "\r") line++; }
      } else if (ch === ",") { fields.push(field); field = ""; state = "start"; }
      else if (ch === "\n" || ch === "\r") {
        if (ch === "\r" && text[i + 1] === "\n") i++;
        finish(); line++; start = line;
        // Header plus the maximum records and one sentinel are sufficient.
        if (rows.length > contracts.limits.maxRecords + 1) return { rows: rows, capped: true };
      } else if (ch === '"') {
        if (state === "start") state = "quoted";
        else { error = "Unexpected quote in field."; state = "invalid"; }
      } else { if (state === "closed") { error = "Unexpected character after closing quote."; state = "invalid"; } else if (state !== "invalid") state = "plain"; field += ch; }
    }
    if (state === "quoted") error = "Unclosed quoted field.";
    if (field || fields.length || state !== "start" || error) finish();
    return { rows: rows, capped: false };
  }

  async function importFile(file, run) {
    if (!run || run.mode !== "csv-import") throw new TypeError("A CSV import run is required.");
    if (!file || typeof file.name !== "string" || !file.name || !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.text !== "function") throw new TypeError("A selected file is required.");
    function failure(code, message) { return { ok: false, issue: { code: code, message: message } }; }
    if (file.size > contracts.limits.maxBytes) return failure("SIZE_LIMIT", "File exceeds the byte limit.");
    var started = Date.now(), text;
    try { text = await file.text(); } catch (_) { return failure("INPUT_MALFORMED", "The selected file could not be read."); }
    if (typeof text !== "string") return failure("INPUT_MALFORMED", "The selected file did not contain text.");
    var bytes = new TextEncoder().encode(text).length;
    if (bytes > contracts.limits.maxBytes) return failure("SIZE_LIMIT", "File exceeds the byte limit.");
    var parsed = parse(text.replace(/^\uFEFF/, "")), rows = parsed.rows;
    if (!rows.length || rows[0].error) return failure("INPUT_MALFORMED", "CSV header is missing or malformed.");
    var headers = rows[0].fields.map(function (h) { return h.trim().toLowerCase(); });
    var source = headers.indexOf("source"), target = headers.indexOf("target");
    if (source < 0 || target < 0 || headers.lastIndexOf("source") !== source || headers.lastIndexOf("target") !== target) return failure("INPUT_MALFORMED", "CSV requires exactly one source and one target column, separated by commas.");
    var claims = [], issues = [], seen = new Map(), count = Math.min(rows.length - 1, contracts.limits.maxRecords);
    for (var i = 1; i <= count; i++) {
      var row = rows[i];
      if (row.error || row.fields.length !== headers.length) { issues.push({ code: "INPUT_MALFORMED", row: row.row, message: row.error || "Column count does not match the header." }); continue; }
      var a = contracts.normalizeUrl(row.fields[source].trim()), b = contracts.normalizeUrl(row.fields[target].trim());
      if (!a.ok || !b.ok) { issues.push({ code: "URL_REJECTED", row: row.row, message: "Source and target must be valid public HTTP(S) URLs." }); continue; }
      var key = JSON.stringify([a.url, b.url]), evidence = { transport: "csv-import", inputReference: file.name, row: row.row, evidenceClass: "imported-link" };
      if (seen.has(key)) seen.get(key).evidence.push(evidence);
      else { var claim = { source: a.url, target: b.url, evidenceClass: "imported-link", evidence: [evidence] }; seen.set(key, claim); claims.push(claim); }
    }
    var truncated = parsed.capped || rows.length - 1 > contracts.limits.maxRecords;
    if (truncated) issues.push({ code: "PARTIAL_LIMIT", row: rows[contracts.limits.maxRecords + 1].row, message: "Record limit reached; remaining rows were not imported." });
    var result = contracts.validateResult(run, { transport: "csv-import", status: issues.length ? "partial" : "user-supplied", contentKind: "links", evidenceClass: "imported-link", payload: text, bytesRead: Math.max(bytes, file.size), inputReference: file.name, startedAt: new Date(started).toISOString(), elapsedMs: Date.now() - started, issues: Array.from(new Set(issues.map(function (issue) { return issue.code; }))) });
    if (!result.ok) return result;
    return { ok: true, acquisition: result, claims: claims, issues: issues, truncated: truncated };
  }
  return Object.freeze({ importFile: importFile });
});
