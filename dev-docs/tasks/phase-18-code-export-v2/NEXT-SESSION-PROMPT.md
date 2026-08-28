# Next session — the Visual Function's null outputs, then the missing Component Inputs

**Where the phase stands (2026-08-28, after twenty-three sessions).** Session 23 closed §10d(1),
the biggest correctness hole in the export: **a component input port name is user text and was
being emitted verbatim as a TypeScript identifier.** The corpus's syntax diagnostics went from
**558 to zero**. Everything is written up in
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) **§11** — read
**§11c** and **§11d** before starting, because §11c changes what the remaining work *is*.

**What landed.** One mapping, four surfaces, fourteen tests.

- **§11a — the port name is the graph's vocabulary; the identifier is the emitted app's.**
  `propIdentifier` / `propIdentifiers` in `emit/naming.ts`. Nine distinct non-identifier names in
  the corpus, every one of them words separated by a space (`Align X` ×17, `Margin Bottom` ×17,
  `Alternate text` ×8, …). The rest of the emitter guards by *quoting* — and that is precisely why
  this path could not: a record field is only a property key, but a prop is a key **and** a binding
  identifier **and** a JSX attribute name, and the last two cannot be quoted.
- **The mapping is a pure function of the plan's own prop list**, which is how parent and child
  agree without threading anything between them: the caller resolves an attribute name by running
  `propIdentifiers` over the *child's* plan, exactly as the child does. Four surfaces take it —
  interface/destructuring, every reader, an instance's parameters and wired attributes, and a
  repeater row's template inputs — and **each is killed independently by its own test**
  (mutation-checked: revert one, exactly one test fails).
- An already-legal name is untouched. A reserved word is renamed too (`class` → `classProp`) —
  reasoned, not measured; zero corpus instances, and §11a says so.

**Measured, same instrument both sides** — a worktree at HEAD, then the working tree:

| | before | after |
|---|---|---|
| projects that typecheck | 26 / 40 | **27 / 40** |
| total diagnostics | 593 | **51** |
| syntax diagnostics (TS1xxx) | **558** | **0** |

`Puppy test` now typechecks outright; the eight clone projects went from 66 errors each to 2.
**The coverage report is byte-identical to sessions 21 and 22 — 3,766/4,441, 84.80%** — as it must
be: this retires no node, it makes the ones already translated compile. **The ranking is unchanged
from `rank2-s22.txt`, re-run first as standing practice requires.** **411 tests (14 new).**

---

## 🔴 A syntax error suppresses the whole semantic pass — §10d's census was a bound

`tsc` reports parse errors and then **does not run the checker**. Eight of the fourteen failing
projects had syntax errors, so for those projects the s22 run reported **no semantic diagnostics at
all** — and §10d read that silence as "these projects fail for reason (1)".

They do not. With the syntax errors gone, each of the eight reports **two errors that had never
appeared in any run**, in a slice §10d never named. So "roughly five distinct causes" was never a
count of what is wrong with the export; it was a count of what the instrument could still see past
the parse failures. **A diagnostic census over a corpus that does not parse reports its bound, not
its content** — "14 projects fail for five reasons" was always "for *at least* five reasons".

The same shape will recur: **cause (1) below hides whatever sits behind it in eight projects.**
Expect the next after-run to surface something new, and treat that as the instrument working.

## Next, in order — re-derived from the s23 after-run, not inherited

1. 🔴 **`null` into a Visual Function wrapper's typed output** — 16 diagnostics, **8 projects**,
   the whole clone family, and the only thing standing between the corpus and **35/40**. The block
   program emits `Outputs["result"] = null;` while the re-host wrapper types the field from the
   port's catalog type: `function blocks(…): { result?: number }`. An optional `number` cannot take
   `null`. The wrapper is EXP-003 §4 (`jsWrapperLines` in `emit/component.ts`); the question to
   settle is whether the output type widens (`number | null`) whenever the body can write null, or
   whether the emitted assignment coerces — decide it from what the *runtime* does with a null
   write to a typed output, the way §10a and §10b were settled from §1. Reproduce with
   `showfile.ts <projectDir> src/components/Header.tsx` on `cn019-drive`.
2. **A component reading a prop it never declared** — 18 diagnostics, 2 projects
   (`ecommerce-example`, `ecom-responsive-probe`, both `ProductCard.tsx`): `Cannot find name
   'image' / 'badge' / 'rating' / …`, plus the two `void` → `ReactNode` that travel with it.
   Second by projects, first by diagnostic count. §11d(2)/(6).
3. **Props passed to a component that declares none** (`IntrinsicAttributes`, 7 diagnostics,
   `phase55-replay-haiku`). **This is (2) seen from the parent's end** — the child has no
   `Component Inputs` node — so scope them together and check whether one ruling closes both.
4. **The reactive Condition** (`Condition re-tests on every change of its input`, **3 nodes / 3
   projects**, confirmed at HEAD) — still worth more than three, because it gates the **three
   remaining `User` nodes** (`authenticated → Condition → onfalse → RouterNavigate`, the auth-gate
   idiom). Retires ~6 nodes over 3 projects and finishes the page session 21 left half-done. This
   is the first item that buys *coverage* rather than *compilation*; everything above it buys
   compilation, and a project whose export does not compile is worth nothing whatever its coverage
   percentage says.
5. **`number` / `readonly unknown[]` into a `string` prop** — 5 diagnostics, 2 projects. §11d(4)/(5).
6. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — still the only consumer of the record
   verbs' consumed-`Id` gate; §4c of RECORD-VERBS is already written for it. Note
   `RemoveDbModelRelation` has **zero corpus instances**.
7. **EXP-003 Tier B** stays where it is: ~350 nodes that are one third-party kit copied into eight
   projects, gated behind Model2, a dynamic-template For Each and a reactive-object vocabulary none
   of which exist. `tb-survey.ts` dumps every body of it — **read that before committing.**

## 🔴 Traps this session paid for

**The measurement came before the design, and it shrank the design.** One pass over the corpus
(`propnames.ts`) said: nine names, all spaces, no leading digits, **no collisions**, and the
callback props unaffected. That turned an open-ended "sanitiser" into a small mapping with a
stated fallback — and it also said honestly which parts (reserved words, leading digits,
collisions) are *reasoned* rather than measured, which is now written down beside them.

**The obvious guard was the wrong guard.** `tsFieldKey` and friends quote, and quoting is exactly
what a prop cannot do. **When three sites already solve "what if this name is user text" and a
fourth still does not, check whether the fourth has the same degrees of freedom before copying
them** — here it had three surfaces instead of one, and two of them have no quoting syntax at all.

**A four-surface fix needs four independent tests, and the way to know you have them is to break
each surface separately.** Reverting the caller side alone killed exactly the two caller tests and
nothing else; reverting the repeater path killed exactly the repeater test. Without that pass the
repeater surface would have looked covered by the parent-side tests, and it is not — it is a
different code path.

⚠️ Still true, and cost time again: **`ts-node` must be given an absolute path**, and a scratchpad
script needs `--compiler-options '{"module":"commonjs"}'`. **`rank2.ts` and `coverage-audit.ts`
take their projects as argv**, not from `projects.txt`; zsh: `"${(@f)$(cat projects.txt)}"`.
`build-corpus.ts` **exits with the failure count**, so `cmd > out; echo $?` reports the *compound* —
read the file's last line (`N/40 projects typecheck.`) instead of trusting the harness's exit code.

## Instruments (session 23 scratchpad `41ed698f-…`)

- **`scripts/build-corpus.ts`** (committed, in the package) — `ts-node -P tsconfig.json
  scripts/build-corpus.ts --app <harnessDir> <projectDir>…`. **The harness needs `@nodegx/core`
  symlinked into its `node_modules`** or a quarter of the corpus fails for the grader's reasons
  (§10c). Two prepared copies are in the scratchpad: `app/` and `app-before/` — **use a separate
  one per concurrent run**, they both write into `src/`. Results:
  `build-corpus-s23-before.txt` / `build-corpus-s23-after.txt`.
- **`propnames.ts`** (scratchpad) — every non-identifier component input port name in the corpus,
  with its sites, plus the parent-side attribute names and a collision check. Re-run it if the
  mapping ever needs to change.
- **`showfile.ts`** (scratchpad) — `ts-node showfile.ts <projectDir> <src/path.tsx>` prints one
  emitted file with line numbers; no argument for the path lists them. This is how you read a
  diagnostic's actual line.
- **`rank2.ts`** — the ranking instrument; `rank2-s23.txt`, identical to s22. **Run this first,
  every session.**
- `coverage-audit.ts` + `projects.txt`; `cov-after-s23.txt` is byte-identical to `cov-after-s22.txt`.
  Worktree recipe: `scripts/devtools/make-worktree.sh <name> HEAD`. **Never** `git stash` here.
- `emit-to-app.ts` / `emit-to-app-base.ts` — one project into a buildable app copy (**never
  overwrite its `package.json`**). `dump.ts` — `ts-node dump.ts <projectDir> [fileFilter]`,
  `NOTES=1` for the note list. `probe.ts` — `TYPE=<typeName> ts-node probe.ts <projects…>`.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage —
peers were actively editing `packages/noodl-mcp` and `packages/noodl-editor` throughout s23.
411 tests (~4s, from the package dir `../../node_modules/.bin/jest`); a lone suite-level red with
0 failing tests is a flake until re-run. `npm run export-ledger:check` from the root gates the
ledger (175 types: 101 deferred / 58 translated / 1 stubbed / 15 backend-only). ts-morph and
Prettier stay uninstalled; the package is not in root `test:packages`.
