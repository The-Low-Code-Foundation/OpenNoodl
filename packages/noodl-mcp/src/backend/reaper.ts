/**
 * AAQ-011/F13 — the reaper: kill backends no live owner claims.
 *
 * Richard's constraint on F10, which F13 inherits in a harder form:
 *
 * > *"for the love of Mike please make sure that all 'stop' cases are covered,
 * > like the editor crashes, the user's computer goes on fire, etc so that
 * > there's no chance we leave orphaned backends running that fuck up other
 * > projects or fry the user's CPU"*
 *
 * ## What this covers that the existing guard does not
 *
 * `nodegx-backend --parent-pid` already makes a backend die with its supervisor
 * (`packages/nodegx-backend/src/cli.ts:350`), and we pass it. This is the
 * backstop for the three cases that guard cannot reach:
 *
 * - **A recycled owner pid.** The guard is a bare `process.kill(pid, 0)`; once
 *   the OS hands the dead owner's pid to something else it reports "alive"
 *   forever. The heartbeat in the record is what makes that case visible here.
 * - **A backend that outlived its guard** — SIGSTOPped, wedged, or spawned by an
 *   older build that predates `--parent-pid`.
 * - **A stale record** left by a `SIGKILL`ed owner. Harmless, but it must be
 *   cleaned or the port allocator keeps stepping around a port nobody holds.
 *
 * ## The two rules that keep it from killing the wrong thing
 *
 * 1. **Never signal a bare pid.** The command line must name the backend id
 *    ({@link verifyIsOurBackend}). A pid we cannot verify is left alone and
 *    reported, never killed.
 * 2. **Never touch a live owner's backend**, whichever spawner owns it. The
 *    editor is the other spawner; a running editor's backends are its business,
 *    and this sweep is deliberately owner-kind-agnostic in *both* directions —
 *    it will not kill a live editor's backend, and it will reap a dead one's.
 *
 * Nothing here throws. A reaper that fails a startup is worse than one that
 * misses a process, so every outcome is a row in the report.
 *
 * @module noodl-mcp/backend/reaper
 */

import { backendsRoot } from './client';
import {
  deleteRuntimeRecord,
  heartbeatIsFresh,
  listRuntimeRecords,
  processCommandLine,
  processIsAlive,
  verifyIsOurBackend
} from './runtimeRecord';

/** How long a SIGTERMed backend gets to drain before SIGKILL. */
export const STOP_GRACE_MS = 3000;
const POLL_MS = 100;

export type ReapOutcome =
  /** A live owner is responsible for it. Untouched. */
  | 'owner-alive'
  /** Our own record, and we are the live owner. Untouched. */
  | 'self'
  /** The owner is gone and so is the process. Record removed. */
  | 'already-gone'
  /** The owner is gone, the process was proven ours, and it was killed. */
  | 'reaped'
  /** The owner is gone but the pid belongs to something else now. Record removed, nothing signalled. */
  | 'stale-record'
  /** The owner is gone and the pid could not be verified. **Nothing signalled, record kept.** */
  | 'unverifiable';

export interface ReapRow {
  backendId: string;
  backendName: string;
  pid: number;
  port: number;
  ownerKind: string;
  ownerPid: number;
  outcome: ReapOutcome;
  detail?: string;
}

export interface ReapOptions {
  root?: string;
  /** The pid that counts as "me" — records owned by it are never reaped. */
  selfPid?: number;
  now?: number;
  /** Test seam: the command line of a pid. */
  commandLineOf?: (pid: number) => string | null;
  /** Test seam: is this pid alive? */
  isAlive?: (pid: number) => boolean;
  /** Test seam: send a signal. */
  kill?: (pid: number, signal: NodeJS.Signals) => void;
}

function defaultKill(pid: number, signal: NodeJS.Signals): void {
  process.kill(pid, signal);
}

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * SIGTERM, poll, then SIGKILL. Returns the signal that finished it, or
 * `'escaped'` when the process is somehow still there afterwards — which is
 * reported rather than swallowed, because a backend that survives SIGKILL is a
 * thing a human needs to know about.
 */
async function terminate(
  pid: number,
  isAlive: (pid: number) => boolean,
  kill: (pid: number, signal: NodeJS.Signals) => void
): Promise<string> {
  try {
    kill(pid, 'SIGTERM');
  } catch {
    return 'SIGTERM (already gone)';
  }
  const deadline = Date.now() + STOP_GRACE_MS;
  while (Date.now() < deadline) {
    if (!isAlive(pid)) return 'SIGTERM';
    await sleep(POLL_MS);
  }
  try {
    kill(pid, 'SIGKILL');
  } catch {
    return 'SIGKILL (already gone)';
  }
  await sleep(POLL_MS);
  return isAlive(pid) ? 'escaped' : 'SIGKILL';
}

/**
 * Sweep every runtime record under `root` and reap the orphans.
 *
 * Called at `noodl-mcp` startup (`cli.ts`) and again immediately before any
 * provision — the moment we are about to add one more process is exactly when
 * the machine should not already be carrying a dead session's.
 */
export async function reapOrphanedBackends(options: ReapOptions = {}): Promise<ReapRow[]> {
  const root = options.root ?? backendsRoot();
  const selfPid = options.selfPid ?? process.pid;
  const now = options.now ?? Date.now();
  const isAlive = options.isAlive ?? processIsAlive;
  const commandLineOf = options.commandLineOf ?? processCommandLine;
  const kill = options.kill ?? defaultKill;

  const rows: ReapRow[] = [];
  for (const record of listRuntimeRecords(root)) {
    const row = (outcome: ReapOutcome, detail?: string): ReapRow => ({
      backendId: record.backendId,
      backendName: record.backendName,
      pid: record.pid,
      port: record.port,
      ownerKind: record.owner?.kind ?? 'unknown',
      ownerPid: record.owner?.pid ?? 0,
      outcome,
      ...(detail ? { detail } : {})
    });

    if (record.owner?.pid === selfPid) {
      rows.push(row('self'));
      continue;
    }
    if (isAlive(record.owner?.pid ?? 0) && heartbeatIsFresh(record, now)) {
      rows.push(row('owner-alive'));
      continue;
    }
    if (!isAlive(record.pid)) {
      deleteRuntimeRecord(record.backendId, root);
      rows.push(row('already-gone'));
      continue;
    }

    const verdict = verifyIsOurBackend(record, commandLineOf(record.pid));
    if (verdict === 'not-ours') {
      // The pid was recycled onto an unrelated process. Dropping the record is
      // the whole action: signalling it would be the exact accident this
      // module exists to avoid.
      deleteRuntimeRecord(record.backendId, root);
      rows.push(row('stale-record', `pid ${record.pid} is no longer our backend — record dropped, nothing signalled`));
      continue;
    }
    if (verdict === 'unverifiable') {
      rows.push(
        row(
          'unverifiable',
          `could not read the command line of pid ${record.pid}; left running and left recorded rather than ` +
            'signalling a pid we cannot prove is ours'
        )
      );
      continue;
    }

    const how = await terminate(record.pid, isAlive, kill);
    deleteRuntimeRecord(record.backendId, root);
    rows.push(
      row(
        'reaped',
        `owner (${record.owner?.kind} pid ${record.owner?.pid}) is gone; stopped with ${how}`
      )
    );
  }
  return rows;
}
