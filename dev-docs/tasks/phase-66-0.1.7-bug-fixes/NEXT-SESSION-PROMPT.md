# Phase 66 — next session

**Written 2026-08-17, session 55's brief, by session 54.** A rewrite, per §0. s54 took **item 1 —
FIX-013 — and found that the ruling it was told to build against named a state nothing in the
product could express** (`8216037d`). One task, one commit.

🔴 **s54's headline: ruling 1(c) was answerable but not buildable, and both earlier readings of the
task pointed at the flag that does the opposite.** *"The shim serves zero rows"* was to be reached
by `useSampleData: false`. That flag **uninstalls the network shim** and points the preview at the
project's **real backend** — it is AC3's violation, not its implementation.

🔴 **And an empty dataset is not an empty sandbox.** `SandboxStore.list()` invents **five** records
for any class it has never heard of, on purpose, so a preview never strands a graph. Shipping
`{ classes: {} }` serves five synthesized rows *per class queried*, not zero. ✅ **The behaviour the
ruling rules against was already pinned by a spec** — `sandbox-store.test.ts:34-39` — which is how
it was found: by reading the guard before writing a new one.

✅ **The third state is now built, specced and mutant-verified — and switched on nowhere.**
`buildBenchExport` is untouched deliberately; §3 says why. The UI half is the open work.

⚠️ **A peer is LIVE on this checkout** and was not at s53's finish — see §2. **Its uncommitted
`NodeLibraryImporter.ts` edit landed 11 minutes after s54's test bundle**, so s54's `test:ci` is
clean of it, but s55 must re-check rather than assume.

🔴 **Every ruling and every measurement is in its own task file.** §4 here is a work order, not the
source of truth. FIX-013's full write-up — the two-route table, what the flip will cost, and the
non-destructive branch of each open ruling — is at the foot of its own file.

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
| **FIX-006** — AC1–AC4 + the Substring weighting | ✅ | ✅ | **No open build** (s52). Two judgements left — §5 |
| **FIX-022** — re-grade + the reuse cell | ✅ | ✅ | **No open build** (s53). ⚠️ The §7 ruling is the only thing owed |
| **FIX-013** — the empty-state sandbox 🆕 | ⚠️ **data layer only** | — | 🆕 **`8216037d`.** The capability 1(c) needs exists and is proven; **nothing calls it yet**. The UI slice is item 1 |
| **FIX-008** A, B, C, E | ✅ | ✅ C driven s48 | **D unstarted** — item 3 |
| **FIX-021** slice 0 + wizard location | ✅ | ✅ s44 3/3 | **Slices A/B are the open work** |
| **FIX-015** | 📋 | — | **Green-lit as its own phase.** Not a P66 build |

**Seventeen closed outright.** ⚠️ **Count the names, don't copy a total** — this number has moved
twice in one session before.

🔴 **FIX-013 is the phase's first built-but-uncalled half, and that is deliberate rather than
unfinished.** See §3 before "finishing" it in the obvious direction.

---

## 2. Gate readings

✅ **s54 took the six marked.** This session changed **`noodl-runtime` sandbox source** (2 modules),
**`noodl-editor` `src/…/authoring/sandboxData.ts`**, and two spec files. **Editor source changed ⇒
`test:ci` was required and was taken** — s53's "no editor source" reasoning does **not** transfer.

| Gate | Reading | When |
|---|---|---|
| **root `npm run typecheck`** (the PR gate) | ✅ exit **0**, zero `error TS` | ✅ **s54** |
| **`noodl-runtime` jest (full)** | ✅ **137 suites / 2515**, exit 0 — s51's 2510 plus this session's 5 | ✅ **s54** |
| **`test:ci` (jasmine)** | ✅ **2849 specs / 6 failures** @ 39393 — **the same six by name** | ✅ **s54**, bundle **2026-08-17 22:55:06** |
| **`lint:ci` ratchet** | ✅ exit 0, **877** against a 3916 baseline | ✅ **s54** |
| **`noodl-editor` `test:main` (full)** | ⚠️ **234 suites / 3601**, **2 failed** — both **pass in isolation** | ✅ **s54** |
| **runtime + editor sandbox specs, mutant-verified** | ✅ 5 + 6 new, all green; mutant fails 2 | ✅ **s54** |
| `noodl-mcp` jest | ✅ 52 suites / 613 | s52 — inherited |
| `nodegx-backend` jest | ✅ 100 suites / 1085 | s51 — inherited |
| `noodl-viewer-react` jest | ✅ 71 suites / 910 | s51 — inherited |
| `cloud-runtime` jest | ✅ 7 suites / 172 | s51 — inherited |
| `library:check` | ✅ 58/58 | s30 — inherited |

⚠️ **Re-measure before quoting any of these.** ✅ **Every exit code above was read from a file after
`echo $?`, never through a pipe.**

### 🔴 Three readings that will mislead you if you carry them forward

- 🔴 **`lint:ci` is 877, not the 876 three handovers have quoted.** s54 A/B'd it: reverting this
  session's only `src` file to HEAD and re-running gives **877 as well**. The drift is **not this
  session's and not a regression** — the ratchet targets only `packages/noodl-editor/src`
  (`.eslint-baseline.json`), so no spec file can move it. ✅ **The gate passes; the number is just
  one higher than the handovers say.**
- 🔴 **`test:main`'s 2 failures are timing flakes under full-suite load, not breakage.**
  `tests-main/relay-auth.test.js` ("relays between authorised peers exactly as before") and
  `tests-unit/bld-004/reasoningChannel.test.ts` ("a long silent think is not a stall") — **both are
  stall/timeout specs, and both pass when run alone.** Neither shares a module with anything s54
  touched.
- 🔴 **`test:ci` exited 0 with 6 failures.** The exit code is worthless in **both** directions here;
  the *count* is the readout. ⚠️ **`test-results.json` did not exist before or after** — do not
  build an mtime check on it in `packages/noodl-editor` without first finding where it is written.

### 🔴 A peer is live, and it was not at s53's finish

Newly present since this session started, all **uncommitted**:

```
 M packages/noodl-editor/src/editor/src/models/nodelibrary/NodeLibraryImporter.ts   ← SOURCE EDIT
 M dev-docs/tasks/phase-69-…/CN-014-THE-DEV-LOOP.md,  …/TASKS.md
?? packages/noodl-editor/tests-unit/cn-014/            ← the +1 suite in test:main
?? dev-docs/tasks/phase-69-…/notes/cn-014-ac1-drive.md
```

✅ **s54's `test:ci` is clean of it, and that is measured rather than assumed**: the test bundle was
written **22:55:06**, `NodeLibraryImporter.ts` was touched **23:06:33** and `tests-unit/cn-014`
**23:04:38** — both *after*. 🔴 **`test:main`'s 234 suites / 3601 tests include the peer's CN-014
suite**, which is where the +1 suite and most of the +8 tests come from — **not** from s54, which
added nothing to `tests-main`/`tests-unit`.

⚠️ **s54 committed 6 pathspecs and verified afterwards that all nine peer paths were still
uncommitted.** Do the same.

⚠️ **The bundled-editor-build gap is now four sessions old.** Nobody has run one since s51's
`BenchRunner.ts` import landed. s54 adds nothing to it (`noodl-runtime` source is bundled *into* the
viewer, and `test:ci` bundles the editor — but a **packaged** build is still unrun).

---

## 3. What s54 did — FIX-013's empty state (`8216037d`)

**A census that killed the plan, then the capability the ruling actually needed.**

- **`SandboxDataset.synthesizeMissing?: boolean`** 🆕 (`noodl-runtime/src/sandbox/types.ts`).
  Read as `dataset?.synthesizeMissing !== false`, so `undefined`, `true` **and no dataset at all**
  are every caller that has never heard of it.
- **`SandboxStore.list()`** honours it — and **still caches the empty array**. 🔴 **An empty-state
  sandbox is still a writable one**: the list a `create` pushes into must be the list the next
  `query` reads, or a form that saves shows nothing afterwards.
- **`buildSandboxDataset({ emptyState: true })`** 🆕 (`sandboxData.ts`). The graph walk still runs
  and the class list still ships — **named, and empty**, because a *named* class is what stops the
  store inventing it. Drops `unknownShape` (a caveat about blank rows is noise when there are no
  rows) and says the emptiness is the point: `No sample data — Books served empty, signed in as a
  sample user`. **That is ruling 1's "take (b)'s one-line caption anyway", taken.**

### 🔴 Why `buildBenchExport` was left alone

**Flipping the bench without deleting the toolbar in the same commit makes the reported bug
universal.** The Data button is gated on `Boolean(result?.dataset)`, so an empty dataset still
offers a Data panel with nothing in it — on **every** benched component, not just `CategoryCard`.
That is `workbench-1.png`, spread wider. ⚠️ **The flip and the UI deletion are one commit.**

### The guard

**11 specs, both suites led by the CONTROL that made the mode necessary** — the runtime control
asserts 5 rows on the same class name the new spec asserts 0 on, so the pair can only both pass if
the flag is doing the work. ✅ **Mutant-verified**: forcing `list()` back to always-synthesize fails
**2 of 5** new runtime specs while the CONTROL keeps passing, which is the right shape — the mutant
restores exactly what the control pins. ✅ **The mutant was diffed against a saved copy, not
`git diff`, and the changed line printed** (`store.ts:176`).

---

## 4. What to do next and why

**Ordered by value, not cost.** ⚠️ **Items needing API calls are blocked on credit** — see §5.

1. 🔴 **FIX-013's UI slice** — the flip plus the toolbar/data-editor deletion plus the summary
   relocation, **in one commit**, then a drive for AC1/AC2. **The data layer is done and waiting.**
   ⚠️ **Read FIX-013's last section first**: it lists the two `component-bench.test.ts` specs the
   flip invalidates (neither is a defect) and the non-destructive branch of rulings 3 and 4. **Needs
   no API credit.**
2. 🔴 **FIX-021 slices A/B** — the user profile. Big; three of six questions answered. ⚠️ **FIX-006's
   weighting and FIX-022's reuse axis are both exactly the kind of rule that belongs in a user
   profile** — do not build slices A/B in a way that cannot express them.
3. 🔴 **FIX-008 D** — `open_project(dir)` / an emitted registration line. Removes the class.
4. ⚠️ **A bundled/packaged editor build**, in passing — §2.

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

🔴 **Census before you build, and read the GUARD before you write one.** Six sessions running, the
scoping's premise has been wrong. ✅ **s54's whole finding came from opening `sandbox-store.test.ts`
before adding to it** — the spec that pins "invents 5 records" is three lines long and settles a
ruling two sessions had reasoned about abstractly. **A behaviour you assume is absent is worth one
`grep` of the suite that would defend it.**

🔴 **A ruling can name a state the product cannot express, and nothing will tell you.** 1(c) was
ruled, recorded, cross-referenced and scheduled; it was never *checked against the switch it would
have to flip*. ✅ **Before building to a ruling, find the line of code that would change** — here,
`if (sandbox.useSampleData) startSandbox()` in `noodl-viewer-react.js:66`, eight words that
invalidate two sessions of planning.

🔴 **A green spec proves nothing until you have seen it fail — and PROVE which edit your mutant
made.** ✅ **`diff` against a saved copy, not `git diff`, and assert the file actually changed.**

🔴 **Check the exit code before reading the output, never through a pipe** — ⚠️ **and
`${PIPESTATUS[0]}` is empty in zsh** (it is `$pipestatus`). ✅ **Redirect to a file, `echo $?`, then
read the file.** 🔴 **macOS has no `timeout`** — s54 lost a call to it and got **127**, which looks
exactly like a well-behaved run.

🔴 **`cd` to the repo root in the same call, and CHECK WHICH `package.json` a script is in.** s54
lost a call to running `lint:ci` from `packages/noodl-editor` — it is a **root** script — and a
`grep` of `package.json` from the wrong cwd confirmed the wrong answer first.

⚠️ **A foreground `sleep` is refused by the harness.** Poll with a backgrounded `until` loop.
⚠️ **`test:ci` exceeds the 600s foreground timeout** and is moved to the background; that is normal,
and the notification is the completion signal.

---

## 5. Rulings — what a builder must not get wrong

- ✅ **FIX-013 ruling 1 → (c), and the DATA LAYER IS BUILT (s54).** 🔴 **`useSampleData` is not the
  switch and never was** — it uninstalls the shim and reaches the real backend. 🔴 **`emptyState`
  must keep shipping the class list NAMED**; an empty `classes` map is the one shape that defeats
  the whole mode, because the store then invents every class. 🔴 **`synthesizeMissing` must keep
  defaulting to `true`** — the AI preview and every existing export depend on it. 🔴 **`list()` must
  keep caching the empty array**, or writes stop working. ⚠️ **Rulings 2, 3, 4 still open**, but
  **3 and 4 each have a branch that deletes nothing** — FIX-013's own file states both.
- ✅ **FIX-022 — the reuse cell BUILT + MEASURED s53.** 🔴 **`minPlacementSites` must stay OFF for
  `trivial`, `small-logic` and `multi-section`.** 🔴 **The placement metric must keep BOTH evidence
  paths** — `instantiates` alone misses 6 of 11 known-real placements. 🔴 **The cell is a REGRESSION
  detector, not evidence of improvement.**
- ✅ **FIX-022 — no numeric floor; the axis is REUSE** (s42). 🔴 **Any rule must be stated on the
  reuse axis, never on node count.**
- ✅ **FIX-006 — the Substring weighting BUILT + MEASURED s52.** 🔴 **The rule is not "prefer nodes",
  and `NODES_BEFORE_CODE` must keep BOTH halves.** 🔴 **Keep it a separate export from
  `THREE_WAYS_TO_COMPUTE`.** ⚠️ **Two judgements left, neither a build.**
- ✅ **FIX-006 AC4 — the id is in the prompt and now graded.** 🔴 **`Javascript2` must keep leading the
  Script paragraph**; `traps.ts:61-63` states the rule the block is checked against.
- ✅ **FIX-004 — redaction (b) CLOSED s51.** 🔴 **`console` must stay LAST in all four parameter
  lists.** 🔴 **Do not "tidy" the four spellings into one shared constant.** 🔴 **`createBlockConsole`
  must keep returning `console` ITSELF when there is no sink.**
- ✅ **FIX-016 — the mining slice CLOSED s50.** 🔴 **`modeHasDeclaredPorts` must stay `true` for
  `'script'`.** 🔴 **The bar is silent in script mode, not empty-listed.** ⚠️ **AC1 as originally
  written is still FALSE as built** (driven s26). **Someone should decide whether AC1 is retired or
  still owed; s50 through s54 did not.**
- ✅ **FIX-023 — CLOSED s49.** 🔴 **`malformedNode` is 2nd in `ALL_RULES` on purpose;
  `duplicateNodeId` must keep leading.** 🔴 **The diagnostic names the node and component IN THE
  MESSAGE.**
- ✅ **FIX-008 C — BUILT s47, DRIVEN s48.** 🔴 **Observe stays `user` on purpose.**
- ✅ **FIX-005 — CLOSED s48.** The rename reversed VFN-012 knowingly. **Do not re-litigate it from
  `appConfig.ts`.**
- ✅ **FIX-021 — wizard location (B) BUILT + DRIVEN. Slices A/B GREEN as a USER PROFILE**, per-user
  and gitignored. 🔴 **Q2, Q5, Q6 still open.**
- ✅ **FIX-024 — CLOSED by a peer s51.** 🔴 **`'learn'` and `'learning'` are two different pages** —
  **do not merge the ids.**

### 🔴 Two things that are NEW TASKS, not P66 items

- 🔴 **Blockly should enumerate declared globals as draggable blocks** — App Variables, Objects,
  Arrays, plus `Function Variables`, in their own drawer. ✅ **Blockly's own native model.**
- 🔴 **FIX-015 → its own phase, green-lit.** ⚠️ **Slice 1 is "build and test the panel", not "un-gate
  it"** — expect the first drive to return a bug list.

### Still owed by Richard

- 🔴 **THE ANTHROPIC CREDIT BALANCE IS EXHAUSTED.** Three of s53's 20 sessions died on it, and
  **every measurement harness in this phase is blocked** — FIX-006's, FIX-022's, and any A/B a future
  ruling needs. **`.env`, the account behind `ANTHROPIC_API_KEY`.** ⚠️ **s54 needed none of it**, and
  neither does item 1.
- 🔴 **THE REPACKAGE — still the item with a live user impact.** `nodegx-puppy-test-3` resolves to
  `/Applications/NodeGX.app/…`, the **Aug-13** bundle. **The fix is committed and driven; he cannot
  see it.**
- ⚠️ **`packages/noodl-mcp/dist/` is still pre-fix** — gitignored, and what *checkout-registered*
  servers load. 🔴 **A session that rebuilds it should announce that it did.**
- 🔴 **FIX-013 rulings 2, 3, 4.** ⚠️ **Neither 3 nor 4 blocks item 1** if its non-destructive branch
  is taken — FIX-013's file names both, and says so explicitly so the build can proceed.
- 🔴 **FIX-022 §7 — (a) accept, (b) a rule on the reuse axis, or (c) `planAdvisories`?** Single-use
  factoring runs at **5/10 and 6/10** where reuse is impossible and **0/17** where it is available.
- 🔴 **FIX-006 — is `Substring` → `Expression` the shape you want for the reported request?**
- 🔴 **FIX-015's eight** · 🔴 **FIX-021's Q2, Q5, Q6** · 🔴 **FIX-016 AC1 — retired or still owed?**
- 🔴 **`scripts/library/check.ts` — LAND IT.** Attributed (LBR-002), verified, gate passes 58/58.
  **Phase 65's work.** **Still uncommitted at s54 — twenty-two sessions.**
- 🔴 **`dev-docs/tasks/phase-23-visual-refresh/corpus/run.sh:17`** — an **executable** script whose
  `pkill` pattern matches MCP servers, **0 editors**, and never reaches `sweep()`. **Twenty-two
  sessions have declined.**
- ⚠️ `fix021-drive-ai` / `fix021-drive-plain` still point at a scratchpad path that will be cleaned.
- ⚠️ **Fixtures kept on purpose:** `puppy-test-3-fix008c`, `fix016-msg6-drive`, `fix004c-s48-drive`.
  ⚠️ **`fix016-s50-drive` is a scratch copy and can be deleted.**

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; **absolute paths in every Bash call** — the phase
directory is `phase-66-0.1.7-bug-fixes`. ⚠️ **The shell's cwd persists between Bash calls**; s49
through s54 have each lost at least one call to it, and s54 lost two — one to a missing `timeout`
and one to running a **root** script from a package directory.

🔴 **`git commit <pathspecs>` — never `git add` at all.** The only exception is a **new** file: `add`
and commit in the **same** command. ✅ **s54 committed once, 6 files, all modifications**, and
verified with `git status --short` afterwards that the peer's **nine** uncommitted paths were still
there.

🔴 **This checkout is BUSY — a peer is actively editing editor source.** §2 lists its files. ✅ **Every
CDP reader should return an explicit `{alive:…}`** — a dead instrument and a genuine absence are the
same string.

### 🔴 Peer etiquette

🔴 **All `electron/dist` matches on an idle checkout are MCP servers** — s54 counted 22 and **zero
editors**; **attribute by PPID and cmdline**. 🔴 **Announce teardown to the FULL launch list.**
🔴 **Reply to a socket on its socket.** 🔴 **A peer's teardown is not permission to run a suite —
read the TREE.** ⚠️ **And read it TWICE**: s54's tree gained five peer paths between its first and
last `git status`.

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
**s46 through s54 all checked `git log -1 --stat` plus the mtime before rewriting** — the check has
now paid or cleared ten sessions running. ✅ **s54 also ran `git diff --stat HEAD` on the file
immediately before writing**, which is the cheapest proof that the context copy is current.

✅ **Before rewriting any shared document, `git log -1 --stat` it and re-read it.** A whole-file
overwrite is the one edit that cannot conflict — git accepts it happily, and the loss is invisible in
the diff you are looking at.
