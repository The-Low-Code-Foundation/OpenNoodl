# Phase 66 — next session: CLOSE IT

**Written 2026-08-18, session 63's brief, by session 62.** A rewrite, per §0.

## 🔴 THE WHOLE PHASE IS THREE OBSERVATIONS AND A CLOSE-OUT. NOTHING ELSE IS OPEN.

**23 tasks closed. FIX-015 left the phase. FIX-021 is the last one, and it is half-driven.**

> **The job:** click **`Connect Claude Code`** on the launcher, read `~/.claude.json`, read a
> project's `.mcp.json`. **Three observations (§4).** Then write the close-out (§5).
> **No API credit. No new code. Nothing owed by Richard.**

⚠️ **s62 did not fail the drive — s62 never got a renderer.** Two launches, ~1h40m, no editor.
🔴 **That is the only real risk to this session, so §3 comes before the drive and decides whether
to start at all.**

### 🔴 Do NOT close the phase on the server half

s62 drove the **MCP server** end 4/4 (§2). That is genuinely done. **It is not the whole of
FIX-021**, and the task file's own acceptance names the editor end separately. **Closing on §2
alone would be the error this brief exists to prevent.**

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
| **FIX-004** | ✅ | ✅ | **CLOSED.** §C ruled s42, built s46; confirmed s61 |
| **FIX-006 / FIX-013 / FIX-016 / FIX-022** | ✅ | ✅ | **CLOSED s61** by ruling |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s42/s44 | Closed halves |
| **FIX-021 slice B** — global user profile | ✅ s58 | ✅ s59 | Q2/Q5/Q6 confirmed s61 |
| **FIX-021 — MCP half, SERVER end** | ✅ s60 | ✅ **s62, 4/4** | §2 |
| **FIX-021 — MCP half, EDITOR end** | ✅ s60 | ⛔ | 🔴 **THE ONLY OPEN ITEM.** §4 |
| **FIX-021 slice A** | ⛔ | — | ✅ **RULED OUT at s61 (Q2), not deferred** |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

🔴 **TWENTY-THREE closed.** ⚠️ **Count the names, never copy a total.**
**23 + FIX-015 (left the phase) = 24**, with **FIX-021 alone open**, on three observations.

---

## 2. What s62 already measured — the server half, 4/4. DO NOT RE-DRIVE THIS.

**Instrument:** `node packages/noodl-mcp/dist/noodl-mcp.cjs <dir> [--allow-writes]`, real stdio,
real JSON-RPC, `tools/call get_project_info`. 🔴 **Deliberately not a jest run of `tests/`** —
in-process is not what a client runs.

| # | `NODEGX_USER_PREFERENCES` | profile file | writes | `userPreferences` |
|---|---|---|---|---|
| 1 | **unset** | — | yes | ⛔ absent |
| 2 | set | **pristine seeded template** | yes | ⛔ absent |
| 3 | set | **two headings answered** | yes | ✅ **present** |
| 4 | set | two headings answered | **read-only** | ✅ **present** |

- ✅ **Row 3 is what licenses rows 1 and 2** — same run, same instrument. Rows 1 and 2 are two
  *different* absences on purpose: "an older registration" and "a user who never wrote anything".
- ✅ **The `note` travels with the text**, in full, including the `docs/CONVENTIONS.md` precedence
  sentence. Its absence was the failure worth catching; it did not occur.
- ✅ **Only ANSWERED headings arrive** — comment-only ones are dropped, not sent empty.
- ✅ **Row 4 confirms Richard's `allowWrites` ruling by DRIVE:** 13 tools, no `authoringTraps` /
  `authoringDoctrine` / `designDoctrine`, **and `userPreferences` still present**.

### ✅ Step zero is DONE — but it is gitignored, so re-check it in one command

`dist/noodl-mcp.cjs` was s59's build with **0** occurrences of `NODEGX_USER_PREFERENCES`; s62
rebuilt it. It persists on disk, **but `packages/noodl-mcp/dist/` is untracked, so nothing
guarantees it.**

```bash
grep -c NODEGX_USER_PREFERENCES /Users/richardosborne/vscode_projects/OpenNoodl/packages/noodl-mcp/dist/noodl-mcp.cjs   # expect ≥1
npm --prefix packages/noodl-mcp run build      # ONLY if it reads 0 — esbuild, seconds
```

🔴 **A drive against a stale bundle produces a `get_project_info` with no `userPreferences`, which
is indistinguishable from the feature being broken.**

---

## 3. 🔴 FIRST: MEASURE THE MACHINE. IT DECIDES WHETHER TO START.

```bash
uptime                                          # load average
ps -Ao command | grep -c '[n]oodl-mcp.cjs'      # resident MCP servers
find packages/noodl-editor/src packages/noodl-core-ui/src -type f \
  -not -path '*/node_modules/*' -newermt '30 minutes ago' | wc -l    # peers editing editor source?
```

🔴 **Above ~20 load, or with peers actively editing editor source, do not start.** s62 measured
load **23–53** (53 resident MCP servers, a VM at ~50% CPU) and the renderer's first compile took
**998 s (16.6 min)**; a later one had not finished after **40 min**. The skill's "60-90s" assumes an
idle box. ✅ **Ask Richard for a quiet window rather than burning the session** — this drive is
short once a renderer exists.

### The two mechanisms that took s62's editor away, both structural to a SHARED checkout

- 🔴 **`start.ts` calls `reapPreviousSession()` — a peer's `npm run dev` KILLS your stack.** s62 saw
  all three lerna children exit `undefined` mid-wait. Not `dev:stop`, not the watchdog, not you.
- 🔴 **`hot: true` + a peer edit *after* Electron launches = a PERMANENT wedge.** Electron is spawned
  by the renderer webpack's `done` hook, so it starts *after* the first compile. A peer touching
  `packages/noodl-editor/src` then starts a new compile **while the renderer is fetching its
  bundle**, and `webpack-dev-middleware` holds that request forever
  (`wait until bundle finished: /src/editor/index.bundle.js`, on repeat).
  ⚠️ **`cdp reload` does NOT recover it** — proven across 2 reloads and 2 further *successful*
  compiles. **Only a full relaunch clears it.**

✅ **The one command that tells wedged from merely slow:**
```bash
curl -s -o /dev/null -w '%{http_code}' --max-time 20 http://localhost:8080/src/editor/index.bundle.js
```
**`200` = safe. `000` = wedged** (held, not refused).
🔴 **The wedge's signature is `reactMounted: false` with NO console output at all** — the bundle
never executed, so there is no exception to hunt. Do not go looking for one.

### Launching, with the facts s62 paid for

```bash
npm run dev:debug -- --quiet     # background it via run_in_background, NOT nohup
```
- ✅ **The marker is `launching Electron`** — emitted by
  **`packages/noodl-editor/webpackconfigs/webpack.renderer.dev.js:56`**.
  🔴 **It is NOT in `scripts/start.ts`** — grepping there finds nothing and reads like it was removed.
- 🔴 **Watch line 51's branch too** — *"Webpack compilation has errors - not starting Electron"*.
  Without it, a failed compile is indistinguishable from a slow one.
- ⚠️ **macOS has no `timeout`**, and **foreground `sleep` is blocked** — poll with a bounded
  `for i in $(seq 1 N); do … sleep 5; done`.

---

## 4. THE DRIVE — three observations, pre-registered. Write them down BEFORE launching.

### 🔴 The card is on the LAUNCHER, not the settings panel

**s62's correction to the route every prior handover carried.** §6's settings-panel route reaches
`McpSettingsSection`, which **only displays copy-pasteable commands and has no Connect button at
all**. The button that writes `~/.claude.json` is `ConnectAgentCard`, rendered on `ProjectsPage`
via `useConnectAgent` (`ProjectsPage.tsx:255`, `:1302`).

✅ **Selectors, already found — no project needed, the card is on the launcher itself:**
- `[data-test=connect-agent-card]` — the card
- the button's label is **`Connect Claude Code`** (`Connecting…` while busy)
- `[data-test=connect-agent-success]` / `[data-test=connect-agent-failure]` — the outcome rows

### 🔴 Back up `~/.claude.json` — and do NOT restore it wholesale

**`Connect` writes Richard's REAL `~/.claude.json`.** Back it up.
🔴 **But ~25 live Claude Code sessions rewrite that file continuously.** s62's copy went stale
within minutes — the whole-file sha changed while `mcpServers` stayed **byte-identical**, with only
`cachedGrowthBookFeatures`, `cachedGrowthBookFeaturesAt`, `skillUsage`, `cachedExperimentData`
differing. **Restoring a backup would clobber every one of those sessions.**

✅ **Compare and repair the `mcpServers.nodegx` SECTION only. A whole-file hash tells you nothing:**
```bash
node -e '
const fs=require("fs");
const a=JSON.parse(fs.readFileSync(process.env.HOME+"/.claude.json","utf8"));
const b=JSON.parse(fs.readFileSync(process.argv[1],"utf8"));
console.log("mcpServers IDENTICAL:", JSON.stringify(a.mcpServers)===JSON.stringify(b.mcpServers));
' /path/to/backup.json
```

### The three observations

**1. Click Connect, then read `~/.claude.json`.** The `nodegx` entry's `env` carries
**`NODEGX_USER_PREFERENCES`**, pointing at the real `<userData>/PREFERENCES.md`
(`/Users/richardosborne/Library/Application Support/NodeGX/PREFERENCES.md`).
✅ **The pre-state is recorded, so you have a genuine before/after:** as of s62 that `env` is
**`{"ELECTRON_RUN_AS_NODE":"1"}` and nothing else.**

**2. 🔴 THE CONTROL, AND THE ROW THAT MATTERS MOST.** `ELECTRON_RUN_AS_NODE` is **still there beside
the new key**. A registration that *replaced* the env record instead of extending it **looks like a
pass to any probe that only checks the new key** — and leaves a server that boots a GUI app with a
dock icon (BST-004/F80). **Assert both keys, not one.**

**3. Open or create a project; read its `.mcp.json`.** Same variable, same value.
✅ **The chain, so you can tell a real failure from a missing precondition:** `.mcp.json` is written
by `noodl-mcp/src/project/agentConfig.ts`, which **inherits `process.env[USER_PROFILE_ENV]`** from
the server it runs in. So it carries the variable **only if that server was spawned from a
registration written AFTER the Connect click.**
🔴 **A server registered before the click will correctly show nothing. That is not the bug.**
✅ **The reliable way to take this row is to spawn the registration exactly as written** — read
`mcpServers.nodegx` out of `~/.claude.json`, spawn `command`+`args` with its `env` merged in, then
call `open_project` over stdio and read the `.mcp.json` it wrote. ~55 lines; s62's copy lived in a
session scratchpad that is now gone.

⚠️ **To see a non-empty profile you must write into `PREFERENCES.md` first.** It is currently the
**pristine seeded template** (`c3c8425…`, 1193 bytes, every heading an HTML comment). **Put it back
afterwards.** Observations 1 and 2 do not need it changed.

---

## 5. THEN CLOSE THE PHASE — the artefacts, by name

Once the three land, FIX-021 closes and **all 24 tasks are accounted for**. The close-out is four
edits and a commit:

1. **`FIX-021-THE-PROJECT-THAT-KNOWS-ITS-BUILDER.md`** — append the drive (instrument, rows,
   what the control showed) and mark the task **CLOSED**. ⚠️ Its final section currently reads
   *"Still owed: observations 1, 2 and 3"* — **discharge that sentence in place**, don't leave it
   for the next reader.
2. **`TASKS.md`** — append the closing session entry, in the file's existing per-session voice.
3. **`README.md`** — mark the phase complete; FIX-015 explicitly **left** for its own phase.
4. **`NEXT-SESSION-PROMPT.md`** — replace with the phase **close-out**: what shipped, what carried
   out, and the pointer to whoever owns the carried items.
5. **Commit by explicit pathspec** (`git commit <paths>`, never `git add`), then **update memory** —
   `phase-66-scoped-from-the-user-test.md` is the durable summary and needs the closure.

🔴 **Append-only files lie by omission.** FIX-021, TASKS.md and README.md all narrate forward. s61
asked Richard a question ruled two dozen sessions earlier because three `still owed` paragraphs sat
above the section that discharged them. ✅ **Stamp superseded sentences STALE in place** — s62 did,
and so should this session.

### Carried out of the phase, uncosted — NOT P66 work

- ⚠️ **`claudeMcpAdd` does not quote its `-e` pairs** — 🆕 **now bounded to DISPLAY ONLY.**
  `connectBootstrapServer` uses `spawnSync(exec, cliArgs(registration))` — an **argv array, no
  shell** (`connectBootstrapServer.js:193-196`). Richard's own profile path contains a space
  (`…/Application Support/…`) and is the worst case; it is safe on both the CLI and JSON routes.
  **Cosmetic. Wants its own small task.**
- 🔴 **A bar that teaches `define()`** (s50) — needs the node's **real** port list behind
  `parser.getPorts()`, i.e. a syntax-tree parse. ⚠️ **Not covered by FIX-016's AC1 retirement.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50).
- 🔴 **`io-error: Unexpected failure: ${err.message}` names neither the tool nor the project.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled `react-app`.
- ⚠️ **The PLANNING turn does not carry the profile** — only the authoring turn does, as Q5 specified.
- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`. ✅ Blockly's own native model.
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel".**

---

## 6. Gate readings

⚠️ **s62 took NO suite readings and owed none** — it changed **no tracked file**; its only artefact
was the gitignored `packages/noodl-mcp/dist/`. **Everything below is s60's or older; re-measure
before quoting.** 🔴 **Quote a TREE, not a commit.**

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

**If the drive changes no source — and it should not — this session owes no suite either.**

### 🔴 Readings that will mislead you

- 🔴 **`test:ci`'s exit code lies BOTH ways**; a clean floor run exits **1**, and `… | tail` reports
  the pipe's last command ⇒ **0** regardless. **Delete `tests/test-results.json` first and prove
  completion from its mtime.** ⚠️ **`${PIPESTATUS[0]}` is empty in zsh** — it is `$pipestatus`.
- 🔴 **A tool added to a DEFERRED MCP group costs ZERO surface budget**, and so does a **field added
  to a tool's RESULT**. That is the only reason FIX-021's MCP half fitted against 57 tokens.
- 🔴 **`provision.test.ts` / `projectOwnsBackend.test.ts` flake** on real ports.
- ⚠️ **`test:main`'s baseline moves under you** — peers land suites mid-session. Re-measure.
- ⚠️ **`--include=*.ts` unquoted is a zsh glob error**, and zsh does not word-split unquoted vars.

---

## 7. Rulings — what a builder must not get wrong

- ✅ **FIX-021 Q2 → ONE file. 🔴 SLICE A IS RULED OUT, not deferred.** Proposing it is proposing to
  overturn a ruling. Q5 → `always`, 2,000-char cap, free when empty (**rejected:** `pull`).
  Q6 → prose only (**rejected:** `ai.role.*` keys). ✅ **The `allowWrites` judgement is now DRIVEN** (§2).
- 🔴 **`NODEGX_USER_PREFERENCES` is a wire contract across FOUR files** —
  `noodl-mcp/src/userProfile.ts:62`, `noodl-editor/src/main/src/mcp/mcpFrontDoor.js:36`,
  `SettingsPanel/sections/mcpCommands.ts:267`, `noodl-mcp/src/project/agentConfig.ts`.
  **Renaming one end silently turns the feature off for every registration already on disk.**
- 🔴 **Do not "simplify" either half of the security fix back.** Main **overwrites** the profile path
  rather than trusting the renderer's (`mcpFrontDoor.js:263-270`), and the **`env` whitelist stays a
  whitelist** (`:215`) — both exist because the registration is written to the user's real
  `~/.claude.json` and spawned by their agent.
- 🔴 **`typecheck:mcp` covers `src/` AND `tests/`, and is required in `pr.yml`. Do not narrow it** —
  seven of the eight errors it caught were in `tests/`.
- ✅ **Slice B must keep doing:** guidance in **HTML comments**; an empty section **dropped**
  (✅ measured on the wire, §2); the block **last** and ahead of `cacheBoundary`; the **precedence
  sentence in the block** (✅ measured, §2); `globalPreferences()` charging **nothing** when empty;
  `ensureUserProfileSeeded` writing **only when there is no file**.
- ✅ **FIX-016 AC1 is RETIRED.** 🔴 **This does NOT retire the mining slice** — `modeHasDeclaredPorts`
  stays `true` for `'script'`; the `define()` bar is separate carried work.
- ✅ **FIX-022 §7 → (a) accept.** 🔴 The reuse cell's rulings survive it: `minPlacementSites` OFF for
  `trivial`, `small-logic`, `multi-section`; **both** evidence paths; the regression detector.
  ⚠️ If revisited, **measure against `multi-section` too** — its ceiling is the only guard on AAQ-008.
- ✅ **FIX-006 — the shape is accepted.** 🔴 `NODES_BEFORE_CODE` keeps **BOTH halves**;
  **`Javascript2` keeps leading the Script paragraph** (`traps.ts:61-63`).
- ✅ **FIX-013 rulings 3 + 4 → programmatic, no UI, nothing deleted.**
  ⚠️ **`component-bench.test.ts:259-262` needs no edit.** Ruling 2 stands: the two surfaces diverge
  and the AI preview keeps its toolbar and data editor — so a `SandboxToolbar` absence check is
  invalid. 🔴 `useSampleData` is **not** the switch; `emptyState` **predates** the fix; `list()`
  caches the empty array.
- ✅ **FIX-004 §C was ruled s42 and built s46.** 🔴 Its three "still owed" paragraphs are **STALE**
  and stamped. `noodl_new_object` and the JSON pair are **deliberately not** dual-listed; a spec
  pins that asymmetry so nobody "finishes the job".
- ✅ **FIX-008 D.** 🔴 `completeBind` stays the single successful-bind path; `list_projects`' note
  branches on `isBound`. ✅ **FIX-008 C** — Observe stays `user` on purpose.
- ✅ **FIX-004 redaction (b).** 🔴 **`console` stays LAST in all four parameter lists**; do not tidy
  the four spellings into one constant.
- ✅ **FIX-023.** 🔴 `malformedNode` 2nd in `ALL_RULES`; `duplicateNodeId` leads.
- ✅ **FIX-024** — 🔴 `'learn'` and `'learning'` are two different pages.
- ✅ **THE REPACKAGE — ruled s59: BUILT, LEFT IN `dist/`, NOT INSTALLED.** Do not install it without
  asking again. ⚠️ **So `nodegx-puppy-test-3` still resolves to the Aug-13 bundle**, and a registered
  agent runs *older* server code than this checkout builds. **Drive the dev stack, or say which
  bundle you measured.**
- 🔴 **The build route is `_viewer` → `build:sidecars` → `npx lerna exec --scope noodl-editor --
  npm run build`.** ⚠️ **Never `npm run build:editor` or `build:editor:_editor`** — both delete the
  root `node_modules`. **`build:editor:pack` copies; it does not build.**

### Still owed by Richard

✅ **NOTHING IN PHASE 66.** The queue has been empty since s61.

Outside it, unchanged:

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** ⚠️ **This drive needs none of it.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work, still uncommitted.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`.
- ⚠️ **`package-lock.json`'s `@nodegx/kit-scaffold` line — phase 69 should confirm it.**
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.

---

## 8. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls** *and is
reset after some tool results*.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command.

🔴 **This checkout is SHARED and peers commit mid-session.** ✅ s62 watched a peer land ~30 modified
files mid-drive, including `packages/noodl-editor/src/editor/src/validation/*`.
⚠️ **`hot: true`**: an edit to `packages/noodl-editor/src` or `noodl-viewer-react/src` hot-reloads a
live editor mid-drive **and restarts a 16–40 minute compile** — see §3.
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

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — the watchdog runs the *same*
sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.**
⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.
✅ **s62 re-confirmed the shield: a real `dev:stop` killed 25 processes and left 53 MCP servers up.**

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**. ⚠️ **It has been sitting ~450 OVER since before
s62** — peers edit it too. ✅ **Put findings into EXISTING pointer files**, which costs zero index
budget, and **size-check at the END**.

```bash
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

✅ **s46 through s62 all checked `git log -1 --stat` plus the mtime before rewriting** — eighteen
sessions running. A whole-file overwrite is the one edit that cannot conflict: git accepts it
happily, and the loss is invisible in the diff you are looking at.
