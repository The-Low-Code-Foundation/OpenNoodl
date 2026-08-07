/**
 * Putting a port's `description` in front of an author — ERG-004 §7.7 item 2.
 *
 * ## Why this exists
 *
 * ERG-004's live QA found every output-port `description` in the library was
 * being dropped between the runtime and the editor (**0 of 1144**), fixed it,
 * and then found the second half of the problem: **nothing in the editor renders
 * a port description anyway** — not the property editor, not the node picker
 * preview, not the canvas port hover, and not for inputs either. So the fix
 * restored ~1656 input and ~1045 output descriptions into `NodeLibrary` that no
 * author could read. This module is the first surface that reads them.
 *
 * ## Why it is a wrapper here and not a prop
 *
 * The same reasoning `portDecoration.ts` records for capability gates, and it is
 * load-bearing for exactly the same reason. `Ports.renderParams` is the one place
 * every row's element passes through, whatever class produced it. The alternative
 * — a `description` prop on `PropertyPanelInput`, wired from each `TypeView` — is
 * twenty-nine row classes, each a place the wiring can be forgotten.
 *
 * There is direct evidence that the per-class route does not hold: `tooltip` is
 * already copied onto the view in **eleven** `fromPort` implementations
 * (`BasicType`, `BooleanType`, `Dimension`, `EnumType`, `ListValueType`,
 * `NumberWithUnits`, `SizeModeType`, …) and is actually **rendered by two** of
 * them. A field threaded per class is a field most classes drop.
 *
 * ## Why `title` and not something designed
 *
 * It is the idiom already in use one line away — `PropertyPanelInput` renders
 * `<span className={css['ResetDot']} title="Reset to default" …>`. A native title
 * needs no layout, cannot push a row's height around (which is what C3 shows
 * costs legibility elsewhere in this panel), and inherits down to the row's
 * children automatically, so hovering the label *or* the input both work.
 *
 * ⚠️ It is a floor, not a ceiling. A designed affordance — an info glyph, a
 * help popover, the description in the node picker's preview — is better and is
 * still unowned. This makes the text reachable at all, which it was not.
 */

/** Longest description we will put in a native tooltip before trimming. */
const MAX_TITLE_LENGTH = 400;

interface PortLike {
  name?: string;
  description?: unknown;
}

/**
 * Attach a port's description to its rendered row as a native tooltip.
 *
 * Returns the element either way, so the call site stays a one-liner. Does
 * nothing when there is no description, when the element already carries a
 * `title` (a row that has said something more specific about itself keeps it),
 * or when the description is not a non-empty string — a port whose description
 * is `null`, a number, or whitespace must not produce an empty tooltip box.
 */
export function describePortElement<T extends HTMLElement | null | undefined>(
  element: T,
  port: PortLike | undefined
): T {
  if (!element || !port) return element;

  const raw = port.description;
  if (typeof raw !== 'string') return element;

  const text = raw.trim();
  if (text === '') return element;

  // Never clobber a title the row set for itself.
  if (element.getAttribute('title')) return element;

  element.setAttribute('title', text.length > MAX_TITLE_LENGTH ? text.slice(0, MAX_TITLE_LENGTH - 1) + '…' : text);
  return element;
}
