/**
 * Backend resolution and the REST write path — BCN-004 steps 3 and 5.
 *
 * Two things are pinned here that no port test can reach:
 *
 * 1. **Which backend `_active_` means**, which is the decision the two-actives finding
 *    forced (`backendList.ts`: "two entries can be active at once today"). Getting it wrong
 *    in the permissive direction moves every Record node in every existing project onto
 *    whichever REST backend was added last, silently.
 * 2. **The `serializeObject` hook**, whose absence `RestDataAdapter`'s own notes flag as a
 *    live double-encoding defect.
 */

import {
  ACTIVE_BACKEND,
  ENDPOINT_BACKEND_ID,
  backendEntries,
  defaultBackendId,
  endpointBackendEntry,
  endpointBackendType,
  handleFor,
  hasStoredRelations,
  isParseWireType,
  resolveBackendTarget
} from '../../src/api/backends/resolveBackend';

import { fieldsByName, filterSchemaFor, makeRestSerializer, normalizeValue } from '../../src/api/backends/restSerialize';

const DIRECTUS = {
  id: 'd1',
  name: 'Local Directus',
  type: 'directus',
  url: 'http://localhost:8055',
  auth: { publicToken: 'tok' },
  schema: {
    collections: [
      {
        name: 'articles',
        fields: [
          { name: 'id', type: 'integer', primaryKey: true },
          { name: 'payload', type: 'json' },
          { name: 'published_at', type: 'dateTime' },
          { name: 'author', type: 'integer', relationTarget: 'authors', relationType: 'many-to-one' as const }
        ]
      }
    ]
  }
};

const ENDPOINT = { endpoint: 'http://localhost:8577', appId: 'app-id', type: 'nodegx' };

describe('endpointBackendType — deliberately not the editor’s answer', () => {
  it('honours a recorded type', () => {
    expect(endpointBackendType('nodegx')).toBe('nodegx');
    expect(endpointBackendType('external')).toBe('parse');
    expect(endpointBackendType('parse')).toBe('parse');
  });

  it('⚠️ reads a MISSING type as nodegx, where the editor reads it as parse', () => {
    // `CloudStore._handle()` has always answered `nodegx`, and `queryutils.backendType()`
    // reads that to pick which capability table greys the filter builder's operators out.
    // Answering `parse` here would narrow the operator list in every project saved before
    // WF-007 started writing the field.
    expect(endpointBackendType(undefined)).toBe('nodegx');
  });
});

describe('the project’s backend list', () => {
  it('is empty when nothing is configured', () => {
    expect(backendEntries({})).toEqual([]);
    expect(endpointBackendEntry(undefined)).toBeUndefined();
    expect(endpointBackendEntry({ appId: 'x' })).toBeUndefined();
  });

  it('puts the cloudservices endpoint first — it is the one the Record family talks to', () => {
    const entries = backendEntries({ cloudservices: ENDPOINT, backendServices: { backends: [DIRECTUS] } });
    expect(entries.map((entry) => entry.id)).toEqual([ENDPOINT_BACKEND_ID, 'd1']);
    expect(entries[0].type).toBe('nodegx');
    // BCN-009 step 2 follow-up 3: the app id no longer wins the label. It is *identity*, not
    // a name, and the dropdown used to read `backend_ms94j6xso72rl` beside "Rig Directus".
    // The id is untouched (asserted above), so no saved picker value changes.
    expect(entries[0].name).toBe('Built-in');
  });

  it('names an untitled endpoint for what it is', () => {
    expect(endpointBackendEntry({ endpoint: 'http://x' }).name).toBe('Built-in');
    expect(endpointBackendEntry({ endpoint: 'http://x', type: 'external' }).name).toBe('Parse Server');
  });
});

describe('what `_active_` resolves to', () => {
  it('⚠️ is the cloudservices endpoint when there is one, even with a BYOB active backend', () => {
    // The no-regression rule. `backendServices.activeBackendId` is the BYOB nodes' active
    // backend and always has been; honouring it here would move every Record node.
    const sources = { cloudservices: ENDPOINT, backendServices: { activeBackendId: 'd1', backends: [DIRECTUS] } };
    expect(defaultBackendId(sources)).toBe(ENDPOINT_BACKEND_ID);
    expect(resolveBackendTarget(ACTIVE_BACKEND, sources).entry.id).toBe(ENDPOINT_BACKEND_ID);
    expect(resolveBackendTarget(undefined, sources).entry.id).toBe(ENDPOINT_BACKEND_ID);
  });

  it('is the BYOB active backend when there is no endpoint', () => {
    const sources = { backendServices: { activeBackendId: 'd1', backends: [DIRECTUS] } };
    expect(defaultBackendId(sources)).toBe('d1');
  });

  it('is the only backend there is, when nothing recorded an active one — the spec’s step 3', () => {
    expect(defaultBackendId({ backendServices: { backends: [DIRECTUS] } })).toBe('d1');
  });

  it('is nothing at all when the project has no backend', () => {
    expect(defaultBackendId({})).toBeUndefined();
    expect(resolveBackendTarget(ACTIVE_BACKEND, {})).toBeUndefined();
  });
});

describe('resolving a named backend', () => {
  const sources = { cloudservices: ENDPOINT, backendServices: { backends: [DIRECTUS] } };

  it('answers the handle every contract method takes', () => {
    const target = resolveBackendTarget('d1', sources);
    expect(target.handle).toEqual({
      id: 'd1',
      type: 'directus',
      name: 'Local Directus',
      url: 'http://localhost:8055',
      publicToken: 'tok',
      sessionToken: undefined
    });
    expect(target.isParseWire).toBe(false);
    expect(target.collections).toHaveLength(1);
  });

  it('answers the endpoint by its synthetic id', () => {
    const target = resolveBackendTarget(ENDPOINT_BACKEND_ID, sources);
    expect(target.isParseWire).toBe(true);
    expect(target.handle.url).toBe('http://localhost:8577');
    expect(target.handle.publicToken).toBe('app-id');
  });

  it('⚠️ answers NOTHING for an id the project no longer has, rather than the default', () => {
    // Falling back would write the record to a different backend than the graph names,
    // with nothing anywhere reporting it.
    expect(resolveBackendTarget('deleted-backend', sources)).toBeUndefined();
  });

  it('knows which two types the Parse wire serves', () => {
    expect(isParseWireType('nodegx')).toBe(true);
    expect(isParseWireType('parse')).toBe(true);
    expect(isParseWireType('directus')).toBe(false);
    expect(isParseWireType('custom')).toBe(false);
    // An entry with no recorded type is the legacy Parse case.
    expect(isParseWireType(undefined)).toBe(true);
  });

  it('defaults an untyped entry’s handle to nodegx rather than leaving it undefined', () => {
    expect(handleFor({ id: 'x', url: 'http://x' }).type).toBe('nodegx');
    expect(handleFor({ id: 'x', url: 'http://x' }).name).toBe('x');
  });
});

describe('normalizeValue — RUN-003’s fix, in its new home', () => {
  it('parses the text of a json column rather than double-encoding it', () => {
    expect(normalizeValue('{"a":1}', { name: 'payload', type: 'json' })).toEqual({ a: 1 });
    expect(normalizeValue('[1,2]', { name: 'p', type: 'array' })).toEqual([1, 2]);
  });

  it('passes text that is not JSON through untouched — a json column may hold a string', () => {
    expect(normalizeValue('not json', { name: 'p', type: 'json' })).toBe('not json');
    expect(normalizeValue('  ', { name: 'p', type: 'json' })).toBe('  ');
  });

  it('coerces a date column to ISO 8601 and leaves an ISO string alone', () => {
    expect(normalizeValue(new Date('2026-07-31T00:00:00.000Z'), { name: 'd', type: 'dateTime' })).toBe(
      '2026-07-31T00:00:00.000Z'
    );
    expect(normalizeValue('2026-07-31', { name: 'd', type: 'date' })).toBe('2026-07-31');
  });

  it('leaves null and undefined as they are', () => {
    expect(normalizeValue(null, { name: 'd', type: 'date' })).toBeNull();
    expect(normalizeValue(undefined, { name: 'd', type: 'date' })).toBeUndefined();
  });
});

describe('the serializeObject hook RestDataAdapter defaults to the identity', () => {
  const serialize = makeRestSerializer({
    collections: () => DIRECTUS.schema.collections,
    toJSON: (value) => value
  });

  it('⚠️ normalises per column, which is the defect the default hook leaves open', () => {
    const out = serialize({ payload: '{"a":1}', published_at: new Date('2026-07-31T00:00:00.000Z') }, 'articles');
    expect(out.payload).toEqual({ a: 1 });
    expect(out.published_at).toBe('2026-07-31T00:00:00.000Z');
  });

  it('leaves a column it has no schema for exactly as it found it', () => {
    expect(serialize({ unknown_column: '{"a":1}' }, 'articles').unknown_column).toBe('{"a":1}');
    expect(serialize({ payload: '{"a":1}' }, 'no_such_collection').payload).toBe('{"a":1}');
  });

  it('unwraps a Noodl object before it reaches the wire', () => {
    const unwrapping = makeRestSerializer({
      collections: () => DIRECTUS.schema.collections,
      toJSON: (value) => (value && (value as { data?: unknown }).data ? (value as { data: unknown }).data : value)
    });

    expect(unwrapping({ author: { data: { id: 1 } } }, 'articles').author).toEqual({ id: 1 });
  });

  it('returns a copy — the Parse serialiser mutates in place and this one does not', () => {
    const input = { payload: '{"a":1}' };
    const out = serialize(input, 'articles');
    expect(input.payload).toBe('{"a":1}');
    expect(out).not.toBe(input);
  });
});

describe('the filter schema handed to the translators', () => {
  it('carries the backend’s own type names, a relation target and its cardinality', () => {
    expect(filterSchemaFor(DIRECTUS.schema.collections, 'articles')).toEqual({
      collection: 'articles',
      properties: {
        id: { type: 'integer' },
        payload: { type: 'json' },
        published_at: { type: 'dateTime' },
        // ⚠️ `cardinality` is BCN-005's, and it is load-bearing rather than
        // decorative: PocketBase spells a filter across a to-many relation
        // `tags.label ?= 'x'` and across a to-one `author.city = 'x'`, and a
        // live 0.30.0 answers the first spelling used on a to-many with **no
        // rows** — no error, no warning. `relationType` is the cached schema's
        // word for it and this is where it crosses into the translators.
        author: { type: 'integer', targetClass: 'authors', cardinality: 'one' }
      }
    });
  });

  it('marks a to-many relation as such, which is the case that changes the query', () => {
    const withM2M = {
      collections: [
        {
          name: 'articles',
          fields: [
            { name: 'tags', type: 'alias', relationTarget: 'tags', relationType: 'many-to-many' as const },
            { name: 'kids', type: 'alias', relationTarget: 'kids', relationType: 'one-to-many' as const },
            // No `relationType` recorded: left undefined rather than guessed, so
            // a schema written before this field existed behaves as it used to.
            { name: 'mystery', type: 'integer', relationTarget: 'other' }
          ]
        }
      ]
    };
    expect(filterSchemaFor(withM2M.collections, 'articles')?.properties).toEqual({
      tags: { type: 'alias', targetClass: 'tags', cardinality: 'many' },
      kids: { type: 'alias', targetClass: 'kids', cardinality: 'many' },
      mystery: { type: 'integer', targetClass: 'other' }
    });
  });

  it('is undefined rather than empty when there is nothing to say', () => {
    expect(filterSchemaFor(DIRECTUS.schema.collections, undefined)).toBeUndefined();
    expect(filterSchemaFor(DIRECTUS.schema.collections, 'nope')).toBeUndefined();
    expect(filterSchemaFor(undefined, 'articles')).toBeUndefined();
  });

  it('indexes a collection’s columns by name', () => {
    expect(Object.keys(fieldsByName(DIRECTUS.schema.collections, 'articles'))).toEqual([
      'id',
      'payload',
      'published_at',
      'author'
    ]);
  });
});

/**
 * BCN-005's schema sync — the relations the editor stores must reach the adapter.
 *
 * The four authoritative parsers shipped tested and with no caller: nothing stored their
 * output, so a running app resolved relations from `relationsFromCachedCollections`, the
 * strict subset derivable without them. The editor stores them now, and this is the seam
 * that carries them.
 */
describe('BCN-005: stored relation descriptors reach the resolved target', () => {
  const REL = [
    { name: 'tags', kind: 'many-to-many', targetCollection: 'bcn005_tags', junction: 'bcn005_articles_tags' }
  ] as never[];

  function sourcesWith(schema: unknown) {
    return {
      backendServices: {
        version: 2,
        activeBackendId: 'b1',
        backends: [{ id: 'b1', name: 'Directus', type: 'directus', url: 'http://d', schema }]
      }
    } as never;
  }

  it('carries `relations` from the cached schema onto the target', () => {
    const target = resolveBackendTarget('b1', sourcesWith({ collections: [], relations: REL }));

    expect(target?.relations).toEqual(REL);
  });

  it('leaves `relations` undefined for a project synced before they were stored', () => {
    const target = resolveBackendTarget('b1', sourcesWith({ collections: [] }));

    // Undefined rather than `[]`, so `cloudstore.js` can tell "never synced" from
    // "synced and this backend genuinely has no relations" and fall back accordingly.
    expect(target?.relations).toBeUndefined();
  });

  it('treats a stored EMPTY array as "nothing stored", so the derived fallback still runs', () => {
    // ⚠️ The rule `cloudstore.js`'s `relationsFor` turns on, and the one a bare
    // `target.relations &&` gets wrong. A mutation to that shape left every other suite
    // green, which is why this assertion exists at all.
    expect(hasStoredRelations(resolveBackendTarget('b1', sourcesWith({ collections: [], relations: [] })))).toBe(
      false
    );
    expect(hasStoredRelations(resolveBackendTarget('b1', sourcesWith({ collections: [] })))).toBe(false);
    expect(hasStoredRelations(undefined)).toBe(false);
  });

  it('treats a non-empty stored array as authoritative', () => {
    expect(hasStoredRelations(resolveBackendTarget('b1', sourcesWith({ collections: [], relations: REL })))).toBe(
      true
    );
  });

  it('carries an empty array as an empty array, not as undefined', () => {
    // ⚠️ The distinction the fallback rule turns on. `cloudstore.js` tests
    // `relations && relations.length`, so a stored empty array must still reach it as an
    // array — a `|| undefined` here would be invisible until a backend with genuinely no
    // relations silently fell back to the derived subset.
    const target = resolveBackendTarget('b1', sourcesWith({ collections: [], relations: [] }));

    expect(target?.relations).toEqual([]);
  });
});
