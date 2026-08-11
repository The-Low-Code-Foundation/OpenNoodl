/**
 * BST-004 — which runtime the emitted `claude mcp add` command should name.
 *
 * Every command this product emitted used to start with `node`, on TALK-004 decision 8's premise
 * that *"anyone running an MCP client has Node"*. That is true of someone running the `claude` CLI
 * from a checkout and false of the person this phase serves: a designer who installed the Claude
 * Code desktop app and a NodeGX installer and has never opened a terminal.
 *
 * ⚠️ **And the failure is silent in the worst way.** `claude mcp add` *records* a command; it does
 * not run it. The registration succeeds, the card says connected, and the server dies later inside
 * the client with a `spawn node ENOENT` nobody sees in NodeGX.
 *
 * So: detect, do not assume — and detect here, in main, beside the bundle resolution, because a
 * renderer that guesses will guess wrong on exactly the machines that matter.
 *
 * ## Why the obvious probe is wrong
 *
 * ⚠️ **The command is pasted into the user's terminal, so the user's *login shell* PATH is the
 * thing that decides whether it runs — not this process's PATH.** Those differ, and they differ
 * hardest on the machines we care most about being right on:
 *
 *   - A macOS app launched from Finder or the Dock inherits a stub `PATH` of
 *     `/usr/bin:/bin:/usr/sbin:/sbin` — it does not read `.zshrc` and never sees Homebrew or nvm.
 *   - nvm in particular installs node to `~/.nvm/versions/node/<v>/bin` and puts it on `PATH`
 *     purely from a shell rc file. Measured on this repo's own machine: the fast probe reports
 *     ENOENT while `zsh -lic 'command -v node'` finds it.
 *
 * A naive `spawnSync('node')` therefore answers "no node" for a developer with nvm — the person
 * *most* likely to have it. Under-detecting is not harmless: it would swap the shipped, legible
 * `node <path>` command for the strange one on a machine that never needed it, which is precisely
 * what BST-004's acceptance forbids.
 *
 * ## So there are two probes, in cost order
 *
 *   1. **This process's PATH** — ~17ms, and correct whenever the editor was started from a
 *      terminal (every checkout, every `npm run dev`).
 *   2. **The login shell** — `$SHELL -lic 'command -v node'`, ~2.3s, and the only probe that
 *      answers the question actually being asked. Run only when (1) misses, and cached for the
 *      life of the process, because a login shell's PATH does not change under a running app.
 *      `warmNodeRuntime()` runs it off the critical path at startup so the settings panel does
 *      not pay for it.
 *
 * Both probes report into `probed`, on `resolveMcpServer`'s rule: when it misses, the list of
 * things tried *is* the bug report.
 *
 * @module main/src/mcp/resolveNodeRuntime
 */

const { probeProcessPath, probeLoginShellCached, resetProbeCache } = require('./probeBinary');

/**
 * The binary this module is about. Also the cache key in `probeBinary`.
 *
 * ⚠️ The two probes below were lifted into `probeBinary.js` when BST-003 needed the identical pair
 * for `claude`. The reasoning that makes them look over-engineered lives there; this module is now
 * only the *policy* — which answer we prefer, and what we emit for it.
 */
const NODE_BINARY = 'node';

/** Anything that answers a `vN.` version is a runtime, rather than something merely named `node`. */
const isNodeVersion = (stdout) => /^v\d+\./.test(stdout);

/** Test seam: forget the cached login-shell answer. */
function resetNodeRuntimeCache() {
  resetProbeCache(NODE_BINARY);
}

/**
 * Which runtimes are available to run an MCP server bundle, and how we know.
 *
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env] test seam — the environment to probe with.
 * @param {string} [options.platform] test seam — `process.platform`.
 * @param {string} [options.execPath] test seam — the Electron binary, normally `process.execPath`.
 * @param {boolean} [options.skipLoginShell] skip the slow probe; used by `warmNodeRuntime`'s
 *   fast pre-check and by tests that must not spawn a shell.
 * @returns {{ hasNode: boolean, nodePath: string|null, electron: string,
 *   detection: 'path'|'login-shell'|'none', probed: string[] }}
 *
 * ⚠️ **`nodePath` is evidence, not the command.** Even when only the login shell found node, the
 * command we emit says the bare word `node` — that command is pasted into *that same shell*, where
 * the bare word resolves. Emitting the absolute path instead would bake in a
 * `~/.nvm/versions/node/v22.22.0/bin/node` that breaks the next time the user switches versions,
 * and would make the shipped command differ on a machine that has a perfectly good `node`.
 */
function resolveNodeRuntime(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const platform = opts.platform || process.platform;
  const electron = opts.execPath || process.execPath;

  const probed = ['node (on this process’s PATH)'];

  if (probeProcessPath(NODE_BINARY, env, isNodeVersion)) {
    return { hasNode: true, nodePath: null, electron, detection: 'path', probed };
  }

  if (opts.skipLoginShell) {
    return { hasNode: false, nodePath: null, electron, detection: 'none', probed };
  }

  const loginShellResult = probeLoginShellCached(NODE_BINARY, env, platform);
  probed.push(...loginShellResult.probed);

  return loginShellResult.path
    ? { hasNode: true, nodePath: loginShellResult.path, electron, detection: 'login-shell', probed }
    : { hasNode: false, nodePath: null, electron, detection: 'none', probed };
}

/**
 * Run the slow probe once, off the critical path.
 *
 * Called at app ready. Without it the first person to open the settings panel on a Finder-launched
 * mac pays the login shell's ~2.3s inside a synchronous IPC handler. It resolves rather than
 * rejects on failure: a warm-up that cannot warm is not an error, it just means the panel pays.
 *
 * @returns {Promise<void>}
 */
function warmNodeRuntime(options) {
  return new Promise((resolve) => {
    setImmediate(() => {
      try {
        // If this process's PATH already has node, the slow probe is never needed at all.
        if (resolveNodeRuntime({ ...options, skipLoginShell: true }).hasNode) return resolve();
        resolveNodeRuntime(options);
      } catch (e) {
        /* a warm-up that cannot warm is not an error */
      }
      resolve();
    });
  });
}

module.exports = { resolveNodeRuntime, warmNodeRuntime, resetNodeRuntimeCache };
