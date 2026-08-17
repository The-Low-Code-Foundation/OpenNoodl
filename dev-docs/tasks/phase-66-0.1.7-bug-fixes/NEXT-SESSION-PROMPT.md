# Phase 66 — next session

**Written 2026-08-17, session 52's brief, by session 51.** A rewrite, per §0. s51 took **item 1 —
FIX-004's redaction (b) — and closed it outright**: censused, built, gated, mutated, measured,
committed (`3b54325f`). One task, one commit.

✅ **FIX-004 has no open build left. So does FIX-016. Seventeen tasks are closed outright** — s51's
own is one, and **a peer landed FIX-024 mid-session** (`7b7a7784`, built + driven, all 5 AC).

🔴 **s51's headline is that the census found ONE spelling of a list that has FOUR, and a gate in a
package the change never touched is what said so.** The parameter list the Logic Builder compiles
block programs against is written out in `_compileFunction`, again in `evaluateFragment`, again in the
editor's `BenchRunner`, and a fourth time in the gate's own literal. The census read the first and
stopped. `vfn-011/drift-gate.spec.ts` failed on **arity** — because it reads `compiled.length` off the
runtime's own compile rather than off its source — and that is the only reason the bench did not go on
running block programs against a ten-parameter contract. **That gate had never fired before.**

🔴 **The ruling named a mechanism, and the mechanism was the wrong half of the problem.** s42 said
*"route the block's generator at `console.log` through the scrubbed sink"*, which reads as *change the
generator*. That would fix programs saved from tomorrow and leave **every `generatedCode` string
already on disk** leaking, because they all already say `console.log`. Shadowing `console` as a
compile **parameter** fixes both populations in one edit and leaves the editor↔runtime contract — and
its three specs — true rather than rewritten. **Ask which population a fix reaches, not just whether
it works.**

🔴 **A suite's stated premise expired, and left alone it would have reported a working feature as
broken.** `cloud-logic-builder-log.test.ts` said in a comment: *"a `console.log` from generated code
does not go through the logger, so leaving it silent is safe."* True when written, false the moment
this landed. All four presence assertions failed for a reason with nothing to do with the block.

🔴 **Every ruling and every measurement is in its own task file.** §4 here is a work order, not the
source of truth. FIX-004's full write-up — the four spellings, the before/after row, the four mutants
and the two exit codes read wrong before being read right — is at the foot of its own file.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020 / 023** | ✅ | ✅ | **CLOSED** — fifteen tasks |
| **FIX-024** 🆕 | ✅ | ✅ | **CLOSED by a peer, s51** (`7b7a7784`). Launcher opens on Projects; Learning is its own tab |
| **FIX-004** §A+§B, §C, §C dual-list, **+ redaction (b)** | ✅ | ✅ / ⚠️ see note | 🆕 **The last build is CLOSED.** Cloud half measured end-to-end through a real service; **browser half needs no drive** — §3 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 | **D unstarted** — item 5 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-006** — AC1–AC4 | ✅ | ✅ | **The Substring weighting is the one build left** — item 1 |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Seventeen closed outright.** ⚠️ **Count the names, don't copy a total** — this number moved twice in
one session.

✅ **No task has a built-but-undriven half.** True at s49 and still true.

⚠️ **FIX-004's browser half is deliberately not driven, and that is an argument rather than an
omission.** `createBlockConsole` returns **`console` itself** by identity when there is no sink — a
spec asserts `toBe(console)` — so a browser block program's `console.log` is the same call it always
was. There is no behaviour to drive. The cloud half is measured through a real `BackendService` over
real HTTP with a real `secrets.json`, which for a backend feature is the drive.

---

## 2. Gate readings

✅ **s51 took the seven marked.** This session changed **`noodl-runtime` source** (3 files) and
**`noodl-editor` renderer source** (`BenchRunner.ts`), so those are its own.

| Gate | Reading | When |
|---|---|---|
| **`noodl-runtime` jest (full)** | ✅ **137 suites / 2510 passed**, 1 suite + 13 skipped | ✅ **s51** |
| **`nodegx-backend` jest (full)** | ✅ **100 suites / 1085 passed** | ✅ **s51** |
| **`noodl-editor` `test:main` (full)** | ✅ **229 of 230 suites / 3557 tests** — the one failure is `bld-004/reasoningChannel`, **8/8 alone** | ✅ **s51** |
| **`noodl-viewer-react` jest** | ✅ **71 suites / 910 tests**, exit 0 | ✅ **s51** |
| **`cloud-runtime` jest** | ✅ 7 suites / 172 tests | ✅ **s51** |
| **root `npm run typecheck`** (the PR gate) | ✅ exit **0**, zero `error TS` | ✅ **s51** |
| **`lint:ci` ratchet** | ✅ exit 0, **876** against a 3916 baseline — s50's exact count | ✅ **s51** |
| `noodl-mcp` jest | ✅ 50 suites / 585 tests | s49 — inherited |
| `tests/validation/*` (7 suites) | ✅ 86 tests, ⚠️ under jest not jasmine | s49 — inherited |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ✅ **Every exit code above was read directly, not
through a pipe.**

⚠️ **`vfn-011/drift-gate.spec.ts` FAILED first and passes now** (13/13, including its three negative
controls). **That failure is the load-bearing gate reading of the session**, not a nuisance — see §3.

🔴 **Two exit codes were read wrong before being read right, both the documented way.** A
`TYPECHECK_EXIT=0` taken after a pipe reports `tail`; and a later `npm run typecheck` exited **1 with
zero `error TS`** purely because **the shell's cwd had persisted into a package directory two calls
earlier**. **Third session running for the cwd trap** — s49, s50, s51.

### 🔴 `test:ci` NOT taken — and the reason changed while it was being taken

1. First check: a peer's **full editor stack was live** — `scripts/start.ts` (pid 17319), **three**
   webpack processes, an Electron editor (pid 20580) on 9222. Six minutes later **all of it was
   gone**, which on its own looks like a clear run.
2. 🔴 **The tree was the real answer, not the process table.** A second `git status` immediately
   before the run showed peers holding **uncommitted `noodl-core-ui` source edits** — six modified,
   two new — and `noodl-mcp/src/catalog.ts` saved at **20:39:24**, *35 seconds* before the run would
   have started. `noodl-core-ui` is bundled into the renderer, so the reading would have been of a
   peer's working tree. **Check the tree twice; a teardown is not an all-clear.**

⚠️ **The one gap no gate taken here covers:** that the editor's **webpack** resolves `BenchRunner.ts`'s
new import of `@noodl/runtime/src/nodes/std-library/logic-builder-console`. The argument it is safe is
an existing working case — that file **already** statically imports `@noodl/runtime/src/blockrun` and
`.../logic-builder-io`, same prefix, the second from the same directory, and it is a static ES import
rather than a `require.resolve`. **A bundled build was still not run.** Cheap for the next session to
close in passing.

⚠️ **`packages/noodl-editor/tests/test-results.json` was deleted** in preparation for the run that was
then declined. Stale, a build artifact, regenerates. Nobody's reading was consumed.

---

## 3. What s51 did — FIX-004 redaction (b) (`3b54325f`)

**One new module, three call sites, and the fourth spelling of one list.**

- **`logic-builder-console.ts`** 🆕 — `createBlockConsole(sink, nodeId)`. Returns the **real global
  `console`** when there is no sink; otherwise a console whose five levelled methods write to the
  run's sink and whose other methods delegate to the real one.
- **`logic-builder.ts`** — `console` as the **11th** compile parameter, appended. The sink is read
  **per run** from `nodeScope.runContext`, the same two lines `log.ts:166` uses.
- **`logic-builder-probe.ts`** — `evaluateFragment`, the second runtime spelling. Its own comment
  demanded it: *"the same ten has to stay true."*
- **`BenchRunner.ts`** — the bench is a **third executor** of block programs.

🔴 **`modeHasDeclaredPorts`'s equivalent trap here: appending is load-bearing.** `console` is **last**
on purpose. Inserted anywhere earlier, every later argument shifts and every saved `generatedCode`
string reads the wrong one. There is a spec row and a mutant for exactly that.

### The measurement — the row that recorded the leak now records its absence

Through a real `BackendService` over real HTTP with a real `secrets.json`:

| | before | after |
|---|---|---|
| `a block-logged secret reaches stdout in the clear:` | **`true`** | ✅ **`false`** |

✅ **The absence has a firing signal beside it** — `toContain(REDACTED)` — because "the secret is
absent" also passes when the block printed **nothing at all**, which is what a broken console looks
like. ✅ **And the pre-existing control** (log the secret's *length*, 29) **still passes**, so the
change is attributable to the routing rather than to the wire dying.

### The four mutants

| mutant | result |
|---|---|
| **M1 — drop the `console` parameter** (revert the fix) | 🔴 runtime **3 of 13**; backend **`…in the clear: true`** |
| **M2 — `console` inserted BEFORE `__p`** — the positional near-miss | 🔴 **4 of 13**, incl. *"neither list has drifted"* |
| M3 — no-sink returns a forwarding shim | 🔴 **1 of 13** |
| M4 — `describeArgument` uses `String()` not JSON | 🔴 **1 of 13** |

✅ **Every mutant reported a real test count** (13, 6) — no `Tests: 0 total`. ⚠️ **M1's and M2's first
`APPLIED?` echo was broken by zsh globbing and printed `0`**; both were re-run with the check fixed
and the parameter list printed, because *"the edit changed the results"* is not evidence it was **the**
edit intended.

### ⚠️ What this changed that is not a bug

- Block lines now count against `MAX_LOG_LINES_PER_RUN`, as a `Log` node in a loop does.
- 🔴 **A block's `console.log` is now subject to the service log level.** At `silent` it produces
  nothing, where before it always printed. Consistent with the `Log` node and with the ruling's *"the
  same sink"*; the production default is `info` (`ops/logger.ts:54`).

---

## 4. What to do next and why

**Ordered by value, not cost.** The item with a live user waiting is still the repackage, which is
Richard's, not a build.

1. 🔴 **FIX-006 Substring weighting** — the one most likely to be got wrong. The rule is **not**
   "prefer nodes"; see §5.
2. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API.
3. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
4. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered.
5. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). The Script node gets *silence* where it used to get
  false advice — honest, but not the ruling's *"the node should teach"*. Needs the node's **real** port
  list, which lives behind `parser.getPorts()`, i.e. **running the author's code**. **Wants a task;
  needs a syntax-tree parse of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50). Same
  blocker, same fix.
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** FIX-023 removed the one crash that reached it. **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all** (peer, FIX-024): `eslintConfig` extends an
  uninstalled `react-app`, so every file in the package fails identically — confirmed against an
  untouched control. **Pre-existing and unowned.**

### How to start here

🔴 **Census before you build, whatever the task file says — and census the SPELLINGS, not just the
definition.** Three sessions running the scoping's list has been wrong: s49 found a second
normalisation boundary; s50 found two of four named surfaces needed no fixing and a third was never
named; **s51 found a list it had censused as one place written in four.** ✅ **`grep` for the
value/name across every package, not for the symbol in the file you are editing.**

🔴 **A green spec proves nothing until you have seen it fail — and a mutant that does not compile
grades nothing.** ✅ One shell call: apply, **announce that it applied**, run, restore from a
scratchpad backup, `diff` back. 🔴 **Check the mutant reported a real test count**, and 🔴 **check your
own announcement actually printed** — zsh ate two of s51's and printed `0` for an edit that had
applied.

🔴 **When a spec fails, ask whether its PREMISE expired before you weaken its assertion.** s51's four
presence failures were a comment's stated assumption going stale, not a broken feature. ⚠️ **And the
obvious repair can be a no-op**: `NODEGX_LOG_LEVEL` **beats** `logger.configure({level})`
(`ops/logger.ts:78`), so the env var must be deleted first — otherwise you get a green-looking call, a
silent logger, and the wrong conclusion.

🔴 **Check the exit code before reading the output, and never through a pipe** — and 🔴 **`cd` to the
repo root in the same call**, because the shell's cwd persists and a root script run from a package
directory exits 1 with nothing wrong. macOS has **no `timeout`**; a command that exits 127 looks
exactly like a well-behaved run.

⚠️ **`npm run dev:debug` needs `run_in_background`, not `nohup`** — attribution here is by PPID.

---

## 5. Rulings — what a builder must not get wrong

- 🔴 **FIX-006 Substring — "weight built-in nodes heavier" is only HALF the rule.** Richard's
  exception is load-bearing: *"unless the operation requires more complexity which could be easily
  rolled into a Function, otherwise you end up with function nodes connected to substring nodes
  connected to functions."* The failure being ruled against is **alternation**. Simple ⇒ the node;
  complex ⇒ **all of it in one Function**. ⚠️ **A rule that only pushes "use the node" manufactures
  exactly the chain this forbids.** Measure node choice **and** chain shape. ⚠️ n=5 cells are not a
  floor; re-run at n=10. ⚠️ **Coupling:** this belongs in FIX-021's user profile — **do not build it
  in a way that forecloses slices A/B.**
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` must stay LAST in all four parameter
  lists**; moving it shifts every earlier argument and breaks every saved `generatedCode`. 🔴 **Do not
  "tidy" the four spellings into one shared constant** — `BenchRunner.ts` states why: a shared
  constant could not detect the *runtime* being the side that changed, and the differential can.
  🔴 **`createBlockConsole` must keep returning `console` ITSELF when there is no sink**, not a
  forwarding shim; the browser claim is identity, and a shim passes every behavioural test while
  changing what devtools shows.
- ✅ **FIX-016 — the mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` must stay `true` for
  `'script'`** — message 6 is gated on it. 🔴 **The bar is silent in script mode, not empty-listed.**
  ⚠️ **AC1 as originally written — *"adding an output from the panel offers Signal at creation
  time"* — is still FALSE as built** (driven s26). Ruling 1 (s42) rejected the copy/default option
  (a) and asked for the diagnostic, which is built and driven. **Someone should decide whether AC1 is
  retired or still owed; s50 and s51 did not.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` is 2nd in `ALL_RULES` on purpose;
  `duplicateNodeId` must keep leading.** 🔴 **The diagnostic names the node and component IN THE
  MESSAGE, not only in `location`.**
- ✅ **FIX-008 C — BUILT s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose.** 🔴 **Do not re-open
  the scope question from the string.**
- ✅ **FIX-004 §C dual-list — BUILT s46, DRIVEN s48.** The seam fence is narrowed and mutant-checked;
  **do not widen it back.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **The argument lives on
  `ToolboxLabels.noodlVariables`; do not re-litigate it from `appConfig.ts`.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored, `CLAUDE.md` stays the signpost, human-authored first. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.
- ✅ **FIX-024 — CLOSED by a peer s51.** 🔴 **`'learn'` and `'learning'` are two different pages** —
  `'learn'` is POL-002's *retired* catalogue, still compiled and reachable from nothing. `isValidPageId`
  is the one place a **stored** string picks between them; **do not merge the ids.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE REPACKAGE — still the item with a live user impact.** Richard's `nodegx-puppy-test-3`
  resolves to `/Applications/NodeGX.app/…`, the **Aug-13** bundle. It will keep dying with
  `Unexpected failure: …'startsWith'` until the app is repackaged. **The fix is committed and driven;
  he cannot see it.**
- ⚠️ **`packages/noodl-mcp/dist/` is still pre-fix** — gitignored, and what *checkout-registered*
  servers load. 🔴 **A session that rebuilds it should announce that it did.**
- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **FIX-016 AC1 — retired or still owed?** See §5.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** ⚠️ Unlanded work on a PR-gated script is exactly what a sibling's `git add -A`
  sweeps. **Still uncommitted at s51 — nineteen sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Nineteen
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c` (the only typeless-node reproduction),
  `fix016-msg6-drive` (the only fixture with both JS node types in one component), and
  `fix004c-s48-drive`. ⚠️ **`fix016-s50-drive` is a scratch copy and can be deleted.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s49, s50
**and s51** each lost a call to a `cd` two commands earlier. s51's cost a typecheck reading that
exited 1 with zero errors.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s51 committed once, 8 files, two of them new in one chain.**
✅ **A peer committed `7b7a7784` mid-session and the separation was clean both ways** — verified by
`git log --name-only` on both commits, not by hoping. ✅ **Verify after the commit that the peers'
files are still there**, not just before.

⚠️ **This checkout is busy and peers save source constantly.** s51 watched a peer's whole editor stack
appear and vanish inside six minutes, and watched `noodl-core-ui` go from clean to eight files dirty
to committed. ✅ **Every CDP reader should return an explicit `{alive:…}`** — a dead instrument and a
genuine absence are the same string.

### 🔴 Peer etiquette

🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — s51 counted 22 and **zero
editors** on its first sweep; **attribute by PPID**, and filter `noodl-mcp.cjs` out by cmdline.
🔴 **Announce teardown to the FULL launch list.** 🔴 **Reply to a socket on its socket.** 🔴 **A peer's
teardown is not permission to run a suite — read the TREE.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — the watchdog runs the same sweep
with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ⚠️ **Compare pids, never
counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line; the headroom moves both ways and neither direction is
yours.** ✅ **The move whenever a new fact belongs to a section that already has a 📚 pointer: put it
in the POINTER FILE, which costs zero index budget.** ✅ **s51 added nothing to the index** — both its
traps went into pointer files that already had one.

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 through s51 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared seven sessions running. ✅ **s51 also ran `git diff --stat HEAD` on the file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
