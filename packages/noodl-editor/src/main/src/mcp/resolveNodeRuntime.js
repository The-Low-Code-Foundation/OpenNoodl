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

const { spawnSync } = require('child_process');

/** How long the login shell gets before we call it a miss. It normally answers in ~2s. */
const LOGIN_SHELL_TIMEOUT_MS = 5000;

/**
 * The login shell's answer, cached for the life of the process.
 *
 * `undefined` means "not probed yet"; `null` means "probed, and it does not have node". The
 * distinction matters — without it a cached miss is indistinguishable from a cold cache and the
 * slow probe runs on every call.
 *
 * @type {{ path: string|null, probed: string[] }|undefined}
 */
let loginShellResult;

/** Test seam: forget the cached login-shell answer. */
function resetNodeRuntimeCache() {
  loginShellResult = undefined;
}

/**
 * Is there a `node` on this process's PATH, and where?
 *
 * `--version` rather than `--help` so a hit is cheap, and because anything that answers a version
 * is a runtime rather than something merely named `node`.
 *
 * @returns {string|null} the name we would emit, or `null`
 */
function probeProcessPath(env) {
  try {
    const result = spawnSync('node', ['--version'], { encoding: 'utf8', env, windowsHide: true });
    if (result.error || result.status !== 0) return null;
    return /^v\d+\./.test((result.stdout || '').trim()) ? 'node' : null;
  } catch (e) {
    return null;
  }
}

/**
 * Ask the user's login shell, which is the shell they will paste the command into.
 *
 * ⚠️ `-l` (login) is what reads `.zprofile`/`.bash_profile`, and `-i` (interactive) is what reads
 * `.zshrc` — **nvm's initialisation lives in the latter on a default install**, so a login-only
 * shell misses it. Hence `-lic`, and hence the timeout: an interactive rc file can prompt, and a
 * shell that blocks forever must read as a miss rather than hang the settings panel.
 *
 * Windows has no equivalent and does not need one: a GUI process there inherits the user's real
 * `PATH`, so `probeProcessPath` is already the right answer.
 */
function probeLoginShell(env, platform) {
  if (platform === 'win32') return { path: null, probed: [] };

  const shell = (env && env.SHELL) || '/bin/sh';
  const attempt = `${shell} -lic 'command -v node'`;

  try {
    const result = spawnSync(shell, ['-lic', 'command -v node'], {
      encoding: 'utf8',
      env,
      timeout: LOGIN_SHELL_TIMEOUT_MS,
      windowsHide: true
    });
    if (result.error || result.status !== 0) return { path: null, probed: [attempt] };

    // An interactive shell may print rc-file noise first; the path is the last non-empty line.
    const lines = (result.stdout || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);
    const found = lines.length ? lines[lines.length - 1] : '';
    return { path: found.startsWith('/') ? found : null, probed: [attempt] };
  } catch (e) {
    return { path: null, probed: [attempt] };
  }
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

  if (probeProcessPath(env)) {
    return { hasNode: true, nodePath: null, electron, detection: 'path', probed };
  }

  if (opts.skipLoginShell) {
    return { hasNode: false, nodePath: null, electron, detection: 'none', probed };
  }

  if (loginShellResult === undefined) loginShellResult = probeLoginShell(env, platform);
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
