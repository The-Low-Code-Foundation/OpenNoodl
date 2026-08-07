/**
 * ERG-001 §4 — the two `Cloud` category nodes: `Response` and `Send Email`.
 *
 * | Node | Action port | Shape |
 * |---|---|---|
 * | `noodl.cloud.response` | `Send` | `done` (was `sent`) · `failure` kept · `completed` |
 * | `noodl.cloud.sendemail` | `Do` | `done` (was `sent`) · `failure` (was `failed`) · `completed` |
 *
 * Both renames pass the grep the phase now runs before every one: the signal has a single
 * caller and that caller is reached from the action port alone. Neither node has a value-driven
 * route into its work, so there is no value-level announcement to keep beside the outcome.
 *
 * ## ⚠️ `Response` is the contract's navigation exception in a second family
 *
 * `Done` fires **before** `_sendResponseCallback`, which is the opposite of "the outcome is the
 * last thing an action does" — and it is forced rather than chosen. Delivering the response
 * tears the request down synchronously (`NoodlCloudRuntime.run` calls
 * `functionComponent._onNodeDeleted()` and `requestScope.reset()` *inside* the callback), so by
 * the time it returns this node and everything wired to its outputs have been deleted. An
 * outcome sent afterwards would reach a graph that no longer exists, which is a completion
 * signal in name only — exactly what `OUTCOME-CONTRACT.md` says about navigation. A row below
 * pins the ordering so it cannot be "tidied" later.
 *
 * ⚠️ The belt-and-braces branch after the callback — a host that installs
 * `_sendResponseCallback` without `_requestIsOpen`, and answers first — now raises and writes
 * `Error` **without a second outcome report**. "Exactly one" is the load-bearing half of Rule 1
 * and the token is already spent; reporting again would raise `outcome/duplicate` for a
 * pathological path rather than diagnosing it. A row asserts the raise arrives and the duplicate
 * does not.
 *
 * ## No `Unchanged` on either
 *
 * A `Response` either answers the request or fails to; a `Send Email` either hands the message
 * to the mailer or fails to. Neither has a branch where the post-condition already held. §5 must
 * not expect one.
 *
 * ## What reverting reddens — predicted per fixture, before running
 *
 * | Revert | Predicted |
 * |---|---|
 * | `Response` reports `done` *after* the callback | 1 — the ordering row |
 * | the post-callback branch settling the token again | 1 — the duplicate row |
 * | `Send Email`'s token minted inside the coalescing guard | 1 — the two-pulses row |
 * | `Send Email`'s `setError` settling one shared token rather than the drained batch | 1 — the two-pulses row |
 */

/* eslint-env jest */

import { node as ResponseNode } from '../src/nodes/cloud/response';
import { node as SendEmailNode } from '../src/nodes/cloud/sendemail';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

// `Node.prototype` carries the real `beginOutcome` / `reportOutcome`. A hand-built probe does
// not inherit it, and stubbing the pair would test the harness rather than the contract —
// "exactly one per invocation" is the load-bearing half and it lives in `reportOutcome`.
/* eslint-disable @typescript-eslint/no-var-requires */
const RuntimeNode = require('@noodl/runtime/src/node');
/* eslint-enable @typescript-eslint/no-var-requires */

interface RaisedError {
  code: string;
  message: string;
  detail?: unknown;
}

interface Probe {
  instance: AnyRecord;
  internal: AnyRecord;
  signals: string[];
  dirtied: string[];
  raised: RaisedError[];
  /** Deferred `scheduleAfterInputsHaveUpdated` callbacks, run by {@link Probe.flush}. */
  flush(): void;
}

/**
 * The definition's own declared signal outputs.
 *
 * ⚠️ Backing `hasOutput` with this rather than a constant matters. A blanket `false` turns every
 * outcome into a spurious `outcome/missing-port`; a blanket `true` hides a genuinely missing
 * port. Five harnesses in this phase have needed exactly this.
 */
function declaredOutputs(definition: AnyRecord): string[] {
  return Object.keys(definition.outputs || {});
}

function makeProbe(definition: AnyRecord, overrides: AnyRecord = {}): Probe {
  const signals: string[] = [];
  const dirtied: string[] = [];
  const raised: RaisedError[] = [];
  const deferred: Array<() => void> = [];
  const ports = declaredOutputs(definition);

  const instance: AnyRecord = {
    _internal: {},
    hasOutput: (name: string) => ports.indexOf(name) !== -1,
    sendSignalOnOutput: (name: string) => signals.push(name),
    flagOutputDirty: (name: string) => dirtied.push(name),
    raiseRuntimeError: (code: string, message: string, detail?: unknown) => raised.push({ code, message, detail }),
    scheduleAfterInputsHaveUpdated: (fn: () => void) => deferred.push(fn)
  };
  instance.beginOutcome = RuntimeNode.prototype.beginOutcome.bind(instance);
  instance.reportOutcome = RuntimeNode.prototype.reportOutcome.bind(instance);

  const methods = definition.methods as Record<string, (...args: unknown[]) => unknown>;
  for (const name of Object.keys(methods || {})) {
    instance[name] = methods[name].bind(instance);
  }

  if (definition.initialize) definition.initialize.call(instance);
  Object.assign(instance._internal, overrides);

  return {
    instance,
    internal: instance._internal,
    signals,
    dirtied,
    raised,
    flush() {
      while (deferred.length > 0) deferred.shift()();
    }
  };
}

/** Fire an action port the way the runtime's edge-triggered setter does. */
function trigger(definition: AnyRecord, probe: Probe, port: string): void {
  definition.inputs[port].valueChangedToTrue.call(probe.instance);
}

function outcomes(probe: Probe): string[] {
  return probe.signals.filter((s) => s === 'done' || s === 'unchanged' || s === 'failure');
}

function signalPortsOf(definition: AnyRecord): string[] {
  const outputs = definition.outputs as Record<string, { type?: unknown }>;
  return Object.keys(outputs).filter((name) => {
    const type = outputs[name].type;
    return type === 'signal' || (type && (type as { name?: string }).name === 'signal');
  });
}

// =================================================================================================
// Response
// =================================================================================================

/** The seam as `NoodlCloudRuntime.run` installs it: one answer per request, and a way to ask. */
function makeRequestSeam() {
  let hasResponded = false;
  const delivered: unknown[] = [];
  const signalsWhenDelivered: string[][] = [];

  const seam = {
    delivered,
    signalsWhenDelivered,
    /** Set by the row that needs to see what had been sent at the moment of delivery. */
    watch: undefined as string[] | undefined,
    _requestIsOpen: () => !hasResponded,
    _sendResponseCallback: (payload: unknown) => {
      if (hasResponded) return false;
      hasResponded = true;
      delivered.push(payload);
      if (seam.watch) signalsWhenDelivered.push(seam.watch.slice());
      return true;
    }
  };
  return seam;
}

describe('ERG-001 §4: Response', () => {
  test('a delivered response reports Done then Completed, and Sent is gone', () => {
    const seam = makeRequestSeam();
    const probe = makeProbe(ResponseNode as unknown as AnyRecord, seam);
    probe.internal.responseParameters = { greeting: 'hi' };

    trigger(ResponseNode as unknown as AnyRecord, probe, 'send');

    expect(outcomes(probe)).toEqual(['done']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(1);
    expect(probe.signals).not.toContain('sent');
    expect(seam.delivered).toHaveLength(1);
    expect(probe.raised).toEqual([]);
  });

  /**
   * ⚠️ The contract's one real exception, in a second family. `Done` and `Completed` are both
   * already on the wire when the callback runs, because the callback deletes this node.
   */
  test('Done and Completed are both sent before the response is handed over', () => {
    const seam = makeRequestSeam();
    const probe = makeProbe(ResponseNode as unknown as AnyRecord, seam);
    seam.watch = probe.signals;

    trigger(ResponseNode as unknown as AnyRecord, probe, 'send');

    expect(seam.signalsWhenDelivered[0]).toEqual(['done', 'completed']);
  });

  test('a Response node with no request to answer is a Failure with its code', () => {
    const probe = makeProbe(ResponseNode as unknown as AnyRecord);

    trigger(ResponseNode as unknown as AnyRecord, probe, 'send');

    expect(outcomes(probe)).toEqual(['failure']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(1);
    expect(probe.raised.map((r) => r.code)).toEqual(['response/no-request-in-scope']);
  });

  test('a second Send on an answered request is a Failure with its code', () => {
    const seam = makeRequestSeam();
    const probe = makeProbe(ResponseNode as unknown as AnyRecord, seam);

    trigger(ResponseNode as unknown as AnyRecord, probe, 'send');
    trigger(ResponseNode as unknown as AnyRecord, probe, 'send');

    expect(outcomes(probe)).toEqual(['done', 'failure']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(2);
    expect(probe.raised.map((r) => r.code)).toEqual(['response/already-sent']);
  });

  /**
   * ⚠️ The pathological host: a callback with no `_requestIsOpen` that answers first. The token
   * has been spent by the pre-delivery `Done`, so the branch diagnoses without reporting again —
   * and the absence of `outcome/duplicate` is what this row is really about.
   */
  test('a callback that refuses after Done raises without a second outcome', () => {
    const probe = makeProbe(ResponseNode as unknown as AnyRecord, {
      _sendResponseCallback: () => false
    });

    trigger(ResponseNode as unknown as AnyRecord, probe, 'send');

    expect(outcomes(probe)).toEqual(['done']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(1);
    expect(probe.raised.map((r) => r.code)).toEqual(['response/already-sent']);
    expect(probe.dirtied).toContain('error');
  });

  test('(pinned control) the port surface is exactly the three outcome signals', () => {
    expect(signalPortsOf(ResponseNode as unknown as AnyRecord).sort()).toEqual(['completed', 'done', 'failure']);
  });
});

// =================================================================================================
// Send Email
// =================================================================================================

describe('ERG-001 §4: Send Email', () => {
  const SendEmail = SendEmailNode as unknown as AnyRecord;

  afterEach(() => {
    delete (globalThis as unknown as AnyRecord)._noodl_send_email;
  });

  function installMailer(result: unknown | Promise<unknown>) {
    const calls: unknown[] = [];
    (globalThis as unknown as AnyRecord)._noodl_send_email = (request: unknown) => {
      calls.push(request);
      return result;
    };
    return calls;
  }

  test('an accepted message reports Done then Completed, and Sent is gone', async () => {
    installMailer(Promise.resolve({ success: true }));
    const probe = makeProbe(SendEmail, { to: 'a@b.c' });

    trigger(SendEmail, probe, 'send');
    probe.flush();
    await Promise.resolve();
    await Promise.resolve();

    expect(outcomes(probe)).toEqual(['done']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(1);
    expect(probe.signals).not.toContain('sent');
  });

  test('a blank To is a Failure, and Failed is gone', async () => {
    installMailer(Promise.resolve({ success: true }));
    const probe = makeProbe(SendEmail, {});

    trigger(SendEmail, probe, 'send');
    probe.flush();
    await Promise.resolve();

    expect(outcomes(probe)).toEqual(['failure']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(1);
    expect(probe.signals).not.toContain('failed');
    expect(probe.raised.map((r) => r.code)).toEqual(['send-email/failed']);
  });

  test('no mail service at all is a Failure carrying the reason', async () => {
    const probe = makeProbe(SendEmail, { to: 'a@b.c' });

    trigger(SendEmail, probe, 'send');
    probe.flush();
    await Promise.resolve();

    expect(outcomes(probe)).toEqual(['failure']);
    expect(probe.raised[0].message).toContain('no email service is available');
  });

  test('a mailer that refuses is a Failure carrying its own words', async () => {
    installMailer(Promise.resolve({ success: false, error: 'SMTP is not configured' }));
    const probe = makeProbe(SendEmail, { to: 'a@b.c' });

    trigger(SendEmail, probe, 'send');
    probe.flush();
    await Promise.resolve();
    await Promise.resolve();

    expect(outcomes(probe)).toEqual(['failure']);
    expect(probe.raised[0].message).toBe('SMTP is not configured');
  });

  /**
   * The coalescing guard drops the second pulse's *send* on purpose — that is how "set the
   * fields, then press Do" batches — and it must not drop the second pulse's outcome.
   */
  test('two Dos coalesced into one pass still report two outcomes', async () => {
    const calls = installMailer(Promise.resolve({ success: true }));
    const probe = makeProbe(SendEmail, { to: 'a@b.c' });

    trigger(SendEmail, probe, 'send');
    trigger(SendEmail, probe, 'send');
    probe.flush();
    await Promise.resolve();
    await Promise.resolve();

    expect(calls).toHaveLength(1);
    expect(outcomes(probe)).toEqual(['done', 'done']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(2);
  });

  test('(pinned control) the port surface is exactly the three outcome signals', () => {
    expect(signalPortsOf(SendEmail).sort()).toEqual(['completed', 'done', 'failure']);
  });
});
