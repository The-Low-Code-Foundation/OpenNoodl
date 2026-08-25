# FB-016 — the box model you cannot see

**Filed:** 2026-08-22, test-user session, item 2.2. **Status: 🟢 BUILT AND DRIVEN 2026-08-25
(session 27) — scopes 1, 2, 3 and 5 ship; AC1–AC4 are met. Scope 4 (the transform-origin
crosshair) is the one thing left, and it is left deliberately — see *"What is left"*.** Size: M/L.

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

   ✅ **That verification is already done — 2026-08-25, session 26 confirming session 25's
   measurement.** It does not need repeating, and there is nothing to file separately. Hit-testing
   the corner pixel of a 200×200 box at 40px radius in the editor's own renderer (recorded in full
   in FB-017): an `<img>` carrying the radius itself, with nothing clipping it, **does not answer at
   its corner** — it is genuinely rounded — while the same `<img>` at radius `0` does, and every
   box's centre answered throughout. **Jordan's element rounds; the square outline on top of it is
   the overlay, exactly as suspected.** So scope 5 is a pure overlay fix with no upstream render bug
   behind it, and the radius to copy is the one on the element itself.
   ⚠️ **But do not copy the radius from the element in every case.** The same measurement found the
   opposite arrangement — a *container* with the radius and a square child at `overflow: visible` —
   answers **the child** at the corner: the corner really is square there, because the child paints
   over it. An overlay that blindly mirrors `border-radius` would round itself against a corner that
   is visibly square and start a *second* class of false report. Mirror the radius only where the
   element actually clips: itself if it is replaced (`<img>`), otherwise only under a clipping
   `overflow`.

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

---

# ✅ What was built, 2026-08-25 (session 27)

Two files, one bridge line, three spec files, one drive.

- **`packages/noodl-viewer-react/src/box-model-overlay.ts`** (new) — the whole feature, split into
  a **pure half** (geometry, the fact wording, the radius rule, the palette, the chip's placement)
  and a **DOM half** (`BoxModelOverlay`, which builds and positions the divs).
- **`highlighter.ts`** — owns one overlay and points it at the hovered node, falling back to the
  selected one; and rounds the existing teal outline by the same rule.
- **`viewer.jsx`** — `NoodlEditorInspectorAPI.setEnabled` now also calls
  `highlighter.setDesignMode`, because selection is pushed across that bridge in preview mode too
  and the highlighter cannot infer design mode from anything it can see.

## 🔴 The two things the drive changed, which no spec would have

1. **The chip was covering the elements it was explaining.** The first build placed it above the
   element, or below when there was no room above. The screenshot of a hover on `A wide 100%`
   shows it sitting squarely over `B` and half of `C` — and *"why has this gone under another
   group"* is one of the three questions it exists to answer. It now goes **beside** the element
   (right, then left, then above, then below), and the second screenshot shows the whole stack
   visible while the chip explains it. `chipPosition` is pure and specced, including the case the
   spec caught on the way: an element scrolled past the left edge has a right-hand side that is
   inside the viewport by arithmetic and off it on screen, so **both axes are clamped on every
   branch**, not only the fallback.
2. **`getComputedStyle` answers `normal`, and `normal` answers nothing.** The chip read
   *"parent packs them: normal"* — a word that leaves an author knowing less than before they
   asked. Inside a flex container `normal` behaves as the stated default, so the default is what
   the line names now. Same for `align-self`, which read `flex-start` and now reads
   **`align-self: flex-start — held to the start of its parent, not centred`**. That sentence is
   confusion #3, answered in the words the report used.

## The drive — 2026-08-25, fixture `NodeGX test projects/fb016-drive`

Nine predictions were written down **before** looking (`fb016-predictions.md`, scratchpad), each
with the observation that would falsify it. All nine settled; none was falsified.

| # | Claim | What was measured |
| --- | --- | --- |
| P1 | AC1 geometry is the *running* box | overlay's content region `x 20 y 20 360×60` == the element's content box computed independently in the same eval from `getBoundingClientRect` + `getComputedStyle`. **Exact, all four sides.** |
| P2 | AC2 #1 "full width" | `width: 100% of the parent` — 🔴 and the element is **360px wide**, so the computed value would have said `fixed 360px`. The specified value is the only thing that answers this question. |
| P3 | AC2 #2 "gone under" | both `position: relative — flows after its siblings` and `parent stacks its children in a column` |
| P4 | AC2 #3 "not centred" | `C` → `align-self: flex-start — held to the start of its parent, not centred`; control `D` → `align-self: center — centred across its parent`. **The two differ**, so the line is reading alignment and not printing a constant. |
| P5 | scope 3 overflow | `overflows its parent: 140px past the right` — parent 400 wide with 20px padding each side is 360 of content, child is 500 |
| P6 | AC3 hit-testing | with the overlay drawn, `elementFromPoint` at the element's centre and inside its top-left corner both return **the element**; in the margin band it returns the page beneath. Nothing ever landed on an overlay div. |
| P7 | scope 5 radius | five arms, and they **disagree** — see below |
| P8 | design-mode gate | `setEnabled(false)` → chip gone (`display: none`) **while the teal selection outline still drew at 360×60**. An absence beside a known-firing signal. |
| P9 | the hover path | the overlay is produced by a `mousemove` reaching the Inspector's capture-phase listener, not only by a programmatic `selectNode`. ⚠️ A synthetic event on the same listener, not an OS-level pointer. |

### P7 in full — the radius rule discriminates

| arm | element | overlay outline |
| --- | --- | --- |
| R1 | `Group` radius 40, `overflow: visible`, one child over the corners | **0px** |
| R2 | the same, `overflow: hidden` | **40px** |
| R3 | `Group` radius 40, `overflow: visible`, **no child** | **40px** |
| R4 | control: radius 0, child, visible | **0px** |
| R5 | `<img>` radius 40, nothing clipping | **40px** — Jordan's case |

**R1 ≠ R2 is the row that matters**: the two differ only in `overflow`, so the clip rule is being
read rather than the radius being copied. R4 at 0 says a passing row is not the function returning
its input. Re-measured after the wording changes, on the rebuilt bundle, unchanged.

## AC4 — and why it is not a row in the PAIRS table

AC4 asked for PAIRS rows. **PAIRS is the wrong table for this and the ask is answered better
elsewhere**, deliberately and with the reason stated in the spec:
`noodl-editor/tests-unit/nat-001/palette-contrast.spec.ts` grades **named design tokens** resolved
from `colors.css` in the editor's two themes; this overlay paints inside the preview webview, over
a document the *author* wrote, where those tokens do not exist (`PreviewTokenInjector` injects the
**project's** tokens, never the editor's). A row naming `--theme-color-*` would describe a pairing
that never occurs.

So `tests/fb-016-overlay-contrast.test.ts` asks the same question of the right population, and it
is a **stronger** claim than "both themes": *every* ground.

- 🔴 **No single colour can hold 3:1 against both black and white** — it needs a relative luminance
  above ~0.10 to clear black and below ~0.30 to clear white, and a colour in that band is a
  mid-tone that then fails against mid-tone content. **Today's teal selection outline `#2CA7BA`
  measures 2.86:1 against white**, below the non-text floor. It is in the spec as the control that
  proves the instrument can fail.
- ✅ **So every structural edge is drawn twice**, `#14181C` and `#F4F6F8`, and what is graded is the
  better of the two swept across all 1001 ground luminances at 0.001 resolution. **Worst case
  4.06:1**, at a mid grey.
- Chip text and band numbers paint their own opaque ground: 17.84:1 and above, at the 4.5 floor,
  with no large-text relief claimed (11px monospace).
- ⚠️ **Not graded, and said out loud**: the tinted region fills. They are identification — the
  DevTools dialect an author may already know — and they sit over content of unknown colour by
  design. Whether a tint is legible over a photograph is a drive's question, not that file's.

## Gates

- `packages/noodl-viewer-react`: **78 files / 1012 specs / 0 failures**. The floor without the
  three new files, measured the same afternoon by ignoring them: **75 / 965**. The delta is exactly
  this work.
- `npm run typecheck:viewer`: **0 errors**.
- `npm run test:main`: **325 files / 5240 specs / 0 failures** — identical to session 26's floor.

## ⚠️ What is left, and one thing found on the way

- **Scope 4 — the transform-origin crosshair — is NOT built.** Everything above lives in the
  viewer and needs nothing from the editor; the crosshair is the one scope that does, because the
  trigger is *"while the transform-origin field has focus"* and only the editor knows that. It
  needs a new call on the highlight bridge plus a focus/blur hook on that one property input. It is
  a clean, separable piece of work and is left as one.
- ⚠️ **The auto-margin branch of the alignment fact is written and specced but was NOT exercised by
  the drive.** `Layout.align` uses `auto` margins only when the parent lays out in a **row**; the
  fixture's parent is a column, so every arm went down the `align-self` path. The row case is
  graded in `fb-016-box-model-overlay.test.ts` and unobserved in a running app.
- ⚠️ **A hand-written `rootComponent: "App"` in `project.json` did not give the project a home on
  its first open** — `ProjectModel.getRootNode()` was `null` and the viewer drew `NoHomeError`,
  and calling `setRootComponent` from the console fixed it. On a later open of the *same* file it
  resolved correctly at load. **Not characterised, and deliberately not filed as a defect**: the
  difference between the two opens was not isolated.
- The existing highlighter's disposal bug (a *selected* node whose element has gone is never
  removed from `selectedNodes`) is untouched and still recorded in `highlighter.ts`.
