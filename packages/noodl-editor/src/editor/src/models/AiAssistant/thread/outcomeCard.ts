/**
 * BLD-017 F2 — what the outcome card says, decided once.
 *
 * ## Why this module exists at all
 *
 * The approved mockup's `.card` has **two** text roles — `.card-title` at
 * 12.5px/620 in `fg-highlight`, `.card-sub` at 11.5px in `fg-default-shy` — and
 * the shipped panel had one sentence. Splitting it is unavoidable if the card is
 * to be built, and the moment it is split there is a headline and a detail that
 * have to agree with each other about the same staged component.
 *
 * ⚠️ **That sentence already had two authors before this task touched it.**
 * `OutcomeSummary` in `BuildThread.tsx` and `renderOutcome` in
 * `AiAuthoringPanel.tsx` each held their own copy of
 *
 *   `Staged: {name} — {n} nodes, {m} connections. Nothing is in your project yet.`
 *
 * character for character, including the plural rules and the two-branch tail.
 * They were identical, so nothing was visibly wrong — which is exactly the shape
 * BLD-007 paid for in this phase, and the shape `runProgress.ts`'s header warns
 * about: one fact, two sources, `tsc` green the whole time. Doubling the copies
 * from two to four to build a two-role card would have been the wrong direction.
 *
 * So the wording is here, pure, with a spec — and both renderers read it.
 *
 * ## What is deliberately NOT here
 *
 * No colours, no sizes, no decision about which of the two lines is louder. That
 * is `AiAuthoringPanel.module.scss`'s, and the mockup's. This module answers
 * *what the card says*; the stylesheet answers *how a card looks*.
 *
 * @module AiAssistant/thread/outcomeCard
 */

import type { TurnOutcome } from './types';

/**
 * A card's two lines.
 *
 * `detail` is optional because not every outcome has a second thing worth
 * saying, and a card that renders an empty `.card-sub` has a 6px gap under its
 * title with nothing after it — the kind of hole that reads as a loading state.
 */
export interface OutcomeCardText {
  title: string;
  detail?: string;
}

function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`;
}

/**
 * The headline and the detail for a staged component.
 *
 * The mockup's example is *"/Basket popup — ready to add"* over *"8 nodes, 4
 * connections. One input: itemCount. Nothing is in your project yet."*, and the
 * split follows it: **what this is and what you can do with it** on the title,
 * **the shape of it and what it has not yet cost you** on the detail.
 *
 * ⚠️ The reassurance stays on the detail rather than moving up to the title,
 * and that is not an aesthetic call. "Nothing is in your project yet" is the
 * sentence that makes Discard safe to press, so it must be on the card the
 * buttons are attached to — but it is also the least surprising thing the card
 * says, and a title is read first. Putting it first would spend the loudest line
 * in the turn on the status quo.
 *
 * The `update` branch says "untouched" rather than "nothing is in your project",
 * because for an update the second is false: the component is very much in the
 * project, it is the *edit* that is pending.
 */
export function stagedComponentCard(outcome: Extract<TurnOutcome, { kind: 'staged-component' }>): OutcomeCardText {
  return {
    title: `${outcome.legacyName} — ${outcome.mode === 'update' ? 'ready to update' : 'ready to add'}`,
    detail: `${plural(outcome.nodeCount, 'node')}, ${plural(outcome.connectionCount, 'connection')}. ${
      outcome.mode === 'update'
        ? 'Your component is untouched until you accept.'
        : 'Nothing is in your project yet.'
    }`
  };
}

/**
 * The one-line form, for the history fallback.
 *
 * A retired turn has no card — the decisions are gone, so there is nothing for a
 * footer band to hold — and it renders as prose in the thread. This composes the
 * same two strings into the sentence that used to be written by hand in two
 * places, so a change to either half reaches the transcript and the live card
 * together.
 */
export function outcomeSentence(card: OutcomeCardText): string {
  return card.detail === undefined ? card.title : `${card.title}. ${card.detail}`;
}
