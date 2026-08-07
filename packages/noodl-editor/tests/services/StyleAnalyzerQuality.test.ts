/**
 * PLAT-005: suggestion-QUALITY specs for the StyleAnalyzer.
 *
 * The two pre-existing StyleAnalyzer suites (tests/models and this directory's
 * StyleAnalyzer.test.ts) assert that detection *fires* — thresholds, ordering,
 * message format. Neither asks whether what it fires is worth showing a user.
 * The banner is live in the property panel, so every false positive is on
 * screen; these specs pin the noise floor and the correctness of the names the
 * analyzer proposes.
 *
 * Fixture-driven on purpose: the task could not run a live editor pass from a
 * worktree, so the fixtures below stand in for the shapes a real project
 * produces (numeric parameters, four-sided padding on one node, zeroes).
 */

import { ProjectModel } from '../../src/editor/src/models/projectmodel';
import { StyleAnalyzer } from '../../src/editor/src/services/StyleAnalyzer/StyleAnalyzer';
import {
  isRawSpacingValue,
  isTokenisableSpacingValue,
  suggestTokenName,
  suggestVariantName
} from '../../src/editor/src/services/StyleAnalyzer/StyleAnalyzerCore';

type MockNode = { id: string; typename: string; parameters: Record<string, unknown> };

let mockNodes: MockNode[] = [];

function makeNode(id: string, typename: string, params: Record<string, unknown>): MockNode {
  return { id, typename, parameters: params };
}

function useNodes(...nodes: MockNode[]) {
  mockNodes = nodes;
}

// ─── Value classification ─────────────────────────────────────────────────────

describe('PLAT-005 StyleAnalyzer — tokenisable spacing', () => {
  it('keeps isRawSpacingValue broad — the AI raw-vs-token counter depends on it', () => {
    // styleLint.countStyleValues asks "is this a literal?", not "is it worth a
    // token?". Narrowing the broad predicate would silently change the AIX-002
    // measurement, so the noise filter is a separate function.
    expect(isRawSpacingValue('0px')).toBe(true);
    expect(isRawSpacingValue('1')).toBe(true);
    expect(isRawSpacingValue('16px')).toBe(true);
  });

  it('rejects zero in every unit', () => {
    expect(isTokenisableSpacingValue('0')).toBe(false);
    expect(isTokenisableSpacingValue('0px')).toBe(false);
    expect(isTokenisableSpacingValue('0rem')).toBe(false);
    expect(isTokenisableSpacingValue('0.0px')).toBe(false);
  });

  it('rejects unitless numbers — substituting var() there would break a numeric port', () => {
    expect(isTokenisableSpacingValue('1')).toBe(false);
    expect(isTokenisableSpacingValue('24')).toBe(false);
    expect(isTokenisableSpacingValue('-3')).toBe(false);
  });

  it('accepts ordinary spacing literals', () => {
    expect(isTokenisableSpacingValue('16px')).toBe(true);
    expect(isTokenisableSpacingValue('1.5rem')).toBe(true);
    expect(isTokenisableSpacingValue('50%')).toBe(true);
    expect(isTokenisableSpacingValue('-8px')).toBe(true);
  });

  it('still rejects token references and nonsense', () => {
    expect(isTokenisableSpacingValue('var(--space-4)')).toBe(false);
    expect(isTokenisableSpacingValue('auto')).toBe(false);
    expect(isTokenisableSpacingValue('')).toBe(false);
  });
});

// ─── Token names ──────────────────────────────────────────────────────────────

describe('PLAT-005 suggestTokenName — distinct values keep distinct names', () => {
  it('does not collapse 1.5rem onto 15rem', () => {
    // The old implementation DELETED every non-[A-Za-z0-9-] character, so both
    // of these became '--spacing-15rem'. Accepting the second suggestion
    // overwrote the first token's value underneath the nodes already using it.
    const a = suggestTokenName('1.5rem', 'paddingTop');
    const b = suggestTokenName('15rem', 'paddingTop');
    expect(a).not.toBe(b);
    expect(a).toBe('--spacing-1-5rem');
    expect(b).toBe('--spacing-15rem');
  });

  it('does not collapse a percentage onto a bare number', () => {
    expect(suggestTokenName('50%', 'width')).not.toBe(suggestTokenName('50', 'width'));
    expect(suggestTokenName('50%', 'width')).toBe('--spacing-50pct');
  });

  it('keeps the established hex form', () => {
    expect(suggestTokenName('#3b82f6', 'backgroundColor')).toBe('--color-3b82f6');
  });

  it('produces a readable name for rgb() rather than a run-on', () => {
    expect(suggestTokenName('rgb(59, 130, 246)', 'backgroundColor')).toBe('--color-rgb-59-130-246');
  });

  it('classifies by value when the property is not in the colour bucket', () => {
    expect(suggestTokenName('#ffffff', 'someUnknownProp').startsWith('--color-')).toBe(true);
  });
});

// ─── Variant names ────────────────────────────────────────────────────────────

describe('PLAT-005 suggestVariantName — no longer "custom" for everything', () => {
  it('derives from the node label', () => {
    expect(suggestVariantName('Sign up', { backgroundColor: '#3b82f6' })).toBe('sign-up-custom');
  });

  it('uses the last segment of a dotted typename when the node is unlabelled', () => {
    // nodeLabel falls back to the typename, and 'net-noodl-controls-b'
    // (the old 20-char slug) was not a name anyone would choose.
    expect(suggestVariantName('net.noodl.controls.button', {})).toBe('button-custom');
  });

  it('no longer returns bare "custom" merely because backgroundColor is raw', () => {
    // Every candidate used to collide on this one name: the first accept
    // created the variant, and every later accept hit createNewVariant's
    // silent "already exists" return.
    const a = suggestVariantName('Primary CTA', { backgroundColor: '#22c55e' });
    const b = suggestVariantName('Danger button', { backgroundColor: '#ef4444' });
    expect(a).not.toBe(b);
    expect(a).not.toBe('custom');
  });

  it('falls back to "custom" when there is nothing usable', () => {
    expect(suggestVariantName('', {})).toBe('custom');
    expect(suggestVariantName('!!!', {})).toBe('custom');
  });
});

// ─── End-to-end noise floor ───────────────────────────────────────────────────

describe('PLAT-005 StyleAnalyzer — noise floor on realistic fixtures', () => {
  beforeEach(() => {
    mockNodes = [];
    const fakeProject = {
      getComponents: () => [
        {
          forEachNode: (cb: (node: MockNode) => void) => mockNodes.forEach(cb)
        }
      ],
      findNodeWithId: (id: string) => mockNodes.find((n) => n.id === id) ?? null
    };
    spyOnProperty(ProjectModel, 'instance', 'get').and.returnValue(fakeProject as never);
  });

  it('does not suggest a token for zeroed margins across a layout', () => {
    useNodes(
      makeNode('n1', 'Group', { marginTop: '0px', marginBottom: '0px' }),
      makeNode('n2', 'Group', { marginTop: '0px', marginBottom: '0px' }),
      makeNode('n3', 'Group', { marginTop: '0px', marginBottom: '0px' })
    );
    expect(StyleAnalyzer.analyzeProject().repeatedSpacing).toHaveSize(0);
  });

  it('does not suggest a token for numeric border widths', () => {
    // Noodl stores plenty of parameters as numbers; scanNode stringifies them,
    // so `borderWidth: 1` used to arrive as the raw spacing value "1".
    useNodes(
      makeNode('n1', 'Group', { borderWidth: 1 }),
      makeNode('n2', 'Group', { borderWidth: 1 }),
      makeNode('n3', 'Group', { borderWidth: 1 })
    );
    expect(StyleAnalyzer.analyzeProject().repeatedSpacing).toHaveSize(0);
  });

  it('one node with four matching paddings is one element, not four', () => {
    // The threshold is 3 elements. This fixture is a single node, so it must
    // not produce a suggestion — it used to, reporting "used in 4 elements".
    useNodes(
      makeNode('only', 'Group', {
        paddingTop: '16px',
        paddingRight: '16px',
        paddingBottom: '16px',
        paddingLeft: '16px'
      })
    );
    expect(StyleAnalyzer.analyzeProject().repeatedSpacing).toHaveSize(0);
  });

  it('reports distinct elements in count and total hits in occurrences', () => {
    useNodes(
      makeNode('n1', 'Group', { paddingTop: '16px', paddingBottom: '16px' }),
      makeNode('n2', 'Group', { paddingTop: '16px' }),
      makeNode('n3', 'Group', { paddingTop: '16px' })
    );
    const [spacing] = StyleAnalyzer.analyzeProject().repeatedSpacing;
    expect(spacing.count).toBe(3);
    expect(spacing.occurrences).toBe(4);
  });

  it('the banner message matches the element count it claims', () => {
    useNodes(
      makeNode('n1', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n2', 'Group', { backgroundColor: '#3b82f6' }),
      makeNode('n3', 'Group', { backgroundColor: '#3b82f6' })
    );
    const result = StyleAnalyzer.analyzeProject();
    const [suggestion] = StyleAnalyzer.toSuggestions(result);
    expect(suggestion.message).toContain('3 elements');
  });

  it('a genuinely repeated colour is still suggested — the filters are not a blanket mute', () => {
    useNodes(
      makeNode('n1', 'Group', { backgroundColor: '#3b82f6', paddingTop: '24px' }),
      makeNode('n2', 'Group', { backgroundColor: '#3b82f6', paddingTop: '24px' }),
      makeNode('n3', 'Group', { backgroundColor: '#3b82f6', paddingTop: '24px' })
    );
    const result = StyleAnalyzer.analyzeProject();
    expect(result.repeatedColors).toHaveSize(1);
    expect(result.repeatedSpacing).toHaveSize(1);
  });

  it('zeroes and unitless numbers no longer inflate a node into a variant candidate', () => {
    useNodes(
      makeNode('btn', 'net.noodl.controls.button', {
        marginTop: '0px',
        marginBottom: '0px',
        borderWidth: 1
      })
    );
    // Three "raw overrides" by the old rules; zero real design decisions.
    expect(StyleAnalyzer.analyzeProject().variantCandidates).toHaveSize(0);
  });

  it('a genuinely over-styled node is still a variant candidate, with a usable name', () => {
    useNodes(
      makeNode('btn', 'net.noodl.controls.button', {
        label: 'Sign up',
        backgroundColor: '#22c55e',
        color: '#ffffff',
        borderRadius: '9999px'
      })
    );
    const [candidate] = StyleAnalyzer.analyzeProject().variantCandidates;
    expect(candidate.overrideCount).toBe(3);
    expect(candidate.suggestedVariantName).toBe('sign-up-custom');
  });
});
