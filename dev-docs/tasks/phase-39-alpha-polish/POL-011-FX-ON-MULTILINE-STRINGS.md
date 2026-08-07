# POL-011 — `fx` on the Text node's text field

Covers reported item **13**.

## What was reported

> Can you add the 'fx' option to the text node's 'text' field?
>
> Lots of the nodes have an fx option, for example the Button node 'label' field. You click fx and
> you can type like `Noodl.Variables.foo`.

## Status: DONE — 2026-08-04

`scripts/pol39-live/pol011-fx-multiline.js` reports **8/8 in both themes**, on a real Text node on a
mounted page. The check that matters is the one a panel screenshot cannot give you: with the
expression set to `Noodl.Variables.pol011Greeting` and that variable set through the runtime's own
API, **the running preview rendered `Hello from a variable`**. This task's own traps list demanded
that — *check the rendered result in the preview, not the property panel's display* — and it is why
the driver reads the viewer rather than the row.

### What shipped

- **`expressionProps.ts`** — the value↔expression conversion, once. `BasicType` now spreads it
  instead of owning it.
- **`PropertyPanelInputType.TextArea`** — so a multiline property gets the *same row* as every other
  string rather than a bare `PropertyPanelRow`. That was the whole defect: the reset dot, the
  binding chip and the `fx` toggle all come from `PropertyPanelInput`, and `TextAreaType` was not
  using it. In expression mode the row shows the expression input, not a textarea, because
  `PropertyPanelInput` already does that for every type.
- **`data-property` on the row** — see the harness note below.
- Slice 3's decisions written into `Ports.ts` at the routing, as a table.

### Slice 3, answered

`CodeEditorType` (`codeeditor`) and `IdentifierType` (`identifierOf`) both get **no**, and the
reasoning is in `Ports.ts`: a `codeeditor` value already *is* code, and an identifier is a name
chosen from a set the project holds — an expression could name something that does not exist and the
picker could not show it, which is `EnumType`'s reasoning exactly.

They get no `supportsExpression: false` flag, and that is deliberate rather than an omission:
neither view renders `PropertyPanelInput` at all — `CodeEditorType` is its own editor and
`IdentifierType` is a `PickerTypeView` — so the prop would be one nothing reads. The decision is
recorded at the routing, which is the one place that makes it.

### Two harness facts

- **`node.parameters[name]` and `getParameter(name)` are different questions**, and the difference
  cost three false failures. The first is what is *stored* — `undefined` when the port sits at its
  declared default. The second resolves the default, and it is what the conversion reads when it
  captures the fallback. So a port at its default converts to an expression whose fallback is the
  default's text, and a check comparing that against the stored `undefined` reports a correct
  conversion as broken. Worth knowing beyond this task: it is the same distinction behind *a
  declared `default` never runs its setter*.

- **`data-identifier` disappears in expression mode**, because the input it is on is replaced by an
  `ExpressionInput`. So anything outside React that wanted "this port's `fx` toggle" had to pick one
  of six identical toggles by position — the "a click can land outside the panel that owns the
  button" trap with the panel right. `data-property` on the row survives the mode switch, and a
  panel-wide query had already produced one false pass: it reported an expression input present
  while this row was still a textarea, because a *different* row on the same node was in expression
  mode holding `1 + 1`.

## The mechanism — confirmed, and small

The expression affordance is real and complete: `ExpressionToggle` renders the `fx` button,
`ExpressionInput` the monospace field with the `fx` badge, and `ExpressionEditorModal` the full
editor (which advertises `Noodl.Variables.x`, `Noodl.Objects.id.prop` at
[`ExpressionEditorModal.tsx:99`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/ExpressionEditorModal/ExpressionEditorModal.tsx#L99)).

Which property rows get it is decided by **which `TypeView` a port routes to**:

| DataType | `supportsExpression` |
|---|---|
| `BasicType` (plain `string`, `number`) | **`true`** — [BasicType.ts:117](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/BasicType.ts#L117) |
| `EnumType` | `false` (explicitly) |
| `BooleanType` | `false` (explicitly) |
| `TextAreaType` | **absent** — no expression support at all |

And the routing, in
[`Ports.ts`](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/Ports.ts):

```
line 360:  isOfTextAreaType() → nameForPortType(type) === 'string' && type.multiline
line 513:  else if (isOfTextAreaType()) return TextAreaType;
```

The Text node declares its port multiline —
[`text.ts:44`](../../../packages/noodl-viewer-react/src/nodes/visual/text.ts#L44):

```ts
multiline: true
```

Button's `label` is a plain string, so it routes to `BasicType` and gets `fx`. Text's `text` routes
to `TextAreaType` and does not. **That is the entire difference**, and it is an accident of the
textarea being a separate view rather than a decision that multiline strings should not be
expressions.

`TextAreaType` is a 60-line class rendering `PropertyPanelTextArea` inside a `PropertyPanelRow`
([TextAreaType.ts](../../../packages/noodl-editor/src/editor/src/views/panels/propertyeditor/DataTypes/TextAreaType.ts)).

## What to build

**Slice 1 — the shape of the row.** `BasicType`'s expression handling is the reference and should be
lifted, not copied:

- `expressionMode: 'fixed' | 'expression'`
- `onExpressionModeChange` converting between a plain value and an expression parameter via
  `createExpressionParameter` / `isExpressionParameter`, with an undo label
- `expression` read back off the parameter

Pull that block out of `BasicType` into a shared helper both types call. Two copies of a
value↔expression conversion is exactly the sort of thing that drifts and then disagrees.

**Slice 2 — `TextAreaType` in expression mode.** In `fixed` mode it stays the textarea it is. In
`expression` mode it should show the expression input, not a textarea — an expression is one line of
code, and the multiline affordance is about the *literal*.

Check what `ExpressionToggle` expects as a sibling and whether `PropertyPanelRow` can host both.

**Slice 3 — the other string types.** `TextAreaType` is not the only string view without `fx`. From
`Ports.ts`, `type.codeeditor` (line 366) and `type.identifierOf` (line 450) also divert plain strings
elsewhere. Decide each explicitly:

- **codeeditor** — an expression inside a code field is probably meaningless; say so and skip.
- **identifierOf** — an identifier chosen from a set; likely `false`, like `EnumType`.

The point is that each is a decision recorded in the code, the way `EnumType` and `BooleanType`
already do it with an explicit `supportsExpression: false`. Absence should stop being how a type
opts out.

**Slice 4 — it works at runtime.** An expression on a multiline string must evaluate in the preview
and in a deploy, not merely render an `fx` badge in the panel. `detectDependencies` and the runtime
expression path already exist; confirm they do not assume single-line.

## Criteria

1. ✅ The Text node's `text` row shows `fx` in both themes — and still renders a textarea in fixed
   mode.
2. ✅ Clicking it switches to expression mode, keeping the literal as the fallback, and
   `Noodl.Variables.pol011Greeting` **rendered `Hello from a variable` in the running preview**.
3. ✅ Switching back restores the literal, and each direction is one undo step (`0→1`, `2→3`).
4. ✅ A save round-trips `{ mode, expression, fallback, version }` on the multiline port.
5. ✅ Decided per route and written into `Ports.ts` as a table. The two `no`s are structural — see
   above for why a flag would be dead code.
6. ✅ `expressionProps.ts`; `BasicType` and `TextAreaType` both spread it.

## Traps

- **A declared `default` never runs its setter**, and this area has been bitten by it twice. Check
  the *rendered* result in the preview, not the property panel's display.
- Port descriptions and rows render through `Ports.renderParams` — that is the seam for every
  property row, and HMR lies about it. Restart the editor.
- A saved project applies a parameter before the port exists (NDA-017). An expression parameter is a
  richer object than a string; confirm the load path tolerates it arriving early.
- Editor specs here are **jasmine, not jest**.
