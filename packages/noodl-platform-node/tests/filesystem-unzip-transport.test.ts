import * as fs from 'fs';
import * as os from 'os';
import * as nodePath from 'path';
import { describe, expect, it, beforeEach, afterEach, afterAll } from '@jest/globals';
import JSZip from 'jszip';

import { FileSystemNode } from '../src/filesystem-node';

/**
 * `unzipUrl`'s TRANSPORT half — the part `filesystem-unzip.test.ts` deliberately
 * does not reach, because that file grades `extractZipToFolder` and says why.
 *
 * 🔴 **Two defects, both found 2026-08-25 while scoping FB-005, both of the same
 * family: a branch that was written, was correct-looking, and could not run.**
 *
 * 1. `xhr.onerror` did not exist, so a transport failure settled the promise
 *    **never**. `unzipIntoDirectory` awaits this function and has four callers,
 *    including `modulelibrarymodel.installModule` — so installing a module from
 *    the library with the network down hung the editor rather than failing it.
 * 2. `const isEmpty = this.isDirectoryEmpty(to)` dropped the `await` on an
 *    `async` method, so the guard tested a **Promise** — always truthy — and the
 *    "Folder must be empty" refusal could not fire.
 *
 * ⚠️ **Why a fake `XMLHttpRequest` rather than a real server.** `unzipUrl` reaches
 * for `XMLHttpRequest`, which does not exist under a plain-Node runner at all; the
 * production code resolves it from the global at call time, so supplying one is
 * the only way this half is reachable from `test:platform`. The control below
 * exists precisely because a fake transport could grade nothing and still look
 * green — it drives `onload` with a **real archive** and asserts real files land
 * on disk, which proves the fake reaches the production path before any of the
 * failure specs are believed.
 */

/** The smallest thing that can play an XHR, and record what was asked of it. */
class FakeXHR {
  static last: FakeXHR | undefined;

  public onload: ((e: unknown) => void) | undefined;
  public onerror: ((e: unknown) => void) | undefined;
  public ontimeout: ((e: unknown) => void) | undefined;
  public onabort: ((e: unknown) => void) | undefined;

  public response: unknown;
  public responseType = '';
  public opened: { method: string; url: string } | undefined;
  public sent = false;

  constructor() {
    FakeXHR.last = this;
  }

  open(method: string, url: string, _async?: boolean) {
    this.opened = { method, url };
  }

  send() {
    this.sent = true;
    // Deliberately inert. Each spec fires the event it is about.
  }
}

/** Settle-or-hang, said as a value rather than as a jest timeout. */
async function settlesWithin<T>(promise: Promise<T>, ms: number): Promise<'resolved' | 'rejected' | 'hung'> {
  let outcome: 'resolved' | 'rejected' | 'hung' = 'hung';
  const watched = promise.then(
    () => {
      outcome = 'resolved';
    },
    () => {
      outcome = 'rejected';
    }
  );
  await Promise.race([watched, new Promise((r) => setTimeout(r, ms))]);
  return outcome;
}

/** `unzipUrl` awaits a directory read before it builds the XHR. */
async function waitForXhr(): Promise<FakeXHR> {
  for (let i = 0; i < 200; i++) {
    if (FakeXHR.last?.sent) return FakeXHR.last;
    await new Promise((r) => setTimeout(r, 5));
  }
  throw new Error('unzipUrl never constructed an XMLHttpRequest');
}

describe('unzipUrl: the transport half', function () {
  const filesystem = new FileSystemNode();
  const tempRoot = nodePath.join(os.tmpdir(), 'noodl-unzip-transport-' + process.pid);

  let target: string;
  let originalXHR: unknown;
  let counter = 0;

  beforeEach(function () {
    originalXHR = (global as unknown as Record<string, unknown>).XMLHttpRequest;
    (global as unknown as Record<string, unknown>).XMLHttpRequest = FakeXHR;
    FakeXHR.last = undefined;

    target = nodePath.join(tempRoot, 'target-' + counter++);
    fs.mkdirSync(target, { recursive: true });
  });

  afterEach(function () {
    (global as unknown as Record<string, unknown>).XMLHttpRequest = originalXHR;
  });

  afterAll(function () {
    filesystem.removeDirRecursive(tempRoot);
  });

  /*
   * ✅ **THE CONTROL, AND IT IS READ FIRST.** If this one does not resolve and
   * write real files, the fake transport is not reaching the production code and
   * every "it rejects" below would be measuring the harness rather than the fix.
   */
  it('control: a driven onload with a real archive resolves and writes the files', async function () {
    const zip = new JSZip();
    zip.file('project.json', '{"name":"real"}');
    zip.file('components/Home.json', '{}');
    const buffer = await zip.generateAsync({ type: 'nodebuffer' });

    const promise = filesystem.unzipUrl('http://example.test/real.zip', target);
    const xhr = await waitForXhr();

    expect(xhr.opened).toEqual({ method: 'GET', url: 'http://example.test/real.zip' });

    xhr.response = buffer;
    xhr.onload!.call(xhr, {});

    await expect(promise).resolves.toBeUndefined();
    expect(fs.readFileSync(nodePath.join(target, 'project.json'), 'utf8')).toBe('{"name":"real"}');
    expect(fs.existsSync(nodePath.join(target, 'components/Home.json'))).toBe(true);
  });

  /*
   * 🔴 The defect itself. Before the fix this spec did not fail with a wrong
   * value — it hung, which is why `settlesWithin` reports a word instead of
   * letting jest's timeout say it.
   */
  it('rejects rather than hanging when the transport errors', async function () {
    const promise = filesystem.unzipUrl('http://offline.test/x.zip', target);
    promise.catch(() => undefined); // the assertion below is the real one
    const xhr = await waitForXhr();

    expect(typeof xhr.onerror).toBe('function');
    xhr.onerror!.call(xhr, {});

    expect(await settlesWithin(promise, 250)).toBe('rejected');
    await expect(promise).rejects.toMatchObject({
      result: 'failure',
      message: expect.stringContaining('network may be unavailable')
    });
  });

  /*
   * ⚠️ NAT-013's trap, pinned: *"a refused connection and a timeout are different
   * measurements"*. They must not arrive at the reader as the same sentence.
   */
  it('says a timeout is a timeout, not a generic network failure', async function () {
    const promise = filesystem.unzipUrl('http://slow.test/x.zip', target);
    promise.catch(() => undefined);
    const xhr = await waitForXhr();

    expect(typeof xhr.ontimeout).toBe('function');
    xhr.ontimeout!.call(xhr, {});

    await expect(promise).rejects.toMatchObject({ message: expect.stringContaining('Timed out') });
  });

  it('rejects when the download is aborted', async function () {
    const promise = filesystem.unzipUrl('http://cancelled.test/x.zip', target);
    promise.catch(() => undefined);
    const xhr = await waitForXhr();

    expect(typeof xhr.onabort).toBe('function');
    xhr.onabort!.call(xhr, {});

    await expect(promise).rejects.toMatchObject({ message: expect.stringContaining('cancelled') });
  });

  /*
   * 🔴 The second defect. This guard existed, read correctly, and could not fire.
   * The spec is written so that reverting to the un-awaited form fails it: with a
   * Promise as `isEmpty` the function proceeds to build an XHR, so asserting that
   * NO request was made is the discriminator, not just the rejection.
   */
  it('refuses a non-empty target, and does not reach the network to find out', async function () {
    fs.writeFileSync(nodePath.join(target, 'already-here.txt'), 'do not overwrite me');

    const promise = filesystem.unzipUrl('http://example.test/x.zip', target);

    await expect(promise).rejects.toMatchObject({
      result: 'failure',
      message: 'Folder must be empty'
    });
    expect(FakeXHR.last).toBeUndefined();
    expect(fs.readFileSync(nodePath.join(target, 'already-here.txt'), 'utf8')).toBe('do not overwrite me');
  });
});
