/**
 * LAS-007 — the recipe that fixes the rejection, attached to the rejection.
 *
 * ## The measurement
 *
 * Haiku's 42-turn cold replay called `list_examples`, `get_example` and the
 * project docs **zero times** — including across the 7 turns it spent stuck on
 * validation rejections it could have looked one of them up for. The two
 * recipes showing exactly its two fatal patterns sat unread. Sonnet retrieved
 * everything (5× `list_examples`, 3+ `get_example`) and used it.
 *
 * A mid-tier model acts on what is **pushed** — it read the doctrine that
 * arrived unasked in `get_project_info` and decomposed correctly — and retrieves
 * nothing optional. So advice to retrieve is dead weight, and attachment works.
 * This module is the attachment.
 *
 * ## Why the table is not `Map<DiagnosticCode, string>`
 *
 * Because one of the four rejections LAS-007 must decorate does not have a code
 * of its own. The `layoutString` grammar error (LAS-003/1) is reported as
 * `InvalidParameterValue` — the same code carried by every unit, enum and
 * encoding problem in `parameterValues.ts`. Keyed on code alone, a Columns
 * recipe would be stapled to "`opacity` must be between 0 and 1".
 *
 * So an entry may narrow by `nodeType` and `port`, and the most specific
 * matching entry wins. The generic-code case is the reason the extra two fields
 * exist; do not remove them because the interface entries do not use them.
 *
 * ## Budget
 *
 * The full fragment goes out on the **first** rejection carrying a given code;
 * every rejection after that cites the id and the title only. A model stuck in a
 * repair loop must not be re-sent the same 3 KB on every turn — that is how a
 * context window is spent teaching something already taught. `sentCodes` is the
 * caller's memory of what has gone out; both clients hold one per session.
 *
 * Pure: the caller supplies the example lookup, so this module has no opinion on
 * where the catalog lives (the editor reads it through `enrichedCatalog`, the
 * MCP server through its own `catalog.ts`, and both hand the same shape in).
 *
 * @module noodl-editor/validation/diagnosticExamples
 */

import { DiagnosticCode, type Diagnostic } from './diagnostics';

/** The Columns node type, spelled once — the generic-code entries key on it. */
const COLUMNS_TYPE = 'net.noodl.visual.columns';

/** How much example JSON one rejection may carry. Beyond this, cite the id. */
const FRAGMENT_BYTE_CAP = 4500;

/** Fields that carry canvas position, not meaning. Stripped from fragments. */
const COSMETIC_NODE_FIELDS = ['x', 'y'];

export interface ExampleCitation {
  /** The diagnostic this recipe answers. */
  code: DiagnosticCode;
  /** Narrows a generic code to the node type it is about. */
  nodeType?: string;
  /** Narrows further to one port. */
  port?: string;
  /** Example ids, most-relevant first. Every id is checked by a spec. */
  examples: string[];
  /** One clause: what the example shows that fixes *this*. */
  why: string;
}

/**
 * The table. Every id here is asserted to exist by
 * `noodl-mcp/tests/rejectionExamples.test.ts` — an entry naming an example that
 * has been renamed or deleted fails the suite rather than silently attaching
 * nothing.
 *
 * `ui-stat-tile-row` is the interface recipe throughout: measured against the
 * other two candidates it is the smallest fragment that shows both halves of the
 * pattern — a `Component Inputs` node with its ports plugged `"output"`, and
 * four instances of that component each setting those exact names
 * (3.6 KB, against `ui-icon-feature-strip` at 4.2 KB and `ui-card-grid-repeater`
 * at 5.9 KB, which is also carrying a Repeater and a query).
 *
 * ⚠️ All three of those recipes declared their ports `plug: "input"` until this
 * task corrected them — backwards, and the exact defect these entries exist to
 * teach the fix for. See `scripts/validate-examples.ts::interfaceDiagnostics`.
 */
export const DIAGNOSTIC_EXAMPLES: readonly ExampleCitation[] = [
  {
    code: DiagnosticCode.InterfacelessInstance,
    examples: ['ui-stat-tile-row'],
    why: 'a component whose Component Inputs ports are plugged "output", and four instances setting them by name'
  },
  {
    code: DiagnosticCode.InstanceUnknownParameter,
    examples: ['ui-stat-tile-row'],
    why: 'the instance parameters and the Component Inputs ports carrying the same names, which is what makes them arrive'
  },
  {
    code: DiagnosticCode.ComponentPortDirection,
    examples: ['ui-stat-tile-row'],
    why: 'a Component Inputs node plugged the right way round — "output", so values flow out of it into the graph'
  },
  {
    code: DiagnosticCode.PortWithoutPlug,
    examples: ['ui-stat-tile-row'],
    why: 'every declared port carrying an explicit plug, which is what decides the port exists at all'
  },
  // The generic-code entries. `InvalidParameterValue` covers every unit, enum
  // and encoding problem in the value layer, so these narrow to the three ports
  // whose grammar LAS-003/1 checks.
  ...['layoutString', 'mediumLayout', 'smallLayout'].map((port) => ({
    code: DiagnosticCode.InvalidParameterValue,
    nodeType: COLUMNS_TYPE,
    port,
    examples: ['vis-columns-media-cards', 'ui-card-grid-repeater'],
    why:
      'the two Columns modes: an explicit layout string of integers-and-spaces ("1 2"), and the autoFit mode ' +
      'that needs no layout string and reflows on its own'
  })),
  {
    code: DiagnosticCode.RepeatedSiblingSubtree,
    examples: ['data-static-array-filter-repeater'],
    why: 'the Static Data → For Each shape that replaces hand-duplicated siblings with one component and a row per item'
  },
  {
    code: DiagnosticCode.PageWithoutPageNode,
    examples: ['ui-page-shell-bands'],
    why: 'a page component built around a Page node at its root, which is what makes the router able to render it'
  },
  // LAS-012 — the repeater contract, from both directions. The same recipe
  // answers all three codes because all three are one misunderstanding: the
  // template is a component *named on a port*, and the Repeater holds nothing.
  // `data-static-array-filter-repeater` shows the whole shape and is already the
  // `RepeatedSiblingSubtree` recipe, which is the rejection a model is most
  // likely to have met just before this one.
  {
    code: DiagnosticCode.RepeaterWithoutTemplate,
    examples: ['data-static-array-filter-repeater', 'ui-card-grid-repeater'],
    why: 'a For Each whose template names a separate component, and that component reading each item through its Component Object'
  },
  {
    code: DiagnosticCode.RepeaterTemplateUnresolved,
    examples: ['data-static-array-filter-repeater'],
    why: 'the template path and the component it names, spelled the same way — "/Product Row" and the component called Product Row'
  },
  {
    code: DiagnosticCode.RepeaterWithVisualChildren,
    examples: ['data-static-array-filter-repeater', 'ui-card-grid-repeater'],
    why: 'the item markup living in its own component with nothing nested under the For Each, which is the only arrangement that renders'
  }
];

/**
 * The most specific entry matching a diagnostic, or nothing.
 *
 * Specificity is "how many of `nodeType`/`port` it pins", so a `layoutString`
 * entry beats a bare `InvalidParameterValue` one if both ever exist. A citation
 * that pins a field the diagnostic does not carry never matches — an entry is
 * either about this diagnostic or it is not.
 */
export function citationFor(diagnostic: Diagnostic): ExampleCitation | undefined {
  let best: ExampleCitation | undefined;
  let bestScore = -1;
  for (const entry of DIAGNOSTIC_EXAMPLES) {
    if (entry.code !== diagnostic.code) continue;
    if (entry.nodeType !== undefined && entry.nodeType !== diagnostic.location.nodeType) continue;
    if (entry.port !== undefined && entry.port !== diagnostic.location.port) continue;
    const score = (entry.nodeType !== undefined ? 1 : 0) + (entry.port !== undefined ? 1 : 0);
    if (score > bestScore) {
      best = entry;
      bestScore = score;
    }
  }
  return best;
}

/** As much of a catalog example as an attachment needs. */
export interface CatalogExampleLike {
  id: string;
  title: string;
  description?: string;
  components: Array<{ name: string; nodes: unknown[]; connections?: unknown[] }>;
}

/** One recipe, attached to a rejection. */
export interface AttachedExample {
  /** The diagnostic code this answers. */
  code: string;
  exampleId: string;
  title: string;
  /** What it shows that fixes this rejection. */
  why: string;
  /**
   * The graph itself — present on the FIRST rejection carrying this code, and
   * omitted thereafter so a repair loop does not re-send it every turn.
   */
  fragment?: Array<{ name: string; nodes: unknown[]; connections?: unknown[] }>;
  /** Present instead of `fragment`: how to get it. */
  note?: string;
}

/** Strip canvas coordinates — they are noise in a fragment meant to be read. */
function slim(nodes: readonly unknown[]): unknown[] {
  return nodes.map((node) => {
    if (!node || typeof node !== 'object') return node;
    const copy: Record<string, unknown> = { ...(node as Record<string, unknown>) };
    for (const field of COSMETIC_NODE_FIELDS) delete copy[field];
    return copy;
  });
}

/**
 * The attachments for one rejection's diagnostics.
 *
 * `sentCodes` is mutated: a code whose fragment goes out is recorded, so the
 * next rejection carrying it gets the citation only. Callers that want every
 * rejection fully decorated pass a fresh set.
 *
 * De-duplicated by example id, because a page can easily draw six
 * `instance-unknown-parameter` diagnostics that all have the same answer, and
 * six copies of one recipe is worse than none.
 */
export function exampleAttachments(
  diagnostics: readonly Diagnostic[],
  lookup: (id: string) => CatalogExampleLike | undefined,
  sentCodes: Set<string>
): AttachedExample[] {
  const attached: AttachedExample[] = [];
  const seenIds = new Set<string>();

  for (const diagnostic of diagnostics) {
    const citation = citationFor(diagnostic);
    if (!citation) continue;
    const full = !sentCodes.has(citation.code);
    let spent = 0;

    for (const id of citation.examples) {
      if (seenIds.has(id)) continue;
      const example = lookup(id);
      // A table entry naming an example the catalog does not have attaches
      // nothing rather than throwing: a rejection is not the place to discover
      // a stale id, and the spec that pins the table catches it long before.
      if (!example) continue;
      seenIds.add(id);

      const entry: AttachedExample = {
        code: citation.code,
        exampleId: id,
        title: example.title,
        why: citation.why
      };
      const fragment = example.components.map((c) => ({
        name: c.name,
        nodes: slim(c.nodes),
        ...(c.connections?.length ? { connections: c.connections } : {})
      }));
      const size = JSON.stringify(fragment).length;
      if (full && spent + size <= FRAGMENT_BYTE_CAP) {
        entry.fragment = fragment;
        spent += size;
      } else {
        entry.note = `Fetch the graph with get_example("${id}").`;
      }
      attached.push(entry);
    }
    if (full) sentCodes.add(citation.code);
  }

  return attached;
}
