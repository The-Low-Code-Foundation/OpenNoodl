# Phase 66 — next session

**Written 2026-08-15/16, sessions 23 + 24 + 25** (s23 wrote §3a–3e; s24 wrote the follow-up; s25 took
the gate and closed §5 items 1b, 4 and 5, with several peers editing this file concurrently
throughout). **FIX-016 §2 is CLOSED (`4be3f1f6`) and so is the wrinkle it found (`6de1ae25`)** — the
diagnostic now clears the moment you obey it. Fourteen tasks closed.

🟢 **s25: `test:ci` is no longer stale — 2843 / 6 at seed 39393 on `d0891746`, an EXACT floor match**
(§2). It was two trees behind and `CodeEditorType.ts` had **no gate at all**. ⚠️ Read §2 for what
that does *not* prove. **Do not re-run it to check**, and 🔴 **do not re-run the destructive
`dev:stop` experiment either — it exists, `a905af94`** (§5 item 4).

🔴 **A third finding joins the two below, and it is the one this session would most want carried:
an UNDER-claim is as false as an over-claim, and far harder to catch.** I broadcast *"the sweep fix
is proven at the enumeration layer only; the kill step is still a code read"* to ten sessions. The
kill step had been measured **two hours earlier** (`a905af94`). ⚠️ **Every other error tonight ran
toward over-claiming and was caught within minutes, because an over-claim attracts scrutiny.** A
caution does not — *"we haven't proven that yet"* is the shape nobody argues with, so nobody
re-verifies it. Four separate sessions carried that stale caveat, two of them holding the
contradicting commit in their own notes. **Its cost is invisible by construction: it sends people to
re-measure the known, or keeps a working fix behind a gate it has already passed.** ✅ **The rule:
a retraction is itself a claim about the state of the evidence — re-check the shared record
immediately before broadcasting a correction, not only before making one.**

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

**Tree: `d0891746`** (s25's `test:ci`); the jest/`tsc` rows are `6de1ae25` (s24), s23's at `4be3f1f6`.
⚠️ **Quote a TREE, not a session** — three sessions wrote this table and the rows are not all at the
same commit.

| Gate | Reading | When |
|---|---|---|
| `noodl-core-ui` jest — full package | ✅ **25 suites / 444**, 0 failed | **s24, `6de1ae25`** (was 24/419 at `4be3f1f6`) |
| `noodl-core-ui` jest — `tests/code-editor/` | ✅ **18 suites / 327** | s24 (was 17/302) |
| `tsc --noEmit` — `noodl-editor` package | ✅ **0 errors** | s24 |
| `tsc --noEmit` — `noodl-core-ui` package | ⚠️ **44**, unchanged, **0 in any edited file** — all pre-existing, all in `noodl-editor` sources | s24 |
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed** at **seed 39393** — **EXACT floor match** | **s25, tree `d0891746`, finished 00:00** |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`. s25 quoted all six in full and the set is **identical** to the floor.

⚠️ **`CodeEditorType.ts` (`6de1ae25`) — say this one precisely, because I first wrote it too
strongly.** The run proves **the editor still boots and the existing 2843 still pass with that file
changed**. It does **not** exercise the file's own behaviour: `test:ci` has never covered
`CodeEditorType.ts` directly, and *"outside jest's reach"* was the reason for the run — it is still
outside the suite's reach too. 🔴 **This is the absence of a collateral signal, not a test of the
change.** The 6/6 drive remains the only thing that exercised the behaviour. (Caught by a peer;
my first wording said "no regression — the gap is closed", which is the same over-claim as item 4's,
one level down and made while recording item 4's correction.)

✅ **Two disciplines worth copying from that run.** The results file's **mtime was 00:00, after the
23:48 start**, so it is provably that run's rather than a stale artefact reading as a perfect pass.
And the total holding at exactly 2843 was **predicted, not hoped for** — a peer first checked that
no commit since the floor touched `packages/noodl-editor/tests/` (verified here:
`git log 4be3f1f6..HEAD -- packages/noodl-editor/tests/` is empty). **So the usual "the count
drifted, it's probably age" hedge was neither needed nor used** — which is the difference between a
floor comparison that means something and one that absorbs any result.

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
  - 🔴 **The view is `el.cmTile.view` on `.cm-content` — this line said `el.cmView.view` and was
    wrong**, while §4 above said `cmTile`, so the file contradicted itself and a reader had to guess.
    Corrected against three independent measurements: two drives tonight (s23's popout read and s26's
    §1 drive, which hit this and said so), and `driving-the-codemirror-editor-over-cdp.md`, which
    records `Object.getOwnPropertyNames(el) === ['cmTile']` and names `.cmView` as the wrong guess.
    ⚠️ **The handle is non-enumerable**, so a `for…in` or a casual `Object.keys` finds neither name
    and invites exactly this mistake.
  - ✅ **Count lint runs by appending an update listener at runtime**:
    `view.dispatch({ effects: StateEffect.appendConfig.of(EditorView.updateListener.of(cb)) })`.
    ⚠️ **That append itself schedules a lint** — wait it out and reset the counter before measuring,
    or your control starts dirty.

---

## 5. What to do next and why

1. ✅ **DONE — FIX-016 §2's follow-up closed `6de1ae25`**, driven 6/6. Both faults fixed together,
   which was the point: either alone leaves the symptom unchanged. **Start at item 1b.**
1b. ✅ **DONE — `test:ci` taken at `d0891746`: 2843 / 6, EXACT floor match** (s25, finished 00:00).
   **Do not re-run it to "check"** — it is the current tree and the six are named in §2.
   ⚠️ What it does **not** show is in §2: the suite has never covered `CodeEditorType.ts` directly,
   so this is the absence of a collateral signal, not a test of the change.
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
4. ✅ **DONE — `dev:stop -- --list` taken with a suite GENUINELY LIVE** (session 25, during its
   `test:ci`). Owed for several sessions; now closed. **9 live suite processes including the Electron
   host → 0 targets**, and — the part that makes it mean anything — **a decoy matching `DEV_TOOL` +
   repo root but not `NEVER_SWEEP` was found as 1 target under identical conditions**, suite alive
   after both. 🔴 A bare "0 targets" is equally consistent with *the shield worked* and *the tool
   found nothing*; the decoy is what makes the null attributable.
   🔴 **CORRECTED — I over-claimed this, and backwards.** I wrote *"…**not just at the enumeration
   layer**"*. `--list` **is** the enumeration layer; it kills nothing. This run proves
   **`findDevProcesses` excludes a real live suite**, Electron host included — no more.
   *"The fixes hold up"* silently adds *`sweep()` kills exactly what `findDevProcesses` returns*, a
   **code read**, over a `sweep()` with **two** kill paths. Same shape as `d061bc6e`: correct to
   three readers, and inert.

   ⚠️ **But do not swing to the opposite error, which I nearly published.** The **kill** layer *has*
   been measured — `a905af94`, a real non-dry `dev:stop` in which a **shielded decoy survived while a
   control decoy died**. So both layers are measured and neither rests on a code read.
   ✅ **The honest residual is narrow: a decoy stood in for the suite at the kill layer.** Say that,
   not "the fixes hold up", and not "the kill path is unverified".
   ✅ **Corroborated from a second session (s24):** `ps -o pid,pgid,ppid` on all seven reported pids
   confirmed a single group, PGID **29984**. ⚠️ **That run also works as the peer-attribution
   example** — the group leader's **PPID is 25417, which is the announcing session's own socket
   number**. So *"whose stack is this?"* is answerable **without trusting the announcement**: the
   socket filename is a live pid, and a stack's wrapper points back to it. **Walk `ppid` to the
   Claude pid rather than inferring ownership from a display name** (§7's identifier-space ⚠️).
5. ✅ **DONE — the same-session case is MEASURED, and the worry behind this item is false.** This
   entry previously called *"a suite started from the same session that has a recorded dev stack"*
   the dangerous untested case. It is testable without a dev stack, and s25 tested it by accident:
   the `dev:stop` decoy and the suite came from **two Bash calls in the same Claude session**
   (pid 25417).

   ```
   suite wrapper  29984   pgid 29984    ← /bin/zsh -c …, its OWN group leader (pgid == pid)
   decoy          33745   pgid 33743    ← a different /bin/zsh -c, a different leader
   ```

   🔴 **Every Bash-tool invocation is its own process-group leader**, so two calls from one agent
   session **never** share a group. ✅ **Independently reproduced in a different session** (pid 4409:
   `40634/40634`, `40750/40750`), which makes it a property of **how the harness spawns shells**
   rather than a fact about s25's suite. The rationale committed with `4fd2cfdb` — *"agent sessions
   start both from the same non-interactive shell, where job control is off and children can share a
   group"* — **has been retracted by its own author.**

   ⚠️ **The guard stays, and the reason is the lesson.** They dropped the group *rather than
   reasoning about whether the collision could occur*. Arguing "safe by topology" and skipping it
   would have been **right by luck and wrong in method** — which is exactly what `e8a55109` was, and
   what failed twice in this file already. A guard defending an unreachable case costs nothing.

   🟡 **Two residuals survive, and they are NOT symmetric — one has a named user:**
   - 🔴 **One shell invocation.** Unreachable from an agent session per the above — but **Richard
     works from an interactive terminal**, where job control groups children together. So the case
     the measurement excludes is precisely *his*, and he has no announcement protocol. For him
     `4fd2cfdb`'s group-drop is the **operative** path, not defence in depth.
   - 🔴 **pgid reuse** — a stale pid file naming a dead leader whose number is later recycled.
     **Rank this live, not remote: pids demonstrably wrapped on this machine on 08-15.**

   ✅ Under either, `sweepableGroups` drops any recorded group containing a shielded process
   (`dev-processes.js:310-320` — a **code read**, labelled as one), so the failure direction is a
   **leftover to kill by pid**, not a destroyed run.
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
- 🟢 **NEW — the memory index has no owner, and that is the actual problem.** `MEMORY.md` is
  **20,956 bytes** against a 17,100 target (hard read limit ~24,400). 🔴 **It gains bytes from every
  session and loses them from none** — a dozen sessions tonight each added a defensible line and no
  single addition was wrong. Compaction is nobody's task, so it happens only when a size hook
  shouts, and a hook that shouts at whoever is mid-task gets deferred by exactly the people best
  placed to act on it. ⚠️ **Not an agent's call:** "what do we stop carrying" is a judgement about
  what is still worth knowing, and three sessions were editing the file within the hour, so a
  rewrite would clobber someone. ✅ **The safe lever is promote-then-collapse on a closed phase**,
  and it needs a **date** rather than a judgement about what is still true. ⚠️ **But it saves
  ~1.5–2 KB, not the 4,289 the block measures.** Phase 66's section links **18 files and only ~6 are
  phase facts** — the rest are standing traps that merely happened to be *found* during it (`grep`
  skipping source as binary, `Connect` writing the live `~/.claude.json`, the MCP surface budget two
  other phases depend on, four general judgement traps). **Those pointers must be promoted into the
  standing sections first**, or the collapse is a silent deletion: `MEMORY.md` is the only file
  loaded, so an unlinked memory survives on disk and is invisible in practice.
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

### ✅ Match the breadth of the check to the direction of the claim

**~20 sibling worktrees exist** (`~/vscode_projects/OpenNoodl-worktrees`: `fix002-lane`,
`lgc-001`…`008`, `vfn-e/f/g/h`, …), and the standard patterns — `scripts/start.ts`,
`Electron \. --dev`, `test\.js --ci` — match on **argv shape, not on which checkout**. So they
match a **superset** of this checkout's processes. That is not a bug to fix; it is a property to
use, and getting it backwards is what produced two opposite scoping errors in one evening:

| the claim you are making | what you need | why |
|---|---|---|
| **"nothing is running"** (a null) | a **BROAD** match | 0 in the superset ⇒ 0 in the subset. **An over-broad instrument makes an all-clear SOUND** |
| **"something is running, and it's MINE"** (a positive) | a **PATH-SCOPED** match | otherwise it may be a sibling worktree's process — `pgrep -f "OpenNoodl/node_modules/electron/dist.*--dev"`, or `ps -p <pid> -o command` against the repo root |

🔴 **The two failure directions are not equally bad.** An over-broad check yields sound negatives
and unsound positives — it can make you **wait** for a stack that isn't yours. An under-broad check
(the `comm` fix above, blind for 75 seconds) yields **unsound negatives** — it reads as *clear* and
gets someone to launch into a live stack. **Only one of them can hurt anybody.** So err broad for
an all-clear, and scope tightly only when you are about to attribute or kill something.

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
