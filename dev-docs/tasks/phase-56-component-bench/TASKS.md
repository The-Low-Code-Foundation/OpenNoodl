# Phase 56 — the tasks (BEN: the Component Bench)

**Created:** 2026-08-08, out of [README.md](README.md). Every claim about existing code in these
files was read in source, not recalled — keep that rule for anything added.

**The exit test:** BEN-007. A builder opens a hand-written card component from the components panel,
types three input values, sees them render, watches an output fire when they click it, saves that as
a scenario, switches back to the app preview and finds it exactly where they left it. Then the same
for an AI-authored component with the user's own sample data (BEN-006). If that runs end to end on a
live editor, the phase is done.

**Standing constraints (from the README, settled):** one substrate two clients; the bench is a mode
of the preview panel, never a second panel; nothing reaches `project.json` without an explicit save;
R1–R5 are acceptance criteria.

**Session 1 (2026-08-08):** BEN-006 and BEN-001 are built and specced, and **neither has been driven
in a live editor** — see [HANDOVER-SESSION-1.md](HANDOVER-SESSION-1.md). It also found that the plug
inversion is *two* inversions and that this file's own siblings describe one of them (register B5).

| Task | File | One line | State |
|---|---|---|---|
| BEN-001 ⭐ | [BEN-001-HARNESS-MOUNT.md](BEN-001-HARNESS-MOUNT.md) | the synthetic harness: mount any component as root *with* its inputs set | 🟡 built, 19 specs; both Live criteria open |
| BEN-002 ⭐ | [BEN-002-INPUT-FORM.md](BEN-002-INPUT-FORM.md) | the inputs rail, generated from the component interface — and live update without reload | 📋 not started — use `benchInterface()`, see B5 |
| BEN-003 | [BEN-003-OUTPUT-READOUT.md](BEN-003-OUTPUT-READOUT.md) | what the component emits, as a live log. Makes logic-only components previewable | 📋 not started |
| BEN-004 ⭐ | [BEN-004-BENCH-SURFACE.md](BEN-004-BENCH-SURFACE.md) | the mode selector, the stage chrome, the way back — R1–R5 live here | 📋 not started — **now the blocker for everything Live** |
| BEN-005 | [BEN-005-SCENARIOS.md](BEN-005-SCENARIOS.md) | named input sets saved to component metadata (Empty / Loaded / Error) | 📋 not started |
| BEN-006 ⭐ | [BEN-006-AUTHORED-SAMPLE-DATA.md](BEN-006-AUTHORED-SAMPLE-DATA.md) | **Richard's ask**: the user edits the sample data in the AI preview and re-renders | 🟡 §1–§6 built, 26 specs; every Live criterion open |
| BEN-007 | [BEN-007-ACCEPTANCE.md](BEN-007-ACCEPTANCE.md) | the live-driving pass the phase closes on | 📋 not started |

## Dependency map

```
BEN-001 ──┬── BEN-002 ──┬── BEN-005 ──┐
          │             │             │
          ├── BEN-003 ──┤             ├── BEN-007
          │             │             │
BEN-004 ──┴─────────────┘             │
                                      │
BEN-006 ──────────────────────────────┘
```

- **BEN-001 is the only hard prerequisite.** Everything visual depends on the harness existing.
- **BEN-004 can start in parallel** — the stage chrome and mode selector do not need the harness to
  exist, only a component name to display.
- **BEN-006 is independent of the bench entirely.** It extends `sandboxData.ts`, which the AI preview
  already uses. It can ship first and stand alone, and probably should: it is the smallest slice with
  a visible payoff, and it is the half Richard named.

## Suggested order

1. **BEN-006** — independent, small, immediately useful in the surface that exists today.
2. **BEN-001** — the mechanism everything else sits on.
3. **BEN-004 + BEN-002** — the surface and the rail; these are one review together.
4. **BEN-003**, then **BEN-005**.
5. **BEN-007** last, live, on a real editor.

## Working habits that apply here

- **Write the check before the fix** (phase 39). For BEN-001 that means a spec asserting the export
  shape before any UI exists.
- **Verify the consequence, not just the mechanism.** A harness that mounts is not a harness that
  renders the value. Read the DOM, or a screenshot — a graph is a claim, a render is evidence.
- **A fake is an unchecked claim.** No task in this phase closes on "the code looks right"; BEN-007
  exists because four of five specs in phase 42bis were wrong about their own mechanism.
- **Anything filed-not-fixed gets a row** in the README register, with its blocker named.
