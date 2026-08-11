/**
 * BST-003 — the two routes the launcher card's button can take, and the things it must never do.
 *
 * The write path is the one that needs proving. `~/.claude.json` is not a config file we can
 * rewrite: measured on a real machine it is 64KB of the user's own state across 58 top-level keys —
 * every project they have opened, their history, their onboarding flags — of which `mcpServers`
 * is one.
 * So the assertions here are mostly about what *survives* the write, and about the case where we
 * must refuse to write at all.
 *
 * The CLI path is asserted for argument order, because F78 established that reading the string is
 * not sufficient to know it parses: `-e` is variadic, and one position earlier it silently eats the
 * server name.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  cliArgs,
  connectBootstrapServer,
  registerViaConfigFile
} = require('../../src/main/src/mcp/connectBootstrapServer');

/** A registration of the shape `buildBootstrapCommand` emits for the Electron runtime. */
const REGISTRATION = {
  type: 'stdio',
  command: '/Applications/NodeGX.app/Contents/MacOS/NodeGX',
  args: ['/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs', '--allow-writes'],
  env: { ELECTRON_RUN_AS_NODE: '1' }
};

let tmp;
let configPath;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'bst-003-'));
  configPath = path.join(tmp, '.claude.json');
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

/** No CLI anywhere — the desktop-app user, which F14 says is the usual case. */
const noCli = () => ({ found: false, exec: null, detection: 'none', probed: ['claude (on this process’s PATH)'] });

/** A CLI that is present. `spawnSync` is supplied per-test to say how it behaves. */
const withCli = (exec) => () => ({ found: true, exec, detection: 'path', probed: [] });

describe('cliArgs', () => {
  it('puts -e AFTER the server name, because it is variadic and would eat it (F78)', () => {
    const args = cliArgs(REGISTRATION);

    const nameAt = args.indexOf('nodegx');
    const envAt = args.indexOf('-e');

    expect(nameAt).toBeGreaterThan(-1);
    expect(envAt).toBeGreaterThan(nameAt);
  });

  it('registers the bare name at user scope, with --allow-writes past the separator', () => {
    expect(cliArgs(REGISTRATION)).toEqual([
      'mcp',
      'add',
      '--scope',
      'user',
      'nodegx',
      '-e',
      'ELECTRON_RUN_AS_NODE=1',
      '--',
      REGISTRATION.command,
      REGISTRATION.args[0],
      '--allow-writes'
    ]);
  });

  it('splits an env value containing = on the first one only', () => {
    const args = cliArgs({ ...REGISTRATION, env: { TOKEN: 'a=b=c' } });
    expect(args[args.indexOf('-e') + 1]).toBe('TOKEN=a=b=c');
  });
});

describe('the CLI route', () => {
  it('spawns the CLI and reports where the registration went and how to remove it', () => {
    const spawnSync = jest.fn(() => ({ status: 0, stdout: 'Added stdio MCP server nodegx', stderr: '' }));

    const result = connectBootstrapServer(REGISTRATION, 'claude mcp add …', {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(result.ok).toBe(true);
    expect(result.method).toBe('cli');
    expect(spawnSync).toHaveBeenCalledWith('claude', cliArgs(REGISTRATION), expect.any(Object));

    // ⚠️ --scope user registers the server in every directory. A button in an app that silently
    // does that is the uninstall problem by another door, so success has to say both things.
    expect(result.message).toMatch(/every folder/i);
    expect(result.removeCommand).toBe('claude mcp remove --scope user nodegx');
  });

  it('does NOT write the config when the CLI is present and refuses', () => {
    fs.writeFileSync(configPath, JSON.stringify({ projects: { a: 1 } }, null, 2));

    const result = connectBootstrapServer(REGISTRATION, 'claude mcp add …', {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync: () => ({ status: 1, stdout: '', stderr: 'managed settings forbid this' })
    });

    expect(result.ok).toBe(false);
    expect(result.method).toBe('cli');
    // The CLI's own words: more specific than anything we could infer from an exit code.
    expect(result.detail).toMatch(/managed settings forbid this/);

    // 🔴 The asymmetry that matters. "No CLI" is an absence we route around; "the CLI said no" is
    // the tool telling us something, and writing behind its back is the invisible contradictory
    // state this phase exists to stop.
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8'))).toEqual({ projects: { a: 1 } });
  });

  it('reports a spawn error rather than throwing', () => {
    const result = connectBootstrapServer(REGISTRATION, null, {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync: () => ({ error: new Error('ENOENT'), status: null })
    });

    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/ENOENT/);
  });
});

describe('the config-file route, when there is no CLI', () => {
  it('adds the server without disturbing any of the user’s other state', () => {
    const before = {
      numStartups: 412,
      userID: 'abc',
      projects: { '/some/path': { history: [1, 2, 3] } },
      mcpServers: { 'nodegx-observe': { type: 'stdio', command: 'node', args: ['/observe.cjs'], env: {} } }
    };
    fs.writeFileSync(configPath, JSON.stringify(before, null, 2));

    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    expect(result.ok).toBe(true);
    expect(result.method).toBe('config-file');

    const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(after.numStartups).toBe(412);
    expect(after.userID).toBe('abc');
    expect(after.projects).toEqual(before.projects);

    // The sibling registration survives; ours is added beside it.
    expect(after.mcpServers['nodegx-observe']).toEqual(before.mcpServers['nodegx-observe']);
    expect(after.mcpServers.nodegx).toEqual(REGISTRATION);
  });

  it('creates the file when Claude Code has never run', () => {
    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    expect(result.ok).toBe(true);
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8')).mcpServers.nodegx).toEqual(REGISTRATION);
    // Nothing to back up when there was nothing there.
    expect(result.backupPath).toBeNull();
  });

  it('backs the file up before touching it', () => {
    fs.writeFileSync(configPath, JSON.stringify({ projects: { a: 1 } }, null, 2));

    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    expect(result.backupPath).toBe(`${configPath}.nodegx-backup`);
    expect(JSON.parse(fs.readFileSync(result.backupPath, 'utf8'))).toEqual({ projects: { a: 1 } });
  });

  it('re-registering is idempotent rather than duplicating', () => {
    connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });
    connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(Object.keys(after.mcpServers)).toEqual(['nodegx']);
  });

  it('🔴 REFUSES a file it cannot parse instead of replacing it', () => {
    // A file we cannot read is far likelier to be one we must not destroy than one we should
    // overwrite — and the user still has the command.
    const garbage = '{ "projects": { unclosed';
    fs.writeFileSync(configPath, garbage);

    const result = connectBootstrapServer(REGISTRATION, 'claude mcp add …', {
      configPath,
      resolveClaudeCli: noCli
    });

    expect(result.ok).toBe(false);
    expect(result.detail).toMatch(/not valid JSON/);
    expect(fs.readFileSync(configPath, 'utf8')).toBe(garbage);
    // The failure is legible and leaves the user somewhere to go.
    expect(result.command).toBe('claude mcp add …');
  });

  it('refuses a JSON file that is not an object', () => {
    fs.writeFileSync(configPath, '[1,2,3]');

    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    expect(result.ok).toBe(false);
    expect(fs.readFileSync(configPath, 'utf8')).toBe('[1,2,3]');
  });

  it('leaves no temp file behind on success', () => {
    connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });
    expect(fs.existsSync(`${configPath}.nodegx-tmp`)).toBe(false);
  });

  it('tells the user to restart Claude Code, because it reads this at startup', () => {
    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });
    expect(result.message).toMatch(/restart/i);
  });

  it('writes the file readable only by its owner', () => {
    registerViaConfigFile(configPath, REGISTRATION, {});
    // It sits beside credentials and project history; it should not widen on our account.
    expect(fs.statSync(configPath).mode & 0o077).toBe(0);
  });
});

describe('a registration that could not be built', () => {
  it('fails with a reason rather than registering nothing', () => {
    const result = connectBootstrapServer(null, null, { configPath, resolveClaudeCli: noCli });

    expect(result.ok).toBe(false);
    expect(result.method).toBeNull();
    expect(result.detail).toMatch(/bundle was not found/);
    expect(fs.existsSync(configPath)).toBe(false);
  });
});

/**
 * BST-003 — the trust boundary.
 *
 * The renderer composes the registration and this handler spawns from it, so "run this binary with
 * these arguments, from the main process" is exactly what an attacker who reached the renderer
 * would want. Main therefore re-resolves the bundle itself and compares, rather than believing what
 * it was handed.
 */
describe('rejectUntrustedRegistration', () => {
  const { rejectUntrustedRegistration } = require('../../src/main/src/mcp/mcpFrontDoor');
  const { resolveMcpServers } = require('../../src/main/src/mcp/resolveMcpServer');

  /** Whatever this checkout actually resolves to, so the test is about the rule, not a fixture. */
  const realEntry = () => resolveMcpServers()['noodl-mcp'].entry;

  it('accepts the registration NodeGX itself would build', () => {
    const entry = realEntry();
    if (!entry) return; // no bundle built in this checkout; the other cases still hold

    expect(
      rejectUntrustedRegistration({ command: process.execPath, args: [entry, '--allow-writes'] })
    ).toBeNull();
  });

  it('🔴 refuses an arbitrary executable', () => {
    const entry = realEntry();
    expect(
      rejectUntrustedRegistration({ command: '/bin/sh', args: [entry || '/x', '--allow-writes'] })
    ).toMatch(/runtime/i);
  });

  it('🔴 refuses a registration pointing somewhere other than our own bundle', () => {
    expect(
      rejectUntrustedRegistration({ command: process.execPath, args: ['/tmp/evil.js', '--allow-writes'] })
    ).toMatch(/authoring server/i);
  });

  it('🔴 refuses smuggled extra arguments', () => {
    const entry = realEntry();
    if (!entry) return;

    expect(
      rejectUntrustedRegistration({ command: process.execPath, args: [entry, '--allow-writes', '--evil'] })
    ).toMatch(/does not emit/i);
  });

  it('refuses a malformed or absent registration rather than throwing', () => {
    expect(rejectUntrustedRegistration(null)).toBeTruthy();
    expect(rejectUntrustedRegistration({})).toBeTruthy();
    expect(rejectUntrustedRegistration({ command: 'node', args: [] })).toBeTruthy();
  });
});
