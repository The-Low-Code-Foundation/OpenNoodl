/**
 * AIX-010 — reading components for a review, and why it is not the explain read.
 *
 * The first version of this task called `ContextBuilder.componentContext` for
 * each selected component, which is AIX-004's bounded component read. Running it
 * against the acceptance corpus (`project-examples/agent-chat`, 7 components,
 * 262 nodes) produced **150,749 characters of context** — for a project small
 * enough to read in an afternoon. Measuring where it went found the answer:
 *
 *   component shape, nodes and connections   55,631 chars
 *   node TYPE documentation                  94,249 chars   (63%)
 *
 * The type documentation is re-rendered per component, so `Group` and `Text`
 * are documented seven times; and each entry is mostly **port descriptions**,
 * because that is what an authoring turn needs — it is about to wire something
 * up. Hoisting and deduplicating it saves 38k, which is worth having.
 *
 * But the port descriptions should not be there at all, and that is the real
 * finding. A review is forbidden from writing about ports, connections or node
 * structure; that is the anti-goal the whole task turns on. Spending 63% of the
 * context on the exact vocabulary the output must not contain is not merely
 * wasteful — it is priming the failure. What a drafter needs from a node type is
 * *meaning*: "net.noodl.SSE — subscribes to a Server-Sent Events stream" tells
 * it the page streams; the `messages` port's description does not help it write
 * a sentence about intent.
 *
 * So a review read is the same bounded assembly with the type block pulled out,
 * and one project-level type block that carries names, categories and summaries
 * and no ports at all. Same corpus, same selection: 150,749 → ~61,000.
 *
 * @module AiAssistant/review/componentReads
 */

import { assembleContext, ExplainContextError } from '../explain/assemble';
import { renderContext } from '../explain/render';
import type { ContextNodeType, ExplainGraph } from '../explain/types';

/** The bound on a single review read. Generous — the type block is gone. */
const REVIEW_READ_OPTIONS = {
  maxNodes: 150,
  maxParametersPerNode: 6,
  maxParameterChars: 200
};

export interface ComponentRead {
  name: string;
  /** The component's graph, rendered without any node-type documentation. */
  body: string;
  /** Every distinct type in it, for the hoisted project-level block. */
  types: ContextNodeType[];
  /** Why the selector picked it. Set by the assembler, shown to model and user. */
  reason?: string;
}

/**
 * One component, bounded and rendered, minus the type block.
 *
 * Returns `undefined` when the component cannot be assembled (a name the graph
 * does not contain, or an assembly bound that rejected it) — the caller records
 * that as a component it did not read, which is the honest outcome and one the
 * user is shown.
 */
export function readComponentForReview(graph: ExplainGraph, name: string): ComponentRead | undefined {
  try {
    const context = assembleContext(graph, { scope: 'component', componentName: name }, REVIEW_READ_OPTIONS);
    // Render a shallow copy with the types removed. Assembling with
    // `maxNodeTypes: 0` would have been shorter, but it pushes "26 node type
    // description(s) omitted" into `bounds` and flips `truncated` — telling the
    // model it is missing something that was deliberately moved, which is how a
    // model starts hedging about the wrong thing.
    const body = renderContext({ ...context, nodeTypes: [] });
    return { name: context.component.name, body, types: context.nodeTypes };
  } catch (error) {
    if (error instanceof ExplainContextError) return undefined;
    throw error;
  }
}

/**
 * Merge the type records from every read into one deduplicated list, ordered by
 * how many of the read components used each type — the types a project leans on
 * hardest first, which is also the order a reader wants them in.
 */
export function mergeNodeTypes(reads: readonly ComponentRead[]): ContextNodeType[] {
  const merged = new Map<string, { type: ContextNodeType; uses: number }>();
  for (const read of reads) {
    for (const type of read.types) {
      const existing = merged.get(type.typeName);
      if (existing) existing.uses++;
      else merged.set(type.typeName, { type, uses: 1 });
    }
  }
  return [...merged.values()]
    .sort((a, b) => b.uses - a.uses || a.type.typeName.localeCompare(b.type.typeName))
    .map((entry) => entry.type);
}

/**
 * The node vocabulary, for meaning only.
 *
 * Names, category, and what the node is *for*. No ports, no runtime port
 * behaviour, no "when to use" wiring advice — a doc that reasoned from those
 * would be reasoning about structure, and structure is what it must not write
 * about.
 */
export function renderNodeVocabulary(types: readonly ContextNodeType[]): string {
  if (types.length === 0) return 'No node types were documented for this review.';

  const lines: string[] = [
    'What the node types used in this project mean. This is here so you can say what a component DOES —',
    'never so you can describe how it is wired. There are deliberately no port names below.',
    ''
  ];

  for (const type of types) {
    if (type.unknown) {
      lines.push(`- ${type.typeName} — not in the node catalog (a module or a custom node). Do not guess what it does.`);
      continue;
    }
    // A component instance's "type" is another component of this project. It has
    // no catalog entry and never will; saying which it is beats an empty line.
    if (type.typeName.startsWith('/') && !type.summary && !type.description) {
      lines.push(`- ${type.typeName} — an instance of this project's own ${type.typeName} component.`);
      continue;
    }
    const heading =
      type.displayName && type.displayName !== type.typeName
        ? `${type.displayName} (${type.typeName})`
        : type.typeName;
    const meaning = type.summary ?? type.description;
    lines.push(`- ${heading}${type.category ? ` — ${type.category}` : ''}${meaning ? `: ${meaning}` : ''}`);
  }

  return lines.join('\n');
}
