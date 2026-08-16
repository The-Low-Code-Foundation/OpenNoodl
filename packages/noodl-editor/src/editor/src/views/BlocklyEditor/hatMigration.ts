/**
 * LGC-009 — putting a hat on a program that was written before there were hats.
 *
 * ## What "mandatory" means operationally
 *
 * Richard ruled the hat mandatory. That is enforced by **supplying** one, not by refusing to
 * generate without one:
 *
 *  - every program is passed through {@link ensureHatsInJson} on its way into the block editor,
 *    so a saved program acquires a hat the first time it is opened and keeps it from the first
 *    edit onwards;
 *  - a program with no blocks at all opens with a hat already on the canvas (`seedEmpty`), so
 *    the first thing a new author sees is where the program starts;
 *  - the generator is **not** an enforcement point. It emits what it always emitted.
 *
 * 🔴 **The generator deliberately does not refuse a hatless stack**, and that is the whole of
 * LGC-007 §3 applied here: a refusal that writes its silence over `generatedCode` has now been
 * shipped twice on this feature (`disableOrphans`, reverted `f1b57c0f`; the cycle guard, driven
 * 2026-08-12). A second enforcement point would be a third. The tell that a stack is not part of
 * the program is `Blockly.Events.disableOrphans` — drawn, model state, and LGC-009's acceptance
 * criterion 4 — not a silently shorter string on disk.
 *
 * ## Why this file knows nothing about Blockly
 *
 * It is imported by `CanvasTabsContext`, which is in the main bundle. `BlocklyToolbox.ts` records
 * what a value import of Blockly costs there: it undoes the block editor's lazy load. So this is
 * a plain JSON transform, and the one thing a JSON transform cannot know — whether a block
 * stacks — is answered by {@link HATTABLE_BLOCK_TYPES}, a list that
 * `tests-unit/lgc-009/hat-migration.spec.ts` checks against **real Blockly**, block by block,
 * rather than against itself.
 *
 * ⚠️ **Unknown types are left alone**, which is the safe direction: a block the list has never
 * heard of keeps its position and its meaning, and the worst case is a stack that still has no
 * hat. Wrapping one wrongly — a value block under a `next` connection it does not have — would
 * produce a workspace Blockly refuses to load.
 *
 * @module BlocklyEditor
 */

import { DEFAULT_HAT_SIGNAL, HAT_BLOCK_TYPE, detectIO } from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import type { BlocklyBlockJson, BlocklyWorkspaceJson } from './myblocks/format';
import { MY_BLOCKS_CALL_STATEMENT } from './myblocks/references';

/**
 * Every block type in the Logic Builder's reach that has a `previousConnection` — i.e. that can
 * sit under a hat.
 *
 * The Noodl half is this repo's; the stock half is every statement block reachable from
 * `buildToolbox`, including the two dynamic categories Blockly fills in itself (`variables_set`
 * and `math_change` come out of the Variables flyout, `procedures_callnoreturn` and
 * `procedures_ifreturn` out of Functions).
 *
 * ⚠️ **`procedures_defnoreturn` / `procedures_defreturn` are deliberately absent.** They are
 * Blockly's own hats — no previous connection — and wrapping one would be nonsense. Any block
 * not named here is left where it is.
 */
export const HATTABLE_BLOCK_TYPES: readonly string[] = [
  // Noodl — the 9 statement shapes the disableOrphans finding enumerated.
  'noodl_define_input',
  'noodl_define_output',
  'noodl_set_output',
  'noodl_define_signal_input',
  'noodl_define_signal_output',
  'noodl_send_signal',
  'noodl_set_variable',
  'noodl_set_object_property',
  'noodl_array_add',
  // FIX-004 §A — log is a statement; convert is a value block and deliberately absent.
  'noodl_log',
  // My Blocks (LGC-007) — the statement-shaped call.
  MY_BLOCKS_CALL_STATEMENT,
  // Stock Blockly, from the toolbox's imperative half.
  'controls_if',
  'controls_ifelse',
  'controls_repeat_ext',
  'controls_whileUntil',
  'controls_for',
  'controls_forEach',
  'controls_flow_statements',
  'text_append',
  'lists_setIndex',
  // Stock Blockly, from the two dynamic categories.
  'variables_set',
  'math_change',
  'procedures_callnoreturn',
  'procedures_ifreturn'
];

const HATTABLE = new Set<string>(HATTABLE_BLOCK_TYPES);

/** Can a block of this type sit under a hat? Unknown types answer `false`. */
export function isHattableBlockType(type: string | undefined | null): boolean {
  return typeof type === 'string' && HATTABLE.has(type);
}

export interface EnsureHatsOptions {
  /**
   * The signal a new hat names when the stack it caps does not already declare one.
   * Defaults to {@link DEFAULT_HAT_SIGNAL} — the node's own reserved `run`, so a migrated
   * program publishes no port it did not publish before.
   */
  signal?: string;
  /**
   * Put a lone hat on a workspace that has no blocks at all. Off by default, so the pure
   * migration never invents a program; on at the point a block editor is opened, which is what
   * makes a new author's first canvas state where the program starts.
   */
  seedEmpty?: boolean;
}

export interface EnsureHatsResult {
  workspace: BlocklyWorkspaceJson;
  /** Hats added. `0` means the program already said where it starts. */
  added: number;
  /**
   * Top-level blocks left exactly where they were because nothing here can know they stack —
   * a floating value block, or a type this build has never heard of. Reported rather than
   * counted, because the type is the interesting half.
   */
  skipped: string[];
}

/**
 * Give every top-level stack a hat.
 *
 * One hat per stack, carrying that stack's `x`/`y`. That is not a detail: `workspaceToCode`
 * iterates `getTopBlocks(true)`, which sorts by position, so a hat that inherits its stack's
 * coordinates leaves the **generated code byte-identical** — same lines, same order. Joining the
 * stacks under a single shared hat would have reordered any program with more than one, silently,
 * because a workspace's serialised order and its positional order are not the same order.
 */
export function ensureHats(
  workspace: BlocklyWorkspaceJson | undefined | null,
  options: EnsureHatsOptions = {}
): EnsureHatsResult {
  const fallbackSignal = options.signal || DEFAULT_HAT_SIGNAL;
  const source = workspace && workspace.blocks && Array.isArray(workspace.blocks.blocks) ? workspace : null;
  const tops: BlocklyBlockJson[] = source ? (source.blocks!.blocks as BlocklyBlockJson[]) : [];

  if (tops.length === 0) {
    if (!options.seedEmpty) {
      const unchanged = (workspace || { blocks: { languageVersion: 0, blocks: [] } }) as BlocklyWorkspaceJson;
      return { workspace: unchanged, added: 0, skipped: [] };
    }
    const seeded: BlocklyWorkspaceJson = {
      ...(workspace || {}),
      blocks: {
        languageVersion: (source && source.blocks!.languageVersion) ?? 0,
        blocks: [{ type: HAT_BLOCK_TYPE, id: 'hat-start', x: 30, y: 30, fields: { NAME: fallbackSignal } }]
      }
    };
    return { workspace: seeded, added: 1, skipped: [] };
  }

  const skipped: string[] = [];
  let added = 0;

  const migrated = tops.map((block, index) => {
    if (!block || typeof block.type !== 'string') {
      skipped.push(String(block && block.type));
      return block;
    }

    if (block.type === HAT_BLOCK_TYPE) return block;

    if (!isHattableBlockType(block.type)) {
      skipped.push(block.type);
      return block;
    }

    added++;
    return wrapInHat(block, index, fallbackSignal);
  });

  if (added === 0) {
    return { workspace: workspace as BlocklyWorkspaceJson, added: 0, skipped };
  }

  return {
    workspace: {
      ...(workspace as BlocklyWorkspaceJson),
      blocks: { ...source!.blocks, blocks: migrated }
    },
    added,
    skipped
  };
}

/**
 * The string-in / string-out form, for the seam where a workspace is a `project.json` parameter.
 *
 * 🔴 **Returns the *same string* when nothing changed**, rather than a re-serialisation of an
 * equal object. LGC-002 §2 and LGC-004 #13 both grade a close/reopen on the serialised workspace
 * being byte-identical, and `JSON.stringify(JSON.parse(s))` is not `s` — key order survives, but
 * number formatting and whitespace do not. A migration that reformatted every program it looked
 * at would break those criteria for every program, including the ones it changed nothing about.
 *
 * Never throws. An unparseable workspace comes back exactly as it went in, for `detectIO`'s
 * reason: this sits on the path that opens a block editor, and a half-written parameter must not
 * stop the editor from opening.
 */
export function ensureHatsInJson(json: string | undefined | null, options: EnsureHatsOptions = {}): string | undefined {
  if (json === undefined || json === null || json === '') {
    if (!options.seedEmpty) return json === null ? undefined : json;
    return JSON.stringify(ensureHats(null, options).workspace);
  }

  let parsed: BlocklyWorkspaceJson;
  try {
    parsed = JSON.parse(json) as BlocklyWorkspaceJson;
  } catch {
    return json;
  }

  const result = ensureHats(parsed, options);
  if (result.added === 0) return json;

  return JSON.stringify(result.workspace);
}

/**
 * One stack, capped.
 *
 * The hat takes the stack's coordinates and the stack loses them, because a block reached through
 * a `next` is not a top-level block and Blockly does not serialise coordinates for one. Leaving
 * them on would make the workspace round-trip to something different from what went in.
 *
 * The hat's name comes from the stack itself: if it already declares a signal input, that is the
 * signal this stack answers, and naming the hat after it means the migration **adds no port**.
 * `detectIO` is asked rather than a second walker written — it is the one traversal, and a
 * migration with its own idea of what a block means is LGC-004's L11 with a new noun.
 */
function wrapInHat(block: BlocklyBlockJson, index: number, fallbackSignal: string): BlocklyBlockJson {
  const { x, y, ...rest } = block;
  const declared = detectIO({ blocks: { blocks: [block] } }).signalInputs[0];

  return {
    type: HAT_BLOCK_TYPE,
    id: 'hat-' + (typeof block.id === 'string' && block.id ? block.id : String(index)),
    ...(x === undefined ? {} : { x }),
    ...(y === undefined ? {} : { y }),
    fields: { NAME: declared || fallbackSignal },
    next: { block: rest as BlocklyBlockJson }
  };
}
