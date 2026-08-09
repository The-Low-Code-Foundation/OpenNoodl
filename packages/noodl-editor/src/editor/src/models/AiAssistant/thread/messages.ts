/**
 * BLD-002 — five kinds, and the run that collapses four of them.
 *
 * ## Why this is pure, and here
 *
 * The same reason BLD-001's `turns.ts` is (see its header): the mapping is
 * exactly the part where a mistake is invisible on screen. A run that silently
 * swallows a failure reads as a perfectly ordinary collapsed strip — there is
 * nothing to notice. So the decision about *what may be hidden* is a total
 * function over the activity list, gradeable in a plain-Node runner, and the
 * component below it only renders what this returns.
 *
 * ## The rule that is a judgement, not a mechanism
 *
 * A run absorbs context reads and **passing** submissions. A **failed**
 * submission always breaks the run and renders on its own.
 *
 * That is not an implementation detail. D4 says a twenty-minute build is
 * unreadable because hundreds of "Read node documentation" lines have the same
 * weight as the sentences that matter — and the cure for noise must not also be
 * a cure for signal. A rejected submission carries `errorLines`: the reason the
 * agent is about to repair something, which is the one thing in that region of
 * the feed a person actually needs. Collapsing it behind a disclosure would fix
 * the legibility complaint by deleting the evidence, and the collapsed summary
 * would be *true* while the screen was misleading.
 *
 * ## What is deliberately NOT claimed
 *
 * The task's example strip reads *"Read 6 node types · validated once — 14s"*.
 * **There is no `— 14s` here, because there is no time in the model**:
 * `AuthoringActivity` carries no timestamp, and neither does `Turn`. A duration
 * would have to be invented at render time from when React happened to mount,
 * which is not how long the work took. Rule 5 — never claim progress you cannot
 * evidence — applies to a summary line exactly as it applies to a spinner. Adding
 * real timings means stamping activities where the sessions push them; it is
 * filed on this task's register, not faked here.
 *
 * Nor does the summary try to name *what kind* of thing was read. `tool.label`
 * is free prose written by three different producers ("Built Pages/Cart",
 * "Skipped X — the run was stopped", "Drafted docs/API.md"); parsing "6 node
 * types" back out of it would be a guess that reads as a fact.
 *
 * @module AiAssistant/thread/messages
 */

import type { TurnActivity } from './types';

/**
 * The five treatments a thread renders.
 *
 * `user` is not in `TurnActivity` — it opens a turn and rides on `Turn.request`
 * (see `types.ts`) — but it *is* one of the five kinds the panel styles, and
 * naming it here is what stops the fifth treatment from being invented twice.
 * `question` is BLD-008's; the shape is reserved now so that adding it later is
 * a new case in an exhaustive switch rather than a change to this union.
 */
export type MessageKind = 'user' | 'assistant' | 'tool' | 'submit' | 'question';

/**
 * A run needs at least this many activities to be worth a disclosure.
 *
 * Two, not one: collapsing a single line into "1 step ▸" replaces one line of
 * information with one line of no information plus a click. The win starts when
 * there is something to hide.
 */
export const MIN_RUN_LENGTH = 2;

/** One thing the thread draws: either an activity, or a run standing for several. */
export type ThreadItem =
  | { kind: 'activity'; activity: TurnActivity; index: number }
  | { kind: 'run'; activities: TurnActivity[]; summary: string; startIndex: number };

/** Whether this activity may disappear behind a disclosure. See the module header. */
export function isCollapsible(activity: TurnActivity): boolean {
  if (activity.kind === 'tool') return true;
  return activity.kind === 'submit' && activity.ok;
}

function times(n: number): string {
  if (n === 1) return 'once';
  if (n === 2) return 'twice';
  return `${n} times`;
}

/**
 * What a collapsed run says about itself.
 *
 * Counts only, and every count is of something the list actually contains — see
 * the module header on why there is no duration and no noun.
 */
export function summariseRun(activities: readonly TurnActivity[]): string {
  const validations = activities.filter((a) => a.kind === 'submit').length;
  const steps = activities.length - validations;

  const parts: string[] = [];
  if (steps > 0) parts.push(`${steps} step${steps === 1 ? '' : 's'}`);
  if (validations > 0) parts.push(`validated ${times(validations)}`);
  // A run is never empty (it takes MIN_RUN_LENGTH to exist), so `parts` cannot
  // be — but a summary that could read "" is one a caller has to guard, and the
  // whole point of this returning a string is that it does not.
  return parts.length > 0 ? parts.join(' · ') : `${activities.length} steps`;
}

/**
 * Group consecutive collapsible activities into runs.
 *
 * Order is preserved exactly: this only ever replaces a contiguous span with one
 * item standing for it, so a thread rendering the result reads in the order
 * things happened. `index` / `startIndex` carry each item's position in the
 * original list, because React keys drawn from the *collapsed* list would
 * renumber every time a run grows — which is how an expanded run collapses
 * itself on the next token.
 */
export function collapseActivities(activities: readonly TurnActivity[]): ThreadItem[] {
  const items: ThreadItem[] = [];
  let i = 0;

  while (i < activities.length) {
    if (!isCollapsible(activities[i])) {
      items.push({ kind: 'activity', activity: activities[i], index: i });
      i++;
      continue;
    }

    let end = i;
    while (end < activities.length && isCollapsible(activities[end])) end++;
    const span = activities.slice(i, end);

    if (span.length >= MIN_RUN_LENGTH) {
      items.push({ kind: 'run', activities: span, summary: summariseRun(span), startIndex: i });
    } else {
      span.forEach((activity, offset) => items.push({ kind: 'activity', activity, index: i + offset }));
    }
    i = end;
  }

  return items;
}
