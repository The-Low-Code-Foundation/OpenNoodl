# Phase 77 — next session

## ✅ No hold. Freeze cleared 2026-08-28 (s4): *"Freeze is off, go nuts."*

## ✅ s11 did the sweep. It found a third register, and it was the one nobody had

**Richard, 2026-08-29:** *"don't forget phase 76."*

That instruction was the session's largest finding. **Phase 76 had 28 numbered findings (F1–F28)
across eighteen task files and no register at all** — the same state phase 77 was in for ten
sessions, one phase older and nearly three times the size. A sweep of the two phases that *have* a
register would have reported a clean bill for the phase that does not.

Committed at **`4b8b1ff5`**. Read in this order:

1. **[THE-SWEEP-2026-08-29.md](THE-SWEEP-2026-08-29.md)** — all 54 findings, re-measured at HEAD,
   four columns each.
2. **[phase 80](../phase-80-the-defects-the-templates-found/TASKS.md)** — the 17 unowned product rows,
   now **nine tasks ranked by who they bite**.
3. **[phase 76's new register](../phase-76-the-site-builder/DEFECTS-PHASE-76-FOUND.md)**.

| | |
|---|---|
| findings across phases 76+77+78 | **54** |
| still real, product-side, **unowned** | **17** → phase 80 |
| already owned | 3 |
| fixed, or disproved and correctly kept | 19 |

🔴 **Phase 76 is the control that makes this a process failure rather than a backlog.** 24 of its 28
were fixed in the session that found them or given an SB task. That is the standard; phases 77 and 78
wrote theirs down and moved on.

### Six rows came back different, and two would have sent a session at the wrong codebase

- 🔴 **P77 D2's cause is wrong for the third time.** The cloud path **does** call the step recorder —
  `WorkflowRunner.ts:261` is the **`Log` node handler**. The site-builder has **zero** `Log` nodes,
  which is the whole of *"3 executions, 0 steps"*. `execution_steps` records **what the author
  logged, never what the graph ran** — a smaller fix than D2 assumed. **This row keeps getting
  diagnosed from the caller list instead of the caller.**
- 🔴 **P77 D4 is TEMPLATE work, not product.** `DbCollection2` carries `failure` (signal) and `error`
  (string) at HEAD, and phase 78's D4 **drove** it: a 403 fires `failure`. The site builder never
  wired them. Left as written it would have opened a platform task for a wire. → SBR-006/SBR-010.
- 🔴 **P77 D6's cause is REFUTED.** `maxWidth` **is** a declared port on `Text` and the door returns
  it. `useDimensionConstraints` defaults `true` and no node opts out. **And the file predates D6's
  own measurement by three weeks** — so the row was **mis-derived, not stale**, and a re-measure
  scoped to *"has the platform moved?"* would have confirmed all five unverified rows.
- 🔴 **P77 D8 IS phase 76's F15.** The same defect, found twice, one phase apart, unowned in both.
- 🔴 **P78 D11 is wider than recorded.** `ModernPreset.ts` ships `tokens: {}` — so **3.68 is
  `DefaultTokens.ts`'s ratio**, not Modern's. Every project inherits it, including every project
  whose author never opened the preset picker.
- 🔴 **P76 F3 was never filed anywhere.** Premise half wrong (rate limiting exists, *per function*);
  the narrower row is real → **DEF-009**.

## 🔴 FIRST JOB — the drive s10 and s11 both owe

**Not done in s11. It is the oldest thing on this list and it has now been deferred twice.**

**Which node actually broke is still unknown, on purpose.** Four candidate causes each *fitted* the
evidence and each was refuted — SBR-015 §2.3 has the table. Wiring the failures is what lets the
backend say; a fifth guess would have wasted the measurement.

**The repro is exact.** Publish a page with **zero sections** (the drive's page `0826ed8b` had none
— `Section: 0` in the whole site) and read the answer. Two candidates remain, both instrumented:

1. the query reports `failure` — a zero-row query against a class auto-created in that same second
   (the `Section` schema row was created at `21:14:56 UTC`, the exact second `publishPage` started);
2. a code node's guard returns because an input is still `undefined`.

⚠️ **They look different and you must not conflate them.** A guarded `return` is **not** a `failure`,
so case 2 shows as *no response and no failure either* — the fix will not have made it speak. Case 1
now answers `This page could not be published.` in well under 30s.

Record the answer in SBR-015 §2.3 — **including if it now simply succeeds**, which would make the
zero-section path the whole defect.

⚠️ Needs a project minted from the **regenerated** template. The running editor holds the project in
memory, so an on-disk patch never reaches the viewer.

## 🔴 SECOND JOB — start phase 80, top of the rank

**[DEF-001](../phase-80-the-defects-the-templates-found/DEF-001-THE-DEFAULTS-FAIL-ACCESSIBILITY.md)**
is the one row whose harm lands on **someone who never chose NodeGX** — a visitor to an app somebody
built here. Measured at HEAD, `--primary-foreground` on `--primary` against the 4.5:1 AA floor:

| preset | ratio | |
|---|---|---|
| **defaults / `modern`** | **3.68** | 🔴 the wizard's default, and `ModernPreset` ships `tokens: {}` |
| `playful` | **4.23** | 🔴 |
| `soft` | **4.47** | 🔴 misses by 0.03 |
| `minimal` / `enterprise` | 17.72 / 17.85 | ✅ |

Plus `textinput`'s `default` variant border at **1.33:1** against the 3:1 of WCAG 1.4.11 — where
`--border-control` already exists and already passes, and `outlineButton`'s own description already
explains why it is needed.

🧭 **DEF-001 needs a ruling first**: does `--primary` move, or `--primary-foreground`? It is a
visible product change and it moves every project created after it.

## 🔴 Still owed from s9, unchanged

- **SBR-006 AC4's fix is authored and gated but NOT driven.** Click View site, expect `/`; the bug was
  `location.pathname === "/%7Bslug%7D"`. Same regenerated-template requirement.
- **SBR-006 AC1 was driven with one page, not ≥2.** Re-drive once SBR-008 lands.
- **SBR-006 AC2** stays half until **SBR-008** (`prop-*` is wire-only).
- ✅ **§5.8 is no longer Richard's call** — the sweep reclassified it (P77 D4 above). It is
  SBR-006/SBR-010 template work and the product already supplies `failure` + `error`.

## 🔴 The lessons most likely to repeat

- 🔴 **An unowned row does not sit still — it gets rediscovered at full price.** P76 F15 and P77 D8
  are one defect, measured and written up twice, fixed zero times. That is the concrete cost of
  `NONE`, and it is why every row now carries an owner or the literal word.
- 🔴 **A re-measure scoped to the wrong question confirms everything.** The stated reason to
  re-verify D5–D8 and D10 was *"the platform has moved under them"*. **It had not** — D6's file
  predates its own measurement by three weeks. What was wrong was the derivation. Ask *"is this
  reading right?"*, not *"is it stale?"*.
- 🔴 **A register is not a sweep.** Two of the three phases here had a register and were still
  carrying 17 unowned rows; the third had none and had carried three since s4 including a security
  row that says *"possibly a core gap to file"* and was filed nowhere.
- 🔴 **Grep for the mechanism a ruling names.** P76 F3 concluded "no rate limiting" from a sweep that
  did not find it. It was there — 65 references, and per-function.

## Traps carried

- ⚠️ **Phase 78's register is the other session's lane** and was uncommitted through this sweep.
  Nothing here edited it. It needs two things from its owner, listed in the sweep §5: **renumber the
  second `D10`** (two different defects share the number) and **add an owner column** (no row has one;
  §4 of the sweep is the input).
- ⚠️ **Artefact node types are not authoring names**, and a component instance's type is its
  **legacyName**. A hand-written type list is an exclusion list that cannot fail.
- ⚠️ Two count pins move whenever a cloud graph does: `sb-007/site-template.test.ts` node ids (**234**)
  and `sb017-helper-is-lossless.test.ts` connections (**118**). `sb017-deploy-connection-parity.test.ts`
  compares against a **frozen deployed bundle**.
- ⚠️ Read the summary line, not the exit code: `test:ci` exits 1 at the floor (**2889 specs, 4
  failures, all `AIX-006 style vocabulary` by name**), and its readout is
  `packages/noodl-editor/tests/test-results.json`.
- ⚠️ `test:ci` **was not run in s11** — no editor, runtime or MCP source was touched. Eighteen
  documentation files and nothing else. s10's floor stands.

## Standing context

- Richard, 2026-08-28: **no short paths** — full six screens of
  https://claude.ai/code/artifact/f1986b40-e827-4770-abb8-1dc8f17e1810 ; assessment:
  https://claude.ai/code/artifact/f4b2077a-7a78-4c33-8bf7-8b7f343f0b0b .
- 🔴 Never scope by time. Every task's ACs include a person sentence — verify as written, and if the
  platform cannot express what an AC asks for, **say so and record the gap**.
- Drive artefacts: **`SBR-006 Admin Drive`** (claimed, backend `backend_mtdg3sdziq5nw`, token
  `drive-token-sbr006`) — its `executions.sqlite` holds s9's three calls. 🔴 **It is DEF-004's
  before-arm; do not overwrite it.** `SBR-004 Mounted Drive` carries s8's.
- Shared checkout: **pathspec commits only**; announce editor launches **and** teardowns; `test:ci`
  alone, and never beside a live stack.
