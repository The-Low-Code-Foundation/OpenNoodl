/**
 * The message out of a thrown value, without asking which realm it was thrown in.
 *
 * ## 🔴 Why `instanceof Error` is not the way to do this (register row C41)
 *
 * `error instanceof Error ? error.message : String(error)` is the idiom everywhere, and it is
 * **false for an error that crossed a realm boundary** — a different `vm` context, a jest sandbox,
 * an Electron preload. When it is false the fallback runs, and `String(error)` is not
 * `error.message`: it is `"SyntaxError: Unexpected token 'export'"` where the message alone is
 * `"Unexpected token 'export'"`. So the *same* failure is reported to the *same* user in two
 * different wordings, and which one they get depends on where the error was constructed.
 *
 * This was not a hypothesis. HLS-001 found it as an unexplained disagreement between two test
 * runners over three hashes in the `kits` corpus project, and filed it as C41. HLS-002 hit it
 * again from the other end: the editor's export and `nodegx export` produced byte-identical trees
 * **except** `EXPORT-REPORT.md`, whose kit-loading lines differed by exactly this prefix. A
 * defect that presents as "the two front doors disagree" is worth more than a defect that
 * presents as a wording preference, which is why AC1 is written as a byte comparison.
 *
 * ⚠️ It is also load-bearing beyond the wording. `kitSource.ts` **pattern-matches** the string it
 * gets here to decide whether a kit is an ES-module build. Those regexes happen to survive the
 * prefix; the next one written might not, and it would fail by silently classifying a kit as
 * something else rather than by throwing.
 *
 * The duck test below is realm-safe because it asks the value what it has rather than which
 * constructor made it — which is the only question that has the same answer in every realm.
 */
export function errorMessage(error: unknown): string {
  if (typeof error === 'object' && error !== null) {
    const message = (error as { message?: unknown }).message;
    if (typeof message === 'string') return message;
  }
  return String(error);
}
