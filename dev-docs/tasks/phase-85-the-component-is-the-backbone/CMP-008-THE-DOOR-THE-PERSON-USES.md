# CMP-008 — the door the person uses

**Promoted 2026-09-11 (s10) from README §7's remaining owner-NONE row**, filed by s9 at the end of
CMP-007:

> ⚠️ **Still open, one UI away:** a person clicking Install in the EDITOR goes through
> `views/ImportFlow`, not this tool, and still gets no warning. Owner NONE.

## 1. The row's premise is wrong, and that is the seventh time in this phase

🔴 **The common editor install does NOT go through `views/ImportFlow`.**
`ModuleLibraryModel._install` forks on collisions, and the no-collision branch — which is every
install of a first-party part into a project that does not already have it — calls
`applyToProject(dryRun, project)` **directly** and never opens the flow:

```ts
const dryRun = planSelection(source, target, everything, origin);
if (!dryRun.hasCollisions) {
  const result = await applyToProject(dryRun, project);
  if (result.result !== 'success') throw { message: result.message };
  return;                                   // ← every warning in `result` discarded
}
```

That fork is not incidental — **the file's own CN-017 comment, twelve lines above it, already says
so**: *"LIB-005's one-click case skips the import flow entirely, so a consent step hosted inside the
flow would be absent on the most common install — present in the code, absent in practice, and
passing any test that only asked whether a dialog can appear."* CN-017 read that sentence and put
its consent gate **above** the fork. s9's row put its successor's warning below it.

So a fix hosted in `ImportFlow` would be **present in the code and absent in practice**, and would
pass a spec that rendered `ResultStage` with a token warning in its props. See
[[measure-the-artefact-before-believing-the-task-file]] and
[[a-gate-can-have-a-hole-shaped-like-the-defect]].

## 2. What the person actually sees today (measured, 2026-09-11)

| door | route | what is said about tokens | what is said about ANY warning |
|---|---|---|---|
| Clone/Install a prefab, no collision | `ModuleCard` → `_install` → `applyToProject` | nothing | 🔴 **nothing** — `result.warnings` is dropped on the floor, then `ModuleCard` shows `ToastLayer.showSuccess("Prefab X cloned")` |
| Clone/Install a prefab, collision | `ModuleCard` → `_install` → `openImportFlow` | nothing | `ResultStage` renders `summary.warnings` |
| Import from another local project | `ProjectLibraryModel.importProject` → `openImportFlow` | nothing | `ResultStage` renders `summary.warnings` |

🔴 **The one-click door drops every engine warning, not just tokens.** "Failed to copy module X",
"Could not record where the imported modules came from", `moduleGate`'s CN-017 refusal
(*a kit that is simply absent, with nothing anywhere saying why* — the exact failure CN-017 exists to
abolish) all reach `result.warnings` and are then discarded, under a green success toast.

## 3. Why the answer goes in the ENGINE, not in either door

`import-engine/apply.ts` is the one line every route converges on, and CN-017 AC2 already argued this
in place: *"The gate is here, not in the installers. A module install, a project import from a
downloaded archive and a project import from a local folder all reach this loop… a fourth route
added later would have been unprotected by default."* Same argument, same line.

Putting it there also makes door 2 and door 3 free: `summarizeResult` already lifts
`result.warnings` into `ResultSummary.warnings`, and `ResultStage` already renders them under the
warning treatment. **Only door 1 needs new UI**, and what it needs is to stop discarding warnings.

⚠️ **Export is exempt.** `openExportFlow` stages into a throwaway project and reaches the same
`apply()`; a staging project defines no custom tokens, so every token would read unresolved. The
origin discriminates: `plan.origin.kind === 'export-staging'`.

## 4. 🔴 `entryTokens` cannot read a v2 project, and the editor must

CMP-007's `entryTokens` reads `<entryDir>/project/project.json` and scans it for `var(--…)`. That is
correct **for the shelf** — all **75** entries are legacy single-file projects, re-measured
2026-09-11 (`find library -maxdepth 4 -type d -name components` → **0**).

It is not correct for the editor. Door 3 imports from **another project on this machine**, and the
editor writes v2 projects, where components live in `components/**` and `project.json` holds
almost nothing. A `project.json` scan of a v2 source returns `[]` — **a silent zero, on the door most
likely to carry a hand-made token**.

✅ The engine has the answer already: `apply()` holds `importProject`, loaded through the
format-aware `projectFromDirectory`, and `ProjectModel.toJSON()` is format-independent. Scan that.

## 5. Acceptance criteria

- **AC1 — one definition of "a token reference", shared across both packages.** The regex that
  decides what counts lives in exactly one module. `libraryExport.entryTokens` (CMP-007, the export
  side) and the editor's engine (the install side) both read it. 🔴 CMP-007's own note says why:
  *"If the two ever disagreed, the install would report a SUBSET and read exactly like a clean part —
  an under-report is invisible, unlike a crash."* A control arm must show that changing the one
  definition moves BOTH sides.
- **AC2 — the unresolved set is derived in `apply()`, from the loaded project model**, so it is
  correct on a v2 source as well as a legacy one, and so every present and future route is covered by
  default. Scoped to what the plan actually lands (a component the user skipped must not be cited).
  Export staging is exempt and the exemption is asserted.
- **AC3 — door 1 tells the person.** The one-click install surfaces the engine's warnings instead of
  discarding them. 🔴 Graded on the warning REACHING the surface, not on the surface being able to
  render one — that distinction is what §1 is about.
- **AC4 — doors 2 and 3 tell the person**, and this is graded rather than assumed: a spec that walks
  a result carrying the warning through `summarizeResult` into `ResultSummary.warnings`.
- **AC5 — it reports, it never refuses.** A part whose tokens do not all resolve still installs, the
  result is still `success`, and `filesFailed`-style failure semantics are untouched.

## 6. 🔴 The gate cannot be built on the shipped shelf

Re-measured independently 2026-09-11 (s10), reproducing CMP-007 exactly and extending it to modules:

| | entries | reading tokens | distinct | **outside `DEFAULT_TOKENS`** |
|---|---|---|---|---|
| `library/prefabs` | 45 | 18 | 29 | **0** |
| `library/modules` | 30 | 6 | 10 | **0** |

`DEFAULT_TOKENS` is **192** names from `@nodegx/project-contract/tokens`. Every token any shipped
part reads is one a fresh project already has, so **a gate written against the shelf reads zero
before the fix and zero after it** — both arms, grading nothing. See
[[a-rule-reading-zero-in-both-arms-grades-nothing]].

The fixture therefore mints a token the way CMP-004 AC4's export path does: a source project that
defined its own token, installed into a project that has not. The zero above stays as a **labelled
measurement**, not dressed up as a gate.

## 7. Out of scope, deliberately

- **A pre-install warning on the library card.** CMP-007's `get_library_entry` can relay tokens
  because it reads the entry off local disk; `ModuleCard` renders a remote `index.json`, and
  CMP-007 established that a `tokens` field cannot live in `library.json`
  (`additionalProperties: false`, and `build.js` publishes a fixed key set). There is nothing for
  the card to read. The download has happened by the time the answer exists.
- **Making the one-click door open the flow when there are warnings.** That changes install
  semantics for a report.

---

## 8. ✅ What shipped (session 10, 2026-09-11)

| AC | state |
|---|---|
| AC1 one shared definition | ✅ `StyleTokensModel/TokenReferences.ts`. `libraryExport` (both its uses) reads it through `editor-deps`; `tokenGap` reads it directly. **Control arm A: one edit to the pattern reddens 16 editor specs AND 5 `noodl-mcp` specs — including CMP-007's own.** |
| AC2 derived in `apply()`, v2-correct, plan-scoped | ✅ `import-engine/tokenGap.ts` + one unconditional statement in `apply.ts`, before anything is detached. |
| AC3 the one-click door | ✅ `installWarningToast.ts`; `_install`'s no-collision branch shows a sticky warning toast instead of discarding `result.warnings`. |
| AC4 the flow door | ✅ graded at the `summarizeResult` seam, which is now reachable without Electron. |
| AC5 reports, never refuses | ✅ asserted: the result stays `success`. |

**60 specs** — 56 in `noodl-editor/tests-unit/cmp-008/` (4 suites), 4 in
`noodl-mcp/tests/cmp008SharedMatcher.test.ts`.

### 🔴 The arm that mattered, and it was aimed at this task's own gate

`apply.ts` cannot be executed without Electron, so the caller gate walks TypeScript's AST rather
than the file's text — a `toContain` passes on code that is commented out, and this phase's notes
say so. **Arm B switched the feature off with `if (false && …)` and the AST gate passed anyway**:
the import was still there, the call expression was still there, the spread into `warnings` was
still there. A static gate cannot see reachability.

The fix was to stop asking it to. The export-staging exemption moved out of an `if` at the call site
and into `tokenWarningsFor`, where it is graded **by being run**; `apply.ts` was left with one
unconditional statement, and the gate now asserts that the call has no enclosing conditional at all.
Arm B2 (the same subversion via a ternary) goes red. See
[[a-gate-can-have-a-hole-shaped-like-the-defect]] — the hole was shaped like the defect, in a gate
written by the session that knew about the trap.

### Control arms

| arm | change | result |
|---|---|---|
| A | narrow the shared matcher in `TokenReferences.ts` | **16 red (editor) + 5 red (`noodl-mcp`)** — the cross-package control for AC1 |
| B | `if (false && …)` around the call in `apply.ts` | 🔴 **PASSED — the gate's own hole.** Redesigned, see above |
| B2 | the call made unreachable by a ternary, after the redesign | 1 red |
| C | `_install` discards warnings again | 2 red |
| D | the scan ignores the plan and reads the whole source | 9 red |
| E | read `plan.sourceDir/project.json` instead of the loaded model | 1 red — the v2 blindness |

**56 of 56 editor specs ran in every arm** (no arm failed a suite *to run*). Sources restored:
four of six md5-identical to the pre-arm snapshot, and `apply.ts` + `tokenGap.ts` md5-identical to
their post-redesign snapshots, which is the honest statement — those two changed by design between
arm B and arm B2, not by an arm.

### Numbers (MEASURED, 2026-09-11)

- `noodl-editor` `npm run test:main`: **452 suites / 7428 tests, ALL PASSING, EXIT=0.** No floor of
  reds on this runner. 4 suites and 56 tests are this task's; the prior count is *derived*
  (7428 − 56 = 7372), not measured.
- `noodl-mcp` `npx jest`: **3 failed / 1561 passed / 1564 total, EXIT=1.** ✅ Delta reconciles:
  s9's **1560 + 4 = 1564**. The reds are the two long-standing `*Drive` suites
  (`def018-def020-layout-drive`, `sbr009ThemeEditorDrive`), named and unrelated.
  ⚠️ s9's third red, `projectOwnsBackend.test.ts`, was **green** this run — consistent with s9's
  reading of it as a flake under full parallel load rather than a real red.
- `npx tsc --noEmit -p packages/noodl-editor`: **0 lines, EXIT=0.**
  `npx tsc --noEmit -p packages/noodl-mcp`: **0 lines, EXIT=0.**
- `npm run library:check`: **75/75 entries clean, EXIT=0.**
- `toolDisclosure.test.ts`: 18/18, **8272 / 8 under — UNCHANGED.** No tool description was touched.
- ⚠️ `tsc --noEmit -p noodl-editor/tsconfig.tests-main.json` is **red at HEAD** (32 lines, EXIT=2,
  in `Icon.tsx` / `NodeGraphContext.tsx` / an `erg-005` `.pending.ts`) and was measured against a
  baseline copy of that config taken from HEAD: **this task's four new include entries added zero
  lines.** That config is not a gate anybody runs — the jest run is the typecheck.
- ⚠️ **`test:ci` NOT run.** The two webpack-resolution risks this task introduces were closed by
  precedent instead: `@noodl-models/StyleTokensModel/ProjectTokenCss` is already imported that way by
  `utils/compilation/build/processors/html-processor.ts`, and `@noodl-utils/import-engine/legacy/...`
  by `router.setup.ts`. Both aliases are plain prefix aliases in `webpack.shared.js`.
