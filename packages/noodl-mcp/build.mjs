/**
 * Bundles the `noodl-mcp` server into a self-contained CJS executable.
 *
 * The pure format engines (io/, schemas/, validation/) are bundled from
 * noodl-editor sources, and the enriched node catalog JSON is inlined — so the
 * artifact runs standalone with only Node ≥ 18 present, and there is a single
 * source of truth for the format logic (no duplication).
 *
 * ⚠️ **`nodegx-observe` is not built here any more.** It lives in
 * `packages/nodegx-observe` (moved 2026-08-02, Richard's call). The two never
 * shared a code path; they shared this package for packaging convenience, and
 * the spec's standing warning is that the two must not be *confused* — which one
 * `npm install` producing both worked directly against.
 */
import esbuild from 'esbuild';

const common = {
  bundle: true,
  platform: 'node',
  format: 'cjs',
  sourcemap: false,
  logLevel: 'info'
};

await esbuild.build({
  ...common,
  entryPoints: ['src/cli.ts'],
  target: 'node18',
  outfile: 'dist/noodl-mcp.cjs'
});
