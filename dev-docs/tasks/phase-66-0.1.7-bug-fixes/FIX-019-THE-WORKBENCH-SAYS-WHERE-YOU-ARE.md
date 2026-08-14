# FIX-019 — The workbench says where you are

**Report 14** · Tier 2 · Effort **S** (label) + **S–M** (divergence chip)

> *"Right clicking a component should show 'show in workbench' not 'in isolation' … we should show
> that what's in the node canvas is NOT what's in the preview more clearly, and a button to jump
> back."*

## 14(a) — the label (S)

`'Preview in isolation'` lives at `ComponentsPanelNew/components/ComponentItem.tsx:219-225` — the
only user-visible occurrence. If "workbench" becomes the product word, sweep the caption
(`VisualCanvas.tsx:242-245` — *"— isolated component, not the app"*) and the docstrings so the
vocabulary is one word. Leave the `data-test` ids alone (live-drive scripts reference them).

**Ruling:** is the surface now called **the workbench** everywhere, or only in this menu item?

## 14(b) — the divergence. The decoupling was decided and is sound; what's missing is the indicator and the way back.

Bench scope (`{ mode: 'bench', target }`, `VisualCanvas.tsx:95`) and the canvas's active component
(`NodeGraphEditor.switchToComponent`, emits `'activeComponentChanged'`) are **deliberately**
unlinked after the initial jump — `benchRequest.ts:26-40` explains why (VisualCanvas remounts on
layout changes and re-claims its scope; navigating from the surface would yank the canvas back,
"the one thing this must not do"). Do not relink them.

Constraints: `VisualCanvas` renders in its **own React root** outside `NodeGraphContextProvider`
(`CanvasView.ts:182-193`) — use the `NodeGraphContextTmp.nodeGraph` singleton or the
`EventDispatcher` `'activeComponentChanged'` event (the pattern three other panels already use).
⚠️ In the detached preview window `NodeGraphContextTmp.nodeGraph` is `null` — null-guard.

**The jump-back function already exists:** `revealBenchTarget` (`benchRequest.ts:41-45`) resolves
the legacy name and fires `ComponentPanel.SwitchToComponent` with `pushHistory` — it is exactly
the button's handler.

### Fix direction

1. Pure predicate in `previewScope.ts` (mirror of `isMounted`, `:181-183`): "is the canvas on the
   benched component".
2. Subscribe to `'activeComponentChanged'`; hold `canvasComponentName`; seed from the singleton
   with the null guard.
3. In the chrome strip's `isBench` fragment (`VisualCanvas.tsx:237-251`), render a divergence chip
   + **[Back to <name>]** button on the `DesignBannerExit` precedent (`:229-233`), onClick
   `revealBenchTarget(scope.target)`.
4. Optional one-liner worth offering in the same ruling: the reverse action — "bench what the
   canvas is showing" (`setScope({ mode: 'bench', target: canvasComponentName })`).

### ✅ RULED 2026-08-14 — back-to-benched, assertive chip

- ✅ **Button direction: back-to-benched**, which is what the report asks. The reverse action
  ("bench what the canvas is showing", fix direction 4) is **not** taken — two buttons won't fit a
  30px strip, and the report's direction wins. `revealBenchTarget(scope.target)` is the handler.
- ✅ **Assertive indicator** — the chip appears **only on divergence**, on the `DesignBannerExit`
  precedent. Not a passive always-on readout: BEN-004's drive found the strip clipping at 640px and
  a permanent readout spends width the strip has already been measured as short of. Acceptance
  criterion 3 (canvas on the benched component → **no** chip) is the control for this.
- 🟡 Components-panel badge on the benched row: still optional, still needs a new bench-scope
  broadcast (`BENCH_MOUNT_EVENT` is fire-and-forget today). File as a separate slice; not required.
- ⚠️ Strip layout still to be settled **once, with FIX-011** — both want the same 30px. The
  assertive ruling helps: the chip costs zero width in the common case.

## Acceptance criteria

1. Context menu reads "Show in workbench" (or the ruled wording) and still benches.
2. Bench a component, navigate the canvas elsewhere → the chip appears naming the divergence;
   clicking it returns the canvas to the benched component (`pushHistory` honoured — Back works).
3. Canvas on the benched component → no chip (control).
4. The detached preview window does not throw (null-guard driven).

## ✅ CLOSED 2026-08-14 — driven 4/4 on `fix012-drive` :: `/Probe`, dev stack at `519a1e66`

1. ✅ Menu read **"Show in workbench"** and clicking it benched Probe (mode `bench`, caption
   `Probe — isolated component, not the app`) and revealed the canvas to `/Probe`.
   ⚠️ Drive note: the item is inside a `BaseDialog`, which renders **twice** — the first
   text-match is the `MeasuringContainer` copy, 36px from the real one, and a click there closes
   the menu without acting. Filter `:not` the measuring copy (memory:
   `basedialog-renders-every-dialog-twice`, now updated with the menu-item case).
2. ✅ Canvas → `/App`: chip appeared reading **"Back to Probe"**, title naming App; the bench
   stayed on Probe (decoupling held). Chip click → canvas `/Probe`, chip gone. **Canvas Back
   button → `/App` again and the chip reappeared** — `pushHistory` honoured, round trip complete.
3. ✅ Control observed three separate times: right after benching, after the chip click, and after
   the detached re-attach — canvas on the benched component, no chip in the DOM.
4. ✅ Detached the preview (topbar Preview-layout menu → Detached; `NodeGX Viewer` window target
   appeared, `VisualCanvas` unmounted from the main window mid-bench without a throw). Fired
   "Show in workbench" while detached: the parked request re-attached the preview, the bench
   mounted on Probe, the seed ran through the null-guard, and the renderer-exception census was
   **unchanged** — zero new throws end to end.

Observation, not this task's defect: the dev log fills with
`GUEST_VIEW_MANAGER_CALL: UnknownVizError` uncaught rejections from
`CanvasView.captureThumbnail` (`UseCaptureThumbnails.ts:24`) — the periodic thumbnail capture
failing against a hidden/occluded webview, ~15 during this drive, predating both fixes. Filed in
NEXT-SESSION-PROMPT §3.
