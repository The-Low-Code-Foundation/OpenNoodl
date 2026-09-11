/**
 * MCP-001 — the project verdict the settings section gates its Copy button on.
 *
 * `noodl-mcp` refuses to start on anything but a v2 directory, and it refuses *differently* for a
 * legacy project (there is a migration to point at) than for a directory that is not a project at
 * all. The button has to make the same three distinctions, from the same two files on disk, or it
 * hands out a command that dies at spawn time with a message the user never sees.
 *
 * The wording is asserted, not just the verdict: it is duplicated from `ProjectStore`'s
 * constructor on purpose (the editor cannot import `@noodl/mcp`), and duplicated strings drift.
 */
const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  describeProject,
  describeMcpFrontDoor,
  rejectUntrustedRegistration,
  USER_PROFILE_ENV
} = require('../../src/main/src/mcp/mcpFrontDoor');

let tmp;

beforeEach(() => {
  tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-front-door-'));
});

afterEach(() => {
  fs.rmSync(tmp, { recursive: true, force: true });
});

describe('describeProject', () => {
  it('answers null when nothing is open — which is not the same as a bad project', () => {
    expect(describeProject(null)).toBeNull();
    expect(describeProject(undefined)).toBeNull();
    expect(describeProject('')).toBeNull();
  });

  it('accepts a directory holding nodegx.project.json', () => {
    fs.writeFileSync(path.join(tmp, 'nodegx.project.json'), '{}');
    expect(describeProject(tmp)).toEqual({ dir: path.resolve(tmp), format: 'v2' });
  });

  it('accepts a directory holding only components/_registry.json', () => {
    // Both files are checked because `ProjectStore` checks both — a project written by an older
    // v2 editor has the registry and no project file.
    fs.mkdirSync(path.join(tmp, 'components'));
    fs.writeFileSync(path.join(tmp, 'components', '_registry.json'), '{}');
    expect(describeProject(tmp).format).toBe('v2');
  });

  it('sends a legacy project to the migration, in the server’s own words', () => {
    fs.writeFileSync(path.join(tmp, 'project.json'), '{}');
    const verdict = describeProject(tmp);
    expect(verdict.format).toBe('legacy');
    expect(verdict.message).toContain('legacy monolithic project.json');
    expect(verdict.message).toContain('Migrate it to the v2 format');
    expect(verdict.message).toContain('project settings → migrate');
  });

  it('says what is missing when the directory is not a project at all', () => {
    const verdict = describeProject(tmp);
    expect(verdict.format).toBe('not-a-project');
    expect(verdict.message).toContain('nodegx.project.json or components/_registry.json');
  });

  it('reports a directory that is gone rather than pretending it is not a project', () => {
    const missing = path.join(tmp, 'nope');
    expect(describeProject(missing)).toEqual({
      dir: missing,
      format: 'missing',
      message: `Project directory does not exist: ${missing}`
    });
  });

  it('reports a file as missing rather than opening it', () => {
    const file = path.join(tmp, 'a-file');
    fs.writeFileSync(file, '');
    expect(describeProject(file).format).toBe('missing');
  });
});

describe('describeMcpFrontDoor', () => {
  it('answers both servers and the project in one round trip', () => {
    fs.writeFileSync(path.join(tmp, 'nodegx.project.json'), '{}');
    const answer = describeMcpFrontDoor(tmp, { packagesRoots: [path.join(tmp, 'nowhere')] });

    expect(Object.keys(answer.servers).sort()).toEqual(['nodegx-observe', 'noodl-mcp']);
    expect(answer.project.format).toBe('v2');
    expect(typeof answer.isPackaged).toBe('boolean');
  });

  it('passes a miss through as a miss, with the paths it tried', () => {
    // The section turns this into "run the build", not into a command pointing at nothing.
    const answer = describeMcpFrontDoor(null, { packagesRoots: [path.join(tmp, 'nowhere')] });
    expect(answer.servers['noodl-mcp'].entry).toBeNull();
    expect(answer.servers['noodl-mcp'].probed.length).toBeGreaterThan(0);
    expect(answer.project).toBeNull();
  });

  it('carries the runtime, because the renderer cannot see the machine (BST-004)', () => {
    // ⚠️ Whether `node` resolves is a property of the machine. A renderer that guessed would guess
    // wrong on exactly the installs this phase is written for — a desktop app with no Node at all,
    // where `claude mcp add` would record a command that dies later with `spawn node ENOENT`.
    const answer = describeMcpFrontDoor(null, { packagesRoots: [path.join(tmp, 'nowhere')] });

    expect(typeof answer.runtime.hasNode).toBe('boolean');
    expect(['path', 'login-shell', 'none']).toContain(answer.runtime.detection);
    expect(answer.runtime.probed.length).toBeGreaterThan(0);
    // Electron is never null: we ship one by definition, which is the whole basis of the fallback.
    expect(answer.runtime.electron).toBe(process.execPath);
  });
});

/**
 * FIX-021 slice B — the environment half of the trust boundary.
 *
 * 🔴 These are the first assertions `rejectUntrustedRegistration` has ever had, and
 * they exist because this task gave it a second thing to guard. The registration
 * this function approves is written into the user's real `~/.claude.json` and later
 * spawned by their agent, so an environment variable that survives this check is an
 * environment variable in somebody's process. Before the profile there was exactly
 * one variable NodeGX emitted and no way for the renderer to add another; the moment
 * a path travels out to the renderer and back, "unchecked" stops being harmless.
 *
 * ⚠️ Every refusal below sits **beside an acceptance built the same way**. A
 * whitelist that refused everything would pass a suite fed only bad input, and would
 * ship a Connect button that never connects.
 */
describe('rejectUntrustedRegistration — the environment whitelist', () => {
  // 🔴 The bundle is FAKED rather than resolved off this machine.
  //
  // `rejectUntrustedRegistration` checks `args[0]` against what the resolver reports,
  // so a registration built from a real path only passes where somebody has run
  // `build:sidecars`. CI has not: the `test-editor-main` job runs neither that nor
  // anything else that writes `packages/noodl-mcp/dist`. A spec written against the
  // developer-machine answer would go red the first time it ran anywhere else —
  // and, worse, the refusal rows would go red for the WRONG REASON, reporting the
  // missing bundle while claiming to be about environment variables.
  //
  // One empty file in a temp `packagesRoots` makes every row here about `env` and
  // nothing else, which is the only thing this block is trying to measure.
  let bundleRoot;
  let entry;
  let options;

  beforeEach(() => {
    bundleRoot = fs.mkdtempSync(path.join(os.tmpdir(), 'mcp-bundle-'));
    entry = path.join(bundleRoot, 'noodl-mcp', 'dist', 'noodl-mcp.cjs');
    fs.mkdirSync(path.dirname(entry), { recursive: true });
    fs.writeFileSync(entry, '');
    options = { packagesRoots: [bundleRoot] };
  });

  afterEach(() => {
    fs.rmSync(bundleRoot, { recursive: true, force: true });
  });

  const registration = (env) => ({
    type: 'stdio',
    command: process.execPath,
    args: [entry, '--allow-writes'],
    env
  });

  // 🔴 The known-firing control. Without this row the refusals below cannot be told
  // from "the check refuses everything", and that mutant passes every one of them.
  it('accepts the two variables NodeGX actually emits', () => {
    expect(rejectUntrustedRegistration(registration({ ELECTRON_RUN_AS_NODE: '1' }), options)).toBeNull();
    expect(rejectUntrustedRegistration(registration({ [USER_PROFILE_ENV]: '/tmp/PREFERENCES.md' }), options)).toBeNull();
    expect(rejectUntrustedRegistration(registration({}), options)).toBeNull();
    expect(rejectUntrustedRegistration(registration(undefined), options)).toBeNull();
  });

  it('refuses a variable NodeGX does not emit, and names it', () => {
    // The shape of the thing: NODE_OPTIONS makes a spawned process run a file of the
    // attacker's choosing, and this registration is spawned by the user's agent.
    expect(rejectUntrustedRegistration(registration({ NODE_OPTIONS: '--require /tmp/evil.js' }), options)).toContain(
      'NODE_OPTIONS'
    );
  });

  it('refuses an unknown variable even when a legitimate one rides alongside', () => {
    // A denylist mindset waves this through on seeing a key it recognises.
    expect(
      rejectUntrustedRegistration(registration({ ELECTRON_RUN_AS_NODE: '1', LD_PRELOAD: '/tmp/x.so' }), options)
    ).toContain('LD_PRELOAD');
  });

  it('refuses a malformed environment rather than iterating it', () => {
    expect(rejectUntrustedRegistration(registration([]), options)).toContain('malformed');
    expect(rejectUntrustedRegistration(registration('ELECTRON_RUN_AS_NODE=1'), options)).toContain('malformed');
  });
});
