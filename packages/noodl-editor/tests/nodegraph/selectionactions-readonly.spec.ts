import { SidebarModel } from '@noodl-models/sidebar';

import { SelectionActions } from '../../src/editor/src/views/nodegrapheditor/SelectionActions';

/**
 * A read-only node graph must not drive the app's chrome.
 *
 * `SelectionActions.deselect` hides the sidebar panels — correct for the app's
 * own canvas, and destructive for the read-only editors that documents create
 * for themselves (the change review, the version-control diff, the authoring
 * preview). Hiding the sidebar from one of those closes the panel whose
 * `onOpen` handler reopens the *editor* document, which unmounts the document
 * that asked.
 *
 * Found live on 2026-08-02: clicking any row in the AIX-003 change rail, or
 * "Walk through", navigated the app straight back to the editor document. The
 * route in is `switchToComponent(component, { node })`, which calls
 * `clearSelection()` before it selects — so it needs no user gesture on the
 * canvas at all, which is why every other read-only guard in that file missed
 * it.
 */
describe('SelectionActions — a read-only editor leaves the sidebar alone', () => {
  let hidePanelsCalls: number;
  let restoreSidebar: () => void;

  /** The slice of NodeGraphEditor that `deselect` actually touches. */
  function fakeEditor(readOnly: boolean) {
    return {
      readOnly,
      commentLayer: { clearMultiselection: () => undefined },
      selector: { unselect: () => undefined },
      notifyListeners: () => undefined
    } as never;
  }

  beforeEach(() => {
    hidePanelsCalls = 0;
    const instance = (SidebarModel as never as { instance: unknown }).instance;
    const previous = instance;
    (SidebarModel as never as { instance: unknown }).instance = {
      hidePanels: () => {
        hidePanelsCalls++;
      }
    };
    restoreSidebar = () => {
      (SidebarModel as never as { instance: unknown }).instance = previous;
    };
  });

  afterEach(() => restoreSidebar());

  it('does not hide the panels when the editor is read-only', () => {
    new SelectionActions(fakeEditor(true)).deselect();
    expect(hidePanelsCalls).toBe(0);
  });

  it('still hides the panels for the app’s own editable canvas', () => {
    new SelectionActions(fakeEditor(false)).deselect();
    expect(hidePanelsCalls).toBe(1);
  });

  it('honours disableHidePanels on an editable canvas, as before', () => {
    new SelectionActions(fakeEditor(false)).deselect({ disableHidePanels: true });
    expect(hidePanelsCalls).toBe(0);
  });
});
