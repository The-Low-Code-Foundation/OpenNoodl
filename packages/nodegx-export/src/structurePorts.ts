/**
 * The export's defer tables, and the type → render-role map above them.
 *
 * 🔴 **These live outside `analyze/plan.ts` because a second reader needs them.** FLD-013 (#37):
 * an agent choosing nodes for an app it intends to export asks `get_node_type` *before* it
 * designs, and the only honest answer to *"will this node export?"* is per **parameter source**,
 * not per type. `Circle` is `status: "translated"` in the coverage ledger and still refuses on a
 * wire into any of thirteen ports — so the ledger status alone, which is what #37 asked for, would
 * have read green on the exact node that produced the twenty-three refusals it was filed about.
 *
 * `noodl-mcp` reads these through `@nodegx/export`'s index; `plan.ts` imports them back and
 * remains their only writer. **Moved out of `plan.ts`, not copied into a second file** — this repo
 * has already paid for a second copy of a table that drifted.
 */

import type { RenderRole } from './analyze/plan';

/**
 * Ports whose value shapes the emitted *structure* (tracks, options, marks, initial state) —
 * a wire into one means the node's static translation would lie, so the node defers whole
 * (VISUALS-TARGET). Ports that merely carry content (src, label text) stay bindable.
 */
export const STRUCTURE_PORTS: Partial<Record<RenderRole, string[]>> = {
  columns: [
    'layoutString',
    'sizing',
    'packing',
    'direction',
    'minWidth',
    'marginX',
    'marginY',
    'justifyContent',
    'mediumBreakpoint',
    'mediumLayout',
    'smallBreakpoint',
    'smallLayout'
  ],
  icon: ['iconSourceType', 'iconIconSource', 'iconImageSource'],
  // A wired `checked`/`value` no longer defers the control whole: it is the controlled-state
  // slice's local-state + sync-effect shape (CONTROLLED-STATE-TARGET §4c). The ports that
  // stay here still shape structure a static render cannot follow (tracks, options, marks).
  //
  // `useLabel`/`useIcon` decide whether the `<label>` wrapper and the mark exist at all
  // (Checkbox.tsx:70,170); a radio's `value` and a group's `value` decide which child prints
  // `defaultChecked` (component.ts:1343,1373). Those are structure. `label`, `min`, `max` and
  // `step` are NOT — see CONTENT_BOUND_PORTS below.
  checkbox: ['useLabel', 'useIcon'],
  radio: ['useLabel', 'useIcon', 'value'],
  radiogroup: ['value'],
  select: ['items', 'placeholder', 'useLabel'],
  // §2 of NOTES-UNOWNED-NODE-WORK.md. Both compose into the emitted `src` as a media fragment,
  // so a wired value makes the attribute non-static exactly as a wired `src` would.
  video: ['startTime', 'endTime'],
  circle: [
    'size',
    'shape',
    // Stage 2. Both move the outline itself, so a wire into either makes the rendered structure
    // non-static exactly as a wired `shape` does.
    'points',
    'cornerRadius',
    'svgSource',
    'fillEnabled',
    'fillColor',
    'strokeEnabled',
    'strokeWidth',
    'strokeColor',
    'strokeLineCap',
    'startAngle',
    'endAngle'
  ]
};

/**
 * Ports that carry *content* into a control — text, bounds, increments. A wire into one does
 * not move the rendered structure: `label` is the single text child of `<label>`
 * (Checkbox.tsx:191, RadioButton.tsx:200) and `min`/`max`/`step` are plain attributes the
 * emitter already orders (CONTENT_ATTR_ORDER), with nothing in the emitted CSS derived from
 * them (style.ts's `range` rule reads `thumbColor` and `width` only).
 *
 * They still defer, because omitting an unknown bound renders a 0–100 slider where the running
 * app renders the row's — wrong output, confidently emitted. But the wall is the *source*, not
 * the port, and every one of them in the corpus resolves to one of the two walls already on the
 * list: a `Model2` row property, or a component-record property only a runtime script writes.
 * Naming the source is what lets the census group them there instead of inventing a third wall
 * (RECORD-VERBS §19).
 */
export const CONTENT_BOUND_PORTS: Partial<Record<RenderRole, string[]>> = {
  checkbox: ['label'],
  radio: ['label'],
  range: ['min', 'max', 'step']
};

/**
 * Type name → render role, for every type whose role is fixed by its name.
 *
 * 🔴 **This is `renderRole`'s switch, moved.** It was a `switch (node.type)` inside `plan.ts` and
 * nothing outside the exporter could read it, which left the MCP server with no way to say which
 * ports a *named* type refuses on. `plan.ts` now looks the answer up here, so there is one table
 * and not two. The three cases the switch decides before consulting a name — a component instance
 * (`/`-prefixed), a kit node, and the `catalog.isVisual` fallback — stay in `renderRole`, because
 * they are decided by the graph and the catalog rather than by the type name.
 *
 * `null` is a real answer and not a miss: a `Router` has a role of none, exactly as a `Variable`
 * does. Callers must distinguish `null` (this type draws nothing) from `undefined` (this table
 * does not decide this type).
 */
export const ROLE_OF_TYPE: Readonly<Partial<Record<string, RenderRole | null>>> = {
  Group: 'group',
  // EXP-011 §63. A wrapper div the drag hook binds to; the node itself renders nothing in the running app.
  Drag: 'drag',
  Text: 'text',
  Label: 'text',
  Image: 'image',
  'net.noodl.controls.button': 'button',
  Button: 'button',
  'net.noodl.controls.textinput': 'input',
  'Text Input': 'input',
  'net.noodl.visual.columns': 'columns',
  'net.noodl.visual.icon': 'icon',
  'net.noodl.controls.checkbox': 'checkbox',
  Checkbox: 'checkbox',
  'net.noodl.controls.radiobutton': 'radio',
  'Radio Button': 'radio',
  'Radio Button Group': 'radiogroup',
  'net.noodl.controls.range': 'range',
  Range: 'range',
  'net.noodl.controls.options': 'select',
  Options: 'select',
  Video: 'video',
  Circle: 'circle',
  Page: 'page',
  'For Each': 'repeater',
  Router: null,
  // EXP-011 §61. The Component Stack renders its top entry; `roleOf` refuses the shapes §61.0 names.
  'Page Stack': 'stack',
  // EXP-011 §51. Rendered as `{children}` where it sits; see CHILD_SLOT_TYPE.
  'Component Children': 'slot'
};

/**
 * The ports of a named type that shape its emitted structure — *"a wire into any of these and this
 * node is left out of the export"*.
 *
 * Always an array, never `undefined`, for a type this table decides: **an empty list and an absent
 * field are different answers**, and a caller that cannot tell them apart learns nothing from the
 * empty one.
 */
export function structurePortsOf(typeName: string): string[] {
  const role = ROLE_OF_TYPE[typeName];
  return role === undefined || role === null ? [] : [...(STRUCTURE_PORTS[role] ?? [])];
}

/**
 * The ports of a named type that carry *content* into a control and still refuse it.
 *
 * 🔴 **Reported apart from {@link structurePortsOf} because they are not the same claim.** A wire
 * into `Range.min` does not move the rendered structure — the node is left out because the bound
 * is not statically known and a 0–100 slider is the wrong output, confidently emitted. Folding
 * these into a field called `structurePorts` would tell an agent something about this product that
 * is not true; the consequence is identical, the reason is not.
 */
export function contentPortsOf(typeName: string): string[] {
  const role = ROLE_OF_TYPE[typeName];
  return role === undefined || role === null ? [] : [...(CONTENT_BOUND_PORTS[role] ?? [])];
}
