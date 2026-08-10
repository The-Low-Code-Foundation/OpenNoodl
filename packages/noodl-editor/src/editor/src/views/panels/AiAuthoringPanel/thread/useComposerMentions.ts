/**
 * BLD-016 — the composer's half of `@`, kept out of the panel.
 *
 * `thread/mentions.ts` decides *what the chip row should be given the text*;
 * this is the loop that keeps asking. Everything here is React and DOM — a
 * caret, a highlighted row, an effect that resolves what the text now names —
 * which is exactly why none of it is in the pure module and why the pure module
 * is the part with specs.
 *
 * ## The one invariant
 *
 * **A mention-origin reference exists exactly while its token is in the text.**
 * There is no code path that adds one without a token or removes a token
 * without dropping the reference: {@link reconcileMentions} is run over the
 * whole text on every change, and both directions fall out of it. The menu
 * inserts text and nothing else; the chip's Remove button deletes text and
 * nothing else.
 *
 * @module AiAuthoringPanel/thread/useComposerMentions
 */

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';

import { ProjectModel } from '../../../../models/projectmodel';
import {
  resolveCandidate,
  type ReferenceCandidate
} from '../../../../models/AiAssistant/authoring/referenceSources';
import {
  insertMention,
  mentionQuery,
  mentionToken,
  parseMentions,
  reconcileMentions,
  removeMentionToken,
  type MentionRefusal
} from '../../../../models/AiAssistant/thread/mentions';
import type { AttachedReference } from '../../../../models/AiAssistant/thread/references';

import { mentionRows } from './MentionMenu';
import type { ComposerBindings } from './BuildThread';

export interface UseComposerMentionsInput {
  text: string;
  setText: React.Dispatch<React.SetStateAction<string>>;
  references: readonly AttachedReference[];
  setReferences: React.Dispatch<React.SetStateAction<AttachedReference[]>>;
  /** The project's attachable things, as `refreshCandidates` last read them. */
  candidates: readonly ReferenceCandidate[];
  /** Re-read them — called when a mention starts, because that is the moment. */
  refreshCandidates: () => void;
  /** No project, no mentions: every token would refuse against an empty list. */
  isEnabled: boolean;
}

export interface ComposerMentions {
  /** Hand to `BuildThread`'s `composer` prop. */
  bindings: ComposerBindings;
  /** Non-null while the `@` menu should be on screen. */
  menu: { query: string; candidates: readonly ReferenceCandidate[]; activeIndex: number } | null;
  setActiveIndex: (index: number) => void;
  pick: (candidate: ReferenceCandidate) => void;
  /** Tokens that name nothing, as the composer should print them. */
  refusals: MentionRefusal[];
  /** "I meant that literally" — see `ReconcileInput.dismissed`. */
  dismiss: (token: string) => void;
  /** True when a mention would make this message a lie. Gates Send. */
  blocksSend: boolean;
  /**
   * Remove a reference, taking its token with it when a mention put it there.
   * The panel's plain `removeReference` is wrong for a mention chip: it would
   * leave the token behind, and reconciliation would put the chip straight
   * back.
   */
  removeReference: (id: string) => void;
}

export function useComposerMentions({
  text,
  setText,
  references,
  setReferences,
  candidates,
  refreshCandidates,
  isEnabled
}: UseComposerMentionsInput): ComposerMentions {
  const inputRef = useRef<HTMLTextAreaElement | null>(null);
  const [caret, setCaret] = useState(0);
  const [activeIndex, setActiveIndex] = useState(0);
  /**
   * The `@` offset the user pressed Escape on.
   *
   * Positional rather than a boolean, so dismissing this menu does not suppress
   * the next one: a closed menu must reopen the moment a *different* mention is
   * started, and a boolean would need something to reset it that knows when
   * that happened.
   */
  const [suppressedAt, setSuppressedAt] = useState<number | null>(null);
  const [dismissed, setDismissed] = useState<ReadonlySet<string>>(() => new Set());
  /** Where to put the caret after a token was inserted; consumed by the effect below. */
  const pendingCaret = useRef<number | null>(null);
  /** Tokens with a resolver in flight, so one attach cannot be started twice. */
  const resolving = useRef<Set<string>>(new Set());

  // The caret after React has written the new value. `useLayoutEffect` rather
  // than `useEffect` because the menu's open/closed state is derived from it and
  // a frame of "menu closed" between keystrokes is a visible flicker.
  useLayoutEffect(() => {
    const element = inputRef.current;
    if (!element) return;
    if (pendingCaret.current !== null) {
      element.setSelectionRange(pendingCaret.current, pendingCaret.current);
      element.focus();
      setCaret(pendingCaret.current);
      pendingCaret.current = null;
      return;
    }
    setCaret(element.selectionStart ?? 0);
  }, [text]);

  const query = isEnabled ? mentionQuery(text, caret) : undefined;
  const open = query !== undefined && suppressedAt !== query.start;
  const rows = useMemo(
    () => (open && query ? mentionRows(candidates, query.query) : []),
    [open, query?.query, candidates]
  );

  // A fresh list per mention, not per session: components are created and
  // renamed while this panel sits idle, and refusing `@NewThing` because the
  // list was read ten minutes ago is the exact failure this menu exists to
  // prevent. Keyed on the `@` offset so it fires once per mention rather than
  // once per keystroke.
  const startedAt = open && query ? query.start : null;
  useEffect(() => {
    if (startedAt !== null) refreshCandidates();
  }, [startedAt, refreshCandidates]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query?.query, startedAt]);

  const pick = useCallback(
    (candidate: ReferenceCandidate) => {
      const next = insertMention(text, caret, mentionToken(candidate.label));
      pendingCaret.current = next.caret;
      setSuppressedAt(null);
      setText(next.text);
    },
    [text, caret, setText]
  );

  const bindings: ComposerBindings = useMemo(
    () => ({
      ref: inputRef,
      onSelect: (event) => setCaret(event.currentTarget.selectionStart ?? 0),
      onKeyDown: (event) => {
        if (!open || rows.length === 0) {
          // ⚠️ Escape still closes an empty menu. Without this branch the one
          // state where the menu is least useful — open, matching nothing — is
          // the one state you cannot dismiss.
          if (open && event.key === 'Escape' && query) {
            setSuppressedAt(query.start);
            event.preventDefault();
          }
          return;
        }
        switch (event.key) {
          case 'ArrowDown':
            setActiveIndex((current) => (current + 1) % rows.length);
            event.preventDefault();
            return;
          case 'ArrowUp':
            setActiveIndex((current) => (current - 1 + rows.length) % rows.length);
            event.preventDefault();
            return;
          case 'Enter':
          case 'Tab': {
            const candidate = rows[Math.min(activeIndex, rows.length - 1)];
            if (candidate) pick(candidate);
            // ⚠️ `preventDefault` does double duty: it stops Enter inserting a
            // newline *and* it is what `TextArea` reads to know Shift+Enter's
            // send must not also fire. Picking a row cannot submit the message.
            event.preventDefault();
            return;
          }
          case 'Escape':
            if (query) setSuppressedAt(query.start);
            event.preventDefault();
            return;
          default:
            return;
        }
      }
    }),
    [open, rows, activeIndex, pick, query?.start]
  );

  /**
   * The loop. Runs on every text change and every change to the row.
   *
   * ⚠️ It both reads and writes `references`, which looks like a cycle and is
   * not: an attach makes the token satisfied, so the next pass proposes nothing
   * and it settles in one extra render. The `resolving` set is what keeps that
   * true across the *await* — without it two renders in the time a file takes to
   * read would start two resolvers for one token and attach it twice.
   */
  useEffect(() => {
    if (!isEnabled) return;
    const { attach, detach } = reconcileMentions({ text, candidates, attached: references, dismissed });

    if (detach.length > 0) {
      const drop = new Set(detach);
      setReferences((current) => current.filter((ref) => !drop.has(ref.id)));
    }

    for (const { candidate, token } of attach) {
      if (resolving.current.has(token)) continue;
      resolving.current.add(token);
      void resolveCandidate(candidate, ProjectModel.instance, token)
        .then((resolved) => {
          setReferences((current) =>
            // The token may have been deleted while the file was being read.
            // Checked against the text at *resolution* time rather than at
            // request time, because that is the only moment the answer is
            // current — an attachment that lands after its token is gone is a
            // chip nothing on screen accounts for.
            current.some((ref) => ref.mention === token) ? current : [...current, resolved]
          );
        })
        .finally(() => resolving.current.delete(token));
    }
  }, [text, candidates, references, dismissed, isEnabled, setReferences]);

  /**
   * What the composer prints, and what it refuses to send.
   *
   * Two passes of one function with one flag between them, which is the whole
   * of the "do not nag while typing" rule: `blocksSend` grades the token still
   * under the caret, the printed list does not — and the *menu* is the notice
   * for that one, since it is already open and already saying nothing matches.
   */
  const sendPass = useMemo(
    () =>
      isEnabled
        ? reconcileMentions({ text, candidates, attached: references, dismissed, includeUnsettled: true })
        : { attach: [], detach: [], refusals: [] },
    [text, candidates, references, dismissed, isEnabled]
  );

  const inFlightToken = useMemo(() => {
    if (!open || !query) return undefined;
    return parseMentions(text).find((mention) => mention.start === query.start)?.token;
  }, [open, query?.start, text]);

  const refusals = sendPass.refusals.filter((refusal) => refusal.token !== inFlightToken);

  const dismiss = useCallback((token: string) => {
    setDismissed((current) => new Set([...current, token]));
  }, []);

  const removeReference = useCallback(
    (id: string) => {
      const ref = references.find((candidate) => candidate.id === id);
      if (ref?.mention) {
        // Delete the token; reconciliation drops the chip on the next pass.
        // Deliberately *not* also removing it from `references` here — two
        // writes for one intent is how the row and the text get one step out of
        // step, which is the state this whole module exists to make unreachable.
        setText((current) => removeMentionToken(current, ref.mention as string));
        return;
      }
      setReferences((current) => current.filter((candidate) => candidate.id !== id));
    },
    [references, setReferences, setText]
  );

  return {
    bindings,
    menu: open && query ? { query: query.query, candidates, activeIndex } : null,
    setActiveIndex,
    pick,
    refusals,
    dismiss,
    blocksSend: sendPass.refusals.length > 0,
    removeReference
  };
}
