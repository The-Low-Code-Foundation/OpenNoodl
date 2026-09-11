/**
 * HLS-011 step 6 — the control the whole phase turns on, graded.
 *
 * The container built the app's own React and read it back through `react-dom/server`. This reads
 * the SAME project through the **viewer** — the runtime the editor draws with — and compares.
 *
 * 🔴 Two renderers, one project. The exporter translates the graph into React and a compiler builds
 * it; the viewer interprets the graph directly. Agreement is HLS-003's claim verified from the far
 * end. Disagreement is either a refusal the export made out loud, or a defect row — and this script
 * decides which by reading `EXPORT-REPORT.md`, so a silent disagreement cannot pass as a named one.
 *
 * ⚠️ Runs on the host: it needs Chrome and the viewer bundle, which is exactly what `nodegx render`
 * exits 8 for in the container. That refusal and this reading are the same fact from two sides.
 */
import * as fs from 'node:fs';
import * as path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const REPO = '/Users/richardosborne/vscode_projects/OpenNoodl';
const { withRenderedPage } = require(path.join(REPO, 'scripts/devtools/render-report.js'));

const projectDir = process.argv[2];
const containerResult = process.argv[3];
const appModule = process.argv[4];
if (!projectDir || !containerResult || !appModule) {
  throw new Error('usage: host-compare.mjs <projectDir> <container result.json> <app.mjs url>');
}
const app = await import(appModule);
const container = JSON.parse(fs.readFileSync(containerResult, 'utf8'));
const builtPages = container.builtPages || {};
const exportReport = fs.readFileSync(path.join(path.dirname(containerResult), 'export', 'EXPORT-REPORT.md'), 'utf8');

const READ = `(function () {
  return JSON.stringify({
    title: document.title,
    text: document.body ? document.body.innerText : '',
    widths: Array.prototype.map.call(document.querySelectorAll('.gauge-bar'), function (el) {
      return { inline: el.style.width || null, computed: getComputedStyle(el).width, offset: el.offsetWidth };
    })
  });
})()`;

const seen = await withRenderedPage({ projectDir }, async (page) => {
  const out = {};
  for (const urlPath of ['/home', '/readings']) {
    await page.navigate(urlPath);
    await new Promise((r) => setTimeout(r, 2000));
    out[urlPath] = JSON.parse(await page.evaluate(READ));
    // C74's lesson: read the URL BACK. A route that redirects is measured as what it became, and a
    // report that files it under the name it was asked for has been wrong in silence.
    out[urlPath].urlAfter = await page.evaluate('window.location.href');
  }
  return out;
});

const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
/** The built page's text as the container read it, with the document title stripped off the front. */
const builtText = (file, title) => norm(builtPages[file]?.text || '').replace(new RegExp('^' + title + '\\s*'), '');

const report = { projectDir, agree: true, pages: {}, refusalNamedInReport: null, failures: [] };
for (const [urlPath, v] of Object.entries(seen)) {
  const key = urlPath.replace('/', '');
  const file = key === 'home' ? 'Home.tsx' : 'Readings.tsx';
  const expected = app.EXPECTED[key];
  const viewerText = norm(v.text);
  const reactText = builtText(file, key === 'home' ? app.HOME_TITLE : app.READINGS_TITLE);
  const row = {
    title: v.title,
    viewerText,
    reactText,
    textsAgree: viewerText === reactText,
    urlAfter: v.urlAfter,
    urlIsWhatWasAsked: String(v.urlAfter).endsWith(urlPath),
    missingFromViewer: expected.filter((e) => !viewerText.includes(e)),
    missingFromReact: expected.filter((e) => !reactText.includes(e)),
    gaugeBarWidths: v.widths
  };
  report.pages[key] = row;
  if (!row.textsAgree) report.failures.push(`${key}: the viewer and the built app do not say the same thing`);
  if (row.missingFromViewer.length) report.failures.push(`${key}: viewer missing ${row.missingFromViewer.join(', ')}`);
  if (row.missingFromReact.length) report.failures.push(`${key}: built app missing ${row.missingFromReact.join(', ')}`);
  if (!row.urlIsWhatWasAsked) report.failures.push(`${key}: the URL moved — ${row.urlAfter}`);
}

// The one place they are allowed to differ: a width the viewer applies and the export refused.
const viewerWidths = Object.values(report.pages).flatMap((p) => p.gaugeBarWidths.map((w) => w.inline));
const reactWidths = Object.values(app.EXPECTED).length && /width/.test(builtPages['Home.tsx']?.html || '');
report.widthDivergence = {
  viewerAppliesInlineWidths: viewerWidths.filter(Boolean),
  expectedFromTheGraph: Object.values(app.GAUGES).map(([, w]) => `${w}%`),
  builtAppAppliesAny: reactWidths
};
// 🔴 A divergence is only acceptable if the export SAID so. Read the report, do not assume it.
report.refusalNamedInReport = /has no rendered sink on Group/.test(exportReport)
  ? (exportReport.match(/^- wire into .*$/m) || [null])[0]
  : null;
if (viewerWidths.filter(Boolean).length > 0 && !reactWidths && !report.refusalNamedInReport) {
  report.failures.push('the two renderers disagree on width and EXPORT-REPORT.md does not say so');
}
report.agree = report.failures.length === 0;
console.log(JSON.stringify(report, null, 2));
fs.writeFileSync(path.join(path.dirname(projectDir), 'viewer.json'), JSON.stringify(report, null, 2));
process.exit(report.agree ? 0 : 1);
