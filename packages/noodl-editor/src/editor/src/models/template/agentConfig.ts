/**
 * BST-005 — the two files that tell the *next* agent what this folder is.
 *
 * A NodeGX project on disk carried no agent configuration of any kind (F20,
 * verified on a real project). So the second session in a project is as cold as
 * the first, and colder in one way: the user believes they connected something
 * yesterday.
 *
 * | File | Job |
 * |---|---|
 * | `.mcp.json` | registers this project's authoring server, scoped to this folder |
 * | `CLAUDE.md` | says what the app is, and that the tools are the way in |
 *
 * ⚠️ **Neither is a substitute for the other.** A registered server with no
 * context gives a model twenty-odd tools and a project it has no vocabulary for;
 * a `CLAUDE.md` with no server gives it vocabulary and no way to act. The
 * complaint that opened phase 62 is those two failures in one sentence, so
 * {@link installAgentConfig} writes the pair or reports why it could not.
 *
 * ## Why a host port instead of `fs`
 *
 * Two callers, two filesystems: `create_project` runs in the MCP server (Node,
 * `fs`) and `LocalProjectsModel.newProject` runs in the editor renderer
 * (`@noodl/platform`, async). The never-overwrite rule and the `.gitignore`
 * merge are the parts with judgement in them, so they live here once and the
 * callers supply three primitives. That also makes the whole thing testable
 * against an in-memory host, which is how the copy is asserted.
 *
 * ⚠️ **This module imports nothing.** It is reached from `noodl-mcp` by relative
 * path through `editor-deps`, and anything from `@noodl/platform` or Electron
 * would break that bundle.
 *
 * @module noodl-editor/models/template/agentConfig
 */

/** Project-relative paths this module writes. Exported so callers can report them. */
export const AGENT_CONFIG_PATHS = Object.freeze({
  mcp: '.mcp.json',
  claude: 'CLAUDE.md',
  gitignore: '.gitignore'
});

/**
 * One stdio registration, in the shape the client writes for itself.
 *
 * ✅ **Measured, not guessed** (2026-08-11): `claude mcp add --scope project`
 * produces exactly `{ type, command, args, env }` under `mcpServers`, which is
 * byte-identical in shape to the `~/.claude.json` entry BST-003 read off the
 * live file. Structurally the same type as `mcpCommands.ts`'s
 * `BootstrapRegistration`; kept separate only because this module may not import
 * from the renderer's panel tree.
 */
export interface AgentServerRegistration {
  type: 'stdio';
  command: string;
  args: string[];
  env: Record<string, string>;
}

/** What the two files need to know about the project they are being written into. */
export interface AgentConfigOptions {
  /** Display name, for the `CLAUDE.md` heading. */
  projectName: string;
  /**
   * The registration name — 🔴 **per-project, never the bare `nodegx`.**
   *
   * See {@link installAgentConfig} for the measurement. A user-scope `nodegx`
   * shadows a project-scope one silently, and BST-003's launcher card registers
   * exactly that.
   */
  serverName: string;
  /** The server this project's tools come from, or `null` when nothing could be resolved. */
  registration: AgentServerRegistration | null;
  /**
   * One or two sentences about the app, when a scope captured them.
   * `create_project` has this; the launcher's manual wizard does not, and the
   * file simply points at `docs/` instead of inventing a description.
   */
  summary?: string;
  /** Whether `docs/` was written beside the project. `create_project` writes it; a template may not. */
  hasDocs: boolean;
}

/** A file the installer decided about, and what it decided. */
export interface AgentConfigFileResult {
  path: string;
  outcome: 'written' | 'kept-existing' | 'skipped';
  /** Why, for the two outcomes that are not a plain write. */
  reason?: string;
}

export interface AgentConfigReport {
  files: AgentConfigFileResult[];
  /** Just the paths that were actually created, for a caller's success payload. */
  written: string[];
}

/**
 * The three filesystem operations this needs, project-relative.
 *
 * Each may be sync or async — the Node caller is sync, the editor's is not, and
 * `await` covers both without either having to pretend.
 */
export interface AgentConfigHost {
  exists(relativePath: string): boolean | Promise<boolean>;
  read(relativePath: string): string | Promise<string>;
  write(relativePath: string, content: string): void | Promise<void>;
}

/**
 * ⚠️ The `.gitignore` line, and the comment that says why it is there.
 *
 * `.mcp.json` holds absolute paths for **this** machine — the runtime, and the
 * bundle inside this install of NodeGX. Committed, it arrives on a colleague's
 * laptop as a registration that points at nothing, which is the paste-the-wrong-
 * path failure phase 62 exists to remove, arriving by a new route. A broken
 * registration in someone else's checkout is worse than no registration, so the
 * file is ignored by default and `CLAUDE.md` says so out loud.
 */
const GITIGNORE_BLOCK = [
  '',
  '# Machine-specific MCP registration: absolute paths to this install of NodeGX.',
  '# Each developer gets their own, written when the project is created or opened.',
  '.mcp.json',
  ''
].join('\n');

/** `.mcp.json`, formatted the way the client formats its own. */
export function renderMcpJson(serverName: string, registration: AgentServerRegistration): string {
  return JSON.stringify({ mcpServers: { [serverName]: registration } }, null, 2) + '\n';
}

/**
 * `CLAUDE.md`.
 *
 * ⚠️ **It must not restate the server's `instructions`.** That string is sent at
 * `initialize` and every paragraph in it exists because a measured model failed
 * without it; a second copy here is how one of them silently stops matching the
 * product. `tests/agentConfig.test.ts` asserts no sentence of either briefing
 * appears in this output, so the copy-paste fails the suite rather than shipping.
 *
 * What is left is what the server **cannot** know: which app this is, that the
 * tools are the way in, and where the prose lives.
 */
export function renderClaudeMd(options: AgentConfigOptions): string {
  const { projectName, serverName, summary, hasDocs, registration } = options;

  const lines: string[] = [`# ${projectName}`, ''];

  if (summary && summary.trim()) {
    lines.push(summary.trim(), '');
  } else if (hasDocs) {
    lines.push('What this app is for is written up in `docs/BRIEF.md`.', '');
  }

  lines.push(
    '## How to change this app',
    '',
    // ⚠️ The highest-value line in the file. A capable agent finds JSON in a
    // folder and edits it; every validation, every diagnostic and every
    // `registeredPages` side effect lives above the files, so a hand-edit
    // produces a project that loads and is quietly wrong.
    'The component graphs under `components/` are generated files. Editing that JSON by hand skips ' +
      'schema validation, the semantic checks, and the bookkeeping that keeps the registry and the ' +
      'router in step — the result usually loads, which is what makes it expensive to find later.',
    ''
  );

  if (registration) {
    lines.push(
      `Use the \`${serverName}\` MCP server instead. It is registered for this folder in ` +
        '`.mcp.json`, so an agent started here is offered it and asks you to approve it once.',
      ''
    );
  } else {
    // Named, not hidden: a file that quietly omits the server would leave the
    // reader with a prohibition and no alternative, which is worse than either.
    lines.push(
      'No MCP server could be registered for this project when it was created — NodeGX could not ' +
        'resolve its own authoring server bundle. The editor’s settings, under “Connect an AI agent”, ' +
        'reports what it looked for and can emit the registration command.',
      ''
    );
  }

  if (hasDocs) {
    lines.push(
      '## Where the decisions are',
      '',
      '- `docs/BRIEF.md` — what the app is and who opens it',
      '- `docs/ARCHITECTURE.md` — how it is put together',
      '- `docs/CONVENTIONS.md` — rules this project agreed to follow, and worth checking work against',
      '- `docs/decisions/` — what was considered and deliberately not done, with reasons',
      ''
    );
  }

  lines.push(
    '## A note on `.mcp.json`',
    '',
    'It names absolute paths belonging to this machine’s NodeGX install, so it is listed in ' +
      '`.gitignore`. A teammate cloning this repository generates their own by opening the project ' +
      'in NodeGX; a committed one would point their agent at a path that does not exist on their disk.',
    ''
  );

  return lines.join('\n');
}

/**
 * Write both files, and ignore the machine-specific one.
 *
 * ⚠️ **Never overwrites.** A user who edited their `CLAUDE.md`, or added servers
 * to their `.mcp.json`, keeps them — reported as `kept-existing` rather than
 * silently passed over, because "the file was already there" and "we wrote it"
 * look identical from outside and only one of them means the project is
 * configured the way this build intends.
 *
 * Failures are the caller's to decide about. Project creation must not fail
 * because a `CLAUDE.md` could not be written — the user asked for a project —
 * but it must not be invisible either, which is what the report is for. That is
 * the posture `starterAssets.ts` settled on for the same question.
 */
export async function installAgentConfig(
  host: AgentConfigHost,
  options: AgentConfigOptions
): Promise<AgentConfigReport> {
  const files: AgentConfigFileResult[] = [];

  // ── .mcp.json ──────────────────────────────────────────────────────────────
  if (!options.registration) {
    files.push({
      path: AGENT_CONFIG_PATHS.mcp,
      outcome: 'skipped',
      reason: 'No authoring server bundle could be resolved, so there is no command to register.'
    });
  } else if (await host.exists(AGENT_CONFIG_PATHS.mcp)) {
    files.push({
      path: AGENT_CONFIG_PATHS.mcp,
      outcome: 'kept-existing',
      reason: 'A .mcp.json was already here and may register servers of the user’s own.'
    });
  } else {
    await host.write(AGENT_CONFIG_PATHS.mcp, renderMcpJson(options.serverName, options.registration));
    files.push({ path: AGENT_CONFIG_PATHS.mcp, outcome: 'written' });
    files.push(await ignoreMcpJson(host));
  }

  // ── CLAUDE.md ──────────────────────────────────────────────────────────────
  if (await host.exists(AGENT_CONFIG_PATHS.claude)) {
    files.push({
      path: AGENT_CONFIG_PATHS.claude,
      outcome: 'kept-existing',
      reason: 'A CLAUDE.md was already here and is the user’s to own.'
    });
  } else {
    await host.write(AGENT_CONFIG_PATHS.claude, renderClaudeMd(options));
    files.push({ path: AGENT_CONFIG_PATHS.claude, outcome: 'written' });
  }

  return { files, written: files.filter((f) => f.outcome === 'written').map((f) => f.path) };
}

/**
 * Add `.mcp.json` to `.gitignore`, appending rather than replacing.
 *
 * ⚠️ The one place here that touches a file the project already owns, so it
 * reads before it writes and does nothing when the pattern is already covered.
 * Matching is on the exact line: `.gitignore` glob semantics are more than a
 * substring test can decide, and a duplicated ignore line is harmless where a
 * clobbered `.gitignore` is not.
 */
async function ignoreMcpJson(host: AgentConfigHost): Promise<AgentConfigFileResult> {
  const existing = (await host.exists(AGENT_CONFIG_PATHS.gitignore))
    ? await host.read(AGENT_CONFIG_PATHS.gitignore)
    : '';

  const alreadyIgnored = existing
    .split(/\r?\n/)
    .map((line) => line.trim())
    .some((line) => line === '.mcp.json' || line === '/.mcp.json');

  if (alreadyIgnored) {
    return {
      path: AGENT_CONFIG_PATHS.gitignore,
      outcome: 'kept-existing',
      reason: '.mcp.json was already ignored.'
    };
  }

  await host.write(AGENT_CONFIG_PATHS.gitignore, existing.replace(/\s*$/, '') + GITIGNORE_BLOCK);
  return { path: AGENT_CONFIG_PATHS.gitignore, outcome: 'written' };
}
