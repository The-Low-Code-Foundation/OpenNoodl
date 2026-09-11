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

## ✅ BUILT 2026-08-14 (session 6)

No new mechanism — the clearing machinery was already correct, so this is the **gesture** that
reaches it. Three edits:

1. **`ComponentBench.clearScenario`** — `setActiveScenario(undefined)` ·
   `setScenarioNotice(undefined)` · `applyValueSet({})` · `onFrameChange?.(DEFAULT_BENCH_FRAME)`.
   The frame reset is symmetric with `selectScenario`'s frame apply, per the ruling. Writes nothing:
   R5 holds, because selecting has never reached `project.json`.
2. **`ComponentBench.resetInputsAndScenario`** — the same defect from the other end. `onResetAll`
   now clears `activeScenario` too, so the chip cannot read `test ●` over values that are gone.
   The frame is deliberately **left alone** here — this is a control over the inputs rail, and the
   frame is not an input. That is the one difference from `clearScenario`.
3. **`BenchScenarioBar`** — a `None` row at the top of the listbox
   (`data-test="bench-scenario-option-none"`, `aria-selected` when `!current`), a `MenuDivider`
   under it, and the chip's fallback label `Unsaved` → **`None`** (that branch only renders once
   scenarios exist, so no selection means deliberately on none of them).

`benchScenarios.ts` unchanged, exactly as the fix direction predicted — and `deleteScenario` is
untouched, which is criterion 3's control.

⚠️ `DEFAULT_BENCH_FRAME` is imported from `previewScope`, not re-declared, so **FIX-011's** ruling
(default height = fill the stage) will flow through here without a second edit.

## ✅ DRIVEN 2026-08-14 (session 6) — 3/3, task **CLOSED**

Fixture `fix012-drive` (copy of `erg005-qa`), `/Probe` on the bench — 6 inputs, 4 outputs. Set
`pStr = "hello-scenario"`, frame → Large (**1280**, deliberately off the 768 default so the frame
reset is observable), saved as scenario `test`.

| Step | Measured | Criterion |
|---|---|---|
| Open the list | Rows: **None** (`aria-selected=false`) then **test** (`=true`); divider present | — |
| Click **None** | chip **`None`** · `pStr` **`""`** · frame **768** · no modified dot | **1 ✅** |
| Re-select `test` | chip `test` · `pStr` `hello-scenario` · frame 1280 | — |
| **Reset all** | chip **`None`** · `pStr` **`""`** · frame **stays 1280** | **2 ✅** |
| Re-select `test`, then **Delete** | bar returns to `Save as scenario`, but `pStr` **kept** at `hello-scenario`, frame 1280 | **3 ✅** |

The frame column is where None and Reset all are provably *different* gestures rather than two
buttons doing one thing: None gave the frame back (1280 → 768), Reset all deliberately left it.
And Delete is provably different from both — it is the only one that kept the values.

⚠️ The `MenuDivider` was checked as **rendered**, not merely referenced: an undefined CSS-module
class silently produces no class at all, so `hasDivider` asserts the element resolved.
