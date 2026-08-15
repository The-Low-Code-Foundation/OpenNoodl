# Phase 66 — next session

**Written 2026-08-15, session 21.** Three things landed: the **`test:ci` floor is re-banked**
(2843 / 6 at seed 39393, unchanged), **FIX-017 §A is built and committed** (`9e8b3198`, not yet
driven), and — unplanned — **a live defect in the dev tooling was found, fixed and verified**
(`2b758a87`).

🔴 **The finding that outlives this phase: `d061bc6e` never worked.** The commit that was supposed
to stop `dev:stop` and editor launches from reaping a running `test:ci` was **inert**, not merely
unproven. Three sessions read it, agreed the guard was present, and filed it as *awaiting
evidence*. It was awaiting a **fix**. §3.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and tree**, so the next session compares NAMES against a
   reading it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-017** | ◐ **§A + §B** | ◐ **§B only** | **§A BUILT this session** (`9e8b3198`) — 8 specs, control-checked, typechecked. 🔴 **NOT app-driven.** AC3's premise still false, needs a ruling. §D untouched |
| **FIX-014** | ✅ | ✅ both clients | **CLOSED** s18. 🔴 driven ≠ shipped — packaged app still lacks it |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** s18 — 14(a) ruled *no sweep* |
| **FIX-001** | ✅ | ✅ 5/5 | **CLOSED** s17. 🟡 §1a.5 stretch open — re-decide, don't build |
| **FIX-002 / 003 / 007 / 009 / 010 / 011 / 012 / 018 / 020** | ✅ | ✅ | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Thirteen closed, one partly built and partly driven.**

🔴 **The phase is accumulating BUILT faster than DRIVEN, and that is this table's whole job to
show.** §A joins FIX-014's shipping half and FIX-003's remaining criteria in the built-not-driven
column. Each is individually reasonable — the build was gated, the drive ran out of session — but
the *pattern* is how a phase quietly converts into a pile of work that has never been seen doing
anything. 🟡 **Prefer driving something already built over building the next thing**, unless a
ruling blocks it.

---

## 2. Gate readings

**Tree: `9e8b3198`.**

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 total / 6 failed** at **seed 39393** | **this session, 21:21** |
| `noodl-core-ui` jest — `tests/code-editor` | ✅ **17 suites / 286**, 0 failed (was 278; +8 from §A) | this session |
| `noodl-core-ui` `tsc --noEmit` | ✅ adds nothing outside `../noodl-editor/**` alias `TS2307` | this session |
| `noodl-core-ui` jest — **full package** | ✅ **24 suites / 403**, 0 failed (395 + §A's 8) | this session |
| **§A known-broken control** | ✅ **5 of the 8 new specs go red** with the blanket refusal restored | this session |
| `node --check` on both devtools scripts | ✅ | this session |
| `dev:stop` **non-dry**, quiet checkout | ✅ exits 0, no crash, MCP intact at 19 | this session |

⚠️ **What that last row does and does not cover.** It exercises the early return I edited in the
*real* kill path — worth having, since my equivalent edit to the dry path shipped a crash. But the
checkout was quiet, so **the kill loops never ran and no recorded group was ever dropped**.
`sweepableGroups` is covered by a direct test with a control (nothing shielded ⇒ nothing dropped);
the **integration — `sweep()` actually dropping a real recorded group — has never executed.** That
is the honest remaining gap, and it is a smaller one than the sentence "the real path is verified"
would have implied.

**The six failures by NAME** — quote these, never the count:

```
AIX-006 style vocabulary   with guidance off, a raw candidate is accepted immediately with no style pass
AIX-006 style vocabulary   AIB-009 F11: a provider that stalls during the style pass never costs the accepted candidate
AIX-006 style vocabulary   offers one advisory style pass on a valid-but-raw candidate, then accepts the on-system resubmit
AIX-006 style vocabulary   a style suggestion never downgrades a valid authoring: agent ignores it, still authored
AI model registry          treats openai-compatible as sharing the OpenAI catalogue
AI model registry          has exactly one default per provider that owns models
```

No `BEN-001`, so no seed-order cluster. **`totalCount` is unchanged from 19:51** — the
2779 → 2788 → 2812 → 2843 climb of 08-15 has stopped, and the reading is now reproduced across two
independent runs rather than measured once.

✅ **The checkout was left FREE** — 0 editors, 0 suites, 0 `webpack.*test-ci`, verified after
teardown and confirmed by a peer.

---

## 3. 🔴 The finding: a committed guard that could never have worked

`d061bc6e` added this to spare a running `test:ci` from `dev:stop`, the launch sweep and the
watchdog:

```js
if (proc.command.includes('test.js --ci')) continue;
```

It sits in the **seed-selection** loop, so it only stops a process being *chosen*. Three lines
later:

```js
const all = withDescendants(seeds, table);      // re-adds every child of every seed
for (const pid of offLimits) all.delete(pid);   // subtracts offLimits ONLY
```

A suite is a grandchild of `npm exec lerna exec --scope noodl-editor`, which carries ROOT and
matches `DEV_TOOL`. The wrapper seeded; the suite came back underneath it. **The guard was passing
its own test the whole time** — the predicate matched, and the process really was excluded from
`seeds`.

### How it was measured — the technique is the reusable part

`dev:stop -- --list` is a **genuine dry run**: `stop-dev.js` `process.exit(0)`s before `sweep()` is
ever called (read that first, don't take it on trust). It calls the *same* `findDevProcesses`. So
the hazard can be **present by construction** at zero risk to the run:

| condition (a real suite live throughout) | targets |
|---|---|
| before the fix | **10** — the whole suite tree, `Electron test.js --ci` included |
| after the fix | **0** |
| after the fix, with a decoy dev stack | **2** — found, with its child |

🔴 **The third row is what makes the other two mean anything.** "0 targets" is equally consistent
with an enumeration you have simply broken, and a guard that spares everything is not a guard.

⚠️ **My first decoy exonerated the code and I nearly believed it.** `sh -c 'sleep 90' <marker>`
**exec-replaces itself** with `sleep 90`, so the ROOT marker left argv, `--list` found nothing, and
that read for a minute as *"the fix broke `dev:stop`"*. The control was dead, not the code. Printing
the decoy's own argv from `ps` **before** interpreting its absence is the one-line habit that
catches it.

### The general shape — why "unproven" was the harmful word

The asymmetry between the MCP skip (`e8a55109`, works) and the suite skip (`d061bc6e`, inert) was
never evidential. It is **process topology**: MCP servers hang off the Claude session pid and are
never below a dev seed, so seed-exclusion happens to suffice; a suite sits under an npm/lerna
wrapper, so seed-exclusion is structurally incapable of protecting it.

🔴 **Filing a defect as a gap in evidence postpones the fix indefinitely.** "Unproven" told three
sessions to wait for a confirmation that could never arrive. "Inert" told one session to open the
file. Same defect, two words, a day of difference.

### What `2b758a87` does

One `NEVER_SWEEP` predicate (`noodl-mcp.cjs`, `test.js --ci`, `run-electron-tests.js`,
`webpack.test-ci`, `run test:(ci|main)`) and a `shielded` set honoured at **all four** decision
points: seed selection, the pid-file groups, the ancestor-climb floor, and the subtraction after
`withDescendants`. The shield covers each protected process's **whole tree** — ancestors *and*
descendants — because sparing the Electron while killing `npm run test:ci` above it loses the run
just as completely, and its renderers matter as much as its host.

It also closes two things nobody asked for: the **~40s webpack window** (where no `test.js --ci`
process exists yet, so no argv check could ever see it), and the **latent MCP hole** — that guard
was lucky, not correct.

### What is proven, and what is not

- ✅ **MCP half, at runtime, hazard present, twice.** MCP process count **19 → 19 → 19** across the
  launch reap and the teardown sweep, and the *same nine* host pids alive at each point rather than
  nine survivors. This is a first exercise of the **new implementation**, which moved that guarantee
  onto an entirely different code path.
- ⚠️ **Suite half is proven at *enumeration* level.** 🔴 **And "enumeration → kill is a one-line
  code read" was wrong** — see §3b. It was a second kill path with different coverage.
  **Close what remains cheaply: take `dev:stop -- --list` once more next time a suite is genuinely
  live**, which now previews both paths.
- 🔴 **A reaper started before `2b758a87` still holds the old, inert module.** The fix reaches new
  reapers only. **The announcement etiquette is still load-bearing and is not retired by this.**

### 3b. 🔴 The same defect, one layer out — `4fd2cfdb`

Two peer sessions read the sweep *after* I reported the fix as verified, and found that
`2b758a87` covered **one of the sweep's two kill paths**:

```js
for (const pgid of groups) killGroup(pgid, 'SIGTERM');    // process.kill(-pgid) — NOT shielded
for (const proc of targets) killPid(proc.pid, 'SIGTERM'); // shielded
```

`killGroup` signals an **entire process group in one syscall**, so it cannot be filtered per-pid
even in principle. A shielded process sharing a pgid with a recorded group died anyway — with the
shield doing exactly what it was written to do. **The same shape as the bug it replaced.**

🔴 **And the dry run had the matching hole, which is the worse half.** `sweep()` returned after
logging `targets` alone, and `stop-dev.js --list` never consulted the group path at all. So my
"10 → 0" measurement was **structurally incapable** of revealing that hazard — which is precisely
how the previous guard survived three inspections. A dry run that omits a kill path is the same
failure as a guard that cannot fire.

`4fd2cfdb`: `snapshot()` now reads `pgid`; `sweepableGroups` drops any recorded group containing a
protected process; both `sweep(dryRun)` and `--list` report groups.

⚠️ **Is the hazard real, or topological luck?** `record.groups` holds the dev stack's own pgids
(`start.ts:91`), and a suite started from its own shell has its own group. **But agent sessions
start both from the same non-interactive shell, where job control is off and children can share a
group.** Nobody has yet shown a live suite sharing a pgid with a recorded group — 🟡 **that is the
one open question**, and `ps -o pid,pgid` against the pid file settles it. The fix drops the group
rather than resting on "safe by topology", which is the reasoning that already failed twice here.

🔴 **A missing `groups: []` in two early returns crashed `--list` on a QUIET checkout** — and this
deserves more than a footnote. **The empty case is the one no interesting test exercises**, because
every test you *want* to run sets up the state you are studying. It broke at exactly the moment
someone reaches for the tool to ask *"is anything running?"* — i.e. when they are least expecting
the instrument itself to be the problem, and most likely to read a crash as a busy checkout.

✅ **So run the boring case too.** I caught it only by re-running the quiet checkout after the decoy
one, and the decoy case passed throughout.

---

## 4. What this session settled — do not re-derive

### FIX-017 §A, built (`9e8b3198`)

`completesTopLevel` refused *every* empty position, so a fresh Function body offered nothing until
the user guessed a first letter — withholding the list from the only person who needs it.

**The discriminator is not "is the word empty" but "is the cursor starting a statement"** — nothing
but whitespace between it and the start of its line. True of an empty seed body and a blank line,
false mid-expression, so `const x = ` stays silent. New helper `startsStatement`, deliberately
textual rather than a syntax-tree test: an empty document has no meaningful tree, and that is the
case it exists to serve.

`completesTopLevel` itself is **untouched** — `library-completions` shares it, and the module note
warns `word.from === word.to` means opposite things either side of the member check. The new test is
read only *after* `isMemberPosition` has ruled.

⚠️ **One measurement removed code instead of adding it.** Gating the bare-port completions at an
empty position needed **no new gate**: `barePortCompletions` already returns nothing without a
prefix, explicit requests included. The gate I first wrote would have been dead code sitting exactly
where a reader looks for the load-bearing one.

### The drive recipe, as far as it was proven

Working, this session:

```js
// module cache
let c; window.webpackChunknoodl_editor.push([[Symbol('p')],{},(r)=>{c=r.c;}]);
// open a COPY and route into the editor
const LPM = c['./src/editor/src/utils/LocalProjectsModel.ts'].exports.LocalProjectsModel;
const project = await LPM.instance.openProjectFromFolder(dir);   // returns a Promise
route.router.route({ to: 'editor', project });
```

- 🔴 **`openProjectFromFolder` alone does NOT navigate** — it registers the project and leaves you
  on the launcher. `ProjectModel.instance` stays `false` until the route runs.
- 🔴 **The router handle is not a module export.** Walk the React fiber from `#root` for
  `props.route.router.route` — found at depth 3.
- 🔴 **A `cp -R` copy is INDISTINGUISHABLE from its source in the launcher** — the card shows
  `project.json`'s `name`, which the copy inherits. Only `_retainedProjectDirectory` separates them.
  **Rename the copy's `name` field before driving**, or you cannot prove which one you opened.
- Component switch: click `div.ComponentsPanel-module__TreeItem--…` (the **TreeItem**, not the
  Label). Tag it with `setAttribute` and click by that attribute — the generated class hashes.

🔴 **Where it stopped, and the answer a peer supplied afterwards** — selecting the node on the
node-graph canvas:

```js
const ed = window.__nodeGraphEditor;            // the handle; NOT a module export, NOT on a fiber
const flat = []; const walk = n => { flat.push(n); (n.children||[]).forEach(walk); };
ed.roots.forEach(walk);
ed.selectNode(flat.find(n => n.model && n.model.type === 'JavaScriptFunction'));
```

- 🔴 **`selectNode` takes the VIEW node, not the model node.** Passing a model node throws
  `Cannot read properties of undefined (reading 'type')` from inside `nodegrapheditor.ts`, which
  reads like a broken editor rather than a wrong argument.
- 🔴 **The panel swap is invisible in the same `eval`** — React has not re-rendered, so measure in a
  **second** CDP call or record a false negative.
- ⚠️ `ed.selection` does not exist (`ed.selector._selected`), and `ed.model.forEachNode` **stops on
  a truthy return** — `arr.push(n)` returns a number, so it reads only the first node.

### Cleanup done

Fixture `fix017a-drive` removed; `recentProjects` restored 32 → 31; stack torn down and announced
to every session the launch was announced to.

---

## 5. What to do next and why

1. 🔴 **Drive FIX-017 §A.** It is built, committed and gate-green but **not app-driven**, and the
   task is explicit that it must be driven in Function **and** Expression modes **and driven the
   other way** ("typing ordinary code is not smothered"). §4 has the recipe end to end including the
   step that blocked me. This is the shortest path to a real close.
2. ✅ **Take `dev:stop -- --list` the next time a `test:ci` is genuinely live** — one command, and it
   now previews **both** kill paths. §3, §3b.
2b. 🟡 **Settle whether a live suite can share a pgid with a recorded dev group** — `ps -o pid,pgid`
   against the `groups` array in the pid file. It decides whether §3b's hazard was real or
   topological luck. Cheap, non-destructive, and it is the last unmeasured claim in this area.
3. **§D (the browse button)** — small and independent, untouched.
4. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
5. **FIX-016 §2** (the declared-String-but-called diagnostic) — no ruling attached, ready home in
   `portDiagnostics.ts`, buildable today.
6. **FIX-013**, **FIX-016 §1** — open, each needs its ruling (§6).
7. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **FIX-017 AC3's ruling** — its premise is false (ports and API names never share a prefix, so
  there is no ranking to control for and `boost: 99` is unobservable). Restate against a prefix
  where the two surfaces genuinely compete, or strike it.
- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged through
  s18, s19, s20 and now s21; eight sessions have asked and none has claimed it. It backs
  `library:check`, and `cloud-library:check` **is a PR gate**. One `git add -A` from riding along,
  one `git checkout --` from vanishing. **Attribute it or bin it.** I did not touch it.
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one: "yes" retires a written constraint, "no" makes ~1,500 lines genuinely deletable.
- 🔴 **FIX-016's signal-input semantics** — re-run the body vs named handlers, or rule signal inputs
  out and document `run` as the only trigger.
- ⚠️ **The ⌘C ruling** (carried by a peer): text and a canvas node both selected —
  `keyboardhandler.ts:165` guards on **focus**, not selection.
- ⚠️ **The MCP servers are one pair per live Claude session, not a leak** — ~19-20 processes is ~10
  pairs, each pair two siblings sharing a `ppid` that is the owning session's own pid. 🔴 What is
  owed: they all predate the `packages/noodl-mcp/dist` rebuild, so every live server holds
  pre-rebuild code. Restarting them is your call (each is a live session's connection), and the
  **repackage** is separately owed for fresh/packaged launches.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance; it also does not mention `npm run cdp` is root-only. `run_in_background`
  preserves provenance — the skill should say so.
- ⚠️ **`MEMORY.md` was brought back under budget by a peer this session** (18,410 → 16,744) by
  extracting **Judgement traps** to `judgement-trap-pointers.md`. Nothing deleted. Read that file
  before assuming a trap is gone.
- **FIX-004** conversion block shape · **FIX-005** category name · **FIX-006** demote Script? ·
  **FIX-008** leftovers (incl. a measurement) · **FIX-015** / **FIX-021** are their own sessions.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add`/`git commit`**.

⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — `MEMORY.md` links into them, so they are one `git clean`
from gone. **Leave them.**

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
🔴 **Check the checkout with an ARGV filter, not a path grep** — `Electron . --dev` for an editor,
`Electron test.js --ci` for a suite; a path grep on `electron/dist` counts MCP servers as editors
and cost session 19 an entire drive plan.

🔴 **The announcement etiquette is NOT retired by `2b758a87`.** A reaper started before that commit
holds the old module, and anyone on a worktree cut earlier is unprotected.

⚠️ `pgrep -af` does **not** print args on macOS — `-a` is not BSD `pgrep`'s "list args" flag, so you
get a bare pid and a match you cannot identify. Use `ps -Ao pid,ppid,lstart,args` and grep that.

⚠️ **`dev:stop -- --list` is not purely read-only** — it calls `removePidFile()` when it finds
nothing. "Kills nothing" and "reads only" are not the same claim.

🔴 **Exercise the DULL state, not just the interesting one.** Three separate failures today shared
one shape: the hazard absent so a guard never fired; the detector absent so a control could not
signal; and the *empty* case untested so a fix broke where the tool is most used — a `--list` on a
quiet checkout, which is what nearly every `--list` here actually is. **Enumerate the states your
instrument will meet and run the boring ones too.**

⚠️ **Distrust the phrase "X kills exactly what Y returns"** (and its relatives). It asserts an
equality *between layers* while having been checked on only one. That sentence is how I described
the group kill path an hour before it turned out to be a second path with different coverage.

✅ **A package-local jest run is the gate you can still take on a busy checkout.** `noodl-core-ui`'s
jest is plain Node, spawns no Electron, matches no `DEV_TOOL` pattern, and finishes in ~1.5s.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key is **`recentProjects`**).
