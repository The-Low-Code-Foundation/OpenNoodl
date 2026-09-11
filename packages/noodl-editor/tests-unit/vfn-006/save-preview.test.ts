/**
 * VFN-006 — *"show me what I am saving"*.
 *
 * > *"The 'Save as a block' right click option is confusing. It's not clear which blocks are
 * > going to be saved. It explains 5 blocks but it'd make more sense if you like drag
 * > highlighted them or something no?"*
 *
 * The count was already right and already shown. What was wrong is that *"These 5 blocks become
 * a value block"* is **deictic** — it points — and the dialog is modal and centred, so there was
 * nothing on screen it pointed at.
 *
 * ## What is graded here, and what is owed to a drive
 *
 * Everything except the pixels. The blocks a save takes, their **ids**, how many are being left
 * behind above the click, and every sentence the dialog now says about all three are decided in
 * modules that import nothing but Blockly — so they are driven here against **real headless
 * workspaces with real blocks**, not against a re-implementation.
 *
 * 🔴 What a runner cannot see, and what is therefore owed: that the outline is *painted*, that
 * it is legible against a coloured block, and that it goes away. `MyBlocksSaveOutline.ts` is
 * `document.createElementNS` into a rendered block's `<g>` and is deliberately not reachable
 * from here — the same split `DoItBalloons` and `InterfaceRailsOverlay` are on the far side of.
 *
 * ## 🔴 The controls
 *
 * Half of this file asserts *absences* — no ids missed, no blocks counted twice, no event fired,
 * no clause claimed that is not true — and a suite of absences is indistinguishable from an
 * instrument that measured nothing. Every one of them has a sibling that makes the same
 * instrument produce the other answer, marked NEGATIVE CONTROL, and the numbers those print are
 * recorded in the task notes.
 */

import * as fs from 'fs';
import * as path from 'path';

import * as Blockly from 'blockly';

import { initBlocklyIntegration } from '../../src/editor/src/views/BlocklyEditor/initialize';
import { bodyFromBlocks, initMyBlocks } from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import {
  blocksAboveSelection,
  prepareSaveRequest,
  selectionFor
} from '../../src/editor/src/views/BlocklyEditor/MyBlocksSave';
import type { BlocklyWorkspaceJson } from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import {
  countSavedBlocks,
  describeBlocksLeftBehind,
  describeOutlineTally,
  describeSaveSelection,
  previewBlockIds
} from '../../src/editor/src/views/BlocklyEditor/myblocks/saveIntent';
import { InMemoryShelf, MyBlocksStore } from '../../src/editor/src/views/BlocklyEditor/myblocks/store';
import { arithmetic, getInput, number, sendSignal, setOutput, workspace } from '../lgc-007/fixtures';

beforeAll(() => {
  initBlocklyIntegration();
  initMyBlocks();
});

function newStore() {
  return new MyBlocksStore({ project: new InMemoryShelf('project'), user: new InMemoryShelf('user') });
}

/**
 * Let Blockly's event queue drain.
 *
 * 🔴 **Blockly fires events asynchronously** — `eventUtils.fire` pushes onto a queue and flushes
 * it from a `setTimeout(…, 0)`. Any change listener read synchronously therefore reports an empty
 * array no matter what was done to the workspace, which makes "no events were fired" a sentence
 * about jest's event loop. Every event assertion in this file waits for this first.
 */
function settleEvents(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** A live headless workspace holding `json`. The blocks are real; nothing here is a stand-in. */
function liveWorkspace(json: BlocklyWorkspaceJson): Blockly.Workspace {
  const ws = new Blockly.Workspace();
  Blockly.serialization.workspaces.load(json as never, ws);
  return ws;
}

/**
 * A stack of six: `send a` → `set out = n + 2` → `send b`.
 *
 * ⚠️ **Six, not five**, and the number is asserted rather than assumed. The report says five
 * because that is what a builder counts — three statements and *"n + 2"* — but the dialog counts
 * the way `countSavedBlocks` counts, and `n`, `+` and `2` are three separate blocks. That gap
 * between what a builder sees and what the number says is a large part of why the sentence
 * needed something on screen to point at.
 */
function stackOfSix(): BlocklyWorkspaceJson {
  return workspace(
    sendSignal('a', setOutput('out', arithmetic('ADD', getInput('n'), number(2)), sendSignal('b')))
  );
}

describe('VFN-006 — the outline and the number are one answer', () => {
  it('gives an id for every block the save stores, and for no other', () => {
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];

    const body = bodyFromBlocks(selectionFor(top));
    const ids = previewBlockIds(body);

    // Criterion 3, stated as the thing that makes it true: one walk of one body, so the outline
    // and the dialog's number cannot drift apart.
    expect(ids).toHaveLength(countSavedBlocks(body));
    expect(ids).toHaveLength(6);

    // …and they are the ids of blocks that are really on the workspace, not invented strings.
    for (const id of ids) expect(ws.getBlockById(id)).toBeTruthy();

    ws.dispose();
  });

  it('🔴 outlines exactly the blocks a save would store — criterion 1', () => {
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];

    const ids = new Set(previewBlockIds(bodyFromBlocks(selectionFor(top))));
    const everything = ws.getAllBlocks(false).filter((block) => !block.isShadow());

    // The whole program is under the top block, so this particular save takes all of it — which
    // is exactly why the *next* test, on a mid-stack click, is the one that can fail.
    expect(ids.size).toBe(everything.length);
    for (const block of everything) expect(ids.has(block.id)).toBe(true);

    ws.dispose();
  });

  it('🔴 a mid-stack click outlines what it takes and NOT what it leaves', () => {
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];
    const middle = top.getNextBlock()!;

    const ids = new Set(previewBlockIds(bodyFromBlocks(selectionFor(middle))));

    // The click landed on `set out = …`. Everything under it comes; the `send a` above does not.
    expect(ids.has(middle.id)).toBe(true);
    expect(ids.has(middle.getNextBlock()!.id)).toBe(true);
    expect(ids.has(top.id)).toBe(false);

    // And the two blocks plugged into the clicked one come with it, because they are inside it.
    const plugged = middle.getChildren(false).filter((block) => block !== middle.getNextBlock());
    expect(plugged.length).toBeGreaterThan(0);
    for (const block of plugged) expect(ids.has(block.id)).toBe(true);

    ws.dispose();
  });

  it('NEGATIVE CONTROL — the walk is not returning everything it is shown', () => {
    // Every assertion above would also pass for a `previewBlockIds` that returned every id in
    // the workspace. Require the two selections to differ, and by exactly the block left behind
    // plus nothing else.
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];
    const middle = top.getNextBlock()!;

    const all = previewBlockIds(bodyFromBlocks(selectionFor(top)));
    const fromMiddle = previewBlockIds(bodyFromBlocks(selectionFor(middle)));

    expect(fromMiddle.length).toBeLessThan(all.length);
    expect(all.filter((id) => fromMiddle.indexOf(id) === -1)).toEqual([top.id]);

    ws.dispose();
  });

  it('NEGATIVE CONTROL — shadows are excluded, and the instrument can see one', () => {
    /**
     * `countSavedBlocks` excludes shadows and so must the outline, or the dialog says 1 and the
     * workspace shows 2 marks. A shadow is a default value the builder can see in the socket,
     * not a block they placed.
     *
     * ⚠️ The shadow is written into the fixture rather than expected from a block definition.
     * The first draft of this control took `math_arithmetic` with empty sockets and asserted a
     * shadow would appear; **none did** — `NoodlBlocks.ts` declares no shadow inputs, so the
     * whole language has no automatic shadows and the control was passing on an absence of its
     * own subject. Loading it explicitly is what makes the exclusion measurable at all.
     */
    const ws = liveWorkspace(
      workspace({
        type: 'noodl_set_output',
        fields: { NAME: 'out' },
        inputs: { VALUE: { shadow: { type: 'math_number', fields: { NUM: 0 } } } }
      })
    );
    const top = ws.getTopBlocks(true)[0];
    const body = bodyFromBlocks(selectionFor(top));

    // The shadow really is there, in the live workspace and in the body about to be stored.
    const shadowBlocks = ws.getAllBlocks(false).filter((block) => block.isShadow());
    expect(shadowBlocks.length).toBe(1);
    expect(JSON.stringify(body)).toContain('"shadow"');

    const placed = ws.getAllBlocks(false).filter((block) => !block.isShadow());
    expect(previewBlockIds(body)).toHaveLength(placed.length);
    expect(previewBlockIds(body)).toHaveLength(countSavedBlocks(body));
    expect(previewBlockIds(body)).not.toContain(shadowBlocks[0].id);

    ws.dispose();
  });
});

describe('VFN-006 — what a mid-stack click leaves behind', () => {
  it('is zero for the top of a stack, which is the ordinary gesture', () => {
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];

    expect(blocksAboveSelection(selectionFor(top))).toBe(0);
    expect(describeBlocksLeftBehind(0)).toBeUndefined();

    ws.dispose();
  });

  it('🔴 counts the blocks above the click, and their sockets with them — criterion 4', () => {
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];
    const middle = top.getNextBlock()!;

    // One block above (`send a`), which has nothing plugged into it.
    expect(blocksAboveSelection(selectionFor(middle))).toBe(1);

    // Two above the last one: `send a` and `set out …` — and `set out`'s own sockets, which are
    // three more blocks that are also staying where they are.
    const last = middle.getNextBlock()!;
    expect(blocksAboveSelection(selectionFor(last))).toBe(5);

    ws.dispose();
  });

  it('🔴 stops at a C-block: what encloses a stack is not above it', () => {
    // `getPreviousBlock()` on the first block inside a statement input returns the **C-block**,
    // so a naive walk would call it — and everything plugged into it, and everything above it —
    // "the blocks above this one". They are not: they are around it. This is the assertion that
    // fails if the `getNextBlock` round trip is dropped.
    const ws = liveWorkspace(
      workspace({
        type: 'controls_if',
        inputs: { DO0: { block: sendSignal('inner', sendSignal('second')) } }
      })
    );

    const ifBlock = ws.getTopBlocks(true)[0];
    const firstInside = ifBlock.getChildren(false).find((block) => block.type === 'noodl_send_signal')!;
    expect(firstInside).toBeTruthy();

    expect(blocksAboveSelection([firstInside])).toBe(0);
    // …while the block below it inside the same substack does have one above it.
    expect(blocksAboveSelection([firstInside.getNextBlock()!])).toBe(1);

    ws.dispose();
  });

  it('NEGATIVE CONTROL — the counter can return a number, and returns the right one', () => {
    // Three assertions of "0" are what a `blocksAboveSelection` that always returned 0 would
    // produce. This is the same function on the same workspace answering 5, and the number is
    // checked against the blocks actually left on the workspace after the selection is removed
    // from the count — not against a second copy of the same walk.
    const ws = liveWorkspace(stackOfSix());
    const last = ws.getTopBlocks(true)[0].getNextBlock()!.getNextBlock()!;

    const total = ws.getAllBlocks(false).filter((block) => !block.isShadow()).length;
    const taken = previewBlockIds(bodyFromBlocks(selectionFor(last))).length;

    expect(blocksAboveSelection([last])).toBe(total - taken);
    expect(blocksAboveSelection([last])).toBeGreaterThan(0);

    ws.dispose();
  });
});

describe('VFN-006 — the sentences that point at something', () => {
  it('🔴 drops the plural clause at one block, where it would be a lie by implicature', () => {
    // "…and everything inside it and stacked under it" implicates that there IS something inside
    // it and under it. Said of a lone number block it sends the builder looking for blocks that
    // do not exist.
    expect(describeSaveSelection(1, 'a value block')).toBe('This block becomes a value block.');
    expect(describeSaveSelection(1, 'a value block')).not.toContain('stacked under');
  });

  it('says what the gesture actually takes, at more than one block', () => {
    expect(describeSaveSelection(5, 'a stacking block')).toBe(
      'This block and everything inside it and stacked under it becomes a stacking block.'
    );
    // 🔴 And it is no longer deictic — nothing in it points at something off screen.
    expect(describeSaveSelection(5, 'a stacking block')).not.toContain('These 5 blocks');
  });

  it('🔴 only claims an outline when one was drawn', () => {
    expect(describeOutlineTally(5, true)).toBe('5 blocks, outlined behind this dialog.');
    // The same fact with nothing painted: the number stays, the claim goes. A dialog that says
    // "outlined behind this dialog" over a workspace with no outline on it has replaced a vague
    // sentence with a false one.
    expect(describeOutlineTally(5, false)).toBe('5 blocks.');
    expect(describeOutlineTally(5, false)).not.toContain('outlined');
  });

  it('has no tally to give for one block with no outline', () => {
    // "1 blocks." is not a sentence, and "1 block." repeats what the line above already said.
    expect(describeOutlineTally(1, false)).toBeUndefined();
    expect(describeOutlineTally(1, true)).toBe('Outlined behind this dialog.');
  });

  it('🔴 says what stays, in both numbers — criterion 4', () => {
    expect(describeBlocksLeftBehind(0)).toBeUndefined();
    expect(describeBlocksLeftBehind(1)).toBe('The block above this one stays where it is.');
    expect(describeBlocksLeftBehind(3)).toBe('The 3 blocks above this one stay where they are.');
  });

  it('NEGATIVE CONTROL — the sentence a builder read before this task fails these assertions', () => {
    // The deictic sentence, run through the same checks. It contains the number and nothing that
    // points at anything, which is exactly why the count alone never answered the question.
    const before = 'These 5 blocks become a value block.';

    expect(before).not.toBe(describeSaveSelection(5, 'a value block'));
    expect(before).not.toContain('stacked under it');
    expect(before).not.toContain('outlined');
    // And it is the same for a mid-stack click as for a top-of-stack one, which is the whole
    // defect: two different gestures, one sentence.
    expect(before).toContain('5 blocks');
  });
});

describe('VFN-006 — criterion 5: preparing a save changes nothing', () => {
  /**
   * 🔴 *"A save preceded by hover, dialog, and cancel leaves `workspace` and `generatedCode`
   * byte-identical."* This is the criterion that catches an overlay that reached the model, and
   * the task file warns that a vacuous pass is available: measure a workspace nothing was going
   * to change anyway and the comparison proves nothing.
   *
   * So the workspace is **edited first** — a real block created and connected, exactly what a
   * builder does before reaching for the menu — and only then is the serialisation taken. What is
   * graded is every Blockly-touching thing the outline path does: `selectionFor`,
   * `bodyFromBlocks`, `previewBlockIds` and `blocksAboveSelection`, plus the whole
   * `prepareSaveRequest`. The painting itself creates DOM nodes and calls no Blockly API at all,
   * which is the argument `DoItBalloons` makes and the reason it is built the same way.
   */
  it('🔴 fires no Blockly event and serialises byte-identically', async () => {
    const ws = liveWorkspace(stackOfSix());

    // The edit that makes the comparison mean something.
    const extra = ws.newBlock('noodl_send_signal');
    extra.setFieldValue('c', 'NAME');
    const last = ws.getTopBlocks(true)[0].getNextBlock()!.getNextBlock()!;
    last.nextConnection!.connect(extra.previousConnection!);

    /**
     * 🔴 Settle **before** the listener goes on, or the edit's own create/change/move events
     * arrive late and are counted against the code under test. That is how the first run of this
     * test failed: three events, all of them mine, none of them from `prepareSaveRequest`.
     */
    await settleEvents();

    const before = JSON.stringify(Blockly.serialization.workspaces.save(ws));

    const events: Blockly.Events.Abstract[] = [];
    const listener = (event: Blockly.Events.Abstract) => events.push(event);
    ws.addChangeListener(listener);

    const top = ws.getTopBlocks(true)[0];
    const request = prepareSaveRequest(newStore(), selectionFor(top));
    // …and the hover's half of the work, which is the same two calls the menu item makes.
    previewBlockIds(bodyFromBlocks(selectionFor(top)));
    blocksAboveSelection(selectionFor(top));

    await settleEvents();
    ws.removeChangeListener(listener);

    expect(events.filter((event) => !event.isUiEvent)).toEqual([]);
    expect(events).toEqual([]);
    expect(JSON.stringify(Blockly.serialization.workspaces.save(ws))).toBe(before);

    // And the request really did the work — otherwise "no events" is the answer for a function
    // that returned early.
    expect(request.previewBlockIds.length).toBe(request.blockCount);
    expect(request.blockCount).toBeGreaterThan(5);

    ws.dispose();
  });

  it('NEGATIVE CONTROL — the same instrument sees a real change', async () => {
    /**
     * 🔴 **This control caught the test above passing vacuously, and that is why it is here.**
     *
     * The first draft asserted "no events" synchronously and passed — and so did nothing, because
     * `Blockly.Events.fire` *queues* and flushes on a `setTimeout(…, 0)`. A synchronous listener
     * sees an empty array whatever you do to the workspace, so the assertion was a measurement of
     * jest's event loop rather than of the code. This control was the only thing that could tell
     * the difference: it makes a change that certainly fires, and it failed, printing
     * `Expected: > 0 / Received: 0`.
     *
     * Both now wait a macrotask. One field edit is the smallest thing a builder can do.
     */
    const ws = liveWorkspace(stackOfSix());
    const before = JSON.stringify(Blockly.serialization.workspaces.save(ws));

    const events: Blockly.Events.Abstract[] = [];
    const listener = (event: Blockly.Events.Abstract) => events.push(event);
    ws.addChangeListener(listener);

    ws.getTopBlocks(true)[0].setFieldValue('renamed', 'NAME');

    await settleEvents();
    ws.removeChangeListener(listener);

    expect(events.filter((event) => !event.isUiEvent).length).toBeGreaterThan(0);
    expect(JSON.stringify(Blockly.serialization.workspaces.save(ws))).not.toBe(before);

    ws.dispose();
  });
});

describe('VFN-006 — what the dialog is handed', () => {
  it('carries the ids, the count and the blocks left behind, in one request', () => {
    const ws = liveWorkspace(stackOfSix());
    const middle = ws.getTopBlocks(true)[0].getNextBlock()!;

    const request = prepareSaveRequest(newStore(), selectionFor(middle));

    expect(request.previewBlockIds).toEqual(previewBlockIds(request.body));
    expect(request.previewBlockIds).toHaveLength(request.blockCount);
    expect(request.blocksAbove).toBe(1);
    // Nothing was injected, so there is no outline to drive — and the dialog must degrade to
    // saying the true thing rather than crashing or claiming one.
    expect(request.outline).toBeUndefined();
    expect(describeOutlineTally(request.blockCount, false)).not.toContain('outlined');

    ws.dispose();
  });

  it('🔴 the outline it is handed is the one the layer was given, and pin answers with a count', () => {
    // The seam, driven with a fake layer: what the dialog receives is what `attachMyBlocksSave`
    // was injected with, and `pin` returns a number the dialog is entitled to believe.
    const ws = liveWorkspace(stackOfSix());
    const top = ws.getTopBlocks(true)[0];

    const pinned: string[][] = [];
    let unpins = 0;
    const outline = {
      pin: (ids: readonly string[]) => {
        pinned.push([...ids]);
        return ids.length;
      },
      unpin: () => {
        unpins++;
      },
      show: () => undefined,
      hide: () => undefined
    };

    const request = prepareSaveRequest(newStore(), selectionFor(top), undefined, outline);
    expect(request.outline).toBe(outline);

    const drawn = request.outline!.pin(request.previewBlockIds);
    expect(drawn).toBe(request.blockCount);
    expect(pinned[0]).toEqual(request.previewBlockIds);

    request.outline!.unpin();
    expect(unpins).toBe(1);

    ws.dispose();
  });
});

/* ==============================================================================================
 * The two halves a plain-Node runner cannot execute, held at the source instead.
 *
 * `MyBlocksSaveDialog.tsx` is React and `MyBlocksSaveOutline.ts` is the DOM, so neither can be
 * imported here — that boundary is deliberate and is what keeps this suite runnable at all. What
 * *can* be held is the pair of properties those two files exist to have, and both are the kind
 * that rot silently: a withdrawal path that stops being reached, and an overlay that starts
 * touching the model. Read as text, comments stripped, in the house style `vfn-007` established.
 * ============================================================================================ */

const DIALOG_TSX = path.join(__dirname, '../../src/editor/src/views/BlocklyEditor/MyBlocksSaveDialog.tsx');
const OUTLINE_TS = path.join(__dirname, '../../src/editor/src/views/BlocklyEditor/MyBlocksSaveOutline.ts');

/**
 * 🔴 Comments removed, and here it is not tidiness either: `MyBlocksSaveOutline.ts` opens with a
 * paragraph naming every Blockly API it refuses to call, and this file is about to assert those
 * names are absent. A parser that read comments would find `setHighlighted` in the sentence
 * forbidding `setHighlighted`.
 */
function withoutComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

const dialogSource = withoutComments(fs.readFileSync(DIALOG_TSX, 'utf8'));
const outlineSource = withoutComments(fs.readFileSync(OUTLINE_TS, 'utf8'));

describe('VFN-006 — criterion 2: the outline goes when the dialog goes', () => {
  it('🔴 pins on mount and unpins from the effect cleanup, which is all three exits at once', () => {
    // Save, cancel and Escape are the same event as far as this component is concerned — it
    // unmounts — so the withdrawal is tied to the unmount rather than to three handlers, one of
    // which would eventually be added without its `unpin`.
    expect(dialogSource).toMatch(/useEffect\(\(\) => \{[\s\S]*?outline\.pin\(request\.previewBlockIds\)/);
    expect(dialogSource).toMatch(/return \(\) => outline\.unpin\(\);\s*\}, \[request\]\);/);
  });

  it('🔴 believes the number `pin` returned, not the number it asked for', () => {
    // The sentence "outlined behind this dialog" is only true if something was drawn. `pin`
    // answers with what it drew; the dialog stores that and compares it to the count.
    expect(dialogSource).toContain('setOutlinedCount(outline.pin(');
    expect(dialogSource).toMatch(/outlinedCount > 0 && outlinedCount === request\.blockCount/);
  });

  it('🔴 the deictic sentence is gone from the component, not merely reworded in place', () => {
    // The copy has to be in `saveIntent.ts` or no runner can grade it — §1's whole argument is
    // that the words are the thing doing the teaching, and words in a JSX literal are words no
    // spec can reach.
    expect(dialogSource).not.toContain('blocks become');
    expect(dialogSource).not.toContain('This block becomes');
    expect(dialogSource).toContain('describeSaveSelection(request.blockCount, shape.shapeName)');
    expect(dialogSource).toContain('describeOutlineTally(');
    expect(dialogSource).toContain('describeBlocksLeftBehind(request.blocksAbove)');
  });

  it('NEGATIVE CONTROL — the same parser convicts the sentence as it was', () => {
    // The literal that was in the component before this task, run through the same checks. It
    // contains exactly the string the assertion above forbids, so the assertion is not passing
    // by looking at a file that never could have contained it.
    const before = "{request.blockCount === 1 ? 'This block becomes ' : `These ${request.blockCount} blocks become `}";

    expect(withoutComments(before)).toContain('blocks become');
    expect(withoutComments(before)).toContain('This block becomes');
    expect(withoutComments(before)).not.toContain('describeSaveSelection');
  });
});

describe('VFN-006 — criterion 5: the overlay cannot reach the model', () => {
  /**
   * 🔴 The rule the whole feature is built around, held as a gate rather than as a paragraph.
   *
   * `BlocklyWorkspace` serialises on every non-UI event and writes the result into the node's
   * `workspace` parameter. A highlight that goes through the block model therefore ends up in the
   * builder's `project.json`, reopens next session and diffs in git. LGC-003 §2 was reverted for
   * exactly that, and the byte-identity test above cannot catch a regression here because the
   * painting half is not reachable from this runner — this is.
   */
  const FORBIDDEN = ['select(', 'addSelect(', 'setHighlighted(', 'setDisabledReason(', 'unselect('];

  for (const api of FORBIDDEN) {
    it(`🔴 never calls ${api}`, () => {
      expect(outlineSource).not.toContain(api);
    });
  }

  it('does its drawing with the DOM, which produces no Blockly event', () => {
    // A DOM mutation is not a Blockly event, which is the entire argument. The positive half of
    // the same claim: it really is drawing, so "no forbidden call" is not the answer for a file
    // that draws nothing.
    expect(outlineSource).toContain('document.createElementNS');
    expect(outlineSource).toContain('cloneNode(false)');
    expect(outlineSource).toContain("setAttribute('pointer-events', 'none')");
  });

  it('🔴 holds its screen width as the workspace zooms out', () => {
    // An outline that thins to nothing at low zoom has stopped answering the question it was
    // drawn for — the register entry about canvas glyphs, in its SVG spelling.
    expect(outlineSource).toContain("setAttribute('vector-effect', 'non-scaling-stroke')");
  });

  it('NEGATIVE CONTROL — the same scan convicts the model-touching version', () => {
    // Four `not.toContain` are what a scan of an empty string also produces. This is the one-line
    // implementation this file exists instead of — the obvious way, and the way that reaches
    // `project.json` — run through the same checks.
    const modelHighlight = 'block.setHighlighted(true); block.addSelect();';

    for (const api of ['setHighlighted(', 'addSelect(']) {
      expect(withoutComments(modelHighlight)).toContain(api);
    }
    expect(withoutComments(modelHighlight)).not.toContain('document.createElementNS');
  });
});
