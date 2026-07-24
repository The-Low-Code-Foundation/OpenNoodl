# WF-007: Retire the Parse Framework

## Metadata

| Field | Value |
|-------|-------|
| **ID** | WF-007 |
| **Phase** | Phase 19 — Cloud & Workflows (Revival Track G) |
| **Priority** | 🟡 Medium (debt removal; unblocked by WF-004's wire-protocol work) |
| **Difficulty** | 🟢 Easy to 🟡 Medium (deletions are easy; the endpoint-config relocation needs care) |
| **Estimated Time** | ~1 week |
| **Prerequisites** | WF-004 (Parse-wire subset live, incl. `/functions`); one exception below can run anytime |
| **Branch** | `task/wf-007-parse-retirement` |
| **Recommended executor** | 🟢 **Sonnet 5** — the 2026-07-24 framework map enumerates every deletion target with call-site evidence; the one design item (where endpoint config moves) is decided here. |

## Objective

Delete the Parse-era management framework — the CloudServices model and panel, the master-key deploy pass, the hidden-window cloud-function server, and the orphaned Parse Dashboard package — now that the wire protocol, not the framework, is the compatibility contract.

## Background

The 2026-07-24 framework map (recorded in [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §3.4) established that "Noodl cloud services" was never a server in this repo — only a set of Parse-REST clients plus editor machinery for pointing them at an external server. WF-004 makes `nodegx-backend` speak the Parse-wire subset those clients emit, which means:

- The **clients stay** (`cloudstore.js`, `userservice.ts`, `cloudfunctions.js`, `configservice.js`) — they are now the contract the record/user/function nodes ride, against local *and* external backends alike.
- The **management framework goes** — it manages a relationship (external Parse endpoints, master-key deploys, a dev-time sandbox window) that the standalone service replaces.

The deletions are safe *because* of WF-004's protocol work, with one design obligation: users still need a place to set a project's backend endpoint (local backend, a deployed `nodegx-backend`, or a legacy external Parse server). That capability relocates before its old home is deleted.

## Current State (from the framework map — verify counts before deleting)

| Target | What it is | Size / evidence |
|---|---|---|
| `packages/noodl-parse-dashboard/` | Vendored Parse Dashboard web app; **zero references from editor source** | ~44 KB source + vendored deps; orphaned |
| `models/CloudServices/` (`CloudService.ts`, `ExternalCloudService.ts`, `type.ts`, `index.ts`) | Singleton managing external endpoints in `JSONStorage 'externalBrokers'` (no broker exists; the name is a fossil) | ~7 KB |
| `views/panels/CloudServicePanel/` | Create/edit external Parse environments UI | 9 files, ~48 KB |
| `views/panels/CloudFunctionsPanel/` | Legacy cloud-functions panel | ~4 KB |
| `hooks/useActiveEnvironment.ts` + `DeployPopup.hooks.ts::useEnvironmentsAsOptions` | Environment dropdown plumbing | small |
| `utils/compilation/passes/deploy-cloud-functions.ts` | POSTs exported `/#__cloud__/` components to `<env>/functions-admin/deploy` with `X-Parse-Master-Key` | 98 lines |
| `main/src/cloud-function-server.js` + `src/external/cloudruntime/` bundle | Port-8577 main-process server proxying `/functions/<name>` into a hidden BrowserWindow running the cloudruntime — today's dev-time cloud-function runner | 266 lines + bundle |
| `cloudfunctions.js:53` / `cloudfunction2.ts:227` | Hardcoded redirect to `:8577` when running locally | 2 call sites |
| `GitStats.ts` in `models/CloudServices/` | **Unrelated to Parse** — must survive the folder deletion (relocate) | small |

Keep (not this task's to touch): the four runtime clients, the 9 record nodes + user nodes, `cloudservices` project metadata (`projectmodel.editor.ts:186-211`) and its injection into deployed apps (`utils/exporter/json.ts`), BYOB nodes + `BackendServices` model/panel.

## Desired State

- **Endpoint config relocated:** the Backend Services panel (or Project Settings) owns "connect this project to a backend": pick a running local backend (auto-fills `cloudservices` from it — WF-004 ships the auto-set seam), or enter an external endpoint `{endpoint, appId}` manually for deployed/legacy servers. Master keys are not stored — the one consumer (the deploy pass) is deleted; anything master-key-shaped later belongs to WF-003's deploy hardening.
- **Cloud functions in dev run through the service:** the `:8577` redirect in the two client call sites points at the local backend's `/functions` route; `cloud-function-server.js` and the cloudruntime sandbox window are deleted. One function runtime (CloudRunner inside `nodegx-backend`), not two.
- Everything in the deletion table above is gone; `GitStats.ts` relocated; no dangling imports; packaged app verified.
- A short migration note in the changelog for anyone who used external Parse: their projects keep working (protocol compat), only the *management UI* moved.

## Scope

### In Scope
- [ ] Delete `packages/noodl-parse-dashboard/` — **orphaned; may be done anytime, even before WF-004**
- [ ] Relocate endpoint config into BackendServicesPanel/Project Settings; migrate any existing `externalBrokers` storage entries (drop stored master keys, with a release-note line)
- [ ] Repoint the two `:8577` call sites to the local service's `/functions`; delete `cloud-function-server.js` + `external/cloudruntime/` + its `main.js` wiring
- [ ] Delete CloudServices model (relocating `GitStats.ts`), CloudServicePanel, CloudFunctionsPanel, `useActiveEnvironment`, `useEnvironmentsAsOptions`, `deploy-cloud-functions.ts` + its call site in the compilation pipeline
- [ ] Sweep for dangling imports/routes (`router.setup.ts` panel registrations); typecheck + packaged-app verification
- [ ] Release-note/migration paragraph

### Out of Scope
- The four runtime Parse clients and every data/user node (they are the contract now)
- Deleting `cloudservices` project metadata (still the pointer the clients read)
- Any new deploy machinery (WF-003)

## Success Criteria

- [ ] A project can target a local backend or an external endpoint through the relocated UI; Query Records / login / Cloud Function nodes work live against the local service
- [ ] `grep -ri "parse" packages/noodl-editor/src` returns no management-framework hits (clients/nodes excepted)
- [ ] Port 8577 no longer exists; cloud functions in dev execute via `nodegx-backend`
- [ ] Editor builds, typechecks, and the packaged app passes a smoke run
- [ ] Migration note published

## Risks & Mitigations

| Risk | Mitigation |
|------|------------|
| Deleting the panel strands users who point at external Parse servers | Relocation lands **before** deletion, in the same task; storage entries migrated |
| The `:8577` runner has behavior the service's `/functions` path lacks (request shaping, session context) | Diff the two request paths first; `cloud-function-server.js` is 266 readable lines — reconcile before deleting, and record differences |
| `GitStats.ts` or another stowaway dies with the folder | The map flagged it; move first, delete second; typecheck is the net |
| Hidden consumers of `externalBrokers` storage | Grep the storage key before migrating; the map found only `ExternalCloudService.ts` |

## References

- [BACKEND-GAP-ASSESSMENT.md](./BACKEND-GAP-ASSESSMENT.md) §3.4 — the wire-protocol decision and framework map summary
- WF-004 (the protocol + auto-set seam this depends on), WF-003 (deploy hardening), RUN-003 (BYOB/external backends)

## Checklist

- [ ] (Anytime) delete `noodl-parse-dashboard`
- [ ] Relocate endpoint config + migrate storage
- [ ] Repoint `:8577` call sites; delete function server + cloudruntime bundle
- [ ] Delete model/panels/hooks/deploy pass; relocate `GitStats.ts`
- [ ] Sweep, typecheck, packaged-app smoke; migration note; CHANGELOG
