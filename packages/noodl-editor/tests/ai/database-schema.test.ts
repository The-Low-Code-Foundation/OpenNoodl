/**
 * The schema block the Read/Write Database templates hand to a model.
 *
 * `extractDatabaseSchema` read `SchemaHandler.dbCollections`, which has been a
 * stub since WF-007 — so both templates were substituting an empty schema
 * under the words "Here is the schema of the database:", for every project,
 * always. A model told a CRUD-writing task that the database has no
 * collections invents class and field names, and the author gets plausible
 * code against a schema that does not exist.
 *
 * These rows pin the thing that made that dangerous rather than merely
 * unhelpful: **"there are no collections" and "we could not read the
 * collections" must not render alike.** They license opposite behaviour — the
 * first means there is nothing to write against yet, the second means the
 * names exist and are unknown here — and the old code produced the same empty
 * string for both.
 *
 * The reader is `collectBackendSummary`, the same call the project review
 * makes; `project-review-backend.test.ts` covers the reading. This file covers
 * the rendering, which is pure.
 *
 * describe/it/expect are Jasmine globals; the editor suite is not jest.
 */

import { renderDatabaseSchema } from '../../src/editor/src/models/AiAssistant/DatabaseSchemaExtractor';
import type { BackendSummary } from '../../src/editor/src/models/AiAssistant/review/types';

const WITH_COLLECTIONS: BackendSummary = {
  services: [{ id: 'be-1', name: 'Local NodeGX', type: 'nodegx', url: 'http://127.0.0.1:8599' }],
  schemaAvailable: true,
  collections: [
    {
      name: 'Task',
      fields: [
        { name: 'title', type: 'string' },
        { name: 'done', type: 'boolean' },
        { name: 'owner', type: 'string', targetClass: 'User' }
      ]
    }
  ]
};

const NOTHING_CONFIGURED: BackendSummary = { services: [], collections: [], schemaAvailable: true };

const UNREADABLE: BackendSummary = {
  services: [{ id: 'be-1', name: 'Local NodeGX', type: 'nodegx', url: 'http://127.0.0.1:8599' }],
  collections: [],
  schemaAvailable: false,
  schemaNote: 'Local NodeGX is configured but its schema has never been synced in the editor (Backend Services → Sync)'
};

describe('the Read/Write Database templates’ schema block (AIX-010 residual)', () => {
  it('names the real collections and fields, and forbids inventing others', () => {
    const text = renderDatabaseSchema(WITH_COLLECTIONS);

    expect(text).toContain('Task');
    expect(text).toContain('- title: string');
    expect(text).toContain('- done: boolean');
    expect(text).toContain('Do not invent collections or fields');
  });

  it('keeps a pointer’s target, which is what makes a relation writable', () => {
    expect(renderDatabaseSchema(WITH_COLLECTIONS)).toContain('- owner: string -> User');
  });

  /**
   * The rule the old code broke. Both of the next two states produce no
   * collection names, and the whole point is that they do not therefore read
   * the same.
   */
  it('says "no database configured" only when that is actually the case', () => {
    const text = renderDatabaseSchema(NOTHING_CONFIGURED);

    expect(text).toContain('no cloud database configured');
    expect(text.indexOf('could not be read')).toBe(-1);
  });

  it('says an unread schema could not be read, and that this is not the same as empty', () => {
    const text = renderDatabaseSchema(UNREADABLE);

    expect(text).toContain('could not be read');
    expect(text).toContain('does NOT mean the database is empty');
    // The old failure: rendering "unavailable" as "there is nothing there".
    expect(text.indexOf('no cloud database configured')).toBe(-1);
  });

  it('renders the two empty-handed states differently from each other', () => {
    expect(renderDatabaseSchema(NOTHING_CONFIGURED)).not.toBe(renderDatabaseSchema(UNREADABLE));
  });

  it('tells the model what to do instead whenever it cannot supply names', () => {
    for (const text of [renderDatabaseSchema(NOTHING_CONFIGURED), renderDatabaseSchema(UNREADABLE)]) {
      expect(text).toContain('function input');
    }
  });

  it('passes the reason through, so the author can act on it', () => {
    expect(renderDatabaseSchema(UNREADABLE)).toContain('never been synced');
  });

  /**
   * The summary carries the backend's id, name and base URL. A schema block is
   * names and types; the endpoint is not the model's business and putting it
   * in the prompt is how a URL ends up in generated code.
   */
  it('carries collection names and types only — not the backend it read them from', () => {
    const text = renderDatabaseSchema(WITH_COLLECTIONS);

    expect(text.indexOf('http://127.0.0.1:8599')).toBe(-1);
    expect(text.indexOf('Local NodeGX')).toBe(-1);
  });

  it('treats a summary that could not be collected at all as unreadable, not as empty', () => {
    const text = renderDatabaseSchema(undefined);

    expect(text).toContain('could not be read');
    expect(text.indexOf('no cloud database configured')).toBe(-1);
  });
});
