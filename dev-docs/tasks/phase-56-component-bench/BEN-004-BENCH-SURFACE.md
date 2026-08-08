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

**Deviations and open questions are registered — B6, B7, B8 in the [README](README.md).** Read them
before extending this.

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

- [ ] There is exactly one preview surface in the editor after this task. Grep proves no second
      persistent preview panel was added.
- [ ] **Live:** switch app → bench → app with the app preview navigated to a non-home route and a
      text field typed into. Both survive. This is R3 and it is the acceptance criterion that matters
      most.
- [ ] **Live:** a screenshot of bench mode and one of app mode are unmistakable at a glance, with the
      window title cropped out. If a reviewer has to read text to tell them apart, R2 failed.
- [ ] **Live:** design tokens resolve in the bench — a token-coloured component is not grey.
- [ ] Right-click → Preview in isolation works from the components panel.
- [ ] The frame width control changes the measured document width.

## Risks

| Risk | Mitigation |
|---|---|
| A hidden-but-running app preview costs memory or keeps hammering a backend | Measure it. If it is real, pause rather than unmount, and say what pausing changes |
| The mode selector gets lost in a crowded toolbar | It is the leftmost control and it is the widest. It names the subject of everything else on screen |
| Bench mode becomes a place people ship from | The toolbar states the hierarchy; BEN-007 checks a user can say which is authoritative |
