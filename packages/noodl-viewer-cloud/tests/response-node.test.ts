/**
 * NDA-004 §3 — the Response node stops being mute.
 *
 * `Response` was the last of the Failure Contract's "mute ten" that was not blocked by another
 * workstream: it took a `Send` signal and had no outputs at all, so from the graph a delivered
 * response, a response discarded because the request was already answered, and a `TypeError`
 * thrown out of an input setter were all the same event — nothing.
 *
 * These rows pin the three outcomes apart. They drive the node definition directly rather than
 * standing a cloud runtime up, because what is under test is the node's own decision-making;
 * `_sendResponseCallback` / `_requestIsOpen` are the seam `NoodlCloudRuntime.run` installs, and
 * the fakes here have exactly that shape.
 */

import { node as ResponseNode } from '../src/nodes/cloud/response';

interface RaisedError {
  code: string;
  message: string;
  detail?: unknown;
}

/**
 * The smallest thing the node's methods can run against.
 *
 * Methods are bound onto a plain object rather than instantiated through the runtime, which is
 * enough here because `Response` has no visual half and no collaborators beyond the two
 * callbacks. `initialize` is called so `responseParameters` exists, as it would in the runtime.
 */
function makeResponse(overrides: Record<string, unknown> = {}) {
  const signals: string[] = [];
  const dirtied: string[] = [];
  const raised: RaisedError[] = [];

  const instance: Record<string, unknown> = {
    _internal: {} as Record<string, unknown>,
    sendSignalOnOutput: (name: string) => signals.push(name),
    flagOutputDirty: (name: string) => dirtied.push(name),
    raiseRuntimeError: (code: string, message: string, detail?: unknown) => raised.push({ code, message, detail })
  };

  const methods = (ResponseNode as unknown as { methods: Record<string, (...args: unknown[]) => unknown> }).methods;
  for (const name of Object.keys(methods)) {
    instance[name] = methods[name].bind(instance);
  }

  (ResponseNode as unknown as { initialize: () => void }).initialize.call(instance);
  Object.assign(instance._internal as Record<string, unknown>, overrides);

  return { instance, signals, dirtied, raised, internal: instance._internal as Record<string, unknown> };
}

/** The seam as `NoodlCloudRuntime.run` installs it: one answer per request, and a way to ask. */
function makeRequestSeam() {
  let hasResponded = false;
  const delivered: unknown[] = [];

  return {
    delivered,
    get hasResponded() {
      return hasResponded;
    },
    _requestIsOpen: () => !hasResponded,
    _sendResponseCallback: (payload: unknown) => {
      if (hasResponded) return false;
      hasResponded = true;
      delivered.push(payload);
      return true;
    }
  };
}

describe('Response node — completion', () => {
  it('sends a success payload and reports that it went out', () => {
    const seam = makeRequestSeam();
    const { instance, signals, raised, internal } = makeResponse(seam);
    (internal as { responseParameters: Record<string, unknown> }).responseParameters = { greeting: 'hi' };

    (instance as { sendResponse: () => void }).sendResponse();

    expect(seam.delivered).toEqual([{ statusCode: 200, body: JSON.stringify({ result: { greeting: 'hi' } }) }]);
    expect(signals).toEqual(['sent']);
    expect(raised).toEqual([]);
  });

  it('sends a failure payload with the error message when Status is failure', () => {
    const seam = makeRequestSeam();
    const { instance, signals } = makeResponse({ ...seam, status: 'failure', errorMessage: 'nope' });

    (instance as { sendResponse: () => void }).sendResponse();

    expect(seam.delivered).toEqual([{ statusCode: 400, body: JSON.stringify({ error: 'nope' }) }]);
    expect(signals).toEqual(['sent']);
  });

  /**
   * The ordering is forced, not stylistic: the real callback tears the request scope down
   * synchronously before it returns, so a `Sent` signal emitted afterwards would fire into a
   * deleted graph. This row fails if anyone "tidies" the signal to after the delivery.
   */
  it('fires Sent before delivering, because delivering destroys the graph', () => {
    const order: string[] = [];
    const { instance } = makeResponse({
      _requestIsOpen: () => true,
      _sendResponseCallback: () => {
        order.push('delivered');
        return true;
      }
    });
    (instance as { sendSignalOnOutput: (n: string) => void }).sendSignalOnOutput = (name: string) => {
      order.push('signal:' + name);
    };

    (instance as { sendResponse: () => void }).sendResponse();

    expect(order).toEqual(['signal:sent', 'delivered']);
  });
});

describe('Response node — failure', () => {
  it('reports a second send instead of discarding it', () => {
    const seam = makeRequestSeam();
    const first = makeResponse(seam);
    const second = makeResponse(seam);

    (first.instance as { sendResponse: () => void }).sendResponse();
    (second.instance as { sendResponse: () => void }).sendResponse();

    // Only one payload ever reaches the client — that part was always true.
    expect(seam.delivered).toHaveLength(1);

    // What is new: the node that lost says so, on both channels.
    expect(second.signals).toEqual(['failure']);
    expect(second.dirtied).toContain('error');
    expect(second.raised).toHaveLength(1);
    expect(second.raised[0].code).toBe('response/already-sent');
    expect(second.internal.lastError).toBe(second.raised[0].message);
  });

  /**
   * `_sendResponseCallback` is installed over the Response nodes that exist when the function
   * component is built. One created later — inside a Repeater template, say — never gets one,
   * and the old code invoked `undefined` straight away: a `TypeError` raised from inside an
   * input setter, which is the least legible way a node can fail.
   */
  it('reports a Response node that has no request to answer, rather than throwing', () => {
    const { instance, signals, raised, internal } = makeResponse();

    expect(() => (instance as { sendResponse: () => void }).sendResponse()).not.toThrow();

    expect(signals).toEqual(['failure']);
    expect(raised).toHaveLength(1);
    expect(raised[0].code).toBe('response/no-request-in-scope');
    expect(internal.lastError).toBe(raised[0].message);
  });

  /** A host that installs the callback but not the query still gets the coarser answer. */
  it('falls back to the callback return value when the host installs no _requestIsOpen', () => {
    const { instance, signals, raised } = makeResponse({
      _sendResponseCallback: () => false
    });

    (instance as { sendResponse: () => void }).sendResponse();

    // `Sent` still fired first — the node had no way to know before calling — and the failure
    // follows it. Both are reported, which is the honest account of what happened.
    expect(signals).toEqual(['sent', 'failure']);
    expect(raised[0].code).toBe('response/already-sent');
  });
});
