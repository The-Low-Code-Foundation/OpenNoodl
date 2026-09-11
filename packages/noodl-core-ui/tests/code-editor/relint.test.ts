/**
 * FIX-016 §2 follow-up — the re-lint request, and what it must *not* match.
 *
 * ## What this can and cannot pin
 *
 * The defect is a `ViewPlugin`'s internal `set` flag, and `EditorView` needs a
 * DOM this runner does not have (see `jest.config.js`). So the headless half is
 * the predicate — `lintNeedsRefresh` — with real `Transaction`s carrying real
 * `StateEffect`s; only the `ViewUpdate` wrapper around them is a stand-in, and it
 * is a stand-in for the one field the predicate reads.
 *
 * The other half — *"`forceLinting` alone does nothing on an idle editor, and
 * with this it re-runs"* — is a claim about `@codemirror/lint`'s plugin and is
 * driven in the live editor. It is written down in the task file **before** the
 * drive, because a drive that has not committed to what it expects to see can
 * confirm anything.
 *
 * ## 🔴 The control is the unrelated-effect case
 *
 * `lintNeedsRefresh` written as `transaction.effects.length > 0` passes every
 * spec here except that one, and would re-lint on every runtime-diagnostic push,
 * every read-only toggle and every future effect anyone adds. A predicate that
 * fires on everything is indistinguishable from no predicate at all, and this
 * suite would not have noticed.
 */
import { EditorState, StateEffect, type Transaction } from '@codemirror/state';
import type { ViewUpdate } from '@codemirror/view';

import {
  lintNeedsRefresh,
  relintEffect
} from '@noodl-core-ui/components/code-editor/utils/relint';
import { setRuntimeDiagnosticEffect } from '@noodl-core-ui/components/code-editor/utils/runtimeDiagnostic';

/** An effect this editor really does dispatch, and which must not mean "re-lint". */
const UNRELATED = setRuntimeDiagnosticEffect;
/** One nobody has invented yet — tomorrow's effect must not turn this on either. */
const STRANGER = StateEffect.define<number>();

const DOC = 'Outputs.Done();';

function transactions(...specs: Parameters<EditorState['update']>): Transaction[] {
  const state = EditorState.create({ doc: DOC });
  return specs.map((spec) => state.update(spec));
}

/**
 * The predicate reads `update.transactions` and nothing else, so this supplies
 * exactly that. Cast rather than constructed: a real `ViewUpdate` is not
 * obtainable without a view, and pretending otherwise would be the more
 * misleading of the two.
 */
function update(...list: Transaction[]): ViewUpdate {
  return { transactions: list } as unknown as ViewUpdate;
}

describe('lintNeedsRefresh', () => {
  it('is true for a transaction that asks for a re-lint', () => {
    const [asking] = transactions({ effects: relintEffect.of(null) });
    expect(lintNeedsRefresh(update(asking))).toBe(true);
  });

  it('is true when the request rides alongside other effects', () => {
    const [mixed] = transactions({
      effects: [UNRELATED.of(null), relintEffect.of(null), STRANGER.of(7)]
    });
    expect(lintNeedsRefresh(update(mixed))).toBe(true);
  });

  it('is true when one transaction of several carries it', () => {
    const [quiet, asking] = transactions({ effects: UNRELATED.of(null) }, { effects: relintEffect.of(null) });
    expect(lintNeedsRefresh(update(quiet, asking))).toBe(true);
  });

  // ---- the controls ----

  it('is false for an effect that is not a re-lint request', () => {
    // 🔴 This is the spec that fails if the predicate degenerates to "has any
    // effect". `setRuntimeDiagnostic` dispatches this one and then asks for the
    // re-lint separately, so matching it here would be a second, silent trigger.
    const [unrelated] = transactions({ effects: UNRELATED.of({ line: 1, message: 'boom' }) });
    expect(lintNeedsRefresh(update(unrelated))).toBe(false);
  });

  it('is false for an effect nobody has defined yet', () => {
    const [stranger] = transactions({ effects: STRANGER.of(1) });
    expect(lintNeedsRefresh(update(stranger))).toBe(false);
  });

  it('is false for an ordinary document edit', () => {
    // Not an oversight: `@codemirror/lint` already re-runs on `docChanged`, and a
    // `needsRefresh` that also said yes would run the sources twice per keystroke.
    const [typed] = transactions({ changes: { from: 0, insert: 'const a = 1;\n' } });
    expect(typed.docChanged).toBe(true);
    expect(lintNeedsRefresh(update(typed))).toBe(false);
  });

  it('is false for a transaction carrying nothing at all', () => {
    const [empty] = transactions({});
    expect(lintNeedsRefresh(update(empty))).toBe(false);
  });

  it('is false for an update with no transactions', () => {
    expect(lintNeedsRefresh(update())).toBe(false);
  });
});
