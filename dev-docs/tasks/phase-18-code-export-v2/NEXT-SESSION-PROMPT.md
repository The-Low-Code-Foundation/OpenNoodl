# Next session — the missing interface, both ends (design settled, not built)

**Where the phase stands (2026-08-28, after twenty-four sessions).** Session 24 closed §11d(1),
the last of the *large* export defects: **a Visual Function's declared output type is a claim
about the port, not a check on the writes.** The corpus went from **27/40 to 35/40 projects
typechecking**, and 51 diagnostics to 35. It also diagnosed the whole of the remaining work,
which turns out to be one authoring defect seen from two ends — read **§13** before starting,
because it changes what the next fix *is*.

Everything is in [EXP-002-RECORD-VERBS-TARGET-OUTPUT.md](./EXP-002-RECORD-VERBS-TARGET-OUTPUT.md):
**§12** is what landed, **§13** is what is next and why. Commit `107e2870`.

---

## What landed — §12

An empty `set output` value socket generates the literal `null`. That is not an inference: it is
`NoodlGenerators.ts`'s own `valueToCode(block, 'VALUE', …) || 'null'`. The runtime then stores it
verbatim (`logic-builder.ts:386`) and delivers it down the wire — the one typecast on the way
(NDA-014, `node.ts:1026`) is object/array → string and excludes null by an explicit guard. **So a
`number`-typed output really does send null, and the wrapper's field has to admit it.**

Widened, not coerced. Coercion would make the exported app disagree with the graph about what the
port sends, and it is out of reach anyway: the body is re-hosted **verbatim**, the same ruling
that shims `__p`/`__s` rather than stripping them (EXP-003 §4).

- `WorkspaceCensus.emptyOutputWrites` — read off the **workspace**, never mined out of
  `generatedCode`, for the reason `variables` is. **A shadow in the socket counts as plugged in**
  (`valueToCode` resolves the socket's *target*, which for a shadow-only connection is the shadow).
- The plan widens `${declared} | null` for exactly those names, in the `kind === 'visual'` branch.
  An already-`any` port is untouched — `any | null` is `any`, noise carrying no information.
- §4f's materialized `useState` builds its type from the same output list, so it follows; that is
  a second surface with its own test.

| | before (s23) | after (s24) |
|---|---|---|
| projects that typecheck | 27 / 40 | **35 / 40** |
| total diagnostics | 51 | **35** |
| this cause | 16 | **0** |

Coverage **byte-identical to sessions 21–23 — 3,766/4,441, 84.80%**, as it must be: this retires
no node, it makes a translated one compile. Ranking unchanged from `rank2-s23.txt` (re-run first,
as standing practice requires — `rank2-s24.txt` is byte-identical). **419 tests (8 new).**

---

## 🔴 Next: the missing interface — read §13 first, it is not what §11d called it

§11d called it "a component reading a prop it never declared", which reads as though the export
invented the read. **It did not.** One corpus pass reframes all three remaining prop items:

- **`ecommerce-example` / `ecom-responsive-probe`** (18 diagnostics): `ProductCard`'s
  `Component Inputs` node has all 11 ports serialised **`plug: "input"`**. Corpus-wide there are
  **714 such ports plugged `output` and 22 plugged `input` — and the 22 are this one component,
  cloned twice.** `ComponentModel.getPorts()` inverts the plug when deriving the interface, so
  this component advertises **eleven outputs and zero inputs**: in the running app nothing
  arrives and the card renders blank. **`plan.props` is correctly empty.** The bug is that the
  readers still emit `{image}`.
- **`phase55-replay-haiku`** (7 diagnostics): the same defect from the other end — the cards have
  **no `Component Inputs` node at all**, and the sections place them with parameters.

⚠️ **The two ends never meet in one project** — `ProductCard` is never instantiated in either
ecommerce project, and haiku's cards are never read from inside. So the fix must be written and
tested **twice**, not once.

**The ruling (§13b): refuse and name it, do not infer the interface.** Minting props from the
wires would make `ProductCard` render — and would make the export disagree with the runtime,
which is the one thing this phase does not do. A read or write of a port the interface does not
declare is **dropped with a named note**, at two sites:

| end | site | today |
|---|---|---|
| child | `resolveExpr` (plan.ts:1855) and the binding loop (plan.ts:~4473) | emits `{image}`, TS2304 |
| parent | `targetPropName`, three call sites in `emit/component.ts:448` | emits the attr, TS2322 |

Session 23 already left the seam marked: the comment on `targetPropName` says a port the target
does not declare "is §10d(2)/(3)'s question, not this one's". This is that question.

### 🔴 Before touching it: re-key the census to the emitter's population

`ifaces.ts` (scratchpad) counts **36** undeclared parent-end attributes. The emitter writes
**30**. The gap is `phase55-replay-sonnet`'s `</Cards/Category Card> minWidth` / `width` —
**layout parameters the style path consumes, which never reach the JSX**. That project typechecks
today, and a refusal keyed on the census as written would break six correct attributes.

The tell was arithmetic: 30 attributes over 7 JSX elements is exactly the 7 `TS2322` diagnostics
(TypeScript reports `IntrinsicAttributes` once per *element*), while 36 matches nothing.
**Re-run `ifaces.ts` against the emitted files, not the IR.**

## After that — the whole remaining list, 5 projects / 35 diagnostics

1. **The missing interface, both ends** — 25 diagnostics, 3 projects. Above. Closing it takes the
   corpus to **38/40**.
2. **`void` into `ReactNode`** — 2 diagnostics, travels with (1)'s child end.
3. **`number` into a `string` prop** — 4 diagnostics, 2 projects (`leg001-comment-measure`,
   `phase58-awp006-deepseek`). §11d(4).
4. **`readonly unknown[]` into a `string` prop** — 1 diagnostic, `leg001-comment-measure`. §11d(5).
5. **The reactive Condition** — 3 nodes / 3 projects. The first item that buys *coverage* rather
   than compilation; it gates the three remaining `User` nodes (the auth-gate idiom) and retires
   ~6 nodes.
6. **Relation verbs + `DbModel2`** (3 nodes, 1 project) — §4c is already written for it.
   `RemoveDbModelRelation` has **zero corpus instances**.
7. **EXP-003 Tier B** stays where it is: ~350 nodes, one third-party kit copied into eight
   projects, gated behind four things that do not exist. `tb-survey.ts` dumps every body of it —
   **read that before committing.**

## 🔴 Traps this session paid for

**A fixture claimed to be an artefact and was not.** `GUARD_WORKSPACE` is documented as
"tut003's program" and used the bare `setOutput('message')` helper — an *empty socket* — while
tut003's real workspace has both sockets filled. It had been wrong since session 19 and nothing
noticed, because until this session the difference generated no code any test read. The tell was
that adding the widening broke a test asserting the *tight* type; the wrong fix was to update the
expectation, the right one was to fix the fixture. **Build the negative control into the helper
names** — `setOutput` vs `setOutputTo` is a pair a reader cannot confuse by accident, where one
helper with an optional second argument would have left the broken case as the default.

**A census of what the graph contains is not a census of what the emitter writes** (§13c, above).
Six of thirty-six. The arithmetic against the diagnostic count is what caught it.

**Two of the eight new tests share a surface today** — the wrapper signature and the local
`Outputs` declaration are built from one string, so no mutation separates them. Kept deliberately:
they diverge exactly under the design that was rejected (a loose local, a narrow return type), so
the pair pins that rejection.

⚠️ Still true, and cost time again: **`ts-node` must be given an absolute path**, and a scratchpad
script needs `--compiler-options '{"module":"commonjs"}'` and to be run **from the package
directory** (`packages/nodegx-export`). `rank2.ts` / `coverage-audit.ts` / `ifaces.ts` take their
projects as argv, not from `projects.txt`; zsh: `"${(@f)$(cat projects.txt)}"`. `build-corpus.ts`
**exits with the failure count**, so read the file's last line (`N/40 projects typecheck.`) rather
than trusting `echo $?`.

🔴 **Never `git checkout <path>` to undo a source mutation while test edits are live in the same
file** — it discards the whole file. Copy to `/tmp` and copy back instead; that is what the source
mutations here did, and the one `git checkout` cost a full re-application of five test edits.

## Instruments (session 24 scratchpad `16416069-…`)

- **`scripts/build-corpus.ts`** (committed) — `ts-node -P tsconfig.json scripts/build-corpus.ts
  --app <harnessDir> <projectDir>…`. **The harness needs `@nodegx/core` symlinked into its
  `node_modules`**; a prepared `app/` copy is in the scratchpad — **one per concurrent run**, it
  writes into `src/`. Results: `build-corpus-s24-after.txt` (35/40).
- **`vfout.ts`** (new) — every JS wrapper's outputs, declared types, and what the body assigns to
  each, plus which wrapper results are read downstream. This is the census that settled §12.
- **`vfws.ts`** (new) — dumps the raw `noodl_set_output` / `noodl_define_output` blocks of one
  project's Visual Functions, so the empty-socket condition is read off the workspace.
- **`ifaces.ts`** (new) — the interface census, both ends. **Re-key it to the emitted files
  before using it as a gate** (§13c).
- **`props2.ts`** (new) — one component's `Component Inputs`/`Outputs` nodes, their declared
  ports, the wires off them, and what `plan.props` ended up with.
- **`showfile.ts`** — `ts-node showfile.ts <projectDir> <src/path.tsx>` prints one emitted file
  with line numbers; no path argument lists them. This is how you read a diagnostic's line.
- **`rank2.ts`** — the ranking instrument; `rank2-s24.txt`, identical to s22/s23. **Run first,
  every session.**
- `coverage-audit.ts` + `projects.txt`; `cov-after-s24.txt` byte-identical to s23.
  Worktree recipe: `scripts/devtools/make-worktree.sh <name> HEAD`. **Never** `git stash` here.
- `emit-to-app.ts` / `emit-to-app-base.ts` (**never overwrite the app's `package.json`**),
  `dump.ts`, `probe.ts`, `propnames.ts`, `rv-survey.ts`.

**Standing practice:** work on `cline-dev`; commit by pathspec (`packages/nodegx-export`,
`dev-docs/tasks/phase-18-code-export-v2`), untracked files add+commit in one chain, never stage —
peers were editing `packages/noodl-editor`, `packages/noodl-mcp` and `packages/nodegx-backend`
throughout s24. 419 tests (~4s, from the package dir: `../../node_modules/.bin/jest`); a lone
suite-level red with 0 failing tests is a flake until re-run. `npm run typecheck` in the package.
`npm run export-ledger:check` from the root gates the ledger (175 types: 101 deferred / 58
translated / 1 stubbed / 15 backend-only). ts-morph and Prettier stay uninstalled; the package is
not in root `test:packages`.
