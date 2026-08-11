/**
 * BST-003 — "is this executable on the machine, and where?", asked the two ways that differ.
 *
 * This is BST-004's node probe with the binary name lifted out. It was extracted rather than
 * copied because the *reasoning* is the expensive part and it is identical for both binaries: a
 * Finder-launched macOS app inherits a stub `PATH` of `/usr/bin:/bin:/usr/sbin:/sbin`, never reads
 * `.zshrc`, and therefore cannot see anything installed by nvm, Homebrew or the `claude` native
 * installer's `~/.local/bin`. A single `spawnSync(name)` answers "not installed" on precisely the
 * machines where it *is* installed.
 *
 * 🔴 **Measured twice, on two different binaries, one task apart.** BST-004 found it for `node`
 * (F79). BST-003 found the same thing for `claude` (F85) — on this repo's own machine the CLI is an
 * npm global under nvm, so under the Finder PATH `which claude` exits 1 while the login shell finds
 * it in 2.27s. Two findings, one mechanism; hence one prober.
 *
 * ## The two probes, in cost order
 *
 *   1. **This process's PATH** — ~17ms. Correct whenever the editor was started from a terminal,
 *      which is every checkout and every `npm run dev`.
 *   2. **The login shell** — `$SHELL -lic 'command -v <name>'`, ~2.3s. The only probe that sees what
 *      the user's own shell sees. Run only when (1) misses, and cached per binary for the life of
 *      the process, because a login shell's PATH does not change under a running app.
 *
 * ⚠️ **The two probes do not return interchangeable answers, and the caller must care which.**
 * Probe (1) means "spawnable by us as a bare name". Probe (2) means "exists, at *this absolute
 * path*, which our own PATH cannot resolve" — so a caller that intends to **spawn** the binary must
 * use the absolute path, while a caller emitting text for the user's terminal should keep the bare
 * name (see `resolveNodeRuntime`'s note on baking in an nvm version directory).
 *
 * @module main/src/mcp/probeBinary
 */

const { spawnSync } = require('child_process');

/** How long the login shell gets before we call it a miss. It normally answers in ~2s. */
const LOGIN_SHELL_TIMEOUT_MS = 5000;

/**
 * Login-shell answers, keyed by binary name, for the life of the process.
 *
 * A missing key means "not probed yet"; a stored `{ path: null }` means "probed, and it is not
 * there". The distinction matters — without it a cached miss is indistinguishable from a cold cache
 * and the slow probe runs on every call.
 *
 * @type {Map<string, { path: string|null, probed: string[] }>}
 */
const loginShellCache = new Map();

/**
 * Test seam: forget cached login-shell answers.
 *
 * @param {string} [binary] one binary, or all of them when omitted.
 */
function resetProbeCache(binary) {
  if (binary) loginShellCache.delete(binary);
  else loginShellCache.clear();
}

/**
 * Is `binary` on *this process's* PATH?
 *
 * Runs `<binary> --version`: a hit is cheap, and anything that answers a version is a real runtime
 * rather than something merely named the same. `validate` narrows that further where the caller
 * knows what the output should look like.
 *
 * @param {string} binary
 * @param {NodeJS.ProcessEnv} env
 * @param {(stdout: string) => boolean} [validate] defaults to "exited 0 and said something".
 * @returns {boolean}
 */
function probeProcessPath(binary, env, validate) {
  try {
    const result = spawnSync(binary, ['--version'], { encoding: 'utf8', env, windowsHide: true });
    if (result.error || result.status !== 0) return false;
    const stdout = (result.stdout || '').trim();
    return validate ? validate(stdout) : stdout.length > 0;
  } catch (e) {
    return false;
  }
}

/**
 * Ask the user's login shell where `binary` is.
 *
 * ⚠️ `-l` (login) is what reads `.zprofile`/`.bash_profile`, and `-i` (interactive) is what reads
 * `.zshrc` — **nvm's initialisation lives in the latter on a default install**, so a login-only
 * shell misses it. Hence `-lic`, and hence the timeout: an interactive rc file can prompt, and a
 * shell that blocks forever must read as a miss rather than hang the caller.
 *
 * Windows has no equivalent and does not need one: a GUI process there inherits the user's real
 * `PATH`, so `probeProcessPath` is already the right answer.
 *
 * @returns {{ path: string|null, probed: string[] }} an **absolute** path, or `null`.
 */
function probeLoginShell(binary, env, platform) {
  if (platform === 'win32') return { path: null, probed: [] };

  const shell = (env && env.SHELL) || '/bin/sh';
  const attempt = `${shell} -lic 'command -v ${binary}'`;

  try {
    const result = spawnSync(shell, ['-lic', `command -v ${binary}`], {
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
 * The login-shell probe, cached per binary.
 *
 * @returns {{ path: string|null, probed: string[] }}
 */
function probeLoginShellCached(binary, env, platform) {
  if (!loginShellCache.has(binary)) loginShellCache.set(binary, probeLoginShell(binary, env, platform));
  return loginShellCache.get(binary);
}

module.exports = {
  LOGIN_SHELL_TIMEOUT_MS,
  probeProcessPath,
  probeLoginShell,
  probeLoginShellCached,
  resetProbeCache
};
