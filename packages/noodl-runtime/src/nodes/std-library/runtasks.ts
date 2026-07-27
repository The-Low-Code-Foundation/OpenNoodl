import type { ModelLike, ModelModule, NodeDefinitionOptions, NodeInstance, NodeModule } from '@noodl/types';

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
}

/**
 * `this` inside the Run Tasks node.
 *
 * The node runs a component template once per item with bounded concurrency. Each task is
 * a real component instance created in this node's scope, driven by pulsing its `Do` input
 * and watched through `creatorCallbacks.onOutputChanged` — there is no port wiring between
 * the template and this node, which is why the signal names `'Success'` and `'Failure'`
 * are matched by string below.
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
    queuedTasks?: unknown[];
    runningTasks?: number;
    hasScheduledRun?: boolean;
    hasScheduledAbort?: boolean;
  };
  /** On the instance, not in `_internal` — guards {@link _runQueueOperations}. */
  runningOperations?: boolean;
  scheduleRun(): void;
  scheduleAbort(): void;
  createTaskComponent(item: unknown): Promise<TaskNode>;
  startTask(task: unknown): Promise<void>;
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
      type: 'array',
      set: function (this: RunTasksNodeInstance, value: unknown[]) {
        if (!value) return;
        if (value === this._internal.items) return;

        this._internal.items = value;
      }
    },
    stopOnFailure: {
      group: 'General',
      displayName: 'Stop On Failure',
      type: 'boolean',
      default: false,
      set: function (this: RunTasksNodeInstance, value: boolean) {
        this._internal.stopOnFailure = value;
      }
    },
    maxRunningTasks: {
      group: 'General',
      displayName: 'Max Running Tasks',
      type: 'number',
      default: 10,
      set: function (this: RunTasksNodeInstance, value: number) {
        this._internal.maxRunningTasks = value;
      }
    },
    taskTemplate: {
      type: 'component',
      displayName: 'Template',
      group: 'General',
      set: function (this: RunTasksNodeInstance, value: string) {
        this._internal.template = value;
      }
    },
    run: {
      group: 'General',
      displayName: 'Do',
      type: 'signal',
      valueChangedToTrue: function (this: RunTasksNodeInstance) {
        this.scheduleRun();
      }
    },
    abort: {
      group: 'General',
      displayName: 'Abort',
      type: 'signal',
      valueChangedToTrue: function (this: RunTasksNodeInstance) {
        this.scheduleAbort();
      }
    }
  },
  outputs: {
    success: {
      type: 'signal',
      group: 'Events',
      displayName: 'Success'
    },
    failure: {
      type: 'signal',
      group: 'Events',
      displayName: 'Failure'
    },
    done: {
      type: 'signal',
      group: 'Events',
      displayName: 'Done'
    },
    aborted: {
      type: 'signal',
      group: 'Events',
      displayName: 'Aborted'
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
    async createTaskComponent(this: RunTasksNodeInstance, item: unknown) {
      const internal = this._internal;

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

      // This is needed to make sure any action connected to "Do"
      // is not run directly
      const _isInputConnected = itemNode.isInputConnected.bind(itemNode);
      itemNode.isInputConnected = (name: string) => {
        if (name === 'Do') return true;
        return _isInputConnected(name);
      };

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
    async startTask(this: RunTasksNodeInstance, task: unknown) {
      const internal = this._internal;

      try {
        const taskComponent = await this.createTaskComponent(task);
        internal.runningTasks++;
        sendSignalOnInput(taskComponent, 'Do');
        internal.activeTasks.set(taskComponent.id, taskComponent);
      } catch (e) {
        // Something went wrong starting the task
        console.log(e);
      }
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

      if (internal.state !== 'idle') {
        return;
      }

      if (!internal.template) {
        return;
      }

      if (!internal.items) {
        return;
      }

      internal.state = 'running';
      internal.numTasks = internal.items.length;
      internal.failedTasks = 0;
      internal.completedTasks = 0;
      internal.queuedTasks = [].concat(internal.items);
      internal.runningTasks = 0;

      // No tasks
      if (internal.items.length === 0) {
        this.sendSignalOnOutput('success');
        internal.state = 'idle';
      }

      // Start tasks
      for (let i = 0; i < Math.min(internal.maxRunningTasks, internal.queuedTasks.length); i++) {
        const task = internal.queuedTasks.shift();
        if (!task) break;

        this.startTask(task);
      }
    },
    abort: function (this: RunTasksNodeInstance) {
      const internal = this._internal;

      internal.state = 'aborted';
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
          this.sendSignalOnOutput('aborted');
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
              this.sendSignalOnOutput('failure');
              this.sendSignalOnOutput('aborted');
            }
          } else {
            internal.runningTasks++;
            const task = internal.queuedTasks.shift();
            if (task) this.startTask(task);
          }
        }
      };

      if (name === 'Success') {
        internal.completedTasks++;
        internal.runningTasks--;
        checkDone();
      } else if (name === 'Failure') {
        internal.completedTasks++;
        internal.failedTasks++;
        internal.runningTasks--;
        checkDone();
      }

      internal.activeTasks.delete(itemNode.id);
      this.nodeScope.deleteNode(itemNode);
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
  node: RunTasksDefinition
};

export = RunTasksNodeModule;
