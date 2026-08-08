# BEN-004 — The bench surface: one preview, two modes, no confusion

**Status:** 🟡 **built** (2026-08-08, session 2) · ⭐ · owns **R1–R5** · Live criteria: see Acceptance

Built as a **mode of `VisualCanvas`**, which is the preview surface itself — not a new panel, not a
new document. Where each rule landed:

| File | What |
|---|---|
| [`previewScope.ts`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/previewScope.ts) | the scope/frame model, pure and specced — which components may be mounted, what the width field does with junk, what the read-out claims |
| [`VisualCanvas.tsx`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/VisualCanvas.tsx) | the mode, the strip, R3's hide-don't-unmount |
| [`PreviewChrome.tsx`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/PreviewChrome.tsx) | the scope control (searchable) and the frame control |
| [`ComponentBench.tsx`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/ComponentBench.tsx) | the bench stage — `buildBenchExport` + the sandbox webview |
| [`views/SandboxSurface/`](../../../packages/noodl-editor/src/editor/src/views/SandboxSurface/) | §7's shared toolbar and viewer plumbing; `SandboxPreview` now uses both |
| [`benchRequest.ts`](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/benchRequest.ts) | §6's entry point channel, including the detached case |

**Driven in a live editor** on 2026-08-08 against `ecommerce-example`; every criterion below is
ticked with measured evidence, and the drive found two real defects and confirmed register **B4**.

**Deviations and open questions are registered — B6, B7, B8, and the drive's B9/B10 — in the
[README](README.md).** Read them before extending this, and read **B10 before driving anything**.

## The constraint this task exists to satisfy

Richard, on the whole point of the phase:

> *"without messing up the existing preview display too much or making them feel lost between the
> 'full app' preview and a fabricated per component preview"*

Everything below is downstream of that sentence. The failure mode to design against is not ugliness,
it is **a builder who does not know which of two things they are looking at** — and, worse, who
concludes the app is broken because they were looking at a component.

## Build

### 1. The mode selector lives in the existing preview toolbar (R1)

Not a new panel. Not a new document. The preview surface gains a scope control:

```
[ App ▾ ]   1280 × 800 · 100%
```

opening to the app plus a searchable list of components. Selecting one switches the surface to bench
mode; the control then reads `[ ProductCard ▾ ]` and is the same control in the same place.

Two live previews in two panels is the design that guarantees the confusion. There is one preview
surface with a mode.

> **Built as:** a 30px strip at the top of `VisualCanvas`, present in both modes. The mock above is
> the tell — `1280 × 800 · 100%` is `VisualCanvas`'s own `.ViewportInfo` string, so "the existing
> preview toolbar" is the *preview surface's* chrome and not `EditorTopbar`. That reading was taken
> deliberately: the topbar's two layout breakpoints are measured arithmetic (POL-019, `1010` and
> `710`, derived from the widths of the controls in them), and a wide new leftmost control there
> would have broken both. Register **B6**.
>
> The picker is an ordinary absolutely-positioned panel inside the surface rather than a
> `MenuDialog`: it needs a search field, and a portalled menu opened by a synthesised `.click()`
> never closes, which has cost a live-QA session here before.

### 2. The bench never renders full-bleed (R2)

In bench mode the stage is visibly a stage:

- the component inset and centred, at its chosen frame width, on a surface that is **not** the app
  background — use the canvas surface token, not white, so it reads as "workbench" instantly;
- a persistent strip naming what is mounted and that it is isolated;
- the frame edge visible.

This is the strongest orientation cue available and it costs nothing. A badge can be missed; a
different-looking screen cannot.

Colour rule from phase 23 holds: **red means danger only.** The bench is not an error state.

### 3. Keep the app preview alive (R3)

Do **not** unmount the app webview when switching. Hide it, keep it running, show it again on
switch-back — the route the user had navigated to, the form they had half-filled, the scroll
position, all still there. A round trip should be instant and lossless.

This is the actual fix for "feel lost". A user who can flick between the two at no cost stops
worrying about which one is authoritative, because checking is free.

⚠️ Related trap, from the same family: **closing a webview CDP target white-screens the editor**
(POL-012). Hiding is not closing; make sure the implementation hides.

⚠️ `PreviewTokenInjector` held exactly one webview before AIX-008 and now holds a set — the bench is
a **third** surface. Verify the tokens actually reach it; an unstyled bench is the phase-55
`var()`-unresolved failure wearing a new hat.

> **Built as:** both stages are absolutely-positioned siblings of one `.Stages` box, and the inactive
> one is hidden with `visibility: hidden` — never `display: none` and never unmounted. Two reasons,
> and the second is the one that would have bitten: hiding is not closing (POL-012), *and*
> `CanvasView.updateViewportSize` computes zoom-to-fit from `getBoundingClientRect()`, so a
> `display: none` ancestor would hand it a zero and the user would come back to a zero-width preview.
>
> The **bench** stage is unmounted on the way back to app mode, which is not symmetric and is
> deliberate: R3 names the app preview, and keeping a second live runtime resident forever is the
> memory cost the Risks table below says to measure rather than assume. Register **B7** — the round
> trip is lossless in the direction the criterion names and reloads in the other.
>
> Token injection reaches the bench through `useSandboxViewer`, which registers the webview with
> `PreviewTokenInjector` exactly as the AI preview does. It is a **callback ref**, not the
> `[ref.current]` effect dependency the AI preview used to use — that dependency is evaluated during
> *render*, when the ref still holds the previous element.

### 4. One way back (R4)

The mode selector itself is the way back, in the same position in both modes. No second "exit"
affordance, no modal, no separate close button that means something different from the panel's.

### 5. Frame width control

A component in isolation has no page to inherit width from, so the bench must ask rather than guess.
Small / Medium / Large chips plus a numeric field, displayed the way the app preview already displays
its viewport size ([VisualCanvas.tsx:78-81](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/VisualCanvas.tsx#L78-L81),
`CanvasView.setViewportSize` at [:227](../../../packages/noodl-editor/src/editor/src/views/VisualCanvas/CanvasView.ts#L227)).
Plus a **stretch** toggle, which answers the commonest isolation lie: "it only looked right because a
flex parent stretched it".

> **Built as:** Small 360 / Medium 768 / Large 1280 chips, a numeric field committing on blur or
> Enter, and a Stretch toggle. The width is applied to the **webview element**, so it is measurable
> in the rendered document rather than inferred from a parameter — that is B3's whole argument, and
> it is why no Group wrapper was injected into the graph.
>
> Two rules the field follows that only a spec can check. Junk keeps the current width instead of
> becoming `NaN` — a `NaN` reaching a style property is phase-55's `"NaNpx"` defect, where the
> property was *deleted* and the styling vanished with no message. And the read-out prints the width
> that was **measured**, never the width that was asked for: the stage has padding, a stretched frame
> is narrower than the stage by it, and a frame wider than the stage scrolls. A read-out that echoed
> the request would be the tool built to catch a wrong width quietly reporting one.
>
> ⚠️ **What `stretch` does to a *rendered* component is still unmeasured** (register B3). What it
> does at this end is exact and is all the control claims: the frame stops being a fixed width and
> becomes the stage. Register **B8** — whether that is the same thing a flex parent does to a child
> is BEN-007's to settle, live.

### 6. Entry points

- **Components panel → right-click → "Preview in isolation"**, which switches the preview surface to
  bench mode on that component. This is the entry the feature will actually be used through.
- The mode selector's own dropdown.
- The AI build panel's component mode already lands on this preview surface (AIX-008) — BEN-006
  extends what it can do there; this task must not disturb it.

> **Built as:** `benchRequest.requestBenchMount(legacyName)`, which both emits on the global bus and
> **parks** the target. The parking is not belt-and-braces: in the `detachedPreview` layout the
> preview is its own window and `VisualCanvas` is not rendered at all, so an event fired at it lands
> nowhere and the menu item does nothing. `EditorDocument` re-attaches the preview when it sees the
> request, and the surface claims the parked target when it mounts — which is after that state
> change, not during it. Re-attaching someone's window layout is intrusive; doing nothing at all is
> worse, and a menu item that only sometimes works is worse still.
>
> The item is not offered for a cloud function: `/#__cloud__/…` executes in the cloud runtime
> (WFA-001) and the bench is a browser viewer, so mounting one would fail and read as the
> component's fault. `benchTargets()` filters the picker on the same rule, in the same place it is
> written down.

### 7. Inherit the existing toolbar for free

The sandbox toolbar already carries **Sample data / Real backend** and **Sign in / Sign out**
([SandboxPreview.tsx:183-211](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L183-L211)).
The bench gets both by using the same component. Do not build a second toolbar; do not offer
"signed out" against a real backend — the existing code already declines that, correctly, and the
comment explains why.

> **Built as:** [`views/SandboxSurface/`](../../../packages/noodl-editor/src/editor/src/views/SandboxSurface/) —
> `SandboxToolbar` (summary, notice chip, Sign in/out, Data, Sample/Real) and `useSandboxViewer` (the
> client id, the export provider, token injection, the URL). `SandboxPreview` was refactored onto
> both; its behaviour is unchanged and its own module shrank by the same amount. The bench therefore
> gets BEN-006's **Data** panel for free, which makes BEN-006 a two-client feature rather than a
> one-surface one — and that is the standing constraint doing its job rather than a bonus.

## Acceptance

Driven 2026-08-08 against `ecommerce-example` in a real editor, over CDP. Evidence is the read DOM
and the measured document, not the export JSON.

- [x] There is exactly one preview surface in the editor after this task. `grep '<webview'` over
      `packages/noodl-editor/src` returns three: the app preview (`VisualCanvas`), the AI review
      document's (`SandboxPreview`, pre-existing, AIX-008, a *document* rather than a panel), and the
      bench — which is a mode of the first and mounts only in bench mode. **No new persistent preview
      panel.** State it that way; "exactly one preview surface" was already untrue before this task.
- [x] **Live:** R3, and by stronger evidence than the criterion asks for. A `window` global and a
      scroll position were planted in the app preview, then app → bench (ProductCard) → bench
      (SiteHeader) → app. Afterwards: `window.__benchR3` still held its *original* value and
      `scrollY` was still `900`. A window global cannot survive a reload, so this proves the webview
      was never torn down — which a restored form value would not have. ⚠️ The project had no text
      input on its home page and only one route, so the criterion's own two artefacts were not the
      ones used.
- [x] **Live:** the two screenshots are unmistakable — app mode is a full-bleed page edge to edge;
      bench mode is a framed card inset on a flat black stage under a strip reading
      *"ProductCard — isolated component, not the app"*. No text needs reading to tell them apart.
- [x] **Live:** design tokens resolve. `<style id="noodl-design-tokens">` is injected into the bench
      webview (4921 chars) and `var(--primary)` computes to `rgb(180, 82, 47)` = the project's
      `#b4522f`. Not grey.
- [x] Right-click → **Preview in isolation** works from the components panel, and switches the
      existing surface rather than opening anything.
- [x] The frame width control changes the **measured** document width. `document.documentElement.clientWidth`
      inside the bench webview, per setting: Small → `360`, Medium → `768`, Large → `1280`, field
      `320` → `320`, Stretch → `884` in a 916 stage. The strip's read-out matched the measurement in
      every case. This also closes **BEN-001**'s "frame width set to 320 measures 320".
- [x] Bonus, and the standing constraint paying off: BEN-006's **Data** panel opens on the bench with
      no bench-specific code, and correctly reports *"This preview reads no collections, so there is
      no data to stand in for"* for a component that reads none.

### What the drive found that a spec could not

1. **`useTrackBounds` calls `observer.observe(ref.current)` with no null guard**, in a *layout*
   effect. A ref on a conditionally-rendered element therefore did not degrade to "no measurements" —
   it threw and took down the whole React tree it was used in, and the editor lost its entire preview
   panel. Fixed in two places: the frame is now rendered unconditionally, and the hook guards (the
   two lines below it already used `ref.current?.`, so the guard is a consistency fix). ⚠️ The guard
   is not a substitute for mounting the element — the effect keys on `[ref]`, which never changes.
2. **Flex centring clipped the frame's left edge when it was wider than the stage.** Measured: frame
   at 1280 in a 916 stage sat at `x = -1138` with `scrollLeft` unable to reach it, and only 1114 of
   1280 was ever visible. A frame you set to 1280 and can only see 1114 of is exactly the wrong-width
   lie this control exists to catch. `justify-content: center` → `margin: auto` on the item.
3. **B4 is confirmed, on the first component ever mounted.** `ProductCard` reports **0 inputs,
   11 outputs**, and the summary names all eleven: they are declared on a `Component Inputs` node
   with plug `"input"`, which publishes them as component *outputs*. The card renders as an almost
   empty box with placeholder text, and the bench is the first surface in this product that says why
   rather than leaving a builder to conclude the component is broken. See the register.

### Observations for BEN-007, not defects

- `SiteHeader` renders `Text | Text | Text | Text | Text | Text` on the bench while the app shows
  *KILN & CO. / Shop / Ceramics / Coffee / Table*. It declares 0 inputs and 0 outputs, so nothing can
  be feeding it from a parent — the cause was **not** established. This is the README's own "a
  component isolated from its page can lie" arriving on cue, and it is what BEN-007 should chase.
- Driving traps, both costly and both recorded in the handover: an **occluded** Electron renderer
  delivers no `requestAnimationFrame` and therefore **no `ResizeObserver` callbacks**, which makes
  every measured read-out look frozen; and `MenuDialog` renders each row **twice**, only the second
  of which handles the click.

## Risks

| Risk | Mitigation |
|---|---|
| A hidden-but-running app preview costs memory or keeps hammering a backend | Measure it. If it is real, pause rather than unmount, and say what pausing changes |
| The mode selector gets lost in a crowded toolbar | It is the leftmost control and it is the widest. It names the subject of everything else on screen |
| Bench mode becomes a place people ship from | The toolbar states the hierarchy; BEN-007 checks a user can say which is authoritative |
