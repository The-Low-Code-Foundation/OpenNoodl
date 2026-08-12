/**
 * LGC-001 §2 — the sentence that tells you which of the three to pick.
 *
 * ## Why this is not in the enriched catalog
 *
 * The preview pane already renders `node-catalog-enriched.json` through
 * `nodeDocs.ts`, and that prose is good. It is also **reference documentation
 * written per node**: it answers "what does this node do", it is the same text
 * the docs site and the AI authoring loop read, and every node has one. What a
 * person standing in the picker needs is a different document — a *comparative*
 * one, three or four lines long, that says which of three neighbours to reach
 * for. Putting "…for a one-line computation use Expression" at the top of the
 * Expression page would be nonsense, and widening the enrichment schema to carry
 * a second kind of prose for three nodes out of 175 would be a schema change to
 * a generated artifact with a `--check` gate on it.
 *
 * So it lives here: three entries, keyed by type name, read only by the picker's
 * preview column.
 *
 * ## Import-free on purpose
 *
 * No React, no Electron, no editor singleton — so `tests-unit/` can grade the
 * copy itself (see `tsconfig.tests-main.json`'s `include` list for the
 * convention). The copy is the deliverable of §2, so the copy is what is graded.
 *
 * ## ⚠️ The one thing this file must never say
 *
 * The originating brief asked the Function card to say it has *"only one input
 * signal and output signal"*. **That is false in both directions** and it was
 * verified in source before a word of this was written:
 *
 *  - every `Node.Signals.X = function(){}` in the script becomes a signal input
 *    (`javascriptnodeparser.js`, `parseSignals`), unlimited, and *additional* to
 *    the built-in `Run`;
 *  - every `Outputs.Done()` / `Outputs["Done"]()` call mints a signal output
 *    (same file, `parseOutputs`), also unlimited, and additional to the built-in
 *    `Success` / `Failure` / `Done` (`simplejavascript.ts`).
 *
 * This card is the only place in the product where that behaviour is written
 * down at all, which is exactly the shape of the NDA-017 defect — a description
 * that described a trap as if it were a feature, was wrong, and was the sole
 * source. Copy asserting a one-in/one-out limit does not ship.
 */

/** One card's worth of chooser copy. */
export interface ChooserNote {
  /** The node's type id — the key, and frozen for all three. */
  typeName: string;
  /** What it is for, in one line. Always present. */
  headline: string;
  /** The shape of it: how many ports, what it can reach. May be empty. */
  detail: string;
  /**
   * At least one worked example per note — the acceptance criterion is that
   * cursoring a row shows a sentence *and* something you could type.
   */
  examples: string[];
  /** When it runs. Always present, because "when does this happen" is the question. */
  signals: string;
}

/**
 * ⚠️ Keyed by **type id**, not by label. `Logic Builder` is the frozen id of the
 * node the picker now labels "Visual Function" (LGC-001 §3); `JavaScriptFunction`
 * is the id of the one labelled "Function". Keying by label would break the
 * moment either label is edited, which is the thing §3 just did.
 */
const CHOOSER_NOTES: readonly ChooserNote[] = [
  {
    typeName: 'Expression',
    headline: 'One line of maths or logic over a few inputs.',
    detail: 'Every name you use in the line becomes an input port.',
    examples: ['price * quantity', 'total > 100', 'Math.ceil(subtotal / 5)'],
    signals: 'No signal — it recalculates whenever an input changes.'
  },
  {
    typeName: 'Logic Builder',
    headline: 'The same jobs, built from blocks instead of typed.',
    detail: 'Drag maths, conditions and loops together; its inputs and outputs appear as you build.',
    examples: ['multiply → round up → set output'],
    // Truthful, and the reason it is here rather than in the headline: the block
    // program is strictly signal-driven — changing an input value alone never
    // runs it (`logic-builder.ts`, and the enrichment says the same).
    signals: 'Runs when you send it a signal. Start here if you would rather not type code.'
  },
  {
    typeName: 'JavaScriptFunction',
    headline: 'Real JavaScript, when a line is not enough.',
    detail: 'Many inputs and outputs, async/await, calls out to the network.',
    examples: ['Outputs.total = Inputs.items.length', 'await fetch(url)'],
    // LGC-001 §2, option (a): state the capability. See the file header for why
    // the alternative — asserting one signal in and one out — is not on the
    // table at any price.
    signals: 'Runs when you send it a signal, and can fire several when it is done.'
  }
];

const BY_TYPE_NAME: ReadonlyMap<string, ChooserNote> = new Map(
  CHOOSER_NOTES.map((note) => [note.typeName, note])
);

/**
 * The chooser copy for a node type, or `undefined` for the ~172 nodes that have
 * none.
 *
 * A miss is the normal case and the caller renders nothing extra for it: this is
 * not a summary field that every node should eventually grow, it is a note about
 * a choice between three specific neighbours.
 */
export function getChooserNote(typeName: string | undefined): ChooserNote | undefined {
  if (!typeName) return undefined;
  return BY_TYPE_NAME.get(typeName);
}

/** The triad, in the order the picker offers them. Exported for the specs. */
export function chooserNotes(): readonly ChooserNote[] {
  return CHOOSER_NOTES;
}
