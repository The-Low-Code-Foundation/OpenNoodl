# Next session — Phase 64 (VFN): tier 1 is built, and every one of it is undriven

**Read this, then [TASKS.md](TASKS.md).** Tier 1 — the three reports where a builder loses work or
cannot proceed — landed in `0067304d` on `cline-dev`. Nine tasks remain, plus the drives that tier 1
still owes.

## 🔴 The one thing to be honest about

**Not one of VFN-001, 002 or 003 has been driven.** All three are gated by specs, both suites are
green, and every criterion that needs a running editor is unclaimed and written into its task file
as such. Do not read "built" as "works" — this phase exists *because* eleven things that were built
and merged did not work when someone used them.

VFN-003's failure in particular is **silence**, and a spec cannot see silence.

## What landed, and what each one turned out to be

| | |
|---|---|
| **VFN-001** | `keyboardTargetOf` reads the composed path, not `document.activeElement`. Tab-closing on `Model.nodeRemoved` via a pure module. 13 specs |
| **VFN-002** | `.blocklyHtmlInput` keeps the box Blockly measured — no border, no padding, no font override, ring is a `box-shadow`. 6 specs |
| **VFN-003** | `setPrompt`/`setConfirm`/`setAlert` all registered; contract in a React-free module. 10 specs |

**Two of the three task files were wrong about their own fix, and the spec caught it both times.**
That is the useful finding of the session, and it is worth expecting again in the nine that remain:

1. **VFN-001's sketch (`composedPath()[0]`) fails for the reason it was written to fix.** The
   deleted block *is* the target, and `Element.closest()` walks the tree an element is **in** — a
   detached element has no ancestors, so it answers `null` on the very query that identifies the
   surface. One stale read swapped for another. Fixed by walking the path for the first element
   still `isConnected`. Written up as **VFN-001b** in that file.
2. **VFN-003's stated registration point broke two suites *to run*.** `initialize.ts` is
   deliberately reachable from the plain-Node `tests-unit` runner (LGC-007's inliner and save specs
   import it), so a `@noodl-core-ui` import anywhere in its graph fails them before a test executes.
   React-side Blockly registration goes in `BlocklyWorkspace.tsx`.

One thing was made correct rather than left as found: **closing tabs is a single transition now.**
A batched loop of `closeTab` has every iteration read the same `activeTabId`, so with two tabs open
nothing emits `LogicBuilder.AllTabsClosed` — the only route by which the window closes. *Done* with
two tabs, and deleting a group holding two Visual Functions, both hit it. `closeTabs(ids)` is on the
context; `closeTab` delegates to it.

⚠️ **This matters for VFN-009.** Its §2 forbids widening `Tab.nodeId` to mean "node **or**
definition", and asks for a discriminated `subject`. `tabsClosedByNodeRemoval` is already correct
under that design — it never closes a tab without a `nodeId`, and a definition tab will not have
one. Add the `subject` field; do not touch that predicate.

## The order I would work it

### 1. 🔴 One drive session, owning the checkout, closing five things at once

This is the highest-value move available and it is not obvious from the task files, because it cuts
across five of them. **Live QA is serial across this whole machine**, so the expensive part is
owning it — and once you do, the same open editor with one Visual Function in it answers:

- **VFN-001** criteria 1–4: node selected + focus inside, Delete **three times**, count nodes each
  time. Then the negative control with focus outside. A single press passes vacuously — the failure
  was a stale read.
- **VFN-002**: `document.querySelector('.blocklyHtmlInput')` → `{clientWidth, scrollWidth, value}`
  on a `math_number` with three digits typed. `scrollWidth > clientWidth` **is** the defect. Click
  the field first and assert the element exists, or you measure `null` and read it as a pass.
- **VFN-003** criteria 1–5: Variables → *Create variable…*, assert a dialog element exists, type,
  accept, and query **the flyout's own workspace** for the `variables_get` block (`Workspace.getAll()`
  includes flyouts). Then a duplicate name, to prove the alert → re-prompt path.
- **VFN-005's reproduce step** — `elementFromPoint` at the preview's centre with the window open.
  It is three lines and it decides whether that task is geometry work or a hunt for what re-enabled
  pointer events.
- **VFN-007's reproduce step** — read `checked` off the two radios in the save dialog. Three lines,
  and it decides whether that task is a contrast fix or a state-divergence bug.

Both reproduce steps are **acceptance criterion 1** of their own task ("run it and write the answer
into this file before anything is built"). Doing them inside a drive you are already paying for
turns two ~2-hour tasks into two known ones.

⚠️ Nothing that launches a dev stack may run beside another working agent — `start.ts` sweeps
leftovers and reaps yours. 🔴 **Do not `dev:stop`**: it matches the MCP servers running from this
checkout's `packages/noodl-mcp/dist/` and takes Richard's live connection down. Kill the
`scripts/start.ts` pid; its watchdog reaps the rest.

### 2. VFN-011 — the bench. The flagship, ~2 days, no dependencies

The one task that changes what the node *is*. Its Part 1 is cheap and separable (a sixth
`STATUS_COPY` reason and the no-probe detection) and worth landing on its own even if Part 2 slips —
"No runs yet" is currently correct behaviour producing a wrong impression, and naming the reason is
one string.

🔴 **The drift gate is the task, not a nicety.** An editor-side runner that stops agreeing with the
runtime is a second truth about what a program does. The gate is a spec that runs the same
`generatedCode` through both compile paths over a ~6-program fixture. Build it before the UI, not
after.

🔴 **Read the rails' existing `detectInterface` projection.** A bench "needs the inputs" and it is
one line to enumerate them again — that is the phase-59 standing constraint this task is most
likely to break.

### 3. VFN-008 → VFN-009 → VFN-010, in that order, because they are one job in three sizes

008 is the cheapest half of the value: a saved block that says what it does removes most of the
reason to open it. Its plumbing already exists — `description` is in the format, `SaveChoice` has
the field, `describeShape` already writes the sentence and the dialog throws it away.

⚠️ **Do VFN-011 before VFN-009 if both are scheduled.** 009's definition tab has no node, so Do It
and live values are meaningless on it; 011's bench is the thing that makes a definition tab
genuinely runnable. 009 says so itself.

### 4. VFN-004 and VFN-006, then 005 and 007 once reproduced

All four small and independent. 004's navigation has one named trap: 🔴 `Router.route()` is a silent
no-op editor→editor — use the same path the components panel uses, or it will do nothing and look
exactly like the bug.

006's criterion 5 is the one to design against from the start: **an overlay, never a model change.**
`BlocklyWorkspace` serialises on every non-UI event, and LGC-003 §2 was reverted for reaching the
model in a subtler way. Copy `BlockValueBadges`' shape.

### 5. VFN-012 last

It adds vocabulary to a language the other eleven are busy making work, and its scope cuts cleanly
(ship the config variables, not the libraries). ⚠️ It is the one task that must run
`npm run cloud-library:check` — a required PR gate that drifts red on port changes.

## Working conditions, measured today

**The gates, and which one is actually yours.**

| Gate | Command | Today |
|---|---|---|
| `test:main` | `cd packages/noodl-editor && npx jest` | **157 suites / 2265 green**, ~11 s |
| `test:ci` | `npm run test:ci` | **2724 specs / 9 failures, seed 86503**, ~35 min |

🔴 **`test:main` is the gate for almost everything in this phase.** Every task here specs into
`tests-unit/` or `myblocks/`'s plain-Node runner. `test:ci` is only needed if you touch
`packages/noodl-editor/tests/`, and it costs 35 minutes.

The nine `test:ci` failures are **all documented**: `AI model registry` ×2 and `AIX-006 style
vocabulary` ×4 (the standing six), plus the known order-dependent `BEN-001 the component interface`
trio. **Compare names, never counts**, and read `tests/test-results.json` rather than the log — a run
can exit `0` having graded nothing.

**The checkout is shared and was not clean.** A sibling's `PortsTab/`, `TraceSession.ts`,
`portValues.ts`, `usePortValues.ts` and `tests/nodegraph/port-values.spec.ts` are uncommitted in the
tree and were graded by both suites. 🔴 **Never `git add -A`** — stage explicit pathspecs, or you
commit someone else's half-finished work. 🔴 **Never `git stash` here**; a wrong-cwd `stash push`
fails silently and the `pop` crashes an editor a human is using.

**`tests-unit` is a boundary, not a directory.** Before adding an import to any module, check
whether a `tests-unit` spec imports it. A suite that fails *to run* is counted as a failure and does
not look like one.

## Do not re-litigate

- **The four rulings of 2026-08-13** in [README.md](README.md): the sandbox runs in the editor; the
  library manager is built in full; the window stays open across navigation and labels itself; the
  save gesture is explained by outlining the group, not by multi-select.
- **VFN-001's 200 ms `lastBlocklyTabCloseTime` guard.** Left in place deliberately; it guards a
  different window and removing it re-opens a defect that has been observed.
- **`DEFAULT_SCOPE` stays `'project'`** (VFN-007). The cheaper mistake is the default.
- **`undefined` ≠ `''` on the generate seam**, and now on the dialog seam too: `callback(null)` on
  cancel, never `callback('')`. Same distinction, second costume.
- **Do not register `Blockly.Events.disableOrphans`.** Tombstoned, with the finding attached.
- **VFN-009's warning may not claim a flow is broken.** Where it is used, and whether the shape or
  parameters changed — those are facts. Behavioural breakage waits for the testing phase, because a
  warning that guesses will be believed.

## The pattern worth carrying forward

Both corrections this session came from **writing the spec the task asked for and watching it fail**,
not from reading more carefully. VFN-001's spec was specified as *"remove the element from the
document before the assertion"* — do that, and the proposed fix goes red immediately.

So: when a task file hands you a mechanism *and* a fix, the mechanism is usually the researched half
and the fix is usually the sketch. Write the spec first, from the mechanism.

And every one of these tasks is a suite of absences — "no second deletion", "no padding", "no
silence". 🔴 **A suite of absences is indistinguishable from an instrument that measured nothing.**
Each of the three that landed carries a negative control for that reason, and each of the nine
remaining will need one.
