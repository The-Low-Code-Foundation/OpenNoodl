# Next session — the list ran out, and the map replaced it

**Where the phase stands (2026-08-28, after twenty-eight sessions).** Session 28 closed §16a(1),
the relation verbs, and the result is that **it buys no coverage** — 3,775/4,441 (**85.00%**),
unchanged. That is not a failed slice. It is the measurement that retired the standing claim
*"everything left buys coverage"*, and it came with the census that replaces the list.

`build-corpus.ts` holds at **40/40**. The ledger is unchanged (175 types: 101 deferred /
58 translated / 1 stubbed / 15 backend-only — no node type changed category, because none became
translated). **468 tests (22 new).**

Written up in [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md)
**§17**. Commit: `git log` for `feat(exp-002)`.

---

## 🔴 Read this before picking anything

**Do not open by looking for a node type to translate.** That is what the last four handoffs said
to do and §17b is why it stopped working. The corpus's 666 deferred nodes, bucketed by *the wall
that blocks them* rather than by type:

```
  197   29.6%  script tiers (EXP-003 Tier B + the component-record tier)
  136   20.4%  row identity (the s10 wall)
  117   17.6%  outside the render — logic nodes and the router shell
   82   12.3%  collateral — its feed or its sink already deferred
   69   10.4%  wire-fed rendered structure
   36    5.4%  trigger outside the handler vocabulary
    9    1.4%  unknown type / editor debris
    8    1.2%  no shape in the api stub / emit vocabulary
    7    1.1%  translated behind a typed api stub (not a wall at all)
    5    0.8%  named runtime refusal — the node always fails as authored
```

**The top three hold 450 of 666 — 67.6% — and none of them is a slice.** The next real movement
costs a wall, not a node. `walls.py` (scratchpad) regenerates this from `rank2.ts`'s reasons axis;
it refuses to run unless its total reconciles against the audit's deferred count, and it prints
its residual in full.

## What landed — §17

Three `logic node (…)` catch-alls became the verdict the **runtime** reaches:

- 🔴 **`AddDbModelRelation`** — the corpus's only instance authors `collectionName` and nothing
  else. With no `relationProperty`, `validateInputs` answers *"No relation property specified"*,
  `setError` fires and `cloudstore.addRelation` is **never called**. The node has never worked and
  cannot. Translating it would have been a hole shaped exactly like the defect (gate 1's rule,
  §5.1, reaching a second node type). §4c's target output stands; what it lacks is a well-formed
  instance to build against, not a design.
- **`DbModel2`** — reads its Id from a `PageInputs` on a component with no `Page` node that the
  Router does not list. No route ⇒ no URL ⇒ no path parameter. Inventing one is fabrication.
- **`PageInputs`** — says exactly that, and names the parameters it declares.

`RemoveDbModelRelation` has **zero corpus instances** and is gated identically anyway. The gates
run in `validateInputs`'s own order, including NDA-012's check that a Target Record Id came from a
node that actually *loaded* a record — the failing write is what burns the relation column into
the class schema as `Relation<undefined>` for the life of the class.

**Also measured: all 72 `Model2` nodes are `idSource: "foreach"`** — nine distinct instances cloned
across eight projects. The largest non-Tier-B row in the ranking is one wall, not a backlog.

## The list

1. **EXP-003 Tier B** — ~350 nodes, one third-party kit copied into eight projects, behind four
   things that do not exist. `tb-survey.ts` dumps every body of it; **read that before committing.**
   The largest wall, and the only one whose size is mostly one artefact.
2. **Row identity (the s10 wall)** — 136 nodes, now measured rather than assumed. Every `Model2`,
   the `SetModelProperties` beside them, the repeater output relays, the `For Each.items` feeds.
   One design question: what a row's identity *is* in the emit.
3. **The two `ProductCard` projects' missing interface** (§11d(2)/(3)) — ruled in §13b, built in
   §14. The export refuses and names it. Still the disposition, not a defect.

## 🔴 Traps this session paid for

**A ranking row is not a slice, and a slice is not coverage.** Session 27 filed *"a rank row counts
what deferred, never what is there"*; the answer then was a population. Here the population was
confirmed exactly — 1 `AddDbModelRelation`, 1 `DbModel2`, 0 `RemoveDbModelRelation` — and the slice
**still** bought nothing, because the population was never the constraint. The count, the wall and
the yield are three different questions.

**A mutant that kills nothing is a claim about the mutant.** Two of ten:

- The sweep's `if (dispositions[node.id] !== undefined) continue;` guard killed nothing. Chasing
  why found the real hole: a component with **no visual root** dispositions every node and
  **returns early**, before the sweep runs — so a relation verb there fell to the catch-all anyway.
  No coverage number could have said so; nothing in the corpus exhibits it. Closed, with four rows
  that redden when it re-opens. The guard stays: the moment a later slice teaches pass 4c about
  `DbModel2`, dropping it would overwrite `collapsed` with `deferred`.
- The `DbModel2` row-identity mutant killed nothing because its anchor text occurs **twice** and it
  patched `compileRecordOp` (line 2713) instead. Re-aimed by line number, each site kills its own
  row, and they are *different* rows. **Mutate by line, or by an anchor you have counted.**

**Two control rows failed on first write, and both were the control's fault.** *"Adding the relation
graph moves nothing"* — it moves exactly one thing, the Create, to gate 11. And the catch-all
control used `Counter`, which has a reason of its own and never reaches the catch-all;
`net.noodl.WebSocket` does. **A control that never reaches what it controls for proves nothing.**

**An instrument's residual is where its errors live.** `walls.py` put 51 of 666 in `UNCLASSIFIED`
first time — because `rank2` truncates every reason at ~95 characters and the patterns matched
tails that are not there. Printing the residual in full, and refusing to run unless the totals
reconcile, made it visible in one pass.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
and to be run **from `packages/nodegx-export`**. `rank2.ts` / `coverage-audit.ts` / `dumpall.ts` /
`probe27.ts` take projects as argv; **zsh: `"${(@f)$(cat projects.txt)}"`** — the paths contain
spaces, so `$(cat … | tr '\n' ' ')` silently shreds them and rank2 reports on *one* project without
erroring. `build-corpus.ts` needs **both** `--app <harnessDir>` **and** the project list, and
**exits with the failure count** — read the last line (`N/40 projects typecheck.`), never
`echo $?`.

🔴 **Never `git checkout <path>` to undo a source mutation.** Copy the file to the scratchpad,
mutate, run, copy back, and **`md5` both** to prove the restore. That is how this session's ten
mutants were taken.

## Instruments (session 28 scratchpad `628793ab-…`)

- **`walls.py`** (new) — `python3 walls.py reasons-s28.tsv 666`. The wall census: buckets every
  deferred node by what blocks it. Refuses to run unless its total reconciles against the audit,
  and prints its residual in full. Regenerate its input from `rank2`'s reasons axis (the awk
  one-liner is in the file's header). Output: `walls-s28.txt`.
- **`probe27.ts`** — `TYPES=<a,b,c> ts-node probe27.ts <projectDir>…`; every node of those types
  with every incident wire, both port names, plus a parameter tally. **Run it before believing any
  claim about how many of a node the corpus has.** Outputs: `probe28-relations.txt`,
  `probe28-model2.txt`, `probe28-button.txt`.
- **`rank2.ts`** — the ranking instrument; `rank2-s28.txt` (before, byte-identical to s27-after)
  and `rank2-s28-after.txt`. **Run first, every session** — but read §17b before acting on it.
- `coverage-audit.ts` + `projects.txt`; `cov-base-s28.txt` and `cov-after-s28.txt` (both 85.00%,
  differing in exactly the three reason lines). Sum it with the awk one-liner in §16's handoff —
  it prints no corpus total of its own.
- `build-corpus.ts` (committed, `--app <harnessDir>`; the harness needs `@nodegx/core` symlinked
  into its `node_modules` — a prepared `app/` is in the scratchpad, **one per concurrent run**,
  copy it with `cp -a` so the symlink survives). Result: `build-corpus-s28.txt` (**40/40**).
- `mut-s28/plan.ts.pristine2` — the restore point the ten mutants were taken against.
- Also `dumpall.ts`, `probe26.ts`, `mutprobe.ts`, `probe25.ts`, `showfile.ts`, `ifaces.ts`,
  `vfout.ts`, `vfws.ts`, `props2.ts`, `dump.ts`, `probe.ts`, `propnames.ts`, `rv-survey.ts`,
  `emit-to-app.ts` (**never overwrite the app's `package.json`**). Worktrees:
  `scripts/devtools/make-worktree.sh <name> HEAD`. **Never** `git stash` here.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage —
peers were editing `packages/noodl-editor` and the `dev-docs/tasks/phase-7x` trees throughout s28.
468 tests (~5s, from the package dir: `../../node_modules/.bin/jest`); a lone suite-level red with
0 failing tests is a flake until re-run. `npm run typecheck` in the package. `npm run
export-ledger:check` from the root gates the ledger. ts-morph and Prettier stay uninstalled; the
package is not in root `test:packages`.
