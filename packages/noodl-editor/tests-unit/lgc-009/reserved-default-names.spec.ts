/**
 * LGC-009 — a block's DEFAULT name may not be one the node already owns.
 *
 * ## The defect this exists for
 *
 * `⚡ Define signal output` and `⚡ send signal` both defaulted to `'done'`, which is on
 * `RESERVED_OUTPUTS`. So the first thing a new author does — drag the block, press Run, accept the
 * placeholder — raised `logic-builder/reserved-port-name` and put the node in its error style.
 * Reported by Richard on 2026-09-04, in exactly those words: *"accidentally left the set output
 * signal as the default 'done' (which shouldn't be allowed)"*.
 *
 * ⚠️ **The fix was two string literals; this gate is the part that matters.** Two literals can be
 * reintroduced by anyone adding a block, and the failure is invisible until somebody runs the
 * program — `updatePorts` *drops* a reserved name silently, so the port simply never appears.
 *
 * ## Why the population is DERIVED and not listed
 *
 * A spec naming the two blocks it already knows about would pass forever on the two blocks it
 * already knows about. The rule is a property of *every* block in the palette, so the population is
 * read back out of `Blockly.Blocks` after `initNoodlBlocks()` — the same registry the editor draws
 * from. A block added next month is in this gate the day it is registered, without anyone
 * remembering this file exists.
 *
 * ## Why `RESERVED_OUTPUTS` and not both lists
 *
 * 🔴 **The hat's default IS a reserved input, deliberately.** `DEFAULT_HAT_SIGNAL` is `'run'`,
 * which is on `RESERVED_INPUTS` precisely so a default hat names the node's *existing* `Run` port
 * instead of minting a second one (see the constant's own note). So a blanket check against both
 * lists would fail on the one block whose reserved default is correct. `RESERVED_OUTPUTS` is the
 * list with no legitimate default on it, and it is the list `'done'` was on. §3 pins the hat's
 * exception so it stays a stated exception rather than a hole.
 */

import * as Blockly from 'blockly';

import {
  DEFAULT_HAT_SIGNAL,
  DEFAULT_SIGNAL_OUTPUT,
  HAT_BLOCK_TYPE,
  RESERVED_INPUTS,
  RESERVED_OUTPUTS
} from '@noodl/runtime/src/nodes/std-library/logic-builder-io';

import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';

initNoodlBlocks();

/** Every field that names a port. `PROPERTY` and `PATH` name neither an input nor an output port. */
const NAME_FIELDS = ['NAME'];

interface BlockDefault {
  type: string;
  field: string;
  value: string;
}

/**
 * Every Noodl block's default port name, read off a real headless block.
 *
 * ⚠️ **Instantiation is wrapped, and the skips are counted rather than swallowed.** A few blocks
 * build their dropdowns from editor state (`noodl_get_config`, `noodl_library_global`) and can
 * refuse to construct under a plain-Node runner. That is fine — they carry no `NAME` field — but a
 * gate whose population quietly collapsed to zero would report a clean pass, which is the failure
 * this codebase has written up more than once. §2 asserts the count.
 */
function collectDefaults(): { defaults: BlockDefault[]; skipped: string[]; considered: number } {
  const types = Object.keys(Blockly.Blocks).filter((type) => type.startsWith('noodl_'));
  const defaults: BlockDefault[] = [];
  const skipped: string[] = [];

  const workspace = new Blockly.Workspace();
  try {
    for (const type of types) {
      let block: Blockly.Block;
      try {
        block = workspace.newBlock(type);
      } catch (e) {
        skipped.push(type);
        continue;
      }

      for (const field of NAME_FIELDS) {
        const value = block.getFieldValue(field);
        if (typeof value === 'string') {
          defaults.push({ type, field, value });
        }
      }
    }
  } finally {
    workspace.dispose();
  }

  return { defaults, skipped, considered: types.length };
}

const { defaults, skipped, considered } = collectDefaults();

describe('LGC-009 §1 — no block ships a default the node already owns', () => {
  it('registers the Noodl palette', () => {
    // The population this gate reasons about. If `initNoodlBlocks` ever stops registering, every
    // assertion below would be vacuously true, so the count is asserted before it is used.
    expect(considered).toBeGreaterThanOrEqual(20);
  });

  it('reads a NAME default off enough blocks to be measuring something', () => {
    // Eleven blocks carry a `NAME` field today. Asserting a floor rather than the exact number
    // keeps this from failing on every new block, while still refusing an empty population.
    expect(defaults.length).toBeGreaterThanOrEqual(8);
    expect(skipped.length).toBeLessThan(considered);
  });

  it('ships no default that is on RESERVED_OUTPUTS', () => {
    const offenders = defaults.filter((d) => RESERVED_OUTPUTS.indexOf(d.value) !== -1);

    // The message names the block and the value, because the person who trips this will be adding
    // a block and will not have read this file.
    expect(offenders.map((o) => `${o.type}.${o.field} = "${o.value}"`)).toEqual([]);
  });
});

describe('LGC-009 §2 — the instrument has teeth', () => {
  /**
   * 🔴 **The known-broken arm.** A gate that only ever sees correct data cannot distinguish
   * "nothing is wrong" from "nothing is being read". This registers the defect as it actually
   * shipped — a block whose `NAME` defaults to `'done'` — and asserts the same predicate catches
   * it. If this ever goes green, §1's silence means nothing.
   */
  const MUTANT_TYPE = 'noodl_reserved_default_mutant';

  beforeAll(() => {
    Blockly.Blocks[MUTANT_TYPE] = {
      init: function (this: Blockly.Block) {
        this.appendDummyInput().appendField(new Blockly.FieldTextInput('done'), 'NAME');
      }
    };
  });

  afterAll(() => {
    delete Blockly.Blocks[MUTANT_TYPE];
  });

  it('flags a block that defaults to a reserved output', () => {
    const workspace = new Blockly.Workspace();
    try {
      const block = workspace.newBlock(MUTANT_TYPE);
      const value = block.getFieldValue('NAME');

      expect(value).toBe('done');
      expect(RESERVED_OUTPUTS.indexOf(value)).not.toBe(-1);
    } finally {
      workspace.dispose();
    }
  });
});

describe('LGC-009 §3 — the two defaults that are load-bearing', () => {
  it('keeps the signal-output default off the reserved list', () => {
    expect(RESERVED_OUTPUTS.indexOf(DEFAULT_SIGNAL_OUTPUT)).toBe(-1);
  });

  it('gives the define and the send the SAME default, so an all-defaults program runs', () => {
    // The pair is the point: `⚡ Define signal output` declares the port and `⚡ send signal` sends
    // to it. Two different placeholders would leave a beginner sending to a port nothing declared —
    // a quieter version of the same dead end, with no error to explain it.
    const defineDefault = defaults.find((d) => d.type === 'noodl_define_signal_output');
    const sendDefault = defaults.find((d) => d.type === 'noodl_send_signal');

    expect(defineDefault?.value).toBe(DEFAULT_SIGNAL_OUTPUT);
    expect(sendDefault?.value).toBe(DEFAULT_SIGNAL_OUTPUT);
  });

  it('keeps the hat naming the built-in Run port, which IS reserved on purpose', () => {
    // The stated exception to §1. `'run'` is on RESERVED_INPUTS so that a default hat publishes no
    // new port — it names the one the node already has. It is absent from RESERVED_OUTPUTS, which
    // is why §1's rule and this fact do not collide.
    expect(RESERVED_INPUTS.indexOf(DEFAULT_HAT_SIGNAL)).not.toBe(-1);
    expect(RESERVED_OUTPUTS.indexOf(DEFAULT_HAT_SIGNAL)).toBe(-1);

    const hatDefault = defaults.find((d) => d.type === HAT_BLOCK_TYPE);
    expect(hatDefault?.value).toBe(DEFAULT_HAT_SIGNAL);
  });
});
