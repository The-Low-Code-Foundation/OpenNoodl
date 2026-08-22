# FB-022 — numbers you can grab

**Filed:** 2026-08-22, from Jordan's session-2 report §5 — the second session to arrive at
this independently (previous session: the AudioNodes comparison). **Status: ⬜ open — a real
absence, ergonomics-grade; no coverage.** Size: M/L.

> *"The friction between me and moving this thing — I'm going to try and drag it. Whereas down
> here I have to type something in."* Proposed in-session: **click-and-hold drags the value,
> single click edits.** No mode, no new control.

Two different users reaching for the same missing interaction while doing different tasks is
a signal about the tool's shape, not a preference — filed on that basis. It is also the item
that converts FB-016's overlay from a diagnostic into a feedback loop: scrub margin, watch
the margin box move.

---

## Scope

1. **Drag-to-scrub on numeric fields** in the properties panel: press-and-hold + horizontal
   drag changes the value continuously; a plain click focuses for typing (the discriminator
   is movement past a small threshold before mouseup, the way devtools and Figma do it).
2. Modifier scaling (shift = ×10, alt = ×0.1) and per-port step derived from the type where
   it exists.
3. Applies to `number`, units-`number` and `dimension` value halves — the unit stays a
   dropdown; scrubbing never changes the unit (FB-019's coercion rules own that).
4. Out of scope: on-canvas drag handles for margin/padding (a bigger feature; this task is
   the panel half Jordan actually asked for).

## Acceptance criteria

- AC1: scrub changes the rendered element live (undo coalesces to one entry per scrub
  gesture, not one per pixel — the undo integration is the real work in this task).
- AC2: click-without-drag still enters edit mode; typing is unchanged — asserted both arms.
- AC3: a scrub on a **connected** port doesn't silently write a doomed parameter — FB-018's
  chip means the field isn't scrubbable while bound; asserted.
- AC4: works on the three numeric row types named in (3); rows opt in by type, not by
  hand-list — sweep-asserted like FB-018 AC2.
- AC5: driven in the running editor; pointer capture releases correctly (no stuck-drag after
  mouseup outside the panel).

## Traps

- The panel's row components are shared with non-visual nodes — a scrub on e.g. a delay
  number must behave identically; don't gate on "visual".
- Pointer capture + the panel's own scroll: a vertical drift mid-scrub must not scroll the
  panel (FB-017's scroll-preservation work is adjacent — coordinate, don't collide).
