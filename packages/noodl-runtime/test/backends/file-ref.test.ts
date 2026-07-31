/**
 * BCN-007 step 1 — the normalised file reference.
 *
 * Two halves, and they are testing different things:
 *
 * 1. **The helper**, including the rename direction no shipped adapter uses yet.
 *    That is the `recordIdentity.ts` precedent: BCN-004's adapters are the ones
 *    that will rename, and testing the direction now means the second adapter
 *    inherits a proven helper rather than writing its own — and means a wrong
 *    answer is a failing test here rather than a wrong file URL in someone's app.
 * 2. **The Parse wire through it**, driven with a real `FileUploadResult` body
 *    copied from `nodegx-backend/src/server/files.ts` and with upstream Parse's
 *    two-field one, because the difference between those two responses is
 *    exactly what "optional because it is not always knowable" means.
 */
jest.mock('../../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import type { BackendHandle } from '@noodl/backend-contract';

import { ParseWireAdapter } from '../../src/api/backends/ParseWireAdapter';
import { normalizeFileRef, normalizeSignedFileUrl, PARSE_FILE_FIELDS } from '../../src/api/backends/fileRef';

const handle: BackendHandle = {
  id: '_active_',
  type: 'nodegx',
  name: 'Built-in',
  url: 'https://backend.example',
  publicToken: 'app-id-123'
};

class FakeXHR {
  static instances: FakeXHR[] = [];
  onreadystatechange: (() => void) | null = null;
  readyState = 0;
  status = 0;
  response = '';
  responseText = '';
  opened = '';
  headers: Record<string, string> = {};
  sentBody: unknown;
  upload: { onprogress?: (pe: unknown) => void } = {};

  constructor() {
    FakeXHR.instances.push(this);
  }
  open(method: string, url: string) {
    this.opened = `${method} ${url}`;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
  }
  send(body?: unknown) {
    this.sentBody = body;
  }
  /** Complete the request the way a real XHR would. */
  finish(status: number, body: unknown) {
    this.status = status;
    this.response = JSON.stringify(body);
    this.readyState = 4;
    this.onreadystatechange && this.onreadystatechange();
  }
}

function makeAdapter(): ParseWireAdapter {
  return new ParseWireAdapter({
    serializeObject: (data) => data,
    getServerVersionMajor: () => undefined
  });
}

describe('normalizeFileRef', () => {
  it('carries the four extra fields the wire used to discard', () => {
    // `FileUploadResult` — nodegx-backend/src/server/files.ts:70.
    const ref = normalizeFileRef(
      {
        url: 'https://backend.example/files/a1b2_my_photo.png',
        name: 'a1b2_my_photo.png',
        size: 4711,
        contentType: 'image/png'
      },
      PARSE_FILE_FIELDS
    );

    expect(ref).toEqual({
      name: 'a1b2_my_photo.png',
      url: 'https://backend.example/files/a1b2_my_photo.png',
      size: 4711,
      contentType: 'image/png'
    });
  });

  it('leaves a field absent rather than empty when the backend does not report it', () => {
    // Upstream Parse's upload response is two fields. `size: 0` and
    // `contentType: ''` would both be claims; absence is the only honest answer,
    // and it is what lets a node tell "this backend does not say" from "zero".
    const ref = normalizeFileRef({ name: 'photo.png', url: 'https://parse/photo.png' }, PARSE_FILE_FIELDS);

    expect(ref).toEqual({ name: 'photo.png', url: 'https://parse/photo.png' });
    expect('size' in ref).toBe(false);
    expect('contentType' in ref).toBe(false);
  });

  it('renames, which is the direction BCN-004 needs and no shipped adapter uses', () => {
    // Directus, as its `/files` payload actually looks.
    const ref = normalizeFileRef(
      {
        id: '8b1c1f1e-0000-4000-8000-000000000001',
        filename_download: 'my photo.png',
        filename_disk: '8b1c1f1e.png',
        type: 'image/png',
        filesize: '4711'
      },
      {
        name: 'filename_disk',
        url: 'never_present',
        id: 'id',
        filename: 'filename_download',
        contentType: 'type',
        size: 'filesize'
      },
      (_name, body) => `https://directus.example/assets/${(body as { id: string }).id}`
    );

    expect(ref).toEqual({
      name: '8b1c1f1e.png',
      url: 'https://directus.example/assets/8b1c1f1e-0000-4000-8000-000000000001',
      id: '8b1c1f1e-0000-4000-8000-000000000001',
      filename: 'my photo.png',
      contentType: 'image/png',
      // A numeric STRING. Directus reports `filesize` as one and PostgREST
      // reports every bigint as one; `NaN` on a size port is worse than nothing
      // because only one of the two is obviously missing.
      size: 4711
    });
  });

  it('drops a size it cannot read rather than reporting NaN', () => {
    const ref = normalizeFileRef({ name: 'a', url: 'b', size: 'not a number' }, PARSE_FILE_FIELDS);
    expect('size' in ref).toBe(false);
  });

  it('reports what a 200 with nothing in it actually contained, which is nothing', () => {
    // Deliberately not an error path. `new CloudFile(response)` on a body with
    // no url has always produced a file whose `toString()` is `undefined`, and
    // inventing a rejection here would be a behaviour change argued from a case
    // no backend in the rig produces. See fileRef.ts and BCN-007-NOTES.
    expect(normalizeFileRef({}, PARSE_FILE_FIELDS)).toEqual({ name: undefined, url: undefined });
    expect(normalizeFileRef(undefined, PARSE_FILE_FIELDS)).toEqual({ name: undefined, url: undefined });
  });
});

describe('normalizeSignedFileUrl', () => {
  it('stamps the kind the adapter declares rather than sniffing the url', () => {
    const signed = normalizeSignedFileUrl(
      { url: 'https://x/files/a.png?exp=1&sig=y', expiresAt: '2026-01-01T00:00:00.000Z', ttlSeconds: 300 },
      'signed'
    );
    expect(signed).toEqual({
      url: 'https://x/files/a.png?exp=1&sig=y',
      kind: 'signed',
      expiresAt: '2026-01-01T00:00:00.000Z',
      ttlSeconds: 300
    });
  });

  it('leaves expiresAt off a url that has no expiry to report', () => {
    // A `public` url is the case: it needs nothing and never expires, so an
    // `expiresAt` on it would be a date the app author could schedule against
    // and be wrong about.
    const signed = normalizeSignedFileUrl({ url: 'https://x/files/a.png' }, 'public');
    expect(signed).toEqual({ url: 'https://x/files/a.png', kind: 'public' });
  });
});

describe('the Parse wire, through the normaliser', () => {
  beforeEach(() => {
    FakeXHR.instances = [];
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
    (globalThis as unknown as { localStorage: unknown }).localStorage = {};
    (globalThis as unknown as { File: unknown }).File = class {};
  });

  afterEach(() => {
    delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { File?: unknown }).File;
  });

  it('hands uploadFile a FileRef with the size and content type our backend reports', () => {
    const results: unknown[] = [];
    makeAdapter().uploadFile(handle, {
      file: { name: 'my photo.png', type: 'image/png' },
      success: (r) => results.push(r),
      error: () => undefined
    });

    FakeXHR.instances[0].finish(201, {
      url: 'https://backend.example/files/a1b2_my_photo.png',
      name: 'a1b2_my_photo.png',
      size: 4711,
      contentType: 'image/png'
    });

    expect(results).toEqual([
      {
        name: 'a1b2_my_photo.png',
        url: 'https://backend.example/files/a1b2_my_photo.png',
        size: 4711,
        contentType: 'image/png'
      }
    ]);
  });

  it('does not spread anything else the backend sent over the reference', () => {
    // The old code was `Object.assign({}, options.data, response)` — the whole
    // response, plus a caller-supplied object no caller has ever supplied. A
    // backend that starts returning an extra field no longer changes what a
    // `CloudFile` is constructed from.
    const results: Record<string, unknown>[] = [];
    makeAdapter().uploadFile(handle, {
      file: { name: 'a.png' },
      success: (r) => results.push(r as unknown as Record<string, unknown>),
      error: () => undefined
    });

    FakeXHR.instances[0].finish(201, { name: 'a.png', url: 'https://x/a.png', _internalCursor: 'leave-me-out' });

    expect(results[0]).toEqual({ name: 'a.png', url: 'https://x/a.png' });
  });

  it('reports signFileUrl as `signed`, because only the backend that signs answers that route', () => {
    // BCN-002 probed upstream Parse: `GET /files/:name/sign` is 403 code 119
    // with the master key and without, and `parse`'s `files.sign` cell says
    // `unsupported` on that evidence. So this callback is only ever reached by
    // the one server that mints `?exp=&sig=`.
    const results: unknown[] = [];
    makeAdapter().signFileUrl(handle, {
      name: 'a1b2_my_photo.png',
      success: (r) => results.push(r),
      error: () => undefined
    });

    expect(FakeXHR.instances[0].opened).toBe('GET https://backend.example/files/a1b2_my_photo.png/sign');

    FakeXHR.instances[0].finish(200, {
      url: 'https://backend.example/files/a1b2_my_photo.png?exp=1&sig=y',
      expiresAt: '2026-01-01T00:00:00.000Z',
      ttlSeconds: 300
    });

    expect(results).toEqual([
      {
        url: 'https://backend.example/files/a1b2_my_photo.png?exp=1&sig=y',
        kind: 'signed',
        expiresAt: '2026-01-01T00:00:00.000Z',
        ttlSeconds: 300
      }
    ]);
  });

  it('still forwards the error envelope whole, status included', () => {
    // BCN-002's first corrected shape. Both node call sites read `status` to
    // tell a 403 from a 500, and normalising the success path must not quietly
    // normalise this one too.
    const errors: unknown[] = [];
    makeAdapter().signFileUrl(handle, {
      name: 'private.png',
      success: () => undefined,
      error: (e) => errors.push(e)
    });

    FakeXHR.instances[0].finish(403, { error: 'This file is private.', code: 119 });

    expect(errors).toEqual([{ error: 'This file is private.', code: 119 }]);
  });
});
