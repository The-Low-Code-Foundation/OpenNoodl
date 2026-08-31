/**
 * FB-005 T5 — the decisions behind the "Share as template" dialog.
 *
 * ## Why this is a module and not five `useState`s in a `.tsx`
 *
 * `shareAsTemplate.ts` moved *what leaves the machine* out of the UI so a plain-Node runner could
 * grade it. This is the same move for the layer above it: *what a person is allowed to send, and
 * what they are told came back*. Everything here is a pure function of values.
 *
 * 🔴 **AND THE REASON IS THIS PHASE'S OWN FINDING, NOT TIDINESS.** The dialog itself cannot be
 * graded by this runner at all — it draws `Modal` and `TextInput`, both of which reach
 * `common/Icon`, and `Icon.tsx` uses webpack's `require.context`, which ts-jest rejects at
 * type-check time (`tests-unit/support/renderElements.ts` states it). So a dialog that owned its
 * own rules would put every rule in the one file no spec in this repo can load. What is left in
 * `ShareTemplateModal.tsx` is markup and `onChange`, and it is verified by driving the app.
 *
 * ## What this file is NOT
 *
 * ⚠️ **It is not the gate.** `0021`'s CHECK constraints are, and the route's 400 names them. Every
 * rule restated here is restated so that a person is told *before* an upload they waited for
 * rather than after one — the same argument `MAX_TEMPLATE_BYTES` makes in `shareAsTemplate.ts`,
 * and the same cost: a copy of a rule can drift from it. The spec beside this file asserts the
 * numbers against the migration's text so drift is loud.
 *
 * @module noodl-editor/models/template/shareTemplateForm
 */

import { TEMPLATE_CATEGORY_LABELS } from '@noodl-core-ui/preview/launcher/Launcher/components/ProjectCreationWizard/steps/templateFilter';

import { SHAREABLE_LICENCES, suggestedSlug, whyNeverShared, type ShareAsTemplateOutcome } from './shareAsTemplate';

/**
 * The five values a submission is made of.
 *
 * ⚠️ **Strings all the way down, including the two that have vocabularies.** A `''` category is
 * "not chosen yet" and it is a state a person is really in — the alternative, defaulting to
 * `starter`, files somebody's dashboard under a category they never looked at.
 */
export interface TemplateShareDraft {
  slug: string;
  title: string;
  summary: string;
  category: string;
  licence: string;
}

/**
 * The shape rules, copied from `0021_fb005_template_submissions.sql`.
 *
 * 🔴 **A COPY, AND NAMED AFTER THE CONSTRAINT IT COPIES** so that a grep for the constraint name
 * finds this file. `project_template_submission_slug_shape`, `..._title_shape`, `..._summary_shape`.
 */
export const SLUG_SHAPE = /^[a-z0-9]+(-[a-z0-9]+)*$/;
export const SLUG_LENGTH = { min: 3, max: 80 };
export const TITLE_LENGTH = { min: 2, max: 120 };
export const SUMMARY_LENGTH = { min: 10, max: 400 };

/** The ruled categories, in the order the picker's pills draw them. Not a fourth copy — the same one. */
export const SHAREABLE_CATEGORIES = Object.keys(TEMPLATE_CATEGORY_LABELS).map((value) => ({
  value,
  label: TEMPLATE_CATEGORY_LABELS[value]
}));

/**
 * A draft to open the dialog with.
 *
 * ⚠️ **The slug is a SUGGESTION and may be illegal**, which is `suggestedSlug`'s stated contract:
 * a project called `"…"` reduces to the empty string. That is why the field is editable and why
 * `draftProblems` runs over the suggestion rather than trusting it — a dialog that opened with an
 * unusable value and no message would look broken for a reason nobody could see.
 *
 * 🔴 **Category and licence open EMPTY on purpose.** Both are assertions about somebody's work,
 * and a pre-selected assertion is one they never made. The licence especially: `0021`'s header
 * argues a licence must be a required field of the act rather than a checkbox a client can skip,
 * and a defaulted radio button is that checkbox wearing a different hat.
 */
export function draftForProject(projectName: string): TemplateShareDraft {
  return {
    slug: suggestedSlug(projectName ?? ''),
    title: (projectName ?? '').trim().slice(0, TITLE_LENGTH.max),
    summary: '',
    category: '',
    licence: ''
  };
}

export type DraftField = keyof TemplateShareDraft;

/** One thing wrong, named at the field it is wrong on so the dialog can put it there. */
export interface DraftProblem {
  field: DraftField;
  message: string;
}

/**
 * What is stopping this draft being sent, in field order.
 *
 * 🔴 **AT MOST ONE PROBLEM PER FIELD.** Telling somebody their slug is both too short and the
 * wrong shape is two sentences about one mistake, and the second is usually the consequence of
 * the first.
 *
 * ⚠️ **An untouched field is still a problem here.** The dialog decides when to *show* a message
 * (after the field has been touched, or after a failed submit); this function answers whether the
 * draft may be sent, and an empty summary may not be. Those are different questions and conflating
 * them is how a form ends up with a disabled button and no explanation.
 */
export function draftProblems(draft: TemplateShareDraft): DraftProblem[] {
  const problems: DraftProblem[] = [];
  const slug = draft.slug.trim();
  const title = draft.title.trim();
  const summary = draft.summary.trim();

  if (slug.length === 0) {
    problems.push({ field: 'slug', message: 'A short name for the shelf, like “pricing-page”.' });
  } else if (slug.length < SLUG_LENGTH.min) {
    problems.push({ field: 'slug', message: `At least ${SLUG_LENGTH.min} characters.` });
  } else if (slug.length > SLUG_LENGTH.max) {
    problems.push({ field: 'slug', message: `At most ${SLUG_LENGTH.max} characters.` });
  } else if (!SLUG_SHAPE.test(slug)) {
    // ⚠️ Names what IS allowed rather than what was wrong. "Invalid slug" is a sentence about our
    // regular expression; this one can be acted on without seeing it.
    problems.push({
      field: 'slug',
      message: 'Lowercase letters, numbers and single hyphens only — like “pricing-page”.'
    });
  }

  if (title.length < TITLE_LENGTH.min) {
    problems.push({ field: 'title', message: 'A name people will read on the shelf.' });
  } else if (title.length > TITLE_LENGTH.max) {
    problems.push({ field: 'title', message: `At most ${TITLE_LENGTH.max} characters.` });
  }

  if (summary.length < SUMMARY_LENGTH.min) {
    problems.push({
      field: 'summary',
      message: `A sentence about what it is — at least ${SUMMARY_LENGTH.min} characters.`
    });
  } else if (summary.length > SUMMARY_LENGTH.max) {
    problems.push({ field: 'summary', message: `At most ${SUMMARY_LENGTH.max} characters.` });
  }

  if (!SHAREABLE_CATEGORIES.some((c) => c.value === draft.category)) {
    problems.push({ field: 'category', message: 'Pick the one that fits best.' });
  }

  if (!SHAREABLE_LICENCES.some((l) => l.value === draft.licence)) {
    problems.push({ field: 'licence', message: 'Say what other people may do with it.' });
  }

  return problems;
}

/** The problem to draw against one field, or nothing. */
export function problemFor(problems: DraftProblem[], field: DraftField): string | null {
  return problems.find((p) => p.field === field)?.message ?? null;
}

/**
 * Why the send button is off, or `null` if it is on.
 *
 * 🔴 **SIGNED OUT IS CHECKED HERE AND NOT AT THE END.** `shareAsTemplate` returns
 * `unauthenticated`, which is correct and useless as the only guard: a person would fill five
 * fields, wait for a walk of their project, and then be told to sign in. The outcome arm stays —
 * a session can lapse between opening the dialog and pressing the button — and this is the one
 * they meet first.
 */
export function whySendIsOff(input: { draft: TemplateShareDraft; isSignedIn: boolean; isSending: boolean }): string | null {
  if (!input.isSignedIn) return 'Sign in to NodeGX from the launcher to share a template.';
  if (input.isSending) return 'Sending…';
  return draftProblems(input.draft).length > 0 ? 'Fill in the fields above to share this project.' : null;
}

/**
 * What was withheld, as a person reads it.
 *
 * ⚠️ **The list is REPORTED and not summarised as a count.** "6 files were excluded" is a
 * measurement of our own list; the paths are what let somebody notice that something they wanted
 * stayed behind, which is the whole reason `collectTemplateFiles` carries them out.
 */
export function withheldLines(excluded: string[]): { path: string; why: string }[] {
  return excluded.map((path) => ({ path, why: whyNeverShared(path) }));
}

/** How loudly to draw the result. Not a colour — the modal maps it. */
export type ShareTone = 'submitted' | 'problem' | 'refused';

export interface ShareSentence {
  tone: ShareTone;
  headline: string;
  detail: string;
  /** Paths and reasons, on the success arm only. Empty is a real answer and draws nothing. */
  withheld: { path: string; why: string }[];
}

/**
 * Every arm of {@link ShareAsTemplateOutcome}, in the words the person sees.
 *
 * 🔴 **`submitted` NEVER SAYS PUBLISHED.** `submitTemplate`'s header calls the naming load-bearing
 * and this is where it either holds or does not: the one wrong conclusion available here is that
 * the template is now on the shelf. The headline says what happened and the detail says what has
 * not happened yet.
 *
 * ⚠️ **`refused` shows the platform's own words.** It chose them, it knows which constraint was
 * broken, and a sentence we invent here is a guess at a rule that lives in another repository.
 */
export function describeShareOutcome(outcome: ShareAsTemplateOutcome): ShareSentence {
  switch (outcome.outcome) {
    case 'submitted':
      return {
        tone: 'submitted',
        headline: 'Sent for review',
        detail:
          'Your project is with the NodeGX team. It is not on the shelf yet — you will see it there once it has been looked at.',
        withheld: withheldLines(outcome.excluded)
      };

    case 'empty':
      return {
        tone: 'problem',
        headline: 'Nothing to share',
        detail: 'That folder has no files in it that a template can carry.',
        withheld: []
      };

    case 'no-manifest':
      return {
        tone: 'problem',
        headline: 'That folder is not a NodeGX project',
        detail: `Looked for ${outcome.looked.join(', ')} and found none of them.`,
        withheld: []
      };

    case 'no-home':
      // 🔴 **DEF-007 — it says what to DO, and where.** Richard: *"make sure people define a home
      // page, it's a very basic requirement."* A refusal that only names the rule leaves somebody
      // at a dialog with no next step; the fix is two clicks away in a panel they already know,
      // so the sentence spends its second half there rather than on restating the first.
      return {
        tone: 'problem',
        headline: 'This project has no home page',
        detail:
          'A template opens on its home page, and this one has not picked yet — so nobody who installs it ' +
          'would see anything. Open the project, right-click a component in the Components panel and choose ' +
          '“Make home”, then share it again.',
        withheld: []
      };

    // ❌ `binaries` — *"Templates cannot carry images yet"* — HAS BEEN DELETED RATHER THAN LEFT
    // UNREACHABLE. The transport carries them now (`0023`), so the sentence was about a limit
    // that no longer exists, and a message for an outcome nothing can produce is a message
    // somebody eventually reads as current.

    case 'too-big':
      return {
        tone: 'problem',
        headline: 'This project is too big to share',
        detail: `It comes to ${mib(outcome.bytes)}, and the limit is ${mib(outcome.limit)}.`,
        withheld: []
      };

    case 'unauthenticated':
      return {
        tone: 'problem',
        headline: 'Signed out',
        detail: 'Sign in to NodeGX from the launcher and try again.',
        withheld: []
      };

    case 'absent':
      // 🔴 **NOT NARRATED AS A FAILURE, AND IT DOES NOT NAME A CAUSE — because there are now FOUR
      // and this side cannot tell them apart.** D15 answers 404 to a surface an account may not
      // see; so does a template that is not there; so does a draft. ⚠️ **And so does a route that
      // has not been deployed** — measured 2026-08-26, when a real share reached
      // `community.nodegx.io` and got a 404 because the platform running in production predates
      // FB-005 T3 entirely (`/threshold` answered 200 beside it, so the host was up).
      //
      // The earlier wording was *"Sharing is not available on this account"*, which blamed
      // somebody's account for a deployment gap. A sentence that asserts a cause the code cannot
      // know is worse than one that does not.
      return {
        tone: 'problem',
        headline: 'Sharing is not available yet',
        detail:
          'The community did not offer template sharing to this editor. That can be because the feature is not live yet, or because this account cannot reach the public shelf.',
        withheld: []
      };

    case 'refused':
      return {
        tone: 'refused',
        headline: 'The community refused this submission',
        detail: outcome.detail,
        withheld: []
      };

    default:
      return {
        tone: 'refused',
        headline: 'Could not reach the community',
        detail: outcome.detail,
        withheld: []
      };
  }
}

/** `8 MiB`, `1.4 MiB`. ⚠️ MiB because the cap is `8 * 1024 * 1024` and calling that 8 MB is wrong. */
function mib(bytes: number): string {
  const value = bytes / (1024 * 1024);
  return `${value >= 10 || Number.isInteger(value) ? value.toFixed(0) : value.toFixed(1)} MiB`;
}
