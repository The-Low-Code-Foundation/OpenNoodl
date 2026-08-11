/**
 * LEG-003 §2 — the authored text an explanation must never speak over.
 *
 * Two fields in a project are written by a person rather than derived from the
 * graph: a component's `description` and a node's `metadata.comment`. Phase 50
 * exists because that channel is the one that catches a generator being wrong,
 * so the panel renders both of them **itself**, verbatim, above whatever the
 * model says — it does not ask a model to relay them.
 *
 * ⚠️ Nothing here shortens, cleans up, sentence-cases or summarises `text`. If a
 * user wrote a décret citation, the citation is what appears. The only thing
 * this module decides is *which* notes are on screen and *what they are
 * attached to*; the words are the author's.
 *
 * Pure, and typed structurally against both sources it is fed from: an
 * assembled `ExplainContext` (once a session exists) and a raw `GraphComponent`
 * (before one does, so the author's words cost no tokens and no provider).
 *
 * @module AiAssistant/explain/authoredNotes
 */

import type { ExplainScope } from './types';

/** How many notes a component-scope explanation leads with before it says "and N more". */
export const MAX_COMPONENT_SCOPE_NOTES = 8;

export type AuthoredNoteKind = 'component-description' | 'node-comment';

export interface AuthoredNote {
  kind: AuthoredNoteKind;
  /** Exactly what the author typed. Never rewritten, never truncated. */
  text: string;
  /** What the note is about — "Pages/Checkout", or "Condition 'Retry gate'". */
  subject: string;
  /** Set for a node comment: the node it hangs on, so the card can reach the canvas. */
  nodeId?: string;
}

export interface AuthoredNotesResult {
  notes: AuthoredNote[];
  /** Notes that exist on this component and are not in `notes` (component scope only). */
  omitted: number;
}

/** The shape both callers can satisfy: `ContextNode` and `GraphNode` both do. */
export interface NoteNodeLike {
  id: string;
  type: string;
  /** Catalog display name when the caller has one; the raw type is used when not. */
  displayName?: string;
  label?: string;
  comment?: string;
}

export interface AuthoredNotesInput {
  scope: ExplainScope;
  component: { name: string; description?: string };
  /** Ids the user asked about. Ignored for the component scope, which asks about all of them. */
  selectedIds?: readonly string[];
  nodes: readonly NoteNodeLike[];
}

/**
 * The same naming rule `DiffFormatter.nodeName` (SUB-007) states in its header:
 * a node is shown by its label when the user gave it one, otherwise by its
 * display name, otherwise by its raw type. A label identical to the type name
 * is the type name again, so it is dropped rather than doubled.
 *
 * One addition SUB-007 does not need. Callers that have no catalog in hand pass
 * no `displayName`, and `NodeGraphNode.label` never returns empty — it falls
 * back to `type.labelForNode(node)` — so pairing them naively renders
 * `net.noodl.controls.button 'Button'`. Without a display name the label is the
 * better of the two on its own, and the raw type is the last resort it always
 * was.
 */
function subjectForNode(node: NoteNodeLike): string {
  if (!node.displayName) return node.label || node.type;
  return node.label && node.label !== node.displayName ? `${node.displayName} '${node.label}'` : node.displayName;
}

function hasText(value: string | undefined): value is string {
  return typeof value === 'string' && value.trim() !== '';
}

/**
 * Which authored notes lead an explanation of this selection.
 *
 * - **component scope** — the component's own description first, because it is
 *   the answer to the question being asked, then the notes inside it. Capped:
 *   a 262-node component with forty comments is a wall, and the count of what
 *   is not shown is returned rather than silently dropped.
 * - **node / subgraph scope** — the comments on the nodes the user selected,
 *   and only those. A neighbour's note is not an answer about the selection,
 *   and the model still sees it in the context either way.
 */
export function collectAuthoredNotes(input: AuthoredNotesInput): AuthoredNotesResult {
  const notes: AuthoredNote[] = [];

  if (input.scope === 'component' && hasText(input.component.description)) {
    notes.push({
      kind: 'component-description',
      text: input.component.description,
      subject: input.component.name
    });
  }

  const wanted =
    input.scope === 'component' ? null : new Set(input.selectedIds ?? []);

  const commented = input.nodes.filter(
    (node) => hasText(node.comment) && (wanted === null || wanted.has(node.id))
  );

  const kept = input.scope === 'component' ? commented.slice(0, MAX_COMPONENT_SCOPE_NOTES) : commented;
  for (const node of kept) {
    notes.push({
      kind: 'node-comment',
      text: node.comment as string,
      subject: subjectForNode(node),
      nodeId: node.id
    });
  }

  return { notes, omitted: commented.length - kept.length };
}
