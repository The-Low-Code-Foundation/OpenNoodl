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

  let existing = {};
  if (io.existsSync(configPath)) {
    let raw;
    try {
      raw = io.readFileSync(configPath, 'utf8');
    } catch (e) {
      return { ok: false, backupPath: null, detail: `Could not read ${configPath}: ${e.message}` };
    }

    if (raw.trim()) {
      try {
        existing = JSON.parse(raw);
      } catch (e) {
        // 🔴 Refuse, do not replace. A file we cannot parse is much more likely to be one we must
        // not destroy than one we should overwrite — and the user can still use the command.
        return {
          ok: false,
          backupPath: null,
          detail:
            `${configPath} is not valid JSON, so NodeGX will not write to it — replacing it would ` +
            `discard whatever else is in there. Run the command below instead, or repair the file.`
        };
      }
    }

    if (existing === null || typeof existing !== 'object' || Array.isArray(existing)) {
      return { ok: false, backupPath: null, detail: `${configPath} does not contain a JSON object.` };
    }
  }

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
 * @returns {{ ok: boolean, method: 'cli'|'config-file'|null, serverName: string,
 *   configPath: string, removeCommand: string, backupPath: string|null, message: string,
 *   detail: string|null, command: string|null, probed: string[] }}
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
    probed: cli.probed
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

  // ── 1. The CLI, when there is one ────────────────────────────────────────
  if (cli.found) {
    const viaCli = registerViaCli(cli.exec, registration, opts);
    if (viaCli.ok) {
      return {
        ...base,
        ok: true,
        method: 'cli',
        message:
          `Claude Code can now build NodeGX apps. The server is registered as “${BOOTSTRAP_SERVER_NAME}” ` +
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
      message:
        `Claude Code can now build NodeGX apps. The server is registered as “${BOOTSTRAP_SERVER_NAME}” ` +
        `for your user account, so it is available in every folder. Restart Claude Code if it is ` +
        `already open — it reads this when it starts.`,
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
  registerViaConfigFile
};
