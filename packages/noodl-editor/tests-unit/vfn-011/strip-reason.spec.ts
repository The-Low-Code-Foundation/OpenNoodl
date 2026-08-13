/**
 * VFN-011 Part 1 — the empty strip names its reason.
 *
 * > *"When I run the logic node, open the editor, it still says 'No runs yet' at the bottom so I
 * > can't inspect the live values that passed through it."*
 *
 * The trace path is complete; the reporting was not. Tracing arms when the editor opens, so a run
 * that happened **before** it opened records nothing — and that state, the commonest one, rendered
 * the empty string. A builder could not tell *this has not run* from *this cannot run*.
 *
 * Two reasons were added, and the point of this file is that they are **derived rather than
 * declared**: `stripReasonFor` is a pure function of four facts somebody already holds, so the
 * decision is graded here and only the words live in the DOM.
 *
 * 🔴 The negative control at the bottom is not decoration. Every case below asserts a string, and a
 * suite of strings passes just as happily against a lookup that was never wired up. So the last
 * describe rebuilds **the controller's old line** — `status === 'attached' ? '' : COPY[status]` —
 * and requires it to produce the silence that was reported, over the same input.
 */

import {
  STATUS_COPY,
  benchHint,
  benchHintApplies,
  programHasProbes,
  stripReasonFor,
  type BlockStripReason,
  type StripReasonInput
} from '../../src/editor/src/views/BlocklyEditor/BlockValueTrace';

/** A program the current editor would generate: instrumented, always. */
const PROBED_CODE = '__s("s1");\nOutputs["result"] = __p("v1", 1 + 2);\n';

/**
 * A program as an editor before LGC-003 wrote it. This is the exact shape of the second reason:
 * it compiles, it runs, it produces the right answer, and it can never badge anything.
 */
const PRE_TRACING_CODE = 'Outputs["result"] = 1 + 2;\n';

function reason(overrides: Partial<StripReasonInput> = {}): BlockStripReason {
  return stripReasonFor({
    status: 'attached',
    runs: 0,
    hasBlocks: true,
    generatedCode: PROBED_CODE,
    ...overrides
  });
}

describe('VFN-011 Part 1 — which reason the strip owes the builder', () => {
  it('attached, armed and empty is its own reason — the one the report describes', () => {
    expect(reason({ status: 'attached', runs: 0 })).toBe('attached-idle');
  });

  it('a run beats every reason: there is something to scrub, so there is nothing to explain', () => {
    expect(reason({ status: 'attached', runs: 1 })).toBe('attached');
    expect(STATUS_COPY[reason({ status: 'attached', runs: 1 })]).toBe('');
  });

  it('passes the socket its own answer through, unchanged, when nothing has run', () => {
    // These four were already right. They are here because a change to the precedence would break
    // them silently, and "the preview is not running" is still the honest answer when it is not.
    expect(reason({ status: 'no-preview', runs: 0 })).toBe('no-preview');
    expect(reason({ status: 'not-in-preview', runs: 0 })).toBe('not-in-preview');
    expect(reason({ status: 'no-connection', runs: 0 })).toBe('no-connection');
    expect(reason({ status: 'waiting', runs: 0 })).toBe('waiting');
  });

  it('a stale program outranks every socket answer, because no action fixes it', () => {
    // 🔴 The precedence that matters. "Run the preview" is true and useless here: the preview will
    // run this program and still produce nothing, because there are no probes in it to produce
    // anything with. Only an edit regenerates the code (LGC-007 §6), so only an edit is offered.
    for (const status of ['waiting', 'attached', 'no-preview', 'not-in-preview', 'no-connection'] as const) {
      expect(reason({ status, generatedCode: PRE_TRACING_CODE })).toBe('no-probes');
    }
  });

  it('does not accuse a program that has never been generated', () => {
    // A freshly dropped Visual Function has `generatedCode: ''`. Telling its author their blocks
    // predate value tracing would be a sentence about a program that does not exist yet.
    expect(reason({ generatedCode: '', status: 'attached' })).toBe('attached-idle');
    // And a strip that was simply never handed the parameter must stay silent about it rather
    // than guess: `undefined` is "not told", not "there is none".
    expect(reason({ generatedCode: undefined, status: 'no-preview' })).toBe('no-preview');
  });

  it('does not accuse an empty workspace', () => {
    expect(reason({ hasBlocks: false, generatedCode: PRE_TRACING_CODE })).toBe('attached-idle');
  });

  it('every reason has a sentence, and only "nothing to say" is empty', () => {
    const reasons = Object.keys(STATUS_COPY) as BlockStripReason[];
    expect(reasons).toHaveLength(7);

    for (const key of reasons) {
      if (key === 'attached') {
        expect(STATUS_COPY[key]).toBe('');
        continue;
      }
      expect(STATUS_COPY[key].length).toBeGreaterThan(20);
    }

    // The two this task added, named rather than counted — a `toHaveLength` alone would pass if
    // somebody added two unrelated keys.
    expect(reasons).toContain('attached-idle');
    expect(reasons).toContain('no-probes');
    expect(STATUS_COPY['no-probes']).toContain('make any edit');
  });
});

describe('VFN-011 Part 2 — the sentence the bench adds', () => {
  it('offers Run for every reason except "there is nothing to say"', () => {
    for (const reason of Object.keys(STATUS_COPY) as BlockStripReason[]) {
      expect(benchHintApplies(reason)).toBe(reason !== 'attached');
    }
  });

  it('🔴 offers Run for a stale program, because the bench does not run the stale string', () => {
    // The one that looks like an exception and is not. `no-probes` is about what the *app* would
    // run — the node's saved code, which emits no probes. The bench regenerates from the blocks on
    // screen through the flush's own generator, which is instrumented always, so pressing Run is
    // exactly what works while the node on disk is stale.
    expect(benchHintApplies('no-probes')).toBe(true);
  });

  it('names the button it is talking about, rather than assuming its label', () => {
    expect(benchHint('▶ Run')).toContain('▶ Run');
    expect(benchHint('▶ Run')).toContain('with the app stopped');
  });
});

describe('VFN-011 Part 1 — the no-probe detection', () => {
  it('sees the probes a current generation emits', () => {
    expect(programHasProbes(PROBED_CODE)).toBe(true);
    expect(programHasProbes('Outputs["r"] = __p("id", 1);')).toBe(true);
    expect(programHasProbes('__s("id");')).toBe(true);
    // Whitespace between the name and the call is legal JavaScript and Blockly's own emitters
    // have produced it before now.
    expect(programHasProbes('__s ("id");')).toBe(true);
  });

  it('sees their absence in a program written before value tracing existed', () => {
    expect(programHasProbes(PRE_TRACING_CODE)).toBe(false);
    expect(programHasProbes('')).toBe(false);
    expect(programHasProbes(undefined)).toBe(false);
  });

  it('🔴 is a call, not a substring — a text block cannot fake a probe', () => {
    // `code.includes('__p')` is true of all three of these, and telling their author the program
    // was fine would be wrong in the direction that costs most: they would keep waiting for badges
    // that cannot arrive.
    expect(programHasProbes('Outputs["r"] = "__pizza";')).toBe(false);
    expect(programHasProbes('var my__p = 1; Outputs["r"] = my__p(2);')).toBe(false);
    expect(programHasProbes('Outputs["r"] = "call __s next";')).toBe(false);
  });
});

describe('VFN-011 Part 1 — 🔴 NEGATIVE CONTROL: the line this replaced was silent', () => {
  /**
   * The controller used to render `status === 'attached' ? '' : STATUS_COPY[status]`.
   *
   * Rebuilt here rather than described, because the claim under test is *"the reported state used
   * to produce no sentence"* and an instrument that cannot reproduce the defect proves nothing
   * about having removed it.
   */
  function noteAsItWas(status: 'waiting' | 'attached' | 'no-preview' | 'not-in-preview' | 'no-connection'): string {
    return status === 'attached' ? '' : STATUS_COPY[status];
  }

  it('the reported sequence produced the empty string, and now produces a sentence', () => {
    // The report's own sequence: the node ran, *then* the editor was opened, so the viewer is
    // attached and armed and the history is empty.
    const asItWas = noteAsItWas('attached');
    expect(asItWas).toBe('');

    const now = STATUS_COPY[reason({ status: 'attached', runs: 0 })];
    expect(now).not.toBe('');
    expect(now).toContain('Nothing has run since you opened this editor');
  });

  it('the stale-program case had no sentence at all to reach for', () => {
    // Not merely unsaid — unsayable. There was no key for it, so the strip said whatever the
    // socket happened to be doing, which for an attached viewer was nothing.
    expect(noteAsItWas('attached')).toBe('');
    expect(STATUS_COPY[reason({ status: 'attached', generatedCode: PRE_TRACING_CODE })]).toContain(
      'before value tracing'
    );
  });
});
