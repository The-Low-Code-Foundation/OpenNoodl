/**
 * VFN-014 — the readable rendering of a program, graded against the one that runs.
 *
 * Four things are pinned here, and three of them are absences, so each one carries a control
 * that has been watched going red:
 *
 * 1. **No `__p` / `__s` in what *View Code* shows** (criterion 1), with the instrumented build
 *    beside it in the same test so "no probes" cannot pass by generating nothing.
 * 2. 🔴 **The stored program is byte-identical across a readable render** (criterion 3). This is
 *    the one that matters: `javascriptGenerator` is a module-level singleton, `withBlockOrigins`
 *    mutates it, and a wrapper that failed to put it back would silently change what the *next*
 *    flush writes to `project.json`. The negative control installs a leaky wrapper on purpose and
 *    requires the byte comparison to fail.
 * 3. **Both renderings compute the same thing** (criterion 4) — proved by *running* both, not by
 *    diffing strings, because the whole point of the probes is that they compute nothing.
 * 4. **An inlined saved block says which saved block it came from** (criterion 6), which is the
 *    finding the criterion-5 reproduce produced: `Outputs["result"]` was unfindable on the canvas
 *    because it is not on the canvas — it is inside `test1`.
 */

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { withBlockProbes } from '../../src/editor/src/views/BlocklyEditor/BlockProbes';
import { generateWithMyBlocks, initMyBlocks } from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';
import {
  renderReadableCode,
  renderReadableCodeFromJson,
  withBlockOrigins
} from '../../src/editor/src/views/BlocklyEditor/readableCode';
import type { DefinitionSource } from '../../src/editor/src/views/BlocklyEditor/myblocks/expand';
import type {
  BlocklyWorkspaceJson,
  MyBlockDefinition,
  MyBlockShape
} from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { MY_BLOCKS_CALL_STATEMENT } from '../../src/editor/src/views/BlocklyEditor/myblocks/references';

initNoodlBlocks();
initNoodlGenerators();
initMyBlocks();

/** The identity pair, exactly as the runtime supplies it when nothing is watching. */
const identityProbe = (_id: string, value: unknown) => value;

/**
 * Compile a generated program and collect what it wrote, plus the order it wrote it in.
 *
 * The signal order is collected as well as the outputs, because criterion 4 asks for *"same
 * outputs assigned, same signals sent, same order"* — and a comparison of final state alone
 * would pass a rendering that reordered everything.
 */
function run(code: string, inputs: Record<string, unknown> = {}) {
  const outputs: Record<string, unknown> = {};
  const order: string[] = [];
  const trap = new Proxy(outputs, {
    set(target, key, value) {
      order.push('set:' + String(key));
      target[key as string] = value;
      return true;
    }
  });

  const fn = new Function(
    'Inputs',
    'Outputs',
    'Noodl',
    'Variables',
    'Objects',
    'Arrays',
    'sendSignalOnOutput',
    '__triggerSignal__',
    '__p',
    '__s',
    code
  );

  fn(
    inputs,
    trap,
    { Variables: {}, Objects: {}, Arrays: {} },
    {},
    {},
    {},
    (name: string) => order.push('signal:' + name),
    'run',
    identityProbe,
    () => undefined
  );

  return { outputs, order };
}

function workspaceJson(blocks: unknown[]): BlocklyWorkspaceJson {
  return { blocks: { languageVersion: 0, blocks: blocks as never } };
}

function definition(
  id: string,
  name: string,
  body: BlocklyWorkspaceJson,
  shape: MyBlockShape = 'statement'
): MyBlockDefinition {
  return {
    formatVersion: 1,
    id,
    name,
    shape,
    params: [],
    requires: [],
    body,
    createdAt: '2026-08-13T00:00:00.000Z',
    updatedAt: '2026-08-13T00:00:00.000Z'
  };
}

function sourceOf(...definitions: MyBlockDefinition[]): DefinitionSource {
  const byId = new Map(definitions.map((d) => [d.id, d]));
  return { get: (id: string) => byId.get(id) };
}

const emptySource: DefinitionSource = { get: () => undefined };

/**
 * The screenshot's program, rebuilt as saved JSON.
 *
 * `set output total to (get input price) * (get input quantity)`, plus a call to a saved block
 * `test1` whose body is `define output result` → `set output result to 1 + 2`. That call is a
 * *top-level statement*, which is why its body arrives as a top-level stack in the generated
 * program — the criterion-5 answer, rebuilt so criterion 6 has the fixture it is about.
 */
const TEST1 = definition(
  'mb_r945r1pzjmnx2ya8',
  'test1',
  workspaceJson([
    {
      type: 'noodl_define_output',
      id: 'defResult000000000001',
      fields: { NAME: 'result', TYPE: 'number' },
      next: {
        block: {
          type: 'noodl_set_output',
          id: 'setResult00000000001',
          fields: { NAME: 'result' },
          inputs: {
            VALUE: {
              block: {
                type: 'math_arithmetic',
                id: 'addBlock000000000001',
                fields: { OP: 'ADD' },
                inputs: {
                  A: { block: { type: 'math_number', id: 'one00000000000000001', fields: { NUM: 1 } } },
                  B: { block: { type: 'math_number', id: 'two00000000000000001', fields: { NUM: 2 } } }
                }
              }
            }
          }
        }
      }
    }
  ])
);

function fixtureWorkspace(): BlocklyWorkspaceJson {
  return workspaceJson([
    {
      type: 'noodl_set_output',
      id: 'setTotal000000000001',
      fields: { NAME: 'total' },
      x: 40,
      y: 40,
      inputs: {
        VALUE: {
          block: {
            type: 'math_arithmetic',
            id: 'mulBlock000000000001',
            fields: { OP: 'MULTIPLY' },
            inputs: {
              A: { block: { type: 'noodl_get_input', id: 'getPrice000000000001', fields: { NAME: 'price' } } },
              B: { block: { type: 'noodl_get_input', id: 'getQty00000000000001', fields: { NAME: 'quantity' } } }
            }
          }
        }
      }
    },
    { type: MY_BLOCKS_CALL_STATEMENT, id: 'callTest1000000000001', extraState: { defId: TEST1.id }, x: 310, y: 50 }
  ]);
}

/** The instrumented build — what the flush writes to the node's `generatedCode` parameter. */
function instrumented(saved: BlocklyWorkspaceJson, source: DefinitionSource): string {
  const headless = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(saved as never, headless);
    const probed = withBlockProbes(() => generateWithMyBlocks(headless, saved, source));
    return probed.result.code as string;
  } finally {
    headless.dispose();
  }
}

describe('VFN-014 criterion 1 — View Code shows a program with no probes in it', () => {
  it('no __p and no __s, on the fixture that produced the report', () => {
    const saved = fixtureWorkspace();
    const source = sourceOf(TEST1);

    const readable = renderReadableCode(saved, source);
    const stored = instrumented(saved, source);

    // eslint-disable-next-line no-console
    console.log('[VFN-014] readable:\n' + readable.code);

    expect(readable.error).toBeUndefined();
    expect(readable.code).toBeDefined();
    expect(readable.code).not.toContain('__p(');
    expect(readable.code).not.toContain('__s(');

    // 🔴 The control on the assertion above: "no probes" is trivially true of an empty string, so
    // the instrumented build is measured in the same test and must be full of them.
    expect(stored).toContain('__p(');
    expect(stored).toContain('__s(');
    expect(readable.code!.trim().length).toBeGreaterThan(20);
  });

  it('and the gibberish identifiers go with them, because only the probes quoted them', () => {
    const saved = fixtureWorkspace();
    const source = sourceOf(TEST1);

    expect(instrumented(saved, source)).toContain('mulBlock000000000001');
    expect(renderReadableCode(saved, source).code).not.toContain('mulBlock000000000001');
  });

  it('a workspace with no saved blocks in it takes the same path', () => {
    const saved = workspaceJson([fixtureWorkspace().blocks!.blocks![0]]);
    const readable = renderReadableCode(saved, emptySource);

    expect(readable.error).toBeUndefined();
    expect(readable.code).toContain('Outputs["total"]');
    expect(readable.code).not.toContain('__p(');
  });

  it('an unopened node has an empty workspace parameter, which is a program and not an error', () => {
    // 🔴 `''` is the program with no blocks in it. Reporting it as a failure is how a refusal
    // publishes its silence — the defect this feature has shipped twice, one level down.
    expect(renderReadableCodeFromJson('', emptySource)).toEqual({ code: '' });
    expect(renderReadableCodeFromJson('   ', emptySource)).toEqual({ code: '' });
  });

  it('and unparseable JSON declines with undefined rather than an empty program', () => {
    const result = renderReadableCodeFromJson('{not json', emptySource);

    expect(result.error).toBeDefined();
    expect(result.code).toBeUndefined();
    expect(result.code).not.toBe('');
  });
});

describe('VFN-014 criterion 3 — the stored program is byte-identical across a readable render', () => {
  it('generate, render, generate again — the same bytes', () => {
    const saved = fixtureWorkspace();
    const source = sourceOf(TEST1);

    const before = instrumented(saved, source);
    renderReadableCode(saved, source);
    const after = instrumented(saved, source);

    expect(after).toBe(before);
  });

  it('twice more, because a generator leak could take a second call to show', () => {
    const saved = fixtureWorkspace();
    const source = sourceOf(TEST1);

    const before = instrumented(saved, source);
    renderReadableCode(saved, source);
    renderReadableCode(saved, source);
    expect(instrumented(saved, source)).toBe(before);
  });

  it('and the readable render does not mutate the workspace JSON it was handed', () => {
    const saved = fixtureWorkspace();
    const snapshot = JSON.stringify(saved);

    renderReadableCode(saved, sourceOf(TEST1));

    expect(JSON.stringify(saved)).toBe(snapshot);
  });

  /**
   * 🔴 NEGATIVE CONTROL. If this ever passes, the byte comparison above has stopped being able to
   * see a leaked generator and criterion 3 is being asserted by an instrument that measures
   * nothing. `withBlockProbes`' own docstring names this exact hazard — the generator is a
   * singleton shared with `DoIt` and with My Blocks' shape inference.
   */
  it('NEGATIVE CONTROL: a wrapper that forgets to restore the generator IS caught', () => {
    const saved = fixtureWorkspace();
    const source = sourceOf(TEST1);
    const before = instrumented(saved, source);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const g = javascriptGenerator as any;
    const original = g.blockToCode;

    try {
      g.blockToCode = function (block: Blockly.Block | null, thisOnly?: boolean) {
        const generated = original.call(this, block, thisOnly);
        if (!Array.isArray(generated) && generated !== '') return '/* leaked */ ' + generated;
        return generated;
      };

      expect(instrumented(saved, source)).not.toBe(before);
    } finally {
      g.blockToCode = original;
    }

    // And the restore itself works, so the control cannot poison the rest of the file.
    expect(instrumented(saved, source)).toBe(before);
  });

  it('refuses to run inside a probed generation rather than commenting the stored program', () => {
    const saved = fixtureWorkspace();
    const headless = new Blockly.Workspace();

    try {
      Blockly.serialization.workspaces.load(saved as never, headless);
      expect(() =>
        withBlockProbes(() => withBlockOrigins(new Map([['setTotal000000000001', 'test1']]), () => 'x'))
      ).toThrow(/must not run inside withBlockProbes/);
    } finally {
      headless.dispose();
    }

    // The refusal above happened inside `withBlockProbes`, which must still have restored.
    expect(instrumented(saved, sourceOf(TEST1))).toBe(instrumented(saved, sourceOf(TEST1)));
  });
});

describe('VFN-014 criterion 4 — the two renderings describe the same program', () => {
  it('same outputs, same values, same order — proved by running both', () => {
    const saved = fixtureWorkspace();
    const source = sourceOf(TEST1);

    const inputs = { price: 7, quantity: 3 };
    const clean = run(renderReadableCode(saved, source).code as string, inputs);
    const traced = run(instrumented(saved, source), inputs);

    expect(clean.outputs).toEqual(traced.outputs);
    expect(clean.order).toEqual(traced.order);

    // And the run is not vacuous: the fixture is the one from the report.
    expect(clean.outputs.total).toBe(21);
    expect(clean.outputs.result).toBe(3);
  });

  it('including a program that sends a signal, where order is the whole question', () => {
    const saved = workspaceJson([
      {
        type: 'noodl_set_output',
        id: 'setA00000000000000001',
        fields: { NAME: 'a' },
        inputs: { VALUE: { block: { type: 'math_number', id: 'n1000000000000000001', fields: { NUM: 1 } } } },
        next: {
          block: {
            type: 'noodl_send_signal',
            id: 'sig000000000000000001',
            fields: { NAME: 'done' },
            next: {
              block: {
                type: 'noodl_set_output',
                id: 'setB00000000000000001',
                fields: { NAME: 'b' },
                inputs: { VALUE: { block: { type: 'math_number', id: 'n2000000000000000001', fields: { NUM: 2 } } } }
              }
            }
          }
        }
      }
    ]);

    const clean = run(renderReadableCode(saved, emptySource).code as string);
    const traced = run(instrumented(saved, emptySource));

    expect(clean.order).toEqual(traced.order);
    expect(clean.order.length).toBeGreaterThan(2);
    expect(clean.outputs).toEqual(traced.outputs);
  });
});

describe('VFN-014 criterion 6 — a reader can tell which lines came from a saved block', () => {
  it('marks the inlined region with the definition’s name', () => {
    const readable = renderReadableCode(fixtureWorkspace(), sourceOf(TEST1)).code as string;

    expect(readable).toContain('// test1');
    // The marker is immediately above the region it names, which is the point of it.
    expect(readable).toMatch(/\/\/ test1\s*\n\s*Outputs\["result"\]/);
  });

  /**
   * ⚠️ The first version of this test asserted that no marker appeared *anywhere above* the
   * builder's own statement, and it failed — correctly. The inlined region is emitted first, so
   * its marker is above everything. The property that is actually wanted is narrower and is the
   * one a reader uses: the line immediately preceding a statement tells the truth about *that*
   * statement. Written down because the wrong version passed nothing and looked reasonable.
   */
  it('and the line above a statement the builder wrote is not a marker', () => {
    const readable = renderReadableCode(fixtureWorkspace(), sourceOf(TEST1)).code as string;
    const lines = readable.split('\n');
    const totalLine = lines.findIndex((line) => line.includes('Outputs["total"]'));

    expect(totalLine).toBeGreaterThan(0);

    let above = totalLine - 1;
    while (above >= 0 && lines[above].trim() === '') above--;

    expect(above).toBeGreaterThanOrEqual(0);
    expect(lines[above].trim().startsWith('//')).toBe(false);
  });

  it('one marker per region, not one per block', () => {
    const readable = renderReadableCode(fixtureWorkspace(), sourceOf(TEST1)).code as string;

    expect(readable.split('// test1').length - 1).toBe(1);
  });

  it('🔴 and the marker is display only — the stored program has no comment in it', () => {
    const saved = fixtureWorkspace();
    const stored = instrumented(saved, sourceOf(TEST1));

    expect(stored).not.toContain('// test1');
    expect(stored).not.toContain('/* test1');
  });

  it('a value-shaped saved block is marked inside the expression, where // would break it', () => {
    const doubler = definition(
      'mb_value_double',
      'double it',
      workspaceJson([
        {
          type: 'math_arithmetic',
          id: 'dblBlock000000000001',
          fields: { OP: 'MULTIPLY' },
          inputs: {
            A: { block: { type: 'math_number', id: 'dblA00000000000000001', fields: { NUM: 2 } } },
            B: { block: { type: 'math_number', id: 'dblB00000000000000001', fields: { NUM: 5 } } }
          }
        }
      ]),
      'value'
    );

    const saved = workspaceJson([
      {
        type: 'noodl_set_output',
        id: 'setDouble00000000001',
        fields: { NAME: 'doubled' },
        inputs: { VALUE: { block: { type: 'myblocks_call_value', id: 'callDbl000000000001', extraState: { defId: doubler.id } } } }
      }
    ]);

    const readable = renderReadableCode(saved, sourceOf(doubler)).code as string;

    // eslint-disable-next-line no-console
    console.log('[VFN-014] value region:\n' + readable);

    expect(readable).toContain('/* double it */');
    expect(readable).not.toContain('// double it');
    // And it still runs, which a `//` in mid-expression would not.
    expect(run(readable).outputs.doubled).toBe(10);
  });

  it('a definition name cannot close the comment it is inside', () => {
    const nasty = definition(
      'mb_nasty',
      'oops */ Outputs["pwned"] = 1; /*',
      workspaceJson([
        {
          type: 'math_number',
          id: 'nastyNum000000000001',
          fields: { NUM: 3 }
        }
      ]),
      'value'
    );

    const saved = workspaceJson([
      {
        type: 'noodl_set_output',
        id: 'setNasty000000000001',
        fields: { NAME: 'safe' },
        inputs: { VALUE: { block: { type: 'myblocks_call_value', id: 'callNasty00000000001', extraState: { defId: nasty.id } } } }
      }
    ]);

    const readable = renderReadableCode(saved, sourceOf(nasty)).code as string;
    const executed = run(readable);

    expect(executed.outputs.safe).toBe(3);
    expect(executed.outputs.pwned).toBeUndefined();
  });
});

describe('VFN-014 — a broken definition graph', () => {
  it('declines with an error and no code, exactly as the flush does', () => {
    const saved = workspaceJson([
      { type: MY_BLOCKS_CALL_STATEMENT, id: 'callGone000000000001', extraState: { defId: 'deleted-from-under-us' } }
    ]);

    const readable = renderReadableCode(saved, emptySource);

    expect(readable.error).toBeDefined();
    expect(readable.error!.name).toBe('MyBlocksMissingDefinitionError');
    expect(readable.code).toBeUndefined();
    expect(readable.code).not.toBe('');
  });
});
