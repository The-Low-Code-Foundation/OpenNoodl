# Next session — the wall is in a room with no door

## ✅ The freeze is OVER — Richard, 2026-08-28: *"Freeze is off, go nuts"*

Both sessions' unrun work was swept in one pass and is green. **Delete nothing else from this
section; there is no hold.** What the sweep produced is in
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) **§20h**:

| run | result |
|---|---|
| `tsc --noEmit` | exit 0 |
| `jest` | **504/504** (one red, a real defect, fixed — §20h) |
| coverage headline | **3,775/4,441 = 85.00%**, per-project byte-identical to s29 |
| coverage `REACH` | **3,303/3,537 = 93.38%** — matched the raw-file prediction exactly |
| `deferred-census` | **666**, the same 666 nodes as s29 |
| `build-corpus` | **40/40 projects typecheck** |

s30's unrun work verified too: same 666 nodes, only the reason strings improved, nothing moved
between translated and deferred.

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

- *Reach over code that runs* ⇒ the export is at **93.38%** (93.55% over the 37 projects where
  reachability was decidable), and the work left is the **234** reachable deferrals — now measured
  in **§20i** and genuinely long-tailed: **56 distinct reasons, nothing above 22** once you set
  aside the 45 "detached" (correctly refused — 40 of them are one authoring defect in
  `Components/Header`, whose nav links have never rendered in the running app either) and the 20
  "beside the router shell" (**not** all inert — 8 are `CSS Definition` nodes that really do inject
  global CSS, so those are a genuine gap). **There is no next slice there, only a list of small
  unrelated jobs** — which is what the end of a deterministic export looks like.
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

## Nothing is waiting to be run

Both lists are spent. The standing recipe, for when the next slice needs grading:

```
cd packages/nodegx-export
../../node_modules/.bin/tsc --noEmit                       # exit 0
../../node_modules/.bin/jest                               # 504/504, never pipe it
../../node_modules/.bin/ts-node --transpileOnly --compiler-options '{"module":"commonjs"}' \
    $S/coverage-audit.ts "${(@f)$(cat $S/projects.txt)}"   # 85.00% + a REACH line per project
EXPECT=666 ... $S/deferred-census.ts ...                   # refuses to run unless it reconciles
... /abs/path/scripts/build-corpus.ts --app $S/app "${(@f)$(cat $S/projects.txt)}"   # 40/40
```

⚠️ **Sum the audit anchored on `^=== `** — the new `REACH` line also contains the words *"nodes
translated"*, and an unanchored `awk` double-counts it into a confident, wrong **88.72%**.
⚠️ **`build-corpus.ts` lives at `scripts/`, not in the scratchpad**, and needs the harness `app/`
copied with **`cp -a`** so the `@nodegx/core` symlink survives.

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
- `reach-s31.tsv` / `reach-s31.txt` / `unreachable-s31.tsv` — reachability outputs, joinable
  against **`census-s31.tsv`** (the post-sweep census — use this, not `census-final-s29.tsv`, whose
  reason strings predate s30) on `(project, component)`. Also `cov-s31.txt`, `build-s31.txt`, and
  the harness `app/`.
- s29/s30's `deferred-census.ts`, `coverage-audit.ts` (**patched with the REACH line**),
  `wirefeed.py`, `walls.py` (**patterns still stale since s30 — the census confirms the reason
  strings changed, so update them before quoting a wall census**), `rank2.ts`, `mutate.py`,
  `dumpall.ts`, `showfile.ts`, `ifaces.ts` — copied in. ⚠️ **`build-corpus.ts` is NOT** — it is
  committed at `packages/nodegx-export/scripts/`.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
run **from `packages/nodegx-export`**. Instruments take projects as argv; **zsh:
`"${(@f)$(cat projects.txt)}"`** — the paths contain spaces. `build-corpus.ts` needs **both**
`--app <harnessDir>` **and** the project list, and **exits with the failure count**.

🔴 **Never `git checkout <path>` to undo a source mutation.** `mutate.py` patches one line by
number, restores from a pristine copy and **prints both md5s**.

**Standing practice:** work on `cline-dev`; commit by **exact file pathspecs** (never a directory,
never stage) — peers were editing `packages/noodl-editor` and the phase-70/71/72 task files
throughout s31. ts-morph and Prettier stay uninstalled; the package is not in root `test:packages`.
