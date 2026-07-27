/**
 * AIX-008 — Sandbox preview: network interception
 *
 * The whole isolation guarantee is this file. It is installed in the sandbox
 * webview *before* the runtime is constructed, so no node ever gets a chance to
 * reach a real backend — not the Parse-shaped data nodes (XHR), not the user
 * session (XHR), not BYOB or REST (fetch). One seam, rather than a sandbox
 * branch in a dozen node implementations.
 *
 * The dataset is read lazily on every request, because it arrives later: the
 * export lands after the runtime connects, and a refined candidate replaces it
 * again. `installSandbox` returns an uninstall function so the preview's
 * "Real backend" toggle can put the originals back without a reload.
 *
 * @module noodl-runtime/sandbox/install
 */

import { ensureUser, respond, type SandboxResponse } from './responder';
import { SandboxStore } from './store';
import type { SandboxDataset } from './types';

export type DatasetSource = () => SandboxDataset | undefined;

function parseBody(body: unknown): unknown {
  if (typeof body !== 'string') return body;
  try {
    return JSON.parse(body);
  } catch {
    return body;
  }
}

/** Keeps one store per dataset identity, so a re-export rebuilds and a re-render does not. */
function createStoreCache(source: DatasetSource) {
  let lastDataset: SandboxDataset | undefined;
  let store: SandboxStore | undefined;

  return function getStore(): SandboxStore {
    const dataset = source();
    if (!store || dataset !== lastDataset) {
      lastDataset = dataset;
      store = new SandboxStore(
        dataset ? { ...dataset, user: ensureUser(dataset.user) } : { classes: {}, user: ensureUser(undefined) }
      );
    }
    return store;
  };
}

function installFetch(getStore: () => SandboxStore): () => void {
  const original = window.fetch;

  window.fetch = function sandboxFetch(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    const answer = respond({ method, url, body: parseBody(init?.body) }, getStore());

    if (!answer) return original.call(window, input as RequestInfo, init);

    return Promise.resolve(
      new Response(JSON.stringify(answer.body ?? {}), {
        status: answer.status,
        headers: { 'Content-Type': 'application/json' }
      })
    );
  };

  return () => {
    window.fetch = original;
  };
}

/**
 * XHR is patched rather than replaced: the instance keeps every real behaviour
 * (headers, upload progress, event plumbing) and only the response is
 * simulated, by shadowing the prototype's accessors on the instance.
 */
function installXhr(getStore: () => SandboxStore): () => void {
  const proto = XMLHttpRequest.prototype;
  const originalOpen = proto.open;
  const originalSend = proto.send;

  type Pending = { method: string; url: string };
  const pending = new WeakMap<XMLHttpRequest, Pending>();

  function complete(xhr: XMLHttpRequest, answer: SandboxResponse, url: string) {
    const text = JSON.stringify(answer.body ?? {});
    const define = (key: string, value: unknown) =>
      Object.defineProperty(xhr, key, { value, configurable: true, writable: false });

    // Asynchronous, like a real request: nodes that set state after send()
    // must still see their handler run afterwards.
    setTimeout(() => {
      define('readyState', 4);
      define('status', answer.status);
      define('statusText', 'OK');
      define('response', text);
      define('responseText', text);
      define('responseURL', url);
      xhr.dispatchEvent(new Event('readystatechange'));
      xhr.dispatchEvent(new Event('load'));
      xhr.dispatchEvent(new Event('loadend'));
    }, 0);
  }

  proto.open = function sandboxOpen(this: XMLHttpRequest, method: string, url: string, ...rest: unknown[]) {
    pending.set(this, { method, url });
    // eslint-disable-next-line prefer-rest-params
    return originalOpen.apply(this, arguments as never);
  } as typeof proto.open;

  proto.send = function sandboxSend(this: XMLHttpRequest, body?: Document | XMLHttpRequestBodyInit | null) {
    const info = pending.get(this);
    const answer = info ? respond({ method: info.method, url: info.url, body: parseBody(body) }, getStore()) : null;

    if (!answer) return originalSend.call(this, body ?? null);

    complete(this, answer, info!.url);
  } as typeof proto.send;

  return () => {
    proto.open = originalOpen;
    proto.send = originalSend;
  };
}

/**
 * Intercept every backend-shaped request in this document. Returns the
 * uninstall function.
 */
export function installSandbox(source: DatasetSource): () => void {
  const getStore = createStoreCache(source);
  const uninstallFetch = installFetch(getStore);
  const uninstallXhr = installXhr(getStore);

  return () => {
    uninstallFetch();
    uninstallXhr();
  };
}
