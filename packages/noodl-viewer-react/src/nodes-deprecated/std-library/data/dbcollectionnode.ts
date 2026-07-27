'use strict';

import { EdgeTriggeredInput, Node } from '@noodl/runtime';
import CloudStore from '@noodl/runtime/src/api/cloudstore';
import Collection from '@noodl/runtime/src/collection';
import JavascriptNodeParser from '@noodl/runtime/src/javascriptnodeparser';
import Model from '@noodl/runtime/src/model';
import type {
  CollectionLike,
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/** A class in the backend schema, as the editor reports it in `dbCollections` metadata. */
interface DbCollectionMeta {
  name: string;
  schema?: { properties?: Record<string, { type?: string; targetClass?: string }> };
}

/**
 * A filter as the author writes it, in the node's own vocabulary
 * (`equalTo`, `containedIn`, `relatedTo`, …) rather than the backend's `$`-prefixed one.
 */
type AuthoredFilter = Record<string, any>;

/** A filter in the backend's query language. */
type BackendFilter = Record<string, any>;

interface ConvertFilterOptions {
  collectionName: string | undefined;
  /** Reports a malformed filter to the editor. Returns nothing, so conversion continues. */
  error(message: string): void;
}

// Returns `undefined` on a malformed filter — `options.error` reports it and has no
// return value of its own, which the original relied on by returning its result.
function _convertFilterOp(filter: AuthoredFilter, options: ConvertFilterOptions): BackendFilter | undefined {
  const keys = Object.keys(filter);
  if (keys.length === 0) return {};
  if (keys.length !== 1) {
    options.error('Filter must only have one key found ' + keys.join(','));
    return undefined;
  }

  const res: BackendFilter = {};
  const key = keys[0];
  if (filter['and'] !== undefined && Array.isArray(filter['and'])) {
    res['$and'] = filter['and'].map((f) => _convertFilterOp(f, options));
  } else if (filter['or'] !== undefined && Array.isArray(filter['or'])) {
    res['$or'] = filter['or'].map((f) => _convertFilterOp(f, options));
  } else if (filter['idEqualTo'] !== undefined) {
    res['objectId'] = { $eq: filter['idEqualTo'] };
  } else if (filter['idContainedIn'] !== undefined) {
    res['objectId'] = { $in: filter['idContainedIn'] };
  } else if (filter['relatedTo'] !== undefined) {
    const modelId = filter['relatedTo']['id'];
    if (modelId === undefined) {
      options.error('Must provide id in relatedTo filter');
      return undefined;
    }

    const relationKey = filter['relatedTo']['key'];
    if (relationKey === undefined) {
      options.error('Must provide key in relatedTo filter');
      return undefined;
    }

    const m: ModelLike = Model.get(modelId);
    res['$relatedTo'] = {
      object: {
        __type: 'Pointer',
        objectId: modelId,
        className: m._class
      },
      key: relationKey
    };
  } else if (typeof filter[key] === 'object') {
    const opAndValue = filter[key];
    if (opAndValue['equalTo'] !== undefined) res[key] = { $eq: opAndValue['equalTo'] };
    else if (opAndValue['notEqualTo'] !== undefined) res[key] = { $ne: opAndValue['notEqualTo'] };
    else if (opAndValue['lessThan'] !== undefined) res[key] = { $lt: opAndValue['lessThan'] };
    else if (opAndValue['greaterThan'] !== undefined) res[key] = { $gt: opAndValue['greaterThan'] };
    else if (opAndValue['lessThanOrEqualTo'] !== undefined) res[key] = { $lte: opAndValue['lessThanOrEqualTo'] };
    else if (opAndValue['greaterThanOrEqualTo'] !== undefined) res[key] = { $gte: opAndValue['greaterThanOrEqualTo'] };
    else if (opAndValue['exists'] !== undefined) res[key] = { $exists: opAndValue['exists'] };
    else if (opAndValue['containedIn'] !== undefined) res[key] = { $in: opAndValue['containedIn'] };
    else if (opAndValue['notContainedIn'] !== undefined) res[key] = { $nin: opAndValue['notContainedIn'] };
    else if (opAndValue['pointsTo'] !== undefined) {
      // `schema` was declared with `var` inside the `if` and read below it; hoisted
      // here so the same value survives the conversion to block scoping.
      let schema: DbCollectionMeta['schema'];
      if (CloudStore._collections[options.collectionName])
        schema = CloudStore._collections[options.collectionName].schema;

      const targetClass =
        schema && schema.properties && schema.properties[key] ? schema.properties[key].targetClass : undefined;
      const type = schema && schema.properties && schema.properties[key] ? schema.properties[key].type : undefined;

      if (type === 'Relation') {
        res[key] = {
          __type: 'Pointer',
          objectId: opAndValue['pointsTo'],
          className: targetClass
        };
      } else {
        if (Array.isArray(opAndValue['pointsTo']))
          res[key] = {
            $in: opAndValue['pointsTo'].map((v) => {
              return { __type: 'Pointer', objectId: v, className: targetClass };
            })
          };
        else
          res[key] = {
            $eq: {
              __type: 'Pointer',
              objectId: opAndValue['pointsTo'],
              className: targetClass
            }
          };
      }
    } else if (opAndValue['matchesRegex'] !== undefined) {
      res[key] = {
        $regex: opAndValue['matchesRegex'],
        $options: opAndValue['options']
      };
    } else if (opAndValue['text'] !== undefined && opAndValue['text']['search'] !== undefined) {
      const _v = opAndValue['text']['search'];
      if (typeof _v === 'string') res[key] = { $text: { $search: { $term: _v, $caseSensitive: false } } };
      else
        res[key] = {
          $text: {
            $search: {
              $term: _v.term,
              $language: _v.language,
              $caseSensitive: _v.caseSensitive,
              $diacriticSensitive: _v.diacriticSensitive
            }
          }
        };
    }
  } else {
    options.error('Unrecognized filter keys ' + keys.join(','));
  }

  return res;
}

/**
 * `this` inside the deprecated Query Collection node.
 *
 * Every one of its inputs is dynamic: `storageSettings` is where they all land,
 * keyed by port name, and `setup` below derives the port set from the backend
 * schema plus whatever the author typed into the filter.
 */
interface DbCollectionNodeInstance extends NodeInstance {
  _internal: {
    /** The backend class being queried. */
    name?: string;
    /** The result set, rebuilt on every fetch. */
    collection?: CollectionLike;
    /** Every dynamic input's latest value, keyed by port name. */
    storageSettings: Record<string, any>;
    /** Compiled advanced-filter script. Built once, then reused. */
    filterFunc?: (...args: unknown[]) => void;
    /** `$name` placeholders found in that script, in source order. */
    filterVariables?: string[];
    fetchScheduled?: boolean;
    error?: string;
    collectionChangedCallback(): void;
  };
  setCollectionName(name: string): void;
  setCollection(collection: CollectionLike): void;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike | undefined): void;
  setError(err: string): void;
  fetch(): void;
  getStorageFilter(): { where?: BackendFilter; sort?: string[] } | undefined;
  getStorageLimit(): number | undefined;
  getStorageSkip(): number | undefined;
}

const DbCollectionNode: NodeDefinitionOptions = {
  name: 'DbCollection',
  docs: 'https://docs.noodl.net/nodes/cloud-services/collection',
  displayNodeName: 'Query Collection',
  shortDesc: 'A database collection.',
  category: 'Cloud Services',
  usePortAsLabel: 'collectionName',
  color: 'data',
  deprecated: true, // Use Query Records
  initialize: function (this: DbCollectionNodeInstance) {
    const _this = this;

    let collectionChangedScheduled = false;
    this._internal.collectionChangedCallback = function () {
      //this can be called multiple times when adding/removing more than one item
      //so optimize by only updating outputs once
      if (collectionChangedScheduled) return;
      collectionChangedScheduled = true;

      _this.scheduleAfterInputsHaveUpdated(function () {
        _this.sendSignalOnOutput('modified');
        _this.flagOutputDirty('count');
        _this.flagOutputDirty('firstItemId');
        //  _this.flagOutputDirty('firstItem');
        collectionChangedScheduled = false;
      });
    };

    this._internal.storageSettings = {};
  },
  inputs: {},
  outputs: {
    id: {
      type: 'string',
      displayName: 'Name',
      group: 'General',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.name;
      }
    },
    items: {
      type: 'array',
      displayName: 'Result',
      group: 'General',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.collection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Item Id',
      group: 'General',
      getter: function (this: DbCollectionNodeInstance) {
        if (this._internal.collection) {
          const firstItem = this._internal.collection.get(0);
          if (firstItem !== undefined) return firstItem.getId();
        }
      }
    },
    /*    firstItem: {
            type: 'object',
            displayName: 'First Item',
            group: 'General',
            getter: function () {
                if (this._internal.collection) {
                    return this._internal.collection.get(0);
                }
            }
        },  */
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.collection ? this._internal.collection.size() : 0;
      }
    },
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Modified'
    },
    fetched: {
      group: 'Events',
      type: 'signal',
      displayName: 'Fetched'
    },
    failure: {
      group: 'Events',
      type: 'signal',
      displayName: 'Failure'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Events',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.error;
      }
    }
  },
  prototypeExtensions: {
    setCollectionName: function (this: DbCollectionNodeInstance, name: string) {
      this._internal.name = name;
      // this.invalidateCollection();
      this.flagOutputDirty('id');
    },
    setCollection: function (this: DbCollectionNodeInstance, collection: CollectionLike) {
      this.bindCollection(collection);
      this.flagOutputDirty('firstItemId');
      // this.flagOutputDirty('firstItem');
      this.flagOutputDirty('items');
      this.flagOutputDirty('count');
    },
    unbindCurrentCollection: function (this: DbCollectionNodeInstance) {
      const collection = this._internal.collection;
      if (!collection) return;
      collection.off('change', this._internal.collectionChangedCallback);
      this._internal.collection = undefined;
    },
    bindCollection: function (this: DbCollectionNodeInstance, collection: CollectionLike | undefined) {
      this.unbindCurrentCollection();
      this._internal.collection = collection;
      collection && collection.on('change', this._internal.collectionChangedCallback);
    },
    _onNodeDeleted: function (this: DbCollectionNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.unbindCurrentCollection();
    },
    setError: function (this: DbCollectionNodeInstance, err: string) {
      // Writes `err`, but the `error` output getter reads `error` — so the message
      // never reaches the port, which stays undefined. Kept verbatim; correcting the
      // key is a behaviour change (PLAT-003 NOTES §23.4).
      (this._internal as Record<string, unknown>).err = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');
    },
    fetch: function (this: DbCollectionNodeInstance) {
      const internal = this._internal;

      if (this.context.editorConnection) {
        if (this._internal.name === undefined) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'query-collection', {
            message: 'No collection specified for query'
          });
        } else {
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'query-collection');
        }
      }

      if (internal.fetchScheduled) return;
      internal.fetchScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        internal.fetchScheduled = false;

        const _c = Collection.get();
        const f = this.getStorageFilter();
        CloudStore.instance.query({
          collection: this._internal.name,
          where: f.where,
          sort: f.sort,
          limit: this.getStorageLimit(),
          skip: this.getStorageSkip(),
          success: (results: Record<string, unknown>[]) => {
            if (results !== undefined) {
              _c.set(
                results.map((i) => {
                  const m: ModelLike = CloudStore._fromJSON(i, this._internal.name);

                  // Remove from collection if model is deleted
                  m.on('delete', () => _c.remove(m));
                  return m;
                })
              );
            }
            this.setCollection(_c);
            this.sendSignalOnOutput('fetched');
          },
          error: (err: string) => {
            this.setCollection(_c);
            this.setError(err || 'Failed to fetch.');
          }
        });
      });
    },
    getStorageFilter: function (this: DbCollectionNodeInstance) {
      const storageSettings = this._internal.storageSettings;
      if (storageSettings['storageFilterType'] === undefined || storageSettings['storageFilterType'] === 'simple') {
        // `_where` and `_sort` were `var`s declared inside the two `if`s below and read
        // after them; hoisted so block scoping preserves the same values.
        let _where: BackendFilter | undefined;
        let _sort: string[] | undefined;

        // Create simple filter
        if (storageSettings['storageFilter']) {
          const filters: string[] = storageSettings['storageFilter'].split(',');
          const _filters: BackendFilter[] = [];
          filters.forEach(function (f) {
            const _filter: BackendFilter = {};
            const op = '$' + (storageSettings['storageFilterOp-' + f] || 'eq');
            _filter[f] = {};
            _filter[f][op] = storageSettings['storageFilterValue-' + f];
            _filters.push(_filter);
          });
          _where = _filters.length > 1 ? { $and: _filters } : _filters[0];
        }

        if (storageSettings['storageSort']) {
          const sort: string[] = storageSettings['storageSort'].split(',');
          const sorted: string[] = [];
          sort.forEach(function (s) {
            sorted.push((storageSettings['storageSort-' + s] === 'descending' ? '-' : '') + s);
          });
          _sort = sorted;
        }

        return {
          where: _where,
          sort: _sort
        };
      } else if (storageSettings['storageFilterType'] === 'json') {
        // JSON filter
        if (!this._internal.filterFunc) {
          try {
            let filterCode: string = storageSettings['storageJSONFilter'];

            // Parse out variables
            filterCode = filterCode.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Remove comments
            this._internal.filterVariables = filterCode.match(/\$[A-Za-z0-9]+/g) || [];

            const args = ['filter', 'where', 'sort', 'Inputs']
              .concat(this._internal.filterVariables)
              .concat([filterCode]);
            this._internal.filterFunc = Function.apply(null, args);
          } catch (e) {
            this._internal.filterFunc = undefined;
            console.log('Error while parsing filter script: ' + e);
          }
        }

        if (!this._internal.filterFunc) return;

        let _filter: BackendFilter | undefined = {},
          _sort: string[] = [];
        const _this = this;

        // Collect filter variables
        const _filterCb = function (f: AuthoredFilter) {
          _filter = _convertFilterOp(f, {
            collectionName: _this._internal.name,
            error: function (err: string) {
              _this.context.editorConnection.sendWarning(
                _this.nodeScope.componentOwner.name,
                _this.id,
                'query-collection-filter',
                {
                  message: err
                }
              );
            }
          });
        };
        const _sortCb = function (s: string[]) {
          _sort = s;
        };

        // Extract inputs
        const inputs: Record<string, unknown> = {};
        for (const key in storageSettings) {
          if (key.startsWith('storageFilterValue-'))
            inputs[key.substring('storageFilterValue-'.length)] = storageSettings[key];
        }

        const filterFuncArgs: unknown[] = [_filterCb, _filterCb, _sortCb, inputs]; // One for filter, one for where

        this._internal.filterVariables.forEach((v) => {
          filterFuncArgs.push(storageSettings['storageFilterValue-' + v.substring(1)]);
        });

        // Run the code to get the filter
        try {
          this._internal.filterFunc.apply(this, filterFuncArgs);
        } catch (e) {
          console.log('Error while running filter script: ' + e);
        }

        return { where: _filter, sort: _sort };
      }
    },
    getStorageLimit: function (this: DbCollectionNodeInstance) {
      const storageSettings = this._internal.storageSettings;

      if (!storageSettings['storageEnableLimit']) return;
      else return storageSettings['storageLimit'] || 10;
    },
    getStorageSkip: function (this: DbCollectionNodeInstance) {
      const storageSettings = this._internal.storageSettings;

      if (!storageSettings['storageEnableLimit']) return;
      else return storageSettings['storageSkip'] || 0;
    },
    registerOutputIfNeeded: function (this: DbCollectionNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        getter: userOutputGetter.bind(this, name)
      });
    },
    registerInputIfNeeded: function (this: DbCollectionNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      const dynamicSignals: Record<string, () => void> = {
        storageFetch: this.fetch.bind(this)
      };

      if (dynamicSignals[name])
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: dynamicSignals[name]
          })
        });

      const dynamicSetters: Record<string, (value: never) => void> = {
        collectionName: this.setCollectionName.bind(this)
      };

      if (dynamicSetters[name])
        return this.registerInput(name, {
          set: dynamicSetters[name]
        });

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    }
  }
};

function userOutputGetter(this: DbCollectionNodeInstance, name: string) {
  /* jshint validthis:true */
  return this._internal.storageSettings[name];
}

function userInputSetter(this: DbCollectionNodeInstance, name: string, value: unknown) {
  /* jshint validthis:true */
  this._internal.storageSettings[name] = value;
}

const _defaultJSONQuery =
  '// Write your query script here, check out the reference documentation for examples\n' + 'where({ })\n';

function updatePorts(
  nodeId: string,
  parameters: Record<string, any>,
  editorConnection: EditorConnectionLike,
  dbCollections: DbCollectionMeta[] | undefined
): void {
  const ports: Record<string, unknown>[] = [];

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
    displayName: 'Collecton Name',
    plug: 'input',
    group: 'General'
  });

  ports.push({
    name: 'storageFilterType',
    type: {
      name: 'enum',
      allowEditOnly: true,
      enums: [
        { value: 'simple', label: 'Simple' },
        { value: 'json', label: 'Advanced' }
      ]
    },
    displayName: 'Filter',
    default: 'simple',
    plug: 'input',
    group: 'General'
  });

  // Limit
  ports.push({
    type: 'boolean',
    plug: 'input',
    group: 'Limit',
    name: 'storageEnableLimit',
    displayName: 'Use limit'
  });

  if (parameters['storageEnableLimit']) {
    ports.push({
      type: 'number',
      default: 10,
      plug: 'input',
      group: 'Limit',
      name: 'storageLimit',
      displayName: 'Limit'
    });

    ports.push({
      type: 'number',
      default: 0,
      plug: 'input',
      group: 'Limit',
      name: 'storageSkip',
      displayName: 'Skip'
    });
  }

  ports.push({
    type: 'signal',
    plug: 'input',
    group: 'Storage',
    name: 'storageFetch',
    displayName: 'Fetch'
  });

  // Simple query
  if (parameters['storageFilterType'] === undefined || parameters['storageFilterType'] === 'simple') {
    ports.push({
      type: { name: 'stringlist', allowEditOnly: true },
      plug: 'input',
      group: 'Filter',
      name: 'storageFilter',
      displayName: 'Filter'
    });

    const filterOps: Record<string, { value: string; label: string }[]> = {
      string: [
        { value: 'eq', label: 'Equals' },
        { value: 'ne', label: 'Not Equals' }
      ],
      boolean: [
        { value: 'eq', label: 'Equals' },
        { value: 'ne', label: 'Not Equals' }
      ],
      number: [
        { value: 'eq', label: 'Equals' },
        { value: 'ne', label: 'Not Equals' },
        { value: 'lt', label: 'Less than' },
        { value: 'gt', label: 'Greater than' },
        { value: 'gte', label: 'Greater than or equal' },
        { value: 'lte', label: 'Less than or equal' }
      ]
    };

    if (parameters['storageFilter']) {
      const filters: string[] = parameters['storageFilter'].split(',');
      filters.forEach((f) => {
        // Type
        ports.push({
          type: {
            name: 'enum',
            enums: [
              { value: 'string', label: 'String' },
              { value: 'number', label: 'Number' },
              { value: 'boolean', label: 'Boolean' }
            ]
          },
          default: 'string',
          plug: 'input',
          group: f + ' filter',
          displayName: 'Type',
          editorName: f + ' filter | Type',
          name: 'storageFilterType-' + f
        });

        const type = parameters['storageFilterType-' + f];

        // String filter type
        ports.push({
          type: { name: 'enum', enums: filterOps[type || 'string'] },
          default: 'eq',
          plug: 'input',
          group: f + ' filter',
          displayName: 'Op',
          editorName: f + ' filter| Op',
          name: 'storageFilterOp-' + f
        });

        ports.push({
          type: type || 'string',
          plug: 'input',
          group: f + ' filter',
          displayName: 'Value',
          editorName: f + ' Filter Value',
          name: 'storageFilterValue-' + f
        });
      });
    }

    ports.push({
      type: { name: 'stringlist', allowEditOnly: true },
      plug: 'input',
      group: 'Sort',
      name: 'storageSort',
      displayName: 'Sort'
    });

    // Sorting inputs
    if (parameters['storageSort']) {
      const sortFields: string[] = parameters['storageSort'].split(',');
      sortFields.forEach((f) => {
        ports.push({
          type: {
            name: 'enum',
            enums: [
              { value: 'ascending', label: 'Ascending' },
              { value: 'descending', label: 'Descending' }
            ]
          },
          default: 'ascending',
          plug: 'input',
          group: f + ' sort',
          displayName: 'Sort',
          editorName: f + ' sorting',
          name: 'storageSort-' + f
        });
      });
    }
  }
  // JSON query
  else if (parameters['storageFilterType'] === 'json') {
    ports.push({
      type: { name: 'string', allowEditOnly: true, codeeditor: 'javascript' },
      plug: 'input',
      group: 'Filter',
      name: 'storageJSONFilter',
      default: _defaultJSONQuery,
      displayName: 'Filter'
    });

    let filter: string = parameters['storageJSONFilter'];
    if (filter) {
      filter = filter.replace(/\/\*[\s\S]*?\*\/|\/\/.*/g, ''); // Remove comments
      const variables = filter.match(/\$[A-Za-z0-9]+/g);

      if (variables) {
        const unique: Record<string, boolean> = {};
        variables.forEach((v) => {
          unique[v] = true;
        });

        Object.keys(unique).forEach((p) => {
          ports.push({
            name: 'storageFilterValue-' + p.substring(1),
            displayName: p.substring(1),
            group: 'Filter Values',
            plug: 'input',
            type: { name: '*', allowConnectionsOnly: true }
          });
        });
      }

      // Support variables with the "Inputs."" syntax
      JavascriptNodeParser.parseAndAddPortsFromScript(filter, ports, {
        inputPrefix: 'storageFilterValue-',
        inputGroup: 'Filter Values',
        inputType: { name: '*', allowConnectionsOnly: true },
        skipOutputs: true
      });
    }
  }

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const DbCollectionNodeModule: NodeModule = {
  node: DbCollectionNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    const editorConnection = context.editorConnection;
    if (!editorConnection || !editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(
        node.id,
        node.parameters,
        editorConnection,
        graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined
      );

      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name.startsWith('storage')) {
          updatePorts(
            node.id,
            node.parameters,
            editorConnection,
            graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined
          );
        }
      });

      graphModel.on('metadataChanged.dbCollections', function (data: DbCollectionMeta[]) {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, editorConnection, data);
      });

      graphModel.on('metadataChanged.cloudservices', function () {
        CloudStore.instance._initCloudServices();
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.DbCollection', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('DbCollection')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default DbCollectionNodeModule;
