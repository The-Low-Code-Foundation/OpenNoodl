# Next session — sanitise the component prop names, then the reactive Condition

**Where the phase stands (2026-08-28, after twenty-two sessions).** Session 22 closed the two
record-verb typing defects the s21 handoff named, and built the corpus-wide build check it asked
for. That check immediately found something larger than either defect: **14 of 40 projects emit an
app that does not compile**, and the biggest cause is a one-line-shaped hole in the props path.
Everything is written up in
[EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md) **§10** — read
§10a, §10b and **§10d** before starting.

**What landed.** Both defects, plus their tests, plus the grader.

- **§10a — the record interface is the schema *and* the graph.** `MutationPlan.writes` carries the
  columns a verb actually writes with the type its argument resolves to; the stub unions them with
  the schema snapshot, schema first and schema winning any type conflict. This was **not** an open
  design question: §4d already hand-wrote `name?: string; count?: number;` into `StockItem` for the
  very project that failed. The measurement that makes it obvious: **`metadata.dbCollections` is
  absent in 32 of 39 corpus projects**, so "mint the interface from the schema" means `{ id: string }`
  for most of the corpus, and *any* Create/Update that writes a property cannot compile.
- **§10b — an absent record id refuses.** `if (!itemId) throw new Error('Missing Record Id');`
  ahead of the call, inside the try that is already the graph's error path. That is exactly §1's
  runtime contract (`setModelID` reads `undefined`/`null`/`''` as clear-the-binding, then every
  verb answers `setError('Missing Record Id')` and never calls the backend). Gate 9 already defers
  a *statically* absent id; this is its dynamic twin, and the corpus reaches it because **every
  emitted component prop is optional**.
- **`scripts/build-corpus.ts`** — emits every project into a prepared harness and typechecks each.
  Committed, because the scratchpad is where the last one would have died.

**Measured, same instrument both sides** — a worktree at HEAD, then the working tree:

| | projects that typecheck |
|---|---|
| before | 25 / 40 |
| after | **26 / 40** |

Exactly one row moved (`phase58-backend-deferred`, 2 errors → ok); nothing regressed. **The
coverage report is byte-identical to session 21's** — 3,766/4,441, **84.80%**. This session bought
correctness, not nodes, and the numbers say so honestly. **397 tests (7 new).**

**The ranking was re-run first, as standing practice requires, and is identical to
`rank2-s21-after.txt`** — the tree has not moved, so the inherited order still stands where §10d
does not overtake it.

---

## 🔴 A new checker's first finding is a claim about the checker

The first corpus run reported **18 failures**, 13 diagnostics of them *"Cannot find module
'@nodegx/core'"*. The harness had never had `@nodegx/core` installed at all — those projects were
failing the grader, not the product. Linking the package moved the **baseline** from 21/40 to
25/40, and the after-run from 22 to 26.

Had that run been reported as-is, it would have described the export as far more broken than it
is, and the 13 fabricated failures would have outnumbered the real finding in the smaller
projects. **Before a new instrument's output is evidence about the subject, spend one pass asking
what it says about the instrument.**

## Next, in order

1. 🔴 **Sanitise component prop names — ~10 projects emit code that does not parse.** A component
   input port named `Align X` is emitted verbatim as a TypeScript identifier: `Align X?: string;`
   in the Props interface, and `{ Value, Align X, … }` in the destructuring. This is **every
   syntax diagnostic in the corpus run — 558 of 593**. Port names are user text, and the rest of
   the emitter already knows it (`tsFieldKey`, `recordDataObject` and the static-data field
   emitter all guard identically); the props path is the one that does not. It needs a name→
   identifier mapping that survives into the JSX attribute and the instance call site, so it is a
   little more than a `tsFieldKey` call — but it is small, and **it unblocks a quarter of the
   corpus's output**. Ranked first because a project whose export does not compile is worth
   nothing whatever its coverage percentage says. §10d(1).
2. **The reactive Condition** (`Condition re-tests on every change of its input`, **3 nodes / 3
   projects**, confirmed at HEAD) — still worth more than three, because it gates the **three
   remaining `User` nodes** (`authenticated → Condition → onfalse → RouterNavigate`, the auth-gate
   idiom, 3 nodes / 3 projects). Retires ~6 nodes over 3 projects and finishes the page session 21
   left half-done.
3. **The other four compile defects** — §10d(2)–(5): props passed to a component that declares
   none (`IntrinsicAttributes`), a component reading a prop it never declared, and two
   type-mismatch families (`number` and `readonly unknown[]` into a `string` prop). Smaller than
   (1) and independent of it.
4. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — still the only consumer of the record
   verbs' consumed-`Id` gate; §4c of RECORD-VERBS is already written for it. Note
   `RemoveDbModelRelation` has **zero corpus instances**.
5. **EXP-003 Tier B** stays where it is: ~350 nodes that are one third-party kit copied into eight
   projects, gated behind Model2, a dynamic-template For Each and a reactive-object vocabulary
   none of which exist. `tb-survey.ts` dumps every body of it — **read that before committing.**

## 🔴 Traps this session paid for

**The design questions were already answered in the document.** Both were carried forward as open
— *"does a graph-written column join the interface?"*, *"does an absent id call the stub or
refuse?"* — and both were settled in writing: §4d hand-writes the unioned interface for the exact
failing project, and §1 states the runtime's refusal in one sentence. Re-deriving them cost real
time. **Before treating a question as open, grep the target document for the artefact it would
have produced** — a hand-written target block is an answer, not an illustration.

**A guard test's proxy was wider than its claim.** `logic.test.ts`'s *"the puppy export emits no
template literals and no branches"* asserted `not.toContain('if (')` — a stand-in for "no
Condition branch" that a legitimate `if` from a different slice broke. The proxy had always been
wider than the claim; it only became visible when another slice earned an `if`. It now asserts the
claim, and the template-literal half its name promises (which was **never asserted at all**).
**A slice-isolation guard written as a substring ban will eventually fail on a correct change —
and when it does, the answer is to narrow the assertion, not to widen the exception.**

✅ **A required field made the second construction site a compile error.** Adding `guardId` as
non-optional to the `api-call` action surfaced the user-family's construction immediately. This is
s21's rename lesson holding: **when a shape must grow, make the new field required and let the
compiler enumerate the sites** — the alternative is a default that silently does the wrong thing at
whichever site you forgot.

✅ **Mutation-checked the new tests.** Reverting each fix in place killed 3 of the 7 new tests
(the other 4 assert absences and correctly stay green). A test that cannot fail is not a test —
and this cost about a minute.

⚠️ Still true, and cost time again: **`ts-node` must be given an absolute path** — a relative one
in a compound command fails and `; echo $?` reports the *compound's* exit, so it read as success.
**`rank2.ts` takes its projects as argv**, not from `projects.txt`; without them it prints
*"over 0 projects"* and a clean, empty, entirely wrong ranking. zsh: `"${(@f)$(cat projects.txt)}"`.

## Instruments (session 22 scratchpad `2c63ae09-…`)

- **`scripts/build-corpus.ts`** (committed, in the package) — `ts-node -P tsconfig.json
  scripts/build-corpus.ts --app <harnessDir> <projectDir>…`. One row per project, exits with the
  failure count. **The harness needs `@nodegx/core` linked into its `node_modules`** or a quarter
  of the corpus fails for the grader's reasons; the header says so. Run it before claiming a slice
  works. Results: `build-corpus-before2.txt` / `build-corpus-after2.txt` (the `*-before.txt` /
  `*-after.txt` pair is the dishonest first run, kept only as the record of §10c's trap).
- **`rank2.ts`** — the ranking instrument; `rank2-s22.txt`. **Run this first, every session.**
- `coverage-audit.ts` + `cov-base-s21.ts` (the worktree twin) + `projects.txt`; `cov-after-s22.txt`
  is byte-identical to `cov-after-s21-final.txt`. Worktree recipe:
  `scripts/devtools/make-worktree.sh <name> HEAD`. **Never** `git stash` here.
- `emit-to-app.ts` / `emit-to-app-base.ts` — one project into a buildable app copy (**never
  overwrite its `package.json`**). `dump.ts` — `ts-node dump.ts <projectDir> [fileFilter]`,
  `NOTES=1` for the note list. `probe.ts` — `TYPE=<typeName> ts-node probe.ts <projects…>`.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage.
397 tests (~3s, from the package dir `../../node_modules/.bin/jest`); a lone suite-level red with
0 failing tests is a flake until re-run. `npm run export-ledger:check` from the root gates the
ledger (175 types: 101 deferred / 58 translated / 1 stubbed / 15 backend-only). ts-morph and
Prettier stay uninstalled; the package is not in root `test:packages`.
