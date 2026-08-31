# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
**`VIB-007-THE-LOOP.md` §9** (AC2's tail, built this session; §8 is AC3, §7 is AC1, §6 is V22).
Re-derive the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from `TASKS.md` (2026-08-31, session 10)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 CLOSED, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 PASSABLE — Richard ruled it |
| VIB-003 The Pictures | 🟡 PASSABLE — Richard ruled it |
| VIB-004 The Marketing Kit | 🟡 PASSABLE, **not yet seen by Richard** |
| VIB-006 The Worked Page | 🟢 CLOSED — **WORTHY**, ruled by Richard. The phase's only close on the look |
| VIB-011 The Stock Library | 🟡 PASSABLE — ruled twice |
| VIB-012 Prune On Deploy | 🟢 BUILT. 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| **VIB-007 The Loop** | 🟡 **AC1 ✅, AC3 ✅, AC2 five of six ✅.** AC2 owes **V29 only**; **AC4/AC5 unstarted** |
| VIB-013 The Altitude | ⬜ startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now — M2 applied to the runtime-default family |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 The Cold Proof | ⬜ the exit exam. Waits on VIB-007 **and** VIB-013 |

## What this session did

**AC2's tail — V32, V33, V23, V28.** The previous handoff named this as the only thing between
VIB-007 and AC4, and named V32 first because it is *configuration only*. Full account in
`VIB-007-THE-LOOP.md` §9. **Register V32, V33, V23, V28 all close; V43 and V44 open.**

Four checks now ship: `raw-color-literal` switched on in the corpus gate, `unsourced-image` on the
gate and the door, `raw-spacing-literal`, and the curated Lucide set widened 212 → 215. Two corpus
repairs, both graded by mutation rather than by census.

## 🔴 Nine things worth carrying out of this session

1. 🔴 **Three of the five register rows did not survive being measured, and two of the tabled
   predicates would have condemned CORRECT authoring.** V23's *"a glyph absent from the manifest"*
   would have fired on **five glyphs on the page Richard called "fucking pro"** — glyphs that render
   perfectly, because the manifest's own `_note` says the curated 212 is not a ceiling. V28's *"a
   `var()` in a units-typed port is dropped silently"* is simply **false**: a four-arm render reads
   `var(--space-16)` at exactly **64px**. **Measure the row before you build the row's check.**
2. 🔴 **A row's NUMBER decays as badly as its claim.** V28's *"30 raw pixel numbers"* re-derived to
   **1** (402 spacing parameters, 401 tokenised). V32's blast radius was **1**, not the F14-scale
   population its header implied. Both took one probe.
3. 🔴 **The biggest-looking population was the CORRECT one.** 15 `Columns` `marginX`/`marginY` values
   look exactly like V28's defect. The runtime's own note: *"autofold genuinely needs a number… a
   tokenised `marginX` still folds as though the gutter were 0."* A rule written to the row would
   have told authors to break the fold.
4. 🔴 **A new check can silently DOWNGRADE an old one, and only the neighbourhood finds it.**
   `paddingTop: "16px"` was an `invalid-parameter-value` **ERROR** whose message is *"dropped
   silently"*. The new spacing rule matched it first and `continue`d, replacing that error with a
   warning about tokens. Caught by `tests-unit/aib-001/parameterValues.test.ts` — **a neighbour's
   spec**, run only because the whole validation neighbourhood was run.
5. 🔴 **A check in a shared loop is graded by suites in OTHER tasks' directories — and a peer found
   the third one AFTER the commit.** `def-003` (a P80 file) held two unfiltered `toEqual([])` rows
   over `paddingLeft: 24`, one of them an explicit anti-widening tripwire. They now assert the **set
   of codes**, which is a *stronger* guarantee than total silence: it names who may speak, so a
   fourth rule still trips the row. ⚠️ **Note the shape**: `validation/` was CLEAN in the working
   tree, so a dirty-tree check said "not mine" — it was **committed**, and `git log -- <path>` is
   what found it.
6. 🔴 **A noise estimate taken from the corpus is taken from the wrong population.** 401 of 402
   corpus spacing parameters are already tokenised — it is the most tokenised artefact set that
   exists, so it could not show how often `raw-spacing-literal` fires on ordinary work.
   `paddingLeft: 24` is correct authoring and now draws a warning. That is `raw-color-literal`'s
   deliberate bargain and this sits inside it, but **price a user-facing rule against a real
   project, not against `docs/node-catalog/examples`**.
7. 🔴 **A dead guard is worse than no guard.** `node.type !== COLUMNS_TYPE && SPACING_PORTS.has(name)`
   — `Columns` has **no padding port at all** and neither margin is in the port set, so the type test
   could never exclude anything while reading as the thing protecting you. Assert the mechanism.
8. ✅ **Derive a table from its source rather than restating it.** The spacing spec builds the scale
   from `DefaultTokens.ts` and caught four missing tokens (`--space-20/24/28/32`) on its first run.
9. ✅ **The corpus's own prose can ask for a narrowing before the check exists.**
   `ui-image-scrim-band`'s description — *"Leaving it empty is not broken: the gradient alone is
   still a designed ground"* — is what produced V33's gradient exemption. Without it the check would
   have contradicted the recipe it was written for.

## 🔴 The next job

**VIB-007 AC2's last predicate: V29** — *"a `maxWidth` on a `Text` inside a centred shell; the
measure belongs to the shell."* It is the only thing left before AC4, and unlike V22 and V28 it does
**not** need an experiment first: Richard already ruled it (*"the structural page divs have a max
width… white space to the left and right equally"*).

⚠️ **But read §9.4 before trusting its scope.** `maxWidth` appears **42 times** in the corpus — by
far the largest raw-px population measured this session — so the blast radius is real and *the
narrowing is most of the work*. Do not build the predicate from the row's sentence; sweep the 42
first and find out how many are the defect and how many are a shell doing its job.

After V29: **AC4, the A/B through the Judge** — VIB-007's original close condition, still untouched,
and now genuinely close (M1, M2 and M3 are all in). **VIB-013 The Altitude** remains startable in
parallel and §2's mapping says it retires M4/M5's ten rows.

🔴 **Three things not to re-litigate**: instruction was measured and rejected as the lever (V17,
V35); VIB-005 owns V1/V2/V14/V17/V21/V38; and **the poverty family is `warning` on purpose** — V42.

## 🔴 Richard has THREE questions waiting, and none blocks building

Silence is not assent. All owner **NONE** — ask him.

1. **Are the six faces the right six?**
2. **Is 3.32 MB per project acceptable?** ⚠️ Ask it *narrowly*: the **deploy** half is solved
   (VIB-012 prunes to 92 KB). What is unanswered is the **per-project** cost.
3. **V42 — should a page declare its kind?** The poverty findings cannot block while nothing can tell
   a landing page from a settings page, because README §2 exempts app-chrome from the marketing
   tells. **This is the ceiling on M3 and it is his call.**

## Gate readings (2026-08-31, session 10) — 🔴 every row is an EXIT STATUS

A crashed `tsc` writes zero `error TS` lines, so a grep over its log reads `0` and is
indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `vib007-v32.look.ts` (real Chrome, three arms) | **exit 0** — `consoleErrors []` |
| `vib007-v28.look.ts` (real Chrome, four arms) | **exit 0** — `consoleErrors []` |
| `npm run catalog:examples` | **exit 0** — 67/67 strict, three more checks on |
| `catalog:examples` on a mutated copy | **exit 1** — 66/67, the one raw colour named |
| `npm run catalog:merge:check` | **exit 0** after regeneration; **exit 1 before it** |
| editor `validation\|parameterValue\|diagnostic\|vib-007\|def-003\|aib-001` | **exit 0** — **20 suites / 267 tests** |
| **full `noodl-editor` jest** | ⚠️ **exit 1 — 5 failed / 6596 passed** = the floor P80 s40 recorded (sb-007 ×2, sb-018 ×2, aib-007 ×1). It read **7** until `c83eb13b` |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** |
| full `noodl-mcp` suite | ⚠️ **exit 1 — 83 suites / 1085 tests, 4 failed.** See the caution |
| `npm run typecheck:backend-tests` | ⚠️ **not run** — OOMs on this box (exit 134). CI `pr.yml:39` covers it |
| `npm run test:ci` | ⚠️ **not run** — a peer had `scripts/start.ts` + a community `npm run dev` live in this checkout all session |

🔴 **The red pair is `provision.test.ts` + `projectOwnsBackend.test.ts` for the THIRD handoff running,
and this time it was measured structurally.** `grep -c validation` over both files returns **0**, and
every change this session is in `validation/`, the corpus, `scripts/` or specs — there is no import
path from those suites to anything touched. The **failing set moves between runs**: the full suite
failed 4 (three in `provision`, one in `projectOwnsBackend`); the pair run alone failed **3 / 20
passed** — a *different* three, with `projectOwnsBackend` green. A peer session (P80 s41) announced
and ran `dev:debug` plus a community dev server against this checkout throughout. **If you see it,
run the pair alone before believing it is yours, and check `ps` for a peer stack.**

⚠️ **`packages/noodl-editor/src/editor/src/models/community/communityorigin.ts` is modified in the
tree and is NOT this session's** — P80 s41 announced pointing `COMMUNITY_URL` at `localhost:3000`
temporarily and said they would revert it. It was deliberately **left out of this session's commit**.

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **A backtick in a comment inside `measureExpression` ends the template literal.**
- 🔴 **A NEW EXAMPLE OR A NEW PORT OWES `npm run catalog:merge:check`** — and so does a **description**
  edit, which this session confirmed twice.
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN — and whether the door can SEE the answer.**
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE**, description included.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, what is installed in a
  project, or the example corpus owes the noodl-mcp suite.**
- 🔴 **Run the whole validation NEIGHBOURHOOD after adding a check, not just your own spec.**
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component.
- ⚠️ Shared checkout: **P80 was active in this tree today.** Commit by pathspec, `git add` untracked
  first, never stash, never `git checkout --` over live work.
