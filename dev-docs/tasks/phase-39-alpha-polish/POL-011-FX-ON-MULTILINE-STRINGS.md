# POL-011 — `fx` on the Text node's text field

Covers reported item **13**.

## What was reported

> Can you add the 'fx' option to the text node's 'text' field?
>
> Lots of the nodes have an fx option, for example the Button node 'label' field. You click fx and
> you can type like `Noodl.Variables.foo`.

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

1. The Text node's `text` row shows `fx`, in both themes.
2. Clicking it switches to expression mode; `Noodl.Variables.foo` there renders that variable's
   value in the preview.
3. Switching back to fixed restores the literal, and both directions are one undo step.
4. A saved project round-trips an expression on a multiline port.
5. Every string-ish DataType declares `supportsExpression` explicitly, true or false.
6. The value↔expression conversion exists once.

## Traps

- **A declared `default` never runs its setter**, and this area has been bitten by it twice. Check
  the *rendered* result in the preview, not the property panel's display.
- Port descriptions and rows render through `Ports.renderParams` — that is the seam for every
  property row, and HMR lies about it. Restart the editor.
- A saved project applies a parameter before the port exists (NDA-017). An expression parameter is a
  richer object than a string; confirm the load path tolerates it arriving early.
- Editor specs here are **jasmine, not jest**.
