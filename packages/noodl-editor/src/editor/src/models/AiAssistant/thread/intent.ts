/**
 * BLD-001 — the intent, decided from the plan rather than demanded from the user.
 *
 * ## Why the planning turn, and not a classifier
 *
 * The task said to check whether the planning turn can carry the
 * classification before reaching for a cheap pre-classification call, and to
 * prefer reusing it. It can, and there is a second reason to that is stronger
 * than the cost argument:
 *
 * **One composer needs a target from somewhere.** The old component scope had a
 * `Component` text field beside the description, because `AuthoringSession`
 * cannot start without a `componentPath` — the user typed "Pages/Customers" by
 * hand and a typo silently created a second component. A plan operation carries
 * `target`. Routing every request through planning is therefore not only how
 * the intent is inferred; it is what makes a single composer possible at all.
 *
 * The cost is one planning turn on a request that turns out to be a single
 * component. That turn is on the `plan` role, which LAS-009's replays found is
 * the step a mid-tier model does *well* and the one a user can most safely
 * point at a cheap model. It buys the target, the declared inputs
 * (`PlanPortDeclaration`, LAS-006 — the single most common way an AI-built page
 * renders identical placeholder chrome) and the classification, none of which
 * the old single-component path had.
 *
 * ## What is deliberately not here
 *
 * No mode selector "just in case" (Q1). The override is a single alternative
 * reading offered on the agent's own sentence, and it exists only where the
 * agent would otherwise act without showing its work — which is the
 * single-component case, and only that one. A plan is already on screen for
 * approval; offering to "switch to plan mode" beside a plan is the defect with
 * a new skin.
 *
 * @module AiAssistant/thread/intent
 */

import { DOC_ARCHITECTURE, DOC_BRIEF, DOC_CONVENTIONS } from '../../ProjectDocs/docsText';
import type { AuthoringPlan, PlanOperation } from '../authoring';
import type { BuildIntent, TurnPlanSummary } from './types';

/**
 * The documents a review actually writes, in the order it writes them.
 *
 * Taken from `ProjectDocs/docsText` rather than from `review/prompts`'s
 * `REVIEW_DOC_PATHS`, which is built from these same three constants: it is the
 * same fact without a thread → review dependency, and both sides break loudly
 * if a seed document is ever added or renamed.
 */
const REVIEW_DOC_PATHS = [DOC_BRIEF, DOC_ARCHITECTURE, DOC_CONVENTIONS] as const;

/** The agent's first sentence, and the one alternative reading worth offering. */
export interface IntentDecision {
  intent: BuildIntent;
  /** What the agent says before it acts. Always names what it is about to do. */
  sentence: string;
  /**
   * The one-click alternative, or `null` when the plan is already on screen
   * for approval and pruning — which is a better override than a button.
   */
  override: { intent: BuildIntent; label: string } | null;
}

function isComponentOperation(op: PlanOperation): boolean {
  return op.kind === 'create' || op.kind === 'update';
}

/** Plain-data summary of a plan, for a turn outcome the thread can keep. */
export function summarisePlan(plan: AuthoringPlan): TurnPlanSummary {
  return {
    operationCount: plan.operations.length,
    targets: plan.operations.map((op) => op.target),
    provisions: plan.operations.some((op) => op.kind === 'provision')
  };
}

/**
 * Which of the three paths this plan is.
 *
 * A single component operation and nothing else is a component build — the
 * fast path the old "This component" tab was, now reached by describing the
 * work rather than by classifying it first. Anything that fans out, or that
 * creates a backend, is a plan. All-documents is the docs path.
 *
 * ⚠️ The order of these tests matters: a plan whose only operation is a
 * `provision` is not a component build, and a `provision` alongside one
 * component is not either — a backend is a project-level side effect a person
 * should read before approving it, which is the whole reason AIB-007 put it on
 * the plan.
 */
export function classifyPlan(plan: AuthoringPlan): BuildIntent {
  const operations = plan.operations;
  if (operations.length === 0) return 'plan';
  if (operations.every((op) => op.kind === 'doc')) return 'docs';
  if (operations.length === 1 && isComponentOperation(operations[0])) return 'component';
  return 'plan';
}

function countLabel(count: number, singular: string, plural = `${singular}s`): string {
  return `${count} ${count === 1 ? singular : plural}`;
}

/**
 * What the agent says before it acts, and the alternative it offers.
 *
 * Every sentence names its target or its count. "I'll get started" is the
 * sentence this function exists to make impossible — it is exactly as
 * uninformative as the segmented control it replaces, and it arrives at the
 * same moment.
 */
export function decideIntent(plan: AuthoringPlan): IntentDecision {
  const intent = classifyPlan(plan);
  const operations = plan.operations;

  if (intent === 'component') {
    const op = operations[0];
    return {
      intent,
      sentence:
        op.kind === 'update'
          ? `I'll revise ${op.target} — one component.`
          : `I'll build this as one component — ${op.target}.`,
      override: { intent: 'plan', label: 'Show me the plan first' }
    };
  }

  if (intent === 'docs') {
    /*
     * ⚠️ Deliberately NOT `operations.map(op => op.target)`, and this is the one
     * branch where echoing the plan is wrong.
     *
     * `routePlan`'s docs case calls `startProjectReview(project)` and **never
     * looks at the plan again**. The documents a review writes are fixed —
     * `REVIEW_DOC_PATHS`, the three seeds — so a sentence built from the
     * planning model's targets is a claim about a plan that is discarded one
     * line later. It is free to disagree with what happens, and on the first
     * live drive it did: the model proposed `docs/ARCHITECTURE.md`,
     * `docs/COMPONENTS.md`, `docs/PAGES.md`, the panel said so, and then wrote
     * BRIEF / ARCHITECTURE / CONVENTIONS. Two of the three names were invented.
     *
     * ⚠️ And "I'll draft" was the second falsehood, from the same drive. BLD-008
     * inverted this route to read → **ask** → draft, so the next thing that
     * happens is questions, not a draft. This function's own header says it
     * exists to make "I'll get started" impossible because it is uninformative;
     * a sentence that names the wrong files and the wrong next step is worse
     * than uninformative. The phase's recurring shape once more — a sentence
     * that was right about its old subject.
     */
    return {
      intent,
      sentence: `I'll read the project and ask you about it, then draft ${REVIEW_DOC_PATHS.join(', ')}.`,
      override: null
    };
  }

  const components = operations.filter(isComponentOperation).length;
  const docs = operations.filter((op) => op.kind === 'doc').length;
  const provisions = operations.some((op) => op.kind === 'provision');

  // Built from the parts that are actually present, rather than a template with
  // zeroes in it: "this touches 4 components, 0 documents" is how a status line
  // teaches people to stop reading it.
  const parts: string[] = [];
  if (components > 0) parts.push(countLabel(components, 'component'));
  if (docs > 0) parts.push(countLabel(docs, 'document'));
  if (provisions) parts.push('a new backend');

  const what = parts.length === 0 ? `${countLabel(operations.length, 'operation')}` : parts.join(' and ');
  return {
    intent,
    sentence: `This touches ${what} — here's the plan first. Nothing is built until you approve it.`,
    override: null
  };
}
