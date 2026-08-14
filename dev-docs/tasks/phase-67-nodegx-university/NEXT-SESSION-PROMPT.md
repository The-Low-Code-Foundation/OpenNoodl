# Phase 67 — next session prompt

Paste the block below into a fresh session.

---

Continue phase 67 (NodeGX Community), `dev-docs/tasks/phase-67-nodegx-university/`.

**Read first, in this order:** `RULINGS.md` (eleven rulings + the curriculum fact-check, **and its
amended Blocker 1**), then `UNI-007-THE-LESSON-BEAMED-INTO-THE-EDITOR.md` (its header now records
what is built), then `TASKS.md`. `PRIOR-ART-RECONCILIATION.md` if you have not read it before.

**🔴 The rulings queue is EMPTY. Nothing is blocked on a decision.** Do not re-litigate D1–D11 — if
one is wrong, amend `RULINGS.md` with a date and a reason. The four to keep in your head:

- **D2** — the platform is **NodeGX Community**; **NodeGX University is its learning wing**. Editor
  button: **"Sign in to NodeGX"**. Repo is `The-Low-Code-Foundation/nodegx-community`. ⚠️
  `community.nodegx.dev` is *not registered* — a choice, not a fact.
- **D5** — the Learning folder is a **visible launcher section, platform-managed**: edit freely,
  can't rename/detach/delete, reset = re-pull. 🔴 **The editor process writes it — never the
  platform, never an MCP sidecar.**
- **D4** — a challenge awards into a **(family, tier)**, never a `badgeId`.
- **D9** — 🔴 ruled *against* the recommendation: a record-capped backend means UNI-008 holds end-user
  data. Five obligations in `RULINGS.md`; effort raised; still last.

## What last session built — the first code of the phase

**UNI-007 slice 1: the grading runner's static half and both of its engines.** Editor-side, on
`cline-dev`, committed. No platform, no account, no MCP wiring, no UI.

| File | What it is |
|---|---|
| `packages/noodl-editor/src/editor/src/models/lessonverify.ts` | the **static two-vocabulary check** — `verifyLessonManifest()` |
| `packages/noodl-editor/src/editor/src/models/lessongrading.ts` | the **grading runner** — engine 1 (per-step), engine 2 (injected port), the evidence bundle |
| `packages/noodl-editor/tests-unit/uni-007/` | 48 tests, **jest / `test:main`** |

One upstream change: `views/lessons/lessonevalconditions.ts` now `require`s `ProjectModel` /
`NodeGraphContextTmp` **inside `liveLessonEvalContext()`** instead of at module scope. 🔴 That is
load-bearing, not tidying — it is what lets the runner load outside a renderer, which is the whole
of "the same verifier, not a fork" for UNI-010's MCP path. Do not move them back.

## 🔴 The finding that should change how you check things

`RULINGS.md` recorded the two-vocabulary rule as **nine divergences, two of them ambiguous**. That
number came from re-checking the nine names the archive already listed. Re-deriving the classes from
`node-catalog.json` itself gives:

- **103** plain divergences (not 9)
- **4** ambiguous (`Array`, `Object`, **`Component Object`**, **`Parent Component Object`**)
- **6 shadowed** — *a class no document carried*: `Variable`, `Button`, `Text Input`, `Checkbox`,
  `Radio Button`, `Cloud Function`. The string **is** a real type name, so `hasType()` returns true
  and an existence check passes — but it names the **deprecated** node. The one the learner drags
  out of the picker is `Variable2`, `net.noodl.controls.button`, `net.noodl.controls.textinput`, …

`LESSON-FORMAT.md §3` explicitly listed `Variable`, `Button` and `Text Input` among the nodes that
*"use the same string for both"*. **`Variable` is the curriculum's own L6 node** (CURRICULUM-DESIGN
D3). An author following that sentence would have written a step that can never complete, for the
most-taught state node in the spine. Corrected in place.

**The lesson, and it is a new one:** every earlier finding in this phase was a *register* that had
outlived its fix. This was a **measurement that outlived its method** — re-checking a list can only
ever confirm the list. **Re-derive from source; don't re-verify a table.**

## This session's job — pick one

1. **The MCP adapter for engine 2** *(recommended — it is the only piece of UNI-007 criterion 3 still
   missing, and it is small)*. `WholeSolutionGrader` is an interface with no implementation.
   - **validity** → `noodl-mcp/src/validate.ts` already runs on the editor's own `SemanticValidator`.
   - **render** → `noodl-mcp/src/render.ts` spawns `scripts/devtools/render-report.js` as a child
     process. ✅ `render:report` is safe to run beside a live sibling.
   - 🔴 **The adapter must report `drawnElementCount`.** `normaliseWholeSolutionResult()` already
     rewrites `rendered: true` + zero drawn to `rendered: false`, but an adapter that reports no
     count at all opts out of the check. Assert *drawn output*, never absence of errors.
2. **The Learning folder** (D5) — the launcher section, editor-process-written, cards carrying
   completion/score/feedback. Unblocks UNI-007 criterion 2 *and* makes UNI-010 runnable end to end
   with no account. Bigger, and it is UI, so it needs a real drive to prove.
3. **COL-004 advisory component claiming** (phase 51's own "ship this first, alone", 3 days) —
   unblocks UNI-005's shared shelf, but nothing in phase 67 consumes it yet.

⚠️ **Two owed items phase 67 still does not carry**, both from CURRICULUM-DESIGN §11 and both
landing on UNI-007: **curriculum hosting** (§9.3, now partly a D2/D9 question) and the **tutor
lesson-context overlay** (§9.1, *"required before L2 testing"*).

⚠️ **A side finding worth one line of work if you touch the format:** `suggestedNodes` is **dead** —
`LessonModel.getCurrentSuggestedNodes()` has no callers. The verifier deliberately does *not* check
it, because which vocabulary it wants is unestablished. Whoever wires it to the node picker decides
that and adds it to the check in the same change.

**Standing constraints:**
- Editor work on `cline-dev`. 🔴 **Never `git stash`**; `cd` to the repo root in every git call;
  **explicit pathspecs** — a sibling session was live during the last one and its uncommitted
  `VisualCanvas`/`ComponentBench` cluster sat in the working tree the whole time.
- 🔴 **Check for a sibling before any suite or editor run:**
  `ps aux | grep -e electron -e run-electron-tests`. The three long-lived
  `noodl-mcp.cjs` Electron processes are Richard's MCP servers, not a test run — don't kill them.
- Gates: `npx tsc -p tsconfig.json --noEmit` (**never** without `--noEmit`), `test:main`,
  `test:ci` (read `tests/test-results.json`, **check its mtime**), `cloud-library:check`.
- A new **electron-suite** spec not exported from `tests/.../index.ts` never runs. A **`tests-unit/`**
  spec needs no barrel — jest finds it by `testMatch`.

At the end of the session, write the next `NEXT-SESSION-PROMPT.md` and update memory.

---

## Where this session left things (2026-08-14, third session)

**Built, gated and committed.** The two modules above, 48 tests. Gates run this session:

| Gate | Result |
|---|---|
| `npx tsc -p tsconfig.json --noEmit` | ✅ exit 0 |
| `npm run test:main` | ✅ **190 suites / 2928 tests, zero failures** |
| `npm run cloud-library:check` | ✅ "Committed cloud node library is up to date" |
| `npx eslint` (the three touched files) + `lint-ratchet` | ✅ 0 on mine; 877 vs a 3916 baseline |
| `npm run test:ci` | ⚠️ **13 failures, and 7 of them are a sibling's** — read on |

🔴 **`test:ci` could not be proved green, and the reason is worth reading rather than re-running.**
A **sibling session went live during this one** — the `VisualCanvas` / `ComponentBench` cluster was
clean at the start and mid-edit by the end. Results (`totalCount` 2779, seed 35665, 13 failures) vs
the 21:32 baseline (2757, seed 55147, 6 failures):

- ✅ **All 6 baseline failures reproduced by name** (4 × `AIX-006 style vocabulary`, 2 × `AI model
  registry`). Unchanged, and not mine.
- ⚠️ **All 7 new failures are `BEN-001` and `FIX-011`** — every one of them lives in
  `tests/ai/component-bench.test.ts` and `tests/canvas/bench-scenarios.test.ts`, which were
  **modified and uncommitted in the working tree** while the suite built. They are the sibling's
  in-flight bench work, not a regression from this session.
- ✅ **Zero failures in `tests/lessons/`** — the only electron-suite area this session's change could
  reach. 30 lesson specs ran, including `evalConditionsWithContext` and `findNodeWithPath`, so the
  lazy-`require` change is confirmed safe in a real renderer.

**Next session: re-run `test:ci` on a quiet checkout before trusting any number from it**, and
expect the floor to be 6.

**What the modules are, in one paragraph each.**

`lessonverify.ts` reads every `%Type` path segment and every `hasType` in a manifest and classifies
it against the catalog: *ok*, *display-name-used* (reject, **suggest**), *ambiguous-display-name*
(reject, **no suggestion** — substituting would be choosing which of two nodes the author meant, and
choosing wrong is F3), *shadowed-by-deprecated* (reject, suggest the live type),
*unknown-node-type* (reject, nearest-match suggestion), *deprecated-node-type* (warn). It **never
throws** — a malformed manifest comes back as a finding, because both producers of this format hand
it machine-written JSON. It is pure, so it runs in an MCP sidecar.

`lessongrading.ts` keeps UNI-007's two jobs structurally apart. **Engine 1** (`gradeLessonSteps`) is
synchronous, has no injection point, and *calls the existing 11-verb evaluator* — it adds no
condition logic, which is the point: a second per-step grader on MCP primitives would fork the
contract UNI-007 exists to keep single. **Engine 2** is the `WholeSolutionGrader` port.
`normaliseWholeSolutionResult()` enforces 🔴 *clean can mean EMPTY* on the way in, and the rule
reaches `buildLessonEvidence().complete` too — all steps passing plus a valid project is **not**
complete if nothing drew. The evidence bundle carries **no project content**, only positional step
outcomes: D10, not tidiness.

**Documents corrected, all in place, none left in disagreement.**

- `LESSON-FORMAT.md §3` — the nine-row table replaced by the three classes; the false sentence
  naming `Variable`/`Button`/`Text Input` as safe removed; a pointer to the shipped checker added.
- `RULINGS.md` — Blocker 1 amended (original kept, because the F1-vs-F3 reasoning is what the
  amendment rests on); marked **closed by a shipped check**.
- `PRIOR-ART-RECONCILIATION.md` F5 — amended, with the "re-derive, don't re-verify" lesson.
- `TASKS.md` — UNI-007 row now 🟡 slice 1; the surviving blocker marked closed.

**Deliberately not built, so no one reads the above as more than it is:** no MCP adapter (engine 2
has no implementation), no Learning folder or launcher UI, no intake/pathing/projection cache.
UNI-007 criteria 1 and 2 are untouched; criterion 3's whole-solution half is designed, not
delivered; criterion 4 is half-proved (a hand-authored bundle verifies and grades with no platform,
and the repo's own worked-lesson fixture passes the new check — the *install* half needs the folder).
