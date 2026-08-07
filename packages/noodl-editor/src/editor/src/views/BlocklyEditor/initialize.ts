/**
 * One-time registration of the Noodl block set and its code generators.
 *
 * Blockly's block and generator registries are module-global, so this runs once per renderer
 * and is idempotent. It lives in its own module rather than in `index.ts` so
 * `BlocklyWorkspace` can call it without importing the barrel that exports it.
 *
 * @module BlocklyEditor
 */

import { initNoodlBlocks } from './NoodlBlocks';
import { initNoodlGenerators } from './NoodlGenerators';

let blocklyInitialized = false;

/**
 * Register the custom blocks and generators. Safe to call any number of times; the toolbox
 * references these block types by name, so it must not be built before this has run.
 */
export function initBlocklyIntegration() {
  if (blocklyInitialized) {
    return;
  }

  initNoodlBlocks();
  initNoodlGenerators();

  blocklyInitialized = true;
}
