# Phase 66 — next session

**Written 2026-08-16, session 27.** §5 item 1 is **driven and closed**, and it closed by the premise
turning out false rather than by the measurement going either way it was supposed to. Fourteen tasks
remain closed; nothing was built, four things were measured, and one thing I said was withdrawn
within the hour.

🔴 **Read §3 before §1.** The drive was clean. The one claim in it that made me look most observant
was **wrong**, it was **mine**, and it was a claim about a *tool* rather than about the product —
I reasoned about a four-line function I never opened, while telling six sessions to stop reasoning
about behaviour. It reached ~6 sessions who filed it; all have been told and all have struck it.

🔴 **The shape worth carrying, because nobody had named this axis:** I ran `cdp -- targets`
**before** opening the project and `curl /json/list` **after**, then attributed a *state* difference
to the *instrument*. **Two readouts taken in two states measure neither.** Equalise the state before
suspecting the instrument — an instrument bug is the more interesting explanation, so it gets
reached for first and repeats fastest.

✅ **The load-bearing results all survive**, and one of them retires an argument rather than a fact:
*"`fromJSON` + `addRoot` is a fixture artefact"* was dismissing **the product's own creation path**.
A dismissal needs the same standard of proof as the finding it dismisses, and it rarely gets it.

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
| **FIX-016 §2** | ✅ | ✅ | **CLOSED `4be3f1f6`** + follow-up **`6de1ae25`**. Its reach is now fully characterised — §3d |
| **FIX-016 §1** | 📋 | ✅ **fully investigated** | **Both open questions are answered (§3).** Ruling (a) is small; ruling (b) is now *smaller than it has ever been recorded* |
| **FIX-016 §3** | 📋 | — | Signal *inputs*. Needs Richard's semantics ruling. **The only part of FIX-016 genuinely blocked** |
| **FIX-017** | ◐ §A + §B | ◐ §B + §A(¾) | AC1 driven FALSE (s26). AC3 premise still false. **Needs Richard, not a build** |
| **FIX-014 / 019 / 001** | ✅ | ✅ | **CLOSED** s17–s18 |
| **FIX-002 / 003 / 007 / 009 / 010 / 011 / 012 / 018 / 020** | ✅ | ✅ | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Fourteen closed.** s27 built nothing — it spent its window on one drive that answered four
questions, then on retracting the fifth thing it said.

---

## 2. Gate readings

**No gate was run this session.** The floor below is inherited and still current; s27 ran no suite
and changed no source, so nothing it did can have moved it.

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed** at **seed 39393** — EXACT floor match | s25, tree `d0891746` |
| `noodl-core-ui` jest — full package | ✅ **25 suites / 444**, 0 failed | s24, `6de1ae25` |
| `noodl-core-ui` jest — `tests/code-editor/` | ✅ **18 suites / 327** | s24 |
| `tsc --noEmit` — `noodl-editor` | ✅ **0 errors** | s24 |
| `tsc --noEmit` — `noodl-core-ui` | ⚠️ **44**, all pre-existing | s24 |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

✅ **Checkout left FREE.** `dev:stop` (not a by-pid kill — §7), then `start.ts` / bare `webpack` /
`Electron . --dev` / `test.js --ci` all **0**, against a **47-line positive control on the same
pipeline**. ✅ **25 `noodl-mcp` servers survived** — the first third-party witness of the
`2b758a87`/`4fd2cfdb` shields holding through a real non-dry `dev:stop`.

---

## 3. FIX-016 §1 — the drive, and the one retraction

### 3a. ✅ The fixture-artefact hypothesis is DEAD — and it was never about the fixture

`NodePicker.utils.ts:15-41` — the picker's own `createNodeFunction` — builds **every** user-created
node with `NodeGraphNode.fromJSON({…})` then `model.addRoot(node, {undo:true, label:'create'})`.
**`fromJSON` + `addRoot` IS the product's creation path.**

Not left as a source read. Built a node through that same function and hooked
`NodeGraphNode.prototype.setDynamicPorts` (the receiver at `ViewerConnection.ts:203`). **Four pushes
arrived from the runtime**, in order:

| # | after | ports pushed |
|---|---|---|
| 1 | node created | `[]` |
| 2 | FUN-002 seed script | `in-Value, out-Result, runOnChange-in-Value` |
| 3 | script set, **undeclared** | `out-Done, out-Result` |
| 4 | `scriptOutputs` **declared** | `outtype-Done, out-Done, outtype-Result, out-Result` |

⇒ `editorImportComplete` had fired and the runtime's graphModel **did** hold a normally-created node.
🔴 **This retroactively upgrades every phase-66 drive built that way rather than casting doubt on it.**
Findings that make prior work count for *more* are the least likely to propagate, because nobody goes
looking for good news.

✅ **And pushes 3→4 are a within-subject reproduction of s26's gate finding** — one node, same script,
declaration the only variable. Stronger than the original two-node pair, which could not exclude node
identity.

### 3b. ✅ The viewer cell: the premise was false, so the cell was never reachable

With a project **open** and **no preview action taken**, the editor hosts a
`<webview src="http://localhost:8574/">` titled **"Noodl Viewer"** — a live runtime, witnessed
*pushing dynamic ports*, so it is doing the work rather than merely existing.

⇒ There is no author-reachable *"declared but no live runtime"* state. The variable cannot be held at
zero by not previewing. **§1 is the copy question**, and that is now a conclusion rather than an
assumption. ⚠️ **Bound:** observed with a project **open**; whether the webview exists on the
Launcher was **never tested**.

✅ Also: `dynamicports` **persists to `project.json`** (19 entries, `outtype-` on 6 lines). The
runtime *produces* the ports; disk *replays* them.

🔴 **WITHDRAWN — my own instrument claim.** I said `npm run cdp -- targets` prints only `page`
targets and hides the webview. **False.** `cdp.js:333` prints `/json/list` **unfiltered**, `type`
first; `appTarget` accepts `webview` (`:126`) and `KNOWN_TARGETS.viewer` already matches
`'Noodl Viewer'` (`:121`). The real cause is §0's state error. ✅ **The narrower survivor is real and
is a one-line fix:** `cdp.js:143`'s hint — *"The viewer window only exists while a project preview is
running"* — is **misleading**, since `--target=viewer` attached here with no preview.

### 3c. 🔴 The value-shaped case is NOT silent — measured beside a known-firing control

Four nodes, one component, panel read with the selection verified per read. Positive control: a
syntax-error node, which fired throughout.

| script | port | type | Type row | diagnostic |
|---|---|---|---|---|
| `Outputs.Ready();` | `out-Ready` | **signal** | none | none — ✅ **correct silence** |
| `Outputs.Done.send();` | `out-Done` | `*` | none | 🔴 *"Line 1: Cannot read properties of undefined (reading 'send')"* + *"The script threw: …"* |
| `Outputs.Done_1();` | `out-Done_1` | `*` | none | 🔴 *"Outputs.Done_1 is not a function"* + *"The script threw: …"* |
| declared `Done`/`Result` | — | — | `Done │ Type │ Result │ Type` | none |

✅ *"They throw"* had only ever been **reasoned** — now measured. 🔴 *"No diagnostic / no surface at
all"* was asserted as measured and is **false**. ⚠️ **The confident half was the wrong one.**

⚠️ **Attribution precision:** I measured **`WarningsModel` entries** for the node. I did **not** look
at which affordance renders them — if that is the `Last run` row, that is a peer's claim, not my
measurement.

### 3d. The accurate statement of the remaining gap

Row 2's author has **no *static* surface** — no Type row to discover, no lint warning while authoring
— and is told **only once the node runs**, by an engine-worded error that names the symbol but not
the fix. Worse than a declared port, which warns before you run anything; **better than nothing**.

⚠️ **This row has now been over-stated at every revision** — first *"no port at all"*, then *"no
surface at all"*. **Assume the remaining gap is smaller than whatever it currently says.**

---

## 4. What this session settled — do not re-derive

- **`fromJSON` + `addRoot` is the product's own path.** Witnessed, four pushes.
- **A normally-created node reaches the runtime's graphModel**; `editorImportComplete` had fired.
- **The declaration gate reproduced within-subject** on one node.
- **A runtime is live with a project open and no preview action** ⇒ §1 is the copy question.
- **`dynamicports` persists to `project.json`.**
- **Both value-shaped calls throw AND warn.** Not silent.
- **`Outputs.Ready()` → signal port, no warning** — §2's silence is correct, measured.
- 🔴 **Do NOT re-file "`cdp targets` hides webviews"** — withdrawn, §3b.

---

## 5. What to do next and why

1. **FIX-016 §1's rulings — both questions are now sized (§6).** Do not build until Richard rules.
   Ruling (b) is much cheaper than the record has ever said.
2. 🔴 **FIX-017's remaining half needs Richard** — AC1 driven false, AC3's premise false. **Do not
   build §D speculatively.**
3. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
4. **FIX-013**, **FIX-016 §3** — open, each needs its ruling (§6).
5. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.
6. 🟢 **One-line candidate, unowned:** `cdp.js:143`'s viewer hint is misleading (§3b). ⚠️ It depends
   on the always-on-webview observation, which no second session has reproduced.
7. 🟢 **One cheap loose end:** s24's null now has one surviving candidate — that their fixture never
   declared `scriptOutputs`. ⚠️ **That is elimination from a list one session wrote**, not
   exhaustion. One look at that fixture finishes it.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

🔴 **Do NOT re-run `test:ci` to "check"** — the floor is current at `d0891746` and s27 ran no suite.
🔴 **Do NOT re-run the destructive `dev:stop` experiment** — it exists, `a905af94`.

---

## 6. Owed by Richard

- 🟢 **FIX-016 ruling 1 — two questions, and (b) has shrunk twice.**
  **(a) The copy/default question**, small: the row says only `Type` and reads `String` whether or
  not anything is stored. Options: offer Type at add time in `AddNameField`; a one-line hint under
  `scriptOutputs`; or nothing, since §2's diagnostic names the fix when the author gets it wrong.
  **(b) The parser-asymmetry question, RE-PRICED DOWN by measurement:** an author writing
  `Outputs.Done_1()` or `Outputs.Done.send()` gets a value port and **no Type row**, but **is told at
  runtime**, by name and line. So this is *"an accurate message that doesn't name the fix"*, **not**
  *"silent breakage"* — a copy/affordance question, not a diagnostics coverage gap. ⚠️ **Do not
  conflate with plain `Outputs.Done()`, which works correctly** (measured).
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible, and the add affordance offers no
  type at creation. ⚠️ **One keystroke settles the copy half**: press Ctrl-Space in a Function
  popout — `com.apple.symbolichotkeys` key 60 is **enabled** on your machine and binds it to "Select
  the previous input source".
- 🔴 **FIX-017 AC3's ruling** — premise false (ports and API names never share a prefix). Restate or
  strike.
- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged
  s18–**s27**; thirteen sessions have asked, none has claimed it. It backs `library:check`, and
  `cloud-library:check` **is a PR gate**. **Attribute it or bin it.** s27 did not touch it.
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one.
- 🔴 **FIX-016's signal-input semantics** (§3) — re-run the body vs named handlers, or rule signal
  inputs out and document `run` as the only trigger.
- ⚠️ **The ⌘C ruling** (carried by a peer): `keyboardhandler.ts:165` guards on **focus**, not
  selection.
- ⚠️ **MCP servers hold pre-rebuild code**; the **repackage** is separately owed.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance. `run_in_background` preserves it. Same file calls `dev:stop` "safe to
  run with a sibling worktree's stack up" and offers no warning on the by-pid alternative — **the
  doc should say the shields are what make either safe** (§7).
- 🟢 **The memory index still has no owner.** `MEMORY.md` is over its 17.1 KB budget and every
  session correctly declines to cut it and correctly adds to it. ✅ The safe lever remains
  **promote-then-collapse on a closed phase**, standing traps promoted out **first**. 🔴 **This needs
  a decision from you, not another session's restraint.**
- 🟢 **A lockfile written by `start.ts` at *intent*** — the ~75s window in which no process check can
  be correct is a hole no filter can close.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add` / `git
commit`** — the tree held modified files from at least four sessions while I worked.

⚠️ `dev-docs/tasks/phase-65-the-library/` and the phase-67 `UNI-011` file are untracked and belong to
neither this phase nor 67 — **leave them**.

### 🔴 Teardown: the by-pid route is NOT the gentle one

```
scripts/start.ts:74     spawns dev-watchdog.js with the launcher pids
dev-watchdog.js         polls every 2000ms; any watched pid dying →
dev-watchdog.js:44      sweep({ protectAncestors: false, … })
```

`dev:stop` leaves `protectAncestors` at its default **true**; the watchdog explicitly disables it.
**Both are safe only because `2b758a87`/`4fd2cfdb` shield MCP and suites** — s27 witnessed that
holding (25 servers survived a real `dev:stop`). 🔴 **A reaper started before those commits holds the
old module — keep announcing.**

### 🔴 The pre-flight has a ~75-second blind window

`scripts/start.ts` appears **immediately**, bare `webpack` at ~8s, `Electron . --dev` at **~75s**.
Match on **`comm`** for what is already running *and* on argv for launches — the `comm` fix alone
trades a false positive for a **false negative**, which reads as "clear".

### ✅ Match the breadth of the check to the direction of the claim

| the claim | what you need |
|---|---|
| **"nothing is running"** (a null) | a **BROAD** match — 0 in the superset ⇒ 0 in the subset |
| **"something is running, and it's MINE"** | a **PATH-SCOPED** match — ~20 sibling worktrees match on argv shape |

🔴 **And put a positive control on the process check itself.** Four zeros from a typo'd pattern look
identical to a quiet checkout. s27 reported its zeros beside a 47-line match on the same pipeline.

### 🔴 Attribute by PPID, never by the `electron/dist` path

~25 Electron processes from this checkout at idle are **MCP servers**, one pair per live session —
every PPID is that session's socket number.

### Etiquette

**Announce before *and* after any `test:ci`, `test:main` or editor launch.** 🔴 **The LAUNCH list is
the TEARDOWN list**, and a correction must reach **everyone the claim reached** — a claim propagates
further than its retraction by default, and the gap is where stale facts live.

⚠️ **Re-take `ListAgents` at both ends** — a roster goes stale *inside* an announce window. Prune
only on an explicit "I'm elsewhere", never on silence.

🔴 **NEW — do not send to both the name and the socket.** s27 announced to 12 names *and* 10 sockets;
several peers received the identical message twice, and one flagged it as ~22 messages for one
result. ✅ **Reply on the socket a message arrived on; announce once to the names.**

⚠️ `pgrep -af` does **not** print args on macOS. Use `ps -Ao pid,ppid,lstart,args`, print pids rather
than counting, and pass `-a` to `/usr/bin/grep` (⚠️ emoji make it call a file "binary").

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key **`recentProjects`**) —
**after** the editor is down, since it rewrites the file on exit. ⚠️ A copied project keeps the
original's **name**; rename it on disk or you cannot tell the cards apart.
