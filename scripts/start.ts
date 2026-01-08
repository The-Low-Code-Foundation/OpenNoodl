import { exec, ChildProcess, execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

import { ConsoleColor, attachStdio } from './utils/process';

// Track all spawned processes for cleanup
const childProcesses: ChildProcess[] = [];

/**
 * Kills a process and all its children (the entire process tree).
 * This is crucial for webpack/node processes that spawn child processes.
 */
function killProcessTree(proc: ChildProcess): void {
  if (!proc.pid) return;

  try {
    if (process.platform === 'win32') {
      // Windows: use taskkill with /T flag to kill tree
      execSync(`taskkill /pid ${proc.pid} /T /F`, { stdio: 'ignore' });
    } else {
      // macOS/Linux: kill the entire process group
      // Try to kill the process group (negative PID)
      try {
        process.kill(-proc.pid, 'SIGTERM');
      } catch {
        // If process group kill fails, try direct kill
        proc.kill('SIGTERM');
      }
    }
  } catch (error) {
    // Process might already be dead - that's okay
  }
}

/**
 * Cleanup function that kills all child processes
 */
function cleanup(): void {
  console.log('\n🧹 Cleaning up child processes...');

  for (const proc of childProcesses) {
    killProcessTree(proc);
  }

  // Also kill any lingering webpack processes from this session
  try {
    if (process.platform !== 'win32') {
      // Kill any webpack processes that might be orphaned
      execSync('pkill -f "webpack.*noodl" 2>/dev/null || true', { stdio: 'ignore' });
    }
  } catch {
    // Ignore errors - processes might not exist
  }

  console.log('✅ Cleanup complete');
}

const CWD = path.join(__dirname, '..');
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
const processOptions = {
  cwd: CWD,
  env: {
    ...process.env,
    LOCAL_GIT_DIRECTORY,
    LOCAL_GIT_TRAMPOLINE_DIRECTORY
  }
};

const argBuildViewers = process.argv.includes('--build-viewer');
const viewerScript = argBuildViewers ? 'build' : 'start';

const viewerProcess = attachStdio(
  exec(`npx lerna exec --scope @noodl/noodl-viewer-react -- npm run ${viewerScript}`, processOptions),
  {
    prefix: 'Viewer',
    color: ConsoleColor.FgMagenta
  }
);
childProcesses.push(viewerProcess);

const cloudRuntimeProcess = attachStdio(
  exec(`npx lerna exec --scope @noodl/cloud-runtime -- npm run ${viewerScript}`, processOptions),
  {
    prefix: 'Cloud',
    color: ConsoleColor.FgMagenta
  }
);
childProcesses.push(cloudRuntimeProcess);

const editorProcess = attachStdio(exec('npx lerna exec --scope noodl-editor -- npm run start', processOptions), {
  prefix: 'Editor',
  color: ConsoleColor.FgCyan
});
childProcesses.push(editorProcess);

// Handle editor exit - cleanup and exit
editorProcess.on('exit', (code) => {
  if (typeof code === 'number') {
    cleanup();
    process.exit(0);
  }
});

// Handle Ctrl+C (SIGINT) - cleanup all processes
process.on('SIGINT', () => {
  console.log('\n\n⚠️  Received SIGINT (Ctrl+C)');
  cleanup();
  process.exit(0);
});

// Handle SIGTERM - cleanup all processes
process.on('SIGTERM', () => {
  console.log('\n\n⚠️  Received SIGTERM');
  cleanup();
  process.exit(0);
});

// Handle uncaught exceptions - still try to cleanup
process.on('uncaughtException', (err) => {
  console.error('\n\n❌ Uncaught exception:', err);
  cleanup();
  process.exit(1);
});
