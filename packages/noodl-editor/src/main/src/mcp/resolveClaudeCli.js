/**
 * BST-003 — is the `claude` CLI on this machine, and what do we spawn to reach it?
 *
 * ## Why this exists at all, and why the answer is usually "no"
 *
 * 🔴 **F14, measured: a Claude Code desktop-app user does not have the CLI.** The docs say it in as
 * many words — *"The desktop app includes Claude Code. You don't need to install Node.js or the CLI
 * separately. To use `claude` from the terminal, install the CLI separately."* — and the shipped
 * bundle confirms it: `Claude.app` contains no `claude` binary and no bundled node. The app's own
 * pitch is *"No terminal required"*, so the person this card exists for is exactly the person who
 * has nothing for us to spawn.
 *
 * That is why `connectBootstrapServer` treats this module's `false` as an ordinary, expected answer
 * with a real second path behind it, rather than as a failure to report.
 *
 * ## 🔴 The difference from `resolveNodeRuntime`, which is not cosmetic
 *
 * `resolveNodeRuntime` answers *"what word do we put in a command the user will paste into their
 * own shell?"* — and the answer stays the bare word `node` even when only the login shell found it,
 * because that command is pasted into that same shell.
 *
 * **This module answers a different question: what do *we* spawn, from a process whose PATH is very
 * possibly `/usr/bin:/bin:/usr/sbin:/sbin`?** So when the login shell is what found it, the bare
 * word is useless to us and `exec` is the **absolute path**. Measured on this machine (F85): under
 * the Finder-inherited PATH `which claude` exits 1, because the CLI is an npm global under nvm,
 * while `zsh -lic 'command -v claude'` returns
 * `/Users/…/.nvm/versions/node/v22.22.0/bin/claude` in 2.27s.
 *
 * Getting this backwards produces the most annoying possible bug: works for every developer who
 * launched the editor from a terminal, fails for every user who launched it from the Dock.
 *
 * @module main/src/mcp/resolveClaudeCli
 */

const { probeProcessPath, probeLoginShellCached, resetProbeCache } = require('./probeBinary');

/** The binary, and the cache key in `probeBinary`. */
const CLAUDE_BINARY = 'claude';

/**
 * Does this look like Claude Code rather than something else called `claude`?
 *
 * `claude --version` prints `2.1.217 (Claude Code)`. Matching the parenthesised product name is
 * tighter than matching a version number, and **a false negative is cheap**: we fall through to
 * writing the config ourselves, which is a path that works anyway. A false *positive* is the
 * expensive one — spawning some unrelated binary with `mcp add` arguments — so this errs tight.
 */
const isClaudeCode = (stdout) => /claude\s+code/i.test(stdout);

/** Test seam: forget the cached login-shell answer. */
function resetClaudeCliCache() {
  resetProbeCache(CLAUDE_BINARY);
}

/**
 * Find the CLI, or establish that there isn't one.
 *
 * @param {object} [options]
 * @param {NodeJS.ProcessEnv} [options.env] test seam.
 * @param {string} [options.platform] test seam — `process.platform`.
 * @param {boolean} [options.skipLoginShell] skip the slow probe, for the warm-up pre-check and for
 *   tests that must not spawn a shell.
 * @returns {{ found: boolean, exec: string|null, detection: 'path'|'login-shell'|'none',
 *   probed: string[] }} `exec` is directly spawnable — the bare name when our own PATH has it, an
 *   absolute path when only the login shell did.
 */
function resolveClaudeCli(options) {
  const opts = options || {};
  const env = opts.env || process.env;
  const platform = opts.platform || process.platform;

  const probed = ['claude (on this process’s PATH)'];

  if (probeProcessPath(CLAUDE_BINARY, env, isClaudeCode)) {
    return { found: true, exec: CLAUDE_BINARY, detection: 'path', probed };
  }

  if (opts.skipLoginShell) {
    return { found: false, exec: null, detection: 'none', probed };
  }

  const loginShell = probeLoginShellCached(CLAUDE_BINARY, env, platform);
  probed.push(...loginShell.probed);

  // ⚠️ The absolute path, not the bare name: our PATH is the one that just missed it.
  return loginShell.path
    ? { found: true, exec: loginShell.path, detection: 'login-shell', probed }
    : { found: false, exec: null, detection: 'none', probed };
}

/**
 * Run the slow probe once, off the critical path.
 *
 * Same reasoning as `warmNodeRuntime`: on a Finder-launched mac the login shell costs ~2.3s, and
 * the user should not pay it standing in front of a button they just clicked. Resolves rather than
 * rejects — a warm-up that cannot warm is not an error, it just means the click pays.
 *
 * @returns {Promise<void>}
 */
function warmClaudeCli(options) {
  return new Promise((resolve) => {
    setImmediate(() => {
      try {
        if (resolveClaudeCli({ ...options, skipLoginShell: true }).found) return resolve();
        resolveClaudeCli(options);
      } catch (e) {
        /* a warm-up that cannot warm is not an error */
      }
      resolve();
    });
  });
}

module.exports = { CLAUDE_BINARY, resolveClaudeCli, warmClaudeCli, resetClaudeCliCache };
