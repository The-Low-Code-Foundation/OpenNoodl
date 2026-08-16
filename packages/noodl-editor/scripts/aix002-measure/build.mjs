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

/**
 * 🔴 The stub was a catch-all Proxy, and it was wrong in two independent ways.
 *
 * 1. **Nothing reached the importers.** esbuild's `__toESM` interop materialises
 *    a namespace from the module's OWN KEYS (`__copyProps` →
 *    `Object.getOwnPropertyNames`). A Proxy carrying only a `get` trap has no
 *    own keys — its target is `{}` — so every named import from it resolved to
 *    `undefined`, and the first use died as
 *    `Cannot read properties of undefined (reading 'getActiveProvider')`.
 *    A `get` trap cannot survive interop; the names have to exist.
 *
 * 2. **Had it worked, it would have been worse.** A catch-all returning a
 *    callable noop makes `getActiveProvider()` TRUTHY, which sends `resolveRole`
 *    down its override branch (`client/roles.ts:110-138`) and spreads a noop
 *    `provider` and `model` onto every request the session sends. The harness
 *    constructs its own provider from `.env`, so the honest stub is the one that
 *    says **AI is off** — `null` — which is the branch that contributes nothing
 *    but the role tag.
 *
 * ⚠️ The name list is hand-kept, and `AiAssistantStore.ts` has exactly two
 * runtime exports today. A third would arrive here as `undefined` at its first
 * use rather than as a bundle error — the same failure mode as above, so add the
 * name here when the store grows one.
 */
const stubPlugin = {
  name: 'aix002-stubs',
  setup(build) {
    build.onResolve({ filter: /AiAssistantStore$/ }, () => ({
      path: 'ai-assistant-store',
      namespace: 'aix002-stub'
    }));
    build.onLoad({ filter: /.*/, namespace: 'aix002-stub' }, () => ({
      contents: [
        '// Inert on purpose: the harness injects its own chat function and builds',
        '// providers from .env, so nothing here should ever influence a request.',
        'exports.AiConfigStore = {',
        '  getActiveProvider: () => null,',
        '  getRole: () => ({}),',
        '  getModel: () => "",',
        '  isConfigured: () => false',
        '};',
        'exports.AI_PROVIDER_LABELS = {};'
      ].join('\n'),
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
