# POL-009 — A pinned run belongs to one canvas

Covers reported item **11**.

## What was reported

> When you pin workflow data in a cloud workflow, the pin/unpin bar at the top stays visible even if
> you navigate to other components, as does the 'steps' bar at the bottom, until you click 'unpin'.

## The mechanism — confirmed

[`ExecutionOverlay.tsx`](../../../packages/noodl-editor/src/editor/src/views/CanvasOverlays/ExecutionOverlay/ExecutionOverlay.tsx)
holds the pin in component state:

```ts
const [pinnedExecution, setPinnedExecution] = useState<ExecutionWithSteps | null>(null);
useEventListener(EventDispatcher.instance, 'execution:pinToCanvas', (data) => setPinnedExecution(data.execution));
useEventListener(EventDispatcher.instance, 'execution:unpinFromCanvas', () => setPinnedExecution(null));
if (!pinnedExecution) return null;
```

Two events set it and clear it. **Nothing else clears it.** The overlay is mounted over the canvas
generally, not over a particular graph, so navigating to another component leaves the header and the
step timeline in place over a graph the run has nothing to do with.

The file already knows this is wrong. Its own comment at lines 88-99 says a pin over the wrong graph
*"looks exactly like a broken canvas"* — the reasoning was written down and the guard was not built.

There is a partial mitigation already present: `resolvedCount` counts steps whose `nodeId` resolves
to bounds on the current canvas, and there is a branch for "none of its N steps are on this canvas".
So the overlay degrades to a message rather than drawing garbage — but the bars stay, which is what
was reported.

## What to build

**Slice 1 — decide the ownership rule.** A pin is *for a graph*. The two candidates:

- **(a) Hide when the active component is not the pinned run's workflow.** The pin survives, so
  navigating away and back restores it. The bars are simply not rendered elsewhere.
- **(b) Clear the pin on component change.** Simpler, but throws away state the user asked for
  because they clicked a component.

**Take (a).** It matches how the user described it ("stays visible… until you click unpin" — the
complaint is about *visibility*, not about the pin's lifetime), and it means the explicit Unpin
button remains the only thing that ends a pin.

**Slice 2 — build it.** The overlay needs to know which component the run belongs to and what the
active component is. `ExecutionWithSteps` carries `workflowName`; check whether it also carries an
identity that can be compared to the active document/component, and if not, put one on the pin event
rather than matching on a display name.

Subscribe to the same active-component signal the rest of the canvas overlays use — do not poll, and
do not infer it from `getNodeBounds` returning nothing, which is a different condition (a run whose
steps genuinely are not on this canvas, which the existing branch handles).

**Slice 3 — the "none of its steps are here" branch.** With (a) in place, re-read that branch. It
was written to cope with exactly the situation this task removes. It may still be reachable — a
workflow canvas showing a run from a *different* workflow — in which case keep it; if it becomes
unreachable, delete it rather than leave dead reassurance.

## Criteria

1. Pin a run on a workflow canvas → the header and step bars appear.
2. Navigate to any other component → both bars are gone, immediately.
3. Navigate back to the workflow → the pin is still there, at the same step index.
4. Unpin → gone everywhere, and navigating back does not restore it.
5. Pin a run, navigate away, pin a *different* run, navigate back — the right run is showing.
6. Verified in the running editor. This is a navigation defect; jest will not see it.

## Traps

- `currentStepIndex` and the selected node are component state alongside the pin. Whatever slice 1
  decides, they must follow the same rule — a pin that survives navigation with a stale step index
  is a new defect.
- The overlay re-renders on every pan and zoom (its own comment says so). Do not add per-render work
  to the component-identity check.
- Sidebar panels are hidden-but-mounted, and HMR will not apply a new effect to a mounted component.
  Restart the editor before concluding a subscription is not firing.
