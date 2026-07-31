# BCN-009 step 2 — one storage for "which backend is this project's"

**Scope**: BCN-009 implementation step 2 only — *"Converge the two metadata keys, with a migration for
existing projects."* Steps 1, 3, 5 and 6 shipped in [BCN-009-NOTES.md](./BCN-009-NOTES.md); step 4 is
discussed in §7 but not built here; step 7's live pass for *this* change is §6.

**Branch**: `wt-bcn009`, based at `ff7a3675`. Editor only — nothing in `packages/noodl-runtime` or
`packages/nodegx-backend-contract` is touched. §8 is the list of runtime changes this work **requires
somebody else to land**, with the exact file and edit.

---

## 1. The defect, and what it actually was

A project had **two** active backends. `cloudservices` bound the record, auth and file nodes;
`backendServices.activeBackendId` bound the BYOB ones. They were independent, and both could be set at
once pointing at different servers, with nothing in the product saying so.

It surfaced three ways in one week, each found independently:

| Where | Symptom |
|---|---|
| [BCN-009-LIVE-QA §3.1](./BCN-009-LIVE-QA.md) | **Two ACTIVE badges** at once, nothing distinguishing them |
| [BCN-009-LIVE-QA §3.2](./BCN-009-LIVE-QA.md) | The endpoint card said **ACTIVE for a backend that was Stopped** |
| [BCN-009-LIVE-QA §3.3](./BCN-009-LIVE-QA.md) | The **first external backend went active on creation**, skipping the switch dialog |
| [BCN-004-NOTES-STEP5 §2.1](./BCN-004-NOTES-STEP5.md) | `hideWhenSingleBackend` nearly counted built-in-plus-Directus as **one**, which would have hidden the picker and silently moved every Record node onto Directus |

All four are the same fact. They are all closed, and all four were verified in a running editor (§6).

---

## 2. ⚠️ The headline deviation: the *selection* converged, the *configuration* did not

[BCN-009-NOTES §5](./BCN-009-NOTES.md) proposed one `backends` key holding `{active, items[]}`, with the
endpoint's `{endpoint, appId, type}` folded into `items` as `{url, appId, type}`. **That is not what
shipped.** What shipped is:

- **one selection** — `backendServices.activeBackendId`, which may now name the endpoint;
- **two configurations, unchanged** — `cloudservices` still holds the endpoint's URL and app id;
  `backendServices.backends` still holds the REST configs.

### Why

**The ambiguity was never in the configuration.** Two configuration homes with one selection pointer is
untidy. Two *selection* pointers is a project whose own product cannot say where its data goes — that is
what produced all four symptoms above, and moving the endpoint's URL into another key fixes none of them.

**And the configuration move is not editor-only.** `cloudservices` is read or written in eight places
outside this task's territory:

| File | What it does with it |
|---|---|
| `models/projectmodel.editor.ts` | `getCloudServices`/`setCloudServices` — the only writer |
| `utils/exporter/json.ts` (4 sites) | injects it into the export, inlined into `index.js` via `{{#export#}}` |
| `utils/compilation/build-context.ts` | the deploy-time endpoint |
| `utils/projectmerger.diff.ts` + 3 VersionControlPanel files | a first-class diff category with its own revert |
| `views/DeployPopup/.../DeployToFolderTab.tsx` | the deploy target |
| `noodl-runtime` Parse clients | read it directly, not through the contract |

Changing that shape is a cross-cutting edit landing in one commit with the runtime reader — precisely the
spec's own trap: *"a project that half-migrates resolves a backend that does not exist and every data node
fails at once."* Four other workers were in flight in three of those files' neighbourhoods.

**Recorded as a deviation rather than as done.** If the configuration merge is still wanted, it is a
separate task with a much wider blast radius, and it should be judged on its own merits now that the
defect it was proposed to fix is closed without it.

---

## 3. ⚠️ How `_endpoint_` survives — the single highest-risk thing, answered first

`ENDPOINT_BACKEND_ID = '_endpoint_'` is a synthetic id the **runtime** invents in
`api/backends/resolveBackend.ts` for the `cloudservices` pointer. Every Record-family node's `Backend`
picker can already hold it as a **saved node parameter**. The editor had never heard of it.

**It survives because the convergence adopts it rather than replacing it.**

`backendServices.activeBackendId` is now allowed to hold the string `'_endpoint_'`, meaning exactly what
it already means to the runtime. Nothing is re-keyed and nothing is rewritten.

### The conversion table, precisely

| Before (any build up to `ff7a3675`) | After | Node parameters |
|---|---|---|
| A node parameter `backendId: '_endpoint_'` | **unchanged** — same string, same meaning, resolved by the same runtime function | untouched |
| A node parameter `backendId: '_active_'` or unset | **unchanged** — resolves through `defaultBackendId` | untouched |
| A node parameter `backendId: 'backend_x'` | **unchanged** | untouched |
| `cloudservices: {endpoint, appId, type}` | **unchanged, in place** | — |
| `backendServices.activeBackendId: undefined` | may become `'_endpoint_'` on the next save | — |
| `backendServices.activeBackendId: 'backend_x'` | unchanged unless the user switches | — |
| *(absent)* | `backendServices.version: 2` on the next save, when it is safe (§4) | — |

**No node parameter changes value, ever.** That is the whole migration for saved picker values, by
construction, and it is pinned in `tests/models/BackendSelection.test.ts` ("is the runtime's id,
unchanged" / "is storable as the project's selection") plus a live round-trip in §6.4.

`ENDPOINT_BACKEND_ID` is now declared in **two** places — `activeBackend.ts` (editor) and
`resolveBackend.ts` (runtime) — deliberately, because the editor does not depend on `noodl-runtime` and
importing it for one string is a heavier coupling than the string is worth. Both docblocks say the value
is part of the saved project format and must not change. A test asserts the literal.

---

## 4. The version marker, and when the migration refuses

### Why there is a number in the metadata

Legacy and converged metadata are **byte-identical** in the one case that matters:

```jsonc
{ "activeBackendId": "backend_x", "backends": [...] }   // + a cloudservices endpoint
```

- **Legacy reading**: "`backend_x` binds the BYOB nodes; the endpoint binds the record, auth and file
  nodes." (Two actives.)
- **Converged reading**: "`backend_x` is the project's backend."

Nothing in the bytes distinguishes them, so a reader that guesses is a reader that silently repoints
somebody's data nodes. Hence `backendServices.version`. `>= 2` means "read `activeBackendId` first";
absent means "resolve exactly as before". **The two rules coexist, so the migration and its readers can
land in either order** — which is what the spec's trap asks for.

### When it writes

- **Never on load.** F46 (the autosave allowlist) exists because a load-time write is indistinguishable
  from an edit. `initialize()` reads and derives; it writes nothing. Verified live in §6.2.
- **On the next deliberate save**, in `saveToProject`, and only when converging is
  **semantics-preserving** — the value it records is the one both node families already resolve, so the
  write itself moves nothing.
- **Idempotent**: `version >= 2` short-circuits `selectionConflict`, and re-deriving a converged
  selection returns it unchanged.

### The one case it refuses

`selectionConflict()` names it: an unversioned project with an endpoint **and** an `activeBackendId`
naming a real REST backend. Either value written as *the* selection silently repoints a family of nodes:

- recording the endpoint moves every BYOB node off the backend it is using;
- recording the BYOB backend moves every Record, auth and file node onto it.

So the metadata stays legacy, the panel shows **one** ACTIVE badge (the endpoint — what the record, auth
and file nodes actually use, matching the runtime's `defaultBackendId` exactly) and says the rest out
loud on both cards:

> Rig Custom is still bound to this project's Data nodes from before backends were one list, while
> Built-in backend is what everything else uses. Set one of them active to make it the whole project's
> backend.

Not red, not a banner, and the resolution is the `Set active` button already on the card. Seen rendered
in §6.3.

### What happens to a project saved before this change

| The project has | On open | On first save | What the runtime resolves |
|---|---|---|---|
| nothing | nothing written | `version: 2`, `activeBackendId: undefined` | nothing — unchanged |
| an endpoint only | nothing written | `version: 2`, `activeBackendId: '_endpoint_'` | the endpoint — unchanged |
| BYOB backends only | nothing written | `version: 2`, `activeBackendId` unchanged | that backend — unchanged |
| an endpoint + BYOB backends, none active | nothing written | `version: 2`, `activeBackendId: '_endpoint_'` | the endpoint — unchanged |
| **an endpoint + an active BYOB backend** | nothing written | **nothing converged**; legacy shape preserved | the endpoint for record/auth/file, the BYOB backend for BYOB — unchanged |

Every row's last column reads "unchanged". That is the safety argument, and it is the reason the
migration is three lines rather than a rewrite.

---

## 5. Deviations and decisions, with reasoning

| # | What | Decision | Why |
|---|---|---|---|
| 1 | The converged shape | Selection only, not configuration | §2 |
| 2 | **The silent first-activation** | ⚠️ **In scope, and fixed** | See below — it is not optional under a converged selection |
| 3 | The `_endpoint_` picker label | Fixed **in the editor**; the runtime picker's label is §8.3 | The editor's copy is the panel; the dropdown's label is composed in the runtime and is not mine |
| 4 | `buildBackendList`'s `managed` entries | Never `isActive` | A managed backend is a *process*; it becomes the project's backend by writing the endpoint, and the endpoint entry is what the selection names. Matching on the port made one server two active entries — the two-badge defect in the model rather than the view. `LocalBackendCard` has never drawn a badge, so this is also what the panel already looked like |
| 5 | `BackendListSources.activeExternalId` → `activeBackendId` | Renamed, and it is the **resolved** id | Re-deriving it from a subset of the inputs is how the panel would come to draw a badge on a card the runtime is not using. One derivation, in `activeBackend.ts`; everything else reads it |
| 6 | The endpoint card's accent border | Follows the selection instead of being permanent | Same premise as the badge: the card assumed it was the project's backend |
| 7 | The endpoint card's green tick | Reads the managed process list, and says **"stopped"** when it is | Live-QA 3.2's other half. `cloudservices` cannot know; the panel can, and does |
| 8 | The switch dialog | Widened to the endpoint on **both** sides | Before, the endpoint was active-by-existing, so built-in↔Directus — the largest switch in the product — was the one switch with no comparison in front of it |

### 5.1 ⚠️ The silent first-activation — the explicit decision asked for

**It is in scope for this task, and it is fixed.** Stated plainly because the brief asked for an explicit
answer either way.

It is not a judgement call about polish. Under the old rule — `if (this._backends.length === 1)` — a
newly created backend became active whenever it was the first *`backendServices`* entry, counted **without
reference to the endpoint the project was already using**. That was survivable while `activeBackendId`
only bound the BYOB nodes. The moment the selection converges, the same line means "adding a backend
silently repoints every Record, auth and file node in the project". Shipping the convergence without
fixing it would have *created* a defect.

The new rule, in `shouldActivateOnCreate`:

- **A new backend becomes active only when the project had no active backend at all.** Then there is
  nothing to compare against, a comparison dialog would have one column, and the add dialog has already
  shown that backend's disclosure before Create was pressed.
- **In every other case it is created inactive**, with a `Set active` button that goes through the switch
  dialog.

This also makes the two-active state unreachable going forward: the only way to reach it now is a project
saved by an older build.

---

## 6. Live pass — run in a real editor, from this worktree

⚠️ **[BCN-009-NOTES §6.1](./BCN-009-NOTES.md) says an editor cannot be driven from a worktree** because
`node_modules` is a symlink to the primary. **That premise is stale, and it cost the previous run its
entire live pass.** `npm run dev:debug` from the worktree compiles the *worktree's* sources: CDP reports
`file:///…/wt-bcn009/packages/noodl-editor/src/editor/index.html`, the webpack build resolves `./src/…`
relative to the worktree, and the new specs — which exist only here — ran. The symlink affects where
*packages* resolve from, not where *sources* are read from.

Driven over CDP against the **`VerifyFix4` project outside the repo** — which turned out to be the exact
fixture from the previous live QA: `cloudservices` → `http://localhost:8579` (`nodegx`, appId
`backend_ms94j6xso72rl`), three REST backends, `activeBackendId` → *Rig Custom*, no `version`. A legacy
project with two active backends, saved by the previous build. Nothing better could have been constructed.

| # | Check | Result |
|---|---|---|
| 6.1 | **One ACTIVE badge**, where there were two | ✅ `badgeCount: 1`, on the endpoint card |
| 6.2 | **Opening the project and the panel writes nothing** | ✅ `storedActive` unchanged, `version` still absent |
| 6.3 | The conflict is stated on both cards; Rig Custom has `Set active`, not a badge | ✅ rendered, quoted in §4 |
| 6.4 | ⚠️ **`_endpoint_` round-trips through project metadata** | ✅ `activeBackendId: "_endpoint_"`, `version: 2` |
| 6.5 | The **runtime** resolves that metadata | ✅ a throwaway jest probe: a node parameter of `_endpoint_`, of `_active_`, and unset all resolve to `http://localhost:8579`; `backendEntries` still lists both; the unknown `version` key is ignored |
| 6.6 | The **switch dialog opens with the endpoint on the `from` side** | ✅ "NOW / Built-in backend … AFTER THIS CHANGE / Rig Directus", with `backend-switch-token-change` present (app-id → access-token) |
| 6.7 | … and on the `to` side | ✅ the reverse, with the "no longer carry a token" sentence |
| 6.8 | Confirming converges: `version: 2` written, badge moves, conflict note gone | ✅ |
| 6.9 | ⚠️ **A new backend does not steal an active project** | ✅ created a PocketBase backend with the endpoint active; `activeBackendId` stayed `_endpoint_`, one badge |
| 6.10 | Deleting the active backend falls back to the **endpoint**, not the first survivor | ✅ `afterDelete: "_endpoint_"` with Rig Directus still in the list |
| 6.11 | **Survives a relaunch** | ✅ one badge, legacy metadata still unwritten, cards as before |
| 6.12 | The endpoint card's title is a **name**, the app id is on the detail line | ✅ "Built-in backend" / "Built-in • backend_ms94j6xso72rl • http://localhost:8579" |
| 6.13 | The endpoint status says **"stopped"** for a stopped local backend | ✅ no green tick |

Screenshot read back and inspected: one accent-bordered card with one badge, two inactive local-backend
cards below it, nothing overlapping.

### 6.14 Two CDP notes for whoever is next

- **The `[class*=VisibleDialog] > [class*=ChildContainer]` scoping works exactly as documented.** The
  measuring copy is real and permanent, and `confirm-backend-switch` matched twice every time.
- ⚠️ **HMR did not swap `BackendCard`** after a one-line `testId` addition. The log said
  `[HMR] Updated modules: …/BackendCard.tsx` and `[HMR] App is up to date`, and the rendered DOM still
  had the old output — including after toggling the panel off and on to force a remount. Relaunching
  fixed it. This is the "HMR keeps the old component" trap, confirmed again, with the log lines that make
  it look like it worked.

---

## 7. BCN-009 step 4 vs BCN-004 step 5 — the question, settled

**They are not the same thing. BCN-004 step 5 closes roughly half of step 4.**

BCN-009 step 4 is *"The backend picker with the hide-when-one rule, **across every node that takes one**"*,
and Desired State §3 spells out which: *"Every **data, auth and file** node."*

| Family | Files | Has a `backendId` port? |
|---|---|---|
| BYOB data (4) | `byob-create-record`, `byob-update-record`, `byob-delete-record`, `byob-query-data` | ✅ pre-existing |
| Record data (6) + relations (2) | `dbmodelcrudbase`, `dbmodelnode2`, `dbcollectionnode2`, `filterdbmodelsnode`, `dbmodelnode-add/removerelation` | ✅ **BCN-004 step 5** |
| **Auth** | `nodes/std-library/user/user.ts`, `user/setuserproperties.ts` | ❌ **none** |
| **Files** | `data/cloudfilenode.ts`, `data/signfileurl.ts` | ❌ **none** |

So: the **data** half of step 4 is built and was seen live (BCN-004-NOTES-STEP5 §7). The **auth** and
**file** halves are not, and they are the same mechanism — `resolveSchemaPortContext` plus
`hideWhenSingleBackend` — applied to four more files. And per BCN-004 §7, `hideWhenSingleBackend`'s
hide-at-one branch has **still never been exercised**, in either half.

**Recommendation**: keep step 4 open, re-scoped to "auth and file nodes, plus the first exercise of the
hide-at-one branch". It is now unblocked in a way it was not before — with one selection, "how many
backends does this project have" finally has one answer.

---

## 8. ⚠️ Required runtime follow-ups — not mine, and the phase is not finished without them

Editor-only by design. These three are what makes the convergence *act*, and each is written so it can be
applied without re-deriving it. All three are in
`packages/noodl-runtime/src/` and belong to Workers A/B/C's territory.

### 8.1 `defaultBackendId` must honour a converged selection — **the load-bearing one**

`api/backends/resolveBackend.ts`. Today it is endpoint-first unconditionally, so a user who switches the
project to Directus in the panel gets a badge that moves and record nodes that do not. Add the converged
branch **in front**, gated on the version so unmigrated projects are untouched:

```ts
export function defaultBackendId(sources: BackendMetaDataSources): string | undefined {
  const entries = backendEntries(sources);
  if (entries.length === 0) return undefined;

  // BCN-009 step 2: a converged project has one recorded selection, and it may
  // name the endpoint. Gated on the version because legacy metadata with the same
  // bytes means something different — see BackendServices/activeBackend.ts.
  const active = sources.backendServices?.activeBackendId;
  if ((sources.backendServices?.version ?? 1) >= 2 && active && entries.some((e) => e.id === active)) {
    return active;
  }

  const endpoint = endpointBackendEntry(sources.cloudservices);
  if (endpoint) return endpoint.id;
  if (active && entries.some((entry) => entry.id === active)) return active;
  if (entries.length === 1) return entries[0].id;
  return active;
}
```

`BackendServicesMetaData` in `nodes/std-library/data/schema-types.d.ts` needs `version?: number`.

⚠️ **Do not apply this without the version gate.** Ungated, a legacy project with an endpoint and
`activeBackendId: 'backend_directus'` moves every Record node onto Directus — BCN-004 §2.1's exact
disaster.

### 8.2 BYOB nodes must be able to see the endpoint

`nodes/std-library/data/byob-utils.ts:90` calls `resolveBackendTarget(backendId, { backendServices })` —
no `cloudservices`. So a BYOB node cannot resolve `_endpoint_` at all. Under a converged selection that
means a BYOB node in a project whose backend is the endpoint resolves nothing. Pass both, **gated the same
way** (ungated, it flips BYOB `_active_` from the BYOB backend to the endpoint in every legacy project):

```ts
const target = resolveBackendTarget(backendId, { backendServices, cloudservices });
```

The same applies to `hideWhenSingleBackend`'s count for BYOB nodes: `resolveSchemaPortContext` is passed
`extraBackends` by `record-ports.ts` and not by the BYOB nodes, so a converged project with an endpoint
plus one Directus counts **one** for a BYOB node and hides the picker. Same fix, same gate.

### 8.3 The `_endpoint_` picker entry is labelled with the raw app id

`resolveBackend.ts::endpointBackendEntry`:

```ts
name: cloudservices.appId || (type === 'nodegx' ? 'Built-in' : 'Parse Server'),
```

The app id wins whenever there is one, so the dropdown reads `backend_ms94j6xso72rl` beside "Rig
Directus". The editor's fix (`backendList.ts::endpointDisplayName`) is the same judgement: an app id is
*identity*, not a name. Invert the fallback and the two agree:

```ts
name: type === 'nodegx' ? 'Built-in backend' : 'Parse Server',
```

⚠️ It is a **label**, not an id — `ENDPOINT_BACKEND_ID` is what the parameter stores — so no saved value
changes.

### 8.4 Known, not required here

**`CloudStore._handle()` still answers `nodegx` unconditionally**, so any capability gate reading it sees
a floor rather than the truth. Runtime, not mine, and nothing built here reads it. BCN-010 owns the
gating and should not be built on top of it.

---

## 9. ⚠️ Could not verify — precise, not apologetic

1. **Nothing was exported or deployed.** BCN-009's success criterion *"a deployed app resolves its backend
   from the unified metadata"* is **not met and cannot be** until §8.1 lands: the exporter injects
   `cloudservices` unchanged, which is deliberate (§2), and the deployed runtime resolves through
   `defaultBackendId`, which is unchanged. §6.5 verifies the resolver against the converged metadata **in
   jest**, not in a bundle.
2. **No node was pointed at anything.** No Record node's `Backend` picker was opened, no query was run,
   and nothing observed a node following the selection. §6.5 pins the resolver's answer; the wire from
   there to a node is BCN-004's and was not re-driven.
3. **`hideWhenSingleBackend`'s hide-at-one branch is still unexercised** — the QA project has four
   backends. It is BCN-004 §7's open item and it is still open, and §8.2 says it now has a second way to
   get the count wrong.
4. **The auth and file node families were read, not run.** §7's table comes from grep over
   `nodes/std-library/`; no auth or file node was added to a graph.
5. **Narrow-width layout.** The panel was at its default width throughout, never 240px. The endpoint
   card's new second button row (`Set active` above Edit/Disconnect) and the conflict sentence are
   unrendered at that width. Carried over from BCN-009-LIVE-QA §5, and now with more in it.
6. **The add dialog's own form was not driven** for §6.9. `createBackend` was called directly — the same
   call `AddBackendDialog.tsx:203` makes — so the *rule* is verified and the dialog's path to it is not.
7. **No merge/version-control case.** `projectmerger.diff.ts` treats `cloudservices` as its own diff
   category and `backendServices` is a plain metadata blob; whether `version: 2` and `_endpoint_` diff
   and revert legibly was not looked at.
8. **Two editors on one project.** The selection is derived from `ProjectModel` on every read, so a
   second editor writing `cloudservices` is picked up on the `cloudServicesChanged` event — subscribed in
   `initialize`, unsubscribed in `reset`. Never tested with two windows.
9. **`endpointRemoved()` was not clicked.** Disconnect's new callback re-points a selection naming the
   endpoint; the model rule is unit-tested (`selectionAfterEndpointRemoved`), the button was not pressed —
   the QA project's endpoint is load-bearing for the rest of the script.
10. **The `_endpoint_` label in the runtime picker is unchanged**, so a Record node's dropdown still shows
    the raw app id. §8.3. The editor's panel is fixed; the dropdown is not.

---

## 10. Gates

| Gate | Command | Result |
|---|---|---|
| Editor Jasmine | `run-electron-tests.js --ci` from the worktree | ✅ **1957 specs, 0 failures** (1932 baseline **+25**: 23 new in `BackendSelection.test.ts`, 2 new in `BackendSecurity.test.ts`) |
| `noodl-runtime` jest | `npx jest` after `npm run build:types` | ✅ **83 suites / 1556 passed**, 13 pending — control, matches BCN-004 exactly |
| `nodegx-backend-contract` jest | `npx jest` | ✅ **146 passed** — control, matches |
| Editor typecheck | `tsc -p packages/noodl-editor --noEmit` | ✅ clean |
| Editor tests typecheck | `tsc -p packages/noodl-editor/tsconfig.tests.json --noEmit` | ✅ clean |
| Root typecheck | `tsc --noEmit -p tsconfig.json` | ⚠️ 18 errors, **all** `Cannot find module '@noodl-versioning'`, pre-existing, none in a touched file |
| Catalog | `npm run catalog:check` | ✅ `156 node types, 89 with dynamic ports, 24 port value types` — **committed catalog is up to date**, zero diff |
| Hex-colour ratchet | `node scripts/hex-color-ratchet.js` | ✅ `noodl-editor 16 / baseline 16`, holding |
| Lint ratchet | `node scripts/lint-ratchet.js` | ✅ 828 vs a 3916 baseline |
| TSFixme ratchet | `node scripts/tsfixme-ratchet.js` | ⚠️ **RED, and not from this task** — `any +26`, the same pre-existing red BCN-001 §9 and BCN-009 §6 recorded on `cline-dev`. The eight listed grown files are in `noodl-viewer-react/tests`, `nodegx-backend`, `nodegx-backend-contract/tests`, `noodl-runtime` and `editor/utils/ipc.ts`. **None is this task's**; the new model file and the four edited view/model files contribute zero markers |

`noodl-runtime`'s `dist-types` had to be built (`npm run build:types` inside the package) before four
corpus suites would start — without it the run reads `79 passed / 84` with four `Cannot find module
'@noodl/runtime'` failures that look like real breakage.

---

## 11. Files

**New**

- `packages/noodl-editor/src/editor/src/models/BackendServices/activeBackend.ts` — the converged
  selection: the two ids, the version marker, the resolution rules, the conflict rule, and the
  create/delete/disconnect transitions. All pure.
- `packages/noodl-editor/tests/models/BackendSelection.test.ts` — 23 specs.

**Edited**

- `models/BackendServices/BackendServices.ts` — derived `activeBackendId`, `isEndpointActive`,
  `conflictingBackendId`, `endpointRemoved()`; the migration in `saveToProject`; `setActiveBackend`
  accepts `_endpoint_`; the create and delete rules; a `cloudServicesChanged` subscription.
- `models/BackendServices/types.ts` — `version` on the metadata, `activeBackendId` documented as possibly
  `_endpoint_`, three interface members.
- `models/BackendServices/backendList.ts` — one active id, `endpointDisplayName`, managed entries never
  active, the endpoint entry carries `ENDPOINT_BACKEND_ID`.
- `models/BackendServices/index.ts` — export the new module.
- `views/panels/BackendServicesPanel/BackendServicesPanel.tsx` — owns the one selection; the endpoint in
  the switch flow; the conflict note; the endpoint's local status.
- `views/panels/BackendServicesPanel/CloudServicesEndpointSection/` — conditional badge and border,
  `Set active`, the human name, the honest status line (`.tsx` and `.module.scss`).
- `views/panels/BackendServicesPanel/BackendCard/BackendCard.tsx` — the conflict note, and a `testId` on
  `Set active`.
- `tests/models/BackendSecurity.test.ts`, `tests/models/index.ts`.
