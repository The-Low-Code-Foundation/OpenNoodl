/**
 * TUT-002 AC3 — the sidecar half of the database snapshot: `BackendClient`, and nothing else.
 *
 * 🔴 **The same two routes as the editor, on purpose.** `GET /admin/schema` and
 * `GET /api/{collection}?limit=1&count=1`, narrowed by the same code in `lessondatabase.ts`,
 * producing the same `LessonDatabaseSnapshot` shape the same synchronous evaluator grades. The
 * arc's claim is one evaluator, never forked; this is the file that keeps it true on the data
 * side, and it is deliberately thin — a transport and a resolver, no decisions.
 *
 * WHY A HARNESS WOULD WANT ONE AT ALL
 * -----------------------------------
 * It normally does not, and that is the important half. A lesson bundle on disk does not contain
 * the learner's database, so the three collection verbs are reported as **not checkable** and
 * F1's collection-reachability check covers them instead. Replaying them against a context with
 * no snapshot would read the evaluator's (correct) `false` and report the author's own solution
 * as dead-on-solution — a *manufactured* failure, the one output a gate must never produce.
 *
 * So this is opt-in: an author who has a backend with the lesson's collections in it can name it
 * and have the data conditions replayed for real. What that answers is the question F1 cannot —
 * not "does the bundle mention `Puppies`" but "is there a `Puppies`, with those columns".
 *
 * @module noodl-mcp/lessons/lessonDatabase
 */

import path from 'node:path';

import { BackendClient, backendsRoot, listBackends } from '../backend/client';
import { installExitHooks, readBackendConfig, startBackend } from '../backend/provision';
import { readLessonDatabaseSnapshot } from '../editor-deps';
import type { LessonDatabaseReader, LessonDatabaseSnapshot } from '../editor-deps';
import { ToolError } from '../errors';

/**
 * The two reads, over HTTP.
 *
 * ⚠️ `limit=1`, matching the editor's transport exactly. The editor cannot ask for zero rows —
 * `BackendManager.queryRecords` reads `options.limit || 50` — so asking for zero here would mean
 * the two fillers were asking different questions of the same route, which is the sort of
 * difference that is invisible until a spec grades one manifest through both.
 *
 * 🔴 The count is passed through **unmapped**. `/api/{table}` answers `{ results, count }`, and a
 * response with no numeric `count` must leave `rowCount` absent rather than zero — see
 * `rowCountFromQueryResponse`, which is where that decision lives for both callers.
 */
export function backendLessonReader(client: BackendClient): LessonDatabaseReader {
  return {
    readSchema: async () => (await client.request('GET', '/admin/schema')).json,
    readRowCount: async (collection: string) =>
      (await client.request('GET', `/api/${encodeURIComponent(collection)}?limit=1&count=1`)).json
  };
}

/**
 * Read a snapshot from a named backend, starting it if it is configured and not running.
 *
 * Never throws for a backend that is merely down or missing: the caller is a verification tool,
 * and "the backend named `x` is not on this machine" is a finding about the lesson's setup, not
 * an exception. It comes back as `unavailable` with that sentence in it, which is exactly what
 * the evaluator's refusal path already knows how to say.
 */
export async function lessonDatabaseFromBackend(backendId: string): Promise<LessonDatabaseSnapshot> {
  const root = backendsRoot();
  const known = listBackends().find((b) => b.id === backendId || b.name === backendId);
  if (!known) {
    const names = listBackends().map((b) => b.id);
    return {
      status: 'unavailable',
      reason: `no backend named “${backendId}” under ${root}${names.length ? ` (known: ${names.join(', ')})` : ''}`
    };
  }

  let client = new BackendClient(known);
  if (!(await client.isReachable())) {
    const config = readBackendConfig(known.id, root);
    if (!config) {
      return { status: 'unavailable', reason: `backend “${known.name}” has no readable config.json` };
    }
    try {
      installExitHooks(root);
      const started = await startBackend(config, { root });
      // Re-read the descriptor: starting the backend is what mints `secrets.json` on a first
      // run, and a client built before that has no admin token to read the schema with.
      const fresh = listBackends().find((b) => b.id === started.backendId);
      client = new BackendClient(fresh ?? { ...known, port: started.port, dir: path.join(root, started.backendId) });
    } catch (e) {
      return {
        status: 'unavailable',
        reason: `backend “${known.name}” would not start: ${e instanceof ToolError || e instanceof Error ? e.message : String(e)}`
      };
    }
  }

  return readLessonDatabaseSnapshot(backendLessonReader(client));
}
