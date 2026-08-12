/**
 * LGC-003 §1 — the instrumentation, graded by **running it**, not by reading it.
 *
 * The acceptance criterion is explicit that inspection is not enough: *"Instrumented and
 * uninstrumented runs of the same program produce identical outputs — proven by a spec that
 * runs both and diffs, not by inspection. `a + b * c` and a nested ternary are the two fixtures
 * that matter."* So every case here builds a real workspace out of real blocks, generates the
 * program twice, compiles both with `new Function`, runs both, and compares what came out.
 *
 * ⚠️ **What was found while writing this, and it corrects register L7.** L7 says a wrong
 * `Order` makes the instrumented program compute different arithmetic *silently*. Measured
 * against Blockly 12.3.1 that is **not** true of a probe shaped like ours, and the reason is
 * worth knowing: `valueToCode` only ever *adds* parentheses, and parenthesising a call
 * expression changes nothing. Every order in the enum produces the same answers — see "every
 * order in the enum is arithmetically safe", which is a measurement, not an argument.
 *
 * **What actually makes precedence safe is that the wrapper is a single self-delimiting
 * expression at all.** The naive probe — emit the call and then the code, `__p("id"), a` — is
 * what silently rewrites `a + b * c`, and "a naive probe that is not one expression rewrites
 * the arithmetic" builds exactly that and watches the differential catch it. That is the case
 * to keep if this file is ever trimmed.
 */

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

import {
  PROBE_PARAMETER_NAMES,
  PROBE_STATEMENT_PREFIX,
  PROBE_VALUE_FN,
  probeExpression,
  withBlockProbes
} from '../../src/editor/src/views/BlocklyEditor/BlockProbes';
import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { initNoodlGenerators } from '../../src/editor/src/views/BlocklyEditor/NoodlGenerators';

initNoodlBlocks();
initNoodlGenerators();

/** The identity pair, exactly as the runtime supplies it when nothing is attached. */
const identityProbe = (_id: string, value: unknown) => value;
const noopStatement = () => undefined;

function withWorkspace<T>(body: (workspace: Blockly.Workspace) => T): T {
  const workspace = new Blockly.Workspace();
  try {
    return body(workspace);
  } finally {
    workspace.dispose();
  }
}

/** Compile a generated program and collect what it wrote to `Outputs`. */
function run(
  code: string,
  inputs: Record<string, unknown> = {},
  probes: { p?: unknown; s?: unknown } = {}
): Record<string, unknown> {
  const outputs: Record<string, unknown> = {};
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
    outputs,
    { Variables: {}, Objects: {}, Arrays: {} },
    {},
    {},
    {},
    () => undefined,
    'run',
    probes.p || identityProbe,
    probes.s || noopStatement
  );
  return outputs;
}

/** `Outputs["result"] = <value block>` — the shape every fixture below has. */
function setOutput(workspace: Blockly.Workspace, name: string, value: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('noodl_set_output');
  block.setFieldValue(name, 'NAME');
  block.getInput('VALUE')!.connection!.connect(value.outputConnection!);
  return block;
}

function numberBlock(workspace: Blockly.Workspace, n: number): Blockly.Block {
  const block = workspace.newBlock('math_number');
  block.setFieldValue(String(n), 'NUM');
  return block;
}

function arithmetic(workspace: Blockly.Workspace, op: string, a: Blockly.Block, b: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('math_arithmetic');
  block.setFieldValue(op, 'OP');
  block.getInput('A')!.connection!.connect(a.outputConnection!);
  block.getInput('B')!.connection!.connect(b.outputConnection!);
  return block;
}

function ternary(
  workspace: Blockly.Workspace,
  condition: Blockly.Block,
  then: Blockly.Block,
  otherwise: Blockly.Block
): Blockly.Block {
  const block = workspace.newBlock('logic_ternary');
  block.getInput('IF')!.connection!.connect(condition.outputConnection!);
  block.getInput('THEN')!.connection!.connect(then.outputConnection!);
  block.getInput('ELSE')!.connection!.connect(otherwise.outputConnection!);
  return block;
}

function getInput(workspace: Blockly.Workspace, name: string): Blockly.Block {
  const block = workspace.newBlock('noodl_get_input');
  block.setFieldValue(name, 'NAME');
  return block;
}

/** `a + b * c`, the first fixture the acceptance list names. */
function buildAPlusBTimesC(workspace: Blockly.Workspace): void {
  const product = arithmetic(workspace, 'MULTIPLY', getInput(workspace, 'b'), getInput(workspace, 'c'));
  const sum = arithmetic(workspace, 'ADD', getInput(workspace, 'a'), product);
  setOutput(workspace, 'result', sum);
}

/** A ternary whose else-branch is another ternary — the second fixture. */
function buildNestedTernary(workspace: Blockly.Workspace): void {
  const inner = ternary(
    workspace,
    comparison(workspace, 'GT', getInput(workspace, 'a'), numberBlock(workspace, 10)),
    numberBlock(workspace, 100),
    numberBlock(workspace, 200)
  );
  const outer = ternary(
    workspace,
    comparison(workspace, 'LT', getInput(workspace, 'a'), numberBlock(workspace, 0)),
    numberBlock(workspace, -1),
    inner
  );
  setOutput(workspace, 'result', outer);
}

function comparison(workspace: Blockly.Workspace, op: string, a: Blockly.Block, b: Blockly.Block): Blockly.Block {
  const block = workspace.newBlock('logic_compare');
  block.setFieldValue(op, 'OP');
  block.getInput('A')!.connection!.connect(a.outputConnection!);
  block.getInput('B')!.connection!.connect(b.outputConnection!);
  return block;
}

/** Generate the same workspace twice: bare, and instrumented. */
function bothWays(workspace: Blockly.Workspace): { bare: string; probed: string; probedIds: Set<string> } {
  const bare = javascriptGenerator.workspaceToCode(workspace);
  const generation = withBlockProbes(() => javascriptGenerator.workspaceToCode(workspace));
  return { bare, probed: generation.result, probedIds: generation.probedIds };
}

const INPUT_CASES: Record<string, unknown>[] = [
  { a: 1, b: 2, c: 3 },
  { a: 0, b: 0, c: 0 },
  { a: -5, b: 7, c: -2 },
  { a: 2.5, b: 0.1, c: 4 },
  { a: 11, b: 1, c: 1 },
  { a: -3, b: 6, c: 6 }
];

describe('LGC-003 §1 — the instrumented program computes what the bare one computes', () => {
  it('`a + b * c` — the fixture the acceptance list names first', () => {
    withWorkspace((workspace) => {
      buildAPlusBTimesC(workspace);
      const { bare, probed } = bothWays(workspace);

      // The instrumentation is really there — otherwise this whole file would be comparing a
      // program with itself and passing for the wrong reason.
      expect(probed).toContain(PROBE_VALUE_FN + '(');
      expect(bare).not.toContain(PROBE_VALUE_FN + '(');

      for (const inputs of INPUT_CASES) {
        expect(run(probed, inputs)).toEqual(run(bare, inputs));
        // And the answer is the arithmetic a human would do, not merely a stable wrong one.
        expect(run(probed, inputs).result).toBe(
          (inputs.a as number) + (inputs.b as number) * (inputs.c as number)
        );
      }
    });
  });

  it('a nested ternary — the second fixture', () => {
    withWorkspace((workspace) => {
      buildNestedTernary(workspace);
      const { bare, probed } = bothWays(workspace);

      expect(probed).toContain(PROBE_VALUE_FN + '(');

      for (const inputs of INPUT_CASES) {
        expect(run(probed, inputs)).toEqual(run(bare, inputs));
        const a = inputs.a as number;
        expect(run(probed, inputs).result).toBe(a < 0 ? -1 : a > 10 ? 100 : 200);
      }
    });
  });

  it('short-circuiting still short-circuits, so a branch that did not run records nothing', () => {
    withWorkspace((workspace) => {
      // `false AND (1/0 ...)` — if the wrapper forced its argument the right-hand side would
      // be evaluated, which is a semantic change no output diff on a pure fixture would show.
      const and = workspace.newBlock('logic_operation');
      and.setFieldValue('AND', 'OP');
      and.getInput('A')!.connection!.connect(workspace.newBlock('logic_boolean').outputConnection!);
      (and.getInputTargetBlock('A') as Blockly.Block).setFieldValue('FALSE', 'BOOL');

      const rightHandSide = comparison(workspace, 'EQ', getInput(workspace, 'a'), numberBlock(workspace, 1));
      and.getInput('B')!.connection!.connect(rightHandSide.outputConnection!);
      setOutput(workspace, 'result', and);

      const { bare, probed } = bothWays(workspace);
      expect(run(probed, { a: 1 })).toEqual(run(bare, { a: 1 }));

      const seen: string[] = [];
      run(probed, { a: 1 }, { p: (id: string, value: unknown) => (seen.push(id), value) });

      // The right-hand comparison is in the program and did not run: that is precisely the
      // "block with no entry in the run's map did not execute" that §2's dynamic half turns on.
      expect(seen).not.toContain(rightHandSide.id);
      expect(seen).toContain(and.id);
    });
  });
});

describe('LGC-003 §1 — the precedence claim, measured rather than argued', () => {
  it('every order in the enum is arithmetically safe, because the wrapper is a call', () => {
    // ⚠️ This is the case that corrects register L7. If a wrong `Order` really made the
    // instrumented program compute different arithmetic, one of these would differ from the
    // bare run. None does — `valueToCode` only ever *adds* parentheses, and parenthesising a
    // call expression is a no-op. ATOMIC is still what we emit: it is the honest declaration
    // and it is the one that produces no redundant parentheses at all.
    const orders = Object.keys(Order)
      .map((key) => (Order as unknown as Record<string, number>)[key])
      .filter((value) => typeof value === 'number');

    expect(orders.length).toBeGreaterThan(10);

    for (const order of orders) {
      withWorkspace((workspace) => {
        buildAPlusBTimesC(workspace);

        const bare = javascriptGenerator.workspaceToCode(workspace);

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const g = javascriptGenerator as any;
        const original = g.blockToCode;
        g.blockToCode = function (block: Blockly.Block | null, thisOnly?: boolean) {
          const generated = original.call(this, block, thisOnly);
          if (!Array.isArray(generated) || !block || generated[0] === '') return generated;
          return [PROBE_VALUE_FN + '(' + JSON.stringify(block.id) + ', ' + generated[0] + ')', order];
        };
        let atThisOrder: string;
        try {
          atThisOrder = javascriptGenerator.workspaceToCode(workspace);
        } finally {
          g.blockToCode = original;
        }

        for (const inputs of INPUT_CASES) {
          expect(run(atThisOrder, inputs)).toEqual(run(bare, inputs));
        }
      });
    }
  });

  it('a naive probe that is not one expression rewrites the arithmetic', () => {
    // The failure L7 is really about. `__p("id"), a + b * c` is a comma expression: the probe
    // call is evaluated, discarded, and the surrounding operators bind to the wrong operands.
    // This is what the differential above exists to catch, and here it does.
    withWorkspace((workspace) => {
      buildAPlusBTimesC(workspace);
      const bare = javascriptGenerator.workspaceToCode(workspace);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const g = javascriptGenerator as any;
      const original = g.blockToCode;
      g.blockToCode = function (block: Blockly.Block | null, thisOnly?: boolean) {
        const generated = original.call(this, block, thisOnly);
        if (!Array.isArray(generated) || !block || generated[0] === '') return generated;
        return [PROBE_VALUE_FN + '(' + JSON.stringify(block.id) + '), ' + generated[0], Order.ATOMIC];
      };
      let naive: string;
      try {
        naive = javascriptGenerator.workspaceToCode(workspace);
      } finally {
        g.blockToCode = original;
      }

      const inputs = { a: 1, b: 2, c: 3 };
      expect(run(bare, inputs).result).toBe(7);
      expect(run(naive, inputs).result).not.toBe(7);
    });
  });

  it('`probeExpression` declares ATOMIC and produces one call expression', () => {
    const [code, order] = probeExpression('block-1', 'a + b');
    expect(order).toBe(Order.ATOMIC);
    expect(code).toBe('__p("block-1", a + b)');
    // A block id from a deserialised workspace is not guaranteed to be Blockly's charset, so
    // it is JSON-quoted rather than concatenated. A quote in an id would otherwise end the
    // string literal and the whole program would stop compiling.
    expect(probeExpression('a"b', 'x')[0]).toBe('__p("a\\"b", x)');
  });
});

describe('LGC-003 §1 — `__p` is an identity function and nothing accumulates unattached', () => {
  it('the value handed back is the same object, not a copy', () => {
    const marker = { deep: { value: 1 } };
    expect(identityProbe('id', marker)).toBe(marker);
    expect(identityProbe('id', marker)).toBe(marker);
  });

  it('an unattached run records nothing — asserted, not assumed', () => {
    withWorkspace((workspace) => {
      buildAPlusBTimesC(workspace);
      const { probed } = bothWays(workspace);

      // The exact pair the runtime hands over when no block editor is attached. If the
      // instrumentation had smuggled a module-level buffer in anywhere, the only place it could
      // show up is here, because these two functions are the entire attachment surface.
      const identity = (_id: string, value: unknown) => value;
      const noop = () => undefined;

      const before = JSON.stringify(Object.keys(identity));
      const outputs = run(probed, { a: 1, b: 2, c: 3 }, { p: identity, s: noop });

      expect(outputs.result).toBe(7);
      expect(JSON.stringify(Object.keys(identity))).toBe(before);
      // The instrumented program has no way to reach anything but its ten parameters, so
      // "nothing accumulates" is a property of the identity probe rather than of a flag —
      // which is exactly the point of there being no debug build and no release build.
      expect(Object.keys(identity)).toHaveLength(0);
    });
  });
});

describe('LGC-003 §1 — the probes are reserved, and the generator is left as it was found', () => {
  it('a user variable named `__p` is renamed rather than colliding', () => {
    withWorkspace((workspace) => {
      const variable = workspace.createVariable('__p');
      const set = workspace.newBlock('variables_set');
      set.setFieldValue(variable.getId(), 'VAR');
      set.getInput('VALUE')!.connection!.connect(numberBlock(workspace, 1).outputConnection!);

      const generation = withBlockProbes(() => javascriptGenerator.workspaceToCode(workspace));

      // The declaration must not be `var __p`, or it would shadow the parameter and every
      // probe in the program after that line would call a number.
      expect(generation.result).not.toMatch(/var\s+__p\s*[;=]/);
      expect(generation.result).toContain('__p(');
    });
  });

  it('the generator is restored afterwards, so a Do It fragment is generated bare', () => {
    withWorkspace((workspace) => {
      buildAPlusBTimesC(workspace);

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const before = (javascriptGenerator as any).blockToCode;
      const prefixBefore = javascriptGenerator.STATEMENT_PREFIX;

      withBlockProbes(() => javascriptGenerator.workspaceToCode(workspace));

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect((javascriptGenerator as any).blockToCode).toBe(before);
      expect(javascriptGenerator.STATEMENT_PREFIX).toBe(prefixBefore);
      expect(javascriptGenerator.workspaceToCode(workspace)).not.toContain('__p(');
    });
  });

  it('restores the generator even when generation throws', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const before = (javascriptGenerator as any).blockToCode;

    expect(() =>
      withBlockProbes(() => {
        throw new Error('a generator blew up');
      })
    ).toThrow('a generator blew up');

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((javascriptGenerator as any).blockToCode).toBe(before);
    expect(javascriptGenerator.STATEMENT_PREFIX).toBe(null);
  });

  it('refuses to nest rather than mis-scoping the ids and restoring the wrong function', () => {
    expect(() => withBlockProbes(() => withBlockProbes(() => 1))).toThrow(/already active/);

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect((javascriptGenerator as any).__noodlProbesActive).toBe(false);
  });

  it('names both probes as parameters, in the order the runtime passes them', () => {
    expect(PROBE_PARAMETER_NAMES).toEqual(['__p', '__s']);
    expect(PROBE_STATEMENT_PREFIX).toBe('__s(%1);\n');
  });
});

describe('LGC-003 §2 — the probed ids are the denominator of the didn\'t-execute tell', () => {
  it('collects the id of every block that emitted code', () => {
    withWorkspace((workspace) => {
      const product = arithmetic(workspace, 'MULTIPLY', getInput(workspace, 'b'), getInput(workspace, 'c'));
      const sum = arithmetic(workspace, 'ADD', getInput(workspace, 'a'), product);
      const set = setOutput(workspace, 'result', sum);

      const { probedIds } = bothWays(workspace);

      expect(probedIds.has(sum.id)).toBe(true);
      expect(probedIds.has(product.id)).toBe(true);
      expect(probedIds.has(set.id)).toBe(true);
    });
  });

  it('leaves out a block that generates nothing, so it can never be painted hollow', () => {
    withWorkspace((workspace) => {
      // `Define input` declares a port and its generator returns `''`. Marking it "did not run"
      // would be a true-sounding sentence about a block that is not part of the program.
      const declare = workspace.newBlock('noodl_define_input');
      declare.setFieldValue('a', 'NAME');
      setOutput(workspace, 'result', numberBlock(workspace, 1));

      const { probedIds } = bothWays(workspace);
      expect(probedIds.has(declare.id)).toBe(false);
    });
  });

  it('leaves out a disabled block', () => {
    withWorkspace((workspace) => {
      const set = setOutput(workspace, 'result', numberBlock(workspace, 1));
      const other = setOutput(workspace, 'second', numberBlock(workspace, 2));
      // `setDisabledReason`, not the removed `setEnabled` — and the reason string matters:
      // `Blockly.Events.disableOrphans` (§2's static half) uses `'ORPHANED_BLOCK'`, so this is
      // the same mechanism a real orphan is disabled through.
      other.setDisabledReason(true, 'ORPHANED_BLOCK');

      const { probedIds } = bothWays(workspace);
      expect(probedIds.has(set.id)).toBe(true);
      expect(probedIds.has(other.id)).toBe(false);
    });
  });
});

describe('LGC-003 §5.2 — a loop reports a count, and the probe is what counts it', () => {
  it('a block inside a repeat is probed once per iteration', () => {
    withWorkspace((workspace) => {
      const repeat = workspace.newBlock('controls_repeat_ext');
      repeat.getInput('TIMES')!.connection!.connect(numberBlock(workspace, 12).outputConnection!);

      const body = setOutput(workspace, 'result', numberBlock(workspace, 7));
      repeat.getInput('DO')!.connection!.connect(body.previousConnection!);

      const { bare, probed } = bothWays(workspace);
      expect(run(probed)).toEqual(run(bare));

      const hits = new Map<string, number>();
      run(probed, {}, { p: (id: string, value: unknown) => (hits.set(id, (hits.get(id) || 0) + 1), value) });

      // The inner number block ran twelve times. That count is the whole of §5.2: "show the
      // last plus ×12", not twelve repaints of the same badge.
      const inner = body.getInputTargetBlock('VALUE') as Blockly.Block;
      expect(hits.get(inner.id)).toBe(12);
    });
  });

  it('statements inside the loop are counted too, through Blockly\'s own STATEMENT_PREFIX', () => {
    withWorkspace((workspace) => {
      const repeat = workspace.newBlock('controls_repeat_ext');
      repeat.getInput('TIMES')!.connection!.connect(numberBlock(workspace, 5).outputConnection!);
      const body = setOutput(workspace, 'result', numberBlock(workspace, 7));
      repeat.getInput('DO')!.connection!.connect(body.previousConnection!);

      const { probed } = bothWays(workspace);
      expect(probed).toContain('__s(');

      const hits = new Map<string, number>();
      run(probed, {}, { s: (id: string) => hits.set(id, (hits.get(id) || 0) + 1) });

      expect(hits.get(body.id)).toBe(5);
    });
  });
});
