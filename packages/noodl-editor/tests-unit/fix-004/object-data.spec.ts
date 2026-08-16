/**
 * FIX-004 §C — objects as data, in real headless Blockly with the real generator, and against
 * a real Noodl `Model` where the claim is about one.
 *
 * The gap: the Logic Builder could read a property whose name was typed into the block when
 * the program was written, and nothing else. It could not make an object, compute a key, ask
 * what keys an object has — `controls_forEach` takes `Array`, so an object could not be
 * iterated at all — or cross the JSON boundary.
 *
 * ## What is graded here that a re-implementation could not grade
 *
 * Three of these describes assert things about somebody else's code, and each has a control
 * that fails on the mistake it is guarding:
 *
 * 1. **`in` is inverted on a Noodl Object.** The block generates `hasOwnProperty.call`; the
 *    spec asserts `in` gives the *wrong* answer beside it, so a later simplification to the
 *    shorter operator turns this suite red instead of shipping a block that says "no" about
 *    every App Object.
 * 2. **`{}` at the start of a statement is a block, not an object.** The empty-object block
 *    emits `({})`; the spec compiles both forms and requires the bare one to be a SyntaxError.
 * 3. **`Object.keys` on a Model proxy returns the data keys.** The whole iterate-an-object
 *    story rests on the proxy's `ownKeys`/`getOwnPropertyDescriptor` traps, which are not ours.
 */
import * as Blockly from 'blockly';

import Model from '@noodl/runtime/src/model';

import { buildToolbox, DEFAULT_TOOLBOX_LABELS } from '../../src/editor/src/views/BlocklyEditor/BlocklyToolbox';
import { isHattableBlockType } from '../../src/editor/src/views/BlocklyEditor/hatMigration';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateCode, initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';
import {
  jsonParseExpression,
  jsonStringifyExpression,
  objectHasPropertyExpression,
  objectMembersExpression,
  objectMembersOptions,
  NEW_OBJECT_EXPRESSION
} from '../../src/editor/src/views/BlocklyEditor/objectData';

initNoodlBlocks();
initNoodlGenerators();

/** Every block type FIX-004 §C adds. */
const SLICE_C_BLOCKS = [
  'noodl_new_object',
  'noodl_get_object_property_expr',
  'noodl_set_object_property_expr',
  'noodl_object_members',
  'noodl_object_has_property',
  'noodl_json_parse',
  'noodl_json_stringify'
];

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = new Blockly.Workspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

/** A text literal block carrying `value`. */
function text(workspace: Blockly.Workspace, value: string): Blockly.Block {
  const block = workspace.newBlock('text');
  block.setFieldValue(value, 'TEXT');
  return block;
}

function connect(parent: Blockly.Block, input: string, child: Blockly.Block): void {
  parent.getInput(input)!.connection!.connect(child.outputConnection!);
}

/** The named category's flat list of block types, from the built toolbox. */
function categoryBlocks(name: string): string[] {
  const toolbox = buildToolbox(DEFAULT_TOOLBOX_LABELS) as any;
  const found = toolbox.contents.find((node: any) => node.name === name);
  if (!found) return [];
  return (found.contents ?? []).map((child: any) => child.type);
}

/**
 * Run generated code and report what it wrote to `Outputs`.
 *
 * The same shape `logic-builder.ts` compiles with — `new Function` over the generated string,
 * with `Outputs` as a parameter — so what runs here is what runs in the app.
 */
function runProgram(code: string): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  new Function('Outputs', 'Noodl', code)(outputs, {});
  return outputs;
}

describe('FIX-004 §C — the toolbox offers every new block, in the right places', () => {
  it('registers all seven', () => {
    for (const type of SLICE_C_BLOCKS) expect(Blockly.Blocks[type]).toBeDefined();
  });

  it('gives them a Data category next to Lists', () => {
    const data = categoryBlocks('Data');
    expect(data).toEqual([
      'noodl_new_object',
      'noodl_get_object_property_expr',
      'noodl_set_object_property_expr',
      'noodl_object_members',
      'noodl_object_has_property',
      'noodl_json_parse',
      'noodl_json_stringify'
    ]);
  });

  /**
   * ⚠️ **And adds nothing to the three seam categories**, which is a decision rather than an
   * omission — see the note above `noodlObjects` in `BlocklyToolbox.ts`.
   *
   * `tests-unit/vfn-012/browser-blocks.spec.ts` holds those three byte-identical to their
   * VFN-012 contents. That fence is stricter than the claim in its own title (*"changes no
   * existing block type id"* — which an addition does not do), but relaxing another phase's
   * guard so one's own change fits through it is the wrong way round. This asserts the same
   * thing from this side, so if that fence is ever deliberately loosened, the decision recorded
   * here is loosened with it rather than drifting quietly.
   */
  it('leaves App Objects exactly as VFN-012 left it', () => {
    expect(categoryBlocks('App Objects')).toEqual([
      'noodl_get_object',
      'noodl_get_object_property',
      'noodl_set_object_property'
    ]);
  });

  /**
   * Acceptance 3's shape, applied to §C. A statement block absent from `HATTABLE_BLOCK_TYPES`
   * is never wrapped by migration or seeding and sits orphaned under no hat.
   */
  it('puts the one statement block on the hattable list and none of the six value blocks', () => {
    withWorkspace((workspace) => {
      for (const type of SLICE_C_BLOCKS) {
        const isStatement = workspace.newBlock(type).previousConnection !== null;
        expect([type, isStatement]).toEqual([type, type === 'noodl_set_object_property_expr']);
        expect([type, isHattableBlockType(type)]).toEqual([type, type === 'noodl_set_object_property_expr']);
      }
    });
  });
});

describe('FIX-004 §C — an object can be made, written to and read back', () => {
  it('generates a parenthesised empty object', () => {
    expect(NEW_OBJECT_EXPRESSION).toBe('({})');
  });

  /**
   * 🔴 The reason for those parentheses, as a control pair rather than as a comment.
   *
   * `noodl_set_object_property_expr` puts the object socket at the very start of a statement.
   * A bare `{}` there is parsed as an empty **block**, and `["a"] = 1` after it is an invalid
   * assignment target — so the whole program fails to compile, with a message about the
   * assignment rather than about the block the author dropped.
   */
  it('would be a SyntaxError without them, and is not with them', () => {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    expect(() => new Function('{}["a"] = 1;')).toThrow();
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    expect(() => new Function('({})["a"] = 1;')).not.toThrow();
  });

  it('sets a computed key on a new object and reads it back', () => {
    const code = withWorkspace((workspace) => {
      const set = workspace.newBlock('noodl_set_object_property_expr');
      connect(set, 'KEY', text(workspace, 'colour'));
      connect(set, 'OBJECT', workspace.newBlock('noodl_new_object'));
      connect(set, 'VALUE', text(workspace, 'red'));
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(code).toContain("({})['colour'] = 'red';");
    // Compiles, which is the property the parentheses exist for.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    expect(() => new Function(code)).not.toThrow();
  });

  it('reads a property at a key the program works out', () => {
    const code = withWorkspace((workspace) => {
      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('result', 'NAME');
      const get = workspace.newBlock('noodl_get_object_property_expr');
      const parse = workspace.newBlock('noodl_json_parse');
      connect(parse, 'TEXT', text(workspace, '{"a":1,"b":2}'));
      connect(get, 'OBJECT', parse);
      /**
       * The key is a value socket, not a field — that is the whole of this block, so the key
       * here is deliberately one that **does not appear as a literal anywhere in the generated
       * source**: `'B'` lower-cased at run time. The old block could not express this at all.
       */
      const key = workspace.newBlock('text_changeCase');
      key.setFieldValue('LOWERCASE', 'CASE');
      connect(key, 'TEXT', text(workspace, 'B'));
      connect(get, 'KEY', key);
      connect(setOutput, 'VALUE', get);
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(code).toContain('JSON.parse');
    expect(code).not.toContain("'b'");
    expect(runProgram(code)).toEqual({ result: 2 });
  });

  /**
   * The empty socket reads as `undefined`, not as `{}`.
   *
   * `noodl_get_object_property` defaults to `'{}'` and therefore answers `undefined` from a
   * half-built program without complaint. These blocks throw instead, which
   * `logic-builder.ts` turns into `_fail('logic-builder/blocks-threw', …)` — the node's `error`
   * output and `Failure` signal both say a socket is empty.
   */
  it('reads an unplugged object socket as undefined rather than as a plausible empty object', () => {
    const code = withWorkspace((workspace) => {
      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('result', 'NAME');
      connect(setOutput, 'VALUE', workspace.newBlock('noodl_get_object_property_expr'));
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(code).toContain('undefined[undefined]');
    expect(() => runProgram(code)).toThrow();
  });
});

describe('FIX-004 §C — an object can finally be iterated', () => {
  it('generates Object.keys and Object.values from the shared table', () => {
    expect(objectMembersExpression('KEYS', 'o')).toBe('Object.keys(o)');
    expect(objectMembersExpression('VALUES', 'o')).toBe('Object.values(o)');
  });

  it('falls back to the default mode rather than emitting nothing for an unknown mode', () => {
    expect(objectMembersExpression('FROM_A_LATER_VERSION', 'o')).toBe('Object.keys(o)');
  });

  it('offers both modes in the dropdown, so no mode is generator-only', () => {
    expect(objectMembersOptions().map(([, value]) => value)).toEqual(['KEYS', 'VALUES']);
  });

  /**
   * The point of the block: `controls_forEach`'s `LIST` socket checks `['Array']`, so an object
   * was not iterable at all before this.
   *
   * A control pair over **one** variable — the type of the block offered — into two sockets in
   * the same state. `isConnected()` is the oracle, not `connect()`'s return value; see the trap
   * recorded below it.
   */
  it('produces an Array, which is what For each demands, where text is refused', () => {
    withWorkspace((workspace) => {
      const members = workspace.newBlock('noodl_object_members');
      expect(members.outputConnection!.getCheck()).toEqual(['Array']);
      expect(workspace.newBlock('controls_forEach').getInput('LIST')!.connection!.getCheck()).toEqual(['Array']);

      workspace.newBlock('controls_forEach').getInput('LIST')!.connection!.connect(members.outputConnection!);
      expect(members.outputConnection!.isConnected()).toBe(true);

      const refused = text(workspace, 'x');
      workspace.newBlock('controls_forEach').getInput('LIST')!.connection!.connect(refused.outputConnection!);
      expect(refused.outputConnection!.isConnected()).toBe(false);
    });
  });

  /**
   * 🔴 **`Connection.connect`'s return value is not an oracle, and this records why the test
   * above does not use it.**
   *
   * On an *empty* socket it returns `false` for a refused pairing. On an **occupied** socket it
   * returns `true` while refusing — the offered block is not connected and the incumbent stays
   * put, but the caller is told it succeeded. A control written as
   * `expect(socket.connect(wrongBlock)).toBe(false)` after a successful connect therefore fails
   * on correct behaviour, and one written as `expect(…).toThrow()` fails too, because it never
   * throws. All three readings were measured in this Blockly.
   */
  it('reports success from connect() on an occupied socket even when it refuses', () => {
    withWorkspace((workspace) => {
      const socket = workspace.newBlock('controls_forEach').getInput('LIST')!.connection!;
      const members = workspace.newBlock('noodl_object_members');
      const wrong = text(workspace, 'x');

      expect(socket.connect(members.outputConnection!)).toBe(true);
      // Same call, same socket, a block the check refuses — and still `true`.
      expect(socket.connect(wrong.outputConnection!)).toBe(true);
      // What actually happened, which is the opposite of what the return value said.
      expect(wrong.outputConnection!.isConnected()).toBe(false);
      expect(socket.targetBlock()!.type).toBe('noodl_object_members');
    });
  });

  it('walks a real Noodl Object end to end', () => {
    const record = (Model as any).get('fix004c-iteration');
    record.set('title', 'hello');
    record.set('count', 3);

    // The claim the whole feature rests on, and it is the Model proxy's, not ours:
    // `ownKeys` reports `target.data`, and `getOwnPropertyDescriptor` makes those keys
    // enumerable, so `Object.keys` sees the author's fields and not the model's plumbing.
    expect(Object.keys(record)).toEqual(['title', 'count']);
    expect(Object.values(record)).toEqual(['hello', 3]);
    expect(record['title']).toBe('hello');
  });
});

describe('FIX-004 §C — has property', () => {
  it('generates hasOwnProperty.call, asking the language rather than the value', () => {
    expect(objectHasPropertyExpression('o', 'k')).toBe('Object.prototype.hasOwnProperty.call(o, k)');
  });

  /**
   * 🔴 **The measurement that decides the generator, with `in` as its control.**
   *
   * `Noodl.Objects[id]` is a Model proxy, and `_modelProxyHandler` implements `get`, `set`,
   * `ownKeys` and `getOwnPropertyDescriptor` — but **no `has` trap**. So `in` falls through to
   * the instance, and answers exactly backwards: `false` for every property the author put
   * there, `true` for the model's own `data`. A block generating `in` would report that no App
   * Object has any property, and this spec is what stops the shorter operator looking like a
   * safe simplification later.
   */
  it('answers correctly on a Noodl Object, where `in` answers backwards', () => {
    const record = (Model as any).get('fix004c-has-property');
    record.set('title', 'hello');

    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const has = new Function('o', 'k', `return ${objectHasPropertyExpression('o', 'k')};`);
    expect(has(record, 'title')).toBe(true);
    expect(has(record, 'nope')).toBe(false);

    // The control. If these two ever start agreeing with the two above, the trap is gone and
    // the generator may be simplified — until then it must not be.
    expect('title' in (record as object)).toBe(false);
    expect('data' in (record as object)).toBe(true);
  });

  it('answers correctly on a plain object too', () => {
    const code = withWorkspace((workspace) => {
      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('found', 'NAME');
      const has = workspace.newBlock('noodl_object_has_property');
      const parse = workspace.newBlock('noodl_json_parse');
      connect(parse, 'TEXT', text(workspace, '{"a":1}'));
      connect(has, 'OBJECT', parse);
      connect(has, 'KEY', text(workspace, 'a'));
      connect(setOutput, 'VALUE', has);
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(runProgram(code)).toEqual({ found: true });
  });
});

describe('FIX-004 §C — the JSON boundary', () => {
  it('generates parse and stringify', () => {
    expect(jsonParseExpression('t')).toBe('JSON.parse(t)');
    expect(jsonStringifyExpression('v')).toBe('JSON.stringify(v)');
  });

  it('declares text out of stringify and nothing out of parse', () => {
    withWorkspace((workspace) => {
      expect(workspace.newBlock('noodl_json_stringify').outputConnection!.getCheck()).toEqual(['String']);
      // 🔴 `null`, not `Object`: parse legitimately returns a list, a number or a string, and
      // an `Object` check would refuse a JSON array — the commonest payload there is.
      expect(workspace.newBlock('noodl_json_parse').outputConnection!.getCheck()).toBeNull();
    });
  });

  /**
   * ⚠️ Malformed text throws, deliberately, and this records that the throw is the *design*.
   * `logic-builder.ts` catches it into `_fail('logic-builder/blocks-threw', …)`, so a bad
   * string is reported on the node's `error` output, its `Failure` signal and the editor's
   * runtime-error channel. Swallowing it into `null` here would replace three visible failures
   * with a silent empty value.
   */
  it('throws on malformed JSON rather than answering null', () => {
    const code = withWorkspace((workspace) => {
      const setOutput = workspace.newBlock('noodl_set_output');
      setOutput.setFieldValue('result', 'NAME');
      const parse = workspace.newBlock('noodl_json_parse');
      connect(parse, 'TEXT', text(workspace, 'not json at all'));
      connect(setOutput, 'VALUE', parse);
      return generateCode(workspace as Blockly.WorkspaceSvg);
    });
    expect(() => runProgram(code)).toThrow();

    // The positive arm, same block, valid text.
    expect(runProgram(code.replace('not json at all', '{}'))).toEqual({ result: {} });
  });

  /**
   * ⚠️ A round trip through JSON does not give back what went in when the value is an App
   * Object: `Model.prototype.toJSON` adds `id`. Recorded because it is stated in the block's
   * tooltip and somebody will one day check whether the tooltip is still true.
   */
  it('carries an App Object id into the text', () => {
    const record = (Model as any).get('fix004c-stringify');
    record.set('title', 'hello');
    expect(JSON.parse(JSON.stringify(record))).toEqual({ title: 'hello', id: 'fix004c-stringify' });
  });
});
