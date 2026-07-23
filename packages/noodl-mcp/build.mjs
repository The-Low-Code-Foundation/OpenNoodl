/**
 * Bundles the MCP server into a single self-contained CJS executable.
 *
 * The pure format engines (io/, schemas/, validation/) are bundled from
 * noodl-editor sources, and the enriched node catalog JSON is inlined — so the
 * artifact runs standalone with only Node ≥ 18 present, and there is a single
 * source of truth for the format logic (no duplication).
 */
import esbuild from 'esbuild';

await esbuild.build({
  entryPoints: ['src/cli.ts'],
  bundle: true,
  platform: 'node',
  target: 'node18',
  format: 'cjs',
  outfile: 'dist/noodl-mcp.cjs',
  sourcemap: false,
  logLevel: 'info'
});
