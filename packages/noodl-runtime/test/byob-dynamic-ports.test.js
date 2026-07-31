/**
 * The data nodes' dynamic ports, observed through their real `setup` hooks — the four
 * BYOB nodes (BCN-004 step 4) and, from step 5, the six Record nodes that now build
 * their ports from the same generator.
 *
 * ⚠️ **This exists because the generated catalog cannot check these nodes.** The
 * BCN-004 spec names the catalog as the guard against the doubled-port defect
 * ("`updatePorts` once re-pushed every static output as a dynamic port, so
 * `getPorts()` listed each output twice … the generated catalog is the check").
 * It is not, for this family: every `noodl.byob.*` entry in `node-catalog.json`
 * records `parameterEncoding.known: false` — *"No parameter on this node carries
 * the list its ports are generated from, so the port set could not be observed
 * headlessly."* Their ports come from **project metadata** (`backendServices`),
 * which the catalog's observer does not seed. A doubled port would not show in a
 * catalog diff at all.
 *
 * So the observation happens here instead, and the same way the catalog does it
 * where it can: stand up the smallest graph model and editor connection the `setup`
 * hooks accept, hand them a node carrying real parameters and a real cached schema,
 * and record what `sendDynamicPorts` was called with. Testing `dedupeSchemaPorts`
 * alone would only prove the guard works — not that anything calls it.
 */

jest.mock('../noodl-runtime', () => ({
  instance: { getMetaData: jest.fn() }
}));

const QueryData = require('../src/nodes/std-library/data/byob-query-data');
const CreateRecord = require('../src/nodes/std-library/data/byob-create-record');
const UpdateRecord = require('../src/nodes/std-library/data/byob-update-record');
const DeleteRecord = require('../src/nodes/std-library/data/byob-delete-record');

const COLLECTIONS = [
  {
    name: 'articles',
    displayName: 'Articles',
    primaryKey: 'id',
    fields: [
      { name: 'id', displayName: 'id', type: 'integer', primaryKey: true },
      { name: 'title', displayName: 'Title', type: 'string' },
      { name: 'status', displayName: 'Status', type: 'string', enumValues: ['draft', 'published'] },
      { name: 'secret_note', displayName: 'Secret', type: 'string', hidden: true },
      { name: 'date_created', displayName: 'Created', type: 'dateTime' },
      {
        name: 'author',
        displayName: 'Author',
        type: 'integer',
        relationTarget: 'authors',
        relationType: 'many-to-one'
      }
    ]
  },
  {
    name: 'authors',
    displayName: 'Authors',
    primaryKey: 'id',
    fields: [
      { name: 'id', displayName: 'id', type: 'integer', primaryKey: true },
      { name: 'name', displayName: 'Name', type: 'string' }
    ]
  }
];

const BACKEND_SERVICES = {
  activeBackendId: 'b1',
  backends: [
    { id: 'b1', name: 'Local Directus', type: 'directus', url: 'http://localhost:8055', schema: { collections: COLLECTIONS } }
  ]
};

function makeEmitter() {
  const listeners = new Map();
  return {
    on(name, cb) {
      if (!listeners.has(name)) listeners.set(name, []);
      listeners.get(name).push(cb);
      return this;
    },
    off() {
      return this;
    },
    emit(name, ...args) {
      for (const cb of (listeners.get(name) || []).slice()) cb(...args);
      return this;
    }
  };
}

/**
 * Drive a node module's real `setup(context, graphModel)` and return the ports it
 * announced for a node carrying `parameters`.
 */
function observePorts(nodeModule, parameters, metadata = { backendServices: BACKEND_SERVICES }) {
  const sent = [];
  const editorConnection = {
    isRunningLocally: () => true,
    sendDynamicPorts: (nodeId, ports) => sent.push({ nodeId, ports }),
    sendWarning: () => {},
    clearWarning: () => {}
  };

  const nodeModel = Object.assign(makeEmitter(), {
    id: 'observed-node',
    type: nodeModule.node.name,
    parameters,
    component: { name: 'Test' }
  });

  const graphModel = Object.assign(makeEmitter(), {
    getMetaData: (key) => metadata[key],
    getNodesWithType: (type) => (type === nodeModule.node.name ? [nodeModel] : [])
  });

  nodeModule.setup({ editorConnection }, graphModel);
  graphModel.emit('editorImportComplete');

  // `filterdbmodelsnode` registers `nodeAdded` directly rather than waiting for
  // `editorImportComplete`, and so has no `getNodesWithType` sweep to catch it. Emitting
  // only when nothing was announced keeps the other nodes on their real path rather than
  // building their ports twice.
  if (sent.length === 0) graphModel.emit('nodeAdded.' + nodeModule.node.name, nodeModel);

  expect(sent.length).toBeGreaterThan(0);
  return sent[sent.length - 1].ports;
}

const NODES = [
  { label: 'Query Data', module: QueryData, params: { collection: 'articles' } },
  { label: 'Create Record', module: CreateRecord, params: { collection: 'articles' } },
  { label: 'Update Record', module: UpdateRecord, params: { collection: 'articles' } },
  { label: 'Delete Record', module: DeleteRecord, params: { collection: 'articles' } }
];

describe('the doubled-port defect (RUN-003 slice 8) stays fixed', () => {
  it.each(NODES)('$label announces no port twice', ({ module, params }) => {
    const ports = observePorts(module, params);
    const keys = ports.map((p) => `${p.plug}:${p.name}`);
    expect(keys).toEqual([...new Set(keys)]);
  });

  it.each(NODES)('$label announces no port the node already declares statically', ({ module, params }) => {
    const ports = observePorts(module, params);
    const staticInputs = Object.keys(module.node.inputs || {});
    const staticOutputs = Object.keys(module.node.outputs || {});

    for (const port of ports) {
      if (port.plug === 'output') expect(staticOutputs).not.toContain(port.name);
      else expect(staticInputs).not.toContain(port.name);
    }
  });

  it.each(NODES)('$label announces inputs only — every output of these nodes is static', ({ module, params }) => {
    const ports = observePorts(module, params);
    expect(ports.map((p) => p.plug)).toEqual(ports.map(() => 'input'));
  });

  it('a port generator that re-pushed a static output would be caught', () => {
    // The guard is real rather than vacuous: feed the same node a list that HAS the
    // defect and the send drops it.
    const SchemaPorts = require('../src/nodes/std-library/data/schema-ports');
    const editorConnection = { sendDynamicPorts: jest.fn() };
    jest.spyOn(console, 'warn').mockImplementation(() => {});

    SchemaPorts.sendSchemaPorts(
      editorConnection,
      'n',
      [
        { name: 'collection', plug: 'input', type: 'string' },
        { name: 'records', plug: 'output', type: 'array' }
      ],
      { staticPorts: SchemaPorts.staticPortNames(QueryData.node) }
    );

    expect(editorConnection.sendDynamicPorts.mock.calls[0][1].map((p) => p.name)).toEqual(['collection']);
    console.warn.mockRestore();
  });
});

describe('the port sets survived the move to the shared generator', () => {
  it('Query Data: backend, path mode, collection, query, pagination, relation includes', () => {
    const ports = observePorts(QueryData, { collection: 'articles' });

    expect(ports.map((p) => p.name)).toEqual([
      'backendId',
      'apiPathMode',
      'collection',
      'filter',
      'sortField',
      'sortOrder',
      'limit',
      'offset',
      'fields',
      'live',
      'include_author'
    ]);
  });

  it('Query Data: the filter builder gets the collection’s fields plus the dotted relation paths', () => {
    const ports = observePorts(QueryData, { collection: 'articles' });
    const filter = ports.find((p) => p.name === 'filter');

    expect(filter.type.name).toBe('byob-filter');
    expect(filter.type.schema.collection).toBe('articles');
    expect(filter.type.schema.fields.map((f) => f.name)).toContain('author.name');
  });

  it('Query Data: one filter_ port per condition whose value is wired', () => {
    const ports = observePorts(QueryData, {
      collection: 'articles',
      filter: JSON.stringify({
        type: 'and',
        conditions: [
          { type: 'equals', field: 'title', valueSource: 'connected', valuePortName: 'filter_title_1' },
          { type: 'equals', field: 'status', valueSource: 'literal', value: 'draft' }
        ]
      })
    });

    const filterPorts = ports.filter((p) => p.name.startsWith('filter_'));
    expect(filterPorts.map((p) => p.name)).toEqual(['filter_title_1']);
    expect(filterPorts[0].group).toBe('Filter Values');
  });

  it('Create Record: one port per writable column, hidden and server-owned columns skipped', () => {
    const ports = observePorts(CreateRecord, { collection: 'articles' });

    expect(ports.map((p) => p.name)).toEqual([
      'backendId',
      'apiPathMode',
      'collection',
      'field_title',
      'field_status',
      'field_author'
    ]);
    // The enum dropdown reaches the port from the CACHED field shape — RUN-003's seam
    expect(ports.find((p) => p.name === 'field_status').type.name).toBe('enum');
  });

  it('Update Record: the same, plus Record ID; its read-only list is one entry shorter than Create’s', () => {
    const ports = observePorts(UpdateRecord, { collection: 'articles' });

    expect(ports.map((p) => p.name)).toEqual([
      'backendId',
      'apiPathMode',
      'collection',
      'recordId',
      'field_title',
      'field_status',
      'field_author'
    ]);
  });

  it('Update Record may write date_updated, which Create may not', () => {
    const collections = [
      {
        name: 'articles',
        fields: [
          { name: 'date_created', type: 'dateTime' },
          { name: 'date_updated', type: 'dateTime' }
        ]
      }
    ];
    const metadata = {
      backendServices: {
        activeBackendId: 'b1',
        backends: [{ id: 'b1', name: 'D', type: 'directus', url: 'x', schema: { collections } }]
      }
    };

    const created = observePorts(CreateRecord, { collection: 'articles' }, metadata).map((p) => p.name);
    const updated = observePorts(UpdateRecord, { collection: 'articles' }, metadata).map((p) => p.name);

    expect(created).not.toContain('field_date_updated');
    expect(updated).toContain('field_date_updated');
    expect(updated).not.toContain('field_date_created');
  });

  it('Delete Record: identification only', () => {
    const ports = observePorts(DeleteRecord, { collection: 'articles' });
    expect(ports.map((p) => p.name)).toEqual(['backendId', 'apiPathMode', 'collection', 'recordId']);
  });

  it('every node still offers the backend picker with the Active Backend sentinel first', () => {
    for (const { module, params } of NODES) {
      const picker = observePorts(module, params).find((p) => p.name === 'backendId');
      expect(picker.default).toBe('_active_');
      expect(picker.type.enums[0]).toEqual({ label: 'Active Backend', value: '_active_' });
    }
  });

  it('a project with no backend metadata still gets the three configuration ports', () => {
    const ports = observePorts(DeleteRecord, {}, {});
    expect(ports.map((p) => p.name)).toEqual(['backendId', 'apiPathMode', 'collection', 'recordId']);
    expect(ports.find((p) => p.name === 'collection').type.enums).toEqual([
      { label: '(Select collection)', value: '' }
    ]);
  });
});

describe('a Parse-wire backend drives the same generator', () => {
  const PARSE_METADATA = {
    backendServices: {
      activeBackendId: 'p1',
      backends: [{ id: 'p1', name: 'Built-in', type: 'nodegx', url: 'http://localhost:8577' }]
    },
    dbCollections: [
      {
        name: 'Article',
        schema: {
          properties: {
            objectId: { type: 'String' },
            title: { type: 'String' },
            views: { type: 'Number' },
            author: { type: 'Pointer', targetClass: 'Author' }
          }
        }
      },
      { name: 'Author', schema: { properties: { objectId: { type: 'String' }, name: { type: 'String' } } } }
    ]
  };

  it('offers the Parse classes in the collection dropdown', () => {
    const ports = observePorts(DeleteRecord, { collection: 'Article' }, PARSE_METADATA);
    const collection = ports.find((p) => p.name === 'collection');
    expect(collection.type.enums.map((e) => e.value)).toEqual(['', 'Article', 'Author']);
  });

  it('builds one field port per Parse column, with the right port types', () => {
    const ports = observePorts(CreateRecord, { collection: 'Article' }, PARSE_METADATA);
    const byName = Object.fromEntries(ports.map((p) => [p.name, p]));

    expect(byName.field_title.type).toBe('string');
    expect(byName.field_views.type).toBe('number');
    // `objectId` is not in BYOB's read-only list (that list is Directus-shaped), so it
    // still gets a port here — the Record family passes PARSE_READONLY_FIELDS instead.
    expect(byName.field_objectId).toBeDefined();
  });

  it('offers an Include toggle for a Pointer, since a Pointer is a many-to-one relation', () => {
    const ports = observePorts(QueryData, { collection: 'Article' }, PARSE_METADATA);
    expect(ports.map((p) => p.name)).toContain('include_author');
  });
});

// ===========================================================================
// BCN-004 step 5 — the six Record nodes, through the same generator
// ===========================================================================

const DbModel2 = require('../src/nodes/std-library/data/dbmodelnode2');
const DbCollection2 = require('../src/nodes/std-library/data/dbcollectionnode2');
const NewRecord = require('../src/nodes/std-library/data/newdbmodelpropertiesnode');
const SetRecord = require('../src/nodes/std-library/data/setdbmodelpropertiesnode');
const DeleteRecordProps = require('../src/nodes/std-library/data/deletedbmodelpropertiesnode');
const FilterRecords = require('../src/nodes/std-library/data/filterdbmodelsnode');

/** The legacy Parse metadata a project holds today, in its own three-key shape. */
const PARSE_CLASSES = [
  {
    name: 'Article',
    schema: {
      properties: {
        objectId: { type: 'String' },
        title: { type: 'String' },
        views: { type: 'Number' },
        published: { type: 'Boolean' },
        publishedAt: { type: 'Date' },
        author: { type: 'Pointer', targetClass: 'Author' },
        tags: { type: 'Relation', targetClass: 'Tag' },
        payload: { type: 'Object' }
      }
    }
  },
  { name: 'Author', schema: { properties: { objectId: { type: 'String' }, name: { type: 'String' } } } }
];

/** One backend: the project's `cloudservices` endpoint. The picker must be invisible. */
const ONE_BACKEND = {
  cloudservices: { endpoint: 'http://localhost:8577', appId: 'app-id', type: 'nodegx' },
  dbCollections: PARSE_CLASSES,
  systemCollections: []
};

/** Two backends: the same endpoint plus a Directus. The picker must appear. */
const TWO_BACKENDS = Object.assign({}, ONE_BACKEND, {
  backendServices: {
    activeBackendId: 'd1',
    backends: [
      { id: 'd1', name: 'Local Directus', type: 'directus', url: 'http://localhost:8055', schema: { collections: COLLECTIONS } }
    ]
  }
});

const RECORD_NODES = [
  { label: 'Record', module: DbModel2, params: { collectionName: 'Article' } },
  { label: 'Query Records', module: DbCollection2, params: { collectionName: 'Article' } },
  { label: 'Create New Record', module: NewRecord, params: { collectionName: 'Article' } },
  { label: 'Set Record Properties', module: SetRecord, params: { collectionName: 'Article' } },
  { label: 'Delete Record', module: DeleteRecordProps, params: { collectionName: 'Article' } },
  { label: 'Filter Records', module: FilterRecords, params: { collectionName: 'Article' } }
];

describe('BCN-004 step 5: the Record family announces no doubled or static-shadowing port', () => {
  it.each(RECORD_NODES)('$label announces no port twice', ({ module, params }) => {
    const ports = observePorts(module, params, TWO_BACKENDS);
    const keys = ports.map((p) => `${p.plug}:${p.name}`);
    expect(keys).toEqual([...new Set(keys)]);
  });

  it.each(RECORD_NODES)('$label announces no port it already declares statically', ({ module, params }) => {
    const ports = observePorts(module, params, TWO_BACKENDS);
    const staticInputs = Object.keys(module.node.inputs || {});
    const staticOutputs = Object.keys(module.node.outputs || {});

    for (const port of ports) {
      if (port.plug === 'output') expect(staticOutputs).not.toContain(port.name);
      else expect(staticInputs).not.toContain(port.name);
    }
  });
});

describe('BCN-004 step 5: the backend picker and its hide-when-one rule', () => {
  it.each(RECORD_NODES)('$label hides the picker when the project has one backend', ({ module, params }) => {
    const ports = observePorts(module, params, ONE_BACKEND);
    expect(ports.map((p) => p.name)).not.toContain('backendId');
  });

  it.each(RECORD_NODES)('$label shows the picker when the project has two', ({ module, params }) => {
    const picker = observePorts(module, params, TWO_BACKENDS).find((p) => p.name === 'backendId');
    expect(picker).toBeDefined();
    expect(picker.default).toBe('_active_');
    expect(picker.plug).toBe('input');
  });

  it('the picker lists the cloudservices endpoint, which is in no backendServices entry', () => {
    const picker = observePorts(DbModel2, { collectionName: 'Article' }, TWO_BACKENDS).find(
      (p) => p.name === 'backendId'
    );

    // ⚠️ The whole reason `extraBackends` exists: without the endpoint entry the project
    // reads as one backend, the picker hides, and every Record node silently moves onto
    // Directus.
    expect(picker.type.enums).toEqual([
      { label: 'Active Backend', value: '_active_' },
      { label: 'app-id', value: '_endpoint_' },
      { label: 'Local Directus', value: 'd1' }
    ]);
  });

  it('a project with a Directus backend and no endpoint counts one, and hides the picker', () => {
    const ports = observePorts(DbModel2, { collectionName: 'articles' }, { backendServices: BACKEND_SERVICES });
    expect(ports.map((p) => p.name)).not.toContain('backendId');
    // …and the single backend is the default, so its schema still drives the ports.
    expect(ports.map((p) => p.name)).toContain('prop-title');
  });
});

describe('BCN-004 step 5: the Class dropdown comes from the selected backend', () => {
  it('a Parse-wire backend still offers _User and _Role beside the project classes', () => {
    const collection = observePorts(DbModel2, {}, ONE_BACKEND).find((p) => p.name === 'collectionName');

    expect(collection.displayName).toBe('Class');
    expect(collection.type.enums.map((e) => e.value)).toEqual(['_User', '_Role', 'Article', 'Author']);
  });

  it('_User is not offered twice when introspection has already reported it', () => {
    const metadata = Object.assign({}, ONE_BACKEND, {
      systemCollections: [{ name: '_User', schema: { properties: { username: { type: 'String' } } } }]
    });
    const collection = observePorts(DbModel2, {}, metadata).find((p) => p.name === 'collectionName');

    expect(collection.type.enums.map((e) => e.value)).toEqual(['_Role', 'Article', 'Author', '_User']);
  });

  it('a Directus backend offers its tables and neither Parse system class', () => {
    const collection = observePorts(DbModel2, { backendId: 'd1' }, TWO_BACKENDS).find(
      (p) => p.name === 'collectionName'
    );

    expect(collection.type.enums.map((e) => e.value)).toEqual(['articles', 'authors']);
  });
});

describe('BCN-004 step 5: the property ports', () => {
  it('Record publishes them as OUTPUTS, each with its Changed signal, and no Relation column', () => {
    const ports = observePorts(DbModel2, { collectionName: 'Article' }, ONE_BACKEND);
    const byName = Object.fromEntries(ports.map((p) => [p.name, p]));

    expect(byName['prop-title'].plug).toBe('output');
    expect(byName['changed-title'].type).toBe('signal');
    // Relations are reached through Add/Remove Relation, not as a port.
    expect(byName['prop-tags']).toBeUndefined();
    // A Pointer is not a Relation and keeps its port.
    expect(byName['prop-author']).toBeDefined();
  });

  it('Create and Set publish them as INPUTS, and keep the Relation column they always had', () => {
    for (const module of [NewRecord, SetRecord]) {
      const ports = observePorts(module, { collectionName: 'Article' }, ONE_BACKEND);
      const byName = Object.fromEntries(ports.map((p) => [p.name, p]));

      expect(byName['prop-title'].plug).toBe('input');
      expect(byName['prop-tags']).toBeDefined();
      expect(byName['changed-title']).toBeUndefined();
    }
  });

  it('Delete Record publishes none — it identifies a record, it does not describe one', () => {
    const ports = observePorts(DeleteRecordProps, { collectionName: 'Article' }, ONE_BACKEND);
    expect(ports.filter((p) => p.name.startsWith('prop-'))).toEqual([]);
  });

  it('⚠️ the Parse port types are unchanged, which is the no-regression rule', () => {
    const ports = observePorts(NewRecord, { collectionName: 'Article' }, ONE_BACKEND);
    const byName = Object.fromEntries(ports.map((p) => [p.name, p]));

    // `getEnhancedFieldType` would say `string` + a placeholder for a Date and `string`
    // for a Pointer. Re-typing a shipped port drops the wires attached to it, so the
    // family's own table still decides for a Parse-typed column.
    expect(byName['prop-title'].type).toEqual({ name: 'string' });
    expect(byName['prop-views'].type).toEqual({ name: 'number' });
    expect(byName['prop-published'].type).toEqual({ name: 'boolean' });
    expect(byName['prop-publishedAt'].type).toEqual({ name: 'date' });
    expect(byName['prop-author'].type).toEqual({ name: '*' });
    expect(byName['prop-payload'].type).toEqual({ name: '*' });
  });

  it('a Directus column gets the enhanced types instead — from the CACHED field shape', () => {
    const ports = observePorts(NewRecord, { backendId: 'd1', collectionName: 'articles' }, TWO_BACKENDS);
    const byName = Object.fromEntries(ports.map((p) => [p.name, p]));

    // RUN-003's seam: the nodes receive the parsed `SchemaField`, not raw Directus `meta`.
    expect(byName['prop-status'].type.name).toBe('enum');
    expect(byName['prop-status'].type.enums.map((e) => e.value)).toEqual(['draft', 'published']);
    // …and a hidden column never reaches a port at all.
    expect(byName['prop-secret_note']).toBeUndefined();
    // The `number` fix from step 4 rides along.
    expect(byName['prop-id'].type).toBe('number');
  });
});

describe('BCN-004 step 5: the filter builder is handed the right schema and the right backend', () => {
  it('Query Records gets the Parse shape, with the reverse relation scan, for a Parse backend', () => {
    const metadata = Object.assign({}, ONE_BACKEND, {
      dbCollections: PARSE_CLASSES.concat([
        { name: 'Tag', schema: { properties: { name: { type: 'String' }, items: { type: 'Relation', targetClass: 'Article' } } } }
      ])
    });
    const filter = observePorts(DbCollection2, { collectionName: 'Article' }, metadata).find(
      (p) => p.name === 'visualFilter'
    );

    expect(filter.type.schema.properties.title).toEqual({ type: 'String' });
    expect(filter.type.schema.properties.author).toEqual({ type: 'Pointer', targetClass: 'Author' });
    // "which Articles is this Tag related to" — the rule, not the column.
    expect(filter.type.schema.relations).toEqual({ Tag: [{ property: 'items' }] });
    expect(filter.type.backend).toBe('nodegx');
  });

  it('Query Records gets the BYOB shape, and its own backend type, for a Directus backend', () => {
    const filter = observePorts(DbCollection2, { backendId: 'd1', collectionName: 'articles' }, TWO_BACKENDS).find(
      (p) => p.name === 'visualFilter'
    );

    expect(filter.type.schema.collection).toBe('articles');
    expect(filter.type.schema.fields.map((f) => f.name)).toContain('author.name');
    // ⚠️ Before step 5 this said `nodegx` for every backend, so a Directus filter was
    // offered the Parse operator list.
    expect(filter.type.backend).toBe('directus');
  });

  it('Filter Records prunes the Parse types its matcher cannot ask questions about', () => {
    const filter = observePorts(FilterRecords, { collectionName: 'Article' }, ONE_BACKEND).find(
      (p) => p.name === 'visualFilter'
    );

    expect(Object.keys(filter.type.schema.properties).sort()).toEqual([
      'author',
      'objectId',
      'published',
      'publishedAt',
      'title',
      'views'
    ]);
  });

  it('a class with no schema declares no filter port rather than an empty one', () => {
    const ports = observePorts(DbCollection2, { collectionName: 'Nonexistent' }, ONE_BACKEND);
    expect(ports.map((p) => p.name)).not.toContain('visualFilter');
  });

  it('the PLAT-003 TypeError is gone: a selected class with no metadata at all', () => {
    expect(() => observePorts(FilterRecords, { collectionName: 'Article' }, {})).not.toThrow();
  });
});
