import type {
  EditorConnectionLike,
  GraphModelLike,
  GraphNodeModel,
  ModelLike,
  ModelModule,
  NodeContextLike,
  NodeDefinitionOptions,
  NodeInstance,
  NodeModule
} from '@noodl/types';

import {
  TEMPLATE_CONTRACT,
  checkTemplateContract,
  resolveTemplateContract,
  type ResolvedTemplateContract
} from './runtasks-template-contract';

import type { RuntimeNode } from '../../internal';

const { Node } = require('../../../noodl-runtime');

import guid = require('../../guid');
import ModelImport = require('../../model');

const Model = ModelImport as unknown as ModelModule;

/** The component instance standing for one task, plus the creator hooks Run Tasks installs. */
interface TaskNode extends RuntimeNode {
  _internal: RuntimeNode['_internal'] & {
    creatorCallbacks?: {
      onOutputChanged(name: string, value: unknown, oldValue: unknown): void;
    };
  };
  /**
   * Which entry of `items` this task is running, so a failure can name it (§3).
   *
   * Carried on the node rather than in a side Map because the node is the only thing
   * `itemOutputSignalTriggered` is handed besides the model, and a side Map would need
   * clearing on every teardown path — including `_deleteAllTasks`, which is the one that
   * already leaked once.
   */
  _runTaskIndex?: number;
}

/** One queued item, with the position it will be reported under. */
interface QueuedTask {
  item: unknown;
  index: number;
}

/**
 * `this` inside the Run Tasks node.
 *
 * The node runs a component template once per item with bounded concurrency. Each task is
 * a real component instance created in this node's scope, driven by pulsing its start input
 * and watched through `creatorCallbacks.onOutputChanged` — there is **no port wiring between
 * the template and this node**, which is why the completion signals are matched by string.
 *
 * NDA-009 §2 made those four names *configuration* rather than literals: they come from
 * `runtasks-template-contract.ts` through {@link RunTasksNodeInstance._contract}, default to
 * `Do`/`Success`/`Failure`/`Error`, and the editor-time check reads the same table. The string
 * match is still the mechanism — that is what the absence of a wire forces — but it is now a
 * contract an author can see, change, and be warned about, rather than three literals buried
 * in this file.
 */
interface RunTasksNodeInstance extends NodeInstance {
  _internal: {
    queuedOperations: Array<() => void | Promise<void>>;
    state: 'idle' | 'running' | 'aborted';
    maxRunningTasks: number;
    activeTasks: Map<string, TaskNode>;
    items?: unknown[];
    stopOnFailure?: boolean;
    template?: string;
    numTasks?: number;
    failedTasks?: number;
    completedTasks?: number;
    queuedTasks?: QueuedTask[];
    runningTasks?: number;
    hasScheduledRun?: boolean;
    hasScheduledAbort?: boolean;
    /** §2 — the configured port names. See {@link RunTasksNodeInstance._contract}. */
    startInput?: string;
    successOutput?: string;
    failureOutput?: string;
    errorOutput?: string;
  };
  /** On the instance, not in `_internal` — guards {@link _runQueueOperations}. */
  runningOperations?: boolean;
  scheduleRun(): void;
  scheduleAbort(): void;
  /** The four port names this node will match against its template, defaults applied. */
  _contract(): ResolvedTemplateContract;
  createTaskComponent(entry: QueuedTask): Promise<TaskNode>;
  startTask(entry: QueuedTask): Promise<void>;
  /** §3 — reports one task's failure with the item that caused it. */
  reportTaskFailure(model: ModelLike, itemNode: TaskNode): void;
  /** Ends a run that provably cannot finish, reporting `code` on the runtime error channel. */
  endRunAsFailed(code: string, message: string, detail?: unknown): void;
  /** Reports a `Do` that could not start a run at all — see the method's own note. */
  _failToStart(code: string, message: string, detail?: unknown): void;
  run(): Promise<void>;
  abort(): void;
  itemOutputSignalTriggered(name: string, model: ModelLike, itemNode: TaskNode): void;
  _queueOperation(op: () => void | Promise<void>): void;
  _runQueueOperations(): Promise<void>;
  _deleteAllTasks(): void;
}

function sendSignalOnInput(itemNode: TaskNode, name: string) {
  itemNode.queueInput(name, true); // send signal
  itemNode.queueInput(name, false);
}

const RunTasksDefinition: NodeDefinitionOptions = {
  name: 'RunTasks',
  displayNodeName: 'Run Tasks',
  docs: 'https://docs.noodl.net/nodes/data/run-tasks',
  color: 'data',
  category: 'Data',
  initialize(this: RunTasksNodeInstance) {
    this._internal.queuedOperations = [];
    this._internal.state = 'idle';
    this._internal.maxRunningTasks = 10;
    this._internal.activeTasks = new Map(); //id => ComponentInstanceNode
  },
  inputs: {
    items: {
      group: 'Data',
      displayName: 'Items',
      description: 'The list to run the template once for; each entry becomes one task and is passed to it as a record',
      type: 'array',
      set: function (this: RunTasksNodeInstance, value: unknown[]) {
        // NDA-012 (Data) G1 — `null` clears rather than abstains.
        //
        // This used to `return` on any falsy value, so clearing the source left the *previous*
        // list in place and the next `Do` silently re-ran it. `undefined` never crosses a
        // connection (`node.ts:635` drops it in `sendValue`), so `null` is the reachable
        // spelling of "there is nothing to run" and it has to mean that.
        if (value === null) {
          this._internal.items = undefined;
          return;
        }
        if (!value) return;
        if (value === this._internal.items) return;

        this._internal.items = value;
      }
    },
    stopOnFailure: {
      group: 'General',
      displayName: 'Stop On Failure',
      type: 'boolean',
      description: 'Abandons the remaining items as soon as one task fails, rather than running the whole list',
      default: false,
      set: function (this: RunTasksNodeInstance, value: boolean) {
        this._internal.stopOnFailure = value;
      }
    },
    maxRunningTasks: {
      group: 'General',
      displayName: 'Max Running Tasks',
      type: 'number',
      description: 'How many tasks may run at the same time; must be at least 1 or the run fails rather than starting',
      default: 10,
      set: function (this: RunTasksNodeInstance, value: number) {
        this._internal.maxRunningTasks = value;
      }
    },
    taskTemplate: {
      type: 'component',
      displayName: 'Template',
      group: 'General',
      description: 'The component to run once per item, which must expose the ports named under Template Contract',
      set: function (this: RunTasksNodeInstance, value: string) {
        this._internal.template = value;
      }
    },
    /**
     * NDA-009 §2 — the template contract, as data rather than as string literals.
     *
     * **Static string ports, not the enums the spec asked for, and the reason is criterion 4.**
     * Enums populated from the template's ports would have to arrive through
     * `sendDynamicPorts`, which is what the catalog generator reads to decide a node has
     * dynamic ports. The moment Run Tasks is a dynamic-port node, `nonexistentPort` stops
     * reporting bad ports on it and merely *skips* them (`nonexistentPort.ts:73`) — so the
     * change that was supposed to let the validator check this contract would have stopped it
     * checking any of Run Tasks' ports at all. Static ports are also what the catalog carries,
     * which is what makes the feature reachable by the AI authoring loop; the same trade-off
     * NDA-006 §3 made for the breakpoint ports.
     *
     * The affordance the enum was for — "pick one of the ports the template actually has" —
     * is delivered by `checkTemplateContract`, which lists them in its warning and also covers
     * the case a dropdown could not: a port renamed on the *template* after this node was set up.
     *
     * `allowEditOnly` on all four: a connection driving a port name mid-run would change what
     * completion means while tasks are in flight, and there is no reading of that which helps
     * anyone.
     */
    taskStartInput: {
      type: { name: 'string', allowEditOnly: true },
      displayName: 'Start Input',
      group: 'Template Contract',
      description: "Name of the template's signal input to pulse when a task begins",
      default: TEMPLATE_CONTRACT.start.default,
      set: function (this: RunTasksNodeInstance, value: string) {
        this._internal.startInput = value;
      }
    },
    taskSuccessOutput: {
      type: { name: 'string', allowEditOnly: true },
      displayName: 'Success Output',
      group: 'Template Contract',
      description: "Name of the template's signal output that means one task finished successfully",
      default: TEMPLATE_CONTRACT.success.default,
      set: function (this: RunTasksNodeInstance, value: string) {
        this._internal.successOutput = value;
      }
    },
    taskFailureOutput: {
      type: { name: 'string', allowEditOnly: true },
      displayName: 'Failure Output',
      group: 'Template Contract',
      description: "Name of the template's signal output that means one task failed",
      default: TEMPLATE_CONTRACT.failure.default,
      set: function (this: RunTasksNodeInstance, value: string) {
        this._internal.failureOutput = value;
      }
    },
    /** Optional; see {@link TEMPLATE_CONTRACT.error}. Never warned about when absent. */
    taskErrorOutput: {
      type: { name: 'string', allowEditOnly: true },
      displayName: 'Error Output',
      group: 'Template Contract',
      description: "Name of an optional value output on the template carrying why a task failed; leave blank if it cannot say",
      default: TEMPLATE_CONTRACT.error.default,
      set: function (this: RunTasksNodeInstance, value: string) {
        this._internal.errorOutput = value;
      }
    },
    run: {
      group: 'General',
      displayName: 'Do',
      type: 'signal',
      description: 'Starts a run over Items; ignored while a run is already in progress',
      valueChangedToTrue: function (this: RunTasksNodeInstance) {
        this.scheduleRun();
      }
    },
    abort: {
      group: 'General',
      displayName: 'Abort',
      type: 'signal',
      description: 'Stops starting new tasks and ends the run once those already running finish; does nothing when no run is in progress',
      valueChangedToTrue: function (this: RunTasksNodeInstance) {
        this.scheduleAbort();
      }
    }
  },
  outputs: {
    success: {
      type: 'signal',
      group: 'Events',
      displayName: 'Success',
      description: 'Fires when every task completed without failing, including when Items was empty'
    },
    failure: {
      type: 'signal',
      group: 'Events',
      displayName: 'Failure',
      description: 'Fires when at least one task failed, or when the run could not start at all; which item failed is reported on the error channel'
    },
    done: {
      type: 'signal',
      group: 'Events',
      displayName: 'Done',
      description: 'Fires when the run has ended, whether it succeeded, failed or was aborted'
    },
    aborted: {
      type: 'signal',
      group: 'Events',
      displayName: 'Aborted',
      description: 'Fires when a run ended early, either from Abort or because Stop On Failure caught a failure'
    }
  },
  methods: {
    scheduleRun(this: RunTasksNodeInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledRun) {
        internal.hasScheduledRun = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this._queueOperation(() => {
            internal.hasScheduledRun = false;
            this.run();
          });
        });
      }
    },
    scheduleAbort(this: RunTasksNodeInstance) {
      const internal = this._internal;
      if (!internal.hasScheduledAbort) {
        internal.hasScheduledAbort = true;
        this.scheduleAfterInputsHaveUpdated(() => {
          this._queueOperation(() => {
            internal.hasScheduledAbort = false;
            this.abort();
          });
        });
      }
    },
    /**
     * Resolved on every use rather than cached at run start.
     *
     * The four inputs are `allowEditOnly`, so the only writer is an author editing a field, and
     * an edit mid-run is rare enough not to be worth a snapshot — while a cached copy would be
     * a second source of truth to keep in step with `_internal`, which is exactly the drift
     * this task exists to remove.
     */
    _contract(this: RunTasksNodeInstance): ResolvedTemplateContract {
      const internal = this._internal;
      const values: Record<string, unknown> = {
        [TEMPLATE_CONTRACT.start.parameter]: internal.startInput,
        [TEMPLATE_CONTRACT.success.parameter]: internal.successOutput,
        [TEMPLATE_CONTRACT.failure.parameter]: internal.failureOutput,
        [TEMPLATE_CONTRACT.error.parameter]: internal.errorOutput
      };
      return resolveTemplateContract((parameter) => values[parameter]);
    },
    async createTaskComponent(this: RunTasksNodeInstance, entry: QueuedTask) {
      const internal = this._internal;
      const item = entry.item;
      const contract = this._contract();

      // `nodeScope.modelScope` is the per-component model scope when there is one, and the
      // `Model` module itself otherwise — both answer `create`.
      const modelScope = (this.nodeScope.modelScope || Model) as { create(data: unknown): ModelLike };
      const model = modelScope.create(item);

      // `createNode` is declared for any node; a task template instantiates to a component
      // instance, which is what carries `_internal.creatorCallbacks`.
      const itemNode = (await this.nodeScope.createNode(internal.template, guid(), {
        _forEachModel: model,
        _forEachNode: this
      })) as unknown as TaskNode;

      // This is needed to make sure any action connected to the start input
      // is not run directly
      const _isInputConnected = itemNode.isInputConnected.bind(itemNode);
      itemNode.isInputConnected = (name: string) => {
        if (name === contract.start) return true;
        return _isInputConnected(name);
      };

      itemNode._runTaskIndex = entry.index;

      // Set the Id as an input
      if (itemNode.hasInput('Id')) {
        itemNode.setInputValue('Id', model.getId());
      }
      if (itemNode.hasInput('id')) {
        itemNode.setInputValue('id', model.getId());
      }

      // Push all other values also as inputs
      // if they exist as component inputs
      for (const inputKey in itemNode._inputs) {
        if (model.data[inputKey] !== undefined) itemNode.setInputValue(inputKey, model.data[inputKey]);
      }

      // capture signals
      itemNode._internal.creatorCallbacks = {
        onOutputChanged: (name: string, value: unknown, oldValue: unknown) => {
          if ((oldValue === false || oldValue === undefined) && value === true) {
            this.itemOutputSignalTriggered(name, model, itemNode);
          }
        }
      };

      return itemNode;
    },
    async startTask(this: RunTasksNodeInstance, entry: QueuedTask) {
      const internal = this._internal;
      const contract = this._contract();

      try {
        const taskComponent = await this.createTaskComponent(entry);

        // NDA-004 / corpus row F1. This node's whole contract with its template is three
        // string-matched port names, and the one an author actually gets wrong is the
        // completion signal: name the template's output `Done` instead of `Success` and
        // `itemOutputSignalTriggered` never matches, `completedTasks` never reaches
        // `numTasks`, and the run sits in `running` for ever — no success, no failure, no
        // timeout, no warning. The four warnings in `run` cover every condition except that
        // one, which is why the node reads as broken rather than misconfigured.
        //
        // A template with neither port cannot ever complete, so this is knowable the moment
        // the first task component exists rather than never. Report it and end the run: a
        // hang is the worst of the available outcomes because it is the only one downstream
        // cannot react to. NDA-009 §1 additionally catches this at template-selection time
        // in the editor, which is earlier and better; this is the runtime backstop that also
        // holds in a deployed app.
        if (!taskComponent.hasOutput(contract.success) && !taskComponent.hasOutput(contract.failure)) {
          this.nodeScope.deleteNode(taskComponent);
          this.endRunAsFailed(
            'run-tasks/no-completion-output',
            'The task template "' +
              internal.template +
              '" has no ' +
              contract.success +
              ' or ' +
              contract.failure +
              ' output, so a task can never report completion',
            { template: internal.template, expectedOutputs: [contract.success, contract.failure] }
          );
          return;
        }

        internal.runningTasks++;
        sendSignalOnInput(taskComponent, contract.start);
        internal.activeTasks.set(taskComponent.id, taskComponent);
      } catch (e) {
        // Something went wrong starting the task. Reported rather than logged: a task that
        // never starts is one that never completes, so the run would hang on it just as
        // surely as a mis-named output does.
        this.endRunAsFailed('run-tasks/task-start-failed', 'A task could not be started', {
          template: internal.template,
          itemIndex: entry.index,
          error: e instanceof Error ? e.message : String(e)
        });
      }
    },
    /**
     * End a run that provably cannot finish, and say why.
     *
     * `failure` and `done` both fire because downstream sequencing is what is actually at
     * stake: an author who wired "when the run is done, do the next thing" gets to do the
     * next thing, and an author who wired `failure` finds out. Idempotent — with
     * `maxRunningTasks` above one, several tasks discover the same broken template in the
     * same pass, and the author needs telling once.
     */
    endRunAsFailed(this: RunTasksNodeInstance, code: string, message: string, detail?: unknown) {
      const internal = this._internal;
      if (internal.state === 'idle') return;

      this.raiseRuntimeError(code, message, detail);

      internal.queuedTasks = [];
      internal.state = 'idle';
      this.sendSignalOnOutput('failure');
      this.sendSignalOnOutput('done');
    },
    /**
     * NDA-012 §B2 — a `Do` that cannot start a run says so **at runtime**, not only in the editor.
     *
     * `run`'s three preconditions were reported with `editorConnection.sendWarning` and nothing
     * else, which is the Failure Contract's headline defect: measured, a `Do` with no template
     * produced `state=idle, signals=[], errors=[]` — in a deployed app the node did nothing and
     * told nobody. This is the same repair NDA-004 §2 made across the Data nodes.
     *
     * Separate from {@link endRunAsFailed} because that one guards on `state === 'idle'` — it
     * exists to end a run already in progress, and every case here is one that never started.
     */
    _failToStart(this: RunTasksNodeInstance, code: string, message: string, detail?: unknown) {
      this.raiseRuntimeError(code, message, detail);
      this.sendSignalOnOutput('failure');
      this.sendSignalOnOutput('done');
    },
    async run(this: RunTasksNodeInstance) {
      const internal = this._internal;

      if (this.context.editorConnection) {
        if (internal.state !== 'idle') {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'run-tasks', {
            message: 'Cannot start when not in idle mode'
          });
        } else if (!internal.template) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'run-tasks', {
            message: 'No task template specified.'
          });
        } else if (!internal.items) {
          this.context.editorConnection.sendWarning(this.nodeScope.componentOwner.name, this.id, 'run-tasks', {
            message: 'No items array provided.'
          });
        } else {
          this.context.editorConnection.clearWarning(this.nodeScope.componentOwner.name, this.id, 'run-tasks');
        }
      }

      // NDA-012 §B2. Each of these used to `return` silently after an editor-only warning.
      //
      // ⚠️ The "already running" case is deliberately **not** a `failure` signal: the first run
      // is still in flight and will send its own completion, and firing `failure` here would
      // report on a run that has not failed. It is raised on the error bus so a deployed app
      // can see it, which is the half that was missing.
      if (internal.state !== 'idle') {
        this.raiseRuntimeError(
          'run-tasks/already-running',
          'Do was triggered while a run was still in progress, so it was ignored',
          { template: internal.template }
        );
        return;
      }

      if (!internal.template) {
        this._failToStart('run-tasks/no-template', 'No task template is selected, so there is nothing to run');
        return;
      }

      if (!internal.items) {
        this._failToStart(
          'run-tasks/no-items',
          'No Items list was provided, so there is nothing to run — an empty list is a completed run, but an absent one is a wiring mistake'
        );
        return;
      }

      // A run of zero tasks can never finish, because nothing will ever arrive to complete it.
      // The node's own comment on `startTask` states the principle: a hang is the worst
      // available outcome, because it is the only one downstream cannot react to.
      if (!(internal.maxRunningTasks >= 1)) {
        this._failToStart(
          'run-tasks/invalid-concurrency',
          'Max Running Tasks is ' + internal.maxRunningTasks + ', so no task could ever start',
          { maxRunningTasks: internal.maxRunningTasks }
        );
        return;
      }

      internal.state = 'running';
      internal.numTasks = internal.items.length;
      internal.failedTasks = 0;
      internal.completedTasks = 0;
      // Wrapped with the position each item holds in `items`, so a failure can name *which*
      // one (§3). The index is captured here rather than looked up later because `indexOf`
      // would collapse duplicate items onto one position, and a list of fifty identical
      // records is exactly the shape this node is for.
      internal.queuedTasks = internal.items.map((item, index) => ({ item, index }));
      internal.runningTasks = 0;

      // No tasks
      //
      // NDA-012 §B3 — `Done` fires here too. It did not, and an empty list is the *common*
      // case, not an edge one: a query that matched nothing hands this node `[]`. An author
      // who wired "when the run is Done, do the next thing" had their graph stop dead
      // precisely when there was no work, which is the one time it should sail through.
      if (internal.items.length === 0) {
        this.sendSignalOnOutput('success');
        this.sendSignalOnOutput('done');
        internal.state = 'idle';
        return;
      }

      // Start tasks
      for (let i = 0; i < Math.min(internal.maxRunningTasks, internal.queuedTasks.length); i++) {
        const task = internal.queuedTasks.shift();
        if (!task) break;

        this.startTask(task);
      }
    },
    /**
     * NDA-012 §H1 — **`Abort` used to brick the node, permanently and silently.**
     *
     * It set `state = 'aborted'` unconditionally, and the only code that ever leaves that state
     * is `checkDone`, which runs when a *task* completes. So an `Abort` with nothing in flight —
     * pulsed before the first run, or after one finished — left the node in a state `run` refuses
     * to start from. Measured: `state=aborted`, then `Do`, then still `state=aborted, signals=[]`.
     * No signal, no error, no way back. Every later `Do` for the life of the page did nothing.
     *
     * Two guards, matching what the two situations mean:
     *
     * - **Nothing is running**: there is nothing to abort. Do not change state, and do not
     *   pretend a run ended — an `Aborted` signal here would report on a run that never began.
     * - **Running, but no task is in flight** (all queued, none started, or the last one just
     *   returned): the abort can be honoured immediately, because no `checkDone` is coming to
     *   honour it later. End the run properly rather than waiting for an event that cannot arrive.
     */
    abort: function (this: RunTasksNodeInstance) {
      const internal = this._internal;

      if (internal.state !== 'running') return;

      internal.state = 'aborted';

      if (internal.activeTasks.size === 0) {
        internal.queuedTasks = [];
        internal.state = 'idle';
        this.sendSignalOnOutput('aborted');
        this.sendSignalOnOutput('done');
      }
    },
    itemOutputSignalTriggered: function (
      this: RunTasksNodeInstance,
      name: string,
      model: ModelLike,
      itemNode: TaskNode
    ) {
      const internal = this._internal;

      if (internal.state === 'idle') {
        // Signal while we are not running is ignored
        return;
      }

      const checkDone = () => {
        if (internal.state === 'aborted') {
          // `done` here for the same reason as every other terminal path: it is the signal
          // downstream sequencing is wired to, and this is a run ending. Before this pass only
          // the ordinary-completion path sent it, so whether "then do the next thing" fired
          // depended on *how* the run finished.
          internal.queuedTasks = [];
          this.sendSignalOnOutput('aborted');
          this.sendSignalOnOutput('done');
          internal.state = 'idle';
          return;
        }

        if (internal.completedTasks === internal.numTasks) {
          if (internal.failedTasks === 0) this.sendSignalOnOutput('success');
          else this.sendSignalOnOutput('failure');
          this.sendSignalOnOutput('done');
          internal.state = 'idle';
        } else {
          if (internal.stopOnFailure) {
            // Only continue if there are no failed tasks, otherwise aborted
            if (internal.failedTasks === 0) {
              // Note `startTask` increments `runningTasks` again, so each continuation
              // counts twice. Nothing reads the field, so it is inert bookkeeping rather
              // than a live bug — but it does not mean what it says. Kept verbatim.
              internal.runningTasks++;
              const task = internal.queuedTasks.shift();
              if (task) this.startTask(task);
            } else {
              // NDA-012 §H1 — **`Stop On Failure` used to disable the node for good.**
              //
              // This branch is the one the option exists for, and it sent its two signals
              // without ever returning to `idle` or sending `done`. Measured: after one failing
              // task, `state=running` for ever, and a second `Do` produced nothing at all. So
              // ticking `Stop On Failure` meant the first failure was also the last thing the
              // node ever did.
              //
              // `done` joins them for the same reason as the empty-list path: it is what
              // downstream sequencing is wired to, and the run has ended.
              internal.queuedTasks = [];
              internal.state = 'idle';
              this.sendSignalOnOutput('failure');
              this.sendSignalOnOutput('aborted');
              this.sendSignalOnOutput('done');
            }
          } else {
            internal.runningTasks++;
            const task = internal.queuedTasks.shift();
            if (task) this.startTask(task);
          }
        }
      };

      const contract = this._contract();

      if (name === contract.success) {
        internal.completedTasks++;
        internal.runningTasks--;
        checkDone();
      } else if (name === contract.failure) {
        // §3 — report *before* `checkDone`, and before the node is torn down below. The
        // aggregate `failure` signal `checkDone` may send says only that the batch failed;
        // this says which item, and it has to be read while the task component still exists
        // because the error output is read off it.
        this.reportTaskFailure(model, itemNode);

        internal.completedTasks++;
        internal.failedTasks++;
        internal.runningTasks--;
        checkDone();
      }

      internal.activeTasks.delete(itemNode.id);
      this.nodeScope.deleteNode(itemNode);
    },
    /**
     * NDA-009 §3 — say which of fifty tasks failed, and why if the template can say.
     *
     * The aggregate `failure` output fires once for a run of any size, so an author with one
     * bad record in fifty learned only that something went wrong. This raises one event per
     * failing task on NDA-004's channel, carrying the item's position in `items` and its record
     * id — the two things that let an author find the record again.
     *
     * **Why is optional and comes from the template, because the completion signal cannot
     * carry it.** `Failure` is a bare signal. If the template has an output under the
     * configured error name (`Error` by default), its value is attached; if it has none, the
     * report carries identity alone rather than inventing a reason. A template that cannot
     * explain its failures is a legitimate shape and gets no warning for it — see
     * `TEMPLATE_CONTRACT.error`.
     */
    reportTaskFailure(this: RunTasksNodeInstance, model: ModelLike, itemNode: TaskNode) {
      const internal = this._internal;
      const contract = this._contract();

      let error: unknown;
      if (itemNode.hasOutput(contract.error)) {
        try {
          error = itemNode.getOutput(contract.error).value;
        } catch (e) {
          // The getter belongs to the author's component. A throw here would abandon the rest
          // of the run over a diagnostic, which is the failure channel doing more damage than
          // the failure it is reporting.
          error = '<the ' + contract.error + ' output threw: ' + (e instanceof Error ? e.message : String(e)) + '>';
        }
      }

      const index = itemNode._runTaskIndex;

      this.raiseRuntimeError(
        'run-tasks/task-failed',
        'Task ' +
          (index === undefined ? '' : index + 1 + ' of ' + internal.numTasks + ' ') +
          'failed' +
          (error === undefined || error === null || error === '' ? '' : ': ' + String(error)),
        {
          template: internal.template,
          itemIndex: index,
          itemId: model && typeof model.getId === 'function' ? model.getId() : undefined,
          item: model ? model.data : undefined,
          error
        }
      );
    },
    _queueOperation(this: RunTasksNodeInstance, op: () => void | Promise<void>) {
      this._internal.queuedOperations.push(op);
      this._runQueueOperations();
    },
    async _runQueueOperations(this: RunTasksNodeInstance) {
      if (this.runningOperations) {
        return;
      }
      this.runningOperations = true;

      while (this._internal.queuedOperations.length) {
        const op = this._internal.queuedOperations.shift();
        await op();
      }

      this.runningOperations = false;
    },
    // Both of these used to be declared at the *top level* of the definition rather than
    // here, and `nodedefinition.ts` installs `opts.methods || opts.prototypeExtensions` and
    // nothing else — so neither reached the prototype. The base `Node.prototype._onNodeDeleted`
    // ran instead, and deleting a Run Tasks node mid-run leaked every live task component
    // into the node scope with no owner (PLAT-003 NOTES §25.3 items 1–2).
    _deleteAllTasks(this: RunTasksNodeInstance) {
      // `.values()`, not the Map itself: `for…of` over a `Map` yields `[key, value]`
      // entries, so `deleteNode` would be handed a two-element array rather than a node.
      for (const taskComponent of this._internal.activeTasks.values()) {
        this.nodeScope.deleteNode(taskComponent);
      }
      this._internal.activeTasks.clear();
    },
    _onNodeDeleted(this: RunTasksNodeInstance) {
      Node.prototype._onNodeDeleted.call(this);
      this._deleteAllTasks();
    }
  }
} as NodeDefinitionOptions;

const RunTasksNodeModule: NodeModule = {
  node: RunTasksDefinition,

  setup: function (context: NodeContextLike, graphModel: GraphModelLike) {
    if (!context.editorConnection || !context.editorConnection.isRunningLocally()) {
      return;
    }
    const editorConnection: EditorConnectionLike = context.editorConnection;

    function watch(node: GraphNodeModel) {
      const recheck = () => checkTemplateContract(editorConnection, node, graphModel);

      /**
       * Re-check when the *template* changes, not only when the choice does.
       *
       * Renaming a task component's `Success` output is the other half of this defect and the
       * more insidious one: the author is editing a component, not the Run Tasks node, so
       * nothing draws their attention to the node they have just broken.
       *
       * Listeners are registered on each template this node ever points at and never removed,
       * which is deliberate on two counts. `EventSender` has no `off` — only `on`,
       * `removeListenersWithRef` and `removeAllListeners` — so unregistering would mean the
       * ref-based path, and ref-registered listeners live in a `Map` that `emit` walks with
       * `for…of` (the transpile trap banked in this phase: under a pre-ES2015 target that
       * becomes an index loop over `map.length` and delivers nothing, silently). And a stale
       * listener here is harmless: `recheck` re-reads `taskTemplate` from the node every time,
       * so a port change on an abandoned template costs one redundant check that reaches the
       * correct answer about the current one.
       */
      function trackComponent(name: string | undefined) {
        if (!name) return;

        const component = graphModel.components[name];
        if (!component) return;

        component.on('inputPortAdded', recheck);
        component.on('inputPortRemoved', recheck);
        component.on('outputPortAdded', recheck);
        component.on('outputPortRemoved', recheck);
      }

      recheck();
      trackComponent(node.parameters['taskTemplate'] as string | undefined);

      node.on('parameterUpdated', function (event: { name: string }) {
        if (event.name !== 'taskTemplate') return;

        recheck();
        trackComponent(node.parameters['taskTemplate'] as string | undefined);
      });
    }

    // `editorImportComplete`, as Show Popup does, because this reads a *different* component's
    // ports: at `nodeAdded` time the template may not have been imported yet, and the check
    // would report every template as missing.
    graphModel.on('editorImportComplete', () => {
      graphModel.on('nodeAdded.RunTasks', function (node: GraphNodeModel) {
        watch(node);
      });

      for (const node of graphModel.getNodesWithType('RunTasks')) {
        watch(node);
      }
    });
  }
};

export = RunTasksNodeModule;
