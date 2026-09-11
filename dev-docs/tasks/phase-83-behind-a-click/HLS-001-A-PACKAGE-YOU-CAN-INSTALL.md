# HLS-001 — `@nodegx/export` is a package you can install

The exporter is 42 source files of pure functions and it is the best-shaped code in the repo for
this job. It is also **uninstallable**: private, unbuilt, no binary, and two files reach out of it
by relative path into two other packages.

## 1. The person sentence

**Someone outside this repo can `npm i` the exporter and call it — the thing #36 had to
reconstruct from a sourcemap is a package they can just install.**

## 2. What is actually in the way (measured 2026-09-09)

| | |
|---|---|
| manifest | `"private": true`, `"main": "src/index.ts"`, no `build`, no `bin`, no `files`, no `engines` |
| 🔴 outbound import 1 | `src/parse/parseProject.ts:16` → `../../../noodl-editor/src/editor/src/models/StyleTokensModel/DefaultTokens` |
| 🔴 outbound import 2 | `src/analyze/logicbuilder.ts:33` → `../../../noodl-runtime/src/nodes/std-library/logic-builder-io` |
| everything else | clean — `fs`, `path`, `vm`; `react`/`react-dom/client`/`vite` appear **only inside emitted string literals** |
| the catalog | `emitApp` is handed a `Catalog`; both callers read `packages/noodl-types/src/node-catalog.json` from a path they compute themselves |

The pattern to copy is already here: `@nodegx/core` builds via `build.mjs` to `dist/` with real
`exports` and `publishConfig.access: public`; `@noodl/preview` and `noodl-mcp` ship `bin` shims that
fail with a readable message when `dist/` is missing.

## 3. Scope

- Resolve the two outbound imports. **Decide, do not just move**: `DEFAULT_TOKENS` and `detectIO` are
  each shared truth with another package, so the options are (a) a small shared package, (b) inject
  them as arguments the way `writeExport` injects `fs`, or (c) genuinely duplicate — which is the
  second-copy-drifts trap and needs a stated reason and a drift gate if chosen.
- A build (`dist/`, `exports`, `types`), `files`, `engines`, and the manifest R2 rules on.
- The `Catalog` stops being a path each caller computes. One accessor, one source.
- **Out of scope:** the `bin` itself (HLS-002) and any behaviour change to the export.

## 4. Acceptance criteria

1. **(person)** In an empty directory outside this repo: install the built package and run a script
   that imports `parseProject`/`emitApp` and exports a real project. No path into the NodeGX
   checkout appears anywhere.
2. A gate fails if a file under `packages/nodegx-export/src` imports outside the package. It fails
   on a deliberately reintroduced import (mutant) and passes at HEAD (control).
3. `emitApp` over the corpus produces **byte-identical** output before and after this task. This is
   a packaging change; a diff here means it was not.
4. The catalog has exactly one reader. Asserted by cardinality, not by grep of a hand-kept list.

## 5. Traps

- 🔴 **AC3 is the whole safety of this task** and it must be measured on the *artefacts that already
  exist*, not on a fixture minted for it — a budget measured on a fixture bounds the fixture.
- 🔴 If duplication is chosen for `DEFAULT_TOKENS`: there are already **182 tokens** in the default
  vocabulary and the site-builder phase spent a task on exactly this shape. A second copy needs a
  gate that reddens when they diverge, in the same commit.
- ⚠️ `main: "src/index.ts"` today means every consumer compiles the TypeScript itself. Anything
  depending on that (the editor's webpack, the jest configs) changes when `dist/` arrives — expect
  `.webpack-cache` to need clearing before believing a red.
- ⚠️ R2 is unruled. Build the package so both answers are one field apart; do not block on it.
