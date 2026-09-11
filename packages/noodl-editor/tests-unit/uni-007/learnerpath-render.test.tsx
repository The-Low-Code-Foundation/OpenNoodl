/**
 * UNI-007 AC1 — what the path section actually DRAWS.
 *
 * ## Why this is separate from `learnerpath.test.ts`
 *
 * That file grades the *decisions* — which state, which sentence, which steps. This one answers
 * the questions a view model cannot be asked: **is the truth sentence on the screen**, **is it
 * above the steps**, **does a D15-refused viewer get literally nothing**, **are the option
 * labels the platform's words or a locked panel describing them**. Until this file existed
 * `LearnerPathSection` had never been executed by anything — which is the same shape as the
 * platform end of AC1 having no caller, one layer up, and it is the shape this phase keeps
 * finding broken.
 *
 * 🔴 **THE `hidden` ASSERTION IS PAIRED WITH A NOT-HIDDEN CONTROL, ALWAYS.** `render()` answers
 * `null` for a component that drew nothing *and* for one that was never called, so "it drew
 * nothing" on its own is a claim about an instrument that may have been pointed at nothing.
 * The control renders a real path through the same call and requires words back.
 *
 * ⚠️ What this still cannot see: effects, state, layout, paint, and whether the section is
 * legible in a launcher column. That is a drive, not a spec.
 *
 * @module noodl-editor/tests-unit/uni-007/learnerpath-render
 */
import React from 'react';

import {
  LearnerPathSection,
  type LauncherLearnerPath,
  type PathStepView
} from '@noodl-core-ui/preview/launcher/Launcher/components/LearnerPathSection';

import { byClass, render, text, walk } from '../support/renderElements';

const QUESTIONS = [
  {
    key: 'logic',
    prompt: 'When something gets complicated, which would you rather do?',
    options: [
      { value: 'visual', label: 'Wire it up visually so I can see it' },
      { value: 'code', label: 'Write a few lines of code' }
    ]
  }
];

function step(over: Partial<PathStepView> = {}): PathStepView {
  return {
    position: 1,
    slug: 'where-state-lives',
    title: 'Where state lives',
    description: 'Variables, and the things that read them.',
    reason: 'Part of the spine everybody walks.',
    standing: 'In writing',
    installable: false,
    minutes: 25,
    projection: null,
    projectable: true,
    ...over
  };
}

const TRUTH =
  'This is your path — 3 lessons in the order they build on each other. None of them can be installed yet: every one is still being written.';

function pathSurface(over: Record<string, unknown> = {}): LauncherLearnerPath {
  return {
    state: 'path',
    truth: TRUTH,
    ready: 0,
    total: 1,
    duration: '25 minutes',
    steps: [step()],
    omitted: [],
    answers: null,
    ...over
  } as LauncherLearnerPath;
}

/** Index of the first node whose own text contains `needle`, in draw order. */
function positionOf(tree: ReturnType<typeof render>, needle: string): number {
  return walk(tree).findIndex((n) => n.ownText.includes(needle));
}

describe('the truth sentence is on the screen', () => {
  it('is drawn, in the platform’s exact words', () => {
    const tree = render(<LearnerPathSection surface={pathSurface()} />);
    expect(text(tree)).toContain('None of them can be installed yet');
    expect(byClass(tree, 'Truth')).toHaveLength(1);
  });

  it('is drawn ABOVE the first step, so it cannot be scrolled past', () => {
    // 🔴 Order is the claim, not decoration. A caveat below an eight-step list is a caveat most
    // readers never reach, and "the sentence is present somewhere in the tree" would pass
    // against exactly that.
    const tree = render(<LearnerPathSection surface={pathSurface()} />);
    const truthAt = positionOf(tree, 'None of them can be installed yet');
    const stepAt = positionOf(tree, 'Where state lives');
    expect(truthAt).toBeGreaterThanOrEqual(0);
    expect(stepAt).toBeGreaterThanOrEqual(0);
    expect(truthAt).toBeLessThan(stepAt);
  });
});

describe('D15 — a refused viewer gets nothing at all', () => {
  it('draws literally nothing', () => {
    expect(render(<LearnerPathSection surface={{ state: 'hidden' }} />)).toBeNull();
  });

  it('CONTROL: the same call with a real path draws words — so `null` above meant something', () => {
    // 🔴 Without this, the assertion above is satisfied by a component that never ran, an
    // import that resolved to undefined, or a spec pointed at the wrong module.
    const drawn = render(<LearnerPathSection surface={pathSurface()} />);
    expect(drawn).not.toBeNull();
    expect(text(drawn).length).toBeGreaterThan(40);
  });

  it('and draws no heading either — not even an empty section', () => {
    const tree = render(<LearnerPathSection surface={{ state: 'hidden' }} />);
    expect(text(tree)).toBe('');
  });
});

/**
 * 🔴 FIX-025 — THESE TWO TESTS ASSERTED THE OPPOSITE, AND THE REVERSAL IS THE FIX.
 *
 * They required the signed-out state to draw the platform's real option labels, on the argument
 * that a form is a better invitation than a sentence about a form. Richard met the result:
 *
 * > *"When I was signed out, the build my path questions looked possible to answer, and didn't
 * > explain why clicking answers does nothing. The questions should be hidden until the user
 * > signs in."*
 *
 * The old argument was right about invitations and wrong about what a **disabled** form says.
 * `disabled` reads as *broken*, not as *locked*; there was no text anywhere giving a reason;
 * and a radio button that does not respond is the clearest statement a screen can make that it
 * is not working. So the options are gone and one sentence names what is behind the door.
 *
 * ⚠️ `GET /me/intake` still takes no token, and that is still deliberate — the questions are
 * still fetched signed out, which is what lets the line below state the real COUNT rather than
 * a number somebody typed. Do not re-scope the route on the strength of this change.
 */
describe('signed out', () => {
  it('🔴 does NOT draw the options — an unanswerable form reads as a broken one', () => {
    const tree = render(
      <LearnerPathSection
        surface={{ state: 'signed-out', questions: QUESTIONS, note: 'Sign in and these build your path.' }}
        onSignIn={() => undefined}
      />
    );
    const words = text(tree);
    expect(words).not.toContain('Wire it up visually so I can see it');
    expect(words).not.toContain('Write a few lines of code');
    expect(words).toContain('Sign in to the community');
  });

  it('says how many questions there are, from the platform’s own list', () => {
    // 🔴 The COUNT is what the signed-out fetch buys, so it must come from the questions and
    // never be a literal — a hard-coded "three" is what goes stale when the set changes.
    // ⚠️ This fixture holds ONE question, so the singular branch is the one under test here,
    // and the plural is exercised below. A count rendered by a template that only ever agrees
    // with itself would pass either way.
    const one = render(
      <LearnerPathSection
        surface={{ state: 'signed-out', questions: QUESTIONS, note: 'Sign in and these build your path.' }}
        onSignIn={() => undefined}
      />
    );
    expect(text(one)).toContain('One short question');

    const two = render(
      <LearnerPathSection
        surface={{
          state: 'signed-out',
          questions: [...QUESTIONS, { key: 'experience', prompt: 'Have you written code before?', options: [] }],
          note: 'Sign in and these build your path.'
        }}
        onSignIn={() => undefined}
      />
    );
    expect(text(two)).toContain('2 short questions');
  });

  it('draws no sign-in door when the host offers no way through one', () => {
    const tree = render(
      <LearnerPathSection surface={{ state: 'signed-out', questions: QUESTIONS, note: 'x' }} />
    );
    expect(text(tree)).not.toContain('Sign in to the community');
    // ⚠️ Control: the section is still RENDERED, so the assertion above is about a missing
    // door and not about a component that drew nothing at all.
    expect(text(tree)).toContain('Your path');
  });
});

describe('the intake form', () => {
  it('disables the submit until every question is answered', () => {
    const partial = render(
      <LearnerPathSection
        surface={{ state: 'intake', questions: QUESTIONS, chosen: {}, canSubmit: false, retaking: false }}
      />
    );
    const whole = render(
      <LearnerPathSection
        surface={{ state: 'intake', questions: QUESTIONS, chosen: { logic: 'visual' }, canSubmit: true, retaking: false }}
      />
    );
    const submitOf = (t: ReturnType<typeof render>) =>
      walk(t).find((n) => n.props['data-test'] === 'learner-path-submit');

    // The arms must DISAGREE — "there is a button" passes against a button that is always live.
    expect(submitOf(partial)?.props.disabled).toBe(true);
    expect(submitOf(whole)?.props.disabled).toBe(false);
  });

  it('marks the chosen option, so an answer is visible after it is given', () => {
    const tree = render(
      <LearnerPathSection
        surface={{ state: 'intake', questions: QUESTIONS, chosen: { logic: 'code' }, canSubmit: true, retaking: false }}
      />
    );
    const chosen = walk(tree).filter((n) => n.props['data-chosen'] === 'yes');
    expect(chosen).toHaveLength(1);
    expect(chosen[0].ownText).toBe('Write a few lines of code');
  });

  it('DRAWS a failed submit, above the button that failed', () => {
    const tree = render(
      <LearnerPathSection
        surface={{
          state: 'intake',
          questions: QUESTIONS,
          chosen: { logic: 'visual' },
          canSubmit: true,
          retaking: true,
          error: 'Your session has expired — sign in again and your answers will save.'
        }}
      />
    );
    expect(text(tree)).toContain('Your session has expired');
    // Above the control the learner just pressed — a message under it is one they scroll past
    // while concluding the button is broken.
    const errorAt = positionOf(tree, 'Your session has expired');
    const buttonAt = walk(tree).findIndex((n) => n.props['data-test'] === 'learner-path-submit');
    expect(errorAt).toBeGreaterThanOrEqual(0);
    expect(errorAt).toBeLessThan(buttonAt);
  });

  it('CONTROL: no error field, no message — and the form still draws', () => {
    const tree = render(
      <LearnerPathSection
        surface={{ state: 'intake', questions: QUESTIONS, chosen: {}, canSubmit: false, retaking: false }}
      />
    );
    expect(walk(tree).some((n) => n.props['data-test'] === 'learner-path-submit-error')).toBe(false);
    expect(text(tree)).toContain('Wire it up visually so I can see it');
  });

  it('says a retake REPLACES, because it does', () => {
    const tree = render(
      <LearnerPathSection
        surface={{ state: 'intake', questions: QUESTIONS, chosen: {}, canSubmit: false, retaking: true }}
      />
    );
    expect(text(tree)).toContain('replaces your current path');
  });
});

describe('what the intake branched away', () => {
  it('draws the omissions with the platform’s reason — the half a filter cannot produce', () => {
    const tree = render(
      <LearnerPathSection
        surface={pathSurface({
          omitted: [
            {
              slug: 'mapping-to-code',
              title: 'The same ideas in code',
              reason: 'You said you would rather wire logic up visually.'
            }
          ]
        })}
      />
    );
    const words = text(tree);
    expect(words).toContain('Left off your path');
    expect(words).toContain('The same ideas in code');
    expect(words).toContain('rather wire logic up visually');
  });

  it('CONTROL: with nothing omitted the block is absent — so the block above was the data', () => {
    const tree = render(<LearnerPathSection surface={pathSurface({ omitted: [] })} />);
    expect(text(tree)).not.toContain('Left off your path');
    // …and the section itself still drew, so "absent" is not "never ran".
    expect(text(tree)).toContain('Where state lives');
  });
});

describe('the projection offer', () => {
  it('is offered on an un-projected step and withdrawn once one exists', () => {
    const tree = render(
      <LearnerPathSection
        surface={pathSurface({
          total: 2,
          steps: [
            step({ slug: 'a', title: 'A', projection: null, projectable: true }),
            step({ position: 2, slug: 'b', title: 'B', projection: 'Think of it as your `let x = 0`.', projectable: false })
          ]
        })}
        onProject={() => undefined}
      />
    );
    const buttons = walk(tree).filter((n) => String(n.props['data-test'] ?? '').startsWith('learner-path-project-'));
    expect(buttons.map((b) => b.props['data-test'])).toEqual(['learner-path-project-a']);
    // The existing projection is drawn rather than merely counted.
    expect(text(tree)).toContain('let x = 0');
  });

  it('offers nothing at all when the host cannot project — no dead button', () => {
    const tree = render(<LearnerPathSection surface={pathSurface()} />);
    expect(walk(tree).filter((n) => String(n.props['data-test'] ?? '').startsWith('learner-path-project-'))).toHaveLength(
      0
    );
  });

  it('draws D10’s refusal as a note beside the path, with the path intact', () => {
    // 🔴 The refusal must not replace the path. A pupil whose org has tier 1 switched off has a
    // COMPLETE tier-0 path, and a component that swapped it for an error would report a school
    // policy as a broken feature.
    const tree = render(
      <LearnerPathSection
        surface={pathSurface()}
        projectionNote="Tailored explanations are switched off for this account. Your path is complete without them."
      />
    );
    const words = text(tree);
    expect(words).toContain('switched off for this account');
    expect(words).toContain('Where state lives');
    expect(words).toContain('None of them can be installed yet');
  });
});

describe('the two failure states are told apart on screen', () => {
  it('unreachable says the community could not be reached', () => {
    const tree = render(<LearnerPathSection surface={{ state: 'unreachable', detail: 'HTTP 503' }} />);
    expect(text(tree)).toContain('Couldn’t reach the community');
    expect(text(tree)).toContain('HTTP 503');
  });

  it('and signed-out does NOT — the two must read differently', () => {
    const out = text(render(<LearnerPathSection surface={{ state: 'signed-out', questions: QUESTIONS, note: 'n' }} />));
    const down = text(render(<LearnerPathSection surface={{ state: 'unreachable', detail: 'HTTP 503' }} />));
    expect(out).not.toContain('Couldn’t reach the community');
    expect(out).not.toBe(down);
  });
});
