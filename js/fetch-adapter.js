(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory(require("./contracts.js"));
  else root.SitemapFetch = factory(root.SitemapContracts);
})(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";
  var messages = {
    NETWORK_OR_POLICY_FAILURE: "The browser could not read this response. Network, CORS, mixed-content or local-network policy may be responsible; the cause is unknown. Import a links CSV, sitemap XML or saved HTML file instead.",
    TIMEOUT: "The request or run time limit was reached. Retry with a responsive endpoint or import local data.",
    CANCELLED: "The live request was cancelled.",
    HTTP_ERROR: "The endpoint returned an unsuccessful HTTP status.",
    OPAQUE_RESPONSE: "The browser did not expose a readable response. Import local data instead.",
    UNSUPPORTED_CONTENT: "Expected UTF-8 HTML or sitemap XML with a readable Content-Type and streaming body. Import a supported local file instead.",
    SIZE_LIMIT: "The resource or run byte limit was reached; no incomplete body was parsed.",
    PARTIAL_LIMIT: "The request count limit was reached.",
    URL_REJECTED: "Enter an HTTP(S) URL without embedded credentials.",
    SCOPE_EXCLUDED: "The requested or observable final URL is outside the selected root host."
  };
  function problem(code) { var error = new Error(messages[code]); error.code = code; return error; }
  function createSession(run, options) {
    options = options || {};
    if (!run || run.mode !== "live-cors" || !run.rootUrl) throw new TypeError("A live-cors run with a root URL is required.");
    var timeout = options.requestTimeoutMs === undefined ? contracts.limits.requestTimeoutMs : options.requestTimeoutMs;
    if (!Number.isInteger(timeout) || timeout < 1 || timeout > contracts.limits.requestTimeoutMs) throw new RangeError("Invalid request timeout.");
    var fetcher = options.fetch || (typeof fetch === "function" ? fetch.bind(globalThis) : null);
    var started = Date.now(), deadline = started + contracts.limits.maxDurationMs;
    var queue = [], active = new Set(), nextHost = new Map(), totalBytes = 0, requests = 0, closed = null, wake;
    function failure(code, attempt) {
      attempt.status = "not-readable"; attempt.issues = Object.freeze([code]);
      attempt.elapsedMs = Math.max(0, Date.now() - Date.parse(attempt.startedAt));
      return { ok: false, issue: { code: code, message: messages[code] }, attempt: Object.freeze(attempt) };
    }
    function attemptFor(url) {
      return { transport: "live-cors", status: "not-readable", resourceUrl: url, sourceOrigin: url ? new URL(url).origin : null, observedFinalUrl: null, httpStatus: null, redirectHistory: null, contentKind: null, evidenceClass: null, bytesRead: 0, startedAt: new Date().toISOString(), elapsedMs: 0, issues: [] };
    }
    function stop(code) {
      if (closed) return;
      closed = code; clearTimeout(wake);
      queue.splice(0).forEach(function (job) { job.finish(failure(code, attemptFor(job.url))); });
      active.forEach(function (job) { job.abort(code); });
    }
    function pump() {
      clearTimeout(wake);
      if (closed) return;
      if (Date.now() >= deadline) { stop("TIMEOUT"); return; }
      while (queue.length && active.size < contracts.limits.maxConcurrency) {
        let job = queue[0];
        if (totalBytes >= contracts.limits.maxTotalBytes) {
          queue.shift(); job.finish(failure("SIZE_LIMIT", attemptFor(job.url))); continue;
        }
        var wait = (nextHost.get(new URL(job.url).hostname.replace(/\.$/, "")) || 0) - Date.now();
        if (wait > 0) break;
        queue.shift(); active.add(job);
        nextHost.set(new URL(job.url).hostname.replace(/\.$/, ""), Date.now() + contracts.limits.minHostIntervalMs);
        execute(job).then(function (result) {
          active.delete(job); job.finish(result); pump();
        }, function () {
          // Keep an unexpected platform failure from rejecting the dispatch chain.
          active.delete(job); job.finish(failure("NETWORK_OR_POLICY_FAILURE", attemptFor(job.url))); pump();
        });
      }
      if (queue.length || active.size) {
        var delay = deadline - Date.now();
        if (queue.length && active.size < contracts.limits.maxConcurrency) delay = Math.min(delay, Math.max(1, (nextHost.get(new URL(queue[0].url).hostname.replace(/\.$/, "")) || 0) - Date.now()));
        wake = setTimeout(pump, Math.max(1, delay));
      }
    }
    async function execute(job) {
      var attempt = attemptFor(job.url), controller = new AbortController(), reader = null, bodyCancelled = false, timer, abortCode = null, rejectAbort;
      var aborted = new Promise(function (_, reject) { rejectAbort = reject; });
      function cancelBody() {
        if (bodyCancelled || !reader) return;
        bodyCancelled = true;
        try { Promise.resolve(reader.cancel()).catch(function () {}); } catch (_) { /* Best effort after abort. */ }
      }
      job.abort = function (code) { if (abortCode) return; abortCode = code; controller.abort(); cancelBody(); rejectAbort(problem(code)); };
      timer = setTimeout(function () { job.abort("TIMEOUT"); }, Math.min(timeout, Math.max(1, deadline - Date.now())));
      async function work() {
        if (!fetcher) throw problem("UNSUPPORTED_CONTENT");
        var response = await fetcher(job.url, { method: "GET", mode: "cors", credentials: "omit", redirect: "follow", referrerPolicy: "no-referrer", signal: controller.signal });
        if (controller.signal.aborted) {
          // A test double or platform may complete after abort. Do not consume it.
          if (response && response.body) Promise.resolve(response.body.cancel()).catch(function () {});
          throw problem(abortCode);
        }
        if (!response || !["basic", "cors"].includes(response.type)) throw problem("OPAQUE_RESPONSE");
        var finalUrl = contracts.normalizeUrl(response.url);
        if (finalUrl.ok) attempt.observedFinalUrl = finalUrl.url;
        if (Number.isInteger(response.status) && response.status >= 100 && response.status <= 599) attempt.httpStatus = response.status;
        // Cancel even rejected bodies; never fall back to an unbounded text()/arrayBuffer().
        if (response.body && typeof response.body.getReader === "function") reader = response.body.getReader();
        if (!finalUrl.ok || !contracts.inScope(finalUrl.url, run.rootUrl)) throw problem("SCOPE_EXCLUDED");
        if (attempt.httpStatus === null || attempt.httpStatus < 200 || attempt.httpStatus > 299) throw problem("HTTP_ERROR");
        var type = response.headers.get("content-type") || "", mime = type.split(";")[0].trim().toLowerCase();
        var charset = /charset\s*=\s*["']?([^\s;"']+)/i.exec(type);
        var kind = ["text/html", "application/xhtml+xml"].includes(mime) ? "html" : ["application/xml", "text/xml"].includes(mime) ? "xml" : null;
        if (!kind || (charset && !["utf-8", "utf8", "us-ascii"].includes(charset[1].toLowerCase())) || !reader) throw problem("UNSUPPORTED_CONTENT");
        attempt.contentKind = kind; attempt.evidenceClass = kind === "html" ? "observed-html" : "sitemap-only";
        var length = response.headers.get("content-length");
        if (length && /^\d+$/.test(length) && (Number(length) > contracts.limits.maxBytes || Number(length) + totalBytes > contracts.limits.maxTotalBytes)) throw problem("SIZE_LIMIT");
        var decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true }), chunks = [], payloadBytes = 0;
        while (true) {
          var chunk = await reader.read();
          if (controller.signal.aborted) throw problem(abortCode);
          if (Date.now() >= deadline) throw problem("TIMEOUT");
          if (totalBytes > contracts.limits.maxTotalBytes) throw problem("SIZE_LIMIT");
          if (chunk.done) break;
          if (!(chunk.value instanceof Uint8Array)) throw problem("UNSUPPORTED_CONTENT");
          attempt.bytesRead += chunk.value.byteLength; totalBytes += chunk.value.byteLength;
          if (attempt.bytesRead > contracts.limits.maxBytes || totalBytes > contracts.limits.maxTotalBytes) throw problem("SIZE_LIMIT");
          var text;
          try { text = decoder.decode(chunk.value, { stream: true }); } catch (_) { throw problem("UNSUPPORTED_CONTENT"); }
          chunks.push(text);
          payloadBytes += new TextEncoder().encode(text).length;
          if (payloadBytes > contracts.limits.maxBytes) throw problem("SIZE_LIMIT");
        }
        try { chunks.push(decoder.decode()); } catch (_) { throw problem("UNSUPPORTED_CONTENT"); }
        var result = contracts.validateResult(run, {
          transport: "live-cors", status: "readable", resourceUrl: job.url, observedFinalUrl: finalUrl.url, httpStatus: attempt.httpStatus,
          responseType: response.type, contentKind: kind, evidenceClass: attempt.evidenceClass, payload: chunks.join(""), bytesRead: attempt.bytesRead,
          inputReference: job.url, startedAt: attempt.startedAt, elapsedMs: Date.now() - Date.parse(attempt.startedAt), issues: []
        });
        if (!result.ok) throw problem(result.issue.code);
        attempt.status = "readable"; attempt.issues = Object.freeze([]); attempt.elapsedMs = result.result.elapsedMs;
        return { ok: true, acquisition: result, attempt: Object.freeze(attempt) };
      }
      try { return await Promise.race([work(), aborted]); }
      catch (error) {
        controller.abort(); cancelBody();
        return failure(abortCode || (error && Object.hasOwn(messages, error.code) ? error.code : "NETWORK_OR_POLICY_FAILURE"), attempt);
      } finally { clearTimeout(timer); if (reader) { try { reader.releaseLock(); } catch (_) {} } }
    }
    function request(input, requestOptions) {
      var normalized = contracts.normalizeUrl(input === undefined ? run.rootUrl : input), attempt = attemptFor(normalized.ok ? normalized.url : null);
      if (!normalized.ok) return Promise.resolve(failure("URL_REJECTED", attempt));
      if (!contracts.inScope(normalized.url, run.rootUrl)) return Promise.resolve(failure("SCOPE_EXCLUDED", attempt));
      if (closed || Date.now() >= deadline) return Promise.resolve(failure(closed || "TIMEOUT", attempt));
      if (requests >= run.maxPages) return Promise.resolve(failure("PARTIAL_LIMIT", attempt));
      if (totalBytes >= contracts.limits.maxTotalBytes) return Promise.resolve(failure("SIZE_LIMIT", attempt));
      var signal = requestOptions && requestOptions.signal;
      if (signal && signal.aborted) return Promise.resolve(failure("CANCELLED", attempt));
      requests++;
      return new Promise(function (resolve) {
        var job = { url: normalized.url, abort: null, finish: null };
        var cancel = function () {
          var index = queue.indexOf(job);
          if (index !== -1) { queue.splice(index, 1); job.finish(failure("CANCELLED", attempt)); pump(); }
          else if (job.abort) job.abort("CANCELLED");
        };
        job.finish = function (result) { if (signal) signal.removeEventListener("abort", cancel); resolve(result); };
        if (signal) signal.addEventListener("abort", cancel, { once: true });
        queue.push(job); pump();
      });
    }
    return Object.freeze({ request: request, close: function () { stop("CANCELLED"); }, snapshot: function () { return Object.freeze({ bytesRead: totalBytes, requests: requests, active: active.size, queued: queue.length }); } });
  }
  return Object.freeze({ createSession: createSession });
});
