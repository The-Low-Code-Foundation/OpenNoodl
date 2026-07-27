'use strict';

import type {
  CollectionLike,
  CollectionModule,
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  InspectInfo,
  ModelLike,
  ModelModule,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  RuntimeDiscoveredPort
} from '@noodl/types';

import Node = require('../../../node');
import CollectionImport = require('../../../collection');
import ModelImport = require('../../../model');
import CloudStore = require('../../../api/cloudstore');
import QueryUtils = require('../../../api/queryutils');

const Collection = CollectionImport as unknown as CollectionModule;
const Model = ModelImport as unknown as ModelModule;

/** One class in the project's `dbCollections` metadata. */
interface DbCollectionMeta {
  name: string;
  schema?: {
    properties?: Record<string, { type?: string; [extra: string]: unknown }>;
  };
}

/** A node in the editor's visual filter tree: either a group of rules or a leaf. */
interface VisualFilterQuery {
  rules?: VisualFilterQuery[];
  /** Present on a leaf whose value comes from a port rather than a literal. */
  input?: string;
}

/**
 * `this` inside the Filter Records node.
 *
 * It filters an array it is *given* — client-side, in memory — which is what separates it
 * from Query Records. The `filter` input decides whether it re-runs on its own: every
 * setter here consults `isInputConnected('filter')` and stays passive when something else
 * is driving it explicitly.
 */
interface FilterDbModelsInstance extends NodeInstance {
  _internal: {
    enabled?: boolean;
    collection?: CollectionLike;
    collectionName?: string;
    filteredCollection?: CollectionLike;
    filterSettings: Record<string, unknown>;
    filterParameters: Record<string, unknown>;
    visualFilter?: unknown;
    visualSorting?: unknown[];
    collectionChangedCallback?: () => void;
    cloudStoreEvents?: (args: { collection?: string; objectId?: string }) => void;
  };
  /** On the instance rather than in `_internal` — guards {@link scheduleFilter}. */
  collectionChangedScheduled?: boolean;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike | undefined): void;
  getLimit(): number | undefined;
  getSkip(): number | undefined;
  scheduleFilter(): void;
  setCollectionName(name: string): void;
  setVisualFilter(value: unknown): void;
  setVisualSorting(value: unknown[]): void;
  setFilterParameter(name: string, value: unknown): void;
}

const FilterDBModelsNode: NodeDefinitionOptions = {
  name: 'FilterDBModels',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/filter-records',
  displayNodeName: 'Filter Records',
  shortDesc: 'Filter, sort and limit array',
  category: 'Data',
  color: 'data',
  initialize: function (this: FilterDbModelsInstance) {
    const _this = this;

    this._internal.collectionChangedCallback = function () {
      if (_this.isInputConnected('filter') === true) return;

      _this.scheduleFilter();
    };

    this._internal.cloudStoreEvents = function (args: { collection?: string; objectId?: string }) {
      if (_this.isInputConnected('filter') === true) return;

      if (_this._internal.visualFilter === undefined) return;
      if (_this._internal.collection === undefined) return;
      if (args.collection !== _this._internal.collectionName) return;

      // Note this reaches for the *global* `Model` rather than `nodeScope.modelScope`,
      // unlike every other record lookup in this directory. Under a scoped store the
      // `contains` test therefore compares against a record from the wrong store and the
      // re-filter is skipped.
      if (args.objectId !== undefined && _this._internal.collection.contains(Model.get(args.objectId)))
        _this.scheduleFilter();
    };

    CloudStore.instance.on('save', this._internal.cloudStoreEvents);

    this._internal.enabled = true;
    this._internal.filterSettings = {};
    this._internal.filterParameters = {};
    //   this._internal.filteredCollection = Collection.get();
  },
  getInspectInfo(this: FilterDbModelsInstance): InspectInfo {
    const collection = this._internal.filteredCollection;

    if (!collection) {
      return { type: 'text', value: '[Not executed yet]' };
    }

    return [
      {
        type: 'text',
        value: 'Id: ' + collection.getId()
      },
      {
        type: 'value',
        value: collection.items
      }
    ];
  },
  inputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      set(this: FilterDbModelsInstance, value: unknown) {
        this.bindCollection(value as CollectionLike);
        if (this.isInputConnected('filter') === false) this.scheduleFilter();
      }
    },
    enabled: {
      type: 'boolean',
      group: 'General',
      displayName: 'Enabled',
      default: true,
      set: function (this: FilterDbModelsInstance, value: unknown) {
        this._internal.enabled = value as boolean;
        if (this.isInputConnected('filter') === false) this.scheduleFilter();
      }
    },
    filter: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Filter',
      valueChangedToTrue: function (this: FilterDbModelsInstance) {
        this.scheduleFilter();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      getter: function (this: FilterDbModelsInstance) {
        return this._internal.filteredCollection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Record Id',
      group: 'General',
      getter: function (this: FilterDbModelsInstance) {
        if (this._internal.filteredCollection !== undefined) {
          const firstItem = this._internal.filteredCollection.get(0);
          if (firstItem !== undefined) return firstItem.getId();
        }
      }
    },
    /*   firstItem:{
            type: 'object',
            displayName: 'First Item',
            group: 'General',
            getter: function () {
                if(this._internal.filteredCollection !== undefined) {
                    return this._internal.filteredCollection.get(0);
                }
            }
        },  */
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      getter: function (this: FilterDbModelsInstance) {
        return this._internal.filteredCollection ? this._internal.filteredCollection.size() : 0;
      }
    },
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Filtered'
    }
  },
  prototypeExtensions: {
    unbindCurrentCollection: function (this: FilterDbModelsInstance) {
      const collection = this._internal.collection;
      if (!collection) return;
      collection.off('change', this._internal.collectionChangedCallback);
      this._internal.collection = undefined;
    },
    bindCollection: function (this: FilterDbModelsInstance, collection: CollectionLike | undefined) {
      this.unbindCurrentCollection();
      this._internal.collection = collection;
      collection && collection.on('change', this._internal.collectionChangedCallback);
    },
    _onNodeDeleted: function (this: FilterDbModelsInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.unbindCurrentCollection();

      CloudStore.instance.off('save', this._internal.cloudStoreEvents);
    },
    /* getFilter: function () {
            const filterSettings = this._internal.filterSettings;

            const options = ['case'] // List all supported options here

            if (filterSettings['filterFilter']) {
                const filters = filterSettings['filterFilter'].split(',');
                var _filter = {};
                filters.forEach(function (f) {
                    var op = '$' + (filterSettings['filterFilterOp-' + f] || 'eq');
                    _filter[f] = {};
                    _filter[f][op] = filterSettings['filterFilterValue-' + f];

                    options.forEach((o) => {
                        var option = filterSettings['filterFilterOption-' + o + '-' + f];
                        if(option) _filter[f]['$' + o] =  option
                    })
                })
                return _filter;
            }
        },
        getSort: function() {
            const filterSettings = this._internal.filterSettings;

            if (filterSettings['filterSort']) {
                const sort = filterSettings['filterSort'].split(',');
                var _sort = {};
                sort.forEach(function (s) {
                    _sort[s] = filterSettings['filterSort-'+s] === 'descending'?-1:1;
                })
                return _sort;
            }
        },*/
    getLimit: function (this: FilterDbModelsInstance) {
      const filterSettings = this._internal.filterSettings;

      if (!filterSettings['filterEnableLimit']) return;
      else return (filterSettings['filterLimit'] as number) || 10;
    },
    getSkip: function (this: FilterDbModelsInstance) {
      const filterSettings = this._internal.filterSettings;

      if (!filterSettings['filterEnableLimit']) return;
      else return (filterSettings['filterSkip'] as number) || 0;
    },
    scheduleFilter: function (this: FilterDbModelsInstance) {
      if (this.collectionChangedScheduled) return;
      this.collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.collectionChangedScheduled = false;
        if (!this._internal.collection) return;

        // Apply filter and write to output collection
        let filtered: ModelLike[] = [].concat(this._internal.collection.items);

        if (this._internal.enabled) {
          const _filter = this._internal.visualFilter;
          if (_filter !== undefined) {
            const filter = QueryUtils.convertVisualFilter(_filter, {
              queryParameters: this._internal.filterParameters,
              collectionName: this._internal.collectionName
            });
            if (filter) filtered = filtered.filter((m) => QueryUtils.matchesQuery(m, filter));
          }

          // `sort` is declared outside the `if` deliberately: the original relied on `var`
          // hoisting to read it below the block it was assigned in (PLAT-003 NOTES §23.1).
          const _sort = this._internal.visualSorting;
          let sort: unknown;
          if (_sort !== undefined && _sort.length > 0) {
            sort = QueryUtils.convertVisualSorting(_sort);
          }
          if (sort) filtered.sort(QueryUtils.compareObjects.bind(this, sort));

          const skip = this.getSkip();
          if (skip) filtered = filtered.slice(skip, filtered.length);

          const limit = this.getLimit();
          if (limit) filtered = filtered.slice(0, limit);
        }

        this._internal.filteredCollection = Collection.create(filtered);

        this.sendSignalOnOutput('modified');
        this.flagOutputDirty('firstItemId');
        this.flagOutputDirty('items');
        this.flagOutputDirty('count');
      });
    },
    setCollectionName: function (this: FilterDbModelsInstance, name: string) {
      this._internal.collectionName = name;
    },
    setVisualFilter: function (this: FilterDbModelsInstance, value: unknown) {
      this._internal.visualFilter = value;

      if (this.isInputConnected('filter') === false) this.scheduleFilter();
    },
    setVisualSorting: function (this: FilterDbModelsInstance, value: unknown[]) {
      this._internal.visualSorting = value;

      if (this.isInputConnected('filter') === false) this.scheduleFilter();
    },
    setFilterParameter: function (this: FilterDbModelsInstance, name: string, value: unknown) {
      this._internal.filterParameters[name] = value;

      if (this.isInputConnected('filter') === false) this.scheduleFilter();
    },
    registerInputIfNeeded: function (this: FilterDbModelsInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'collectionName')
        return this.registerInput(name, {
          set: this.setCollectionName.bind(this)
        });

      if (name === 'visualFilter')
        return this.registerInput(name, {
          set: this.setVisualFilter.bind(this)
        });

      if (name === 'visualSorting')
        return this.registerInput(name, {
          set: this.setVisualSorting.bind(this)
        });

      if (name.startsWith('fp-'))
        return this.registerInput(name, {
          set: this.setFilterParameter.bind(this, name.substring('fp-'.length))
        });

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    }
  }
};

function userInputSetter(this: FilterDbModelsInstance, name: string, value: unknown) {
  /* jshint validthis:true */
  this._internal.filterSettings[name] = value;
  if (this.isInputConnected('filter') === false) this.scheduleFilter();
}

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  dbCollections: DbCollectionMeta[] | undefined
) {
  const ports: RuntimeDiscoveredPort[] = [];

  ports.push({
    name: 'collectionName',
    type: {
      name: 'enum',
      enums:
        dbCollections !== undefined
          ? dbCollections.map((c) => {
              return { value: c.name, label: c.name };
            })
          : [],
      allowEditOnly: true
    },
    displayName: 'Class',
    plug: 'input',
    group: 'General'
  });

  ports.push({
    type: 'boolean',
    plug: 'input',
    group: 'Limit',
    name: 'filterEnableLimit',
    displayName: 'Use limit'
  });

  if (parameters['filterEnableLimit']) {
    ports.push({
      type: 'number',
      default: 10,
      plug: 'input',
      group: 'Limit',
      name: 'filterLimit',
      displayName: 'Limit'
    });

    ports.push({
      type: 'number',
      default: 0,
      plug: 'input',
      group: 'Limit',
      name: 'filterSkip',
      displayName: 'Skip'
    });
  }

  // DEFECT (PLAT-003 NOTES §27.3), left verbatim: this guard tests only `collectionName`,
  // while the `enums` above already established `dbCollections` may be `undefined` — so a
  // Filter Records node that has a class selected throws a `TypeError` on `.find` whenever
  // the metadata has not arrived. Every sibling (`dbmodelnode2`, `dbmodelcrudbase`) guards
  // on both.
  if (parameters.collectionName !== undefined) {
    const c = dbCollections.find((c) => c.name === parameters.collectionName);
    if (c && c.schema && c.schema.properties) {
      const schema = JSON.parse(JSON.stringify(c.schema));

      const _supportedTypes: Record<string, boolean> = {
        Boolean: true,
        String: true,
        Date: true,
        Number: true,
        Pointer: true
      };
      for (const key in schema.properties) {
        if (!_supportedTypes[schema.properties[key].type]) delete schema.properties[key];
      }

      ports.push({
        name: 'visualFilter',
        plug: 'input',
        type: { name: 'query-filter', schema: schema, allowEditOnly: true },
        displayName: 'Filter',
        group: 'Filter'
      });

      ports.push({
        name: 'visualSorting',
        plug: 'input',
        type: { name: 'query-sorting', schema: schema, allowEditOnly: true },
        displayName: 'Sorting',
        group: 'Sorting'
      });
    }

    if (parameters.visualFilter !== undefined) {
      // Find all input ports
      const uniqueInputs: Record<string, boolean> = {};
      function _collectInputs(query: VisualFilterQuery | undefined) {
        if (query === undefined) return;
        if (query.rules !== undefined) query.rules.forEach((r) => _collectInputs(r));
        else if (query.input !== undefined) uniqueInputs[query.input] = true;
      }

      _collectInputs(parameters.visualFilter as VisualFilterQuery);
      Object.keys(uniqueInputs).forEach((input) => {
        ports.push({
          name: 'fp-' + input,
          plug: 'input',
          type: '*',
          displayName: input,
          group: 'Filter Parameters'
        });
      });
    }
  }

  /*  ports.push({
        type: { name: 'stringlist', allowEditOnly: true },
        plug: 'input',
        group: 'Filter',
        name: 'filterFilter',
        displayName: 'Filter',
    })

    ports.push({
        type: { name: 'stringlist', allowEditOnly: true },
        plug: 'input',
        group: 'Sort',
        name: 'filterSort',
        displayName: 'Sort',
    })

    const filterOps = {
        "string": [{ value: 'eq', label: 'Equals' }, { value: 'neq', label: 'Not Equals' },{value: 'regex', label: 'Matches RegEx'}],
        "boolean": [{ value: 'eq', label: 'Equals' }, { value: 'neq', label: 'Not Equals' }],
        "number": [{ value: 'eq', label: 'Equals' }, { value: 'neq', label: 'Not Equals' }, { value: 'lt', label: 'Less than' }, { value: 'gt', label: 'Greater than' },
        { value: 'gte', label: 'Greater than or equal' }, { value: 'lte', label: 'Less than or equal' }]
    }

    if (parameters['filterFilter']) {
        var filters = parameters['filterFilter'].split(',');
        filters.forEach((f) => {
            // Type
            ports.push({
                type: { name: 'enum', enums: [{ value: 'string', label: 'String' }, { value: 'number', label: 'Number' }, { value: 'boolean', label: 'Boolean' }] },
                default: 'string',
                plug: 'input',
                group: f + ' filter',
                displayName: 'Type',
                editorName: f + ' filter | Type',
                name: 'filterFilterType-' + f
            })

            var type = parameters['filterFilterType-' + f];

            // String filter type
            ports.push({
                type: { name: 'enum', enums: filterOps[type || 'string'] },
                default: 'eq',
                plug: 'input',
                group: f + ' filter',
                displayName: 'Op',
                editorName: f + ' filter| Op',
                name: 'filterFilterOp-' + f
            })

            // Case sensitivite option
            if(parameters['filterFilterOp-' + f] === 'regex') {
                ports.push({
                    type: 'boolean',
                    default: false,
                    plug: 'input',
                    group: f + ' filter',
                    displayName: 'Case sensitive',
                    editorName: f + ' filter| Case',
                    name: 'filterFilterOption-case-' + f
                })
            }

            ports.push({
                type: type || 'string',
                plug: 'input',
                group: f + ' filter',
                displayName: 'Value',
                editorName: f + ' Filter Value',
                name: 'filterFilterValue-' + f
            })

        })
    }

    if (parameters['filterSort']) {
        var filters = parameters['filterSort'].split(',');
        filters.forEach((f) => {
            ports.push({
                type: { name: 'enum', enums: [{ value: 'ascending', label: 'Ascending' }, { value: 'descending', label: 'Descending' }] },
                default: 'ascending',
                plug: 'input',
                group: f + ' sort',
                displayName: 'Sort',
                editorName: f + ' sorting',
                name: 'filterSort-' + f
            })
        })
    }*/

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const FilterDBModelsNodeModule: NodeModule = {
  node: FilterDBModelsNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.FilterDBModels', function (node: GraphNodeModel) {
      updatePorts(
        node.id,
        node.parameters,
        context.editorConnection,
        graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined
      );

      node.on('parameterUpdated', function () {
        updatePorts(
          node.id,
          node.parameters,
          context.editorConnection,
          graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined
        );
      });

      graphModel.on('metadataChanged.dbCollections', function (data: DbCollectionMeta[]) {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, context.editorConnection, data);
      });

      graphModel.on('metadataChanged.systemCollections', function (data: DbCollectionMeta[]) {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, context.editorConnection, data);
      });
    });
  }
};

export = FilterDBModelsNodeModule;
