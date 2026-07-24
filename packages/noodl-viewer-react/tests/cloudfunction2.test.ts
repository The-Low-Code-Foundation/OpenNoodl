/**
 * Characterisation tests for the Cloud Function node's doCall in a deploy-shaped
 * context (DEBT-001). In a deployed app there is no `context.editorConnection`,
 * and a project may have no cloud services configured — doCall must signal the
 * node's `failure` output instead of throwing.
 */
import NoodlRuntime from '@noodl/runtime';

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
    dirtyOutputs: [],
    flagOutputDirty(name: string) {
      this.dirtyOutputs.push(name);
    },
    sendSignalOnOutput(name: string) {
      this.signalsSent.push(name);
    }
  };

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

  expect(() => (instance.doCall as () => void)()).not.toThrow();
  expect(instance.signalsSent).toContain('failure');
  expect(instance.signalsSent).not.toContain('success');
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

    expect(() => (instance.doCall as () => void)()).not.toThrow();
    expect(instance.signalsSent).not.toContain('failure');
    expect(opened).toEqual(['POST https://backend.example/functions/myFunction']);
  } finally {
    delete (globalThis as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    delete (globalThis as { localStorage?: unknown }).localStorage;
  }
});
