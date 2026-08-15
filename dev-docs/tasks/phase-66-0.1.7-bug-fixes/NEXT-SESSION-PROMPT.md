# Phase 66 — next session

**Written 2026-08-15, session 23.** One task built and driven in the same session:
**FIX-016 §2 is CLOSED (`4be3f1f6`)** — the diagnostic that tells an author their output is a value
port, not a Signal. Fourteen tasks now closed.

🔴 **The finding that outlives this phase: the drive rewrote the message it was sent to confirm.**
The wording *"a value output with no Type set"* is true of the stored parameter and **false on the
author's screen** — the panel renders the enum's `default: 'string'`, so a port with nothing stored
displays `String`. A gate-green feature would have shipped a sentence contradicting the dropdown
beside it. **No spec could have caught this, because the spec and the code agreed with each other
and both were wrong about the product.** §3.

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
| **FIX-016 §2** | ✅ | ✅ **3/3 + control** | **CLOSED `4be3f1f6` this session.** 🔴 Found an open wrinkle: the diagnostic does **not** clear when you obey it — §3c |
| **FIX-016 §1** | 📋 | — | 🔴 **Ruling 1 is now answerable — I looked. §3d** |
| **FIX-016 §3** | 📋 | — | Signal *inputs*. Needs Richard's semantics ruling. **This is the only part of FIX-016 that was ever blocked** |
| **FIX-017** | ◐ §A + §B | ◐ §B + §A(¾) | Unchanged from s22. AC1's "without typing" ✗ and unreachable by §A; **§D promoted**; AC3 premise false |
| **FIX-014 / 019 / 001** | ✅ | ✅ | **CLOSED** s17–s18 |
| **FIX-002 / 003 / 007 / 009 / 010 / 011 / 012 / 018 / 020** | ✅ | ✅ | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Fourteen closed.** Nothing was left built-but-undriven this session — §2 was driven in the same
window it was built in, and that is what found both the wording defect and the stale-context bug.

🔴 **Two peers had shelved FIX-016 entirely as "blocked on a ruling from Richard".** It is not.
The ruling backlog is **§3 (signal inputs)** and **§1 (discoverability)**; **§2 had no ruling
attached and was buildable all along.** A blocker attaches to a *part*; quoted at task level it
silently inherits to every part, and this one cost an entire buildable slice several sessions of
nobody looking. **Open the task file rather than trusting the status line.**

---

## 2. Gate readings

**Tree: `4be3f1f6`.**

| Gate | Reading | When |
|---|---|---|
| `noodl-core-ui` jest — full package | ✅ **24 suites / 419**, 0 failed | s23, this tree |
| `noodl-core-ui` jest — `tests/code-editor/` | ✅ 17 suites / 302 | s23 |
| `tsc --noEmit` (package tsconfig) | ⚠️ 44 errors, **0 in either edited file** — all pre-existing, all in `noodl-editor` | s23 |
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed** at **seed 39393** | **s21, 21:21** — not re-run; my change is `noodl-core-ui`-only and jest covers it |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

✅ **Checkout left FREE.** `dev:stop` stopped 26 processes; verified after with the corrected filter
(§7): `start.ts` 0, bare `webpack` 0, `Electron . --dev` 0, `Electron test.js --ci` 0. Fixture
project deleted, `recentProjects` restored 32 → 31. Teardown announced to **all ten** peers the
launch went to.

⚠️ **One MCP server (32434) vanished across the window — not reaped.** Its *parent session* (32376)
is gone too, which is a session ending rather than a sweep; a reaped server leaves its parent alive.
⚠️ **My baseline for that comparison was truncated by a `head`**, so two servers looked new that had
been there all along. **Print the pids and count them, or the comparison is against a list you
cropped.**

---

## 3. FIX-016 §2 — what shipped and what the drive changed

Full detail in the task file. The parts worth carrying:

### 3a. The drive rewrote the message

Wording went out as *"Done is a value output with no Type set"* — accurate about the stored
`outtype-` parameter, which is genuinely absent. **The panel shows `String` anyway**, because the
proplist port declares `default: 'string'` and the enum widget renders the default. Measured live:
two Type rows, one stored `string` and one stored *nothing*, displaying **identically**.

🔴 **The spec and the code agreed, and both were wrong about the product.** A message that
contradicts the dropdown next to it reads as being about a different port. Final wording names what
the author sees: *"Done is a String output, not a Signal, so calling it throws when the node runs.
Set its Type to Signal in the property panel, or write `Outputs.Done = …` instead."*

### 3b. The runtime corroborated the premise unprompted

Beside message 5, on the same line, the editor already showed a `Last run` diagnostic:
**`Line 1: Outputs.Done is not a function`**. Four hops of source reading turned into a measurement
I did not have to construct.

### 3c. 🔴 Open: the diagnostic does not clear when you obey it

`setOpenNodeContext` is written **only when the popout opens** (`CodeEditorType.ts:343-354`).
Setting Type to `Signal` with the popout open leaves the warning standing — **and it survives a
forced `forceLinting`**, so the lint re-ran and read a stale port list. It clears on reopen.

Unique to message 5: messages 1-4 are about the *document*, which changes; message 5 is about a
**panel setting**, so **its own advice is the thing that does not take effect.** Cheap candidate
fix — re-publish the open node when its parameters change. **Not built; not a ruling; buildable.**

### 3d. Ruling 1 is answerable — I looked, and report it as an observation

Per output the panel renders: the name, then a nested row labelled only **`Type`**, holding a
dropdown. **It is present and visible without expanding anything.** So the report reads better as
*"I never found the Type dropdown"* than *"Signal is missing"* — direction 1 is discoverability, and
the small end of it. Two things make it easy to miss: the row says only `Type` with no mention of
Signal, and **it reads `String` whether or not anything is set**, so it looks already answered.
**That is what I saw; what it is worth is Richard's call.**

### 3e. The controls, and why the silent rows mean anything

Four known-broken controls, each killing a **different** row — unwire the rule (10 red), drop
`declared` (1 red), drop the signal-kind test (1 red), unanchor the `Outputs` object test (1 red).
A fifth removed the expression-mode gate (3 red, including message 5's).

🔴 **The first run was 52/52 green, which is exactly when a gate deserves distrust — and control B
caught a real hole.** `port.declared` was doing nothing that any spec observed; the row I thought
pinned it passes on the *kind* test instead. I had documented the scope boundary in prose and never
pinned it, so folding the underscore case in later would have gone unnoticed. **A comment is not a
control.**

🔴 **A diagnostic is a feature that can be *willing but never asked*** (session 21's framing, and it
was right). The fixture therefore carried a **second, known-firing** diagnostic beside the one under
test, so a silence is attributable: both → works; control only → predicate declined; neither →
nothing invoked the analysis. **Whenever you assert an absence, put something in the same run that
MUST be present.** Polling only distinguishes "not yet" from "not at all"; it cannot tell a
declining predicate from dead wiring.

---

## 4. What this session settled — do not re-derive

- **FIX-016 §2 is closed**, built *and* driven, with the message text driven twice (the second time
  because the first drive invalidated the wording).
- **FIX-016 is not blocked as a task.** §2 was always free. §1 needs a ruling I have now supplied
  the observation for; §3 needs the semantics ruling.
- **The declared row beats the mined one, and the call throws** — measured at every hop plus the
  runtime's own error message. Do not re-derive it from source.
- **The drive recipe from s22 still works verbatim** and I used it unchanged: `openProjectFromFolder`
  → router by fiber walk → `NodeGraphContextTmp.switchToComponent` → `NodeGraphNode.fromJSON` +
  `graph.addRoot` → `selectNode(VIEW node)` → click `.property-codeeditor-button` → `.cm-content`
  → `el.cmTile.view`. Two additions worth keeping:
  - ✅ **`@codemirror/lint`'s `forEachDiagnostic` / `forceLinting` are reachable** at
    `req.c['../../node_modules/@codemirror/lint/dist/index.js']`. That reads the **editor's own**
    lint state rather than re-running your function — the difference between driving and re-testing.
  - ✅ **Set the node's `functionScript` as a parameter before opening the popout.** No keys, no
    focus emulation, and the lint runs on mount. (Keys were not needed at all this session.)

---

## 5. What to do next and why

1. **FIX-016 §2's follow-up (§3c) — re-publish the open node when its parameters change.** Small,
   no ruling, and it fixes a message that currently tells the truth and then ignores you. **The best
   available build task**, and it improves messages 1-4 as well (a port *rename* has the same
   staleness).
2. **FIX-016 §1** — Richard now has the observation he needed (§3d). Ruling, then a small build.
3. 🔴 **FIX-017's remaining half needs Richard** — AC1 and AC3 are both rulings (§6). **Do not build
   §D speculatively.**
4. ✅ **Take `dev:stop -- --list` the next time a `test:ci` is genuinely live** — still owed; no
   suite ran this session. Pairs with (5).
5. 🟡 **Settle whether a live suite can share a pgid with a recorded dev group** — `ps -o pid,pgid`
   against the `groups` array in the pid file. Needs a live suite.
6. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
7. **FIX-013**, **FIX-016 §3** — open, each needs its ruling (§6).
8. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🟢 **NEW — FIX-016 ruling 1 is ready to decide.** The Type dropdown **is** visible per output
  without expanding anything (§3d), so this is discoverability, not absence. The two things that
  make it missable are that the row says only `Type`, and that it displays `String` whether or not
  anything is stored. Options: (a) offer Type at add time in `AddNameField`; (b) a one-line hint
  under `scriptOutputs` from `NOTATION_RULES`; (c) nothing — the new diagnostic may be enough, since
  it now names the exact fix at the moment the author gets it wrong.
- 🔴 **FIX-017 AC1** — a trigger **exists and fires** (Ctrl-Space / Alt-` / Alt-i, all driven) but is
  **invisible in the product**. 🔴 **Option (a) is weaker than it looks:**
  `com.apple.symbolichotkeys` key 60 is **enabled** on your machine and binds **Ctrl-Space** to
  "Select the previous input source", so copy naming Ctrl-Space would name a chord you cannot press.
  ⚠️ **One keystroke settles it** — press Ctrl-Space in a Function popout.
- 🔴 **FIX-017 AC3's ruling** — its premise is false (ports and API names never share a prefix).
  Restate against a prefix where the two surfaces genuinely compete, or strike it.
- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged through
  s18–s23; ten sessions have asked and none has claimed it. It backs `library:check`, and
  `cloud-library:check` **is a PR gate**. **Attribute it or bin it.** I did not touch it.
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one.
- 🔴 **FIX-016's signal-input semantics** (§3) — re-run the body vs named handlers, or rule signal
  inputs out and document `run` as the only trigger.
- ⚠️ **The ⌘C ruling** (carried by a peer): `keyboardhandler.ts:165` guards on **focus**, not
  selection.
- ⚠️ **MCP servers hold pre-rebuild code**; the **repackage** is separately owed.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance. `run_in_background` preserves it — I used it and it worked.
- 🟢 **NEW, and worth a decision: a lockfile written by `start.ts` at *intent*.** §7 documents a
  ~75-second window in which **no process check can be correct**, because the evidence does not
  exist yet. That is not a filter that needs improving; it is a hole no filter can close. Six
  sessions independently issued all-clears through it tonight.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — I lost four minutes to a `.logs/dev.log` that did not exist because
an earlier `cd` was still in effect; **use absolute paths**); **pathspec-scope every `git add` /
`git commit`** — the tree held **11 modified files from at least four sessions** while I worked.

⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — **leave them**.

### 🔴 The pre-flight has a ~75-second blind window — measured tonight

```
scripts/start.ts        ← dev launch, exists IMMEDIATELY
webpack (bare)          ← dev launch, ~8s
Electron . --dev        ← dev launch, ~75s
webpack.*test-ci        ← SUITE only
Electron test.js --ci   ← suite, ~40s after its webpack
```

🔴 **`Electron . --dev` is the LAST thing to appear.** A filter without `start.ts` reads a live
launching stack as an empty checkout for over a minute — and `webpack.*test-ci` **never** matches a
dev launch, so a filter assembled from suite patterns is blind twice over. Two peers issued me an
all-clear from inside my own launch window; several others' filters did include `start.ts`, by
inherited recipe rather than by design.

⚠️ **The two fixes are orthogonal and you need both** (peer-measured, and it defeats the tidier
answer): match on **`comm`** for what is already *running* — a checker's `comm` is `/bin/zsh` and
can never be the Electron binary, which kills the `ps | grep` self-match — but `comm` is
**structurally blind** to a launch, because during those 75 seconds *no process bears the Electron
`comm` at all*. Launch detection is argv-shaped and stays argv-shaped.
🔴 **Adopting the `comm` fix alone trades a false positive for a false negative, and the false
negative is the dangerous one: it reads as "clear" and gets someone to launch into a live stack.**

🔴 **This is why announcing is not redundant with measuring.** For the first minute after
"launching now", the process table cannot distinguish a peer who is starting from a peer who changed
their mind. Neither the check nor the announcement settles it alone; the pair does.

### Etiquette

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
🔴 **The LAUNCH list is the TEARDOWN list.** Building the close list from who *replied* reserved
this checkout for six hours against a finished session tonight, and blocked my launch on its behalf.
Silence is not release.

🔴 **A peer's all-clear is about THAT PEER** — but a *relayed announcement* from a third party is
real evidence a `ps` cannot supply. One peer's hold, based on someone else's announcement, was the
only thing standing between me and a launch I could not have known was unsafe. **Take those
seriously even when your own reading is clean.**

⚠️ **Reply to the SOCKET a message arrived on.** Peers are addressed by ListAgents display name and
reply by socket path, and **there is no verified join between the two** — I misattributed a finding
twice by inferring it. Two identifier spaces joined by a guess is the same failure as a process scan
that answers confidently about what it cannot see.

⚠️ `pgrep -af` does **not** print args on macOS. Use `ps -Ao pid,ppid,lstart,args` and grep that —
and 🔴 **print the pids rather than counting matches**: a `pgrep -f "webpack"` matches its own
command string, and a peer reproduced that false positive tonight *inside a check they were running
for me*.

🔴 **Exercise the DULL state, not just the interesting one**, and **run the control before believing
the probe**. ✅ **`/usr/bin/grep` calls a file with ⚠️ emoji "binary"** — pass `-a`, or a clean
source file reads as unsearchable.

✅ **A package-local jest run is the gate you can still take on a busy checkout.** `noodl-core-ui`'s
jest is plain Node, spawns no Electron, matches no `DEV_TOOL` pattern, ~1.5s.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key is **`recentProjects`**).
