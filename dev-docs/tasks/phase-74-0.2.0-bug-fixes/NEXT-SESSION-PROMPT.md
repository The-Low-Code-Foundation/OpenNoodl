# Next session — FIX-027's remainder, and the two decisions blocking it

`Test (editor)` is **fixed and the fix is confirmed** — the measurement the last session was
holding a commit to collect has been taken. Bug 18's two software halves are fixed. **What is left
in FIX-027 is mostly not code: four of the six open items are decisions only Richard can make**,
and the two that are code both need the editor, which a peer held all of the last session.

Read `FIX-025-THE-LAUNCH-LIST.md` before touching lesson code: several fixes deliberately reversed
previously-specced behaviour and the reasons are recorded there, not in the diffs.

## State you are inheriting

| repo | branch | state |
|---|---|---|
| `~/vscode_projects/OpenNoodl` | `cline-dev` | Code at **`bdc8d5cd`**, docs on top. All pushed — nothing held back this time |
| `~/vscode_projects/nodegx-community` | `main` | **`8d40b63`**, pushed and deployed to nexus-1 |

Measured 2026-08-21 on `bdc8d5cd` — ⚠️ **re-measure, never quote a handover's**:

- `typecheck`, `typecheck:editor`, `typecheck:editor-tests`, `typecheck:mcp` — all exit 0
- `test:main` — **300 suites / 4884 tests / 0 failures** (floor was 4871; +13 are this session's)
- `noodl-mcp` `npx jest` — **55 suites / 651 tests / 0 failures**
- ⚠️ **CI has NOT yet graded this branch — read it before claiming it is clean.** The runs on
  `bdc8d5cd` were **cancelled by the very next push** (`cancel-in-progress`, §1) — this document's
  own trap, hit while writing it. The live runs are on **`a3a9be95`**: `32471348298` (push) and
  `32471353141` (pull_request), same code. `Test (editor)` on them is **unread**.

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

⚠️ **The real remaining work is the 59 slow specs**, not the timeout. Per-spec median is 0.001s and
flat; **59 authoring specs take 17–20s each and eat 12.4 of the 14.9 minutes** (`AAQ-005`,
`AAQ-001`, `AAQ-011 F12`, `AIB-004`, `AIX-003`, `AIX-010`, `AIX-011`, `BEN-001`). Making those
faster would put the suite back under the original cap.

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

### Worth building, blocked on nothing

- 🔴 **No gate validates a shipped lesson bundle.** The only thing referencing `project-examples/`
  under `scripts/` or `.github/` is the comment-legibility scanner. A checker over the corpus that
  exists is what would have caught bug 18 before a learner did — **the fourth time this shape has
  come up.** `log-a-thing` passes at 0 diagnostics today, so the gate can land green.
  `scripts/library/check.ts` is the pattern (`SemanticValidator` + `loadProject`). ⚠️ That file is
  **uncommitted in the working tree** — read it, don't edit it.

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
  (`nodegx-node-kit-types/src/index.d.ts`). ✅ Smallest useful move: type that file, raise the
  baseline for the rest **visibly, in the PR**. **Do not silently ratchet it.**
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

## 🔴 Traps this session paid for — read before working

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
