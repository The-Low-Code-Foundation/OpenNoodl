# Defects the front door found — phase 83 register

Per [PHASE-EXECUTION.md](../../guidelines/PHASE-EXECUTION.md):

> **A defect becomes the next session's first job ONLY if it blocks an acceptance criterion.
> Otherwise it is filed here with an owner, and the next session builds the next task.**

🔴 **Every row carries an owner or the literal word `NONE`, and a disposition of `BLOCKS <AC>` or
`BACKLOG`.** An unowned row gets rediscovered at full price. A row filed here must outlive the
session that filed it — say what was measured, with the instrument, not what was concluded.

## Rows carried in from the community issues

These are not this phase's findings; they are the ones already filed against the product that this
phase's tasks own or explicitly do not.

| id | what | owner | disposition |
|---|---|---|---|
| C23 | Code export drops component-input bindings and reports them as translated ([#23](https://github.com/The-Low-Code-Foundation/NodeGX/issues/23)) | HLS-005 | BLOCKS HLS-011 AC3 |
| C24 | A freshly exported project fails `npm run build` ([#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24)) | HLS-004 | BLOCKS HLS-011 AC1 |
| C31 | Preview server binds every interface with no auth ([#31](https://github.com/The-Low-Code-Foundation/NodeGX/issues/31)) | HLS-006 | BACKLOG |
| C31b | Shipped Linux `.desktop` passes `--no-sandbox` (#31's tail) | **NONE** | BACKLOG — out of scope for HLS-006, deliberately |
| C38 | No non-GUI route to open a project ([#38](https://github.com/The-Low-Code-Foundation/NodeGX/issues/38)) | HLS-009 | BACKLOG |
| C28 | An MCP-created project never appears in Recent projects ([#28](https://github.com/The-Low-Code-Foundation/NodeGX/issues/28)) | HLS-009 (may close on the way) | BACKLOG |
| C40 | `render_report` does not write screenshots to disk / renders pages serially ([#40](https://github.com/The-Low-Code-Foundation/NodeGX/issues/40)) | **NONE** | BACKLOG — HLS-007 checks whether it lands first |
| C12 | Node 22 LTS support ([#12](https://github.com/The-Low-Code-Foundation/NodeGX/issues/12)) | **NONE** | BACKLOG — becomes a dependency if R2 is "publish publicly" |
| C20 | 🔴 `packages/nodegx-export` and `packages/nodegx-core` **do not exist on `origin/main`** (15 packages vs 22); `origin/main` is `d569d2bd`, editor 0.1.0, **1,837** behind. The public cannot read the code they are filing issues about. [PR #20](https://github.com/The-Low-Code-Foundation/NodeGX/pull/20) is open, non-draft and **mergeable** — the fix is written and waiting on a decision | **NONE** | BACKLOG — **ruling R5** |

## Rows this phase found

Session 2 (2026-09-09, HLS-001). Every row says what was measured, with the instrument.

| id | what | owner | disposition |
|---|---|---|---|
| C41 | 🔴 **An export error's wording depends on which realm it was thrown in.** `parse/kitSource.ts:188` and `parse/parseModules.ts:98` both narrow with `error instanceof Error ? error.message : String(error)`, which is **false for an error that crossed a realm boundary** — and a kit's own source is executed in a `vm` context. So the same failure reads `(SyntaxError: Unexpected token 'export')` from a kit that throws and `(Unexpected token 'export')` from a file that could not be read. **Instrument:** the `kits` fixture hashes differently under `ts-node` and under `jest` — three entries, `EXPORT-REPORT.md`, `@notes`, `@report`. Not a test artefact; the same two realms exist in the product | HLS-005 | BACKLOG |
| C42 | `parse/parseModules.ts:97` writes an **absolute filesystem path** of the exporting machine into `EXPORT-REPORT.md` — measured as `…/packages/nodegx-export/tests/fixtures/kits/noodl_modules/gone-kit/index.js` in the emitted report. Behind a GUI it is noise; in a CI job it is machine-specific content in a published artefact, and it makes the report non-reproducible | HLS-005 | BACKLOG |
| C43 | `analyze/plan.ts` has a **duplicate `case 'collection-clear':`** at lines 18617 and 18759; the second is unreachable. **Instrument:** esbuild warned the moment the package acquired a bundler (HLS-001). Nothing in the repo had ever looked — `tsc` does not flag it and no suite covers the second arm. Worth knowing *which* arm the export actually takes before deleting the other | HLS-004 | BACKLOG |
| C44 | 🔴 **Nothing in this repo executes the published artefact.** The editor consumes `src/` through three aliases and every suite runs under CJS, so the ESM entry point had never been imported by anything, ever. HLS-001 AC1 found two loader defects stacked behind each other on the first real install (`Dynamic require of "fs" is not supported`, then `__dirname is not defined in ES module scope`). Both are fixed; the **gap** is that only a manual `npm pack` + install found them, and nothing re-runs that | **NONE** | BACKLOG — HLS-002 should consider making the pack-and-run a gate, since it will ship a `bin` with the same exposure |
| C45 | 🔴 **`npm pack` does not apply `publishConfig` field overrides** (measured at npm **10.9.4**: the packed `package.json` is byte-identical to the source, including `main`). `publishConfig` overrides npm *config* values, not package.json fields. Filed because it is a trap two tasks on this board could walk into — the natural way to keep an in-repo `src` entry point and a published `dist` one does not exist | **NONE** | BACKLOG — reference, not a fix |
