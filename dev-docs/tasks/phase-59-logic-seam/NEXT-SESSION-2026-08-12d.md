# Next session — Phase 59 (LGC): four rulings in hand, and a phase that can now actually be closed

**Read this first, then `TASKS.md`.** The blocking questions are answered. Every lane in this phase
is now buildable, which was not true this morning — the previous handover opened with *"🔴 Rulings
needed from Richard before the work they block"* and all four came back.

**What "closed" means, and be honest about it:** the phase exit test in `README.md` has five items
and needs a human tester. Item 4 needs LGC-008's pane, which is **still unbuilt**. So the realistic
target for the next session or two is *"every lane built and driven, exit test attemptable"* — not
*"exit test passed"*. Do not report the first as the second.

## ✅ The four rulings — 2026-08-12, do NOT re-litigate any of them

Each was put up with its alternative beside it, with diagrams. The cheaper option lost in two of the
four. They are written into the task files as well, so the source of truth is not this prompt.

| # | Ruling | What it unblocks | 🔴 What it costs |
|---|---|---|---|
| **LGC-008 F2** | **Both panes on screen at once.** The literal reading of *"a pane, not a takeover"* wins. **The second splitter gets built** | the pane; exit-test item 4 | The expensive branch. **F3 and F4 stop being edge cases** — see below |
| **LGC-009** | **The hat is MANDATORY** | `disableOrphans` becomes correct → **LGC-003 §2 is bought back** | Migration is **two fixtures, both ours**. 🔴 A hat naming a signal is a *second* declaration of a port — lands on **L39** |
| **LGC-007 §4** | **Do not build the regeneration sweep yet.** Fix the destructive-write class first | — | Sweep stays **unauthorised**. Re-put the save-path question with the fix in hand |
| **Q5 `Logic` collision** | **Rename the sub-category, keep the rail label** | LGC-001 **L7 closes** | none — display string only. ✅ **done**, `144f1a0d` |

## What landed this session

| Commit | What |
|---|---|
| `3416cf9e` | ✅ **The destructive-write class is fixed.** Ruling 3's precondition. Details below — the mechanism was **not** where the drive pointed |
| `144f1a0d` | ✅ `Logic & Utilities`' sub-category → **`Conditions & Booleans`**. L7 closes. All four rulings written into the task docs |

## ✅ The fix, and why the mechanism matters more than the fix

The drive pointed at LGC-007's cycle guard. **The defect was in `BlocklyWorkspace.flushSave`**, which
held `lastGoodCodeRef = useRef('')` — **seeded from nothing, never from the node's saved
`generatedCode`** — and passed it on when generation errored. A refusal on the first flush after
mount therefore passed that initial `""` straight to `setParameter('generatedCode', '')`.

**That is why reopening never recovered it.** The ref was empty again on every mount. The cycle guard
was doing its job correctly the whole time.

**The fix was to delete the ref, not to seed it.** The node's own `generatedCode` parameter *is* the
last code that generated cleanly, so an editor-side copy is the one-fact-two-stores shape (**L11**)
this directory keeps finding. `undefined` now travels the seam on a refusal; the writer saves the
workspace unconditionally and leaves `generatedCode` alone.

🔴 **`undefined` and `""` must stay distinct here.** `""` is a *real* program — the one with no
blocks in it — and writing it is legitimate. That is precisely why a refusal may not use the same
value. **A future tidy-up that collapses them re-opens the defect**, and it will look like a
simplification when it does.

## 🔴 Two facts that change how you should read every gate in this repo

### `strictNullChecks` is OFF, repo-wide

The root `/tsconfig.json` sets **no `strict` flags at all**, and every package extends it. Found
because `GenerateResult.code` was declared `string` while the error path returned `undefined` — a
contradiction that compiled silently for as long as it existed.

**So the `string | undefined` annotations on this seam are documentation, not enforcement.** Nothing
stops a future edit returning `""`, and nothing forces the caller's check. `npx tsc --noEmit` coming
back clean after you add `| undefined` is **evidence of nothing**.

The contract is held by `tests-unit/lgc-007/generateWithMyBlocks.spec.ts` instead, **proved red** by
inverting the fix: exactly the two intended specs fail and the refusal-still-reports spec stays
green. ⚠️ Do not "fix" this by flipping `strict` on globally — this repo ratchets type debt
deliberately.

### ✅ Two cheap gates now have baselines, and they were unmeasured for weeks

| Gate | How | Result at `144f1a0d` |
|---|---|---|
| `test:main` | `npx jest` **inside `packages/noodl-editor`** | **144 suites / 2107 tests green**, ~23 s |
| runtime | `npx jest` **inside `packages/noodl-runtime`** | **133 of 134 suites (1 skipped) / 2467 passed, 13 skipped**, ~11 s |

**Run these two first, always.** Seconds, no Electron, and they catch most regressions. A `test:ci`
attempt is only worth it once both are green — it has now failed to grade **three times running**
(OOM, then two 900 s cutoffs, the last at 92%). `NOODL_TEST_TIMEOUT_MINUTES=25` exists if you need
it, but check the machine is not swapping first.

## Where the phase stands

| Task | Code | Driven? |
|---|---|---|
| LGC-001 triad ⭐ | 🟡 built · ✅ L7 closed | ❌ §4's preview column: **Function row passes** incidentally, Expression + Visual Function unobserved |
| LGC-002 Do It | 🔨 built, wired `caed5986` | 🟡 **§2 untouched-half PASSED.** §1's acceptance list + touched half open |
| LGC-003 values | 🔨 §1/§3/§5 built · §2 **now unblocked by the hat ruling** · §4 filed | ❌ |
| LGC-004 rails | 🔨 §1+§4 built · §2/§3 panel **not** built | ❌ — #1–#15 all open |
| LGC-005 types | 🔨 §1/§2 built, §3 deferred | ❌ |
| LGC-006 plugins | 🔬 verdict only, **nothing installed** | ❌ |
| LGC-007 My Blocks ⭐ | 🚧 engine + ✅ **write path fixed** · **no UI at all** | 🟡 §6 was 2/3; **the third condition should now pass — unconfirmed** |
| LGC-008 pane | 🔬 analysis + `svgResize` · **pane not built** · ✅ **ruled, buildable** | ❌ |
| LGC-009 hat | 📋 filed · ✅ **ruled MANDATORY, buildable** | n/a |

## The order I'd work it, and why

**1. Re-drive LGC-007 §6 first.** It is the cheapest thing here, it confirms the one fix that landed
this session, and it answers two open questions in the same run. Fixture `lgc59-cycle`.

- *Pass:* workspace stays live, console names the loop, **and `generatedCode` is unchanged**. That
  third condition is the one that failed; grade all three **separately**. A strong pass on two reads
  as success if you skim — that is exactly how this defect survived its first drive.
- Also answer: does the empty write happen on **open** or on the first debounce tick? And does a node
  **regenerate** once its definitions are fixed?
- ⚠️ **Re-baseline the fixture with an editor save first.** `lgc59-cycle` was rewritten with 2-space
  JSON by a restore, so its byte formatting no longer matches what the editor writes.
- ✅ Measure from **disk**, not pixels: `shasum` + a `node -e` walk of `project.json` before and
  after. No canvas driving needed, which is why this one is first.

**2. ~~Solve the canvas node-selection gate.~~ ✅ SOLVED 2026-08-12. It was never a gate.**

```js
const e = window.__nodeGraphEditor;
e.selectNode(e.roots.find(v => v.model.id === 'c6'));   // Properties panel follows
```

Driven and confirmed: selecting `c4` swapped the Properties panel to **Counter**, so the whole
panel-dependent half of drive items 3–6 is reachable without a canvas gesture.

🔴 **Why the last session concluded the opposite, because the mistake is reusable.** It read
`selectionActions`' **own** keys — which really are just `{editor}` — and stopped. `selectNode`
lives on the **prototype**, on both `selectionActions` and `NodeGraphEditor` itself.
`Object.keys()` on a class instance is not a survey of its API; use
`Object.getOwnPropertyNames(Object.getPrototypeOf(x))`.

⚠️ **And it was already written down.** The LEG-003 drive recorded `nodeGraph.selectNode` (view
nodes, matched on `n.model.id`) in the memory directory before this phase started. **Two objects,
one trap:** `e.roots` holds the *views* that `selectNode` wants; `e.model.roots` holds the
*models*. Passing a model selects nothing and throws nothing.

- Nodes are still **Canvas2D, not DOM** — you still cannot `cdp click` a node, and the picker's `+`
  was not findable by selector. Selection just no longer needs either.
- ⚠️ **`getNodeBounds(node)` returned `null`** for a node definitely in the model — still
  unresolved, and now only matters for drives that need *geometry* rather than selection.
- **Opening the block editor needs no selection at all**: emit
  `LogicBuilder.OpenTab {nodeId, nodeName, workspace}` on `EventDispatcher.instance`, which is what
  the Properties panel button does.

**3. LGC-008 — the pane. The biggest remaining build, and now ruled.**

Order matters here and the ruling made it matter more:

- 🔴 **F3 first.** `bindNodeGraphCanvas` reads `clientWidth`/`clientHeight`, which are 0 while
  hidden, and nothing re-binds when the canvas is shown again. **In split mode the canvas is never
  hidden but is continuously resized**, so the re-measure path is load-bearing rather than a corner.
  This is reproducible *today*, before any of the task is built.
- 🔴 **F4 is a correctness bug that eats a user's program, not a layout nit.**
  `CanvasTabs.handleWorkspaceChange` writes to `activeTab` — the tab from the render that produced
  the callback, **not the tab that owns the workspace that fired**. Safe today only because switching
  tabs unmounts the old workspace without re-rendering it. **A pane keeping several workspaces
  mounted at once breaks exactly that.** The acceptance criterion *"not remounted by a resize, a
  splitter drag or a pane swap"* is the one that decides whether this task is done.
- ⚠️ F2's *"smaller than it looked"* paragraph in the task file describes the option that was **not**
  taken. It is kept for the reasoning, not as the instruction.

**4. LGC-009 — the hat.** Now estimable. 🔴 **Settle the `detectIO` question before writing the
generator, not after:** a hat naming a signal is a *second* declaration of a port that
`noodl_define_signal_input` already declares, and **L39** records that `detectIO` resolves clashes by
**document order**. A mandatory hat lands a second source of truth on top of a known ordering defect.
One-hat-vs-several is unruled but does not block starting. Then LGC-003 §2 can come back.

**5. The remaining drives**, in the order the previous handover set — they are still right:
LGC-004 rails #1–#15 against `lgc59-drive` (expected: **exactly five rows** — `price`/number,
`quantity`/any, `run`/signal, `total`/any, `done`/signal, and no others; #3 is the one the register
singles out); LGC-002 §1 item 2; LGC-002 §2's touched half; LGC-001 §4's other two rows; then
contrast in **both themes, flipped live**, printing foreground and background hex with every ratio.
⚠️ Below 760 px panel width LGC-001's preview column is dropped entirely — check the window is wide
enough before reading a blank as a defect.

**6. LGC-004 §2/§3's props panel.** ⚠️ Check whether the sibling's `PortsTab/` work has landed first
— it was still uncommitted in the tree at `144f1a0d`. 🔴 **L38 decides the architecture**: a panel
edit made while the block editor tab is open is silently destroyed, so the panel needs **two write
paths** chosen on whether a live workspace exists. Do not implement them twice — express each action
as a *block operation* and write two small executors, with one spec asserting both serialisations are
equal.

## Working conditions

- ⚠️ **The tree carries a sibling's uncommitted `PortsTab` work**, and their `port-values.spec.ts` is
  wired into `tests/nodegraph/index.ts`, so it runs and inflates the jasmine count. **Compare names,
  not totals.** No dev processes were live at handover; re-check, it is a per-session fact.
- **Pathspec-scope every `git add`** and use `git commit -F <file> -- <paths>`. 🔴 `git commit -F -`
  does **not** work — the `-F -` is swallowed by the pathspec form. Write the message to a file.
- `npm run dev:stop -- --list` prints **age**, so you can tell a sibling's live run from a corpse.
  ⚠️ `--all` is **checkout-scoped, not session-scoped** — pair it with `--stale`.
- To open a fixture: register it in `~/Library/Application Support/NodeGX/recently_opened_project.json`
  and **restart** — a live editor overwrites that file. Back it up, restore it afterwards.
- ⚠️ `project.json`'s SHA changes on **every** open (every component is dirtied). That is not a defect
  and it is **not** what LGC-002 §2 measures — compare the `workspace` *parameter*.

## What NOT to do

- **Do not re-litigate any of the four rulings.** Each had its alternative presented beside it.
- **Do not re-derive LGC-009's migration cost.** It is **two fixtures, both ours**. That number was
  wrong once and nearly decided the ruling the other way.
- **Do not re-litigate `disableOrphans`.** Reverted, filed, tombstoned. The middle path — narrowing
  the predicate to floating value blocks — was weighed and rejected in writing.
- **Do not claim Do It was broken by `disableOrphans`.** It serves value blocks only; a plugged-in
  value block keeps its parent. Only the *floating* one was refused.
- **Do not build LGC-007 §4's sweep.** Explicitly unauthorised by ruling 3.
- **Do not build LGC-003 §4** (`why_is_this_empty`) — filed deliberately, follows observation.
- **Do not install any `@blockly/*` plugin by `latest`** — all peer-dep Blockly 13; we are on 12.3.1.
  Pinned 12-line releases are in `LGC-006-PLUGIN-SWEEP.md`.
- **Do not collapse `undefined` and `""`** on the generation seam. See above.
- **Do not attempt LGC-008's A/B or the phase exit test.** Both need human testers, and the exit test
  additionally needs a pane that does not exist yet.
