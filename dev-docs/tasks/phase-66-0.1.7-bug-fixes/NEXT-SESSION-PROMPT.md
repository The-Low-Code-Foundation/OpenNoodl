# Phase 66 — next session

**Written 2026-08-17, session 50's brief, by session 49.** A rewrite, per §0. s49 took **item 1 —
FIX-023 — and closed it outright**: built, gated, driven, committed (`551a9440`). One task, one
commit, with its source, its spec, its fixture and its measurements.

✅ **FIX-023 is CLOSED — fifteen tasks now.** All five acceptance criteria met **and driven**.

🔴 **s49's headline is three corrections it made to its own task file, and one of them changes who
the bug belonged to.** FIX-023 was scoped as an MCP-server defect — *"the editor was hardened, the
MCP server never was"*. But `isComponentRef` lives in **`noodl-editor`'s shared validation module**,
and the repo's own **`npm run validate:project` crashed identically**, which s49 verified *before*
touching any code. The crash belonged to the **shared validator**, whichever client called it. ⚠️
**What the editor tolerates in its runtime graph says nothing about its validator** — those are two
different code paths, and the scoping had collapsed them.

🔴 **The other two corrections are about counting.** The guard existed in **two** call sites, not
one, plus a third independently-safe local copy of the function — **three** people had patched the
line they were standing on. And ~17 calls were unguarded, **seven of them in the editor's own
validation rules**, which the task file did not mention at all. Separately, the corpus is **56**
project directories, not 28 — the other 28 are legacy v1 and reach a **second** normalisation
boundary the scoping never named. ✅ **Censusing the call sites before building is what found the
second boundary**; the task file's list of five would have left `flatten()` unguarded.

🔴 **Every ruling and every build is recorded in its own task file.** §4 here is a work order, not
the source of truth. FIX-023's full write-up — the AC table, the before/after corpus numbers, the
drive matrix and the three corrections — is at the foot of its own file.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020** | ✅ | ✅ | **CLOSED** — fourteen tasks |
| **FIX-023** | ✅ | ✅ **s49, 2 arms × 2 tools** | 🆕 **CLOSED s49.** All 5 AC. ⚠️ **The repackage is still owed** — see §4 |
| **FIX-016** §2, §3, §3c, **ruling 1** | ✅ | ✅ s45, 2×2 + 2 controls | The mining slice is still open — item 1 |
| **FIX-004** §A+§B, §C, **§C dual-list** | ✅ | ✅ all driven, dual-list s48 | **Redaction (b) is the one build left** — item 2 |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 (AC3) | **D unstarted** — item 7 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Fifteen closed outright.** ⚠️ **Count the names, don't copy a total.**

✅ **No task has a built-but-undriven half.** True at s48 and still true.

---

## 2. Gate readings

✅ **s49 took the eight marked.** This session changed **shared editor source**
(`validation/*`), so those are its own.

| Gate | Reading | When |
|---|---|---|
| **`tests-unit/fix-023`** | ✅ **11/11** — and **10/11 FAIL** under the reverted-fix mutant | ✅ **s49** |
| **`noodl-editor` `test:main`** | ✅ **228 suites / 3538 tests**, 1 pre-existing timing flake | ✅ **s49** |
| **root `npm run typecheck`** (the PR gate) | ✅ exit 0, empty output | ✅ **s49** |
| **`tsc -p tsconfig.json`** | ✅ exit 0, empty | ✅ **s49** |
| **`tsc -p tsconfig.tests.json`** | ✅ exit 0, empty | ✅ **s49** |
| **`noodl-mcp` jest** | ✅ **50 suites / 585 tests**, exit 0 | ✅ **s49** |
| **`tests/validation/*` (7 suites)** | ✅ **86 tests** — incl. `false-positive-corpus` | ✅ **s49**, ⚠️ under jest |
| **The corpus before/after** | ✅ **56 targets, 54 identical diagnostic-for-diagnostic** | ✅ **s49** |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `noodl-core-ui` jest | ✅ 26 suites / 461 tests | s44 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s40 — inherited |
| `lint:ci` ratchet | ✅ exit 0, 876 against a 3916 baseline | s44 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ⚠️ **All three `tsc` readings are off empty output
*and* an exit code, taken without a pipe** — s48's were off empty output alone.

✅ **`test:main` 3527 → 3538 is exactly s49's one new suite and its 11 tests**; 227 → 228 suites.

### ⚠️ Two honest caveats on s49's own readings

- 🔴 **The 7 `tests/validation` suites ran under jest, not under the electron/jasmine harness
  `test:ci` uses.** Same source, different runner. It is a real reading of the rules — including the
  false-positive corpus and the `ALL_RULES` ordering assertion — but it is **not** a `test:ci`
  reading, and s49 does not claim one.
- ⚠️ **`test:main` and the `noodl-mcp` suite compiled a tree containing peers' uncommitted edits**
  (`tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`, `noodl-mcp/tests/kitAgreement.test.ts`).
  Both were green, and neither peer file is on FIX-023's path — but the readings are of *that* tree,
  not of the committed one.

### 🔴 `test:ci` NOT taken — and this time the reason is different

s46, s47 and s48 all skipped it because the changed surface had no jasmine spec. **That is not true
here**: `tests/validation/*` **is** the jasmine suite, and FIX-023 changed exactly what it covers.
s49 ran those 7 suites under jest instead (86 tests, all green) and is flagging the substitution
rather than hiding it. 🔴 **A session that can get a clean `test:ci` window should take one** — this
is the first P66 change in four sessions where `test:ci` would actually have graded the diff.

---

## 3. What s49 did — FIX-023, built and driven (`551a9440`)

**Fixes A + B + C, shipped together.** C alone was explicitly forbidden by the task file, and the
reason held up: it silences the crash without telling anyone the project is malformed.

- **A — the load boundary.** `normalizedType()` in `validation/normalize.ts`, at the one place
  `node.type` crosses into the model's `type: string` promise. Substitutes `MALFORMED_NODE_TYPE` and
  records `malformed: ['missing-type']`. 🔴 **Applied at BOTH boundaries** — `normalizeV2Component`
  (v2 / MCP) *and* `flatten` (legacy and `ProjectModel.toJSON()`). The task file named only the first.
- **B — the diagnostic.** A new `malformed-node` **error** rule, registered **2nd** in `ALL_RULES`,
  naming the node id and the component path **in the message text**, not only in `location`.
  `unknownNodeType` defers to it. 🔴 **2nd and not 1st**: it reports *by id*, and `duplicateNodeId`
  must keep leading or a collision sends the reader to the wrong node.
- **C — the widened signature.** `isComponentRef(type: string | undefined | null)`, for the
  `noodl-mcp` callers that walk **raw v2 files** and never pass through normalisation.

### ✅ The drive — 2 arms × 2 tools, and the old arm is the known-firing signal

A minimal MCP stdio client against a **real server**, two arms differing **only in the bundle**, over
`cp -R` copies of `puppy-test-3-fix008c` verified byte-identical with `diff -rq` first:

| | `validate_project` | `create_component` |
|---|---|---|
| **OLD bundle** (`packages/noodl-mcp/dist/`) | ❌ `Unexpected failure: …'startsWith'` | ❌ **the same error** |
| **NEW bundle** (s49's build) | ✅ `1 error / 1 warning`, 119 nodes | ✅ `"created": "Fix023 Probe"` |

✅ **The old arm wrote nothing to disk** — `diff -rq` against the kept fixture afterwards is empty,
so `create_component` failed *before* writing rather than half-way through.
✅ **The kept fixture was never written to**; both arms ran on scratch copies.

### ✅ AC5 measured properly — diagnostic-for-diagnostic, not by totals

`validate:project --json` over every project directory, before **and** after, compared on
`code + nodeId + message`: **56 targets, 54 identical.** The only two that changed are
`Puppy test 3` and its copy. ⚠️ A peer created `cn069-s15-drive` between the runs (57 after); it
validates `0e/0w` and is excluded, since the comparison iterates the *before* set.

### ✅ The spec is mutation-checked, and the fixture is shaped to catch a silent abort

🔴 **"It no longer throws" is satisfied just as well by a walk that aborts silently at the bad
node.** So the fixture puts the typeless node **third of four** in a component whose **fourth** node
carries an independently-detectable defect, and lists that component **first** in the registry ahead
of a second component carrying another. The two assertions that matter are that the node *after* it
and the component *after* it are still reported.

✅ **Mutant: fixes A and C reverted in one shell call** — announced on apply, restored from a
scratchpad backup, `diff`ed back identical. **10 of 11 tests failed**, AC1 on the original error. The
survivor is `still answers correctly for real types`, which does not exercise the guard. Correct.

---

## 4. What to do next and why

**Ordered by value, not cost.** FIX-023 is gone from this list; the item with a user waiting is now
the repackage, which is Richard's, not a build.

1. 🔴 **FIX-016 — the script-mode mining slice.** `unionPorts` calls `minePorts(code)` in script
   mode, so FUN-005's rail and FUN-006's bar can show a Script node **ports it does not have**; the
   Script node's ports come from `parser.getPorts()`, never a regex over the document
   (`javascript.ts:831-840`). **Four surfaces.** ⚠️ s45's drive read the code editor's lint state
   only. 🔴 **Check for peers' uncommitted `noodl-core-ui/src/components/code-editor/*` first.**
2. 🔴 **FIX-004 redaction (b)** — route `noodl_log` through the scrubbed sink. ⚠️ **Not free**: the
   sink is per-run `runContext`, which generated code has no handle on today. **The last FIX-004
   build.**
3. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
4. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API.
5. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
6. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
7. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.

**Do not start** FIX-015 here — it is its own phase.

### 🆕 Two things FIX-023 uncovered and deliberately did NOT build

- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** FIX-023 removed the one crash that reached it; it did nothing for the next one. **This
  wants its own task** — it is the same defect class as FIX-023's defect 2, one level up.
- ⚠️ **A missing `id` has the identical shape and is unguarded.** `MalformedNodeReason` is a
  list-typed union precisely so the next such field joins it rather than growing a second mechanism.

### How to start here

🔴 **If a peer holds 9222, ASK — early — then do editor-free work while you wait.** ⚠️ **`ListAgents`
names need their `[ref]`** on first send. 🔴 **All `electron/dist` matches on an idle checkout are
MCP servers** — s49 counted **22** of them and **zero editors**; attribute by **PPID**, and grep
`scripts/start.ts` for a launching stack.

✅ **s49 needed no editor at all.** The whole of FIX-023 — build, gates, drive — ran headless, by
spawning the MCP server over stdio with a ~60-line JSON-RPC client
(`scratchpad/fix023/drive.js`). 🔴 **For anything MCP-shaped this beats an editor drive**: it is
faster, it needs no port, it collides with nobody, and it gives you a **clean two-arm control**
because the bundle is just a file path. ⚠️ **Build to a scratch path, never over
`packages/noodl-mcp/dist/`** — peers' registered servers load that.

🔴 **Census before you build, whatever the task file says.** s49's census of `isComponentRef` call
sites is what found the second normalisation boundary; building to the task file's list of five
would have left the legacy path unguarded and the spec would still have passed.

🔴 **A green spec proves nothing until you have seen it fail.** ✅ **One shell call**: apply, run,
restore, `diff` back. 🔴 **Make each mutant announce that it applied** and **restore from a
scratchpad backup, never `git checkout`**.

🔴 **"Pre-existing" is a claim that needs measuring too.** `packages/noodl-mcp`'s own `tsc` reports
13 errors; s49 proved they pre-date the change by restoring all six changed files to `HEAD` and
re-running — **same 13**. ✅ That is the same apply/restore call as a mutant, pointed backwards.

🔴 **Check the exit code before reading the output, and never through a pipe.** `cmd | tail` reports
the **pipe's** last command. macOS has **no `timeout`**; a command that exits 127 looks exactly like
a well-behaved run.

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
- ✅ **FIX-023 — CLOSED s49. Fixes A + B + C, and C did not ship alone.** 🔴 **`malformedNode` is 2nd
  in `ALL_RULES` on purpose; `duplicateNodeId` must keep leading** — asserted by
  `tests/validation/duplicate-node-id.test.ts:40`. 🔴 **The diagnostic names the node and component
  IN THE MESSAGE, not only in `location`** — do not "tidy" that into the structured fields; the
  whole point is that the detail survives a formatter that drops them.
- ✅ **FIX-008 C — BUILT s47, MEASURED s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose**; M4
  exists to stop a later reader "finishing the job". 🔴 **Do not re-open the scope question from the
  string** — settled by the 3/3 vs 4/4 measurement.
- ✅ **FIX-004 §C dual-list — BUILT s46, DRIVEN s48.** The seam fence is narrowed and its narrowing is
  mutant-checked; **do not widen it back** to admit a future change.
- ✅ **FIX-004 — redaction (b)**, scrubbed sink. **The one FIX-004 build left.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **The argument lives on
  `ToolboxLabels.noodlVariables`; do not re-litigate it from `appConfig.ts`.**
- ✅ **FIX-016 ruling 1 — BUILT s44, DRIVEN s45.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.** ⚠️ s46's
  rename does **not** pre-empt this.
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE REPACKAGE — now the item with a live user impact, and FIX-023 is the third reason.**
  Richard's `nodegx-puppy-test-3` resolves to `/Applications/NodeGX.app/…`, the **Aug-13** bundle. It
  will keep dying with `Unexpected failure: …'startsWith'` until the app is repackaged. **The fix is
  committed and driven; he cannot see it.**
- ⚠️ **`packages/noodl-mcp/dist/` was deliberately NOT rebuilt by s49.** It is gitignored and is what
  *checkout-registered* servers load, so it is still pre-fix. s49 built to a scratch path instead,
  because a peer had uncommitted `noodl-mcp` work in flight and a rebuild lands inside anyone's
  measurement. 🔴 **A session that rebuilds it should announce that it did.**
- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s49 — seventeen sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Seventeen
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c` (the only typeless-node reproduction — ✅
  **still pristine, s49 never wrote to it**), `fix016-msg6-drive` (the only fixture with both JS node
  types in one component), and `fix004c-s48-drive` (the FIX-004/005 re-drive rig).

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s49 lost
a call to a `cd` from two commands earlier.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s49 committed once, pathspec-only, 16 files** — and a peer
landed `9954e816` mid-session plus four new uncommitted files, all untouched. ✅ **Verify after the
commit that the peers' files are still there**, not just before.

⚠️ **This checkout is busy and peers save source constantly.** A save triggers a webpack rebuild that
HMR-reloads the renderer mid-drive. ✅ **A peer will hold saves if you ask.** ✅ **Re-establish the
whole rig in ONE eval afterwards.**

### 🔴 Peer etiquette

s49 launched **nothing** — no editor, no port, no shared artifact touched — so it announced nothing,
which is the right amount. 🔴 **Announce teardown to the FULL launch list.** 🔴 **Reply to a socket on
its socket.** 🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — s49 saw 22 and
**zero** editors; attribute by **PPID**, never quote a count as evidence of an editor.

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler. 🔴 **`pkill` never reaches
`sweep()`.** ⚠️ **Compare pids, never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping
it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **s48 measured `17,397` code points / `17,492` UTF-16 — eighteen characters of headroom**, and a
peer had moved it −13 mid-session with no edit from s48. **Take your own reading; the headroom moves
both ways and neither direction is yours.**
✅ **The move whenever a new fact belongs to a section that already has a 📚 pointer: put it in the
POINTER FILE, which costs zero index budget.**

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46, s47, s48 and s49 all checked `git log -1 --stat` plus the mtime before rewriting** — the check
has now paid or cleared five sessions running. ✅ **s49 also ran `git diff --stat HEAD` on the file
and got an empty diff**, which is the cheapest proof that the context copy is still current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
