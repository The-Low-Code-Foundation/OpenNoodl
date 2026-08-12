#!/usr/bin/env node
/**
 * `npm run dev:stop` — kill every process this checkout's dev stack started.
 *
 * The launcher and the watchdog between them should make this unnecessary. It
 * exists anyway because "should" is not a guarantee you can act on when a fan is
 * spinning: this is the one command that answers "is anything of mine still
 * running, and can you stop it" without needing to know whether a pid file, a
 * process group or a watchdog survived.
 *
 * Usage:
 *   npm run dev:stop                      kill the dev stack
 *   npm run dev:stop -- --list            show what would be killed, kill nothing
 *   npm run dev:stop -- --all             also the agent-session helpers
 *   npm run dev:stop -- --stale 12        only things older than 12 hours
 *   npm run dev:stop -- --all --list      the survey: everything, killing nothing
 *
 * 🔴 **`--list` is the only spelling that kills nothing.** A bare `dev:stop` kills,
 * and on a machine where several agent sessions share one checkout it takes a
 * sibling's stack down silently. Survey first.
 *
 * ⚠️ **`--all` reaches another session's live work.** Session helpers are
 * checkout-scoped, not session-scoped — the scratchpad directory name encodes the
 * checkout, and nothing in a command line says which session started it. Pair it
 * with `--stale` whenever anyone else might be working: an age floor reaps the
 * four-day corpse and spares the drive that started ten minutes ago.
 */
const { findDevProcesses, removePidFile, sweep } = require('./dev-processes');

const argv = process.argv.slice(2);
const listOnly = argv.includes('--list') || argv.includes('--dry-run');
const includeScratchpad = argv.includes('--all') || argv.includes('--include-scratchpad');

/**
 * `--stale <hours>`. Rejected rather than defaulted when it is not a positive
 * number: a typo silently becoming "no floor" would turn the careful spelling of
 * this command into the dangerous one.
 */
let minAgeSeconds = 0;
const staleIndex = argv.findIndex((a) => a === '--stale');
if (staleIndex !== -1) {
  const hours = Number(argv[staleIndex + 1]);
  if (!Number.isFinite(hours) || hours <= 0) {
    process.stdout.write('--stale needs a positive number of hours, e.g. `--stale 12`.\n');
    process.exit(2);
  }
  minAgeSeconds = Math.round(hours * 3600);
}

if (process.platform === 'win32') {
  process.stdout.write('dev:stop is a POSIX-only helper; on Windows use `taskkill /pid <pid> /T /F`.\n');
  process.exit(0);
}

/** `[[dd-]hh:]mm:ss`-ish, from seconds — so a corpse is obvious at a glance. */
function humanAge(seconds) {
  if (!seconds) return '?';
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  if (d) return `${d}d${h}h`;
  if (h) return `${h}h${m}m`;
  return `${m}m`;
}

const options = { includeScratchpad, minAgeSeconds };
const found = findDevProcesses(options);

if (found.length === 0) {
  process.stdout.write('No NodeGX dev processes are running');
  process.stdout.write(includeScratchpad ? '' : ' (dev stack only — add `--all` to include session helpers)');
  process.stdout.write('.\n');
  // Only clear the pid file when nothing was filtered out of the answer. A
  // `--stale` run that found nothing has not proved the stack is gone; it has
  // proved nothing is *old*, and dropping the record would strand whatever is
  // young enough to have been skipped.
  if (!minAgeSeconds) removePidFile();
  process.exit(0);
}

const scope = [
  includeScratchpad ? 'dev stack + session helpers' : 'dev stack',
  minAgeSeconds ? `older than ${minAgeSeconds / 3600}h` : null
]
  .filter(Boolean)
  .join(', ');

process.stdout.write(`Found ${found.length} NodeGX process(es) — ${scope}:\n`);
for (const proc of found) {
  process.stdout.write(`  ${String(proc.pid).padStart(6)}  ${humanAge(proc.ageSeconds).padEnd(6)}  ${proc.command.slice(0, 110)}\n`);
}

if (listOnly) {
  process.stdout.write('\nNothing was killed (--list). Re-run without it to stop them.\n');
  process.exit(0);
}

const { killed } = sweep({ ...options, onLog: () => {} });

if (!minAgeSeconds) removePidFile();

// Report against a fresh scan rather than against what we asked for: the useful
// answer is what is running now, not what we sent signals to.
const survivors = findDevProcesses(options);
if (survivors.length > 0) {
  process.stdout.write(`\n⚠️  ${survivors.length} process(es) survived SIGKILL:\n`);
  for (const proc of survivors) process.stdout.write(`  ${proc.pid}  ${proc.command.slice(0, 120)}\n`);
  process.exit(1);
}

process.stdout.write(`\n✅ Stopped ${killed.length} process(es). Nothing left running.\n`);
