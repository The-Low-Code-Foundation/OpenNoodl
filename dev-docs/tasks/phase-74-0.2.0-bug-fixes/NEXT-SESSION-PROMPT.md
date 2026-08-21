# Next session — FIX-027's remainder, and the decisions blocking it

`Test (editor)` is **fixed and the fix is confirmed**. Bug 18's two software halves are fixed, and
**the lesson-bundle gate that was the last unblocked build is now in** (`2ba69638`, §3). **What is
left in FIX-027 is not code you can start unasked: four of the remaining items are decisions only
Richard can make**, and the two that are code both need the editor, which a peer has now held for
two sessions running.

Read `FIX-025-THE-LAUNCH-LIST.md` before touching lesson code: several fixes deliberately reversed
previously-specced behaviour and the reasons are recorded there, not in the diffs.

## State you are inheriting

| repo | branch | state |
|---|---|---|
| `~/vscode_projects/OpenNoodl` | `cline-dev` | ✅ **PUSHED at `8553b5e7`** — the gate and the docs are on `origin/cline-dev`. ✅ **`Lesson bundles (FIX-027)` has now run on CI and PASSED**, first time ever (run `32473637517`) |
| `~/vscode_projects/nodegx-community` | `main` | **`8d40b63`**, pushed and deployed to nexus-1 |

Measured 2026-08-21 on `bdc8d5cd` — ⚠️ **re-measure, never quote a handover's**:

- `typecheck`, `typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` — all exit 0
- `test:main` — **300 suites / 4884 tests / 0 failures** (floor was 4871; +13 are this session's)
- `noodl-mcp` `npx jest` — **55 suites / 651 tests / 0 failures**
- ✅ **CI HAS NOW GRADED THIS BRANCH — read §6 before re-measuring any of it.** 🔴 The two runs
  this document named (`32471348298`, `32471353141`) were themselves **cancelled** — the trap fired
  a second time on the very commits that recorded it. The runs that actually graded the code were
  **`32471411436`** (push) and **`32471418529`** (PR), on `f9924e3f`. Result: **7 jobs green, 2 red,
  and both reds are the known ones** — `Test (editor)` (no baseline mechanism) and `Lint`
  (`tsfixme`). §1 and §6 carry the measurements.

---

## 1. ✅ `Test (editor)` is FIXED — measured, not inferred

**Run `32468326220`, job `96729628801`, tree `769427a0`.** Taken from the raw job log:

```
[spec-start] markers      : 2849      ← the whole suite (was 2194 / 2264 / 2766)
Jasmine: 2849 specs, 10 failures (failed).
"timed out after"         : 0 occurrences
```

**All ten failures match the recorded floor by name**: 4× `AIX-006 style vocabulary`, 3× `SUB-011
expression parameters`, 2× `AI model registry`, 1× `AIX-011`. The 900s-cap diagnosis was right and
raising `NOODL_TEST_TIMEOUT_MINUTES` to 30 in `pr.yml` fixed it.

🔴 **A red tick is still the expected outcome** — the job has no baseline mechanism, so ten known
failures read as failure. **Read the marker count and the summary line, never the tick.**

🔴 **`pr.yml` sets `cancel-in-progress: true`.** Pushing kills an in-flight run — one was cancelled
this session that way, harmlessly, after its measurement was already collected. **Check before you
push if a run matters to you.**

⚠️ **The real remaining work is the slow specs**, not the timeout — 🔴 **and the count was
measured on a TRUNCATED run. It is 82, not 59.** Re-derived from the *complete* 2849-spec log
(run `32471411436`), which the earlier 2264-spec sample could not see the tail of. Full table in
§6.

---

## 2. ✅ Bug 18 — the count and the sentence are fixed (`bdc8d5cd`)

**Write-up in `FIX-027-THE-TUTORIAL-DOES-NOT-TEACH.md` §18.** The flagged 21-vs-26 discrepancy is
resolved, and **neither obvious reading was right**.

**`21` was never a count.** `capFindingLines` keeps `MAX_FINDING_LINES = 20` and **appends one more
line announcing the overflow** — and that line is an element of the array. So `findings.length` is
`min(N, 20) + 1`: it prints 21 for 26 problems, and 21 for a thousand. Proven by running the real
function from source.

⚠️ **The `info` filter was a red herring.** Re-running `SemanticValidator`: `state-on-a-page` has
**26 diagnostics, 26 of them non-`info`** (20 warnings, 6 errors). The filter drops zero.
`log-a-thing` is **0**, in-repo and as installed.

🔴 **The same saturated number reached the platform** as the evidence bundle's `findingCount` — a
data defect, not a display one.

**Fixed:** `WholeSolutionResult` gains `findingTotal`, counted before the cap in both adapters;
`findingTotalOf()` owns the read. The learner-facing sentence, when every checked step is done, is
now an observation beside the lesson's verdict rather than one sentence reading as failure — **the
findings are still counted and still listed.** Graded by six mutations, each red, each restoring
byte-identical.

---

## 3. 🔴 FIX-027's remainder — and what each item actually needs

**Read `FIX-027-THE-TUTORIAL-DOES-NOT-TEACH.md`.** Six of the nine are still open. **Only two of
them are code you can write without asking Richard first.**

### Needs a decision from Richard — do not start these

- 🔴 **14/15/16 — *Log a thing* is unfinishable, and it is still the top of the list.** Its first
  task says *"Open the **Data** panel"*; Data lives inside **Backend Services**; Backend Services
  is `isDisabled: isLesson === true` (`router.setup.ts:339`). A disabled rail click is a no-op and
  the database refusal message *names Backend Services as the remedy*. ⚠️ **Do not just delete the
  `isDisabled` line** — the author reasoned case-by-case (see the `Settings` note at `:454`).
  Three options are in the file.
- 🔴 **18's other half — where does `state-on-a-page` ship from?** The 26 diagnostics are real and
  a learner cannot fix them, but **the lesson is in neither checkout**: `project-examples/lessons/`
  holds only `log-a-thing`, the community repo mentions the slug only in a test, and its
  `entry.source.path` is a dead `/tmp` path. ⚠️ **The copy under `~/Library/Application
  Support/NodeGX/Learning/state-on-a-page` is Richard's working copy, not a source to clean.**
  **This question has to be answered before anything in that lesson can be fixed.**
- 🔴 **22 — one intake question changes nothing observable.** Over all 18 combinations: **6 distinct
  paths**, and `experience` produces byte-identical step lists for all three answers. Its only
  consequence was the projection prompt — i.e. bug 21. **A product decision.**

### Code, but both need the editor

⚠️ **A peer held the editor for the whole of the last session** (`dev:debug`, CDP 9222). Two
editors cannot coexist on this checkout — **ask, don't reap.**

- **17 — a task step never shows its instructions until clicked.** The mechanism exists and points
  the wrong way: `showPopupWhenSelected={hasConditions === false}` (`LessonLayerView.jsx:83`).
  🔴 **Do not simply invert it** — `refresh()` re-renders on every `Model.*` event, so an
  unconditional flip reopens the popup while the learner works. Trigger on step *transition*, and
  make a dismissal stick for that step. Dismissal itself already works (`manualClose:
  hasNextButton` is false on a task). ⚠️ **jest can grade the decision but not the drawing** — this
  is a case where the consequence has to be seen.
- **19/20 — no "well done", and where there is one, exit is the only option.** ⚠️ A *Reset* offered
  at the completion moment must handle `reset()`'s two refusals, or it fails in front of the
  learner at the worst possible moment. See FIX-026.

### ✅ DONE THIS SESSION — the lesson-bundle gate exists (`2ba69638`)

**`npm run lessons:check`** — `scripts/check-lesson-bundles.ts`, its own `Lesson bundles
(FIX-027)` job in `pr.yml`. Every bundle under `project-examples/lessons/<slug>/`: `lesson.json`
parses and verifies against the node catalog, and **both** projects — the starter at the bundle
root and `solution/` — load and validate clean. `log-a-thing` measures **0 findings, 0
diagnostics** (`starter 3c/12n`, `solution 3c/16n`), and the gate prints that cardinality every
run.

✅ **Graded by mutation, in CI too: `npm run lessons:check:self-test`.** Seven breaks derived from
the real bundle, each required to be caught **in the arm it names** — not merely to exit non-zero,
because a harness that threw would do that as well. Meta-mutated to prove the reason-check can
fail. The shipped corpus is never written to.

🔴 **It does not cover `state-on-a-page`** — that bundle is still in neither checkout, which is
bug 18's other half above. The gate covers the corpus that exists.

🔴 **`knownCollections` is deliberately NOT supplied — do not "tidy" that.** Omitted and
supplied-empty are different answers; `[]` would fire `unreachable-collection` against every
correct data lesson, `log-a-thing` first. Deriving the real list is **TUT-002 AC3**, still open.
This script is the caller to wire it into when AC3 lands.

⚠️ **Not pushed.** Two CI runs were in flight on `f9924e3f` and `pr.yml` sets
`cancel-in-progress`. The new job has therefore **never run on CI** — its two commands were run
locally, exit 0 both. Push when a cancelled run does not matter.

---

## 4. The three undriven FIX-025 items — recipes, not vague pointers

✅ **`COMMUNITY_URL` is a hard-coded constant** (`models/community/communityorigin.ts:16`) with
**no env override**, so every community drive from the editor hits **production**. That is what
makes bug 5 safe and bug 7 awkward; do not discover it twice.

### Bug 12 — the wrong-typed wire (easiest, start here)

`WarningsModel` entry keyed `con-type-unconverted`, raised in `NodeGraphModel.getConnectionHealth`
(`:840`) — the ⚠ badge / warnings panel, **not** a connection error.

1. Open `tut001-drive`. Its `PuppyCard` holds a Visual Function whose `myInput` is declared
   **`number`** — already Richard's exact shape.
2. Wire the `String` output into `myInput`.
3. **Must be true:** a **warning** (never an error), *"This connects a **string** to a **number**
   port, and …"*.
4. 🔴 **Run the control:** a *number* source into the same port ⇒ **no** warning.

### Bug 5 — the signed-out intake questions (drivable, safely)

1. `cp ~/Library/Application\ Support/NodeGX/nodegx.community.session.json` to the scratchpad.
2. Delete it, launch, look at Learning **signed out**.
3. **Must be true:** the three questions do **not** look answerable — no live radios, no enabled
   *Build my path* offering to save what cannot be saved.
4. Restore and `diff` it back. ⚠️ Confirm the signed-**in** rendering afterwards as the control.

### Bug 7 — the mirror reply (hardest; scope it first)

Needs a **really answered** thread, and the hard-coded origin means you cannot point the editor at
a local platform without editing `communityorigin.ts`. Pick one **before** writing code: patch the
constant behind a dev-only override (worth having for every future community drive), or ask
Richard to answer one of his own threads. **Do not fake a reply row in the production database.**

---

## 5. Still open elsewhere

- 🔴 **Production has no `ANTHROPIC_API_KEY`**, so *"Explain this for me"* answers `unavailable`
  and draws *"Tailored explanations are not switched on for this community yet."* ✅ **The drive is
  free and consequence-free** — no model call, no burnt `(learner, concept)` pair — so Richard can
  confirm both halves of bug 21 with one click, Learning tab, any step. **But the button cannot
  explain anything until a key is configured.** ~$0.03 per learner for all 11 steps, once ever;
  ~$30 for 1,000 learners. ⚠️ **Intro pricing ends 2026-08-31.**
- 🔴 **`tsfixme` is the last open red on the 0.2.0 ratchets, and it is a decision** — +37 `TSFixme`,
  +125 `any` across **45 files** ("~20" was the ratchet's display cap, `tsfixme-ratchet.js:319`).
  **68% is test files**; 32 of the 52 shipped-source additions are in **one** `.d.ts`
  (`nodegx-node-kit-types/src/index.d.ts`). 🔴 **THE "SMALLEST USEFUL MOVE" IS NOT AVAILABLE
  — MEASURED THIS SESSION, see §6.** Typing that file would break one of its own two rules.
  What is left is: raise the baseline **visibly, in the PR**. **Do not silently ratchet it.**
  ⚠️ `Lint` fails on `tsfixme` first, so `colors`, `icons:css` and `tokens:css` are **skipped, not
  passed**. Do not report them as green.
- 🔴 **The 0.2.0 draft must not be published until it is verified on CLEAN machines** — Windows is
  unsigned and has never been past SmartScreen; a dev machine masks it. See
  `dev-docs/tasks/release-0.2.0/NEXT-SESSION-PROMPT.md` §3.
- **FIX-026 is blocked on a decision, not effort.** 🔴 Its stated foundation was false:
  `Learning/<slug>/` is the learner's *working copy* and there is no pristine original beside it.
  Three options and a recommendation are in `FIX-026-PUT-IT-BACK.md`.
- **`submitFailure` in `useLearnerPath.ts`** is the same shape as the `projectionFailure` that was
  extracted earlier: a decision function, neither exported nor covered. Worth the same treatment
  next time that path is touched.

---

## 6. What CI actually said, and why one recommendation is withdrawn

**Measured 2026-08-21 from run `32471411436` (code `f9924e3f`) and `32473637517` (code
`8553b5e7`).** Both read from raw job logs, never from the tick.

### 6a. ✅ `Test (editor)` is at the floor — now on a THIRD seed

```
[spec-start] markers : 2849      ← the whole suite
Jasmine: 2849 specs, 10 failures (failed).
Randomized with seed 72336.
"timed out after"    : 0 occurrences
```

✅ **All ten match the floor NAME FOR NAME** — 4× `AIX-006 style vocabulary`, 3× `SUB-011
expression parameters`, 2× `AI model registry`, 1× `AIX-011`. The seed is **72336**, a third
unrelated one (after `02601` and `39393`): these ten are **deterministic and order-independent**
across three seeds and two operating systems. The 30-minute cap is holding.

### 6b. ✅ `Lint`: only `tsfixme` — and the skip-trap is confirmed, not assumed

`lint:ci` reports **879 errors against a 3916 baseline — 3037 fewer**, exit 0. `tsfixme` is the
sole failure at **+37 `TSFixme` / +125 `any`**. ⚠️ **`colors`, `tokens:css` and `icons:css` never
ran** — the job stops at `tsfixme`. Confirmed by reading the step list, not inferred. **Do not
report them as green.**

### 6c. 🔴 THE `.d.ts` CANNOT BE TYPED — the "smallest useful move" is withdrawn

The uncapped ratchet (a scratchpad copy with `slice(0, 20)` removed; the repo was not touched)
confirms **45 files** and **`nodegx-node-kit-types/src/index.d.ts` at `+32`, the largest single
block** — the handover's arithmetic was exact. **Its recommendation was not.**

That file is a **hand-written mirror** of `noodl-viewer-react/src/react-component-node.ts` and
`@noodl/types`, and it states **two rules it must keep**: (1) **self-contained** — no `import`, no
`/// <reference>`, because it is copied into a kit folder with no `node_modules`; (2) **it must not
lie** — "a type that overstates the runtime is worse than no type, because it is believed."

🔴 **Typing the `any`s breaks one rule or the other.** Every one is load-bearing:

| site | why it cannot change |
|---|---|
| `innerReactComponentRef: any` · `withInnerComponent(action: (inner: any) => void…` · `getValue?: ReactNodeCallback<any[], unknown>` · `methods?: Record<string, ReactNodeCallback<any[], any>>` · `[extra: string]: any` | **byte-identical to the runtime** (`react-component-node.ts:191, 289, 410, 506, 84/261/329`). Tightening makes the mirror **stricter than the thing it mirrors** — rule 2, in the direction that puts a spurious red squiggle in an author's editor |
| `setup?: (context: any, graphModel: any) => void` | runtime says `(context: ReactNodeContext, graphModel: GraphModelLike)`. The published file **declares neither type** (grepped: zero hits). Naming them means importing — **rule 1** — or publishing two more mirrored types plus their drift entries |
| `const React: any` · `Window.React: any` | React's own types are exactly what rule 1 forbids. The file **already explains this in place** and says it is **"Pinned by a test"** |

🔴 **AND NOTHING WOULD CATCH A MISTAKE.** `tests/drift.test.js` looks like the guard here and is
not: `typeSets.js:51` records `members[symbol.name] = isOptional` — **a boolean**. It compares
member **names** and **optionality**, and is **completely blind to member types**. A retyped `any`
that diverges from the runtime would pass every drift test in the package.

⚠️ **The file is not even in the baseline** (`byFile` entry: absent) — it was *created* after the
baseline was taken, so its 32 markers are "new" only in the sense that the file is. They were
there from its first commit (`f251695c`, CN-005).

✅ **So the decision is narrower than the handover framed it.** With the `.d.ts` off the table,
shipped source holds **20 scattered singletons across 16 files** — no cluster, one marker each.
The realistic options are now: **raise the baseline visibly in the PR**, or retype 110 markers in
other phases' test files plus 20 singletons. **Still Richard's call — but "type the one file
first" is not one of the choices.**

### 6d. ✅ The slow specs, from the COMPLETE run — 82, and seven suites are 79% of it

Per-spec **median 0.0005s, p90 0.120s** — flat, no degradation. **82 specs take ≥5s and eat 85% of
the wall.**

| suite | wall | % | specs | ≥5s | mean |
|---|---|---|---|---|---|
| `AIX-011` | 239.8s | 19% | 60 | 16 | 4.00s |
| `BEN-001` | 208.3s | 16% | 23 | 16 | 9.06s |
| `AAQ-011` | 190.0s | 15% | 35 | 10 | 5.43s |
| `AAQ-005` | 144.1s | 11% | 9 | 9 | **16.01s** |
| `AIX-008` | 94.3s | 7% | 29 | 8 | 3.25s |
| `AIX-003` | 78.8s | 6% | 18 | 8 | 4.38s |
| `AIB-004` | 62.4s | 5% | 4 | 4 | **15.61s** |
| **total** | **1266.8s** | 100% | **2848** | **82** | |

**Seven suites — 178 of 2849 specs — are 79% of the wall.** If every ≥5s spec were instant the
suite would run in **3.2 minutes**. ⚠️ `AIX-010` appears in the handover's list but **not** in the
measured top — it was in the truncated sample's tail. **`AIX-008` is there instead**, and nobody
had named it.

### 6e. 🟡 The listener flood is LOCATED and is a real leak — but still NOT shown to cause the slowness

**Source found:** [`packages/noodl-editor/src/shared/model.js:17`](../../../packages/noodl-editor/src/shared/model.js).
`Model.prototype.on` warns when `this.listeners.length > 10000` — **`>`, not `===`**, so once a
model crosses the line **every subsequent `on()` prints**. The 12,636 lines are that, not 12,636
separate leaks.

🔴 **The cost is real and structural, not cosmetic.** `notifyListeners` (`:57-62`) walks the
**whole** listener array and calls `shouldNotify` on each, for **every** event. Past 10,000
listeners each event is an O(10,000) scan — and `set()` notifies on every field write.

✅ **It IS a test-isolation leak.** The warning first fires at spec **#1219** and is still firing at
spec **#2848, the last one** — so a model holding >10,000 listeners survives to the end of the run
and is never torn down between specs. Firing is *episodic* (gaps up to 178 specs), i.e. only specs
that touch that model pay.

🔴 **BUT CAUSATION IS STILL NOT ESTABLISHED, AND THE OBVIOUS READING IS AGAIN A CONFOUND.**
Mean spec time is 2.6× higher after the flood starts (0.232s → 0.604s) — and that is **not**
evidence:

- The **median is FLAT across the boundary** (0.0006s → 0.0005s). A global O(n) tax would move it.
- The flood begins **inside `BEN-001`**, one of the slow suites — so "after the flood" and "in the
  authoring suites" are **the same population**. This is the same confound that made the earlier
  `12,688 vs 8,799` comparison meaningless, wearing different clothes.
- The within-suite trend test **contradicts itself**: second half vs first half is 384× slower for
  `AIX-011` and 224× for `BEN-006`, but **0.21× for `AAQ-011`, 0.07× for `AIX-002`, 0.00× for
  `BEN-002`**. Monotonic accumulation cannot produce both directions.

⚠️ **What would actually settle it:** run one slow suite (`AAQ-005`, 9 specs, 16s each) **alone**,
where the flood never starts, and compare per-spec time against this run. That is a local
measurement and was blocked this session — the machine was at **15.8G of 16.4G swap** with a peer's
editor live. **Do not "fix" the leak and claim the suite got faster without that control.**

---

---

## 🔴 Traps this session paid for — read before working

- 🔴 **A CONTENT GATE'S SEVERITY THRESHOLD IS WHERE ITS HOLE GOES.** `unknownNodeType` is
  `severity: warning` unless `--strict` — so `library:check`, which fails only on errors, reported
  **58/58 clean while nine shipped prefabs had no type at all**, and that is recorded in its own
  header. Writing `lessons:check` the same way would have reproduced bug 18's blind spot exactly.
  ✅ **Before choosing a threshold, mutate the artefact with the defect you are gating for and read
  what severity it comes back as.** Mine came back `warning`. **The fourth instance of a gate with
  a hole shaped like its defect.**
- 🔴 **"EXITED NON-ZERO" IS NOT "CAUGHT".** A mutation harness that throws — a path that moved, a
  fixture field that is absent — exits non-zero and reads as a successful catch against an
  exit-code assertion. ✅ **Assert the ARM: require the report to contain the specific diagnostic
  the mutation was aimed at**, then meta-mutate one expectation to a string that cannot match and
  confirm it reports `WRONG REASON`. Grading the grader took four minutes here.
- ✅ **DERIVE MUTATIONS FROM THE ARTEFACT THAT SHIPS, NOT A HAND-WRITTEN FIXTURE.** The self-test
  copies `log-a-thing` and breaks the copy. A synthetic bundle can be missing a field the code
  under test reads, and then the spec fails — or passes — for a reason unrelated to the property
  being graded. Copying also means the corpus is never written to; `git status` on
  `project-examples/` is the check that it stayed that way.
- 🔴 **AN EMPTY CORPUS MUST REFUSE, NOT PASS.** A content gate that finds nothing and exits 0 is
  indistinguishable from one that checked everything and approved it — and this corpus has already
  moved directory once. `lessons:check` exits **2** on an empty `project-examples/lessons/`, and
  the self-test covers that case separately because its correct answer is 2 rather than 1.
- ⚠️ **`scripts/*.ts` is in NO typecheck gate** — root `tsconfig.json` includes only `packages/…`,
  and `pr.yml` has no `scripts` typecheck. It is covered here only because ts-node type-checks as
  it runs, so the CI step that *runs* the gate is also the only thing that typechecks it. Worth
  knowing before assuming a script compiles because `npm run typecheck` is green.

- 🔴 **A CAPPED LIST'S `.length` IS NOT A COUNT.** `capFindingLines` appends an overflow line that
  is itself in the array, so the length saturates at 21 forever. The capping module's own
  doc-comment said *"the cap is on the lines, never the verdict"* — and a consumer three files away
  counted the lines anyway. ✅ **A caveat written where a value is PRODUCED does not travel to
  where it is READ**; put it in the type. **And check who else reads the field** — this one reached
  stored evidence, not just the screen.
- 🔴 **A READING THAT FITS IS NOT ONE THAT EXCLUDES.** *"21 = 26 diagnostics minus 5 infos"* fitted
  the evidence perfectly and was wrong. **The severity histogram — one cheap script — excluded it**
  (26 of 26 are non-`info`). Ask what measurement would come out differently if the hypothesis were
  false, then take that one.
- ✅ **GRADE EVERY NEW SPEC BY MUTATION, and check the restore.** Six mutations, each red, each
  restoring byte-identical (`md5` compared). A spec that cannot go red proves nothing.
- ⚠️ **A spec asserting a softened sentence needs the control that keeps it honest.** The pair here
  is *all steps done* vs *one step outstanding* on identical findings — without the second, the
  spec would pass over a sentence that had simply stopped saying anything.
- 🔴 **`expect(value, message)` is VITEST-ONLY.** In the editor's jest suites the whole suite fails
  to run — 0 tests, which looks nothing like an assertion failure. Carry the label in the asserted
  **value** instead.
- ⚠️ **A hand-written fixture can be missing a field the code under test reads.** A fake diagnostic
  without `location.component` made the adapter report *"could not be validated"* — a spec failing
  for a reason that has nothing to do with the property being graded. **Copy the shape an existing
  spec uses.**
- ⚠️ **`gh run view --job <id> --json completedAt` is not a field.** Use `startedAt`/`status`, or
  read the log's own timestamps.
- 🔴 **The `Learning/<slug>/` folders are Richard's live working copies**, mtime today. They are a
  measurement *subject*, never a source to clean or restore from.
- ✅ **A peer session may already be taking the measurement you need** — two background watchers on
  the same CI job appeared in the shared tasks directory. Corroboration is welcome; **take it
  yourself before quoting it**, which is what turned a relayed "2849" into a measured one.
