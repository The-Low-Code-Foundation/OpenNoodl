/**
 * Minimal document changes.
 *
 * CED-001 (A8). Replacing the whole document is one undo step that swallows every
 * edit before it, so a single Cmd-Z after a format threw away the whole session.
 * Computing the smallest edit that turns one string into the other keeps the undo
 * history — and the cursor, and the fold state — intact.
 *
 * @module code-editor/utils
 */

export interface TextChange {
  from: number;
  to: number;
  insert: string;
}

/**
 * The smallest single replacement that turns `current` into `next`.
 *
 * Returns `null` when the two are already identical, which callers use to skip the
 * dispatch entirely.
 */
export function minimalChange(current: string, next: string): TextChange | null {
  if (current === next) {
    return null;
  }

  const shortest = Math.min(current.length, next.length);

  let start = 0;
  while (start < shortest && current[start] === next[start]) {
    start++;
  }

  let endCurrent = current.length;
  let endNext = next.length;
  while (endCurrent > start && endNext > start && current[endCurrent - 1] === next[endNext - 1]) {
    endCurrent--;
    endNext--;
  }

  return {
    from: start,
    to: endCurrent,
    insert: next.slice(start, endNext)
  };
}
