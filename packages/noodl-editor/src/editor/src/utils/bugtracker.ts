/**
 * The on-disk diagnostic log.
 *
 * ## What this was
 *
 * This file has written `<userData>/debug/log-<date>.txt` in every packaged
 * build since the fork — `enabled = !Config.devMode`, and `devMode: true`
 * appears only in `config-dev.js`, so "released build" and "log is live" are
 * the same condition. It is the one piece of ALPHA-003 that already existed,
 * and the reason the task is *scoping and surfacing* rather than *adding*.
 *
 * It did four things wrong, all of them the same mistake:
 *
 * 1. It monkey-patched `console.log` and teed **every** call into the file.
 * 2. It attached up to 10,000 characters of `JSON.stringify(data, null, 2)`
 *    per entry. In this editor that is project graphs, directory listings and
 *    whatever a half-written debug statement happened to be holding.
 * 3. Nothing was redacted — absolute paths, URLs and anything credential-shaped
 *    went in verbatim.
 * 4. Nothing was bounded. One file per launch, forever, no size cap.
 *
 * None of it was ever disclosed in-app, and nobody was asked.
 *
 * ## What it is now
 *
 * Errors and warnings only, redacted through ALPHA-007's `report/redact` — the
 * same policy that guards a published issue body — timestamped, capped per
 * entry and capped per file. `debugLog.ts` owns the format and is pure so the
 * scoping is demonstrable; this file owns the file handle and nothing else.
 *
 * Retention across sessions is deliberately *not* here. The `debug/` directory
 * has a second writer — `src/main/src/merge-driver.js` dumps whole project
 * graphs into it when a Git merge fails — so a sweep that ran in the renderer
 * would only ever know about half of what it is bounding. It runs once per
 * launch in the main process instead: `src/main/src/debug-log.js`.
 *
 * @module utils/bugtracker
 */

// TODO: Replace all fs here
import fs from 'fs';
import os from 'os';
import { filesystem, platform } from '@noodl/platform';

import Config from '../../../shared/config/config';
import { DebugLogLevel, formatEntry, logFileHeader, logFileName } from './debugLog';
import { RedactorOptions } from './report/redact';

export interface IBugTracker {
  identify(email: string): void;
  track(error: string, data?: TSFixme): void;
  debug(info: string, data?: TSFixme): void;
}

let bugtracker: IBugTracker;

class EmptyBugTracker implements IBugTracker {
  identify(email: string): void {}
  track(error: string, data?: TSFixme): void {}
  debug(info: string, data?: TSFixme): void {}
}

/**
 * Per session. Two megabytes is about 10,000 error lines — far more than any
 * real session produces, and small enough that a user can open it, read it and
 * decide whether to attach it. Past the cap the file gets one final line saying
 * so, which is the honest alternative to silently dropping entries.
 */
const MAX_LOG_BYTES = 2 * 1024 * 1024;

let bytesWritten = 0;
let capped = false;
/** Guards a handler whose own failure would re-enter the console wrapper. */
let writing = false;
let fileStarted = false;

/**
 * The directories the redactor rewrites, resolved once and lazily.
 *
 * **No `projectDir`, on purpose.** `collect.ts` supplies one, but it reaches
 * `ProjectModel` to do it — and `projectmodel.editor.ts` imports *this* module,
 * so taking that dependency here would close an import cycle around the thing
 * that has to work while the app is already broken. It costs nothing that
 * matters: without the project rule, a project inside the home directory
 * collapses to `~/...` and a project outside it collapses to `<path>`. Both
 * drop the remainder, so no component or client name survives either way — the
 * project rule only buys a nicer label.
 */
let redactionPaths: RedactorOptions | null = null;
function paths(): RedactorOptions {
  if (redactionPaths) return redactionPaths;
  const read = <T>(fn: () => T): T | undefined => {
    try {
      return fn();
    } catch (_error) {
      return undefined;
    }
  };
  redactionPaths = {
    homeDir: read(() => os.homedir()),
    appDir: read(() => platform.getAppPath())
  };
  return redactionPaths;
}

function appendRaw(text: string): void {
  fs.appendFileSync(logFilePath, text);
  bytesWritten += Buffer.byteLength(text);
}

function write(level: DebugLogLevel, message: string, data?: TSFixme): void {
  if (writing || capped) return;
  writing = true;
  try {
    if (!fileStarted) {
      filesystem.makeDirectory(logFileDir);
      const version = (() => {
        try {
          return platform.getVersion();
        } catch (_error) {
          return 'unknown';
        }
      })();
      fs.writeFileSync(logFilePath, logFileHeader(version));
      bytesWritten = Buffer.byteLength(logFileHeader(version));
      fileStarted = true;
    }

    appendRaw(formatEntry({ level, message, data, paths: paths() }));

    if (bytesWritten >= MAX_LOG_BYTES) {
      capped = true;
      appendRaw(`# Log capped at ${MAX_LOG_BYTES} bytes. Later entries in this session were dropped.\n`);
    }
  } catch (_error) {
    // A logger that throws is worse than a missing log, and there is nowhere
    // safe to report this to — `console.error` is one of our own inputs.
  } finally {
    writing = false;
  }
}

class BugTracker implements IBugTracker {
  constructor() {
    if (typeof console !== 'undefined') {
      // `console.log` is deliberately **not** wrapped. It was the single
      // largest source of project content in the old file and it carried
      // almost no diagnostic value: by the time something has gone wrong the
      // interesting lines are the red ones.
      //
      // `errorTail.ts` (ALPHA-007) wraps these two as well, for its in-memory
      // five-minute ring. Two wrappers is correct rather than duplicated —
      // whichever installs second chains to the first, both see every call, and
      // they answer different questions: this one is a durable session record,
      // that one is "what was on screen just before the reporter clicked".
      // The one thing they share is the redactor, which is the part that is a
      // policy.
      const wrap = (level: DebugLogLevel, original: (...args: unknown[]) => void) =>
        function (this: unknown, ...args: unknown[]) {
          write(level, args.map((arg) => formatArgument(arg)).join(' '));
          original.apply(console, args);
        };

      console.error = wrap('error', console.error.bind(console));
      console.warn = wrap('warn', console.warn.bind(console));
    }

    if (typeof window !== 'undefined') {
      window.onerror = function (message, file, line, col, error) {
        const text = typeof message === 'string' ? message : String(message);
        bugtracker.track(text, {
          at: file ? `${file}:${line}:${col}` : undefined,
          stack: error && error.stack ? error.stack : undefined
        });
        return false;
      };
    }
  }

  identify(email: string) {
    // Never recorded. An email address in a diagnostic log is the one field
    // that turns "a file about a bug" into "a file about a person", and this
    // hook has had no implementation since the fork.
  }

  track(error: string, data?: TSFixme) {
    write('error', error, data);
  }

  debug(info: string, data?: TSFixme) {
    write('info', info, data);
  }
}

/** Local copy of `debugLog`'s argument renderer, to keep the import surface flat. */
function formatArgument(value: unknown): string {
  if (typeof value === 'string') return value;
  if (value instanceof Error) return value.stack || `${value.name}: ${value.message}`;
  try {
    return JSON.stringify(value);
  } catch (_error) {
    return String(value);
  }
}

export const logFileDir = filesystem.join(platform.getUserDataPath(), 'debug');
const logFilePath = filesystem.join(logFileDir, logFileName(new Date()));

const enabled = !Config.devMode;

// The directory is no longer created at import time. It used to be created on
// every launch including development ones, where the tracker is disabled and
// therefore never wrote anything into it — an empty `debug/` folder in the
// application-data directory that implied a log existed when none did.
bugtracker = enabled ? new BugTracker() : new EmptyBugTracker();

export { bugtracker };
