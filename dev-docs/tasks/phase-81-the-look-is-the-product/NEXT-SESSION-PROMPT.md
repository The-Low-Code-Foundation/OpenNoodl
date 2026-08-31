# Phase 81 — next session

**Read `README.md` §1–§4 first** — the ruling, the rubric, the protocol, the rules. Then
**`VIB-007-THE-LOOP.md` §2** (the mechanism mapping the next two tasks rest on) and **§6** (V22, ruled
and closed this session — it is also the worked example of what building one M2 predicate costs).
Re-derive the board from `TASKS.md` + the task files; do not trust this file's copy of it.

## Board, re-derived from `TASKS.md` (2026-08-31, session 7)

| id | status |
|---|---|
| VIB-001 The Judge | 🟢 CLOSED, all 5 ACs. Baseline 9 SHITTY / 0 / 0 |
| VIB-002 The Ceiling | 🟡 PASSABLE — Richard ruled it |
| VIB-003 The Pictures | 🟡 PASSABLE — Richard ruled it |
| VIB-004 The Marketing Kit | 🟡 PASSABLE, not yet seen by Richard |
| VIB-006 The Worked Page | 🟢 **CLOSED — WORTHY, ruled by Richard.** The phase's only close on the look |
| VIB-011 The Stock Library | 🟡 PASSABLE — ruled twice |
| VIB-012 Prune On Deploy | 🟢 BUILT. 3.35 MB → 92 KB. ⚠️ full Electron deploy never run end to end |
| **VIB-007 The Loop** | 🟡 **STARTED — AC2's first job done: V22 ruled and closed.** AC2 owes 5 more predicates; AC1/3/4/5 unstarted |
| VIB-013 The Altitude | ⬜ startable in parallel |
| VIB-005 The Ambush Defaults | ⬜ startable now — M2 applied to the runtime-default family |
| VIB-008/009 | ⬜ prove it on the shipped templates |
| VIB-010 The Cold Proof | ⬜ the exit exam. Waits on VIB-007 **and** VIB-013 |

## What this session did

**VIB-007's mandated first job was a render, and it was run.** AC2 said the 14 examples carrying a
`Component Inputs` with no `ports` and connections out of it were *"14 broken examples or 14 that work
by another route"*, and that only a render could say which.

🔴 **They were broken.** `demo/build-vib007-v22.js` + `packages/nodegx-backend/tests/vib007-v22.look.ts`
render two components identical but for the `ports` array, each drawn by a `For Each` over three
records, on one page:

| arm | rows drawn | showing the record's value | showing the placeholder |
|---|---|---|---|
| declared | 3 | **3** | 0 |
| undeclared | **3** | **0** | **3** |

`verdicts/vib-007/2026-08-31/v22-door/`, all four widths, `errors=0`. **The repeater still creates the
right NUMBER of instances** — the page keeps its shape and loses its content, which is why every
structural check passed for as long as it did.

Shipped from it: `undeclared-component-port` (**ERROR**) as `checkUndeclaredComponentPorts`, on **both**
the corpus gate and the authoring door; all 14 examples repaired (16 ports); the enriched catalog
regenerated and verified **through the door**.

## 🔴 Five things worth carrying out of this session

1. **A one-armed absence test cannot rule anything.** The declared arm is not politeness — without it,
   "the undeclared arm shows no value" is indistinguishable from "the repeater never ran", "the
   `Static Data` did not parse" and "the harness served the wrong page". It was asserted **first**.
2. 🔴 **A substring read as a word gave the OPPOSITE ruling.** The first count was
   `/DELIVERED-B/g`, which matches inside `NOT-DELIVERED-B`, and printed
   `delivered=3 placeholder=3` on a page where **nothing** was delivered. It looked like "both routes
   work". The fix is `(?<!NOT-)`; the lesson is that the discriminator strings must not be substrings
   of each other, and this is the *second* time this repo has been bitten by exactly this.
3. 🔴 **A relayed count outlives the sentence attached to it.** V22 said *"every one a repeater/`For
   Each` item component"*. Re-derived from the placers: **10** `For Each`, **1** `RunTasks`, **1 direct
   instance**, and **2 placed by nothing at all in their own example**. The count (14 files / 16 ports)
   was exactly right; the characterisation was not, and one of the four cases is a different, weaker
   finding hiding inside this one.
4. **A gate cannot find what its own model deletes** — the third time this phase. `validate-examples.ts`
   maps ports to `instancePorts: [name]`, so "declared" and "wired" were never in the same place and the
   question was unaskable. It read **53/67** the moment the check was switched on.
5. ✅ **V40's discipline paid on its first opportunity.** `catalog:merge:check` **did** red on the corpus
   edit before regeneration. A new example *or a new port* owes it — this session's edit was neither a
   new example nor a product port and it still went stale.

## 🔴 The next job

**Continue VIB-007 AC2 — five predicates remain: V23, V28, V29, V32, V33.** §6 of the task file is now a
worked example of the whole shape (predicate → corpus gate → authoring door → unit spec with a mutation
→ door spec including the *accepts-the-correct-answer* arm → repair the corpus → regenerate → verify
through the door). Take them in this order:

1. **V32** — cheapest by a distance and *configuration only*: run `raw-color-literal` in
   `catalog:examples`, which today does not. ⚠️ Expect it to red the corpus on the first run, as V22 did;
   the gate's own header explains why three of four families are excluded (the F14 blast-radius
   argument), so read that before widening beyond one family.
2. **V33** — an image parameter empty **and** unfed by a connection. The row supplies its own control:
   `ui-card-grid-repeater`'s `"src": ""` **is** connection-fed and is *correct*. A static "no empty image
   params" sweep would be wrong about it.
3. **V23** (glyph absent from the manifest), **V28** (raw px where a `--space` fits; and a `var()` in a
   units-typed port, which is dropped silently), **V29** (a `maxWidth` on a `Text` inside a centred shell).

⚠️ **AC1 (mandatory render) and AC3 (poverty findings) are untouched**, and AC1 is the one VIB-007's own
argument calls first: *"it converts a taste problem into a feedback-loop problem"*. A session with room
should do AC1 rather than finish AC2's tail — but say which it chose and why.

🔴 **Two things not to re-litigate**: instruction was measured and rejected as the lever (V17, V35), and
VIB-005 owns V1/V2/V14/V17/V21/V38 — the same mechanism on the runtime-default family. Do not duplicate.

## 🔴 Richard has TWO questions waiting, and neither blocks building

Silence is not assent. Both owner **NONE** — ask him.

1. **Are the six faces the right six?**
2. **Is 3.32 MB per project acceptable?** ⚠️ Ask it *narrowly*: the **deploy** half is solved (VIB-012
   prunes to 92 KB). What is unanswered is the **per-project** cost.

## Gate readings (2026-08-31, session 7) — 🔴 every row is an EXIT STATUS

A crashed `tsc` writes zero `error TS` lines, so a grep over its log reads `0` and is indistinguishable
from a clean pass.

| gate | reading |
|---|---|
| `vib007-v22.look.ts` | **exit 0** — 3/3, four viewports, `errors=0` on every shot |
| `npm run catalog:examples` | **exit 0** — **67/67** strict. ⚠️ **53/67** the moment the new check was switched on, before the repair |
| `npm run catalog:merge:check` | **exit 0** after regeneration; **exit 1 before it**, on this session's corpus edit |
| `npx jest --config packages/noodl-mcp/jest.config.js` | **exit 0** — **80 suites / 1048 tests** (was 79/1045) |
| `noodl-editor/tests-unit/vib-007/undeclaredComponentPort.test.ts` | **exit 0** — 8/8, incl. the corpus **mutation** |
| 14 neighbouring editor validation specs | **exit 0** — 14 suites / **192** tests |
| `npm run typecheck:editor` | **exit 0** |
| `npm run typecheck:mcp` | **exit 0** — ⚠️ **it read exit 2 first**, on a bad cast in the new door spec that the *jest run had passed*. The MCP suite does not typecheck its tests; this gate is the only thing that does |
| `npm run typecheck:backend-tests` | ⚠️ **not run.** Settled: OOMs on this box (exit 134) even narrowed to two files. CI `pr.yml:39` covers it. Do not chase it |
| `npm run test:ci` | ⚠️ **not run** — nothing this session touched is in it. Floor is 4, all AIX-006 by name |

## Standing cautions

- 🔴 **No proxy closes a task.** If you notice yourself grading JSON, stop and render.
- 🔴 **Legible and operable is the floor, not a grade** (Richard, 2026-08-31).
- 🔴 **Never raise a viewport to make content fit.**
- 🔴 **A NEW EXAMPLE OR A NEW PORT OWES `npm run catalog:merge:check`.** The corpus files and the file
  the door answers from are two different artefacts (V40).
- 🔴 **ASK THE DOOR WHETHER THE KIT ALREADY CAN — and whether the door can SEE the answer.** Both.
- 🔴 **RE-DERIVE A ROW FROM ITS PREDICATE.** It gives you the number the task gets built on, and this
  session it also corrected the row's own description of its population.
- 🔴 **A change to `DEFAULT_TOKENS`, `STYLE_COMPOSITIONS`, a tool description, what is installed in a
  project, or the example corpus owes the noodl-mcp suite.**
- 🔴 **Rebuild the viewer before a Judge run that depends on a runtime change.**
- 🔴 **`render-from-disk` reads tokens BY REGEX** — a comment between `name:` and `value:` deletes a token
  from every Judge photograph.
- ⚠️ Node ids are unique **project-wide**, not per component — `duplicate-node-id` is an ERROR.
- ⚠️ Shared checkout: **P80 is active in this tree** (HEAD moved mid-session to `dfa84939`). Commit by
  pathspec, `git add` untracked first, never stash, never `git checkout --` over live work.
