# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then re-derive
the board from `TASKS.md` + task files.

## State (as of phase open, 2026-08-31)

- Nothing built. VIB-001 (The Judge) is fully specced in `VIB-001-THE-JUDGE.md` and is the ONLY
  startable task — everything else closes through it.
- The diagnosis this phase rests on is in README §1; do not re-derive it, but DO verify any
  file:line you act on (it was measured 2026-08-30/31).

## First job: VIB-001

Build the screenshot harness per its §2–§4, record the baseline verdicts per §5–§6. The baseline
will be SHITTY; that is the task succeeding. AC5 ends with Richard calibrating the rubric against
the baseline sheet — prepare that sheet (one page collating PNGs + verdicts) for him.

## Standing cautions

- 🔴 This phase's core rule: **no proxy closes a task.** If you notice yourself grading JSON,
  stop and render.
- 🔴 Never raise a viewport to make content fit (VIB-001 §3).
- ⚠️ P77 is active in site-builder files; P78 T6 owns D22/D23/D24; P80 owns door-correctness
  rows. Cross-link, don't duplicate. Check lanes (`git status` + file mtimes) before touching
  shared files.
- ⚠️ Shared checkout: commit by pathspec, `git add` untracked first, never stash, never
  `git checkout --` as an undo.
