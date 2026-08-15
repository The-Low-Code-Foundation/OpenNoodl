# CN-012 — Logic nodes too

| Field | Value |
|---|---|
| **Tier** | 4 |
| **Effort** | M (unknown until the measurement pass lands) |
| **Surface** | `runtime` |
| **Rulings** | ✅ **D2** (the published types' logic half is provisional until this task) |
| **Depends on** | CN-003 |

## 🔴 This is a measurement task first, a build task second

**Do not write the rest of this spec from the source.** Everything this phase proved on 2026-08-15
was about `reactNodes` — the visual half. The logic half (`module.nodes`, via `defineNode`) is
**inherited, plausible, and completely unexercised here.**

The repo's record on exactly this shape is bad enough to be a standing rule: **build the caller, 5
for 5.** Four of those five found a hole; one of them found a *feature* with no implementation
behind it that a live drive had already passed over. `0 of 29 shipped library modules have ever been
run`. A spec for CN-012 written from reading `noderegister.ts` would be the sixth entry on that
list.

## The measurement pass — do this, then rewrite the task

Build a kit registering a **logic** node — no React, no DOM — and establish:

1. **Does it register?** `viewer.jsx` concatenates `module.reactNodes` (compiled) onto
   `module.nodes` (passed through) before `registerModule`. So a module supplying only `nodes` should
   work. **Confirm it, don't infer it.**
2. **Does it reach the editor's node library** with a non-`Visual` category, and can it be placed on
   canvas like an `Expression`?
3. **Signals and values** — does a logic kit node send signals, receive them, and participate in
   `runOnChange` the way built-in logic nodes do?
4. 🔴 **Does it run in the cloud runtime?** `noodl-viewer-cloud` has **no `registerModule` call**
   in `src/` — grepped 2026-08-15. If that holds, a logic kit is **browser-only regardless of what
   the manifest's `runtimes` field says**, which would make the manifest field misleading rather than
   merely unimplemented. That is a finding worth having on its own, and it feeds CN-013.
5. **What the catalog overlay does with it** — CN-003 was designed against visual nodes; a logic node
   has no visual ports and different `availableIn` semantics.

## Then build

Whatever the measurement shows. Likely shape: make the logic path work end-to-end, document it in
CN-007, and promote CN-005's provisional logic types to guaranteed.

## Acceptance criteria (provisional — revise after measuring)

1. A logic-only kit node registers, appears in the picker under a sensible category, and computes.
2. Its behaviour under the cloud runtime is **established and documented** — working, or explicitly
   unsupported with the manifest field made honest. "Untested" is not an acceptable end state for a
   field that implies support.
3. CN-005's logic types lose their provisional marker, or the marker is made permanent with a reason.

## Traps

- 🔴 **A typeless node empties the graph** — wires-with-no-nodes means something threw. If a logic
  kit renders an empty canvas, look for the throw before doubting the registration.
- ⚠️ **`flagOutputDirty` on a signal never fires** — a recorded runtime trap directly in the path a
  logic node's outputs take.
- ⚠️ Do not let this task quietly become "visual nodes, again". The whole point is the half nobody has
  run.
