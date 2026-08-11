/**
 * SIG-003 §3 — the order of the headings, and the tier that did not exist.
 *
 * Before this task the popup ordered groups in two passes: float each entry of
 * `groupPriority` to the top one at a time, then splice `Other` to the end. A
 * group the priority list did not name kept whatever position it happened to be
 * built in — a fact already recorded in source at `text-input.ts:45`, about `Run
 * On Value Change`. So a heading's place was a property of declaration order in
 * a node file, and nothing said so.
 *
 * The cases below are the three tiers, and the acceptance node is the reported
 * one: a String variable, whose four load-bearing ports were the whole of
 * SIG-003's complaint.
 */

import {
  DEFAULT_GROUP_PRIORITY,
  orderGroups,
  OTHER_GROUP
} from '../../src/editor/src/views/ConnectionPopup/refusalPlan';

function groups(...names: string[]) {
  return names.map((name) => ({ name }));
}

function ordered(names: string[], priority: readonly string[]): string[] {
  return orderGroups(groups(...names), priority).map((g) => g.name);
}

describe('orderGroups', () => {
  it('puts groups named in the priority list first, in that order', () => {
    expect(ordered(['Events', 'Actions', 'General'], ['General', 'Actions', 'Events'])).toEqual([
      'General',
      'Actions',
      'Events'
    ]);
  });

  it('sorts a group the priority list does not name alphabetically, not by build order', () => {
    // ⚠️ The input order here is the failure mode: fed to the old sort, these
    // three came out exactly as declared, because no pass ever touched them.
    expect(ordered(['Style', 'Alignment', 'Placement'], ['General'])).toEqual(['Alignment', 'Placement', 'Style']);
  });

  it('keeps every named group above every unnamed one', () => {
    expect(ordered(['Alignment', 'Events', 'Style', 'General'], ['General', 'Events'])).toEqual([
      'General',
      'Events',
      'Alignment',
      'Style'
    ]);
  });

  it('puts Other last even when the priority list names it', () => {
    expect(ordered(['Other', 'Style', 'General'], [OTHER_GROUP, 'General'])).toEqual(['General', 'Style', OTHER_GROUP]);
  });

  it('puts Other last even when it would sort first alphabetically among unnamed groups', () => {
    // 'Other' < 'Style' by `localeCompare`, so the alphabetical tier alone
    // would float it above a real heading.
    expect(ordered(['Style', 'Other'], ['General'])).toEqual(['Style', OTHER_GROUP]);
  });

  it('does not mutate the array it is given', () => {
    const input = groups('Events', 'General');
    orderGroups(input, ['General', 'Events']);
    expect(input.map((g) => g.name)).toEqual(['Events', 'General']);
  });

  it('is stable for an empty priority list — everything is one alphabetical tier', () => {
    expect(ordered(['Style', 'Actions', 'Events'], [])).toEqual(['Actions', 'Events', 'Style']);
  });
});

describe('DEFAULT_GROUP_PRIORITY', () => {
  it('leads with the three kind headings after General', () => {
    // The vocabulary SIG-003 §2 settled on: a value is a thing that is, a
    // signal input is an Action you cause, a signal output is an Event that
    // happened. Their relative order is the teaching claim — you act before
    // something happens — and the old default had Events above Actions.
    expect(DEFAULT_GROUP_PRIORITY.slice(0, 4)).toEqual(['General', 'Values', 'Actions', 'Events']);
  });

  it('does not name a retired group', () => {
    for (const retired of ['Value', 'Signals', 'Changed Events']) {
      expect(DEFAULT_GROUP_PRIORITY).not.toContain(retired);
    }
  });

  it('orders a String variable so nothing lands in Other', () => {
    /*
     * The acceptance case, and the reported one. Every group name here is read
     * off the node's own declarations after SIG-003 §1: `Values` (Value in),
     * `Actions` (Set), `Advanced` (Treat empty as) and `Run On Value Change`,
     * which no priority list names and which therefore lands in the
     * alphabetical tier rather than wherever it was built.
     */
    const stringVariableInputs = ['Run On Value Change', 'Advanced', 'Actions', 'Values'];

    expect(ordered(stringVariableInputs, DEFAULT_GROUP_PRIORITY)).toEqual([
      'Values',
      'Actions',
      'Advanced',
      'Run On Value Change'
    ]);
    expect(ordered(stringVariableInputs, DEFAULT_GROUP_PRIORITY)).not.toContain(OTHER_GROUP);
  });

  it('orders a String variable\'s outputs as Values then Events', () => {
    expect(ordered(['Events', 'Values'], DEFAULT_GROUP_PRIORITY)).toEqual(['Values', 'Events']);
  });
});
