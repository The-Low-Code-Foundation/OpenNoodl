/**
 * Ask a live editor to run its linter again when the *document* has not changed.
 *
 * FIX-016 §2 follow-up. Two of this editor's diagnostic sources are not pure
 * functions of the text:
 *
 * | source | also depends on |
 * |---|---|
 * | `portDiagnostics` (message 5) | the open node's **declared ports**, read from `authoringContext` |
 * | `runtimeDiagnostics` | `runtimeDiagnosticField`, pushed in by the editor after a run |
 *
 * Both can change while an editor sits open and untouched, and CodeMirror has no
 * way to know it.
 *
 * ## 🔴 Why `forceLinting` alone does nothing
 *
 * The obvious call is `forceLinting(view)`, and on an idle editor it is a
 * **no-op**. `@codemirror/lint`'s plugin only re-runs when it has been told
 * something changed:
 *
 * ```js
 * force() { if (this.set) { … this.run() } }              // dist/index.js:324
 * update(u) { if (u.docChanged || configChanged ||
 *               config.needsRefresh?.(u)) { this.set = true … } }   // :313-322
 * run()   { this.set = false; … }                          // :304
 * ```
 *
 * After the first lint of a freshly opened editor `set` is `false`, and nothing
 * but a document edit sets it again. So `forceLinting` on an editor whose text
 * has not moved returns without running a single source — which is why FIX-016
 * §2's stale message survived a forced re-lint, and why that survival was **not**
 * evidence that the lint re-ran against a stale port list. It never ran.
 *
 * `needsRefresh` is the hook that exists for exactly this: a transaction carrying
 * {@link relintEffect} tells the plugin its answer may have changed, and only
 * then can `forceLinting` make it immediate rather than waiting out the 750ms
 * default delay.
 *
 * ⚠️ The effect carries no payload and is not a state field. It is a signal, not
 * a value — whatever changed has already been written wherever it lives (the
 * authoring-context registry, `runtimeDiagnosticField`), and a second copy riding
 * on the transaction would be a second thing that can disagree.
 *
 * @module code-editor/utils
 */

import { forceLinting } from '@codemirror/lint';
import { StateEffect } from '@codemirror/state';
import type { EditorView, ViewUpdate } from '@codemirror/view';

/**
 * "Something the linter reads, other than the document, has changed."
 *
 * Dispatch it through {@link requestRelint} rather than by hand — on its own it
 * only marks the plugin dirty, and the re-lint would then wait out the config
 * delay.
 */
export const relintEffect = StateEffect.define<null>();

/**
 * The `linter()` config's `needsRefresh`. Exported for `createExtensions` and
 * for the spec.
 */
export function lintNeedsRefresh(update: ViewUpdate): boolean {
  return update.transactions.some((transaction) =>
    transaction.effects.some((effect) => effect.is(relintEffect))
  );
}

/**
 * Re-run this editor's linter now, though the text has not changed.
 *
 * Safe on a view with no linter: the dispatch is an effect nothing reads, and
 * `forceLinting` returns early when the plugin is absent.
 */
export function requestRelint(view: EditorView): void {
  view.dispatch({ effects: relintEffect.of(null) });
  forceLinting(view);
}
