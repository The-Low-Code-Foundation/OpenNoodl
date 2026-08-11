/**
 * MCP-001 — what the two Copy buttons actually put on the clipboard.
 *
 * The value of this suite is not that it joins words with spaces. It is the four rules that, if
 * broken, produce a command that *looks* right and then does the wrong thing on a stranger's
 * machine: the name comes from the directory and not the project name, the paths are quoted, the
 * scope is not the CLI's default, and a missing bundle produces no command at all.
 */

import {
  authoringServerName,
  buildBootstrapCommand,
  BOOTSTRAP_SERVER_NAME,
  buildMcpCommands,
  buildProjectRegistration,
  McpFrontDoor,
  projectSlug,
  quoteArg
} from '../../src/editor/src/views/panels/SettingsPanel/sections/mcpCommands';

function frontDoor(overrides: Partial<McpFrontDoor> = {}): McpFrontDoor {
  return {
    servers: {
      'noodl-mcp': {
        name: 'noodl-mcp',
        label: 'Authoring',
        what: 'Reads and writes…',
        entry: '/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs',
        probed: []
      },
      'nodegx-observe': {
        name: 'nodegx-observe',
        label: 'Observe',
        what: 'Watches and drives…',
        entry: '/Applications/NodeGX.app/Contents/Resources/nodegx-observe/nodegx-observe.cjs',
        probed: []
      }
    },
    project: { dir: '/Users/me/Documents/My App', format: 'v2' },
    // BST-004: the machine these MCP-001 assertions describe is one that has Node — which is the
    // case decision 8 was written for, and the case that must not change.
    runtime: {
      hasNode: true,
      nodePath: null,
      electron: '/Applications/NodeGX.app/Contents/MacOS/NodeGX',
      detection: 'path',
      probed: []
    },
    isPackaged: true,
    ...overrides
  };
}

const authoringOf = (door: McpFrontDoor) => buildMcpCommands(door)[0];
const observeOf = (door: McpFrontDoor) => buildMcpCommands(door)[1];

describe('the project slug', () => {
  it('comes from the directory basename, so a project with no name still gets one', () => {
    // ⚠️ The whole point. `ProjectModel.name` is optional and falls back to 'Untitled', which
    // would make every unnamed project register as the same server and silently replace the last.
    expect(projectSlug('/Users/me/Documents/My App')).toBe('my-app');
    expect(projectSlug('/Users/me/Documents/My App/')).toBe('my-app');
    expect(projectSlug('C:\\Users\\me\\Documents\\My App')).toBe('my-app');
  });

  it('gives two same-named projects in different places two different registrations', () => {
    // Same basename here really is the same slug — that is the price of a readable name — but
    // the two cases where a slug would otherwise *collapse* are covered below.
    expect(authoringServerName('/a/Shop')).toBe('nodegx-shop');
    expect(authoringServerName('/b/Bakery')).toBe('nodegx-bakery');
  });

  it('falls back to a path hash when the name slugs to nothing', () => {
    const a = projectSlug('/Users/me/プロジェクト');
    const b = projectSlug('/Users/other/プロジェクト');
    expect(a).toMatch(/^[a-z0-9]+$/);
    expect(a).not.toBe(b);
  });

  it('never lets a project take the observe server’s name', () => {
    // A directory literally called "observe" would otherwise register as `nodegx-observe` and
    // overwrite the other button's registration.
    expect(authoringServerName('/Users/me/observe')).not.toBe('nodegx-observe');
    expect(authoringServerName('/Users/me/observe')).toMatch(/^nodegx-observe-[a-z0-9]+$/);
  });

  it('keeps the name short', () => {
    expect(projectSlug(`/x/${'a'.repeat(120)}`).length).toBeLessThanOrEqual(40);
  });
});

describe('shell quoting', () => {
  it('quotes a path with a space — the default project location has one', () => {
    expect(quoteArg('/Users/me/Documents/My App')).toBe('"/Users/me/Documents/My App"');
  });

  it('leaves an ordinary path alone', () => {
    expect(quoteArg('/Users/me/app')).toBe('/Users/me/app');
    expect(quoteArg('C:\\Users\\me\\app')).toBe('C:\\Users\\me\\app');
  });

  it('does not escape the separators of a Windows path', () => {
    // A backslash is an escape character inside POSIX double quotes and a path separator on
    // Windows; escaping here would corrupt every Windows path that contains a space.
    expect(quoteArg('C:\\Users\\me\\My App')).toBe('"C:\\Users\\me\\My App"');
  });

  it('escapes what a POSIX shell would otherwise expand', () => {
    expect(quoteArg('/Users/me/$HOME dir')).toBe('"/Users/me/\\$HOME dir"');
  });
});

describe('the authoring command', () => {
  it('is a fully substituted, quoted, user-scoped registration', () => {
    expect(authoringOf(frontDoor()).command).toBe(
      'claude mcp add --scope user nodegx-my-app -- node ' +
        '/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs ' +
        '"/Users/me/Documents/My App" --allow-writes'
    );
  });

  it('is scoped to the user, not to whatever directory it is pasted in', () => {
    // `claude mcp add` defaults to `local`, which ties the registration to the terminal's cwd —
    // a directory the editor cannot know. From anywhere else it would look like it had vanished.
    expect(authoringOf(frontDoor()).command).toContain('--scope user');
  });

  it('asks for write access — an agent that cannot author is not the point', () => {
    expect(authoringOf(frontDoor()).command).toContain('--allow-writes');
  });
});

describe('the observe command', () => {
  it('carries no project, because it attaches to whatever app is running', () => {
    expect(observeOf(frontDoor()).command).toBe(
      'claude mcp add --scope user nodegx-observe -- node ' +
        '/Applications/NodeGX.app/Contents/Resources/nodegx-observe/nodegx-observe.cjs'
    );
  });

  it('is offered even when no project is open', () => {
    expect(observeOf(frontDoor({ project: null })).command).toBeTruthy();
  });
});

describe('the unavailable states', () => {
  it('emits no command when the bundle was never built, and names every path tried', () => {
    const door = frontDoor({ isPackaged: false });
    door.servers['noodl-mcp'] = {
      ...door.servers['noodl-mcp'],
      entry: null,
      probed: ['/repo/packages/noodl-mcp/dist/noodl-mcp.cjs']
    };
    const row = authoringOf(door);
    expect(row.command).toBeNull();
    expect(row.unavailable).toContain('npm run build:sidecars');
    expect(row.probed).toEqual(['/repo/packages/noodl-mcp/dist/noodl-mcp.cjs']);
  });

  it('does not tell a packaged-app user to run a build they have no repo for', () => {
    const door = frontDoor({ isPackaged: true });
    door.servers['nodegx-observe'] = { ...door.servers['nodegx-observe'], entry: null, probed: ['/x'] };
    const row = observeOf(door);
    expect(row.unavailable).not.toContain('npm run');
    expect(row.unavailable).toContain('Reinstalling');
  });

  it('asks for a project rather than emitting half a command', () => {
    const row = authoringOf(frontDoor({ project: null }));
    expect(row.command).toBeNull();
    expect(row.unavailable).toContain('Open a project first');
  });

  it('repeats the server’s own refusal on a legacy project, migration path and all', () => {
    const message =
      '/p holds a legacy monolithic project.json. Migrate it to the v2 format ' +
      '(NodeGX editor: project settings → migrate) before using the MCP server.';
    const row = authoringOf(frontDoor({ project: { dir: '/p', format: 'legacy', message } }));
    expect(row.command).toBeNull();
    expect(row.unavailable).toBe(message);
  });

  it('names the broken installation before anything about the project', () => {
    // Both are true at once in a fresh checkout with no project open. The bundle is the deeper
    // failure: it stays wrong whatever project you open next.
    const door = frontDoor({ project: null, isPackaged: false });
    door.servers['noodl-mcp'] = { ...door.servers['noodl-mcp'], entry: null, probed: ['/x'] };
    expect(authoringOf(door).unavailable).toContain('has not been built');
  });
});

/**
 * BST-003 — the bootstrap registration, which is a *different* command from the two above rather
 * than a special case of one. It carries no project path, because the whole premise of the launcher
 * card is that there is no project yet.
 */
describe('the bootstrap registration', () => {
  it('names the server bare `nodegx`, with no project path anywhere in it', () => {
    const { command } = buildBootstrapCommand(frontDoor());

    expect(command).toContain(' nodegx ');
    expect(command).not.toContain('/Users/me/Documents/My App');
  });

  it('🔴 can never collide with a per-project registration', () => {
    // Per-project names are always `nodegx-<slug>`, so the namespaces do not overlap — including
    // for a project whose directory is literally called "nodegx".
    expect(authoringServerName('/Users/me/nodegx')).toBe('nodegx-nodegx');
    expect(authoringServerName('/Users/me/nodegx')).not.toBe(BOOTSTRAP_SERVER_NAME);
  });

  it('🔴 always carries --allow-writes, or create_project is not registered at all', () => {
    const { command, registration } = buildBootstrapCommand(frontDoor());

    expect(command).toContain('--allow-writes');
    expect(registration?.args).toContain('--allow-writes');
  });

  it('always uses the Electron runtime, even on a machine that has node', () => {
    // The settings section prefers `node` for legibility; this card never shows its command by
    // default and its audience is *defined* by not having node, so correctness wins.
    const { registration } = buildBootstrapCommand(frontDoor({ runtime: { ...frontDoor().runtime } }));

    expect(registration?.command).toBe('/Applications/NodeGX.app/Contents/MacOS/NodeGX');
    expect(registration?.env).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });

  it('🔴 the command and the registration describe the SAME thing', () => {
    // Two renderings of one fact. If they drift, we connect one server and tell the user about
    // another — and only one of the two is ever visible to check.
    const { command, registration } = buildBootstrapCommand(frontDoor());

    expect(command).toContain(registration!.command);
    for (const arg of registration!.args) expect(command).toContain(arg);
    for (const [key, value] of Object.entries(registration!.env)) {
      expect(command).toContain(`-e ${key}=${value}`);
    }
  });

  it('refuses with a reason when the bundle is missing, rather than half a command', () => {
    const door = frontDoor();
    door.servers['noodl-mcp'].entry = null;

    const { command, registration, unavailable } = buildBootstrapCommand(door);

    expect(command).toBeNull();
    expect(registration).toBeNull();
    expect(unavailable).toBeTruthy();
  });
});

describe('BST-005 the registration written into a project’s .mcp.json', () => {
  const DIR = '/Users/someone/Documents/Reading List';

  it('🔴 F94 — carries the per-project name, never the bare `nodegx`', () => {
    // Measured 2026-08-11: a user-scope registration silently shadows a project-scope one of the
    // same name — the project entry is not listed at all. BST-003's launcher card registers
    // `nodegx` at user scope, so the bare name here would hand a card user the UNBOUND bootstrap
    // server inside a folder that is already a project. That is this phase's founding complaint,
    // delivered by the file written to prevent it.
    const { serverName } = buildProjectRegistration(frontDoor(), DIR);

    expect(serverName).toBe('nodegx-reading-list');
    expect(serverName).not.toBe(BOOTSTRAP_SERVER_NAME);
  });

  it('points at this project, with writes allowed', () => {
    const { registration } = buildProjectRegistration(frontDoor(), DIR);

    expect(registration).toEqual({
      type: 'stdio',
      command: 'node',
      args: ['/Applications/NodeGX.app/Contents/Resources/noodl-mcp/noodl-mcp.cjs', DIR, '--allow-writes'],
      env: {}
    });
  });

  it('falls back to the bundled runtime on a machine with no Node', () => {
    const door = frontDoor();
    door.runtime = { hasNode: false, nodePath: null, electron: '/Applications/NodeGX.app/Contents/MacOS/NodeGX', detection: 'none', probed: [] };

    const { registration } = buildProjectRegistration(door, DIR);

    expect(registration!.command).toBe('/Applications/NodeGX.app/Contents/MacOS/NodeGX');
    // 🔴 BST-004/F80 — load-bearing, and the naive test says otherwise.
    expect(registration!.env).toEqual({ ELECTRON_RUN_AS_NODE: '1' });
  });

  it('returns no registration at all when the bundle is missing', () => {
    const door = frontDoor();
    door.servers['noodl-mcp'].entry = null;

    // A folder carrying a registration that points at nothing is worse than one carrying none:
    // the client reports a server that cannot start, and CLAUDE.md is where the reason belongs.
    expect(buildProjectRegistration(door, DIR).registration).toBeNull();
  });
});
