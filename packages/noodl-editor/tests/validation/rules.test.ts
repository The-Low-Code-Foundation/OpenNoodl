/**
 * SUB-006 — Per-rule unit tests
 *
 * Each rule is exercised with a deliberately-broken fixture and a clean control.
 * A small hand-built catalog is used where exact port types/names matter (so the
 * tests do not break when the shipped catalog is regenerated); the real catalog
 * is used for suggestion realism.
 */

import { CatalogIndex } from '../../src/editor/src/validation/CatalogIndex';
import type { NodeCatalog, CatalogNode, CatalogPort } from '../../src/editor/src/validation/CatalogIndex';
import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { NormNode, NormProject, buildComponentRefs } from '../../src/editor/src/validation/model';
import { ALL_RULES } from '../../src/editor/src/validation/rules';

// ── Hand-built catalog helpers ────────────────────────────────────────────────

function port(name: string, plug: 'input' | 'output', typeName: string, isSignal = false): CatalogPort {
  return { name, plug, type: { name: typeName }, isSignal } as CatalogPort;
}

function catNode(
  typeName: string,
  inputs: CatalogPort[],
  outputs: CatalogPort[],
  dynamicPorts: CatalogNode['dynamicPorts'] = null
): CatalogNode {
  return {
    typeName: typeName as CatalogNode['typeName'],
    displayName: typeName,
    isVisual: false,
    isDeprecated: false,
    inNodePicker: true,
    availableIn: ['browser'],
    providedBy: 'noodl-runtime',
    inputs,
    outputs,
    dynamicPorts
  } as CatalogNode;
}

const HAND_CATALOG: NodeCatalog = {
  catalogFormatVersion: '1.0.0',
  generatedBy: 'test',
  schemaDocs: '',
  packages: {},
  portTypeNames: ['string', 'number', 'color', 'signal', '*'],
  typecasts: [
    { from: 'string', to: ['number'] },
    { from: 'number', to: ['string'] }
  ],
  nodes: [
    catNode('Widget', [port('value', 'input', 'string'), port('onClick', 'input', 'signal', true)], [port('text', 'output', 'string')]),
    catNode('ColorSrc', [], [port('colorOut', 'output', 'color')]),
    catNode('NumDst', [port('numIn', 'input', 'number')], []),
    catNode('StrDst', [port('strIn', 'input', 'string')], []),
    // A dynamic node whose ports are runtime-discovered.
    catNode('Fn', [port('run', 'input', 'signal', true)], [], {
      mechanisms: ['runtime-discovered'],
      description: 'runtime outputs'
    }),

    // ── ERG-001 unwired-outcome fixtures ────────────────────────────────────
    //
    // `Action` is a node that has adopted the outcome contract in full, plus one
    // announcement (`applied`) of the kind that made the rule's two wider predicates
    // unusable. `NoNoop` has no `unchanged`, which is the contract's own exemption for a
    // node that cannot legitimately do nothing.
    catNode(
      'Action',
      [port('do', 'input', 'signal', true), port('value', 'input', 'string')],
      [
        port('applied', 'output', 'signal', true),
        port('done', 'output', 'signal', true),
        port('unchanged', 'output', 'signal', true),
        port('failure', 'output', 'signal', true),
        port('completed', 'output', 'signal', true)
      ]
    ),
    catNode(
      'NoNoop',
      [port('do', 'input', 'signal', true)],
      [
        port('done', 'output', 'signal', true),
        port('failure', 'output', 'signal', true),
        port('completed', 'output', 'signal', true)
      ]
    ),
    catNode('Sink', [port('in', 'input', 'signal', true), port('other', 'input', 'signal', true)], []),
    catNode('Src', [], [port('go', 'output', 'signal', true)]),

    // ── NDA-017 signal-driven-stale-input fixtures ──────────────────────────
    // An asynchronous producer: it publishes a completion signal, which is what
    // "the value lands later than the trigger" means to the rule.
    catNode(
      'Fetcher',
      [port('fetch', 'input', 'signal', true)],
      [port('items', 'output', '*'), port('count', 'output', 'number'), port('success', 'output', 'signal', true)]
    ),
    // A consumer in NDA-017 §2's family: its `runOnChange-*` ports are what the
    // rule keys on, and they are declared statically here exactly as the real
    // fixed-input families declare them.
    catNode(
      'Calc',
      [
        port('a', 'input', '*'),
        port('b', 'input', '*'),
        port('run', 'input', 'signal', true),
        port('runOnChange-a', 'input', 'boolean'),
        port('runOnChange-b', 'input', 'boolean')
      ],
      [port('result', 'output', '*')]
    ),
    catNode('Trigger', [], [port('onClick', 'output', 'signal', true)]),
    catNode('Relay', [port('in', 'input', 'signal', true)], [port('out', 'output', 'signal', true)])
  ]
};

function handValidator(): SemanticValidator {
  return new SemanticValidator(new CatalogIndex(HAND_CATALOG), ALL_RULES);
}

function node(id: string, type: string, extra: Partial<NormNode> = {}): NormNode {
  return { id, type, children: [], instancePorts: [], ...extra };
}

function oneComponent(nodes: NormNode[], connections: NormProject['components'][0]['connections'], name = '/#Test'): NormProject {
  return { components: [{ name, nodes, connections }], componentRefs: buildComponentRefs([name]) };
}

function bySeverity(report: { diagnostics: { severity: string }[] }, sev: string) {
  return report.diagnostics.filter((d) => d.severity === sev);
}

// ── Tests ──────────────────────────────────────────────────────────────────────

describe('SUB-006 rules', () => {
  describe('unknown-node-type', () => {
    it('warns (not errors) on an unknown type and suggests the nearest match', () => {
      const v = handValidator();
      const p = oneComponent([node('n', 'Widgett')], []);
      const report = v.validate(p);
      const d = report.diagnostics.find((x) => x.code === DiagnosticCode.UnknownNodeType);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('warning');
      expect(d!.suggestion).toBe('Widget');
    });

    it('promotes to error under --strict', () => {
      const v = handValidator();
      const p = oneComponent([node('n', 'Widgett')], []);
      const d = v.validate(p, { strict: true }).diagnostics.find((x) => x.code === DiagnosticCode.UnknownNodeType);
      expect(d!.severity).toBe('error');
    });

    it('does not flag a known type', () => {
      const v = handValidator();
      const report = v.validate(oneComponent([node('n', 'Widget')], []));
      expect(report.diagnostics.some((d) => d.code === DiagnosticCode.UnknownNodeType)).toBe(false);
    });
  });

  describe('nonexistent-port', () => {
    it('errors on a missing static port and lists available alternatives', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('a', 'Widget'), node('b', 'Widget')],
        [{ fromId: 'a', fromProperty: 'text', toId: 'b', toProperty: 'valeu' }]
      );
      const d = v.validate(p).diagnostics.find((x) => x.code === DiagnosticCode.NonexistentPort);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('error');
      expect(d!.suggestion).toBe('value');
      expect(d!.alternatives).toContain('value');
      // signal inputs lead the alternatives list
      expect(d!.alternatives![0]).toBe('onClick');
    });

    it('accepts a port declared on the node instance', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('a', 'Widget'), node('b', 'Widget', { instancePorts: ['extra'] })],
        [{ fromId: 'a', fromProperty: 'text', toId: 'b', toProperty: 'extra' }]
      );
      expect(bySeverity(v.validate(p), 'error').length).toBe(0);
    });
  });

  describe('dangling-connection', () => {
    it('errors when an endpoint node is missing', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('a', 'Widget')],
        [{ fromId: 'a', fromProperty: 'text', toId: 'ghost', toProperty: 'value' }]
      );
      const d = v.validate(p).diagnostics.find((x) => x.code === DiagnosticCode.DanglingConnection);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('error');
    });
  });

  describe('unresolved-component-ref', () => {
    it('errors on a component reference with no matching component', () => {
      const v = handValidator();
      const p: NormProject = {
        components: [{ name: '/#App', nodes: [node('n', '/#Missing')], connections: [] }],
        componentRefs: buildComponentRefs(['/#App'])
      };
      const d = v.validate(p).diagnostics.find((x) => x.code === DiagnosticCode.UnresolvedComponentRef);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('error');
    });

    it('accepts a reference that resolves (by legacy name or path)', () => {
      const v = handValidator();
      const p: NormProject = {
        components: [
          { name: '/#App', nodes: [node('n', '/#Card')], connections: [] },
          { name: '/#Card', nodes: [], connections: [] }
        ],
        componentRefs: buildComponentRefs(['/#App', '/#Card'])
      };
      expect(v.validate(p).diagnostics.some((d) => d.code === DiagnosticCode.UnresolvedComponentRef)).toBe(false);
    });
  });

  describe('orphaned-node', () => {
    it('errors on a broken parent reference', () => {
      const v = handValidator();
      const p = oneComponent([node('child', 'Widget', { parent: 'ghostParent' })], []);
      const d = v.validate(p).diagnostics.find((x) => x.code === DiagnosticCode.OrphanedNode);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('error');
    });

    it('errors on a broken child reference', () => {
      const v = handValidator();
      const p = oneComponent([node('parent', 'Widget', { children: ['ghostChild'] })], []);
      expect(v.validate(p).diagnostics.some((d) => d.code === DiagnosticCode.OrphanedNode)).toBe(true);
    });

    it('accepts intact parent/child links', () => {
      const v = handValidator();
      const p = oneComponent([
        node('parent', 'Widget', { children: ['child'] }),
        node('child', 'Widget', { parent: 'parent' })
      ], []);
      expect(v.validate(p).diagnostics.some((d) => d.code === DiagnosticCode.OrphanedNode)).toBe(false);
    });
  });

  describe('type-incompatible-connection', () => {
    it('warns on a provably-incompatible statically-typed pair (color → number)', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('s', 'ColorSrc'), node('d', 'NumDst')],
        [{ fromId: 's', fromProperty: 'colorOut', toId: 'd', toProperty: 'numIn' }]
      );
      const d = v.validate(p).diagnostics.find((x) => x.code === DiagnosticCode.TypeIncompatibleConnection);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('warning');
    });

    it('accepts a pair connected via a documented typecast (number → string)', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('s', 'Widget'), node('d', 'StrDst')],
        // Widget.text is string → StrDst.strIn is string: identical, compatible.
        [{ fromId: 's', fromProperty: 'text', toId: 'd', toProperty: 'strIn' }]
      );
      expect(v.validate(p).diagnostics.some((d) => d.code === DiagnosticCode.TypeIncompatibleConnection)).toBe(false);
    });

    it('does not fire when a port type is runtime-determined', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('fn', 'Fn'), node('d', 'NumDst')],
        [{ fromId: 'fn', fromProperty: 'runtimeOut', toId: 'd', toProperty: 'numIn' }]
      );
      expect(v.validate(p).diagnostics.some((d) => d.code === DiagnosticCode.TypeIncompatibleConnection)).toBe(false);
    });
  });

  describe('orchestrator toggles', () => {
    it('runs only the requested rule with `only`', () => {
      const v = handValidator();
      const p = oneComponent(
        [node('n', 'Widgett'), node('a', 'Widget')],
        [{ fromId: 'a', fromProperty: 'text', toId: 'a', toProperty: 'valeu' }]
      );
      const report = v.validate(p, { only: new Set([DiagnosticCode.UnknownNodeType]) });
      expect(report.diagnostics.every((d) => d.code === DiagnosticCode.UnknownNodeType)).toBe(true);
    });

    it('skips a disabled rule', () => {
      const v = handValidator();
      const p = oneComponent([node('n', 'Widgett')], []);
      const report = v.validate(p, { disabled: new Set([DiagnosticCode.UnknownNodeType]) });
      expect(report.diagnostics.some((d) => d.code === DiagnosticCode.UnknownNodeType)).toBe(false);
    });

    it('validateComponent filters diagnostics to the target component', () => {
      const v = handValidator();
      const p: NormProject = {
        components: [
          { name: '/#A', nodes: [node('x', 'Widgett')], connections: [] },
          { name: '/#B', nodes: [node('y', 'Nopee')], connections: [] }
        ],
        componentRefs: buildComponentRefs(['/#A', '/#B'])
      };
      const report = v.validateComponent(p, '/#A');
      expect(report.diagnostics.length).toBe(1);
      expect(report.diagnostics[0].location.component).toBe('/#A');
    });
  });

  /**
   * NDA-017 criterion 6 — the visibility half of "Run on value change".
   *
   * ⚠️ The criterion is worded as "a `Run` driven by something other than its inputs'
   * producers", and the rule deliberately does **not** do that: a Button driving `Run` while
   * values come from Text Inputs is the canonical *correct* graph, including the one in the
   * original report, and flagging it would make the rule noise. The narrowing to
   * *asynchronous* producers is what the last three controls below defend.
   */
  describe('signal-driven-stale-input', () => {
    const CONSUMER = [node('calc', 'Calc'), node('fetch', 'Fetcher'), node('btn', 'Trigger')];

    it('flags a control signal that does not wait for an asynchronous producer', () => {
      const v = handValidator();
      const p = oneComponent(CONSUMER, [
        { fromId: 'fetch', fromProperty: 'items', toId: 'calc', toProperty: 'a' },
        { fromId: 'btn', fromProperty: 'onClick', toId: 'calc', toProperty: 'run' }
      ]);
      const d = v.validate(p).diagnostics.find((x) => x.code === DiagnosticCode.SignalDrivenStaleInput);
      expect(d).toBeDefined();
      expect(d!.severity).toBe('warning');
      expect(d!.location.port).toBe('a');
      expect(d!.location.nodeId).toBe('calc');
      // The message has to name the wire that fixes it, not merely the problem.
      expect(d!.alternatives).toEqual(['success']);
      expect(d!.suggestion).toBe('Fetcher.success → Calc.run');
    });

    it('says nothing when the signal is driven by the producer\'s completion', () => {
      const v = handValidator();
      const p = oneComponent(CONSUMER, [
        { fromId: 'fetch', fromProperty: 'items', toId: 'calc', toProperty: 'a' },
        { fromId: 'fetch', fromProperty: 'success', toId: 'calc', toProperty: 'run' }
      ]);
      expect(v.validate(p).diagnostics.some((x) => x.code === DiagnosticCode.SignalDrivenStaleInput)).toBe(false);
    });

    it('follows the completion signal through an intermediate node', () => {
      const v = handValidator();
      const p = oneComponent([...CONSUMER, node('relay', 'Relay')], [
        { fromId: 'fetch', fromProperty: 'items', toId: 'calc', toProperty: 'a' },
        { fromId: 'fetch', fromProperty: 'success', toId: 'relay', toProperty: 'in' },
        { fromId: 'relay', fromProperty: 'out', toId: 'calc', toProperty: 'run' }
      ]);
      // The backward walk is over-approximate on purpose: it concludes "waits" more often
      // than it should, so its failure mode is a missed report rather than a false one.
      expect(v.validate(p).diagnostics.some((x) => x.code === DiagnosticCode.SignalDrivenStaleInput)).toBe(false);
    });

    it('reports once per producer, not once per port it feeds', () => {
      const v = handValidator();
      const p = oneComponent(CONSUMER, [
        { fromId: 'fetch', fromProperty: 'items', toId: 'calc', toProperty: 'a' },
        { fromId: 'fetch', fromProperty: 'count', toId: 'calc', toProperty: 'b' },
        { fromId: 'btn', fromProperty: 'onClick', toId: 'calc', toProperty: 'run' }
      ]);
      const all = v.validate(p).diagnostics.filter((x) => x.code === DiagnosticCode.SignalDrivenStaleInput);
      expect(all.length).toBe(1);
    });

    // ── The controls. Each is a graph the literal reading of criterion 6 would flag. ──

    it('says nothing when no control signal is wired — the §2 default', () => {
      const v = handValidator();
      const p = oneComponent(CONSUMER, [{ fromId: 'fetch', fromProperty: 'items', toId: 'calc', toProperty: 'a' }]);
      // With `run` unconnected the value setters are live, so there is nothing to be stale
      // relative to. This is the whole point of NDA-017 §2's default and must never warn.
      expect(v.validate(p).diagnostics.some((x) => x.code === DiagnosticCode.SignalDrivenStaleInput)).toBe(false);
    });

    it('says nothing for a synchronous producer, which is the canonical correct graph', () => {
      const v = handValidator();
      const p = oneComponent([...CONSUMER, node('w', 'Widget')], [
        { fromId: 'w', fromProperty: 'text', toId: 'calc', toProperty: 'a' },
        { fromId: 'btn', fromProperty: 'onClick', toId: 'calc', toProperty: 'run' }
      ]);
      // A Button driving Run while the value comes from a field is the reporter's own working
      // graph. A rule that fires here is a rule nobody leaves switched on.
      expect(v.validate(p).diagnostics.some((x) => x.code === DiagnosticCode.SignalDrivenStaleInput)).toBe(false);
    });

    it('says nothing for a node outside the Run On Value Change families', () => {
      const v = handValidator();
      const p = oneComponent([node('w', 'Widget'), node('fetch', 'Fetcher'), node('btn', 'Trigger')], [
        { fromId: 'fetch', fromProperty: 'items', toId: 'w', toProperty: 'value' },
        { fromId: 'btn', fromProperty: 'onClick', toId: 'w', toProperty: 'onClick' }
      ]);
      expect(v.validate(p).diagnostics.some((x) => x.code === DiagnosticCode.SignalDrivenStaleInput)).toBe(false);
    });
  });

  /**
   * ERG-001 §5 — the outcome contract's dead-end check, and its three narrowings.
   *
   * ⚠️ **The controls are the point of this block, not the positive case.** Two wider
   * predicates were written first and measured against the 50 shipped examples: "every outcome
   * unwired" fired 7 times with **zero** true positives, and "`done` wired, `unchanged` not"
   * fired 6 times with about one. Each control below pins one of the shapes that made those
   * versions unusable, so a later widening of the rule reddens a row rather than quietly
   * reintroducing the noise.
   */
  describe('unwired-outcome', () => {
    const fired = (p: NormProject) =>
      handValidator()
        .validate(p)
        .diagnostics.filter((d) => d.code === DiagnosticCode.UnwiredOutcome);

    /** The shape the rule exists for: two outcomes routed, the third forgotten. */
    function enumerating(extra: NormProject['components'][0]['connections'] = []) {
      return oneComponent(
        [node('src', 'Src'), node('a', 'Action'), node('ok', 'Sink'), node('bad', 'Sink')],
        [
          { fromId: 'src', fromProperty: 'go', toId: 'a', toProperty: 'do' },
          { fromId: 'a', fromProperty: 'done', toId: 'ok', toProperty: 'in' },
          { fromId: 'a', fromProperty: 'failure', toId: 'bad', toProperty: 'in' },
          ...extra
        ]
      );
    }

    it('flags an action routing done and failure but leaving unchanged nowhere', () => {
      const d = fired(enumerating());
      expect(d.length).toBe(1);
      expect(d[0].severity).toBe('warning');
      expect(d[0].location.nodeId).toBe('a');
      expect(d[0].suggestion).toBe('Action.completed');
      expect(d[0].alternatives).toEqual(['completed', 'unchanged']);
    });

    it('is satisfied by completed', () => {
      expect(fired(enumerating([{ fromId: 'a', fromProperty: 'completed', toId: 'ok', toProperty: 'other' }]))).toEqual(
        []
      );
    });

    it('is satisfied by unchanged', () => {
      expect(fired(enumerating([{ fromId: 'a', fromProperty: 'unchanged', toId: 'ok', toProperty: 'other' }]))).toEqual(
        []
      );
    });

    /**
     * ⚠️ Control for the **second** rejected predicate. Stopping on a no-op is very often
     * exactly right — `Unchanged` frequently means the user cancelled — so `done` alone is not
     * evidence of intent to enumerate.
     */
    it('(control) does not flag done alone, without failure also routed', () => {
      const p = oneComponent(
        [node('src', 'Src'), node('a', 'Action'), node('ok', 'Sink')],
        [
          { fromId: 'src', fromProperty: 'go', toId: 'a', toProperty: 'do' },
          { fromId: 'a', fromProperty: 'done', toId: 'ok', toProperty: 'in' }
        ]
      );
      expect(fired(p)).toEqual([]);
    });

    /**
     * ⚠️ Control for the **first** rejected predicate. An announcement is very often the
     * better thing to sequence from, being more specific than the generic outcome — wiring
     * `Applied` to the request that follows is correct authoring, not a dead chain.
     */
    it('(control) does not flag a chain sequenced from an announcement', () => {
      const p = oneComponent(
        [node('src', 'Src'), node('a', 'Action'), node('ok', 'Sink')],
        [
          { fromId: 'src', fromProperty: 'go', toId: 'a', toProperty: 'do' },
          { fromId: 'a', fromProperty: 'applied', toId: 'ok', toProperty: 'in' }
        ]
      );
      expect(fired(p)).toEqual([]);
    });

    /**
     * ⚠️ The contract's own exemption, honoured here rather than by a list of node names:
     * "a node that cannot be a no-op gets no `Unchanged` port". `Page Stack` and `State
     * History` are the shipped instances, and neither can reach this rule.
     */
    it('(control) does not flag a node with no unchanged port to wire', () => {
      const p = oneComponent(
        [node('src', 'Src'), node('a', 'NoNoop'), node('ok', 'Sink'), node('bad', 'Sink')],
        [
          { fromId: 'src', fromProperty: 'go', toId: 'a', toProperty: 'do' },
          { fromId: 'a', fromProperty: 'done', toId: 'ok', toProperty: 'in' },
          { fromId: 'a', fromProperty: 'failure', toId: 'bad', toProperty: 'in' }
        ]
      );
      expect(fired(p)).toEqual([]);
    });

    /** An action nobody invokes is not a broken chain. */
    it('(control) does not flag an action with no signal input driven', () => {
      const p = oneComponent(
        [node('a', 'Action'), node('ok', 'Sink'), node('bad', 'Sink')],
        [
          { fromId: 'a', fromProperty: 'done', toId: 'ok', toProperty: 'in' },
          { fromId: 'a', fromProperty: 'failure', toId: 'bad', toProperty: 'in' }
        ]
      );
      expect(fired(p)).toEqual([]);
    });
  });
});
