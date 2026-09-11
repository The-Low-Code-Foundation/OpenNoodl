/**
 * LGC-001 §2 — the sentence a person reads while choosing.
 *
 * The deliverable of §2 is *copy*, so copy is what this grades. That sounds like
 * testing a string constant, and for most strings it would be. This one earns a
 * suite for a specific reason, recorded in the task's Register as finding L1:
 *
 * The brief asked the Function card to say the node has **"only one input signal
 * and output signal"**. The output half is false, and it was verified in source
 * before the copy was written — `Outputs.X()` mints an unlimited number of
 * signal outputs (`javascriptnodeparser.js:352-366`), additional to the built-in
 * `Success`/`Failure`/`Done`.
 *
 * The picker card is the only place in the product where that behaviour is
 * written down at all. That is exactly the shape of the NDA-017 defect — a port
 * description that described a trap as if it were a feature, was wrong, and was
 * the sole source of the claim. So the prohibition is a spec, not a comment:
 * whoever edits this copy next has to trip over it.
 *
 * ⚠️ **The input half of this suite was itself the wrong claim, and it is
 * corrected here (FIX-016 §3, 2026-08-16).** It read that
 * `Node.Signals.X = function(){}` mints unlimited signal inputs *additional to
 * the built-in `Run`* — a sentence true of neither node. `Node.Signals` is
 * reached only from `Javascript2`, the Script node
 * (`javascriptnodeparser.js:203-211`), which has no built-in `Run`; a Function
 * body is compiled as `AsyncFunction('Inputs','Outputs','Noodl','Component', …)`
 * (`simplejavascript.ts:609-619`), where `Node` is not in scope at all. Richard
 * ruled the asymmetry deliberate — *"Script nodes are the ones to use when you
 * want multiple input signals, Functions just have Run"* — so the card is now
 * required to name `Run` as the only trigger, and the prohibition below narrows
 * to the output claim it can still prove false.
 */

/* eslint-env jest */

import { chooserNotes, getChooserNote } from '../../src/editor/src/views/NodePicker/NodePicker.chooser';

describe('LGC-001 §2 — the chooser note exists for the triad and nothing else', () => {
  it('answers all three, by type id', () => {
    expect(getChooserNote('Expression')).toBeDefined();
    expect(getChooserNote('JavaScriptFunction')).toBeDefined();
    expect(getChooserNote('Logic Builder')).toBeDefined();
  });

  /**
   * ⚠️ Keyed by the **frozen type id**, never by the label. `Logic Builder` is
   * the id of the node the picker now calls "Visual Function" (§3). A note keyed
   * by the label would have gone silently missing the moment §3 landed, and a
   * missing note renders as nothing at all — the preview column would simply
   * show the reference prose, which is the state this task exists to improve on.
   */
  it('is not keyed by the display label', () => {
    expect(getChooserNote('Visual Function')).toBeUndefined();
    expect(getChooserNote('Function')).toBeUndefined();
  });

  it('says nothing about the other ~172 nodes', () => {
    expect(getChooserNote('Group')).toBeUndefined();
    expect(getChooserNote('Router')).toBeUndefined();
    expect(getChooserNote(undefined)).toBeUndefined();
  });

  it('is exactly three notes', () => {
    expect(chooserNotes().map((note) => note.typeName)).toEqual([
      'Expression',
      'Logic Builder',
      'JavaScriptFunction'
    ]);
  });
});

describe('LGC-001 §2 — every card carries a sentence and a worked example', () => {
  /**
   * The acceptance criterion, verbatim: *"Cursoring any of the three shows its
   * sentence and at least one worked example in the preview column."* The
   * component renders `examples` as code chips and would render an empty list as
   * nothing, silently, which is why the count is asserted rather than assumed.
   */
  for (const note of chooserNotes()) {
    it(`${note.typeName} has a headline, a worked example and an execution sentence`, () => {
      expect(note.headline.length).toBeGreaterThan(0);
      expect(note.examples.length).toBeGreaterThan(0);
      expect(note.examples.every((example) => example.trim().length > 0)).toBe(true);
      expect(note.signals.length).toBeGreaterThan(0);
    });
  }

  it('gives Expression the one-liner the video was about', () => {
    expect(getChooserNote('Expression').examples).toContain('price * quantity');
  });

  /**
   * Expression is the one node of the three that is *not* signal-driven, and
   * that difference is the main reason a beginner picks wrong. The card has to
   * say so.
   */
  it('says Expression has no signal and recalculates on input change', () => {
    const signals = getChooserNote('Expression').signals.toLowerCase();
    expect(signals).toContain('no signal');
    expect(signals).toContain('input changes');
  });

  it('says the other two run on a signal', () => {
    expect(getChooserNote('Logic Builder').signals.toLowerCase()).toContain('send it a signal');
    // FIX-016 §3 — the Function's trigger is named, not left indefinite. It has
    // exactly one and cannot be given another, which is the fact a person
    // choosing between the three cannot otherwise learn until they need a second.
    expect(getChooserNote('JavaScriptFunction').signals.toLowerCase()).toContain('signal run');
  });
});

describe('LGC-001 §2 — the Function card must not assert a limit the node does not have', () => {
  /**
   * ⚠️ The row this suite exists for. Option (a) from the spec: **state the
   * capability**. Not "keep it to one in and one out" (option (b), which is
   * legitimate only if phrased as advice), and under no circumstances a bare
   * assertion that the node *has* one of each.
   */
  it('states that a Function can fire several signals when it is done', () => {
    const signals = getChooserNote('JavaScriptFunction').signals.toLowerCase();

    expect(signals).toContain('several');
    expect(signals).toContain('done');
  });

  /**
   * FIX-016 §3's positive half. The input side is the opposite of the output
   * side and the card has to carry both, so this row fails if a later edit
   * quietly restores the indefinite *"send it a signal"* — which reads as though
   * a second trigger could be declared.
   */
  it('names Run as the only trigger', () => {
    const signals = getChooserNote('JavaScriptFunction').signals.toLowerCase();

    expect(signals).toContain('run');
    expect(signals).toContain('only trigger');
  });

  it('mentions the many inputs and outputs the node actually has', () => {
    expect(getChooserNote('JavaScriptFunction').detail.toLowerCase()).toContain('many inputs and outputs');
  });

  /**
   * The negative, over the whole note rather than over the one field, because
   * the false claim would be just as false in the headline or in an example.
   *
   * These patterns are what "one signal in, one signal out" looks like when
   * someone writes it in a hurry. They are not an exhaustive grammar and are not
   * meant to be: the point is that an editor who reaches for the obvious phrasing
   * gets a red spec pointing at `javascriptnodeparser.js`.
   */
  it('nowhere claims the node fires only one output signal', () => {
    const note = getChooserNote('JavaScriptFunction');
    const text = [note.headline, note.detail, note.signals, ...note.examples].join(' ').toLowerCase();

    const forbidden = [
      /only one (output )?signal/,
      /one signal out/,
      /a single (output )?signal/,
      /one input signal and (one )?output signal/,
      /exactly one output signal/
    ];

    expect(forbidden.filter((pattern) => pattern.test(text))).toEqual([]);
  });

  /**
   * The control for the row above. A negative assertion over a regex list passes
   * trivially when the list is wrong, so this proves the list can actually fire.
   *
   * ⚠️ Both arms are stated, because FIX-016 §3 made the two halves differ: the
   * output limit is still forbidden, and the input limit is now *required* copy.
   * A control that only exercised the forbidden arm would no longer show that
   * the list has stopped catching the sentence the card is supposed to say.
   */
  it("the prohibition's patterns match the sentence they forbid, and spare the one now required", () => {
    const wrong = 'Runs when you send it a signal. It fires only one output signal.';
    expect(/only one (output )?signal/.test(wrong.toLowerCase())).toBe(true);

    const required = 'Runs when you signal Run — its only trigger — and can fire several signals when it is done.';
    const forbidden = [
      /only one (output )?signal/,
      /one signal out/,
      /a single (output )?signal/,
      /one input signal and (one )?output signal/,
      /exactly one output signal/
    ];
    expect(forbidden.filter((pattern) => pattern.test(required.toLowerCase()))).toEqual([]);
  });
});
