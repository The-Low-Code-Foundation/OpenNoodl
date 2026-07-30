/**
 * BAK-006 follow-up: the "Sign File URL" node — the node-level half.
 * `test/cloudstore-files.test.ts` covers the wire (CloudStore.signFileUrl
 * itself); this mocks CloudStore and asserts the node's own wiring: what it
 * calls, and how it turns a success/failure into outputs and signals — the
 * same shape `test/nodes/query-records-cleanup.test.ts` and
 * `tests/cloudfunction2.test.ts` (noodl-viewer-react) already use.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import CloudFile = require('../../src/api/cloudfile');
import CloudStore = require('../../src/api/cloudstore');
import SignFileUrlModule = require('../../src/nodes/std-library/data/signfileurl');

const node = SignFileUrlModule.node;

interface FakeInstance {
  _internal: Record<string, unknown>;
  dirty: string[];
  signals: string[];
  /** NDA-004 §2: what the node raises on the error bus, recorded. */
  raised: Array<{ code: string; message: string; detail?: unknown }>;
  flagOutputDirty(name: string): void;
  sendSignalOnOutput(name: string): void;
  raiseRuntimeError(code: string, message: string, detail?: unknown): void;
  scheduleAfterInputsHaveUpdated(cb: () => void): void;
  [key: string]: unknown;
}

function makeInstance(): FakeInstance {
  const instance: FakeInstance = {
    _internal: {},
    dirty: [],
    signals: [],
    raised: [],
    flagOutputDirty(name: string) {
      this.dirty.push(name);
    },
    sendSignalOnOutput(name: string) {
      this.signals.push(name);
    },
    // Real on any `Node`; this harness binds the definition's methods onto a plain object, so
    // the runtime half has to be stood in for. Recorded rather than stubbed away, because
    // NDA-004 §2's whole claim about this node is that the diagnosis now leaves the port.
    raiseRuntimeError(code: string, message: string, detail?: unknown) {
      this.raised.push({ code, message, detail });
    },
    scheduleAfterInputsHaveUpdated(cb: () => void) {
      cb();
    }
  };
  for (const key of Object.keys(node.methods || {})) {
    instance[key] = (node.methods as Record<string, (...args: unknown[]) => unknown>)[key].bind(instance);
  }
  return instance;
}

function setFile(instance: FakeInstance, value: unknown): void {
  (node.inputs.file.set as unknown as (this: FakeInstance, v: unknown) => void).call(instance, value);
}

function sign(instance: FakeInstance): void {
  (node.inputs.sign.valueChangedToTrue as unknown as (this: FakeInstance) => void).call(instance);
}

function output(instance: FakeInstance, name: string): unknown {
  return (node.outputs[name].get as unknown as (this: FakeInstance) => unknown).call(instance);
}

afterEach(() => {
  jest.restoreAllMocks();
});

describe('Sign File URL node', () => {
  test('signing with no file set reports "No file specified" as a failure, never throws', () => {
    const instance = makeInstance();

    expect(() => sign(instance)).not.toThrow();
    expect(instance.signals).toEqual(['failure']);
    expect(output(instance, 'error')).toBe('No file specified');

    // NDA-004 §2 / FINDINGS B-iv. Before this the message reached the `Error` port and stopped —
    // no diagnosis on any channel, in any runtime, the editor included.
    expect(instance.raised).toEqual([
      { code: 'sign-file-url/sign-failed', message: 'No file specified', detail: { status: 0 } }
    ]);
  });

  test('setting a non-CloudFile value is ignored, exactly like the Cloud File node', () => {
    const instance = makeInstance();
    setFile(instance, { name: 'not-a-cloudfile' });
    expect(instance._internal.cloudFile).toBeUndefined();
  });

  test('signing a set file calls CloudStore.signFileUrl with the STORED name and populates outputs on success', () => {
    const spy = jest.spyOn(CloudStore.instance, 'signFileUrl').mockImplementation(((opts: { name: string; success: (r: unknown) => void }) => {
      expect(opts.name).toBe('abc123_photo.png');
      opts.success({
        url: 'https://example.test/files/abc123_photo.png?exp=1&sig=deadbeef',
        expiresAt: '2026-01-01T00:00:00.000Z',
        ttlSeconds: 300
      });
    }) as never);

    const instance = makeInstance();
    setFile(instance, new CloudFile({ name: 'abc123_photo.png', url: 'https://example.test/files/abc123_photo.png' }));
    sign(instance);

    expect(spy).toHaveBeenCalledTimes(1);
    expect(instance.signals).toEqual(['success']);
    expect(output(instance, 'url')).toBe('https://example.test/files/abc123_photo.png?exp=1&sig=deadbeef');
    expect(output(instance, 'expiresAt')).toBe('2026-01-01T00:00:00.000Z');
    expect(output(instance, 'ttlSeconds')).toBe(300);
  });

  test('a refused sign (e.g. not the owner) surfaces through error/errorStatus, the same shape Upload File uses', () => {
    jest.spyOn(CloudStore.instance, 'signFileUrl').mockImplementation(((opts: { error: (e: unknown) => void }) => {
      opts.error({ error: 'This file is private.', code: 119, status: 403 });
    }) as never);

    const instance = makeInstance();
    setFile(instance, new CloudFile({ name: 'abc123_photo.png', url: 'x' }));
    sign(instance);

    expect(instance.signals).toEqual(['failure']);
    expect(output(instance, 'error')).toBe('This file is private.');
    expect(output(instance, 'errorStatus')).toBe(119);
  });
});
