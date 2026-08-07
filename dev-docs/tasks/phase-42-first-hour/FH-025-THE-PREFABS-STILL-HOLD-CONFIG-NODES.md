# FH-025 — The prefabs do not still hold Config nodes. Two tables do, and a CI gate is red about it.

**From:** the oldest row in [README.md § Filed, not fixed](README.md#filed-not-fixed) —
*"Nine Config nodes in four shipped prefabs (send-grid, mail-gun, stripe, email-verification) now
paint as missing-type … **Wants a task**."*
**Status:** ✅ **shipped 2026-08-06.** The row was **stale** — measured, not assumed. What the
`DbConfig` deletion actually left behind is three table rows naming a type that no longer exists,
and a **PR CI gate that has been red** ever since.

---

## 1. The row is stale, and here is the measurement

The row's premise was checked before anything was written, because this register's most repeated
failure is a row that outlived its fix
([registers-outlive-their-fixes](README.md), 9 rows across 3 registers in 2 days).

[FH-023](FH-023-THE-PREFABS-LOST-THEIR-KEYS.md) (commit `4b3c95f7`, the **same day** the row was
filed) did the work the row asks for. Verified independently by reading the four
`project/project.json` files rather than the doc:

| Prefab | `DbConfig` nodes | `noodl.cloud.secret` nodes | Settings component ports |
|---|---|---|---|
| send-grid | **0** | 1 (`SENDGRID_API_KEY`) | in `Fetch`; out `API Key`, `Ready`, `Failure` |
| mail-gun | **0** | 2 (`MAILGUN_API_KEY`, `MAILGUN_DOMAIN`) | in `Fetch`; out `API Key`, `Domain Name`, `Ready`, `Failure` |
| stripe | **0** | 3 (`STRIPE_API_KEY`, `…_CHECKOUT_SUCCESS_URL`, `…_CHECKOUT_CANCEL_URL`) | in `Fetch`; out 3 values, `Ready`, `Failure` |
| email-verification | **0** | 3 (`SENDGRID_API_KEY`, `EMAIL_VERIFICATION_DOMAIN`, `EMAIL_VERIFICATION_FROM`) | two Settings comps, both `Fetch`/`Ready`/`Failure` |

**Nine was the right count** (1 + 2 + 3 + 3), and all nine are now `noodl.cloud.secret` under eight
names. Everything else the row implies was checked too, and holds:

- **All 14 Settings instances are inside `/#__cloud__/` components.** No browser graph in any of the
  four instantiates a Settings component, so `Secret`'s `availableIn: ["cloud"]` is not violated —
  the brief's decisive question (*"is this a browser graph that should never have held a key?"*)
  was already answered *no*, for all four, by measurement rather than by rule.
- **The double-send trap is closed**: `runOnChange-in-*: false` is written on **11** Function nodes
  (send-grid 1, mail-gun 1, stripe 7, email-verification 2), matching FH-023's own count.
- **No `DbConfig` remains under `library/`** except four lines of prose in `library/prefabs/AUDIT.md`,
  which correctly record the supersession.
- **`library-dist/` is gitignored** (`.gitignore:200`), so there is no stale committed zip still
  shipping the old graphs.
- All four `library.json` descriptions and all four `README.md`s name their secrets by env-suffix
  name. `npm run library:check` → **58/58 entries clean**.

**So there is nothing to repair in the prefabs, and the doc the row asks for cannot be the doc the
row describes.** This is that doc, about what was actually left.

---

## 2. The real mechanism — a deleted type still has three rows, and one guard was already red

FH-018 deleted the `DbConfig` **node type**. FH-023 removed its **instances**. Neither removed its
**classifications**, and its own loose end #4 named only one of the two tables that carry one.

### 2a. The two table rows

```ts
// packages/noodl-editor/src/editor/src/validation/backendRequirement.ts:115
export const DELIBERATELY_BACKEND_FREE = Object.freeze({
  DbConfig:
    'Reads the project\'s own cloud-services config and reports whether one is set. …',
```

```ts
// packages/nodegx-backend-contract/src/nodeCapabilities.ts:158
export const DELIBERATELY_UNBOUND = Object.freeze({
  …
  DbConfig: 'Reads project config, not the backend.'
});
```

and a third in the test fixture that exercises the first
([backendRequirement.test.ts:92](../../../packages/noodl-editor/tests-unit/aib-007/backendRequirement.test.ts#L92)),
where `{ id: 'n4', type: 'DbConfig' }` is the node the assertion expects **not** to be flagged.

### 2b. ⚠️ The gate that already says so, and has been red

`backendRequirement.ts`'s completeness guard is not decoration — it is exactly the check this class
of drift needs, and it was **written before the drift happened**:

> *"every node in the catalog's `Cloud Services` and `Cloud` categories, and every key in
> `NODE_CAPABILITIES`, must appear in exactly one of `NODES_REQUIRING_BACKEND` and
> `DELIBERATELY_BACKEND_FREE` … A cloud node added to the catalog fails that test until somebody
> classifies it."*
> — [backendRequirement.ts:26-36](../../../packages/noodl-editor/src/editor/src/validation/backendRequirement.ts#L26)

It lives in `tests-unit/aib-007/backendRequirement.test.ts`, which `npm run test:main` runs, which
is a **PR CI gate** ([pr.yml:107](../../../.github/workflows/pr.yml#L107)). Run today, on `HEAD`:

```
FAIL tests-unit/aib-007/backendRequirement.test.ts
  ✕ classifies every node in the catalog's cloud categories
  ✕ classifies every node BCN-010 binds a backend capability to
  ✕ names only node types the catalog actually has
```

Three failures, from three separate causes, none of them noticed because nobody ran the gate:

| Test | What it found | Whose |
|---|---|---|
| `names only node types the catalog actually has` (:71) | ghost: **`DbConfig`** | **this row** — FH-018/FH-023's tail |
| `classifies every node in the catalog's cloud categories` (:42) | **9** unclassified: `SubscribeToChanges` + `noodl.cloud.{createuser,deleteuser,updateuser,verifysessiontoken,hmac,jwtsign,jwtverify,secret}` | TALK-005 (1) and the CWF-008…018 cloud vocabulary (8) |
| `classifies every node BCN-010 binds a backend capability to` (:52) | **`SubscribeToChanges`** — bound `realtime.subscribe` at [nodeCapabilities.ts:98](../../../packages/nodegx-backend-contract/src/nodeCapabilities.ts#L98), classified nowhere | TALK-005 |

⚠️ **The nine include `noodl.cloud.secret` itself** — CWF-009's Secret node, the very replacement
this row points at. The node that fixed the row arrived without a classification, so the row's own
remedy is one of the three things holding the gate red.

The two non-`DbConfig` causes are **not** separable from this task: the ghost cannot be removed
without turning the suite green, and the suite cannot go green while nine of its subjects are
unclassified. So they are in scope, and each is decided on its own merits below rather than swept.

### 2c. Why `nodeCapabilities.ts`'s ghost was invisible

`@noodl/backend-contract` has the disjointness check
([gating.test.ts:267](../../../packages/nodegx-backend-contract/tests/gating.test.ts#L267)) but **no
ghost check** — it cannot have one, because the contract package does not depend on
`@noodl/noodl-types` and so cannot see the catalog. Its 199 specs are green with a phantom in the
table. The editor's test *can* see both (it already imports `NODE_CAPABILITIES` **and**
`node-catalog.json`), so the missing guard belongs there, on the same import it already has.

---

## 3. The classification decisions, one per node

The file's own bar: *"Every row was checked against the node's own implementation … and the ones
that were not checkable were put in `DELIBERATELY_BACKEND_FREE` with a reason rather than guessed
at."* Held to, per node, not per family.

| Node | Verdict | Reason |
|---|---|---|
| `SubscribeToChanges` | **`'backend'`** | Browser-side (`availableIn: ["browser"]`), and its whole function is to open a channel to the project's backend. With none it subscribes to nothing and reports nothing — the silent-success failure `NODES_REQUIRING_BACKEND`'s Users comment already names as *"worse than an error because it looks like it worked."* BCN-010 binds it `realtime.subscribe`, which agrees. |
| `noodl.cloud.createuser` · `deleteuser` · `updateuser` · `verifysessiontoken` | **backend-free** | CWF-015. Cloud-only, running in the backend process against the backend they are already deployed to — the existing reason on `noodl.cloud.sendemail`, verbatim and for the same reason. |
| `noodl.cloud.hmac` · `jwtsign` · `jwtverify` | **backend-free** | CWF-010's crypto kit. Pure computation over `node:crypto`. These reach nothing at all — a **stronger** claim than the deployment argument above, and written as its own reason so the next reader does not merge the two. |
| `noodl.cloud.secret` | **backend-free** | CWF-009. Reads the **hosting process's own** secret store through the `functions` namespace ([BACKEND-AUTHORING-MODEL § Secrets](../../reference/BACKEND-AUTHORING-MODEL.md)) — not a request to a configured backend. Its own failure mode (*"works locally, 401s in production because nobody provisioned it"*) is a provisioning problem, and a "you have no backend" diagnostic would name the wrong thing. |
| ~~`DbConfig`~~ | **removed from both tables** | The type does not exist. A reason for a node nobody can author is not documentation, it is a claim nothing can check — which is the objection `nodeCapabilities.ts`'s own module note raises against untested tables. |

**Why the `Cloud` category is enumerated rather than swept.** A one-line rule (*"category `Cloud` ⇒
backend-free"*) would pass the guard forever and destroy the property the guard exists for. It would
also be **wrong on the evidence already in the file**: `noodl.cloud.aggregate` is cloud-only and is
classified `'backend'`, because it issues a real data request. Eight rows with eight reasons keeps
the next CWF node failing the gate until somebody decides, which is what was asked for.

---

## 4. Slices

### Slice 1 — remove the ghost
Delete the `DbConfig` row from `DELIBERATELY_BACKEND_FREE`
(`backendRequirement.ts`) and from `DELIBERATELY_UNBOUND` (`nodeCapabilities.ts`). Replace the
test's `DbConfig` fixture node with a real backend-free type so the assertion still proves what it
was written to prove.

### Slice 2 — classify the nine
`SubscribeToChanges` into `NODES_REQUIRING_BACKEND`; the eight cloud-only nodes into
`DELIBERATELY_BACKEND_FREE` in two commented groups (deploy-target vs pure computation). Correct the
stale *"The three Cloud-category nodes"* comment — there are twelve.

### Slice 3 — the guard that would have caught `DbConfig` in the other table
Add a ghost check for `DELIBERATELY_UNBOUND` to `backendRequirement.test.ts`, where the catalog and
the contract are both already in scope. Not in `gating.test.ts`, which structurally cannot see the
catalog.

### Slice 4 — close the row
Update the README row with the measurement, the commit and the reason it was stale.

---

## 5. Traps

- ⚠️ **The row was stale, and the fix that stales it landed the same day.** The register recorded
  FH-023's *filing* and not its *shipping*. Measure a row before working it: this is the fourth
  instance of the pattern in this register alone.
- ⚠️ **A green `library:check` proves nothing here.** It reported 58/58 clean throughout, because
  the ghost is in a TypeScript table, not in a library entry. The gate that knew was `test:main`,
  which is a PR gate nobody in this batch ran.
- ⚠️ **`gating.test.ts` cannot be the home for the ghost check.** `@noodl/backend-contract` has no
  dependency on the catalog and must not acquire one — a contract package that imports the editor's
  node catalog inverts the dependency BCN-001 drew. The check goes where both are already imported.
- ⚠️ **Do not sweep the `Cloud` category.** `noodl.cloud.aggregate` is the counter-example, already
  in the file: cloud-only *and* backend-requiring.
- ⚠️ **`test:main` is red for two other reasons that are not this task's.** `tests-unit/erg-005/*`
  (2 suites) and `tests-unit/workflow/workflowChangeSet.test.ts` fail to compile against a sibling
  session's uncommitted work. This task turns `aib-007` green and touches neither.

---

## 6. Done when

- ✅ `DbConfig` appears in no table, no fixture and no live code path — only in the docs that record
  its deletion.
- ✅ `npx jest tests-unit/aib-007/backendRequirement.test.ts` → **11 passed, 0 failed** (10 before,
  plus the new ghost guard).
- ✅ A phantom in **either** table now fails a test, proven by re-introducing one and watching it go
  red rather than by reading the code.
- ✅ `npm run library:check` **58/58**, `npm run typecheck:editor` clean, `@noodl/backend-contract`
  199/199.

---

## 7. Loose ends — filed, not fixed

1. **`noodl.cloud.aggregate` is classified `'backend'` while every other cloud-only node is
   backend-free.** Defensible on its own terms (it issues a real data request) and inconsistent with
   the module's stated reason for the `Cloud` category (*"a diagnostic here would fire on every
   cloud function in every project"*). Aggregate sits in `Cloud Services`, not `Cloud`, so it was
   swept in with the data family and never met that argument. **Not changed here** — flipping it
   changes a diagnostic users see, and it belongs to whoever owns AIB-007. Recorded so the next
   reader does not "fix" the eight new rows to match it, or it to match them, without deciding.
2. **The Cloud-category nodes are never actually reached by this diagnostic today**, as far as this
   task established — `checkBackendRequirements` is called on components the AI write path is
   authoring, and a cloud-function component is a different surface. Their classification is
   therefore currently a claim in a table rather than a behaviour. Worth someone confirming, because
   if it is true then the `Cloud` category's whole presence in `CLOUD_CATEGORIES` is guarding
   something inert.
3. **`library/prefabs/AUDIT.md:410-423` still reads as if the four prefabs are broken.** Its
   §6 note says *"the runtime logs and skips them"*, superseded twice over (FH-018 then FH-023). Not
   this task's file to rewrite, but it is the first thing a reader of the prefab audit sees.
