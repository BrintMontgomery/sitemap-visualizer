# Sitemap Visualizer — Software Requirements Specification

**Version:** 3.0 (production-oriented, browser-only CORS-compatible architecture)  
**Prepared:** 26 October 2026  
**Reference application:** [https://sesen.ai/sitemap-visualizer](https://sesen.ai/sitemap-visualizer)  
**Reference image:** User-provided sitemap-graph.png  
**Status:** Proposed production-ready specification, subject to acceptance testing; not a claim about the reference application's source code or internal architecture.  
**Supersedes:** Supplied Version 2 file (`Sitemap_Visualizer_Requirements_v2.md`), whose internal heading identified itself as version 1.1.  
**Architecture decision:** No application backend, proxy, hosted crawling service, elevated browser privileges, or CORS circumvention.

## 1. Executive summary

Develop a **JavaScript-based, front-end-only Sitemap Visualizer** that runs in a browser on the user's own computer. The application shall be distributed as static files that users can open locally, **without a web server, application server, server-side API, database service, or hosted crawling service**. It may load third-party JavaScript libraries from public content delivery networks (CDNs), with locally bundled alternatives for the core functions needed offline. The visualizer accepts a website URL when browser security permits direct retrieval, or user-supplied XML/CSV data when it does not. It displays a navigable, color-coded graph of the site's information architecture. A user can control analysis breadth with a maximum page count and depth, inspect individual pages and their incoming/outgoing links where known, reposition and zoom graph nodes, and export the results as PNG and CSV files.

The visual reference shows an **orange homepage at the center**, **green first-level pages**, **purple second-level pages**, and thin connecting lines on a **black graph canvas**. The live site explicitly displays the homepage/depth 1/depth 2/depth 3+ legend, URL/depth/page controls, and guidance for dragging and clicking nodes. Its page text describes XML-sitemap support, homepage crawling, link analysis, orphan-page detection, zooming, and PNG/CSV export. During a browser inspection on 26 October 2026, submission of https://example.com did not generate a graph or an error, so those post-submit behaviors were **not independently verified**.

This document translates the reference into testable requirements for a new application. It is **not a pixel-perfect reproduction mandate** and does not assume access to proprietary implementation details. **Technical feasibility constraint:** Browsers enforce the same-origin policy and Cross-Origin Resource Sharing (CORS). Running from a local `file://` page usually creates an opaque origin (serialized as `null`) and does not grant read access to arbitrary public websites. **No client-side library, `fetch` wrapper, XHR adapter, `no-cors` setting, iframe, or JSONP shim can unilaterally lift that restriction.**

Version 3.0 defines a *progressive acquisition strategy*: (1) readable CORS-authorized `fetch` with a bounded `XMLHttpRequest` alternative; (2) cooperative cross-origin iframe messaging when the target explicitly supplies a compatible browser bridge; (3) tightly gated, provider-supported JSONP for structured data only; and (4) local file, pasted-source, and multi-file imports as the reliable independent path. The application shall preserve provenance and label results partial whenever a fallback does not establish actual hyperlink evidence. No intermediary service or elevated browser setting is permitted. 

*Visual reference:* the source specification refers to a user-provided sitemap screenshot, used only as an appearance exemplar. The source image is not embedded in this Markdown deliverable.

## 2. Evidence, conventions, and priority
### 2.1 Evidence classification
| Code | Meaning | Basis |
| :---- | :---- | :---- |
| OBS | Directly observed | Published live controls, labels, legend, or supplied output image. |
| ADV | Advertised by the reference | Function described in the reference page's published explanatory text but not verified interactively. |
| DES | Proposed design requirement | New or clarified behavior specified here so developers can implement and test it. |

### 2.2 Priority convention
| Priority | Meaning |
| :---- | :---- |
| P0 — Must | Required for initial working release. |
| P1 — Should | Strongly recommended for release quality; may follow an MVP. |
| P2 — Could | Enhancement for later iteration. |

Unless otherwise stated, **“shall” denotes a normative, testable requirement**. Numeric service objectives are **proposed targets**, not observed characteristics of sesen.ai.

## 3. Product goals, users, and scope
### 3.1 Product goals
1. Make website structure intelligible without requiring users to read XML or navigate every page manually.

2. Surface crawl depth, hubs, isolated clusters, and gaps in the observed internal-link network.

3. Support SEO review, content inventories, migration planning, and information-architecture analysis.

4. Produce portable visual and machine-readable outputs for later analysis.

5. Run entirely on the end user's computer as a static JavaScript application, without installing or operating any backend service.

### 3.2 Primary user roles
* **Site analyst / SEO specialist:** evaluates internal links, depth, and discoverability.

* **Information architect / developer:** understands navigation, dependencies, and redesign impact.

* **Content owner / project manager:** reviews sections and exports a shareable map.

* **Local user:** opens the application in a desktop browser, without an account or server installation, and analyzes a website through permitted browser requests or local data imports (proposed MVP).

### 3.3 In scope

Static local deployment; vanilla JavaScript execution within the user's browser; optional pinned open-source/CDN libraries; HTTP/HTTPS URL validation; **CORS-authorized** bounded discovery; reusable `fetch` and optional XHR acquisition adapters; explicitly cooperative iframe `postMessage` exchange; strictly allowlisted, provider-supported JSONP **as an optional feature**; user-selected local XML, CSV, and HTML files; pasted source; graph extraction with provenance; canonical URL handling; directed internal-link graphs where hyperlinks have actually been observed or imported; interactive visual exploration; detail inspection; structural metrics; error/partial-result reporting; browser-generated PNG/CSV; privacy, security, and accessibility controls.

### 3.4 Out of scope for the initial release
Any application server, hosted proxy, backend API, headless browser, local web server required for normal operation, browser extension requiring additional permissions, or CORS-bypass relay; disabling browser protections; arbitrary cross-origin HTML retrieval from uncooperative sites; installation of new server functionality at target sites; authenticated/private-site crawling; bypassing CAPTCHA or anti-bot controls; unauthorized access; execution of arbitrary remote application JavaScript; large-scale enterprise crawling; website editing; comprehensive SEO auditing; automatic link repair; or guarantees of complete page/orphan detection. A cooperating target-origin iframe or existing JSONP endpoint is an **external capability**, not a new application backend.

## 4. Conceptual workflow
1. The user opens the local `index.html` file in a supported desktop browser and sees the input controls, legend, import option, and an empty graph canvas.

2. The user enters a public website/sitemap URL or imports/pastes XML, CSV, or HTML, then selects **Max Depth** and **Max Pages** where applicable.

3. The user activates **Visualize**. Browser-side JavaScript validates the input and creates an in-memory analysis run.

4. For URL mode, the acquisition manager first attempts browser-authorized CORS retrieval. If blocked, it explains that the precise cause may be indistinguishable from an ordinary network failure, and offers eligible cooperative iframe transport, an explicitly enabled trusted JSONP adapter (structured data only), and local import/paste. It shall never silently downgrade trust or execute a cross-origin script. Browser-side traversal proceeds only when retrieval and site-policy checks permit it. For import mode, it reads explicitly user-selected files or supplied text in memory.

5. Browser-side JavaScript normalizes discovered or imported URLs, distinguishes sitemap membership from verified/imported hyperlinks, calculates observed hyperlink depth when possible, and constructs directed links.

6. The application displays an interactive graph, coverage metrics, warnings, and a details panel for selected pages.

7. The user pans, zooms, drags nodes, and optionally downloads browser-generated PNG or CSV files.

8. If limits, timeouts, cross-origin restrictions, access restrictions, or parsing failures affect completeness, the interface reports a **partial** or failed result rather than implying complete coverage. No run data is transmitted to an application backend.

## 5. Functional requirements
### 5.1 Input and job control
| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-001 | The system shall provide a labeled **Website URL** input accepting public HTTP/HTTPS homepage URLs and direct XML sitemap URLs, alongside a clearly labeled local-file import option. | P0 | OBS / ADV / DES |
| FR-002 | The interface shall expose **Max Depth** and **Max Pages** controls, initialized to **2** and **50** respectively. Values shall be selectable and constrained to a documented allowed range. | P0 | OBS / DES |
| FR-003 | The **Visualize** command shall validate the URL, show field-specific errors, and prevent duplicate submissions during an active job. | P0 | OBS / DES |
| FR-004 | Each run shall show its state (queued, running, complete, partial, failed, or cancelled) with visible status feedback. | P0 | DES |
| FR-005 | The user shall be able to cancel a running analysis; the client shall not present cancelled work as a completed map. | P1 | DES |
| FR-006 | A new run shall clear or explicitly replace the prior run's graph and metrics. | P0 | DES |

**Clarifications:** A placeholder resembling https://example.com must not be interpreted as a submitted value unless the user enters it. The observed page showed selectable settings, but the complete menu ranges were not exhaustively verified; an implementer may use depths **0–4** and page caps **10, 25, 50, 100, 250** as a proposed configuration, provided the defaults match the reference. A depth of **0** means the homepage only.

### 5.2 Sitemap discovery and crawling
| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-007 | For a homepage input, browser-side JavaScript shall support bounded discovery through in-scope HTML `<a href>` links **only when the browser permits reading the target responses (including CORS)** and applicable site policies allow traversal. | P0 | ADV / DES |
| FR-008 | When browser access permits reading the relevant HTTP(S) responses, the system shall attempt XML sitemap discovery through `robots.txt` `Sitemap:` directives and conventional sitemap locations; it shall accept direct sitemap URLs and locally imported XML sitemaps. | P1 | ADV / DES |
| FR-009 | The parser shall support urlset and sitemapindex, including nested sitemap references within limits. | P1 | DES |
| FR-010 | The crawler shall normalize HTTP(S) URLs, resolve relative links, remove fragments, and deduplicate page identities according to a documented canonicalization policy. | P0 | DES |
| FR-011 | Crawling shall honor the maximum page cap, maximum link-depth cap, time budget, redirect budget, response-size limits, and allowed target scope. | P0 | OBS / DES |
| FR-012 | Browser-side traversal shall respect known `robots.txt` restrictions and enforce rate limits and timeouts. If browser security prevents checking robots rules, the default shall be to refrain from automatic multi-page crawling and offer local-file import instead. | P0 | DES |
| FR-013 | The browser-side analyzer shall record HTTP status, final response URL, source of discovery, and failure reason **when readable through browser APIs**; unavailable metadata shall be marked unknown rather than inferred. | P1 | DES |
| FR-014 | The engine shall calculate each discovered page's **minimum observed hyperlink distance** from the homepage by breadth-first search, rather than URL-folder depth. | P0 | OBS / DES |
| FR-015 | The engine shall preserve directed edges between discovered pages, including multiple navigation paths and cross-links; duplicates between the same source and target shall be collapsed for graph rendering. | P0 | ADV / DES |
| FR-016 | Results shall disclose when page caps, depth limits, CORS or local-file restrictions, blocked pages, robots rules, or network errors have truncated the graph. | P0 | DES |

**Discovery semantics:** If a user submits or imports an XML sitemap, its URLs are treated as candidate pages; the application may read permitted page content only when browser access allows it. A sitemap's inclusion of a URL **does not prove a hyperlink exists**. Consequently, sitemap membership and observed or explicitly imported hyperlinks must be stored separately. For internal-link analysis, default scope is the normalized input hostname; alternate subdomain inclusion is a future configurable option. Imported sitemap URLs alone may produce a page inventory without edges or valid click-depth values. A local CSV of observed links may provide those edges without requiring network crawling.

### 5.2.1 Local import and browser access requirements
| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-037 | The application shall import a user-selected local XML sitemap (`urlset` or `sitemapindex`) through the browser's file-selection and file-reading APIs, without uploading it to any server. | P0 | DES |
| FR-038 | The application shall import a user-selected local CSV link dataset containing at least source and target URLs; it shall validate column names, delimiters, and malformed rows. | P0 | DES |
| FR-039 | The interface shall distinguish **Live URL (browser-permitted)**, **XML sitemap import**, and **link CSV import**, and explain whether each input can establish actual internal-link edges and click-depth values. | P0 | DES |
| FR-040 | When cross-origin retrieval fails or is opaque, the application shall not bypass CORS through `no-cors`, third-party relays, noncooperative frames, or proxying. It may offer an **explicitly cooperative** target-origin `postMessage` bridge or opted-in provider-supported JSONP as separate acquisition modes, subject to FR-048–052; local import shall always remain available. | P0 | DES |
| FR-041 | Imported datasets and network-fetched content shall be parsed and processed in browser memory. File selection shall be initiated by the user; no automatic local filesystem scanning is permitted. | P0 | DES |


### 5.2.2 Browser security and feasibility contract

**Normative principle:** Every mechanism shall either receive browser-readable content with authorization from the resource's origin, receive a deliberate structured message from a cooperating document/provider, or read data supplied by the user. These mechanisms are alternatives to server crawling, **not methods for defeating CORS**. A browser script cannot alter a remote server's `Access-Control-Allow-Origin` response header. Browser consoles may diagnose a CORS error more specifically than page JavaScript can; a `fetch` `TypeError` alone does not establish that CORS was the cause. [S1][S2][S3]

The following matrix shall guide the acquisition manager:

| Method | Browser-readable output | Cooperation required | Works when target lacks CORS response headers? | Release treatment |
| --- | --- | --- | --- | --- |
| Native `fetch` GET (`mode: 'cors'`) | Response body and accessible metadata | Target must authorize origin via CORS | **No** | P0 preferred live transport |
| `XMLHttpRequest` GET | Response body and accessible metadata | Same CORS authorization as `fetch` | **No** | P1 compatibility adapter |
| Cross-origin `iframe` plus `postMessage` | **Only** a structured message sent by cooperating frame code | Target-hosted bridge and embeddable page | **Yes, for deliberately messaged data**; not arbitrary frame DOM | P1 optional capability |
| Classic-script JSONP endpoint | **Only** data deliberately passed to a callback by provider script | Existing provider endpoint implementing JSONP | **Yes, for supported JSONP responses**; executes remote script | P2 disabled by default |
| Local selected XML/CSV/HTML | Imported source; observed links only when file contains them | User supplies source | **Yes** | P0 guaranteed fallback |
| Pasted XML/CSV/HTML | User-supplied source | User supplies source | **Yes** | P1 fallback |
| Existing public CORS-enabled API/feed | Authorized structured data | Publisher exposes API or suitable CORS headers | Only when endpoint itself grants CORS or uses another listed cooperation channel | P1 optional |
| `mode: 'no-cors'`, DOM scraping an ordinary iframe, Axios/jQuery/other fetch wrappers alone | No readable blocked page | None | **No** | Prohibited as a claimed remedy |

**Local-file origin:** A `file://` document often has an opaque origin, with cross-origin requests carrying `Origin: null`. A target allowing only a particular HTTPS web origin will not thereby authorize the local application. Support for `file://` must be tested on the actual browsers; neither changing browser security flags nor installing a local web server is an acceptable runtime requirement. [S3]

### 5.2.3 Additional acquisition requirements

| ID | Requirement | Priority | Basis |
| --- | --- | --- | --- |
| FR-042 | The acquisition manager shall expose explicit modes: `live-cors`, `iframe-bridge`, `jsonp-provider` (disabled unless enabled), `xml-import`, `csv-import`, `html-import`, and `paste-import`; modes not supported by available capabilities shall be disabled with an explanation. | P0 | DES |
| FR-043 | Each acquisition attempt shall record transport, requested URL, source origin, observable final URL/status, elapsed time, bytes parsed, result trust class, and a generic error category. It shall not infer a CORS violation solely from a `TypeError`. | P0 | DES |
| FR-044 | A common browser `fetch` adapter shall use `mode: 'cors'`, `credentials: 'omit'`, an abort signal, timeout, response-type validation, page-scope checks, bounded streamed reads, and explicit handling of HTTP and opaque/error responses. | P0 | DES |
| FR-045 | An optional XHR adapter shall implement a comparable observable-success/error contract, without representing XHR as a CORS bypass or allowing unbounded remote downloads. | P1 | DES |
| FR-046 | Requests shall use ordinary GETs without custom authorizing headers unless specifically required by a trusted endpoint. Avoiding unnecessary preflight may improve interoperability, but shall never be described as dispensing with the required CORS response authorization. | P0 | DES |
| FR-047 | A failed live attempt shall present a concise explanation and next viable input choices, but shall **not** automatically load third-party executable JSONP scripts or arbitrary iframes. | P0 | DES |
| FR-048 | The iframe transport shall activate only when an already deployed, documented target-origin bridge explicitly supports the visualizer's message schema and may legally be embedded; a normal web page is not assumed to be a bridge. | P1 | DES |
| FR-049 | The iframe transport shall validate the exact expected `event.origin`, matching `event.source`, a cryptographically random per-request nonce, message type/version, payload schema, URL scope, and payload byte/record budgets before use. It shall impose timeouts and reject credentials or private content. | P1 | DES |
| FR-050 | If embedding is denied by CSP `frame-ancestors`, `X-Frame-Options`, missing bridge logic, or message timeout, the app shall record `BRIDGE_UNAVAILABLE` or `BRIDGE_TIMEOUT` and return to user-controlled import alternatives. | P1 | DES |
| FR-051 | JSONP may be offered only for a publisher's known JSONP endpoint supplying JSON-compatible page/link inventory, not as a generic means to download HTML or XML. The provider, endpoint, callback parameter, and schema shall be explicitly configured/allowlisted. | P2 | DES |
| FR-052 | JSONP shall be off by default, require an affirmative per-provider user choice, load only HTTPS provider scripts under an explicit trust warning, use a unique callback and timeout, validate the resulting data, and clean up the callback and script element on termination. | P2 | DES |
| FR-053 | The system shall import user-selected `.html`/`.htm` documents, and require or derive a trusted base URL for resolving relative hyperlinks; it shall never execute active content from those files. | P0 | DES |
| FR-054 | The user should be able to paste copied HTML, XML, or CSV text into a bounded, clearly labeled input, select the content type, and optionally specify its base URL. | P1 | DES |
| FR-055 | The import UI should accept a bounded set of files in one user operation and allow mapping each HTML document to its source URL; local sitemap indexes shall resolve other local files **only among files expressly selected by the user**. | P1 | DES |
| FR-056 | All import/paste parsing, graph construction, and export functionality shall run offline through bundled assets, independent of CORS and CDN availability. | P0 | DES |
| FR-057 | Every node and edge shall carry evidence provenance (transport, input reference, observed/imported assertion, coverage status). The interface and CSV exports shall distinguish factual hyperlinks, sitemap membership, and any non-edge structural inference. | P0 | DES |
| FR-058 | The application may provide a clearly labeled **hierarchy-only preview** of sitemap URL grouping, but hierarchy shall never be emitted as an observed internal hyperlink edge or used to compute observed click depth. | P1 | DES |
| FR-059 | The interface shall offer a **Why can't this URL be read?** explanation identifying possible CORS/network/policy causes, telling the user how to obtain a sitemap or exported link list, and stating what an HTML file or sitemap cannot establish. | P0 | DES |
| FR-060 | No fallback shall silently reinterpret blocked HTTP responses, an opaque response, iframe DOM access failures, or embedded image/script load events as page-content evidence. | P0 | DES |
| FR-061 | All transports shall use one normalization, provenance, resource-budget, parsing, and graph-validation pipeline; transport-specific partiality must remain visible. | P0 | DES |
| FR-062 | Remote acquisition shall reject unsupported schemes, unsafe literal private/loopback addresses, unexpected target scopes where observable, and user-unapproved redirects/target hosts; unknown or unobservable redirect details shall remain unknown. | P0 | DES |
| FR-063 | A generic remote-URL field shall not be treated as authority to execute remote script through JSONP; only administrator-shipped allowlist configuration plus user opt-in may enable such code. | P0 | DES |
| FR-064 | No transport may inject arbitrary HTTP headers such as `Origin`, `Host`, or a forged `User-Agent` to create the impression of alternate origin identity. | P0 | DES |
| FR-065 | The UI shall classify acquisition outcomes as `readable`, `partial`, `user-supplied`, `not-readable`, or `not-supported`, using independent issue codes for timeout, browser/network access failure, invalid content, and policy exclusions. | P0 | DES |

### 5.2.4 Reference pattern A — bounded vanilla JavaScript `fetch`

The following is **illustrative reference code**, not a complete tested implementation. Production code shall integrate normalizers, MIME checks, robots-policy checks, rate limiting, redirect/scope policy, and a diagnostic vocabulary. It shows why a custom wrapper is useful for *resilience and observability*, rather than as a cross-origin permission override.

```javascript
async function fetchReadableText(url, { timeoutMs = 10000, maxBytes = 2_000_000,
                                        signal: callerSignal } = {}) {
  const controller = new AbortController();
  let timedOut = false;
  const onAbort = () => controller.abort();
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  callerSignal?.addEventListener('abort', onAbort, { once: true });
  if (callerSignal?.aborted) controller.abort();

  try {
    const response = await fetch(url, {
      method: 'GET', mode: 'cors', credentials: 'omit',
      redirect: 'follow', signal: controller.signal
    });
    if (response.type === 'opaque') throw new Error('OPAQUE_RESPONSE');
    if (!response.ok) throw new Error(`HTTP_${response.status}`);
    if (!response.body?.getReader) throw new Error('STREAM_REQUIRED');

    const declared = Number(response.headers.get('content-length'));
    if (declared > maxBytes) throw new Error('SIZE_LIMIT');
    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8', { fatal: false });
    let read = 0, value = '';
    try {
      for (;;) {
        const part = await reader.read();
        if (part.done) break;
        read += part.value.byteLength;
        if (read > maxBytes) throw new Error('SIZE_LIMIT');
        value += decoder.decode(part.value, { stream: true });
      }
      value += decoder.decode();
    } finally {
      await reader.cancel().catch(() => {});
    }
    return { text: value, url: response.url, status: response.status,
             bytes: read, transport: 'live-cors' };
  } catch (error) {
    if (timedOut) throw new Error('TIMEOUT');
    if (callerSignal?.aborted) throw new Error('CANCELLED');
    if (error instanceof TypeError) throw new Error('NETWORK_OR_POLICY_FAILURE');
    throw error;
  } finally {
    clearTimeout(timer);
    callerSignal?.removeEventListener('abort', onAbort);
  }
}
```

**Implementation conditions:** `response.url` and `response.status` are meaningful only after the browser has exposed a readable response; `Content-Length` may be absent or inaccurate, so the streamed byte limit is authoritative. The snippet uses UTF-8; production implementation shall detect and document supported encodings rather than silently corrupt unsupported input. A follow-redirect request does **not** guarantee full visibility into every redirect hop. A permission-denied fetch normally rejects without exposing response details to application code. If an abort or redirect changes the final trusted scope, reject or quarantine the result according to policy.

**Optional XHR adapter (P1):** `XMLHttpRequest.open('GET', url)`, `withCredentials = false`, `timeout`, `onload`, `onerror`, and `ontimeout` provide older-style lifecycle hooks and `responseURL` when accessible. Its response is still CORS-governed, and size may be knowable only after browser buffering; constrain this transport to preapproved small resources or omit it where streaming byte caps are mandatory. Axios, jQuery AJAX, and other wrappers inherit the same boundary.

### 5.2.5 Reference pattern B — cooperating iframe `postMessage` bridge

This is a **two-party protocol**, not an embedded-page scraper. The external site must already host a dedicated, embeddable HTTPS bridge with JavaScript willing to receive requests and return public sitemap or link records. The visualizer must not assume a generic site's iframe exposes its DOM across origins. [S4]

**Parent-side protocol sketch:**

```javascript
// `bridgeUrl` must come from a trusted, explicit per-site configuration.
const bridgeOrigin = new URL(bridgeUrl).origin;
const nonce = Array.from(crypto.getRandomValues(new Uint8Array(16)),
  b => b.toString(16).padStart(2, '0')).join('');
const frame = document.createElement('iframe');
frame.hidden = true;
frame.src = bridgeUrl;

function receiveBridgeMessage(event) {
  if (event.origin !== bridgeOrigin || event.source !== frame.contentWindow) return;
  const data = event.data;
  if (!data || data.type !== 'SV_RESPONSE' || data.version !== 1) return;
  if (data.nonce !== nonce) return;
  // Production: validate schema, allowed URLs, counts, bytes, and public data.
  acceptValidatedBridgeData(data.payload);
}
window.addEventListener('message', receiveBridgeMessage);
frame.addEventListener('load', () => {
  frame.contentWindow.postMessage({ type: 'SV_REQUEST', version: 1,
     nonce, requestedScope: 'public-sitemap' }, bridgeOrigin);
});
document.body.append(frame);
// Production: timeout, remove listener/frame, reject duplicates/late responses.
```

For a `file://` parent, the bridge may have to address the parent with `postMessage(..., '*')`, because `file://` is not a usable exact `targetOrigin` in browser implementations. Accordingly, **the bridge must not send secrets**, and the parent must validate exact *bridge* origin and `event.source`, nonce, schema, and scope. A `null` origin is not proof of the parent's identity. Depending on browser cookie policy, navigation to the iframe might carry existing site cookies even though bridge **payloads** must be public-only; do not claim framing is inherently credential-free. The bridge's participation does not authorize reading arbitrary same-origin/private data or bypassing the target site's embedding restrictions. Require an explicit public-only capability contract; use no implicit cookie-authenticated page scraping. [S4]

### 5.2.6 Reference pattern C — opt-in provider JSONP

JSONP is only technically suitable where a known endpoint produces executable callback-format JavaScript such as `callbackName({...})`. An arbitrary `https://target/sitemap.xml` or HTML page does **not** become JSONP by appending `?callback=...`. A classic `<script src>` may load cross-origin JavaScript, but doing so **executes code from that endpoint in the visualizer's document**; therefore this route is a restricted compatibility feature, not a generic crawler. [S3][S8]

**Protocol sketch (P2, administrator-allowlisted endpoints only):**

```javascript
function trustedJsonp(endpoint, callbackParam = 'callback', timeoutMs = 8000) {
  // REQUIRED BEFORE CALL: exact HTTPS endpoint/provider allowlist + explicit user opt-in.
  return new Promise((resolve, reject) => {
    const name = `__sv_jsonp_${crypto.randomUUID().replaceAll('-', '')}`;
    const url = new URL(endpoint);
    url.searchParams.set(callbackParam, name);
    const script = document.createElement('script');
    let completed = false;
    const finish = (error, payload) => {
      if (completed) return;
      completed = true;
      clearTimeout(timer);
      script.remove();
      delete window[name];
      error ? reject(error) : resolve(payload);
    };
    const timer = setTimeout(() => finish(new Error('JSONP_TIMEOUT')), timeoutMs);
    window[name] = value => {
      // Production: enforce record/byte/schema/scope limits before accepting `value`.
      finish(null, value);
    };
    script.onerror = () => finish(new Error('JSONP_SCRIPT_ERROR'));
    script.src = url.href;
    document.head.append(script);
  });
}
```

The cleanup in this sketch does **not** sandbox the script or eliminate the possibility of malicious execution or late-load behavior. JSONP must be omitted if a provider cannot be firmly trusted, if Content Security Policy disallows it, or if the endpoint provides untrusted dynamic script. Production code shall also implement one-shot registration, collision/replay protection, strict configuration, and stale-script control to the extent browsers permit; **no implementation can guarantee isolation of a loaded third-party classic script**. Do not promise safety equivalent to parsing inert JSON.

### 5.2.7 Reliable CORS-independent input patterns

1. **Sitemap import:** Select a local XML file using `<input type="file" accept=".xml,text/xml,application/xml">`; parse with `DOMParser` plus parser-error detection, character and element limits, and XML entity-safety rules. Treat each `<loc>` as inventory membership only.
2. **Link CSV import:** Select a source/target CSV and parse using Papa Parse or a documented equivalent. Normalize and validate rows. Imported links form directed edges when the data source explicitly states they are hyperlinks.
3. **Saved HTML import:** Select local HTML documents (or paste copied source); identify each document's base URL from an explicit mapping, trusted source metadata, or user entry. Extract anchor links as inert source and resolve via `new URL(href, baseUrl)`; never execute scripts, images, event handlers, or imported HTML in the active UI.
4. **Multi-file import:** Select additional HTML/XML records in the same user gesture. Do not explore arbitrary folders or silently fetch referenced local paths. A ZIP import may be added with JSZip, subject to unpacked-size, entry-count, and path-traversal limits.
5. **Source provenance:** Show `Observed from imported HTML`, `Imported link assertion`, `Sitemap inventory only`, or `Observed from CORS-readable HTML`, so page existence cannot be confused with verified click paths.

A useful manual path is: open the target website in the browser normally, save relevant HTML/XML files or obtain its publicly available sitemap, and then explicitly import them. Such navigation does not authorize the visualizer to read the original page programmatically; it makes the *user-supplied copy* the analysis input.

### 5.2.8 User-facing failure behavior

On a blocked live retrieval, show a message such as:

> This browser could not read the page response. Possible causes include CORS policy, network failure, browser privacy controls, or access restrictions. The app cannot override the website's cross-origin policy. Import an XML sitemap, a link CSV, or saved HTML pages to continue; an available site-operated bridge may also be offered.

Do not show `CORS blocked` as a definitive diagnosis unless independent evidence establishes it. The app shall show which evidence sources would be needed to calculate links, true click depth, or candidate orphan pages. The primary fallback action shall never require switching off browser security settings.

### 5.3 Interactive graph visualization
| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-017 | The application shall render one distinct node per normalized discovered page and a directed edge for each observed internal link between included pages. | P0 | OBS / ADV |
| FR-018 | The graph shall display an **orange homepage**, **green depth 1**, **purple depth 2**, and **red depth 3+** nodes, with a persistent legend. | P0 | OBS |
| FR-019 | By default, the graph shall use a dark, preferably black, canvas with contrasting nodes and light-colored edges as in the supplied example. | P0 | OBS |
| FR-020 | The graph shall support pointer-based node dragging. A dragged node shall remain pinned until intentionally unpinned, reset, or replaced by a new run. | P0 | OBS / DES |
| FR-021 | The graph shall support zoom in/out, pan, and **Fit to View** without losing page or edge identities. | P0 | ADV / DES |
| FR-022 | Clicking or keyboard-selecting a node shall display page details, including URL, title if available, depth, status if available, and inbound/outbound link counts within the observed graph. | P0 | OBS / ADV / DES |
| FR-023 | A node-detail panel shall list links to other included nodes and permit navigating to the selected live page in a separate browser tab. | P1 | DES |
| FR-024 | The interface shall display summary counts for pages, rendered edges, depth distribution, crawl duration, and excluded/failed pages. | P1 | DES |
| FR-025 | The user shall be able to reset graph layout and optionally highlight a node's direct inbound and outbound neighbors. | P1 | DES |
| FR-026 | The graph shall remain usable at typical desktop and tablet viewport sizes; a structured, keyboard-accessible page list shall supplement visual interactions. | P0 | DES |

**Graph interpretation:** In the example, the homepage occupies the center, with several green first-level hub nodes radiating outward and purple second-level pages forming peripheral groups. This is a reference layout, not a guarantee that a force-directed solver will always yield an identical arrangement. Graph connectivity reflects actual links; placing nodes close together must not be interpreted as a link by itself. Node labels may shorten for legibility, but full URLs must remain accessible.

### 5.4 Analysis and export
| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-027 | The system shall calculate observed in-degree, out-degree, minimum crawl depth, and connected components for the included graph. | P1 | ADV / DES |
| FR-028 | The system shall identify **candidate orphan pages** only where it has a discovery source beyond homepage hyperlink traversal (e.g., XML sitemap) and the candidate has zero observed inbound links in the analyzed corpus. | P1 | ADV / DES |
| FR-029 | The interface shall qualify orphan findings as **candidates** when crawling is incomplete, blocked, or bounded; it shall not claim global proof of orphan status. | P0 | DES |
| FR-030 | The user shall be able to export the current graph view to a readable **PNG**, including node colors and a legend or equivalent explanatory key. | P1 | ADV |
| FR-031 | The user shall be able to export a **pages CSV** and a **links CSV** with stable identifiers, URLs, depths, and link endpoints; exports shall indicate whether the analysis was partial. | P1 | ADV / DES |
| FR-032 | PNG and CSV export actions shall be offered after analysis is complete or partial, and shall report an actionable failure if export cannot be produced. | P1 | DES |

**Orphan-page constraint:** A homepage-only crawler cannot discover pages that have no navigable path from that homepage. An XML sitemap, externally supplied list, or other independent inventory is therefore necessary to propose such pages as orphans. The application must also distinguish pages with **no observed inbound links** from pages with **no inbound links anywhere on the internet**.

### 5.5 Error handling and transparency
| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-033 | Invalid URLs, blocked hosts, unsupported protocols, CORS failures, unreadable local inputs, robots exclusions, timeouts, excessive redirects when detectable, rate limits, malformed XML/CSV, and empty results shall each produce a clear human-readable result state. | P0 | DES |
| FR-034 | No-response scenarios shall not silently leave the user on the initial empty-canvas prompt; the app shall show an error, retry option, or explicit request state. | P0 | DES |
| FR-035 | The user shall see the effective input URL, limits, crawl timestamp, and completion/truncation status alongside each result. | P1 | DES |
| FR-036 | Security challenges shall not be bypassed; where a permitted crawl cannot proceed, the app shall explain the access limitation. | P0 | DES |

## 6. Visual and interaction specification
### 6.1 Layout regions
| Region | Elements | Behavior |
| :---- | :---- | :---- |
| Configuration | Website URL; local XML/CSV import; Max Depth; Max Pages; Visualize | Persistent, labeled controls with help text and input-source guidance. |
| Job feedback | Progress, run status, page counts, warnings | Visible throughout a run; distinguish partial and failed outcomes. |
| Graph viewport | Dark canvas; color-coded nodes; directional links | Pan, zoom, select, drag, fit, reset. |
| Legend | Homepage / depth 1 / depth 2 / depth 3+ | Remains visible and color/shape accessible. |
| Details | Selected URL, depth, title, status, inbound/outbound links | Display on selection; dismiss or change selection. |
| Results/export | Counts, coverage note, PNG, CSV | Available following a usable run. |

### 6.2 Visual acceptance guidance
* Use the attached screenshot as the **graph-style exemplar**, not as proof of exact layout mathematics or fixed pixel sizes.

* Root/homepage: orange and visibly larger than ordinary leaves; depth-one hubs: green; depth-two leaves: purple; deeper nodes: red.

* Connections: thin, high-contrast lines; add arrowheads or selected-edge directional indication so link direction is understandable.

* Keep drag and selection distinct (click should select; sustained pointer movement should drag).

* Maintain minimum contrast and offer non-color labels or descriptions; color alone may not carry the depth information.

* Show a concise label only when legible; tooltips/details preserve complete URLs.

## 7. Data model and processing rules
### 7.1 Logical entities
| Entity | Essential fields |
| :---- | :---- |
| CrawlRun | run_id, source_mode (`url` / `xml-import` / `csv-import`), input_url (if supplied), effective_root, max_depth, max_pages, status, started_at, completed_at, truncated, warnings (browser memory only by default) |
| PageNode | node_id, normalized_url, title, depth, http_status, discovered_by, fetched, in_degree, out_degree |
| LinkEdge | source_node_id, target_node_id, link_type (`observed-html` / `imported-link`), observed_at, evidence_id |
| SitemapMembership | node_id, source_sitemap_url, lastmod (if provided), evidence_id |
| AcquisitionEvidence | evidence_id, transport, input_reference, source_origin, trust_class, readable, collected_at, bytes_read, claims, issues |
| BridgeSession | session_id, bridge_origin, request_nonce, protocol_version, public_only, status (memory only) |
| CrawlIssue | run_id, url, issue_code, message, phase, retryable |
| LayoutState | run_id, node_id, x, y, pinned (client state) |

### 7.2 Deterministic rules
1. **Root:** Treat the final readable homepage URL as the graph root for live runs; for imports, use a declared root if supplied, otherwise let the user select one and clearly identify the absence of a known root. Retain the original input separately.

2. **URL normalization:** Resolve relative URLs; normalize scheme/host case; remove fragments; normalize default ports and redundant path segments; preserve meaningful query parameters unless configured otherwise. Document treatment of trailing slashes and www aliases.

3. **Identity:** Two identical normalized URLs correspond to one node. When browser fetch metadata exposes a final redirect destination, associate it with that normalized destination; do not invent or claim access to inaccessible redirect history.

4. **Depth:** Shortest directed path length from homepage along **observed** HTML links, calculated by breadth-first traversal; homepage depth = 0. A sitemap-only URL with no observed route from home has depth null and an unreachable_in_observed_graph flag, rather than a misleading depth.

5. **Page cap:** Maximum pages limits unique browser fetch targets or imported page records analyzed in a run. If a discovered URL is excluded by the cap, count it as excluded metadata, not as a fully analyzed page.

6. **Edge semantics:** Only observed HTML hyperlinks or clearly asserted hyperlinks in user-supplied link records create LinkEdge records. A cooperating provider may report links with explicit provenance. Sitemap membership, redirects, and URL hierarchy are separate relations and cannot masquerade as observed edges.

7. **Counts:** A page's in/out-degree counts distinct included source/target nodes, not raw occurrences of repeated navigation links.

8. **Partiality:** Any aborted, capped, restricted, or timeout-affected discovery shall mark results partial or attach a material coverage warning.

### 7.3 Client-side module contract (proposed)
There shall be **no HTTP application API endpoints** such as `/api/crawls` and no server-side job storage. The following represent internal JavaScript functions or equivalent module boundaries, not network routes:

```javascript
const run = await analyzeSource({
  mode: 'url', // or 'xml-import' or 'csv-import'
  url: 'https://example.org',
  maxDepth: 2,
  maxPages: 50,
  signal: abortController.signal
});

const graph = buildGraph(run);    // nodes, observed/imported edges, coverage
const png = await exportPNG(graph); // local Blob or download
const csv = exportCSV(graph);     // local Blob or download
```

`analyzeSource` shall dispatch through an explicitly selected browser acquisition adapter (`live-cors`, optionally `iframe-bridge` or `jsonp-provider`, or an import/paste adapter), and then pass readable/supplied records through one validation and graph pipeline. Native `fetch` shall be used only for URLs that are readable under the browser's security rules, and browser file APIs for user-selected imports. Its inputs, run state, graph data, warnings, and exports shall remain within the browser session by default. `AbortController` or equivalent shall cancel active fetches and analysis where supported. PNG/CSV files shall be constructed and downloaded directly through browser facilities; no upload or server export endpoint is allowed.


### 7.4 Acquisition-result contract (Version 3.0)

Adapters shall return a discriminated object to a common validation pipeline; they must not directly mutate the graph:

```javascript
{
  transport: 'live-cors',                    // or iframe-bridge / import mode
  status: 'readable',                        // readable / partial / not-readable / ...
  resourceUrl: 'https://example.org/page',
  observedFinalUrl: 'https://example.org/page', // null when not observable
  contentKind: 'html',                       // html / xml / links / inventory
  evidenceClass: 'observed-html',            // or asserted-link / sitemap-only
  payload: '<html>...</html>',               // bounded inert source, or typed records
  issues: [],
  startedAt: '2026-10-26T00:00:00Z',
  bytesRead: 84_000
}
```

The example illustrates fields, not a network API. Each result shall be validated against a transport-specific schema and the run's limits before merging. Graph generation shall never infer a directed link from URL path nesting or from mere co-membership in a sitemap. `CrawlIssue.issue_code` shall support, at minimum: `NETWORK_OR_POLICY_FAILURE`, `TIMEOUT`, `CANCELLED`, `HTTP_ERROR`, `OPAQUE_RESPONSE`, `UNSUPPORTED_CONTENT`, `SIZE_LIMIT`, `ROBOTS_UNAVAILABLE`, `ROBOTS_EXCLUDED`, `BRIDGE_UNAVAILABLE`, `BRIDGE_TIMEOUT`, `BRIDGE_MESSAGE_REJECTED`, `JSONP_DISABLED`, `JSONP_SCRIPT_ERROR`, `JSONP_TIMEOUT`, `INPUT_MALFORMED`, and `PARTIAL_LIMIT`.

**Trust model:** `observed-html` means a hyperlink was parsed from HTML obtained via a readable response or explicit user-supplied file; `imported-link` means the import asserts the edge but the application did not independently confirm it; `bridge-reported` or `jsonp-reported` is provider asserted unless a verified HTML source is supplied. Evidence categories are descriptive, not cryptographic proofs of correctness.

## 8. Nonfunctional requirements
| ID | Requirement / proposed measurable target | Priority |
| :---- | :---- | :---- |
| NFR-001 | **Browser network safety:** reject non-HTTP(S) remote URL schemes and explicitly entered local/private-network or metadata-style targets by documented hostname/IP rules. Do not assert server-grade SSRF protection, DNS control, or full redirect inspection: browsers do not expose these capabilities to ordinary page JavaScript. | P0 |
| NFR-002 | **Resource safety:** bound HTML/XML download bytes when readable, XML expansion, browser-fetch concurrency, per-host request rate, analysis duration, and imported-file size. Cancel requests when supported. | P0 |
| NFR-003 | **Robots and site policy:** respect readable `robots.txt` rules, identify the application in requests only to the extent browsers permit, and avoid automated multi-page crawling when applicable rules cannot be checked. | P0 |
| NFR-004 | **Untrusted content isolation:** parse remote/imported HTML and XML as inert data (`DOMParser`, safe text extraction, or equivalent); do not insert or execute remote scripts, event handlers, or active HTML in the application's own document. | P0 |
| NFR-005 | **Injection safety:** render URLs, titles, and link text as escaped text; sanitize downloaded file names and CSV cells against spreadsheet-formula injection. | P0 |
| NFR-006 | **Local resource controls:** enforce per-run page limits, fetch concurrency, parsing budgets, and responsive cancellation inside the browser. There shall be no anonymous-submission service, server quotas, or bot-mitigation backend. | P0 |
| NFR-007 | **Accessibility:** target WCAG 2.2 AA for the controls, details, status messages, and keyboard-accessible alternatives to graph manipulation. | P0 |
| NFR-008 | **Browser support:** support current desktop Chrome, Edge, and Firefox; provide reasonable tablet behavior. Verify the exact `file://` deployment package on each supported browser. | P1 |
| NFR-009 | **Performance (proposed):** for an imported 50-page dataset or a CORS-permitted low-latency website, target median analysis completion under 30 seconds at depth 2, excluding remote-site throttling. Report import/parse time separately from network time and rendering. | P1 |
| NFR-010 | **Graph responsiveness (proposed):** display and pan a 250-node/1,000-edge result responsively on a mainstream desktop; target initial graph layout under 5 seconds after graph data becomes available. | P1 |
| NFR-011 | **Reliability:** network/import requests that fail shall resolve to a terminal error state with diagnostic reason rather than an indefinitely blank or busy interface. | P0 |
| NFR-012 | **Privacy / local storage:** keep uploaded files and analysis data on the user's machine; do not transmit them to an application server or analytics service. Use session memory by default, with any user-approved browser-local persistence disclosed and removable. | P0 |
| NFR-013 | **Local diagnostics:** provide inspectable or exportable browser-local diagnostics (duration, page/error counts, cap hits, per-phase failures) without remote telemetry or exposure of sensitive URL query strings. | P1 |
| NFR-014 | **Reproducibility:** record analysis mode, input references, normalization/version policy, and a timestamp; exported data must identify the run and any known truncation. | P1 |
| NFR-015 | **Implementation language:** implement all application logic, data processing, UI interactions, graph construction, and exports in client-side JavaScript, with HTML and CSS for structure and presentation. No Node.js, Python, PHP, Java, or other server runtime shall be required to operate the delivered application. | P0 |
| NFR-016 | **Static local launch:** ship static files, including a launchable `index.html`, that operate when opened directly from the user's filesystem in a supported desktop browser (`file://`); normal operation shall not require installation, a command line, a local HTTP server, or an internet-hosted application backend. | P0 |
| NFR-017 | **CDN libraries allowed:** established JavaScript libraries (e.g., D3.js or equivalent visualization/parsing packages) may be loaded directly from HTTPS CDN script resources. Document dependency name, version, license, and source; pin production versions rather than referencing moving `latest` builds. | P0 |
| NFR-018 | **Offline core functionality:** package or provide local fallbacks for every dependency needed to launch, import XML/CSV, render a graph, and export files **without an internet connection**. CDN loading shall be optional for these core functions; a CDN outage shall not make local-file analysis unusable. | P0 |
| NFR-019 | **No backend or intermediary:** prohibit application web services, server APIs, cloud databases, hosted crawler/worker processes, third-party CORS relays/proxies, and telemetry endpoints. Outbound requests shall be limited to user-authorized website retrieval, optional pinned CDN assets, and explicitly approved **cooperative public-data bridge/JSONP endpoints**. Such cooperative endpoints must already exist at the target/provider; the product shall not provision them. | P0 |
| NFR-020 | **Browser security compliance:** honor CORS, mixed-content restrictions, CSP and framing policies where present, and local-file origin rules; never treat an unreadable response, ordinary iframe contents, or an opaque response as retrieved HTML. `postMessage` is valid only with willing bridge cooperation; JSONP is executable provider script, not a general bypass. | P0 |
| NFR-021 | **Compatibility of static packaging:** choose browser-compatible scripts and asset paths that work under `file://` (for example classic scripts or a prebuilt bundle); do not require module imports, service-worker registration, workers, or runtime asset fetches that supported browsers prohibit for local files. | P0 |
| NFR-022 | **Transport boundaries:** maintain one documented adapter contract and central validation, provenance, request-budget, and error-classification pipeline across all acquisition modes. | P0 |
| NFR-023 | **Third-party trust:** preserve a reviewed dependency inventory (name, pinned version, source, exact CDN URL, license, SRI hash when CDN-hosted, offline copy, reason for use); do not load untrusted dynamic scripts. | P0 |
| NFR-024 | **Bridge security:** require expected origin/source/nonce checks, public-only schema, timeout, and maximum message length; do not use `Origin: null` as positive authentication of a local parent page. | P1 |
| NFR-025 | **JSONP security:** JSONP code is disabled by default and excluded from the P0 release path; activation requires a trusted provider allowlist and explicit per-provider consent. Do not claim isolated execution of scripts loaded into the main document. | P0 |
| NFR-026 | **Import hardening:** bound source bytes, element counts, nesting depth, decompressed ZIP contents if supported, and paste size; display imported titles/URLs as text, not HTML; protect export CSV formula cells. | P0 |
| NFR-027 | **Execution robustness:** core distribution shall use browser-compatible classic scripts or a prebuilt script bundle and local relative paths, without runtime module imports/fetches of local source files; client build tools are permitted only during development. | P0 |
| NFR-028 | **Degraded operation:** failure of CDN, bridge, optional JSONP, XHR, or live CORS transport shall not prevent the user from opening the app, importing local files, visualizing a graph, or exporting a result. | P0 |
| NFR-029 | **Security transparency:** distinguish browser/platform facts from diagnostic hypotheses in UI warnings and exported logs; never promise unrestricted arbitrary-host crawling. | P0 |

## 9. Suggested architecture and delivery boundaries

**Local delivery package:** A launchable `index.html`, stylesheets, application JavaScript bundle(s), and locally available library assets. Everything necessary for the core visualization and import workflow shall be included in the distributable folder. An optional CDN path may provide version-pinned libraries when connected; it must not be the only path for critical functionality.

**Presentation layer (browser):** Accessible URL/import form, status and error interface, SVG/Canvas force-directed graph, page details, keyboard-friendly data table, legend, and browser downloads.

**Acquisition and import layer (browser):** A client-side adapter manager uses a bounded `fetch`/optional XHR transport for CORS-readable resources; optional cooperative iframe/`postMessage` and disabled-by-default allowlisted JSONP transports; and file/paste adapters for XML, CSV, and HTML. One common validation pipeline applies data/scope/resource limits and explanatory result states. No proxy or backend is present.

**Processing layer (browser):** HTML/XML/CSV parsing as inert data, URL normalization, deduplication, bounded link traversal when allowed, graph and depth calculation, and candidate-orphan logic. Optional client-side Web Workers may be used only if the `file://` package works without them.

**State and export layer (browser):** In-memory run metadata, page/link records, graph layout, optional user-approved browser-local persistence, and locally generated PNG/CSV downloads. No server database, job queue, background crawler service, or API exists.

**Nonnegotiable design boundary:** This is a **stand-alone, front-end-only JavaScript application**. Opening the shipped `index.html` from a local directory must be sufficient to import data, visualize a graph, and export results. Arbitrary live-site crawling cannot be guaranteed. A bridge must be voluntarily supplied by the target origin; JSONP must be supported by an allowlisted provider. Neither changes the product's no-backend architecture, and neither authorizes access to arbitrary cross-origin HTML. When all live modes fail, the correct result is a transparent explanation and local import—not an undisclosed proxy, security switch, or server component.


### 9.1 Recommended vanilla JavaScript source structure

```text
sitemap-visualizer/
├── index.html                 # Double-clickable entry point
├── css/app.css
├── js/app.bundle.js           # Prebuilt classic script; no runtime module loader
├── js/config.js               # Local immutable limits and trusted endpoint allowlist
├── vendor/d3.min.js           # Verified local bundle OR graph alternative
├── vendor/papaparse.min.js    # Verified local CSV parser
├── sample-data/              # Small deterministic XML/CSV/HTML fixtures
├── THIRD_PARTY_NOTICES.md
└── README.md
```

Build-time source files may be separated under `src/` into `acquisition/`, `parsers/`, `model/`, `graph/`, `export/`, `ui/`, and `security/`; the delivered runtime bundle shall not require Node.js, bundlers, development commands, a worker server, or a service worker. Script ordering shall be deterministic. An optional CDN loader shall verify expected global symbols before enabling the application and recover from failure using bundled assets. **Offline functionality must not depend on waiting for a failing CDN request.** A release may choose bundled assets as the default and CDN as an explicit optional source.

### 9.2 Open-source browser libraries and CDN policy

| Library / category | Suggested use | Browser packaging approach | CORS and security implication |
| --- | --- | --- | --- |
| **D3.js** | Force layout, SVG manipulation, zoom/pan and drag | UMD/classic-script distribution or prebuilt bundle; local pinned copy | Renders a graph; **does not change website fetch permissions**. [S5] |
| **Cytoscape.js** (alternative) | Graph layout, traversal, navigation and style | Browser UMD build `cytoscape.min.js` | Suitable substitute for D3 graph management; **not a CORS workaround**. [S6] |
| **Papa Parse** | Robust CSV parsing from `File` objects or strings | Browser script with local copy | Remote URL parse uses XHR and remains subject to CORS. [S7] |
| **JSZip** (optional) | ZIP archives of explicitly user-selected source files | Browser `dist/jszip.min.js`, pinned local copy | Does not fetch remote pages; impose decompression/entry limits. [S9] |
| **DOMPurify** (optional) | Sanitize any intentional rich-HTML preview | Locally pinned browser distribution | Preferred architecture renders imported fields via `textContent`; sanitizer is not a license to execute imported pages. [S8] |
| **Native APIs** | `fetch`, XHR, `DOMParser`, `URL`, `File`, `Blob`, `TextDecoder`, `postMessage`, `AbortController` | Built into supported browsers | Browser policy governs network access; no external dependency. [S1][S4] |

**Selection rule:** Choose **one** primary graph library. Avoid including both D3 and Cytoscape.js in production without a demonstrated use case. Library versions must be pinned and recorded in a lock/inventory file; verify licenses and security status at release. Script inclusion examples use illustrative version placeholders rather than pretending that an unverified integrity hash is valid. A production CDN script tag shall contain exact HTTPS URL, version, `integrity="sha384-..."` from the shipped bytes, and `crossorigin="anonymous"`, with a verified local alternative. Never use `@latest` or execute arbitrary imported script URLs. [S10]

### 9.2.1 Concrete local/CDN loading examples

The recommended default is local, classic-script assets. A minimal browser-ready entry point can load pinned, verified copies without relying on network access:

```html
<script src="./vendor/d3.min.js"></script>
<script src="./vendor/papaparse.min.js"></script>
<script defer src="./js/app.bundle.js"></script>
```

Potential **version-pinned CDN resources**, to verify against published package contents before release, include:

- D3.js **7.9.0**: `https://cdn.jsdelivr.net/npm/d3@7.9.0/dist/d3.min.js`
- Papa Parse **5.7.0**: `https://cdn.jsdelivr.net/npm/papaparse@5.7.0/papaparse.min.js`
- JSZip **3.10.2** (optional): `https://cdn.jsdelivr.net/npm/jszip@3.10.2/dist/jszip.min.js`

These are examples of explicit package/version paths, **not already validated release artifacts or integrity hashes**. A shipped CDN-loading path shall calculate and record a valid SRI hash for the exact approved bytes, set `crossorigin="anonymous"`, and fall back to a locally bundled copy. The fallback must be tested with the network disconnected. The published npm/version listings and library documentation shall be consulted as part of dependency approval. [S5][S7][S9][S10][S11]

### 9.3 Decision records

- **ADR-001 — `file://` remains mandatory.** Core workflow must be self-contained; no localhost server, browser flags, extension, or installed runtime.
- **ADR-002 — No false CORS solution.** `fetch` and XHR adapters govern access attempts, errors, and limits but never bypass origin policy.
- **ADR-003 — Cooperative capabilities are optional.** Iframe messaging and JSONP require explicit target/provider behavior; they cannot supply a generic crawler.
- **ADR-004 — Untrusted code stays out.** HTML/XML/CSV are parsed as data; JSONP is exceptional executable script, off by default.
- **ADR-005 — Provenance is first-class.** Only evidenced hyperlinks drive observed click-depth and inbound/outbound link metrics.
- **ADR-006 — Offline import is the guaranteed path.** Offline core functionality is a release-blocking P0 criterion, not a best-effort fallback.

## 10. Acceptance criteria and verification cases
| Test ID | Scenario | Expected result | Traces |
| :---- | :---- | :---- | :---- |
| AT-01 | Load the app with no input | URL, Max Depth = 2, Max Pages = 50, legend, and empty-state guidance visible. | FR-001–003, FR-018 |
| AT-02 | Submit invalid URL (javascript: or malformed host) | No crawl; actionable validation message. | FR-003, NFR-001 |
| AT-03 | Analyze a four-page, CORS-readable test fixture with known edges or import its equivalent links CSV | Four unique nodes and matching directed edges; correct depth by shortest link path. | FR-007, FR-010, FR-014–018, FR-038 |
| AT-04 | Configure depth 1 for a CORS-readable fixture or imported link dataset with deeper pages | Root and first-hop included; deeper pages excluded from the analyzed subgraph; depth-cap warning. | FR-011, FR-016, FR-038 |
| AT-05 | Configure page cap 10 on a 30-page import or CORS-readable fixture | At most ten included pages, accurate partiality/count metadata. | FR-011, FR-016 |
| AT-06 | Analyze duplicate links, fragments, and redirects in a readable fixture or local import | URLs deduplicated; distinct page-level edges counted once; only observable redirect metadata asserted. | FR-010, FR-015 |
| AT-07 | Import valid local `urlset` and `sitemapindex` XML data, including a sitemap-only URL | Sitemap membership visible separately; no fabricated HTML link or click depth. | FR-008–009, FR-028–029, FR-037 |
| AT-08 | Inspect and drag a node | Details show correct metadata; node remains pinned; zoom/pan/fit functions work. | FR-020–023 |
| AT-09 | Load supplied screenshot's approximate topology as test fixture | Orange central root, green hub nodes, purple leaves, thin visible edges on dark canvas. | FR-017–019 |
| AT-10 | Export after a completed run | PNG captures current graph; pages/links CSVs have headers, stable IDs, and correctly quoted values. | FR-030–032 |
| AT-11 | Test orphan logic with a sitemap-only unlinked page | Page flagged as **candidate orphan**; no claim of globally proven orphan status. | FR-028–029 |
| AT-12 | Target a CORS-blocked site, robots-blocked path, or timed-out request | Clear access/partiality message and local-import guidance; no silent empty canvas and no CORS bypass. | FR-033–036, FR-040, NFR-011, NFR-020 |
| AT-13 | Enter a non-HTTP(S) URL, literal private/loopback IP, or known metadata hostname | Client validation rejects the explicit target; no claim is made that browser JavaScript can inspect DNS or every redirect. | NFR-001–002 |
| AT-14 | Navigate by keyboard and assistive technology | Form, actions, statuses, page table, and selected node details remain usable without pointer-only interaction. | FR-026, NFR-007 |
| AT-15 | Verify CSV injection protection using cell beginning =HYPERLINK(...) | Exported cells cannot execute a spreadsheet formula when opened in common spreadsheet applications. | NFR-005 |
| AT-16 | Open the delivered `index.html` by double-clicking it on a local computer | App runs under `file://` in Chrome, Edge, and Firefox without any HTTP server, runtime installation, or application backend. | NFR-015–016, NFR-021 |
| AT-17 | Disconnect the computer from the internet and import a local sitemap or links CSV | Import, graph construction, node interaction, and PNG/CSV export remain functional using bundled dependencies. | FR-037–039, NFR-018 |
| AT-18 | Load with an optional CDN unavailable | The app uses a local library copy or built-in alternative; it provides a clear dependency error only for non-core optional features. | NFR-017–018 |
| AT-19 | Inspect network traffic during import, graph interaction, and export | No calls to backend APIs, hosted proxies, cloud storage, analytics, or server-side crawlers; only expressly initiated URL requests or optional CDN resources are allowed. | NFR-012, NFR-019–020 |
| AT-20 | Try a site that blocks cross-origin fetch, then select local import | No fabricated graph or CORS bypass; user can analyze imported XML or links CSV. | FR-039–041, NFR-020 |
| AT-21 | Import a links CSV where source/target nodes permit a depth calculation | Directed edges reflect imported observations; shortest path depth is correct; missing edges remain unknown. | FR-038–039, FR-014–015 |
| AT-22 | Attempt to analyze a cross-origin site with no CORS response headers using `fetch` and optional XHR | Neither adapter reads a response body; error category is not misrepresented as definitive CORS; import options remain usable. | FR-040, FR-043–047, NFR-020 |
| AT-23 | Request a CORS-authorized fixture using vanilla `fetch` | Readable HTML is parsed; final exposed URL, HTTP status, duration, byte limit and provenance are recorded; graph contains only observed links. | FR-043–044, FR-057, NFR-022 |
| AT-24 | Attempt `mode: 'no-cors'` against a disallowing site | No application path treats an opaque response as page content; run remains blocked/partial. | FR-040, FR-060, NFR-020 |
| AT-25 | Use an existing target-operated iframe bridge with a valid protocol response | Exact-origin/source, nonce, version, schema, allowed scope, and size checks succeed; public structured records are imported. | FR-048–049, NFR-024 |
| AT-26 | Send spoofed iframe messages, wrong nonce, mismatched source, malformed payload, or unexpected origin | Each message is rejected and logged without mutating the graph. | FR-049, FR-061, NFR-024 |
| AT-27 | Point iframe mode to ordinary website or framing-denied bridge | No DOM scraping; clear bridge-unavailable/timeout outcome and import options. | FR-048, FR-050, NFR-020 |
| AT-28 | Run from `file://` with cooperative iframe bridge | Public payload exchange works only if intentionally supported; no credentials disclosed and no trust inferred from parent origin `null`; any browser-managed frame cookies are disclosed as a platform limitation. | FR-049, NFR-024 |
| AT-29 | Attempt a generic URL as JSONP, or test with JSONP disabled | Arbitrary script is never loaded and JSONP-disabled notice is shown. | FR-051–052, FR-063, NFR-025 |
| AT-30 | Enable a trusted JSONP endpoint and deliberately opt in | Exactly allowlisted HTTPS callback endpoint may be invoked; schema/timeout/cleanup behavior is tested; HTML/XML endpoints are rejected. | FR-051–052, NFR-025 |
| AT-31 | Import saved HTML and set its base URL | Relative hyperlinks resolve and generate observed-from-import edges; scripts and remote assets do not execute or load. | FR-053, FR-057, NFR-004 |
| AT-32 | Paste HTML, XML, and CSV, including malformed or oversized input | Supported formats are parsed as inert bounded data; invalid/oversized inputs are rejected with localized errors. | FR-054, NFR-026 |
| AT-33 | Import multiple HTML pages plus a sitemap index with local references | Only user-selected files are read; matched records preserve per-file source and edge provenance; missing referenced files are reported. | FR-055, FR-057 |
| AT-34 | Load sitemap-only inventory and optional hierarchy preview | No invented observed links or click depths; generated preview is visibly labeled inference. | FR-058, FR-057 |
| AT-35 | Compare bundled offline run with optional CDN denied | Identical core XML/CSV/HTML graph/import/export results; no blank app or required CDN connection. | FR-056, NFR-018, NFR-028 |
| AT-36 | Review release dependency package, runtime traffic, and extension privileges | All production scripts pinned and locally available; no backend/proxy/extension/telemetry; scripts from unknown JSONP URLs never loaded. | NFR-019, NFR-023, NFR-025, NFR-027 |
| AT-37 | Attempt remote redirect to an out-of-scope page, an oversize response, inaccessible robots file, and slow provider | Result is rejected, bounded or partial as observable; cancellation and status are terminal; unavailable redirect metadata is marked unknown. | FR-011–013, FR-043–044, FR-062, NFR-002 |

**Release gate:** Every P0 requirement must have passing automated or documented manual evidence. P1 requirements should be tracked explicitly and may be released behind a feature flag where appropriate.

## 11. Suggested implementation phases
| Phase | Scope | Exit criterion |
| :---- | :---- | :---- |
| 1. Static JavaScript foundation | `file://` launch; bundled dependencies with optional pinned CDN; client-side URL validation; local CSV/HTML import; provenance and edge/depth computation. | AT-02–06, AT-13, AT-16–18, AT-21, AT-31, and AT-35 pass on local fixtures. |
| 2. Interactive MVP | URL/import input, bounded `fetch` transport, status/error classification, dark graph, legend, drag/zoom/pan/fit, and CORS-access guidance. | AT-01, AT-03, AT-08, AT-09, AT-12, AT-20, and AT-22–24 pass. |
| 3. Data completeness and export | XML and multi-file import; browser-permitted discovery; candidate orphan analysis; PNG/CSV; optional XHR and cooperative bridge, with explicit partiality. | AT-07, AT-10, AT-11, AT-15, AT-17, AT-25–28, and AT-33–34 pass (bridge tests when bridge feature is enabled). |
| 4. Hardening and release | Accessibility/performance, local-only privacy, pinned dependencies, threat tests, cross-browser `file://` QA, and network inspection; optional allowlisted JSONP validation if enabled. | P0 release gate and AT-19, AT-29, AT-35–37 pass; if shipped, JSONP passes AT-30; NFR evidence recorded. |

## 12. Risks, assumptions, and unresolved decisions
### 12.1 Material risks
* **Misleading CORS remedies:** Client fetch/XHR wrappers, CDNs, and `no-cors` do not grant page-body access. A remote server must authorize CORS or deliberately furnish data through a cooperative protocol.

* **Iframe integration dependency:** A bridge must pre-exist, be embeddable, and implement validated messaging; ordinary cross-origin HTML frames are not scrapers.

* **JSONP code execution:** JSONP is arbitrary provider-supplied JavaScript within the calling document; disable by default and restrict to trusted, audited endpoints.

* **Orphan-page overclaiming:** A link crawl cannot detect wholly unlinked pages; use independent sitemap discovery and qualify findings.

* **Browser fetch limitations:** CORS, origin `null` under `file://`, robots-file access, redirects, and private-network restrictions may block or limit live URL analysis. Do not assume browser JavaScript can provide server-grade network safety or fetch arbitrary websites.

* **Website protection:** CAPTCHA, Cloudflare, robots rules, and rate limiting can prevent complete results; no bypass mechanism is in scope.

* **Graph scalability:** Force-directed graphs become cluttered and costly as size increases; cap initial runs and consider filtering/clustering later.

* **Ambiguous “depth”:** Define depth as minimum observed clicks from root, not XML nesting, folder hierarchy, or page priority.

* **Dynamic content:** Client-rendered links may be absent from retrieved HTML. Headless crawling would require a separate runtime and is not part of this front-end-only product.

### 12.2 Decisions to confirm with the product owner
1. Is the goal a **visually similar tool** ?  Yes, with very similar reference layout and behavior.

2. Should public users be able to crawl arbitrary public sites? **Desired, but constrained:** the browser may crawl only public pages whose content and robots policy it can read under CORS/browser restrictions. For all other sites, use imported XML/CSV data. No proxy or server shall be added.

3. Should XML sitemaps be used automatically, or only if the user explicitly selects that source? Yes, automatically when browser-accessible; otherwise offer local XML sitemap import.

4. Are CSV and PNG exports mandatory for the first release, or acceptable in phase 3? Make them acceptable in phase 3.

5. Should subdomains, URL query variants, and pages blocked by robots be displayed? Yes, display **known or imported** URLs with accurate blocked/unknown status, but do not fetch robots-disallowed content or imply it was analyzed.

6. Is persistent run history or sharing required, or should runs expire after a short retention period? Runs can expire.

**Working assumptions:** Build a functionally similar stand-alone tool entirely in browser-side JavaScript; distribute local static files that open via `file://`; permit but do not require version-pinned CDN libraries; use bundled copies for offline core functions; offer import as the reliable method where browser fetch is blocked; keep reference defaults and graph colors; do not clone sesen.ai branding; and treat unverified details as design decisions. Cooperative iframe/JSONP integrations may be implemented **only if compatible provider endpoints already exist**; neither is a deployment prerequisite.

### 12.3 Delivery and acceptance decisions fixed in Version 3.0

1. **P0 product:** local XML/CSV/HTML imports, CORS-permitted bounded fetch, accurate error states, provenance, graph, offline operation, and direct file launch.
2. **P1 product:** cooperative iframe transport (when an actual bridge is available), XHR compatibility adapter, pasted/multi-file inputs, hierarchy-only preview, and import UX enhancements.
3. **P2 optional:** trusted, strictly allowlisted JSONP integration; omission is the security-preferred default and shall not delay P0 acceptance.
4. **No-backend invariant:** no hosted relays, localhost servers, new provider bridge deployments, extensions, server APIs, or implicit telemetry are allowed at runtime.
5. **Proof requirement:** a release claiming live-site coverage must name which sites were actually readable in the tested browser/origin combination; generic public-site coverage is not an acceptance claim.

## 13. Reference observations and sources
**Public reference:** Sesen AI, *Free Sitemap Graph Generator and Visual Sitemap Tool*, [https://sesen.ai/sitemap-visualizer](https://sesen.ai/sitemap-visualizer) (accessed 26 October 2026). Published page identifies URL, Max Depth, Max Pages, Visualize, the depth legend, drag/click guidance, crawling and XML-sitemap capability claims, zooming, incoming/outgoing link analysis, orphan-page analysis, and PNG/CSV export claims.

**Interactive inspection:** On 26 October 2026, a browser session observed the default Max Depth **2**, Max Pages **50**, a Website URL input with https://example.com placeholder, a **Visualize** button, an empty-result prompt, and a Cloudflare human-verification container. An attempted example.com visualization with depth 2 and page cap 10 produced neither a graph nor visible error. Export controls and post-result details could not be verified in that session. This is **not evidence that the reference app never works**.

**Visual reference:** User-supplied image sitemap-graph.png (842 × 600 pixels), illustrating a black-background graph with an orange central root, green first-level hub nodes, purple second-level leaf nodes, and light link lines. It supports appearance requirements but does not establish data rules or the presence of specific buttons.

**Useful standards / technical references:**

* W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*: [https://www.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/)

* IETF RFC 9309, *Robots Exclusion Protocol*: [https://www.rfc-editor.org/rfc/rfc9309](https://www.rfc-editor.org/rfc/rfc9309)

* OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*: [https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

* Sitemaps.org, *XML Sitemap Protocol*: [https://www.sitemaps.org/protocol.html](https://www.sitemaps.org/protocol.html)

---


### 13.1 Additional browser and library sources (Version 3.0)

These references support the feasibility and library claims in the additions above. They do not alter the source document's description of the reference visualizer.

- **[S1]** MDN, *Cross-Origin Resource Sharing (CORS)* — `fetch`/XHR and response-header authorization: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS
- **[S2]** MDN, *CORS errors* — browser JavaScript often cannot distinguish detailed failure causes; avoiding preflight does not confer response access: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS/Errors
- **[S3]** MDN, *Same-origin policy* — opaque `file://` origins and cross-origin embedding versus reading: https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy
- **[S4]** MDN, *Window.postMessage()* — cross-origin messages, exact origin checking, source checking, and `file:` destination caveat: https://developer.mozilla.org/en-US/docs/Web/API/Window/postMessage
- **[S5]** D3 documentation, *Getting started* — vanilla HTML script/UMD availability: https://github.com/d3/d3/blob/main/docs/getting-started.md
- **[S6]** Cytoscape.js, *Getting started* — browser UMD distribution: https://js.cytoscape.org/
- **[S7]** Papa Parse, *Documentation* — browser CSV parsing, File API, and XHR-backed remote retrieval: https://www.papaparse.com/docs
- **[S8]** OWASP, *Web Frontend Security Cheat Sheet* — untrusted frontend data and unsafe code execution: https://cheatsheetseries.owasp.org/cheatsheets/Web_Frontend_Security_Cheat_Sheet.html
- **[S9]** JSZip documentation — browser-friendly local archive parsing: https://github.com/Stuk/jszip/blob/main/documentation/examples.md
- **[S10]** MDN, *Subresource integrity (SRI)* — pinning integrity of external CDN scripts: https://developer.mozilla.org/en-US/docs/Web/Security/Practical_implementation_guides/SRI
- **[S11]** npm package metadata — published versions of Papa Parse and JSZip: https://www.npmjs.com/package/papaparse?activeTab=versions and https://www.npmjs.com/package/jszip

---

## 14. Production readiness and traceability

### 14.1 Required release artifacts

The implementation shall ship: (a) static launchable application assets; (b) README with supported browsers and CORS limitations; (c) local sample XML/CSV/HTML fixtures; (d) requirement-to-test matrix including FR-001–065 and NFR-001–029; (e) automated and documented manual test evidence; (f) dependency/license/SRI inventory and locally bundled production scripts; (g) concise threat-model and security notes for optional cooperative integrations; and (h) export schema documentation with example page and edge records.

### 14.2 Release-blocking checks

- Double-click local `index.html` and successfully import, visualize, inspect, and export entirely offline on supported desktop browsers.
- Verify access attempts against CORS-allowed and CORS-denied fixtures, without false-positive response-body reading, hidden relays, or undocumented browser configuration changes.
- Verify 100% of P0 requirements against mapped acceptance cases; test all enabled optional transports, while explicitly excluding unshipped P1/P2 features from capability claims.
- Confirm no remote scripts are loaded from imported data; if JSONP is shipped, independently review the provider trust model and require explicit opt-in.
- Confirm each data record is labeled by source and evidence type; empty/partial coverage must not be presented as a complete site crawl.
- Confirm resource caps, cancellation, CSV injection handling, secure framing messages, accessible fallback views, and absence of remote telemetry.

### 14.3 Scope of the term “production-ready”

This specification is sufficiently detailed to implement and verify a robust local product **within browser security constraints**. It does **not** establish that production code already exists, that optional third-party cooperating endpoints exist, or that unrestricted cross-origin website crawling is possible. Those would require separate evidence and, in some cases, a different architecture.

## 15. Version history

| Version | Basis / change |
| --- | --- |
| Supplied Version 2 file | Source document internally labeled Version 1.1; baseline features, local-only constraints, graph semantics, acceptance tests AT-01–21. |
| **3.0 — 26 October 2026** | Added CORS feasibility matrix, transport adapter contract, practical vanilla JS patterns for `fetch`/XHR, cooperative iframe messaging, restricted JSONP, local HTML/paste/multi-file imports, source provenance, third-party library policy, additional FR/NFR requirements, AT-22–37, deployment structure, and release gates. |

**Document control:** Version 3.0 remains a **JavaScript-only, local `file://`-launchable, front-end-only application** with optional vetted CDN libraries and bundled offline core dependencies, **no application backend**, and **no promise of arbitrary CORS-blocked site crawling**. Browser-authorized fetching, explicitly cooperative integration, and user-supplied imports are the complete acquisition strategy.
