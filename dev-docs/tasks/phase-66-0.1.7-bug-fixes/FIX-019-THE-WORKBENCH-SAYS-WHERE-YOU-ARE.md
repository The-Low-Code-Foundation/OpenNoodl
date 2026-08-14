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

### Rulings

- **Button direction:** back-to-benched (what the report asks) vs re-bench-current (possibly the
  more common intent) — two buttons won't fit a 30px strip.
- Indicator **assertive** (appears only on divergence — the design-banner pattern, recommended)
  vs passive always-on readout (costs strip width; BEN-004's drive found the strip clipping at
  640px).
- Should the Components panel also badge the benched row? (Needs a new bench-scope broadcast —
  `BENCH_MOUNT_EVENT` is fire-and-forget today. File as optional slice.)
- ⚠️ Coordinate the strip layout with FIX-011 — both tasks want the same 30px.

## Acceptance criteria

1. Context menu reads "Show in workbench" (or the ruled wording) and still benches.
2. Bench a component, navigate the canvas elsewhere → the chip appears naming the divergence;
   clicking it returns the canvas to the benched component (`pushHistory` honoured — Back works).
3. Canvas on the benched component → no chip (control).
4. The detached preview window does not throw (null-guard driven).
