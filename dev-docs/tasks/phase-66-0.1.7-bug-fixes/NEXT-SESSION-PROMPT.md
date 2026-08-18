# Phase 66 — next session

**Written 2026-08-18, session 60's brief, by session 59.** A rewrite, per §0. s59 took **the whole
of bundle 1**: FIX-021 slice B is **driven**, and the eight-session-old repackage is **built and
verified** — `NodeGX-0.1.7-mac-arm64.dmg`, with all three missing features measured *in* it.

## 🔴 What is left: ONE bundle of engineering, and the same pile of rulings

**Bundle 1 is done.** Bundle 2 — everything inside `noodl-mcp` — is untouched and is now the only
engineering in the phase. Four tasks still wait on a sentence from Richard, not on work.

🔴 **s59's headline finding: the repackage recipe this file carried for eight sessions was wrong,
and following it literally would have been destructive.** s58 wrote *"`npm run build:sidecars` then
`npm run build:editor:pack`"*. Measured:

- **`build:editor:pack` builds nothing.** `scripts/build-pack.ts` is a **copy step** — it copies
  existing `.dmg`/`.exe` out of `packages/noodl-editor/dist` into `publish/`. Run after
  `build:sidecars` on a stale tree it would have copied the **0.1.6 dmg from Aug 12** and reported
  success.
- 🔴 **`npm run build:editor` — the command that *does* build — runs `npx lerna clean --yes`,
  which deletes `node_modules` from every package**, and the root is **1.1 GB**. On this shared
  checkout that is **45 live MCP servers across ~22 peer sessions** losing the Electron binary they
  run from. It also refuses to start unless `git diff --numstat` is empty, and the tree carries
  three long-standing modified files that are **not ours to commit or revert**.
- 🔴 **`build:editor:_editor` deletes it too** — `scripts/noodl-editor/build-editor.ts:62` runs
  `execSync('npx rimraf ./node_modules')` **with no `cwd`**, so it inherits the npm script's cwd:
  the repo root. So *both* obvious routes are destructive.

✅ **The route that works is the one CI uses**, and it is in `release.yml`: `build:editor:_viewer` →
`build:sidecars` → `npx lerna exec --scope noodl-editor -- npm run build`. **No clean, no git check,
no `node_modules` deletion — verified after the fact: root `node_modules` still 1.1 GB, all 45 MCP
servers alive.** It took **six minutes**, not the "unmeasured, possibly a project" this file feared.

🔴 **And the phase's real remaining risk is no longer the build — it is that the build is NOT
INSTALLED, by Richard's decision.** See §4.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree.** ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 013 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — seventeen tasks |
| **FIX-008** A, B, C, D, E | ✅ | ✅ | **CLOSED** (s56) |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s42/s44 | Closed halves |
| **FIX-021 slice B** — the global user profile | ✅ s58 | ✅ 🆕 **s59** | **4/4 observations, all verbatim.** Full write-up at the foot of FIX-021's file |
| **FIX-021 — the MCP half** | ⛔ | — | 🔴 **THE PHASE'S ONLY OPEN BUILD.** Bundle 2, step 2 |
| **FIX-021 slice A** | ⛔ | — | 🔴 **DELIBERATELY NOT BUILT** — see §5. A decision, not an omission |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

🔴 **EIGHTEEN tasks closed outright** — the seventeen in row 1, plus FIX-008.
⚠️ **Count the names, never copy a total** (s58 inherited "nineteen" and it was wrong). The
arithmetic that has to balance is **18 closed + FIX-015 (left the phase) + 5 still open = 24**.

---

## 2. Gate readings

⚠️ **s59 took NO suite readings, and owed none** — it changed no source. Its work was a drive, a
package build, and one lockfile line that `npm install` wrote by itself. **Everything below is
inherited; re-measure before quoting any of it.** 🔴 **Quote a TREE, not a commit.**

| Gate | Reading | When |
|---|---|---|
| `test:ci` (jasmine) | ✅ **2849 / 6 @ seed 39393** — the floor, both known families | s58 — inherited |
| `noodl-editor` `test:main` (jest) | ✅ **239 suites / 3658 tests, 0 failed** | s58 — inherited |
| `tests-unit/fix-021/` | ✅ **4 suites / 32 tests** | s58 — inherited |
| `typecheck:editor` / `-tests` / root `typecheck` | ✅ exit 0 | s58 — inherited |
| `lint:ci` ratchet | ✅ **877** / 3916 baseline | s58 — inherited |
| `noodl-mcp` jest, FULL | ✅ 53 suites / 633 tests | s56 — inherited |
| resident tool-surface budget | ✅ 8,223 / 57 under the 8,280 bar | s56 — inherited |
| `tsc -p tsconfig.json` (noodl-mcp) | ⚠️ **8 errors — pre-existing** | s58 — re-measured |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 — inherited |
| `nodegx-backend` / `viewer-react` / `cloud-runtime` | ✅ | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |
| 🆕 **electron-builder package** | ✅ **exit 0, ~6 min, `NodeGX-0.1.7-mac-arm64.dmg`** | ✅ **s59** |

### 🔴 Readings that will mislead you

- 🔴 **`test:ci`'s exit code lies BOTH ways**; a clean floor run exits **1**, and `… | tail` reports
  the pipe's last command ⇒ **0** regardless. **Delete `tests/test-results.json` first and prove
  completion from its mtime.**
- 🔴 **`noodl-mcp` has NO root typecheck gate** — nine `typecheck:*` scripts plus a plain
  `typecheck`, and **`typecheck:mcp` is not among them**. Bundle 2, step 1.
- 🔴 **A tool added to an existing DEFERRED MCP group costs ZERO surface budget** — measured twice.
- 🔴 **`provision.test.ts` and `projectOwnsBackend.test.ts` flake** on real ports.
- 🔴 **A jest run of `tests/` is NOT what a client runs** — in-process vs `dist/noodl-mcp.cjs` over stdio.

---

## 3. What s59 did

### FIX-021 slice B — DRIVEN, 4/4

Dev stack, a scratch copy opened via the recents store. All four observations were written down
**before** launching. Three passed verbatim; **one was corrected before measuring, from source** —
and that correction is the transferable part:

🔴 **`CollapsableSection` renders `isClosed`, and `Collapsible` keeps its children MOUNTED** (it
unmounts only when `disableTransition && isCollapsed`, which `CollapsableSection` never passes).
Measured: `collapsibleHeight: 0`, `bodyMounted: true`, `bodyTextLen: 471`. **So a `textContent` read
finds the whole caption on a section no user can see, and — `overflow:hidden` clipping hit-testing —
cannot click.** ✅ **The reading that proves reachability is the HEIGHT, not the text.**

The two rows worth having:

- **R3, the empty-file rule end to end:** clicking seeds a **1,193-byte** file, byte-identical to
  `PROFILE_TEMPLATE` (checked against the source literal), and the panel charges **nothing** — the
  branch prints no number at all.
- **R4, which grades the stripping and not merely the wiring:** the count was **predicted before the
  write** — one line under the first heading renders `## How I like to be talked to\nPlain English,
  no jargon.` = **55 characters**. The panel read **55**, with the file at 1,220 bytes on disk.
  ✅ **A count that merely went non-zero could not tell "stripping works" from "stripping is skipped
  and all 1,220 bytes went out".**
- ✅ **Unplanned bonus: the poll is bidirectional** — restoring the template returned the caption to
  *"nothing is being sent"*, so it is a real content-comparing re-read, not a one-shot latch.

### The repackage — BUILT and VERIFIED, not installed

`packages/noodl-editor/dist/`: **`NodeGX-0.1.7-mac-arm64.dmg`** (187 MB) and the unpacked
`dist/mac-arm64/NodeGX.app`, built 2026-08-18 10:34.

🔴 **The three probes were baselined against the Aug-13 app FIRST, and each has a known-firing
control beside it** — without which "0" cannot be told from "the probe is broken":

| task | probe | Aug-13 app | new build |
|---|---|---|---|
| **FIX-008 D** | `open_project` in `Resources/noodl-mcp/noodl-mcp.cjs` | 0 | **11** |
| **FIX-013** | `ComponentBench-module__Summary` in `app.asar` | 0 | **6** |
| **FIX-021 B** | `About you` / `PREFERENCES.md` / `Create and open preferences` | 0 / 0 / 0 | **3 / 10 / 2** |
| *control* | seven sibling `ComponentBench-module__*` classes that predate FIX-013 | 6 each | **6 each** |

🔴 **Two probes were designed, measured, and THROWN AWAY before this table — record them so nobody
re-invents them:**
- **`useSampleData`** — 45 occurrences in the Aug-13 app. Memory already says it *is not the switch*.
- **`emptyState`** — **11 occurrences in the Aug-13 app**, i.e. it predates FIX-013 entirely.
- 🔴 **And a `SandboxToolbar` absence check would have been WORSE than useless: FIX-013 ruling 2 says
  the two surfaces DIVERGE and the AI preview KEEPS its toolbar**, so the string is present in a
  correctly-fixed bundle. An absence check there would have reported failure on working code.

### One lockfile line, written by `npm install`, not by hand

`package-lock.json` gained **`"@nodegx/kit-scaffold": "*"`** under `noodl-editor`'s dependencies.
**This is a pre-existing desync, not s59's change:** `@nodegx/kit-scaffold` was declared a dependency
of `noodl-editor` by **phase 69's cn-006** (`9e76bae4`), and the lockfile registration under that
package never landed. ⚠️ **It was NOT verified with `npm ci`** — `npm ci` wipes and reinstalls
`node_modules`, which is the destructive act this session spent its effort avoiding on a shared
checkout. **Phase 69 should confirm it.**

---

## 4. What to do next and why

### 🔴 Not a task, but the top of the file: THE BUILD IS NOT INSTALLED

✅ **Richard was asked directly at s59 and chose to leave it in `dist/`.** So this is **settled, not
outstanding** — do not "fix" it by installing.

**Why the choice is not obvious, in case it is revisited:**
- The installed `/Applications/NodeGX.app` is **Developer-ID signed**, `TeamIdentifier=Y35J975HXR`.
- The new local build is **`Signature=adhoc`, linker-signed, TeamIdentifier not set** — `DISABLE_SIGNING=true`.
- 🔴 **~22 peer sessions' registered MCP servers resolve to `/Applications/NodeGX.app/…`**, so
  replacing it changes what every one of them runs on next spawn.

⚠️ **So `nodegx-puppy-test-3` still resolves to the Aug-13 bundle**, and FIX-008 D's `open_project`
is still absent from what a registered agent actually runs. **That is now a deployment choice rather
than a debt** — but it has the same user-visible consequence, so do not read the table in §3 as
"shipped".

### 🔴 Bundle 2 — "everything inside noodl-mcp" (the gate first, then the code under it)

**One session: same package, same gates.** `noodl-mcp`'s jest suite (53 suites / 633), its
surface-budget line and its esbuild build each run once instead of twice. 🔴 **The order is causal —
step 1 is the gate that would catch step 2's mistakes.**

**Step 1 — add a root `typecheck:mcp` and deal with the 8 errors.** Re-measured at s58: still
exactly 8, still absent from the root.

- **1 is real:** `disclosure.ts:381`, `Exclude<ToolGroupId,'core'>` vs a zod `ZodEnum` — the
  handler's parameter type excludes `'core'` and the schema does not.
- **7 are in three test files:** `connectionPresentation.test.ts` (a dead `../src/types` import) and
  six `Property 'text' does not exist on type 'ToolCallResult<…>'` in `interfaceGate.test.ts` /
  `stagingDiagnostics.test.ts`.

⚠️ **Decide out loud whether the new gate covers `tests/`.** Seven of the eight errors are there, so
a gate scoped to `src/` is green on day one and one scoped to both is red — and shipping a red gate
is how a ratchet gets ignored. Either is defensible; silently picking the green one is not.

**Step 2 — build FIX-021's MCP half, under the gate you just added.** Slice B specified it and s58
deliberately did not build it: the profile path goes into `.mcp.json` `env` at registration (the
BST-004 *"front door, never guess"* pattern), and **it breaks the server's
every-path-inside-`projectDir` invariant, so it needs its own read-only containment note.** That
argument is why it is a task and not a paragraph. **Today the editor's AI reads the profile and
Claude Code does not.**

### What is NOT a bundle, and why

- 🔴 **The four "no open build" tasks (FIX-004, 006, 016, 022) cannot be bundled into anything,
  because none is waiting on work.** Each waits on a sentence from Richard — see §5.
- ⚠️ **FIX-016 AC1 is the one that could become a build**, and it is already **driven and found
  false** at s50: clicking `+` beside `SCRIPT OUTPUTS` opens *a name field and nothing else*.
  **Do not re-measure it.** Retire-or-build, and only Richard can say which.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list behind
  `parser.getPorts()`. **Wants a task; needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.
- ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does, which is what
  slice B specified. Arguably the wrong line: *"prefer built-in nodes"* is a decision a **planner**
  makes. One extra parameter on `planningUserMessage`, but a planning turn has **no `cacheBoundary`**
  and is not cached, so it is a real per-plan cost. Belongs with Q5.

### How to start here

🔴 **Before believing a "0", find the known-firing signal that sits beside it.** s59's package
verification only means something because seven sibling CSS classes read **6** in the same file at
the same moment. Three candidate probes were discarded for failing exactly this test — one of them
(`SandboxToolbar`) would have reported **failure on correct code**.

🔴 **A differential assertion needs an absolute one beside it** (s58). Ask of every A/B spec: *is
there a mutant that moves A and B together?* The tell is a spec whose every assertion is
`toBe(other)` with no literal anywhere in it.

🔴 **Read the source before trusting a handover's UI claim.** *"The section is present"* was true and
useless; `isClosed` + a still-mounted body meant the obvious instrument would have passed on an
unreachable section.

🔴 **Guard a mutant by COUNTING THE PATTERN BEFORE mutating, and require exactly 1.** A "did not
apply" row is not a free skip — re-run it.

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.**

🔴 **Write the expected observation BEFORE driving, and expect to be wrong in a way that teaches.**

---

## 5. Rulings — what a builder must not get wrong

- 🆕 ✅ **THE REPACKAGE — Richard ruled at s59: BUILT, LEFT IN `dist/`, NOT INSTALLED.** Do not
  install it without asking again. The signing and MCP-resolution consequences are in §4.
- 🔴 **The build route is `_viewer` → `build:sidecars` → `npx lerna exec --scope noodl-editor --
  npm run build`.** ⚠️ **Never `npm run build:editor` or `build:editor:_editor` on this checkout** —
  both delete the root `node_modules`. **`build:editor:pack` copies; it does not build.**
- ✅ **FIX-021 slice B — BUILT s58, DRIVEN s59, on three ASSUMPTIONS Richard has not ruled:**
  - **Q5 → `always`, capped at 2,000 chars, free when empty.** **Rejected:** `pull`.
  - **Q6 → prose only, for now.** **Rejected in this slice:** `ai.role.*`-style keys.
  - 🔴 **Q2 → ONE file, and NO second project-level document. Slice A is deliberately NOT built.**
- 🆕 🔴 **Things slice B must keep doing** — all four now have a *driven* row behind them: guidance
  stays in **HTML comments**; an empty section stays **dropped**; the block stays **last** and ahead
  of `cacheBoundary`; the **precedence sentence stays in the block**; `globalPreferences()` keeps
  charging **nothing** for an empty profile; `ensureUserProfileSeeded` keeps writing **only when
  there is no file**.
- ✅ **FIX-013 — CLOSED s57.** 🔴 **`useSampleData` is not the switch.** 🔴 **`emptyState` PREDATES
  the fix — 11 occurrences in the Aug-13 app.** 🔴 **`emptyState` must keep shipping the class list
  NAMED.** 🔴 **`synthesizeMissing` defaults `true`, bench sends `false`.** 🔴 **`list()` caches the
  empty array.** 🔴 **The bench summary must keep WRAPPING** — a measured property, and the reason
  `.Summary` exists at all. 🔴 **`ComponentBench` imports neither `SandboxToolbar` nor
  `SandboxDataEditor`.**
- ✅ **FIX-013 ruling 2 → the two surfaces DIVERGE.** 🔴 **The AI preview keeps its toolbar and data
  editor** — which is why a `SandboxToolbar` absence check is invalid. BEN-004 §7 knowingly retired
  for the bench.
- ✅ **FIX-013 rulings 3 + 4 → the non-destructive branch.** ⚠️ **Richard's answers still owed.**
- ✅ **FIX-008 D — BUILT + DRIVEN s56.** 🔴 **`completeBind` stays the single successful-bind path.**
  🔴 **`ProjectBinding`'s bind-once boundary holds.** 🔴 **`list_projects`' note branches on
  `isBound`.** 🔴 **The same-directory case keeps its own answer.**
- ✅ **FIX-022 — the reuse cell BUILT + MEASURED s53.** 🔴 **`minPlacementSites` OFF for `trivial`,
  `small-logic`, `multi-section`.** 🔴 **BOTH evidence paths.** 🔴 **A REGRESSION detector.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE** (s42).
- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **`NODES_BEFORE_CODE` keeps BOTH
  halves**, a separate export from `THREE_WAYS_TO_COMPUTE`.
- ✅ **FIX-006 AC4.** 🔴 **`Javascript2` must keep leading the Script paragraph** (`traps.ts:61-63`).
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` stays LAST in all four parameter lists**;
  do not tidy the four spellings into one constant; `createBlockConsole` returns `console` ITSELF
  when there is no sink.
- ✅ **FIX-016 — mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` stays `true` for `'script'`.**
  ⚠️ **AC1 as originally written is still FALSE as built.** **Retired or still owed? s50–s59 did not
  decide.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.**
- ✅ **FIX-008 C — 🔴 Observe stays `user` on purpose.** 🔴 **`--scope project` resolves against the
  shell's cwd**; the `scopeNote` names the folder.
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly.
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN s44.**
- ✅ **FIX-024 — CLOSED s51.** 🔴 **`'learn'` and `'learning'` are two different pages.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** ⚠️ **s54–s59 all needed none of it, and neither
  does bundle 2.**
- ✅ 🆕 **The repackage is ANSWERED — built, not installed.** No longer on this list as work.
- 🔴 **FIX-021 Q2, Q5 and Q6 — confirm or overturn the three assumptions in §5.** Q2 is the one that
  changed what got built.
- 🔴 **FIX-013 rulings 3 and 4 — confirm or overturn.** Not blocking; overturning is a deletion
  someone has to authorise.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?**
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-016 AC1 — RETIRE IT, or build a type control at creation time?**
  ⚠️ **Already driven and found false at s50.** **The only owed ruling that would create a new build.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work. Still uncommitted at s59 — twenty-seven sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-seven
  sessions have declined.**
- 🆕 ⚠️ **`package-lock.json`'s `@nodegx/kit-scaffold` line — phase 69 should confirm it.** Written by
  `npm install` during s59's build; a genuine cn-006 desync, **not verified with `npm ci`** on purpose.
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*; write every path absolute and the question does not arise.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command.

🔴 **This checkout is SHARED and the peer commits mid-session.** ✅ **s59 announced its launch to the
live peer, got an explicit all-clear, and announced the teardown to the same address** — and the
peer landed two new uncommitted doc files (`phase-67/NEXT-SESSION-PROMPT.md`,
`phase-69/RULINGS-OPEN-QUEUE.md`) mid-session. **Commit by explicit pathspec and verify afterwards.**
⚠️ **`hot: true`**: an edit to `packages/noodl-editor/src` hot-reloads a live editor mid-drive — and
so does an edit to `packages/noodl-viewer-react/src`. ✅ **Take each measurement in ONE uninterrupted
chain of `cdp` calls.**

### Driving the settings panel — the exact route, since s59 had to find it

1. Write an entry into `~/Library/Application Support/NodeGX/recently_opened_project.json`
   (**back it up; remove the entry AFTER `dev:stop`**), `npm run cdp -- reload`, then click
   `[data-test=launcher-project-card]`.
2. `npm run cdp -- click "[data-test=settings-panel]"` — the rail's gear, `placement: 'bottom'`.
3. The **Editor** tab is a `[class*=Tabs-module__Button--]` whose `innerText` is `Editor`; tag it
   with an `id` and click that.
4. 🔴 **Every section is `isClosed` and its body is MOUNTED at height 0.** Scroll it into view,
   click its `[class*=Header]`, **re-measure**, and only then read or click inside it.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure. ✅ **s59
confirmed the shield: 26 processes stopped, all 45 MCP servers survived.**

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s58 measured 17,504 — SIX characters of headroom.** ✅ **Put findings into EXISTING pointer
files**, which costs zero index budget. **The index cannot take a new line.**

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s59 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared fifteen sessions running. ✅ **s59 also ran `git diff --stat HEAD` on this file
immediately before writing**, which is the cheapest proof that the context copy is current.

A whole-file overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is
invisible in the diff you are looking at.
