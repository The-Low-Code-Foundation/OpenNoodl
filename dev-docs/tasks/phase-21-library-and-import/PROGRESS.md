# Phase 21 Progress — Library & Import Overhaul

**Created:** 2026-07-25, from the code-level library/import investigation (findings recorded in the [README](./README.md))
**Overall status:** 🟡 In progress — **all six tasks now have code; every remaining residual is live-editor verification.** As of the 2026-08-02 parallel batch (merged `422b4cd`): LIB-006 is built (8 commits — and it found the spec's central premise stale); LIB-002's and LIB-003's *headless* halves are closed; LIB-005's dead-CSS sweep and LIB-001's artefact verification are done. Gates on the merged tree: root typecheck **0** (it was 18 — see the cross-cutting note below), `library:check` **58/58**, `tests-unit` **154/154**, Jasmine **2017 specs / 0 failures**.

**Update, later the same day — the live pass ran. LIB-001 and LIB-005 are now Complete** (4 of 6 tasks done; see [LIB-005-NOTES.md](./LIB-005-NOTES.md) §10). Criterion 5 met, QA-3 discharged in full, QA-4's core guarantee confirmed, the reachable half of QA-6 clean. Jasmine **2077 / 0**.

🔴 **And it found the phase's most serious defect, which the suite could not have caught.** `applyModelChanges` gated eviction of a colliding component on `existingComponentId !== undefined`, conflating *"no such component"* with *"exists but carries no id"* — so an **overwrite appended a duplicate instead of replacing**. Every real project has exactly one id-less component: its root. Measured across five of Richard's projects — 76/77, 74/75, 1/2, 11/12, 333/334 carry ids, and the missing one is `/App` every time. So importing any project into any other and accepting the default Overwrite on the root collision **duplicated the target's root component**. Fixed `ebf5f05f` with a regression spec, re-verified live. The reason no spec caught it is the durable lesson: `FakeTarget` keyed its components by id, so *"exists without an id" was unrepresentable* — **a fake that cannot express a state leaves that state untested, however green the suite is.**

What remains is content work only: **LIB-002's visual restyle pass** and **LIB-003's per-module exercise on both React pairings (0 of 29)**. Neither is blocked on code. Two QA-6 steps are unreachable by design — no import entry point has a directory chooser.

**Update 2026-08-03 (`789dc073`):** residual E is closed — `views/ImportFlow` now carries `data-test` hooks throughout, so the next QA pass is mechanical rather than text-and-class archaeology. LIB-002's two deliberate colour shifts are **measured and decided on the numbers** (see the log): the pills icon is fine, the `table` divider should move to `Grey - 500`. A live install from the local `library-dist` confirmed LIB-002's tokenisation survives a real install (10/10 tokens, 12/12 components on disk). 🔴 **One new defect, unfixed:** every import — including a clean first-party prefab install — writes `IMPORT-REPORT.md` + `import-report.json` into the user's project, because `apply.ts` gates the write on `if (legacyReport)` while `ResultStage` gates its banner on `recommendation !== 'proceed'`. **The visual render check and the 0-of-29 module exercise still did not run**, this time because a concurrent session's in-flight edits to 29 shared files were not compiling.

⚠️ **Cross-cutting defect found by this batch: the root typecheck had been red for 960 commits.** `npm run typecheck` failed with 18 `TS2307`s because SUB-007 (`d0b989fa`, 2026-07-24) declared the `@noodl-versioning` path mappings only in `packages/noodl-editor/tsconfig.json`, never in the root. `.github/workflows/pr.yml` *does* gate on it — but since all work goes straight to cline-dev unpushed, that workflow has never run. Fixed here (two mappings). The lesson is about the gate, not the mappings: **a CI gate that no workflow execution ever reaches is indistinguishable from no gate.**

## Status vocabulary

Not started · In progress · Built–not wired · Complete · Superseded

## Tasks

| Order | ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|---|
| 1 | LIB-001 | Library source of truth & delivery pipeline | **Complete** | 4–6 days | Pipeline + 55-entry seed + editor changes shipped. **2026-08-02:** new `npm run library:verify-dist` serves `library-dist/` over loopback and drives the editor's *own* `fetchModules`/`isModuleCompatible` rather than re-implementing the contract — all 58 entries pass, and mutating the dist produces six distinct failures, so the green is not vacuous. **One real defect found and fixed:** step 0's error path missed a **200 carrying a JSON object** (CDN `NoSuchKey`, half-published index) — it parsed, set `modulesStatus='loaded'` with a non-array, and since `NodePickerSearchView` guards every branch on `Array.isArray` it rendered no grid, no spinner and **no error**. That is precisely the silently-blank library step 0 exists to abolish, reachable by the likeliest CDN misconfiguration. **Criterion 5 MET live 2026-08-02** (see [LIB-005-NOTES.md](./LIB-005-NOTES.md) §10): the editor adopted `http://localhost:3000`, prefab icons resolved to the versioned `library/prefabs/date-picker-1.3.0.png`, and two prefabs plus one module installed from the locally served `library-dist` and landed on disk. **LIB-001 is done.** |
| 2 | LIB-002 | Prefab audit, repair & restyle | In progress (**headless half DONE**; visual pass open) | 1.5–2 wks | **2026-08-02 (`93b42c6b`): the headless repair half is closed.** 29 colour values across 13 prefabs tokenised, and the checkable result is that **zero opaque hex colours remain on any node parameter in any of the 29 prefabs** — the 12 survivors all carry alpha and are exactly the charter-permitted class (transparent placeholders, scrims, shadows). All five named folder-hygiene defects fixed (stripe's `/Tab Bar` namespaced, supabase's doubled `#Supabase Prefab/Supabase Prefab` collapsed across 145 refs, xano's trailing space and `#XanoPrefab`, `Pill item` case). Verified independently by the orchestrator: **127 component references across all 29 prefabs, 0 dangling, 0 spacing/doubling defects**; `library:check` 58/58. `oauth2`'s version carried LIB-003's seeder bug (`2.0.2` → `0.2.0`, fixed `ace2af36`). **Two style-system limitations found, reported not fixed (both in `packages/`):** α-over-token is *not expressible* — `resolveColor` is a name→value lookup with no alpha form, so a tint genuinely cannot track its token; and **text styles cannot reference colour tokens at all** — `setStyles` emits `styles.text[*].color` straight to CSS without `resolveColor`, so every prefab's text styles still hold `#000000`. Residual (needs editor): visual confirmation — **two edits deliberately shift a colour** rather than swap an exact value (`#B4B4B4`→`Grey - 400` on table's divider, `#3E3E3E`→`Grey - 700` on the pills icon) — plus icon regeneration (three inconsistent size families ship today; `media-query` a 1326×674/101 KB outlier), install console-cleanliness on React 18+19, and consolidation decisions. Spacing/radius re-layout deliberately not attempted headlessly: those are numeric parameters whose visual role cannot be read from JSON. Earlier: static audit (2026-07-25, `bd276a1`): full 29-prefab `library/prefabs/AUDIT.md` (triage keep 14 / fix 15 / retire 0), style charter, per-prefab hard-coded-colour + collision-risk + folder-hygiene findings, 27 `library.json` metadata fixes, `library:check` 29/29 clean. Residual tail (needs primary-checkout editor): open/exercise/restyle/re-save each prefab, fix folder-hygiene defects, regen icons, live install console-clean on React 18+19, consolidation decisions. |
| 3 | LIB-003 | Module audit, hygiene & expansion | In progress (**headless half DONE**; 0/29 exercised live) | 1–1.5 wks | **2026-08-02 (`78d802be`): the measured per-module audit is done** — each bundle run in a browser-shaped `vm` sandbox with a `Noodl` stub recording registrations, 25 of 29 captured. **Three stale premises in the 2026-07-25 audit, all its own:** (F1) `image-cropper` and `panning-and-zooming-control` ship **no `index.js` at all** — their entire `noodl_modules` is an iconset manifest — and `shake-detector` has **no `noodl_modules` folder whatsoever**; all three register **zero nodes** and are prefabs wearing a module label. (F2) **`material-icons` is bundled 4× in 2 incompatible versions** — 2122 glyphs standalone vs 1865 in the three bundlers, and *neither is a subset* (77 glyphs one way, 334 the other), so installing one over the other changes the icon picker's contents in **both** directions. Orchestrator-verified to the glyph. (F4) `inferVersion` matched only dash-separated tails, so `pdf-viewer-1.0.0`→`0.0.0` and `shake-detector-1.0.2`→`2.0.0` — **fixed**, 7/7 cases, and the same bug found in `oauth2` (fixed on the LIB-002 branch). Also fixed: the 3 placeholder icons (authored to the *measured* house style; the QR is a genuine code from the module's own vendored generator), and Lucide's licence banner, which claimed a fabricated copyright and dropped the Feather/Cole Bemis portion. Deploy-injection harness: 29 projects × 3 prefixes, 75 refs, **0 problems** — the first exercise of the `startsWith` fix on real content. **Recorded not fixed:** F2/F3 collisions; ~9 seeded modules vendor large third-party libs with no licence text — **Mapbox is the sharp one, `mapbox-gl` v2+ is proprietary, a legal question independent of the API-key policy**; the 3 new modules' `docsPath` **404s** and is not fixable in `library.json` (`build.js:101` falls back to the same path — they need real docs pages, ALPHA-006 territory). Catalog integration for module nodes **re-confirmed non-existent**: the generator has zero references to `noodl_modules`/`defineModule`, and 0 of the 25 measured node types appear in either catalog artefact. Residual (needs editor): **both React pairings for any module — 0 of 29**; registration for `avatar`, `chart-js`, `mapbox`, `simple-tooltips` is still *unknown* (their bundles need real React/DOM) and they are the priority. Earlier: plumbing+inventory half (2026-07-25); **expansion + docs half DONE** (2026-07-25, merged `beaeca4`): 3 shortlist modules authored — `lucide-icons` (ISC iconset, 1998 glyphs), `qr-code` (MIT, visual node), `confetti` (MIT, trigger node), each self-contained/no-build; `library/modules/README.md` authoring docs; `library:check` 58/58 clean, `catalog:check` green. **Catalog integration for module nodes confirmed non-existent** (chart-js absent too) — nodes take SUB-004's dynamic skip path (residual, not invented). Residual tail: live per-module audit of all 26 existing (both React pairings, preview+deploy), live preview/deploy verify of the 3 new modules, replace placeholder icons, deploy-build check of the scanner refactor. |
| 4 | LIB-004 | Import engine v2 | Built–not wired (code complete; live-verify pending) | 1–1.5 wks | Full three-stage engine (`analyze`+`plan`+`apply`) built & typed; `projectimporter.js` DELETED; all 5 call sites migrated behind a strangler adapter (**adapter now deleted too — LIB-005**); v2-format fixture + parity test added. Verified: typecheck (editor + editor-tests) clean, 18 headless assertions green (apply id-semantics/skip/rename/styles + v2 inventory parity). **The Electron characterization suite has now been run (LIB-005, 2026-07-26) and is green** — it found three defects on the way, two in the engine (resource/module `reason`; text styles never pulled their font) and one in the suite itself (a fixture it corrupted, and an assertion that had never executed). Residual: live-editor pass of the 5 flows, now folded into LIB-005's live-QA checklist |
| 5 | LIB-005 | Import experience overhaul | **Complete** (all reachable QA executed; 2 steps unreachable by design) | 1.5–2 wks | ⚠️ **This row previously read "zero visual verification", which was stale from 2026-07-26 onward** — four live passes ran that day and shipped three fixes (`307662bf` a rename colliding with itself, `2d4893d4` a renamed component's instances not following the rename, `11c937ca` an export falsely claiming it changed your project). The accurate record is [LIB-005-NOTES.md](./LIB-005-NOTES.md) §§ from "Live QA executed". **2026-08-02:** the `.import-popup-*` dead-CSS sweep (residual 2) is done — 8 rules / 9 selectors deleted, each with evidence, and `.show-on-edit` deliberately **kept** because `git log -S` dates it to PLAT-002's pickers, not the import popup. Note the file is `packages/noodl-editor/src/assets/css/style.css`, **not** the `src/editor/src/assets/…` path this doc and NOTES §8 both claimed. **Newly filed:** `views/ImportFlow` has **zero `data-test` hooks** across all six components — every QA pass has had to drive it by class name and text, which is a large part of why §7 has been so expensive to discharge. **2026-08-02: QA-3 (all five steps), QA-4 and the reachable half of QA-6 executed live — see [LIB-005-NOTES.md](./LIB-005-NOTES.md) §10.** They found the phase's most serious defect: **an overwrite duplicated any component that has no id**, and every real project has exactly one — its root `/App` — so importing any project into any other and taking the default Overwrite duplicated the target's root (fixed `ebf5f05f`, regression spec, Jasmine 2077/0, re-verified live). QA-6.1/6.3 are **not reachable from the shipped UI**: all three import entry points take a library entry, a known local project, or a URL, and **none uses a directory chooser** — the checklist assumed an affordance that does not exist. QA-6.4 (Escape) is not faithfully testable headlessly, since a synthetic KeyboardEvent is not trusted input. **The design record:** new `views/ImportFlow` surface (Select → Review → Done) over LIB-004's `analyze`/`plan`/`apply`. Closure is **derived, never stored**, so an unsatisfied selection is unrepresentable (AIX-003's rule, not its code — see NOTES §3). Collisions resolved inline — skip/overwrite/rename — with SUB-007's `ComponentDiffView` one disclosure behind a `summarizeChanges` roll-up. All five entry points converged; `importpopup.ts`, `ImportPopupView.tsx` and LIB-004's `legacyAdapter.ts` **deleted**; the characterization suite ported onto the engine API. **Thumbnails not shipped — `noodl-preview` cannot render images (finding, not a shortcut; NOTES §3).** |

| 6 | LIB-006 | Legacy project import — best effort, honest report, AI repair | **Built** (2026-08-02, `422b4cda`; criterion 4 open) | 1–1.5 wks | **8 commits, inventory committed first as the spec required.** Outcome taxonomy + import-report schema + rebuild verdict (pure cores); a `legacy-import-placeholder` validator rule at **error** severity; assessment wired into `apply()` and surfaced on the result screen; assistant hand-off via `ContextBuilder.importReport()` + MCP `get_import_report`; acceptance fixtures with committed reports. **154 `tests-unit` tests green** (86 new). **The finding that reshapes the task: the spec's central premise is stale.** PLAT-003 kept every deprecated node *registered* rather than deleting it, and **no legacy Noodl node type was ever removed during the revival** — orchestrator-verified: of 26 deleted node files in history, 19 were `.js`→`.ts` renames and **6 of the remaining 7 are `byob-*`** (pre-BCN-004 NodeGX, not Noodl), the 7th a helper. Across the 60 complete legacy projects in this repo, 136 distinct type strings resolve except three, all module-provided. So a Noodl 2.x graph imports as `converted` almost in full; the real unconvertible surface is **modules, backend config and user JavaScript**. The machinery is right; what it fires on is not what the spec expected. **Load-bearing deviation: there is no placeholder node *type*.** The unconverted node is left exactly as authored and gains a `metadata.legacyImport` marker — rewriting it would destroy what a repair needs most, break the case where a module later supplies the type, and add a runtime node type phase 21 excludes; `UnknownNodeType` already gave "visible on canvas with type and parameters", and the missing half was the validator, which is what was built (so `unknown-node-type` keeps its correct `warning` severity while the stronger claim gets `error`). **Open: Success Criterion 4** — the hand-off is wired and unit-tested on both surfaces, but no model was called, so "an assistant repairs a real construct as a reviewable diff" is undemonstrated. Also untested: the composed `apply()` path against a real `ProjectModel` (the largest untested seam). Originally added 2026-07-30 as the counterpart obligation to [`COMPATIBILITY-POLICY.md`](../../reference/COMPATIBILITY-POLICY.md). The policy says legacy Noodl projects are not a design constraint and the fallback is "the user's AI assistant fixes it, or they rebuild"; this task makes that fallback real — outcome taxonomy, a committed machine+human import report, visible placeholder nodes that the semantic validator errors on, the cheap mechanical conversions, and a wired hand-off to AIX-002's diff review. **Step 1 is a committed inventory table, not code**, and it is also the scope boundary against this quietly becoming a fidelity project. |

## ✅ RESOLVED — the "overwrite-import drops child nodes" scare (`d97505c`, retracted)

Recorded because the wrong diagnosis is the instructive part.

Running the owed Electron suite on 2026-07-26 produced `Expected 1 to be 4` in the
id-re-keying characterization spec. The orchestrator filed it as a **data-loss
regression in the import engine** — reasoning that the spec was written against
the legacy importer, that the only edit across the engine swap was the `require`
line, and that it therefore had to be the engine. That reasoning was wrong, and
"reproduced across two seeds" gave it false confidence: a test that is
unconditionally broken also reproduces perfectly.

**The actual cause, found by LIB-005:**

```js
after.forEachNodeRecursive((n) => afterIds.push(n.id));
```

`forEachRecursive` treats a **truthy callback return as "stop"**, and
`Array.push` returns the new length. The implicit-return arrow therefore
short-circuited after the *first* node, pinning `afterIds.length` at 1
permanently. The spec could never have passed in any engine. It had simply never
run — LIB-004's Electron pass was blocked by the worktree/lerna trap — so nobody
found out.

No child nodes were ever lost. The engine was never at fault. The correct count is
**5**, not 4: `forEachRecursive` also descends *through* a component instance into
its graph, so `/comp1`'s own root is included — which incidentally observes the
"references in imported components resolve post-import" contract first-hand.

**Two things worth keeping:**

- `forEachRecursive`'s truthy-return-stops contract is a live trap. Braces, not
  implicit returns, in any callback that ends in `push`.
- An assertion that has never executed is not evidence, however old it looks. The
  gate is `npm run test:ci` in `packages/noodl-editor` (~3 min, needs Electron),
  and it is non-optional for anything touching the import engine.

## ⚠️ OPEN — the same spec is order-dependent, and that is incident three

Found 2026-07-28 by the cross-phase defect batch, which ran `test:ci` four times
over the course of one merge sequence.

`re-keys imported node ids while reusing the target component id
(characterization)` **fails or passes depending on the randomization seed, on an
otherwise identical tree**:

| Seed | Result |
|---|---|
| `63183` | `Expected 8 to be 5` |
| `07241` | pass |
| `69768` | pass (with batch A+B+C+D merged) |

So the count is not 5-vs-4 as the retraction above concluded, nor 8 — it is
*whatever earlier specs left behind*. The spec assigns `ProjectModel.instance`
and mutates `tMain.id`, and it copies `tests/testfs/import_proj2` into a temp
dir while a sibling spec (`ignores .git`) writes into and deletes from
`tests/testfs/` directly. Under a randomized order those interact.

**This is the third diagnosis of this one assertion, and the first two were both
confident and wrong.** It was filed as engine data loss (retracted above), then
as a `forEachRecursive` truthy-return bug — which was real and *is* fixed, but
was not the whole story, because fixing it left a spec that still only passes on
some orders. The lesson the retraction drew ("an assertion that has never
executed is not evidence") needs a second clause: **an assertion that passes
once under a random order is not evidence either.** For a spec that mutates
global state, pass/fail on a single seed says nothing.

Not fixed here — it is a test-isolation defect, not an engine defect, and it sits
in LIB-004's characterization suite rather than in this batch's territory.
Whoever takes it should make the spec own its fixtures (copy to temp, never read
through `require`'s module cache, restore `ProjectModel.instance`) rather than
pin the expected count to a number that happens to hold on one seed. Reproduce
with `npm run test:ci` and seed `63183`.

### — FIXED 2026-07-28 (`e40851ba`)

Reproduced first, as instructed. At seed `63183` on the tree at `f2d1de98` it
failed as **`Expected 10 to be 5`** — not the `8` recorded above. That is the
finding: DEBT-005's NodeLibrary `beforeEach` (`25a73534`, already merged when
the batch measured `8`) narrowed the failure without removing it, and an
assertion that reads **4, 5, 8 and 10** on different orders was never measuring
a contract.

**Why no expected value could have worked.** `forEachNodeRecursive` descends
*through* a component-instance node into whatever its `type` resolved to, and
`NodeGraphNode.type` is `NodeLibrary.instance.getNodeTypeWithName(typename)` — a
singleton, resolved against the current `ProjectModel.instance`. The count was a
function of global state by construction. Both earlier fixes were real and both
were partial because they treated symptoms of that.

The spec now asserts the three things the characterization exists for, each over
its own state only:

1. the overwrite reuses the **target** component's id;
2. `/Main`'s own graph is re-keyed afresh — counted with `forEachNode`, which
   does **not** descend, and expected against the fixture's own node count
   rather than a literal, so editing the fixture cannot silently pass;
3. the `/comp1` reference still resolves to a component after import.

Isolation, both halves:

- **the source project is copied to temp too.** It was read through
  `require('../testfs/import_proj1/project.json')`; `require` caches by path, so
  whether `srcNodeIds` described the bytes on disk depended on which spec loaded
  it first — while the sibling `ignores .git` spec writes into `tests/testfs/`
  directly.
- **an `afterEach` restores `ProjectModel.instance`.** Nearly every spec in the
  file assigned the global and none put it back, so the next spec file inherited
  a half-imported project. This is the coupling the NodeLibrary fix could not
  reach, because type resolution reads the current project as well as the library.

**Reproducing an order is no longer a file edit.** `SpecRunner.html` reads
`NOODL_SPEC_SEED`, so `NOODL_SPEC_SEED=63183 npm run test:ci` replays an order.
The old instruction ("pin it here temporarily") invited committing a pinned seed.

Gate: **1731/0** on seeds `63183`, `07241`, `69768`, and one unpinned (`88162`).
Four orders, because the lesson above cuts both ways — one passing seed is not
evidence for a spec that mutates global state.

**New observation, filed not asserted.** Writing assertion 3 as object identity
first showed that after an import, an instance node's `type` resolves to the
`/comp1` `ComponentModel` owned by the **source** `ProjectModel` that
`analyzeSource` loaded for analysis (`owner.name === 'proj1'`, retained directory
`tests/testfs/import_proj1`) — not the one `apply` put in the target project. The
graphs are identical so nothing visibly breaks, but the imported graph holds a
live reference into a project object that should have been discarded: a retention
leak of the [[DEBT-014]] kind, and a latent hazard if `/comp1` is later edited in
the target. The spec asserts `type.name` rather than identity so that it pins
neither the current behaviour nor an unproven claim about what it should be.
Wants its own investigation.

**Investigated 2026-07-28 (static read). The stated mechanism does not hold —
but the observation is not thereby explained, so this stays open.** Four things
in the code contradict "a live reference into the project `analyzeSource`
loaded":

1. **`analyzeSource` retains nothing.** It resolves `project.toJSON()` — plain
   data. The `ProjectModel` it built is unreachable once the callback returns.
   `AnalyzedSource.project` is `ProjectData`, not a model.
2. **`apply` does not use analyze's project at all.** It calls
   `projectFromDirectory(plan.sourceDir, …)` and loads its *own* source. So even
   a leak in analyze could not be what `apply` grafts from.
3. **The graft re-parents.** `ProjectModel.addComponent` sets
   `component.owner = this` before anything else, so a component that has been
   through `target.addComponent` has the **target** as its owner by construction.
4. **A throwaway source is unreachable from the type system.**
   `NodeLibrary.getNodeTypeWithName` resolves through `getComponents()`, which
   reads *registered modules only*, and the sole `registerModule(project)` call
   site in `src/` is the `ProjectModel.instance` setter. A source project loaded
   for import is never `ProjectModel.instance`. `NodeGraphModel.updateTypes()`
   independently bails unless its owner is a registered module, then re-resolves
   every node's type through that same path.

So `owner.name === 'proj1'` cannot be produced by the route the note describes.
The likeliest remaining explanation is **spec-environment global state** rather
than import logic — `NodeLibrary.instance` is a singleton with a name-keyed
`typeCache`, specs assign `ProjectModel.instance` freely, and this file already
records three specs that passed or failed on what ran before them. That is a
hypothesis, not a finding.

**How to close it properly, since this is reproducible in a spec and does not
need a live editor:** restore the identity form of assertion 3, run the suite on
several seeds, and if it reproduces, log `NodeLibrary.instance.typeCache.get(
'/comp1')` and `isModuleRegistered` for both projects at the assertion. If it
only reproduces on some orders, it is the singleton and not the importer — and
the fix belongs to test isolation, not to `apply`.

**One real thing found on the way, worth its own line:** `ProjectModel.fromJSON`
→ `addComponent` fires `NodeLibrary.instance.notifyListeners('typeAdded')` on
the **global** singleton for every component, including those of the throwaway
source projects that analyze and apply each load. Every `NodeGraphModel` in the
open project answers that with `scheduleUpdateTypes()`. No listener retains the
payload (all four call sites ignore it and just reschedule), so it is **not** a
retention leak — but importing a large project makes the target graph re-resolve
all of its types once per source component. A performance smell, not a
correctness bug. Not fixed; recorded so the next person does not re-derive it.

**CLOSED 2026-07-28 — measured, and the observation was an artefact twice over.**
The static read had refuted the *mechanism* but left the observation
(`owner.name === 'proj1'`) unexplained. Restoring the identity form of assertion
3 with diagnostics, over seeds `63183` / `07241` / `69768`:

| seed | `type === target /comp1` | `type.owner.name` | target `owner.name` | `typeCache('/comp1') === target` |
|---|---|---|---|---|
| 63183 | **false** | proj1 | proj1 | true |
| 07241 | **true** | proj1 | proj1 | true |
| 69768 | **false** | proj1 | proj1 | true |

Two independent findings, either of which alone closes it:

1. **`proj1` never identified the source project.** `import_proj2` — the
   **target** fixture — was *also* named `"proj1"`. Both sides therefore
   reported the same owner name, so the original evidence could not distinguish
   "the source project analyze loaded" from "the component apply just grafted
   in". The inference had nothing under it. The fixture is now renamed to
   `proj2` so this cannot mislead a third investigation.
2. **Identity is order-dependent** — false, true, false across three seeds. That
   is exactly the discriminator the note itself prescribed: *"if it only
   reproduces on some orders it is test isolation, not the importer."*

What is **stable on every seed**: `NodeLibrary.instance.typeCache.get('/comp1')`
is the *target's* component. So `getNodeTypeWithName` resolves correctly and the
import contract holds. What varies is only whether `instanceNode.type` had
already latched a type object from an earlier resolution — NodeLibrary is a
singleton, and these specs assign `ProjectModel.instance` freely.

So: **no retention leak, and nothing for `apply` to fix.** The spec now asserts
the stable half (`typeCache('/comp1')` is the target's component) and still does
not assert identity, because identity is a property of spec order. The
misleading comment has been replaced with the measurement.

## Anytime fixes (independent of task order)

- [x] Import-from-URL collision popup ignores unticked items (`EditorPage.tsx:353–363`) — LIB-004 step 0 (2026-07-25; fix applies `filterImports(..., { remove: getUnselectedImports() })`. ⚠️ verified by construction, not yet live)
- [x] `projectmodules.js:47` `startsWith['http']` property-access bug — LIB-003 step 0 (2026-07-25; fixed to `d.startsWith('http')` + regression spec/fixture. A second half of the same bug was found and fixed: `injectIntoHtml` also prepended `pathPrefix` to every dependency unconditionally, so an http dep rendered as `src="/https://…"` even after the scanner fix — now guarded like the adjacent stylesheets branch. Verified headless via node/ts-node.)
- [x] Silent `[]` on library index fetch failure → loud offline/error state in the tabs — LIB-001 step 0 (2026-07-25)

## Decisions

- **2026-07-25 — Library source hosting: this monorepo.** Content source of truth lives at `library/` at the repo root (`library/prefabs/<slug>/`, `library/modules/<slug>/`), each entry an unpacked project directory plus a `library.json` metadata file. `npm run library:build` produces `library-dist/` (versioned zips + per-type `index.json`); publishing is copying `library-dist/` into the docs repo's `library/` path (a documented manual step, see `library/README.md`). The docs repo (`the-low-code-foundation.github.io/opennoodl-docs`) stays a dumb CDN — the editor's fetch endpoint does not change. Rationale (per the LIB-001 spec's decision note): `library:check` needs the editor's SUB-006 validator and project loader, which live here; the agents/CI maintaining content work in this repo; content fixes ride the same review flow as code. Revisit only if Richard prefers a separate content repo — in that case only the publish step changes.

- **2026-07-25 — Module expansion shortlist (LIB-003): QR-code generator, a Lucide icon set, and confetti.** The LIB-003 spec's candidate pool was charts / markdown renderer / Lottie-animation / QR code / an icon set beyond Material / confetti (target 3–5, constraint: nothing needing API keys or a backend). The live index inventory (2026-07-25, 26 modules; triage in [library/modules/AUDIT.md](../../../library/modules/AUDIT.md)) shows **four of those candidates already exist in the live library**: Chart.js (charts), Markdown (markdown renderer), Lottie (animation), and Font Awesome Brands/Solid (an icon set beyond Material, via the `iconset` type). Re-authoring them would be waste — they belong in the _audit_ half, not the expansion half. The genuine gaps in the pool, all UI/utility with no keys/backend, are:
  1. **QR-code generator/renderer** — a live QR _Scanner_ exists but nothing _generates/renders_ a QR code; common need (tickets, sharing, pairing), pure client-side lib.
  2. **Lucide icon set** (via the existing `iconset` manifest type) — Material + Font Awesome are the only icon sets; Lucide is a clean, modern, MIT-licensed set, and the `iconset` path is the cheapest possible module (manifest + CSS/font, no JS node logic). Material Icons is the reference `iconset` case to copy.
  3. **Confetti / celebration micro-interaction** — nothing like it exists; cheap, high delight for the education wedge (LEARN-001 lesson completions, etc.).
  This is a firm **3** rather than a padded 5: the spec's own guidance is "one good X beats five bad ones," and the remaining pool items are already covered live. Authoring these three (manifest + source + catalog entries for static-shape nodes + preview & deploy verification on both React pairings) is the deferred expansion tail. Revisit for a 4th/5th only if a clear gap surfaces during the live audit (a countdown/timer or toast micro-util are the likeliest additions).

## Log

- **2026-09-05 — the shelf was published for the first time since 2026-08-22: 8 new entries, 22 version bumps, and three entries that drew nothing on install** (content repo `02ad8a6`).

  **Published**, live and verified by fetching the served index (not merely the label-coverage gate): prefabs **35 → 42**, modules **30 → 30** (`keyboard-shortcuts` in, `avatar` retired). `library:check` 72/72 exit 0, `library:build` + `library:verify-dist` exit 0, `library:verify-origin` exit 0 (42/42, 30/30), the three existing behavioural drives green (17 checks), and two new drives green (12/12 and 6/6).

  | New | Version | | Bumped | |
  |---|---|---|---|---|
  | File Upload | 1.0.0 | | Form | 0.5.0 → **0.10.0** |
  | User Menu | 1.0.0 | | Table | 0.7.0 → **0.10.2** |
  | Settings Page | 1.1.0 | | Tags | 0.2.0 → **0.5.0** |
  | Keyboard Shortcuts (module) | 1.0.0 | | PDF Viewer | 1.1.0 → **1.2.0** |
  | Accordion · Avatar · Search Bar · Stepper | (built last session, first publish) | | + 18 others | |

  **`form`, `tags` and `table` drew NOTHING on install** — all three were a `For Each` over data with no source, so a user installed them and saw an empty rectangle. Each now carries the `card-grid` contract. Two defects surfaced that only a screenshot could catch: `form`'s Plan dropdown rendered as a **4px black bar** (`net.noodl.controls.options` opts into a default solid/2px/`#000000` border while every sibling defaults to `none`, and its content is empty until something is selected — so under a content-driven size mode the border was the only thing with a size); and a script threw on every load. That throw was **not** in the node it was reported against: `Noodl.Events.emit` dispatches synchronously, so a listener's frame unwinds into the *emitting* script's `try/catch` and wears its name. It cost two measured render rounds, and the first diagnosis of it — blaming `Noodl.Objects[id]` — was **wrong and has been removed from the audit rather than left standing**.

  **`pdf-viewer` was broken at runtime** (`Can't find component model for module.inlineHtml`): it needs `modules/custom-html` and nothing installed it. Fixed at the mechanism — `library.json` now takes a `dependencies` array, resolved by `build.js::resolveDependencies` (which fails the build on an unknown slug, self-reference or cycle) and installed by `ModuleLibraryModel._installWithDependencies`. Re-bundling was rejected **not** for the duplication but because two copies race for `noodl_modules/custom-html-module/` and the loser is silent.

  **The render gate was blind to the mechanism it exists to protect** — it built its scratch project from the entry's own `project/` only, and an unresolved node type does not draw nothing, it *throws*. It now resolves dependencies transitively. A second harness bug: `pickShowcase` filtered on `roots.length > 0`, which counts **nodes, not ink**, so six logic-only entries were reported as "drew nothing" on every sweep and for two of them it out-ranked a sibling that *would* have drawn.

  **Still open, owner NONE:** `table`'s column `Width` never reaches the cell (the dimension port's setter *deletes* the prop for a value without `.value`) — deliberately declined without a render beside it, since the fix switches on a path that has never executed for every column of every table.

- **2026-08-03 — a partial live pass: `data-test` hooks shipped, LIB-002's two shifts measured, and one real defect found. The pass was cut short deliberately** (commit `789dc073`).

  **What shipped.** `views/ImportFlow` now has `data-test` hooks across all five components (residual E, `789dc073`) — the repo's existing `testId`→`data-test` convention, attributes only, no behaviour change, `typecheck:editor` **0**. The load-bearing one is `data-test-stage` on the root: the Done stage renders *narrower* than Select/Review (`rootNarrow`), which is exactly why a geometry- or class-based probe has read a successful import as *"the flow closed"*. Where the flow is, is now a fact to read rather than infer.

  **LIB-002's two deliberate colour shifts are decided by measurement, not by eye.** The house grey scale is internally consistent — each of the nine `Grey - N` tokens has exactly **one** value across all 29 prefabs, and **0 prefabs carry a dangling `Grey` reference** (22 reference them, every one resolves in its own `metadata.styles.colors`). Against that scale both shifts went *lighter*, and in both cases a **nearer step already existed**:

  | Shift | From | To | Δ per channel | Nearer step |
  |---|---|---|---|---|
  | `table` divider | `#B4B4B4` | `Grey - 400` `#CECECE` | **+26** | `Grey - 500` `#A5A5A5` (Δ15, and *darker*) |
  | pills icon | `#3E3E3E` | `Grey - 700` `#4C4C4C` | +14 | `Grey - 800` `#383838` (Δ6) |

  The divider is the one that matters and the icon is not: `#3E3E3E`→`#4C4C4C` is two dark greys on a light ground, perceptually small. But the divider is a **1px line**, and it sits under a header row whose background is `Grey - 200` `#F4F4F4` — so its contrast against its own background falls from **1.89:1 to 1.43:1**. That is the finding: not "it shifted", but "it shifted to the *further* of two available tokens, in the direction that makes a hairline fainter". `table` does not currently define `Grey - 500`; adding it is a one-line style addition at the house value. **Recommend `Grey - 500` for the divider, leave the icon alone** — but it is a design call, so it is recorded rather than applied.

  **Live, from the local stub, end to end.** `library:build` → `verify-dist --port 3000 --serve` → editor adopted it (`getGlobal('useLocalDocs')` **true**), Prefabs tab rendered all **29** cards with icons resolving, and the `table` prefab **installed into a fresh project**. On disk the install is clean: all **10** colour tokens transferred (including `Grey - 400: #CECECE`, so the tokenised divider does resolve in a host project after a real install) and all **12** `/Table/*` components landed. That is LIB-002's headless tokenisation verified through a real install rather than through JSON. The NodePicker stayed open after the install — decision 3's behaviour, observed working.

  🔴 **The defect: every import writes two legacy-import report files into the user's project, even when there is nothing to report.** Installing the `table` prefab into a brand-new project wrote **`IMPORT-REPORT.md` and `import-report.json` into the project root** — verdict `proceed`, `findings: []`, `placeholder: 0`, `dropped: 0`, 83/83 constructs "converted without comment". `apply.ts:227` gates the write on `if (legacyReport)` only. Meanwhile `ResultStage` gates its *banner* on `recommendation !== 'proceed'`, with a comment stating the intent explicitly — *"a clean import gets a `proceed` verdict and no banner, so this never becomes decoration the user learns to skim past."* **The same intent was applied to the UI and not to the files.** Three consequences: a first-party prefab install leaves 2 files in a fresh project (and they would be committed to the user's git and shipped in exports); the prose frames a current-library prefab as legacy salvage (*"NodeGX is a fresh start, and legacy projects import on a best-effort basis"*), which is false on this path; and because the paths are stable-and-overwritten, the file describes only the **last** import while presenting itself as the project's import record. **Not fixed** — `writeImportReport`'s own doc comment argues for the stable committed file, so which of the two intents wins on a clean import is Richard's call, not a bug to quietly re-gate. The minimal consistent fix is to gate the write exactly as the banner is gated.

  ⚠️ **Why the pass stopped early, and why the rest of it would not have been evidence.** A concurrent session was editing the shared checkout throughout — **29 files** across `validation/`, `models/`, `versioning/`, `AiAssistant/` and `componentports` — and its in-flight state **did not compile**: the renderer console carried `TS2552: Cannot find name 'NormComponentPort'` (×3) and `TS2339: Property 'componentContracts' does not exist on type 'RuleContext'`. Their saves also triggered the HMR reloads that closed the creation wizard mid-flow twice. Everything reported above is either disk state or the library-install path (none of whose files they touched); **LIB-002's visual render check and LIB-003's module exercise were not attempted**, because a rendered result from a tree that does not typecheck is not evidence about this phase. This file already records three confident-and-wrong diagnoses of one assertion; a fourth, drawn from someone else's half-saved edits, was the avoidable one.

  **Two things checked and cleared, recorded so nobody re-files them.** The prefab search box appearing not to filter was **my driving** (`searchValue` was `""` — the text never landed), not a defect. `Loaded 0 modules` is `projectmodel.modules.ts` reporting the *project's own* `noodl_modules` count, correct for a fresh project. Also cleared on re-measurement: a first probe suggesting 22 prefabs held dangling `Grey` tokens was **wrong** — colour styles live under `metadata.styles`, not `styles`.

  **Still open and unexplained, filed not diagnosed:** two `404 (Not Found) index.json?<timestamp>` and two `Uncaught TypeError: callback is not a function at filesystem.js:115`. The stub serves both indexes **200** with and without a query string (checked directly), so the 404 is not the harness. Both appeared while the concurrent session's broken build was live; they need a clean tree before anyone attributes them.

  **Cleanup done:** `dev:stop` (24 processes, verified all mine and no `test:ci` running before killing) and the port-3000 stub killed — an editor left probing 3000 silently adopts it instead of the real CDN.

- **2026-08-02 — the parallel batch: four worktree agents, LIB-006 built, three headless halves closed** (merged to cline-dev as `422b4cda`, fast-forward over `97b6550d`). Branches `wt-lib-002/003/005/006`, all four pairwise **disjoint** (`comm -12` pre-check) and disjoint from the concurrent session's three commits. Gates on the merged tree: root typecheck **0** (was 18), `typecheck:editor` **0**, `library:check` **58/58**, `tests-unit` **154/154**, Jasmine **2017 specs / 0 failures** (seed 78757). Each agent's headline claim was re-verified by the orchestrator rather than taken on trust — the prefab renames (127 refs, 0 dangling), the material-icons glyph sets (2122 vs 1865, 77/334, not a subset), and LIB-006's "no legacy node type was ever removed" (26 deleted files → 19 renames, 6 `byob-*`, 1 helper).

  **Worth keeping — the orchestration mechanics.** (1) **Do not use `isolation: "worktree"` on this repo**: the harness creates every worktree branch from `origin/main`, which is ~660 commits stale with no `dev-docs/`. Building them by hand off `cline-dev` is deterministic and skips the reset dance. (2) **The symlink recipe from [[parallel-worktree-traps]] needs its own fix applied** — a blanket `node_modules` symlink makes `@noodl/runtime` resolve *twice* (worktree path and primary path) and `collection.ts` throws `Cannot redefine property: items` on the second load, which presents as a whole suite failing on your branch. A real `node_modules` dir of per-entry symlinks plus a real `@noodl/` dir pointing at the *worktree's* `packages/*` fixes it; verify with `require.resolve('@noodl/runtime/package.json', {paths:[wt]})` before launching anyone. (3) **Reserve `PROGRESS.md` for the orchestrator** and give each agent its own NOTES file — zero conflicts across four merges. (4) **`npx jest` from the repo root picks up the wrong babel config** and reports every suite as failing-to-run; run it from `packages/noodl-editor`.

  ⚠️ **The live tail did not move, and the reason is worth recording: two sessions cannot share the editor, and each one's launch silently kills the other's.** `start.ts` sweeps leftover processes before starting more, so a concurrent session's `npm run test:ci` reaps a running `dev:debug` stack — and vice versa. This happened **twice**: the editor was acquired cleanly at 19:21 and again at 19:51, `qa3-target` opened successfully both times (the log shows the project loading and serving its fonts), and both stacks took SIGTERM within ~90s when the other session started a suite. Four `test:ci` runs in forty minutes left no usable window. **How to apply:** before a live pass, check for `webpack.test-ci` and `electron/dist` processes and wait for a *sustained* quiet window, not an instantaneous one; never run `dev:stop` (it kills by checkout, taking their run down too, and it also matches a running `test:ci` Electron). Live QA is genuinely serial across the machine — plan it into a session that owns the checkout.

  **Established for the next live pass, so it starts warm:** the docs-origin stub works — `npm run library:verify-dist --port 3000 --serve` answers `/{major}.{minor}/version.json` with `{"kind":"noodl-docs"}`, which is exactly what `main.js` probes on 127.0.0.1:3000, and it serves the built `library-dist/` index; a prefab install against it discharges **Criterion 5, QA-3 and LIB-002's visual check in one setup**. Fixtures are built at `scratchpad/qa/`: `qa3-target` (carries a `Primary` colour style, so the `tags` prefab collides on it), `loading-spinner` identified as the ships-no-styles prefab for the no-dialog case, a zip for QA-4, plus corrupt and nothing-importable dirs for QA-6. Driving recipe: stub `filesystem.openDialog` via the webpack-require handle and click the **real** button, so nothing observed is an artefact of eval-driving.

- **2026-07-26 — LIB-005 code-complete; LIB-004's live residual partly discharged** (worktree off cline-dev tip `e1914e1`; **NOT merged — orchestrator merges**). Design rationale, prior-art accounting and the live-QA checklist are in [LIB-005-NOTES.md](./LIB-005-NOTES.md).
  - **Worktree base trap, third time.** Branched from `360cdc4` (repo root `main`, ~300 commits behind). Caught before any work, `git fetch . cline-dev && git reset --hard e1914e1`.
  - **The design turn: stop storing derived state.** The flow's state is only the *requested roots*, the dropped heuristic links, and the explicit collision resolutions. Everything else — closure, collisions, diffs, counts — is `plan()` re-run on every render. The old popup kept a second boolean per row (`implicit`) that it re-derived by walking the graph itself in the view, so the screen and the import were two structures that had to agree. Consequence: **an unsatisfied selection is unrepresentable** (AIX-003's rule) with no validation code, because a `required` row is a derived value and "out" is not a state a derived value can be in.
  - **Heuristic edges are droppable at the edge, not the plan.** `deriveInventory` rebuilds the inventory from `edges` minus the dropped links and re-plans, so the closure recomputes; an item something else still needs stays. A link is droppable only when *every* backing edge is `inferred`.
  - **Collisions inline, three ways** (skip / overwrite / rename), no second popup. Overwrite leads with SUB-007's roll-up and puts `ComponentDiffView` one disclosure behind it. Rename validity comes from the engine (`policy=rename && collides`), not a second checker. **Prefab silent drops are gone** — colliding non-components open the flow pre-set to "kept yours".
  - **Reuse accounting:** `ComponentDiffView` verbatim; `graphChangePresentation` gained `summarizeChanges`/`countChanges` lifted out of `ChangeReviewDocument` (one implementation, two consumers); AIX-003's closure was reused **as a principle, not as code**, and NOTES §3 argues why routing import through `requiredWith` would have been a second closure in disguise.
  - **Thumbnails not shipped — `noodl-preview` cannot render images.** Its `main` points at a non-existent `src/index.ts`, nothing depends on it, it has no headless browser (only `chokidar`), it serves a live HTTP page, and its platform shims fight the Electron renderer. Node counts ship instead as the honest signal. Two real paths recorded for later.
  - **Deleted:** `views/importpopup.ts`, `views/importpopup/ImportPopupView.tsx`, **and LIB-004's `legacyAdapter.ts`** (all five call sites moved). `tests/project/projectimport.js` ported onto `analyze`/`plan`/`apply` rather than kept on a shim.
  - **Three real defects found and fixed, all invisible until a UI rendered the plan or the suite actually ran:**
    1. `plan()` passed the *accumulated closure* as the "requested" set for resources and modules, so every one reported `reason: 'requested'` with an unexplained `requiredBy`. Colours/text styles were already correct.
    2. A **text style never pulled its font**. `buildInventory` computed `fileDependencies` but emitted no edge and the closure never walked it — a regression against the legacy popup, which did mark it. Fixed in the engine (edge + closure pass), 3 specs.
    3. `projectimport.js` **corrupted its own fixture**: the overwrite characterization loaded `import_proj1` in place, left the gutted project in the global `ProjectModel.instance`, and under randomized order a later spec saved it back over the fixture — after which nine specs failed in a shape that read exactly like an engine regression. Also, its sibling's `forEachNodeRecursive((n) => afterIds.push(n.id))` short-circuited on the first node (`push` returns a truthy length), so its assertion had never been evaluated.
  - **Verification:** editor + editor-tests typecheck exit 0; **`npm run test:ci` 1320 specs / 0 failures, exit 0** (randomized, seed 51325). Hex ratchet: this task adds no literal colour (`noodl-editor` 16 = baseline); its exit-1 is a pre-existing `noodl-core-ui` +2 in `Logo.module.scss` from the brand commit `87b6c6b`. TSFixme ratchet: 535 → 530; its exit-1 (`any` +90) is byte-identical on the base commit. **This run discharges the "Electron characterization suite never executed" half of LIB-004's residual** — a worktree needs `node_modules` symlinked at the repo root, `packages/`, *and* `packages/noodl-editor/`, or `dugite` cannot find git and the Git specs hang the run to its 900s timeout.
  - **Residual — and it is the big one: nothing was verified visually.** The editor cannot be launched from a worktree. LIB-005-NOTES.md §7 is a six-part scripted checklist (closure legibility + the un-untickable required row, blind-overwrite/diff/rename, prefab kept-yours, URL untick, export, edge cases) written for someone else to execute from the primary checkout. Also residual: dead `.import-popup-*` rules in `src/assets/css/style.css` (left alone — concurrent UIX-011 agent owns that file), and one deliberate behaviour change to confirm — **the NodePicker no longer closes itself after an install**, reasoned in NOTES §7 QA-3 step 5 and reversible in one line.

- **2026-07-25 — LIB-003 expansion + docs half complete** (worktree off cline-dev tip `36b8386`, branch `lib-003-module-tail`, commits `b7f3520` modules + `ac3efcd` docs, merged `beaeca4` — orchestrator merge; ran concurrently with LIB-002, zero file overlap). The module-authoring/docs tail of LIB-003; the live per-module audit remains.
  - **Three expansion modules authored** (all no-keys/no-backend, self-contained, **no build step**):
    - **`lucide-icons`** — iconset (manifest-only), mirrors `font-awesome-solid` exactly: bundled `lucide.woff2`+`lucide.ttf`, rewritten `styles.css` (`@font-face` + `.lucide` base + 1998 `.icon-<name>::before` rules), manifest `type:"iconset"`/`iconClass:"lucide"`/`codeAsClass:true`. Licence **ISC** (Lucide's actual licence, not MIT).
    - **`qr-code`** — code module, `nodegx.qrcode` "QR Code" visual React node; vendors `qrcode-generator@1.4.4` (MIT); builds an inline SVG from the module matrix (styleable size/quiet-zone/fg/bg + L/M/Q/H).
    - **`confetti`** — code module, `nodegx.confetti` "Confetti" trigger node; vendors `canvas-confetti@1.9.3` (MIT); `Celebrate` signal with Burst/Fireworks/Cannon/Rain presets + `Fired` signal; browser-guarded for SSR.
    - Both code modules **inline the `@noodl/noodl-sdk` node-def shim verbatim** from the shipped custom-html/chart-js bundle (installs `defineNode`/`defineReactNode` over the prelude's `defineModule`), so no compile is needed.
  - **Catalog: residual, mechanism does not exist.** Confirmed chart-js's node is also absent from `node-catalog.json` (0 hits) and the generator never executes `defineModule` — so getting runtime-registered module nodes into the build-time catalog has no path today. Per the task constraint this was **not invented**; the new nodes take SUB-004's documented dynamic **"skip port checks"** path. `catalog:check` stays green (136 node types, unchanged).
  - **Docs:** `library/modules/README.md` — directory shape, `library.json` schema, code-vs-iconset manifests, `defineModule`/`defineNode`/`defineReactNode`, the `runtimes` field, the iconset `iconClass`/`codeAsClass` model, the no-build-step hand-authoring pattern, the catalog skip-path note, and the dev loop.
  - **Verification:** `library:check` **58/58 clean, 0 warnings** (worktree and primary post-merge); `catalog:check` green. First `library:check` pass caught the strict `library.json` schema (no `license` key; `provenance` must be exactly `{sourceUrl, importedAt}`) — conformed, with licence detail kept in code headers/README/AUDIT.
  - **Residuals (need the primary-checkout editor/deploy):** (1) live preview + deploy verify of each new module on both React 18/19 pairings; (2) replace the 3 clearly-labelled procedural placeholder icons (680×384) with real rendered thumbnails; (3) the existing-26-module live audit (still read-level guesses in `library/modules/AUDIT.md`); (4) `library:build` + publish of the 3 new zips; (5) optional QR data-URL output port (skipped — React-node `outputProps` unverified live).

- **2026-07-25 — LIB-002 static-audit half complete** (worktree off cline-dev tip `36b8386`, branch `lib-002-prefab-overhaul`, merged `bd276a1` — orchestrator merge; ran concurrently with the LIB-003 tail, zero file overlap, and with a separate BAK-003 session on the shared checkout, no path collision). Headless static audit only — the live-editor half is a physically-unreachable residual from a worktree (the `lerna exec` trap), so this pass did everything inferable from the project files:
  - **`library/prefabs/AUDIT.md`** — 100% coverage of all 29 prefabs: triage **keep 14 / fix 15 / retire 0** (nothing broken-beyond-repair, so nothing deleted; redundancy raised as consolidation proposals), a style charter, silent-drop/namespacing analysis, and per-prefab findings (function, hard-coded-colour enumeration, metadata honesty, collision risk, folder hygiene).
  - **Corrections to prior records:** a fresh NodeGX project ships **no styles** (`hello-world.template.ts`), so the common install path drops nothing — the silent-drop collision risk only bites when installing into an already-styled project. The real hazard is narrow: prefabs hard-coding **tints of a token** (toast `…3F`, supabase/multi-choice-with-pills `#5836F5xx`) that diverge if the host redefines the base token; namespacing recommended only for genuinely load-bearing tokens. Also: the drop code the spec cites at `modulelibrarymodel.ts:106–136` now lives in `installPrefab` at ~lines 198–227.
  - **Folder-hygiene defects found:** `xano` trailing space in `Xano - authToken - Check `; `supabase` double-nests `#Supabase Prefab/Supabase Prefab/…`; `stripe` bundles a `/Tab Bar` duplicating the tab-bar prefab; `selection-pills` lowercase `Pill item`. Asset integrity clean across all 29 (no dangling fonts/SVGs).
  - **Metadata fixed (27 `library.json`):** thin single-tag entries enriched to an honest functional taxonomy; date/time-picker "X component." descriptions rewritten; **stripe's misleading cloud-only framing/tags corrected** (it ships a full subscription UI). Provenance/field-order preserved.
  - **Verification:** `library:check` **29/29 prefabs clean, 0 warnings** in the worktree, and the authoritative `library:check` from the primary checkout after merge is **55/55 clean** (48 warnings, all pre-existing content-level, not gated). Note the SUB-006 validator checks node/port validity, not style hygiene — it can't see the colour/collision findings.
  - **Residual (needs the primary-checkout editor), per prefab:** open + exercise interactive paths; apply the charter restyle (tokenise the enumerated hard-coded colours + toast tints, apply namespacing); fix the folder-hygiene defects; re-save in current format; regenerate icons/screenshots; live-install into a fresh project with a zero-console-error check; verify on React 18 **and** 19; take the consolidation decisions; publish + verify the LIB-001 build end-to-end.

- **2026-07-25 — LIB-003 plumbing + inventory half complete** (separate worktree off cline-dev tip `b98a0ac`; **NOT merged — orchestrator merges**). Commits: `322a8cd` (startsWith scanner fix), `d2a576b` (inject-loop http guard), `19ecdff` (scanner unification + manifest validation), plus this doc update.
  - **Worktree base trap (again):** this worktree was branched from an old repo root (`360cdc4`, ~300 commits behind cline-dev — `dev-docs`, `library/`, SUB-007 all absent), the same trap LIB-004 hit. Caught immediately (clean tree, zero unique commits), `git reset --hard b98a0ac`, rebuilt. Future worktrees for this repo **must** be based on cline-dev's tip.
  - **Step 0 (shipped, `322a8cd`):** `projectmodules.js:47` `d.startsWith['http']` → `d.startsWith('http')`. Regression spec + fixture (`tests/testfs/module-deps`) covering an http URL (stays verbatim) and a local path (gets the module dir prefixed).
  - **Step 0's hidden second half (shipped, `d2a576b`):** even with the scanner fixed, `injectIntoHtml` prepended `pathPrefix` to _every_ dependency, so an http dep still rendered `src="/https://…"`. Guarded it exactly like the adjacent stylesheets branch. This is what Success Criterion "http-URL module dependencies inject as URLs" actually requires. Committed separately so the subsequent refactor's snapshot stays clean.
  - **Scanner unification (shipped, `19ecdff`):** `shared/utils/projectmodules.js` → typed `.ts`; the two parallel scanners now share one `scanModuleManifests` core (read dir → parse → validate), with `injectIntoHtml`/`scanProjectModules` and `projectmodel.modules.ts`'s `list/readProjectModules` as thin shaping layers over it. The `// TODO: Can we merge this ?` is resolved. Four consumers updated: web-server (`.default` for webpack CJS↔ESM interop), html-processor, ProjectModel, noodl-preview loader (via HtmlProcessor); ViewerConnection's callback API unchanged.
  - **Manifest schema (shipped, `19ecdff`):** typed `ModuleManifest` + ajv runtime validation. Unreadable/invalid-JSON manifest → **loud** skip with a console warning naming the module; schema-invalid-but-parseable manifest → kept best-effort (never regress a working project) with a named warning. No more silent skips.
  - **Verification (headless — the `lerna exec` worktree trap makes `dev:debug`/`test:ci` resolve to the MAIN checkout, so those would lie; specs run via `ts-node` against the worktree source instead):**
    - **injectIntoHtml SNAPSHOT byte-for-byte identical** before vs after the refactor (golden `tests/testfs/module-inject/expected-inject.snapshot.txt`; `diff` = empty). The intended http-dep URL correction landed in `d2a576b`, so the refactor itself changed zero output bytes.
    - 9/9 new specs green (Step-0 deps, inject snapshot, cloud-runtime filtering, http-vs-local stylesheet, and loud named validation for broken-JSON + wrong-type manifests, warnings confirmed to name the module).
    - `typecheck:editor` clean, `typecheck:editor-tests` clean, `catalog:check` up to date (regression gate green).
    - Ran the new validating scanner over all 26 seeded module packages: **0 warnings** — schema has no false positives against real content.
  - **Inventory:** live module index fetched (26 modules); triage table (keep/fix/retire guess per module) at `library/modules/AUDIT.md`; expansion shortlist decided (see Decisions above).
  - **Residuals (the live tail — need the primary checkout / live preview+deploy):** (1) live per-module audit of all 26 — install→inject→register→nodes function on **both** React 18 and 19 pairings; fix or retire with recorded reasons (integration/key modules #2/#4/#21/#24 are the retire candidates); (2) author the 3 shortlist modules (QR generator, Lucide iconset, confetti) — manifest + source + catalog entries + preview & deploy verification; (3) `library/modules/README.md` authoring docs (manifest fields, `defineModule`, `runtimes`, iconset type, dev loop); (4) **deploy-build verification of the scanner refactor** — the main-process + deploy bundle was not built here, so web-server's `.default` interop and a real deploy of a module-using project are unverified by a running build.

- **2026-07-25** — Phase created. Three parallel code investigations established: library content lives on the docs GitHub Pages site (not this repo) as full-project zips; all five install/import/export flows share `projectimporter.js` + `ImportPopup`; SUB-007/AIX-003/SUB-006/SUB-009 provide the machinery a modern import needs. Five tasks specced across two sprints.
- **2026-07-25** — LIB-001 started. Step 0 (loud fetch-failure state) shipped: `ModuleLibraryModel` now tracks `modulesStatus`/`prefabsStatus` (`loading`/`loaded`/`error`) instead of silently resolving to `[]` on fetch failure, and `NodePickerSearchView` renders an explicit "Couldn't load the library" state with a Retry button. Hosting decision recorded above. `library/` scaffolded at repo root; live library (29 prefabs + 26 modules from the docs GitHub Pages index) seeded as tracked source with per-entry provenance. `library:build` (versioned zips + index.json) and `library:check` (project loads + SUB-006 validator + schema) added and wired into CI (`.github/workflows/pr.yml`). Editor-side: index schema now tolerates `type`/`version`/`minEditorVersion`/`runtimeVersion`; `/prefab` substring check kept as fallback behind an explicit `type` field; orphaned `ModuleLibraryContext` deleted.
- **2026-07-25** — Verification status and a real environment trap found while trying to go further:
  - `library:build`/`library:check` run clean against all 55 seeded entries (0 errors, 48 warnings — expected, seeded-as-is content). Deliberately broke one entry's `library.json` (missing `version`) and confirmed `library:check` fails loudly with a non-zero exit; restored and reconfirmed 55/55 clean. `typecheck:editor` is clean (0 errors) on every commit above.
  - **Trap: `npm run dev:debug` / `npm run test:ci` (and anything else routed through `npx lerna exec --scope noodl-editor`) do not run the worktree's own source when invoked from inside a git worktree.** `lerna exec`'s package-root discovery resolves to the *main checkout's* `packages/noodl-editor`, not the worktree's, even when the child process's `cwd` is explicitly the worktree root — confirmed by `lsof -p <electron-pid>` showing `cwd` under the main checkout, and by reading `NodePickerSearchView.tsx` there and finding it byte-identical to the pre-edit version. Editor code changes made in a worktree are therefore **silently invisible** to `npm run dev:debug`/`test:ci` run from that worktree — a live click-through or the Jasmine suite will exercise the main checkout's code instead, and report success or failure that has nothing to do with the worktree's diff. Root cause not fully chased down (likely lerna's project-root detection not recognizing a git-worktree `.git` *file* the way it recognizes a `.git` *directory*); a real fix belongs to repo tooling, out of LIB-001's scope. Follow-up: either patch the affected npm scripts to avoid `lerna exec` for worktree-run dev/test, or always land editor-behavior verification from the primary checkout.
  - Because of that trap, **Success Criterion 5 ("install of one prefab + one module from the locally built dist verified live in the editor") was not completed this session.** What *is* verified: the build/check pipeline output is structurally correct and installable-shaped (same zip/index.json shape the existing, unchanged `ModuleLibraryModel.installPrefab/installModule` already consume), and the new React/TS code type-checks and was read-verified against the live-running (main-checkout) editor's DOM for the Step-0 error-state case specifically (see below). A follow-up session should either run the live check from the primary checkout, or fix the lerna/worktree resolution first.
  - Also hit and worked around, in case they bite a future session: (a) the worktree's own `node_modules/electron` has no `dist/` (postinstall binary download didn't run), so Electron itself also ends up launched from the main checkout — consistent with the trap above; (b) CDP's `--target=editor`/`--target=NodeGX` needle-matching in `scripts/devtools/cdp.js` can collide with unrelated path substrings (e.g. `--target=projects` matches `.../vscode_projects/...` in another target's file path first) — use a longer, more specific needle (e.g. `--target=dashboard/projects`); (c) full `Network.emulateNetworkConditions(offline)` was observed to hang the renderer when combined with an in-app project-open navigation (not just fail requests) — `blockurl`/`unblockurl` (added this session) is the safer tool for exercising one fetch's failure path; (d) `Page.reload` while any Network-domain emulation is active reliably navigates to `chrome-error://chromewebdata/` for this app's `file://` pages — go back online/unblocked *before* reloading, not after.

- **2026-07-25** — LIB-004 ran concurrently (separate worktree; merged into cline-dev alongside LIB-001, zero file overlap between the two). Reached a clean `analyze`+`plan` checkpoint:
  - **Step 0 shipped** — `EditorPage.tsx` overwrite `onOk` now applies `filterImports(selectedImports, { remove: getUnselectedImports() })`, so unticking a colliding item in the import-from-URL dialog actually prevents its overwrite. Verified by construction only (the untick→`import:false`→`getUnselectedImports` path is exact); **not yet live-verified**.
  - **New typed engine** at `src/editor/src/utils/import-engine/` (deliberately named to collide with neither `utils/projectimporter.js` nor `io/ProjectImporter.ts`): `analyze` (I/O shell over the format-aware loader) → `buildInventory` (pure; port-type-driven dependency edges from the SUB-004 catalog, with the legacy string-match heuristic retained as flagged `inferred` fallback) → `plan` (pure; dependency-closure resolution, collision detection, per-colliding-component SUB-007 `ComponentDiff`, `add|overwrite|skip|rename` policies). All headless-verified via ts-node against `import_proj1`/`import_proj5`: inventory output is **byte-identical** to legacy `listComponentsAndDependencies`, plus semantic provenance edges. Characterization specs for id re-keying + overwrite-id-reuse written. Export util renamed `exportProjectComponets`→`exportProjectComponents` with the empty-dir archive crash fixed. `typecheck:editor` and `typecheck:editor-tests` both clean (0 errors).
  - **Deliberately NOT done (tree stays fully working on the legacy engine):** the `apply` stage, migrating the five call sites behind a strangler `ImportPopup` adapter, deleting `projectimporter.js`, and the v2-format fixture. These are the next session's work; the characterization suite is `apply`'s contract and must run green in Electron first.
  - **Load-bearing trap:** catalog port names lag stored parameter keys for evolved nodes (e.g. Image's file port is catalogued `src` but old projects store it under `image`), so the string-match heuristic fallback is **not vestigial** — the engine keeps it as flagged `inferred`. Also: components carry no `id` on disk (`ComponentModel.fromJSON` reads `json.id`, undefined in fixtures), so overwrite-id-reuse only bites once ids exist; `ComponentModel.forEachNode` is non-recursive (use `forEachNodeRecursive`).
  - Same worktree-base bug LIB-001 dodged bit LIB-004: its worktree was branched from an old repo root 302 commits behind cline-dev (SUB-007/catalog/`dev-docs` all absent); the agent caught it, `git reset --hard cline-dev`, and rebuilt. Future worktrees for this repo must be based on cline-dev's tip.

- **2026-07-25** — LIB-004 finished (steps 5–7): the engine is code-complete and `projectimporter.js` is gone.
  - **`apply` stage** — split into a pure core `import-engine/applyModel.ts` (`applyModelChanges`, Electron-free, operates over injected `ImportSource`/`ImportTarget` interfaces) and an I/O shell `import-engine/apply.ts` (loads the source via the format-aware `projectFromDirectory`, grafts model changes inside ONE `UndoActionGroup`, then does the non-undoable disk work — resource + module copies — reported separately in `ImportResult`). Id semantics preserved faithfully from the legacy engine: every imported component is re-keyed to fresh node ids, EXCEPT an overwrite reuses the target component's existing id (references keep resolving) and evicts the old component first. Rename policy grafts under the new name and re-points references to renamed siblings within the imported set. Viewer-watch suspension + `viewer-refresh`/`ProjectModel.importComplete` sequencing left in the call sites (unchanged "as today"); `apply` is pure model+disk work.
  - **Strangler adapter** — `import-engine/legacyAdapter.ts` reproduces the legacy `ProjectImporter` surface (`listComponentsAndDependencies` → `analyze`; `import` → `plan`-shaped-`apply`; `checkForCollisions`/`hasCollisions`/`filterImports` ported faithfully). All **five call sites migrated** by repointing their import (module install + prefab install in `modulelibrarymodel.ts`, import-from-project in `projectlibrarymodel.ts`, import-from-URL in `EditorPage.tsx`, export in `exportProjectComponents.ts`). `ImportPopup` untouched — it still speaks the same `imports`/`collisions` shape, now produced by the engine. Typing the adapter surfaced two pre-existing latent bugs (a `string | void` dirEntry fed to import; the popup's in-place `.import` annotation) — both fixed.
  - **v2-format source** — source loading already routes through `projectFromDirectory` (format-aware, STRUCT-003) in `analyze`/`apply`; added a decomposed v2 fixture `tests/testfs/import_proj_v2/` (a `ProjectExporter` decomposition of `import_proj1`) and `tests/import-engine/v2-source.test.ts` proving the v2 project reconstructs to a byte-identical importable inventory vs its legacy twin.
  - **`projectimporter.js` DELETED** (`git rm`); swept — only comment references remain. Characterization suite `tests/project/projectimport.js` (incl. the two id-reuse specs) now runs through the adapter and is `apply`'s Electron contract.
  - **Verification:** `typecheck:editor` and `typecheck:editor-tests` both clean (run as direct `tsc -p`, so they type-check THIS worktree). 18 headless ts-node assertions green: `applyModelChanges` id-reuse/fresh-id/skip/rename-reroute/selective-style-merge/missing-component-warn, plus v2↔legacy inventory parity. New Jasmine specs (`apply.test.ts`, `v2-source.test.ts`) written & registered but, like the characterization suite, run only in the Electron bundle (deferred, see residual).
  - **Trap dodged:** this worktree was branched 325 commits behind cline-dev (same stale-base bug LIB-004's first session hit); caught immediately and fast-forwarded to cline-dev tip (b98a0ac) before any work — HEAD was a strict ancestor so nothing was lost, no reset.

**Residuals for next session:** (LIB-001) live-verify install of one prefab + one module from a locally served `library-dist/` (Success Criterion 5) from the primary checkout, and re-confirm Step 0's offline UI live — both need an environment where the lerna/worktree trap doesn't apply. (LIB-004) **live-editor verification of all five flows on the new engine** (module install, prefab install, import-from-project, import-from-URL incl. step-0 untick, export) and **running the Electron Jasmine suites** (`tests/project/projectimport.js` characterization + `tests/import-engine/apply.test.ts` + `v2-source.test.ts`) — all blocked here by the lerna/worktree resolution trap, so must run from the primary checkout. Also unverified live: the rename policy end-to-end (no UI exercises it until LIB-005; unit-verified only) and `projectFromDirectory` actually detecting+loading a v2 source behind the `formatV2.enabled` flag (the reconstruction it delegates to is pinned headlessly).
