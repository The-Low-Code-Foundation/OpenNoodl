/**
 * LAS-008 — the tripwire that keeps the doctrine from disagreeing with itself.
 *
 * Phase 54 corrected a wrong premise ("a wrapped flex row with percentage
 * tracks is the responsive answer") everywhere it was visible — the doctrine's
 * own §7/§8, the `ui-*` recipes — and missed the one string that reaches the
 * model on EVERY authoring turn. `DESIGN_AUTHORING` still prescribed the
 * wrapped-row pattern and never said the word `Columns`, while §7 of the same
 * file called `Columns` the only node in the runtime that can reflow. Sonnet's
 * cold replay of the storefront brief shipped zero `Columns` nodes.
 *
 * So the check is the deliverable, not the rewrite: a rewrite fixes today's
 * string, a tripwire fixes every future one. These specs were written FIRST and
 * watched fail against the shipped text (phase 39's habit).
 *
 * They are deliberately paragraph-scoped rather than constant-scoped. The
 * doctrine is ALLOWED to explain the wrapped-row mechanic — §8 does, and must,
 * because it is a real trap authors hit — but it may never explain it without
 * naming the alternative in the same breath. That is the difference between
 * describing a trap and prescribing one, and it is the only distinction a
 * string check can draw between the two.
 */
import {
  DESIGN_AUTHORING,
  DESIGN_PLANNING,
  DESIGN_DOCTRINE_MD
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/design';
import {
  DECOMPOSITION_AUTHORING,
  DECOMPOSITION_PLANNING,
  DECOMPOSITION_DOCTRINE_MD
} from '../../src/editor/src/models/AiAssistant/authoring/prompts/decomposition';

/**
 * Every doctrine string that reaches a model, named. A new exported prompt
 * constant that is not added here is not covered — that is a known and accepted
 * limit of a string tripwire, and the reason the list is explicit rather than
 * globbed: a silent miss is worse than a spec that has to be edited.
 */
const PROMPT_CONSTANTS: Array<[string, string]> = [
  ['DESIGN_AUTHORING', DESIGN_AUTHORING],
  ['DESIGN_PLANNING', DESIGN_PLANNING],
  ['DESIGN_DOCTRINE_MD', DESIGN_DOCTRINE_MD],
  ['DECOMPOSITION_AUTHORING', DECOMPOSITION_AUTHORING],
  ['DECOMPOSITION_PLANNING', DECOMPOSITION_PLANNING],
  ['DECOMPOSITION_DOCTRINE_MD', DECOMPOSITION_DOCTRINE_MD]
];

/**
 * The wrapped-row prescription, as it is actually phrased when someone believes
 * it. Matching the MECHANIC ("does not shrink its children", "percentage
 * width/track") rather than the word "wrapped" alone keeps the check off the
 * many legitimate uses of "wrap" — text wrapping at a readable measure, the
 * `marginY` port doc about vertical gap between wrapped rows.
 */
const WRAPPED_ROW_MECHANIC =
  /(does not shrink its children|percentage (width|track|gap)|flexWrap|wrapped (flex )?(row|grid|group))/i;

/** Split on blank lines AND list-item boundaries: a bullet is a unit of advice. */
function paragraphs(text: string): string[] {
  return text
    .split(/\n\s*\n|\n(?=\s*[-*] )/)
    .map((p) => p.trim())
    .filter(Boolean);
}

describe('LAS-008 — DESIGN_AUTHORING does not contradict the doctrine it fronts', () => {
  it('names Columns as the multi-column answer', () => {
    // The specific regression: the per-turn preamble taught the wrapped-row
    // pattern and never mentioned the one node that can reflow.
    expect(DESIGN_AUTHORING).toMatch(/\bColumns\b/);
  });

  it('keeps the per-record connection rule, including the visible-port half', () => {
    // This half of the paragraph is correct and was earned by measurement —
    // a rewrite that drops it trades one regression for another.
    expect(DESIGN_AUTHORING).toMatch(/\bvisible\b/);
    expect(DESIGN_AUTHORING).toMatch(/connection/i);
  });

  it('stays inside the per-turn budget', () => {
    // It rides every single authoring request; length here is paid on every
    // turn of every session, so it is a budget and not a style preference.
    expect(DESIGN_AUTHORING.length).toBeLessThanOrEqual(700);
  });
});

describe('LAS-008 — no prompt constant prescribes the wrapped row on its own', () => {
  for (const [name, text] of PROMPT_CONSTANTS) {
    it(`${name}: every wrapped-row passage names Columns in the same breath`, () => {
      const offenders = paragraphs(text).filter(
        (p) => WRAPPED_ROW_MECHANIC.test(p) && !/\bColumns\b/.test(p)
      );

      // Report the text, not a count — a failing tripwire has to say what it
      // caught or the next person deletes it (LAS-002's lesson, applied here).
      expect(offenders).toEqual([]);
    });
  }
});
