import React, { useEffect } from 'react';

import NoodlRuntime, { Node } from '@noodl/runtime';
import Collection from '@noodl/runtime/src/collection';
import type {
  CollectionChangeEvent,
  CollectionLike,
  ComponentModelLike,
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  GraphPortModel,
  ModelChangeEvent,
  ModelLike,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import guid from '../../../guid';


interface ForEachComponentProps {
  didMount(): void;
  willUnmount(): void;
}

/**
 * The Repeater's own render output — deliberately nothing.
 *
 * A Repeater does not draw its items; it adds them as siblings of itself under its visual
 * parent. This element exists only so the Repeater learns when it is mounted, which is what
 * the `repeaterDisabledWhenUnmounted` project setting keys off. `Columns.tsx` also
 * identifies it by reference to tell a Repeater apart from a real child, so it must stay a
 * named export of this module.
 */
export function ForEachComponent(props: ForEachComponentProps) {
  const { didMount, willUnmount } = props;

  useEffect(() => {
    didMount();
    return () => {
      willUnmount();
    };
  }, []);

  return null;
}

const defaultDynamicScript =
  "// Set the 'component' variable to the name of the desired component for this item.\n" +
  "// Component name must start with a '/'.\n" +
  "// A component in a sheet is referred to by '/#Sheet Name/Comopnent Name'.\n" +
  "// The data for each item is available in a variable called 'item'\n" +
  "component = '/MyComponent';";

/** One unit of work on the serialised queue — see {@link ForEachInstance._runQueueOperations}. */
type QueuedOperation = () => void | Promise<void>;

/**
 * A component instance the Repeater created for one record.
 *
 * The three `_forEach…` members are set by this file rather than by the runtime, and are
 * how an item node is matched back to its record on removal.
 */
interface ForEachItemNode extends NodeInstance {
  _forEachModel?: ModelLike;
  /** Guards against a second removal while the `Try Remove` handshake is outstanding. */
  _forEachRemoveInProgress?: boolean;
  _forEachModelChangeListener?(args: ModelChangeEvent): void;
  _deleted?: boolean;
  parent?: ForEachItemNode;
  componentModel?: ComponentModelLike;
  _inputs: Record<string, unknown>;
  _outputs: Record<string, { value: unknown }>;
  removeChild(child: NodeInstance): void;
  addChild(child: NodeInstance, index?: number): void;
  getChildren(): ForEachItemNode[];
  setInputValue(name: string, value: unknown): void;
}

/** `this` inside the Repeater node. */
interface ForEachInstance extends NodeInstance {
  _internal: {
    /**
     * The Repeater's *own* collection, distinct from whatever is connected to `items`.
     * Keeping one lets `set` diff the incoming list against it, so unchanged records keep
     * their mounted component instead of every item being rebuilt on each update.
     */
    collection: CollectionLike;
    /**
     * Whatever is connected to `items`. May be a plain array, and may be `null` — an empty
     * value clears the list rather than being ignored (see `inputs.items`).
     */
    items?: CollectionLike | null;
    itemNodes: ForEachItemNode[];
    /** Which `itemOutputSignal-…` outputs the editor asked for, keyed without the prefix. */
    itemOutputSignals: Record<string, boolean>;
    /** Latest value of each forwarded item output, keyed without the prefix. */
    itemOutputs: Record<string, unknown>;
    itemActionItemId?: string;
    itemActionSignal?: string;
    itemActionParameters?: Record<string, unknown>;
    /** Serialised so that adds and removes cannot interleave — see `_runQueueOperations`. */
    queuedOperations: QueuedOperation[];
    /** Held back until the Repeater mounts, when `repeaterDisabledWhenUnmounted` is on. */
    mountedOperations: QueuedOperation[];
    templateType?: 'explicit' | 'dynamic';
    template?: string;
    templateFunction?(item: ModelLike): string | undefined;
    inputMappingScript?: string;
    inputMapFunc?(map: (mappings: Record<string, string | ((model: ModelLike) => unknown)>) => void, object: unknown): void;
    hasScheduledRefresh?: boolean;
    /** Messages already raised during the current rebuild — see `reportTemplateProblem`. */
    reportedTemplateProblems?: Set<string>;
    hasScheduledCopyItems?: boolean;
    hasScheduledTriggerItemOutputSignal?: boolean;
    target?: ForEachItemNode;
    onItemsCollectionChanged(): void;
  };
  isMounted?: boolean;
  runningOperations?: boolean;
  /** Set by the runtime on removal; the queue can outlive the node that owns it. */
  _deleted?: boolean;
  updateTarget(targetId: string | undefined): void;
  scheduleRefresh(): void;
  unbindCurrentCollection(): void;
  /** `null`/`undefined` are ordinary arrivals and mean "clear the list" — see `inputs.items`. */
  bindCollection(collection: CollectionLike | null | undefined): void;
  getTemplateForModel(model: ModelLike): string | undefined;
  reportTemplateProblem(code: string, message: string): void;
  _mapInputs(itemNode: ForEachItemNode, model: ModelLike): void;
  addItem(model: ModelLike, index: number): Promise<void>;
  removeItem(model: ModelLike): void;
  _deleteItem(item: ForEachItemNode): void;
  _deleteAllItemNodes(): void;
  refresh(): Promise<void>;
  _queueOperation(op: QueuedOperation): void;
  _runQueueOperations(): Promise<void>;
  /** Fires `Items Rendered` once the operation queue has drained. See NDA-004 §3. */
  _signalItemsRendered(didWork: boolean): void;
  didMount(): void;
  willUnmount(): void;
  scheduleCopyItems(): void;
  itemOutputSignalTriggered(name: string, model: ModelLike, itemNode: ForEachItemNode): void;
  getItemOutput(name: string): unknown;
  setInputMappingScript(value: string): void;
}

const ForEachDefinition: NodeDefinitionOptions = {
  name: 'For Each',
  displayNodeName: 'Repeater',
  docs: 'https://docs.noodl.net/nodes/ui-controls/repeater',
  color: 'visual',
  category: 'Visual',
  dynamicports: [
    {
      name: 'conditionalports/extended',
      condition: 'templateType = explicit OR templateType NOT SET',
      inputs: ['template']
    },
    {
      name: 'conditionalports/extended',
      condition: 'templateType = dynamic',
      inputs: ['templateScript']
    }
  ],
  initialize(this: ForEachInstance) {
    this._internal.itemNodes = [];
    this._internal.itemOutputSignals = {};
    this._internal.itemOutputs = {};
    this._internal.collection = Collection.get(); // We keep an internal collection so we don't have to refresh all content if the input items collection changes
    this._internal.queuedOperations = [];
    this._internal.mountedOperations = [];

    // Add an item
    this._internal.collection.on('add', async (args: CollectionChangeEvent) => {
      if (!this._internal.target) return;

      this._queueOperation(async () => {
        const baseIndex = this._internal.target.getChildren().indexOf(this as unknown as ForEachItemNode) + 1;
        await this.addItem(args.item, baseIndex + args.index);
      });
    });

    // Remove an item
    this._internal.collection.on('remove', (args: CollectionChangeEvent) => {
      this._queueOperation(() => {
        this.removeItem(args.item);
      });
    });

    // On collection changed
    this._internal.onItemsCollectionChanged = () => {
      const repeaterDisabledWhenUnmounted = NoodlRuntime.instance.getProjectSettings().repeaterDisabledWhenUnmounted;

      if (repeaterDisabledWhenUnmounted && !this.isMounted) {
        this._internal.mountedOperations.push(() => {
          this._internal.collection.set(this._internal.items);
        });
      } else {
        this._queueOperation(() => {
          this._internal.collection.set(this._internal.items);
        });
      }
    };

    this.addDeleteListener(() => {
      this._deleteAllItemNodes();
    });
  },
  inputs: {
    items: {
      group: 'Data',
      displayName: 'Items',
      type: 'array',
      description:
        'The array or query result to repeat over; an empty value clears the list, including null and an empty array',
      /**
       * NDA-012 (Visual), `DC-iii`. `if (!value) return;` was the truthiness test that finding
       * warns against by name: a query that came back `null` left the previous list on screen,
       * which is the most misleading thing a Repeater can do \u2014 the graph has moved on and the
       * page has not.
       *
       * \u2705 **Decided by Richard 2026-08-01: it clears.** Empty array, `null`, anything falsy.
       * *"a repeater should absolutely clear itself\u2026 We're not catering to existing projects
       * anymore."* So no dual path and no back-compat branch \u2014 the guard is simply gone.
       *
       * \u26a0\ufe0f **This is a deliberate, recorded divergence from `EMPTY-VALUE-CONTRACT.md`**, whose
       * table has `undefined` abstaining at a port input. Richard's decision was "anything
       * falsy", and the contract's own documentation duty is the mechanism for a port that
       * differs \u2014 hence the sentence in `description` above. In practice the two rarely
       * disagree: `node.ts` skips the initial seed from an upstream that has produced nothing,
       * so an `undefined` reaching here was actively sent.
       *
       * The identity guard below stays: re-sending the same collection is not a change.
       */
      set: function (this: ForEachInstance, value: CollectionLike | null | undefined) {
        if (value === this._internal.items) return;
        this.bindCollection(value);
        //this.scheduleRefresh();
      }
    },
    templateType: {
      group: 'Appearance',
      displayName: 'Template Type',
      description: 'Explicit uses one component for every item; Dynamic picks one per item by running Script',
      type: {
        name: 'enum',
        enums: [
          { label: 'Explicit', value: 'explicit' },
          { label: 'Dynamic', value: 'dynamic' }
        ]
      },
      default: 'explicit',
      set: function (this: ForEachInstance, value: 'explicit' | 'dynamic') {
        this._internal.templateType = value;
        this.scheduleRefresh();
      }
    },
    template: {
      type: 'component',
      displayName: 'Template',
      description: 'Component to create once per item, with the item available to it as its Component Object',
      group: 'Appearance',
      set: function (this: ForEachInstance, value: string) {
        this._internal.template = value;
        this.scheduleRefresh();
      }
    },
    templateScript: {
      type: { name: 'string', codeeditor: 'javascript', allowEditOnly: true },
      displayName: 'Script',
      description: 'JavaScript run per item that sets `component` to a component path; the item is available as `item`',
      group: 'Appearance',
      default: defaultDynamicScript,
      set: function (this: ForEachInstance, value: string) {
        const code = 'repeater/template-script-syntax-error';
        try {
          this._internal.templateFunction = new Function(
            'item',
            'var component;' + value + ';return component;'
          ) as ForEachInstance['_internal']['templateFunction'];

          // NDA-012 (Visual) D1. A `templateScript` that stops compiling used to leave the
          // *previous* function in place, so the Repeater went on rendering rows from code the
          // author had already replaced. The stale function is dropped, and `:347` then renders
          // nothing — which the raise below explains.
          if (this.context.editorConnection && this.context.editorConnection.clearWarning) {
            this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, code);
          }
        } catch (e) {
          this._internal.templateFunction = undefined;
          // NDA-012 (Visual) B2. Was `editorConnection.sendWarning` and nothing else: a Repeater
          // whose Script does not compile rendered no rows and said nothing at all once
          // deployed. The bus reaches every runtime, and the editor still shows it.
          this.raiseRuntimeError(code, `The Repeater's Script does not compile: ${(e as Error).message}`, e);
        }
        this.scheduleRefresh();
      }
    },
    refresh: {
      group: 'Appearance',
      displayName: 'Refresh',
      description: 'Rebuilds every item from the current Items, discarding any state the item components held',
      type: 'signal',
      valueChangedToTrue: function (this: ForEachInstance) {
        this.scheduleRefresh();
      }
    }
  },
  outputs: {
    itemActionItemId: {
      type: 'string',
      group: 'Actions',
      displayName: 'Item Id',
      description: 'Id of the item whose Repeater Item node last raised an action',
      getter: function (this: ForEachInstance) {
        return this._internal.itemActionItemId;
      }
    },
    // NDA-004 §3. The Repeater was one of the ten nodes that take a signal and emit none, and
    // it is the one that hurt most: item creation is queued and — with
    // `repeaterCreateComponentsAsync` — deliberately spread across frames to keep the frame
    // rate up, so "the list exists now" was knowable to the runtime and to nobody else. Every
    // list-then-scroll, list-then-measure and list-then-focus interaction was a guessed Delay.
    itemsRendered: {
      type: 'signal',
      group: 'Events',
      displayName: 'Items Rendered',
      description:
        'Fires once every item component exists and has been added; item creation is spread across frames, so this is the only honest moment to measure or scroll the list'
    }
  },
  prototypeExtensions: {
    updateTarget: function (this: ForEachInstance, targetId: string | undefined) {
      this._internal.target = targetId ? (this.nodeScope.getNodeWithId(targetId) as ForEachItemNode) : undefined;
      this.scheduleRefresh();
    },
    setNodeModel: function (this: ForEachInstance, nodeModel: GraphNodeModel) {
      Node.prototype.setNodeModel.call(this, nodeModel);
      if (nodeModel.parent) {
        this.updateTarget(nodeModel.parent.id);
      }
      nodeModel.on(
        'parentUpdated',
        (newParent: GraphNodeModel | undefined) => {
          this.updateTarget(newParent ? newParent.id : undefined);
        },
        this
      );
    },
    scheduleRefresh: function (this: ForEachInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledRefresh) {
        internal.hasScheduledRefresh = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this._queueOperation(() => {
            this.refresh();
          });
        });
      }
    },
    unbindCurrentCollection: function (this: ForEachInstance) {
      const collection = this._internal.items;
      if (!collection) return;

      Collection.instanceOf(collection) && collection.off('change', this._internal.onItemsCollectionChanged);
      this._internal.items = undefined;
    },
    bindCollection: function (this: ForEachInstance, collection: CollectionLike | null | undefined) {
      const internal = this._internal;

      this.unbindCurrentCollection();

      Collection.instanceOf(collection) && collection.on('change', this._internal.onItemsCollectionChanged);

      internal.items = collection;
      this.scheduleCopyItems();
    },
    /**
     * Raise a per-item template failure at most once per rebuild.
     *
     * The dedupe set is created by `refresh()`. When a problem is hit outside a rebuild — an
     * `add` arriving on the bound collection, say — there is no set, and the event is raised:
     * a one-off add is exactly the case where one report is the right number.
     */
    reportTemplateProblem: function (this: ForEachInstance, code: string, message: string) {
      const reported = this._internal.reportedTemplateProblems;
      if (reported) {
        if (reported.has(message)) return;
        reported.add(message);
      }
      this.raiseRuntimeError(code, message);
    },
    getTemplateForModel: function (this: ForEachInstance, model: ModelLike) {
      const internal = this._internal;
      if (internal.templateType === undefined || internal.templateType === 'explicit') return internal.template;

      if (!internal.templateFunction) return;
      let template: string | undefined;
      try {
        template = internal.templateFunction(model);
      } catch (e) {
        // NDA-012 (Visual) B2. A throw *inside* the compiled Script — the common case, because
        // it depends on the data rather than the code — was reported the same editor-only way
        // as a syntax error. On the bus it survives into a deployed app, where a Repeater that
        // renders one fewer row than it has items is otherwise invisible.
        this.raiseRuntimeError(
          'repeater/template-script-threw',
          `The Repeater's Script threw while choosing a component for an item, so that item has no row: ${
            (e as Error).message
          }`,
          e
        );
      }

      //simple (and limited) way to support ./ and ../ at the start of component template names
      if (template) {
        if (template.startsWith('./')) {
          template = this.model.component.name + template.substring(1);
        }

        if (template.startsWith('../')) {
          const pathParts = this.model.component.name.split('/');
          const parentPath = pathParts.slice(0, pathParts.length - 1).join('/');
          template = parentPath + template.substring(2);
        }
      }

      return template;
    },
    _mapInputs: function (this: ForEachInstance, itemNode: ForEachItemNode, model: ModelLike) {
      if (this._internal.inputMapFunc !== undefined) {
        // We have a mapping function, run the function and use the mapped values
        // as inputs
        this._internal.inputMapFunc(function (mappings) {
          for (const key in mappings) {
            if (itemNode.hasInput(key)) {
              const mapping = mappings[key];
              if (typeof mapping === 'function') {
                itemNode.setInputValue(key, mapping(model));
              } else if (typeof mapping === 'string') {
                itemNode.setInputValue(key, model.get(mapping));
              }
            }
          }
        }, model);
      }
    },
    addItem: async function (this: ForEachInstance, model: ModelLike, index: number) {
      const internal = this._internal;

      // Create a new component for this item
      const template = this.getTemplateForModel(model);
      if (!template) {
        // NDA-012 (Visual) D1. `template` is a `component`-typed *string* and was never checked
        // against anything: an item with no component resolved simply produced no row, so a
        // list that rendered 9 rows for 10 records looked exactly like a list of 9. Which of
        // the two ports is at fault depends on the mode, and the fixes are different, so the
        // message names the one the author has to open.
        this.reportTemplateProblem(
          'repeater/no-template-for-item',
          internal.templateType === 'dynamic'
            ? 'The Repeater\'s Script returned no component for an item, so that item has no row — set `component` to a component path in the Script'
            : 'The Repeater has no Template, so its items have no rows — pick the component to repeat on the Template input'
        );
        return;
      }

      const itemNode = (await this.nodeScope.createNode(template, guid(), {
        _forEachModel: model,
        _forEachNode: this
      })) as ForEachItemNode;

      // D1, second half: `createNode` on a component path that does not exist yields nothing,
      // and every line below assumes it did. A renamed or deleted template component is the
      // ordinary way into this, and it was silent.
      if (!itemNode) {
        this.reportTemplateProblem(
          'repeater/template-component-not-found',
          `The Repeater cannot find the component ${JSON.stringify(template)}, so its items have no rows — it may have been renamed or deleted`
        );
        return;
      }

      // Set input values for all model data, and track changes
      if (this._internal.inputMapFunc === undefined) {
        //set component inputs with values from model
        if (itemNode.hasInput('Id')) {
          itemNode.setInputValue('Id', model.getId());
        }
        if (itemNode.hasInput('id')) {
          itemNode.setInputValue('id', model.getId());
        }

        for (const inputKey in itemNode._inputs) {
          if (model.data[inputKey] !== undefined) itemNode.setInputValue(inputKey, model.data[inputKey]);
        }

        //listen to changes on model
        itemNode._forEachModelChangeListener = function (ev: ModelChangeEvent) {
          if (itemNode._inputs[ev.name]) itemNode.setInputValue(ev.name, ev.value);
        };
        model.on('change', itemNode._forEachModelChangeListener);

        //listen to changes to the component inputs
        itemNode.componentModel.on(
          'inputPortAdded',
          (port: GraphPortModel) => {
            if (port.name === 'id') itemNode.setInputValue('id', model.getId());
            if (port.name === 'Id') itemNode.setInputValue('Id', model.getId());

            if (model.data[port.name] !== undefined) {
              itemNode.setInputValue(port.name, model.data[port.name]);
            }
          },
          this
        );
      } else {
        // If there is a map script, then use it
        this._mapInputs(itemNode, model);
        itemNode._forEachModelChangeListener = () => this._mapInputs(itemNode, model);
        model.on('change', itemNode._forEachModelChangeListener);
      }

      // Create connections for all item output signals that we should forward
      itemNode._internal.creatorCallbacks = {
        onOutputChanged: (name: string, value: unknown, oldValue: unknown) => {
          if ((oldValue === false || oldValue === undefined) && value === true && internal.itemOutputSignals[name]) {
            this.itemOutputSignalTriggered(name, model, itemNode);
          }
        }
      };

      // Connect all model nodes of the component that have id type = instance
      /*var itemScopes = itemNode.nodeScope.getNodesWithType('Model')
      if(itemScopes && itemScopes.length>0) {
        for(var j = 0; j < itemScopes.length; j++) {
          itemScopes[j].hasInstanceIDType()&&itemScopes[j].setModel(model);
        }
      }*/

      // If there is a for each actions node, signal that the item has been added
      const forEachActions = itemNode.nodeScope.getNodesWithType('For Each Actions');
      for (let j = 0; j < forEachActions.length; j++) {
        (forEachActions[j] as NodeInstance & { signalAdded(): void }).signalAdded();
      }

      internal.itemNodes.push(itemNode);
      internal.target.addChild(itemNode, index);
    },
    removeItem: function (this: ForEachInstance, model: ModelLike) {
      const internal = this._internal;
      if (!internal.target) return;

      function findChild() {
        const children = internal.target.getChildren();
        for (const c of children) {
          if (c._forEachModel === model && !c._forEachRemoveInProgress) return c;
        }
      }
      const child = findChild();
      if (!child) return;

      const forEachActions = child.nodeScope.getNodesWithType('For Each Actions') as (NodeInstance & {
        tryRemove(callback: () => void): void;
      })[];
      if (forEachActions && forEachActions.length > 0) {
        // Run a try remove on the for each actions, remove the child when completed
        child._forEachRemoveInProgress = true;
        forEachActions[0].tryRemove(() => this._deleteItem(child));
      } else {
        // There are no for each actions, just remove the item
        this._deleteItem(child);
      }

      const idx = internal.itemNodes.indexOf(child);
      idx !== -1 && internal.itemNodes.splice(idx, 1);
    },
    _deleteItem(this: ForEachInstance, item: ForEachItemNode) {
      item._forEachModel.off('change', item._forEachModelChangeListener);

      item.model && item.model.removeListenersWithRef(this);
      item.componentModel && item.componentModel.removeListenersWithRef(this);

      const parent = item.parent;
      if (item._deleted || !parent) return;

      parent.removeChild(item);
      this.nodeScope.deleteNode(item);
    },
    _deleteAllItemNodes: function (this: ForEachInstance) {
      if (!this._internal.itemNodes) return;

      for (const itemNode of this._internal.itemNodes) {
        this._deleteItem(itemNode);
      }

      this._internal.itemNodes = [];
    },
    refresh: async function (this: ForEachInstance) {
      const internal = this._internal;
      internal.hasScheduledRefresh = false;

      // NDA-012 (Visual) D1/B2. Per-item template failures are reported once per rebuild, not
      // once per item: a 5,000-row list whose Template names a component that does not exist
      // would otherwise raise 5,000 identical events, and the `console.error` subscriber a
      // deployed app uses does not collapse duplicates the way the editor's warning panel does.
      // Keyed by message, so *distinct* problems in one rebuild are all still reported.
      internal.reportedTemplateProblems = new Set<string>();

      if (!(internal.template || internal.templateFunction) || !internal.items) return;

      // NDA-013: resync the private collection from whatever is currently bound to `items`
      // before rebuilding, so Refresh actually re-reads the source instead of rebuilding
      // from the stale copy `internal.collection` otherwise is (it is normally kept in sync
      // only by `change` events on `items`, which a raw mutation — `push`, the A1 defect —
      // never fires).
      //
      // `Collection.set` diffs by `getId()` and emits `add`/`remove` per change, which the
      // listeners registered in `initialize()` turn into operations QUEUED on this very node
      // (`_queueOperation`, above). Because `set()` never awaits those listeners, every one
      // of them has already pushed its op onto `queuedOperations` by the time `set()`
      // returns — synchronously, before the next line here runs (nothing else can run
      // between them; JS is single-threaded and `set()`'s own loop doesn't await anything
      // either). This function is about to do its own full teardown-and-rebuild below, so
      // those queued ops would be pure duplicates racing it. Drop exactly the ones `set()`
      // just appended — and only those, so anything already queued before Refresh started
      // (and thus meant to run after it) is left alone.
      const queueLengthBeforeResync = internal.queuedOperations.length;
      internal.collection.set(internal.items);
      internal.queuedOperations.length = queueLengthBeforeResync;

      // Full teardown-and-rebuild, deliberately kept rather than turned into a diff: `set`
      // above already reconciles `internal.collection` by id, so a cheaper Refresh that
      // reused the *existing* item nodes for records that didn't change is possible — but
      // is a separate, riskier change against item-node identity (component state, mounted
      // DOM) that this fix does not need in order to make Refresh correct.
      this._deleteAllItemNodes();

      //check if we have a target to add nodes to
      if (!internal.target) return;

      // figure out our index in our target
      const baseIndex = this._internal.target.getChildren().indexOf(this as unknown as ForEachItemNode) + 1;

      // Iterate over all models and create items
      for (let i = 0; i < internal.collection.size(); i++) {
        const model = internal.collection.get(i);

        await this.addItem(model, baseIndex + i);
      }
    },
    _queueOperation(this: ForEachInstance, op: QueuedOperation) {
      this._internal.queuedOperations.push(op);
      this._runQueueOperations();
    },
    async _runQueueOperations(this: ForEachInstance) {
      if (this.runningOperations) {
        return;
      }
      this.runningOperations = true;

      const repeaterCreateComponentsAsync = NoodlRuntime.instance.getProjectSettings().repeaterCreateComponentsAsync;

      // Whether this drain actually built anything. `_runQueueOperations` is called on every
      // `_queueOperation`, so without this the signal would also fire for drains that had
      // nothing to do — and a completion signal that fires when nothing completed is worse
      // than none, because an author cannot tell the two apart.
      let didWork = false;

      if (repeaterCreateComponentsAsync) {
        //create items in chunks of roughly 25ms at a time
        //so basically trying to keep ~30 fps
        const runOps = async () => {
          const start = performance.now();

          while (this._internal.queuedOperations.length && performance.now() - start < 25) {
            const op = this._internal.queuedOperations.shift();
            didWork = true;
            await op();
          }

          if (this._internal.queuedOperations.length) {
            setTimeout(runOps, 0);
          } else {
            this.runningOperations = false;
            this._signalItemsRendered(didWork);
          }
        };

        runOps();
      } else {
        while (this._internal.queuedOperations.length) {
          const op = this._internal.queuedOperations.shift();
          didWork = true;
          await op();
        }

        this.runningOperations = false;
        this._signalItemsRendered(didWork);
      }
    },
    /**
     * Announce that the queue has drained — every item node for this pass now exists.
     *
     * This is the one honest moment to signal from. Chunked creation spans frames, so
     * `refresh()` returning means only that the work was *queued*; the queue emptying means
     * it was done.
     */
    _signalItemsRendered(this: ForEachInstance, didWork: boolean) {
      if (!didWork || this._deleted) return;
      this.sendSignalOnOutput('itemsRendered');
    },
    _onNodeDeleted: function (this: ForEachInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this._internal.queuedOperations.length = 0; //delete all queued operations
      this.unbindCurrentCollection();
    },
    render(this: ForEachInstance) {
      return <ForEachComponent key={this.id} didMount={() => this.didMount()} willUnmount={() => this.willUnmount()} />;
    },
    didMount(this: ForEachInstance) {
      this.isMounted = true;

      for (const op of this._internal.mountedOperations) {
        this._queueOperation(op);
      }
      this._internal.mountedOperations = [];
    },
    willUnmount(this: ForEachInstance) {
      this.isMounted = false;
    },
    getItemActionParameter: function (this: ForEachInstance, name: string) {
      if (!this._internal.itemActionParameters) return;
      return this._internal.itemActionParameters[name];
    },
    scheduleCopyItems: function (this: ForEachInstance) {
      if (this._internal.hasScheduledCopyItems) return;
      this._internal.hasScheduledCopyItems = true;
      this.scheduleAfterInputsHaveUpdated(() => {
        this._internal.hasScheduledCopyItems = false;

        // NDA-012 (Visual), `DC-iii` — the *second* half of the same guard. Removing
        // `if (!value) return;` from the setter is not enough on its own: this method used to
        // bail on `items === undefined` too, so a cleared Repeater would still have kept its
        // list. `Collection.set` already handles a falsy source (`src = src || []`,
        // collection.ts:485), so clearing needs no special case beyond letting it through.
        //
        // The `remove` events that `set` raises are queued as operations (`initialize`), so
        // `didWork` is true and `Items Rendered` fires — a graph waiting on the list stays live.
        // ⚠️ Clearing a list that is *already* empty queues nothing and so signals nothing;
        // that is the `Run Tasks` empty-list shape and `OUTCOME-CONTRACT.md` / ERG-001 owns it.
        const repeaterDisabledWhenUnmounted = NoodlRuntime.instance.getProjectSettings().repeaterDisabledWhenUnmounted;

        if (repeaterDisabledWhenUnmounted && !this.isMounted) {
          this._internal.mountedOperations.push(() => {
            this._internal.collection.set(this._internal.items);
          });
        } else {
          this._internal.collection.set(this._internal.items);
        }
      });
    },
    itemOutputSignalTriggered: function (
      this: ForEachInstance,
      name: string,
      model: ModelLike,
      itemNode: ForEachItemNode
    ) {
      this._internal.itemActionItemId = model.getId();
      this._internal.itemActionSignal = name;
      this.flagOutputDirty('itemActionItemId');

      // Send signal and update item outputs after they have been correctly updated
      if (!this._internal.hasScheduledTriggerItemOutputSignal) {
        this._internal.hasScheduledTriggerItemOutputSignal = true;
        this.context.scheduleAfterUpdate(() => {
          this._internal.hasScheduledTriggerItemOutputSignal = false;
          for (const key in itemNode._outputs) {
            const _output = 'itemOutput-' + key;
            if (this.hasOutput(_output)) {
              this._internal.itemOutputs[key] = itemNode._outputs[key].value;
              this.flagOutputDirty(_output);
            }
          }
          this.sendSignalOnOutput('itemOutputSignal-' + this._internal.itemActionSignal);
        });
      }
    },
    getItemOutput: function (this: ForEachInstance, name: string) {
      return this._internal.itemOutputs[name];
    },
    registerOutputIfNeeded: function (this: ForEachInstance, name: string) {
      if (this.hasOutput(name)) {
        return;
      }

      if (name.startsWith('itemOutputSignal-')) {
        this._internal.itemOutputSignals[name.substring('itemOutputSignal-'.length)] = true;
        this.registerOutput(name, {
          getter: function () {
            /** No needed for signals */
          }
        });
      } else if (name.startsWith('itemOutput-'))
        this.registerOutput(name, {
          getter: this.getItemOutput.bind(this, name.substring('itemOutput-'.length))
        });
    },
    setInputMappingScript: function (this: ForEachInstance, value: string) {
      const code = 'repeater/input-mapping-syntax-error';

      if (this.context.editorConnection && this.context.editorConnection.clearWarning) {
        this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, code);
      }

      this._internal.inputMappingScript = value;

      if (this._internal.inputMappingScript) {
        try {
          this._internal.inputMapFunc = new Function(
            'map',
            'object',
            this._internal.inputMappingScript
          ) as ForEachInstance['_internal']['inputMapFunc'];
        } catch (e) {
          this._internal.inputMapFunc = undefined;
          // B2, third of three on this node. Same move as the two above.
          this.raiseRuntimeError(
            code,
            `The Repeater's input mapping script does not compile, so no item inputs are mapped: ${
              (e as Error).message
            }`,
            e
          );
        }
      } else {
        this._internal.inputMapFunc = undefined;
      }

      this.scheduleRefresh();
    },
    registerInputIfNeeded: function (this: ForEachInstance, name: string) {
      if (this.hasInput(name)) {
        return;
      }

      if (name === 'inputMappingScript')
        return this.registerInput(name, {
          set: this.setInputMappingScript.bind(this)
        });
    }
  }
};

function _typeName(t: string | { name: string }): string {
  if (typeof t === 'object') return t.name;
  else return t;
}

const defaultMapCode =
  '// Here you add mappings between the properties of the item objects and the inputs of the components.\n' +
  "// 'myComponentInput': 'myObjectProperty',\n" +
  "// 'anotherComponentInput': function () { return object.get('someProperty') + ' ' + object.get('otherProp') }\n" +
  '// These are the default mappings based on the selected template component.\n' +
  'map({\n' +
  '{{#mappings}}' +
  '})\n';

const ForEachModule: NodeModule = {
  node: ForEachDefinition,
  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function _managePortsForNode(node: GraphNodeModel) {
      function _collectPortsInTemplateComponent() {
        const templateComponentName = node.parameters.template as string | undefined;
        if (templateComponentName === undefined) return;

        const ports = [];
        const c = graphModel.components[templateComponentName];
        if (c === undefined) return;

        // Collect item outputs and signals
        for (const outputName in c.outputPorts) {
          const o = c.outputPorts[outputName];
          if (_typeName(o.type) === 'signal') {
            ports.push({
              name: 'itemOutputSignal-' + outputName,
              displayName: outputName,
              type: 'signal',
              plug: 'output',
              group: 'Item Signals'
            });
          } else {
            ports.push({
              name: 'itemOutput-' + outputName,
              displayName: outputName,
              type: o.type,
              plug: 'output',
              group: 'Item Outputs'
            });
          }
        }

        // Collect default mappigs for template component inputs
        let defaultMappings = '';
        for (const inputName in c.inputPorts) {
          const o = c.inputPorts[inputName];
          if (_typeName(o.type) !== 'signal') {
            defaultMappings += "\t'" + inputName + "': '" + inputName + "',\n";
          }
        }

        ports.push({
          name: 'inputMappingScript',
          type: { name: 'string', codeeditor: 'javascript' },
          displayName: 'Script',
          group: 'Input Mapping',
          default: defaultMapCode.replace('{{#mappings}}', defaultMappings),
          plug: 'input'
        });

        editorConnection.sendDynamicPorts(node.id, ports, {
          detectRenamed: {
            plug: 'output',
            prefix: 'itemOutput'
          }
        });
      }

      function _trackComponentOutputs(componentName: string | undefined) {
        if (componentName === undefined) return;
        const c = graphModel.components[componentName];
        if (c === undefined) return;

        c.on('outputPortAdded', _collectPortsInTemplateComponent);
        c.on('outputPortRemoved', _collectPortsInTemplateComponent);
        c.on('outputPortTypesUpdated', _collectPortsInTemplateComponent);

        c.on('inputPortTypesUpdated', _collectPortsInTemplateComponent);
        c.on('inputPortAdded', _collectPortsInTemplateComponent);
        c.on('inputPortRemoved', _collectPortsInTemplateComponent);
      }

      _collectPortsInTemplateComponent();
      _trackComponentOutputs(node.parameters.template as string | undefined);
      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name === 'template') {
          _collectPortsInTemplateComponent();
          _trackComponentOutputs(node.parameters.template as string | undefined);
        }
      });
    }

    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.For Each', function (node: GraphNodeModel) {
        _managePortsForNode(node);
      });

      for (const node of graphModel.getNodesWithType('For Each')) {
        _managePortsForNode(node);
      }
    });
  }
};

export default ForEachModule;
