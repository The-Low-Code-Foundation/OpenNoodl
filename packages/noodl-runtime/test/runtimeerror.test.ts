/**
 * The runtime error channel — `dev-docs/reference/FAILURE-CONTRACT.md`.
 *
 * The properties under test are the ones the contract commits to, in its order: the channel
 * exists without an editor, events are structured, provenance is the runtime's to fill in,
 * and no subscriber can take the channel down. The last is the one worth being fussy about:
 * a failure channel that stops delivering because one listener threw reproduces, one level
 * up, exactly the silence this whole contract exists to remove.
 */

/* eslint-env jest */

import {
  RuntimeErrorBus,
  createConsoleErrorSubscriber,
  createEditorWarningSubscriber,
  raiseUnattributedRuntimeError,
  setAmbientErrorBus,
  type RuntimeErrorEvent
} from '../src/runtimeerror';

import NodeContext = require('../src/nodecontext');
import NodeDefinition = require('../src/nodedefinition');

function anEvent(overrides?: Partial<RuntimeErrorEvent>): RuntimeErrorEvent {
  return {
    nodeId: 'n1',
    componentName: '/Main',
    nodeType: 'Run Tasks',
    code: 'run-tasks/no-success-output',
    message: 'The task template has no Success output',
    ...overrides
  };
}

describe('RuntimeErrorBus', () => {
  test('delivers a raised event to every subscriber', () => {
    const bus = new RuntimeErrorBus();
    const first = jest.fn();
    const second = jest.fn();
    bus.subscribe(first);
    bus.subscribe(second);

    bus.raise(anEvent());

    expect(first).toHaveBeenCalledWith(anEvent());
    expect(second).toHaveBeenCalledWith(anEvent());
  });

  test('unsubscribe stops delivery, through the handle and through the function', () => {
    const bus = new RuntimeErrorBus();
    const viaHandle = jest.fn();
    const viaFunction = jest.fn();
    const subscription = bus.subscribe(viaHandle);
    bus.subscribe(viaFunction);

    subscription.unsubscribe();
    bus.unsubscribe(viaFunction);
    bus.raise(anEvent());

    expect(viaHandle).not.toHaveBeenCalled();
    expect(viaFunction).not.toHaveBeenCalled();
    expect(bus.hasSubscribers).toBe(false);
  });

  test('a throwing subscriber does not stop the ones after it', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const bus = new RuntimeErrorBus();
      const reached: string[] = [];
      bus.subscribe(() => {
        reached.push('before');
      });
      bus.subscribe(() => {
        throw new Error('subscriber is broken');
      });
      bus.subscribe(() => {
        reached.push('after');
      });

      bus.raise(anEvent());

      expect(reached).toEqual(['before', 'after']);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('a subscriber that unsubscribes during delivery does not skip its neighbour', () => {
    const bus = new RuntimeErrorBus();
    const reached: string[] = [];
    const first = () => {
      reached.push('first');
      bus.unsubscribe(first);
    };
    bus.subscribe(first);
    bus.subscribe(() => {
      reached.push('second');
    });

    bus.raise(anEvent());

    expect(reached).toEqual(['first', 'second']);
  });

  /**
   * An `On App Error` node whose downstream graph fails would otherwise recurse until the
   * stack gives out, turning one node's failure into a dead app.
   */
  test('a subscriber that raises again is bounded rather than recursing for ever', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const bus = new RuntimeErrorBus();
      let raises = 0;
      bus.subscribe(() => {
        raises++;
        bus.raise(anEvent({ code: 'test/re-entrant' }));
      });

      bus.raise(anEvent());

      expect(raises).toBeLessThanOrEqual(2);
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('raising with nothing subscribed is a no-op', () => {
    const bus = new RuntimeErrorBus();
    expect(bus.hasSubscribers).toBe(false);
    expect(() => bus.raise(anEvent())).not.toThrow();
  });
});

describe('default subscribers', () => {
  test('the editor subscriber forwards to sendWarning, keyed by code', () => {
    const sendWarning = jest.fn();
    createEditorWarningSubscriber({ sendWarning })(anEvent());

    expect(sendWarning).toHaveBeenCalledWith('/Main', 'n1', 'run-tasks/no-success-output', {
      showGlobally: true,
      message: 'The task template has no Success output'
    });
  });

  test('the console subscriber names the node, the component and the code', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      createConsoleErrorSubscriber()(anEvent());

      const line = consoleError.mock.calls[0][0] as string;
      expect(line).toContain('Run Tasks');
      expect(line).toContain('/Main');
      expect(line).toContain('The task template has no Success output');
      expect(line).toContain('run-tasks/no-success-output');
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('NodeContext wiring', () => {
  /**
   * The headline clause of the contract. A context built without an editor connection — a
   * deployed app, cloud runtime, SSR, exported code — still has a channel, and it still
   * reports.
   */
  test('a context with no editor connection still has a bus, and it reports', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const context = new NodeContext();

      expect(context.errorBus).toBeInstanceOf(RuntimeErrorBus);
      expect(context.errorBus.hasSubscribers).toBe(true);

      context.errorBus.raise(anEvent());
      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('a context with an editor connection routes to sendWarning', () => {
    const sendWarning = jest.fn();
    const context = new NodeContext({
      editorConnection: { sendWarning, on() {}, isConnected: () => false }
    });

    context.errorBus.raise(anEvent());

    expect(sendWarning).toHaveBeenCalledWith(
      '/Main',
      'n1',
      'run-tasks/no-success-output',
      expect.objectContaining({ message: 'The task template has no Success output' })
    );
  });
});

/**
 * NDA-004 criterion 2 — the same error, observable in all four contexts.
 *
 * The row above ("no editor connection") described a context no shipping runtime ever builds.
 * `NoodlRuntime` constructs an `EditorConnection` unconditionally and documents it as a no-op
 * when deployed (`noodl-runtime.ts:285-288`), so the old `if (editorConnection) … else console`
 * always took the first branch and the console subscriber was unreachable outside a
 * directly-constructed context. Measured on a real Deploy To Folder: the deployed browser build
 * and the SSG build each carried `editorWarningSubscriber` and nothing else, so a raised failure
 * went to a socket connected to nothing and printed nowhere.
 *
 * These rows pin the discrimination the fix turns on, which is *not* "is there a connection
 * object" — there always is — but "is the editor's warning panel the surface someone is
 * watching". A subscriber-name assertion is used deliberately: asserting only that
 * `console.error` fired would stay green if the editor subscriber were dropped instead.
 */
describe('NDA-004 criterion 2: the console channel in a deployed runtime', () => {
  const subscriberNames = (context: InstanceType<typeof NodeContext>) =>
    (context.errorBus as unknown as { _subscribers: { name: string }[] })._subscribers.map((s) => s.name);

  const aConnection = () => ({ sendWarning: jest.fn(), on() {}, isConnected: () => false });

  test('G1: a deployed browser app, SSR or export gets the console line as well', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      // What `_hydrateDeployed` and the SSR server both build: `runDeployed: true`, hence
      // `runningInEditor: false`, and an editor connection that will never open a socket.
      const connection = aConnection();
      const context = new NodeContext({ editorConnection: connection, runningInEditor: false });

      expect(subscriberNames(context)).toEqual(['editorWarningSubscriber', 'consoleErrorSubscriber']);

      context.errorBus.raise(anEvent());

      expect(consoleError).toHaveBeenCalled();
      // The editor half is kept, not swapped: it has to be armed before the socket opens or a
      // boot-time warning is lost, and it is a no-op while disconnected.
      expect(connection.sendWarning).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test("G2 (control): the editor's own preview still reports only to the warning panel", () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const connection = { ...aConnection(), runtimeType: 'browser' };
      const context = new NodeContext({ editorConnection: connection, runningInEditor: true });

      expect(subscriberNames(context)).toEqual(['editorWarningSubscriber']);

      context.errorBus.raise(anEvent());

      expect(connection.sendWarning).toHaveBeenCalled();
      // Criterion 3: `sendWarning` still shows what it showed before, and the editor console
      // does not acquire a duplicate of every warning already in the panel.
      expect(consoleError).not.toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });

  test('G3: the cloud runtime gets the console line, because its console is the server log', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      // `noodl-viewer-cloud/src/index.ts` never passes `runDeployed`, so a *deployed* cloud
      // function reports `runningInEditor: true` while having no editor to report to. The
      // runtime type is what tells the two apart.
      const connection = { ...aConnection(), runtimeType: 'cloud' };
      const context = new NodeContext({ editorConnection: connection, runningInEditor: true });

      expect(subscriberNames(context)).toEqual(['editorWarningSubscriber', 'consoleErrorSubscriber']);

      context.errorBus.raise(anEvent());

      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});

describe('Node.raiseRuntimeError', () => {
  function aNodeIn(context: InstanceType<typeof NodeContext>) {
    const definition = NodeDefinition.defineNode({
      name: 'test.Raiser',
      category: 'Test',
      inputs: {},
      outputs: {}
    });
    context.nodeRegister.register(definition);
    const node = context.nodeRegister.createNode('test.Raiser', 'raiser-1');
    node.nodeScope = { componentOwner: { name: '/Main' } };
    return node;
  }

  test('fills in provenance the caller never passes', () => {
    const context = new NodeContext();
    const received: RuntimeErrorEvent[] = [];
    context.errorBus.subscribe((event) => received.push(event));

    aNodeIn(context).raiseRuntimeError('test/broke', 'It broke', { why: 'reasons' });

    expect(received).toEqual([
      {
        nodeId: 'raiser-1',
        componentName: '/Main',
        nodeType: 'test.Raiser',
        code: 'test/broke',
        message: 'It broke',
        detail: { why: 'reasons' }
      }
    ]);
  });

  /**
   * Some failures worth reporting happen before a node has a scope, and a failure *in the
   * failure channel* would be the worst bug in this file.
   */
  test('reports rather than throwing when the node has no component scope yet', () => {
    const context = new NodeContext();
    const received: RuntimeErrorEvent[] = [];
    context.errorBus.subscribe((event) => received.push(event));

    const node = aNodeIn(context);
    node.nodeScope = undefined;

    expect(() => node.raiseRuntimeError('test/early', 'Too early')).not.toThrow();
    expect(received[0]).toMatchObject({ componentName: '<unknown>', nodeId: 'raiser-1' });
  });
});

describe('raiseUnattributedRuntimeError', () => {
  test('goes to the ambient bus when a context has installed one', () => {
    const bus = new RuntimeErrorBus();
    const received: RuntimeErrorEvent[] = [];
    bus.subscribe((event) => received.push(event));
    setAmbientErrorBus(bus);

    raiseUnattributedRuntimeError('collection/listener-threw', "A 'change' listener on an array threw");

    expect(received[0]).toMatchObject({
      nodeId: '<runtime>',
      code: 'collection/listener-threw'
    });
  });

  /**
   * `Array.prototype` is patched at import time, so a collection can notify before any
   * `NodeContext` exists. "Never fully silent" has to hold by construction, not by whether
   * the app got that far.
   */
  test('falls back to console.error when the ambient bus has no subscribers', () => {
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      setAmbientErrorBus(new RuntimeErrorBus());

      raiseUnattributedRuntimeError('collection/listener-threw', 'A listener threw');

      expect(consoleError).toHaveBeenCalled();
    } finally {
      consoleError.mockRestore();
    }
  });
});
