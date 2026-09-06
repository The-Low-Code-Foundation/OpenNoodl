#!/usr/bin/env node
/**
 * Kill the render-harness children a killed drive left behind.
 *
 * 🔴 **Why a script and not just the in-drive reaper.** `withRenderedPage` reaps
 * before it spawns, which makes the harness self-healing — but only for someone
 * who runs another drive. A session that ends after a killed suite leaves its
 * orphans holding memory until the next one, and on 2026-09-02 that was two
 * headless Chromes and a server (~520MB) starving the suites that were being
 * blamed for failing. This is the same reaper, callable at teardown.
 *
 * One implementation, two entry points: it delegates to
 * `render-report.js`'s `reapOrphanedRenderProcesses` rather than re-deriving the
 * match, because a second copy of a rule like "only `PPID === 1`" is the copy
 * that goes stale — and that rule is the difference between a reaper and a
 * saboteur (it is what stops this killing a CONCURRENT session's drive).
 *
 * Prints nothing when there is nothing to reap, so it is quiet in a hook.
 *
 *   node scripts/devtools/reap-render-orphans.js
 */
'use strict';

try {
  const reaped = require('./render-report.js').reapOrphanedRenderProcesses();
  // The reaper already logs what it killed; say nothing when it killed nothing.
  process.exit(Array.isArray(reaped) ? 0 : 0);
} catch (e) {
  // Never fail a teardown over cleanup: a hook that exits non-zero is noise at
  // the exact moment nobody is watching.
  console.error(`[reap] skipped: ${e && e.message ? e.message : e}`);
  process.exit(0);
}
