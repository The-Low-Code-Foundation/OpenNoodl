# Next session — fix the two record-verb typing defects first, then the reactive Condition

**Where the phase stands (2026-08-27, after twenty-one sessions).** Session 21 re-ran the ranking
instrument at HEAD, which **inverted the s20 handoff's top two**, and built the slice that came
out first: **the user family** —
[EXP-002-USER-FAMILY-TARGET-OUTPUT.md](./EXP-002-USER-FAMILY-TARGET-OUTPUT.md), commit `9d8f79db`.
Read its **§4e, §5 and §9** before touching the awaited action, the session stub, or any new
`ValueExpr` kind.

**What landed.** Log In / Log Out / Sign Up and the `User` session read all translate, on a
**generalised** version of the record verbs' action: `record-op` is now **`api-call`** with
positional `args`, one kind serving both families. `User` becomes a `useSession()` that answers
signed-out — consistent with the write stubs that throw, and what the runtime documents for a
server render. **390 tests (21 new); ledger 101 deferred / 58 translated / 1 stubbed / 15
backend-only.**

**Measured, same instrument both sides** — a worktree at HEAD, then the working tree:

| | translated / total | % |
|---|---|---|
| before | 3,749 / 4,441 | 84.42 |
| after | 3,766 / 4,441 | **84.80** |

**+17 nodes on an unchanged denominator over four projects**; no project regressed; the
before-run reproduces `cov-after-s20.txt` exactly. Per-type: `LogIn` 0→4, `LogOut` 0→4, `SignUp`
0→1, `User` 0→1 **of four**, plus collateral `RouterNavigate` 50→56 and `Inverter` 2→3.

---

## 🔴 The ranking was invalidated by the change that motivated it

The s20 handoff ranked **relation verbs + `DbModel2`** first. Re-running `rank2.ts` at HEAD —
`rank2-out.txt` described a tree that no longer existed, because the s20 slice landed *after* the
ranking that chose it — gave:

| slice | nodes | projects | distinct components | collateral |
|---|---|---|---|---|
| relation verbs + `DbModel2` + consumed `Id` | **3** | **1** | **1** | none |
| the user family | **13** | **4** | **7** | **6** |

`RemoveDbModelRelation` has **zero corpus instances** — it was in the plan for being a neighbour,
not for being measured. The handoff had ranked the relation verbs first on *"it completes one real
page end to end"*, a demo criterion rather than the coverage criterion the phase is measured by;
its own sentence calling the user family *"the cheapest remaining breadth"* was the correct
reading, filed under the wrong rank.

> **A ranking is invalidated by the change it motivated.** Re-run `rank2.ts` at the start of every
> session, before trusting any inherited order. Fifth session running that this changed the plan;
> second in which the previous session's own handoff was the thing corrected.

## Next, in order

1. 🔴 **The two record-verb typing defects — a shipped slice emits an app that does not compile.**
   Building `phase58-backend-deferred` (which s20 never did — it built only `puppy-test-3`) fails
   `tsc -b`, and **both errors reproduce at the pre-s21 baseline**, so they are the record verbs':
   - `AddStockForm.tsx:50` — `createStockItem({ name: … })` where `Partial<StockItem>` has no
     `name`. The interface is minted from the project's collection **schema**, and the graph
     writes a `prop-` the schema snapshot does not carry. *Design question: does a graph-written
     column join the interface, or is it dropped with a note (the Static Data `allowedFields`
     precedent)?*
   - `StockItemRow.tsx:51` — `deleteStockItem(id)` with `id: string | undefined` from an optional
     component prop. *Design question: does an absent id call the stub, or refuse the way the
     runtime's "Missing Record Id" does?*

   Both belong in RECORD-VERBS §4d. Small, and they close a correctness hole rather than adding
   coverage. **Also add a corpus-wide build check** — `tsc` over one emitted project is not `tsc`
   over the corpus, and that is exactly how these survived.
2. **The reactive Condition** (`Condition re-tests on every change of its input`, 3 nodes / 3
   projects) — and it is worth more than three, because it is precisely what gates the **three
   remaining `User` nodes** (the auth-gate idiom `authenticated → Condition → onfalse →
   RouterNavigate`). Retires ~6 nodes over 3 projects and finishes the page this session left
   half-done. This session's work is what made it the coherent next slice.
3. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — still small, still the only consumer of
   the record verbs' consumed-`Id` gate; §4c of RECORD-VERBS is already written for it.
4. **EXP-003 Tier B** stays where it is: ~350 nodes that are **one third-party kit copied into
   eight projects**, gated behind Model2, a dynamic-template For Each and a reactive-object
   vocabulary none of which exist. `tb-survey.ts` dumps every body of it — **read that before
   anyone commits to it.**

## 🔴 Traps this session paid for

**Two expression walkers, and only one was updated.** `emit/component.ts` has `collectExprUse`
(handler actions) **and `hookExprSources` (render bindings)**, each enumerating the kinds it cares
about. Adding `session-get` to the first only emitted `session.authenticated` in four bindings
with **no `const session` above them**. No unit test could catch it — every assertion about the
binding text was correct. It took `tsc -b` over the emitted app.

**A predicate that enumerated one family.** Pass 4f's `isRecordErrorRead` named `RECORD_VERBS`
while `resolveExpr` named both, and the mismatch **failed silently with a note**: the Log In
status line rendered `<p></p>` where the interpreted app shows the refusal. Caught by dumping the
artefact, not by 369 passing tests.

> Together these sharpen s19's dispatcher rule: **the compiler only helps where the site is an
> exhaustive switch. Every site that is a *predicate* — an `if`, a `some`, a lookup table — is
> silent, and those are the ones to grep for by hand.** ✅ And the stronger form of s18's rule:
> **build the artefact, do not merely read it.** Reading caught one of these; only building caught
> the other.

✅ **The rename was the right call.** `record-op` → `api-call` produced compile errors at all ten
dispatch sites and left **every record-verb golden byte-identical**. A sibling case would have
made each of those ten a silent fallthrough. **When a vocabulary must grow, prefer the rename.**

🔴 **`plan.sessionCalls` had no attachment filter** where `plan.mutations` did, so an unwired Log
In deferred correctly *and still exported `logIn`*. Caught only because the §5.1 test asserts what
the gate **removes**, not merely what it reports. **Assert the absence, not just the reason.**

⚠️ **A test can hang the runner.** A single spanning regex with `(\s+.*\n)*` over a whole emitted
page backtracks catastrophically; jest never returns and it reads exactly like a product infinite
loop. Fixed substrings assert the same thing. (Also: a 120s tool timeout **backgrounds** the run
and leaves an **empty** log — the process is still alive; find it with `ps` and kill your own PID.)

⚠️ Still true: **zsh does not glob unquoted parameter expansions** — `"${(@f)$(cat projects.txt)}"`
for the project list, and `grep` on that file returns *all* matches, so `$(grep -i phase58 …)` is
three paths, not one. ⚠️ No `tsx` in this tree; use `../../node_modules/.bin/ts-node
--transpile-only --skipProject` with `TS_NODE_COMPILER_OPTIONS`. ⚠️ The ledger is
`ensure_ascii=True` JSON — a rewrite with `False` churns every em-dash.

## Instruments (session 21 scratchpad `30c14fe6-…`)

- **`rank2.ts`** — the ranking instrument; `rank2-s21.txt` (before) and `rank2-s21-after.txt`
  (after). **Run this first, every session.**
- `probe.ts` — `TYPE=<typeName> ts-node probe.ts <projects…>`: every deferred instance with its
  reason, parent, params and wires. `user-probe.txt` is what showed all seven user instances are
  one idiom with **not a single authored parameter**.
- `coverage-audit.ts` + `cov-base-s21.ts` (the worktree twin) + `projects.txt`;
  `cov-before-s21.txt` / `cov-after-s21-final.txt`. Worktree recipe:
  `scripts/devtools/make-worktree.sh <name> HEAD`, then `sed` the absolute import paths.
  **Never** `git stash` here.
- **`emit-to-app.ts`** — new, and the one that found both defects: emits a project into a
  buildable app copy (`app/`, which keeps `node_modules` and the `file:` core pin — **never
  overwrite its `package.json`**), so `tsc -b` and `vite build` can grade the real output.
  `emit-to-app-base.ts` is the worktree twin that attributes an error to a slice.
- `dump.ts` — `ts-node dump.ts <projectDir> [fileFilter]`, `NOTES=1` for the note list.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage.
390 tests (~4s, from the package dir `../../node_modules/.bin/jest`); a lone suite-level red with
0 failing tests is a flake until re-run. `npm run export-ledger:check` from the root gates the
ledger. ts-morph/Prettier stay uninstalled; the package is not in root `test:packages`.
