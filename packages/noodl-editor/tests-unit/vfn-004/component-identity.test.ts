/**
 * VFN-004, the defect that survived the build — **the tab was keyed on a field most components
 * do not have.**
 *
 * The feature shipped, was merged, and did nothing in the running editor: the away mark never
 * appeared and clicking the tab neither navigated nor selected. Every layer was individually
 * correct — the event fired, the derivation was live, `isTabAway` was right in all three
 * polarities — and the field they all agreed on, `ComponentModel.id`, was `undefined`.
 *
 * Measured on three unrelated **v1** legacy projects (`vfn64-drive`, `lgc010-drive`, `lgc002-qa`):
 * **2 of 7 components carried an id.** A v2 project assigns all of them; v1 assigns whichever
 * happened to get one, and `ProjectImporter` deliberately refuses to fabricate the key.
 *
 * 🔴 **Why the existing suite could not catch it.** Every tab in `tab-location.test.ts` supplies a
 * `componentId`, because the author reasonably assumed components have ids. The absent-id case was
 * not a missing assertion, it was a missing *input* — so the first block below is the reproduction,
 * and it is written against the **old** keying so that it fails the way the editor failed.
 *
 * 🔴 **On negative controls.** A suite of absences is indistinguishable from an instrument that
 * measured nothing. Each block here pairs the fixed behaviour with the pre-fix behaviour computed
 * on the same fixtures in the same test, so a green run means the two are *different*, not merely
 * that the new one returned something.
 */
import { componentInstanceId, hasComponentInstanceId } from '../../src/editor/src/models/componentIdentity';
import { isTabAway, tabActivation, type TabLocation } from '../../src/editor/src/views/CanvasTabs/tabLocation';

/**
 * A component as a **v1** project actually loads it: a name, a graph, and no `id` key at all.
 * `ComponentModel` itself is not constructed here — it drags in `NodeLibrary` and `ProjectModel`,
 * neither of which the plain-Node runner can load — but the only property under test is the one
 * this shape gets right, which is the absence.
 */
function v1Component(name: string) {
  return { name, graph: { roots: [], connections: [] } } as { name: string; id?: string; graph: unknown };
}

/** A component as a v2 project loads it — the case that always worked. */
function v2Component(name: string, id: string) {
  return { name, id, graph: { roots: [], connections: [] } };
}

describe('VFN-004 — the reproduction: keying on `component.id` on a v1 project', () => {
  it('🔴 the old key is `undefined` for a v1 component, which is the whole defect', () => {
    const ergCodes = v1Component('/ErgCodes');
    const app = v1Component('/App');

    // This is verbatim what `LogicBuilderWorkspaceType` used to do.
    expect(ergCodes.id).toBeUndefined();
    expect(app.id).toBeUndefined();
  });

  it('⭐ 🔴 with the old key the tab is NEVER away — the mark the drive went looking for', () => {
    const ergCodes = v1Component('/ErgCodes');
    const app = v1Component('/App');

    // The tab belongs to /ErgCodes; the canvas has been navigated to /App. Demonstrably away.
    const tabOldKey: TabLocation = { nodeName: 'c6', componentId: ergCodes.id };
    const activeOldKey = app.id;

    // `isTabAway` is correct — an absence of knowledge must not be published as an assertion.
    // It is the *input* that is wrong, and the result is a feature that is silently dead.
    expect(isTabAway(tabOldKey, activeOldKey)).toBe(false);

    // And the click falls through to the refusal rather than navigating.
    expect(tabActivation(tabOldKey, { componentExists: false, activeComponentId: activeOldKey })).toBe(
      'refuse-unknown'
    );
  });

  it('⭐ with the session identity the same two components are away, and the click navigates', () => {
    const ergCodes = v1Component('/ErgCodes');
    const app = v1Component('/App');

    const tab: TabLocation = { nodeName: 'c6', componentId: componentInstanceId(ergCodes) };
    const active = componentInstanceId(app);

    expect(isTabAway(tab, active)).toBe(true);
    expect(tabActivation(tab, { componentExists: true, activeComponentId: active })).toBe('navigate');
  });

  it('and standing on the tab’s own component is still "home", not a false away mark', () => {
    const ergCodes = v1Component('/ErgCodes');

    const tab: TabLocation = { nodeName: 'c6', componentId: componentInstanceId(ergCodes) };
    const active = componentInstanceId(ergCodes);

    expect(isTabAway(tab, active)).toBe(false);
    expect(tabActivation(tab, { componentExists: true, activeComponentId: active })).toBe('select');
  });
});

describe('VFN-004 — the identity itself', () => {
  it('is stable: asking twice returns the same string and mints only once', () => {
    const component = v1Component('/ErgCodes');

    expect(hasComponentInstanceId(component)).toBe(false);
    const first = componentInstanceId(component);
    expect(hasComponentInstanceId(component)).toBe(true);
    const second = componentInstanceId(component);

    expect(first).toBe(second);
  });

  it('⭐ distinguishes two components that a v1 project gives nothing else to tell apart', () => {
    // Same shape, same absent id, and — the case that makes name-keying tempting and wrong —
    // the same display name in two different folders.
    const adminHome = v1Component('/Admin/Home');
    const publicHome = v1Component('/Pages/Home');

    expect(componentInstanceId(adminHome)).not.toBe(componentInstanceId(publicHome));
  });

  it('works the same for a v2 component, so there is one code path and not two', () => {
    const a = v2Component('/App', 'eeee-0000-0000-0000-000000000017');
    const b = v2Component('/Item', 'eeee-0000-0000-0000-000000000021');

    expect(componentInstanceId(a)).not.toBe(componentInstanceId(b));
    expect(componentInstanceId(a)).toBe(componentInstanceId(a));
  });

  it('🔴 is NOT the persisted id — it must never be mistaken for one', () => {
    const withId = v2Component('/App', 'eeee-0000-0000-0000-000000000017');
    expect(componentInstanceId(withId)).not.toBe(withId.id);
  });

  it('returns undefined for a missing component, leaving the "never away without a key" guard something to guard', () => {
    expect(componentInstanceId(undefined)).toBeUndefined();
    expect(componentInstanceId(null)).toBeUndefined();

    // Which is the one case where the pre-fix behaviour is still the right behaviour.
    expect(isTabAway({ nodeName: 'c6', componentId: undefined }, 'component-1')).toBe(false);
  });

  it('is rename-proof — the trap that ruled out keying on fullName', () => {
    const component = v1Component('/ErgCodes');
    const before = componentInstanceId(component);

    component.name = '/Codes';

    expect(componentInstanceId(component)).toBe(before);
  });
});

describe('VFN-004 — the identity is never written to disk', () => {
  /**
   * 🔴 This is the block that keeps DSG-007's ruling true. `ProjectIdentity.test.ts` enforces that
   * opening a legacy project mints nothing, on the argument that two copies of one project would
   * otherwise diverge silently — and copying a project directory is a routine gesture here.
   * Because the identity lives in a `WeakMap` keyed on the model, there is no own property to
   * serialise, so the invariant is structural rather than a promise.
   */
  it('⭐ adds no own property — Object.keys is unchanged after minting', () => {
    const component = v1Component('/ErgCodes');
    const before = Object.keys(component).sort();

    componentInstanceId(component);

    expect(Object.keys(component).sort()).toEqual(before);
  });

  it('⭐ leaves the serialised form byte-identical', () => {
    const component = v1Component('/ErgCodes');
    const before = JSON.stringify(component);

    componentInstanceId(component);

    expect(JSON.stringify(component)).toBe(before);
    // And in particular it did not acquire the key the importer refuses to fabricate.
    expect(Object.prototype.hasOwnProperty.call(component, 'id')).toBe(false);
  });

  it('⭐ two disk copies of one project cannot disagree, because neither writes anything', () => {
    // The divergence DSG-007 forbids: `vfn64-drive` is a disk copy of `vfn64-qa`. Open both and
    // each mints its own identity — but nothing reaches either file, so the two directories stay
    // identical and `ProjectMerge`'s `id ?? name` keying is untouched.
    const original = v1Component('/ErgCodes');
    const copy = v1Component('/ErgCodes');

    componentInstanceId(original);
    componentInstanceId(copy);

    expect(JSON.stringify(original)).toBe(JSON.stringify(copy));
  });
});

describe('VFN-004 — the negative controls', () => {
  /**
   * Each expectation above discriminates only if the pre-fix implementation fails it. These are
   * that failure, stated: the old key computed on the same fixtures, watched going the wrong way.
   */
  const oldKey = (component: { id?: string }) => component.id;

  it('🔴 the old key cannot distinguish two v1 components — the fixed one can', () => {
    const a = v1Component('/Admin/Home');
    const b = v1Component('/Pages/Home');

    // Indistinguishable: both `undefined`.
    expect(oldKey(a)).toBe(oldKey(b));
    // Distinguishable.
    expect(componentInstanceId(a)).not.toBe(componentInstanceId(b));
  });

  it('🔴 the old key never produces an away mark on a v1 project, in either direction', () => {
    const tabComponent = v1Component('/ErgCodes');
    const others = ['/App', '/ErgFail', '/ErgRest', '/ErgRig'].map(v1Component);

    for (const other of others) {
      expect(isTabAway({ nodeName: 'c6', componentId: oldKey(tabComponent) }, oldKey(other))).toBe(false);
      expect(isTabAway({ nodeName: 'c6', componentId: componentInstanceId(tabComponent) }, componentInstanceId(other))).toBe(
        true
      );
    }
  });

  it('🔴 a name-derived key would survive the away test and fail the rename test', () => {
    // The option that was rejected, exercised so the rejection is graded rather than asserted.
    const nameKey = (component: { name: string }) => component.name;
    const component = v1Component('/ErgCodes');

    const beforeName = nameKey(component);
    const beforeIdentity = componentInstanceId(component);

    component.name = '/Codes';

    expect(nameKey(component)).not.toBe(beforeName); // the tab would be orphaned
    expect(componentInstanceId(component)).toBe(beforeIdentity); // the tab follows
  });
});
