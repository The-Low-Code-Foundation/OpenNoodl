# States Kit

The four states every list and screen has — and almost no built screen shows. A
screen that renders nothing should say so. Drop exactly the component you need:

| Component | What it is | Inputs | Outputs |
|---|---|---|---|
| `States Kit/Loading` | Inline spinner (32px arc, `var(--primary)`), sized to its content — put it wherever the data would be | — | — |
| `States Kit/Loading Overlay` | Full-area variant: an absolute overlay covering its parent, with a backdrop in `var(--background)`, a spinner and a label | `Visible` (boolean), `Label` (string, default "Loading…") | — |
| `States Kit/Empty` | Glyph + title + hint, centred, plus an optional action button | `Title`, `Hint`, `Action Label` (strings), `Show Action` (boolean, default false) | `Clicked` (signal, from the action button) |
| `States Kit/Error` | Glyph + title + message + a Try-again button | `Title`, `Message`, `Retry Label` (strings) | `Retry` (signal) — wire it back into the fetch that failed |
| `States Kit/Skeleton Text Row` | One pulsing placeholder bar (full width, 14px). Stack a few while a list loads | — | — |
| `States Kit/Skeleton Card` | Pulsing card: avatar block + two lines, on `var(--surface)` with a `var(--border)` border | — | — |
| `States Kit/Demo` | All of the above in one column, for a quick look. Delete it when you have seen it | — | — |

## Post-install notes

- **Overlay stacking**: `Loading Overlay` positions itself absolutely at 100% ×
  100% of its parent. Place it as the *last* child of the group it should cover
  (or give it a `zIndex`), and drive `Visible` from your loading state.
- **Icons**: Empty and Error use the Lucide icon set (`icon-inbox`,
  `icon-alert-triangle`) that every new NodeGX project ships with (POL-006). In
  a project without the Lucide module the glyph will not draw — swap the Icon
  node's source for one your project has, or install the `lucide-icons` module.
- **Colours** are all design-token references (`var(--primary)`,
  `var(--muted)`, `var(--foreground)`, `var(--destructive)`, …), so the kit
  follows your project theme automatically; retheme with the token panel or
  `set_project_tokens`, not by editing the components.
- **Reduced motion**: the spinner and skeleton animations are disabled under
  `prefers-reduced-motion: reduce` (see the `CSS Definition` node each
  component carries).
- Typography is Inter (`fonts/Inter/Inter-Medium.ttf`, ships with the prefab).

## Replaces `loading-spinner`

This kit absorbs the old `loading-spinner` prefab (a full-screen popup with a
hard-coded white backdrop and an SVG spinner, no tokens). Its show/hide counter
pattern — N overlapping requests, one spinner — is easy to rebuild over the
overlay: keep a Number variable of in-flight requests and wire
`count > 0` into `Loading Overlay → Visible`.
