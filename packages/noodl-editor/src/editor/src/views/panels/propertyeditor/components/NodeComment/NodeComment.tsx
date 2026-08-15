import React, { useEffect, useId, useRef, useState } from 'react';

import { NodeGraphNode } from '@noodl-models/nodegraphmodel';

import { Tooltip } from '@noodl-core-ui/components/popups/Tooltip';

import {
  isCommentChanged,
  NODE_COMMENT_LABEL,
  NODE_COMMENT_PLACEHOLDER,
  resolveCommentCommit
} from './nodeCommentCommit';

export interface NodeCommentProps {
  model: NodeGraphNode;
}

/**
 * LEG-005 — the comment row: where the *why* lives.
 *
 * ## Why this exists at all
 *
 * CAN-004 shipped three good affordances for a node comment — a gutter stripe
 * on the card, a hover tooltip that reads it, and a context-menu item that
 * writes it — and every one of them is conditional on the comment *already
 * existing*, or on right-clicking to find out. There was nowhere in the editor
 * that a comment's **absence** was visible, and the measurement matched: zero
 * comments in 5,509 nodes in this repo.
 *
 * That is ACC-007 again. Alt text was shipped, correct, at `index: 1000`, and
 * measured the same as not shipping it. A context-menu item is `index: 1000`
 * with extra steps.
 *
 * ## The one rule that decides whether this works
 *
 * **It renders when the node has no comment.** A row that appears only when a
 * comment exists teaches nobody that comments exist and is the context menu
 * again with more pixels. Everything below — the always-mounted field, the
 * placeholder that names the *use* rather than the gesture, the sizer that lets
 * an empty field be as tall as its placeholder needs — is in service of that.
 *
 * ## Committing
 *
 * Blur is the commit. Escape reverts and blurs; Cmd/Ctrl+Enter commits by
 * blurring, so there is exactly one write path. Enter inserts a newline,
 * because this is a comment and paragraphs are the point.
 *
 * ⚠️ Deliberately **not** `TextArea.onEnter`. Since FIX-002 that prop fires on
 * *plain Enter* (as `TextInput.onEnter` always did — before the ruling they
 * were opposite keystrokes behind one name, a difference `tsc` cannot see and
 * that cost this repo a session). Binding it here would make Enter *commit*,
 * and this is a comment: paragraphs are the point, so Enter must stay a
 * newline. No `onEnter` is bound here, on either component.
 */
export function NodeComment({ model }: NodeCommentProps) {
  /**
   * ⚠️ A stable object, not `this`. `Model.off(group)` removes every listener
   * whose `group ===` the argument, and inside a module-scope function
   * component `this` is `undefined` — so `model.off(this)` unsubscribes every
   * listener anyone registered without a group. A per-instance object cannot
   * collide with anything.
   */
  const listenerGroup = useRef({});
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  /** `useId`, not a literal — the panel can be mounted twice (docked + floating). */
  const inputId = useId();
  /** Escape sets this so the blur that follows does not re-commit the revert. */
  const isCancelling = useRef(false);
  /** Focused: an external `commentChanged` must not overwrite what is being typed. */
  const isEditing = useRef(false);

  const [text, setText] = useState<string>(() => model.getComment() ?? '');

  useEffect(() => {
    const group = listenerGroup.current;

    setText(model.getComment() ?? '');
    isEditing.current = false;
    isCancelling.current = false;

    // `setComment` notifies on every write, including the ones an undo makes.
    // That is how one Ctrl+Z puts the old text back in this field without a
    // reselect — and why the guard above matters, since our own commit
    // re-enters here.
    model.on(
      'commentChanged',
      () => {
        if (isEditing.current) return;
        setText(model.getComment() ?? '');
      },
      group
    );

    return function () {
      model.off(group);
    };
  }, [model]);

  function commitComment() {
    if (!isCommentChanged(model.getComment(), text)) return;

    const commit = resolveCommentCommit(text);

    // ⚠️ The existing undo path, not a hand-rolled `UndoActionGroup`.
    // `setComment` pushes its own entry, and an `UndoActionGroup` built here
    // would have to be `pushAndDo`-ed anyway — `push()` then `do()` runs
    // nothing in this codebase.
    model.setComment(commit.value, { undo: true, label: commit.label });
  }

  function onBlur() {
    isEditing.current = false;

    if (isCancelling.current) {
      isCancelling.current = false;
      setText(model.getComment() ?? '');
      return;
    }

    commitComment();
    // Read the field back off the model rather than trusting `text`:
    // `setComment` trims, so a value that was only whitespace must not be left
    // sitting in a field the model says is empty.
    setText(model.getComment() ?? '');
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Escape') {
      // The canvas and the global command layer both listen for Escape.
      e.stopPropagation();
      isCancelling.current = true;
      inputRef.current?.blur();
      return;
    }

    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
      e.preventDefault();
      e.stopPropagation();
      // Blur is the single commit path; this is only a keyboard route to it.
      inputRef.current?.blur();
    }
  }

  return (
    <div className="property-comment-bar" style={{ flex: '0 0 auto' }}>
      <Tooltip
        content="Why this node is the way it is — the rule or decision the graph cannot state. Shown when you hover the node on the canvas."
        fineType="⌘/Ctrl + Enter to save · Esc to cancel"
        UNSAFE_tooltipMaxWidth="320px"
        UNSAFE_triggerClassName="property-comment-label-trigger"
      >
        <label className="property-comment-label" htmlFor={inputId}>
          {NODE_COMMENT_LABEL}
        </label>
      </Tooltip>

      <div className="property-comment-field">
        {/*
         * The height of the row, in CSS only.
         *
         * A textarea's `scrollHeight` ignores its placeholder, so an empty
         * field sizes to one line and clips a placeholder that wraps to two —
         * and the placeholder is the whole teaching surface here.
         *
         * So this hidden mirror is the element actually **in flow**: it holds
         * the text, or the placeholder when there is no text, and the wrapper
         * takes its height. The real textarea is absolutely positioned over it
         * at `inset: 0` with the same box and type metrics, so it is always
         * exactly as tall as the content it would render. No measurement pass,
         * no `ResizeObserver` (which a backgrounded Electron renderer does not
         * run at all), and nothing to go stale.
         *
         * The trailing `\n` is the usual mirror correction: a textarea gives a
         * trailing newline its own line, and a bare string does not.
         */}
        <div className="property-comment-sizer" aria-hidden="true">
          {text ? text + '\n' : NODE_COMMENT_PLACEHOLDER}
        </div>

        <textarea
          id={inputId}
          className="property-comment-input"
          ref={inputRef}
          rows={1}
          spellCheck
          value={text}
          placeholder={NODE_COMMENT_PLACEHOLDER}
          onChange={(e) => setText(e.target.value)}
          onFocus={() => {
            isEditing.current = true;
            isCancelling.current = false;
          }}
          onBlur={onBlur}
          onKeyDown={onKeyDown}
        />
      </div>
    </div>
  );
}
