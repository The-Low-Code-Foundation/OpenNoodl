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

/* eslint-disable @typescript-eslint/no-var-requires */
const RuntimeNode = require('@noodl/runtime/src/node');
/* eslint-enable @typescript-eslint/no-var-requires */

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

  // ⚠️ ERG-001 §4. A bag of bound methods does not inherit `Node.prototype`, and stubbing the
  // outcome pair would test the harness rather than the contract — "exactly one per invocation"
  // is the load-bearing half and it lives in `reportOutcome`. `hasOutput` is backed by the
  // definition's own declared outputs: a blanket `false` turns every outcome into a spurious
  // `outcome/missing-port`, and a blanket `true` hides a genuinely missing port.
  const declared = Object.keys((ResponseNode as unknown as { outputs: Record<string, unknown> }).outputs);

  const instance: Record<string, unknown> = {
    _internal: {} as Record<string, unknown>,
    hasOutput: (name: string) => declared.indexOf(name) !== -1,
    sendSignalOnOutput: (name: string) => signals.push(name),
    flagOutputDirty: (name: string) => dirtied.push(name),
    raiseRuntimeError: (code: string, message: string, detail?: unknown) => raised.push({ code, message, detail })
  };
  instance.beginOutcome = RuntimeNode.prototype.beginOutcome.bind(instance);
  instance.reportOutcome = RuntimeNode.prototype.reportOutcome.bind(instance);

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

/** `Send`'s own handler mints the token; these rows drive `sendResponse` directly. */
function send(instance: Record<string, unknown>): void {
  (instance as { sendResponse: (t: unknown) => void }).sendResponse(
    (instance as { beginOutcome: () => unknown }).beginOutcome()
  );
}

describe('Response node — completion', () => {
  it('sends a success payload and reports that it went out', () => {
    const seam = makeRequestSeam();
    const { instance, signals, raised, internal } = makeResponse(seam);
    (internal as { responseParameters: Record<string, unknown> }).responseParameters = { greeting: 'hi' };

    send(instance);

    expect(seam.delivered).toEqual([{ statusCode: 200, body: JSON.stringify({ result: { greeting: 'hi' } }) }]);
    expect(signals).toEqual(['done', 'completed']);
    expect(raised).toEqual([]);
  });

  it('sends a failure payload with the error message when Status is failure', () => {
    const seam = makeRequestSeam();
    const { instance, signals } = makeResponse({ ...seam, status: 'failure', errorMessage: 'nope' });

    send(instance);

    expect(seam.delivered).toEqual([{ statusCode: 400, body: JSON.stringify({ error: 'nope' }) }]);
    expect(signals).toEqual(['done', 'completed']);
  });

  /**
   * The ordering is forced, not stylistic: the real callback tears the request scope down
   * synchronously before it returns, so a `Sent` signal emitted afterwards would fire into a
   * deleted graph. This row fails if anyone "tidies" the signal to after the delivery.
   */
  it('fires Done before delivering, because delivering destroys the graph', () => {
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

    send(instance);

    expect(order).toEqual(['signal:done', 'signal:completed', 'delivered']);
  });
});

describe('Response node — failure', () => {
  it('reports a second send instead of discarding it', () => {
    const seam = makeRequestSeam();
    const first = makeResponse(seam);
    const second = makeResponse(seam);

    send(first.instance);
    send(second.instance);

    // Only one payload ever reaches the client — that part was always true.
    expect(seam.delivered).toHaveLength(1);

    // What is new: the node that lost says so, on both channels.
    expect(second.signals).toEqual(['failure', 'completed']);
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

    expect(() => send(instance)).not.toThrow();

    expect(signals).toEqual(['failure', 'completed']);
    expect(raised).toHaveLength(1);
    expect(raised[0].code).toBe('response/no-request-in-scope');
    expect(internal.lastError).toBe(raised[0].message);
  });

  /** A host that installs the callback but not the query still gets the coarser answer. */
  it('falls back to the callback return value when the host installs no _requestIsOpen', () => {
    const { instance, signals, raised } = makeResponse({
      _sendResponseCallback: () => false
    });

    send(instance);

    // ⚠️ ERG-001 §4 changed what "both are reported" means here. `Done` still fires first — the
    // node had no way to know before calling — and it spends the invocation's token, so the
    // refusal that follows reaches the NDA-004 channel and the `Error` output but does **not**
    // pulse a second outcome. "Exactly one" is the load-bearing half of Rule 1, and a second
    // report would raise `outcome/duplicate` rather than diagnose the host bug.
    expect(signals).toEqual(['done', 'completed']);
    expect(raised[0].code).toBe('response/already-sent');
  });
});
