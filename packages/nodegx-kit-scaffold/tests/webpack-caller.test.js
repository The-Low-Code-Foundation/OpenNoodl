/**
 * 🔴 **The caller this package had no gate for.**
 *
 * Every other test here runs in plain Node, where `require.resolve` is honest.
 * CN-006's editor half added a consumer that is not plain Node: the editor
 * renderer is a **webpack bundle**, and webpack does not leave `require.resolve`
 * alone. It resolves the specifier at build time, pulls the target into the
 * bundle as a module, and rewrites the call site to the *module id*:
 *
 * ```js
 * const pkgPath = \/*require.resolve*\/(\/*! … *\/ "../nodegx-node-kit-types/package.json");
 * ```
 *
 * That is a webpack identifier. `fs.readFileSync` then resolves it as a
 * **relative path against `process.cwd()`** — so whether the scaffold works at
 * all became an accident of where the process happened to be started.
 *
 * Nothing in the repository would have caught it: this package's suite passes,
 * the editor's suite never executes a bundle, and the source line carried a
 * comment asserting the opposite ("keeps working from a packaged build" — true
 * of npm layout, false of a bundler). So this test **is** the missing caller.
 *
 * ## 🔴 Two coincidences this file had to be rewritten to avoid
 *
 * Both were found by mutating the fix away and watching the test stay green.
 *
 * 1. **Jest's own cwd is `packages/nodegx-kit-scaffold`**, and webpack's module
 *    id `"../nodegx-node-kit-types/package.json"` is a *valid relative path*
 *    from there. The broken build read the right file by luck.
 * 2. **So is the editor's**, because `packages/noodl-editor` is a sibling of
 *    `packages/nodegx-node-kit-types`. Moving the call to the editor's working
 *    directory — the obvious correction — reproduced the same accident.
 *
 * The layout that has neither coincidence is the one that actually ships: a
 * bundle sitting **beside its `node_modules`**, with no sibling `packages/`
 * directory above it. {@link buildPackagedLayout} constructs exactly that, and
 * `describe('the controls')` asserts the coincidences really are absent — a
 * bundling test is very easy to pass vacuously.
 *
 * ⚠️ **What this still does not grade.** It represents a packaged layout; it
 * does not run inside a real `app.asar`. The remaining risk is asar-specific
 * path handling, not resolution strategy.
 */

/* eslint-env jest */

const fs = require('fs');
const os = require('os');
const path = require('path');

const webpack = require('webpack');

const REPO_ROOT = path.resolve(__dirname, '../../..');
const EDITOR_DIR = path.join(REPO_ROOT, 'packages/noodl-editor');
const TYPES_PKG_DIR = path.join(REPO_ROOT, 'packages/nodegx-node-kit-types');

/** The module id webpack substitutes for the resolve — the string at the heart of the defect. */
const WEBPACK_MODULE_ID = '../nodegx-node-kit-types/package.json';

// The editor's real externals list, from the editor's real helper — not a
// re-implementation. It reads `node_modules` relative to the working directory,
// so the call is wrapped in a chdir rather than having its logic copied here:
// a mirrored copy of the thing under test is the drift this file exists to catch.
function editorExternals() {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const getExternalModules = require(path.join(EDITOR_DIR, 'webpackconfigs/helpers/get-externals-modules.js'));
  return inDirectory(EDITOR_DIR, () => getExternalModules({ production: false }));
}

function inDirectory(dir, fn) {
  const previous = process.cwd();
  try {
    process.chdir(dir);
    return fn();
  } finally {
    process.chdir(previous);
  }
}

/**
 * A directory shaped like an installed app: the bundle at the top, its
 * `node_modules` beside it, and nothing useful above. Neither coincidence in
 * the header survives here.
 */
function buildPackagedLayout() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'kit-scaffold-packaged-'));
  const scope = path.join(root, 'node_modules', '@nodegx');
  fs.mkdirSync(scope, { recursive: true });
  fs.symlinkSync(TYPES_PKG_DIR, path.join(scope, 'node-kit-types'), 'dir');
  return root;
}

let appDir;
let bundlePath;
let bundleSource;
let stats;

beforeAll(async () => {
  appDir = buildPackagedLayout();
  const entryPath = path.join(appDir, 'entry.js');
  fs.writeFileSync(entryPath, "module.exports = require('@nodegx/kit-scaffold');\n", 'utf8');

  stats = await new Promise((resolve, reject) => {
    webpack(
      {
        mode: 'development',
        devtool: false,
        // The editor renderer's target — `webpackconfigs/shared/webpack.renderer.core.js`.
        target: 'electron-renderer',
        entry: entryPath,
        output: { path: appDir, filename: 'bundle.js', library: { type: 'commonjs2' } },
        externals: editorExternals(),
        resolve: { modules: [path.join(REPO_ROOT, 'node_modules'), 'node_modules'] }
      },
      (err, result) => (err ? reject(err) : resolve(result))
    );
  });

  bundlePath = path.join(appDir, 'bundle.js');
  bundleSource = fs.readFileSync(bundlePath, 'utf8');
}, 120000);

afterAll(() => {
  if (appDir) fs.rmSync(appDir, { recursive: true, force: true });
});

/** Call into the bundle the way a shipped app would — from its own directory. */
function inApp(fn) {
  return inDirectory(appDir, fn);
}

describe('the controls', () => {
  test('the build succeeded', () => {
    expect(stats.hasErrors()).toBe(false);
  });

  test('webpack really did rewrite `require.resolve` — otherwise this file measures nothing', () => {
    // The rewrite is what the fix survives. If webpack ever stops doing it (this
    // package becomes an external, say) these tests stop being about anything,
    // and this is how that gets noticed rather than silently enjoyed.
    expect(bundleSource).toContain('/*require.resolve*/');
    expect(bundleSource).toContain(WEBPACK_MODULE_ID);
  });

  test('and the bundle really contains this package, not a stub', () => {
    expect(bundleSource).toContain('resolvePublishedPackageJson');
    expect(bundleSource).toContain('scaffoldKitFiles');
  });

  test('🔴 the two coincidences that made a broken build look fixed are absent here', () => {
    // Where the module id DOES accidentally resolve — both of these graded a
    // broken build as passing before this layout existed.
    expect(fs.existsSync(path.resolve(__dirname, '..', WEBPACK_MODULE_ID))).toBe(true); // jest's cwd
    expect(fs.existsSync(path.resolve(EDITOR_DIR, WEBPACK_MODULE_ID))).toBe(true); // the editor's cwd

    // And where it does not — the layout every assertion below runs in.
    expect(fs.existsSync(path.resolve(appDir, WEBPACK_MODULE_ID))).toBe(false);
  });

  test('the packaged layout really is one — node_modules beside the bundle', () => {
    // The other half: if the symlink were missing, the fix would fail here for a
    // reason that has nothing to do with the fix, and the red would be a lie.
    expect(fs.existsSync(path.join(appDir, 'node_modules/@nodegx/node-kit-types/package.json'))).toBe(true);
  });
});

describe('the bundled package behaves like the plain-Node one', () => {
  test('`readPublishedTypes` returns the published types rather than throwing', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bundled = require(bundlePath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const plain = require('../src/index');

    const fromBundle = inApp(() => bundled.readPublishedTypes());
    const fromPlain = plain.readPublishedTypes();

    // Asserted against the plain-Node answer rather than a hardcoded version, so
    // this keeps grading the *agreement* when the types are bumped.
    expect(fromBundle.version).toBe(fromPlain.version);
    expect(fromBundle.body).toBe(fromPlain.body);
    expect(fromBundle.body.length).toBeGreaterThan(0);
  });

  test('and a whole kit scaffolds through the bundle, types copy included', () => {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const bundled = require(bundlePath);
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const plain = require('../src/index');

    const fromBundle = inApp(() => bundled.scaffoldKitFiles({ name: 'Weather Kit' }));
    const fromPlain = plain.scaffoldKitFiles({ name: 'Weather Kit' });

    expect(fromBundle.ok).toBe(true);
    // The whole file set, byte for byte. `readPublishedTypes` is only reachable
    // through this in production, so this matches the failure a user would hit.
    expect(fromBundle.files).toEqual(fromPlain.files);
  });
});

describe('the build is clean', () => {
  test('no webpack warnings — a `Critical dependency` here is a real regression', () => {
    // Hoisting the specifier to a variable makes webpack give up on static
    // analysis, emit `Critical dependency: the request of a dependency is an
    // expression`, and drag a context module covering this package's whole
    // source directory into the editor bundle. The literal costs nothing, and
    // this is what keeps it a literal.
    const warnings = stats.compilation.warnings.map((w) => String(w.message || w));
    expect(warnings).toEqual([]);
  });
});
