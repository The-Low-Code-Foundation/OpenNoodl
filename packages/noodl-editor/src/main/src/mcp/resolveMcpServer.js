/**
 * MCP-002 — where the two MCP server bundles live, in dev and in a packaged app.
 *
 * The editor does not *run* these. They are stdio servers an MCP client (Claude Code) spawns
 * itself, with `node <path>` — so the only thing the editor has to know is the path, and the
 * only reason that is hard is that it differs between a checkout and a shipped app:
 *
 *   - dev: `packages/<name>/dist/<name>.cjs`, built by `npm run build` in that package
 *   - packaged: `<Resources>/<name>/<name>.cjs`, put there by electron-builder's
 *     `extraResources` (see packages/noodl-editor/package.json)
 *
 * ⚠️ **`entry: null` is a real state, not an error.** In a checkout where nobody has run the
 * package builds, neither bundle exists — and the right answer then is "run `npm run build`",
 * not a copy-pasteable command pointing at a file that is not there. So this returns the miss
 * and lets the caller decide, and returns `probed` for the same reason `ServiceSupervisor` does:
 * when it fails, the list of paths tried *is* the bug report.
 *
 * ⚠️ **`extraResources`, not `files`.** These bundles must land *outside* the asar archive,
 * because the process that reads them is an external `node`, which cannot see inside one.
 *
 * The candidate order is `ServiceSupervisor.resolveServiceEntry`'s, deliberately — same problem,
 * same shape — but it is one function for two servers rather than that function copied twice.
 *
 * @module main/src/mcp/resolveMcpServer
 */

const fs = require('fs');
const path = require('path');

/**
 * The servers this knows about.
 *
 * Both follow one convention — package `<name>`, bundle `dist/<name>.cjs` — which is what lets
 * one resolver serve both. `label` and `what` are here rather than in the UI so the two servers
 * are described in one place; MCP-001 renders them.
 */
const MCP_SERVERS = {
  'noodl-mcp': {
    label: 'Authoring',
    what: 'Reads and writes the project directory on disk. Does not need the editor running.'
  },
  'nodegx-observe': {
    label: 'Observe',
    what: 'Observes and drives the running app over the editor’s relay. Needs the editor running.'
  }
};

/**
 * Where the monorepo's `packages/` directory is, from here.
 *
 * ⚠️ Two guesses, not one: `__dirname` differs between a source run
 * (…/src/main/src/mcp) and the webpack main bundle (…/src/main), so both depths are probed —
 * the same reason `ServiceSupervisor` does. In a packaged app neither exists and both simply
 * miss, which is what the `resourcesPath` candidate below is for.
 */
function defaultPackagesRoots() {
  return [
    path.resolve(__dirname, '..', '..', '..'), // from the bundle: packages/noodl-editor/src/main
    path.resolve(__dirname, '..', '..', '..', '..', '..') // from source: …/src/main/src/mcp
  ];
}

/**
 * Locate one MCP server bundle.
 *
 * @param {'noodl-mcp'|'nodegx-observe'} name
 * @param {{ packagesRoots?: string[] }} [options] `packagesRoots` overrides the dev lookup — it
 *   is how a test can pose a checkout in which nothing has been built, which is otherwise
 *   unposeable from inside a checkout where it has.
 * @returns {{ entry: string|null, probed: string[] }}
 */
function resolveMcpServer(name, options) {
  if (!Object.prototype.hasOwnProperty.call(MCP_SERVERS, name)) {
    throw new Error(`Unknown MCP server "${name}". Known: ${Object.keys(MCP_SERVERS).join(', ')}`);
  }

  const probed = [];
  const file = `${name}.cjs`;

  // An escape hatch for an unusual layout — same contract as NODEGX_BACKEND_ENTRY.
  const override = process.env[name === 'noodl-mcp' ? 'NOODL_MCP_ENTRY' : 'NODEGX_OBSERVE_ENTRY'];
  if (override) {
    probed.push(override);
    if (fs.existsSync(override)) return { entry: override, probed };
  }

  const candidates = [];

  const roots = (options && options.packagesRoots) || defaultPackagesRoots();
  for (const root of roots) candidates.push(path.join(root, name, 'dist', file));

  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { app } = require('electron');
    if (app) candidates.push(path.join(app.getAppPath(), '..', name, file));
  } catch (e) {
    /* electron not available (tests) */
  }

  if (process.resourcesPath) {
    candidates.push(path.join(process.resourcesPath, name, file));
  }

  for (const candidate of candidates) {
    probed.push(candidate);
    if (fs.existsSync(candidate)) return { entry: candidate, probed };
  }

  return { entry: null, probed };
}

/** Both servers at once, keyed by name — what a settings section needs. */
function resolveMcpServers(options) {
  const result = {};
  for (const name of Object.keys(MCP_SERVERS)) {
    result[name] = Object.assign({ name }, MCP_SERVERS[name], resolveMcpServer(name, options));
  }
  return result;
}

module.exports = { MCP_SERVERS, resolveMcpServer, resolveMcpServers };
