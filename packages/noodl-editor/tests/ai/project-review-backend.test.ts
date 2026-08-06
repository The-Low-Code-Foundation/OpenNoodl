/**
 * AIX-010 residual — `collectBackendSummary` against a real backend.
 *
 * The residual was that this had only ever been exercised on projects with no
 * backend, so what it produced when one existed was unknown. It was run against
 * a live `nodegx-backend` on 2026-08-02 and the answer was that **it produced
 * the same thing either way**: `SchemaHandler`, the source it read collections
 * from, has been a stub since WF-007 and always returns an empty list. A
 * configured backend therefore fell into the "empty but configured" branch and
 * the review was told *"a backend is configured but its schema returned nothing
 * — it may be unreachable"* about a backend answering in milliseconds.
 *
 * The payload below is that server's verbatim answer, for a data dir with two
 * collections created over the Parse wire. It is run through the product's own
 * `parseSchemaResponse` rather than hand-written into a `CachedSchema`, so the
 * chain these rows cover is the real one: backend → parser → cache → summary →
 * prompt.
 *
 * describe/it/expect are Jasmine globals; the editor suite is not jest.
 */

import { buildBackendSummary } from '../../src/editor/src/models/AiAssistant/review/backendSummary';
import { renderBackend } from '../../src/editor/src/models/AiAssistant/review/assembleProject';
import { renderDatabaseSchema } from '../../src/editor/src/models/AiAssistant/DatabaseSchemaExtractor';
import { builtInSchemaCollections } from '../../src/editor/src/models/BackendServices/projectCollections';
import { parseSchemaResponse } from '../../src/editor/src/models/BackendServices/schemaParsers';
import type { BackendConfig } from '../../src/editor/src/models/BackendServices/types';

/** Verbatim `GET /api/_schema` from `nodegx-backend` 0.1.0, node:sqlite persistence. */
const LIVE_SCHEMA_PAYLOAD = {
  tables: [
    {
      name: 'Task',
      columns: [
        { name: 'title', type: 'String' },
        { name: 'done', type: 'Boolean' },
        { name: 'priority', type: 'Number' }
      ],
      createdAt: null
    },
    {
      name: 'Project',
      columns: [
        { name: 'name', type: 'String' },
        { name: 'budget', type: 'Number' }
      ],
      createdAt: null
    }
  ]
};

/**
 * A backend as the panel stores it — including every credential field, because
 * the point of the last spec here is that none of them comes out the other end.
 */
function liveBackend(withSchema: boolean): BackendConfig {
  return {
    id: 'be-1',
    name: 'Local NodeGX',
    type: 'nodegx',
    url: 'http://127.0.0.1:8599',
    auth: {
      method: 'bearer',
      adminToken: 'admin-token-must-not-appear',
      publicToken: 'public-token-must-not-appear',
      username: 'operator',
      password: 'password-must-not-appear'
    },
    endpoints: {} as BackendConfig['endpoints'],
    responseConfig: {} as BackendConfig['responseConfig'],
    schema: withSchema ? parseSchemaResponse('nodegx', LIVE_SCHEMA_PAYLOAD) : undefined,
    status: 'connected',
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

describe('collectBackendSummary — a project with a real backend (AIX-010)', () => {
  it('lists the collections and fields the live backend actually reports', () => {
    const summary = buildBackendSummary(undefined, [liveBackend(true)]);

    expect(summary.schemaAvailable).toBe(true);
    expect(summary.collections.map((c) => c.name)).toEqual(['Task', 'Project']);
    expect(summary.collections[0].fields).toEqual([
      { name: 'title', type: 'string' },
      { name: 'done', type: 'boolean' },
      { name: 'priority', type: 'number' }
    ]);
  });

  it('puts those names into the prompt verbatim', () => {
    const rendered = renderBackend(buildBackendSummary(undefined, [liveBackend(true)]));

    expect(rendered).toContain('Collections (2)');
    expect(rendered).toContain('- Task');
    expect(rendered).toContain('  - priority: number');
    expect(rendered).toContain('do not invent fields');
  });

  it('never calls a configured backend unreachable — it says the schema was not synced', () => {
    const summary = buildBackendSummary(undefined, [liveBackend(false)]);

    expect(summary.schemaAvailable).toBe(false);
    expect(summary.collections).toEqual([]);
    expect(summary.schemaNote).toContain('never been synced');
    // The old wording, which was a diagnosis nothing had established.
    expect(summary.schemaNote.indexOf('unreachable')).toBe(-1);
  });

  it('says a cloud endpoint\'s collections are unknown, not absent — when they are', () => {
    // ⚠️ AAQ-011 F8 **narrowed** this outcome; it did not delete it. The empty third
    // argument is the whole of what it now means: `SchemaHandler._store()` writes
    // `dbCollections = undefined` whenever the fetch failed, so a stopped backend, a
    // backend mid-restart and a foreign Parse server we hold no key for all land here.
    // Concluding "no collections" from that is the lie this module exists to prevent.
    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      [],
      []
    );

    expect(summary.schemaAvailable).toBe(false);
    expect(summary.schemaNote).toContain('unknown, not absent');
    expect(renderBackend(summary)).toContain('NOT evidence');
  });

  /**
   * AAQ-011 **F8** — the rows the narrowing is for.
   *
   * The built-in backend is bound through `cloudservices` and has no `BackendConfig`,
   * so it fell into the outcome above *by construction* — and that outcome's stated
   * ground, "the editor has no schema introspection for one", stopped being true in
   * phase 40's Layer 1. `SchemaHandler._fetch()` introspects it over
   * `backend:list` → `backend:status` → `backend:getSchema` and caches the answer in
   * the `dbCollections` metadata; `builtInSchemaCollections` reads it back through
   * the same `parseParseSchema` the ports use. So the review was calling unknowable
   * exactly the backend this phase provisions, and the fix was wiring.
   */
  const BUILT_IN = [
    {
      name: 'Puppy',
      fields: [
        { name: 'name', type: 'string' },
        { name: 'age', type: 'number' }
      ]
    }
  ];

  it('lists the built-in backend\'s collections instead of calling them unknown', () => {
    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      [],
      BUILT_IN
    );

    expect(summary.schemaAvailable).toBe(true);
    expect(summary.collections.map((c) => c.name)).toEqual(['Puppy']);
    expect(summary.schemaNote).toBe(undefined);

    const rendered = renderBackend(summary);
    expect(rendered).toContain('the built-in NodeGX backend');
    expect(rendered).toContain('  - age: number');
    // The sentence that was wrong for every built-in backend in the product.
    expect(rendered.indexOf('unknown, not absent')).toBe(-1);
  });

  it('does not merge the built-in cache into a BYOB entry\'s partial-read note', () => {
    // Outcome 1's predicate is now "something was read", so a built-in schema plus an
    // unsynced Backend Services entry must still say which half is missing — otherwise
    // "here are the collections" reads as "here are all of them".
    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      [liveBackend(false)],
      BUILT_IN
    );

    expect(summary.schemaAvailable).toBe(true);
    expect(summary.collections.map((c) => c.name)).toEqual(['Puppy']);
    expect(summary.schemaNote).toContain('Local NodeGX');
    expect(renderBackend(summary)).toContain('Not everything could be read');
  });

  it('lists both systems\' collections when a project has both, without duplicating either', () => {
    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      [liveBackend(true)],
      BUILT_IN
    );

    expect(summary.schemaAvailable).toBe(true);
    expect(summary.collections.map((c) => c.name)).toEqual(['Puppy', 'Task', 'Project']);
    expect(summary.schemaNote).toBe(undefined);
  });

  it('still asserts "nothing server-side" only when nothing is configured', () => {
    const summary = buildBackendSummary(undefined, []);

    expect(summary.schemaAvailable).toBe(true);
    expect(renderBackend(summary)).toBe('This project has no backend configured.');
  });

  it('does not present a partial answer as a whole one', () => {
    const second = liveBackend(false);
    second.id = 'be-2';
    second.name = 'Directus';

    const summary = buildBackendSummary(undefined, [liveBackend(true), second]);

    expect(summary.schemaAvailable).toBe(true);
    expect(summary.schemaNote).toContain('Directus');
    expect(renderBackend(summary)).toContain('Not everything could be read');
  });

  /**
   * The summary is rendered into a prompt and into a document on disk. The
   * editor holds the only admin token in the product (`BackendAuthConfig`), so
   * this is the row that keeps it out of both.
   */
  it('carries no credential out of the backend config', () => {
    const summary = buildBackendSummary(undefined, [liveBackend(true)]);
    const everythingItProduces = JSON.stringify(summary) + renderBackend(summary);

    expect(everythingItProduces.indexOf('admin-token-must-not-appear')).toBe(-1);
    expect(everythingItProduces.indexOf('public-token-must-not-appear')).toBe(-1);
    expect(everythingItProduces.indexOf('password-must-not-appear')).toBe(-1);
    expect(everythingItProduces.indexOf('operator')).toBe(-1);

    // What it does carry: the four fields the review is allowed to name.
    expect(summary.services).toEqual([
      { id: 'be-1', name: 'Local NodeGX', type: 'nodegx', url: 'http://127.0.0.1:8599' }
    ]);
  });
});

/**
 * AAQ-011 **F8**, the reader half — because the rows above would all pass with the
 * wiring absent.
 *
 * `buildBackendSummary` is pure and takes the built-in collections as an argument;
 * every row above hands them over by hand. What F8 actually was is that *nothing
 * handed them over*, and the only thing that can catch that regressing is a row over
 * the reader — `builtInSchemaCollections`, from the `dbCollections` metadata
 * `SchemaHandler._store()` writes, through the same `parseParseSchema` the Record
 * family's `prop-*` ports are generated from.
 *
 * The payload is the verbatim `tables` array again, because that is what the metadata
 * holds: `SchemaHandler` caches the backend's own answer unaltered.
 */
describe('the built-in backend’s collections reach the review (AAQ-011 F8)', () => {
  /** A `ProjectModel` reduced to the one call the reader makes. */
  function projectWithMetadata(value: unknown) {
    return {
      getMetaData: (key: string) => (key === 'dbCollections' ? value : undefined)
    } as unknown as Parameters<typeof builtInSchemaCollections>[0];
  }

  it('reads the cache SchemaHandler writes, in the shape it writes it', () => {
    const collections = builtInSchemaCollections(projectWithMetadata(LIVE_SCHEMA_PAYLOAD.tables));

    expect(collections.map((c) => c.name)).toEqual(['Task', 'Project']);
    expect(collections[0].fields).toEqual([
      { name: 'title', type: 'string' },
      { name: 'done', type: 'boolean' },
      { name: 'priority', type: 'number' }
    ]);
  });

  it('turns the built-in backend from "unknown" into a listed schema, end to end', () => {
    // The two halves joined: the reader's output is what `collectBackendSummary` now
    // passes, so this is the sentence a wizard-built project's review actually gets.
    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      [],
      builtInSchemaCollections(projectWithMetadata(LIVE_SCHEMA_PAYLOAD.tables))
    );

    expect(summary.schemaAvailable).toBe(true);
    expect(renderBackend(summary)).toContain('- Task');
    expect(renderDatabaseSchema(summary)).toContain('- priority: number');
  });

  /**
   * The direction that must NOT change. An empty cache is "we could not look" —
   * `_store()` writes `dbCollections = undefined` whenever the fetch failed — so a
   * stopped backend must go on saying the collections are unknown.
   */
  it('says nothing new when the cache is empty, unreadable, or the wrong shape', () => {
    for (const value of [undefined, null, [], {}, 'not an array']) {
      expect(builtInSchemaCollections(projectWithMetadata(value))).toEqual([]);
    }

    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      [],
      builtInSchemaCollections(projectWithMetadata(undefined))
    );
    expect(summary.schemaAvailable).toBe(false);
    expect(summary.schemaNote).toContain('unknown, not absent');
  });

  it('is undefined-safe, because the review runs on projects that are not open', () => {
    expect(builtInSchemaCollections(undefined)).toEqual([]);
  });
});
