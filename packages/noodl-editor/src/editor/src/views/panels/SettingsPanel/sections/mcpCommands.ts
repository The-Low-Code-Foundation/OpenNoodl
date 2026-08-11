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
 * - **The server name carries the project** (decision 4), so two projects register as two servers
 *   instead of silently replacing one another.
 * - **`--scope user`**, which is *not* the CLI's default — see `MCP_SCOPE` below.
 *
 * ## What BST-004 changed, and what it deliberately did not
 *
 * Decision 8 said **`node <path>`, not `ELECTRON_RUN_AS_NODE`**, because *"anyone running an MCP
 * client has Node"*. That premise holds for this section's audience — someone deliberately wiring
 * an agent to one project, for whom `node <path>` is legible, portable and pasteable into any
 * client — so **this section still emits `node` whenever there is one**, character for character
 * as it always did.
 *
 * ⚠️ It is the *other* audience that broke it: a designer who installed the desktop app and has no
 * Node at all. For them `claude mcp add` records a command that dies later, inside the client,
 * with a `spawn node ENOENT` NodeGX never sees. So the runtime is now **chosen from
 * `frontDoor.runtime`, which main supplies** — nothing here probes the machine — and the Electron
 * form is a named fallback rather than a silent substitution.
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

/**
 * BST-004 — what can actually run an MCP server bundle on this machine, as main reports it.
 *
 * ⚠️ Detected in main, never here: whether `node` resolves is a property of the machine, and a
 * renderer that guesses will guess wrong on exactly the machines this phase is written for.
 */
export interface McpRuntime {
  /** Whether a `node` the user's shell can find exists at all. */
  hasNode: boolean;
  /** Where it was found, when only the login shell could find it. Evidence, never the command. */
  nodePath: string | null;
  /** The app binary. Always present — Electron *is* a Node runtime, and every install has one. */
  electron: string;
  /** How we know. `'none'` is the case this task exists for. */
  detection: 'path' | 'login-shell' | 'none';
  /** Everything tried. When it misses, this list *is* the bug report. */
  probed: string[];
}

/** What one IPC round trip to `mcp:front-door` answers. */
export interface McpFrontDoor {
  servers: Record<string, McpServerResolution>;
  /** `null` when no project is open — a different state from "the open project is wrong". */
  project: McpProjectVerdict | null;
  /** BST-004 — which runtime the emitted command should name. */
  runtime: McpRuntime;
  /** A shipped app, or a checkout. Only the advice for a missing bundle depends on it. */
  isPackaged: boolean;
}

/**
 * Which runtime a surface wants — because **the answer differs by audience** (BST-004 §2), and
 * conflating them is how a working setup gets broken for the people who already have one.
 *
 * - `'prefer-node'` — the settings section. `node` when there is one, Electron otherwise.
 * - `'always-electron'` — BST-003's launcher card. Its audience is *defined* by not having Node,
 *   and it is the command we run *for* them, so strangeness costs nothing: nobody reads it.
 */
export type RuntimePreference = 'prefer-node' | 'always-electron';

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
  /**
   * BST-004 — why this command looks unusual, when it does. `null` for the ordinary `node` form.
   *
   * ⚠️ **A named fallback, not a silent substitution.** The whole failure this task prevents is a
   * command that is recorded and then dies out of sight, so the one thing we must not do is
   * quietly hand out a different command and say nothing.
   */
  runtimeNote: string | null;
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

/**
 * The environment variable that turns the app binary into a plain Node process.
 *
 * ⚠️ **Load-bearing, and the naive test says otherwise.** Without it the binary boots as a full
 * Electron *app* — `process.type === 'browser'`, a dock icon, a GUI event loop that never exits.
 * It happens to serve stdio correctly anyway, so a probe that forgets the variable still looks
 * like a pass. Measured: with it, `process.type` is undefined and the stream is byte-identical to
 * plain `node`'s; without it, `process.type === 'browser'`.
 */
const ELECTRON_AS_NODE_ENV = 'ELECTRON_RUN_AS_NODE=1';

/** One runtime, resolved to the words that go in the command. */
interface ChosenRuntime {
  /** The executable — the bare word `node`, or an absolute path to the app binary. */
  exec: string;
  /** `-e KEY=value` flags the registration needs, if any. */
  env: string[];
  /** Whether this is the Electron fallback, which the UI must name rather than hide. */
  isElectron: boolean;
}

/**
 * Pick the runtime for one surface.
 *
 * ⚠️ **`node` stays the bare word even when only the login shell found it.** The command is pasted
 * into that same shell, where it resolves; substituting the absolute path would bake in an nvm
 * version directory that breaks on the next `nvm use`.
 */
export function chooseRuntime(runtime: McpRuntime, preference: RuntimePreference): ChosenRuntime {
  if (preference === 'prefer-node' && runtime.hasNode) {
    return { exec: 'node', env: [], isElectron: false };
  }
  return { exec: runtime.electron, env: [ELECTRON_AS_NODE_ENV], isElectron: true };
}

/**
 * `claude mcp add --scope user <name> [-e KEY=v] -- <runtime> <entry> [args…]`, quoted.
 *
 * 🔴 **`-e` goes AFTER the server name, and the order is not cosmetic.** `claude mcp add` declares
 * it as `-e, --env <env...>` — *variadic* — so an `-e` placed before the name greedily swallows the
 * name as a second variable and the command dies with
 * `Invalid environment variable format: nodegx`. The CLI's own documented example puts it after
 * (`claude mcp add my-server -e API_KEY=xxx -- npx my-mcp-server`), and that is the only order that
 * parses. Found by running the emitted command against the real client, which is why the
 * acceptance demands that rather than an inspection of the string.
 */
function claudeMcpAdd(serverName: string, args: string[], runtime: ChosenRuntime): string {
  return [
    'claude',
    'mcp',
    'add',
    '--scope',
    MCP_SCOPE,
    serverName,
    ...runtime.env.flatMap((pair) => ['-e', pair]),
    '--',
    quoteArg(runtime.exec),
    ...args.map(quoteArg)
  ].join(' ');
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

/** The registration name for a server with no project bound — BST-003's launcher card. */
export const BOOTSTRAP_SERVER_NAME = 'nodegx';

/**
 * BST-003's registration: the authoring server with **no project directory**.
 *
 * ⚠️ **This is a different command from the settings section's, not a special case of it.**
 * `buildMcpCommands` refuses to emit without a project, and rightly — its row is *about* a project,
 * and half the command is that path. BST-001 made the server start unbound, so this one is about
 * the opposite: an agent that will call `list_projects` or `create_project` and has nothing yet.
 *
 * 🔴 **`--allow-writes` is not optional here.** `create_project` is write-gated, so a bootstrap
 * server registered without it connects, advertises the tool, and then refuses the one call it
 * exists to serve. The CLI now refuses that combination out loud with the flag named, so the
 * failure is at least visible in the client's MCP status — but the emitted string still has to be
 * right, which is what the suite asserts.
 *
 * @returns the command, or `null` with the reason — never a half-command pointing at nothing.
 */
export function buildBootstrapCommand(frontDoor: McpFrontDoor): { command: string | null; unavailable: string | null } {
  const authoring = frontDoor.servers['noodl-mcp'];
  if (!authoring.entry) {
    return { command: null, unavailable: missingBundleReason(authoring, frontDoor.isPackaged) };
  }

  // Always Electron: this card's audience is *defined* by not having Node, and we run this
  // command for them rather than showing it, so correctness by construction beats legibility.
  const chosen = chooseRuntime(frontDoor.runtime, 'always-electron');
  return { command: claudeMcpAdd(BOOTSTRAP_SERVER_NAME, [authoring.entry, '--allow-writes'], chosen), unavailable: null };
}

/**
 * What to tell the reader about an unusual-looking command.
 *
 * Only the Electron form gets a note: the `node` form is what this section has always emitted and
 * needs no explanation.
 */
function runtimeNoteFor(chosen: ChosenRuntime): string | null {
  if (!chosen.isElectron) return null;
  return (
    'No Node runtime was found on this machine, so this command runs the server with NodeGX’s own ' +
    'bundled one instead. It works the same way. Install Node and use “Check again” if you would ' +
    'rather have the shorter `node …` command.'
  );
}

/**
 * Build both rows.
 *
 * The unavailable states are ordered deepest-first: a missing bundle is a broken installation and
 * stays true whatever project is open, so it is named before anything about the project.
 *
 * @param preference BST-004 §2 — `'prefer-node'` for this settings section, whose audience can read
 *   a command; `'always-electron'` for BST-003's launcher card, whose audience is defined by not
 *   having Node and never sees the string.
 */
export function buildMcpCommands(
  frontDoor: McpFrontDoor,
  preference: RuntimePreference = 'prefer-node'
): McpCommandRow[] {
  const authoring = frontDoor.servers['noodl-mcp'];
  const observe = frontDoor.servers[OBSERVE_SERVER_NAME];
  const project = frontDoor.project;
  const chosen = chooseRuntime(frontDoor.runtime, preference);
  const runtimeNote = runtimeNoteFor(chosen);

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
    probed: null,
    runtimeNote: null
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
    authoringRow.command = claudeMcpAdd(serverName, [authoring.entry, project.dir, '--allow-writes'], chosen);
    authoringRow.runtimeNote = runtimeNote;
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
    probed: null,
    runtimeNote: null
  };

  if (!observe.entry) {
    observeRow.unavailable = missingBundleReason(observe, frontDoor.isPackaged);
    observeRow.probed = observe.probed;
  } else {
    observeRow.command = claudeMcpAdd(OBSERVE_SERVER_NAME, [observe.entry], chosen);
    observeRow.runtimeNote = runtimeNote;
  }
  rows.push(observeRow);

  return rows;
}
