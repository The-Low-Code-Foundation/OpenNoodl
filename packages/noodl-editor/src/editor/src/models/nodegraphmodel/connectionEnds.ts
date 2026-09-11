/**
 * DEF-039 (phase 80) — resolving the two ends of a connection, and saying so when it cannot.
 *
 * `NodeGraphModel.getConnectionHealth` is handed two different shapes by its two callers, and
 * each is missing what the other relies on:
 *
 *  - `exportComponent` (`utils/exporter/util.ts:115`) sends `sourceId`/`targetId` and **no nodes**;
 *  - the canvas (`NodeGraphEditorConnection.getHealth`) sends `sourceNode`/`targetNode` and
 *    **no ids** — `undefined` when `findNodeWithId` answered nothing.
 *
 * The original `c.sourceId ? c.sourceId : c.sourceNode.id` therefore dereferenced `undefined` in
 * both directions, for different inputs: a `connections.json` written with field names v2 does
 * not know (no `fromId` at all) killed the export, and a wire naming a node that is not in the
 * component reached the same line from the canvas side.
 *
 * 🔴 **This lives in its own module because `NodeGraphModel` cannot be imported outside Electron**
 * — it reads `platform.getUserDataPath()` at module scope — so a guard written inside it can only
 * ever be graded by a copy of itself. The extraction is part of the fix.
 *
 * @module noodl-editor/models/nodegraphmodel/connectionEnds
 */

/** Either caller's shape. Every field is optional because that is the actual contract. */
export interface ConnectionEndsInput {
  sourceId?: string;
  sourceNode?: { id?: string };
  targetId?: string;
  targetNode?: { id?: string };
}

export interface ResolvedConnectionEnds {
  sourceId: string | undefined;
  targetId: string | undefined;
  /** Set when either end could not be named; the sentence a person should be shown. */
  unresolved?: string;
}

/**
 * Names both ends of a connection from whichever shape the caller had.
 *
 * A wire with an end we cannot name genuinely cannot work, so `unresolved` is an `error`-level
 * fact: `exportComponent` passes `levels: ['error']` and drops the wire, and the canvas dashes it.
 * Nothing is thrown, and nothing is destroyed — the connection stays in the model and is saved.
 */
export function resolveConnectionEnds(c: ConnectionEndsInput): ResolvedConnectionEnds {
  const sourceId = c.sourceId ? c.sourceId : c.sourceNode ? c.sourceNode.id : undefined;
  const targetId = c.targetId ? c.targetId : c.targetNode ? c.targetNode.id : undefined;

  if (!sourceId || !targetId) {
    const unresolved =
      !sourceId && !targetId
        ? 'Neither end of this connection could be resolved.'
        : !sourceId
          ? 'The source of this connection could not be resolved.'
          : 'The target of this connection could not be resolved.';
    return { sourceId, targetId, unresolved };
  }

  return { sourceId, targetId };
}
