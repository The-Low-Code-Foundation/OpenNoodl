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
  buildMcpCommands,
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
