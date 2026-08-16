# Phase 69 — next session

**Written 2026-08-16, session 6.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty. Then read [CN-003](CN-003-THE-PROJECT-CATALOG-OVERLAY.md), whose slice log carries
the measurements, and **[CN-004](CN-004-TURN-THE-CHECKS-BACK-ON.md), which is next and is not
started**.

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** | ✅ `ed28a03c` | ✅ | Render harness sees kits |
| **CN-002** | ✅ `378793bc` | ✅ | A skipped check says it was skipped. Baseline **0/5/8** |
| **CN-003** slices 1–3 | ✅ | ✅ | Mapping, headless extractor + MCP caller, editor caller |
| **CN-003** slice 4 | ✅ `43fb9a32` `ffe680c4` | ✅ **driven** | Lesson vocabularies. ✅ **items 4 AND 5 done — CN-003 is complete** |
| **The kit name** | ✅ `f7da52d1` | ✅ | Fixed, not just asserted. ⚠️ one recording is stale — §3 |
| **CN-004** | 📋 | — | **Next.** Nothing blocks it. ⚠️ Read §4 before starting — its spec has a false premise |
| CN-005 … CN-017 | 📋 | — | CN-005/CN-007 were never blocked |

---

## 1. Gate readings

All taken this session, at HEAD with everything below applied.

| Gate | Reading |
|---|---|
| `test:main` (editor jest) | ✅ **214 suites / 3335** |
| `test:packages` | ✅ **14 projects**, all green |
| `@noodl/mcp` jest | ✅ **48 suites / 565** |
| `@noodl/noodl-viewer-react` jest | ✅ **69 suites / 899** |
| `@nodegx/module-inject` jest | ✅ **15** |
| `catalog:check` | ✅ up to date, **175 node types** (criterion 4 holds) |
| `typecheck:editor`, `typecheck:editor-tests` | ✅ 0 each |
| `npx tsc --noEmit` in `packages/noodl-mcp` | 🔴 **8 errors — the SAME 8 as last session**, none in touched files. Still in no gate |

⚠️ **Baselines move under you.** `test:main` was 213/3323 last session and is 214/3335 with my one
suite; the mcp suite was 47/560 and is 48/565. **Re-measure; never subtract from a handover's
number.**

⚠️ **`test:ci` was not run here and did not need to be** — everything above is plain Node. A peer ran
it during this session and reported **2843 / 6 @ seed 39393**, six failures unchanged by name. An
editor launch *or* teardown reaps it while npm still exits 0.

---

## 2. What this session settled

### ✅ CN-003 is complete. Slice 4 routed three vocabularies, not one

`projectLessonVocabulary()` (the open project, memoised on `catalogGeneration()`),
`bundleLessonVocabulary()` (a directory that is *not* it, from its own kits), and the unchanged
shipped one. `gradeLesson`'s bare `verify: true` now means *against the open project*.

🔴 **The trap named three files; the leak was in a fourth.** `lessonprojectcontext.ts` defaults its
`catalog` to `loadDefaultCatalog()`, so between slices 3 and 4 a bundle installed while a kit project
was open had its nodes' ports answered by **that project's kit**. Measured, then fixed:

| | then | now |
|---|---|---|
| a lesson naming the OPEN project's kit node, `gradeLesson(verify)` | `unknown-node-type` **error** | clean |
| a bundle's node ports, with a kit project open | **the open project's kit** | the bundle's own, or none |
| a bundle carrying the kit it teaches, at install | refused: *"is not a node type"* | refused, and it says **why it cannot tell** |

### 🔴 Only the MCP server can read a bundle's kits, and both rulings agree

`extractProjectOverlay` takes **any** project directory and a bundle is one — so
`lessons/bundleVocabulary.ts` reads the bundle's own kits where bundles are written and scored. The
editor cannot: ✅ **D3** puts extraction in one process, ✅ **D6** puts consent before running a
downloaded bundle's kit code, and *a gate that runs the code to decide whether the code may run has
no gate in it*.

Driven on the **packaged** `dist/noodl-mcp.cjs` over real stdio, with its control:

| | F1 | reported |
|---|---|---|
| bundle **with** its kit | **pass** | `kits: [Demo Kit]`, both node types |
| same bundle, kit removed | **FAIL** | `"demo.kit.Badge" is not a node type` ×2 |

### ✅ Richard ruled: an unresolvable kit type still BLOCKS install

Asked and answered 2026-08-16. Only the *claim* was fixed — the refusal no longer asserts "there is
no such node type" about a bundle that ships the kit declaring it. **Do not soften this** without
re-opening it; the alternative was measured and named (a typo'd kit lesson reaching a learner).

### ✅ The kit name is fixed

`registerModule` named a module from the object a kit passes to `Noodl.defineModule` — and no kit
sets that name, so every kit node in the editor was `'Unknown Module'` and the picker's own-nodes
section was headed by the empty string. `@nodegx/module-inject` now sets `window.__noodl_module_name`
immediately before each kit's script tag and the three bootstraps adopt it in `defineModule`.

🔴 **The capture must be in `defineModule`, not `registerModule`** — by the time the runtime walks
`__noodl_modules` the global holds the *last* kit's name. There is a two-kit test that fails if
someone "simplifies" this.

### ✅ CN-003 item 4 — provenance is queryable

`CatalogIndex.isProjectKitType()`, `kitModuleOf()`, `projectKitTypeNames()`. 🔴 `hasType()` is true
for both kinds and **nothing may branch on these to check a kit node less** (D4, P1). They exist so
D1's property panel and CN-015 can *say* where a node came from.

### 🔴 A test of mine was green against a restored defect

The bundle fixture used `App:%…` where a component's legacy name is `/App`, so every condition read
false and the leak test passed under mutation — a failure indistinguishable from the mechanism being
absent. **All five fixes in this session are mutation-proven in both directions**, which is the only
reason that was caught.

---

## 3. Owed, and small

- ⚠️ **Re-record `packages/noodl-editor/tests-unit/cn-003/fixtures/kit-app.editor-nodelibrary.json`.**
  Its `kitModule` still reads `'Unknown Module'`; `kitAgreement.test.ts` asserts that and is now
  marked **a fossil in place**, with the note that it is a dated measurement. Re-recording costs a
  **viewer build and a drive** — the editor loads its bootstrap from `src/external`, which is
  gitignored build output of `noodl-viewer-react/static`. After it, the expectation becomes
  `['Demo Kit', 'Demo Kit']`.
- ⚠️ **The kit-name fix is unverified in the running editor** for the same reason. The injector half
  and the runtime half are each tested and mutation-proven; what has not been observed is the two of
  them meeting in a built viewer.

---

## 4. What to do next — CN-004, and read this first

🔴 **CN-004's spec has a false premise and says so nowhere.** It is written as though turning the
checks on in one place turns them on everywhere. There are **two pipelines**:

- `checkParameterValues` has **exactly one caller**, so neither `validate:project` nor MCP
  `validate_project` checks parameter values for *any* node — kit or built-in.
- The cashflow kit came out of slice 2b **completely clean (0/0/0)**. That is a fact about its **28
  connection endpoints** and says nothing about its **26 parameter values**, which are checked by
  nothing anywhere. **Do not read that clean run as the kit being verified.**

**Item 1 in §5 is the scope call this raises and it is still open** — see below.

🔴 **Expect real breakage and do not soften it.** D4 was ruled against the softer rollout knowingly.

⚠️ **The lesson path is stricter than the path D4 reasoned about**: there `unknown-node-type` is an
**error** (class F1) and blocks install for every provenance, not a warning promoted under
`--strict`. Slice 4 leaves that deliberately blocking (Richard, above).

---

## 5. Owed by Richard — ask before or during CN-004

1. **Widen the project gate to check parameter values?** The 26 unverified parameters on the cashflow
   kit nodes are unverified at project level *for everyone*, kit or built-in. **Scope call, not a
   fix.** Unchanged from last session.
2. **The ungated typechecks.** noodl-mcp's is red (8) and runs in no CI job; seven of eleven
   `typecheck:*` scripts run nowhere, and **`scripts/` is in none of them**, so
   `validate-project.ts` is typechecked by nothing. Unchanged.
3. ✅ **Answered 08-16:** who owns the kit's name → fixed this session, in the injector and the three
   bootstraps. ✅ **Answered 08-16:** the install gate keeps blocking.

Also still open and not caused here: 🔴 **`render-from-disk.js` answers `/` and `/index.html` and
404s everything else**, including the start page's own `urlPath`. **Wants a task number.**

---

## 6. Checkout conditions

Several sessions share this checkout; peers were active in `phase-50`, `phase-65`, `phase-68`,
`scripts/library/check.ts` and `packages/noodl-editor/scripts/aix002-measure/` throughout, and none
was touched.

- ✅ **`git commit -m … -- <pathspecs>`, always. Never `git add -A`, never `git stash`.** Untracked
  files were added and committed in one chain with the message already in a file.
- ✅ **No editor was launched this session** — everything is plain Node, so no drive negotiation was
  needed and no peer's `test:ci` was at risk. A peer announced its own `test:ci` completion and
  released a hold; nothing was owed back.
- ⚠️ `packages/noodl-editor/src/external` is **gitignored build output** of
  `packages/noodl-viewer-react/static`. Edit the tracked source; the copy regenerates. Three
  `defineModule` bootstraps live there (viewer, deploy, ssr) and all three needed the same one line.
- Whoever you tell you are starting, tell you have stopped.
