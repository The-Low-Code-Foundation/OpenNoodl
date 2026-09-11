/**
 * VFN-014 — the program a person can read, beside the one the app runs.
 *
 * ## The report
 *
 * > *"The generated code looks absolutely nutter butter, nothing we can do about that?"*
 *
 * *View Code* showed `__p("/=)cyD(u02h_,OvQCt0L", __p("sltVn~s%r1ar)hK^xD%m", 1) + …)`. Every one
 * of those calls is LGC-003's value tracing and every one of those strings is a Blockly block id.
 * Neither is a defect: `__p` is an identity function, `__s` returns undefined, and the ids are
 * Blockly's identity for the blocks the badges are painted on. **The instrumentation must stay in
 * what runs.**
 *
 * ✅ What is fixable is that the instrumented build was the *only* one that existed.
 * `withBlockProbes` is **scoped, not installed** — it restores the generator when it returns — so
 * generating the same workspace outside that wrapper yields the same program with no probes in
 * it. That is what this module does: one call, no second generator, no second truth about what
 * the program does.
 *
 * ## 🔴 What this module must never do
 *
 * Touch what is stored. The node's `generatedCode` parameter stays the instrumented build; this
 * is a **display seam**. A "cleaned" program that reached the runtime would be exactly the
 * second-truth-about-the-program that VFN-011's drift gate exists to prevent.
 *
 * The risk is not hypothetical and it is not in the callers: `javascriptGenerator` is a
 * module-level singleton shared with `DoIt`'s fragment generation and `MyBlocksBlocks`' shape
 * inference, so a wrapper here that failed to put it back would change what the *next* flush
 * writes to disk. `tests-unit/vfn-014/readable-code.spec.ts` generates the instrumented build,
 * renders a readable one, generates the instrumented build again and requires the two to be
 * byte-identical — with a negative control that leaks the generator on purpose and watches that
 * assertion go red.
 *
 * ## Criterion 6 — the marker, and the finding behind it
 *
 * Removing the probes makes an inlined saved block *legible*. It does not make it *findable*.
 * Richard could not find `result` on the canvas because it is not on the canvas: it is the body
 * of a saved block called `test1`, spliced in at its call site, and the code said nothing about
 * that. So each inlined region carries its definition's name as a comment — `// test1` above a
 * statement region, `/* test1 *​/` in front of a value one. The ids come from
 * {@link module:BlocklyEditor/myblocks.expandWorkspace}, which is the only thing that knows:
 * by the time the generator runs there are no call blocks left.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import { javascriptGenerator } from 'blockly/javascript';

import { initBlocklyIntegration } from './initialize';
import { generateWithMyBlocks, initMyBlocks } from './MyBlocksBlocks';
import { expandWorkspace, type DefinitionSource } from './myblocks/expand';
import type { BlocklyWorkspaceJson } from './myblocks/format';

export interface ReadableCodeResult {
  /**
   * The probe-free program, or `undefined` when it could not be produced.
   *
   * 🔴 `undefined` is **not** `''`, for `GenerateResult.code`'s reason one level down: an empty
   * string is a real program (the one with no blocks in it). A caller that shows `''` as "your
   * code" when generation declined is publishing a refusal's silence, which this feature has
   * shipped twice.
   */
  code?: string;
  /** Set when the readable rendering declined. The caller still has the instrumented build. */
  error?: Error;
}

/**
 * Wrap one generation so each inlined region announces where it came from.
 *
 * Built the way {@link module:BlocklyEditor.withBlockProbes} is built, and for its reasons:
 * `forBlock` is a live registry that My Blocks writes into mid-expansion, so there is no moment
 * at which wrapping every entry is correct. `blockToCode` is the one funnel every block goes
 * through, including nested ones reached by `valueToCode`.
 *
 * ⚠️ **Scoped, not installed**, and it refuses to run inside a probed generation. Nesting the two
 * would put comments into the string that gets written to the node — see this module's note.
 */
export function withBlockOrigins<T>(
  origins: Map<string, string>,
  body: () => T,
  generator: typeof javascriptGenerator = javascriptGenerator
): T {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const g = generator as any;

  if (g.__noodlProbesActive) {
    throw new Error('withBlockOrigins must not run inside withBlockProbes: the stored program would gain comments.');
  }
  if (g.__noodlOriginsActive) {
    throw new Error('withBlockOrigins is already active on this generator.');
  }

  // Nothing to say: skip the wrapper entirely rather than paying for it on every block.
  if (origins.size === 0) return body();

  const originalBlockToCode = g.blockToCode;
  g.__noodlOriginsActive = true;

  g.blockToCode = function (block: Blockly.Block | null, thisOnly?: boolean): string | [string, number] {
    const generated = originalBlockToCode.call(this, block, thisOnly);

    const name = block && block.id ? origins.get(block.id) : undefined;
    if (name === undefined) return generated;

    if (!Array.isArray(generated)) {
      // A statement region. The head's code already carries its whole `next` chain (`scrub_`
      // appends it), so one line above the head labels the whole region.
      if (generated === '') return generated;
      return lineComment(name) + generated;
    }

    const tuple = generated as [string, number];
    if (tuple[0] === '') return tuple;
    /**
     * A value region. A block comment rather than a line one, because this lands *inside* an
     * expression and `//` would comment out the rest of the line. The order is passed through
     * unchanged: a comment is whitespace and binds nothing.
     */
    return [blockComment(name) + tuple[0], tuple[1]];
  };

  try {
    return body();
  } finally {
    g.blockToCode = originalBlockToCode;
    g.__noodlOriginsActive = false;
  }
}

/**
 * Render a saved workspace as the program it describes, with no probes in it.
 *
 * Deliberately calls the **same** `generateWithMyBlocks` the flush calls, on a workspace loaded
 * from the same JSON. A second generation path here is the one-fact-two-stores shape this
 * directory has found three times, and it is what criterion 4 exists to forbid.
 *
 * ⚠️ `expandWorkspace` runs twice — once here for the region names, once inside
 * `generateWithMyBlocks`. It is a pure transform over at most 400 blocks and this is a button
 * press, so the duplicated work buys a `generateWithMyBlocks` whose signature does not have to
 * grow an out-parameter for a display feature.
 */
export function renderReadableCode(saved: BlocklyWorkspaceJson, source: DefinitionSource): ReadableCodeResult {
  // Block definitions and generators must exist before anything is loaded or generated. Both are
  // idempotent, and the property panel can reach this without the block editor ever being opened.
  initBlocklyIntegration();
  initMyBlocks();

  let origins = new Map<string, string>();
  try {
    origins = expandWorkspace(saved, source).origins;
  } catch (error) {
    // A broken definition graph. `generateWithMyBlocks` hits the same error below and reports it
    // properly; losing the region names on the way is not worth a second error path.
    origins = new Map();
  }

  const headless = new Blockly.Workspace();
  try {
    Blockly.serialization.workspaces.load(saved as never, headless);
    const generated = withBlockOrigins(origins, () => generateWithMyBlocks(headless, saved, source));
    return { code: generated.code, error: generated.error };
  } catch (error) {
    return { code: undefined, error: error as Error };
  } finally {
    headless.dispose();
  }
}

/**
 * The same, from the string the node actually stores.
 *
 * The `workspace` parameter is JSON in a string, and a node that has never been opened has `''`.
 * That is not an error and must not be reported as one — it is a program with no blocks in it.
 */
export function renderReadableCodeFromJson(workspaceJson: string, source: DefinitionSource): ReadableCodeResult {
  if (!workspaceJson || workspaceJson.trim() === '') return { code: '' };

  let saved: BlocklyWorkspaceJson;
  try {
    saved = JSON.parse(workspaceJson) as BlocklyWorkspaceJson;
  } catch (error) {
    return { code: undefined, error: error as Error };
  }

  return renderReadableCode(saved, source);
}

/** A definition name is user text. It may not close the comment it is inside, or start a line. */
function sanitiseName(name: string): string {
  return name.replace(/\*\//g, '* /').replace(/[\r\n]+/g, ' ').trim();
}

function lineComment(name: string): string {
  return '// ' + sanitiseName(name) + '\n';
}

function blockComment(name: string): string {
  return '/* ' + sanitiseName(name) + ' */ ';
}
