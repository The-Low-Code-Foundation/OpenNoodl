/**
 * BST-003 — register the bootstrap server for the user, and say what was done.
 *
 * ## The shape, and the measurement that chose it
 *
 * §2 offered three products: **A** copy a command, **B** run `claude mcp add`, **C** write the
 * client's config. The spec recommended B and refused C. **F14 was then measured and moved it**
 * (§2a): the desktop app ships no CLI at all — documented, and confirmed against the bundle — so B
 * alone leaves the card's whole audience at the copy fallback. Meanwhile C's stated objection,
 * *"another application's undocumented schema"*, turned out to describe Claude Code's **own**
 * `~/.claude.json`, shared by CLI and Desktop by documentation and named by the CLI on its own
 * stdout.
 *
 * So: **B, then C.**
 *
 *   1. If the CLI is there, spawn it. It owns its schema, so it stays right when the schema moves.
 *   2. If it is not, write `~/.claude.json` ourselves. This is the path the desktop-only user takes,
 *      which is to say the common one.
 *
 * 🔴 **A CLI that is present and *refuses* does not fall through to the write.** That asymmetry is
 * deliberate. "No CLI" is an absence we can safely route around; "the CLI said no" is the tool
 * telling us something — a managed or enterprise config, a permissions problem, a name already
 * taken — and writing the file behind its back would produce exactly the invisible, contradictory
 * state this phase exists to stop. We report it and show the command instead.
 *
 * ## What the write path must not do
 *
 * ⚠️ `~/.claude.json` is not a small config we can rewrite. Measured on this machine: **64KB of the
 * user's own state across 58 top-level keys** — every project they have opened, their history,
 * their onboarding flags — of which `mcpServers` is one. So the write is read-modify-write, keyed,
 * backed up, and atomic, and **malformed JSON is a refusal rather than an overwrite**: a file we
 * cannot parse is far more likely to be a file we must not clobber than one we should replace.
 *
 * Verified against a copy of that real file: 58 keys in and 58 out, every non-`mcpServers` byte
 * identical, both pre-existing registrations untouched, and ours replaced rather than duplicated.
 *
 * ## FIX-008 A — the config is read *before* anything is asked to write it
 *
 * 🔴 **The requested end state can already be true, and reporting that as a failure is a lie.**
 * `claude mcp add` refuses a name that exists ("MCP server already exists in user config"), and this
 * module used to surface that refusal raw: a user who had connected once — or who clicked twice —
 * got a red error for a server that was registered and working. That is report 5's first sentence.
 *
 * So every route now starts by reading `~/.claude.json` and comparing what is there against what we
 * would write:
 *
 *   - **identical** → `already-registered`, a success, and nothing is spawned or written at all.
 *   - **different** (a stale bundle path from an older install) → replace it, and *say* that is what
 *     happened. Via the CLI that is `mcp remove` then `mcp add`, because the CLI has no update verb;
 *     via the file it is the write that was always a replace.
 *   - **absent** → exactly what this module did before.
 *
 * ⚠️ Reading first does **not** weaken the asymmetry above. We still never write behind a CLI that
 * refused; we merely stop asking it a question we can already answer.
 *
 * @module main/src/mcp/connectBootstrapServer
 */

const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnSync } = require('child_process');

const { resolveClaudeCli } = require('./resolveClaudeCli');

/** The registration name. Bare `nodegx`, which `nodegx-<slug>` can never collide with. */
const BOOTSTRAP_SERVER_NAME = 'nodegx';

/** `--scope user`: available in every directory, which is the only scope this card can promise. */
const MCP_SCOPE = 'user';

/** How long the CLI gets. It normally answers instantly; a hang must not wedge the click. */
const CLI_TIMEOUT_MS = 20000;

/** Claude Code's user-scope config. Verified by adding a probe registration and reading it back. */
function claudeConfigPath(homedir) {
  return path.join(homedir || os.homedir(), '.claude.json');
}

/** What the user runs to undo this, whichever way it went in. */
function removeCommand() {
  return `claude mcp remove --scope ${MCP_SCOPE} ${BOOTSTRAP_SERVER_NAME}`;
}

/**
 * Read Claude Code's config, or say why it could not be read.
 *
 * Shared by the pre-read and the write path so there is one answer to "what is in there" — a
 * refusal to parse must mean the same thing to both, and the write path's refusal message is the
 * one the user sees either way.
 *
 * @returns {{ ok: boolean, existing: object, detail: string|null }} `existing` is `{}` both when the
 *   file is absent and when it is empty, which are the same thing for our purposes.
 */
function readClaudeConfig(configPath, io) {
  if (!io.existsSync(configPath)) return { ok: true, existing: {}, detail: null };

  let raw;
  try {
    raw = io.readFileSync(configPath, 'utf8');
  } catch (e) {
    return { ok: false, existing: {}, detail: `Could not read ${configPath}: ${e.message}` };
  }

  if (!raw.trim()) return { ok: true, existing: {}, detail: null };

  let parsed;
  try {
    parsed = JSON.parse(raw);
  } catch (e) {
    // 🔴 Refuse, do not replace. A file we cannot parse is much more likely to be one we must
    // not destroy than one we should overwrite — and the user can still use the command.
    return {
      ok: false,
      existing: {},
      detail:
        `${configPath} is not valid JSON, so NodeGX will not write to it — replacing it would ` +
        `discard whatever else is in there. Run the command below instead, or repair the file.`
    };
  }

  if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
    return { ok: false, existing: {}, detail: `${configPath} does not contain a JSON object.` };
  }

  return { ok: true, existing: parsed, detail: null };
}

/**
 * FIX-008 A — what is registered under our name right now, if anything.
 *
 * ⚠️ **Top-level `mcpServers` only, which is exactly `--scope user`.** The same file also carries
 * per-directory registrations under `projects[dir].mcpServers`; those are a different scope with
 * different visibility, and treating one as the other is how "it says it is connected and the tool
 * cannot see it" happens.
 *
 * @returns {{ readable: boolean, entry: object|null, detail: string|null }} `readable: false` is a
 *   file we could not parse — a state where we know nothing, and must not claim we do.
 */
function readExistingRegistration(configPath, options) {
  const opts = options || {};
  const io = opts.fs || fs;

  const read = readClaudeConfig(configPath, io);
  if (!read.ok) return { readable: false, entry: null, detail: read.detail };

  const servers = read.existing.mcpServers;
  const entry = servers && typeof servers === 'object' ? servers[BOOTSTRAP_SERVER_NAME] : undefined;
  const isObject = entry !== null && typeof entry === 'object' && !Array.isArray(entry);

  return { readable: true, entry: isObject ? entry : null, detail: null };
}

/**
 * Is what is registered the registration we would write?
 *
 * ⚠️ **The four fields we author, and no more.** An entry carrying a key the client added for its
 * own reasons is still *our* registration; treating it as different would re-register on every
 * click and undo whatever the client put there. Absent `env` and empty `env` are the same thing.
 */
function sameRegistration(a, b) {
  if (!a || !b) return false;
  if ((a.type || 'stdio') !== (b.type || 'stdio')) return false;
  if (a.command !== b.command) return false;

  const argsA = Array.isArray(a.args) ? a.args : [];
  const argsB = Array.isArray(b.args) ? b.args : [];
  if (argsA.length !== argsB.length || argsA.some((arg, i) => arg !== argsB[i])) return false;

  const envA = a.env && typeof a.env === 'object' ? a.env : {};
  const envB = b.env && typeof b.env === 'object' ? b.env : {};
  const keys = new Set([...Object.keys(envA), ...Object.keys(envB)]);
  for (const key of keys) {
    if (String(envA[key]) !== String(envB[key])) return false;
  }

  return true;
}

/**
 * The CLI's argv for this registration.
 *
 * ⚠️ **Built from the registration, not by splitting the display string.** The display string is
 * shell-quoted for a human to paste; re-parsing it here would be a quoting bug waiting to happen on
 * the first project path with a space in it. Same facts, two renderings, neither derived from the
 * other.
 *
 * 🔴 **`-e` goes after the server name.** It is declared variadic (`-e, --env <env...>`), so placed
 * before the name it swallows the name and the command dies with
 * `Invalid environment variable format: nodegx`. That was F78, found by running the string against
 * the real client rather than by reading it.
 */
function cliArgs(registration) {
  const env = Object.entries(registration.env || {}).flatMap(([k, v]) => ['-e', `${k}=${v}`]);
  return ['mcp', 'add', '--scope', MCP_SCOPE, BOOTSTRAP_SERVER_NAME, ...env, '--', registration.command, ...registration.args];
}

/**
 * Register by spawning the CLI.
 *
 * @returns {{ ok: boolean, detail: string|null }}
 */
function registerViaCli(exec, registration, options) {
  const opts = options || {};
  const spawn = opts.spawnSync || spawnSync;

  try {
    const result = spawn(exec, cliArgs(registration), {
      encoding: 'utf8',
      timeout: CLI_TIMEOUT_MS,
      windowsHide: true,
      env: opts.env || process.env
    });

    if (result.error) return { ok: false, detail: result.error.message };
    if (result.status !== 0) {
      // The CLI's own words. It is more specific than anything we could infer from an exit code —
      // "already exists", a managed-settings refusal, a permissions problem — and the user needs
      // the specific one.
      const said = `${result.stderr || ''}${result.stdout || ''}`.trim();
      return { ok: false, detail: said || `The CLI exited with status ${result.status}.` };
    }
    return { ok: true, detail: null };
  } catch (e) {
    return { ok: false, detail: e && e.message ? e.message : String(e) };
  }
}

/**
 * FIX-008 A — drop an existing registration so the CLI will accept a new one.
 *
 * ⚠️ `claude mcp add` has no update verb: it refuses a name that exists, full stop. So replacing a
 * stale entry is remove-then-add, and a remove that fails must stop the sequence rather than let
 * the add fail with the message this whole fix exists to stop showing.
 *
 * @returns {{ ok: boolean, detail: string|null }}
 */
function removeViaCli(exec, options) {
  const opts = options || {};
  const spawn = opts.spawnSync || spawnSync;

  try {
    const result = spawn(exec, ['mcp', 'remove', '--scope', MCP_SCOPE, BOOTSTRAP_SERVER_NAME], {
      encoding: 'utf8',
      timeout: CLI_TIMEOUT_MS,
      windowsHide: true,
      env: opts.env || process.env
    });

    if (result.error) return { ok: false, detail: result.error.message };
    if (result.status !== 0) {
      const said = `${result.stderr || ''}${result.stdout || ''}`.trim();
      return { ok: false, detail: said || `The CLI exited with status ${result.status}.` };
    }
    return { ok: true, detail: null };
  } catch (e) {
    return { ok: false, detail: e && e.message ? e.message : String(e) };
  }
}

/**
 * Register by editing Claude Code's config directly.
 *
 * Read-modify-write, so the twenty-four other top-level keys survive; backed up first; written via
 * a temp file in the same directory and renamed, so a crash mid-write cannot leave a truncated file
 * where the user's state used to be.
 *
 * @returns {{ ok: boolean, detail: string|null, backupPath: string|null }}
 */
function registerViaConfigFile(configPath, registration, options) {
  const opts = options || {};
  const io = opts.fs || fs;

  const read = readClaudeConfig(configPath, io);
  if (!read.ok) return { ok: false, backupPath: null, detail: read.detail };
  const existing = read.existing;

  // Back up whatever was there before touching it.
  let backupPath = null;
  if (io.existsSync(configPath)) {
    backupPath = `${configPath}.nodegx-backup`;
    try {
      io.copyFileSync(configPath, backupPath);
    } catch (e) {
      return { ok: false, backupPath: null, detail: `Could not back up ${configPath}: ${e.message}` };
    }
  }

  const servers = existing.mcpServers && typeof existing.mcpServers === 'object' ? existing.mcpServers : {};
  const next = { ...existing, mcpServers: { ...servers, [BOOTSTRAP_SERVER_NAME]: registration } };

  // Temp file in the same directory, then rename: same filesystem, so the swap is atomic.
  const tempPath = `${configPath}.nodegx-tmp`;
  try {
    io.writeFileSync(tempPath, `${JSON.stringify(next, null, 2)}\n`, { encoding: 'utf8', mode: 0o600 });
    io.renameSync(tempPath, configPath);
  } catch (e) {
    try {
      if (io.existsSync(tempPath)) io.unlinkSync(tempPath);
    } catch (cleanupError) {
      /* the temp file is noise, not a failure to report over the real one */
    }
    return { ok: false, backupPath, detail: `Could not write ${configPath}: ${e.message}` };
  }

  return { ok: true, backupPath, detail: null };
}

/**
 * Connect the bootstrap server, by whichever route this machine allows.
 *
 * ⚠️ **Every success says where it went and how to undo it.** `--scope user` registers the server in
 * *every* directory, which is right for a bootstrap server and is not what a person expects a button
 * in an app to do. A silent success is the uninstall problem arriving by a different door.
 *
 * @param {import('../../../editor/src/views/panels/SettingsPanel/sections/mcpCommands').BootstrapRegistration} registration
 * @param {string|null} command the display command, for the copy fallback when both routes fail.
 * @returns {{ ok: boolean, method: 'cli'|'config-file'|'already-registered'|null, serverName: string,
 *   configPath: string, removeCommand: string, backupPath: string|null, message: string,
 *   detail: string|null, command: string|null, probed: string[], replaced: boolean }}
 */
function connectBootstrapServer(registration, command, options) {
  const opts = options || {};
  const configPath = opts.configPath || claudeConfigPath(opts.homedir);
  const cli = (opts.resolveClaudeCli || resolveClaudeCli)(opts);

  const base = {
    serverName: BOOTSTRAP_SERVER_NAME,
    configPath,
    removeCommand: removeCommand(),
    backupPath: null,
    command,
    probed: cli.probed,
    replaced: false
  };

  if (!registration) {
    return {
      ...base,
      ok: false,
      method: null,
      message: 'NodeGX could not work out what to register.',
      detail: 'The authoring server bundle was not found, so there is no command to run.'
    };
  }

  // ── 0. FIX-008 A — what is already there ─────────────────────────────────
  // ⚠️ Before either route, because the cheapest way to succeed at "register this server" is to
  // discover it is registered. A file we cannot read leaves `entry` null and changes nothing: we
  // then behave exactly as this module did before, and the write path refuses with its own words.
  const existing = readExistingRegistration(configPath, opts);

  if (existing.entry && sameRegistration(existing.entry, registration)) {
    return {
      ...base,
      ok: true,
      method: 'already-registered',
      message:
        `Claude Code is already connected. The server is registered as “${BOOTSTRAP_SERVER_NAME}” for ` +
        `your user account, so it is available in every folder — there was nothing to change.`,
      detail: null
    };
  }

  // A `nodegx` that is not ours: an older install's bundle path, or a different runtime. It is our
  // name, so we replace it — and every message below says so, because a silent replacement of a
  // registration the user may have hand-edited is the invisible state this module refuses to create.
  const replacing = Boolean(existing.entry);

  // ── 1. The CLI, when there is one ────────────────────────────────────────
  if (cli.found) {
    if (replacing) {
      const removed = removeViaCli(cli.exec, opts);
      if (!removed.ok) {
        return {
          ...base,
          ok: false,
          method: 'cli',
          replaced: false,
          message: `Claude Code’s CLI declined to replace the existing “${BOOTSTRAP_SERVER_NAME}” registration.`,
          detail: removed.detail
        };
      }
    }

    const viaCli = registerViaCli(cli.exec, registration, opts);
    if (viaCli.ok) {
      return {
        ...base,
        ok: true,
        method: 'cli',
        replaced: replacing,
        message: replacing
          ? `Claude Code can now build NodeGX apps. An earlier “${BOOTSTRAP_SERVER_NAME}” registration ` +
            `pointed somewhere else and was replaced; the new one is registered for your user account, ` +
            `so it is available in every folder.`
          : `Claude Code can now build NodeGX apps. The server is registered as “${BOOTSTRAP_SERVER_NAME}” ` +
            `for your user account, so it is available in every folder — you do not have to be anywhere ` +
            `in particular to use it.`,
        detail: null
      };
    }

    // 🔴 Present and refusing: report, do not route around it.
    return {
      ...base,
      ok: false,
      method: 'cli',
      message: 'Claude Code’s CLI declined to add the server.',
      detail: viaCli.detail
    };
  }

  // ── 2. No CLI — the desktop-app user, which F14 says is the usual case ───
  const viaFile = registerViaConfigFile(configPath, registration, opts);
  if (viaFile.ok) {
    return {
      ...base,
      ok: true,
      method: 'config-file',
      backupPath: viaFile.backupPath,
      replaced: replacing,
      message:
        (replacing
          ? `Claude Code can now build NodeGX apps. An earlier “${BOOTSTRAP_SERVER_NAME}” registration ` +
            `pointed somewhere else and was replaced; the new one is registered for your user account, ` +
            `so it is available in every folder. `
          : `Claude Code can now build NodeGX apps. The server is registered as “${BOOTSTRAP_SERVER_NAME}” ` +
            `for your user account, so it is available in every folder. `) +
        `Restart Claude Code if it is already open — it reads this when it starts.`,
      detail: null
    };
  }

  return {
    ...base,
    ok: false,
    method: 'config-file',
    backupPath: viaFile.backupPath,
    message: 'NodeGX could not add the server to Claude Code’s configuration.',
    detail: viaFile.detail
  };
}

module.exports = {
  BOOTSTRAP_SERVER_NAME,
  claudeConfigPath,
  cliArgs,
  connectBootstrapServer,
  readExistingRegistration,
  registerViaConfigFile,
  sameRegistration
};
