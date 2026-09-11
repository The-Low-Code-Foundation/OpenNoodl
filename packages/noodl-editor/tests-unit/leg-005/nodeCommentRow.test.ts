/**
 * LEG-005 — the comment row, in the parts that do not need a renderer.
 *
 * The acceptance for this task is a live drive: select a node, type, watch the
 * gutter stripe repaint, undo, reopen the project. None of that is reachable
 * from plain Node, and none of it is what rots.
 *
 * What rots is **agreement**. There are now two ways to write
 * `metadata.comment` — CAN-004's context-menu popup and this row — and the
 * spec is explicit that "two ways to clear that behave differently is worse
 * than one way". And the whole finding the task was written from (L12) is a
 * property of one JSX line: the row must render for a node with **no** comment.
 * A conditional row would still pass every behavioural test and would teach
 * nobody that comments exist.
 *
 * So this suite is deliberately of two kinds, in the manner of
 * `property-editor/portConnectivity.test.ts`:
 *
 *   1. **Behavioural**, over the pure commit rules.
 *   2. **Structural**, over four source files, for the properties that live in
 *      the source rather than in any value — the unconditional render, the
 *      shared undo vocabulary, the placeholder colour token, and the canvas
 *      binding that makes an undo repaint the stripe.
 *
 * @see dev-docs/tasks/phase-50-legibility/LEG-005-WHERE-THE-WHY-LIVES.md
 */

import * as fs from 'fs';
import * as path from 'path';

import {
  isCommentChanged,
  NODE_COMMENT_PLACEHOLDER,
  NODE_COMMENT_UNDO_LABEL_CLEAR,
  NODE_COMMENT_UNDO_LABEL_SET,
  resolveCommentCommit
} from '../../src/editor/src/views/panels/propertyeditor/components/NodeComment/nodeCommentCommit';

const EDITOR_SRC = path.resolve(__dirname, '..', '..', 'src', 'editor', 'src');

function read(...segments: string[]): string {
  return fs.readFileSync(path.join(EDITOR_SRC, ...segments), 'utf8');
}

const PANEL_INDEX = ['views', 'panels', 'propertyeditor', 'index.tsx'];
const ROW_COMPONENT = ['views', 'panels', 'propertyeditor', 'components', 'NodeComment', 'NodeComment.tsx'];
const PANEL_CSS = ['styles', 'propertyeditor', 'propertyeditor.css'];
const POPUP = ['views', 'nodegrapheditor', 'NodeGraphEditorNode.ts'];
const MODEL_BINDINGS = ['views', 'nodegrapheditor', 'ModelBindings.ts'];
const NODE_MODEL = ['models', 'nodegraphmodel', 'NodeGraphNode.ts'];

describe('LEG-005 — what the row hands to setComment', () => {
  it('keeps real text, trimmed, and names the undo entry for an edit', () => {
    expect(resolveCommentCommit('  Disabled for auto-entrepreneurs (décret 2019-1104).  ')).toEqual({
      value: 'Disabled for auto-entrepreneurs (décret 2019-1104).',
      label: NODE_COMMENT_UNDO_LABEL_SET
    });
  });

  it('keeps the newlines inside a multi-paragraph comment', () => {
    const multiline = 'Line one.\n\nLine two.';
    expect(resolveCommentCommit(multiline).value).toBe(multiline);
  });

  /**
   * The empty-submit parity, which is the acceptance criterion this row is most
   * able to get wrong. `undefined` — not `''` — because `toJSON` runs the
   * metadata bag through `JSON.stringify`, which drops an `undefined` key and
   * keeps an empty string. An empty string would leave `comment: ""` on disk.
   */
  it.each([['', 'empty'], ['   ', 'spaces'], ['\n\t ', 'whitespace'], [null, 'null'], [undefined, 'undefined']])(
    'clears the key for %p (%s)',
    (input) => {
      const commit = resolveCommentCommit(input as string);
      expect(commit.value).toBeUndefined();
      expect(commit.label).toBe(NODE_COMMENT_UNDO_LABEL_CLEAR);
    }
  );

  it('does not treat a blur that changed nothing as an edit', () => {
    // `setComment` pushes an undo entry unconditionally, so a commit on every
    // blur would fill the queue with entries that change nothing and one
    // Ctrl+Z would appear to do nothing at all.
    expect(isCommentChanged(undefined, '')).toBe(false);
    expect(isCommentChanged('a rule', 'a rule')).toBe(false);
    expect(isCommentChanged('a rule', '  a rule  ')).toBe(false);
    expect(isCommentChanged(undefined, '   ')).toBe(false);
  });

  it('does treat a real change as one, in both directions', () => {
    expect(isCommentChanged(undefined, 'a rule')).toBe(true);
    expect(isCommentChanged('a rule', '')).toBe(true);
    expect(isCommentChanged('a rule', 'another rule')).toBe(true);
  });
});

describe('LEG-005 — the row and the popup are one field', () => {
  it('uses the popup’s own undo labels', () => {
    const popup = read(...POPUP);
    expect(popup).toContain(`'${NODE_COMMENT_UNDO_LABEL_SET}'`);
    expect(popup).toContain(`'${NODE_COMMENT_UNDO_LABEL_CLEAR}'`);
  });

  it('clears through the same normalisation setComment already applies', () => {
    // The reason `resolveCommentCommit` can hand back `undefined` and be sure
    // the key disappears. If this expression ever stops trimming-to-undefined,
    // the row's clear stops matching the popup's.
    expect(read(...NODE_MODEL)).toContain("this.metadata.comment = comment?.trim() || undefined;");
  });
});

describe('LEG-005 — the properties that live in the source', () => {
  /**
   * L12, the finding the whole task exists for. The row is mounted on
   * `Boolean(props.model)` and on nothing else — in particular not on
   * `hasComment()` or `getComment()`, which would make the affordance visible
   * only to someone who already used it.
   */
  it('renders the row for a node with no comment', () => {
    const panel = read(...PANEL_INDEX);

    const mount = panel.match(/\{[^{}]*<NodeComment[^/]*\/>\}/);
    expect(mount).not.toBeNull();
    expect(mount[0]).toContain('Boolean(props.model)');
    expect(mount[0]).not.toMatch(/hasComment|getComment|\.comment/);
  });

  it('sits above the tab strip and below the label', () => {
    const panel = read(...PANEL_INDEX);
    const label = panel.indexOf('<NodeLabel');
    const comment = panel.indexOf('<NodeComment');
    const tabs = panel.indexOf('<Tabs');

    expect(label).toBeGreaterThan(-1);
    expect(comment).toBeGreaterThan(label);
    expect(tabs).toBeGreaterThan(comment);
  });

  /**
   * `TextArea.onEnter` and `TextInput.onEnter` both fire on **plain Enter**
   * since FIX-002 (before that they were opposite keystrokes behind one prop
   * name — a difference that cost this repo a session). The row still binds
   * neither: a comment is prose, Enter must insert a newline, blur commits,
   * and Cmd/Ctrl+Enter is a keyboard route to the blur. Binding `onEnter`
   * today would make Enter *commit* instead — exactly the regression this
   * assertion blocks.
   */
  it('binds no onEnter, so no reader has to know which key it means', () => {
    expect(read(...ROW_COMPONENT)).not.toMatch(/\bonEnter\s*[=:]/);
  });

  it('goes through setComment’s own undo, not a hand-rolled group', () => {
    const row = read(...ROW_COMPONENT);
    expect(row).toContain('model.setComment(commit.value, { undo: true, label: commit.label });');
    expect(row).not.toContain('new UndoActionGroup');
  });

  /**
   * ⚠️ Opacity cannot dim placeholder text and keep it AA. The `::placeholder`
   * rule must set a colour token, and its `opacity` must be the un-dimming
   * `1` a UA stylesheet needs, never a fraction.
   */
  it('dims the placeholder with a colour token, never with opacity', () => {
    const css = read(...PANEL_CSS);

    const rule = css.match(/\.property-comment-input::placeholder\s*\{([^}]*)\}/);
    expect(rule).not.toBeNull();
    expect(rule[1]).toMatch(/color:\s*var\(--theme-color-[a-z0-9-]+\)/);
    expect(rule[1]).toMatch(/opacity:\s*1\s*;/);
    expect(rule[1]).not.toMatch(/opacity:\s*0?\.\d/);
  });

  /**
   * The stripe has to repaint without a reselect — including after an undo,
   * which calls `setComment` from inside the undo queue where no view is
   * involved at all. Binding the model event is what covers all three writers.
   */
  it('repaints the canvas from the model event, not from one call site', () => {
    const bindings = read(...MODEL_BINDINGS);
    expect(bindings).toMatch(/model\.on\(\s*'commentChanged'/);
  });
});

describe('LEG-005 — the placeholder is the copy', () => {
  it('is the fixed sentence, exactly', () => {
    // Shared with LEG-001's authoring-vocabulary description for the same
    // field. If this has to change, it changes in both places or the editor
    // describes one field two ways.
    expect(NODE_COMMENT_PLACEHOLDER).toBe("Why it's this way — a constraint, a rule, a decision");
  });

  it('names the use rather than the gesture', () => {
    expect(NODE_COMMENT_PLACEHOLDER.toLowerCase()).not.toContain('add a comment');
    expect(NODE_COMMENT_PLACEHOLDER.toLowerCase()).not.toContain('enter a comment');
  });

  it('is the field’s only placeholder — the row does not carry a second one', () => {
    const row = read(...ROW_COMPONENT);
    const placeholders = row.match(/placeholder=/g) || [];
    expect(placeholders.length).toBe(1);
    expect(row).toContain('placeholder={NODE_COMMENT_PLACEHOLDER}');
  });
});
