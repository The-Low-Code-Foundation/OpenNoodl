# Phase 66 — next session

**Written 2026-08-16, session 26.** §5 item 2 is **driven and closed**: the blocking question under
FIX-016 §1 is answered, and the answer was **neither** of the two candidate causes on record.
Fourteen tasks remain closed; nothing new was built, one thing was measured.

🔴 **Read §3 before §1. This session produced a good finding and then over-claimed it three separate
ways, and every correction came from a peer within the hour.** The finding survives; two of the three
things I said *about* it did not. If you take one thing from this file, take the shape: **a control
pair proves what you varied, and nothing about what you held constant** — and I wrote a headline
about the variable I held constant.

🔴 **The correction that would cost the most if it propagates: I said the mined node throws at
runtime. It does not.** The parser types a call-shaped `Outputs.Done()` as **signal**
(`javascriptnodeparser.js:353-356`), so that node works and §2's diagnostic is *right* to stay quiet.
I had it backwards, and stated broadly it would send someone to loosen `declared` and start warning
about **correct code**. The real gap is one row of a two-row table (§3b).

⚠️ **And one about the checkout, not the product, because it reads as a safety technique and is the
opposite:** *"kill your own launcher pid instead of `dev:stop`, so nothing of anyone else's is
touched"* is **false**. `scripts/start.ts:74` spawns `dev-watchdog.js`, which on the launcher's death
calls `sweep({ protectAncestors: false })` (`dev-watchdog.js:44`) — the same checkout-wide sweep,
with a protection `dev:stop` leaves **on**. My teardown was clean because `2b758a87`/`4fd2cfdb`
shield MCP and suites, **not** because of the command I chose. A peer has the measured incident: a
session killed only its own two pids and a peer's `test:ci`, started four minutes later, died with
it.

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
| **FIX-016 §2** | ✅ | ✅ | **CLOSED `4be3f1f6`** + follow-up **`6de1ae25`**. ⚠️ s26 found its **reach** is narrower than assumed — §3b |
| **FIX-016 §1** | 📋 | ✅ **investigated** | **The blocking question is ANSWERED (§3).** Ruling now sizeable — and it is **two** questions, not one |
| **FIX-016 §3** | 📋 | — | Signal *inputs*. Needs Richard's semantics ruling. **The only part of FIX-016 ever genuinely blocked** |
| **FIX-017** | ◐ §A + §B | ◐ §B + §A(¾) | **AC1 now driven FALSE** (§3c) — the `+` affordance offers a name field only. AC3 premise still false |
| **FIX-014 / 019 / 001** | ✅ | ✅ | **CLOSED** s17–s18 |
| **FIX-002 / 003 / 007 / 009 / 010 / 011 / 012 / 018 / 020** | ✅ | ✅ | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Fourteen closed.** s26 built nothing — it spent its window on one measurement and three retractions.

---

## 2. Gate readings

**No gate was run this session.** The floor below is inherited and still current; s26 ran no suite,
so nothing it did can have moved it.

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 / 6 failed** at **seed 39393** — EXACT floor match | s25, tree `d0891746` |
| `noodl-core-ui` jest — full package | ✅ **25 suites / 444**, 0 failed | s24, `6de1ae25` |
| `noodl-core-ui` jest — `tests/code-editor/` | ✅ **18 suites / 327** | s24 |
| `tsc --noEmit` — `noodl-editor` | ✅ **0 errors** | s24 |
| `tsc --noEmit` — `noodl-core-ui` | ⚠️ **44**, all pre-existing | s24 |

🔴 **Quote the six `test:ci` failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`,
2 × `AI model registry`. Reproduced twice, four hours apart.

✅ **Checkout left FREE.** Launcher pid killed, then `ps` 0 across `start.ts` / bare `webpack` /
`Electron . --dev` / `test.js --ci` — **with a positive control on the same pipeline matching 66
lines**, so the four zeros are attributable rather than a dead instrument. ⚠️ **11 Electron
processes from this checkout remain and none is a dev stack**: every PPID is a peer session's socket
number, i.e. MCP servers. **Match on `--dev` argv, never on the `electron/dist` path.**

---

## 3. FIX-016 §1 — what was driven, and what I got wrong about it

### 3a. The finding: the Type row is gated on a DECLARED `scriptOutputs` row

Control pair in one component, live preview, identical script `Outputs.Done(); Outputs.Result = 42;`:

| node | `scriptOutputs` | `.sidebar-property-editor` |
|---|---|---|
| **A** | `[{so1,Done},{so2,Result}]` | `SCRIPT OUTPUTS │ Done │ Type │ Result │ Type` — both read `String` |
| **B** | absent (outputs mined from text) | `SCRIPT OUTPUTS │ ` — **empty. 0 rows, 0 inputs** |

Paired, re-read after an intervening popout open/close, identical both times, screenshots taken.
Source names the gate: `simplejavascript.ts:792-793` builds the `outtype-` port only inside
`if (scriptOutputs !== undefined && scriptOutputs.length > 0)`.

🔴 **CORRECTION C4 — I wrote that this "explains both previously conflicting readings". It does not,
and that sentence is C1's error committed one step further on.** It is the *tidiest* story, and
nothing forbids writing it down, but s24's null was never varied against anything. **Three live
candidates, and this drive separated none of them:**

1. their fixture never declared `scriptOutputs`;
2. **the runtime axis I withdrew in C1** — declared-but-no-live-preview is untested, and s24's null
   sits in exactly that cell;
3. a **fixture artefact** — `fromJSON` + `addRoot` writes the *editor's* model, while
   `_managePortsForNode` is registered on a **runtime's** graphModel.

✅ What is settled is only that **declaration is necessary**, which is the ruling-relevant fact and
enough to unblock §1. (Peer's catch, `c6ce10fd`.)

🔴 **CORRECTION C1 — "…and NOT on a live viewer" is unsupported, and I broadcast it.** My preview was
live in **both** arms, so the viewer never varied and **cannot have been tested**. The source puts it
upstream: `_managePortsForNode` is registered only inside
`graphModel.on('editorImportComplete', …)` on a **runtime's** graphModel
(`simplejavascript.ts:890-904`) — which is why `outtype-` appears in **zero** editor source files.
✅ Declaration is **necessary**. ⚠️ Whether a live runtime is **also** necessary is **untested**:

| | preview LIVE | preview ABSENT |
|---|---|---|
| **declared** | ✅ rows present | ⚠️ **UNTESTED — a peer's null sits here** |
| **mined only** | ✅ section empty | — |

🔴 **The sharper question, which supersedes "toggle the preview":** for a node created the *normal*
way, has `editorImportComplete` fired and does the runtime's `graphModel` hold it? The peer's null
may be a **fixture artefact** — `fromJSON` + `addRoot` writes the *editor's* model and may never
reach the runtime's. **One eval separates product behaviour from fixture.**

### 3b. 🔴 The severity claim was BACKWARDS — correction C2

I reported, as a source read, that node B throws at runtime. **It does not.** The miner types a
**call-shaped** `Outputs.Done()` as `signal` (`javascriptnodeparser.js:353-356`); only
assignment-shaped usage gets `'*'` (`:373-384`). So `_isSignalType` is true, **node B works, and
§2's silence on it is CORRECT.**

⚠️ **So "the author who most needs the message has no control and no warning" is too broad.** The gap
is one row:

| written, undeclared | port type | Type row | message 5 | outcome |
|---|---|---|---|---|
| `Outputs.Done()` | signal | none | silent | ✅ **works — silence is correct** |
| **`Outputs.Done_1()`** / `Outputs.Done.send()` | **value** | none | **silent** | 🔴 **throws, no surface anywhere** |

✅ **What survives is still worth a ruling:** row 2's author has **no route at all** — no panel
control to discover *and* no diagnostic to read. That re-prices the **parser-asymmetry** ruling from
a nicety with migration risk to **the only case with no surface**. (A peer committed the two-row
table at `e62cc77f` precisely so the correct-and-silent case cannot be misread as the broken one.)

### 3c. The dropdown, finally opened — and AC1

Real trusted click (`cdp click`, not `.click()`), `MeasuringContainer` filtered — the DOM held **2**
option lists and only **1** was real. Eight options:

`String · Boolean · Number · Object · Date · Array · Color · **Signal**`

✅ **Signal is present, and last.** So *"Signal is missing"* is **false for a declared output**; the
report is *"I never found the Type dropdown"*.

✅ **AC1 driven FALSE.** The `+` beside SCRIPT OUTPUTS opens
`<input class="sidebar-panel-dark-input name-edit" placeholder="Entry name">` **and nothing else** —
no type at creation. ⚠️ Treat as a **baseline against unfixed code**, not news.

### 3d. Instrument notes — one withdrawn, two kept

🔴 **WITHDRAWN (correction C3): "`node.dynamicports` disagrees with the panel in BOTH directions, so
it is not usable even as a conservative bound."** I broadcast that to ~20 recipients and several
filed it verbatim. **One of the two directions was the gating rule working correctly** — node B had
`outtype-Done` as a *parameter* while `Done` was never in `scriptOutputs` (my synthetic `Enter` never
committed), so "parameter present, no row" is exactly what §3a predicts.

✅ **Corrected and stronger: the rendered panel is a RELIABLE readout of declaration.** Only the
model's copy is untrustworthy — it is a **cache of what a runtime last pushed**, so its *presence*
does not imply the panel will render. `getPorts()` and `dynamicports` are both that cache.

✅ **KEPT — the CodeMirror handle is `el.cmTile.view`, not `el.cmView.view`.** Three independent
measurements. ⚠️ The handle is **non-enumerable**, so neither name shows in `Object.keys` and a
failed lookup reads as *"the popout isn't open yet"* — which is why it costs a window. A peer fixed
the self-contradicting handover at `02a26f7b`.

✅ **KEPT — a legacy `sidebar-panel-dark-input name-edit` does NOT commit on a dispatched
`KeyboardEvent`.** The panel showed the row; `B.parameters` still held only `functionScript`.
**Recorded as an inconclusive sub-experiment, not a result** — a harness that silently fails to
commit produces a DOM identical to a broken panel.

---

## 4. What this session settled — do not re-derive

- **The Type row is gated on a declared `scriptOutputs` row.** Driven, paired, reproduced.
- **Signal IS offered** for a declared output, last of eight.
- **AC1 is false as built.**
- **§2's diagnostic is silent on mined outputs** — and for the call-shaped case **that is correct**.
- **The panel is a reliable readout of declaration; the model's port cache is not.**
- ⚠️ **Do NOT re-derive that the mined node throws — it does not.** See §3b.

---

## 5. What to do next and why

1. 🔴 **Close C1's empty cell — it is one eval and it decides how big FIX-016 §1 is.** For a node
   created the **normal** way (not `fromJSON` + `addRoot`), check whether `editorImportComplete` has
   fired and whether the runtime's `graphModel` holds it. **Rows present with no preview ⇒ the
   viewer is irrelevant and §1 is the copy question. Rows absent ⇒ an author who has never hit
   Preview has no Type control on any Function output**, which is materially larger than the wording
   and would change the ruling again. ⚠️ **Build the node the normal way** — otherwise you reproduce
   the fixture artefact rather than the product.
2. **FIX-016 §1's ruling — now TWO questions** (§6). Do not build until Richard sizes them.
3. 🔴 **FIX-017's remaining half needs Richard** — AC1 is now driven false, AC3's premise is still
   false. **Do not build §D speculatively.**
4. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
5. **FIX-013**, **FIX-016 §3** — open, each needs its ruling (§6).
6. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

🔴 **Do NOT re-run `test:ci` to "check"** — the floor is current at `d0891746` and s26 ran no suite.
🔴 **Do NOT re-run the destructive `dev:stop` experiment** — it exists, `a905af94`.

---

## 6. Owed by Richard

- 🟢 **FIX-016 ruling 1 — now TWO questions, and they need different amounts of work.**
  **(a) The copy/default question**, settled and small: the row says only `Type` and reads `String`
  whether or not anything is stored, so it looks already answered. Options: offer Type at add time in
  `AddNameField`; a one-line hint under `scriptOutputs`; or nothing, since the new diagnostic names
  the fix at the moment the author gets it wrong.
  **(b) 🔴 The parser-asymmetry question, re-priced by this session**: an author who writes
  `Outputs.Done_1()` or `Outputs.Done.send()` without declaring gets a **value** port, **no Type
  row**, and **no diagnostic** — the only case in this feature with **no surface at all**. Fix by
  mining into the panel, by the diagnostic covering it, or at the parser. ⚠️ **Do not conflate with
  the plain `Outputs.Done()` case, which works correctly.**
- 🔴 **FIX-017 AC1** — a trigger exists and fires but is invisible, and **the add affordance offers
  no type at creation** (driven, §3c). ⚠️ **One keystroke settles the copy half**: press Ctrl-Space
  in a Function popout — `com.apple.symbolichotkeys` key 60 is **enabled** on your machine and binds
  it to "Select the previous input source".
- 🔴 **FIX-017 AC3's ruling** — premise false (ports and API names never share a prefix). Restate or
  strike.
- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged s18–**s26**;
  twelve sessions have asked, none has claimed it. It backs `library:check`, and `cloud-library:check`
  **is a PR gate**. **Attribute it or bin it.** s26 did not touch it.
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one.
- 🔴 **FIX-016's signal-input semantics** (§3) — re-run the body vs named handlers, or rule signal
  inputs out and document `run` as the only trigger.
- ⚠️ **The ⌘C ruling** (carried by a peer): `keyboardhandler.ts:165` guards on **focus**, not
  selection.
- ⚠️ **MCP servers hold pre-rebuild code**; the **repackage** is separately owed.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance. `run_in_background` preserves it.
- 🔴 **NEW — `run-editor/SKILL.md` calls `dev:stop` "safe to run with a sibling worktree's stack up"
  and offers no warning on the by-pid alternative.** Both readings are now known to be incomplete:
  the by-pid route invokes the watchdog's sweep with `protectAncestors: false`. **The doc should say
  the shields are what make either safe.**
- 🟢 **The memory index still has no owner, and s26 is part of the problem — stated plainly rather
  than as a general lament.** `MEMORY.md` was **19.97 KB** at the start of this session and is
  **21.3 KB** now against a 17.1 KB target; I added three pointers and tightened only my own lines.
  The size hook fired **five times** and I deferred it every time. ⚠️ **My reason is the same one
  that makes it nobody's task:** a 4 KB cut is a judgement about what is still worth knowing, the
  file was modified on disk by peers *mid-session*, and a rewrite would clobber them. ✅ The safe
  lever remains **promote-then-collapse on a closed phase**, with the standing traps **promoted out
  first** — an unlinked memory survives on disk and is invisible in practice. 🔴 **This needs a
  decision from you, not another session's restraint**: every session so far has correctly declined
  and correctly added.
- 🟢 **A lockfile written by `start.ts` at *intent*** — the ~75s window in which no process check can
  be correct is a hole no filter can close.

---

## 7. Standing constraints

Work on `cline-dev`; **never `git stash`**; `cd` to the repo root in every git call (⚠️ **the Bash
cwd persists between calls** — use absolute paths); **pathspec-scope every `git add` / `git
commit`** — the tree held 11 modified files from at least four sessions while I worked.

⚠️ `dev-docs/tasks/phase-65-the-library/` and `phase-69-the-node-you-write-yourself/` are untracked
and belong to neither this phase nor 67 — **leave them**.

### 🔴 Teardown: the by-pid route is NOT the gentle one

```
scripts/start.ts:74     spawns dev-watchdog.js with the launcher pids
dev-watchdog.js         polls every 2000ms; any watched pid dying →
dev-watchdog.js:44      sweep({ protectAncestors: false, … })
```

`dev:stop` leaves `protectAncestors` at its default of **true**; the watchdog explicitly disables it.
**So killing your launcher pid runs the same checkout-wide sweep with one protection switched off.**
Both are safe *only* because `2b758a87`/`4fd2cfdb` shield MCP and suites. 🔴 **A reaper started
before those commits holds the old module — keep announcing.**

### 🔴 The pre-flight has a ~75-second blind window

```
scripts/start.ts        ← dev launch, exists IMMEDIATELY
webpack (bare)          ← dev launch, ~8s
Electron . --dev        ← dev launch, ~75s
webpack.*test-ci        ← SUITE only
Electron test.js --ci   ← suite, ~40s after its webpack
```

🔴 **`Electron . --dev` is the LAST thing to appear**, and `webpack.*test-ci` **never** matches a dev
launch. Match on **`comm`** for what is already running *and* on argv for launches — you need both;
the `comm` fix alone trades a false positive for a **false negative**, which reads as "clear".

### ✅ Match the breadth of the check to the direction of the claim

| the claim | what you need | why |
|---|---|---|
| **"nothing is running"** (a null) | a **BROAD** match | 0 in the superset ⇒ 0 in the subset |
| **"something is running, and it's MINE"** | a **PATH-SCOPED** match | ~20 sibling worktrees match on argv shape |

🔴 **And put a positive control on the process check itself.** Four zeros from a typo'd pattern, a
wrong flag or a quoting bug look identical to a quiet checkout. s26 reported its zeros beside a
66-line match on the same pipeline; a peer independently ran 528. **One extra call.**

### 🔴 Attribute by PPID, never by the `electron/dist` path

11 Electron processes from this checkout at idle are **MCP servers**, one per peer session — every
PPID is that session's socket number. Walking `ps -Ao pid,ppid` to the Claude pid settles ownership
**without trusting any announcement**.

### Etiquette

**Announce before *and* after any `test:ci`, `test:main` or editor launch, and announce your PIDs.**
🔴 **The LAUNCH list is the TEARDOWN list** — and that is necessary, not sufficient.

🔴 **NEW, measured: a roster goes stale INSIDE the announce window.** `opennoodl-13` vanished and
`-87`/`-82` appeared within ~2 minutes of one round. Two failure modes, and the etiquette only
covered one:

| | risk | fix |
|---|---|---|
| **Departure** | holds a phantom reservation | teardown to the launch list |
| 🔴 **Arrival** | **never got the launch notice**; may launch into your live stack | ⚠️ **re-list AFTER announcing and re-send** |

✅ So: **`ListAgents` at both ends.** Close to the union of *(launch list ∪ everyone who wrote ∪
whoever is live now)*. **Prune only on an explicit "I'm elsewhere", never on silence.**

⚠️ **Reply to the SOCKET a message arrived on** — display names and sockets are two identifier spaces
with no verified join. ⚠️ Names need their `[ref]` on first send.

⚠️ `pgrep -af` does **not** print args on macOS. Use `ps -Ao pid,ppid,lstart,args`, and **print pids
rather than counting matches**. ✅ **`/usr/bin/grep` calls a file with ⚠️ emoji "binary"** — pass `-a`.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key **`recentProjects`**).
⚠️ A copied project keeps the original's **name**; rename it on disk or you cannot tell the cards
apart. ⚠️ `openProjectFromFolder` returns a **ProjectModel**, not a launcher entry — passing it to
`loadProject` yields `undefined/project.json` and hangs.
