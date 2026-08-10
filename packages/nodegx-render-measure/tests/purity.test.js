/**
 * The one property this package exists to hold.
 *
 * F22's whole argument is that `measureExpression` and `summarise` were trapped
 * behind `render-report.js`'s `child_process` / `http` / `net` / `ws` requires,
 * and that the editor bundle could not import them without dragging Node into
 * the renderer. Extracting them is only worth anything for as long as **this
 * file has no `require` in it**.
 *
 * ⚠️ That is exactly the kind of property that decays silently: adding
 * `require('path')` to build one file path would not fail a typecheck, would
 * not fail the report's own 41 specs, and would not change a single number —
 * it would just quietly put `path` in the renderer bundle and re-close the door
 * LAS-005 spent a session naming. So it is asserted on the source text.
 */

const fs = require('fs');
const path = require('path');

const SOURCE = path.join(__dirname, '..', 'src', 'index.js');

describe('@nodegx/render-measure is importable from a browser bundle', () => {
  it('🔴 contains no `require` at all', () => {
    const src = fs.readFileSync(SOURCE, 'utf8');
    // Comments may *mention* require (the module header does, at length), so
    // this looks for a call, not the word.
    const calls = src.match(/\brequire\s*\(/g) || [];
    expect(calls).toEqual([]);
  });

  it('⚠️ touches no Node global', () => {
    const src = fs.readFileSync(SOURCE, 'utf8');
    // `module.exports` is the one CJS affordance it is allowed — it is what
    // makes bare `node` able to load it, which is why this is JS and not TS.
    for (const forbidden of ['process.', '__dirname', '__filename', 'Buffer.']) {
      expect(src.includes(forbidden)).toBe(false);
    }
  });

  it('evaluates with `require` out of scope entirely', () => {
    // ⚠️ The textual check above is the one that bites; this is the behavioural
    // twin, and the FIRST version of it was decoration. It patched
    // `Module._load` and asserted the module still loaded — but jest supplies
    // its own module registry, so the patch intercepted nothing and the test
    // passed whatever the source did. Caught by inverting it: adding
    // `require('path')` turned the textual check red and left this one green.
    //
    // So it now compiles the source in a scope where `require` is not a
    // function at all, which is the actual condition inside a browser bundle.
    const src = fs.readFileSync(SOURCE, 'utf8');
    const module_ = { exports: {} };
    const evaluate = new Function(
      'module',
      'exports',
      'require',
      `${src}\nreturn module.exports;`
    );
    const throwing = (request) => {
      throw new Error(`render-measure must not require "${request}"`);
    };
    const loaded = evaluate(module_, module_.exports, throwing);
    expect(typeof loaded.summarise).toBe('function');
    expect(typeof loaded.measureExpression).toBe('function');
  });

  it('exports the vocabulary every client has to agree on', () => {
    // A client that resolves a finding code differently from the report is two
    // vocabularies — the BCN-003 mistake this repo has paid for once.
    const m = require(SOURCE);
    expect(Object.keys(m.RenderFinding).length).toBeGreaterThan(10);
    expect(m.DEFAULT_VIEWPORTS.map((v) => v.name)).toEqual(['desktop', 'phone']);
    expect(m.DESKTOP_WIDTH).toBe(1024);
  });

  it('measureExpression returns evaluable source, not a function', () => {
    // It is evaluated inside a page by two different transports (CDP for the
    // CLI, `webview.executeJavaScript` for the editor). A function would not
    // survive either.
    const m = require(SOURCE);
    const expr = m.measureExpression(['Text']);
    expect(typeof expr).toBe('string');
    expect(expr).toContain('const PLACEHOLDERS = ["Text"]');
  });
});
