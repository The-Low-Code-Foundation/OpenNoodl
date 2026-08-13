/**
 * Walking a serialised workspace, and finding the calls in it.
 *
 * Every guard in My Blocks — the cycle check, the delete refusal, the regeneration sweep —
 * ultimately asks one question of a lump of Blockly JSON: *which saved blocks does this call?*
 * That question is answered here, once, over the JSON rather than over live Blockly objects,
 * so that it is the same answer in the renderer, in a headless generate and in a test.
 *
 * A call block carries its target in `extraState.defId`. `extraState` (rather than a field) is
 * what Blockly serialises for a block whose inputs are built at load time, which is what a
 * call block with N arguments has to be.
 *
 * @module BlocklyEditor/myblocks
 */

import {
  MY_BLOCKS_CALL_STATEMENT,
  MY_BLOCKS_CALL_TYPES,
  MY_BLOCKS_CALL_VALUE
} from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import type { BlocklyBlockJson, BlocklyWorkspaceJson, MyBlockHolePath } from './format';

/**
 * The two call block type ids.
 *
 * 🔴 **Declared in `@noodl/runtime`'s `logic-builder-io.ts` and re-exported here**, for
 * `HAT_BLOCK_TYPE`'s reason: since VFN-008 `detectIO` has to recognise a call block, and `detectIO`
 * runs in the *viewer* window, which cannot import anything from the editor. The string both halves
 * agree on therefore lives on the side that cannot import the other. A second copy here would be
 * register L11 — one fact, two sources — on a string that is already frozen into `project.json`.
 *
 * `MY_BLOCKS_CALL_VALUE` is a saved block used as an expression (it has an output plug);
 * `MY_BLOCKS_CALL_STATEMENT` is one you stack.
 */
export { MY_BLOCKS_CALL_STATEMENT, MY_BLOCKS_CALL_TYPES, MY_BLOCKS_CALL_VALUE };

/** The prefix of the argument inputs a call block builds, one per parameter. */
export const ARG_INPUT_PREFIX = 'ARG';

export function argInputName(index: number): string {
  return `${ARG_INPUT_PREFIX}${index}`;
}

export function isMyBlocksCall(block: BlocklyBlockJson | undefined | null): boolean {
  return !!block && MY_BLOCKS_CALL_TYPES.indexOf(block.type) !== -1;
}

/** The definition a call block points at, or `null` if the block is not a call or is broken. */
export function callDefinitionId(block: BlocklyBlockJson | undefined | null): string | null {
  if (!isMyBlocksCall(block)) return null;
  const state = block!.extraState;
  if (!state || typeof state !== 'object') return null;
  const id = (state as Record<string, unknown>).defId;
  return typeof id === 'string' && id.length > 0 ? id : null;
}

export interface WalkStep {
  block: BlocklyBlockJson;
  /** The path from the workspace root to this block. See `MyBlockHolePath`. */
  path: MyBlockHolePath;
  /** `true` for a shadow block — a default value, not something the user placed. */
  shadow: boolean;
}

/**
 * Depth-first over every block in a workspace, shadows included.
 *
 * Order is document order: root by root, then each root's value inputs and statement inputs
 * in key order, then its `next` chain. That order is what makes `collectReferences` stable,
 * which in turn makes a cycle message name the same cycle every time.
 */
export function walkWorkspace(workspace: BlocklyWorkspaceJson | undefined | null, visit: (step: WalkStep) => void): void {
  const roots = workspace?.blocks?.blocks;
  if (!Array.isArray(roots)) return;

  roots.forEach((root, index) => {
    walkBlock(root, [String(index)], false, visit);
  });
}

function walkBlock(
  block: BlocklyBlockJson | undefined,
  path: MyBlockHolePath,
  shadow: boolean,
  visit: (step: WalkStep) => void
): void {
  if (!block || typeof block !== 'object' || typeof block.type !== 'string') return;

  visit({ block, path, shadow });

  if (block.inputs) {
    for (const key of Object.keys(block.inputs)) {
      const input = block.inputs[key];
      if (!input) continue;
      walkBlock(input.block, path.concat(`i:${key}`), shadow, visit);
      walkBlock(input.shadow, path.concat(`i:${key}`), true, visit);
    }
  }

  if (block.next) {
    walkBlock(block.next.block, path.concat('n'), shadow, visit);
    walkBlock(block.next.shadow, path.concat('n'), true, visit);
  }
}

/**
 * Every definition id called anywhere in this workspace, deduplicated, in document order.
 *
 * This is the authority on the edges of the definition graph. A definition's stored
 * `requires` is a cache of exactly this over its own body, and no guard reads the cache.
 */
export function collectReferences(workspace: BlocklyWorkspaceJson | undefined | null): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  walkWorkspace(workspace, ({ block }) => {
    const id = callDefinitionId(block);
    if (id && !seen.has(id)) {
      seen.add(id);
      ordered.push(id);
    }
  });

  return ordered;
}

/** Every call block in the workspace, with the path it sits at. Used by the detach path. */
export function collectCallSites(
  workspace: BlocklyWorkspaceJson | undefined | null
): { defId: string; path: MyBlockHolePath; block: BlocklyBlockJson }[] {
  const sites: { defId: string; path: MyBlockHolePath; block: BlocklyBlockJson }[] = [];

  walkWorkspace(workspace, ({ block, path }) => {
    const defId = callDefinitionId(block);
    if (defId) sites.push({ defId, path, block });
  });

  return sites;
}

/**
 * Every **Blockly workspace variable** the body reads or writes, by name, in document order.
 *
 * 🔴 The hazard VFN-008 exists to name. A Blockly `variables_get` refers to a variable in the
 * workspace it was *saved from*; placed in a different Visual Function, that variable does not
 * exist. `remapCallTargets` remaps definition ids, not variable ids, and nothing else remaps
 * them either — so a definition that uses one is a definition that will not travel intact, and
 * the only honest thing to do is say so before it is saved.
 *
 * ⚠️ Blockly variables only, deliberately. `noodl_get_variable` / `noodl_set_variable` are the
 * *runtime's* variables — global, resolved by name at run time, and unaffected by which
 * workspace the block is in — so warning about those would be a false alarm on the mechanism
 * that actually works.
 *
 * A variable field serialises as `{ id }` (Blockly 10+) or as a bare name (older exports), and
 * the id is resolved through the workspace's own `variables` table. Both are read, because an
 * old definition on disk is exactly the case this warning must not go silent on.
 */
export function collectVariableReferences(workspace: BlocklyWorkspaceJson | undefined | null): string[] {
  const namesById = new Map<string, string>();
  for (const variable of workspace?.variables ?? []) {
    if (variable && typeof variable.id === 'string' && typeof variable.name === 'string') {
      namesById.set(variable.id, variable.name);
    }
  }

  const seen = new Set<string>();
  const ordered: string[] = [];

  walkWorkspace(workspace, ({ block }) => {
    for (const field of Object.keys(block.fields || {})) {
      // `VAR` is Blockly's own name for a variable field, and every stock block that binds one
      // — `variables_get`, `variables_set`, `math_change`, `controls_for`, `controls_forEach` —
      // uses it. Matching on the field name rather than on a list of block types is what makes
      // this cover a block nobody has written yet.
      if (field !== 'VAR') continue;

      const value = block.fields![field];
      let name: string | undefined;
      if (typeof value === 'string') {
        name = value;
      } else if (value && typeof value === 'object') {
        const record = value as Record<string, unknown>;
        if (typeof record.name === 'string') name = record.name;
        else if (typeof record.id === 'string') name = namesById.get(record.id);
      }

      if (name && !seen.has(name)) {
        seen.add(name);
        ordered.push(name);
      }
    }
  });

  return ordered;
}

/**
 * Resolve a hole path to the *parent* block and the input name it addresses.
 *
 * Returns `null` when the path does not lead anywhere, which is the honest answer for a path
 * recorded against a body that has since been edited — the caller treats that as "no
 * argument to splice" rather than throwing, because a stale path must not take out a
 * generate.
 */
export function resolveHole(
  workspace: BlocklyWorkspaceJson | undefined | null,
  path: MyBlockHolePath
): { parent: BlocklyBlockJson; input: string } | null {
  const roots = workspace?.blocks?.blocks;
  if (!Array.isArray(roots) || path.length < 2) return null;

  const rootIndex = Number(path[0]);
  if (!Number.isInteger(rootIndex) || rootIndex < 0 || rootIndex >= roots.length) return null;

  let current: BlocklyBlockJson | undefined = roots[rootIndex];

  for (let i = 1; i < path.length - 1; i++) {
    if (!current) return null;
    const token = path[i];
    if (token === 'n') {
      current = current.next?.block;
    } else if (token.startsWith('i:')) {
      current = current.inputs?.[token.slice(2)]?.block;
    } else {
      return null;
    }
  }

  const last = path[path.length - 1];
  if (!current || !last.startsWith('i:')) return null;

  return { parent: current, input: last.slice(2) };
}
