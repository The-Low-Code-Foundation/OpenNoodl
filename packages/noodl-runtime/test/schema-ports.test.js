/**
 * schema-ports unit tests (BCN-004 step 4).
 *
 * The schema-driven port generator, moved out of the byob-* nodes so the Record
 * family can build ports the same way. Two fixes RUN-003 paid for are pinned here
 * deliberately, because both were silent failures that unit tests of the day passed:
 *
 * 1. **Both field shapes reach the PORTS**, not merely the utilities. RUN-003 slice 4
 *    found byob-create/update feeding *cached* SchemaFields (no `meta`) into helpers
 *    that only read raw Directus `meta` — enum dropdowns and hidden-field filtering
 *    were dead in the real editor flow while every test passed, because every test fed
 *    the raw shape. So the tests below drive `fieldPorts` with the cached shape first.
 * 2. **A static port is never re-announced as a dynamic one.** `updatePorts` once
 *    re-pushed every static output, so `getPorts()` listed each output twice. The guard
 *    now lives in `dedupeSchemaPorts`/`sendSchemaPorts` rather than in a comment.
 */

const SchemaPorts = require('../src/nodes/std-library/data/schema-ports');

/** A graphModel stand-in: the port generator only ever reads metadata off it. */
function graphModelWith(metadata) {
  return {
    getMetaData: (key) => metadata[key]
  };
}

/** The cached shape the nodes actually receive from backendServices metadata. */
const CACHED_COLLECTION = {
  name: 'articles',
  displayName: 'Articles',
  primaryKey: 'id',
  fields: [
    { name: 'id', displayName: 'id', type: 'integer', primaryKey: true },
    { name: 'title', displayName: 'Title', type: 'string' },
    { name: 'status', displayName: 'Status', type: 'string', enumValues: ['draft', 'published'] },
    { name: 'secret_note', displayName: 'Secret', type: 'string', hidden: true },
    { name: 'published_at', displayName: 'Published', type: 'dateTime' },
    { name: 'payload', displayName: 'Payload', type: 'json' },
    { name: 'author', displayName: 'Author', type: 'integer', relationTarget: 'authors', relationType: 'many-to-one' }
  ]
};

const AUTHORS_COLLECTION = {
  name: 'authors',
  displayName: 'Authors',
  primaryKey: 'id',
  fields: [
    { name: 'id', displayName: 'id', type: 'integer', primaryKey: true },
    { name: 'name', displayName: 'Name', type: 'string' },
    { name: 'tier', displayName: 'Tier', type: 'string', enumValues: ['free', 'pro'] },
    { name: 'internal', displayName: 'Internal', type: 'string', hidden: true }
  ]
};

/** A raw Directus GET /fields entry, passed straight through without parsing. */
const RAW_DIRECTUS_COLLECTION = {
  name: 'articles',
  fields: [
    { name: 'title', type: 'string' },
    {
      name: 'status',
      type: 'string',
      meta: { interface: 'select-dropdown', options: { choices: [{ text: 'Draft', value: 'draft' }] } }
    },
    { name: 'divider', type: 'alias', meta: { interface: 'presentation-divider' } },
    { name: 'secret_note', type: 'string', meta: { hidden: true } }
  ]
};

function backendServicesWith(collections, extra) {
  return Object.assign(
    {
      activeBackendId: 'b1',
      backends: [
        { id: 'b1', name: 'Local Directus', type: 'directus', url: 'http://localhost:8055', schema: { collections } },
        { id: 'b2', name: 'Other', type: 'supabase', url: 'https://x.supabase.co', schema: { collections: [] } }
      ]
    },
    extra || {}
  );
}

describe('resolveSchemaPortContext', () => {
  it('resolves the active backend through the _active_ sentinel and finds the selected collection', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({ backendServices: backendServicesWith([CACHED_COLLECTION, AUTHORS_COLLECTION]) }),
      parameters: { backendId: '_active_', collection: 'articles' }
    });

    expect(ctx.backendType).toBe('directus');
    expect(ctx.collections).toHaveLength(2);
    expect(ctx.selectedCollection.name).toBe('articles');
    expect(ctx.source).toBe('backendServices');
  });

  it('resolves a backend by explicit id, and an unknown id resolves nothing', () => {
    const metadata = { backendServices: backendServicesWith([CACHED_COLLECTION]) };

    expect(
      SchemaPorts.resolveSchemaPortContext({
        graphModel: graphModelWith(metadata),
        parameters: { backendId: 'b2' }
      }).backendType
    ).toBe('supabase');

    const unknown = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith(metadata),
      parameters: { backendId: 'nope' }
    });
    expect(unknown.selectedBackend).toBeUndefined();
    expect(unknown.collections).toEqual([]);
    expect(unknown.source).toBe('none');
  });

  it('reads the collection parameter under whatever name the node family spells it', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({ backendServices: backendServicesWith([CACHED_COLLECTION]) }),
      parameters: { collectionName: 'articles' },
      collectionParam: 'collectionName'
    });
    expect(ctx.selectedCollection.name).toBe('articles');
  });

  it('derives the Directus items/system path mode from the collection name', () => {
    const metadata = { backendServices: backendServicesWith([{ name: 'directus_users', fields: [] }]) };

    expect(
      SchemaPorts.resolveSchemaPortContext({
        graphModel: graphModelWith(metadata),
        parameters: { collection: 'directus_users' }
      }).apiPathMode
    ).toBe('system');

    expect(
      SchemaPorts.resolveSchemaPortContext({
        graphModel: graphModelWith(metadata),
        parameters: { collection: 'articles' }
      }).apiPathMode
    ).toBe('items');
  });

  it('survives a project with no backendServices metadata at all', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({ graphModel: graphModelWith({}), parameters: {} });
    expect(ctx.backends).toEqual([]);
    expect(ctx.collections).toEqual([]);
    expect(ctx.source).toBe('none');
  });
});

describe('the Parse wire’s schema', () => {
  /** What Parse answers on GET /schemas. */
  const PARSE_SCHEMAS_RESPONSE = {
    results: [
      {
        className: 'Article',
        fields: {
          objectId: { type: 'String' },
          createdAt: { type: 'Date' },
          updatedAt: { type: 'Date' },
          ACL: { type: 'ACL' },
          title: { type: 'String' },
          views: { type: 'Number' },
          published: { type: 'Boolean' },
          publishedAt: { type: 'Date' },
          payload: { type: 'Object' },
          cover: { type: 'File' },
          author: { type: 'Pointer', targetClass: 'Author' },
          tags: { type: 'Relation', targetClass: 'Tag' }
        }
      },
      { className: '_User', fields: { objectId: { type: 'String' }, username: { type: 'String' } } }
    ]
  };

  /** The same classes as the legacy dbCollections project metadata spells them. */
  const DB_COLLECTIONS_METADATA = [
    {
      name: 'Article',
      schema: {
        properties: {
          objectId: { type: 'String' },
          title: { type: 'String' },
          author: { type: 'Pointer', targetClass: 'Author' }
        }
      }
    }
  ];

  it('normalises a GET /schemas response into collections the port builders understand', () => {
    const collections = SchemaPorts.collectionsFromParseClasses(PARSE_SCHEMAS_RESPONSE);

    expect(collections.map((c) => c.name)).toEqual(['Article', '_User']);

    const article = collections[0];
    expect(article.primaryKey).toBe('objectId');
    expect(article.isSystem).toBe(false);

    const byName = Object.fromEntries(article.fields.map((f) => [f.name, f]));
    expect(byName.title.type).toBe('string');
    expect(byName.views.type).toBe('number');
    expect(byName.published.type).toBe('boolean');
    expect(byName.publishedAt.type).toBe('dateTime');
    expect(byName.payload.type).toBe('json');
    expect(byName.cover.type).toBe('json');
    expect(byName.objectId.primaryKey).toBe(true);
    // The native Parse type is kept so an adapter can still see what it really was
    expect(byName.publishedAt.nativeType).toBe('Date');
  });

  it('carries Pointer and Relation targets so relation traversal can find them', () => {
    const [article] = SchemaPorts.collectionsFromParseClasses(PARSE_SCHEMAS_RESPONSE);
    const byName = Object.fromEntries(article.fields.map((f) => [f.name, f]));

    expect(byName.author.relationTarget).toBe('Author');
    expect(byName.author.relationType).toBe('many-to-one');
    // A Relation is a record SET — traversable relations are M2O/O2O only
    expect(byName.tags.relationType).toBe('many-to-many');
    expect(byName.tags.type).toBe('relation');
  });

  it('hides the ACL — it is access control, not data', () => {
    const [article] = SchemaPorts.collectionsFromParseClasses(PARSE_SCHEMAS_RESPONSE);
    const acl = article.fields.find((f) => f.name === 'ACL');
    expect(acl.hidden).toBe(true);
    expect(SchemaPorts.shouldShowField(acl)).toBe(false);
  });

  it('marks a leading-underscore class as a system class', () => {
    const collections = SchemaPorts.collectionsFromParseClasses(PARSE_SCHEMAS_RESPONSE);
    expect(collections[1].isSystem).toBe(true);
  });

  it('accepts BOTH Parse shapes — GET /schemas and the legacy dbCollections metadata', () => {
    const fromMetadata = SchemaPorts.collectionsFromParseClasses(DB_COLLECTIONS_METADATA);

    expect(fromMetadata).toHaveLength(1);
    expect(fromMetadata[0].name).toBe('Article');
    const author = fromMetadata[0].fields.find((f) => f.name === 'author');
    expect(author.relationTarget).toBe('Author');
    expect(author.relationType).toBe('many-to-one');
  });

  it('accepts our own backend’s /api/_schema envelope — the THIRD Parse-typed shape', () => {
    // nodegx-backend does not implement /schemas at all (parse-wire.ts header);
    // GET /api/_schema answers {tables:[{name, columns}]} with the same type names.
    const collections = SchemaPorts.collectionsFromParseClasses({
      tables: [
        {
          name: 'Article',
          columns: [
            { name: 'objectId', type: 'String' },
            { name: 'views', type: 'Number' },
            { name: 'author', type: 'Pointer', targetClass: 'Author' }
          ]
        }
      ]
    });

    expect(collections.map((c) => c.name)).toEqual(['Article']);
    const byName = Object.fromEntries(collections[0].fields.map((f) => [f.name, f]));
    expect(byName.views.type).toBe('number');
    expect(byName.author.relationType).toBe('many-to-one');
  });

  it('returns nothing for junk rather than throwing', () => {
    expect(SchemaPorts.collectionsFromParseClasses(undefined)).toEqual([]);
    expect(SchemaPorts.collectionsFromParseClasses({})).toEqual([]);
    expect(SchemaPorts.collectionsFromParseClasses([{ fields: {} }])).toEqual([]);
  });

  it('falls back to the legacy dbCollections cache for a Parse-wire backend', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: {
          activeBackendId: 'p1',
          backends: [{ id: 'p1', name: 'Built-in', type: 'nodegx', url: 'http://localhost:8577' }]
        },
        dbCollections: DB_COLLECTIONS_METADATA,
        systemCollections: [{ name: '_User', schema: { properties: { username: { type: 'String' } } } }]
      }),
      parameters: { collection: 'Article' }
    });

    expect(ctx.source).toBe('dbCollections');
    expect(ctx.collections.map((c) => c.name)).toEqual(['Article', '_User']);
    expect(ctx.selectedCollection.name).toBe('Article');
  });

  it('never feeds Parse classes to a non-Parse backend with an empty schema cache', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: {
          activeBackendId: 'd1',
          backends: [{ id: 'd1', name: 'Directus', type: 'directus', url: 'http://localhost:8055' }]
        },
        dbCollections: DB_COLLECTIONS_METADATA
      }),
      parameters: {}
    });

    expect(ctx.collections).toEqual([]);
    expect(ctx.source).toBe('none');
  });

  it('prefers a real backendServices schema over the legacy cache', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: {
          activeBackendId: 'p1',
          backends: [
            { id: 'p1', name: 'Built-in', type: 'nodegx', url: 'x', schema: { collections: [CACHED_COLLECTION] } }
          ]
        },
        dbCollections: DB_COLLECTIONS_METADATA
      }),
      parameters: {}
    });

    expect(ctx.source).toBe('backendServices');
    expect(ctx.collections.map((c) => c.name)).toEqual(['articles']);
  });
});

describe('fieldPorts — RUN-003 fix 1: both field shapes must reach the PORTS', () => {
  function portsFor(collection, options) {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({ backendServices: backendServicesWith([collection, AUTHORS_COLLECTION]) }),
      parameters: { collection: collection.name }
    });
    return SchemaPorts.fieldPorts(ctx, options);
  }

  it('CACHED shape (what the nodes actually receive): builds an enum dropdown from enumValues', () => {
    const status = portsFor(CACHED_COLLECTION).find((p) => p.name === 'field_status');

    expect(status.type).toEqual({
      name: 'enum',
      enums: [
        { label: 'draft', value: 'draft' },
        { label: 'published', value: 'published' }
      ],
      allowEditOnly: false
    });
  });

  it('CACHED shape: skips a field whose parsed hidden flag is set', () => {
    const names = portsFor(CACHED_COLLECTION).map((p) => p.name);
    expect(names).not.toContain('field_secret_note');
  });

  it('RAW Directus shape: builds the dropdown from meta.options.choices and skips meta.hidden', () => {
    const ports = portsFor(RAW_DIRECTUS_COLLECTION);
    const names = ports.map((p) => p.name);

    expect(ports.find((p) => p.name === 'field_status').type).toEqual({
      name: 'enum',
      enums: [{ label: 'Draft', value: 'draft' }],
      allowEditOnly: false
    });
    expect(names).not.toContain('field_secret_note');
    expect(names).not.toContain('field_divider');
  });

  it('maps the remaining column types onto port types', () => {
    const ports = portsFor(CACHED_COLLECTION);
    const byName = Object.fromEntries(ports.map((p) => [p.name, p]));

    expect(byName.field_title.type).toBe('string');
    expect(byName.field_payload.type).toBe('object');
    expect(byName.field_published_at.type).toBe('string');
    // Nothing is read-only by default — the caller says which columns the server owns
    expect(byName.field_id.type).toBe('number');
  });

  it('gives a neutral `number` column a number port — Supabase and Parse both spell it that way', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: backendServicesWith([
          { name: 'metrics', fields: [{ name: 'score', type: 'number' }, { name: 'rank', type: 'integer' }] }
        ])
      }),
      parameters: { collection: 'metrics' }
    });

    expect(SchemaPorts.fieldPorts(ctx).map((p) => p.type)).toEqual(['number', 'number']);
  });

  it('skips the read-only columns it is given, and nothing else', () => {
    const names = portsFor(CACHED_COLLECTION, { readOnlyFields: ['id', 'published_at'] }).map((p) => p.name);
    expect(names).toEqual(['field_title', 'field_status', 'field_payload', 'field_author']);
  });

  it('takes the Record family’s prefix and group as well as BYOB’s', () => {
    const [first] = portsFor(CACHED_COLLECTION, { prefix: 'prop-', group: 'Properties', readOnlyFields: ['id'] });
    expect(first.name).toBe('prop-title');
    expect(first.group).toBe('Properties');
  });

  it('can skip relation columns — a Pointer is not a scalar the user types', () => {
    const names = portsFor(CACHED_COLLECTION, { skipRelations: true }).map((p) => p.name);
    expect(names).not.toContain('field_author');
  });

  it('produces nothing when no collection is selected', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({ backendServices: backendServicesWith([CACHED_COLLECTION]) }),
      parameters: {}
    });
    expect(SchemaPorts.fieldPorts(ctx)).toEqual([]);
  });

  it('builds enum ports for a PARSE backend too — the point of step 4', () => {
    const ctx = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: {
          activeBackendId: 'p1',
          backends: [
            {
              id: 'p1',
              name: 'Built-in',
              type: 'nodegx',
              url: 'x',
              schema: {
                collections: SchemaPorts.collectionsFromParseClasses({
                  results: [
                    {
                      className: 'Article',
                      fields: {
                        objectId: { type: 'String' },
                        createdAt: { type: 'Date' },
                        updatedAt: { type: 'Date' },
                        ACL: { type: 'ACL' },
                        title: { type: 'String' },
                        views: { type: 'Number' }
                      }
                    }
                  ]
                })
              }
            }
          ]
        }
      }),
      parameters: { collection: 'Article' }
    });

    const ports = SchemaPorts.fieldPorts(ctx, {
      prefix: 'prop-',
      group: 'Properties',
      readOnlyFields: SchemaPorts.PARSE_READONLY_FIELDS
    });

    // The server owns objectId/createdAt/updatedAt, and ACL is hidden besides
    expect(ports.map((p) => p.name)).toEqual(['prop-title', 'prop-views']);
    expect(ports[1].type).toBe('number');
  });
});

describe('the other port builders', () => {
  const ctx = () =>
    SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({ backendServices: backendServicesWith([CACHED_COLLECTION, AUTHORS_COLLECTION]) }),
      parameters: { collection: 'articles' }
    });

  it('backendPickerPorts lists Active Backend first, then every configured backend', () => {
    const [port] = SchemaPorts.backendPickerPorts(ctx());
    expect(port.name).toBe('backendId');
    expect(port.default).toBe('_active_');
    expect(port.type.enums).toEqual([
      { label: 'Active Backend', value: '_active_' },
      { label: 'Local Directus', value: 'b1' },
      { label: 'Other', value: 'b2' }
    ]);
  });

  it('backendPickerPorts can hide itself in a single-backend project', () => {
    const single = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: { activeBackendId: 'b1', backends: [{ id: 'b1', name: 'Only', type: 'directus', url: 'x' }] }
      }),
      parameters: {}
    });

    expect(SchemaPorts.backendPickerPorts(single, { hideWhenSingleBackend: true })).toEqual([]);
    expect(SchemaPorts.backendPickerPorts(single)).toHaveLength(1);
  });

  it('collectionPorts filters by the Directus items/system split', () => {
    const withSystem = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({
        backendServices: backendServicesWith([CACHED_COLLECTION, { name: 'directus_users', fields: [] }])
      }),
      parameters: { collection: 'directus_users' }
    });

    const [systemPort] = SchemaPorts.collectionPorts(withSystem);
    expect(systemPort.type.enums.map((e) => e.value)).toEqual(['', 'directus_users']);

    const [itemsPort] = SchemaPorts.collectionPorts(ctx());
    expect(itemsPort.type.enums.map((e) => e.value)).toEqual(['', 'articles', 'authors']);
  });

  it('collectionPorts takes the Record family’s extra system classes and its own port name', () => {
    const [port] = SchemaPorts.collectionPorts(ctx(), {
      name: 'collectionName',
      displayName: 'Class',
      group: 'General',
      placeholderLabel: null,
      filterByApiPathMode: false,
      extraEnums: [
        { label: 'User', value: '_User' },
        { label: 'Role', value: '_Role' }
      ]
    });

    expect(port.name).toBe('collectionName');
    expect(port.displayName).toBe('Class');
    expect(port.type.enums.map((e) => e.value)).toEqual(['_User', '_Role', 'articles', 'authors']);
  });

  it('relationIncludePorts offers one toggle per traversable relation whose target we have', () => {
    const ports = SchemaPorts.relationIncludePorts(ctx());
    expect(ports).toHaveLength(1);
    expect(ports[0].name).toBe('include_author');
    expect(ports[0].type).toBe('boolean');
    expect(ports[0].default).toBe(false);
    expect(ports[0].tooltip).toContain('Authors');
  });

  it('getFilterFields appends the one-hop dotted relation paths, hidden fields excluded', () => {
    const names = SchemaPorts.getFilterFields(ctx()).map((f) => f.name);

    expect(names).toContain('title');
    expect(names).toContain('author.name');
    expect(names).toContain('author.tier');
    expect(names).not.toContain('author.internal');
    expect(names.some((n) => n.split('.').length > 2)).toBe(false);
  });

  it('apiPathModePorts defaults to system for a directus_ collection', () => {
    const system = SchemaPorts.resolveSchemaPortContext({
      graphModel: graphModelWith({ backendServices: backendServicesWith([]) }),
      parameters: { collection: 'directus_users' }
    });

    expect(SchemaPorts.apiPathModePorts(system)[0].default).toBe('system');
    expect(SchemaPorts.apiPathModePorts(ctx())[0].default).toBe('items');
  });
});

describe('sendSchemaPorts — RUN-003 fix 2: a static port is never re-announced as a dynamic one', () => {
  /** The shape of a node definition, as `staticPortNames` reads it. */
  const nodeDefinition = {
    inputs: { fetch: { type: 'signal' } },
    outputs: {
      records: { type: 'array' },
      count: { type: 'number' },
      success: { type: 'signal' }
    }
  };

  beforeEach(() => {
    jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    console.warn.mockRestore();
  });

  it('derives the static names from the node definition rather than a hand-kept list', () => {
    expect(SchemaPorts.staticPortNames(nodeDefinition)).toEqual({
      inputs: ['fetch'],
      outputs: ['records', 'count', 'success']
    });
    expect(SchemaPorts.staticPortNames({})).toEqual({ inputs: [], outputs: [] });
  });

  it('drops a generated output that the node already declares statically — the doubled-port defect', () => {
    const kept = SchemaPorts.dedupeSchemaPorts(
      [
        { name: 'collection', plug: 'input', type: 'string' },
        { name: 'records', plug: 'output', type: 'array' },
        { name: 'count', plug: 'output', type: 'number' }
      ],
      SchemaPorts.staticPortNames(nodeDefinition)
    );

    expect(kept.map((p) => p.name)).toEqual(['collection']);
    expect(console.warn).toHaveBeenCalledTimes(2);
  });

  it('drops a generated input that collides with a static signal input', () => {
    const kept = SchemaPorts.dedupeSchemaPorts(
      [
        { name: 'fetch', plug: 'input', type: 'signal' },
        { name: 'limit', plug: 'input', type: 'number' }
      ],
      SchemaPorts.staticPortNames(nodeDefinition)
    );

    expect(kept.map((p) => p.name)).toEqual(['limit']);
  });

  it('keeps an input and an output that merely share a name', () => {
    const kept = SchemaPorts.dedupeSchemaPorts([
      { name: 'value', plug: 'input', type: 'string' },
      { name: 'value', plug: 'output', type: 'string' }
    ]);
    expect(kept).toHaveLength(2);
  });

  it('drops a port pushed twice by two builders, keeping the first', () => {
    const kept = SchemaPorts.dedupeSchemaPorts([
      { name: 'collection', plug: 'input', type: 'string', group: 'first' },
      { name: 'collection', plug: 'input', type: 'string', group: 'second' }
    ]);

    expect(kept).toHaveLength(1);
    expect(kept[0].group).toBe('first');
  });

  it('sends the deduplicated list, never the raw one', () => {
    const editorConnection = { sendDynamicPorts: jest.fn() };

    const sent = SchemaPorts.sendSchemaPorts(
      editorConnection,
      'node-1',
      [
        { name: 'collection', plug: 'input', type: 'string' },
        { name: 'records', plug: 'output', type: 'array' }
      ],
      { staticPorts: SchemaPorts.staticPortNames(nodeDefinition) }
    );

    expect(editorConnection.sendDynamicPorts).toHaveBeenCalledWith('node-1', sent);
    expect(sent.map((p) => p.name)).toEqual(['collection']);
  });

  it('ignores a nameless port rather than announcing it', () => {
    expect(SchemaPorts.dedupeSchemaPorts([undefined, {}, { name: 'ok', plug: 'input' }])).toEqual([
      { name: 'ok', plug: 'input' }
    ]);
  });
});
