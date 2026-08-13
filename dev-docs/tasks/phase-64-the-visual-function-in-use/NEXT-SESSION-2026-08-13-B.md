# Next session — Phase 64 (VFN): tier 1 is closed. Nine tasks, and the flagship is untouched.

**Read this, then [TASKS.md](TASKS.md).** Supersedes
[NEXT-SESSION-2026-08-13.md](NEXT-SESSION-2026-08-13.md), whose entire first item — one drive
session closing five tasks' worth of owed proof — **is done**.

---

## 🔴 START HERE: four agent branches are in flight. Your first job is to land them.

Launched 2026-08-13 from `cline-dev` @ `76dfece7`, in worktrees under
`../OpenNoodl-worktrees/` (built with `scripts/devtools/make-worktree.sh` — **never**
`isolation: "worktree"`, which forks from `origin/main`, hundreds of commits behind, 7 batches
out of 7).

| Branch | Tasks | Why grouped |
|---|---|---|
| `vfn-saveblock` | **VFN-007 + VFN-008** | Both are the save dialog; separating them guarantees a conflict in `MyBlocksSaveDialog.tsx` |
| `vfn-bench` | **VFN-011** | The flagship, ~2 days. Told to land Part 1 and the drift gate as separate commits, so partial work still lands |
| `vfn-config` | **VFN-012** | Isolated: toolbox + block defs. The one task that must keep `cloud-library:check` green |
| `vfn-window` | **VFN-004** | Isolated: `CanvasTabs` + navigation |

**Deliberately NOT in the batch:** VFN-006 (would collide with `vfn-bench` in
`BlocklyWorkspace.tsx`), and VFN-009 / VFN-010 (both depend on VFN-008 landing first).

### The merge protocol — the batch fails here, not in the agents

1. 🔴 **Trial-merge in a throwaway worktree before touching `cline-dev`.** `make-worktree.sh
   trial-merge`, merge each branch into it, then run the gates. A previous batch found a defect
   *created by the merge* that neither agent could have seen: one branch's census test asserted a
   port count, another branch added two ports.
2. 🔴 **Agents cannot see uncommitted work.** A worktree branches from a *commit*, so the third
   session's dirty `PortsTab/`, `TraceSession.ts` and `port-values.spec.ts` are invisible to all
   four. **Verify any destructive or "this is unused" claim against the primary tree before
   believing it** — an agent once deleted two files as phantoms that were real and registered.
3. **Generated files: let them conflict and regenerate.** Never hand-merge `node-catalog*.json`;
   `git checkout --theirs` then `catalog:generate` + `catalog:merge`. Strongest check available:
   after merging, run `catalog:generate` and confirm `git diff` is **empty**.
4. **Live verification belongs to the primary checkout, after merge.** `lerna exec` resolves the
   package root to primary even when launched from a worktree, so `dev:debug` / `test:ci` run from
   a worktree exercise primary's code and report a result unrelated to the diff.
5. Then, in the primary: `test:main` (expect ≥ 157/2265, compare **names**), `test:ci` only if
   `packages/noodl-editor/tests/` was touched, and `cloud-library:check` because `vfn-config`
   changes ports.

### What each agent was told it could not do

None of them can drive the editor, so **every criterion needing a running editor is still owed** and
each was told to list them in its own `NOTES-<name>.md`. Read those before assuming a task is closed
— and see the drive recipe at the bottom of this file, which is what closed tier 1.

## Where tier 1 actually stands

| | |
|---|---|
| **VFN-001** | ✅ built (`0067304d`), **driven** (`0b6addd5`). Criteria 1–4 pass, each with a control |
| **VFN-002** | ✅ built, **measured live**. 🔴 criterion 3 (AA contrast, both themes) and criterion 4 (dropdowns) still owed — small |
| **VFN-003** | ✅ built, **driven**, and one real exception lighter (`d9f41d20`). 🔴 criterion 4's *full* gesture — deleting a variable that is in use — still owed |

Everything a builder loses work to is fixed and proved. The rest of the phase is polish, library
work, and one flagship.

## 🔴 The four things the drive learned that will cost you time if you skip them

These are not trivia. Three of them produced a passing-looking wrong answer during the drive itself.

1. **`BaseDialog` renders its children TWICE** — a zero-height `MeasuringContainer`
   ([`BaseDialog.tsx:330`](../../../packages/noodl-core-ui/src/components/layout/BaseDialog/BaseDialog.tsx))
   plus the visible `ChildContainer` (`:360`). Consequences, all confirmed:
   - `document.body.innerText` **double-counts** every dialog's text.
   - Every button has a **phantom twin above the real one**; a click at its centre lands on a `<p>`.
     Three "the prompt did not re-open" readings were this, not a defect.
   - 🔴 **Anything a dialog body takes on mount, it takes twice.** That was a live bug
     (`d9f41d20`): `takeEphemeralFocus()` threw on every single dialog open and a `try/catch` hid it.
   - 🔴 It is **VFN-007's actual defect** — see below.
   - ⚠️ `querySelector('[class*=ChildContainer]')` is **not** a safe filter; it matched the measuring
     pair. Use `:not([class*=MeasuringContainer])`, and hit-test with `elementFromPoint` before every
     click. **This directly affects VFN-006, 008 and 009**, which all add controls to these dialogs.
2. **`scrollWidth > clientWidth` is not a clip test.** Integer-rounded, so it reports a false 1px
   overflow on any fractional-width box — it failed the *fixed* field on 4 of 4 kinds. Drive
   `scrollLeft` instead. VFN-002's task file said the wrong thing and now says so.
3. **`Router.route()` is a silent no-op editor→editor**, and `webpackChunknoodl_editor.push` with a
   repeated chunk id **never calls back**, leaving `__wr` undefined. Both read as success.
4. **Never remove portal children directly to "clear" a dialog** — it breaks the React tree and
   `body.innerText` goes empty. And **never wrap `Blockly.dialog.prompt` using `B.dialog.prompt` as
   the original**: that is the public dispatcher, so it recurses and kills the button, which reads
   exactly like the silence bug you would be testing.

## The order I would work it

### 1. VFN-011 — the bench. The flagship, ~2 days, no dependencies

Still the one task that changes what the node *is*, and still untouched. Nothing in the drive
disturbed its plan:

- **Part 1 is cheap and separable** — a sixth `STATUS_COPY` reason plus no-probe detection. "No runs
  yet" is currently correct behaviour producing a wrong impression, and naming the reason is one
  string. Worth landing alone even if Part 2 slips.
- 🔴 **The drift gate is the task, not a nicety.** An editor-side runner that stops agreeing with the
  runtime is a second truth about what a program does. Build the spec that runs the same
  `generatedCode` through both compile paths over a ~6-program fixture **before** the UI.
- 🔴 **Read the rails' existing `detectInterface` projection** before enumerating inputs again —
  that is the phase-59 standing constraint this task is most likely to break.

### 2. VFN-007 — now a ~1 hour job, and it is worth doing next because it is nearly free

🔴 **Do not start with `icon-contrast.js`.** The reproduce step is done and the contrast hypothesis
is **ruled out as the cause**. The mechanism is written into the task file: two copies of the dialog
body means four `name="myblocks-shelf"` radios in one document-scoped native group, so the browser
gives the check to the **invisible** copy while React's state is correctly `'user'` — which is
exactly why the report says the save still lands on the backpack.

The proposed fix (themed option cards) is unchanged and now has a real reason behind it. While there:
the radios carry **no `value` attribute**, so nothing in the DOM says which shelf a radio stands for.

⚠️ **`DEFAULT_SCOPE` stays `'project'`.** Untouched by any of this.

### 3. VFN-008 → VFN-009 → VFN-010, one job in three sizes

Unchanged from the previous handover, and still right. 008 is the cheapest half of the value; its
plumbing already exists. ⚠️ **Do VFN-011 before VFN-009** if both are scheduled — 009's definition
tab has no node, so Do It and live values are meaningless on it until the bench exists.

⚠️ **VFN-009 §2's `subject` field:** `tabsClosedByNodeRemoval` is *already* correct under that
design — it never closes a tab without a `nodeId`. Add the field; do not touch that predicate.

### 4. VFN-005 and VFN-004 and VFN-006

**VFN-005's criterion 1 is answered: occlusion.** Every blocked point sits inside the window rect,
every reachable one outside it. Build the parking and snapping; there is no pointer-events hunt.
⚠️ The fixture measured **74.1% × 69.5%** because it had *stored* geometry — criterion 4's fresh
profile case is a separate reading and will be **worse**, not better, at `LOGIC_OVERLAY_DEFAULT_FRACTION = 0.82`.

**VFN-004:** 🔴 `Router.route()` is a silent no-op editor→editor — use the same path the components
panel uses, or it will do nothing and look exactly like the bug.

**VFN-006:** criterion 5 is the one to design against from the start — **an overlay, never a model
change.** Copy `BlockValueBadges`' shape.

### 5. VFN-012 last

Unchanged. ⚠️ It is the one task that must run `npm run cloud-library:check`, a required PR gate that
drifts red on port changes.

### Small remainders worth sweeping up in any session that is already in the editor

- **VFN-002 criterion 3** — AA contrast on the field editor ring, both themes.
- **VFN-002 criterion 4** — dropdown fields, which share the `.blocklyWidgetDiv input` selector.
- **VFN-003 criterion 4** — the *full* "delete a variable that is in use" gesture. The seam is proved
  (accept → `true`, cancel → `false`, themed card, non-blocking); the caller is not.
  ⚠️ `deleteVariableById` bypasses the confirm, so drive it from the flyout's own delete option.

## Working conditions

| Gate | Command | Last measured |
|---|---|---|
| `test:main` | `cd packages/noodl-editor && npx jest` | **157 suites / 2265 green**, ~13 s |
| `test:ci` | `npm run test:ci` | 2724 specs / **9 documented failures**, seed 86503, ~35 min |

🔴 **`test:main` is the gate for almost everything here.** `test:ci` is only needed if you touch
`packages/noodl-editor/tests/`. Compare **names**, never counts, and read `tests/test-results.json`
rather than the log — a run can exit `0` having graded nothing.

**Driving.** A working harness is described in the drive itself: `LogicBuilder.OpenTab` on
`EventDispatcher.instance` opens the window with no selection; `e.selectNode(e.roots.find(...))`
selects a canvas node (**`e.roots` are views, `e.model.roots` are models**); real key events need
`Input.dispatchKeyEvent`, because a synthesised `KeyboardEvent` lets you *construct* the composed
path VFN-001 is supposed to *observe*.

🔴 **Launching the dev stack kills the checkout's MCP servers.** `scripts/start.ts:199` sweeps with
the same matcher `dev:stop` uses, *before* starting anything. Count first
(`ps aux | grep "[n]oodl-mcp"`); if any are live, that is a user-facing consequence to raise, not to
absorb. To stop, kill the `scripts/start.ts` pid — **never `npm run dev:stop`**.

**The checkout is shared.** A third session's `PortsTab/`, `TraceSession.ts`, `portValues.ts`,
`usePortValues.ts` and `tests/nodegraph/port-values.spec.ts` have been uncommitted in the tree since
2026-08-12. 🔴 **Never `git add -A`**; stage explicit pathspecs. 🔴 **Never `git stash` here.**

## The pattern that keeps paying

Every correction this phase has produced came from **building the instrument and watching it
disagree with the story** — not from reading more carefully:

- VFN-001's fix sketch was insufficient, and the spec caught it.
- VFN-002's *stated instrument* was wrong, and the control caught it.
- VFN-007's *four eliminated candidates* were all correctly eliminated and the real cause was a
  fifth nobody had considered — found by reading the DOM rather than the source.

🔴 **A suite of absences is indistinguishable from an instrument that measured nothing.** Every
criterion in this phase is an absence — "no second deletion", "no padding", "no silence", "no
duplicate". Each one that has been closed carries a negative control that goes red on demand. Keep
doing that; it is the only reason any of these results can be trusted.
