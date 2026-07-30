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
 *   npm run dev:stop              kill them
 *   npm run dev:stop -- --list    show what would be killed, kill nothing
 */
const { findDevProcesses, removePidFile, sweep } = require('./dev-processes');

const listOnly = process.argv.includes('--list') || process.argv.includes('--dry-run');

if (process.platform === 'win32') {
  process.stdout.write('dev:stop is a POSIX-only helper; on Windows use `taskkill /pid <pid> /T /F`.\n');
  process.exit(0);
}

const found = findDevProcesses();

if (found.length === 0) {
  process.stdout.write('No NodeGX dev processes are running.\n');
  removePidFile();
  process.exit(0);
}

process.stdout.write(`Found ${found.length} NodeGX dev process(es):\n`);

const { killed } = sweep({
  dryRun: listOnly,
  onLog: (line) => process.stdout.write(line + '\n')
});

if (listOnly) {
  process.stdout.write('\nNothing was killed (--list). Re-run without it to stop them.\n');
  process.exit(0);
}

removePidFile();

// Report against a fresh scan rather than against what we asked for: the useful
// answer is what is running now, not what we sent signals to.
const survivors = findDevProcesses();
if (survivors.length > 0) {
  process.stdout.write(`\n⚠️  ${survivors.length} process(es) survived SIGKILL:\n`);
  for (const proc of survivors) process.stdout.write(`  ${proc.pid}  ${proc.command.slice(0, 120)}\n`);
  process.exit(1);
}

process.stdout.write(`\n✅ Stopped ${killed.length} process(es). Nothing left running.\n`);
