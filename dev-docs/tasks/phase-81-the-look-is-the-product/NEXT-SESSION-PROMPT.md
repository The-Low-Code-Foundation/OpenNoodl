# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
**`VIB-007-THE-LOOP.md` §10** (V29, built this session; §9 is AC2's tail, §8 is AC3, §7 is AC1).
Re-derive the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from `TASKS.md` (2026-08-31, session 11)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 CLOSED, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 PASSABLE — Richard ruled it |
| VIB-003 The Pictures | 🟡 PASSABLE — Richard ruled it |
| VIB-004 The Marketing Kit | 🟡 PASSABLE, **not yet seen by Richard** |
| VIB-006 The Worked Page | 🟢 CLOSED — **WORTHY**, ruled by Richard. The phase's only close on the look |
| VIB-011 The Stock Library | 🟡 PASSABLE — ruled twice |
| VIB-012 Prune On Deploy | 🟢 BUILT. 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| **VIB-007 The Loop** | 🟡 **AC1 ✅, AC2 ✅ (all six predicates), AC3 ✅. AC4/AC5 unstarted** |
| VIB-013 The Altitude | ⬜ startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now, **smaller** — V1/V17 closed by phase 84's FLD-005 on 2026-09-11; **V2/V14/V21/V38 remain** |
| VIB-008/009 | ⬜ prove it on the shipped templates. **Now also owns V45** |
| VIB-010 The Cold Proof | ⬜ the exit exam. Waits on VIB-007 **and** VIB-013 |

## What this session did

**V29 — AC2's last predicate. AC2 is closed; all six of M2's predicates ship.** Full account in
`VIB-007-THE-LOOP.md` §10. **Register V29's diagnostic half closes; V45 opens.**

`unrealised-measure` (**warning**) ships in `validation/unrealisedMeasure.ts` on the authoring door.

## 🔴 Six things worth carrying out of this session

1. 🔴 **The row's shape had 13 instances and exactly ONE was the defect — and the other twelve
   included three on the WORTHY page.** The register tables V29 as *"a `maxWidth` on a `Text` inside
   a centred shell"*. `vib007-v29.look.ts` rendered all 7 examples carrying one, at 1280 and 1900,
   and measured the painted extent of the band each sits in: **twelve read 374 left / 374 right**,
   three of them on `ui-landing-page` — the page Richard ruled *"fucking pro"*. Only
   `ui-image-scrim-band` reads **374 / 766**, reproducing the row's own numbers. **A check written to
   the row's sentence would have condemned correct typography twelve times.** That is now the third
   consecutive predicate (V23, V28, V29) where measuring first was the difference between a check and
   a libel, and the second running where the artefact it would have condemned is the WORTHY page.
2. 🔴 **The defect was on a different node from the one the row accuses.** `ui-gradient-hero` and
   `ui-image-scrim-band` are the same recipe — a `maxWidth: 1200` shell in a centred band, filled
   with capped `Text` — and differ by **one node**. Gradient-hero's uncapped `eyebrow` paints the
   shell's full 1152px, so the measure is realised and the band is symmetric. Scrim-band contains
   nothing that can draw to 1200. **The predicate is a property of the SHELL**, which is why no
   per-`Text` narrowing could ever have been correct: `ui-landing-page`'s `footer_blurb` is capped at
   **320** inside a 1900 band and is right.
3. 🔴 **Ask what the row's number is measuring.** "42 `maxWidth` occurrences" was the previous
   handoff's blast-radius warning. It decomposes to 29 on a `Group` (shells doing their job), 13 on a
   `Text` (the row's shape), **1** defect. Same arc as V28's *"30"* → 1.
4. ✅ **A spec grades the function; only a probe grades the wiring.** `unrealisedMeasure.test.ts`
   calls the check directly, which would read identically if the door swallowed every finding. So
   `authoredPreconditionDiagnostics` — the function **both** doors call — was run on both arms:
   defect **1**, control **0**, at `warning`. Do this for any check landing in a shared loop.
5. ✅ **Mutate the CONTROL, not just the subject.** *"Silent on gradient-hero"* is equally true of a
   check that never fires. The spec gives gradient-hero's uncapped `eyebrow` a cap and asserts the
   correct page becomes the defect — that is what makes the silence load-bearing.
6. 🔴 **`every()` over an empty list is `true`.** Without a cardinality guard the check would have
   reported every childless capped node in every graph as an unrealised measure. Asserted directly.

## 🔴 The next job

**VIB-007 AC4 — the A/B through the Judge.** It is VIB-007's original close condition, still
untouched, and now genuinely unblocked: **M1, M2 and M3 are all in and AC1/AC2/AC3 are met.** An
agent given only the standard surfaces must produce measurably richer output than the baseline,
judged through README §3 — which means a **render that gets LOOKED AT**, not a diagnostic count.
AC5 (`catalog:merge:check` + the noodl-mcp suite in the gate table) rides along with it.

**VIB-013 The Altitude** remains startable in parallel; §2's mapping says it retires M4/M5's ten rows.

🔴 **Three things not to re-litigate**: instruction was measured and rejected as the lever (V17,
V35); VIB-005 now owns **V2/V14/V21/V38 only** — 🔴 **V1 and V17 were reassigned to phase 84's
FLD-005 on 2026-09-11** (Richard's call on register P13; same defect, one owner, and #35 went with
it) and ✅ **FLD-005 BUILT AND CLOSED BOTH the same day** (`fed588edf` + `3ab87897e`): thirteen
compositions now carry `sizeMode: 'contentHeight'` and `column-children-split-a-fixed-height` is the
door diagnostic V1 asked for. Do **not** rebuild either. ⚠️ **V1's own sentence was wrong in a way
that changes what V2 is about**: an un-`sizeMode`d Group in a column does not eat the viewport, it
takes an equal SHARE and overwrites the content — and what makes that invisible is `clip: true`,
which is V2. FLD-005 measured a `card` losing **six of its ten lines** to it, so V2 now has a
rendered instance behind it instead of an argument. And **the poverty family is `warning` on
purpose** — V42.

## 🔴 Richard has THREE questions waiting, and none blocks building

Silence is not assent. All owner **NONE** — ask him.

1. **Are the six faces the right six?**
2. **Is 3.32 MB per project acceptable?** ⚠️ Ask it *narrowly*: the **deploy** half is solved
   (VIB-012 prunes to 92 KB). What is unanswered is the **per-project** cost.
3. **V42 — should a page declare its kind?** The poverty findings cannot block while nothing can tell
   a landing page from a settings page, because README §2 exempts app-chrome from the marketing
   tells. **This is the ceiling on M3 and it is his call.**

## Gate readings (2026-08-31, session 11) — 🔴 every row is an EXIT STATUS

A crashed `tsc` writes zero `error TS` lines, so a grep over its log reads `0` and is
indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `vib007-v29.look.ts` (real Chrome, 7 projects × 2 widths) | **exit 0** — 7/7, `consoleErrors []` |
| `unrealisedMeasure.test.ts` | **exit 0** — 18/18 |
| editor `validation\|parameterValue\|diagnostic\|vib-007\|def-003\|aib-001\|phase-55\|measure` | **exit 0** — **31 suites / 406 tests** |
| **full `noodl-editor` jest** | ⚠️ **exit 1 — 5 failed / 6614 passed** = the P80 s40 floor (sb-007 ×2, sb-018 ×2, aib-007 ×1). Passes rose 6596 → 6614 = this session's 18 tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| **full `noodl-mcp` suite** | ✅ **exit 0 — 83 suites / 1085 tests, 0 failed** |
| `npm run catalog:examples` | **exit 0** — 67/67 strict (new check deliberately NOT in it — §10.4) |
| `npm run catalog:merge:check` | **exit 0** — up to date, nothing regenerated |
| `npm run typecheck:backend-tests` | ⚠️ **not run** — OOMs on this box (exit 134). CI `pr.yml:39` covers it |
| `npm run test:ci` | ⚠️ **exit 1 — 2928 specs, 4 failures, seed 92315.** All four are **AIX-006 style vocabulary, by name** = the recorded floor. Fresh readout (`packages/noodl-editor/tests/test-results.json`, 22:21:21) |

✅ **The `provision`/`projectOwnsBackend` red pair is GREEN, and the cause is settled.** Three
consecutive handoffs recorded it. The full noodl-mcp suite now reads **83/83, exit 0**. Every
previous run happened while a peer (P80 s41) had `dev:debug` plus a community dev server live against
this checkout; that peer announced teardown at the start of this session and the pair passed on the
first run afterwards. **It was never anyone's code** — the structural diagnosis those handoffs
reached (neither file imports anything the sessions touched) was right, and the confirming experiment
was to run it with the box quiet.

🔴 **THREE other sessions were live in this checkout during this session**, and an uncommitted edit
to `packages/noodl-mcp/tests/sb007Template.test.ts` (mtime **22:07:06**) **was in the tree when the
full noodl-mcp suite was measured at 22:15 — and it passed, 83/83.** ⚠️ **Whoever owns that edit
should know a full suite ran over it.** It is NOT phase-82's: that session (`opennoodl-a3`, working
in a new `dev-docs/tasks/phase-82-0.2.2-the-first-row-on-the-shelf/`) was asked and says it is
docs-only and never touched the file, so it belongs to `opennoodl-07` or `opennoodl-f1`. Neither that
file nor `phase-82/` is in this session's commit.

🔴 **A background run reported "exit code 0" for a gate that exited 1 — and the harness was RIGHT.**
`test:ci` was launched wrapped as `(npm run test:ci > log 2>&1; echo "EXIT=$?" >> log)`. A subshell
exits with the status of its **last** command, which was the `echo`. The harness reported the
subshell correctly. **The defect was the question, not the answer**: "did the wrapper succeed?" was
asked when "did npm succeed?" was meant — so do not record this as the harness lying, which is the
framing that makes the next reader blame the notification instead of their own shell.

✅ **What actually gave the reading**, and what to do instead: the `EXIT=1` line inside the log, and
`packages/noodl-editor/tests/test-results.json` — `totalCount` 2928, `failedCount` 4, the four names,
and a **fresh mtime** (22:21:21). End a gate command with the gate, and read the readout, never the
notification.

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **A backtick in a comment inside `measureExpression` ends the template literal.**
- 🔴 **A NEW EXAMPLE OR A NEW PORT OWES `npm run catalog:merge:check`** — and so does a **description**
  edit.
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN — and whether the door can SEE the answer.**
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE**, description included. Three for three this phase.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, what is installed in a
  project, or the example corpus owes the noodl-mcp suite.**
- 🔴 **Run the whole validation NEIGHBOURHOOD after adding a check, and then OTHER TASKS' dirs.**
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component.
- ⚠️ Shared checkout: commit by pathspec, `git add` untracked first, never stash, never
  `git checkout --` over live work.
