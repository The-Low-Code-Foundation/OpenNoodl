/**
 * LEG-005 — the two decisions the comment row makes, kept out of the component
 * so they can be asserted without a renderer.
 *
 * The row is the *second* way to write `metadata.comment`. The first is
 * CAN-004's context-menu popup (`NodeGraphEditorNode.showCommentEditPopup`),
 * and the acceptance for this task is explicit that the two must not diverge:
 * "two ways to clear that behave differently is worse than one way". So the
 * popup's own expression is reproduced here rather than re-derived, and the
 * unit suite reads the popup's source to prove they still agree.
 */

/**
 * The placeholder, which is the only copy most users will ever read about this
 * field.
 *
 * ⚠️ Fixed, and shared. It is the UI-length expression of LEG-001's authoring
 * vocabulary description for the same field —
 *
 *   "Why this node is the way it is — a constraint, a rule, or a decision with
 *    an alternative. Omit when the type and label already say it."
 *
 * — and the two are one field described on two surfaces. A parity spec cannot
 * catch a divergence here, because one of the two is a placeholder and lives in
 * no vocabulary table. If this sentence needs to change, change it with the
 * vocabulary entry, not on its own.
 */
export const NODE_COMMENT_PLACEHOLDER = "Why it's this way — a constraint, a rule, a decision";

/** The label on the row, in the editor's existing word for this field. */
export const NODE_COMMENT_LABEL = 'Comment';

/**
 * The undo entry labels. Verbatim from `showCommentEditPopup` — an undo stack
 * that names the same edit two ways is the same divergence in slower motion.
 */
export const NODE_COMMENT_UNDO_LABEL_SET = 'Edit node comment';
export const NODE_COMMENT_UNDO_LABEL_CLEAR = 'Remove node comment';

export interface CommentCommit {
  /** The first argument to `NodeGraphNode.setComment`. */
  value: string | undefined;
  /** `args.label` — what the undo entry is called. */
  label: string;
}

/** Trim-and-empty-to-nothing, the normalisation `setComment` itself applies. */
function normalise(comment: string | undefined | null): string {
  return (comment ?? '').trim();
}

/**
 * What to hand `setComment` for a given field value.
 *
 * Empty — or whitespace only — clears the key, which is exactly what submitting
 * the popup empty does: `setComment` stores `comment?.trim() || undefined`, and
 * `toJSON` runs the metadata bag through `JSON.stringify`, which drops an
 * `undefined`. So the key is removed from disk, `hasComment()` goes false, and
 * the gutter stripe stops painting.
 *
 * One deliberate refinement on the popup. The popup picks its undo label from
 * the *raw* field value (`newComment ? … : …`), so a field holding only spaces
 * gets the "Edit node comment" label while storing nothing at all. The stored
 * result is identical either way — `setComment` trims — so this reads the label
 * off the normalised value instead, and the whitespace-only case is named for
 * what it actually does.
 */
export function resolveCommentCommit(next: string | undefined | null): CommentCommit {
  const trimmed = normalise(next);
  return trimmed
    ? { value: trimmed, label: NODE_COMMENT_UNDO_LABEL_SET }
    : { value: undefined, label: NODE_COMMENT_UNDO_LABEL_CLEAR };
}

/**
 * Whether committing `next` over `current` is a real edit.
 *
 * The row commits on blur, and a field blurs for reasons that are not edits —
 * selecting another node, opening a popout, clicking the canvas. `setComment`
 * pushes an undo entry unconditionally, so committing on every blur would fill
 * the undo queue with entries that change nothing, and one Ctrl+Z would then
 * appear to do nothing at all. This is the same guard `NodeLabel.onSaveLabel`
 * carries for the same reason.
 */
export function isCommentChanged(current: string | undefined | null, next: string | undefined | null): boolean {
  return normalise(current) !== normalise(next);
}
