#!/usr/bin/env node
/**
 * Borders that were designed, paid for in graph, and never drawn.
 *
 * `Group`'s `borderStyle` defaults to `"none"`, and the catalog says what that
 * costs in as many words: *"None hides the border and leaves Border Width and
 * Color inactive"*. Fifty-four nodes across twelve library entries set a border
 * **width and colour** and no style, so the line never appears. The Tab Bar's
 * active-tab underline, the Table's cell and header rules, the Multi Select
 * dropdown's outline and the Date Picker's field outline are all in this set —
 * every one of them visible in the graph, in the property panel, and nowhere on
 * screen. `library:check` reports it as `inactive-conditional-parameter`; the
 * render harness is where you see it.
 *
 * ## What it writes, and what it refuses to invent
 *
 * The author's own parameters decide which edges get a style, and nothing else
 * does:
 *
 *   - `borderWidth` / `borderColor` (all four edges) → `borderStyle: "solid"`
 *   - `borderBottomWidth` / `borderBottomColor` → `borderBottomStyle: "solid"`,
 *     and the same for the other three edges
 *
 * A node that set both families gets both, because that is what it asked for.
 * `"solid"` rather than dotted or dashed because it is the enum's first real
 * value and the only one a plain width-and-colour pair can be read as meaning.
 *
 * ⚠️ **A border changes layout.** These boxes get a real line where they had
 * none, so a tight row can reflow by the width of it. That is the point — the
 * design was drawn with the border — but it is a visual change and not only a
 * repair, which is why every touched entry gets a version bump and why
 * `render-check.js` should be re-run over the set afterwards.
 *
 * Usage:
 *   node scripts/library/fix-invisible-borders.js --check
 *   node scripts/library/fix-invisible-borders.js [--entry prefabs/table ...]
 */
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const LIBRARY_DIR = path.join(REPO_ROOT, 'library');

const EDGES = ['Top', 'Right', 'Bottom', 'Left'];
const check = process.argv.includes('--check');
const only = process.argv.filter((a, i, all) => all[i - 1] === '--entry');

/**
 * 🔴 Only node types that really have the port.
 *
 * The rule being applied is `Group`'s: `borderStyle` defaults to `none` and
 * gates width and colour. A **module-provided** node type is a React component
 * somebody else wrote — `Avatar` and `nodegx.drag-to-reorder` both take a
 * `borderWidth` and may well draw it on its own, and writing a `borderStyle`
 * parameter onto them would be inventing a port from a rule that is not theirs.
 * Thirty-nine of the fifty-five candidates are exactly that, so this is most of
 * the population, not an edge case.
 *
 * The catalog is the authority on which types declare the port, so the
 * predicate is read from it rather than restated here.
 */
const CATALOG_TYPES = (() => {
  const catalog = require(path.join(REPO_ROOT, 'packages/noodl-types/src/node-catalog-enriched.json'));
  const styled = new Map();
  for (const node of catalog.nodes || []) {
    const names = new Set((node.inputs || []).map((p) => p.name));
    if (names.has('borderStyle')) styled.set(node.typeName, names);
  }
  return styled;
})();

/** The style parameters this node's own width/colour parameters call for. */
function neededStyles(parameters) {
  const need = [];
  const has = (name) => parameters[name] !== undefined && parameters[name] !== null;
  if (has('borderWidth') || has('borderColor')) need.push('borderStyle');
  for (const edge of EDGES) {
    if (has(`border${edge}Width`) || has(`border${edge}Color`)) need.push(`border${edge}Style`);
  }
  // Already styled — including a deliberate "none" — is left alone. An author
  // who wrote `none` on purpose is not making this mistake.
  return need.filter((name) => parameters[name] === undefined);
}

function walk(node, fn) {
  fn(node);
  for (const child of node.children || []) walk(child, fn);
}

function main() {
  let entries = 0;
  let nodes = 0;
  const perEntry = [];
  const skipped = [];

  for (const type of ['prefabs', 'modules']) {
    const typeDir = path.join(LIBRARY_DIR, type);
    if (!fs.existsSync(typeDir)) continue;
    for (const slug of fs.readdirSync(typeDir).sort()) {
      const id = `${type}/${slug}`;
      if (only.length && !only.includes(id) && !only.includes(slug)) continue;
      const projectFile = path.join(typeDir, slug, 'project', 'project.json');
      if (!fs.existsSync(projectFile)) continue;

      const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));
      let count = 0;
      const where = [];
      for (const component of project.components || []) {
        for (const root of (component.graph && component.graph.roots) || []) {
          walk(root, (node) => {
            const parameters = node.parameters;
            if (!parameters) return;
            const declares = CATALOG_TYPES.get(node.type);
            if (!declares) {
              if (neededStyles(parameters).length) {
                skipped.push(`${id}  ${component.name} › ${node.label || node.type} (${node.type})`);
              }
              return;
            }
            const need = neededStyles(parameters).filter((name) => declares.has(name));
            if (!need.length) return;
            count++;
            where.push(`${component.name} › ${node.label || node.type}: ${need.join(', ')}`);
            for (const name of need) parameters[name] = 'solid';
          });
        }
      }
      if (!count) continue;

      entries++;
      nodes += count;
      perEntry.push({ id, count, where });
      if (!check) {
        fs.writeFileSync(projectFile, JSON.stringify(project, null, 2) + '\n');
        const libFile = path.join(typeDir, slug, 'library.json');
        const lib = JSON.parse(fs.readFileSync(libFile, 'utf8'));
        const m = /^(\d+)\.(\d+)\.(\d+)$/.exec(String(lib.version));
        if (m) {
          lib.version = `${m[1]}.${Number(m[2]) + 1}.0`;
          fs.writeFileSync(libFile, JSON.stringify(lib, null, 2) + '\n');
        }
      }
    }
  }

  for (const e of perEntry) {
    console.log(`${check ? 'would fix' : 'fixed'}  ${e.id}  ${e.count} node(s)`);
    for (const w of e.where.slice(0, 6)) console.log(`    ${w}`);
    if (e.where.length > 6) console.log(`    … and ${e.where.length - 6} more`);
  }
  if (skipped.length) {
    console.log(
      `\nLeft alone — ${skipped.length} node(s) on module-provided types, whose border ` +
        'semantics are their own module\'s, not Group\'s:'
    );
    for (const s of skipped.slice(0, 6)) console.log(`    ${s}`);
    if (skipped.length > 6) console.log(`    … and ${skipped.length - 6} more`);
  }
  console.log(`\n${nodes} node(s) across ${entries} entries.`);
}

main();
