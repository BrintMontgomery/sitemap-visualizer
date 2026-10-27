/*
 * Sitemap Visualizer — same-origin link export (development helper, not loaded by the app).
 *
 * Use when live discovery reports NETWORK_OR_POLICY_FAILURE because the site
 * sends no CORS header. Open the site's start page in your browser, open the
 * DevTools console (F12), paste this whole file and press Enter. It reads only
 * pages on the site's own origin, as the page itself may, and downloads a
 * links CSV for the app's "Links CSV" import. It does not bypass CORS and
 * sends no cookies. To change limits, run this first:
 *   window.SITEMAP_EXPORT_OPTIONS = { maxPages: 100, maxDepth: 3 };
 */
(async function (overrides) {
  "use strict";
  var settings = Object.assign({ maxPages: 50, maxDepth: 2, delayMs: 1000, timeoutMs: 10000, maxBytes: 2000000, download: true }, overrides || {});
  ["maxPages", "maxDepth", "delayMs", "timeoutMs", "maxBytes"].forEach(function (name) {
    if (!Number.isInteger(settings[name]) || settings[name] < 0) throw new RangeError(name + " must be a non-negative integer.");
  });
  settings.maxPages = Math.min(Math.max(settings.maxPages, 1), 1000);
  settings.maxDepth = Math.min(settings.maxDepth, 20);
  settings.delayMs = Math.max(settings.delayMs, 250);

  function normalize(href, base) {
    try {
      var url = new URL(href, base);
      if ((url.protocol !== "http:" && url.protocol !== "https:") || url.username || url.password) return null;
      url.hash = "";
      return url.href;
    } catch (_) { return null; }
  }
  function sameOrigin(href) { return new URL(href).origin === location.origin; }
  function sleep(ms) { return new Promise(function (resolve) { setTimeout(resolve, ms); }); }
  function cell(value) { return '"' + String(value).replace(/"/g, '""') + '"'; }

  var start = normalize(settings.startUrl || location.href);
  if (!start || !sameOrigin(start)) throw new Error("Open the site being mapped and run this there; the start URL must share its origin.");
  var queue = [{ url: start, depth: 0 }], queued = new Set([start]), links = new Set(), rows = [], failures = [], pages = 0;

  while (queue.length && pages < settings.maxPages) {
    var job = queue.shift();
    if (pages) await sleep(settings.delayMs);
    pages++;
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, settings.timeoutMs), response, text;
    try {
      response = await fetch(job.url, { credentials: "omit", redirect: "follow", signal: controller.signal });
      var type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
      if (!response.ok) { failures.push([job.url, "HTTP " + response.status]); continue; }
      if (!sameOrigin(response.url || job.url)) { failures.push([job.url, "redirected off-site"]); continue; }
      if (type !== "text/html" && type !== "application/xhtml+xml") { failures.push([job.url, "not HTML (" + (type || "no type") + ")"]); continue; }
      text = await response.text();
      if (text.length > settings.maxBytes) { failures.push([job.url, "larger than maxBytes"]); continue; }
    } catch (error) { failures.push([job.url, error && error.name === "AbortError" ? "timeout" : "unreadable"]); continue; }
    finally { clearTimeout(timer); }

    // DOMParser output is inert: scripts do not run and resources do not load.
    var source = normalize(response.url || job.url), doc = new DOMParser().parseFromString(text, "text/html");
    var baseElement = doc.querySelector("base[href]"), base = (baseElement && normalize(baseElement.getAttribute("href"), source)) || source;
    doc.querySelectorAll("a[href], area[href]").forEach(function (anchor) {
      var target = normalize(anchor.getAttribute("href"), base);
      if (!target || !sameOrigin(target)) return;
      var key = source + "\n" + target;
      if (!links.has(key)) { links.add(key); rows.push([source, target]); }
      if (job.depth < settings.maxDepth && !queued.has(target)) { queued.add(target); queue.push({ url: target, depth: job.depth + 1 }); }
    });
  }

  var csv = "source,target\r\n" + rows.map(function (row) { return row.map(cell).join(","); }).join("\r\n") + (rows.length ? "\r\n" : "");
  var summary = { start: start, pagesRequested: pages, links: rows.length, unvisited: queue.length, failures: failures.length, csv: csv };
  if (failures.length) console.table(failures.map(function (f) { return { url: f[0], reason: f[1] }; }));
  console.log("Sitemap export: " + pages + " pages requested, " + rows.length + " links, " + failures.length + " failures, " + queue.length + " queued but not visited. Set the app's root URL to " + start + " and import the CSV in Links CSV mode.");
  if (settings.download) {
    var url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" })), link = document.createElement("a");
    link.href = url; link.download = location.hostname + "-links.csv";
    document.body.appendChild(link); link.click(); link.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }
  return summary;
})(typeof window !== "undefined" ? window.SITEMAP_EXPORT_OPTIONS : undefined);
