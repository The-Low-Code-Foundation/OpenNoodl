/**
 * FIX-022 — the planning corpus: three requests chosen so that both
 * over-decomposition and under-decomposition are visible, and so that a null
 * result is readable.
 *
 * ## Why a request needs a stated oracle
 *
 * "How many components did the planner create?" is not a grade. Four creates is
 * right for one request and absurd for another, so a count without an expected
 * answer measures nothing. Each prompt below therefore carries `expect`, and the
 * expectation is taken from the shipped prompt's OWN stated rules rather than
 * from taste — `DECOMPOSITION_PLANNING`'s §"WHEN NOT TO FACTOR" ("a single node,
 * a wrapper with no name you would say out loud, a two-node group used once")
 * and its numeric trigger ("three or more logic nodes cooperating on one job").
 * A plan that breaks those breaks a rule the model was given, which is a defect
 * anyone can check, not an opinion about architecture.
 *
 * ## Why three requests and not one
 *
 * 🔴 `small-logic` is the measurement; `multi-section` is what makes it readable.
 *
 * The question is whether the doctrine over-fires on small work. Running only
 * the small request risks the worst outcome in this repo's experience: both arms
 * plan zero creates, and the run gets written up as "no over-decomposition" when
 * what actually happened is that the block never reached the model at all. So
 * the corpus carries a request where the block SHOULD fire, loudly, and where the
 * two arms are expected to differ. If `multi-section` shows an arm difference and
 * `small-logic` does not, the null on `small-logic` is about the model's
 * judgement. If NEITHER differs, the instrument is the suspect, not the doctrine.
 *
 * `trivial` is the floor: a request naming no section at all, where any create
 * is over-decomposition under any reading.
 *
 * ## Why they are worded like this
 *
 * ⚠️ **No request names a component, a node type, or a count.** "Give it a
 * Reading Time logic component" or "split it into three sections" would answer
 * the question in the asking — the same trap `fix006-string-math` was written to
 * avoid. Every request is phrased as an outcome the user wants, and the
 * decomposition is left entirely to the planner.
 *
 * They target the `git-repo-utf8` corpus project (44 components, a Contentful
 * article app), so the planner is choosing against a real overview with real
 * neighbours — including an `/App` that holds the Page Router, which is what
 * makes the page-registration update a fair part of the expected count.
 */

export interface PlanPrompt {
  slug: string;
  request: string;
  /**
   * The oracle. `creates` is the primary metric because it is the one the
   * doctrine moves; `note` records what the number is derived from, so a reader
   * disagreeing with the grade can see exactly what they are disagreeing with.
   */
  expect: {
    /** Inclusive bound on `kind === 'create'` operations for a correct plan. */
    createsMin: number;
    createsMax: number;
    note: string;
    /**
     * The REUSE axis (session 42's ruling, session 53's cell).
     *
     * When set, a correct plan must not merely create the right NUMBER of
     * components — it must create one that is then placed at this many distinct
     * sites. Only requests where reuse is genuinely available set this; on
     * every other request in the corpus reuse is impossible by construction,
     * and demanding it would grade the request rather than the planner.
     */
    minPlacementSites?: number;
  };
}

export const PLAN_PROMPTS: PlanPrompt[] = [
  /**
   * The floor. Presentation-only, on a page that already exists, naming nothing
   * a design review would call a section.
   */
  {
    slug: 'trivial',
    request:
      'On the article page, make the article title noticeably bigger and show the date the article ' +
      'was published just underneath it, in smaller grey text.',
    expect: {
      createsMin: 0,
      createsMax: 0,
      note:
        'Presentation change to existing components. Names no section — the doctrine\'s "a wrapper ' +
        'with no name you would say out loud" case. Any create is over-decomposition under any reading.'
    }
  },

  /**
   * 🔴 The reported shape, as close as this corpus can get to it.
   *
   * The user-test report was a Script node *inside a component that should not
   * have existed*. That is one small computation, and the planner's answer to
   * "where does this computation live" is the thing under test. Reading time
   * from a body-text length is a single expression; the doctrine's own trigger
   * is three or more cooperating logic nodes, so a dedicated logic component
   * here is the block over-firing by its own stated threshold.
   */
  {
    slug: 'small-logic',
    request:
      'On the article page, show how long the article takes to read — something like "4 min read" — ' +
      'worked out from the length of the article body text. Put it next to the author name.',
    expect: {
      createsMin: 0,
      createsMax: 0,
      note:
        'One computation on one existing page. Below the doctrine\'s own numeric trigger ("three or ' +
        'more logic nodes cooperating on one job"), so a created logic component is the reported ' +
        'defect: a component that should not have existed.'
    }
  },

  /**
   * The positive control. Three sections a design review would name out loud,
   * on a page that does not exist yet, in a project whose `/App` holds the Page
   * Router — so a correct plan creates the page, creates the sections, and
   * updates `/App` to register the route.
   *
   * ⚠️ This request exists to make the other two readable. It is not graded as
   * "the doctrine works"; it is graded as "the doctrine is reaching the model".
   */
  {
    slug: 'multi-section',
    request:
      'Add a settings page for a signed-in user. It needs somewhere to edit their display name and ' +
      'bio, a set of switches for which email notifications they receive, and a clearly separated ' +
      'area at the bottom for deleting their account.',
    expect: {
      createsMin: 4,
      createsMax: 8,
      note:
        'A new page plus three sections a review would name out loud (profile, notifications, danger ' +
        'zone). Fewer than 4 creates is under-decomposition — the defect AAQ-008 was written to fix.'
    }
  },

  /**
   * 🔴 The reuse control (session 53). The cell session 43 said was missing,
   * and the one that prices any fix.
   *
   * Session 42's ruling moved the axis from size to REUSE: a one-node component
   * is right when it is placed more than once. Session 43's re-grade then found
   * the defect survives on that axis — 11 of 11 created components placed
   * exactly once — but flagged the bound that makes the finding unusable on its
   * own:
   *
   * > "One request, and it is a request with nowhere to reuse anything …
   * > `small-logic` asks for a reading time beside the author name — a single
   * > site by construction. It says nothing about whether the planner
   * > recognises GENUINE reuse, because no arm contains any. ⚠️ That is the
   * > missing control, and it is the one that prices the fix: a rule pushing
   * > 'don't factor for a single use' could damage exactly the case Richard
   * > builds on purpose, and there is currently no cell that would notice."
   *
   * This is that cell. It is the guard, not the finding: a prompt edit aimed at
   * single-use over-decomposition must leave this one factoring and reusing. If
   * it starts duplicating the same element into three components instead, the
   * edit bought a reduced create count by breaking the thing the count was a
   * proxy for.
   *
   * ⚠️ **It names three places, and that is deliberate.** The oracle has to be
   * derivable, exactly as `multi-section` names three sections out loud. What it
   * still does not name is a component, a node type, or how many to build — the
   * user says where the badge shows up; the planner decides whether that is one
   * component placed three times or three copies of the same markup, and that
   * decision is the whole measurement.
   *
   * The three sites all exist in the corpus: the article byline
   * (`/Visual Components/Article/Article`), a comment
   * (`/Visual Components/Article/Comments/Comment Item`) and the profile card
   * (`/Visual Components/Profile/Public Profile Card`).
   */
  {
    slug: 'reuse-available',
    request:
      'Show which people are verified authors. Wherever a person’s name appears — on the article ' +
      'byline, on each comment, and on the profile card — put a small badge with a tick and the word ' +
      '“Verified” after their name when that person is verified. It should look and behave exactly ' +
      'the same in all three places.',
    expect: {
      createsMin: 1,
      createsMax: 3,
      minPlacementSites: 2,
      note:
        'The one request in the corpus where creating a component is CORRECT: the same element is ' +
        'wanted at three existing sites, so factoring it is reuse, not over-decomposition. 0 creates ' +
        'means the same badge was duplicated into three components — the failure a "factor less" ' +
        'edit would cause. `minPlacementSites: 2` is the threshold that separates factored-for-reuse ' +
        'from single-use (the axis of the s42 ruling); 3 is the ideal, but 2 is what the claim needs ' +
        'and it does not depend on all three placements being separately detectable.'
    }
  }
];
