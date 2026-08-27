# Next session — EXP-003 Tier B, and a corpus that has stopped measuring what matters

**Where the phase stands (2026-08-27, after nineteen sessions).** Session 19 designed **and built**
the **Visual Function slice** —
[EXP-002-LOGIC-BUILDER-TARGET-OUTPUT.md](./EXP-002-LOGIC-BUILDER-TARGET-OUTPUT.md), commits
`85a58b4c` (paper) and `20f3c756` (code). Read its **§1, §3.4 and §9** before touching the
emitter again.

**What landed.** A Visual Function (`Logic Builder`) is a **third script host**: the runtime
compiles its `generatedCode` — the block editor's JavaScript projection — and **never compiles
the workspace**. So the body is re-hosted verbatim on session 14's machinery, while the workspace
supplies the port set through the runtime's own `detectIO`. The design's one real move is §3.4:
because the body is *generated* from a closed block vocabulary, every port and variable key is a
literal from a block field, so the gate reads **block types** rather than scanning text — and that
licenses binding `Noodl.Variables` to the app variables store through a facade, where EXP-003's
blanket *"reads the Noodl API"* rule would have refused the whole body. A node with no blocks, or
with nothing wired to `Run`, is `static`, not deferred: the runtime runs nothing there either.
**344 tests (34 new); ledger 108 deferred / 51 translated / 1 stubbed / 15 backend-only.**

**Measured, both sides with the same instrument over the same 40-project list** — worktree at the
pre-change commit, then the working tree:

| | translated / total | % |
|---|---|---|
| before | 3,705 / 4,441 | 83.43 |
| after | 3,737 / 4,441 | **84.15** |

**+32 nodes on an unchanged denominator, every one a `Logic Builder`** (the per-type diff shows no
other row moving). By type **0/34 → 32/34**. The before-run reproduces session 18's after-figure
exactly, which is what makes the pair comparable.

> ⚠️ **34, not 14, and both are honest.** The ranking's 14 is deduped by project signature; the
> coverage audit counts every instance across all 40 projects. Say which you mean.

**The two still deferred**, both blocked by something that is not this slice:
`Components/PriceDiscount` (its host component emits no file at all) and `tut003`'s `check_entry`
— whose block signal `ok` drives `NewDbModelProperties`, *and* whose `entry` input is fed by an
`onTextChanged` payload while the node runs from a button's `onClick`. Two independent blockers,
neither about Visual Functions.

---

## 🔴 Read this before picking the next slice

**The corpus has stopped being a fair instrument, and it is now shaping decisions.** All forty
projects exist because earlier phases needed something to drive; nothing sampled them for coverage
of the node library and nothing refreshes them. This session's top-ranked slice turned out to be
**six distinct nodes, four distinct programs, one of which does real work** — and that one is the
newest project in the list (a tutorial solution). A feature can be well-built and widely used and
still rank last here.

Concretely, and worth doing before the next ranking is trusted:

1. **Add real projects to `projects.txt`** as they are built. The tutorial solutions are the
   best-shaped ones available.
2. **Give `m2-rank.ts` the columns §5 had to derive by hand** — distinct nodes, distinct bodies,
   and hosts that actually emit a file. Ranking by raw population has now cost three consecutive
   sessions a manual correction ([[a-recommendation-carries-a-measurement-of-some-property-not-the-right-one]]).

Treat the audit as a **regression detector**, not a priority oracle.

## Next, in order

1. **EXP-003 Tier B — the Filters family (~80 nodes)**: per-component rewrites against the five
   state rows (CO §7 materialization first). Still the largest real gap, and **it is what unblocks
   Model2**, after which the Model2 slice is worth building to its own §4 design.
2. **`NewDbModelProperties` (8 nodes, 7 projects — the widest *project* spread of any deferred
   type)**. It is what blocks the useful half of the one Visual Function program that does real
   work. Paper design first, as always.
3. **Conditional signal chains for Visual Functions** — a `send signal` firing a chain guarded on
   the branch taken. The natural next increment of this slice, but §5 measured that the only
   corpus node needing it is blocked by (2) anyway, so it earns nothing until (2) lands.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 344 tests (~4s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. `npm run export-ledger:check` from the root gates the ledger.

## Traps this session paid for

🔴 **Adding a third kind to `jsNodeKindOf` silently recruited seven existing dispatch sites.**
Each was written when that meant "Function or Expression", and two were actively wrong for a
Visual Function — both failing *silently*, translating nothing rather than erroring. The
dead-wire pre-pass fell through to the Expression rule (whose liveness test is "is this an
identifier of the expression"), so **every wire on the node read as dead**. And the "never runs"
pass has to precede **pass 2**, because attaching a trigger wire defers its *target* node with the
compile's reason. **When a dispatcher grows a case, audit every call site — the wrong ones do not
throw.**

🔴 **Dumping the artefact caught two bugs no passing test would have** (session 18's rule, paying
off again). The `Noodl.Variables` facade emitted **no separator between its `get`/`set` pairs** —
a syntax error the single-variable case *cannot* show. And the facade must be **`any` on both
sides**: the corpus writes `null` into a `string`-typed variable and reads an `unknown` one into a
`string` output, so the store's own types would fail the emitted app's own `tsc`. **Write the
fixture that has two of the thing.**

⚠️ **Two test-fixture traps that read as product bugs.** The Cheer fixture's button port is
`onClick`, not `click` — a wire to `click` attaches to a port that never renders, so the plan was
right and produced nothing. And feeding a Visual Function's input from `onTextChanged` while
running it from a *different* handler defers **legitimately** — that is the real constraint, not a
wiring mistake, so the fixture feeds from a Variable and a separate test pins the payload case.

✅ **`generatedCode`/`workspace` really are `kind: 'literal'`** (`logic-builder-workspace` and
`logic-builder-hidden` are not `codeeditor` editor types) — the opposite of session 18's Static
Data trap, which is exactly why it was verified against the artefact rather than assumed.

⚠️ Still true: **zsh does not glob unquoted parameter expansions**, and `$(cat projects.txt)`
splits wrong — use `"${(@f)$(cat …)}"`. ⚠️ `src/analyze/appState.ts` has literal NUL bytes —
`grep -a`, and edit it through python bytes (NUL count before/after must match; it is 4).
⚠️ The ledger is `ensure_ascii=True` JSON (indent 2) — rewrite through `json.dumps` with those
settings or the diff explodes. ⚠️ `planProject` takes a `CatalogIndex`; `emitApp` takes the raw
catalog. ⚠️ Peers commit into this tree constantly — `HEAD` moved three times mid-session; commit
by pathspec and never stage.

## Instruments (session 19 scratchpad `954daad8-…`)

- `lb-survey.ts` — the census: per node, its parameter kinds, `detectIO` port set, workspace block
  tally, what the generated code reaches for, and every wire in and out. Ends with the distinct
  `generatedCode` bodies, deduped.
- `lb-emit.ts` — **measure the artefact**: runs the real emitter over each host and reports
  whether the host component emits a file at all. This is what showed `PriceDiscount` was
  collateral and that six instances had no program.
- `lb-gate.ts` — the vocabulary gate over the real corpus, before the plan pass existed
  ([[run-a-checker-over-the-artefacts-that-already-exist]]).
- `lb-dump.ts` — dispositions + the emitted component source. **The step that caught both emit
  bugs.** Note it needs `new CatalogIndex(catalog)` for `planProject` and the raw catalog for
  `emitApp`.
- `coverage-audit.ts` + `coverage-audit-baseline.ts` + `projects.txt` — the per-project audit and
  its worktree-pointed twin; sum `^=== (.+?): (\d+)/(\d+)`. `cov-before-s19.txt` /
  `cov-after-s19.txt` hold this session's two runs.
- Worktree recipe: `scripts/devtools/make-worktree.sh <name> HEAD`, then `sed` the instrument's
  absolute import paths at the worktree. **Never** `git stash` here, never the harness's
  `isolation: "worktree"`.

ts-morph/Prettier stay uninstalled; goldens protect the later AST refactor (which is where the
`__p`/`__s` probe shims get stripped for readability — see §3.3); the package is not in root
`test:packages`.
