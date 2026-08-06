'use strict';

import Node = require('../../../node');
import Collection = require('../../../collection');
import Model = require('../../../model');
import { outcomeOutputs, reportOutcomes } from '../../../outcome';
import type {
  CollectionLike,
  EditorConnectionLike,
  GraphNodeModel,
  InspectInfo,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
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
     * NDA-004 §2 — did an author *ask* for this run, and how many times?
     *
     * ERG-001 §4 replaced the `filterRequested` boolean this used to be with the contract's own
     * mechanism rather than running two flags side by side: one token per `Filter`/`Refresh`
     * pulse, and "an author asked" is `tokens.length > 0`. It is sticky across the coalescing
     * window for exactly the reason the boolean was — if a value arrival schedules a run and a
     * `Filter` pulse lands before the callback fires, the author did ask, and the run that
     * happens is the one they asked for. ⚠️ Created lazily in `requestFilter`, not in
     * `initialize`.
     */
    pendingFilterOutcomes?: OutcomeToken[];
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
  reportFailure(code: string, message: string, detail?: unknown, tokens?: OutcomeToken[]): void;
}

const FilterCollectionNode: NodeDefinitionOptions = {
  name: 'Filter Collection',
  docs: 'https://docs.noodl.net/nodes/data/array/array-filter',
  displayNodeName: 'Array Filter',
  category: 'Data',
  color: 'data',
  // NDA-017 §2. The twin `filterdbmodelsnode.ts` names in its own NDA-004 comment, and it
  // gets the same treatment: `items` and `enabled` are value setters, the collection
  // subscription and the panel-edited filter settings are not ports.
  runOnValueChange: {
    controlSignal: 'filter',
    inputs: ['items', 'enabled'],
    sources: [
      { name: 'array', displayName: 'Array contents' },
      { name: 'filterSettings', displayName: 'Filter settings' }
    ]
  },
  initialize: function (this: FilterCollectionInstance) {
    this._internal.collectionChangedCallback = () => {
      if (!this.shouldRunOnValueChange('array')) return;

      this.scheduleFilter();
    };

    /**
     * ⚠️ **Load-bearing, and it looks redundant beside `enabled`'s `default: true`.** It is not:
     * a declared `default` never runs its setter — `initializeDefaultValues` writes it into
     * `_inputValues` and returns (`nodedefinition.ts:161`, called at `:481`) — so this line is
     * the only thing that establishes `_internal.enabled`, and without it the `if
     * (this._internal.enabled)` in `scheduleFilter` reads `undefined` and the node passes
     * **everything** through unfiltered. CWF-008 filed exactly that defect against this node;
     * measured, it was Array Map's (whose `mapScript` default had no `initialize` behind it),
     * and this line is why. Asserted in `test/nodes/array-family-declared-defaults.test.ts` so
     * that deleting it cannot pass silently.
     */
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
      description:
        'Array to filter; the node re-runs whenever this array changes, unless you untick it under Run On Value Change',
      group: 'General',
      set(this: FilterCollectionInstance, value: CollectionLike) {
        this.bindCollection(value);
        if (this.shouldRunOnValueChange('items')) this.scheduleFilter();
      }
    },
    enabled: {
      type: 'boolean',
      group: 'General',
      displayName: 'Enabled',
      description: 'When false the input array passes straight through — unfiltered, unsorted and unlimited',
      default: true,
      set: function (this: FilterCollectionInstance, value: boolean) {
        this._internal.enabled = value;
        if (this.shouldRunOnValueChange('enabled')) this.scheduleFilter();
      }
    },
    filter: {
      type: 'signal',
      group: 'Actions',
      displayName: 'Filter',
      description:
        'Runs the filter now and replaces Items with the result. This is additional to it re-running when Items, Enabled, the filter settings or the array contents change; untick any of those under Run On Value Change to stop it',
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
      description: 'Runs the filter now — the same action as Filter, under the name the rest of the Array family uses',
      valueChangedToTrue: function (this: FilterCollectionInstance) {
        this.requestFilter();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      description: 'A new array holding the records that passed, in sort order; the input array is never modified',
      group: 'General',
      getter: function (this: FilterCollectionInstance) {
        return this._internal.filteredCollection;
      }
    },
    firstItemId: {
      type: 'string',
      displayName: 'First Item Id',
      description: 'Id of the first record that passed, or empty when nothing matched',
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
      description: 'How many records passed the filter, after Skip and Limit have been applied',
      group: 'General',
      getter: function (this: FilterCollectionInstance) {
        return this._internal.filteredCollection ? this._internal.filteredCollection.size() : 0;
      }
    },
    /**
     * ⚠️ ERG-001 §4 — **kept, and deliberately not renamed to `Done`.**
     *
     * This is a *value-level* announcement, not an invocation's outcome. It fires from the
     * `items` setter, the `enabled` setter, any `filter…` panel setting arriving and the bound
     * collection's own `change` callback — each ticked by default under Run On Value Change.
     * Renamed, `Done` would fire on the boot path every time an array binds while `Completed`,
     * which only an invocation may emit, stayed silent: `Done` and `Completed` counts diverging
     * on a node doing nothing wrong is Rule 2 broken where its whole value lies.
     *
     * `For Each`'s `Items Rendered` is the same call in the same directory, and the cost — two
     * ports that co-fire on the port path — is recorded rather than hidden, as it was on `Array`.
     */
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Filtered',
      description:
        'Fires once the filter has run and Items is up to date, whether an author asked for the ' +
        'run or an input changed; wire Done instead for the outcome of a Filter you triggered'
    },
    /**
     * ⚠️ **No `Unchanged`.** Every run builds a fresh `Collection.create(...)`; "the same records
     * came back" is a result, not a post-condition that already held, so there is no state in
     * which this action declines to act. §5 must not expect a port here.
     */
    ...outcomeOutputs({
      done: 'Fires once a Filter or Refresh you triggered has run and Items is up to date',
      failure:
        'Fires when the filter could not be applied — a pattern that will not compile, or a Filter ' +
        'pulse with no array connected'
    }),
    error: {
      group: 'Events',
      type: 'string',
      displayName: 'Error',
      description: 'Why the last run failed, in one sentence; empty until something fails',
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
     * `scheduleFilter` is reached six ways: the `Filter` and `Refresh` signals, and — when the
     * corresponding box is ticked — the `items` setter, the `enabled` setter, any `filter…`
     * setting arriving, and the source collection's own change callback. The last four are
     * value arrivals, so failing in the scheduler would report on the ordinary boot path: this
     * is the Object node's trap, in a node that also has a real `Do`.
     *
     * The distinction the register asked for therefore exists already, in inverted form — every
     * value-arrival path is gated on the author having left it ticked. What was missing was a
     * record of *which* kind of run this is, and that is all `filterRequested` is.
     *
     * (Those gates read `isInputConnected('filter') === false` until NDA-017 §2. The reasoning
     * above is unaffected: it turns on *which paths* reach the scheduler, not on what gated
     * them — and all four are still value arrivals.)
     */
    requestFilter: function (this: FilterCollectionInstance) {
      // ERG-001 §4. Minted here, at the two ports that reach this method, and nowhere else:
      // `scheduleFilter` is also reached from four value-arrival paths and none of them is an
      // invocation an author asked for.
      const internal = this._internal;
      if (!internal.pendingFilterOutcomes) internal.pendingFilterOutcomes = [];
      internal.pendingFilterOutcomes.push(this.beginOutcome());
      this.scheduleFilter();
    },
    reportFailure: function (
      this: FilterCollectionInstance,
      code: string,
      message: string,
      detail?: unknown,
      tokens?: OutcomeToken[]
    ) {
      const internal = this._internal;
      internal.lastError = message;
      this.flagOutputDirty('error');

      // Deduped by message, re-armed by the next good run — Expression's shape, and it matters
      // more here: a `regex` value can be *wired*, so an author typing one produces a run per
      // keystroke and most of the intermediate values are malformed.
      const repeat = internal.lastReportedError === message;
      if (!repeat) {
        internal.lastReportedError = message;
        this.raiseRuntimeError(code, message, detail);
      }

      // ⚠️ ERG-001 §4 — the dedup is about the *announcement*, and it must not swallow an
      // outcome: Rule 1 is per invocation, so a second `Filter` with the same broken pattern
      // still owes its own `Failure` and `Completed`. `raise: false` because this method has
      // already decided whether the reason goes on the channel.
      if (tokens && tokens.length) {
        reportOutcomes(this, tokens, 'failure', { code, message, detail, raise: false });
        return;
      }

      // No token means no invocation: a malformed pattern arriving on a value path is announced
      // — it is wrong whenever it arrives — but it is not anyone's outcome.
      if (!repeat) this.sendSignalOnOutput('failure');
    },
    scheduleFilter: function (this: FilterCollectionInstance) {
      if (this.collectionChangedScheduled) return;
      this.collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.collectionChangedScheduled = false;

        // Drained into a local before the run starts, so a `Filter` arriving later owns its own
        // batch rather than being settled by this run's answer.
        const tokens = this._internal.pendingFilterOutcomes || [];
        this._internal.pendingFilterOutcomes = [];
        const requested = tokens.length > 0;

        if (!this._internal.collection) {
          // Silent unless an author asked. Without the `requested` test this fires while the
          // graph boots, every time an `enabled` default or a filter setting lands before the
          // array does — which is the whole reason this node was left ⏳ when its five siblings
          // were decided.
          if (requested) {
            this.reportFailure(
              'array-filter/no-items',
              'Nothing to filter — no array is connected to the Items input',
              undefined,
              tokens
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
              { filter, sort },
              tokens
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

        // Values first, then the value-level announcement, then the invocation's outcome last —
        // "announce after you update", and the outcome is the last thing an action does.
        this.flagOutputDirty('firstItemId');
        this.flagOutputDirty('items');
        // this.flagOutputDirty('firstItem');
        this.flagOutputDirty('count');
        this.sendSignalOnOutput('modified');
        reportOutcomes(this, tokens, 'done');
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
  if (this.shouldRunOnValueChange('filterSettings')) this.scheduleFilter();
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

export = FilterCollectionModule;
