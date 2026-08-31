# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
**`VIB-007-THE-LOOP.md` §7** (AC1, built this session — it is also the worked example of what a
*mechanism* task costs here, as §6 is for one M2 predicate). Re-derive the board from `TASKS.md` +
the task files; do not trust this file's copy of it.

## Board, re-derived from `TASKS.md` (2026-08-31, session 8)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 CLOSED, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 PASSABLE — Richard ruled it |
| VIB-003 The Pictures | 🟡 PASSABLE — Richard ruled it |
| VIB-004 The Marketing Kit | 🟡 PASSABLE, **not yet seen by Richard** |
| VIB-006 The Worked Page | 🟢 CLOSED — **WORTHY**, ruled by Richard. The phase's only close on the look |
| VIB-011 The Stock Library | 🟡 PASSABLE — ruled twice |
| VIB-012 Prune On Deploy | 🟢 BUILT. 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| **VIB-007 The Loop** | 🟡 **AC1 BUILT (this session) + AC2's first predicate (V22, last session).** AC2 owes 5 predicates; **AC3/AC4/AC5 unstarted** |
| VIB-013 The Altitude | ⬜ startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now — M2 applied to the runtime-default family |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 The Cold Proof | ⬜ the exit exam. Waits on VIB-007 **and** VIB-013 |

## What this session did

**AC1 — the render is mandatory.** It was chosen over AC2's tail because VIB-007's own argument calls
M1 first (*"it converts a taste problem into a feedback-loop problem"*) and the last handoff said a
session with room should take it. Full account in `VIB-007-THE-LOOP.md` §7.

The seam was **not** what §3 M1 assumed, and measuring it first changed the whole design:

- `apply_plan` has rendered by itself since LAS-005 §4 and **appends the numbers**.
- `create_component` / `update_component` — *"the door a page most often comes through without a
  plan"*, in LAS-006's own words — **never render**.
- **Nothing turned a finding into a refusal**, and nothing recorded that a render had happened. So
  `validate_project` — the call a model makes to ask whether its work is good — could answer yes about
  a project nobody had ever looked at.

Shipped: `src/renderVerdict.ts` (the verdict + a session ledger keyed on a project **content
signature**), `src/tools/completion.ts` (one `done` block on every door), the verdict on
`render_report` **before the JSON**, on `apply_plan` **above its `note`**, on both write doors, and on
`validate_project`; `apply_plan` **refuses `render:"off"` on a visual plan, before any write**.
Demonstrated with a real Chrome on a deliberately poor page: **NOT DONE → named → fixed → DONE**
(`tests/vib007-m1.door.ts`, 4/4).

## 🔴 Five things worth carrying out of this session

1. 🔴 **The first design was wrong, and its own task file is what refuted it.** Refusing the *write*
   until a page renders clean is buildable and destroys the loop M1 exists to create — *"a model is
   mediocre at one-shot taste and good at iterating against a signal"*, and you cannot iterate on what
   you were not allowed to save. **It refuses to certify, never to write.** When a mechanism's shape
   is in question, re-read the argument that justified it before designing against it.
2. 🔴 **ASK THE DOOR WHETHER IT ALREADY DOES THIS — twice in one session it half did.** The render was
   already automatic on one of the two write paths, which turned "add a render" into "the render's
   numbers were appended to a response whose top-level shape said success". That is the AWP-004 defect
   (*"Rendered clean"* over unreachable content) one layer up, and the VIB-001 defect (a structural
   pass proxying for the thing asked) one layer sideways.
3. ✅ **The blocking family was measured, not chosen.** `nodegx-render-measure` already grades five of
   its thirteen findings `error`, and those five are exactly "the page is unfinished". The predicate is
   **the severity** — a retyped list would be a second copy to drift.
4. 🔴 **A gate that never accepts is indistinguishable from a gate that is broken.** The accepts arm
   (step 4: the fixed page renders clean, every door says DONE) is asserted in both the unit spec and
   the real-Chrome demonstration. Third time this phase.
5. ⚠️ **A description edit can hand tokens BACK.** V35 recorded *1 token* of surface headroom; this
   session rewrote `apply_plan`'s `render` parameter to state a refusal, in **fewer** characters, and
   the gate now reads **8,274 — six under 8,280**. 🔴 The row's *warning* stands and its *number* did
   not: read the `[surface]` line the spec prints on a passing run, never a doc's copy of it.

## 🔴 The next job

Two live candidates, and a session should say which it took and why:

1. **VIB-007 AC3 — M3, the poverty findings.** This is what AC1 most obviously enables: a mandatory
   render is *where a poverty finding would be read*, and until M3 ships, the gate is silent on the
   exact failure the VIB-001 baseline is made of — a page that renders perfectly clean and is worth
   nothing to look at. ⚠️ **AC3 requires both arms**: at least three findings that fire on the baseline
   artefacts **and are silent on the VIB-006 page**. A finding that fires on everything is noise.
   `oversized-page` is the proof the machinery exists and is set too quiet.
2. **VIB-007 AC2's tail — V32, V33, V23, V28, V29**, in that order. V32 is *configuration only* (run
   `raw-color-literal` in `catalog:examples`); expect it to red the corpus on the first run as V22 did,
   and read the gate's own header on the F14 blast-radius argument before widening beyond one family.

⚠️ **AC4 (the A/B through the Judge) is VIB-007's original close condition and is untouched.** It
cannot be honestly attempted until M2 and M3 are in, because it measures what an agent produces with
the standard surfaces — which is what those two change.

🔴 **Two things not to re-litigate**: instruction was measured and rejected as the lever (V17, V35),
and VIB-005 owns V1/V2/V14/V17/V21/V38 — the same mechanism on the runtime-default family.

## 🔴 Richard has TWO questions waiting, and neither blocks building

Silence is not assent. Both owner **NONE** — ask him.

1. **Are the six faces the right six?**
2. **Is 3.32 MB per project acceptable?** ⚠️ Ask it *narrowly*: the **deploy** half is solved (VIB-012
   prunes to 92 KB). What is unanswered is the **per-project** cost.

## Gate readings (2026-08-31, session 8) — 🔴 every row is an EXIT STATUS

A crashed `tsc` writes zero `error TS` lines, so a grep over its log reads `0` and is
indistinguishable from a clean pass.

| gate | reading |
|---|---|
| `tests/vib007-m1.door.ts` (real Chrome, outside `testMatch`) | **exit 0** — 4/4 |
| `tests/vib007RenderGate.test.ts` | **exit 0** — 12/12, incl. the signature **mutation** and the accepts arm |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0 — 81 suites / 1061 tests** (was 80/1048) |
| the surface budget spec | **exit 0 — 8,274 tokens, 6 under 8,280** (was 8,279) |
| `npm run typecheck:mcp` | **exit 0** |
| `npm run typecheck:backend-tests` | ⚠️ **not run.** Settled: OOMs on this box (exit 134) even at two files. CI `pr.yml:39` covers it |
| `npm run test:ci` | ⚠️ **not run** — nothing this session touched is in it. Floor is 4, all AIX-006 by name |
| `npm run catalog:examples` / `catalog:merge:check` | ⚠️ **not run** — no corpus or port edit this session |

⚠️ **A cross-suite flake, recorded because the next reader will hit it.** The first full-suite run
after adding this session's spec failed **4 tests in `provision.test.ts` + `projectOwnsBackend.test.ts`**
— both of which pass in **2.1s in isolation** and had passed in the run before. They share durable
per-machine backend state; adding a suite re-shuffles jest's worker scheduling, which is enough to
pair them. **Not caused by this session's code, and not fixed by it** — if you see it, re-run those two
alone before believing it.

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **A NEW EXAMPLE OR A NEW PORT OWES `npm run catalog:merge:check`.**
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN — and whether the door can SEE the answer.** Both.
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE**, description included.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, what is installed in a
  project, or the example corpus owes the noodl-mcp suite.**
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a
  token from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component.
- ⚠️ Shared checkout: **P80 was active in this tree today.** Commit by pathspec, `git add` untracked
  first, never stash, never `git checkout --` over live work.
