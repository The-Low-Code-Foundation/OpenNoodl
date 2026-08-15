# Phase 66 — next session

**Written 2026-08-15, sessions 23 + 24** (s23 wrote §3a–3e and kept editing while s24 worked; s24
wrote the follow-up and this header). **FIX-016 §2 is CLOSED (`4be3f1f6`) and so is the wrinkle it
found (`6de1ae25`)** — the diagnostic now clears the moment you obey it. Fourteen tasks closed.

🔴 **Two findings outlive this phase, and the second was found by correcting the first.**

**a. The drive rewrote the message it was sent to confirm.** *"A value output with no Type set"* is
true of the stored parameter and **false on the author's screen** — the panel renders the enum's
`default: 'string'`, so a port with nothing stored displays `String`. **No spec could have caught
it: the spec and the code agreed with each other and both were wrong about the product.** §3a.

**b. 🔴 An entire diagnosis sat downstream of a call that never ran.** `forceLinting` was reported
as evidence the lint re-ran against stale ports. `force()` is `if (this.set)` and nothing else — on
an idle editor it does **nothing**. Measured: `forceLinting` alone → **0 view updates**,
`requestRelint` → **2**. §3c.

⚠️ **The two compound, and that is the transferable part.** The wrong mechanism pointed at *one* of
**two independent faults, either alone sufficient for the symptom** — so building the fix it named
would have changed nothing on screen, and "no change" reads as *wrong cause* when it was *a* cause.
A live defect gets re-filed as a mystery that way. 🔴 **Replication cannot rescue it**: a second
reading from the same dead instrument agrees with the first. What separates them is a **positive
control on the tool**, not another measurement from it.

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
| **FIX-016 §2** | ✅ | ✅ **3/3 + control** | **CLOSED `4be3f1f6`.** The wrinkle it found — the diagnostic not clearing when you obey it — is **also CLOSED, `6de1ae25`**, by the peer who corrected my mechanism for it (§3c) |
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

**Tree: `6de1ae25`** (s24). The s23 column is at `4be3f1f6`.

| Gate | Reading | When |
|---|---|---|
| `noodl-core-ui` jest — full package | ✅ **25 suites / 444**, 0 failed | **s24, `6de1ae25`** (was 24/419 at `4be3f1f6`) |
| `noodl-core-ui` jest — `tests/code-editor/` | ✅ **18 suites / 327** | s24 (was 17/302) |
| `tsc --noEmit` — `noodl-editor` package | ✅ **0 errors** | s24 |
| `tsc --noEmit` — `noodl-core-ui` package | ⚠️ **44**, unchanged, **0 in any edited file** — all pre-existing, all in `noodl-editor` sources | s24 |
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed** at **seed 39393** | **s21, 21:21** — still not re-run |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

⚠️ **`test:ci` is now TWO trees stale and one of the s24 files is in `noodl-editor`**
(`CodeEditorType.ts`), which jest does **not** cover. The change is small and the editor ran with 0
renderer exceptions through a full drive, but **that is not the same as the suite**. Taking it is
the first thing worth doing on a free checkout — and it pairs with items 4 and 5 in §5.

✅ **Checkout left FREE (s24).** `dev:stop` stopped 26 processes; verified after with the §7 filter:
`start.ts` 0, bare `webpack` 0, `Electron . --dev` 0, `Electron test.js --ci` 0. Fixture project
deleted, `recentProjects` restored 32 → 31. **Teardown sent to all nine surviving launch-list names
AND to the four sockets that wrote to me** — see the identifier-space ⚠️ in §7; sending to both is
how you stop guessing.

🔴 **CORRECTED — the `preflight-*` sessions were never in this checkout, and I announced to them
anyway.** `preflight-04` replied that it works in `~/vscode_projects/preflight`, a pnpm/Next.js repo
with no Electron, no webpack and no `cline-dev`. So `preflight-db/-d4/-b6` were almost certainly the
same, and my "twelve peers" was **a count of Claude sessions on the machine, not in the checkout**.

⚠️ **The noise is harmless; the arithmetic is not.** "Announced to all twelve" reads as coverage of
the checkout and was coverage of the *machine*. The set that matters is smaller **and is not
derivable from `ListAgents`** — so a name-based launch list can be over-broad and still miss someone.
✅ **A session is in this checkout only if it says so, or if you walked `ps -Ao pid,ppid` from a
process in this tree to its pid.** Ask; do not infer from the name.

⚠️ Also real: a new session (`preflight-04`) started **inside my drive window** and so was never on
the launch list at all. **A launch list goes stale in both directions.**

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

### 3c. 🔴 Open: the diagnostic does not clear when you obey it — ⚠️ **mechanism CORRECTED**

Setting Type to `Signal` with the popout open leaves the warning standing; it clears on reopen.
Both measured.

🔴 **I published the wrong mechanism for it, and the wrong mechanism implies a fix that does
nothing.** I wrote *"it survives `forceLinting`, so the lint re-ran and read a stale port list."*
The survival is real; the inference is false. **`forceLinting` is a no-op on an idle editor** —
`force()` runs only `if (this.set)`, and `update()` sets `set` only on `docChanged` / config change
/ `needsRefresh`; at `4be3f1f6` `linter()` took **no second argument**, so `needsRefresh` was null.
**The lint did not read a stale list — it did not run.** (Peer's catch; I verified it in
`@codemirror/lint/dist/index.js:304-326` and against my own commit.)

⚠️ **A stale read and a lint that never happens look identical from outside, and my probe could not
tell them apart** — I reported one as measured. Same rule this phase already carries: *a reading
that fits is not one that excludes.* Ask what you would see if you were wrong; if it is the same
thing, you measured nothing.

🔴 **Two independent faults, either alone reproducing the symptom:**

1. **Stale registry** — `setOpenNodeContext` is written only at popout-open
   (`CodeEditorType.ts:343-354`, sole producer). From source, not from my drive.
2. **Unreachable linter** — neither lint source is a pure function of the document, but without
   `needsRefresh` the linter re-runs on document edits only.

**Republishing the node alone fixes nothing** — the linter would never re-run to notice. Reopening
worked because it cures both. ⚠️ **The same hole was swallowing FUN-007 §2's runtime diagnostic**:
`CodeEditorType.ts:421-429` claims a run's error reaches the gutter while the popout is open; it
reached React and stopped. The `Last run` row in §3b was visible only because the **mount-time** lint
runs after the field is written.

✅ **CLOSED `6de1ae25`** — a peer caught the mis-stated mechanism and built both halves
(`needsRefresh: lintNeedsRefresh` + `utils/relint.ts`, 11 files, +583). Verified on the merged tree:
**25 suites / 444, 0 failed.** The diagnostic now clears the moment you set Type to `Signal`, popout
open, document untouched — driven 6/6 by them.

✅ **They ran the control I did not**: `forceLinting` alone → **0 view updates**; `requestRelint` →
**2**. That is the measurement that separates *"ran against stale data"* from *"never ran"*, and it
is one call.

### 3d. Ruling 1 is answerable — I looked, and report it as an observation

Per output the panel renders: the name, then a nested row labelled only **`Type`**, holding a
dropdown. **It is present and visible without expanding anything.** So the report reads better as
*"I never found the Type dropdown"* than *"Signal is missing"* — direction 1 is discoverability, and
the small end of it. Two things make it easy to miss: the row says only `Type` with no mention of
Signal, and **it reads `String` whether or not anything is set**, so it looks already answered.
**That is what I saw; what it is worth is Richard's call.**

⚠️ **Two limits on it, both mine, before anyone rules:** I measured the **rendered DOM** and
**never opened either dropdown** — so *"the row is visible and reads `String`"* is driven, while
*"it offers Signal"* is still only a source read. And a peer's fixture showed **no** `Type` row at
all; they put that down to my node being "normally created", but **mine was `fromJSON` too**, so
that explanation is wrong and the discrepancy is unexplained. Full note in the task file.

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

  **s24 additions — all four were needed and none is in the s22/s23 recipe:**
  - 🔴 **`window.__webpack_require__` does NOT exist.** Get the module cache with
    `webpackChunknoodl_editor.push([['x'], {}, (r) => { window.__req = r }])`, then `req.c[...]`.
    2375 modules, keyed by source path.
  - 🔴 **`openProjectFromFolder` alone does not navigate.** It builds the model; the editor stays on
    the projects page and `NodeGraphContextTmp.switchToComponent` is **null** until the editor page
    mounts. You also need `LocalProjectsModel.instance.loadProject(entry)` then
    `router.route({ to: 'editor', project: loaded })`. The router is 3 fibers deep from `#root` —
    look for `memoizedProps.route.router`.
  - ✅ **The view is `el.cmView.view` on `.cm-content`**, not `el.cmTile.view`.
  - ✅ **Count lint runs by appending an update listener at runtime**:
    `view.dispatch({ effects: StateEffect.appendConfig.of(EditorView.updateListener.of(cb)) })`.
    ⚠️ **That append itself schedules a lint** — wait it out and reset the counter before measuring,
    or your control starts dirty.

---

## 5. What to do next and why

1. ✅ **DONE — FIX-016 §2's follow-up closed `6de1ae25`**, driven 6/6. Both faults fixed together,
   which was the point: either alone leaves the symptom unchanged. **Start at item 1b.**
1b. 🟢 **Take `test:ci` — it is two trees stale and one s24 file is outside jest's reach** (§2).
   Cheapest real risk on the board, needs only a free checkout, and it clears the way for 4 and 5.
2. **FIX-016 §1** — Richard now has the observation he needed (§3d). Ruling, then a small build.
   ⚠️ **Before building anything here, settle the `Type`-row question — it decides what Richard is
   ruling on.** ✅ Half is settled: `outtype-` is in **zero** editor source files, so a `getPorts()`
   absence is no evidence about the row and the two sessions' readings were about different objects.
   ⚠️ The remaining null has **two candidate causes, undiscriminated** — a React-shaped query against
   what is actually the **legacy** `sidebar-property-editor` view, or the rows needing a **live
   viewer** to register the dynamic ports. **One drive settles it:** preview running, node live,
   query `.sidebar-property-editor`. Present ⇒ ruling 1 is the copy question. Absent ⇒ a render
   defect, and the copy ruling would be answering the wrong question.
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
  s18–**s24**; eleven sessions have asked and none has claimed it. It backs `library:check`, and
  `cloud-library:check` **is a PR gate**. **Attribute it or bin it.** Neither of us touched it.
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

🔴 **And the s24 addition, which is the sharper form of "run the control": before trusting a NULL
result, prove the instrument can produce a non-null one.** A tool that silently declines and a tool
that ran and found nothing return the same thing. ⚠️ **Measuring again does not help** — the same
dead instrument agrees with itself, and two agreeing readings feel like confirmation. This is not
hypothetical here: it is how `forceLinting` produced a mechanism that was written into a task file,
a handover and the memory index (§3c).

✅ **A package-local jest run is the gate you can still take on a busy checkout.** `noodl-core-ui`'s
jest is plain Node, spawns no Electron, matches no `DEV_TOOL` pattern, ~1.5s.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key is **`recentProjects`**).
