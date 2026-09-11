/**
 * LAS-007 §1 — this client's binding of the rejection-example table.
 *
 * The table, the matching and the budget policy are shared
 * (`validation/diagnosticExamples`); what belongs here is the two things only
 * this client can supply: where the examples are read from (`catalog.ts`, the
 * enriched catalog bundled into this package) and how long "one session" lasts.
 *
 * One budget per server process, created by `createServer` and handed to both
 * write groups. That is the right span: an MCP server process is one agent's
 * session, so the first `interfaceless-instance` rejection of the session
 * carries the recipe and the fifth carries its id. A budget per *tool call*
 * would re-send 3 KB on every turn of a repair loop, which is the failure the
 * cap exists to prevent; a budget per *process lifetime* held at module scope
 * would leak between the servers the specs stand up in one process.
 */

import type { AttachedExample, CatalogExampleLike, Diagnostic } from '../editor-deps';
import { exampleAttachments } from '../editor-deps';
import { getExample } from '../catalog';

export interface ExampleBudget {
  /**
   * The recipes answering these diagnostics, and a record that they went out.
   * Empty when nothing in the table matches — most rejections attach nothing,
   * which is the point: a door that always says something is a door nobody reads.
   */
  attach(diagnostics: readonly Diagnostic[]): AttachedExample[];
}

export function createExampleBudget(): ExampleBudget {
  const sentCodes = new Set<string>();
  return {
    attach: (diagnostics) =>
      exampleAttachments(diagnostics, (id) => getExample(id) as CatalogExampleLike | undefined, sentCodes)
  };
}

/**
 * The `examples` block of a rejection payload, present only when there is one.
 *
 * The sentence matters as much as the graph. The audit measured a 100%
 * self-correction rate on rejections carrying a suggestion — but only where the
 * suggestion said what to *do*. "Here is a fragment" is not that; "this is the
 * shape that fixes it, copy the wiring" is.
 */
export function examplesBlock(
  attached: readonly AttachedExample[]
): { examples?: { note: string; recipes: AttachedExample[] } } {
  if (attached.length === 0) return {};
  return {
    examples: {
      note:
        'Validated graphs that already do the thing this rejection is asking for. Copy the wiring, not the copy. ' +
        'Where a fragment is omitted, get_example returns it.',
      recipes: [...attached]
    }
  };
}
