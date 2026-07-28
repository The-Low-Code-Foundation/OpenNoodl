# Phase 21 Progress — Library & Import Overhaul

**Created:** 2026-07-25, from the code-level library/import investigation (findings recorded in the [README](./README.md))
**Overall status:** 🟡 In progress — LIB-001 pipeline built (4/5 criteria verified; live install still to confirm) merged to cline-dev; LIB-004 engine now code-complete (all three stages built, `projectimporter.js` deleted, 5 call sites migrated, v2 fixture added; typecheck + headless green; live-editor pass is the only residual); LIB-003 plumbing+inventory half done (scanner unified, `startsWith` + inject fixed, manifest validation, live index triaged, expansion shortlist decided; 3 shortlist modules authored + authoring docs merged, live per-module audit remains); LIB-002 static-audit half done (29-prefab AUDIT.md + metadata fixes merged; live restyle/install residual); **LIB-005 code-complete** (new `views/ImportFlow` replaces all three legacy popups across all five entry points, old popup + LIB-004 strangler adapter deleted, engine gaps found and fixed; typecheck + Electron suite green — but **nothing visually verified**, so the live-QA checklist in LIB-005-NOTES.md §7 is the outstanding gate)

## Status vocabulary

Not started · In progress · Built–not wired · Complete · Superseded

## Tasks

| Order | ID | Title | Status | Estimate | Notes |
|---|---|---|---|---|---|
| 1 | LIB-001 | Library source of truth & delivery pipeline | Built–not wired | 4–6 days | Pipeline + 55-entry seed + editor changes shipped and committed; residual: live install-from-`library-dist` verification (see Log) |
| 2 | LIB-002 | Prefab audit, repair & restyle | In progress | 1.5–2 wks | Static audit half DONE (2026-07-25, merged `bd276a1`): full 29-prefab `library/prefabs/AUDIT.md` (triage keep 14 / fix 15 / retire 0), style charter, per-prefab hard-coded-colour + collision-risk + folder-hygiene findings, 27 `library.json` metadata fixes, `library:check` 29/29 clean. Residual tail (needs primary-checkout editor): open/exercise/restyle/re-save each prefab, fix folder-hygiene defects, regen icons, live install console-clean on React 18+19, consolidation decisions. |
| 3 | LIB-003 | Module audit, hygiene & expansion | In progress | 1–1.5 wks | Plumbing+inventory half DONE (2026-07-25); **expansion + docs half DONE** (2026-07-25, merged `beaeca4`): 3 shortlist modules authored — `lucide-icons` (ISC iconset, 1998 glyphs), `qr-code` (MIT, visual node), `confetti` (MIT, trigger node), each self-contained/no-build; `library/modules/README.md` authoring docs; `library:check` 58/58 clean, `catalog:check` green. **Catalog integration for module nodes confirmed non-existent** (chart-js absent too) — nodes take SUB-004's dynamic skip path (residual, not invented). Residual tail: live per-module audit of all 26 existing (both React pairings, preview+deploy), live preview/deploy verify of the 3 new modules, replace placeholder icons, deploy-build check of the scanner refactor. |
| 4 | LIB-004 | Import engine v2 | Built–not wired (code complete; live-verify pending) | 1–1.5 wks | Full three-stage engine (`analyze`+`plan`+`apply`) built & typed; `projectimporter.js` DELETED; all 5 call sites migrated behind a strangler adapter (**adapter now deleted too — LIB-005**); v2-format fixture + parity test added. Verified: typecheck (editor + editor-tests) clean, 18 headless assertions green (apply id-semantics/skip/rename/styles + v2 inventory parity). **The Electron characterization suite has now been run (LIB-005, 2026-07-26) and is green** — it found three defects on the way, two in the engine (resource/module `reason`; text styles never pulled their font) and one in the suite itself (a fixture it corrupted, and an assertion that had never executed). Residual: live-editor pass of the 5 flows, now folded into LIB-005's live-QA checklist |
| 5 | LIB-005 | Import experience overhaul | Built–not wired (code complete; **zero visual verification**) | 1.5–2 wks | New `views/ImportFlow` surface (Select → Review → Done) over LIB-004's `analyze`/`plan`/`apply`. Closure is **derived, never stored**, so an unsatisfied selection is unrepresentable (AIX-003's rule, not its code — see NOTES §3). Collisions resolved inline — skip/overwrite/rename — with SUB-007's `ComponentDiffView` one disclosure behind a `summarizeChanges` roll-up. All five entry points converged; `importpopup.ts`, `ImportPopupView.tsx` and LIB-004's `legacyAdapter.ts` **deleted**; the characterization suite ported onto the engine API. **Thumbnails not shipped — `noodl-preview` cannot render images (finding, not a shortcut; NOTES §3).** Residual: the whole of the live-QA checklist in [LIB-005-NOTES.md](./LIB-005-NOTES.md) §7 |

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
