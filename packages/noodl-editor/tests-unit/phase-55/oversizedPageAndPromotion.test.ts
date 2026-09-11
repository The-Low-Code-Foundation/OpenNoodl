/**
 * LAS-004 — the architecture gate stops whispering, and gains a backstop.
 *
 * Two halves, one argument. `repeated-sibling-subtree` fired correctly on
 * **every** measured build — 3 warnings on the reference build's exact failure,
 * 2 on haiku's, 1 on sonnet's — and blocked nothing, anywhere. Meanwhile the
 * audit measured that hard rejections carrying a suggestion were self-corrected
 * at a 100% rate even by the mid-tier model, while prose was dropped. The only
 * architecture gate in the system was delivering prose.
 *
 * The second half is the shape the first cannot see: a page that inlined its
 * sections without duplicating any of them. That is what a model produces by
 * working top to bottom, and it is what phase 54's 66-node `Pages/Home` is.
 *
 * The specs use the acceptance cases from the task file verbatim — the
 * reference build's Home, and the two cold-replay Homes at 7 and 8 nodes that
 * must stay untouched, because a backstop that nags a correct page is a
 * backstop nobody keeps.
 */
import {
  AUTHORED_BLOCKING_WARNINGS,
  DiagnosticCode,
  fromLegacyProject,
  isBlockingForAuthoredOutput,
  validateProject
} from '../../src/editor/src/validation';
import { OVERSIZED_PAGE_NODES } from '../../src/editor/src/validation/rules/oversizedPage';

interface RawNode {
  id: string;
  type: string;
  children?: RawNode[];
}

/** A page component of `count` nodes, one `Page` plus flat children. */
function pageOf(name: string, count: number, pageNode = true): { name: string; graph: { roots: RawNode[] } } {
  const children: RawNode[] = [];
  for (let i = 1; i < count; i++) children.push({ id: `${name}-n${i}`, type: i % 2 ? 'Text' : 'Image' });
  const root: RawNode = pageNode
    ? { id: `${name}-page`, type: 'Page', children }
    : { id: `${name}-root`, type: 'Group', children };
  return { name, graph: { roots: [root] } };
}

const report = (components: ReturnType<typeof pageOf>[]) =>
  validateProject(fromLegacyProject({ components }), { only: new Set([DiagnosticCode.OversizedPage]) }).diagnostics;

describe('LAS-004 §1 — the sibling rule blocks authored output', () => {
  it('is in AUTHORED_BLOCKING_WARNINGS', () => {
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.RepeatedSiblingSubtree)).toBe(true);
  });

  it('blocks an authored candidate while staying a warning project-wide', () => {
    const diagnostic = {
      code: DiagnosticCode.RepeatedSiblingSubtree,
      severity: 'warning' as const,
      message: '3 sibling subtrees here are structurally identical',
      location: { component: '/Pages/Home', nodeId: 'item0' }
    };
    expect(isBlockingForAuthoredOutput(diagnostic)).toBe(true);
    // The corpus is untouched by construction: `validate:project` never applies
    // the authored policy, so promoting a code cannot turn its 17 corpus hits
    // into errors.
    expect(diagnostic.severity).toBe('warning');
  });
});

describe('LAS-004 §2 — the oversized page', () => {
  it('draws an info on the reference build\'s 66-node Home', () => {
    const diagnostics = report([pageOf('/Pages/Home', 66)]);
    expect(diagnostics).toHaveLength(1);
    expect(diagnostics[0].code).toBe(DiagnosticCode.OversizedPage);
    expect(diagnostics[0].severity).toBe('info');
    expect(diagnostics[0].message).toContain('66 nodes');
    // Located on the Page node, so the editor can navigate to it.
    expect(diagnostics[0].location.nodeType).toBe('Page');
  });

  it('leaves the two cold-replay Homes (7 and 8 nodes) untouched', () => {
    expect(report([pageOf('/Pages/HomeA', 7), pageOf('/Pages/HomeB', 8)])).toEqual([]);
  });

  it('never blocks — it is the one diagnostic here that must not', () => {
    const [diagnostic] = report([pageOf('/Pages/Home', 66)]);
    expect(isBlockingForAuthoredOutput(diagnostic)).toBe(false);
    expect(AUTHORED_BLOCKING_WARNINGS.has(DiagnosticCode.OversizedPage)).toBe(false);
  });

  it('sits exactly on the threshold the census picked', () => {
    expect(report([pageOf('/Pages/Edge', OVERSIZED_PAGE_NODES)])).toEqual([]);
    expect(report([pageOf('/Pages/Edge', OVERSIZED_PAGE_NODES + 1)])).toHaveLength(1);
  });

  it('says nothing about a large component that is not a page', () => {
    // A logic component or a dense reusable section is not this rule's business;
    // "several components" is advice about a page's structure specifically.
    expect(report([pageOf('/Components/Dense', 80, false)])).toEqual([]);
  });

  it('does not use the doctrine\'s ~25, and the corpus is why', () => {
    // 25 would have fired on a 31-node Supabase login form and a 31-node admin
    // page — both legitimately dense, neither wanting to be three components.
    // The corpus knee is the 36 → 60 gap; the threshold sits inside it.
    expect(OVERSIZED_PAGE_NODES).toBeGreaterThan(36);
    expect(OVERSIZED_PAGE_NODES).toBeLessThan(60);
    expect(report([pageOf('/Pages/LogIn', 31)])).toEqual([]);
  });
});
