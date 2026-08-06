'use strict';

import Node = require('../../../node');
import Collection = require('../../../collection');
import Model = require('../../../model');
import { outcomeOutputs, reportOutcomes } from '../../../outcome';
import type {
  CollectionLike,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule,
  OutcomeToken
} from '@noodl/types';


const defaultMapCode =
  'map({\n' +
  '\t// Here you add mappings between the input object and the mapped output object.\n' +
  "\t//myOutputProp: 'inputProp',\n" +
  "\t//anotherProperty: function(object) { return object.get('someProperty') + ' ' + object.get('otherProp') }\n" +
  '})\n';

/**
 * One entry of the object the author's script passes to `map(…)`: either the name of a
 * property to copy across, or a function computing the value from the source record.
 */
type PropertyMapping = string | ((model: ModelLike) => unknown);

/** The single argument the author's script is compiled against. */
type MapDeclarator = (mappings: Record<string, PropertyMapping>) => void;

/** `this` inside the Array Map node. */
interface MapCollectionInstance extends NodeInstance {
  _internal: {
    /** The bound source collection, or `undefined` between binds. */
    collection?: CollectionLike;
    /** Result of the last run. Fresh collection each time — never mutated in place. */
    mappedCollection?: CollectionLike;
    mapCode?: string;
    /**
     * The compiled script, or `undefined` when it failed to parse.
     *
     * NDA-012 (Data): the call site used to be unguarded, so a script with a syntax error threw a
     * `TypeError` out of the scheduled callback on every change — into `nodecontext.ts`'s blanket
     * catch, which only `console.error`s. `scheduleMap` now refuses instead, and says why.
     */
    mapFunc?: (map: MapDeclarator, object: ModelLike) => void;
    /** The compile diagnosis, held until a run actually needs the script. */
    mapCompileError?: string;
    /** Why the last run produced nothing; the `Error` output reads this. */
    lastError?: string;
    /** Last message actually raised, so a repeat is not re-announced. Array Filter's shape. */
    lastReportedError?: string;
    /**
     * Did an author *ask* for this run (a `Refresh` pulse), and how many times?
     *
     * ERG-001 §4 replaced the `mapRequested` boolean with the contract's own mechanism rather
     * than running two flags side by side — Array Filter's `pendingFilterOutcomes` verbatim,
     * including the stickiness across the coalescing window. ⚠️ Created lazily in `requestMap`.
     */
    pendingMapOutcomes?: OutcomeToken[];
    collectionChangedCallback(): void;
  };
  collectionChangedScheduled?: boolean;
  setCollection(collection: CollectionLike): void;
  unbindCurrentCollection(): void;
  bindCollection(collection: CollectionLike): void;
  scheduleMap(): void;
  requestMap(): void;
  compileMapScript(code: string): void;
  reportFailure(code: string, message: string, detail?: unknown, tokens?: OutcomeToken[]): void;
}

const MapCollectionNode: NodeDefinitionOptions = {
  name: 'Map Collection',
  docs: 'https://docs.noodl.net/nodes/data/array/array-map',
  displayNodeName: 'Array Map',
  category: 'Data',
  color: 'data',
  initialize: function (this: MapCollectionInstance) {
    this._internal.collectionChangedCallback = () => {
      this.scheduleMap();
    };

    /**
     * ⚠️ **The declared `default` below never runs its setter** — `initializeDefaultValues`
     * writes it straight into `_inputValues` and returns (`nodedefinition.ts:161`, called from
     * the constructor at `:481`), and only `setInputValue` reaches a setter. The setter is what
     * *compiles* the script, so an Array Map whose Script the author had never touched had
     * `mapFunc === undefined` and failed every run with `'could not be compiled: unknown
     * error'` — "unknown" because nothing had failed to compile; nothing had ever compiled.
     * Meanwhile the editor rendered the template into the Script field, so the node was
     * refusing to run a script the author could see. Filed by CWF-008, fixed here.
     *
     * Establishing it in `initialize` is Array Filter's answer to the same trap (`enabled` is
     * an inert `default` there too, and `initialize` sets `_internal.enabled` itself). It does
     * not schedule: nothing is bound yet, and a run queued from the constructor would put an
     * after-inputs callback on a node that has not been wired into the graph.
     */
    this.compileMapScript(defaultMapCode);

    //     this._internal.mappedCollection = Collection.get();
  },
  inputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      description: 'Array to map; the node re-runs whenever this array reports a change',
      group: 'General',
      set: function (this: MapCollectionInstance, value: CollectionLike) {
        this.setCollection(value);
        this.scheduleMap();
      }
    },
    mapScript: {
      type: {
        name: 'string',
        allowEditOnly: true,
        codeeditor: 'javascript'
      },
      displayName: 'Script',
      description:
        'Script run once per record, declaring the output properties through map({ … }); each ' +
        'entry is either a source property name or a function of the record',
      default: defaultMapCode,
      set: function (this: MapCollectionInstance, value: string) {
        this.compileMapScript(value);
        this.scheduleMap();
      }
    },
    // NDA-013: Array Map had no manual "recompute now" input at all — only the automatic
    // paths (`items`/`mapScript` changing, or a `change` event on the bound collection,
    // which a raw mutation such as `push` never fires — the A1 defect). `scheduleMap` reads
    // `this._internal.collection` fresh on every run, so pulsing this is enough to recover
    // from a source that changed without notifying.
    refresh: {
      type: 'signal',
      group: 'General',
      displayName: 'Refresh',
      description: 'Re-runs the mapping now, for a source array that changed without notifying',
      valueChangedToTrue: function (this: MapCollectionInstance) {
        this.requestMap();
      }
    }
  },
  outputs: {
    items: {
      type: 'array',
      displayName: 'Items',
      description: 'A new array of records built by the script; the source array is never modified',
      group: 'General',
      getter: function (this: MapCollectionInstance) {
        return this._internal.mappedCollection;
      }
    },
    count: {
      type: 'number',
      displayName: 'Count',
      description: 'How many records the last successful mapping produced',
      group: 'General',
      getter: function (this: MapCollectionInstance) {
        return this._internal.mappedCollection ? this._internal.mappedCollection.size() : 0;
      }
    },
    /**
     * ⚠️ ERG-001 §4 — kept, and deliberately not renamed to `Done`; Array Filter's `Filtered`
     * carries the reasoning. Here it is stronger still: the `items` and `mapScript` setters
     * reach `scheduleMap` *ungated* — this node has no Run On Value Change boxes — so a rename
     * would fire `Done` on the boot path of every graph that binds an array.
     */
    modified: {
      group: 'Events',
      type: 'signal',
      displayName: 'Changed',
      description:
        'Fires once the mapping has run and Items is up to date, whether an author asked for the ' +
        'run or an input changed; wire Done instead for the outcome of a Refresh you triggered'
    },
    /** ⚠️ **No `Unchanged`** — every run builds a fresh collection and cannot decline to act. */
    ...outcomeOutputs({
      done: 'Fires once a Refresh you triggered has run and Items is up to date',
      failure: 'Fires when the script could not be compiled, or threw while mapping a record'
    }),
    error: {
      group: 'Events',
      type: 'string',
      displayName: 'Error',
      description: 'Why the last mapping failed, in one sentence; empty until something fails',
      getter: function (this: MapCollectionInstance) {
        return this._internal.lastError;
      }
    }
  },
  prototypeExtensions: {
    /**
     * Compiles one script and records the verdict. Called from the `mapScript` setter and from
     * `initialize` with the declared default — the two places a script can arrive.
     *
     * NDA-012 (Data): the diagnosis is kept and reported from `scheduleMap`, not raised here.
     * Raising in the setter would announce on the boot path for a node whose Items are never
     * connected; a script that cannot compile only matters when something asks it to run. Array
     * Filter draws the same line for `filter-failed`. Scheduling is the caller's business for
     * the same reason `initialize` must not do it.
     */
    compileMapScript: function (this: MapCollectionInstance, code: string) {
      this._internal.mapCode = code;
      try {
        this._internal.mapFunc = new Function('map', 'object', code) as MapCollectionInstance['_internal']['mapFunc'];
      } catch (e) {
        this._internal.mapFunc = undefined;
        this._internal.mapCompileError = (e as Error).message || String(e);
        return;
      }
      this._internal.mapCompileError = undefined;
    },
    setCollection: function (this: MapCollectionInstance, collection: CollectionLike) {
      this.bindCollection(collection);
      this.flagOutputDirty('items');
      this.flagOutputDirty('count');
    },
    unbindCurrentCollection: function (this: MapCollectionInstance) {
      const collection = this._internal.collection;
      if (!collection) return;
      collection.off('change', this._internal.collectionChangedCallback);
      this._internal.collection = undefined;
    },
    bindCollection: function (this: MapCollectionInstance, collection: CollectionLike) {
      this.unbindCurrentCollection();
      this._internal.collection = collection;
      collection && collection.on('change', this._internal.collectionChangedCallback);
    },
    _onNodeDeleted: function (this: MapCollectionInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this.unbindCurrentCollection();
    },
    /**
     * NDA-012 (Data) — a `Refresh` pulse is an author asking; a value arriving is not.
     *
     * Ported verbatim from Array Filter's `requestFilter`, including the stickiness across the
     * coalescing window: if a value arrival schedules a run and a `Refresh` lands before the
     * callback fires, the author did ask, and the run that happens is the one they asked for.
     */
    requestMap: function (this: MapCollectionInstance) {
      // ERG-001 §4. Minted at the `Refresh` port and nowhere else — the `items` and `mapScript`
      // setters also reach `scheduleMap`, and neither is an invocation.
      const internal = this._internal;
      if (!internal.pendingMapOutcomes) internal.pendingMapOutcomes = [];
      internal.pendingMapOutcomes.push(this.beginOutcome());
      this.scheduleMap();
    },
    /** Array Filter's `reportFailure`, same dedup, same reason — see `filtercollectionnode.ts`. */
    reportFailure: function (
      this: MapCollectionInstance,
      code: string,
      message: string,
      detail?: unknown,
      tokens?: OutcomeToken[]
    ) {
      const internal = this._internal;
      internal.lastError = message;
      this.flagOutputDirty('error');

      const repeat = internal.lastReportedError === message;
      if (!repeat) {
        internal.lastReportedError = message;
        this.raiseRuntimeError(code, message, detail);
      }

      // ⚠️ The dedup is about the announcement; an invocation is still owed its outcome.
      if (tokens && tokens.length) {
        reportOutcomes(this, tokens, 'failure', { code, message, detail, raise: false });
        return;
      }

      if (!repeat) this.sendSignalOnOutput('failure');
    },
    scheduleMap: function (this: MapCollectionInstance) {
      if (this.collectionChangedScheduled) return;
      this.collectionChangedScheduled = true;

      this.scheduleAfterInputsHaveUpdated(() => {
        this.collectionChangedScheduled = false;

        // Drained before the run starts, so a later `Refresh` owns its own batch.
        const tokens = this._internal.pendingMapOutcomes || [];
        this._internal.pendingMapOutcomes = [];
        const requested = tokens.length > 0;

        if (this._internal.collection === undefined) {
          // Silent unless an author asked, for the reason Array Filter states: the script and the
          // array arrive in some order during boot, and reporting here would fire on the ordinary
          // path every time the script lands first.
          if (requested) {
            this.reportFailure(
              'array-map/no-items',
              'Nothing to map — no array is connected to the Items input',
              undefined,
              tokens
            );
          }
          return;
        }

        /**
         * NDA-012 (Data) — the node was completely silent when its script did not work.
         *
         * Measured: a `Script` that fails to compile left `mapFunc` `undefined` and the call
         * below threw a `TypeError` out of this scheduled callback; a script that compiles but
         * throws while mapping did the same. Either way `nodecontext.ts`'s blanket catch swallowed
         * it into one unstructured `console.error`, no signal fired, no error was raised, and the
         * `Items` output silently kept whatever the previous run had produced. That is a node that
         * cannot be debugged from the graph in any runtime — defect class B, and Array Filter's
         * `filter-failed` is the same failure with the same answer.
         *
         * Ungated on `requested`: a script that will not run is wrong whenever it is asked to,
         * and unlike "no array yet" it is never a state the graph passes through on its way to
         * working.
         *
         * ⚠️ Since `initialize` compiles the declared default, reaching here means a script
         * *arrived and failed*, so `mapCompileError` is always set. The fallback is the sentence
         * that would be true if it somehow were not — never "unknown error", which is what this
         * node said for the whole time nothing had been compiled at all.
         */
        if (this._internal.mapFunc === undefined) {
          this.reportFailure(
            'array-map/script-failed',
            'The map script could not be compiled: ' + (this._internal.mapCompileError || 'the Script input is empty'),
            undefined,
            tokens
          );
          return;
        }

        let mappedModels: ModelLike[];
        try {
          mappedModels = this._internal.collection.map((model) => {
            // CWF-008: the mapped records belong to the request that built them.
            const m = (this.nodeScope.modelScope || Model).create();
            this._internal.mapFunc(function (mappings) {
              for (const key in mappings) {
                const mapping = mappings[key];
                if (typeof mapping === 'function') {
                  m.set(key, mapping(model));
                } else if (typeof mapping === 'string') {
                  m.set(key, model.get(mapping));
                }
              }
            }, model);
            return m;
          });
        } catch (e) {
          this.reportFailure(
            'array-map/map-failed',
            'The map script failed: ' + ((e as Error).message || String(e)),
            undefined,
            tokens
          );
          return;
        }

        // A run that got here worked. Re-arm the dedup so the *next* occurrence of the same
        // message is announced again rather than swallowed as a repeat.
        this._internal.lastReportedError = undefined;

        this._internal.mappedCollection = Collection.create(mappedModels);

        // Values first, then the value-level announcement, then the invocation's outcome last.
        this.flagOutputDirty('items');
        this.flagOutputDirty('count');
        this.sendSignalOnOutput('modified');
        reportOutcomes(this, tokens, 'done');
      });
    }
  }
};

const MapCollectionModule: NodeModule = {
  node: MapCollectionNode,
  setup: function (context: NodeContextLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
  }
};

export = MapCollectionModule;
