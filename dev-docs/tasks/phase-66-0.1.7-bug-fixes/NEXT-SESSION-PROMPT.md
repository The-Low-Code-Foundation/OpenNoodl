# Phase 66 — next session

**Written 2026-08-17, session 53's brief, by session 52.** A rewrite, per §0. s52 took **item 1 —
FIX-006's Substring weighting — and closed the build**: censused, built, gated, mutated, measured at
n=10 on two axes, committed (`1d5daeb5`). One task, one commit.

✅ **FIX-006 has no open build left.** Seventeen tasks are closed outright; FIX-006 now joins
FIX-004 and FIX-016 as *built with nothing owed but a judgement*.

🔴 **s52's headline is that the shipped guidance had been quietly pushing work OUT of the node
library, and the block that fixes it moves the reported request from 0/10 to 8/10.** With the two
older blocks present in **both** arms, adding `NODES_BEFORE_CODE` took `Substring` from **0/10 to
8/10** on `fix006-string-math`, left the deliberately-complex `fix006-price-line` as a single
`JavaScriptFunction` **10/10 in both arms**, and produced **zero alternation in all 40 sessions**.
That last number is the one the ruling asked for: *"a rule that only pushes 'use the node' will
manufacture exactly the alternation this ruling exists to prevent."* It did not.

🔴 **A control-arm marker had stopped existing, and the check could only pass.** The harness verified
its `--code-guidance=off` subtraction against four distinctive strings. One — `Reach for the Script
node LAST` — **appears nowhere in the product**: s43's AC4 edit reworded that line (`82b33466`) and
did not touch the harness. Because the check only asked whether a marker **survived** the strip, a
marker that had stopped existing was silently satisfied. ✅ **Markers are now asserted present BEFORE
the strip as well as absent after** — and that immediately caught s52's own first marker for the new
block, a phrase that **falls across a line break** in hard-wrapped copy and is therefore a substring
of nothing.

🔴 **The grader punished the behaviour the ruling asks for, and the first reading was wrong.** It
scored an `Expression` node as a JavaScript body — an Expression holds *one expression* and can
contain neither `const` nor `var` — so the arm that reached for `Substring` → `Expression` read as
**1/10 "const/let" against the control's 4/10**, which looks like the fix making the code worse. The
rate is 1/1 and 4/4 once the denominator is the runs that actually wrote a body.

🔴 **Every ruling and every measurement is in its own task file.** §4 here is a work order, not the
source of truth. FIX-006's full write-up — both tables, the two instrument repairs, the mutant that
passed by editing a comment — is at the foot of its own file.

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
| **FIX-001 / 002 / 003 / 005 / 007 / 009 / 010 / 011 / 012 / 014 / 017 / 018 / 019 / 020 / 023 / 024** | ✅ | ✅ | **CLOSED** — sixteen tasks |
| **FIX-004** §A+§B, §C, §C dual-list, + redaction (b) | ✅ | ✅ / ⚠️ | **No open build.** Browser half needs no drive — see s51's note, kept in §5 |
| **FIX-016** §2, §3, §3c, ruling 1, + the mining slice | ✅ | ✅ s50 | **No open build.** ⚠️ **AC1 still false as built** — §5 |
| **FIX-006** — AC1–AC4 **+ the Substring weighting** 🆕 | ✅ | ✅ | 🆕 **The last build is CLOSED** (s52, `1d5daeb5`). ⚠️ Two judgements left, not builds — §4 |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 | **D unstarted** — item 4 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-022** | ✅ | ✅ | Re-graded s43. **No rule written yet** — item 1 |
| **FIX-013** | 📋 | — | Ruling 1 = **(c)**. Rulings 2–4 still open |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Seventeen closed outright.** ⚠️ **Count the names, don't copy a total** — this number has moved
twice in one session before.

✅ **No task has a built-but-undriven half.** True at s49 and still true.

⚠️ **FIX-006's weighting is measured rather than driven, and that is the right instrument.** The
deliverable is prompt copy; what it changes is what a model authors, which is a distribution and not
a screenshot. 40 real authoring sessions through the real `AuthoringSession`, the real context
builder and the real validation gate **is** the drive for this one. What it is *not* is a reading
taken inside a running editor — see §2's gap.

---

## 2. Gate readings

✅ **s52 took the five marked.** This session changed **`noodl-editor` renderer source** (two prompt
modules), the **editor's tests tsconfig**, a **`noodl-mcp` test**, and the measurement harness.

| Gate | Reading | When |
|---|---|---|
| **root `npm run typecheck`** (the PR gate) | ✅ exit **0**, zero `error TS` | ✅ **s52** |
| **`noodl-editor` `test:main` (full)** | ✅ **232 suites / 3578 tests**, exit 0, **no failures** — `bld-004/reasoningChannel` passes again | ✅ **s52** |
| **`noodl-mcp` jest (full)** | ✅ **52 suites / 613 tests**, exit 0 | ✅ **s52** |
| **`lint:ci` ratchet** | ✅ exit 0, **876** against a 3916 baseline — s50's and s51's exact count | ✅ **s52** |
| **`fix006-grade.mjs --self-test`** 🆕 | ✅ **7/7**; collapsing its two node classes kills **5 of 7** | ✅ **s52** |
| `noodl-runtime` jest | ✅ 137 suites / 2510 | s51 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s51 — inherited |
| `noodl-viewer-react` jest | ✅ 71 suites / 910 | s51 — inherited |
| `cloud-runtime` jest | ✅ 7 suites / 172 | s51 — inherited |
| `tests/validation/*` (7 suites) | ✅ 86 tests, ⚠️ under jest not jasmine | s49 — inherited |
| `test:ci` (jasmine) | ✅ 2843 / 6 @ 39393, six by name | run **2026-08-16 21:53:37** — **inherited** |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ✅ **Every exit code above was read directly, not
through a pipe.** ⚠️ **`test:main` was 229/230 in s51's file and is 232/232 now** — peers added
suites and `bld-004` recovered. **Never carry a count forward.**

### 🔴 `test:ci` NOT taken, and this time nothing forced the choice

The checkout was idle both ways: **no `scripts/start.ts`, no webpack, no Electron editor** — s52's
first sweep counted 22 `electron/dist` matches and **every one an MCP server**, attributed by
cmdline. The tree, however, carried peers' uncommitted work throughout (`scripts/library/check.ts`,
two `dev-docs` notes, and a `phase-69` note that **appeared mid-session**), so a jasmine reading
would still have been of somebody's working tree. **It was skipped on the tree, not on the process
table** — the distinction s51 paid for.

⚠️ **The one gap no gate here covers, and it is now two sessions old:** nobody has run a **bundled**
editor build since s51's `BenchRunner.ts` import landed, and s52's prompt-module change is
renderer-side too. Both are plain static imports inside `src/editor`, which webpack has always
resolved, so the risk is low and the check is cheap. **Someone should run it in passing.**

⚠️ **Not re-measured on the editor's wire.** s38 read `systemPrompt()` live in a renderer; s52 read
the same **pure function** in the plain-Node runner, which is the same string but not the same claim
about a running editor. The MCP half **was** taken on the wire, over real stdio.

---

## 3. What s52 did — FIX-006's Substring weighting (`1d5daeb5`)

**One new prompt block, a second control arm, a grader, and a spec for copy that nothing graded.**

- **`NODES_BEFORE_CODE`** 🆕 in `traps.ts` — both halves of the ruling, the forbidden shape named in
  the concrete (`JavaScriptFunction` → `Substring` → `JavaScriptFunction`), and the unit of the
  decision made explicit: **per calculation**, not per project.
- **`--node-weighting=off`** — a second control arm that subtracts **this block alone**. s39's
  control removed the two older blocks *together*, so it could say the pair moved `Substring` from
  10/10 to 3/10 and **nothing about which block did it**.
- **`fix006-grade.mjs`** 🆕 — grades node choice **and** chain shape (class crossings along a wire
  path), self-tests against seven graphs whose answer is known, and derives its node classes from
  the shipped catalog rather than a list typed into it.
- **`fix006-price-line`** 🆕 in the corpus — one calculation with a simple head and a body that needs
  real code. The instrument for the shape the other prompt is too small to show.

### The measurement

n=10 per arm, **arms interleaved**, `claude-sonnet-5`, effort `low`. 40 sessions, all authored and
valid on first submit. Wire: **15,475 chars ON, 14,549 OFF**.

| `fix006-string-math` (simple) | ON | OFF |
|---|---|---|
| reached for `Substring` | ✅ **8/10** | **0/10** |
| alternates (≥2 crossings) | **0/10** | **0/10** |

| `fix006-price-line` (complex) | ON | OFF |
|---|---|---|
| a single `JavaScriptFunction` | **10/10** | **10/10** |
| alternates | **0/10** | **0/10** |

⚠️ **The second table does NOT show the exception clause preventing alternation** — the hazard never
appeared in the control either, so the clause is **unfalsified, not proven necessary**. What is
measured is that the weighting did not *manufacture* it.

**Cost: $0.89 / 42 sessions.** ✅ **Both arms archived** in `measurements/2026-08-17-fix006-weighting-{on,off}-…-n10.jsonl`, because s39's files were not and its A/B can no longer be re-read.

---

## 4. What to do next and why

**Ordered by value, not cost.** The item with a live user waiting is still the repackage, which is
Richard's, not a build.

1. 🔴 **FIX-022 — add the reuse-available cell** before writing any rule. ~$0.10 in API. **Now the
   cheapest open build in the phase.**
2. 🔴 **FIX-013** — build against ruling 1(c). ⚠️ Rulings 2–4 still owed.
3. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered. ⚠️ **FIX-006's
   weighting is exactly the kind of rule that belongs in a user profile** — do not build slices A/B
   in a way that cannot express it.
4. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.
5. ⚠️ **A bundled editor build**, in passing — §2.

**Do not start** FIX-015 here — it is its own phase.

### Carried, uncosted

- 🔴 **A bar that teaches `define()`** (s50). Needs the node's **real** port list, behind
  `parser.getPorts()`, i.e. **running the author's code**. **Wants a task; needs a syntax-tree parse
  of `define()`.**
- ⚠️ **A Script node's `define()`-declared ports are invisible to every editor surface** (s50). Same
  blocker, same fix.
- 🔴 **The `io-error: Unexpected failure: ${err.message}` wrapper names neither the tool nor the
  project.** **Wants its own task.**
- ⚠️ **A missing `id` has the identical shape to FIX-023's missing `type` and is unguarded.**
- ⚠️ **`noodl-core-ui` cannot be eslinted at all**: `eslintConfig` extends an uninstalled
  `react-app`, so every file fails identically. **Pre-existing and unowned.**

### How to start here

🔴 **Census before you build, and census the SPELLINGS.** Four sessions running the scoping's list
has been wrong. ✅ **`grep` for the value/name across every package, not for the symbol in the file
you are editing.** ⚠️ **And quote your globs** — `--include=*.ts` unquoted is eaten by zsh and the
grep never runs.

🔴 **A green spec proves nothing until you have seen it fail — and check WHICH edit your mutant
made.** s52's fake-node mutant "passed", because `perl` hit the identical phrase in the **doc comment
above** the constant rather than the constant, and the announce printed a truthful, useless `1`.
✅ One shell call: apply, **print the changed line, not just a count**, run, restore, `diff` back.

🔴 **A marker, a selector or a predicate can stop existing.** Two of s52's three findings are this
one shape: a check that only asks "did X survive?" is satisfied forever once X is gone, and a phrase
that spans a line break in hard-wrapped copy is a substring of nothing. ✅ **Assert the
known-present half too.**

🔴 **Ask what a metric does to the behaviour you WANT.** s52's grader scored the ruling's preferred
shape as un-modern JavaScript, because an `Expression` has no `const` in it and never could.

🔴 **Check the exit code before reading the output, never through a pipe** — and 🔴 **`cd` to the
repo root in the same call**, because the shell's cwd persists. s52 nearly quoted a package-level
`npm run typecheck` as the root PR gate; the cheap defence is to `pwd` in the same command and read
the script name back out of the log. macOS has **no `timeout`**; a command exiting 127 looks like a
well-behaved run.

⚠️ **A foreground `sleep` is refused by the harness.** Poll with a backgrounded `until` loop.

⚠️ **`npm run dev:debug` needs `run_in_background`, not `nohup`** — attribution here is by PPID.

---

## 5. Rulings — what a builder must not get wrong

- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **The rule is not "prefer nodes",
  and `NODES_BEFORE_CODE` must keep BOTH halves.** Simple whole step ⇒ the built-in node; needs code
  at all ⇒ **all of it in one code node**. Deleting the exception re-opens the alternation the ruling
  exists to forbid, and the node-choice criterion would score that as a win. 🔴 **Keep it a separate
  export from `THREE_WAYS_TO_COMPUTE`** — merging them destroys the only arm that can attribute a
  result to this ruling. ⚠️ **Two judgements are left, neither a build:** whether `Substring` →
  `Expression` (one crossing, 8/10 of the ON arm) is the shape Richard wants for a request that
  small, and whether the exception clause is worth a request that actually provokes alternation.
- ✅ **FIX-006 AC4 — the id is in the prompt and now graded**, in `promptGuidance.test.ts` and over
  MCP stdio. 🔴 **`Javascript2` must keep leading the Script paragraph**; `traps.ts:61-63` states the
  rule the block is checked against.
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` must stay LAST in all four parameter
  lists.** 🔴 **Do not "tidy" the four spellings into one shared constant** — `BenchRunner.ts` states
  why. 🔴 **`createBlockConsole` must keep returning `console` ITSELF when there is no sink.**
- ✅ **FIX-016 — the mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` must stay `true` for
  `'script'`.** 🔴 **The bar is silent in script mode, not empty-listed.** ⚠️ **AC1 as originally
  written is still FALSE as built** (driven s26). **Someone should decide whether AC1 is retired or
  still owed; s50, s51 and s52 did not.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` is 2nd in `ALL_RULES` on purpose;
  `duplicateNodeId` must keep leading.** 🔴 **The diagnostic names the node and component IN THE
  MESSAGE.**
- ✅ **FIX-008 C — BUILT s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **Do not re-litigate it from
  `appConfig.ts`.**
- ✅ **FIX-013 ruling 1 → (c), shim serves zero rows.** ⚠️ The Fix direction **hard-codes
  `useSampleData: true`** and must stop. 🔴 **Rulings 2, 3, 4 still owed.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE.** One cell still missing before a rule is safe.
- ✅ **FIX-024 — CLOSED by a peer s51.** 🔴 **`'learn'` and `'learning'` are two different pages** —
  **do not merge the ids.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. **The fix is committed and driven; he cannot
  see it.**
- ⚠️ **`packages/noodl-mcp/dist/` is still pre-fix** — gitignored, and what *checkout-registered*
  servers load. 🔴 **A session that rebuilds it should announce that it did.** ⚠️ **This now also
  means external agents on a registered server are NOT yet getting `NODES BEFORE CODE`**, even
  though `rejectionExamples.test.ts` proves the source serves it.
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want for the reported request?** §5.
- 🔴 **FIX-013 rulings 2, 3, 4** · 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6.**
- 🔴 **FIX-016 AC1 — retired or still owed?** See §5.
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** **Still uncommitted at s52 — twenty sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty sessions
  have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ⚠️ **`fix016-s50-drive` is a scratch copy and can be deleted.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s49,
s50, s51 **and s52** each lost a call to it.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s52 committed once, 11 files, four of them new in one
chain**, and verified with `git log -1 --name-only` that the peers' five uncommitted paths were still
there afterwards.

⚠️ **This checkout is busy.** A peer's `phase-69` note appeared mid-session. ✅ **Every CDP reader
should return an explicit `{alive:…}`** — a dead instrument and a genuine absence are the same
string.

### 🔴 Peer etiquette

🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — s52 counted 22 and **zero
editors**; **attribute by PPID and cmdline**. 🔴 **Announce teardown to the FULL launch list.**
🔴 **Reply to a socket on its socket.** 🔴 **A peer's teardown is not permission to run a suite —
read the TREE.**

### Teardown

**Use `dev:stop`.** 🔴 Killing your launcher pid is **not** gentler — the watchdog runs the same
sweep with `protectAncestors: false`. 🔴 **`pkill` never reaches `sweep()`.** ⚠️ **Compare pids,
never counts.** ⚠️ The launcher exiting **144** is `dev:stop` reaping it, not a failure.

### 🔴 Measuring the memory index

**`node`, never `python`.** Budget **17,510 UTF-16**.
🔴 **Take your own reading before adding a line; the headroom moves both ways and neither direction
is yours.** ✅ **The move whenever a new fact belongs to a section that already has a 📚 pointer: put
it in the POINTER FILE, which costs zero index budget.**

🔴 **The next session that needs an index line MUST collapse something first.** Promote traps out
before collapsing.

🔴 **It moves while you read it** — `grep -rl` the memory dir before writing anything up as new.

```
node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' \
  ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md
```

### 🔴 Re-read this file immediately before rewriting it

s44 overwrote a peer's 29 lines by rewriting from its context copy; s45 was saved by re-reading. ✅
**s46 through s52 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared eight sessions running. ✅ **s52 also ran `git diff --stat HEAD` on the file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
