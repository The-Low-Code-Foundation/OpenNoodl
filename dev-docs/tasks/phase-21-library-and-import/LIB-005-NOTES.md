# LIB-005 — Import Experience Overhaul: design notes

**Date:** 2026-07-26
**Base:** cline-dev tip `e1914e1`
**Scope:** `packages/noodl-editor/src/editor/src/views/ImportFlow/**`, the four call sites, the LIB-004 adapter (deleted), two small upstream fixes described below.

---

## 1. The design problem, and the one idea that solves most of it

The old popup stored a boolean per row (`import`) and then patched a second boolean over the top (`implicit`) by re-walking the dependency graph itself, in the view. That meant **the thing on screen and the thing that got imported were two different data structures that had to be kept in agreement** — and they were computed by two different pieces of code (the popup's `updateDependencies`, and the engine's own closure). Everything bad about the old experience follows from that:

- You could not be shown *why* something was ticked, because the view had thrown the reason away — it only kept a boolean.
- "Overwrite" could not show a delta, because the delta was computed nowhere.
- Collisions needed a second popup, because the first popup's state could not express a per-item decision.

**The fix is not a nicer tree. It is to stop storing derived state.**

The flow's state is four things:

```ts
requested: Set<FlowItem.key>      // what the user asked for, and nothing else
droppedLinks: Set<linkKey>        // heuristic edges the user disagreed with
resolutions: Record<key, Resolution>   // explicit collision decisions
stage: 'loading' | 'select' | 'review' | 'applying' | 'result'
```

Everything else — what comes along, why, what collides, what an overwrite would change, what the counts are — is `plan(inventory, source, selection, target, options)` re-run on every render. Planning is pure and in-memory, so this is free, and it buys the property that **what is on screen is by construction exactly what `apply()` will do**.

### AIX-003's rule, applied to import

AIX-003 made an invalid partial accept *unrepresentable* rather than validated-against. The same move here: a row is `requested`, `required`, or `available`.

- `requested` — the user picked it; clicking takes it back.
- `required` — it is in the plan because something requested needs it. **There is no interaction that removes it.** It is not a checkbox that warns when you untick it; it is not a checkbox.
- `available` — not in the plan.

So "a component is in and its dependency is out" is not a state the UI can be put into, because `required` is a *derived* value and "out" is not something a derived value can be. That is the whole of Success Criterion 7, and it cost no validation code.

The escape hatch is at the right level. LIB-004 flags string-matching dependency edges as `confidence: 'inferred'` ("this parameter's value merely *equals* a resource path"). Those are genuinely often wrong, so the spec asks for them to be droppable. They are — but **the drop happens to the edge, before planning, not to the plan afterwards**. `deriveInventory(inventory, dropped)` rebuilds the inventory's flattened dependency lists from its edge list minus the dropped links, and the closure recomputes over that. An item that something *else* still needs correctly stays; an item nothing needs leaves cleanly. Post-filtering a finished plan would have reintroduced exactly the incoherent-selection failure mode we just removed.

A link is droppable only when **every** edge behind it is `inferred`. One semantic edge (a node's type is a component reference; a parameter's catalogued port type says `image`) makes the dependency a fact about the graph, not a guess, and it is not offered.

### Where the closure lives on screen

It is a permanent pane, not a tooltip. With a row focused it shows that item's dependencies with LIB-004's `via` provenance verbatim — `Image.src (port type: image)`, `node type /Button`, `text style "Heading" == resource` — which is more honest than paraphrasing, and incidentally makes a wrong heuristic edge self-evidently wrong. With nothing focused it shows the running closure: everything the selection pulled in that the user did not ask for, each with its requirer.

---

## 2. Collisions: one surface, three explicit resolutions

No second popup. Every collision is a row in the review stage with a segmented control: **Keep mine / Overwrite / Rename**.

**Overwrite is never blind.** The row leads with SUB-007's one-line roll-up — *"Your version changes: 3 additions, 1 removal, 4 changes"* — and the full `ComponentDiffView` is one disclosure behind it. That is AIX-003's register, deliberately: the summary answers the non-technical reader who just needs to know whether this is big, and the detail is there for the reader who wants node names.

**Rename** is offered for components only, because the engine only re-points references within the imported set for components. Choosing it seeds a suggestion (`/Button` → `/Button 2`, skipping names already taken by the target *or* by a sibling in the same import). Validity is checked by the engine, not by the UI: `plan()` evaluates a renamed component's collision against its **new** name, so `policy === 'rename' && collides` means precisely "renamed onto something that exists", and that is what disables the apply button. One authority, not two.

**Skip is only ever offered where an item collides.** This is what keeps the closure honest through the review stage, and it took some thought: skipping means "keep the version you already have", and that version exists *by definition* — the item collides — so every reference in the imported set still resolves. A non-colliding item has no skip; you deselect it in the browse stage instead, where the closure will tell you if that is not allowed.

**Prefabs stop dropping things silently.** `installPrefab` used to strip colliding styles, variants, files and modules from the import without a word, so a prefab could arrive half-restyled and the user would never learn why. Those collisions now open the flow pre-resolved to `skip` and labelled *"kept yours"* — same default outcome, but visible and changeable. That is Success Criterion 4.

The one-click case stays one click: `_install` plans the whole source against the live project first, and if nothing collides it applies without ever showing a dialog.

---

## 3. What was reused, what was built, and the one thing that could not be

| Prior art | Verdict |
|---|---|
| **SUB-007 `ComponentDiffView`** (`views/panels/GraphDiffPanel`) | **Reused verbatim** for the overwrite delta. Zero diff rendering written in this task. |
| **SUB-007 `graphChangePresentation`** | **Reused, and extended by one function.** There was no roll-up summarizer — `formatComponentDiff` returns a sentence *per change*. The nearest thing was `summarize()`, module-local inside `ChangeReviewDocument.tsx`. Rather than write a second one, it was lifted into `graphChangePresentation.ts` as `summarizeChanges` (+ `countChanges`), and AIX-003's review header now calls it. One implementation, two consumers. |
| **AIX-003's closure model** (`ChangeSet.ts` `requiredWith`/`excludedWith`) | **Reused as a design, not as code — deliberately.** Those functions close over a change-dependency DAG of `{ id, requires }` records. Import's closure is already computed, by `plan()`, over LIB-004's real dependency graph, and it carries provenance AIX-003's records do not. Routing import through `requiredWith` would have meant building a synthetic `ReviewChange` list *from* the plan and then closing over it — a second closure implementation wearing the first one's clothes. What was taken is the principle (derive, don't store; make invalid unrepresentable) and the presentation register. This is the one place where "reuse the component" would have been the wrong call, and it is flagged as such rather than quietly skipped. |
| **AIX-003's `ChangeReviewDocument`** | Not hosted. It renders an annotated *canvas* for a proposed component and needs an `AuthoringChangeSet` (base + target snapshots + per-change requirement edges), not a bare `ComponentDiff`. Reaching that from an import plan means building a change set per collision and opening a document per decision — a full-screen context switch in the middle of a modal decision. The textual `ComponentDiffView` is the right density here; the canvas view is the natural place to go if the diff proves too thin in live use (see residuals). |
| **`packages/noodl-preview` (SUB-009) thumbnails** | **Could not be used. This is a finding, not a deferral by preference.** See below. |
| **UIX-003 control kit / Phase-23 tokens** | Reused: `SearchInput`, `PrimaryButton`, `TextButton`, `TextInput`, `Chip`, `Icon`. All colour from `--theme-*` tokens; no literal hex in `ImportFlow.module.scss`; red used nowhere (the overwrite register is `--theme-color-notice`, per the danger-only phase law). |

### On thumbnails — the honest version

The spec asks for "headless-rendered thumbnails for visual components where cheap". **`noodl-preview` cannot render an image at all**, and is not loadable in the editor renderer:

- Its `package.json` `main` points at `src/index.ts`, **which does not exist**; there is no barrel and no committed `dist`. Nothing in the repo depends on it.
- Grepping `screenshot|thumbnail|puppeteer|capturePage|toDataURL` across its `src/`, `bin/` and `build.mjs` finds nothing. Its only runtime dependency is `chokidar`. It serves a **live HTTP page**; it has no headless browser and produces no images.
- It works by binding `@noodl/platform` to `platform-node` *before any editor module loads* and stubbing `bugtracker` (which hijacks `console.log` at import time). In the renderer, `@noodl/platform` is already bound to `platform-electron` — the shims would fight the host. It also reads project state from disk, whereas the source project here is in memory.
- It additionally requires `src/external/deploy/` to have been built.

The editor's own thumbnail mechanism (`useCaptureThumbnails` → `canvasView.captureThumbnail()`) captures the *currently open* canvas of the *current* project. An arbitrary component of an unopened source project is not reachable through it either.

So there is no cheap path, and a thumbnail is decoration that must never gate an import. What shipped instead is the signal a thumbnail is actually asked for here — **how big is this thing?** — computed from data already in memory: a per-component **node count** on every row and in the review listing, plus a category icon. It costs one walk of the source project JSON. If real thumbnails are wanted later, the honest options are (a) give `noodl-preview` a `--screenshot` mode driven by a headless Electron `BrowserWindow` in the main process, or (b) render at *publish* time in the library pipeline (LIB-001) and ship thumbnails as library metadata — which is the better answer for prefabs, the only place thumbnails really pay.

---

## 4. Two upstream fixes made along the way

**`analyzeSource` (import-engine).** `plan()` needs both the inventory *and* the source project's JSON (for the SUB-007 diffs), and opening a project off disk is the expensive part of `analyze`. `analyze.ts` now exports `analyzeSource(dir) → { inventory, project }` and `analyze()` is a thin view over it. No behaviour change.

**A text style did not bring its font (real defect, fixed).** `buildInventory` computes a text style's `fileDependencies`, but nothing emitted an edge for it and `plan()`'s closure never walked it — so selecting a text style could import it with no font behind it. The legacy popup *did* handle this (`_markTextStyle` marked the style's file dependencies), so this was a regression introduced by LIB-004's rewrite and surfaced by making the closure the headline feature. Fixed in the engine, in two halves:

- `inventory.ts` now emits a `style → file` edge (`confidence: 'inferred'`, since the evidence is the same string match the legacy heuristic used), so the UI can explain the font's presence and the user can drop it.
- `plan.ts` gained a closure pass pulling every selected text style's file dependencies — run last, over the final style set, so a style pulled in *by a component* is covered too.

Three specs pin it (`tests/import-flow/selection.test.ts`).

**Resources and modules always claimed to be directly requested (real defect, fixed).** `plan()` passed the *accumulated closure* set as the "what did the caller ask for" set for resources and modules — but those sets are seeded from the selection and then grown, so after the closure ran, every resource and module reported `reason: 'requested'` and its `requiredBy` went unexplained. Colours and text styles got this right; resources and modules did not. Invisible until a UI actually rendered "why is this here", which is why LIB-004's own suite did not catch it. Fixed by passing the requested-only sets, and `simpleItems` lost the redundant second parameter that made the mistake easy.

---

## 4b. A test-suite hazard found by running the suite

The LIB-004 notes record that the Electron characterization suite was never actually executed (the worktree/`lerna` trap). Running it revealed a contamination bug that had nothing to do with either task's code but made both look broken:

`projectimport.js`'s *"overwrite reuses the target component id"* loaded `tests/testfs/import_proj1` **in place** as its overwrite target, on the reasoning that a model-only overwrite writes nothing to disk. True of that spec — but the gutted project then sat in the global `ProjectModel.instance`, and under randomized order a later spec that saves the current project wrote it back **over the fixture**. Every subsequent spec reading `import_proj1/project.json` from disk then failed, in a shape that reads exactly like an import-engine regression (`/Main` suddenly has no dependencies and no nodes).

Fixed by copying the fixture to temp first, as the sibling spec already did. The wider hazard — any spec leaving a *fixture-backed* project in `ProjectModel.instance` — still exists for the two read-only collision specs; they do not mutate, so they cannot cause this, but the pattern is worth not spreading.

A second dead spec surfaced in the same suite: *"re-keys imported node ids…"* collected node ids with `forEachNodeRecursive((n) => afterIds.push(n.id))`. `forEachRecursive` treats a truthy callback return as **stop**, and `Array.push` returns the new length — so the walk short-circuited after the first node and `afterIds.length` was permanently 1. The spec asserted 4. It had never been executed, so the assertion had never been evaluated. Braces added.

**Both of these were only findable by running the suite, which is exactly the residual LIB-004 recorded.** It is now discharged.

*(A worktree also needs `node_modules` symlinked at the repo root, `packages/`, **and** `packages/noodl-editor/` before the suite will run at all: `dugite` resolves its git binary through `packages/node_modules`, and without it the Git specs hang the whole run to the 900s timeout.)*

---

## 5. Structure

```
views/ImportFlow/
  ImportFlow.tsx              state machine + chrome (select → review → result)
  ImportFlow.module.scss      token-only styling
  openImportFlow.ts           the imperative seam: modal hosting, apply sequencing
  index.ts
  components/
    SelectStage.tsx           search + folder tree + three-state rows
    ClosurePane.tsx           "what does this drag along, and why"
    ReviewStage.tsx           counts, inline collisions, SUB-007 diff, renames
    ResultStage.tsx           what landed / what undo reverts
  model/                      pure, unit-tested outside Electron
    items.ts                  FlowItem over all six categories; tree; search
    dependencyLinks.ts        links, confidence, deriveInventory (edge drops)
    selection.ts              selection state, row state, resolutions → PlanOptions
    session.ts                loadSource / planSelection — the LIB-004 seam
    summary.ts                plan + result summaries as prose
    targetProject.ts          TargetProject over the live ProjectModel
```

**Hosting decision: modal, via `PopupLayer.showModal`.** A side panel was considered (the spec leaves it open) and rejected: every entry point is already a modal interruption, the flow is transactional — you finish it or abandon it — and re-homing it in the NodePicker means redesigning the NodePicker, which the spec itself names as the scope-balloon risk. The NodePicker hosts an entry point and nothing more, as specified.

**All five entry points converge**, and the plumbing they had each reimplemented (viewer-watch suspension, `importComplete`/`viewer-refresh` ordering, modal teardown) is now written once in `openImportFlow.ts`. It *had* drifted: two call sites emitted the two events in opposite orders, and the URL path built a collision dialog and then threw its answer away. Export reuses the same selection surface with an export frame; the shortcut and the zip output are unchanged.

**Deleted:** `views/importpopup.ts`, `views/importpopup/ImportPopupView.tsx`, `utils/import-engine/legacyAdapter.ts`.

`tests/project/projectimport.js` — LIB-004's characterization suite, and the adapter's last caller — was **ported onto `analyze`/`plan`/`apply` directly** rather than kept alive on a test-local shim. Same behaviours, asserted one layer closer to the code, and it now exercises the real `createTargetProject` adapter instead of a test double.

---

## 6. Verification — what was actually run

| Gate | Result |
|---|---|
| `tsc --noEmit -p tsconfig.json` (editor) | **PASS**, exit 0 |
| `tsc --noEmit -p tsconfig.tests.json` (editor tests) | **PASS**, exit 0 |
| `npm run test:ci` (Electron, randomized order) | **1320 specs, 0 failures**, exit 0 — randomized, seed 51325. Fixtures verified unmodified afterwards. |
| `node scripts/hex-color-ratchet.js` | `noodl-editor` 16 = baseline 16, `canvas-paint-ts` 2 = 2 — **this task adds no literal colour**. The script exits 1 on a `noodl-core-ui` +2 in `Logo.module.scss`, which is **pre-existing on the base commit** (`87b6c6b`, the brand commit) and untouched here. |
| `node scripts/tsfixme-ratchet.js` | `TSFixme` 535 → **530** (deleting the popup removed five). The script exits 1 on `any` +90, which is **identical on the base commit** — 377 before and after this task — from already-merged backend work. |
| `node scripts/lint-ratchet.js` | exit 0 (reports "0 files"; ESLint's ignore config excludes the editor sources in this environment, so this gate is a no-op here and should not be read as a pass) |
| New specs | 23 in `tests/import-flow/selection.test.ts`, registered via `tests/import-flow/index.ts` → `tests/index.ts` |

Five full suite runs were needed, and the first three are worth recording because each failure was real:

1. **Timed out at 900s** in the Git specs. A worktree needs `node_modules` symlinked at the repo root, at `packages/`, **and** at `packages/noodl-editor/` — `dugite` resolves its git binary through `packages/node_modules`, and without it the Git specs hang the entire run.
2. **10 failures.** One was the resource/module `reason` defect (§4); the other nine were collateral from the fixture-contamination bug (§4b).
3. **1 failure** — the dead `forEachRecursive` assertion (§4b), which then reported 5 rather than the asserted 4 because `forEachRecursive` descends *through* a component instance into its graph. That descent only happens because the imported `/Main`'s `/comp1` node resolved to the component imported alongside it, so the corrected assertion now witnesses "references in imported components resolve post-import" directly rather than at second hand.

**Nothing in this task was verified visually.** The editor cannot be launched from a worktree (`lerna exec` resolves to the main checkout), and this is a UI task whose acceptance is inherently visual. The checklist below is written to be executed by someone else, from the primary checkout.

---

## 7. Live-QA checklist (to be executed from the primary checkout)

Prerequisite: two local projects. **A** — the target, opened in the editor. **B** — the source, with at least: a component in a folder that references another component, a component whose name matches one in A, an image or font asset, a colour style, and a text style with a font.

### QA-1 · Import from project — closure is legible and unrepresentably-invalid
1. Project menu → import from project → choose **B**. The flow opens on **Select**; the right pane reads *"Pick something on the left…"*.
2. Tick a component that references another. **Expect:** the referenced component's row shows an **outlined** box and the word `required`; the right pane lists it under "Components" with *"needed by /Yours"*.
3. **Click the required row's box.** **Expect:** it does **not** untick. Focus moves to it and the pane explains its requirer. *(This is Success Criterion 7 — if it unticks, the criterion has failed.)*
4. Untick the requirer. **Expect:** the required row drops to an empty box.
5. Focus a component that uses an image. **Expect:** the pane shows the file under "Files" with a `via` line naming the port, e.g. `Image.src (port type: image)`.
6. Find a link chipped **`guess`** with a `Drop` button (a string-match edge). Press `Drop`. **Expect:** it strikes through and the item leaves the plan — unless something else needs it, in which case it stays. Press `Restore`.
7. Type a folder name in the search box. **Expect:** the tree narrows, folders auto-open, and `Select all` becomes `Select matches`.
8. Continue. **Expect:** the review headline reads e.g. *"3 components, 2 files and 1 color style into A"* and names the destination folders.

### QA-2 · Collision — overwrite is never blind
1. With a colliding component selected, reach **Review**. **Expect:** a card with an amber left edge, the item name, a `component` chip, and a **Keep mine / Overwrite / Rename** control defaulted to **Overwrite**.
2. **Expect** a line reading *"Your version changes: N additions, M removals, K changes"*. Click it. **Expect:** the SUB-007 grouped change list expands inline. *(Success Criterion 2.)*
3. Switch to **Keep mine**. **Expect:** the left edge greys, a `kept yours` chip appears, the diff disappears, and the counts card gains *"1 kept as yours"*.
4. Switch to **Rename**. **Expect:** a name is proposed (`… 2`) and the "Renames" block appears below. Clear the field → footer reads *"Give every renamed item a name."* and the **Import** button disables. Type a name that already exists in A → footer reads *"'X' is already taken."* and Import stays disabled. Restore the suggestion → Import re-enables.
5. Apply. **Expect:** the **Done** stage lists what landed, the renames, anything kept, files written, and the line *"Undo removes the imported components… Files on disk remain."*
6. **Verify the rename actually worked:** open the renamed component in A. Its internal references to other freshly-imported components must resolve. *(Success Criterion 3.)*
7. **Verify one undo step:** Cmd+Z **once**. **Expect:** every imported component/variant/style disappears in a single step. Files on disk remain (this is stated, not a bug). *(Success Criterion 5.)*

### QA-3 · Prefab collision — no more silent drops
1. In a project that already has a colour style named as one a prefab ships, install that prefab from the NodePicker's Prefabs tab.
2. **Expect:** the flow opens (it did not before) with the colliding style listed and pre-set to **Keep mine** / `kept yours`. *(Success Criterion 4.)*
3. Install a prefab that collides with **nothing**. **Expect: no dialog at all** — it installs in one click, as before.
4. Install a **module** that collides. **Expect:** the flow opens with collisions defaulted to **Overwrite** (module semantics differ from prefab deliberately).
5. **Deliberate behaviour change, please confirm which is wanted.** The legacy install path ended with `PopupLayer.hideAllModalsAndPopups()`, which also destroyed the NodePicker itself. That is *not* preserved: the picker now stays open after an install. The reason is that `ModuleCard` runs its own post-install state machine (`Finished` → success toast → back to `Idle` after 3s), which is meaningless if the picker has just been torn down — so the old call looks like collateral from closing the import popups rather than an intended dismissal. **Expect:** after install the card shows Finished, the toast appears, and the picker is still there. If Richard prefers the picker to close, it is one line in `ModuleLibraryModel._install` / `ProjectLibraryModel.importProject`.

### QA-4 · Import from URL — the untick bug is really gone
1. Import from URL with an archive that collides with the open project.
2. **Expect:** components and files are pre-ticked; styles/variants are not (they arrive via the closure).
3. Set a colliding component to **Keep mine**, apply.
4. **Expect:** your version is untouched. *(The legacy path built this dialog and ignored it.)*

### QA-5 · Export
1. **Cmd+Shift+E.** **Expect:** the same selection surface with an export frame and no collision decisions.
2. Select a component with dependencies. **Expect:** the closure pane behaves as in QA-1.
3. Export, choose a directory. **Expect:** a `export-<guid>.zip` identical in shape to before, and an "Export successful" toast.
4. Cancel the directory chooser. **Expect:** *"No destination chosen — nothing was written."*, not a crash.

### QA-6 · Edges
1. Open the flow on a project with **nothing importable** → *"This project has nothing importable in it."*
2. Search for nonsense → *"Nothing matches '…'."*
3. Point the flow at a **corrupt** directory → *"Could not read that project."* with the message, and only a Cancel button.
4. Dismiss with **Escape** and by clicking outside at each stage → no console errors, no orphaned React root, and the caller treats it as a cancel (no error toast).
5. Open, cancel, reopen twice → no duplicated modal, no leaked state.

---

## 8. Residuals — honest list

1. **No visual verification of anything.** Section 7 is unexecuted. This is the headline residual and it is the same one AIX-003 left; the checklist is written to make discharging it mechanical.
2. **`.import-popup-*` CSS rules are now dead** in `packages/noodl-editor/src/assets/css/style.css`. That file is owned by the concurrent UIX-011 agent, so it was deliberately **not** touched. Someone should sweep those rules.
3. **No thumbnails.** Section 3 explains why this is a finding rather than a shortcut; node counts ship instead.
4. **The diff shown is textual, not the annotated canvas.** If live use shows the sentence list is too thin for a real overwrite decision, the upgrade path is `buildReviewComponent` + `ComponentDiffDocument`, at the cost of a full-screen context switch mid-decision.
5. **Three-way merge of an imported component with local edits** — out of scope per the spec; the plan API still leaves room.
6. **Collision diffs are components-only.** Styles, variants, files and modules show a collision and a resolution but no delta, because SUB-007 diffs graphs. A structured value compare for styles would be a small, separate win.
7. **`TargetProject` is a snapshot** taken when the flow opens (resources and modules need a directory listing, and `plan()` is deliberately synchronous). Nothing else writes to the project directory while a modal is up, and `apply()` re-checks the live model, so a stale snapshot can only produce a momentarily wrong *preview*, never a wrong write. Still worth knowing.
8. **No feature flag.** The spec allowed one for the transition; it was not used, because the task's own definition of done is that the old popup is deleted — and it is. A flag would only have created the limbo the spec warns about.
9. **`suggestName` gives up after 999 attempts** and falls back to a timestamp suffix. Not reachable in practice; noted so it is not a surprise.
10. **Export cancel-at-directory-chooser renders as a failure card** ("No destination chosen — nothing was written."). Accurate but slightly stern; a dedicated "abandoned" state would read better.
11. **The NodePicker no longer closes itself after an install** (QA-3 step 5). Deliberate, reasoned, and reversible in one line — but it *is* an observable change and wants Richard's eye.

---

## Live QA executed — 2026-07-26 (orchestrator, primary checkout)

First visual verification of this task. Run against **Shine Phase 2** (target)
importing from **DebtLivePass** (source, 156 components), via
`npm run dev:debug` + CDP. **Zero renderer exceptions.**

### What was confirmed live

**The flow exists and is the flow described in §3.** Reached from the node
picker's *Import from project* tab. One modal, three stages, no second dialog.

- **SELECT** — header `Import from DebtLivePass` + source path; stepper
  `SELECT — REVIEW — DONE` with SELECT as an azure pill; search field
  ("Search components, files, styles…"); `Select all`; `COMPONENTS 156` tree with
  checkboxes, folder and component glyphs; footer *"Nothing selected yet."* with
  **Continue correctly disabled**.
- **The right pane is derived and updates live.** Before selection it reads
  *"Coming along / Pick something on the left and everything it needs appears
  here."* — QA-1 step 1 verbatim. After ticking `Home` it recomputed to *"Your
  selection stands on its own — nothing extra is being pulled in."* + *"Nothing
  extra."*, and the footer became *"1 selected, 1 item in total once dependencies
  are included."* Ticking the child also checked its parent folder.
- **REVIEW** — stepper advanced; headline *"1 component into Shine Phase 2"*;
  *"Components land in /#__page__. Everything here is applied as one undo step."*;
  a `1 Components` count card; an `ARRIVING NEW` block reading *"Nothing in your
  project has these names."* with the row `/#__page__/Home · 2 nodes · component`;
  footer *"Applied as one undo step."* with Back + azure Import.
- **The node count is the honest thumbnail stand-in** and reads well in place.
- **Cancel closes cleanly** — no orphaned React root, no console error (QA-6.4, partial).

### Not covered

- **Collision handling (QA-2) — the whole of it.** The chosen source produced no
  name collision (`/#__page__/Home` does not collide with the target's `/Home`),
  so **Keep mine / Overwrite / Rename**, the `summarizeChanges` roll-up, the
  inline `ComponentDiffView`, and rename validation were never exercised. This is
  the largest remaining gap and needs a source project deliberately built to collide.
- **Success Criterion 7 (a `required` row must refuse to untick)** — the source
  had no cross-component references, so no `required` row ever appeared.
- Import was **not** applied: the target is a real user project and QA should not
  mutate it. So the DONE stage, the one-undo-step behaviour, and post-import
  reference resolution are all still unverified.
- QA-3 (prefab), QA-4 (URL), QA-5 (export) untouched.

---

## Collision QA executed — 2026-07-26 (orchestrator, primary checkout)

The gap left by the first live pass is now closed. Two purpose-built fixtures
(`qa-target` / `qa-source`) were generated with a deliberate collision and a real
dependency closure, rather than importing into a user project:

- `qa-source`: `/Cards/ProfileCard` instantiates **both** `/Shared/Button` and
  `/Shared/Badge`; `/Shared/Button` **collides** with the target's component of the
  same name and has visibly different content so the diff has something to say;
  `/Shared/Badge` is new; colour styles `Brand` (collides) + `Accent`; text style
  `Heading` with a font.
- `qa-target`: `/Home` and `/Shared/Button`, colour style `Brand`.

### Passed

- **Closure + Success Criterion 7.** Ticking `ProfileCard` pulled in Button and
  Badge, footer read *"1 selected, 3 items in total once dependencies are
  included."*, right pane explained *"They are here because something you picked
  needs them, so they cannot be left behind."* **Clicking the required row's box
  did not untick it** — count unchanged, and the pane switched to
  *"/Shared/Button — Required by /Cards/ProfileCard — it comes along with them"*
  with a "Show the whole closure" back link. The criterion holds.
- **Collision surfaced in the Select stage too** — `/Shared/Button` carried an
  amber `collides` chip before reaching Review. Better than the checklist expected.
- **QA-2.1/2.2 — overwrite is not blind.** Amber-edged card, `component` chip,
  Keep mine / Overwrite / Rename defaulted to Overwrite, roll-up *"Your version
  changes: 3 additions, 2 removals"*, and the SUB-007 list expands inline:
  `— Removed Group / — Removed Text / + Added Group / + Added Text / + Added Text`.
- **QA-2.3 — Keep mine.** Everything recomputed: headline 3→2 components, count
  card *"1 overwritten"* → *"1 kept as yours"*, card edge amber→grey, `kept yours`
  chip added, diff removed, and the right pane dropped its `collides` chip. This is
  the "derived, never stored" design visibly paying off.
- **QA-2.4 — Rename**, after the fix below: suggestion `/Shared/Button 2` is clean,
  count card reads *"1 renamed"*, the RENAMES block explains that references follow
  the new names. Validation truth table re-verified: `/Home` (target) → rejected
  inline **and** in the footer; `/Shared/Badge` (another incoming item) → rejected;
  `/Shared/ButtonV2` → accepted.

### Defect found and fixed: every rename collided with itself

`takenComponentNames()` built the "names a rename must avoid" set from the target's
names **plus every planned component's effective name — including the component
being renamed**. So `taken.has(newName)` was true for whatever the user typed, and
the inline *"That name is already taken."* appeared on the auto-suggestion itself
and never cleared. The Rename path was unusable.

It did **not** block Import: the footer's `renameProblem` uses the engine's own
`collides`, which is evaluated correctly. So the UI contradicted itself — a red
error under an enabled button. (An earlier reading of mine claimed Import *was*
disabled; that was a mis-measurement of the project-card "Import" CTAs sitting
behind the modal, not the footer button.)

Fix: `takenComponentNames(plan, target, excludeName?)` skips one component by its
original name (its stable identity), and the parent passes a per-component
`isNameTaken(ownName, name)` to `ReviewStage` instead of one shared set. Suggestion
generation excludes self for the same reason. Excluding by original name stays safe
against renaming onto the target's existing component of that name, because
`target.componentNames` supplies it independently — verified by the truth table.

### Still not covered

- **The import was never applied.** DONE stage, the single-undo-step behaviour, and
  post-import reference resolution after a rename remain unverified.
- QA-3 (prefab install), QA-4 (import from URL), QA-5 (export), QA-6 (edges).
- Colour-style and text-style collisions (only the component collision was driven).

---

## Apply path executed — 2026-07-26 (orchestrator, primary checkout)

The last unverified stretch of this task. An import was **applied for real**, into
purpose-built fixtures (never a user project), and the three things §7 QA-2.5/2.6/2.7
left open are now settled — two of them by finding the behaviour wrong and fixing it.

Fixtures rebuilt by `scripts`-free generator (see below) and **committed** as
`tests/testfs/import_collide_target` / `import_collide_source`, so this stops being a
thing that has to be hand-rebuilt every time.

### Two defects found, both fixed

**1. A renamed component's instances did not follow the rename** (`2d4893d`).
`NodeGraphModel.rerouteComponentRefs` rewrote only `component`-typed **parameters**
(a Router's page). A component **instance** carries its reference in `node.typename`,
which nothing rewrote — so importing `/Cards/ProfileCard` while renaming
`/Shared/Button` → `/Shared/Button 2` left ProfileCard holding a node of type
`/Shared/Button`.

That is worse than a dangling reference in precisely the case rename exists for. The
old name still exists in the target — that is *why* the user renamed instead of
overwriting — so the imported component silently binds to the target's unrelated
component of that name. Success Criterion 3, and the RENAMES block on screen promises
in as many words that "references between the imported components follow the new names
automatically".

Rerouting a typename has to invalidate the memoised `_type`. `updateType()` is the
wrong tool: it writes `typename` back *from* an already-resolved type, so it would undo
the rename whenever the new name has not been grafted in yet. Hence
`NodeGraphNode.retypeTo`, which asserts the name and lets the type re-resolve lazily.
A `component`-typed port with no value also no longer throws on `.startsWith`.

**2. The DONE stage promised an undo it cannot deliver** (`56d6bbf`). It said *"Undo
removes the imported components, variants **and styles** in one step."* Driven live:
after one undo the three imported components were gone and the source's `Brand`
(`#FF00AA`), `Accent` and `Heading` were **still sitting on top of the user's own
styles**. Styles merge through `mergeMetadata`, which `apply.ts` keeps outside the undo
group on purpose (legacy parity) — so the sentence was wrong about the one category a
user is most likely to want back. The note is now built from what actually landed.

**3. An export claimed it had changed your project** (`11c937c`). Export stages the
selection into a throwaway project and zips it, so the `ImportResult` it returns is
shaped like an import's — and the result stage read it literally: *"IN YOUR PROJECT /
1 component into your project"* and *"Undo removes the imported components and variants
in one step."* Nothing reached the open project and there was nothing to undo. The
headline verb was already mode-aware; the body was not. `summarizeResult` now takes the
mode — heading becomes **PACKED**, and the note reads *"Nothing in your project changed
— this was written to the archive."*

### Verified live

| Check | Result |
|---|---|
| QA-2.5 — DONE stage | ✅ "Import complete", `IN YOUR PROJECT` 3 components / 3 styles, `RENAMED ON THE WAY IN /Shared/Button → /Shared/Button 2`, `WRITTEN TO DISK 2 files written` + "Undo does not remove them" |
| QA-2.6 — references resolve after rename | ✅ **after the fix.** `ProfileCard`'s node types read `['Group','/Shared/Button 2','Group','Text','Text','Circle','/Shared/Badge',…]` — it descends *into* the renamed component, so the reference genuinely resolves |
| QA-2.7 — one undo step | ✅ one undo removed all three imported components at once; `/Home` and the target's own `/Shared/Button` survive; undo pointer 1 → 0; files still on disk |
| Colour-style collision | ✅ `Brand` — Keep mine / Overwrite (no Rename, correctly: rename is components-only) |
| Text-style collision | ✅ `Heading`, same control, and the style→file edge pulled `fonts/QASource.ttf` with provenance *"needed by Heading"* |
| Style collisions have no diff | ✅ honest copy: *"Your version will be replaced. A node-level diff is not available for this item."* (residual 6, rendered rather than silent) |
| QA-5.1 — export | ✅ `Cmd+Shift+E`'s handler opens the same selection surface titled "Export components", no collision decisions |
| QA-5.3 — export writes a zip | ✅ `export-<guid>.zip` in the chosen directory — **and turned up a third defect, fixed in `11c937c`** (below) |
| QA-5.4 — cancel the chooser | ✅ *"Export failed / No destination chosen — nothing was written."*, no crash (residual 10 confirmed: accurate, a little stern) |

Undo was driven through `UndoQueue.instance.undo()` — exactly what `Cmd+Z` reaches via
`nodeGraph.undo()`, minus the toast — because CDP has no key-dispatch verb here.

### Pinned as specs, not just observed

`tests/project/projectimportapply.js` (6 specs) covers the `ImportResult` the DONE stage
renders from, one undo group per import, one undo removing every imported component,
post-rename reference resolution, "keep mine", **and explicitly the part of the undo
contract that is not true** (styles and disk writes outlive it). Three more specs in
`tests/import-flow/selection.test.ts` pin the corrected undo note.

**Electron suite: 1346 specs, 0 failures.**

### Trap: HMR from a concurrent session closes the modal

Four times this session an open import modal vanished mid-flow with zero renderer
exceptions. The cause is in `.logs/dev.log`, not in the flow:
`[webpack-dev-server] App updated. Recompiling... / [HMR] Checking for updates` — another
session editing the shared checkout re-mounts the React tree. **Not a product defect.**
Live QA in this checkout is unreliable while other sessions are writing to it.

Two more driving traps worth keeping:
- **`App.instance.exitProject()` from a raw CDP eval blanks the editor** (`ProjectModel.instance`
  is cleared while `EditorPage` is still mounted → `…undefined (reading 'off')` in
  `ProjectDesignTokenContext` / `EditorDocument` unmount effects). The **real** exit button is
  clean — 0 exceptions — because it runs inside React's event batching. Don't report the eval
  version as a bug; I nearly did.
- **`--target=editor` is ambiguous once a preview window exists** and silently attaches to the
  viewer. Use `--target=dashboard`.
- **React re-renders drop a DOM `id` between two CDP calls.** Tag and click in the *same* eval.

### Fixture generator

Deterministic ids, no `Date.now`, reruns byte-identical:
`qa-target` = `/Home`, `/Shared/Button` (bg `Brand`), colours `Brand #111111` + `Target Only`,
text style `Heading` → `fonts/QATarget.ttf`.
`qa-source` = `/Cards/ProfileCard` (instantiates `/Shared/Button` **and** `/Shared/Badge`, plus
an `Image` on `assets/qa-image.png`), `/Shared/Button` (visibly different, 4 nodes), `/Shared/Badge`,
`/Home`, colours `Brand #FF00AA` (collides) + `Accent`, text styles `Heading` → `fonts/QASource.ttf`
(collides) + `Caption`, one `Group` variant. Both `"version": "4"`, `runtimeVersion` `react19`.
The committed copies under `tests/testfs/` are the same pair.

### Driving the native directory chooser

QA-5.3/5.4 look unreachable headlessly — the picker is a native dialog and blocks the
renderer. They are not: stub it.

```js
const fsmod = __m('./src/editor/src/utils/filesystem.js');   // exports `instance`, no default
fsmod.instance.chooseDirectory = (cb) => cb('/some/dir');    // or cb(undefined) to cancel
```

The same trick reaches any `openDialog`/`chooseDirectory` gate in the editor.

### Still not covered

- QA-3 (prefab install — incl. the deliberate "picker no longer closes itself" change that
  wants Richard's eye), QA-4 (import from URL), QA-6 (edges).
- The `.import-popup-*` dead CSS sweep (residual 2) — `style.css` is still contended.

---

## 9. Residual 2 closed, and LIB-001's artefact graded (2026-08-02)

Two headless residuals, done in one pass from a worktree. Neither could open the editor,
and neither claims anything that needs one.

### 9.1 The `.import-popup-*` sweep — deleted, with the evidence

The file is `packages/noodl-editor/src/assets/css/style.css`, not
`src/editor/src/assets/css/style.css` as §8 recorded it. Nine selectors in eight rules, all
under the `Import popup` banner, all gone:

| Rule | Last referenced by |
| --- | --- |
| `.import-popup-text` | `ImportPopupView.tsx:238,253,271` |
| `.import-popup-item` | `ImportPopupView.tsx:140` |
| `.import-popup-folder` | `ImportPopupView.tsx:160` |
| `.import-popup-folder .sidebar-panel-dark-input`, `.import-popup-item .sidebar-panel-dark-input` | both ancestors above |
| `.import-popup-implicit-check` | `ImportPopupView.tsx:116` |
| `.import-popup-import-check` | `ImportPopupView.tsx:117` |
| `.import-popup-button`, `.import-popup-button:hover` | **nothing, ever** — already dead before LIB-005 |

The evidence is not a prefix match. Each fragment (`import-popup`, `popup-button`,
`popup-text`, `popup-item`, `popup-folder`, `implicit-check`, `import-check`) was grepped
across the whole repo — every extension, not just `.ts`/`.tsx` — and then across **all of git
history** with `git log --all -S`, which is what identifies the one caller that mattered.

The concatenation worry turned out to be answerable rather than merely feared. At
`8eb03597^` the only non-literal use was

```tsx
(isImplicit ? ' import-popup-implicit-check' : '') +
(isImport ? ' import-popup-import-check' : '')
```

— a ternary over two whole literals. The class *name* is never assembled from pieces, so a
literal grep is complete here, and the repo has no `className={'x-' + y}` construction at
all (checked). `views/ImportFlow` uses CSS modules and references none of these.

**Left in place, deliberately:** `.show-on-edit`, which sat inside the same banner. It is
unreferenced repo-wide by the same standard of evidence — but `git log -S` dates it to
PLAT-002 waves 2e/2g (pickers, colour picker), not to the import popup at all. It is
somebody else's dead rule and a different owner's story; the banner above it is now
`Misc` rather than `Import popup` so it no longer reads as import's.

### 9.2 LIB-001 Criterion 5 — the headless half, and **only** the headless half

`npm run library:build` was green (29 prefabs, 29 modules). That proves zips were written.
It does not prove one could be installed, so there is now
**`npm run library:verify-dist`** (`scripts/library/verify-dist.ts`) which grades the
artefact instead of the sources: it serves `library-dist/` over loopback at the exact path
the editor fetches from, and walks the real install chain against it.

The point of the design is that it does **not** re-implement the contract. It esbuild-bundles
`modulelibrarymodel.ts` with every import replaced by a recursive no-op proxy except three
(`@noodl/platform` → a real `getVersion`, `getDocsEndpoint` → the local server,
`addHashToUrl` → the real one-liner), then calls the editor's own
`ModuleLibraryModel.prototype.fetchModules` and its own `isModuleCompatible`. Nothing in the
module body runs at import time, so the proxies are never touched. A twin of a fetch/parse
contract is exactly the thing this repo has been bitten by before.

Result, for all 58 entries: index fetches and parses to an array; every entry carries
`label`/`desc`/`project`/`icon`/`docs`/`tags` (so no `ModuleCard` destructure can throw);
`type` matches the tab **and** agrees with the legacy `project.includes('/prefab')` fallback;
`version`/`minEditorVersion`/`runtimeVersion` are semver triples and `isModuleCompatible`
says yes for editor `0.1.0`; every `project` and `icon` URL resolves 200 under `ModuleCard`'s
own `startsWith('http') ? url : endpoint + '/' + url` rule; and every zip unpacks via JSZip,
contains a `project.json` where `getModuleTemplateRoot`'s recursive search would find one, and
loads through the SUB-006 project loader.

The harness was proved able to fail: a mutated `library-dist` (bumped `minEditorVersion`,
flipped `type`, deleted `icon`, deleted a zip, `"1.2"` as a version, an object where the index
should be) produced six distinct failures, one per injury.

**This is not Criterion 5.** What it still needs, precisely:

1. A local docs origin on **127.0.0.1:3000** — the editor's `main.js` probes
   `http://127.0.0.1:3000/<major>.<minor>/version.json` and only switches endpoint when the
   answer is `{"kind":"noodl-docs"}`. `ts-node scripts/library/verify-dist.ts --serve --port 3000`
   *is* that stub: it answers the marker and serves `library-dist/` under `/library/`.
2. A live editor, a project open, the node picker's Prefabs and Modules tabs.
3. One prefab cloned and one module installed, each landing on disk and in the components /
   node panels and surviving a reload.

Steps 2–3 need Electron. Nothing here substitutes for them.

### 9.3 One defect found and fixed in the loud-failure path

LIB-001 step 0 replaced the silent `[]` with `loading`/`loaded`/`error` + Retry. Reading the
path rather than trusting the summary: a 200 carrying **truncated** JSON already rejected
(`response.json()` throws) and reached `error` correctly. But a 200 carrying a JSON
**object** — a CDN `NoSuchKey` body, a half-published index — parsed fine, resolved, and set
`modulesStatus = 'loaded'` with a non-array `modules`. `NodePickerSearchView` guards *every*
branch on `Array.isArray`, so the panel then rendered no grid, no spinner, **and no error**:
a silently blank library with no Retry to escape it. The exact failure step 0 exists to
abolish, reached by a different door.

`fetchModules` now rejects when the parsed body is not an array. The harness carries the
regression test as a self-check (two fixture routes, `__notarray__` and `__badjson__`), and
that self-check was verified against the pre-fix code: reverting the guard makes
`library:verify-dist` report *"fetchModules resolved on 200 with a JSON object instead of an
array — the library would render silently blank"*. It also refuses to accept a `TypeError` as
a pass, so a broken stub cannot make the self-test vacuously green.

### 9.4 Two latent mismatches, reported not fixed

- **`build.js` accepts a v2-only entry that `getModuleTemplateRoot` cannot install.** The
  build permits `project/` with `components/` and no `project.json`; the editor's
  `findProjectRoot` searches only for `project.json` and rejects `Not a valid component`
  otherwise. No current entry hits this (all 58 have `project.json`), so it is latent — but
  the first v2-authored library entry will be uninstallable with a misleading error.
- **`icon` is optional in `schema.json`/`build.js`, required in `IModule`, and dereferenced
  unguarded** by `ModuleCard` (`icon.startsWith('http')`). An entry authored without an icon
  would throw at render. Every current entry has one. `library:verify-dist` fails on a missing
  `icon` so this cannot ship silently.

### 9.5 Deviation

`tsconfig.json` gained `@noodl-versioning` / `@noodl-versioning/*`. CAN-002 declared those
aliases only in `packages/noodl-editor/tsconfig.json`, so `npm run typecheck` — which runs the
*root* program — had **18 pre-existing TS2307s** in eighteen files nobody in phase 21 has
touched. The two mappings are copied verbatim from the editor's tsconfig and take the root
typecheck to zero. Out of scope, but the alternative was reporting a green branch against a
red gate. Droppable in one hunk if it collides.

### 9.6 Could not verify

- Anything requiring Electron: the live install (Criterion 5 proper), the jasmine suite, and
  the QA-3/4/6 checklist items from §8 that remain open.
- That the swept CSS is unreferenced by **uncommitted** work in the primary checkout. The
  evidence covers committed history and the working worktree only.
