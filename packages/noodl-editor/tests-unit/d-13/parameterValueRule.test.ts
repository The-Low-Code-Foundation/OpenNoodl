/**
 * ✅ **D13** — `validate:project` checks parameter values.
 *
 * The ruling's own words: *"`checkParameterValues` has one production caller, so
 * parameter values are checked for **no node of any provenance** — 26 unverified
 * on `cashflow-command-centre` alone, read as a pass."*
 *
 * `cn004.test.ts` grades the two pipelines agreeing. This file grades the two
 * things that made it a slice rather than a registration: the normalized model
 * carrying `parameters` at all, and the `info` gate having both arms.
 */
import { loadDefaultCatalog } from '../../src/editor/src/validation/catalog';
import { fromLegacyProject, normalizeV2Component } from '../../src/editor/src/validation/normalize';
import { parameterValue } from '../../src/editor/src/validation/rules';
import type { RuleContext, ValidatorOptions } from '../../src/editor/src/validation/rules';

const catalog = () => loadDefaultCatalog();

function contextFor(nodes: { id: string; type: string; parameters?: Record<string, unknown> }[], options: ValidatorOptions = {}): RuleContext {
  const component = normalizeV2Component('/Pages/Home', { nodes: nodes.map((n) => ({ ...n, children: [] })) } as never, null);
  return {
    project: { components: [component], componentRefs: new Set() },
    catalog: catalog(),
    options,
    components: [{ component, nodeById: new Map(component.nodes.map((n) => [n.id, n])) }],
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  };
}

describe('the normalized model carries parameters', () => {
  /**
   * 🔴 **The precondition, and the reason D13 was not a one-line change.**
   * `NormNode` carried no `parameters`, and two source files stated that absence
   * as a settled fact. A rule registered without this would have run over nodes
   * whose parameters were all `undefined` and reported a clean pass — the exact
   * failure mode the ruling exists to end, reproduced by its own fix.
   */
  it('on the v2 shape', () => {
    const c = normalizeV2Component('/App', { nodes: [{ id: 'n', type: 'Text', parameters: { text: 'hi' }, children: [] }] } as never, null);
    expect(c.nodes[0].parameters).toEqual({ text: 'hi' });
  });

  it('on the legacy shape', () => {
    const p = fromLegacyProject({
      components: [{ name: '/App', graph: { roots: [{ id: 'n', type: 'Text', parameters: { text: 'hi' } } as never] } }]
    });
    expect(p.components[0].nodes[0].parameters).toEqual({ text: 'hi' });
  });

  it('and is ABSENT, not empty, when a node sets none', () => {
    // "set nothing" and "carried nothing" must stay distinguishable: the whole
    // check turns on `if (!parameters) continue`.
    const c = normalizeV2Component('/App', { nodes: [{ id: 'n', type: 'Text', children: [] }] } as never, null);
    expect('parameters' in c.nodes[0]).toBe(false);
  });

  it('drops a non-object rather than passing it to the checker', () => {
    // An array would make the checker iterate `Object.entries` and emit
    // diagnostics named "0", "1". `malformed-node` owns that report.
    const c = normalizeV2Component('/App', { nodes: [{ id: 'n', type: 'Text', parameters: ['x'], children: [] }] } as never, null);
    expect(c.nodes[0].parameters).toBeUndefined();
  });
});

describe('the rule itself', () => {
  it('reports a malformed value as an error', () => {
    const found = parameterValue.run(contextFor([{ id: 'g', type: 'Group', parameters: { opacity: 'lots' } }]));
    expect(found.map((d) => d.code)).toContain('invalid-parameter-value');
  });

  it('says nothing about the same node with a correct value', () => {
    // The other arm. Without it the row above passes for a rule that accuses
    // every parameter it sees.
    const found = parameterValue.run(contextFor([{ id: 'g', type: 'Group', parameters: { opacity: 0.5 } }]));
    expect(found.filter((d) => d.code === 'invalid-parameter-value')).toEqual([]);
  });

  describe('the info gate has both arms', () => {
    // `--info` is why the skip notices are filtered at the rule rather than in
    // the checker: CN-010 kept them unconditional there because that flag has
    // no caller on the editor path. This rule IS the caller.
    const dynamic = [{ id: 'p', type: 'NavigationShowPopup', parameters: { target: '/Pages/Dialog', customerId: 'abc' } }];

    it('off by default — a large project would be thousands of notes', () => {
      expect(parameterValue.run(contextFor(dynamic)).filter((d) => d.severity === 'info')).toEqual([]);
    });

    it('on with emitDynamicPortInfo, and it is the same input', () => {
      const found = parameterValue.run(contextFor(dynamic, { emitDynamicPortInfo: true }));
      expect(found.map((d) => d.code)).toContain('dynamic-port-skipped');
    });
  });
});
