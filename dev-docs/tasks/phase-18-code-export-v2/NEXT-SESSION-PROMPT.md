# Next session — coverage moves again, and the Condition is finished

**Where the phase stands (2026-08-28, after twenty-seven sessions).** Session 27 closed §15g(1),
the reactive Condition. Coverage went **3,766/4,441 (84.80%) → 3,775/4,441 (85.00%)** — the first
movement since session 21, and the first slice in six sessions whose result is a coverage delta
rather than a compile fix. `build-corpus.ts` holds at **40/40**.

**The `Condition` node is now fully covered.** All fifteen in the corpus translate; no shape of it
defers anywhere. Measured two ways that agree on the population — `probe27.ts` counts 15 nodes,
`coverage-audit.ts` reports 15 OK / 0 deferred.

The slice is written up in [EXP-002-LOGIC-TARGET-OUTPUT.md](./EXP-002-LOGIC-TARGET-OUTPUT.md)
**§10–§12** (it is the Condition's own file — §3 there is the node's other half).
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) **§16** points at
it and carries the updated what-is-left. Commit: `git log` for `feat(exp-002)`.

---

## What landed — LOGIC-TARGET §10

A Condition with the box **ticked** and `Evaluate` **unwired** re-tests on every arrival on
`condition` and fires exactly one arm (`condition.ts`: `scheduleEvaluate` →
`sendSignalOnOutput(condition ? 'ontrue' : 'onfalse')`). A test-per-arrival firing one branch is a
re-run keyed on a value — a `useEffect` around the **same `branch` action §3 already compiles**:

```tsx
// Require Login — re-tested whenever its condition changes (LOGIC-TARGET §10).
useEffect(() => {
  if (!session.authenticated) navigate('/admin-login');
}, [session.authenticated]);
```

One `compileConditionBranch` behind two gates. **Ticked *and* `Evaluate` wired defers** — the node
does both independently (NDA-017 made Evaluate additive) and neither shape carries it alone.

**Consequence, not just mechanism:** the exported admin page had no gate at all and rendered to
anyone. It now redirects a signed-out visitor.

**Bounded diff, measured:** `dumpall.ts` into two trees, **9 files / 66 lines**, all in the three
auth-gate projects. That is also the measured bound on the `effectDeps` change — no other effect
in the corpus reads a session. A bound from the corpus, not a guarantee from the mechanism.

**446 tests (10 new).** Both primary cases are real fixture artefacts. Mutation-checked: 9 red,
controls green on both sides.

---

## 🔴 Read this before picking the next slice

**Everything left buys coverage.** `build-corpus.ts` is still a floor, not a needle — pinned at
40/40 it reports "no regression" and "no progress" with the same number. Keep running it (a
regression still shows), but the evidence has to come from `coverage-audit.ts` and the emit trees.

**`coverage-audit.ts` prints no corpus total** — it is per-project. Sum it:

```sh
awk -F'[ /:]+' '/^=== /{ for(i=1;i<=NF;i++) if($i ~ /^[0-9]+$/ && $(i+1) ~ /^[0-9]+$/ && $(i+2)=="nodes"){ok+=$i; tot+=$(i+1); break} } END{printf "%d/%d (%.2f%%)\n", ok, tot, 100*ok/tot}' cov-after-s27.txt
```

## The list

1. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — §4c is already written for it.
   `RemoveDbModelRelation` has **zero corpus instances**, so it is target-output-only. Now the top.
2. **EXP-003 Tier B** — ~350 nodes, one third-party kit copied into eight projects, gated behind
   four things that do not exist. `tb-survey.ts` dumps every body of it; **read that before
   committing.**
3. **The two `ProductCard` projects' missing interface** (§11d(2)/(3)) — already ruled in §13b and
   built in §14: the export refuses and names it. That is the disposition, not a defect to fix.

Before picking, run `rank2.ts` **and** count the population of whatever node you are about to
work on — see the first trap below for why the ranking alone is not that number.

## 🔴 Traps this session paid for

**A rank row counts what deferred, never what is there.** The handoff said "the reactive Condition
— 3 nodes / 3 projects", read off `rank2.ts`'s deferral tally. `probe27.ts` found **15** Conditions
in the corpus in three distinct shapes: nine `has_reviews` comparators and one `hasName` already
collapsing through the value pass, two Evaluate-only handler chains, and only then the three
reactive auth gates. The tally was right; reading it as the node population was not. **The
population and the deferral list are different questions**, and a slice's real blast radius is the
first one.

**A new instrument's first output is a claim about the instrument.** `probe27.ts` initially printed
`fromProperty` on both ends of an incoming wire, so every `IN` row named the source port twice —
`condition` never appeared and the `eval` wires read as `onClick`. Nothing structural caught it;
the rows just looked wrong. Fixing it is what made the three shapes readable.

**Three places a value kind has to be enumerated, and the file warned about two.**
`src/emit/component.ts` carries a ⚠️ recording that `collectExprUse` and `hookExprSources` are two
walkers and a `session-get` set in only one of them emitted `session.authenticated` with no `const
session` above it. This slice met the same shape twice more:

- **`effectDeps` had no `session-get` case** — it fell through `default:` and added nothing, so
  the auth gate would have emitted `useEffect(…, [])`: a **mount-only** gate that never re-tests
  on sign-out. Transport fine, semantics silently wrong.
- **`planProject`'s pass 5** collapses a `User` node only from `bindings`/`handlers`/
  `changeHandlers`/`receivers`. A reactive Condition's own test is in **none** of those, so without
  adding `branchEffects` the page imports `useSession` from a module that never exports it.
  Grepping the consumers of `sessionCalls` found it; the corpus build would have, one step later.

**A pre-existing test that keeps passing can still be load-bearing — check *why* it passes.**
*"a ticked Run On Value Change defers the Condition"* stayed green because it leaves `Evaluate`
wired, landing on the new additive gate, and because the new reason deliberately keeps the phrase
`Run On Value Change is ticked`. A reworded gate would have made it pass for the wrong reason.

**When a slice deliberately breaks an "X is untouched" assertion, re-aim it, don't delete it.**
`the puppy fixture is untouched by the slice` used `not.toContain('if (')` as a proxy for "no
Condition branch". It is now a **pinned inventory** — every branch listed, an unlisted `if (` still
a regression. Same for the user-family control: the nowhere-landing session read is now *built* by
cutting the Condition's arm rather than read off a fixture that no longer exhibits it.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
and to be run **from `packages/nodegx-export`**. `rank2.ts` / `coverage-audit.ts` / `dumpall.ts` /
`probe26.ts` / `probe27.ts` take projects as argv; zsh: `"${(@f)$(cat projects.txt)}"`.
`build-corpus.ts` needs **both** `--app <harnessDir>` **and** the project list (it exits with
`build-corpus: no projects given` if you pass only `--app`), and **exits with the failure count** —
read the last line (`N/40 projects typecheck.`), never `echo $?`.

🔴 **Never `git checkout <path>` to undo a source mutation.** To measure before/after, copy the
modified file to the scratchpad, `git show HEAD:<path> > <path>`, run, then copy back and **`md5`
both** to prove the restore. That is how this session's mutation check was taken.

## Instruments (session 27 scratchpad `8720da35-…`)

- **`probe27.ts`** (new) — `ts-node probe27.ts <projectDir>…` prints every node of a type (`TYPES`
  env, default `Condition`) with **every incident wire, both port names**, plus a parameter tally.
  **This is the instrument that corrected the handoff's count**; run it before believing any claim
  about how many of a node the corpus has. Output: `probe27-condition.txt`.
- **`dumpall.ts`** — `ts-node dumpall.ts <outDir> <projectDir>…`; the before/after instrument.
  `emit-before/` and `emit-after/` are both there, with `emitdiff-s27-full.txt`.
- **`rank2.ts`** — the ranking instrument; `rank2-s27.txt` (before, byte-identical to s26) and
  `rank2-s27-after.txt`. **Run first, every session.**
- `build-corpus.ts` (committed, `--app <harnessDir>`; the harness needs `@nodegx/core` symlinked
  into its `node_modules` — a prepared `app/` is in the scratchpad, **one per concurrent run**,
  copy it with `cp -a` so the symlink survives). Result: `build-corpus-s27-after.txt` (**40/40**).
- `coverage-audit.ts` + `projects.txt`; `cov-after-s27.txt`. Also `probe26.ts`, `mutprobe.ts`,
  `probe25.ts`, `showfile.ts`, `ifaces.ts`, `vfout.ts`, `vfws.ts`, `props2.ts`, `dump.ts`,
  `probe.ts`, `propnames.ts`, `rv-survey.ts`, `emit-to-app.ts` (**never overwrite the app's
  `package.json`**). Worktrees: `scripts/devtools/make-worktree.sh <name> HEAD`. **Never**
  `git stash` here.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage —
peers were editing `packages/noodl-editor` and the `dev-docs/tasks/phase-7x` trees throughout s27.
446 tests (~4s, from the package dir: `../../node_modules/.bin/jest`); a lone suite-level red with
0 failing tests is a flake until re-run. `npm run typecheck` in the package. `npm run
export-ledger:check` from the root gates the ledger (175 types: 101 deferred / 58 translated /
1 stubbed / 15 backend-only — **unchanged by this slice**, since no node type changed category).
ts-morph and Prettier stay uninstalled; the package is not in root `test:packages`.
