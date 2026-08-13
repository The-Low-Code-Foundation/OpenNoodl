/**
 * The Blockly half of My Blocks: the two call blocks, the toolbox category, and the
 * generate path that inlines them (LGC-007 §1, §3).
 *
 * Everything here touches Blockly and therefore cannot be reached from the plain-Node runner.
 * That is why it is as thin as it is: the format, the store, the shape inference, the cycle
 * guard and the inliner all live in `myblocks/` and are graded there, and this file only
 * connects them to a workspace.
 *
 * ## Two block types, not one with a flag
 *
 * §1: shape follows purity, and Blockly's grammar already says it. A value definition gets a
 * block with an output plug; a statement definition gets one that stacks. Those are different
 * block types in Blockly — a block cannot change between them after `init` — so a definition
 * that changes shape leaves its old call blocks holding the wrong type. `expandWorkspace`
 * refuses that case by name (`MyBlocksShapeError`) rather than generating nonsense, and §4's
 * regeneration sweep is where it should eventually be repaired.
 *
 * ## `extraState`, not fields
 *
 * A call block's sockets depend on the definition it points at, so they are built at load time
 * and Blockly serialises them through `saveExtraState`/`loadExtraState`. The argument *names*
 * are stored alongside the id deliberately: it makes a saved body self-describing, so a
 * definition that calls another definition can be analysed with no store present — which is
 * what lets `inferSignature` run in a test with nothing behind it.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';
import { javascriptGenerator, Order } from 'blockly/javascript';

import type { BlocklyBlockJson, BlocklyWorkspaceJson, MyBlockDefinition } from './myblocks/format';
import { expandWorkspace, type DefinitionSource } from './myblocks/expand';
import {
  argInputName,
  collectVariableReferences,
  MY_BLOCKS_CALL_STATEMENT,
  MY_BLOCKS_CALL_VALUE
} from './myblocks/references';
import {
  describeCallTooltip,
  describeFlyoutLabels,
  MY_BLOCKS_BLOCK_GLYPH,
  type DescribableDefinition
} from './myblocks/saveIntent';
import { inferSignature, STATIC_BLOCK_SCHEMA, type BlockSchema } from './myblocks/shape';

/** The toolbox category id. `buildToolbox` refers to it; `BlocklyWorkspace` fills it in. */
export const MY_BLOCKS_CATEGORY = 'MY_BLOCKS';

/** Hue for the category and both call blocks. Distinct from all twelve existing categories. */
export const MY_BLOCKS_HUE = '55';

interface CallBlockState {
  defId: string;
  args: string[];
  label: string;
}

interface CallBlock extends Blockly.Block {
  myBlocksState_: CallBlockState;
  rebuildInputs_(): void;
}

/**
 * Where a call block looks up the definition it points at, for the tooltip (VFN-008).
 *
 * 🔴 **Injected, and not imported.** The obvious move is for this file to call `myBlocksStore()`
 * — but that reaches `ProjectModel` and `EditorSettings`, and this module is in the import graph
 * of the `lgc-007` specs in the plain-Node runner. One import would fail two suites *to run*,
 * which counts as a failure and does not look like one. So `BlocklyWorkspace` injects the store
 * it already holds, and everything here still works with nothing injected.
 *
 * Live rather than cached in `extraState`: a description edited on the definition should reach
 * every call block without every placed block having to be re-serialised, and `label`/`args` are
 * already the version of this problem we accepted (they go stale on rename until the flyout is
 * reopened). Adding the description to that pile would have put a sentence of prose into every
 * call site in `project.json` for nothing.
 */
let definitionSource: { get(id: string): MyBlockDefinition | undefined } | null = null;

/** Tell call blocks where to find their definitions. `null` unregisters. */
export function setMyBlocksDefinitionSource(source: { get(id: string): MyBlockDefinition | undefined } | null): void {
  definitionSource = source;
}

/**
 * Everything the tooltip needs, resolved from the live definition when there is one and from
 * the block's own `extraState` when there is not.
 *
 * The fallback is not a degraded mode nobody hits: a call block in a headless generate, in a
 * spec, or in a workspace opened before the store was injected has no source, and a tooltip that
 * threw or blanked there would be a worse answer than the self-describing one `extraState`
 * already carries. That `args` and `label` are serialised alongside the id is exactly what makes
 * this possible, and it is the same property that lets `inferSignature` run with no store.
 */
export function describableCall(block: CallBlock, isValue: boolean): DescribableDefinition {
  const state = block.myBlocksState_ || { defId: '', args: [], label: '' };
  const definition = state.defId ? definitionSource?.get(state.defId) : undefined;

  if (definition) {
    return {
      name: definition.name,
      shape: definition.shape,
      params: definition.params,
      description: definition.description,
      variables: collectVariableReferences(definition.body)
    };
  }

  return {
    name: state.label,
    // The block type is the shape. It cannot be anything else — that is why there are two block
    // types rather than one with a flag.
    shape: isValue ? 'value' : 'statement',
    params: (state.args || []).map((name) => ({ name }))
  };
}

function callBlockMixin(isValue: boolean) {
  return {
    init(this: CallBlock) {
      this.myBlocksState_ = { defId: '', args: [], label: 'saved block' };
      this.setColour(Number(MY_BLOCKS_HUE));
      if (isValue) {
        this.setOutput(true, null);
      } else {
        this.setPreviousStatement(true, null);
        this.setNextStatement(true, null);
      }
      /**
       * ⚠️ A **function**, not a string. `init` runs before `loadExtraState`, so at this moment
       * the state is the stub two lines above and a tooltip built now would say nothing about
       * this block for the rest of its life — which is precisely the hard-coded sentence
       * VFN-008 replaces. Blockly resolves a function tooltip when the tooltip is *shown*.
       */
      this.setTooltip(() => describeCallTooltip(describableCall(this, isValue)));
      this.rebuildInputs_();
    },

    saveExtraState(this: CallBlock): CallBlockState {
      return { ...this.myBlocksState_ };
    },

    loadExtraState(this: CallBlock, state: Partial<CallBlockState>) {
      this.myBlocksState_ = {
        defId: typeof state?.defId === 'string' ? state.defId : '',
        args: Array.isArray(state?.args) ? state.args.slice() : [],
        label: typeof state?.label === 'string' ? state.label : 'saved block'
      };
      this.rebuildInputs_();
    },

    rebuildInputs_(this: CallBlock) {
      for (const input of this.inputList.slice()) {
        this.removeInput(input.name, true);
      }

      this.appendDummyInput('HEADER').appendField(`${MY_BLOCKS_BLOCK_GLYPH} ${this.myBlocksState_.label}`);
      this.myBlocksState_.args.forEach((name, index) => {
        this.appendValueInput(argInputName(index)).setCheck(null).appendField(name);
      });
      this.setInputsInline(this.myBlocksState_.args.length <= 2);
    }
  };
}

let registered = false;

/**
 * Register the two call block types and their generators. Idempotent, like
 * `initBlocklyIntegration` — Blockly's registries are module-global.
 */
export function initMyBlocks(): void {
  if (registered) return;
  registered = true;

  Blockly.Blocks[MY_BLOCKS_CALL_VALUE] = callBlockMixin(true);
  Blockly.Blocks[MY_BLOCKS_CALL_STATEMENT] = callBlockMixin(false);

  // A call block should never reach a generator: `generateWithMyBlocks` inlines every one of
  // them first. These exist for the path that does not go through it — someone calling
  // `javascriptGenerator.workspaceToCode` on a live workspace directly, which
  // `NoodlGenerators.generateCode` still offers. They emit something inert and self-describing
  // rather than throwing, because throwing inside a generator loses the whole program.
  javascriptGenerator.forBlock[MY_BLOCKS_CALL_VALUE] = function (block) {
    return [`null /* saved block "${labelOf(block)}" was not expanded */`, Order.ATOMIC];
  };
  javascriptGenerator.forBlock[MY_BLOCKS_CALL_STATEMENT] = function (block) {
    return `/* saved block "${labelOf(block)}" was not expanded */\n`;
  };
}

function labelOf(block: Blockly.Block): string {
  return (block as CallBlock).myBlocksState_?.label ?? 'saved block';
}

/** The flyout JSON for one definition — what a builder drags out of the My Blocks category. */
export function callBlockJson(definition: MyBlockDefinition): BlocklyBlockJson {
  return {
    type: definition.shape === 'value' ? MY_BLOCKS_CALL_VALUE : MY_BLOCKS_CALL_STATEMENT,
    extraState: {
      defId: definition.id,
      args: definition.params.map((p) => p.name),
      label: definition.name
    }
  };
}

/**
 * The dynamic My Blocks category.
 *
 * Dynamic rather than a static list because the contents change every time a definition is
 * saved, renamed or deleted, and Blockly rebuilds a `custom` category on every flyout open —
 * the same mechanism `VARIABLE` and `PROCEDURE` already use in `BlocklyToolbox.ts`.
 */
export function myBlocksFlyout(source: { list(): MyBlockDefinition[] }) {
  return function (): unknown[] {
    const definitions = source.list();
    if (definitions.length === 0) {
      /**
       * 🔴 The empty state used to read *"Select some blocks, right-click and choose Save as a
       * block"*, which instructs a builder to perform a gesture this editor does not have:
       * **Blockly 12 core has no multi-select**, and the plugin that adds it is not installed.
       * The real gesture is one right-click on the top block of the group — see
       * `MyBlocksSave.ts`. An empty state that teaches the wrong gesture is worse than one that
       * teaches nothing, because it is followed.
       */
      return [
        {
          kind: 'label',
          text: 'Right-click a block and choose "Save as a block…"'
        },
        {
          kind: 'label',
          text: 'Everything inside it and stacked under it comes too.'
        }
      ];
    }
    /**
     * VFN-008 §3 — each definition arrives with its shape sentence above it.
     *
     * > *"If you put it on a canvas later on, how do you know what inputs and outputs it has?"*
     *
     * It used to be one `▣ Discount` per definition and nothing else, so browsing the category
     * taught nothing and the only way to find out what a saved block did was to drag it out and
     * read its sockets. The sentences are `saveIntent.ts`; this is the plumbing.
     *
     * ⚠️ The flyout is rebuilt on every open, so nothing here is cached and nothing goes stale.
     */
    const items: unknown[] = [];
    for (const definition of definitions) {
      for (const text of describeFlyoutLabels(flyoutDescribable(definition))) {
        items.push({ kind: 'label', text });
      }
      items.push({ kind: 'block', ...callBlockJson(definition) });
    }
    return items;
  };
}

/** A definition as the flyout describes it — the variables are read from the body, not cached. */
function flyoutDescribable(definition: MyBlockDefinition): DescribableDefinition {
  return {
    name: definition.name,
    shape: definition.shape,
    params: definition.params,
    description: definition.description,
    variables: collectVariableReferences(definition.body)
  };
}

/**
 * A `BlockSchema` backed by Blockly itself.
 *
 * Authoritative where the static table is a guess: it instantiates each type once in a
 * throwaway headless workspace and reads the connections off the real block. Cached, because
 * creating a block is not free and the answer cannot change within a session.
 */
export function blocklyBlockSchema(): BlockSchema {
  const cache = new Map<string, { hasOutput: boolean; valueInputs: string[] }>();
  let scratch: Blockly.Workspace | null = null;

  function describe(type: string) {
    const cached = cache.get(type);
    if (cached) return cached;

    let described = { hasOutput: STATIC_BLOCK_SCHEMA.hasOutput(type), valueInputs: STATIC_BLOCK_SCHEMA.valueInputs(type) };
    if (Blockly.Blocks[type]) {
      try {
        if (!scratch) scratch = new Blockly.Workspace();
        const block = scratch.newBlock(type);
        described = {
          hasOutput: !!block.outputConnection,
          valueInputs: block.inputList
            .filter((input) => input.connection?.type === Blockly.INPUT_VALUE)
            .map((input) => input.name)
        };
        block.dispose(false);
      } catch {
        // A block whose `init` needs a rendered workspace falls back to the table rather than
        // taking out the save dialog.
      }
    }

    cache.set(type, described);
    return described;
  }

  return {
    hasOutput: (type) => describe(type).hasOutput,
    valueInputs: (type) => describe(type).valueInputs,
    isSignal: STATIC_BLOCK_SCHEMA.isSignal
  };
}

/**
 * Serialise a selection of blocks into a definition body.
 *
 * Only *root* blocks of the selection are serialised — a block whose parent is also selected
 * comes along inside its parent, and serialising it again would duplicate it.
 */
export function bodyFromBlocks(blocks: Blockly.Block[]): BlocklyWorkspaceJson {
  const chosen = new Set(blocks);
  const roots = blocks.filter((block) => {
    let parent = block.getParent();
    while (parent) {
      if (chosen.has(parent)) return false;
      parent = parent.getParent();
    }
    return true;
  });

  return {
    blocks: {
      languageVersion: 0,
      blocks: roots.map((block) => Blockly.serialization.blocks.save(block, { addCoordinates: false }) as BlocklyBlockJson)
    }
  };
}

/** What the save dialog shows before the builder commits: the shape it will get, and why. */
export function previewSignature(body: BlocklyWorkspaceJson) {
  return inferSignature(body, blocklyBlockSchema());
}

export interface GenerateResult {
  /**
   * The generated JavaScript, or `undefined` when generation declined.
   *
   * 🔴 `undefined` is **not** `''`. An empty string is a real program (the one with no
   * blocks in it); `undefined` means *this edit produced no honest JavaScript* and the caller
   * must leave whatever code it already holds alone. Writing `''` here is how a refusal
   * publishes its silence over the last-known-good code, which is a defect this feature has
   * shipped twice.
   *
   * ⚠️ **The compiler will not hold this for you.** `strictNullChecks` is off across this
   * package (root `tsconfig.json` sets no `strict` flags), so nothing stops a future edit
   * returning `''` here and nothing forces the caller's `=== undefined` check. It was
   * previously declared `code: string` while the error path returned `undefined`, and that
   * lie cost nothing to compile. The contract is held by
   * `tests-unit/lgc-007/generateWithMyBlocks.spec.ts` instead.
   */
  code?: string;
  /** Set when the program could not be generated. The code is then the caller's previous one. */
  error?: Error;
}

/**
 * Generate a workspace's JavaScript, inlining every saved block first.
 *
 * The fast path matters: a workspace with no saved blocks in it does exactly what it did
 * before this feature existed — `workspaceToCode` on the live workspace, no serialise, no
 * headless round trip. Only a program that actually uses a saved block pays for one.
 *
 * ⚠️ On a cycle, a missing definition, a shape mismatch or a budget overrun this returns the
 * error rather than throwing, and returns **no code**. The caller keeps its previous code:
 * §3's whole point is that generating on a broken definition graph is the thing that hangs
 * the renderer, and quietly generating a *different* program is the next-worst outcome.
 */
export function generateWithMyBlocks(
  workspace: Blockly.Workspace,
  saved: BlocklyWorkspaceJson,
  source: DefinitionSource
): GenerateResult {
  try {
    const expanded = expandWorkspace(saved, source);
    if (expanded.expansions === 0) {
      return { code: javascriptGenerator.workspaceToCode(workspace) };
    }

    const headless = new Blockly.Workspace();
    try {
      Blockly.serialization.workspaces.load(expanded.workspace as never, headless);
      return { code: javascriptGenerator.workspaceToCode(headless) };
    } finally {
      headless.dispose();
    }
  } catch (error) {
    return { code: undefined, error: error as Error };
  }
}
