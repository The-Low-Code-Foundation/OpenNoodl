/**
 * BST-004 — the machine probe behind the runtime choice.
 *
 * ⚠️ **This suite must control the environment it measures, because the ambient one lies twice.**
 *
 *  1. The developer machine this was written on has `node` on PATH, so every "no node" case has to
 *     be *posed* with a stub PATH rather than waited for.
 *  2. `ELECTRON_RUN_AS_NODE=1` is exported by VS Code's integrated terminal and by Claude Code's
 *     own host process, so anything reading it from the ambient environment reads a `1` that has
 *     nothing to do with the code under test.
 */

const {
  resolveNodeRuntime,
  resetNodeRuntimeCache
} = require('../../src/main/src/mcp/resolveNodeRuntime');

/** A GUI-launched macOS app's PATH: no Homebrew, no nvm, no /usr/local/bin. */
const FINDER_PATH = '/usr/bin:/bin:/usr/sbin:/sbin';

const ELECTRON = '/Applications/NodeGX.app/Contents/MacOS/NodeGX';

beforeEach(() => resetNodeRuntimeCache());

describe('when node is on this process’s PATH', () => {
  it('finds it without paying for a shell', () => {
    const result = resolveNodeRuntime({ execPath: ELECTRON });
    expect(result.hasNode).toBe(true);
    expect(result.detection).toBe('path');
    // The fast probe is the only one that ran, so nothing else is in the report.
    expect(result.probed).toHaveLength(1);
  });

  it('reports the app binary as the fallback runtime, always', () => {
    // Electron *is* a Node runtime and every install has one by definition — so unlike `entry`,
    // this is never null and never needs a "not found" state.
    expect(resolveNodeRuntime({ execPath: ELECTRON }).electron).toBe(ELECTRON);
  });
});

describe('when nothing can find node', () => {
  // Both probes miss: a stub PATH, and a shell that cannot exist.
  const nowhere = {
    env: { PATH: FINDER_PATH, SHELL: '/nonexistent/shell' },
    execPath: ELECTRON,
    platform: 'darwin'
  };

  it('says so rather than guessing', () => {
    const result = resolveNodeRuntime(nowhere);
    expect(result.hasNode).toBe(false);
    expect(result.nodePath).toBeNull();
    expect(result.detection).toBe('none');
  });

  it('reports everywhere it looked — when it misses, that list is the bug report', () => {
    const result = resolveNodeRuntime(nowhere);
    expect(result.probed.length).toBeGreaterThan(1);
    expect(result.probed.join(' ')).toContain('/nonexistent/shell');
  });

  it('still offers the Electron runtime, which is the entire point', () => {
    expect(resolveNodeRuntime(nowhere).electron).toBe(ELECTRON);
  });
});

describe('the login-shell fallback', () => {
  /**
   * A stand-in for the user's login shell that answers the way a real one with nvm would.
   *
   * ⚠️ Posed rather than borrowed: asserting against the *real* `$SHELL` would make this suite
   * pass or fail on whether whoever runs it happens to use nvm, which is not what is under test.
   */
  function fakeLoginShell(output: string): string {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'bst004-'));
    const shell = path.join(dir, 'fake-shell');
    fs.writeFileSync(shell, `#!/bin/sh\n${output}\n`, { mode: 0o755 });
    return shell;
  }

  it('finds a node that only an rc file puts on PATH', () => {
    // ⚠️ The case that matters most and that a naive probe gets backwards: nvm installs node to
    // ~/.nvm/versions/node/<v>/bin and adds it from `.zshrc`, so a Finder-launched app sees ENOENT
    // while the user's own terminal — the one they will paste this command into — has it.
    const result = resolveNodeRuntime({
      env: {
        PATH: FINDER_PATH,
        SHELL: fakeLoginShell('echo /Users/me/.nvm/versions/node/v22.22.0/bin/node')
      },
      execPath: ELECTRON,
      platform: 'darwin'
    });
    expect(result.hasNode).toBe(true);
    expect(result.detection).toBe('login-shell');
    expect(result.nodePath).toBe('/Users/me/.nvm/versions/node/v22.22.0/bin/node');
  });

  it('ignores rc-file chatter printed before the answer', () => {
    // An interactive shell reads .zshrc, and plenty of them print a banner. The path is the last
    // line, not the first — reading the first would hand back a greeting as a runtime.
    const result = resolveNodeRuntime({
      env: {
        PATH: FINDER_PATH,
        SHELL: fakeLoginShell('echo "Welcome to zsh!"\necho /opt/homebrew/bin/node')
      },
      execPath: ELECTRON,
      platform: 'darwin'
    });
    expect(result.nodePath).toBe('/opt/homebrew/bin/node');
  });

  it('treats a shell that answers with something that is not a path as a miss', () => {
    // `command -v` prints nothing and exits non-zero when it finds nothing, but a shell that
    // prints only a banner would otherwise hand back the banner.
    const result = resolveNodeRuntime({
      env: { PATH: FINDER_PATH, SHELL: fakeLoginShell('echo "no node here"') },
      execPath: ELECTRON,
      platform: 'darwin'
    });
    expect(result.hasNode).toBe(false);
    expect(result.detection).toBe('none');
  });

  it('runs at most once, however many times it is asked', () => {
    // ⚠️ It costs ~2.3s and sits behind a synchronous IPC handler. A cached *miss* has to be
    // distinguishable from a cold cache, or the slow probe runs on every call and the settings
    // panel freezes repeatedly on exactly the machines this task is written for.
    const shell = fakeLoginShell('echo /opt/homebrew/bin/node');
    const env = { PATH: FINDER_PATH, SHELL: shell };
    const first = resolveNodeRuntime({ env, execPath: ELECTRON, platform: 'darwin' });

    require('fs').writeFileSync(shell, '#!/bin/sh\nexit 1\n', { mode: 0o755 });
    const second = resolveNodeRuntime({ env, execPath: ELECTRON, platform: 'darwin' });

    expect(first.nodePath).toBe('/opt/homebrew/bin/node');
    expect(second.nodePath).toBe('/opt/homebrew/bin/node');
  });

  it('is skipped entirely when asked, so a caller can stay fast', () => {
    const result = resolveNodeRuntime({
      env: { PATH: FINDER_PATH, SHELL: '/bin/sh' },
      execPath: ELECTRON,
      platform: 'darwin',
      skipLoginShell: true
    });
    expect(result.detection).toBe('none');
    expect(result.probed).toHaveLength(1);
  });

  it('is not attempted on Windows, which has no login shell and needs none', () => {
    // A GUI process on Windows inherits the user's real PATH, so the fast probe is already right.
    const result = resolveNodeRuntime({
      env: { PATH: 'C:\\Windows\\system32' },
      execPath: 'C:\\Program Files\\NodeGX\\NodeGX.exe',
      platform: 'win32'
    });
    expect(result.probed).toHaveLength(1);
  });
});
