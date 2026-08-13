/**
 * VFN-004 — *"if you navigate away from the node canvas to another component, the logic editor
 * stays there … it could be confusing, unless we maybe label the logic editor top left tab with
 * the name of the component it lives in? Or have a way of getting back to the logic node the
 * editor is part of?"*
 *
 * The window staying open is the ruling. What is graded here is the three things that make it
 * honest: the tab says which component it came from, it says when that component is not the one
 * on screen, and clicking it decides correctly between going there, selecting in place, and
 * refusing out loud.
 *
 * All three are pure functions of (tab, active component id), which is why they can be graded at
 * all — the window they are rendered in needs Electron and react-dom, and neither runner has both.
 *
 * 🔴 **On negative controls.** A suite of absences is indistinguishable from an instrument that
 * measured nothing, and this feature's whole subject is a thing that is *sometimes* there. Every
 * predicate below is therefore asserted in **both** polarities, and the last block states the
 * controls explicitly: each of those expectations fails against a constant implementation of the
 * function it exercises. A green run means the instrument discriminates, not merely that it ran.
 */
import {
  COMPONENT_LABEL_MAX_CHARS,
  componentGoneMessage,
  componentLabelsFor,
  componentUnknownMessage,
  isTabAway,
  LABEL_SEPARATOR,
  tabActivation,
  tabLabel,
  tabLabelSegments,
  tabLocationRefresh,
  tabTooltip,
  truncateWithEllipsis,
  UNNAMED_NODE,
  type TabLocation
} from '../../src/editor/src/views/CanvasTabs/tabLocation';

/** A Visual Function on the dashboard. */
const discountRules: TabLocation = {
  nodeName: 'Discount rules',
  componentId: 'component-dashboard',
  componentName: 'Sales dashboard',
  componentPath: '/Pages/Sales dashboard'
};

/** A second tab, in a different component — AC 5's pair. */
const shippingRules: TabLocation = {
  nodeName: 'Shipping rules',
  componentId: 'component-checkout',
  componentName: 'Checkout',
  componentPath: '/Pages/Checkout'
};

/** A tab opened before this feature existed: it has a node, but no idea where the node lives. */
const locationless: TabLocation = { nodeName: 'Discount rules' };

describe('VFN-004 — the tab reads Component · Node', () => {
  it('names the component first and the node second (AC 1)', () => {
    expect(tabLabel(discountRules)).toBe('Sales dashboard · Discount rules');
  });

  it('does not spend the tab on the window’s own name', () => {
    // The window is already `aria-label="Logic Builder"` and its title bar is two pixels away.
    // A tab that repeats it has no width left for the answer, which is the whole complaint.
    expect(tabLabel(discountRules)).not.toContain('Logic Builder');
  });

  it('falls back to the node alone when the component is unknown — no dangling separator', () => {
    expect(tabLabel(locationless)).toBe('Discount rules');
    expect(tabLabel(locationless)).not.toContain(LABEL_SEPARATOR.trim());
  });

  it('names an unlabelled node rather than rendering a bare separator', () => {
    expect(tabLabel({ ...discountRules, nodeName: undefined })).toBe(`Sales dashboard · ${UNNAMED_NODE}`);
    expect(tabLabel({ ...discountRules, nodeName: '   ' })).toBe(`Sales dashboard · ${UNNAMED_NODE}`);
  });

  it('prefers a freshly resolved component name over the snapshot the tab is holding', () => {
    // 🔴 The point of navigating by id: a rename must show up in the label without the tab having
    // to be reopened, and must never be what "go back" depends on.
    expect(tabLabel(discountRules, { componentName: 'Revenue dashboard' })).toBe('Revenue dashboard · Discount rules');
  });

  it('tells two tabs in different components apart from the labels alone (AC 5)', () => {
    expect(tabLabel(discountRules)).not.toBe(tabLabel(shippingRules));
    expect(tabLabel(discountRules)).toContain('Sales dashboard');
    expect(tabLabel(shippingRules)).toContain('Checkout');
  });
});

describe('VFN-004 — two open tabs are told apart by their labels (AC 5)', () => {
  /** `/Admin/Home` and `/Pages/Home` — one project, two Homes, and both have blocks open. */
  const adminHome: TabLocation = {
    nodeName: 'Discount rules',
    componentId: 'component-admin-home',
    componentName: 'Home',
    componentPath: '/Admin/Home'
  };
  const publicHome: TabLocation = {
    nodeName: 'Shipping rules',
    componentId: 'component-public-home',
    componentName: 'Home',
    componentPath: '/Pages/Home'
  };

  it('keeps the short name when nothing collides', () => {
    expect(componentLabelsFor([discountRules, shippingRules])).toEqual(['Sales dashboard', 'Checkout']);
  });

  it('🔴 falls back to the full path when two tabs collide on the display name', () => {
    // Two tabs reading `Home · …` do not answer "which Home?", which is the question this whole
    // task exists to answer.
    expect(componentLabelsFor([adminHome, publicHome])).toEqual(['/Admin/Home', '/Pages/Home']);
  });

  it('does not treat two tabs in the SAME component as a collision', () => {
    // Two Visual Functions on one page is the ordinary case. Telling those two apart is the node
    // segment's job, and paying a full path for it would be a permanent tax on the common case.
    const sibling: TabLocation = { ...discountRules, nodeName: 'Tax rules' };

    expect(componentLabelsFor([discountRules, sibling])).toEqual(['Sales dashboard', 'Sales dashboard']);
  });

  it('resolves the collision in the rendered label, not merely in the data', () => {
    const labels = componentLabelsFor([adminHome, publicHome]);

    const rendered = [
      tabLabel(adminHome, { componentName: labels[0] }),
      tabLabel(publicHome, { componentName: labels[1] })
    ];

    expect(rendered[0]).not.toBe(rendered[1]);
    expect(rendered[0]).toContain('/Admin/Home');
  });

  it('keeps the short name when a colliding tab has no path to fall back to', () => {
    // Better an ambiguous label than a blank one; the tooltip and the away mark still work.
    const pathless: TabLocation = { ...publicHome, componentPath: undefined };

    expect(componentLabelsFor([adminHome, pathless])).toEqual(['/Admin/Home', 'Home']);
  });

  it('says nothing for a tab that does not know where it belongs', () => {
    expect(componentLabelsFor([locationless, discountRules])).toEqual([undefined, 'Sales dashboard']);
  });

  it('handles no tabs at all', () => {
    expect(componentLabelsFor([])).toEqual([]);
  });
});

describe('VFN-004 — the component side truncates, the node side does not', () => {
  it('shortens to the limit *including* the ellipsis', () => {
    expect(truncateWithEllipsis('abcdefghij', 5)).toBe('abcd…');
    expect(truncateWithEllipsis('abcdefghij', 5)).toHaveLength(5);
  });

  it('leaves a string that already fits completely alone', () => {
    expect(truncateWithEllipsis('abc', 5)).toBe('abc');
    expect(truncateWithEllipsis('abcde', 5)).toBe('abcde');
  });

  it('truncates the component and never the node (AC 1)', () => {
    const long: TabLocation = {
      ...discountRules,
      componentName: 'Quarterly sales and revenue dashboard',
      nodeName: 'A rather long discount rule name'
    };

    const segments = tabLabelSegments(long, { maxComponentChars: 12 });

    expect(segments.component).toBe('Quarterly s…');
    expect(segments.componentTruncated).toBe(true);
    // The node is the more specific half and is what tells two open tabs apart, so it keeps its
    // width whatever happens to the component.
    expect(segments.node).toBe('A rather long discount rule name');
  });

  it('reports truncation honestly in both directions', () => {
    expect(tabLabelSegments(discountRules, { maxComponentChars: 100 }).componentTruncated).toBe(false);
    expect(tabLabelSegments(discountRules, { maxComponentChars: 4 }).componentTruncated).toBe(true);
  });

  it('has a default limit that actually limits', () => {
    const overlong = 'x'.repeat(COMPONENT_LABEL_MAX_CHARS + 20);
    const segments = tabLabelSegments({ ...discountRules, componentName: overlong });

    expect(segments.component).toHaveLength(COMPONENT_LABEL_MAX_CHARS);
    expect(segments.component.endsWith('…')).toBe(true);
  });
});

describe('VFN-004 — the away mark says the graph on screen is not this tab’s', () => {
  it('is absent while the canvas shows the tab’s own component (AC 4)', () => {
    expect(isTabAway(discountRules, 'component-dashboard')).toBe(false);
  });

  it('is present while the canvas shows a different component (AC 4)', () => {
    expect(isTabAway(discountRules, 'component-checkout')).toBe(true);
  });

  it('is present when no component is open at all', () => {
    // Nothing on the canvas is certainly not this tab's component.
    expect(isTabAway(discountRules, undefined)).toBe(true);
    expect(isTabAway(discountRules, null)).toBe(true);
  });

  it('🔴 never marks a tab that does not know where it belongs', () => {
    // An absence of knowledge must not be published as an assertion: a tab opened before this
    // field existed would otherwise wear a permanent "you are elsewhere" mark that no navigation
    // could ever clear.
    expect(isTabAway(locationless, 'component-dashboard')).toBe(false);
    expect(isTabAway(locationless, 'component-checkout')).toBe(false);
    expect(isTabAway(locationless, undefined)).toBe(false);
  });

  it('marks exactly one of two tabs when the canvas is on one of their components', () => {
    expect(isTabAway(discountRules, 'component-dashboard')).toBe(false);
    expect(isTabAway(shippingRules, 'component-dashboard')).toBe(true);
  });
});

describe('VFN-004 — what clicking the tab does', () => {
  it('navigates when the canvas is on another component (AC 2)', () => {
    expect(tabActivation(discountRules, { componentExists: true, activeComponentId: 'component-checkout' })).toBe(
      'navigate'
    );
  });

  it('selects without navigating when already on that component (AC 3)', () => {
    expect(tabActivation(discountRules, { componentExists: true, activeComponentId: 'component-dashboard' })).toBe(
      'select'
    );
  });

  it('navigates when no component is open', () => {
    expect(tabActivation(discountRules, { componentExists: true, activeComponentId: undefined })).toBe('navigate');
  });

  it('refuses when the component has been deleted out from under the tab (AC 6)', () => {
    expect(tabActivation(discountRules, { componentExists: false, activeComponentId: 'component-checkout' })).toBe(
      'refuse-missing'
    );
  });

  it('a deleted component is a refusal even when it was the last thing open', () => {
    // The id can still match while the component is gone — the canvas has not been told yet.
    expect(tabActivation(discountRules, { componentExists: false, activeComponentId: 'component-dashboard' })).toBe(
      'refuse-missing'
    );
  });

  it('refuses differently when the tab never recorded where it came from', () => {
    // Two different failures with two different things to say. Collapsing them would tell a user
    // whose component is intact that it has been deleted.
    expect(tabActivation(locationless, { componentExists: false, activeComponentId: 'component-dashboard' })).toBe(
      'refuse-unknown'
    );
  });
});

describe('VFN-004 — the refusal is out loud and by name (AC 6)', () => {
  it('names the component that is gone', () => {
    expect(componentGoneMessage(discountRules)).toContain('/Pages/Sales dashboard');
  });

  it('says the blocks stay, because the alternative reading is the wrong one', () => {
    // 🔴 This feature has already shipped a refusal that published its silence. The rule that came
    // out of it is to ask what a refusal *writes* — and what this one writes has to answer "so is
    // my program about to disappear?", because that is what a builder will assume.
    expect(componentGoneMessage(discountRules)).toContain('stay open');
  });

  it('still says something when the tab has no name to offer', () => {
    const message = componentGoneMessage({ nodeName: 'Discount rules' });

    expect(message).not.toContain('undefined');
    expect(message).toContain('no longer in this project');
  });

  it('falls back to the display name when there is no path', () => {
    expect(componentGoneMessage({ componentId: 'x', componentName: 'Checkout' })).toContain('Checkout');
  });

  it('the unknown-location refusal names the node and says how to fix it', () => {
    const message = componentUnknownMessage(locationless);

    expect(message).toContain('Discount rules');
    expect(message).toContain('reopen');
  });

  it('the unknown-location refusal survives a nameless node', () => {
    expect(componentUnknownMessage({})).toContain(UNNAMED_NODE);
  });
});

describe('VFN-004 — the tooltip carries the away state in words', () => {
  it('states the full path rather than the truncated label', () => {
    const overlong = { ...discountRules, componentName: 'x'.repeat(COMPONENT_LABEL_MAX_CHARS + 20) };

    expect(tabTooltip(overlong)).toContain('/Pages/Sales dashboard');
    expect(tabTooltip(overlong)).not.toContain('…');
  });

  it('prefers the freshly resolved path over the snapshot', () => {
    // Same rule as the label: the snapshot is the fallback for a component the project can no
    // longer answer for, not the source of truth for one that is still there.
    expect(tabTooltip(discountRules, { component: '/Pages/Revenue dashboard' })).toContain('/Pages/Revenue dashboard');
  });

  it('🔴 tells apart two components sharing a last path segment even when only one tab is open', () => {
    // `componentLabelsFor` lengthens the *label* only when both tabs are open, because it can
    // only see the tabs. The tooltip always carries the path, so a single open tab in one of two
    // "Home" components is still unambiguous to anyone who asks.
    const adminHome: TabLocation = {
      nodeName: 'Discount rules',
      componentId: 'a',
      componentName: 'Home',
      componentPath: '/Admin/Home'
    };
    const publicHome: TabLocation = { ...adminHome, componentId: 'b', componentPath: '/Pages/Home' };

    expect(tabLabel(adminHome)).toBe(tabLabel(publicHome));
    expect(tabTooltip(adminHome)).not.toBe(tabTooltip(publicHome));
  });

  it('says where you are, differently, in each state', () => {
    const home = tabTooltip(discountRules, { away: false });
    const elsewhere = tabTooltip(discountRules, { away: true });

    expect(home).not.toBe(elsewhere);
    expect(elsewhere).toContain('another component');
    expect(home).not.toContain('another component');
  });

  it('degrades to the node alone when the component is unknown', () => {
    expect(tabTooltip(locationless)).toBe('Blocks for Discount rules');
  });
});

describe('VFN-004 — reopening the blocks refreshes where the tab says it belongs', () => {
  it('writes back a name that has changed', () => {
    const refreshed = tabLocationRefresh(discountRules, { componentName: 'Revenue dashboard' });

    expect(refreshed).toEqual({ componentName: 'Revenue dashboard' });
  });

  it('reports "nothing to do" when every supplied field already matches', () => {
    // The caller hands React the same array back on `undefined`, which is what stops a reopen of
    // an unchanged tab from re-rendering the mounted Blockly workspaces underneath it.
    expect(tabLocationRefresh(discountRules, { componentName: 'Sales dashboard' })).toBeUndefined();
    expect(tabLocationRefresh(discountRules, {})).toBeUndefined();
  });

  it('never carries the workspace, however loudly it is offered', () => {
    // 🔴 The tab is AHEAD of the model, not behind it: an edit reaches the node 300 ms after it
    // settles, so copying the model's workspace over the tab would eat the last few seconds of
    // whatever the author just built.
    const refreshed = tabLocationRefresh(discountRules, {
      nodeName: 'Renamed',
      workspace: 'the model’s stale copy'
    } as never);

    expect(refreshed).toEqual({ nodeName: 'Renamed' });
    expect(refreshed).not.toHaveProperty('workspace');
  });

  it('lets a caller that predates these fields leave them alone', () => {
    // `undefined` is "I did not say", not "clear it". An older emitter must not be able to erase
    // a location a newer one recorded.
    expect(tabLocationRefresh(discountRules, { componentId: undefined, componentName: undefined })).toBeUndefined();
  });

  it('teaches a locationless tab where it belongs', () => {
    expect(tabLocationRefresh(locationless, discountRules)).toEqual({
      nodeName: 'Discount rules',
      componentId: 'component-dashboard',
      componentName: 'Sales dashboard',
      componentPath: '/Pages/Sales dashboard'
    });
  });
});

/**
 * 🔴 The negative controls, stated rather than implied.
 *
 * Each expectation here fails against a *constant* implementation of the function it exercises —
 * the shape a stub, a half-finished refactor or a deleted body would leave. Their job is to make
 * a green run mean "the instrument discriminates", not "the instrument ran".
 */
describe('VFN-004 — negative controls', () => {
  it('control: an `isTabAway` that always answers the same thing cannot pass', () => {
    const answers = [
      isTabAway(discountRules, 'component-dashboard'), // false — standing on it
      isTabAway(discountRules, 'component-checkout'), // true  — elsewhere
      isTabAway(locationless, 'component-checkout') // false — does not know
    ];

    expect(answers).toEqual([false, true, false]);
    expect(new Set(answers).size).toBe(2);
  });

  it('control: a `tabActivation` that always answers the same thing cannot pass', () => {
    const answers = [
      tabActivation(discountRules, { componentExists: true, activeComponentId: 'component-checkout' }),
      tabActivation(discountRules, { componentExists: true, activeComponentId: 'component-dashboard' }),
      tabActivation(discountRules, { componentExists: false, activeComponentId: 'component-dashboard' }),
      tabActivation(locationless, { componentExists: true, activeComponentId: 'component-dashboard' })
    ];

    expect(answers).toEqual(['navigate', 'select', 'refuse-missing', 'refuse-unknown']);
    // All four outcomes are reachable, so no branch is dead and none is a synonym for another.
    expect(new Set(answers).size).toBe(4);
  });

  it('control: a label builder that ignores its input cannot pass', () => {
    const labels = [tabLabel(discountRules), tabLabel(shippingRules), tabLabel(locationless)];

    expect(new Set(labels).size).toBe(3);
    // And it is not merely echoing the node name back — the component half has to be in there.
    expect(labels[0]).not.toBe(discountRules.nodeName);
  });

  it('control: a truncator that returns its input cannot pass', () => {
    expect(truncateWithEllipsis('abcdefghij', 5)).not.toBe('abcdefghij');
    expect(truncateWithEllipsis('abc', 5)).toBe('abc');
  });

  it('control: a refusal builder that returns one fixed sentence cannot pass', () => {
    const messages = [
      componentGoneMessage(discountRules),
      componentGoneMessage(shippingRules),
      componentUnknownMessage(locationless)
    ];

    expect(new Set(messages).size).toBe(3);
    // And none of them is the empty string, which is the shape the last refusal defect took.
    for (const message of messages) expect(message.length).toBeGreaterThan(0);
  });

  it('control: a `componentLabelsFor` that always returns the short name cannot pass', () => {
    const one: TabLocation = { componentId: 'a', componentName: 'Home', componentPath: '/Admin/Home' };
    const two: TabLocation = { componentId: 'b', componentName: 'Home', componentPath: '/Pages/Home' };

    // Collides — must lengthen. Alone — must not.
    expect(componentLabelsFor([one, two])).toEqual(['/Admin/Home', '/Pages/Home']);
    expect(componentLabelsFor([one])).toEqual(['Home']);
  });

  it('control: a refresh that always reports a change cannot pass', () => {
    expect(tabLocationRefresh(discountRules, { componentName: 'Sales dashboard' })).toBeUndefined();
    expect(tabLocationRefresh(discountRules, { componentName: 'Revenue dashboard' })).toBeDefined();
  });
});
