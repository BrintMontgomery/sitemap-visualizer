"use strict";

const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const { fileURLToPath, pathToFileURL } = require("node:url");
const { test } = require("node:test");

const projectRoot = path.resolve(__dirname, "..");
const readProjectFile = (relativePath) =>
  fs.readFileSync(path.join(projectRoot, relativePath), "utf8");

test("the direct-file entry point uses local stylesheet and deferred classic script", () => {
  const html = readProjectFile("index.html");
  const indexFileUrl = pathToFileURL(path.join(projectRoot, "index.html"));
  const stylesheetTags = [...html.matchAll(/<link\b[^>]*rel=["']stylesheet["'][^>]*>/gi)];
  const scriptTags = [...html.matchAll(/<script\b[^>]*src=["']([^"']+)["'][^>]*>/gi)];

  assert.equal(stylesheetTags.length, 1, "one local stylesheet should be loaded");
  assert.equal(scriptTags.length, 10, "contracts, graph and renderer load before run controls");
  assert.equal(scriptTags[0][1], "js/contracts.js");
  assert.equal(scriptTags[1][1], "js/csv-import.js"
  );
  assert.equal(scriptTags[2][1], "js/xml-import.js");
  assert.equal(scriptTags[3][1], "js/html-import.js");
  assert.equal(scriptTags[4][1], "js/fetch-adapter.js");
  assert.equal(scriptTags[5][1], "js/graph.js");
  assert.equal(scriptTags[6][1], "js/graph-renderer.js");
  assert.equal(scriptTags[7][1], "js/page-details.js");
  assert.equal(scriptTags[8][1], "js/app.bundle.js");
  assert.equal(scriptTags[9][1], "js/run-controls.js");
  assert.match(stylesheetTags[0][0], /href=["']css\/styles\.css["']/i);
  assert.match(scriptTags[0][0], /defer(?:\s|>)/i);
  assert.doesNotMatch(scriptTags[0][0], /type=["']module["']/i);

  const references = [
    stylesheetTags[0][0].match(/href=["']([^"']+)["']/i)[1],
    ...scriptTags.map((tag) => tag[1]),
  ];
  for (const reference of references) {
    const resolved = new URL(reference, indexFileUrl);
    assert.equal(resolved.protocol, "file:");
    assert.ok(fs.existsSync(fileURLToPath(resolved)), `missing local asset: ${reference}`);
  }
});

test("the shell exposes a semantic main landmark and a labeled empty state", () => {
  const html = readProjectFile("index.html");

  assert.match(html, /<main\b[^>]*id=["']main-content["']/i);
  assert.match(html, /<section\b[^>]*aria-labelledby=["']map-title["']/i);
  assert.match(html, /id=["']empty-state["'][^>]*role=["']region["']/i);
  assert.match(html, /<h2\b[^>]*id=["']empty-state-title["'][^>]*>No pages to display<\/h2>/i);
  assert.match(html, /id=["']application-status["'][^>]*role=["']status["'][^>]*aria-live=["']polite["']/i);
  assert.doesNotMatch(html, /This is only a test|example loaded JavaScript/i);
});

test("the classic script announces a ready shell without requiring optional DOM nodes", () => {
  const script = readProjectFile("js/app.bundle.js");
  const classes = new Set();
  const status = {
    textContent: "",
    classList: { add: (name) => classes.add(name) },
  };
  const documentElement = { dataset: {} };
  const document = {
    documentElement,
    getElementById: (id) => (id === "application-status" ? status : null),
  };

  vm.runInNewContext(script, { document });
  assert.equal(documentElement.dataset.appReady, "true");
  assert.equal(status.textContent, "Application shell ready. No sitemap data has been loaded.");
  assert.ok(classes.has("is-ready"));

  const missingStatusDocument = {
    documentElement: { dataset: {} },
    getElementById: () => null,
  };
  assert.doesNotThrow(() => vm.runInNewContext(script, { document: missingStatusDocument }));
});

test("offline fixtures describe the same four-page .test site", () => {
  const csv = readProjectFile("sample-data/four-page-links.csv").trim().split(/\r?\n/);
  const sitemap = readProjectFile("sample-data/four-page-sitemap.xml");
  const page = readProjectFile("sample-data/home-page.html");
  const csvPairs = csv.slice(1).map((row) => row.split(","));
  const csvPages = new Set(csvPairs.flat());
  const sitemapPages = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
  const htmlLinks = [...page.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>/gi)].map((match) => match[1]);

  assert.equal(csv[0], "source,target");
  assert.equal(csvPairs.length, 4);
  assert.equal(csvPages.size, 4);
  assert.ok([...csvPages].every((url) => new URL(url).hostname === "example.test"));
  assert.deepEqual([...new Set(sitemapPages)].sort(), [...csvPages].sort());
  assert.deepEqual(htmlLinks.map((href) => new URL(href, "https://example.test/").href), [
    "https://example.test/about",
    "https://example.test/contact",
  ]);
  assert.doesNotMatch(page, /<script\b|<iframe\b|<img\b/i);
});

test("the application has no third-party runtime package or remote asset requirement", () => {
  const html = readProjectFile("index.html");
  const css = readProjectFile("css/styles.css");
  const packageJson = JSON.parse(readProjectFile("package.json"));

  assert.equal(packageJson.dependencies, undefined);
  assert.deepEqual(packageJson.devDependencies, { jsdom: "26.1.0" }, "DOM test tools are development-only");
  assert.doesNotMatch(html, /<(?:script|link)\b[^>]*(?:https?:)?\/\//i);
  assert.doesNotMatch(css, /@import\s+[^;]*https?:\/\//i);
  assert.match(readProjectFile("THIRD_PARTY_NOTICES.md"), /no third-party runtime libraries/i);
});
