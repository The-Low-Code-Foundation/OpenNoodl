# Next session — phase 72

**Written 2026-08-19, second session.** Tier 0 and half of Tier 1 are **built and committed**.
NAT-003 is next and is the other half of the same measurement.

## Read first, in this order

1. [NAT-002](NAT-002-THE-GREY-NOBODY-CAN-READ.md) §"Done" — what the palette is **now**, and the
   remainder it deliberately did not clear.
2. [README §4](README.md) — **D9 settled, D11 and D12 added and settled.** Five rulings still open (D5, D6, D7, D8, D10).
3. [TASKS.md](TASKS.md) — NAT-003 is the next row, and 🔴 it is *measured together* with NAT-002.

## What happened this session

**NAT-001 ✅** — the editor now has the contrast gate the platform has had since UNI-013.
`tests-unit/nat-001/palette-contrast.spec.ts`, 36 pairs × 2 themes + six controls, under
`npm run test:main` (jest matches by path — **no barrel to register**).
🔴 **It was observed at 22 failures on the unmodified palette before a single hex value moved**,
and those numbers are in the task file.

**NAT-002 ✅** — 123/123 green. Three rulings, not one:

- **D9 — Richard retired `fg-muted`** (an alias of `fg-default-shy`), against this task file's own
  recommendation. The ~217 declarations naming it keep working and all get AA.
- **D11 — the accent splits fill from text.** `--theme-color-fg-accent`. Only **light** moves.
- **D12 — the status colours split the same way.** `-fg-success` / `-fg-notice` / `-fg-danger`.

Both D11 and D12 came out of NAT-001's measurements and were **not** in the review's scope.

## Where to start — 🔴 there are TWO candidates, and this file used to name only one

A peer session added **NAT-014** and **NAT-015** to this phase after the palette work started.
[TASKS.md](TASKS.md) §The order says **NAT-014 can start on day one and should** — it depends on
nothing, three Tier-3 tasks cannot close until it does, and it is *the only task whose defect is
currently telling users something untrue* (no mail leaves the platform: `drainOutbox` exists, is
tested, and has no production caller). It is a **platform** task, so it does not touch the palette
and the two can run in either order or in parallel.

**If you are continuing the LOOK: NAT-003.** If you are picking the highest-value unstarted work
in the phase: **NAT-014**. NAT-015 rides along with NAT-007 and is not a standalone start.

### NAT-003 — the elevation ramp

The instrument is built and its numbers are already recorded:

```
bg-1 on bg-0   1.06 dark / 1.13 light
bg-2 on bg-1   1.07 / 1.06
bg-3 on bg-2   1.16 / 1.09
```

🔴 **Those rows are deliberately NOT in NAT-001's PAIRS**, and the reason is in NAT-001's task
file: a card edge is decorative elevation, not a control boundary, so asserting WCAG 1.4.11's 3:1
on it would be a gate rejecting a correct answer. **NAT-003 has to state its own bar as a design
choice and defend it** — do not borrow WCAG's number for a thing WCAG does not govern.

Two things NAT-003 inherits, already measured:

- **`fg-default-shy` has only ~0.17 of headroom on `bg-4`** (4.67 dark). If NAT-003 lifts the dark
  ramp, bg-4 gets lighter and that token fails again. The gate will say so — re-run it, don't
  assume.
- **The light `--theme-color-primary` clears `bg-1` by 0.07** (4.57). If `bg-1` moves in light,
  re-measure the accent. NAT-002's trap section already flagged this and it is now load-bearing.

## Before you touch a hex value (NAT-003 only)

🔴 **Run `npm run test:main` and see it green first.** Same lesson as last session, one level up: a
palette change measured only after the fact proves nothing, and this session's gate exists
precisely so the *next* change has a before.

## The queue NAT-002 did not clear

**~99 files still paint words with a fill role** (`color: var(--theme-color-primary|success|
notice|danger)`, 202 declarations). NAT-002 migrated the design system's text primitive
(`Text.module.scss`) and the community surfaces; the rest hand-rolled a colour instead of going
through `Text`, and a grep cannot separate those from `currentColor` icon fills.
⚠️ **They are sub-AA in light today.** NAT-005 should take the ones on the community surfaces; the
rest want their own task **with a ratchet spec** — a count that may only go down — because nothing
currently stops a hundredth.

## 🔴 One loose end that is not a task

`packages/noodl-core-ui/src/preview/launcher/Launcher/views/Community.tsx` carries a NAT-002 edit
(`shy` → `fg-default-shy`, "Try again" → `fg-accent`, the border → `border-control`) and is
**untracked** — it is part of the UNI-011 tranche that has never been committed, along with
`mirrorview.ts`, `useCommunityMirror.ts` and `CommunityPanel/`. Taking ownership of another phase's
uncommitted work was not NAT-002's call, but **that tranche is one `git clean` from gone.**
Ask Richard whether it should be committed.

## Verification notes that earned their place this session

- 🔴 **A known-bad control rots when somebody fixes the defect.** It happened **twice** in one
  session — mine (`fg-muted` on `bg-0`) and the platform's, which began *failing because the
  palette got better*. Both are now self-calibrating: measure a pair that passes, then demand
  0.01 more than it scores.
- 🔴 **"They must differ" can be the wrong assertion.** In dark, `fg-success` and `fg-notice`
  deliberately equal their fills because those already read. The spec asserts the **conditional** —
  a text role may share a fill only where that fill is readable — so a correct answer is not
  rejected.
- 🔴 **Grep for the token before adding one.** `--theme-color-border-control` already existed
  (POL-016) with exactly the right value and reasoning, while the launcher's button drew a 1.32:1
  border. Two of the three tokens this task needed were already in the file.
- ⚠️ **A spec can keep its own copy of `colors.css`.** `tests/canvas/CanvasThemeNodeSchemes.test.ts`
  does, it drifted, and nothing failed — it would simply have gone on grading a palette the product
  no longer ships.
