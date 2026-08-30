/**
 * DEF-021 (phase 80, from phase 78's D33) — a fan-out send must not deliver ONE email and
 * report N successes.
 *
 * The defect, measured 2026-08-29 (s14) with a one-variable control pair: pulse `Do` three
 * times with a different `To` each time inside one update pass, and the coalescing guard
 * collapsed the sends to one — `_noodl_send_email` called once, with whichever address was
 * written last — while `reportOutcomes` settled every queued token `done`. Two of three
 * recipients silently got nothing, and the graph was told three times that the mail server
 * accepted the message.
 *
 * The fix keys the batch on `To`: each queued outcome token is stamped with the address it
 * was minted under, and a batch whose stamps DISAGREE is a fan-out — one send per
 * consecutive run of the minted address, each run settled by its own call's outcome.
 *
 * ⚠️ What must NOT move, and is pinned next door rather than re-asserted here
 * (erg-001-cloud-node-outcomes.test.ts §4 — a check in a second pipeline is a duplicate
 * first): a batch whose stamps AGREE keeps today's behaviour exactly — one send, fields
 * read after inputs have settled, every token settled by it. That is the "set the fields,
 * then press Do" contract, and it is also why the stamp cannot simply become the address
 * the send uses: a pulse can arrive BEFORE its `To` in the same pass (§B below), and the
 * single-stamp batch must read the settled value, not the stale stamp.
 */

import { node as SendEmailNode } from '../src/nodes/cloud/sendemail';

/* eslint-disable @typescript-eslint/no-explicit-any */
type AnyRecord = Record<string, any>;

/* eslint-disable @typescript-eslint/no-var-requires */
const RuntimeNode = require('@noodl/runtime/src/node');
/* eslint-enable @typescript-eslint/no-var-requires */

const SendEmail = SendEmailNode as unknown as AnyRecord;

interface Probe {
  instance: AnyRecord;
  internal: AnyRecord;
  signals: string[];
  raised: Array<{ code: string; message: string }>;
  flush(): void;
}

// Same probe shape as erg-001 §4's: the real `beginOutcome`/`reportOutcome` off
// `Node.prototype`, because "exactly one outcome per invocation" lives there and a stub
// would grade the harness.
function makeProbe(overrides: AnyRecord = {}): Probe {
  const signals: string[] = [];
  const raised: Array<{ code: string; message: string }> = [];
  const deferred: Array<() => void> = [];
  const ports = Object.keys(SendEmail.outputs || {});

  const instance: AnyRecord = {
    _internal: {},
    hasOutput: (name: string) => ports.indexOf(name) !== -1,
    sendSignalOnOutput: (name: string) => signals.push(name),
    flagOutputDirty: () => undefined,
    raiseRuntimeError: (code: string, message: string) => raised.push({ code, message }),
    scheduleAfterInputsHaveUpdated: (fn: () => void) => deferred.push(fn)
  };
  instance.beginOutcome = RuntimeNode.prototype.beginOutcome.bind(instance);
  instance.reportOutcome = RuntimeNode.prototype.reportOutcome.bind(instance);

  const methods = SendEmail.methods as Record<string, (...args: unknown[]) => unknown>;
  for (const name of Object.keys(methods || {})) {
    instance[name] = methods[name].bind(instance);
  }
  if (SendEmail.initialize) SendEmail.initialize.call(instance);
  Object.assign(instance._internal, overrides);

  return {
    instance,
    internal: instance._internal,
    signals,
    raised,
    flush() {
      while (deferred.length > 0) deferred.shift()();
    }
  };
}

function setTo(probe: Probe, value: string): void {
  SendEmail.inputs.to.set.call(probe.instance, value);
}

function pulse(probe: Probe): void {
  SendEmail.inputs.send.valueChangedToTrue.call(probe.instance);
}

function outcomes(probe: Probe): string[] {
  return probe.signals.filter((s) => s === 'done' || s === 'failure');
}

/** Let the sequential send chain drain: each group is one promise hop plus the mailer's. */
async function settle(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

describe('DEF-021: a batch whose To changed between pulses is a fan-out, not a re-press', () => {
  afterEach(() => {
    delete (globalThis as unknown as AnyRecord)._noodl_send_email;
  });

  function installMailer(result: (request: AnyRecord) => unknown | Promise<unknown>) {
    const calls: AnyRecord[] = [];
    (globalThis as unknown as AnyRecord)._noodl_send_email = (request: AnyRecord) => {
      calls.push(request);
      return result(request);
    };
    return calls;
  }

  // ── The defect arm: D33's own measurement, one pass, three addresses ──────────────────

  test('three addresses in one pass are three sends, in pulse order, three Dones', async () => {
    const calls = installMailer(() => Promise.resolve({ success: true }));
    const probe = makeProbe();

    setTo(probe, 'a@x.invalid');
    pulse(probe);
    setTo(probe, 'b@x.invalid');
    pulse(probe);
    setTo(probe, 'c@x.invalid');
    pulse(probe);
    probe.flush();
    await settle();

    // At HEAD before the fix this read: calls = [c@x.invalid], outcomes = done ×3.
    expect(calls.map((c) => c.to)).toEqual(['a@x.invalid', 'b@x.invalid', 'c@x.invalid']);
    expect(outcomes(probe)).toEqual(['done', 'done', 'done']);
    expect(probe.signals.filter((s) => s === 'completed')).toHaveLength(3);
  });

  // ── The control from D33: one pass each was always correct and must stay so ───────────

  test('(control) three addresses in three passes stay three sends', async () => {
    const calls = installMailer(() => Promise.resolve({ success: true }));
    const probe = makeProbe();

    for (const to of ['a@x.invalid', 'b@x.invalid', 'c@x.invalid']) {
      setTo(probe, to);
      pulse(probe);
      probe.flush();
      await settle();
    }

    expect(calls.map((c) => c.to)).toEqual(['a@x.invalid', 'b@x.invalid', 'c@x.invalid']);
    expect(outcomes(probe)).toEqual(['done', 'done', 'done']);
  });

  // ── §B: the stamp must not defeat "press Do, then the fields arrive in the same pass" ──

  test('a single pulse whose To arrives after it still sends to the settled address', async () => {
    const calls = installMailer(() => Promise.resolve({ success: true }));
    // A previous run left a stale address behind — the stamp reads it at mint time.
    const probe = makeProbe({ to: 'stale@x.invalid' });

    pulse(probe);
    setTo(probe, 'fresh@x.invalid');
    probe.flush();
    await settle();

    expect(calls.map((c) => c.to)).toEqual(['fresh@x.invalid']);
    expect(outcomes(probe)).toEqual(['done']);
  });

  test('two pulses under ONE address still coalesce and read fields settled after them', async () => {
    const calls = installMailer(() => Promise.resolve({ success: true }));
    const probe = makeProbe({ to: 'a@x.invalid' });

    pulse(probe);
    pulse(probe);
    SendEmail.inputs.subject.set.call(probe.instance, 'settled subject');
    probe.flush();
    await settle();

    expect(calls).toHaveLength(1);
    expect(calls[0].subject).toBe('settled subject');
    expect(outcomes(probe)).toEqual(['done', 'done']);
  });

  // ── Consecutive runs of one address inside a fan-out batch stay one send ──────────────

  test('a re-press within a fan-out coalesces with its own address only', async () => {
    const calls = installMailer(() => Promise.resolve({ success: true }));
    const probe = makeProbe();

    setTo(probe, 'a@x.invalid');
    pulse(probe);
    pulse(probe);
    setTo(probe, 'b@x.invalid');
    pulse(probe);
    probe.flush();
    await settle();

    expect(calls.map((c) => c.to)).toEqual(['a@x.invalid', 'b@x.invalid']);
    // Three invocations, three outcomes — two settled by a's call, one by b's.
    expect(outcomes(probe)).toEqual(['done', 'done', 'done']);
  });

  // ── Each run is settled by ITS call, not by the batch's last answer ────────────────────

  test('a mailer that refuses one address fails that invocation alone, by name', async () => {
    const calls = installMailer((request) =>
      request.to === 'b@x.invalid'
        ? Promise.resolve({ success: false, error: 'mailbox unavailable' })
        : Promise.resolve({ success: true })
    );
    const probe = makeProbe();

    setTo(probe, 'a@x.invalid');
    pulse(probe);
    setTo(probe, 'b@x.invalid');
    pulse(probe);
    setTo(probe, 'c@x.invalid');
    pulse(probe);
    probe.flush();
    await settle();

    expect(calls.map((c) => c.to)).toEqual(['a@x.invalid', 'b@x.invalid', 'c@x.invalid']);
    expect(outcomes(probe)).toEqual(['done', 'failure', 'done']);
    expect(probe.raised.map((r) => r.code)).toEqual(['send-email/failed']);
    expect(probe.raised[0].message).toBe('mailbox unavailable');
  });

  test('a blank address inside a fan-out fails its own invocation and the rest deliver', async () => {
    const calls = installMailer(() => Promise.resolve({ success: true }));
    const probe = makeProbe();

    setTo(probe, 'a@x.invalid');
    pulse(probe);
    setTo(probe, '');
    pulse(probe);
    setTo(probe, 'c@x.invalid');
    pulse(probe);
    probe.flush();
    await settle();

    expect(calls.map((c) => c.to)).toEqual(['a@x.invalid', 'c@x.invalid']);
    expect(outcomes(probe)).toEqual(['done', 'failure', 'done']);
    expect(probe.raised[0].message).toContain('"To" is required');
  });
});
