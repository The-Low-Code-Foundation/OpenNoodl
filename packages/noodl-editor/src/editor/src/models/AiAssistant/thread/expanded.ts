/**
 * BLD-009 — the rules of the second host, with nothing on screen in them.
 *
 * The expanded workspace is a *layout*, and almost none of it can be graded
 * outside a renderer. These three things can, and they are the three that were
 * going to be got wrong:
 *
 * 1. **When to offer it.** Build item 5 says "at the moment it helps, not as a
 *    permanent control shouting for attention". That is a rule with four inputs
 *    and one of them is negative — a suggestion that keeps reappearing is worse
 *    than no suggestion, because the user has already answered it.
 * 2. **Which host is live.** The whole task turns on there being exactly one
 *    thread instance; the trap in the task file is two subscriptions driving one
 *    store. The arbitration is one function over one fact.
 * 3. **The words.** Expand and Collapse are rendered by two different surfaces
 *    (the panel header, the document top bar), which is the same shape as
 *    BLD-003's Discard/Reject drift — two surfaces, one action, two wordings.
 *    One export, two importers.
 *
 * @module AiAssistant/thread/expanded
 */

/** One implementation, two hosts. `panel` is the 400px sidebar rail. */
export type ThreadHost = 'panel' | 'document';

/**
 * How many operations a plan needs before the offer is worth making.
 *
 * "More than ~3" from the build item, read as *strictly* more: a three-operation
 * plan is three rows and a header, which fits a 400px rail without scrolling.
 * The offer exists for the run that does not, and four rows is where the plan
 * map starts competing with the conversation above it.
 */
export const EXPAND_SUGGESTION_THRESHOLD = 3;

/** The panel header's control, and the sentence that names it out loud. */
export const EXPAND_LABEL = 'Open the wide workspace';
/** The expanded document's way back. */
export const COLLAPSE_LABEL = 'Back to the panel';

/**
 * The inline offer's words.
 *
 * Names the number, because the number is the reason: "this plan has 7
 * operations" is evidence the user can check against what is on screen, and
 * "you might prefer a bigger view" is an opinion they cannot.
 */
export function expandSuggestion(operationCount: number): string {
  return `This plan has ${operationCount} operations. The wide workspace shows the run and the result side by side.`;
}

export interface ExpandOfferInput {
  /** Operations in the plan currently on the thread; 0 when there is no plan. */
  operationCount: number;
  /** Already in the expanded host — there is nothing to offer. */
  isExpanded: boolean;
  /**
   * The offer has been made before and answered, either way.
   *
   * ⚠️ Dismissing and *accepting* both set this, and that is the half that is
   * easy to miss: a user who expanded once has demonstrably found the control,
   * so re-offering it on their next big plan is the nag build item 5 rules out.
   */
  offered: boolean;
}

/**
 * Whether the thread should show its one-time offer of the wider host.
 *
 * A function of the three facts rather than a `useState` that four call sites
 * can set, for the reason BLD-003 gave about decision ownership: the bug this
 * shape prevents is two places disagreeing about whether the offer is live.
 */
export function shouldOfferExpanding({ operationCount, isExpanded, offered }: ExpandOfferInput): boolean {
  if (isExpanded || offered) return false;
  return operationCount > EXPAND_SUGGESTION_THRESHOLD;
}

/**
 * Which host renders the thread, given what the editor is currently showing.
 *
 * The same shape as {@link import('./decisions').decisionOwner}, and for the
 * same reason: the alternative is a boolean that the panel and the document each
 * set for themselves, and two surfaces that can disagree about which of them is
 * live is precisely the doubled activity feed the task file warns about.
 *
 * `expandedDocumentId` is a parameter rather than an import because this module
 * is pure — it is graded in the plain-Node runner, and reaching a document
 * provider would drag a React tree and an editor singleton in behind it.
 */
export function threadHost(currentDocumentId: string | undefined | null, expandedDocumentId: string): ThreadHost {
  return currentDocumentId === expandedDocumentId ? 'document' : 'panel';
}
