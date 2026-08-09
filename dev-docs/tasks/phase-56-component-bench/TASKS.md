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

**Session 2 (2026-08-08):** BEN-004 is built **and driven in a live editor** — the preview surface
has two modes, and every one of BEN-004's Live criteria is closed with measured evidence. Five new
register rows: **B6** (where "the existing preview toolbar" turned out to be), **B7** (the round trip
is lossless in one direction only, deliberately), **B8** (`stretch`, the half of B3 nobody has
measured), **B9** (`useTrackBounds` threw the whole React tree away on a null ref — the drive found
it, no spec could have), **B10** (two driving traps that make working things look broken —
**read it before driving anything**). The drive also confirmed **B4** live on the very first
component mounted.

**Session 3 (2026-08-08):** BEN-002 is built **and driven** — see
[HANDOVER-SESSION-3.md](HANDOVER-SESSION-3.md). Every acceptance criterion is closed with a measured
number, and the drive found **two defects in Reset**, both of the shape this phase exists to catch: a
mechanism that is exactly right and has no consequence (**B13**). Also **B14**, a new driving trap —
reloading a preview webview over CDP destroys the whole preview surface.
**B2 is decided and it needed no runtime change** —
the relay already routes any message carrying a `target`, so a bench input reaches one client at
transport level and the task file's proposed mechanism (a `clientId` inside `content`, matched by the
runtime) was the wrong shape. Two new register rows: **B11** (`stringlist` cannot be a select) and
**B12** (a signal is two updates, not one). The corpus had **no component with typed inputs at all**,
so the drive needed a fixture — `Components/BenchProbe` in *Puppy test 3*, authored through MCP, one
input per control kind, every one of them wired so `getPorts` derives a real type.

**Session 5 (2026-08-09):** **BEN-005** is built **and driven** — see
[HANDOVER-SESSION-5.md](HANDOVER-SESSION-5.md). The two questions its own §1/§3 said to answer
before building were both answered in source and then confirmed live (**B22**), and the drive
closed **B13's remount branch**, which had been *"code without a live case"* for two sessions —
along the way finding that the branch as shipped would have restored the *export's* inputs rather
than the applied ones (**B21**). Also **B23** (a v2 save deletes `description`, which is AWP-002
arriving by a new route) and **B24** (a driving race that presses the control underneath).
**Only BEN-006's Live criteria and BEN-007 remain.**

**Session 6 (2026-08-09):** **BEN-006's Live criteria are closed** — see
[HANDOVER-SESSION-6.md](HANDOVER-SESSION-6.md). Driven in the AI authoring preview itself, on a real
`For Each` list, with the rendered strings read out of the sandbox webview's DOM. The drive found
that this task's own panel captioned the sandbox's bookkeeping as *"read by the graph"* (**B25**,
fixed and re-driven), and two things that are **not** this task's to fix: a `For Each` over a query
infers **zero** fields, so an ordinary list previews as *"Fields unknown"* and renders literal `Text`
placeholders (**B26** — and it is almost certainly session 4's unexplained `SiteHeader` loose end);
and closing the change-review document makes the AI preview unreachable for the rest of the session,
taking the user's typed sample data with it (**B27**). **Only BEN-007 remains.**

| Task | File | One line | State |
|---|---|---|---|
| BEN-001 ⭐ | [BEN-001-HARNESS-MOUNT.md](BEN-001-HARNESS-MOUNT.md) | the synthetic harness: mount any component as root *with* its inputs set | ✅ **built and driven**, 19 specs; Live 6 closed (320 measures 320) and **Live 5 closed by BEN-002's drive** — a value set on the harness reaches the mounted component's DOM |
| BEN-002 ⭐ | [BEN-002-INPUT-FORM.md](BEN-002-INPUT-FORM.md) | the inputs rail, generated from the component interface — and live update without reload | ✅ **built and driven**, 26 specs; **B2 decided** — see B13/B14 and the task file's correction |
| BEN-003 | [BEN-003-OUTPUT-READOUT.md](BEN-003-OUTPUT-READOUT.md) | what the component emits, as a live log. Makes logic-only components previewable | ✅ **DONE and driven** — one channel (the trace), not two; every criterion measured live |
| BEN-004 ⭐ | [BEN-004-BENCH-SURFACE.md](BEN-004-BENCH-SURFACE.md) | the mode selector, the stage chrome, the way back — R1–R5 live here | ✅ **built and driven**, 18 specs; see B6–B10 |
| BEN-005 | [BEN-005-SCENARIOS.md](BEN-005-SCENARIOS.md) | named input sets saved to component metadata (Empty / Loaded / Error) | ✅ **built and driven**, 34 specs; every criterion measured live, and B13's remount branch finally has a case (B21) |
| BEN-006 ⭐ | [BEN-006-AUTHORED-SAMPLE-DATA.md](BEN-006-AUTHORED-SAMPLE-DATA.md) | **Richard's ask**: the user edits the sample data in the AI preview and re-renders | ✅ **built and driven**, 28 specs; every Live criterion closed, and the drive fixed B25 and filed B26/B27 |
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
