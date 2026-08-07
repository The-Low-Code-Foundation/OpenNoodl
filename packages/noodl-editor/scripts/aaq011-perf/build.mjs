/**
 * Bundles the AAQ-011 F6 partial-publish harness into a single CJS executable.
 *
 * Same recipe as `aix002-measure/build.mjs`, and for the same reason: the
 * authoring loop is pure, but `AuthoringSession` imports the client barrel,
 * which reaches `@noodl-store/AiAssistantStore` (EditorSettings + OS-encrypted
 * credentials). This harness injects its own chat function, so the store is
 * stubbed rather than dragged in.
 *
 * `PlanRun` adds two more edges the measurement harness does not have: the
 * project-docs provider and the editor's `ToastLayer`. Both are behind the same
 * stub treatment — the harness constructs its own `PlanRun` and never opens a
 * project.
 *
 * A new alias in the sources fails the bundle loudly here, which is the good
 * failure mode.
 */
import path from 'path';
import { fileURLToPath } from 'url';

import esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EDITOR_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src');

const stubPlugin = {
  name: 'aaq011-stubs',
  setup(build) {
    build.onResolve({ filter: /AiAssistantStore$/ }, () => ({
      path: 'ai-assistant-store',
      namespace: 'aaq011-stub'
    }));
    build.onLoad({ filter: /.*/, namespace: 'aaq011-stub' }, () => ({
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
  outfile: path.join(HERE, 'dist/aaq011-harness.cjs'),
  sourcemap: false,
  alias: {
    '@noodl-models': path.join(EDITOR_SRC, 'models'),
    '@noodl-utils': path.join(EDITOR_SRC, 'utils'),
    '@noodl-constants': path.join(EDITOR_SRC, 'constants')
  },
  plugins: [stubPlugin],
  logLevel: 'warning'
});
