# Phase execution — build the tasks, don't farm the defects

> **Standing rule, set by Richard 2026-08-30, for every phase, not just the one that caused it.**
> *"I love things being well tested, but we need to push forward with the alpha launch."*

This is not a instruction to test less. Every gate, drive and mutant this project has built stays.
It is an instruction about **what sets the agenda for the next session.**

---

## 1. The failure mode, measured

Phase 77 produced the numbers that made this rule necessary.

| | |
|---|---|
| new defect rows filed, s19 → s32 | **19 in 14 sessions — not one session filed zero** |
| tasks that reached green in that span | **1** (SBR-007, which had been open since s21) |
| last genuinely new task to close | **SBR-008, at s18** |
| tasks never started when the rule was written | **7 of 17** |
| size of the one task file that consumed s21–s32 | **1,403 lines, 35 numbered sections** |

The mechanism is a loop, and each turn of it is individually defensible:

```
drive a screen  →  find 1–3 real defects  →  file them
      ↑                                            ↓
  next session  ←  handoff says "🔴 FIRST JOB: fix this"
```

Nothing in that loop is wrong work. D31 was a genuine six-figure write storm in a shipping
template. The problem is that **discovery outpaces repair** — driving a real screen reliably finds
more than one defect per session — so a queue fed by driving and drained one row at a time **has no
reachable end state.**

🔴 **The tell that the loop has closed on itself: the phase starts filing defects about its own
instruments.** Phase 77's D32 is a defect about the gate that missed D31. When that appears, the
phase is no longer working on the product.

---

## 2. The rule

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.
> Otherwise it is filed in the register with an owner, and the next session builds the next task.**

Applied to phase 77 retroactively: D30 and D31 **did** block AC2 demonstrably, so fixing them was
right. D16, D22, D28 and D32 did not, and each would have gone to the backlog instead of claiming a
session.

### The three questions, in order

1. **Does an acceptance criterion fail because of this?** If no → register, owner, move on.
2. **Is there an unbuilt task?** If yes → build it. An AC that was never built is a feature the
   alpha does not have. A defect left in the register is a feature that is imperfect.
   🔴 **For a launch, absent is worse than imperfect.**
3. **Only then**, drain the register by severity.

### The ratchet

🔴 **If two consecutive sessions close zero acceptance criteria, the next session MUST build a
task** — not drive, not gate, not investigate. State it in the handoff when the ratchet trips.

---

## 3. How a handoff must be shaped

The handoff is what actually sets the next session's agenda, so the rule lives in its structure,
not in a paragraph nobody reaches.

**Required order:**

1. **THE BOARD FIRST** — every task with its real state, `⬜ never built` said in those words.
   🔴 **Re-derive it from the task FILES every time.** Phase 77's handoff omitted seven open tasks
   for two sessions because each session copied the previous table forward instead of reading the
   files; in the same phase, `TASKS.md` carried SBR-016 as open for seventeen sessions while
   SBR-016's own file had said FIXED AND DRIVEN since s15. **Where a status column and a task file
   disagree, the file is the artefact.**
2. **THE NEXT TASK TO BUILD** — named, with its first concrete step.
3. **The phase's end condition** — what has to be true to close, and how far away it is.
4. **The register, as an appendix** — with owners, marked `BLOCKS <AC>` or `BACKLOG`.

**Forbidden:** opening the handoff with a defect as `FIRST JOB` unless it carries `BLOCKS <AC>`.

---

## 4. What does NOT change

- Every existing gate, drive, mutant and control stays. **Delete nothing.**
- A defect found while driving is still **filed immediately and in full** — the finding is cheap at
  the moment of discovery and expensive to rediscover.
- A defect that blocks an AC is still first, and still gets a real fix with a real drive.
- Test quality standards are unchanged: controls, mutants, cardinality assertions, and the honest
  reporting of split or flaky readings.

🔴 **The change is the ordering, not the rigour.** Finding a defect is not a reason to fix it now;
it is a reason to write it down now.

---

## 5. Applies to

Every phase. When a new phase is opened, its `NEXT-SESSION-PROMPT.md` and `TASKS.md` follow §3.

⚠️ **Live phases carrying large registers when this was written:** phase 78 (**39** rows), phase 77
(**26**), and phase 80, which is *entirely* a defect register. Those three are where the rule bites
hardest, and where the ratchet in §2 should be checked at the start of every session.
