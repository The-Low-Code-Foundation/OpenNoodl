# FIX-012 — No way back to "no scenario"

**Report 8 (b)** · Tier 2 · Effort **S** (~20 lines)

> *"When you save a 'scenario' and select it, you can't clear it to return to 'no scenario'
> values."*

## Mechanism — pinned

The none-state **exists in the model and is unreachable by the user**.
`activeScenario: string | undefined` (`ComponentBench.tsx:417` — *"Absent means 'not on one'"*)
is set to `undefined` only on target change (`:435-438`) and when deleting the active scenario
(`:557` — and delete deliberately does **not** clear the values, `:548-554`). The scenario bar's
listbox is a plain `scenarios.map` (`BenchScenarioBar.tsx:207-226`) — no "None" row, none in the
overflow menu either. The clearing machinery is already built and correct:
`applyValueSet({})` (`ComponentBench.tsx:327-381, :393`) is exactly "clear everything".

**Related bug found while reading:** the rail's **Reset all** (`resetInputs`, wired `:668`) clears
every value but leaves `activeScenario` set — the chip still reads `test ●` claiming you are on a
scenario whose values are gone. Same defect from the other end.

## Fix direction

Add a `None` row at the top of the listbox (mirroring how `PreviewChrome.tsx:128-139` puts "App
preview" above the component list) → handler:
`setActiveScenario(undefined); setScenarioNotice(undefined); applyValueSet({})`.
Make `resetInputs` also clear `activeScenario` so the two agree. Optionally reset the frame to
`DEFAULT_BENCH_FRAME` for symmetry with `selectScenario`'s frame apply. `benchScenarios.ts` needs
no change at all.

## ✅ RULED 2026-08-14 — None clears

- ✅ **"None" clears all inputs.** Ports fall to their derived defaults — what the report's "no
  scenario values" reads as. The handler is the one already sketched above:
  `setActiveScenario(undefined); setScenarioNotice(undefined); applyValueSet({})`.
- ✅ **Selecting None also resets the frame** to `DEFAULT_BENCH_FRAME`, symmetric with
  `selectScenario`'s frame apply.
- ✅ **Delete keeps its current behaviour** — it deliberately keeps the values, and that asymmetry
  is intended, not an oversight. Acceptance criterion 3 is the control that proves None and Delete
  stayed different.
- 🟡 Chip label: `None` instead of `Unsaved` once scenarios exist (`Unsaved` overclaims pending
  work) — take the recommendation.

## Acceptance criteria

1. Save a scenario, select it, pick **None** → every input shows its derived default, the chip
   shows the none-state. Driven.
2. **Reset all** clears the chip too — no `test ●` over empty values.
3. Delete-the-active-scenario behaviour unchanged (control — it deliberately keeps values).
