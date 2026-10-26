(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapHtmlImport = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";

  // Phase 5 preparation: reject invalid inputs before reading untrusted files.
  // Parsing is deliberately unavailable until its isolation has been verified.
  async function importFile(file, run, sourceUrl) {
    if (!run || run.mode !== "html-import") throw new TypeError("An HTML import run is required.");
    if (!file || typeof file.name !== "string" || !/\.html?$/i.test(file.name) ||
        !Number.isSafeInteger(file.size) || file.size < 0 || typeof file.text !== "function") {
      return { ok: false, issue: { code: "INPUT_MALFORMED", message: "Select an HTML or HTM file." } };
    }
    var source = contracts.normalizeUrl(sourceUrl);
    if (!source.ok) return { ok: false, issue: { code: "URL_REJECTED", message: "A public HTTP(S) source URL is required." } };
    if (file.size > contracts.limits.maxBytes) return { ok: false, issue: { code: "SIZE_LIMIT", message: "File exceeds the byte limit." } };
    return { ok: false, issue: { code: "UNSUPPORTED_CONTENT", message: "HTML parsing is not yet implemented." } };
  }
  return Object.freeze({ importFile: importFile });
});
