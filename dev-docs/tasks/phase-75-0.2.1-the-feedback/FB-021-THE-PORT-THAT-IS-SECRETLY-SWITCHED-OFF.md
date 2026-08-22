# FB-021 — the port that is secretly switched off

**Filed:** 2026-08-22, from Jordan's session-2 report §2.1 (and §9's "highest cost-to-fix
ratio"). **Status: ⬜ open — the behaviour is real and confirmed; no coverage.** Size: M.

> *"Under content-size mode, width and height are not live ports at all. Wiring to them does
> nothing, and nothing says so. I learned this from Claude Code, not from the UI."* — repeated
> aloud four times: *"where is width?"*

---

## Ground truth

- Confirmed during FB-019's sweep: `sizeMode` is an enum that **gates whether the dimension
  ports exist at all** via `dynamicports`
  (`node-shared-port-definitions.ts:768–811` — width/height are only registered under
  `explicit`/partial modes). The panel silently omits them; a wire into a non-existent port
  moves nothing and nothing says why.
- The same mechanism gates other port families (`useLabel` → label ports, `useIcon` → icon
  ports, dynamic enum-dependent groups). Jordan hit dimensions; the fix should be the
  mechanism, not the instance.
- **The precedent is already shipped and Jordan cited it**: refused *connections* now explain
  themselves instead of silently removing the port. This task is the same principle one step
  further: a **gated port renders present-and-disabled with its reason**, e.g. *"Width is not
  driveable while Size Mode is Content"*, with the gating control one click away.

## Scope

1. In the properties panel: a port removed by a `dynamicports` condition renders as a
   disabled row with the reason derived from the gating enum (the condition is data — the
   sentence can be generated: "<port> is available when <gate port> is <values>").
2. In the connection panel: dragging a wire toward a gated port shows the same reason
   (today the port simply isn't offered — the author can't distinguish "doesn't exist" from
   "switched off").
3. Clicking the reason focuses the gating control (`sizeMode` in the motivating case).
4. Scope guard: derive from the `dynamicports` declarations generally, but ship with the
   dimension case driven and asserted; other families follow the same path free.

## Acceptance criteria

- AC1: a node in content size mode shows Width/Height as disabled rows naming Size Mode;
  switching Size Mode enables them in place — driven.
- AC2: the reason sentence is derived from the port declaration, not hand-written per node —
  asserted by a sweep across visual nodes with gated dimension ports (cardinality: every
  gated port has a reason row, none double-renders when enabled).
- AC3: an existing connection into a port that *becomes* gated (author flips sizeMode after
  wiring) is surfaced, not silently inert — at minimum the disabled row shows the connection
  chip (FB-018's) so the dead wire is visible.
- AC4: interacts correctly with FB-017's tiers — a gated basic-tier port stays in the basic
  tier while disabled (hiding it again would recreate the bug).

## Traps

- `dynamicports` re-registration is the machinery FB-019's sweep touched — don't fork a
  second source of truth for "which ports exist"; render state must derive from the same
  declaration the runtime uses.
- Jordan's §2.2 ("margin and position manipulate the same underlying number") is NOT this
  task — it's FB-019's investigation item. Don't merge them on superficial resemblance.
