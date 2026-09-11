/**
 * SB-018 (5) — `submitContactForm` answered `{"received": false}` about a message
 * it had stored, and the body it *should* answer with on each path.
 *
 * Driven over real HTTP in SB-017 §10.5 against a real backend, so this was the
 * answer a visitor's contact form actually got. The wire was
 * `compose.out-built -> res.pm-received`: a **signal** output into a **value**
 * parameter port, a cast `canCastPortTypes` allows, so nothing warned on the
 * canvas and nothing dropped on the way out.
 *
 * 🔴 **The mechanism SB-018 recorded — "the port never receives a value and the
 * response reports the declared default" — is wrong twice over, and this file is
 * where that is cheapest to show.** A `pm-` port is typed `*` with no default,
 * and `initialize` starts `responseParameters` at `{}`; a port that is never set
 * leaves its key **out of the body**. `{"received": false}` therefore proves the
 * port *was* set — with the falling edge of the pulse, which
 * `sb-018-a-signal-into-a-value-port.test.ts` measures in the runtime.
 *
 * The distinction is not pedantry: "never set" and "set to the wrong thing" have
 * different fixes, and the second is what forced the template's flag to move to
 * after the write rather than merely change type.
 */

import { node as ResponseNode } from '../src/nodes/cloud/response';

interface ResponseInternal {
  responseParameters: Record<string, unknown>;
  _requestIsOpen?: () => boolean;
  _sendResponseCallback?: (payload: unknown) => boolean;
}

interface ResponseInstance {
  _internal: ResponseInternal;
  hasOutput(name: string): boolean;
  hasInput(name: string): boolean;
  registerInput(name: string, def: { set: (value: unknown) => void }): void;
  registerInputIfNeeded(name: string): void;
  setResponseParameter(name: string, value: unknown): void;
  sendResponse(token: unknown): void;
  beginOutcome(): unknown;
  __inputs: Record<string, (value: unknown) => void>;
}

/* eslint-disable @typescript-eslint/no-var-requires */
const RuntimeNode = require('@noodl/runtime/src/node');
/* eslint-enable @typescript-eslint/no-var-requires */

/**
 * The node's own methods on the smallest object they can run against — the same
 * approach as `response-node.test.ts`, and for the same reason: what is under
 * test is this node's decision-making, not a cloud runtime.
 *
 * `registerInput` is captured rather than stubbed away, because the path this
 * file is about goes **through** it: `registerInputIfNeeded('pm-x')` is what
 * mints the setter, on the wire path and the parameter path alike.
 */
function makeResponse(): { node: ResponseInstance; delivered: unknown[] } {
  const delivered: unknown[] = [];
  const declared = Object.keys((ResponseNode as unknown as { outputs: Record<string, unknown> }).outputs);
  const inputs: Record<string, (value: unknown) => void> = {};

  const instance = {
    _internal: {} as ResponseInternal,
    __inputs: inputs,
    hasOutput: (name: string) => declared.indexOf(name) !== -1,
    hasInput: (name: string) => Object.prototype.hasOwnProperty.call(inputs, name),
    registerInput: (name: string, def: { set: (value: unknown) => void }) => {
      inputs[name] = def.set;
    },
    sendSignalOnOutput: () => undefined,
    flagOutputDirty: () => undefined,
    raiseRuntimeError: () => undefined
  } as unknown as ResponseInstance;

  (instance as unknown as Record<string, unknown>).beginOutcome = RuntimeNode.prototype.beginOutcome.bind(instance);
  (instance as unknown as Record<string, unknown>).reportOutcome = RuntimeNode.prototype.reportOutcome.bind(instance);

  const methods = (ResponseNode as unknown as { methods: Record<string, (...args: unknown[]) => unknown> }).methods;
  for (const name of Object.keys(methods)) {
    (instance as unknown as Record<string, unknown>)[name] = methods[name].bind(instance);
  }

  (ResponseNode as unknown as { initialize: () => void }).initialize.call(instance);
  instance._internal._requestIsOpen = () => true;
  instance._internal._sendResponseCallback = (payload: unknown) => {
    delivered.push(payload);
    return true;
  };

  return { node: instance, delivered };
}

function bodyOf(delivered: unknown[]): unknown {
  return JSON.parse((delivered[0] as { body: string }).body);
}

describe('SB-018 (5): what the contact endpoint answers, and why it answered `false`', () => {
  it('🔴 an UNSET `pm-` port leaves its key out of the body — so `false` was never a default', () => {
    // The half that rules out SB-018's stated mechanism. If an unset port were
    // the cause, the driven response would have been `{"result":{}}`, and s17
    // read `{"received": false}`.
    const { node, delivered } = makeResponse();
    node.registerInputIfNeeded('pm-received');

    node.sendResponse(node.beginOutcome());

    expect(bodyOf(delivered)).toEqual({ result: {} });
  });

  it('🔴 …and a pulse through that same port writes `true` then `false`, leaving `false` behind', () => {
    // The cause, reproduced through the node's real setter. The runtime half —
    // that a signal output delivers exactly these two values into a value port —
    // is `noodl-runtime/test/sb-018-a-signal-into-a-value-port.test.ts`; here it
    // is applied by hand so this file can be read on its own.
    const { node, delivered } = makeResponse();
    node.registerInputIfNeeded('pm-received');

    node.__inputs['pm-received'](true);
    node.__inputs['pm-received'](false);
    node.sendResponse(node.beginOutcome());

    expect(bodyOf(delivered)).toEqual({ result: { received: false } });
  });

  it('the fixed shape: a parameter-set `false` is overridden by the flag raised after the write', () => {
    // The success path of the template's fix. `pm-received: false` arrives as a
    // node PARAMETER at load, and `stored.out-received` — a plain value output
    // published only once the row exists — overwrites it.
    const { node, delivered } = makeResponse();
    node.registerInputIfNeeded('pm-received');

    node.__inputs['pm-received'](false); // the parameter
    node.__inputs['pm-received'](true); // `stored`, after `save.done`

    node.sendResponse(node.beginOutcome());

    expect(bodyOf(delivered)).toEqual({ result: { received: true } });
  });

  it('🔴 …and the failure path keeps the key, which is what the parameter is for', () => {
    // The control the parameter exists to provide. `save.failure -> res.send`
    // never passes through `stored`, so without the parameter the two paths
    // would answer with different SHAPES and a caller would have to tell `false`
    // from absent.
    const { node, delivered } = makeResponse();
    node.registerInputIfNeeded('pm-received');

    node.__inputs['pm-received'](false); // the parameter, and nothing else

    node.sendResponse(node.beginOutcome());

    expect(bodyOf(delivered)).toEqual({ result: { received: false } });
  });
});
