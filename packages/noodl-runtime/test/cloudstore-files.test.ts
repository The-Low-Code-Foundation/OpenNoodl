/**
 * BAK-006 follow-up: the two CloudStore changes behind the Upload File node's
 * new Private input and the new Sign File URL node.
 *
 *   - `uploadFile({ private: true })` sends `X-NodeGX-File-Private: true` —
 *     the exact (case-insensitive) header `nodegx-backend`'s `files.ts`
 *     reads to ACL the upload to its owner (see files.ts's module doc).
 *   - `signFileUrl({ name })` calls `GET /files/:name/sign`.
 *
 * This is the wire-level half: it drives `_makeRequest` directly (both the
 * browser/XHR branch a viewer runs under, and the fetch branch a cloud
 * function runs under) rather than mocking `CloudStore` — see
 * `test/nodes/signfileurl.test.ts` for the node-level half, which mocks
 * `CloudStore` instead of the wire.
 */
jest.mock('../noodl-runtime', () => ({
  instance: { getMetaData: () => undefined }
}));

import CloudStore = require('../src/api/cloudstore');

describe('CloudStore — browser (XHR) path', () => {
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
  }

  beforeEach(() => {
    FakeXHR.instances = [];
    (globalThis as unknown as { XMLHttpRequest: unknown }).XMLHttpRequest = FakeXHR;
    (globalThis as unknown as { localStorage: unknown }).localStorage = {};
    // `_makeRequest` checks `options.content instanceof File` to decide
    // raw-body vs JSON; a plain object (as used below) is neither, so a
    // minimal stand-in is enough to avoid `File` being undefined in Node.
    (globalThis as unknown as { File: unknown }).File = class {};
  });

  afterEach(() => {
    delete (globalThis as unknown as { XMLHttpRequest?: unknown }).XMLHttpRequest;
    delete (globalThis as unknown as { localStorage?: unknown }).localStorage;
    delete (globalThis as unknown as { File?: unknown }).File;
  });

  test('uploadFile({ private: true }) sets X-NodeGX-File-Private: true', () => {
    CloudStore.instance.uploadFile({
      file: { name: 'photo.png', type: 'image/png' },
      private: true,
      success: () => undefined,
      error: () => undefined
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.opened).toBe('POST undefined/files/photo.png');
    expect(xhr.headers['x-nodegx-file-private']).toBe('true');
  });

  test('uploadFile without private sends no such header at all', () => {
    CloudStore.instance.uploadFile({
      file: { name: 'photo.png', type: 'image/png' },
      success: () => undefined,
      error: () => undefined
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.headers['x-nodegx-file-private']).toBeUndefined();
  });

  test('uploadFile({ private: false }) also sends no header — only true turns it on', () => {
    CloudStore.instance.uploadFile({
      file: { name: 'photo.png', type: 'image/png' },
      private: false,
      success: () => undefined,
      error: () => undefined
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.headers['x-nodegx-file-private']).toBeUndefined();
  });

  test('signFileUrl issues GET /files/:name/sign and resolves through success', () => {
    const results: unknown[] = [];
    CloudStore.instance.signFileUrl({
      name: 'abc123_photo.png',
      success: (r: unknown) => results.push(r),
      error: () => undefined
    });

    const xhr = FakeXHR.instances[0];
    expect(xhr.opened).toBe('GET undefined/files/abc123_photo.png/sign');

    // Drive the fake XHR's completion the way a real one would.
    xhr.status = 200;
    xhr.response = JSON.stringify({ url: 'https://x/files/abc123_photo.png?exp=1&sig=y', expiresAt: '2026-01-01T00:00:00.000Z', ttlSeconds: 300 });
    xhr.readyState = 4;
    xhr.onreadystatechange && xhr.onreadystatechange();

    expect(results).toEqual([{ url: 'https://x/files/abc123_photo.png?exp=1&sig=y', expiresAt: '2026-01-01T00:00:00.000Z', ttlSeconds: 300 }]);
  });
});

describe('CloudStore — cloud runtime (fetch) path', () => {
  const realFetch = (globalThis as unknown as { fetch?: unknown }).fetch;

  beforeEach(() => {
    (globalThis as unknown as { _noodl_cloud_runtime_version: string })._noodl_cloud_runtime_version = '1';
  });

  afterEach(() => {
    delete (globalThis as unknown as { _noodl_cloud_runtime_version?: string })._noodl_cloud_runtime_version;
    (globalThis as unknown as { fetch?: unknown }).fetch = realFetch;
  });

  test('uploadFile({ private: true }) merges the header into the fetch call rather than replacing the fixed ones', async () => {
    let capturedInit: { headers?: Record<string, string> } | undefined;
    (globalThis as unknown as { fetch: (...a: unknown[]) => Promise<unknown> }).fetch = (
      _url: string,
      init: { headers?: Record<string, string> }
    ) => {
      capturedInit = init;
      return Promise.resolve({ status: 201, json: () => Promise.resolve({ name: 'photo.png', url: 'https://x/files/photo.png' }) });
    };

    await new Promise<void>((resolve) => {
      CloudStore.instance.uploadFile({
        file: { name: 'photo.png', type: 'image/png' },
        private: true,
        success: () => resolve(),
        error: () => resolve()
      });
    });

    expect(capturedInit?.headers?.['X-NodeGX-File-Private']).toBe('true');
    // The fixed header this branch has always sent is still there — the new
    // header is MERGED in, not swapped in place of it.
    expect(capturedInit?.headers?.['Content-Type']).toBe('application/json');
  });
});
