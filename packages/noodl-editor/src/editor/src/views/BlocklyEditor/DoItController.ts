/**
 * LGC-002 — Do It, assembled.
 *
 * The context menu item, one balloon layer per open block editor, and the rule for when the
 * balloons go away. Everything it needs is somewhere else: the offer rule and the code
 * generation in `DoIt.ts`, the round trip in `DoItProbeClient.ts`, the SVG in
 * `DoItBalloons.ts`.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import { CanvasTheme } from '../nodegrapheditor/canvas/CanvasTheme';
import { classifyBlockForDoIt, generateFragmentForBlock, invalidatesBalloons } from './DoIt';
import { DoItBalloonLayer } from './DoItBalloons';
import { requestBlockValue } from './DoItProbeClient';

const MENU_ITEM_ID = 'noodlDoIt';

/**
 * Which workspace belongs to which node.
 *
 * Blockly's context menu registry is a **singleton**, so the item is registered once per
 * renderer and has to find its way from the clicked block back to the node behind that
 * workspace. Keyed by `workspace.id` rather than by the workspace object so a disposed
 * workspace's entry is removable by id in the teardown path.
 */
const sessions = new Map<string, DoItSession>();

let menuItemRegistered = false;

/**
 * ⚠️ **What a Do It on a block editor with no node behind it says.**
 *
 * `BlocklyWorkspace` takes its node id as a prop. Anything that mounts one without passing it
 * gets this, rather than a menu item that appears and does nothing — which is the failure mode
 * that would be reported as "Do It is broken" instead of as "this tab was opened oddly".
 */
const NO_NODE_MESSAGE =
  'This block editor is not attached to a node, so there is nothing to run the block against.';

const NOTHING_TO_EVALUATE = 'There is nothing to work out here — this block generates no code.';

class DoItSession {
  readonly workspace: Blockly.WorkspaceSvg;
  readonly nodeId: string | undefined;
  readonly balloons: DoItBalloonLayer;

  private themeContext = {};
  private changeListener: (event: Blockly.Events.Abstract) => void;

  constructor(workspace: Blockly.WorkspaceSvg, nodeId: string | undefined) {
    this.workspace = workspace;
    this.nodeId = nodeId;
    this.balloons = new DoItBalloonLayer(workspace);

    this.changeListener = (event) => {
      if (invalidatesBalloons(event)) this.balloons.dismissAll();
    };
    workspace.addChangeListener(this.changeListener);

    CanvasTheme.instance.on(() => this.balloons.refreshTheme(), this.themeContext);
  }

  /**
   * Do It on one block.
   *
   * The pending balloon goes up first, on purpose: the round trip is a socket hop and the
   * builder has to see that their right-click landed. A menu that closes onto nothing is
   * indistinguishable from a menu that did nothing.
   */
  async run(block: Blockly.BlockSvg): Promise<void> {
    const blockId = block.id;

    // Belt for the menu's braces. `preconditionFn` greys the item, but a caller reaching this
    // directly must not get an evaluation of a `set variable` block.
    // `=== false`, not `!offer.offered`: TypeScript narrows a boolean-literal discriminant on
    // an equality comparison and **not** on truthiness, so the shorter form loses `reason`.
    const offer = classifyBlockForDoIt(block);
    if (offer.offered === false) {
      this.balloons.show(blockId, { state: 'refused', text: offer.reason });
      return;
    }

    if (!this.nodeId) {
      this.balloons.show(blockId, { state: 'error', text: NO_NODE_MESSAGE });
      return;
    }

    const fragment = generateFragmentForBlock(this.workspace, block);
    if (!fragment) {
      this.balloons.show(blockId, { state: 'error', text: NOTHING_TO_EVALUATE });
      return;
    }

    this.balloons.show(blockId, { state: 'pending', text: 'asking the app…' });

    const answer = await requestBlockValue(this.nodeId, fragment.code);

    // The blocks may have changed while the socket was in flight, which dismissed every
    // balloon — including this one. Painting the answer now would put a value from the old
    // program onto the new one. `show` also no-ops on a deleted block, but this is the case
    // that matters and it deserves to be stated rather than fallen into.
    if (!this.balloons.has(blockId)) return;

    this.balloons.show(blockId, { state: answer.state, text: answer.text, note: answer.note });
  }

  dispose(): void {
    CanvasTheme.instance.off(this.themeContext);
    this.workspace.removeChangeListener(this.changeListener);
    this.balloons.dispose();
  }
}

/**
 * Register the Do It context menu item. Idempotent; the registry is a renderer-wide singleton.
 */
export function registerDoItMenuItem(): void {
  if (menuItemRegistered) return;
  // A hot reload can leave the previous module's item registered, and `register` throws on a
  // duplicate id. Registering the item is not worth taking the block editor down for.
  if (Blockly.ContextMenuRegistry.registry.getItem(MENU_ITEM_ID)) {
    menuItemRegistered = true;
    return;
  }

  Blockly.ContextMenuRegistry.registry.register({
    id: MENU_ITEM_ID,
    scopeType: Blockly.ContextMenuRegistry.ScopeType.BLOCK,
    // First on the menu. Do It is the reason a beginner opens this menu at all; Blockly's own
    // items (duplicate, comment, collapse) start at weight 1.
    weight: 0,

    /**
     * ⚠️ **`'disabled'`, never `'hidden'`.** A greyed item with a reason teaches the rule; a
     * missing item teaches nothing and reads as a bug. The reason is in the label because a
     * disabled Blockly menu item has nowhere else to put one — no tooltip, no submenu.
     */
    preconditionFn: (scope) => {
      const block = scope.block;
      if (!block) return 'hidden';
      // Not a Logic Builder workspace: some other Blockly instance in the editor.
      if (!sessions.has(block.workspace.id)) return 'hidden';

      return classifyBlockForDoIt(block).offered ? 'enabled' : 'disabled';
    },

    displayText: (scope) => {
      const block = scope.block;
      if (!block) return 'Do It';

      const offer = classifyBlockForDoIt(block);
      return offer.offered === true ? 'Do It' : 'Do It — ' + offer.reason;
    },

    callback: (scope) => {
      const block = scope.block;
      if (!block) return;

      const session = sessions.get(block.workspace.id);
      if (!session) return;

      // Fire and forget: the menu closes now and the balloon updates when the app answers.
      // `run` resolves rather than rejects for every outcome, so nothing is swallowed here.
      void session.run(block);
    }
  });

  menuItemRegistered = true;
}

export interface DoItHandle {
  dispose(): void;
  /** Test seam: the layer this workspace's balloons live on. */
  readonly balloons: DoItBalloonLayer;
}

/**
 * Turn Do It on for one open block editor.
 *
 * @param nodeId the Logic Builder node these blocks belong to. Without it the menu item still
 *   appears and still explains itself — see {@link NO_NODE_MESSAGE} — because a Do It that is
 *   simply absent is indistinguishable from one that is broken.
 */
export function attachDoIt(workspace: Blockly.WorkspaceSvg, nodeId: string | undefined): DoItHandle {
  registerDoItMenuItem();

  const existing = sessions.get(workspace.id);
  if (existing) existing.dispose();

  const session = new DoItSession(workspace, nodeId);
  sessions.set(workspace.id, session);

  return {
    balloons: session.balloons,
    dispose: () => {
      // Only if it is still ours: a re-attach on the same workspace replaced it.
      if (sessions.get(workspace.id) === session) sessions.delete(workspace.id);
      session.dispose();
    }
  };
}
