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
| C24 | A freshly exported project fails `npm run build` ([#24](https://github.com/The-Low-Code-Foundation/NodeGX/issues/24)) | HLS-004 | ✅ **CLOSED s5.** Not one expression needing a default: **every** JS-node input field was `?:` unconditionally (`emit/component.ts`), so any arithmetic on any wire-fed input was TS18048. Three input classes now type apart and the verbatim body reads them in the runtime's own scope; nothing is defaulted (NDA-017 §2). 🔴 The `tsc` gate this was scoped to build **already existed and was green** — the corpus had no fixture with the shape, its only `Expression` being `(name \|\| '').length > 1`, whose guard dodges the read. `budget-desk` is that fixture. Verified by **running** `npm install && npm run build` (exit 0) and server-rendering the page: `1500` |
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
| C41 | ✅ **CLOSED by HLS-002.** An export error's wording depended on which realm it was thrown in: `kitSource.ts` and `parseModules.ts` narrowed with `error instanceof Error ? error.message : String(error)`, which is false across a realm boundary, and the fallback carries the constructor name. **Found again from the other end** — HLS-002 AC1 compares the editor's export against `nodegx export` byte for byte, and the two trees agreed on all eighteen files *except* `EXPORT-REPORT.md`. It blocked an acceptance criterion, so it was fixed here: `src/errorMessage.ts`. **Instrument:** 3 of 840 corpus hashes moved, exactly the three HLS-001 recorded, and jest and `ts-node` now agree on all 840 where they disagreed about 3 | HLS-002 | ✅ CLOSED 2026-09-09 |
| C42 | `parse/parseModules.ts:97` writes an **absolute filesystem path** of the exporting machine into `EXPORT-REPORT.md` — measured as `…/packages/nodegx-export/tests/fixtures/kits/noodl_modules/gone-kit/index.js` in the emitted report. Behind a GUI it is noise; in a CI job it is machine-specific content in a published artefact, and it makes the report non-reproducible | HLS-005 | BACKLOG |
| C43 | `analyze/plan.ts` has a **duplicate `case 'collection-clear':`** at lines 18617 and 18759; the second is unreachable. **Instrument:** esbuild warned the moment the package acquired a bundler (HLS-001). Nothing in the repo had ever looked — `tsc` does not flag it and no suite covers the second arm. Worth knowing *which* arm the export actually takes before deleting the other | HLS-004 | ✅ **CLOSED s5.** Same `switch` (`plan.ts:18562`), so the **first** arm is the live one. They were not identical: the live arm also walks `action.minted?.failThen`, so the dead one was a strict subset and deleting it changes no behaviour. `npm run build` is now warning-free |
| C44 | ✅ **CLOSED by HLS-002.** Nothing in this repo executed the published artefact. `tests/hls002-pack-and-run.test.ts` now builds, packs, installs the tarball into `os.tmpdir()` (asserted to be outside the repository) and runs the linked `nodegx` binary — ~7s, no opt-in flag. 🔴 **It paid in its first minute:** the first built bin carried **two shebangs** (esbuild hoists the source's above the banner; a `#!` on line 2 is a syntax error), the build reported success and every suite stayed green. `build.mjs` now fails unless the output begins with exactly one | HLS-002 | ✅ CLOSED 2026-09-09 |
| C45 | 🔴 **`npm pack` does not apply `publishConfig` field overrides** (measured at npm **10.9.4**: the packed `package.json` is byte-identical to the source, including `main`). `publishConfig` overrides npm *config* values, not package.json fields. Filed because it is a trap two tasks on this board could walk into — the natural way to keep an in-repo `src` entry point and a published `dist` one does not exist | **NONE** | BACKLOG — reference, not a fix |

## Rows session 3 found (2026-09-09, HLS-002)

Both of these are **gates that were never wired to anything**, found by running things this task
needed to run rather than by looking for them. Both are fixed; they are filed because the *class*
outlives them — a green repo is a statement about the jobs that actually execute.

| id | what | owner | disposition |
|---|---|---|---|
| C46 | ✅ **CLOSED by HLS-002.** 🔴 **`npm run typecheck` — a PR gate — was red at HEAD.** HLS-001 moved `@nodegx/export`'s `main`/`types` to `dist/` and put its subpaths behind an `exports` map; the root program resolves at `moduleResolution: node`, which does not read an `exports` map, so `exportBadge.ts`'s `@nodegx/export/ledger` stopped resolving and the package root resolved only for somebody who happened to have run its build. **Instrument:** `npx tsc --noEmit` at the repo root, gated on the exit status rather than the tail of a pipe. Fixed with the two `paths` mappings the editor's own tsconfig has always had — and **the identical incident is recorded three lines above them in that file** (CAN-002, `@noodl-versioning`, "18 TS2307s in files nobody had touched") | HLS-002 | ✅ CLOSED 2026-09-09 |
| C47 | ✅ **CLOSED by HLS-002.** 🔴 **The exporter's 86 suites and 3,140 assertions had never run in CI.** `@nodegx/export` is absent from `test:packages`'s scope list and no workflow names it, so every claim this package makes about itself was graded only by somebody running `npx jest` by hand — including HLS-001's three new gates. Added to `test:packages`. ⚠️ **Measured: the suite was 337s (86 suites / 3,140 tests) before this task and is 406s (88 / 3,168) after it, and 336s of that is `typecheck-emitted.test.ts` alone** — worth splitting if that job ever becomes the critical path, and worth knowing before somebody blames the addition | HLS-002 | ✅ CLOSED 2026-09-09 |
| C48 | ⚠️ **`nodegx export` refuses a non-empty output folder unless `--force`, where the editor asks.** Not a defect — a deliberate difference, filed so it is not "fixed" later by somebody making the doors symmetrical. A person can be asked; a pipeline cannot, and silently overwriting is how a job produces a folder that is half of two different apps and exits 0. Asserted from both sides in `two-doors.test.ts` | HLS-002 | ✅ recorded, by design |

## Rows session 4 found (2026-09-09, HLS-003)

| id | what | owner | disposition |
|---|---|---|---|
| C49 | ✅ **CLOSED by HLS-003.** 🔴 **The editor's own File → Export React was on the wrong side of the load seam too** — not just the CLI. `exportSequence.ts:169` calls `parseProject(projectDir, …)`, which reads the project *files*, while the canvas is built from the graph `applyPatches` produced at load. HLS-002 proved the two doors byte-identical, which is exactly consistent with **both being wrong in the same way**. The task file scoped this as a CLI problem; it never was. **Instrument:** the `cheer` fixture with `runOnChange-condition` removed falls from *translated with nothing left over (9)* to *(7)* — two pages and four cascade nodes refused. Fixed in `parse/parseProject.ts`, which now settles each component as it reads it and reports what it settled | HLS-003 | ✅ CLOSED 2026-09-09 |
| C50 | ✅ **CLOSED by HLS-003.** The `def007` scan **could not see the readers most likely to be wrong**, and said so about itself: it finds `ProjectModel.fromJSON` call sites, and the exporter, the MCP server and template generation all reach a project without constructing one. Those three were carried as prose in `NON_FROMJSON_READERS`, where nothing could fail on them — and the exporter sat on the wrong side for as long as its row was a sentence. `GRAPH_READER_SITES` is now a **second, enforced scan** over every shipped file that opens a component graph (17 files, 6 packages), with a four-way disposition. **Instrument:** an unregistered reader added to `noodl-mcp/src` reddens it; removed after measuring | HLS-003 | ✅ CLOSED 2026-09-09 |
| C51 | 🔴 **The task file's account of template generation was stale, and reading it instead of measuring would have wasted the session.** `HLS-003 §2` says `tpl001Template.ts` "has not had the same pass and nobody has measured whether it disagrees". It had: `def038SettledTemplates.test.ts` measured TPL-001 at **57 stored parameters**, fixed it, and gates a *derived* population rather than a named one. Template generation's side of the seam was already closed before this session started. Filed as an instance of the class, not as work | **NONE** | ✅ recorded — the task file is corrected |
| C52 | ⚠️ **Two `noodl-mcp` browser-drive suites are red at HEAD and nobody owns them.** `sbr009ThemeEditorDrive.test.ts` (2) and `def018-def020-layout-drive.test.ts` (1) — 3 failures, stable across a re-run, in a package that is otherwise 95 suites / 1,381 green. The theme one reads `rootPrimary: ""` where it expects a token value and `heroPainted: rgba(0,0,0,0)` where it expects `rgb(0,0,0)`. **Measured, not inherited:** neither suite imports anything HLS-003 touched (the one `runOnChange` match in either file is a comment). ⚠️ **Not re-run at an earlier commit**, so "pre-existing" is inference from the dependency check, not a bisect | **NONE** | OPEN — outlives HLS-003 |
