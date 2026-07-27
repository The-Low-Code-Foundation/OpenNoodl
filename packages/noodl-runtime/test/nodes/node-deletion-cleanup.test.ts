/**
 * Characterisation tests for the two node-deletion defects PLAT-003 slice 11 recorded
 * (NOTES §25.3 items 1–3) and slice 12 fixes.
 *
 * Both are about what happens when a node is deleted mid-run:
 *
 *   * **Run Tasks** declared `_onNodeDeleted` and `_deleteAllTasks` at the *top level* of
 *     its definition object rather than inside `methods`. `nodedefinition.ts` installs
 *     `opts.methods || opts.prototypeExtensions` and nothing else, so neither reached the
 *     prototype: the base `Node.prototype._onNodeDeleted` ran instead and every live task
 *     component was left in the node scope with no owner. `_deleteAllTasks` would not have
 *     worked had it been reached either — `for…of` over a `Map` yields `[key, value]`
 *     entries, so `deleteNode` would have been handed a two-element array.
 *
 *   * **Expression** overrode `_onNodeDeleted` without chaining to `Node.prototype`, so a
 *     deleted Expression node never cleared its model listeners, never set `_deleted`, and
 *     never unsubscribed its port-level expression subscriptions.
 *
 * These assert the fixed behaviour and are written to fail against the pre-fix source.
 */

import type { NodeModule } from '@noodl/types';

const NodeDefinition = require('../../src/nodedefinition');
const Node = require('../../src/node');

import RunTasks = require('../../src/nodes/std-library/runtasks');
import Expression = require('../../src/nodes/std-library/expression');

/**
 * The parts of a node these tests reach for.
 *
 * Structural rather than a real node type on purpose: Run Tasks and Expression share no
 * interface beyond `NodeInstance`, and what is under test here is precisely the members
 * that were *not* installed on the prototype.
 */
interface NodeUnderTest {
  _deleted?: boolean;
  model?: { removeListenersWithRef(ref: unknown): void };
  _expressionSubscriptions: Record<string, { unsub(): void }>;
  _internal: {
    activeTasks?: Map<string, TaskComponent>;
    unsubscribe?: (() => void) | null;
  };
  addDeleteListener(listener: () => void): void;
  _onNodeDeleted(): void;
  _deleteAllTasks?(): void;
}

/** A stand-in for the component instance Run Tasks creates per item. */
interface TaskComponent {
  id: string;
  _internal: Record<string, unknown>;
}

/** The smallest context a node definition's factory will accept. */
function createStubContext() {
  return {
    hasFatalError: false,
    scheduleUpdate() {},
    scheduleAfterUpdate() {},
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    },
    editorConnection: undefined,
    modelScope: undefined
  };
}

function createNode(module: NodeModule, nodeScope?: unknown): NodeUnderTest {
  const definition = NodeDefinition.defineNode(module.node);
  return definition(createStubContext(), 'test-node-id', nodeScope);
}

describe('Run Tasks — deleting the node cleans up its live tasks', () => {
  function createTaskNode(id: string): TaskComponent {
    return { id, _internal: {} };
  }

  function createStubScope() {
    const deleted: unknown[] = [];
    return {
      deleted,
      modelScope: undefined,
      deleteNode(node: unknown) {
        deleted.push(node);
      }
    };
  }

  it('installs its deletion hooks on the prototype', () => {
    const scope = createStubScope();
    const node = createNode(RunTasks, scope);

    expect(typeof node._deleteAllTasks).toBe('function');
    expect(typeof node._onNodeDeleted).toBe('function');
    // The node's own override, not the one it inherits.
    expect(node._onNodeDeleted).not.toBe(Node.prototype._onNodeDeleted);
  });

  it('deletes every active task component, and passes the component rather than a Map entry', () => {
    const scope = createStubScope();
    const node = createNode(RunTasks, scope);

    const first = createTaskNode('task-1');
    const second = createTaskNode('task-2');
    node._internal.activeTasks.set(first.id, first);
    node._internal.activeTasks.set(second.id, second);

    node._onNodeDeleted();

    expect(scope.deleted).toEqual([first, second]);
    // A `for…of` over the Map itself would have handed `deleteNode` `['task-1', first]`.
    scope.deleted.forEach((arg: unknown) => expect(Array.isArray(arg)).toBe(false));
  });

  it('clears the active-task map so nothing is deleted twice', () => {
    const scope = createStubScope();
    const node = createNode(RunTasks, scope);

    node._internal.activeTasks.set('task-1', createTaskNode('task-1'));
    node._onNodeDeleted();

    expect(node._internal.activeTasks.size).toBe(0);
  });

  it('still runs the base cleanup', () => {
    const scope = createStubScope();
    const node = createNode(RunTasks, scope);

    let deleteListenerRan = false;
    node.addDeleteListener(() => {
      deleteListenerRan = true;
    });

    node._onNodeDeleted();

    expect(node._deleted).toBe(true);
    expect(deleteListenerRan).toBe(true);
  });
});

describe('Expression — deleting the node chains to the base cleanup', () => {
  it('still unsubscribes its own reactive subscription', () => {
    const node = createNode(Expression);

    let unsubscribed = false;
    node._internal.unsubscribe = () => {
      unsubscribed = true;
    };

    node._onNodeDeleted();

    expect(unsubscribed).toBe(true);
    expect(node._internal.unsubscribe).toBe(null);
  });

  it('marks the node deleted and drops its model listeners', () => {
    const node = createNode(Expression);

    let removedWithRef: unknown;
    node.model = {
      removeListenersWithRef(ref: unknown) {
        removedWithRef = ref;
      }
    };

    node._onNodeDeleted();

    expect(node._deleted).toBe(true);
    expect(removedWithRef).toBe(node);
    expect(node.model).toBe(undefined);
  });

  it('unsubscribes port-level expression subscriptions', () => {
    const node = createNode(Expression);

    let unsubbed = false;
    node._expressionSubscriptions = {
      somePort: {
        unsub() {
          unsubbed = true;
        }
      }
    };

    node._onNodeDeleted();

    expect(unsubbed).toBe(true);
    expect(node._expressionSubscriptions).toEqual({});
  });

  it('runs registered delete listeners', () => {
    const node = createNode(Expression);

    let ran = false;
    node.addDeleteListener(() => {
      ran = true;
    });

    node._onNodeDeleted();

    expect(ran).toBe(true);
  });
});
