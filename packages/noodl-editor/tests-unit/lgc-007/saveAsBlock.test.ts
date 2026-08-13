/**
 * LGC-007 §1 — **the flagship path**: selected, saved, named, and dropped into a *different*
 * Visual Function, where it generates working code.
 *
 * `inliner.test.ts` already grades the *generates working code* half on the exact JavaScript.
 * This file grades the other half, and it gets closer to the acceptance line than the task file
 * assumed it could. Its claim was that a spec cannot reach the two-workspace case, because
 * `BlocklyWorkspace` injects on mount and disposes on unmount keyed by node id, so the two
 * workspaces are never alive together. That is true **of the editor**, and it is not a
 * constraint on Blockly: two headless workspaces are just two objects. What actually links them
 * is the *store*, and the store is a plain object with two shelves.
 *
 * So the round trip below is the real one, block for block:
 *
 *   1. a real Blockly workspace A holds a real program;
 *   2. the context menu item's own `callback` runs against a block in it — not a helper called
 *      in its place — and hands a request to a fake dialog;
 *   3. the fake dialog names it and commits, which is the only thing the real dialog's Save
 *      button does;
 *   4. the **flyout callback** is asked what the My Blocks category contains, which is what a
 *      builder opening the toolbox in a second node sees;
 *   5. that flyout JSON is instantiated as a **real block** in a second workspace B — the drop;
 *   6. B is serialised and generated through `generateWithMyBlocks`, and the JavaScript is
 *      asserted.
 *
 * ⚠️ **What is still owed to a drive**, and it is the gesture itself: that the item appears in a
 * rendered context menu, that the dialog paints, that a mouse drag out of the flyout lands the
 * block, and that `rebuildInputs_` survives a *rendered* workspace. Step 5 runs `rebuildInputs_`
 * for the first time anywhere, which closes the specific failure the task file flags — but
 * headless, where `removeInput` does not have to unrender anything.
 */

import * as Blockly from 'blockly';

import { initBlocklyIntegration } from '../../src/editor/src/views/BlocklyEditor/initialize';
import {
  callBlockJson,
  generateWithMyBlocks,
  initMyBlocks,
  myBlocksFlyout
} from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import {
  attachMyBlocksSave,
  canSaveBlock,
  describeBlock,
  HAT_REFUSAL,
  hasSaveSession,
  prepareSaveRequest,
  registerSaveAsBlockMenuItem,
  SAVE_MENU_ITEM_ID,
  SAVE_MENU_LABEL,
  selectionFor,
  type MyBlocksSaveHandle,
  type SaveBlockRequest
} from '../../src/editor/src/views/BlocklyEditor/MyBlocksSave';
import type { BlocklyWorkspaceJson } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { InMemoryShelf, MyBlocksStore } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { arithmetic, getInput, number, sendSignal, setOutput, workspace } from './fixtures';

/**
 * Imported rather than spelled out: `MyBlocksSave` refuses this type by name, and a spec that
 * hardcoded the string would keep passing if the two ever drifted apart.
 */
import { HAT_BLOCK_TYPE as HAT_TYPE } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

function newStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/** A live workspace holding `json`. The blocks are real; nothing here is a stand-in. */
function liveWorkspace(json: BlocklyWorkspaceJson): Blockly.Workspace {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(json as never, ws);
  return ws;
}

/** The registered menu item, as the context menu would find it. */
function menuItem() {
  registerSaveAsBlockMenuItem();
  return Blockly.ContextMenuRegistry.registry.getItem(SAVE_MENU_ITEM_ID) as never as {
    weight: number;
    preconditionFn(scope: unknown): string;
    displayText(scope: unknown): string;
    callback(scope: unknown): void;
  };
}

beforeAll(() => {
  initBlocklyIntegration();
  initMyBlocks();
});

describe('LGC-007 §1 — the context menu item', () => {
  let store: MyBlocksStore;
  let ws: Blockly.Workspace;
  let handle: MyBlocksSaveHandle;
  let opened: SaveBlockRequest[];

  beforeEach(() => {
    store = newStore();
    opened = [];
    ws = liveWorkspace(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));
    handle = attachMyBlocksSave({ workspace: ws, store, openDialog: (request) => opened.push(request) });
  });

  afterEach(() => {
    handle.dispose();
    ws.dispose();
  });

  it('is offered on a block in an attached workspace', () => {
    const block = ws.getTopBlocks(false)[0];

    expect(menuItem().preconditionFn({ block })).toBe('enabled');
    expect(menuItem().displayText({ block })).toBe(SAVE_MENU_LABEL);
  });

  it('🔴 is hidden in a workspace that is not a Logic Builder — the registry is renderer-wide', () => {
    const other = liveWorkspace(workspace(number(1)));
    try {
      expect(menuItem().preconditionFn({ block: other.getTopBlocks(false)[0] })).toBe('hidden');
    } finally {
      other.dispose();
    }
  });

  it('stops being offered once the workspace is disposed', () => {
    const id = ws.id;
    expect(hasSaveSession(id)).toBe(true);

    handle.dispose();

    expect(hasSaveSession(id)).toBe(false);
  });

  it('⚠️ is disabled and not hidden on the hat, with the reason in the label', () => {
    const hatWs = new Blockly.Workspace();
    const hatHandle = attachMyBlocksSave({ workspace: hatWs, store, openDialog: () => undefined });
    try {
      Blockly.serialization.workspaces.load(workspace({ type: HAT_TYPE }) as never, hatWs);
      const hat = hatWs.getTopBlocks(false)[0];

      // The hat has no previous connection and no output plug, so a definition rooted at one
      // could not be spliced anywhere — the inliner would hand Blockly a workspace it refuses
      // to load. A greyed item with a reason teaches that; a missing item reads as a bug.
      expect(hat.previousConnection).toBeFalsy();
      expect(menuItem().preconditionFn({ block: hat })).toBe('disabled');
      expect(menuItem().displayText({ block: hat })).toContain(HAT_REFUSAL);
      expect(canSaveBlock(hat).ok).toBe(false);
    } finally {
      hatHandle.dispose();
      hatWs.dispose();
    }
  });

  it('sits between Do It and Blockly’s own items', () => {
    // Do It is weight 0; Blockly's duplicate/comment/collapse start at 1.
    expect(menuItem().weight).toBeGreaterThan(0);
    expect(menuItem().weight).toBeLessThan(1);
  });

  it('🔴 the callback opens the dialog with the selection already measured', () => {
    menuItem().callback({ block: ws.getTopBlocks(false)[0] });

    expect(opened).toHaveLength(1);
    const request = opened[0];
    // `n ÷ 2` is three blocks and one right-click. The dialog says so because the gesture takes
    // more than the block that was clicked.
    expect(request.blockCount).toBe(3);
    expect(request.signature.shape).toBe('value');
    expect(request.defaultScope).toBe('project');
  });

  it('does nothing when the callback reaches a block it refuses', () => {
    const hatWs = new Blockly.Workspace();
    const hatHandle = attachMyBlocksSave({ workspace: hatWs, store, openDialog: (r) => opened.push(r) });
    try {
      Blockly.serialization.workspaces.load(workspace({ type: HAT_TYPE }) as never, hatWs);
      menuItem().callback({ block: hatWs.getTopBlocks(false)[0] });

      // Belt for the precondition's braces: a caller reaching the callback directly must not
      // get a dialog offering to save something that cannot be saved.
      expect(opened).toHaveLength(0);
    } finally {
      hatHandle.dispose();
      hatWs.dispose();
    }
  });
});

describe('LGC-007 §1 — what the gesture takes with it', () => {
  it('takes everything inside and stacked below the block that was clicked', () => {
    const store = newStore();
    // `set output r = n ÷ 2` followed by `send signal done`.
    const ws = liveWorkspace(
      workspace(setOutput('r', arithmetic('DIVIDE', getInput('n'), number(2)), sendSignal('done')))
    );
    try {
      const request = prepareSaveRequest(store, selectionFor(ws.getTopBlocks(false)[0]));

      expect(request.blockCount).toBe(5);
      // The signal came along, so the group is a stacking block — which is the inference doing
      // the explaining rather than us.
      expect(request.signature.shape).toBe('statement');
    } finally {
      ws.dispose();
    }
  });

  it('takes the rest of the stack when the click lands mid-stack, which is why the count is shown', () => {
    const store = newStore();
    const ws = liveWorkspace(workspace(setOutput('r', number(1), sendSignal('done'))));
    try {
      const second = ws.getTopBlocks(false)[0].getNextBlock() as Blockly.Block;
      const request = prepareSaveRequest(store, selectionFor(second));

      // Only `send signal done` — the blocks above it are not part of the group.
      expect(request.blockCount).toBe(1);
      expect(request.body.blocks!.blocks![0].type).toBe('noodl_send_signal');
    } finally {
      ws.dispose();
    }
  });

  it('offers a human rendering of the block as the name placeholder, and never as a default', () => {
    const store = newStore();
    const ws = liveWorkspace(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));
    try {
      const request = prepareSaveRequest(store, selectionFor(ws.getTopBlocks(false)[0]));

      expect(describeBlock(ws.getTopBlocks(false)[0]).length).toBeGreaterThan(0);
      expect(request.suggestedName.length).toBeGreaterThan(0);
      // A placeholder shows what is being named. A default gets committed by a builder who
      // pressed Enter, and the shelf fills with blocks called `n ÷ 2`.
      expect(request.taken).toEqual([]);
    } finally {
      ws.dispose();
    }
  });

  it('🔴 a refused write is not swallowed at the seam — the dialog has to be able to show it', () => {
    const store = newStore();
    const ws = liveWorkspace(workspace(number(1)));
    try {
      // §3 refuses a cyclic save by throwing. Whatever the store refuses, `commit` must
      // propagate: a `commit` that returned quietly would close the dialog on a save that never
      // happened, which is this feature's recurring defect wearing a different hat.
      jest.spyOn(store, 'save').mockImplementation(() => {
        throw new Error('Saved block "Alpha" uses itself.');
      });

      const request = prepareSaveRequest(store, selectionFor(ws.getTopBlocks(false)[0]));

      expect(() => request.commit({ name: 'Alpha', scope: 'project' })).toThrow('uses itself');
    } finally {
      jest.restoreAllMocks();
      ws.dispose();
    }
  });
});

describe('LGC-007 §1 — where a saved block goes', () => {
  it('commits to the project shelf, which is the one that travels in project.json', () => {
    const store = newStore();
    const ws = liveWorkspace(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));
    try {
      const request = prepareSaveRequest(store, selectionFor(ws.getTopBlocks(false)[0]));
      const definition = request.commit({ name: '  Half  ', scope: 'project' });

      expect(definition.name).toBe('Half');
      expect(store.scopeOf(definition.id)).toBe('project');
      expect(store.list('user')).toEqual([]);
    } finally {
      ws.dispose();
    }
  });

  it('commits to the backpack when that is the choice', () => {
    const store = newStore();
    const ws = liveWorkspace(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));
    try {
      const definition = prepareSaveRequest(store, selectionFor(ws.getTopBlocks(false)[0])).commit({
        name: 'Half',
        scope: 'user'
      });

      expect(store.scopeOf(definition.id)).toBe('user');
      expect(store.list('project')).toEqual([]);
    } finally {
      ws.dispose();
    }
  });

  it('runs the caller’s hook, so a flyout that is already open can be rebuilt', () => {
    const store = newStore();
    const ws = liveWorkspace(workspace(number(1)));
    try {
      const saved: string[] = [];
      prepareSaveRequest(store, selectionFor(ws.getTopBlocks(false)[0]), (d) => saved.push(d.name)).commit({
        name: 'One',
        scope: 'project'
      });

      expect(saved).toEqual(['One']);
    } finally {
      ws.dispose();
    }
  });
});

/**
 * The acceptance line, as close as a runner gets to it.
 *
 * *"Blocks selected in one Visual Function can be saved, named, and dropped into a **different**
 * Visual Function in the same project, where they generate working code."*
 */
describe('LGC-007 — saved in one Visual Function, dropped into another', () => {
  it('🔴 a value block saved in workspace A drops inside `… + 1` in workspace B and generates', () => {
    const store = newStore();

    /* --- Visual Function A: the builder right-clicks `n ÷ 2` and saves it --------------- */
    const a = liveWorkspace(workspace(arithmetic('DIVIDE', getInput('n'), number(2))));
    const opened: SaveBlockRequest[] = [];
    const handle = attachMyBlocksSave({ workspace: a, store, openDialog: (r) => opened.push(r) });

    menuItem().callback({ block: a.getTopBlocks(false)[0] });
    const definition = opened[0].commit({ name: 'Half', scope: 'project' });

    // A is closed, exactly as the editor closes it: one workspace per node, disposed on unmount.
    handle.dispose();
    a.dispose();

    expect(definition.shape).toBe('value');

    /* --- The toolbox of any other Visual Function --------------------------------------- */
    const flyout = myBlocksFlyout(store)() as { kind: string; type?: string; text?: string; extraState?: unknown }[];
    // VFN-008 §3: each definition arrives with its shape sentence above it, so the category is
    // readable without dragging anything out. The block is still there and still first of its
    // kind — this is a label *and* a block, not a label instead of one.
    const block = flyout.find((item) => item.kind === 'block')!;
    expect(flyout.some((item) => item.kind === 'label')).toBe(true);
    expect(block).toBeTruthy();
    expect(block.type).toBe('myblocks_call_value');

    /* --- Visual Function B: the block is dragged out and dropped into `… + 1` ------------ */
    const b = new Blockly.Workspace();
    try {
      // The call block is instantiated from the flyout's own JSON — which is the first time
      // `rebuildInputs_` runs anywhere.
      const dropped = Blockly.serialization.blocks.append(
        { type: block.type, extraState: block.extraState } as never,
        b
      );
      expect(dropped.outputConnection).toBeTruthy();

      const host = Blockly.serialization.blocks.append(
        {
          type: 'noodl_set_output',
          fields: { NAME: 'r' },
          inputs: { VALUE: { block: { type: 'math_arithmetic', fields: { OP: 'ADD' }, inputs: {} } } }
        } as never,
        b
      );
      // The drop: connect the saved block into the `A` socket of `… + …`.
      const sum = host.getInputTargetBlock('VALUE') as Blockly.Block;
      sum.getInput('A')!.connection!.connect(dropped.outputConnection!);
      Blockly.serialization.blocks.append({ type: 'math_number', fields: { NUM: 1 } } as never, b);
      sum.getInput('B')!.connection!.connect(b.getTopBlocks(false).find((t) => t.type === 'math_number')!
        .outputConnection!);

      const saved = Blockly.serialization.workspaces.save(b) as BlocklyWorkspaceJson;
      const generated = generateWithMyBlocks(b, saved, store);

      expect(generated.error).toBeUndefined();
      expect(generated.code).toBe('Outputs["r"] = Inputs["n"] / 2 + 1;\n');
    } finally {
      b.dispose();
    }
  });

  it('a statement block saved in A stacks on its own in B and generates its body', () => {
    const store = newStore();

    const a = liveWorkspace(workspace(setOutput('r', number(7), sendSignal('done'))));
    const opened: SaveBlockRequest[] = [];
    const handle = attachMyBlocksSave({ workspace: a, store, openDialog: (r) => opened.push(r) });

    menuItem().callback({ block: a.getTopBlocks(false)[0] });
    const definition = opened[0].commit({ name: 'Finish', scope: 'project' });

    handle.dispose();
    a.dispose();

    expect(definition.shape).toBe('statement');

    const b = new Blockly.Workspace();
    try {
      const dropped = Blockly.serialization.blocks.append(callBlockJson(definition) as never, b);

      // §1's "and cannot": a statement-shaped saved block has no output plug at all, so there
      // is nothing for a value socket to accept. ⚠️ That the *drag* refuses to snap is Blockly's
      // connection checker and still needs a drive; this is the property the checker reads.
      expect(dropped.outputConnection).toBeFalsy();
      expect(dropped.previousConnection).toBeTruthy();

      const saved = Blockly.serialization.workspaces.save(b) as BlocklyWorkspaceJson;
      const generated = generateWithMyBlocks(b, saved, store);

      expect(generated.error).toBeUndefined();
      expect(generated.code).toBe('Outputs["r"] = 7;\nsendSignalOnOutput("done");\n');
    } finally {
      b.dispose();
    }
  });

  it('a saved block with a hole gets a socket, and the argument dropped into it is inlined', () => {
    const store = newStore();

    // `? × 2` — the `A` socket is left open, so the saved block has one parameter.
    const a = liveWorkspace(workspace(arithmetic('MULTIPLY', undefined, number(2))));
    const opened: SaveBlockRequest[] = [];
    const handle = attachMyBlocksSave({ workspace: a, store, openDialog: (r) => opened.push(r) });

    menuItem().callback({ block: a.getTopBlocks(false)[0] });
    expect(opened[0].signature.params).toHaveLength(1);

    const definition = opened[0].commit({ name: 'Double', scope: 'project' });
    handle.dispose();
    a.dispose();

    const b = new Blockly.Workspace();
    try {
      const dropped = Blockly.serialization.blocks.append(callBlockJson(definition) as never, b);
      // One socket, built by `rebuildInputs_` from the definition's parameter list.
      expect(dropped.getInput('ARG0')).toBeTruthy();

      const argument = Blockly.serialization.blocks.append(
        { type: 'noodl_get_input', fields: { NAME: 'x' } } as never,
        b
      );
      dropped.getInput('ARG0')!.connection!.connect(argument.outputConnection!);

      const host = Blockly.serialization.blocks.append(
        { type: 'noodl_set_output', fields: { NAME: 'r' } } as never,
        b
      );
      host.getInput('VALUE')!.connection!.connect(dropped.outputConnection!);

      const saved = Blockly.serialization.workspaces.save(b) as BlocklyWorkspaceJson;
      const generated = generateWithMyBlocks(b, saved, store);

      expect(generated.error).toBeUndefined();
      expect(generated.code).toBe('Outputs["r"] = Inputs["x"] * 2;\n');
    } finally {
      b.dispose();
    }
  });

  it('the My Blocks category explains the gesture this editor actually has when it is empty', () => {
    const flyout = myBlocksFlyout(newStore())() as { kind: string; text?: string }[];

    expect(flyout.every((item) => item.kind === 'label')).toBe(true);
    // 🔴 Blockly 12 core has no multi-select, so an empty state saying "select some blocks"
    // instructs a builder to perform a gesture that does not exist.
    const text = flyout.map((item) => item.text).join(' ');
    expect(text).toContain('Right-click a block');
    expect(text).not.toContain('Select some blocks');
  });
});
