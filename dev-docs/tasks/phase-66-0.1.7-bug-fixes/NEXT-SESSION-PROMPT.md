# Phase 66 — next session

**Amended 2026-08-16, session 30.** s30 wrote **no product code**; like s29 it repaired the phase's
own records, and it did so by taking s29's own advice — check the inherited status, don't inherit it.
🔴 **The item Richard had been asked about fourteen times — *"`scripts/library/check.ts` is
uncommitted and **unattributed**; attribute it or bin it"* — was answerable in ten seconds and is
now struck.** It was **never unattributed**: the diff names `LBR-002` in two of its own comments, and
phase 65's `TASKS.md` records it as done on 2026-08-15 with a result table. ✅ **Measured, not
inherited:** the gate passes — **58/58 clean, exit 0**, 2.2s.

🔴 **The mechanism is new and it is the part worth carrying (§3e): a standing instruction not to
*touch* phase 65's directory was obeyed as an instruction not to *read* it** — and the answer sat
inside the directory sessions were told to leave alone, adjacent in the same `git status` the item
was derived from. §6's wording is now fixed so it does not do this again.
⚠️ **The question did not vanish, it changed**: not *"attribute or bin"* but **"land it"** — see §5.

**Amended 2026-08-16, session 29.** s29 wrote **no code and ran no gate**; it repaired the phase's own
records. 🔴 **s28 handed over "everything is blocked on Richard"; that was false, and checking it was
the session's work.** [TASKS.md](TASKS.md) held **four stale rows** advertising ~14 acceptance drives,
a re-drive and a vocabulary sweep as owed when all were already done, and **§5 carried a ruling back to
Richard that he had made, and that was built and driven, on 2026-08-15** (the ⌘C item — struck).
Both are now reconciled; the full finding is **§3d**, which is the part worth carrying.
⚠️ **The count "fourteen closed" is retired in favour of names** — see §1.

**Written 2026-08-16, session 28.** Both of s27's 🟢 unowned loose ends (§5.6, §5.7) are **closed**;
**no gate was run, no product behaviour changed** — the only source edit is an error-message string in
a devtools script.

🔴 **The one finding worth carrying:** §5.7 was framed as *"one surviving candidate, one look
confirms it."* The look says the candidate is **FALSE**. All three candidates for s24's DOM null are
now dead and **the list has no survivors** — because the three-candidate list had silently replaced
an earlier **two-cause** list in the same file, and the earlier list's *instrument* cause was never
eliminated. **Three sessions ran elimination arithmetic over a list nobody had checked was
exhaustive.**

⚠️ **Everything else in §5 is blocked on Richard, not on an agent.** §6 is carried forward
essentially unchanged; nothing on it moved this session.

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

Neither s28 nor s29 built a feature or drove anything. ⚠️ **The rows below did not change state in
either session — but four of them were WRONG until s29 reconciled them against the task files (§3d),
and this table is where the corrected picture now lives.**

| Task | Built | Driven | Note |
|---|---|---|---|
| **FIX-016 §2** | ✅ | ✅ | **CLOSED `4be3f1f6`** + follow-up **`6de1ae25`** |
| **FIX-016 §1** | 📋 | ✅ **fully investigated** | Both open questions answered (s27 §3). Awaiting ruling (a) + (b) |
| **FIX-016 §3** | 📋 | — | Signal *inputs*. Needs Richard's semantics ruling. **The only part of FIX-016 genuinely blocked** |
| **FIX-017** | ◐ §A + §B | ◐ §B + §A(¾) | AC1 driven FALSE (s26). AC3 premise still false. **Needs Richard, not a build** |
| **FIX-014 / 019 / 001** | ✅ | ✅ | **CLOSED** s17–s18 |
| **FIX-002 / 003 / 007 / 009 / 010 / 011 / 012 / 018 / 020** | ✅ | ✅ | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

~~**Fourteen closed.**~~ ⚠️ **s29 replaced the count with names, because "fourteen" silently mixed
whole tasks with sub-items and cannot be checked.**

**Twelve tasks are closed outright:** FIX-001, 002, 003, 007, 009, 010, 011, 012, 014, 018, 019, 020.
**Three are partial:** FIX-008 (A/B/E closed; **C, D open**), FIX-016 (**§2 + §3c** closed; §1 awaiting
a ruling; **§3 open**), FIX-017 (§B closed; §A three-quarters, **AC1 does not close**).
**Six never started:** FIX-004, 005, 006, 013, 015, 021.

✅ **That is 21 rows and it reconciles against [TASKS.md](TASKS.md)** — which s29 had to repair first;
see §3d. Count the names if you need a number, and re-derive it from the table rather than copying
this line forward.

---

## 2. Gate readings

**No gate was run this session, and none was needed.** s28's only source edit is a template string
in `scripts/devtools/cdp.js`, which no gate covers and no product path imports. The floor below is
inherited and unmoved.

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed** at **seed 39393** — EXACT floor match | s25, tree `d0891746` |
| `noodl-core-ui` jest — full package | ✅ **25 suites / 444**, 0 failed | s24, `6de1ae25` |
| `noodl-core-ui` jest — `tests/code-editor/` | ✅ **18 suites / 327** | s24 |
| `tsc --noEmit` — `noodl-editor` | ✅ **0 errors** | s24 |
| `tsc --noEmit` — `noodl-core-ui` | ⚠️ **44**, all pre-existing | s24 |
| **`library:check`** (PR gate, `pr.yml:193`) | ✅ **58/58 entries clean, exit 0**, 49 warnings *named* | **s30**, working tree incl. the uncommitted LBR-002 diff |

⚠️ **The `library:check` row is the only gate s30 ran**, and it is here because §5's `check.ts` item
turned on it. **2.2 seconds, plain `ts-node`, no editor** — safe beside peers, so it needs no
announce. 🔴 **It was run against the WORKING TREE, which is the point**: CI runs the *committed*
version, so this reading says the unlanded change is good, **not** that CI is currently exercising it.

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`.

✅ **Checkout left FREE.** s28 launched no editor and ran no suite. ⚠️ **Ten peer sessions were live
on this checkout throughout** — nothing was announced because nothing was launched.

---

## 3. What this session settled — do not re-derive

### 3a. 🔴 s24's last candidate is FALSE — `scriptOutputs` WAS declared

Recorded in full in [FIX-016](FIX-016-THE-SIGNAL-OUTPUT-HIDDEN-IN-A-NESTED-ROW.md) (`2c923adb`).
The chain, all source plus s24's own contemporaneous table:

| # | link |
|---|---|
| 1 | the drive's `registry` column has exactly **one** producer — `CodeEditorType.ts:377` → `collectDeclaredPorts(node.parameters)`, published `:385` |
| 2 | every `PortFact.name` comes from a **`scriptOutputs` proplist row label** and nowhere else (`declaredPorts.ts:119-123`, `:90`) |
| 3 | an **absent** `scriptOutputs` decodes to `[]` (`listValueCodec.ts:214`) ⇒ no names |
| 4 | s24 recorded registry **`Done:*,Result:*`**, and its matrix labels two rows **"declared"** |

⇒ A fixture with no `scriptOutputs` **cannot** produce that reading. The `*` is literally
`DEFAULT_OUTPUT_TYPE` for a declared row with `outtype-` unset (`declaredPorts.ts:74`).

**All three candidates are dead. s24's null is fully unexplained** — a better state than the
*"one look from confirmed"* it was being carried as.

⚠️ **Two bounds, stated so they are not assumed away:**
- s24's fixture **no longer exists on disk** (no `project.json` under `NodeGX test projects/`
  contains `Outputs.Done`, 26 searched). This is a re-reading of their **record**, not their
  fixture. Decisive anyway, because the registry column has one producer.
- 🔴 `/usr/bin/grep -rn` **without `-a`** reported both functions had **no production caller**,
  which would have collapsed link 1. With `-a` both callers are there. **A "no caller" reading
  without `-a` in this repo is an instrument artefact, not a finding.**

### 3b. ✅ `cdp.js`'s viewer hint fixed — on grounds that need no disputed observation

`41c0c302`. The hint contradicted **its own module doc twenty lines above**, which already states the
in-editor preview is a `webview` target that `viewer` matches. That is self-contained, so the fix
does **not** rest on the always-on-webview observation no second session has reproduced. New wording
gives the precondition that does hold — *neither target exists before a project is open* — plus a
comment against restoring the old line.

### 3c. 🔴 The transferable shape — elimination over a list nobody checked

Three sessions crossed candidates off a list **one** session wrote, and each elimination made the
remainder look stronger. That arithmetic is only valid if the list is exhaustive, and nothing ever
checked — while the file held an older, non-overlapping list the whole time. ✅ **When you inherit a
candidate list, grep the file for an earlier one before crossing anything off.**

### 3d. 🔴 s29 — the phase index had drifted out of agreement with the phase, in the *safe* direction

**This session's whole result, and it was found by checking a summary rather than trusting it.**
s28's handover said the agent-actionable list was empty. Reading [TASKS.md](TASKS.md) against the
task files instead of against the handover found **four stale rows**, all understating progress:

| Row | the index claimed | the task file witnessed |
|---|---|---|
| **FIX-001** | open, ruling owed | **CLOSED s17**, 5/5 driven, 3 defects found and fixed |
| **FIX-002** | *"BUILT — NOT DRIVEN"*, 4 criteria + BLD-010 re-drive owed | all 4 driven s10–s12; re-drive **discharged** |
| **FIX-003** | *"BUILT — NOT DRIVEN"*, 5 criteria + drag-surface drives owed | all 5 driven s11–s13 |
| **FIX-019 14(a)** | 🟡 sweep still owed | **RULED s18: no sweep** |

So the index was advertising ~**fourteen acceptance drives, one re-drive and one vocabulary sweep as
outstanding when every one of them was already done.** Sessions 10–18 closed work in the task files
and never wrote it back. 🔴 **A stale status that *understates* is the dangerous direction here**,
because nothing about it looks like an error: it reads as honest, conservative bookkeeping, it never
claims a pass that isn't there, and the only cost — a session re-running drives that already
happened — lands on whoever picks it up. **Nobody audits caution.**

🔴 **And "driven" is not "passed."** FIX-003's five criteria were all *driven* while criterion 2 was
**failing** — the drive found ⌘C copying the selected canvas node instead of the selected text. Both
misreadings of that record are live: *driven ⇒ closed* hides a real defect, *not driven ⇒ do it again*
burns a session. Only the task file settles it.

⚠️ **The same drift put a ruling Richard had already made back on his own owed list** (§5, the ⌘C
item — struck this session). It survived four sessions because **its cited `keyboardhandler.ts:165`
still resolves and still reads exactly as described**: the fix added `selectionOwnsClipboardKey()`
at `:106`, wired at `:300`, rather than editing the quoted line. ✅ **A stale pointer that still
resolves is the kind that survives — check the claim, not just the line.**

---

### 3e. 🔴 s30 — "leave them" was obeyed as "don't look", and it hid an answer for eleven sessions

**This session's whole result.** §5 carried, s18–s29: *"`scripts/library/check.ts` is STILL
uncommitted and STILL **unattributed**. Fourteen sessions have asked, none has claimed it."*

🔴 **`git diff scripts/library/check.ts` answers it.** The diff names **`LBR-002`** in two of its own
comments — a doc comment on the new `warningLines` field and an inline comment at the print site —
and [phase-65/TASKS.md](../phase-65-the-library/TASKS.md) row 2 records
*"✅ Done 2026-08-15 (uncommitted)"* against a full result table. The change captures the warning
*diagnostics* rather than only `summary.warnings`, so the gate **names** its 49 warnings.

| what was checked | reading |
|---|---|
| attribution | **`LBR-002`**, twice in-file, plus phase-65 `TASKS.md` row 2 |
| does the whole diff belong to it | **yes** — `--stat` is 34+/4−, every hunk is `warningLines` |
| do the two new imports resolve | **yes** — `validation/index.ts:11` `export * from './diagnostics'`; defined `diagnostics.ts:693`, `:717` |
| does the gate pass | **58/58 clean, exit 0**, 2.2s |
| *"unchanged s18–s28"* | **TRUE** — mtime `2026-08-15 17:21`; last commit `4b3c95f7`, **08-06** |
| the cited gate | 🔴 **wrong one** — `cloud-library:check` is `scripts/cloud-node-library/generate.js`. The direct exposure is **`library:check`**, `pr.yml:193`, also a PR gate |

🔴 **The mechanism, which is new — a "don't touch" note became a "don't read" note.** §6 said phase
65's untracked directory *"belongs to neither this phase — **leave them**"*. That is right about
committing and was obeyed as advice about **looking**. The answer sat in the directory sessions were
told to leave alone — **adjacent in the same `git status` the §5 item was derived from.** §6 is
reworded.

⚠️ **And "unattributed" was never a fact about the file.** It meant *"nobody has claimed it in the
handover thread"* — a property of the conversation — and carrying it forward hardened it into a
property of the artifact. ✅ **When an owed item names a file, open the file before re-carrying it.**

⚠️ **Two calibrations against s29's finding.** (1) Same direction — the item **understated** the
risk, naming the wrong gate; the exposure was more direct than advertised, and *nobody audits
caution* claimed another eleven sessions. (2) But **not everything inherited had rotted**:
*"unchanged s18–s28"* held exactly. ✅ **Check inherited claims one at a time — they do not rot
together, and assuming they do is its own error.**

---

## 4. What to do next and why

1. 🔴 **Nothing in FIX-016 §1 should be built until Richard rules** (§5 (a) and (b)). Both questions
   are sized; (b) is much cheaper than the record long said.
2. 🔴 **FIX-017's remaining half needs Richard** — AC1 driven false, AC3's premise false. **Do not
   build §D speculatively.**
3. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
4. **FIX-013**, **FIX-016 §3** — open, each needs its ruling (§5).
5. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.
6. 🟢 **The only agent-actionable item left, and it is optional:** s24's null now has **one
   un-eliminated cause** — that their DOM query was aimed at the wrong panel
   (`propertyeditor.ts:207` sets `sidebar-property-editor`, verified). ⚠️ **Do NOT promote it to
   "the explanation" — that is the move that just cost three sessions.** There is already a
   counter-indication: the panel *body* is legacy but its *rows* are React (`PropertyPanelInput` is
   used from `DataTypes/BasicType.ts`, `EnumType.ts`, `Ports.ts`), and another session did read
   `PropertyPanelInput-module__Label` rows from the real DOM. **It needs its own measurement.**
   ⚠️ It also has **no live consequence** — the §2 fix is independent of it — so this is curiosity
   debt, not blocking work.
7. ✅ **The index reconciliation is DONE (s29, §3d) — do not re-run it.** [TASKS.md](TASKS.md) is
   current as of 2026-08-16 and every closed row now names its closing session and ruling.
8. ✅ **`check.ts` is settled as far as an agent can settle it (s30, §3e) — do not re-investigate.**
   Attributed, verified, gate passes. 🔴 **What remains is a commit, and it is Richard's call
   because the work is phase 65's** (§5).

🔴 **What s30 adds to how to start a session here.** s29's rule was *read the phase index against
the files it indexes*. s30's is one step further out: 🔴 **read the owed list against the artifacts
it names.** §5 is not a list of decisions — it is a list of *claims about things*, and claims about
things are checkable. One `git diff` retired an item that had been re-typed into fourteen handovers.
⚠️ **The next candidate on that list is the memory-index budget bullet, which already tells you to
re-measure rather than copy its figure** — s30 did, and it is still over.

🔴 **What s29 changes about how to start a session here.** *"Everything is blocked on Richard"* was
this handover's own summary and it did not survive twenty minutes of checking. **Do not take the
inherited status as the starting point — take the task files.** The cheap, high-yield first move is
to read the phase index against the files it indexes; s29 found four wrong rows and one wrongly-owed
ruling that way, having been told there was nothing to do. ⚠️ **The rest of §5 genuinely is Richard's**
— that part of s28's summary checked out — **but it was worth verifying rather than inheriting.**

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

🔴 **Do NOT re-run `test:ci` to "check"** — the floor is current at `d0891746`; s27 and s28 both ran
no suite and changed no covered source.
🔴 **Do NOT re-run the destructive `dev:stop` experiment** — it exists, `a905af94`.
🔴 **Do NOT re-file *"`cdp targets` hides webviews"*** — withdrawn s27, and the replacement hint is
now landed (`41c0c302`).

---

## 5. Owed by Richard

Carried forward from s27. **Nothing on this list moved this session** — none of it is agent-work.

- 🟢 **FIX-016 ruling 1 — two questions.**
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
- ~~🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged
  s18–**s28**; fourteen sessions have asked, none has claimed it.~~ 🔴 **ATTRIBUTED 2026-08-16 (s30)
  — it was never unattributed. The diff says `LBR-002` in two of its own comments**, and
  [phase-65/TASKS.md](../phase-65-the-library/TASKS.md) row 2 records it as
  *"✅ Done 2026-08-15 (uncommitted)"* with a full result table. It captures the warning
  *diagnostics* instead of only `summary.warnings`, so the gate names its 49 warnings instead of
  counting them.
  ✅ **Measured, not inherited** (s30, 2.2s, safe beside peers): `npm run library:check` →
  **58/58 entries clean, exit 0**, warnings now printed. The barrel re-exports both new imports
  (`validation/index.ts:11` `export * from './diagnostics'`; both defined at `diagnostics.ts:693`
  and `:717`). ⚠️ **`git diff --stat` is 34+/4− and every hunk is LBR-002** — no residue from
  anything else, so the attribution covers the whole diff, not part of it.
  ⚠️ **Two corrections to the struck text.** (1) The cited reason was the wrong gate:
  `cloud-library:check` runs `scripts/cloud-node-library/generate.js`, a *different* script.
  The direct exposure is `library:check` itself, **also a PR gate**, at
  [pr.yml:193](../../../.github/workflows/pr.yml#L193) — the risk was understated, not overstated.
  (2) *"Unchanged s18–s28"* **checks out**: mtime is **2026-08-15 17:21**, last commit touching it
  was `4b3c95f7` on **08-06**. It went dirty once, on 08-15, and has not moved since.
  🔴 **Still genuinely owed by Richard, but the question changed**: not *"attribute it or bin it"* —
  it is attributed and it passes — but **"land it."** ⚠️ s30 did **not** commit it: it is phase 65's
  work, a phase this session is not working in, and ten peers were live on the tree.
  🔴 **Unlanded work on a PR-gated script is exactly what a sibling's `git add -A` sweeps.**
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one.
- 🔴 **FIX-016's signal-input semantics** (§3) — re-run the body vs named handlers, or rule signal
  inputs out and document `run` as the only trigger.
- ~~⚠️ **The ⌘C ruling** (carried by a peer): `keyboardhandler.ts:165` guards on **focus**, not
  selection.~~ 🔴 **STRUCK 2026-08-16 (s29) — this was RULED, BUILT and DRIVEN on 2026-08-15, and had
  been sitting on Richard's list for four sessions asking for a decision he had already made.**
  Ruling: *a live text selection outside the canvas owns ⌘C/⌘X, whatever holds focus.* Built as
  `selectionOwnsClipboardKey()` — verified live in source at `keyboardhandler.ts:106`, wired at
  **`:300`**, with 9 specs of which 5 are negative controls — and driven passing (C1/C2/C3/C5).
  ⚠️ The line was **not wrong when written**, it was wrong when *carried*: `:165` really was the
  focus-based guard, and the fix added a new check rather than editing that line, so the cited
  line:number still reads exactly as described. **A stale pointer that still resolves is the kind
  that survives.**
- ⚠️ **MCP servers hold pre-rebuild code**; the **repackage** is separately owed.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance. `run_in_background` preserves it. Same file calls `dev:stop` "safe to
  run with a sibling worktree's stack up" and offers no warning on the by-pid alternative — **the
  doc should say the shields are what make either safe** (§6).
- 🟢 **The memory index still has no owner — and s28 measured it properly for the first time.**
  Budget is **17,510** and both counts must be under. Before s28's edit: **17,466 code points but
  17,553 UTF-16** — 🔴 **already 43 over on the UTF-16 measure, silently**, because emoji cost 2
  UTF-16 units each and only the code-point count was ever being checked. s28 added one pointer
  (144 units, unavoidable — an unlinked memory is invisible), leaving **17,609 / 17,697**.
  ✅ The safe lever remains **promote-then-collapse on a closed phase**, standing traps promoted out
  **first**; s28 declined to do it inside **P67**, a phase it is not working in. 🔴 **The index can
  no longer absorb a new pointer without a collapse. This needs a decision from you, not another
  session's restraint.**
  ⚠️ **s29 filed its finding INTO an existing memory rather than adding a pointer, precisely because
  of this** — and rewrote that pointer to carry the stronger trap in **fewer** characters, leaving the
  index **net −6 code points / −5 UTF-16** on the session. 🔴 **The decision is unchanged: still over
  on both measures.**
  ⚠️ **s30 re-measured (as this bullet instructs) and did the same thing again**: filed its finding
  into an existing memory, added **no** pointer, and paid for the one new clause by deleting a
  duplicate — item 3 of the *three distances* block was re-stating item 2's trap **and** cross-
  referencing it to the wrong file. Net **−8 / −8**. 🔴 **Still over on both measures, and two
  sessions of restraint have now bought back 14 characters against an 85-character overage.**
  **Restraint is not going to close this.** ✅ **Do not copy a figure from this bullet — re-measure**, since a frozen budget
  number under a standing item is the exact shape §3d is about:
  `node -e 'const s=require("fs").readFileSync(process.argv[1],"utf8");console.log([...s].length,s.length)' ~/.claude/projects/-Users-richardosborne-vscode-projects-OpenNoodl/memory/MEMORY.md`
- 🟢 **A lockfile written by `start.ts` at *intent*** — the ~75s window in which no process check can
  be correct is a hole no filter can close.

---

## 6. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add` / `git
commit`** — the tree held modified files from at least four other sessions throughout s28's window,
and both s28 commits were pathspec-scoped for exactly that reason.

⚠️ `dev-docs/tasks/phase-65-the-library/` and the phase-67 `UNI-011` file are untracked and belong to
neither this phase nor 67 — **do not commit or modify them.** 🔴 **But DO read them.** s30 rewrote
this line: it previously said *"leave them"*, and eleven sessions obeyed that as *"don't look"* while
the answer to an item on Richard's owed list (§5, `check.ts`) sat inside the phase-65 directory the
whole time. **They are another phase's live records, and they are adjacent in the same `git status`
these items get derived from.**

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
identical to a quiet checkout.

### 🔴 Attribute by PPID, never by the `electron/dist` path

~25 Electron processes from this checkout at idle are **MCP servers**, one pair per live session —
every PPID is that session's socket number.

### 🔴 grep in this repo needs `-a`

`/usr/bin/grep` without `-a` skips source files here as "binary" (emoji / NUL bytes) and reports a
**clean null**. s28 nearly recorded "this function has no production caller" from one. ⚠️ `pgrep -af`
does **not** print args on macOS — use `ps -Ao pid,ppid,lstart,args` and print pids rather than
counting.

### Etiquette

**Announce before *and* after any `test:ci`, `test:main` or editor launch.** 🔴 **The LAUNCH list is
the TEARDOWN list**, and a correction must reach **everyone the claim reached** — a claim propagates
further than its retraction by default, and the gap is where stale facts live.

⚠️ **Re-take `ListAgents` at both ends** — a roster goes stale *inside* an announce window. Prune
only on an explicit "I'm elsewhere", never on silence.

🔴 **Do not send to both the name and the socket.** ✅ **Reply on the socket a message arrived on;
announce once to the names.**

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key **`recentProjects`**) —
**after** the editor is down, since it rewrites the file on exit. ⚠️ A copied project keeps the
original's **name**; rename it on disk or you cannot tell the cards apart.
⚠️ **s28 note:** fixture cleanup is why s24's fixture could not be re-measured. When a drive's
fixture backs a **contested** reading, say so in the task file before deleting it.
