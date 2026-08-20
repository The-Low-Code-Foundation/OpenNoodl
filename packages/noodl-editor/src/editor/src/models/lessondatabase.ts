/**
 * TUT-002 AC3 — the snapshot the three collection verbs grade against, and the one place that
 * reads it.
 *
 * WHY THIS FILE EXISTS AT ALL
 * ---------------------------
 * `evalConditionsWithContext` is synchronous and stays that way: a database read is
 * asynchronous, grading an already-read snapshot is not, and making the evaluator async would
 * have made all twelve structural verbs async for the benefit of three new ones. So the
 * *caller* reads, and hands the result over as plain data.
 *
 * That leaves two callers — the live editor and the MCP sidecar — and the arc's central claim is
 * **one evaluator, never forked**. Two callers reading a database two ways is how that claim
 * dies quietly on the data side, so the reading itself lives here, once, behind a two-method
 * port. Each caller supplies a transport (Electron IPC / `BackendClient`) and nothing else.
 *
 * 🔴 THE THREE NON-ANSWERS ARE THE POINT
 * --------------------------------------
 * `refused`, `unavailable` and *absent* are separate, and all three are separate from
 * `{ status: 'ok', collections: [] }`. Every collapse of any pair is a lesson that either
 * congratulates a learner whose backend never started, or leaves one staring at a step that
 * cannot tick. See {@link LessonDatabaseSnapshot}.
 *
 * 🔴 A COUNT THAT CAME BACK AS "NOT A NUMBER" LEAVES `rowCount` ABSENT
 * -------------------------------------------------------------------
 * Not zero. `BackendManager.getRecordCount` ends `return result.count || 0` — the same
 * conflation, already in the tree — and `rowCountAtLeast: 0` then holds against a collection
 * nobody could read. This module never uses that method: it reads the route and drops a
 * non-number on the floor, so the distinction survives the trip. (`getRecordCount`'s `|| 0` is
 * load-bearing for its one other caller, `SchemaPanel.tsx`, and is deliberately left alone.)
 *
 * ⚠️ **Pure, and it has to stay pure.** No Electron, no `fetch`, no editor singleton — this
 * module is on `noodl-mcp`'s bundle path through `editor-deps.ts`, where "it only requires
 * Electron lazily" has already been proved not to be a purity argument (a bundler resolves what
 * it can see, lazily or not). The two transports live in `lessondatabase.live.ts` (renderer) and
 * in the sidecar.
 *
 * @module noodl-editor/models/lessondatabase
 */

import type {
  LessonCollection,
  LessonComponent,
  LessonDatabaseSnapshot,
  LessonNode
} from '../views/lessons/lessonevalconditions';
import { everyNode, isCollectionCondition } from '../views/lessons/lessonevalconditions';
import { compileConditions } from './lessonformat';
import type { LessonManifest } from './lessonformat';

// ─── The port ───────────────────────────────────────────────────────────────

/**
 * The two reads a snapshot is made of, as the caller's transport performs them.
 *
 * Both are the *same two HTTP routes* whichever side is asking — `GET /admin/schema` and
 * `GET /api/{collection}?limit=1&count=1` — which is what keeps one evaluator true on the data
 * side as well as the graph side. Reject to mean "this read failed"; the caller of
 * {@link readLessonDatabaseSnapshot} never sees the exception.
 */
export interface LessonDatabaseReader {
  /** `GET /admin/schema` → `{ tables: { name, columns, createdAt }[] }`. */
  readSchema(): Promise<unknown>;
  /**
   * `GET /api/{collection}?limit=1&count=1` → `{ results, count }`.
   *
   * ⚠️ **`limit=1`, not `limit=0`, and that is not a typo.** The editor reaches this route
   * through `BackendManager.queryRecords`, whose `options.limit || 50` turns a zero into
   * *fifty* — so a zero would mean the two transports asked different questions. One row is
   * read and never looked at.
   */
  readRowCount(collection: string): Promise<unknown>;
}

// ─── Narrowing what came back ───────────────────────────────────────────────

/** One table as `/admin/schema` describes it, once narrowed. */
interface SchemaTableLike {
  name: string;
  columns: string[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === 'object';
}

/**
 * Column names out of one table's `columns`, defensively.
 *
 * 🔴 `SchemaTable.columns` is `unknown[]` at its source — the `SchemaManager` behind it is
 * untyped JS in `@noodl/runtime` — so this narrows rather than casts. A column is either a bare
 * name or an object with a string `name`; anything else is dropped rather than stringified,
 * because `[object Object]` in a `hasColumns` answer is worse than a missing column.
 */
export function columnNamesFrom(columns: unknown): string[] {
  if (!Array.isArray(columns)) return [];
  const names: string[] = [];
  for (const column of columns) {
    if (typeof column === 'string') names.push(column);
    else if (isRecord(column) && typeof column.name === 'string') names.push(column.name);
  }
  return names;
}

/**
 * The tables in a `/admin/schema` response, or `undefined` when it did not carry a table list.
 *
 * 🔴 `undefined` and `[]` are different answers here too. A backend that answered without a
 * `tables` array is one we could not read; a backend with an empty `tables` array is one the
 * learner has not created anything in yet, which is a legitimate state and the starting state of
 * every data tutorial.
 */
export function tablesFromSchemaResponse(response: unknown): SchemaTableLike[] | undefined {
  if (!isRecord(response) || !Array.isArray(response.tables)) return undefined;

  const tables: SchemaTableLike[] = [];
  for (const table of response.tables) {
    if (!isRecord(table) || typeof table.name !== 'string') continue;
    // ⚠️ An empty `columns` here does not prove the table has none: `/admin/schema` pairs
    // `sqlite_master` with the `_Schema` rows by exact name and falls back to `[]` when it
    // cannot find the pair. `hasColumns` therefore answers false rather than true, which is the
    // safe direction — a grader that cannot see a column has not seen one.
    tables.push({ name: table.name, columns: columnNamesFrom(table.columns) });
  }
  return tables;
}

/**
 * The row count in a query response, or `undefined` when it did not carry one.
 *
 * 🔴 **Never zero as a fallback.** That substitution is the defect this whole file is careful
 * about: an absent count means *not counted*, and `rowCountAtLeast: 0` holding against a
 * collection nobody could read is a lesson congratulating a learner whose backend is down.
 */
export function rowCountFromQueryResponse(response: unknown): number | undefined {
  if (!isRecord(response)) return undefined;
  const count = response.count;
  return typeof count === 'number' && Number.isFinite(count) ? count : undefined;
}

// ─── The read ───────────────────────────────────────────────────────────────

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

/**
 * Read one snapshot through a transport. Never throws.
 *
 * A failed *schema* read sinks the snapshot to `unavailable` — without the table list there is
 * nothing to say. A failed *count* leaves that one collection's `rowCount` absent and keeps the
 * rest: `collectionExists` and `hasColumns` are still answerable, and `rowCountAtLeast` treats
 * absent as unproven, so nothing passes on a half-read.
 */
export async function readLessonDatabaseSnapshot(reader: LessonDatabaseReader): Promise<LessonDatabaseSnapshot> {
  let response: unknown;
  try {
    response = await reader.readSchema();
  } catch (e) {
    return { status: 'unavailable', reason: messageOf(e) };
  }

  const tables = tablesFromSchemaResponse(response);
  if (!tables) {
    return { status: 'unavailable', reason: 'the backend answered the schema request without a table list' };
  }

  const collections: LessonCollection[] = [];
  for (const table of tables) {
    let rowCount: number | undefined;
    try {
      rowCount = rowCountFromQueryResponse(await reader.readRowCount(table.name));
    } catch {
      // One collection that would not count does not make the others unreadable, and it must
      // not read as empty. Absent means "not counted" and every verb treats it as unproven.
      rowCount = undefined;
    }
    collections.push({
      name: table.name,
      columns: table.columns,
      ...(typeof rowCount === 'number' ? { rowCount } : {})
    });
  }

  return { status: 'ok', collections };
}

/**
 * The editor's transport, as a function of one `invoke`.
 *
 * 🔴 Lives here rather than in `lessondatabase.live.ts` **so that the two decisions in it are
 * gradeable in a plain-Node runner**: which channels are used, and with what arguments. Both are
 * load-bearing and neither is obvious —
 *
 *  - **`backend:queryRecords`, never `backend:getRecordCount`.** The latter ends
 *    `return result.count || 0`, which turns "the route answered without a count" into "this
 *    collection has zero rows" — and `rowCountAtLeast: 0` then holds against a collection nobody
 *    could read. `queryRecords` passes `result.count` through untouched. (`getRecordCount`'s
 *    `|| 0` is correct for its one other caller, `SchemaPanel`, and is left alone.)
 *  - **`limit: 1`.** `queryRecords` reads `options.limit || 50`, so a zero would fetch fifty of
 *    the learner's records instead of none, and would mean the two fillers were asking the same
 *    route different questions.
 *
 * Both were review comments until they were specs. `getIpc()` is the caller's to supply.
 */
export function ipcLessonReader(
  invoke: (channel: string, ...args: unknown[]) => Promise<unknown>,
  backendId: string
): LessonDatabaseReader {
  return {
    readSchema: () => invoke('backend:getSchema', backendId),
    readRowCount: (collection: string) => invoke('backend:queryRecords', backendId, { collection, limit: 1, count: true })
  };
}

// ─── Which backend, if any, a lesson may read ───────────────────────────────

/** What a project's binding turns out to be, once the caller has resolved it. */
export type LessonBackendTarget =
  /** A `nodegx-backend` this editor (or this sidecar) runs. Read it. */
  | { kind: 'builtin'; backendId: string }
  /** Somebody else's server. Named, never queried. */
  | { kind: 'refused'; binding: string }
  /** The right database, and it could not be read. */
  | { kind: 'unavailable'; reason: string };

export interface LessonBackendBinding {
  /** The project's `cloudservices.endpoint`. */
  endpoint?: string;
  /** The preset key — `nodegx`, `parse`, `directus`, … Absent on older projects. */
  type?: string;
  /**
   * The managed backend this endpoint resolves to, if the caller could match one.
   *
   * 🔴 **The matching is the caller's, deliberately.** `matchEndpointToManaged` already owns the
   * rule for what counts as one of ours (an instance id, or localhost on a managed port), and a
   * second copy of that rule here is the "second palette copy" this codebase has paid for. So
   * this module never asks whether an endpoint is local — it asks whether the caller matched
   * one, and refuses everything else by name.
   */
  managed?: { id: string; name?: string; running?: boolean };
  /** How to name this binding in a refusal, when the caller has a nicer word than the URL. */
  label?: string;
}

/**
 * Decide what may be read, before anything is read.
 *
 * 🔴 **Anything that is not a backend we manage is refused, by name.** Not "read anyway if it
 * looks local", not "return false" — a lesson condition that queries Parse, Directus, a bare
 * REST endpoint or a *deployed* nodegx backend is a lesson that phones home to someone else's
 * server, during grading, unprompted, possibly on a school-managed machine. Refusing everything
 * unmatched is both the safe rule and the one that needs no locality test of its own.
 *
 * A `false` would be indistinguishable from "the learner has not made the collection yet", which
 * is why this returns a reason rather than a boolean at every branch.
 */
export function classifyLessonBackend(binding: LessonBackendBinding | undefined): LessonBackendTarget {
  const endpoint = binding?.endpoint?.trim();
  if (!endpoint) {
    return {
      kind: 'unavailable',
      reason: 'this project is not bound to a backend, so there is no built-in database to read'
    };
  }

  const managed = binding?.managed;
  const foreignType = typeof binding?.type === 'string' && binding.type !== '' && binding.type !== 'nodegx';

  if (!managed || foreignType) {
    return { kind: 'refused', binding: describeBinding(binding, endpoint) };
  }
  if (managed.running === false) {
    return {
      kind: 'unavailable',
      reason: `the built-in backend “${managed.name ?? managed.id}” is not running`
    };
  }
  return { kind: 'builtin', backendId: managed.id };
}

/**
 * The phrase a refusal names the binding with.
 *
 * The caller's `label` wins when it has one — it has the preset display names and this module
 * deliberately does not, so there is one vocabulary rather than two that drift. Otherwise the
 * endpoint itself, which is always specific enough to act on.
 */
function describeBinding(binding: LessonBackendBinding | undefined, endpoint: string): string {
  const label = binding?.label?.trim();
  if (label) return `${label} (${endpoint})`;
  return endpoint;
}

// ─── When to read at all ────────────────────────────────────────────────────

/**
 * Does this lesson grade anything against the database?
 *
 * The guard on every read. A lesson with no collection verb must not put HTTP traffic on the
 * machine every time a step is re-evaluated, and the overwhelming majority of lessons have none.
 *
 * A manifest that does not compile answers `false`: a malformed step is F1's to report, and
 * reading a database because we could not parse the reason not to would be the wrong direction
 * on both counts.
 */
export function lessonObservesDatabase(manifest: LessonManifest | undefined): boolean {
  const steps = Array.isArray(manifest?.steps) ? manifest.steps : [];
  for (const step of steps) {
    if (!step?.completeWhen || step.completeWhen.length === 0) continue;
    try {
      if (compileConditions(step.completeWhen, 'lesson').some(isCollectionCondition)) return true;
    } catch {
      // Not a lesson that observes the database as far as anyone can tell. F1 reports it.
    }
  }
  return false;
}

// ─── The population F1 checks a collection name against ─────────────────────

/**
 * Every collection name this project's graph names.
 *
 * 🔴 This is the population `verifyLessonManifest`'s `knownCollections` wants, and it comes from
 * the **files**, not from a database. A bundle is verified long before any learner runs it, so
 * "which collections exist" is unanswerable and "which collections does this app talk about" is
 * exactly answerable — and a condition naming a collection that appears nowhere in either the
 * starter or the solution can never hold, which is F1's definition.
 *
 * `collectionName` is the one parameter that names a table: the Record family's Class dropdown
 * writes it (`record-ports.ts`), and so do the Query/Collection nodes. The Collection nodes'
 * `collectionId` is deliberately **not** read — it is a runtime collection id, not a table name,
 * and folding it in would put ids into a sentence that tells an author to correct a name.
 */
export function collectionNamesInComponents(components: readonly LessonComponent[] | undefined): string[] {
  const names: string[] = [];
  const seen = new Set<string>();

  // ⚠️ `everyNode` walks with `forEachNode` semantics elsewhere in this codebase, where a truthy
  // return STOPS the walk. This one returns the flat list, so there is nothing to return from.
  for (const node of everyNode((components ?? []) as LessonComponent[])) {
    const value = collectionNameOf(node);
    if (!value) continue;
    const key = value.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    // Reported verbatim, matched case-insensitively — an author told to "correct the name to one
    // of: owners" types exactly that, and `Owners` is what the solution actually creates.
    names.push(value);
  }

  return names;
}

function collectionNameOf(node: LessonNode): string | undefined {
  const parameters = node.parameters as Record<string, unknown> | undefined;
  const value = parameters?.collectionName;
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed === '' ? undefined : trimmed;
}
