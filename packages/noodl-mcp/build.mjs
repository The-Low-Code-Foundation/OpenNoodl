/**
 * Bundles the MCP servers into self-contained CJS executables.
 *
 * The pure format engines (io/, schemas/, validation/) are bundled from
 * noodl-editor sources, and the enriched node catalog JSON is inlined — so the
 * artifact runs standalone with only Node ≥ 18 present, and there is a single
 * source of truth for the format logic (no duplication).
 *
 * **Two servers, two artifacts, no shared code path.**
 *
 * - `noodl-mcp` reads a project *directory* on disk and refuses legacy formats.
 * - `nodegx-observe` (OBS-004) attaches to a *running app* over the editor's
 *   local relay, needs no project access at all, and works on any format. It
 *   bundles OBS-002's `walkEngine.ts` from the editor sources — that module was
 *   written with zero imports specifically so it could run here, with no
 *   renderer and no Electron around it.
 *
 * They share this package for packaging reasons only: one dependency set, one
 * build, one `npm install`. Whether they should merge is an open question in the
 * OBS-004 task file; they are deliberately not coupled today.
 *
 * ⚠️ `nodegx-observe` targets **node22**, not node18: it uses the global
 * `WebSocket` that Node 22 ships, which is what lets it have no runtime
 * dependencies of its own. The repo already requires Node 22.
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

await esbuild.build({
  ...common,
  entryPoints: ['src/observe-cli.ts'],
  target: 'node22',
  outfile: 'dist/nodegx-observe.cjs'
});
