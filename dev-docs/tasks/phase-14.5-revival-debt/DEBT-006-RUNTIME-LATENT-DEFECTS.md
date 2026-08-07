# DEBT-006: Runtime Latent-Defect Batch

## Metadata

| Field | Value |
|-------|-------|
| **ID** | DEBT-006 |
| **Phase** | Phase 14.5 — Revival Debt |
| **Priority** | 🟡 Medium |
| **Difficulty** | 🟢 Easy (per item; the batch is volume, not depth) |
| **Estimated Time** | 3–5 days |
| **Prerequisites** | DEBT-001 (same findings list; land the critical one first) |
| **Recommended executor** | 🟢 **Sonnet 5** — every root cause is precisely documented in PLAT-003-NOTES; each fix is local and mechanically verifiable. Escalate only if a "decide" item turns contentious |

## Objective

Work through PLAT-003's accumulated findings ledger — every latent defect the typing pass logged and deliberately did not fix — so the list ends the phase empty instead of eleven-deep.

## Background

PLAT-003's discipline was correct: a typing slice that also changes behaviour is unreviewable, so findings were logged (§9.3, §11.3, §13.3, §15.3, §17.7 of [PLAT-003-NOTES.md](../phase-14-editor-platform-health/PLAT-003-NOTES.md)) and deferred to "a tidy batch." This is the batch. DEBT-001 takes the critical one (cloudfunction2); everything else lands here. All files are in `packages/noodl-viewer-react/src/nodes/std-library/` unless noted.

## The ledger

**Fix (user-visible effect):**

- [ ] **Pop Component Stack's `backAction-…` inputs throw a `ReferenceError`** (§19.4 #1, found
  by slice 8) — [navigate-back.ts](../../../packages/noodl-viewer-react/src/nodes/navigation/navigate-back.ts)
  builds the setter with `_createSignal`, an identifier defined nowhere in the repository, and
  the ports *are* reachable (its own `setup` publishes one per `backActions` entry) — any
  project using Back Actions dies at load. The intended shape is
  `EdgeTriggeredInput.createSetter`, used correctly by `closepopup.ts`. Remove the
  `@ts-expect-error` that marks the site when fixing.
- [ ] **Component Stack URL writing ignores custom page paths** (§19.4 #2) — `getRelativeURL`
  reads `top.pageInfo.path` (a `_findPage` result that never carries `path`) while
  `matchPageFromUrl` reads `_internal.pageInfo[id].path` (which does). Inbound URLs match a
  custom `pagePath-…`; written URLs always use the label slug. Align the write path with the
  match path.
- [ ] **`def.deprecated` silently dropped** (§9.3) — the catalog reports `isDeprecated: false` for nodes that declare `deprecated: true` (Form, Label). Also poisons what AI agents read via SUB-004's catalog. **Changes `node-catalog.json` — own commit, gated on `catalog:check`.**
- [ ] **`Noodl.runDeployed` never set** (§11.3) — deploy bootstrap sets `Noodl.deployed`, so the editor-only skip never fires and **tooltip HTML is built and shipped inside deployed apps**. Notes call it "the cheapest" fix. Changes deployed output — verify with a `deployToFolder` diff.
- [ ] **`getInspectInfo` bare-value cluster** (§13.3, §17.7 #4) — inspectors returning bare boolean/number/object render nothing: Switch, Number Remapper, Animate To Value, and `variablenode2` for non-string variables. Fix the wrapping once, apply across the cluster. (The runtime-package `and`/`or`/`expression` siblings: fix if trivial, else note for the runtime std-library conversion.)
- [ ] **`Upload File.getInspectInfo` reads `_internal.response`, which nothing writes** (§13.3) — wire the write or drop the inspector.

**Decide, then fix or delete (dead/misleading code):**

- [ ] **`def.frame` dead path** (§9.3) — nothing sets it; `useFrame` is always false, the `Layout.size/align` pass and `textStyle` merge never run. Decide: resurrect or delete the path.
- [ ] **`foreachactions.itemActionTriggered` calls `signalItemAction`, which no node defines** (§17.7 #2) — "dead *and* broken"; the registering `setup` block is commented out. Delete.
- [ ] **`collectionnode2` has no `store` input** (§17.7 #3) — three paths test `isInputConnected('store')`, `scheduleStore` exists to serve it, the port is never declared; "a quarter of the file is answering a question nobody asks." Decide: declare the port (feature) or delete the machinery (recommend delete — declaring a port is a product decision this task shouldn't make).
- [ ] **`collectionnode-new.setCollectionID` + `id`-output fallback unreachable** (§17.7 #5) — no `collectionId` input exists. Delete.
- [ ] **Dead write** `setparentcomponentobjectproperties` → `_internal.parentComponentName` (§15.3); **misnamed guard flags** in `verifyemail`/`resetpassword`/`requestpasswordreset` (§15.3). Tidy.
- [ ] **`PopupTransition.update` reads `this.crossfade`, which nothing assigns** (§19.4 #3) — copied from `PushTransition` along with the zoom branch, so the In/Out popup transition never fades and the node's real `tr-fadein` parameter is only honoured by the translate branch. Decide: wire `fadein` into the In/Out branch or delete the dead read.
- [ ] **Delete [persisthelper.js](../../../packages/noodl-viewer-react/src/nodes/std-library/data/persisthelper.js)** (§17.6) — orphaned, 307 lines, the last `.js` in `data/`. One commit.
- [ ] **`QueryBuilder` `id` vs `objectId`** (§4) — 4 failing tests in [QueryBuilder.test.js](../../../packages/noodl-runtime/test/adapters/QueryBuilder.test.js); the LocalSQL adapter emits `"id"` where tests expect `"objectId"`. This is a *decision* ("stale test or real adapter bug"): check what CloudStore consumers and deployed data actually key on, decide, align, record.

## Verification gates

- `npm run catalog:check` after any change touching node definitions (the PLAT-003 regression gate).
- The runtime jest baseline (225/20, or DEBT-003's improved figure) must not lose passing tests; QueryBuilder resolution should convert its 4 failures.
- One `deployToFolder` diff for the `runDeployed` fix.
- PLAT-003-NOTES ledger annotated item-by-item as resolved.

## Success Criteria

- [ ] Every ledger item above fixed or closed with a recorded decision — none left merely "logged"
- [ ] `catalog:check` green; deprecated flags now truthful in `node-catalog.json`
- [ ] No editor-only HTML in deployed output
- [ ] Jest baseline improved or unchanged, never worsened

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| PLAT-003 conversion overlap | Conversion of `src/nodes/` completed with slice 8 (navigation/), so the node files are stable; still, note each commit in PLAT-003-NOTES so the two efforts don't collide |
| "Delete the dead machinery" removes something a module secretly used | Grep the corpus projects and `noodl_modules` for the symbols before deleting; the SUB-009 corpus is the best available reality check |

## References

- [PLAT-003-NOTES.md](../phase-14-editor-platform-health/PLAT-003-NOTES.md) §9.3, §11.3, §13.3, §15.3, §17.6, §17.7, §19.4 — the ledger
- Related: DEBT-001 (finding #1), DEBT-003 (§4's expression cluster)

## New input from DEBT-002 (2026-07-24)

- **Runtime-detection false positive (unconfirmed):** `DebtLivePass`, a fresh Quick Start
  project with `runtimeVersion: "react19"` in project.json (detection check 1, high
  confidence), showed the "Legacy Project (React 17) — Read-Only Mode" banner after 150
  components were added on disk and the project reopened. If reproducible, fresh projects
  can spuriously lock read-only. Suspects: the `project_runtime_cache` store vs. the
  detection path in `models/migration/ProjectScanner.ts` / `utils/LocalProjectsModel.ts`.
  Reproduce in a quiet session before hunting.
