# **Sitemap Visualizer — Software Requirements Specification**

**Version:** 1.0 (baseline for implementation)  
**Prepared:** 26 October 2026  
**Reference application:** [https\://sesen.ai/sitemap-visualizer](https://sesen.ai/sitemap-visualizer)  
**Reference image:** User-provided sitemap-graph.png  
**Status:** Proposed implementation specification; not a claim about the reference application's source code or internal architecture.

## **1\. Executive summary**

Develop a browser-based **Sitemap Visualizer** that accepts a public website URL, discovers its pages and internal hyperlinks, and renders a navigable, color-coded graph of the site's information architecture. A user can control crawl breadth with a maximum page count and depth, inspect individual pages and their incoming/outgoing links, reposition and zoom graph nodes, and export the results as a PNG image or CSV datasets.

The visual reference shows an **orange homepage at the center**, **green first-level pages**, **purple second-level pages**, and thin connecting lines on a **black graph canvas**. The live site explicitly displays the homepage/depth 1/depth 2/depth 3+ legend, URL/depth/page controls, and guidance for dragging and clicking nodes. Its page text describes XML-sitemap support, homepage crawling, link analysis, orphan-page detection, zooming, and PNG/CSV export. During a browser inspection on 26 October 2026, submission of https\://example.com did not generate a graph or an error, so those post-submit behaviors were **not independently verified**.

This document translates the reference into testable requirements for a new application. It is **not a pixel-perfect reproduction mandate** and does not assume access to proprietary implementation details.

![][image1]

*Figure 1\. User-provided example output; appearance reference only.*

## **2\. Evidence, conventions, and priority**

### **2.1 Evidence classification**

| Code | Meaning | Basis |
| :---- | :---- | :---- |
| OBS | Directly observed | Published live controls, labels, legend, or supplied output image. |
| ADV | Advertised by the reference | Function described in the reference page's published explanatory text but not verified interactively. |
| DES | Proposed design requirement | New or clarified behavior specified here so developers can implement and test it. |

### **2.2 Priority convention**

| Priority | Meaning |
| :---- | :---- |
| P0 — Must | Required for initial working release. |
| P1 — Should | Strongly recommended for release quality; may follow an MVP. |
| P2 — Could | Enhancement for later iteration. |

Unless otherwise stated, **“shall” denotes a normative, testable requirement**. Numeric service objectives are **proposed targets**, not observed characteristics of sesen.ai.

## **3\. Product goals, users, and scope**

### **3.1 Product goals**

1. Make website structure intelligible without requiring users to read XML or navigate every page manually.

2. Surface crawl depth, hubs, isolated clusters, and gaps in the observed internal-link network.

3. Support SEO review, content inventories, migration planning, and information-architecture analysis.

4. Produce portable visual and machine-readable outputs for later analysis.

### **3.2 Primary user roles**

* **Site analyst / SEO specialist:** evaluates internal links, depth, and discoverability.

* **Information architect / developer:** understands navigation, dependencies, and redesign impact.

* **Content owner / project manager:** reviews sections and exports a shareable map.

* **Public visitor:** runs an authorized, bounded analysis of a public website without an account (proposed MVP).

### **3.3 In scope**

Public HTTP/HTTPS websites; URL entry and validation; bounded site discovery through HTML links and XML sitemaps; canonical URL handling; directed internal-link graph; interactive visual exploration; page-detail inspection; basic structural metrics; error and partial-result reporting; PNG and CSV export; security and accessibility controls.

### **3.4 Out of scope for the initial release**

Authentication to crawl private websites; bypassing CAPTCHA or anti-bot controls; unauthorized content access; full browser execution of every JavaScript application; large-scale enterprise crawling; editing the source website; comprehensive SEO auditing (e.g., Core Web Vitals); automatic repair of broken links; guarantees that every page or “orphan” on a domain has been found.

## **4\. Conceptual workflow**

1. The user opens the visualizer and sees the input controls, legend, and an empty graph canvas.

2. The user supplies a public website URL and selects **Max Depth** and **Max Pages**.

3. The user activates **Visualize**. The application validates the target and security policy.

4. The server searches for a usable XML sitemap and/or crawls in-domain hyperlinks from the homepage, subject to configured limits and site policies.

5. The server normalizes discovered URLs, classifies page nodes by shortest-click distance from the homepage, and constructs directed links.

6. The client displays an interactive graph, coverage metrics, warnings, and a details panel for selected pages.

7. The user pans, zooms, drags nodes, and optionally exports an image or data files.

8. If limits, timeouts, access restrictions, or parsing failures affect completeness, the interface reports a **partial** result rather than implying complete coverage.

## **5\. Functional requirements**

### **5.1 Input and job control**

| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-001 | The system shall provide a labeled **Website URL** input accepting public HTTP/HTTPS homepage URLs and direct XML sitemap URLs. | P0 | OBS / ADV |
| FR-002 | The interface shall expose **Max Depth** and **Max Pages** controls, initialized to **2** and **50** respectively. Values shall be selectable and constrained to a documented allowed range. | P0 | OBS / DES |
| FR-003 | The **Visualize** command shall validate the URL, show field-specific errors, and prevent duplicate submissions during an active job. | P0 | OBS / DES |
| FR-004 | Each run shall show its state (queued, running, complete, partial, failed, or cancelled) with visible status feedback. | P0 | DES |
| FR-005 | The user shall be able to cancel a running analysis; the client shall not present cancelled work as a completed map. | P1 | DES |
| FR-006 | A new run shall clear or explicitly replace the prior run's graph and metrics. | P0 | DES |

**Clarifications:** A placeholder resembling https\://example.com must not be interpreted as a submitted value unless the user enters it. The observed page showed selectable settings, but the complete menu ranges were not exhaustively verified; an implementer may use depths **0–4** and page caps **10, 25, 50, 100, 250** as a proposed configuration, provided the defaults match the reference. A depth of **0** means the homepage only.

### **5.2 Sitemap discovery and crawling**

| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-007 | For a homepage input, the system shall support bounded discovery by following permitted in-scope internal \<a href\> links. | P0 | ADV |
| FR-008 | The system shall attempt XML sitemap discovery via robots.txt Sitemap: directives and conventional sitemap locations; it shall accept explicit sitemap URLs. | P1 | ADV / DES |
| FR-009 | The parser shall support urlset and sitemapindex, including nested sitemap references within limits. | P1 | DES |
| FR-010 | The crawler shall normalize HTTP(S) URLs, resolve relative links, remove fragments, and deduplicate page identities according to a documented canonicalization policy. | P0 | DES |
| FR-011 | Crawling shall honor the maximum page cap, maximum link-depth cap, time budget, redirect budget, response-size limits, and allowed target scope. | P0 | OBS / DES |
| FR-012 | The crawler shall respect applicable robots.txt restrictions and apply rate limiting and timeouts to avoid overloading target sites. | P0 | DES |
| FR-013 | The crawler shall record HTTP status, redirect destination, source of discovery, and failure reason when available. | P1 | DES |
| FR-014 | The engine shall calculate each discovered page's **minimum observed hyperlink distance** from the homepage by breadth-first search, rather than URL-folder depth. | P0 | OBS / DES |
| FR-015 | The engine shall preserve directed edges between discovered pages, including multiple navigation paths and cross-links; duplicates between the same source and target shall be collapsed for graph rendering. | P0 | ADV / DES |
| FR-016 | Results shall disclose when page caps, depth limits, blocked pages, robots rules, or network errors have truncated the graph. | P0 | DES |

**Discovery semantics:** If a user submits an XML sitemap, its URLs are treated as candidate pages; the system may fetch permitted page content to learn actual hyperlinks. A sitemap's inclusion of a URL **does not prove a hyperlink exists**. Consequently, sitemap membership and observed hyperlinks must be stored separately. For internal-link analysis, default scope is the normalized input hostname; alternate subdomain inclusion is a future configurable option.

### **5.3 Interactive graph visualization**

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

### **5.4 Analysis and export**

| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-027 | The system shall calculate observed in-degree, out-degree, minimum crawl depth, and connected components for the included graph. | P1 | ADV / DES |
| FR-028 | The system shall identify **candidate orphan pages** only where it has a discovery source beyond homepage hyperlink traversal (e.g., XML sitemap) and the candidate has zero observed inbound links in the analyzed corpus. | P1 | ADV / DES |
| FR-029 | The interface shall qualify orphan findings as **candidates** when crawling is incomplete, blocked, or bounded; it shall not claim global proof of orphan status. | P0 | DES |
| FR-030 | The user shall be able to export the current graph view to a readable **PNG**, including node colors and a legend or equivalent explanatory key. | P1 | ADV |
| FR-031 | The user shall be able to export a **pages CSV** and a **links CSV** with stable identifiers, URLs, depths, and link endpoints; exports shall indicate whether the analysis was partial. | P1 | ADV / DES |
| FR-032 | PNG and CSV export actions shall be offered after analysis is complete or partial, and shall report an actionable failure if export cannot be produced. | P1 | DES |

**Orphan-page constraint:** A homepage-only crawler cannot discover pages that have no navigable path from that homepage. An XML sitemap, externally supplied list, or other independent inventory is therefore necessary to propose such pages as orphans. The application must also distinguish pages with **no observed inbound links** from pages with **no inbound links anywhere on the internet**.

### **5.5 Error handling and transparency**

| ID | Requirement | Priority | Basis |
| :---- | :---- | :---- | :---- |
| FR-033 | Invalid URLs, blocked hosts, unsupported protocols, robots exclusions, timeouts, excessive redirects, rate limits, malformed XML, and empty results shall each produce a clear human-readable result state. | P0 | DES |
| FR-034 | No-response scenarios shall not silently leave the user on the initial empty-canvas prompt; the app shall show an error, retry option, or explicit request state. | P0 | DES |
| FR-035 | The user shall see the effective input URL, limits, crawl timestamp, and completion/truncation status alongside each result. | P1 | DES |
| FR-036 | Security challenges shall not be bypassed; where a permitted crawl cannot proceed, the app shall explain the access limitation. | P0 | DES |

## **6\. Visual and interaction specification**

### **6.1 Layout regions**

| Region | Elements | Behavior |
| :---- | :---- | :---- |
| Configuration | Website URL; Max Depth; Max Pages; Visualize | Persistent, labeled controls with help text. |
| Job feedback | Progress, run status, page counts, warnings | Visible throughout a run; distinguish partial and failed outcomes. |
| Graph viewport | Dark canvas; color-coded nodes; directional links | Pan, zoom, select, drag, fit, reset. |
| Legend | Homepage / depth 1 / depth 2 / depth 3+ | Remains visible and color/shape accessible. |
| Details | Selected URL, depth, title, status, inbound/outbound links | Display on selection; dismiss or change selection. |
| Results/export | Counts, coverage note, PNG, CSV | Available following a usable run. |

### **6.2 Visual acceptance guidance**

* Use the attached screenshot as the **graph-style exemplar**, not as proof of exact layout mathematics or fixed pixel sizes.

* Root/homepage: orange and visibly larger than ordinary leaves; depth-one hubs: green; depth-two leaves: purple; deeper nodes: red.

* Connections: thin, high-contrast lines; add arrowheads or selected-edge directional indication so link direction is understandable.

* Keep drag and selection distinct (click should select; sustained pointer movement should drag).

* Maintain minimum contrast and offer non-color labels or descriptions; color alone may not carry the depth information.

* Show a concise label only when legible; tooltips/details preserve complete URLs.

## **7\. Data model and processing rules**

### **7.1 Logical entities**

| Entity | Essential fields |
| :---- | :---- |
| CrawlRun | run\_id, input\_url, effective\_root, max\_depth, max\_pages, status, started\_at, completed\_at, truncated, warnings |
| PageNode | node\_id, normalized\_url, title, depth, http\_status, discovered\_by, fetched, in\_degree, out\_degree |
| LinkEdge | source\_node\_id, target\_node\_id, link\_type=html, observed\_at |
| SitemapMembership | node\_id, source\_sitemap\_url, lastmod (if provided) |
| CrawlIssue | run\_id, url, issue\_code, message, phase, retryable |
| LayoutState | run\_id, node\_id, x, y, pinned (client state) |

### **7.2 Deterministic rules**

1. **Root:** Treat the final permitted effective homepage URL as the graph root; retain original input separately.

2. **URL normalization:** Resolve relative URLs; normalize scheme/host case; remove fragments; normalize default ports and redundant path segments; preserve meaningful query parameters unless configured otherwise. Document treatment of trailing slashes and www aliases.

3. **Identity:** Two identical normalized URLs correspond to one node. Redirect targets are associated with their final normalized destination, retaining redirect history.

4. **Depth:** Shortest directed path length from homepage along **observed** HTML links, calculated by breadth-first traversal; homepage depth \= 0\. A sitemap-only URL with no observed route from home has depth null and an unreachable\_in\_observed\_graph flag, rather than a misleading depth.

5. **Page cap:** Maximum pages limits unique fetch targets counted against the run. If an outbound URL was discovered but excluded by the cap, count it as excluded metadata, not as a fully analyzed page.

6. **Edge semantics:** Only actual observed page hyperlinks create LinkEdge records. Sitemap membership, redirect relations, and URL hierarchy are separate relations.

7. **Counts:** A page's in/out-degree counts distinct included source/target nodes, not raw occurrences of repeated navigation links.

8. **Partiality:** Any aborted, capped, restricted, or timeout-affected discovery shall mark results partial or attach a material coverage warning.

### **7.3 Example API contract (suggested, not observed)**

POST /api/crawls  
  { "url": "https\://example.org", "maxDepth": 2, "maxPages": 50 }  
  \-\> 202 { "runId": "...", "status": "queued" }

GET /api/crawls/{runId}  
  \-\> { "status": "running\|complete\|partial\|failed\|cancelled",  
       "progress": { "pagesFetched": 12, "pagesLimit": 50 },  
       "warnings": \[\] }

GET /api/crawls/{runId}/graph  
  \-\> { "rootNodeId": "...", "nodes": \[...\], "edges": \[...\],  
       "coverage": { "truncated": false, "depthLimit": 2 } }

POST /api/crawls/{runId}/cancel  
GET /api/crawls/{runId}/export/pages.csv  
GET /api/crawls/{runId}/export/links.csv

A PNG may be exported client-side from the currently visible SVG/canvas. If generated server-side, its export endpoint shall use the same run identifiers and content authorization as the graph data.

## **8\. Nonfunctional requirements**

| ID | Requirement / proposed measurable target | Priority |
| :---- | :---- | :---- |
| NFR-001 | **Security / SSRF:** reject non-HTTP(S) schemes; loopback, link-local, cloud-metadata, and revalidate on every DNS resolution and redirect. | P0 |
| NFR-002 | **Network safety:** bound redirect hops, DNS time, total download bytes, HTML/XML size, XML expansion, crawl concurrency, per-host rate, and total job duration. | P0 |
| NFR-003 | **Robots and site policy:** implement a documented crawler user-agent. | P0 |
| NFR-004 | **Isolation:** fetch untrusted HTML/XML in a constrained server-side environment; never execute remote page scripts in the visualizer's own security origin. | P0 |
| NFR-005 | **Injection safety:** render URLs, titles, and link text as escaped text; sanitize downloaded file names and CSV cells against spreadsheet-formula injection. | P0 |
| NFR-006 | **Access control and abuse:** rate-limit anonymous submissions, enforce per-job resource budgets, and use bot mitigation when warranted; do not rely on an unverified challenge succeeding silently. | P0 |
| NFR-007 | **Accessibility:** target WCAG 2.2 AA for the controls, details, status messages, and keyboard-accessible alternatives to graph manipulation. | P0 |
| NFR-008 | **Browser support:** support current desktop Chrome, Edge, Firefox provide reasonable tablet behavior. | P1 |
| NFR-009 | **Performance (proposed):** for a healthy, low-latency public site, target median completion under 30 seconds for 50 pages and depth 2, excluding target throttling. Measure separately from UI render time. | P1 |
| NFR-010 | **Graph responsiveness (proposed):** display and pan a 250-node/1,000-edge result responsively on a mainstream desktop; target initial graph layout under 5 seconds after graph data arrives. | P1 |
| NFR-011 | **Reliability:** requests that fail shall resolve to a terminal error state with diagnostic reason rather than an indefinitely blank or busy interface. | P0 |
| NFR-012 | **Privacy:** avoid storing page bodies by default; retain metadata only as needed, apply automatic expiration, disclose retention, and avoid logging tokens/credentials in URLs. | P0 |
| NFR-013 | **Observability:** record run latency, page/error counts, cap hits, per-phase failures, and aggregate resource usage without exposing sensitive query parameters. | P1 |
| NFR-014 | **Reproducibility:** record crawl inputs, normalization/version policy, and a timestamp; exported data must identify the run and any known truncation. | P1 |

## **9\. Suggested architecture and delivery boundaries**

**Client layer:** Accessible URL form, status and error interface, interactive force-directed graph renderer (SVG or Canvas), details view, keyboard-friendly data table, exports, and optional layout persistence for the current session.

**API layer:** Validate inputs, enforce allowed URL patterns and quotas, create runs, expose status and graph data, and manage cancellation/export requests.

**Crawler worker:** Resolve DNS safely, enforce SSRF and redirect restrictions, fetch and parse HTML/XML, canonicalize URLs, schedule bounded BFS fetches, record edges and issues, and calculate crawl coverage.

**Data/processing layer:** Run metadata, deduplicated page/link records, depth and metrics computation, expiring job storage, and structured logs.

**Design decision:** Graph layout belongs in the client; discovery and fetch security belong on the server. Client-side scraping alone is unreliable because of cross-origin restrictions and should not be the sole crawling method.

## **10\. Acceptance criteria and verification cases**

| Test ID | Scenario | Expected result | Traces |
| :---- | :---- | :---- | :---- |
| AT-01 | Load the app with no input | URL, Max Depth \= 2, Max Pages \= 50, legend, and empty-state guidance visible. | FR-001–003, FR-018 |
| AT-02 | Submit invalid URL (javascript: or malformed host) | No crawl; actionable validation message. | FR-003, NFR-001 |
| AT-03 | Submit a permitted 4-page site with known edges | Four unique nodes and matching directed edges; correct depth by shortest link path. | FR-007, FR-010, FR-014–018 |
| AT-04 | Configure depth 1 for a site with deeper pages | Root and first-hop included; deeper pages not fetched as included nodes; depth-cap warning. | FR-011, FR-016 |
| AT-05 | Configure page cap 10 on a 30-page fixture | At most ten fetch targets, accurate partiality/count metadata. | FR-011, FR-016 |
| AT-06 | Crawl a fixture with duplicate links, fragments, and redirects | URLs deduplicated; distinct page-level edges counted once. | FR-010, FR-015 |
| AT-07 | Parse a valid sitemap index and a sitemap-only URL | Sitemap membership visible separately; no fabricated HTML link or depth. | FR-008–009, FR-028–029 |
| AT-08 | Inspect and drag a node | Details show correct metadata; node remains pinned; zoom/pan/fit functions work. | FR-020–023 |
| AT-09 | Load supplied screenshot's approximate topology as test fixture | Orange central root, green hub nodes, purple leaves, thin visible edges on dark canvas. | FR-017–019 |
| AT-10 | Export after a completed run | PNG captures current graph; pages/links CSVs have headers, stable IDs, and correctly quoted values. | FR-030–032 |
| AT-11 | Test orphan logic with a sitemap-only unlinked page | Page flagged as **candidate orphan**; no claim of globally proven orphan status. | FR-028–029 |
| AT-12 | Target inaccessible site / robots-blocked path / request timeout | Terminal error or explicitly partial outcome; no silent empty canvas. | FR-033–036, NFR-011 |
| AT-13 | Attempt to crawl a private IP, metadata endpoint, or redirect to one | Request is rejected before unsafe network access. | NFR-001–002 |
| AT-14 | Navigate by keyboard and assistive technology | Form, actions, statuses, page table, and selected node details remain usable without pointer-only interaction. | FR-026, NFR-007 |
| AT-15 | Verify CSV injection protection using cell beginning \=HYPERLINK(...) | Exported cells cannot execute a spreadsheet formula when opened in common spreadsheet applications. | NFR-005 |

**Release gate:** Every P0 requirement must have passing automated or documented manual evidence. P1 requirements should be tracked explicitly and may be released behind a feature flag where appropriate.

## **11\. Suggested implementation phases**

| Phase | Scope | Exit criterion |
| :---- | :---- | :---- |
| 1\. Secure discovery core | URL validation, robots checks, bounded HTML crawl, URL deduplication, depth and directed-edge computation. | AT-02 through AT-06 and AT-13 pass on controlled test websites. |
| 2\. Interactive MVP | Input/settings, jobs and errors, dark graph, depth legend, node details, drag/zoom/pan/fit. | AT-01, AT-03, AT-08, AT-09, and AT-12 pass. |
| 3\. Data completeness and export | XML sitemap support, candidate orphan analysis, PNG and CSV export, partiality explanations. | AT-07, AT-10, AT-11, and AT-15 pass. |
| 4\. Hardening and release | Accessibility, performance testing, privacy/retention, operational metrics, cross-browser QA. | P0 release gate satisfied; NFR performance/accessibility evidence recorded. |

## **12\. Risks, assumptions, and unresolved decisions**

### **12.1 Material risks**

* **Orphan-page overclaiming:** A link crawl cannot detect wholly unlinked pages; use independent sitemap discovery and qualify findings.

* **SSRF / network abuse:** Public URL fetch is a security-sensitive service; require server-side network guards and bounded resources.

* **Website protection:** CAPTCHA, Cloudflare, robots rules, and rate limiting can prevent complete results; no bypass mechanism is in scope.

* **Graph scalability:** Force-directed graphs become cluttered and costly as size increases; cap initial runs and consider filtering/clustering later.

* **Ambiguous “depth”:** Define depth as minimum observed clicks from root, not XML nesting, folder hierarchy, or page priority.

* **Dynamic content:** Client-rendered links may be absent from HTTP-only HTML; optionally provide a permitted headless-browser discovery mode later.

### **12.2 Decisions to confirm with the product owner**

1. Is the goal a **visually similar tool** ?  Yes, with very similar reference layout and behavior.

2. Should public users be able to crawl arbitrary public sites? Yes, crawl arbitrary public sites.

3. Should XML sitemaps be used automatically, or only if the user explicitly selects that source? Yes, used when available.

4. Are CSV and PNG exports mandatory for the first release, or acceptable in phase 3? Make them acceptable in phase 3\.

5. Should subdomains, URL query variants, and pages blocked by robots be displayed? Yes, display them.

6. Is persistent run history or sharing required, or should runs expire after a short retention period? Runs can expire.

**Working assumptions:** Build a functionally equivalent stand-alone tool, favor safe anonymous public-site analysis, keep the observed default controls and graph colors, do not clone sesen.ai branding, and treat unverified details as design decisions.

## **13\. Reference observations and sources**

**Public reference:** Sesen AI, *Free Sitemap Graph Generator and Visual Sitemap Tool*, [https\://sesen.ai/sitemap-visualizer](https://sesen.ai/sitemap-visualizer) (accessed 26 October 2026). Published page identifies URL, Max Depth, Max Pages, Visualize, the depth legend, drag/click guidance, crawling and XML-sitemap capability claims, zooming, incoming/outgoing link analysis, orphan-page analysis, and PNG/CSV export claims.

**Interactive inspection:** On 26 October 2026, a browser session observed the default Max Depth **2**, Max Pages **50**, a Website URL input with https\://example.com placeholder, a **Visualize** button, an empty-result prompt, and a Cloudflare human-verification container. An attempted example.com visualization with depth 2 and page cap 10 produced neither a graph nor visible error. Export controls and post-result details could not be verified in that session. This is **not evidence that the reference app never works**.

**Visual reference:** User-supplied image sitemap-graph.png (842 × 600 pixels), illustrating a black-background graph with an orange central root, green first-level hub nodes, purple second-level leaf nodes, and light link lines. It supports appearance requirements but does not establish data rules or the presence of specific buttons.

**Useful standards / technical references:**

* W3C, *Web Content Accessibility Guidelines (WCAG) 2.2*: [https\://www\.w3.org/TR/WCAG22/](https://www.w3.org/TR/WCAG22/)

* IETF RFC 9309, *Robots Exclusion Protocol*: [https\://www\.rfc-editor.org/rfc/rfc9309](https://www.rfc-editor.org/rfc/rfc9309)

* OWASP, *Server-Side Request Forgery Prevention Cheat Sheet*: [https\://cheatsheetseries.owasp.org/cheatsheets/Server\_Side\_Request\_Forgery\_Prevention\_Cheat\_Sheet.html](https://cheatsheetseries.owasp.org/cheatsheets/Server_Side_Request_Forgery_Prevention_Cheat_Sheet.html)

* Sitemaps.org, *XML Sitemap Protocol*: [https\://www\.sitemaps.org/protocol.html](https://www.sitemaps.org/protocol.html)

---

**Document control:** This specification identifies the **observable reference design**, the **published feature claims**, and the **proposed implementation contract**. Engineering acceptance should use the stated requirements and test cases, not assumptions about the reference site's inaccessible internals.
