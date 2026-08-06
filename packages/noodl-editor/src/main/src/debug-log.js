/**
 * ALPHA-003 §2 and §3 — the diagnostic directories: bounding them, describing
 * them, and giving a user a way to reach them.
 *
 * ## Why this is in the main process
 *
 * `<userData>/debug/` has two writers, and neither can bound it alone:
 *
 * - `src/editor/src/utils/bugtracker.ts`, in the **renderer**, writes one
 *   `log-<date>.txt` per launch.
 * - `src/main/src/merge-driver.js`, in a **separate short-lived main process**
 *   spawned by Git, writes `git-{ancestors,ours,theirs}-merge-project-*.json`
 *   when a project merge fails. Those are whole project graphs — the single
 *   largest thing in the directory, and the writer that knows least about it:
 *   it does not even create the directory before writing, so on a first run the
 *   dumps went nowhere and the failure was swallowed.
 *
 * So the sweep runs once per launch, here, where it can see both. Creating the
 * directory at startup also fixes the merge driver's silent no-op.
 *
 * ## The retention policy, and why these numbers
 *
 * Three bounds, because any one of them alone has a failure mode:
 *
 * - **Age, 14 days.** A bug report refers to "yesterday" or "last week"; a
 *   fortnight covers every realistic report round-trip. Age alone does not
 *   bound size — a single bad session can write megabytes in an hour.
 * - **Count, 40 files.** Keeps the directory legible to a human who opens it,
 *   which is the entire point of the menu item below. Count alone does not
 *   bound size either.
 * - **Total size, 20MB.** The real bound. Twenty megabytes is roughly ten
 *   capped session logs, or two failed project merges of a large project, and
 *   is small enough that nobody notices it and large enough that a report from
 *   last Tuesday still has its evidence.
 *
 * Newest survives. A file is deleted when it fails *any* bound, and the
 * ordering means the sweep never deletes the log of the session that is
 * currently running.
 *
 * Crash dumps get age alone, at 30 days: they are rare, individually small, and
 * the one thing you want when a report finally arrives.
 *
 * **`reports/` is deliberately not swept.** An ALPHA-007 report folder exists
 * because a user clicked a button to make it; deleting their own evidence out
 * from under them is a different and worse failure than a large directory.
 *
 * @module main/debug-log
 */

const fs = require('fs');
const path = require('path');

const DAY_MS = 24 * 60 * 60 * 1000;

/** See the header. Exported so the tests assert the policy, not a repetition of it. */
const DEBUG_RETENTION = {
  maxAgeMs: 14 * DAY_MS,
  maxFiles: 40,
  maxTotalBytes: 20 * 1024 * 1024
};

const CRASH_RETENTION = {
  maxAgeMs: 30 * DAY_MS,
  maxFiles: 50,
  maxTotalBytes: 50 * 1024 * 1024
};

/** Never swept: it is this directory's own documentation, not its contents. */
const README_NAME = 'README.txt';

/** Main-process fatals, appended across sessions. See `installMainProcessErrorLog`. */
const MAIN_ERROR_FILE = 'main-errors.txt';
const MAX_MAIN_ERROR_BYTES = 256 * 1024;

/**
 * What the directory is, written where a user who opened it will read it.
 *
 * The first finding of ALPHA-003 was that this log had existed since the fork
 * and nobody had ever been told. A menu item fixes finding it. This fixes the
 * next question, which is "what is this and am I allowed to send it to
 * someone" — and answers it in the folder rather than in a policy document the
 * reader is not currently looking at.
 */
function readmeText(retention) {
  const days = Math.round(retention.maxAgeMs / DAY_MS);
  const megabytes = Math.round(retention.maxTotalBytes / (1024 * 1024));
  return [
    'NodeGX diagnostic logs',
    '======================',
    '',
    'What is in here',
    '',
    '  log-<date>.txt',
    '      One file per NodeGX session, in released builds only. It records',
    '      errors and warnings — not everything the editor printed. Paths,',
    '      URLs, credentials and email addresses are redacted as they are',
    '      written, so this file is intended to be safe to attach to a public',
    '      bug report. Read it first anyway; you are the one sharing it.',
    '',
    '  main-errors.txt',
    '      NodeGX itself failing, rather than something inside the editor.',
    '      Redacted harder than the session log: every file path and web',
    '      address is removed outright.',
    '',
    '  git-*-merge-*.json',
    '      Written only when a Git merge of a project fails. These are copies',
    '      of the conflicting versions of your project, so they DO contain your',
    '      project content and they are NOT redacted. Do not attach one to a',
    '      public issue unless you have read it.',
    '',
    'Where it goes',
    '',
    '  Nowhere. NodeGX transmits none of this. It stays on this machine until',
    '  you delete it or it ages out.',
    '',
    'How long it is kept',
    '',
    `  NodeGX deletes files here that are older than ${days} days, and keeps the`,
    `  directory under ${retention.maxFiles} files and ${megabytes} MB by deleting the oldest first.`,
    '  Deleting the whole directory is safe; it is recreated on next launch.',
    '',
    'See PRIVACY.md section 5, or Help > Privacy Policy in the app.',
    ''
  ].join('\n');
}

/**
 * Every regular file at or below `dir`, to `depth` levels of subdirectory.
 *
 * Depth exists for the crash directory, whose layout Electron owns
 * (`completed/`, `pending/`, `new/` depending on platform and version). The
 * debug directory is flat and takes depth 0.
 *
 * Never throws: a sweep that fails must not stop the app launching.
 */
function listFiles(dir, depth) {
  const out = [];
  let entries;
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true });
  } catch (_error) {
    return out;
  }

  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (depth > 0) out.push(...listFiles(full, depth - 1));
      continue;
    }
    if (!entry.isFile()) continue;
    try {
      const stat = fs.statSync(full);
      out.push({ path: full, name: entry.name, mtimeMs: stat.mtimeMs, size: stat.size });
    } catch (_error) {
      // Vanished between readdir and stat — a concurrent sweep, or the user.
    }
  }
  return out;
}

/**
 * Apply the three bounds. Returns what it did, so the caller can log one line
 * rather than the caller guessing.
 *
 * `protect` names files that are never candidates — the README, and (via the
 * caller) anything Electron owns in the crash directory such as `settings.dat`.
 */
function pruneDirectory(options) {
  const {
    dir,
    retention,
    now = Date.now(),
    depth = 0,
    protect = [README_NAME],
    match = () => true
  } = options || {};

  const result = { scanned: 0, deleted: 0, deletedBytes: 0, keptBytes: 0, failed: 0 };
  if (!dir) return result;

  const files = listFiles(dir, depth).filter((file) => protect.indexOf(file.name) === -1 && match(file));
  result.scanned = files.length;

  // Newest first, so the bounds below always spare the session that is running.
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);

  let runningBytes = 0;
  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    const tooOld = now - file.mtimeMs > retention.maxAgeMs;
    const tooMany = i >= retention.maxFiles;
    const tooBig = runningBytes + file.size > retention.maxTotalBytes;

    if (!tooOld && !tooMany && !tooBig) {
      runningBytes += file.size;
      continue;
    }

    try {
      fs.unlinkSync(file.path);
      result.deleted++;
      result.deletedBytes += file.size;
    } catch (_error) {
      result.failed++;
      runningBytes += file.size;
    }
  }

  result.keptBytes = runningBytes;
  return result;
}

/** The two directories, named in one place so the menu and the sweep agree. */
function debugDirectory(app) {
  return path.join(app.getPath('userData'), 'debug');
}

function crashDirectory(app) {
  try {
    return app.getPath('crashDumps');
  } catch (_error) {
    // Not every platform/version exposes it; the menu item degrades to the
    // debug folder rather than throwing at a user who clicked Help.
    return null;
  }
}

/**
 * Create the directory, write its README, and sweep it. Once per launch,
 * synchronously, before the window exists — it touches at most a few dozen
 * small files and a user who has just launched has nothing to be blocked from.
 */
function initialiseDebugDirectory(app, now = Date.now()) {
  const dir = debugDirectory(app);
  try {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, README_NAME), readmeText(DEBUG_RETENTION), 'utf8');
  } catch (_error) {
    // A read-only or full disk. The app still runs; the log simply will not.
  }
  return pruneDirectory({ dir, retention: DEBUG_RETENTION, now });
}

function pruneCrashDirectory(app, now = Date.now()) {
  const dir = crashDirectory(app);
  if (!dir) return { scanned: 0, deleted: 0, deletedBytes: 0, keptBytes: 0, failed: 0 };
  return pruneDirectory({
    dir,
    retention: CRASH_RETENTION,
    now,
    depth: 1,
    // Electron keeps its own state in this directory. Sweeping only the dumps
    // means a bound that cannot break the reporter it is bounding.
    match: (file) => /\.(dmp|meta|json)$/i.test(file.name)
  });
}

/**
 * ALPHA-003 criterion 2, main-process half — and the one place this task has to
 * write its own redaction rather than reuse ALPHA-007's.
 *
 * The reason is mechanical, not a disagreement: `report/redact.ts` is
 * TypeScript inside the renderer's webpack bundle. `main.js` is plain JavaScript
 * executed directly by Electron and can `require` neither. Sharing the module
 * would mean rewriting ALPHA-007's redactor as JS with a TS wrapper — a large
 * edit to another task's file, for one caller.
 *
 * So instead of a *second policy*, this is a **strictly tighter floor**. Every
 * rule below removes a superset of what the shared redactor removes in the same
 * category:
 *
 * | Category | `report/redact` | here |
 * |---|---|---|
 * | URLs | keeps a known host, drops the path | drops the whole URL, always |
 * | Paths under our app dir | kept as `<app>/…` | dropped |
 * | Paths under `~` | `~/...` | dropped |
 * | Any other path | `<path>` | `<path>` |
 * | Credentials | a named deny-list of shapes | any long opaque run |
 *
 * It therefore cannot leak something the shared redactor would have caught,
 * which is the property that matters and the one the tests assert. The cost is
 * that a main-process stack loses its `<app>` frame paths — function names and
 * line numbers survive, which is what anyone reads.
 *
 * If you widen anything here, widen it *downwards* — towards more redaction.
 */
function redactHard(text) {
  if (!text) return '';
  return (
    String(text)
      // Any long opaque run: keys, tokens, JWT segments, hashes. Anchored on a
      // word boundary and requiring a digit or a `-`/`_` so ordinary English
      // words and long identifiers survive.
      .replace(/\b(?=[A-Za-z0-9_-]*[0-9_-])[A-Za-z0-9_-]{20,}\b/g, '[redacted]')
      // Whole URLs, no host allow-list.
      .replace(/\b[a-z][a-z0-9+.-]*:\/\/[^\s"'<>)\]]+/gi, '<url>')
      // Absolute paths, POSIX and Windows, greedy across single spaces so a
      // directory called `Acme Legal` cannot leave ` Legal` behind as prose.
      .replace(/(?:[A-Za-z]:[\\/]|[\\/])[^\s"'<>,;:)\]}]+(?:[ \t][^\s"'<>,;:)\]}]+)*/g, '<path>')
      .replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g, '[redacted-email]')
  );
}

/** One fatal record, ready to append. */
function formatFatal(error, at = new Date()) {
  const name = (error && error.name) || 'Error';
  const message = (error && error.message) || String(error);
  const stack = error && error.stack ? String(error.stack) : '';
  const body = redactHard(stack || `${name}: ${message}`);
  return `${at.toISOString()}  FATAL  ${body.replace(/\n/g, '\n    ')}\n`;
}

/**
 * Record a main-process fatal, then die exactly as Node would have.
 *
 * Criterion 2 asks for "a main-process exception" to leave a record. In a
 * packaged build there is no terminal, so Node's default — print the stack to
 * stderr and exit 1 — leaves no record at all; the app simply vanishes.
 *
 * The handler therefore writes first and then **reproduces that default
 * precisely**. It deliberately does not keep the app alive: an uncaught
 * exception in the main process leaves state nobody can reason about, and a
 * crash reporter that converts crashes into zombies is worse than no handler.
 *
 * `unhandledRejection` is deliberately **not** hooked. On Node 22 (Electron 43)
 * the default is to rethrow, which arrives here as an uncaught exception —
 * adding a listener would suppress that and silently change the app's failure
 * mode, which is the opposite of this task.
 */
function installMainProcessErrorLog({ app, dir, exit } = {}) {
  const target = dir || (app ? debugDirectory(app) : null);
  if (!target) return () => {};

  const handler = (error) => {
    try {
      fs.mkdirSync(target, { recursive: true });
      const file = path.join(target, MAIN_ERROR_FILE);
      // One file across sessions rather than one per launch — a main-process
      // fatal is rare, and a directory of near-empty files is worse to read.
      // That means the retention sweep never ages it out (every write refreshes
      // its mtime), so it carries its own cap: past 256KB it starts again.
      let size = 0;
      try {
        size = fs.statSync(file).size;
      } catch (_statError) {
        /* not there yet */
      }
      const line = formatFatal(error);
      if (size > MAX_MAIN_ERROR_BYTES) fs.writeFileSync(file, line);
      else fs.appendFileSync(file, line);
    } catch (_writeError) {
      // Nowhere left to report to.
    }
    // Node's default, verbatim.
    console.error(error);
    (exit || process.exit.bind(process))(1);
  };

  process.on('uncaughtException', handler);
  return () => process.removeListener('uncaughtException', handler);
}

/**
 * The newest thing worth pointing at.
 *
 * `shell.showItemInFolder` wants a *file*: pointed at a directory, Windows
 * opens the parent and selects nothing. So the menu action reveals the newest
 * log — which also answers "which of these is mine" without the user reading
 * timestamps — and falls back to opening the directory when it is empty.
 */
function newestFile(dir) {
  const files = listFiles(dir, 0).filter((file) => file.name !== README_NAME);
  if (!files.length) return null;
  files.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return files[0].path;
}

/**
 * Reveal a directory in the OS file manager, selecting its newest file when
 * there is one. Returns the path acted on, for tests and for the caller's log.
 */
function revealDirectory({ shell, dir }) {
  if (!dir) return null;
  try {
    fs.mkdirSync(dir, { recursive: true });
  } catch (_error) {
    /* already there, or unwritable — try to open it either way */
  }

  const newest = newestFile(dir);
  if (newest) {
    shell.showItemInFolder(newest);
  } else {
    shell.openPath(dir);
  }
  return newest || dir;
}

/**
 * The Help-menu actions. Built here rather than inline in `main.js` so the
 * directory choice, the sweep and the reveal cannot disagree about where things
 * are.
 */
function setupDebugLogActions({ app, shell }) {
  return {
    openLogFolder: () => revealDirectory({ shell, dir: debugDirectory(app) }),
    openCrashFolder: () => revealDirectory({ shell, dir: crashDirectory(app) || debugDirectory(app) }),
    hasCrashFolder: () => Boolean(crashDirectory(app))
  };
}

module.exports = {
  DAY_MS,
  DEBUG_RETENTION,
  CRASH_RETENTION,
  README_NAME,
  MAIN_ERROR_FILE,
  MAX_MAIN_ERROR_BYTES,
  readmeText,
  listFiles,
  pruneDirectory,
  debugDirectory,
  crashDirectory,
  initialiseDebugDirectory,
  pruneCrashDirectory,
  redactHard,
  formatFatal,
  installMainProcessErrorLog,
  newestFile,
  revealDirectory,
  setupDebugLogActions
};
