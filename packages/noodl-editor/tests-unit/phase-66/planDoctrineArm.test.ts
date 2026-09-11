/**
 * FIX-022 — the gate on the measurement's control arm.
 *
 * ## Why a spec for a script in `scripts/`
 *
 * The authoring harness next door sat broken for eight days, and nothing
 * anywhere would have said so: it is in no `tsconfig` include, no jest project
 * and no jasmine suite, so its only gate was a human choosing to run it. The
 * planning harness inherits that, and its control arm is a worse candidate for
 * the same fate, because it is a set of **hard-coded excerpts of a prompt other
 * people edit**. Reword the HOW TO SCOPE bullet and the revert is stale — and the
 * person who finds out is whoever is halfway through a paid measurement.
 *
 * So `plan-doctrine-arm.ts` holds the transform with no side effects and no
 * provider, and this spec — which runs in `test:main` — checks it against the
 * REAL `planningSystemPrompt()` on every run. The failure then arrives when the
 * prompt is edited, which is when it is cheap.
 *
 * ## What is actually being asserted
 *
 * That the control arm is *the prompt before AAQ-008*, and differs from the
 * shipped prompt by AAQ-008 and nothing else. The measurement's whole claim rests
 * on that: two arms that differ by something nobody chose would produce a number
 * about an unknown variable.
 */

import {
  DOCTRINE_MARKERS,
  TIGHT_BULLET_AFTER,
  TIGHT_BULLET_BEFORE,
  assertDoctrinePresent,
  revertToPreDoctrine
} from '../../scripts/aix002-measure/plan-doctrine-arm';
import { DECOMPOSITION_PLANNING } from '../../src/editor/src/models/AiAssistant/authoring/prompts/decomposition';
import { planningSystemPrompt } from '../../src/editor/src/models/AiAssistant/authoring/prompts/planning';

describe('FIX-022 — the planning A/B arms', () => {
  const shipped = planningSystemPrompt();

  describe('the shipped prompt (treatment arm)', () => {
    it('carries the doctrine, so the treatment arm is not secretly a second control', () => {
      expect(() => assertDoctrinePresent(shipped)).not.toThrow();
    });

    /**
     * ⚠️ The trap this catches is subtle and cost a build: the block is
     * hard-wrapped, so a marker chosen by reading the *sentence* spans a
     * `\n  ` and can never be found. Asserting each marker is inside one line
     * keeps the list honest as the prompt is rewrapped.
     */
    it('every marker sits inside a single line of the prompt', () => {
      for (const marker of DOCTRINE_MARKERS) {
        expect(marker).not.toContain('\n');
        expect(shipped.split('\n').some((line) => line.includes(marker))).toBe(true);
      }
    });

    it('embeds the doctrine constant itself, not a drifted copy of its words', () => {
      expect(shipped).toContain(DECOMPOSITION_PLANNING);
    });

    it('carries the cross-referencing bullet the control has to revert', () => {
      expect(shipped).toContain(TIGHT_BULLET_AFTER);
    });
  });

  describe('the control arm', () => {
    const control = revertToPreDoctrine(shipped);

    it('removes the doctrine block entirely', () => {
      expect(control).not.toContain(DECOMPOSITION_PLANNING);
      for (const marker of DOCTRINE_MARKERS) expect(control).not.toContain(marker);
    });

    /**
     * 🔴 The half that is easy to forget. `planning.ts`'s bullet points at the
     * block *by name*, so removing only the block leaves a dangling reference —
     * a state the product never shipped, and a confound in any arm difference.
     */
    it('reverts the cross-referencing bullet to the sentence AAQ-008 replaced', () => {
      expect(control).toContain(TIGHT_BULLET_BEFORE);
      expect(control).not.toContain(TIGHT_BULLET_AFTER);
      expect(control).not.toContain('see COMPONENTS ARE THE UNIT OF GOOD WORK below');
    });

    it('leaves no blank-line run, so the arms do not differ in whitespace too', () => {
      expect(control).not.toContain('\n\n\n');
    });

    it('changes nothing else — every other line of the shipped prompt survives', () => {
      const removed = `\n\n${DECOMPOSITION_PLANNING}`;
      const expected = shipped.replace(removed, '').replace(TIGHT_BULLET_AFTER, TIGHT_BULLET_BEFORE);
      expect(control).toBe(expected);
    });

    it('is materially shorter, which is the arm difference the records report', () => {
      expect(control.length).toBeLessThan(shipped.length - 2000);
    });
  });

  /**
   * ✅ The grader-checked-in-both-directions rule, applied to the transform.
   *
   * A revert that quietly did nothing would produce two identical arms and read
   * as "the doctrine makes no difference" — the exact false negative the control
   * exists to rule out. So every failure mode must throw, and these are the
   * inputs that must make it.
   */
  describe('the transform fails loudly rather than degrading', () => {
    it('throws when the block is absent (a no-op revert)', () => {
      expect(() => revertToPreDoctrine(shipped.replace(DECOMPOSITION_PLANNING, ''))).toThrow(/no-op/);
    });

    it('throws when the bullet has been reworded (a stale revert)', () => {
      const reworded = shipped.replace(TIGHT_BULLET_AFTER, '- Keep plans tight, whatever that means.');
      expect(() => revertToPreDoctrine(reworded)).toThrow(/reworded/);
    });

    it('throws when a doctrine marker would survive the revert', () => {
      // The doctrine's words, duplicated outside the block, so removing the
      // block cannot remove them.
      const contaminated = shipped.replace(
        TIGHT_BULLET_AFTER,
        `${TIGHT_BULLET_AFTER}\n  Reminder: WHEN NOT TO FACTOR still applies.`
      );
      expect(() => revertToPreDoctrine(contaminated)).toThrow(/survived the revert/);
    });

    it('throws when the shipped prompt has lost the doctrine (treatment arm)', () => {
      expect(() => assertDoctrinePresent(shipped.replace(DECOMPOSITION_PLANNING, ''))).toThrow(/is missing/);
    });
  });
});
