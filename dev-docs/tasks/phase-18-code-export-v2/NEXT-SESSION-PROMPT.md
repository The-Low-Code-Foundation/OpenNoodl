# Next session — the map was wrong about the map

**Where the phase stands (2026-08-28, after twenty-nine sessions).** Session 28 said *"pick a
wall"*. Session 29 did not, because measuring the walls by **artefact** instead of by node type
dissolved most of them into one thing — and the leftover turned out to be a latent defect in how
the export decides what a component renders at all.

**Coverage 3,775/4,441 (85.00%) → 3,775/4,441 (85.00%)**, unchanged again, and again that is the
result rather than a failure. `build-corpus.ts` **40/40**. Ledger unchanged (175 types: 101
deferred / 58 translated / 1 stubbed / 15 backend-only). **481 tests (13 new).**
`logic node (…)` catch-alls **221 → 176**.

Written up in [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md)
**§18**. Commit: `22a0f969`.

---

## 🔴 Read this before picking anything

**85.00% is a node-weighted average dominated by eight clones of one project.** The deferred
population, grouped by project rather than by type:

```
  555  83.3%   eight clones of one e-commerce project (68–73 deferred each)
   32   4.8%   Puppy test
   79  11.9%   the other 31 projects
```

**13 of the 40 projects export at 100%.** By component, `Filters/*` alone holds **376 of 666
(56.5%)** — exactly **47 per project × 8**. And §17b's top two walls are the *same kit*: **136 of
170 `JavaScriptFunction` nodes and all 72 `Model2` nodes are inside it.**

So the honest framing is not "ten walls" and not even "three walls". It is: **one third-party kit,
cloned eight times, is most of what is left** — and the headline number measures the corpus's
shape at least as much as the export's reach. Decide whether moving that number is the goal before
optimising it.

`deferred-census.ts` (new) is what answers this: one row per deferred node,
`project ⇥ component ⇥ type ⇥ reason`, refusing to run unless it reconciles against the audit's
666. Group it however the question needs.

## What landed — §18

`plan.ts` computed visual roots from `n.parent === undefined` while the tree walk twelve lines
below read hierarchy from `children` — **two notions of the same thing in one function**.

`nodes.json` states the answer outright in `visualRoots`. That list feeds `componentModel.roots`,
and `componentinstance.ts:326` is `return this._internal.roots[0].render();` — **one root draws**.
The editor sends *"This node is detached from the main node tree and won't be rendered"* against
roots[1..] (`graph-warnings.ts`) and re-derives the field on every save. `noodl-mcp`'s
`visualRoots.ts` already documents the whole chain; F43 is what taught it.

**Measured on the raw files before changing anything** — the IR was the suspect, so it could not be
the instrument — **across 437 components the two rules never disagreed about roots[0]**. No emitted
tree was ever wrong. The export was right by coincidence of source order, one reordering away from
rendering the wrong subtree. Roots now come from the declared list; the parentless rule remains the
fallback for older files.

The **45 nodes under a discarded root** were deferring as `logic node (…)`, which says *not yet*.
The truth is *never*. They now carry that verdict. `Components/Header`, in the same eight clones,
declares six visual roots — a bar plus four nav links and a search input — so **those nav links
have never rendered in the running app.**

## The list

1. **EXP-003 Tier B, read as the kit it is** — ~350 script-tier nodes sharing an artefact with the
   row-identity wall. One kit, two walls, ×8. `tb-survey.ts` dumps every body; read it first.
2. **Row identity (the s10 wall)** — 136 nodes, **112 inside that same kit**. Not independent of
   (1). Scoping them together is what §18a argues for.
3. **The two `ProductCard` projects' missing interface** (§11d(2)/(3)) — ruled §13b, built §14.
   Still the disposition, not a defect.

## 🔴 Traps this session paid for

**A probe built on the suspect artefact inherits its defect.** The first detached census read the
IR and said **67**; the raw files say **49**; the implementation names **45**. Every gap was the
instrument's — 11 nodes were phantom multi-roots in `children`-only files (*the very defect under
investigation*), one was a `Page Stack` this side does not call visual, and two Apps declare roots
that are also children of roots[0] and therefore do render. **When the artefact is the suspect,
the instrument has to come from somewhere else.**

**A number in a message is a claim from whichever predicate produced it.** The first draft said
"the component declares N visual roots". `Puppy test`'s Home2 declares 7 by the editor's
`allowAsChild` and 6 by this side's `isVisual`. Quoting either states the other's answer as fact,
so the reason now carries no count — the claim that matters does not need one.

**Two of five mutants killed nothing, and both were redundancy rather than missing coverage.**
Mutated by line number (§17c's rule, which held). Dropping `rendered.has(node.id) ||` killed
nothing because `walk()` dispositions exactly the nodes in `rendered`; splitting it proved
**either half alone passes the whole suite and dropping both fails**, so it is now one guard using
the idiom fourteen later passes already share. `roots.slice(1)` → `roots` is genuinely equivalent
given that guard, and is recorded in the code rather than covered by a test that cannot fail.
The `Array.isArray` mutant survived first time because **`[]` is truthy** — only a non-array value
separates them. That is now a test.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
run **from `packages/nodegx-export`**. Instruments take projects as argv; **zsh:
`"${(@f)$(cat projects.txt)}"`** — the paths contain spaces, so `$(cat … | tr '\n' ' ')` shreds
them and rank2 silently reports on *one* project. `build-corpus.ts` needs **both** `--app
<harnessDir>` **and** the project list, and **exits with the failure count** — read the last line
(`N/40 projects typecheck.`), never `echo $?`. The coverage audit prints no corpus total; sum it
with `awk '/ ok, .* deferred$/{…}'` (the `↳ deferred:` lines double-count if you don't anchor).

🔴 **Never `git checkout <path>` to undo a source mutation.** `mutate.py` (new) patches one line by
number, restores from a pristine copy and **prints both md5s** to prove it.

## Instruments (session 29 scratchpad `46041da2-…`)

- **`deferred-census.ts`** (new) — the artefact view. `EXPECT=666 ts-node deferred-census.ts
  <projectDir>…` → TSV `project ⇥ component ⇥ type ⇥ reason`; exits 2 if it does not reconcile.
  Outputs: `census-s29.tsv` (before), `census-final-s29.tsv` (after).
- **`rootsource.ts`** (new) — reads the **raw** `nodes.json` files, never the IR: declared
  `visualRoots` vs the parentless rule, and whether they disagree about the rendered root.
  `rootsource-s29.txt`.
- **`detached.ts`** (new) — the IR-side detached census, **kept as the cautionary one**: it mirrors
  `plan.ts:renderRole` and validates the mirror against the plan's own note, and it was *still*
  wrong (67 vs 45) because the IR was the defect. Read §18d before believing it.
- **`mutate.py`** (new) — one-line mutation by line number, with md5-proved restore.
- **`walls.py`** (s28) — the wall census; feed it a reasons axis. Splitting it by kit membership is
  what produced §18a: `awk -F'\t' '$2 ~ /^\/?Filters/ {c[$4]++} …' census-s29.tsv`.
- `rank2.ts` (`rank2-s29.txt` / `rank2-s29-after.txt`), `coverage-audit.ts` + `projects.txt`
  (`cov-base-s29.txt` / `cov-final-s29.txt`, both 85.00%), `probe27.ts` (`probe29-jsfun.txt`),
  `roots.ts`, and s28's `dumpall.ts` / `showfile.ts` / `ifaces.ts` / `tb-survey.ts` / the rest.
- `build-corpus.ts` is committed at `scripts/`; the harness needs `@nodegx/core` symlinked into its
  `node_modules` — a prepared `app/` is in the scratchpad, **one per concurrent run**, copy with
  `cp -a` so the symlink survives. `build-corpus-s29-final.txt` (**40/40**).
- `pristine-s29/` — the restore points the mutants were taken against.

**Standing practice:** work on `cline-dev`; commit by **exact file pathspecs** (never a directory,
never stage) — peers were editing `packages/noodl-editor`, `packages/noodl-mcp` and
`packages/noodl-core-ui` throughout s29. 481 tests (~7s, from the package dir:
`../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a flake until
re-run. `npm run typecheck` in the package; `npm run export-ledger:check` from the root gates the
ledger. ts-morph and Prettier stay uninstalled; the package is not in root `test:packages`.
