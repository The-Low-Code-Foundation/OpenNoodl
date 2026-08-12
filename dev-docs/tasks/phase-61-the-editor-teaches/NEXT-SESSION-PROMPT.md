# Phase 61 — next session

**Written 2026-08-12 evening.** Replaces the afternoon handover. **Five of nine built, four decisions
now signed, and the gate is green — the one thing this phase has never had is a quiet machine.**

---

## 1. Read this first — what is built vs. what is *proven*

| Task | Built | Driven |
|---|---|---|
| **FUN-001** | ✅ | n/a — ✅ **§2 now signed, settled** |
| **FUN-002** | ✅ | ✅ 6 of 7. One criterion open (needs a project switch → restart) |
| **FUN-003** | ✅ | ✅ every criterion of its own |
| **FUN-007 §1** | ✅ | ✅ closed · 🔴 **§2 not built** — blocks drive steps 8 and 9 |
| **FUN-009** | ✅ `ace5232f` | ✅ **DRIVEN 2026-08-12 evening — every step passed.** §3 below is done; do not re-run it |
| **FUN-004, 005, 006, 008** | 📋 open | — |
| **FUN-009 §5 (F35)** | 📋 **new task**, opened by the fix · 🔴 **five ports, not four** | — |

## 1a. ✅ `test:ci` is FINE on this tree — 2700 / 6 / seed 59012

**Measured 2026-08-12 15:40 by a sibling session**, on `0ece138a` (the phase-59-merged tree) plus
their uncommitted PortsTab work:

```
Jasmine: 2700 specs, 6 failures (failed).
Randomized with seed 59012.
```

**All six are the inherited baseline, by name** — `AI model registry` ×2, `AIX-006 style vocabulary`
×4. ⚠️ It **predates the FUN-009 commits**, so it is this tree's baseline, not a verification of the
change. Re-run and compare **NAMES** against those six.

### ⚠️ My three failed attempts were resource contention, and I misdiagnosed them

Recorded because the wrong diagnosis is the expensive part, not the lost runs:

| Attempt | Outcome | Specs started |
|---|---|---|
| 1 | timed out at 900s, no `Jasmine:` line | 2424 |
| 2 | webpack **OOM-killed**, exit 137 | 0 |
| 3 | timed out at 900s, no `Jasmine:` line | 1472 |

Every one of them had a confounder — my own concurrent `typecheck:editor-tests` on the first, heavy
swapping on the second, **two sibling `test:ci` runs** on the third. Richard identified it
immediately: a parallel session was running the suite and the laptop ran out of headroom.

🔴 **The trap I fell into, so nobody repeats it.** Both timeouts showed a flood of *"Warning: we have
more that 10000 listeners on this model"* (`utils/model.ts:106`) — 2569 of them — and I read that as
a listener leak stalling the suite. **It is normal.** Every *completed* run in the scratchpad
archive, including the green baseline-six ones, carries **~12,300** of those warnings. My timed-out
runs had *fewer* only because they got through fewer specs.

⚠️ **The guard fires on every `on()` past 10000, so its volume tracks how far the run got — it is a
progress counter, not a defect signal.** I had it exactly backwards, and I had no control: I never
compared against a passing log before theorising. **`grep -c "10000 listeners"` on a known-good run
takes ten seconds and would have killed the theory instantly.**

⚠️ **A run without a `Jasmine:` line graded nothing** — do not read exit 1 as failures, and never
compare a count from such a run. That part stands.

---

## 2. The four decisions, signed by Richard 2026-08-12

Recorded in the task files, not only here. **Do not re-litigate any of them.**

1. ✅ **`Inputs.` / `Outputs.` is the notation.** `Noodl.Inputs` is supported forever and never
   written. FUN-001 §2 stood unsigned through two sessions while four surfaces were built on it; it
   is settled. Every consumer can stop hedging.
2. ✅ **FUN-009 §4 stays two documents.** `NodePicker.chooser.ts` (comparative, pre-choice, covers
   `Logic Builder`) and `NOTATION_RULES` (instructional, mid-edit, covers `Javascript2`) are **not**
   merged into one string. They must not *disagree*; both files say to read the other.
3. 🔴 **F35 is to be fixed** — all four undeclared JavaScript ports get a `codenotation`. It is now
   **FUN-009 §5**, a real task with an acceptance list, not a note. The two Map/Database ports need a
   *decision* (a fourth mode, or the `function` floor with the wrongness recorded), not a labelling
   pass. Read §5 before touching it.
4. ✅ **Parallel worktree lanes** for this session. ⚠️ I advised against it and Richard chose it
   knowingly; §5 below is how to make it work rather than how to avoid it.

---

## 3. ✅ DONE — the drive FUN-009 never got, run 2026-08-12 evening

**Every step below passed. Do not re-run it.** Full readings in the FUN-009 task file under
*"The drive, run 2026-08-12 evening"*. In summary:

- **The premise holds.** `codenotation` arrives intact in the editor's own `NodeLibrary` —
  `expression` / `function` / `script` on the three ports. It was only ever read before; now measured.
- **F17 is closed.** The three popouts render **EXPRESSION**, **FUNCTION**, **SCRIPT**. Nothing below
  is standing on sand.
- **The user-visible half is fixed.** `total * 2` in an Expression: no `no-undef`, toolbar `✓ Valid`,
  and the port `total` is minted. The same text still warns in `function` and `script`.
- **§2 is closed**, driven both ways with an injected authoring context so an empty list could not
  masquerade as a pass: `Inputs.` → `[]` in Expression but `["Value"]` in Function; `Variables.` → two
  names in Expression but `[]` in Function; bare `car` offers nothing while `cartTotal` sits in scope.

🔴 **What it turned up:** F35's port count is **five**, not four — `For Each.templateScript` was
missing, it is not a Function body, and its *default value* may warn about itself on the `function`
floor. That is Lane C's first measurement. `storageJSONFilter` is a **dynamic** port and will not
appear if you enumerate node types.

✅ **Two mechanics worth keeping:** the live CodeMirror `EditorView` is at
`document.querySelector('.cm-content').cmTile.view` (**not** `.cmView`, and non-enumerable — a first
probe finds nothing), and `cdp type` cannot open the completion menu because `Input.insertText` does
not trigger it — use `startCompletion(view)` / `currentCompletions(view.state)` from
`@codemirror/autocomplete` off the webpack registry.

<details><summary>The original instructions, kept for reference</summary>

### 🔴 The drive FUN-009 never got — do this before writing any new code

The fix is committed and specced in three packages, but **the premise that `type.codenotation`
survives the runtime → editor trip has never been measured.** Four static readings agree
(`nodelibraryexport.ts:161` passes `type` wholesale; `NodeLibraryImporter` reconstructs nothing;
`cloud-node-library.json` stores type objects as plain JSON; the catalog generator emitted the field
from the **real registries**) — but that is reading, not measurement.

**It is the cheapest high-value thing in the phase and it needs ~15 quiet minutes.** In one script,
re-opening the project defensively at the top:

1. Three nodes — Expression, Function, Script. ⚠️ `ed.createNewNode` returns `void` and leaves
   `ed.highlighted` set; **clear it between creations** or they parent under one another and render
   nothing, which looks exactly like a product bug.
2. Open each code popout, read `span.ModeLabel` (`JavaScriptEditor.tsx:265`). It must read
   **EXPRESSION**, **FUNCTION**, **SCRIPT**. Three different words closes F17 outright — before the
   fix it said FUNCTION three times.
3. In the Expression popout type `total * 2`. **No `no-undef` warning**, and the port `total` still
   appears. That is the user-visible half.
4. FUN-009 §2's acceptance, reachable for the first time: `Variables.` / `Objects.` / `Arrays.`
   complete bare in Expression mode, `Inputs.` offers nothing there, no bare identifier is completed
   from anything project-shaped. **No code was written for §2** — it was always correct and gated
   behind a branch that could not fire.

⚠️ If step 2 shows FUNCTION three times, the premise is wrong and **every lane below that depends on
`validationType` is standing on sand** — stop and fix that first.

</details>

---

## 4. The lanes

Cut with `scripts/devtools/make-worktree.sh`, from `origin/main`, into `../OpenNoodl-worktrees/` —
**never** the harness's `isolation: "worktree"`, never a scratchpad.

### Lane A — diagnostics and completions
**FUN-007 §2 → FUN-004 → FUN-008**, in that order. The handover's reasoning still holds: §2's gutter
is the same file and the same knowledge as FUN-004, it is a small first commit, and it unblocks
FUN-007 drive steps 8 and 9. FUN-004 was blocked on FUN-009 and **is now unblocked**.

- ⚠️ FUN-004: **two rows, driven separately, fresh project each.** Implicit globals are shared
  between Function nodes, so the first bare `Output_1` disarms the `ReferenceError` project-wide.
- ⚠️ FUN-007 §2: the mapped `line`, `column` and `hint` are already on the warning payload and the
  raised error's `detail`. **Nothing renders them.** That is the whole of §2.
- 🔴 **F31 is open and belongs here** — a warning that stranded and never cleared, with
  `scriptOutputs: []` and a replaced script. **Be sceptical of the mechanism, not the observation**:
  it did not reproduce on a second node given the identical batch. The "race with a re-run scheduled
  against the previous script" is *inference*. Reproduce before fixing.

### Lane B — the chrome (bar, then rail)
**FUN-006 → FUN-005 §1/§2.** ⚠️ **These two cannot be separate lanes**: both mount a new surface
inside `JavaScriptEditor.tsx` and its `.module.scss`, and they will conflict on the same lines. One
lane, sequential, bar first.

- **FUN-006 closes FUN-009 §1 for free.** The copy is already written and specced —
  `NOTATION_RULES` and `expressionPortNote` in `notation.ts`, both exported from the code-editor
  barrel. 🔴 **Nothing renders either of them today**; `NOTATION_RULES`'s only consumer in the whole
  product is the AI prompt template. FUN-006 is the first surface to put any of this phase's copy on
  screen.
- ⚠️ FUN-006 §4 is not optional decoration: **measure contrast in both themes and record the
  numbers.** `TextType.Secondary` is identical to `TextType.Default`, opacity cannot dim and stay
  legible, and CodeMirror `baseTheme`s hardcode colours our tokens never reach.
- 🔴 FUN-005: **adopt the sibling's `usePortValues.ts` / `portValues.ts`, do not rebuild them.**
  Check whether they have been committed yet — they were still uncommitted in the shared checkout at
  the end of 2026-08-12. **§3 is where the cost is; do not start it in this lane.**

### Lane C — the runtime ports
**FUN-009 §5 (F35).** Disjoint from A and B — runtime node definitions plus possibly one case in
`modes.ts` / `esLintDiagnostics.ts`. Read §5 in the FUN-009 file: the REST two are trivial, and
`mapScript` / `templateScript` / `storageJSONFilter` are a design decision that must be made
explicitly.

🔴 **The count is five, not four** — the 2026-08-12 drive enumerated the live library and found
**`For Each.templateScript`** missing from F35's table. It is not a Function body
(`new Function('item', 'var component;' + value + ';return component;')`), which makes it a third
vote for option (a) rather than the `function` floor.

🔴 **Lane C's first measurement, before any code:** `templateScript`'s default value is
`component = '/MyComponent';` and `component` is not in `globalsFor('function')`, so the node may
**warn about its own seed text** — the very defect FUN-009 just removed from the Expression node.
`lintMessages("component = '/MyComponent';", 'function')` settles it in one line. **It is a reading,
not a measurement** — reproduce it before treating it as true.

⚠️ `storageJSONFilter` is a **dynamic** port (`dbcollectionnode2.ts:1330-1340`, inside the
`storageFilterType === 'json'` branch). Enumerating node types will not find it.

⚠️ **This lane regenerates the catalog.** `catalog:check` will go red; run `catalog:generate` **and**
`catalog:merge`, and run the `noodl-mcp` suite afterwards — it is not in `test:ci`.

---

## 5. Machine discipline — this is what cost the last session

Three lanes plus however many sibling sessions are live all want one machine, and the last session
lost its drive to exactly this.

- 🔴 **No lane drives the editor.** All live verification happens in the **main session**,
  **serialised**, one drive at a time. A lane that needs a drive hands its script to the main session
  rather than launching Electron.
- 🔴 **Check for siblings before every heavy run**, not once at the start: `dev:stop -- --list` (the
  no-`--` spelling **KILLS**, including a sibling's running `test:ci`) and
  `git log --oneline --since="3 hours ago"`. It was false at 15:35 and true by 16:43 on 2026-08-12.
- ⚠️ **Never run two `test:ci` at once**, and never run one while a lane is doing anything heavy. A
  suite that dies **without a `Jasmine:` line graded nothing** — re-run it, do not read exit 1 as
  failures. A backgrounded wrapper's exit code lies; read the log.
- ⚠️ The editor is a **queue, not a resource to seize.** If a sibling is driving, wait and poll.
  Never `dev:stop` to make room.
- ⚠️ Shared checkout: **never `git stash`, never `git add -A`**, and pathspec-scope both `git add`
  **and** `git commit`. A sibling has had `PortsTab/**`, `CanvasTabs.tsx`, `TraceSession.ts` and
  `tests/nodegraph/**` uncommitted for a full day. Leave them.

---

## 6. Mechanics worth not rediscovering

- 🔴 **A `.gitignore` rule ending in `/` does not match a symlink.**
  `packages/noodl-runtime/dist-types` was **committed as a symlink pointing at its own absolute
  path**; `build:types` died with `ELOOP`, and because that is `noodl-viewer-react`'s `pretest`, that
  package's whole suite could not start — showing up as a build failure, not a red suite. Fixed in
  `d5b60f82` (link dropped, trailing slash dropped). It had been deleted once that morning and
  **re-merged from a stale worktree branch within the hour**, so if a package suite refuses to
  *start*, check for a broken build artifact before reading it as a code defect.
- **Reading the FUN-003 registry live** — the webpack chunk registry returns the **cached** module:
  ```js
  window.webpackChunknoodl_editor.push([['probe'], {probe:(m,e,req)=>{window.__req=req;}}, r=>r('probe')]);
  window.__req('../noodl-core-ui/src/components/code-editor/authoringContext.ts').getCodeAuthoringContext()
  ```
  🔴 Never `req()` `projectmodel.ts` this way — it re-evaluates and drops the editor to the launcher.
- **Mined ports are not synchronous.** In the same tick as `createNewNode` a seeded node has no
  `in-`/`out-` ports; they arrive after a sub-second round trip. A spec asserting it in the creating
  tick will fail.
- **`cdp.js` has no key dispatch** — ⌘Z needs a small `Input.dispatchKeyEvent` script. The undo queue
  holds `create` and `seed function` as **separate entries**, and opening/closing a popout pushes
  `edit parameter` on top. Read `UndoQueue.instance.queue` before concluding anything.
- ⚠️ **`cdp click` on a class selector hits the first match** — one opened a GitHub device-login page.
  **Tag the element with a unique `id` in an `eval` first**, every time.
- **The editor's preview cannot render a project outside the normal projects location** (404s on
  `index.json`). Use `node scripts/devtools/measure-from-disk.js <dir> --screenshot full --out <p>`
  and read the PNG — that is how "passes a value through when run" was proved independently.
- Registering a scratch project with the launcher and restarting works — **back the store up and
  restore it afterwards**.
- ⚠️ **`SEED_FUNCTION_BODY` differs from FUN-002's specced string on purpose.** Its comment writes
  bare `Value`/`Result`, never `Inputs.Value`, because **comments are mined into ports**. Do not
  "restore" the spec.
- ⚠️ **A spec can be decoration.** FUN-009's predecessor asserted two branches using type names no
  port in the product has, and passed for the whole of the feature's life. When a gate covers a
  discriminator, **assert the wrong answer too** — reimplement the rejected guess and name the cases
  it gets wrong.
