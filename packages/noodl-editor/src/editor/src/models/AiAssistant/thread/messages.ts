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
 * ## The duration, and what it is measured between — C8
 *
 * The task's example strip reads *"Read 6 node types · validated once — 14s"*.
 * BLD-002 shipped without the `— 14s` because `AuthoringActivity` carried no
 * timestamp and a duration invented from when React happened to mount is not how
 * long the work took. BLD-004 stamps the activities, so the number is real — but
 * *which* number it is deserves stating, because two defensible readings differ
 * by one operation's worth of time.
 *
 * **An activity is stamped when it is recorded, and a tool activity is recorded
 * when its call comes back.** So `at` is an *end* time, and the span between the
 * first and last entry of a run leaves out the first entry's own work. The run
 * therefore measures from **the activity immediately before it** — which in
 * every real turn is the assistant prose pushed at the top of the loop, i.e. the
 * moment the turn started — and a run with nothing before it reports no
 * duration rather than an under-count dressed as a measurement.
 *
 * The same rule is why `undefined` propagates instead of defaulting: a producer
 * that does not stamp (see `Stamped` in `AuthoringSession.ts`) makes the summary
 * say *less*, never something untrue. Rule 5 applies to a summary line exactly
 * as it applies to a spinner.
 *
 * Nor does the summary try to name *what kind* of thing was read. `tool.label`
 * is free prose written by three different producers ("Built Pages/Cart",
 * "Skipped X — the run was stopped", "Drafted docs/API.md"); parsing "6 node
 * types" back out of it would be a guess that reads as a fact.
 *
 * @module AiAssistant/thread/messages
 */

import { formatDuration } from './runProgress';
import type { TurnActivity } from './types';

/**
 * The treatments a thread renders — five from BLD-002, plus BLD-004's.
 *
 * `user` is not in `TurnActivity` — it opens a turn and rides on `Turn.request`
 * (see `types.ts`) — but it *is* one of the kinds the panel styles, and naming
 * it here is what stops a treatment from being invented twice. `question` is
 * BLD-008's; the shape is reserved so that adding it later is a new case in an
 * exhaustive switch rather than a change to this union. `reasoning` is BLD-004's
 * and is produced today, by the providers that have a reasoning channel.
 */
export type MessageKind = 'user' | 'assistant' | 'reasoning' | 'tool' | 'submit' | 'question';

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
  | {
      kind: 'run';
      activities: TurnActivity[];
      summary: string;
      startIndex: number;
      /** How long the run took, when the stamps support saying. See the module header. */
      durationMs?: number;
    };

/**
 * Whether this activity may disappear behind a disclosure. See the module header.
 *
 * ⚠️ `reasoning` is **not** collapsible, and it is the case most likely to be
 * "fixed" by someone counting noise. It is already collapsed — the strip shows a
 * clock and opens to the text — so absorbing it into a run would hide it behind
 * a *second* disclosure whose summary calls it a "step", which it is not: a run
 * counts things the agent did, and thinking is not one of them.
 */
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
 * How long a run took, or nothing.
 *
 * `before` is the activity immediately preceding the span — the run's start
 * boundary, per the module header. Every one of the three ways this can fail to
 * be knowable returns `undefined` rather than a number:
 *
 * - the run opens the turn, so there is no preceding activity to start from;
 * - either boundary is unstamped, because its producer does not keep a clock;
 * - the arithmetic comes out negative, which means the two stamps came from
 *   different clocks and neither describes this run.
 */
export function runDuration(
  span: readonly TurnActivity[],
  before: TurnActivity | undefined
): number | undefined {
  const start = before?.at;
  const end = span.length > 0 ? span[span.length - 1].at : undefined;
  if (start === undefined || end === undefined) return undefined;
  const ms = end - start;
  return ms >= 0 ? ms : undefined;
}

/**
 * What a collapsed run says about itself.
 *
 * Counts, and — when the stamps allow it — how long. Every count is of something
 * the list actually contains, and the duration is measured rather than inferred;
 * see the module header for what it is measured between and why it is absent so
 * often.
 */
export function summariseRun(activities: readonly TurnActivity[], durationMs?: number): string {
  const validations = activities.filter((a) => a.kind === 'submit').length;
  const steps = activities.length - validations;

  const parts: string[] = [];
  if (steps > 0) parts.push(`${steps} step${steps === 1 ? '' : 's'}`);
  if (validations > 0) parts.push(`validated ${times(validations)}`);
  // A run is never empty (it takes MIN_RUN_LENGTH to exist), so `parts` cannot
  // be — but a summary that could read "" is one a caller has to guard, and the
  // whole point of this returning a string is that it does not.
  const counts = parts.length > 0 ? parts.join(' · ') : `${activities.length} steps`;

  // An em-dash rather than another `·`, because the duration is a different kind
  // of fact from the counts beside it: those are of the list, this is of the clock.
  return durationMs === undefined ? counts : `${counts} — ${formatDuration(durationMs)}`;
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
      // The boundary is read from the *original* list, not from `items` — a run
      // preceded by another run would otherwise start from the wrong entry, and
      // `items` holds the collapsed view where that neighbour is one node.
      const durationMs = runDuration(span, i > 0 ? activities[i - 1] : undefined);
      items.push({
        kind: 'run',
        activities: span,
        summary: summariseRun(span, durationMs),
        startIndex: i,
        ...(durationMs === undefined ? {} : { durationMs })
      });
    } else {
      span.forEach((activity, offset) => items.push({ kind: 'activity', activity, index: i + offset }));
    }
    i = end;
  }

  return items;
}
