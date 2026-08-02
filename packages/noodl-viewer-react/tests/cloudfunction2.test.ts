/**
 * Characterisation tests for the Cloud Function node's doCall in a deploy-shaped
 * context (DEBT-001). In a deployed app there is no `context.editorConnection`,
 * and a project may have no cloud services configured — doCall must signal the
 * node's `failure` output instead of throwing.
 */
import NoodlRuntime from '@noodl/runtime';
import NodeCtor from '@noodl/runtime/src/node';

import CloudFunction2Module from '../src/nodes/std-library/data/cloudfunction2';

const node = CloudFunction2Module.node;

interface FakeInstance {
  _internal: {
    functionName?: string;
    paramsValues: Record<string, unknown>;
    resultsValues: Record<string, unknown>;
    error?: string;
    lastCallResult?: { status: string; error?: string };
    hasScheduledCall?: boolean;
  };
  context: { editorConnection?: unknown };
  signalsSent: string[];
  /** NDA-004 §2: what the node raises on the error bus, recorded. */
  raised: Array<{ code: string; message: string }>;
  raiseRuntimeError(code: string, message: string): void;
  dirtyOutputs: string[];
  flagOutputDirty(name: string): void;
  sendSignalOnOutput(name: string): void;
  [key: string]: unknown;
}

function makeDeployShapedInstance(): FakeInstance {
  const instance: FakeInstance = {
    _internal: {
      functionName: 'myFunction',
      paramsValues: {},
      resultsValues: {}
    },
    // Deployed app: no editor connection at all.
    context: {},
    signalsSent: [],
    raised: [],
    dirtyOutputs: [],
    flagOutputDirty(name: string) {
      this.dirtyOutputs.push(name);
    },
    // Real on any `Node`; this harness binds the definition's methods onto a plain object, so
    // the runtime half has to be stood in for. Recorded rather than stubbed away, because
    // NDA-004 §2's claim about this node is that the diagnosis now leaves the port.
    raiseRuntimeError(code: string, message: string) {
      this.raised.push({ code, message });
    },
    // ERG-001. Reading the definition's real output keys, so `reportOutcome`'s
    // `outcome/missing-port` check stays live in this harness rather than being answered `true`
    // for a port the node cannot actually emit.
    hasOutput(name: string) {
      return Object.prototype.hasOwnProperty.call(node.outputs, name);
    },
    sendSignalOnOutput(name: string) {
      this.signalsSent.push(name);
    },
    // ERG-001. The rows below now drive `scheduleCall` — the method the `Call` port reaches —
    // rather than poking `doCall`, so the deferral has to actually run. Synchronous here, which
    // is what `signfileurl.test.ts` and the Record family's harnesses also do.
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    }
  };

  // ERG-001. The **real** `beginOutcome` / `reportOutcome` rather than doubles: they are what
  // turns this node's failure into a graph-visible outcome, so standing them in would test the
  // stand-in. Both depend only on members this harness already provides.
  instance.beginOutcome = NodeCtor.prototype.beginOutcome.bind(instance as never);
  instance.reportOutcome = NodeCtor.prototype.reportOutcome.bind(instance as never);

  // Bind the node's methods the way the runtime does.
  for (const key of Object.keys(node.methods)) {
    instance[key] = (node.methods as Record<string, (...args: unknown[]) => unknown>)[key].bind(instance);
  }

  return instance;
}

const savedInstance = (NoodlRuntime as { instance?: unknown }).instance;

afterEach(() => {
  (NoodlRuntime as { instance?: unknown }).instance = savedInstance;
});

test('doCall with no editorConnection and no cloudServices does not throw and signals failure', () => {
  (NoodlRuntime as { instance?: unknown }).instance = {
    getMetaData: () => undefined
  };

  const instance = makeDeployShapedInstance();

  // ⚠️ ERG-001: `scheduleCall`, not `doCall`. `doCall` is the deferred half; the *port* is what
  // opens an invocation, and poking the inner method directly would run the work with no
  // invocation behind it — which is exactly the state a node must never report an outcome from.
  expect(() => (instance.scheduleCall as () => void)()).not.toThrow();
  // ERG-001 §4: `success` was renamed to `done`, and `completed` follows every outcome.
  // ⚠️ This used to read `not.toContain('success')`, which passes **vacuously** the moment the
  // port stops existing — the exact trap this phase was already caught by once. The exact array
  // cannot pass vacuously.
  expect(instance.signalsSent).toEqual(['failure', 'completed']);

  // NDA-004 §2 / FINDINGS B-iv. Before this the message reached the `Error` port and stopped;
  // `doCall`'s own `'cloud-function-2'` warning covers the same condition but is editor-only,
  // and this test's name says it all — there is *no* editorConnection here, which is the
  // ordinary case for a deployed app.
  expect(instance.raised).toEqual([
    { code: 'cloud-function/call-failed', message: 'No cloud services defined in this project.' }
  ]);
  expect(instance._internal.lastCallResult?.status).toBe('failure');
  expect(instance._internal.error).toBeTruthy();
});

test('doCall with no editorConnection but valid cloudServices reaches the request without throwing', () => {
  (NoodlRuntime as { instance?: unknown }).instance = {
    getMetaData: () => ({ appId: 'app-id', endpoint: 'https://backend.example' })
  };

  // A deployed app has XMLHttpRequest from the browser; the node test environment
  // does not, so stub just enough to observe that doCall gets past the guards and
  // issues the request against the cloud-services endpoint.
  const opened: string[] = [];
  class FakeXHR {
    onreadystatechange: (() => void) | null = null;
    open(method: string, url: string) {
      opened.push(`${method} ${url}`);
    }
    setRequestHeader() {}
    send() {}
  }
  (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest = FakeXHR;
  (globalThis as { localStorage?: unknown }).localStorage = {};

  try {
    const instance = makeDeployShapedInstance();

    // ⚠️ ERG-001: `scheduleCall`, not `doCall`. `doCall` is the deferred half; the *port* is what
  // opens an invocation, and poking the inner method directly would run the work with no
  // invocation behind it — which is exactly the state a node must never report an outcome from.
  expect(() => (instance.scheduleCall as () => void)()).not.toThrow();
    expect(instance.signalsSent).not.toContain('failure');
    expect(opened).toEqual(['POST https://backend.example/functions/myFunction']);
  } finally {
    delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
