#!/usr/bin/env node
/**
 * DSG-008's finding, asked of the *source* instead of the screen.
 *
 * ## What this is, and what it is not
 *
 * `icon-contrast.js` is the authority: it reads the computed paint of every glyph in a **running**
 * editor and divides. Its header explains why a code review cannot replace it — a rule that is
 * present and losing looks identical to a rule that is absent, and the ambient `color` a glyph
 * inherits is decided several levels up from the file that mounts it.
 *
 * That instrument needs an editor. This one does not, and it answers a strictly narrower question:
 * **which files set `fill` or `stroke` on an icon instead of `color`?** That is the specific
 * mechanism behind the nine dark-on-dark glyphs (worst 1.16:1) — `Icon.module.scss` states the
 * house rule in its own header, a glyph paints with `currentColor` and the host sets `color`, and a
 * host that sets `fill` sets nothing, because the shipped glyphs carry their own `fill`/`stroke`
 * presentation attribute and an *inherited* `fill` loses to one of those. Half the set is stroked,
 * where `fill` is the wrong property entirely.
 *
 * 🔴 **A clean result here is not a contrast pass.** It says nobody used the property that does
 * nothing. It says nothing about what `color` resolves to where the glyph is actually mounted.
 * Run `icon-contrast.js` for that.
 *
 * ## Recall
 *
 * A scanner written for one phase in this repo found **one of three** real sites, and a sweep that
 * reports absences is indistinguishable from a scanner that cannot see. So `--self-test` plants
 * one of each shape this looks for and fails unless all of them come back.
 *
 * Usage:
 *   node scripts/devtools/icon-host-scan.js <file|dir> [...]
 *   node scripts/devtools/icon-host-scan.js --self-test
 *   node scripts/devtools/icon-host-scan.js --changed <base-ref>     # git diff against a ref
 */

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');

/**
 * Anything whose name suggests it is a glyph or the box immediately around one.
 *
 * 🔴 **A plain substring, deliberately.** The first version of this required a non-letter before
 * the word — `/(^|[^a-z])(icon|…)/i` — and the `--self-test` immediately caught it missing
 * `.PanelIcon`, because CSS-module class names in this repo are PascalCase compounds and the `l`
 * of `Panel` is a letter. That is the register's "found one of three real sites" in miniature, and
 * it was found by the control rather than by reading. A substring over-matches instead, which
 * costs a human one glance at a list; the other way costs a missed glyph.
 */
const ICONISH = /icon|glyph|svg|chevron|caret/i;

/**
 * Shape 1 — a stylesheet rule on an icon-ish selector that paints with `fill`/`stroke`.
 *
 * ⚠️ `fill` on a selector that is genuinely an SVG *shape* — a flyout background, a scrollbar
 * handle — is correct and is not this. The discriminator is whether the selector names an icon,
 * which is why `ICONISH` is matched against the selector and not against the file.
 */
function scanStylesheet(source, file) {
  const findings = [];
  const stripped = source.replace(/\/\*[\s\S]*?\*\//g, (match) => match.replace(/[^\n]/g, ' '));

  const rule = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = rule.exec(stripped))) {
    const selector = match[1].split('\n').pop().trim();
    const body = match[2];
    if (!ICONISH.test(selector)) continue;

    const paints = /(^|[;\s])(fill|stroke)\s*:/.test(body);
    const colours = /(^|[;\s])color\s*:/.test(body);
    if (!paints || colours) continue;

    findings.push({
      file,
      line: stripped.slice(0, match.index).split('\n').length,
      shape: 'stylesheet-fill',
      detail: `${selector} { … } paints with fill/stroke and sets no color`
    });
  }
  return findings;
}

/**
 * Shape 2 — an `<Icon …>` element handed a `fill` (as a prop, an attribute or in a `style` object).
 *
 * Shape 3 — `setAttribute('fill', …)` or `.style.fill =` within ~3 lines of something icon-ish,
 * which is how the imperative half of this editor mounts glyphs.
 */
function scanScript(source, file) {
  const findings = [];
  const lines = source.split('\n');

  const element = /<Icon\b[^>]*?\b(fill|stroke)\s*[=:]/gs;
  let match;
  while ((match = element.exec(source))) {
    findings.push({
      file,
      line: source.slice(0, match.index).split('\n').length,
      shape: 'jsx-fill',
      detail: `<Icon> given ${match[1]} rather than color`
    });
  }

  lines.forEach((line, index) => {
    const imperative = line.match(/setAttribute\(\s*['"](fill|stroke)['"]|\.style\.(fill|stroke)\s*=/);
    if (!imperative) return;

    const around = lines.slice(Math.max(0, index - 3), index + 4).join('\n');
    if (!ICONISH.test(around)) return;

    findings.push({
      file,
      line: index + 1,
      shape: 'imperative-fill',
      detail: line.trim().slice(0, 90)
    });
  });

  return findings;
}

function scanFile(file) {
  const source = fs.readFileSync(file, 'utf8');
  if (/\.(css|scss|sass|less)$/.test(file)) return scanStylesheet(source, file);
  if (/\.(ts|tsx|js|jsx)$/.test(file)) return scanScript(source, file);
  return [];
}

function walk(target, into) {
  const stat = fs.statSync(target);
  if (stat.isFile()) {
    into.push(target);
    return;
  }
  for (const entry of fs.readdirSync(target)) {
    if (entry === 'node_modules' || entry.startsWith('.')) continue;
    walk(path.join(target, entry), into);
  }
}

function selfTest() {
  const planted = [
    {
      name: 'planted.module.scss',
      source: `.PanelIcon {\n  fill: var(--theme-color-fg-muted);\n  width: 16px;\n}\n`,
      shape: 'stylesheet-fill'
    },
    {
      name: 'planted-jsx.tsx',
      source: `export const A = () => <Icon name={IconName.Copy} fill="var(--theme-color-fg-muted)" />;\n`,
      shape: 'jsx-fill'
    },
    {
      name: 'planted-imperative.ts',
      source: `const icon = document.createElementNS(NS, 'path');\nicon.setAttribute('fill', muted);\n`,
      shape: 'imperative-fill'
    }
  ];

  const directory = fs.mkdtempSync(path.join(require('os').tmpdir(), 'icon-host-'));
  let ok = true;

  for (const { name, source, shape } of planted) {
    const file = path.join(directory, name);
    fs.writeFileSync(file, source);
    const found = scanFile(file);
    const hit = found.some((f) => f.shape === shape);
    console.log(`  ${hit ? 'caught' : 'MISSED'}  ${shape.padEnd(18)} ${name}`);
    if (!hit) ok = false;
  }

  // And a negative: a correct host, and a genuine SVG shape that is not an icon. Either being
  // flagged would make every clean report meaningless in the other direction.
  const clean = [
    { name: 'ok.module.scss', source: `.PanelIcon {\n  color: var(--theme-color-fg-default);\n}\n` },
    { name: 'shape.module.scss', source: `.blocklyFlyoutBackground {\n  fill: var(--theme-color-bg-2);\n}\n` }
  ];
  for (const { name, source } of clean) {
    const file = path.join(directory, name);
    fs.writeFileSync(file, source);
    const found = scanFile(file);
    console.log(`  ${found.length === 0 ? 'quiet ' : 'FALSE+'}  ${'(should be clean)'.padEnd(18)} ${name}`);
    if (found.length) ok = false;
  }

  fs.rmSync(directory, { recursive: true, force: true });
  console.log(ok ? '\nself-test passed\n' : '\nSELF-TEST FAILED\n');
  process.exit(ok ? 0 : 1);
}

function main() {
  const args = process.argv.slice(2);
  if (args.includes('--self-test')) return selfTest();

  let targets = [];
  const changedAt = args.indexOf('--changed');
  if (changedAt !== -1) {
    const base = args[changedAt + 1];
    const out = execFileSync('git', ['diff', '--name-only', base, 'HEAD'], { encoding: 'utf8' });
    targets = out
      .split('\n')
      .filter(Boolean)
      .filter((file) => fs.existsSync(file));
  } else {
    for (const target of args) walk(target, targets);
  }

  const findings = targets.flatMap((file) => {
    try {
      return scanFile(file);
    } catch {
      return [];
    }
  });

  console.log(`\n${targets.length} files scanned, ${findings.length} icon hosts painting with fill/stroke\n`);
  for (const finding of findings) {
    console.log(`  ${finding.file}:${finding.line}  [${finding.shape}]  ${finding.detail}`);
  }
  if (!findings.length) {
    console.log('  none.\n  ⚠️ Not a contrast pass — run icon-contrast.js against a running editor for that.\n');
  }
}

main();
