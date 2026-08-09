/**
 * BLD-008 acceptance criterion 4 — *"the question set changes when
 * `templates.ts` changes, proving they share a source"*.
 *
 * The claim is not that a table exists; it is that **there is nowhere else for a
 * question to come from**. So the assertions here are of two kinds:
 *
 *  - the set really is derived from `DOC_TEMPLATES` (edit the template, get a
 *    different set — exercised against a real edited copy of the string, not
 *    against a mock);
 *  - every heading currently in the templates is classified, so a heading added
 *    tomorrow turns red here rather than silently defaulting.
 *
 * ⚠️ That second one is why the default in `interviewQuestions` is *ask* and
 * this spec exists as well. A default cannot fail loudly — the whole point of it
 * is that it does not — so the loud half lives here.
 */

import { DOC_TEMPLATES } from '../../src/editor/src/models/ProjectDocs/templates';
import {
  interviewQuestions,
  QUESTION_RULES,
  templateHeadingKeys,
  templateHeadings
} from '../../src/editor/src/models/AiAssistant/review/interviewQuestions';

describe('the headings are read from the templates', () => {
  it('finds the `##` headings of a template, in order', () => {
    expect(templateHeadings(DOC_TEMPLATES.brief)).toEqual([
      'What this app is',
      'Who uses it',
      'Deliberately out of scope'
    ]);
  });

  it('does not mistake the `#` title or a comment for a heading', () => {
    const headings = templateHeadings(DOC_TEMPLATES.architecture);
    expect(headings).not.toContain('Architecture');
    // The HTML comment in ARCHITECTURE's header talks about node inventories and
    // is full of prose; nothing in it is a heading.
    expect(headings).toEqual(['Page map', 'Data model', 'Backend contracts', 'Decisions']);
  });

  it('reads a heading that is not in the shipped templates', () => {
    const edited = `${DOC_TEMPLATES.brief}\n## Support commitments\n\nWho answers the phone.\n`;
    expect(templateHeadings(edited)).toContain('Support commitments');
  });
});

describe('criterion 4 — one source', () => {
  it('asks about a heading the graph cannot answer, and not about one it can', () => {
    const ids = interviewQuestions().map((question) => question.id);
    // Intent — no graph contains it.
    expect(ids).toContain('brief:who-uses-it');
    // The page map is extracted by `pageMap.ts` before any model sees it.
    expect(ids).not.toContain('architecture:page-map');
  });

  it('produces a sit-down, not a form — seven questions across the three documents', () => {
    const questions = interviewQuestions();
    // Criterion 1 requires at least four. The upper bound is the judgement, and
    // it is pinned exactly rather than as a range: the thirteen headings in the
    // templates would be a questionnaire nobody finishes, which is worse than
    // the guessing it replaced because the guesses at least arrived. Seven is
    // what falls out of "ask only where the graph cannot answer" — the task's
    // own estimate was six, so this is the number to look at again if the set
    // grows rather than a bound to relax.
    expect(questions.length).toBeGreaterThanOrEqual(4);
    expect(questions.length).toBe(7);
    expect(new Set(questions.map((q) => q.docKind)).size).toBe(3);
    // Weighted where the graph is silent: intent, not conventions.
    expect(questions.filter((q) => q.docKind === 'brief').length).toBe(3);
    expect(questions.filter((q) => q.docKind === 'conventions').length).toBe(1);
  });

  it('gives every question a stable id derived from its document and heading, never its position', () => {
    const first = interviewQuestions();
    const second = interviewQuestions();
    expect(first.map((q) => q.id)).toEqual(second.map((q) => q.id));
    expect(new Set(first.map((q) => q.id)).size).toBe(first.length);
    for (const question of first) expect(question.id.startsWith(`${question.docKind}:`)).toBe(true);
  });

  it('⚠️ classifies every heading the templates currently have', () => {
    // The loud half of the "unclassified headings are asked" default. If this
    // fails, somebody added a heading to `templates.ts`: decide whether the
    // graph can answer it and put it in QUESTION_RULES. Until then the interview
    // will ask about it in its own words, which is the safe direction to fail.
    const unclassified = templateHeadingKeys().filter((key) => !(key in QUESTION_RULES));
    expect(unclassified).toEqual([]);
  });

  it('⚠️ has no rule for a heading the templates no longer have', () => {
    // The other direction, and the one that rots quietly: a rule for a deleted
    // heading is a question that can never be asked and a reader who believes it
    // is.
    const keys = new Set(templateHeadingKeys());
    expect(Object.keys(QUESTION_RULES).filter((key) => !keys.has(key))).toEqual([]);
  });

  it('every derivable heading says what derives it', () => {
    for (const [key, rule] of Object.entries(QUESTION_RULES)) {
      if (rule.ask) continue;
      expect(typeof rule.derivedFrom).toBe('string');
      expect((rule.derivedFrom ?? '').length).toBeGreaterThan(0);
      expect(key).toBeTruthy();
    }
  });
});
