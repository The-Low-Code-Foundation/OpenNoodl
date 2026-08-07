/**
 * MCP-002 — the MCP bundle resolver.
 *
 * The thing worth asserting is not "it joins paths". It is that **a miss is reported as a miss,
 * with everywhere it looked** — because the caller (MCP-001's settings section) hands the user a
 * `claude mcp add … node <path>` command, and a resolver that guessed would emit a command that
 * fails at spawn time on a stranger's machine with no clue why.
 *
 * The repo-relative and `resourcesPath` candidates are exercised through the env override and
 * `process.resourcesPath` respectively; `app.getAppPath()` is not, because `require('electron')`
 * has no `app` in a plain-Node runner — the code path is written to tolerate exactly that.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const { MCP_SERVERS, resolveMcpServer, resolveMcpServers } = require('../../src/main/src/mcp/resolveMcpServer');

const ENV_KEYS = ['NOODL_MCP_ENTRY', 'NODEGX_OBSERVE_ENTRY'];

let tmp;
let savedEnv;
let savedResourcesPath;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-resolve-'));
  savedEnv = {};
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key];
    delete process.env[key];
  }
  savedResourcesPath = process.resourcesPath;
});

afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
  process.resourcesPath = savedResourcesPath;
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** Lay out a packaged app's Resources directory: <resources>/<name>/<name>.cjs. */
function packagedResources(names) {
  const resources = path.join(tmp, 'Resources');
  for (const name of names) {
    fs.mkdirSync(path.join(resources, name), { recursive: true });
    fs.writeFileSync(path.join(resources, name, `${name}.cjs`), '// bundle\n');
  }
  return resources;
}

/**
 * A checkout, with `packages/<name>/dist/<name>.cjs` present for `built`.
 *
 * ⚠️ Passed as `packagesRoots` rather than relying on the real repo: this suite runs *inside* a
 * checkout where both bundles may well be built, so "nobody has run the build" is not a state it
 * can otherwise reach — and it is the state the whole `entry: null` contract exists for.
 */
function checkout(built) {
  const root = path.join(tmp, 'packages');
  for (const name of built) {
    fs.mkdirSync(path.join(root, name, 'dist'), { recursive: true });
    fs.writeFileSync(path.join(root, name, 'dist', `${name}.cjs`), '// bundle\n');
  }
  fs.mkdirSync(root, { recursive: true });
  return { packagesRoots: [root] };
}

describe('resolving an MCP server bundle', () => {
  it('knows both servers and nothing else', () => {
    expect(Object.keys(MCP_SERVERS).sort()).toEqual(['nodegx-observe', 'noodl-mcp']);
    // A typo'd name must not resolve to null and get rendered as "not built yet" — that would
    // send someone off running a build that was never going to help.
    expect(() => resolveMcpServer('nodegx-mcp')).toThrow(/Unknown MCP server/);
  });

  it('finds the built bundle in a dev checkout', () => {
    process.resourcesPath = path.join(tmp, 'no-resources');
    const dev = checkout(['noodl-mcp', 'nodegx-observe']);

    const resolved = resolveMcpServer('nodegx-observe', dev);
    expect(resolved.entry).toBe(
      path.join(dev.packagesRoots[0], 'nodegx-observe', 'dist', 'nodegx-observe.cjs')
    );
  });

  it('finds the bundle in a packaged app, under resourcesPath', () => {
    process.resourcesPath = packagedResources(['noodl-mcp', 'nodegx-observe']);

    // Same call, no dev checkout in sight — the criterion is that one code path serves both.
    const resolved = resolveMcpServer('nodegx-observe', checkout([]));
    expect(resolved.entry).toBe(path.join(process.resourcesPath, 'nodegx-observe', 'nodegx-observe.cjs'));
    expect(fs.existsSync(resolved.entry)).toBe(true);
  });

  it('returns entry: null and everywhere it looked when nothing is built', () => {
    // ⚠️ The dev-checkout state before anyone runs the package builds. `null` is a real answer:
    // it is what lets the caller say "run npm run build" instead of emitting a command that
    // points at a missing file.
    process.resourcesPath = path.join(tmp, 'nothing-here');

    const resolved = resolveMcpServer('noodl-mcp', checkout([]));
    expect(resolved.entry).toBeNull();
    expect(resolved.probed.length).toBeGreaterThan(0);
    // The list of paths tried is the bug report — it must name the file being looked for.
    for (const candidate of resolved.probed) expect(candidate).toMatch(/noodl-mcp\.cjs$/);
    expect(resolved.probed).toContain(path.join(process.resourcesPath, 'noodl-mcp', 'noodl-mcp.cjs'));
  });

  it('honours an explicit entry override before anything else', () => {
    const override = path.join(tmp, 'somewhere-else.cjs');
    fs.writeFileSync(override, '// bundle\n');
    process.env.NOODL_MCP_ENTRY = override;
    process.resourcesPath = packagedResources(['noodl-mcp']);

    expect(resolveMcpServer('noodl-mcp', checkout(['noodl-mcp'])).entry).toBe(override);
  });

  it('resolves both servers in one call, carrying what each one is for', () => {
    process.resourcesPath = packagedResources(['noodl-mcp', 'nodegx-observe']);

    const all = resolveMcpServers(checkout([]));
    expect(Object.keys(all).sort()).toEqual(['nodegx-observe', 'noodl-mcp']);
    expect(all['noodl-mcp'].entry).toMatch(/noodl-mcp\.cjs$/);
    expect(all['nodegx-observe'].entry).toMatch(/nodegx-observe\.cjs$/);
    // The captions belong next to the paths, not in the panel: two servers, one description of
    // each, wherever they are rendered.
    expect(all['nodegx-observe'].what).toMatch(/editor running/);
  });
});
