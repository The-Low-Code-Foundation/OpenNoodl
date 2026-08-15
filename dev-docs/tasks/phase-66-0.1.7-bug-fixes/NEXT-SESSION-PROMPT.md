# Phase 66 — next session

**Written 2026-08-15, session 22.** One task driven, and the drive changed what the task is asking
for. **FIX-017 §A is now DRIVEN** (`5d04281d`): three of AC1's four halves are met, the headline one
is **not**, and §A alone cannot meet it. Criterion 2's evidence was undercut by the same finding, so
it was **re-driven rather than defended** — and it stands.

🔴 **The finding that outlives this phase: the obvious way to drive a completion feature is the way
that cannot fail.** `startCompletion(view)` sets `context.explicit = true`, which is *precisely* the
branch §A's gate exists to exclude. Driving criterion 1 that way passes whether or not §A works —
it would have passed **before §A was written**. The same harness had been correct one criterion
earlier. §3.

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
| **FIX-017** | ◐ **§A + §B** | ◐ **§B + §A(¾)** | **§A DRIVEN this session.** AC1: both modes answer, ordinary code not smothered — ✅. **"Without typing" ✗ and unreachable by §A.** AC2 re-driven on the automatic path, **stands**. 🔴 AC3 premise still false. **§D promoted** — see §4 |
| **FIX-014** | ✅ | ✅ both clients | **CLOSED** s18. 🔴 driven ≠ shipped — packaged app still lacks it |
| **FIX-019** | ✅ | ✅ 4/4 | **CLOSED** s18 — 14(a) ruled *no sweep* |
| **FIX-001** | ✅ | ✅ 5/5 | **CLOSED** s17. 🟡 §1a.5 stretch open — re-decide, don't build |
| **FIX-002 / 003 / 007 / 009 / 010 / 011 / 012 / 018 / 020** | ✅ | ✅ | **CLOSED** |
| **FIX-008** A, B, E | ✅ | ✅ | C, D not built; **C needs a measurement from Richard** |
| everything else | 📋 open | — | see [TASKS.md](TASKS.md) |

**Thirteen closed. The built-not-driven column SHRANK this session** — §A moved across, and nothing
new was built. That was the point: the previous handover asked for a drive rather than another
build, and the drive is what found the gap.

🟡 **Keep preferring a drive of something already built over building the next thing.** This session
is the argument for it: §A had 8 control-checked specs and looked finished. It took an app drive to
find that a criterion could not be met at all.

---

## 2. Gate readings

**Tree: `5d04281d`.** No source changed this session — docs only — so **s21's readings at `9e8b3198`
still hold** and were not re-run:

| Gate | Reading | When |
|---|---|---|
| **`test:ci` (jasmine)** | ✅ **2843 total / 6 failed** at **seed 39393** | s21, unchanged since |
| `noodl-core-ui` jest — full package | ✅ **24 suites / 403**, 0 failed | s21 |
| §A known-broken control | ✅ **5 of 8** new specs go red with the blanket refusal restored | s21 |

🔴 **Quote the six failures by NAME, never the count** — 4 × `AIX-006 style vocabulary`, 2 × `AI
model registry`. Full strings in the s21 file's history if needed.

✅ **The checkout was left FREE after BOTH windows** — 0 editors, 0 suites, 0 `webpack.*test-ci`,
0 `start.ts`, verified after each teardown and announced to all seven OpenNoodl peers.
**MCP pid list byte-identical before and after both launches** (21 processes; compare **pids, not
counts** — counts drifted 9→10→11 tonight for unrelated reasons).

⚠️ **One MCP discrepancy resolved rather than waved through:** a peer's baseline listed `85490`; the
live pair is `85485/85489`, both started **11:07:29**, hours before either launch. Adjacent-pid
transcription slip, not a death. Checking cost one `ps`.

---

## 3. 🔴 The finding: a drive technique that supplies the condition under test

§A's gate is one line:

```js
const atEmptyPosition = word.from === word.to && !context.explicit;
if (atEmptyPosition && !startsStatement(context, word.from)) return null;
```

`startCompletion(view)` sets `context.explicit = true`. So **the convenient way to open the menu in
a drive removes the very predicate §A adds.** Worse, the *old* `completesTopLevel` also returned
true whenever `context.explicit` — so an explicit-request drive of criterion 1 returns the globals
**on a build where §A does not exist**. A probe that cannot fail.

🔴 **And the technique was correct one criterion earlier.** Criterion 2 (`Noodl.Records.` → 11) asks
*what* comes back; that branch is not gated on explicitness, so `startCompletion` was a sound
trigger there. Criterion 1 asks *when the menu appears by itself* — gated on exactly that.
**A drive technique's validity is per-CRITERION, not per-feature.** "It worked for the last
criterion" is not transfer.

🔴 **Why the gate that shipped it was discriminating and STILL blind** (s21's own analysis of its
build, worth keeping): the 8 specs call `createNoodlCompletionSource(mode)(contextAt(doc))`
**directly**. They prove the source *answers*; they cannot prove CodeMirror ever *asks* it — and it
doesn't, at a cursor landing. **Calling the unit directly is exactly what makes a spec fast and
exactly what makes it unable to see the integration**, and no amount of control-checking *inside*
that boundary can catch a defect *at* it. The task file had warned in those words: *"a completion
source that never fires is indistinguishable from one that is not installed."*

⚠️ **A misreading worth pre-empting, because a peer hit it:** the gate is
`atEmptyPosition && !startsStatement` — suppression needs **both**. So a space at a statement start
is *not* an exception that slipped past §A; it is precisely what §A allows. And the fresh-landing
silence is **not the gate firing** — the source would happily answer there too. Nothing is
suppressed; nothing is requested.

🔴 **The consequence, and whoever builds §D must read this first: `§D's job is to ASK, not to
permit.`** Anyone diagnosing AC1 as *"the gate is too strict"* and loosening `startsStatement` will
**achieve nothing** — the source is already willing at a cursor landing; nobody is calling it. They
would weaken a real protection, still see silence, and conclude the change did not work.
**An absent signal has two causes — *refused* or *never requested* — and they have opposite fixes,
with the wrong one being a silent no-op.**

### How it was driven instead

Real keys on the automatic path: `Emulation.setFocusEmulationEnabled` **plus**
`rawKeyDown`/`char`/`keyUp` **on ONE CDP connection**. `npm run cdp` opens a fresh connection per
command, and focus emulation is session-scoped, so it must all happen in one process — harness at
`scratchpad/drive.js`. 🔴 **`cdp type` is `Input.insertText` and never triggers autocomplete**, so
it is not "real typing" for this question.

Two genuinely fresh nodes (`parameters: {}`, so the body is `""` — `functionScript` has no
`default`) on a **renamed** copy, so which project was open was provable.

| probe | mode | menu | options |
|---|---|---|---|
| fresh popout, cursor lands, **no typing** | Function | 🔴 **none** | — |
| fresh popout, cursor lands, **no typing** | Expression | 🔴 **none** | — |
| space at a statement start | Function | ✅ rendered | `Inputs, Outputs, Noodl, Component, Script` |
| blank line after `const total = 1;` | Function | ✅ rendered | the same five |
| `const x = ` / `foo(1, ` | Function | ✅ **silent** | — |
| space at a statement start | Expression | ✅ rendered | `Noodl, Variables, Objects, Arrays, min…` |
| `1 + ` | Expression | ✅ **silent** | — |

🔴 **The silent rows are what make the loud ones mean anything.** A source that answered everywhere
would have passed the positives and been the FH-017 noise that got removed.

### Why "without typing" cannot work

`@codemirror/autocomplete`'s `getUpdateType` (`dist/index.cjs:947`) Activates **only** on an
`input.type` user event or an explicit `startCompletionEffect`. A cursor landing is `tr.selection` →
`UpdateType.Reset`, which *deactivates*. §A made the source **willing to answer**; nothing **asks**
it. **No repo file calls `startCompletion`.**

### 3b. The ruling changed shape: a trigger DOES exist

`completionKeymap` is spread into the live keymap (`codemirror-extensions.ts:248`). Driven with real
chords, each with a **leak control** — doc stayed `""`, cursor stayed `0`, so the menu came from the
*command* and not from a stray inserted space (a leaked space would have triggered the automatic
path and passed for the wrong reason):

| chord | leak control | menu |
|---|---|---|
| **Ctrl-Space** | clean | ✅ rendered |
| **Alt-`** | clean | ✅ rendered |
| **Alt-i** | clean | ✅ rendered |

🔴 **All three take the EXPLICIT path, so none is evidence for §A** — they worked before it existed.
Checked rather than inherited: "a manual trigger exists" would otherwise read as "AC1 is reachable
today", and it is not.

🔴 **So the question for Richard is DISCOVERABILITY, not capability.** Nothing in the product names
these keys — the placeholder is only `// Enter your JavaScript code here`, and the sole Ctrl-Space
mentions in either package are **code comments** (`library-completions.ts:64`,
`completionPosition.ts:9`). A beginner has a working trigger they would never guess.

🔴 **And Ctrl-Space is NOT reachable by a human on this machine — measured by a peer after my
drive, and it sharpens the ruling.** Reading the user's own preference domain:

```
$ defaults read com.apple.symbolichotkeys AppleSymbolicHotKeys
    60 = { enabled = 1; value = { parameters = ( 32, 49, 262144 ); ... } }
```

Symbolic hotkey **60 is "Select the previous input source"**, **enabled**, parameters ASCII 32 /
keycode 49 / modifier mask 262144 (`NSEventModifierFlagControl`). That is **Ctrl-Space, bound at OS
level and active**. CodeMirror ships `Alt-`` ` `` and `Alt-i` as mac alternates for exactly this
reason.

🔴 **So "all three chords fire" is true of the app and false for the user.** CDP injects straight
into the renderer and **bypasses OS hotkeys** — the one path on which an OS-eaten binding still
looks alive. My drive could not have caught this.

⚠️ **Scoped honestly:** that is a fact about *Richard's machine configuration*, it is
user-configurable, and **no physical keypress was tested** — the last inch is one keystroke in a
Function popout. But it means **documenting Ctrl-Space would document something that does not
work here**, and the honest statement is narrower: *the only manual triggers reachable by a human on
this machine are **Alt-`` ` ``** and **Alt-i***. Which argues harder for §D than my original framing
did, because the cheap "just add a line of copy" option collapses to naming two alt-chords nobody
would ever guess.

### 3c. Criterion 2 re-driven rather than defended

The false-pass finding undercut criterion 2's evidence, since it used the same trigger. A **source
argument** said it was fine (the member branch, `noodl-completions.ts:192-199`, runs before any
explicitness test and never reads `context.explicit`). But I had also **measured** the two paths
returning different menus at a top-level position — so "explicit ≈ automatic" was demonstrably false
*somewhere* in this file, and an argument from source is weaker than the observation it is trying to
explain. Re-driven with real keys:

| path | tooltip | total | the 11 `Records` methods | extras |
|---|---|---|---|---|
| **automatic — real keys** | rendered | **11** | **all 11** | none |
| explicit | rendered | **11** | **all 11** | none |

**Identical — criterion 2 stands, now measured rather than inferred.** And the top-level difference
is *explained* rather than explained away: the menu is a **union of sources**
(`codemirror-extensions.ts:318-319`), `libraryCompletionSource` gates on `explicit`
(`library-completions.ts:70`), and at a *member* position `isMemberPosition` rules first so neither
it nor JS built-ins contribute. That is why the paths agree there and diverge at a bare cursor.

### 3d. ⚠️ The control that earned its keep

The first run of the chord probe reported **`KEY_DELIVERY_CONTROL: FAIL`**. The cause was mine:
`window.__ac` was set in the *previous* window's page and did not exist in the fresh one, so the
reset step threw **before** `v.focus()` and the editor was never focused. Without a plain-`a`
control, the silent Ctrl-Space that followed would have read as *"the keymap does not reach the
popout"* — a false negative on the exact claim under test, and it would have sent the ruling back to
"no trigger exists".

🔴 **Dispatch one printable key and assert it lands before believing ANY chord result.**

---

## 4. What this session settled — do not re-derive

- **AC1 is ◐, not ✅ and not ✗.** Three halves met and driven; "without typing" unmet and
  unreachable by §A. Do not tick it, and do not re-drive the three that are done.
- **AC2 is closed on the automatic path.** Do not re-litigate it; §3c is the measurement.
- **§D is promoted.** It was scoped as "a small independent nicety". It is now **the only route to
  AC1's user outcome that does not need a ruling** — and `NOTATION_RULES` copy naming the shortcut
  may deliver most of the value on its own, before any button is built.
- **The drive recipe works end to end** and is worth reusing verbatim:
  - `openProjectFromFolder(dir)` **registers but does not navigate**; route separately via the
    router found on the React fiber from `#root` (depth 2-3).
  - **`NodeGraphContextTmp.switchToComponent(comp, {})`** switches component with no canvas click.
  - **`NodeGraphContextTmp.nodeGraph`** is the live canvas (not `window.__nodeGraphEditor`);
    `selectNode` takes the **VIEW** node from `ed.roots`/`.children`.
  - A fresh node: `NodeGraphNode.fromJSON({...})` + `graph.addRoot(node)`. `parameters: {}` gives a
    genuinely empty body.
  - Popout: click `.property-codeeditor-button`; the live view is `.cm-content` → **`el.cmTile.view`**.
  - 🔴 **Rename the copy's `project.json` `name`** or you cannot prove which project you opened.
  - `JSON.stringify(...)` your eval result — raw objects fail with *"Object reference chain is too
    long"*.

### Cleanup done

Both fixtures removed; `recentProjects` restored 32 → 31 after each window; both stacks torn down
and announced to every session the launches were announced to.

---

## 5. What to do next and why

1. 🔴 **FIX-017's remaining half needs Richard** — AC1 and AC3 are both rulings (§6). ⚠️ **The
   cheap option got weaker after my write-up**: "just add a line of copy naming Ctrl-Space" would
   document a chord the OS eats on this machine (§3b), so the copy would have to name **Alt-`` ` ``
   / Alt-i** — two chords nobody would guess. That makes **§D the strongest candidate**, but it is
   still his call between auto-open and an affordance, so **do not build it speculatively.**
2. **FIX-016 §2** (the declared-String-but-called diagnostic) — no ruling attached, ready home in
   `portDiagnostics.ts`, buildable today. **The best available build task.**
3. ✅ **Take `dev:stop -- --list` the next time a `test:ci` is genuinely live** — one command, and
   since `4fd2cfdb` it previews **both** kill paths. Still owed; no suite ran this session.
4. 🟡 **Settle whether a live suite can share a pgid with a recorded dev group** — `ps -o pid,pgid`
   against the `groups` array in the pid file. Needs a live suite, so it pairs with (3). Last
   unmeasured claim in that area.
5. **FIX-008 fix C** — Richard owes a measurement. The oldest open item.
6. **FIX-013**, **FIX-016 §1** — open, each needs its ruling (§6).
7. 🟡 **FIX-001 §1a.5 stretch** — re-decide rather than build.

**Do not start** FIX-015 or FIX-021's brainstorm halves — they need Richard, not an agent.

---

## 6. Owed by Richard

- 🔴 **FIX-017 AC1 — the new one, and the most decision-shaped item in the phase.** A trigger
  **exists and fires in the app** (Ctrl-Space / Alt-` / Alt-i, all driven, leak-controlled) but is
  **invisible in the product** — the only mentions anywhere are code comments. Three options,
  materially different in cost: (a) one line of `NOTATION_RULES` / placeholder copy naming the
  shortcut; (b) §D's visible button; (c) auto-open on mount when the body is empty — the one FH-017
  argues against, having removed menu-on-every-keystroke as noise.
  🔴 **Option (a) is weaker than it looks:** `com.apple.symbolichotkeys` key 60 is **enabled** on
  your machine and binds **Ctrl-Space** to "Select the previous input source", so copy naming
  Ctrl-Space would name a chord you cannot press. ⚠️ **One keystroke settles it** — press Ctrl-Space
  in a Function popout; if you get an input-source switch rather than a menu, (a) collapses to
  naming Alt-` / Alt-i and (b) is the real answer.
- 🔴 **FIX-017 AC3's ruling** — its premise is false (ports and API names never share a prefix, so
  there is no ranking to control for and `boost: 99` is unobservable). Restate against a prefix
  where the two surfaces genuinely compete, or strike it.
- 🔴 **`scripts/library/check.ts` is STILL uncommitted and STILL unattributed.** Unchanged through
  s18–s22; nine sessions have asked and none has claimed it. It backs `library:check`, and
  `cloud-library:check` **is a PR gate**. One `git add -A` from riding along, one `git checkout --`
  from vanishing. **Attribute it or bin it.** I did not touch it.
- 🔴 **FIX-013's four rulings** — ruling 2 (does the AI authoring preview keep its toolbar?) is the
  big one: "yes" retires a written constraint, "no" makes ~1,500 lines genuinely deletable.
- 🔴 **FIX-016's signal-input semantics** — re-run the body vs named handlers, or rule signal inputs
  out and document `run` as the only trigger.
- ⚠️ **The ⌘C ruling** (carried by a peer): text and a canvas node both selected —
  `keyboardhandler.ts:165` guards on **focus**, not selection.
- ⚠️ **MCP servers hold pre-rebuild code** — every live server predates the
  `packages/noodl-mcp/dist` rebuild. Restarting them is your call (each is a live session's
  connection); the **repackage** is separately owed for fresh/packaged launches.
- 🟡 **`run-editor/SKILL.md:23` teaches `nohup … &`**, which reparents the stack to PID 1 and
  destroys launch provenance; it also does not mention `npm run cdp` is root-only.
  `run_in_background` preserves provenance — the skill should say so. **Unchanged; I used
  `run_in_background` both times and it worked.**
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
`Electron test.js --ci` for a suite; a path grep on `electron/dist` counts MCP servers as editors.

🔴 **The announcement etiquette is NOT retired by `2b758a87` / `4fd2cfdb`.** A reaper started before
those commits holds the old module, and anyone on a worktree cut earlier is unprotected.

⚠️ `pgrep -af` does **not** print args on macOS. Use `ps -Ao pid,ppid,lstart,args` and grep that.

⚠️ **`dev:stop -- --list` is not purely read-only** — it calls `removePidFile()` when it finds
nothing.

🔴 **A peer's all-clear is about THAT PEER.** Seven peers cleared me tonight; that is seven
statements about seven sessions, not one about the checkout. Verify with `ps` regardless.

🔴 **Exercise the DULL state, not just the interesting one**, and **run the control before believing
the probe** — §3d is this session's instance, and it failed first.

✅ **A package-local jest run is the gate you can still take on a busy checkout.** `noodl-core-ui`'s
jest is plain Node, spawns no Electron, matches no `DEV_TOOL` pattern, ~1.5s.

✅ **Driving cleanup**: remove the `cp -R` fixture, and filter your entry out of
`~/Library/Application Support/NodeGX/recently_opened_project.json` (key is **`recentProjects`**).
