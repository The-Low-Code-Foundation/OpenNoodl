/**
 * FB-017 AC4 — the row that says why a property is not doing anything.
 *
 * Richard's scope 4: *"where a property commonly 'doesn't work' for a structural reason —
 * corner radius on an Image without clipping, transform on a statically-positioned element —
 * the row gets an inline hint when the condition is detected. Start with a **measured list of
 * the top offenders**, not an open-ended system."*
 *
 * So the list below is measured, and it is closed. Two things came out of measuring it that the
 * task file did not say.
 *
 * ## 🔴 The named offender is the wrong way round
 *
 * "Corner radius on an Image without clipping" does not reproduce. Measured by hit-testing the
 * corner pixel of a 200×200 box with a 40px radius in the editor's own renderer:
 *
 * | Case | corner pixel hits |
 * | --- | --- |
 * | `<img>` carrying the radius itself, no clipping anywhere | **not the image** — it is rounded |
 * | control: the same `<img>` with radius `0` | the image |
 * | a parent with the radius, `overflow: visible`, square child | **the child** — the corner is square |
 * | the same parent with `overflow: hidden` | neither — it is rounded |
 * | control: the same parent with radius `0`, `overflow: visible` | the child |
 *
 * `border-radius` clips a replaced element's own content with no help from `overflow`, so an
 * `Image` node — which renders as a bare `<img>` carrying the style — rounds correctly on its
 * own. What actually fails is a **container** whose children paint over its rounded corners, and
 * in this library that container is exactly the node with a `Clip Content` port that defaults to
 * `false`. The reporter met the defect through an Image *inside* a Group and attributed it to the
 * Image; the port that needs the hint is on the parent.
 *
 * ## The offender set, from the corpus rather than from reasoning
 *
 * `node-catalog.json`: **14 node types carry `borderRadius`, 3 carry `clip`, and the only
 * overlap is `Group`.** Of the 14, all but two declare `allowChildren: false` and so can never be
 * in this state at all. The two that can:
 *
 * | Node | children | `Clip Content` |
 * | --- | --- | --- |
 * | `Group` | yes | yes — and it defaults to **off**, so this is the default state |
 * | `Button` (`net.noodl.controls.button`) | yes | **no such port** — `Button.tsx` renders `props.children` straight into the `<button>` |
 *
 * ⚠️ That second row is why the message has two forms. Telling a Button author to turn on a
 * control their node does not have is the failure mode `portDecoration.ts` records for gates: an
 * unexplained dead end reads as "this is broken."
 *
 * ## Why the test is the node's own state and not a list of type names
 *
 * `allowChildren: false` nodes cannot hold children, so "has children in the graph" already
 * excludes the twelve non-offenders without naming them — and it keeps working for kit and
 * third-party nodes this file has never seen, which is the same argument
 * {@link ./propertyPanelTiers} makes for keying tier off `group`.
 *
 * ## What this deliberately does not detect
 *
 * - **A radius arriving over a connection.** The panel knows a port is connected, not what value
 *   it carries, so a hint there would be a guess. A false hint is worse than a missing one: it
 *   tells an author their corners are broken when they are not.
 * - **`overflow` set through Advanced CSS or a `cssClassName`.** Not visible from the graph.
 * - The second offender Richard named, **"transform on a statically-positioned element"**, is not
 *   here because it does not reproduce either: `layout.ts`'s `Layout.align` ends
 *   `style.transform = transform + (style.transform || '')`, so an alignment transform is
 *   *prepended* to the author's rather than replacing it, on every position mode.
 */

/** The five ports `_addCornerRadius` generates on every node that rounds corners. */
export const CORNER_RADIUS_PORTS = [
  'borderRadius',
  'borderTopLeftRadius',
  'borderTopRightRadius',
  'borderBottomRightRadius',
  'borderBottomLeftRadius'
] as const;

/**
 * Every port a hint can ever attach to.
 *
 * `Ports` records these on the rows it renders so a later pass can find them again without a
 * re-render. Keep it the union of the keys {@link hintsForNode} can return.
 */
export const HINTABLE_PORTS: ReadonlySet<string> = new Set<string>(CORNER_RADIUS_PORTS);

/**
 * Every parameter a hint's answer depends on.
 *
 * The watch list, and deliberately narrow. `Ports` re-checks its notes when one of these changes
 * and ignores every other `parametersChanged`, because the alternative — re-deriving on any edit —
 * runs this on every keystroke in every text field on the panel.
 */
export const HINT_INPUT_PARAMETERS: ReadonlySet<string> = new Set<string>([
  ...CORNER_RADIUS_PORTS,
  'clip',
  'scrollEnabled',
  'nativeScroll'
]);

/**
 * What a hint needs to know about the selected node.
 *
 * Deliberately three small questions rather than the `ModelProxy` itself: `getParameter` is the
 * state-aware reader (a radius set on `hover` must be read from `hover`), `hasPort` distinguishes
 * "off" from "no such control", and `childCount` is the one fact that lives in the graph rather
 * than in the parameters.
 */
export interface HintSubject {
  /** The node's parameter for `name` in the panel's current visual state, or `undefined`. */
  getParameter(name: string): unknown;
  /** Whether the node's type declares an input port called `name` at all. */
  hasPort(name: string): boolean;
  /** How many children the node has in the graph. */
  childCount: number;
}

/**
 * Whether a parameter value denotes a length that is actually set and non-zero.
 *
 * `0` and `{ value: 0 }` are "not set" for this purpose — a zero radius rounds nothing, so there
 * is nothing to warn about. Strings are accepted because `cssLength` passes non-numbers through
 * verbatim, so a hand-typed `'2em'` is a real stored value.
 */
export function isNonZeroLength(value: unknown): boolean {
  if (value === null || value === undefined) return false;

  if (typeof value === 'number') return Number.isFinite(value) && value !== 0;

  if (typeof value === 'string') {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) && parsed !== 0;
  }

  if (typeof value === 'object') {
    return isNonZeroLength((value as { value?: unknown }).value);
  }

  return false;
}

/**
 * Whether this node's children are clipped to its box.
 *
 * Two ways to arrive there, both read off `Group.tsx`'s render: `clip` sets `overflow: hidden`
 * outright, and native scrolling sets `overflow: auto`, which clips to the radius just as well.
 *
 * ⚠️ `nativeScroll` defaults to **`true`**, so an unset value counts as clipping. Turning it off
 * takes the iScroll path, which wraps the children and leaves the root at `overflow: visible` —
 * read from the source, not driven, so it is the one branch here that has not been observed.
 */
export function isChildClipped(subject: HintSubject): boolean {
  if (subject.getParameter('clip') === true) return true;

  if (subject.getParameter('scrollEnabled') === true) {
    return subject.getParameter('nativeScroll') !== false;
  }

  return false;
}

/** The sentence for a node that has a `Clip Content` port to turn on. */
export const CORNER_RADIUS_HINT_WITH_CLIP =
  'The children are not clipped, so their square corners paint over these rounded ones. ' +
  'Turn on Clip Content to round them too.';

/** The sentence for a node with children and no clipping control of its own. */
export const CORNER_RADIUS_HINT_NO_CLIP =
  'The children are not clipped, so their square corners paint over these rounded ones. ' +
  'This node has no Clip Content option — round the child instead, or put it in a Group that clips.';

/**
 * Every hint that applies to the selected node, keyed by the port name it belongs to.
 *
 * A map rather than a list so the caller can ask about a port it is already holding. Empty is the
 * normal case and must stay cheap: this runs on every property-panel render.
 */
export function hintsForNode(subject: HintSubject): Map<string, string> {
  const hints = new Map<string, string>();

  const roundedPorts = CORNER_RADIUS_PORTS.filter(
    (name) => subject.hasPort(name) && isNonZeroLength(subject.getParameter(name))
  );

  if (roundedPorts.length === 0) return hints;
  if (subject.childCount === 0) return hints;
  if (isChildClipped(subject)) return hints;

  const message = subject.hasPort('clip') ? CORNER_RADIUS_HINT_WITH_CLIP : CORNER_RADIUS_HINT_NO_CLIP;
  roundedPorts.forEach((name) => hints.set(name, message));

  return hints;
}
