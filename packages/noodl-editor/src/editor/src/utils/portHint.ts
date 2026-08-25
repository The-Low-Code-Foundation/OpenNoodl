/**
 * Drawing FB-017 AC4's structural hint under a property row.
 *
 * The third wrapper on `Ports.renderParams`, for the third reason, and it is a wrapper here for
 * the same one `portDecoration.ts` and `portDescription.ts` both record: that call is the single
 * place every row's element passes through, whatever of the twenty-nine row classes produced it.
 *
 * ## 🔴 The corner-radius rows do not arrive with a port name
 *
 * The other two wrappers key off `v.name`. The five corner-radius ports declare
 * `tab: { group: 'corners' }`, so `getViewGroupsFromPorts` folds them into a `TabGroup` and pushes
 * **that** into `this.views`. A `TabGroup` has no `name`, so a per-port wrapper reaches exactly
 * none of them — it would have compiled, specced green, and drawn nothing, which is the "gate with
 * a hole shaped like the defect" this panel has produced before. Hence {@link portNamesForView}: a
 * view speaks for its own port *and* for any it holds.
 *
 * The note lands under the whole tab group rather than under one corner's field, which is also
 * where it belongs — the condition is about the node, not about the bottom-left corner.
 *
 * ## 🔴 Why it must be re-appliable, and not just applied once
 *
 * The panel does **not** rebuild its rows when a parameter changes: `WorkflowTypes.ts:508` records
 * that ("the property editor does not rebuild a row on `parametersChanged`"), and `renderGroups`
 * returns early whenever the port list is unchanged — which it is, because `clip` gates nothing.
 * So a hint applied only at render time would appear no earlier than the *next selection*, and the
 * author who has just typed a corner radius and is looking straight at the panel would never see
 * it. That is the whole flow this feature exists for.
 *
 * A full re-render is not the answer either: `borderRadius` is a typed number field, and rebuilding
 * the panel under a focused input takes the focus with it. So {@link applyPortHint} removes any note
 * it finds before adding one, and `Ports.refreshHints` calls it again in place on the handful of
 * parameters a hint depends on. Nothing else in the row is touched.
 */

/** Class added to the row that hosts a note. */
export const HINTED_PORT_CLASS = 'property-structural-hint-host';
/** Class on the note itself. */
export const PORT_HINT_CLASS = 'property-structural-hint';
/** Marks a rendered row a hint could attach to, so a later pass can find it without a re-render. */
export const HINT_PORTS_ATTRIBUTE = 'data-hint-ports';

/**
 * The minimum of a rendered row this module touches.
 *
 * Structural, not `HTMLElement`, for the reason `portDescription.test.ts` states: `jest.config.js`
 * sets `testEnvironment: 'node'` for the whole package, so a suite has no `document`. It also keeps
 * this module honest — needing more of the DOM than the five members below stops the stub
 * compiling, and the widening has to be looked at.
 */
export interface HintElementLike {
  className?: string;
  setAttribute(name: string, value: string): void;
  querySelector(selector: string): { remove?(): void } | null;
  appendChild(child: TSFixme): TSFixme;
  removeChild(child: TSFixme): TSFixme;
}

/** The minimum of a row view this module reads. */
interface ViewLike {
  name?: string;
  /** A `TabGroup`'s member views. Absent on an ordinary row. */
  views?: { name?: string }[];
}

/**
 * Every port name a rendered view speaks for.
 *
 * One for an ordinary row; for a `TabGroup`, the ports it holds — which is the only way the
 * corner-radius ports are reachable from `renderParams` at all.
 */
export function portNamesForView(view: ViewLike | undefined): string[] {
  if (!view) return [];

  const names: string[] = [];
  if (view.name) names.push(view.name);
  if (Array.isArray(view.views)) {
    view.views.forEach((child) => {
      if (child && child.name) names.push(child.name);
    });
  }

  return names;
}

/** Read back the port names a previous pass recorded on a row. */
export function hintPortsOf(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').filter((name) => name !== '');
}

function addClass(element: HintElementLike, className: string) {
  const current = element.className || '';
  if (current.split(' ').indexOf(className) !== -1) return;
  element.className = current ? `${current} ${className}` : className;
}

function removeClass(element: HintElementLike, className: string) {
  const current = element.className || '';
  if (!current) return;
  element.className = current
    .split(' ')
    .filter((name) => name && name !== className)
    .join(' ');
}

/**
 * Bring a row's note into line with `hints`, adding, replacing or removing it.
 *
 * Idempotent by construction: whatever note is already there goes first, so calling this twice
 * with the same map leaves one note, and calling it after the condition clears leaves none. That
 * is what lets the render path and the live-refresh path be the same function.
 *
 * Returns the element either way, so the call site stays a one-liner. Draws at most one note even
 * when several of a tab group's ports carry the same message — five identical sentences under one
 * control is noise, not disclosure.
 */
export function applyPortHint<T extends HintElementLike | null | undefined>(
  element: T,
  portNames: string[],
  hints: Map<string, string>,
  hintablePorts: ReadonlySet<string>,
  createElement: (tag: string) => TSFixme = (tag) => document.createElement(tag)
): T {
  if (!element) return element;

  const hintable = portNames.filter((name) => hintablePorts.has(name));
  if (hintable.length === 0) return element;

  // Recorded whether or not a note is drawn: this is how `refreshHints` finds the row again
  // later, when the condition has changed but the panel has not re-rendered.
  element.setAttribute(HINT_PORTS_ATTRIBUTE, hintable.join(','));

  const existing = element.querySelector(`.${PORT_HINT_CLASS}`);
  if (existing) {
    if (existing.remove) existing.remove();
    else element.removeChild(existing);
  }

  const hinted = hintable.find((name) => hints.has(name));
  const message = hinted === undefined ? undefined : hints.get(hinted);

  if (!message) {
    removeClass(element, HINTED_PORT_CLASS);
    return element;
  }

  const note = createElement('div');
  note.className = PORT_HINT_CLASS;
  note.setAttribute('data-test', `property-hint-${hinted}`);
  // `textContent`, never `innerHTML` — the same rule `portDecoration.ts` states. These sentences
  // are ours today, but the seam is one a kit node's port could reach.
  note.textContent = message;
  note.title = message;

  addClass(element, HINTED_PORT_CLASS);
  element.appendChild(note);

  return element;
}
