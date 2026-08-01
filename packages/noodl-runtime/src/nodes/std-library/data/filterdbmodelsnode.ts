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
import type { VisualSorting } from '../../../api/queryutils';
import { runOnChangeDynamicPorts } from '../../../run-on-value-change';

import {
  recordBackendPickerPorts,
  recordClassPorts,
  recordFilterBackendType,
  recordFilterSchema,
  recordSchemaContext
} from './record-ports';
import { sendSchemaPorts, staticPortNames } from './schema-ports';

const Collection = CollectionImport as unknown as CollectionModule;
const Model = ModelImport as unknown as ModelModule;

/** The store surface this node uses: one subscription, no requests. */
interface FilterStoreLike {
  on(event: string, handler: (args: { collection?: string; objectId?: string }) => void): void;
  off(event: string, handler: (args: { collection?: string; objectId?: string }) => void): void;
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
 * from Query Records.
 *
 * ⚠️ **NDA-017 §2 rewrote the sentence that used to be here.** It read: "The `filter` input
 * decides whether it re-runs on its own: every setter here consults
 * `isInputConnected('filter')` and stays passive when something else is driving it
 * explicitly." That was an accurate description of the trap, written as if it were the
 * design. Nothing about wiring `Filter` changes what the other ports do any more; the
 * checkboxes do, and only when an author ticks them off.
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
    visualSorting?: VisualSorting[];
    collectionChangedCallback?: () => void;
    cloudStoreEvents?: (args: { collection?: string; objectId?: string }) => void;
    /** Message for the `Error` output; see NDA-004 §2. */
    lastError?: string;
    /** Last message actually raised, so a repeat is not re-announced. */
    lastReportedError?: string;
    /** NDA-004 §2 — did an author *ask* for this run? See `scheduleFilter`. */
    filterRequested?: boolean;
    /** The `Backend` picker's value: a backend id, `'_endpoint_'`, or `'_active_'`. */
    backendId?: string;
    /** The store this node's `save` subscription is currently on. */
    boundStore?: FilterStoreLike;
  };
  /** On the instance rather than in `_internal` — guards {@link scheduleFilter}. */
  collectionChangedScheduled?: boolean;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike | undefined): void;
  bindStoreEvents(store: FilterStoreLike | undefined): void;
  getLimit(): number | undefined;
  getSkip(): number | undefined;
  scheduleFilter(): void;
  requestFilter(): void;
  reportFailure(code: string, message: string, detail?: unknown): void;
  setCollectionName(name: string): void;
  setVisualFilter(value: unknown): void;
  setVisualSorting(value: unknown[]): void;
  setFilterParameter(name: string, value: unknown): void;
}

const FilterDBModelsNode: NodeDefinitionOptions = {
  name: 'FilterDBModels',
  docs: 'https://docs.noodl.net/nodes/data/cloud-data/filter-records',
  displayNodeName: 'Filter Records',
  category: 'Data',
  color: 'data',
  /**
   * NDA-017 §2. `Filter` is this family's control signal, and it governed five kinds of
   * thing. Four checkboxes rather than one per port, because that is how the node already
   * describes itself and how an author thinks about it:
   *
   * - `items` and `enabled` — real value inputs, one box each.
   * - `records` — the subscription to the underlying collection and the cloud-store events.
   *   Not a port.
   * - `filterSettings` — the visual filter, the visual sorting and the catch-all setter.
   *   These are `allowEditOnly` panel editors, so "re-run when I edit the filter I am
   *   looking at" is one decision, not three.
   *
   * The `fp-` filter *parameters* are different and do get one box each, minted in
   * `registerInputIfNeeded`: they are ports an author wires, and "re-filter when the search
   * text changes but not when the category does" is a thing someone will want.
   */
  runOnValueChange: {
    controlSignal: 'filter',
    inputs: ['items', 'enabled'],
    sources: [
      { name: 'records', displayName: 'Record changes' },
      { name: 'filterSettings', displayName: 'Filter settings' }
    ]
  },
  initialize: function (this: FilterDbModelsInstance) {
    const _this = this;

    this._internal.collectionChangedCallback = function () {
      if (!_this.shouldRunOnValueChange('records')) return;

      _this.scheduleFilter();
    };

    this._internal.cloudStoreEvents = function (args: { collection?: string; objectId?: string }) {
      if (!_this.shouldRunOnValueChange('records')) return;

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

    // BCN-004 step 5: bound to the legacy store here, exactly as before, and moved by
    // `bindStoreEvents` when the `Backend` input names another one. A node watching the
    // wrong backend's saves re-filters when nothing it holds has changed, and does not
    // re-filter when something has.
    this.bindStoreEvents(CloudStore.instance);

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
      description: 'The records to filter, normally the Items output of a Query Records node',
      set(this: FilterDbModelsInstance, value: unknown) {
        this.bindCollection(value as CollectionLike);
        if (this.shouldRunOnValueChange('items')) this.scheduleFilter();
      }
    },
    enabled: {
      type: 'boolean',
      group: 'General',
      displayName: 'Enabled',
      default: true,
      description: 'Passes every record through unchanged when off, rather than emptying the result',
      set: function (this: FilterDbModelsInstance, value: unknown) {
        this._internal.enabled = value as boolean;
        if (this.shouldRunOnValueChange('enabled')) this.scheduleFilter();
      }
    },
    filter: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Filter',
      description:
        'Re-runs the filter now. This is additional to it re-running when Items, Enabled, the filter settings or the records themselves change; untick any of those under Run On Value Change to stop it',
      valueChangedToTrue: function (this: FilterDbModelsInstance) {
        this.requestFilter();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      description: 'The records that matched, after Sorting, Skip and Limit have been applied',
      getter: function (this: FilterDbModelsInstance) {
        return this._internal.filteredCollection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Record Id',
      group: 'General',
      description: 'Id of the first record in the result, and nothing at all when the result is empty',
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
      description: 'How many records are in the result after Skip and Limit, not how many matched the filter',
      getter: function (this: FilterDbModelsInstance) {
        return this._internal.filteredCollection ? this._internal.filteredCollection.size() : 0;
      }
    },
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Filtered',
      description: 'Fires each time the result has been rebuilt, including when the same records come back'
    },
    // NDA-004 §2 — see `scheduleFilter`. Array Filter's twin, structurally and in its fix.
    failure: {
      group: 'Events',
      type: 'signal',
      displayName: 'Failure',
      description: 'Fires when the filter could not be applied, or when Filter was triggered with nothing on Items'
    },
    error: {
      group: 'Events',
      type: 'string',
      displayName: 'Error',
      description: 'Why the most recent failed run failed, kept after a later run succeeds',
      getter: function (this: FilterDbModelsInstance) {
        return this._internal.lastError;
      }
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
    /** Move the `save` subscription onto `store`, off whatever it was on. */
    bindStoreEvents: function (this: FilterDbModelsInstance, store: FilterStoreLike | undefined) {
      const previous = this._internal.boundStore;
      if (previous === store) return;

      if (previous) previous.off('save', this._internal.cloudStoreEvents);
      this._internal.boundStore = store;
      if (store) store.on('save', this._internal.cloudStoreEvents);
    },
    _onNodeDeleted: function (this: FilterDbModelsInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.unbindCurrentCollection();

      this.bindStoreEvents(undefined);
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
    /**
     * NDA-004 §2 — Array Filter's twin, read rather than assumed to be one.
     *
     * The register grouped these two, and the phase's own warning is that grouping predicts
     * where to read next and nothing about the answers. Read: same six trigger paths, same
     * guard on every value-arrival one, same bare `if (!this._internal.collection) return;`.
     * It is genuinely the same defect, so it gets the same fix — the flag that records
     * whether an author asked for this run.
     *
     * (That shared guard was `isInputConnected('filter') === false`; NDA-017 §2 replaced it
     * with a per-input checkbox on both twins. The reasoning above is unaffected — the
     * *trigger paths* are what made them twins, not what gated them.)
     */
    requestFilter: function (this: FilterDbModelsInstance) {
      this._internal.filterRequested = true;
      this.scheduleFilter();
    },
    reportFailure: function (this: FilterDbModelsInstance, code: string, message: string, detail?: unknown) {
      const internal = this._internal;
      internal.lastError = message;
      this.flagOutputDirty('error');

      if (internal.lastReportedError === message) return;
      internal.lastReportedError = message;

      this.raiseRuntimeError(code, message, detail);
      this.sendSignalOnOutput('failure');
    },
    scheduleFilter: function (this: FilterDbModelsInstance) {
      if (this.collectionChangedScheduled) return;
      this.collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.collectionChangedScheduled = false;

        const requested = this._internal.filterRequested === true;
        this._internal.filterRequested = false;

        if (!this._internal.collection) {
          // Silent unless an author asked: without this test the raise fires while the graph
          // boots, on the `enabled` default landing before the records do.
          if (requested) {
            this.reportFailure(
              'filter-records/no-items',
              'Nothing to filter — no records are connected to the Items input'
            );
          }
          return;
        }

        // Apply filter and write to output collection
        let filtered: ModelLike[] = [].concat(this._internal.collection.items);

        if (this._internal.enabled) {
          const _filter = this._internal.visualFilter;
          if (_filter !== undefined) {
            let filter;
            try {
              filter = QueryUtils.convertVisualFilter(_filter, {
                queryParameters: this._internal.filterParameters,
                collectionName: this._internal.collectionName,
                valuePortPrefix: 'fp-'
              });
              if (filter) filtered = filtered.filter((m) => QueryUtils.matchesQuery(m, filter));
            } catch (e) {
              // Array Filter's second failure, in the same position: a filter that cannot be
              // built or applied threw out of a *scheduled callback* into `nodecontext.ts`'s
              // blanket catch — a console line with no code and no provenance, and the rest of
              // this node's update pass abandoned. Not gated on `requested`, because a filter
              // that cannot be applied is wrong whenever it arrives.
              this.reportFailure(
                'filter-records/filter-failed',
                'The filter could not be applied: ' + ((e as Error).message || String(e)),
                { collectionName: this._internal.collectionName }
              );
              return;
            }
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

        // A run that got here worked; re-arm the dedup.
        this._internal.lastReportedError = undefined;

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

      if (this.shouldRunOnValueChange('filterSettings')) this.scheduleFilter();
    },
    setVisualSorting: function (this: FilterDbModelsInstance, value: VisualSorting[]) {
      this._internal.visualSorting = value;

      if (this.shouldRunOnValueChange('filterSettings')) this.scheduleFilter();
    },
    setFilterParameter: function (this: FilterDbModelsInstance, name: string, value: unknown) {
      this._internal.filterParameters[name] = value;

      // One box per filter parameter — see the note on `runOnValueChange` above. Keyed by the
      // *port* name (`fp-<name>`), which is what `registerRunOnValueChangeInput` minted.
      if (this.shouldRunOnValueChange('fp-' + name)) this.scheduleFilter();
    },
    registerInputIfNeeded: function (this: FilterDbModelsInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'collectionName')
        return this.registerInput(name, {
          set: this.setCollectionName.bind(this)
        });

      // BCN-004 step 5. Nothing is sent to this backend — the subscription is the only
      // thing that moves, because the class this node filters lives there.
      if (name === 'backendId')
        return this.registerInput(name, {
          set: (value: string) => {
            this._internal.backendId = value;
            this.bindStoreEvents(CloudStore.forBackend(this.nodeScope.modelScope, value) || CloudStore.instance);
          }
        });

      if (name === 'visualFilter')
        return this.registerInput(name, {
          set: this.setVisualFilter.bind(this)
        });

      if (name === 'visualSorting')
        return this.registerInput(name, {
          set: this.setVisualSorting.bind(this)
        });

      if (name.startsWith('fp-')) {
        this.registerInput(name, {
          set: this.setFilterParameter.bind(this, name.substring('fp-'.length))
        });
        // Labelled with the parameter, not the port: `fp-` is an implementation prefix.
        this.registerRunOnValueChangeInput(name, name.substring('fp-'.length));
        return;
      }

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    }
  }
};

function userInputSetter(this: FilterDbModelsInstance, name: string, value: unknown) {
  /* jshint validthis:true */
  this._internal.filterSettings[name] = value;
  if (this.shouldRunOnValueChange('filterSettings')) this.scheduleFilter();
}

/**
 * Drop the Parse property types this node's filter cannot ask questions about.
 *
 * Preserved verbatim from the loop it replaces (`_supportedTypes`), and only for the
 * Parse-shaped schema: the builder's own `parseSchema.ts` drops the same set again on its
 * side, and the BYOB-shaped `{collection, fields}` was never pruned here.
 */
function filterableSchema(schema: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!schema) return null;
  const properties = schema.properties as Record<string, { type?: string }> | undefined;
  if (!properties) return schema;

  const supported: Record<string, boolean> = {
    Boolean: true,
    String: true,
    Date: true,
    Number: true,
    Pointer: true
  };

  const kept: Record<string, { type?: string }> = {};
  for (const key in properties) {
    if (supported[properties[key]?.type]) kept[key] = properties[key];
  }

  return Object.assign({}, schema, { properties: kept });
}

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike,
  graphModel: GraphModelLike
) {
  const ports: RuntimeDiscoveredPort[] = [];

  // BCN-004 step 5. This node filters an array it is *given*, in memory — the backend it
  // names is what supplies the Class list and the schema the filter builder is drawn from,
  // not a place it sends anything. It gets the picker for that reason and no other.
  const ctx = recordSchemaContext(graphModel, parameters);
  ports.push(...recordBackendPickerPorts(ctx));
  ports.push(...recordClassPorts(ctx));

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

  // DEFECT (PLAT-003 NOTES §27.3) — **fixed as a side effect of BCN-004 step 5**, and
  // recorded rather than left silent. This guard tested only `collectionName` while the
  // `enums` above had already established that the metadata may be absent, so a Filter
  // Records node with a class selected threw a `TypeError` on `.find` whenever it had not
  // arrived. `recordFilterSchema` answers `null` for that case instead of dereferencing,
  // so the crash has nowhere left to happen.
  if (parameters.collectionName !== undefined) {
    const schema = filterableSchema(recordFilterSchema(ctx));
    if (schema) {
      ports.push({
        name: 'visualFilter',
        plug: 'input',
        type: {
          name: 'query-filter',
          schema: schema,
          allowEditOnly: true,
          // BCN-003b: the builder greys out what this backend cannot express,
          // using the same descriptor cell the translator refuses on. BCN-004 step 5: and
          // it is this node's own backend now rather than the singleton's.
          backend: recordFilterBackendType(ctx, QueryUtils.backendType()),
          valuePortPrefix: 'fp-'
        },
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
      // Find all input ports. Both saved shapes are read — a project that has
      // not been opened since BCN-003b still holds `{combinator, rules}`, and a
      // port that stopped being declared takes its wire with it.
      QueryUtils.collectFilterParameters(parameters.visualFilter as VisualFilterQuery, 'fp-').forEach((input) => {
        ports.push({
          name: 'fp-' + input,
          plug: 'input',
          type: '*',
          displayName: input,
          group: 'Filter Parameters'
        });
        // NDA-017 §2. The runtime mints the matching checkbox in `registerInputIfNeeded`;
        // this is the editor's half, without which it exists but cannot be ticked.
        ports.push(...runOnChangeDynamicPorts(['fp-' + input], { ['fp-' + input]: input }));
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

  sendSchemaPorts(editorConnection, nodeId, ports, { staticPorts: staticPortNames(FilterDBModelsNode) });
}

const FilterDBModelsNodeModule: NodeModule = {
  node: FilterDBModelsNode,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.FilterDBModels', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection, graphModel);

      node.on('parameterUpdated', function () {
        updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
      });

      // The four metadata keys the ports are now built from. `data` used to be threaded
      // through as the collection list; the port builder reads the graph model itself, so
      // a change to any of them redraws the same way.
      for (const key of ['dbCollections', 'systemCollections', 'backendServices', 'cloudservices']) {
        graphModel.on('metadataChanged.' + key, function () {
          CloudStore.invalidateCollections();
          updatePorts(node.id, node.parameters, context.editorConnection, graphModel);
        });
      }
    });
  }
};

export = FilterDBModelsNodeModule;
