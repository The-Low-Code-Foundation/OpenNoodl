/**
 * ALPHA-003 §2 — retention, against a real directory.
 *
 * The bound has to hold for the directory as a whole, not for one writer's
 * files, because the largest things in `debug/` are written by a *different*
 * process (the Git merge driver) that never sees this code. So these tests
 * build the mixed directory that actually occurs and assert on what survives.
 */

const fs = require('fs');
const os = require('os');
const path = require('path');

const {
  DAY_MS,
  DEBUG_RETENTION,
  MAIN_ERROR_FILE,
  MAX_MAIN_ERROR_BYTES,
  README_NAME,
  debugDirectory,
  formatFatal,
  initialiseDebugDirectory,
  installMainProcessErrorLog,
  newestFile,
  pruneCrashDirectory,
  pruneDirectory,
  readmeText,
  redactHard,
  revealDirectory,
  setupDebugLogActions
} = require('../src/main/src/debug-log');

const NOW = Date.UTC(2026, 7, 6, 12, 0, 0);

let root;

beforeEach(() => {
  root = fs.mkdtempSync(path.join(os.tmpdir(), 'alpha003-'));
});

afterEach(() => {
  fs.rmSync(root, { recursive: true, force: true });
});

function write(dir, name, { ageDays = 0, size = 16 } = {}) {
  fs.mkdirSync(dir, { recursive: true });
  const full = path.join(dir, name);
  fs.writeFileSync(full, 'x'.repeat(size));
  const at = new Date(NOW - ageDays * DAY_MS);
  fs.utimesSync(full, at, at);
  return full;
}

function names(dir) {
  return fs.readdirSync(dir).sort();
}

/** An `app` with just the two methods this module uses. */
function fakeApp(paths) {
  return {
    getPath: (key) => {
      if (!(key in paths)) throw new Error('unknown path ' + key);
      return paths[key];
    }
  };
}

describe('pruneDirectory — age', () => {
  it('deletes what is older than the window and keeps what is not', () => {
    write(root, 'log-old.txt', { ageDays: 20 });
    write(root, 'log-edge.txt', { ageDays: 13 });
    write(root, 'log-new.txt', { ageDays: 0 });

    const result = pruneDirectory({ dir: root, retention: DEBUG_RETENTION, now: NOW });

    expect(result.deleted).toBe(1);
    expect(names(root)).toEqual(['log-edge.txt', 'log-new.txt']);
  });

  it('bounds the merge driver’s project dumps, which no renderer-side sweep could see', () => {
    write(root, 'git-ours-merge-project-old.json', { ageDays: 30, size: 5000 });
    write(root, 'git-theirs-merge-project-old.json', { ageDays: 30, size: 5000 });
    write(root, 'log-new.txt', { ageDays: 1 });

    pruneDirectory({ dir: root, retention: DEBUG_RETENTION, now: NOW });

    expect(names(root)).toEqual(['log-new.txt']);
  });
});

describe('pruneDirectory — count and size', () => {
  it('keeps the newest N and no more', () => {
    for (let i = 0; i < 50; i++) write(root, `log-${String(i).padStart(2, '0')}.txt`, { ageDays: i * 0.1 });

    pruneDirectory({ dir: root, retention: DEBUG_RETENTION, now: NOW });

    const kept = names(root);
    expect(kept.length).toBe(DEBUG_RETENTION.maxFiles);
    // Newest is index 0 (age 0); the oldest indices are the ones that went.
    expect(kept).toContain('log-00.txt');
    expect(kept).not.toContain('log-49.txt');
  });

  it('holds the total under the byte budget, oldest first', () => {
    const retention = { maxAgeMs: 999 * DAY_MS, maxFiles: 999, maxTotalBytes: 300 };
    write(root, 'a-newest.txt', { ageDays: 0, size: 200 });
    write(root, 'b-middle.txt', { ageDays: 1, size: 90 });
    write(root, 'c-oldest.txt', { ageDays: 2, size: 90 });

    const result = pruneDirectory({ dir: root, retention, now: NOW });

    expect(names(root)).toEqual(['a-newest.txt', 'b-middle.txt']);
    expect(result.keptBytes).toBe(290);
  });

  it('never deletes the log of the session that is running', () => {
    // One enormous stale file plus today's small one: the byte bound must not
    // reach the newest file just because an older one blew the budget.
    write(root, 'log-huge-stale.txt', { ageDays: 3, size: 4096 });
    const current = write(root, 'log-current.txt', { ageDays: 0, size: 32 });

    pruneDirectory({
      dir: root,
      retention: { maxAgeMs: 999 * DAY_MS, maxFiles: 999, maxTotalBytes: 1024 },
      now: NOW
    });

    expect(fs.existsSync(current)).toBe(true);
  });
});

describe('pruneDirectory — what it refuses to touch', () => {
  it('never deletes the README that explains the directory', () => {
    write(root, README_NAME, { ageDays: 400, size: 10 });
    write(root, 'log-old.txt', { ageDays: 400 });

    pruneDirectory({ dir: root, retention: DEBUG_RETENTION, now: NOW });

    expect(names(root)).toEqual([README_NAME]);
  });

  it('never deletes a directory, only files', () => {
    fs.mkdirSync(path.join(root, 'somefolder'), { recursive: true });
    write(root, 'log-old.txt', { ageDays: 400 });

    pruneDirectory({ dir: root, retention: DEBUG_RETENTION, now: NOW });

    expect(names(root)).toEqual(['somefolder']);
  });

  it('does not descend into subdirectories at depth 0', () => {
    write(path.join(root, 'nested'), 'log-old.txt', { ageDays: 400 });

    const result = pruneDirectory({ dir: root, retention: DEBUG_RETENTION, now: NOW });

    expect(result.scanned).toBe(0);
    expect(fs.existsSync(path.join(root, 'nested', 'log-old.txt'))).toBe(true);
  });

  it('returns an empty result for a directory that does not exist', () => {
    const result = pruneDirectory({ dir: path.join(root, 'missing'), retention: DEBUG_RETENTION, now: NOW });
    expect(result).toEqual({ scanned: 0, deleted: 0, deletedBytes: 0, keptBytes: 0, failed: 0 });
  });
});

describe('initialiseDebugDirectory', () => {
  it('creates the directory, which is what makes the merge driver’s dumps land at all', () => {
    const app = fakeApp({ userData: root });
    // merge-driver.js writes straight into <userData>/debug without mkdir and
    // swallows the failure, so before this the first failed merge wrote nothing.
    expect(fs.existsSync(debugDirectory(app))).toBe(false);

    initialiseDebugDirectory(app, NOW);

    expect(fs.existsSync(debugDirectory(app))).toBe(true);
  });

  it('writes a README that names both writers and their different risk', () => {
    const app = fakeApp({ userData: root });
    initialiseDebugDirectory(app, NOW);

    const text = fs.readFileSync(path.join(debugDirectory(app), README_NAME), 'utf8');
    expect(text).toContain('log-<date>.txt');
    expect(text).toContain('git-*-merge-*.json');
    // The merge dumps are the unredacted ones and the README must say so.
    expect(text).toContain('NOT redacted');
    expect(text).toContain('PRIVACY.md');
  });

  it('states the retention it actually enforces', () => {
    const text = readmeText(DEBUG_RETENTION);
    expect(text).toContain(`older than ${DEBUG_RETENTION.maxAgeMs / DAY_MS} days`);
    expect(text).toContain(`under ${DEBUG_RETENTION.maxFiles} files`);
    expect(text).toContain(`${DEBUG_RETENTION.maxTotalBytes / (1024 * 1024)} MB`);
  });

  it('sweeps on the way in', () => {
    const app = fakeApp({ userData: root });
    write(debugDirectory(app), 'log-ancient.txt', { ageDays: 90 });

    const result = initialiseDebugDirectory(app, NOW);

    expect(result.deleted).toBe(1);
    expect(names(debugDirectory(app))).toEqual([README_NAME]);
  });
});

describe('pruneCrashDirectory', () => {
  it('sweeps dumps one level down and leaves Electron’s own state alone', () => {
    const crash = path.join(root, 'crash');
    write(path.join(crash, 'completed'), 'a1b2.dmp', { ageDays: 60 });
    write(path.join(crash, 'completed'), 'fresh.dmp', { ageDays: 1 });
    write(crash, 'settings.dat', { ageDays: 400 });

    const result = pruneCrashDirectory(fakeApp({ crashDumps: crash }), NOW);

    expect(result.deleted).toBe(1);
    expect(names(path.join(crash, 'completed'))).toEqual(['fresh.dmp']);
    expect(names(crash)).toContain('settings.dat');
  });

  it('is a no-op when the platform has no crash directory', () => {
    const result = pruneCrashDirectory(fakeApp({}), NOW);
    expect(result.deleted).toBe(0);
  });
});

describe('redactHard — the strictly tighter floor', () => {
  it('drops every URL, including hosts the shared redactor would keep', () => {
    expect(redactHard('GET https://api.github.com/repos/a/b failed')).toBe('GET <url> failed');
    expect(redactHard('POST https://acme.example.com/x')).toBe('POST <url>');
  });

  it('drops every absolute path, including our own app directory', () => {
    expect(redactHard('at f (/Applications/NodeGX.app/Contents/Resources/app/main.js:1:2)')).not.toContain('NodeGX.app');
    expect(redactHard('ENOENT: /Users/rich/Clients/Acme Legal/project.json')).not.toContain('Acme');
    expect(redactHard('cannot read C:\\Users\\rich\\Projects\\thing')).not.toContain('rich');
  });

  it('keeps the part of a stack anyone actually reads', () => {
    const out = redactHard('TypeError: x is not a function\n    at startBackend (/a/b/c.js:12:3)');
    expect(out).toContain('TypeError: x is not a function');
    expect(out).toContain('startBackend');
  });

  it('removes any long opaque run, not only the shapes on a deny-list', () => {
    expect(redactHard('token=Zm9vYmFyYmF6cXV4MTIzNDU2Nzg5')).toContain('[redacted]');
    expect(redactHard('sk-ant-api03-AAAAAAAAAAAAAAAAAAAAAA')).toContain('[redacted]');
  });

  it('leaves ordinary prose alone', () => {
    expect(redactHard('Backend failed to start within the timeout')).toBe(
      'Backend failed to start within the timeout'
    );
  });

  it('removes email addresses', () => {
    expect(redactHard('user rich@digitalbricks.io not found')).toContain('[redacted-email]');
  });
});

describe('installMainProcessErrorLog', () => {
  let removeHandler;

  afterEach(() => {
    if (removeHandler) removeHandler();
    removeHandler = null;
  });

  function fire(dir, error) {
    const exits = [];
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    removeHandler = installMainProcessErrorLog({ dir, exit: (code) => exits.push(code) });
    process.emit('uncaughtException', error);
    spy.mockRestore();
    return exits;
  }

  it('writes the stack where a packaged build has no terminal to print it to', () => {
    const dir = path.join(root, 'debug');
    fire(dir, new Error('backend refused to start'));

    const text = fs.readFileSync(path.join(dir, MAIN_ERROR_FILE), 'utf8');
    expect(text).toContain('FATAL');
    expect(text).toContain('backend refused to start');
  });

  it('reproduces Node’s default rather than turning a crash into a zombie', () => {
    expect(fire(path.join(root, 'debug'), new Error('boom'))).toEqual([1]);
  });

  it('does not hook unhandledRejection, whose default is already fatal on Node 22', () => {
    const before = process.listenerCount('unhandledRejection');
    removeHandler = installMainProcessErrorLog({ dir: path.join(root, 'debug'), exit: () => {} });
    expect(process.listenerCount('unhandledRejection')).toBe(before);
  });

  it('starts the file again rather than growing it without bound', () => {
    const dir = path.join(root, 'debug');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, MAIN_ERROR_FILE), 'x'.repeat(MAX_MAIN_ERROR_BYTES + 1));

    fire(dir, new Error('boom'));

    expect(fs.statSync(path.join(dir, MAIN_ERROR_FILE)).size).toBeLessThan(4096);
  });

  it('never lets a failed write hide the crash', () => {
    // An unwritable directory: the handler must still print and exit.
    expect(fire(path.join(root, 'no', 'such', '\0bad'), new Error('boom'))).toEqual([1]);
  });

  it('stamps and redacts the record', () => {
    const rendered = formatFatal(new Error('open /Users/rich/Secret Client/x failed'), new Date(NOW));
    expect(rendered).toContain('2026-08-06T12:00:00.000Z');
    expect(rendered).not.toContain('Secret Client');
    expect(rendered.endsWith('\n')).toBe(true);
  });
});

describe('revealing it to a user', () => {
  it('selects the newest log rather than dropping them in a folder of dates', () => {
    write(root, README_NAME, { ageDays: 0 });
    write(root, 'log-old.txt', { ageDays: 2 });
    const newest = write(root, 'log-new.txt', { ageDays: 0.5 });

    expect(newestFile(root)).toBe(newest);
  });

  it('ignores the README when choosing what to select', () => {
    write(root, README_NAME, { ageDays: 0 });
    expect(newestFile(root)).toBe(null);
  });

  it('shows the item in its folder when there is one, and opens the folder when there is not', () => {
    const calls = [];
    const shell = {
      showItemInFolder: (p) => calls.push(['show', p]),
      openPath: (p) => calls.push(['open', p])
    };

    const empty = path.join(root, 'empty');
    revealDirectory({ shell, dir: empty });
    expect(calls).toEqual([['open', empty]]);

    const file = write(root, 'log-a.txt', {});
    revealDirectory({ shell, dir: root });
    expect(calls[1]).toEqual(['show', file]);
  });

  it('creates the folder before revealing it, so the menu item is never a no-op', () => {
    const shell = { showItemInFolder: () => {}, openPath: () => {} };
    const dir = path.join(root, 'not-yet');
    revealDirectory({ shell, dir });
    expect(fs.existsSync(dir)).toBe(true);
  });

  it('falls back to the debug folder when the platform has no crash directory', () => {
    const opened = [];
    const shell = { showItemInFolder: (p) => opened.push(p), openPath: (p) => opened.push(p) };
    const app = fakeApp({ userData: root });

    const actions = setupDebugLogActions({ app, shell });
    expect(actions.hasCrashFolder()).toBe(false);
    actions.openCrashFolder();

    expect(opened[0]).toBe(debugDirectory(app));
  });
});
