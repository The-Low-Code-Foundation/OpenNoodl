/**
 * LGC-003 §1 — the pushed probe, at code-gen time.
 *
 * Every value block's generated expression is wrapped in a call to `__p(id, value)`, and every
 * statement block is preceded by `__s(id)`. Both are supplied by the runtime as extra
 * parameters of the compiled function, and when nothing is watching **both are the do-nothing
 * pair** — `__p` returns its second argument and `__s` returns undefined. There is one
 * generated string, not a debug one and a release one, so there is no class of defect that
 * appears only when nobody is looking.
 *
 * ## The two properties that make this safe rather than clever
 *
 * 1. **`__p` is an identity function.** The instrumented program computes exactly what the
 *    bare one computes, because every wrapper hands back the value it was given, unchanged and
 *    by reference.
 * 2. **The wrapper is a call, and it is declared {@link Order.ATOMIC}.** A call expression is
 *    self-delimiting, so no operator around it can reach inside it.
 *
 * ⚠️ **What the register said about `Order.ATOMIC`, and what is actually true.** L7 records
 * that a wrong order makes the instrumented program *compute different arithmetic, silently*.
 * That is true of a naive probe and **not** of this one, and the difference is worth stating
 * because it decides what has to be tested. Blockly's `valueToCode` adds parentheses when the
 * inner expression binds *looser* than its context; a call expression binds as tight as
 * anything can, so ATOMIC is the honest declaration and every *other* declaration would only
 * ever add redundant parentheses — which cannot change a result. **The thing that makes
 * precedence safe is that the wrapper is a call at all.** A probe emitted as a sequence
 * (`__p("id"), code`), a prefix, or anything else that is not a single self-delimiting
 * expression is what silently rewrites `a + b * c`, and `block-probes.spec.ts` proves that by
 * building exactly that probe and watching the differential fail. Measured, in Blockly 12.3.1,
 * not reasoned about — see the spec's "every order is arithmetically safe" case.
 *
 * ## Why this wraps `blockToCode` and not each generator
 *
 * `forBlock` is a live registry that Blockly's own blocks, `NoodlGenerators` and
 * `MyBlocksBlocks` all write into, and My Blocks writes into it while a program is being
 * expanded. Wrapping every entry would mean knowing when that registry is complete, which
 * nothing does. `blockToCode` is the one funnel every block goes through, including nested
 * ones reached by `valueToCode`, so wrapping it instruments a whole program from one place.
 *
 * ⚠️ **Scoped, not installed.** {@link withBlockProbes} restores the generator afterwards.
 * `javascriptGenerator` is a module-level singleton shared with `DoIt`'s fragment generation
 * and with `MyBlocksBlocks`' shape inference, and a permanent mutation of it would instrument
 * a Do It fragment as a side effect of opening a block editor.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

import { DECLARATION_BLOCK_TYPES } from './DoIt';

/** The value probe. Reserved, so a user-named variable cannot collide with it. */
export const PROBE_VALUE_FN = '__p';
/** The statement probe. Blockly substitutes `%1` with the quoted block id. */
export const PROBE_STATEMENT_FN = '__s';

/**
 * Blockly's own hook for statements. `%1` becomes the block id, quoted by `injectId`.
 *
 * Statements need no wrapping: `blockToCode` already prepends this to every statement block's
 * code, and `addLoopTrap` puts one inside every loop body — which is exactly what makes a
 * statement inside a loop countable.
 */
export const PROBE_STATEMENT_PREFIX = PROBE_STATEMENT_FN + '(%1);\n';

/**
 * The two parameter names the compiled program expects, in the order the runtime passes them.
 *
 * Kept here rather than in the runtime because this is the file that decides to emit them;
 * `logic-builder.ts` and `logic-builder-probe.ts` mirror it and a spec on each side pins the
 * pair. They are the ninth and tenth parameters of `new Function` — LGC-002's register L5
 * found the ninth free and named it for this.
 */
export const PROBE_PARAMETER_NAMES = [PROBE_VALUE_FN, PROBE_STATEMENT_FN];

/**
 * Wrap one value block's generated expression.
 *
 * Exported so the spec can build the *wrong* probes beside the right one and diff what they
 * compute — an inspection of this string proves nothing, and the acceptance criterion says so
 * in as many words.
 */
export function probeExpression(blockId: string, code: string): [string, number] {
  // `JSON.stringify` rather than the generator's `quote_`: a block id arrives from a
  // deserialised workspace and is not guaranteed to be Blockly's own charset.
  return [PROBE_VALUE_FN + '(' + JSON.stringify(String(blockId)) + ', ' + code + ')', Order.ATOMIC];
}

/**
 * Register the probe names and exempt the blocks that are not part of the program.
 *
 * ⚠️ **This has to run before the generator's first `init()`, and finding that out cost a
 * spec.** `addReservedWords` appends to a string that `JavascriptGenerator.init` reads **once**,
 * when it lazily constructs `nameDB_`; every later `init` calls `nameDB_.reset()`, which keeps
 * the name database's reserved set exactly as it was built. So reserving inside
 * {@link withBlockProbes} — the obvious place, and where this started — reserves nothing at all
 * on any session that has already generated code once. A user variable called `__p` then
 * compiles to `var __p; __p = __p("id", 1);`, which shadows the probe parameter and turns every
 * later probe in the program into a call on a number. `a user variable named __p is renamed
 * rather than colliding` is the spec that caught it.
 *
 * ⚠️ **`suppressPrefixSuffix` on the four declaration blocks**, for the second thing a spec
 * caught. `Define input` and its three siblings generate the empty string, but Blockly folds
 * `STATEMENT_PREFIX` in *inside* `blockToCode` — so a block that emits no code came out as
 * `__s("id");` and was then, correctly and uselessly, reported as having executed. A port
 * declaration is not a statement in the program: marking it teaches nothing, and this module's
 * whole bias (register L8, the wall of numbers) is towards fewer marks that mean more.
 *
 * Idempotent. Called from `initNoodlGenerators`, which is the one place that already runs
 * before anything generates.
 */
export function initBlockProbes(): void {
  javascriptGenerator.addReservedWords(PROBE_PARAMETER_NAMES.join(','));

  for (const type of DECLARATION_BLOCK_TYPES) {
    const definition = Blockly.Blocks[type] as Record<string, unknown> | undefined;
    // The registry entry is mixed into every instance by the `Block` constructor, so setting it
    // here reaches every declaration block in every workspace, past and future.
    if (definition) definition.suppressPrefixSuffix = true;
  }
}

/**
 * Is this a block Blockly will *not* prepend `STATEMENT_PREFIX` to?
 *
 * The flag is set on the registry entry by {@link initBlockProbes} and mixed into every instance
 * by the `Block` constructor, so this reads the same fact Blockly's own `blockToCode` reads when
 * it decides whether to fold the prefix in.
 */
function emitsNoStatementProbe(block: Blockly.Block): boolean {
  return (block as unknown as { suppressPrefixSuffix?: boolean }).suppressPrefixSuffix === true;
}

/** What a probed generation produced. */
export interface ProbedGeneration<T> {
  result: T;
  /**
   * Every block id the generation actually emitted a probe for.
   *
   * ⚠️ **This is the denominator of the didn't-execute tell, and it has to be collected here
   * rather than recovered from the code.** A block that generates nothing — a `Define input`,
   * a disabled block, an orphan — contributes no probe, and must therefore render *neutral*
   * rather than hollow: it is not part of the program at all, so "it did not run this time" is
   * not a true thing to say about it. Only a block in this set can be hollow.
   */
  probedIds: Set<string>;
}

/**
 * Generate with the probes installed, then put the generator back exactly as it was.
 *
 * Re-entrant by refusal rather than by nesting: the inner call would collect its ids into the
 * outer call's set and then restore the *probed* `blockToCode` as if it were the original.
 * Nesting is not a thing any caller wants, so it throws rather than corrupting the generator.
 */
export function withBlockProbes<T>(
  body: () => T,
  generator: typeof javascriptGenerator = javascriptGenerator
): ProbedGeneration<T> {
  const probedIds = new Set<string>();

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = generator as any;

  if (g.__noodlProbesActive) {
    throw new Error('withBlockProbes is already active on this generator; nesting would mis-scope the probe ids.');
  }

  // Belt for `initBlockProbes`' braces, and a no-op whenever that ran first — which it must
  // have, because by the time `nameDB_` exists this call changes nothing. See its docstring.
  generator.addReservedWords(PROBE_PARAMETER_NAMES.join(','));

  const originalBlockToCode = g.blockToCode;
  const originalStatementPrefix = generator.STATEMENT_PREFIX;

  g.__noodlProbesActive = true;
  generator.STATEMENT_PREFIX = PROBE_STATEMENT_PREFIX;

  g.blockToCode = function (block: Blockly.Block | null, thisOnly?: boolean): string | [string, number] {
    const generated = originalBlockToCode.call(this, block, thisOnly);

    /**
     * A statement block comes back as a string and has already had `STATEMENT_PREFIX` folded
     * into it by Blockly. Its id still belongs in the set, because a statement that did not
     * run is exactly as worth showing as a value that did not.
     *
     * 🔴 **`generated !== ''` is not the emptiness test it looks like**, and LGC-009 found it by
     * measurement. `blockToCode` on a statement returns that block's code **plus its whole `next`
     * chain** (`scrub_` appends it), so a block that emits nothing itself is non-empty whenever
     * anything is stacked under it. A `Define input` at the *top* of a stack therefore landed in
     * `probedIds` while emitting no `__s(…)` — so it could never appear in a run frame, and
     * `markFor` painted it **hollow**, permanently, on every run. That contradicts this module's
     * own docstring (*"a block that generates nothing … must render neutral"*) and the existing
     * spec missed it by declaring the port as a separate top-level block rather than as the head
     * of the stack.
     *
     * The honest question is not "did anything come back" but "can this block emit a probe at
     * all", and `suppressPrefixSuffix` is exactly that flag. LGC-009 escalates the defect from
     * occasional to universal — a hat is the head of every stack — which is how it was noticed.
     */
    if (!Array.isArray(generated)) {
      if (block && block.id && generated !== '' && !emitsNoStatementProbe(block)) probedIds.add(block.id);
      return generated;
    }

    const tuple = generated as [string, number];
    if (!block || !block.id || tuple[0] === '') return tuple;

    probedIds.add(block.id);
    return probeExpression(block.id, tuple[0]);
  };

  try {
    return { result: body(), probedIds };
  } finally {
    g.blockToCode = originalBlockToCode;
    generator.STATEMENT_PREFIX = originalStatementPrefix;
    g.__noodlProbesActive = false;
  }
}
