/**
 * DEF-025 — what a brand-new toggle arrives with.
 *
 * Richard's ruling (2026-08-30) is "flip at **creation**, in **both** doors":
 * a newly placed `Checkbox` / `Radio Button` is authored `useLabel: true`, so
 * new work gets a control whose words are a real `<label for>` click target,
 * while nothing already on disk moves.
 *
 * The wiring (two editor creation call sites, the MCP funnel) is graded
 * elsewhere. What is graded here is the decision itself — including the guards
 * whose failure modes are **silent**: a default that overwrites an explicit
 * choice, and a default that reaches a node nobody just created.
 *
 * @module noodl-editor/tests-unit/def-025/creation-defaults
 */
import {
  LABEL_TARGET_CONTROLS,
  planCreationDefaults,
  typesWithCreationDefaults
} from '@noodl-models/nodeSeed/newNodeSeed';

const CHECKBOX = 'net.noodl.controls.checkbox';
const RADIO = 'net.noodl.controls.radiobutton';

describe('planCreationDefaults', () => {
  it('gives a brand-new Checkbox its own label as the click target', () => {
    expect(planCreationDefaults(CHECKBOX, { parameters: {} })).toEqual([{ parameter: 'useLabel', value: true }]);
  });

  it('gives a brand-new Radio Button the same', () => {
    expect(planCreationDefaults(RADIO, { parameters: {} })).toEqual([{ parameter: 'useLabel', value: true }]);
  });

  it('works on a node whose parameters bag is absent entirely', () => {
    expect(planCreationDefaults(CHECKBOX, {})).toHaveLength(1);
  });

  it('leaves every other node type alone', () => {
    // Text Input and Options share the `useLabel: false` default and are
    // deliberately NOT in the set — the design system's own `field` puts a
    // separate label Text above them on purpose.
    for (const type of [
      'Group',
      'Text',
      'JavaScriptFunction',
      'net.noodl.controls.button',
      'net.noodl.controls.textinput',
      'net.noodl.controls.options'
    ]) {
      expect(planCreationDefaults(type, { parameters: {} })).toEqual([]);
    }
  });

  it('🔴 never overrides an explicit useLabel: false', () => {
    // The silent-correction guard. A door that "fixes" a caller who said what
    // they wanted is worse than one with no default at all: the bare box is a
    // legitimate thing to ask for, and an author who asked twice would still
    // not get it.
    expect(planCreationDefaults(CHECKBOX, { parameters: { useLabel: false } })).toEqual([]);
  });

  it('leaves an explicit useLabel: true alone rather than rewriting it', () => {
    expect(planCreationDefaults(CHECKBOX, { parameters: { useLabel: true } })).toEqual([]);
  });

  it('does not touch any parameter other than useLabel', () => {
    // The label text is NOT authored here on purpose: the port's own default
    // ('Label') renders as a visible placeholder the author replaces, and
    // writing a second copy of that string into every new node's bag would put
    // the product's placeholder on disk in 178 projects' worth of graphs.
    const writes = planCreationDefaults(CHECKBOX, { parameters: {} });
    expect(writes.map((w) => w.parameter)).toEqual(['useLabel']);
  });

  it('🔴 the set the door fills IS the set the rule watches', () => {
    // The drift guard, and the reason the list has one home. If a control ever
    // joins one side only, the product either warns about its own output or
    // ships a control the rule has stopped watching.
    expect(typesWithCreationDefaults().sort()).toEqual([...LABEL_TARGET_CONTROLS.keys()].sort());
    expect(typesWithCreationDefaults().sort()).toEqual([CHECKBOX, RADIO].sort());
  });
});
