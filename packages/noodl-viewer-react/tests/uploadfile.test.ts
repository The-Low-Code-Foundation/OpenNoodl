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

jest.mock('@noodl/runtime/src/api/cloudstore', () => ({
  instance: { uploadFile: (...args: unknown[]) => uploadFileSpy(...args) }
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
