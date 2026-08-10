/**
 * BLD-009 — the handoff between the two hosts.
 *
 * Small, and worth grading anyway: this module is the *only* thing standing
 * between "one thread instance" and the doubled activity feed the task file
 * warns about. Its three behaviours all have a failure mode that is silent on
 * screen — a listener that is not called leaves the Build panel painting into
 * the rail while the wide workspace shows an empty box, and nothing throws.
 */

import {
  expandedContainer,
  onExpandedContainerChanged,
  resetExpandedHostForTests,
  setExpandedContainer
} from '../../src/editor/src/views/documents/ExpandedBuildDocument/expandedBuildHost';

/** A stand-in for the document's box. Nothing here touches the DOM. */
const node = (name: string) => ({ name }) as unknown as HTMLElement;

describe('BLD-009 the expanded surface registry', () => {
  beforeEach(() => resetExpandedHostForTests());

  it('starts empty — the rail is the default host', () => {
    expect(expandedContainer()).toBeNull();
  });

  it('hands the current box to a panel that asks after the fact', () => {
    // ⚠️ The reason `expandedContainer()` exists at all rather than only the
    // subscription: the Build panel can remount underneath a live document (the
    // sidebar's error-boundary retry and its hot reload both do it), and an
    // event that has already fired will not fire again.
    const box = node('surface');
    setExpandedContainer(box);
    expect(expandedContainer()).toBe(box);
  });

  it('tells subscribers when the surface appears and when it goes', () => {
    const seen: (HTMLElement | null)[] = [];
    onExpandedContainerChanged(() => seen.push(expandedContainer()));

    const box = node('surface');
    setExpandedContainer(box);
    setExpandedContainer(null);

    expect(seen).toEqual([box, null]);
  });

  it('says nothing when the surface has not actually changed', () => {
    // A ref callback fires on every commit React decides to make, and a panel
    // that re-rendered on each of them would re-run the portal for no reason.
    const box = node('surface');
    setExpandedContainer(box);

    let calls = 0;
    onExpandedContainerChanged(() => (calls += 1));
    setExpandedContainer(box);
    expect(calls).toBe(0);

    setExpandedContainer(node('another'));
    expect(calls).toBe(1);
  });

  it('stops calling a listener that has unsubscribed', () => {
    let calls = 0;
    const off = onExpandedContainerChanged(() => (calls += 1));
    setExpandedContainer(node('a'));
    expect(calls).toBe(1);

    off();
    setExpandedContainer(node('b'));
    expect(calls).toBe(1);
  });
});
