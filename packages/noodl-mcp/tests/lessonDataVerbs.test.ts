/**
 * TUT-002 AC6 — the three data verbs on the surface a model actually reads.
 *
 * 🔴 **The tool schema was never the gap.** `create_lesson` takes `steps` as
 * `z.array(z.record(z.string(), z.unknown()))`, so a collection condition has always been able to
 * pass through it. What decides whether a model can *use* a verb is `get_lesson_brief` — and the
 * brief had been sitting two verbs behind the compiler with nothing in this repo to notice.
 *
 * So the spec that matters here is not "the verbs work" (they are graded in the editor package)
 * but **"the vocabulary cannot gain a verb the brief does not document"**, which is the hole that
 * let this happen. `LESSON_CONDITION_VERBS` is the compiler's own list, exported for exactly this.
 *
 * ✅ The token budget was checked before adding anything: the `lesson` group is **deferred**, not
 * resident, so none of this is billed against `toolDisclosure`'s 8,280-token surface gate. The one
 * schema field added — `check_lesson`'s `backend_id` — is inside that group.
 */

import { CONDITION_EXAMPLES, lessonAuthoringBrief } from '../src/lessons/authoringBrief';
import { compileConditions, LESSON_CONDITION_VERBS } from '../src/editor-deps';

/** The verb key an example is written with. */
function verbOf(def: Record<string, unknown>): string | undefined {
  return LESSON_CONDITION_VERBS.find((verb) => verb in def);
}

describe('the brief documents the whole vocabulary', () => {
  it('🔴 every verb the compiler accepts has a worked example in the brief', () => {
    const documented = new Set(
      CONDITION_EXAMPLES.map((example) => verbOf(example.def as unknown as Record<string, unknown>))
    );
    const missing = LESSON_CONDITION_VERBS.filter((verb) => !documented.has(verb));

    // Named, not counted: "expected 15, got 13" would send the next person looking for which two.
    expect(missing).toEqual([]);
  });

  it('every example still compiles — a verb renamed in lessonformat fails here first', () => {
    for (const example of CONDITION_EXAMPLES) {
      expect(() => compileConditions([example.def], 'the brief')).not.toThrow();
    }
  });

  it('names the three traps attached to the data verbs', () => {
    const brief = lessonAuthoringBrief();

    // Built-in only, and refused BY NAME rather than graded false.
    expect(brief).toMatch(/refused by name/i);
    // A bundle on disk cannot answer them — so the author knows why check_lesson says so.
    expect(brief).toMatch(/not checkable/i);
    // `rowCountAtLeast: 0` holds against every collection there has ever been.
    expect(brief).toMatch(/rowCountAtLeast: 0/);
  });

  it('tells the author how to have them checked for real', () => {
    expect(lessonAuthoringBrief()).toMatch(/backend_id/);
  });
});
