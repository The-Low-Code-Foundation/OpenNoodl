# Next session — the corpus is green; from here the evidence has to change

**Where the phase stands (2026-08-28, after twenty-six sessions).** Session 26 closed §11d(4)+(5),
the last two causes. The corpus went **38/40 → 40/40 projects typechecking** and **4 → 0
diagnostics**. Coverage is unchanged at **3,766/4,441 (84.80%)** and must be — this retires no
node.

**Every emitted project in the corpus now compiles.** That is what §10c's grader was built for,
five causes and seventeen sessions ago.

Everything is in [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md):
**§15** is the whole slice. Commit — see `git log` for `fix(exp-002)`.

---

## What landed — §15

The four remaining diagnostics were **not** a type mismatch. One measurement before any code
retired the question every previous handoff had asked (*"does the runtime coerce a number into a
`string` port?"*): **none of the four ports declares `string`. All four declare `*`.**

`*` is the untyped wildcard — what the editor writes into a new Component Inputs port
(`componentinputs.ts`, `type: { name: '*' }`), what `PORT-TYPE-CONTRACT.md` calls "untyped …
connected anywhere", and **471 of the corpus's 714 component ports**. `tsTypeOf` sent all of it
through `default:` to `string`, so the emitter was claiming a type the graph had refused to make,
and tsc was reporting the emitter contradicting itself.

The fix is §12's ruling one level up — *the declared type is a claim about the port, not a check
on what reaches it* — and it is four lines: `case 'string': return 'string'` (**load-bearing**:
224 ports reached their type through the old default), and `default: return 'any'`.

🔴 **The ruling was already written twice in the same file.** `jsOutputTsType` and `valueTsTypeOf`
both already default to `any`, and the latter's doc comment **cites §10 by name**. `tsTypeOf` was
the odd one of three — the same shape as §14e's finding, one session later.

**Measured with `dumpall.ts` into two trees:** 96 files, **471 lines against 471** — 468 prop
declarations `string;`→`any;`, 3 notes quoting the type name, **zero JSX**. See §15e for why that
last one was nearly false: the **format-collapse gate** reads this exact type, and a Text whose
whole format is `{someWildcardProp}` *would* change. The corpus has no such site — that is a bound
from the corpus, not a guarantee from the mechanism.

**436 tests (8 new).** `rank2-s26.txt` byte-identical to s22–s25; `cov-after-s26.txt`
byte-identical to s23–s25.

---

## 🔴 Read this before picking the next slice

**`build-corpus.ts` can no longer tell you anything by moving.** Pinned at 40/40 it reports "no
regression" and "no progress" with the same number. It is a **floor now, not a needle** — keep
running it (a regression still shows), but the next slice's evidence has to come from
`coverage-audit.ts` and the emit trees. A session that reports "40/40, unchanged" as its result
has reported nothing.

Everything left buys **coverage**, which is the number that has not moved since session 21.

## The list

1. **The reactive Condition** — 3 nodes / 3 projects. **Now the top.** It gates the three
   remaining `User` nodes (the auth-gate idiom) and retires ~6 nodes. The first item in six
   sessions whose result is a coverage delta rather than a compile fix.
2. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — §4c is already written for it.
   `RemoveDbModelRelation` has **zero corpus instances**, so it is target-output-only.
3. **EXP-003 Tier B** stays where it is: ~350 nodes, one third-party kit copied into eight
   projects, gated behind four things that do not exist. `tb-survey.ts` dumps every body of it —
   **read that before committing.**

## 🔴 Traps this session paid for

**The question in the handoff was the wrong question, and one measurement retired it.** Three
sessions had framed the remaining diagnostics as "number into a `string` prop — does the runtime
coerce?", complete with a plan to read the connection path. Reading the *port declaration* first
showed there was no `string` to coerce into. **Before designing a reconciliation between two
things, check that both of them are actually there** — the mismatch was between the graph and the
emitter's own invention, not between two authored types.

**A `default:` branch is a claim about a vocabulary you have not enumerated.** Port types are
**free text** (`AiAssistant/authoring/plan.ts:181` — *"names are what bind"*), so there is no
closed set to fall through from. A `default:` that returns a concrete type is asserting something
about every name nobody has written yet. Both sibling mappers already knew this; the one that did
not was the one with the bug.

**The prediction that the diff would be interface-only was nearly wrong, and checking is what
made it a finding.** `plan.ts:2260` propagates a prop's `tsType` into `exprTsType`, which gates
format-collapse — so the change *can* alter emitted markup. It doesn't here, and §15e says so as
a corpus bound rather than a mechanism guarantee. **Grep every consumer of a value before
claiming a change's blast radius**; `grep -n "\.tsType"` took one minute and moved the claim from
wrong to bounded.

**A test that passes on the first run has proved nothing.** All 8 new tests passed immediately —
and so did the whole 428-test suite, which is how you learn the old default was never pinned.
Reverting `tsTypeOf` to HEAD showed **5 red, 3 green**, the 3 being exactly the negative controls
(`string`/`number`/`boolean`/`array`), which must pass on *both* sides or they are not controls.

⚠️ Still true: **`ts-node` needs an absolute path**, `--compiler-options '{"module":"commonjs"}'`,
and to be run **from `packages/nodegx-export`**. `rank2.ts` / `coverage-audit.ts` / `ifaces.ts` /
`dumpall.ts` / `probe26.ts` take projects as argv; zsh: `"${(@f)$(cat projects.txt)}"`.
`build-corpus.ts` **exits with the failure count** — read the last line (`N/40 projects
typecheck.`), never `echo $?`.

🔴 **Never `git checkout <path>` to undo a source mutation.** To measure a before/after, copy the
modified file to the scratchpad, write HEAD's version with `git show HEAD:<path> > <path>`, run,
then copy back. That is how the mutation check was taken this session.

## Instruments (session 26 scratchpad `8bba44f1-…`)

- **`probe26.ts`** (new) — `ts-node probe26.ts <projectDir>…` prints every Component Inputs output
  port with its **raw declared type**, plus a corpus-wide tally. **This is the instrument that
  retired the session's stated question**; run it before believing any claim about what a prop's
  type is.
- **`dumpall.ts`** — `ts-node dumpall.ts <outDir> <projectDir>…`; the before/after instrument.
  `emit-before/` and `emit-after/` are both there, with `emitdiff-s26-full.txt`.
- **`rank2.ts`** — the ranking instrument; `rank2-s26.txt`. **Run first, every session.**
- `build-corpus.ts` (committed, `--app <harnessDir>`; the harness needs `@nodegx/core` symlinked
  into its `node_modules` — a prepared `app/` is in the scratchpad, **one per concurrent run**,
  copy it with `cp -a` so the symlink survives). Results: `build-corpus-s26-before.txt` (38/40),
  `build-corpus-s26-after.txt` (**40/40**).
- `coverage-audit.ts` + `projects.txt`; `mutprobe.ts`, `probe25.ts`, `showfile.ts`, `ifaces.ts`,
  `vfout.ts`, `vfws.ts`, `props2.ts`, `dump.ts`, `probe.ts`, `propnames.ts`, `rv-survey.ts`,
  `emit-to-app.ts` (**never overwrite the app's `package.json`**). Worktrees:
  `scripts/devtools/make-worktree.sh <name> HEAD`. **Never** `git stash` here.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage —
peers were editing `packages/noodl-editor` and the `dev-docs/tasks/phase-7x` trees throughout s26.
436 tests (~8s, from the package dir: `../../node_modules/.bin/jest`); a lone suite-level red with
0 failing tests is a flake until re-run. `npm run typecheck` in the package. `npm run
export-ledger:check` from the root gates the ledger (175 types: 101 deferred / 58 translated /
1 stubbed / 15 backend-only). ts-morph and Prettier stay uninstalled; the package is not in root
`test:packages`.
