/**
 * FIX-025 — a lesson condition that names a node by label could only ever find it
 * if the node was a graph ROOT.
 *
 * Reported by Richard against the shipped "State on a page" lesson: its last step asks
 * the learner to drag a second Text onto the page and label it `Caption`, and grades it
 * with `{"node": "/#__page__/Home:#Caption", "hasType": "Text"}`. He did exactly that —
 * the node is in the project file on disk, `"type": "Text", "label": "Caption"` — and the
 * step never completed.
 *
 * 🔴 A node dragged ONTO A PAGE becomes a CHILD of the `Page` node, and `findNodeWithPath`
 * searched `component.graph.roots` only. So the grammar could not express "the Caption
 * somewhere on this page", which is the only thing a lesson author ever means.
 */
import { findNodeWithPath, type LessonComponent, type LessonNode } from '../../src/editor/src/views/lessons/lessonevalconditions';

function node(id: string, type: string, label?: string, children: LessonNode[] = []): LessonNode {
  return {
    id,
    label: label as string,
    type: { name: type },
    ports: [],
    parameters: {},
    children,
    getPort: () => undefined,
    forAllConnectionsOnThisNode: () => undefined
  };
}

/** The real shape of the shipped lesson's Home page: one `Page` root, everything else under it. */
function homePage(): LessonComponent[] {
  return [
    {
      name: '/#__page__/Home',
      graph: {
        roots: [
          node('page-1', 'Page', undefined, [
            node('text-1', 'Text'),
            node('caption-1', 'Text', 'Caption'),
            node('var-1', 'Variable')
          ])
        ]
      }
    }
  ];
}

describe('findNodeWithPath descends into children', () => {
  it('🔴 finds a labelled node nested under the Page — the shipped lesson\'s last step', () => {
    const found = findNodeWithPath('/#__page__/Home:#Caption', homePage());
    expect(found?.id).toBe('caption-1');
  });

  it('finds a nested node by type', () => {
    expect(findNodeWithPath('/#__page__/Home:%Variable', homePage())?.id).toBe('var-1');
  });

  it('still resolves a root directly', () => {
    expect(findNodeWithPath('/#__page__/Home:%Page', homePage())?.id).toBe('page-1');
  });

  it('still returns undefined for a label that is nowhere in the component', () => {
    expect(findNodeWithPath('/#__page__/Home:#Nope', homePage())).toBeUndefined();
  });

  it('an explicit parent:child path still works', () => {
    expect(findNodeWithPath('/#__page__/Home:%Page:#Caption', homePage())?.id).toBe('caption-1');
  });
});
