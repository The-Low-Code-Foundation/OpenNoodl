# HLS-001 — what was built, and what each claim was measured with

**Session 2, 2026-09-09, `opennoodl-2d`. All four acceptance criteria closed.** Base `11b2d3a9`.

Rulings taken this session (README §2): **R2 = published publicly to npm · R3 = `nodegx` ·
R4 = wait for HLS-010's spike · R5 = merge [#20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) first.**
R1 (release) remains unruled, which is why nothing here or in the HLS-012 drafts names a date.

## 1. The decision the task asked for, and the measurement that forced it

The task said *decide, do not just move* for the two outbound imports. The two are **not** symmetric,
and the asymmetry was measured rather than assumed:

- `DEFAULT_TOKENS` is data owned by the editor. Nothing constrains where it lives.
- `detectIO` had a documented reason to live in `@noodl/runtime`: dynamic ports are announced from
  the **viewer** window, so the code both windows call has to ship inside the runtime bundle.

That reason looked like it forbade moving it. **It does not, and the repo says why in its own
words.** `packages/noodl-runtime/webpack-ts-rule.js` states that webpack resolves the workspace
symlink to the real path under `packages/`, so an `exclude: /node_modules/` never fires on a
workspace package. Both the viewer's and the editor's `.ts` rules are exactly that shape, so a new
workspace package's TypeScript is compiled by the ordinary rule, and a re-export is inlined into the
runtime bundle exactly as the definition was.

So **one shared package, not a duplicate and not an injection**:
[`packages/nodegx-project-contract`](../../../packages/nodegx-project-contract) — `tokens.ts` and
`logic-builder-io.ts`, plus the two types (`TokenCategory`, `StyleTokenRecord`) the vocabulary needs.
`noodl-editor`'s `DefaultTokens.ts` and `@noodl/runtime`'s `logic-builder-io.ts` are re-exports, so
every existing import in the repo keeps working and there is one copy of each.

Duplication was rejected on the evidence, not on principle: there are 182 tokens and this repo has
already been bitten by a second copy of a palette drifting silently.

⚠️ **Modules sit at the package root, not under `src/`.** Several tsconfigs here still use
`"moduleResolution": "node"`, which ignores an `exports` map entirely. A flat root makes
`@nodegx/project-contract/tokens` resolve under classic *and* bundler resolution, which is why this
change needed **no alias in any of the eight webpack, jest and tsconfig files** that would otherwise
have had to learn about it.

## 2. The acceptance criteria

### AC1 — installed from outside the repo, exporting a real project ✅

`npm pack` → an empty directory under `/private/tmp`, `npm i ./nodegx-export-0.0.1.tgz`, a project
copied in, and a script that imports the package by name.

| | reading |
|---|---|
| ESM (`import`) | ✅ pre-flight printed, **34 files** written, catalog **176 nodes** |
| CJS (`require`) | ✅ 34 files, 24 pre-flight lines |
| subpath `@nodegx/export/ledger` | ✅ `exportCoverage()` → `{exportable:117, placeable:127, percent:92}` |
| *"no path into the NodeGX checkout appears anywhere"* | ✅ `grep -ral "vscode_projects/OpenNoodl"` over the consumer tree **and** over the exported app: no matches |

🔴 **This criterion earned its place three times over — it found three defects that every other
instrument in the repo read green on**, each hidden behind the one in front of it:

1. **`Dynamic require of "fs" is not supported`** on the very first `import`. esbuild's ESM output
   replaces `require()` with a throwing shim, and the package bundles a CommonJS workspace package.
2. **`__dirname is not defined in ES module scope`**, once the first was fixed — `catalogPath()`
   resolves the shipped catalog relative to its own module.
3. **`@nodegx/module-inject` was undeclared** — see AC2, because that one is a hole in a gate.

The editor consumes `src/` and the suites run under CJS, so **nothing in this repo executes the
published artefact**. Only installing it does. That is the whole argument for AC1 being a real
install and not a unit test, and it is the same argument this phase makes about CI: an artefact
nobody runs is an artefact nobody grades.

### AC2 — a gate fails on an import that leaves the package ✅

[`tests/hls001-package-boundary.test.ts`](../../../packages/nodegx-export/tests/hls001-package-boundary.test.ts):
six rows — the control (≥40 source files read), the assertion at HEAD, and **three mutants**
(a reintroduced deep relative import into the editor, an undeclared bare import, and a bare
`require()`).

🔴 **The gate had a hole shaped exactly like the defect, and AC1 found it, not the gate.** The first
version visited only `ImportDeclaration` / `ExportDeclaration` / `ImportTypeNode` and read **green**
over `src/parse/parseModules.ts:32`, which loads `@nodegx/module-inject` — an undeclared,
unpublished workspace package — with a bare `require()` **call expression**. Specifiers are read
with the TypeScript parser rather than a regex on purpose: `src/emit/component.ts` contains
thousands of `import` statements *inside emitted string literals*, and a text scan grades the
emitted app instead of the package. (The sibling gate in `build.mjs` was written with a regex first
and reported two offenders that were English prose inside doc comments — a gate that invents
findings is worse than none.)

`build.mjs` carries the same rule for the *published* surface: declarations are pruned to what the
entry points reach, and the build **fails** if a surviving `.d.ts` names a module that is not a
runtime dependency. Armed and proven: mutant (`export { visualIoOf }` from `index.ts`) → exit 1
naming `dist/analyze/logicbuilder.d.ts -> @nodegx/project-contract/logic-builder-io`; control → 0.

### AC3 — `emitApp` over the corpus is byte-identical ✅

**42 projects, 840 hashes, zero differing, zero added.** Measured with
[`scripts/corpus-hashes.ts`](../../../packages/nodegx-export/scripts/corpus-hashes.ts) under
`ts-node` at `11b2d3a9` *before the first edit*, and again after the last one. The corpus is
`tests/fixtures/*` — artefacts other tasks already put there, never a fixture minted for this task.

**Controls, in both directions.** One token value changed to `#ff00ff` moves **42** hashes (every
project's `tokens.css`) — run once against the editor's copy before the move and once against the
contract package's copy after it. So the corpus is known to *reach* the module, not merely known to
agree with itself.

🔴 **Named because the gate cannot see it: not one corpus project contains a Logic Builder node**,
so AC3 is blind to `detectIO`. What grades that half is `@noodl/runtime`'s eight `logic-builder-*`
suites and the editor's `lgc-*`/`vfn-*` specs, all of which run against the moved code through the
re-export, and all of which are green.

[`tests/hls001-corpus-identity.test.ts`](../../../packages/nodegx-export/tests/hls001-corpus-identity.test.ts)
is the forward net. ⚠️ Its golden is generated **under jest, after the move**, so on its own it
cannot prove the move changed nothing — the ts-node pair above proves that. Two instruments, each
doing only what it can.

### AC4 — the catalog has exactly one reader ✅

It had **twenty-eight**: two production call sites and twenty-five test files, each computing its own
`path.join(__dirname, '..', '..', 'noodl-types', 'src', 'node-catalog.json')`, plus two other
scripts. Now one: `loadCatalog()` in `src/catalog.ts`.

The catalog **travels with the package** — `build.mjs` copies it into `dist/` — because a consumer
who installed from a registry has no `@noodl/types` to read it from. It is still authored in exactly
one place and never edited here; a copy the build regenerates cannot drift.

[`tests/hls001-catalog-cardinality.test.ts`](../../../packages/nodegx-export/tests/hls001-catalog-cardinality.test.ts)
asserts the count by **searching the tree, not by checking a list of known callers** — a hand-kept
list passes forever after the twenty-ninth caller. It carries a control (a search that must match
>30 files, so a mistyped `--include` cannot make the assertion pass by finding zero), and it excludes
itself by name, because the file names the artefact in its own search string.

⚠️ **One reader is a claim about this package.** The editor imports the catalog *statically*
(`exportReactCode.ts:25`) because webpack bundles it into a renderer that has no filesystem read to
do, and moving that into the package would reintroduce exactly the outbound import AC2 forbids. So
the gate asserts the thing that actually matters across that boundary: both mechanisms resolve to
**the same bytes**, by sha256.

## 3. The manifest (R2 = public)

`private: true` → published: `main`/`module`/`types` at `dist/`, an `exports` map with `.`,
`./ledger` and `./package.json`, `files`, `engines: node >= 22` (#36's ask, and #12), `repository`,
`publishConfig.access: public`, and a `build` script. A README aimed at someone who has never seen
this repo, which states the two things worth knowing before putting it in a pipeline: it does not
deploy, and it reads the file rather than the graph the editor rewrites on open (HLS-003).

✅ **In-repo consumption is untouched**, which is why the ⚠️ trap in the task file did not bite: the
editor resolves `@nodegx/export` by explicit alias to `src/` in three places — `tsconfig.json`
paths, `jest.config.js` moduleNameMapper, and `webpack.shared.js`. `dist/` is a publishing artefact
only, and its absence cannot break a build in this repo.

🔴 **Measured, because the plan depended on it and it turned out to be false:** `npm pack` at
**npm 10.9.4 does not apply `publishConfig` field overrides** for `main`/`exports`/`types` — the
packed manifest is verbatim. The original design was to keep `main: src/index.ts` for the repo and
swap in `dist` at publish time. It does not work; `publishConfig` overrides npm *config* values, not
package.json fields. The alias discovery above made it unnecessary anyway.

## 4. Verification

| gate | reading |
|---|---|
| `@nodegx/export` jest | **86 suites, 3,140 tests, all pass** (83/3,126 before; +3 suites, +14 rows — 6 boundary + 4 corpus + 4 catalog, which reconciles) |
| `@nodegx/export` `tsc --noEmit` | exit **0** |
| `@nodegx/project-contract` `tsc --noEmit` | exit **0** |
| `@noodl/runtime` jest | **156 suites, 2,682 pass, 13 skipped** — includes all 8 `logic-builder-*` suites |
| `@noodl/runtime` `tsc --noEmit` | exit **0** |
| editor targeted specs (`def-001`, `sbr-003`, `vib-007`, `lgc-004/007/009`, `vfn-008/011`) | **25 suites, 354 tests** pass |
| editor `test:main` | **439 suites, 7,289 tests** pass |
| editor `test:ci` | **2,945 specs, 4 failures, seed 27827, HEAD `11b2d3a9`** — and all four are `AIX-006 style vocabulary` **by name**, which is the documented floor. Zero new failures. |

Every exit code was read from the status, not from empty output.

## 5. Defects found, and where they went

| | finding | filed |
|---|---|---|
| C41 | `kitSource.ts:188` and `parseModules.ts:98` narrow with `error instanceof Error ? error.message : String(error)`, which is **false for an error that crossed a realm boundary** — jest's context, and in the product the `vm` context a kit's own source runs in. The same failure is reported as `(SyntaxError: Unexpected token 'export')` or `(Unexpected token 'export')` depending on where the error came from. **Found as a disagreement between two runners over three hashes**, and it is a product defect, not a test artefact | HLS-005 (what the report says) |
| C42 | `parseModules.ts:97` writes an **absolute filesystem path** into `EXPORT-REPORT.md` (`…/tests/fixtures/kits/noodl_modules/gone-kit/index.js`). Harmless in a GUI, machine-specific noise in a report a CI job publishes | HLS-005 |
| C43 | `src/analyze/plan.ts` has a **duplicate `case 'collection-clear':`** (lines 18617 and 18759); the second is dead. Reported by esbuild as a warning the moment the package acquired a bundler — nothing else in the repo had ever looked | HLS-004 |

Neither C41 nor C42 was fixed here: this task is a packaging change and AC3 forbids moving a byte.
Both are wording in a report, which is HLS-005's whole subject.

## 6. `test:ci`, and why it was the gate worth waiting for

It is the one gate this task could plausibly have reddened with nothing else noticing, for two
independent reasons: the editor's `test:ci` webpack **typechecks sibling packages' tests**, and this
task added three spec files under `packages/nodegx-export/tests`; and it is the only thing that
actually bundles the editor, so a new workspace package that webpack could not compile would fail
here and nowhere else.

Run with `.webpack-cache` deleted first, so the reading could not come from a poisoned cache.
**`webpack 5.108.4 compiled successfully`**, then `2945 specs, 4 failures, seed 27827, HEAD
11b2d3a9` — all four `AIX-006 style vocabulary`, **by name**, which is the floor.

⚠️ **The command's own exit code lied and the readout did not.** It was launched as
`npm run test:ci > log 2>&1; echo "TEST_CI_EXIT=$?"`, and the `;` made the shell report **0** — the
`echo`'s status, not the run's. `lerna ERR! npm run test:ci exited 1` is in the log, and the
authoritative reading is `packages/noodl-editor/tests/test-results.json` (**not** the package root),
whose mtime and `gitHead` were both checked. Exactly what
`test-results.json is the readout, not the log` is for.
