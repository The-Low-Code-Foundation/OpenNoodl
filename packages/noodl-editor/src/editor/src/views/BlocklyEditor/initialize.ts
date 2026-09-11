/**
 * One-time registration of the Noodl block set and its code generators.
 *
 * Blockly's block and generator registries are module-global, so this runs once per renderer
 * and is idempotent. It lives in its own module rather than in `index.ts` so
 * `BlocklyWorkspace` can call it without importing the barrel that exports it.
 *
 * @module BlocklyEditor
 */

import * as Blockly from 'blockly';

import { initNoodlBlocks } from './NoodlBlocks';
import { initNoodlGenerators } from './NoodlGenerators';
import { applyStackCopy } from './stackCopy';

let blocklyInitialized = false;

/**
 * Register the custom blocks and generators. Safe to call any number of times; the toolbox
 * references these block types by name, so it must not be built before this has run.
 *
 * ⚠️ **Nothing that reaches React may be imported here.** This module is reachable from the
 * plain-Node `tests-unit` runner — `lgc-007`'s inliner and save specs call it to get the block
 * definitions they operate on — and a `@noodl-core-ui` import in its graph fails those suites
 * *to run*. VFN-003's dialog registration therefore hangs off `BlocklyWorkspace`, which is the
 * one thing that injects a workspace and is React already.
 */
export function initBlocklyIntegration() {
  if (blocklyInitialized) {
    return;
  }

  initNoodlBlocks();
  initNoodlGenerators();
  // FB-027 — copy, duplicate and cut take the whole stack. Here rather than in the workspace
  // component because Blockly's registries are renderer-wide and this is the one-time hook that
  // already knows it.
  applyStackCopy(Blockly as never);

  blocklyInitialized = true;
}
