# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
`VIB-001-BASELINE-VERDICTS.md`, which is what everything else is now measured against. Re-derive
the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from the task files (2026-08-31, session 1)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 **CLOSED — all 5 ACs met.** Richard ruled the baseline 2026-08-31 and the rubric was amended. |
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

**The baseline: 9 SHITTY, 0 PASSABLE, 0 WORTHY**, after Richard's ruling.

🔴 **Read `VIB-001-BASELINE-VERDICTS.md` §7 and README §2 before judging anything.** He ruled the
two PASSABLE verdicts SHITTY: *"passable in terms of you can at least see the elements clearly and
interact, but they still look like original Wordpress default templates."* **Legible and operable
is the floor, not a grade.** App chrome is exempt from the marketing tells, never from the
default-template test — *does anything here show a decision, or is it the framework's defaults with
this app's content poured in?*

## First job

**VIB-005, and VIB-002 beside it.** Richard's ruling moved the target: fixing the ambush defaults
makes the app-chrome pages *correct*, and correct was never the question. So VIB-005 alone no
longer redeems `/setup`, the lists or the admin panel — each needs design of its own, out of the
widened kit VIB-002 builds. His ruling is the argument for doing the **vocabulary** work rather
than restyling two templates: app chrome and landing pages are failing on the *same* poverty.

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
