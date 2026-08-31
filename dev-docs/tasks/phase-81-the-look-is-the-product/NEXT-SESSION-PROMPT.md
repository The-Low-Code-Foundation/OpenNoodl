# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-001-BASELINE-VERDICTS.md`, which is what everything else is now measured against. Re-derive
the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 1)

| id | status |
|---|---|
| VIB-001 The Judge | 🟡 **AC1–AC4 met and committed** (`8a36f458`). AC5 is Richard's and is the only thing open. |
| VIB-002/003/004/005 | ⬜ the capability tier — all four are startable now, in parallel |
| VIB-006/007 | ⬜ consume the capability tier |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 | ⬜ the exit exam |

## What exists now

- `packages/nodegx-backend/tests/helpers/judge.ts` — the instrument. Frozen viewports, two honest
  states, two captures per shot, a manifest naming artefact md5 + HEAD sha.
- `packages/nodegx-backend/tests/vib001-{members,site}.look.ts` — one command each.
- `dev-docs/.../verdicts/vib-001/2026-08-31/` — 152 PNGs, committed, not gitignored.
- The baseline sheet for Richard:
  https://claude.ai/code/artifact/05e4edb4-ae93-4a88-b517-6b292d1e3434

**The baseline: 7 SHITTY, 2 PASSABLE, 0 WORTHY.**

## First job

🔴 **Check whether Richard has ruled on the baseline sheet before building anything.** If he has,
his verdicts supersede and the capability tier gets scoped against *his* line, not the session's.
If he has not, **do not block** — VIB-005 is the least rubric-sensitive task on the board (it fixes
mechanical traps, not taste) and is the right thing to build meanwhile.

⚠️ If you build VIB-005, read `VIB-001-BASELINE-VERDICTS.md` §5 first — it **corrects** README
§1(b). `scrollEnabled: 0` is confirmed, but `unreachablePx` was 0 on all 44 shots: the document
scrolls regardless. VIB-005's "unreachable" AC must name **which surface** it is about before a
diagnostic gets built for it, because this instrument does not render the editor's preview pane
and that is where the original observation was made.

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Never raise a viewport to make content fit.** The API has no parameter for it — keep it that
  way if you extend the harness.
- 🔴 **Ask which states in a picture your HARNESS chose.** The site-builder seed picked one section
  kind of four and nearly produced a verdict about the seed (`VIB-001-BASELINE-VERDICTS.md` §6).
  Reusing a drive's seed inherits the question that drive was asking.
- 🔴 **Neither look file is type-checked by anything** — the backend tsconfig covers `src/**` only
  and its ts-jest is `isolatedModules`. The jest run is the typecheck.
- ⚠️ P77 is active in site-builder files; P78 T6 owns D22/D23/D24; P80 owns door-correctness rows.
  V3 and V4 are template-correctness and sit in VIB-008 — cross-link with P80 rather than
  duplicating.
- ⚠️ Shared checkout: commit by pathspec, `git add` untracked first, never stash, never
  `git checkout --` as an undo.
