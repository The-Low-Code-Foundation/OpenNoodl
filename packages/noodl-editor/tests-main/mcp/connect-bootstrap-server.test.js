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
  readExistingRegistration,
  registerViaConfigFile,
  sameRegistration
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
 * FIX-008 A — "already connected" is a bad message, not an error.
 *
 * The report that opened this task is one sentence: *"I clicked the 'Connect MCP' in the launcher,
 * and it threw an error about already being connected."* `claude mcp add` refuses a name that
 * exists, and this module surfaced that refusal raw — a red failure for a state that was already
 * the one the user asked for.
 *
 * The assertions worth having are therefore about **what does not happen**: no spawn, no write, no
 * removal, when the config already holds exactly what we would put there.
 */
describe('FIX-008 A — a registration that is already there', () => {
  /** `~/.claude.json` with our own registration already under `mcpServers`. */
  const alreadyRegistered = (entry = REGISTRATION) => ({
    numStartups: 412,
    mcpServers: { nodegx: entry, 'someone-elses': { type: 'stdio', command: 'other' } }
  });

  it('reports success without spawning the CLI at all', () => {
    fs.writeFileSync(configPath, JSON.stringify(alreadyRegistered(), null, 2));
    const spawnSync = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));

    const result = connectBootstrapServer(REGISTRATION, 'claude mcp add …', {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(result.ok).toBe(true);
    expect(result.method).toBe('already-registered');
    expect(result.replaced).toBe(false);
    expect(result.message).toMatch(/already connected/i);
    // 🔴 The whole point: the end state was true, so nothing was asked of anything.
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('leaves the file byte-for-byte alone when there is no CLI either', () => {
    const before = JSON.stringify(alreadyRegistered(), null, 2);
    fs.writeFileSync(configPath, before);

    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    expect(result.ok).toBe(true);
    expect(result.method).toBe('already-registered');
    expect(fs.readFileSync(configPath, 'utf8')).toBe(before);
    // Not even a backup, because nothing was touched.
    expect(fs.existsSync(`${configPath}.nodegx-backup`)).toBe(false);
  });

  it('still counts as ours when the client added a key of its own', () => {
    // ⚠️ Re-registering on every click would undo whatever the client put there. We author four
    // fields; a fifth we did not write is not a different registration.
    fs.writeFileSync(
      configPath,
      JSON.stringify(alreadyRegistered({ ...REGISTRATION, disabled: false }), null, 2)
    );
    const spawnSync = jest.fn(() => ({ status: 0 }));

    const result = connectBootstrapServer(REGISTRATION, null, {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(result.method).toBe('already-registered');
    expect(spawnSync).not.toHaveBeenCalled();
  });

  it('🔴 does not mistake a project-scope entry for the user-scope one', () => {
    // Same name, different scope, different visibility. F94: they do not even see each other.
    fs.writeFileSync(
      configPath,
      JSON.stringify({ projects: { '/some/dir': { mcpServers: { nodegx: REGISTRATION } } } }, null, 2)
    );
    const spawnSync = jest.fn(() => ({ status: 0 }));

    const result = connectBootstrapServer(REGISTRATION, null, {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(result.method).toBe('cli');
    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync).toHaveBeenCalledWith('claude', cliArgs(REGISTRATION), expect.any(Object));
  });

  it('does not try to remove anything when the name is free', () => {
    const spawnSync = jest.fn(() => ({ status: 0 }));

    connectBootstrapServer(REGISTRATION, null, {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(spawnSync).toHaveBeenCalledTimes(1);
    expect(spawnSync.mock.calls[0][1]).not.toContain('remove');
  });

  it('a config it cannot parse changes nothing about how it behaves', () => {
    // We know nothing, so we claim nothing: the CLI is asked exactly as it was before this fix.
    fs.writeFileSync(configPath, '{ this is not json');
    const spawnSync = jest.fn(() => ({ status: 0 }));

    const result = connectBootstrapServer(REGISTRATION, null, {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(result.method).toBe('cli');
    expect(result.ok).toBe(true);
    expect(spawnSync).toHaveBeenCalledTimes(1);
  });
});

describe('FIX-008 A — a stale registration under our own name', () => {
  const stale = {
    type: 'stdio',
    command: '/Applications/NodeGX.app/Contents/MacOS/NodeGX',
    args: ['/an/older/install/noodl-mcp.cjs', '--allow-writes'],
    env: { ELECTRON_RUN_AS_NODE: '1' }
  };

  it('removes then adds, in that order, and says it replaced one', () => {
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { nodegx: stale } }, null, 2));
    const spawnSync = jest.fn(() => ({ status: 0, stdout: '', stderr: '' }));

    const result = connectBootstrapServer(REGISTRATION, null, {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync
    });

    expect(result.ok).toBe(true);
    expect(result.replaced).toBe(true);
    expect(result.message).toMatch(/replaced/i);

    // ⚠️ `claude mcp add` has no update verb, so this sequence is the only one that works.
    expect(spawnSync.mock.calls.map((call) => call[1])).toEqual([
      ['mcp', 'remove', '--scope', 'user', 'nodegx'],
      cliArgs(REGISTRATION)
    ]);
  });

  it('stops at a refused removal rather than letting the add fail with the old message', () => {
    fs.writeFileSync(configPath, JSON.stringify({ mcpServers: { nodegx: stale } }, null, 2));

    const result = connectBootstrapServer(REGISTRATION, 'claude mcp add …', {
      configPath,
      resolveClaudeCli: withCli('claude'),
      spawnSync: () => ({ status: 1, stdout: '', stderr: 'managed settings forbid this' })
    });

    expect(result.ok).toBe(false);
    expect(result.replaced).toBe(false);
    expect(result.detail).toMatch(/managed settings forbid this/);
    // 🔴 The asymmetry still holds: a CLI that refused is not routed around.
    expect(JSON.parse(fs.readFileSync(configPath, 'utf8')).mcpServers.nodegx).toEqual(stale);
    // And the route out is still on screen.
    expect(result.command).toBe('claude mcp add …');
  });

  it('replaces it on the file route, and says so', () => {
    fs.writeFileSync(
      configPath,
      JSON.stringify({ numStartups: 412, mcpServers: { nodegx: stale, other: { command: 'x' } } }, null, 2)
    );

    const result = connectBootstrapServer(REGISTRATION, null, { configPath, resolveClaudeCli: noCli });

    expect(result.ok).toBe(true);
    expect(result.method).toBe('config-file');
    expect(result.replaced).toBe(true);
    expect(result.message).toMatch(/replaced/i);

    const after = JSON.parse(fs.readFileSync(configPath, 'utf8'));
    expect(after.mcpServers.nodegx).toEqual(REGISTRATION);
    expect(after.mcpServers.other).toEqual({ command: 'x' });
    expect(after.numStartups).toBe(412);
  });
});

describe('FIX-008 A — reading and comparing', () => {
  it('finds nothing in a file that does not exist', () => {
    expect(readExistingRegistration(configPath, {})).toEqual({ readable: true, entry: null, detail: null });
  });

  it('says so, rather than guessing, when the file will not parse', () => {
    fs.writeFileSync(configPath, 'not json');
    expect(readExistingRegistration(configPath, {}).readable).toBe(false);
  });

  it('treats an absent env and an empty one as the same thing', () => {
    const bare = { type: 'stdio', command: 'node', args: ['/x.cjs'] };
    expect(sameRegistration(bare, { ...bare, env: {} })).toBe(true);
  });

  it('sees a changed bundle path, a changed runtime and a changed env', () => {
    expect(sameRegistration(REGISTRATION, { ...REGISTRATION, args: ['/other.cjs', '--allow-writes'] })).toBe(false);
    expect(sameRegistration(REGISTRATION, { ...REGISTRATION, command: 'node' })).toBe(false);
    expect(sameRegistration(REGISTRATION, { ...REGISTRATION, env: {} })).toBe(false);
  });

  it('sees a dropped argument, which same-length compares would miss', () => {
    expect(sameRegistration(REGISTRATION, { ...REGISTRATION, args: [REGISTRATION.args[0]] })).toBe(false);
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
