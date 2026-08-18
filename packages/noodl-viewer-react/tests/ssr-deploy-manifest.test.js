/**
 * CN-013 — everything the SSR runtime requires must be in the deploy manifest.
 *
 * ## 🔴 Why this file exists: a file was built, shipped, and never deployed
 *
 * `deployToFolder` does NOT copy `static/ssr/` as a directory. It reads an explicit list —
 * `ssr/index.json` — and copies exactly what that list names. `kit-modules.js` was added by
 * CN-013 (`5d956ae2`) and never added to the list, in the source copy or the built one.
 *
 * The consequence was total and silent: `index.js` requires it at module top level, so
 * `npm run build` in EVERY deployed folder died with `Could not resolve "./kit-modules"` —
 * kit or no kit, SSR or SSG. Measured s27 by building a real deploy; adding the one file and
 * re-running the identical command succeeded.
 *
 * ⚠️ **Three lines above the failing require, `index.js` says "All of static/ssr is copied into
 * the deploy runtime by webpack, so these travel together."** That sentence is true of the
 * webpack `CopyWebpackPlugin` rule (`from: 'static/ssr'`) and false of the deploy, which is the
 * step that matters. A reader checking the claim finds the copy rule and stops.
 *
 * 🔴 **Nothing else in this repo builds a deploy**, which is why two gates and a suite were green
 * across the whole gap. `ssr-kit-modules.test.js` graded the loader's behaviour and could not see
 * that the loader never arrives.
 *
 * ## What this asserts
 *
 * The require graph is walked TRANSITIVELY from both entry points, not just their top level: a
 * `require('./x')` added inside `server-core.js` would strand `x` exactly the same way, and a
 * top-level-only check would not notice.
 */
const fs = require('fs');
const path = require('path');

const SSR_DIR = path.join(__dirname, '..', 'static', 'ssr');
const ENTRY_POINTS = ['index.js', 'ssg.js'];

/** Local `require('./x')` specifiers in one file. Ignores bare/package requires. */
function localRequires(file) {
  const src = fs.readFileSync(path.join(SSR_DIR, file), 'utf8');
  const out = new Set();
  for (const m of src.matchAll(/require\(\s*'\.\/([^']+)'\s*\)/g)) out.add(m[1]);
  for (const m of src.matchAll(/require\(\s*"\.\/([^"]+)"\s*\)/g)) out.add(m[1]);
  return [...out];
}

/**
 * `./x` -> the filename the deploy must carry. Extensionless specifiers resolve to `.js`.
 *
 * ⚠️ Only a REAL module extension counts. A naive `/\.[a-z]+$/` test reads `./noodl.deploy` as
 * already-extensioned and yields `noodl.deploy`, which matches no manifest entry — this test
 * reported that as a missing file on its first run. The dot is part of the name, not a suffix.
 */
const MODULE_EXTENSIONS = ['.js', '.cjs', '.mjs', '.json'];

function resolveToFile(spec) {
  return MODULE_EXTENSIONS.some((ext) => spec.endsWith(ext)) ? spec : `${spec}.js`;
}

/**
 * Everything reachable from the entry points. `noodl.deploy.js` is webpack's own bundle output —
 * it is not in `static/ssr` on disk, but it IS required and IS in the manifest, so it belongs in
 * the closure and is simply not read for further requires.
 */
function transitiveClosure() {
  const seen = new Set(ENTRY_POINTS);
  const queue = [...ENTRY_POINTS];
  while (queue.length) {
    const file = queue.shift();
    if (!fs.existsSync(path.join(SSR_DIR, file))) continue; // build output, nothing to walk
    for (const spec of localRequires(file)) {
      const dep = resolveToFile(spec);
      if (!seen.has(dep)) {
        seen.add(dep);
        queue.push(dep);
      }
    }
  }
  return seen;
}

const manifest = JSON.parse(fs.readFileSync(path.join(SSR_DIR, 'index.json'), 'utf8'));
const listed = new Set(manifest.map((e) => e.url));

describe('the SSR deploy manifest carries everything the runtime requires', () => {
  it('lists every file reachable from index.js and ssg.js', () => {
    const missing = [...transitiveClosure()].filter((f) => !listed.has(f)).sort();
    // Named, not counted: the failure message has to say which file to add.
    expect(missing).toEqual([]);
  });

  it('lists kit-modules.js specifically — the one that was missing', () => {
    // 🔴 A regression row, kept separate on purpose. The row above would also go green if
    // someone deleted the require rather than shipping the file, which is the wrong repair:
    // it would silently take kits back out of the server render.
    expect(listed.has('kit-modules.js')).toBe(true);
    expect(localRequires('index.js')).toContain('kit-modules');
    expect(localRequires('ssg.js')).toContain('kit-modules');
  });

  it('the walk is transitive, not just the entry points', () => {
    // ✅ CONTROL. `render-gate.js` is reachable ONLY through server-core.js / runtime-globals.js —
    // neither entry point requires it directly. If this ever stops holding, the closure has
    // collapsed to a top-level scan and the row above is weaker than it reads.
    const topLevel = new Set([...localRequires('index.js'), ...localRequires('ssg.js')].map(resolveToFile));
    expect(topLevel.has('render-gate.js')).toBe(false);
    expect(transitiveClosure().has('render-gate.js')).toBe(true);
  });

  it('every manifest entry actually exists on disk, except webpack’s own output', () => {
    const BUILD_OUTPUT = new Set(['noodl.deploy.js']);
    const absent = manifest
      .map((e) => e.url)
      .filter((u) => !BUILD_OUTPUT.has(u) && !fs.existsSync(path.join(SSR_DIR, u)));
    expect(absent).toEqual([]);
  });
});
