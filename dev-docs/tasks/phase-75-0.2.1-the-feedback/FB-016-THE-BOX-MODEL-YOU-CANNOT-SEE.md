# FB-016 — the box model you cannot see

**Filed:** 2026-08-22, test-user session, item 2.2. **Status: ⬜ open — design mode exists, the
overlay doesn't; no task anywhere proposes it.** Size: M/L.

> *"When in design mode, make mousing over elements show their CSS props as a visible overlay,
> the same as when you're in devtools in a browser and you use the element inspector. Show
> margin and padding boxes around the element, any position changes, anything we can show that
> would help users visually see why that group has taken up the whole width or gone under
> another group or why it's not centred etc."*

The user this serves is the one FB-017 describes: he was cycling Pos X / Transform X / margin /
padding trying to move an image. The overlay is how the editor *shows* what those properties
did; FB-017 is how it stops offering all of them at once.

---

## Ground truth (verified 2026-08-22)

- **Design mode exists and hover inspection already works**: DES-001 ("inspect mode *is* design
  mode", `CanvasView.ts:306`) — the viewer's `Inspector` (`noodl-viewer-react/src/inspector.ts`)
  captures pointer events, resolves DOM → fiber → `noodlNode`, and fires highlight/inspect over
  the `NoodlEditorInspectorAPI` bridge (`viewer.jsx:14–50`, driven from `CanvasView.ts:128,
  316–318`). ⚠️ DES-001 has **no task file** — its spec is the body of commit `40e6252c`.
- **The highlight is a bare outline**: `highlighter.ts:63–110` — one `pointer-events: none` div,
  `outline: 2px solid`, positioned from `getBoundingClientRect()`. No margin/padding boxes, no
  size label, no spacing readout.
- **The visual language already exists in the panel**: `MarginPaddingInput.tsx` draws the
  DevTools-style nested boxes. The overlay should speak the same dialect (same hues for
  margin vs padding) so panel and canvas teach each other.

## Scope

Extend the highlighter, not the editor chrome — everything needed (computed styles, rects) is
readable on the viewer side where the highlight div already lives:

1. **Box-model overlay** on hover/selection: content / padding / margin as tinted regions
   (browser-devtools palette conventions), with px labels on non-zero sides.
2. **A fact line** (small floating label, like the existing design-chrome toast): rendered
   size, and the *explanatory* facts — `position` if not static, width/height source
   (`fixed 300px` / `100%` / content-driven, from the node's sizeMode), and flex
   alignment of the **parent** when it's what's placing the element.
3. **The "why" cues where cheap**: element extends beyond parent → paint the overflow region;
   margin collapsed/auto-centering → label it. Keep this list honest: each cue ships with a
   driven before/after, or it doesn't ship.
4. 🆕 (Jordan session 2, §6) **Transform-origin crosshair**: while the transform-origin field
   has focus, draw a crosshair at the resolved origin point on the canvas — *"Photoshop has
   had this forever."* Percentages resolve against the element (that ambiguity was
   half the confusion — the crosshair answers it by existing).
5. 🆕 (Jordan §7) **The highlight must follow border-radius.** Today's selection outline is a
   rectangle (`highlighter.ts` uses a plain outlined div); Jordan read a rounded element
   under a square outline as *"corner radius rendered as a box outline — possible render
   bug."* The element almost certainly rounds; the overlay lies on top of it. Rounding the
   overlay (copy the element's computed radius) removes a whole class of false bug reports —
   verify Jordan's case actually renders rounded while fixing it, and file separately if it
   truly doesn't.

## Acceptance criteria

- AC1: hovering in design mode shows margin/padding/content regions with values; matches
  `getComputedStyle` in the running viewer, not just the stored parameters.
- AC2: the fact line answers the session's three actual confusions — full-width group ("width
  100%"), stacked-under ("position static — flows after sibling"), not-centred (parent
  alignment shown) — driven on a reconstruction of each.
- AC3: overlay is `pointer-events: none` and does not perturb hit-testing or the existing
  inspect click-through (the Inspector's capture-phase listeners keep working).
- AC4: overlay colors clear contrast on arbitrary user content (semi-transparent fills, both
  themes' outlines measured — the PAIRS table takes new rows for the label text).

## Traps

- Measure in a second eval, never the same one that toggled state (a React write is invisible
  in the same eval).
- `scroll*` readings are integer-rounded — use rects/`scrollLeft` where the overlay math needs
  sub-pixel truth.
- The highlighter's window-border branch is dead code (`highlighter.ts:73`) — don't build on it.
