# FIX-020 — The popup that clips its buttons

**Report 15** · Tier 2 · Effort **S**

> *"A lot of the small popups, like adding a port to a component inputs node, the popup buttons
> are cut off at the bottom of the text."* (screenshot `new-port-1.png`)

## Mechanism — pinned. It is NOT BaseDialog.

The "New port name" prompt is `PopupLayer` + `StringInputPopup`
(`componentports.tsx:256-279`), a different subsystem from `BaseDialog`'s measuring copy.

**Two stylesheets both style `.string-input-popup*` — the only class family duplicated between
them — and only one knows about the redesign:**

- Legacy `assets/css/style.css:765-820` (a `<link>` in `index.html:7`):
  `.string-input-popup-buttons { height: 30px; padding: 5px }`,
  `.string-input-popup-button-ok/-cancel { height: 100% }`.
- Modern `styles/popuplayer.css:720-755` (style-loader-injected **after** the link, wins ties):
  flex row + `padding: 8px 20px; font-size: 13px` on the buttons — but **never resets `height`**.

The cascade is per-property, so each button computes `height: 100%` of a `30 − 2×5 = 20px` row
**and** `padding: 8+8`, under the global `box-sizing: border-box` reset → **4px of content box for
a 13px/600 label** → the label overflows and Chromium clips it. Exactly the screenshot.

Secondary contributor: `PopupLayer.showPopup` pins the shell to the measured height
(`popuplayer.ts:584-588, 605-611`) with no `overflow` on `.popup-layer-popup`; the documented
workaround `hasDynamicHeight: true` (`popuplayer.ts:566-573`, used by `EditorClipboard.ts:329-336`)
is not passed at `componentports.tsx:274`.

## Fix direction

1. **Delete the legacy block** `assets/css/style.css:765-820` outright — all of it is superseded
   by `popuplayer.css:604-755`, and deleting removes the whole trap. (Do **not** retire the rest of
   `style.css` here — it carries the F20 box-sizing reset.) Minimal alternative: `height: auto` on
   the three selectors in the modern block.
2. Pass `hasDynamicHeight: true` at `componentports.tsx:274` and `:355` so the shell can never be
   shorter than its content.

## Every caller that gets the same fix for free

`componentports.tsx:256` (New port name) · `:339` (New group name) ·
`useComponentActions.ts:449` (New folder name) · `ComponentTemplates.ts:64` (new component /
cloud-function name) · `NodeGraphEditorNode.ts:596` (canvas comment editor, the one `multiline`
caller). Not affected (different components): `AddNewPagePopup`, `PopupMenu`,
`ExtractToComponentPopup`, the `BaseDialog`/`MenuDialog` family.

🔴 **Verify first:** `getComputedStyle` on `.string-input-popup-button-ok` — expect
`height: 20px; padding: 8px 20px`. If `height` reads `auto`, the shell pin is the primary cause
and fix 2 leads instead.

## ✅ BUILT 2026-08-14 — mechanism confirmed in source, exactly as pinned

Both stylesheets read and confirmed: legacy `style.css:765-818` sets
`.string-input-popup-buttons { height: 30px; padding: 5px }` and `height: 100%` on both buttons;
modern `popuplayer.css:720-754` sets `padding: 8px 20px; font-size: 13px` and **never resets
`height`**. Per-property cascade under the F20 `border-box` reset → 30 − 10 = 20px row, 20 − 16 =
**4px content box for a 13px/600 label**. A second victim found while reading: the single-line input
carries *both* `-input` (legacy `margin: 5px`) and `-singleline` (modern `width: 100%`), so it also
overflowed its 320px popup by 10px.

**Fix 1 — the legacy block deleted outright**, per the task's recommendation rather than the
`height: auto` minimal alternative: the whole block is superseded and a second copy is what caused
this. Checked before deleting that dropping `display: flex; flex-direction: column` is inert — every
child is a block or a flex container in its own right, and the 12px/16px margins do not collapse
across the input between them, so block flow stacks identically. A comment at the deletion site
records the trap so the block is not reintroduced.

**Fix 2 — `hasDynamicHeight: true` at all five call sites**: `componentports.tsx` (New port name,
New group name), `useComponentActions.ts` (new component/cloud function, New folder name),
`NodeGraphEditorNode.ts` (the canvas comment editor, the one `multiline` caller).
`PropListInput`/`StringListInput` no longer use this popup at all (ERG-003 §3 replaced them), so
the live caller list is five, not six.

**Still open:** all three acceptance criteria are visual and need the drive + screenshot against
`new-port-1.png`.

## Acceptance criteria

1. "New port name": Add and Cancel labels fully visible, both themes. Screenshot vs `new-port-1.png`.
2. Same check on New group name, New folder name, new-component prompt, and the canvas comment
   editor (multiline — the tallest case).
3. No popup paints content outside its background (the shell-pin symptom).
