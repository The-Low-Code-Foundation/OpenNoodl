#!/usr/bin/env node
/**
 * Kills the dev stack when its launcher dies without cleaning up.
 *
 * `scripts/start.ts` has handlers for every signal it can catch, and they work.
 * The problem is the signals it *cannot* catch. `kill -9`, `pkill -f node`, a
 * force-quit, or an OOM kill all take the launcher out with no handler running
 * at all — and because the three dev branches are spawned `detached` (so they
 * can be killed by process group), nothing else stops them. The webpack watchers
 * carry on rebuilding on every file change, indefinitely.
 *
 * This process is the answer. It is spawned detached, holds no file handles, and
 * does one thing: poll the launcher pids with signal 0 until one of them is
 * gone, then sweep the stack and exit. It costs a `kill(pid, 0)` every two
 * seconds, which is free.
 *
 * It cannot outlive a `pkill -f node` itself — but neither can the webpack
 * processes it exists to kill, so that case needs no watchdog.
 *
 * Usage (not run by hand): dev-watchdog.js <pid> [<pid> ...]
 */
const { alive, removePidFile, sweep } = require('./dev-processes');

const watched = process.argv.slice(2).map(Number).filter(Boolean);

if (watched.length === 0) {
  process.stderr.write('[dev-watchdog] no launcher pids to watch — exiting\n');
  process.exit(1);
}

const POLL_MS = 2000;

/**
 * Any watched pid dying means the stack is broken, not just that one branch:
 * dev-debug.js and start.ts are a chain, and neither is useful without the other.
 * Sweeping on the first death is what makes a half-killed stack self-clean.
 */
function tick() {
  if (watched.every(alive)) return;

  clearInterval(timer);

  // protectAncestors: false — our parent is the launcher we are here to kill.
  const { killed } = sweep({
    protectAncestors: false,
    onLog: (line) => process.stderr.write(`[dev-watchdog] ${line}\n`)
  });
  if (killed.length > 0) {
    process.stderr.write(`[dev-watchdog] launcher gone — reaped ${killed.length} orphaned dev process(es)\n`);
  }
  removePidFile();
  process.exit(0);
}

const timer = setInterval(tick, POLL_MS);
