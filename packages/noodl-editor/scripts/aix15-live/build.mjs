/**
 * Bundles the phase-15 live harness into a single CJS executable.
 *
 * Same recipe as `aix002-measure/build.mjs`, but a deeper import graph: this
 * harness drives `ProjectReviewRun`, `PlanRun` and `ScopingSession` as well as
 * the authoring loop, and reaches `io/ProjectExporter` for the v2 files an
 * update session starts from. The exporter and the review/plan modules pull
 * editor-only singletons that a terminal process has no business constructing,
 * so each is stubbed rather than dragged in — the harness injects its own chat
 * function and never touches a `ProjectModel`, so none of them is exercised.
 *
 * A new alias or a new editor-only import in the sources fails the bundle
 * loudly here, which is the good failure mode.
 */
import path from 'path';
import { fileURLToPath } from 'url';

import esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EDITOR_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src');

/**
 * Modules that only exist for a running editor. A noop proxy answers any shape
 * of access, so a stub never has to track the surface it is standing in for.
 */
const STUBBED = [/AiAssistantStore$/, /EditorSettings$/, /ProjectModel$/];

/**
 * `@noodl/platform` was on that list until the `sandbox` mode needed a real
 * `ProjectModel`, whose import graph reads `platform.getUserDataPath()` at
 * module scope. It gets a small real module instead — see platform-shim.cjs
 * for why a Proxy cannot stand in for a module anyone imports *by name*.
 */
const PLATFORM_SHIM = path.join(HERE, 'platform-shim.cjs');

const stubPlugin = {
  name: 'aix15-stubs',
  setup(build) {
    STUBBED.forEach((filter, index) => {
      build.onResolve({ filter }, () => ({ path: `stub-${index}`, namespace: 'aix15-stub' }));
    });
    build.onLoad({ filter: /.*/, namespace: 'aix15-stub' }, () => ({
      contents:
        'const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });\n' +
        'module.exports = new Proxy({}, { get: () => noop });',
      loader: 'js'
    }));
  }
};

await esbuild.build({
  entryPoints: [path.join(HERE, 'harness.ts')],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: path.join(HERE, 'dist/aix15-harness.cjs'),
  sourcemap: false,
  alias: {
    '@noodl-models': path.join(EDITOR_SRC, 'models'),
    '@noodl-utils': path.join(EDITOR_SRC, 'utils'),
    '@noodl-constants': path.join(EDITOR_SRC, 'constants'),
    '@noodl-types': path.join(EDITOR_SRC, 'typings'),
    '@noodl/platform': PLATFORM_SHIM
  },
  plugins: [stubPlugin],
  logLevel: 'warning'
});
