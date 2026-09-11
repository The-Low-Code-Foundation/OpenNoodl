/**
 * LGC-007 §3 — what a refusal to generate **returns**, which is not the same question as what
 * it warns about.
 *
 * ## The class this file exists for
 *
 * Twice now this feature has shipped a path that declines to generate, logs a good message,
 * and then writes `''` into the node's `generatedCode` parameter — over the last-known-good
 * program, on disk, in `project.json`. `disableOrphans` did it (reverted, `f1b57c0f`) and the
 * cycle guard did it (driven and confirmed 2026-08-12).
 *
 * Both times the refusal itself was correct. Both times the console message was better than
 * its spec asked for. The defect was one line further on, in what got written.
 *
 * > **The rule: ask what a refusal path _writes_, not whether it warns.**
 *
 * ## Why the contract is pinned here rather than in the compiler
 *
 * 🔴 `strictNullChecks` is **off** across this package — the root `tsconfig.json` sets no
 * `strict` flags at all. `GenerateResult.code` was declared `string` while the error path
 * returned `undefined`, and that compiled silently for as long as it existed. So the
 * `string | undefined` annotations on this seam are documentation, not enforcement: nothing
 * stops a future edit returning `''` here, and nothing forces the caller's `=== undefined`
 * check. These specs are the only thing holding it.
 *
 * ## What is graded here, and what is not
 *
 * Graded: `generateWithMyBlocks` returns `undefined` — **never `''`** — when the definition
 * graph is broken, and returns a real string when it is not.
 *
 * Not graded, and it needs a driven editor: that `OverlayViews.handleBlocklyWorkspaceChange`
 * skips the `setParameter('generatedCode', …)` call on `undefined` while still saving the
 * workspace. That function reaches React and the editor's node-graph singleton, and this
 * runner is `testEnvironment: 'node'` with no jsdom. The drive step is written out in
 * LGC-007's `## Deferred verification`.
 */

import * as Blockly from 'blockly';

import { initNoodlBlocks } from '../../src/editor/src/views/BlocklyEditor/NoodlBlocks';
import { generateWithMyBlocks } from '../../src/editor/src/views/BlocklyEditor/MyBlocksBlocks';
import type { DefinitionSource } from '../../src/editor/src/views/BlocklyEditor/myblocks/expand';
import type {
  BlocklyWorkspaceJson,
  MyBlockDefinition,
  MyBlockShape
} from '../../src/editor/src/views/BlocklyEditor/myblocks/format';
import { MY_BLOCKS_CALL_STATEMENT } from '../../src/editor/src/views/BlocklyEditor/myblocks/references';

/** A statement call block pointing at `defId`, as it appears in serialised JSON. */
function callBlock(defId: string) {
  return { type: MY_BLOCKS_CALL_STATEMENT, extraState: { defId } };
}

function workspaceJson(blocks: unknown[]): BlocklyWorkspaceJson {
  return { blocks: { languageVersion: 0, blocks: blocks as never } };
}

function definition(id: string, body: BlocklyWorkspaceJson, shape: MyBlockShape = 'statement'): MyBlockDefinition {
  return {
    formatVersion: 1,
    id,
    name: id.toUpperCase(),
    shape,
    params: [],
    // Deliberately empty and deliberately wrong for the cyclic fixtures below. `requires` is a
    // derived cache and the guard is documented as never trusting it — it re-walks the body.
    // A fixture that filled this in correctly would not prove that.
    requires: [],
    body,
    createdAt: '2026-08-12T00:00:00.000Z',
    updatedAt: '2026-08-12T00:00:00.000Z'
  };
}

function sourceOf(...definitions: MyBlockDefinition[]): DefinitionSource {
  const byId = new Map(definitions.map((d) => [d.id, d]));
  return { get: (id: string) => byId.get(id) };
}

describe('LGC-007 §3 — generateWithMyBlocks declines without emitting a program', () => {
  let workspace: Blockly.Workspace;

  beforeAll(() => {
    initNoodlBlocks();
  });

  beforeEach(() => {
    workspace = new Blockly.Workspace();
  });

  afterEach(() => {
    workspace.dispose();
  });

  describe('a cycle in the definition graph', () => {
    // A calls B, B calls A. The program under edit calls A.
    const a = definition('a', workspaceJson([callBlock('b')]));
    const b = definition('b', workspaceJson([callBlock('a')]));
    const program = workspaceJson([callBlock('a')]);

    it('reports an error rather than throwing', () => {
      const result = generateWithMyBlocks(workspace as never, program, sourceOf(a, b));

      expect(result.error).toBeDefined();
      expect(result.error!.name).toBe('MyBlocksCycleError');
    });

    it('🔴 returns undefined, and specifically NOT an empty string', () => {
      const result = generateWithMyBlocks(workspace as never, program, sourceOf(a, b));

      // The whole file is for this line. `toBeUndefined` alone would pass for `''` under a
      // loose matcher, so the empty string is excluded by name as well.
      expect(result.code).toBeUndefined();
      expect(result.code).not.toBe('');
    });
  });

  describe('a reference to a definition that is not on the shelf', () => {
    const program = workspaceJson([callBlock('deleted-from-under-us')]);

    it('🔴 returns undefined rather than an empty string', () => {
      const result = generateWithMyBlocks(workspace as never, program, sourceOf());

      expect(result.error).toBeDefined();
      expect(result.error!.name).toBe('MyBlocksMissingDefinitionError');
      expect(result.code).toBeUndefined();
      expect(result.code).not.toBe('');
    });
  });

  describe('the healthy paths still produce a string', () => {
    it('an empty program generates `""` with no error — this is the case `undefined` must stay distinct from', () => {
      const result = generateWithMyBlocks(workspace as never, workspaceJson([]), sourceOf());

      expect(result.error).toBeUndefined();
      // A program the user really did empty is an empty string, and it is legitimate to write
      // it. That is precisely why a refusal may not use the same value.
      expect(result.code).toBe('');
    });

    it('a program whose saved blocks expand cleanly generates code', () => {
      // `d` is a leaf definition: it calls nothing, so the graph is acyclic and complete.
      const d = definition('d', workspaceJson([]));
      const result = generateWithMyBlocks(workspace as never, workspaceJson([callBlock('d')]), sourceOf(d));

      expect(result.error).toBeUndefined();
      expect(typeof result.code).toBe('string');
    });
  });
});
