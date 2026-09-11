# Next session — Phase 59 (LGC): the drive started, and it found two things

**The phase is not closed and is not close to it.** Nine tasks have code; **two acceptance criteria
have now been driven in a real editor**, out of dozens. This session ruled the blocking defect,
drove two checks, and fixed the tooling that was hiding leaked processes.

Read `LGC-007-MY-BLOCKS.md` §6's driven block and `LGC-002-DO-IT.md`'s driven block first — they are
short, and they are the only two things in this phase anyone has actually seen work or fail.

## What landed this session

| Commit | What |
|---|---|
| `f1b57c0f` | 🔴 **`disableOrphans` reverted** on Richard's ruling. Tombstone comment enumerates the grammar so it cannot be re-added from the framework docs. Two corrections to the finding baked in |
| `858669be` | `dev:stop` could not see the helpers that actually leak. Now has `--stale <hours>`, `--all`, and age in `--list` |
| `5a2cd91f` | `NOODL_TEST_TIMEOUT_MINUTES` — a slow machine can grade instead of reporting nothing |
| `99279dcc` | 🔴 **LGC-007 §6 driven: 2 of 3 pass.** The cycle guard empties `generatedCode` to disk |
| `f23d5b4c` | ✅ **LGC-002 §2 driven and PASSED** — byte-identical for an untouched program |

## 🔴 The finding that matters most, because it is a class and not a bug

**Two independent mechanisms empty `generatedCode` to `""` and write it to disk when generation
declines.** `disableOrphans` (reverted) and LGC-007's cycle guard (live on `cline-dev` now).

The cycle guard **refuses correctly** — the workspace stays live, and the console names the loop
better than its spec asked: *"Saved block "Alpha" uses itself. The loop is Alpha → Beta → Alpha."*
Then it publishes that silence over the last-known-good code. Reopening cannot recover it: the cycle
is still there, so it re-empties.

**The rule to apply when reviewing any refusal path: ask what it *writes*, not whether it warns.**

⚠️ **A strong pass on two conditions reads as success if you skim.** This criterion had three, and
the failure was the third. Grade each separately.

**Not yet answered, and both need one drive:** whether the empty write happens on *open* or on the
first debounce tick, and whether a node regenerates once its definitions are fixed.

## Where the phase actually stands

| Task | Code | Driven? |
|---|---|---|
| LGC-001 triad ⭐ | 🟡 built | ❌ — one incidental screenshot only (see below) |
| LGC-002 Do It | 🔨 built, wiring landed `caed5986` | 🟡 **§2 untouched-half PASSED.** §1's acceptance list and the touched half untouched |
| LGC-003 values | 🔨 §1/§3/§5 built · §2 static half **reverted** · §4 filed | ❌ |
| LGC-004 rails | 🔨 §1+§4 built · §2/§3 panel **not** built | ❌ — #1–#13 all open |
| LGC-005 types | 🔨 §1/§2 built, §3 deferred | ❌ |
| LGC-006 plugins | 🔬 verdict only, **nothing installed** | ❌ |
| LGC-007 My Blocks ⭐ | 🚧 engine, **no UI at all** | 🟡 **§6 driven, 2/3.** No save menu item, no dialog, no backpack, no §4 sweep |
| LGC-008 pane | 🔬 analysis + `svgResize` fix · **pane not built** | ❌ — blocked on a ruling |
| LGC-009 hat | 📋 filed only | n/a |

**The phase exit test cannot be attempted.** Its item 4 — *watch the app and the blocks at the same
time* — requires LGC-008's pane, which is unbuilt and blocked on question F2 below.

## 🔴 Rulings needed from Richard before the work they block

1. **LGC-008 F2 — what does "no longer hides the canvas" mean?** Canvas-as-a-tab, or both panes on
   screen at once? **It decides whether a second splitter is built at all**, and the pane is one of
   five exit-test items. This is the single biggest unblock in the phase.
2. **LGC-009 — is the hat mandatory or optional?** An *optional* hat does not buy back LGC-003 §2,
   because `disableOrphans` stays unusable. A mandatory one migrates two fixtures — that is the
   whole migration, corrected this session. Until this is ruled, LGC-009 cannot even be estimated.
3. **LGC-007 §4 — which save path does the regeneration sweep join?** Unchanged from the last
   handover, and now sharper: the cycle guard already writes `generatedCode` destructively, so a
   background sweep that also writes it needs a settled answer first.
4. **Question 5 — `Logic` collides with itself.** Confirmed visually this session: the picker shows
   a rail entry `Logic` and a sub-category `Logic & Utilities` at once. Rename the sub-category, or
   revert the rail label?

The remaining questions from `HANDOVER-2026-08-12.md` (6, 7, 10, 12) are unchanged and none of them
block a lane.

## The drive, in order — and read this about the canvas first

🔴 **Nodes are Canvas2D, not DOM. You cannot `cdp click` a node**, and the picker's `+` button was
not findable by selector either. What is available:

- `window.__nodeGraphEditor` is exposed. `.model.roots` lists the nodes and their types — that is
  how the Logic Builder was located (`id: c6`, in component `/ErgCodes`).
- ⚠️ **`getNodeBounds(node)` returned `null`** for a node that was definitely in the model. Either
  it needs a different argument or the node was outside the viewport. **Solving this is the gate on
  drive items 2–5** — none of them can start until a node can be selected and its block editor
  opened. Budget for it explicitly rather than discovering it at step 3.
- `selectionActions` has only `{editor}` — no `selectNode`. There is no method matching
  `/block|tab|open|edit/` that opens the workspace; it is opened from the Properties panel.

Then, in this order:

1. **LGC-004 rails #1–#12** against `lgc59-drive`. The expected program is confirmed and recorded:
   **exactly five rows** — `price`/number, `quantity`/any (inferred), `run`/signal, `total`/any,
   `done`/signal — **and no others**. #3 (rail text must not scale with zoom) is the one the
   register singles out.
2. **LGC-002 §1's acceptance list.** Item 2 is the criterion the task turns on: change the input
   **without re-running the node**, Do It again, see the *new* value. Needs a preview running.
3. **LGC-002 §2's touched half.** Open `lgc59-drive`, drag a block, re-measure. The untouched half
   passed this session; the finding predicts this half differs. ⚠️ **Re-baseline the fixture with an
   editor save first** — `lgc59-cycle` was rewritten with 2-space JSON by the restore, so its byte
   formatting no longer matches what the editor writes.
4. **LGC-001 §4 — the preview column, three rows, `↑`/`↓` not clicks.** One screenshot this session
   caught the **Function** row incidentally and it passes on all three counts: headline *"Real
   JavaScript, when a line is not enough."*, two code chips, and the execution sentence with a
   category-tinted left rule. **Expression and Visual Function are unobserved.** ⚠️ Below 760 px
   panel width the column is dropped entirely — check the window is wide enough before reading a
   blank as a defect. ✅ §5 confirmed: the rail reads **Logic**, not `Custom Code`.
5. **LGC-003 / LGC-004 contrast, both themes, flipped live.** No contrast claim has been made by
   anyone. **Print foreground and background hex with every ratio**, and flip the theme with the
   workspace open — do not reload into each theme.

## ⚠️ The `test:ci` baseline is still unmeasured — three attempts, three non-gradings

| Attempt | Outcome |
|---|---|
| 1 (prev session) | OOM-killed in webpack, `Killed: 9` |
| 2 (prev session) | 900 s cutoff, died in `AIB-004` |
| 3 (this session) | 900 s cutoff at **2476 of ~2700 specs — 92%**, died in `AAQ-005` |

🔴 **Attempt 3 was on a healthy machine** — swap 717 MB of 2 GB, down from 13.7 GB. So the standing
advice ("free memory rather than raise the timeout") **did not fit**, and the honest read is that
the suite has grown close to the wall. `5a2cd91f` adds the override:

```
NOODL_TEST_TIMEOUT_MINUTES=25 NOODL_SPEC_SEED=39386 npm run test:ci
```

- ⚠️ **Check the machine is not swapping before reaching for it.** A timeout is more often a symptom
  than a limit; this time it was not, but next time it may be.
- ⚠️ **The harness reported attempt 3 as "exit code 0". The real exit was 1.** Only the `Jasmine:`
  line counts. A run without one graded **nothing** — not zero failures.
- Baseline to compare: **6 failures by name** at seed 39386. A sibling measured **2700 specs / 6
  failures at seed 59012** on 2026-08-12, which is the freshest known-good number.
- ⚠️ **The tree carries a sibling's uncommitted `PortsTab` work**, and their `port-values.spec.ts`
  **is wired into `tests/nodegraph/index.ts`**, so it runs and inflates the count. **Compare names,
  not totals.**

## Working conditions

- **A sibling session has been live on this checkout all day** and committed mid-session
  (`60c8c455`). Check again — it is a per-session fact. While true: pathspec-scope every `git add`,
  and use `git commit -F <file> -- <paths>`.
- 🔴 **`git commit -F - -- <paths>` does not work** — the `-F -` is swallowed by the pathspec form.
  Write the message to a file.
- `npm run dev:stop -- --list` now prints **age**, so you can tell a sibling's live run from a
  corpse before killing anything. ⚠️ **`--all` is checkout-scoped, not session-scoped** — it reaches
  another session's live drive. Pair it with `--stale`.
- To open a fixture: register it in `~/Library/Application Support/NodeGX/recently_opened_project.json`
  and **restart** — a live editor overwrites that file. Back it up and restore it afterwards.
- ⚠️ **`project.json`'s SHA changes on every open** (every component is dirtied). That is not a
  defect and it is **not** what LGC-002 §2 measures — compare the `workspace` *parameter*.

## What NOT to do

- **Do not re-litigate the `disableOrphans` ruling.** Reverted, filed, done. The middle path
  (narrowing the predicate to floating value blocks) was weighed and rejected in writing.
- **Do not re-derive the "migration for every saved program" cost for LGC-009.** It is **two
  fixtures, both ours**. That number was wrong once and nearly decided the ruling.
- **Do not claim Do It was broken by `disableOrphans`.** It serves value blocks only; a plugged-in
  value block keeps its parent. Only the *floating* value block was refused.
- **Do not build LGC-003 §4** (`why_is_this_empty`) — filed deliberately, follows observation.
- **Do not install any `@blockly/*` plugin by `latest`** — all peer-dep Blockly 13; we are on
  12.3.1. Pinned 12-line releases are in `LGC-006-PLUGIN-SWEEP.md`.
- **Do not attempt LGC-008's A/B or the phase exit test.** Both need human testers, and the exit
  test additionally needs a pane that does not exist.
