/**
 * SUB-012 — Duplicate node id rule
 *
 * The defect this guards: a project with two nodes sharing an id used to pass
 * both project validators with 0 errors and 0 warnings. Both indexed nodes into
 * a `Map<id, node>`, so the second occurrence displaced the first and the
 * duplicate was erased from the validator's own view — which is why every
 * downstream check also passed.
 *
 * The load-bearing assertion in here is therefore not "an error is reported" but
 * "*both* offending nodes are reported": two diagnostics for one id is a result
 * a map-based implementation cannot produce.
 */

import { SemanticValidator } from '../../src/editor/src/validation/SemanticValidator';
import { Diagnostic, DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import { NormComponent, NormNode, NormProject, buildComponentRefs } from '../../src/editor/src/validation/model';
import { ALL_RULES, duplicateNodeId } from '../../src/editor/src/validation/rules';

function node(id: string, type: string, extra: Partial<NormNode> = {}): NormNode {
  return { id, type, children: [], instancePorts: [], ...extra };
}

function project(components: Array<{ name: string; nodes: NormNode[] }>): NormProject {
  const norm: NormComponent[] = components.map((c) => ({ name: c.name, nodes: c.nodes, connections: [] }));
  return { components: norm, componentRefs: buildComponentRefs(norm.map((c) => c.name)) };
}

/** Only this rule, so unrelated catalog findings (unknown types) don't pollute. */
function onlyDuplicates(p: NormProject, options = {}): Diagnostic[] {
  const report = new SemanticValidator(undefined, ALL_RULES).validate(p, {
    only: new Set([DiagnosticCode.DuplicateNodeId]),
    ...options
  });
  return report.diagnostics;
}

describe('SUB-012 duplicate-node-id', () => {
  it('is registered and enabled by default', () => {
    expect(ALL_RULES.indexOf(duplicateNodeId)).toBe(0); // leads: every later rule resolves by id
    expect(duplicateNodeId.defaultEnabled).toBe(true);
    expect(duplicateNodeId.code).toBe(DiagnosticCode.DuplicateNodeId);
  });

  describe('within one component', () => {
    const p = project([
      {
        name: '/#Home',
        nodes: [
          node('root', 'Group', { children: ['dup', 'dup'] }),
          node('dup', 'Text', { label: 'First', parent: 'root' }),
          node('dup', 'Text', { label: 'Second', parent: 'root' })
        ]
      }
    ]);

    it('reports an error for the collision', () => {
      const found = onlyDuplicates(p);
      expect(found.length).toBeGreaterThan(0);
      expect(found.every((d) => d.severity === 'error')).toBe(true);
    });

    it('reports BOTH offending nodes — the collision is caught during indexing, not from the map', () => {
      // A `Map<id, node>` retains one entry for "dup"; two diagnostics prove the
      // rule read the flat node array before any map could swallow the second.
      const found = onlyDuplicates(p);
      expect(found.length).toBe(2);
      expect(found[0].location.nodeId).toBe('dup');
      expect(found[1].location.nodeId).toBe('dup');
    });

    it('names both nodes and the component path in the message', () => {
      const d = onlyDuplicates(p)[0];
      expect(d.location.component).toBe('/#Home');
      expect(d.message).toContain('"dup"');
      expect(d.message).toContain('Text "First"');
      expect(d.message).toContain('Text "Second"');
    });

    it('catches a three-way collision, reporting every occurrence', () => {
      const three = project([
        {
          name: '/#Home',
          nodes: [node('x', 'Group', { label: 'A' }), node('x', 'Group', { label: 'B' }), node('x', 'Group', { label: 'C' })]
        }
      ]);
      const found = onlyDuplicates(three);
      expect(found.length).toBe(3);
      expect(found[0].message).toContain('3 nodes in this component share it');
      expect(found[0].severity).toBe('error');
    });
  });

  describe('across two components', () => {
    const p = project([
      { name: '/#Home', nodes: [node('shared', 'Group')] },
      { name: '/Pages/About', nodes: [node('shared', 'Group')] }
    ]);

    it('warns (not errors) by default — real projects do this and still work', () => {
      const found = onlyDuplicates(p);
      expect(found.length).toBe(1); // one per colliding id, not per occurrence
      expect(found[0].severity).toBe('warning');
      expect(found[0].message).toContain('/#Home');
      expect(found[0].message).toContain('/Pages/About');
    });

    it('promotes to error under --strict, where global uniqueness should hold', () => {
      const found = onlyDuplicates(p, { strict: true });
      expect(found.length).toBe(1);
      expect(found[0].severity).toBe('error');
    });
  });

  describe('clean projects', () => {
    it('says nothing when every id is distinct', () => {
      const p = project([
        { name: '/#Home', nodes: [node('a', 'Group'), node('b', 'Text')] },
        { name: '/Pages/About', nodes: [node('c', 'Group')] }
      ]);
      expect(onlyDuplicates(p)).toEqual([]);
    });

    it('does not confuse a repeated id with a repeated *child reference*', () => {
      // One node listed twice in a children array is a different defect
      // (orphanedNode's territory); this rule only counts real node entries.
      const p = project([{ name: '/#Home', nodes: [node('root', 'Group', { children: ['a', 'a'] }), node('a', 'Text')] }]);
      expect(onlyDuplicates(p)).toEqual([]);
    });
  });
});
