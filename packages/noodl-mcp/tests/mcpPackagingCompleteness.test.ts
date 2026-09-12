/**
 * MCP-003 — every bundle the server spawns beside itself is actually shipped.
 *
 * 🔴 **The defect this exists to stop, measured 2026-09-12 against the installed 0.2.3 app.**
 * `build.mjs` emits four artifacts into `dist/`; `extraResources` shipped two of them. So
 * `kit-extract.cjs` and `cloud-bundle.cjs` existed in every checkout and in no installed app,
 * and `get_project_info` on the shipped server answered:
 *
 *     "kits": { "modules": [], "unavailable": "The kit extractor bundle is not present in this
 *      installation … Run `npm run build` in packages/noodl-mcp" }
 *
 * Every project the editor creates has a `noodl_modules/` directory (the starter modules), so the
 * cheap "no modules" exit never fired and **every** project on **every** install hit it. The
 * remedy the message offers is meaningless to someone who installed a `.dmg`.
 *
 * ⚠️ **There was already a gate here, and it had a hole exactly the shape of the defect.**
 * `hls008ExportReact.test.ts` asserts the *catalog* is shipped beside the bundle — the same
 * requirement, checked for one file by name. A second file with the identical requirement was
 * added later and nothing noticed, because that assertion names `node-catalog.json` rather than
 * asking what the server actually reaches for.
 *
 * So this one does not name files. It reads the resolvers' own source for the
 * `path.resolve(__dirname, '<x>.cjs')` shape — which is how a bundle says "I am spawned from
 * beside noodl-mcp.cjs" — and requires each name it finds to be built AND shipped into the
 * bundle's directory. A fifth spawned bundle is covered the day it is written, without editing
 * this file.
 */

import fs from 'fs';
import path from 'path';

const mcpRoot = path.join(__dirname, '..');
const srcRoot = path.join(mcpRoot, 'src');
const buildScript = path.join(mcpRoot, 'build.mjs');
const editorPackageJson = path.join(mcpRoot, '..', 'noodl-editor', 'package.json');

/** Every `.ts`/`.js` file under `src/`, so the scan cannot miss a resolver in a new directory. */
function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...sourceFiles(full));
    else if (/\.(ts|js)$/.test(entry.name)) out.push(full);
  }
  return out;
}

/**
 * The bundles the server spawns from its own directory, read off the resolvers.
 *
 * `path.resolve(__dirname, 'kit-extract.cjs')` is the packaged candidate in every one of these
 * resolvers — `__dirname` is `dist/` in a checkout and `Resources/noodl-mcp/` in an app, which is
 * precisely why the file has to be shipped into that directory.
 */
function spawnedSiblingBundles(): string[] {
  const pattern = /path\.resolve\(\s*__dirname\s*,\s*['"]([\w.-]+\.cjs)['"]\s*\)/g;
  const found = new Set<string>();
  for (const file of sourceFiles(srcRoot)) {
    const text = fs.readFileSync(file, 'utf8');
    for (const m of text.matchAll(pattern)) found.add(m[1]);
  }
  return [...found].sort();
}

interface EditorManifest {
  build: { extraResources: Array<{ from: string; to: string }> };
}

function extraResources(): Array<{ from: string; to: string }> {
  const manifest = JSON.parse(fs.readFileSync(editorPackageJson, 'utf8')) as EditorManifest;
  return manifest.build.extraResources;
}

describe('MCP-003 — the packaged server is complete', () => {
  const resources = extraResources();
  const bundle = resources.find((r) => r.from.endsWith('noodl-mcp/dist/noodl-mcp.cjs'));
  const shippedDir = path.posix.dirname(bundle!.to);

  it('finds the resolvers at all — a scan that finds nothing would pass every arm below', () => {
    // The guard against the vacuous pass. If the resolver idiom is ever rewritten, this arm goes
    // red and says so, rather than the suite quietly asserting nothing about an empty list.
    const names = spawnedSiblingBundles();
    expect(names.length).toBeGreaterThanOrEqual(2);
    expect(names).toEqual(expect.arrayContaining(['cloud-bundle.cjs', 'kit-extract.cjs']));
  });

  it('ships the server bundle itself into a directory of its own', () => {
    expect(bundle).toBeDefined();
    expect(shippedDir).toBe('noodl-mcp');
  });

  it.each(spawnedSiblingBundles())(
    '%s is BUILT by build.mjs and SHIPPED beside the server bundle',
    (name) => {
      const build = fs.readFileSync(buildScript, 'utf8');

      // Built: the build script names it as an output. `kit-extract.cjs` is emitted through
      // `extractorBuildOptions(...)` rather than a literal `outfile:`, so match the name anywhere
      // rather than pinning one spelling of the call.
      expect({ file: name, builtBy: build.includes(name) }).toEqual({ file: name, builtBy: true });

      // Shipped: into the SAME directory as noodl-mcp.cjs, because that is what `__dirname`
      // resolves to for the spawning code.
      const wantedTo = path.posix.join(shippedDir, name);
      const entry = resources.find((r) => r.to === wantedTo);
      expect({ file: name, shippedTo: entry ? entry.to : null }).toEqual({
        file: name,
        shippedTo: wantedTo
      });
      expect(entry!.from).toBe(`../noodl-mcp/dist/${name}`);
    }
  );
});
