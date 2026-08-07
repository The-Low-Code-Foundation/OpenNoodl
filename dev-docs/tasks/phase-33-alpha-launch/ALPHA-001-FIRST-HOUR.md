# ALPHA-001: The cold-install first hour

## Metadata

| Field | Value |
|-------|-------|
| **ID** | ALPHA-001 |
| **Phase** | Phase 33 — Alpha Launch (Track R) |
| **Tier** | 1 — gates the alpha |
| **Priority** | 🔴 Critical — this is where the alpha's defects already are |
| **Difficulty** | 🟡 Medium — no hard problems; the discipline is the work |
| **Estimated Time** | 3–4 days, plus whatever it finds |
| **Prerequisites** | ALPHA-002 for the packaged half; the dev-checkout half can start now |
| **Branch** | commit directly to `cline-dev` |
| **Recommended executor** | 🟠 **Opus 4.8** — opaque failure modes, iterative diagnosis, and a strong incentive to declare victory early |

## Objective

Walk the first hour of NodeGX as a new user would, on a clean machine with clean
`userData`, and file every defect. Not a feature — an audit with a deliverable.

## Why this task exists

Across seven merged tasks, a striking amount of shipped work is **code-complete and
has never been seen by a human**. Each was recorded honestly by its own task as a
residual. Nobody owns the union, and the union is the problem: they cluster on
exactly the path a new user walks in their first ten minutes.

| Owed | Task | Recorded state |
|---|---|---|
| Import flow — **zero visual verification** | LIB-005 | "nothing was verified visually"; a six-part checklist in `LIB-005-NOTES.md` §7 written for someone else to execute |
| Import engine live pass | LIB-004 | code complete, Electron pass blocked by the worktree/lerna trap |
| Live install from `library-dist` | LIB-001 | 4 of 5 criteria verified |
| 29-prefab open / exercise / restyle / re-save | LIB-002 | static audit only |
| Per-module live audit | LIB-003 | plumbing + expansion done |
| Live QA parts A / B / D | PLAT-005 | part C passes; A, B, D owed |
| Panel smokes, no-provider session | AIX-003 / 008 / 011 | need a scripted run through the real UI |

Create a project → install a prefab → set the app name → preview. **That is the
first ten minutes, and most of it is code-complete-never-run.**

There is precedent for what this finds. The last time someone ran the real UI
against a fixture instead of trusting the suites, it produced F44 (the app name
never reached `project.json` because no save was ever armed — blast radius: SEO,
PWA, config variables, Styles, design tokens, the DB schema cache), F46 (~94 of 116
`Model.*` events each armed a full project write), and F62 (a warning dot that could
never render, hidden behind eleven skipping assertions). None of those were visible
from a green test suite.

## Two hard constraints, both learned the hard way

**1. It must run from the primary checkout.** The editor cannot be launched from a
git worktree, and `lerna exec` runs the main checkout regardless — which is what
blocked LIB-004's Electron pass in the first place. Do not attempt to parallelise
this across worktrees.

**2. The tree must be clean before it starts.** A live run measures whatever is on
disk. On 2026-07-30 the primary checkout carried 121 uncommitted files spanning four
unrelated bodies of work; a QA pass run then would have been auditing a tree nobody
intended to ship. Check `git status` first, and say in the report what commit was
measured.

Also known and to be worked around, not rediscovered: **launching the dev editor
rewrites the `agent-chat` example project** — it minifies `project.json` and drops
`rootComponent`, on open *and* on shutdown. Revert it after each run, and do not let
that revert quietly hide a real defect in project saving.

## Scope

### Part A — the dev-checkout pass (can start immediately)

Run from the primary checkout on a clean tree, with a **fresh `userData`** so
first-run state is genuinely first-run.

1. **Launcher and first run.** Empty state with no projects. Create from each
   template. UIX-006's blank-thumbnail fix under real conditions.
2. **The import flow, against LIB-005-NOTES.md §7 verbatim.** Closure legibility,
   the un-untickable required row, blind-overwrite / diff / rename, prefab
   kept-yours, URL untick, export, edge cases. This is the single largest block of
   unverified surface in the product.
3. **Library install from `library-dist`** — prefabs and modules, end to end.
4. **The app-name round trip**, with a **real keystroke, then quit and reopen.** F44
   was fixed and verified synthetically; the real-keystroke path against the 1s
   debounce is still owed, and the debounce is exactly where a data-loss defect
   would hide.
5. **PLAT-005 parts A, B and D.**
6. **The AI panels with no provider configured** — AIX-003 / 008 / 011's scripted
   no-provider smoke. What a user with no API key sees is a first-run question, not
   an AI question.

### Part B — the packaged pass (needs ALPHA-002)

Everything in Part A, from an installed build on a machine that has never built
NodeGX. This is not redundant: REV-008 found two defects that meant *the packaged
app had never launched at all*, and both were invisible in dev — webpack externals
resolving development React against production React-DOM, and four undeclared
externals electron-builder never collected. Dev-green proves nothing about packaged.

### Part C — file everything

Every finding gets an F-number in this phase's `PROGRESS.md`, with file and line
where known. Findings are **not** fixed inline unless they are one-liners; a QA pass
that turns into a refactor stops being a QA pass and stops covering ground.

## Acceptance criteria

1. Parts A and B are both walked end to end, from a clean tree and a clean
   `userData`, with the measured commit recorded.
2. Every step is marked pass / fail / blocked. **No step is silently skipped** — a
   skipped step is recorded as a skip with its reason, because "eleven SKIPs hiding a
   feature that never worked" is a defect class this project has already shipped once.
3. Findings are filed with file and line, ranked, and unowned ones are explicitly
   marked unowned rather than left in prose.
4. `LIB-005-NOTES.md` §7 is discharged item by item, and LIB-001 through LIB-005's
   residual rows in phase 21's `PROGRESS.md` are updated to say so.
5. The report states what was **not** covered.

## What would make this task fail

Declaring it green. The purpose is to find things; a pass that finds nothing has
almost certainly measured the wrong tree, skipped the hard steps, or asserted
against something other than what was on screen — all three of which have happened
before and are recorded as F30, F36 and F40.
