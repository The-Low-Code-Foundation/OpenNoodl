/**
 * LGC-004 §1 — the two interface rails.
 *
 * ## What is graded here, and what deliberately is not
 *
 * The rails have two halves. The **model** — which ports exist, what they are called, what type
 * they carry, whether a block declares them — is a pure function of the workspace and is graded
 * here against a **real headless Blockly workspace**, because every interesting claim is a claim
 * about what happens when the blocks change and asserting it against a re-implementation of
 * Blockly's shapes would pass around the defect rather than catch it.
 *
 * The **rendering** half needs a DOM, and this runner has none (`testEnvironment: 'node'`, no
 * jsdom in the tree). Rails at every zoom level, in both themes, and the drag gestures are
 * therefore in LGC-004's `## Deferred verification` with the steps written out. What *is* graded
 * about the rendering half is the one thing a screenshot could never catch: that it holds no port
 * state of its own.
 *
 * ## 🔴 The criterion this file exists for
 *
 * > *"There is no second store. A spec asserts that the rows are derived from `detectIO` output
 * > and nothing else. This is the acceptance criterion most likely to be quietly satisfied by a
 * > cache; it must be checked against the workspace, not against the panel."*
 *
 * That is BLD-007's shape (register **L11**): one fact, two sources, `tsc` green and 21/21 specs
 * passing while it was live. A rail that memoised its rows would pass any spec that renders once
 * and reads once. So every derivation test below **mutates the workspace between two reads** and
 * requires the second read to have moved.
 */

import * as Blockly from 'blockly';
import * as fs from 'fs';
import * as path from 'path';

import { detectIO } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import {
  ANY_TYPE_LABEL,
  GET_INPUT_BLOCK,
  SET_OUTPUT_BLOCK,
  SIGNAL_TYPE_LABEL,
  dragBlockJsonForRow,
  railModelForWorkspace,
  railModelFromWorkspaceJson,
  unusedOutputName
} from '../../src/editor/src/views/BlocklyEditor/interfaceRails';

initNoodlBlocks();

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = new Blockly.Workspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

/** Add one Noodl block with its `NAME` (and optionally `TYPE`) set. */
function addBlock(workspace: Blockly.Workspace, type: string, name: string, portType?: string): Blockly.Block {
  const block = workspace.newBlock(type);
  block.setFieldValue(name, 'NAME');
  if (portType) block.setFieldValue(portType, 'TYPE');
  return block;
}

describe('LGC-004 §1 — the rails read the workspace', () => {
  it('shows a declared input with its declared type', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, 'noodl_define_input', 'count', 'number');

      expect(railModelForWorkspace(workspace).inputs).toEqual([
        { name: 'count', kind: 'value', type: 'number', displayType: 'number', declared: true }
      ]);
    });
  });

  it('shows a declared output with its declared type', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, 'noodl_define_output', 'label', 'string');

      expect(railModelForWorkspace(workspace).outputs).toEqual([
        { name: 'label', kind: 'value', type: 'string', displayType: 'string', declared: true }
      ]);
    });
  });

  /**
   * LGC-004 §3 / register **L12**. The property being protected is that a program works before
   * anyone declares its interface — so an undeclared port is a *row*, not an absence and not a
   * warning, and its type is printed as "any" rather than guessed at.
   */
  it('shows an undeclared-but-used port as an inferred row, typed “any”', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, GET_INPUT_BLOCK, 'name');
      addBlock(workspace, SET_OUTPUT_BLOCK, 'greeting');

      const model = railModelForWorkspace(workspace);

      expect(model.inputs).toEqual([
        { name: 'name', kind: 'value', type: '*', displayType: ANY_TYPE_LABEL, declared: false }
      ]);
      expect(model.outputs).toEqual([
        { name: 'greeting', kind: 'value', type: '*', displayType: ANY_TYPE_LABEL, declared: false }
      ]);
    });
  });

  it('never prints the raw `*` at a person', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, GET_INPUT_BLOCK, 'anything');

      const row = railModelForWorkspace(workspace).inputs[0];
      expect(row.type).toBe('*');
      expect(row.displayType).toBe('any');
    });
  });

  it('shows signals on both sides, and calls their type “signal”', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, 'noodl_define_signal_input', 'start');
      addBlock(workspace, 'noodl_send_signal', 'failed');

      const model = railModelForWorkspace(workspace);

      expect(model.inputs).toEqual([
        { name: 'start', kind: 'signal', type: 'signal', displayType: SIGNAL_TYPE_LABEL, declared: true }
      ]);
      expect(model.outputs).toEqual([
        { name: 'failed', kind: 'signal', type: 'signal', displayType: SIGNAL_TYPE_LABEL, declared: false }
      ]);
    });
  });

  it('finds ports nested inside a statement body, where a scan of top-level blocks would not', () => {
    withWorkspace((workspace) => {
      const outer = workspace.newBlock('controls_if');
      const inner = addBlock(workspace, GET_INPUT_BLOCK, 'enabled');
      outer.getInput('IF0')!.connection!.connect(inner.outputConnection!);

      expect(railModelForWorkspace(workspace).inputs.map((row) => row.name)).toEqual(['enabled']);
    });
  });
});

/**
 * 🔴 **The no-second-store criterion.**
 *
 * Each of these reads the rails, changes the *workspace*, and reads again. A memoised rail — the
 * quiet way this criterion gets satisfied — passes the first read of every one of them and fails
 * the second.
 */
describe('LGC-004 — there is no second store', () => {
  it('gains a row when a block is added, with nothing told to refresh', () => {
    withWorkspace((workspace) => {
      expect(railModelForWorkspace(workspace).inputs).toEqual([]);

      addBlock(workspace, GET_INPUT_BLOCK, 'price');

      expect(railModelForWorkspace(workspace).inputs.map((row) => row.name)).toEqual(['price']);
    });
  });

  it('loses a row when the block that made it is deleted', () => {
    withWorkspace((workspace) => {
      const block = addBlock(workspace, SET_OUTPUT_BLOCK, 'total');
      expect(railModelForWorkspace(workspace).outputs.map((row) => row.name)).toEqual(['total']);

      block.dispose(false);

      expect(railModelForWorkspace(workspace).outputs).toEqual([]);
    });
  });

  it('follows a rename through the block’s own field, not through an API of its own', () => {
    withWorkspace((workspace) => {
      const block = addBlock(workspace, 'noodl_define_input', 'oldName', 'number');
      expect(railModelForWorkspace(workspace).inputs[0].name).toBe('oldName');

      block.setFieldValue('newName', 'NAME');

      expect(railModelForWorkspace(workspace).inputs.map((row) => row.name)).toEqual(['newName']);
    });
  });

  it('follows a type change on the declaration block', () => {
    withWorkspace((workspace) => {
      const block = addBlock(workspace, 'noodl_define_input', 'count', 'number');
      expect(railModelForWorkspace(workspace).inputs[0].displayType).toBe('number');

      block.setFieldValue('string', 'TYPE');

      expect(railModelForWorkspace(workspace).inputs[0].displayType).toBe('string');
    });
  });

  it('turns an inferred row into a declared one when a Define block appears — no “Declare” bookkeeping', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, GET_INPUT_BLOCK, 'count');
      expect(railModelForWorkspace(workspace).inputs[0].declared).toBe(false);

      addBlock(workspace, 'noodl_define_input', 'count', 'number');

      expect(railModelForWorkspace(workspace).inputs).toHaveLength(1);
      expect(railModelForWorkspace(workspace).inputs[0].declared).toBe(true);
    });
  });

  /**
   * The agreement claim, said against the live workspace rather than against a fixture: whatever
   * the rails show, the node's own port detector reports the same names. If a rail ever grows a
   * row of its own — a placeholder, a pending edit, a remembered deletion — this is where it shows.
   */
  it('shows exactly the ports `detectIO` reports for the same workspace, and no others', () => {
    withWorkspace((workspace) => {
      addBlock(workspace, 'noodl_define_input', 'price', 'number');
      addBlock(workspace, GET_INPUT_BLOCK, 'quantity');
      addBlock(workspace, 'noodl_define_signal_input', 'run');
      addBlock(workspace, SET_OUTPUT_BLOCK, 'total');
      addBlock(workspace, 'noodl_send_signal', 'done');

      const model = railModelForWorkspace(workspace);
      const io = detectIO(Blockly.serialization.workspaces.save(workspace));

      expect(model.inputs.map((row) => row.name).sort()).toEqual(
        io.inputs
          .map((port) => port.name)
          .concat(io.signalInputs)
          .sort()
      );
      expect(model.outputs.map((row) => row.name).sort()).toEqual(
        io.outputs
          .map((port) => port.name)
          .concat(io.signalOutputs)
          .sort()
      );

      for (const row of model.inputs) {
        if (row.kind === 'signal') continue;
        expect(row.type).toBe(io.inputs.find((port) => port.name === row.name)!.type);
      }
    });
  });
});

/**
 * ⚠️ The acceptance criterion that needs no editor at all: *"verify with the node placed but never
 * opened"*. A Visual Function that has never been rendered has no Blockly workspace — its blocks
 * are a string in a node parameter — and it still has ports, because `detectIO` reads JSON.
 */
describe('LGC-004 — a node placed but never opened', () => {
  const savedProgram = JSON.stringify({
    blocks: {
      languageVersion: 0,
      blocks: [
        { type: 'noodl_define_input', fields: { NAME: 'price', TYPE: 'number' } },
        { type: 'noodl_set_output', fields: { NAME: 'total' } }
      ]
    }
  });

  it('reads a signature straight out of the saved parameter', () => {
    const model = railModelFromWorkspaceJson(savedProgram);

    expect(model.inputs).toEqual([
      { name: 'price', kind: 'value', type: 'number', displayType: 'number', declared: true }
    ]);
    expect(model.outputs).toEqual([
      { name: 'total', kind: 'value', type: '*', displayType: ANY_TYPE_LABEL, declared: false }
    ]);
  });

  it('gives the same answer as the live workspace does once it is opened', () => {
    withWorkspace((workspace) => {
      Blockly.serialization.workspaces.load(JSON.parse(savedProgram), workspace);

      expect(railModelForWorkspace(workspace)).toEqual(railModelFromWorkspaceJson(savedProgram));
    });
  });

  it('says “no ports” rather than throwing at a node whose parameter was never written', () => {
    const empty = { inputs: [], outputs: [] };

    expect(railModelFromWorkspaceJson(undefined)).toEqual(empty);
    expect(railModelFromWorkspaceJson('')).toEqual(empty);
    expect(railModelFromWorkspaceJson('{ half written')).toEqual(empty);
  });
});

describe('LGC-004 §1 — what a drag off a rail makes', () => {
  it('binds a `get input` to the row it came from', () => {
    const row = { name: 'price', kind: 'value' as const, type: '*', displayType: 'any', declared: false };
    expect(dragBlockJsonForRow(row, 'inputs')).toEqual({ type: GET_INPUT_BLOCK, fields: { NAME: 'price' } });
  });

  it('binds a `set output` to the row it came from', () => {
    const row = { name: 'total', kind: 'value' as const, type: 'number', displayType: 'number', declared: true };
    expect(dragBlockJsonForRow(row, 'outputs')).toEqual({ type: SET_OUTPUT_BLOCK, fields: { NAME: 'total' } });
  });

  /**
   * ⚠️ A signal input is a *trigger* — what it runs is the whole program — so there is no
   * "receive signal" block to make. Offering a drag that produced the wrong block would be worse
   * than offering none, so the row is simply not draggable.
   */
  it('offers no block for a signal row rather than the wrong one', () => {
    const row = { name: 'run', kind: 'signal' as const, type: 'signal', displayType: 'signal', declared: true };
    expect(dragBlockJsonForRow(row, 'inputs')).toBeNull();
    expect(dragBlockJsonForRow(row, 'outputs')).toBeNull();
  });

  it('creates a real, bound block in a real workspace', () => {
    withWorkspace((workspace) => {
      const json = dragBlockJsonForRow(
        { name: 'price', kind: 'value', type: '*', displayType: 'any', declared: false },
        'inputs'
      )!;
      Blockly.serialization.blocks.append(json, workspace);

      // The point of dragging from a rail rather than the toolbox: the name is already right, so
      // it does not mint a second port by typo.
      expect(railModelForWorkspace(workspace).inputs.map((row) => row.name)).toEqual(['price']);
    });
  });

  it('mints an unused name for a block dropped on the rail below every row', () => {
    expect(unusedOutputName({ inputs: [], outputs: [] })).toBe('result');

    const taken = {
      inputs: [],
      outputs: [
        { name: 'result', kind: 'value' as const, type: '*', displayType: 'any', declared: false },
        { name: 'result2', kind: 'value' as const, type: '*', displayType: 'any', declared: false }
      ]
    };
    expect(unusedOutputName(taken)).toBe('result3');
  });
});

/**
 * 🔴 **The structural gate.**
 *
 * BLD-007 was green on every behavioural gate while it was live; what caught it was a spec nobody
 * had touched. The behavioural specs above can only catch a stale cache on a code path they
 * exercise, and they cannot reach the rendering half at all (no DOM in this runner). So this reads
 * the overlay's source and asserts the two structural facts that make a second store impossible in
 * the first place.
 *
 * ⚠️ A source-text assertion is a blunt instrument and it is chosen deliberately: the alternative
 * was no assertion at all on the half that renders.
 */
describe('LGC-004 — the rendering half cannot hold a port list', () => {
  const overlayPath = path.resolve(
    __dirname,
    '../../src/editor/src/views/BlocklyEditor/InterfaceRailsOverlay.ts'
  );
  /**
   * 🔴 **Comments stripped first, and this cost a red run to learn.**
   *
   * The gate is about what the file *does*, and the file's own docstring explains at length why it
   * is not a `Blockly.Comment` — so the first version of this failed on the sentence that exists to
   * prevent the thing it was checking for. A prose mention of a forbidden call is the correct
   * documentation and must not be a failure.
   */
  const overlay = fs
    .readFileSync(overlayPath, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/(^|[^:])\/\/.*$/gm, '$1');

  it('derives its rows through `railModelForWorkspace` rather than detecting ports itself', () => {
    expect(overlay).toContain('railModelForWorkspace(');
    // Reaching the runtime detector directly would be a second derivation of the same fact, and
    // the two would drift the first time a block type was added to one of them.
    expect(overlay).not.toContain('detectIO(');
    expect(overlay).not.toContain('detectInterface(');
  });

  it('keeps no rows in a field — every read re-derives', () => {
    // A field holding rows is the shape to forbid: `private rows: RailRow[]`, `this.model =`,
    // `this.ports =`. The model is reached through a method, and that method is one line.
    expect(overlay).not.toMatch(/(private|readonly|public)\s+\w*(rows|ports|model)\w*\s*[:=]\s*(RailRow|RailModel|\[)/i);
    expect(overlay).not.toMatch(/this\.(rows|ports|model)\s*=/);
  });

  it('does not write the rails into the workspace, where they would be saved into the program', () => {
    // Every one of these is a workspace *model* mutation, and `BlocklyWorkspace` serialises the
    // model into the node's parameter on a 300 ms debounce. A rail built out of any of them would
    // reopen next session and diff in git — `DoItBalloons` documents the same trap.
    expect(overlay).not.toContain('Blockly.Comment');
    expect(overlay).not.toContain('setCommentText');
    expect(overlay).not.toContain('addIcon');
  });
});
