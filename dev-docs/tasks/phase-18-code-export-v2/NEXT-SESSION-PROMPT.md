# Next session — Logic Builder, then EXP-003 Tier B

**Where the phase stands (2026-08-27, after eighteen sessions).** Session 18 built the
**Static Data slice** —
[EXP-002-STATIC-DATA-TARGET-OUTPUT.md](./EXP-002-STATIC-DATA-TARGET-OUTPUT.md), commits
`d5480e90` (paper) and `ae6aff57` (code). Read its §9 before touching the emitter again.

**What landed.** The authored JSON becomes a frozen module constant with a derived row type, and
the For Each that consumes it renders real rows instead of a `TODO` comment. It deliberately does
**not** use the §4e `itemsExpr` path — that path's contract is *"no statically-known item shape ⇒
fields read as `any`"*, and these rows are parsed at emit, so the slice takes the collection-path
treatment: derived type, `allowedFields` with a reported drop, and a real key (`id` where every
row has a unique one — 3/14 — mirroring `Collection.set`'s own treatment of `id` as record
identity; index otherwise). `count` is a number literal. Seven gates each defer with a named
reason the tests assert. **310 tests (23 new); ledger 109 deferred / 50 translated / 1 stubbed /
15 backend-only.**

**Measured, both sides with the same instrument over the same 40-project list** — once in a
worktree at the pre-change commit, once on the working tree:

| | translated / total | % |
|---|---|---|
| before | 3,681 / 4,441 | 82.89 |
| after | 3,705 / 4,441 | **83.43** |

**+24 nodes on an unchanged denominator**, exactly the 24 raw Static Data nodes across 13 host
projects. The before-run reproduces session 16's saved `coverage-s16.txt` in aggregate, which is
what makes the two comparable.

> 🔴 **Two things that number does not say, and both have bitten already.**
> 1. **It is not the 86.7% figure.** `86.7% (2,361/2,724, 28 signatures)` comes from a
>    signature-deduped aggregate that **no surviving instrument reproduces** — `coverage-audit.ts`
>    does not dedupe, and the saved s16 file sums to **82.89% over 40 projects**. Do not carry the
>    86.7% forward as though it were this metric. If you restore the deduped audit, re-measure
>    *both* sides with it.
> 2. **The node count understates the gain.** A deferred For Each was *already* counted as
>    translated — it renders, just as a `TODO`. So the audit sees 24 nodes flip and cannot see the
>    thing that matters: **14 deduped repeaters now render real rows** across 8 template
>    components. Judge a render slice by what renders, not by the disposition tally.

**Next, in order — the §7 ranking from the Model2 document still holds:**

1. **Logic Builder (14 nodes, 4 signatures)** — deterministic, the program is structured JSON
   ([[a-visual-function-program-can-be-generated-headlessly]]), not EXP-003. Paper design first,
   as always. Re-run `m2-rank.ts` before committing to it: rank by **translatable** population,
   not node count — that distinction is what session 17 paid for and session 18 confirmed.
2. **EXP-003 Tier B** — the Filters family (~80 nodes): per-component rewrites against the five
   state rows (CO §7 materialization first). **This is what unblocks Model2**, after which the
   Model2 slice is worth building to its own §4 design.

**Still deferred on its own reason, unchanged by this slice:** the row-output relay
(`ProductCard.onAddToBasket` ×4, `CategoryCard.onBrowse` ×4 — 8 of the 98 template props) and the
two `Component Outputs` nodes they feed. *"Which row fired is not statically expressible."*

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`, plus `scripts/export-ledger`/root `package.json`/
`.github/workflows/pr.yml` only when the gate itself changes); never commit
`packages/nodegx-core/dist`; untracked files add+commit in one chain. 310 tests (~3s, from the
package dir `../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a
flake until re-run. `npm run export-ledger:check` from the root gates the ledger.

## Traps this session paid for

⚠️ **`ParamIR.value` is a tagged union, and code-editor ports are `kind: 'script'`.** The `json`
port is not `literal`, so `literalParam` answers `undefined` for it. The first implementation read
it that way and **deferred all 14 corpus nodes while every test passed** — the gate fired for a
reason true of the accessor, not of the data. Caught only by dumping the emitted artefact. Same
family as session 17's `.value` trap, new costume. **Dump the artefact after wiring a new source.**

⚠️ **A uniform zero is a broken accessor until proven otherwise.** `sd-shape.ts` read template
inputs off `NodeIR.ports` (which carries only *dynamicports*) and reported "0 template inputs" for
all 14. Believing it would have declared the mapping empty and the slice worthless. The emitter
resolves it through `templatePlan.props`; the honest reading was off the *emitted* props
interface. **An absence with no known-firing signal beside it is not a measurement.**

⚠️ **A new `items` source must also be excluded from the §4e branch.** Its guard listed
`DbCollection2` and `Collection2` but not `Static Data`, so it consumed the wire and filed *"items
are fed by no statically known source"* before the typed branch ran.

⚠️ **A value wire needs a pass, not just a `resolveExpr` case.** `count` resolved fine and still
went nowhere until pass 4f's predicate admitted it — that pass took latch and control reads only.

⚠️ **`(\S+)` cannot match a project name with a space.** The audit-summing regex silently dropped
3 of 40 projects (`Puppy test 3`, `Puppy test`, `Tutorial project`). Both sides were equally
affected so the delta held, but the aggregate was wrong until fixed. Use `(.+?)`.

⚠️ **Declaration order in `plan.ts` is load-bearing.** The Static Data derivation was first written
above `stateNameTaken`/`allocStateVar` and would have hit the TDZ; it lives after them now.

⚠️ Still true from before: **zsh does not glob unquoted parameter expansions** (resolve with
`ls -d` first) and `$(cat projects.txt)` splits wrong — use `"${(@f)$(cat …)}"`.
⚠️ `src/analyze/appState.ts` has literal NULs — `grep -a`; never type a NUL escape into Edit/Write
args. ⚠️ The ledger is `ensure_ascii=True` JSON (indent 2) — rewrite through `json.dumps` with
those settings or the diff explodes (2 lines this time). ⚠️ A peer's FB-026 edits live uncommitted
in `packages/noodl-runtime/src/node.ts` + `packages/noodl-viewer-react/src/{nodes,components}/
controls/TextInput*` — never sweep them into an export commit.

## Instruments (session 18 scratchpad `bd3343b9-…`)

- `sd-survey.ts` — Static Data shapes and consumers (session 17's, re-run and reproduced exactly).
- `sd-shape.ts` — row regularity: ragged keys, mixed types, nesting, nulls, usable `id`.
- `sd-props.ts` — **the honest one**: template props read off the *emitted* interface, diffed
  against row keys. Use this pattern whenever a question is "what does the component actually
  declare".
- `sd-emit.ts` — run the real emitter over the corpus hosts and read its notes. **The
  measure-the-artefact step**; it is what proved the templates already emit.
- `coverage-audit.ts` + `projects.txt` — the per-project audit; sum its `=== name: X/Y` lines with
  `^=== (.+?): (\d+)/(\d+)`. `cov-before.txt` / `cov-after.txt` hold this session's two runs.
- Worktree recipe for a like-for-like baseline: `scripts/devtools/make-worktree.sh <name> HEAD`,
  then `sed` the absolute import paths in the instrument to point at the worktree. **Never**
  `git stash` on this checkout, and never the harness's `isolation: "worktree"`.

ts-morph/Prettier stay uninstalled; goldens protect the later AST refactor; the package is not in
root `test:packages`.
