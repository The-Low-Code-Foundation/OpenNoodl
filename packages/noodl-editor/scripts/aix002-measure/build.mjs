/**
 * Bundles the AIX-002 measurement harness into a single CJS executable.
 *
 * Follows noodl-preview's headless-editor recipe, but this import graph is far
 * shallower — the authoring loop, the explain graph, the validation gate and
 * the AIX-001 providers are all pure. Exactly one shim is needed:
 * `AuthoringSession` imports the client barrel, which pulls `AiClient`, which
 * pulls `@noodl-store/AiAssistantStore` (EditorSettings + OS-encrypted
 * credentials). The harness injects its own chat function and constructs
 * providers from `.env`, so the store is never exercised — it is stubbed with
 * a noop proxy rather than dragged in.
 *
 * The `alias` map mirrors noodl-editor/tsconfig.json's `paths` for the
 * aliases this graph touches. A new alias in the sources fails the bundle
 * loudly here, which is the good failure mode.
 */
import path from 'path';
import { fileURLToPath } from 'url';

import esbuild from 'esbuild';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..', '..', '..');
const EDITOR_SRC = path.join(REPO_ROOT, 'packages/noodl-editor/src/editor/src');

const stubPlugin = {
  name: 'aix002-stubs',
  setup(build) {
    build.onResolve({ filter: /AiAssistantStore$/ }, () => ({
      path: 'ai-assistant-store',
      namespace: 'aix002-stub'
    }));
    build.onLoad({ filter: /.*/, namespace: 'aix002-stub' }, () => ({
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
  outfile: path.join(HERE, 'dist/aix002-harness.cjs'),
  sourcemap: false,
  alias: {
    '@noodl-models': path.join(EDITOR_SRC, 'models'),
    '@noodl-utils': path.join(EDITOR_SRC, 'utils'),
    '@noodl-constants': path.join(EDITOR_SRC, 'constants')
  },
  plugins: [stubPlugin],
  logLevel: 'warning'
});
