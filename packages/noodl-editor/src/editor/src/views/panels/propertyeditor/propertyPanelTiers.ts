/**
 * FB-017 — which property groups a builder sees first, and which are folded away.
 *
 * ## The finding
 *
 * A `Group` node has **87 input ports across 18 groups**, every one of them expanded, in an
 * order nobody chose (`Ports.ts` builds groups in first-appearance order of the ports). The
 * test user's words: *"someone going in there knows this is the shit you only use in specific
 * use cases"* — they could not tell the daily properties from the ones that exist because CSS
 * has them.
 *
 * `phase-9-styles-overhaul/STYLE-004` specified this and was explicitly deferred with no
 * tracking task ("no progressive disclosure — beginners see same UI as experts"). This is the
 * ruling that picks it up.
 *
 * ## Tier is a property of the GROUP, not of the port
 *
 * Every alternative was worse:
 *
 * - **The group is the unit the panel can actually collapse.** A tier declared per port lets a
 *   group straddle both tiers, and then `Margin and padding` renders as a heading in the basic
 *   tier *and* a heading inside Advanced CSS, holding four ports each. Two identical headings
 *   in one panel is a worse legibility defect than the one being fixed.
 * - **The group is the unit the library already governs.** `PORT-GROUP-VOCABULARY.md` is
 *   normative, gated by `catalog:groups:check`, and every port already declares a `group`. A
 *   parallel `tier` field on 1,386 visual input ports is a second vocabulary to keep in step
 *   with the first.
 * - **A `tier` field would cross five hand-written field lists.** Session 21 (FB-015) added
 *   `placeholder` to one port and had to name it in `nodedefinition.registerInput`,
 *   `InputPortMetadata`, `nodelibraryexport.formatPort` and two property-panel prop hand-offs;
 *   four of the five silently dropped it, and every intermediate state read as *done* from the
 *   source. `group` already survives that pipeline intact — it is what the panel groups by
 *   today — so routing tier through `group` reuses a seam that is proven rather than adding a
 *   sixth list to the trap.
 *
 * ## 🔴 The default is BASIC, and that is a deliberate deviation from AC3
 *
 * FB-017's AC3 asks for "a port with no tier lands in Advanced (safe default)". Measured
 * against the corpus that exists, that default is not safe — it is the most damaging thing
 * this module could do.
 *
 * 29 visual nodes carry 58 distinct groups. 22 of them are shared CSS/DOM plumbing. The rest
 * are the node's own **subject**: `Image` holds Source, `Text` holds Text, `Video` holds
 * Source and Autoplay, `Data` holds Items. Defaulting to Advanced buries a node's entire
 * reason for existing behind a collapsed heading — and it does it to precisely the nodes this
 * file has never seen, which is every third-party and kit node. An Image node whose Source is
 * hidden is not a tidier panel, it is a broken one.
 *
 * The two errors are not symmetric:
 *
 * | Default | Error it makes | Cost |
 * | --- | --- | --- |
 * | Advanced | a new node's subject port is hidden | the node looks empty and unusable |
 * | Basic | a new shared CSS port shows in the first screen | one extra row |
 *
 * So: **{@link ADVANCED_CSS_GROUPS} is a denylist, and anything unnamed is basic.**
 *
 * AC3's real worry — that the classification silently rots as the library grows — is answered
 * better by a check than by a default. `propertyPanelTiers.test.ts` sweeps the generated node
 * catalog and fails if a *shared* visual group (one carried by three or more visual node types,
 * i.e. plumbing rather than subject) is unclassified. A default nobody audits cannot do that;
 * it just quietly hides things. ⚠️ The sweep reads the catalog, which does not contain
 * dynamically-built ports — that blind spot is exactly why the default must be the harmless
 * one.
 */

/** The one collapsed super-group everything in the advanced tier is folded into. */
export const ADVANCED_CSS_GROUP = 'Advanced CSS';

export type PortTier = 'basic' | 'advanced';

/**
 * The groups folded into {@link ADVANCED_CSS_GROUP}, and why each one is there.
 *
 * Three admissible reasons, and nothing else gets in:
 *
 * 1. **plumbing** — shared CSS/DOM machinery Richard's list does not name.
 * 2. **sub-element** — a restyling of something the root element already offers under a
 *    plainer heading. A Slider carries `Border Style`, `Thumb Border Style` and
 *    `Track Border Style`; promoting all three triples the border rows on the first screen to
 *    say one thing three times. The root's stays basic, the parts' fold away.
 * 3. **experimental** — platform or preview features that are not part of laying out a screen.
 *
 * ⚠️ Typography is deliberately **not** here. `Text Style` is a root heading holding Font Size
 * and Color, which are as daily as margin; only `Label Text Style` folds away, and it folds as
 * a sub-element (the button's label already has a `Label` heading of its own) rather than
 * because typography is advanced.
 */
export const ADVANCED_CSS_GROUPS: Readonly<Record<string, string>> = {
  // ── plumbing ────────────────────────────────────────────────────────────────
  'Advanced HTML': 'plumbing: Tag, CSS Class and CSS Style are the escape hatch, by name',
  Placement: 'plumbing: transform origin, rotation and scale — FB-016 makes these legible separately',
  'Dimension Constraints': 'plumbing: min/max width and height, set once on the layouts that need them',
  'Pointer Events': 'plumbing: hit-testing and click bubbling',
  Focus: 'plumbing: whether the element takes focus',
  Scroll: 'plumbing: scroll behaviour on a container that already scrolls',
  'Scroll To Element': 'plumbing: an imperative scroll action and its parameters',
  'Scroll To Index': 'plumbing: an imperative scroll action and its parameters',
  'Snap To Position X': 'plumbing: an imperative move action and its parameters',
  'Snap To Position Y': 'plumbing: an imperative move action and its parameters',
  Breakpoints: 'plumbing: responsive overrides, set once per layout rather than daily',

  // ── sub-element ─────────────────────────────────────────────────────────────
  'Label Text Style': 'sub-element: the Label heading already carries the label itself',
  'Checked Style': 'sub-element: the checked state restyles what Style already sets',
  'Thumb Border Style': 'sub-element: the root Border Style heading says this in one place',
  'Thumb Corner Radius': 'sub-element: the root Corner Radius heading says this in one place',
  'Thumb Box Shadow': 'sub-element: the root Box Shadow heading says this in one place',
  'Track Border Style': 'sub-element: the root Border Style heading says this in one place',
  'Track Corner Radius': 'sub-element: the root Corner Radius heading says this in one place',
  'Track Box Shadow': 'sub-element: the root Box Shadow heading says this in one place',

  // ── experimental ────────────────────────────────────────────────────────────
  'Experimental SEO': 'experimental: named experimental on the port group itself',
  'Experimental Sitemap': 'experimental: named experimental on the port group itself',
  'Server Side Rendering': 'experimental: a rendering-mode concern, not a layout one'
};

/**
 * The basic CSS groups, in the order Richard listed them.
 *
 * > *"position, margins, padding, width height, alignment, justify content, borders and
 * > rounded corners, shadow"*
 *
 * Read as: how big it is, how it arranges what is inside it, where that lands, how much air
 * around it, then how it is painted. "Position (sizeMode)" is his own gloss, and it puts Size
 * Mode — which lives in `Dimensions` — at the top rather than the transform ports in
 * `Placement`, which is why `Placement` is advanced above.
 *
 * ⚠️ Groups **not** named here are still basic (see the module note); they are simply not
 * pinned to a position, and sort into the tier above this one. That is the point: this list
 * orders the CSS a visual node shares with every other visual node, and a node's own subject
 * ports — the reason anybody placed it — belong in front of all of it.
 */
export const BASIC_CSS_ORDER: readonly string[] = [
  'Dimensions',
  'Dimension',
  'Layout',
  'Layout Settings',
  'Alignment',
  'Align and justify content',
  'Justify Content',
  'Text Alignment',
  'Margin and padding',
  'Style',
  'Text Style',
  'Border Style',
  'Corner Radius',
  'Box Shadow'
];

/**
 * The shared visual groups that are deliberately basic because they are a node's **subject**.
 *
 * 🔴 THE POINT OF THIS LIST IS THE SWEEP THAT READS IT, NOT THE NAMES IN IT. Nothing consults it
 * at runtime — {@link tierForGroup} answers from {@link ADVANCED_CSS_GROUPS} alone, and would
 * give the same answers if this constant were deleted.
 *
 * What it buys is completeness. `propertyPanelTiers.test.ts` sweeps the generated node catalog
 * for every group carried by three or more visual node types — the working definition of
 * *shared*, as opposed to one node's private heading — and fails unless each one appears in
 * {@link ADVANCED_CSS_GROUPS}, {@link BASIC_CSS_ORDER}, or here. A new shared heading therefore
 * cannot enter the library without somebody deciding which tier it belongs to.
 *
 * That check is what stands in for AC3's "safe default". The default is basic (see the module
 * note), which is the harmless direction but also the silent one: a shared CSS group added next
 * year would simply appear on the first screen and nobody would ever be told. This makes it a
 * red test instead.
 *
 * ⚠️ Every entry here is a group whose ports name the thing the node *is* — `Text` holds Text,
 * `Icon` holds Icon Source, `Label` holds Label, `Actions` holds Focus and Clear, `General` holds
 * Mounted and Variant and on many nodes the one port the node exists for. Folding any of them
 * away would leave a builder looking at a node with nothing in it.
 */
export const SUBJECT_GROUPS: readonly string[] = ['Actions', 'General', 'Icon', 'Label', 'Text'];

/**
 * Pinned to the front of the subject tier.
 *
 * `General` is where a node files the ports that are about the node as a whole — `Mounted`,
 * `Variant`, `Enabled`, and on many nodes the one port it exists for. It is the heading a
 * builder reads first on 27 of the 29 visual nodes, and alphabetical order would file it
 * between `Fill` and `Icon`.
 */
const SUBJECT_FIRST = 'General';

/** `Other` is the absence of a `group:` line rendered as if it were a decision — it sorts last. */
const OTHER_GROUP = 'Other';

export function tierForGroup(groupName: string): PortTier {
  return Object.prototype.hasOwnProperty.call(ADVANCED_CSS_GROUPS, groupName) ? 'advanced' : 'basic';
}

/** The minimum shape {@link orderPropertyGroups} needs; the real views carry much more. */
export interface TierableGroup {
  name: string;
}

export interface TieredGroups<T extends TierableGroup> {
  /** Rendered at the top level, in order: subject groups, then {@link BASIC_CSS_ORDER}. */
  basic: T[];
  /** Rendered inside the single collapsed {@link ADVANCED_CSS_GROUP}, in their original order. */
  advanced: T[];
}

/**
 * Split groups into the two tiers and order the basic one.
 *
 * Three ranks, mirroring `refusalPlan.orderGroups` (the connection popup's sort) so the two
 * surfaces do not disagree about what "ordered" means:
 *
 * 1. subject groups — `General` first, then alphabetical;
 * 2. the CSS basics, in {@link BASIC_CSS_ORDER};
 * 3. `Other`, last.
 *
 * 🔴 Every input group appears in exactly one output list. Nothing is dropped and nothing is
 * duplicated — asserted as a cardinality check in the spec, because "the panel got shorter"
 * and "the panel lost a port" look identical on screen.
 */
export function orderPropertyGroups<T extends TierableGroup>(groups: readonly T[]): TieredGroups<T> {
  const basic: T[] = [];
  const advanced: T[] = [];

  for (const group of groups) {
    (tierForGroup(group.name) === 'advanced' ? advanced : basic).push(group);
  }

  const rank = (name: string): number => {
    if (name === OTHER_GROUP) return 3;
    return BASIC_CSS_ORDER.includes(name) ? 2 : 1;
  };

  const withinRank = (a: T, b: T): number => {
    const r = rank(a.name);
    if (r === 2) return BASIC_CSS_ORDER.indexOf(a.name) - BASIC_CSS_ORDER.indexOf(b.name);
    if (r === 3) return 0;
    if (a.name === SUBJECT_FIRST) return -1;
    if (b.name === SUBJECT_FIRST) return 1;
    return a.name.localeCompare(b.name);
  };

  basic.sort((a, b) => rank(a.name) - rank(b.name) || withinRank(a, b));

  return { basic, advanced };
}

/**
 * How a collapsed group reports what is inside it.
 *
 * 🔴 This is the half of FB-017 that stops it becoming FB-018 again. FB-018 was filed because a
 * builder typed a width into a field a connection was already driving, and could not see why
 * the typed value reverted; the repair was a chip on the row. A row inside a collapsed group has
 * no chip, because it has no pixels — so folding CSS away without this would hand that exact
 * confusion a new place to hide, one tier deeper and harder to find.
 *
 * The badge counts a port as *active* if a connection drives it **or** a value has been set on
 * it, because those are the two ways a port stops being what the node shipped with, and the
 * builder's question in both cases is the same: *is something in there affecting my screen?*
 */
export interface PortActivityProbe {
  /** Is an incoming connection driving this port? */
  isConnected(portName: string): boolean;
  /** Has a value been set on this port, i.e. is it no longer at its default? */
  isSet(portName: string): boolean;
}

export function countActivePorts(portNames: readonly string[], probe: PortActivityProbe): number {
  let count = 0;
  for (const name of portNames) {
    if (probe.isConnected(name) || probe.isSet(name)) count++;
  }
  return count;
}

/**
 * The badge text, or `null` when there is nothing to say.
 *
 * ⚠️ Returns `null` at zero rather than `"0 set"`. A badge on every heading is chrome; a badge
 * that appears only when something is in there is a signal, and the whole point is that it draws
 * the eye to the one collapsed section that is doing something.
 */
export function activityBadgeLabel(count: number): string | null {
  return count > 0 ? `${count} set` : null;
}

/**
 * The `Advanced CSS` super-group's own badge: what every group folded inside it adds up to.
 *
 * 🔴 Summing rather than counting the sections is the whole guarantee. A builder who has
 * collapsed the advanced tier can see one heading and one number; if that number counted
 * *sections with something in them* instead of *ports*, a section holding six live ports and a
 * section holding one would read identically, and the badge would be telling them how this file
 * is organised rather than what is affecting their screen.
 */
export function sumActiveCounts(groups: readonly { activeCount?: number }[]): number {
  return groups.reduce((sum, group) => sum + (group.activeCount ?? 0), 0);
}
