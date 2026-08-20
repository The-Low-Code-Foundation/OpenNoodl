#!/usr/bin/env node
/**
 * Render a v2 project from disk and print what it actually looks like.
 *
 * Usage:
 *   node scripts/devtools/measure-from-disk.js <project-dir> [options]
 *
 *   --json                   the full report as JSON on stdout, nothing else
 *   --inline-screenshots     with --json, include the PNGs as base64 in it
 *   --out <prefix>           write <prefix>-<viewport>.png (default: no files)
 *   --viewports <list>       "desktop,phone" or "1280x900,390x844"
 *   --screenshot <mode>      full | viewport | none        (default: full)
 *   --scale <n>              screenshot scale              (default: 0.5)
 *   --backend-port <n>       proxy /__backend to this port
 *   --page <path>            measure ONLY this page, by its urlPath ("quiz",
 *                            "/quiz", "#quiz" or the component name; "/" is the
 *                            start page). A path no router registers is a usage
 *                            error, not an empty report (EL-009 AC3).
 *   --editor-tokens          mirror a running editor's tokens instead of the
 *                            project's own (see render-from-disk.js — this is a
 *                            way to measure the wrong palette, not a default)
 *
 * The predecessor of this script (`dev-docs/tasks/phase-55-.../measurements/
 * measure-project.js`) hardcoded the repo path, two ports and the Chrome binary,
 * so it ran on exactly one machine. Everything it measured is here; nothing it
 * assumed is.
 */
const fs = require('fs');
const { renderReport, parseViewports } = require('./render-report');

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--out', '--viewports', '--screenshot', '--scale', '--backend-port', '--page']);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const projectDir = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
const asJson = argv.includes('--json');

/** Shared with `scroll-probe.js` — see `render-report.js`. Exit 2 stays a usage error. */
function viewportsOrExit(spec) {
  try {
    return parseViewports(spec);
  } catch (e) {
    if (!e.usage) throw e;
    console.error(e.message);
    process.exit(2);
  }
}

function printHuman(report, files) {
  console.log(`${report.projectName}  —  ${report.summary}`);
  console.log(`  tokens: ${report.tokens}   ${report.durationMs}ms`);
  for (const [name, v] of Object.entries(report.viewports)) {
    console.log(
      `  ${name.padEnd(8)} ${v.requested.width}px → layout ${v.layoutWidth}px, page ${v.pageHeight}px, ` +
        `${v.text.elements} texts / ${v.text.distinctFontSizes} sizes / weights ${Object.keys(v.text.fontWeights).join('+') || 'none'}, ` +
        `${v.images.total} images (${v.images.broken} broken), ${v.placeholders.count} placeholders`
    );
  }
  // UNI-010 §8.2 — say which pages this reading actually covers.
  //
  // Without this line the report looks the same whether it measured one page or
  // nine, and a page skipped for want of a URL is indistinguishable from a page
  // that was measured and found clean. That equivalence is the whole defect this
  // section closed; reintroducing it in the printer would be a poor joke.
  if (report.pages && report.pages.length) {
    const measured = report.pages.filter((p) => p.measured);
    console.log(`  pages: ${measured.length}/${report.pages.length} measured — ${measured.map((p) => p.component).join(', ')}`);
    for (const p of report.pages.filter((page) => !page.measured)) {
      console.log(`  [skipped] ${p.component} — ${p.unreachable}`);
    }
  }
  for (const f of report.findings) {
    console.log(`  [${f.severity}] ${f.viewport}: ${f.code} — ${f.message}`);
  }
  for (const file of files) console.log(`  wrote ${file}`);
}

async function main() {
  if (!projectDir) {
    console.error('usage: measure-from-disk.js <project-dir> [--json] [--out prefix] [--viewports desktop,phone] [--page quiz]');
    process.exit(2);
  }

  const { report, screenshots } = await renderReport({
    projectDir,
    viewports: viewportsOrExit(flag('--viewports')),
    screenshot: flag('--screenshot', 'full'),
    deviceScaleFactor: Number(flag('--scale', 0.5)),
    backendPort: flag('--backend-port') ? Number(flag('--backend-port')) : undefined,
    editorTokens: argv.includes('--editor-tokens'),
    page: flag('--page')
  });

  const out = flag('--out');
  const files = [];
  if (out) {
    for (const shot of screenshots) {
      const file = `${out}-${shot.name}.png`;
      fs.writeFileSync(file, Buffer.from(shot.base64, 'base64'));
      report.viewports[shot.name].screenshot = file;
      files.push(file);
    }
  }

  if (asJson) {
    // `--inline-screenshots` is how the MCP `render_report` tool gets the
    // pictures: it runs this CLI as a child process rather than importing the
    // module, so a Chrome that wedges cannot take the server down with it.
    const payload = argv.includes('--inline-screenshots') ? { ...report, screenshots } : report;
    console.log(JSON.stringify(payload, null, 2));
  } else {
    printHuman(report, files);
  }

  // Exit 0 regardless of findings: the report is the verdict, and a non-zero
  // exit would make every driving harness treat "the page has a defect" as
  // "the tool broke".
}

main().catch((e) => {
  // In --json mode the failure has to be machine-readable too, or the caller
  // that asked for JSON gets prose on a channel it does not read.
  if (asJson) {
    console.log(
      JSON.stringify(
        { error: { actionable: Boolean(e.actionable), message: e.message, problems: e.problems ?? [e.message] } },
        null,
        2
      )
    );
  } else if (e.actionable) {
    console.error('Cannot render:');
    for (const problem of e.problems) console.error(`  - ${problem}`);
  } else {
    console.error('MEASURE FAILED:', e.message);
  }
  process.exit(1);
});
