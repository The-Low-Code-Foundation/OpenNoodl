/**
 * FIX-022 — the gate on the measurement's REUSE grade.
 *
 * ## Why a spec for a script in `scripts/`
 *
 * The same reason `planDoctrineArm.test.ts` gives: this harness is in no
 * `tsconfig` include, no jest project and no jasmine suite, so its only gate is
 * a human choosing to run it. The doctrine transform got a spec because it is
 * excerpts of a prompt other people edit. The grader gets one because it is the
 * half of the instrument that decides what the numbers MEAN — and because
 * session 42's ruling retired the previous grade outright:
 *
 * > "I sometimes create components with just one node inside … because I want to
 * > reuse that function in multiple places."
 *
 * A created component is not a defect; a created component placed ONCE is. So
 * the number the task now turns on is a placement count, and this spec is what
 * stops that count drifting.
 *
 * ## The known-answer control this encodes
 *
 * Session 43 re-graded 20 saved plans BY HAND and reported 11 creating plans,
 * every one placed at exactly one site. `gradePlan` reproduces that from the
 * same files mechanically — 11 creates, 11 single-use, 0 reused — with the
 * evidence splitting **5 structural, 6 prose-only**.
 *
 * 🔴 That split is why the fixtures below are shaped the way they are. Six of
 * those eleven placements are named ONLY in the intent sentence: the model
 * filled `instantiates` on five of them and left it off the rest. A grader that
 * trusted the structured field alone would have scored 6 of 11 real placements
 * as "created and never placed" — an instrument failure that reads exactly like
 * a finding. Both evidence paths are therefore specified here, separately, and
 * the spec fails if either is dropped.
 */

import type { PlanOperation } from '../../src/editor/src/models/AiAssistant/authoring/plan';
import { gradePlan } from '../../scripts/aix002-measure/plan-grade';

function op(partial: Partial<PlanOperation> & Pick<PlanOperation, 'kind' | 'target'>): PlanOperation {
  return { id: partial.target, intent: '', ...partial } as PlanOperation;
}

/** The oracle shape for a request where reuse is impossible (`small-logic`). */
const NO_REUSE_EXPECTED = { createsMin: 0, createsMax: 0, note: 'test' };
/** The oracle shape for the reuse control (`reuse-available`). */
const REUSE_EXPECTED = { createsMin: 1, createsMax: 3, minPlacementSites: 2, note: 'test' };

describe('FIX-022 — grading a plan on the reuse axis', () => {
  describe('detecting a placement', () => {
    /**
     * The shape of ON runs 1, 3, 8 and OFF runs 3, 9 — the model filled
     * LAS-006's structured field on the placing update.
     */
    it('counts a site named in `instantiates` (structural evidence)', () => {
      const grade = gradePlan(
        [
          op({ kind: 'create', target: 'Visual Components/Article/Reading Time', intent: 'A small text component.' }),
          op({
            kind: 'update',
            target: 'Visual Components/Article/Article',
            intent: 'Place it next to the author name.',
            instantiates: ['Visual Components/Article/Reading Time']
          })
        ],
        NO_REUSE_EXPECTED
      );

      expect(grade.placements[0].sites).toBe(1);
      expect(grade.placements[0].structuralSites).toBe(1);
      expect(grade.placements[0].proseOnlySites).toBe(0);
      expect(grade.singleUseCreates).toEqual(['Visual Components/Article/Reading Time']);
    });

    /**
     * 🔴 The shape of the other six, and the reason a structural-only grader
     * would have manufactured a finding. The placement is real and stated; it
     * is simply stated in a sentence.
     */
    it('counts a site named only in the intent (prose evidence)', () => {
      const grade = gradePlan(
        [
          op({ kind: 'create', target: 'Visual Components/Article/Reading Time', intent: 'A small text component.' }),
          op({
            kind: 'update',
            target: 'Visual Components/Article/Article',
            intent: 'Instantiate the new Reading Time component next to the author name.'
          })
        ],
        NO_REUSE_EXPECTED
      );

      expect(grade.placements[0].sites).toBe(1);
      expect(grade.placements[0].structuralSites).toBe(0);
      expect(grade.placements[0].proseOnlySites).toBe(1);
      expect(grade.unplacedCreates).toEqual([]);
    });

    it('never double-counts one operation that both names it and lists it', () => {
      const grade = gradePlan(
        [
          op({ kind: 'create', target: 'Visual Components/Article/Reading Time', intent: 'A small text component.' }),
          op({
            kind: 'update',
            target: 'Visual Components/Article/Article',
            intent: 'Instantiate the new Reading Time component next to the author name.',
            instantiates: ['Visual Components/Article/Reading Time']
          })
        ],
        NO_REUSE_EXPECTED
      );

      expect(grade.placements[0].sites).toBe(1);
      expect(grade.placements[0].structuralSites).toBe(1);
      expect(grade.placements[0].proseOnlySites).toBe(0);
    });

    /**
     * All three spellings occur in session 41's records, sometimes inside one
     * plan: the plan creates "Visual Components/…" and the update instantiates
     * "/Visual Components/…".
     */
    it('matches across the leading-slash and bare-name spellings', () => {
      const grade = gradePlan(
        [
          op({ kind: 'create', target: 'Visual Components/Article/Reading Time', intent: 'A small text component.' }),
          op({
            kind: 'update',
            target: '/Visual Components/Article/Article',
            intent: 'no mention here',
            instantiates: ['/Visual Components/Article/Reading Time']
          }),
          op({ kind: 'update', target: '/Pages/Article', intent: 'Show Reading Time in the header too.' })
        ],
        NO_REUSE_EXPECTED
      );

      expect(grade.placements[0].sites).toBe(2);
      expect(grade.reusedCreates).toEqual(['Visual Components/Article/Reading Time']);
    });

    it('does not count the component\'s own create as a placement of itself', () => {
      const grade = gradePlan(
        [
          op({
            kind: 'create',
            target: 'Visual Components/Article/Reading Time',
            intent: 'A Reading Time component that renders the estimate.'
          })
        ],
        NO_REUSE_EXPECTED
      );

      expect(grade.placements[0].sites).toBe(0);
      expect(grade.unplacedCreates).toEqual(['Visual Components/Article/Reading Time']);
    });

    /** A new page placing a new card is a real placement — creates are not excluded as a class. */
    it('counts a placement made by another create operation', () => {
      const grade = gradePlan(
        [
          op({ kind: 'create', target: 'Visual Components/Verified Badge', intent: 'A badge.' }),
          op({
            kind: 'create',
            target: 'Pages/Settings',
            intent: 'A page.',
            instantiates: ['Visual Components/Verified Badge']
          })
        ],
        { createsMin: 0, createsMax: 5, note: 'test' }
      );

      expect(grade.placements[0].sites).toBe(1);
    });
  });

  /**
   * 🔴 Zero detected sites is an instrument result, not a finding. Merging it
   * into the single-use count would let "the grader could not see the
   * placement" arrive as "the planner orphaned a component" — a defect number
   * inflated by its own blind spot.
   */
  describe('an undetected placement is kept apart from a single-use one', () => {
    const grade = gradePlan(
      [
        op({ kind: 'create', target: 'Visual Components/Verified Badge', intent: 'A badge.' }),
        op({ kind: 'update', target: 'Visual Components/Article/Article', intent: 'Put the new thing by the name.' })
      ],
      NO_REUSE_EXPECTED
    );

    it('reports it as unplaced', () => {
      expect(grade.unplacedCreates).toEqual(['Visual Components/Verified Badge']);
    });

    it('does NOT report it as single-use', () => {
      expect(grade.singleUseCreates).toEqual([]);
    });
  });

  /**
   * The reuse control's oracle. `reuse-available` is the one corpus request
   * where creating a component is correct, so its grade must pass a plan that
   * factors and reuses, and fail the two ways that request can go wrong.
   */
  describe('the reuse oracle (`minPlacementSites`)', () => {
    const badge = op({ kind: 'create', target: 'Visual Components/Verified Badge', intent: 'A verified badge.' });
    const site = (target: string) =>
      op({ kind: 'update', target, intent: 'Place it after the name.', instantiates: ['Visual Components/Verified Badge'] });

    it('passes a plan that factors once and places it at three sites', () => {
      const grade = gradePlan(
        [
          badge,
          site('Visual Components/Article/Article'),
          site('Visual Components/Article/Comments/Comment Item'),
          site('Visual Components/Profile/Public Profile Card')
        ],
        REUSE_EXPECTED
      );

      expect(grade.placements[0].sites).toBe(3);
      expect(grade.reusedCreates).toEqual(['Visual Components/Verified Badge']);
      expect(grade.withinExpectation).toBe(true);
    });

    /**
     * 🔴 The failure this cell exists to catch: the same markup duplicated into
     * three components instead of factored. It has FEWER creates than the
     * correct plan, so any grade scoring creates alone would call it the better
     * plan.
     */
    it('fails a plan that duplicates the badge into three components instead', () => {
      const grade = gradePlan(
        [
          op({ kind: 'update', target: 'Visual Components/Article/Article', intent: 'Add a tick and "Verified".' }),
          op({ kind: 'update', target: 'Visual Components/Article/Comments/Comment Item', intent: 'Add a tick and "Verified".' }),
          op({ kind: 'update', target: 'Visual Components/Profile/Public Profile Card', intent: 'Add a tick and "Verified".' })
        ],
        REUSE_EXPECTED
      );

      expect(grade.creates).toBe(0);
      expect(grade.withinExpectation).toBe(false);
    });

    it('fails a plan that factors it but places it only once', () => {
      const grade = gradePlan([badge, site('Visual Components/Article/Article')], REUSE_EXPECTED);

      expect(grade.singleUseCreates).toEqual(['Visual Components/Verified Badge']);
      expect(grade.withinExpectation).toBe(false);
    });

    /**
     * The oracle asks whether the plan factored something and reused it — not
     * whether every create did. A plan that correctly shares the badge and also
     * builds a page is not wrong about reuse, and scoring it wrong would punish
     * the behaviour this cell protects.
     */
    it('is satisfied by one reused component beside a single-use one', () => {
      const grade = gradePlan(
        [
          badge,
          site('Visual Components/Article/Article'),
          site('Visual Components/Profile/Public Profile Card'),
          op({ kind: 'create', target: 'Visual Components/Verified Tooltip', intent: 'A tooltip.' }),
          op({ kind: 'update', target: 'Pages/Article', intent: 'Show the Verified Tooltip on hover.' })
        ],
        REUSE_EXPECTED
      );

      expect(grade.reusedCreates).toEqual(['Visual Components/Verified Badge']);
      expect(grade.singleUseCreates).toEqual(['Visual Components/Verified Tooltip']);
      expect(grade.withinExpectation).toBe(true);
    });

    /**
     * ⚠️ Reuse is impossible in most of the corpus by construction, so a prompt
     * that does not ask for it must not be failed for not delivering it —
     * otherwise `trivial` and `small-logic` start failing on an axis their
     * requests never offered.
     */
    it('is not applied to a prompt that does not ask for reuse', () => {
      const grade = gradePlan([], NO_REUSE_EXPECTED);
      expect(grade.withinExpectation).toBe(true);
    });
  });

  describe('the counts the earlier sessions reported still hold', () => {
    it('keeps the create/update/logic/page-registration grades intact', () => {
      const grade = gradePlan(
        [
          op({ kind: 'create', target: 'Logic Components/Calculate Reading Time', intent: 'Compute it.' }),
          op({ kind: 'update', target: '/App', intent: 'Register the page.' }),
          op({ kind: 'doc', target: 'docs/ARCHITECTURE.md', intent: 'Note it.' })
        ],
        { createsMin: 0, createsMax: 1, note: 'test' }
      );

      expect(grade.creates).toBe(1);
      expect(grade.updates).toBe(1);
      expect(grade.docs).toBe(1);
      expect(grade.logicCreates).toEqual(['Logic Components/Calculate Reading Time']);
      expect(grade.registersPages).toBe(true);
    });

    it('fails a plan outside its create range', () => {
      const grade = gradePlan(
        [op({ kind: 'create', target: 'Visual Components/Article/Reading Time', intent: 'A component.' })],
        NO_REUSE_EXPECTED
      );
      expect(grade.withinExpectation).toBe(false);
    });
  });
});
