# BEN-004 — The bench surface: one preview, two modes, no confusion

**Status:** 📋 not started · ⭐ · owns **R1–R5** · can start in parallel with BEN-001

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

### 6. Entry points

- **Components panel → right-click → "Preview in isolation"**, which switches the preview surface to
  bench mode on that component. This is the entry the feature will actually be used through.
- The mode selector's own dropdown.
- The AI build panel's component mode already lands on this preview surface (AIX-008) — BEN-006
  extends what it can do there; this task must not disturb it.

### 7. Inherit the existing toolbar for free

The sandbox toolbar already carries **Sample data / Real backend** and **Sign in / Sign out**
([SandboxPreview.tsx:183-211](../../../packages/noodl-editor/src/editor/src/views/documents/AuthoringPreviewDocument/SandboxPreview.tsx#L183-L211)).
The bench gets both by using the same component. Do not build a second toolbar; do not offer
"signed out" against a real backend — the existing code already declines that, correctly, and the
comment explains why.

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
