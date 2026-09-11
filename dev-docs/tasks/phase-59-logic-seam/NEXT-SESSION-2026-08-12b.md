# Next session prompt — Phase 59 (LGC): finish the drive, and rule on the defect that blocks two of it

Phase 59's eight LGC tasks are built and merged to `cline-dev` (`f32a9cd4`). The session before this
one built them without ever opening an editor. **This session was meant to be the drive. It became
half a drive and one large finding**, because the finding invalidates two of the four load-bearing
checks, and because the machine could not build the editor.

Read, in this order: `FINDING-2026-08-12-disableOrphans-kills-every-program.md`, then
`HANDOVER-2026-08-12.md` (state of all eight lanes, four false premises, 14 questions).

## What landed this session

| Commit | What |
|---|---|
| `caed5986` | The `nodeId={activeTab.nodeId}` line LGC-002 was blocked on — **it unblocks two lanes**, because the same prop feeds `attachBlockValues` (LGC-003) as well as `attachDoIt`. Plus the finding, filed not fixed |
| `f724b05b` | LGC-001's "+9 specs" corrected to **+8** (4 looped terms + 4 standalone) |

Also left behind, deliberately durable because a scratchpad does not survive a session:

- **`probes/`** — three Node scripts proving the defect with **no editor, no webpack, no Electron**.
  Read `probes/README.md` first; it lists the three things that make them lie.
- **`~/vscode_projects/NodeGX test projects/lgc59-drive`** — a project whose Logic Builder node holds
  a hand-authored program producing exactly LGC-004 #1's five rails rows (`price/number`,
  `quantity/any` inferred, `run/signal`, `total/any`, `done/signal`). `WORKSPACE-BEFORE.json` in that
  directory is the byte-for-byte `workspace` parameter as authored — **that is the file to diff
  against**, not a remembered string.
- **`~/vscode_projects/NodeGX test projects/lgc59-cycle`** — the same project with a hand-written
  cyclic `myBlocks.library` pair (`defAAA` ⇄ `defBBB`) in `settings`, and a call to `defAAA` in the
  node. This is LGC-007 §6's fixture, already built. Verified that `ProjectShelf` really reads
  `project.getSettings()['myBlocks.library']`, so the fixture is not vacuous.

Both fixtures are copies. `tier1-tails` (the source) was SHA-verified unchanged at the end.

## 🔴 Rule on this first, because two acceptance criteria depend on it

`Blockly.Events.disableOrphans` (`BlocklyWorkspace.tsx:232`, LGC-003 §2's static half) **disables
every Logic Builder program on the first user gesture**, empties `generatedCode` to `""`, and
serialises `disabledReasons: ["ORPHANED_BLOCK"]` into `project.json`. There is **no hat block** in
`NoodlBlocks.ts`, so every Noodl program is a free-floating statement stack and every top-level block
matches Blockly's orphan predicate.

**Do not re-derive this.** It is reproduced twice headlessly (drag-from-toolbox, and one nudge), and
the enumeration of all 15 block shapes is in the finding.

It retires handover question #11: "byte-identical only for programs with no orphans" assumed orphans
were a subset. **There is no Noodl program that is not entirely orphaned.** So:

- **LGC-002 §2** ("save, close, reopen: byte-identical") — cannot pass for a program anyone has
  touched. ✅ *Untouched* open/close **is** byte-identical; that half was measured and holds.
- **LGC-004 #13** (same criterion, from the rails side) — same.

The fix is **not** a straight revert-and-rebuild: `setEnabled` is model state, and
`BlockValueBadges.ts:12` already states the rule the static half broke. Options, both in the finding:
draw the tell like the dynamic hollow wash, or give the language a hat block (a migration for every
saved program). **Richard's §2, Richard's call — get the ruling before grading either criterion.**

## Then drive, in this order

Everything below needs a real editor. Nothing below has been seen to work.

1. **LGC-007 §6 — the cycle guard.** Open `lgc59-cycle`. **Pass:** the workspace stays live, the
   console carries *"The saved blocks in this program could not be expanded"*, and the node's
   `generatedCode` is **unchanged** (`Outputs.completed = true;` — recorded) rather than emptied.
   The only place the guard meets a real renderer; its failure mode is a hung renderer inside a
   300 ms debounce tick, presenting as a random freeze.
2. **LGC-001 §4 — screenshot the preview column, three times.** Cursor Expression / Visual Function /
   Function with `↑`/`↓`, not clicks. **Pass per row:** a headline, ≥1 code chip, and the execution
   sentence with its category-tinted left rule, all visible without scrolling. ⚠️ Below 760 px panel
   width the column is dropped entirely — check the window is wide enough before reading a blank as a
   defect. Also confirm the rail reads **Logic**, not **Custom Code** (§5).
3. **LGC-003 / LGC-004 — badge and rail contrast, both themes, flipped live.** No contrast claim has
   been made by anyone. **Print foreground and background hex with every ratio**, and measure the
   element you are claiming about. Flip the theme with the workspace open — do not reload into each
   theme; that is the check `workspace-minimap` was found to fail.
4. **LGC-004 rails, #1–#12** against `lgc59-drive`. #1 is five rows and no others. #3 (rail text does
   not scale with zoom) is the one the register singles out.
5. **LGC-002 §1's acceptance list** — needs a preview running and a value wired in. Item 2 (change the
   input **without re-running the node**, Do It again, see the *new* value) is the criterion the whole
   task turns on.

## 🔴 The environment is the real risk, and it is not a code problem

**`test:ci` was attempted twice and graded nothing either time. The baseline is UNMEASURED — there is
no number from this session to inherit or subtract from.**

| Attempt | Outcome |
|---|---|
| 1 | **OOM-killed in webpack** — `Killed: 9`, exit 137, before a single spec ran |
| 2 | Built, ran specs for 15 minutes, then **`Test run timed out after 900s without reporting results`** — killed mid-suite, last spec started was `AIB-004 sandbox export…` |

Neither printed a `Jasmine:` line. Both were slow for the same reason: the machine was swapping.

- ⚠️ **The harness reported the OOM-killed run as "exit code 0", and the timed-out run as "exit
  code 1".** Neither exit code means what it looks like. Only the `Jasmine:` line counts, and a run
  without one **graded nothing** — do not read attempt 1 as zero failures, and do not read attempt 2
  as a real failure.
- ⚠️ The 900s cutoff is a fixed self-termination, not a hang. On a quiet machine the suite finishes
  inside it. **If it trips, free memory rather than raising the timeout.**
- ⚠️ Swap was at 13.7 GB of 15.4 GB used with ~6 live `claude` sessions, and macOS grew the swap file
  to 18 GB during the run. **If the build OOMs again, that is the machine, not the tree.** Close
  sessions or wait rather than hunting a regression.
- ⚠️ Even had it reported, the number would have been contaminated: three sibling commits landed at
  16:13–16:16, mid-build. **Take a fresh one on a settled, quiet tree** — that is the first job.
- Baseline to compare against: **6 failures by name** at seed 39386 (the six are in the register).
  Run at `NOODL_SPEC_SEED=39386` deliberately — it removes the order-dependent `BEN-001` confound, so
  any extra name is unambiguously new. Expect **+8** specs from LGC-001, not +9.

**A concurrent session was live for this entire sitting** and was still holding staged files at the
end. Check again — it is a per-session fact, not a standing truth. While it is true: never
`dev:stop` (it kills by checkout and takes their `test:ci` down silently — that is why step 1 of the
last prompt was not run), pathspec-scope every `git add`, and use `git commit -- <path>` rather than
a bare commit, because **the sibling had files staged in the shared index**.

## What NOT to do

- **Do not re-litigate the four decisions already ruled** (Function card copy = option (a), docs path
  frozen by the generator, rail label display-only, colour stays category-based). Richard flips those.
- **Do not build LGC-003 §4** (`why_is_this_empty`). Filed deliberately; it follows observation.
- **Do not install any `@blockly/*` plugin by name.** Every `latest` peer-deps Blockly 13 and we are
  on 12.3.1. The pinned 12-line releases are in `LGC-006-PLUGIN-SWEEP.md`.
- **Do not attempt LGC-008's A/B or the phase exit test.** Both need human testers.
- **Do not re-prove the `disableOrphans` finding.** Rule on it instead.

## Still open for Richard, not for a session

The 14 questions are in the handover. These three block real work:

- **The `disableOrphans` ruling above** — new, and now the largest of them.
- **LGC-008 F2** — does "no longer hides the canvas" mean canvas-as-a-tab, or both panes on screen?
  It decides whether a second splitter is built at all. The companion pane already exists.
- **LGC-007 §4** — which save path does the regeneration sweep join? It mutates a project from a
  background sweep, where `EditorSettings` already debounces disk by the 1000 ms quit window.
