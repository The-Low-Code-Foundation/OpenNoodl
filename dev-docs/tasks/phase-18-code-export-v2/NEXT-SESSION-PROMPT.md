# Next session — the relation verbs, or the record read; and the ranking is now measured

**Where the phase stands (2026-08-27, after twenty sessions).** Session 20 rebuilt the ranking
instrument the s19 handoff asked for, used it to **change the planned next slice**, and built the
one it chose: **the record verbs** —
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md), commit
`1840c6d5`. Read its **§0, §3, §5 and §9** before touching backend actions, api stubs, or control
state again.

**What landed.** Create / Update / Delete Record are the **first asynchronous action in the emit
vocabulary**: the compiled handler becomes `async`, the call is `await`ed into the class's api
stub, the `done` chain follows it *inside the try* — which is where `reportOutcomes(…, 'done')`
sits in the runtime, after the store answers — and the `Error` output lands in component state
that nothing clears, exactly as `_internal.error` behaves. **369 tests (25 new); ledger 105
deferred / 54 translated / 1 stubbed / 15 backend-only.**

**Measured, same instrument both sides over the same 40-project list** — worktree at the
pre-change commit, then the working tree:

| | translated / total | % |
|---|---|---|
| before | 3,737 / 4,441 | 84.15 |
| after | 3,749 / 4,441 | **84.42** |

**+12 nodes on an unchanged denominator, across five genuinely different projects** (`Puppy test`,
`Puppy test 3`, `puppy-test-3-fix008c`, `tut001-drive`, `phase58-backend-deferred`); no project
regressed, and every remaining defer in those projects reads back as one of §5's gates in its own
words. The emitted `puppy-test-3` app `tsc -b` and `vite build` clean.

---

## 🔴 The ranking instrument, and why the plan changed

The s19 handoff's next slice was **EXP-003 Tier B (the Filters family, ~80 nodes)**. Session 20
built `rank2.ts` first — the instrument s19 asked for, ranking **by deferral reason** with
distinct-clone-deduped-component, distinct-program and host-emits columns. Two readings inverted
immediately:

1. **`net.noodl.controls.button` reads as 35 nodes across 10 projects — and is 7 distinct
   instances**, every one collateral of a host whose render tree already defers. Nothing to build.
2. **The entire top of the raw ranking is one kit.** `the script reads the Noodl API` (80),
   `logic node (Model2)` (72), `net.noodl.ComponentObject` (56), `the script reads the Component
   scope` (56), and the four *"its `<port>` arrives over a wire"* control rows (72) are the **same
   eight projects** — all clones of the stock Filters kit, **nine distinct components** between
   them, gated behind Model2, a dynamic-template For Each, and a reactive-object/event vocabulary
   none of which exist.

Tier B's ~350-node blast radius is real. It is also **one third-party kit copied eight times**,
and it is weeks of work re-implementing a mini reactive framework (`Noodl.Object.create` with a
global registry, `Noodl.Events`, `Component.RepeaterObject` mutated across the parent/row
boundary, closures shared between nodes through the `Component` scope, `setTimeout` debouncing).
`tb-survey.ts` in the session scratchpad dumps every body of it, per component, with wires —
**read that before anyone commits to Tier B.**

> ⚠️ The instrument answers *"how much work is this, and how broadly does it apply"*, not *"how
> many nodes are there"*. Both numbers are honest; only one of them ranks slices.

**Item 1 of s19's list needed no work**: all four tutorial projects (`tut001-drive`,
`tut003-{starter,bundle,solution}` and `tut003-drive-bundle`) are already in `projects.txt`. They
are the only solution-shaped projects on the machine.

## Next, in order

1. **`AddDbModelRelation` + `RemoveDbModelRelation` + `DbModel2`** — the record verbs' immediate
   neighbours, and what §4c of the new doc is already written for. `Puppy test`'s Create Inquiry
   defers today *only* on its consumed `Id`, and landing the relation verb turns that read into
   the `const created = await …; created.id` shape the section specifies. Small, and it completes
   one real page (Puppy Detail) end to end. `DbModel2` is a second api-stub verb (`fetchPuppy(id)`)
   feeding render sinks.
2. **The User family** (`net.noodl.user.LogIn` / `LogOut` / `User` / `SignUp` — 13 nodes, 4-5
   projects). Every one is the same awaited-action-with-an-Error shape this slice just settled,
   and the §3 control-state clause already makes the credential fields readable from the submit
   button. This is the cheapest remaining breadth in the corpus.
3. **Conditional signal chains for Visual Functions** — `tut003`'s Create now defers on exactly
   one thing: `store ← Logic Builder.ok` is a *value* wire. Landing it also makes §4e reachable
   (the `storageFetch` re-fetch), and §4e records the pass-ordering hazard that will bite when it
   does: query plans are computed **after** handler compilation, so a refetch action compiled in
   the handler pass cannot know whether its target will become a query.
4. **EXP-003 Tier B** stays in the queue as a per-component rewrite, after Model2 and the
   dynamic-template repeater. It is not the next slice, and the ranking that said it was has been
   corrected.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 369 tests (~3s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. `npm run export-ledger:check` from the root gates the ledger.

## Traps this session paid for

🔴 **A state row reached only by its *writer* was filtered out of existence.** Emit keeps
`plan.stateVars` that something **references**, and `referencedStateNames` was built from
expressions plus a short list of implicit readers. A record verb's `Error` row is written by its
catch and — when another verb won the shared status line — read by nothing, so the row vanished
while `setUpdatePuppyError(…)` stayed in the handler and the emitted app did not compile. The rule
the sweep was missing is one line: **a write is a reference.** Anything that adds an action which
*writes* state owes this check.

🔴 **"Compiled" is not "attached", and the difference is a wrong translation.** A verb whose `Do`
the slice cannot translate still runs in the interpreter. Binding its `Error` to a state row
nothing writes would render a blank where the interpreter shows a message — so the read requires
`attachedRecordVerbs`, filled by the attachment sweep, and every binding pass runs after it. The
same distinction retires the api-stub export and the state row for an unattached verb.

🔴 **Three verbs share one status line and the runtime shows whichever wrote last.** Overwriting
`plan.bindings[node][prop]` would have dropped two wires in silence; the first binds and the rest
drop **with a note**. Wherever two producers meet one sink, assert it rather than letting the last
one win quietly.

✅ **The fixture the phase already ships beat the one §7 planned.** `tests/fixtures/puppy-test-3`
carries the idiom verbatim — five inputs into `prop-*`, a button into `Do`, three `Error` wires
into one `Text`, and **a Delete whose class name the author never filled in**. No hand-authored
Cheer addition would have included that last one, and it is gate 1's only real case: the runtime
answers `Failure` with *"No class name specified"* and never reaches the backend, so translating
it as a working call would have been a hole shaped exactly like the defect.

⚠️ **Two designed sections were deliberately not built** (§4c the `id` read, §4e the query
re-fetch), each with its reason recorded in place. Both have exactly zero *reachable* corpus
demand once their blockers are accounted for, and building them would have added machinery no
corpus case could test.

⚠️ Still true: **zsh does not glob unquoted parameter expansions** — `SP=$(echo …*/scratchpad)`,
and `"${(@f)$(cat projects.txt)}"` for the project list. ⚠️ There is no `tsx` in this tree; use
`../../node_modules/.bin/ts-node --transpileOnly --compilerOptions '{"module":"commonjs",…}'`.
⚠️ Peers commit into this tree constantly — `HEAD` moved twice mid-session, once *between* two
`git show` invocations. Commit by pathspec and never stage.

## Instruments (session 20 scratchpad `c21c8eab-…`)

- **`rank2.ts`** — the rebuilt ranking instrument. Two views: deferred **types** and deferral
  **reasons**, each with nodes / projects / distinct components / distinct programs / emitting
  hosts. `rank2-out.txt` holds this session's run. **Use this, not `m2-rank.ts`.**
- `probe.ts` — `TYPE=<typeName> ts-node probe.ts <projects…>`: every deferred instance of one
  type with its reason, parent, params and wires. This is what collapsed the button row from
  "35 nodes / 10 projects" to "7 instances, all collateral" in one run.
- `tb-survey.ts` / `tb-out.txt` — the Tier B census, **per component**: every JS body in the
  Filters family with its runtime-API marker tally and full wire context. Read before Tier B.
- `rv-survey.ts` / `rv-out.txt` — the record-verb census: every instance with every authored
  parameter, which is what set §5's gates (and showed `idSource: foreach`, `storeType`,
  `storeProperties`, `backendId` and `sourceObjectId` have *zero* corpus demand).
- `dump.ts` — `ts-node dump.ts <projectDir> [fileFilter]`: the emitted artefact. The s18 rule
  again; this is what showed the missing `createPuppyError` row.
- `coverage-audit.ts` + `coverage-audit-base.ts` + `projects.txt`, `cov-before-s20.txt` /
  `cov-after-s20.txt`. Worktree recipe: `scripts/devtools/make-worktree.sh <name> HEAD`, then
  `sed` the instrument's absolute import paths at the worktree. **Never** `git stash` here.

ts-morph/Prettier stay uninstalled; goldens protect the later AST refactor; the package is not in
root `test:packages`.
