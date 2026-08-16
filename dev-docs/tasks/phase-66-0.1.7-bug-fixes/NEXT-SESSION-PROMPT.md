# Phase 66 — next session

**Written 2026-08-16, session 47.** A rewrite, per §0. s47 took item 2 of s46's queue — **FIX-008
C's open measurement, then C itself** — and landed both in `05fdc6bb`. **One task, one commit,
source + specs + task file.**

🔴 **Item 1 is still item 1, and s47 could not take it.** The drive that closes FIX-004 §C and
FIX-005 needs an editor, and **a peer's editor stack was live on 9222 for this entire session**
(launcher pid 18588 from 22:27:06, Electron pid 20572, owner a peer Claude session at pid 60571).
s47 launched nothing and drove nothing. **This is a scheduling problem, not a build problem** — see
item 1 for the one question worth asking a peer.

🔴 **s47's headline is a measurement that would have printed backwards.** The pre-C arm left the
wrong project **byte-identical on disk**, which reads as *"the model showed restraint."* It did not:
it tried to write into that project in **all three runs** and every write crashed on an unrelated
bug. **Intent was wrong 3/3; only the instrument was broken.** This is s46's finding — *a control
passes for free unless the broken arm is proven broken* — arriving somewhere with no `[mutant
applied]` line to add. The general form is in memory on
`a-mutant-that-never-applied-reports-a-pass`.

🔴 **Every ruling and every build is recorded in its own task file.** §4 here is a work order, not
the source of truth.

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
| **FIX-001 / 002 / 003 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — thirteen tasks |
| **FIX-016** §2, §3, §3c, **ruling 1** | ✅ | ✅ s45, 2×2 + 2 controls | The mining slice is still open — item 4 |
| **FIX-004** §A+§B, §C, **§C dual-list (s46)** | ✅ | §A/§B/§C ✅ · **dual-list ❌** | **Redaction (b) is the one build left** — item 5 |
| **FIX-005** part 1, dead selectors, **the rename (s46)** | ✅ | part 1 ✅ · **rename ❌** | ✅ **Part 2 acceptance 5 closes.** Nothing left to build |
| **FIX-008** A, B, E, **C (s47)** | ✅ | A/B/E ✅ · **C ❌** | ✅ **The blocking measurement is TAKEN.** **D unstarted** |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Thirteen closed outright.** ⚠️ **Count the names, don't copy a total.**

🔴 **Three tasks now have a built-but-undriven half.** Two of them are one drive (item 1); FIX-008
C's is a different one (item 2).

---

## 2. Gate readings

✅ **s47 took the five marked.** This session changed **source**, so the readings are its own.

| Gate | Reading | When |
|---|---|---|
| **`noodl-editor` `test:main`** | ✅ **227 suites / 3526 tests, all green** | ✅ **s47, 23:05** |
| **`--findRelatedTests`, both changed source files** | ✅ **2 suites / 46 tests** | ✅ **s47** |
| **`tests-unit/mcp-001` + `mcp-004`** | ✅ **3 suites / 57 tests** | ✅ **s47** |
| **`tsc -p tsconfig.json`** | ✅ 0 errors | ✅ **s47** |
| **`tsc -p tsconfig.tests.json`** | ✅ 0 errors | ✅ **s47** |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `noodl-core-ui` jest | ✅ 26 suites / 461 tests | s44 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `lint:ci` ratchet | ✅ exit 0, 876 against a 3916 baseline | s44 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ⚠️ **Both `tsc` readings are off empty output, not an
exit code.**

✅ **`test:main` is up from s46's 225/3498 to 227/3526** — peers added suites; s47 added 5 tests.
✅ **s44's `bld-004/reasoningChannel` load-flake PASSED in s47's full run**, so it is a flake and not
a decay.

### 🔴 `test:ci` NOT taken by s47, same reason as s46 and it is stronger now

**A peer's editor stack was live for the entire session** — `scripts/start.ts` pid 18588 (22:27:06),
three webpacks, Electron pid 20572 with the renderer on 9222, attributed by **PPID** up to a peer
Claude session (pid 60571), **not** by the ~25 `electron/dist` matches, which are MCP servers. A
`test:ci` run compiles the working tree inside a ~40s webpack window, and peers committed **twice**
during this session and still hold uncommitted source. **A reading taken then would not have been of
these changes.**

✅ **And it would have graded nothing anyway:** `mcpCommands.ts` and `McpSettingsSection.tsx` have no
jasmine spec — the whole surface is `tests-unit`, which is plain-Node jest. **The floor stays
inherited: 2843 / 6 @ 39393, witnessed 21:53:37.**

---

## 3. What s47 did

### ✅ FIX-008 C's open measurement — TAKEN. The answer is unambiguous

The question ruled an agent's in s42: *"with C, two NodeGX servers can be visible in one session; is
that better or worse for the model?"*

| arm | servers visible | server the model chose | wrong-project writes attempted |
|---|---|---|---|
| **A — pre-C** | bootstrap + a stale global bound elsewhere | **the stale one, 3/3** (14–18 calls) | **yes, 3/3** |
| **B — post-C** | those two **+ the project's own** | **the project's own, 4/4** (5–7 calls) | none |

**Two servers is not the hazard. One wrongly-bound server is.** In arm B the stale project was
byte-identical before and after, every run.

🔴 **It called `get_project_info` first in every single run** — which since fix E carries
`projectDirectory` — **and still never questioned the binding.** A bound directory the model *can*
read is not one it *checks*.

✅ **The method is reusable and touched nothing of Richard's:** `claude -p --strict-mcp-config
--mcp-config <arm>` ignores every other MCP configuration, so **`~/.claude.json` was read once,
read-only, for the registration shapes and never used as config**. All three servers ran the same
HEAD bundle, so the server set is the only difference. ⚠️ **Both arms got identical `--allowedTools`
covering every server**, or permissions would steer the very choice being measured.

### ✅ FIX-008 C — BUILT (`05fdc6bb`)

`MCP_SCOPE` splits by **surface**: the per-project authoring row registers `--scope project`;
bootstrap and observe stay `user`, because neither is bound to a project. The provenance sentence
moved **out of the component**, which had been promising *"your user account, from any directory"*
for both rows and would have gone on saying it.

🔴 **The flag alone does not put the registration in the project.** `--scope project` resolves
against the shell's cwd — exactly like `local` — and `claude mcp add` has **no flag naming a target
directory** (checked, 2.1.228). So the row now carries a `scopeNote` naming the folder, plus the
removal hint for the user-scope entry that silently shadows it. ⚠️ **This is the same hazard the
original `MCP_SCOPE` comment was written to avoid, and it is made visible rather than solved.**

**Four mutants, all applied, all bite:** M1 scope back to `user` (4 of 57) · M2 note stops naming the
directory (1) · M3 cleanup hint dropped (1) · M4 observe project-scoped too (2). ⚠️ **M2 and M3 did
not apply on the first attempt and said so** — a `\$` escaped inside single quotes. **The escaping
bug moved one layer along from s46's; expect it to move again, not to disappear.**

### 🔴 A separate, pre-existing bug s47 fell over — WANTS ITS OWN TASK

`validate_project`, `create_component` and **every write** on `Puppy test 3` fail with
`io-error: Unexpected failure: Cannot read properties of undefined (reading 'startsWith')`.

- **Cause:** one node carrying only `{id, x, y}` and **no `type`**, at
  `components/Pages/Admin Login/nodes.json`, id `6d5ec795…`, reaching `isComponentRef(node.type)`.
- **Not a regression:** the **packaged Aug-13 bundle fails identically.** ⚠️ Do not bisect it.
- **Census: 1 of 27 v2 projects** — but it is the one Richard has a registered server for, so **his
  own `nodegx-puppy-test-3` cannot author or validate.**
- 🔴 **The editor was hardened against this exact node on 2026-08-11 and the MCP server never was.**
  There, one bad node costs you the node; here it costs **the whole project's write surface**,
  behind an error naming neither the node nor the component.

✅ **How to see the stack:** copy `dist/noodl-mcp.cjs` to a scratch path and replace
`Unexpected failure: ${err.message}` with the same plus `${err.stack}`. 🔴 **Never patch the shared
`dist/`** — peers load it.

⚠️ **s47 rebuilt `packages/noodl-mcp/dist/` (gitignored) to HEAD**, because it lagged three CN
commits. That is a derived artifact and was not announced; it is now current.

---

## 4. What to do next and why

**Ordered by cost.**

1. 🟢 **DRIVE the two s46 builds — one editor launch closes both.** Open the Logic Builder flyout and
   read **`App Objects`** (expect **seven** rows, interleaved) and the **category name**
   (`App Variables`), then Settings → Project for the **`App Config`** heading. ⚠️ **Read the FLYOUT
   WORKSPACE, not the toolbox XML** — s38: *"a block whose definition failed to register would still
   be named in the toolbox and simply not draw."* ⚠️ **The settings-panel half is currently graded by
   reading SOURCE TEXT for the `title` prop** and cannot prove the section renders.
   🔴 **Check 9222 FIRST.** If a peer's editor is still up, the one question worth asking is *"are
   you done with the editor, and may I take 9222?"* — **not** a request to hold saves, which is a
   different and smaller favour. ⚠️ **Two editors cannot coexist even on different ports.**
2. 🟠 **FIX-008 C — AC3, and it needs no editor for the interesting half.** *"`claude mcp list` from
   that folder shows the project entry."* Copy the emitted command, run it **in a project copy**, and
   read `claude mcp list` from that folder **and from elsewhere** — the second read is the one that
   proves the scope. ⚠️ It writes a real `.mcp.json`; **use a copy**.
3. 🔴 **The typeless-node bug — write the task, then build it.** §3. A guard in the validator plus an
   error that **names the node and component**. ⚠️ **The `io-error` is the real defect**: it turned a
   one-node problem into an unexplained dead server.
4. 🔴 **FIX-016 — the script-mode mining slice.** `unionPorts` calls `minePorts(code)` in script
   mode, so FUN-005's rail and FUN-006's bar can show a Script node **ports it does not have**; the
   Script node's ports come from `parser.getPorts()`, never a regex over the document
   (`javascript.ts:831-840`). **Four surfaces.** ⚠️ s45's drive read the code editor's lint state
   only, not the rail or the bar. 🔴 **Peers have `noodl-core-ui/src/components/code-editor/*`
   uncommitted right now** — check before touching it.
5. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. ⚠️ **Not free**: the
   sink is per-run `runContext`, which generated code has no handle on today.
6. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
7. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API.
8. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
9. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
10. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.

**Do not start** FIX-015 here — it is its own phase.

### How to start here

🔴 **"Nothing changed" is never a result on its own — establish whether the thing was ATTEMPTED.**
s47's pre-C arm and s46's four mutants are the same failure. For a control that is `[mutant
applied]`; for a behavioural arm it is **the transcript**. ⚠️ **A refusal and a crash leave identical
footprints and mean opposite things.**

🔴 **Check the exit code before reading the diff.** s47's first pilot changed nothing because macOS
**has no `timeout`** and the command exited 127 — which looks exactly like a well-behaved run.

🔴 **Census before you build, whatever the task file says.** The typeless-node census (1 of 27) is
what turned "a broken project" into "a bug in one project that happens to be the registered one".

🔴 **Before deleting anything a spec might grade, search THREE roots**: `src/`, `tests/` **and
`tests-unit/`**. ⚠️ **Exclude `*.bundle.js`**.

✅ **A mutation check costs one shell call** — apply, run, restore, `diff` back, in **one** Bash
invocation. 🔴 **Make each mutant announce that it applied**, and **restore from a scratchpad backup,
never `git checkout`**, when the surrounding changes are uncommitted.

🔴 **Grading anything in the code editor, headlessly:** `javascriptDiagnostics(state, validationType)`
is pure and runs in `noodl-core-ui`'s jest. `setOpenNodeContext({typeName, declaredInputs,
declaredOutputs})` says which node is open; `null` is a code **file**, not a node.

✅ **Grading it in the running editor** (s45's recipe): `forEachDiagnostic` off the module cache at
`../../node_modules/@codemirror/lint/dist/index.js`, against
`document.querySelector('.cm-content').cmTile.view.state`. Select the node by its **view** node via
`NodeGraphContextTmp.nodeGraph`, then `cdp click "button.property-codeeditor-button"`.
⚠️ **Settle ~20s before reading, and return `{alive}` from every read.**

✅ **Measuring what a model does with an MCP surface:** `claude -p --strict-mcp-config --mcp-config
<file>` — pure arms, real client, nothing of the user's touched. ⚠️ **Identical `--allowedTools` in
every arm.** ⚠️ **~$0.60 a run**; s47's seven cost **$4.29**.

🔴 **Grading what the AI plans:** `packages/noodl-editor/scripts/aix002-measure/dist/fix022-plan.cjs`.
✅ `--dump=<path>` writes the arm's system prompt and exits before the provider is built.
⚠️ `--model` is effectively required. **Authoring** is the sibling `dist/aix002-harness.cjs`.

---

## 5. Rulings — what a builder must not get wrong

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids.** Measure node choice **and** chain shape. ⚠️ n=5 cells are not a
  floor; re-run at n=10. ⚠️ **Coupling:** this preference belongs in FIX-021's user profile — **do
  not build it in a way that forecloses slices A/B.**
- ✅ **FIX-008 C — BUILT s47, measurement taken, NOT driven.** 🔴 **Observe stays `user` on purpose**;
  M4 exists to stop a later reader "finishing the job" by project-scoping it. 🔴 **Do not re-open the
  scope question from the string** — it is settled by the 3/3 vs 4/4 measurement in §3.
- ✅ **FIX-004 §C dual-list — BUILT s46, NOT driven.** The seam fence is narrowed and its narrowing
  is mutant-checked; **do not widen it back** to admit a future change.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **Still the one FIX-004 build left.**
- ✅ **FIX-005 — rename BUILT s46**, reversing VFN-012 knowingly. **The argument lives on
  `ToolboxLabels.noodlVariables`; do not re-litigate it from `appConfig.ts`.**
- ✅ **FIX-016 ruling 1 — BUILT s44, DRIVEN s45.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.

### 🔴 Three things that are NEW TASKS, not P66 items

- 🔴 **The typeless node kills `noodl-mcp`** — §3. **The newest, and the only one with a live user
  impact today.**
- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.** ⚠️ s46's
  rename does **not** pre-empt this.
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s47** — fifteen sessions now.
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Fifteen
  sessions have declined.**
- ⚠️ **The packaged-app repackage is still owed** — and s47 gave it a second reason: the packaged
  bundle is **Aug 13**, so every project-bound server on this machine is running code from before
  fix E.
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ `fix016-msg6-drive` is worth keeping — the only fixture with **both** JS node types in one
  component.
- ✅ **`puppy-test-3-fix008c`** (under `NodeGX test projects/`) is **kept on purpose**: it is a copy
  of the one project that reproduces the typeless-node crash, so item 3 can be built and driven
  without touching the real `Puppy test 3`. s47's other fixture, `fix008c-work`, is deleted.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s47 committed once, pathspec-only**; peers' work (phase-50
notes, phase-65, phase-68, phase-69 notes, `scripts/library/check.ts`, and in-flight `noodl-editor`
community/dialog files) was untouched, and **a peer commit landed between s47's measurement and its
commit** without incident.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a webpack rebuild that
HMR-reloads the renderer mid-drive. ✅ **A peer will hold saves if you ask.** ✅ **Re-establish the
whole rig in ONE eval afterwards.**

### 🔴 Peer etiquette — s47 launched nothing, and that is why it said nothing

s47 ran **no editor and no `test:ci`**, so it had nothing to announce and announced nothing. It did
**measure** the checkout and found a peer's editor stack live throughout — which is the input to
item 1 and to the `test:ci` decision in §2, not a complaint.

⚠️ **If you launch, that changes.** 🔴 **Announce teardown to the FULL launch list.** 🔴 **Reply to a
socket on its socket.** 🔴 **All `electron/dist` matches on an idle checkout are MCP servers, not
editors** — attribute by **PPID**, never quote a count as evidence of an editor.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s47 measured `17,411` code points / `17,505` UTF-16 — FIVE characters of headroom.**
**`MEMORY.md` is FULL, and tighter than s46 found it.** s47 added **nothing** to it: three memory
updates and one phase-file update all went under existing pointer entries, which costs zero budget.

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing, and a section with a 📚 pointer takes new entries **in the pointer file**.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 and s47 both checked `git log -1 --stat` plus the mtime before rewriting** — unchanged since
22:40:23 — and the check has now paid or cleared three sessions running.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
