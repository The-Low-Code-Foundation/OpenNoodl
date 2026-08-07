/**
 * A page whose content is not parented to its `Page` node renders blank, and
 * used to validate clean.
 *
 * Found on `Puppy test 3`'s AI-authored Admin page: `page-4` (the `Page`) had
 * **zero** children, while a Group labelled "Page Root" carried all twenty
 * content nodes as a second, parallel visual root. The page rendered nothing.
 * `validate_project` reported 0 errors and 0 warnings, so the plan applied and
 * the build reported success. Only the running preview said anything, as a soft
 * per-node warning ("detached from the main node tree").
 *
 * The rule is exercised directly rather than through `SemanticValidator`: it is
 * pure structure and needs no catalog, which keeps this in `tests-unit/` (and so
 * in `test:main`) instead of the Electron suite.
 */

import { detachedPageContent } from '../../src/editor/src/validation/rules/detachedPageContent';
import { DiagnosticCode } from '../../src/editor/src/validation/diagnostics';
import type { NormNode } from '../../src/editor/src/validation/model';
import type { RuleContext } from '../../src/editor/src/validation/rules/types';

function node(id: string, type: string, extra: Partial<NormNode> = {}): NormNode {
  return { id, type, children: [], instancePorts: [], ...extra } as NormNode;
}

function run(nodes: NormNode[]) {
  const component = { name: '/Pages/Test', nodes, connections: [] };
  const nodeById = new Map(nodes.map((n) => [n.id, n]));
  const ctx = {
    project: { components: [component], componentRefs: {} },
    catalog: undefined,
    options: {},
    components: [{ component, nodeById }],
    counters: { nodesChecked: 0, endpointsChecked: 0 }
  } as unknown as RuleContext;
  return detachedPageContent.run(ctx);
}

describe('detached-page-content', () => {
  it('errors when a Page has no children and content sits on a second root', () => {
    const found = run([
      node('page-4', 'Page', { label: 'Admin Page' }),
      node('root-4', 'Group', { label: 'Page Root', children: ['header'] }),
      node('header', 'Group', { parent: 'root-4' })
    ]);

    expect(found).toHaveLength(1);
    expect(found[0].code).toBe(DiagnosticCode.DetachedPageContent);
    expect(found[0].severity).toBe('error');
    expect(found[0].location.nodeId).toBe('root-4');
    expect(found[0].message).toContain('renders blank');
  });

  it('(control) does not flag a page whose content hangs off the Page node', () => {
    expect(
      run([
        node('page', 'Page', { label: 'Landing', children: ['root'] }),
        node('root', 'Group', { parent: 'page', children: ['header'] }),
        node('header', 'Group', { parent: 'root' })
      ])
    ).toEqual([]);
  });

  it('(control) does not flag parentless logic nodes beside a populated Page', () => {
    // Query Records, Functions and navigation actions all sit parentless on the
    // canvas by nature. Flagging those would make the rule unusable.
    expect(
      run([
        node('page', 'Page', { children: ['root'] }),
        node('root', 'Group', { parent: 'page' }),
        node('query', 'DbCollection2'),
        node('fn', 'JavaScriptFunction')
      ])
    ).toEqual([]);
  });

  it('(control) does not flag an empty Page with no other content', () => {
    // An empty page is empty, not broken: nothing exists to have been detached.
    expect(run([node('page', 'Page'), node('query', 'DbCollection2')])).toEqual([]);
  });

  it('(control) does not flag a component that has no Page node at all', () => {
    expect(
      run([node('card', 'Group', { label: 'Card', children: ['text'] }), node('text', 'Text', { parent: 'card' })])
    ).toEqual([]);
  });
});
