# Phase 66 — next session

**Written 2026-08-18, session 63's brief, by session 62.** A rewrite, per §0.

## 🔴 THE PHASE IS THREE OBSERVATIONS FROM DONE. ALL OF THEM NEED ONE THING: AN EDITOR THAT RENDERS.

s62 drove **the MCP server half of FIX-021, 4/4**, against the real bundle over real stdio.
What is left is the **editor** half of the same drive:

> 🔴 **Click `Connect Claude Code` in a running editor and read `~/.claude.json`.**
> Observations **1, 2 and 3** below. **No API credit. No new code.** The build has been ready
> since s60 and is now half-measured.

⚠️ **s62 did not fail to drive it — s62 never got a renderer.** Two full launches, ~1h40m, and the
editor's webpack never served its bundle. **That is the thing to plan around, and §4 tells you how.**

### 🔴 The one-line reason the editor never rendered, because it will happen to you

`start.ts` calls **`reapPreviousSession()`**, and the stack runs **`hot: true`**. So on this shared
checkout: **a peer's `npm run dev` kills your stack**, and **any peer edit under
`packages/noodl-editor/src` restarts a compile that took 16–40 minutes** at the load this machine
was carrying (**average 23–53**, 53 resident MCP servers, a VM at ~50% CPU).
🔴 **And once the renderer's bundle request lands mid-compile, `webpack-dev-middleware` holds it
forever — `reload` does NOT recover it. Only a full relaunch does.**

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, **overwritten** each session. Four things:

1. **Built vs. driven**, per task — *built* is code plus gates; *driven* is the app doing it.
2. **Gate readings with their date and tree.** ⚠️ **Mark which ones this session actually took.**
3. **What is settled**, so nobody re-litigates it.
4. **What to do next**, ordered.

Learnings that outlive the phase go to **memory**, not here. ⚠️ **If you find yourself prepending an
amendment, rewrite the file instead.**

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 013 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — seventeen tasks |
| **FIX-008** A, B, C, D, E | ✅ | ✅ | **CLOSED** (s56) |
| **FIX-004** | ✅ | ✅ | **CLOSED.** §C ruled s42, built s46; s61 confirmed |
| **FIX-006** | ✅ | ✅ | **CLOSED s61** |
| **FIX-013** | ✅ | ✅ | **CLOSED s61** |
| **FIX-016** | ✅ | ✅ | **CLOSED s61** — AC1 **RETIRED** |
| **FIX-022** | ✅ | ✅ | **CLOSED s61** — §7 ruled **(a) accept** |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s42/s44 | Closed halves |
| **FIX-021 slice B** — global user profile | ✅ s58 | ✅ s59 | Q2/Q5/Q6 confirmed s61 |
| **FIX-021 — MCP half, the SERVER end** | ✅ s60 | 🆕 ✅ **s62, 4/4** | `get_project_info` over real stdio. §3 |
| **FIX-021 — MCP half, the EDITOR end** | ✅ s60 | ⛔ | 🔴 **THE PHASE'S ONE REMAINING ITEM.** §4 |
| **FIX-021 slice A** | ⛔ | — | ✅ **RULED OUT at s61 (Q2), not deferred** |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

🔴 **TWENTY-THREE tasks closed.** ⚠️ **Count the names, never copy a total.** The arithmetic:
**23 closed + FIX-015 (left the phase) = 24**, with **FIX-021 alone still open**, on three observations.

---

## 2. Gate readings

⚠️ **s62 took NO suite readings and owed none.** It changed **no tracked file** — its only build
artefact was `packages/noodl-mcp/dist/`, which is **gitignored and untracked**.
**Everything below is s60's or older; re-measure before quoting.** 🔴 **Quote a TREE, not a commit.**

| Gate | Reading | When |
|---|---|---|
| **`typecheck:mcp`** | ✅ exit 0 | s60 |
| `typecheck:editor` / `-tests` | ✅ exit 0 | s60 |
| `noodl-mcp` jest, FULL | ✅ 54 suites / 641 tests | s60 |
| `noodl-editor` `test:main` (jest) | ✅ 242 suites / 3723 tests | s60 |
| resident tool-surface budget | ✅ 8,223 / 57 under the 8,280 bar | s60 |
| `lint:ci` ratchet | ✅ 877 / 3916 baseline | s60 |
| `test:ci` (jasmine) | ✅ 2849 / 6 @ seed 39393 | s58 |
| `tests-unit/fix-021/` | ✅ 4 suites / 32 tests | s58 |
| `noodl-runtime` jest | ✅ 137 suites / 2515 | s54 |
| `library:check` | ✅ 58/58 | s30 |
| electron-builder package | ✅ exit 0, `NodeGX-0.1.7-mac-arm64.dmg` | s59 |

⚠️ **`test:main`'s baseline moves under you** — peers land suites mid-session. Re-measure.

### 🔴 Readings that will mislead you

- 🔴 **`test:ci`'s exit code lies BOTH ways**; a clean floor run exits **1**, and `… | tail` reports
  the pipe's last command ⇒ **0** regardless. **Delete `tests/test-results.json` and prove
  completion from its mtime.**
- 🔴 **A tool added to a DEFERRED MCP group costs ZERO surface budget**, and so does a **field added
  to a tool's RESULT**. That is what made FIX-021's MCP half fit against 57 tokens of headroom.
- 🔴 **`provision.test.ts` / `projectOwnsBackend.test.ts` flake** on real ports.
- 🔴 **A jest run of `tests/` is NOT what a client runs.** ✅ **s62 built the client-shaped
  instrument** — see §3; reuse it rather than rebuilding it.

---

## 3. What s62 measured — the server half, 4/4

**Instrument:** `node packages/noodl-mcp/dist/noodl-mcp.cjs <dir> [--allow-writes]`, real stdio,
real JSON-RPC, `tools/call get_project_info`. Full detail in the task file's s62 section.

| # | `NODEGX_USER_PREFERENCES` | profile file | writes | `userPreferences` |
|---|---|---|---|---|
| 1 | **unset** | — | yes | ⛔ absent |
| 2 | set | **pristine seeded template** | yes | ⛔ absent |
| 3 | set | **two headings answered** | yes | ✅ **present** |
| 4 | set | two headings answered | **read-only** | ✅ **present** |

- ✅ **Row 3 licenses rows 1 and 2** — same run, same instrument. Two *different* absences were
  taken deliberately: "older registration" and "user never wrote anything".
- ✅ **The `note` travels with the text**, in full, including the CONVENTIONS.md precedence sentence.
- 🆕 ✅ **Only ANSWERED headings arrive** — the comment-only ones are dropped, not sent empty.
- 🆕 ✅ **Row 4 confirms Richard's `allowWrites` ruling by drive:** 13 tools, no `authoringTraps` /
  `authoringDoctrine` / `designDoctrine`, **and `userPreferences` still present.**

### 🔴 Step zero was real and is now DONE — but check it anyway

`dist/noodl-mcp.cjs` was s59's build with **0** occurrences of `NODEGX_USER_PREFERENCES`. s62
rebuilt it (**13:17:37, count 1**). It persists on disk, so it should still be current — **but it is
gitignored, so nothing guarantees it.** ✅ **Re-check in one command before driving:**

```
grep -c NODEGX_USER_PREFERENCES /Users/richardosborne/vscode_projects/OpenNoodl/packages/noodl-mcp/dist/noodl-mcp.cjs   # expect ≥1
npm --prefix packages/noodl-mcp run build   # only if it reads 0
```

### 🔴 One carried item shrank

**`claudeMcpAdd`'s unquoted `-e` pairs cannot break the write.** `connectBootstrapServer` uses
`spawnSync(exec, cliArgs(registration))` — an **argv array, no shell**. Richard's own profile path
contains a space and is the worst case; it is safe on both routes. **The defect is confined to the
DISPLAYED copy-pasteable string.** Still its own task, now a cosmetic one.

---

## 4. What to do next — the editor half, and nothing else

### 🔴 FIRST, AND IT DECIDES WHETHER TO EVEN TRY: MEASURE THE MACHINE

```
uptime                                          # load average
ps -Ao command | grep -c '[n]oodl-mcp.cjs'      # resident MCP servers
find packages/noodl-editor/src packages/noodl-core-ui/src -type f -not -path '*/node_modules/*' \
  -newermt '30 minutes ago' | wc -l             # are peers editing editor source RIGHT NOW?
```

🔴 **If load is above ~20 or peers are actively editing editor source, the compile will take 16–40
minutes and a peer edit will wedge it.** s62 measured load **23–53** and lost both attempts.
✅ **Consider asking Richard for a quiet window**, or drive when the checkout is idle.

### 🔴 The launch, with the facts s62 paid for

- ✅ **The launch marker is `launching Electron`** — but it is emitted by
  **`packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js:56`**, on the compiler's `done`
  hook. 🔴 **It is NOT in `scripts/start.ts`** — grepping `start.ts` for it finds nothing and reads
  like the marker is gone. It isn't.
- 🔴 **Electron launches only after the FIRST successful renderer compile.** Line **51** of that
  config is the other branch: *"Webpack compilation has errors - not starting Electron"*.
  **Watch for both strings**, or a failed compile looks identical to a slow one.
- 🔴 **After Electron launches you are still in danger.** If a peer edits editor source before the
  renderer has fetched its bundle, `webpack-dev-middleware` logs
  **`wait until bundle finished: /src/editor/index.bundle.js`** and never releases.
  ✅ **`curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://localhost:8080/src/editor/index.bundle.js`
  — `200` means you are safe; `000` means wedged.** ⚠️ **`cdp reload` does NOT recover this.**
- ⚠️ `npm run cdp -- health` reporting `reactMounted: false` with **no console output at all** is the
  wedge's signature — the bundle never executed, so there is no exception to find.

### 🔴 The three observations, pre-registered — write them down BEFORE launching

The card is on the **launcher**, not the settings panel. 🔴 **s62's correction, and the handover it
inherited was wrong about this:** §6's "settings panel route" reaches `McpSettingsSection`, which
**only displays copy-pasteable commands and has no Connect button.** The button that writes
`~/.claude.json` is `ConnectAgentCard`, rendered on `ProjectsPage` via `useConnectAgent`.

✅ **Selectors, already found:**
- `[data-test=connect-agent-card]` — the card, on the launcher, **no project needed**
- the button's label is **`Connect Claude Code`** (`Connecting…` while busy)
- `[data-test=connect-agent-success]` / `[data-test=connect-agent-failure]` — the outcome rows

**The observations:**

1. **Click Connect, then read `~/.claude.json`.** The `nodegx` entry's `env` carries
   **`NODEGX_USER_PREFERENCES`**, pointing at the real `<userData>/PREFERENCES.md`.
   ✅ **The pre-state is recorded:** it is currently **`{"ELECTRON_RUN_AS_NODE":"1"}`** and nothing else.
2. 🔴 **The known-firing control, and the row that matters most:** `ELECTRON_RUN_AS_NODE` is **still
   there beside it**. A registration that *replaced* the env record instead of extending it looks
   like a pass to any probe that only checks the new key — and leaves a server that boots a GUI app
   with a dock icon (BST-004/F80).
3. **Open or create a project; read its `.mcp.json`.** Same variable, same value.
   ✅ **The chain, so you can tell a real failure from a missing precondition:** `.mcp.json` is
   written by `agentConfig.ts`, which **inherits `process.env[USER_PROFILE_ENV]`** from the server
   it runs in. So it only carries the variable if that server was spawned from a registration
   written **after** Connect. 🔴 **A server registered before the Connect click will correctly show
   nothing — that is not the bug.**
   ✅ **s62 left a driver that removes the guesswork:**
   `scratchpad/drive-bootstrap.js` spawns **exactly the `nodegx` registration as written in
   `~/.claude.json`** and calls `open_project`. ⚠️ The scratchpad is session-scoped and will be
   cleaned — the file is 55 lines and trivially rewritten from this description.

### 🔴 Richard's real files — what s62 learned the hard way

🔴 **`Connect` writes Richard's REAL `~/.claude.json`.** Back it up.
🔴 **But do NOT restore that backup wholesale.** ~25 live Claude Code sessions rewrite that file
continuously; s62's copy went stale within minutes (`cachedGrowthBookFeatures`, `skillUsage`,
`cachedExperimentData`). **Restoring it would clobber every one of them.**
✅ **Compare and repair the `mcpServers.nodegx` SECTION only** — a whole-file hash tells you nothing.
✅ **`PREFERENCES.md` is currently the pristine seeded template** (`c3c8425…`, 1193 bytes). To take
observation 1 you do not need to change it; to see a non-empty profile in the editor you do — put it
back afterwards.

### Then: close the phase

Once those three land, FIX-021 closes and **all 24 tasks are accounted for**. Write the phase
close-out and hand the carried items below to whoever owns them.

### Carried out of the phase, uncosted — NOT P66 work

- ⚠️ **`claudeMcpAdd` does not quote its `-e` pairs** — **display only**, proven in §3. Own task.
- 🔴 **A bar that teaches `define()`** (s50) — needs the node's **real** port list behind
  `parser.getPorts()`. ⚠️ **Explicitly not covered by FIX-016's AC1 retirement.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **`io-error: Unexpected failure: ${err.message}` names neither the tool nor the project.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.
- ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does, as Q5 specified.
- 🔴 **Blockly should enumerate declared globals as draggable blocks.** ✅ Blockly's native model.
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

### How to start here

🔴 **Read to the END of a task file before believing any sentence saying something is open.**
s61 asked Richard a question ruled two dozen sessions earlier because three `still owed` paragraphs
sat above the section that discharged them. ✅ **s62 stamped its own predecessor line STALE in
place** rather than leaving that trap for you — do the same.

🔴 **Before believing a "0", find the known-firing signal beside it.** §3's rows 1 and 2 are only
worth having because row 3 exists.

🔴 **A gate is not evidence until it has been made to fail.**

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **`${PIPESTATUS[0]}`
is empty in zsh** (it is `$pipestatus`). 🔴 **macOS has no `timeout`.** ⚠️ **zsh does not word-split
unquoted variables**, and **`--include=*.ts` unquoted is a zsh glob error** — quote it.

---

## 5. Rulings — what a builder must not get wrong

**All eight of s61's answers are recorded in their own task files with their reasoning.** The
durable ones:

- ✅ **FIX-016 AC1 is RETIRED.** 🔴 **This does NOT retire the mining slice** —
  `modeHasDeclaredPorts` stays `true` for `'script'`, and the `define()` bar is separate carried work.
- ✅ **FIX-022 §7 → (a) accept.** 🔴 **The reuse cell's rulings survive it:** `minPlacementSites`
  OFF for `trivial`, `small-logic`, `multi-section`; **both** evidence paths; the regression detector.
  ⚠️ If revisited, **measure against `multi-section` too**.
- ✅ **FIX-006 — the shape is accepted.** 🔴 **`NODES_BEFORE_CODE` keeps BOTH halves**;
  **`Javascript2` keeps leading the Script paragraph** (`traps.ts:61-63`).
- ✅ **FIX-013 rulings 3 + 4 → programmatic, no UI, nothing deleted.**
  ⚠️ **`component-bench.test.ts:259-262` needs no edit.** Ruling 2 stands: **the two surfaces
  diverge and the AI preview keeps its toolbar and data editor.** 🔴 `useSampleData` is **not** the
  switch; `emptyState` **predates** the fix; `list()` caches the empty array.
- ✅ **FIX-021 Q2 → ONE file. 🔴 SLICE A IS RULED OUT, not deferred.** Q5 → `always`, 2,000-char cap,
  free when empty. Q6 → prose only. 🆕 **The `allowWrites` judgement is now DRIVEN, not just ruled** (§3).
- ✅ **FIX-004 §C was ruled s42 and built s46.** 🔴 Its three "still owed" paragraphs are **STALE**
  and stamped. `noodl_new_object` and the JSON pair are **deliberately not** dual-listed.
- 🔴 **FIX-021's MCP half — do not "simplify" either half of the security fix back.**
  **`NODEGX_USER_PREFERENCES` is a wire contract across four files** — `noodl-mcp/src/userProfile.ts:62`,
  `noodl-editor/src/main/src/mcp/mcpFrontDoor.js:36`,
  `SettingsPanel/sections/mcpCommands.ts:267`, and `noodl-mcp/src/project/agentConfig.ts`.
  **Renaming one end turns the feature off silently for every registration already on disk.**
  🔴 **Main OVERWRITES the profile path rather than trusting the renderer's** (`mcpFrontDoor.js:263-270`),
  and the **`env` whitelist stays a whitelist** (`:215`).
- 🔴 **`typecheck:mcp` covers `src/` AND `tests/`, and is required in `pr.yml`. Do not narrow it.**
- ✅ **Slice B must keep doing:** guidance in **HTML comments**; an empty section **dropped**
  (🆕 **now measured on the wire**, §3); the block **last** and ahead of `cacheBoundary`; the
  **precedence sentence in the block** (🆕 **measured**, §3); `globalPreferences()` charging
  **nothing** when empty; `ensureUserProfileSeeded` writing **only when there is no file**.
- ✅ **FIX-008 D.** 🔴 `completeBind` stays the single successful-bind path.
- ✅ **FIX-004 redaction (b).** 🔴 **`console` stays LAST in all four parameter lists.**
- ✅ **FIX-023.** 🔴 `malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.
- ✅ **FIX-008 C.** 🔴 Observe stays `user` on purpose.
- ✅ **THE REPACKAGE — ruled s59: BUILT, LEFT IN `dist/`, NOT INSTALLED.** Do not install without
  asking. ⚠️ **So `nodegx-puppy-test-3` still resolves to the Aug-13 bundle.**
- 🔴 **The build route is `_viewer` → `build:sidecars` → `npx lerna exec --scope noodl-editor --
  npm run build`.** ⚠️ **Never `npm run build:editor` or `build:editor:_editor`** — both delete the
  root `node_modules`.

### Still owed by Richard

✅ **NOTHING IN PHASE 66.** The queue has been empty since s61.

Outside it, unchanged:

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** ⚠️ **The remaining drive needs none of it.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work, still uncommitted.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`.
- ⚠️ **`package-lock.json`'s `@nodegx/kit-scaffold` line — phase 69 should confirm it.**
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command.

🔴 **This checkout is SHARED and peers commit mid-session.** ✅ **s62 watched a peer land ~30
modified files mid-drive**, including `packages/noodl-editor/src/editor/src/validation/*`.
⚠️ **`hot: true`**: an edit to `packages/noodl-editor/src` or `noodl-viewer-react/src` hot-reloads a
live editor mid-drive — **and restarts a 16–40 minute compile.**
✅ **Take each measurement in ONE uninterrupted chain of `cdp` calls.**

### Driving the settings panel — the exact route

⚠️ **This route is for the settings panel's own sections. It does NOT reach Connect** — see §4.

1. Write an entry into `~/Library/Application Support/NodeGX/recently_opened_project.json`
   (**back it up; remove the entry AFTER `dev:stop`**), `npm run cdp -- reload`, then click
   `[data-test=launcher-project-card]`.
2. `npm run cdp -- click "[data-test=settings-panel]"` — the rail's gear.
3. The **Editor** tab is a `[class*=Tabs-module__Button--]` whose `innerText` is `Editor`.
4. 🔴 **Every section is `isClosed` and its body is MOUNTED at height 0.** Scroll it into view,
   click its `[class*=Header]`, **re-measure**, and only then read or click inside it.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.
✅ **s62 re-confirmed the shield: a real `dev:stop` killed 25 processes and left 53 MCP servers up.**

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**. ✅ **Put findings into EXISTING pointer files**,
which costs zero index budget.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s62 all checked `git log -1 --stat` plus the mtime before rewriting** — eighteen
sessions running. A whole-file overwrite is the one edit that cannot conflict: git accepts it
happily, and the loss is invisible in the diff you are looking at.
