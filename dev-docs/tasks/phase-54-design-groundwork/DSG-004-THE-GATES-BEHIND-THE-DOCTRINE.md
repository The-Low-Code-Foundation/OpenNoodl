# DSG-004 — The gates behind the doctrine ⭐

**Status:** 🟠 **2 rules of six** · `repeated-sibling-subtree` shipped `ef945bdc` 2026-08-08 ·
`oversized-page` shipped in phase 55 as LAS-004 §2 · **Track C** · **the task that matters**

## The argument, in one measurement

The decomposition doctrine had said "two or more structurally identical siblings become one
component" since AAQ-008. It was ignored **by the author of the design doctrine, three commits after
shipping it**, in this phase's own reference build.

> A doctrine with nothing behind it is advice, and advice is what gets skipped under pressure.

Phase 55's audit measured the same thing on models rather than humans: `repeated-sibling-subtree`
fired correctly on **every** measured build — 3 warnings on the reference build's exact failure, 2 on
haiku's, 1 on sonnet's — and **all three ignored it**. It was promoted to blocking for authored
output ([`authoredCandidate.ts:231`](../../../packages/noodl-editor/src/editor/src/validation/authoredCandidate.ts))
on the audit's other measurement: hard rejections carrying a suggestion were self-corrected at a
**100% rate**, even by the mid-tier model.

**That is the whole design of this task.** Advice is free and ignored; a rejection with an exit in it
is obeyed.

## §1 — What exists

| Rule | Code | Severity | Threshold, and where it came from |
|---|---|---|---|
| Repeated sibling subtree | `repeated-sibling-subtree` ([`diagnostics.ts:141`](../../../packages/noodl-editor/src/editor/src/validation/diagnostics.ts), [`rules/repeatedSiblingSubtree.ts`](../../../packages/noodl-editor/src/editor/src/validation/rules/repeatedSiblingSubtree.ts)) | warning — **blocking for authored output** | `REPEAT_THRESHOLD = 3` copies, `MIN_SUBTREE_NODES = 3` (`:49-54`). At a floor of two it found icon+label pairs; at three, **17 hits across 4 of 95 projects**, every one inspected a real duplicate |
| Oversized page | `oversized-page` ([`diagnostics.ts:357`](../../../packages/noodl-editor/src/editor/src/validation/diagnostics.ts), [`rules/oversizedPage.ts`](../../../packages/noodl-editor/src/editor/src/validation/rules/oversizedPage.ts)) | **info, never blocks** | `OVERSIZED_PAGE_NODES = 40` (`:57`), from a census of 51 real page components: median 6, p90 36, p95 66. The only gap in the distribution is 36→60 |

Two properties worth copying into every rule added here:

- **Matched on structure, never on parameter values.** Instances are *supposed* to differ in their
  values, so a value comparison fires only on literal copy-paste and misses exactly the case worth
  reporting.
- **Calibrated on the corpus before being trusted**, the AIB-001 habit. A false positive teaches an
  agent to distrust the whole diagnostic set — which costs more than the rule was ever worth.

## §2 — The four that are missing

From the README's track C and phase 55's "more gates" list. Each is a doctrine line that currently
has nothing behind it. Ranked by what the evidence says will actually fire:

### 1. A multi-column arrangement that can never collapse ⭐ **build this one first**

Doctrine `§7`: *"a `Group` never responds to width. There are no media queries anywhere in the
runtime except on one node."* This is the most consequential mechanical rule in the doctrine and it
is entirely unenforced.

Shape: a `Group` in row direction with **three or more visual children**, or with `flexWrap` set and
percentage track widths, and no `net.noodl.visual.columns` ancestor. Severity **warning**, and the
message must carry the exit: *"use a Columns node — `sizing: autoFit`, `minWidth: 260-320` for a
repeat, or `layoutString` plus `smallLayout` for a fixed arrangement."*

⚠️ Calibrate hard. A horizontal row of two or three small things (an icon and a label; a button pair)
is legitimate and everywhere. The rule wants **content bands**, not every flex row on the machine —
so the threshold is probably child count plus a minimum subtree size, the way
`repeated-sibling-subtree` uses two thresholds rather than one.

### 2. An image with no explicit size

Doctrine `§5`/`§8`: on `Image`, `net.noodl.controls.button` and `textinput`, `width`/`height`/
`objectFit` are **inert** unless `sizeMode: "explicit"`. This is a pure parameter check, needs no
graph traversal, and is the single most common silent styling loss in the phase's measurements.

**Warning, blocking for authored output.** For a graph an agent just wrote, a `width` that does
nothing is a value it believes it set and did not — the `InstanceUnknownParameter` argument exactly.
⚠️ Project-wide there will be a legitimate population, so it must be authored-only, like LAS-001's
three.

### 3. A page with one font weight

Doctrine `§3`, and the second of `§11`'s three DOM checks: *if the set of `fontWeight` across text
nodes is `{"400"}`, there is no hierarchy on the page.* The reason the fix mattered at all is that
before 0.1.4 there was **no `fontWeight` port on any node**, so every word rendered at 400.

Statically checkable: for one page component, collect `fontWeight` across `Text` descendants; if
every one is unset or `400` and there are more than ~8 of them, say so. **Info, never blocking** —
it is taste, and a deliberately monotone page exists.

### 4. An interactive node with no hover state

Named in phase 55's list. ⚠️ **Verify the premise before speccing this** — whether a hover state is
even expressible as a parameter on the affected node types, or whether it lives in a states/variant
mechanism the validator cannot see, decides whether this is a rule or a doctrine line. Lowest
confidence of the four; do it last.

## §3 — Where a gate is the wrong instrument

Recorded so this task does not grow into the wrong thing. `§11`'s other two checks —
`scrollWidth > clientWidth`, and grid items whose `offsetWidth` equals the container — are
**render-time** facts. A static validator cannot see either. They belong to the render report
(phase 55 LAS-005, `scripts/devtools/render-report.js`), and the question of making that loop routine
and cheap is phase 55's, not this task's.

The division that has held so far: **structure and parameters → validator; anything you can only
know by looking → renderer; everything else → doctrine, reluctantly.**

## Acceptance — per rule

- The rule is **calibrated against the corpus before being trusted**, and the hit count and the
  inspected sample are in the commit message. No rule ships on a fixture alone.
- The message names the defect **and the exit**, in the same sentence. A rejection without a
  suggested fix is a rejection a model argues with.
- Severity is chosen explicitly against the corpus population: **blocking for authored output** only
  where the project-wide population is legitimate but the *authored* population is a defect.
- Matched on structure, never on parameter values, wherever the rule is about duplication.
- ⚠️ Fires on the reference build where it should — that project is the calibration fixture and it
  contains real instances of at least the first two.
- The doctrine line it enforces stays in `design.ts`, and is **not** lengthened to compensate.

## Register

| # | Finding | State |
|---|---|---|
| F16 | **All three replay models ignored a warning that fired correctly on every one of them** — advice under pressure | ✅ closed by promotion to blocking (LAS-004); the measured result was 3 rejections in 91 calls and a **cheaper** run |
| F17 | Doctrine `§7` — the only responsive mechanism in the runtime — has **no gate at all** | 🔴 open, §2.1 — the largest remaining gap in the phase |
| F18 | `sizeMode`-gated inert dimensions have no gate, though they are the most-measured silent loss in the phase | 🔴 open, §2.2 |
| F19 | Two of `§11`'s three checks are **not statically decidable** and must stay in the render report | ✅ recorded — the division in §3 |
</content>
