/**
 * Line-count summary of a diff.
 *
 * CED-001 (A5). The history dropdown used to label each snapshot from a hand-rolled
 * LCS in `codeDiff.ts`, which lived next door to `@codemirror/merge` doing the same
 * job for {@link CodeDiffView}. This derives the same label from merge's chunks, so
 * the label and the diff a person then opens agree about where the changes are.
 *
 * @module code-editor/utils
 */

import { Chunk } from '@codemirror/merge';
import { Text } from '@codemirror/state';

export interface DiffSummary {
  /** Lines in `modified` with no counterpart in `original`. */
  added: number;
  /** Lines in `original` with no counterpart in `modified`. */
  removed: number;
  /** Human-readable label, e.g. `+3 lines, −1 line`. */
  description: string;
}

/**
 * The lines a chunk covers on one side.
 *
 * Chunk bounds are line-aligned, and `to` is one past the end of the last line —
 * which may point outside the document. An empty document is one empty line, so the
 * step back is clamped rather than allowed to reach -1.
 */
function linesIn(doc: Text, from: number, to: number): string[] {
  if (to <= from) {
    return [];
  }

  const first = doc.lineAt(from).number;
  const last = doc.lineAt(Math.max(from, Math.min(to, doc.length) - 1)).number;

  const lines: string[] = [];
  for (let number = first; number <= last; number++) {
    lines.push(doc.line(number).text);
  }
  return lines;
}

function plural(count: number, noun: string): string {
  return `${count} ${noun}${count === 1 ? '' : 's'}`;
}

/**
 * Summarise the change from `original` to `modified` as line counts.
 *
 * The chunks say *where* the documents differ; the counts come from matching the
 * lines inside each chunk against each other, so appending one line to a file reads
 * as `+1 line` rather than as the two-line region the chunk spans.
 */
export function summariseDiff(original: string, modified: string): DiffSummary {
  const a = Text.of(original.split('\n'));
  const b = Text.of(modified.split('\n'));

  let added = 0;
  let removed = 0;

  for (const chunk of Chunk.build(a, b)) {
    // Multiset, not set: two identical lines that both survive are both unchanged.
    const unmatched = new Map<string, number>();
    for (const line of linesIn(a, chunk.fromA, chunk.toA)) {
      unmatched.set(line, (unmatched.get(line) ?? 0) + 1);
    }

    for (const line of linesIn(b, chunk.fromB, chunk.toB)) {
      const remaining = unmatched.get(line) ?? 0;
      if (remaining > 0) {
        unmatched.set(line, remaining - 1);
      } else {
        added++;
      }
    }

    for (const remaining of unmatched.values()) {
      removed += remaining;
    }
  }

  if (added === 0 && removed === 0) {
    return { added, removed, description: 'No changes' };
  }

  const parts: string[] = [];
  if (added > 0) {
    parts.push(`+${plural(added, 'line')}`);
  }
  if (removed > 0) {
    parts.push(`−${plural(removed, 'line')}`);
  }

  return { added, removed, description: parts.join(', ') };
}
