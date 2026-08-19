/**
 * UNI-006 — the evidence list, and the cross-repo drift it was named for.
 *
 * 🔴 THE GAP THIS FILE EXISTS TO MANAGE, stated by the migration that created it:
 * *"The THIRD copy is `LessonEvidence` in the other repo, and no test in either repo can see
 * both — that is a real gap and it is named here rather than left to be discovered: a field
 * added to the editor's bundle arrives as a submission this module quietly drops."*
 *
 * ⚠️ IT WAS HARMLESS WHILE NOTHING SUBMITTED, and it stopped being harmless on 2026-08-19
 * when the bridge got a caller. The platform DROPS an unknown key rather than refusing it —
 * on purpose, so a learner on a newer editor than the server still hands their homework in —
 * so the failure is completely silent: submit succeeds, the teacher sees a grade, and the new
 * field is nowhere.
 *
 * ✅ WHAT IS ACTUALLY ENFORCEABLE FROM THIS SIDE, and it is worth being precise about the
 * limit rather than claiming the gap is closed: no spec here can read the platform's schema.
 * What this file does is make a change on THIS side impossible to make by accident — the
 * `Required<LessonEvidence>` literal below **fails to compile** when a field is added to the
 * interface, until somebody classifies it as sent or withheld. The direction the gap actually
 * leaks is a field added to the editor's bundle, and that is the direction this catches.
 */

import {
  SUBMITTED_EVIDENCE_KEYS,
  WITHHELD_EVIDENCE_KEYS,
  submittedEvidence
} from '../../src/editor/src/models/lessongrading';
import type { LessonEvidence } from '../../src/editor/src/models/lessongrading';

/**
 * 🔴 `Required<LessonEvidence>`, AND THE TYPE ANNOTATION IS THE INSTRUMENT — not the
 * assertions below it. Add a field to `LessonEvidence` and this literal stops compiling, so
 * the gate fires at the point somebody makes the change rather than at the point a teacher
 * notices data missing. An `as LessonEvidence` cast here would silently retire the whole file.
 */
const everyField: Required<LessonEvidence> = {
  lessonTitle: 'State on a page',
  provenance: 'curated',
  stepsGraded: 3,
  stepsPassed: 2,
  completionPercent: 66,
  complete: false,
  stepOutcomes: [
    { index: 0, graded: true, passed: true },
    { index: 1, graded: true, passed: true },
    { index: 2, graded: true, passed: false }
  ],
  wholeSolution: { valid: true, rendered: true, findingCount: 0 },
  gradedAt: '2026-08-19T20:00:00.000Z'
};

describe('the evidence bundle is classified field by field', () => {
  it('every field is either sent or deliberately withheld — none is unclassified', () => {
    const classified = [...SUBMITTED_EVIDENCE_KEYS, ...WITHHELD_EVIDENCE_KEYS].sort();
    expect(Object.keys(everyField).sort()).toEqual(classified);
  });

  it('the two lists do not overlap', () => {
    const sent = new Set<string>(SUBMITTED_EVIDENCE_KEYS);
    expect(WITHHELD_EVIDENCE_KEYS.filter((k) => sent.has(k))).toEqual([]);
  });

  it('withholds exactly lessonTitle and gradedAt, for the reasons recorded beside the list', () => {
    // Pinned rather than derived: these two are a DECISION, and a spec that read them out of
    // the constant it is checking would go green if somebody started sending a pupil's
    // free text.
    expect([...WITHHELD_EVIDENCE_KEYS].sort()).toEqual(['gradedAt', 'lessonTitle']);
  });
});

describe('submittedEvidence — what actually goes on the wire', () => {
  it('sends every allow-listed field and neither withheld one', () => {
    const wire = submittedEvidence(everyField);
    expect(Object.keys(wire).sort()).toEqual([...SUBMITTED_EVIDENCE_KEYS].sort());
    expect(wire).not.toHaveProperty('lessonTitle');
    expect(wire).not.toHaveProperty('gradedAt');
  });

  it('carries the values through unchanged — it narrows, it does not transform', () => {
    const wire = submittedEvidence(everyField);
    expect(wire.completionPercent).toBe(66);
    expect(wire.complete).toBe(false);
    expect(wire.stepOutcomes).toEqual(everyField.stepOutcomes);
    expect(wire.wholeSolution).toEqual(everyField.wholeSolution);
  });

  it('drops an absent optional rather than sending an explicit undefined', () => {
    // `JSON.stringify` erases undefined, so this is invisible on the wire — but the platform's
    // `pickEvidence` asks `key in bundle`, and a key present with an undefined value is a
    // different answer to that question than a key that is absent.
    const minimal: LessonEvidence = {
      stepsGraded: 1,
      stepsPassed: 1,
      completionPercent: 100,
      complete: true,
      stepOutcomes: [{ index: 0, graded: true, passed: true }]
    };
    const wire = submittedEvidence(minimal);
    expect('provenance' in wire).toBe(false);
    expect('wholeSolution' in wire).toBe(false);
  });

  it('🔴 sends no free text except provenance', () => {
    // The property `0006` is built around: with `lessonTitle` gone, no string in this bundle
    // is one the submitting machine's user can choose. It is what lets `submissions.evidence`
    // — the first column an org-minor account can write to — avoid a `minor-free-text`
    // classification in UNI-005's census.
    const strings = Object.entries(submittedEvidence(everyField))
      .filter(([, v]) => typeof v === 'string')
      .map(([k]) => k);
    expect(strings).toEqual(['provenance']);
  });
});
