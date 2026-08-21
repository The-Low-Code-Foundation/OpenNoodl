/**
 * FIX-025 — the "Check my work" control says what it is looking for.
 *
 * Richard: *"'Check my work' button doesn't make sense, it seems to trigger all the signals in
 * the app but it's not clear when or why you should actually click it."*
 */
import { describeCondition, describeStepCheck } from '../../src/editor/src/views/lessons/lessonconditioncopy';

describe('describeStepCheck', () => {
  it('🔴 names the node the shipped lesson actually asks for', () => {
    // The exact condition from the installed "State on a page" lesson's last step.
    expect(describeStepCheck([{ node: '/#__page__/Home:#Caption', hasType: 'Text', path: '/#__page__/Home:#Caption', hastype: 'Text' }]))
      .toBe('Looking for a Text called “Caption” on Home.');
  });

  it('returns null when the step has nothing to grade — the control is then not drawn at all', () => {
    expect(describeStepCheck([])).toBeNull();
    expect(describeStepCheck(undefined)).toBeNull();
  });

  it('joins two conditions readably', () => {
    const line = describeStepCheck([
      { path: '/#__page__/Home:%Text', hastype: 'Text' },
      { path: '/#__page__/Home:%Variable2', hastype: 'Variable2' }
    ]);
    expect(line).toBe('Looking for a Text on Home and a Variable2 on Home.');
  });

  it('counts the tail rather than printing a paragraph', () => {
    const many = Array.from({ length: 6 }, (_, i) => ({ path: `/App:#N${i}`, hastype: 'Text' }));
    expect(describeStepCheck(many)).toMatch(/and 3 more\.$/);
  });

  it('🔴 an unrecognised verb degrades to a generic line, never to JSON at a beginner', () => {
    expect(describeCondition({ somethingNobodyHasWrittenCopyFor: true })).toBeNull();
    expect(describeStepCheck([{ somethingNobodyHasWrittenCopyFor: true }])).toBe(
      'Looking for the changes this step asks for.'
    );
  });

  it('describes a connection between two named nodes', () => {
    expect(
      describeCondition({ from: '/App:#Button', to: '/App:#Text', hasconnection: 'click,set' })
    ).toBe('Button wired to Text (click → set)');
  });
});
