# Phase 66 — next session

**Written 2026-08-18, session 61's brief, by session 60.** A rewrite, per §0. s60 took **the whole
of bundle 2**, which was the last engineering in the phase.

## 🔴 Phase 66 has NO OPEN BUILD LEFT. What remains is rulings, and one drive.

Both steps of bundle 2 landed:

- **`dcdad2b2`** — the `typecheck:mcp` gate `noodl-mcp` never had, and the eight errors under it.
- **`d1a3f6ec`** — FIX-021's MCP half. Claude Code now reads the user profile.

🔴 **s60's headline finding is not in either brief: `env` reached a trust boundary that had never
checked it.** `rejectUntrustedRegistration` validates `command` and `args` against what main
independently resolves — its own comment calls it *"a trust boundary and not a formality"* — and
passed `env` straight through. That was harmless for as long as NodeGX emitted exactly one variable
and the renderer had no way to add another. **Putting a renderer-round-tripped path in there would
have ended that:** the approved registration is written into the user's real `~/.claude.json` and
later spawned by their agent, so a key that survives the check is a key in somebody's process.
`NODE_OPTIONS=--require …` is the shape of the thing.

✅ **Fixed in two places rather than one**, and both matter: the boundary now **whitelists env keys**,
and the connect handler **overwrites** the profile path with the one main resolved — so what the
renderer sends is convenience and never authority. `rejectUntrustedRegistration` **had no tests at
all**; it has four now, mutation-verified.

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
| **FIX-021 slice B** — the global user profile | ✅ s58 | ✅ s59 | 4/4 observations, all verbatim |
| **FIX-021 — the MCP half** | ✅ 🆕 **s60** | ⛔ | 🔴 **The phase's one remaining DRIVE.** §4 |
| **FIX-021 slice A** | ⛔ | — | 🔴 **DELIBERATELY NOT BUILT** — see §5. A decision, not an omission |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

🔴 **EIGHTEEN tasks closed outright** — the seventeen in row 1, plus FIX-008.
⚠️ **Count the names, never copy a total.** The arithmetic that has to balance is
**18 closed + FIX-015 (left the phase) + 5 still open = 24**.

---

## 2. Gate readings

✅ **s60 re-measured every one of these on its own tree.** ⚠️ **Re-measure anyway before quoting.**
🔴 **Quote a TREE, not a commit.**

| Gate | Reading | When |
|---|---|---|
| 🆕 **`typecheck:mcp`** (NEW GATE) | ✅ **exit 0** — was 8 errors, in no gate at all | ✅ **s60** |
| `typecheck:editor` / `-tests` | ✅ exit 0 | ✅ **s60** |
| `noodl-mcp` jest, FULL | ✅ **54 suites / 641 tests** (was 53/633; the 8 new are FIX-021's) | ✅ **s60** |
| `noodl-editor` `test:main` (jest) | ✅ **242 suites / 3723 tests, 0 failed** | ✅ **s60** |
| resident tool-surface budget | ✅ **8,223 / 57 under the 8,280 bar** — unchanged | ✅ **s60** |
| `lint:ci` ratchet | ✅ **877** / 3916 baseline — unchanged | ✅ **s60** |
| `test:ci` (jasmine) | ✅ **2849 / 6 @ seed 39393** — the floor, both known families | s58 — inherited |
| `tests-unit/fix-021/` | ✅ 4 suites / 32 tests | s58 — inherited |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 — inherited |
| `nodegx-backend` / `viewer-react` / `cloud-runtime` | ✅ | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |
| electron-builder package | ✅ exit 0, ~6 min, `NodeGX-0.1.7-mac-arm64.dmg` | s59 — inherited |

⚠️ **`test:main`'s baseline moved under us**: s58 recorded 239/3658, s60 measured 242/3723 having
added only 7 editor tests. **Peers landed suites in between.** That is normal here and is the reason
this table says *re-measure*, not *compare to the last number*.

⚠️ **s60's suites ran with a peer's uncommitted phase-67/69 work in the tree** (backend, module-inject,
community, viewer-cloud). The commits contain only s60's pathspecs, but the *green* was taken on a
mixed tree. **Neither reading is invalidated; both are less isolated than they look.**

### 🔴 Readings that will mislead you

- 🔴 **`test:ci`'s exit code lies BOTH ways**; a clean floor run exits **1**, and `… | tail` reports
  the pipe's last command ⇒ **0** regardless. **Delete `tests/test-results.json` first and prove
  completion from its mtime.**
- 🔴 **`noodl-mcp`'s 8 typecheck errors are GONE and the gate is wired into `pr.yml`.** Do not
  re-derive the old finding — `typecheck:mcp` is a required-check line now.
- 🔴 **A tool added to an existing DEFERRED MCP group costs ZERO surface budget** — measured twice.
  🆕 **And so does a FIELD added to a tool's RESULT** — the budget measures the advertised surface
  plus `instructions`, and nothing else. That is what made FIX-021's MCP half affordable at all.
- 🔴 **`provision.test.ts` and `projectOwnsBackend.test.ts` flake** on real ports.
- 🔴 **A jest run of `tests/` is NOT what a client runs** — in-process vs `dist/noodl-mcp.cjs` over stdio.

---

## 3. What s60 did

### Step 1 — the gate `noodl-mcp` never had (`dcdad2b2`)

`packages/noodl-mcp` is not in the root program's `include` list, and unlike `nodegx-core` or the
editor's specs it had **no gate of its own either**: the package carried a `typecheck` script that
no CI job ever called. Eight errors had accumulated there unobserved.

🔴 **The scope question answered itself.** The handover asked whether the gate should cover `tests/`.
The package's tsconfig **already includes both**, and its AAQ-011 comment exists precisely because
somebody meant the specs to be checked. Scoping to `src/` alone would have been green on day one by
leaving **seven of the eight errors outside it**, which is how a ratchet gets ignored.

✅ **The gate was verified able to FAIL, on both halves separately** — a deliberate type error in
`src/` reddens it, one in `tests/` reddens it, and with both removed it exits 0. A gate proven only
on the green side is not evidence about either half.

The eight, and what they turned out to be:

- **`disclosure.ts` — one real defect.** `find_tools`' zod enum is derived from the manifest
  (deliberately, so it cannot go stale) but was **cast to the full `ToolGroupId`**, while the handler
  was typed `Exclude<ToolGroupId,'core'>`. The schema advertised an argument the handler said it
  would never receive. Fixed on the **schema** side — the handler's statement is the true one.
  ✅ **Measured before changing the filter: old and new predicates return the same six ids.**
- **`connectionPresentation.test.ts`** imported `ConnectionV2` from `../src/types`, which **does not
  exist**. Being an `import type`, jest **erased it and the suite passed green over a module that was
  never there.** The sibling `operationsWritePath.test.ts` already imports it from `../src/editor-deps`.
- **Six `res.data ?? res.text`** — `call()` returns `{isError, data}` and **never a `text` field**, so
  the fallback was unreachable in every case and always had been. The intent is already served:
  when the payload does not parse, `call()` puts the raw text at `data.raw`.

### Step 2 — FIX-021's MCP half (`d1a3f6ec`)

**Full write-up at the foot of FIX-021's own file.** The chain: main resolves
`<userData>/PREFERENCES.md` → reports it through the front door → the renderer emits it in **both**
the pasted `claude mcp add` line and the `.mcp.json` it writes → the server reads
`NODEGX_USER_PREFERENCES` → `get_project_info` carries it → `create_project` propagates it.

🔴 **The `env` trust-boundary finding is at the top of this file.** It is the part that was not in
the brief and the part a reviewer should look at first.

Two rows worth having here:

- 🔴 **The profile rides in a tool RESULT, not `instructions` — and that was arithmetic, not taste.**
  The resident surface has **57 tokens** of headroom against 8,280; the cap on this file is **2,000
  characters**. `instructions` was impossible and a new resident tool would not have fitted either.
- ✅ **The 55-character prediction held a second time.** The MCP-side spec predicts, before running,
  that one line under the first heading renders **55 characters** — the same number s59 measured
  independently in the editor's panel. Two clients, one renderer, one figure.

---

## 4. What to do next and why

### 🔴 The one piece of engineering-adjacent work left: DRIVE the MCP half

**Nothing in FIX-021's MCP half has been seen in a running editor.** The specs grade the chain at
both ends and a mutation grades the security check, but no session has clicked Connect and read a
real `~/.claude.json`.

**Write the observations BEFORE launching.** The ones worth pre-registering:

1. Open settings → Connect. Read `~/.claude.json` and expect the `nodegx` entry's `env` to carry
   **`NODEGX_USER_PREFERENCES`** pointing at the real `<userData>/PREFERENCES.md`.
2. 🔴 **The known-firing control:** `ELECTRON_RUN_AS_NODE` must **still be there beside it**. A
   registration that replaced the env record instead of extending it looks like a pass to any probe
   that only checks the new key, and leaves a server that boots a GUI app.
3. Create or open a project and read its `.mcp.json` — same variable, same value.
4. With something written in the profile, ask a Claude Code session on that project to call
   `get_project_info` and confirm `userPreferences` arrives **with its note**.
5. ⚠️ **The absence row, which needs the presence row above it to mean anything:** restore the
   template (all comments) and confirm the field is **gone**, not empty.

🔴 **Memory's standing warning applies: `Connect` writes Richard's REAL `~/.claude.json`.** Back it
up first, and put it back.

### What is NOT a bundle, and why

- 🔴 **The four "no open build" tasks (FIX-004, 006, 016, 022) cannot be bundled into anything,
  because none is waiting on work.** Each waits on a sentence from Richard — see §5.
- ⚠️ **FIX-016 AC1 is the one that could become a build**, and it is already **driven and found
  false** at s50. **Do not re-measure it.** Retire-or-build, and only Richard can say which.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🆕 🔴 **`claudeMcpAdd` does not quote its `-e` pairs.** Pre-existing, and it matters more now that
  one carries a path: on a machine whose user data sits under a directory with a space, the
  **displayed** command needs the user to quote it. The written registration is JSON and unaffected.
  **Wants its own task.**
- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list behind
  `parser.getPorts()`. **Wants a task; needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.
- ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does. Belongs with Q5.

### How to start here

🔴 **Before believing a "0", find the known-firing signal that sits beside it.** Every absence
assertion s60 wrote has a presence row built the same way, in the same file, in the same run.

🔴 **A gate is not evidence until it has been made to fail.** s60's new typecheck gate was proven on
`src/` and on `tests/` **separately**, and the security spec was proven by a mutant that turns
exactly two rows red and leaves the control green.

🔴 **Count the pattern before mutating, and require exactly 1.** A "did not apply" row is a silent
skip, not a free pass.

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.**
🆕 ⚠️ **zsh does not word-split unquoted variables** — `set -- $var` silently yields one word.

🔴 **Write the expected observation BEFORE driving, and expect to be wrong in a way that teaches.**

---

## 5. Rulings — what a builder must not get wrong

- 🆕 ✅ **FIX-021's MCP half — BUILT s60 on judgements Richard has not ruled:**
  - **The profile is in `get_project_info`'s RESULT**, not `instructions`. **Forced by the budget**,
    not chosen — 57 tokens of headroom against a 2,000-character file.
  - ⚠️ **NOT gated on `allowWrites`**, unlike the two doctrine blocks beside it. The argument: those
    are authoring instructions, and this file's first heading is *"how I like to be talked to"*.
    **Defensible either way — worth Richard's eye, not blocking.**
  - ✅ **`env` is now a whitelist at the trust boundary, and main overwrites the profile path.**
    🔴 **Do not "simplify" either back.** Both exist because the registration is spawned by the
    user's agent out of their real `~/.claude.json`.
  - 🔴 **`NODEGX_USER_PREFERENCES` is a wire contract** between `mcpFrontDoor.js`,
    `mcpCommands.ts`, `project/agentConfig.ts` and `src/userProfile.ts`. Renaming one end turns the
    feature off silently for every registration already on disk.
- 🆕 ✅ **`typecheck:mcp` covers `src/` AND `tests/`, and is a required check in `pr.yml`.**
  🔴 **Do not narrow it to `src/`** — seven of the eight errors it caught were in `tests/`.
- 🆕 🔴 **`deferredGroups()` now returns `DeferredGroupId` and filters `core` by id as well as by
  `resident`.** The id test is redundant today (measured) and is there so the type is enforced by
  code rather than asserted by a comment.
- ✅ **THE REPACKAGE — Richard ruled at s59: BUILT, LEFT IN `dist/`, NOT INSTALLED.** Do not install
  it without asking again. ⚠️ **So `nodegx-puppy-test-3` still resolves to the Aug-13 bundle**, and
  FIX-008 D's `open_project` is absent from what a registered agent actually runs. **A deployment
  choice, not a debt — but do not read s59's table as "shipped".**
- 🔴 **The build route is `_viewer` → `build:sidecars` → `npx lerna exec --scope noodl-editor --
  npm run build`.** ⚠️ **Never `npm run build:editor` or `build:editor:_editor` on this checkout** —
  both delete the root `node_modules`. **`build:editor:pack` copies; it does not build.**
- ✅ **FIX-021 slice B — BUILT s58, DRIVEN s59, on three ASSUMPTIONS Richard has not ruled:**
  - **Q5 → `always`, capped at 2,000 chars, free when empty.** **Rejected:** `pull`.
  - **Q6 → prose only, for now.** **Rejected in this slice:** `ai.role.*`-style keys.
  - 🔴 **Q2 → ONE file, and NO second project-level document. Slice A is deliberately NOT built.**
- ✅ **Things slice B must keep doing** — all four have a *driven* row behind them: guidance stays in
  **HTML comments**; an empty section stays **dropped**; the block stays **last** and ahead of
  `cacheBoundary`; the **precedence sentence stays in the block**; `globalPreferences()` keeps
  charging **nothing** for an empty profile; `ensureUserProfileSeeded` writes **only when there is
  no file**.
- ✅ **FIX-013 — CLOSED s57.** 🔴 **`useSampleData` is not the switch.** 🔴 **`emptyState` PREDATES
  the fix — 11 occurrences in the Aug-13 app.** 🔴 **`emptyState` must keep shipping the class list
  NAMED.** 🔴 **`synthesizeMissing` defaults `true`, bench sends `false`.** 🔴 **`list()` caches the
  empty array.** 🔴 **The bench summary must keep WRAPPING.** 🔴 **`ComponentBench` imports neither
  `SandboxToolbar` nor `SandboxDataEditor`.**
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
  ⚠️ **AC1 as originally written is still FALSE as built.** **Retired or still owed? s50–s60 did not
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

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** ⚠️ **s54–s60 all needed none of it, and neither
  does the MCP-half drive.**
- 🆕 ⚠️ **FIX-021's MCP half — confirm the `allowWrites` judgement** (§5). Not blocking.
- 🔴 **FIX-021 Q2, Q5 and Q6 — confirm or overturn the three assumptions in §5.** Q2 is the one that
  changed what got built.
- 🔴 **FIX-013 rulings 3 and 4 — confirm or overturn.** Not blocking; overturning is a deletion
  someone has to authorise.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?**
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-016 AC1 — RETIRE IT, or build a type control at creation time?**
  ⚠️ **Already driven and found false at s50.** **The only owed ruling that would create a new build.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work. Still uncommitted at s60 — twenty-eight sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-eight
  sessions have declined.**
- ⚠️ **`package-lock.json`'s `@nodegx/kit-scaffold` line — phase 69 should confirm it.** Written by
  `npm install` during s59's build; a genuine cn-006 desync, **not verified with `npm ci`** on purpose.
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ⚠️ **`fix016-s50-drive` is a scratch copy, deletable.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*; write every path absolute and the question does not arise. 🔴 **s60
was bitten by exactly this twice** — a `cd` into a package directory survived into later calls.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command.

🔴 **This checkout is SHARED and the peer commits mid-session.** ✅ **s60 saw a peer land eleven
modified files and eight new ones mid-session** (phase-67/69: backend, module-inject, community,
viewer-cloud). **Commit by explicit pathspec and verify afterwards.** ⚠️ **`hot: true`**: an edit to
`packages/noodl-editor/src` hot-reloads a live editor mid-drive — and so does an edit to
`packages/noodl-viewer-react/src`. ✅ **Take each measurement in ONE uninterrupted chain of `cdp`
calls.**

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
`sweep()`.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**. ✅ **Put findings into EXISTING pointer files**,
which costs zero index budget.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s60 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared sixteen sessions running. ✅ **s60 also ran `git diff --stat HEAD` on this file
immediately before writing**, which is the cheapest proof that the context copy is current.

A whole-file overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is
invisible in the diff you are looking at.
