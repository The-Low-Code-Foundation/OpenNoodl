# Phase 69 — next session

**Written 2026-08-16, session 5.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty, so nothing below is blocked on a decision. Then read
[CN-003](CN-003-THE-PROJECT-CATALOG-OVERLAY.md), whose slice log carries the measurements.

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** | ✅ `ed28a03c` | ✅ | Render harness sees kits. `@nodegx/module-inject` extracted |
| **CN-002** | ✅ `378793bc` | ✅ | A skipped check says it was skipped. Baseline **0/5/8** |
| **CN-003** slice 1 | ✅ `f1663600` | ✅ | `@nodegx/kit-catalog` — the shared mapping, 26/26 |
| **CN-003** slice 2a/2b | ✅ `e4a10a70` | ✅ | Headless extractor + MCP/CLI callers. **0/5/8 → 0/0/0** |
| **CN-003** slice 3 | ✅ `15ed7794` this session | ✅ **driven** | Editor caller + the agreement check. ✅ **D3 discharged** |
| **CN-003** slice 4 | 📋 | — | Lesson-vocabulary routing. ⚠️ **HOT FILES — see §4** |
| CN-004 … CN-017 | 📋 | — | All blocked on CN-003 except CN-005/CN-007 |

---

## 1. Gate readings

All taken this session, at HEAD with slice 3 applied.

| Gate | Reading |
|---|---|
| `test:main` (editor jest) | ✅ **213 suites / 3323** |
| `@noodl/mcp` jest | ✅ **47 suites / 560** — 9 of them new here |
| `test:packages` | ✅ **14 projects**, all green |
| `catalog:check` | ✅ committed catalog up to date, **175 node types** (criterion 4) |
| `npx tsc --noEmit` (root, in CI) | ✅ 0 |
| `typecheck:editor`, `typecheck:editor-tests` | ✅ 0 each |

⚠️ **Both jest baselines moved by peers again.** `test:main` was 210/3266 in memory and is 213/3323
with my one suite in it; the mcp suite was 46/551 and is 47/560 with my one. **Re-measure; never
subtract from a handover's number.**

⚠️ **The first `test:main` run had one red** — `tests-unit/bld-004/reasoningChannel.test.ts`, a
wall-clock stall test — while a peer's `test:ci` was running. It passed alone and the whole suite was
green on re-run (18.9 s versus 44.8 s, i.e. the machine was loaded). Nothing it imports is anything
this session touched. Treat it as load-sensitive, not as a regression.

⚠️ **`test:ci` was not run here and did not need to be** — everything above is plain Node. A peer ran
it at seed 39393 during this session. The floor is **2843 / 6 @ 39393**; an editor launch *or*
teardown reaps it while npm still exits 0.

---

## 2. What slice 3 settled

### ✅ D3 is discharged, and the editor really does install the overlay

`validation/kitOverlay.ts` (map) + `validation/catalog.ts` (seam: `setCatalogOverlay`,
`catalogGeneration`, `projectCatalog`) + `NodeLibrary.loadLibrary()` (caller). Every consumer of
`loadDefaultCatalog()` — `SemanticValidator`, the Problems panel, the AI authoring gate, `docLint`,
the import engine — is kit-aware now.

🔴 **Measured in the running editor, not only in jest**, on `kit-app` copied out and opened, reading
`ProjectValidationService.instance` (the panel's own service):

| | errors | warnings | infos | **endpoints checked** |
|---|---|---|---|---|
| overlay removed (control) | 0 | 5 | **8** | **0** |
| after `NodeLibrary.instance.reload()` | **1** | 0 | 0 | **4** |

The error is `nonexistent-port … demo.kit.Badge has no input named "progres"`. The control was taken
by *removing* the overlay live, which is what makes the number attributable — and it also proves the
generation counter rebuilds the panel's long-lived validator.

### 🔴 The routes disagree about the kit's NAME, and nothing was comparing it

`compareOverlays` compares types and ports, not `kitModule`. Put side by side:

- **MCP route** → `'Demo Kit'`, read from `manifest.json`.
- **Editor route** → `'Unknown Module'`, for every kit. `registerModule` names a module from the
  object passed to `Noodl.defineModule` (`noodl-runtime.ts:517`) and **no kit sets that name** —
  not the fixture, not the cashflow reference kit. The manifest holds it; the viewer never reads it.

Measured with it: `nodeIndex.moduleNodes` had one entry whose `name` was the **empty string**, so the
picker's section for a project's own nodes is unnamed too.

**Asserted, not fixed** (`kitAgreement.test.ts`). It matters to ✅ **D1** — provenance in the property
panel currently reads "Unknown Module" — and to **CN-015**. 🔴 **Wants a task number**, and note the
fix is in whatever hands the viewer the manifest name, which is the deployed runtime's path too.

### What a green agreement check says

The two **registers** agree. It does **not** verify the mapping — both sides run the same one, on
purpose — and both share the runtime, the viewer's definitions and `generateNodeLibrary`. The editor
side is a **recording**
(`packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`), so it ages: a
change to the viewer's node definitions moves the live half and not the recorded one. **Re-record;
do not relax the check.** Its header says when, from what and how it was reduced.

### Knowingly not done

- **`CatalogIndex` provenance (CN-003 item 4).** `providedBy: 'project-kit'` and `kitModule` survive
  the merge and are readable through `catalogOverlayNodes()`, but no index query exposes them and
  nothing in the property panel reads them. D1's surface is still open.
- **No cache, still.** A kit edited mid-session is re-read in the editor on the next library reload
  but never re-extracted by the MCP server. → **CN-014**.

---

## 3. Still open, not caused here

- 🔴 **noodl-mcp's typecheck is red (8 errors) and runs in NO gate.** Unchanged this session.
  Seven of eleven `typecheck:*` scripts run in no CI job, and **`scripts/` is in none of them** — so
  `validate-project.ts` is typechecked by nothing. **Wants a task number.**
- 🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else**, including the
  start page's own `urlPath`. **Wants a task number before tier 4.**
- 🔴 **`checkParameterValues` has exactly one caller**, so neither `validate:project` nor MCP
  `validate_project` checks parameter values for *any* node, kit or built-in. **CN-004 is written as
  though there is one pipeline; there are two.** This is item 1 in §5.
- 🔴 **The kit name (§2).** New this session.

---

## 4. What to do next

### Slice 4 — lesson vocabulary. ⚠️ Coordinate before you open these.

Route the project-scoped catalog to `learningfolder.ts`, `lessonbundleverify.ts` and
`lessongrading.ts`. The verifier needs no change — `VerifyLessonOptions.vocabulary` is the injection
point, and `LessonVocabulary`'s constructor takes `(catalog, index)`.

✅ **One thing is already prepared.** `defaultLessonVocabulary()` now takes `shippedCatalogIndex()`
explicitly, so it does not half-inherit the open project's kits through a memoised pairing of
shipped *data* with an overlaid *index*. Slice 4 adds the deliberate route; it is not fighting an
accidental one.

⚠️ **A lesson bundle is graded before its project exists.** `verifyLessonManifest` runs at *install*,
against a manifest and no project. The vocabulary must be built from **the bundle's own project
files**, or the check answers about the wrong kit.

🔴 **These are the hottest files in the repo**, shared with P66 and P67. **Ping those sessions before
you open them**, and keep slice 4 in its own commit.

### Then CN-004

🔴 **Expect real breakage, and do not soften it.** D4 was ruled against the softer rollout knowingly.
The cashflow kit came out of slice 2b **completely clean** (0/0/0) — a fact about its 28 connection
endpoints that says nothing about its **26 parameter values**, which are still checked by nothing
anywhere. Do not read the clean run as the kit being verified.

---

## 5. Owed by Richard — ask before CN-004

1. **Widen the project gate to check parameter values?** The 26 unverified parameters on the cashflow
   kit nodes are unverified at project level *for everyone*, kit or built-in. CN-004 assumes turning
   the checks on in one place turns them on everywhere. It does not. **Scope call, not a fix.**
2. **The ungated typechecks** (§3).
3. **New: who owns the kit's name?** Fixing "Unknown Module" means giving the viewer the manifest
   name, which changes the deployed runtime as well as the editor. That is a slightly wider blast
   radius than a phase-69 task usually takes, and D1 depends on it.

---

## 6. Checkout conditions

Several sessions share this checkout; P66 was live throughout and P67 landed commits mid-session.

- ✅ **`git commit -m … -- <pathspecs>`, always. Never `git add -A`, never `git stash`.** Peer changes
  were present in `scripts/library/check.ts`, `dev-docs/tasks/phase-50-*`, `phase-65-*` and
  `phase-68-*` throughout, and none was touched.
- ✅ **Editor drives are negotiated on the peer sockets and it worked well this session** — a peer
  held the editor, asked for source saves to be held (a save recompiles → HMR → wipes injected CDP
  state), pinged at teardown, then took the free window for `test:ci`. Announce a launch *and* a
  teardown to whoever you announced to.
- ⚠️ Two fiber details cost time: React 18 puts the **root fiber on the container node itself**
  (`el.__reactContainer$…`, no `.current`), and the app boots on **ProjectsPage**, whose props carry
  `route.router`. The memory note describing the old `.current` walk is corrected.
- ⚠️ `packages/noodl-mcp/dist/` is **gitignored**; the suites build their own extractor from source
  per run (`buildKitExtractor` in `tests/helpers.ts`) rather than grading a stale artifact.
- Whoever you tell you are starting, tell you have stopped.
