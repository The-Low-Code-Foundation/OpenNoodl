# Phase 61 — next session

**Written 2026-08-12 evening.** Replaces the afternoon handover. **Five of nine built, four decisions
now signed, and the one thing this phase has never had is a quiet machine.**

---

## 1. Read this first — what is built vs. what is *proven*

| Task | Built | Driven |
|---|---|---|
| **FUN-001** | ✅ | n/a — ✅ **§2 now signed, settled** |
| **FUN-002** | ✅ | ✅ 6 of 7. One criterion open (needs a project switch → restart) |
| **FUN-003** | ✅ | ✅ every criterion of its own |
| **FUN-007 §1** | ✅ | ✅ closed · 🔴 **§2 not built** — blocks drive steps 8 and 9 |
| **FUN-009** | ✅ `ace5232f` | 🔴 **NEVER DRIVEN** — see §3 |
| **FUN-004, 005, 006, 008** | 📋 open | — |
| **FUN-009 §5 (F35)** | 📋 **new task**, opened by the fix | — |

## 1a. 🔴 `test:ci` may not be able to finish on this tree — check this before trusting a run

**Three attempts on 2026-08-12 evening, zero completions.** Not simply contention, which is what I
assumed after the first one:

| Attempt | Outcome | Specs started |
|---|---|---|
| 1 | timed out at 900s, **no `Jasmine:` line** | 2424 |
| 2 | webpack **OOM-killed**, exit 137 — never built | 0 |
| 3 | timed out at 900s, **no `Jasmine:` line** | 1472 |

⚠️ **A run that ends without a `Jasmine:` line graded nothing.** Do not read exit 1 as failures, and
do not compare a count from such a run against anything.

🔴 **Both timeouts flooded the same guard**: *"Warning: we have more that 10000 listeners on this
model"* (`src/editor/src/utils/model.ts:106`, `src/shared/model.js:18`) — **2569 times** in attempt
3, first firing at spec ~1392, inside the AI-authoring suites (`tests/ai/authoring-staging.test.ts`
and neighbours). The two runs stalled in *different* suites, so it is **order-dependent** under the
random seed, but the listener flood is common to both.

⚠️ **Read the guard correctly before chasing it.** It fires on *every subsequent* `on()` once the
count passes 10000, so thousands of warnings mean **accumulation across the whole run** — listeners
never released between specs on a shared model — not one runaway spec. That is consistent with a
long-standing leak that has only now crossed the threshold as the suite grew.

**What is not known, and should not be guessed:** whether the cause is the added phase-59 specs, the
leak crossing its threshold, machine load, or some combination. It **completed earlier the same day**
at 2692 specs / 6 failures / seed 64762, on a tree predating the phase-59 merge.

**None of it is attributable to FUN-009's change** — a port type field, a pure function, copy and
specs touch no model listener.

**So:** run `test:ci` on a genuinely quiet machine, and if it times out again, treat *that* as the
finding and investigate the listener accumulation rather than re-running a fourth time. Compare
failure **NAMES** against the baseline six, never the count.

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

## 3. 🔴 The drive FUN-009 never got — do this before writing any new code

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
`mapScript` / `storageJSONFilter` are a design decision that must be made explicitly.

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
