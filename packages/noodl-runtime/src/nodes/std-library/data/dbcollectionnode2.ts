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
import EdgeTriggeredInput = require('../../../edgetriggeredinput');
import ModelImport = require('../../../model');
import CollectionImport = require('../../../collection');
import CloudStore = require('../../../api/cloudstore');
import JavascriptNodeParser = require('../../../javascriptnodeparser');
import QueryUtils = require('../../../api/queryutils');
import type { VisualSorting } from '../../../api/queryutils';
import type { WhereClause } from '../../../api/adapters/types';

/**
 * NDA-004 §2 — see `setError`.
 *
 * Not the `'query-collection'` key this file already uses: that one belongs to `fetch`'s
 * editor-time "no collection specified" notice, which is a different report about a different
 * condition and is left where it is.
 */
const QUERY_ERROR_CODE = 'query-records/query-failed';

const Model = ModelImport as unknown as ModelModule;
const Collection = CollectionImport as unknown as CollectionModule;

/** One class in the project's `dbCollections` metadata. */
interface DbCollectionMeta {
  name: string;
  schema?: {
    properties?: Record<string, { type?: string; targetClass?: string; [extra: string]: unknown }>;
    relations?: Record<string, { property: string }[]>;
  };
}

/** A node in the editor's visual filter tree: either a group of rules or a leaf. */
interface VisualFilterQuery {
  rules?: VisualFilterQuery[];
  /** Present on a leaf whose value comes from a port rather than a literal. */
  input?: string;
}

/** The query last sent to the backend, kept so incremental updates can be matched against it. */
interface CurrentQuery {
  where?: unknown;
  sort?: string[];
  limit?: number;
  skip?: number;
  search?: string;
}

/** The payload of a `CloudStore` `save`/`create`/`delete` notification. */
interface CloudStoreEventArgs {
  type?: 'create' | 'save' | 'delete';
  collection?: string;
  objectId?: string;
  object?: { objectId: string };
}

/**
 * `this` inside the Query Records node.
 *
 * Almost its entire surface is dynamic — the class, the filter, the sort, the search term
 * and every query parameter are registered at runtime from the project's schema, which is
 * why `inputs` is empty. Two things are worth knowing before changing anything here:
 *
 * The node keeps its results *live*. It subscribes to the cloud store's save/create/delete
 * notifications and patches its own collection in place, matching each changed record
 * against `currentQuery.where` rather than re-querying — except when a search term is
 * active, where BM25 ranking makes an incremental patch unrepresentable and it re-fetches.
 *
 * And every setter consults `isInputConnected('storageFetch')`: with `Do` wired, nothing
 * here re-runs the query on its own.
 */
interface DbCollectionNodeInstance extends NodeInstance {
  _internal: {
    name?: string;
    collection?: CollectionLike;
    currentQuery?: CurrentQuery;
    error?: string;
    search?: string;
    visualFilter?: unknown;
    visualSorting?: VisualSorting[];
    queryParameters: Record<string, unknown>;
    storageSettings: Record<string, unknown>;
    fetchScheduled?: boolean;
    filterFunc?: (...args: unknown[]) => void;
    filterVariables?: string[];
    collectionChangedCallback?: () => void;
    cloudStoreEvents?: (args: CloudStoreEventArgs) => void;
  };
  setCollectionName(name: string): void;
  setCollection(collection: CollectionLike): void;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike | undefined): void;
  setError(err: string): void;
  scheduleFetch(): void;
  fetch(): void;
  getStorageFilter(): { where?: WhereClause; sort?: string | string[] } | undefined;
  getStorageLimit(): number | undefined;
  getStorageSkip(): number | undefined;
  getStorageFetchTotalCount(): boolean;
  setVisualFilter(value: unknown): void;
  setVisualSorting(value: unknown): void;
  setSearch(value: string): void;
  setQueryParameter(name: string, value: unknown): void;
}

const DbCollectionNode: NodeDefinitionOptions = {
  name: 'DbCollection2',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/query-records',
  displayName: 'Query Records',
  /* shortDesc: "A database collection.",*/
  category: 'Cloud Services',
  usePortAsLabel: 'collectionName',
  color: 'data',
  initialize: function (this: DbCollectionNodeInstance) {
    const _this = this;
    this._internal.queryParameters = {};

    let collectionChangedScheduled = false;
    this._internal.collectionChangedCallback = function () {
      //this can be called multiple times when adding/removing more than one item
      //so optimize by only updating outputs once
      if (collectionChangedScheduled) return;
      collectionChangedScheduled = true;

      _this.scheduleAfterInputsHaveUpdated(function () {
        _this.flagOutputDirty('count');
        _this.flagOutputDirty('firstItemId');
        _this.flagOutputDirty('isEmpty');
        collectionChangedScheduled = false;
      });
    };

    this._internal.cloudStoreEvents = function (args: CloudStoreEventArgs) {
      if (_this.isInputConnected('storageFetch') === true) return;

      if (_this._internal.collection === undefined) return;
      if (args.collection !== _this._internal.name) return;

      // BAK-008: when a search term is active, results are BM25-ranked — a
      // changed record can join, leave, AND change every other result's
      // position, which single-record incremental add/remove (below) cannot
      // express correctly. Delegate to a real re-search instead, which is
      // also how "a changed record re-matches" the search term itself (the
      // incremental path below only ever re-checks the structured `where`,
      // never full-text relevance). Coarser-grained, but correct by
      // construction rather than an approximation of FTS5 in JS.
      if (_this._internal.search) {
        _this.scheduleFetch();
        return;
      }

      function _addModelAtCorrectIndex(m: ModelLike) {
        // `i` is declared outside the loop because the original relied on `var` hoisting to
        // read it after the `break` (PLAT-003 NOTES §23.1).
        let i = 0;
        if (_this._internal.currentQuery.sort !== undefined) {
          // We need to add it at the right index
          for (i = 0; i < _this._internal.collection.size(); i++)
            if (QueryUtils.compareObjects(_this._internal.currentQuery.sort, _this._internal.collection.get(i), m) > 0)
              break;

          _this._internal.collection.addAtIndex(m, i);
        } else {
          _this._internal.collection.add(m);
        }

        // Make sure we don't exceed limit
        const size = _this._internal.collection.size();
        if (_this._internal.currentQuery.limit !== undefined && size > _this._internal.currentQuery.limit)
          _this._internal.collection.remove(
            _this._internal.collection.get(
              _this._internal.currentQuery.sort !== undefined && _this._internal.currentQuery.sort[0][0] === '-'
                ? size - 1
                : 0
            )
          );

        //Send the array again over the items output to trigger function nodes etc that might be connected
        _this.flagOutputDirty('items');

        _this.flagOutputDirty('count');
        _this.flagOutputDirty('firstItemId');
        _this.flagOutputDirty('isEmpty');
      }

      if (args.type === 'create') {
        const m = Model.get(args.object.objectId);
        if (m !== undefined) {
          // Check if the object matches the current query
          if (QueryUtils.matchesQuery(m, _this._internal.currentQuery.where)) {
            // If matches the query, add the item to results
            _addModelAtCorrectIndex(m);
          }
        }
      } else if (args.type === 'save') {
        const m = Model.get(args.objectId);
        if (m !== undefined) {
          const matchesQuery = QueryUtils.matchesQuery(m, _this._internal.currentQuery.where);

          if (!matchesQuery && _this._internal.collection.contains(m)) {
            // The record no longer matches the filter, remove it
            _this._internal.collection.remove(m);

            //Send the array again over the items output to trigger function nodes etc that might be connected
            _this.flagOutputDirty('items');

            _this.flagOutputDirty('count');
            _this.flagOutputDirty('firstItemId');
            _this.flagOutputDirty('isEmpty');
          } else if (matchesQuery && !_this._internal.collection.contains(m)) {
            // It's not part of the result collection but now matches they query, add it and resort
            _addModelAtCorrectIndex(m);
          }
        }
      } else if (args.type === 'delete') {
        const m = Model.get(args.objectId);
        if (m !== undefined) {
          _this._internal.collection.remove(m);

          //Send the array again over the items output to trigger function nodes etc that might be connected
          _this.flagOutputDirty('items');

          _this.flagOutputDirty('count');
          _this.flagOutputDirty('firstItemId');
          _this.flagOutputDirty('isEmpty');
        }
      }
    };

    // Listening to cloud store events is only for the global model scope, only valid in browser
    // in cloud runtime its a nop
    const cloudstore = CloudStore.forScope(this.nodeScope.modelScope);
    cloudstore.on('save', this._internal.cloudStoreEvents);
    cloudstore.on('create', this._internal.cloudStoreEvents);
    cloudstore.on('delete', this._internal.cloudStoreEvents);

    this._internal.storageSettings = {};
  },
  getInspectInfo(this: DbCollectionNodeInstance): InspectInfo {
    const collection = this._internal.collection;
    if (!collection) {
      return { type: 'text', value: '[Not executed yet]' };
    }

    return [
      {
        type: 'value',
        value: collection.items
      }
    ];
  },
  inputs: {},
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      description: 'Records the query matched, in the order Sort asks for; empty before the first query has run',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.collection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Record Id',
      group: 'General',
      description: 'Id of the first matched record, for feeding a Record node without going through a repeater',
      getter: function (this: DbCollectionNodeInstance) {
        if (this._internal.collection) {
          const firstItem = this._internal.collection.get(0);
          if (firstItem !== undefined) return firstItem.getId();
        }
      }
    },
    isEmpty: {
      type: 'boolean',
      displayName: 'Is Empty',
      group: 'General',
      description: 'True when the query matched nothing, and also true before the first query has run',
      getter: function (this: DbCollectionNodeInstance) {
        if (this._internal.collection) {
          return this._internal.collection.size() === 0;
        }
        return true;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      group: 'General',
      description: 'How many records are in Items, which Limit caps — turn on Fetch total count for the uncapped figure',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.collection ? this._internal.collection.size() : 0;
      }
    },
    fetched: {
      group: 'Events',
      type: 'signal',
      displayName: 'Success',
      description: 'Fires once the query has returned and Items is up to date'
    },
    failure: {
      group: 'Events',
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the query could not be run, after the reason has been reported on the error channel'
    },
    error: {
      type: 'string',
      displayName: 'Error',
      group: 'Error',
      description: 'Why the last query failed; empty until one does',
      getter: function (this: DbCollectionNodeInstance) {
        return this._internal.error;
      }
    }
  },
  prototypeExtensions: {
    setCollectionName: function (this: DbCollectionNodeInstance, name: string) {
      this._internal.name = name;

      if (this.isInputConnected('storageFetch') === false) this.scheduleFetch();
    },
    setCollection: function (this: DbCollectionNodeInstance, collection: CollectionLike) {
      this.bindCollection(collection);
      this.flagOutputDirty('firstItemId');
      this.flagOutputDirty('isEmpty');
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

      const cloudstore = CloudStore.forScope(this.nodeScope.modelScope);
      // These three must mirror `initialize`'s three subscriptions exactly. Until PLAT-003
      // slice 13 the first was `'insert'` — a name nothing emits — so the `'create'`
      // listener survived the node, and because it closes over `_this` the deleted node
      // stayed reachable and kept patching a collection nobody reads (NOTES §27.3 item 3).
      cloudstore.off('create', this._internal.cloudStoreEvents);
      cloudstore.off('delete', this._internal.cloudStoreEvents);
      cloudstore.off('save', this._internal.cloudStoreEvents);
    },
    // The field written here must be the one the `error` output's getter reads. Until
    // PLAT-003 slice 13 this wrote `_internal.err` against a getter reading
    // `_internal.error`, so the port had never carried a message and only the `failure`
    // signal fired. §23.4 recorded exactly this in the *deprecated* `dbcollectionnode`;
    // it was the same bug in the node that replaced it (NOTES §27.3 item 1).
    /**
     * NDA-004 §2 / FINDINGS B-iv. This one is *not* the finding's shape and is worse than it.
     *
     * B-iv counted twenty-two `setError` definitions and read them as copies of one that posted
     * to `editorConnection.sendWarning`. This one posts nowhere at all: the message reached the
     * `Error` port and stopped. That is a node whose failure has no diagnosis in *any* runtime,
     * the editor included — strictly worse than an editor-only one, and invisible to the same
     * `Fail?` column for the same reason.
     */
    setError: function (this: DbCollectionNodeInstance, err: string) {
      this._internal.error = err;
      this.flagOutputDirty('error');
      this.sendSignalOnOutput('failure');

      this.raiseRuntimeError(QUERY_ERROR_CODE, err);
    },
    scheduleFetch: function (this: DbCollectionNodeInstance) {
      const internal = this._internal;

      if (internal.fetchScheduled) return;
      internal.fetchScheduled = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        internal.fetchScheduled = false;

        this.fetch();
      });
    },
    fetch: function (this: DbCollectionNodeInstance) {
      if (this.context.editorConnection) {
        if (this._internal.name === undefined) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'query-collection', {
            message: 'No collection specified for query'
          });
        } else {
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'query-collection');
        }
      }

      const _c = Collection.get();
      const f = this.getStorageFilter();
      const limit = this.getStorageLimit();
      const skip = this.getStorageSkip();
      const count = this.getStorageFetchTotalCount();
      // BAK-008: empty/undefined search is a no-op (plain query, unchanged
      // behavior); a non-empty term switches the server onto the FTS5-ranked
      // search path (still composed with `where`/sort/limit/ACL — see
      // cloudstore.js's query()).
      const search = this._internal.search || undefined;
      this._internal.currentQuery = {
        where: f.where,
        sort: f.sort as string[],
        limit: limit,
        skip: skip,
        search: search
      };
      CloudStore.forScope(this.nodeScope.modelScope).query({
        collection: this._internal.name,
        where: f.where,
        sort: f.sort,
        limit: limit,
        skip: skip,
        count: count,
        search: search,
        success: (results: Record<string, unknown>[], count: number) => {
          if (results !== undefined) {
            _c.set(
              results.map((i) => {
                const m = CloudStore._fromJSON(i, this._internal.name, this.nodeScope.modelScope);

                return m;
              })
            );
          }
          if (count !== undefined) {
            this._internal.storageSettings.storageTotalCount = count;
            if (this.hasOutput('storageTotalCount')) this.flagOutputDirty('storageTotalCount');
          }
          this.setCollection(_c);
          this.sendSignalOnOutput('fetched');
        },
        error: (err: string) => {
          this.setCollection(_c);
          this.setError(err || 'Failed to fetch.');
        }
      });
    },
    getStorageFilter: function (this: DbCollectionNodeInstance) {
      const storageSettings = this._internal.storageSettings;
      if (storageSettings['storageFilterType'] === undefined || storageSettings['storageFilterType'] === 'simple') {
        // Create simple filter
        const _where =
          this._internal.visualFilter !== undefined
            ? QueryUtils.convertVisualFilter(this._internal.visualFilter, {
                queryParameters: this._internal.queryParameters,
                collectionName: this._internal.name
              })
            : undefined;

        const _sort =
          this._internal.visualSorting !== undefined
            ? QueryUtils.convertVisualSorting(this._internal.visualSorting)
            : undefined;

        return {
          where: _where,
          sort: _sort
        };
      } else if (storageSettings['storageFilterType'] === 'json') {
        // JSON filter
        if (!this._internal.filterFunc) {
          try {
            let filterCode = storageSettings['storageJSONFilter'] as string;

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

        let _filter: unknown = {},
          _sort: unknown = [];
        const _this = this;

        // Collect filter variables
        // `f` is whatever the user's filter script passed to `where(…)`/`filter(…)`.
        const _filterCb = function (f: Record<string, unknown>) {
          _filter = QueryUtils.convertFilterOp(f, {
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
        const _sortCb = function (s: unknown) {
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
      else return (storageSettings['storageLimit'] as number) || 10;
    },
    getStorageSkip: function (this: DbCollectionNodeInstance) {
      const storageSettings = this._internal.storageSettings;

      if (!storageSettings['storageEnableLimit']) return;
      else return (storageSettings['storageSkip'] as number) || 0;
    },
    getStorageFetchTotalCount: function (this: DbCollectionNodeInstance) {
      const storageSettings = this._internal.storageSettings;

      return !!storageSettings['storageEnableCount'];
    },
    registerOutputIfNeeded: function (this: DbCollectionNodeInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      this.registerOutput(name, {
        getter: userOutputGetter.bind(this, name)
      });
    },
    setVisualFilter: function (this: DbCollectionNodeInstance, value: unknown) {
      this._internal.visualFilter = value;

      if (this.isInputConnected('storageFetch') === false) this.scheduleFetch();
    },
    setVisualSorting: function (this: DbCollectionNodeInstance, value: VisualSorting[]) {
      this._internal.visualSorting = value;

      if (this.isInputConnected('storageFetch') === false) this.scheduleFetch();
    },
    // BAK-008: full-text search term (string; empty/undefined = no-op, plain
    // query unchanged). Orthogonal to the Filter — combined server-side with
    // whatever `where` the Visual/Javascript filter produces.
    setSearch: function (this: DbCollectionNodeInstance, value: string) {
      this._internal.search = value;

      if (this.isInputConnected('storageFetch') === false) this.scheduleFetch();
    },
    setQueryParameter: function (this: DbCollectionNodeInstance, name: string, value: unknown) {
      this._internal.queryParameters[name] = value;

      if (this.isInputConnected('storageFetch') === false) this.scheduleFetch();
    },
    registerInputIfNeeded: function (this: DbCollectionNodeInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name.startsWith('qp-'))
        return this.registerInput(name, {
          set: this.setQueryParameter.bind(this, name.substring('qp-'.length))
        });

      const dynamicSignals: Record<string, () => void> = {
        storageFetch: this.scheduleFetch.bind(this)
      };

      if (dynamicSignals[name])
        return this.registerInput(name, {
          set: EdgeTriggeredInput.createSetter({
            valueChangedToTrue: dynamicSignals[name]
          })
        });

      const dynamicSetters: Record<string, (value: never) => void> = {
        collectionName: this.setCollectionName.bind(this),
        visualFilter: this.setVisualFilter.bind(this),
        visualSort: this.setVisualSorting.bind(this),
        search: this.setSearch.bind(this)
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

  if (this.isInputConnected('storageFetch') === false) this.scheduleFetch();
}

const _defaultJSONQuery =
  '// Write your query script here, check out the reference documentation for examples\n' + 'where({ })\n';

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ports: RuntimeDiscoveredPort[] = [];

  const dbCollections = graphModel.getMetaData('dbCollections') as DbCollectionMeta[] | undefined;
  const systemCollections = graphModel.getMetaData('systemCollections') as DbCollectionMeta[] | undefined;

  const _systemClasses = [
    { label: 'User', value: '_User' },
    { label: 'Role', value: '_Role' }
  ];
  ports.push({
    name: 'collectionName',
    type: {
      name: 'enum',
      enums: _systemClasses.concat(
        dbCollections !== undefined
          ? dbCollections.map((c) => {
              return { value: c.name, label: c.name };
            })
          : []
      ),
      allowEditOnly: true
    },
    displayName: 'Class',
    plug: 'input',
    group: 'General'
  });

  ports.push({
    name: 'storageFilterType',
    type: {
      name: 'enum',
      allowEditOnly: true,
      enums: [
        { value: 'simple', label: 'Visual' },
        { value: 'json', label: 'Javascript' }
      ]
    },
    displayName: 'Filter',
    default: 'simple',
    plug: 'input',
    group: 'General'
  });

  // BAK-008: full-text search term. Independent of the Filter type (Visual or
  // Javascript) — combined server-side with whatever `where` the filter
  // produces, an FTS5 MATCH against the collection's search-enabled fields
  // (configured in the Backend Services panel or via MCP). Empty = no-op, a
  // plain query exactly like before this port existed. Matched records carry
  // `_score` (higher = better match) and `_snippet` (highlighted excerpt) as
  // regular item properties, same as any other field.
  ports.push({
    type: 'string',
    plug: 'input',
    group: 'Search',
    name: 'search',
    displayName: 'Search'
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
    group: 'Actions',
    name: 'storageFetch',
    displayName: 'Do'
  });

  // Total Count
  ports.push({
    type: 'boolean',
    plug: 'input',
    group: 'Total Count',
    name: 'storageEnableCount',
    displayName: 'Fetch total count'
  });

  if (parameters['storageEnableCount']) {
    ports.push({
      type: 'number',
      plug: 'output',
      group: 'General',
      name: 'storageTotalCount',
      displayName: 'Total Count'
    });
  }

  // Simple query
  if (parameters['storageFilterType'] === undefined || parameters['storageFilterType'] === 'simple') {
    if (parameters.collectionName !== undefined) {
      let c = dbCollections && dbCollections.find((c) => c.name === parameters.collectionName);
      if (c === undefined && systemCollections) c = systemCollections.find((c) => c.name === parameters.collectionName);
      if (c && c.schema && c.schema.properties) {
        const schema = JSON.parse(JSON.stringify(c.schema)) as DbCollectionMeta['schema'];

        // Find all records that have a relation with this type
        function _findRelations(c: DbCollectionMeta) {
          if (c.schema !== undefined && c.schema.properties !== undefined)
            for (const key in c.schema.properties) {
              const p = c.schema.properties[key];
              if (p.type === 'Relation' && p.targetClass === parameters.collectionName) {
                if (schema.relations === undefined) schema.relations = {};
                if (schema.relations[c.name] === undefined) schema.relations[c.name] = [];

                schema.relations[c.name].push({ property: key });
              }
            }
        }

        dbCollections && dbCollections.forEach(_findRelations);
        systemCollections && systemCollections.forEach(_findRelations);

        ports.push({
          name: 'visualFilter',
          plug: 'input',
          type: { name: 'query-filter', schema: schema, allowEditOnly: true },
          displayName: 'Filter',
          group: 'Filter'
        });

        ports.push({
          name: 'visualSort',
          plug: 'input',
          type: { name: 'query-sorting', schema: schema, allowEditOnly: true },
          displayName: 'Sort',
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
            name: 'qp-' + input,
            plug: 'input',
            type: '*',
            displayName: input,
            group: 'Query Parameters'
          });
        });
      }
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

    let filter = parameters['storageJSONFilter'] as string | undefined;
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
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    function _managePortsForNode(node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);

      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name.startsWith('storage') || event.name === 'visualFilter' || event.name === 'collectionName') {
          updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
        }
      });

      graphModel.on('metadataChanged.dbCollections', function () {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.systemCollections', function () {
        CloudStore.invalidateCollections();
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      graphModel.on('metadataChanged.cloudservices', function () {
        CloudStore.instance._initCloudServices();
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.DbCollection2', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('DbCollection2')) {
        _managePortsForNode(node);
      }
    });
  }
};

export = DbCollectionNodeModule;
