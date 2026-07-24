/**
 * STYLE-005: Unit tests for StyleAnalyzer
 *
 * Tests:
 * - toSuggestions — pure conversion, ordering, message format
 * - analyzeProject — repeated colour/spacing detection, threshold, var() skipping
 * - analyzeNode — per-node variant candidate detection
 *
 * ProjectModel.instance is monkey-patched per test; restored in afterEach.
 *
 * Converted from Jest to the Electron/Jasmine suite by DEBT-005 (2026-07-25):
 * the Jest import is gone (Jasmine provides the globals) and toHaveLength
 * became .length checks. These specs had never executed before that.
 */

import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { StyleAnalyzer } from '../../src/editor/src/services/StyleAnalyzer/StyleAnalyzer';
import { SUGGESTION_THRESHOLDS, type StyleAnalysisResult } from '../../src/editor/src/services/StyleAnalyzer/types';

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Build a minimal mock node for the analyzer. */
function makeNode(id: string, typename: string, parameters: Record<string, string>) {
  return { id, typename, parameters };
}

/**
 * The specs patch ProjectModel._instance (the private slot) rather than the
 * public `instance` setter: the setter unregisters/registers the value as a
 * NodeLibrary module, which a plain mock object cannot survive. Discovered by
 * DEBT-005 when these specs ran for the first time — the original Jest
 * versions would have failed identically.
 */
function setProjectInstance(value: unknown) {
  (ProjectModel as unknown as { _instance: unknown })._instance = value;
}

/**
 * Build a mock ProjectModel.instance with components containing the given nodes.
 * Supports multiple components if needed (pass array of node arrays).
 */
function makeMockProject(nodeGroups: ReturnType<typeof makeNode>[][]) {
  return {
    getComponents: () =>
      nodeGroups.map((nodes) => ({
        forEachNode: (fn: (node: ReturnType<typeof makeNode>) => void) => {
          nodes.forEach(fn);
        }
      })),
    findNodeWithId: (id: string) => {
      for (const nodes of nodeGroups) {
        const found = nodes.find((n) => n.id === id);
        if (found) return found;
      }
      return undefined;
    }
  };
}

// ─── toSuggestions ────────────────────────────────────────────────────────────

describe('StyleAnalyzer.toSuggestions', () => {
  it('returns empty array for empty result', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [],
      repeatedSpacing: [],
      variantCandidates: []
    };
    expect(StyleAnalyzer.toSuggestions(result)).toEqual([]);
  });

  it('converts repeated-color to suggestion with correct id and type', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [
        {
          value: '#3b82f6',
          count: 4,
          elements: [],
          suggestedTokenName: '--color-3b82f6'
        }
      ],
      repeatedSpacing: [],
      variantCandidates: []
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    expect(suggestions.length).toBe(1);
    expect(suggestions[0].type).toBe('repeated-color');
    expect(suggestions[0].id).toBe('repeated-color:#3b82f6');
    expect(suggestions[0].acceptLabel).toBe('Create Token');
    expect(suggestions[0].message).toContain('#3b82f6');
    expect(suggestions[0].message).toContain('4 elements');
  });

  it('converts repeated-spacing to suggestion — uses "Switch to Token" when matchingToken present', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [],
      repeatedSpacing: [
        {
          value: '16px',
          count: 5,
          elements: [],
          suggestedTokenName: '--spacing-16px',
          matchingToken: '--spacing-4'
        }
      ],
      variantCandidates: []
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    expect(suggestions[0].type).toBe('repeated-spacing');
    expect(suggestions[0].acceptLabel).toBe('Switch to Token');
    expect(suggestions[0].message).toContain('--spacing-4');
  });

  it('converts repeated-spacing without matchingToken — uses "Create Token"', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [],
      repeatedSpacing: [
        {
          value: '24px',
          count: 3,
          elements: [],
          suggestedTokenName: '--spacing-24px'
        }
      ],
      variantCandidates: []
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    expect(suggestions[0].acceptLabel).toBe('Create Token');
  });

  it('converts variant-candidate to suggestion with correct type and id', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [],
      repeatedSpacing: [],
      variantCandidates: [
        {
          nodeId: 'node-1',
          nodeLabel: 'Button',
          nodeType: 'net.noodl.controls.button',
          overrideCount: 4,
          overrides: { backgroundColor: '#22c55e', color: '#fff', borderRadius: '9999px', padding: '12px' },
          suggestedVariantName: 'custom'
        }
      ]
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    expect(suggestions[0].type).toBe('variant-candidate');
    expect(suggestions[0].id).toBe('variant-candidate:node-1');
    expect(suggestions[0].acceptLabel).toBe('Save as Variant');
    expect(suggestions[0].message).toContain('4 custom values');
  });

  it('orders repeated-color suggestions by count descending', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [
        { value: '#aaaaaa', count: 3, elements: [], suggestedTokenName: '--color-aaa' },
        { value: '#bbbbbb', count: 7, elements: [], suggestedTokenName: '--color-bbb' },
        { value: '#cccccc', count: 5, elements: [], suggestedTokenName: '--color-ccc' }
      ],
      repeatedSpacing: [],
      variantCandidates: []
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    const counts = suggestions.map((s) => s.repeatedValue!.count);
    expect(counts).toEqual([7, 5, 3]);
  });

  it('orders variant candidates by override count descending', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [],
      repeatedSpacing: [],
      variantCandidates: [
        { nodeId: 'a', nodeLabel: 'A', nodeType: 'Group', overrideCount: 3, overrides: {}, suggestedVariantName: 'c' },
        { nodeId: 'b', nodeLabel: 'B', nodeType: 'Group', overrideCount: 8, overrides: {}, suggestedVariantName: 'c' },
        { nodeId: 'c', nodeLabel: 'C', nodeType: 'Group', overrideCount: 5, overrides: {}, suggestedVariantName: 'c' }
      ]
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    const counts = suggestions.map((s) => s.variantCandidate!.overrideCount);
    expect(counts).toEqual([8, 5, 3]);
  });

  it('colors come before spacing come before variants in output order', () => {
    const result: StyleAnalysisResult = {
      repeatedColors: [{ value: '#ff0000', count: 3, elements: [], suggestedTokenName: '--color-ff0000' }],
      repeatedSpacing: [{ value: '8px', count: 3, elements: [], suggestedTokenName: '--spacing-8px' }],
      variantCandidates: [
        { nodeId: 'x', nodeLabel: 'X', nodeType: 'Group', overrideCount: 3, overrides: {}, suggestedVariantName: 'c' }
      ]
    };
    const suggestions = StyleAnalyzer.toSuggestions(result);
    expect(suggestions[0].type).toBe('repeated-color');
    expect(suggestions[1].type).toBe('repeated-spacing');
    expect(suggestions[2].type).toBe('variant-candidate');
  });
});

// ─── analyzeProject ───────────────────────────────────────────────────────────

describe('StyleAnalyzer.analyzeProject', () => {
  let originalInstance: unknown;

  beforeEach(() => {
    originalInstance = (ProjectModel as unknown as { _instance: unknown })._instance;
  });

  afterEach(() => {
    setProjectInstance(originalInstance);
  });

  it('returns empty result when ProjectModel.instance is null', () => {
    setProjectInstance(null);
    const result = StyleAnalyzer.analyzeProject();
    expect(result.repeatedColors.length).toBe(0);
    expect(result.repeatedSpacing.length).toBe(0);
    expect(result.variantCandidates.length).toBe(0);
  });

  it('detects repeated colour above threshold (3+)', () => {
    const nodes = [
      makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n2', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n3', 'Group', { backgroundColor: '#3b82f6' })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    expect(result.repeatedColors.length).toBe(1);
    expect(result.repeatedColors[0].value).toBe('#3b82f6');
    expect(result.repeatedColors[0].count).toBe(3);
    expect(result.repeatedColors[0].elements.length).toBe(3);
  });

  it('does NOT report repeated colour below threshold (<3)', () => {
    const nodes = [
      makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n2', 'Group', { backgroundColor: '#3b82f6' })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    expect(result.repeatedColors.length).toBe(0);
  });

  it('skips CSS var() token references', () => {
    const nodes = [
      makeNode('n1', 'Group', { backgroundColor: 'var(--primary)' }),
      makeNode('n2', 'Group', { backgroundColor: 'var(--primary)' }),
      makeNode('n3', 'Group', { backgroundColor: 'var(--primary)' })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    // var() references must never appear in repeated values
    expect(result.repeatedColors.length).toBe(0);
  });

  it('detects repeated spacing value above threshold', () => {
    const nodes = [
      makeNode('n1', 'Group', { paddingTop: '16px' }),
      makeNode('n2', 'Group', { paddingTop: '16px' }),
      makeNode('n3', 'Group', { paddingTop: '16px' })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    expect(result.repeatedSpacing.length).toBe(1);
    expect(result.repeatedSpacing[0].value).toBe('16px');
    expect(result.repeatedSpacing[0].count).toBe(3);
  });

  it('detects variant candidate when node has 3+ non-token overrides', () => {
    const nodes = [
      makeNode('n1', 'net.noodl.controls.button', {
        backgroundColor: '#22c55e',
        color: '#ffffff',
        borderRadius: '9999px'
        // exactly SUGGESTION_THRESHOLDS.variantCandidateMinOverrides
      })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    expect(result.variantCandidates.length).toBe(1);
    expect(result.variantCandidates[0].nodeId).toBe('n1');
    expect(result.variantCandidates[0].overrideCount).toBe(3);
  });

  it('does NOT report variant candidate below threshold', () => {
    const nodes = [
      makeNode('n1', 'net.noodl.controls.button', {
        backgroundColor: '#22c55e',
        color: '#ffffff'
        // only 2 overrides — below threshold of 3
      })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    expect(result.variantCandidates.length).toBe(0);
  });

  it('counts each occurrence across multiple nodes', () => {
    const nodes = [
      makeNode('n1', 'Group', { backgroundColor: '#ff0000' }),
      makeNode('n2', 'Group', { backgroundColor: '#ff0000' }),
      makeNode('n3', 'Group', { backgroundColor: '#ff0000' }),
      makeNode('n4', 'Group', { backgroundColor: '#ff0000' }),
      makeNode('n5', 'Group', { backgroundColor: '#ff0000' })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const result = StyleAnalyzer.analyzeProject();
    expect(result.repeatedColors[0].count).toBe(5);
  });

  it('matches repeated value to existing token via tokenModel', () => {
    const nodes = [
      makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n2', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n3', 'Group', { backgroundColor: '#3b82f6' })
    ];
    setProjectInstance(makeMockProject([nodes]));

    const mockTokenModel = {
      getTokens: () => [{ name: '--brand-primary' }],
      resolveToken: (name: string) => (name === '--brand-primary' ? '#3b82f6' : undefined)
    };

    const result = StyleAnalyzer.analyzeProject({ tokenModel: mockTokenModel });
    expect(result.repeatedColors[0].matchingToken).toBe('--brand-primary');
  });

  it('reports SUGGESTION_THRESHOLDS values as expected', () => {
    expect(SUGGESTION_THRESHOLDS.repeatedValueMinCount).toBe(3);
    expect(SUGGESTION_THRESHOLDS.variantCandidateMinOverrides).toBe(3);
  });
});

// ─── analyzeNode ──────────────────────────────────────────────────────────────

describe('StyleAnalyzer.analyzeNode', () => {
  let originalInstance: unknown;

  beforeEach(() => {
    originalInstance = (ProjectModel as unknown as { _instance: unknown })._instance;
  });

  afterEach(() => {
    setProjectInstance(originalInstance);
  });

  it('returns empty when ProjectModel.instance is null', () => {
    setProjectInstance(null);
    const result = StyleAnalyzer.analyzeNode('any-id');
    expect(result.variantCandidates.length).toBe(0);
  });

  it('returns empty when node not found', () => {
    setProjectInstance(makeMockProject([[]]));
    const result = StyleAnalyzer.analyzeNode('nonexistent');
    expect(result.variantCandidates.length).toBe(0);
  });

  it('returns variant candidate for node with 3+ non-token overrides', () => {
    const node = makeNode('btn-1', 'net.noodl.controls.button', {
      backgroundColor: '#22c55e',
      color: '#ffffff',
      borderRadius: '9999px',
      fontSize: '14px'
    });
    setProjectInstance(makeMockProject([[node]]));

    const result = StyleAnalyzer.analyzeNode('btn-1');
    expect(result.variantCandidates.length).toBe(1);
    expect(result.variantCandidates[0].nodeId).toBe('btn-1');
    expect(result.variantCandidates[0].overrideCount).toBe(4);
  });

  it('returns empty for node with fewer than threshold overrides', () => {
    const node = makeNode('btn-2', 'net.noodl.controls.button', {
      backgroundColor: '#22c55e',
      color: '#ffffff'
      // 2 overrides — below threshold
    });
    setProjectInstance(makeMockProject([[node]]));

    const result = StyleAnalyzer.analyzeNode('btn-2');
    expect(result.variantCandidates.length).toBe(0);
  });

  it('ignores var() token references when counting overrides', () => {
    const node = makeNode('btn-3', 'net.noodl.controls.button', {
      backgroundColor: 'var(--primary)', // token — not counted
      color: 'var(--text-on-primary)', // token — not counted
      borderRadius: '9999px', // raw
      fontSize: '14px', // raw
      paddingTop: '12px' // raw
    });
    setProjectInstance(makeMockProject([[node]]));

    const result = StyleAnalyzer.analyzeNode('btn-3');
    // Only 3 raw overrides count — should hit threshold exactly
    expect(result.variantCandidates.length).toBe(1);
    expect(result.variantCandidates[0].overrideCount).toBe(3);
  });
});
