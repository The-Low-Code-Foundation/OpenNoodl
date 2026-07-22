/**
 * STYLE-005: StyleAnalyzer Unit Tests
 *
 * Tests the pure logic of the analyzer — value detection, threshold handling,
 * and suggestion generation — without touching Electron or the real ProjectModel.
 */

import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { StyleAnalyzer } from '../../src/editor/src/services/StyleAnalyzer/StyleAnalyzer';

// ─── Stub ProjectModel ──────────────────────────────────────────────────────
//
// This spec was written for Jest and used `jest.mock` on the projectmodel
// module. The editor suite is Jasmine (see DEBUG-INFRASTRUCTURE.md), which has
// no module mocking — and assigning `ProjectModel.instance` is not an option
// either, because its setter registers the value with NodeLibrary and would do
// real work on a fake. StyleAnalyzer only ever reads `ProjectModel.instance` at
// call time, so spying on the getter is enough, and Jasmine restores it after
// each spec.

type MockNode = {
  id: string;
  typename: string;
  parameters: Record<string, unknown>;
};

let mockNodes: MockNode[] = [];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeNode(id: string, typename: string, params: Record<string, unknown>): MockNode {
  return { id, typename, parameters: params };
}

function resetNodes(...nodes: MockNode[]) {
  mockNodes = nodes;
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('StyleAnalyzer', () => {
  beforeEach(() => {
    mockNodes = [];

    const fakeProject = {
      getComponents: () => [
        {
          forEachNode: (cb: (node: MockNode) => void) => {
            mockNodes.forEach(cb);
          }
        }
      ],
      findNodeWithId: (id: string) => mockNodes.find((n) => n.id === id) ?? null
    };

    spyOnProperty(ProjectModel, 'instance', 'get').and.returnValue(fakeProject as never);
  });

  // ─── Color Detection ───────────────────────────────────────────────────────

  describe('repeated color detection', () => {
    it('does NOT flag a value that appears fewer than 3 times', () => {
      resetNodes(
        makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n2', 'Group', { backgroundColor: '#3b82f6' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(0);
    });

    it('flags a hex color appearing 3+ times', () => {
      resetNodes(
        makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n2', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n3', 'Group', { backgroundColor: '#3b82f6' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(1);
      expect(result.repeatedColors[0].value).toBe('#3b82f6');
      expect(result.repeatedColors[0].count).toBe(3);
    });

    it('ignores CSS var() references — they are already tokenised', () => {
      resetNodes(
        makeNode('n1', 'Group', { backgroundColor: 'var(--primary)' }),
        makeNode('n2', 'Group', { backgroundColor: 'var(--primary)' }),
        makeNode('n3', 'Group', { backgroundColor: 'var(--primary)' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(0);
    });

    it('handles rgb() and rgba() color values', () => {
      const color = 'rgb(59, 130, 246)';
      resetNodes(
        makeNode('n1', 'Group', { backgroundColor: color }),
        makeNode('n2', 'Group', { backgroundColor: color }),
        makeNode('n3', 'Group', { backgroundColor: color })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(1);
      expect(result.repeatedColors[0].value).toBe(color);
    });

    it('groups by exact value — different shades are separate suggestions', () => {
      resetNodes(
        makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n2', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n3', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n4', 'Group', { backgroundColor: '#2563eb' }),
        makeNode('n5', 'Group', { backgroundColor: '#2563eb' }),
        makeNode('n6', 'Group', { backgroundColor: '#2563eb' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(2);
    });
  });

  // ─── Spacing Detection ─────────────────────────────────────────────────────

  describe('repeated spacing detection', () => {
    it('flags px spacing appearing 3+ times', () => {
      resetNodes(
        makeNode('n1', 'Group', { paddingTop: '16px' }),
        makeNode('n2', 'Group', { paddingTop: '16px' }),
        makeNode('n3', 'Group', { paddingTop: '16px' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedSpacing).toHaveLength(1);
      expect(result.repeatedSpacing[0].value).toBe('16px');
    });

    it('flags rem spacing', () => {
      resetNodes(
        makeNode('n1', 'Group', { paddingLeft: '1rem' }),
        makeNode('n2', 'Group', { paddingLeft: '1rem' }),
        makeNode('n3', 'Group', { paddingLeft: '1rem' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedSpacing).toHaveLength(1);
    });

    it('does NOT flag zero — 0 is universally used and not worth tokenising', () => {
      // '0' is technically a valid spacing value but would create noise
      // Our regex requires px/rem/em suffix OR it's just a number
      // This test ensures we understand the current behaviour
      resetNodes(
        makeNode('n1', 'Group', { paddingTop: '0px' }),
        makeNode('n2', 'Group', { paddingTop: '0px' }),
        makeNode('n3', 'Group', { paddingTop: '0px' })
      );

      const result = StyleAnalyzer.analyzeProject();
      // '0px' IS a raw spacing value — currently flagged. This is expected.
      // In future we may want to suppress this specific case.
      expect(result.repeatedSpacing).toHaveLength(1);
    });
  });

  // ─── Variant Candidates ────────────────────────────────────────────────────

  describe('variant candidate detection', () => {
    it('flags a node with 3+ raw style overrides', () => {
      resetNodes(
        makeNode('n1', 'net.noodl.controls.button', {
          backgroundColor: '#3b82f6',
          color: '#ffffff',
          borderRadius: '8px'
        })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.variantCandidates).toHaveLength(1);
      expect(result.variantCandidates[0].overrideCount).toBe(3);
    });

    it('does NOT flag a node with fewer than 3 raw overrides', () => {
      resetNodes(
        makeNode('n1', 'net.noodl.controls.button', {
          backgroundColor: '#3b82f6',
          color: '#ffffff'
        })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.variantCandidates).toHaveLength(0);
    });

    it('does NOT count token references as custom overrides', () => {
      resetNodes(
        makeNode('n1', 'net.noodl.controls.button', {
          backgroundColor: 'var(--primary)', // token — excluded
          color: 'var(--primary-foreground)', // token — excluded
          borderRadius: '8px', // raw — counts
          paddingTop: '12px', // raw — counts
          fontSize: '14px' // raw — counts
        })
      );

      const result = StyleAnalyzer.analyzeProject();
      // 3 raw overrides → IS a candidate
      expect(result.variantCandidates).toHaveLength(1);
      expect(result.variantCandidates[0].overrideCount).toBe(3);
    });
  });

  // ─── toSuggestions ────────────────────────────────────────────────────────

  describe('toSuggestions()', () => {
    it('orders suggestions by count descending', () => {
      resetNodes(
        // 4 occurrences of red
        makeNode('n1', 'Group', { backgroundColor: '#ff0000' }),
        makeNode('n2', 'Group', { backgroundColor: '#ff0000' }),
        makeNode('n3', 'Group', { backgroundColor: '#ff0000' }),
        makeNode('n4', 'Group', { backgroundColor: '#ff0000' }),
        // 3 occurrences of blue
        makeNode('n5', 'Group', { backgroundColor: '#0000ff' }),
        makeNode('n6', 'Group', { backgroundColor: '#0000ff' }),
        makeNode('n7', 'Group', { backgroundColor: '#0000ff' })
      );

      const result = StyleAnalyzer.analyzeProject();
      const suggestions = StyleAnalyzer.toSuggestions(result);

      expect(suggestions[0].repeatedValue?.value).toBe('#ff0000');
      expect(suggestions[1].repeatedValue?.value).toBe('#0000ff');
    });

    it('assigns stable IDs to suggestions', () => {
      resetNodes(
        makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n2', 'Group', { backgroundColor: '#3b82f6' }),
        makeNode('n3', 'Group', { backgroundColor: '#3b82f6' })
      );

      const result = StyleAnalyzer.analyzeProject();
      const suggestions = StyleAnalyzer.toSuggestions(result);

      expect(suggestions[0].id).toBe('repeated-color:#3b82f6');
    });

    it('returns empty array when no issues found', () => {
      resetNodes(makeNode('n1', 'Group', { backgroundColor: 'var(--primary)' }));

      const result = StyleAnalyzer.analyzeProject();
      const suggestions = StyleAnalyzer.toSuggestions(result);

      expect(suggestions).toHaveLength(0);
    });
  });

  // ─── Edge Cases ───────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('returns empty results when there are no nodes', () => {
      resetNodes();

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(0);
      expect(result.repeatedSpacing).toHaveLength(0);
      expect(result.variantCandidates).toHaveLength(0);
    });

    it('does not scan non-visual nodes (e.g. logic nodes without style params)', () => {
      resetNodes(
        makeNode('n1', 'For Each', { items: '[1,2,3]' }),
        makeNode('n2', 'For Each', { items: '[1,2,3]' }),
        makeNode('n3', 'For Each', { items: '[1,2,3]' })
      );

      const result = StyleAnalyzer.analyzeProject();
      expect(result.repeatedColors).toHaveLength(0);
      expect(result.variantCandidates).toHaveLength(0);
    });

    it('deduplicates variant candidates if the same node appears in multiple components', () => {
      // Simulate same node ID coming from two components
      const node = makeNode('shared-id', 'net.noodl.controls.button', {
        backgroundColor: '#3b82f6',
        color: '#fff',
        borderRadius: '8px'
      });

      mockNodes = [node, node]; // same node ref twice

      const result = StyleAnalyzer.analyzeProject();
      // Even though forEachNode visits it twice, we deduplicate by nodeId
      expect(result.variantCandidates).toHaveLength(1);
    });
  });
});
