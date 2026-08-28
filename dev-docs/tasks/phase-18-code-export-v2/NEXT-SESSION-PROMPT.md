# Next session — the wall is in a room with no door

## 🔴🔴 FIRST: the testing freeze is still on until Richard clears it

**Richard asked (2026-08-28, mid-session 30) for no CPU/RAM-intensive runs machine-wide until he
explicitly says to start again.** Session 31 ran nothing either. **Keep this notice at the top of
this file until Richard says it is lifted — do not remove it just because a session ends, and a
peer's "I think it's fine now" is not the signal.**

That means **no** jest suite, **no** `build-corpus.ts`, **no** `coverage-audit.ts`, **no**
`npm run typecheck`, **no** `export-ledger:check`, **no** editor launch. His words: *"Save the
tests, we'll run them later and sweep up all the work done at once."*

Reading, raw-file measurement with python/awk, and writing code and tests are all fine and are
what sessions 30 and 31 did. **Two sessions of work are now waiting for the sweep** — §19e in the
previous prompt and **§20f** below, in that order.

---

## 🔴 Read this before picking anything: the list from the last four sessions is void

Session 31 asked one question nobody had asked — **who instantiates `/Filters`?** — and the answer
is **nothing does, in any of the eight clone projects**.

- **904 of 4,441 nodes (20.4%) sit in components no route can reach**, and they hold **432 of the
  666 deferrals (64.9%)**.
- **The export translates 93.38% of the nodes a running app can reach** (3,303/3,537), against the
  85.00% headline.
- **Item 1 on the old list — row identity, ~160 nodes — is entirely inside that dead code**, and so
  is EXP-003 Tier B's ~350. All 72 foreach-mode `Model2` nodes are behind an unplaced kit. There is
  nothing behind them to unblock.

Written up in [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md)
**§20**. Both instruments reconcile to **4,441 nodes with 0 per-project mismatches**, which is the
licence to quote any of it.

## 🔴 The decision that comes before any slice — and it is Richard's

**Which denominator is the goal?**

- *Reach over code that runs* ⇒ the export is at **93.38%**, and the work left is the **234**
  reachable deferrals in §20g(2) — long-tailed, no single artefact dominating, and the first
  question about the biggest row (45 "detached from the node tree") is whether it is a *second*
  block of correctly refused dead code rather than work owed.
- *The headline* ⇒ the work is a JavaScript interpreter at export time for a filter kit nobody
  placed on a page.

These are different projects. Do not pick a slice before this is answered — four sessions ranked
work inside a frame that could not ask whether anything rendered the node.

Also worth putting to him: **retire the eight clones from `projects.txt`, or weight coverage by
project.** They are one downloaded artefact counted eight times and 83% of all deferrals.

## What landed — §20

`src/analyze/reach.ts` (new): `componentReachability(ir)` → `ProjectPlan.reachability`, plus one
note per unreachable component in `emitApp`'s report. **Reported, never acted on** — every
component is still emitted; what changes is that the rest of the report becomes readable.

Three rules make the claim safe rather than lucky, and all three are in the module's header:
join on the **legacy name** (`/${component.path}`), take edges from **`parameters` only** (a
RouterNavigate's `target` port declares a *menu* of every routable page — counting it would report
zero orphans forever), and **refuse to answer rather than guess** (no resolvable route, or a
dynamic-template For Each in a *reachable* component ⇒ `inconclusive`, not "everything is dead").

## 🔴 Traps session 31 paid for

**A component is named by its legacy name, and that is not its folder.** `components/__page__/Home`
is named `/#__page__/Home`. Deriving names from directories made 9 of 40 projects look as though
their routes pointed at nothing and 6 look as though they exported an app with no pages — written
up as a shipped defect before the check that retired it. `parseProject.ts:163` already reads
`component.json`'s own `path`; both sides agreed and only the instrument did not. The repo had paid
for this once already and left the receipt at `lessonprojectcontext.ts:19-29`. ✅ **A defect
predicts an artefact — go and look at it.** One `ls` of an emitted tree would have shown pages.

**A defect found by a new join is a claim about the join.** What made the false positive
persuasive was that the instrument agreed with the audit *to the node* on 39 of 40 projects.
**Agreement on the aggregate is not agreement on the key.**

**A ranked list inherits the frame of whoever wrote it.** Every deferral reason on those ~160 rows
was *true*. The frame — "what blocks this node?" — simply had no way to ask whether anything
rendered it. Fifth of the "rank row ≠ population ≠ yield" family, first where the missing dimension
was *existence*.

**Two small ones that cost real time.** Project names contain spaces, so a whitespace-delimited
parse of an aligned summary read *"Puppy"* and silently dropped two projects — use TSV. And
`cn015-editor-drive/components/App/nodes.json` **lists three of its four nodes twice, same id**;
counting list entries reports 7 where the exporter reports 4, and that one project was the entire
4,444-vs-4,441 gap. Dedupe by id.

## 🔴 §20f — what is unrun and waiting, in run order

Run **§19e from the previous handoff first** (it is s30's list), then these:

1. `npm run typecheck` in `packages/nodegx-export` — new `src/analyze/reach.ts`, a new **required**
   field on `ProjectPlan`, one import in `plan.ts`, one block in `emitApp.ts`.
2. `../../node_modules/.bin/jest` from the package dir — **487 + 16 new = 503 expected**.
   ⚠️ **Eight existing tests assert `app.notes` by exact list equality.** All eight are on the
   `cheer` fixture, hand-checked under the product's own rules to have 0 unreachable components and
   no live dynamic template, so no new note appears in them. That is **reasoned from a raw-file
   walk, not observed** — if one goes red, this is why, and the fixture is what to check first.
3. `coverage-audit.ts` — patched this session to print a `REACH` line per project. **Expect the
   headline 85.00% byte-identical**, and the REACH lines to sum to **3,303/3,537 = 93.38%**. A
   moved headline means reachability leaked into a disposition, which it must not.
4. `deferred-census.ts` (`EXPECT=666`) — expect **666 unchanged**; no gate changed.
5. `build-corpus.ts` — expect **40/40**. Read the last line, never `echo $?`.

**A lone suite-level red with 0 failing tests is a flake until re-run.**

## Instruments (session 31 scratchpad `4fdc2703-…`)

- **`reach.py`** (new) — the one that produced §20. Component reachability from the raw files;
  `--tsv` for a machine-readable summary (**use it — project names have spaces**), `--list` for the
  unreachable components, the opaque dynamic templates and the **dangling-edge residual**. Its
  legacy names come from `component.json`'s `path`, and its node counts are deduped by id; both
  corrections are load-bearing and commented in place.
- **`rowhosts.py`** (new) — for every foreach-mode `Model2`, what feeds the repeater that hosts it.
  This is the one that showed 72/72 behind a script-written source, 0 with static items.
- **`dumpcomp.py`** (new) — one component's raw node tree + every connection. How
  `Filters/Multi Choice/Item` was read in six wires.
- `reach-s31.tsv` / `reach-s31.txt` / `unreachable-s31.tsv` — this session's outputs, joinable
  against `census-final-s29.tsv` on `(project, component)`.
- s29/s30's `deferred-census.ts`, `coverage-audit.ts` (**patched**), `wirefeed.py`, `walls.py`
  (**patterns still stale since s30**), `rank2.ts`, `build-corpus.ts`, `mutate.py`, `dumpall.ts`,
  `showfile.ts`, `ifaces.ts` — all copied in.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
run **from `packages/nodegx-export`**. Instruments take projects as argv; **zsh:
`"${(@f)$(cat projects.txt)}"`** — the paths contain spaces. `build-corpus.ts` needs **both**
`--app <harnessDir>` **and** the project list, and **exits with the failure count**.

🔴 **Never `git checkout <path>` to undo a source mutation.** `mutate.py` patches one line by
number, restores from a pristine copy and **prints both md5s**.

**Standing practice:** work on `cline-dev`; commit by **exact file pathspecs** (never a directory,
never stage) — peers were editing `packages/noodl-editor` and the phase-70/71/72 task files
throughout s31. ts-morph and Prettier stay uninstalled; the package is not in root `test:packages`.
