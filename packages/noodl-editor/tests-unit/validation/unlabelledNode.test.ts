/**
 * LEG-002 — the diagnostic, pointed the other way.
 *
 * Phase 50's README specced a label rule that **blocks authored output** and
 * merely advises hand-built graphs. The corpus inverts it: agents label at
 * 89.3% (12 phase-55/58 model runs, 1,126 nodes) and humans at 20.3% (58
 * `library/` prefabs and modules, 1,333 nodes), so that gate would fire on the
 * one population that already complies and stay silent on the one that does
 * not. `unlabelled-node` therefore ships **advisory in both directions**.
 *
 * The first describe below is the acceptance criterion that matters most, and
 * it is a *tripwire*, not a description: a later edit to
 * `AUTHORED_BLOCKING_WARNINGS` must not be able to promote this code quietly.
 * `isBlockingForAuthoredOutput` is `severity === 'error' || SET.has(code)`, so
 * both halves are asserted.
 *
 * The rest pin the predicate the corpus chose, because *non-trivial* was
 * undefined and the whole task depended on it. Every unlabelled node is 4,426
 * of the corpus's 5,509; the shipped predicate is 214, of which 25 are in
 * `library/` and 9 across the model runs.
 */
import {
  AUTHORED_BLOCKING_WARNINGS,
  DiagnosticCode,
  fromLegacyProject,
  isBlockingForAuthoredOutput,
  validateProject,
  type Diagnostic
} from '../../src/editor/src/validation';
import { MIN_NAMELESS_SIBLINGS } from '../../src/editor/src/validation/rules/unlabelledNode';

interface RawNode {
  id: string;
  type: string;
  label?: string;
  children?: RawNode[];
}
interface RawConnection {
  fromId: string;
  fromProperty: string;
  toId: string;
  toProperty: string;
}

function report(roots: RawNode[], connections: RawConnection[] = []): Diagnostic[] {
  return validateProject(fromLegacyProject({ components: [{ name: '/Pages/Home', graph: { roots, connections } }] }), {
    only: new Set([DiagnosticCode.UnlabelledNode])
  }).diagnostics;
}

/** A container: `n` sibling groups, the first `named` of them labelled. */
function siblingGroups(n: number, named = 0, type = 'Group'): RawNode[] {
  const kids: RawNode[] = [];
  for (let i = 0; i < n; i++) {
    kids.push({
      id: `sib${i}`,
      type,
      ...(i < named ? { label: `Section ${i}` } : {}),
      children: [{ id: `leaf${i}`, type: 'Text' }]
    });
  }
  return [{ id: 'root', type: 'Group', label: 'Page body', children: kids }];
}

// ── The acceptance criterion: it can never become a gate by accident ─────────

describe('LEG-002 §2/§4 — advisory in both directions', () => {
  it('is not in AUTHORED_BLOCKING_WARNINGS', () => {
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.UnlabelledNode)).toBe(false);
  });

  it('does not block an authored submission', () => {
    const [diagnostic] = report(siblingGroups(3));
    expect(diagnostic).toBeDefined();
    expect(isBlockingForAuthoredOutput(diagnostic)).toBe(false);
  });

  it('is never emitted above info severity, so --warnings-as-errors cannot promote it either', () => {
    for (const d of report(siblingGroups(6))) expect(d.severity).toBe('info');
  });

  it('adds nothing to a report\'s error or warning counts', () => {
    const project = fromLegacyProject({ components: [{ name: '/Pages/Home', graph: { roots: siblingGroups(6) } }] });
    const withRule = validateProject(project, { only: new Set([DiagnosticCode.UnlabelledNode]) });
    expect(withRule.diagnostics.length).toBeGreaterThan(0);
    expect(withRule.summary.errors).toBe(0);
    expect(withRule.summary.warnings).toBe(0);
  });
});

// ── The predicate the corpus chose ──────────────────────────────────────────

describe('LEG-002 §3 — a run of nameless siblings', () => {
  it(`reports each of ${MIN_NAMELESS_SIBLINGS} nameless sibling containers`, () => {
    const diagnostics = report(siblingGroups(MIN_NAMELESS_SIBLINGS));
    expect(diagnostics).toHaveLength(MIN_NAMELESS_SIBLINGS);
  });

  it('says nothing about two — a pair of boxes is a pair, not a wall', () => {
    expect(report(siblingGroups(2))).toHaveLength(0);
  });

  it('says nothing when the siblings are named', () => {
    expect(report(siblingGroups(6, 6))).toHaveLength(0);
  });

  it('counts only the nameless ones: 4 siblings with 1 named is still a wall of 3', () => {
    const diagnostics = report(siblingGroups(4, 1));
    expect(diagnostics).toHaveLength(3);
    expect(diagnostics.map((d) => d.location.nodeId).sort()).toEqual(['sib1', 'sib2', 'sib3']);
  });

  it('falls silent as soon as fewer than three are nameless', () => {
    expect(report(siblingGroups(4, 2))).toHaveLength(0);
  });

  it('is scoped to one parent: three nameless Groups spread over three parents are not a run', () => {
    const roots: RawNode[] = [0, 1, 2].map((i) => ({
      id: `p${i}`,
      type: 'Group',
      label: `Parent ${i}`,
      children: [{ id: `sib${i}`, type: 'Group', children: [{ id: `leaf${i}`, type: 'Text' }] }]
    }));
    expect(report(roots)).toHaveLength(0);
  });

  it('is scoped to one type: a Group, an Image and a Text side by side are not a run', () => {
    const roots: RawNode[] = [
      {
        id: 'root',
        type: 'Group',
        label: 'Body',
        children: [
          { id: 'a', type: 'Group', children: [{ id: 'a1', type: 'Text' }] },
          { id: 'b', type: 'Image', children: [{ id: 'b1', type: 'Text' }] },
          { id: 'c', type: 'Text', children: [{ id: 'c1', type: 'Text' }] }
        ]
      }
    ];
    expect(report(roots)).toHaveLength(0);
  });
});

describe('LEG-002 §3 — the junction clause', () => {
  it('says nothing about a run of nameless leaves — the content is the name', () => {
    const roots: RawNode[] = [
      {
        id: 'root',
        type: 'Group',
        label: 'Copy block',
        children: [0, 1, 2, 3].map((i) => ({ id: `t${i}`, type: 'Text' }))
      }
    ];
    expect(report(roots)).toHaveLength(0);
  });

  it('says nothing about a leaf with a single outgoing wire — it is read in one hop', () => {
    const roots: RawNode[] = [
      { id: 'root', type: 'Group', label: 'Logic', children: [0, 1, 2].map((i) => ({ id: `c${i}`, type: 'Condition' })) },
      { id: 'sink', type: 'Text' }
    ];
    const connections = [0, 1, 2].map((i) => ({
      fromId: `c${i}`,
      fromProperty: 'result',
      toId: 'sink',
      toProperty: 'text'
    }));
    expect(report(roots, connections)).toHaveLength(0);
  });

  it('reports a childless node that fans out to more than one endpoint', () => {
    const roots: RawNode[] = [
      { id: 'root', type: 'Group', label: 'Logic', children: [0, 1, 2].map((i) => ({ id: `c${i}`, type: 'Condition' })) },
      { id: 'sinkA', type: 'Text' },
      { id: 'sinkB', type: 'Text' }
    ];
    const connections: RawConnection[] = [];
    for (const i of [0, 1, 2]) {
      connections.push({ fromId: `c${i}`, fromProperty: 'result', toId: 'sinkA', toProperty: 'text' });
      connections.push({ fromId: `c${i}`, fromProperty: 'result', toId: 'sinkB', toProperty: 'text' });
    }
    expect(report(roots, connections)).toHaveLength(3);
  });
});

describe('LEG-002 §3 — the two skip lists', () => {
  it('says nothing about a type whose identity is its own explanation', () => {
    const roots: RawNode[] = [
      {
        id: 'root',
        type: 'Group',
        label: 'Body',
        children: [0, 1, 2].map((i) => ({
          id: `ci${i}`,
          type: 'Component Inputs',
          children: [{ id: `x${i}`, type: 'Text' }]
        }))
      }
    ];
    expect(report(roots)).toHaveLength(0);
  });

  it('says nothing about a type the canvas already names from one of its parameters', () => {
    // `usePortAsLabel: 'expression'` — the canvas shows `Expression 'a + b'`,
    // so the node is named and telling it it is nameless would be a lie. Worth
    // 12 of the corpus's hits.
    const roots: RawNode[] = [
      {
        id: 'root',
        type: 'Group',
        label: 'Body',
        children: [0, 1, 2].map((i) => ({ id: `e${i}`, type: 'Expression', children: [{ id: `x${i}`, type: 'Text' }] }))
      }
    ];
    expect(report(roots)).toHaveLength(0);
  });
});

describe('LEG-002 acceptance — the ProblemsPanel row', () => {
  const [diagnostic] = report(siblingGroups(3));

  it('names the node it is about, so the row navigates to it', () => {
    expect(diagnostic.location.component).toBe('/Pages/Home');
    expect(diagnostic.location.nodeId).toBe('sib0');
    expect(diagnostic.location.nodeType).toBe('Group');
    // Not having one is the entire finding; a label in the location would be a
    // small lie in the row's second line.
    expect(diagnostic.location.nodeLabel).toBeUndefined();
  });

  it('reads as advice rather than as a problem', () => {
    expect(diagnostic.severity).toBe('info');
    expect(diagnostic.message).toContain('Advice, not a problem');
    expect(diagnostic.message).toContain('the graph renders exactly as it is');
  });

  it('says how many siblings and where, so the reader can see the wall without opening the graph', () => {
    expect(diagnostic.message).toContain('3 sibling Group nodes');
    expect(diagnostic.message).toContain('“Page body”');
  });

  it('carries no suggestion — a rejection repaired by "write a better sentence" invites `Group 3`', () => {
    expect(diagnostic.suggestion).toBeUndefined();
  });
});
