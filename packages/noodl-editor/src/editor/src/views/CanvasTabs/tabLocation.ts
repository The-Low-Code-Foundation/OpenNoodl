/**
 * VFN-004 — where an open Logic Builder tab belongs, and whether you are standing there.
 *
 * The report: *"if you navigate away from the node canvas to another component, the logic editor
 * stays there … it could be confusing, unless we maybe label the logic editor top left tab with
 * the name of the component it lives in? Or have a way of getting back to the logic node the
 * editor is part of?"*
 *
 * The window staying open is the ruling (LGC-010's whole premise is that you can leave the blocks
 * open and go poke at the app). What was missing is that it never said **what it is looking at**.
 * Three decisions come out of that, and all three are pure functions of a tab plus the id of the
 * component currently on the canvas — which is why they live here rather than inside the React
 * component that renders them. Neither of this package's runners can render that component
 * (the jasmine suite needs Electron, `tests-unit` is plain Node with no react-dom), so a decision
 * left inside it is a decision that cannot be graded.
 *
 * ⚠️ Nothing in this file may import anything. It is reached from `tests-unit`, which is a
 * boundary rather than a directory: one `@noodl-core-ui` import anywhere in the graph fails the
 * suite *to run*, and a suite that did not run does not look like a failure.
 */

/**
 * The half of a `Tab` this file reads.
 *
 * 🔴 `componentId` is the **navigation** identity and `componentName` is **display only**.
 * `Tab.nodeName` has always been a snapshot — renaming the node after the tab is open leaves the
 * tab reading the old name — and the fix for that is out of scope, but the way to avoid making it
 * worse is to never let *going back* depend on a copied string. A component id survives a rename;
 * a name does not, and `ProjectModel` has no path-normalisation to make a stale one resolve.
 */
export interface TabLocation {
  /** The node whose blocks this tab is editing. Display only, and a snapshot. */
  nodeName?: string;
  /** `ComponentModel.id` of the component the node lives in — the identity navigation uses. */
  componentId?: string;
  /** `ComponentModel.displayName` at open time. Display only; re-resolve it when you can. */
  componentName?: string;
  /** `ComponentModel.fullName` at open time — the tooltip, and the refusal. Display only. */
  componentPath?: string;
}

/**
 * How many characters of the component segment survive before the ellipsis.
 *
 * The **component** side truncates, not the node side: the node name is the more specific of the
 * two and is what tells two open tabs apart, so spending the tab's width on it is the point.
 */
export const COMPONENT_LABEL_MAX_CHARS = 22;

/** What a tab is called when its node has no label and no type display name to fall back on. */
export const UNNAMED_NODE = 'Unnamed';

/** The separator between the two segments. A middle dot, spaced. */
export const LABEL_SEPARATOR = ' · ';

export interface TabLabelSegments {
  /** The component segment as it should be painted, already shortened. Absent when unknown. */
  component?: string;
  /** True when `component` was shortened, so the view knows to offer the full name elsewhere. */
  componentTruncated: boolean;
  /** The node segment. Never empty. */
  node: string;
}

export interface TabLabelOptions {
  /**
   * The component's name *now*, resolved from `componentId` against the live project.
   *
   * Preferred over `tab.componentName` when the caller can resolve it: the snapshot is a fallback
   * for a component that has since gone, not the source of truth for one that is still there.
   */
  componentName?: string;
  /** Overrides {@link COMPONENT_LABEL_MAX_CHARS}; mainly so a spec can state a small number. */
  maxComponentChars?: number;
}

/**
 * Shorten to `max` characters *including* the ellipsis, so the result is never wider than asked.
 *
 * A `max` of 1 yields the ellipsis alone and a `max` below 1 yields the empty string; both are
 * degenerate, and both are better than a function that quietly returns something longer than its
 * own limit.
 */
export function truncateWithEllipsis(value: string, max: number): string {
  if (max <= 0) return '';
  if (value.length <= max) return value;
  return value.slice(0, max - 1) + '…';
}

/**
 * The two halves of the tab's label: `Component · Node`.
 *
 * Component first, because the component is the thing that has just stopped being visible. The
 * words "Logic Builder" are deliberately **not** here: the window is already
 * `aria-label="Logic Builder"` and its title bar is a few pixels away, and a tab that spends its
 * width repeating the window's name has none left for the answer.
 */
export function tabLabelSegments(tab: TabLocation, options: TabLabelOptions = {}): TabLabelSegments {
  const node = (tab.nodeName ?? '').trim() || UNNAMED_NODE;

  const rawComponent = (options.componentName ?? tab.componentName ?? '').trim();
  if (!rawComponent) {
    // Not knowing where a tab lives is not the same as it living nowhere. No segment, no
    // separator, and — see `isTabAway` — no away mark either.
    return { component: undefined, componentTruncated: false, node };
  }

  const max = options.maxComponentChars ?? COMPONENT_LABEL_MAX_CHARS;
  const component = truncateWithEllipsis(rawComponent, max);

  return { component, componentTruncated: component !== rawComponent, node };
}

/**
 * Which component string each open tab should show, given the *other* open tabs.
 *
 * 🔴 The one place a label needs to know about its neighbours. `componentName` is a component's
 * last path segment, so `/Pages/Home` and `/Admin/Home` are both "Home" — and two tabs labelled
 * `Home · Discount rules` and `Home · Shipping rules` do not answer "which Home?", which is
 * exactly the question this whole task exists to answer. When two open tabs collide on the
 * display name but sit in genuinely different components, both fall back to the **full path**.
 *
 * ⚠️ The path is taken off the model, never assembled. Component names in this codebase are not
 * leading-slash normalised, and a path built by string surgery is a path that matches nothing.
 *
 * Only tabs that are actually open participate, so the common case — one Home in the project, or
 * two tabs in the same component — pays nothing and keeps the short name.
 */
export function componentLabelsFor(tabs: readonly TabLocation[]): (string | undefined)[] {
  const componentsPerName = new Map<string, Set<string>>();

  for (const tab of tabs) {
    const name = (tab.componentName ?? '').trim();
    if (!name) continue;
    // Keyed by id, so two tabs on nodes in the SAME component are not a collision — they are two
    // tabs in one place, and telling them apart is the node segment's job.
    const ids = componentsPerName.get(name) ?? new Set<string>();
    ids.add(tab.componentId ?? '');
    componentsPerName.set(name, ids);
  }

  return tabs.map((tab) => {
    const name = (tab.componentName ?? '').trim();
    if (!name) return undefined;

    const ambiguous = (componentsPerName.get(name)?.size ?? 0) > 1;
    if (!ambiguous) return name;

    return (tab.componentPath ?? '').trim() || name;
  });
}

/** The whole label as one string — the accessible name, and what a spec can compare against. */
export function tabLabel(tab: TabLocation, options: TabLabelOptions = {}): string {
  const segments = tabLabelSegments(tab, options);
  if (!segments.component) return segments.node;
  return segments.component + LABEL_SEPARATOR + segments.node;
}

/**
 * Is the graph on screen **not** this tab's component?
 *
 * This is the half that makes the ruling honest. A window that stays open while you look
 * somewhere else is only safe if *"these blocks are not the graph you are looking at"* is stated;
 * inferring it from a name you have to read and compare is the same failure one step later.
 *
 * 🔴 A tab with no `componentId` is **never** marked away. We do not know where it belongs, and an
 * absence of knowledge must not be published as an assertion — a tab opened before this field
 * existed would otherwise wear a permanent "you are somewhere else" mark that no navigation could
 * clear.
 *
 * No active component at all *does* count as away: nothing on the canvas is certainly not this
 * tab's component.
 */
export function isTabAway(tab: TabLocation, activeComponentId: string | undefined | null): boolean {
  if (!tab.componentId) return false;
  return tab.componentId !== activeComponentId;
}

/**
 * What clicking the tab should do.
 *
 * `navigate` and `select` differ only in whether the canvas has to change component; both end
 * with the node selected, because "where does this live" is answered by the canvas rather than by
 * a sentence. The two refusals are separated because they are different failures with different
 * things to say: one tab never learned where it belongs, the other's component has been deleted
 * out from under it.
 */
export type TabActivation = 'navigate' | 'select' | 'refuse-unknown' | 'refuse-missing';

export interface TabActivationInputs {
  /** Does a component with the tab's `componentId` still exist in the project? */
  componentExists: boolean;
  /** The id of the component currently on the canvas, if any. */
  activeComponentId?: string | null;
}

export function tabActivation(tab: TabLocation, inputs: TabActivationInputs): TabActivation {
  if (!tab.componentId) return 'refuse-unknown';
  if (!inputs.componentExists) return 'refuse-missing';
  return tab.componentId === inputs.activeComponentId ? 'select' : 'navigate';
}

/**
 * The refusal, out loud and by name.
 *
 * 🔴 It says what happens to the blocks, because the alternative reading — "the component is
 * gone, so this window is about to go too" — is the one a builder will reach for, and it is
 * wrong: the tab stays open and the blocks stay in it. This feature has already shipped one
 * refusal that published its silence (an empty string written where the previous program was);
 * the rule that came out of it is to ask what a refusal *writes*, and this one writes a sentence.
 */
export function componentGoneMessage(tab: TabLocation): string {
  const name = (tab.componentPath ?? tab.componentName ?? '').trim();
  const subject = name ? `"${name}"` : 'The component these blocks came from';
  return `${subject} is no longer in this project, so there is nowhere to go back to. The blocks stay open here.`;
}

/** The refusal for a tab that never recorded where it came from. */
export function componentUnknownMessage(tab: TabLocation): string {
  const node = (tab.nodeName ?? '').trim() || UNNAMED_NODE;
  return `This tab does not know which component "${node}" came from. Close it and reopen the blocks from the node to teach it.`;
}

/**
 * What to write back onto an already-open tab when the blocks are reopened from the node.
 *
 * Reopening is the one gesture that can honestly correct a snapshot — the emitter has just read
 * the live model — so `nodeName` and the location fields are refreshed. `workspace` is pointedly
 * absent: a tab may be holding edits that the 300 ms debounce has not flushed to the node yet, so
 * the tab is ahead of the model rather than behind it, and copying the model over it would eat
 * the author's last few seconds of work.
 *
 * Returns `undefined` when nothing would change, so the caller can hand React the same array back
 * and not re-render. Only fields the emitter actually supplied are considered, so a caller that
 * predates these fields cannot erase what a richer one recorded.
 */
export function tabLocationRefresh<T extends TabLocation>(existing: T, incoming: Partial<T>): Partial<T> | undefined {
  const fields = ['nodeName', 'componentId', 'componentName', 'componentPath'] as const;

  const refreshed: Partial<T> = {};
  let changed = false;

  for (const field of fields) {
    const value = incoming[field];
    if (value === undefined) continue;
    refreshed[field] = value as T[typeof field];
    if (existing[field] !== value) changed = true;
  }

  return changed ? refreshed : undefined;
}

/**
 * The tab's `title` — the full names, untruncated, plus the away state in words.
 *
 * The away *mark* is a shape (see the stylesheet); this is the same fact for anyone who reaches
 * the tab with a pointer or a screen reader rather than with their eyes.
 */
export function tabTooltip(
  tab: TabLocation,
  options: {
    /**
     * The component to name, resolved live. The **full path** rather than the display name: two
     * components in different folders can share a last segment, and the tooltip is where that
     * gets resolved without spending tab width on it. Falls back to the tab's own snapshot.
     */
    component?: string;
    away?: boolean;
  } = {}
): string {
  const node = (tab.nodeName ?? '').trim() || UNNAMED_NODE;
  const component = (options.component ?? tab.componentPath ?? tab.componentName ?? '').trim();

  if (!component) return `Blocks for ${node}`;

  return options.away
    ? `Blocks for ${node}, in ${component} — you are looking at another component. Click to go back.`
    : `Blocks for ${node}, in ${component}. Click to select the node.`;
}
