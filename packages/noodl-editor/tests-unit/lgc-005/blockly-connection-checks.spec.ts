/**
 * LGC-005 — Noodl port types become Blockly connection checks.
 *
 * Two halves, and they are graded differently on purpose.
 *
 * The first half is the map: pure strings, no Blockly. The single claim it exists to pin is
 * register **L14** — `'*'` must mean *permissive*, which in Blockly is spelled `null`. `'*'`
 * is what `detectIO` reports for an undeclared port, which is the common case, and as a check
 * *value* it would match nothing at all. Same string, opposite meaning; the bug this task was
 * warned it would produce.
 *
 * The second half drives a real headless Blockly workspace, because the interesting claims are
 * claims about Blockly's behaviour and asserting them against a re-implementation of its rules
 * would pass around the defect. Blockly runs in plain Node without a DOM as long as nothing
 * asks for a `WorkspaceSvg`, which is why these live in `tests-unit/` rather than in the
 * Electron jasmine suite.
 *
 * ⚠️ Blockly fires change events on a macrotask, not synchronously, so every test that expects
 * a check to have been recomputed has to await a tick first. A missing `await` here does not
 * fail — it passes for the wrong reason, by reading the check before anything updated it.
 */

import * as fs from 'fs';
import * as path from 'path';
import * as Blockly from 'blockly';

import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import {
  BLOCKLY_CHECK_TO_NOODL_TYPE,
  NOODL_TYPE_TO_BLOCKLY_CHECK,
  PERMISSIVE_NOODL_TYPE,
  blocklyCheckForNoodlType,
  connectionCheckForDeclaredPort,
  isSignalType,
  noodlTypeForBlocklyCheck
} from '../../src/editor/src/views/BlocklyEditor/NoodlTypes';

initNoodlBlocks();

/** Let Blockly's event queue drain, so `setOnChange` handlers have actually run. */
function settle(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

function checkOf(connection: Blockly.Connection | null): string[] | null {
  return connection ? connection.getCheck() : null;
}

describe('LGC-005 §1 — the map', () => {
  it('maps every row of the task table, forwards', () => {
    expect(blocklyCheckForNoodlType('number')).toBe('Number');
    expect(blocklyCheckForNoodlType('string')).toBe('String');
    expect(blocklyCheckForNoodlType('boolean')).toBe('Boolean');
    expect(blocklyCheckForNoodlType('array')).toBe('Array');
    expect(blocklyCheckForNoodlType('color')).toBe('Colour');
    expect(blocklyCheckForNoodlType('object')).toBe('Object');
  });

  it('maps every check back to a Noodl type', () => {
    expect(noodlTypeForBlocklyCheck('Number')).toBe('number');
    expect(noodlTypeForBlocklyCheck('String')).toBe('string');
    expect(noodlTypeForBlocklyCheck('Boolean')).toBe('boolean');
    expect(noodlTypeForBlocklyCheck('Array')).toBe('array');
    expect(noodlTypeForBlocklyCheck('Colour')).toBe('color');
    expect(noodlTypeForBlocklyCheck('Object')).toBe('object');
  });

  it('round-trips every check through the Noodl name and back', () => {
    for (const check of Object.keys(BLOCKLY_CHECK_TO_NOODL_TYPE)) {
      expect(blocklyCheckForNoodlType(BLOCKLY_CHECK_TO_NOODL_TYPE[check])).toBe(check);
    }
  });

  it('reads the array form Connection.getCheck returns', () => {
    expect(noodlTypeForBlocklyCheck(['Number'])).toBe('number');
    // Several tags have no single Noodl type. `'*'` is the honest answer, not a guess.
    expect(noodlTypeForBlocklyCheck(['String', 'Array'])).toBe(PERMISSIVE_NOODL_TYPE);
    expect(noodlTypeForBlocklyCheck([])).toBe(PERMISSIVE_NOODL_TYPE);
  });

  /* --- Register L14 ---------------------------------------------------- */

  it("L14: '*' is null — permissive — and is never passed through as a string", () => {
    const check = blocklyCheckForNoodlType(PERMISSIVE_NOODL_TYPE);

    expect(check).toBeNull();
    // Named individually because each of these has been the shape of this bug somewhere:
    // the literal star, the word "Any", and the empty string all *look* like "no type" and
    // all mean "matches nothing" to Blockly.
    expect(check).not.toBe('*');
    expect(check).not.toBe('Any');
    expect(check).not.toBe('');
  });

  it('L14: no unknown or absent type ever produces a check string', () => {
    for (const value of [undefined, null, '', 'Any', 'any', '*', 'stringlist', 'enum', 'dimension']) {
      expect(blocklyCheckForNoodlType(value as string)).toBeNull();
    }
  });

  it('a signal is not a value connection and has no check', () => {
    expect(isSignalType('signal')).toBe(true);
    expect(blocklyCheckForNoodlType('signal')).toBeNull();
    expect(NOODL_TYPE_TO_BLOCKLY_CHECK['signal']).toBeUndefined();
  });

  it('an unknown check reads as the permissive Noodl type, not as itself', () => {
    expect(noodlTypeForBlocklyCheck(null)).toBe(PERMISSIVE_NOODL_TYPE);
    expect(noodlTypeForBlocklyCheck('Widget')).toBe(PERMISSIVE_NOODL_TYPE);
  });
});

describe('LGC-005 §1 — the coercion policy', () => {
  const declarable = ['string', 'number', 'boolean', 'object', 'array', PERMISSIVE_NOODL_TYPE];

  it('gives an input-side port no check, whatever it was declared', () => {
    // The read side is not enforceable: the typecast table lets a string reach a `number`
    // input, a `'*'` output reaches everything, and neither the wire nor Logic Builder's own
    // setter converts anything. See `connectionCheckForDeclaredPort`.
    for (const type of declarable) {
      expect(connectionCheckForDeclaredPort(type, 'input')).toBeNull();
    }
  });

  it('gives an output-side port the declared check', () => {
    expect(connectionCheckForDeclaredPort('number', 'output')).toBe('Number');
    expect(connectionCheckForDeclaredPort('string', 'output')).toBe('String');
    expect(connectionCheckForDeclaredPort('object', 'output')).toBe('Object');
    expect(connectionCheckForDeclaredPort(PERMISSIVE_NOODL_TYPE, 'output')).toBeNull();
  });
});

describe('LGC-005 — what Blockly actually does with these checks', () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  afterEach(() => {
    workspace.dispose();
  });

  function canConnect(a: Blockly.Connection | null, b: Blockly.Connection | null): boolean {
    if (!a || !b) return false;
    return workspace.connectionChecker.canConnect(a, b, false);
  }

  it('the built-in blocks carry the checks the map is written against', () => {
    // Not decoration: the whole map is a claim about strings Blockly's own library uses, and
    // a Blockly upgrade that renamed one of them would otherwise fail as a mysterious
    // refusal in the editor rather than here.
    expect(checkOf(workspace.newBlock('math_number').outputConnection)).toEqual(['Number']);
    expect(checkOf(workspace.newBlock('text').outputConnection)).toEqual(['String']);
    expect(checkOf(workspace.newBlock('logic_boolean').outputConnection)).toEqual(['Boolean']);
    expect(checkOf(workspace.newBlock('lists_create_with').outputConnection)).toEqual(['Array']);
    const arithmetic = workspace.newBlock('math_arithmetic');
    expect(checkOf(arithmetic.getInput('A')!.connection)).toEqual(['Number']);
  });

  it("L14 in Blockly's own terms: a null check connects to everything", () => {
    const permissive = workspace.newBlock('noodl_get_input');
    const numberSocket = workspace.newBlock('math_arithmetic').getInput('A')!.connection;
    const stringSocket = workspace.newBlock('text_length').getInput('VALUE')!.connection;

    expect(blocklyCheckForNoodlType(PERMISSIVE_NOODL_TYPE)).toBeNull();
    expect(canConnect(permissive.outputConnection, numberSocket)).toBe(true);
    expect(canConnect(permissive.outputConnection, stringSocket)).toBe(true);
  });

  it("and the string '*' as a check would connect to nothing — the bug L14 names", () => {
    // The counter-demonstration, so the previous test cannot be read as a coincidence.
    const wrong = workspace.newBlock('noodl_get_input');
    wrong.outputConnection!.setCheck([PERMISSIVE_NOODL_TYPE]);

    const numberSocket = workspace.newBlock('math_arithmetic').getInput('A')!.connection;
    const stringSocket = workspace.newBlock('text_length').getInput('VALUE')!.connection;

    expect(canConnect(wrong.outputConnection, numberSocket)).toBe(false);
    expect(canConnect(wrong.outputConnection, stringSocket)).toBe(false);
  });

  it("an undeclared port's `get input` connects anywhere, and stays that way", async () => {
    const getInput = workspace.newBlock('noodl_get_input');
    getInput.setFieldValue('untyped', 'NAME');
    await settle();

    expect(checkOf(getInput.outputConnection)).toBeNull();
  });

  it('a declared input still gets no check, because the wire can falsify it', async () => {
    const declare = workspace.newBlock('noodl_define_input');
    declare.setFieldValue('count', 'NAME');
    declare.setFieldValue('number', 'TYPE');

    const getInput = workspace.newBlock('noodl_get_input');
    getInput.setFieldValue('count', 'NAME');
    await settle();

    expect(checkOf(getInput.outputConnection)).toBeNull();
    // And it therefore still reaches a string socket, which is the point: at runtime it may
    // well hold a string.
    const stringSocket = workspace.newBlock('text_length').getInput('VALUE')!.connection;
    expect(canConnect(getInput.outputConnection, stringSocket)).toBe(true);
  });

  it('a `set output` declared number refuses text and accepts a number', async () => {
    const declare = workspace.newBlock('noodl_define_output');
    declare.setFieldValue('total', 'NAME');
    declare.setFieldValue('number', 'TYPE');

    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('total', 'NAME');
    await settle();

    const socket = setOutput.getInput('VALUE')!.connection;
    expect(checkOf(socket)).toEqual(['Number']);
    expect(canConnect(workspace.newBlock('text').outputConnection, socket)).toBe(false);
    expect(canConnect(workspace.newBlock('math_number').outputConnection, socket)).toBe(true);
  });

  it('a `set output` for an undeclared port accepts anything', async () => {
    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('whatever', 'NAME');
    await settle();

    const socket = setOutput.getInput('VALUE')!.connection;
    expect(checkOf(socket)).toBeNull();
    expect(canConnect(workspace.newBlock('text').outputConnection, socket)).toBe(true);
  });

  it('two declarations that disagree produce no check rather than an invisible winner', async () => {
    const first = workspace.newBlock('noodl_define_output');
    first.setFieldValue('total', 'NAME');
    first.setFieldValue('number', 'TYPE');

    const second = workspace.newBlock('noodl_define_output');
    second.setFieldValue('total', 'NAME');
    second.setFieldValue('string', 'TYPE');

    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('total', 'NAME');
    await settle();

    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toBeNull();
  });

  it('the declaration changing re-types the socket', async () => {
    const declare = workspace.newBlock('noodl_define_output');
    declare.setFieldValue('total', 'NAME');
    declare.setFieldValue('number', 'TYPE');

    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('total', 'NAME');
    await settle();
    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toEqual(['Number']);

    declare.setFieldValue('string', 'TYPE');
    await settle();
    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toEqual(['String']);
  });
});

describe('LGC-005 — the migration guard', () => {
  let workspace: Blockly.Workspace;

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  afterEach(() => {
    workspace.dispose();
  });

  it('never severs a wire that is already there', async () => {
    // The shape of a program saved before checks existed: a text block feeding an output the
    // author later declares `number`.
    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('total', 'NAME');
    const text = workspace.newBlock('text');
    text.outputConnection!.connect(setOutput.getInput('VALUE')!.connection!);
    await settle();

    expect(text.outputConnection!.isConnected()).toBe(true);

    const declare = workspace.newBlock('noodl_define_output');
    declare.setFieldValue('total', 'NAME');
    declare.setFieldValue('number', 'TYPE');
    await settle();

    // Still connected, and the check stayed permissive rather than being applied and then
    // silently dropping the block on the floor.
    expect(text.outputConnection!.isConnected()).toBe(true);
    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toBeNull();
  });

  it('and applies the check as soon as the author disconnects it themselves', async () => {
    const setOutput = workspace.newBlock('noodl_set_output');
    setOutput.setFieldValue('total', 'NAME');
    const text = workspace.newBlock('text');
    text.outputConnection!.connect(setOutput.getInput('VALUE')!.connection!);

    const declare = workspace.newBlock('noodl_define_output');
    declare.setFieldValue('total', 'NAME');
    declare.setFieldValue('number', 'TYPE');
    await settle();
    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toBeNull();

    text.outputConnection!.disconnect();
    await settle();

    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toEqual(['Number']);
    expect(canConnect2(workspace, text.outputConnection, setOutput.getInput('VALUE')!.connection)).toBe(false);
  });
});

function canConnect2(
  workspace: Blockly.Workspace,
  a: Blockly.Connection | null,
  b: Blockly.Connection | null
): boolean {
  if (!a || !b) return false;
  return workspace.connectionChecker.canConnect(a, b, false);
}

describe('LGC-005 acceptance — the shipped example still loads intact', () => {
  const examplePath = path.resolve(
    __dirname,
    '../../../../docs/node-catalog/examples/code-logic-builder-greeting.json'
  );

  /**
   * `code-logic-builder-greeting.json` is the only saved Visual Function in the repository —
   * `project-examples/` and `library/` contain no `Logic Builder` node at all (grepped
   * 2026-08-11). It is therefore the whole migration surface this task has to clear, and the
   * acceptance criterion names it by name.
   */
  function greetingWorkspaceJson(): string {
    const example = JSON.parse(fs.readFileSync(examplePath, 'utf8'));
    const node = example.components[0].nodes.find((n: { type: string }) => n.type === 'Logic Builder');
    return node.parameters.workspace;
  }

  it('loads with every block still connected, and one settled tick changes nothing', async () => {
    const workspace = new Blockly.Workspace();
    const saved = JSON.parse(greetingWorkspaceJson());

    Blockly.serialization.workspaces.load(saved, workspace);
    const afterLoad = JSON.stringify(Blockly.serialization.workspaces.save(workspace));

    // The program is one stack: define input → define output → set output ← text_join ←
    // (text, get input). If a check had been applied over a live wire, a block would have
    // fallen out of the stack and reappeared as a second top-level block.
    expect(workspace.getTopBlocks(false).length).toBe(1);

    await settle();

    expect(workspace.getTopBlocks(false).length).toBe(1);
    expect(JSON.stringify(Blockly.serialization.workspaces.save(workspace))).toBe(afterLoad);

    // And the check that did land is the right one and admits what is already plugged in:
    // `greeting` is declared `string`, and `text_join` outputs `String`.
    const setOutput = workspace.getBlocksByType('noodl_set_output', false)[0];
    expect(checkOf(setOutput.getInput('VALUE')!.connection)).toEqual(['String']);
    expect(setOutput.getInput('VALUE')!.connection!.isConnected()).toBe(true);

    workspace.dispose();
  });
});
