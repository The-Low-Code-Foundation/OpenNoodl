import type { ComponentModel } from '@noodl-models/componentmodel';
import type { NodeGraphNode } from '@noodl-models/nodegraphmodel';
import type { ProjectModel } from '@noodl-models/projectmodel';
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

/**
 * The doubles are typed structurally rather than as `TSFixme`, so a spec that
 * stops matching the shape under test fails at `typecheck:editor-tests` instead
 * of at whatever the runtime does with the wrong object. Only the hand-off to the
 * real signatures is cast, and it goes through `unknown` — these are deliberately
 * *narrow slices*, not partial `ProjectModel`s.
 */
interface FakeRoot {
  id: string;
  type: { allowAsExportRoot: boolean };
}

interface FakeProject {
  rootNode: FakeRoot | null;
  setRootNode(node: FakeRoot | null): void;
  getRootNode(): FakeRoot | null;
  deleteComponentAllowed(): DeleteVerdict;
}

interface FakeComponent {
  name: string;
  localName: string | undefined;
  graph: { roots: FakeRoot[] };
}

/** `deleteComponentAllowed`'s answer: may this component be reassigned, and why not. */
interface DeleteVerdict {
  canBeDelete: boolean;
  reason?: string;
}

/** The narrow slice of `ProjectModel` that `makeComponentHome` touches. */
function fakeProject(rootNode: FakeRoot | null, canBeDelete: DeleteVerdict = { canBeDelete: true }): FakeProject {
  return {
    rootNode,
    setRootNode(node: FakeRoot | null) {
      this.rootNode = node;
    },
    getRootNode() {
      return this.rootNode;
    },
    deleteComponentAllowed() {
      return canBeDelete;
    }
  };
}

function fakeComponent(name: string, roots: FakeRoot[]): FakeComponent {
  return {
    name,
    localName: name.split('/').pop(),
    graph: { roots }
  };
}

/** The two casts every spec needs, named once so the intent is not retyped. */
const asProject = (p: FakeProject) => p as unknown as ProjectModel;
const asComponent = (c: FakeComponent) => c as unknown as ComponentModel;

const VISUAL_ROOT: FakeRoot = { id: 'group-1', type: { allowAsExportRoot: true } };
const LOGIC_ROOT: FakeRoot = { id: 'inputs-1', type: { allowAsExportRoot: false } };

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

    const result = makeComponentHome(asProject(project), asComponent(component));

    expect(result.ok).toBe(true);
    expect(project.getRootNode()).toBe(VISUAL_ROOT);
  });

  it('sets the project root when replacing an existing home component', () => {
    const previous = { id: 'old-root', type: { allowAsExportRoot: true } };
    const project = fakeProject(previous);

    makeComponentHome(asProject(project), asComponent(fakeComponent('/MyApp', [VISUAL_ROOT])));

    expect(project.getRootNode()).toBe(VISUAL_ROOT);
  });

  it('records an undo that restores the previous root node', () => {
    const previous = { id: 'old-root', type: { allowAsExportRoot: true } };
    const project = fakeProject(previous);

    makeComponentHome(asProject(project), asComponent(fakeComponent('/MyApp', [VISUAL_ROOT])));
    expect(project.getRootNode()).toBe(VISUAL_ROOT);

    UndoQueue.instance.undo();

    expect(project.getRootNode()).toBe(previous);
  });

  it('undoes back to no home component at all', () => {
    // `null`, not "the first exportable node of whatever used to be home" — the
    // project genuinely had no root, and undo has to be able to say so.
    const project = fakeProject(null);

    makeComponentHome(asProject(project), asComponent(fakeComponent('/MyApp', [VISUAL_ROOT])));
    UndoQueue.instance.undo();

    expect(project.getRootNode()).toBe(null);
  });

  it('refuses, with a reason, a component that has no node able to be an export root', () => {
    // A logic component's roots are Component Inputs/Outputs. `setRootComponent`
    // would have returned silently here, which is the second way this gesture
    // could do nothing.
    const project = fakeProject(null);

    const result = makeComponentHome(asProject(project), asComponent(fakeComponent('/Helper', [LOGIC_ROOT])));

    expect(result.ok).toBe(false);
    expect(result.reason).toContain('Helper');
    expect(project.getRootNode()).toBe(null);
  });

  it('refuses, with the project\'s own reason, a component the project will not reassign', () => {
    const project = fakeProject(null, { canBeDelete: false, reason: "Home component can't be deleted" });

    const result = makeComponentHome(asProject(project), asComponent(fakeComponent('/MyApp', [VISUAL_ROOT])));

    expect(result.ok).toBe(false);
    expect(result.reason).toBe("Home component can't be deleted");
    expect(project.getRootNode()).toBe(null);
  });

  it('finds the first exportable root, ignoring nodes that cannot be one', () => {
    // Identity, not shape: the function must return *that* root object, so the
    // expected value crosses the same boundary the argument did.
    expect(findExportRootNode(asComponent(fakeComponent('/Mixed', [LOGIC_ROOT, VISUAL_ROOT])))).toBe(
      VISUAL_ROOT as unknown as NodeGraphNode
    );
    expect(findExportRootNode(asComponent(fakeComponent('/Empty', [])))).toBeUndefined();
  });
});
