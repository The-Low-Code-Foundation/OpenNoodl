---
title: "Color"
---
Per-instance color holder: stores one color locally so many visual inputs can share a single editable source.

Color holds a single color value that belongs to this node instance alone, defaulting to '#f1f2f4'. The `value` input sets it (via the editor's color picker or a connection) and `savedValue` (Value) reads it back. While the `saveValue` (Set) signal input is unconnected, values written to `value` apply immediately; once `saveValue` is connected the node latches: incoming values are held pending and only applied when Set fires. Unlike the Boolean/Number/String holders it applies no cast — the value passes through unchanged. Browser-only; not available in cloud functions. `changed` fires only when the stored value actually changes; `stored` fires after every Set trigger.

## When to use it

Use it as a single source of truth for a color used in several places — wire `savedValue` to every `backgroundColor`, `color` or border input that should match, and edit one node to restyle them all. For project-wide theming prefer style colors; a String can also drive color inputs (any CSS color string casts), but Color gives you the picker.

## At a glance

| | |
|---|---|
| Category | Variables |
| Type name | `Color` |
| Available in | browser |
| SSR compatibility | safe |
| Provided by | `noodl-viewer-react` |

## Inputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `runOnChange-value` | Boolean | `true` | Whether a new value on Value re-runs this node. On by default; untick to make this input passive so only the control signal runs it |
| `treatEmptyAs` | Enum (`null`, `empty-string`) | `null` | Back-compat for graphs written before Variables were nullable. `null` (default) keeps a cleared value distinguishable from a real "". Choosing another option restores the pre-NDA-003 coercion for authors who relied on it. |
| `treatUnchangedAs` | Enum (`unchanged`, `done`) | `unchanged` | What this node reports when the action was valid and there was nothing to do. Unchanged (the default) keeps it a third outcome of its own. Done suits a project whose chains should carry on either way. Completed fires whatever this is set to. |
| `value` | Color | `#f1f2f4` | The empty-value contract (dev-docs/reference/EMPTY-VALUE-CONTRACT.md): `undefined` abstains and leaves the Variable's stored value untouched. `null` is a real value — it clears the Variable, is stored, and fires Changed. What "cleared" is stored as is controlled by `Treat empty as` (null by default). |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `saveValue` | Signal | — | Stores the latest value now. This is additional to Value storing on change; untick Value under Run On Value Change to stop that |

## Outputs

### Values

| Name | Type | Default | Description |
|---|---|---|---|
| `savedValue` | Color | — | Can be `null` — a cleared Variable (see `value`'s description) stores and emits null by default, not this type's zero value, unless `Treat empty as` says otherwise. |

### Signals

| Name | Type | Default | Description |
|---|---|---|---|
| `changed` | Signal | — | Fires whenever the stored value actually changed, however it was reached — including Value writing straight through under Run On Value Change. It is a value-level event, not the outcome of a Set |
| `completed` | Signal | — | Fires after every invocation, whatever the outcome — wire this to carry on regardless. Failure still fires and still carries its reason, so this cannot hide an error |
| `done` | Signal | — | Fires when a Set stored a value the Variable was not already holding |
| `unchanged` | Signal | — | Fires when a Set stored the value it already held, so nothing changed. ⚠️ With Value left ticked under Run On Value Change this is the common case, because Value has already stored by the time Set fires |

## Patterns

- One accent color: `savedValue` → several nodes' `backgroundColor`/`color` inputs, so a design tweak is one edit.
- Runtime theme switch: a Switch or States feeds `value`, and every connected visual updates together.

## Examples

**File picker with a shared accent color and a viewport-aware hint**

Three utility shapes in one small screen. A Color node is the single source of truth for the accent: its savedValue fans out to the title's text color and the button's background, so one edit restyles both. The Button's onClick fires Open File Picker's open — the dialog must come from a user gesture — and after a pick the file's name flows into a Text while `done` latches a Boolean (value pinned true) that reveals the result row as a level; closing the dialog with nothing chosen reports `unchanged` instead. Screen Resolution's width feeds an Expression (width < 600) whose boolean drives the compact hint's visibility, updating live as the window resizes.

## Related nodes

[Boolean](./boolean.md), [Number](./number.md), [String](./string.md), [Variable](../data/variable2.md), [Group](../visual/group.md), [Text](../visual/text.md)


:::info Generated
This page is generated from `node-catalog-enriched.json`. Do not edit it by hand — run `npm run docs:nodes` to regenerate, and fix the source enrichment instead.
:::
