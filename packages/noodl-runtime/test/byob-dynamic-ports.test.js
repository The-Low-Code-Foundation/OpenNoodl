/**
 * The four BYOB nodes' dynamic ports, observed through their real `setup` hooks
 * (BCN-004 step 4).
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
