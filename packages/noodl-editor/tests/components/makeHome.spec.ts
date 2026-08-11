import { UndoQueue } from '@noodl-models/undo-queue-model';

import {
  findExportRootNode,
  makeComponentHome
} from '../../src/editor/src/views/panels/ComponentsPanelNew/hooks/useComponentActions';

/**
 * "Make Home" — the components-panel gesture that points the project's root node
 * at a component.
 *
 * It shipped inert. `UndoActionGroup.push` advances the group's pointer to the
 * end of its action list and `do()` runs *from* the pointer forward, so the
 * handler's `push({do, undo})` + `do()` recorded an undo entry and executed
 * nothing. Nothing in the editor noticed: the menu entry closed its menu, the
 * undo queue grew, and the root stayed exactly where it was. The failure is only
 * visible one step away — a project whose home component has been deleted shows
 * "No HOME component selected" in the preview, tells the user to click **Make
 * home**, and clicking it changes nothing.
 *
 * These specs drive the model half directly, which is why it was split out of
 * the React hook: the defect lives entirely in the undo bookkeeping and the
 * root-node lookup, neither of which needs a rendered tree to be wrong.
 *
 * Jasmine, not Jest — the editor suite runs inside Electron.
 */

/** The narrow slice of `ProjectModel` that `makeComponentHome` touches. */
function fakeProject(rootNode: TSFixme, canBeDelete = { canBeDelete: true } as TSFixme) {
  return {
    rootNode,
    setRootNode(node: TSFixme) {
      this.rootNode = node;
    },
    getRootNode() {
      return this.rootNode;
    },
    deleteComponentAllowed() {
      return canBeDelete;
    }
  } as TSFixme;
}

function fakeComponent(name: string, roots: TSFixme[]) {
  return {
    name,
    localName: name.split('/').pop(),
    graph: { roots }
  } as TSFixme;
}

const VISUAL_ROOT = { id: 'group-1', type: { allowAsExportRoot: true } } as TSFixme;
const LOGIC_ROOT = { id: 'inputs-1', type: { allowAsExportRoot: false } } as TSFixme;

describe('Make Home', () => {
  let originalQueue: UndoQueue;

  beforeEach(() => {
    // A private queue per spec — the editor's is a singleton, and leaning on it
    // here would make these order-dependent.
    originalQueue = UndoQueue.instance;
    UndoQueue.instance = new UndoQueue();
  });

  afterEach(() => {
    UndoQueue.instance = originalQueue;
  });

  it('sets the project root when the project has no home component', () => {
    // The reported case: the home component was deleted, so there is no root at
    // all, and a newly created visual component is being promoted to home.
    const project = fakeProject(null);
    const component = fakeComponent('/MyApp', [VISUAL_ROOT]);

    const result = makeComponentHome(project, component);

    expect(result.ok).toBe(true);
    expect(project.getRootNode()).toBe(VISUAL_ROOT);
  });

  it('sets the project root when replacing an existing home component', () => {
    const previous = { id: 'old-root', type: { allowAsExportRoot: true } };
    const project = fakeProject(previous);

    makeComponentHome(project, fakeComponent('/MyApp', [VISUAL_ROOT]));

    expect(project.getRootNode()).toBe(VISUAL_ROOT);
  });

  it('records an undo that restores the previous root node', () => {
    const previous = { id: 'old-root', type: { allowAsExportRoot: true } };
    const project = fakeProject(previous);

    makeComponentHome(project, fakeComponent('/MyApp', [VISUAL_ROOT]));
    expect(project.getRootNode()).toBe(VISUAL_ROOT);

    UndoQueue.instance.undo();

    expect(project.getRootNode()).toBe(previous);
  });

  it('undoes back to no home component at all', () => {
    // `null`, not "the first exportable node of whatever used to be home" — the
    // project genuinely had no root, and undo has to be able to say so.
    const project = fakeProject(null);

    makeComponentHome(project, fakeComponent('/MyApp', [VISUAL_ROOT]));
    UndoQueue.instance.undo();

    expect(project.getRootNode()).toBe(null);
  });

  it('refuses, with a reason, a component that has no node able to be an export root', () => {
    // A logic component's roots are Component Inputs/Outputs. `setRootComponent`
    // would have returned silently here, which is the second way this gesture
    // could do nothing.
    const project = fakeProject(null);

    const result = makeComponentHome(project, fakeComponent('/Helper', [LOGIC_ROOT]));

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Helper');
    expect(project.getRootNode()).toBe(null);
  });

  it('refuses, with the project\'s own reason, a component the project will not reassign', () => {
    const project = fakeProject(null, { canBeDelete: false, reason: "Home component can't be deleted" });

    const result = makeComponentHome(project, fakeComponent('/MyApp', [VISUAL_ROOT]));

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Home component can't be deleted");
    expect(project.getRootNode()).toBe(null);
  });

  it('finds the first exportable root, ignoring nodes that cannot be one', () => {
    expect(findExportRootNode(fakeComponent('/Mixed', [LOGIC_ROOT, VISUAL_ROOT]))).toBe(VISUAL_ROOT);
    expect(findExportRootNode(fakeComponent('/Empty', []))).toBeUndefined();
  });
});
