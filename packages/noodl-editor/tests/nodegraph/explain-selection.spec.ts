import { NodeGraphContextTmp } from '@noodl-contexts/NodeGraphContext/NodeGraphContext';

import { SidebarModel } from '@noodl-models/sidebar';

import { panelHoldsCanvasSelection } from '../../src/editor/src/views/nodegrapheditor/EditorEventBindings';
import { SelectionActions } from '../../src/editor/src/views/nodegrapheditor/SelectionActions';
import { ExplainPanel_ID } from '../../src/editor/src/views/panels/ExplainPanel';
import {
  forgetTarget,
  rememberTarget,
  rememberedTarget
} from '../../src/editor/src/views/panels/ExplainPanel/explainTarget';

/**
 * FH-008 — "Explain this node" could never hold a node.
 *
 * Two mechanisms, one symptom. Opening the Explain panel ran the deselect that
 * `EditorEventBindings` performs for every panel outside a small allow-list, so
 * the selection was gone before the panel could read it; and the memo that was
 * built to survive that deselect was never cleared, so clicking empty canvas
 * left the panel still offering to explain a node nobody was pointing at.
 *
 * What jasmine can pin is the policy: who may hold a selection, and when the
 * memo is armed and dropped. The panel's own "re-read when it becomes visible"
 * is a React effect on a `display: none` panel — only the running editor shows
 * that one.
 */
describe('FH-008 — the Explain panel and the canvas selection', () => {
  describe('which panels may hold the selection', () => {
    it('lets Explain hold it — the whole point of the panel', () => {
      expect(panelHoldsCanvasSelection(ExplainPanel_ID)).toBe(true);
    });

    it('still lets the node panels hold it, as before', () => {
      expect(panelHoldsCanvasSelection('PropertyEditor')).toBe(true);
      expect(panelHoldsCanvasSelection('PortEditor')).toBe(true);
    });

    it('still clears it for panels that have no use for one', () => {
      expect(panelHoldsCanvasSelection('components')).toBe(false);
      expect(panelHoldsCanvasSelection('search')).toBe(false);
    });
  });

  describe('the remembered target', () => {
    let restoreGraph: () => void;

    /** The one thing `rememberedTarget` reads: which component is open. */
    function openComponent(fullName: string | null) {
      NodeGraphContextTmp.nodeGraph = (fullName ? { activeComponent: { fullName } } : null) as never;
    }

    beforeEach(() => {
      const previous = NodeGraphContextTmp.nodeGraph;
      restoreGraph = () => {
        NodeGraphContextTmp.nodeGraph = previous;
      };
      forgetTarget();
    });

    afterEach(() => {
      forgetTarget();
      restoreGraph();
    });

    it('remembers what was pointed at in the open component', () => {
      openComponent('/Main');
      rememberTarget('/Main', ['node-a']);
      expect(rememberedTarget()).toEqual({ componentName: '/Main', nodeIds: ['node-a'] });
    });

    it('remembers a multi-selection, not just the first node', () => {
      openComponent('/Main');
      rememberTarget('/Main', ['node-a', 'node-b', 'node-c']);
      expect(rememberedTarget()?.nodeIds).toEqual(['node-a', 'node-b', 'node-c']);
    });

    it('refuses a target from a component the user has navigated away from', () => {
      openComponent('/Main');
      rememberTarget('/Main', ['node-a']);
      openComponent('/Other');
      expect(rememberedTarget()).toBeNull();
    });

    it('forgets on request', () => {
      openComponent('/Main');
      rememberTarget('/Main', ['node-a']);
      forgetTarget();
      expect(rememberedTarget()).toBeNull();
    });

    it('treats an empty selection as nothing remembered', () => {
      openComponent('/Main');
      rememberTarget('/Main', []);
      expect(rememberedTarget()).toBeNull();
    });

    it('holds a copy, so a later mutation of the caller’s array cannot reach it', () => {
      openComponent('/Main');
      const ids = ['node-a'];
      rememberTarget('/Main', ids);
      ids.push('node-b');
      expect(rememberedTarget()?.nodeIds).toEqual(['node-a']);
    });
  });

  describe('deselecting the canvas', () => {
    let restoreSidebar: () => void;
    let restoreGraph: () => void;

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
      const previousSidebar = (SidebarModel as never as { instance: unknown }).instance;
      (SidebarModel as never as { instance: unknown }).instance = { hidePanels: () => undefined };
      restoreSidebar = () => {
        (SidebarModel as never as { instance: unknown }).instance = previousSidebar;
      };

      const previousGraph = NodeGraphContextTmp.nodeGraph;
      restoreGraph = () => {
        NodeGraphContextTmp.nodeGraph = previousGraph;
      };
      NodeGraphContextTmp.nodeGraph = { activeComponent: { fullName: '/Main' } } as never;
    });

    afterEach(() => {
      forgetTarget();
      restoreSidebar();
      restoreGraph();
    });

    it('drops the remembered target — a stale node can never be explained', () => {
      rememberTarget('/Main', ['node-a']);
      new SelectionActions(fakeEditor(false)).deselect();
      expect(rememberedTarget()).toBeNull();
    });

    it('leaves it alone for a read-only editor, which is not the user’s canvas', () => {
      rememberTarget('/Main', ['node-a']);
      new SelectionActions(fakeEditor(true)).deselect();
      expect(rememberedTarget()).toEqual({ componentName: '/Main', nodeIds: ['node-a'] });
    });
  });
});
