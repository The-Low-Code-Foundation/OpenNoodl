# Next session — Phase 59 (LGC): the exit test is finally the thing standing in the way

**Read this, then `TASKS.md`.** This is the first handover in the phase that is not blocked on a
ruling, not blocked on a gate, and not blocked on a mechanism nobody understands. Four of the exit
test's five items are **built, merged and driven**. What is left is small, named, and mostly needs a
person rather than a session.

## 🔴 The one thing to be honest about

**The phase exit test needs a human tester, and it always did.** It is five tasks performed by *"a
person who has never opened NodeGX"*, and §2's A/B needs two groups of them. No agent can close it.

So the achievable target — and it is now within reach — is **"every item of the exit test is
attemptable, with the code behind it driven"**. Do not report that as "the exit test passed". The
phase closes when Richard runs it with real testers.

## Where the exit test actually stands

| # | Item | Task | State |
|---|---|---|---|
| 1 | types `multiply`, is offered the three logic nodes **with an example each** | LGC-001 | ✅ **DRIVEN.** Exactly three results, in the ruled order (Expression → Visual Function → Function), each with `tag · multiply`; all three preview rows match the chooser copy |
| 2 | places the visual one and **sees its inputs and outputs without being taught** | LGC-004 | ✅ **DRIVEN.** Five rows, right names and types, inferred ones marked; rails hold still under pan and zoom; the row renames per keystroke |
| 3 | **right-clicks a block and sees its value** | LGC-002 | 🔨 **Built, wired — NOT DRIVEN.** The one code item still owing a drive. See below |
| 4 | watches the app and the blocks **at the same time** | LGC-008 | ✅ **BUILT, MERGED, DRIVEN.** Canvas and blocks on screen together; no remount across a splitter drag; F4 proved on two mounted workspaces |
| 5 | **saves the calculation and drops it into a second one** | LGC-007 | 🚧 **The engine has always existed; the UI did not.** A lane is building the save→drop path. **This is the item that gates the phase** |

## What landed on 2026-08-12, after the four rulings

| Commit | What |
|---|---|
| `3416cf9e` | ✅ A refusal to generate no longer writes its silence to disk |
| `144f1a0d` | ✅ `Conditions & Booleans` — L7 closed |
| `76c9a092` | ✅ LGC-007 §6 **re-driven 3/3**; the "node-selection gate" was never a gate |
| `130f5df6` | ✅ `cdp drag`; LGC-004's rails **driven 11 of 15** |
| `5c210c03` | ✅ LGC-001 §1 + §4 **driven** |
| `1f95c0dc` | ✅ **LGC-008 merged** — F3, F4, the pane |
| `9667630c` | ✅ **LGC-009 merged** — the hat, and both fixtures migrated |
| `3a69ab43` | ✅ LGC-008 **driven**: the acceptance criterion is met |

**Gates, measured in the primary checkout after both merges** — not taken from the lanes:

| Gate | Result |
|---|---|
| `packages/noodl-editor` → `npx jest` | **150 suites / 2171 tests green** (was 144 / 2107) |
| `packages/noodl-runtime` → `npx jest` | **134 of 135 suites / 2476 passed, 13 skipped** (was 133 / 2467) |

Both totals are **exactly additive** over the baselines, which is how you know nothing vanished.

## 🔴 Findings that need a decision, not a fix

These are the three things worth Richard's attention before anything else is built.

1. **The pane has no minimum width.** At a 288 px pane the two interface rails are 152 px each —
   304 px of rails in a 288 px pane — and `.injectionDiv` measures **0**. The block editor is simply
   absent, with no clamp and no message. Also answers **LGC-004 step 14**. The floor is not a taste
   question; *what should happen* is: clamp the splitter, collapse the rails below a threshold (they
   are DOM siblings, so they can), or let the pane close.
2. **L30 keystroke ownership blocks shipping the pane.** With both surfaces on screen a node
   selection and a block selection coexist, and `KeyboardHandler` has no scope — **one Delete can
   mean two deletions.** It is a keyboard-scope task the pane forces rather than contains.
3. **The interface rails fail AA.** Measured in both themes, flipped live: the 10 px type label
   scores **3.66** dark and **3.43** light; the signal type **4.33** light — against 4.5. Every
   functional rail step passed against text that is below AA.

Two smaller ones, both from the rails drive: a row released **over the toolbox creates a block**
(released outside the pane it correctly creates nothing, so the cancel path exists — the toolbox is
just not in it), and the block a rail drag creates **is not selected**, which step 5 asks for.

## The order I would work it

**1. Drive LGC-002 — exit item 3, and the last code item owing one.** ⚠️ **It needs a running
preview**, because the acceptance is *live* values and not defaults. Fixture: a copy of
`lgc59-drive`. The list is in that task file; the two that catch real defects are *"three balloons
up simultaneously"* and **§2's touched half** — save, close, reopen, and compare the `workspace`
parameter after a program that was actually edited. §2's *untouched* half already passed.

**2. Finish the LGC-007 save→drop path and drive it.** Item 5. Everything under it exists —
format, cycle guard, shape inference, inliner, 66+5 specs — so this is a surface, not an engine.
🔴 **`@blockly/workspace-backpack` cannot be installed from a worktree** (`npm install` mutates the
primary tree's `node_modules` through the symlink); it needs a primary-checkout install, pinned to a
12-line release, or a toolbox category of our own.

**3. Take the three decisions above**, then build whichever of them Richard rules on.

**4. What is left after that**, none of it on the exit path: LGC-004 §2/§3's props panel (still
waiting on the sibling landing `PortsTab/`; **L38** decides its architecture — a panel edit made
while the block tab is open is silently destroyed, so it needs two write paths), LGC-005 §3,
LGC-006's installs, LGC-003 §4.

## Working conditions — read these, they cost time today

- 🔴 **Live QA is serial across the whole machine.** A `dev:debug` stack launched beside two working
  agents took SIGTERM mid-drive. `start.ts` sweeps leftovers before starting more, so anything that
  launches a stack reaps yours. **Do the drives in a session that owns the checkout**, and do the
  headless lanes in another.
- ✅ **`cdp drag <from> <to>`** now exists (`scripts/devtools/cdp.js`); either endpoint may be a
  selector or literal `x,y`, because half the drop targets are canvas with no element to name. Its
  intermediate moves are load-bearing — a press followed straight by a release is a click.
- ✅ **Opening the block editor needs no canvas gesture**: emit `LogicBuilder.OpenTab`
  `{nodeId, nodeName, workspace}` on `EventDispatcher.instance`, which is exactly what the Properties
  panel button does. **Selecting a node**: `e.selectNode(e.roots.find(v => v.model.id === id))` —
  `e.roots` are the **views**, `e.model.roots` the **models**.
- ✅ **The node picker is not a button.** `InteractionController` builds it on a **right-click on
  empty canvas**; construct the same `CreateNewNodePanel` and show it via `PopupLayer.instance`.
- ⚠️ **Wall-clock specs flake under load** — `aib-009/turnDeadline`, `bld-004`. Both went red in a
  loaded run and green alone. **Re-run a suspicious file by itself before believing it.**
- ⚠️ **Worktrees:** `scripts/devtools/make-worktree.sh <name>`, never the harness's
  `isolation: "worktree"`. `packages/noodl-runtime/dist-types` is a gitignored symlink inside one, so
  **`npm run build:types` must be run from the primary checkout** before typechecking or merging a
  runtime change.
- Both fixtures are **hat-migrated** as of today. Backups of the pre-migration files are outside the
  repo; the migration is re-runnable and idempotent (`scripts/lgc009/migrate-hat-fixtures.ts`, with
  `--check`).

## 🔴 The pattern that actually cost this phase its laps

**Four times in one session a measurement taken at the wrong moment, on the wrong element, or with
nothing else changing produced a confident finding that was false.**

| The finding | What it really was |
|---|---|
| *"the canvas node-selection gate is unsolved; `selectionActions` has no `selectNode`"* | `Object.keys()` on a class instance. `selectNode` is on the **prototype** — and was already in the memory directory |
| *"`generatedCode` unchanged — the fix works"* | Opening a cyclic node fires **no flush at all**. Nothing had run |
| *"CDP mouse events never reach Blockly's gesture handler"* | A grab point 8 px inside a nested block's bounding box, which is empty workspace |
| *"the second tab disposed the first tab's workspace"* | An async injection sampled 8 s in, mid-flight. `Workspace.getAll()` also includes **flyouts** |

Each would have been written down as a defect or a blocker. **Before recording an absence, prove the
thing you measured was the thing you meant, at a moment when it could have been true.** Where a guard
is concerned, name what it *must still* write and assert that too — a skipped write and an
unexecuted code path are indistinguishable by absence.

## Do not re-litigate

- **The four rulings of 2026-08-12** — LGC-008 F2 (both panes), LGC-009 (hat mandatory), LGC-007 §4
  (sweep unauthorised), Q5 (`Conditions & Booleans`). Each was put up with its alternative beside it.
- **LGC-009's migration cost.** Two fixtures, both ours. Measured again today when the migration ran:
  **2 workspaces changed.** That number was wrong once and nearly decided the ruling the other way.
- **`disableOrphans`.** Reverted, filed, tombstoned. The middle path was weighed and rejected in
  writing.
- **`undefined` vs `''` on the generation seam.** `''` is a real program — the one with no blocks —
  so a refusal may not use it. A tidy-up that collapses them re-opens a data-loss defect, and it will
  look like a simplification when it does.
- **LGC-007 §4's sweep** and **LGC-003 §4** — both deliberately unbuilt.
