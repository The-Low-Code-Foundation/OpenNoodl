# Close out Phase 64 — the build fan-out, then one serial drive

> # ✅ SUPERSEDED by [NEXT-SESSION-2026-08-13-F.md](NEXT-SESSION-2026-08-13-F.md)
>
> **This file's plan was executed and it worked.** All five lanes landed
> (`e61986a5`, `3acf2941`, `082e2c37`, `db4f6d72`), phase 2's gates are green, and **phase 1 and
> phase 2 are done**. Lane E's reconciliation — the thing this file called "not a footnote" — is the
> commit you are reading.
>
> **Only phase 3 is left**, and its 13-item list below is now out of date in two ways:
>
> - **item 13, "Lane A's placement, in whatever form it took"**, has a concrete form: **Park + Home,
>   snap-to-halves rejected**, plus a *yield* on `openSettingsPanel`. It has five specific readings,
>   not one vague one.
> - **four lanes of new work arrived after this list was written** and each brought owed items of its
>   own — VFN-010's seven, VFN-012 §2/§3's eight, and the copy/contrast sweep's five.
>
> 🔴 **Go to -F for the consolidated drive brief.** The sections below on *driving conditions*, *the
> standard this phase is held to* and *housekeeping* are still current and are carried into -F.

**Supersedes [NEXT-SESSION-2026-08-13-D.md](NEXT-SESSION-2026-08-13-D.md)**, whose headline item —
VFN-004 failing live — is fixed and driven (`da090f0b`, [DRIVE-2026-08-13-D.md](DRIVE-2026-08-13-D.md)).

**Goal: Richard opens the editor and the whole phase works.** Two tasks are unbuilt, one is
half-built, and **nine tasks are built and merged but have never been run**. The unbuilt work is
small; the undriven work is the risk, and this phase has now twice shipped something that passed
headless and was dead on screen.

---

## 🔴 Read this first: both registers are stale. Git is the arbiter.

`TASKS.md` and the individual task files **disagree with each other and with the repo**. Do not plan
from either without checking `git log --oneline --grep=vfn -i cline-dev`.

- `TASKS.md` says VFN-007 and VFN-009 are `📋 open`. **Both are built and merged** (`136fa3be`,
  `a5cab23e`).
- The task files for VFN-006 and VFN-009 still say `📋 open` in their own status lines. **Both are
  built and merged** (`22f9e1fe`, `00261768`).
- Every `vfn-*` branch is already merged into `cline-dev`. `git branch --no-merged cline-dev` lists
  only unrelated lanes.

**Fixing this drift is part of closing the phase**, and it is Lane E's job — not a footnote.

### Ground truth, 2026-08-13 after `da090f0b`

⚠️ **This table is a snapshot from before the five lanes landed and is kept as a record of what they
were aimed at.** VFN-005, VFN-010 and VFN-012 §2/§3 are no longer unbuilt. **The current table is in
[TASKS.md](TASKS.md).**

| Task | Built? | Driven? |
|---|---|---|
| VFN-001, 002, 003 | ✅ | ✅ (002 owes criteria 3–4; 003 owes one gesture) |
| **VFN-004** | ✅ | ✅ **AC 1–4 live**; AC 5, 6 owed |
| **VFN-005** | 🔴 **NOT BUILT** | — reproduced as occlusion |
| VFN-006 | ✅ merged | 🔴 **never** |
| VFN-007 | ✅ merged | 🔴 **never** (criteria 3, 4) |
| VFN-008 | ✅ merged | 🔴 **never** |
| VFN-009 | ✅ merged | 🔴 **never** |
| **VFN-010** | 🔴 **NOT BUILT** | — unblocked, VFN-009 exists |
| VFN-011 | ✅ | ✅ flagship works; items 4, 6, 8, 9 + a copy trim owed |
| VFN-012 | 🟡 **§1 only** | partly — §2/§3 never built |
| VFN-013, 014 | ✅ | 013 ✅ re-swept · 014 🔴 **never** |

---

## The shape: fan out the builds, then **one** drive

🔴 **Live QA is serial across this machine.** Two editors, or an editor beside `test:ci`, manufacture
failures that look exactly like defects. So:

**Phase 1 — five lanes in parallel, each in its own worktree, each committing to its own branch.**
**Phase 2 — merge all five, run the gates once.**
**Phase 3 — ONE agent, in the primary checkout, drives everything owed in a single bundled session.**

Do not let a build lane launch the editor. Do not start phase 3 until phase 2's gates are green.

### Creating the worktrees

```bash
scripts/devtools/make-worktree.sh <branch-name>
```

🔴 **Never `isolation: "worktree"`** — the harness creates the branch from `origin/main`, hundreds of
commits behind `cline-dev`, with no `dev-docs/` at all. 7 batches out of 7.
🔴 **Never a scratchpad path** for a worktree. 🔴 **Never `git stash`** anywhere in this checkout.

---

## Phase 1 — the lanes

### Lane A ⭐ — VFN-005, the window's placement

**The phase's last real design decision, and it now has a concrete consequence to fix rather than an
abstract measurement.** Criterion 1 is answered: the window **occludes** the running app (74.1% ×
69.5%, every blocked point inside the window rect).

🔴 **The argument that should drive the design:** VFN-012's own flyout has a button labelled *Open app
settings*. It works — and the panel it opens is **behind the Logic Builder window the user pressed it
from**. A feature's call to action lands somewhere the feature is hiding. Whatever you choose — park,
snap, or place — **must account for a panel opening underneath**.

Read `VFN-005-THE-APP-IS-BEHIND-THE-WINDOW.md`. Decide, write the decision down with its rejected
alternatives, build it, and grade the geometry headlessly.

⚠️ **This lane changes where the window sits, which invalidates every coordinate in
`DRIVE-2026-08-13-C.md` and `-D.md`.** It must land before phase 3. Say so in your handover.

### Lane B — VFN-010, the backpack in the launcher

Unblocked: VFN-009's manager exists and is merged. Read `VFN-010-THE-BACKPACK-IN-THE-LAUNCHER.md` and
`VFN-009-THE-LIBRARY-IN-THE-PROJECT.md` — 010 is meant to be a second instance of 009's manager, not a
second implementation of it. **If you find yourself writing a parallel store, stop and reuse.**

Includes the picker marking which blocks are backpack-scoped versus project-scoped, and the
propagation warning that names the call sites.

### Lane C — VFN-012 §2 and §3, the blocks the app already has

§1 (app-config variables) is built and driven. §2/§3 — registered libraries and `window` — were cut
cleanly and are the phase's most droppable scope.

⚠️ **Build it, but treat it as the lane to sacrifice if it is fighting you.** A coherent partial
answer already shipped. If you drop it, say so out loud in the handover rather than leaving it
ambiguous — that is the whole reason this file exists.

🔴 `App Variables` ≠ `Noodl.Config` — a ruling from 2026-08-13, do not re-litigate.

### Lane D — the copy and contrast sweep

Small, real, and all of it visible to a user:

1. 🔴 **VFN-011's strip sentence is ellipsised** at the real pane width, cut off exactly where it says
   what the bench is *for*: *"…Press ▶ Run below to work them out here, with the app stop…"*. **Trim
   the copy.** It is the sentence that teaches the feature.
2. **VFN-002 criterion 3** — the AA contrast reading on the field editor, never taken.
3. Sweep the phase's new surfaces for the failure this register keeps finding: an icon host that sets
   `fill` sets nothing, and `--theme-color-bg-2` on a Blockly hue measures 2.58:1.

⚠️ Contrast claims about a *rendered* surface belong to phase 3. Anything you can prove from the
stylesheet or a token, prove here.

### Lane E — reconcile the registers

Not busywork; see the top of this file. Bring `TASKS.md`, all fourteen task-file status lines, and the
`NOTES-*.md` owed-drive tables into agreement with `git log`. **Every row states what is built, what is
driven, and what is owed — and nothing claims a drive that did not happen.**

⚠️ Lane E must run **last** or merge last, since the other lanes change the answers.

---

## Phase 2 — merge and gate

Merge order: E last. For each merge, 🔴 **diff the REMOVED lines** — this register has lost work to a
merge that looked clean.

```bash
npx jest                             # floor: 185 suites / 2806 passing, 0 failures (was 175 / 2622)
npx tsc -p tsconfig.json --noEmit    # must be clean (run from packages/noodl-editor)
npm run cloud-library:check          # required PR gate; drifts red on any port-group rename
```

🔴 **`--noEmit` is not optional and its absence is silent.** Without it, `tsc` emits ~3096 `.js` and
`.js.map` files into `packages/*/src`; jest then resolves `BenchRunner.js` over `BenchRunner.ts` and
**158 of 178 suites fail to run** while the log prints passes and zero failures. The artefacts are
untracked, so `git status` looks fine. **This file shipped the command without `--noEmit`** — that is
the drift it was written to warn about, in its own gate block. See `NOTES-contrast-sweep.md`.

⚠️ `tests-unit/aib-009/turnDeadline.test.ts` asserts on **real timers** and flakes under 175-suite
parallelism. It passes alone and on a re-run. **Not a regression — do not go hunting.**

⚠️ Read `tests/test-results.json`, not the log: a run can exit `0` having graded nothing.

---

## Phase 3 — the bundled drive, one agent, primary checkout

Everything below is a consequence only the real app reports. **Take them in this order** — it is
roughly descending risk.

1. **VFN-006's outline painting and its hover trigger.** The lane calls the trigger *"the weakest
   thing I built"* and names where it will fail: a guess about Blockly 12's menu DOM. Most likely to
   be broken.
2. **VFN-009's section renders at all.** Nothing in it has ever been on screen. Does *Edit blocks*
   open the floating window while the settings panel is open? The window is a canvas overlay and
   whether it is even visible from the settings route is a question only a drive answers.
3. **VFN-014 criteria 1–2** — one press of *View Code*, including whether the 14 lint warnings go.
4. **VFN-007 criteria 3–4** — the radiogroup's selected state on screen, and keyboard.
5. **VFN-008** — a saved block that describes itself, end to end.
6. **The ports fix, gesture 2** — drag a saved block into a *second* Visual Function, and prove the
   port **accepts a wire** (a real drag on the canvas; only the migrate path has been driven).
7. **`inert` in the running editor** — Tab into any dialog, confirm the first Tab lands on a visible
   control. An editor-wide change to a 29-consumer component.
8. **VFN-011 items 4, 6, 8, 9** — criterion 7 with a preview running, the focus-preserving repaint, a
   genuinely stale node, Part 1's `generatedCode` thread.
9. **VFN-012 item 3** — the `⚠` mark's contrast on a hue-90 block; needs a config variable declared
   and then deleted.
10. **VFN-004 AC 5 and AC 6** — two tabs on different components distinguishable from labels alone,
    and a deleted component leaving the tab open with a named refusal. Needs a second Logic Builder
    node in another component.
11. **VFN-002 criterion 4** — dropdowns.
12. **VFN-003** — the full *delete a variable in use* gesture.
13. **Lane A's placement**, in whatever form it took.

### Driving conditions, all of them earned

- **Fixture: `vfn64-drive`** (`NodeGX test projects/`), project name `VFN64-DRIVE-UNIQUE` — deliberate,
  because the launcher had two cards both named `lgc010-drive` and `cdp click` takes the first match.
- 🔴 **Never `npm run dev:stop`** — it kills Richard's MCP servers. `kill` the `scripts/start.ts` pid.
- 🔴 **`cdp click` takes a CSS selector, not coordinates.** Tag the element first
  (`el.setAttribute('data-drive-target','x')`), then click `[data-drive-target=x]`.
- 🔴 **`ed.selection` does not exist — it is `ed.selector._selected`.** The wrong accessor returns
  `[]`, which is indistinguishable from a real empty selection and nearly filed a false failure in
  session D. Confirm a selection through a second instrument; the property panel's text says which
  node it is on.
- 🔴 **`cdp click` on a Blockly toolbox category opens the wrong category** — it re-measures and the
  layout still moves. Use `ws.getToolbox().setSelectedItem(item)`.
- 🔴 **Screenshots are 2× device pixels.** A CSS rect of `y=235` is pixel `y=470`; crop accordingly or
  you will measure the wrong element and believe it.
- ⚠️ **The launcher's open-by-path recipe does not work** — no `memoizedProps.route.router` on the
  launcher route. Drive it by click. Card centres are covered by a `Chip`; target the `…__Name` element.
- ⚠️ **The call block is not top-level** — `hatMigration` wraps it in a `noodl_when_signal`, so
  `getTopBlocks()` misses it. Use `getAllBlocks(false)`.
- ⚠️ **Poll, never sample once.** React has not repainted in the tick you navigated; a synchronous
  read reports the old value and looks like a dead feature.
- ⚠️ **HMR leaves the mounted editor on the old module.** Reload after a merge.

---

## The standard this phase is held to

Every result stated as a pass carries **a control that was watched go red**. Not written — watched.

Session D's fix was graded by injecting the pre-fix body and confirming 7 specs failed with the live
symptom. Session C found three findings that were nearly filed backwards: a clean, confident and wrong
"stale `generatedCode`" conclusion, a criterion passing vacuously because Blockly fires events from a
`setTimeout`, and a JSX scanner that found 1 of 3 `{children}` sites.

🔴 **A suite of absences is indistinguishable from an instrument that measured nothing.** If a lane
reports "no overlaps", "no events", "unchanged", or "not there", it owes the control that proves the
instrument could have seen the opposite.

🔴 **And check the identifier before blaming the mechanism.** VFN-004 had a correct event, a correct
derivation and a correct predicate, and was dead for a day because the field they all agreed on was
`undefined` on 5 of 7 components. When something "does nothing", suspect the key first.

## Housekeeping

- ⚠️ A third session's `PortsTab/`, `TraceSession.ts` and `port-values.spec.ts` are **uncommitted** in
  the primary checkout and are not ours. Never `git add -A`.
- ⚠️ `git stash list` shows `stash@{0}: WIP on cline-dev`, flagged by three lanes now and **left alone
  deliberately** — popping it crashes an editor a human is using. Someone should decide what it is.
- ⚠️ `MEMORY.md` is 20.6 KB against a 24.4 KB read limit and needs a prune that only Richard can make:
  9.2 KB of it is filenames, so getting under the target means dropping entries, not rewording them.
