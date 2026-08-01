/**
 * BAK-006 follow-up: the Upload File node's new Private input.
 *
 * `CloudStore` is mocked rather than driven for real (as `cloudfunction2.test.ts`
 * does for its XHR path) because this node's own contract is simply "does it
 * ask CloudStore to upload with `private` set the way the input says" — the
 * wire-level behaviour of `CloudStore.uploadFile`'s new header itself is
 * covered in `noodl-runtime`'s own suite (`test/cloudstore-files.test.ts`),
 * which can exercise the real implementation directly via a relative import.
 */
const uploadFileSpy = jest.fn();
/** What `forBackend` was asked for, so the routing itself can be asserted. */
const forBackendSpy = jest.fn();
/** Set to `false` to make `forBackend` answer "no such backend". */
let backendResolves = true;

// ⚠️ **`forBackend`, not `instance`.** BCN-007 step 6's live driver found this
// node calling `CloudStore.instance` — the singleton that always resolves the
// legacy `cloudservices` endpoint — so an Upload File node could not reach any
// of the backends BCN-004 gave the Record family. `instance` is kept on the mock
// deliberately: if the node ever reaches for it again, nothing here would fail,
// so the routing is asserted positively below instead.
jest.mock('@noodl/runtime/src/api/cloudstore', () => ({
  instance: { uploadFile: (...args: unknown[]) => uploadFileSpy(...args) },
  forBackend: (modelScope: unknown, backendId: unknown) => {
    forBackendSpy(modelScope, backendId);
    return backendResolves ? { uploadFile: (...args: unknown[]) => uploadFileSpy(...args) } : undefined;
  }
}));
jest.mock('@noodl/runtime/src/api/cloudfile', () => {
  return class FakeCloudFile {
    name: string;
    url: string;
    constructor({ name, url }: { name: string; url: string }) {
      this.name = name;
      this.url = url;
    }
  };
});

import UploadFileModule from '../src/nodes/std-library/uploadfile';

const node = UploadFileModule.node;

interface FakeInstance {
  _internal: Record<string, unknown>;
  signals: string[];
  dirty: string[];
  flagOutputDirty(name: string): void;
  sendSignalOnOutput(name: string): void;
  scheduleAfterInputsHaveUpdated(cb: () => void): void;
  [key: string]: unknown;
}

function makeInstance(): FakeInstance {
  const instance: FakeInstance = {
    _internal: {},
    signals: [],
    dirty: [],
    flagOutputDirty(name: string) {
      this.dirty.push(name);
    },
    sendSignalOnOutput(name: string) {
      this.signals.push(name);
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

function setInput(instance: FakeInstance, name: string, value: unknown): void {
  (node.inputs[name].set as unknown as (this: FakeInstance, v: unknown) => void).call(instance, value);
}

function triggerUpload(instance: FakeInstance): void {
  (node.inputs.upload.valueChangedToTrue as unknown as (this: FakeInstance) => void).call(instance);
}

beforeEach(() => {
  uploadFileSpy.mockReset();
  forBackendSpy.mockReset();
  backendResolves = true;
});

describe('Upload File node — Private input', () => {
  test('Private defaults to falsy: uploading without setting it asks CloudStore for private: undefined', () => {
    const instance = makeInstance();
    setInput(instance, 'file', { name: 'a.png', type: 'image/png' });
    triggerUpload(instance);

    expect(uploadFileSpy).toHaveBeenCalledTimes(1);
    expect(uploadFileSpy.mock.calls[0][0].private).toBeFalsy();
  });

  test('Private: true is threaded straight through to CloudStore.uploadFile', () => {
    const instance = makeInstance();
    setInput(instance, 'file', { name: 'a.png', type: 'image/png' });
    setInput(instance, 'private', true);
    triggerUpload(instance);

    expect(uploadFileSpy).toHaveBeenCalledTimes(1);
    expect(uploadFileSpy.mock.calls[0][0].private).toBe(true);
    expect(uploadFileSpy.mock.calls[0][0].file).toEqual({ name: 'a.png', type: 'image/png' });
  });

  test('turning Private back off before uploading sends false, not a stale true', () => {
    const instance = makeInstance();
    setInput(instance, 'file', { name: 'a.png', type: 'image/png' });
    setInput(instance, 'private', true);
    setInput(instance, 'private', false);
    triggerUpload(instance);

    expect(uploadFileSpy.mock.calls[0][0].private).toBe(false);
  });
});


// ── BCN-007 step 6: the Backend picker ────────────────────────────────────

describe('Upload File node — which backend it writes to', () => {
  test('routes through CloudStore.forBackend, carrying the backendId the graph set', () => {
    const instance = makeInstance();
    // The picker's port is registered on demand, exactly as the Record family
    // does it — a static declaration would fix the enum's type at a moment when
    // there is no project metadata.
    instance.hasInput = () => false;
    instance.registerInput = (_name: string, spec: { set(v: unknown): void }) => spec.set('b_directus');
    (instance.registerInputIfNeeded as (n: string) => void)('backendId');

    setInput(instance, 'file', { name: 'a.png', type: 'image/png' });
    triggerUpload(instance);

    expect(forBackendSpy).toHaveBeenCalledTimes(1);
    expect(forBackendSpy.mock.calls[0][1]).toBe('b_directus');
    expect(uploadFileSpy).toHaveBeenCalledTimes(1);
  });

  test('⚠️ a backendId naming nothing is an error, never a silent fallback to the default', () => {
    // Falling back would upload the user's file to a different backend from the
    // one the graph names, with a Success signal to say it went well.
    backendResolves = false;
    const instance = makeInstance();
    instance.hasInput = () => false;
    instance.registerInput = (_name: string, spec: { set(v: unknown): void }) => spec.set('b_gone');
    (instance.registerInputIfNeeded as (n: string) => void)('backendId');
    instance.raiseRuntimeError = () => undefined;

    setInput(instance, 'file', { name: 'a.png', type: 'image/png' });
    triggerUpload(instance);

    expect(uploadFileSpy).not.toHaveBeenCalled();
    expect(instance.signals).toContain('failure');
    expect(String(instance._internal.error)).toContain('b_gone');
  });
});

describe('Upload File node — the File Location target', () => {
  const target = (internal: Record<string, unknown>) => {
    const instance = makeInstance();
    Object.assign(instance._internal, internal);
    return (instance.fileTarget as () => unknown)();
  };

  test('a bucket and a path become a bucket target', () => {
    expect(target({ bucket: 'avatars', path: 'me.png' })).toEqual({
      kind: 'bucket',
      bucket: 'avatars',
      path: 'me.png'
    });
  });

  test('the path defaults to the file\'s own name — the one value that CAN be derived', () => {
    expect(target({ bucket: 'avatars', file: { name: 'photo.png' } })).toEqual({
      kind: 'bucket',
      bucket: 'avatars',
      path: 'photo.png'
    });
  });

  test('a collection and a field become a record target, with recordId optional', () => {
    expect(target({ collection: 'docs', field: 'attachment' })).toEqual({
      kind: 'record',
      collection: 'docs',
      field: 'attachment'
    });
    expect(target({ collection: 'docs', field: 'attachment', recordId: 'r1' })).toEqual({
      kind: 'record',
      collection: 'docs',
      field: 'attachment',
      recordId: 'r1'
    });
  });

  test('⚠️ a HALF-filled group is undefined, not a partial target', () => {
    // A `{kind:'record'}` with no collection passes the adapter's
    // `target?.kind !== 'record'` guard and then composes a URL containing the
    // string `undefined` — a well-formed request addressing nothing. The
    // adapter's refusal sentence, which names the inputs to fill in, is
    // strictly better.
    expect(target({ collection: 'docs' })).toBeUndefined();
    expect(target({ field: 'attachment' })).toBeUndefined();
    expect(target({})).toBeUndefined();
  });
});
