/**
 * FIX-022 — the A/B arm transform, in its own module so a gate can hold it.
 *
 * ## Why this is not just a function inside the harness
 *
 * The harness is in no `tsconfig` include, no jest project and no jasmine suite;
 * its only gate is a human choosing to run it. That is how it came to sit broken
 * for eight days before session 39 found it, and this transform is a worse
 * candidate for the same fate: it is a set of **hard-coded excerpts of a prompt
 * that other people edit**. Reword the HOW TO SCOPE bullet and the revert here is
 * wrong — not broken-loudly wrong, but wrong in a way that either throws in front
 * of whoever is mid-measurement, or (if the check were softer) silently produces
 * two arms that differ by something nobody chose.
 *
 * Living here, with no side effects and no provider, it can be imported by a jest
 * spec in `tests-unit/`, which runs in `test:main`. The prompt and its revert are
 * then checked together on every run, by machine, and the failure arrives when the
 * prompt is edited rather than months later when someone next measures.
 *
 * @module scripts/aix002-measure/plan-doctrine-arm
 */

import { DECOMPOSITION_PLANNING } from '../../src/editor/src/models/AiAssistant/authoring/prompts/decomposition';

/**
 * The HOW TO SCOPE bullet as AAQ-008 (`251a90f2`) left it — the one that points
 * at the doctrine by name.
 */
export const TIGHT_BULLET_AFTER =
  '- Keep plans as TIGHT as the request allows: no operation on a component the request never implies.\n' +
  '  "Tight" is about relevance, not count — see COMPONENTS ARE THE UNIT OF GOOD WORK below, which is\n' +
  '  the other half of this rule and outranks any instinct to keep the number of operations down.';

/** The bullet it replaced, verbatim from the commit that replaced it. */
export const TIGHT_BULLET_BEFORE =
  '- Keep plans as small as the request allows. Two or three precise operations beat six vague ones.';

/**
 * Strings that must exist in the doctrine arm and must not survive into the
 * control. Independent of the removals themselves: if the prompt ever stops
 * embedding the imported constant, `replace()` could succeed against a stale
 * copy while the live text survives, and only these would notice.
 *
 * ⚠️ **Each one must sit inside a single source line.** The block is hard-wrapped
 * at ~100 columns with a two-space continuation indent, so a marker chosen by
 * reading the sentence rather than the line silently spans a `\n  ` and is never
 * found. The first draft of this list did exactly that, and the treatment arm's
 * own check is what said so — before a single request was sent.
 */
export const DOCTRINE_MARKERS = [
  'COMPONENTS ARE THE UNIT OF GOOD WORK',
  'Factoring is the default',
  'Decomposition is NOT scope creep',
  'WHEN NOT TO FACTOR',
  'is a component the page instantiates'
];

/**
 * 🔴 The control is the prompt BEFORE AAQ-008 — not the prompt with a hole in it.
 *
 * The obvious control arm is "delete `DECOMPOSITION_PLANNING` and send the rest",
 * and it is wrong. `planning.ts`'s HOW TO SCOPE bullet does not merely sit near
 * the block; it *points at it by name* — "see COMPONENTS ARE THE UNIT OF GOOD
 * WORK below, which is the other half of this rule and outranks any instinct to
 * keep the number of operations down". Strip only the block and the control
 * becomes a prompt containing a dangling cross-reference to a section that is not
 * there — a state the product has never shipped and nobody can reason about. Any
 * arm difference would then be confounded: doctrine removed, or model confused by
 * a broken reference?
 *
 * So the control reverts BOTH halves of AAQ-008, which changed exactly two things
 * in `planning.ts`: it replaced the "small as the request allows" bullet with the
 * cross-referencing one, and it interpolated the block. Undoing both reproduces
 * the last prompt that actually shipped without the doctrine, so the comparison is
 * between two configurations that both existed.
 *
 * ⚠️ `DESIGN_PLANNING` arrived later and is untouched by both arms.
 *
 * 🔴 **Every failure mode throws.** A control that silently failed to subtract
 * would produce two identical arms and read as "the doctrine makes no
 * difference" — the exact false negative this arm exists to rule out.
 */
export function revertToPreDoctrine(systemPrompt: string): string {
  let content = systemPrompt;

  // Half 1 — the block, with the blank line AAQ-008 added in front of it, so the
  // revert does not leave a run of empty lines behind.
  const blockWithLead = `\n\n${DECOMPOSITION_PLANNING}`;
  if (!content.includes(blockWithLead)) {
    throw new Error('control arm: DECOMPOSITION_PLANNING is not in the system prompt — the revert would be a no-op');
  }
  content = content.replace(blockWithLead, '');

  // Half 2 — the cross-referencing bullet, back to the sentence it replaced.
  if (!content.includes(TIGHT_BULLET_AFTER)) {
    throw new Error('control arm: the HOW TO SCOPE bullet has been reworded — the revert is stale, fix it');
  }
  content = content.replace(TIGHT_BULLET_AFTER, TIGHT_BULLET_BEFORE);

  for (const marker of DOCTRINE_MARKERS) {
    if (content.includes(marker)) {
      throw new Error(`control arm: "${marker}" survived the revert — the arms would not differ`);
    }
  }
  // A revert that left a triple newline would be a visible difference that is not
  // doctrine, so it is a failure rather than a cosmetic complaint.
  if (content.includes('\n\n\n')) {
    throw new Error('control arm: the revert left a blank-line run — the arms differ in whitespace too');
  }
  return content;
}

/**
 * The treatment arm's own check. That arm sends the request untouched — so
 * nothing in it can go wrong silently, and that is precisely the problem: a
 * prompt that had quietly stopped embedding the block would sail through as
 * "doctrine ON" and the whole grid would compare two controls.
 */
export function assertDoctrinePresent(systemPrompt: string): string {
  for (const marker of DOCTRINE_MARKERS) {
    if (!systemPrompt.includes(marker)) {
      throw new Error(`treatment arm: "${marker}" is missing from the shipped system prompt`);
    }
  }
  return systemPrompt;
}
