/**
 * MCP-001 — the two `claude mcp add` commands the "Connect an AI agent" section hands out.
 *
 * ## Why this is a module and not a component
 *
 * The same separation `ExecutionDetail/fixRequest.ts` uses, for the same reason: what the copied
 * text *says* is the deliverable, and text is only assertable if building it needs neither React
 * nor a clipboard. Everything with a rule in it — the per-project server name, the shell quoting,
 * the scope flag, which unavailable state wins — is here and unit-tested; the component is a
 * button and a `useEffect`.
 *
 * ## There is no URL and nothing to start
 *
 * Both servers are **stdio** processes the MCP client spawns itself. There is no HTTP transport
 * anywhere in either of them, so there is nothing to "start" in the editor and no address to show.
 * The whole deliverable is a command with the right absolute paths already substituted.
 *
 * ## The decisions baked in here (TALK-004)
 *
 * - **`node <path>`, not `ELECTRON_RUN_AS_NODE`** (decision 8). Anyone running an MCP client has
 *   Node; the Electron trick buys little for the strangeness.
 * - **The server name carries the project** (decision 4), so two projects register as two servers
 *   instead of silently replacing one another.
 * - **`--scope user`**, which is *not* the CLI's default — see `MCP_SCOPE` below.
 *
 * @module SettingsPanel/sections/mcpCommands
 */

/** One server, as `main/src/mcp/resolveMcpServer.js` reports it. */
export interface McpServerResolution {
  name: string;
  label: string;
  what: string;
  /** `null` is a real answer: nobody has built the bundle. Never a guessed path. */
  entry: string | null;
  /** Everywhere the resolver looked. When it misses, this list *is* the bug report. */
  probed: string[];
}

/** The open project, as `noodl-mcp`'s own constructor would judge it. */
export interface McpProjectVerdict {
  dir: string;
  format: 'v2' | 'legacy' | 'not-a-project' | 'missing';
  /** The server's own refusal message, for everything but `v2`. */
  message?: string;
}

/** What one IPC round trip to `mcp:front-door` answers. */
export interface McpFrontDoor {
  servers: Record<string, McpServerResolution>;
  /** `null` when no project is open — a different state from "the open project is wrong". */
  project: McpProjectVerdict | null;
  /** A shipped app, or a checkout. Only the advice for a missing bundle depends on it. */
  isPackaged: boolean;
}

/** One row of the section: a caption, and either a command or the reason there isn't one. */
export interface McpCommandRow {
  id: 'authoring' | 'observe';
  /** The registration name, so the copy can say what the agent will call it. */
  serverName: string;
  title: string;
  caption: string;
  /** The copy-pasteable command, or `null` when something in `unavailable` stops it. */
  command: string | null;
  /** Why there is no command. Never a bare disabled button. */
  unavailable: string | null;
  /** The paths the resolver tried, when that is what went wrong. */
  probed: string[] | null;
}

/**
 * ⚠️ **`--scope user`, deliberately.**
 *
 * `claude mcp add`'s default scope is `local`, which ties the registration to the directory the
 * command was run from. The editor has no idea what that directory is — the user pastes into
 * whatever terminal is open — so the default would register the server somewhere arbitrary, and
 * from anywhere else it would look like the registration had silently vanished. `user` makes it
 * available in every directory, which is the only scope whose behaviour we can actually promise
 * from here.
 */
const MCP_SCOPE = 'user';

/** The longest slug we will put in a server name. Long enough to stay recognisable. */
const MAX_SLUG_LENGTH = 40;

/** The observe server's fixed name — and therefore a name no project may take. */
const OBSERVE_SERVER_NAME = 'nodegx-observe';

/**
 * A short, stable, path-derived suffix.
 *
 * FNV-1a, base36. Not a security thing — it exists so that two projects that slug to the same
 * (or to nothing) still register as two servers.
 */
function pathHash(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(36).slice(0, 6);
}

/** The last non-empty segment of a path, whichever separator it uses. */
function basename(dir: string): string {
  const parts = dir.split(/[\\/]+/).filter(Boolean);
  return parts.length ? parts[parts.length - 1] : '';
}

/**
 * The project's slug, from **the directory basename — never `ProjectModel.name`**.
 *
 * ⚠️ `name` is `public name?: string` and `LocalProjectsModel` falls back to the literal
 * `'Untitled'`, so slugging it yields `nodegx-undefined`, or two different projects both
 * registering as `nodegx-untitled` — exactly the collision the per-project name exists to
 * prevent. The directory basename is present whenever the path is, unique on disk by
 * construction, and survives a rename of the project.
 */
export function projectSlug(projectDir: string): string {
  const slug = basename(projectDir)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/-+$/g, '');

  // A directory named only in non-Latin script slugs to nothing, and a directory literally named
  // "observe" would produce `nodegx-observe` and overwrite the *other* registration. Both fall
  // back to the path hash, which is what makes the name unique rather than merely usual.
  if (!slug) return pathHash(projectDir);
  if (slug === 'observe') return `observe-${pathHash(projectDir)}`;
  return slug;
}

/** The registration name for a project directory. */
export function authoringServerName(projectDir: string): string {
  return `nodegx-${projectSlug(projectDir)}`;
}

/**
 * Quote one argument for the shell the user will paste into.
 *
 * The default project location has a space in it, so this is not theoretical: unquoted, the
 * command silently points `node` at the first word of the path.
 *
 * ⚠️ **Windows paths are quoted differently on purpose.** A backslash inside double quotes is an
 * escape character in POSIX shells and a path separator on Windows, and there is no single
 * escaping that is right for both. So a drive-letter or UNC path is wrapped without touching its
 * separators (correct in cmd and PowerShell, which do not treat `\` as an escape), and everything
 * else is escaped the POSIX way. Double quotes rather than single so the one form works in
 * PowerShell and cmd as well as sh/zsh.
 */
export function quoteArg(value: string): string {
  if (/^[A-Za-z0-9_@%+=:,.\\/-]+$/.test(value)) return value;

  const isWindowsPath = /^[A-Za-z]:[\\/]/.test(value) || value.startsWith('\\\\');
  const escaped = isWindowsPath ? value.replace(/"/g, '\\"') : value.replace(/(["`$\\])/g, '\\$1');
  return `"${escaped}"`;
}

/** `claude mcp add --scope user <name> -- node <entry> [args…]`, quoted. */
function claudeMcpAdd(serverName: string, args: string[]): string {
  return ['claude', 'mcp', 'add', '--scope', MCP_SCOPE, serverName, '--', 'node', ...args.map(quoteArg)].join(' ');
}

/**
 * Why the bundle is missing, in the terms of the install it is missing from.
 *
 * "Run the build" is the right advice in a checkout and nonsense in a shipped app.
 */
function missingBundleReason(server: McpServerResolution, isPackaged: boolean): string {
  return isPackaged
    ? `This build of NodeGX does not contain the ${server.label.toLowerCase()} server (${server.name}.cjs). ` +
        `Reinstalling NodeGX should restore it. Looked in:`
    : `The ${server.label.toLowerCase()} server has not been built. Run \`npm run build:sidecars\` in the ` +
        `repo root, then use “Check again” below. Looked in:`;
}

/**
 * Build both rows.
 *
 * The unavailable states are ordered deepest-first: a missing bundle is a broken installation and
 * stays true whatever project is open, so it is named before anything about the project.
 */
export function buildMcpCommands(frontDoor: McpFrontDoor): McpCommandRow[] {
  const authoring = frontDoor.servers['noodl-mcp'];
  const observe = frontDoor.servers[OBSERVE_SERVER_NAME];
  const project = frontDoor.project;

  const rows: McpCommandRow[] = [];

  // ── Authoring ────────────────────────────────────────────────────────────
  const serverName = project ? authoringServerName(project.dir) : 'nodegx-<project>';
  const authoringRow: McpCommandRow = {
    id: 'authoring',
    serverName,
    title: authoring.label,
    caption: authoring.what,
    command: null,
    unavailable: null,
    probed: null
  };

  if (!authoring.entry) {
    authoringRow.unavailable = missingBundleReason(authoring, frontDoor.isPackaged);
    authoringRow.probed = authoring.probed;
  } else if (!project) {
    authoringRow.unavailable =
      'Open a project first. This server is pointed at one project directory on disk, and that path ' +
      'is half the command.';
  } else if (project.format !== 'v2') {
    // The server's own words, so the button and the spawn failure it is replacing say one thing.
    authoringRow.unavailable = project.message ?? 'This project is not one the authoring server can open.';
  } else {
    authoringRow.command = claudeMcpAdd(serverName, [authoring.entry, project.dir, '--allow-writes']);
  }
  rows.push(authoringRow);

  // ── Observe ──────────────────────────────────────────────────────────────
  // No project suffix: it attaches to whatever app is running, and one is all there can be.
  const observeRow: McpCommandRow = {
    id: 'observe',
    serverName: OBSERVE_SERVER_NAME,
    title: observe.label,
    caption: observe.what,
    command: null,
    unavailable: null,
    probed: null
  };

  if (!observe.entry) {
    observeRow.unavailable = missingBundleReason(observe, frontDoor.isPackaged);
    observeRow.probed = observe.probed;
  } else {
    observeRow.command = claudeMcpAdd(OBSERVE_SERVER_NAME, [observe.entry]);
  }
  rows.push(observeRow);

  return rows;
}
