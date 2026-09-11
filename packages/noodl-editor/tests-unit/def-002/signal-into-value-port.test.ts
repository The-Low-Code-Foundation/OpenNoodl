/**
 * DEF-002 §3 — a signal output wired into a value input.
 *
 * ## Why this file uses the real catalog
 *
 * The rule's whole safety property is *"both ports are statically known"*, and a
 * hand-built fake catalog would let me declare that trivially. Grading against
 * `loadDefaultCatalog()` means the `isSignal` flags are the ones the product
 * ships, and the accept-arms below are real graphs rather than my idea of one.
 *
 * ## Every case is a pair
 *
 * 🔴 A rule that fires on both arms has measured nothing. Each refusal here has
 * an acceptance one wire away, and each deliberate silence has a known-firing
 * case beside it — otherwise "quiet" and "never ran" are the same reading.
 *
 * @module noodl-editor/tests-unit/def-002/signal-into-value-port
 */
import { isBlockingForAuthoredOutput } from '@noodl-models/../validation/authoredCandidate';
import { loadDefaultCatalog } from '@noodl-models/../validation/catalog';
import { DiagnosticCode } from '@noodl-models/../validation/diagnostics';
import { SemanticValidator } from '@noodl-models/../validation/SemanticValidator';
import type { NormConnection, NormNode, NormProject } from '@noodl-models/../validation/model';

const catalog = loadDefaultCatalog();

/** A normalized node with the fields every rule expects present. */
function node(id: string, type: string, label?: string): NormNode {
  return { id, type, label, children: [], instancePorts: [] } as unknown as NormNode;
}

function project(nodes: NormNode[], connections: NormConnection[]): NormProject {
  return { components: [{ name: '/Pages/Home', nodes, connections }] } as NormProject;
}

/** Only this rule, so a neighbour's finding cannot be mistaken for it. */
function run(nodes: NormNode[], connections: NormConnection[]) {
  return new SemanticValidator(catalog)
    .validate(project(nodes, connections), { only: new Set([DiagnosticCode.SignalIntoValuePort]) })
    .diagnostics;
}

/**
 * The shape phase 78 D4 actually wired: a query's `failure` into a Group's
 * `visible`. `failure` is a signal output; `visible` is a boolean value input.
 */
const QUERY = node('q', 'DbCollection2', 'Announcements');
const NOTICE = node('notice', 'Group', 'Unknown notice');

describe('DEF-002 §3 — a signal into a value port', () => {
  it('the two ports really are what this rule assumes — read from the shipped catalog', () => {
    // 🔴 If this ever stops being true the cases below are testing nothing, and
    // they would still pass. Assert the premise, not just the conclusion.
    expect(catalog.getPort('DbCollection2', 'output', 'failure')?.isSignal).toBe(true);
    expect(catalog.getPort('Group', 'input', 'visible')?.isSignal).not.toBe(true);
  });

  describe("phase 78 D4's inverted notice", () => {
    it('refuses `failure` -> `visible` BY NAME, and says what the runtime really does', () => {
      const found = run([QUERY, NOTICE], [{ fromId: 'q', fromProperty: 'failure', toId: 'notice', toProperty: 'visible' }]);
      expect(found).toHaveLength(1);
      expect(found[0].code).toBe(DiagnosticCode.SignalIntoValuePort);
      expect(found[0].severity).toBe('warning');
      expect(found[0].location.port).toBe('visible');
      // The consequence, not the category — "runs once, with false" is the bit
      // that explains the inverted screen.
      expect(found[0].message).toContain('ends up holding **false**');
      expect(found[0].location.connection).toEqual({
        fromId: 'q',
        fromProperty: 'failure',
        toId: 'notice',
        toProperty: 'visible'
      });
    });

    it('accepts the same signal into a SIGNAL input — the control', () => {
      // `mounted` is a signal input on Group; a signal into it is ordinary.
      const signalInputs = catalog.signalInputNames('Group');
      expect(signalInputs.length).toBeGreaterThan(0);
      expect(
        run([QUERY, NOTICE], [{ fromId: 'q', fromProperty: 'failure', toId: 'notice', toProperty: signalInputs[0] }])
      ).toEqual([]);
    });

    it('accepts a VALUE output into the same value input — the other control', () => {
      // `error` is the string sibling of `failure`, and wiring it is correct.
      expect(catalog.getPort('DbCollection2', 'output', 'error')?.isSignal).not.toBe(true);
      expect(
        run([QUERY, NOTICE], [{ fromId: 'q', fromProperty: 'error', toId: 'notice', toProperty: 'visible' }])
      ).toEqual([]);
    });
  });

  describe('what it stays silent about, each beside a firing case', () => {
    it('says nothing when a port is not in the catalog — and something when both are', () => {
      const dynamic = node('fn', 'JavaScriptFunction', 'F');
      // `out-anything` is minted by the script at runtime: unknown here, skipped.
      expect(
        run([dynamic, NOTICE], [{ fromId: 'fn', fromProperty: 'out-anything', toId: 'notice', toProperty: 'visible' }])
      ).toEqual([]);
      // The same node's DECLARED signal output is known, and is refused.
      expect(catalog.getPort('JavaScriptFunction', 'output', 'failure')?.isSignal).toBe(true);
      expect(
        run([dynamic, NOTICE], [{ fromId: 'fn', fromProperty: 'failure', toId: 'notice', toProperty: 'visible' }])
      ).toHaveLength(1);
    });

    it('says nothing about a component instance — connectionTargets owns that class', () => {
      const instance = node('card', '/Components/Card');
      expect(
        run([QUERY, instance], [{ fromId: 'q', fromProperty: 'failure', toId: 'card', toProperty: 'anything' }])
      ).toEqual([]);
    });

    it('says nothing about a dangling connection — danglingConnection owns it', () => {
      expect(run([QUERY], [{ fromId: 'q', fromProperty: 'failure', toId: 'gone', toProperty: 'visible' }])).toEqual([]);
    });
  });

  it('blocks an AGENT while merely advising a hand-authored import', () => {
    // 🔴 The whole reason it is a warning rather than an error. The corpus
    // carries one TRUE positive in a hand-authored project; breaking CI over it
    // is how a rule gets switched off. `AUTHORED_BLOCKING_WARNINGS` is the seam
    // that already splits the two populations.
    const found = run([QUERY, NOTICE], [{ fromId: 'q', fromProperty: 'failure', toId: 'notice', toProperty: 'visible' }]);
    expect(found[0].severity).toBe('warning');
    expect(isBlockingForAuthoredOutput(found[0])).toBe(true);
    // The control: a warning NOT in the set is not blocking, so the assertion
    // above is about this code and not about warnings in general.
    expect(isBlockingForAuthoredOutput({ ...found[0], code: DiagnosticCode.UnlabelledNode, severity: 'info' })).toBe(
      false
    );
  });

  it('is registered and enabled by default — an unregistered rule never runs', () => {
    const active = new SemanticValidator(catalog).activeRules({}).map((r) => r.code);
    expect(active).toContain(DiagnosticCode.SignalIntoValuePort);
  });
});
