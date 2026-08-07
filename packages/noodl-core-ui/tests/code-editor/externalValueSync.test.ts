/**
 * CED-001 (A7/A9). The generation-counter guard this replaced ignored the `value`
 * prop from the first keystroke onwards, because the counter that unblocked the guard
 * was only advanced inside the block the guard prevented.
 *
 * These drive real transactions through an `EditorState` — the same objects the update
 * listener sees — without needing a DOM.
 */

import { EditorState } from '@codemirror/state';

import {
  externalValueSync,
  isExternalValueSync
} from '@noodl-core-ui/components/code-editor/utils/externalValueSync';
import { minimalChange } from '@noodl-core-ui/components/code-editor/utils/textChange';

describe('externalValueSync', () => {
  it('recognises a dispatch made to push a value in', () => {
    const state = EditorState.create({ doc: 'const a = 1;' });

    const update = state.update({
      changes: { from: 10, to: 11, insert: '2' },
      annotations: externalValueSync.of(true)
    });

    expect(isExternalValueSync([update])).toBe(true);
    expect(update.state.doc.toString()).toBe('const a = 2;');
  });

  it('does not mistake a typed edit for an echo', () => {
    const state = EditorState.create({ doc: 'const a = 1;' });
    const update = state.update({ changes: { from: 12, insert: '\n' } });

    expect(isExternalValueSync([update])).toBe(false);
  });

  it('leaves Format and restore dispatches reportable', () => {
    // Both are real edits made by the component itself, and are deliberately
    // un-annotated so the consumer still hears about them.
    const state = EditorState.create({ doc: 'return 1;' });
    const restore = state.update({ changes: minimalChange('return 1;', 'return 2;')! });

    expect(isExternalValueSync([restore])).toBe(false);
  });

  it('round-trips: pushing a value in, then typing, are told apart', () => {
    let state = EditorState.create({ doc: '' });
    const reported: string[] = [];

    const dispatch = (next: string, external: boolean) => {
      const change = minimalChange(state.doc.toString(), next);
      if (!change) return;

      const update = state.update({
        changes: change,
        annotations: external ? [externalValueSync.of(true)] : []
      });

      if (!isExternalValueSync([update])) {
        reported.push(update.state.doc.toString());
      }

      state = update.state;
    };

    // The consumer seeds a value...
    dispatch('Outputs.total = 0;', true);
    // ...the user types...
    dispatch('Outputs.total = 1;', false);
    // ...the consumer feeds that same text back as the `value` prop. Under the old
    // guard this was the point at which external syncing died for good.
    dispatch('Outputs.total = 1;', true);
    // ...and a later external change still lands.
    dispatch('Outputs.total = 42;', true);

    expect(reported).toEqual(['Outputs.total = 1;']);
    expect(state.doc.toString()).toBe('Outputs.total = 42;');
  });
});
