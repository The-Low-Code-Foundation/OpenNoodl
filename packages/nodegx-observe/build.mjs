/**
 * Bundles `nodegx-observe` into a self-contained CJS executable.
 *
 * It bundles OBS-002's `walkEngine.ts` straight from the editor sources. That module was written
 * with **zero imports** specifically so it could run here — no renderer, no Electron — which is
 * what keeps one implementation of the walk rather than a copy that drifts.
 *
 * ⚠️ **Targets node22, not node18.** The server uses the global `WebSocket` that Node 22 ships,
 * which is the whole reason it has no runtime dependencies of its own. The repo already requires
 * Node 22.
 */
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info',
  target: 'node22',
  outfile: 'dist/nodegx-observe.cjs'
});
