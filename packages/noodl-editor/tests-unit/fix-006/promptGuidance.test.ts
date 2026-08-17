/**
 * FIX-006 — the node-choice guidance, graded as copy.
 *
 * ## Why this file exists at all
 *
 * Session 43 shipped the `Javascript2` id into the Script paragraph and wrote, in the task file:
 * *"Nothing grades this string. No spec anywhere asserts the Script line — checked, including
 * `noodl-mcp`'s `rejectionExamples.test.ts`, which asserts four other `authoringTraps` substrings.
 * An edit that dropped the id again would be caught by nothing."* That was true of the whole
 * block: the only graders were a jasmine spec needing a real Electron renderer, which asserts the
 * PROJECT CONVENTIONS section and not this one, and an MCP stdio test asserting four substrings
 * from the visual traps.
 *
 * The copy is the entire deliverable of this task — there is no behaviour under it — so the copy
 * is what has to be gradeable, in a runner that costs nothing to run.
 *
 * ## What is actually asserted, and what would be theatre
 *
 * Asserting that a sentence contains its own words proves nothing; every check here is either a
 * cross-file agreement or a claim the block makes ABOUT ITSELF that could go false silently:
 *
 *  - the node type names the guidance recommends are read back out of the shipped catalog, so a
 *    recommendation naming a node that does not exist fails here rather than in a repair round;
 *  - `traps.ts` claims "the type name leads every line … it is also the id the agent must actually
 *    write" — so every line of the comparison is checked to lead with a real `typeName`;
 *  - both halves of Richard's ruling are required, because a block carrying only the first half is
 *    the specific failure the ruling was written to prevent;
 *  - both assembled channels — `AUTHORING_TRAPS` for MCP, `systemPrompt()` for the editor — are
 *    required to carry all three blocks, which is the property session 38 had to start a renderer
 *    to measure.
 */
import * as fs from 'fs';
import * as path from 'path';

import {
  AUTHORING_TRAPS,
  CODE_STYLE,
  NODES_BEFORE_CODE,
  THREE_WAYS_TO_COMPUTE
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/traps';
import { systemPrompt } from '../../src/editor/src/models/AiAssistant/authoring/prompts/authoring';
import { chooserNotes } from '../../src/editor/src/views/NodePicker/NodePicker.chooser';

/** Every `typeName` the shipped product actually has. */
const CATALOG_TYPE_NAMES: ReadonlySet<string> = (() => {
  const file = path.join(__dirname, '../../../noodl-types/src/node-catalog-enriched.json');
  const catalog = JSON.parse(fs.readFileSync(file, 'utf8')) as { nodes: { typeName: string }[] };
  return new Set(catalog.nodes.map((n) => n.typeName));
})();

/** The names a prompt block puts in backticks are the ids it is telling the model to write. */
function backtickedNames(block: string): string[] {
  return Array.from(block.matchAll(/`([^`]+)`/g)).map((m) => m[1]);
}

describe('FIX-006 — the catalog is the source of the node names', () => {
  it('has the four compute types the guidance is written around', () => {
    // The control for the assertions below: if this set were empty or misspelled, every
    // "is a real typeName" check would pass vacuously or fail for the wrong reason.
    for (const type of ['Expression', 'Logic Builder', 'JavaScriptFunction', 'Javascript2']) {
      expect(CATALOG_TYPE_NAMES.has(type)).toBe(true);
    }
    expect(CATALOG_TYPE_NAMES.has('NotANodeType')).toBe(false);
  });
});

describe('FIX-006 — NODES BEFORE CODE carries BOTH halves of the ruling', () => {
  it('states the weighting: the library over a line of code', () => {
    expect(NODES_BEFORE_CODE).toContain('NODES BEFORE CODE');
    expect(NODES_BEFORE_CODE).toContain('Weigh the node library heavier');
  });

  /**
   * 🔴 The half a rewrite is most likely to lose. Richard: *"unless the operation requires more
   * complexity which could be easily rolled into a Function, otherwise you end up with function
   * nodes connected to substring nodes connected to functions etc."* A block that pushed only
   * "use the node" would manufacture the alternation the ruling exists to forbid, and session
   * 39's node-choice criteria would have scored that as a win.
   */
  it('states the exception, and names the forbidden shape in the concrete', () => {
    expect(NODES_BEFORE_CODE).toContain('ONE code node');
    expect(NODES_BEFORE_CODE).toContain('Never split one calculation');
    // ⚠️ Matched across whitespace on purpose. The block is hard-wrapped, and the closing clause
    // — "⇒ one / code node, all of it" — falls across a line break. A literal `toContain` for it
    // failed here first time; the same phrase was a marker in the harness's control arm, where the
    // equivalent failure would have been silent.
    expect(NODES_BEFORE_CODE).toMatch(/one\s+code node, all of it/);
    expect(NODES_BEFORE_CODE).toMatch(/JavaScriptFunction.+Substring.+JavaScriptFunction/s);
  });

  it('recommends only nodes that exist', () => {
    const named = backtickedNames(NODES_BEFORE_CODE);
    expect(named.length).toBeGreaterThan(0);
    for (const name of named) expect(CATALOG_TYPE_NAMES.has(name)).toBe(true);
    // …and specifically the one the ruling is about, since the whole measurement is a count of it.
    expect(named).toContain('Substring');
  });
});

describe('FIX-006 — THREE WAYS TO COMPUTE keeps its own stated rule', () => {
  /**
   * `traps.ts` says of itself: *"The type name leads every line … It is also the id the agent must
   * actually write."* Session 38 measured that this was true of three items and false of the
   * fourth — the Script paragraph was prose, and `Javascript2` appeared nowhere in the assembled
   * prompt. Session 43 fixed it. Nothing has graded it since.
   */
  it('leads every line with a real type name, the Script paragraph included', () => {
    const lines = THREE_WAYS_TO_COMPUTE.split('\n')
      .map((line) => line.trim())
      .filter((line) => line.startsWith('-') || line.startsWith('`'));
    // The three recommendations plus the prohibition.
    expect(lines.length).toBe(4);
    for (const line of lines) {
      const leading = /^-?\s*`([^`]+)`/.exec(line);
      expect(leading).not.toBeNull();
      expect(CATALOG_TYPE_NAMES.has((leading as RegExpExecArray)[1])).toBe(true);
    }
  });

  it('carries the Script node id, which is what AC4 asked for', () => {
    expect(THREE_WAYS_TO_COMPUTE).toContain('`Javascript2`');
    expect(THREE_WAYS_TO_COMPUTE).toContain('reach for it LAST');
  });

  it('is generated from the picker rather than retyped beside it', () => {
    // The reason `NodePicker.chooser.ts` is import-free. If the two ever became separate copies,
    // the picker could be reworded and the prompt would keep the old comparison silently.
    for (const note of chooserNotes()) {
      expect(THREE_WAYS_TO_COMPUTE).toContain(note.headline);
      expect(THREE_WAYS_TO_COMPUTE).toContain(note.signals);
    }
  });
});

describe('FIX-006 — both channels carry all three blocks', () => {
  /** The MCP client's channel: `get_project_info` returns this string as `authoringTraps`. */
  it('AUTHORING_TRAPS embeds them', () => {
    expect(AUTHORING_TRAPS).toContain(NODES_BEFORE_CODE);
    expect(AUTHORING_TRAPS).toContain(THREE_WAYS_TO_COMPUTE);
    expect(AUTHORING_TRAPS).toContain(CODE_STYLE);
  });

  /**
   * The editor's channel. Session 38 had to call this in a live renderer to measure it; it is
   * pure, and this is the same string.
   */
  it.each(['create', 'update'] as const)('systemPrompt(%s) embeds them', (mode) => {
    const prompt = systemPrompt(mode);
    expect(prompt).toContain(NODES_BEFORE_CODE);
    expect(prompt).toContain(THREE_WAYS_TO_COMPUTE);
    expect(prompt).toContain(CODE_STYLE);
    // The discriminating control session 38 ran beside its `includes` checks: an absent string
    // must come back false, or these assertions are measuring nothing.
    expect(prompt).not.toContain('NODES AFTER CODE');
  });

  it('stays byte-identical across calls, so it remains the cached prefix', () => {
    expect(systemPrompt('create')).toBe(systemPrompt('create'));
  });
});
