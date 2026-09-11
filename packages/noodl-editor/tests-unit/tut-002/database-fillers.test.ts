/**
 * TUT-002 AC3 — the two context fillers, and the reading they share.
 *
 * Session 2 built the contract and nothing filled it: every collection verb answered `false` in
 * the real editor, with a refusal sentence attached, because no production path produced a
 * snapshot. These specs grade the path that does — the narrowing, the refusal decision, and the
 * two transports.
 *
 * 🔴 **What this file can and cannot reach, stated so it is not over-read.** `lessondatabase.live.ts`
 * imports `ProjectModel` and `ipcRenderer`, so a plain-Node runner cannot load it and these specs
 * do not pretend to. What they grade is everything that is *not* the renderer: the two readers
 * (including the two channel choices that are the documented traps), the snapshot builder, and
 * the binding classifier the live module hands its resolved binding to. The live module is fifty
 * lines of "supply the transport" over these, and its wiring is owed a drive.
 */
import {
  classifyLessonBackend,
  collectionNamesInComponents,
  columnNamesFrom,
  ipcLessonReader,
  lessonObservesDatabase,
  readLessonDatabaseSnapshot,
  rowCountFromQueryResponse,
  tablesFromSchemaResponse
} from '../../src/editor/src/models/lessondatabase';
import { buildLessonEvalContext } from '../../src/editor/src/models/lessonprojectcontext';
import { compileConditions } from '../../src/editor/src/models/lessonformat';
import type { LessonManifest } from '../../src/editor/src/models/lessonformat';
import { evalConditionsWithContext } from '../../src/editor/src/views/lessons/lessonevalconditions';
import type { LessonDatabaseSnapshot, LessonEvalContext } from '../../src/editor/src/views/lessons/lessonevalconditions';

// ─── The backend's two answers, as one fixture both transports read ─────────

const SCHEMA = {
  tables: [
    { name: 'Puppies', columns: [{ name: 'name', type: 'String' }, { name: 'age', type: 'Number' }], createdAt: null },
    { name: 'Owners', columns: [{ name: 'email', type: 'String' }], createdAt: null }
  ]
};
const COUNTS: Record<string, unknown> = { Puppies: { results: [], count: 2 }, Owners: { results: [], count: 0 } };

/** The HTTP transport the MCP sidecar uses, as a route → body table. */
function httpReader(schema: unknown = SCHEMA, counts: Record<string, unknown> = COUNTS) {
  const routes: string[] = [];
  return {
    routes,
    reader: {
      readSchema: async () => {
        routes.push('GET /admin/schema');
        return schema;
      },
      readRowCount: async (collection: string) => {
        routes.push(`GET /api/${collection}?limit=1&count=1`);
        return counts[collection];
      }
    }
  };
}

/** The editor's transport, as a fake `invoke`. */
function ipcCalls(schema: unknown = SCHEMA, counts: Record<string, unknown> = COUNTS) {
  const calls: Array<{ channel: string; args: unknown[] }> = [];
  const invoke = async (channel: string, ...args: unknown[]) => {
    calls.push({ channel, args });
    if (channel === 'backend:getSchema') return schema;
    if (channel === 'backend:queryRecords') return counts[(args[1] as { collection: string }).collection];
    throw new Error(`unexpected channel ${channel}`);
  };
  return { calls, reader: ipcLessonReader(invoke, 'be-1') };
}

// ─── Narrowing ──────────────────────────────────────────────────────────────

describe('what came back off the wire', () => {
  it('narrows columns rather than casting them — the source type is unknown[]', () => {
    expect(columnNamesFrom([{ name: 'a' }, 'b', { type: 'String' }, null, 7])).toEqual(['a', 'b']);
    expect(columnNamesFrom(undefined)).toEqual([]);
  });

  it('🔴 tells "answered without a table list" from "answered with no tables"', () => {
    // The first is a backend we could not read; the second is a learner who has not made
    // anything yet, which is the STARTING STATE of every data tutorial. Collapsing them would
    // make the first tick a `collectionExists: false` step.
    expect(tablesFromSchemaResponse({ tables: [] })).toEqual([]);
    expect(tablesFromSchemaResponse({})).toBeUndefined();
    expect(tablesFromSchemaResponse(null)).toBeUndefined();
    expect(tablesFromSchemaResponse('nope')).toBeUndefined();
  });

  it('🔴 refuses a count that is not a number rather than defaulting it to zero', () => {
    // The exact conflation already in the tree at `BackendManager.getRecordCount`
    // (`return result.count || 0`). A JSON snapshot crossing a process boundary can carry '5'.
    expect(rowCountFromQueryResponse({ count: 0 })).toBe(0);
    expect(rowCountFromQueryResponse({ count: 4 })).toBe(4);
    expect(rowCountFromQueryResponse({ results: [] })).toBeUndefined();
    expect(rowCountFromQueryResponse({ count: '5' })).toBeUndefined();
    expect(rowCountFromQueryResponse({ count: null })).toBeUndefined();
    expect(rowCountFromQueryResponse({ count: NaN })).toBeUndefined();
  });
});

// ─── The read ───────────────────────────────────────────────────────────────

describe('reading one snapshot', () => {
  it('reads collections, columns and counts, and keeps a zero count as zero', async () => {
    const snapshot = await readLessonDatabaseSnapshot(httpReader().reader);
    expect(snapshot).toEqual({
      status: 'ok',
      collections: [
        { name: 'Puppies', columns: ['name', 'age'], rowCount: 2 },
        { name: 'Owners', columns: ['email'], rowCount: 0 }
      ]
    });
  });

  it('a schema read that throws is unavailable, never an empty database', async () => {
    const snapshot = await readLessonDatabaseSnapshot({
      readSchema: () => Promise.reject(new Error('ECONNREFUSED')),
      readRowCount: () => Promise.resolve({ count: 0 })
    });
    expect(snapshot).toEqual({ status: 'unavailable', reason: 'ECONNREFUSED' });
  });

  it('🔴 one collection that would not count leaves rowCount ABSENT and keeps the rest', async () => {
    const snapshot = await readLessonDatabaseSnapshot({
      readSchema: async () => SCHEMA,
      readRowCount: async (c: string) => {
        if (c === 'Puppies') throw new Error('permission denied');
        return { count: 0 };
      }
    });
    expect(snapshot.status).toBe('ok');
    const collections = (snapshot as { collections: Array<{ name: string; columns: string[]; rowCount?: number }> })
      .collections;
    // Absent, not zero — `rowCountAtLeast: 0` must not hold against a collection nobody read.
    expect('rowCount' in collections[0]).toBe(false);
    expect(collections[1].rowCount).toBe(0);
    // And the collection is still there: existence and columns were read fine.
    expect(collections[0].columns).toEqual(['name', 'age']);
  });
});

// ─── The two transports ─────────────────────────────────────────────────────

describe('the editor transport', () => {
  it('🔴 counts through backend:queryRecords, NOT backend:getRecordCount', async () => {
    // `getRecordCount` ends `return result.count || 0`. A route that answered without a count
    // would come back as zero, and the evaluator's own guard cannot help — by then it is a
    // perfectly good number.
    const { calls, reader } = ipcCalls();
    await readLessonDatabaseSnapshot(reader);

    expect(calls.map((c) => c.channel)).toEqual([
      'backend:getSchema',
      'backend:queryRecords',
      'backend:queryRecords'
    ]);
    expect(calls.some((c) => c.channel === 'backend:getRecordCount')).toBe(false);
  });

  it('🔴 asks for limit 1, because queryRecords reads `options.limit || 50`', async () => {
    // A zero here would fetch fifty of the learner's records instead of none, and would mean the
    // two fillers asked the same route different questions.
    //
    // ⚠️ Awaited, and the rejection swallowed, on purpose: a `void` here left an unhandled
    // rejection whenever the channel under test was wrong, which crashed the jest WORKER — and a
    // crashed worker reports `52 passed, 52 total` with no failure line at all. A control that
    // cannot be read is not a control.
    const { calls, reader } = ipcCalls();
    await reader.readRowCount('Puppies').catch(() => undefined);
    expect(calls[0]).toEqual({
      channel: 'backend:queryRecords',
      args: ['be-1', { collection: 'Puppies', limit: 1, count: true }]
    });
  });
});

describe('the sidecar transport', () => {
  it('reads the same two routes', async () => {
    const { routes, reader } = httpReader();
    await readLessonDatabaseSnapshot(reader);
    expect(routes).toEqual([
      'GET /admin/schema',
      'GET /api/Puppies?limit=1&count=1',
      'GET /api/Owners?limit=1&count=1'
    ]);
  });
});

// ─── AC3: the same manifest, both fillers, one verdict ──────────────────────

const DATA_LESSON: LessonManifest = {
  format: 'noodl-lesson@1',
  title: 'Save a puppy',
  steps: [
    {
      title: 'Make the collection',
      completeWhen: [
        { collection: 'puppies', collectionExists: true },
        { collection: 'Puppies', hasColumns: ['Name'] },
        { collection: 'Puppies', rowCountAtLeast: 2 }
      ]
    }
  ]
};

function verdict(database: LessonDatabaseSnapshot): boolean {
  // The FILE filler's context, built by the module the sidecar and the bundle harness use.
  const ctx: LessonEvalContext = buildLessonEvalContext({ components: [], database });
  return evalConditionsWithContext(compileConditions(DATA_LESSON.steps[0].completeWhen, 'step'), ctx);
}

describe('AC3 — one manifest, two fillers, the same answer', () => {
  it('grades the same through the editor transport and the sidecar transport', async () => {
    const fromIpc = await readLessonDatabaseSnapshot(ipcCalls().reader);
    const fromHttp = await readLessonDatabaseSnapshot(httpReader().reader);

    // The snapshots are identical, which is the claim that matters: one reading, two transports.
    expect(fromIpc).toEqual(fromHttp);
    // And the manifest grades identically through both — case-insensitively, as SQLite is.
    expect(verdict(fromIpc)).toBe(true);
    expect(verdict(fromHttp)).toBe(true);
  });

  it('🔴 a known-firing control: the same manifest against one row fewer does NOT pass', () => {
    // Without this, "both fillers agree" would be satisfied by a manifest that passes against
    // anything at all, and the pair above would prove nothing about the data.
    expect(verdict({ status: 'ok', collections: [{ name: 'Puppies', columns: ['name'], rowCount: 1 }] })).toBe(false);
  });
});

// ─── The binding decision ───────────────────────────────────────────────────

describe('which backend a lesson may read', () => {
  it('a project bound to nothing is unavailable, not refused — there is no-one to name', () => {
    expect(classifyLessonBackend(undefined)).toEqual({
      kind: 'unavailable',
      reason: 'this project is not bound to a backend, so there is no built-in database to read'
    });
    expect(classifyLessonBackend({ endpoint: '   ' }).kind).toBe('unavailable');
  });

  it('🔴 refuses a foreign backend BY NAME, with a known-firing local control beside it', () => {
    const foreign = classifyLessonBackend({
      endpoint: 'https://data.example.com',
      type: 'directus',
      label: 'Directus',
      managed: { id: 'be-1', running: true }
    });
    expect(foreign).toEqual({ kind: 'refused', binding: 'Directus (https://data.example.com)' });

    // The control: everything held constant except the type. "Refused" and "never asked" are
    // otherwise the same silence.
    expect(
      classifyLessonBackend({ endpoint: 'http://localhost:8578', type: 'nodegx', managed: { id: 'be-1', running: true } })
    ).toEqual({ kind: 'builtin', backendId: 'be-1' });
  });

  it('🔴 refuses a DEPLOYED backend of our own kind — local is the rule, not the brand', () => {
    // The endpoint matched nothing this editor manages, so it is somebody else's server whatever
    // software is running on it. Naming it is what makes the refusal actionable.
    expect(classifyLessonBackend({ endpoint: 'https://api.myapp.com', type: 'nodegx' })).toEqual({
      kind: 'refused',
      binding: 'https://api.myapp.com'
    });
  });

  it('a managed backend that is stopped is unavailable and names itself', () => {
    const target = classifyLessonBackend({
      endpoint: 'http://localhost:8578',
      managed: { id: 'be-1', name: 'Puppies backend', running: false }
    });
    expect(target).toEqual({ kind: 'unavailable', reason: 'the built-in backend “Puppies backend” is not running' });
  });
});

// ─── The guard, and the population F1 checks against ────────────────────────

describe('when to read at all', () => {
  it('does not read a database for a lesson that never mentions one', () => {
    expect(lessonObservesDatabase(DATA_LESSON)).toBe(true);
    expect(
      lessonObservesDatabase({
        steps: [{ completeWhen: [{ node: '/#__page__/Home:%Page', exists: true }] }]
      } as LessonManifest)
    ).toBe(false);
    expect(lessonObservesDatabase({ steps: [{ title: 'read this' }] } as LessonManifest)).toBe(false);
    expect(lessonObservesDatabase(undefined)).toBe(false);
  });

  it('a manifest that does not compile is not a reason to open a database', () => {
    expect(lessonObservesDatabase({ steps: [{ completeWhen: [{ nonsense: true }] }] } as unknown as LessonManifest)).toBe(
      false
    );
  });

  it('collects collection names verbatim, de-duplicated case-insensitively', () => {
    const node = (parameters: Record<string, unknown>) => ({
      id: 'n',
      label: '',
      type: { name: 'CreateNewRecord' },
      ports: [],
      parameters,
      children: [],
      getPort: () => undefined,
      forAllConnectionsOnThisNode: () => undefined
    });
    const names = collectionNamesInComponents([
      {
        name: '/Home',
        graph: {
          roots: [
            node({ collectionName: 'Owners' }),
            node({ collectionName: 'owners' }),
            node({ collectionName: '  Puppies  ' }),
            node({ collectionName: '' }),
            // A runtime collection id, deliberately not read: it is not a table name, and putting
            // one into "correct the name to one of:" would send an author chasing a uuid.
            node({ collectionId: 'abc-123' }),
            node({})
          ]
        }
      }
    ]);
    expect(names).toEqual(['Owners', 'Puppies']);
  });
});
