// Development-only AT-15 check: open exported CSVs in LibreOffice Calc with formula
// evaluation on and confirm no cell becomes a formula. Requires `soffice` on PATH.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const contracts = require('../js/contracts');
const csvImport = require('../js/csv-import');
const graphApi = require('../js/graph');
const outcomes = require('../js/outcome-report');
const exportsApi = require('../js/exports');

const hostile = ['=HYPERLINK("https://attacker.example/","click")', '+1+1', '-1+1', '@SUM(1,1)', '\t=1+1', '\r=1+1', ' =1+1', '=cmd|\' /C calc\'!A0', '%0A=1+1'];

(async () => {
  const version = spawnSync('soffice', ['--version'], { encoding: 'utf8' });
  assert.equal(version.status, 0, 'LibreOffice (soffice) is required for this optional check');
  const run = contracts.createRun({ mode: 'csv-import', rootUrl: 'https://example.test/', maxPages: 50, maxDepth: 4 });
  const text = fs.readFileSync(path.join(__dirname, '..', 'sample-data', 'four-page-links.csv'), 'utf8');
  const batch = await csvImport.importFile({ name: 'links.csv', size: Buffer.byteLength(text), text: async () => text }, run);
  const graph = graphApi.buildGraph(run, [batch]);
  const report = outcomes.create({ id: 'at15', run, result: batch, graph, durationMs: 1 });
  // Titles are free text in the pages export; put one hostile value on each page.
  const copy = { ...graph, nodes: graph.nodes.map((n, i) => ({ ...n, title: hostile[i % hostile.length] })) };
  const extra = hostile.slice(copy.nodes.length).map((title, i) => ({ ...copy.nodes[0], id: 'https://example.test/x' + i, url: 'https://example.test/x' + i, title }));
  copy.nodes = copy.nodes.concat(extra);
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitemap-at15-'));
  try {
    const files = { pages: exportsApi.csv('pages', copy, report), links: exportsApi.csv('links', graph, report) };
    const results = {};
    for (const [kind, body] of Object.entries(files)) {
      const csvPath = path.join(dir, kind + '.csv');
      fs.writeFileSync(csvPath, body);
      // Comma, double quote, UTF-8, start row 1; quoted-as-text off and evaluate formulas on (worst case).
      const filter = 'csv:Text - txt - csv (StarCalc):44,34,76,1,,1033,false,true,false,false,false,-1,true';
      const out = spawnSync('soffice', ['--headless', '-env:UserInstallation=file://' + path.join(dir, 'profile'), '--infilter=' + filter.slice(4), '--convert-to', 'fods', '--outdir', dir, csvPath], { encoding: 'utf8', timeout: 120000 });
      assert.equal(out.status, 0, out.stderr);
      const fods = fs.readFileSync(path.join(dir, kind + '.fods'), 'utf8');
      const formulas = (fods.match(/table:formula="[^"]*"/g) || []);
      assert.deepEqual(formulas, [], kind + ' contains formula cells');
      results[kind] = { cells: (fods.match(/<table:table-cell/g) || []).length, formulaCells: formulas.length };
    }
    const pagesFods = fs.readFileSync(path.join(dir, 'pages.fods'), 'utf8');
    assert.match(pagesFods, /&apos;=HYPERLINK\(&quot;https:\/\/attacker\.example\/&quot;,&quot;click&quot;\)/);
    console.log(JSON.stringify({ libreoffice: version.stdout.trim(), hostileValues: hostile.length, ...results }));
  } finally { fs.rmSync(dir, { recursive: true, force: true }); }
})().catch(error => { console.error(error); process.exit(1); });
