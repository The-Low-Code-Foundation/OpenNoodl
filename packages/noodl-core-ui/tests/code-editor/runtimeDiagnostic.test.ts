/**
 * FUN-007 §2 — the last run's error, in the gutter.
 *
 * Two contracts, and both of them are the task's own ⚠️s:
 *
 * 1. **Line 1 means line 1.** The runtime has already subtracted the 3-line
 *    `AsyncFunction` prefix, so this side must not adjust again. The runtime
 *    lane proved its half red by injecting an off-by-one into
 *    `stackLineOffset()`; the equivalent here is the first spec below, which
 *    fails the moment anyone "corrects" the line number a second time. An error
 *    anchored one line off accuses innocent code.
 * 2. **Editing the code clears it.** A runtime diagnostic describes an execution,
 *    not the text, so it is false the instant the text changes. This is also the
 *    floor under F31 — a warning that stranded and never cleared — because it
 *    holds even if the producer never sends a clear.
 */
import { EditorState } from '@codemirror/state';

import {
  currentRuntimeDiagnostic,
  runtimeDiagnosticField,
  runtimeDiagnostics,
  setRuntimeDiagnosticEffect,
  type RuntimeDiagnostic
} from '@noodl-core-ui/components/code-editor/utils/runtimeDiagnostic';

function stateWith(doc: string, diagnostic: RuntimeDiagnostic | null): EditorState {
  const state = EditorState.create({ doc, extensions: [runtimeDiagnosticField] });
  return state.update({ effects: setRuntimeDiagnosticEffect.of(diagnostic) }).state;
}

const THREW = 'Line 1: boom';

describe('runtimeDiagnostics', () => {
  it('draws nothing when no run has reported anything', () => {
    const state = EditorState.create({ doc: 'Outputs.x = 1;', extensions: [runtimeDiagnosticField] });
    expect(runtimeDiagnostics(state)).toEqual([]);
  });

  // ⚠️ These two documents have **lines below the reported one on purpose.**
  // Written the obvious way — a one-line body for line 1, a three-line body for
  // line 3 — both specs pass with a deliberate `+ 1` injected into the line
  // maths, because the clamp to `doc.lines` puts the answer back. They were
  // decoration for as long as they existed. An off-by-one is only observable
  // when the wrong line is a line the document actually has.

  it('anchors a first-line throw to line 1 of the document the user sees', () => {
    // The prefix-offset check: `line: 1` must land on the first line, not three
    // lines down where the compiled prefix would have put it.
    const doc = 'throw new Error("first line");\nconst innocent = 1;\nconst alsoInnocent = 2;';
    const [diagnostic] = runtimeDiagnostics(stateWith(doc, { line: 1, column: 1, message: THREW }));

    expect(diagnostic.from).toBe(0);
    expect(diagnostic.to).toBe(30);
    expect(diagnostic.severity).toBe('error');
    expect(diagnostic.message).toBe(THREW);
  });

  it('anchors a second-line throw to the second line', () => {
    const doc = 'const a = 1;\nthrow new Error("here");\nconst b = 2;';
    const [diagnostic] = runtimeDiagnostics(stateWith(doc, { line: 2, column: 1, message: 'Line 2: here' }));

    const line = EditorState.create({ doc }).doc.line(2);
    expect(diagnostic.from).toBe(line.from);
    expect(diagnostic.to).toBe(line.to);
  });

  it('reads the column as 1-based, like V8', () => {
    const doc = 'abcdef';
    const [diagnostic] = runtimeDiagnostics(stateWith(doc, { line: 1, column: 3, message: THREW }));
    expect(diagnostic.from).toBe(2);
  });

  it('starts at the line when no column was reported', () => {
    const [diagnostic] = runtimeDiagnostics(stateWith('abcdef', { line: 1, message: THREW }));
    expect(diagnostic.from).toBe(0);
  });

  it('underlines to the end of the line rather than one character', () => {
    // One position from the engine, but a single-character underline under a long
    // expression reads as a typo instead of "this line threw".
    const doc = 'const total = price * quantity;';
    const [diagnostic] = runtimeDiagnostics(stateWith(doc, { line: 1, column: 7, message: THREW }));
    expect(diagnostic.to).toBe(doc.length);
  });

  describe('a position the document cannot hold', () => {
    // Reachable without anyone having a bug: an editor can be opened on a node
    // that threw before the popout existed. Keeping the sentence beats dropping
    // it, and the clamp is what stops a RangeError taking the real diagnostics
    // down with it.
    it('clamps a line past the end to the last line', () => {
      const doc = 'one\ntwo';
      const [diagnostic] = runtimeDiagnostics(stateWith(doc, { line: 99, column: 1, message: THREW }));
      expect(diagnostic.from).toBe(4);
      expect(diagnostic.message).toBe(THREW);
    });

    it('clamps a line of 0 or less to the first line', () => {
      const [diagnostic] = runtimeDiagnostics(stateWith('one\ntwo', { line: 0, message: THREW }));
      expect(diagnostic.from).toBe(0);
    });

    it('clamps a column past the end of its line', () => {
      const doc = 'one\ntwo';
      const [diagnostic] = runtimeDiagnostics(stateWith(doc, { line: 1, column: 99, message: THREW }));
      expect(diagnostic.from).toBeLessThanOrEqual(3);
      expect(diagnostic.from).toBeGreaterThanOrEqual(0);
    });

    it('survives an empty document', () => {
      const [diagnostic] = runtimeDiagnostics(stateWith('', { line: 1, column: 1, message: THREW }));
      expect(diagnostic.from).toBe(0);
      expect(diagnostic.to).toBe(0);
    });
  });
});

describe('the field', () => {
  it('holds what it was given', () => {
    const state = stateWith('x', { line: 2, message: THREW });
    expect(currentRuntimeDiagnostic(state)).toEqual({ line: 2, message: THREW });
  });

  it('clears when the document changes', () => {
    // The task's second ⚠️: a stale error must not outlive the text it accuses.
    const state = stateWith('throw 1;', { line: 1, message: THREW });
    const edited = state.update({ changes: { from: 0, to: 8, insert: 'Outputs.x = 1;' } }).state;

    expect(currentRuntimeDiagnostic(edited)).toBeNull();
    expect(runtimeDiagnostics(edited)).toEqual([]);
  });

  it('clears on any document change, however small', () => {
    const state = stateWith('throw 1;', { line: 1, message: THREW });
    const edited = state.update({ changes: { from: 8, insert: ' ' } }).state;
    expect(currentRuntimeDiagnostic(edited)).toBeNull();
  });

  it('survives a selection change, which is not a document change', () => {
    const state = stateWith('throw 1;', { line: 1, message: THREW });
    const moved = state.update({ selection: { anchor: 3 } }).state;
    expect(currentRuntimeDiagnostic(moved)).not.toBeNull();
  });

  it('lets the document change beat a diagnostic set in the same transaction', () => {
    // Such a transaction describes a run of the *old* text. Documented precedence,
    // not an accident — assert it so a reordering of the update body is caught.
    const state = EditorState.create({ doc: 'throw 1;', extensions: [runtimeDiagnosticField] });
    const next = state.update({
      changes: { from: 0, to: 8, insert: 'ok;' },
      effects: setRuntimeDiagnosticEffect.of({ line: 1, message: THREW })
    }).state;

    expect(currentRuntimeDiagnostic(next)).toBeNull();
  });

  it('clears when explicitly given null', () => {
    const state = stateWith('throw 1;', { line: 1, message: THREW });
    const cleared = state.update({ effects: setRuntimeDiagnosticEffect.of(null) }).state;
    expect(currentRuntimeDiagnostic(cleared)).toBeNull();
  });

  it('replaces rather than accumulates', () => {
    const state = stateWith('throw 1;', { line: 1, message: 'first' });
    const second = state.update({ effects: setRuntimeDiagnosticEffect.of({ line: 1, message: 'second' }) }).state;

    expect(runtimeDiagnostics(second)).toHaveLength(1);
    expect(runtimeDiagnostics(second)[0].message).toBe('second');
  });

  it('reports null on a state that never installed the field', () => {
    expect(currentRuntimeDiagnostic(EditorState.create({ doc: 'x' }))).toBeNull();
    expect(runtimeDiagnostics(EditorState.create({ doc: 'x' }))).toEqual([]);
  });
});
