# Phase 80 — next session

## State: DEF-001, DEF-002 and DEF-016 are closed. The next rank is DEF-003.

**s3 (2026-08-29)** took DEF-016 — the cheapest row on the board and the only one already
measured — and closed it end to end, including the export follow-up its own §7 warned would be
skipped.

| commit | what |
|---|---|
| `0c011b6b` | **DEF-016** — the runtime node, its tests, and the code export's copy (AC1–AC7) |
| `881f7632` | the `nodegx-export` red DEF-001 left behind — not mine, but in the suite this row had to run |
| `1bb58560` | DEF-016 closed in the register; phase 18's stale export floor corrected |

Gates at close: `test:ci` **2889 specs, 4 failures, all `AIX-006 style vocabulary` by name** (the
floor, seed 11297, 75s) · viewer-react **1087/1087** · nodegx-export **788/788** ·
`typecheck:editor` and `typecheck:mcp` clean.

---

## ✅ DEF-016 is fully closed, export follow-up included

Nothing is owed. `§9` of the task file has the AC-by-AC table and the two sabotage arms.

🔴 **Three things it did not predict, all of them now in the file:**

- **`isActive` is a diagnostic and must never become a precondition.** The first cut skipped
  `window.open` where activation was false. That looks equivalent and is not — Chrome allows a
  popup without a gesture on an allow-listed site, so gating the call **takes a working link away
  to improve a message.** The node now always opens and only decides what to *report*. A test
  pins it and the gated form reddens it.
- **The wrong premise had a second home.** `mute-node-completion.test.ts` (NDA-004) modelled a
  popup blocker as `window.open` returning null, with `{}` for success. **The full-package run
  found it; grepping the node's name would not have.** Run the package, not the file.
- **Safari is answered.** `navigator.userActivation` is Safari **16.4+**, Chrome 72+, Firefox
  120+, Baseline November 2023. The absent-API guard is narrow but real, and `!== false` rather
  than `=== true` is the whole of it.

## Where to go next

**DEF-003** is the next rank (three authoring acts with no honest surface — a bare number meaning
percent, `Text` with no padding, a page title that needs an editor attached; bites *every author*).

🔴 **Do not start DEF-003 by building.** Its own §6 says **(c) is read from the door, not driven** —
if an editor connection turns out to be present in the path that matters, that third of the task
collapses to a documentation fix. **Drive it first.** And §4 warns off the obvious fix for (a):
**do not change the `defaultUnit` coercion**, it is load-bearing for every existing project.

Also open: **DEF-017 C1** (Track C — `--surface-raised` is declared and read by nothing; phase 78's
B3 is capped until it lands), **DEF-004**, **DEF-014**, **DEF-015**, and the four carried from
phase 76 by reference.

## 🔴 What this session paid for, that the next one should not re-buy

- **A closed task cannot own anything.** Phase 18 knew the `--primary` red exactly and wrote down
  the right rule — *"whoever lands DEF-001 owns updating that expectation"* — and it still went
  unfixed, because DEF-001 closed without doing it and the obligation had no owner left. The red
  then sat in a prompt as *"772/773 is the clean floor"*, which is the worst state a floor reaches:
  **a red everyone has agreed to ignore is indistinguishable from a regression.** When a task
  closes, its *outstanding debts* need an owner, not just its carried rows.
- 🔴 **A cross-package ruling reaches packages its sweep never touches.** `30eb92b2` changed a
  token in `noodl-editor` and changed the emitted `tokens.css` in `nodegx-export` **without
  modifying one line there**, because the scaffold imports `DEFAULT_TOKENS` straight from the
  editor. DEF-001 swept the three editor specs and could not see the fourth. **Grep the whole repo
  for the literal value, not the package you are in.**
- **A test stub can be the bug's blind spot, and stay green forever.** `window.open` was stubbed
  returning a truthy object; no real `noopener` open returns one. The suite therefore *confirmed*
  the broken reading for as long as it existed. **When a test stubs a browser API, check what the
  real one returns in the case the code is deciding on.**
- **The port census graded that the failure codes existed, never that either could fire.**
  Phase 30's audit ✅'d this node. A census and a drive ask different questions and only the drive
  answers this one — which is why this row was found by EXP-011's drive, three phases later.

## Traps carried

- 🔴 **`packages/nodegx-export/src/emit/component.ts` and `src/analyze/plan.ts` had a peer's
  uncommitted EXP-011 §10.5 work in them all session**, interleaved with the DEF-016 edit in the
  same file. Committed **only my three hunks** by building a patch and `git apply --cached`, so
  their work stayed in the tree. ⚠️ **A pathspec commit on a shared file takes the whole file.**
  Check `git diff <file>` for hunks you did not write *before* committing it, not after.
- ⚠️ **`ListAgents` names do not identify who is editing what.** The peer whose message arrived
  was not the one in `nodegx-export`, and said so. Names are for opening a thread; **reply on the
  socket a message arrived on**, and settle authorship by mtime and diff content.
- ⚠️ `packages/noodl-editor/test-results.json` is not the readout — the runner writes
  `packages/noodl-editor/**tests/**test-results.json`. Deleting the wrong one still leaves a stale
  file where you are looking. Check the path the runner prints, and the mtime.
