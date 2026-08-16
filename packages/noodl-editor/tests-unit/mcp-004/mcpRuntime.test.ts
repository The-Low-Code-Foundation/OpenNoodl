/**
 * BST-004 — which runtime the emitted command names.
 *
 * The failure this guards is not a wrong string. It is a command that `claude mcp add` **records
 * successfully** and that then dies later, inside the client, with `spawn node ENOENT` — a
 * connection reported as working that cannot work. So the assertions here are about the two ways
 * that happens: emitting `node` on a machine that has none, and — the regression risk in the other
 * direction — emitting the strange Electron form on a machine that was working fine.
 */

import {
  buildMcpCommands,
  chooseRuntime,
  McpFrontDoor,
  McpRuntime
} from '../../src/editor/src/views/panels/SettingsPanel/sections/mcpCommands';

const ELECTRON = '/Applications/NodeGX.app/Contents/MacOS/NodeGX';
const AUTHORING_ENTRY = '/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs';

function runtime(overrides: Partial<McpRuntime> = {}): McpRuntime {
  return { hasNode: true, nodePath: null, electron: ELECTRON, detection: 'path', probed: [], ...overrides };
}

function frontDoor(rt: McpRuntime): McpFrontDoor {
  return {
    servers: {
      'noodl-mcp': { name: 'noodl-mcp', label: 'Authoring', what: '…', entry: AUTHORING_ENTRY, probed: [] },
      'nodegx-observe': {
        name: 'nodegx-observe',
        label: 'Observe',
        what: '…',
        entry: '/Applications/NodeGX.app/Contents/Resources/nodegx-observe/nodegx-observe.cjs',
        probed: []
      }
    },
    project: { dir: '/Users/me/Documents/My App', format: 'v2' },
    runtime: rt,
    isPackaged: true
  };
}

const authoringOf = (rt: McpRuntime, preference?: 'prefer-node' | 'always-electron') =>
  buildMcpCommands(frontDoor(rt), preference)[0];

describe('the settings section on a machine that has node', () => {
  it('emits exactly the command it shipped with — character for character', () => {
    // ⚠️ The regression this task could most easily cause. Decision 8's reasoning survives intact
    // for this audience, and `node <path>` is legible, portable, and pasteable into any client.
    //
    // ⚠️ FIX-008 C changed `--scope user` to `--scope project` here, deliberately and for a
    // measured reason (see mcp-001). This fence is about the *runtime* half of the string — that
    // an audience with node keeps getting `node <path>` and never the Electron form — and that
    // half is unchanged. The scope is pinned on purpose in mcp-001, not weakened here.
    expect(authoringOf(runtime()).command).toBe(
      'claude mcp add --scope project nodegx-my-app -- node ' +
        `${AUTHORING_ENTRY} "/Users/me/Documents/My App" --allow-writes`
    );
  });

  it('says nothing about runtimes, because there is nothing unusual to explain', () => {
    expect(authoringOf(runtime()).runtimeNote).toBeNull();
  });

  it('still emits the bare word `node` when only the login shell could find it', () => {
    // ⚠️ nvm installs to ~/.nvm/versions/node/<v>/bin and puts it on PATH from a shell rc file, so
    // a Finder-launched app misses it and only `$SHELL -lic` finds it. The command is pasted into
    // that same shell — where the bare word resolves — and baking in the absolute path would
    // hard-code a version directory that breaks on the next `nvm use`.
    const command = authoringOf(
      runtime({ detection: 'login-shell', nodePath: '/Users/me/.nvm/versions/node/v22.22.0/bin/node' })
    ).command;
    expect(command).toContain('-- node ');
    expect(command).not.toContain('.nvm');
  });
});

describe('the settings section on a machine with no node at all', () => {
  const none = runtime({ hasNode: false, detection: 'none', probed: ['node (on this process’s PATH)'] });

  it('runs the server with the Electron binary the install already contains', () => {
    expect(authoringOf(none).command).toBe(
      'claude mcp add --scope project nodegx-my-app -e ELECTRON_RUN_AS_NODE=1 -- ' +
        `${ELECTRON} ${AUTHORING_ENTRY} "/Users/me/Documents/My App" --allow-writes`
    );
  });

  it('sets ELECTRON_RUN_AS_NODE, without which the binary boots a GUI app instead', () => {
    // ⚠️ Measured, because the naive test passes either way: without the variable the binary boots
    // as a full Electron app (`process.type === 'browser'`, a dock icon, an event loop that never
    // exits) and *still* serves stdio correctly. Only the variable makes it a plain Node process.
    expect(authoringOf(none).command).toContain('-e ELECTRON_RUN_AS_NODE=1');
  });

  it('puts -e AFTER the server name, because the flag is variadic and would eat it', () => {
    // 🔴 Not cosmetic, and not catchable by reading the string. `-e, --env <env...>` is variadic:
    // placed before the name, it consumes the name as a second variable and the real CLI fails
    // with `Invalid environment variable format: nodegx`. Measured against `claude mcp add`.
    const command = authoringOf(none).command as string;
    expect(command.indexOf('nodegx-my-app')).toBeLessThan(command.indexOf('-e ELECTRON_RUN_AS_NODE=1'));
    expect(command.indexOf('-e ELECTRON_RUN_AS_NODE=1')).toBeLessThan(command.indexOf(' -- '));
  });

  it('names the substitution instead of quietly handing over a different command', () => {
    // The whole failure mode is something that happens out of sight. A command that silently
    // changed shape is the same class of problem in miniature.
    expect(authoringOf(none).runtimeNote).toContain('No Node runtime was found');
  });

  it('still refuses to emit anything when the bundle itself is missing', () => {
    // Runtime selection must not resurrect a command for a server that is not on disk.
    const door = frontDoor(none);
    door.servers['noodl-mcp'] = { ...door.servers['noodl-mcp'], entry: null, probed: ['/x'] };
    const row = buildMcpCommands(door)[0];
    expect(row.command).toBeNull();
    expect(row.runtimeNote).toBeNull();
  });
});

describe('the launcher card’s preference (BST-003)', () => {
  it('uses the bundled runtime even on a machine that has node', () => {
    // ⚠️ Not a global swap. Its audience is *defined* by not having Node, and it is the command we
    // run for them rather than one they read — so strangeness costs nothing here and correctness
    // by construction is worth more than legibility.
    const command = authoringOf(runtime({ hasNode: true }), 'always-electron').command as string;
    expect(command).toContain(ELECTRON);
    expect(command).toContain('-e ELECTRON_RUN_AS_NODE=1');
  });

  it('carries --allow-writes, without which create_project can do nothing', () => {
    expect(authoringOf(runtime(), 'always-electron').command).toContain('--allow-writes');
  });
});

describe('chooseRuntime', () => {
  it('quotes an app path with a space, which every default install location has', () => {
    const spaced = runtime({ hasNode: false, electron: '/Applications/My Apps/NodeGX.app/Contents/MacOS/NodeGX' });
    expect(authoringOf(spaced).command).toContain('"/Applications/My Apps/NodeGX.app/Contents/MacOS/NodeGX"');
  });

  it('quotes a Windows app path without escaping its separators', () => {
    const win = runtime({ hasNode: false, electron: 'C:\\Program Files\\NodeGX\\NodeGX.exe' });
    expect(authoringOf(win).command).toContain('"C:\\Program Files\\NodeGX\\NodeGX.exe"');
  });

  it('reports which form it chose, so a caller can explain itself', () => {
    expect(chooseRuntime(runtime(), 'prefer-node').isElectron).toBe(false);
    expect(chooseRuntime(runtime({ hasNode: false }), 'prefer-node').isElectron).toBe(true);
    expect(chooseRuntime(runtime(), 'always-electron').isElectron).toBe(true);
  });
});
