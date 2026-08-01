/**
 * BCN-007's live-QA defect: `contentType` and `size` reached the adapter boundary
 * and died one line later.
 *
 * The chain the live pass measured: `nodegx-backend` answers a real upload 201 with
 * all four fields → `normalizeFileRef` keeps all four → `new CloudFile(response)`
 * destructured **two**. So BCN-007 step 1 added two fields to `FileRef` that no
 * graph could read, and the descriptor claimed a capability the product did not have.
 *
 * These tests hold the whole chain, not just the constructor, because the constructor
 * alone was never the thing that was wrong — the two ports at the end of it are the
 * deliverable. The last test pins the boundary that stays honest: a file read back out
 * of a *saved record property* still has neither, and that is `_serializeJSON`'s doing
 * (BCN-007's remainder), not something to default away here.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import CloudFile = require('../../src/api/cloudfile');
import CloudFileNodeModule = require('../../src/nodes/std-library/data/cloudfilenode');

const node = CloudFileNodeModule.node;

interface FakeInstance {
  _internal: Record<string, unknown>;
  dirty: string[];
  flagOutputDirty(name: string): void;
  [key: string]: unknown;
}

function makeInstance(): FakeInstance {
  return {
    _internal: {},
    dirty: [],
    flagOutputDirty(name: string) {
      this.dirty.push(name);
    }
  };
}

function setFile(instance: FakeInstance, value: unknown): void {
  (node.inputs.file.set as unknown as (this: FakeInstance, v: unknown) => void).call(instance, value);
}

function readOutput(instance: FakeInstance, port: string): unknown {
  return (node.outputs[port].get as unknown as (this: FakeInstance) => unknown).call(instance);
}

/** What `normalizeFileRef` produces for our own backend's 201 — the measured shape. */
const UPLOAD_201 = {
  name: 'a1b2c3_photo.png',
  url: 'https://backend.example/files/a1b2c3_photo.png',
  contentType: 'image/png',
  size: 20480
};

describe('CloudFile carries what the adapter normalised', () => {
  test('keeps contentType and size from an upload response', () => {
    const file = new CloudFile(UPLOAD_201);

    expect(file.getContentType()).toBe('image/png');
    expect(file.getSize()).toBe(20480);
  });

  test('still reduces to its url, so an Image Source or an interpolation is unchanged', () => {
    expect(String(new CloudFile(UPLOAD_201))).toBe(UPLOAD_201.url);
  });

  test('leaves both absent — not empty, not zero — on a wire that reports neither', () => {
    // Upstream Parse answers `{name, url}` only. `undefined` is the true answer;
    // `''`/`0` would be a claim that the backend said something.
    const file = new CloudFile({ name: 'photo.png', url: 'https://x/photo.png' });

    expect(file.getContentType()).toBeUndefined();
    expect(file.getSize()).toBeUndefined();
    expect('contentType' in file).toBe(false);
    expect('size' in file).toBe(false);
  });
});

describe('the Cloud File node exposes them to a graph', () => {
  test('Content Type and Size ports report the uploaded file', () => {
    const instance = makeInstance();
    setFile(instance, new CloudFile(UPLOAD_201));

    expect(readOutput(instance, 'contentType')).toBe('image/png');
    expect(readOutput(instance, 'size')).toBe(20480);
  });

  test('both ports are flagged dirty when a new file arrives', () => {
    // Without this the ports read stale after the second upload into the same
    // node — the failure mode that does not show up on a first run.
    const instance = makeInstance();
    setFile(instance, new CloudFile(UPLOAD_201));

    expect(instance.dirty).toEqual(expect.arrayContaining(['contentType', 'size']));
  });

  test('the existing URL and Name ports are untouched, guid prefix and all', () => {
    const instance = makeInstance();
    setFile(instance, new CloudFile(UPLOAD_201));

    expect(readOutput(instance, 'url')).toBe(UPLOAD_201.url);
    // Parse prefixes the stored name with a guid; the port has always stripped it.
    expect(readOutput(instance, 'name')).toBe('photo.png');
  });

  test('reads empty rather than throwing before any file is set', () => {
    const instance = makeInstance();

    expect(readOutput(instance, 'contentType')).toBeUndefined();
    expect(readOutput(instance, 'size')).toBeUndefined();
  });

  test('a file read back from a saved record property has neither, by construction', () => {
    // `cloudstore.js::_serializeJSON` writes a File as `{__type, url, name}`, so the
    // two fields do not survive a save. Pinned rather than fixed: making them survive
    // is a change to the stored record format and belongs to BCN-007's remainder.
    const roundTripped = new CloudFile({
      name: UPLOAD_201.name,
      url: UPLOAD_201.url
    } as { name: string; url: string });
    const instance = makeInstance();
    setFile(instance, roundTripped);

    expect(readOutput(instance, 'contentType')).toBeUndefined();
    expect(readOutput(instance, 'size')).toBeUndefined();
  });
});
