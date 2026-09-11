/**
 * EXP-011 §8.5 — the HTTP Request node drew a `Success` output that could never fire.
 *
 * ## Why this could not be seen from either side alone
 *
 * `httpnode.ts` declares its outputs twice. The node type declares `response`, `statusCode`,
 * `responseHeaders`, `canceled` and `error` statically, and spreads `outcomeOutputs({ done,
 * unchanged, failure })` beside them — that is the ERG-001 contract, and `reportOutcome` sends
 * exactly those names. `updatePorts` then publishes a *second* list over
 * `sendDynamicPorts`, because almost every input on this node is minted from the author's
 * configuration and the publish has to carry the outputs with it.
 *
 * That second list was written before ERG-001 renamed `success` to `done`, and it still said
 * `success`. Nothing collided, because `NodeGraphNode.getPorts` puts a dynamic port *over* a
 * static one of the same name and plug (`portOverrides.ts`) — and `success` had no static
 * counterpart, so it was **appended**. The author saw both `Done` and `Success` in the Events
 * group, and a wire from `Success` ran nothing at all: the runtime sends `done`.
 *
 * 🔴 **A dead output is the one defect an author cannot see.** A wire is drawn, the graph
 * looks wired, and the chain never fires. `nodegx-export` reported it rather than reproducing
 * it, which is how it was found; the fix belongs here.
 *
 * ## What this file asserts, and why it is a rule rather than a row
 *
 * The rule is **every signal output this node publishes dynamically must be one the node can
 * send** — which, because `reportOutcome` gates on `hasOutput`, means one the node type
 * declares. A row naming `success` alone would pass again the next time a stale name is
 * copied into this list; the set comparison catches the class.
 *
 * ⚠️ The population is asserted non-empty first. A test whose subject set is empty passes on
 * a `updatePorts` that published no outputs at all, which is a different defect wearing this
 * one's green tick.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */
type Any = any;

import HttpNodeModule = require('../../src/nodes/std-library/data/httpnode');

import { driveSetup, RecordedPort } from '../corpus/setup-harness';

const HTTP_TYPE = 'net.noodl.HTTP';

/** The outputs the node type declares — the names `reportOutcome`/`sendSignalOnOutput` can reach. */
function declaredOutputs(): string[] {
  return Object.keys(((HttpNodeModule as Any).node.outputs || {}) as Record<string, unknown>);
}

/** Every output port one `updatePorts` publish carried. */
function publishedOutputs(parameters: Record<string, unknown> = {}): RecordedPort[] {
  const harness = driveSetup({
    module: HttpNodeModule as Any,
    type: HTTP_TYPE,
    nodes: [{ id: 'http-1', parameters }]
  });
  return harness.ports('http-1').filter((port) => port.plug === 'output');
}

describe('HTTP Request — the dynamic publish cannot mint an output the node cannot fire', () => {
  it('declares the ERG-001 outcome ports statically, which is what makes the rule below checkable', () => {
    // The control on the *other* side of the comparison. If this drifts, the rule below starts
    // measuring a node whose contract has changed rather than a stale copy of its port list.
    expect(declaredOutputs()).toEqual(expect.arrayContaining(['done', 'unchanged', 'failure', 'completed']));
    expect(declaredOutputs()).not.toContain('success');
  });

  it('publishes at least one signal output, so the rule below has a population', () => {
    const signals = publishedOutputs().filter((port) => port.type === 'signal');
    expect(signals.length).toBeGreaterThan(0);
  });

  it('publishes no signal output the node type does not declare', () => {
    const declared = declaredOutputs();
    const undeclared = publishedOutputs()
      .filter((port) => port.type === 'signal')
      .map((port) => port.name)
      .filter((name) => declared.indexOf(name) === -1);

    expect(undeclared).toEqual([]);
  });

  it('does not publish `success` — ERG-001 renamed it to `done`, and only this list still said so', () => {
    expect(publishedOutputs().map((port) => port.name)).not.toContain('success');
  });

  it('still publishes the outputs it is the only publisher of', () => {
    // 🔴 The negative above must not be satisfiable by deleting the publish. `Response` and
    // `Error` are carried by this list on every configuration, and an author who cannot see
    // them has lost more than the dead port cost.
    const names = publishedOutputs().map((port) => port.name);
    expect(names).toEqual(expect.arrayContaining(['response', 'statusCode', 'responseHeaders', 'failure', 'canceled', 'error']));
  });

  it('keeps the rule under a configuration that mints ports of its own', () => {
    // A URL with a path parameter drives the other branch of `updatePorts`. The minted ports
    // are inputs, so the output rule is unchanged — which is the claim.
    const declared = declaredOutputs();
    const ports = publishedOutputs({ url: 'https://example.com/users/{userId}' });
    const undeclared = ports
      .filter((port) => port.type === 'signal')
      .map((port) => port.name)
      .filter((name) => declared.indexOf(name) === -1);

    expect(undeclared).toEqual([]);
  });
});
