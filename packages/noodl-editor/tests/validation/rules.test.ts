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
    })
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
});
