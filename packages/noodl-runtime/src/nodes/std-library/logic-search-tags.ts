/**
 * LGC-001 §1 — the arithmetic vocabulary, in one place.
 *
 * A test user on camera typed the words he knew — `add`, `multiply`, `round` —
 * into the node picker and got **nothing**, because this product has no math
 * nodes and never will (phase 59 README, "what is deliberately not here"). The
 * three nodes that *do* answer those words — Expression, Visual Function and
 * Function — advertised only `javascript`, `blockly` and friends, so none of
 * them was reachable by the vocabulary a beginner actually has.
 *
 * These are therefore **intercept terms**: they exist so that an arithmetic word
 * lands on the three ways to compute rather than on an empty result list.
 *
 * ## Why one shared list rather than three per-node lists
 *
 * The picker's acceptance is that each of these terms returns *all three* nodes.
 * Three hand-maintained copies of fifteen strings is three chances for one node
 * to drift out of the answer set, and a node missing from the answer set is
 * invisible in exactly the way this task exists to fix. The list is graded
 * against all three definitions in `test/lgc-001-logic-triad.test.ts`.
 *
 * ## Why matching is looser than it looks
 *
 * The picker matches a tag by **substring** (`NodePicker.search.ts` `matchNode`:
 * `tag.toLowerCase().includes(term)`), so `calc` reaches `calculate` and `equat`
 * reaches `equation` without either being listed. Do not add prefixes of terms
 * that are already here.
 *
 * ## Ranking is not set here
 *
 * A tag match always ranks below every name match, and tag matches are ordered
 * by the library's own listing order in `nodelibraryexport.ts` — which is why
 * that file lists `Expression` before `Logic Builder` before `JavaScriptFunction`.
 * Nothing in this file can change that order.
 */
export const ARITHMETIC_SEARCH_TAGS: readonly string[] = [
  // The words for "I want to compute something".
  'math',
  'calculate',
  'formula',
  'equation',
  // The four operations, spelled as a beginner types them.
  'add',
  'subtract',
  'multiply',
  'divide',
  // Rounding, which is the video's literal task ("price × quantity, rounded up").
  'round',
  'ceil',
  'floor',
  // Aggregates and the one symbol worth carrying.
  'sum',
  'average',
  'percent',
  '%'
];
