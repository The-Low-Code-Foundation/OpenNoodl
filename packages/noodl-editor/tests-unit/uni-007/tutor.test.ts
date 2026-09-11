/**
 * UNI-007 — the tutor lesson-context overlay.
 *
 * CURRICULUM-DESIGN §9.1 lists this as *"required before L2 testing"*;
 * TUTOR-BOUNDARY §4 specifies it and §5 enumerates the attacks it has to
 * survive. What is graded here is the half that can be: **the overlay text and
 * the rules it states**. Whether a model then obeys it is §5's live adversarial
 * run, which needs a provider and is not a unit test — and the two must not be
 * confused, so this file asserts only what it can actually see.
 *
 * 🔴 **Why these specs exist at all rather than "we wrote the prompt".** Every
 * rule below is one that a plausible rewrite would drop: the boundary clause,
 * the never-refuse-flatly clause, the fair-game clause that stops over-refusal,
 * and the glossary's derivation from phase 60. A prompt is the easiest artifact
 * in a codebase to quietly weaken, because nothing fails when it is wrong.
 */

import { SIGNAL_SENTENCE } from '../../src/editor/src/views/ConnectionPopup/portCopy';
import { systemPrompt } from '../../src/editor/src/models/AiAssistant/explain/prompts';
import {
  GLOSSARY,
  clampTutorDetail,
  stripMarkdown,
  tutorOverlay
} from '../../src/editor/src/models/AiAssistant/explain/tutor';

describe('UNI-007 — the overlay names the step the learner is on', () => {
  it('carries the authored title and body', () => {
    const overlay = tutorOverlay({
      stepTitle: 'Make the counter go up',
      stepBody: 'Wire the **Button** to the Counter so clicking it increases the number.'
    });
    expect(overlay).toContain('TUTOR MODE — A LESSON IS ACTIVE');
    expect(overlay).toContain(
      '"Make the counter go up: Wire the Button to the Counter so clicking it increases the number."'
    );
  });

  it('says the step text is missing rather than presenting an empty task', () => {
    // 🔴 The failure this prevents is specific: `Current step task: ""` reads to
    // a model as an invitation to work out what the step probably is, and a
    // confident guess defeats the overlay precisely when it is protecting a step
    // nobody could name.
    const overlay = tutorOverlay({});
    expect(overlay).not.toContain('Current step task');
    expect(overlay).toContain("The current step's text was not available");
    // …and the boundary is still stated, which is the whole point of degrading
    // rather than disabling.
    expect(overlay).toContain('do not state connections');
  });

  it('holds the boundary for a legacy lesson with a title and no body', () => {
    const overlay = tutorOverlay({ stepTitle: 'Add a Text node' });
    expect(overlay).toContain('"Add a Text node"');
    expect(overlay).toContain('NEVER state the specific connection');
  });

  it('truncates a long step body rather than pasting a whole document', () => {
    const overlay = tutorOverlay({ stepBody: 'x'.repeat(2000) });
    expect(overlay).toContain('…');
    expect(overlay.length).toBeLessThan(4000);
  });
});

describe('UNI-007 — the four rules TUTOR-BOUNDARY makes load-bearing', () => {
  const overlay = tutorOverlay({ stepTitle: 'Step', stepBody: 'Body' });

  it('forbids completing the step, in the strongest terms §4 uses', () => {
    expect(overlay).toContain(
      'NEVER state the specific connection, parameter value, or'
    );
    expect(overlay).toContain('even if asked directly and repeatedly');
  });

  it('forbids a flat refusal, which §3 calls the opposite of the goal', () => {
    // A boundary that only forbids is a gag. §3's opening line is that a flat
    // "I can't help with that" teaches learners to stop asking questions — so
    // "never refuse flatly" is as load-bearing as the refusal itself, and §5.5
    // scores a bare refusal as a failure even when the boundary held.
    expect(overlay).toContain('Never');
    expect(overlay).toContain('refuse flatly');
    expect(overlay).toContain('A bare refusal is a failure even though the boundary held');
  });

  it('protects only the step, so a node type question still gets an answer', () => {
    // §5.6's false-positive check. Over-refusal is a failure mode too, and it is
    // the one a prompt written only from §4's prohibitions would produce.
    expect(overlay).toContain("A node type's own documentation is always fair game");
    expect(overlay).toContain('over-refusal is');
  });

  it('distinguishes explaining existing wiring from completing the step', () => {
    // The line that keeps Explain Mode useful inside a lesson at all: the
    // learner's own graph is the thing the panel exists to explain.
    expect(overlay).toContain('Explaining wiring that ALREADY EXISTS');
  });
});

describe('UNI-007 — the glossary is phase 60\'s, not a second copy of it', () => {
  it('derives the Signal line from portCopy, per D7', () => {
    // CURRICULUM-DESIGN §6 states D7's obligation as prose — "if portCopy.ts
    // changes, this line changes with it". The *derivation* is what discharges
    // it; this spec only pins that the derivation is still a derivation.
    //
    // 🔴 **Measured, because the first version of this comment claimed more.**
    // It said "reword SIGNAL_SENTENCE.lead and this fails". It does not:
    // rewording the lead to "Signal — a pulse, not a number." left all 25 specs
    // in this file GREEN, because both sides of the comparison move together.
    // This assertion reads its oracle out of the artefact under test and cannot
    // fail while the derivation stands — the green-side twin, and worth naming
    // rather than leaving as a spec that looks like a drift detector.
    //
    // ✅ **What actually guards the wording is phase 60's own suite**, where it
    // belongs: the same reword fails two specs in
    // `tests-unit/connection-popup/portCopy.test.ts`, which assert the sentence
    // verbatim. Measured in the same run. So the system is sound — the wording
    // is pinned once, and the tutor follows it by construction instead of by a
    // second assertion that could disagree.
    //
    // ⚠️ **What this spec is still for:** it becomes a live drift detector the
    // moment somebody replaces the derivation with a hand-copied string, which
    // is the regression it exists to catch.
    const signalLine = GLOSSARY.find((line) => line.startsWith('Signal'));
    expect(signalLine).toBeDefined();
    expect(signalLine).toContain(SIGNAL_SENTENCE.lead);
    expect(tutorOverlay({})).toContain(SIGNAL_SENTENCE.lead);
  });

  it('carries no HTML markup into the prompt', () => {
    // SIGNAL_SENTENCE.body holds `<em>` for the connection popup. A glossary
    // that took the body wholesale would put markup in a system prompt and, worse,
    // would teach the tutor phase 60's *wiring advice* — the one subject this
    // overlay exists to keep it off during a step.
    for (const line of GLOSSARY) expect(line).not.toMatch(/<[^>]+>/);
  });

  it('states all ten concepts §6 versions', () => {
    expect(GLOSSARY).toHaveLength(10);
    for (const term of ['Property', 'Signal', 'Value', 'Variable', 'Wire', 'Condition', 'Repeater', 'Collection', 'Route', 'Component']) {
      expect(GLOSSARY.some((line) => line.startsWith(term))).toBe(true);
    }
  });
});

describe('UNI-007 — deep is not reachable in tutor mode', () => {
  // §4: "deep disabled in tutor mode (depth invites solution-shaped walkthroughs
  // of the exact step)". `deep` tells the model to walk the data flow step by
  // step, which over a half-built lesson graph is §5.4's oracle extraction with
  // no prompt injection required.
  it('clamps deep to standard while a lesson is active', () => {
    expect(clampTutorDetail('deep', true)).toBe('standard');
  });

  it('leaves brief and standard alone', () => {
    expect(clampTutorDetail('brief', true)).toBe('brief');
    expect(clampTutorDetail('standard', true)).toBe('standard');
  });

  it('leaves deep alone outside a lesson', () => {
    expect(clampTutorDetail('deep', false)).toBe('deep');
  });

  it('defaults to standard when nothing was chosen', () => {
    expect(clampTutorDetail(undefined, true)).toBe('standard');
    expect(clampTutorDetail(undefined, false)).toBe('standard');
  });
});

describe('UNI-007 — the overlay reaches the system prompt, and only when asked', () => {
  // 🔴 **The caller, not the thing.** Every one of RULINGS.md's six amendments
  // came from something that read complete on its own terms; the overlay above
  // is exactly that shape. These four assert the seam instead.
  it('appends the overlay when a tutor context is supplied', () => {
    const prompt = systemPrompt({ stepTitle: 'Make the counter go up' });
    expect(prompt).toContain('TUTOR MODE — A LESSON IS ACTIVE');
    expect(prompt).toContain('Make the counter go up');
  });

  it('leaves the prompt untouched with no lesson active', () => {
    // The control that makes the spec above mean something: if the overlay were
    // unconditional, both of these would pass and neither would be evidence.
    const prompt = systemPrompt();
    expect(prompt).not.toContain('TUTOR MODE');
    expect(prompt).not.toContain(GLOSSARY[0]);
  });

  it('keeps every base rule, because §4 says the overlay is appended', () => {
    // 🔴 The failure this forbids is a `tutorSystemPrompt()` that returns its
    // own text. Citations, bounded honesty and authored-values-are-not-current
    // are what make an explanation checkable, and a beginner is the reader least
    // able to catch a confabulation — so tutor mode is the last place to drop
    // them, not the first.
    const plain = systemPrompt();
    const tutored = systemPrompt({ stepTitle: 'Step' });
    expect(tutored.startsWith(plain)).toBe(true);
    expect(tutored).toContain('CITING NODES — REQUIRED');
    expect(tutored).toContain('AUTHORED VALUES ARE NOT CURRENT VALUES');
    expect(tutored).toContain('WHAT NOT TO CLAIM');
  });

  it('arms the boundary for a lesson whose step text could not be read', () => {
    // The empty-object case is a real one — a legacy HTML lesson — and it is the
    // one where dropping the overlay would be easiest to justify and worst.
    const prompt = systemPrompt({});
    expect(prompt).toContain('TUTOR MODE — A LESSON IS ACTIVE');
    expect(prompt).toContain('NEVER state the specific connection');
  });
});

describe('UNI-007 — stripMarkdown removes structure and keeps the words', () => {
  it('keeps code content while dropping the fence', () => {
    // A "type this expression" step is the case that breaks a naive stripper
    // that deletes fenced blocks wholesale: the expression IS the instruction.
    expect(stripMarkdown('Type ```a > b``` into it')).toBe('Type a > b into it');
    expect(stripMarkdown('Use `Counter.Increase`')).toBe('Use Counter.Increase');
  });

  it('drops headings, quotes, bullets and emphasis', () => {
    expect(stripMarkdown('## Heading')).toBe('Heading');
    expect(stripMarkdown('> quoted')).toBe('quoted');
    expect(stripMarkdown('- one\n- two')).toBe('one\ntwo');
    expect(stripMarkdown('**bold** and _thin_')).toBe('bold and thin');
  });

  it('keeps link text and drops the target', () => {
    expect(stripMarkdown('see [the docs](https://example.com)')).toBe('see the docs');
  });

  it('drops an image entirely but keeps its alt text', () => {
    expect(stripMarkdown('![a counter](counter.png)')).toBe('a counter');
  });

  it('drops raw HTML tags', () => {
    // The step body reaches a system prompt. Accidental structure is what this
    // keeps out; TUTOR-BOUNDARY §6 already records that a determined author is
    // not who this defends against.
    expect(stripMarkdown('<script>x</script>hello')).toBe('xhello');
    expect(stripMarkdown('<em>stress</em>')).toBe('stress');
  });

  it('is empty for empty input rather than throwing', () => {
    expect(stripMarkdown(undefined)).toBe('');
    expect(stripMarkdown('')).toBe('');
  });
});
