# Form Fields

The component set for writing **one form by hand** — five labelled field
components with a consistent anatomy, plus a demo component showing them all
stacked. (For dynamically generated forms driven by data, use the separate
**Form** prefab instead.)

## Components

| Component | Control | Value output |
|---|---|---|
| `Labelled Text Input` | single-line text input | `Value` (string) |
| `Labelled Select` | dropdown | `Value` (string) |
| `Labelled Checkbox` | checkbox with clickable label | `Checked` (boolean) |
| `Labelled Textarea` | multi-line text input | `Value` (string) |
| `Labelled Date` | native date input (`YYYY-MM-DD`) | `Value` (string) |

The root **Form Fields** component is a demo that stacks all five (including an
error state and a disabled state) — drop it on a page to see everything, then
delete it and place the individual fields.

## Shared field anatomy

Every field has, top to bottom: a label row (label text + a destructive-red `*`
required marker), the control, and one helper/error line.

### Inputs (all optional — every input is guarded against being unconnected)

| Port | Type | Meaning |
|---|---|---|
| `Label` | string | Label text above the control (on the Checkbox it is the clickable label beside the box) |
| `Helper Text` | string | Muted line under the control |
| `Error` | string | When **non-empty**, the helper line shows this text in the destructive colour and the control border turns destructive. When empty, the field shows `Helper Text` normally |
| `Required` | boolean | Shows the `*` marker. Purely visual — validation is your graph's job (wire your check into `Error`) |
| `Disabled` | boolean | Disables the control and restyles it with the muted tokens |
| `Placeholder` | string | Text Input / Select / Textarea only |
| `Value` | string | Initial/controlled value (Text Input, Textarea, Select, Date — Date expects `YYYY-MM-DD`) |
| `Checked` | boolean | Checkbox only |
| `Items` | array | Select only — objects with `Label` and `Value` properties (see the Static Array node in the demo) |

### Outputs

| Port | Type | Fires / carries |
|---|---|---|
| `Value` / `Checked` | string / boolean | Current value of the control |
| `Changed` | signal | The user changed the value |
| `Has Error` | boolean | True while `Error` is non-empty |

## Styling

- **Tokens only**: `var(--foreground)`, `var(--muted-foreground)`,
  `var(--background)`, `var(--border)`, `var(--border-strong)`, `var(--ring)`,
  `var(--destructive)`, `var(--primary)`, `var(--muted)` — the fields pick up
  the project theme.
- **Focus is visible**: every control shows a `var(--ring)` border in its
  focused state.
- **Consistent metrics**: 40px control height (96px textarea), 6px corner
  radius, 6px label/helper gaps, 20px bottom margin per field so stacked
  fields space themselves.
- **Inter**: labels and control text use the shipped Inter Medium via the
  `Label Medium` (14px) and `Helper Small` (12px) text styles.

## Notes

- The Date field flips its DOM input to `type="date"` on mount via a small
  Script node (no external libraries). If that ever fails it degrades to a
  plain text input with a `YYYY-MM-DD` placeholder; the value is always the
  ISO `YYYY-MM-DD` string. For a fully custom calendar popup, use the
  **Date Picker** prefab instead.
- `Required` does not validate anything by itself. Typical wiring: on submit,
  check the field's `Value` in your graph and set `Error` to a message (or to
  an empty string to clear it).
