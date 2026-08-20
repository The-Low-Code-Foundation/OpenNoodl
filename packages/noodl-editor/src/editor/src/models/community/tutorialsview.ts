/**
 * TUT-004 — the tutorials list in the editor, and what each row's button may say.
 *
 * ## 🔴 A pure view model, for `peopleview`'s reason and one of its own
 *
 * The decisions here are the acceptance criteria: which rows offer to install (AC1), what a
 * person is told while it happens (AC3), what a refusal says (AC4) and what being offline says
 * as opposed to a tutorial having nothing attached (AC7). A decision that lives inside a React
 * component is a decision only a rendered DOM can grade — and the four of them differ by a
 * sentence, which is exactly the kind of difference a screenshot does not catch.
 *
 * ## ⚠️ ONE ROW, FOUR SENTENCES, AND THEY MUST NOT COLLAPSE
 *
 * The pair this file exists to keep apart is **"there is nothing to install"** and **"we could
 * not reach the community"**. They look identical from the panel's point of view — no lesson
 * arrives either way — and they have opposite fixes: one is permanent and the learner should
 * stop waiting, the other is transient and they should try again. `communityapi` already draws
 * the distinction on the wire (`absent` vs `unreachable`) and `lessonplatforminstall` carries it
 * (`unavailable` vs `offline`); this is the last place it could be thrown away, so the specs
 * assert the two sentences differ rather than that each is non-empty.
 *
 * ## 🔴 An installed tutorial does not offer to install again
 *
 * `install` is idempotent — it replaces the entry outright — but "Install" on a lesson somebody
 * is halfway through is an offer to destroy their work with no warning that it would. The row
 * says it is installed instead, and resetting is the Learning section's business.
 *
 * @module noodl-editor/models/community/tutorialsview
 */

import type { CommunitySectionState } from '@noodl-core-ui/components/community';

import type { Paged, Read, TutorialSummary } from './communityapi';

/** What the row offers. `none` draws no action at all — `0011`'s honest pair, one surface over. */
export type TutorialAction = 'install' | 'installing' | 'installed' | 'none';

export type TutorialRowView = {
  slug: string;
  title: string;
  /** Level · category · minutes, built from what the row actually carries. `null` draws nothing. */
  meta: string | null;
  /** The tutorial's own summary. */
  detail: string | null;
  action: TutorialAction;
  /**
   * The last thing that happened to *this* row: what the scorecard checked, why it was refused,
   * or why the community could not be reached. `null` when nothing has happened yet.
   */
  note: string | null;
};

/**
 * 🔴 **The four states are NAT-005's, not this task's**, and reusing them is the point rather
 * than a convenience. `CommunitySectionBody` draws `loading`, `empty` and `unreachable` as three
 * different *shapes* — a pulse, a rule with a retry, a bare line — precisely because a flaky
 * network must not read like a quiet room. A fifth hand-rolled state machine beside four
 * existing ones would have re-bought UNI-011's bug while passing any test that asked whether a
 * string appeared.
 *
 * ⚠️ `hidden` is separate and above them, exactly as `mirrorview`'s `surface` is: D15's refusal
 * draws *nothing*, which is not one of the four.
 */
export type TutorialsView =
  | { surface: 'hidden' }
  | { surface: 'present'; section: CommunitySectionState<TutorialRowView> };

/** What the panel knows about a row beyond what the platform said. */
export type TutorialProgressNote = {
  /** The slug an install is running against, if any. */
  busySlug?: string | null;
  /** Slugs already in the Learning folder. */
  installedSlugs?: ReadonlySet<string>;
  /** Per-slug sentences from the last attempt. */
  notes?: ReadonlyMap<string, string>;
};

/**
 * The meta line.
 *
 * ⚠️ Built from the fields that are **present**, never padded with "—" for the ones that are
 * not. A row that says `Beginner · 20 min` and one that says `Beginner · — · — ` carry the same
 * information and only the first admits it.
 */
export function tutorialMetaLine(row: TutorialSummary): string | null {
  const parts: string[] = [];
  if (row.level) parts.push(row.level.charAt(0).toUpperCase() + row.level.slice(1));
  if (row.category) parts.push(row.category.replace(/-/g, ' '));
  if (row.estimatedMinutes) parts.push(`${row.estimatedMinutes} min`);
  return parts.length ? parts.join(' · ') : null;
}

/**
 * Compose the list.
 *
 * 🔴 **`unauthenticated` is drawn as `hidden`, not as an error.** This surface reads signed out —
 * the web page serves the same tutorials to anyone — so a 401 here means something is wrong with
 * a session that should not have been needed, and telling a guest to sign in to read public
 * material would be stricter than the site this mirrors.
 */
export function composeTutorials(
  read: Read<Paged<TutorialSummary>> | null,
  progress: TutorialProgressNote = {}
): TutorialsView {
  if (read === null) return { surface: 'present', section: { state: 'loading' } };
  if (read.outcome === 'absent') return { surface: 'hidden' };
  if (read.outcome === 'unauthenticated') return { surface: 'hidden' };
  if (read.outcome === 'unreachable') {
    // ⚠️ `detail` is the platform's or the transport's own words, and `CommunitySectionBody`
    // draws it beside a retry. "Could not be reached" with no reason is a sentence nobody can
    // act on.
    return { surface: 'present', section: { state: 'unreachable', detail: read.detail } };
  }

  const rows = read.value.items;
  if (rows.length === 0) {
    return { surface: 'present', section: { state: 'empty' } };
  }

  const installed = progress.installedSlugs ?? new Set<string>();
  const notes = progress.notes ?? new Map<string, string>();

  return {
    surface: 'present',
    section: {
      state: 'items',
      items: rows.map((row) => ({
        slug: row.slug,
        title: row.title,
        meta: tutorialMetaLine(row),
        detail: row.summary,
        action: actionFor(row, installed, progress.busySlug ?? null),
        note: notes.get(row.slug) ?? null
      }))
    }
  };
}

function actionFor(row: TutorialSummary, installed: ReadonlySet<string>, busySlug: string | null): TutorialAction {
  if (busySlug === row.slug) return 'installing';
  if (installed.has(row.slug)) return 'installed';
  // 🔴 Not `projectUrl !== null` — the editor never sees that field, deliberately. A tutorial
  // with a download link and no bundle offers nothing here, and that is the honest pair.
  return row.installable ? 'install' : 'none';
}

/** The words on the row's action. Kept here so the panel has no vocabulary of its own. */
export function actionLabel(action: TutorialAction): string | null {
  switch (action) {
    case 'install':
      return 'Install';
    case 'installing':
      return 'Installing…';
    case 'installed':
      return 'Installed';
    default:
      return null;
  }
}

/**
 * What a row says after an attempt.
 *
 * 🔴 **Four outcomes, four sentences, and the two that matter are `unavailable` and `offline`.**
 * See the module note: they are the pair that would collapse into "it didn't work", and they are
 * the pair with opposite fixes.
 */
export function noteForOutcome(
  outcome:
    | { result: 'installed'; checked: string }
    | { result: 'refused'; reason: string }
    | { result: 'cancelled' }
    | { result: 'offline'; reason: string }
    | { result: 'unavailable'; reason: string }
): string | null {
  switch (outcome.result) {
    case 'installed':
      // AC3's line — it names what was NOT checked as well as what passed.
      return `Installed. ${outcome.checked}`;
    case 'refused':
      return `Not installed — ${outcome.reason}`;
    case 'offline':
      return outcome.reason;
    case 'unavailable':
      return outcome.reason;
    default:
      // ⚠️ A person who cancelled knows they cancelled. Saying so is a surface telling somebody
      // what they just did.
      return null;
  }
}
