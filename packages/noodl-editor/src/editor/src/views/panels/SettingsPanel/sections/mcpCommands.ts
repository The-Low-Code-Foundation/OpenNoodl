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
  /**
   * FIX-021 slice B — absolute path of `<userData>/PREFERENCES.md`, resolved by main.
   *
   * Optional because it is not this module's to derive and not always present: a
   * front door described by an older main process does not carry it, and neither
   * does a test that does not care. Absent simply means the emitted registration
   * has no profile variable, which is exactly the right outcome — the server treats
   * an absent variable as an absent feature.
   */
  userProfilePath?: string | null;
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
   * FIX-008 C — which scope this row's command registers at. On the row because the two rows no
   * longer agree, and because what the copy must promise the reader follows from it.
   */
  scope: McpScope;
  /**
   * FIX-008 C — what the reader is promised, in the terms of the scope the command actually uses.
   *
   * 🔴 **Derived here rather than written in the component**, because the previous copy said "for
   * your user account, so it works from any directory" for *both* rows — which stops being true for
   * the project row the moment its scope changes, and a component-side literal is exactly the kind
   * of claim that goes stale silently. `null` when there is no command to describe.
   */
  scopeNote: string | null;
  /**
   * BST-004 — why this command looks unusual, when it does. `null` for the ordinary `node` form.
   *
   * ⚠️ **A named fallback, not a silent substitution.** The whole failure this task prevents is a
   * command that is recorded and then dies out of sight, so the one thing we must not do is
   * quietly hand out a different command and say nothing.
   */
  runtimeNote: string | null;
}

/** The scopes `claude mcp add` accepts that we ever emit. `local` is never one of them. */
export type McpScope = 'user' | 'project';

/**
 * ⚠️ **`--scope user` for a server with no folder, `--scope project` for one that has one.**
 *
 * `claude mcp add`'s default scope is `local`, which ties the registration to the directory the
 * command was run from. That is wrong for every row here, and it is why this constant exists.
 *
 * **The bootstrap and observe servers are `user`.** Neither is bound to a project — the bootstrap
 * server has no project yet, and observe attaches to whatever app is running — so "available in
 * every directory" is exactly the promise we want, and the only one we can keep from here.
 *
 * 🔴 **The per-project authoring server is `project` (FIX-008 C), and `user` was actively harmful.**
 * A user-scope `nodegx-<slug>` is visible in *every* folder on the machine while being bound to
 * *one* directory on disk, so in any other project it is a server pointed somewhere else. Measured
 * 2026-08-16, 3 runs against the real client: with only such a server visible, the model reached
 * for it **3 times out of 3** and attempted writes into the project the user was not in, never once
 * questioning the binding. With the project's own server registered alongside it, the model chose
 * correctly **4 times out of 4**. That measurement is the whole argument for this split.
 *
 * ⚠️ **`project` is resolved against the current directory, exactly like `local`.** The CLI has no
 * flag that names a target directory (checked, `claude mcp add --help`, 2.1.228), so the command
 * only lands in the right `.mcp.json` if it is run in the project folder. That dependency is
 * invisible in the string, which is why the row carries `scopeNote` naming the folder rather than
 * leaving the user to infer it.
 */
const SCOPE_UNBOUND: McpScope = 'user';
const SCOPE_PER_PROJECT: McpScope = 'project';

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

/** FIX-021 slice B — the variable `noodl-mcp`'s `userProfile.ts` reads the profile from. */
const USER_PROFILE_ENV = 'NODEGX_USER_PREFERENCES';

/**
 * The same runtime, plus the user-profile variable when there is a path for it.
 *
 * 🔴 **Applied to the `ChosenRuntime`, not to the registration** — which is the only
 * way the two renderings stay equal. `claudeMcpAdd` builds the displayed `-e` flags
 * from `runtime.env` and every caller builds the registration's `env` record from
 * that same list, so adding the pair here means the command a user pastes and the
 * config NodeGX writes carry it or omit it together. Adding it to one of the two
 * outputs is how they would silently disagree, which is the failure the "two
 * renderings of one registration" note in `buildBootstrapCommand` exists about.
 *
 * ⚠️ The value is passed through verbatim and never quoted here. `claudeMcpAdd`
 * quotes the executable and the arguments but not `-e` pairs, which is pre-existing
 * and matters more now that one carries a path: on a machine whose user data lives
 * under a directory with a space, the *displayed* line needs the user to quote it.
 * The written registration is unaffected, being JSON. Worth its own fix; noted
 * rather than smuggled in here.
 */
function withUserProfile(chosen: ChosenRuntime, userProfilePath?: string | null): ChosenRuntime {
  if (!userProfilePath) return chosen;
  return { ...chosen, env: [...chosen.env, `${USER_PROFILE_ENV}=${userProfilePath}`] };
}

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
function claudeMcpAdd(
  serverName: string,
  args: string[],
  runtime: ChosenRuntime,
  scope: McpScope
): string {
  return [
    'claude',
    'mcp',
    'add',
    '--scope',
    scope,
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
 * One stdio MCP registration, in the shape Claude Code's own config stores it.
 *
 * ⚠️ **This is a schema we do not own**, and BST-003 §2a is explicit about that being the one real
 * cost of the write path. It was read off the live file rather than guessed: `claude mcp add
 * --scope user` produces exactly `{ type, command, args, env }` under `mcpServers`, and the CLI
 * names the file it wrote on stdout. If Claude Code changes it, the *CLI* path keeps working and
 * only the fallback goes stale — which is the argument for trying the CLI first.
 */
export interface BootstrapRegistration {
  type: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** What the launcher card needs: a command to run, the same thing as data, or the reason for neither. */
export interface BootstrapConnection {
  /** The `claude mcp add …` line — what we spawn, and what the copy fallback shows. */
  command: string | null;
  /** The same registration as data, for writing the config directly when there is no CLI. */
  registration: BootstrapRegistration | null;
  /** Why there is neither. Never a half-command pointing at nothing. */
  unavailable: string | null;
}

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
 * ## Two renderings of one registration, and why both are here
 *
 * BST-003's decision was **try the CLI, fall back to writing the config**, so the same facts have to
 * come out as a shell line *and* as data. Building them in one place is the point: a `command` and a
 * `registration` that disagreed would connect one thing and tell the user about another, and the
 * suite asserts they match.
 *
 * @returns the command **and** the registration, or `null` for both with the reason — never a
 *   half-command pointing at nothing.
 */
export function buildBootstrapCommand(frontDoor: McpFrontDoor): BootstrapConnection {
  const authoring = frontDoor.servers['noodl-mcp'];
  if (!authoring.entry) {
    return {
      command: null,
      registration: null,
      unavailable: missingBundleReason(authoring, frontDoor.isPackaged)
    };
  }

  // Always Electron: this card's audience is *defined* by not having Node, and we register this
  // for them rather than showing it, so correctness by construction beats legibility.
  const chosen = withUserProfile(chooseRuntime(frontDoor.runtime, 'always-electron'), frontDoor.userProfilePath);
  const args = [authoring.entry, '--allow-writes'];

  return {
    // Unbound: it has no project directory, so `user` is the only scope that can promise anything.
    command: claudeMcpAdd(BOOTSTRAP_SERVER_NAME, args, chosen, SCOPE_UNBOUND),
    registration: {
      type: 'stdio',
      command: chosen.exec,
      args,
      // ⚠️ `-e KEY=value` on the command line is the same fact as a key here; `chosen.env` carries
      // it in the CLI's `KEY=value` spelling, so it is split rather than re-derived.
      env: Object.fromEntries(chosen.env.map((pair) => splitEnvPair(pair)))
    },
    unavailable: null
  };
}

/**
 * BST-005 — the same registration as data, but **for a project**, to be written into that project's
 * `.mcp.json` when it is created.
 *
 * 🔴 **`authoringServerName`, never the bare `nodegx`.** Measured 2026-08-11: a user-scope
 * registration shadows a project-scope one of the same name *silently* — the project entry is not
 * listed at all, not even as a conflict. BST-003's launcher card registers `nodegx` at user scope,
 * so the bare name here would hand a user who used that card the **unbound bootstrap server** in a
 * folder that is already a project. See `dev-docs/tasks/phase-62-cold-start/MEASUREMENTS-CLIENT-CONTRACT.md`.
 *
 * `'prefer-node'`, like the settings section and unlike the launcher card: this file sits in the
 * user's own project folder where they may well read it, and the Electron form still arrives
 * automatically on a machine with no Node.
 *
 * @returns `null` when the bundle could not be resolved — the `.mcp.json` is then not written at
 *   all, and `CLAUDE.md` says why rather than the folder carrying a registration pointing at nothing.
 */
export function buildProjectRegistration(
  frontDoor: McpFrontDoor,
  projectDir: string
): { serverName: string; registration: BootstrapRegistration | null } {
  const serverName = authoringServerName(projectDir);
  const authoring = frontDoor.servers['noodl-mcp'];
  if (!authoring?.entry) return { serverName, registration: null };

  const chosen = withUserProfile(chooseRuntime(frontDoor.runtime, 'prefer-node'), frontDoor.userProfilePath);
  return {
    serverName,
    registration: {
      type: 'stdio',
      command: chosen.exec,
      args: [authoring.entry, projectDir, '--allow-writes'],
      env: Object.fromEntries(chosen.env.map((pair) => splitEnvPair(pair)))
    }
  };
}

/** `KEY=value` → `[KEY, value]`, splitting on the **first** `=` only, since values may contain one. */
function splitEnvPair(pair: string): [string, string] {
  const at = pair.indexOf('=');
  return at === -1 ? [pair, ''] : [pair.slice(0, at), pair.slice(at + 1)];
}

/** What a `user`-scope row promises: everywhere, because it is bound to nothing. */
function unboundScopeNote(serverName: string): string {
  return (
    `Registers it as ${serverName} for your user account, so it works from any directory. ` +
    `It is not tied to a project, so one registration is all you need.`
  );
}

/**
 * What a `project`-scope row promises — and the three things that silently break it.
 *
 * 🔴 **All three warnings are measured, not defensive.** The directory sentence exists because
 * `--scope project` resolves against the shell's current directory and the CLI has no flag to
 * override that, so a command pasted in the wrong terminal writes a `.mcp.json` into an unrelated
 * folder and looks like it worked. The removal hint exists because a user-scope entry of the same
 * name **silently shadows** the project one — measured 2026-08-11, the project entry is simply
 * absent from `claude mcp list`, not reported as a conflict — and this section is what put those
 * user-scope entries on people's machines in the first place.
 *
 * 🔴 **The approval sentence is what FIX-008 C's own drive found (2026-08-16, AC3).** A
 * project-scope server lists as `⏸ Pending approval`, where every user-scope server lists as
 * `✔ Connected` — Claude Code's trust prompt for a `.mcp.json`, which is correct and desirable now
 * that a project folder can carry a server definition. But it is a **behaviour this scope change
 * introduced**: the user pastes the command, runs `claude mcp list`, and sees something that does
 * not say "connected". That is C's trade stated rather than discovered — the old user-scope
 * registration was immediately live and wrongly visible everywhere; this one is correctly scoped
 * and needs one approval.
 */
function perProjectScopeNote(serverName: string, projectDir: string): string {
  return (
    `Registers it as ${serverName} in this project's own .mcp.json, so an agent working here gets ` +
    `this project and no other. Run it in ${projectDir} — the project scope is resolved against ` +
    `the directory you paste into, so anywhere else writes the registration into the wrong folder. ` +
    `The first time you start an agent here it will ask you to approve this project's .mcp.json; ` +
    `until you do, \`claude mcp list\` shows the server as pending approval rather than connected. ` +
    `If you registered ${serverName} for your user account before, remove it with ` +
    `\`claude mcp remove --scope user ${serverName}\`: a user-scope entry of the same name hides ` +
    `this one without saying so.`
  );
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
    runtimeNote: null,
    scope: SCOPE_PER_PROJECT,
    scopeNote: null
  };

  if (!authoring.entry) {
    authoringRow.unavailable = missingBundleReason(authoring, frontDoor.isPackaged);
    authoringRow.probed = authoring.probed;
  } else if (!project) {
    // ⚠️ Still correct — this command genuinely needs a path — but BST-003 gave it somewhere to
    // send the reader. Before, it dead-ended on a requirement the user could not act on from here.
    authoringRow.unavailable =
      'Open a project first. This server is pointed at one project directory on disk, and that path ' +
      'is half the command. To let an agent create the project for you instead, use “Connect Claude ' +
      'Code” on the launcher’s projects screen — that registration needs no project path.';
  } else if (project.format !== 'v2') {
    // The server's own words, so the button and the spawn failure it is replacing say one thing.
    authoringRow.unavailable = project.message ?? 'This project is not one the authoring server can open.';
  } else {
    authoringRow.command = claudeMcpAdd(
      serverName,
      [authoring.entry, project.dir, '--allow-writes'],
      chosen,
      SCOPE_PER_PROJECT
    );
    authoringRow.runtimeNote = runtimeNote;
    authoringRow.scopeNote = perProjectScopeNote(serverName, project.dir);
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
    runtimeNote: null,
    scope: SCOPE_UNBOUND,
    scopeNote: null
  };

  if (!observe.entry) {
    observeRow.unavailable = missingBundleReason(observe, frontDoor.isPackaged);
    observeRow.probed = observe.probed;
  } else {
    observeRow.command = claudeMcpAdd(OBSERVE_SERVER_NAME, [observe.entry], chosen, SCOPE_UNBOUND);
    observeRow.runtimeNote = runtimeNote;
    observeRow.scopeNote = unboundScopeNote(OBSERVE_SERVER_NAME);
  }
  rows.push(observeRow);

  return rows;
}
