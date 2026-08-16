# Phase 69 — next session

**Written 2026-08-16, session 3.** 🔴 **This file is a REWRITE, not an amendment.** It is overwritten
every session; if you find yourself prepending, rewrite it instead. Everything that outlives the
phase goes to memory, not here.

Read [TASKS.md](TASKS.md) and [RULINGS.md](RULINGS.md) first — all eight rulings are made and the
queue is empty, so nothing below is blocked on a decision. Then read
[CN-003](CN-003-THE-PROJECT-CATALOG-OVERLAY.md), which now carries the corrected build plan.

---

## 0. Where the phase is

| Task | Built | Verified | Note |
|---|---|---|---|
| **CN-001** | ✅ `ed28a03c` | ✅ | Render harness sees kits. `@nodegx/module-inject` extracted |
| **CN-002** | ✅ `378793bc` | ✅ | A skipped check says it was skipped. Baseline **0/5/8** |
| **CN-003** slice 1 | ✅ `f1663600` | ✅ | `@nodegx/kit-catalog` — the shared mapping, 26/26 |
| **CN-003** slice 2a | ✅ `d9346cc9` | ✅ | Headless extractor → `noodl-mcp/dist/kit-extract.cjs` |
| **CN-003** slice 2b | 📋 | — | **Next.** Wire the payload into `CatalogIndex` as the overlay |
| **CN-003** slice 3 | 📋 | — | Editor caller off `NodeLibrary.instance` + the agreement test |
| **CN-003** slice 4 | 📋 | — | Lesson-vocabulary routing. ⚠️ **HOT FILES — see §4** |
| CN-004 … CN-017 | 📋 | — | All blocked on CN-003 except CN-005/CN-007 |

---

## 1. Gate readings — with the tree, not just a commit

All taken at **HEAD `d9346cc9`, tree `32717de9`**, 2026-08-16.

| Gate | Reading |
|---|---|
| `@nodegx/kit-catalog` jest | ✅ **26 / 26** |
| `test:packages` | ✅ **14 projects**, all green (kit-catalog added to the scope) |
| `@noodl/mcp` jest | ✅ **45 suites / 529** |
| `catalog:check` | ✅ committed catalog up to date, **175 node types** |
| `validate:project` on cashflow | **0 error / 5 warning / 8 info** — the CN-003 acceptance number |
| `npx tsc --noEmit` in noodl-mcp | 🔴 **8 errors — PRE-EXISTING**, see §3 |

⚠️ **`test:ci` was not run this session and did not need to be.** Everything above is plain Node and
safe beside a live editor, which mattered: a P66 session had a `dev:debug` stack on 9222 for ~40
minutes of it. If you do run `test:ci`, the floor is **2843 / 6 @ seed 39393**, and an editor launch
*or* teardown reaps it while npm still exits 0.

🔴 **`cmd | tail; echo $?` reports the pipeline's exit code, not the command's.** That is how the 8
tsc errors above nearly got recorded as a pass this session. Redirect to a file and read `$?` on the
bare command.

---

## 2. What CN-003 settled, so you do not re-derive it

### 🔴 The spec asked for two mappings and one will do

The written spec had the MCP server shape kit nodes through `buildCatalog` while the editor mapped
from what the viewer sent. That is **two mappings for one set of facts** — the duplication this phase
exists to end, and a permanent generator of the very divergence D3 accepted as a risk.

Both routes produce the *same* input instead. `generateNodeLibrary` is what the viewer sends over
`sendNodeLibrary`, and a headless extractor calls the identical function on its own register. Editor
reads the payload it already holds; MCP produces one by spawning; **both hand it to
`catalogNodesFromNodeLibrary`**. `buildCatalog` is never touched, so acceptance criterion 4
(`catalog:check` is byte-for-byte) holds by construction.

⚠️ **What a green `compareOverlays` does NOT say.** It says the two *registers* agree. It does not
verify the mapping — the fixture tests do that. Do not quote a passing agreement check as evidence
the overlay is correct. The one run so far is weaker still: both paths share the runtime, the viewer
and `generateNodeLibrary`, so it says *the shipped bundle behaves like the dev spike*.

### 🔴 Where extraction code may live is decided by packaging

`scripts/` is outside every shipped package's `files`/`build.files` — P67's open F4 hole. An
extractor there works in a checkout and is **absent from the packaged app**. Runtime bundling is not
a way out either: a packaged app has no esbuild and no `packages/noodl-viewer-react/src`.

✅ The move, already made: a second entry point in `packages/noodl-mcp/build.mjs` emitting
`dist/kit-extract.cjs`, which `files: ["bin","dist"]` already ships.

✅ **Build-time imports from `scripts/` are fine** and are used — esbuild inlines them. It is
*runtime resolution* that does not ship. Those two are easy to conflate and the distinction is what
let `extractorBuildOptions` be shared instead of copied.

### Measured, with the instrument on every row

Headless extraction of the cashflow kit, this session, against the editor's own recorded reading:

| type | headless (08-16, measured here) | editor `NodeLibrary` (08-15, recorded elsewhere) |
|---|---|---|
| `Lane` | 9 in / 11 out | 9 / 11 |
| `Pill` | 23 / 14 | 23 / 14 |
| `BalanceStrip` | 16 / 10 | 16 / 10 |
| `DayAxis` | 12 / 8 | 12 / 8 |
| `DangerBanner` | 19 / 9 | 19 / 9 |

⚠️ The right column is a **recorded** reading from another session on another day — corroboration,
not a control. Slice 3 is what turns it into one.

**Timing: esbuild bundle 74ms, extraction run 104ms.** D3's no-on-disk-cache rule therefore costs
nothing, and the escalate-to-an-in-memory-cache clause is not a live concern.

**Both arms measured.** `cashflow-command-centre` → 5 types, 0 failures, 0 collisions against the 159
built-ins. `fix003-drive` (no kits) → 0 types, 0 failures — an empty answer, **not an error**.

### Knowingly absent, with owners

- **`parameterEncoding`** — derived by *driving* the node's hook; the payload cannot express it.
  Overlay entries carry `{ known: false, reason }`, never null-by-omission. → **CN-010**.
- **`ssr`** — in the register metadata, not exported by `generateNodeLibrary`. Left **absent**, which
  for an overlay node means *not assessed*, never *safe*. → **CN-013**.

---

## 3. Two findings this session did not cause and did not fix

### 🔴 `npm ci` could not install this tree — fixed, and worth knowing why nobody saw it

`noodl-editor/package.json` has declared `"@nodegx/module-inject": "*"` since CN-001, and
`package-lock.json` had **no entry for it at all**. package.json and the lockfile were out of sync,
which `npm ci` rejects by design. Fixed in `875af23f` with `npm install --package-lock-only` — the
lockfile without the node_modules churn, because several sessions are working in this checkout.

⚠️ **The fix folded in one change this session never wrote**: `packages/noodl-editor` 0.1.6 → 0.1.7
in the lockfile. Correct, long overdue, and now gated by being in a diff rather than by nobody
looking. **Add the lockfile entry in the same commit as any new workspace package.**

### 🔴 noodl-mcp's typecheck is red and runs in NO gate

`npx tsc --noEmit` in `packages/noodl-mcp` reports **8 errors** (`src/tools/disclosure.ts`, three
test files). **Pre-existing** — verified, not assumed: `'core'` was already in `ToolGroupId` at
`1332e0d1~1`, and the failing test files were last touched by an old canvas commit. The first
hypothesis blamed a peer's fresh commit and was **wrong**; checking took two minutes and saved a
misattributed peer message.

Why it sat unnoticed: the repo has **eleven** `typecheck:*` scripts and `.github/workflows/pr.yml`
runs **four**. `noodl-mcp` has its own `typecheck` script that no gate invokes, and `test:packages`
runs `test`, not `typecheck`. Same family as *a package in no gate runs no tests*, one level up.
**Wants a task number; it is not CN-003's.**

---

## 4. What to do next

### Slice 2b — the MCP caller. Start here.

Spawn `dist/kit-extract.cjs`, feed the payload to `catalogNodesFromNodeLibrary`, merge with
`mergeOverlay`, hand the result to `CatalogIndex`. Then:

- **Acceptance criterion 3 is the cleanest number in the phase.** Take the reading first —
  `npm run validate:project -- ".../cashflow-command-centre"` is **0 error / 5 warning / 8 info**
  today. The 8 `unknown-type-check-skipped` lines should go to **zero** and be replaced by real
  results. `tests-unit/cn-002/` is what notices if they vanish for any other reason.
- ⚠️ **Do NOT route it through the project validator alone.** `checkParameterValues` has exactly one
  caller, `authoredPreconditionDiagnostics`, so `validate:project` and MCP `validate_project` never
  check parameter values for *any* node. Two pipelines; CN-004 is written as though there is one.
- 🔴 **Verify against the packaged app, not the checkout.** "driven ≠ shipped" has already cost
  phase 66 a round. Also: a *registered* MCP server loads from `/Applications/…`, so a locally-built
  `dist/` is not what an agent is talking to.
- `Overlay.collisions` already carries a kit shadowing a built-in; CN-015 turns it into something a
  user sees. Do not let it become a silent override.

### Slice 3 — the editor caller

Build the overlay from `NodeLibrary.instance` (a read of state the editor already has — it extracts
nothing, per D3), then `compareOverlays` against the MCP route **in a test**. That is what upgrades
the corroboration table in §2 into a control, and it is the specific obligation D3 attached.

### Slice 4 — lesson vocabulary. ⚠️ Coordinate before you open these.

Routing the project-scoped catalog to `learningfolder.ts`, `lessonbundleverify.ts` and
`lessongrading.ts` (the verifier itself needs no change — `VerifyLessonOptions.vocabulary` is the
injection point).

🔴 **These are the hottest files in the repo.** P66's `43b2e521` touched `lessonverify.ts`,
`lessonformat.ts`, `lessonevalconditions.ts` and `noodl-mcp/src/lessons/authoringBrief.ts` *today*,
carrying P67 slice-4 work inside a P66 commit. **Ping the P67 session before you open them**, and
keep slice 4 in its own commit.

⚠️ **A lesson bundle is graded before its project exists.** `verifyLessonManifest` runs at *install*,
against a manifest and no project. The overlay must be built from **the bundle's own project files**,
or the check answers about the wrong kit.

---

## 5. Owed by Richard — ask before CN-004

1. **Widen the project gate to check parameter values?** The 26 unverified parameters on the cashflow
   kit nodes are unverified at project level *for everyone*, kit or built-in. CN-004 assumes turning
   the checks on in one place turns them on everywhere. It does not. **Scope call, not a fix.**
2. ~~**P67's F4 hole**~~ — ✅ **ALREADY RULED 2026-08-16: ship it, as UNI-012.** Do not re-raise it.
   Caught because a peer had updated the memory index while this session ran; the earlier draft of
   this file listed it as owed. Slice 2a's `dist/` entry point is a worked example of the shape
   UNI-012 needs, so **offer it to whoever picks UNI-012** rather than to Richard.
3. **The ungated typechecks** (§3). Seven of eleven `typecheck:*` scripts run in no CI job.

---

## 6. Checkout conditions

Several sessions share this checkout — P66 (session 35) and P67 were both live throughout.

- ✅ **`git commit -m … -- <pathspecs>`, always. Never `git add -A`, never `git stash`.** Four commits
  landed this session with nothing of a peer's swept, and a peer's commits interleaved cleanly.
- ⚠️ **`packages/noodl-mcp/tests/toolDisclosure.test.ts` was being edited by a peer as this file was
  written.** That is the MCP **token-budget** gate. 🔴 **And the budget is now understood as THREE
  budgets, not one**: the 8,280 / 57-free figure is the **RESIDENT** surface, so a tool added to an
  existing **deferred** group costs **0** — but anything reached by `applyPolicy()` becomes resident
  silently. **Re-read the test before planning CN-006 or CN-009's surface**; the framing this phase
  inherited ("57 tokens, three-way competition") is the wrong shape.
- A peer teardown notice arrived mid-session and was answered on the socket it came in on, with
  standing status. Do the same: whoever you tell you are starting, tell you have stopped.

---

## 7. Still live from the previous session

- 🔴 **`render-from-disk.js` answers `/` and `/index.html` and 404s everything else** — including the
  start page's own `urlPath` (`GET /home` → 404, measured twice, two sessions). So *anything* driven
  by `urlPath` is unmeasurable on every page, and a kit on a non-start page silently measures
  nothing. **Not fixed, wants a task number before tier 4.**
- 🔴 **The defect is rarely the one the spec describes, and it reads as a pass.** CN-001 predicted a
  blank; what happened was a page rendering everything *except* the kit node with `findings: []` and
  "Rendered clean". When a task says "X is unsupported", check whether X is reported as *fine*.
- ⚠️ **Run a spec's named fixture once before trusting it.** Two specs in this phase named controls
  that had never been run. Use **`cn001-kit-drive`** for kit render checks; `cashflow-command-centre`
  is v1 and `render-from-disk.js` exits 2 on it (though `validate:project` reads it fine).
- ⚠️ **For CN-010 and CN-014:** `node.dynamicports` is a **cache of what a runtime last pushed** — its
  presence implies nothing about rendering and its absence implies nothing either. The rendered
  property panel is the reliable readout of what is *declared*. An always-on `<webview>` runtime
  exists with no preview taken, and `cdp targets` does not list it — `curl :9222/json/list` does, so
  "nothing is running" can be an artefact of the tool.
- ⚠️ **A new package runs in no gate until you add it.** `test:packages` scopes **by name**. Both
  `@nodegx/module-inject` and now `@nodegx/kit-catalog` had to be added by hand.
