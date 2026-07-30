'use strict';

import { Node } from '@noodl/runtime';
import Collection from '@noodl/runtime/src/collection';
import Model from '@noodl/runtime/src/model';
import type {
  CollectionLike,
  EditorConnectionLike,
  GraphNodeModel,
  InspectInfo,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';


/** The comparison operators {@link applyFilter} understands, as authored port suffixes. */
type FilterOperator = 'eq' | 'neq' | 'gt' | 'lt' | 'gte' | 'lte' | 'regex';

/**
 * One property's test, keyed by `'$' + operator`. `$case` is not an operator — it is the
 * case-sensitivity flag that accompanies `$regex`.
 */
type PropertyFilter = Partial<Record<`$${FilterOperator}`, unknown>> & { $case?: boolean };

/** The whole filter: one {@link PropertyFilter} per property the author listed. */
type Filter = Record<string, PropertyFilter>;

/** Sort direction per property: `1` ascending, `-1` descending. */
type SortSpec = Record<string, 1 | -1>;

/**
 * Tests one record's raw `data` against `filter`.
 *
 * `$neq` is checked first and is the only operator that tolerates a missing property —
 * every other operator treats "property absent" as an immediate non-match, so a `$eq`
 * against `undefined` never succeeds. Comparisons are deliberately loose (`==`, not
 * `===`), which is what lets a numeric filter value match a CSV column of strings.
 */
function applyFilter(item: Record<string, unknown>, filter: Filter): boolean {
  for (const key in filter) {
    const op = filter[key];

    //check neq first, it's the only operation where the key can be undefined
    if (op['$neq'] !== undefined) {
      if (!(item[key] != op['$neq'])) return false;
    } else if (item[key] === undefined) return false;
    // The key does not exist, always return false
    else if (op['$eq'] !== undefined && !(item[key] == op['$eq'])) return false;
    else if (op['$gt'] !== undefined && !(item[key] > op['$gt'])) return false;
    else if (op['$lt'] !== undefined && !(item[key] < op['$lt'])) return false;
    else if (op['$gte'] !== undefined && !(item[key] >= op['$gte'])) return false;
    else if (op['$lte'] !== undefined && !(item[key] <= op['$lte'])) return false;
    else if (op['$regex'] !== undefined) {
      // Test if string matches regex
      const a = item[key] + ''; // Convert to string
      const regex = new RegExp(op['$regex'] as string, op['$case'] !== true ? 'i' : undefined);

      if (!regex.test(a)) return false;
    }
  }

  return true;
}

/**
 * `Array.prototype.sort` comparator, bound to a {@link SortSpec} as `this`.
 *
 * It sorts on the first property whose values differ, so the spec's key order is the
 * tie-breaking order.
 */
function sorter(this: SortSpec, a: ModelLike | Record<string, unknown>, b: ModelLike | Record<string, unknown>) {
  if (a instanceof Model) a = a.data;
  if (b instanceof Model) b = b.data;

  for (const key in this) {
    const _a = (a as Record<string, unknown>)[key];
    const _b = (b as Record<string, unknown>)[key];
    if (_a !== _b) {
      if (typeof _a === 'string' && typeof _b === 'string') {
        if (this[key] === 1) {
          return _a > _b ? 1 : -1;
        } else return _a > _b ? -1 : 1;
      } else if (typeof _a === 'number' && typeof _b === 'number') {
        return this[key] === 1 ? _a - _b : _b - _a;
      } else {
        if (this[key] === 1) {
          return _a > _b ? 1 : -1;
        } else return _a > _b ? -1 : 1;
      }
    }
  }
  return 0;
}

/** `this` inside the Array Filter node. */
interface FilterCollectionInstance extends NodeInstance {
  _internal: {
    collection?: CollectionLike;
    /** Rebuilt from scratch on every run — a fresh collection, never mutated in place. */
    filteredCollection?: CollectionLike;
    enabled?: boolean;
    /**
     * Every dynamic input the editor sent, verbatim and unparsed —
     * `filterFilter`, `filterSort`, `filterEnableLimit`, and the per-property
     * `filterFilterOp-…`/`filterFilterValue-…`/`filterSort-…` entries. The `get…` methods
     * below are what turn this flat bag into a {@link Filter}, {@link SortSpec} and limit.
     */
    filterSettings: Record<string, string | number | boolean | undefined>;
    collectionChangedCallback(): void;
    /** Message for the `Error` output; see NDA-004. */
    lastError?: string;
    /** Last message actually raised, so a repeat is not re-announced. Expression's shape. */
    lastReportedError?: string;
    /**
     * NDA-004 §2 — did an author *ask* for this run?
     *
     * Sticky across the coalescing window on purpose: if a value arrival schedules a run and a
     * `Filter` pulse lands before the callback fires, the author did ask, and the run that
     * happens is the one they asked for.
     */
    filterRequested?: boolean;
  };
  collectionChangedScheduled?: boolean;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike): void;
  getFilter(): Filter | undefined;
  getSort(): SortSpec | undefined;
  getLimit(): number | undefined;
  getSkip(): number | undefined;
  scheduleFilter(): void;
  requestFilter(): void;
  reportFailure(code: string, message: string, detail?: unknown): void;
}

const FilterCollectionNode: NodeDefinitionOptions = {
  name: 'Filter Collection',
  docs: 'https://docs.noodl.net/nodes/data/array/array-filter',
  displayNodeName: 'Array Filter',
  shortDesc: 'Filter, sort and limit array',
  category: 'Data',
  color: 'data',
  initialize: function (this: FilterCollectionInstance) {
    this._internal.collectionChangedCallback = () => {
      if (this.isInputConnected('filter') === true) return;

      this.scheduleFilter();
    };

    this._internal.enabled = true;
    this._internal.filterSettings = {};
    //this._internal.filteredCollection = Collection.get();
  },
  getInspectInfo(this: FilterCollectionInstance): InspectInfo {
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
      set(this: FilterCollectionInstance, value: CollectionLike) {
        this.bindCollection(value);
        if (this.isInputConnected('filter') === false) this.scheduleFilter();
      }
    },
    enabled: {
      type: 'boolean',
      group: 'General',
      displayName: 'Enabled',
      default: true,
      set: function (this: FilterCollectionInstance, value: boolean) {
        this._internal.enabled = value;
        if (this.isInputConnected('filter') === false) this.scheduleFilter();
      }
    },
    filter: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Filter',
      valueChangedToTrue: function (this: FilterCollectionInstance) {
        this.requestFilter();
      }
    },
    // NDA-013: same signal as `filter` above, under the name the rest of the Array family
    // (Repeater, Array Map) uses for "recompute now". `scheduleFilter` already re-reads
    // `this._internal.collection.items` fresh on every run — Filter never kept a private
    // copy that could go stale the way the Repeater's did — so this needed no other change.
    refresh: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Refresh',
      valueChangedToTrue: function (this: FilterCollectionInstance) {
        this.requestFilter();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      group: 'General',
      getter: function (this: FilterCollectionInstance) {
        return this._internal.filteredCollection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Item Id',
      group: 'General',
      getter: function (this: FilterCollectionInstance) {
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
      getter: function (this: FilterCollectionInstance) {
        return this._internal.filteredCollection ? this._internal.filteredCollection.size() : 0;
      }
    },
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Filtered'
    },
    failure: {
      group: 'Events',
      type: 'signal',
      displayName: 'Failure'
    },
    error: {
      group: 'Events',
      type: 'string',
      displayName: 'Error',
      getter: function (this: FilterCollectionInstance) {
        return this._internal.lastError;
      }
    }
  },
  prototypeExtensions: {
    unbindCurrentCollection: function (this: FilterCollectionInstance) {
      const collection = this._internal.collection;
      if (!collection) return;
      collection.off('change', this._internal.collectionChangedCallback);
      this._internal.collection = undefined;
    },
    bindCollection: function (this: FilterCollectionInstance, collection: CollectionLike) {
      this.unbindCurrentCollection();
      this._internal.collection = collection;
      collection && collection.on('change', this._internal.collectionChangedCallback);
    },
    _onNodeDeleted: function (this: FilterCollectionInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.unbindCurrentCollection();
    },
    getFilter: function (this: FilterCollectionInstance): Filter | undefined {
      const filterSettings = this._internal.filterSettings;

      const options = ['case']; // List all supported options here

      if (filterSettings['filterFilter']) {
        const filters = String(filterSettings['filterFilter']).split(',');
        const _filter: Filter = {};
        filters.forEach(function (f) {
          const op = ('$' + (filterSettings['filterFilterOp-' + f] || 'eq')) as `$${FilterOperator}`;
          _filter[f] = {};
          _filter[f][op] = filterSettings['filterFilterValue-' + f];

          options.forEach((o) => {
            const option = filterSettings['filterFilterOption-' + o + '-' + f];
            if (option) _filter[f][('$' + o) as '$case'] = option as boolean;
          });
        });
        return _filter;
      }
    },
    getSort: function (this: FilterCollectionInstance): SortSpec | undefined {
      const filterSettings = this._internal.filterSettings;

      if (filterSettings['filterSort']) {
        const sort = String(filterSettings['filterSort']).split(',');
        const _sort: SortSpec = {};
        sort.forEach(function (s) {
          _sort[s] = filterSettings['filterSort-' + s] === 'descending' ? -1 : 1;
        });
        return _sort;
      }
    },
    getLimit: function (this: FilterCollectionInstance): number | undefined {
      const filterSettings = this._internal.filterSettings;

      if (!filterSettings['filterEnableLimit']) return;
      else return (filterSettings['filterLimit'] as number) || 10;
    },
    getSkip: function (this: FilterCollectionInstance): number | undefined {
      const filterSettings = this._internal.filterSettings;

      if (!filterSettings['filterEnableLimit']) return;
      else return (filterSettings['filterSkip'] as number) || 0;
    },
    /**
     * NDA-004 §2 — the family's genuinely mixed case, and what makes the `Failure` port safe.
     *
     * `scheduleFilter` is reached six ways: the `Filter` and `Refresh` signals, and — only when
     * `filter` is *not* wired — the `items` setter, the `enabled` setter, any `filter…` setting
     * arriving, and the source collection's own change callback. The last four are value
     * arrivals, so failing in the scheduler would report on the ordinary boot path: this is the
     * Object node's trap, in a node that also has a real `Do`.
     *
     * The distinction the register asked for therefore exists already, in inverted form — every
     * value-arrival path is guarded by `isInputConnected('filter') === false`. What was missing
     * was a record of *which* kind of run this is, and that is all `filterRequested` is.
     */
    requestFilter: function (this: FilterCollectionInstance) {
      this._internal.filterRequested = true;
      this.scheduleFilter();
    },
    reportFailure: function (this: FilterCollectionInstance, code: string, message: string, detail?: unknown) {
      const internal = this._internal;
      internal.lastError = message;
      this.flagOutputDirty('error');

      // Deduped by message, re-armed by the next good run — Expression's shape, and it matters
      // more here: a `regex` value can be *wired*, so an author typing one produces a run per
      // keystroke and most of the intermediate values are malformed.
      if (internal.lastReportedError === message) return;
      internal.lastReportedError = message;

      this.raiseRuntimeError(code, message, detail);
      this.sendSignalOnOutput('failure');
    },
    scheduleFilter: function (this: FilterCollectionInstance) {
      if (this.collectionChangedScheduled) return;
      this.collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.collectionChangedScheduled = false;

        const requested = this._internal.filterRequested === true;
        this._internal.filterRequested = false;

        if (!this._internal.collection) {
          // Silent unless an author asked. Without the `requested` test this fires while the
          // graph boots, every time an `enabled` default or a filter setting lands before the
          // array does — which is the whole reason this node was left ⏳ when its five siblings
          // were decided.
          if (requested) {
            this.reportFailure(
              'array-filter/no-items',
              'Nothing to filter — no array is connected to the Items input'
            );
          }
          return;
        }

        // Apply filter and write to output collection
        let filtered: ModelLike[] = [].concat(this._internal.collection.items); // Make sure we clone the array

        if (this._internal.enabled) {
          const filter = this.getFilter();
          const sort = this.getSort();
          try {
            if (filter) filtered = filtered.filter((m) => applyFilter(m.data, filter));
            if (sort) filtered.sort(sorter.bind(sort));
          } catch (e) {
            /**
             * The failure the triage did not predict, and the more damaging of the two.
             *
             * `applyFilter` builds a `RegExp` from the author's `Value` port on every item, so a
             * malformed pattern — `[`, a stray `(` — throws *out of this scheduled callback*. It
             * lands in `nodecontext.ts`'s blanket catch, which only `console.error`s, so the rest
             * of this node's update pass is abandoned and the sole diagnosis is an unstructured
             * console line with no code and no provenance. Clear Array's shape (an uncaught
             * `TypeError`), reachable here from an ordinary typo in a text field — and the Value
             * port is connectable, so a wire can deliver one too.
             *
             * Not gated on `requested`: a pattern that cannot compile is wrong whenever it
             * arrives, and unlike "no array yet" it is never a state the graph passes through on
             * its way to working.
             */
            this.reportFailure(
              'array-filter/filter-failed',
              'The filter could not be applied: ' + ((e as Error).message || String(e)),
              { filter, sort }
            );
            return;
          }

          const skip = this.getSkip();
          if (skip) filtered = filtered.slice(skip, filtered.length);

          const limit = this.getLimit();
          if (limit) filtered = filtered.slice(0, limit);
        }

        // A run that got here worked. Re-arm the dedup so the *next* occurrence of the same
        // message is announced again rather than swallowed as a repeat.
        this._internal.lastReportedError = undefined;

        this._internal.filteredCollection = Collection.create(filtered);

        this.sendSignalOnOutput('modified');
        this.flagOutputDirty('firstItemId');
        this.flagOutputDirty('items');
        // this.flagOutputDirty('firstItem');
        this.flagOutputDirty('count');
      });
    },
    /**
     * Accepts *any* dynamic input name, unlike the prefix-matching nodes elsewhere in this
     * group — the whole `filter…` port set is generated below, so there is nothing to
     * match against.
     */
    registerInputIfNeeded: function (this: FilterCollectionInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      this.registerInput(name, {
        set: userInputSetter.bind(this, name)
      });
    }
  }
};

function userInputSetter(this: FilterCollectionInstance, name: string, value: string | number | boolean) {
  this._internal.filterSettings[name] = value;
  if (this.isInputConnected('filter') === false) this.scheduleFilter();
}

function updatePorts(
  nodeId: string,
  parameters: Record<string, unknown>,
  editorConnection: EditorConnectionLike
): void {
  const ports = [];

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

  ports.push({
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Filter',
    name: 'filterFilter',
    displayName: 'Filter'
  });

  ports.push({
    type: { name: 'stringlist', allowEditOnly: true },
    plug: 'input',
    group: 'Sort',
    name: 'filterSort',
    displayName: 'Sort'
  });

  const filterOps: Record<string, { value: FilterOperator; label: string }[]> = {
    string: [
      { value: 'eq', label: 'Equals' },
      { value: 'neq', label: 'Not Equals' },
      { value: 'regex', label: 'Matches RegEx' }
    ],
    boolean: [
      { value: 'eq', label: 'Equals' },
      { value: 'neq', label: 'Not Equals' }
    ],
    number: [
      { value: 'eq', label: 'Equals' },
      { value: 'neq', label: 'Not Equals' },
      { value: 'lt', label: 'Less than' },
      { value: 'gt', label: 'Greater than' },
      { value: 'gte', label: 'Greater than or equal' },
      { value: 'lte', label: 'Less than or equal' }
    ]
  };

  if (parameters['filterFilter']) {
    const filters = String(parameters['filterFilter']).split(',');
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
        name: 'filterFilterType-' + f
      });

      const type = parameters['filterFilterType-' + f] as string | undefined;

      // String filter type
      ports.push({
        type: { name: 'enum', enums: filterOps[type || 'string'] },
        default: 'eq',
        plug: 'input',
        group: f + ' filter',
        displayName: 'Op',
        editorName: f + ' filter| Op',
        name: 'filterFilterOp-' + f
      });

      // Case sensitivite option
      if (parameters['filterFilterOp-' + f] === 'regex') {
        ports.push({
          type: 'boolean',
          default: false,
          plug: 'input',
          group: f + ' filter',
          displayName: 'Case sensitive',
          editorName: f + ' filter| Case',
          name: 'filterFilterOption-case-' + f
        });
      }

      ports.push({
        type: type || 'string',
        plug: 'input',
        group: f + ' filter',
        displayName: 'Value',
        editorName: f + ' Filter Value',
        name: 'filterFilterValue-' + f
      });
    });
  }

  if (parameters['filterSort']) {
    const sorts = String(parameters['filterSort']).split(',');
    sorts.forEach((f) => {
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
        name: 'filterSort-' + f
      });
    });
  }

  editorConnection.sendDynamicPorts(nodeId, ports);
}

const FilterCollectionModule: NodeModule = {
  node: FilterCollectionNode,
  setup: function (context: NodeContextLike, graphModel) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }

    graphModel.on('nodeAdded.Filter Collection', function (node: GraphNodeModel) {
      updatePorts(node.id, node.parameters, context.editorConnection);

      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name.startsWith('filter')) {
          updatePorts(node.id, node.parameters, context.editorConnection);
        }
      });

      graphModel.on('metadataChanged.dbCollections', function () {
        updatePorts(node.id, node.parameters, context.editorConnection);
      });
    });
  }
};

export default FilterCollectionModule;
