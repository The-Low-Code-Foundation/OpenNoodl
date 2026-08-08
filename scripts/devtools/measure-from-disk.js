#!/usr/bin/env node
/**
 * Render a v2 project from disk and print what it actually looks like.
 *
 * Usage:
 *   node scripts/devtools/measure-from-disk.js <project-dir> [options]
 *
 *   --json                   the full report as JSON on stdout, nothing else
 *   --out <prefix>           write <prefix>-<viewport>.png (default: no files)
 *   --viewports <list>       "desktop,phone" or "1280x900,390x844"
 *   --screenshot <mode>      full | viewport | none        (default: full)
 *   --scale <n>              screenshot scale              (default: 0.5)
 *   --backend-port <n>       proxy /__backend to this port
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
const { renderReport, DEFAULT_VIEWPORTS } = require('./render-report');

const argv = process.argv.slice(2);
const VALUE_FLAGS = new Set(['--out', '--viewports', '--screenshot', '--scale', '--backend-port']);
const flag = (name, fallback) => {
  const i = argv.indexOf(name);
  return i === -1 ? fallback : argv[i + 1];
};
const projectDir = argv.find((a, i) => !a.startsWith('--') && !VALUE_FLAGS.has(argv[i - 1]));
const asJson = argv.includes('--json');

/** `"desktop,phone"`, `"1280x900"`, or a mix. Unknown names list what is known. */
function parseViewports(spec) {
  if (!spec) return DEFAULT_VIEWPORTS;
  const known = new Map(DEFAULT_VIEWPORTS.map((v) => [v.name, v]));
  return spec.split(',').map((token) => {
    const trimmed = token.trim();
    if (known.has(trimmed)) return known.get(trimmed);
    const m = /^(\d+)x(\d+)$/.exec(trimmed);
    if (!m) {
      console.error(`Unknown viewport "${trimmed}". Use ${[...known.keys()].join(', ')} or WIDTHxHEIGHT.`);
      process.exit(2);
    }
    const width = Number(m[1]);
    return { name: trimmed, width, height: Number(m[2]), mobile: width < 500 };
  });
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
  for (const f of report.findings) {
    console.log(`  [${f.severity}] ${f.viewport}: ${f.code} — ${f.message}`);
  }
  for (const file of files) console.log(`  wrote ${file}`);
}

async function main() {
  if (!projectDir) {
    console.error('usage: measure-from-disk.js <project-dir> [--json] [--out prefix] [--viewports desktop,phone]');
    process.exit(2);
  }

  const { report, screenshots } = await renderReport({
    projectDir,
    viewports: parseViewports(flag('--viewports')),
    screenshot: flag('--screenshot', 'full'),
    deviceScaleFactor: Number(flag('--scale', 0.5)),
    backendPort: flag('--backend-port') ? Number(flag('--backend-port')) : undefined,
    editorTokens: argv.includes('--editor-tokens')
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

  if (asJson) console.log(JSON.stringify(report, null, 2));
  else printHuman(report, files);

  // Exit 0 regardless of findings: the report is the verdict, and a non-zero
  // exit would make every driving harness treat "the page has a defect" as
  // "the tool broke".
}

main().catch((e) => {
  if (e.actionable) {
    console.error('Cannot render:');
    for (const problem of e.problems) console.error(`  - ${problem}`);
  } else {
    console.error('MEASURE FAILED:', e.message);
  }
  process.exit(1);
});
