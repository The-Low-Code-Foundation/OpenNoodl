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
  }
];
