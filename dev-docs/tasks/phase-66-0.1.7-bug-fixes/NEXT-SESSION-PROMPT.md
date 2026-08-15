# Phase 66 — next session

**Written 2026-08-15, session 20.** **FIX-017 §B is driven.** `Noodl.Records.` answers with 11
methods in a real Function popout, against a positive *and* a negative control. Criterion 2 is
closed; FIX-017 goes from *partly built, undriven* to **partly built, partly driven**.

🔴 **The finding that outlives this task: session 19 cancelled its entire drive plan on a grep of
the wrong surface.** Its handover says "nine Electron editors were live on the checkout." There were
**zero**. All nine matches were `noodl-mcp.cjs --allow-writes` — MCP servers, which run under the
Electron *binary* and therefore match `electron/dist`. One `ps` filtered on **argv** instead of the
binary path took one call and freed the whole session. §3.

⚠️ **A second thing this session got wrong, and two peers got wrong with me.** My clean `dev:stop`
was offered by two sessions as the first in-the-wild proof of the sweep fix `d061bc6e`. It proves
nothing — **zero suites were running**, so nothing existed to be spared. §3b.

---

## 0. How this file works

One `NEXT-SESSION-PROMPT.md` per phase, overwritten each session. It carries exactly four things:

1. **Built vs. driven**, per task, as a table — *built* is code plus gates; *driven* is the app
   doing it. Never let the two blur into "done".
2. **Gate readings with their date and tree**, so the next session compares NAMES against a reading
   it can trust rather than re-deriving one.
3. **What this session settled**, so nobody re-litigates or re-measures it.
4. **What to do next and why**, ordered, with rulings owed by Richard called out separately.

Learnings that outlive the phase go to memory, not here.

---

## 1. Built vs. driven

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-017** | ◐ **§B only** | ◐ **§B yes** | **AC2 CLOSED this session** with controls. 🔴 **AC3's premise is false — needs a ruling.** §A and §D untouched |
| **FIX-014** | ✅ | ✅ both clients | **CLOSED** s18. 🔴 driven ≠ shipped — see §6 on the MCP process topology |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** s18 — 14(a) ruled *no sweep* |
| **FIX-001** | ✅ | ✅ 5/5 | **CLOSED** s17. 🟡 §1a.5 stretch open, and worth re-deciding not building |
| **FIX-002** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-003** | ✅ | ✅ 5/5 | **CLOSED** — `will-navigate` proven (s13) |
| **FIX-007** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-009** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-010** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-011** | ✅ | ✅ 4/4 | **CLOSED** |
| **FIX-012** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-018** | ✅ | ✅ 5/5 | **CLOSED** |
| **FIX-020** | ✅ | ✅ 3/3 | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Thirteen closed, one partly driven.**

---

## 2. Gate readings

**Tree: `03db709a` + doc edits only.** 🔴 **This session changed NO source** — only `dev-docs/` and
memory. So s19's readings stand unchanged and were not re-derived:

| Gate | Reading | When |
|---|---|---|
| `noodl-core-ui` jest — full package | ✅ **24 suites / 395**, 0 failed | s19, 08-15 22:0x |
| `noodl-core-ui` `tsc --noEmit` | ✅ adds nothing — 44 errors, all `../noodl-editor/**` alias `TS2307` | s19 |
| **known-broken control** | ✅ 5 of the 10 new specs go red with one-level behaviour restored | s19 |
| `test:ci` (jasmine) | ⬜ **not run since 08-15 19:51** — **6 by NAME** at `seed 39393` | 08-15 19:51 |

🔴 **Quote the six by NAME, never the count** — `totalCount` moved 2779 → 2843 in a day. A mismatch
is almost always age, not a regression.

✅ **The checkout is FREE and `test:ci` is runnable.** I verified 0 editors / 0 suites / 0
`webpack.*test-ci` after teardown, and nine peer sessions all confirmed they are running nothing.
**A `test:ci` floor is the cheapest thing the next session can bank** — it has not been read since
19:51 and several tasks have landed since.

---

## 3. 🔴 The finding: "nine live editors" were nine MCP servers

Session 19's §2 and §5 both state the checkout had nine Electron editors live, and it declined to
drive on that basis. The actual population:

```
ps | grep 'electron/dist'          → 9   ← ALL nine are noodl-mcp.cjs --allow-writes
Electron . --dev      (editor)     → 0
Electron test.js --ci (suite)      → 0
webpack.*test-ci      (pre-suite)  → 0
```

**MCP servers run under the Electron binary**, so a path grep matches them. The discriminator is the
**argv tail**, never the binary path and never the count. Five peer sessions reproduced this
independently within minutes of being told.

🔴 **The count is not just wrong, it is unsanity-checkable.** A checkout hosts **one** editor
(single-instance lock) and realistically one suite — so *any* count above two is telling you the
filter is wrong, not that the checkout is busy. Readings today ranged 9 → 13 → 19 → 20 depending on
the hour and the pattern, all of them "correct".

⚠️ **And the corrected count is still half the population.** Each server is a **pair of siblings**
(same ppid — the Claude session's): one `node /Applications/NodeGX.app/…` (packaged build) and one
Electron host running `packages/noodl-mcp/dist/…` (repo build). I quoted "still 9 MCP servers" as a
post-teardown all-clear and that was the same undercount one level in; the real figure was 20.
Nothing ever reaps them, so they accumulate a pair per connection.

Saved to memory as `an-electron-dist-grep-counts-mcp-servers-as-editors` (amended).

### 3b. 🔴 A clean teardown did NOT prove the sweep fix

I ran `dev:stop`: 26 processes reaped, MCP spared, teardown clean. **Two peers independently told me
this was the first in-the-wild confirmation of `d061bc6e`.** A third dissented and was right: **zero
suites were running**, so nothing existed to be spared. With the hazard absent, "the guard works"
and "the guard was deleted" produce a byte-identical reading.

I did confirm by **reading the code** that `dev-processes.js:355` skips `noodl-mcp.cjs` and `:371`
skips `test.js --ci`, both inside `findDevProcesses` — the shared candidate source behind `dev:stop`,
the launch sweep and the watchdog. That justifies *"the exclusion is present"*, not *"the exclusion
works"*. **`d061bc6e` remains unproven in the wild.** To prove it, a `test:ci` must be running
*through* a `dev:stop` and survive.

⚠️ Note the social shape: two peers agreed with each other, confidently, and were both reasoning
from the single run I had reported. **Agreement is not replication.** Saved as
`a-guard-is-not-proven-by-a-run-where-the-hazard-was-absent`.

---

## 4. What this session settled — do not re-derive

### FIX-017 criterion 2, driven

Fixture: a `cp -R` copy of `fix012-drive`, component `/Probe`, its `JavaScriptFunction` node.

| probe | completions | tooltip |
|---|---|---|
| `Noodl.` | **19** namespaces incl. `Records` | rendered |
| **`Noodl.Records.`** | **11** with signatures in `info` | rendered |
| `Noodl.Nonsense.` | **0** | **none** |

The negative control carries the claim — 11 items alone is equally consistent with a resolver that
says yes to anything. The tooltip was read from `.cm-tooltip-autocomplete`, so the menu **rendered**
rather than merely resolving.

🔴 **AC3's premise is false and it needs a ruling.** Typed `Inp` returns exactly one option
(`Inputs`); `Inputs.` returns exactly one (`qty`, the node's real port). **Ports and API members
never share a list** at these prefixes, so there is no ranking to control for and `boost: 99` is
unobservable. Restate it against a prefix where the two surfaces genuinely compete, or strike it.

⚠️ **`Noodl.Variables.` returned 0 — indeterminate, not a defect.** The fixture has no variables.
It is the one prefix where the project surface and the static list compete, so it is exactly where
the build's load-bearing ordering comment should be tested — **on a project that has variables**.

### Two drive-recipe corrections

- 🔴 **`LocalProjectsModel.openProjectFromFolder(dir)` now returns a `Promise`**, not a
  `ProjectModel`. The memory recipe says otherwise and is stale. Await it, then
  `router.route({to:'editor', project})`.
- 🔴 **`ProjectModel.instance` is at module key `./src/editor/src/models/projectmodel.ts`.** Scanning
  the module cache for "a `.instance` with `getComponents`" finds a *different* class whose instance
  is not the singleton — it answered with plausible component names and an **empty directory**.
  ⚠️ Component names did **not** disambiguate the copy from its source (both had `/App`+`/Probe`);
  only `_retainedProjectDirectory` did.

---

## 5. What to do next and why

1. ✅ **Run `test:ci` first** — the checkout is free, the floor is 4h stale, and it is the cheapest
   thing to bank. Announce before and after. Compare the **six names**, not the count.
2. 🔴 **FIX-017 §A** — answer at an empty position. Requires driving **both ways** ("typing ordinary
   code is not smothered"). Now startable: the drive recipe in §4 is proven end to end, and §A is a
   change to the same `createNoodlCompletionSource` the drive already reaches.
3. **§D (the browse button)** — small and independent.
4. **FIX-008 fix C** — Richard owes a measurement on C's copy. The oldest open item.
5. **FIX-016 §2** (the declared-String-but-called diagnostic) — **no ruling attached**, ready home in
   `portDiagnostics.ts`, buildable today exactly as §B was.
6. **FIX-013**, **FIX-016 §1** — open, each needs its ruling (§6).
7. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **FIX-017 AC3's ruling** — new this session. Its premise is false (§4); restate or strike.
- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged from s18
  and s19; seven sessions asked, none claimed it. It backs `library:check`, and
  `cloud-library:check` **is a PR gate**. One `git add -A` from riding along, one `git checkout --`
  from vanishing. **Attribute it or bin it.** I did not touch it.
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one: "yes" retires a written constraint, "no" makes ~1,500 lines genuinely deletable.
- 🔴 **FIX-016's signal-input semantics** — re-run the body vs named handlers, or rule signal inputs
  out and document `run` as the only trigger.
- ⚠️ **The MCP servers: 20 processes, 10 pairs, oldest ~29h, and they never get reaped.** `dev:stop`
  spares them by design, so they accumulate one pair per connection. **All of them started before
  tonight's 19:39 `packages/noodl-mcp/dist` rebuild**, so every live server holds pre-rebuild code
  regardless of which half serves. 🔴 **Which half answers tool calls, `ps` cannot settle** — two
  sessions asserted it in opposite directions tonight and both were reading a subset. Restarting
  them is your call, not a peer's. The **repackage** is separately owed for fresh/packaged launches.
- 🔴 **`MEMORY.md` is over budget and the hook nags on every edit.** Unchanged from s19: it cannot be
  brought under by rewording — getting under means **dropping live trap entries**, a call about your
  own knowledge base. I added one line and amended two files in place rather than adding more.
  ⚠️ Several sessions edit it concurrently; targeted single-line edits only. I hit a mid-edit
  conflict on one memory file this session and had to re-read it.
- ⚠️ **`d061bc6e` is committed but STILL UNPROVEN in the wild** — see §3b, and note that three
  sessions' clean teardowns have now been mistaken for proof.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance; it also does not mention `npm run cdp` is root-only. I used
  `run_in_background` instead and provenance survived — the skill should say so.
- 🟡 **s13's datum on `linkify`**: the scoping model *declines to emit links* (3 refusals).
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
🔴 **Check the checkout with an ARGV filter, not a path grep** (§3) — and note `ListAgents` may not
list every peer: one session appeared only because another relayed it, and its socket was already
stale. A stale socket (`ENOENT`) is decent evidence a peer has exited, but it means *gone*, not
*finished cleanly* — check the checkout directly.

⚠️ **Two hazards, two different windows** — a **launch or teardown** is destructive for a whole
`test:ci` run; the **~40s webpack** window bounds **source edits** only. `pgrep -f 'webpack.*test-ci'`
is the check that closes the pre-suite blind spot, because an argv check for `Electron test.js --ci`
reads clear during a suite's first ~40 seconds.

✅ **A package-local jest run is the gate you can still take on a busy checkout.** `noodl-core-ui`'s
jest is plain Node, spawns no Electron, matches no `DEV_TOOL` pattern, and finishes in ~1s.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key is **`recentProjects`**).
I restored it 32 → 31.
