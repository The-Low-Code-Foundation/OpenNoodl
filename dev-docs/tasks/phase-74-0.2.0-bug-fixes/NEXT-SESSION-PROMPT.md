# Next session — FIX-027's remainder, and one CI run to read

Bug 21 is **fixed in both halves and deployed**. `Test (editor)`'s instability — the release's one
open engineering question across four sessions — is **diagnosed and fixed**, and the run that
proves it was still in flight when this was written. **Read §1 first: it is a measurement waiting
to be collected, and it is easy to destroy by accident.**

Read `FIX-025-THE-LAUNCH-LIST.md` before touching lesson code: several fixes deliberately reversed
previously-specced behaviour and the reasons are recorded there, not in the diffs.

## State you are inheriting

| repo | branch | state |
|---|---|---|
| `~/vscode_projects/OpenNoodl` | `cline-dev` | HEAD **`769e9f8e`**. ⚠️ **`769e9f8e` is UNPUSHED on purpose — see §1.** Pushed through `769427a0` |
| `~/vscode_projects/nodegx-community` | `main` | **`8d40b63`**, pushed **and deployed to nexus-1** 09:25Z |

Measured 2026-08-21 on `eda32a73`/HEAD — ⚠️ **re-measure, never quote a handover's**:

- `npm run typecheck` exit 0 · `npm run typecheck:editor` exit 0 · `typecheck:editor-tests` exit 0
- `npm run test:main` — **300 suites / 4871 tests / 0 failures** (was 4865; +6 are this session's)
- community `npx tsc --noEmit` exit 0 · `uni007-intake-and-pathing` **31/31** (was 30; +1 new)
- CI on `769427a0`: **Typecheck, Build, Node catalog, Library check, platform-node, build
  artefacts, and `Test (runtime, …)` all GREEN.** `Lint` red on **`tsfixme` only**
  — ⚠️ `colors`, `icons:css`, `tokens:css` were **skipped, not passed**: `tsfixme` fails first
  and the later steps never run. Do not report them as green.

---

## 1. 🔴 READ THIS BEFORE YOU PUSH ANYTHING

**Run `32468326220` (push, `769427a0`) was still running `Test (editor)` when this was written.**
It is the test of §2's fix, and it is the only thing that can confirm it.

```bash
gh run view 32468326220 --json status,conclusion
gh run view --job <Test (editor) job id> --log > /tmp/ed.log
grep -c '\[spec-start\]' /tmp/ed.log     # want 2849, not 2194/2264/2766
grep -E 'Jasmine: [0-9]+ specs' /tmp/ed.log   # want a SUMMARY LINE to exist at all
```

✅ **What "fixed" looks like:** 2849 markers **and** a `Jasmine: 2849 specs, 10 failures` line.
🔴 **A red tick is still the expected outcome** — the floor is 10 failures and this job has no
baseline mechanism. **Red ≠ broken. Read the marker count and the summary line, never the tick.**

🔴 **PUSHING CANCELS IT.** `pr.yml` sets `concurrency: { group: pr-${{ github.ref }},
cancel-in-progress: true }`, so any push to `cline-dev` kills the in-flight run. That is why
`769e9f8e` (a docs-only commit) is deliberately **not pushed**. Collect the result first, then
push it. If the run was already cancelled, just push — the next run tests the same thing.

---

## 2. ✅ `Test (editor)` is diagnosed — a 900s cap, not degradation, not the leak

`769427a0`. Four sessions theorised; the answer was one line below where every one of them
stopped reading the log:

```
Test run timed out after 900s without reporting results.
```

`DEFAULT_TIMEOUT_MS = 15 * 60 * 1000` in
[`packages/noodl-editor/test.js:59`](../../../packages/noodl-editor/test.js), overridable by
`NOODL_TEST_TIMEOUT_MINUTES`. **The suite needs ~15 minutes and the ceiling was 15 minutes**, so
runner variance alone decided whether a run graded anything: 1 of 4 finished. Raised to **30** in
`pr.yml`, with the measurement recorded beside it.

🔴 **Three earlier readings were wrong and all three fit the evidence** — worth internalising:

1. *"Degradation, not a wall-clock cap"* — backwards. Sound reasoning (longer wall, fewer specs),
   conclusion still didn't follow.
2. *"Both incomplete runs died in `AIX-011` — that is the death zone."* The 08-21 run died in
   **`AAQ-011`**. There is no death zone: a run dies wherever 900s falls. **Two samples agreeing
   looked like a location because two samples always do.**
3. **The listener-flood comparison was CONFOUNDED.** "The completed run carried *more* of them
   (12,688 vs 8,799)" read as exonerating the leak — but it carried more because it *ran more
   specs*. Per-spec the rates are indistinguishable (4.45 vs 4.09). The count could never have
   decided it either way. ⚠️ The leak is real and still worth fixing; it is not what stops runs.

✅ **The real cost, measured over all 2264 spec starts:** per-spec median is **0.001s and FLAT**
from first decile to last — nothing degrades. **59 specs take 17–20s each and eat 12.4 of the 14.9
minutes**, all authoring specs (`AAQ-005`, `AAQ-001`, `AAQ-011 F12`, `AIB-004`, `AIX-003`,
`AIX-010`, `AIX-011`, `BEN-001`). **Making those faster is the real work** and would shrink the
suite back under the original cap.

🔴 **`test.js` ALREADY SAID SO.** The comment above that constant records **2026-08-12** — *"a
healthy machine reached 2476 of ~2700 specs — 92% — and was cut off … the suite was simply close
to the wall"* — and warns *"a run that trips this grades NOTHING."* **Before diagnosing a harness,
read the harness's own comments.**

---

## 3. ✅ Bug 21 is CLOSED — and it exposed a third defect that is Richard's call

**Both halves fixed. Write-up in `FIX-027-THE-TUTORIAL-DOES-NOT-TEACH.md` §21.**

**Platform** (`8d40b63`, deployed): the route matched `teaches`, the button sends `slug`, and they
are equal for **0 of 15** lessons (re-measured, not taken from the handover) — so every click 404ed
and the feature had **never once run**. Now matches `slug`; `teaches` still goes to the model, so
identifiers travel over the wire and prose reaches the prompt. Verified in the **deployed bundle**
(`.slug===f`, `concept:h.teaches`), not from the green tick.

**Editor** (`855b6305`): `useLearnerPath` surfaced only `refused` and dropped `absent`,
`unauthenticated` and `unreachable` on the floor — which is why Richard saw a console 404 and
*nothing on screen*. 🔴 **That silence was the more important defect: it would have hidden the NEXT
cause just as completely.**

### 🔴 The third defect: production has NO PROJECTOR KEY

`/etc/nodegx-community/nodegx-community.env` on nexus-1 has `BREVO_API_KEY`, `DATABASE_URL`, the
GitHub OAuth pair, `NOTIFICATION_LINK_SECRET`, `SITE_ORIGIN` — **no `ANTHROPIC_API_KEY`**. So
`defaultProjector()` returns `UnconfiguredProjector` and the route answers `unavailable` at
[`projector.ts:188`](../../../../nodegx-community/src/lib/projection/projector.ts) — **before the
insert**, whose comment reads *"Never claims a row, so configuring one later still works."*

✅ **The drive is therefore free and consequence-free** — no model call, no money, no burnt
`(learner, concept)` pair. Before: 404, nothing drawn. After: 200 `unavailable` → *"Tailored
explanations are not switched on for this community yet."* **Richard can confirm both halves with
one click**, Learning tab, any step.

🔴 **But the button still cannot explain anything until a key is configured.** Costs, measured
from the real prompts on Richard's real intake (`some`/`visual`/`interactive`):

| | measured / estimated |
|---|---|
| Building the 11 steps | **0 tokens** — `pathFor` is a pure function; no model involved |
| Prompt per click | **719 characters** (measured), ~200 tokens (estimated — no tokenizer here) |
| All 11 steps, one learner | **~$0.03** at Sonnet 5 intro rates, **once ever** (the pair is a PK) |
| 1,000 learners projecting everything | **~$30** |

⚠️ **Intro pricing ends 2026-08-31** — after that the same usage is ~50% more.
⚠️ **Nothing caches and it can't**: the shared system prompt is 374 chars (~95 tokens) against a
1,024-token minimum on Sonnet 5. Not worth fixing — input is ~10% of the cost.
⚠️ **`concept_projections = 0` does NOT prove the 404** — an unconfigured call leaves zero rows
too. The **0-of-15 measurement** is what proves it.

---

## 4. 🔴 FIX-027's remainder — what is still open

**Read `FIX-027-THE-TUTORIAL-DOES-NOT-TEACH.md`.** Seven of the nine are still open.

- 🔴 **14/15/16 — *Log a thing* is unfinishable, and this is the top of the list.** Its first task
  says *"Open the **Data** panel and create a collection"*; Data lives inside **Backend Services**;
  Backend Services is `isDisabled: isLesson === true` (`router.setup.ts:339`). A disabled rail
  click is a no-op, no lesson action can open a panel, and the database refusal message *names
  Backend Services as the remedy*. ⚠️ **Do not just delete the `isDisabled` line** — the author
  reasoned case-by-case (see the `Settings` note at `:454`). **Richard's call on which of three
  options.**
- **17 — a task step never shows its instructions until clicked.** The mechanism exists and points
  the wrong way: `showPopupWhenSelected={hasConditions === false}` (`LessonLayerView.jsx:83`).
  🔴 **Do not simply invert it** — trigger on step *transition*, not render, or it reopens while
  the learner works. Dismissal already works (`manualClose: hasNextButton` is false on a task).
- **18 — "all 3 steps done" arrives with "21 problems".** `state-on-a-page` ships with **26
  validator diagnostics, 6 errors**; `log-a-thing` ships clean. The learner caused none of them.
  ⚠️ **The grade says 21 and the validator says 26 — find the filter (`wholeSolution.findings`)
  before quoting either.** Two fixes wanted: clean the shipped bundle *and gate it*, and soften the
  sentence.
- **19/20 — no "well done", and where there is one, exit is the only option.** ⚠️ A *Reset* at the
  completion moment must handle `reset()`'s refusals (see FIX-026).
- 🔴 **22 — one intake question changes nothing observable.** Measured over all 18 combinations:
  **6 distinct paths**, and `experience` produces byte-identical step lists for all three answers.
  Its only consequence was the projection prompt — i.e. bug 21. **A product decision for Richard.**

---

## 5. The three undriven FIX-025 items — recipes, not vague pointers

✅ **`COMMUNITY_URL` is a hard-coded constant** (`models/community/communityorigin.ts:16`) with
**no env override**, so every community drive from the editor hits **production**. That is what
makes bug 5 safe and bug 7 awkward; do not discover it twice.

⚠️ **All three need the editor, and a peer held it this session** (`dev:debug`, CDP 9222). Two
editors cannot coexist on this checkout — ask, don't reap.

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

## 6. FIX-026 — blocked on a decision, not on effort

`FIX-026-PUT-IT-BACK.md` is written. 🔴 **Its stated foundation was false**: `Learning/<slug>/` is
the learner's *working copy*; there is no pristine original beside it, and the only source
(`entry.source.path`) is a `/tmp` path for one of the two installed lessons. Three options and a
recommendation are in the file. **Richard decides before any code.**

---

## 7. Where to hunt next

- 🔴 **`tsfixme` is the last open red on the 0.2.0 ratchets, and it is a decision** — +37 `TSFixme`,
  +125 `any` across **45 files** ("~20" was the ratchet's display cap, `tsfixme-ratchet.js:319`).
  **68% is test files**; 32 of the 52 shipped-source additions are in **one** `.d.ts`
  (`nodegx-node-kit-types/src/index.d.ts`). ✅ Smallest useful move: type that file, raise the
  baseline for the rest **visibly, in the PR**. **Do not silently ratchet it.**
- 🔴 **The 0.2.0 draft must not be published until it is verified on CLEAN machines** — Windows is
  unsigned and has never been past SmartScreen; a dev machine masks it. See
  `dev-docs/tasks/release-0.2.0/NEXT-SESSION-PROMPT.md` §3.
- **The 59 slow authoring specs** (§2) — the real fix behind the raised timeout.
- **`submitFailure` in `useLearnerPath.ts`** is the same shape as the `projectionFailure` this
  session extracted: a decision function, neither exported nor covered. Worth the same treatment
  next time that path is touched.

---

## 🔴 Traps this session paid for — read before working

- **A push CANCELS the in-flight CI run** (`cancel-in-progress` on `pr.yml`). Collect a
  measurement before pushing on top of it. §1.
- 🔴 **`ANY PIPE REPORTS ITS LAST COMMAND.`** `npx tsc --noEmit | head -5; echo $?` printed **0**
  for a run that had errors — `$?` was `head`'s. **Redirect to a file and read `$?` bare.** Bit
  this session despite being in memory.
- 🔴 **`expect(value, message)` is VITEST-ONLY.** In the editor's jest suites it is `TS2554:
  Expected 1 arguments, but got 2` and the **whole suite fails to run** — 0 tests, which looks
  nothing like an assertion failure. Carry the label in the asserted **value** instead
  (`[['absent', true], …]` compared with `toEqual`).
- 🔴 **A spec can RATIFY the bug it covers.** `uni007`'s known-good arm sent the route's own
  spelling, so it passed just as happily against a route matching the **wrong field**. And
  changing it carelessly would have left the "not on your path" arm returning 404 **for the wrong
  reason** — silently testing nothing. ✅ **When you change what a key is, convert every arm, and
  make the arm assert its own precondition rather than trust it.**
- ✅ **GRADE EVERY NEW SPEC BY MUTATION.** Reverting the route made `your-creature-on-screen` 404 —
  Richard's bug reproduced as a test. A spec that cannot go red proves nothing.
- 🔴 **A structural spec can be RIGHT when your placement is wrong.** `projectionFailure` went into
  `learnerpathview.ts` first (beside the tested `projectionNote`), and UNI-001 AC4 — *"the module
  that decides what is DRAWN never sees a session"*, a substring check over stripped source —
  caught the word "session" in the `unauthenticated` sentence. ✅ **The answer was the boundary,
  not a reword.** Never reword to dodge a gate.
- ⚠️ **A python heredoc writing `\U0001f534` into a file** leaves the literal escape, not 🔴.
  Normalise afterwards and `grep -c` to prove it.
- ⚠️ **A doc-comment replacement that drops the closing `*/`** silently swallows the next
  declaration — `TS2305: has no exported member`, pointing at the importer, not the cause.
- 🔴 **`concept_projections = 0` fits two different worlds** (never reached the projector / reached
  it and found no key). A row count that fits both cannot distinguish them. §3.
- ✅ **Before declaring a measurement blocked, ask who has already taken it.** CI had run `test:ci`
  to completion while two sessions deferred it for machine-memory reasons.
