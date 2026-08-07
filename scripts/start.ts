import { spawn, ChildProcess, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { ConsoleColor, attachStdio } from './utils/process';

// Finding and killing dev processes is shared with the watchdog and with
// `npm run dev:stop`, so it lives in one module rather than three copies.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const devProcesses = require('./devtools/dev-processes');
const { killGroup, removePidFile, sweep, writePidFile: writePids } = devProcesses;

// Track all spawned processes for cleanup
const childProcesses: ChildProcess[] = [];

const CWD = path.join(__dirname, '..');

/**
 * Kills a spawned child and its entire process tree.
 */
function killProcessTree(proc: ChildProcess): void {
  if (!proc.pid) return;

  if (process.platform === 'win32') {
    try {
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } catch {
      // Process might already be dead - that's okay
    }
    return;
  }

  killGroup(proc.pid, 'SIGTERM');
}

/**
 * Kill anything a previous run left behind before starting more.
 *
 * The sweep no longer trusts the pid file alone. A pid file is only written once
 * the children exist, so a session killed during startup leaves orphans it never
 * recorded; and a session whose `node_modules/.cache` was wiped (`npm run
 * clean:cache`) loses the record entirely while the processes keep running. The
 * shared sweep finds them from the live process table instead, and uses the pid
 * file only as an extra source of process groups.
 */
function reapPreviousSession(): void {
  if (process.platform === 'win32') return;

  const { killed } = sweep({ onLog: (line: string) => console.log(`> ${line}`) });
  if (killed.length > 0) {
    console.log(`> Reaped ${killed.length} orphaned dev process(es) from a previous session`);
  }
  removePidFile();
}

/**
 * Starts the process that cleans up when *this* one dies without warning.
 *
 * Every handler below is useless against SIGKILL, and the children are detached
 * precisely so they survive their parent — which means an unhandleable death
 * leaks the whole stack until someone notices the fans. The watchdog is a
 * detached poller that closes that hole; see dev-watchdog.js.
 */
function startWatchdog(): ChildProcess | null {
  if (process.platform === 'win32') return null;

  // dev-debug.js passes its own pid down: if it is killed, its stdout pipe dies
  // under us and the stack is broken even though this process may linger.
  const launchers = [process.pid];
  const parentLauncher = Number(process.env.NOODL_DEV_LAUNCHER_PID);
  if (parentLauncher) launchers.push(parentLauncher);

  try {
    const script = path.join(__dirname, 'devtools', 'dev-watchdog.js');
    const watchdog = spawn(process.execPath, [script, ...launchers.map(String)], {
      cwd: CWD,
      detached: true,
      stdio: 'ignore'
    });
    // Unref so a clean shutdown is never held open waiting for the watchdog.
    watchdog.unref();
    return watchdog;
  } catch (err) {
    console.warn('> Could not start the dev watchdog; orphaned processes will only be reaped on the next run.', err);
    return null;
  }
}

function writePidFile(watchdogPid?: number): void {
  const pgids = childProcesses.map((p) => p.pid).filter((pid): pid is number => typeof pid === 'number');
  writePids({ groups: pgids, launchers: [process.pid], watchdog: watchdogPid ?? null });
}

let cleaningUp = false;

/**
 * Cleanup function that kills all child processes
 */
function cleanup(): void {
  if (cleaningUp) return;
  cleaningUp = true;

  console.log('\n🧹 Cleaning up child processes...');

  for (const proc of childProcesses) {
    killProcessTree(proc);
  }

  // Escalate to SIGKILL for anything that ignored SIGTERM, then remove the
  // pidfile (nothing left to reap) and exit.
  setTimeout(() => {
    for (const proc of childProcesses) {
      if (proc.pid) killGroup(proc.pid, 'SIGKILL');
    }
    removePidFile();
    console.log('✅ Cleanup complete');
    process.exit(0);
  }, 1500).unref();
}
const LOCAL_GIT_DIRECTORY = path.join(__dirname, '..', 'node_modules', 'dugite', 'git');
const LOCAL_GIT_TRAMPOLINE_DIRECTORY = path.join(
  __dirname,
  '..',
  'node_modules',
  'desktop-trampoline/build/Release/desktop-trampoline'
);

// Print variables for easy debugging
console.log('---');
console.log(`> CWD: `, CWD);
console.log(`> LOCAL_GIT_DIRECTORY: `, LOCAL_GIT_DIRECTORY);
console.log(`> LOCAL_GIT_TRAMPOLINE_DIRECTORY: `, LOCAL_GIT_TRAMPOLINE_DIRECTORY);
console.log('---');

// Verify git path
switch (process.platform) {
  case 'win32': {
    const gitExist = fs.existsSync(path.join(LOCAL_GIT_DIRECTORY, 'mingw64/bin', 'git.exe'));
    if (gitExist) {
      console.log('> Found git.exe');
    } else {
      throw new Error("'git.exe' is missing, this can be caused by node_modules issues.");
    }
    break;
  }

  case 'darwin': {
    const gitExist = fs.existsSync(path.join(LOCAL_GIT_DIRECTORY, 'bin', 'git'));
    if (gitExist) {
      console.log('> Found git executable');
    } else {
      throw new Error("'git' is missing, this can be caused by node_modules issues.");
    }
    break;
  }
}

console.log('---');

// Start processes
const childEnv: NodeJS.ProcessEnv = {
  ...process.env,
  LOCAL_GIT_DIRECTORY,
  LOCAL_GIT_TRAMPOLINE_DIRECTORY
};

// Electron boots as a plain Node process when this is set — VS Code sets it in
// integrated terminals and in the extension host — so `electron.app` is
// undefined and the editor dies before opening a window. Same failure mode the
// test harness hit (REV-002).
delete childEnv.ELECTRON_RUN_AS_NODE;

const processOptions = {
  cwd: CWD,
  env: childEnv,
  // `shell: true` runs the command line through /bin/sh (like the old exec), and
  // `detached: true` makes that shell a process-group leader so cleanup() can kill
  // the whole subtree (sh → npx → lerna → npm → webpack-dev-server) via the
  // negative-pid form. NOTE: `exec` silently ignores `detached` — the child stays
  // in this process's own group and the group-kill ESRCHes — which is exactly why
  // the webpack grandchildren used to survive. `spawn` honours it.
  shell: true,
  detached: true
};

// The dev flow only ever watched the renderer, so src/main/main.bundle.js — the
// actual Electron entry point — kept whatever a production build last left behind.
// Main-process edits did nothing in dev until someone ran a full build. Rebuild it
// up front so `npm run dev` always runs the current main process.
console.log('> Building the Electron main process...');
execSync('npx lerna exec --scope noodl-editor -- npm run build:main:dev', {
  cwd: CWD,
  stdio: 'inherit',
  env: childEnv
});
console.log('---');

// Kill anything a previously-crashed session left running before we add more.
reapPreviousSession();

const argBuildViewers = process.argv.includes('--build-viewer');
const viewerScript = argBuildViewers ? 'build' : 'start';

const viewerProcess = attachStdio(
  spawn(`npx lerna exec --scope @noodl/noodl-viewer-react -- npm run ${viewerScript}`, processOptions),
  {
    prefix: 'Viewer',
    color: ConsoleColor.FgMagenta
  }
);
childProcesses.push(viewerProcess);

const cloudRuntimeProcess = attachStdio(
  spawn(`npx lerna exec --scope @noodl/cloud-runtime -- npm run ${viewerScript}`, processOptions),
  {
    prefix: 'Cloud',
    color: ConsoleColor.FgMagenta
  }
);
childProcesses.push(cloudRuntimeProcess);

const editorProcess = attachStdio(spawn('npx lerna exec --scope noodl-editor -- npm run start', processOptions), {
  prefix: 'Editor',
  color: ConsoleColor.FgCyan
});
childProcesses.push(editorProcess);

// Persist the group ids so the next run can reap them if we die uncleanly, and
// start the watchdog that reaps them *immediately* rather than next run.
const watchdogProcess = startWatchdog();
writePidFile(watchdogProcess?.pid);

// cleanup() sends SIGTERM, then escalates to SIGKILL and exits on a short timer,
// so these handlers must NOT call process.exit() themselves — that would cut the
// escalation off and let stubborn children survive.

// Handle editor exit - cleanup and exit
editorProcess.on('exit', (code) => {
  if (typeof code === 'number') {
    cleanup();
  }
});

// Handle Ctrl+C (SIGINT) - cleanup all processes
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received SIGINT (Ctrl+C)');
  cleanup();
});

// Handle SIGTERM - cleanup all processes
process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Received SIGTERM');
  cleanup();
});

// Handle SIGHUP - the terminal (or VS Code integrated terminal) was closed.
// This was a common way to leak orphans: no handler fired at all.
process.on('SIGHUP', () => {
  console.log('\n\n⚠️  Received SIGHUP (terminal closed)');
  cleanup();
});

// Handle uncaught exceptions - still try to cleanup
process.on('uncaughtException', (err) => {
  console.error('\n\n❌ Uncaught exception:', err);
  cleanup();
});

// Last-resort synchronous sweep. Runs on any exit path (including ones the async
// cleanup timer can't survive) so no child group is ever left behind.
process.on('exit', () => {
  for (const proc of childProcesses) {
    if (proc.pid) {
      try {
        process.kill(-proc.pid, 'SIGKILL');
      } catch {
        // Already gone.
      }
    }
  }
});
