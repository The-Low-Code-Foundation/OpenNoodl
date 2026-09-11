/**
 * Headless kit extractor (CN-003, phase 69) — the MCP server's half of the
 * project catalog overlay.
 *
 * ## What it does
 *
 * Given a project directory, it registers that project's `noodl_modules` kits
 * against a live node register exactly the way the viewer does, then prints the
 * node-library payload `generateNodeLibrary` produces. The MCP server maps that
 * payload into catalog entries with `@nodegx/kit-catalog` — the *same* mapping
 * the editor runs over the payload it already has from `sendNodeLibrary`.
 *
 * ✅ **D3**: extraction happens here because the MCP server is headless and has
 * no viewer to ask. The editor extracts nothing.
 *
 * ## Why this is a separate process, and why it lives here
 *
 * It has to be bundled: the viewer packages ship TS/JSX written for a browser,
 * so `createNodeFromReactComponent` cannot simply be required. The catalog
 * generator solves the identical problem by bundling with esbuild and spawning
 * (`scripts/node-catalog/generate.js`), and this reuses that bundle
 * configuration rather than inventing a second one.
 *
 * 🔴 It lives in `packages/noodl-mcp/src/` rather than beside its sibling in
 * `scripts/node-catalog/` because **`scripts/` is outside every shipped
 * package's `files`/`build.files`**. An extractor there is reachable in a
 * checkout and absent from the packaged app — the failure mode phase 66 named
 * "driven ≠ shipped". `build.mjs` bundles this file into `dist/kit-extract.cjs`,
 * which `files: ["bin", "dist"]` already ships.
 *
 * Note that *build-time* imports from `scripts/` are fine and used below: esbuild
 * inlines them into the artifact. It is runtime resolution that does not ship.
 *
 * ## A separate process is also the containment
 *
 * 🔴 A kit's `index.js` is project code and can do anything at import time —
 * throw, spin, register a type that shadows a built-in, mutate the register. In
 * a child process, all of that is bounded: the MCP server reads a JSON document
 * or an error, and its own register is never touched. That also answers CN-003's
 * "must not leave the register mutated for the next project" trap by
 * construction — there is no next project in this process.
 *
 * Usage: `node kit-extract.cjs <projectDirectory>` → JSON on stdout.
 */
import '../../../../scripts/node-catalog/dom-shim';

const path = require('path');

const { scanModuleManifests } = require('@nodegx/module-inject');

// A kit's module scope reads `window.React` — the deployed viewer loads React as
// a global before module scripts run, which is what makes hand-written kits work
// with no bundler (see `custom-react-nodes-work-hand-written-today`). Registration
// never renders, so the real React is enough and no DOM is needed.
globalThis.React = require('react');

const NoodlRuntime = require('@noodl/runtime');
const generateNodeLibrary = require('@noodl/runtime/src/nodelibraryexport');
const registerViewerNodes = require('../../../noodl-viewer-react/src/register-nodes').default;
const { createNodeFromReactComponent } = require('../../../noodl-viewer-react/src/react-component-node');

/** Node types that were already registered before any kit ran — the built-ins. */
function makeRuntime() {
  return new NoodlRuntime({
    type: 'browser',
    runDeployed: true,
    dontCreateRootComponent: true,
    platform: {
      requestUpdate: (cb) => setTimeout(cb, 0),
      getCurrentTime: () => 0,
      objectToString: (o) => JSON.stringify(o)
    }
  });
}

async function main() {
  // 🔴 Resolved, not taken as given. `require()` reads a relative-looking path
  // as a *module id* — `require('noodl_modules/demo-kit/index.js')` searches
  // node_modules and fails — so a relative project directory made every kit
  // report as "cannot find module" while the extraction itself said it had
  // succeeded. Found by CN-003 slice 2b the first time something other than a
  // hand-typed absolute path called this.
  const projectDirectory = process.argv[2] && path.resolve(process.argv[2]);
  if (!projectDirectory) throw new Error('usage: kit-extract <projectDirectory>');

  const runtime = makeRuntime();
  registerViewerNodes(runtime);
  const builtinTypeNames = Object.keys(runtime.context.nodeRegister._constructors);

  // `dom-shim` installs a recursive-noop `Noodl`; replace it with one that
  // collects `defineModule` and still answers everything else with the noop,
  // because kit code touches other members of the global at module scope.
  const collected = [];
  const noop = new Proxy(function () {}, { get: () => noop, apply: () => noop });
  const base = { deployed: false, defineModule: (m) => collected.push(m) };
  globalThis.Noodl = new Proxy(base, { get: (t, k) => (k in t ? t[k] : noop) });
  globalThis.window.Noodl = globalThis.Noodl;

  // ✅ Reuses CN-001's scanner rather than adding a fourth one. It also carries
  // the manifest warnings, which are the only place a malformed or unreadable
  // manifest is ever mentioned — dropping them here would make a broken kit look
  // like a project with no kits.
  const scanned = await scanModuleManifests(projectDirectory);

  /** @type {Record<string, string[]>} module name → declared runtimes */
  const moduleRuntimes = {};
  const kits = [];
  const failures = [];
  const warnings = scanned.flatMap((s) => s.warnings);

  for (const entry of scanned) {
    const manifest = entry.manifest;
    if (!manifest || !manifest.main) continue; // iconsets and the like register no nodes

    const moduleName = manifest.name || entry.name;
    moduleRuntimes[moduleName] = manifest.runtimes || ['browser'];

    const indexPath = path.join(projectDirectory, entry.dirPath, manifest.main);
    const before = collected.length;

    // 🔴 A throwing kit must not take the whole extraction down: a project with
    // two kits, one broken, should still report the working one. CN-015 owns
    // turning `failures` into something a user sees.
    try {
      require(indexPath);
    } catch (error) {
      failures.push({
        kitModule: moduleName,
        dirPath: entry.dirPath,
        message: error && error.message ? error.message : String(error)
      });
      continue;
    }

    for (let i = before; i < collected.length; i++) {
      const module = collected[i];
      try {
        if (module.reactNodes) {
          const converted = module.reactNodes.map((definition) => createNodeFromReactComponent(definition));
          module.nodes = (module.nodes || []).concat(converted);
        }
        // `registerModule` stamps `module` onto every node it registers, and
        // that field is what marks a payload entry as a kit node downstream.
        module.name = module.name || moduleName;
        runtime.registerModule(module);
      } catch (error) {
        failures.push({
          kitModule: moduleName,
          dirPath: entry.dirPath,
          message: `registration failed: ${error && error.message ? error.message : String(error)}`
        });
      }
    }

    kits.push({ kitModule: moduleName, dirPath: entry.dirPath });
  }

  // The same function the viewer's `sendNodeLibrary` uses. Emitting the payload
  // rather than a finished overlay is deliberate: the mapping then lives in one
  // place that both this route and the editor's route call.
  const nodeLibrary = generateNodeLibrary(runtime.context.nodeRegister);

  process.stdout.write(
    JSON.stringify({
      projectDirectory,
      kits,
      moduleRuntimes,
      builtinTypeNames,
      warnings,
      failures,
      // Only the entries a kit registered; the built-in half is already in the
      // shipped catalog and shipping it through a pipe would be ~1MB per call.
      nodetypes: nodeLibrary.nodetypes.filter((n) => n.module)
    }) + '\n'
  );
}

main().catch((error) => {
  process.stderr.write((error && error.stack ? error.stack : String(error)) + '\n');
  process.exit(1);
});
