# Next session — 38/40, and the last two are one ruling about types

**Where the phase stands (2026-08-28, after twenty-five sessions).** Session 25 built §13: **a read
or a write of a component port the interface does not declare is refused and named, at both ends.**
The corpus went **35/40 → 38/40 projects typechecking** and **35 → 4 diagnostics**. Coverage is
unchanged at **3,766/4,441 (84.80%)** and must be — this retires no node, it deletes emissions that
never had a runtime behind them.

Everything is in [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md):
**§13** is the diagnosis, **§14** is what landed. Commit `e98ac9b6`.

---

## What landed — §14

An undeclared port delivers nothing at runtime: `componentinputs.ts` registers each output as a
**getter over the owner's `_internal.inputValues`**, flushed only when an instance sets it, and an
instance cannot set a port the interface publishes as an output. So the sink keeps its **authored
parameter** — `{name}` in `ProductCard` becomes `Product name`, `{price}` becomes `0`. Minting the
props from the wires would have made the export render *data* where the app renders *placeholders*.

- **Child** (`plan.ts`): `declaresProp` beside the prop list; `resolveExpr`'s `Component Inputs`
  branch defers with a named reason, the binding pass drops + notes + `consumed`.
- **Parent** (`emit/component.ts`): `targetPropName` returns `string | null`; its three call sites
  drop and name, and the repeater's four row `.map`s became one `rowAttrs` doing the same.
- The reason separates the two authoring defects, because their fixes differ: *"declares no
  component inputs at all"* vs *"is not one of this component's declared inputs (`text`)"*.

Measured by emitting all 40 projects before and after into two trees and diffing: **9 files change,
in the 3 projects §13 named, 0 collateral in the other 37.** §13c's hazard (the census's 36 vs the
emitter's 30) turned out to be *structurally* absent: `instanceAttrs` only pushes
`param.value.kind === 'literal'`, and sonnet's `minWidth`/`width` parse as `{kind:'dimension'}`.

**428 tests (9 new).** `rank2-s25.txt` byte-identical to s22/s23/s24; `cov-after-s25.txt`
byte-identical to s23/s24.

---

## 🔴 Next: the last 4 diagnostics are one question — what an authored value's type *is*

Both remaining projects fail the same way: a **static-data row field** flows into a prop the target
declared as `string`, and the rows carry something else. §11d(4)/(5) split them into two items;
they are one ruling, and it is the mirror image of §12's.

| project | line | attribute | mismatch |
|---|---|---|---|
| `leg001-comment-measure` | `CategoryBrowse.tsx:44` | `count={item.count}` | `number` → `string` |
| `leg001-comment-measure` | `FeaturedProducts.tsx:110` | `reviewCount={item.reviewCount}` | `number` → `string` |
| `phase58-awp006-deepseek` | `Home.tsx:16` | `basketCount={3}` | `number` → `string` |
| `leg001-comment-measure` | `SiteFooter.tsx:155` | `links={item.links}` | `readonly unknown[]` → `string` |

**The question to settle first, from the runtime, exactly as §12 was settled:** a component input
port has a declared type (`tsTypeOf` maps a port with no type to `string`), and the graph feeds it
a number. Does the runtime **coerce on delivery**, or does the port simply carry a number while
claiming to be a string? Read the connection path (`node.ts` — NDA-014's cast at `node.ts:1026` is
`object`/`array` → `string` with an explicit null guard, so it is *not* nothing) before choosing
between:

1. **Widen the prop** (`string | number`), the §12 move — faithful if nothing coerces.
2. **Emit the coercion** the runtime performs, if it performs one — faithful only if it does.
3. **Type the port from what feeds it**, which is what §10 refused elsewhere.

⚠️ Note `basketCount={3}` is a **literal parameter**, not a row field: whatever the ruling is, it
has to hold for both the parameter path and the static-data row path, which are different sites.
The `readonly unknown[]` case is the same question one type up, and it is one diagnostic — do not
let it drive the design.

Closing it takes the corpus to **40/40**.

## After that — the list, re-derived this session

1. **The four type mismatches** — above. 4 diagnostics, 2 projects, → 40/40.
2. **The reactive Condition** — 3 nodes / 3 projects. The first item that buys *coverage* rather
   than compilation; it gates the three remaining `User` nodes (the auth-gate idiom) and retires
   ~6 nodes.
3. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — §4c is already written for it.
   `RemoveDbModelRelation` has **zero corpus instances**.
4. **EXP-003 Tier B** stays where it is: ~350 nodes, one third-party kit copied into eight
   projects, gated behind four things that do not exist. `tb-survey.ts` dumps every body of it —
   **read that before committing.**

## 🔴 Traps this session paid for

**A gate had a working precedent three sites away, and nobody looked.** `plan.ts`'s Show Popup
translation has implemented §13b since POPUPS-TARGET: it builds `targetInputs` from ports plugged
`output` and drops a param naming no input, with a note. The other three parent-end sites went
fifteen sessions without it. **Before writing a gate, grep the sibling pipeline for one** — and if
you find it, expect your new one to be a *duplicate* on that population, not a second opinion.

**Two branches written as "the cautious reading" were dead.** The "target with no plan ⇒ keep the
bare mapping" fallback is unreachable: `requireInstance` drops the element whole first. Confirmed
by removing it and diffing the emit trees byte-for-byte, not by reading the code twice. A dead
branch is worse than no branch — it is an untestable claim that looks like a tested one.

**A mutation that constructs the defect can also construct a shape the corpus does not have.**
Deleting a `Component Inputs` node while leaving its wires dangling produced a child-end note the
real defect never produces (haiku's cards declare nothing *and* read nothing). The helper now
deletes the wires with the node, as the editor does — and the test says so, rather than asserting
an absence the mutation created.

**Read the mechanism, not just the number.** §13c said "re-key the census to the emitted files".
The stronger answer was one line of `instanceAttrs`: the six at-risk attributes are
`{kind:'dimension'}` and never reach the JSX push at all. The instrument tells you the numbers
differ; the mechanism tells you whether the difference can bite.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
and to be run **from `packages/nodegx-export`**. `rank2.ts` / `coverage-audit.ts` / `ifaces.ts` /
`dumpall.ts` take projects as argv; zsh: `"${(@f)$(cat projects.txt)}"`. `build-corpus.ts` **exits
with the failure count** — read the last line (`N/40 projects typecheck.`), never `echo $?`.

🔴 **Never `git checkout <path>` to undo a source mutation.** To measure a before/after, copy the
modified file to the scratchpad, write HEAD's version with `git show HEAD:<path> > <path>`, run,
then copy back. That is how both emit trees and both mutation checks were taken this session.

## Instruments (session 25 scratchpad `c7173dc8-…`)

- **`dumpall.ts`** (new) — `ts-node dumpall.ts <outDir> <projectDir>…` writes every emitted file of
  every project plus `__NOTES__.txt` into one tree. **This is the before/after instrument**: it
  keys any claim about "what changes" on the emitter's population, which is the mistake §13c cost.
  `emit-before/` and `emit-after/` are both there.
- **`mutprobe.ts`** (new) — emits the `cheer` fixture with one mutation applied
  (`backwards` | `delete` | `one <component> <port>`), printing the four files and the matching
  notes. This is how each test's expected string was read off the emitter rather than guessed.
- **`probe25.ts`** (new) — every component-instance node's parameters and their `value.kind`, which
  is what settled §14d.
- **`showfile.ts`** — `ts-node showfile.ts <projectDir> <src/path.tsx>`; no path argument lists the
  files. How you read a diagnostic's line.
- **`rank2.ts`** — the ranking instrument; `rank2-s25.txt`. **Run first, every session.**
- `build-corpus.ts` (committed, `--app <harnessDir>`; the harness needs `@nodegx/core` symlinked
  into its `node_modules` — a prepared `app/` is in the scratchpad, **one per concurrent run**).
  Results: `build-corpus-s25-after.txt` (38/40).
- `coverage-audit.ts` + `projects.txt`; `ifaces.ts`, `vfout.ts`, `vfws.ts`, `props2.ts`, `dump.ts`,
  `probe.ts`, `propnames.ts`, `rv-survey.ts`, `emit-to-app.ts` (**never overwrite the app's
  `package.json`**). Worktrees: `scripts/devtools/make-worktree.sh <name> HEAD`. **Never**
  `git stash` here.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage —
peers were editing `packages/noodl-editor`, `packages/noodl-mcp`, `packages/noodl-runtime` and
`packages/noodl-viewer-cloud` throughout s25. 428 tests (~5s, from the package dir:
`../../node_modules/.bin/jest`); a lone suite-level red with 0 failing tests is a flake until
re-run. `npm run typecheck` in the package. `npm run export-ledger:check` from the root gates the
ledger (175 types: 101 deferred / 58 translated / 1 stubbed / 15 backend-only). ts-morph and
Prettier stay uninstalled; the package is not in root `test:packages`.
