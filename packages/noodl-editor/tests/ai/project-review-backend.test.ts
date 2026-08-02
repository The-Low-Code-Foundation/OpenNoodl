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

  it('says a cloud endpoint\'s collections are unknown, not absent', () => {
    const summary = buildBackendSummary(
      { type: 'nodegx', endpoint: 'http://127.0.0.1:8599', appId: 'nodegx-backend' },
      []
    );

    expect(summary.schemaAvailable).toBe(false);
    expect(summary.schemaNote).toContain('unknown, not absent');
    expect(renderBackend(summary)).toContain('NOT evidence');
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
